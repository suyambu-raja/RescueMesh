import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import {
  Users,
  MapPin,
  Radio,
  Shield,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  UserPlus,
  User,
  Phone,
  Trash2,
  X,
} from 'lucide-react-native';
import { COLORS, ASSETS } from '../constants/theme';
import { apiCall } from '../api';
import { useAppStore } from '../store/appStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';

const LOCAL_CONTACTS_KEY = 'rescue_contacts';

interface Contact {
  id: string;
  name: string;
  user_tag: string;
  is_emergency?: boolean;
  is_local?: boolean;
}

interface MessagesScreenProps {
  navigation: any;
}

export default function MessagesScreen({ navigation }: MessagesScreenProps) {
  const { isLoggedIn, userId, displayName } = useAppStore();
  const [activeTab, setActiveTab] = useState<'public' | 'private' | 'food'>('private');
  const [messageText, setMessageText] = useState('');
  const [situationText, setSituationText] = useState('');
  const [foodPeopleCount, setFoodPeopleCount] = useState(1);
  const [foodUrgency, setFoodUrgency] = useState('High');
  
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Map / Location Selection State
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{lat: number, lon: number, name: string} | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [mapRegion, setMapRegion] = useState({ latitude: 13.0827, longitude: 80.2707, latitudeDelta: 0.05, longitudeDelta: 0.05 });

  // Contacts States
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUserTag, setNewUserTag] = useState('');
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('user_avatar');
        if (saved) setLocalAvatar(saved);
      } catch(e) {}
    })();
  }, []);

  const defaultContacts: Contact[] = [
    { id: 'default-1', name: 'City Control Room', user_tag: 'SYSTEM', is_emergency: true },
    { id: 'default-2', name: 'Nearest Hospital', user_tag: 'SYSTEM', is_emergency: true },
    { id: 'default-3', name: 'Assistant', user_tag: 'AI_BOT', is_emergency: false },
  ];

  const loadContacts = async () => {
    let allContacts: Contact[] = [];
    try {
      const stored = await AsyncStorage.getItem(LOCAL_CONTACTS_KEY);
      if (stored) {
        const localContacts = JSON.parse(stored).map((c: any) => ({ ...c, is_local: true }));
        allContacts = [...localContacts];
      }
    } catch (e) {}

    if (isLoggedIn) {
      try {
        const res = await apiCall('/contacts/');
        if (res.status === 'success' && res.data.length > 0) {
          const serverContacts = res.data.map((c: any) => ({
            id: c.id, name: c.name, user_tag: c.user_tag || 'N/A', is_emergency: c.is_emergency, is_local: false,
          }));
          allContacts = [...allContacts, ...serverContacts];
        }
      } catch (e) {}
    }
    setContacts([...allContacts, ...defaultContacts]);
  };

  const fetchData = async () => {
    setLoading(true);
    if (activeTab === 'private') {
      await loadContacts();
      setLoading(false);
      return;
    }

    let fetchedFromApi = [];
    try {
      if (activeTab === 'food') {
        const res = await apiCall('/food/');
        fetchedFromApi = res.data || [];
      } else {
        const res = await apiCall(`/messages/?message_type=${activeTab}`);
        fetchedFromApi = res.data || [];
      }
    } catch (error: any) {
      console.warn("API Error, falling back to local queue:", error.message);
    } finally {
      try {
        const existing = await AsyncStorage.getItem('offline_queue');
        if (existing) {
          const queue = JSON.parse(existing);
          const localItems = queue
            .filter((q: any) => {
              if (activeTab === 'food') return q.endpoint === '/food/';
              return q.endpoint === '/messages/' && q.payload.message_type === activeTab;
            })
            .map((q: any) => {
              if (activeTab === 'food') {
                return {
                  id: 'local-' + Math.random(),
                  created_at: new Date().toISOString(),
                  user_tag: userId,
                  user_id: userId,
                  ...q.payload
                };
              } else {
                return {
                  id: 'local-' + Math.random(),
                  created_at: new Date().toISOString(),
                  sender_name: displayName,
                  sender_tag: userId,
                  ...q.payload
                };
              }
            });
          setMessages([...localItems.reverse(), ...fetchedFromApi]);
        } else {
          setMessages(fetchedFromApi);
        }
      } catch (e) {
        setMessages(fetchedFromApi);
      }
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, isLoggedIn]);

  const queueAction = async (endpoint: string, payload: any) => {
    try {
      const existing = await AsyncStorage.getItem('offline_queue');
      const queue = existing ? JSON.parse(existing) : [];
      queue.push({ endpoint, payload });
      await AsyncStorage.setItem('offline_queue', JSON.stringify(queue));
      Alert.alert("Saved Locally", "Task saved securely in local storage.");
    } catch (e) {
      console.error(e);
    }
  };

  const handleSend = async () => {
    if (activeTab === 'private') return;
    
    // Quick validation before fetching GPS
    if (activeTab === 'food' && !situationText) return;
    if (activeTab !== 'food' && !messageText && !imageUri) return;

    try {
      setLoading(true);

      // 1. Determine GPS Location
      let sendLat = 13.0827;
      let sendLon = 80.2707;
      let sendName = 'Unknown Location';

      if (selectedLocation) {
        sendLat = selectedLocation.lat;
        sendLon = selectedLocation.lon;
        sendName = selectedLocation.name;
      } else {
        try {
          let { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            sendLat = loc.coords.latitude;
            sendLon = loc.coords.longitude;
            sendName = 'My Live Location';
            try {
              let geo = await Location.reverseGeocodeAsync({ latitude: sendLat, longitude: sendLon });
              if (geo.length > 0) sendName = [geo[0].name, geo[0].street, geo[0].city].filter(Boolean).join(', ') || sendName;
            } catch (e) {}
          }
        } catch (e) {
          console.warn("Location fetch failed", e);
        }
      }

      // 2. Dispatch the correct Payload
      if (activeTab === 'food') {
        const payload = {
          num_people: foodPeopleCount, 
          food_type: 'any',
          urgency: foodUrgency.toLowerCase(),
          description: situationText,
          latitude: sendLat,
          longitude: sendLon,
          location_name: sendName,
          image_url: imageUri || null,
        };

        if (isLoggedIn) {
          try { await apiCall('/food/', 'POST', payload); } catch(e) { await queueAction('/food/', payload); }
        } else {
          await queueAction('/food/', payload);
        }
        
        setSituationText('');
        setSelectedLocation(null);
        setImageUri(null);
        fetchData();
        navigation.navigate('SendMessage');

      } else {
        let finalContent = messageText;
        if (sendName !== 'Unknown Location') {
            finalContent += `\n📍 Loc: ${sendName}`;
        }

        const payload = {
          content: finalContent || '[Photo Attached]',
          message_type: activeTab,
          is_broadcast: activeTab === 'public',
          image_url: imageUri || null,
        };

        if (isLoggedIn) {
          try { await apiCall('/messages/', 'POST', payload); } catch(e) { await queueAction('/messages/', payload); }
        } else {
           await queueAction('/messages/', payload);
           setMessageText('');
           setSelectedLocation(null);
           setImageUri(null);
        }
        fetchData();
        if (activeTab === 'public') navigation.navigate('SendMessage');
      }
    } catch (err: any) {
      Alert.alert("Error sending", err.message);
    }
  };

  const handleDeleteItem = (id: string, type: 'food' | 'messages') => {
    Alert.alert("Delete Post", "Are you sure you want to delete this?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          if (id.startsWith('local-')) {
             setMessages(prev => prev.filter(m => m.id !== id));
          } else if (isLoggedIn) {
             try {
                await apiCall(`/${type}/${id}`, 'DELETE');
                setMessages(prev => prev.filter(m => m.id !== id));
             } catch(e: any) {
                Alert.alert("Error", "Could not delete: " + e.message);
             }
          } else {
             Alert.alert("Error", "You must be online to delete published posts.");
          }
      }}
    ]);
  };

  // Contact Handlers
  const handleAddContact = async () => {
    if (!newName.trim() || !newUserTag.trim()) {
      Alert.alert('Error', 'Please enter both Name and User ID');
      return;
    }

    const newContact: Contact = {
      id: 'local-' + Date.now(),
      name: newName.trim(),
      user_tag: newUserTag.trim().toUpperCase(),
      is_local: true,
    };

    try {
      const stored = await AsyncStorage.getItem(LOCAL_CONTACTS_KEY);
      const existing = stored ? JSON.parse(stored) : [];
      existing.push(newContact);
      await AsyncStorage.setItem(LOCAL_CONTACTS_KEY, JSON.stringify(existing));
    } catch (e) {
      console.error(e);
    }

    if (isLoggedIn) {
      try {
        await apiCall('/contacts/', 'POST', {
          name: newContact.name,
          user_tag: newContact.user_tag,
        });
      } catch (e) {}
    }

    setNewName('');
    setNewUserTag('');
    setShowAddModal(false);
    loadContacts();
  };

  const handleDeleteContact = async (contact: Contact) => {
    if (contact.is_emergency || !contact.is_local) return;

    Alert.alert('Delete Contact', `Remove ${contact.name} (${contact.user_tag})?`, [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const stored = await AsyncStorage.getItem(LOCAL_CONTACTS_KEY);
            if (stored) {
              const existing = JSON.parse(stored).filter((c: any) => c.id !== contact.id);
              await AsyncStorage.setItem(LOCAL_CONTACTS_KEY, JSON.stringify(existing));
            }
          } catch (e) {
            console.error(e);
          }
          loadContacts();
        }
      }
    ]);
  };

  const appendLocationToMessage = () => {
    // We now open the interactive Map Modal instead of raw-text pasting.
    setShowMapModal(true);
  };

  const handleTakePic = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Error', 'Camera permission strictly required.');
      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.5,
      });
      if (!res.canceled) {
        setImageUri(res.assets[0].uri);
      }
    } catch (e: any) {
      Alert.alert('Camera Error', e.message);
    }
  };

  const toggleUrgency = () => {
    const levels = ['Low', 'Medium', 'High', 'Critical'];
    const idx = levels.indexOf(foodUrgency);
    setFoodUrgency(levels[(idx + 1) % levels.length]);
  };

  const timeAgo = (dateStr: string) => {
    const utcDateStr = dateStr + (dateStr.endsWith('Z') ? '' : 'Z');
    const min = Math.round((new Date().getTime() - new Date(utcDateStr).getTime()) / 60000);
    if (min < 1) return 'Just now';
    if (min < 60) return `${min} mins ago`;
    return `${Math.round(min/60)} hrs ago`;
  };

  const renderTopBar = () => (
    <>
      {activeTab !== 'private' && (
        <View style={styles.composeBar}>
          <TextInput
            placeholder={activeTab === 'public' ? 'Broadcast an update...' : 'Write your message here...'}
            placeholderTextColor={COLORS.textMuted}
            value={activeTab === 'food' ? situationText : messageText}
            onChangeText={activeTab === 'food' ? setSituationText : setMessageText}
            style={styles.composeInput}
          />
        </View>
      )}

      {/* Tab row */}
      <View style={styles.tabRow}>
        {(['public', 'private', 'food'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
              {tab === 'public' ? 'Public' : tab === 'private' ? 'Private' : 'Food Request'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Action row (only visible when not private) */}
      {activeTab !== 'private' && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={appendLocationToMessage}
            style={[styles.actionIconBtn, { overflow: 'hidden' }, selectedLocation && { backgroundColor: 'rgba(0,180,216,0.15)' }]}
            activeOpacity={0.7}
          >
            <MapPin size={18} color={selectedLocation ? COLORS.primary : COLORS.textSecondary} />
            {selectedLocation && (
                <View style={{position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: 'transparent'}} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSend}
            style={styles.sendBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.sendBtnText}>Send Request</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {renderTopBar()}

          {loading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />}

          {/* Public Tab */}
          {activeTab === 'public' && !loading && (
            <View style={styles.listCard}>
              {messages.map((item, idx) => (
                <View key={item.id} style={[styles.listItem, idx === 0 && styles.listItemFirst, idx !== messages.length - 1 && styles.listItemBorder]}>
                  {/* Public: Show profile image conditionally */}
                  {isLoggedIn ? (
                    item.sender_name?.includes('Admin') || item.sender_name?.includes('City') ? (
                      <View style={styles.radioAvatar}>
                        <Radio size={20} color={COLORS.surfaceDeep} />
                      </View>
                    ) : (
                      <View style={styles.radioAvatar}>
                         {item.sender_tag === userId && localAvatar ? (
                           <Image source={{ uri: localAvatar }} style={styles.avatar} />
                         ) : (
                           <User size={20} color={COLORS.surfaceDeep} />
                         )}
                      </View>
                    )
                  ) : null}
                  
                  <View style={styles.listItemContent}>
                    <View style={styles.listItemHeader}>
                      <Text style={[styles.senderName, { color: item.sender_name?.includes('Admin') ? COLORS.primary : COLORS.safe }]}>
                        {item.sender_name || 'System'} {item.sender_tag ? `(${item.sender_tag})` : ''}
                      </Text>
                      <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                        {item.sender_name?.includes('Admin') && <Shield size={14} color={COLORS.primary} />}
                        {item.sender_tag === userId && (
                           <TouchableOpacity onPress={() => handleDeleteItem(item.id, 'messages')} activeOpacity={0.7} hitSlop={8}>
                              <Trash2 size={16} color={COLORS.danger} />
                           </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    <Text style={styles.msgPreview}>{item.content}</Text>
                    <Text style={styles.msgTime}>{timeAgo(item.created_at)}</Text>
                  </View>
                </View>
              ))}
              {messages.length === 0 && <Text style={{padding: 20, textAlign: 'center', color: COLORS.textMuted}}>No public messages yet.</Text>}
            </View>
          )}

          {/* Private Tab -> Now Contacts Screen */}
          {activeTab === 'private' && !loading && (
            <View style={{ gap: 16, marginTop: 4 }}>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => setShowAddModal(true)}
                activeOpacity={0.8}
              >
                <UserPlus size={18} color={COLORS.primary} />
                <Text style={styles.addBtnText}>Add Contact</Text>
              </TouchableOpacity>

              <View style={styles.myIdCard}>
                <Text style={styles.myIdLabel}>Your User ID (share this)</Text>
                <Text style={styles.myIdValue}>{userId}</Text>
              </View>

              {contacts.length > 0 && (
                <View style={styles.listCard}>
                  {contacts.map((contact, idx) => (
                    <TouchableOpacity
                      key={contact.id}
                      style={[styles.contactItem, idx !== contacts.length - 1 && styles.contactItemBorder]}
                      onPress={() => navigation.navigate('ChatView', { contact: contact.name, userTag: contact.user_tag })}
                      onLongPress={() => handleDeleteContact(contact)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.contactAvatar, contact.is_emergency && { borderColor: COLORS.danger }]}>
                        {contact.is_emergency ? (
                          <Phone size={16} color={COLORS.danger} />
                        ) : (
                          <User size={16} color={COLORS.primary} />
                        )}
                      </View>
                      <View style={styles.contactInfo}>
                        <Text style={styles.contactName}>{contact.name}</Text>
                        <Text style={styles.contactTag}>{contact.user_tag}</Text>
                      </View>
                      {contact.is_local && !contact.is_emergency && (
                        <TouchableOpacity onPress={() => handleDeleteContact(contact)}>
                          <Trash2 size={14} color={COLORS.textMuted} />
                        </TouchableOpacity>
                      )}
                      {contact.is_emergency && (
                        <View style={styles.emergencyBadge}>
                          <Text style={styles.emergencyText}>Emergency</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Food Request Tab */}
          {activeTab === 'food' && !loading && (
            <View style={{ marginTop: 4 }}>
              {/* Options */}
              <View style={styles.optionsCard}>
                <TouchableOpacity onPress={toggleUrgency} style={styles.optionRow} activeOpacity={0.7}>
                  <Text style={styles.optionLabel}>Urgency Level</Text>
                  <View style={styles.optionValue}>
                    <Text style={[styles.optionValueText, foodUrgency === 'Critical' && { color: COLORS.danger }]}>{foodUrgency}</Text>
                    <ChevronDown size={16} color={COLORS.textMuted} />
                  </View>
                </TouchableOpacity>

                <View style={[styles.optionRow, { borderTopWidth: 1, borderTopColor: COLORS.border }]}>
                  <Text style={styles.optionLabel}>Number of People</Text>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                    <TouchableOpacity onPress={() => setFoodPeopleCount(Math.max(1, foodPeopleCount - 1))} style={{padding: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6}}>
                      <Text style={{color: COLORS.textPrimary, fontWeight: '900', fontSize: 16, paddingHorizontal: 6}}>-</Text>
                    </TouchableOpacity>
                    <Text style={{color: COLORS.primary, fontWeight: '800', fontSize: 16}}>{foodPeopleCount}</Text>
                    <TouchableOpacity onPress={() => setFoodPeopleCount(foodPeopleCount + 1)} style={{padding: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6}}>
                      <Text style={{color: COLORS.textPrimary, fontWeight: '900', fontSize: 16, paddingHorizontal: 4}}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity onPress={() => setShowMapModal(true)} style={[styles.optionRow, { borderTopWidth: 1, borderTopColor: COLORS.border }]} activeOpacity={0.7}>
                  <Text style={styles.optionLabel}>Location</Text>
                  <View style={styles.optionValue}>
                    <Text style={[styles.optionValueText, selectedLocation && { color: COLORS.primary }]} numberOfLines={1}>
                        {selectedLocation ? selectedLocation.name : 'Select on map'}
                    </Text>
                    <ChevronRight size={16} color={COLORS.textMuted} />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Display existing requests below */}
              {messages.length > 0 && (
                <View style={[styles.listCard, { marginTop: 10 }]}>
                    {messages.map((req, idx) => (
                      <View key={req.id} style={[styles.listItem, idx !== messages.length - 1 && styles.listItemBorder]}>
                          <View style={styles.listItemContent}>
                            <View style={styles.listItemHeader}>
                              <Text style={[styles.senderName, {color: COLORS.primary}]}>Request for {req.num_people} people</Text>
                              <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                                <Text style={{color: COLORS.danger, fontSize: 12, fontWeight: '700'}}>{req.urgency?.toUpperCase() || 'HIGH'}</Text>
                                {(req.user_tag === userId || req.user_id === userId) && (
                                  <TouchableOpacity onPress={() => handleDeleteItem(req.id, 'food')} activeOpacity={0.7} hitSlop={8}>
                                    <Trash2 size={16} color={COLORS.danger} />
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                            <Text style={styles.msgPreview}>{req.description || 'No description provided.'}</Text>
                            {req.image_url && (
                                <Image source={{uri: req.image_url}} style={{width: '100%', height: 180, borderRadius: 12, marginTop: 10, marginBottom: 4}} resizeMode="cover" />
                            )}
                            <Text style={styles.msgTime}>{req.location_name || 'Unknown location'} • {timeAgo(req.created_at)}</Text>
                          </View>
                      </View>
                    ))}
                </View>
              )}
              {messages.length === 0 && <Text style={{padding: 20, textAlign: 'center', color: COLORS.textMuted}}>No active food requests.</Text>}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Add Contact Modal */}
      <Modal visible={showAddModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Contact</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <X size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <TextInput
              placeholder="Contact Name (e.g. Raja)"
              placeholderTextColor={COLORS.textMuted}
              value={newName}
              onChangeText={setNewName}
              style={styles.modalInput}
            />
            <TextInput
              placeholder="User ID (e.g. U_8F3K92X)"
              placeholderTextColor={COLORS.textMuted}
              value={newUserTag}
              onChangeText={setNewUserTag}
              autoCapitalize="characters"
              style={styles.modalInput}
            />

            <TouchableOpacity style={styles.modalSaveBtn} onPress={handleAddContact} activeOpacity={0.85}>
              <Text style={styles.modalSaveBtnText}>Save Contact</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Map Interactive Modal */}
      <Modal visible={showMapModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: COLORS.surfaceDeep }}>
          <View style={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border }}>
            <Text style={{ color: COLORS.textPrimary, fontSize: 18, fontWeight: '800' }}>Attach Map Pin</Text>
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
            {/* Decoupled Center Needle Overlay */}
            <View pointerEvents="none" style={{ position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -36, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
               <MapPin size={36} color={COLORS.danger} strokeWidth={2.5} />
               <View style={{position: 'absolute', bottom: -1, width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.6)'}} />
            </View>
            <View style={{ position: 'absolute', bottom: 20, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Drag map to move pin</Text>
            </View>
          </View>

          <View style={{ padding: 20, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 12, paddingBottom: 40 }}>
            <TouchableOpacity
              style={styles.modalPrimaryBtn}
              onPress={async () => {
                let name = 'Selected Area';
                try {
                  let geo = await Location.reverseGeocodeAsync({ latitude: mapRegion.latitude, longitude: mapRegion.longitude });
                  if (geo.length > 0) name = [geo[0].name, geo[0].street, geo[0].city].filter(Boolean).join(', ') || name;
                } catch (e) {}
                setSelectedLocation({ lat: mapRegion.latitude, lon: mapRegion.longitude, name });
                setShowMapModal(false);
              }}
              activeOpacity={0.8}
            >
              <MapPin size={18} color={COLORS.surfaceDeep} />
              <Text style={styles.modalPrimaryBtnText}>Attach this Area</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSecondaryBtn}
              onPress={async () => {
                try {
                  let { status } = await Location.requestForegroundPermissionsAsync();
                  if (status !== 'granted') {
                    Alert.alert('Permission Error', 'Please enable location permissions.');
                    return;
                  }
                  
                  // Use instantaneous cache first to prevent UI freezing
                  let loc = await Location.getLastKnownPositionAsync({});
                  if (!loc) {
                    loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
                  }
                  
                  let name = 'My Live Location';
                  try {
                    let geo = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
                    if (geo.length > 0) name = [geo[0].name, geo[0].street, geo[0].city].filter(Boolean).join(', ') || name;
                  } catch (e) {}
                  
                  setSelectedLocation({ lat: loc.coords.latitude, lon: loc.coords.longitude, name });
                  setShowMapModal(false);
                } catch (e: any) {
                  Alert.alert('Location Error', 'Failed to acquire fast GPS lock.');
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.modalSecondaryBtnText}>Use My Default Location</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  container: { padding: 20, gap: 16 },
  composeBar: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  composeInput: {
    color: COLORS.textPrimary,
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: COLORS.textPrimary,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabBtnTextActive: {
    color: COLORS.surfaceDeep,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIconBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,31,45,0.4)',
  },
  sendBtn: {
    flex: 2,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  sendBtnText: {
    color: COLORS.surfaceDeep,
    fontWeight: '700',
    fontSize: 14,
  },
  listCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  listItemFirst: {},
  listItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  radioAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    flexShrink: 0,
  },
  listItemContent: {
    flex: 1,
    gap: 4,
  },
  listItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  senderName: {
    fontWeight: '700',
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  msgRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 8,
  },
  msgPreview: {
    fontSize: 13,
    color: COLORS.textPrimary,
    flex: 1,
  },
  msgTime: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  // Food request
  autoDetectTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  autoDetectLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  autoDetectLabel: { fontWeight: '600', fontSize: 14, color: COLORS.textPrimary },
  autoDetectRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  autoDetectValue: { fontSize: 11, color: COLORS.textMuted },
  spinner: {
    width: 16, height: 16, borderRadius: 8,
    borderWidth: 2, borderColor: COLORS.primary,
    borderTopColor: 'transparent',
  },
  textAreaBox: {
    backgroundColor: COLORS.surface,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    marginBottom: 16,
  },
  situationInput: {
    color: COLORS.textPrimary,
    fontSize: 14,
    padding: 16,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  optionsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    opacity: 0.8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  optionLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  optionValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  optionValueText: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  
  // Contacts specific styles
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderPrimary,
    paddingVertical: 14,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  myIdCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  myIdLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
  myIdValue: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 2,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  contactItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceDeep,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.borderPrimary,
  },
  contactInfo: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  contactTag: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  emergencyBadge: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  emergencyText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.danger,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  modalInput: {
    backgroundColor: COLORS.surfaceDeep,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  modalSaveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalSaveBtnText: {
    color: COLORS.surfaceDeep,
    fontWeight: '700',
    fontSize: 14,
  },
  modalPrimaryBtn: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  modalPrimaryBtnText: {
    color: COLORS.surfaceDeep,
    fontSize: 14,
    fontWeight: '800',
  },
  modalSecondaryBtn: {
    backgroundColor: COLORS.surfaceDeep,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  modalSecondaryBtnText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});
