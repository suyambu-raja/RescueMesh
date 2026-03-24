import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import {
  MapPin,
  Navigation,
  Compass,
  WifiOff,
  CheckCircle,
} from 'lucide-react-native';
import { COLORS, ASSETS } from '../constants/theme';
import { apiCall } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';

const GOOGLE_MAPS_APIKEY = "AIzaSyBL8rScJuuxzfXVL6vNGFwKuO-AuWY_2WI";
const CACHE_KEY = "offline_shelters";

interface Shelter {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  capacity?: number;
  status?: string;
  total_beds?: number;
  occupied_beds?: number;
  image_url?: string;
  img?: any;
  _distance?: number;
  _direction?: string;
}

interface SheltersScreenProps {
  navigation: any;
}

export default function SheltersScreen({ navigation }: SheltersScreenProps) {
  const [shelters, setShelters] = useState<Shelter[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [userLoc, setUserLoc] = useState<{lat: number, lon: number} | null>(null);
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null);
  
  const [routeInfo, setRouteInfo] = useState<{distance: number, duration: number} | null>(null);
  const mapRef = useRef<MapView>(null);

  const calculateVector = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const dist = R * c;

    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    let brng = Math.atan2(y, x) * 180 / Math.PI;
    brng = (brng + 360) % 360;

    const compass = ["North", "North-East", "East", "South-East", "South", "South-West", "West", "North-West"];
    const direction = compass[Math.round(brng / 45) % 8];

    return { dist, direction };
  };

  const openLocationInMaps = async (lat: number, lon: number) => {
    const url = Platform.select({
      ios: `maps:0,0?q=${lat},${lon}&t=k`,
      android: `geo:0,0?q=${lat},${lon}&z=19`,
    });
    
    const fallbackUrl = `https://maps.google.com/?q=${lat},${lon}&t=k`;
    
    try {
      const supported = url ? await Linking.canOpenURL(url) : false;
      if (supported && url) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(fallbackUrl);
      }
    } catch (e) {
      await Linking.openURL(fallbackUrl);
    }
  };

  const processShelters = (raw: any[], currentLat: number, currentLon: number) => {
    const mapped = raw.map((s: any, idx) => {
      const vec = calculateVector(currentLat, currentLon, s.latitude, s.longitude);
      return {
        ...s,
        img: idx % 2 === 0 ? ASSETS.BG_FLOOD : ASSETS.BG_KIT,
        _distance: vec.dist,
        _direction: vec.direction,
      } as Shelter;
    });
    return mapped.sort((a, b) => (a._distance || 0) - (b._distance || 0));
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      let uLoc = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          uLoc = { lat: loc.coords.latitude, lon: loc.coords.longitude };
          setUserLoc(uLoc);
        }
      } catch (e) {
        Alert.alert("GPS Error", "Failed to acquire coordinate vectors.");
      }

      let backendSuccess = false;
      try {
        const res = await apiCall('/shelters/');
        if (res.status === 'success') {
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(res.data));
          if (uLoc) setShelters(processShelters(res.data, uLoc.lat, uLoc.lon));
          backendSuccess = true;
          setIsOffline(false);
        }
      } catch (err) {
        setIsOffline(true);
      }

      if (!backendSuccess) {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (uLoc) setShelters(processShelters(parsed, uLoc.lat, uLoc.lon));
          else setShelters(parsed);
        } else {
          Alert.alert("Offline Critical", "No internet and no cached data available.");
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  const topShelter = shelters.length > 0 ? shelters[0] : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        
        {/* NETWORK BANNER */}
        {isOffline && (
          <View style={styles.offlineBanner}>
             <WifiOff size={16} color="#fff" />
             <Text style={styles.offlineBannerText}>OFFLINE MODE: Using GPS + Local Haversine Calculation</Text>
          </View>
        )}

        {/* MAP & ROUTING */}
        <View style={styles.mapContainer}>
          {userLoc ? (
            <MapView
              ref={mapRef}
              style={styles.mapCanvas}
              mapType="hybrid"
              initialRegion={{
                latitude: topShelter?.latitude || userLoc.lat,
                longitude: topShelter?.longitude || userLoc.lon,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
              }}
            >
              <Marker coordinate={{ latitude: userLoc.lat, longitude: userLoc.lon }} title="You" pinColor={COLORS.safe} />
              
              {shelters.map((s) => (
                <Marker 
                  key={s.id} 
                  coordinate={{ latitude: s.latitude, longitude: s.longitude }} 
                  title={s.name}
                  pinColor={selectedShelter?.id === s.id ? COLORS.primary : COLORS.danger}
                  onPress={() => setSelectedShelter(s)}
                />
              ))}

              {selectedShelter && !isOffline && (
                 <MapViewDirections
                    origin={{ latitude: userLoc.lat, longitude: userLoc.lon }}
                    destination={{ latitude: selectedShelter.latitude, longitude: selectedShelter.longitude }}
                    apikey={GOOGLE_MAPS_APIKEY}
                    strokeWidth={4}
                    strokeColor={COLORS.primary}
                    onReady={(result) => {
                      setRouteInfo({ distance: result.distance, duration: result.duration });
                      mapRef.current?.fitToCoordinates(result.coordinates, { edgePadding: { top: 50, right: 50, bottom: 50, left: 50 } });
                    }}
                 />
              )}
            </MapView>
          ) : (
             <View style={styles.noGpsCard}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={{color: COLORS.textMuted, marginTop: 12}}>Acquiring Satellite Lock...</Text>
             </View>
          )}

          {/* Fallback Directions Panel over map */}
          {selectedShelter && (
            <View style={styles.routeOverlayPanel}>
              <Text style={styles.roTitle}>{selectedShelter.name}</Text>
              {!isOffline && routeInfo ? (
                <>
                  <Text style={styles.roHighlight}>{routeInfo.distance.toFixed(2)} km  •  {Math.round(routeInfo.duration)} mins</Text>
                  <Text style={styles.roLabel}>Google Network Connected</Text>
                </>
              ) : (
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6}}>
                  <Compass size={24} color={COLORS.primary} />
                  <View>
                     <Text style={styles.roHighlight}>Go {selectedShelter._direction}</Text>
                     <Text style={styles.roLabel}>Straight Line Distance: {selectedShelter._distance?.toFixed(1)} km</Text>
                  </View>
                </View>
              )}
            </View>
          )}
        </View>

        {/* LISTINGS */}
        <View style={styles.listContainer}>
          <Text style={styles.sectionHeader}>{isOffline ? 'Locally Cached Shelters' : 'Active Safe Zones'}</Text>
          
          {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />}
          
          {!loading && shelters.map((shelter, idx) => (
            <TouchableOpacity 
              key={shelter.id} 
              activeOpacity={0.8}
              onPress={() => {
                setSelectedShelter(shelter);
                mapRef.current?.animateToRegion({
                  latitude: shelter.latitude,
                  longitude: shelter.longitude,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                });
              }}
              style={[styles.shelterCard, selectedShelter?.id === shelter.id && {borderColor: COLORS.primary}]}
            >
              <View style={styles.shelterLeft}>
                <View style={styles.shelterImgWrap}>
                  <Image source={shelter.image_url ? { uri: shelter.image_url } : (typeof shelter.img === 'string' ? { uri: shelter.img } : shelter.img)} style={styles.shelterImg} resizeMode="cover" />
                  <View style={styles.shelterOnlineDot}>
                     <CheckCircle size={10} color="#fff" />
                  </View>
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.shelterName} numberOfLines={1}>{shelter.name}</Text>
                  <View style={styles.shelterMeta}>
                    <Text style={[styles.shelterDist, {color: COLORS.primary, fontWeight: '700'}]}>{shelter._distance?.toFixed(1)} km</Text>
                    <Text style={styles.shelterDot}>•</Text>
                    <Text style={styles.shelterBeds}>{shelter.occupied_beds || 0}/{shelter.total_beds || '∞'} capacity</Text>
                  </View>
                  {isOffline && (
                    <Text style={styles.bearingText}>🧭 Head {shelter._direction}</Text>
                  )}
                  <TouchableOpacity 
                    onPress={() => openLocationInMaps(shelter.latitude, shelter.longitude)} 
                    activeOpacity={0.7} 
                    style={styles.mapLinkRow}
                  >
                    <MapPin size={12} color={COLORS.primary} />
                    <Text style={styles.linkText}>View in Maps app</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Navigation size={20} color={selectedShelter?.id === shelter.id ? COLORS.primary : COLORS.textMuted} />
            </TouchableOpacity>
          ))}
          {!loading && shelters.length === 0 && (
             <Text style={{textAlign: 'center', color: COLORS.textMuted}}>No shelters within sync threshold.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  offlineBanner: {
    backgroundColor: COLORS.danger,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  offlineBannerText: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '800' },
  mapContainer: {
    height: 380,
    backgroundColor: '#0a192f',
    position: 'relative',
  },
  mapCanvas: { flex: 1 },
  noGpsCard: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  routeOverlayPanel: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,49,69,0.95)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  roTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  roHighlight: { color: COLORS.safe, fontSize: 16, fontWeight: '700' },
  roLabel: { color: COLORS.textSecondary, fontSize: 13, marginTop: 2 },
  listContainer: { padding: 20, paddingBottom: 40 },
  sectionHeader: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 16 },
  shelterCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  shelterLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  shelterImgWrap: { width: 50, height: 50, borderRadius: 12, position: 'relative' },
  shelterImg: { width: '100%', height: '100%', borderRadius: 12 },
  shelterOnlineDot: { position: 'absolute', bottom: -4, right: -4, backgroundColor: COLORS.safe, width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  shelterName: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  shelterMeta: { flexDirection: 'row', alignItems: 'center' },
  shelterDist: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  shelterDot: { fontSize: 13, color: COLORS.border, marginHorizontal: 6 },
  shelterBeds: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  bearingText: { color: COLORS.safe, fontSize: 12, marginTop: 4, fontWeight: '700' },
  mapLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,180,216,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  linkText: {
    fontWeight: '700',
    fontSize: 11,
    color: COLORS.primary,
  },
});
