import { useState, useEffect, useCallback } from 'react';
import { db } from '../services/mockSupabase';
import { Notification } from '../types';
import { useAuth } from '../contexts/AuthContext';

export const useNotifications = (outletId?: string) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      console.log('Fetching notifications for user:', user.id, 'outlet:', outletId);
      const data = await db.getNotifications(user.id, outletId);
      console.log('Fetched notifications:', data);
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
    if (user) {
      console.log('Subscribing to notifications for user:', user.id, 'outlet:', outletId);
      unsubscribe = db.subscribeToNotifications(user.id, outletId, (payload) => {
        console.log('Received real-time notification payload:', payload);
        if (payload.eventType === 'INSERT') {
          setNotifications(prev => [payload.new as Notification, ...prev]);
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
    
    // Set up a polling interval as a fallback (every 60 seconds instead of 30)
    const interval = setInterval(() => {
      fetchNotifications();
    }, 60000);
    
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
    if (!user) return;
    try {
      await db.markAllNotificationsAsRead(user.id, outletId);
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

  return {
    notifications,
    isLoading,
    markAsRead,
    markAllAsRead,
    removeNotification,
    refresh: fetchNotifications
  };
};
