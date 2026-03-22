/**
 * RapidRescue — Identity Service
 * 
 * Generates and persists a unique User ID (U_XXXXXXX format) on first app open.
 * This identity persists across app restarts and is mesh-network compatible:
 * no internet or server required to have an identity.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_USER_ID = 'rescue_user_id';
const STORAGE_KEY_DISPLAY_NAME = 'rescue_display_name';

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
