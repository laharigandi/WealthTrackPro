/**
 * Format numbers into Indian currency style (e.g. ₹50,00,000 or ₹4,320.50)
 */
export const formatCurrency = (val, decimals = 0) => {
  if (val === null || val === undefined || isNaN(val)) return '₹0';
  const num = Number(val);
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(absNum);

  return `${isNegative ? '-' : ''}₹${formatted}`;
};

/**
 * Format percentage with + / - sign
 */
export const formatPercent = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '0.00%';
  const num = Number(val);
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
};

/**
 * Safe numeric formatter for fixed-point decimal values.
 * Guaranteed never to crash on undefined, null, NaN or non-numeric types.
 */
export const formatNumber = (val, decimals = 2) => {
  if (val === null || val === undefined || isNaN(val)) return (0).toFixed(decimals);
  const num = Number(val);
  return num.toFixed(decimals);
};

/**
 * Safe formatter for year durations (e.g. "4.5 Years").
 */
export const formatYears = (val, decimals = 1) => {
  return `${formatNumber(val, decimals)} Years`;
};

/**
 * Format date string into human readable format
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateStr;
  }
};

/**
 * Format numbers into Indian compact currency style (e.g. ₹50L or ₹2.5Cr)
 */
export const formatCompactCurrency = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '₹0';
  const num = Number(val);
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const formatted = new Intl.NumberFormat('en-IN', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 2,
  }).format(absNum);

  return `${isNegative ? '-' : ''}₹${formatted}`;
};

/**
 * Safely convert backend / Axios / Pydantic error responses into a human-readable string.
 * Ensures React NEVER attempts to render an object/array directly as a child.
 */
export const extractErrorMessage = (error, defaultMsg = 'An unexpected error occurred.') => {
  if (!error) return defaultMsg;

  // 1. Check if backend returned detail field (FastAPI standard)
  const detail = error.response?.data?.detail;

  if (Array.isArray(detail)) {
    // Pydantic validation error array: [{ type, loc, msg, input, ctx }]
    const messages = detail
      .map((item) => {
        if (!item) return '';
        if (typeof item === 'string') return item;
        let msg = item.msg || item.message || '';
        if (typeof msg === 'string') {
          // Clean standard Pydantic prefix "Value error, "
          if (msg.startsWith('Value error, ')) {
            msg = msg.replace('Value error, ', '');
          }
          return msg;
        }
        return 'Invalid input';
      })
      .filter(Boolean);

    if (messages.length > 0) {
      return messages.join(', ');
    }
  } else if (typeof detail === 'string') {
    let msg = detail;
    if (msg.startsWith('Value error, ')) {
      msg = msg.replace('Value error, ', '');
    }
    return msg;
  } else if (detail && typeof detail === 'object') {
    if (typeof detail.msg === 'string') return detail.msg;
    if (typeof detail.message === 'string') return detail.message;
  }

  // 2. Check standard response message
  const respMsg = error.response?.data?.message;
  if (typeof respMsg === 'string') {
    return respMsg;
  }

  // 3. Check error.message
  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return defaultMsg;
};

/**
 * Calculate individual goal progress percentage.
 * Formula: progress = (currentSaved / targetAmount) * 100
 * Handles zero division, string parsing, and caps between 0% and 100%.
 */
export const calculateGoalProgress = (goal) => {
  if (!goal) return 0;
  const target = typeof goal.target_amount === 'number' ? goal.target_amount : parseFloat(goal.target_amount);
  const current = typeof goal.current_amount === 'number' ? goal.current_amount : parseFloat(goal.current_amount);

  if (isNaN(target) || target <= 0) return 0;
  if (isNaN(current) || current <= 0) return 0;

  const pct = (current / target) * 100;
  return Math.min(100, Math.max(0, pct));
};

/**
 * Calculate average goal progress across active goals.
 * Formula: averageProgress = sum(goalProgress) / numberOfActiveGoals
 */
export const calculateAverageGoalProgress = (goalsList) => {
  if (!Array.isArray(goalsList) || goalsList.length === 0) return 0;

  const activeGoals = goalsList.filter((g) => {
    if (!g) return false;
    if (g.is_active === false) return false;
    if (g.status && g.status !== 'active' && g.status !== 'in_progress') return false;
    if (g.is_archived === true || g.is_deleted === true) return false;
    return true;
  });

  if (activeGoals.length === 0) return 0;

  const totalProgress = activeGoals.reduce((sum, g) => sum + calculateGoalProgress(g), 0);
  return totalProgress / activeGoals.length;
};
