import React, { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCircle2, AlertTriangle, Target, Shield, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

// ── Helper: Relative Time Format ──────────────────────────────────────────
const formatRelativeTime = (dateStr) => {
  if (!dateStr) return 'Active';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Active';
    
    const now = new Date();
    const diffMs = now - date;
    if (diffMs < 0) return 'Just now';
    
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  } catch (e) {
    return 'Active';
  }
};

// ── Helper: Icon mapping by type ──────────────────────────────────────────
const getNotificationIcon = (type) => {
  switch (type) {
    case 'goal_completed':
      return CheckCircle2;
    case 'goal_milestone':
      return Target;
    case 'portfolio_risk':
    case 'kyc_alert':
      return AlertTriangle;
    case 'security':
      return Shield;
    default:
      return Bell;
  }
};

// ── Helper: Style mapping by severity ─────────────────────────────────────
const getNotificationStyles = (severity, isRead) => {
  if (severity === 'critical') {
    return {
      cardClass: isRead
        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-slate-100 dark:border-slate-800/50 bg-transparent'
        : 'bg-red-50 border-red-200 dark:bg-red-955/30 dark:border-red-900/60 border-l-4 border-l-red-500',
      iconContainer: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
      titleColor: 'text-red-700 dark:text-red-400 font-bold',
      messageColor: 'text-red-600 dark:text-red-300 font-semibold',
    };
  }

  if (severity === 'warning') {
    return {
      cardClass: isRead
        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-slate-100 dark:border-slate-800/50 bg-transparent'
        : 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/60 border-l-4 border-l-amber-500',
      iconContainer: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
      titleColor: 'text-amber-700 dark:text-amber-400 font-bold',
      messageColor: 'text-amber-600 dark:text-amber-300 font-semibold',
    };
  }

  if (severity === 'success') {
    return {
      cardClass: isRead
        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-slate-100 dark:border-slate-800/50 bg-transparent'
        : 'bg-emerald-50 border-emerald-200 dark:bg-emerald-955/30 dark:border-emerald-900/60 border-l-4 border-l-emerald-500',
      iconContainer: 'bg-emerald-100 text-emerald-605 dark:bg-emerald-900/40 dark:text-emerald-400',
      titleColor: 'text-emerald-700 dark:text-emerald-400 font-bold',
      messageColor: 'text-slate-650 dark:text-slate-300 font-semibold',
    };
  }

  if (severity === 'security') {
    return {
      cardClass: isRead
        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-slate-100 dark:border-slate-800/50 bg-transparent'
        : 'bg-slate-50 border-slate-205 dark:bg-slate-900/40 dark:border-slate-800/60 border-l-4 border-l-slate-400',
      iconContainer: 'bg-slate-100 text-slate-600 dark:bg-slate-805 dark:text-slate-400',
      titleColor: 'text-slate-900 dark:text-slate-100 font-bold',
      messageColor: 'text-slate-600 dark:text-slate-400 font-semibold',
    };
  }

  // default / info / other
  return {
    cardClass: isRead
      ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-slate-100 dark:border-slate-800/50 bg-transparent'
      : 'bg-cyan-50 border-cyan-200 dark:bg-cyan-950/20 dark:border-cyan-900/40 border-l-4 border-l-cyan-500',
    iconContainer: 'bg-cyan-100 text-cyan-606 dark:bg-cyan-900/40 dark:text-cyan-400',
    titleColor: 'text-cyan-700 dark:text-cyan-400 font-bold',
    messageColor: 'text-slate-700 dark:text-slate-300 font-semibold',
  };
};

const SkeletonRow = () => (
  <div className="p-4 flex gap-3 animate-pulse border-b border-slate-100 dark:border-slate-800/50">
    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-slate-200 dark:bg-slate-855 rounded w-1/3" />
      <div className="h-3 bg-slate-200 dark:bg-slate-855 rounded w-5/6" />
      <div className="h-2 bg-slate-200 dark:bg-slate-855 rounded w-1/4" />
    </div>
  </div>
);

export const NotificationsDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [shouldShake, setShouldShake] = useState(false);

  const dropdownRef = useRef(null);
  const prevUnreadCountRef = useRef(0);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await api.get('/notifications');
      const data = response.data || [];
      
      const newUnreadCount = data.filter((n) => !n.is_read).length;
      if (newUnreadCount > prevUnreadCountRef.current) {
        setShouldShake(true);
        setTimeout(() => setShouldShake(false), 400);
      }
      prevUnreadCountRef.current = newUnreadCount;
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
      setError('Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (err) {
      console.error(`Failed to mark notification ${id} as read:`, err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  // Poll notifications every 30 seconds
  useEffect(() => {
    fetchNotifications(true);
    const interval = setInterval(() => {
      fetchNotifications(false);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Handle clicking outside the dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            fetchNotifications(false);
          }
        }}
        aria-label={`Notifications, ${unreadCount} unread`}
        className={`relative p-2.5 rounded-xl text-slate-650 dark:text-slate-400 hover:text-red-505 dark:hover:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-955/20 active:scale-[0.96] hover:scale-[1.03] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 border border-transparent ${
          shouldShake ? 'animate-bell-shake' : ''
        }`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 bg-red-500 text-white text-[10px] font-extrabold rounded-full border border-white dark:border-slate-955 shadow-sm animate-[fadeIn_0.2s_ease-out]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-[380px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl dark:shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs font-bold text-red-650 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1 transition-colors focus:outline-none"
                >
                  <Check size={12} /> Mark all as read
                </button>
              )}
            </div>

            {/* Body */}
            <div className="max-h-[400px] overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              ) : error ? (
                <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                  <AlertTriangle className="h-6 w-6 text-red-500 animate-bounce" />
                  <p className="text-sm font-bold text-slate-650 dark:text-slate-400">{error}</p>
                  <button
                    onClick={() => fetchNotifications(true)}
                    className="px-3.5 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 focus:outline-none"
                  >
                    <RefreshCw size={12} className="animate-spin-slow" /> Retry
                  </button>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center space-y-2 animate-[fadeIn_0.2s_ease-out]">
                  <Bell size={24} className="text-slate-350 dark:text-slate-600 mb-1" />
                  <p className="text-sm font-black text-slate-800 dark:text-slate-200">🎉 You&apos;re all caught up!</p>
                  <p className="text-xs text-slate-500 dark:text-slate-405 font-semibold">No new alerts right now.</p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
                  {notifications.map((notification) => {
                    const Icon = getNotificationIcon(notification.type);
                    const styles = getNotificationStyles(notification.severity, notification.is_read);

                    return (
                      <div
                        key={notification.id}
                        onClick={() => {
                          if (!notification.is_read) {
                            markAsRead(notification.id);
                          }
                        }}
                        className={`p-4 flex gap-3 transition-colors duration-200 cursor-pointer border-b last:border-b-0 ${
                          styles.cardClass
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${styles.iconContainer}`}
                        >
                          <Icon size={16} />
                        </div>
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm ${styles.titleColor}`}>{notification.title}</p>
                            {!notification.is_read && (
                              <span className="w-[7px] h-[7px] rounded-full bg-red-500 shrink-0" />
                            )}
                          </div>
                          <p className={`text-xs leading-relaxed ${styles.messageColor}`}>
                            {notification.message}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold pt-1">
                            {formatRelativeTime(notification.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
