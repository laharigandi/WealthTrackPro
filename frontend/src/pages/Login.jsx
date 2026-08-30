import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Mail, Lock, TrendingUp, Eye, EyeOff, Sparkles,
  ArrowRight, CheckCircle2, AlertCircle
} from 'lucide-react';
import { loginUser } from '../services/authService';
import { useAuth } from '../context/AuthContext';

/* ======================================================================
   GOOGLE SVG ICON
====================================================================== */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
    <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
    <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957273C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957273 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
    <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
  </svg>
);

export const Login = () => {
  const [form, setForm]                 = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe]     = useState(false);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login }      = useAuth();
  const navigate       = useNavigate();
  const location       = useLocation();
  const successMessage = location.state?.message || '';

  const handleChange = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await loginUser(form);
      await login(data);
      navigate('/dashboard');
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          'Invalid email or password. Please verify your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => setForm({ email: 'john@example.com', password: 'password123' });

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/v1';
    window.location.href = `${BASE_URL}/auth/google/login`;
  };

  return (
    <>
      <style>
        {`
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeInRight {
            from { opacity: 0; transform: translateX(12px); }
            to { opacity: 1; transform: translateX(0); }
          }
        `}
      </style>
      
      {/* WRAPPER */}
      <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 font-['Inter',sans-serif] relative flex flex-col justify-center overflow-x-hidden">
        
        {/* DECORATIVE BACKGROUND SHAPES */}
        <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-cyan-400/20 dark:bg-cyan-500/10 blur-[100px] pointer-events-none z-0" />
        <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-emerald-400/10 dark:bg-emerald-500/5 blur-[120px] pointer-events-none z-0" />

        {/* MAIN LAYOUT */}
        <div className="relative z-10 flex h-full w-full flex-col lg:flex-row min-h-screen">
          
          {/* ======================================================================
              LEFT SECTION: LOGIN CARD (40%)
          ====================================================================== */}
          <section className="relative z-20 flex min-h-screen w-full lg:w-[40%] shrink-0 items-center justify-center px-6 py-12 lg:px-8">
            
            <div 
              className="w-full max-w-[400px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-8 shadow-2xl backdrop-blur-2xl opacity-0 z-10"
              style={{ animation: 'fadeInUp 0.6s ease-out forwards' }}
            >
              
              {/* LOGO */}
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                  <TrendingUp size={20} className="text-white" strokeWidth={2.5} />
                </div>
                <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
                  WealthTrack Pro
                </span>
              </div>

              {/* WELCOME TITLE */}
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-1.5">
                  Welcome Back! 👋
                </h1>
                <p className="text-base text-slate-600 dark:text-slate-400">
                  Sign in to continue your financial journey.
                </p>
              </div>

              {/* SUCCESS MESSAGE */}
              {successMessage && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-250 dark:border-emerald-500/20 text-sm mb-4 font-semibold">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* ERROR MESSAGE */}
              {error && (
                <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 text-red-700 dark:bg-red-955/40 dark:text-red-405 border border-red-200 dark:border-red-900 text-sm mb-4 font-semibold">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                
                {/* EMAIL */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-base font-medium text-slate-700 dark:text-slate-300 ml-1">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="name@company.com"
                      value={form.email}
                      onChange={handleChange('email')}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-base rounded-xl h-12 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                  </div>
                </div>

                {/* PASSWORD */}
                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-base font-medium text-slate-700 dark:text-slate-300 ml-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••••"
                      value={form.password}
                      onChange={handleChange('password')}
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-base rounded-xl h-12 pl-11 pr-11 focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:focus:ring-cyan-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors p-1.5"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pb-1">
                  <label className="flex items-center gap-2 text-sm text-slate-605 dark:text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 cursor-pointer"
                    />
                    Remember Me
                  </label>
                  <a href="#" onClick={(e) => e.preventDefault()} className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">
                    Forgot Password?
                  </a>
                </div>

                {/* SIGN IN BUTTON */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 active:scale-[0.98] text-base font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-70 disabled:pointer-events-none shadow-lg shadow-cyan-500/20"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              {/* DIVIDER */}
              <div className="flex items-center gap-3 my-5">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap tracking-wider">
                  OR SIGN IN WITH
                </span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>

              {/* GOOGLE BUTTON */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading || loading}
                className="w-full h-12 rounded-xl border border-slate-350 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-70 disabled:pointer-events-none shadow-sm"
              >
                {googleLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-slate-550 dark:text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Connecting...
                  </>
                ) : (
                  <>
                    <GoogleIcon />
                    Continue with Google
                  </>
                )}
              </button>

              {/* FOOTER */}
              <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
                <p className="text-sm text-slate-650 dark:text-slate-400 mb-2.5">
                  Don&apos;t have an account?{' '}
                  <Link to="/register" className="font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors">
                    Create New Account
                  </Link>
                </p>
                
                <div className="flex items-center justify-center">
                  <button 
                    type="button" 
                    onClick={fillDemo} 
                    className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-350 transition-colors"
                  >
                    <Sparkles size={12} />
                    Auto-fill Demo
                  </button>
                </div>
              </div>

            </div>
          </section>

          {/* ======================================================================
              RIGHT SECTION: BRANDING / VISUALS (60%)
          ====================================================================== */}
          <section className="relative z-10 hidden lg:flex h-full w-[60%] min-h-screen shrink-0 items-center justify-center px-8 xl:px-12 bg-slate-100/30 dark:bg-slate-900/10">
            
            <div 
              className="flex h-full w-full max-w-6xl flex-col justify-center py-6 opacity-0"
              style={{ animation: 'fadeInRight 0.7s ease-out 0.1s forwards' }}
            >
              
              {/* PLATFORM BADGE */}
              <div className="mb-3">
                <div className="inline-flex rounded-full border border-cyan-500/20 dark:border-cyan-400/20 bg-cyan-500/10 px-3.5 py-1.5 text-xs font-bold tracking-widest text-cyan-700 dark:text-cyan-300 uppercase">
                  ● AI-Powered Wealth Advisory
                </div>
              </div>

              {/* TITLE */}
              <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight xl:text-5xl text-slate-900 dark:text-white">
                Personalized
                <br />
                <span className="bg-gradient-to-r from-cyan-500 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                  Wealth Management
                </span>
              </h1>

              {/* TAGLINE */}
              <p className="mt-2.5 max-w-xl text-base text-slate-650 dark:text-slate-400 leading-relaxed">
                Plan smarter. Invest better. Achieve your financial goals. Track goals, visualize equity allocations, and review rebalancing alerts instantly.
              </p>

              {/* CHART CARD CONTAINER */}
              <div className="relative mt-6 h-[230px] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 shadow-xl backdrop-blur-xl xl:h-[260px]">
                
                <div className="p-6 h-full flex flex-col justify-between">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-slate-500 dark:text-slate-450 uppercase tracking-wider mb-0.5">
                        Portfolio Performance
                      </h3>
                      <div className="flex items-baseline gap-3">
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">₹24,80,000</span>
                        <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-450">+18.42%</span>
                      </div>
                    </div>
                  </div>

                  {/* SVG Chart */}
                  <div className="flex-1 w-full relative mt-3 mb-1">
                    <svg viewBox="0 0 400 100" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                        </linearGradient>
                        <linearGradient id="line-gradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#06b6d4" />
                          <stop offset="100%" stopColor="#10b981" />
                        </linearGradient>
                      </defs>
                      
                      {/* Grid */}
                      <g stroke="currentColor" strokeOpacity="0.08" className="text-slate-400 dark:text-slate-650" strokeWidth="1">
                        <line x1="0" y1="20" x2="400" y2="20" />
                        <line x1="0" y1="50" x2="400" y2="50" />
                        <line x1="0" y1="80" x2="400" y2="80" />
                      </g>
                      
                      {/* Area */}
                      <path d="M0,80 C40,75 80,90 120,65 C160,40 200,60 240,45 C280,30 320,15 400,20 L400,100 L0,100 Z" fill="url(#chart-gradient)" />
                      
                      {/* Line */}
                      <path d="M0,80 C40,75 80,90 120,65 C160,40 200,60 240,45 C280,30 320,15 400,20" fill="none" stroke="url(#line-gradient)" strokeWidth="2.5" className="drop-shadow-[0_0_6px_rgba(16,185,129,0.3)]" />
                      
                      {/* Dot */}
                      <circle cx="400" cy="20" r="3" fill="#10b981" className="shadow-[0_0_8px_#10b981] animate-pulse" />
                    </svg>
                  </div>

                  {/* FLOATING AI INSIGHT */}
                  <div className="absolute right-6 bottom-6 flex flex-col bg-white/90 dark:bg-slate-950/80 border border-slate-205 dark:border-slate-800 rounded-xl py-2 px-3 z-20 backdrop-blur-md shadow-md animate-pulse">
                    <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 mb-0.5 flex items-center gap-1">
                      <Sparkles size={10} />
                      AI Insight
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Portfolio allocation aligned<br/>with your risk profile.
                    </span>
                  </div>

                </div>
              </div>

              {/* FEATURES GRID */}
              <div className="mt-5 grid w-full max-w-4xl grid-cols-4 gap-3.5">
                
                <div 
                  className="min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/40 p-4 shadow-sm dark:shadow-none backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/30 dark:hover:border-cyan-400/20"
                  style={{ animation: 'fadeInRight 0.7s ease-out 0.2s forwards', opacity: 0 }}
                >
                  <div className="text-xl mb-1">📈</div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">Smart Goals</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-2">
                    Set milestones, save regularly, and track completion progress.
                  </p>
                </div>

                <div 
                  className="min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/40 p-4 shadow-sm dark:shadow-none backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/30 dark:hover:border-cyan-400/20"
                  style={{ animation: 'fadeInRight 0.7s ease-out 0.3s forwards', opacity: 0 }}
                >
                  <div className="text-xl mb-1">📊</div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">Portfolio</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-2">
                    Calculate asset ratios and rebalance based on your risk profile.
                  </p>
                </div>

                <div 
                  className="min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/40 p-4 shadow-sm dark:shadow-none backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/30 dark:hover:border-cyan-400/20"
                  style={{ animation: 'fadeInRight 0.7s ease-out 0.4s forwards', opacity: 0 }}
                >
                  <div className="text-xl mb-1">◈</div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">AI Advisor</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-2">
                    Get rebalancing advice and asset breakdown alerts dynamically.
                  </p>
                </div>

                <div 
                  className="min-w-0 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/40 p-4 shadow-sm dark:shadow-none backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/30 dark:hover:border-cyan-400/20"
                  style={{ animation: 'fadeInRight 0.7s ease-out 0.5s forwards', opacity: 0 }}
                >
                  <div className="text-xl mb-1">🛡️</div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">Secure Session</h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400 line-clamp-2">
                    Enjoy secure active token-refresh session management.
                  </p>
                </div>

              </div>

            </div>
          </section>

        </div>
      </div>
    </>
  );
};
