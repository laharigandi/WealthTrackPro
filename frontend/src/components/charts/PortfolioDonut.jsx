import React from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { useTheme } from '../../context/ThemeContext';

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = [
  'rgba(6, 182, 212, 0.85)',   // cyan
  'rgba(139, 92, 246, 0.85)',  // violet
  'rgba(16, 185, 129, 0.85)',  // emerald
  'rgba(245, 158, 11, 0.85)',  // amber
  'rgba(239, 68, 68, 0.85)',   // rose
];

const BORDER_COLORS = [
  'rgba(6, 182, 212, 1)',
  'rgba(139, 92, 246, 1)',
  'rgba(16, 185, 129, 1)',
  'rgba(245, 158, 11, 1)',
  'rgba(239, 68, 68, 1)',
];

export const PortfolioDonut = ({ labels = [], values = [], title = 'Portfolio Allocation', height = 240 }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const hasData = values.some((v) => v > 0);

  const data = {
    labels,
    datasets: [
      {
        data: hasData ? values : [1],
        backgroundColor: hasData ? COLORS.slice(0, labels.length) : (isDark ? ['rgba(51,65,85,0.4)'] : ['rgba(226,232,240,0.8)']),
        borderColor: hasData ? BORDER_COLORS.slice(0, labels.length) : (isDark ? ['rgba(71,85,105,0.3)'] : ['rgba(203,213,225,0.5)']),
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: isDark ? 'rgba(148, 163, 184, 1)' : 'rgba(71, 85, 105, 1)',
          font: { size: 12, family: 'Inter, system-ui, sans-serif' },
          padding: 12,
          usePointStyle: true,
          pointStyleWidth: 10,
        },
      },
      tooltip: {
        enabled: hasData,
        backgroundColor: isDark ? 'rgba(15,23,42,0.95)' : 'rgba(255,255,255,0.95)',
        titleColor: isDark ? '#e2e8f0' : '#0f172a',
        bodyColor: isDark ? '#94a3b8' : '#475569',
        borderColor: isDark ? 'rgba(51,65,85,0.8)' : 'rgba(226,232,240,0.8)',
        borderWidth: 1,
        padding: 12,
        bodyFont: { size: 13 },
        titleFont: { size: 14 },
        callbacks: {
          label: (ctx) => {
            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
            return `  ${ctx.label}: ${pct}%`;
          },
        },
      },
    },
  };

  return (
    <div style={{ height }} className="relative flex items-center justify-center">
      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-500 pointer-events-none">
          No holdings yet
        </div>
      )}
      <Doughnut data={data} options={options} />
    </div>
  );
};
