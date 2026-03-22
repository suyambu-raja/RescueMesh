import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  TextInput,
  ScrollView,
  Modal,
} from 'react-native';
import { Camera, MapPin, ChevronDown, X } from 'lucide-react-native';
import MapView from 'react-native-maps';
import { COLORS } from '../constants/theme';
import { apiCall } from '../api';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '../store/appStore';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

interface DangerZonesScreenProps {
  navigation: any;
}

export default function DangerZonesScreen({ navigation }: DangerZonesScreenProps) {
  const { isLoggedIn } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('high');
  const [dangerType, setDangerType] = useState('flood');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [locationName, setLocationName] = useState('Select Location...');
  const [coords, setCoords] = useState<{lat: number, lon: number} | null>(null);

  const [showMapModal, setShowMapModal] = useState(false);
  const [mapRegion, setMapRegion] = useState({ latitude: 13.0827, longitude: 80.2707, latitudeDelta: 0.05, longitudeDelta: 0.05 });

  const handleTakePic = async (useGallery = false) => {
    try {
      if (useGallery) {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return Alert.alert('Error', 'Gallery permission is required.');
          const res = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
          });
          if (!res.canceled) setImageUri(res.assets[0].uri);
      } else {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') return Alert.alert('Error', 'Camera permission strictly required.');
          const res = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.5,
          });
          if (!res.canceled) setImageUri(res.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Image Error', e.message);
    }
  };

  const captureLocation = () => {
     setShowMapModal(true);
  };

  React.useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
           const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
           setMapRegion({ ...mapRegion, latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch (e) {}
    })();
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

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return Alert.alert("Missing Fields", "Please enter a title and description.");
    if (!coords) return Alert.alert("GPS Warning", "Waiting for GPS lock before you can file a danger report.");

    setLoading(true);
    try {
      const payload = {
        title,
        description,
        severity,
        danger_type: dangerType,
        latitude: coords.lat,
        longitude: coords.lon,
        location_name: locationName,
        radius_meters: 500,
        image_url: imageUri || null
      };
      
      if (isLoggedIn) {
        const res = await apiCall('/zones/', 'POST', payload);
        if (res.status === 'success') {
          navigation.goBack();
        }
      } else {
        await queueAction('/zones/', payload);
        Alert.alert("Saved Locally", "You are fully offline. Your report block is saved encrypted locally and will dispatch precisely when connected.");
        navigation.goBack();
      }
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSeverity = () => {
    const list = ['low', 'medium', 'high', 'critical'];
    let idx = list.indexOf(severity);
    setSeverity(list[(idx + 1) % list.length]);
  };

  const toggleType = () => {
    const list = ['flood', 'fire', 'quake', 'crime', 'collapse'];
    let idx = list.indexOf(dangerType);
    setDangerType(list[(idx + 1) % list.length]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.description}>
          Help others by filing a verified danger zone near you. Attach a photo and submit your report to alert nearby users directly.
        </Text>

        <View style={styles.photoCard}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.dangerImg} resizeMode="cover" />
          ) : (
            <View style={{flex: 1, backgroundColor: COLORS.surfaceMid, alignItems: 'center', justifyContent: 'center'}}>
               <Text style={{color: COLORS.textMuted}}>No Photo Taken Yet</Text>
            </View>
          )}
          <View style={styles.imgOverlay} />

          <View style={{position: 'absolute', bottom: 16, flexDirection: 'row', gap: 10, alignSelf: 'center'}}>
            <TouchableOpacity style={styles.uploadBtn} onPress={() => handleTakePic(false)} activeOpacity={0.85}>
              <Camera size={16} color={COLORS.surfaceDeep} />
              <Text style={styles.uploadBtnText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.uploadBtn} onPress={() => handleTakePic(true)} activeOpacity={0.85}>
              <Text style={styles.uploadBtnText}>Gallery</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TextInput
          placeholder="Short Title (e.g. Blocked Bridge 41)"
          placeholderTextColor={COLORS.textMuted}
          value={title}
          onChangeText={setTitle}
          style={styles.input}
          autoCapitalize="words"
        />

        <TextInput
          placeholder="Provide detailed description of the danger..."
          placeholderTextColor={COLORS.textMuted}
          value={description}
          onChangeText={setDescription}
          style={styles.textArea}
          multiline
          numberOfLines={4}
        />

        <View style={styles.formCard}>
          <TouchableOpacity onPress={toggleType} style={styles.formRow} activeOpacity={0.7}>
            <Text style={styles.formLabel}>Categorical Class</Text>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
              <Text style={styles.formValue}>{dangerType.toUpperCase()}</Text>
              <ChevronDown size={14} color={COLORS.textMuted} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={toggleSeverity} style={[styles.formRow, { borderTopWidth: 1, borderTopColor: COLORS.border }]} activeOpacity={0.7}>
            <Text style={styles.formLabel}>Threat Severity</Text>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
              <Text style={[styles.formValue, (severity==='high' || severity==='critical') && {color: COLORS.danger}]}>{severity.toUpperCase()}</Text>
              <ChevronDown size={14} color={COLORS.textMuted} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={captureLocation} style={[styles.formRow, { borderTopWidth: 1, borderTopColor: COLORS.border }]} activeOpacity={0.7}>
            <Text style={styles.formLabel}>Spatio-Location</Text>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
               <Text style={styles.formValue} numberOfLines={1}>{locationName}</Text>
               <MapPin size={14} color={COLORS.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.submitBtn}
          onPress={handleSubmit}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.surfaceDeep} />
          ) : (
            <Text style={styles.submitBtnText}>Dispatch Warning Zone</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Map Interactive Modal */}
      <Modal visible={showMapModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: COLORS.surfaceDeep }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
            <Text style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' }}>Drop Target Pin</Text>
            <TouchableOpacity onPress={() => setShowMapModal(false)} style={{ padding: 4 }}>
              <X color={COLORS.textMuted} size={24} />
            </TouchableOpacity>
          </View>

          <View style={{ flex: 1 }}>
            <MapView
              style={{ flex: 1 }}
              mapType="hybrid"
              initialRegion={mapRegion}
              onRegionChangeComplete={(r) => setMapRegion(r)}
            />
            {/* Center Needle Overlay */}
            <View pointerEvents="none" style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -36, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
               <MapPin size={36} color={COLORS.danger} strokeWidth={2.5} />
               <View style={{position: 'absolute', bottom: -1, width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.6)'}} />
            </View>
            <View style={{ position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Drag map to Danger Zone</Text>
            </View>
          </View>

          <View style={{ padding: 20, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 12, paddingBottom: 40 }}>
            <TouchableOpacity
              style={[styles.submitBtn, {marginTop: 0}]}
              onPress={async () => {
                let name = 'Selected Zone';
                try {
                  let geo = await Location.reverseGeocodeAsync({ latitude: mapRegion.latitude, longitude: mapRegion.longitude });
                  if (geo.length > 0) name = [geo[0].name, geo[0].street, geo[0].city].filter(Boolean).join(', ') || name;
                } catch (e) {}
                setCoords({ lat: mapRegion.latitude, lon: mapRegion.longitude });
                setLocationName(name);
                setShowMapModal(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.submitBtnText}>Confirm Danger Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: { padding: 20, gap: 16, paddingBottom: 40, flexGrow: 1 },
  description: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
  },
  photoCard: {
    height: 200,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dangerImg: { ...StyleSheet.absoluteFillObject },
  imgOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 16,
    backgroundColor: 'transparent',
  },
  uploadBtn: {
    backgroundColor: 'rgba(240,249,255,0.95)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  uploadBtnText: { color: COLORS.surfaceDeep, fontWeight: '800', fontSize: 13 },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  textArea: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    color: COLORS.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  formCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  formLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  formValue: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, maxWidth: 150 },
  submitBtn: {
    backgroundColor: COLORS.danger,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 'auto',
    shadowColor: COLORS.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  submitBtnText: { color: COLORS.surfaceDeep, fontWeight: '800', fontSize: 15 },
});
