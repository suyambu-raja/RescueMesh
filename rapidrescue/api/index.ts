import AsyncStorage from '@react-native-async-storage/async-storage';

// In a real app, use environment variables. For now, we'll hardcode local dev machine IP.
// Since you are running Expo locally or in Android emulator, you can use:
// 1. "http://10.0.2.2:8000" if testing on Android Emulator
// 2. "http://<YOUR_LOCAL_IP>:8000" if testing on a physical device.
// We'll use 10.0.2.2 for Android emulator by default, or localhost for web.
import { Platform } from 'react-native';

const RENDER_URL = 'https://rescuemesh.onrender.com/api';
const LOCAL_URL = 'http://192.168.0.2:8000/api'; // Your laptop's current exact Wi-Fi IP address

export let API_BASE_URL = RENDER_URL;
let isUrlResolved = false;

export const resolveApiUrl = async () => {
  if (!__DEV__) return RENDER_URL; // APKs always use Render
  if (isUrlResolved) return API_BASE_URL;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    // Ping local backend to see if it's active
    await fetch(`${LOCAL_URL}/docs`, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeoutId);
    API_BASE_URL = LOCAL_URL;
    console.log("🟢 Connected to Local Backend!");
  } catch (e) {
    API_BASE_URL = RENDER_URL;
    console.log("🟡 Local Backend offline. Falling back to Render.com.");
  }
  isUrlResolved = true;
  return API_BASE_URL;
};

export const setToken = async (token: string) => {
  await AsyncStorage.setItem('auth_token', token);
};

export const getToken = async () => {
  return await AsyncStorage.getItem('auth_token');
};

export const clearToken = async () => {
  await AsyncStorage.removeItem('auth_token');
};

const defaultHeaders = async () => {
  const token = await getToken();
  const userId = await AsyncStorage.getItem('rescue_user_id');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(userId ? { 'X-User-ID': userId } : {}),
  };
};

export const apiCall = async (endpoint: string, method: string = 'GET', body: any = null) => {
  try {
    const baseUrl = await resolveApiUrl();
    const headers = await defaultHeaders();
    const config: RequestInit = {
      method,
      headers,
    };
    if (body) {
      config.body = JSON.stringify(body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    config.signal = controller.signal;

    const response = await fetch(`${baseUrl}${endpoint}`, config);
    clearTimeout(timeoutId);
    
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || data.message || 'API request failed');
    }

    return data;
  } catch (error: any) {
    console.error(`API Error [${method} ${endpoint}]:`, error);

    // Auto-queue write operations if they fail due to network/server issues
    if (method !== 'GET') {
      try {
        const { enqueueAction } = require('../services/syncQueue');
        await enqueueAction(endpoint, method, body);
        console.log(`📦 Action [${method} ${endpoint}] queued offline`);
        // Return a dummy success so UI doesn't crash, with a flag
        return { status: 'success', data: body, _queued: true };
      } catch (e) {
        console.error("Failed to queue action:", e);
      }
    }
    throw error;
  }
};


