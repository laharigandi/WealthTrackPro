import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Target, Briefcase, TrendingUp,
  ShieldAlert, ArrowLeftRight, Sparkles, MoreHorizontal, X, Bell,
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

export const Sidebar = ({ isMobileMenuOpen, onClose }) => {
  const { unreadCount } = useNotifications();

  const navItems = [
    { name: 'Dashboard',             path: '/dashboard',     icon: LayoutDashboard, badge: null },
    { name: 'Financial Goals',       path: '/goals',         icon: Target,          badge: 'Track' },
    { name: 'Portfolio Holdings',    path: '/portfolio',     icon: Briefcase,       badge: null },
    { name: 'Financial Calculators', path: '/calculators',   icon: MoreHorizontal,  badge: 'New' },
    { name: 'Market Data & AI',      path: '/market',        icon: TrendingUp,      badge: 'Live' },
    { name: 'Transactions',          path: '/transactions',  icon: ArrowLeftRight,  badge: null },
    { name: 'Notifications',         path: '/notifications', icon: Bell,            badge: unreadCount > 0 ? `${unreadCount}` : null, isAlertBadge: unreadCount > 0 },
    { name: 'Profile & Risk',        path: '/profile',       icon: ShieldAlert,     badge: 'KYC' },
  ];

  // Prevent background scrolling when mobile drawer is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  return (
    <>
      {/* ── 1. Desktop Full Sidebar (lg: 1024px+) ──────────────────────── */}
      <aside className="hidden lg:flex w-64 shrink-0 bg-gradient-to-b from-cyan-50/70 via-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-r border-slate-200 dark:border-slate-800 flex-col p-4 gap-1.5 min-h-[calc(100vh-4rem)]">
        <div className="px-3 pt-2 pb-2 flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Main Navigation</p>
          <Sparkles size={13} className="text-cyan-500 dark:text-cyan-400 opacity-60" />
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map(({ name, path, icon: Icon, badge, isAlertBadge }) => (
            <NavLink
              key={name}
              to={path}
              end={path === '/dashboard'}
              className={({ isActive }) =>
                `relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm transition-all duration-200 group border ${
                  isActive
                    ? 'nav-item-active shadow-sm font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-cyan-500/[0.08] hover:text-cyan-700 dark:hover:bg-slate-800/80 dark:hover:text-slate-100 border-transparent font-medium'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full bg-cyan-500 dark:bg-cyan-400" />
                  )}
                  <div className="flex items-center gap-3 transition-transform duration-200 group-hover:translate-x-1">
                    <Icon 
                      size={18} 
                      className={`group-hover:scale-110 transition-transform duration-200 ${
                        isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-400'
                      }`} 
                    />
                    <span>{name}</span>
                  </div>
                  {badge && (
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md transition-all duration-200 ${
                      isAlertBadge
                        ? 'bg-red-500 text-white shadow-sm shadow-red-500/30'
                        : badge === 'Live' || badge === 'KYC'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-cyan-50 text-cyan-700 border border-cyan-100 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800'
                    }`}>
                      {badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="mt-auto p-4 rounded-2xl bg-cyan-50/40 dark:bg-slate-950/40 border border-cyan-100 dark:border-cyan-500/20 space-y-2">
          <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles size={14} /> AI Portfolio Advisor
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Real-time asset rebalancing recommendations on your dashboard.
          </p>
        </div>
      </aside>

      {/* ── 2. Tablet Collapsed Sidebar (md to lg: 768px - 1023px) ────── */}
      <aside className="hidden md:flex lg:hidden w-20 shrink-0 bg-gradient-to-b from-cyan-50/70 via-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-r border-slate-200 dark:border-slate-800 flex-col items-center py-4 px-2 gap-2 min-h-[calc(100vh-4rem)]">
        {navItems.map(({ name, path, icon: Icon, badge, isAlertBadge }) => (
          <NavLink
            key={name}
            to={path}
            end={path === '/dashboard'}
            title={name}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-200 group border ${
                isActive
                  ? 'nav-item-active text-cyan-600 dark:text-cyan-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/80 border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={20} className="group-hover:scale-110 transition-transform duration-200" />
                <span className="text-[9px] font-bold mt-1 truncate max-w-[50px] leading-tight text-center">
                  {name.split(' ')[0]}
                </span>
                {badge && (
                  <span className={`absolute top-1 right-1 w-2.5 h-2.5 rounded-full ${isAlertBadge ? 'bg-red-500 ring-2 ring-white dark:ring-slate-900' : 'bg-cyan-500'}`} />
                )}
              </>
            )}
          </NavLink>
        ))}
      </aside>

      {/* ── 3. Mobile Off-Canvas Drawer (<768px) ────────────────────────── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ease-out"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative w-72 max-w-[85vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col p-4 z-10 animate-slide-in-right h-full overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-4 mb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center text-slate-950 font-black text-sm shadow-md">
                  W
                </div>
                <div>
                  <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                    WealthTrack <span className="text-[10px] uppercase font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-1 py-0.5 rounded border border-cyan-200 dark:border-cyan-500/20">Pro</span>
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                aria-label="Close navigation"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Nav Items */}
            <nav className="flex flex-col gap-1.5 py-2 flex-1">
              {navItems.map(({ name, path, icon: Icon, badge, isAlertBadge }) => (
                <NavLink
                  key={name}
                  to={path}
                  end={path === '/dashboard'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3.5 py-3 rounded-xl text-base font-semibold transition-all duration-200 border ${
                      isActive
                        ? 'nav-item-active text-cyan-700 dark:text-cyan-300 font-bold shadow-sm'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80 border-transparent'
                    }`
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} className="shrink-0" />
                    <span>{name}</span>
                  </div>
                  {badge && (
                    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      isAlertBadge
                        ? 'bg-red-500 text-white'
                        : badge === 'Live' || badge === 'KYC'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                        : 'bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800'
                    }`}>
                      {badge}
                    </span>
                  )}
                </NavLink>
              ))}
            </nav>

            {/* Mobile Drawer Footer */}
            <div className="mt-auto p-4 rounded-2xl bg-cyan-50/40 dark:bg-slate-950/60 border border-cyan-100 dark:border-cyan-500/20 space-y-1.5">
              <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400 text-xs font-bold">
                <Sparkles size={14} /> AI Portfolio Advisor
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Smart financial tracking & asset rebalancing algorithms.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
