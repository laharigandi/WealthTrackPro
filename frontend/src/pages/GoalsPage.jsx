import React, { useState, useEffect, useMemo } from 'react';
import {
  Target, Plus, Sliders, Trash2, Edit3, CheckCircle2, AlertCircle,
  TrendingUp, X, ArrowRight, Calculator, Info, AlertTriangle, Sparkles,
} from 'lucide-react';
import { getGoals, createGoal, updateGoal, deleteGoal, simulateGoal } from '../services/goalService';
import { calculateSIPInflation } from '../services/calculatorService';
import { formatCurrency, formatDate, extractErrorMessage, calculateGoalProgress } from '../utils/formatters';
import { Button } from '../components/common/Button';
import { GoalTimeline } from '../components/charts/GoalTimeline';
import { SimulationProjectionChart, calculateSimulationProjection } from '../components/charts/SimulationProjectionChart';
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
    current_cost: prefill?.target_amount != null ? String(prefill.target_amount) : '',
    years: '10',
    inflation_rate: '6',
    current_savings: prefill?.current_amount != null ? String(prefill.current_amount) : '',
    expected_return: prefill?.expected_return_rate != null ? String(prefill.expected_return_rate) : '10',
    monthly_sip: prefill?.monthly_contribution != null ? String(prefill.monthly_contribution) : '',
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCalc = async (e) => {
    e?.preventDefault();
    setError('');

    if (
      String(form.current_cost).trim() === '' ||
      String(form.years).trim() === '' ||
      String(form.monthly_sip).trim() === ''
    ) {
      setError('Please fill in Goal Cost, Years, and Monthly SIP.');
      return;
    }

    const currentCost = parseFloat(form.current_cost);
    const years = parseFloat(form.years);
    const inflationRate = form.inflation_rate === '' ? 0 : parseFloat(form.inflation_rate);
    const currentSavings = form.current_savings === '' ? 0 : parseFloat(form.current_savings);
    const expectedReturn = form.expected_return === '' ? 0 : parseFloat(form.expected_return);
    const monthlySip = parseFloat(form.monthly_sip);

    if (isNaN(currentCost) || currentCost <= 0) {
      setError('Current goal cost must be greater than 0.');
      return;
    }
    if (isNaN(years) || years <= 0) {
      setError('Time horizon must be greater than 0.');
      return;
    }
    if (isNaN(inflationRate) || inflationRate < 0) {
      setError('Inflation rate cannot be negative.');
      return;
    }
    if (isNaN(currentSavings) || currentSavings < 0) {
      setError('Current savings cannot be negative.');
      return;
    }
    if (isNaN(expectedReturn) || expectedReturn < 0) {
      setError('Expected return cannot be negative.');
      return;
    }
    if (isNaN(monthlySip) || monthlySip < 0) {
      setError('Monthly SIP cannot be negative.');
      return;
    }

    setLoading(true);
    try {
      const data = await calculateSIPInflation({
        goal_title: form.goal_title || 'Goal',
        current_cost: currentCost,
        years: years,
        inflation_rate: inflationRate,
        current_savings: currentSavings,
        expected_return: expectedReturn,
        monthly_sip: monthlySip,
      });
      setResult(data);
    } catch (err) {
      setError(extractErrorMessage(err, 'Calculation failed. Please check your inputs.'));
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
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);

  // Selected item state for edit and simulation
  const [selectedGoal, setSelectedGoal] = useState(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showSimModal, setShowSimModal] = useState(false);
  const [showCalcPanel, setShowCalcPanel] = useState(false);
  const [calcPrefill, setCalcPrefill] = useState(null);

  // Selected items & forms
  const [formData, setFormData] = useState({
    title: '',
    category: 'Custom Goal',
    target_amount: '',
    current_amount: '',
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
  const [validationErrors, setValidationErrors] = useState({});

  // Dynamic simulation projection & status
  const simProjection = useMemo(() => {
    if (!selectedGoal || !showSimModal) return null;
    return calculateSimulationProjection({
      currentSaved: selectedGoal.current_amount,
      targetAmount: selectedGoal.target_amount,
      monthlyContribution: simForm.monthly_contribution,
      expectedReturnRate: simForm.expected_return_rate,
      targetDate: simForm.target_date,
      simResult,
      hasValidationErrors: Object.keys(validationErrors).length > 0,
    });
  }, [selectedGoal, showSimModal, simForm, simResult, validationErrors]);

  const showToast = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const fetchGoalsData = async () => {
    try {
      setLoading(true);
      const data = await getGoals();
      setGoals(data || []);
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to load financial goals.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoalsData();
  }, []);

  const validateSimInputs = (params) => {
    const errors = {};
    
    // Validate Monthly Contribution
    if (params.monthly_contribution !== '' && String(params.monthly_contribution).trim() !== '') {
      const monthlyContribution = parseFloat(params.monthly_contribution);
      if (isNaN(monthlyContribution)) {
        errors.monthly_contribution = 'Monthly contribution must be a valid number.';
      } else if (monthlyContribution < 0) {
        errors.monthly_contribution = 'Monthly contribution cannot be negative.';
      }
    }

    // Validate Expected Return Rate
    if (params.expected_return_rate !== '' && String(params.expected_return_rate).trim() !== '') {
      const expectedReturn = parseFloat(params.expected_return_rate);
      if (isNaN(expectedReturn)) {
        errors.expected_return_rate = 'Expected return rate must be a valid number.';
      } else if (expectedReturn < 0) {
        errors.expected_return_rate = 'Expected return rate cannot be negative.';
      } else if (expectedReturn > 100) {
        errors.expected_return_rate = 'Expected return rate cannot exceed 100%.';
      }
    }

    // Validate Target Date
    const targetDateStr = params.target_date;
    if (!targetDateStr || !targetDateStr.trim()) {
      errors.target_date = 'Target date cannot be empty.';
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(targetDateStr)) {
        errors.target_date = 'Target date must be in YYYY-MM-DD format.';
      } else {
        const parts = targetDateStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);
        if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month || dateObj.getDate() !== day) {
          errors.target_date = 'Target date is not a valid calendar date.';
        } else {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (dateObj < today) {
            errors.target_date = 'Target date cannot be in the past.';
          }
        }
      }
    }

    return errors;
  };

  const validateGoalForm = (data, isEdit = false, currentGoalId = null) => {
    const errors = {};
    
    // Title
    if (!data.title || !String(data.title).trim()) {
      errors.title = 'Goal title is required.';
    } else {
      const trimmedTitle = String(data.title).trim().toLowerCase();
      const isDuplicate = goals.some((g) => {
        if (isEdit && g.id === currentGoalId) return false;
        return (g.title || '').trim().toLowerCase() === trimmedTitle;
      });
      if (isDuplicate) {
        errors.title = `A goal with the title '${data.title.trim()}' already exists.`;
      }
    }
    
    // Target Amount
    if (data.target_amount === '' || String(data.target_amount).trim() === '') {
      errors.target_amount = 'Target amount is required.';
    } else {
      const targetAmt = parseFloat(data.target_amount);
      if (isNaN(targetAmt)) {
        errors.target_amount = 'Target amount must be a valid number.';
      } else if (targetAmt <= 0) {
        errors.target_amount = 'Target amount must be greater than zero.';
      }
    }

    // Current Amount (optional, default 0 if empty)
    if (data.current_amount !== '' && String(data.current_amount).trim() !== '') {
      const currentAmt = parseFloat(data.current_amount);
      if (isNaN(currentAmt)) {
        errors.current_amount = 'Current amount must be a valid number.';
      } else if (currentAmt < 0) {
        errors.current_amount = 'Current amount cannot be negative.';
      }
    }

    // Monthly Contribution (optional, default 0 if empty)
    if (data.monthly_contribution !== '' && String(data.monthly_contribution).trim() !== '') {
      const monthlyContribution = parseFloat(data.monthly_contribution);
      if (isNaN(monthlyContribution)) {
        errors.monthly_contribution = 'Monthly contribution must be a valid number.';
      } else if (monthlyContribution < 0) {
        errors.monthly_contribution = 'Monthly contribution cannot be negative.';
      }
    }

    // Expected Return Rate (optional, default 8.0 if empty)
    if (data.expected_return_rate !== '' && String(data.expected_return_rate).trim() !== '') {
      const expectedReturn = parseFloat(data.expected_return_rate);
      if (isNaN(expectedReturn)) {
        errors.expected_return_rate = 'Expected return rate must be a valid number.';
      } else if (expectedReturn < 0) {
        errors.expected_return_rate = 'Expected return rate cannot be negative.';
      } else if (expectedReturn > 100) {
        errors.expected_return_rate = 'Expected return rate cannot exceed 100%.';
      }
    }

    // Target Date
    const targetDateStr = String(data.target_date || '').trim();
    if (!targetDateStr) {
      errors.target_date = 'Target date is required.';
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const yearOnlyRegex = /^\d{4}$/;
      let normalizedDateStr = targetDateStr;
      if (yearOnlyRegex.test(targetDateStr)) {
        normalizedDateStr = `${targetDateStr}-12-31`;
      }
      
      if (!dateRegex.test(normalizedDateStr)) {
        errors.target_date = 'Target date must be in YYYY-MM-DD format.';
      } else {
        const parts = normalizedDateStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dateObj = new Date(year, month, day);
        if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month || dateObj.getDate() !== day) {
          errors.target_date = 'Target date is not a valid calendar date.';
        } else {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (dateObj < today) {
            errors.target_date = 'Target date cannot be in the past.';
          }
        }
      }
    }

    return errors;
  };

  const handleSimChange = (field, val) => {
    const updatedForm = { ...simForm, [field]: val };
    setSimForm(updatedForm);
    
    const errors = validateSimInputs(updatedForm);
    setValidationErrors(errors);
    
    if (Object.keys(errors).length === 0 && selectedGoal) {
      runSimulation(selectedGoal.id, updatedForm);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const errors = validateGoalForm(formData, false);
    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      showToast('error', firstError);
      return;
    }

    let targetDate = String(formData.target_date || '').trim();
    if (/^\d{4}$/.test(targetDate)) {
      targetDate = `${targetDate}-12-31`;
    }

    setSubmitting(true);
    try {
      await createGoal({
        title: formData.title.trim(),
        category: formData.category,
        target_amount: parseFloat(formData.target_amount),
        current_amount: parseFloat(formData.current_amount || 0),
        monthly_contribution: parseFloat(formData.monthly_contribution || 0),
        target_date: targetDate,
        expected_return_rate: parseFloat(formData.expected_return_rate || 8),
      });
      showToast('success', 'Goal created successfully!');
      setShowCreateModal(false);
      resetForm();
      await fetchGoalsData();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to create goal.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedGoal) return;
    const errors = validateGoalForm(formData, true, selectedGoal.id);
    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      showToast('error', firstError);
      return;
    }

    let targetDate = String(formData.target_date || '').trim();
    if (/^\d{4}$/.test(targetDate)) {
      targetDate = `${targetDate}-12-31`;
    }

    setSubmitting(true);
    try {
      await updateGoal(selectedGoal.id, {
        title: formData.title.trim(),
        category: formData.category,
        target_amount: parseFloat(formData.target_amount),
        current_amount: parseFloat(formData.current_amount || 0),
        monthly_contribution: parseFloat(formData.monthly_contribution || 0),
        target_date: targetDate,
        expected_return_rate: parseFloat(formData.expected_return_rate || 8),
      });
      showToast('success', 'Goal updated successfully!');
      setShowEditModal(false);
      resetForm();
      await fetchGoalsData();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to update goal.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (goalId) => {
    if (!window.confirm('Are you sure you want to delete this financial goal?')) return;
    try {
      await deleteGoal(goalId);
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
      showToast('success', 'Goal deleted successfully.');
      await fetchGoalsData();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to delete goal.'));
    }
  };

  const openEditModal = (g) => {
    setSelectedGoal(g);
    setFormData({
      title: g.title || '',
      category: g.category || 'Custom Goal',
      target_amount: g.target_amount != null ? String(g.target_amount) : '',
      current_amount: g.current_amount != null ? String(g.current_amount) : '0',
      monthly_contribution: g.monthly_contribution != null ? String(g.monthly_contribution) : '0',
      target_date: g.target_date || '2030-12-31',
      expected_return_rate: g.expected_return_rate != null ? String(g.expected_return_rate) : '8.0',
    });
    setShowEditModal(true);
  };

  const openSimModal = (g) => {
    setSelectedGoal(g);
    const initialForm = {
      monthly_contribution: g.monthly_contribution != null ? String(g.monthly_contribution) : '0',
      expected_return_rate: g.expected_return_rate != null ? String(g.expected_return_rate) : '8.0',
      target_date: g.target_date || '',
    };
    setSimForm(initialForm);
    setSimResult(null);
    setValidationErrors({});
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
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to run simulation.'));
    } finally {
      setSimLoading(false);
    }
  };

  const applySimulationToGoal = async () => {
    if (!selectedGoal || !simResult) return;
    const errors = validateSimInputs(simForm);
    if (Object.keys(errors).length > 0) {
      showToast('error', 'Cannot save simulation with invalid parameters.');
      return;
    }
    try {
      await updateGoal(selectedGoal.id, {
        monthly_contribution: simResult.simulated_monthly_contribution,
        expected_return_rate: simResult.expected_return_rate,
        target_date: simResult.simulated_target_date,
      });
      showToast('success', 'Simulation parameters applied to goal!');
      setShowSimModal(false);
      await fetchGoalsData();
    } catch (err) {
      showToast('error', extractErrorMessage(err, 'Failed to save simulation to goal.'));
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
      current_amount: '',
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
            id="create-goal-button"
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
          <Button 
            id="create-first-goal-button"
            onClick={() => { resetForm(); setShowCreateModal(true); }} 
            className="text-sm py-2 px-4 inline-flex items-center gap-1.5"
          >
            <Plus size={14} /> Create Your First Goal
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {goals.map((g) => {
            const pct = calculateGoalProgress(g);
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
                    <button id={`sim-icon-btn-${g.id}`} onClick={() => openSimModal(g)} title="What-If Simulation" className="p-2 text-slate-600 dark:text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors">
                      <Sliders size={16} />
                    </button>
                    <button onClick={() => openEditModal(g)} title="Edit Goal" className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors">
                      <Edit3 size={16} />
                    </button>
                    <button id={`delete-btn-${g.id}`} onClick={() => handleDelete(g.id)} title="Delete Goal" className="p-2 text-slate-600 dark:text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
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
                  <Button id={`simulate-btn-${g.id}`} variant="secondary" onClick={() => openSimModal(g)} className="flex-1 text-sm py-2 flex items-center justify-center gap-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="card max-w-lg w-full p-5 sm:p-6 space-y-5 relative border-slate-300 dark:border-slate-700 shadow-2xl bg-white dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <button 
              id="goal-modal-close-btn"
              onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} 
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="font-bold text-xl sm:text-2xl text-slate-900 dark:text-slate-100 flex items-center gap-2 pr-8">
              <Target size={22} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
              <span>{showCreateModal ? 'Create New Goal' : 'Edit Financial Goal'}</span>
            </h3>
            <form onSubmit={showCreateModal ? handleCreateSubmit : handleEditSubmit} className="space-y-4">
              <div>
                <label htmlFor="goal-title" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Goal Title *
                </label>
                <input 
                  id="goal-title" 
                  name="title" 
                  type="text" 
                  required 
                  placeholder="e.g. Dream Car, Buy House" 
                  value={formData.title} 
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })} 
                  className={fieldClass} 
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="goal-category" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category *
                  </label>
                  <select 
                    id="goal-category" 
                    name="category" 
                    value={formData.category} 
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })} 
                    className={fieldClass}
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="goal-target-date" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Date *
                  </label>
                  <input 
                    id="goal-target-date" 
                    name="target_date" 
                    type="text" 
                    required 
                    placeholder="YYYY-MM-DD" 
                    value={formData.target_date} 
                    onChange={(e) => setFormData({ ...formData, target_date: e.target.value })} 
                    className={fieldClass} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="goal-target-amount" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Amount (₹) *
                  </label>
                  <input 
                    id="goal-target-amount" 
                    name="target_amount" 
                    type="number" 
                    required 
                    min="1" 
                    step="any" 
                    placeholder="1200000" 
                    value={formData.target_amount} 
                    onChange={(e) => setFormData({ ...formData, target_amount: e.target.value })} 
                    className={fieldClass} 
                  />
                </div>
                <div>
                  <label htmlFor="goal-current-amount" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Current Saved (₹)
                  </label>
                  <input 
                    id="goal-current-amount" 
                    name="current_amount" 
                    type="number" 
                    min="0" 
                    step="any" 
                    placeholder="550000" 
                    value={formData.current_amount} 
                    onChange={(e) => setFormData({ ...formData, current_amount: e.target.value })} 
                    className={fieldClass} 
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="goal-monthly-contribution" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Monthly Investment (₹)
                  </label>
                  <input 
                    id="goal-monthly-contribution" 
                    name="monthly_contribution" 
                    type="number" 
                    min="0" 
                    step="any" 
                    placeholder="20000" 
                    value={formData.monthly_contribution} 
                    onChange={(e) => setFormData({ ...formData, monthly_contribution: e.target.value })} 
                    className={fieldClass} 
                  />
                </div>
                <div>
                  <label htmlFor="goal-expected-return" className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expected Return (% p.a.)
                  </label>
                  <input 
                    id="goal-expected-return" 
                    name="expected_return_rate" 
                    type="number" 
                    step="0.5" 
                    min="0" 
                    max="100" 
                    placeholder="8.0" 
                    value={formData.expected_return_rate} 
                    onChange={(e) => setFormData({ ...formData, expected_return_rate: e.target.value })} 
                    className={fieldClass} 
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button 
                  id="goal-cancel-button"
                  type="button" 
                  variant="secondary" 
                  onClick={() => { setShowCreateModal(false); setShowEditModal(false); }} 
                  className="text-sm py-2 px-4"
                >
                  Cancel
                </Button>
                <Button 
                  id="goal-submit-button"
                  type="submit" 
                  loading={submitting}
                  className="text-sm py-2 px-4"
                >
                  {showCreateModal ? 'Add Goal' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* What-If Financial Simulation Modal */}
      {showSimModal && selectedGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="card max-w-4xl w-full p-4 sm:p-6 space-y-5 sm:space-y-6 relative border-cyan-200 dark:border-cyan-500/30 shadow-2xl bg-white dark:bg-slate-900 overflow-y-auto max-h-[90vh]">
            <button onClick={() => setShowSimModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg transition-colors">
              <X size={20} />
            </button>
            <div className="pr-8">
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 mb-1">
                <Sliders size={22} className="shrink-0" />
                <h3 className="font-bold text-xl sm:text-2xl text-slate-900 dark:text-slate-100">What-If Financial Simulation</h3>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                Simulate different monthly contributions and expected return rates for{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedGoal.title}</span>.
              </p>
            </div>

            {/* Current Goal Progress (Real Status) */}
            <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current Goal Progress (Real Status)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-1">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-medium">Current Saved</p>
                  <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">{formatCurrency(selectedGoal.current_amount)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-medium">Target Amount</p>
                  <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">{formatCurrency(selectedGoal.target_amount)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-medium">Actual Progress</p>
                  <p className="text-xs sm:text-sm font-bold text-cyan-500">
                    {((selectedGoal.current_amount / selectedGoal.target_amount) * 100).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase font-medium">Actual Status</p>
                  <span className={`inline-block text-[10px] sm:text-xs font-bold px-2 py-0.5 mt-0.5 rounded-full ${
                    selectedGoal.current_amount >= selectedGoal.target_amount
                      ? 'bg-emerald-55 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-350 dark:border-emerald-500/20'
                      : ((selectedGoal.current_amount / selectedGoal.target_amount) * 100) >= 50
                        ? 'bg-emerald-55 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-350 dark:border-emerald-500/20'
                        : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-350 dark:border-amber-500/20'
                  }`}>
                    {selectedGoal.current_amount >= selectedGoal.target_amount
                      ? 'Goal Completed 🎉'
                      : ((selectedGoal.current_amount / selectedGoal.target_amount) * 100) >= 50
                        ? 'On Track'
                        : 'Needs Attention'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Simulation Settings */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Adjust Parameters</h4>
                
                {/* Monthly Contribution */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Monthly Contribution (₹)
                    </label>
                    <span className="text-sm font-bold text-cyan-400">
                      {validationErrors.monthly_contribution ? '—' : formatCurrency(simForm.monthly_contribution || 0)}
                    </span>
                  </div>
                  <input type="range" min="0" max="200000" step="1000" value={isNaN(parseFloat(simForm.monthly_contribution)) ? 0 : parseFloat(simForm.monthly_contribution)}
                    onChange={(e) => handleSimChange('monthly_contribution', e.target.value)}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-cyan-400 focus:outline-none"
                  />
                  <input 
                    id="sim-monthly-contribution-input"
                    type="number" 
                    value={simForm.monthly_contribution}
                    onChange={(e) => handleSimChange('monthly_contribution', e.target.value)}
                    className={`w-full mt-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border text-sm text-slate-900 dark:text-slate-100 ${
                      validationErrors.monthly_contribution ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                    }`}
                    placeholder="e.g. 50000"
                  />
                  {validationErrors.monthly_contribution && (
                    <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1"><AlertCircle size={10} /> {validationErrors.monthly_contribution}</p>
                  )}
                </div>

                {/* Expected Return Rate */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Expected Return (% p.a.)
                    </label>
                    <span className="text-sm font-bold text-cyan-400">
                      {validationErrors.expected_return_rate ? '—' : `${simForm.expected_return_rate}%`}
                    </span>
                  </div>
                  <input type="range" min="0" max="25" step="0.5" value={isNaN(parseFloat(simForm.expected_return_rate)) ? 0 : parseFloat(simForm.expected_return_rate)}
                    onChange={(e) => handleSimChange('expected_return_rate', e.target.value)}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-cyan-400 focus:outline-none"
                  />
                  <input 
                    id="sim-expected-return-input"
                    type="number" 
                    step="0.1" 
                    value={simForm.expected_return_rate}
                    onChange={(e) => handleSimChange('expected_return_rate', e.target.value)}
                    className={`w-full mt-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border text-sm text-slate-900 dark:text-slate-100 ${
                      validationErrors.expected_return_rate ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                    }`}
                    placeholder="e.g. 10"
                  />
                  {validationErrors.expected_return_rate && (
                    <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1"><AlertCircle size={10} /> {validationErrors.expected_return_rate}</p>
                  )}
                </div>

                {/* Target Date */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Date</label>
                  <input 
                    id="sim-target-date-input"
                    type="text" 
                    value={simForm.target_date}
                    onChange={(e) => handleSimChange('target_date', e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border text-sm text-slate-900 dark:text-slate-100 ${
                      validationErrors.target_date ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-slate-700'
                    }`}
                    placeholder="YYYY-MM-DD"
                  />
                  {validationErrors.target_date && (
                    <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1"><AlertCircle size={10} /> {validationErrors.target_date}</p>
                  )}
                </div>
              </div>

              {/* Simulation Results (Simulated Future Outcome) */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Simulated Future Outcome</h4>
                {simLoading ? (
                  <div className="text-center py-8 text-sm text-slate-500">Calculating projections...</div>
                ) : Object.keys(validationErrors).length > 0 ? (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-sm flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>Please correct the parameters on the left to see the simulation results.</span>
                  </div>
                ) : simResult ? (
                  <div className="space-y-3">
                    <div className="p-3.5 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1">
                      <p className="text-[10px] text-slate-500 uppercase">Projected Value at Target Date</p>
                      <p className="text-2xl font-black text-cyan-400">{formatCurrency(simResult.estimated_total_future_value)}</p>
                      <p className="text-[10px] text-slate-600 dark:text-slate-400">Target: <span className="font-semibold">{formatCurrency(simResult.target_amount)}</span></p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                        <p className="text-[10px] text-slate-500 uppercase">
                          {simResult.estimated_total_future_value >= simResult.target_amount ? 'Projected Surplus' : 'Projected Shortfall'}
                        </p>
                        <p className={`text-base font-bold ${simResult.estimated_total_future_value >= simResult.target_amount ? 'text-emerald-500 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'}`}>
                          {formatCurrency(Math.abs(simResult.estimated_total_future_value - simResult.target_amount))}
                        </p>
                      </div>
                      <div className="p-3 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800">
                        <p className="text-[10px] text-slate-500 uppercase">Required Contribution</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatCurrency(simResult.required_monthly_contribution)}/mo</p>
                      </div>
                    </div>

                    <div className="p-3.5 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase">Simulation Status</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span id="sim-status-badge" className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                            simProjection?.statusBadgeClass || (simResult.simulation_status === 'Goal Already Achieved 🎉' || simResult.simulation_status === 'Projected Target Achievable 🎉'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20')
                          }`}>
                            {simProjection?.statusLabel || simResult.simulation_status}
                          </span>
                        </div>
                      </div>
                      {simProjection?.statusType === 'reached_early' && simProjection.achievedDateLabel && (
                        <div id="sim-reached-early-banner" className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
                          <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
                          <span>Target reached by {simProjection.achievedDateLabel}</span>
                        </div>
                      )}
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                        {simProjection?.explanation || (
                          parseFloat(simForm.monthly_contribution || 0) === 0 ? (
                            simResult.estimated_total_future_value >= simResult.target_amount
                              ? "With zero monthly contribution, your current savings growth alone is projected to reach the goal target by the target date."
                              : `With zero monthly contribution, your current savings growth alone is not enough to reach the goal target. An additional monthly contribution of ${formatCurrency(simResult.required_monthly_contribution)}/mo is required.`
                          ) : simResult.simulation_status === 'Goal Already Achieved 🎉' ? (
                            "Your current savings have already reached or exceeded the goal target! No further contribution is simulated as required."
                          ) : simResult.simulation_status === 'Projected Target Achievable 🎉' ? (
                            "Based on the selected monthly contribution and expected return, your projected value is expected to exceed the goal target by the target date."
                          ) : (
                            "Your projected savings are significantly below the goal target. You need to increase your monthly contribution or extend the target date."
                          )
                        )}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Projected Wealth Growth Visual Graph */}
            <SimulationProjectionChart
              currentSaved={selectedGoal.current_amount}
              targetAmount={selectedGoal.target_amount}
              monthlyContribution={simForm.monthly_contribution}
              expectedReturnRate={simForm.expected_return_rate}
              targetDate={simForm.target_date}
              simResult={simResult}
              hasValidationErrors={Object.keys(validationErrors).length > 0}
            />
            
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 flex-wrap gap-3">
              <p className="text-[11px] text-slate-500 italic">* Simulation results do not modify the goal until saved.</p>
              <div className="flex items-center gap-2">
                <Button id="sim-close-btn" variant="secondary" onClick={() => setShowSimModal(false)} className="text-sm py-2 px-3">Close</Button>
                <Button 
                  id="sim-save-btn"
                  onClick={applySimulationToGoal} 
                  disabled={Object.keys(validationErrors).length > 0 || simLoading || !simResult}
                  className="text-sm py-2 px-4 flex items-center gap-1"
                >
                  Save to Goal <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}      </div>
    </PageTransition>
  );
};
