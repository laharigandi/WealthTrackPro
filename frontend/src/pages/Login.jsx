import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Mail, Lock, TrendingUp, Eye, EyeOff, Sparkles,
  ArrowRight, CheckCircle2, AlertCircle, ShieldCheck,
  Sun, Moon, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { LoginVisualCard } from '../components/auth/LoginVisualCard';

/* ======================================================================
   OFFICIAL GOOGLE SVG ICON
====================================================================== */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className="shrink-0">
    <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
    <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
    <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957273C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957273 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
    <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
  </svg>
);

export const Login = () => {
  const [form, setForm]                 = useState({ email: '', password: '' });
  const [fieldErrors, setFieldErrors]   = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe]     = useState(false);
  const [error, setError]               = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, user, token } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate       = useNavigate();
  const location       = useLocation();

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    const hasToken = token || localStorage.getItem('access_token');
    if (hasToken || user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, token, navigate]);

  // Handle success message from location state with auto-dismiss and history clean-up
  useEffect(() => {
    if (location.state?.message) {
      setSuccessMessage(location.state.message);
      window.history.replaceState({}, document.title);
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  // Parse error / message query parameters on load
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const errParam = params.get('error') || params.get('error_description');
    const msgParam = params.get('message');
    if (errParam) {
      setError(errParam);
    } else if (msgParam) {
      setError('');
      setSuccessMessage(msgParam);
      const timer = setTimeout(() => {
        setSuccessMessage('');
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [location.search]);

  const validateField = (field, value) => {
    let err = '';
    if (field === 'email') {
      if (!value.trim()) {
        err = 'Email address is required.';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
        err = 'Please enter a valid email address.';
      }
    } else if (field === 'password') {
      if (!value) {
        err = 'Password is required.';
      }
    }
    setFieldErrors(prev => ({ ...prev, [field]: err }));
    return !err;
  };

  const handleChange = (field) => (e) => {
    const val = e.target.value;
    setForm((f) => ({ ...f, [field]: val }));
    if (fieldErrors[field]) {
      validateField(field, val);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const emailValid = validateField('email', form.email);
    const passwordValid = validateField('password', form.password);

    if (!emailValid || !passwordValid) {
      return;
    }

    setIsSubmitting(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail) && detail.length > 0) {
        setError(detail[0]?.msg || 'Validation failed. Please check your credentials.');
      } else {
        setError('Invalid email or password. Please verify your credentials.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleRedirectLogin = () => {
    setGoogleLoading(true);
    setError('');
    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/v1';
    window.location.href = `${BASE_URL}/auth/google/login`;
  };

  const fillDemo = () => {
    setForm({ email: 'john@example.com', password: 'password123' });
    setFieldErrors({ email: '', password: '' });
  };

  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen w-full flex flex-col bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100 font-sans selection:bg-sky-500/20 selection:text-sky-600 dark:selection:text-sky-300 relative overflow-x-hidden lg:overflow-hidden transition-colors duration-300">
      
      {/* Background Subtle Mesh & Ambient Glow */}
      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#38BDF8 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} 
      />
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/10 dark:bg-sky-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* ======================================================================
          COMPACT TOP HEADER (~52px)
      ====================================================================== */}
      <header className="relative z-20 w-full shrink-0 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/75 dark:bg-[#020617]/75 backdrop-blur-md px-4 sm:px-8 lg:px-12 py-2 sm:py-2.5 flex items-center justify-between transition-colors">
        
        {/* Brand Logo & Back to Home */}
        <Link 
          to="/" 
          id="login-brand-link"
          className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-sky-500/50 rounded-xl"
          aria-label="Back to WealthTrack Pro Home"
        >
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-br from-sky-400 via-cyan-500 to-emerald-500 flex items-center justify-center text-slate-950 shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform duration-200 shrink-0">
            <TrendingUp size={18} strokeWidth={2.4} />
          </div>
          <div className="flex flex-col">
            <div className="text-sm sm:text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 leading-tight">
              WEALTHTRACK <span className="text-sky-500 dark:text-sky-400">PRO</span>
            </div>
            <span className="text-[9.5px] text-slate-500 dark:text-slate-400 font-medium tracking-wide hidden sm:inline">
              Personal Wealth Intelligence
            </span>
          </div>
        </Link>

        {/* Top Right: Back to Home + Theme Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/"
            id="login-back-home-btn"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
          >
            <ArrowLeft size={13} />
            <span className="hidden sm:inline">Back to Home</span>
          </Link>

          <button
            onClick={toggleTheme}
            id="login-theme-toggle"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-750 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-sky-500/50 cursor-pointer"
          >
            {theme === 'dark' ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-slate-700" />}
          </button>
        </div>

      </header>

      {/* ======================================================================
          TWO-CARD AUTHENTICATION CONTAINER (SIDE-BY-SIDE ON DESKTOP)
      ====================================================================== */}
      <main className="relative z-10 flex-1 min-h-0 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-2 sm:py-3 lg:py-4 overflow-y-auto lg:overflow-hidden">
        
        {/* Balanced Two-Card Wrapper */}
        <div className="w-full max-w-[1180px] xl:max-w-[1240px] grid grid-cols-1 lg:grid-cols-12 gap-5 xl:gap-6 items-stretch my-auto animate-fade-in">
          
          {/* ==================================================================
              LEFT CARD (DESKTOP) / FIRST (MOBILE): LOGIN FORM CARD (~46% width on desktop)
          ================================================================== */}
          <div 
            id="login-form-card"
            className="order-1 lg:order-1 lg:col-span-6 xl:col-span-5 flex flex-col justify-center bg-white dark:bg-[#0F172A] border border-slate-200/90 dark:border-slate-800/90 rounded-2xl p-5 sm:p-6 xl:p-7 shadow-xl shadow-slate-900/5 dark:shadow-2xl dark:shadow-black/50 transition-all"
          >
            {/* Card Header */}
            <div className="mb-3.5 sm:mb-4 text-left">
              <h1 className="text-xl sm:text-2xl xl:text-[25px] font-black tracking-tight text-slate-900 dark:text-slate-50">
                Welcome back
              </h1>
              <p className="text-xs xl:text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">
                Sign in to continue to your WealthTrack Pro account.
              </p>
            </div>

            {/* Success Notification */}
            {successMessage && (
              <div className="flex items-start gap-2 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 text-xs font-medium mb-2.5 animate-fade-in">
                <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Error Notification */}
            {error && (
              <div className="flex items-start gap-2 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/50 text-xs font-medium mb-2.5 animate-fade-in">
                <AlertCircle size={14} className="text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Authentication Form */}
            <form onSubmit={handleSubmit} noValidate className="space-y-2.5 sm:space-y-3">
              
              {/* Email Address Field */}
              <div className="space-y-1 text-left">
                <label htmlFor="email" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <Mail size={16} />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="Enter your email"
                    value={form.email}
                    onChange={handleChange('email')}
                    className={`w-full h-10 pl-9 pr-3.5 rounded-xl border text-xs sm:text-sm font-medium transition-all bg-white dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none ${
                      fieldErrors.email
                        ? 'border-rose-300 dark:border-rose-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30'
                        : 'border-slate-300 dark:border-slate-700 focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500/30'
                    }`}
                  />
                </div>
                {fieldErrors.email && (
                  <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-0.5 pl-1">
                    {fieldErrors.email}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div className="space-y-1 text-left">
                <label htmlFor="password" className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                    <Lock size={16} />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={handleChange('password')}
                    className={`w-full h-10 pl-9 pr-10 rounded-xl border text-xs sm:text-sm font-medium transition-all bg-white dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none ${
                      fieldErrors.password
                        ? 'border-rose-300 dark:border-rose-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30'
                        : 'border-slate-300 dark:border-slate-700 focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500/30'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-0.5 pl-1">
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              {/* Remember Me / Forgot Password Row */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    id="remember-me"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sky-500 focus:ring-sky-500/40 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-[11.5px] font-medium text-slate-600 dark:text-slate-400">
                    Remember me
                  </span>
                </label>
                
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    setError('Password reset instructions have been dispatched to administrators.');
                  }}
                  className="text-[11.5px] font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
                >
                  Forgot password?
                </a>
              </div>

              {/* Sign In Primary CTA Button */}
              <button
                type="submit"
                id="login-submit-btn"
                disabled={isSubmitting}
                className="w-full h-10 sm:h-11 rounded-xl bg-sky-500 hover:bg-sky-400 dark:bg-sky-400 dark:hover:bg-sky-300 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-200 shadow-md shadow-sky-500/15 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none mt-1 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-slate-950" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight size={15} strokeWidth={2.5} />
                  </>
                )}
              </button>

            </form>

            {/* Divider */}
            <div className="flex items-center gap-2.5 my-2.5 sm:my-3">
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                OR CONTINUE WITH
              </span>
              <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            </div>

            {/* Google Login Button */}
            <button
              type="button"
              id="google-login-btn"
              onClick={handleGoogleRedirectLogin}
              disabled={googleLoading || isSubmitting}
              className="w-full h-10 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold flex items-center justify-center gap-2.5 transition-all duration-200 shadow-sm active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {googleLoading ? (
                <span className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
                  <svg className="animate-spin h-4 w-4 text-sky-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Connecting to Google...
                </span>
              ) : (
                <>
                  <GoogleIcon />
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {/* Card Footer: Registration Link & Demo Auto-Fill */}
            <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800/80 flex flex-col items-center gap-1.5">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Don&apos;t have an account?{' '}
                <Link 
                  to="/register" 
                  id="create-account-link"
                  className="font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
                >
                  Create account
                </Link>
              </p>

              <button
                type="button"
                id="autofill-demo-btn"
                onClick={fillDemo}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors py-0.5 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer"
              >
                <Sparkles size={11} className="text-sky-500" />
                <span>Auto-fill Demo Credentials</span>
              </button>
            </div>

          </div>

          {/* ==================================================================
              RIGHT CARD (DESKTOP) / SECOND (MOBILE): WEALTHTRACK PRO VISUAL CARD (~54% width on desktop)
          ================================================================== */}
          <div className="order-2 lg:order-2 lg:col-span-6 xl:col-span-7 flex">
            <LoginVisualCard />
          </div>

        </div>

        {/* Trust / Security Note */}
        <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          <ShieldCheck size={13} className="text-emerald-500/80 shrink-0" />
          <span>Secure 256-bit encrypted authentication</span>
        </div>

      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full shrink-0 border-t border-slate-200/60 dark:border-slate-800/60 px-4 py-1.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
        &copy; {new Date().getFullYear()} WealthTrack Pro. Bank-Grade Security.
      </footer>

    </div>
  );
};
