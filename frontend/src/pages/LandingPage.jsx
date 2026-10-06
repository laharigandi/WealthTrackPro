import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  TrendingUp, ArrowRight, CheckCircle2, ShieldCheck,
  Sparkles, Target, PieChart, Cpu, BarChart3,
  Sun, Moon, Lock, Check
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const LandingPage = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // If already authenticated, redirect to dashboard seamlessly
  useEffect(() => {
    const hasToken = token || localStorage.getItem('access_token');
    if (hasToken || user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, token, navigate]);

  const featurePoints = [
    {
      title: 'Financial Goals',
      desc: 'Milestone forecasting & systematic SIP pacing',
      icon: Target,
      color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
    },
    {
      title: 'Portfolio & Investment Tracking',
      desc: 'Multi-asset valuation, real-time gain/loss & analytics',
      icon: PieChart,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    },
    {
      title: 'AI-Powered Rebalancing',
      desc: 'Automated drift detection & risk-aligned portfolio allocation',
      icon: Cpu,
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    },
    {
      title: 'Market Insights',
      desc: 'Real-time quotes, technical charts & macro indicators',
      icon: BarChart3,
      color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    },
  ];

  return (
    <div className="min-h-screen lg:h-screen lg:max-h-screen w-full bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100 font-sans flex flex-col selection:bg-sky-500/30 selection:text-sky-600 dark:selection:text-sky-300 relative overflow-x-hidden lg:overflow-hidden transition-colors duration-300">
      
      {/* Background Ambient Glows & Grid Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#38BDF8 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} 
      />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-500/10 dark:bg-sky-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* ======================================================================
          TOP HEADER / NAVIGATION BAR (~64px-72px compact)
      ====================================================================== */}
      <header className="relative z-20 w-full shrink-0 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-[#020617]/70 backdrop-blur-md px-6 sm:px-10 lg:px-12 xl:px-16 py-2.5 sm:py-3 flex items-center justify-between transition-colors">
        
        {/* Brand Logo & Name */}
        <Link 
          to="/" 
          id="landing-logo-link"
          className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-sky-500/50 rounded-xl"
          aria-label="WealthTrack Pro Home"
        >
          <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-br from-sky-400 via-cyan-500 to-emerald-500 flex items-center justify-center text-slate-950 shadow-md shadow-sky-500/20 group-hover:scale-105 transition-transform duration-200 shrink-0">
            <TrendingUp size={20} strokeWidth={2.4} />
          </div>
          <div className="flex flex-col">
            <div className="text-base sm:text-lg lg:text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 leading-tight">
              WEALTHTRACK <span className="text-sky-500 dark:text-sky-400">PRO</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide hidden sm:inline">
              Personal Wealth Intelligence
            </span>
          </div>
        </Link>

        {/* Top Right: Theme Toggle + Sign In Navigation */}
        <div className="flex items-center gap-2.5 sm:gap-4">
          
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            id="landing-theme-toggle"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 sm:p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-850 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-750 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-sky-500/50 cursor-pointer"
          >
            {theme === 'dark' ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-slate-700" />}
          </button>

          {/* Already have an account prompt */}
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <span className="text-slate-500 dark:text-slate-400 hidden md:inline font-medium">
              Already have an account?
            </span>
            <button
              onClick={() => navigate('/login')}
              id="landing-header-signin-btn"
              className="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-sky-600 dark:hover:text-sky-400 bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-850 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-750 transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-sky-500/50 cursor-pointer"
            >
              Sign In
            </button>
          </div>

        </div>

      </header>

      {/* ======================================================================
          MAIN HERO CONTENT (TWO-COLUMN DESKTOP / STACKED MOBILE)
          Spacious layout up to 1650px max-width, balanced 50/50 proportion
      ====================================================================== */}
      <main className="relative z-10 flex-1 min-h-0 w-full max-w-[1650px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 py-4 sm:py-6 lg:py-3 xl:py-5 flex flex-col justify-center overflow-y-auto lg:overflow-hidden">
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10 xl:gap-14 2xl:gap-16 items-center h-auto lg:h-full lg:max-h-full py-4 lg:py-0">
          
          {/* ==================================================================
              LEFT SIDE: BRAND INTRODUCTION & VALUE PROPOSITION (~50% width)
          ================================================================== */}
          <div className="flex flex-col justify-center text-left space-y-2.5 sm:space-y-3.5 xl:space-y-4 2xl:space-y-5 w-full max-w-[740px] 2xl:max-w-[780px] animate-fade-in">
            
            {/* Tagline / Pill Badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3.5 py-1.5 text-xs sm:text-[13px] font-bold text-sky-600 dark:text-sky-300 w-fit shadow-sm">
              <span className="h-2 w-2 rounded-full bg-sky-500 dark:bg-sky-400 animate-pulse" />
              <span>Next-Generation Wealth Management</span>
            </div>

            {/* Main Heading */}
            <div className="space-y-1 sm:space-y-1.5">
              <h1 
                className="font-black tracking-tight text-slate-900 dark:text-white leading-[1.08]"
                style={{
                  fontSize: 'clamp(1.85rem, 2.6vw + 0.6rem, 3.85rem)'
                }}
              >
                Smart Financial Planning <br className="hidden sm:inline" />
                <span className="bg-gradient-to-r from-sky-500 via-cyan-500 to-emerald-400 bg-clip-text text-transparent">
                  for Your Future
                </span>
              </h1>

              {/* Supporting Description */}
              <p className="text-sm sm:text-base lg:text-[15.5px] xl:text-[17.5px] 2xl:text-[19px] text-slate-600 dark:text-slate-300 leading-relaxed max-w-[680px] font-normal pt-0.5">
                Plan smarter, track your investments, manage your financial goals, and make informed decisions with WealthTrack Pro.
              </p>
            </div>

            {/* Feature Highlights (4 feature cards in 2x2 grid) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 xl:gap-3.5 pt-0.5">
              {featurePoints.map((feat) => {
                return (
                  <div
                    key={feat.title}
                    className="flex items-start gap-3 p-2.5 sm:p-3 xl:p-3.5 rounded-2xl bg-white/75 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/90 shadow-sm backdrop-blur-sm hover:border-sky-500/40 dark:hover:border-sky-500/30 transition-all duration-200"
                  >
                    <div className={`h-7 w-7 sm:h-8 sm:w-8 xl:h-9 xl:w-9 rounded-xl flex items-center justify-center shrink-0 border ${feat.color}`}>
                      <Check size={16} strokeWidth={3} className="text-sky-500 dark:text-sky-400" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xs sm:text-[13.5px] xl:text-[15px] 2xl:text-base font-bold text-slate-800 dark:text-slate-200 tracking-tight leading-snug truncate">
                        {feat.title}
                      </h2>
                      <p className="text-[11px] sm:text-xs xl:text-[13px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 line-clamp-2">
                        {feat.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* GET STARTED Call to Action Button */}
            <div className="pt-1 sm:pt-1.5 xl:pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 xl:gap-5">
              <button
                onClick={() => navigate('/login')}
                id="landing-get-started-btn"
                className="group relative inline-flex items-center justify-center gap-3 px-7 sm:px-8 xl:px-9 py-3 sm:py-3.5 xl:py-4 rounded-xl xl:rounded-2xl bg-gradient-to-r from-sky-500 via-cyan-500 to-sky-600 hover:from-sky-400 hover:via-cyan-400 hover:to-sky-500 text-slate-950 font-extrabold text-sm sm:text-base xl:text-lg tracking-wide shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-sky-500/30 cursor-pointer"
              >
                <span>Get Started</span>
                <ArrowRight 
                  size={18} 
                  strokeWidth={2.6} 
                  className="group-hover:translate-x-1.5 transition-transform duration-200" 
                />
              </button>

              <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400 px-1">
                <ShieldCheck size={17} className="text-emerald-500 shrink-0" />
                <span>Zero setup fee · Demo access included</span>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="pt-2 sm:pt-2.5 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center gap-x-5 xl:gap-x-7 gap-y-1.5 text-[11px] sm:text-xs xl:text-[13px] font-medium text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Lock size={13} className="text-sky-500 shrink-0" /> 256-Bit SSL Protection
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-emerald-500 shrink-0" /> Real-time Market Analytics
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-cyan-500 shrink-0" /> Automated Risk Profiling
              </span>
            </div>

          </div>

          {/* ==================================================================
              RIGHT SIDE: PROJECT VISUAL & WEALTH ANALYTICS SHOWCASE (~50% width)
          ================================================================== */}
          <div className="flex justify-center items-center w-full min-h-0 mt-4 lg:mt-0">
            
            <div className="relative w-full max-w-[540px] lg:max-w-[600px] xl:max-w-[700px] 2xl:max-w-[760px] group">
              
              {/* Decorative Subtle Glowing Background Ring */}
              <div className="absolute -inset-1.5 bg-gradient-to-r from-sky-500/25 via-cyan-500/25 to-emerald-500/25 rounded-3xl blur-xl opacity-75 group-hover:opacity-100 transition duration-500" />

              {/* Main Visual Card Container */}
              <div className="relative rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-200/20 dark:border-slate-800 shadow-2xl overflow-hidden max-h-[calc(100vh-140px)]">
                
                {/* Visual Image */}
                <div className="relative aspect-[4/3] max-h-[290px] sm:max-h-[340px] lg:max-h-[380px] xl:max-h-[460px] 2xl:max-h-[520px] w-full overflow-hidden bg-slate-950 flex items-center justify-center">
                  <img
                    src="/wealth_visual.jpg"
                    alt="WealthTrack Pro Wealth Analytics Dashboard Visual"
                    id="landing-hero-visual-img"
                    className="w-full h-full object-cover object-center transform group-hover:scale-[1.02] transition-transform duration-700 ease-out"
                    loading="eager"
                  />
                  
                  {/* Subtle Gradient Vignette Overlay for Depth */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/20 pointer-events-none" />
                </div>

                {/* Floating Telemetry Badge 1: Live Net Worth Growth */}
                <div className="absolute top-3.5 left-3.5 sm:top-5 sm:left-5 p-2.5 sm:p-3.5 xl:p-4 rounded-xl xl:rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-white shadow-xl max-w-[170px] sm:max-w-[205px] xl:max-w-[230px] animate-fade-in">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Portfolio Growth
                    </span>
                    <span className="text-[10px] sm:text-xs font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                      +24.8%
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-base sm:text-lg xl:text-xl font-black text-white">$248,500</span>
                    <span className="text-[10px] sm:text-xs text-slate-400 font-medium">YTD</span>
                  </div>
                </div>

                {/* Floating Telemetry Badge 2: AI Rebalance Active */}
                <div className="absolute bottom-3.5 right-3.5 sm:bottom-5 sm:right-5 p-2.5 sm:p-3.5 xl:p-4 rounded-xl xl:rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-white shadow-xl flex items-center gap-2.5 sm:gap-3 animate-fade-in">
                  <div className="h-7 w-7 sm:h-8 sm:w-8 xl:h-9 xl:w-9 rounded-lg sm:rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shrink-0">
                    <Cpu size={16} />
                  </div>
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-slate-100 flex items-center gap-1.5">
                      AI Rebalance Active
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    </div>
                    <p className="text-[10px] sm:text-xs text-slate-400">Benchmark Drift: 0.0%</p>
                  </div>
                </div>

                {/* Floating Telemetry Badge 3: Milestone Pacing (Bottom Left) */}
                <div className="absolute bottom-3.5 left-3.5 sm:bottom-5 sm:left-5 hidden sm:flex items-center gap-2.5 p-2.5 sm:p-3 xl:p-3.5 rounded-xl xl:rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-white shadow-xl animate-fade-in">
                  <div className="h-7 w-7 sm:h-8 sm:w-8 xl:h-9 xl:w-9 rounded-lg sm:rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <Target size={15} />
                  </div>
                  <div>
                    <span className="text-[10px] sm:text-xs text-slate-400 block leading-tight">Goal Progress</span>
                    <span className="text-xs sm:text-sm font-bold text-emerald-300">84% On Track</span>
                  </div>
                </div>

              </div>

            </div>

          </div>

        </div>

      </main>

      {/* ======================================================================
          FOOTER (~34px-38px compact)
      ====================================================================== */}
      <footer className="relative z-10 w-full shrink-0 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/40 dark:bg-[#020617]/40 px-6 sm:px-10 lg:px-12 xl:px-16 py-2 sm:py-2.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-1.5 transition-colors">
        <div className="flex items-center gap-2">
          <span>&copy; {new Date().getFullYear()} WealthTrack Pro. All rights reserved.</span>
        </div>
        <div className="flex items-center gap-3 sm:gap-4 text-[11px] sm:text-xs">
          <Link to="/login" className="hover:text-sky-500 dark:hover:text-sky-400 transition-colors">
            Sign In
          </Link>
          <span>·</span>
          <Link to="/register" className="hover:text-sky-500 dark:hover:text-sky-400 transition-colors">
            Create Account
          </Link>
          <span>·</span>
          <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
            <ShieldCheck size={12} className="text-emerald-500" /> Bank-Grade Security
          </span>
        </div>
      </footer>

    </div>
  );
};
