import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getOrCreateIdentity, setDisplayName as persistDisplayName } from '../services/identity';
import { checkNetworkMode, NetworkMode } from '../services/network';

interface Settings {
  notifications: boolean;
  sosAlerts: boolean;
  offlineMode: boolean;
  pinLock: boolean;
  gps: boolean;
  autoShareLoc: boolean;
  voiceSOS: boolean;
  darkMode: boolean;
  shakeSOS: boolean;
}

interface AppState {
  // Identity
  userId: string;
  setUserIdState: (v: string) => void;
  displayName: string;
  setDisplayNameState: (v: string) => void;

  // Auth
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
  fullName: string;
  setFullName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;

  // Network
  currentLang: string;
  setCurrentLang: (v: string) => void;
  isOnline: boolean;
  setIsOnline: (v: boolean) => void;
  networkMode: NetworkMode;

  // Settings
  settings: Settings;
  toggleSetting: (key: keyof Settings) => void;

  // Contacts / Messaging
  selectedContact: string;
  setSelectedContact: (v: string) => void;
}

const AppContext = createContext<AppState | null>(null);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  // Identity — generated locally on first launch
  const [userId, setUserId] = useState('U_0000000');
  const [displayName, setDisplayName] = useState('Rescuer');

  // Auth
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  // Network
  const [currentLang, setCurrentLang] = useState('EN');
  const [isOnline, setIsOnline] = useState(true);
  const [networkMode, setNetworkMode] = useState<NetworkMode>('online');

  // Contacts / Messaging
  const [selectedContact, setSelectedContact] = useState('');

  // Settings
  const [settings, setSettings] = useState<Settings>({
    notifications: true,
    sosAlerts: true,
    offlineMode: false,
    pinLock: false,
    gps: true,
    autoShareLoc: true,
    voiceSOS: false,
    darkMode: true,
    shakeSOS: true,
  });

  // Initialize identity on first render
  useEffect(() => {
    (async () => {
      const identity = await getOrCreateIdentity();
      setUserId(identity.userId);
      setDisplayName(identity.displayName);
    })();
  }, []);

  // Periodically check network mode
  useEffect(() => {
    const check = async () => {
      const mode = await checkNetworkMode();
      setNetworkMode(mode);
      setIsOnline(mode === 'online');
    };
    check();
    const interval = setInterval(check, 15000); // Check every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const toggleSetting = (key: keyof Settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const setDisplayNameState = async (name: string) => {
    setDisplayName(name);
    await persistDisplayName(name);
  };

  const setUserIdState = async (id: string) => {
    setUserId(id);
    // Persist if needed (already managed by AsyncStorage elsewhere or we can add it here)
  };

  return (
    <AppContext.Provider value={{
      userId, setUserIdState, displayName, setDisplayNameState,
      isLoggedIn, setIsLoggedIn,
      fullName, setFullName,
      email, setEmail,
      currentLang, setCurrentLang,
      isOnline, setIsOnline,
      networkMode,
      settings, toggleSetting,
      selectedContact, setSelectedContact,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppProvider');
  return ctx;
};
