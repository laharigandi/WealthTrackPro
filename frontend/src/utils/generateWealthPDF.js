import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ============================================================================
// CANONICAL TARGET ALLOCATIONS (MIRRORS BACKEND ADVISOR SERVICE)
// ============================================================================
export const TARGET_ALLOCATIONS = {
  conservative: {
    'Stock': 15.0,
    'ETF': 10.0,
    'Mutual Fund': 15.0,
    'Bond': 45.0,
    'Crypto': 0.0,
    'Cash': 15.0,
  },
  moderate: {
    'Stock': 40.0,
    'ETF': 25.0,
    'Mutual Fund': 0.0,
    'Bond': 25.0,
    'Crypto': 0.0,
    'Cash': 10.0,
  },
  aggressive: {
    'Stock': 55.0,
    'ETF': 20.0,
    'Mutual Fund': 10.0,
    'Bond': 5.0,
    'Crypto': 10.0,
    'Cash': 0.0,
  },
};

export const STANDARD_ASSET_CLASSES = ['Stock', 'ETF', 'Bond', 'Cash', 'Mutual Fund', 'Crypto'];
export const DEVIATION_THRESHOLD = 5.0;

// Asset Palette definition
export const ASSET_PALETTE = {
  'Stock': { bg: [224, 242, 254], text: [3, 105, 161], color: [56, 189, 248] },       // Sky Blue #38BDF8
  'ETF': { bg: [243, 232, 255], text: [126, 34, 206], color: [168, 85, 247] },       // Purple #A855F7
  'Bond': { bg: [254, 243, 199], text: [180, 83, 9], color: [245, 158, 11] },        // Amber #F59E0B
  'Cash': { bg: [241, 245, 249], text: [51, 65, 85], color: [100, 116, 139] },       // Slate #64748B
  'Mutual Fund': { bg: [238, 242, 255], text: [67, 56, 202], color: [99, 102, 241] }, // Indigo #6366F1
  'Crypto': { bg: [253, 242, 248], text: [190, 24, 93], color: [236, 72, 153] },     // Pink #EC4899
};

// ============================================================================
// DATA NORMALIZATION & FORMATTING HELPERS
// ============================================================================

export function safeNumber(val) {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) || !isFinite(num) ? 0 : num;
}

export function formatINR(value, showSign = false) {
  const num = safeNumber(value);
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(absNum);

  if (isNegative) {
    return 'Rs. -' + formatted;
  }
  if (showSign && num > 0) {
    return 'Rs. +' + formatted;
  }
  return 'Rs. ' + formatted;
}

export function formatPercent(value, showSign = false, decimals = 2) {
  const num = safeNumber(value);
  const formatted = num.toFixed(decimals) + '%';
  if (showSign && num > 0) {
    return '+' + formatted;
  }
  return formatted;
}

export function formatDrift(value) {
  const num = safeNumber(value);
  if (Math.abs(num) < 0.005) {
    return '0.00 pp';
  }
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)} pp`;
}

export function formatNumber(value) {
  const num = safeNumber(value);
  return new Intl.NumberFormat('en-IN').format(num);
}

export function formatDate(dateVal) {
  if (!dateVal) return 'N/A';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return sanitizePDFText(String(dateVal));
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return sanitizePDFText(String(dateVal));
  }
}

/**
 * Sanitize text to ensure clean, corruption-free rendering in standard jsPDF fonts.
 * Strips emoji surrogates, translates currency glyphs to Rs., removes non-ASCII control characters.
 */
export function sanitizePDFText(str) {
  if (str === null || str === undefined) return '';
  let s = String(str);

  // Replace Rupee symbol ₹ (U+20B9) with 'Rs. '
  s = s.replace(/\u20B9/g, 'Rs. ');

  // Standardize typographical punctuation to standard ASCII
  s = s.replace(/[\u2018\u2019]/g, "'")
       .replace(/[\u201C\u201D]/g, '"')
       .replace(/[\u2013\u2014]/g, '-')
       .replace(/\u2026/g, '...')
       .replace(/\u00A0/g, ' ');

  // Strip all emojis, pictographs, variation selectors, and surrogate pairs
  s = s.replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
       .replace(/[\u{2600}-\u{27BF}]/gu, '')
       .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
       .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
       .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
       .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
       .replace(/[\u{200D}\u{200C}]/gu, '');

  // Remove any remaining non-printable / control / non-Latin-1 characters
  s = s.replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');

  // Collapse multiple spaces
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

export function normalizeAssetType(rawType) {
  if (!rawType) return 'Stock';
  const t = String(rawType).trim().toLowerCase();
  if (t === 'etf') return 'ETF';
  if (t.includes('mutual') || t === 'mf' || t === 'mfs') return 'Mutual Fund';
  if (t.includes('bond') || t.includes('debt') || t.includes('fixed deposit') || t === 'fd') return 'Bond';
  if (t.includes('cash') || t.includes('liquid')) return 'Cash';
  if (t.includes('crypto')) return 'Crypto';
  return 'Stock';
}

// ============================================================================
// VECTOR DONUT CHART DRAWING HELPER
// ============================================================================

export function drawVectorDonutChart(doc, cx, cy, outerR, innerR, segments) {
  let currentAngle = -Math.PI / 2; // Start at 12 o'clock

  segments.forEach(seg => {
    if (seg.pct <= 0.05) return;
    const sweepAngle = (seg.pct / 100) * 2 * Math.PI;
    const endAngle = currentAngle + sweepAngle;
    const numSteps = Math.max(12, Math.ceil(sweepAngle * 36));
    const stepAngle = sweepAngle / numSteps;

    doc.setFillColor(seg.color[0], seg.color[1], seg.color[2]);
    doc.setDrawColor(seg.color[0], seg.color[1], seg.color[2]);
    doc.setLineWidth(0.15);

    for (let i = 0; i < numSteps; i++) {
      const t1 = currentAngle + i * stepAngle;
      const t2 = currentAngle + (i + 1) * stepAngle;

      const x1_in = cx + innerR * Math.cos(t1);
      const y1_in = cy + innerR * Math.sin(t1);
      const x1_out = cx + outerR * Math.cos(t1);
      const y1_out = cy + outerR * Math.sin(t1);

      const x2_in = cx + innerR * Math.cos(t2);
      const y2_in = cy + innerR * Math.sin(t2);
      const x2_out = cx + outerR * Math.cos(t2);
      const y2_out = cy + outerR * Math.sin(t2);

      doc.triangle(x1_in, y1_in, x1_out, y1_out, x2_out, y2_out, 'FD');
      doc.triangle(x1_in, y1_in, x2_out, y2_out, x2_in, y2_in, 'FD');
    }

    currentAngle = endAngle;
  });

  // Draw inner circle border
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.circle(cx, cy, innerR, 'FD');

  // Outer subtle boundary ring
  doc.circle(cx, cy, outerR, 'S');
}

// ============================================================================
// SINGLE SOURCE OF TRUTH: UNIFIED REPORT SNAPSHOT BUILDER
// ============================================================================

export function buildUnifiedReportSnapshot(input = {}) {
  const rawUser = input.user || {};
  const rawPortfolio = Array.isArray(input.portfolio) ? input.portfolio : (input.portfolio?.data || input.portfolio?.items || []);
  const rawGoals = Array.isArray(input.goals) ? input.goals : (input.goals?.data || input.goals?.items || []);
  const rawAlerts = Array.isArray(input.notifications) ? input.notifications : (Array.isArray(input.alerts) ? input.alerts : (input.alerts?.data || []));
  const rawAdvisor = input.advisor || null;

  // 1. User profile
  const riskProfile = (rawUser.risk_profile || rawUser.riskProfile || 'moderate').toLowerCase();
  const kycStatus = (rawUser.kyc_status || rawUser.kycStatus || 'verified').toUpperCase();
  const investor = {
    name: sanitizePDFText(rawUser.name || rawUser.full_name || rawUser.username || 'Investor'),
    email: sanitizePDFText(rawUser.email || 'N/A'),
    risk_profile: riskProfile.toUpperCase(),
    kyc_status: kycStatus,
    created_at: rawUser.created_at ? formatDate(rawUser.created_at) : 'N/A',
  };

  // 2. Portfolio holdings normalization
  let totalInvested = 0;
  let totalCurrentValue = 0;
  const holdings = [];
  const typeValueMap = {
    'Stock': 0,
    'ETF': 0,
    'Bond': 0,
    'Cash': 0,
    'Mutual Fund': 0,
    'Crypto': 0,
  };

  rawPortfolio.forEach(item => {
    if (!item) return;
    const qty = safeNumber(item.quantity ?? item.units ?? item.units_held ?? 0);
    if (qty <= 0) return;

    const avgBuy = safeNumber(item.average_buy_price ?? item.avg_buy_price ?? item.buy_price ?? 0);
    const currPriceRaw = item.current_price ?? item.currentPrice ?? item.manual_price;
    const currPrice = currPriceRaw !== null && currPriceRaw !== undefined ? safeNumber(currPriceRaw) : avgBuy;
    
    const investedVal = item.invested_value !== null && item.invested_value !== undefined 
      ? safeNumber(item.invested_value) 
      : (item.total_investment_value !== null && item.total_investment_value !== undefined 
          ? safeNumber(item.total_investment_value) 
          : qty * avgBuy);

    const currentVal = item.current_value !== null && item.current_value !== undefined
      ? safeNumber(item.current_value)
      : (item.total_value !== null && item.total_value !== undefined
          ? safeNumber(item.total_value)
          : qty * currPrice);

    const pnl = item.profit_loss !== null && item.profit_loss !== undefined
      ? safeNumber(item.profit_loss)
      : currentVal - investedVal;

    const pnlPct = item.profit_loss_pct !== null && item.profit_loss_pct !== undefined
      ? safeNumber(item.profit_loss_pct)
      : (item.profit_loss_percentage !== null && item.profit_loss_percentage !== undefined
          ? safeNumber(item.profit_loss_percentage)
          : (investedVal > 0 ? (pnl / investedVal) * 100 : 0));

    const assetType = normalizeAssetType(item.asset_type || item.category);

    totalInvested += investedVal;
    totalCurrentValue += currentVal;
    typeValueMap[assetType] = (typeValueMap[assetType] || 0) + currentVal;

    holdings.push({
      symbol: sanitizePDFText(item.symbol || item.asset_name || 'N/A'),
      asset_name: sanitizePDFText(item.asset_name || item.symbol || 'N/A'),
      asset_type: assetType,
      quantity: qty,
      average_buy_price: avgBuy,
      current_price: currPrice,
      invested_value: investedVal,
      current_value: currentVal,
      profit_loss: pnl,
      profit_loss_pct: pnlPct,
      price_source: sanitizePDFText(item.price_source || 'LIVE'),
      price_status: sanitizePDFText(item.price_status || 'Live'),
    });
  });

  const totalPnL = totalCurrentValue - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  // 3. Asset Allocation Breakdown across standard classes
  const targetMap = TARGET_ALLOCATIONS[riskProfile] || TARGET_ALLOCATIONS.moderate;
  const allocation = STANDARD_ASSET_CLASSES.map(type => {
    const val = typeValueMap[type] || 0;
    const currentPct = totalCurrentValue > 0 ? (val / totalCurrentValue) * 100 : 0;
    const targetPct = targetMap[type] !== undefined ? targetMap[type] : 0;
    const diffPP = currentPct - targetPct;

    let status = 'BALANCED';
    if (diffPP >= DEVIATION_THRESHOLD) {
      status = 'OVERWEIGHT';
    } else if (diffPP <= -DEVIATION_THRESHOLD) {
      status = 'UNDERWEIGHT';
    }

    return {
      asset_type: type,
      current_value: val,
      current_pct: currentPct,
      target_pct: targetPct,
      difference_pp: diffPP,
      status: status,
    };
  });

  // 4. AI Rebalancing Diagnostic & Recommendation
  const overweightItems = allocation.filter(a => a.status === 'OVERWEIGHT');
  const underweightItems = allocation.filter(a => a.status === 'UNDERWEIGHT');
  const needsRebalancing = rawAdvisor ? rawAdvisor.needs_rebalancing : (overweightItems.length > 0 || underweightItems.length > 0);

  // Dynamic portfolio risk classification
  let portfolioRisk = riskProfile;
  const stockAlloc = allocation.find(a => a.asset_type === 'Stock')?.current_pct || 0;
  const etfAlloc = allocation.find(a => a.asset_type === 'ETF')?.current_pct || 0;
  const cryptoAlloc = allocation.find(a => a.asset_type === 'Crypto')?.current_pct || 0;
  const bondAlloc = allocation.find(a => a.asset_type === 'Bond')?.current_pct || 0;
  const cashAlloc = allocation.find(a => a.asset_type === 'Cash')?.current_pct || 0;
  
  const highRiskExposure = stockAlloc + cryptoAlloc + (etfAlloc * 0.8);
  const lowRiskExposure = bondAlloc + cashAlloc;

  if (highRiskExposure >= 65.0) {
    portfolioRisk = 'aggressive';
  } else if (lowRiskExposure >= 55.0) {
    portfolioRisk = 'conservative';
  } else {
    portfolioRisk = 'moderate';
  }

  // Calculate dynamic shift amount
  let totalOverweightExcess = 0;
  overweightItems.forEach(item => {
    totalOverweightExcess += (item.difference_pp / 100) * totalCurrentValue;
  });

  let recommendationText = '';
  if (rawAdvisor && rawAdvisor.summary) {
    recommendationText = sanitizePDFText(rawAdvisor.summary);
  } else if (needsRebalancing) {
    if (overweightItems.length > 0) {
      const topOver = overweightItems[0];
      const shiftAmt = (topOver.difference_pp / 100) * totalCurrentValue;
      const underweightNames = underweightItems.map(u => u.asset_type).join(', ') || 'underweight asset classes';
      recommendationText = `Your portfolio is currently overweight in ${topOver.asset_type} exposure (${topOver.current_pct.toFixed(2)}% vs ${topOver.target_pct.toFixed(2)}% target) for your ${riskProfile.toUpperCase()} risk benchmark. Consider shifting approx. ${formatINR(shiftAmt)} into ${underweightNames} to restore optimal balance.`;
    } else {
      recommendationText = `Your portfolio asset distribution deviates from your target ${riskProfile.toUpperCase()} benchmark. Consider reallocating capital to realign with optimal target weights.`;
    }
  } else {
    recommendationText = `Your portfolio asset allocation is aligned with your ${riskProfile.toUpperCase()} risk benchmark. Continue with your scheduled systematic investment plan.`;
  }

  // 5. Goals normalization
  let totalGoalTarget = 0;
  let totalGoalSaved = 0;
  const goals = [];

  rawGoals.forEach(g => {
    if (!g) return;
    const targetAmt = safeNumber(g.target_amount ?? g.targetAmount ?? 0);
    const savedAmt = safeNumber(g.current_amount ?? g.currentAmount ?? g.saved_amount ?? g.savedAmount ?? 0);
    const progressPct = targetAmt > 0 ? Math.min(100, Math.max(0, (savedAmt / targetAmt) * 100)) : 0;
    const remainingAmt = Math.max(0, targetAmt - savedAmt);
    const monthlySIP = safeNumber(g.monthly_contribution ?? g.monthlyContribution ?? 0);

    totalGoalTarget += targetAmt;
    totalGoalSaved += savedAmt;

    let goalStatus = 'ON TRACK';
    if (progressPct >= 100) {
      goalStatus = 'COMPLETED';
    } else if (progressPct >= 50) {
      goalStatus = 'MILESTONE REACHED';
    } else if (remainingAmt > (targetAmt * 0.75)) {
      goalStatus = 'NEEDS ATTENTION';
    }

    goals.push({
      title: sanitizePDFText(g.title || g.name || 'Financial Goal'),
      category: sanitizePDFText(g.category || 'Wealth Creation'),
      target_amount: targetAmt,
      current_amount: savedAmt,
      remaining_amount: remainingAmt,
      progress_pct: progressPct,
      monthly_contribution: monthlySIP,
      target_date: formatDate(g.target_date || g.targetDate),
      status: goalStatus,
    });
  });

  const overallGoalsProgress = totalGoalTarget > 0 ? (totalGoalSaved / totalGoalTarget) * 100 : 0;

  // 6. Notifications / Activity normalization
  const notifications = [];
  rawAlerts.forEach(a => {
    if (!a) return;
    const title = sanitizePDFText(a.title || 'System Notification');
    const message = sanitizePDFText(a.message || a.event || '');
    const dateVal = a.created_at || a.timestamp || a.date;
    const rawSev = (a.severity || 'info').toLowerCase();
    
    let severityStatus = 'INFO';
    if (rawSev.includes('crit') || rawSev.includes('dang') || rawSev.includes('high')) {
      severityStatus = 'CRITICAL';
    } else if (rawSev.includes('warn') || rawSev.includes('amber')) {
      severityStatus = 'WARNING';
    } else if (rawSev.includes('succ') || rawSev.includes('green')) {
      severityStatus = 'SUCCESS';
    }

    notifications.push({
      title,
      message,
      status: severityStatus,
      timestamp: dateVal ? formatDate(dateVal) : 'Recent',
    });
  });

  // 7. Dynamic Smart Wealth Insights
  const insights = [];
  if (overweightItems.length > 0) {
    overweightItems.forEach(item => {
      insights.push(`Portfolio Drift: ${item.asset_type} is currently ${formatDrift(item.difference_pp)} above its ${riskProfile.toUpperCase()} target.`);
    });
  } else {
    insights.push(`Asset Alignment: Your holdings are well-balanced within the standard ±5.0 pp drift band.`);
  }

  if (underweightItems.length > 0) {
    underweightItems.slice(0, 2).forEach(item => {
      insights.push(`Allocation Opportunity: ${item.asset_type} is ${formatDrift(item.difference_pp)} below benchmark; systematic SIPs can help restore allocation.`);
    });
  }

  if (needsRebalancing) {
    insights.push(`Rebalancing Advisory: Capital reallocation is recommended based on your configured benchmark.`);
  }

  if (goals.length > 0) {
    const activeGoals = goals.filter(g => g.progress_pct < 100);
    if (activeGoals.length > 0) {
      activeGoals.sort((a, b) => b.progress_pct - a.progress_pct);
      insights.push(`Goal Milestone: "${activeGoals[0].title}" has achieved ${formatPercent(activeGoals[0].progress_pct)} of its target milestone.`);
    } else {
      insights.push(`Goal Completion: All registered financial goals have reached 100% completion!`);
    }
  }

  insights.push(`Holdings Diversification: Portfolio is actively distributed across ${holdings.length} position(s).`);

  if (totalPnL >= 0) {
    insights.push(`Net Performance: Portfolio has generated a cumulative net return of ${formatINR(totalPnL)} (${formatPercent(totalPnLPct, true)}).`);
  } else {
    insights.push(`Net Performance: Portfolio currently reflects an unrealized loss of ${formatINR(Math.abs(totalPnL))} (${formatPercent(totalPnLPct, true)}).`);
  }

  return {
    investor,
    summary: {
      total_current_value: totalCurrentValue,
      total_invested: totalInvested,
      total_profit_loss: totalPnL,
      total_profit_loss_pct: totalPnLPct,
      overall_goals_progress: overallGoalsProgress,
      total_goal_target: totalGoalTarget,
      total_goal_saved: totalGoalSaved,
    },
    holdings,
    allocation,
    advisor: {
      risk_profile: riskProfile.toUpperCase(),
      portfolio_risk: portfolioRisk.toUpperCase(),
      needs_rebalancing: needsRebalancing,
      diagnostic_status: needsRebalancing ? 'REBALANCE RECOMMENDED' : 'WELL BALANCED',
      recommendation: recommendationText,
      rebalance_amount: totalOverweightExcess,
    },
    goals,
    notifications,
    insights,
    generatedAt: new Date(),
  };
}

// ============================================================================
// PDF SECTION DRAWING HELPERS
// ============================================================================

export function drawSectionHeader(doc, title, y) {
  // Slate Dark primary color: #0F172A
  doc.setFillColor(15, 23, 42);
  doc.rect(14, y, 2.5, 5.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(title.toUpperCase(), 19.5, y + 4.2);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(14, y + 7.5, doc.internal.pageSize.getWidth() - 14, y + 7.5);

  return y + 11.5;
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

export function exportWealthSummaryPDF(inputData = {}) {
  const renderTable = typeof autoTable === 'function' ? autoTable : (autoTable && autoTable.default);
  if (!renderTable) {
    throw new Error('jsPDF AutoTable plugin is not loaded correctly');
  }

  // 1. Build canonical snapshot
  const data = buildUnifiedReportSnapshot(inputData);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const marginX = 14;
  const contentWidth = width - (marginX * 2);

  // ============================================================================
  // PAGE 1 — EXECUTIVE OVERVIEW & ASSET ALLOCATION STRATEGY
  // ============================================================================

  // ── BRAND HEADER BANNER ──
  const headerY = 12;
  const headerH = 26;
  doc.setFillColor(15, 23, 42); // Primary Dark #0F172A
  doc.roundedRect(marginX, headerY, contentWidth, headerH, 2, 2, 'F');
  doc.setDrawColor(30, 41, 59);
  doc.roundedRect(marginX, headerY, contentWidth, headerH, 2, 2, 'S');

  // Top Accent Stripe
  doc.setFillColor(56, 189, 248); // Sky Blue #38BDF8
  doc.rect(marginX + 2, headerY, contentWidth - 4, 1.2, 'F');

  // Left Brand Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('WEALTHTRACK PRO', marginX + 6, headerY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text('Personal Wealth Intelligence Platform', marginX + 6, headerY + 16.5);

  // Right Document Title & Metadata
  const now = data.generatedAt;
  const formattedDateTime = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' · ' + now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(56, 189, 248); // Sky Blue
  doc.text('WEALTH & INVESTMENT SUMMARY', width - marginX - 6, headerY + 9.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated: ${formattedDateTime}`, width - marginX - 6, headerY + 15, { align: 'right' });

  // Confidential badge
  const confText = 'CONFIDENTIAL';
  const confW = doc.getTextWidth(confText) + 6;
  const confX = width - marginX - 6 - confW;
  const confY = headerY + 18;
  doc.setFillColor(245, 158, 11); // Amber
  doc.roundedRect(confX, confY, confW, 4.5, 0.8, 0.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(15, 23, 42);
  doc.text(confText, confX + 3, confY + 3.2);

  let currentY = headerY + headerH + 4.5;

  // ── INVESTOR PROFILE CARD ──
  const profileCardH = 16.5;
  const profileCardY = currentY;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginX, profileCardY, contentWidth, profileCardH, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, profileCardY, contentWidth, profileCardH, 1.5, 1.5, 'S');

  doc.setFillColor(56, 189, 248); // Sky Blue left accent
  doc.rect(marginX, profileCardY + 2, 1.5, profileCardH - 4, 'F');

  // Col 1: Investor Name & Email
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('INVESTOR', marginX + 6, profileCardY + 5.5);
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  const limitStr = (str, len) => {
    const s = String(str || '');
    return s.length > len ? s.substring(0, len - 3) + '...' : s;
  };
  doc.text(limitStr(data.investor.name, 26), marginX + 6, profileCardY + 10.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(limitStr(data.investor.email, 30), marginX + 6, profileCardY + 14.5);

  // Col 2: Risk Profile
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('RISK PROFILE', marginX + 64, profileCardY + 5.5);
  
  // Risk Badge
  const riskText = data.investor.risk_profile;
  const riskBadgeW = doc.getTextWidth(riskText) + 8;
  doc.setFillColor(224, 242, 254);
  doc.roundedRect(marginX + 64, profileCardY + 7.5, riskBadgeW, 5.5, 1, 1, 'F');
  doc.setTextColor(3, 105, 161);
  doc.setFontSize(7);
  doc.text(riskText, marginX + 68, profileCardY + 11.5);

  // Col 3: KYC Status
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('KYC STATUS', marginX + 112, profileCardY + 5.5);

  const kycText = data.investor.kyc_status;
  const kycBadgeW = doc.getTextWidth(kycText) + 8;
  const kycBg = kycText === 'VERIFIED' ? [209, 250, 229] : [254, 243, 199];
  const kycTextColor = kycText === 'VERIFIED' ? [6, 95, 70] : [180, 83, 9];
  doc.setFillColor(kycBg[0], kycBg[1], kycBg[2]);
  doc.roundedRect(marginX + 112, profileCardY + 7.5, kycBadgeW, 5.5, 1, 1, 'F');
  doc.setTextColor(kycTextColor[0], kycTextColor[1], kycTextColor[2]);
  doc.setFontSize(7);
  doc.text(kycText, marginX + 116, profileCardY + 11.5);

  // Col 4: Report Currency & Basis
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('VALUATION BASIS', marginX + 150, profileCardY + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('INR (Rs.) · Live Market', marginX + 150, profileCardY + 11);

  currentY = profileCardY + profileCardH + 4.5;

  // ── EXECUTIVE SUMMARY METRICS (4 CARDS GRID) ──
  currentY = drawSectionHeader(doc, 'Executive Summary', currentY);

  const cardW = (contentWidth - 9) / 4; // 4 equal cards
  const cardH = 21.5;
  const cardRowY = currentY;

  // CARD 1: PORTFOLIO VALUE
  const c1X = marginX;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(c1X, cardRowY, cardW, cardH, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(c1X, cardRowY, cardW, cardH, 1.5, 1.5, 'S');
  doc.setFillColor(56, 189, 248); // Top Accent Sky Blue
  doc.rect(c1X, cardRowY, cardW, 1.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('PORTFOLIO VALUE', c1X + 3.5, cardRowY + 5.5);
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formatINR(data.summary.total_current_value), c1X + 3.5, cardRowY + 12.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Current market valuation', c1X + 3.5, cardRowY + 17.5);

  // CARD 2: INVESTED CAPITAL
  const c2X = c1X + cardW + 3;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(c2X, cardRowY, cardW, cardH, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(c2X, cardRowY, cardW, cardH, 1.5, 1.5, 'S');
  doc.setFillColor(100, 116, 139); // Top Accent Slate
  doc.rect(c2X, cardRowY, cardW, 1.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('INVESTED CAPITAL', c2X + 3.5, cardRowY + 5.5);
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formatINR(data.summary.total_invested), c2X + 3.5, cardRowY + 12.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Principal acquisition cost', c2X + 3.5, cardRowY + 17.5);

  // CARD 3: PROFIT / LOSS
  const c3X = c2X + cardW + 3;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(c3X, cardRowY, cardW, cardH, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(c3X, cardRowY, cardW, cardH, 1.5, 1.5, 'S');
  
  const pnlColor = data.summary.total_profit_loss >= 0 ? [5, 150, 105] : [220, 38, 38];
  doc.setFillColor(pnlColor[0], pnlColor[1], pnlColor[2]);
  doc.rect(c3X, cardRowY, cardW, 1.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('PROFIT / LOSS (P&L)', c3X + 3.5, cardRowY + 5.5);
  doc.setFontSize(10);
  doc.setTextColor(pnlColor[0], pnlColor[1], pnlColor[2]);
  doc.text(formatINR(data.summary.total_profit_loss, true), c3X + 3.5, cardRowY + 12.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.text(`Return: ${formatPercent(data.summary.total_profit_loss_pct, true)}`, c3X + 3.5, cardRowY + 17.5);

  // CARD 4: FINANCIAL GOALS PROGRESS
  const c4X = c3X + cardW + 3;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(c4X, cardRowY, cardW, cardH, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(c4X, cardRowY, cardW, cardH, 1.5, 1.5, 'S');
  doc.setFillColor(16, 185, 129); // Top Accent Emerald
  doc.rect(c4X, cardRowY, cardW, 1.2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('GOALS PROGRESS', c4X + 3.5, cardRowY + 5.5);
  doc.setFontSize(10.5);
  doc.setTextColor(16, 185, 129);
  doc.text(formatPercent(data.summary.overall_goals_progress), c4X + 3.5, cardRowY + 12.5);

  // Progress bar in card 4
  const miniBarW = cardW - 7;
  doc.setFillColor(226, 232, 240);
  doc.rect(c4X + 3.5, cardRowY + 15.5, miniBarW, 1.5, 'F');
  const miniClamped = Math.min(100, Math.max(0, data.summary.overall_goals_progress));
  if (miniClamped > 0) {
    doc.setFillColor(16, 185, 129);
    doc.rect(c4X + 3.5, cardRowY + 15.5, (miniClamped / 100) * miniBarW, 1.5, 'F');
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5);
  doc.setTextColor(148, 163, 184);
  doc.text(`${data.goals.length} Active Goal(s)`, c4X + 3.5, cardRowY + 19.5);

  currentY = cardRowY + cardH + 4.5;

  // ── PORTFOLIO ASSET ALLOCATION (DONUT + TABLE) ──
  currentY = drawSectionHeader(doc, 'Portfolio Asset Allocation & Benchmark Drift', currentY);

  const allocSectionY = currentY;
  const allocTableW = 114;
  const donutCardW = contentWidth - allocTableW - 4; // ~64mm

  // 1. Vector Donut Chart on Left Card
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginX, allocSectionY, donutCardW, 45, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, allocSectionY, donutCardW, 45, 1.5, 1.5, 'S');

  // Chart Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CURRENT ASSET MIX', marginX + 4, allocSectionY + 5.5);

  // Segments for donut chart
  const donutSegments = data.allocation.map(a => ({
    pct: a.current_pct,
    color: ASSET_PALETTE[a.asset_type]?.color || [100, 116, 139],
    label: a.asset_type,
  }));

  const donutCenterX = marginX + 22;
  const donutCenterY = allocSectionY + 24;
  drawVectorDonutChart(doc, donutCenterX, donutCenterY, 14.5, 8.5, donutSegments);

  // Center Total Value in Donut
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(15, 23, 42);
  doc.text(formatINR(data.summary.total_current_value), donutCenterX, donutCenterY - 0.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(4.5);
  doc.setTextColor(100, 116, 139);
  doc.text('100% ASSETS', donutCenterX, donutCenterY + 3.2, { align: 'center' });

  // Legend List beside Donut
  const legStartX = marginX + 39;
  const legStartY = allocSectionY + 9;
  data.allocation.forEach((a, idx) => {
    const ly = legStartY + (idx * 5.6);
    const pal = ASSET_PALETTE[a.asset_type] || { color: [100, 116, 139] };
    doc.setFillColor(pal.color[0], pal.color[1], pal.color[2]);
    doc.roundedRect(legStartX, ly, 2.5, 2.5, 0.5, 0.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(51, 65, 85);
    doc.text(a.asset_type, legStartX + 4, ly + 2);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(formatPercent(a.current_pct), legStartX + 22, ly + 2, { align: 'right' });
  });

  // 2. 6-Class Allocation Table on Right
  const allocTableX = marginX + donutCardW + 4;
  const allocTableRows = data.allocation.map(a => ({
    asset: a.asset_type,
    value: formatINR(a.current_value),
    current: formatPercent(a.current_pct),
    target: formatPercent(a.target_pct),
    drift: formatDrift(a.difference_pp),
    status: a.status,
  }));

  renderTable(doc, {
    startY: allocSectionY,
    margin: { left: allocTableX },
    tableWidth: allocTableW,
    columns: [
      { header: 'Asset Class', dataKey: 'asset' },
      { header: 'Value', dataKey: 'value' },
      { header: 'Actual', dataKey: 'current' },
      { header: 'Target', dataKey: 'target' },
      { header: 'Drift', dataKey: 'drift' },
      { header: 'Status', dataKey: 'status' },
    ],
    body: allocTableRows,
    theme: 'plain',
    styles: {
      textColor: [30, 41, 59],
      fontSize: 6.5,
      cellPadding: 1.8,
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.5,
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      value: { halign: 'right' },
      current: { halign: 'right' },
      target: { halign: 'right' },
      drift: { halign: 'right', fontStyle: 'bold' },
      status: { halign: 'center' },
    },
    willDrawCell: (cellData) => {
      if (cellData.column.dataKey === 'status' && cellData.cell.section === 'body') {
        cellData.cell.rawText = cellData.cell.text[0];
        cellData.cell.text = [''];
      }
    },
    didDrawCell: (cellData) => {
      if (cellData.column.dataKey === 'status' && cellData.cell.section === 'body') {
        const cell = cellData.cell;
        const rawText = cell.rawText || '';
        const x = cell.x + 1;
        const y = cell.y + 0.8;
        const w = cell.width - 2;
        const h = cell.height - 1.6;

        let bg = [241, 245, 249];
        let text = [71, 85, 105];

        if (rawText === 'OVERWEIGHT') {
          bg = [254, 243, 199];
          text = [180, 83, 9];
        } else if (rawText === 'UNDERWEIGHT') {
          bg = [224, 242, 254];
          text = [3, 105, 161];
        } else if (rawText === 'BALANCED') {
          bg = [209, 250, 229];
          text = [6, 95, 70];
        }

        doc.setFillColor(bg[0], bg[1], bg[2]);
        doc.roundedRect(x, y, w, h, 0.8, 0.8, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5);
        doc.setTextColor(text[0], text[1], text[2]);

        const textWidth = doc.getTextWidth(rawText);
        const textX = x + (w - textWidth) / 2;
        const textY = y + (h / 2) + 1.5;
        doc.text(rawText, textX, textY);
      }
    },
  });

  currentY = Math.max(doc.lastAutoTable.finalY, allocSectionY + 45) + 4.5;

  // ── AI SMART REBALANCING SECTION ──
  currentY = drawSectionHeader(doc, 'AI Rebalancing Analysis & Recommendation', currentY);

  const isRebalanceAction = data.advisor.needs_rebalancing;
  const diagCardX = marginX;
  const diagCardY = currentY;
  const diagCardW = contentWidth;

  // Recommendation text wrapper
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const splitRec = doc.splitTextToSize(data.advisor.recommendation, diagCardW - 14);
  const recHeight = splitRec.length * 3.8;
  const diagCardH = 20 + recHeight + (isRebalanceAction && data.advisor.rebalance_amount > 0 ? 9 : 0);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(diagCardX, diagCardY, diagCardW, diagCardH, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(diagCardX, diagCardY, diagCardW, diagCardH, 1.5, 1.5, 'S');

  // Accent Line
  const diagColor = isRebalanceAction ? [245, 158, 11] : [16, 185, 129];
  doc.setFillColor(diagColor[0], diagColor[1], diagColor[2]);
  doc.rect(diagCardX, diagCardY + 2, 1.5, diagCardH - 4, 'F');

  // Top Status Row
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('DIAGNOSTIC STATUS:', diagCardX + 5, diagCardY + 5.5);

  const statusBadgeBg = isRebalanceAction ? [254, 243, 199] : [209, 250, 229];
  const statusBadgeText = isRebalanceAction ? [180, 83, 9] : [6, 95, 70];
  const statBadgeW = doc.getTextWidth(data.advisor.diagnostic_status) + 7;
  doc.setFillColor(statusBadgeBg[0], statusBadgeBg[1], statusBadgeBg[2]);
  doc.roundedRect(diagCardX + 41, diagCardY + 2.2, statBadgeW, 4.8, 0.8, 0.8, 'F');
  doc.setTextColor(statusBadgeText[0], statusBadgeText[1], statusBadgeText[2]);
  doc.setFontSize(6);
  doc.text(data.advisor.diagnostic_status, diagCardX + 44.5, diagCardY + 5.5);

  // Target Benchmark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('TARGET BENCHMARK:', diagCardX + 104, diagCardY + 5.5);
  doc.setTextColor(3, 105, 161);
  doc.text(data.investor.risk_profile, diagCardX + 138, diagCardY + 5.5);

  // Portfolio Risk
  doc.setTextColor(100, 116, 139);
  doc.text('PORTFOLIO RISK:', diagCardX + 5, diagCardY + 11.5);
  doc.setTextColor(15, 23, 42);
  doc.text(data.advisor.portfolio_risk, diagCardX + 41, diagCardY + 11.5);

  if (isRebalanceAction && data.advisor.rebalance_amount > 0) {
    doc.setTextColor(100, 116, 139);
    doc.text('RECOMMENDED SHIFT:', diagCardX + 104, diagCardY + 11.5);
    doc.setTextColor(180, 83, 9);
    doc.text(formatINR(data.advisor.rebalance_amount), diagCardX + 138, diagCardY + 11.5);
  }

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(diagCardX + 5, diagCardY + 14.5, diagCardX + diagCardW - 5, diagCardY + 14.5);

  // Recommendation Callout Box
  const calloutY = diagCardY + 17.5;
  const calloutH = recHeight + 3.5;
  doc.setFillColor(255, 251, 235); // Amber 50
  doc.roundedRect(diagCardX + 5, calloutY, diagCardW - 10, calloutH, 1, 1, 'F');
  doc.setDrawColor(253, 230, 138); // Amber 200
  doc.roundedRect(diagCardX + 5, calloutY, diagCardW - 10, calloutH, 1, 1, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(146, 64, 14); // Dark amber
  doc.text('AI ADVISOR RECOMMENDATION:', diagCardX + 8, calloutY + 4.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(69, 26, 3);
  doc.text(splitRec, diagCardX + 8, calloutY + 8);

  // ============================================================================
  // PAGE 2 — PORTFOLIO HOLDINGS DETAIL & SYSTEMATIC PROGRESS
  // ============================================================================
  doc.addPage();
  currentY = 18;

  currentY = drawSectionHeader(doc, 'Portfolio Holdings Detail', currentY);

  const portfolioTableRows = data.holdings.map(item => ({
    symbol: item.symbol,
    category: item.asset_type,
    quantity: formatNumber(item.quantity),
    buyPrice: formatINR(item.average_buy_price),
    currPrice: formatINR(item.current_price),
    source: item.price_source,
    invested: formatINR(item.invested_value),
    currentVal: formatINR(item.current_value),
    pnl: `${formatINR(item.profit_loss, true)} (${formatPercent(item.profit_loss_pct, true)})`,
    pnlRaw: item.profit_loss,
  }));

  if (portfolioTableRows.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(marginX, currentY, contentWidth, 12, 1, 1, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(marginX, currentY, contentWidth, 12, 'S');
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('No active portfolio holdings recorded.', marginX + 5, currentY + 7.5);
    currentY += 16;
  } else {
    renderTable(doc, {
      startY: currentY,
      margin: { left: marginX, right: marginX },
      columns: [
        { header: 'Asset / Symbol', dataKey: 'symbol' },
        { header: 'Type', dataKey: 'category' },
        { header: 'Qty', dataKey: 'quantity' },
        { header: 'Avg Buy', dataKey: 'buyPrice' },
        { header: 'Current Price', dataKey: 'currPrice' },
        { header: 'Source', dataKey: 'source' },
        { header: 'Invested', dataKey: 'invested' },
        { header: 'Current Value', dataKey: 'currentVal' },
        { header: 'Profit / Loss (P&L)', dataKey: 'pnl' },
      ],
      body: portfolioTableRows,
      foot: [
        [
          { content: 'TOTAL PORTFOLIO MARKET VALUE', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: formatINR(data.summary.total_current_value), colSpan: 2, styles: { fontStyle: 'bold', textColor: [3, 105, 161] } },
        ],
        [
          { content: 'TOTAL INVESTED CAPITAL BASIS', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: formatINR(data.summary.total_invested), colSpan: 2, styles: { fontStyle: 'bold', textColor: [51, 65, 85] } },
        ],
        [
          { content: 'TOTAL UNREALIZED NET P/L', colSpan: 7, styles: { halign: 'right', fontStyle: 'bold' } },
          { 
            content: `${formatINR(data.summary.total_profit_loss, true)} (${formatPercent(data.summary.total_profit_loss_pct, true)})`, 
            colSpan: 2, 
            styles: { 
              fontStyle: 'bold', 
              textColor: data.summary.total_profit_loss >= 0 ? [5, 150, 105] : [220, 38, 38] 
            } 
          },
        ],
      ],
      theme: 'plain',
      styles: {
        textColor: [30, 41, 59],
        fontSize: 7,
        cellPadding: 2.2,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      footStyles: {
        fillColor: [248, 250, 252],
        textColor: [15, 23, 42],
        fontSize: 7,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      columnStyles: {
        quantity: { halign: 'right' },
        buyPrice: { halign: 'right' },
        currPrice: { halign: 'right' },
        source: { halign: 'center' },
        invested: { halign: 'right' },
        currentVal: { halign: 'right', fontStyle: 'bold' },
        pnl: { halign: 'right', fontStyle: 'bold' },
      },
      willDrawCell: (cellData) => {
        if (cellData.column.dataKey === 'category' && cellData.cell.section === 'body') {
          cellData.cell.rawText = cellData.cell.text[0];
          cellData.cell.text = [''];
        }
      },
      didDrawCell: (cellData) => {
        if (cellData.column.dataKey === 'category' && cellData.cell.section === 'body') {
          const cell = cellData.cell;
          const rawText = cell.rawText || '';
          const x = cell.x + 1;
          const y = cell.y + 0.8;
          const w = cell.width - 2;
          const h = cell.height - 1.6;

          const pal = ASSET_PALETTE[rawText] || { bg: [241, 245, 249], text: [71, 85, 105] };

          doc.setFillColor(pal.bg[0], pal.bg[1], pal.bg[2]);
          doc.roundedRect(x, y, w, h, 0.8, 0.8, 'F');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(5.5);
          doc.setTextColor(pal.text[0], pal.text[1], pal.text[2]);

          const textWidth = doc.getTextWidth(rawText);
          const textX = x + (w - textWidth) / 2;
          const textY = y + (h / 2) + 1.5;
          doc.text(rawText, textX, textY);
        }

        if (cellData.column.dataKey === 'pnl' && cellData.cell.section === 'body') {
          const valText = cellData.cell.text[0] || '';
          if (valText.startsWith('Rs. +') || valText.startsWith('+')) {
            doc.setTextColor(5, 150, 105);
          } else if (valText.startsWith('Rs. -') || valText.startsWith('-')) {
            doc.setTextColor(220, 38, 38);
          }
        }
      },
    });
    currentY = doc.lastAutoTable.finalY + 6;
  }

  // ── DYNAMIC SECTION: FINANCIAL GOALS & PROGRESS ──
  const requiredGoalsSpace = data.goals.length > 0 ? 55 : 24;
  if (height - 22 - currentY < requiredGoalsSpace) {
    doc.addPage();
    currentY = 18;
  }

  currentY = drawSectionHeader(doc, 'Financial Goals & Systematic Progress', currentY);

  if (data.goals.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(marginX, currentY, contentWidth, 12, 1, 1, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginX, currentY, contentWidth, 12, 1, 1, 'S');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('No active financial goals. Create systematic goals to track milestone progress.', marginX + 6, currentY + 7.5);
    currentY += 16;
  } else {
    // 4 Mini Summary Cards for Goals
    const gCardW = (contentWidth - 9) / 4;
    const gCardH = 13.5;
    const gRowY = currentY;

    // Card 1: Active Goals
    doc.setFillColor(248, 250, 252);
    doc.rect(marginX, gRowY, gCardW, gCardH, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(marginX, gRowY, gCardW, gCardH, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text('ACTIVE GOALS', marginX + 3.5, gRowY + 4.5);
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(String(data.goals.length), marginX + 3.5, gRowY + 10);

    // Card 2: Total Target
    doc.setFillColor(248, 250, 252);
    doc.rect(marginX + gCardW + 3, gRowY, gCardW, gCardH, 'F');
    doc.rect(marginX + gCardW + 3, gRowY, gCardW, gCardH, 'S');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text('TOTAL TARGET', marginX + gCardW + 6.5, gRowY + 4.5);
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(formatINR(data.summary.total_goal_target), marginX + gCardW + 6.5, gRowY + 10);

    // Card 3: Total Saved
    doc.setFillColor(248, 250, 252);
    doc.rect(marginX + (gCardW + 3) * 2, gRowY, gCardW, gCardH, 'F');
    doc.rect(marginX + (gCardW + 3) * 2, gRowY, gCardW, gCardH, 'S');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text('TOTAL SAVED', marginX + (gCardW + 3) * 2 + 3.5, gRowY + 4.5);
    doc.setFontSize(8.5);
    doc.setTextColor(5, 150, 105);
    doc.text(formatINR(data.summary.total_goal_saved), marginX + (gCardW + 3) * 2 + 3.5, gRowY + 10);

    // Card 4: Overall Progress
    doc.setFillColor(248, 250, 252);
    doc.rect(marginX + (gCardW + 3) * 3, gRowY, gCardW, gCardH, 'F');
    doc.rect(marginX + (gCardW + 3) * 3, gRowY, gCardW, gCardH, 'S');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text('OVERALL PROGRESS', marginX + (gCardW + 3) * 3 + 3.5, gRowY + 4.5);
    doc.setFontSize(9);
    doc.setTextColor(3, 105, 161);
    doc.text(formatPercent(data.summary.overall_goals_progress), marginX + (gCardW + 3) * 3 + 3.5, gRowY + 10);

    currentY = gRowY + gCardH + 4;

    const goalTableRows = data.goals.map(g => ({
      title: g.title,
      category: g.category,
      target: formatINR(g.target_amount),
      saved: formatINR(g.current_amount),
      remaining: formatINR(g.remaining_amount),
      progress: g.progress_pct,
      targetDate: g.target_date,
      sip: g.monthly_contribution > 0 ? `${formatINR(g.monthly_contribution)}/mo` : '—',
      status: g.status,
    }));

    renderTable(doc, {
      startY: currentY,
      margin: { left: marginX, right: marginX },
      columns: [
        { header: 'Goal Title', dataKey: 'title' },
        { header: 'Category', dataKey: 'category' },
        { header: 'Target Amount', dataKey: 'target' },
        { header: 'Saved', dataKey: 'saved' },
        { header: 'Remaining', dataKey: 'remaining' },
        { header: 'Progress', dataKey: 'progress' },
        { header: 'Target Date', dataKey: 'targetDate' },
        { header: 'Monthly SIP', dataKey: 'sip' },
        { header: 'Status', dataKey: 'status' },
      ],
      body: goalTableRows,
      theme: 'plain',
      styles: {
        textColor: [30, 41, 59],
        fontSize: 6.5,
        cellPadding: 2,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 6.5,
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        target: { halign: 'right' },
        saved: { halign: 'right', fontStyle: 'bold' },
        remaining: { halign: 'right' },
        progress: { cellWidth: 26 },
        sip: { halign: 'right' },
        status: { halign: 'center' },
      },
      willDrawCell: (cellData) => {
        if (cellData.column.dataKey === 'progress' && cellData.cell.section === 'body') {
          cellData.cell.rawText = cellData.cell.text[0];
          cellData.cell.text = [''];
        }
        if (cellData.column.dataKey === 'status' && cellData.cell.section === 'body') {
          cellData.cell.rawText = cellData.cell.text[0];
          cellData.cell.text = [''];
        }
      },
      didDrawCell: (cellData) => {
        // Horizontal progress bar + percentage on single line
        if (cellData.column.dataKey === 'progress' && cellData.cell.section === 'body') {
          const cell = cellData.cell;
          const val = safeNumber(cell.raw);
          const barX = cell.x + 1.5;
          const barW = 14;
          const barH = 2.4;
          const barY = cell.y + (cell.height - barH) / 2;

          doc.setFillColor(241, 245, 249);
          doc.roundedRect(barX, barY, barW, barH, 0.6, 0.6, 'F');

          const filledW = (Math.min(100, Math.max(0, val)) / 100) * barW;
          if (filledW > 0) {
            doc.setFillColor(56, 189, 248); // Sky Blue
            doc.roundedRect(barX, barY, filledW, barH, 0.6, 0.6, 'F');
          }

          doc.setFontSize(5.5);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(51, 65, 85);
          const textX = barX + barW + 1.8;
          const textY = cell.y + (cell.height / 2) + 1.1;
          doc.text(`${val.toFixed(1)}%`, textX, textY);
        }

        // Status Badge
        if (cellData.column.dataKey === 'status' && cellData.cell.section === 'body') {
          const cell = cellData.cell;
          const rawText = cell.rawText || '';
          const x = cell.x + 1;
          const y = cell.y + 0.8;
          const w = cell.width - 2;
          const h = cell.height - 1.6;

          let bg = [241, 245, 249];
          let text = [71, 85, 105];

          if (rawText === 'COMPLETED') {
            bg = [209, 250, 229];
            text = [6, 95, 70];
          } else if (rawText === 'MILESTONE REACHED') {
            bg = [224, 242, 254];
            text = [3, 105, 161];
          } else if (rawText === 'ON TRACK') {
            bg = [219, 234, 254];
            text = [29, 78, 216];
          } else if (rawText === 'NEEDS ATTENTION') {
            bg = [254, 243, 199];
            text = [180, 83, 9];
          }

          doc.setFillColor(bg[0], bg[1], bg[2]);
          doc.roundedRect(x, y, w, h, 0.8, 0.8, 'F');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(5);
          doc.setTextColor(text[0], text[1], text[2]);

          const textWidth = doc.getTextWidth(rawText);
          const textX = x + (w - textWidth) / 2;
          const textY = y + (h / 2) + 1.4;
          doc.text(rawText, textX, textY);
        }
      },
    });
    currentY = doc.lastAutoTable.finalY + 6;
  }

  // ── DYNAMIC SECTION: SMART WEALTH INSIGHTS ──
  if (height - 22 - currentY < 38) {
    doc.addPage();
    currentY = 18;
  }

  currentY = drawSectionHeader(doc, 'Smart Wealth Insights', currentY);

  const insightBoxY = currentY;
  const numInsights = data.insights.length;
  const insightBoxH = (numInsights * 5.2) + 3;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginX, insightBoxY, contentWidth, insightBoxH, 1.5, 1.5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, insightBoxY, contentWidth, insightBoxH, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);

  data.insights.forEach((insight, idx) => {
    const iy = insightBoxY + 4 + (idx * 5.2);
    // Cyan icon bullet
    doc.setFillColor(56, 189, 248);
    doc.circle(marginX + 5, iy + 0.8, 0.9, 'F');

    doc.setTextColor(51, 65, 85);
    doc.text(insight, marginX + 8.5, iy + 1.8);
  });

  currentY = insightBoxY + insightBoxH + 6;

  // ── DYNAMIC SECTION: RECENT FINANCIAL ACTIVITY ──
  if (height - 22 - currentY < 36) {
    doc.addPage();
    currentY = 18;
  }

  currentY = drawSectionHeader(doc, 'Recent Financial Activity & Alerts', currentY);

  if (data.notifications.length === 0) {
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(marginX, currentY, contentWidth, 10, 1, 1, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginX, currentY, contentWidth, 10, 1, 1, 'S');

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('No recent alerts or activity records found.', marginX + 5, currentY + 6.5);
    currentY += 14;
  } else {
    const alertTableRows = data.notifications.map(a => ({
      timestamp: a.timestamp,
      title: a.title,
      message: a.message,
      status: a.status,
    }));

    renderTable(doc, {
      startY: currentY,
      margin: { left: marginX, right: marginX },
      columns: [
        { header: 'Date / Time', dataKey: 'timestamp' },
        { header: 'Event Title', dataKey: 'title' },
        { header: 'Description', dataKey: 'message' },
        { header: 'Status', dataKey: 'status' },
      ],
      body: alertTableRows,
      theme: 'plain',
      styles: {
        textColor: [30, 41, 59],
        fontSize: 6.5,
        cellPadding: 2,
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 6.5,
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        timestamp: { cellWidth: 26 },
        title: { cellWidth: 44, fontStyle: 'bold' },
        message: { cellWidth: 92 },
        status: { cellWidth: 20, halign: 'center' },
      },
      willDrawCell: (cellData) => {
        if (cellData.column.dataKey === 'status' && cellData.cell.section === 'body') {
          cellData.cell.rawText = cellData.cell.text[0];
          cellData.cell.text = [''];
        }
      },
      didDrawCell: (cellData) => {
        if (cellData.column.dataKey === 'status' && cellData.cell.section === 'body') {
          const cell = cellData.cell;
          const rawText = cell.rawText || '';
          const x = cell.x + 1;
          const y = cell.y + 0.8;
          const w = cell.width - 2;
          const h = cell.height - 1.6;

          let bg = [241, 245, 249];
          let text = [71, 85, 105];

          if (rawText === 'CRITICAL') {
            bg = [254, 242, 242];
            text = [220, 38, 38];
          } else if (rawText === 'WARNING') {
            bg = [254, 243, 199];
            text = [180, 83, 9];
          } else if (rawText === 'SUCCESS') {
            bg = [209, 250, 229];
            text = [6, 95, 70];
          } else if (rawText === 'INFO') {
            bg = [224, 242, 254];
            text = [3, 105, 161];
          }

          doc.setFillColor(bg[0], bg[1], bg[2]);
          doc.roundedRect(x, y, w, h, 0.8, 0.8, 'F');

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(5);
          doc.setTextColor(text[0], text[1], text[2]);

          const textWidth = doc.getTextWidth(rawText);
          const textX = x + (w - textWidth) / 2;
          const textY = y + (h / 2) + 1.5;
          doc.text(rawText, textX, textY);
        }
      },
    });
  }

  // ============================================================================
  // GLOBAL POST-PROCESSING: HEADER BARS, FOOTER & ACCURATE PAGE NUMBERS
  // ============================================================================
  const totalPages = doc.internal.getNumberOfPages();

  const drawGlobalDecorations = (pageNumber, total) => {
    // Header bar on pages > 1
    if (pageNumber > 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text('WEALTHTRACK PRO', marginX, 10);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text('|   Personal Wealth Intelligence Platform', marginX + 27, 10);

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(marginX, 12, width - marginX, 12);
    }

    // Bottom divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, height - 13, width - marginX, height - 13);

    // Footer Left
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text('WealthTrack Pro', marginX, height - 9);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('  ·  Confidential Personal Financial Report', marginX + 18, height - 9);

    const disclaimer = 'Disclaimer: This report is for informational and financial planning purposes only and does not constitute investment advice.';
    doc.text(disclaimer, marginX, height - 5.5);

    // Footer Right: Dynamic Page X of Y
    const pageText = `Page ${pageNumber} of ${total}`;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(pageText, width - marginX - doc.getTextWidth(pageText), height - 9);
  };

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawGlobalDecorations(i, totalPages);
  }

  // ── SAVE / DOWNLOAD THE PDF FILE ──
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const safeName = (data.investor.name || 'User').replace(/[^a-zA-Z0-9]/g, '_');
  const filename = `Wealth_Report_${safeName}_${yyyy}-${mm}-${dd}.pdf`;

  try {
    if (typeof window !== 'undefined' || typeof doc.save === 'function') {
      doc.save(filename);
    }
  } catch (saveErr) {
    // In node/test environments, ignore browser save errors
  }
  return doc;
}
