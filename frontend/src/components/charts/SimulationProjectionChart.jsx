import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { useTheme } from '../../context/ThemeContext';
import { formatCurrency, formatCompactCurrency } from '../../utils/formatters';
import { TrendingUp, CheckCircle2, AlertTriangle, Target, Sparkles, Clock } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/**
 * Helper to parse target date into a valid Date object.
 * Handles both "YYYY-MM-DD" and "YYYY" formats safely.
 */
export function parseTargetDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  let normalized = trimmed;
  if (/^\d{4}$/.test(trimmed)) {
    normalized = `${trimmed}-12-31`;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(normalized)) return null;

  const parts = normalized.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const d = new Date(year, month, day);
  if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) {
    return null;
  }
  return d;
}

/**
 * Format Date into "MMM YYYY" (e.g. "Sep 2026", "Dec 2031")
 */
export function formatMonthYear(d) {
  if (!d || isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    year: 'numeric',
  }).format(d);
}

/**
 * Centralized simulation projection calculation.
 * Generates exact month-by-month trajectory and determines achievement status.
 */
export function calculateSimulationProjection({
  currentSaved = 0,
  targetAmount = 0,
  monthlyContribution = 0,
  expectedReturnRate = 8,
  targetDate = '',
  simResult = null,
  hasValidationErrors = false,
}) {
  const parsedTargetDate = parseTargetDate(targetDate);
  if (hasValidationErrors || !parsedTargetDate) {
    return null;
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (parsedTargetDate < now) {
    return { isPast: true };
  }

  const currAmt = Math.max(0, parseFloat(currentSaved) || 0);
  const tgtAmt = Math.max(0, parseFloat(targetAmount) || 0);
  const pmt = Math.max(0, parseFloat(monthlyContribution) || 0);
  const rRate = Math.max(0, parseFloat(expectedReturnRate) || 0);

  const targetYear = parsedTargetDate.getFullYear();
  const targetMonth = parsedTargetDate.getMonth();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const monthsLeft = Math.max(1, (targetYear - currentYear) * 12 + (targetMonth - currentMonth));
  const monthlyR = (rRate / 100.0) / 12.0;

  const labels = [];
  const projectedSeries = [];
  const targetSeries = [];

  let achievedMonthIndex = -1;

  for (let m = 0; m <= monthsLeft; m++) {
    const pointDate = new Date(currentYear, currentMonth + m, 1);
    const label = m === monthsLeft ? formatMonthYear(parsedTargetDate) : formatMonthYear(pointDate);
    labels.push(label);

    let val = currAmt;
    if (m > 0) {
      if (monthlyR > 0) {
        const fvCurr = currAmt * Math.pow(1 + monthlyR, m);
        const fvPmt = pmt * ((Math.pow(1 + monthlyR, m) - 1) / monthlyR);
        val = fvCurr + fvPmt;
      } else {
        val = currAmt + (pmt * m);
      }
    }

    // Synchronize endpoint with backend calculation if available
    if (m === monthsLeft && simResult?.estimated_total_future_value != null && !isNaN(simResult.estimated_total_future_value)) {
      val = simResult.estimated_total_future_value;
    }

    const roundedVal = Math.round(val);
    projectedSeries.push(roundedVal);
    targetSeries.push(Math.round(tgtAmt));

    if (achievedMonthIndex === -1 && roundedVal >= tgtAmt && tgtAmt > 0) {
      achievedMonthIndex = m;
    }
  }

  const finalProjected = projectedSeries[projectedSeries.length - 1] || 0;
  const targetDateLabel = labels[labels.length - 1];

  let statusType = 'not_reached';
  let statusLabel = 'Not Reached by Target Date';
  let statusBadgeClass = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
  let achievedDateLabel = null;
  let explanation = '';

  if (currAmt >= tgtAmt && tgtAmt > 0) {
    statusType = 'already_achieved';
    statusLabel = 'Goal Already Achieved 🎉';
    statusBadgeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    achievedDateLabel = labels[0];
    explanation = `Your current savings of ${formatCurrency(currAmt)} have already reached or exceeded the goal target of ${formatCurrency(tgtAmt)}! No additional contributions required.`;
  } else if (achievedMonthIndex !== -1 && achievedMonthIndex < monthsLeft) {
    statusType = 'reached_early';
    statusLabel = 'Reached Early 🎉';
    statusBadgeClass = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    achievedDateLabel = labels[achievedMonthIndex];
    const diffMonths = monthsLeft - achievedMonthIndex;
    explanation = `Target reached by ${achievedDateLabel} (${diffMonths} month${diffMonths > 1 ? 's' : ''} ahead of your target date of ${targetDateLabel}).`;
  } else if (achievedMonthIndex === monthsLeft || (finalProjected >= tgtAmt && tgtAmt > 0)) {
    statusType = 'reached_on_target';
    statusLabel = 'Reached on Target Date 🎯';
    statusBadgeClass = 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20';
    achievedDateLabel = targetDateLabel;
    explanation = `Based on your monthly contribution and expected return, your projected wealth is expected to reach the goal target on your selected target date (${targetDateLabel}).`;
  } else {
    statusType = 'not_reached';
    statusLabel = 'Not Reached by Target Date';
    statusBadgeClass = 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
    achievedDateLabel = null;
    const shortfall = Math.max(0, tgtAmt - finalProjected);
    if (pmt === 0) {
      explanation = `With zero monthly contribution, your current savings growth alone is projected to reach ${formatCurrency(finalProjected)}, leaving a shortfall of ${formatCurrency(shortfall)}. Consider adding monthly contributions.`;
    } else {
      explanation = `Your projected wealth is expected to reach ${formatCurrency(finalProjected)} by ${targetDateLabel}, leaving a shortfall of ${formatCurrency(shortfall)}. Consider increasing your monthly contribution or extending the target date.`;
    }
  }

  return {
    labels,
    projectedSeries,
    targetSeries,
    finalProjected,
    isTargetAchieved: statusType !== 'not_reached',
    statusType,
    statusLabel,
    statusBadgeClass,
    achievedDateLabel,
    achievedMonthIndex,
    totalMonths: monthsLeft,
    explanation,
    targetDateLabel,
    shortfall: Math.max(0, tgtAmt - finalProjected),
  };
}

export const SimulationProjectionChart = ({
  currentSaved = 0,
  targetAmount = 0,
  monthlyContribution = 0,
  expectedReturnRate = 8,
  targetDate = '',
  simResult = null,
  hasValidationErrors = false,
  height = 280,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const projectionData = useMemo(() => {
    return calculateSimulationProjection({
      currentSaved,
      targetAmount,
      monthlyContribution,
      expectedReturnRate,
      targetDate,
      simResult,
      hasValidationErrors,
    });
  }, [currentSaved, targetAmount, monthlyContribution, expectedReturnRate, targetDate, simResult, hasValidationErrors]);

  if (hasValidationErrors || !projectionData) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-10 px-4 text-center rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-800">
        <AlertTriangle size={28} className="text-amber-500 mb-2 opacity-80" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Simulation Graph Unavailable
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
          Please correct the simulation parameters above to view the projected wealth growth trajectory.
        </p>
      </div>
    );
  }

  if (projectionData.isPast) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-10 px-4 text-center rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-dashed border-rose-300 dark:border-rose-900/40">
        <AlertTriangle size={28} className="text-rose-500 mb-2 opacity-80" />
        <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
          Target Date is in the Past
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
          Please select a future target date to generate the wealth projection curve.
        </p>
      </div>
    );
  }

  const {
    labels,
    projectedSeries,
    targetSeries,
    finalProjected,
    isTargetAchieved,
    statusType,
    statusLabel,
    statusBadgeClass,
    achievedDateLabel,
    shortfall,
  } = projectionData;

  const currAmt = Math.max(0, parseFloat(currentSaved) || 0);
  const tgtAmt = Math.max(0, parseFloat(targetAmount) || 0);

  // Styling based on status
  const isEarly = statusType === 'reached_early' || statusType === 'already_achieved';
  const lineColor = isEarly
    ? 'rgba(16, 185, 129, 1)'
    : isTargetAchieved
      ? 'rgba(6, 182, 212, 1)'
      : 'rgba(239, 68, 68, 1)';

  const areaGradient = isEarly
    ? 'rgba(16, 185, 129, 0.12)'
    : isTargetAchieved
      ? 'rgba(6, 182, 212, 0.12)'
      : 'rgba(239, 68, 68, 0.08)';

  const data = {
    labels,
    datasets: [
      {
        label: 'Target Amount',
        data: targetSeries,
        borderColor: isDark ? 'rgba(244, 63, 94, 0.85)' : 'rgba(225, 29, 72, 0.85)',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        pointHoverRadius: 4,
        pointHitRadius: 8,
        tension: 0,
        order: 2,
      },
      {
        label: 'Projected Value',
        data: projectedSeries,
        borderColor: lineColor,
        backgroundColor: areaGradient,
        borderWidth: 2.5,
        fill: true,
        pointRadius: (ctx) => {
          const idx = ctx.dataIndex;
          if (idx === 0 || idx === labels.length - 1) return 4;
          if (projectionData.achievedMonthIndex !== -1 && idx === projectionData.achievedMonthIndex) return 5;
          return 0;
        },
        pointHoverRadius: 6,
        pointBackgroundColor: lineColor,
        pointBorderColor: isDark ? '#0f172a' : '#ffffff',
        pointBorderWidth: 2,
        tension: 0.35,
        order: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: {
          color: isDark ? 'rgba(203, 213, 225, 1)' : 'rgba(51, 65, 85, 1)',
          font: { size: 12, weight: '600', family: 'Inter, system-ui, sans-serif' },
          padding: 12,
          usePointStyle: true,
          pointStyleWidth: 9,
          boxWidth: 9,
          boxHeight: 9,
        },
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.98)',
        titleColor: isDark ? '#f8fafc' : '#0f172a',
        bodyColor: isDark ? '#94a3b8' : '#334155',
        borderColor: isDark ? 'rgba(51, 65, 85, 0.8)' : 'rgba(226, 232, 240, 0.9)',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        usePointStyle: true,
        titleFont: { size: 13, weight: '700', family: 'Inter, system-ui, sans-serif' },
        bodyFont: { size: 12, weight: '500', family: 'Inter, system-ui, sans-serif' },
        callbacks: {
          title: (items) => {
            if (!items.length) return '';
            const idx = items[0].dataIndex;
            if (idx === 0) return `${items[0].label} (Starting Point)`;
            if (projectionData.achievedMonthIndex !== -1 && idx === projectionData.achievedMonthIndex && idx !== labels.length - 1) {
              return `${items[0].label} (🎯 Target Reached)`;
            }
            if (idx === labels.length - 1) return `${items[0].label} (Target Date)`;
            return items[0].label;
          },
          label: (ctx) => {
            const val = ctx.parsed.y;
            const formatted = formatCurrency(val, 0);
            return ` ${ctx.dataset.label}: ${formatted}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: isDark ? 'rgba(51, 65, 85, 0.25)' : 'rgba(226, 232, 240, 0.7)',
          drawTicks: false,
        },
        ticks: {
          color: isDark ? 'rgba(148, 163, 184, 1)' : 'rgba(100, 116, 139, 1)',
          font: { size: 11, family: 'Inter, system-ui, sans-serif' },
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 7,
          padding: 8,
        },
      },
      y: {
        grid: {
          color: isDark ? 'rgba(51, 65, 85, 0.25)' : 'rgba(226, 232, 240, 0.7)',
          drawTicks: false,
        },
        ticks: {
          color: isDark ? 'rgba(148, 163, 184, 1)' : 'rgba(100, 116, 139, 1)',
          font: { size: 11, family: 'Inter, system-ui, sans-serif' },
          padding: 8,
          callback: (value) => {
            if (value === null || value === undefined || isNaN(value)) return '₹0';
            return formatCompactCurrency(value);
          },
        },
      },
    },
  };

  return (
    <div className="space-y-3 pt-2">
      {/* Header and Live Status Pill */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <TrendingUp size={16} className="text-cyan-500" />
            Projected Wealth Growth
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Projected portfolio value compared with your financial goal.
          </p>
        </div>

        {/* Milestone badge */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${statusBadgeClass}`}>
            {statusType === 'reached_early' || statusType === 'already_achieved' ? (
              <CheckCircle2 size={12} />
            ) : statusType === 'reached_on_target' ? (
              <Target size={12} />
            ) : (
              <AlertTriangle size={12} />
            )}
            {statusLabel}
          </span>
          {statusType === 'reached_early' && achievedDateLabel && (
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/50">
              Target reached by {achievedDateLabel}
            </span>
          )}
          {statusType === 'not_reached' && (
            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-800/50">
              Shortfall of {formatCurrency(shortfall)}
            </span>
          )}
        </div>
      </div>

      {/* Chart Canvas */}
      <div
        style={{ height }}
        className="relative w-full rounded-2xl p-2.5 sm:p-3.5 bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 transition-colors"
      >
        <Line data={data} options={options} />
      </div>

      {/* Trajectory Insights Footer */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1 pt-1 flex-wrap gap-2">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />
          Starting from <strong className="text-slate-700 dark:text-slate-300 font-semibold">{formatCurrency(currAmt)}</strong>
        </span>
        <span>
          Final projected value: <strong className="text-cyan-600 dark:text-cyan-400 font-bold">{formatCurrency(finalProjected)}</strong>
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
          Target: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{formatCurrency(tgtAmt)}</strong>
        </span>
      </div>
    </div>
  );
};
