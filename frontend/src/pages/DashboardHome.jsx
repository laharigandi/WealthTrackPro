import React, { useState, useEffect } from 'react';
import {
  ShieldCheck, Activity, Target, Briefcase, TrendingUp,
  ArrowUpRight, Plus, Award, Sparkles, Sliders, Layers, Zap,
  CheckCircle2, AlertTriangle, Download, FileText, RefreshCw,
  TrendingDown, Bell, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '../components/common/PageTransition';
import { useAuth } from '../context/AuthContext';
import { getGoals } from '../services/goalService';
import { getPortfolio } from '../services/portfolioService';
import { getRebalancingAdvice } from '../services/advisorService';
import { getWealthReport } from '../services/reportService';
import { formatCurrency, calculateGoalProgress, calculateAverageGoalProgress } from '../utils/formatters';
import { Link } from 'react-router-dom';
import { PortfolioDonut } from '../components/charts/PortfolioDonut';
import { exportWealthSummaryPDF } from '../utils/generateWealthPDF';
import api from '../services/api';


const StatCard = ({ label, value, subtext, icon: Icon, cardClass, iconClass, textClass, badge, index }) => (
  <div 
    className={`card p-4 sm:p-5 md:p-6 group animate-fade-in space-y-3 hover:translate-y-[-3px] hover:scale-[1.01] hover:shadow-xl transition-all duration-300 ease-out relative overflow-hidden border ${cardClass}`}
    style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}
  >
    <div className="flex items-start justify-between">
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${iconClass}`}>
        <Icon size={18} />
      </div>
      {badge && (
        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-white/80 dark:bg-slate-800/80 border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 transition-all duration-200 hover:shadow-sm">
          {badge}
        </span>
      )}
    </div>
    <div>
      <p className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className={`text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight break-words ${textClass}`}>{value ?? '—'}</p>
      {subtext && <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 font-semibold">{subtext}</p>}
    </div>
  </div>
);

const StatCardSkeleton = () => (
  <div className="card p-5 md:p-6 space-y-4 relative overflow-hidden border border-slate-200/50 dark:border-slate-800/80 shadow-md">
    <div className="flex items-center justify-between">
      <div className="w-10 h-10 rounded-xl shimmer-bg" />
      <div className="w-16 h-5 rounded-full shimmer-bg" />
    </div>
    <div className="space-y-2">
      <div className="w-24 h-4 rounded shimmer-bg" />
      <div className="w-36 h-8 rounded shimmer-bg" />
      <div className="w-28 h-4 rounded shimmer-bg" />
    </div>
  </div>
);

const CardSkeleton = ({ className }) => (
  <div className={`card p-6 space-y-5 border border-slate-200/50 dark:border-slate-800/80 shadow-md ${className}`}>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-1.5 h-5 rounded-full shimmer-bg" />
        <div className="w-36 h-5 rounded shimmer-bg" />
      </div>
      <div className="w-20 h-5 rounded-full shimmer-bg" />
    </div>
    <div className="space-y-3 pt-2">
      <div className="w-full h-24 rounded-xl shimmer-bg" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-10 rounded shimmer-bg" />
        <div className="h-10 rounded shimmer-bg" />
        <div className="h-10 rounded shimmer-bg" />
      </div>
    </div>
  </div>
);

// ─── Main Dashboard Component ─────────────────────────────────────────────────
export const DashboardHome = () => {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [advisor, setAdvisor] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Card Expandable states
  const [simulatorExpanded, setSimulatorExpanded] = useState(false);
  const [allocationExpanded, setAllocationExpanded] = useState(false);
  const [goalsExpanded, setGoalsExpanded] = useState(false);
  const [advisorExpanded, setAdvisorExpanded] = useState(false);

  // Wealth Projection Simulator State
  const [monthlyContribution, setMonthlyContribution] = useState(15000);
  const [years, setYears] = useState(10);
  const [expectedReturnRate, setExpectedReturnRate] = useState(10);
  const [inflationRate, setInflationRate] = useState(5.5);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        const [goalsData, portfolioData, advisorData, alertsData] = await Promise.all([
          getGoals().catch(() => []),
          getPortfolio().catch(() => []),
          getRebalancingAdvice().catch(() => null),
          api.get('/notifications').then(res => res.data).catch(() => []),
        ]);
        setGoals(goalsData || []);
        setPortfolio(portfolioData || []);
        setAdvisor(advisorData);
        setAlerts(alertsData || []);
      } catch {
        // graceful fallback
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const handleDownloadReport = async (e) => {
    e.stopPropagation();
    setIsExporting(true);
    try {
      let reportData = null;
      try {
        reportData = await getWealthReport();
      } catch (fetchErr) {
        console.warn("Could not fetch /report/wealth from server, using live state snapshot:", fetchErr);
      }

      if (reportData && reportData.user && Array.isArray(reportData.portfolio)) {
        await exportWealthSummaryPDF(reportData);
      } else {
        let finalUser = user;
        let finalGoals = goals;
        let finalPortfolio = portfolio;
        let finalAlerts = alerts;
        let finalAdvisor = advisor;

        if (!finalUser || Object.keys(finalUser).length === 0 || !finalGoals || finalGoals.length === 0 || !finalPortfolio || finalPortfolio.length === 0) {
          try {
            const [goalsData, portfolioData, advisorData, alertsData] = await Promise.all([
              getGoals().catch(() => []),
              getPortfolio().catch(() => []),
              getRebalancingAdvice().catch(() => null),
              api.get('/notifications').then(res => res.data).catch(() => []),
            ]);
            if (!finalGoals || finalGoals.length === 0) finalGoals = goalsData;
            if (!finalPortfolio || finalPortfolio.length === 0) finalPortfolio = portfolioData;
            if (!finalAdvisor) finalAdvisor = advisorData;
            if (!finalAlerts || finalAlerts.length === 0) finalAlerts = alertsData;
          } catch (fetchErr) {
            console.error("Failed to fetch dashboard data during PDF download fallback:", fetchErr);
          }
        }

        await exportWealthSummaryPDF({
          user: finalUser,
          netWorth: totalCurrentValue,
          portfolio: finalPortfolio,
          advisor: finalAdvisor,
          goals: finalGoals,
          alerts: finalAlerts,
          notifications: finalAlerts,
        });
      }
    } catch (error) {
      console.error("Wealth PDF generation failed:", error);
      let category = "PDF generation error";
      if (error.message && (error.message.includes("jsPDF") || error.message.includes("AutoTable") || error.message.includes("plugin"))) {
        category = "PDF library error";
      }
      alert(`Unable to generate the wealth statement. Category: ${category}. Please try again.`);
    } finally {
      setIsExporting(false);
    }
  };


  // Format currency helper
  const formatPriceVal = (price, currency) => {
    if (price === null || price === undefined || isNaN(price)) return '—';
    if (currency === 'INR') {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR"
      }).format(price);
    } else {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
      }).format(price);
    }
  };

  // Portfolio aggregates
  const totalInvestment = portfolio.reduce((acc, i) => acc + (i.total_investment_value || 0), 0);
  const totalCurrentValue = portfolio.reduce((acc, i) => acc + (i.current_value || 0), 0);
  const totalPnL = totalCurrentValue - totalInvestment;
  const totalPnLPct = totalInvestment > 0 ? (totalPnL / totalInvestment) * 100 : 0;

  // Asset Type Allocations for donut chart
  const assetTypes = ['Stock', 'ETF', 'Mutual Fund', 'Bond', 'Crypto'];
  const typeTotals = assetTypes.reduce((acc, type) => {
    acc[type] = portfolio
      .filter((p) => p.asset_type === type)
      .reduce((sum, item) => sum + (item.current_value || 0), 0);
    return acc;
  }, {});

  const donutLabels = assetTypes.filter((t) => typeTotals[t] > 0);
  const donutValues = donutLabels.map((t) => typeTotals[t]);

  const activeGoals = (goals || []).filter((g) => {
    if (!g) return false;
    if (g.is_active === false) return false;
    if (g.status && g.status !== 'active' && g.status !== 'in_progress') return false;
    if (g.is_archived === true || g.is_deleted === true) return false;
    return true;
  });

  const activeGoalsCount = activeGoals.length;
  const avgGoalProgress = calculateAverageGoalProgress(activeGoals);

  // Wealth Simulator
  const monthlyRate = expectedReturnRate / 100 / 12;
  const inflationMonthlyRate = inflationRate / 100 / 12;
  const realRate = (1 + monthlyRate) / (1 + inflationMonthlyRate) - 1;
  const totalMonths = years * 12;

  const projectedNominalValue =
    monthlyContribution > 0 && monthlyRate > 0
      ? monthlyContribution * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate)
      : monthlyContribution * totalMonths;

  const projectedInflationAdjustedValue =
    monthlyContribution > 0 && realRate > 0
      ? monthlyContribution * ((Math.pow(1 + realRate, totalMonths) - 1) / realRate)
      : monthlyContribution * totalMonths;

  const totalInvestedOverTime = monthlyContribution * totalMonths;

  const getProjectionData = () => {
    const data = [];
    const step = Math.max(1, Math.floor(years / 3));
    const uniqueYears = [];
    for (let i = 1; i < years; i += step) {
      uniqueYears.push(i);
    }
    uniqueYears.push(years);
    const sortedYears = [...new Set(uniqueYears)].sort((a, b) => a - b);

    sortedYears.forEach(yr => {
      const m = yr * 12;
      const nominal = monthlyContribution > 0 && monthlyRate > 0
        ? monthlyContribution * ((Math.pow(1 + monthlyRate, m) - 1) / monthlyRate)
        : monthlyContribution * m;
      const realVal = monthlyContribution > 0 && realRate > 0
        ? monthlyContribution * ((Math.pow(1 + realRate, m) - 1) / realRate)
        : monthlyContribution * m;
      const principal = monthlyContribution * m;
      data.push({ year: yr, principal, nominal, realVal });
    });
    return data;
  };

  const stats = [
    {
      label: 'Total Portfolio Valuation',
      value: formatCurrency(totalCurrentValue),
      subtext: `Invested: ${formatCurrency(totalInvestment)}`,
      icon: Briefcase,
      badge: totalPnLPct >= 0 ? `+${totalPnLPct.toFixed(1)}%` : `${totalPnLPct.toFixed(1)}%`,
      cardClass: 'bg-gradient-to-br from-white via-white to-slate-50 dark:from-slate-900/60 dark:via-slate-900/50 dark:to-slate-950/40 border-slate-200/50 dark:border-slate-800/80 hover:border-cyan-500/40 dark:hover:border-cyan-500/30 hover:shadow-cyan-500/10 dark:hover:shadow-cyan-500/5',
      iconClass: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400',
      textClass: 'bg-gradient-to-r from-cyan-600 to-emerald-600 dark:from-cyan-400 dark:to-emerald-400 bg-clip-text text-transparent font-extrabold tracking-tight',
    },
    {
      label: 'Total Profit / Loss',
      value: `${totalPnL >= 0 ? '+' : ''}${formatCurrency(totalPnL)}`,
      subtext: `${totalPnLPct >= 0 ? '+' : ''}${totalPnLPct.toFixed(1)}% overall return`,
      icon: totalPnL >= 0 ? TrendingUp : TrendingDown,
      badge: totalPnL >= 0 ? 'Profit' : 'Loss',
      cardClass: 'bg-gradient-to-br from-white via-white to-slate-50 dark:from-slate-900/60 dark:via-slate-900/50 dark:to-slate-950/40 border-slate-200/50 dark:border-slate-800/80 hover:border-cyan-500/40 dark:hover:border-cyan-500/30 hover:shadow-cyan-500/10 dark:hover:shadow-cyan-500/5',
      iconClass: totalPnL >= 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-450' : 'bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-450',
      textClass: totalPnL >= 0 ? 'text-emerald-600 dark:text-emerald-450 font-extrabold' : 'text-rose-600 dark:text-rose-450 font-extrabold',
    },
    {
      label: 'Financial Goals',
      value: `${activeGoalsCount} Active`,
      subtext: activeGoalsCount > 0 ? `Avg Progress: ${avgGoalProgress.toFixed(1)}%` : 'No active goals',
      icon: Target,
      badge: 'Goals Tracker',
      cardClass: 'bg-gradient-to-br from-white via-white to-slate-50 dark:from-slate-900/60 dark:via-slate-900/50 dark:to-slate-950/40 border-slate-200/50 dark:border-slate-800/80 hover:border-cyan-500/40 dark:hover:border-cyan-500/30 hover:shadow-cyan-500/10 dark:hover:shadow-cyan-500/5',
      iconClass: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400',
      textClass: 'text-slate-900 dark:text-slate-100 font-extrabold',
    },
    {
      label: 'KYC Compliance Status',
      value: user?.kyc_status ?? 'Pending',
      subtext: 'Regulatory verification',
      icon: ShieldCheck,
      badge: user?.kyc_status === 'verified' ? 'Verified' : user?.kyc_status === 'rejected' ? 'Rejected' : 'Pending',
      cardClass: 'bg-gradient-to-br from-white via-white to-slate-50 dark:from-slate-900/60 dark:via-slate-900/50 dark:to-slate-950/40 border-slate-200/50 dark:border-slate-800/80 hover:border-cyan-500/40 dark:hover:border-cyan-500/30 hover:shadow-cyan-500/10 dark:hover:shadow-cyan-500/5',
      iconClass: user?.kyc_status === 'verified' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-450' : user?.kyc_status === 'rejected' ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/40 dark:text-rose-450' : 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-450',
      textClass: user?.kyc_status === 'verified' ? 'text-emerald-600 dark:text-emerald-450 font-extrabold' : user?.kyc_status === 'rejected' ? 'text-rose-600 dark:text-rose-450 font-extrabold' : 'text-amber-600 dark:text-amber-450 font-extrabold',
    },
  ];

  return (
    <PageTransition>
      <div className="space-y-6 pb-12">
        {/* Welcome Hero Banner */}
        <div className="card p-6 md:p-8 bg-gradient-to-r from-indigo-50 via-white to-cyan-50/30 dark:from-slate-950 dark:to-slate-900 border-slate-200 dark:border-slate-800 relative overflow-hidden shadow-md transition-all duration-300">
          <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-indigo-500/5 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                  Financial Control Center
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                Welcome back, {user?.name ?? 'Investor'} 👋
              </h1>
              <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 mt-2 max-w-xl font-medium leading-relaxed">
                Track real-time portfolio performance, simulate inflation-adjusted wealth growth, and follow AI rebalancing recommendations.
              </p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
              <Link
                to="/goals"
                onClick={(e) => e.stopPropagation()}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white font-semibold shadow-lg hover:shadow-indigo-500/25 flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.95] transition-all duration-200 text-sm md:text-base"
              >
                <Plus size={15} /> Create Goal
              </Link>
              <button
                onClick={handleDownloadReport}
                disabled={isExporting}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 hover:scale-[1.01] active:scale-[0.95] focus-visible:outline-none transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed font-bold text-sm md:text-base flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
              >
                {isExporting ? (
                  <RefreshCw size={15} className="animate-spin text-slate-700 dark:text-slate-300" />
                ) : (
                  <Download size={15} className="text-slate-700 dark:text-slate-300" />
                )}
                {isExporting ? 'Generating Report...' : 'Download Wealth Statement'}
              </button>
            </div>
          </div>
        </div>

        {/* Primary Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            Array.from({ length: 4 }).map((_, idx) => <StatCardSkeleton key={idx} />)
          ) : (
            stats.map((s, idx) => (
              <StatCard key={s.label} {...s} index={idx} />
            ))
          )}
        </div>

        {/* Smart Risk Alert from Advisor API */}
        {advisor && (
          <div className="p-4 sm:p-5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 text-amber-850 dark:text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm transition-all duration-300">
            <div className="flex items-start gap-3">
              {advisor.alert_level === 'success' ? (
                <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-450" />
              )}
              <div className="space-y-1">
                <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">{advisor.summary}</p>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-600 dark:text-slate-400 font-bold">
                  <span>
                    Risk Profile: <strong className="text-indigo-600 dark:text-indigo-400 uppercase">{advisor.risk_profile}</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Portfolio Risk: <strong className="text-indigo-600 dark:text-indigo-400 uppercase">{advisor.portfolio_risk}</strong>
                  </span>
                  <span>·</span>
                  <span className={advisor.needs_rebalancing ? 'text-amber-800 dark:text-amber-300 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>
                    {advisor.needs_rebalancing ? '⚠ Needs Rebalancing' : '✓ Well Balanced'}
                  </span>
                </div>
              </div>
            </div>
            <Link
              to="/portfolio"
              onClick={(e) => e.stopPropagation()}
              className="self-start sm:self-center shrink-0 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 bg-white dark:bg-slate-900 hover:bg-amber-100 dark:hover:bg-slate-800 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              View Portfolio
            </Link>
          </div>
        )}

        {/* Portfolio Chart + Simulator */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <CardSkeleton className="lg:col-span-2" />
            <CardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Wealth Simulator (Expandable) */}
            <motion.div 
              transition={{ layout: { duration: 0.7, ease: "easeInOut" } }}
              onClick={() => setSimulatorExpanded(!simulatorExpanded)}
              className="card p-6 lg:col-span-2 space-y-5 bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 hover:translate-y-[-3px] hover:scale-[1.01] hover:shadow-xl transition-all duration-300 ease-out cursor-pointer"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-1.5 h-6 bg-gradient-to-b from-indigo-500 to-cyan-500 rounded-full shrink-0" />
                  <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-slate-55">
                    Inflation-Adjusted Wealth Simulator
                  </h2>
                  <motion.div
                    animate={{ rotate: simulatorExpanded ? 180 : 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                  >
                    <ChevronDown size={20} className="text-slate-400" />
                  </motion.div>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-450 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  <Zap size={12} /> Real-Time Model
                </span>
              </div>
              <p className="text-base text-slate-600 dark:text-slate-400 mt-1 font-medium leading-relaxed">
                Simulate long-term wealth accumulation adjusted for {inflationRate}% annual inflation. Click card to view details.
              </p>

              <div 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-200/50 dark:border-slate-700/50"
                onClick={(e) => e.stopPropagation()} // Prevent expansion when adjusting sliders
              >
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Monthly Deposit: <span className="text-cyan-600 dark:text-cyan-400 font-extrabold">{formatCurrency(monthlyContribution)}</span>
                </label>
                <input type="range" min="1000" max="200000" step="1000" value={monthlyContribution} onChange={(e) => setMonthlyContribution(Number(e.target.value))} className="w-full cursor-pointer" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Time Horizon: <span className="text-cyan-600 dark:text-cyan-400 font-extrabold">{years} Years</span>
                </label>
                <input type="range" min="1" max="35" step="1" value={years} onChange={(e) => setYears(Number(e.target.value))} className="w-full cursor-pointer" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Expected Return: <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{expectedReturnRate}% p.a.</span>
                </label>
                <input type="range" min="1" max="25" step="0.5" value={expectedReturnRate} onChange={(e) => setExpectedReturnRate(Number(e.target.value))} className="w-full cursor-pointer" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Inflation Rate: <span className="text-amber-600 dark:text-amber-400 font-extrabold">{inflationRate}% p.a.</span>
                </label>
                <input type="range" min="2" max="12" step="0.5" value={inflationRate} onChange={(e) => setInflationRate(Number(e.target.value))} className="w-full cursor-pointer" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <p className="text-xs text-slate-500 uppercase font-bold">Total Invested Capital</p>
                <p className="text-lg font-black text-slate-800 dark:text-slate-200">{formatCurrency(totalInvestedOverTime)}</p>
                <p className="text-xs text-slate-500 font-semibold">Principal over {years} years</p>
              </div>
              <div className="p-4 bg-slate-50/60 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <p className="text-xs text-slate-500 uppercase font-bold">Nominal Future Wealth</p>
                <p className="text-lg font-black text-cyan-600 dark:text-cyan-400">{formatCurrency(projectedNominalValue)}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-extrabold">+{formatCurrency(projectedNominalValue - totalInvestedOverTime)} gain</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-cyan-50/60 to-slate-50 dark:from-slate-900 dark:to-slate-950 rounded-xl border border-cyan-200/80 dark:border-cyan-500/30 space-y-1">
                <p className="text-xs text-cyan-600 dark:text-cyan-400 uppercase font-bold">Real Inflation Wealth</p>
                <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(projectedInflationAdjustedValue)}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold">In today's purchasing power</p>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {simulatorExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden border-t border-slate-200 dark:border-slate-800/80 pt-4 mt-2 space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">Growth Schedule Projection Table</h3>
                  <div className="overflow-x-auto w-full rounded-xl">
                    <table className="w-full text-sm text-left border-separate border-spacing-y-1.5 min-w-[460px]">
                      <thead>
                        <tr className="text-slate-500 dark:text-slate-400 font-bold">
                          <th className="pb-3 px-4 font-bold uppercase tracking-wider text-xs">Interval Time</th>
                          <th className="pb-3 px-4 text-right font-bold uppercase tracking-wider text-xs">Principal Invested</th>
                          <th className="pb-3 px-4 text-right font-bold uppercase tracking-wider text-xs">Nominal Target</th>
                          <th className="pb-3 px-4 text-right font-bold uppercase tracking-wider text-xs">Real Adjusted Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getProjectionData().map(row => (
                          <tr key={row.year} className="text-slate-750 dark:text-slate-300 font-semibold bg-slate-50/50 dark:bg-slate-800/20 hover:bg-slate-100/70 dark:hover:bg-slate-800/40 transition-colors rounded-xl">
                            <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 rounded-l-xl">Year {row.year}</td>
                            <td className="py-3 px-4 text-right">{formatPriceVal(row.principal, 'INR')}</td>
                            <td className="py-3 px-4 text-right font-bold text-cyan-600 dark:text-cyan-400">{formatPriceVal(row.nominal, 'INR')}</td>
                            <td className="py-3 px-4 text-right font-bold text-emerald-650 dark:text-emerald-450 rounded-r-xl">{formatPriceVal(row.realVal, 'INR')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-slate-550 leading-relaxed font-semibold">
                    💡 <b>Inflation Efficacy:</b> Compound interest yields high nominal growth, but persistent inflation reduces real future capital efficacy. Real value indicates actual future purchasing power compared to today.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Portfolio Donut Chart (Expandable) */}
          <motion.div 
            layout
            transition={{ layout: { duration: 0.7, ease: "easeInOut" } }}
            onClick={() => setAllocationExpanded(!allocationExpanded)}
            className="card p-6 space-y-4 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 hover:translate-y-[-3px] hover:scale-[1.01] hover:shadow-xl transition-all duration-300 ease-out cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-5 bg-gradient-to-b from-indigo-500 to-cyan-500 rounded-full shrink-0" />
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-50">Asset Allocation</h2>
                <motion.div
                  animate={{ rotate: allocationExpanded ? 180 : 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                >
                  <ChevronDown size={16} className="text-slate-400" />
                </motion.div>
              </div>
              <Link 
                to="/portfolio" 
                onClick={(e) => e.stopPropagation()}
                className="text-sm text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 active:scale-95 transition-transform"
              >
                Holdings <ArrowUpRight size={13} />
              </Link>
            </div>
            {donutValues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No holdings yet</p>
                <Link to="/portfolio" onClick={(e) => e.stopPropagation()} className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline mt-1">
                  + Add your first asset holding
                </Link>
              </div>
            ) : (
              <PortfolioDonut labels={donutLabels} values={donutValues} height={200} />
            )}
            {/* Mini allocation list */}
            <div className="space-y-1.5 pt-1">
              {assetTypes.map((type) => {
                const val = typeTotals[type] || 0;
                const pct = totalCurrentValue > 0 ? (val / totalCurrentValue) * 100 : 0;
                if (pct === 0) return null;
                return (
                  <div key={type} className="flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-650 dark:text-slate-400">{type}</span>
                    <span className="text-slate-800 dark:text-slate-205">{pct.toFixed(1)}%</span>
                  </div>
                );
              })}
            </div>

            <AnimatePresence initial={false}>
              {allocationExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden border-t border-slate-200 dark:border-slate-800/80 pt-4 mt-2 space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Asset Type Targets</h3>
                  <div className="space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-350">
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/40 pb-1">
                      <span>Conservative:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-405">30% Stock / 70% Fixed Income</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/40 pb-1">
                      <span>Moderate Balance:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-405">65% Stock & Crypto / 35% Debt</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/40 pb-1">
                      <span>Aggressive Growth:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-405">85% Stock & Crypto / 15% Bonds</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-505 leading-relaxed font-semibold">
                    💡 Target weighting drift checks protect portfolios from volatility swings. Rebalance regular asset SIP weights if allocations slip beyond boundaries.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
        )}

        {/* Goals + Advisor Recommendations */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <CardSkeleton className="lg:col-span-2" />
            <CardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active Financial Goals (Expandable) */}
            <motion.div 
              layout
              transition={{ layout: { duration: 0.7, ease: "easeInOut" } }}
              className="card p-6 lg:col-span-2 space-y-4 hover:translate-y-[-3px] hover:scale-[1.01] hover:shadow-xl transition-all duration-300 ease-out cursor-pointer"
              onClick={() => setGoalsExpanded(!goalsExpanded)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-gradient-to-b from-indigo-500 to-cyan-500 rounded-full shrink-0" />
                  <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-50">
                    Active Financial Goals ({activeGoalsCount})
                  </h2>
                  <motion.div
                    animate={{ rotate: goalsExpanded ? 180 : 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                  >
                    <ChevronDown size={16} className="text-slate-400" />
                  </motion.div>
                </div>
                <Link 
                  to="/goals" 
                  onClick={(e) => e.stopPropagation()}
                  className="text-sm text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 active:scale-95 transition-transform"
                >
                  Manage Goals <ArrowUpRight size={14} />
                </Link>
              </div>

            {loading ? (
              <div className="text-center py-6 text-sm text-slate-550">Loading goals overview...</div>
            ) : activeGoalsCount === 0 ? (
              <div className="p-8 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                <p className="text-sm text-slate-600 dark:text-slate-400">No financial goals created yet.</p>
                <Link to="/goals" className="text-sm text-indigo-600 dark:text-indigo-400 font-bold hover:underline">
                  + Add your first wealth milestone goal
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeGoals.slice(0, goalsExpanded ? activeGoals.length : 4).map((g) => {
                  const pct = calculateGoalProgress(g);
                  return (
                    <div key={g.id} className="p-4 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-slate-200/50 dark:border-slate-800/80 space-y-3 hover:border-indigo-500/20 dark:hover:border-indigo-500/10 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200/50 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-500/20 px-2 py-0.5 rounded-full">
                            {g.category}
                          </span>
                          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1.5">{g.title}</h3>
                        </div>
                        <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="space-y-1">
                        <div className="w-full bg-slate-100 dark:bg-slate-950 h-2.5 rounded-full overflow-hidden border border-transparent dark:border-slate-800">
                          <div
                            className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 pt-1 font-bold">
                          <span>Saved: {formatCurrency(g.current_amount)}</span>
                          <span>Target: {formatCurrency(g.target_amount)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <AnimatePresence initial={false}>
              {goalsExpanded && activeGoalsCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden border-t border-slate-200 dark:border-slate-800/80 pt-4 mt-2 space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-550 dark:text-slate-400">Remaining Targets</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold text-slate-700 dark:text-slate-355">
                    {activeGoals.map(g => {
                      const remaining = Math.max(0, g.target_amount - g.current_amount);
                      return (
                        <div key={g.id + '_detail'} className="p-3 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50 rounded-xl space-y-1 hover:border-indigo-500/20 transition-all duration-300">
                          <p className="font-extrabold text-slate-900 dark:text-slate-100 truncate">{g.title}</p>
                          <p>Remaining: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{formatCurrency(remaining)}</span></p>
                          <p>Target Date: <span className="font-bold text-slate-800 dark:text-slate-200">{g.target_date || '—'}</span></p>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* AI Rebalancing Advisor Card (Expandable) */}
          <motion.div 
            layout
            transition={{ layout: { duration: 0.7, ease: "easeInOut" } }}
            onClick={() => setAdvisorExpanded(!advisorExpanded)}
            className="card p-6 space-y-4 hover:translate-y-[-3px] hover:scale-[1.01] hover:shadow-xl transition-all duration-300 ease-out cursor-pointer hover:border-indigo-500/50 dark:hover:border-indigo-500/40 hover:shadow-indigo-500/10 dark:hover:shadow-indigo-500/5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                <span className="w-1.5 h-5 bg-gradient-to-b from-indigo-500 to-cyan-500 rounded-full shrink-0" />
                <h2 className="text-lg font-extrabold text-slate-900 dark:text-slate-50">AI Portfolio Advisor</h2>
                <motion.div
                  animate={{ rotate: advisorExpanded ? 180 : 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                >
                  <ChevronDown size={16} className="text-slate-400" />
                </motion.div>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/50 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-500/20">
                {(advisor?.risk_profile || user?.risk_profile || 'moderate').toUpperCase()} RISK
              </span>
            </div>

            {portfolio.length === 0 ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2 hover:shadow-sm transition-all duration-300">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                <span>
                  Add portfolio holdings to receive personalised rebalancing advice.
                </span>
              </div>
            ) : advisor?.recommendations?.length > 0 ? (
              <div className="space-y-2">
                {advisor.recommendations.slice(0, 3).map((rec) => (
                  <div
                    key={rec.asset_type}
                    className={`p-3 rounded-xl border text-xs font-bold ${
                      rec.severity === 'danger'
                        ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-400'
                        : rec.severity === 'warning'
                        ? 'bg-amber-50 border-amber-305 text-amber-800 dark:bg-amber-950/50 dark:border-amber-700 dark:text-amber-300'
                        : 'bg-indigo-50 border-indigo-200 text-indigo-800 dark:bg-indigo-950/50 dark:border-indigo-800 dark:text-indigo-300'
                    }`}
                  >
                    <strong>{rec.asset_type}</strong>: {rec.message}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/70 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-2">
                <p className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" /> Optimal Target Allocation
                </p>
                <p className="text-xs text-slate-650 dark:text-slate-400 leading-relaxed font-bold">
                  Based on your <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{(advisor?.risk_profile || user?.risk_profile || 'moderate').toUpperCase()}</span> profile, your portfolio is well balanced.
                </p>
              </div>
            )}

            <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs text-indigo-800 dark:text-indigo-305 flex items-start gap-2">
              <Sparkles size={15} className="shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
              <span>
                <strong className="text-slate-900 dark:text-white">AI Suggestion:</strong> Maintain systematic SIPs into Mutual Funds & ETFs to optimise long-term risk-adjusted ROI.
              </span>
            </div>

            <AnimatePresence initial={false}>
              {advisorExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden border-t border-slate-200 dark:border-slate-800/80 pt-4 mt-2 space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Allocation Drift Target Details</h3>
                  <div className="space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-350">
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/40 pb-1">
                      <span>Rebalance Required:</span>
                      <span className={advisor?.needs_rebalancing ? 'text-amber-500 font-bold' : 'text-emerald-500 font-bold'}>
                        {advisor?.needs_rebalancing ? 'YES' : 'NO'}
                      </span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/40 pb-1">
                      <span>Risk Profile Category:</span>
                      <span className="font-bold text-cyan-600">{(advisor?.risk_profile || 'moderate').toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/40 pb-1">
                      <span>Last Analyzed:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{new Date().toLocaleDateString()}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                    💡 Advisor drifts are checked against custom portfolio tolerances to keep weights aligned to selected target risk.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
        )}
      </div>
    </PageTransition>
  );
};
