import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ============================================================================
// DATA NORMALIZATION & FORMATTING HELPERS
// ============================================================================

export function safeNumber(val) {
  if (val === null || val === undefined) return 0;
  const num = Number(val);
  return isNaN(num) || !isFinite(num) ? 0 : num;
}

export function formatINR(value) {
  const num = safeNumber(value);
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
  // Standard PDF fonts do not support the ₹ character natively.
  // Using 'Rs.' ensures cross-platform rendering safety.
  return 'Rs. ' + formatted;
}

export function formatPercent(value, showSign = false) {
  const num = safeNumber(value);
  const formatted = num.toFixed(2) + '%';
  if (showSign && num > 0) {
    return '+' + formatted;
  }
  return formatted;
}

export function formatNumber(value) {
  const num = safeNumber(value);
  return new Intl.NumberFormat('en-IN').format(num);
}

export function formatDate(dateVal) {
  if (!dateVal) return 'N/A';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return String(dateVal);
  }
}

// ── User Profiling Getters ──────────────────────────────────────────────────
export function getUserName(user) {
  if (!user) return 'N/A';
  return user.name || user.full_name || user.username || 'N/A';
}

export function getUserEmail(user) {
  if (!user) return 'N/A';
  return user.email || 'N/A';
}

export function getUserKYCStatus(user) {
  if (!user) return 'PENDING';
  return (user.kyc_status || user.kycStatus || 'PENDING').toUpperCase();
}

export function getUserRiskProfile(user) {
  if (!user) return 'MODERATE';
  return (user.risk_profile || user.riskProfile || 'MODERATE').toUpperCase();
}

// ── Portfolio Holdings Getters ──────────────────────────────────────────────
export function getPortfolioUnits(item) {
  if (!item) return 'N/A';
  const qty = item.quantity ?? item.units ?? item.units_held;
  if (qty === undefined || qty === null) return 'N/A';
  return String(qty);
}

export function getPortfolioBuyPrice(item) {
  if (!item) return 0;
  return safeNumber(item.buy_price ?? item.avg_buy_price ?? item.average_buy_price ?? 0);
}

export function getPortfolioCurrentPrice(item) {
  if (!item) return 0;
  return safeNumber(item.current_price ?? item.currentPrice ?? item.price ?? 0);
}

export function getPortfolioCurrentValue(item) {
  if (!item) return 0;
  const val = item.current_value ?? item.currentValue ?? item.total_value;
  if (val !== undefined && val !== null) return safeNumber(val);
  
  const units = getPortfolioUnits(item);
  if (units === 'N/A') return 0;
  return safeNumber(units) * getPortfolioCurrentPrice(item);
}

export function getPortfolioPnLPct(item) {
  if (!item) return 0;
  const pnlPct = item.profit_loss_pct ?? item.pnl_pct ?? item.pnlPercent ?? item.profit_loss_percentage;
  if (pnlPct !== undefined && pnlPct !== null) return safeNumber(pnlPct);

  const buy = getPortfolioBuyPrice(item);
  const curr = getPortfolioCurrentPrice(item);
  if (buy > 0) {
    return ((curr - buy) / buy) * 100;
  }
  return 0;
}

export function getPortfolioValue(portfolio) {
  if (!Array.isArray(portfolio)) return 0;
  return portfolio.reduce((acc, item) => acc + getPortfolioCurrentValue(item), 0);
}

// ── Financial Goals Getters ─────────────────────────────────────────────────
export function getGoalTargetAmount(g) {
  if (!g) return 0;
  return safeNumber(g.target_amount ?? g.targetAmount ?? 0);
}

export function getGoalSavedAmount(g) {
  if (!g) return 0;
  return safeNumber(g.saved_amount ?? g.savedAmount ?? g.current_amount ?? g.currentAmount ?? 0);
}

export function getGoalProgress(g) {
  const target = getGoalTargetAmount(g);
  const saved = getGoalSavedAmount(g);
  if (target <= 0) return 0;
  return (saved / target) * 100;
}

// ============================================================================
// SECTION HEADER HELPER
// ============================================================================

export function drawSectionHeader(doc, title, y) {
  // Slate Blue primary color: #0F172A
  doc.setFillColor(15, 23, 42);
  doc.rect(15, y, 2, 6, 'F');
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(title.toUpperCase(), 20, y + 4.5);
  
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(15, y + 8, doc.internal.pageSize.getWidth() - 15, y + 8);
  
  return y + 13; // spacing after header
}

// ============================================================================
// EXPORT MAIN FUNCTION
// ============================================================================

export function exportWealthSummaryPDF({
  user = {},
  netWorth = 0,
  portfolio = [],
  goals = [],
  alerts = []
} = {}) {
  const renderTable = typeof autoTable === 'function' ? autoTable : (autoTable && autoTable.default);
  if (!renderTable) {
    throw new Error("jsPDF AutoTable plugin is not loaded correctly");
  }

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  // Normalize API data shapes
  let normalizedPortfolio = [];
  if (Array.isArray(portfolio)) {
    normalizedPortfolio = portfolio;
  } else if (portfolio && Array.isArray(portfolio.data)) {
    normalizedPortfolio = portfolio.data;
  } else if (portfolio && Array.isArray(portfolio.items)) {
    normalizedPortfolio = portfolio.items;
  }

  let normalizedGoals = [];
  if (Array.isArray(goals)) {
    normalizedGoals = goals;
  } else if (goals && Array.isArray(goals.data)) {
    normalizedGoals = goals.data;
  } else if (goals && Array.isArray(goals.items)) {
    normalizedGoals = goals.items;
  }

  let normalizedAlerts = [];
  if (Array.isArray(alerts)) {
    normalizedAlerts = alerts;
  } else if (alerts && Array.isArray(alerts.data)) {
    normalizedAlerts = alerts.data;
  } else if (alerts && Array.isArray(alerts.items)) {
    normalizedAlerts = alerts.items;
  }

  // ============================================================================
  // PAGE 1 — EXECUTIVE SUMMARY & BRANDING
  // ============================================================================
  
  // ── BRAND HEADER ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42); // Primary Dark #0F172A
  doc.text("WEALTHTRACK PRO", 15, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // Muted Slate #64748B
  doc.text("Personal Wealth Intelligence Platform", 15, 26.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("Comprehensive Wealth & Investment Report", 15, 33);

  // Thin line divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(15, 36, width - 15, 36);

  // Metadata block
  const now = new Date();
  const formattedDateTime = now.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  }) + ' · ' + now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(148, 163, 184); // Muted
  doc.text("GENERATED ON:", 15, 41);
  doc.text("REPORTING PERIOD:", 68, 41);
  doc.text("CURRENCY:", 122, 41);
  doc.text("SECURITY CLASSIFICATION:", 160, 41);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(51, 65, 85); // Slate Text
  doc.text(formattedDateTime, 15, 45);
  doc.text("Real-Time Snapshot", 68, 45);
  doc.text("INR (Rs.)", 122, 45);
  
  doc.setTextColor(217, 119, 6); // Amber
  doc.setFont("helvetica", "bold");
  doc.text("CONFIDENTIAL", 160, 45);

  let currentY = 51;

  // ── PROFILE CARD ──
  const profileCardW = width - 30;
  const profileCardH = 22;
  const profileCardY = currentY;

  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.roundedRect(15, profileCardY, profileCardW, profileCardH, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(15, profileCardY, profileCardW, profileCardH, 'S');
  
  doc.setFillColor(8, 145, 178); // Cyan Accent left line
  doc.rect(15, profileCardY + 2, 1.5, profileCardH - 4, 'F');

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text("INVESTOR PROFILE", 20, profileCardY + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("NAME:", 20, profileCardY + 13);
  doc.text("EMAIL:", 20, profileCardY + 18);

  doc.text("KYC STATUS:", 110, profileCardY + 13);
  doc.text("RISK PROFILE:", 110, profileCardY + 18);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  const limitStr = (str, len) => {
    const s = String(str || '');
    return s.length > len ? s.substring(0, len - 3) + '...' : s;
  };
  doc.text(limitStr(getUserName(user), 35), 45, profileCardY + 13);
  doc.text(limitStr(getUserEmail(user), 35), 45, profileCardY + 18);

  // KYC Badge logic
  const kycStatusVal = getUserKYCStatus(user);
  if (kycStatusVal === 'VERIFIED') {
    doc.setTextColor(5, 150, 105); // emerald
  } else {
    doc.setTextColor(217, 119, 6); // amber
  }
  doc.setFont("helvetica", "bold");
  doc.text(kycStatusVal, 135, profileCardY + 13);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(getUserRiskProfile(user), 135, profileCardY + 18);

  currentY = profileCardY + profileCardH + 6;

  // ── NET WORTH EXECUTIVE DASHBOARD ──
  currentY = drawSectionHeader(doc, "Executive Summary", currentY);

  const cardW = 86;
  const cardH = 26;
  const row1Y = currentY;

  // Compile calculations
  let portfolioVal = getPortfolioValue(normalizedPortfolio);
  let totalBuyVal = 0;
  normalizedPortfolio.forEach(item => {
    const units = getPortfolioUnits(item);
    const buyPrice = getPortfolioBuyPrice(item);
    if (units !== 'N/A') {
      totalBuyVal += safeNumber(units) * buyPrice;
    }
  });

  const overallPnLVal = portfolioVal - totalBuyVal;
  const overallPnLPct = totalBuyVal > 0 ? (overallPnLVal / totalBuyVal) * 100 : 0;

  // Calculate goal targets
  let totalSaved = 0;
  let totalTarget = 0;
  normalizedGoals.forEach(g => {
    totalSaved += getGoalSavedAmount(g);
    totalTarget += getGoalTargetAmount(g);
  });
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;
  const clampedProgress = Math.min(100, Math.max(0, overallProgress));

  // CARD 1: TOTAL PORTFOLIO VALUE (Cyan)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, row1Y, cardW, cardH, 2, 2, 'F');
  doc.rect(15, row1Y, cardW, cardH, 'S');
  doc.setFillColor(8, 145, 178); // Cyan Accent left line
  doc.rect(15, row1Y + 2, 1.5, cardH - 4, 'F');

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL PORTFOLIO VALUE", 20, row1Y + 6);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(formatINR(portfolioVal), 20, row1Y + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("Current Market Value of Assets", 20, row1Y + 22);

  // CARD 2: TOTAL INVESTED (Slate)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(109, row1Y, cardW, cardH, 2, 2, 'F');
  doc.rect(109, row1Y, cardW, cardH, 'S');
  doc.setFillColor(71, 85, 105); // Slate Accent left line
  doc.rect(109, row1Y + 2, 1.5, cardH - 4, 'F');

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL INVESTED", 114, row1Y + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(formatINR(totalBuyVal), 114, row1Y + 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text("Cumulative Acquisition Cost", 114, row1Y + 22);

  // ROW 2:
  const row2Y = row1Y + cardH + 6;

  // CARD 3: TOTAL PROFIT / LOSS (Green/Red)
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(15, row2Y, cardW, cardH, 2, 2, 'F');
  doc.rect(15, row2Y, cardW, cardH, 'S');
  
  const pnlColor = overallPnLVal >= 0 ? [5, 150, 105] : [220, 38, 38];
  doc.setFillColor(pnlColor[0], pnlColor[1], pnlColor[2]);
  doc.rect(15, row2Y + 2, 1.5, cardH - 4, 'F');

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL NET RETURNS", 20, row2Y + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(pnlColor[0], pnlColor[1], pnlColor[2]);
  doc.text(`${overallPnLVal >= 0 ? '+' : ''}${formatINR(overallPnLVal)}`, 20, row2Y + 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(formatPercent(overallPnLPct, true), 20, row2Y + 22);

  // CARD 4: GOAL PROGRESS
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(109, row2Y, cardW, cardH, 2, 2, 'F');
  doc.rect(109, row2Y, cardW, cardH, 'S');
  doc.setFillColor(8, 145, 178); // Cyan Accent left line
  doc.rect(109, row2Y + 2, 1.5, cardH - 4, 'F');

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("FINANCIAL GOALS PROGRESS", 114, row2Y + 6);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(8, 145, 178); // Cyan
  doc.text(formatPercent(overallProgress), 114, row2Y + 16);

  // Progress Bar background track
  const barProgressW = 50;
  const barProgressH = 2;
  doc.setFillColor(226, 232, 240);
  doc.rect(114, row2Y + 20, barProgressW, barProgressH, 'F');

  // Filled progress bar
  const filledProgressW = (clampedProgress / 100) * barProgressW;
  if (filledProgressW > 0) {
    doc.setFillColor(8, 145, 178);
    doc.rect(114, row2Y + 20, filledProgressW, barProgressH, 'F');
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`${clampedProgress.toFixed(0)}% Achieved`, 167, row2Y + 22);

  currentY = row2Y + cardH + 8;

  // ── PORTFOLIO ALLOCATION ──
  currentY = drawSectionHeader(doc, "Portfolio Asset Allocation", currentY);

  // Calculate current allocation dynamically from holdings
  let equityValue = 0;
  let debtValue = 0;
  let cashValue = 0;

  normalizedPortfolio.forEach(item => {
    const cat = (item.asset_type || item.category || '').toLowerCase();
    const name = (item.asset_name || item.symbol || '').toLowerCase();
    const val = getPortfolioCurrentValue(item);

    if (cat.includes('cash') || cat.includes('liquid') || name.includes('cash') || name.includes('liquid')) {
      cashValue += val;
    } else if (cat.includes('bond') || cat.includes('debt') || cat.includes('fd') || cat.includes('fixed deposit') || name.includes('bond') || name.includes('fd') || name.includes('fixed deposit')) {
      debtValue += val;
    } else {
      equityValue += val;
    }
  });

  const totalAllocValue = equityValue + debtValue + cashValue;
  const currentEquityPct = totalAllocValue > 0 ? (equityValue / totalAllocValue) * 100 : 0;
  const currentDebtPct = totalAllocValue > 0 ? (debtValue / totalAllocValue) * 100 : 0;
  const currentCashPct = totalAllocValue > 0 ? (cashValue / totalAllocValue) * 100 : 0;

  // Set recommended targets based on risk profile
  const riskProfile = getUserRiskProfile(user);
  let targetEquity = 50;
  let targetDebt = 40;
  let targetCash = 10;

  if (riskProfile === 'CONSERVATIVE') {
    targetEquity = 20;
    targetDebt = 70;
    targetCash = 10;
  } else if (riskProfile === 'AGGRESSIVE') {
    targetEquity = 80;
    targetDebt = 15;
    targetCash = 5;
  }

  // Draw Asset Allocation comparison table (width = 95mm)
  const allocationRows = [
    { asset: 'Equity', current: formatPercent(currentEquityPct), target: formatPercent(targetEquity) },
    { asset: 'Debt / Fixed Income', current: formatPercent(currentDebtPct), target: formatPercent(targetDebt) },
    { asset: 'Cash & Liquid', current: formatPercent(currentCashPct), target: formatPercent(targetCash) }
  ];

  renderTable(doc, {
    startY: currentY,
    margin: { left: 15 },
    tableWidth: 95,
    columns: [
      { header: "Asset Class", dataKey: "asset" },
      { header: "Current", dataKey: "current" },
      { header: "Target Allocation", dataKey: "target" }
    ],
    body: allocationRows,
    theme: 'plain',
    styles: {
      textColor: [30, 41, 59],
      fontSize: 8,
      cellPadding: 3.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.1
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8
    },
    bodyStyles: {
      fillColor: [255, 255, 255]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // Draw stacked bar comparison on the right side
  const drawX = 120;
  const drawY = currentY;
  const barW = 70; // 70mm width
  const barH = 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text("Visual Comparison", drawX, drawY + 4);

  // Current Bar
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Current Allocation", drawX, drawY + 12);

  let currentX = drawX;
  const eqW = (currentEquityPct / 100) * barW;
  const dtW = (currentDebtPct / 100) * barW;
  const csW = (currentCashPct / 100) * barW;

  if (eqW > 0) {
    doc.setFillColor(8, 145, 178); // Cyan
    doc.rect(currentX, drawY + 14, eqW, barH, 'F');
    currentX += eqW;
  }
  if (dtW > 0) {
    doc.setFillColor(217, 119, 6); // Amber
    doc.rect(currentX, drawY + 14, dtW, barH, 'F');
    currentX += dtW;
  }
  if (csW > 0) {
    doc.setFillColor(71, 85, 105); // Slate
    doc.rect(currentX, drawY + 14, csW, barH, 'F');
    currentX += csW;
  }

  // Recommended Target Bar
  doc.setTextColor(100, 116, 139);
  doc.text(`Recommended (${riskProfile})`, drawX, drawY + 24);

  currentX = drawX;
  const tEqW = (targetEquity / 100) * barW;
  const tDtW = (targetDebt / 100) * barW;
  const tCsW = (targetCash / 100) * barW;

  if (tEqW > 0) {
    doc.setFillColor(8, 145, 178);
    doc.rect(currentX, drawY + 26, tEqW, barH, 'F');
    currentX += tEqW;
  }
  if (tDtW > 0) {
    doc.setFillColor(217, 119, 6);
    doc.rect(currentX, drawY + 26, tDtW, barH, 'F');
    currentX += tDtW;
  }
  if (tCsW > 0) {
    doc.setFillColor(71, 85, 105);
    doc.rect(currentX, drawY + 26, tCsW, barH, 'F');
    currentX += tCsW;
  }

  // Legend
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  
  doc.setFillColor(8, 145, 178);
  doc.rect(drawX, drawY + 34, 3, 3, 'F');
  doc.setTextColor(71, 85, 105);
  doc.text("Equity", drawX + 5, drawY + 36.5);

  doc.setFillColor(217, 119, 6);
  doc.rect(drawX + 22, drawY + 34, 3, 3, 'F');
  doc.text("Debt", drawX + 27, drawY + 36.5);

  doc.setFillColor(71, 85, 105);
  doc.rect(drawX + 44, drawY + 34, 3, 3, 'F');
  doc.text("Cash", drawX + 49, drawY + 36.5);

  currentY = (doc.lastAutoTable?.finalY || currentY) + 8;

  // ── AI SMART REBALANCING DIAGNOSTIC ──
  currentY = drawSectionHeader(doc, "AI Smart Rebalancing Diagnostic", currentY);

  const diff = currentEquityPct - targetEquity;
  let needsRebalance = false;
  let statusStr = "PORTFOLIO BALANCED";
  let statusColor = [5, 150, 105]; // Green
  let recommendation = '';

  if (diff > 5) {
    needsRebalance = true;
    statusStr = "ACTION REQUIRED";
    statusColor = [217, 119, 6]; // Amber
    recommendation = `Your portfolio has a higher equity exposure (${formatPercent(currentEquityPct)}) than recommended for your ${riskProfile} risk profile. Consider shifting approx. ${formatINR((diff / 100) * totalAllocValue)} into Fixed Income/Debt assets to realign exposure.`;
  } else if (diff < -5) {
    needsRebalance = true;
    statusStr = "ACTION REQUIRED";
    statusColor = [217, 119, 6]; // Amber
    recommendation = `Your portfolio is currently underweight in equities (${formatPercent(currentEquityPct)}) compared to your recommended target of ${formatPercent(targetEquity)}. Consider allocating ${formatINR((Math.abs(diff) / 100) * totalAllocValue)} into Equities/ETFs.`;
  } else {
    recommendation = "Your current allocation is aligned with your selected risk profile. No rebalancing actions are required.";
  }

  const diagCardX = 15;
  const diagCardY = currentY;
  const diagCardW = width - 30;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  const splitRec = doc.splitTextToSize(recommendation, diagCardW - 12);
  const recHeight = splitRec.length * 4.5;
  const diagCardH = 26 + recHeight;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(diagCardX, diagCardY, diagCardW, diagCardH, 2, 2, 'F');
  doc.rect(diagCardX, diagCardY, diagCardW, diagCardH, 'S');
  
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.rect(diagCardX, diagCardY + 2, 1.5, diagCardH - 4, 'F');

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("DIAGNOSTIC STATUS:", diagCardX + 6, diagCardY + 6);
  doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.text(statusStr, diagCardX + 38, diagCardY + 6);

  doc.setTextColor(100, 116, 139);
  doc.text("TARGET PROFILE:", diagCardX + 110, diagCardY + 6);
  doc.setTextColor(15, 23, 42);
  doc.text(riskProfile, diagCardX + 138, diagCardY + 6);

  doc.setTextColor(100, 116, 139);
  doc.text("CURRENT EQUITIES:", diagCardX + 6, diagCardY + 12);
  doc.setTextColor(15, 23, 42);
  doc.text(formatPercent(currentEquityPct), diagCardX + 38, diagCardY + 12);

  doc.setTextColor(100, 116, 139);
  doc.text("TARGET EQUITIES:", diagCardX + 110, diagCardY + 6);
  doc.setTextColor(15, 23, 42);
  doc.text(formatPercent(targetEquity), diagCardX + 138, diagCardY + 12);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.25);
  doc.line(diagCardX + 6, diagCardY + 16, diagCardX + diagCardW - 6, diagCardY + 16);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(8, 145, 178); // Cyan
  doc.text("ADVISOR RECOMMENDATION:", diagCardX + 6, diagCardY + 21);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(splitRec, diagCardX + 6, diagCardY + 25);

  currentY += diagCardH + 8;

  // ============================================================================
  // PAGE 2 — PORTFOLIO HOLDINGS DETAIL
  // ============================================================================
  doc.addPage();
  currentY = 20;

  currentY = drawSectionHeader(doc, "Portfolio Holdings Detail", currentY);

  const portfolioRows = [];
  normalizedPortfolio.forEach(item => {
    const units = getPortfolioUnits(item);
    const buyPrice = getPortfolioBuyPrice(item);
    const currPrice = getPortfolioCurrentPrice(item);
    const totalVal = getPortfolioCurrentValue(item);
    const pnlPct = getPortfolioPnLPct(item);
    const pnlVal = totalVal - (units !== 'N/A' ? safeNumber(units) * buyPrice : 0);

    portfolioRows.push({
      symbol: item.symbol || item.asset_name || item.name || 'N/A',
      category: (item.asset_type || item.category || 'N/A').toUpperCase(),
      units: units === 'N/A' ? 'N/A' : safeNumber(units).toLocaleString('en-IN'),
      buyPrice: buyPrice > 0 ? formatINR(buyPrice) : '—',
      currPrice: currPrice > 0 ? formatINR(currPrice) : '—',
      totalValue: formatINR(totalVal),
      pnl: `${pnlVal >= 0 ? '+' : ''}${formatINR(pnlVal)} (${formatPercent(pnlPct, true)})`,
      pnlRaw: pnlVal
    });
  });

  if (portfolioRows.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    doc.text("No portfolio holdings available.", 15, currentY);
    currentY += 12;
  } else {
    renderTable(doc, {
      startY: currentY,
      margin: { left: 15, right: 15 },
      columns: [
        { header: "Asset Symbol / Name", dataKey: "symbol" },
        { header: "Category", dataKey: "category" },
        { header: "Units Held", dataKey: "units" },
        { header: "Avg Buy Price", dataKey: "buyPrice" },
        { header: "Current Market Price", dataKey: "currPrice" },
        { header: "Market Value", dataKey: "totalValue" },
        { header: "Profit / Loss (P&L)", dataKey: "pnl" }
      ],
      body: portfolioRows,
      foot: [
        [
          { content: "TOTAL PORTFOLIO VALUE", colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: formatINR(portfolioVal), colSpan: 2, styles: { fontStyle: 'bold', textColor: [8, 145, 178] } }
        ],
        [
          { content: "TOTAL INVESTED CAPITAL", colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: formatINR(totalBuyVal), colSpan: 2, styles: { fontStyle: 'bold', textColor: [71, 85, 105] } }
        ],
        [
          { content: "TOTAL PROFIT / LOSS", colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: `${overallPnLVal >= 0 ? '+' : ''}${formatINR(overallPnLVal)} (${formatPercent(overallPnLPct, true)})`, colSpan: 2, styles: { fontStyle: 'bold', textColor: overallPnLVal >= 0 ? [5, 150, 105] : [220, 38, 38] } }
        ]
      ],
      theme: 'plain',
      styles: {
        textColor: [30, 41, 59],
        fontSize: 8,
        cellPadding: 3,
        lineColor: [226, 232, 240],
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      bodyStyles: {
        fillColor: [255, 255, 255]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      footStyles: {
        fillColor: [248, 250, 252],
        textColor: [15, 23, 42],
        fontSize: 8,
        lineColor: [226, 232, 240],
        lineWidth: 0.1
      },
      willDrawCell: (data) => {
        if (data.column.dataKey === 'category' && data.cell.section === 'body') {
          data.cell.rawText = data.cell.text[0];
          data.cell.text = ['']; // clear to draw badge
        }
      },
      didDrawCell: (data) => {
        if (data.column.dataKey === 'category' && data.cell.section === 'body') {
          const cell = data.cell;
          const rawText = cell.rawText || '';
          const x = cell.x + 2;
          const y = cell.y + 1.5;
          const w = cell.width - 4;
          const h = cell.height - 3;
          
          let bg = [241, 245, 249];
          let text = [71, 85, 105];
          const cat = rawText.toLowerCase();
          
          if (cat.includes('stock')) {
            bg = [224, 242, 254]; // cyan-50
            text = [8, 145, 178]; // cyan-600
          } else if (cat.includes('mutual fund') || cat.includes('mfs') || cat.includes('mf')) {
            bg = [238, 242, 255]; // indigo-50
            text = [79, 70, 229]; // indigo-600
          } else if (cat.includes('etf')) {
            bg = [243, 232, 255]; // purple-50
            text = [147, 51, 234]; // purple-600
          } else if (cat.includes('crypto')) {
            bg = [253, 242, 248]; // pink-50
            text = [219, 39, 119];
          } else if (cat.includes('fd') || cat.includes('fixed deposit') || cat.includes('bond') || cat.includes('debt')) {
            bg = [254, 243, 199]; // amber-50
            text = [217, 119, 6]; // amber-600
          } else if (cat.includes('cash') || cat.includes('liquid')) {
            bg = [209, 250, 229]; // emerald-50
            text = [5, 150, 105]; // emerald-600
          }

          doc.setFillColor(bg[0], bg[1], bg[2]);
          doc.roundedRect(x, y, w, h, 1, 1, 'F');
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(text[0], text[1], text[2]);
          
          const textWidth = doc.getTextWidth(rawText);
          const textX = x + (w - textWidth) / 2;
          const textY = y + (h / 2) + 2;
          doc.text(rawText, textX, textY);
        }

        if (data.column.dataKey === 'pnl' && data.cell.section === 'body') {
          const valText = data.cell.text[0] || '';
          if (valText.startsWith('+')) {
            doc.setTextColor(5, 150, 105); // green
          } else if (valText.startsWith('-')) {
            doc.setTextColor(220, 38, 38); // red
          }
        }
      }
    });
    currentY = doc.lastAutoTable.finalY + 8;
  }

  // ============================================================================
  // PAGE 3 — FINANCIAL GOALS & INSIGHTS
  // ============================================================================
  doc.addPage();
  currentY = 20;

  currentY = drawSectionHeader(doc, "Financial Goals & Progress", currentY);

  // Goal Summary Blocks X range: 15 to 195 (width = 180mm)
  // 4 cards of width 42mm, with 4mm gaps
  const goalCardW = 42;
  const goalCardH = 15;
  const goalCardGap = 4;
  const goalRowY = currentY;

  // Card 1: TOTAL ACTIVE GOALS
  doc.setFillColor(248, 250, 252);
  doc.rect(15, goalRowY, goalCardW, goalCardH, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.rect(15, goalRowY, goalCardW, goalCardH, 'S');
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("ACTIVE GOALS", 18, goalRowY + 4.5);
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(String(normalizedGoals.length), 18, goalRowY + 11);

  // Card 2: TOTAL TARGET VALUE
  doc.setFillColor(248, 250, 252);
  doc.rect(15 + goalCardW + goalCardGap, goalRowY, goalCardW, goalCardH, 'F');
  doc.rect(15 + goalCardW + goalCardGap, goalRowY, goalCardW, goalCardH, 'S');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("TOTAL TARGET", 15 + goalCardW + goalCardGap + 3, goalRowY + 4.5);
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(formatINR(totalTarget), 15 + goalCardW + goalCardGap + 3, goalRowY + 11);

  // Card 3: TOTAL SAVED
  doc.setFillColor(248, 250, 252);
  doc.rect(15 + (goalCardW + goalCardGap) * 2, goalRowY, goalCardW, goalCardH, 'F');
  doc.rect(15 + (goalCardW + goalCardGap) * 2, goalRowY, goalCardW, goalCardH, 'S');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("TOTAL SAVED", 15 + (goalCardW + goalCardGap) * 2 + 3, goalRowY + 4.5);
  doc.setFontSize(9);
  doc.setTextColor(5, 150, 105);
  doc.text(formatINR(totalSaved), 15 + (goalCardW + goalCardGap) * 2 + 3, goalRowY + 11);

  // Card 4: OVERALL PROGRESS
  doc.setFillColor(248, 250, 252);
  doc.rect(15 + (goalCardW + goalCardGap) * 3, goalRowY, goalCardW, goalCardH, 'F');
  doc.rect(15 + (goalCardW + goalCardGap) * 3, goalRowY, goalCardW, goalCardH, 'S');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("OVERALL PROGRESS", 15 + (goalCardW + goalCardGap) * 3 + 3, goalRowY + 4.5);
  doc.setFontSize(10);
  doc.setTextColor(8, 145, 178);
  doc.text(formatPercent(overallProgress), 15 + (goalCardW + goalCardGap) * 3 + 3, goalRowY + 11);

  currentY = goalRowY + goalCardH + 6;

  // Goals Table
  const goalRows = [];
  normalizedGoals.forEach(g => {
    const target = getGoalTargetAmount(g);
    const saved = getGoalSavedAmount(g);
    const remaining = Math.max(0, target - saved);
    const completion = getGoalProgress(g);

    let status = "ON TRACK";
    if (completion >= 100) {
      status = "COMPLETED";
    } else if (completion >= 50) {
      status = "MILESTONE REACHED";
    } else {
      status = remaining > (target * 0.7) ? "NEEDS ATTENTION" : "ON TRACK";
    }

    goalRows.push({
      title: g.title || g.name || 'N/A',
      target: formatINR(target),
      saved: formatINR(saved),
      remaining: formatINR(remaining),
      completion: completion, // numeric completion for visual rendering
      targetDate: formatDate(g.target_date || g.targetDate),
      status: status
    });
  });

  if (goalRows.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    doc.text("No financial goals available.", 15, currentY);
    currentY += 12;
  } else {
    renderTable(doc, {
      startY: currentY,
      margin: { left: 15, right: 15 },
      columns: [
        { header: "Goal Title", dataKey: "title" },
        { header: "Target Amount", dataKey: "target" },
        { header: "Saved Amount", dataKey: "saved" },
        { header: "Remaining", dataKey: "remaining" },
        { header: "Progress", dataKey: "completion" },
        { header: "Target Date", dataKey: "targetDate" },
        { header: "Status", dataKey: "status" }
      ],
      body: goalRows,
      theme: 'plain',
      styles: {
        textColor: [30, 41, 59],
        fontSize: 7.5,
        cellPadding: 3,
        lineColor: [226, 232, 240],
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5
      },
      bodyStyles: {
        fillColor: [255, 255, 255]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      willDrawCell: (data) => {
        if (data.column.dataKey === 'completion' && data.cell.section === 'body') {
          data.cell.rawText = data.cell.text[0];
          data.cell.text = ['']; // clear to draw horizontal progress bar
        }
        if (data.column.dataKey === 'status' && data.cell.section === 'body') {
          data.cell.rawText = data.cell.text[0];
          data.cell.text = ['']; // clear to draw badge
        }
      },
      didDrawCell: (data) => {
        // Draw horizontal progress bar inside cell
        if (data.column.dataKey === 'completion' && data.cell.section === 'body') {
          const cell = data.cell;
          const val = safeNumber(cell.raw);
          
          const barX = cell.x + 2;
          const barY = cell.y + (cell.height / 2) - 1.5;
          const barW = cell.width - 4;
          const barH = 3;

          doc.setFillColor(241, 245, 249);
          doc.rect(barX, barY, barW, barH, 'F');

          const filledW = (Math.min(100, Math.max(0, val)) / 100) * barW;
          if (filledW > 0) {
            doc.setFillColor(8, 145, 178); // Cyan
            doc.rect(barX, barY, filledW, barH, 'F');
          }

          doc.setFontSize(6.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(71, 85, 105);
          doc.text(`${val.toFixed(0)}%`, barX, barY - 1);
        }

        // Draw Status Badge
        if (data.column.dataKey === 'status' && data.cell.section === 'body') {
          const cell = data.cell;
          const rawText = cell.rawText || '';
          const x = cell.x + 2;
          const y = cell.y + 1.5;
          const w = cell.width - 4;
          const h = cell.height - 3;
          
          let bg = [241, 245, 249];
          let text = [71, 85, 105];
          
          if (rawText === "COMPLETED") {
            bg = [209, 250, 229]; // green
            text = [5, 150, 105];
          } else if (rawText === "MILESTONE REACHED") {
            bg = [224, 242, 254]; // cyan
            text = [8, 145, 178];
          } else if (rawText === "ON TRACK") {
            bg = [219, 234, 254]; // blue
            text = [37, 99, 235];
          } else if (rawText === "NEEDS ATTENTION") {
            bg = [254, 243, 199]; // amber
            text = [217, 119, 6];
          }

          doc.setFillColor(bg[0], bg[1], bg[2]);
          doc.roundedRect(x, y, w, h, 1, 1, 'F');
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(text[0], text[1], text[2]);
          
          const textWidth = doc.getTextWidth(rawText);
          const textX = x + (w - textWidth) / 2;
          const textY = y + (h / 2) + 2;
          doc.text(rawText, textX, textY);
        }
      }
    });
    currentY = doc.lastAutoTable.finalY + 8;
  }

  // ── SMART WEALTH INSIGHTS ──
  if (currentY > height - 60) {
    doc.addPage();
    currentY = 20;
  }

  currentY = drawSectionHeader(doc, "Smart Wealth Insights", currentY);

  const insightsList = [];
  if (diff > 5) {
    insightsList.push(`Equity exposure is currently above the recommended target (+${diff.toFixed(1)}% drift) for your ${riskProfile} risk profile.`);
  } else if (diff < -5) {
    insightsList.push(`Equity exposure is currently below the recommended target (${diff.toFixed(1)}% drift) for your ${riskProfile} risk profile.`);
  } else {
    insightsList.push(`Your asset allocation is currently well aligned with the recommended targets for your ${riskProfile} risk profile.`);
  }

  if (normalizedGoals.length > 0) {
    const activeGoals = normalizedGoals.filter(g => getGoalProgress(g) < 100);
    if (activeGoals.length > 0) {
      activeGoals.sort((a, b) => getGoalProgress(b) - getGoalProgress(a));
      const topGoal = activeGoals[0];
      insightsList.push(`Your "${topGoal.title || topGoal.name}" goal has reached ${formatPercent(getGoalProgress(topGoal))} completion.`);
    } else {
      insightsList.push("All of your active financial goals are 100% completed.");
    }
  }

  insightsList.push(`Your portfolio currently contains ${normalizedPortfolio.length} active asset holdings.`);

  if (overallPnLVal > 0) {
    insightsList.push(`Your investment portfolio has generated a net positive return of ${formatINR(overallPnLVal)} (${formatPercent(overallPnLPct, true)}).`);
  } else if (overallPnLVal < 0) {
    insightsList.push(`Your investment portfolio is currently experiencing a net loss of ${formatINR(Math.abs(overallPnLVal))} (${formatPercent(overallPnLPct, true)}).`);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  
  insightsList.forEach(insight => {
    doc.setFillColor(8, 145, 178); // cyan bullet
    doc.circle(18, currentY + 1.2, 1, 'F');
    doc.setTextColor(51, 65, 85);
    doc.text(insight, 22, currentY + 2);
    currentY += 6;
  });

  currentY += 4;

  // ── RECENT FINANCIAL ACTIVITY ──
  if (currentY > height - 60) {
    doc.addPage();
    currentY = 20;
  }

  currentY = drawSectionHeader(doc, "Recent Financial Activity", currentY);

  const alertRows = [];
  normalizedAlerts.forEach(a => {
    const title = a.title || 'System Notification';
    const message = a.message || a.event || '';
    const dateVal = a.created_at || a.timestamp || a.date;
    
    let dateText = 'N/A';
    if (dateVal) {
      try {
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
          dateText = formatDate(dateVal) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        } else {
          dateText = String(dateVal);
        }
      } catch {
        dateText = String(dateVal);
      }
    }

    alertRows.push({
      timestamp: dateText,
      title: title,
      message: message,
      status: (a.severity || 'info').toUpperCase()
    });
  });

  if (alertRows.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor(148, 163, 184);
    doc.text("No recent alerts or financial activity available.", 15, currentY);
  } else {
    renderTable(doc, {
      startY: currentY,
      margin: { left: 15, right: 15 },
      columns: [
        { header: "Date / Time", dataKey: "timestamp" },
        { header: "Event", dataKey: "title" },
        { header: "Description", dataKey: "message" },
        { header: "Status", dataKey: "status" }
      ],
      body: alertRows,
      theme: 'plain',
      styles: {
        textColor: [30, 41, 59],
        fontSize: 7.5,
        cellPadding: 3,
        lineColor: [226, 232, 240],
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.5
      },
      bodyStyles: {
        fillColor: [255, 255, 255]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        message: { cellWidth: 80 }
      },
      willDrawCell: (data) => {
        if (data.column.dataKey === 'status' && data.cell.section === 'body') {
          data.cell.rawText = data.cell.text[0];
          data.cell.text = [''];
        }
      },
      didDrawCell: (data) => {
        if (data.column.dataKey === 'status' && data.cell.section === 'body') {
          const cell = data.cell;
          const rawText = cell.rawText || '';
          const x = cell.x + 2;
          const y = cell.y + 1.5;
          const w = cell.width - 4;
          const h = cell.height - 3;
          
          let bg = [241, 245, 249];
          let text = [71, 85, 105];
          
          if (rawText === "WARNING" || rawText === "AI_WARNING" || rawText === "HIGH") {
            bg = [254, 243, 199]; // amber
            text = [217, 119, 6];
          } else if (rawText === "SUCCESS" || rawText === "LOW") {
            bg = [209, 250, 229]; // green
            text = [5, 150, 105];
          } else if (rawText === "INFO") {
            bg = [224, 242, 254]; // cyan
            text = [8, 145, 178];
          }

          doc.setFillColor(bg[0], bg[1], bg[2]);
          doc.roundedRect(x, y, w, h, 1, 1, 'F');
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.5);
          doc.setTextColor(text[0], text[1], text[2]);
          
          const textWidth = doc.getTextWidth(rawText);
          const textX = x + (w - textWidth) / 2;
          const textY = y + (h / 2) + 2;
          doc.text(rawText, textX, textY);
        }
      }
    });
  }

  // ============================================================================
  // FOOTER & DECORATIONS RUNNER (POST-PROCESSING)
  // ============================================================================
  const totalPages = doc.internal.getNumberOfPages();

  const drawDecorations = (pageNumber, total) => {
    if (pageNumber > 1) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(30, 41, 59);
      doc.text("WEALTHTRACK PRO", 15, 10);
      
      doc.setFont("helvetica", "normal");
      doc.setTextColor(148, 163, 184);
      doc.text("|   Personal Wealth Intelligence Platform", 46, 10);
      
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(15, 12, width - 15, 12);
    }

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(15, height - 15, width - 15, height - 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);

    doc.text("WealthTrack Pro   ·   Confidential Personal Financial Report", 15, height - 10);

    const disclaimer = "Disclaimer: This report is for informational and planning purposes only and does not constitute investment advice.";
    doc.text(disclaimer, 15, height - 6);

    const pageText = `Page ${pageNumber} of ${total}`;
    doc.text(pageText, width - 15 - doc.getTextWidth(pageText), height - 11);
  };

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawDecorations(i, totalPages);
  }

  // ── SAVE THE PDF FILE IN BROWSER ──────────────────────────────────────────
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const filename = `Wealth_Summary_Report_${yyyy}-${mm}-${dd}.pdf`;
  
  doc.save(filename);
}
