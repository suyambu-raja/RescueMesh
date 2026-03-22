import React from 'react';
import { TouchableOpacity, View, StyleSheet, Animated } from 'react-native';
import { useRef, useEffect } from 'react';
import { COLORS } from '../constants/theme';

interface ToggleSwitchProps {
  enabled: boolean;
  onToggle: () => void;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ enabled, onToggle }) => {
  const translateX = useRef(new Animated.Value(enabled ? 20 : 0)).current;
  const bgColor = useRef(new Animated.Value(enabled ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: enabled ? 20 : 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(bgColor, {
        toValue: enabled ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start();
  }, [enabled]);

  const backgroundColor = bgColor.interpolate({
    inputRange: [0, 1],
    outputRange: [COLORS.background, COLORS.primary],
  });

  return (
    <TouchableOpacity onPress={onToggle} activeOpacity={0.8}>
      <Animated.View style={[styles.track, { backgroundColor }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  track: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
  },
  thumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
});
