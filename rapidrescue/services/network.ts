/**
 * RapidRescue — Network Service
 * 
 * Abstraction layer for Online/Offline mode detection.
 * Currently uses internet connectivity check.
 * Future: will add mesh network (Bluetooth/Wi-Fi Direct) as a transport layer.
 */
import { resolveApiUrl } from '../api';

export type NetworkMode = 'online' | 'offline';

/**
 * Check if the backend server is reachable.
 * Returns 'online' or 'offline'.
 */
export async function checkNetworkMode(): Promise<NetworkMode> {
  try {
    const baseUrl = await resolveApiUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(`${baseUrl}/sos/`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    return response.ok ? 'online' : 'offline';
  } catch {
    return 'offline';
  }
}

/**
 * FUTURE: Mesh transport interface
 * This is the contract that mesh network implementations will follow.
 */
export interface MeshTransport {
  sendMessage(targetId: string, payload: any): Promise<boolean>;
  broadcastMessage(payload: any): Promise<boolean>;
  discoverPeers(): Promise<string[]>;
  onMessageReceived(callback: (from: string, payload: any) => void): void;
}

/**
 * FUTURE: Placeholder for mesh transport.
 * Will be replaced with Bluetooth/Wi-Fi Direct implementation.
 */
export class PlaceholderMeshTransport implements MeshTransport {
  async sendMessage(_targetId: string, _payload: any): Promise<boolean> {
    console.log('[Mesh] Not implemented yet — message queued locally');
    return false;
  }
  
  async broadcastMessage(_payload: any): Promise<boolean> {
    console.log('[Mesh] Not implemented yet — broadcast queued locally');
    return false;
  }
  
  async discoverPeers(): Promise<string[]> {
    return [];
  }
  
  onMessageReceived(_callback: (from: string, payload: any) => void): void {
    // No-op until mesh is implemented
  }
}
