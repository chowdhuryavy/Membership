import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../services/mockSupabase';
import { Notification } from '../types';
import { useAuth } from './AuthContext';
import { useSettings } from './SettingsContext';

interface NotificationContextType {
  notifications: Notification[];
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { currentOutlet } = useSettings();
  const outletId = currentOutlet?.id;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const lastActionTime = useRef<number | null>(null);

  const fetchNotifications = useCallback(async (isAutoRefresh = false) => {
    // Try to get user from AuthContext or staff session from localStorage
    const staffSessionStr = localStorage.getItem('staff_session');
    const staffUser = staffSessionStr ? JSON.parse(staffSessionStr) : null;
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
      console.log('Fetching notifications for user:', effectiveUserId, 'outlet:', outletId);
      const data = await db.getNotifications(effectiveUserId, outletId);
      console.log('Fetched notifications count:', data.length);
      setNotifications(data);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, outletId]);

  useEffect(() => {
    fetchNotifications();
    
    // Set up real-time subscription
    let unsubscribe: (() => void) | undefined;
    
    const staffSessionStr = localStorage.getItem('staff_session');
    const staffUser = staffSessionStr ? JSON.parse(staffSessionStr) : null;
    const effectiveUserId = user?.id || staffUser?.id;

    if (effectiveUserId) {
      console.log('Subscribing to notifications for user:', effectiveUserId, 'outlet:', outletId);
      unsubscribe = db.subscribeToNotifications(effectiveUserId, outletId, (payload) => {
        console.log('Received real-time notification payload:', payload.eventType, payload.new?.id);
        
        if (payload.eventType === 'INSERT') {
          const n = payload.new as Notification;
          // Check if dismissed by current user
          if (n.dismissed_by?.includes(effectiveUserId)) return;
          
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
    const staffSessionStr = localStorage.getItem('staff_session');
    const staffUser = staffSessionStr ? JSON.parse(staffSessionStr) : null;
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
    const staffSessionStr = localStorage.getItem('staff_session');
    const staffUser = staffSessionStr ? JSON.parse(staffSessionStr) : null;
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
    const staffSessionStr = localStorage.getItem('staff_session');
    const staffUser = staffSessionStr ? JSON.parse(staffSessionStr) : null;
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
    const staffSessionStr = localStorage.getItem('staff_session');
    const staffUser = staffSessionStr ? JSON.parse(staffSessionStr) : null;
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
    refresh: fetchNotifications
  }), [notifications, isLoading, markAsRead, markAllAsRead, removeNotification, clearAll, fetchNotifications]);

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
