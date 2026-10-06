import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp, TrendingDown, Search, RefreshCw, ShoppingCart,
  CheckCircle2, AlertCircle, X, Zap, Trash2, Plus, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageTransition } from '../components/common/PageTransition';
import { getMarketQuotes, searchMarketSymbol } from '../services/marketService';
import { createTransaction } from '../services/transactionService';
import { Button } from '../components/common/Button';

const DEFAULT_WATCHLIST = [
  "TCS.NS",
  "RELIANCE.NS",
  "HDFCBANK.NS",
  "INFY.NS",
  "NIFTYBEES.NS",
  "AAPL",
  "MSFT",
  "TSLA",
  "GOLDBEES.NS",
  "BTC-USD",
  "ETH-USD"
];

export const MarketPrices = () => {
  const [watchlistSymbols, setWatchlistSymbols] = useState(() => {
    const stored = localStorage.getItem('wealthtrack_watchlist');
    return stored ? JSON.parse(stored) : DEFAULT_WATCHLIST;
  });

  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetType, setSelectedAssetType] = useState('ALL');
  const [msg, setMsg] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');

  // Live search state
  const [liveSearch, setLiveSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const searchTimeout = useRef(null);

  // Price Flash state
  const [flashStates, setFlashStates] = useState({});
  const previousPricesRef = useRef({});

  // Buy Modal state
  const [buyModalQuote, setBuyModalQuote] = useState(null);
  const [buyQuantity, setBuyQuantity] = useState('1');
  const [buying, setBuying] = useState(false);

  const showToast = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  // Sync Watchlist to localStorage
  useEffect(() => {
    localStorage.setItem('wealthtrack_watchlist', JSON.stringify(watchlistSymbols));
  }, [watchlistSymbols]);

  // Fetch Watchlist Quotes
  const fetchMarketData = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await getMarketQuotes(watchlistSymbols);
      setQuotes(data.quotes || []);
      if (data.fetched_at) {
        const dateObj = new Date(data.fetched_at);
        setLastUpdated(dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } else {
        setLastUpdated(new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err) {
      console.error('Failed to fetch market quotes:', err);
      showToast('error', 'Market data temporarily unavailable.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 30-Second Refresh with tab visibility checking & proper cleanup
  useEffect(() => {
    fetchMarketData(true);
    let intervalId = null;

    const startInterval = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(() => {
        if (!document.hidden) {
          fetchMarketData(false);
        }
      }, 30000);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchMarketData(false);
        startInterval();
      } else {
        if (intervalId) clearInterval(intervalId);
      }
    };

    startInterval();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalId) clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [watchlistSymbols]);

  // Price Flash triggers when quotes change
  useEffect(() => {
    const newFlashes = {};
    quotes.forEach((q) => {
      const oldPrice = previousPricesRef.current[q.symbol];
      if (oldPrice !== undefined && q.current_price !== null && oldPrice !== null && q.current_price !== oldPrice) {
        if (q.current_price > oldPrice) {
          newFlashes[q.symbol] = 'up';
        } else if (q.current_price < oldPrice) {
          newFlashes[q.symbol] = 'down';
        }
      }
      previousPricesRef.current[q.symbol] = q.current_price;
    });

    if (Object.keys(newFlashes).length > 0) {
      setFlashStates((prev) => ({ ...prev, ...newFlashes }));
      const timer = setTimeout(() => {
        setFlashStates((prev) => {
          const cleared = { ...prev };
          Object.keys(newFlashes).forEach((sym) => {
            delete cleared[sym];
          });
          return cleared;
        });
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [quotes]);

  // Live symbol search (debounced by 500ms)
  const handleLiveSearch = (val) => {
    setLiveSearch(val);
    setSearchResult(null);
    setSearchError('');
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    
    const trimmed = val.trim();
    if (!trimmed) return;

    // Early local validation on ticker format
    const pattern = /^[A-Za-z0-9.\-=:]+$/;
    if (!pattern.test(trimmed)) {
      setSearchError('Enter a valid ticker symbol');
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchMarketSymbol(trimmed);
        if (data && data.current_price !== null && !data.error) {
          setSearchResult(data);
        } else {
          setSearchError(data?.error || 'Symbol not found or data unavailable.');
        }
      } catch (err) {
        setSearchError('Symbol not found or market data unavailable.');
      } finally {
        setSearching(false);
      }
    }, 500);
  };

  const addToWatchlist = (symbol) => {
    const sym = symbol.toUpperCase().trim();
    if (watchlistSymbols.includes(sym)) {
      showToast('error', `${sym} is already in your watchlist.`);
      return;
    }
    setWatchlistSymbols((prev) => [...prev, sym]);
    showToast('success', `${sym} added to watchlist successfully.`);
  };

  const removeFromWatchlist = (symbol) => {
    setWatchlistSymbols((prev) => prev.filter((s) => s !== symbol));
    showToast('success', `${symbol} removed from watchlist.`);
  };

  const filteredQuotes = quotes.filter((q) => {
    const symbolStr = q.symbol || '';
    const nameStr = q.name || '';
    const matchesSearch =
      symbolStr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      nameStr.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedAssetType === 'ALL' || q.market_type === selectedAssetType;
    return matchesSearch && matchesType;
  });

  const handleBuySubmit = async (e) => {
    e.preventDefault();
    if (!buyModalQuote) return;
    setBuying(true);
    try {
      await createTransaction({
        symbol: buyModalQuote.symbol,
        asset_name: buyModalQuote.name || buyModalQuote.symbol,
        asset_type: buyModalQuote.market_type === 'CRYPTO' ? 'Crypto' : 'Stock',
        transaction_type: 'BUY',
        quantity: parseFloat(buyQuantity),
        price: buyModalQuote.current_price,
        notes: 'Direct market purchase',
      });
      showToast('success', `Successfully purchased ${buyQuantity} unit(s) of ${buyModalQuote.symbol}! Portfolio updated.`);
      setBuyModalQuote(null);
      setBuyQuantity('1');
    } catch {
      showToast('error', 'Failed to execute market purchase. Please try again.');
    } finally {
      setBuying(false);
    }
  };

  // Format currency according to the exact spec locale formatters
  const formatPriceVal = (price, currency) => {
    if (price === null || price === undefined || isNaN(price)) return '—';
    if (currency === 'INR') {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR"
      }).format(price);
    } else {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD"
      }).format(price);
    }
  };

  const formatChangeVal = (change, currency) => {
    if (change === null || change === undefined || isNaN(change)) return '—';
    const sign = change >= 0 ? '+' : '';
    // Format positive amount absolute to prevent double minus signs
    const formatted = formatPriceVal(Math.abs(change), currency);
    return `${sign}${formatted}`;
  };

  const formatPercentVal = (val) => {
    if (val === null || val === undefined || isNaN(val)) return '0.00%';
    const sign = val >= 0 ? '+' : '';
    return `${sign}${Number(val).toFixed(2)}%`;
  };

  const QuoteCard = ({ q, isLive, showDelete }) => {
    const [cardExpanded, setCardExpanded] = useState(false);
    const isPositive = (q.change || 0) >= 0;
    const flash = flashStates[q.symbol];
    
    let flashClass = '';
    if (flash === 'up') {
      flashClass = 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/20 dark:border-emerald-800 scale-[1.01] shadow-lg shadow-emerald-500/10';
    } else if (flash === 'down') {
      flashClass = 'bg-rose-50 border-rose-300 dark:bg-rose-950/20 dark:border-rose-800 scale-[1.01] shadow-lg shadow-rose-500/10';
    }

    const hasError = !!q.error;

    return (
      <motion.div 
        layout
        transition={{ layout: { duration: 0.7, ease: "easeInOut" } }}
        onClick={() => setCardExpanded(!cardExpanded)}
        className="card p-6 space-y-4 hover:border-indigo-500/50 dark:hover:border-indigo-500/40 hover:-translate-y-1 hover:scale-[1.01] hover:shadow-indigo-500/10 dark:hover:shadow-indigo-500/5 transition-all duration-300 ease-out cursor-pointer relative"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md">
                {q.market_type || 'Stock'}
              </span>
              {hasError ? (
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-rose-55 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-md">
                  Data unavailable
                </span>
              ) : q.market_status === 'LIVE' ? (
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-250 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse" /> Live Market Data
                </span>
              ) : (
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700/50">
                  Market Closed
                </span>
              )}
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">{q.symbol}</h3>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 truncate" title={q.name}>{q.name || '—'}</p>
          </div>
          
          <div className="flex flex-col items-end gap-1.5">
            {!hasError && (
              <span className={`inline-flex items-center gap-1 text-xs font-bold ${isPositive ? 'val-positive' : 'val-negative'}`}>
                {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {formatPercentVal(q.change_percent)}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              {showDelete && (
                <button 
                  onClick={(e) => { e.stopPropagation(); removeFromWatchlist(q.symbol); }}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 rounded-md transition-colors"
                  title="Remove from Watchlist"
                >
                  <Trash2 size={15} />
                </button>
              )}
              <motion.div
                animate={{ rotate: cardExpanded ? 180 : 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
              >
                <ChevronDown size={16} className="text-slate-400" />
              </motion.div>
            </div>
          </div>
        </div>

        {hasError ? (
          <div className="py-6 text-center border-t border-slate-100 dark:border-slate-800/80">
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400">Market data temporarily unavailable.</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{q.error}</p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between border-t border-slate-200 dark:border-slate-800/80 pt-3">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Price</p>
                <p className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-slate-50">{formatPriceVal(q.current_price, q.currency)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Day Change</p>
                <p className={`text-sm font-bold ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {formatChangeVal(q.change, q.currency)}
                </p>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {cardExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden border-t border-slate-200 dark:border-slate-800/80 pt-4 mt-2 space-y-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="grid grid-cols-3 gap-1.5 text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/40">
                    <div>Prev: <span className="font-extrabold text-slate-800 dark:text-slate-200">{formatPriceVal(q.previous_close, q.currency)}</span></div>
                    <div>High: <span className="font-extrabold text-slate-800 dark:text-slate-200">{formatPriceVal(q.day_high, q.currency)}</span></div>
                    <div>Low: <span className="font-extrabold text-slate-800 dark:text-slate-200">{formatPriceVal(q.day_low, q.currency)}</span></div>
                  </div>

                  <div className="text-[10px] text-slate-500 space-y-0.5 pt-1.5">
                    <p className="font-semibold">
                      Last updated: <span className="text-slate-700 dark:text-slate-300">{q.last_updated ? new Date(q.last_updated).toLocaleString() : '—'}</span>
                    </p>
                    <p className="font-medium text-slate-400">Source: {q.data_source}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <Button 
              onClick={(e) => { e.stopPropagation(); setBuyModalQuote(q); setBuyQuantity('1'); }} 
              className="w-full text-sm py-2 px-4 font-bold flex items-center justify-center gap-1.5"
            >
              <ShoppingCart size={14} /> Buy Asset
            </Button>
          </>
        )}
      </motion.div>
    );
  };

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 dark:text-slate-50 flex items-center gap-2 tracking-tight">
              <TrendingUp className="text-indigo-600 dark:text-indigo-400 shrink-0" size={28} /> Market Prices & Watchlist
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium">
              Real-time market quotes provided by Yahoo Finance. Prices may be delayed depending on exchange/instrument.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 self-stretch sm:self-auto justify-end">
            {(refreshing || loading) && (
              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 animate-pulse bg-indigo-500/10 px-2.5 py-1.5 rounded-lg border border-indigo-500/20">
                Updating...
              </span>
            )}
            <button
              onClick={() => fetchMarketData(false)}
              disabled={loading || refreshing}
              title="Refresh Market Quotes"
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 transition-all flex items-center gap-2 text-xs sm:text-sm font-bold shadow-sm hover:shadow active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={15} className={refreshing || loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>
        </div>

        {msg && (
          <div className={`p-4 rounded-xl border text-sm font-bold flex items-center gap-2.5 ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-600 border-emerald-250 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-rose-50 border-rose-250 text-rose-600 dark:bg-rose-955/40 dark:text-rose-455'}`}>
            {msg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {msg.text}
          </div>
        )}

        {/* Live Symbol Search */}
        <div className="card p-4 sm:p-6 space-y-3 sm:space-y-4 shadow-md">
          <div className="flex items-center gap-2 flex-wrap">
            <Zap size={16} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-50">Live Ticker Lookup</h2>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">Yahoo Finance API</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
            Lookup any standard Yahoo symbol (e.g. <b>AAPL</b>, <b>NVDA</b>, <b>TATAMOTORS.NS</b>, <b>BTC-USD</b>) and add it to your watchlist.
          </p>

          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Type ticker symbol to fetch live quote..."
              value={liveSearch}
              onChange={(e) => handleLiveSearch(e.target.value)}
              className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm"
            />
            {liveSearch && (
              <button onClick={() => { setLiveSearch(''); setSearchResult(null); setSearchError(''); }} className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-700 dark:text-slate-300 p-1">
                <X size={18} />
              </button>
            )}
          </div>

          {searching && (
            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              <RefreshCw size={14} className="animate-spin" /> Searching live market data…
            </div>
          )}

          {searchError && (
            <div className="p-3.5 val-negative rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2">
              <AlertCircle size={15} /> {searchError}
            </div>
          )}

          {searchResult && (
            <div className="max-w-sm border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-md">
              <QuoteCard q={searchResult} isLive={true} />
              <div className="bg-slate-50 dark:bg-slate-950/40 p-3 flex justify-end border-t border-slate-100 dark:border-slate-800/80">
                <Button 
                  onClick={() => addToWatchlist(searchResult.symbol)}
                  className="text-xs py-1.5 px-3 flex items-center gap-1 font-bold"
                  variant="secondary"
                >
                  <Plus size={13} /> Add to Watchlist
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Watchlist Section Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 pt-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight">Active Watchlist</h2>
            {lastUpdated && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-bold">
                Last updated: {lastUpdated}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            {/* Watchlist Filter Input */}
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Filter watchlist..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm"
              />
            </div>

            {/* Asset Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
              {['ALL', 'NSE', 'US', 'CRYPTO'].map((type) => (
                <button
                  key={type}
                  onClick={() => setSelectedAssetType(type)}
                  className={`px-3 py-1 rounded-lg text-xs font-black transition-all whitespace-nowrap border cursor-pointer ${
                    selectedAssetType === type
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {type === 'ALL' ? 'All Assets' : type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Watchlist Cards Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            <div className="h-56 bg-slate-200 dark:bg-slate-900 rounded-2xl" />
            <div className="h-56 bg-slate-200 dark:bg-slate-900 rounded-2xl" />
            <div className="h-56 bg-slate-200 dark:bg-slate-900 rounded-2xl" />
          </div>
        ) : filteredQuotes.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm text-slate-600 dark:text-slate-400 text-sm font-bold">
            <Zap size={24} className="mx-auto text-slate-400 mb-2 opacity-50" />
            No watchlist assets match your filter criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredQuotes.map((q) => (
              <QuoteCard key={q.symbol} q={q} isLive={false} showDelete={true} />
            ))}
          </div>
        )}

        {/* Buy Asset Quick Modal */}
        {buyModalQuote && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
            <div className="card max-w-sm w-full p-4 sm:p-6 space-y-4 relative border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 rounded-3xl max-h-[90vh] overflow-y-auto">
              <button onClick={() => setBuyModalQuote(null)} className="absolute top-4 right-4 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 p-1 cursor-pointer"><X size={20} /></button>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-50 flex items-center gap-2">
                <ShoppingCart size={18} className="text-indigo-600 dark:text-indigo-400" /> Acquire {buyModalQuote.symbol}
              </h3>
              <div className="p-3 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-200/50 dark:border-slate-800/50 space-y-1 text-sm">
                <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm">{buyModalQuote.name}</p>
                <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50">
                  Unit Price: {formatPriceVal(buyModalQuote.current_price, buyModalQuote.currency)}
                </p>
              </div>
              <form onSubmit={handleBuySubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Quantity to Purchase</label>
                  <input
                    type="number" step="any" required min="0.001" value={buyQuantity}
                    onChange={(e) => setBuyQuantity(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
                <div className="p-3 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  <span>Estimated Total:</span>
                  <span>
                    {formatPriceVal(buyModalQuote.current_price * parseFloat(buyQuantity || 0), buyModalQuote.currency)}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setBuyModalQuote(null)} className="text-xs sm:text-sm py-2 px-3 font-bold">Cancel</Button>
                  <Button type="submit" loading={buying} className="text-xs sm:text-sm py-2 px-4 font-bold">Confirm Buy</Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
};
export default MarketPrices;
