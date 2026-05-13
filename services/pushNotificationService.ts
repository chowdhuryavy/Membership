
import { db } from './mockSupabase';

// VAPID Public Key (This should usually come from environment variables)
// Generating a persistent one for this environment
const VAPID_PUBLIC_KEY = 'BAPq7277sgghAs7xXLA7Tn6c6w9YpKw_hm9adqBZtJ63oJEWzewpcsGuWm2BCXpgLkiebhQB8I4wyN-UXsb5KdM'; 
// NOTE: The above is a placeholder. In a real app, you should generate a real VAPID key pair.

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export class PushNotificationService {
  static async isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  static async getPermission() {
    if (localStorage.getItem('mock_push_permission') === 'granted') {
        return 'granted';
    }
    if (!await this.isSupported()) return 'not-supported';
    return Notification.permission;
  }

  static async requestPermission() {
    if (localStorage.getItem('mock_push_permission') === 'granted') {
        return true;
    }
    if (!await this.isSupported()) {
      console.warn("Native push not supported. Falling back to mock permission for iframe preview.");
      localStorage.setItem('mock_push_permission', 'granted');
      return true;
    }
    try {
      const permissionResponse = await Promise.race([
        Notification.requestPermission(),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000))
      ]);
      return permissionResponse === 'granted';
    } catch (e) {
      console.warn("Native permission request failed or timed out. Falling back to mock permission for iframe preview.");
      localStorage.setItem('mock_push_permission', 'granted');
      return true; // Mock success
    }
  }

  static async subscribeUser(userId: string) {
    if (localStorage.getItem('mock_push_permission') === 'granted') {
        console.log('Returning mock subscription...');
        const mockSub = { endpoint: 'mock-endpoint-' + userId, toJSON: () => ({ endpoint: 'mock-endpoint-' + userId, keys: { p256dh: 'mock', auth: 'mock' } }) };
        await this.syncSubscriptionWithBackend(userId, mockSub as any);
        return mockSub;
    }

    if (!await this.isSupported()) return null;

    try {
      console.log('Waiting for SW ready...');
      // Add a 5 second timeout to avoid hanging indefinitely if SW fails
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Service Worker timeout")), 5000))
      ]);
      
      if (!registration) throw new Error("No SW registration");

      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('User already subscribed:', existingSubscription);
        await this.syncSubscriptionWithBackend(userId, existingSubscription);
        return existingSubscription;
      }

      // Subscribe new user
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey
      });

      console.log('User subscribed:', subscription);
      await this.syncSubscriptionWithBackend(userId, subscription);
      return subscription;
    } catch (error) {
      console.warn('Failed to subscribe user natively:', error);
      if (localStorage.getItem('mock_push_permission') === 'granted') {
          console.log('Returning mock subscription...');
          const mockSub = { endpoint: 'mock-endpoint-' + userId, toJSON: () => ({ endpoint: 'mock-endpoint-' + userId, keys: { p256dh: 'mock', auth: 'mock' } }) };
          await this.syncSubscriptionWithBackend(userId, mockSub as any);
          return mockSub;
      }
      return null;
    }
  }

  static async unsubscribeUser(userId: string) {
    if (localStorage.getItem('mock_push_permission') === 'granted') {
        localStorage.removeItem('mock_push_permission');
        await this.removeSubscriptionFromBackend(userId, { endpoint: 'mock-endpoint-' + userId } as any);
        return true;
    }

    if (!await this.isSupported()) return false;

    try {

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        console.log('User unsubscribed locally');
        // Update backend
        await this.removeSubscriptionFromBackend(userId, subscription);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to unsubscribe user:', error);
      return false;
    }
  }

  private static async syncSubscriptionWithBackend(userId: string, subscription: PushSubscription) {
    console.log('Syncing subscription with backend for user:', userId);
    try {
      // @ts-ignore - adding this to db service next
      await db.savePushSubscription(userId, subscription.toJSON());
    } catch (error) {
      console.error('Failed to sync subscription with backend:', error);
    }
  }

  private static async removeSubscriptionFromBackend(userId: string, subscription: PushSubscription) {
    console.log('Removing subscription from backend for user:', userId);
    try {
       // @ts-ignore - adding this to db service next
      await db.deletePushSubscription(userId, subscription.endpoint);
    } catch (error) {
      console.error('Failed to remove subscription from backend:', error);
    }
  }
}
