
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
    return 'serviceWorker' in navigator && 'PushManager' in window;
  }

  static async getPermission() {
    if (!await this.isSupported()) return 'not-supported';
    return Notification.permission;
  }

  static async requestPermission() {
    if (!await this.isSupported()) return false;
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  static async subscribeUser(userId: string) {
    if (!await this.isSupported()) return null;

    try {
      const registration = await navigator.serviceWorker.ready;
      
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
      console.error('Failed to subscribe user:', error);
      return null;
    }
  }

  static async unsubscribeUser(userId: string) {
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
