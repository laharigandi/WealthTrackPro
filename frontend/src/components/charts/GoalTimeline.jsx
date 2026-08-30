import React from 'react';
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export const GoalTimeline = ({
  labels = [],
  currentSavings = [],
  targetLine = [],
  projectedSIP = [],
  height = 260,
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const data = {
    labels,
    datasets: [
      {
        label: 'Target Amount',
        data: targetLine,
        borderColor: 'rgba(239,68,68,0.8)',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [6, 3],
        pointRadius: 0,
        tension: 0,
      },
      {
        label: 'Projected (SIP + Savings)',
        data: projectedSIP,
        borderColor: 'rgba(6,182,212,1)',
        backgroundColor: 'rgba(6,182,212,0.08)',
        borderWidth: 2.5,
        pointRadius: 3,
        pointBackgroundColor: 'rgba(6,182,212,1)',
        fill: true,
        tension: 0.4,
      },
      {
        label: 'Savings Growth',
        data: currentSavings,
        borderColor: 'rgba(16,185,129,0.7)',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [3, 3],
        pointRadius: 0,
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: isDark ? 'rgba(148,163,184,1)' : 'rgba(71, 85, 105, 1)',
          font: { size: 12, family: 'Inter, system-ui, sans-serif' },
          padding: 12,
          usePointStyle: true,
          pointStyleWidth: 10,
        },
      },
      tooltip: {
        backgroundColor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)',
        titleColor: isDark ? '#e2e8f0' : '#0f172a',
        bodyColor: isDark ? '#94a3b8' : '#475569',
        borderColor: isDark ? 'rgba(51,65,85,0.8)' : 'rgba(226,232,240,0.8)',
        borderWidth: 1,
        padding: 12,
        titleFont: { size: 14 },
        bodyFont: { size: 13 },
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed.y;
            const formatted = new Intl.NumberFormat('en-IN', {
              style: 'currency',
              currency: 'INR',
              maximumFractionDigits: 0,
            }).format(val);
            return `  ${ctx.dataset.label}: ${formatted}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { color: isDark ? 'rgba(51,65,85,0.3)' : 'rgba(226,232,240,0.6)' },
        ticks: { color: isDark ? 'rgba(100,116,139,1)' : 'rgba(71,85,105,1)', font: { size: 11 } },
      },
      y: {
        grid: { color: isDark ? 'rgba(51,65,85,0.3)' : 'rgba(226,232,240,0.6)' },
        ticks: {
          color: isDark ? 'rgba(100,116,139,1)' : 'rgba(71,85,105,1)',
          font: { size: 11 },
          callback: (v) =>
            new Intl.NumberFormat('en-IN', {
              notation: 'compact',
              maximumFractionDigits: 1,
            }).format(v),
        },
      },
    },
  };

  return (
    <div style={{ height }}>
      <Line data={data} options={options} />
    </div>
  );
};
