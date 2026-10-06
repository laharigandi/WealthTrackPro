import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, TrendingUp, ShieldCheck, Target, Plus, Bell, ChevronDown, User, Activity, Clock, Sun, Moon, Search, Briefcase, Sparkles, Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { NotificationsDropdown } from '../NotificationsDropdown';
import { getGoals } from '../../services/goalService';
import { getPortfolio } from '../../services/portfolioService';

// Decode JWT payload without external libraries
const decodeToken = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
};

export const Navbar = ({ isMobileMenuOpen, onToggleMobileMenu }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState(null);
  const warningTimer = useRef(null);
  const countdownTimer = useRef(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [goals, setGoals] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef(null);

  const navigationItems = [
    { title: 'Financial Goals', category: 'Pages', path: '/goals', keywords: ['goals', 'track', 'target', 'savings'] },
    { title: 'Portfolio Holdings', category: 'Pages', path: '/portfolio', keywords: ['portfolio', 'holdings', 'assets', 'stocks', 'equity'] },
    { title: 'Financial Calculators', category: 'Pages', path: '/calculators', keywords: ['calculators', 'sip', 'tax', 'inflation'] },
    { title: 'Market Data & AI', category: 'Pages', path: '/market', keywords: ['market', 'prices', 'watchlist', 'yfinance'] },
    { title: 'Transactions', category: 'Pages', path: '/transactions', keywords: ['transactions', 'history', 'statement'] },
    { title: 'Profile & Risk (KYC)', category: 'Pages', path: '/profile', keywords: ['profile', 'kyc', 'risk', 'moderate'] },
    { title: 'Notifications & Alerts', category: 'Pages', path: '/notifications', keywords: ['notifications', 'alerts', 'realtime', 'sse', 'updates'] },
  ];

  const handleSearchFocus = async () => {
    if (searchTerm.length > 0) {
      setIsSearchOpen(true);
    }
    if (!user) return;
    try {
      const [goalsData, portfolioData] = await Promise.all([
        getGoals().catch(() => []),
        getPortfolio().catch(() => []),
      ]);
      setGoals(goalsData || []);
      setPortfolio(portfolioData || []);
    } catch (err) {
      console.error("Error prefetching search data:", err);
    }
  };

  useEffect(() => {
    if (searchTerm && goals.length === 0 && portfolio.length === 0 && user) {
      getGoals().then(setGoals).catch(() => []);
      getPortfolio().then(setPortfolio).catch(() => []);
    }
  }, [searchTerm, user]);

  // Click away listener to close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const query = searchTerm.toLowerCase().trim();

  const matchedNavigation = query ? navigationItems.filter(item =>
    item.title.toLowerCase().includes(query) ||
    item.category.toLowerCase().includes(query) ||
    item.keywords.some(kw => kw.toLowerCase().includes(query))
  ) : [];

  const matchedPortfolio = query ? portfolio.filter(item =>
    (item.asset_name && item.asset_name.toLowerCase().includes(query)) ||
    (item.symbol && item.symbol.toLowerCase().includes(query)) ||
    (item.asset_type && item.asset_type.toLowerCase().includes(query))
  ).map(item => ({
    title: item.asset_name,
    symbol: item.symbol,
    category: item.asset_type,
    path: '/portfolio',
    id: item.id
  })) : [];

  const matchedGoals = query ? goals.filter(goal =>
    (goal.title && goal.title.toLowerCase().includes(query)) ||
    (goal.category && goal.category.toLowerCase().includes(query))
  ).map(goal => ({
    title: goal.title,
    category: goal.category,
    path: '/goals',
    id: goal.id
  })) : [];

  const totalResults = matchedNavigation.length + matchedPortfolio.length + matchedGoals.length;

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
    conservative: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-450 dark:border-emerald-800',
    moderate:     'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-350 dark:border-indigo-800',
    aggressive:   'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-455 dark:border-rose-800',
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
      <header className="h-16 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 flex items-center justify-between px-3 sm:px-4 lg:px-8 sticky top-0 z-30 shadow-sm">

      {/* Left: Mobile Drawer Trigger + Brand Logo */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        {user && (
          <button
            onClick={onToggleMobileMenu}
            aria-label="Toggle navigation menu"
            className="p-2 -ml-1.5 rounded-xl text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 md:hidden transition-colors"
          >
            {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        )}

        <Link to="/dashboard" className="flex items-center gap-2.5 group active:scale-[0.98] transition-transform">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-cyan-400 via-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/25 group-hover:scale-105 transition-transform duration-200 shrink-0">
            <TrendingUp size={18} className="text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-1.5">
              WealthTrack <span className="text-[10px] sm:text-xs uppercase font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-200 dark:border-cyan-500/20">Pro</span>
            </span>
          </div>
        </Link>
      </div>

      {/* Global Search Bar (Tablet / Desktop) */}
      {user && (
        <div ref={searchContainerRef} className="relative ml-auto mr-2 sm:mr-3 w-44 sm:w-60 md:w-72 lg:w-80 hidden sm:block">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search goals, assets..."
              value={searchTerm}
              onChange={(e) => {
                const val = e.target.value;
                setSearchTerm(val);
                setIsSearchOpen(val.length > 0);
              }}
              onFocus={handleSearchFocus}
              className="w-full pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm transition-all outline-none bg-slate-100 text-slate-900 border border-slate-200 focus:bg-white focus:ring-2 focus:ring-indigo-500 dark:bg-slate-800/80 dark:text-slate-100 dark:border-slate-700 dark:focus:bg-slate-800"
            />
          </div>

          {/* Search Dropdown Overlay */}
          {isSearchOpen && searchTerm.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 shadow-2xl rounded-xl border border-slate-200 dark:border-slate-800 z-50 overflow-hidden max-h-96 overflow-y-auto animate-dropdown">
              {totalResults > 0 ? (
                <div className="p-2 space-y-3">
                  {/* NAVIGATION Section */}
                  {matchedNavigation.length > 0 && (
                    <div>
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        NAVIGATION
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {matchedNavigation.map((item, idx) => (
                          <button
                            key={`nav-${idx}`}
                            onClick={() => {
                              navigate(item.path);
                              setSearchTerm('');
                              setIsSearchOpen(false);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left font-medium"
                          >
                            <Sparkles size={14} className="text-slate-400" />
                            <span>{item.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* PORTFOLIO Section */}
                  {matchedPortfolio.length > 0 && (
                    <div>
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        PORTFOLIO
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {matchedPortfolio.slice(0, 4).map((item, idx) => (
                          <button
                            key={`port-${item.id || idx}`}
                            onClick={() => {
                              navigate(item.path);
                              setSearchTerm('');
                              setIsSearchOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left font-medium"
                          >
                            <div className="flex items-center gap-2.5">
                              <Briefcase size={14} className="text-slate-400" />
                              <div>
                                <span>{item.title}</span>
                                {item.symbol && (
                                  <span className="ml-1.5 text-xs text-slate-400 uppercase font-mono">
                                    ({item.symbol})
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              {item.category}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* GOALS Section */}
                  {matchedGoals.length > 0 && (
                    <div>
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        GOALS
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {matchedGoals.slice(0, 4).map((item, idx) => (
                          <button
                            key={`goal-${item.id || idx}`}
                            onClick={() => {
                              navigate(item.path);
                              setSearchTerm('');
                              setIsSearchOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-left font-medium"
                          >
                            <div className="flex items-center gap-2.5">
                              <Target size={14} className="text-slate-400" />
                              <span>{item.title}</span>
                            </div>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              {item.category}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
                  No results found for "<span className="font-semibold text-slate-800 dark:text-slate-200">{searchTerm}</span>"
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Top Header Controls */}
      {user && (
        <div className="flex items-center gap-1.5 sm:gap-2.5 ml-auto sm:ml-0">
          {/* Risk Profile & KYC Badges (Hidden on mobile/tablet screens) */}
          <div className="hidden lg:flex items-center gap-2">
            <span className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${riskBadgeClass}`}>
              <Activity size={12} />
              {user.risk_profile || 'Moderate Risk'}
            </span>

            <span
              className={`text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border flex items-center gap-1.5 ${
                user.kyc_status === 'verified'
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-450 dark:border-emerald-800'
                  : user.kyc_status === 'rejected'
                  ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                  : 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-955/40 dark:text-amber-300 dark:border-amber-700'
              }`}
            >
              <ShieldCheck size={12} />
              {user.kyc_status === 'verified' ? 'KYC Verified' : user.kyc_status === 'rejected' ? 'KYC Rejected' : 'KYC Pending'}
            </span>
          </div>

          {/* Quick Action Shortcuts (Desktop) */}
          <div className="hidden xl:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
            <button
              onClick={() => navigate('/goals')}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white font-semibold shadow-sm text-xs flex items-center gap-1.5 transition-all active:scale-95 duration-150 border-0"
            >
              <Plus size={13} /> Goal
            </button>
            <button
              onClick={() => navigate('/portfolio')}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 duration-150 shadow-sm"
            >
              <Plus size={13} /> Asset
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-2 focus:ring-cyan-500/40 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 transition-all border border-transparent active:scale-95 duration-150"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Notifications */}
          <NotificationsDropdown />

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              aria-label="User profile menu"
              className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all group border border-transparent hover:border-slate-200 dark:hover:border-slate-700/80 active:scale-[0.97]"
            >
              <div className="w-8 h-8 rounded-xl bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-300 font-bold border border-cyan-300 dark:border-cyan-700 flex items-center justify-center text-xs">
                {initials}
              </div>
              <div className="text-left hidden md:block">
                <h4 className="text-slate-900 dark:text-slate-100 font-semibold text-xs leading-tight truncate max-w-[100px]">
                  {user.name}
                </h4>
              </div>
              <ChevronDown size={13} className="text-slate-500 dark:text-slate-400 transition-transform" />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div
                className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-xl border border-slate-200/50 dark:border-slate-700/80 p-2 space-y-1 shadow-2xl z-50 animate-dropdown"
                onMouseLeave={() => setShowUserMenu(false)}
              >
                <div className="px-3 py-2 border-b border-slate-200/50 dark:border-slate-800/80">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-200 truncate">{user.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>

                <Link
                  to="/profile"
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-cyan-700 dark:hover:text-cyan-400 transition-colors"
                >
                  <User size={14} /> Profile & Settings
                </Link>

                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                    navigate('/login');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors text-left"
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
;
