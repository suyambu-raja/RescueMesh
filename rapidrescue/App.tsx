import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { View, StyleSheet, StatusBar, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MessageSquare, Map as MapIcon, Tent, Bot, Shield, Home } from 'lucide-react-native';

import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiCall } from './api';

import { AppProvider } from './store/appStore';
import { COLORS } from './constants/theme';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Screens
import HomeScreen from './screens/HomeScreen';
import LoginScreen from './screens/LoginScreen';
import MessagesScreen from './screens/MessagesScreen';
import SheltersScreen from './screens/SheltersScreen';
import AssistantScreen from './screens/AssistantScreen';
import ZonesScreen from './screens/ZonesScreen';
import PrecautionsScreen from './screens/PrecautionsScreen';
import SettingsScreen from './screens/SettingsScreen';
import ChatViewScreen from './screens/ChatViewScreen';
import LocationShareScreen from './screens/LocationShareScreen';
import SendMessageScreen from './screens/SendMessageScreen';
import DangerZonesScreen from './screens/DangerZonesScreen';
import MapViewScreen from './screens/MapViewScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Header hidden options
const noHeader = { headerShown: false };

// Common screen options
const screenOptions = {
  headerStyle: { backgroundColor: COLORS.surfaceDeep },
  headerTintColor: COLORS.textPrimary,
  headerTitleStyle: { fontWeight: '600' as const, fontSize: 17 },
  headerBackTitleVisible: false,
  cardStyle: { backgroundColor: COLORS.background },
};

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Home" component={HomeScreen} options={noHeader} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Authentication' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="SendMessage" component={SendMessageScreen} options={{ title: 'Message Status' }} />
      <Stack.Screen name="MapView" component={MapViewScreen} options={noHeader} />
    </Stack.Navigator>
  );
}

function MessagesStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Messages' }} />
      <Stack.Screen name="ChatView" component={ChatViewScreen} options={noHeader} />
      <Stack.Screen name="LocationShare" component={LocationShareScreen} options={{ title: 'Share Location' }} />
      <Stack.Screen name="SendMessage" component={SendMessageScreen} options={{ title: 'Message Status' }} />
      <Stack.Screen name="MapView" component={MapViewScreen} options={noHeader} />
    </Stack.Navigator>
  );
}

function ZonesStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ZonesMain" component={ZonesScreen} options={{ title: 'Zones' }} />
      <Stack.Screen name="DangerZones" component={DangerZonesScreen} options={{ title: 'Danger Zones' }} />
      <Stack.Screen name="SendMessage" component={SendMessageScreen} options={{ title: 'Message Status' }} />
    </Stack.Navigator>
  );
}

function SheltersStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="SheltersMain" component={SheltersScreen} options={{ title: 'Shelters' }} />
      <Stack.Screen name="MapView" component={MapViewScreen} options={noHeader} />
    </Stack.Navigator>
  );
}

function AssistantStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="AssistantMain" component={AssistantScreen} options={{ title: 'Assistant' }} />
      <Stack.Screen name="MapView" component={MapViewScreen} options={noHeader} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: 'rgba(240,249,255,0.45)',
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, size }) => {
          const iconSize = 22;
          switch (route.name) {
            case 'MessagesTab':
              return <MessageSquare size={iconSize} color={color} />;
            case 'ZonesTab':
              return <MapIcon size={iconSize} color={color} />;
            case 'HomeTab':
              return <Home size={iconSize} color={color} />;
            case 'SheltersTab':
              return <Tent size={iconSize} color={color} />;
            case 'AssistantTab':
              return <Bot size={iconSize} color={color} />;
            case 'PrecautionsTab':
              return <Shield size={iconSize} color={color} />;
            default:
              return null;
          }
        },
      })}
    >
      <Tab.Screen
        name="MessagesTab"
        component={MessagesStack}
        options={{ title: 'Messages' }}
      />
      <Tab.Screen
        name="ZonesTab"
        component={ZonesStack}
        options={{ title: 'Zones' }}
      />
      <Tab.Screen
        name="HomeTab"
        component={HomeStack}
        options={{ title: 'Home', tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="SheltersTab"
        component={SheltersStack}
        options={{ title: 'Shelters' }}
      />
      <Tab.Screen
        name="AssistantTab"
        component={AssistantStack}
        options={{ title: 'Assistant' }}
      />
      <Tab.Screen
        name="PrecautionsTab"
        component={PrecautionsScreen}
        options={{ title: 'Precautions', headerShown: true, headerStyle: { backgroundColor: COLORS.surfaceDeep }, headerTintColor: COLORS.textPrimary }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    Notifications.requestPermissionsAsync();

    const interval = setInterval(async () => {
      try {
        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!loc) return;

        const res = await apiCall('/zones/');
        if (res.status === 'success') {
          const stored = await AsyncStorage.getItem('notified_zones');
          const notified = stored ? JSON.parse(stored) : [];
          let updated = [...notified];

          for (const zone of res.data) {
            if (updated.includes(zone.id)) continue;
            const dist = calculateDistance(loc.coords.latitude, loc.coords.longitude, zone.latitude, zone.longitude);
            if (dist <= 5) { // 5km radius
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: `⚠️ Danger Zone Nearby!`,
                  body: `${zone.title} reported just ${dist.toFixed(1)}km away. Avoid this area!`,
                  sound: true,
                },
                trigger: null, // immediate
              });
              updated.push(zone.id);
            }
          }
          await AsyncStorage.setItem('notified_zones', JSON.stringify(updated));
        }
      } catch (e) {}
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <AppProvider>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.surfaceDeep} />
      <NavigationContainer>
        <MainTabs />
      </NavigationContainer>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 85 : 65,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
});
