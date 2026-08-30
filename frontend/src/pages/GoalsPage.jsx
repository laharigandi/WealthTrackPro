import React, { useState, useEffect } from 'react';
import {
  Target, Plus, Sliders, Trash2, Edit3, CheckCircle2, AlertCircle,
  TrendingUp, X, ArrowRight, Calculator, Info, AlertTriangle, Sparkles,
} from 'lucide-react';
import { getGoals, createGoal, updateGoal, deleteGoal, simulateGoal } from '../services/goalService';
import { calculateSIPInflation } from '../services/calculatorService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Button } from '../components/common/Button';
import { GoalTimeline } from '../components/charts/GoalTimeline';
import { PageTransition } from '../components/common/PageTransition';

const CATEGORIES = ['Retirement', 'Buying a House', 'Education', 'Car', 'Vacation', 'Emergency Fund', 'Custom Goal'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const buildTimelineData = (result) => {
  if (!result) return { labels: [], savings: [], projected: [], target: [] };
  const months = result.months || 120;
  const years = Math.ceil(months / 12);
  const labels = [];
  const savings = [];
  const projected = [];
  const target = [];

  const rMonthly = (result.expected_return / 100) / 12;
  const inflCost = result.inflation_adjusted_cost;

  for (let y = 0; y <= years; y++) {
    labels.push(`Yr ${y}`);
    const n = y * 12;
    const savFV = rMonthly > 0
      ? result.current_savings * Math.pow(1 + rMonthly, n)
      : result.current_savings;
    const sipFV = rMonthly > 0 && n > 0
      ? result.current_monthly_sip * (Math.pow(1 + rMonthly, n) - 1) / rMonthly
      : result.current_monthly_sip * n;
    const inflCostAtY = result.current_cost * Math.pow(1 + result.inflation_rate / 100, y);

    savings.push(Math.round(savFV));
    projected.push(Math.round(savFV + sipFV));
    target.push(Math.round(inflCostAtY));
  }
  return { labels, savings, projected, target };
};

// ─── SIP Calculator Panel ─────────────────────────────────────────────────────
const SIPCalculatorPanel = ({ prefill, onClose }) => {
  const [form, setForm] = useState({
    goal_title: prefill?.title || '',
    current_cost: prefill?.target_amount?.toString() || '',
    years: '10',
    inflation_rate: '6',
    current_savings: prefill?.current_amount?.toString() || '0',
    expected_return: prefill?.expected_return_rate?.toString() || '10',
    monthly_sip: prefill?.monthly_contribution?.toString() || '',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const f = (v) => parseFloat(v) || 0;

  const handleCalc = async (e) => {
    e?.preventDefault();
    setError('');
    if (!form.current_cost || !form.years || !form.monthly_sip) {
      setError('Please fill in Goal Cost, Years, and Monthly SIP.');
      return;
    }
    setLoading(true);
    try {
      const data = await calculateSIPInflation({
        goal_title: form.goal_title || 'Goal',
        current_cost: f(form.current_cost),
        years: f(form.years),
        inflation_rate: f(form.inflation_rate),
        current_savings: f(form.current_savings),
        expected_return: f(form.expected_return),
        monthly_sip: f(form.monthly_sip),
      });
      setResult(data);
    } catch (err) {
      setError(err?.response?.data?.detail || 'Calculation failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  const timeline = buildTimelineData(result);

  const fieldClass =
    'w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200';

  return (
    <div className="card p-6 space-y-6 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator size={20} className="text-cyan-600 dark:text-cyan-400" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Goal SIP + Inflation Calculator</h2>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer">
            <X size={18} />
          </button>
        )}
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 -mt-3">
        Calculate the inflation-adjusted future cost of your goal and the required monthly SIP.
      </p>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <form onSubmit={handleCalc} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Goal Title</label>
          <input type="text" placeholder="e.g. Buy a House" value={form.goal_title} onChange={(e) => setForm({ ...form, goal_title: e.target.value })} className={fieldClass} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Current Goal Cost (₹) *</label>
          <input type="number" required min="1" placeholder="5000000" value={form.current_cost} onChange={(e) => setForm({ ...form, current_cost: e.target.value })} className={fieldClass} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Time Horizon (Years) *</label>
          <input type="number" required min="1" max="50" step="1" placeholder="10" value={form.years} onChange={(e) => setForm({ ...form, years: e.target.value })} className={fieldClass} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Expected Inflation (% p.a.)</label>
          <input type="number" min="0" max="30" step="0.5" placeholder="6" value={form.inflation_rate} onChange={(e) => setForm({ ...form, inflation_rate: e.target.value })} className={fieldClass} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Current Savings (₹)</label>
          <input type="number" min="0" placeholder="500000" value={form.current_savings} onChange={(e) => setForm({ ...form, current_savings: e.target.value })} className={fieldClass} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Expected Annual Return (%)</label>
          <input type="number" min="0" max="100" step="0.5" placeholder="10" value={form.expected_return} onChange={(e) => setForm({ ...form, expected_return: e.target.value })} className={fieldClass} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Current Monthly SIP (₹) *</label>
          <input type="number" required min="0" placeholder="20000" value={form.monthly_sip} onChange={(e) => setForm({ ...form, monthly_sip: e.target.value })} className={fieldClass} />
        </div>
        <div className="md:col-span-2 lg:col-span-2 flex items-end">
          <Button type="submit" loading={loading} className="w-full text-sm py-2.5 flex items-center justify-center gap-2">
            <Calculator size={15} /> Calculate SIP Requirement
          </Button>
        </div>
      </form>

      {/* Results */}
      {result && (
        <div className="space-y-5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Sparkles size={14} className="text-cyan-400" /> Calculation Results for "{result.goal_title}"
          </h3>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { label: 'Current Goal Cost', value: formatCurrency(result.current_cost), color: 'text-slate-800 dark:text-slate-200' },
              { label: `Inflation-Adjusted (${result.inflation_rate}% × ${result.months / 12}yr)`, value: formatCurrency(result.inflation_adjusted_cost), color: 'text-amber-400' },
              { label: 'Current Savings FV', value: formatCurrency(result.savings_future_value), color: 'text-emerald-400' },
              { label: 'Amount Still Required', value: formatCurrency(result.amount_still_required), color: 'text-rose-400' },
              { label: 'SIP Future Value', value: formatCurrency(result.sip_future_value), color: 'text-cyan-400' },
              { label: 'Total Projected Value', value: formatCurrency(result.total_projected_value), color: 'text-cyan-300' },
              { label: 'Required Monthly SIP', value: `${formatCurrency(result.required_monthly_sip)}/mo`, color: 'text-violet-400' },
              { label: 'Current Monthly SIP', value: `${formatCurrency(result.current_monthly_sip)}/mo`, color: 'text-slate-800 dark:text-slate-200' },
            ].map((m) => (
              <div key={m.label} className="p-3 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                <p className="text-[9px] text-slate-500 uppercase font-semibold leading-tight">{m.label}</p>
                <p className={`text-sm font-bold ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Status Banner */}
          <div className={`p-4 rounded-xl border flex items-center justify-between flex-wrap gap-3 ${
            result.is_sip_sufficient
              ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-500/20'
              : 'bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-500/20'
          }`}>
            <div className="flex items-center gap-3">
              {result.is_sip_sufficient
                ? <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                : <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0" />
              }
              <div>
                <p className={`font-bold text-base ${result.is_sip_sufficient ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>
                  {result.status}
                </p>
                {!result.is_sip_sufficient && (
                  <p className="text-sm text-amber-900 dark:text-amber-400/80 mt-0.5 font-medium">
                    Increase SIP by <strong>{formatCurrency(result.sip_shortfall)}/mo</strong> to meet your goal.
                    Suggested: <strong>{formatCurrency(result.suggested_monthly_sip)}/mo</strong>
                  </p>
                )}
                {result.is_sip_sufficient && (
                  <p className="text-sm text-emerald-900 dark:text-emerald-400/80 mt-0.5 font-medium">
                    Your current SIP of {formatCurrency(result.current_monthly_sip)}/mo is sufficient!
                  </p>
                )}
              </div>
            </div>
            <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${
              result.is_sip_sufficient
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-350 dark:border-emerald-500/20'
                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-350 dark:border-amber-500/20'
            }`}>
              {result.is_sip_sufficient ? 'Sufficient' : 'Shortfall'}
            </span>
          </div>

          {/* Goal Timeline Chart */}
          {timeline.labels.length > 1 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Goal Growth Timeline</h4>
              <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800">
                <GoalTimeline
                  labels={timeline.labels}
                  currentSavings={timeline.savings}
                  projectedSIP={timeline.projected}
                  targetLine={timeline.target}
                  height={240}
                />
              </div>
              <div className="flex flex-wrap gap-3 text-[10px] text-slate-600 dark:text-slate-400">
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-cyan-400 inline-block rounded" /> Projected (SIP + Savings)</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-emerald-400 inline-block rounded opacity-70" /> Savings Only</span>
                <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-rose-400 inline-block rounded" style={{ borderTop: '2px dashed #ef4444', background: 'transparent' }} /> Inflation-Adjusted Target</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Goals Page ──────────────────────────────────────────────────────────
export const GoalsPage = () => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSimModal, setShowSimModal] = useState(false);
  const [showCalcPanel, setShowCalcPanel] = useState(false);
  const [calcPrefill, setCalcPrefill] = useState(null);

  // Selected items & forms
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    category: 'Custom Goal',
    target_amount: '',
    current_amount: '0',
    monthly_contribution: '',
    target_date: '2030-12-31',
    expected_return_rate: '8.0',
  });

  // Simulation state
  const [simForm, setSimForm] = useState({
    monthly_contribution: '',
    expected_return_rate: '8.0',
    target_date: '',
  });
  const [simResult, setSimResult] = useState(null);
  const [simLoading, setSimLoading] = useState(false);

  const showToast = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const fetchGoalsData = async () => {
    try {
      setLoading(true);
      const data = await getGoals();
      setGoals(data);
    } catch {
      showToast('error', 'Failed to load financial goals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoalsData();
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      await createGoal({
        ...formData,
        target_amount: parseFloat(formData.target_amount),
        current_amount: parseFloat(formData.current_amount || 0),
        monthly_contribution: parseFloat(formData.monthly_contribution || 0),
        expected_return_rate: parseFloat(formData.expected_return_rate || 8),
      });
      showToast('success', 'Goal created successfully!');
      setShowCreateModal(false);
      resetForm();
      fetchGoalsData();
    } catch {
      showToast('error', 'Failed to create goal.');
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedGoal) return;
    try {
      await updateGoal(selectedGoal.id, {
        ...formData,
        target_amount: parseFloat(formData.target_amount),
        current_amount: parseFloat(formData.current_amount || 0),
        monthly_contribution: parseFloat(formData.monthly_contribution || 0),
        expected_return_rate: parseFloat(formData.expected_return_rate || 8),
      });
      showToast('success', 'Goal updated successfully!');
      setShowEditModal(false);
      resetForm();
      fetchGoalsData();
    } catch {
      showToast('error', 'Failed to update goal.');
    }
  };

  const handleDelete = async (goalId) => {
    if (!window.confirm('Are you sure you want to delete this financial goal?')) return;
    try {
      await deleteGoal(goalId);
      showToast('success', 'Goal deleted.');
      fetchGoalsData();
    } catch {
      showToast('error', 'Failed to delete goal.');
    }
  };

  const openEditModal = (g) => {
    setSelectedGoal(g);
    setFormData({
      title: g.title,
      category: g.category,
      target_amount: g.target_amount.toString(),
      current_amount: g.current_amount.toString(),
      monthly_contribution: g.monthly_contribution.toString(),
      target_date: g.target_date,
      expected_return_rate: g.expected_return_rate.toString(),
    });
    setShowEditModal(true);
  };

  const openSimModal = (g) => {
    setSelectedGoal(g);
    setSimForm({
      monthly_contribution: g.monthly_contribution.toString(),
      expected_return_rate: g.expected_return_rate.toString(),
      target_date: g.target_date,
    });
    setSimResult(null);
    setShowSimModal(true);
    runSimulation(g.id, {
      monthly_contribution: g.monthly_contribution,
      expected_return_rate: g.expected_return_rate,
      target_date: g.target_date,
    });
  };

  const runSimulation = async (goalId, params) => {
    setSimLoading(true);
    try {
      const res = await simulateGoal(goalId, {
        monthly_contribution: parseFloat(params.monthly_contribution || 0),
        expected_return_rate: parseFloat(params.expected_return_rate || 8),
        target_date: params.target_date,
      });
      setSimResult(res);
    } catch {
      showToast('error', 'Failed to run simulation.');
    } finally {
      setSimLoading(false);
    }
  };

  const applySimulationToGoal = async () => {
    if (!selectedGoal || !simResult) return;
    try {
      await updateGoal(selectedGoal.id, {
        monthly_contribution: simResult.simulated_monthly_contribution,
        expected_return_rate: simResult.expected_return_rate,
        target_date: simResult.simulated_target_date,
      });
      showToast('success', 'Simulation parameters applied to goal!');
      setShowSimModal(false);
      fetchGoalsData();
    } catch {
      showToast('error', 'Failed to save simulation to goal.');
    }
  };

  const openCalcForGoal = (g) => {
    setCalcPrefill(g);
    setShowCalcPanel(true);
    setTimeout(() => document.getElementById('sip-calc-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const resetForm = () => {
    setSelectedGoal(null);
    setFormData({
      title: '',
      category: 'Custom Goal',
      target_amount: '',
      current_amount: '0',
      monthly_contribution: '',
      target_date: '2030-12-31',
      expected_return_rate: '8.0',
    });
  };

  const fieldClass =
    'w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200';

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Target className="text-cyan-400" size={24} /> Financial Goals Tracker
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Plan, monitor, simulate, and calculate inflation-adjusted SIP requirements.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setCalcPrefill(null); setShowCalcPanel(!showCalcPanel); }}
            className="px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-semibold text-sm flex items-center gap-1.5 hover:bg-cyan-500/20 transition-all"
          >
            <Calculator size={16} /> SIP Calculator
          </button>
          <Button
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            className="flex items-center gap-2 text-sm py-2.5 px-4"
          >
            <Plus size={16} /> Create Goal
          </Button>
        </div>
      </div>

      {msg && (
        <div className={`p-4 rounded-xl border text-sm flex items-center gap-2.5 ${
          msg.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          {msg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {msg.text}
        </div>
      )}

      {/* SIP Calculator Panel */}
      {showCalcPanel && (
        <div id="sip-calc-section">
          <SIPCalculatorPanel
            prefill={calcPrefill}
            onClose={() => setShowCalcPanel(false)}
          />
        </div>
      )}

      {/* Goals Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-sm">Loading your financial goals...</div>
      ) : goals.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
            <Target size={24} />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">No Financial Goals Created Yet</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
            Start planning your future by adding goals such as Retirement, House Purchase, or Education.
          </p>
          <Button onClick={() => { resetForm(); setShowCreateModal(true); }} className="text-sm py-2 px-4 inline-flex items-center gap-1.5">
            <Plus size={14} /> Create Your First Goal
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {goals.map((g) => {
            const pct = Math.min(100, Math.max(0, g.progress_percentage || 0));
            const isOnTrack = pct >= 50;
            return (
              <div key={g.id} className="card p-6 space-y-5 hover:border-slate-600/80 transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 px-2.5 py-1 rounded-full border border-cyan-500/20">
                      {g.category}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2">{g.title}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openCalcForGoal(g)} title="SIP Calculator" className="p-2 text-slate-600 dark:text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors">
                      <Calculator size={16} />
                    </button>
                    <button onClick={() => openSimModal(g)} title="What-If Simulation" className="p-2 text-slate-600 dark:text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors">
                      <Sliders size={16} />
                    </button>
                    <button onClick={() => openEditModal(g)} title="Edit Goal" className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors">
                      <Edit3 size={16} />
                    </button>
                    <button onClick={() => handleDelete(g.id)} title="Delete Goal" className="p-2 text-slate-600 dark:text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span className="text-slate-600 dark:text-slate-400">Progress</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        isOnTrack
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/20'
                          : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/20'
                      }`}>
                        {isOnTrack ? 'On Track' : 'Needs Attention'}
                      </span>
                      <span className="text-cyan-400 font-bold">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-white dark:bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800/80">
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Amounts grid */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="p-3 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-500 uppercase font-medium">Target Amount</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatCurrency(g.target_amount)}</p>
                  </div>
                  <div className="p-3 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-500 uppercase font-medium">Current Saved</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(g.current_amount)}</p>
                  </div>
                  <div className="p-3 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-500 uppercase font-medium">Monthly SIP</p>
                    <p className="text-sm font-bold text-cyan-600 dark:text-cyan-400">{formatCurrency(g.monthly_contribution)}/mo</p>
                  </div>
                  <div className="p-3 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
                    <p className="text-xs text-slate-500 uppercase font-medium">Target Date</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{g.target_date}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => openCalcForGoal(g)} className="flex-1 text-sm py-2 flex items-center justify-center gap-1.5 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/10">
                    <Calculator size={14} /> SIP Calculator
                  </Button>
                  <Button variant="secondary" onClick={() => openSimModal(g)} className="flex-1 text-sm py-2 flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800">
                    <Sliders size={14} /> Simulate
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Goal Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="card max-w-lg w-full p-6 space-y-5 relative border-slate-300 dark:border-slate-700 shadow-2xl bg-white dark:bg-slate-900">
            <button onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} className="absolute top-4 right-4 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer">
              <X size={20} />
            </button>
            <h3 className="font-bold text-2xl text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Target size={20} className="text-cyan-600 dark:text-cyan-400" />
              {showCreateModal ? 'Create New Goal' : 'Edit Financial Goal'}
            </h3>
            <form onSubmit={showCreateModal ? handleCreateSubmit : handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Goal Title</label>
                <input type="text" required placeholder="e.g. Buy Luxury Villa" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className={fieldClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className={fieldClass}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Date</label>
                  <input type="text" required placeholder="YYYY-MM-DD" value={formData.target_date} onChange={(e) => setFormData({ ...formData, target_date: e.target.value })} className={fieldClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Amount (₹)</label>
                  <input type="number" required min="1" placeholder="5000000" value={formData.target_amount} onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Current Amount (₹)</label>
                  <input type="number" min="0" placeholder="500000" value={formData.current_amount} onChange={(e) => setFormData({ ...formData, current_amount: e.target.value })} className={fieldClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Monthly Contribution (₹)</label>
                  <input type="number" min="0" placeholder="20000" value={formData.monthly_contribution} onChange={(e) => setFormData({ ...formData, monthly_contribution: e.target.value })} className={fieldClass} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Expected Return (% p.a.)</label>
                  <input type="number" step="0.5" min="0" max="100" placeholder="8.0" value={formData.expected_return_rate} onChange={(e) => setFormData({ ...formData, expected_return_rate: e.target.value })} className={fieldClass} />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button type="button" variant="secondary" onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} className="text-sm py-2 px-4">Cancel</Button>
                <Button type="submit" className="text-sm py-2 px-4">{showCreateModal ? 'Create Goal' : 'Save Changes'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* What-If Financial Simulation Modal */}
      {showSimModal && selectedGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-md animate-fade-in">
          <div className="card max-w-2xl w-full p-6 space-y-6 relative border-cyan-200 dark:border-cyan-500/30 shadow-2xl bg-white dark:bg-slate-900">
            <button onClick={() => setShowSimModal(false)} className="absolute top-4 right-4 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer">
              <X size={20} />
            </button>
            <div>
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 mb-1">
                <Sliders size={20} />
                <h3 className="font-bold text-2xl text-slate-900 dark:text-slate-100">What-If Financial Simulation</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Simulate different monthly contributions and expected return rates for{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedGoal.title}</span>.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Simulation Controls */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Adjust Parameters</h4>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Monthly Contribution (₹): <span className="text-cyan-400">{formatCurrency(simForm.monthly_contribution)}</span>
                  </label>
                  <input type="range" min="1000" max="200000" step="1000" value={simForm.monthly_contribution}
                    onChange={(e) => { const u = { ...simForm, monthly_contribution: e.target.value }; setSimForm(u); runSimulation(selectedGoal.id, u); }}
                    className="w-full"
                  />
                  <input type="number" value={simForm.monthly_contribution}
                    onChange={(e) => { const u = { ...simForm, monthly_contribution: e.target.value }; setSimForm(u); runSimulation(selectedGoal.id, u); }}
                    className="w-full mt-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expected Return (%): <span className="text-cyan-400">{simForm.expected_return_rate}%</span>
                  </label>
                  <input type="range" min="1" max="25" step="0.5" value={simForm.expected_return_rate}
                    onChange={(e) => { const u = { ...simForm, expected_return_rate: e.target.value }; setSimForm(u); runSimulation(selectedGoal.id, u); }}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Date</label>
                  <input type="text" value={simForm.target_date}
                    onChange={(e) => { const u = { ...simForm, target_date: e.target.value }; setSimForm(u); runSimulation(selectedGoal.id, u); }}
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              {/* Simulation Results */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Simulated Results</h4>
                {simLoading ? (
                  <div className="text-center py-8 text-sm text-slate-500">Calculating projections...</div>
                ) : simResult ? (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                      <p className="text-[10px] text-slate-500 uppercase">Projected Value at Target Date</p>
                      <p className="text-2xl font-black text-cyan-400">{formatCurrency(simResult.estimated_total_future_value)}</p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400">Target: <span className="font-semibold">{formatCurrency(simResult.target_amount)}</span></p>
                    </div>
                    <div className="p-3 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                      <p className="text-[10px] text-slate-500 uppercase">Required Monthly Contribution</p>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatCurrency(simResult.required_monthly_contribution)}/mo</p>
                    </div>
                    <div className="p-3 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-sm text-slate-600 dark:text-slate-400">Goal Status</span>
                      <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${
                        simResult.is_on_track
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {simResult.is_on_track ? 'Target Achieved 🎉' : 'Shortfall Expected'}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <p className="text-[11px] text-slate-500 italic">* Simulation results do not modify the goal until saved.</p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => setShowSimModal(false)} className="text-sm py-2 px-3">Close</Button>
                <Button onClick={applySimulationToGoal} className="text-sm py-2 px-4 flex items-center gap-1">
                  Save to Goal <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </PageTransition>
  );
};
