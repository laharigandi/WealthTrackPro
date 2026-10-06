import React, { useState } from 'react';
import {
  Calculator,
  TrendingUp,
  Clock,
  DollarSign,
  PieChart as PieIcon,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { PageTransition } from '../components/common/PageTransition';
import {
  calculateSIP,
  calculateRetirement,
  calculateLoan,
} from '../services/calculatorService';
import {
  formatCurrency,
  formatCompactCurrency,
  extractErrorMessage,
  formatYears,
  formatNumber,
} from '../utils/formatters';

export const CalculatorsPage = () => {
  const [activeTab, setActiveTab] = useState('sip'); // 'sip' | 'retirement' | 'loan'

  return (
    <PageTransition>
      <div className="space-y-6 sm:space-y-8 pb-12">
        <div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Calculator className="text-cyan-500 shrink-0" size={28} /> Financial Calculators
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 sm:mt-2">
            Interactive mathematical models to plan your wealth accumulation, retirement, and debt management.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-4 sm:space-x-8 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('sip')}
            className={`pb-3 sm:pb-4 text-sm sm:text-base font-bold transition-all relative whitespace-nowrap cursor-pointer ${
              activeTab === 'sip'
                ? 'text-cyan-600 dark:text-cyan-400'
                : 'text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            SIP Calculator
            {activeTab === 'sip' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-600 dark:bg-cyan-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('retirement')}
            className={`pb-3 sm:pb-4 text-sm sm:text-base font-bold transition-all relative whitespace-nowrap cursor-pointer ${
              activeTab === 'retirement'
                ? 'text-cyan-600 dark:text-cyan-400'
                : 'text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Retirement Planner
            {activeTab === 'retirement' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-600 dark:bg-cyan-400" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('loan')}
            className={`pb-3 sm:pb-4 text-sm sm:text-base font-bold transition-all relative whitespace-nowrap cursor-pointer ${
              activeTab === 'loan'
                ? 'text-cyan-600 dark:text-cyan-400'
                : 'text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Loan Payoff
            {activeTab === 'loan' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-600 dark:bg-cyan-400" />
            )}
          </button>
        </div>

        {/* Dynamic Content */}
        <div className="card p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
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
    monthly_investment: '10000',
    duration_years: '10',
    expected_annual_return: '12',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const calculate = async () => {
    setError('');

    if (
      String(form.monthly_investment).trim() === '' ||
      String(form.duration_years).trim() === '' ||
      String(form.expected_annual_return).trim() === ''
    ) {
      setError('Please enter all required fields.');
      setResult(null);
      return;
    }

    const monthlyInvestment = Number(form.monthly_investment);
    const durationYears = Number(form.duration_years);
    const expectedReturn = Number(form.expected_annual_return);

    if (isNaN(monthlyInvestment) || monthlyInvestment < 0) {
      setError('Monthly investment cannot be negative.');
      setResult(null);
      return;
    }
    if (isNaN(durationYears) || durationYears <= 0) {
      setError('Duration must be greater than 0.');
      setResult(null);
      return;
    }
    if (isNaN(expectedReturn) || expectedReturn < 0) {
      setError('Expected return cannot be negative.');
      setResult(null);
      return;
    }

    try {
      setLoading(true);
      const data = await calculateSIP({
        monthly_investment: monthlyInvestment,
        duration_years: durationYears,
        expected_annual_return: expectedReturn,
      });
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(extractErrorMessage(err, 'Calculation failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
      <div className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2 sm:mb-4">SIP Details</h2>
        {error && <p className="text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-semibold">{error}</p>}
        <div>
          <label className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Monthly Investment (₹)</label>
          <input
            type="number"
            value={form.monthly_investment}
            onChange={(e) => setForm({ ...form, monthly_investment: e.target.value })}
            placeholder="e.g. 10000"
            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 text-sm sm:text-base font-semibold shadow-sm placeholder:text-slate-400"
          />
        </div>
        <div>
          <label className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Duration (Years)</label>
          <input
            type="number"
            value={form.duration_years}
            onChange={(e) => setForm({ ...form, duration_years: e.target.value })}
            placeholder="e.g. 10"
            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 text-sm sm:text-base font-semibold shadow-sm placeholder:text-slate-400"
          />
        </div>
        <div>
          <label className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Expected Return (%)</label>
          <input
            type="number"
            value={form.expected_annual_return}
            onChange={(e) => setForm({ ...form, expected_annual_return: e.target.value })}
            placeholder="e.g. 12"
            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 text-sm sm:text-base font-semibold shadow-sm placeholder:text-slate-400"
          />
        </div>
        <button
          onClick={calculate}
          disabled={loading}
          className="w-full bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-slate-950 font-bold py-3 rounded-xl mt-4 transition-colors disabled:opacity-50 cursor-pointer text-sm sm:text-base"
        >
          {loading ? 'Calculating...' : 'Calculate SIP'}
        </button>
      </div>

      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 flex flex-col justify-center min-h-[220px]">
        {result ? (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 uppercase font-bold tracking-wider">Future Value</h3>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-cyan-500 to-emerald-500 dark:from-cyan-400 dark:to-emerald-400 mt-2 break-words">
                {formatCurrency(result.future_value)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-6 border-t border-slate-200 dark:border-slate-800 pt-6">
              <div className="text-center">
                <p className="text-xs sm:text-sm text-slate-500 uppercase font-semibold">Total Invested</p>
                <p className="text-base sm:text-lg lg:text-xl font-bold text-slate-800 dark:text-slate-200 mt-1 break-words">{formatCurrency(result.total_invested)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs sm:text-sm text-slate-500 uppercase font-semibold">Est. Returns</p>
                <p className="text-base sm:text-lg lg:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 break-words">+{formatCurrency(result.estimated_returns)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-500 py-6">
            <TrendingUp size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-xs sm:text-sm">Enter details to see projection</p>
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
    current_age: '30',
    retirement_age: '60',
    current_monthly_expenses: '50000',
    current_savings: '100000',
    expected_inflation_rate: '6',
    expected_return_pre_retirement: '12',
    expected_return_post_retirement: '8',
    life_expectancy: '85',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const calculate = async () => {
    setError('');

    if (
      String(form.current_age).trim() === '' ||
      String(form.retirement_age).trim() === '' ||
      String(form.life_expectancy).trim() === '' ||
      String(form.expected_inflation_rate).trim() === '' ||
      String(form.current_monthly_expenses).trim() === '' ||
      String(form.current_savings).trim() === '' ||
      String(form.expected_return_pre_retirement).trim() === '' ||
      String(form.expected_return_post_retirement).trim() === ''
    ) {
      setError('Please enter all required fields.');
      setResult(null);
      return;
    }

    const currentAge = Number(form.current_age);
    const retirementAge = Number(form.retirement_age);
    const lifeExpectancy = Number(form.life_expectancy);
    const inflation = Number(form.expected_inflation_rate);
    const monthlyExpenses = Number(form.current_monthly_expenses);
    const currentSavings = Number(form.current_savings);
    const preReturn = Number(form.expected_return_pre_retirement);
    const postReturn = Number(form.expected_return_post_retirement);

    // Client-side validations
    if (isNaN(currentAge) || currentAge <= 0) {
      setError('Current age must be greater than 0.');
      setResult(null);
      return;
    }
    if (isNaN(retirementAge) || retirementAge <= currentAge) {
      setError('Retirement age must be greater than current age.');
      setResult(null);
      return;
    }
    if (isNaN(lifeExpectancy) || lifeExpectancy <= retirementAge) {
      setError('Life expectancy must be greater than retirement age.');
      setResult(null);
      return;
    }
    if (isNaN(inflation) || inflation < 0) {
      setError('Inflation cannot be negative.');
      setResult(null);
      return;
    }
    if (isNaN(monthlyExpenses) || monthlyExpenses < 0) {
      setError('Current monthly expenses cannot be negative.');
      setResult(null);
      return;
    }
    if (isNaN(currentSavings) || currentSavings < 0) {
      setError('Current savings cannot be negative.');
      setResult(null);
      return;
    }
    if (isNaN(preReturn) || preReturn < 0) {
      setError('Pre-retirement return cannot be negative.');
      setResult(null);
      return;
    }
    if (isNaN(postReturn) || postReturn < 0) {
      setError('Post-retirement return cannot be negative.');
      setResult(null);
      return;
    }

    try {
      setLoading(true);
      const data = await calculateRetirement({
        current_age: currentAge,
        retirement_age: retirementAge,
        life_expectancy: lifeExpectancy,
        expected_inflation_rate: inflation,
        current_monthly_expenses: monthlyExpenses,
        current_savings: currentSavings,
        expected_return_pre_retirement: preReturn,
        expected_return_post_retirement: postReturn,
      });
      setResult(data);
    } catch (err) {
      setResult(null);
      setError(extractErrorMessage(err, 'Unable to calculate retirement plan.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
      <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 sm:pr-2 custom-scrollbar">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2">Retirement Details</h2>
        {error && <p className="text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-semibold">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Current Age</label>
            <input
              type="number"
              value={form.current_age}
              onChange={(e) => setForm({ ...form, current_age: e.target.value })}
              placeholder="e.g. 30"
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm placeholder:text-slate-400"
            />
          </div>
          <div>
            <label className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Retirement Age</label>
            <input
              type="number"
              value={form.retirement_age}
              onChange={(e) => setForm({ ...form, retirement_age: e.target.value })}
              placeholder="e.g. 60"
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm placeholder:text-slate-400"
            />
          </div>
          <div>
            <label className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Life Expectancy</label>
            <input
              type="number"
              value={form.life_expectancy}
              onChange={(e) => setForm({ ...form, life_expectancy: e.target.value })}
              placeholder="e.g. 85"
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm placeholder:text-slate-400"
            />
          </div>
          <div>
            <label className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Inflation (%)</label>
            <input
              type="number"
              value={form.expected_inflation_rate}
              onChange={(e) => setForm({ ...form, expected_inflation_rate: e.target.value })}
              placeholder="e.g. 6"
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm placeholder:text-slate-400"
            />
          </div>
        </div>

        <div>
          <label className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Current Monthly Expenses (₹)</label>
          <input
            type="number"
            value={form.current_monthly_expenses}
            onChange={(e) => setForm({ ...form, current_monthly_expenses: e.target.value })}
            placeholder="e.g. 50000"
            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm placeholder:text-slate-400"
          />
        </div>
        <div>
          <label className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Current Savings (₹)</label>
          <input
            type="number"
            value={form.current_savings}
            onChange={(e) => setForm({ ...form, current_savings: e.target.value })}
            placeholder="e.g. 100000"
            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm placeholder:text-slate-400"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Return Pre-Retire (%)</label>
            <input
              type="number"
              value={form.expected_return_pre_retirement}
              onChange={(e) => setForm({ ...form, expected_return_pre_retirement: e.target.value })}
              placeholder="e.g. 12"
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm placeholder:text-slate-400"
            />
          </div>
          <div>
            <label className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Return Post-Retire (%)</label>
            <input
              type="number"
              value={form.expected_return_post_retirement}
              onChange={(e) => setForm({ ...form, expected_return_post_retirement: e.target.value })}
              placeholder="e.g. 8"
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm placeholder:text-slate-400"
            />
          </div>
        </div>

        <button
          onClick={calculate}
          disabled={loading}
          className="w-full bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-slate-950 font-bold py-3 rounded-xl mt-4 transition-colors disabled:opacity-50 cursor-pointer text-sm sm:text-base"
        >
          {loading ? 'Calculating...' : 'Calculate Retirement'}
        </button>
      </div>

      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 flex flex-col justify-center min-h-[220px]">
        {result ? (
          <div className="space-y-4 sm:space-y-5">
            <div>
              <h3 className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 uppercase font-bold tracking-wider">Required Corpus</h3>
              <p className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 via-cyan-500 to-emerald-500 dark:from-cyan-400 dark:to-emerald-400 mt-1 break-words">
                {formatCurrency(result.required_retirement_corpus)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 border-t border-slate-200 dark:border-slate-800 pt-3 sm:pt-4">
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Expected Corpus</p>
                <p className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200 mt-0.5 break-words">{formatCompactCurrency(result.expected_corpus_from_savings)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Shortfall</p>
                <p className="text-base sm:text-lg font-bold text-rose-500 dark:text-rose-400 mt-0.5 break-words">{formatCompactCurrency(result.shortfall)}</p>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 sm:pt-4">
              <p className="text-xs text-slate-500 uppercase font-semibold">Additional SIP Required</p>
              <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 break-words">
                {formatCurrency(result.additional_monthly_investment_required)} / month
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 border-t border-slate-200 dark:border-slate-800 pt-3 sm:pt-4">
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Years to Retire</p>
                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5">{result.years_to_retirement} years</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Est. Monthly Expense</p>
                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mt-0.5 break-words">{formatCurrency(result.estimated_monthly_expense_at_retirement)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-500 py-6">
            <Clock size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-xs sm:text-sm">Enter details to estimate corpus</p>
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
    loan_amount: '5000000',
    annual_interest_rate: '8.5',
    loan_tenure_years: '20',
    extra_monthly_payment: '5000',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const calculate = async () => {
    setError('');

    if (
      String(form.loan_amount ?? '').trim() === '' ||
      String(form.annual_interest_rate ?? '').trim() === '' ||
      String(form.loan_tenure_years ?? '').trim() === ''
    ) {
      setError('Please enter all required fields.');
      setResult(null);
      return;
    }

    const loanAmount = Number(form.loan_amount);
    const annualInterestRate = Number(form.annual_interest_rate);
    const loanTenureYears = Number(form.loan_tenure_years);
    const rawExtra = String(form.extra_monthly_payment ?? '').trim();
    const extraMonthlyPayment = rawExtra === '' ? 0 : Number(rawExtra);

    if (isNaN(loanAmount) || !isFinite(loanAmount) || loanAmount <= 0) {
      setError('Loan amount must be greater than 0.');
      setResult(null);
      return;
    }
    if (isNaN(annualInterestRate) || !isFinite(annualInterestRate) || annualInterestRate < 0) {
      setError('Interest rate cannot be negative.');
      setResult(null);
      return;
    }
    if (isNaN(loanTenureYears) || !isFinite(loanTenureYears) || loanTenureYears <= 0) {
      setError('Tenure must be greater than 0.');
      setResult(null);
      return;
    }
    if (isNaN(extraMonthlyPayment) || !isFinite(extraMonthlyPayment) || extraMonthlyPayment < 0) {
      setError('Extra monthly payment cannot be negative.');
      setResult(null);
      return;
    }

    try {
      setLoading(true);
      const data = await calculateLoan({
        loan_amount: loanAmount,
        annual_interest_rate: annualInterestRate,
        loan_tenure_years: loanTenureYears,
        extra_monthly_payment: extraMonthlyPayment,
      });
      setResult(data);
    } catch (err) {
      setResult(null);
      if (process.env.NODE_ENV === 'development') {
        console.error('Loan calculation error:', err);
      }
      setError(extractErrorMessage(err, 'Unable to calculate loan payoff. Please check your loan details.'));
    } finally {
      setLoading(false);
    }
  };

  const extraAmount = Number(form.extra_monthly_payment) || 0;
  const timeSavedYearsVal = result
    ? typeof result.time_saved_years === 'number'
      ? result.time_saved_years
      : Number(result.time_saved_months || 0) / 12
    : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
      <div className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2 sm:mb-4">Loan Details</h2>
        {error && <p className="text-rose-600 dark:text-rose-400 text-xs sm:text-sm font-semibold">{error}</p>}

        <div>
          <label className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Loan Amount (₹)</label>
          <input
            type="number"
            min="0"
            step="any"
            value={form.loan_amount}
            onChange={(e) => setForm({ ...form, loan_amount: e.target.value })}
            placeholder="e.g. 5000000"
            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm placeholder:text-slate-400"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <label className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Interest (%)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.annual_interest_rate}
              onChange={(e) => setForm({ ...form, annual_interest_rate: e.target.value })}
              placeholder="e.g. 8.5"
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm placeholder:text-slate-400"
            />
          </div>
          <div>
            <label className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Tenure (Years)</label>
            <input
              type="number"
              min="0"
              step="any"
              value={form.loan_tenure_years}
              onChange={(e) => setForm({ ...form, loan_tenure_years: e.target.value })}
              placeholder="e.g. 20"
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm placeholder:text-slate-400"
            />
          </div>
        </div>
        <div>
          <label className="text-xs sm:text-sm font-semibold text-cyan-600 dark:text-cyan-400 uppercase">Extra Monthly Payment (₹)</label>
          <input
            type="number"
            min="0"
            step="any"
            value={form.extra_monthly_payment}
            onChange={(e) => setForm({ ...form, extra_monthly_payment: e.target.value })}
            placeholder="e.g. 5000 (Optional)"
            className="w-full bg-white dark:bg-slate-800 border border-cyan-500 dark:border-cyan-700/50 rounded-xl p-3 text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100 mt-1 focus:outline-none focus:border-cyan-500 dark:focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 dark:focus:ring-cyan-400 transition-all duration-200 shadow-sm placeholder:text-slate-400"
          />
          <p className="text-xs text-slate-500 mt-1">Optional. Pay more each month to finish faster.</p>
        </div>

        <button
          onClick={calculate}
          disabled={loading}
          className="w-full bg-cyan-500 hover:bg-cyan-600 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-slate-950 font-bold py-3 rounded-xl mt-4 transition-colors disabled:opacity-50 cursor-pointer text-sm sm:text-base"
        >
          {loading ? 'Calculating...' : 'Calculate Payoff'}
        </button>
      </div>

      <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-6 flex flex-col justify-center min-h-[220px]">
        {result ? (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-white/50 dark:bg-slate-900/50 p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <h3 className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-bold">Standard EMI</h3>
              <p className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white break-words">
                {formatCurrency(result.monthly_emi)}
              </p>
            </div>

            {extraAmount > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-500/20 p-3 sm:p-4 rounded-xl space-y-3 sm:space-y-4">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400">Total Interest Saved</span>
                  <span className="text-lg sm:text-2xl font-bold text-emerald-700 dark:text-emerald-400 break-words">
                    {formatCurrency(result.interest_saved)}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400">Time Saved</span>
                  <span className="text-base sm:text-xl font-bold text-emerald-700 dark:text-emerald-400">
                    {formatYears(timeSavedYearsVal, 1)}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:gap-4 border-t border-slate-200 dark:border-slate-800 pt-3 sm:pt-4">
              <div>
                <p className="text-xs sm:text-sm text-slate-500">Total Interest</p>
                <p className="text-sm sm:text-lg font-bold text-slate-800 dark:text-slate-200 break-words">
                  {formatCurrency(result.total_interest_paid ?? result.total_interest_new ?? result.total_interest_original)}
                </p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-slate-500">Total Payment</p>
                <p className="text-sm sm:text-lg font-bold text-slate-800 dark:text-slate-200 break-words">
                  {formatCurrency(result.total_payment ?? result.total_payable_new ?? result.total_payable_original)}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-slate-500 py-6">
            <DollarSign size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-xs sm:text-sm">Enter details to estimate payoff</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalculatorsPage;
