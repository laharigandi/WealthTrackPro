/**
 * Centralized symbol normalization for frontend client
 */

const SYMBOL_MAP = {
  RELIANCE: "RELIANCE.NS",
  TCS: "TCS.NS",
  HDFCBANK: "HDFCBANK.NS",
  INFY: "INFY.NS",
  ICICIBANK: "ICICIBANK.NS",
  SBIN: "SBIN.NS",
  BHARTIARTL: "BHARTIARTL.NS",
  ITC: "ITC.NS",
  KOTAKBANK: "KOTAKBANK.NS",
  LT: "LT.NS",
  AXISBANK: "AXISBANK.NS",
  TATAMOTORS: "TATAMOTORS.NS",
  MARUTI: "MARUTI.NS",
  WIPRO: "WIPRO.NS",
  HCLTECH: "HCLTECH.NS",
  NIFTYBEES: "NIFTYBEES.NS",
  GOLDBEES: "GOLDBEES.NS",
  JUNIORBEES: "JUNIORBEES.NS",
  BANKBEES: "BANKBEES.NS",
  LIQUIDBEES: "LIQUIDBEES.NS",
};

const KNOWN_US_SYMBOLS = new Set([
  "AAPL", "MSFT", "TSLA", "GOOG", "GOOGL", "AMZN", "NVDA", "META",
  "NFLX", "SPY", "QQQ", "VTI", "VOO", "DIA", "BND", "GLD", "SLV", "AMD", "INTC", "BRK-B"
]);

const KNOWN_CRYPTO_SYMBOLS = new Set([
  "BTC", "ETH", "SOL", "USDT", "BNB", "XRP", "ADA", "DOGE", "AVAX", "DOT", "MATIC"
]);

export const normalizeSymbol = (symbol, assetType = "Stock") => {
  if (!symbol || typeof symbol !== "string" || !symbol.trim()) {
    return "";
  }

  const cleanType = (assetType || "Stock").trim().toLowerCase();
  if (["bond", "fixed deposit", "fd", "cash"].includes(cleanType)) {
    return "";
  }

  // Remove all internal whitespace and convert to uppercase
  let s = symbol.replace(/\s+/g, "").toUpperCase();

  // 1. Mutual Fund handling: NEVER append .NS
  if (["mutual fund", "mutual_fund", "mf", "mutualfund"].includes(cleanType)) {
    if (s.endsWith(".NS")) {
      s = s.slice(0, -3);
    } else if (s.endsWith(".BO")) {
      s = s.slice(0, -3);
    }
    return s;
  }

  // 2. Crypto handling
  if (["crypto", "cryptocurrency"].includes(cleanType)) {
    if (s.endsWith("-USD")) {
      return s;
    }
    if (KNOWN_CRYPTO_SYMBOLS.has(s) || (/^[A-Z0-9]+$/.test(s) && s.length <= 6)) {
      return `${s}-USD`;
    }
    return s;
  }

  // 3. Stock & ETF handling
  // Repair legacy typo .NA to .NS
  if (s.endsWith(".NA")) {
    s = s.slice(0, -3) + ".NS";
  }

  // Remove duplicate .NS.NS
  while (s.endsWith(".NS.NS")) {
    s = s.slice(0, -3);
  }

  // Explicit check in dictionary
  if (SYMBOL_MAP[s]) {
    return SYMBOL_MAP[s];
  }

  // Suffix checks
  const suffixes = [".NS", ".BO", ".L", ".TO", ".AX", ".DE", ".HK", ".SS", ".SZ"];
  if (suffixes.some((suffix) => s.endsWith(suffix))) {
    return s;
  }

  if (s.includes("-") || s.includes("=X") || s.includes("^")) {
    return s;
  }

  if (KNOWN_US_SYMBOLS.has(s)) {
    return s;
  }

  // Standard alphanumeric -> default to NSE .NS for Stock / ETF
  if (/^[A-Z0-9]+$/.test(s)) {
    return `${s}.NS`;
  }

  return s;
};
