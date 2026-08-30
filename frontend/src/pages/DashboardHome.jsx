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
import { formatCurrency } from '../utils/formatters';
import { Link } from 'react-router-dom';
import { PortfolioDonut } from '../components/charts/PortfolioDonut';
import { exportWealthSummaryPDF } from '../utils/generateWealthPDF';
import api from '../services/api';


const StatCard = ({ label, value, subtext, icon: Icon, cardClass, iconClass, textClass, badge, index }) => (
  <div 
    className={`card p-5 md:p-6 group animate-fade-in space-y-3 hover:translate-y-[-3px] hover:scale-[1.01] hover:shadow-xl transition-all duration-500 ease-out relative overflow-hidden border ${cardClass}`}
    style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}
  >
    <div className="flex items-start justify-between">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105 ${iconClass}`}>
        <Icon size={18} />
      </div>
      {badge && (
        <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-white/80 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-all duration-200 hover:shadow-sm">
          {badge}
        </span>
      )}
    </div>
    <div>
      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl md:text-3xl font-bold tracking-tight ${textClass}`}>{value ?? '—'}</p>
      {subtext && <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1 font-semibold">{subtext}</p>}
    </div>
  </div>
);

// ─── PDF Report Generator ────────────────────────────────────────────────────
const generatePDF = async (reportData, setDownloading) => {
  setDownloading(true);
  try {
    const html2pdf = (await import('html2pdf.js')).default;
    const fmt = (v) =>
      new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

    const { user, net_worth, total_invested, total_profit_loss, goals, portfolio, allocation_summary, generated_at } = reportData;

    const pnlColor = total_profit_loss >= 0 ? '#10b981' : '#ef4444';
    const pnlSign = total_profit_loss >= 0 ? '+' : '';

    const holdingsRows = (portfolio || [])
      .map(
        (h) => `
      <tr>
        <td>${h.symbol}</td><td>${h.asset_type}</td><td>${h.quantity}</td>
        <td>${fmt(h.average_buy_price)}</td><td>${fmt(h.current_price)}</td>
        <td>${fmt(h.current_value)}</td>
        <td style="color:${h.profit_loss >= 0 ? '#10b981' : '#ef4444'}">${fmt(h.profit_loss)}</td>
      </tr>`
      )
      .join('');

    const goalRows = (goals || [])
      .map(
        (g) => `
      <tr>
        <td>${g.title}</td><td>${g.category}</td>
        <td>${fmt(g.target_amount)}</td><td>${fmt(g.current_amount)}</td>
        <td>${g.progress_pct}%</td><td>${g.target_date}</td>
        <td>${fmt(g.monthly_contribution)}/mo</td>
      </tr>`
      )
      .join('');

    const allocRows = (allocation_summary || [])
      .map((a) => `<tr><td>${a.asset_type}</td><td>${fmt(a.value)}</td><td>${a.pct}%</td></tr>`)
      .join('');

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #1e293b; font-size: 12px; padding: 32px; }
  .header { text-align: center; margin-bottom: 28px; border-bottom: 3px solid #0891b2; padding-bottom: 16px; }
  .header h1 { font-size: 24px; font-weight: 800; color: #0891b2; }
  .header p { color: #64748b; font-size: 11px; margin-top: 4px; }
  .meta { display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: 4px; }
  .section { margin-bottom: 22px; }
  .section h2 { font-size: 13px; font-weight: 700; color: #0891b2; border-left: 4px solid #0891b2; padding-left: 10px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .metric { background: #f1f5f9; border-radius: 8px; padding: 12px; text-align: center; }
  .metric .label { font-size: 10px; color: #64748b; text-transform: uppercase; }
  .metric .value { font-size: 16px; font-weight: 800; color: #1e293b; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #0891b2; color: #fff; padding: 8px 6px; text-align: left; font-weight: 600; font-size: 10px; text-transform: uppercase; }
  td { padding: 7px 6px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .user-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .info-card { background: #f1f5f9; border-radius: 8px; padding: 10px 14px; }
  .info-card .label { font-size: 10px; color: #64748b; text-transform: uppercase; }
  .info-card .val { font-size: 13px; font-weight: 700; color: #1e293b; margin-top: 3px; }
  .footer { text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 20px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .badge-kyc { background: #d1fae5; color: #065f46; }
  .badge-risk { background: #e0f2fe; color: #0369a1; }
</style>
</head>
<body>
  <div class="header">
    <h1>📊 Smart Finance — Personalized Wealth Report</h1>
    <p>Comprehensive Financial Overview &amp; Portfolio Analysis</p>
  </div>

  <div class="meta">
    <span>Generated: ${generated_at}</span>
    <span>Confidential — For ${user?.name || 'User'} Only</span>
  </div>

  <!-- User Info -->
  <div class="section" style="margin-top:16px">
    <h2>👤 User Information</h2>
    <div class="user-info">
      <div class="info-card"><div class="label">Full Name</div><div class="val">${user?.name || '—'}</div></div>
      <div class="info-card"><div class="label">Email</div><div class="val">${user?.email || '—'}</div></div>
      <div class="info-card"><div class="label">Member Since</div><div class="val">${user?.member_since || '—'}</div></div>
      <div class="info-card"><div class="label">Risk Profile</div><div class="val"><span class="badge badge-risk">${user?.risk_profile?.toUpperCase() || '—'}</span></div></div>
      <div class="info-card"><div class="label">KYC Status</div><div class="val"><span class="badge badge-kyc">${user?.kyc_status?.toUpperCase() || '—'}</span></div></div>
    </div>
  </div>

  <!-- Net Worth Summary -->
  <div class="section">
    <h2>💰 Net Worth Summary</h2>
    <div class="grid">
      <div class="metric">
        <div class="label">Net Worth</div>
        <div class="value">${fmt(net_worth)}</div>
      </div>
      <div class="metric">
        <div class="label">Total Invested</div>
        <div class="value">${fmt(total_invested)}</div>
      </div>
      <div class="metric">
        <div class="label">Profit / Loss</div>
        <div class="value" style="color:${pnlColor}">${pnlSign}${fmt(total_profit_loss)}</div>
      </div>
      <div class="metric">
        <div class="label">Active Goals</div>
        <div class="value">${(goals || []).length}</div>
      </div>
    </div>
  </div>

  <!-- Asset Allocation -->
  ${allocation_summary?.length ? `
  <div class="section">
    <h2>🥧 Asset Allocation</h2>
    <table>
      <thead><tr><th>Asset Type</th><th>Value</th><th>Allocation %</th></tr></thead>
      <tbody>${allocRows}</tbody>
    </table>
  </div>` : ''}

  <!-- Portfolio Holdings -->
  ${portfolio?.length ? `
  <div class="section">
    <h2>📈 Portfolio Holdings</h2>
    <table>
      <thead>
        <tr><th>Symbol</th><th>Type</th><th>Qty</th><th>Avg Price</th><th>Curr Price</th><th>Value</th><th>P&amp;L</th></tr>
      </thead>
      <tbody>${holdingsRows}</tbody>
    </table>
  </div>` : ''}

  <!-- Financial Goals -->
  ${goals?.length ? `
  <div class="section">
    <h2>🎯 Financial Goals</h2>
    <table>
      <thead>
        <tr><th>Goal</th><th>Category</th><th>Target</th><th>Saved</th><th>Progress</th><th>Target Date</th><th>Monthly SIP</th></tr>
      </thead>
      <tbody>${goalRows}</tbody>
    </table>
  </div>` : ''}

  <div class="footer">
    Smart Finance &nbsp;|&nbsp; Personalized Wealth Management &nbsp;|&nbsp;
    This report is generated automatically and does not constitute financial advice.
  </div>
</body>
</html>`;

    const element = document.createElement('div');
    element.innerHTML = html;
    document.body.appendChild(element);

    await html2pdf()
      .set({
        margin: 0,
        filename: `WealthReport_${user?.name?.replace(/\s+/g, '_') || 'User'}_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(element)
      .save();

    document.body.removeChild(element);
  } catch (err) {
    console.error('PDF generation failed:', err);
    alert('Unable to generate report. Please try again.');
  } finally {
    setDownloading(false);
  }
};

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
      let finalUser = user;
      let finalGoals = goals;
      let finalPortfolio = portfolio;
      let finalAlerts = alerts;

      // Safe checks and concurrent fetching fallback if state data is missing/empty
      if (!finalUser || Object.keys(finalUser).length === 0 || !finalGoals || finalGoals.length === 0 || !finalPortfolio || finalPortfolio.length === 0) {
        try {
          const [goalsData, portfolioData, alertsData] = await Promise.all([
            getGoals().catch(() => []),
            getPortfolio().catch(() => []),
            api.get('/notifications').then(res => res.data).catch(() => []),
          ]);
          if (!finalGoals || finalGoals.length === 0) finalGoals = goalsData;
          if (!finalPortfolio || finalPortfolio.length === 0) finalPortfolio = portfolioData;
          if (!finalAlerts || finalAlerts.length === 0) finalAlerts = alertsData;
        } catch (fetchErr) {
          console.error("Failed to fetch dashboard data during PDF download:", fetchErr);
          throw new Error("Failed to fetch dashboard data");
        }
      }

      // Safeguard checking for malformed portfolio data
      if (finalPortfolio && typeof finalPortfolio === 'object' && !Array.isArray(finalPortfolio) && !finalPortfolio.data && !finalPortfolio.items) {
        throw new Error("Invalid portfolio data");
      }

      await exportWealthSummaryPDF({
        user: finalUser,
        netWorth: totalCurrentValue,
        portfolio: finalPortfolio,
        goals: finalGoals,
        alerts: finalAlerts
      });
    } catch (error) {
      console.error("Wealth PDF generation failed:", error);
      
      let category = "PDF generation error";
      if (error.message === "Failed to fetch dashboard data") {
        category = "Failed to fetch dashboard data";
      } else if (error.message === "Invalid portfolio data") {
        category = "Invalid portfolio data";
      } else if (error.message && (error.message.includes("jsPDF") || error.message.includes("AutoTable") || error.message.includes("plugin"))) {
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

  const activeGoalsCount = goals.length;
  const avgGoalProgress =
    goals.length > 0
      ? goals.reduce((acc, g) => acc + (g.progress_percentage || 0), 0) / goals.length
      : 0;

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
      cardClass: 'bg-gradient-to-br from-white via-white to-emerald-50/70 border-emerald-100 dark:bg-gradient-to-br dark:from-slate-900 dark:to-emerald-955/30 dark:border-emerald-900/50 hover:shadow-[0_8px_30px_rgba(16,185,129,0.08)] hover:border-cyan-200 dark:hover:border-cyan-800',
      iconClass: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
      textClass: 'text-slate-900 dark:text-slate-100',
    },
    {
      label: 'Total Profit / Loss',
      value: `${totalPnL >= 0 ? '+' : ''}${formatCurrency(totalPnL)}`,
      subtext: `${totalPnLPct >= 0 ? '+' : ''}${totalPnLPct.toFixed(1)}% overall return`,
      icon: totalPnL >= 0 ? TrendingUp : TrendingDown,
      badge: totalPnL >= 0 ? 'Profit' : 'Loss',
      cardClass: 'bg-gradient-to-br from-white to-teal-50/70 border-teal-100 dark:bg-gradient-to-br dark:from-slate-900 dark:to-teal-955/30 dark:border-teal-900/50 hover:shadow-[0_8px_30px_rgba(20,184,166,0.08)] hover:border-cyan-200 dark:hover:border-cyan-800',
      iconClass: 'bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400',
      textClass: totalPnL >= 0 ? 'text-emerald-605 dark:text-emerald-400' : 'text-rose-605 dark:text-rose-400',
    },
    {
      label: 'Financial Goals',
      value: `${activeGoalsCount} Active`,
      subtext: `Avg Progress: ${avgGoalProgress.toFixed(1)}%`,
      icon: Target,
      badge: 'Goals Tracker',
      cardClass: 'bg-gradient-to-br from-white to-cyan-50/70 border-cyan-100 dark:bg-gradient-to-br dark:from-slate-900 dark:to-cyan-955/30 dark:border-cyan-900/50 hover:shadow-[0_8px_30px_rgba(6,182,212,0.08)] hover:border-cyan-200 dark:hover:border-cyan-800',
      iconClass: 'bg-cyan-50 text-cyan-605 dark:bg-cyan-950/40 dark:text-cyan-400',
      textClass: 'text-slate-900 dark:text-slate-100',
    },
    {
      label: 'KYC Compliance Status',
      value: user?.kyc_status ?? 'Pending',
      subtext: 'Regulatory verification',
      icon: ShieldCheck,
      badge: user?.kyc_status === 'verified' ? 'Verified' : 'Pending',
      cardClass: 'bg-gradient-to-br from-white to-amber-50/70 border-amber-100 dark:bg-gradient-to-br dark:from-slate-900 dark:to-amber-955/30 dark:border-amber-900/50 hover:shadow-[0_8px_30px_rgba(245,158,11,0.07)] hover:border-cyan-200 dark:hover:border-cyan-800',
      iconClass: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
      textClass: user?.kyc_status === 'verified' ? 'text-emerald-605 dark:text-emerald-400' : 'text-amber-605 dark:text-amber-400',
    },
  ];

  return (
    <PageTransition>
      <div className="space-y-6 pb-12">
        {/* Welcome Hero Banner */}
        <div className="card p-6 md:p-8 bg-gradient-to-r from-cyan-50 via-white to-sky-50 dark:from-cyan-950/20 dark:via-slate-950 dark:to-slate-900 border-cyan-100 dark:border-cyan-900/30 relative overflow-hidden shadow-[0_8px_30px_rgba(15,23,42,0.04)] dark:shadow-[0_8px_30px_rgba(8,145,178,0.06)] transition-all duration-300">
          <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-cyan-500/5 to-transparent pointer-events-none" />
          <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-606 dark:text-cyan-400 px-2.5 py-0.5 rounded-full border border-cyan-500/20">
                  Financial Control Center
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Welcome back, {user?.name ?? 'Investor'} 👋
              </h1>
              <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 mt-2 max-w-xl font-semibold leading-relaxed">
                Track real-time portfolio performance, simulate inflation-adjusted wealth growth, and follow AI rebalancing recommendations.
              </p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <Link
                to="/goals"
                onClick={(e) => e.stopPropagation()}
                className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-base flex items-center gap-1.5 shadow-sm hover:scale-[1.015] active:scale-[0.98] transition-all duration-200"
              >
                <Plus size={15} /> Create Goal
              </Link>
              <button
                onClick={handleDownloadReport}
                disabled={isExporting}
                className="px-4 py-2.5 rounded-xl bg-cyan-600 text-white border border-cyan-600 hover:bg-cyan-700 hover:scale-[1.01] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 dark:bg-cyan-500 dark:text-slate-950 dark:border-cyan-400 dark:hover:bg-cyan-400 dark:focus-visible:ring-offset-slate-950 transition-all duration-500 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed font-bold text-base flex items-center gap-1.5 cursor-pointer"
              >
                {isExporting ? (
                  <RefreshCw size={15} className="animate-spin text-white dark:text-slate-950" />
                ) : (
                  <Download size={15} className="text-white dark:text-slate-950" />
                )}
                {isExporting ? 'Generating Report...' : 'Download Wealth Statement'}
              </button>

            </div>
          </div>
        </div>

        {/* Primary Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, idx) => (
            <StatCard key={s.label} {...s} index={idx} />
          ))}
        </div>

        {/* Smart Risk Alert from Advisor API */}
        {advisor && (
          <div className="p-5 rounded-xl border border-cyan-200 border-l-4 border-l-cyan-500 bg-cyan-50/70 dark:bg-cyan-950/20 dark:border-cyan-900/80 dark:border-l-cyan-500 flex items-start gap-3 shadow-sm transition-all duration-300">
            {advisor.alert_level === 'success' ? (
              <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle size={18} className="shrink-0 mt-0.5 text-cyan-600 dark:text-cyan-400" />
            )}
            <div className="space-y-1">
              <p className="text-base font-bold text-slate-800 dark:text-slate-200">{advisor.summary}</p>
              <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 font-bold">
                <span>
                  Risk Profile: <strong className="text-cyan-700 dark:text-cyan-300 uppercase">{advisor.risk_profile}</strong>
                </span>
                <span>·</span>
                <span>
                  Portfolio Risk: <strong className="text-cyan-700 dark:text-cyan-300 uppercase">{advisor.portfolio_risk}</strong>
                </span>
                <span>·</span>
                <span className={advisor.needs_rebalancing ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'}>
                  {advisor.needs_rebalancing ? '⚠ Needs Rebalancing' : '✓ Well Balanced'}
                </span>
              </div>
            </div>
            <Link
              to="/portfolio"
              onClick={(e) => e.stopPropagation()}
              className="ml-auto shrink-0 text-xs font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300 bg-white/80 dark:bg-slate-900/80 hover:bg-cyan-105 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              View Portfolio
            </Link>
          </div>
        )}

        {/* Portfolio Chart + Simulator */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Wealth Simulator (Expandable) */}
          <motion.div 
            transition={{ layout: { duration: 0.7, ease: "easeInOut" } }}
            onClick={() => setSimulatorExpanded(!simulatorExpanded)}
            className="card p-6 lg:col-span-2 space-y-5 bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 hover:translate-y-[-3px] hover:scale-[1.01] hover:shadow-xl transition-all duration-500 ease-out cursor-pointer"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sliders size={20} className="text-cyan-500 dark:text-cyan-400" />
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
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
            <p className="text-base text-slate-600 dark:text-slate-400 mt-1 font-semibold leading-relaxed">
              Simulate long-term wealth accumulation adjusted for {inflationRate}% annual inflation. Click card to view details.
            </p>

            <div 
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-gradient-to-r from-slate-50 to-cyan-50/25 dark:from-slate-800/70 dark:to-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700"
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
                >
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">Growth Schedule Projection Table</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                          <th className="py-2.5 font-bold uppercase tracking-wider text-xs">Interval Time</th>
                          <th className="py-2.5 text-right font-bold uppercase tracking-wider text-xs">Principal Invested</th>
                          <th className="py-2.5 text-right font-bold uppercase tracking-wider text-xs">Nominal Target</th>
                          <th className="py-2.5 text-right font-bold uppercase tracking-wider text-xs">Real Adjusted Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getProjectionData().map(row => (
                          <tr key={row.year} className="border-b border-slate-100 dark:border-slate-800/40 text-slate-750 dark:text-slate-300 font-bold hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="py-2.5 font-bold text-slate-900 dark:text-slate-200">Year {row.year}</td>
                            <td className="py-2.5 text-right">{formatPriceVal(row.principal, 'INR')}</td>
                            <td className="py-2.5 text-right font-bold text-cyan-650 dark:text-cyan-400">{formatPriceVal(row.nominal, 'INR')}</td>
                            <td className="py-2.5 text-right font-bold text-emerald-650 dark:text-emerald-450">{formatPriceVal(row.realVal, 'INR')}</td>
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
            className="card p-6 space-y-4 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 hover:translate-y-[-3px] hover:scale-[1.01] hover:shadow-xl transition-all duration-500 ease-out cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-emerald-500 dark:text-emerald-400" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Asset Allocation</h2>
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
                className="text-sm text-cyan-600 dark:text-cyan-405 font-bold hover:underline flex items-center gap-1"
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
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Asset Type Targets</h3>
                  <div className="space-y-2 text-xs font-semibold text-slate-700 dark:text-slate-350">
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/40 pb-1">
                      <span>Conservative:</span>
                      <span className="font-bold text-cyan-650">30% Stock / 70% Fixed Income</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/40 pb-1">
                      <span>Moderate Balance:</span>
                      <span className="font-bold text-cyan-650">65% Stock & Crypto / 35% Debt</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/40 pb-1">
                      <span>Aggressive Growth:</span>
                      <span className="font-bold text-cyan-655">85% Stock & Crypto / 15% Bonds</span>
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

        {/* Goals + Advisor Recommendations */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Financial Goals (Expandable) */}
          <motion.div 
            layout
            transition={{ layout: { duration: 0.7, ease: "easeInOut" } }}
            className="card p-6 lg:col-span-2 space-y-4 hover:translate-y-[-3px] hover:scale-[1.01] hover:shadow-xl transition-all duration-500 ease-out cursor-pointer"
            onClick={() => setGoalsExpanded(!goalsExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-cyan-500 dark:text-cyan-400" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Active Financial Goals ({goals.length})
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
                className="text-sm text-cyan-650 dark:text-cyan-400 font-bold hover:underline flex items-center gap-1"
              >
                Manage Goals <ArrowUpRight size={14} />
              </Link>
            </div>

            {loading ? (
              <div className="text-center py-6 text-sm text-slate-550">Loading goals overview...</div>
            ) : goals.length === 0 ? (
              <div className="p-8 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                <p className="text-sm text-slate-650 dark:text-slate-400">No financial goals created yet.</p>
                <Link to="/goals" className="text-sm text-cyan-600 dark:text-cyan-400 font-bold hover:underline">
                  + Add your first wealth milestone goal
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {goals.slice(0, goalsExpanded ? goals.length : 4).map((g) => {
                  const pct = Math.min(100, Math.max(0, g.progress_percentage || 0));
                  return (
                    <div key={g.id} className="p-4 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-3 hover:border-slate-350 dark:border-slate-700 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-xs font-bold uppercase tracking-wider bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-500/20 px-2 py-0.5 rounded-full">
                            {g.category}
                          </span>
                          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1.5">{g.title}</h3>
                        </div>
                        <span className="text-base font-bold text-cyan-600 dark:text-cyan-400">{pct.toFixed(1)}%</span>
                      </div>
                      <div className="space-y-1">
                        <div className="w-full bg-slate-100 dark:bg-slate-950 h-2.5 rounded-full overflow-hidden border border-transparent dark:border-slate-800">
                          <div
                            className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-650 dark:text-slate-400 pt-1 font-bold">
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
              {goalsExpanded && goals.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden border-t border-slate-200 dark:border-slate-800/80 pt-4 mt-2 space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Remaining Targets</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-semibold text-slate-700 dark:text-slate-350">
                    {goals.map(g => {
                      const remaining = Math.max(0, g.target_amount - g.current_amount);
                      return (
                        <div key={g.id + '_detail'} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg space-y-1">
                          <p className="font-extrabold text-slate-800 dark:text-slate-205 truncate">{g.title}</p>
                          <p>Remaining: <span className="text-cyan-600 dark:text-cyan-405 font-extrabold">{formatCurrency(remaining)}</span></p>
                          <p>Target Date: <span className="font-bold text-slate-750 dark:text-slate-205">{g.target_date || '—'}</span></p>
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
            className="card p-6 space-y-4 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 border-cyan-200 dark:border-cyan-500/20 hover:translate-y-[-3px] hover:scale-[1.01] hover:shadow-xl transition-all duration-500 ease-out cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
                <Sparkles size={18} />
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">AI Portfolio Advisor</h2>
                <motion.div
                  animate={{ rotate: advisorExpanded ? 180 : 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                >
                  <ChevronDown size={16} className="text-slate-400" />
                </motion.div>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-50 text-violet-750 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-500/20">
                {(advisor?.risk_profile || user?.risk_profile || 'moderate').toUpperCase()} RISK
              </span>
            </div>

            {portfolio.length === 0 ? (
              <div className="p-4 bg-amber-50 dark:bg-amber-955/20 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2 hover:shadow-sm transition-all duration-300">
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
                        ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-500/20 dark:text-rose-300'
                        : rec.severity === 'warning'
                        ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-955/40 dark:border-amber-500/20 dark:text-amber-300'
                        : 'bg-cyan-50 border-cyan-200 text-cyan-700 dark:bg-cyan-955/40 dark:border-cyan-500/20 dark:text-cyan-300'
                    }`}
                  >
                    <strong>{rec.asset_type}</strong>: {rec.message}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/70 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-2">
                <p className="text-base font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-650 dark:text-emerald-400" /> Optimal Target Allocation
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-bold">
                  Based on your <span className="text-cyan-600 dark:text-cyan-400 font-extrabold">{(advisor?.risk_profile || user?.risk_profile || 'moderate').toUpperCase()}</span> profile, your portfolio is well balanced.
                </p>
              </div>
            )}

            <div className="p-3 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 rounded-xl text-xs text-cyan-700 dark:text-cyan-300 flex items-start gap-2">
              <Sparkles size={15} className="shrink-0 mt-0.5 text-cyan-605 dark:text-cyan-400" />
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
      </div>
    </PageTransition>
  );
};
