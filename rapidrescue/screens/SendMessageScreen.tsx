import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  SafeAreaView,
} from 'react-native';
import { CheckCircle } from 'lucide-react-native';
import { COLORS } from '../constants/theme';

interface SendMessageScreenProps {
  navigation: any;
}

export default function SendMessageScreen({ navigation }: SendMessageScreenProps) {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ping = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    ping(ring1, 0).start();
    ping(ring2, 1000).start();
  }, []);

  const pingStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.3, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }],
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Pulsing icon */}
        <View style={styles.iconWrap}>
          <Animated.View style={[styles.ring, pingStyle(ring1)]} />
          <Animated.View style={[styles.ring, pingStyle(ring2)]} />
          <View style={styles.iconCircle}>
            <CheckCircle size={48} color={COLORS.surfaceDeep} />
          </View>
        </View>

        <Text style={styles.title}>Broadcast Sent!</Text>
        <Text style={styles.subtitle}>
          Your emergency message has been broadcast to all nearby contacts and responders.
        </Text>

        <TouchableOpacity
          onPress={() => navigation.navigate('Messages')}
          style={styles.returnBtn}
          activeOpacity={0.85}
        >
          <Text style={styles.returnBtnText}>Return to Messages</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('Home')}
          style={styles.homeBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.homeBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  iconWrap: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 60,
    backgroundColor: 'rgba(0,180,216,0.25)',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  returnBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  returnBtnText: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 15 },
  homeBtn: {
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  homeBtnText: { color: COLORS.textSecondary, fontSize: 14 },
});
