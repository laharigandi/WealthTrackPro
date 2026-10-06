import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification as apiDeleteNotification
} from '../services/notificationService';
import { refreshAccessToken } from '../services/api';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isLiveConnected, setIsLiveConnected] = useState(false);
  const [shouldShake, setShouldShake] = useState(false);
  const [toasts, setToasts] = useState([]);

  const eventSourceRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const isRefreshingRef = useRef(false);
  const prevNotificationIdsRef = useRef(new Set());
  const isInitialLoadRef = useRef(true);
  const userRef = useRef(user);
  const tokenRef = useRef(token);

  useEffect(() => {
    userRef.current = user;
    tokenRef.current = token;
  }, [user, token]);

  // Trigger bell shake animation briefly
  const triggerBellShake = useCallback(() => {
    setShouldShake(true);
    setTimeout(() => setShouldShake(false), 800);
  }, []);

  // Dismiss toast banner
  const dismissToast = useCallback((toastId) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  // Add toast banner and auto-dismiss after 6 seconds
  const addToast = useCallback((notification) => {
    const toastItem = {
      id: `${notification.id}-${Date.now()}`,
      notificationId: notification.id,
      title: notification.title,
      message: notification.message,
      severity: notification.severity,
      type: notification.type,
      created_at: notification.created_at,
    };
    setToasts((prev) => {
      // Prevent duplicate toast if already showing for this notification ID
      if (prev.some((t) => t.notificationId === notification.id)) {
        return prev;
      }
      return [toastItem, ...prev.slice(0, 4)];
    });

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastItem.id));
    }, 6000);
  }, []);

  // Fetch notifications manually or on fallback poll
  const refreshNotifications = useCallback(async (showLoading = false) => {
    if (!userRef.current) return;
    if (showLoading) setLoading(true);
    try {
      const data = await getNotifications();
      const list = Array.isArray(data) ? data : [];
      setNotifications(list);
      const unread = list.filter((n) => !n.is_read).length;
      setUnreadCount(unread);
      setError(null);

      // Populate seen IDs on first manual fetch
      if (isInitialLoadRef.current) {
        prevNotificationIdsRef.current = new Set(list.map((n) => n.id));
        isInitialLoadRef.current = false;
      }
    } catch (err) {
      console.warn('Could not fetch notifications:', err);
      setError('Unable to load notifications.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  // Mark single notification as read
  const markAsRead = useCallback(async (id) => {
    try {
      await markNotificationAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error(`Failed to mark notification ${id} as read:`, err);
    }
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    try {
      await markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, []);

  // Delete notification
  const removeNotification = useCallback(async (id) => {
    try {
      await apiDeleteNotification(id);
      setNotifications((prev) => {
        const item = prev.find((n) => n.id === id);
        if (item && !item.is_read) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.filter((n) => n.id !== id);
      });
      prevNotificationIdsRef.current.delete(id);
    } catch (err) {
      console.error(`Failed to delete notification ${id}:`, err);
    }
  }, []);

  // Process incoming real-time SSE notification payload
  const handleIncomingData = useCallback((data) => {
    if (!data || !Array.isArray(data.notifications)) return;

    const newNotifications = data.notifications;
    const newUnreadCount = typeof data.unread_count === 'number'
      ? data.unread_count
      : newNotifications.filter((n) => !n.is_read).length;

    // Detect new incoming alerts if not initial load
    if (!isInitialLoadRef.current) {
      const currentSeen = prevNotificationIdsRef.current;
      const newlyAdded = newNotifications.filter(
        (n) => !currentSeen.has(n.id) && !n.is_read
      );

      if (newlyAdded.length > 0) {
        triggerBellShake();
        newlyAdded.forEach((alert) => addToast(alert));
      }
    } else {
      isInitialLoadRef.current = false;
    }

    // Update seen IDs
    prevNotificationIdsRef.current = new Set(newNotifications.map((n) => n.id));
    setNotifications(newNotifications);
    setUnreadCount(newUnreadCount);
    setError(null);
  }, [addToast, triggerBellShake]);

  const handleIncomingDataRef = useRef(handleIncomingData);
  useEffect(() => {
    handleIncomingDataRef.current = handleIncomingData;
  }, [handleIncomingData]);

  const reconnectAttemptsRef = useRef(0);

  // Clean close SSE helper
  const closeSSE = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      console.log('[SSE] SSE closed.');
    }
    setIsLiveConnected(false);
  }, []);

  // Connect to SSE Stream
  const connectSSE = useCallback((tokenOverride = null) => {
    const activeToken = tokenOverride || localStorage.getItem('access_token') || tokenRef.current;
    if (!userRef.current || !activeToken) {
      closeSSE();
      return;
    }

    // Close any previous SSE connection to ensure strictly ONE active connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/v1';
    console.log('[SSE] Connecting to notification stream...');

    const streamUrl = `${BASE_URL}/notifications/stream?token=${encodeURIComponent(activeToken)}`;
    const es = new EventSource(streamUrl);
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      console.log('[SSE] Connected to notification stream.');
      setIsLiveConnected(true);
      isRefreshingRef.current = false;
      reconnectAttemptsRef.current = 0;
    });

    es.addEventListener('notification_update', (event) => {
      try {
        const parsed = JSON.parse(event.data);
        handleIncomingDataRef.current(parsed);
        setIsLiveConnected(true);
        isRefreshingRef.current = false;
        reconnectAttemptsRef.current = 0;
      } catch (e) {
        console.error('Error parsing SSE notification_update data:', e);
      }
    });

    es.onopen = () => {
      console.log('[SSE] Connected to notification stream.');
      setIsLiveConnected(true);
      isRefreshingRef.current = false;
      reconnectAttemptsRef.current = 0;
    };

    es.onerror = async () => {
      console.warn('[SSE] Connection interrupted or authentication error.');
      es.close();
      if (eventSourceRef.current === es) {
        eventSourceRef.current = null;
      }
      setIsLiveConnected(false);

      const refreshToken = localStorage.getItem('refresh_token');
      if (!userRef.current || !refreshToken) {
        console.log('[SSE] No active session or user logged out. Reconnection stopped.');
        return;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      reconnectAttemptsRef.current += 1;
      const attempt = reconnectAttemptsRef.current;
      const delay = Math.min(1000 * Math.pow(1.5, Math.min(attempt, 6)), 10000);
      console.log(`[SSE] Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${attempt})...`);

      reconnectTimeoutRef.current = setTimeout(async () => {
        if (!userRef.current) return;
        try {
          if (!isRefreshingRef.current) {
            isRefreshingRef.current = true;
            try {
              const freshToken = await refreshAccessToken();
              isRefreshingRef.current = false;
              connectSSE(freshToken);
              return;
            } catch (refErr) {
              isRefreshingRef.current = false;
              if (refErr.response?.status === 401 || refErr.response?.status === 403) {
                console.error('[SSE] Authentication rejected, stopping SSE stream.');
                return;
              }
            }
          }
          connectSSE();
        } catch (e) {
          console.warn('[SSE] Reconnect failed:', e);
        }
      }, delay);
    };
  }, [closeSSE]);

  // Handle SSE lifecycle and token refresh events
  useEffect(() => {
    if (!user || !token) {
      closeSSE();
      setNotifications([]);
      setUnreadCount(0);
      setToasts([]);
      prevNotificationIdsRef.current = new Set();
      isInitialLoadRef.current = true;
      return;
    }

    connectSSE();

    const handleTokenRefreshed = (e) => {
      const newToken = e.detail?.access_token;
      console.log('[SSE] Reconnecting with fresh token...');
      connectSSE(newToken);
    };

    const handleLogout = () => {
      console.log('[SSE] SSE closed.');
      closeSSE();
      setNotifications([]);
      setUnreadCount(0);
      setToasts([]);
      prevNotificationIdsRef.current = new Set();
      isInitialLoadRef.current = true;
    };

    window.addEventListener('auth:token_refreshed', handleTokenRefreshed);
    window.addEventListener('auth:logout', handleLogout);

    // Fallback polling every 45s if disconnected
    const pollInterval = setInterval(() => {
      if (!eventSourceRef.current && userRef.current) {
        refreshNotifications(false);
      }
    }, 45000);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('auth:token_refreshed', handleTokenRefreshed);
      window.removeEventListener('auth:logout', handleLogout);
      closeSSE();
    };
  }, [user, token, connectSSE, closeSSE, refreshNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        error,
        isLiveConnected,
        shouldShake,
        toasts,
        dismissToast,
        markAsRead,
        markAllAsRead,
        deleteNotification: removeNotification,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
