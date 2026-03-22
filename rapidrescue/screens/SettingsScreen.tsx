import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  SafeAreaView,
} from 'react-native';
import { Globe, Moon, Bell, Wifi, Siren, User, ChevronRight } from 'lucide-react-native';
import { ASSETS, LANGUAGES } from '../constants/theme';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { useAppStore } from '../store/appStore';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsScreenProps {
  navigation: any;
}

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const {
    userId,
    isLoggedIn,
    setIsLoggedIn,
    fullName,
    email,
    currentLang,
    isOnline,
    settings,
    toggleSetting,
  } = useAppStore();

  const [localAvatar, setLocalAvatar] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('user_avatar');
      if (saved) setLocalAvatar(saved);
    })();
  }, []);

  const handlePickImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
      });

      if (!result.canceled) {
        setLocalAvatar(result.assets[0].uri);
        await AsyncStorage.setItem('user_avatar', result.assets[0].uri);
      }
    } catch (e) {
      console.error("Image pick error", e);
    }
  };

  const getDisplayName = () => {
    if (fullName) return fullName;
    if (!isLoggedIn) return 'Guest User';
    return 'User';
  };

  const handleTestSOS = () => {
    navigation.navigate('SendMessage');
  };

  const isDark = settings.darkMode;
  
  const currentColors = {
    background: isDark ? '#001A24' : '#F0F9FF',
    surface: isDark ? '#00455E' : '#FFFFFF',
    surfaceDeep: isDark ? '#003145' : '#E0F2FE',
    primary: isDark ? '#00B4D8' : '#0284C7',
    textPrimary: isDark ? '#F0F9FF' : '#082F49',
    textSecondary: isDark ? 'rgba(240,249,255,0.6)' : '#475569',
    textMuted: isDark ? 'rgba(240,249,255,0.4)' : '#94A3B8',
    border: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
    borderPrimary: isDark ? 'rgba(0,180,216,0.3)' : 'rgba(2,132,199,0.2)',
    safe: isDark ? '#22c55e' : '#16a34a',
    danger: isDark ? '#ef4444' : '#dc2626',
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: currentColors.background }]}>
      <ScrollView
        style={[styles.scroll, { backgroundColor: currentColors.background }]}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: currentColors.surface, borderColor: currentColors.border }]}>
          <View style={styles.profileLeft}>
            <TouchableOpacity onPress={handlePickImage} style={[styles.avatarWrap, { backgroundColor: currentColors.surfaceDeep, borderColor: currentColors.borderPrimary }]} activeOpacity={0.8}>
              {localAvatar ? (
                <Image source={{ uri: localAvatar }} style={styles.avatar} />
              ) : (
                <User size={24} color={currentColors.primary} />
              )}
            </TouchableOpacity>
            <View>
              <Text style={[styles.profileName, { color: currentColors.textPrimary }]}>{getDisplayName()}</Text>
              <Text style={[styles.profileSub, { color: currentColors.primary, fontWeight: '700' }]}>{userId}</Text>
              <Text style={[styles.profileSub, { color: currentColors.textSecondary }]}>
                {isLoggedIn ? (email) : 'Local Storage Mode'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => isLoggedIn ? setIsLoggedIn(false) : navigation.navigate('Login')}
            style={[styles.authBtn, { backgroundColor: currentColors.surfaceDeep, borderColor: currentColors.borderPrimary }]}
            activeOpacity={0.8}
          >
            <Text style={[styles.authBtnText, { color: currentColors.primary }]}>{isLoggedIn ? 'Logout' : 'Login'}</Text>
          </TouchableOpacity>
        </View>

        {/* Preferences */}
        <View style={[styles.section, { backgroundColor: currentColors.surface, borderColor: currentColors.border }]}>
          <Text style={[styles.sectionTitle, { color: currentColors.primary }]}>Preferences</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Globe size={18} color={currentColors.primary} />
              <Text style={[styles.settingLabel, { color: currentColors.textPrimary }]}>Language</Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={[styles.settingValue, { color: currentColors.textSecondary }]}>
                {LANGUAGES.find((l) => l.code === currentLang)?.name || 'English'}
              </Text>
              <ChevronRight size={16} color={currentColors.textSecondary} />
            </View>
          </View>

          <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: currentColors.border }]}>
            <View style={styles.settingLeft}>
              <Moon size={18} color={currentColors.primary} />
              <Text style={[styles.settingLabel, { color: currentColors.textPrimary }]}>Dark Mode</Text>
            </View>
            <ToggleSwitch enabled={settings.darkMode} onToggle={() => toggleSetting('darkMode')} />
          </View>
        </View>

        {/* Alerts & Network */}
        <View style={[styles.section, { backgroundColor: currentColors.surface, borderColor: currentColors.border }]}>
          <Text style={[styles.sectionTitle, { color: currentColors.primary }]}>Alerts & Network</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Bell size={18} color={currentColors.primary} />
              <Text style={[styles.settingLabel, { color: currentColors.textPrimary }]}>Disaster Alerts</Text>
            </View>
            <ToggleSwitch enabled={settings.notifications} onToggle={() => toggleSetting('notifications')} />
          </View>

          <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: currentColors.border, paddingLeft: 44 }]}>
            <Text style={[styles.settingLabel, { color: currentColors.textSecondary }]}>SOS Notifications</Text>
            <ToggleSwitch enabled={settings.sosAlerts} onToggle={() => toggleSetting('sosAlerts')} />
          </View>

          <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: currentColors.border, backgroundColor: isDark ? 'rgba(0,26,36,0.3)' : 'rgba(0,0,0,0.02)' }]}>
            <View style={styles.settingLeft}>
              <Wifi size={18} color={isOnline ? currentColors.safe : currentColors.danger} />
              <Text style={[styles.settingLabel, { color: currentColors.textPrimary }]}>Network Status</Text>
            </View>
            <View
              style={[
                styles.networkBadge,
                {
                  backgroundColor: isOnline ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  borderColor: isOnline ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                },
              ]}
            >
              <Text
                style={[
                  styles.networkBadgeText,
                  { color: isOnline ? currentColors.safe : currentColors.danger },
                ]}
              >
                {isOnline ? '🟢 ONLINE' : '🔴 OFFLINE'}
              </Text>
            </View>
          </View>
        </View>

        {/* Test SOS */}
        <TouchableOpacity
          onPress={handleTestSOS}
          style={styles.testSOSBtn}
          activeOpacity={0.85}
        >
          <Siren size={22} color="#fff" />
          <Text style={styles.testSOSText}>TEST SOS BUTTON</Text>
        </TouchableOpacity>
        <Text style={[styles.testSOSNote, { color: currentColors.textMuted }]}>
          Simulates an emergency alert for demonstration purposes
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  container: { padding: 20, gap: 14, paddingBottom: 40 },
  profileCard: {
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  profileLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatar: { width: '100%', height: '100%' },
  profileName: { fontWeight: '700', fontSize: 17, marginBottom: 2 },
  profileSub: { fontSize: 12 },
  authBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  authBtnText: { fontWeight: '700', fontSize: 12 },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    letterSpacing: 2,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingLabel: { fontSize: 14, fontWeight: '500' },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  settingValue: { fontSize: 13 },
  networkBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  networkBadgeText: { fontSize: 10, fontWeight: '700' },
  testSOSBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 14,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.5)',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 10,
  },
  testSOSText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  testSOSNote: { fontSize: 10, textAlign: 'center', marginTop: -6 },
});
