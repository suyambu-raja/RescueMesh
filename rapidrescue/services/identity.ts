/**
 * RapidRescue — Identity Service
 * 
 * Device-First Identity System:
 * 1. Generates a unique User ID (U_XXXXXXX) on first app open
 * 2. Stores it permanently in AsyncStorage
 * 3. Immediately registers with cloud backend (no login needed)
 * 4. All subsequent API calls include X-User-ID header automatically
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_KEY_USER_ID = 'rescue_user_id';
const STORAGE_KEY_DISPLAY_NAME = 'rescue_display_name';
const STORAGE_KEY_CLOUD_REGISTERED = 'rescue_cloud_registered';

/**
 * Generates a short unique tag like U_8F3K92X
 */
function generateUserTag(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let tag = 'U_';
  for (let i = 0; i < 7; i++) {
    tag += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return tag;
}

/**
 * Retrieves or creates the persistent user identity.
 * Returns { userId, displayName }
 */
export async function getOrCreateIdentity(): Promise<{ userId: string; displayName: string }> {
  try {
    let userId = await AsyncStorage.getItem(STORAGE_KEY_USER_ID);
    let displayName = await AsyncStorage.getItem(STORAGE_KEY_DISPLAY_NAME);

    if (!userId) {
      userId = generateUserTag();
      await AsyncStorage.setItem(STORAGE_KEY_USER_ID, userId);
    }

    if (!displayName) {
      displayName = 'Rescuer';
      await AsyncStorage.setItem(STORAGE_KEY_DISPLAY_NAME, displayName);
    }

    return { userId, displayName };
  } catch (e) {
    console.error('Identity service error:', e);
    // Absolute fallback — never leave the user without an identity
    return { userId: generateUserTag(), displayName: 'Rescuer' };
  }
}

/**
 * Register device user with cloud backend.
 * This is idempotent — calling multiple times is safe.
 * Does NOT require login.
 */
export async function registerWithCloud(userId: string, displayName: string): Promise<boolean> {
  try {
    // Check if already registered
    const isRegistered = await AsyncStorage.getItem(STORAGE_KEY_CLOUD_REGISTERED);
    if (isRegistered === 'true') {
      console.log('☁️ Device already cloud-registered');
      return true;
    }

    // Dynamic import to avoid circular dependency
    const { apiCall } = require('../api');
    
    const res = await apiCall('/identity/register', 'POST', {
      user_id: userId,
      display_name: displayName,
      device_info: `${Platform.OS} ${Platform.Version}`,
    });

    if (res.status === 'success') {
      await AsyncStorage.setItem(STORAGE_KEY_CLOUD_REGISTERED, 'true');
      console.log('☁️ Device user registered with cloud!');
      return true;
    }
    return false;
  } catch (e) {
    console.log('☁️ Cloud registration deferred (offline):', (e as Error).message);
    return false;
  }
}

/**
 * Retry cloud registration (called when connectivity returns).
 */
export async function retryCloudRegistration(): Promise<boolean> {
  const isRegistered = await AsyncStorage.getItem(STORAGE_KEY_CLOUD_REGISTERED);
  if (isRegistered === 'true') return true;

  const userId = await AsyncStorage.getItem(STORAGE_KEY_USER_ID);
  const displayName = await AsyncStorage.getItem(STORAGE_KEY_DISPLAY_NAME);
  if (!userId) return false;

  // Force re-attempt
  await AsyncStorage.removeItem(STORAGE_KEY_CLOUD_REGISTERED);
  return registerWithCloud(userId, displayName || 'Rescuer');
}

/**
 * Updates the display name (e.g. after login or user sets it manually).
 */
export async function setDisplayName(name: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_DISPLAY_NAME, name);
}

/**
 * Returns the current userId without creating a new one.
 */
export async function getUserId(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEY_USER_ID);
}

/**
 * Returns the formatted identity string: "Name (U_XXXXXXX)"
 */
export function formatIdentity(name: string, userId: string): string {
  return `${name} (${userId})`;
}

/**
 * Check if this device user has been registered with the cloud.
 */
export async function isCloudRegistered(): Promise<boolean> {
  const val = await AsyncStorage.getItem(STORAGE_KEY_CLOUD_REGISTERED);
  return val === 'true';
}
