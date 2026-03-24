import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { User, Wifi, Globe, ChevronDown, CheckCircle, AlertTriangle, Waves } from 'lucide-react-native';
import { COLORS, LANGUAGES } from '../constants/theme';
import { AlertCard } from '../components/AlertCard';
import { SOSButton } from '../components/SOSButton';
import { useAppStore } from '../store/appStore';
import { apiCall } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';

interface HomeScreenProps {
  navigation: any;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { isLoggedIn, currentLang, setCurrentLang, isOnline, userId, displayName, networkMode } = useAppStore();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAlerts = async () => {
      setLoading(true);
      let fetchedFromApi: any[] = [];
      try {
        const res = await apiCall('/sos/');
        if (res.status === 'success') {
          fetchedFromApi = res.data;
        }
      } catch (err: any) {
        console.warn('API Error, checking local queue:', err.message);
      } finally {
        try {
          const existing = await AsyncStorage.getItem('offline_queue');
          if (existing) {
            const queue = JSON.parse(existing);
            const localSos = queue
              .filter((q: any) => q.endpoint === '/sos/')
              .map((q: any) => ({
                id: 'local-' + Math.random(),
                created_at: new Date().toISOString(),
                ...q.payload
              }));
            fetchedFromApi = [...localSos.reverse(), ...fetchedFromApi];
          }
        } catch(e) {}

        // --- DEDUPLICATION LOGIC ---
        // Prevents spamming of the exact same message from the same user
        const uniqueAlerts: any[] = [];
        const seenMessages = new Set();
        
        // Sort descending so the newest message is kept, discarding older ones
        const sortedData = fetchedFromApi.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        for (const a of sortedData) {
          const msgKey = a.message ? a.message.trim() : a.id;
          if (!seenMessages.has(msgKey)) {
            uniqueAlerts.push(a);
            seenMessages.add(msgKey);
          }
        }
        
        // Show newest items at the top
        setAlerts(uniqueAlerts);
        setLoading(false);
      }
    };
    fetchAlerts();
  }, []);

  const queueAction = async (endpoint: string, payload: any) => {
    try {
      const existing = await AsyncStorage.getItem('offline_queue');
      const queue = existing ? JSON.parse(existing) : [];
      queue.push({ endpoint, payload });
      await AsyncStorage.setItem('offline_queue', JSON.stringify(queue));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSOS = async () => {
    try {
      let batteryLevel = 45;
      try {
        const level = await Battery.getBatteryLevelAsync();
        if (level > 0) {
          batteryLevel = Math.round(level * 100);
        }
      } catch (e) {
        console.warn("Battery read error", e);
      }

      let lat = 13.0827;
      let lon = 80.2707;
      let locString = "Unknown";
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          let location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = location.coords.latitude;
          lon = location.coords.longitude;
          locString = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        }
      } catch (e) {
        console.warn("Location read error", e);
      }

      const payload = {
        latitude: lat,
        longitude: lon,
        battery_percentage: batteryLevel,
        message: `SOS from ${displayName} (${userId}) - Emergency at Loc: ${locString}!`,
        sos_type: "emergency"
      };
      
      // Always try sending to backend first (works with or without login)
      try {
        const res = await apiCall('/sos/', 'POST', payload);
        if (res.status === 'success') {
          Alert.alert("🚨 SOS Sent!", "Your emergency alert has been broadcast to all nearby users.");
          // Refresh alerts list
          const fetchRes = await apiCall('/sos/');
          if (fetchRes.status === 'success') {
            // Deduplicate incoming update
            const newUnique: any[] = [];
            const newSeen = new Set();
            const sortedData = fetchRes.data.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            for (const a of sortedData) {
              const mk = a.message ? a.message.trim() : a.id;
              if (!newSeen.has(mk)) {
                newUnique.push(a);
                newSeen.add(mk);
              }
            }
            setAlerts(newUnique);
          }
          return;
        }
      } catch (apiError: any) {
        console.warn("API failed, queuing locally:", apiError.message);
      }

      // Fallback: save locally if backend unreachable
      await queueAction('/sos/', payload);
      Alert.alert("Saved Locally", "Network unreachable. Your SOS will be sent when connection is restored.");
      
      // Optimistically add to local feed just to show feedback 
      const mockKey = payload.message.trim();
      if (!alerts.some(a => (a.message || '').trim() === mockKey)) {
        setAlerts([{ id: 'local-' + Date.now(), created_at: new Date().toISOString(), ...payload }, ...alerts]);
      }

    } catch (error: any) {
      Alert.alert("SOS Error", error.message);
    }
  };

  const getIconForType = (type: string) => {
    switch(type) {
      case 'medical': return <AlertTriangle size={14} color="#fff" />;
      case 'flood': return <Waves size={14} color="#fff" />;
      default: return <User size={14} color="#fff" />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>RapidRescue</Text>
          <Text style={styles.userIdText}>{displayName} ({userId})</Text>
        </View>
        <View style={styles.headerRight}>
          {/* Language Picker */}
          <TouchableOpacity
            onPress={() => setShowLangMenu(true)}
            style={styles.langBtn}
            activeOpacity={0.7}
          >
            <Globe size={16} color={COLORS.textPrimary} />
            <Text style={styles.langText}>{currentLang}</Text>
            <ChevronDown size={13} color={COLORS.textSecondary} />
          </TouchableOpacity>

          {/* Network status */}
          <View style={[styles.modeBadge, { backgroundColor: isOnline ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' }]}>
            <Wifi size={14} color={isOnline ? COLORS.safe : COLORS.danger} />
            <Text style={[styles.modeText, { color: isOnline ? COLORS.safe : COLORS.danger }]}>
              {networkMode === 'online' ? 'Online' : 'Offline'}
            </Text>
          </View>

          {/* Login/Profile button */}
          {!isLoggedIn ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.loginBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.loginBtnText}>Login</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => navigation.navigate('Settings')}
              style={styles.avatarBtn}
              activeOpacity={0.8}
            >
              <User size={15} color={COLORS.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Language Modal */}
      <Modal
        visible={showLangMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLangMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowLangMenu(false)}
        >
          <View style={styles.langModal}>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setCurrentLang(item.code);
                    setShowLangMenu(false);
                  }}
                  style={[
                    styles.langItem,
                    currentLang === item.code && styles.langItemActive,
                  ]}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.langItemText,
                      currentLang === item.code && { color: COLORS.primary },
                    ]}
                  >
                    {item.name}
                  </Text>
                  {currentLang === item.code && (
                    <CheckCircle size={15} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Main Content Area */}
      <View style={styles.mainContainer}>
        {/* Scrollable Alerts Container */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Cloud Sync badge */}
          {isLoggedIn && (
            <View style={styles.syncBadge}>
              <Text style={styles.syncBadgeText}>☁ Cloud Sync Active</Text>
            </View>
          )}

          {/* Alert Cards */}
          <View style={styles.alertsContainer}>
            {loading && <ActivityIndicator color={COLORS.primary} />}
            {!loading && alerts.length === 0 && (
               <Text style={{textAlign: 'center', color: COLORS.textMuted}}>No active SOS alerts nearby. Stay safe.</Text>
            )}
            {!loading && alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                iconColor={alert.sos_type === 'emergency' ? "#ef4444" : "#3b82f6"}
                icon={getIconForType(alert.sos_type)}
                title={alert.message || "Emergency Alert"}
                latitude={alert.latitude}
                longitude={alert.longitude}
                battery={alert.battery_percentage}
                time={new Date(alert.created_at + (alert.created_at.endsWith('Z') ? '' : 'Z')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Fixed SOS Button Container outside mainContainer */}
      <View style={styles.fixedSosContainer}>
        <SOSButton onPress={handleSOS} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: COLORS.surfaceDeep,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    zIndex: 10,
  },
  logo: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  userIdText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  langBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  langText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  loginBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 50,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  loginBtnText: {
    color: COLORS.surfaceDeep,
    fontWeight: '700',
    fontSize: 13,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 50,
  },
  modeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 80,
    paddingRight: 20,
  },
  langModal: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderPrimary,
    minWidth: 190,
    maxHeight: 360,
    overflow: 'hidden',
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  langItemActive: {
    backgroundColor: 'rgba(0,69,94,0.5)',
  },
  langItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.surfaceDeep,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  syncBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,180,216,0.1)',
    borderWidth: 1,
    borderColor: COLORS.borderPrimary,
    borderRadius: 50,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
  },
  syncBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
  },
  alertsContainer: {
    gap: 10,
  },
  fixedSosContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    backgroundColor: COLORS.background,
  },
});
