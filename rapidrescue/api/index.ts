import AsyncStorage from '@react-native-async-storage/async-storage';

// In a real app, use environment variables. For now, we'll hardcode local dev machine IP.
// Since you are running Expo locally or in Android emulator, you can use:
// 1. "http://10.0.2.2:8000" if testing on Android Emulator
// 2. "http://<YOUR_LOCAL_IP>:8000" if testing on a physical device.
// We'll use 10.0.2.2 for Android emulator by default, or localhost for web.
import { Platform } from 'react-native';

export const API_BASE_URL = 'http://192.168.0.3:8000/api';

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
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const apiCall = async (endpoint: string, method: string = 'GET', body: any = null) => {
  try {
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

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    clearTimeout(timeoutId);
    
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || data.message || 'API request failed');
    }

    return data;
  } catch (error) {
    console.error(`API Error [${method} ${endpoint}]:`, error);
    throw error;
  }
};
