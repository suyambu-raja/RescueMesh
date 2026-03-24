/**
 * RapidRescue — Sync Queue Service
 * 
 * Handles offline → online data synchronization.
 * When the app is offline, actions are queued locally.
 * When connectivity returns, the queue is flushed to the cloud.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_STORAGE_KEY = 'rescue_sync_queue';

export interface QueuedAction {
  id: string;
  endpoint: string;
  method: string;
  payload: any;
  createdAt: string;
}

/**
 * Add an action to the offline sync queue.
 */
export async function enqueueAction(
  endpoint: string,
  method: string,
  payload: any
): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    const queue: QueuedAction[] = existing ? JSON.parse(existing) : [];

    const action: QueuedAction = {
      id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      endpoint,
      method,
      payload,
      createdAt: new Date().toISOString(),
    };

    queue.push(action);
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
    console.log(`📦 Queued offline action: ${method} ${endpoint}`);
  } catch (e) {
    console.error('Failed to enqueue action:', e);
  }
}

/**
 * Get the current sync queue.
 */
export async function getQueue(): Promise<QueuedAction[]> {
  try {
    const existing = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    return existing ? JSON.parse(existing) : [];
  } catch {
    return [];
  }
}

/**
 * Get the count of pending items.
 */
export async function getPendingCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

/**
 * Flush the sync queue — send all pending items to the cloud.
 * Uses the batch /api/identity/sync endpoint for efficiency.
 * Returns the number of successfully synced items.
 */
export async function flushQueue(): Promise<number> {
  try {
    const queue = await getQueue();
    if (queue.length === 0) return 0;

    const userId = await AsyncStorage.getItem('rescue_user_id');
    if (!userId) return 0;

    // Dynamic import to avoid circular dependency
    const { apiCall } = require('../api');

    const items = queue.map((q) => ({
      endpoint: q.endpoint,
      method: q.method,
      payload: q.payload,
    }));

    const res = await apiCall('/identity/sync', 'POST', {
      user_id: userId,
      items,
    });

    if (res.status === 'success') {
      const synced = res.data?.synced || 0;
      // Clear the queue
      await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
      console.log(`✅ Synced ${synced}/${queue.length} queued actions`);
      return synced;
    }
    return 0;
  } catch (e) {
    console.log('⚠️ Queue flush failed (will retry later):', (e as Error).message);
    return 0;
  }
}

/**
 * Smart API call that queues when offline.
 * Use this instead of apiCall for write operations.
 */
export async function smartApiCall(
  endpoint: string,
  method: string = 'POST',
  payload: any = null,
  isOnline: boolean = true,
): Promise<any> {
  if (isOnline) {
    try {
      const { apiCall } = require('../api');
      return await apiCall(endpoint, method, payload);
    } catch (e) {
      // If the call fails, queue it
      if (method !== 'GET') {
        await enqueueAction(endpoint, method, payload);
      }
      throw e;
    }
  } else {
    // Offline — queue the action
    if (method !== 'GET') {
      await enqueueAction(endpoint, method, payload);
    }
    return { status: 'queued', message: 'Action queued for sync when online.' };
  }
}

/**
 * Clear the entire sync queue (e.g., after manual sync).
 */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
}
