import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { currentOutlet } = useSettings();
  const outletId = currentOutlet?.id;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    // Try to get user from AuthContext or staff session from localStorage
    const staffSessionStr = localStorage.getItem('staff_session');
    const staffUser = staffSessionStr ? JSON.parse(staffSessionStr) : null;
    const effectiveUserId = user?.id || staffUser?.id;

    if (!effectiveUserId) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
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
        
        // Always refresh to ensure we have the latest state from the DB
        fetchNotifications();

        if (payload.eventType === 'INSERT') {
          setNotifications(prev => {
            const exists = prev.some(n => n.id === payload.new.id);
            if (exists) return prev;
            return [payload.new as Notification, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new as Notification : n));
        } else if (payload.eventType === 'DELETE') {
          const deletedId = payload.old?.id || payload.new?.id;
          if (deletedId) {
            setNotifications(prev => prev.filter(n => n.id !== deletedId));
          }
        }
      });
    }
    
    // Set up a polling interval as a fallback (every 10 seconds for more immediate updates)
    const interval = setInterval(() => {
      fetchNotifications();
    }, 10000);
    
    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(interval);
    };
  }, [fetchNotifications, user, outletId]);

  const markAsRead = async (id: string) => {
    try {
      await db.markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const staffSessionStr = localStorage.getItem('staff_session');
    const staffUser = staffSessionStr ? JSON.parse(staffSessionStr) : null;
    const effectiveUserId = user?.id || staffUser?.id;

    if (!effectiveUserId) return;
    try {
      await db.markAllNotificationsAsRead(effectiveUserId, outletId);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const removeNotification = async (id: string) => {
    try {
      await db.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const value = React.useMemo(() => ({
    notifications,
    isLoading,
    markAsRead,
    markAllAsRead,
    removeNotification,
    refresh: fetchNotifications
  }), [notifications, isLoading, markAsRead, markAllAsRead, removeNotification, fetchNotifications]);

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
