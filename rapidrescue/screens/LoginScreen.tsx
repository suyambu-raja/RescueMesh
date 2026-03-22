import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Shield, User, Mail, Key } from 'lucide-react-native';
import { COLORS } from '../constants/theme';
import { useAppStore } from '../store/appStore';
import { apiCall, setToken } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LoginScreenProps {
  navigation: any;
}

export default function LoginScreen({ navigation }: LoginScreenProps) {
  const { setIsLoggedIn, setFullName: storeSetName, setEmail: storeSetEmail, setDisplayNameState, userId, setUserIdState } = useAppStore();
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const syncOfflineData = async () => {
    try {
      const existing = await AsyncStorage.getItem('offline_queue');
      if (existing) {
        const queue = JSON.parse(existing);
        let count = 0;
        for (const item of queue) {
          try {
             await apiCall(item.endpoint, 'POST', item.payload);
             count++;
          } catch (e) {
             console.log("Failed to sync item", item);
          }
        }
        await AsyncStorage.removeItem('offline_queue');
        if (count > 0) {
          Alert.alert("Data Synced", `Successfully synced ${count} items from local storage to the server.`);
        }
      }
    } catch (e) {
      console.error("Offline sync error", e);
    }
  };

  const handleSubmit = async () => {
    if (isSignUp && !fullName) return;
    if (!email || !password) return;

    setLoading(true);
    try {
      if (isSignUp) {
        const res = await apiCall('/auth/register', 'POST', { full_name: fullName, email, password, user_tag: userId });
        if (res.status === 'success') {
          await setToken(res.data.access_token);
          storeSetName(res.data.user.full_name);
          storeSetEmail(res.data.user.email);
          // Sync user_tag from backend to local identity
          if (res.data.user.user_tag) {
            await AsyncStorage.setItem('rescue_user_id', res.data.user.user_tag);
            setUserIdState(res.data.user.user_tag);
          }
          await setDisplayNameState(res.data.user.full_name);
          setIsLoggedIn(true);
          await syncOfflineData();
          navigation.navigate('Home');
        }
      } else {
        const res = await apiCall('/auth/login', 'POST', { email, password });
        if (res.status === 'success') {
          await setToken(res.data.access_token);
          storeSetName(res.data.user.full_name);
          storeSetEmail(res.data.user.email);
          // Sync user_tag from backend to local identity
          if (res.data.user.user_tag) {
            await AsyncStorage.setItem('rescue_user_id', res.data.user.user_tag);
            setUserIdState(res.data.user.user_tag);
          }
          await setDisplayNameState(res.data.user.full_name);
          setIsLoggedIn(true);
          await syncOfflineData();
          navigation.navigate('Home');
        }
      }
    } catch (error: any) {
      Alert.alert('Authentication Failed', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = () => {
    navigation.navigate('Home');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Area */}
          <View style={styles.logoArea}>
            <View style={styles.shieldContainer}>
              <Shield size={36} color={COLORS.primary} />
            </View>
            <Text style={styles.title}>
              {isSignUp ? 'Create Account' : 'Welcome Back'}
            </Text>
            <Text style={styles.subtitle}>
              {isSignUp
                ? 'Join the RapidRescue network to stay safe and connected.'
                : 'Login to sync your data to the cloud across all your devices.'}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {isSignUp && (
              <View style={styles.inputWrapper}>
                <User
                  size={20}
                  color="rgba(0,180,216,0.6)"
                  style={styles.inputIcon}
                />
                <TextInput
                  placeholder="Full Name"
                  placeholderTextColor={COLORS.textMuted}
                  value={fullName}
                  onChangeText={setFullName}
                  style={styles.input}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={styles.inputWrapper}>
              <Mail
                size={20}
                color="rgba(0,180,216,0.6)"
                style={styles.inputIcon}
              />
              <TextInput
                placeholder="Email Address"
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={setEmail}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Key
                size={20}
                color="rgba(0,180,216,0.6)"
                style={styles.inputIcon}
              />
              <TextInput
                placeholder="Password"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                style={styles.input}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              onPress={handleSubmit}
              style={styles.submitBtn}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.surfaceDeep} />
              ) : (
                <Text style={styles.submitBtnText}>
                  {isSignUp ? 'Sign Up Securely' : 'Log In Securely'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => setIsSignUp(!isSignUp)}
            style={styles.switchBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.switchText}>
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Guest */}
          <TouchableOpacity
            onPress={handleGuest}
            style={styles.guestBtn}
            activeOpacity={0.85}
          >
            <Text style={styles.guestBtnText}>Continue as Guest</Text>
          </TouchableOpacity>

          <Text style={styles.guestNote}>
            Guest data is saved locally to your device storage.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.surfaceDeep,
  },
  container: {
    padding: 24,
    paddingBottom: 40,
    backgroundColor: COLORS.background,
    flexGrow: 1,
  },
  logoArea: {
    alignItems: 'center',
    marginVertical: 32,
  },
  shieldContainer: {
    width: 80,
    height: 80,
    backgroundColor: COLORS.surface,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  form: {
    gap: 14,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  submitBtnText: {
    color: COLORS.surfaceDeep,
    fontWeight: '700',
    fontSize: 16,
  },
  switchBtn: {
    alignItems: 'center',
    marginTop: 20,
  },
  switchText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 2,
  },
  guestBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  guestBtnText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  guestNote: {
    fontSize: 10,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 12,
  },
});
