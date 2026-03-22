import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { AlertTriangle, ChevronRight, Target, ChevronDown, MapPin } from 'lucide-react-native';
import { COLORS, ASSETS } from '../constants/theme';
import { apiCall } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ZonesScreenProps {
  navigation: any;
}

export default function ZonesScreen({ navigation }: ZonesScreenProps) {
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchZones = async () => {
      setLoading(true);
      let fetchedFromApi: any[] = [];
      try {
        const res = await apiCall('/zones/');
        if (res.status === 'success') fetchedFromApi = res.data;
      } catch (err: any) {
        console.warn("API Error, checking local Zones queue:", err.message);
      } finally {
        try {
          const existing = await AsyncStorage.getItem('offline_queue');
          if (existing) {
            const queue = JSON.parse(existing);
            const localZones = queue
              .filter((q: any) => q.endpoint === '/zones/')
              .map((q: any) => ({
                id: 'local-' + Math.random(),
                ...q.payload
              }));
            fetchedFromApi = [...localZones.reverse(), ...fetchedFromApi];
          }
        } catch(e) {}
        setZones(fetchedFromApi);
        setLoading(false);
      }
    };
    const unsubscribe = navigation.addListener('focus', () => {
      fetchZones();
    });
    fetchZones();
    return unsubscribe;
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Report Danger Zone Button */}
        <TouchableOpacity
          style={styles.reportBtn}
          onPress={() => navigation.navigate('DangerZones')}
          activeOpacity={0.8}
        >
          <View style={styles.reportLeft}>
            <View style={styles.reportIconBg}>
              <AlertTriangle size={18} color={COLORS.danger} />
            </View>
            <Text style={styles.reportBtnText}>Report Danger Zone</Text>
          </View>
          <ChevronRight size={18} color={COLORS.textMuted} />
        </TouchableOpacity>

        {/* Location */}
        <View style={styles.locationRow}>
          <View style={styles.locationLeft}>
            <View style={styles.locationIconBg}>
              <Target size={16} color={COLORS.primary} />
            </View>
            <Text style={styles.locationText}>Nearby Region</Text>
          </View>
        </View>

        {/* Reported Zones Feed */}
        <View style={styles.reportedSection}>
          <Text style={styles.sectionTitle}>Live Field Reports</Text>
          {loading && <ActivityIndicator color={COLORS.primary} />}
          {!loading && zones.length === 0 && (
            <Text style={{color: COLORS.textMuted, marginTop: 8}}>No recent danger zones reported in this area.</Text>
          )}
          {!loading && zones.map((zone) => (
            <View key={zone.id} style={styles.feedCard}>
              <Image 
                source={zone.image_url ? { uri: zone.image_url } : ASSETS.BG_FLOOD} 
                style={styles.feedCardImage} 
                resizeMode="cover"
              />
              <View style={styles.feedCardContent}>
                 <Text style={styles.feedCardTitle}>{zone.title}</Text>
                 <Text style={[styles.feedCardDesc, {marginTop: 2, marginBottom: 4, color: COLORS.textMuted, fontSize: 13}]} numberOfLines={1}>
                     {zone.location_name ? `📍 ${zone.location_name}` : `📍 GPS Bounds`}
                 </Text>
                 <Text style={styles.feedCardDesc} numberOfLines={3}>{zone.description || 'No description provided.'}</Text>
                 <View style={styles.feedCardMeta}>
                   <View style={[styles.feedCardTag, { backgroundColor: zone.severity === 'high' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)' }]}>
                     <AlertTriangle size={12} color={zone.severity === 'high' ? COLORS.danger : '#f59e0b'} />
                     <Text style={[styles.feedCardTagText, { color: zone.severity === 'high' ? COLORS.danger : '#f59e0b' }]}>
                       {zone.severity?.toUpperCase()} RISK
                     </Text>
                   </View>
                   <View style={styles.feedCardTag2}>
                     <MapPin size={12} color={COLORS.textPrimary} />
                     <Text style={styles.feedCardTagText2}>{zone.danger_type?.toUpperCase()}</Text>
                   </View>
                 </View>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  container: { padding: 20, gap: 16, paddingBottom: 40 },
  reportBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  reportLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reportIconBg: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    padding: 8,
    borderRadius: 10,
  },
  reportBtnText: { fontWeight: '600', fontSize: 14, color: COLORS.textPrimary },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 8,
  },
  locationLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationIconBg: {
    backgroundColor: COLORS.surface,
    padding: 8,
    borderRadius: 50,
  },
  locationText: { fontSize: 14, fontWeight: '500', color: COLORS.textPrimary },
  reportedSection: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 4,
  },
  feedCard: {
    backgroundColor: COLORS.surfaceDeep,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  feedCardImage: {
    width: '100%',
    height: 180,
  },
  feedCardContent: {
    padding: 16,
  },
  feedCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  feedCardDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  feedCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  feedCardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  feedCardTagText: {
    fontSize: 11,
    fontWeight: '800',
  },
  feedCardTag2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  feedCardTagText2: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
});
