
import { db } from './mockSupabase';

// VAPID Public Key from environment variables
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || 'BGYWj-C5EDA6tRRja2z9R6PDP4cUA5wHK0Nx5DZcRXCbRS54k7_tEzDM7J6j914c32ePsS2axlB0Jl5YCE_OIuM'; 

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
    if (!await this.isSupported()) return 'not-supported';
    return Notification.permission;
  }

  static async requestPermission() {
    if (!await this.isSupported()) {
      console.warn("Native push not supported.");
      return false;
    }
    try {
      const permissionResponse = await Notification.requestPermission();
      return permissionResponse === 'granted';
    } catch (e) {
      console.warn("Native permission request failed:", e);
      return false;
    }
  }

  static async subscribeUser(userId: string) {
    if (!await this.isSupported()) {
      console.warn("Push not supported on this browser");
      return null;
    }

    try {
      console.log('Waiting for Service Worker to be ready...');
      const registration = await navigator.serviceWorker.ready;
      
      if (!registration) throw new Error("No service worker registration found");

      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        console.log('Subscribing user to push notification service...');
        // Subscribe new user
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey
        });
      }

      console.log('Push subscription obtained:', subscription);
      await this.syncSubscriptionWithBackend(userId, subscription);
      return subscription;
    } catch (error) {
      console.error('Failed to subscribe user to push notifications:', error);
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
