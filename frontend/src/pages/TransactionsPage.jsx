import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeftRight, Plus, CheckCircle2, AlertCircle, RefreshCw, X,
  PlusCircle, Trash2, AlertTriangle, TrendingDown, TrendingUp, ShieldAlert
} from 'lucide-react';
import { getTransactions, createTransaction, deleteTransaction } from '../services/transactionService';
import { getPortfolio } from '../services/portfolioService';
import { normalizeSymbol } from '../utils/symbolUtils';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Button } from '../components/common/Button';
import { PageTransition } from '../components/common/PageTransition';

export const TransactionsPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [portfolioHoldings, setPortfolioHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingTx, setDeletingTx] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Buy Mode: 'existing' | 'new'
  const [buySelectionMode, setBuySelectionMode] = useState('existing');

  const [formData, setFormData] = useState({
    transaction_type: 'BUY',
    asset_type: 'Stock',
    symbol: '',
    asset_name: '',
    quantity: '1',
    price: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const fieldClass = "w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl h-11 px-3.5 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm font-medium";

  const showToast = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  };

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [txData, portfolioData] = await Promise.all([
        getTransactions().catch(() => []),
        getPortfolio().catch(() => []),
      ]);
      setTransactions(txData || []);
      setPortfolioHoldings(portfolioData || []);
    } catch {
      showToast('error', 'Failed to fetch transaction logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Filter holdings with available quantity > 0
  const availableHoldings = useMemo(() => {
    return (portfolioHoldings || []).filter((h) => Number(h.quantity || 0) > 0.0001);
  }, [portfolioHoldings]);

  // Find currently selected holding for SELL or BUY
  const selectedHolding = useMemo(() => {
    if (!formData.symbol) return null;
    const norm = normalizeSymbol(formData.symbol, formData.asset_type);
    return availableHoldings.find(
      (h) => (h.symbol && h.symbol.toUpperCase() === formData.symbol.toUpperCase()) ||
             (h.normalized_symbol && h.normalized_symbol.toUpperCase() === norm) ||
             (h.symbol && h.symbol.toUpperCase() === norm)
    ) || null;
  }, [formData.symbol, formData.asset_type, availableHoldings]);

  const maxSellQty = selectedHolding ? Number(selectedHolding.quantity || 0) : 0;
  const currentSellQty = parseFloat(formData.quantity) || 0;
  const isSellExceeded = formData.transaction_type === 'SELL' && (currentSellQty > maxSellQty + 1e-6);
  const isInvalidQty = currentSellQty <= 0;

  // Handle opening Modal
  const openAddModal = (defaultType = 'BUY') => {
    if (defaultType === 'SELL' && availableHoldings.length > 0) {
      const first = availableHoldings[0];
      setFormData({
        transaction_type: 'SELL',
        asset_type: first.asset_type || 'Stock',
        symbol: first.symbol || first.normalized_symbol || '',
        asset_name: first.asset_name || '',
        quantity: '1',
        price: (first.current_price || first.average_buy_price || '').toString(),
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    } else {
      setFormData({
        transaction_type: defaultType,
        asset_type: 'Stock',
        symbol: '',
        asset_name: '',
        quantity: '1',
        price: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    }
    setBuySelectionMode(availableHoldings.length > 0 ? 'existing' : 'new');
    setIsModalOpen(true);
  };

  // Handle Type Change
  const handleTypeChange = (newType) => {
    if (newType === 'SELL') {
      if (availableHoldings.length > 0) {
        const first = availableHoldings[0];
        setFormData((prev) => ({
          ...prev,
          transaction_type: 'SELL',
          asset_type: first.asset_type || 'Stock',
          symbol: first.symbol || first.normalized_symbol || '',
          asset_name: first.asset_name || '',
          price: (first.current_price || first.average_buy_price || '').toString(),
          quantity: prev.quantity && parseFloat(prev.quantity) <= first.quantity ? prev.quantity : '1',
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          transaction_type: 'SELL',
          symbol: '',
          asset_name: '',
          price: '',
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        transaction_type: newType,
      }));
    }
  };

  // Handle Holding Selection in SELL or BUY
  const handleHoldingSelect = (symbolVal) => {
    const found = availableHoldings.find(
      (h) => (h.symbol && h.symbol === symbolVal) || (h.normalized_symbol && h.normalized_symbol === symbolVal)
    );
    if (found) {
      setFormData((prev) => ({
        ...prev,
        symbol: found.symbol || found.normalized_symbol,
        asset_name: found.asset_name || found.symbol,
        asset_type: found.asset_type || 'Stock',
        price: (found.current_price || found.average_buy_price || prev.price || '').toString(),
        quantity: prev.quantity && parseFloat(prev.quantity) <= found.quantity ? prev.quantity : '1',
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        symbol: symbolVal,
      }));
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const qty = parseFloat(formData.quantity);
    if (!qty || qty <= 0) {
      showToast('error', 'Quantity must be greater than 0.');
      return;
    }

    const prc = parseFloat(formData.price);
    if (isNaN(prc) || prc < 0) {
      showToast('error', 'Please enter a valid price per unit.');
      return;
    }

    const rawSymbol = formData.symbol.trim();
    if (!rawSymbol) {
      showToast('error', 'Please select or enter an asset symbol.');
      return;
    }

    const canonicalSym = normalizeSymbol(rawSymbol, formData.asset_type);
    const resolvedSymbol = canonicalSym || rawSymbol.toUpperCase();

    // Client-side SELL validation
    if (formData.transaction_type === 'SELL') {
      if (!selectedHolding && maxSellQty <= 0) {
        showToast('error', `Cannot sell ${resolvedSymbol}. You do not hold any shares of this asset.`);
        return;
      }
      if (qty > maxSellQty + 1e-6) {
        const dispMax = Number.isInteger(maxSellQty) ? maxSellQty : maxSellQty.toFixed(2);
        showToast('error', `Cannot sell ${qty} ${resolvedSymbol}. Maximum available quantity is ${dispMax}.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      const todayStr = new Date().toISOString().split('T')[0];
      let txDateIso = null;
      if (formData.date) {
        if (formData.date === todayStr) {
          txDateIso = new Date().toISOString();
        } else {
          txDateIso = new Date(`${formData.date}T12:00:00`).toISOString();
        }
      }

      await createTransaction({
        symbol: resolvedSymbol,
        asset_name: formData.asset_name.trim() || resolvedSymbol,
        asset_type: formData.asset_type || 'Stock',
        transaction_type: formData.transaction_type,
        quantity: qty,
        price: prc,
        notes: formData.notes ? formData.notes.trim() : null,
        transaction_date: txDateIso,
      });

      showToast(
        'success',
        `Recorded ${formData.transaction_type} of ${qty} ${resolvedSymbol}! Portfolio synchronized.`
      );
      setIsModalOpen(false);
      resetForm();
      await fetchAllData();
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to record transaction.';
      showToast('error', detail);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (tx) => {
    setDeletingTx(tx);
  };

  const confirmDelete = async () => {
    if (!deletingTx || isDeleting) return;
    try {
      setIsDeleting(true);
      await deleteTransaction(deletingTx.id);
      showToast('success', `Deleted ${deletingTx.transaction_type} transaction for ${deletingTx.symbol}. Portfolio recalculated.`);
      setDeletingTx(null);
      await fetchAllData();
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to delete transaction. Your portfolio was not changed.';
      showToast('error', detail);
    } finally {
      setIsDeleting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      transaction_type: 'BUY',
      asset_type: 'Stock',
      symbol: '',
      asset_name: '',
      quantity: '1',
      price: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  const totalCalculatedAmount = (parseFloat(formData.quantity) || 0) * (parseFloat(formData.price) || 0);

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ArrowLeftRight className="text-cyan-500 shrink-0" size={28} /> Investment Transactions
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              Record buys, sells, deposits, and withdrawals with atomic portfolio synchronization and cost-basis tracking.
            </p>
          </div>
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <button
              onClick={fetchAllData}
              title="Refresh Transactions & Portfolio"
              className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw size={16} />
            </button>
            <Button onClick={() => openAddModal('BUY')} className="flex items-center justify-center gap-2 text-xs sm:text-sm py-2.5 px-3 sm:px-4 flex-1 sm:flex-none">
              <Plus size={16} /> Record Transaction
            </Button>
          </div>
        </div>

        {msg && (
          <div
            className={`p-4 rounded-xl border text-sm flex items-center gap-2.5 ${
              msg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold'
            }`}
          >
            {msg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {msg.text}
          </div>
        )}

        {/* Transactions Table */}
        <div className="card overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <h3 className="font-bold text-sm sm:text-base text-slate-900 dark:text-slate-100">Transaction History Logs</h3>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {(transactions || []).length} Recorded
              </span>
            </div>
            <span className="text-[11px] sm:text-xs text-slate-500">Chronological Ledger</span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-slate-500 text-sm">Loading transactions & portfolio...</div>
          ) : (transactions || []).length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-slate-600 dark:text-slate-400 text-sm">No transaction records found.</p>
              <Button onClick={() => openAddModal('BUY')} className="text-sm py-2 px-4">
                Record First Transaction
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-sm min-w-[700px]">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800 text-xs">
                  <tr>
                    <th className="p-3 sm:p-4">Symbol / Asset</th>
                    <th className="p-3 sm:p-4">Type</th>
                    <th className="p-3 sm:p-4">Quantity</th>
                    <th className="p-3 sm:p-4">Unit Price</th>
                    <th className="p-3 sm:p-4">Total Amount</th>
                    <th className="p-3 sm:p-4">Date</th>
                    <th className="p-3 sm:p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                  {(transactions || []).map((tx) => {
                    const isBuy = tx.transaction_type === 'BUY' || tx.transaction_type === 'DIVIDEND';
                    return (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="p-3 sm:p-4 font-bold text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-1.5">
                            {tx.symbol}
                          </div>
                          {tx.notes && <div className="text-[11px] text-slate-400 font-normal truncate max-w-xs">{tx.notes}</div>}
                        </td>
                        <td className="p-3 sm:p-4">
                          <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider border flex items-center gap-1 w-fit ${
                            isBuy 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50' 
                              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50'
                          }`}>
                            {isBuy ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {tx.transaction_type === 'DIVIDEND' ? 'DEPOSIT' : tx.transaction_type}
                          </span>
                        </td>
                        <td className="p-3 sm:p-4 font-semibold text-slate-800 dark:text-slate-200">{tx.quantity}</td>
                        <td className="p-3 sm:p-4">{formatCurrency(tx.price, 2)}</td>
                        <td className="p-3 sm:p-4 font-bold text-slate-900 dark:text-slate-100">{formatCurrency(tx.amount)}</td>
                        <td className="p-3 sm:p-4 text-xs font-medium text-slate-600 dark:text-slate-400">{formatDate(tx.transaction_date)}</td>
                        <td className="p-3 sm:p-4 text-right">
                          <button
                            onClick={() => handleDeleteClick(tx)}
                            className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer transition-colors"
                            title="Delete transaction log"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deletingTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="card max-w-md w-full p-4 sm:p-6 space-y-4 sm:space-y-5 relative border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 rounded-3xl max-h-[90vh] overflow-y-auto">
              <button 
                onClick={() => setDeletingTx(null)} 
                className="absolute top-4 right-4 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800/60 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-slate-900 dark:text-slate-100">
                    Confirm Deletion
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    This transaction will be removed and your portfolio holding recalculated.
                  </p>
                </div>
              </div>

              <div className="p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2 sm:space-y-2.5 text-xs sm:text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">Asset / Symbol:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{deletingTx.symbol}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">Transaction Type:</span>
                  <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider border ${
                    deletingTx.transaction_type === 'BUY' || deletingTx.transaction_type === 'DIVIDEND'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                      : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
                  }`}>
                    {deletingTx.transaction_type}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">Quantity:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{deletingTx.quantity}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 dark:text-slate-400 text-xs uppercase font-semibold">Price:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(deletingTx.price, 2)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-700/60 pt-2 font-bold">
                  <span className="text-slate-700 dark:text-slate-300 text-xs uppercase font-semibold">Total Amount:</span>
                  <span className="text-cyan-600 dark:text-cyan-400 text-sm sm:text-base">{formatCurrency(deletingTx.amount)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                  <span className="uppercase font-semibold text-[11px]">Date:</span>
                  <span>{formatDate(deletingTx.transaction_date)}</span>
                </div>
                {deletingTx.notes && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700/60 pt-2">
                    <span className="font-semibold">Notes:</span> {deletingTx.notes}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDeletingTx(null)}
                  disabled={isDeleting}
                  className="text-xs sm:text-sm py-2 px-3 sm:px-4"
                >
                  Cancel
                </Button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="px-3 sm:px-4 py-2 bg-rose-600 hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Trash2 size={15} />
                  {isDeleting ? 'Deleting...' : 'Delete Transaction'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Record Transaction Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="card max-w-lg w-full p-4 sm:p-6 space-y-4 sm:space-y-5 relative border border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-slate-900 rounded-3xl max-h-[90vh] overflow-y-auto">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="absolute top-4 right-4 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>

              <h3 className="font-bold text-lg sm:text-xl text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <PlusCircle size={22} className="text-cyan-500" />
                Record Transaction
              </h3>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                {/* Transaction Type Selector */}
                <div>
                  <label className="block text-xs uppercase font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                    Transaction Type
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { type: 'BUY', label: 'Buy' },
                      { type: 'SELL', label: 'Sell' },
                      { type: 'DIVIDEND', label: 'Deposit' },
                      { type: 'WITHDRAWAL', label: 'Withdrawal' },
                    ].map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        onClick={() => handleTypeChange(item.type)}
                        className={`py-2 px-2 sm:px-3 rounded-xl text-xs font-bold transition-all border text-center ${
                          formData.transaction_type === item.type
                            ? item.type === 'SELL' || item.type === 'WITHDRAWAL'
                              ? 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/20'
                              : 'bg-cyan-600 text-white border-cyan-600 shadow-md shadow-cyan-500/20'
                            : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* SELL FLOW: Load available holdings strictly from user's current portfolio */}
                {formData.transaction_type === 'SELL' ? (
                  <div className="space-y-3">
                    {availableHoldings.length === 0 ? (
                      <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 flex items-start gap-2.5 text-xs">
                        <ShieldAlert size={18} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                        <div>
                          <p className="font-bold">No holdings available to sell</p>
                          <p className="mt-0.5 opacity-90">
                            Your portfolio currently has no active holdings with quantity &gt; 0. You must buy or record holdings before executing a SELL transaction.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                            Asset / Symbol <span className="text-rose-500">*</span>
                          </label>
                          <select
                            required
                            value={formData.symbol}
                            onChange={(e) => handleHoldingSelect(e.target.value)}
                            className={fieldClass}
                          >
                            <option value="">Select from current holdings ▼</option>
                            {availableHoldings.map((h) => (
                              <option key={h.id} value={h.symbol || h.normalized_symbol}>
                                {h.symbol || h.normalized_symbol} {h.asset_name ? `(${h.asset_name})` : ''} — Available Quantity: {h.quantity}
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedHolding && (
                          <div className="p-3 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/50 flex items-center justify-between text-xs">
                            <div className="space-y-0.5">
                              <span className="text-cyan-800 dark:text-cyan-300 font-bold uppercase tracking-wider text-[11px]">
                                Available Quantity
                              </span>
                              <div className="text-base font-extrabold text-cyan-900 dark:text-cyan-200">
                                {selectedHolding.quantity} {selectedHolding.asset_type === 'Stock' ? 'shares' : 'units'}
                              </div>
                            </div>
                            <div className="text-right text-slate-500 dark:text-slate-400">
                              <span className="block text-[11px]">Avg Cost Basis:</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                {formatCurrency(selectedHolding.average_buy_price, 2)}
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  /* BUY / OTHER FLOW */
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Asset Type</label>
                        <select
                          value={formData.asset_type || 'Stock'}
                          onChange={(e) => setFormData({ ...formData, asset_type: e.target.value })}
                          className={fieldClass}
                        >
                          <option value="Stock">Stock</option>
                          <option value="ETF">ETF</option>
                          <option value="Mutual Fund">Mutual Fund</option>
                          <option value="Bond">Bond</option>
                          <option value="Crypto">Crypto</option>
                          <option value="Cash">Cash</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                          Asset / Symbol <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. TCS, INFY, RELIANCE, AAPL"
                          value={formData.symbol}
                          onChange={(e) => {
                            const sym = e.target.value;
                            setFormData({ ...formData, symbol: sym, asset_name: sym });
                          }}
                          className={fieldClass}
                        />
                      </div>
                    </div>

                    {availableHoldings.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Quick select existing:</span>
                        {availableHoldings.slice(0, 4).map((h) => (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => handleHoldingSelect(h.symbol || h.normalized_symbol)}
                            className="text-xs px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 hover:text-cyan-600 transition-colors font-semibold border border-slate-200 dark:border-slate-700"
                          >
                            +{h.symbol || h.normalized_symbol}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Quantity & Unit Price Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      Quantity <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      min="0.0001"
                      max={formData.transaction_type === 'SELL' ? (maxSellQty || undefined) : undefined}
                      placeholder={formData.transaction_type === 'SELL' ? `Max ${maxSellQty || 0}` : 'e.g. 1, 10'}
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      className={`${fieldClass} ${isSellExceeded ? 'border-rose-500 focus:ring-rose-500' : ''}`}
                    />
                    {isSellExceeded && (
                      <p className="text-xs text-rose-500 font-bold mt-1">
                        Maximum available quantity is {Number.isInteger(maxSellQty) ? maxSellQty : maxSellQty.toFixed(2)}.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">
                      {formData.transaction_type === 'SELL' ? 'Sell Price (₹)' : 'Unit Price (₹)'} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      min="0.01"
                      placeholder="₹ Unit Price"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className={fieldClass}
                    />
                  </div>
                </div>

                {/* Real-time Total Calculation */}
                {formData.price && formData.quantity && (
                  <div className="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">Total Amount:</span>
                    <span className="font-extrabold text-sm sm:text-base text-cyan-600 dark:text-cyan-400">
                      {formatCurrency(totalCalculatedAmount)}
                    </span>
                  </div>
                )}

                {/* Date & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className={fieldClass}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">Notes (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Profit booking, SIP"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className={fieldClass}
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="text-xs sm:text-sm py-2 px-3 sm:px-4">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      submitting ||
                      isSellExceeded ||
                      isInvalidQty ||
                      (formData.transaction_type === 'SELL' && availableHoldings.length === 0) ||
                      !formData.symbol
                    }
                    className="text-xs sm:text-sm py-2 px-3 sm:px-4 flex items-center gap-1.5"
                  >
                    {submitting ? 'Recording...' : 'Submit Transaction'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
};

export default TransactionsPage;
