import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCircle2,
  AlertTriangle,
  Target,
  Shield,
  Trash2,
  Sparkles,
  TrendingDown,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  Zap,
  Activity,
  CheckCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '../components/common/PageTransition';
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
const getSeverityTheme = (severity, isRead) => {
  if (severity === 'critical') {
    return {
      cardClass: isRead
        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 opacity-80'
        : 'bg-red-50/70 border-red-200 dark:bg-red-950/30 dark:border-red-900/60 border-l-4 border-l-red-500 shadow-sm',
      iconContainer: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
      badge: 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60',
      titleColor: 'text-red-700 dark:text-red-400 font-bold',
      messageColor: 'text-slate-800 dark:text-slate-200 font-medium',
    };
  }

  if (severity === 'warning') {
    return {
      cardClass: isRead
        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 opacity-80'
        : 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/60 border-l-4 border-l-amber-500 shadow-sm',
      iconContainer: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
      badge: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
      titleColor: 'text-amber-700 dark:text-amber-400 font-bold',
      messageColor: 'text-slate-800 dark:text-slate-200 font-medium',
    };
  }

  if (severity === 'success') {
    return {
      cardClass: isRead
        ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 opacity-80'
        : 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/60 border-l-4 border-l-emerald-500 shadow-sm',
      iconContainer: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
      badge: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
      titleColor: 'text-emerald-700 dark:text-emerald-400 font-bold',
      messageColor: 'text-slate-800 dark:text-slate-200 font-medium',
    };
  }

  // default / info / other
  return {
    cardClass: isRead
      ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40 border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 opacity-80'
      : 'bg-cyan-50/70 border-cyan-200 dark:bg-cyan-950/30 dark:border-cyan-900/50 border-l-4 border-l-cyan-500 shadow-sm',
    iconContainer: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400',
    badge: 'bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/60',
    titleColor: 'text-cyan-700 dark:text-cyan-400 font-bold',
    messageColor: 'text-slate-800 dark:text-slate-200 font-medium',
  };
};

const getTargetRoute = (notification) => {
  if (notification.type === 'goal_milestone' || notification.type === 'goal_completed' || notification.entity_type === 'goal') {
    return { path: '/goals', label: 'View Goals' };
  }
  if (notification.type === 'portfolio_risk' || notification.type === 'portfolio_pnl' || notification.type === 'portfolio_milestone' || notification.entity_type === 'portfolio') {
    return { path: '/portfolio', label: 'View Portfolio' };
  }
  if (notification.type === 'kyc_alert' || notification.type === 'security') {
    return { path: '/profile', label: 'View Profile' };
  }
  return null;
};

export const NotificationsPage = () => {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    loading,
    error,
    isLiveConnected,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refreshNotifications,
  } = useNotifications();

  const [filterTab, setFilterTab] = useState('all'); // all | unread | actions | milestones | security
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refreshNotifications(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const actionItemsCount = notifications.filter(
    (n) => n.severity === 'critical' || n.severity === 'warning'
  ).length;

  const milestonesCount = notifications.filter(
    (n) => n.type === 'goal_milestone' || n.type === 'goal_completed' || n.type === 'portfolio_milestone'
  ).length;

  const securityCount = notifications.filter((n) => n.type === 'security').length;

  const filteredNotifications = notifications.filter((n) => {
    // Filter by tab
    if (filterTab === 'unread' && n.is_read) return false;
    if (filterTab === 'actions' && n.severity !== 'critical' && n.severity !== 'warning') return false;
    if (filterTab === 'milestones' && !['goal_milestone', 'goal_completed', 'portfolio_milestone'].includes(n.type)) return false;
    if (filterTab === 'security' && n.type !== 'security') return false;

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = n.title?.toLowerCase().includes(q);
      const matchMsg = n.message?.toLowerCase().includes(q);
      const matchType = n.type?.toLowerCase().includes(q);
      if (!matchTitle && !matchMsg && !matchType) return false;
    }

    return true;
  });

  return (
    <PageTransition>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
                Notifications & Alerts
              </h1>
              {isLiveConnected ? (
                <span className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live Stream Active
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  Syncing
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Real-time updates on portfolio rebalancing, goal milestones, KYC status, and security.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center gap-2 active:scale-95 shadow-sm"
              title="Sync notifications now"
            >
              <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-cyan-600' : ''} />
              Sync
            </button>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 active:scale-95 shadow-md shadow-cyan-500/20"
              >
                <CheckCheck size={14} />
                Mark All Read
              </button>
            )}
          </div>
        </div>

        {/* ── Stat Summary Cards ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950/50 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Bell size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Alerts</p>
              <p className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{notifications.length}</p>
            </div>
          </div>

          <div className="card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
              <Activity size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Unread</p>
              <p className="text-xl font-extrabold text-red-600 dark:text-red-400">{unreadCount}</p>
            </div>
          </div>

          <div className="card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Actions Needed</p>
              <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{actionItemsCount}</p>
            </div>
          </div>

          <div className="card p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Milestones</p>
              <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{milestonesCount}</p>
            </div>
          </div>
        </div>

        {/* ── Filters & Search Bar ────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/60 max-w-fit">
            {[
              { id: 'all', label: 'All', count: notifications.length },
              { id: 'unread', label: 'Unread', count: unreadCount },
              { id: 'actions', label: 'Action Required', count: actionItemsCount },
              { id: 'milestones', label: 'Milestones', count: milestonesCount },
              { id: 'security', label: 'Security', count: securityCount },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  filterTab === tab.id
                    ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    filterTab === tab.id
                      ? 'bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-sm"
            />
          </div>
        </div>

        {/* ── Notifications List ─────────────────────────────────────────── */}
        <div className="space-y-3">
          {loading && notifications.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-5 rounded-2xl border border-slate-200 dark:border-slate-800 animate-pulse flex gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/4" />
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="card p-12 text-center flex flex-col items-center justify-center space-y-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                <Bell size={26} />
              </div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                {filterTab === 'unread' ? 'No unread notifications' : 'No notifications found'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                {searchQuery
                  ? `No notifications matched "${searchQuery}". Try a different keyword.`
                  : filterTab === 'unread'
                  ? 'All notifications have been read. Great job staying on top of your wealth portfolio!'
                  : 'New portfolio, goal milestone, and KYC updates will appear here automatically in real-time.'}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredNotifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                const theme = getSeverityTheme(notification.severity, notification.is_read);
                const target = getTargetRoute(notification);

                return (
                  <motion.div
                    key={notification.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group ${theme.cardClass}`}
                  >
                    <div className="flex items-start gap-3.5 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${theme.iconContainer}`}>
                        <Icon size={20} />
                      </div>

                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className={`text-sm ${theme.titleColor}`}>
                            {notification.title}
                          </h4>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${theme.badge}`}>
                            {notification.severity}
                          </span>
                          {!notification.is_read && (
                            <span className="flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-cyan-500 text-white shadow-sm shadow-cyan-500/30">
                              NEW
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium ml-auto sm:ml-0">
                            {formatRelativeTime(notification.created_at)}
                          </span>
                        </div>

                        <p className={`text-xs sm:text-sm leading-relaxed ${theme.messageColor}`}>
                          {notification.message}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {target && (
                        <button
                          onClick={() => {
                            if (!notification.is_read) {
                              markAsRead(notification.id);
                            }
                            navigate(target.path);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 text-xs font-bold transition flex items-center gap-1"
                        >
                          {target.label} <ArrowRight size={12} />
                        </button>
                      )}

                      {!notification.is_read ? (
                        <button
                          onClick={() => markAsRead(notification.id)}
                          className="px-3 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 text-xs font-bold transition flex items-center gap-1"
                          title="Mark as read"
                        >
                          <Check size={13} /> Read
                        </button>
                      ) : null}

                      <button
                        onClick={() => deleteNotification(notification.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                        title="Delete notification"
                        aria-label="Delete notification"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </PageTransition>
  );
};
