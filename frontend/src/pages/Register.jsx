import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, TrendingUp, CheckCircle2, ArrowRight, Eye, EyeOff, X } from 'lucide-react';
import { registerUser, loginUser } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { Input } from '../components/common/Input';
import { Button } from '../components/common/Button';

// ─── Password strength checker ────────────────────────────────────────────────
const checkPassword = (pwd) => {
  const checks = {
    length:    { label: 'At least 8 characters',  pass: pwd.length >= 8 },
    uppercase: { label: 'One uppercase letter',    pass: /[A-Z]/.test(pwd) },
    lowercase: { label: 'One lowercase letter',    pass: /[a-z]/.test(pwd) },
    digit:     { label: 'One number',              pass: /[0-9]/.test(pwd) },
    special:   { label: 'One special character',   pass: /[!@#$%^&*()_+\-=\[\]{}|;':",.\/<>?]/.test(pwd) },
  };
  const score = Object.values(checks).filter((c) => c.pass).length;
  const strength =
    score <= 1 ? { label: 'Weak',    color: 'bg-rose-500',   width: '20%' } :
    score <= 2 ? { label: 'Fair',    color: 'bg-amber-500',  width: '40%' } :
    score <= 3 ? { label: 'Good',    color: 'bg-yellow-400', width: '60%' } :
    score <= 4 ? { label: 'Strong',  color: 'bg-cyan-400',   width: '80%' } :
                 { label: 'Excellent', color: 'bg-emerald-400', width: '100%' };
  return { checks, score, strength };
};

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17.64 9.20455C17.64 8.56636 17.5827 7.95273 17.4764 7.36364H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20455Z" fill="#4285F4"/>
    <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4205 9 14.4205C6.65591 14.4205 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z" fill="#34A853"/>
    <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59318 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95818H0.957273C0.347727 6.17318 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957273 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
    <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
  </svg>
);

export const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const pwdAnalysis = useMemo(() => form.password ? checkPassword(form.password) : null, [form.password]);

  const handleGoogleLogin = () => {
    setGoogleLoading(true);
    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/v1';
    window.location.href = `${BASE_URL}/auth/google/login`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Client-side password strength gate
    if (pwdAnalysis && pwdAnalysis.score < 5) {
      const failing = Object.values(pwdAnalysis.checks)
        .filter((c) => !c.pass)
        .map((c) => c.label);
      setError(`Password requirements not met: ${failing.join(', ')}.`);
      return;
    }

    setLoading(true);
    try {
      await registerUser(form);
      // Auto-login
      try {
        const tokens = await loginUser({ email: form.email, password: form.password });
        login(tokens);
        setSuccess('Account created successfully! Redirecting to your dashboard…');
        setTimeout(() => navigate('/'), 1200);
      } catch {
        navigate('/login', { state: { message: 'Account created! Please sign in.' } });
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed. Email may already be in use.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
      {/* Glow backgrounds */}
      <div className="absolute top-1/3 left-1/3 w-[600px] h-[500px] bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-violet-500/5 dark:bg-violet-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md animate-fade-in relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 via-cyan-500 to-emerald-500 flex items-center justify-center shadow-xl shadow-cyan-500/30 ring-1 ring-cyan-400/50">
            <TrendingUp size={24} className="text-slate-950 stroke-[2.5]" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">WealthTrack Pro</h1>
          <p className="text-sm text-slate-650 dark:text-slate-400">Join thousands of smart investors building wealth</p>
        </div>

        {/* Card */}
        <div className="card p-8 shadow-xl dark:shadow-2xl dark:shadow-black/80 border-slate-200 dark:border-slate-800 space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Create your account</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Set up your portfolio and start tracking goal milestones</p>
          </div>

          {success && (
            <div className="p-3 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-sm flex items-center gap-2 font-semibold">
              <CheckCircle2 size={14} className="shrink-0" /> {success}
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 rounded-xl text-sm flex items-start gap-2 font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0 mt-0.5 animate-pulse" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-600 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 transition-all focus:outline-none focus:ring-2 focus:ring-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-slate-600 border-t-cyan-500 animate-spin" />
                Connecting to Google...
              </span>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>
          
          <div className="flex items-center gap-4 my-2">
            <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Or sign up with email</span>
            <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              required
              placeholder="Alexander Wright"
              icon={User}
              value={form.name}
              onChange={handleChange('name')}
            />

            <Input
              label="Email Address"
              type="email"
              required
              placeholder="alex@wealthtrack.io"
              icon={Mail}
              value={form.email}
              onChange={handleChange('email')}
            />

            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="Minimum 8 characters"
              icon={Lock}
              value={form.password}
              onChange={handleChange('password')}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="hover:text-slate-800 dark:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />

            {/* Password Strength Indicator */}
            {form.password && pwdAnalysis && (
              <div className="space-y-2">
                {/* Strength bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-850 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${pwdAnalysis.strength.color}`}
                      style={{ width: pwdAnalysis.strength.width }}
                    />
                  </div>
                  <span className={`text-xs font-bold ${
                    pwdAnalysis.score <= 2 ? 'text-rose-600 dark:text-rose-400' :
                    pwdAnalysis.score <= 3 ? 'text-amber-600 dark:text-amber-400' :
                    pwdAnalysis.score <= 4 ? 'text-cyan-600 dark:text-cyan-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {pwdAnalysis.strength.label}
                  </span>
                </div>

                {/* Requirements checklist */}
                <div className="grid grid-cols-1 gap-1 p-3 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                  {Object.values(pwdAnalysis.checks).map((check) => (
                    <div key={check.label} className="flex items-center gap-2 text-xs">
                      {check.pass
                        ? <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                        : <X size={12} className="text-slate-400 dark:text-slate-600 shrink-0" />
                      }
                      <span className={check.pass ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-slate-500 dark:text-slate-500'}>{check.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!form.password && (
              <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
                  <CheckCircle2 size={13} className="text-cyan-650 dark:text-cyan-400" /> Account Security Features
                </div>
                <p>Includes automatic risk assessment quiz, real-time quote tracking, and goal simulation.</p>
              </div>
            )}

            <Button type="submit" loading={loading} className="mt-2 py-3 w-full" disabled={!!success}>
              Get Started Free <ArrowRight size={16} />
            </Button>
          </form>

          <p className="text-sm text-slate-600 dark:text-slate-400 text-center pt-2">
            Already have an account?{' '}
            <Link to="/login" className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-bold transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
