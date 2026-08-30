import React, { useState } from 'react';
import { Calculator, TrendingUp, Briefcase, Landmark } from 'lucide-react';
import { calculateSIP, calculateRetirement, calculateLoan } from '../services/calculatorService';
import { formatCurrency, formatCompactCurrency } from '../utils/formatters';
import { PageTransition } from '../components/common/PageTransition';

const TABS = [
  { id: 'sip', name: 'SIP Calculator', icon: TrendingUp },
  { id: 'retirement', name: 'Retirement Calculator', icon: Briefcase },
  { id: 'loan', name: 'Loan Payoff', icon: Landmark },
];

export const CalculatorsPage = () => {
  const [activeTab, setActiveTab] = useState('sip');

  return (
    <PageTransition>
      <div className="space-y-6 text-slate-800 dark:text-slate-200 w-full h-full">
          <header className="mb-6">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator className="text-cyan-600 dark:text-cyan-400" />
              Financial Calculators
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Plan your investments, retirement, and loan payoff effectively.
            </p>
          </header>

          {/* TABS */}
          <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-px mb-6 overflow-x-auto no-scrollbar">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-all ${
                  activeTab === tab.id 
                    ? 'border-cyan-500 text-cyan-700 dark:border-cyan-400 dark:text-cyan-400 font-bold'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:border-slate-700'
                }`}
              >
                <tab.icon size={16} />
                {tab.name}
              </button>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 md:p-6 shadow-xl backdrop-blur-sm">
            {activeTab === 'sip' && <SIPCalculator />}
            {activeTab === 'retirement' && <RetirementCalculator />}
            {activeTab === 'loan' && <LoanCalculator />}
          </div>
      </div>
    </PageTransition>
  );
};

// -------------------------------------------------------------
// SIP CALCULATOR
// -------------------------------------------------------------
const SIPCalculator = () => {
  const [form, setForm] = useState({
    monthly_investment: 10000,
    duration_years: 10,
    expected_annual_return: 12
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const calculate = async () => {
    try {
      setError('');
      const data = await calculateSIP(form);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Calculation failed');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">SIP Details</h2>
        {error && <p className="text-rose-600 dark:text-rose-400 text-sm font-semibold">{error}</p>}
        <div>
          <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Monthly Investment (₹)</label>
          <input 
            type="number" 
            value={form.monthly_investment} 
            onChange={e => setForm({...form, monthly_investment: Number(e.target.value)})}
            className="w-full bg-white dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 text-base font-semibold shadow-sm"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Duration (Years)</label>
          <input 
            type="number" 
            value={form.duration_years} 
            onChange={e => setForm({...form, duration_years: Number(e.target.value)})}
            className="w-full bg-white dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 text-base font-semibold shadow-sm"
          />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Expected Return (%)</label>
          <input 
            type="number" 
            value={form.expected_annual_return} 
            onChange={e => setForm({...form, expected_annual_return: Number(e.target.value)})}
            className="w-full bg-white dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 text-base font-semibold shadow-sm"
          />
        </div>
        <button 
          onClick={calculate}
          className="w-full bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-slate-950 font-bold py-3 rounded-xl mt-4 transition-colors"
        >
          Calculate SIP
        </button>
      </div>

      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-center">
        {result ? (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-sm text-slate-600 dark:text-slate-400 uppercase font-bold tracking-wider">Future Value</h3>
              <p className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-cyan-500 to-emerald-500 dark:from-cyan-400 dark:to-emerald-400 mt-2">
                {formatCurrency(result.future_value)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6 border-t border-slate-200 dark:border-slate-800 pt-6">
              <div className="text-center">
                <p className="text-sm text-slate-500 uppercase font-semibold">Total Invested</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-200 mt-1">{formatCurrency(result.total_invested)}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-500 uppercase font-semibold">Est. Returns</p>
                <p className="text-xl font-bold text-emerald-650 dark:text-emerald-400 mt-1">+{formatCurrency(result.estimated_returns)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-500">
            <TrendingUp size={48} className="mx-auto mb-4 opacity-20" />
            <p>Enter details to see projection</p>
          </div>
        )}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// RETIREMENT CALCULATOR
// -------------------------------------------------------------
const RetirementCalculator = () => {
  const [form, setForm] = useState({
    current_age: 30,
    retirement_age: 60,
    current_monthly_expenses: 50000,
    current_savings: 100000,
    expected_inflation_rate: 6,
    expected_return_pre_retirement: 12,
    expected_return_post_retirement: 8,
    life_expectancy: 85
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const calculate = async () => {
    try {
      setError('');
      const data = await calculateRetirement(form);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Calculation failed');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Retirement Details</h2>
        {error && <p className="text-rose-650 dark:text-rose-400 text-sm font-semibold">{error}</p>}
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Current Age</label>
            <input type="number" value={form.current_age} onChange={e => setForm({...form, current_age: Number(e.target.value)})} className="w-full bg-white dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded-xl p-2.5 text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm"/>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Retirement Age</label>
            <input type="number" value={form.retirement_age} onChange={e => setForm({...form, retirement_age: Number(e.target.value)})} className="w-full bg-white dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded-xl p-2.5 text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm"/>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Life Expectancy</label>
            <input type="number" value={form.life_expectancy} onChange={e => setForm({...form, life_expectancy: Number(e.target.value)})} className="w-full bg-white dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded-xl p-2.5 text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm"/>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Inflation (%)</label>
            <input type="number" value={form.expected_inflation_rate} onChange={e => setForm({...form, expected_inflation_rate: Number(e.target.value)})} className="w-full bg-white dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded-xl p-2.5 text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm"/>
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Current Monthly Expenses (₹)</label>
          <input type="number" value={form.current_monthly_expenses} onChange={e => setForm({...form, current_monthly_expenses: Number(e.target.value)})} className="w-full bg-white dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded-xl p-2.5 text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm"/>
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Current Savings (₹)</label>
          <input type="number" value={form.current_savings} onChange={e => setForm({...form, current_savings: Number(e.target.value)})} className="w-full bg-white dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded-xl p-2.5 text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm"/>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Return Pre-Retire (%)</label>
            <input type="number" value={form.expected_return_pre_retirement} onChange={e => setForm({...form, expected_return_pre_retirement: Number(e.target.value)})} className="w-full bg-white dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded-xl p-2.5 text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm"/>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Return Post-Retire (%)</label>
            <input type="number" value={form.expected_return_post_retirement} onChange={e => setForm({...form, expected_return_post_retirement: Number(e.target.value)})} className="w-full bg-white dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded-xl p-2.5 text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm"/>
          </div>
        </div>

        <button onClick={calculate} className="w-full bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-slate-950 font-bold py-3 rounded-xl mt-4 transition-colors">
          Calculate Retirement
        </button>
      </div>

      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-center">
        {result ? (
          <div className="space-y-5">
            <div className="text-center bg-white/50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm text-slate-600 dark:text-slate-400 uppercase font-bold tracking-wider">Required Corpus</h3>
              <p className="text-4xl font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(result.required_retirement_corpus)}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                <h3 className="text-xs text-slate-650 dark:text-slate-400 uppercase font-bold tracking-wider">Expected Corpus</h3>
                <p className="text-xl font-bold text-cyan-600 dark:text-cyan-400 mt-1">{formatCompactCurrency(result.expected_corpus_from_savings)}</p>
              </div>
              <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                <h3 className="text-xs text-slate-650 dark:text-slate-400 uppercase font-bold tracking-wider">Shortfall</h3>
                <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">{formatCompactCurrency(result.shortfall)}</p>
              </div>
            </div>

            {result.shortfall > 0 && (
              <div className="bg-gradient-to-r from-rose-500/10 to-transparent border-l-2 border-rose-500 p-4 rounded-r-xl bg-rose-50 dark:bg-rose-950/20">
                <h3 className="text-sm text-rose-700 dark:text-rose-400 uppercase font-bold tracking-wider">Additional SIP Required</h3>
                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{formatCurrency(result.additional_monthly_investment_required)} <span className="text-sm font-normal text-slate-600 dark:text-slate-400">/ month</span></p>
              </div>
            )}
            
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <p className="text-sm text-slate-600 dark:text-slate-400 flex justify-between">
                  <span>Years to retire: <strong>{result.years_to_retirement}</strong></span>
                  <span>Est. Monthly Expense: <strong>{formatCurrency(result.estimated_monthly_expense_at_retirement)}</strong></span>
                </p>
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-500">
            <Briefcase size={48} className="mx-auto mb-4 opacity-20" />
            <p>Enter details to estimate corpus</p>
          </div>
        )}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// LOAN PAYOFF CALCULATOR
// -------------------------------------------------------------
const LoanCalculator = () => {
  const [form, setForm] = useState({
    loan_amount: 5000000,
    annual_interest_rate: 8.5,
    loan_tenure_years: 20,
    extra_monthly_payment: 5000
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const calculate = async () => {
    try {
      setError('');
      const data = await calculateLoan(form);
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Calculation failed');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Loan Details</h2>
        {error && <p className="text-rose-650 dark:text-rose-400 text-sm font-semibold">{error}</p>}
        
        <div>
          <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Loan Amount (₹)</label>
          <input type="number" value={form.loan_amount} onChange={e => setForm({...form, loan_amount: Number(e.target.value)})} className="w-full bg-white dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded-xl p-3 text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm"/>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Interest (%)</label>
            <input type="number" value={form.annual_interest_rate} onChange={e => setForm({...form, annual_interest_rate: Number(e.target.value)})} className="w-full bg-white dark:bg-slate-800 border border-slate-350 dark:border-slate-700 rounded-xl p-3 text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm"/>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Tenure (Years)</label>
            <input type="number" value={form.loan_tenure_years} onChange={e => setForm({...form, loan_tenure_years: Number(e.target.value)})} className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm"/>
          </div>
        </div>
        <div>
          <label className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 uppercase">Extra Monthly Payment (₹)</label>
          <input type="number" value={form.extra_monthly_payment} onChange={e => setForm({...form, extra_monthly_payment: Number(e.target.value)})} className="w-full bg-white dark:bg-slate-800 border border-cyan-500 dark:border-cyan-700/50 rounded-xl p-3 text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm"/>
          <p className="text-xs text-slate-500 mt-1">Optional. Pay more each month to finish faster.</p>
        </div>

        <button onClick={calculate} className="w-full bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-slate-950 font-bold py-3 rounded-xl mt-4 transition-colors">
          Calculate Payoff
        </button>
      </div>

      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col justify-center">
        {result ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-white/50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-sm text-slate-600 dark:text-slate-400 font-bold">Standard EMI</h3>
              <p className="text-4xl font-bold text-slate-900 dark:text-white">{formatCurrency(result.monthly_emi)}</p>
            </div>
            
            {form.extra_monthly_payment > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-500/20 p-4 rounded-xl space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Total Interest Saved</span>
                  <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(result.interest_saved)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Time Saved</span>
                  <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                    {Math.floor(result.time_saved_months / 12)} yrs {result.time_saved_months % 12} mo
                  </span>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div>
                <p className="mb-1">Total Payable (Standard)</p>
                <p className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(result.total_payable_original)}</p>
              </div>
              <div>
                <p className="mb-1">Total Payable (New)</p>
                <p className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(result.total_payable_new)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-500">
            <Landmark size={48} className="mx-auto mb-4 opacity-20" />
            <p>Enter details to estimate loan payoff</p>
          </div>
        )}
      </div>
    </div>
  );
};
