import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
} from 'react-native';
import { Shield, Droplets, Activity, Briefcase } from 'lucide-react-native';
import { COLORS, ASSETS } from '../constants/theme';

interface PrecautionsScreenProps {
  navigation: any;
}

const precautions = [
  {
    title: 'Flood Safety',
    icon: <Droplets size={20} color={COLORS.primary} />,
    bg: ASSETS.BG_FLOOD,
    tips: [
      'Move to higher ground immediately',
      'Avoid walking in moving water',
      'Do not drive through flooded roads',
      'Keep emergency kit ready',
    ],
  },
  {
    title: 'Earthquake Safety',
    icon: <Activity size={20} color='#f59e0b' />,
    bg: ASSETS.BG_QUAKE,
    tips: [
      'Drop, cover and hold on',
      'Stay away from windows',
      'If outdoors, stay clear of buildings',
      'After shaking stops, check for injuries',
    ],
  },
  {
    title: 'Landslide Safety',
    icon: <Shield size={20} color='#8b5cf6' />,
    bg: ASSETS.BG_LANDSLIDE,
    tips: [
      'Evacuate if warned by authorities',
      'Listen for unusual sounds',
      'Watch for tilted trees or fences',
      'Move away from the slide path',
    ],
  },
  {
    title: 'Emergency Kit',
    icon: <Briefcase size={20} color={COLORS.safe} />,
    bg: ASSETS.BG_KIT,
    tips: [
      'Water — 1 gallon per person per day',
      'Non-perishable food for 3 days',
      'Battery-powered or hand-crank radio',
      'First aid kit and medications',
    ],
  },
];

export default function PrecautionsScreen({ navigation }: PrecautionsScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {precautions.map((item) => (
          <View key={item.title} style={styles.card}>
            {/* Card header with image */}
            <View style={styles.cardHeader}>
              <Image source={typeof item.bg === 'string' ? { uri: item.bg } : item.bg} style={styles.cardBg} resizeMode="cover" />
              <View style={styles.cardHeaderOverlay} />
              <View style={styles.cardHeaderContent}>
                <View style={styles.iconBg}>{item.icon}</View>
                <Text style={styles.cardTitle}>{item.title}</Text>
              </View>
            </View>

            {/* Tips */}
            <View style={styles.tipsContainer}>
              {item.tips.map((tip, idx) => (
                <View key={idx} style={styles.tipRow}>
                  <View style={styles.tipDot} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  container: { padding: 20, gap: 16, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  cardHeader: {
    height: 90,
    position: 'relative',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardBg: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  cardHeaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,26,36,0.5)',
  },
  cardHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  iconBg: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  tipsContainer: {
    padding: 16,
    gap: 12,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginTop: 7,
    flexShrink: 0,
  },
  tipText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    flex: 1,
  },
});
