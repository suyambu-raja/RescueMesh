import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Lock, User, Phone, Send, Bot } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { apiCall } from '../api';
import { useAppStore } from '../store/appStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ChatViewScreenProps {
  navigation: any;
  route: any;
}

const OFFICIAL_CONTACTS = ['City Control Room', 'Nearest Hospital'];

export default function ChatViewScreen({ navigation, route }: ChatViewScreenProps) {
  const { isLoggedIn, userId, displayName } = useAppStore();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const contact = route?.params?.contact || 'Unknown';
  const contactTag = route?.params?.userTag || '';
  const isOfficial = OFFICIAL_CONTACTS.includes(contact);
  const isAssistant = contact === 'Assistant';

  const fetchHistory = async () => {
    setLoading(true);
    let fetchedFromApi: any[] = [];
    try {
      if (isAssistant) {
        const res = await apiCall('/chat/history');
        if (res.status === 'success') {
          fetchedFromApi = res.data;
        }
      } else {
        const res = await apiCall('/messages/?message_type=private');
        if (res.status === 'success') {
          const filtered = res.data.filter((m: any) => m.sender_name === contact || m.content.includes(contact));
          fetchedFromApi = filtered.map((m: any) => ({
            id: m.id,
            role: m.sender_name === contact ? 'assistant' : 'user',
            content: m.content,
            created_at: m.created_at
          }));
        }
      }
    } catch (err: any) {
      console.warn("Error fetching chat history", err.message);
    } finally {
      if (!isAssistant) {
        try {
          const existing = await AsyncStorage.getItem('offline_queue');
          if (existing) {
            const queue = JSON.parse(existing);
            const localMsgs = queue
              .filter((q: any) => q.endpoint === '/messages/' && q.payload.message_type === 'private' && (q.payload.recipient_id === contact || q.payload.content.includes(contact)))
              .map((q: any) => ({
                id: 'local-' + Math.random(),
                role: 'user',
                content: q.payload.content,
                created_at: new Date().toISOString()
              }));
            fetchedFromApi = [...fetchedFromApi, ...localMsgs];
          }
        } catch(e) {}
        
        if (fetchedFromApi.length === 0) {
          fetchedFromApi.push({ id: 'dummy', role: 'assistant', content: 'Are you currently safe? Please share your location if you need immediate assistance.' });
        }
      }
      setMessages(fetchedFromApi);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [contact, isLoggedIn]);

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

  const handleSend = async () => {
    if (!message) return;
    const optimisticMsg = { id: Date.now().toString(), role: 'user', content: message };
    setMessages((prev) => [...prev, optimisticMsg]);
    const textToSend = message;
    setMessage('');

    try {
      if (isAssistant) {
        const res = await apiCall('/chat/send', 'POST', { message: textToSend });
        if (res.status === 'success') {
          setMessages((prev) => [...prev, res.data]);
        }
      } else {
        const payload = {
          content: textToSend,
          message_type: 'private',
          is_broadcast: false,
          recipient_tag: contactTag, // Route by User ID
        };
        if (isLoggedIn) {
          try {
            await apiCall('/messages/', 'POST', payload);
          } catch(e) {
            await queueAction('/messages/', payload);
          }
        } else {
          await queueAction('/messages/', payload);
        }
      }
    } catch (err) {
      console.warn("Failed sending message", err);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.chatHeaderTitle}>{contact} {contactTag ? `(${contactTag})` : ''}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.messagesArea}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {/* E2E label */}
          <View style={styles.e2eRow}>
            <Lock size={10} color={COLORS.textMuted} />
            <Text style={styles.e2eText}> End-to-End Encrypted</Text>
          </View>
          <View style={styles.dateBadge}>
            <Text style={styles.dateBadgeText}>Today</Text>
          </View>

          {loading && <ActivityIndicator color={COLORS.primary} />}

          {messages.map((m: any, idx: number) => {
            const isUser = m.role === 'user';
            if (isUser) {
              return (
                <View key={m.id || idx} style={[styles.msgRow, styles.msgRowOut]}>
                  <View style={styles.outgoingBubble}>
                    <Text style={styles.outgoingText}>{m.content}</Text>
                  </View>
                </View>
              );
            } else {
              return (
                <View key={m.id || idx} style={styles.msgRow}>
                  <View style={styles.msgAvatar}>
                    {isAssistant ? <Bot size={14} color={COLORS.primary} /> : (isOfficial ? <Phone size={14} color={COLORS.safe} /> : <User size={14} color={COLORS.primary} />)}
                  </View>
                  <View style={styles.incomingBubble}>
                    <Text style={styles.incomingText}>{m.content}</Text>
                  </View>
                </View>
              );
            }
          })}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputBar}>
          <TextInput
            placeholder="Type a message..."
            placeholderTextColor={COLORS.textMuted}
            value={message}
            onChangeText={setMessage}
            style={styles.textInput}
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity onPress={handleSend} style={styles.sendBtn} activeOpacity={0.85}>
            <Send size={18} color={COLORS.surfaceDeep} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceDeep,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  backArrow: { color: COLORS.textPrimary, fontSize: 20 },
  chatHeaderTitle: { fontSize: 17, fontWeight: '600', color: COLORS.textPrimary },
  messagesArea: { flex: 1, backgroundColor: COLORS.background },
  messagesContent: { padding: 20, gap: 16, paddingBottom: 16 },
  e2eRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  e2eText: { fontSize: 11, color: COLORS.textMuted },
  dateBadge: {
    alignSelf: 'center',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 50,
    marginBottom: 8,
  },
  dateBadgeText: { fontSize: 10, color: COLORS.textMuted },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  msgRowOut: { justifyContent: 'flex-end' },
  msgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    flexShrink: 0,
  },
  incomingBubble: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderTopLeftRadius: 4,
    maxWidth: '80%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  incomingText: { color: COLORS.textPrimary, fontSize: 14, lineHeight: 20 },
  outgoingBubble: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderTopRightRadius: 4,
    maxWidth: '80%',
  },
  outgoingText: { color: COLORS.surfaceDeep, fontSize: 14, fontWeight: '500', lineHeight: 20 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: COLORS.surfaceDeep,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.surface,
    color: COLORS.textPrimary,
    fontSize: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
