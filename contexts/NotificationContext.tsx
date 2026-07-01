
const safeStorage = {
  getItem(key: string): string | null {
    try { return localStorage.getItem(key); } catch(e) { return null; }
  },
  setItem(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch(e) {}
  },
  removeItem(key: string): void {
    try { localStorage.removeItem(key); } catch(e) {}
  }
};

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../services/mockSupabase';
import { Notification } from '../types';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';
import { toast } from 'react-hot-toast';
import { PushNotificationService } from '../services/pushNotificationService';

function safeParseJSON<T>(str: string | null, fallback: T): T {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch (e) {
    return fallback;
  }
}

// Unique, more complex notification sound
const playNotificationSound = async () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn('AudioContext is not supported in this browser');
      return;
    }
    const audioContext = new AudioContextClass();
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    // Create a series of tones for a "musical" alert
    const playTone = (freq: number, startTime: number, duration: number, type: OscillatorType = 'sine') => {
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      osc.connect(gain);
      gain.connect(audioContext.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0.1, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = audioContext.currentTime;
    // Uncommon harmonic sequence: C# -> G# -> D# -> A# (Quartal progression)
    // with a "glassy" synth feel
    playTone(554.37, now, 0.2, 'sine'); // C#5
    playTone(830.61, now + 0.1, 0.2, 'sine'); // G#5
    playTone(1244.51, now + 0.2, 0.2, 'sine'); // D#6
    playTone(1864.66, now + 0.3, 0.5, 'sine'); // A#6
    
    // Add unique rhythmic accents
    playTone(110, now, 0.05, 'triangle'); // Low pulse
    playTone(220, now + 0.15, 0.05, 'triangle'); 
    playTone(440, now + 0.3, 0.05, 'triangle');
    
  } catch (e) {
    console.error('Failed to play sound', e);
  }
};

interface NotificationContextType {
  notifications: Notification[];
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
  isPushEnabled: boolean;
  enablePush: () => Promise<boolean>;
  disablePush: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isSuperAdmin } = useAuth();
  const { currentOutlet, hasPermission } = useSettings();
  const outletId = currentOutlet?.id;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const lastActionTime = useRef<number | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  // Check push permission on mount
  useEffect(() => {
    const checkPush = async () => {
      const permission = await PushNotificationService.getPermission();
      setIsPushEnabled(permission === 'granted');
    };
    checkPush();
  }, []);

  const getStaffSession = () => {
    try {
      const staffSessionStr = safeStorage.getItem('staff_session');
      return safeParseJSON<any>(staffSessionStr, null);
    } catch (e) {
      return null;
    }
  };

  // Set up real-time subscription and push auto-registration
  useEffect(() => {
    const staffUser = getStaffSession();
    const effectiveUserId = user?.id || staffUser?.id;

    if (!effectiveUserId) return;

    // Auto-attempt push registration if permission was already granted previously
    const autoRegisterPush = async () => {
        const permission = await PushNotificationService.getPermission();
        if (permission === 'granted') {
            try {
                await PushNotificationService.subscribeUser(effectiveUserId);
                setIsPushEnabled(true);
            } catch (e) {
                console.warn("Auto push registration failed:", e);
            }
        }
    };
    autoRegisterPush();
  }, [user]);

  const fetchNotifications = useCallback(async (isAutoRefresh = false) => {
    // Try to get user from AuthContext or staff session from localStorage
    const staffUser = getStaffSession();
    const effectiveUserId = user?.id || staffUser?.id;

    if (!effectiveUserId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    // Skip auto-refresh if we just did a bulk action (within last 5 seconds)
    if (isAutoRefresh && lastActionTime.current && Date.now() - lastActionTime.current < 5000) {
      console.log('Skipping auto-refresh to preserve optimistic state');
      return;
    }

    try {
      if (!isAutoRefresh) setIsLoading(true);
      const isAdmin = isSuperAdmin;
      const data = await db.getNotifications(effectiveUserId, outletId, isAdmin);
      
      // Filter by permission
      const filteredData = data.filter(n => {
        if (!n.required_permission) return true;
        // If it's a staff user from local storage, we might not have their role_id easily here
        // but usually notifications are for the main logged in user
        return hasPermission(user?.role_id || '', n.required_permission, user?.id);
      });

      // Pre-populate seenIds with existing notifications to prevent alerts on reload
      filteredData.forEach(n => seenIds.current.add(n.id));
      setNotifications(filteredData);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, outletId]);

  const enablePush = async () => {
    const staffSessionStr = safeStorage.getItem('staff_session');
    const staffUser = staffSessionStr ? JSON.parse(staffSessionStr) : null;
    const effectiveUserId = user?.id || staffUser?.id;
    
    if (!effectiveUserId) return false;

    try {
      const granted = await PushNotificationService.requestPermission();
      if (granted) {
        await PushNotificationService.subscribeUser(effectiveUserId);
        setIsPushEnabled(true);
        toast.success("Push notifications enabled!");
        return true;
      } else {
        toast.error("Permission for notifications was denied.");
        return false;
      }
    } catch (e) {
      console.error("Failed to enable push:", e);
      toast.error("An error occurred while enabling push notifications.");
      return false;
    }
  };

  const disablePush = async () => {
    const staffSessionStr = safeStorage.getItem('staff_session');
    const staffUser = staffSessionStr ? JSON.parse(staffSessionStr) : null;
    const effectiveUserId = user?.id || staffUser?.id;

    if (effectiveUserId) {
      await PushNotificationService.unsubscribeUser(effectiveUserId);
    }
    setIsPushEnabled(false);
    toast.success("Push notifications disabled.");
  };

  useEffect(() => {
    fetchNotifications();
    
    // Set up real-time subscription
    let unsubscribe: (() => void) | undefined;
    
    const staffUser = getStaffSession();
    const effectiveUserId = user?.id || staffUser?.id;

    if (effectiveUserId) {
      const isAdmin = isSuperAdmin;
      console.log('Subscribing to notifications for user:', effectiveUserId, 'outlet:', outletId, 'isAdmin:', isAdmin);
      unsubscribe = db.subscribeToNotifications(effectiveUserId, outletId, isAdmin, async (payload) => {
        console.log('Received real-time notification payload:', payload.eventType, payload.new?.id);
        
        if (payload.eventType === 'INSERT') {
          const n = payload.new as Notification;
          // Check if already seen in this session to prevent spam
          if (seenIds.current.has(n.id)) return;
          seenIds.current.add(n.id);

          // Check if dismissed by current user
          if (n.dismissed_by?.includes(effectiveUserId)) return;
          
          // Check permission
          if (n.required_permission && !hasPermission(user?.role_id || '', n.required_permission, user?.id)) {
            return;
          }
          
          // Only show toast and play sound if this is the active/focused tab
          // to prevent duplicates when multiple tabs are open
          const isActiveTab = document.visibilityState === 'visible' && document.hasFocus();
          
          if (isActiveTab) {
            // Trigger notification UI & Sound
            await playNotificationSound();
            toast.success(n.title + ': ' + n.message, {
              duration: 5000,
              position: 'top-right',
            });
          }

          setNotifications(prev => {
            const exists = prev.some(item => item.id === n.id);
            if (exists) return prev;
            
            // Map read status for current user
            const mapped = {
              ...n,
              read: n.user_id === effectiveUserId ? n.read : (n.read_by?.includes(effectiveUserId) || false)
            };
            return [mapped, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          const n = payload.new as Notification;
          // If dismissed by current user, remove it
          if (n.dismissed_by?.includes(effectiveUserId)) {
            setNotifications(prev => prev.filter(item => item.id !== n.id));
            return;
          }
          
          // Check permission - if permission changed and user no longer has it, remove it
          if (n.required_permission && !hasPermission(user?.role_id || '', n.required_permission, user?.id)) {
            setNotifications(prev => prev.filter(item => item.id !== n.id));
            return;
          }
          
          // Update state silently - no toast or sound for status updates
          setNotifications(prev => prev.map(item => {
            if (item.id === n.id) {
              // Map read status for current user
              return {
                ...n,
                read: n.user_id === effectiveUserId ? n.read : (n.read_by?.includes(effectiveUserId) || false)
              };
            }
            return item;
          }));
        } else if (payload.eventType === 'DELETE') {
          const deletedId = payload.old?.id || payload.new?.id;
          if (deletedId) {
            setNotifications(prev => prev.filter(n => n.id !== deletedId));
          }
        }
      });
    }
    
    // Set up a polling interval as a fallback (every 30 seconds)
    const interval = setInterval(() => {
      fetchNotifications(true);
    }, 30000);
    
    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(interval);
    };
  }, [fetchNotifications, user, outletId]);


  const markAsRead = async (id: string) => {
    const staffUser = getStaffSession();
    const effectiveUserId = user?.id || staffUser?.id;

    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    
    try {
      await db.markNotificationAsRead(id, effectiveUserId);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      // Revert on error
      fetchNotifications();
    }
  };

  const markAllAsRead = async () => {
    const staffUser = getStaffSession();
    const effectiveUserId = user?.id || staffUser?.id;

    if (!effectiveUserId) return;

    lastActionTime.current = Date.now();
    // Optimistic update
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));

    try {
      await db.markAllNotificationsAsRead(effectiveUserId, outletId, unreadIds);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      // Revert on error
      fetchNotifications();
    }
  };

  const removeNotification = async (id: string) => {
    const staffUser = getStaffSession();
    const effectiveUserId = user?.id || staffUser?.id;

    // Optimistic update
    setNotifications(prev => prev.filter(n => n.id !== id));
    
    try {
      await db.deleteNotification(id, effectiveUserId);
    } catch (error) {
      console.error('Failed to delete notification:', error);
      // Revert on error
      fetchNotifications();
    }
  };

  const clearAll = async () => {
    const staffUser = getStaffSession();
    const effectiveUserId = user?.id || staffUser?.id;

    lastActionTime.current = Date.now();
    // Optimistic update
    const allIds = notifications.map(n => n.id);
    setNotifications([]);

    try {
      await db.deleteAllNotifications(effectiveUserId, outletId, allIds);
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
      // Revert on error
      fetchNotifications();
    }
  };

  const value = React.useMemo(() => ({
    notifications,
    isLoading,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    refresh: fetchNotifications,
    isPushEnabled,
    enablePush,
    disablePush
  }), [notifications, isLoading, markAsRead, markAllAsRead, removeNotification, clearAll, fetchNotifications, isPushEnabled]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotificationContext must be used within a NotificationProvider');
  return context;
};
