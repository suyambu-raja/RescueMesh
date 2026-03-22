import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  Animated,
  Vibration,
  Linking,
} from 'react-native';
import {
  Bot,
  Tent,
  Route,
  ShieldPlus,
  Zap,
  WifiOff,
  Wifi,
  Send,
  Phone,
  ChevronRight,
} from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { apiCall } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

// ─── CONSTANTS ───────────────────────────────────────────────────────────
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const SHELTER_CACHE = 'offline_shelters';

// ─── INTENT KEYWORDS ────────────────────────────────────────────────────
const INTENT_MAP: { keywords: string[]; intent: string }[] = [
  { keywords: ['shelter', 'safe place', 'refuge', 'camp', 'evacuation', 'tent'], intent: 'shelter' },
  { keywords: ['route', 'direction', 'navigate', 'way', 'path', 'road', 'go to'], intent: 'route' },
  { keywords: ['medical', 'hospital', 'doctor', 'ambulance', 'health', 'injury', 'medicine', 'first aid', 'hurt', 'wound'], intent: 'medical' },
  { keywords: ['emergency', 'sos', 'help', 'urgent', 'danger', 'rescue'], intent: 'emergency' },
];

// ─── OFFLINE SAFETY TIPS ────────────────────────────────────────────────
const OFFLINE_TIPS: Record<string, string> = {
  flood: '🌊 Move to higher ground immediately. Avoid walking through flowing water. 15cm of fast water can knock you down. Stay away from electricity poles.',
  earthquake: '🏚️ DROP, COVER, HOLD ON. Get under sturdy furniture. Stay away from windows and heavy objects. If outdoors, move to open areas away from buildings.',
  fire: '🔥 Stay low to avoid smoke. Cover your nose with a wet cloth. Feel doors before opening. Use stairs, never elevators. Meet at your designated assembly point.',
  cyclone: '🌀 Stay indoors away from windows. Stock water and food. Secure loose objects outside. Listen to local radio for updates. Evacuate if instructed.',
  tsunami: '🌊 Move inland and to higher ground immediately. Do not wait for official warnings. Stay away from the coast until authorities declare it safe.',
  general: '⚠️ Stay calm. Conserve phone battery. Share your location with family. Keep emergency supplies handy. Follow local authority instructions.',
};

// ─── TYPES ───────────────────────────────────────────────────────────────
interface Shelter {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  total_beds?: number;
  occupied_beds?: number;
}

interface ActionResult {
  type: 'action' | 'ai' | 'info' | 'error';
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
  shelters?: Shelter[];
}

interface AssistantScreenProps {
  navigation: any;
}

// ─── HAVERSINE ───────────────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon);
  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  brng = (brng + 360) % 360;
  const dirs = ['North', 'North-East', 'East', 'South-East', 'South', 'South-West', 'West', 'North-West'];
  return dirs[Math.round(brng / 45) % 8];
}

// ─── COMPONENT ───────────────────────────────────────────────────────────
export default function AssistantScreen({ navigation }: AssistantScreenProps) {
  const [inputText, setInputText] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<ActionResult[]>([]);
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number } | null>(null);
  const [isListening, setIsListening] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  // ── Init: Acquire GPS & check connectivity ─────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLoc({ lat: loc.coords.latitude, lon: loc.coords.longitude });
        }
      } catch (_) {}

      try {
        await apiCall('/shelters/');
        setIsOffline(false);
      } catch (_) {
        setIsOffline(true);
      }
    })();

    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  // ── Pulse animation for Emergency button ───────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── INTENT DETECTION (keyword-based, fast) ─────────────────────────
  function detectIntent(text: string): string | null {
    const lower = text.toLowerCase().trim();
    for (const entry of INTENT_MAP) {
      for (const kw of entry.keywords) {
        if (lower.includes(kw)) return entry.intent;
      }
    }
    return null;
  }

  // ── FETCH SHELTERS (online or offline cache) ───────────────────────
  async function fetchShelters(): Promise<Shelter[]> {
    try {
      const res = await apiCall('/shelters/');
      if (res.status === 'success') {
        await AsyncStorage.setItem(SHELTER_CACHE, JSON.stringify(res.data));
        return res.data;
      }
    } catch (_) {}
    const cached = await AsyncStorage.getItem(SHELTER_CACHE);
    return cached ? JSON.parse(cached) : [];
  }

  // ── EXECUTE ACTION ─────────────────────────────────────────────────
  async function executeAction(intent: string) {
    setProcessing(true);
    Vibration.vibrate(50);

    try {
      switch (intent) {
        case 'shelter': {
          const shelters = await fetchShelters();
          if (shelters.length === 0) {
            addResult({
              type: 'error',
              title: '❌ No Shelters Found',
              body: 'No shelter data available. Connect to internet to sync shelter locations.',
            });
            break;
          }

          let sorted = shelters;
          if (userLoc) {
            sorted = shelters
              .map((s) => ({ ...s, _dist: haversine(userLoc.lat, userLoc.lon, s.latitude, s.longitude) }))
              .sort((a, b) => a._dist - b._dist);
          }

          const top3 = sorted.slice(0, 3);
          addResult({
            type: 'action',
            title: '🏕 Nearest Shelters Found',
            body: top3
              .map((s: any, i: number) => {
                const dist = s._dist ? `${s._dist.toFixed(1)} km` : 'N/A';
                const dir = userLoc ? bearing(userLoc.lat, userLoc.lon, s.latitude, s.longitude) : '';
                const cap = `${s.occupied_beds || 0}/${s.total_beds || '∞'}`;
                return `${i + 1}. ${s.name}\n   📍 ${dist} ${dir ? `• Head ${dir}` : ''}\n   🛏 Capacity: ${cap}`;
              })
              .join('\n\n'),
            actionLabel: 'Open Shelters Map →',
            onAction: () => navigation.navigate('SheltersTab'),
            shelters: top3,
          });
          break;
        }

        case 'route': {
          const shelters = await fetchShelters();
          if (!userLoc) {
            addResult({
              type: 'error',
              title: '📍 GPS Required',
              body: 'Enable location services to calculate a safe route to the nearest shelter.',
            });
            break;
          }

          if (shelters.length === 0) {
            addResult({
              type: 'error',
              title: '❌ No Route Data',
              body: 'No shelter data available for routing. Connect to internet to sync.',
            });
            break;
          }

          const nearest = shelters
            .map((s) => ({ ...s, _dist: haversine(userLoc.lat, userLoc.lon, s.latitude, s.longitude) }))
            .sort((a, b) => a._dist - b._dist)[0];

          const dir = bearing(userLoc.lat, userLoc.lon, nearest.latitude, nearest.longitude);

          addResult({
            type: 'action',
            title: '🧭 Safe Route Calculated',
            body: `Nearest shelter: ${nearest.name}\n📍 Distance: ${(nearest as any)._dist.toFixed(1)} km\n🧭 Direction: Head ${dir}\n\n${isOffline ? '⚠️ Offline: Using compass bearing. Connect to internet for turn-by-turn navigation.' : '✅ Online: Full Google Maps routing available on Shelters page.'}`,
            actionLabel: 'Navigate Now →',
            onAction: () => navigation.navigate('SheltersTab'),
          });
          break;
        }

        case 'medical': {
          addResult({
            type: 'action',
            title: '🏥 Medical Help',
            body: `Emergency medical assistance:\n\n📞 Ambulance: 108\n📞 Emergency: 112\n📞 Police: 100\n📞 Fire: 101\n\n${isOffline ? '⚠️ Offline: Call emergency numbers directly. No internet required for phone calls.' : '✅ Online: Searching nearby medical facilities...'}`,
            actionLabel: 'Call 108 (Ambulance) →',
            onAction: () => Linking.openURL('tel:108'),
          });
          break;
        }

        case 'emergency': {
          // FULL EMERGENCY ASSIST: auto location + nearest shelter + route
          const shelters = await fetchShelters();

          let emergencyBody = '🚨 EMERGENCY ASSIST ACTIVATED\n\n';

          if (userLoc) {
            emergencyBody += `📍 Your Location: ${userLoc.lat.toFixed(4)}, ${userLoc.lon.toFixed(4)}\n\n`;
          } else {
            emergencyBody += '⚠️ GPS not available. Enable location services.\n\n';
          }

          if (shelters.length > 0 && userLoc) {
            const nearest = shelters
              .map((s) => ({ ...s, _dist: haversine(userLoc.lat, userLoc.lon, s.latitude, s.longitude) }))
              .sort((a, b) => a._dist - b._dist)[0];
            const dir = bearing(userLoc.lat, userLoc.lon, nearest.latitude, nearest.longitude);

            emergencyBody += `🏕 Nearest Shelter: ${nearest.name}\n`;
            emergencyBody += `📏 Distance: ${(nearest as any)._dist.toFixed(1)} km\n`;
            emergencyBody += `🧭 Direction: Head ${dir}\n\n`;
          }

          emergencyBody += '📞 Emergency Numbers:\n';
          emergencyBody += '   112 (Universal Emergency)\n';
          emergencyBody += '   108 (Ambulance)\n';
          emergencyBody += '   100 (Police)\n';

          addResult({
            type: 'action',
            title: '🚨 Emergency Assist',
            body: emergencyBody,
            actionLabel: 'Call 112 Emergency →',
            onAction: () => Linking.openURL('tel:112'),
          });
          break;
        }
      }
    } catch (err) {
      addResult({
        type: 'error',
        title: '⚠️ Action Failed',
        body: 'Something went wrong. Please try again.',
      });
    }

    setProcessing(false);
  }

  // ── GROQ AI (for non-action queries) ─────────────────────────────
  async function askAI(question: string) {
    setProcessing(true);

    // Check offline safety tips first
    const lower = question.toLowerCase();
    for (const [key, tip] of Object.entries(OFFLINE_TIPS)) {
      if (lower.includes(key)) {
        addResult({
          type: 'ai',
          title: `💡 Safety Guide: ${key.charAt(0).toUpperCase() + key.slice(1)}`,
          body: tip,
        });
        setProcessing(false);
        return;
      }
    }

    if (isOffline) {
      addResult({
        type: 'ai',
        title: '💡 Safety Tip',
        body: OFFLINE_TIPS.general,
      });
      setProcessing(false);
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'You are a disaster emergency safety assistant for a rescue app. Give a brief, clear, actionable answer (max 150 words).'
            },
            {
              role: 'user',
              content: question
            }
          ]
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle non-200 HTTP status
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errMsg = errorData?.error?.message || `HTTP ${response.status}`;
        console.warn('Groq HTTP issue:', response.status, errMsg);

        if (response.status === 429) {
          addResult({
            type: 'ai',
            title: '⏳ AI Rate Limited',
            body: `The AI service is temporarily busy. Please try again in a few seconds.\n\n${OFFLINE_TIPS.general}`,
          });
        } else {
          addResult({
            type: 'ai',
            title: '⚠️ AI Temporarily Unavailable',
            body: `${errMsg}\n\n${OFFLINE_TIPS.general}`,
          });
        }
        setProcessing(false);
        return;
      }

      const data = await response.json();
      console.log('Groq raw response:', JSON.stringify(data).substring(0, 500));

      let aiText = data?.choices?.[0]?.message?.content;

      if (!aiText) {
        console.warn('Groq response had no extractable text:', JSON.stringify(data).substring(0, 300));
        aiText = OFFLINE_TIPS.general;
      }

      addResult({
        type: 'ai',
        title: '🤖 AI Safety Guide',
        body: aiText,
      });
    } catch (err: any) {
      console.warn('Groq fetch issue:', err?.message || err);
      addResult({
        type: 'ai',
        title: '💡 Safety Tip',
        body: OFFLINE_TIPS.general,
      });
    }

    setProcessing(false);
  }

  // ── HYBRID HANDLER ─────────────────────────────────────────────────
  async function handleInput(text?: string) {
    const query = (text || inputText).trim();
    if (!query) return;
    setInputText('');

    const intent = detectIntent(query);
    if (intent) {
      await executeAction(intent);
    } else {
      await askAI(query);
    }
  }

  function addResult(result: ActionResult) {
    setResults((prev) => [result, ...prev]);
    setTimeout(() => scrollRef.current?.scrollTo({ y: 0, animated: true }), 100);
  }

  // ── QUICK ACTION BUTTONS ───────────────────────────────────────────
  const quickActions = [
    {
      icon: <Tent size={22} color="#fff" />,
      label: 'Find Shelter',
      color: '#0891b2',
      onPress: () => executeAction('shelter'),
    },
    {
      icon: <Route size={22} color="#fff" />,
      label: 'Safe Route',
      color: '#059669',
      onPress: () => executeAction('route'),
    },
    {
      icon: <ShieldPlus size={22} color="#fff" />,
      label: 'Medical Help',
      color: '#7c3aed',
      onPress: () => executeAction('medical'),
    },
  ];

  // ── RENDER ─────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.mainContainer, { opacity: fadeAnim }]}>
        {/* ── NETWORK STATUS ─────────────────────────── */}
        <View style={[styles.statusBar, { backgroundColor: isOffline ? COLORS.danger : '#059669' }]}>
          {isOffline ? <WifiOff size={13} color="#fff" /> : <Wifi size={13} color="#fff" />}
          <Text style={styles.statusText}>{isOffline ? 'OFFLINE • Rule-Based Mode' : 'ONLINE • Full API + AI Active'}</Text>
        </View>

        <ScrollView ref={scrollRef} style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
          {/* ── BOT GREETING ──────────────────────────── */}
          <View style={styles.greetingSection}>
            <View style={styles.botAvatarLarge}>
              <Bot size={28} color={COLORS.surfaceDeep} />
            </View>
            <Text style={styles.greetTitle}>Emergency Command Center</Text>
            <Text style={styles.greetSub}>
              Tap an action below or type a command.{'\n'}I'll execute it instantly.
            </Text>
          </View>

          {/* ── EMERGENCY ASSIST BUTTON ────────────────── */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={styles.emergencyBtn}
              activeOpacity={0.85}
              onPress={() => {
                Vibration.vibrate([0, 100, 50, 100]);
                executeAction('emergency');
              }}
            >
              <View style={styles.emergencyInner}>
                <Zap size={24} color="#fff" />
                <View>
                  <Text style={styles.emergencyTitle}>Emergency Assist</Text>
                  <Text style={styles.emergencySub}>Auto-detect location • Find shelter • Suggest route</Text>
                </View>
              </View>
              <ChevronRight size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </Animated.View>

          {/* ── QUICK ACTION GRID ─────────────────────── */}
          <View style={styles.actionGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={[styles.actionCard, { borderColor: action.color + '40' }]}
                activeOpacity={0.8}
                onPress={action.onPress}
                disabled={processing}
              >
                <View style={[styles.actionIconWrap, { backgroundColor: action.color }]}>
                  {action.icon}
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
                <ChevronRight size={16} color={COLORS.textMuted} />
              </TouchableOpacity>
            ))}
          </View>

          {/* ── RESULTS FEED ──────────────────────────── */}
          {processing && (
            <View style={styles.processingCard}>
              <ActivityIndicator color={COLORS.primary} size="small" />
              <Text style={styles.processingText}>Executing command...</Text>
            </View>
          )}

          {results.map((result, idx) => (
            <View
              key={idx}
              style={[
                styles.resultCard,
                result.type === 'error' && styles.resultCardError,
                result.type === 'ai' && styles.resultCardAI,
              ]}
            >
              <Text style={styles.resultTitle}>{result.title}</Text>
              <Text style={styles.resultBody}>{result.body}</Text>
              {result.actionLabel && result.onAction && (
                <TouchableOpacity style={styles.resultActionBtn} onPress={result.onAction} activeOpacity={0.8}>
                  <Text style={styles.resultActionText}>{result.actionLabel}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {/* ── EMERGENCY CONTACTS STRIP ──────────────── */}
          <View style={styles.contactsStrip}>
            <Text style={styles.contactsTitle}>Quick Dial</Text>
            <View style={styles.contactsRow}>
              {[
                { num: '112', label: 'Emergency' },
                { num: '108', label: 'Ambulance' },
                { num: '100', label: 'Police' },
                { num: '101', label: 'Fire' },
              ].map((c) => (
                <TouchableOpacity
                  key={c.num}
                  style={styles.contactChip}
                  onPress={() => Linking.openURL(`tel:${c.num}`)}
                  activeOpacity={0.8}
                >
                  <Phone size={14} color={COLORS.primary} />
                  <View>
                    <Text style={styles.contactNum}>{c.num}</Text>
                    <Text style={styles.contactLabel}>{c.label}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>

        {/* ── INPUT BAR (Fixed Bottom) ────────────────── */}
        <View style={styles.inputBar}>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.textInput}
              placeholder="Type a command or question..."
              placeholderTextColor={COLORS.textMuted}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => handleInput()}
              returnKeyType="send"
              editable={!processing}
            />
          </View>
          <TouchableOpacity
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            onPress={() => handleInput()}
            activeOpacity={0.85}
            disabled={processing || !inputText.trim()}
          >
            <Send size={18} color={inputText.trim() ? '#fff' : COLORS.textMuted} />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  mainContainer: { flex: 1 },
  scroll: { flex: 1 },

  // Status bar
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },

  // Greeting
  greetingSection: { alignItems: 'center', paddingTop: 24, paddingBottom: 16, gap: 8 },
  botAvatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  greetTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, marginTop: 4 },
  greetSub: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Emergency button
  emergencyBtn: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: '#dc2626',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  emergencyInner: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  emergencyTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  emergencySub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2, fontWeight: '500' },

  // Quick actions
  actionGrid: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginTop: 20,
  },
  actionCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
  },
  actionIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { color: COLORS.textPrimary, fontSize: 12, fontWeight: '700', textAlign: 'center' },

  // Processing
  processingCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.borderPrimary,
  },
  processingText: { color: COLORS.primary, fontSize: 13, fontWeight: '600' },

  // Result cards
  resultCard: {
    marginHorizontal: 20,
    marginTop: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resultCardError: { borderColor: COLORS.danger + '60' },
  resultCardAI: { borderColor: '#7c3aed40' },
  resultTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800', marginBottom: 10 },
  resultBody: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 22, fontWeight: '500' },
  resultActionBtn: {
    marginTop: 14,
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  resultActionText: { color: COLORS.surfaceDeep, fontWeight: '700', fontSize: 14 },

  // Contacts
  contactsStrip: { marginHorizontal: 20, marginTop: 20 },
  contactsTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 10 },
  contactsRow: { flexDirection: 'row', gap: 8 },
  contactChip: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  contactNum: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '800' },
  contactLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '600' },

  // Input bar
  inputBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surfaceDeep,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  inputWrap: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textInput: {
    color: COLORS.textPrimary,
    fontSize: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: COLORS.surface },
});
