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
