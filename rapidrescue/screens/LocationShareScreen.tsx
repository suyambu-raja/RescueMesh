import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
} from 'react-native';
import { Search, MapPin, Target } from 'lucide-react-native';
import { COLORS, ASSETS } from '../constants/theme';

interface LocationShareScreenProps {
  navigation: any;
}

export default function LocationShareScreen({ navigation }: LocationShareScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLive] = useState(false);

  const coords = searchQuery
    ? '13.0604° N, 80.2496° E'
    : '13.0827° N, 80.2707° E';

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Search */}
        <View style={styles.searchBar}>
          <Search size={18} color={COLORS.textMuted} />
          <TextInput
            placeholder="Search location to share..."
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
          />
        </View>

        {/* Map preview - tappable */}
        <TouchableOpacity
          style={styles.mapContainer}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('MapView', { type: 'location' })}
        >
          <Image source={{ uri: ASSETS.MAP_BG }} style={styles.mapImg} resizeMode="cover" />
          <View style={styles.mapOverlay} />

          {/* Live badge */}
          {isLive && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}

          {/* Pulsing ring */}
          {!searchQuery && <View style={styles.pulseRing} />}

          {/* Center pin */}
          <View style={styles.centerPin}>
            <View style={styles.pinLabel}>
              <Text style={styles.pinLabelText}>
                {searchQuery ? 'Selected Location' : 'You are here'}
              </Text>
            </View>
            <MapPin size={36} color={COLORS.primary} fill={COLORS.primary} />
          </View>

          {/* Tap hint */}
          <View style={styles.tapHint}>
            <Text style={styles.tapHintText}>Tap to open full map</Text>
          </View>
        </TouchableOpacity>

        {/* Coordinates Card */}
        <View style={styles.coordsCard}>
          <View>
            <Text style={styles.coordsLabel}>
              {searchQuery ? 'Searched Coordinates' : 'Current Coordinates'}
            </Text>
            <Text style={styles.coordsValue}>{coords}</Text>
          </View>
          <View style={styles.targetBtn}>
            <Target size={20} color={COLORS.primary} />
          </View>
        </View>

        {/* Share Button */}
        <TouchableOpacity style={styles.shareBtn} activeOpacity={0.85}>
          <Text style={styles.shareBtnText}>Share My Location</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, padding: 20, gap: 16 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 14 },
  mapContainer: {
    height: 270,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.borderPrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  mapImg: { ...StyleSheet.absoluteFillObject, opacity: 0.6 },
  mapOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,26,36,0.35)' },
  liveBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.danger,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 50,
    gap: 6,
    borderWidth: 1,
    borderColor: '#f87171',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  pulseRing: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(0,180,216,0.15)',
    marginTop: -90,
    marginLeft: -90,
  },
  centerPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    alignItems: 'center',
    marginTop: -60,
    marginLeft: -60,
    width: 120,
  },
  pinLabel: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 50,
    marginBottom: 4,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  pinLabelText: { color: COLORS.surfaceDeep, fontSize: 10, fontWeight: '700' },
  tapHint: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,26,36,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 50,
  },
  tapHintText: { color: COLORS.textSecondary, fontSize: 10 },
  coordsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  coordsLabel: { fontSize: 10, fontWeight: '600', color: COLORS.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  coordsValue: { color: COLORS.textPrimary, fontSize: 15, fontFamily: 'monospace', letterSpacing: 1 },
  targetBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,180,216,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  shareBtnText: { color: COLORS.surfaceDeep, fontWeight: '700', fontSize: 16 },
});
