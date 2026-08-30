import React, { useState, useEffect } from 'react';
import {
  Briefcase, Plus, TrendingUp, TrendingDown, Edit3, Trash2,
  CheckCircle2, AlertCircle, RefreshCw, X, AlertTriangle, Sparkles,
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
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    symbol: '',
    asset_name: '',
    asset_type: 'Stock',
    quantity: '',
    average_buy_price: '',
  });

  const showToast = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const fetchPortfolioData = async () => {
    try {
      setLoading(true);
      const [data, advisorData] = await Promise.all([
        getPortfolio(),
        getRebalancingAdvice().catch(() => null),
      ]);
      setPortfolio(data);
      setAdvisor(advisorData);
    } catch {
      showToast('error', 'Failed to fetch portfolio holdings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioData();
  }, []);

  const totalInvestment = portfolio.reduce((acc, item) => acc + (item.total_investment_value || 0), 0);
  const totalCurrentValue = portfolio.reduce((acc, item) => acc + (item.current_value || 0), 0);
  const totalPnL = totalCurrentValue - totalInvestment;
  const totalPnLPct = totalInvestment > 0 ? (totalPnL / totalInvestment) * 100 : 0;

  // Donut chart data
  const assetTypes = ['Stock', 'ETF', 'Mutual Fund', 'Bond', 'Crypto'];
  const typeTotals = assetTypes.reduce((acc, type) => {
    acc[type] = portfolio.filter((p) => p.asset_type === type).reduce((s, i) => s + (i.current_value || 0), 0);
    return acc;
  }, {});
  const donutLabels = assetTypes.filter((t) => typeTotals[t] > 0);
  const donutValues = donutLabels.map((t) => typeTotals[t]);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        symbol: formData.symbol.toUpperCase(),
        asset_name: formData.asset_name,
        asset_type: formData.asset_type,
        quantity: parseFloat(formData.quantity),
        average_buy_price: parseFloat(formData.average_buy_price),
      };
      if (editingItem) {
        await updatePortfolioItem(editingItem.id, payload);
        showToast('success', 'Portfolio holding updated successfully!');
      } else {
        await createPortfolioItem(payload);
        showToast('success', 'Portfolio holding added successfully!');
      }
      setShowModal(false);
      resetForm();
      fetchPortfolioData();
    } catch {
      showToast('error', 'Failed to save portfolio holding.');
    }
  };

  const handleDelete = async (id, symbol) => {
    if (!window.confirm(`Are you sure you want to delete holding ${symbol}?`)) return;
    try {
      await deletePortfolioItem(id);
      showToast('success', `Deleted holding ${symbol}.`);
      fetchPortfolioData();
    } catch {
      showToast('error', 'Failed to delete holding.');
    }
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      symbol: item.symbol,
      asset_name: item.asset_name,
      asset_type: item.asset_type,
      quantity: item.quantity.toString(),
      average_buy_price: item.average_buy_price.toString(),
    });
    setShowModal(true);
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({ symbol: '', asset_name: '', asset_type: 'Stock', quantity: '', average_buy_price: '' });
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
            Track stocks, ETFs, and assets with real-time profit and loss calculations.
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

      {/* Rebalancing Alert */}
      {advisor && advisor.needs_rebalancing && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 ${alertColors[advisor.alert_level] || alertColors.warning}`}>
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-base font-semibold">{advisor.summary}</p>
            {advisor.recommendations?.slice(0, 2).map((r) => (
              <p key={r.asset_type} className="text-xs font-medium opacity-90">
                • {r.message}
              </p>
            ))}
          </div>
          <span className="ml-auto shrink-0 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border border-current opacity-70 whitespace-nowrap">
            {advisor.needs_rebalancing ? 'Rebalance Needed' : 'Balanced'}
          </span>
        </div>
      )}

      {/* Charts + Summary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Donut Chart */}
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
            <Sparkles size={15} className="text-cyan-400" /> Portfolio Allocation
          </h2>
          <PortfolioDonut labels={donutLabels} values={donutValues} height={200} />
        </div>

        {/* Summary Cards */}
        <div className="lg:col-span-2 grid grid-cols-2 gap-4">
          <div className="card p-5 space-y-1">
            <p className="text-xs text-slate-500 uppercase font-semibold">Total Portfolio Value</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totalCurrentValue)}</p>
          </div>
          <div className="card p-5 space-y-1">
            <p className="text-xs text-slate-500 uppercase font-semibold">Total Invested Amount</p>
            <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{formatCurrency(totalInvestment)}</p>
          </div>
          <div className="card p-5 space-y-1">
            <p className="text-xs text-slate-500 uppercase font-semibold">Total Profit / Loss</p>
            <p className={`text-2xl font-bold flex items-center gap-1 ${totalPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {totalPnL >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
              {formatCurrency(totalPnL)}
            </p>
          </div>
          <div className="card p-5 space-y-1">
            <p className="text-xs text-slate-500 uppercase font-semibold">Overall P/L (%)</p>
            <span className={`text-2xl font-bold inline-block px-2.5 py-0.5 rounded-md ${
              totalPnLPct >= 0 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/20' 
                : 'bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-500/20'
            }`}>
              {formatPercent(totalPnLPct)}
            </span>
          </div>

          {/* AI Advisor Summary */}
          {advisor && (
            <div className="col-span-2 p-4 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Sparkles size={14} className="text-violet-400" /> AI Rebalancing Status
              </p>
              <div className="flex flex-wrap gap-3 text-[11px]">
                <span className="flex items-center gap-1">Risk Profile: <strong className="text-violet-400 capitalize">{advisor.risk_profile}</strong></span>
                <span className="text-slate-600">·</span>
                <span className="flex items-center gap-1">Portfolio Risk: <strong className={advisor.portfolio_risk === advisor.risk_profile ? 'text-emerald-400' : 'text-amber-400'} style={{textTransform:'capitalize'}}>{advisor.portfolio_risk}</strong></span>
                <span className="text-slate-600">·</span>
                <span className={advisor.needs_rebalancing ? 'text-amber-400' : 'text-emerald-400'}>
                  {advisor.needs_rebalancing ? '⚠ Rebalancing Recommended' : '✓ Well Balanced'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

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
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">Symbol / Name</th>
                  <th className="p-4">Asset Type</th>
                  <th className="p-4">Quantity</th>
                  <th className="p-4">Avg Price</th>
                  <th className="p-4">Current Price</th>
                  <th className="p-4">Invested Value</th>
                  <th className="p-4">Current Value</th>
                  <th className="p-4">Profit / Loss</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                {portfolio.map((item) => {
                  const isProfit = (item.profit_loss || 0) >= 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100">{item.symbol}</div>
                        <div className="text-xs text-slate-500">{item.asset_name}</div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-650 dark:text-slate-400 font-semibold">{item.asset_type}</span>
                      </td>
                      <td className="p-4 font-semibold">{item.quantity}</td>
                      <td className="p-4">{formatCurrency(item.average_buy_price, 2)}</td>
                      <td className="p-4 font-bold text-slate-850 dark:text-slate-200">{formatCurrency(item.current_price, 2)}</td>
                      <td className="p-4">{formatCurrency(item.total_investment_value)}</td>
                      <td className="p-4 font-bold">{formatCurrency(item.current_value)}</td>
                      <td className="p-4">
                        <div className={`font-bold ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{formatCurrency(item.profit_loss)}</div>
                        <div className="text-xs opacity-80">{formatPercent(item.profit_loss_percentage)}</div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="card max-w-md w-full p-6 space-y-5 relative border-slate-300 dark:border-slate-700 shadow-2xl bg-white dark:bg-slate-900">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"><X size={20} /></button>
            <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Briefcase size={20} className="text-cyan-600 dark:text-cyan-400" />
              {editingItem ? 'Edit Portfolio Holding' : 'Add New Portfolio Holding'}
            </h3>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Ticker Symbol</label>
                  <input type="text" required placeholder="e.g. TCS, AAPL" value={formData.symbol} onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })} className={fieldClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Asset Type</label>
                  <select value={formData.asset_type} onChange={(e) => setFormData({ ...formData, asset_type: e.target.value })} className={fieldClass}>
                    <option value="Stock">Stock</option>
                    <option value="ETF">ETF</option>
                    <option value="Mutual Fund">Mutual Fund</option>
                    <option value="Crypto">Crypto</option>
                    <option value="Bond">Bond</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Asset Name</label>
                <input type="text" required placeholder="e.g. Tata Consultancy Services" value={formData.asset_name} onChange={(e) => setFormData({ ...formData, asset_name: e.target.value })} className={fieldClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Quantity</label>
                  <input type="number" step="any" required min="0.001" placeholder="10" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Average Buy Price (₹)</label>
                  <input type="number" step="any" required min="0" placeholder="4200" value={formData.average_buy_price} onChange={(e) => setFormData({ ...formData, average_buy_price: e.target.value })} className={fieldClass} />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="text-sm py-2 px-4">Cancel</Button>
                <Button type="submit" className="text-sm py-2 px-4">{editingItem ? 'Save Changes' : 'Add Holding'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </PageTransition>
  );
};
