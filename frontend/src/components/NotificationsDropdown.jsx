import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCircle2,
  AlertTriangle,
  Target,
  Shield,
  Trash2,
  Radio,
  Sparkles,
  TrendingDown,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '../context/NotificationContext';

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
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
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
    case 'portfolio_pnl':
      return TrendingDown;
    case 'portfolio_milestone':
      return Sparkles;
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
        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-slate-100 dark:border-slate-800/50 bg-transparent opacity-80'
        : 'bg-red-50/70 border-red-200 dark:bg-red-950/30 dark:border-red-900/60 border-l-4 border-l-red-500',
      iconContainer: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
      titleColor: 'text-red-700 dark:text-red-400 font-bold',
      messageColor: 'text-red-900 dark:text-red-200 font-medium',
    };
  }

  if (severity === 'warning') {
    return {
      cardClass: isRead
        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-slate-100 dark:border-slate-800/50 bg-transparent opacity-80'
        : 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/60 border-l-4 border-l-amber-500',
      iconContainer: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
      titleColor: 'text-amber-700 dark:text-amber-400 font-bold',
      messageColor: 'text-amber-950 dark:text-amber-200 font-medium',
    };
  }

  if (severity === 'success') {
    return {
      cardClass: isRead
        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-slate-100 dark:border-slate-800/50 bg-transparent opacity-80'
        : 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/60 border-l-4 border-l-emerald-500',
      iconContainer: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
      titleColor: 'text-emerald-700 dark:text-emerald-400 font-bold',
      messageColor: 'text-slate-800 dark:text-slate-200 font-medium',
    };
  }

  // default / info / other
  return {
    cardClass: isRead
      ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-slate-100 dark:border-slate-800/50 bg-transparent opacity-80'
      : 'bg-cyan-50/70 border-cyan-200 dark:bg-cyan-950/30 dark:border-cyan-900/50 border-l-4 border-l-cyan-500',
    iconContainer: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400',
    titleColor: 'text-cyan-700 dark:text-cyan-400 font-bold',
    messageColor: 'text-slate-800 dark:text-slate-200 font-medium',
  };
};

const SkeletonRow = () => (
  <div className="p-4 flex gap-3 animate-pulse border-b border-slate-100 dark:border-slate-800/50">
    <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
      <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-5/6" />
      <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
    </div>
  </div>
);

export const NotificationsDropdown = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'unread'
  const dropdownRef = useRef(null);

  const {
    notifications,
    unreadCount,
    loading,
    error,
    isLiveConnected,
    shouldShake,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  } = useNotifications();

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

  const displayedNotifications = activeTab === 'unread'
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            refreshNotifications(false);
          }
        }}
        aria-label={`Notifications, ${unreadCount} unread`}
        className={`relative p-2.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50/50 dark:hover:bg-cyan-950/20 active:scale-[0.96] hover:scale-[1.03] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 border border-transparent ${
          shouldShake ? 'animate-bell-shake' : ''
        }`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-5 h-5 px-1 bg-red-500 text-white text-[10px] font-extrabold rounded-full border-2 border-white dark:border-slate-950 shadow-md animate-[fadeIn_0.2s_ease-out]">
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
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute -right-12 sm:right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-[380px] sm:w-[410px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/40">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                  Notifications
                </h3>
                {isLiveConnected ? (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500">
                    Syncing
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 flex items-center gap-1 transition-colors focus:outline-none"
                >
                  <Check size={13} /> Mark all read
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-4 pt-2 bg-slate-50/40 dark:bg-slate-950/20">
              <button
                onClick={() => setActiveTab('all')}
                className={`pb-2 text-xs font-bold transition-all border-b-2 mr-4 ${
                  activeTab === 'all'
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setActiveTab('unread')}
                className={`pb-2 text-xs font-bold transition-all border-b-2 ${
                  activeTab === 'unread'
                    ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {/* Body List */}
            <div className="max-h-[420px] overflow-y-auto">
              {loading && notifications.length === 0 ? (
                <div>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              ) : error ? (
                <div className="p-10 text-center flex flex-col items-center justify-center space-y-3">
                  <AlertTriangle className="h-6 w-6 text-amber-500 animate-bounce" />
                  <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">{error}</p>
                  <button
                    onClick={() => refreshNotifications(true)}
                    className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 focus:outline-none"
                  >
                    <RefreshCw size={12} /> Retry
                  </button>
                </div>
              ) : displayedNotifications.length === 0 ? (
                <div className="p-12 text-center flex flex-col items-center justify-center space-y-2 animate-[fadeIn_0.2s_ease-out]">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-1">
                    <Bell size={22} />
                  </div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {activeTab === 'unread' ? 'No unread notifications' : "You're all caught up!"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activeTab === 'unread'
                      ? 'All current alerts have been marked as read.'
                      : 'New portfolio, goal, and KYC alerts will appear here.'}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800/50">
                  {displayedNotifications.map((notification) => {
                    const Icon = getNotificationIcon(notification.type);
                    const styles = getNotificationStyles(notification.severity, notification.is_read);

                    return (
                      <div
                        key={notification.id}
                        className={`p-3.5 flex gap-3 transition-colors duration-150 relative group ${styles.cardClass}`}
                      >
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${styles.iconContainer}`}
                        >
                          <Icon size={16} />
                        </div>
                        <div
                          className="space-y-1 flex-1 min-w-0 cursor-pointer"
                          onClick={() => {
                            if (!notification.is_read) {
                              markAsRead(notification.id);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className={`text-xs ${styles.titleColor}`}>{notification.title}</p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {!notification.is_read && (
                                <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-sm shadow-cyan-500/50" />
                              )}
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                                {formatRelativeTime(notification.created_at)}
                              </span>
                            </div>
                          </div>
                          <p className={`text-xs leading-relaxed ${styles.messageColor}`}>
                            {notification.message}
                          </p>
                        </div>

                        {/* Actions on hover */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0 self-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
                            title="Delete alert"
                            className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Dropdown Footer */}
            <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-center">
              <button
                onClick={() => {
                  setIsOpen(false);
                  navigate('/notifications');
                }}
                className="w-full py-1.5 px-3 rounded-xl text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:bg-cyan-50/60 dark:hover:bg-cyan-950/30 transition-all flex items-center justify-center gap-1.5 focus:outline-none"
              >
                <span>View All Notifications Page</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
