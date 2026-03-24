import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getOrCreateIdentity, setDisplayName as persistDisplayName, registerWithCloud, retryCloudRegistration } from '../services/identity';
import { checkNetworkMode, NetworkMode } from '../services/network';
import { flushQueue, getPendingCount } from '../services/syncQueue';

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
  isCloudSynced: boolean;

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

  // Sync
  pendingSyncCount: number;

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
  const [isCloudSynced, setIsCloudSynced] = useState(false);

  // Auth
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');

  // Network
  const [currentLang, setCurrentLang] = useState('EN');
  const [isOnline, setIsOnline] = useState(true);
  const [networkMode, setNetworkMode] = useState<NetworkMode>('online');

  // Sync
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

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

  // ── Initialize identity + cloud registration on first render ──
  useEffect(() => {
    (async () => {
      // 1. Get or create local identity
      const identity = await getOrCreateIdentity();
      setUserId(identity.userId);
      setDisplayName(identity.displayName);

      // 2. Register with cloud (idempotent, safe to call every launch)
      const registered = await registerWithCloud(identity.userId, identity.displayName);
      setIsCloudSynced(registered);
    })();
  }, []);

  // ── Network monitoring + auto-sync ──
  useEffect(() => {
    let wasOffline = false;

    const check = async () => {
      const mode = await checkNetworkMode();
      setNetworkMode(mode);
      setIsOnline(mode === 'online');

      if (mode === 'online') {
        // If we just came back online, flush the sync queue
        if (wasOffline) {
          console.log('🔄 Back online — flushing sync queue...');
          const synced = await flushQueue();
          if (synced > 0) {
            console.log(`✅ Auto-synced ${synced} pending actions`);
          }
        }
        wasOffline = false;

        // Retry cloud registration if not yet done
        if (!isCloudSynced) {
          const registered = await retryCloudRegistration();
          setIsCloudSynced(registered);
        }
      } else {
        wasOffline = true;
      }

      // Update pending count
      const count = await getPendingCount();
      setPendingSyncCount(count);
    };

    check();
    const interval = setInterval(check, 5000); // Check every 5 seconds (more responsive sync)
    return () => clearInterval(interval);
  }, [isCloudSynced]);

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
      userId, setUserIdState, displayName, setDisplayNameState, isCloudSynced,
      isLoggedIn, setIsLoggedIn,
      fullName, setFullName,
      email, setEmail,
      currentLang, setCurrentLang,
      isOnline, setIsOnline,
      networkMode,
      pendingSyncCount,
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
