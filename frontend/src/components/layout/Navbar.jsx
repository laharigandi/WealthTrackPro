import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, TrendingUp, ShieldCheck, Target, Plus, Bell, ChevronDown, User, Activity, Clock, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { NotificationsDropdown } from '../NotificationsDropdown';

// Decode JWT payload without external libraries
const decodeToken = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
};

export const Navbar = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(null);
  const warningTimer = useRef(null);
  const countdownTimer = useRef(null);

  // Session expiry detection
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('access_token');
    if (!token) return;
    const payload = decodeToken(token);
    if (!payload?.exp) return;

    const expiresInMs = payload.exp * 1000 - Date.now();
    const warnAtMs = expiresInMs - 2 * 60 * 1000; // 2 min before expiry

    if (warnAtMs > 0) {
      warningTimer.current = setTimeout(() => {
        setSessionWarning(true);
        setSessionSecondsLeft(120);
        countdownTimer.current = setInterval(() => {
          setSessionSecondsLeft((s) => {
            if (s <= 1) {
              clearInterval(countdownTimer.current);
              return 0;
            }
            return s - 1;
          });
        }, 1000);
      }, warnAtMs);
    }

    return () => {
      clearTimeout(warningTimer.current);
      clearInterval(countdownTimer.current);
    };
  }, [user]);

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'W';

  const riskColorMap = {
    conservative: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/20',
    moderate:     'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-500/20',
    aggressive:   'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-500/20',
  };

  const riskProfile = user?.risk_profile ? user.risk_profile.toLowerCase() : 'moderate';
  const riskBadgeClass = riskColorMap[riskProfile] || riskColorMap.moderate;

  return (
    <>
      {/* Session Expiry Warning Toast */}
      {sessionWarning && sessionSecondsLeft !== null && sessionSecondsLeft > 0 && (
        <div className="fixed top-20 right-4 z-50 max-w-xs animate-slide-in-right">
          <div className="card p-4 border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-950/40 shadow-xl shadow-black/20 space-y-2">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <Clock size={16} />
              <p className="text-sm font-bold">Session Expiring Soon</p>
              <button onClick={() => setSessionWarning(false)} className="ml-auto text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300">×</button>
            </div>
            <p className="text-xs text-amber-800 dark:text-amber-300/80">
              Your session expires in <strong className="text-amber-950 dark:text-amber-300">{Math.floor(sessionSecondsLeft / 60)}:{String(sessionSecondsLeft % 60).padStart(2, '0')}</strong>. Save your work.
            </p>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="w-full text-xs font-bold py-1.5 px-3 rounded-lg bg-amber-200 dark:bg-amber-500/20 text-amber-950 dark:text-amber-300 hover:bg-amber-300 dark:hover:bg-amber-500/30 transition-colors"
            >
              Sign In Again
            </button>
          </div>
        </div>
      )}

      <header className="h-16 bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200/60 dark:border-slate-800 text-slate-900 dark:text-slate-100 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30 shadow-sm">

      {/* Brand Logo */}
      <Link to="/" className="flex items-center gap-3 group">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 via-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/25 group-hover:scale-105 transition-transform duration-200">
          <TrendingUp size={20} className="text-white dark:text-slate-950 stroke-[2.5]" />
        </div>
        <div>
          <span className="font-extrabold text-base text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
            WealthTrack <span className="text-xs uppercase font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-200 dark:border-cyan-500/20">Pro</span>
          </span>
        </div>
      </Link>

      {/* Top Header Controls */}
      {user && (
        <div className="flex items-center gap-3">
          {/* Risk Profile & KYC Badges (Hidden on tiny screens) */}
          <div className="hidden md:flex items-center gap-2">
            <span className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${riskBadgeClass}`}>
              <Activity size={12} />
              {user.risk_profile || 'Moderate Risk'}
            </span>

            <span
              className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                user.kyc_status === 'verified'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/20'
                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/20'
              }`}
            >
              <ShieldCheck size={12} />
              {user.kyc_status === 'verified' ? 'KYC Verified' : 'KYC Pending'}
            </span>
          </div>

          {/* Quick Action Shortcuts */}
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <button
              onClick={() => navigate('/goals')}
              className="px-3 py-1.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/20 hover:bg-cyan-100 dark:hover:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20 text-base font-semibold flex items-center gap-1.5 transition-all"
            >
              <Plus size={14} /> Goal
            </button>
            <button
              onClick={() => navigate('/portfolio')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-base font-semibold flex items-center gap-1.5 transition-all"
            >
              <Plus size={14} /> Asset
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-2 focus:ring-cyan-500/40 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 transition-colors border border-transparent"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* Notifications */}
          <NotificationsDropdown />

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors group border border-transparent hover:border-slate-200 dark:hover:border-slate-700/80"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center text-sm font-bold text-cyan-600 dark:text-cyan-300">
                {initials}
              </div>              <div className="text-left hidden sm:block">
                <p className="text-base font-bold text-slate-900 dark:text-slate-200 group-hover:text-cyan-700 dark:group-hover:text-cyan-400 transition-colors">
                  {user.name}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 truncate max-w-[120px]">{user.email}</p>
              </div>
              <ChevronDown size={14} className="text-slate-600 dark:text-slate-400 group-hover:text-slate-800 dark:text-slate-200 transition-transform" />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div
                className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-2 space-y-1 shadow-xl z-50 animate-slide-up"
                onMouseLeave={() => setShowUserMenu(false)}
              >
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800">
                  <p className="text-base font-bold text-slate-900 dark:text-slate-200">{user.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>

                <Link
                  to="/profile"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-base font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-cyan-700 dark:hover:text-cyan-400 transition-colors"
                >
                  <User size={14} /> Profile & Settings
                </Link>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-base font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors text-left"
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
    </>
  );
};
