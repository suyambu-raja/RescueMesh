import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { COLORS } from '../constants/theme';
import { MapPin, BatteryMedium } from 'lucide-react-native';

interface AlertCardProps {
  iconColor: string;
  icon: React.ReactNode;
  title: string;
  time: string;
  latitude?: number;
  longitude?: number;
  battery?: number;
  onPress?: () => void;
}

export const AlertCard: React.FC<AlertCardProps> = ({
  iconColor,
  icon,
  title,
  time,
  latitude,
  longitude,
  battery,
  onPress,
}) => {
  const openLocation = async () => {
    if (latitude && longitude) {
      // t=k forces satellite map view where supported
      const url = Platform.select({
        ios: `maps:0,0?q=${latitude},${longitude}&t=k`,
        android: `geo:0,0?q=${latitude},${longitude}&z=19`, // Android intents often prefer `geo:`
      });
      
      const fallbackUrl = `https://maps.google.com/?q=${latitude},${longitude}&t=k`;
      
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
    }
  };

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.75} style={styles.card}>
      <View style={styles.mainRow}>
        <View style={styles.left}>
          <View style={[styles.iconBg, { backgroundColor: iconColor }]}>
            {icon}
          </View>
          
          <View style={styles.contentCol}>
            <View style={styles.headerRow}>
              <Text style={styles.title} numberOfLines={3}>{title}</Text>
            </View>

            <View style={styles.detailsCol}>
              {(latitude !== undefined && longitude !== undefined) && (
                <TouchableOpacity onPress={openLocation} activeOpacity={0.7} style={styles.infoRow}>
                  <MapPin size={12} color={COLORS.primary} />
                  <Text style={styles.linkText}>View Satellite Map</Text>
                </TouchableOpacity>
              )}

              {battery !== undefined && (
                <View style={styles.infoRow}>
                  <BatteryMedium size={12} color={battery > 20 ? COLORS.safe : COLORS.danger} />
                  <Text style={styles.infoText}>Battery: {battery}%</Text>
                </View>
              )}
            </View>
          </View>

        </View>
      </View>
      <View style={styles.timeWrap}>
        <Text style={styles.time}>{time}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },
  mainRow: {
    flexDirection: 'row',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  iconBg: {
    borderRadius: 50,
    padding: 10,
    marginTop: 2,
  },
  contentCol: {
    flex: 1,
    gap: 8,
  },
  headerRow: {
    paddingRight: 50, // leaves space for time badge in top right
  },
  title: {
    fontWeight: '700',
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  detailsCol: {
    gap: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  infoText: {
    fontWeight: '600',
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  linkText: {
    fontWeight: '700',
    fontSize: 11,
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  timeWrap: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  time: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
});
