import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  PanResponder,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { MapPin, ZoomIn, ZoomOut, Target, X } from 'lucide-react-native';
import { COLORS, ASSETS } from '../constants/theme';

interface MapViewScreenProps {
  navigation: any;
  route: any;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function MapViewScreen({ navigation, route }: MapViewScreenProps) {
  const mapType: string = route?.params?.type || 'shelters';
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const lastPan = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        lastPan.current = { ...pan };
      },
      onPanResponderMove: (_, gestureState) => {
        setPan({
          x: lastPan.current.x + gestureState.dx,
          y: lastPan.current.y + gestureState.dy,
        });
      },
    })
  ).current;

  const getTitle = () => {
    if (mapType === 'shelters') return 'Shelters Map';
    if (mapType === 'assistant') return 'Assistance Map';
    return 'Location Share';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MapPin size={20} color={COLORS.primary} />
          <Text style={styles.headerTitle}>{getTitle()}</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeBtn}
          activeOpacity={0.8}
        >
          <X size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Interactive Map */}
      <View style={styles.mapArea} {...panResponder.panHandlers}>
        <Image
          source={{ uri: ASSETS.MAP_BG }}
          style={[
            styles.mapImg,
            {
              transform: [
                { translateX: pan.x },
                { translateY: pan.y },
                { scale: zoom },
              ],
            },
          ]}
          resizeMode="cover"
        />

        {/* Center You pin */}
        <View style={styles.centerPin} pointerEvents="none">
          <MapPin size={36} color={COLORS.primary} fill={COLORS.primary} />
        </View>

        {/* Conditional pins */}
        {(mapType === 'shelters' || mapType === 'assistant') && (
          <>
            <View style={[styles.floatingPin, { top: '40%', left: '45%' }]} pointerEvents="none">
              <MapPin size={28} color={COLORS.safe} fill={COLORS.safe} />
            </View>
            <View style={[styles.floatingPin, { top: '60%', left: '56%' }]} pointerEvents="none">
              <MapPin size={36} color={COLORS.danger} fill={COLORS.danger} />
            </View>
            <View style={[styles.floatingPin, { top: '44%', left: '65%' }]} pointerEvents="none">
              <View style={styles.safeZoneBadge}>
                <View style={styles.safeZoneDot} />
                <Text style={styles.safeZoneText}>Safe Zone</Text>
              </View>
              <MapPin size={28} color={COLORS.safe} fill={COLORS.safe} />
            </View>
          </>
        )}
      </View>

      {/* Zoom Controls */}
      <View style={styles.zoomControls}>
        <TouchableOpacity
          onPress={() => setZoom((z) => Math.min(z + 0.5, 4))}
          style={styles.zoomBtn}
          activeOpacity={0.8}
        >
          <ZoomIn size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setZoom((z) => Math.max(z - 0.5, 1))}
          style={styles.zoomBtn}
          activeOpacity={0.8}
        >
          <ZoomOut size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => { setPan({ x: 0, y: 0 }); setZoom(1); }}
          style={[styles.zoomBtn, { marginTop: 8 }]}
          activeOpacity={0.8}
        >
          <Target size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Map Controls</Text>
        <View style={styles.legendRow}>
          <Text style={styles.legendText}>🖐 Drag to pan</Text>
          <Text style={styles.legendText}>🔍 Use buttons to zoom</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceDeep,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontWeight: '700', fontSize: 17, color: COLORS.textPrimary },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapArea: {
    flex: 1,
    backgroundColor: '#002230',
    overflow: 'hidden',
  },
  mapImg: {
    width: SCREEN_W * 2.5,
    height: SCREEN_H * 2.5,
    position: 'absolute',
    top: -SCREEN_H * 0.75,
    left: -SCREEN_W * 0.75,
    opacity: 0.75,
  },
  centerPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -18,
    marginLeft: -16,
    zIndex: 10,
  },
  floatingPin: { position: 'absolute', zIndex: 10 },
  safeZoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.safe,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 50,
    gap: 4,
    marginBottom: 3,
    borderWidth: 1,
    borderColor: COLORS.safeDark,
  },
  safeZoneDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  safeZoneText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  zoomControls: {
    position: 'absolute',
    right: 20,
    bottom: 130,
    gap: 10,
    zIndex: 20,
  },
  zoomBtn: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(0,69,94,0.9)',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderPrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  legend: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: 'rgba(0,26,36,0.85)',
    zIndex: 15,
  },
  legendTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 6,
  },
  legendRow: { flexDirection: 'row', gap: 20 },
  legendText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
});
