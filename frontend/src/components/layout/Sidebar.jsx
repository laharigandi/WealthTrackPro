import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Target, Briefcase, TrendingUp,
  ShieldAlert, ArrowLeftRight, Sparkles, MoreHorizontal,
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard',          path: '/',             icon: LayoutDashboard, badge: null },
  { name: 'Financial Goals',    path: '/goals',        icon: Target,          badge: 'Track' },
  { name: 'Portfolio Holdings', path: '/portfolio',    icon: Briefcase,       badge: null },
  { name: 'Financial Calculators',path: '/calculators',icon: MoreHorizontal,  badge: 'New' },
  { name: 'Market Data & AI',   path: '/market',       icon: TrendingUp,      badge: 'Live' },
  { name: 'Transactions',       path: '/transactions', icon: ArrowLeftRight,  badge: null },
  { name: 'Profile & Risk',     path: '/profile',      icon: ShieldAlert,     badge: 'KYC' },
];

// Desktop sidebar items
const SIDEBAR_ITEMS = NAV_ITEMS;

// Mobile bottom nav
const MOBILE_NAV = [
  { name: 'Dashboard', path: '/',          icon: LayoutDashboard },
  { name: 'Goals',     path: '/goals',     icon: Target },
  { name: 'Portfolio', path: '/portfolio', icon: Briefcase },
  { name: 'Calculators',path: '/calculators',icon: MoreHorizontal },
  { name: 'Market',    path: '/market',    icon: TrendingUp },
];

export const Sidebar = () => (
  <>
    {/* ── Desktop Sidebar ───────────────────────────────────── */}
    <aside className="sidebar-desktop w-64 shrink-0 bg-gradient-to-b from-cyan-50/70 via-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col p-4 gap-1.5 min-h-[calc(100vh-4rem)]">
      <div className="px-3 pt-2 pb-2 flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Main Navigation</p>
        <Sparkles size={13} className="text-cyan-500 dark:text-cyan-400 opacity-60" />
      </div>

      {SIDEBAR_ITEMS.map(({ name, path, icon: Icon, badge }) => (
        <NavLink
          key={name}
          to={path}
          end={path === '/'}
          className={({ isActive }) =>
            `relative flex items-center justify-between px-3.5 py-3 rounded-xl text-base transition-all duration-500 ease-in-out group border ${
              isActive
                ? 'nav-item-active shadow-sm font-semibold'
                : 'text-slate-700 dark:text-slate-300 hover:bg-cyan-500/[0.08] hover:text-cyan-700 dark:hover:bg-slate-800/80 dark:hover:text-slate-100 border-transparent font-medium'
            }`
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-full bg-cyan-500 dark:bg-cyan-400 transition-all duration-300 origin-center scale-y-100 opacity-100 animate-[fadeIn_0.2s_ease-out]" />
              )}
              <div className="flex items-center gap-3 transition-transform duration-200 group-hover:translate-x-1">
                <Icon 
                  size={18} 
                  className={`group-hover:scale-110 transition-transform duration-200 ${
                    isActive ? '' : 'text-slate-500 dark:text-slate-400'
                  }`} 
                />
                <span>{name}</span>
              </div>
              {badge && (
                <span className={`text-xs font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md transition-all duration-200 hover:shadow-sm ${
                  badge === 'Live' || badge === 'KYC'
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

      {/* Sidebar Footer */}
      <div className="mt-auto p-4 rounded-2xl bg-cyan-50/30 dark:bg-slate-950/40 border border-cyan-100 dark:border-cyan-500/20 space-y-2">
        <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-400 text-sm font-bold">
          <Sparkles size={14} /> AI Portfolio Advisor
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          Real-time asset rebalancing recommendations on your dashboard.
        </p>
      </div>
    </aside>

    {/* ── Mobile Bottom Navigation ─────────────────────────── */}
    <nav className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-around px-2 py-2 safe-area-bottom shadow-lg">
      {MOBILE_NAV.map(({ name, path, icon: Icon }) => (
        <NavLink
          key={name}
          to={path}
          end={path === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[52px] ${
              isActive
                ? 'text-cyan-600 dark:text-cyan-400'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${isActive ? 'bg-cyan-500/15 shadow-sm' : ''}`}>
                <Icon size={19} />
              </div>
              <span className="text-[10px] font-semibold tracking-wide">{name}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  </>
);
