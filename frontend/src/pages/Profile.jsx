import React, { useState } from 'react';
import { CheckCircle2, AlertCircle, User, Mail, ShieldCheck, HelpCircle, X, Sparkles, Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateRiskProfile, updateKYCStatus } from '../services/userService';
import { Button } from '../components/common/Button';
import { formatDate } from '../utils/formatters';
import { PageTransition } from '../components/common/PageTransition';

const RISK_OPTIONS = [
  { value: 'conservative', label: 'Conservative', desc: 'Low risk tolerance, priority on capital preservation & stable returns', color: 'emerald' },
  { value: 'moderate',     label: 'Moderate',     desc: 'Balanced risk & reward, moderate growth over medium-to-long term', color: 'brand' },
  { value: 'aggressive',   label: 'Aggressive',   desc: 'High risk tolerance, maximum long-term growth potential',          color: 'rose' },
];

const colorMap = {
  emerald: { 
    active: 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400', 
    dot: 'bg-emerald-500 dark:bg-emerald-400' 
  },
  brand:   { 
    active: 'bg-cyan-50 border-cyan-300 dark:bg-cyan-950/20 dark:border-cyan-500/30 text-cyan-700 dark:text-cyan-400',       
    dot: 'bg-cyan-500 dark:bg-cyan-400'   
  },
  rose:    { 
    active: 'bg-rose-50 border-rose-300 dark:bg-rose-950/20 dark:border-rose-500/30 text-rose-700 dark:text-rose-400',          
    dot: 'bg-rose-500 dark:bg-rose-400'    
  },
};

const QUIZ_QUESTIONS = [
  {
    question: "What is your primary investment time horizon?",
    options: [
      { text: "Short-term (Less than 3 years)", score: 1 },
      { text: "Medium-term (3 to 7 years)", score: 2 },
      { text: "Long-term (More than 7 years)", score: 3 },
    ]
  },
  {
    question: "How would you react if your portfolio lost 15% in a market drop?",
    options: [
      { text: "Sell everything immediately to prevent further loss", score: 1 },
      { text: "Hold steady and wait for market recovery", score: 2 },
      { text: "Buy more shares at lower prices", score: 3 },
    ]
  },
  {
    question: "What is your primary financial goal priority?",
    options: [
      { text: "Protect principal investment with steady minimal growth", score: 1 },
      { text: "Balanced growth with moderate income generation", score: 2 },
      { text: "Maximize capital appreciation and wealth multiplication", score: 3 },
    ]
  }
];

export const Profile = () => {
  const { user, fetchUser } = useAuth();
  const [risk, setRisk] = useState(user?.risk_profile ?? 'moderate');
  const [msg, setMsg] = useState(null);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [loadingKYC, setLoadingKYC] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState([null, null, null]);
  const [calculatedProfile, setCalculatedProfile] = useState(null);

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const handleRiskChange = async (profile) => {
    if (profile === risk || loadingRisk) return;
    setLoadingRisk(true);
    try {
      setRisk(profile);
      await updateRiskProfile(profile);
      await fetchUser();
      showMsg('success', `Risk profile successfully updated to ${profile.toUpperCase()}.`);
    } catch {
      setRisk(user?.risk_profile ?? 'moderate');
      showMsg('error', 'Failed to update risk profile. Please try again.');
    } finally {
      setLoadingRisk(false);
    }
  };

  const handleKYCUpdate = async (newStatus) => {
    if (!user || loadingKYC) return;
    setLoadingKYC(true);
    try {
      await updateKYCStatus(newStatus);
      await fetchUser();
      showMsg('success', `KYC status updated to ${newStatus.toUpperCase()}.`);
    } catch {
      showMsg('error', 'Failed to update KYC status. Please try again.');
    } finally {
      setLoadingKYC(false);
    }
  };

  const handleQuizOption = (qIdx, score) => {
    const updated = [...quizAnswers];
    updated[qIdx] = score;
    setQuizAnswers(updated);

    if (updated.every((val) => val !== null)) {
      const totalScore = updated.reduce((a, b) => a + b, 0);
      let rec = 'moderate';
      if (totalScore <= 4) rec = 'conservative';
      else if (totalScore >= 7) rec = 'aggressive';
      setCalculatedProfile(rec);
    }
  };

  const applyQuizProfile = async () => {
    if (calculatedProfile) {
      await handleRiskChange(calculatedProfile);
      setShowQuiz(false);
      setQuizAnswers([null, null, null]);
      setCalculatedProfile(null);
    }
  };

  if (!user) return null;

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">User Profile & Risk Assessment</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Manage your account credentials, investor profile, and KYC compliance</p>
        </div>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center gap-2.5 transition-all font-semibold ${
            msg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-500/20 dark:text-emerald-400'
              : 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-500/20 dark:text-rose-400'
          }`}
        >
          {msg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {msg.text}
        </div>
      )}

      {/* Account Details */}
      <div className="card p-6 space-y-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
          <User size={16} className="text-cyan-600 dark:text-cyan-400" /> Account Details
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500 mb-1">Full Name</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user.name}</p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500 mb-1">Email Address</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user.email}</p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
            <p className="text-sm text-slate-500 mb-1">Account Created</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{formatDate(user.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Risk Profile */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Award size={16} className="text-cyan-600 dark:text-cyan-400" /> Investment Risk Profile
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-semibold">Select or calculate your investment risk tolerance</p>
          </div>
          <button
            onClick={() => setShowQuiz(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/20 text-sm font-semibold hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition-all cursor-pointer shadow-sm"
          >
            <Sparkles size={14} /> Risk Assessment Quiz
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {RISK_OPTIONS.map(({ value, label, desc, color }) => {
            const isActive = (user.risk_profile || risk) === value;
            const c = colorMap[color];
            return (
              <button
                key={value}
                onClick={() => handleRiskChange(value)}
                disabled={loadingRisk}
                className={`p-5 rounded-xl border text-left transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${
                  isActive
                    ? c.active + ' shadow-md ring-1 ring-cyan-500/10'
                    : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900/85'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isActive ? c.dot : 'bg-slate-400 dark:bg-slate-600'}`} />
                    <span className="font-bold text-sm capitalize">{label}</span>
                  </div>
                  {isActive && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm opacity-80 leading-relaxed font-semibold">{desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* KYC Status Management */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" /> KYC Verification Status
            </h2>
            <p className="text-sm text-slate-500 mt-1">Regulatory compliance and identity verification status</p>
          </div>
          <span
            className={`text-sm font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${
              user.kyc_status === 'verified'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-500/20'
                : user.kyc_status === 'rejected'
                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-500/20'
                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-500/20'
            }`}
          >
            {user.kyc_status}
          </span>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-650 dark:text-slate-400 leading-relaxed font-semibold">
            <p className="font-bold text-slate-800 dark:text-slate-350 mb-0.5">Verification Actions</p>
            Update your KYC verification status below to access elevated wealth products.
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              loading={loadingKYC}
              onClick={() => handleKYCUpdate('verified')}
              className="text-sm py-2 px-3 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
            >
              Verify KYC
            </Button>
            <Button
              variant="secondary"
              loading={loadingKYC}
              onClick={() => handleKYCUpdate('pending')}
              className="text-sm py-2 px-3 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
            >
              Mark Pending
            </Button>
            <Button
              variant="secondary"
              loading={loadingKYC}
              onClick={() => handleKYCUpdate('rejected')}
              className="text-sm py-2 px-3 border-rose-500/30 text-rose-700 dark:text-rose-455 hover:bg-rose-500/10 cursor-pointer"
            >
              Reject
            </Button>
          </div>
        </div>
      </div>

      {/* Risk Assessment Modal Quiz */}
      {showQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="card max-w-xl w-full p-6 space-y-6 relative border-cyan-200 dark:border-cyan-500/30 shadow-2xl bg-white dark:bg-slate-900 animate-fade-in">
            <button
              onClick={() => setShowQuiz(false)}
              className="absolute top-4 right-4 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              <X size={20} />
            </button>

            <div>
              <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400 mb-1">
                <Sparkles size={18} />
                <h3 className="font-bold text-2xl text-slate-900 dark:text-slate-100">Investor Risk Profile Assessment</h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Answer 3 quick questions to calculate your optimal risk tolerance.</p>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {QUIZ_QUESTIONS.map((q, idx) => (
                <div key={idx} className="p-4 bg-white/60 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {idx + 1}. {q.question}
                  </p>
                  <div className="space-y-1.5">
                    {q.options.map((opt, optIdx) => (
                      <button
                        key={optIdx}
                        onClick={() => handleQuizOption(idx, opt.score)}
                        className={`w-full text-left p-2.5 rounded-lg text-sm transition-all border cursor-pointer ${
                          quizAnswers[idx] === opt.score
                            ? 'bg-cyan-50 border-cyan-300 dark:bg-cyan-950/20 dark:border-cyan-500/30 text-cyan-700 dark:text-cyan-400 font-semibold'
                            : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/50 text-slate-700 dark:text-slate-400 hover:border-slate-350 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        {opt.text}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {calculatedProfile && (
              <div className="p-4 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Recommended Profile:</p>
                  <p className="text-base font-extrabold capitalize text-cyan-700 dark:text-cyan-400">{calculatedProfile}</p>
                </div>
                <Button onClick={applyQuizProfile} className="text-sm py-2 px-4 cursor-pointer">
                  Apply Recommended Profile
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </PageTransition>
  );
};
