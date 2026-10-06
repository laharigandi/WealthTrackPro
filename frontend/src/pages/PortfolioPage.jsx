import React, { useState, useEffect } from 'react';
import {
  Briefcase, Plus, TrendingUp, TrendingDown, Edit3, Trash2,
  CheckCircle2, AlertCircle, RefreshCw, X, AlertTriangle, Sparkles,
  Layers, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import { getPortfolio, createPortfolioItem, updatePortfolioItem, deletePortfolioItem } from '../services/portfolioService';
import { getRebalancingAdvice } from '../services/advisorService';
import { formatCurrency, formatPercent } from '../utils/formatters';
import { Button } from '../components/common/Button';
import { PortfolioDonut } from '../components/charts/PortfolioDonut';
import { PageTransition } from '../components/common/PageTransition';

const alertColors = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-500/20 dark:text-emerald-300',
  warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-500/20 dark:text-amber-300',
  danger:  'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-500/20 dark:text-rose-300',
  info:    'bg-cyan-50 border-cyan-200 text-cyan-800 dark:bg-cyan-950/40 dark:border-cyan-500/20 dark:text-cyan-300',
};

export const PortfolioPage = () => {
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [advisor, setAdvisor] = useState(null);
  const [msg, setMsg] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    symbol: '',
    asset_name: '',
    asset_type: 'Stock',
    quantity: '',
    average_buy_price: '',
    manual_price: '',
  });

  const showToast = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  };

  const getErrorMessage = (error, defaultMsg) => {
    if (error.response?.status === 401) {
      return 'Your session has expired. Please log in again.';
    }
    const data = error.response?.data;
    if (!data) return error.message || defaultMsg;
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail.map((d) => d.msg || (d.loc ? `${d.loc.join('.')}: ${d.msg}` : JSON.stringify(d))).join(', ');
    }
    if (typeof data.detail === 'object' && data.detail !== null) return JSON.stringify(data.detail);
    if (typeof data === 'string' && data.trim().length > 0) return data;
    return error.message || defaultMsg;
  };

  const fetchPortfolioData = async () => {
    try {
      setLoading(true);
      const [data, advisorData] = await Promise.all([
        getPortfolio(),
        getRebalancingAdvice().catch(() => null),
      ]);
      setPortfolio(data || []);
      setAdvisor(advisorData);
    } catch (error) {
      console.error('FETCH PORTFOLIO FAILED', {
        status: error.response?.status,
        url: error.config?.url,
        response: error.response?.data,
        error: error.message,
      });
      const errorDetail = getErrorMessage(error, 'Failed to fetch portfolio holdings.');
      showToast('error', `Unable to load portfolio: ${errorDetail}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioData();
  }, []);

  const totalInvestment = portfolio.reduce((acc, item) => acc + (item.total_investment_value || 0), 0);
  const unavailableHoldings = portfolio.filter((item) => item.current_price === null || item.current_price === undefined);
  const unavailableCount = unavailableHoldings.length;
  const hasUnavailable = unavailableCount > 0;
  const allUnavailable = portfolio.length > 0 && unavailableCount === portfolio.length;

  const currentlyValuedMarket = portfolio
    .filter((item) => item.current_value !== null && item.current_value !== undefined)
    .reduce((acc, item) => acc + item.current_value, 0);

  const unvaluedInvested = unavailableHoldings.reduce((acc, item) => acc + (item.total_investment_value || 0), 0);
  const pricedInvested = portfolio
    .filter((item) => item.current_value !== null && item.current_value !== undefined)
    .reduce((acc, item) => acc + (item.total_investment_value || 0), 0);

  const totalPnL = currentlyValuedMarket - pricedInvested;
  const totalPnLPct = pricedInvested > 0 ? (totalPnL / pricedInvested) * 100 : 0;

  // Donut chart data — uses current value if complete, or fallback to invested value so assets are not dropped
  const assetTypes = ['Stock', 'ETF', 'Mutual Fund', 'Bond', 'Crypto', 'Cash'];
  const typeTotals = assetTypes.reduce((acc, type) => {
    acc[type] = portfolio
      .filter((p) => p.asset_type === type)
      .reduce((s, i) => s + (hasUnavailable ? (i.total_investment_value || 0) : (i.current_value || 0)), 0);
    return acc;
  }, {});
  const donutLabels = assetTypes.filter((t) => typeTotals[t] > 0);
  const donutValues = donutLabels.map((t) => typeTotals[t]);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    const payload = {
      symbol: formData.symbol ? formData.symbol.trim().toUpperCase() : '',
      asset_name: formData.asset_name.trim(),
      asset_type: formData.asset_type,
      quantity: parseFloat(formData.quantity),
      average_buy_price: parseFloat(formData.average_buy_price),
      manual_price: formData.manual_price ? parseFloat(formData.manual_price) : null,
    };

    try {
      if (editingItem) {
        await updatePortfolioItem(editingItem.id, payload);
        showToast('success', 'Portfolio holding updated successfully!');
      } else {
        await createPortfolioItem(payload);
        showToast('success', 'Portfolio holding added successfully!');
      }
      setShowModal(false);
      resetForm();
      await fetchPortfolioData();
    } catch (error) {
      const errorDetail = getErrorMessage(error, 'Failed to save portfolio holding.');
      console.error('ADD HOLDING FAILED', {
        method: editingItem ? 'PATCH' : 'POST',
        url: error.config?.url,
        payload,
        status: error.response?.status,
        response: error.response?.data,
        detail: errorDetail,
      });

      showToast('error', `Unable to save holding: ${errorDetail}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, symbol) => {
    const displayName = symbol || 'this holding';
    if (!window.confirm(`Are you sure you want to delete holding ${displayName}?`)) return;
    try {
      await deletePortfolioItem(id);
      showToast('success', `Deleted holding ${displayName}.`);
      await fetchPortfolioData();
    } catch (error) {
      const errorDetail = getErrorMessage(error, 'Failed to delete holding.');
      console.error('DELETE HOLDING FAILED', { id, status: error.response?.status, response: error.response?.data });
      showToast('error', `Failed to delete holding: ${errorDetail}`);
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      symbol: item.symbol || '',
      asset_name: item.asset_name,
      asset_type: item.asset_type,
      quantity: item.quantity.toString(),
      average_buy_price: item.average_buy_price.toString(),
      manual_price: item.manual_price ? item.manual_price.toString() : '',
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({ symbol: '', asset_name: '', asset_type: 'Stock', quantity: '', average_buy_price: '', manual_price: '' });
  };

  const fieldClass = 'w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200';

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Briefcase className="text-cyan-400" size={24} /> Portfolio Holdings
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Track stocks, ETFs, and assets with real-time valuation and AI rebalancing advice.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchPortfolioData} title="Refresh Quotes" className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 transition-colors">
            <RefreshCw size={16} />
          </button>
          <Button onClick={() => { resetForm(); setShowModal(true); }} className="flex items-center gap-2 text-sm py-2.5 px-4">
            <Plus size={16} /> Add Holding
          </Button>
        </div>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl border text-sm flex items-center gap-2.5 ${msg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
          {msg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {msg.text}
        </div>
      )}

      {/* AI Rebalancing Alert */}
      {advisor && (
        <div className={`p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${alertColors[advisor.alert_level] || alertColors.info}`}>
          <div className="flex items-start gap-3">
            <Sparkles size={20} className="shrink-0 mt-0.5 text-cyan-500" />
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-base">AI Portfolio Advisor</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-white/40 dark:bg-slate-800/60 border border-current">
                  Target: {advisor.risk_profile?.toUpperCase()}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-white/40 dark:bg-slate-800/60 border border-current">
                  Portfolio: {advisor.portfolio_risk?.toUpperCase()}
                </span>
              </div>
              <p className="text-sm font-medium opacity-90">{advisor.summary}</p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-3">
            <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl border ${advisor.needs_rebalancing ? 'bg-amber-500/20 border-amber-500/40 text-amber-900 dark:text-amber-200' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-900 dark:text-emerald-200'}`}>
              {advisor.needs_rebalancing ? '⚠ Rebalance Recommended' : '✓ Well Balanced'}
            </span>
          </div>
        </div>
      )}

      {/* Partial Valuation Warning Banner */}
      {hasUnavailable && (
        <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 flex items-start gap-3 text-sm">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div className="space-y-0.5">
            <p className="font-bold">Portfolio valuation is partially unavailable</p>
            <p className="text-xs opacity-90">
              Live market quotes could not be fetched for {unavailableCount} holding{unavailableCount > 1 ? 's' : ''} ({unavailableHoldings.map(h => h.symbol || h.asset_name).join(', ')}). Allocation analysis is estimated on an invested-value basis.
            </p>
          </div>
        </div>
      )}

      {/* Charts + Summary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut Chart */}
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Sparkles size={15} className="text-cyan-400" /> Portfolio Allocation
            </h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
              {hasUnavailable ? 'Invested Value Basis' : 'Live Market Basis'}
            </span>
          </div>
          <PortfolioDonut labels={donutLabels} values={donutValues} height={200} />
          {hasUnavailable && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium text-center">
              Allocation based on invested value because live market prices are pending for {unavailableCount} asset{unavailableCount > 1 ? 's' : ''}.
            </p>
          )}
        </div>

        {/* Summary Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="card p-5 space-y-1 relative">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 uppercase font-semibold">Total Portfolio Value</p>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                hasUnavailable ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
              }`}>
                {hasUnavailable ? 'PARTIALLY VALUED' : 'COMPLETE'}
              </span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 break-words">
              {allUnavailable ? '—' : formatCurrency(currentlyValuedMarket)}
            </p>
            {hasUnavailable ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                Live valuation unavailable for {unavailableCount} holding{unavailableCount > 1 ? 's' : ''}
              </p>
            ) : (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Live market valuation</p>
            )}
          </div>

          <div className="card p-5 space-y-1">
            <p className="text-xs text-slate-500 uppercase font-semibold">Total Invested Amount</p>
            <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{formatCurrency(totalInvestment)}</p>
            {hasUnavailable ? (
              <p className="text-xs text-slate-500 font-medium">
                Valued: {formatCurrency(pricedInvested)} · Unvalued: {formatCurrency(unvaluedInvested)}
              </p>
            ) : (
              <p className="text-xs text-slate-500 font-medium">Principal purchase cost</p>
            )}
          </div>

          <div className="card p-5 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 uppercase font-semibold">Total Profit / Loss</p>
              {hasUnavailable && !allUnavailable && (
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  PARTIAL
                </span>
              )}
            </div>
            {allUnavailable ? (
              <>
                <p className="text-2xl font-bold text-slate-400">—</p>
                <p className="text-xs text-slate-400">Requires live market prices</p>
              </>
            ) : (
              <>
                <p className={`text-2xl font-bold flex items-center gap-1 ${totalPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {totalPnL >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                  {formatCurrency(totalPnL)}
                </p>
                {hasUnavailable ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    Calculated only on {portfolio.length - unavailableCount} valued holding{portfolio.length - unavailableCount > 1 ? 's' : ''}
                  </p>
                ) : (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Total unrealized gain/loss</p>
                )}
              </>
            )}
          </div>

          <div className="card p-5 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 uppercase font-semibold">Overall P/L (%)</p>
              {hasUnavailable && !allUnavailable && (
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  PARTIAL
                </span>
              )}
            </div>
            {allUnavailable ? (
              <>
                <span className="text-2xl font-bold text-slate-400">—</span>
                <p className="text-xs text-slate-400 mt-1">Pending live data</p>
              </>
            ) : (
              <>
                <span className={`text-2xl font-bold inline-block px-2.5 py-0.5 rounded-md ${
                  totalPnLPct >= 0 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/20' 
                    : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-500/20'
                }`}>
                  {formatPercent(totalPnLPct)}
                </span>
                {hasUnavailable ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">
                    Overall P/L cannot be fully calculated (1 unvalued holding)
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 font-medium mt-1">Return on invested capital</p>
                )}
              </>
            )}
          </div>

          {/* AI Advisor Status Bar */}
          {advisor && (
            <div className="col-span-1 sm:col-span-2 p-4 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Sparkles size={14} className="text-violet-400" /> Target Risk Benchmark: <span className="capitalize text-cyan-500">{advisor.risk_profile}</span>
                </p>
                <span className="text-xs text-slate-400">Drift Threshold: ±{advisor.drift_threshold_pp || 5.0} pp</span>
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                <span className="flex items-center gap-1">User Risk: <strong className="text-violet-400 capitalize">{advisor.risk_profile}</strong></span>
                <span className="text-slate-400">·</span>
                <span className="flex items-center gap-1">
                  Portfolio Risk: <strong className={advisor.portfolio_risk === advisor.risk_profile ? 'text-emerald-400' : 'text-amber-400'} style={{textTransform:'capitalize'}}>{advisor.portfolio_risk}</strong>
                  {advisor.is_fallback && <span className="text-[10px] text-slate-400 font-normal ml-1">(Estimated based on invested value)</span>}
                </span>
                <span className="text-slate-400">·</span>
                <span className={advisor.needs_rebalancing ? 'text-amber-400 font-semibold' : 'text-emerald-400 font-semibold'}>
                  {advisor.needs_rebalancing ? '⚠ Rebalance Recommended' : '✓ Well Balanced'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>


      {/* Asset Allocation Breakdown & Target Benchmark Table */}
      {advisor && advisor.allocation_summary && advisor.allocation_summary.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Layers size={16} className="text-cyan-500" /> Asset Allocation Benchmark & Drift Analysis
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Basis: <strong className="text-slate-700 dark:text-slate-300">{advisor.valuation_basis || (hasUnavailable ? 'Invested Value (Fallback – Live Prices Unavailable)' : 'Live Market Value')}</strong>
              </p>
            </div>
            <span className="text-xs text-slate-500 font-semibold">Benchmark Total: 100%</span>
          </div>
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm min-w-[640px]">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">Asset Class</th>
                  <th className="p-4">Current / Invested Value</th>
                  <th className="p-4">Actual %</th>
                  <th className="p-4">Target %</th>
                  <th className="p-4">Difference (pp)</th>
                  <th className="p-4 text-right">Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                {advisor.allocation_summary.map((row) => {
                  const isOver = row.status === 'OVERWEIGHT';
                  const isUnder = row.status === 'UNDERWEIGHT';
                  return (
                    <tr key={row.asset_type} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                      <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{row.asset_type}</td>
                      <td className="p-4">{formatCurrency(row.current_value)}</td>
                      <td className="p-4 font-semibold">{row.current_pct.toFixed(2)}%</td>
                      <td className="p-4 font-medium text-slate-500">{row.target_pct.toFixed(2)}%</td>
                      <td className="p-4">
                        <span className={`font-semibold flex items-center gap-1 ${isOver ? 'text-rose-500' : isUnder ? 'text-cyan-500' : 'text-emerald-500'}`}>
                          {row.difference_pp > 0 ? `+${row.difference_pp.toFixed(2)} pp` : `${row.difference_pp.toFixed(2)} pp`}
                          {isOver && <ArrowUpRight size={14} />}
                          {isUnder && <ArrowDownRight size={14} />}
                          {!isOver && !isUnder && <Minus size={14} />}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          isOver ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
                          isUnder ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20' :
                          'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Holdings Table */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Asset Holdings List</h3>
          <span className="text-sm text-slate-500">{portfolio.length} Assets</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500 text-sm">Loading portfolio...</div>
        ) : portfolio.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-slate-600 dark:text-slate-400 text-sm">No investment holdings recorded yet.</p>
            <Button onClick={() => { resetForm(); setShowModal(true); }} className="text-sm py-2 px-4">
              Add Your First Holding
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm min-w-[850px]">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">Symbol / Name</th>
                  <th className="p-4">Asset Type</th>
                  <th className="p-4">Quantity</th>
                  <th className="p-4">Avg Buy Price</th>
                  <th className="p-4">Current Price</th>
                  <th className="p-4">Price Source</th>
                  <th className="p-4">Invested Value</th>
                  <th className="p-4">Current Value</th>
                  <th className="p-4">Profit / Loss</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                {portfolio.map((item) => {
                  const isProfit = (item.profit_loss || 0) >= 0;
                  const priceSourceUpper = (item.price_source || 'LIVE').toUpperCase();
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          {item.symbol || '—'}
                          {item.normalized_symbol && item.normalized_symbol !== item.symbol && (
                            <span className="text-[10px] text-slate-400 font-normal">({item.normalized_symbol})</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{item.asset_name}</div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-400 font-semibold">{item.asset_type}</span>
                      </td>
                      <td className="p-4 font-semibold">{item.quantity}</td>
                      <td className="p-4">{formatCurrency(item.average_buy_price, 2)}</td>
                      <td className="p-4">
                        <div className="font-bold text-slate-850 dark:text-slate-200">
                          {item.current_price !== null && item.current_price !== undefined
                            ? formatCurrency(item.current_price, 2)
                            : '—'}
                        </div>
                        {item.price_status === 'Manual' && (
                          <span className="text-[10px] text-slate-400 font-normal block">Manual valuation</span>
                        )}
                        {item.price_status === 'Live' && (
                          <span className="text-[10px] text-emerald-500/80 font-normal block">Live market valuation</span>
                        )}
                        {item.price_status !== 'Manual' && item.price_status !== 'Live' && item.price_status && (
                          <span className="text-[10px] text-amber-500 font-normal block" title={item.price_status}>
                            {item.price_status.length > 32 ? `${item.price_status.substring(0, 32)}...` : item.price_status}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        {priceSourceUpper === 'LIVE' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">LIVE</span>
                        )}
                        {priceSourceUpper === 'MANUAL' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">MANUAL</span>
                        )}
                        {priceSourceUpper === 'FALLBACK' && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">FALLBACK</span>
                        )}
                        {(priceSourceUpper === 'UNAVAILABLE' || priceSourceUpper === 'UNSUPPORTED_PROVIDER') && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">UNAVAILABLE</span>
                        )}
                      </td>
                      <td className="p-4">{formatCurrency(item.total_investment_value)}</td>
                      <td className="p-4 font-bold">
                        {item.current_value !== null && item.current_value !== undefined
                          ? formatCurrency(item.current_value)
                          : '—'}
                      </td>
                      <td className="p-4">
                        {item.profit_loss !== null && item.profit_loss !== undefined ? (
                          <>
                            <div className={`font-bold ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {formatCurrency(item.profit_loss)}
                            </div>
                            <div className="text-xs opacity-80">{formatPercent(item.profit_loss_percentage)}</div>
                          </>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditModal(item)} className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"><Edit3 size={15} /></button>
                          <button onClick={() => handleDelete(item.id, item.symbol)} className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Holding Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card max-w-md w-full p-5 sm:p-6 space-y-5 relative border-slate-300 dark:border-slate-700 shadow-2xl bg-white dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg transition-colors"><X size={20} /></button>
            <h3 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100 flex items-center gap-2 pr-8">
              <Briefcase size={20} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span>{editingItem ? 'Edit Portfolio Holding' : 'Add New Portfolio Holding'}</span>
            </h3>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Ticker Symbol {formData.asset_type === 'Bond' || formData.asset_type === 'Cash' ? <span className="text-xs text-slate-400 font-normal">(Optional)</span> : <span className="text-rose-500">*</span>}
                  </label>
                  <input
                    type="text"
                    required={formData.asset_type !== 'Bond' && formData.asset_type !== 'Cash'}
                    placeholder={formData.asset_type === 'Bond' ? 'e.g. GOVT-BOND' : 'e.g. TCS, AAPL, BTC-USD'}
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Asset Type <span className="text-rose-500">*</span>
                  </label>
                  <select value={formData.asset_type} onChange={(e) => setFormData({ ...formData, asset_type: e.target.value })} className={fieldClass}>
                    <option value="Stock">Stock</option>
                    <option value="ETF">ETF</option>
                    <option value="Mutual Fund">Mutual Fund</option>
                    <option value="Crypto">Crypto</option>
                    <option value="Bond">Bond</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Asset Name <span className="text-rose-500">*</span>
                </label>
                <input type="text" required placeholder="e.g. Tata Consultancy Services" value={formData.asset_name} onChange={(e) => setFormData({ ...formData, asset_name: e.target.value })} className={fieldClass} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Quantity <span className="text-rose-500">*</span>
                  </label>
                  <input type="number" step="any" required min="0.000001" placeholder="10" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Average Buy Price (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input type="number" step="any" required min="0" placeholder="4200" value={formData.average_buy_price} onChange={(e) => setFormData({ ...formData, average_buy_price: e.target.value })} className={fieldClass} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Manual Price Override (₹) <span className="text-xs text-slate-400 font-normal">(Optional)</span>
                </label>
                <input type="number" step="any" min="0" placeholder="Leave empty for live market pricing" value={formData.manual_price} onChange={(e) => setFormData({ ...formData, manual_price: e.target.value })} className={fieldClass} />
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} disabled={submitting} className="text-sm py-2 px-4">Cancel</Button>
                <Button type="submit" disabled={submitting} className="text-sm py-2 px-4 flex items-center gap-2">
                  {submitting ? (editingItem ? 'Saving...' : 'Adding...') : (editingItem ? 'Save Changes' : 'Add Holding')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </PageTransition>
  );
};

export default PortfolioPage;

