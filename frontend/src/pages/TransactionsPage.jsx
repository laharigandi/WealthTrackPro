import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, Plus, CheckCircle2, AlertCircle, RefreshCw, X, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import { getTransactions, createTransaction } from '../services/transactionService';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Button } from '../components/common/Button';
import { PageTransition } from '../components/common/PageTransition';

export const TransactionsPage = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    symbol: '',
    asset_name: '',
    asset_type: 'Stock',
    transaction_type: 'BUY',
    quantity: '',
    price: '',
    notes: '',
  });

  const showToast = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  };

  const fetchTxData = async () => {
    try {
      setLoading(true);
      const data = await getTransactions();
      setTransactions(data);
    } catch {
      showToast('error', 'Failed to fetch transaction logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTxData();
  }, []);

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      await createTransaction({
        symbol: formData.symbol.toUpperCase(),
        asset_name: formData.asset_name,
        asset_type: formData.asset_type,
        transaction_type: formData.transaction_type,
        quantity: parseFloat(formData.quantity),
        price: parseFloat(formData.price),
        notes: formData.notes || null,
      });

      showToast('success', `Recorded ${formData.transaction_type} transaction for ${formData.symbol.toUpperCase()}! Portfolio updated.`);
      setShowModal(false);
      resetForm();
      fetchTxData();
    } catch (err) {
      const detail = err.response?.data?.detail || 'Failed to record transaction.';
      showToast('error', detail);
    }
  };

  const resetForm = () => {
    setFormData({
      symbol: '',
      asset_name: '',
      asset_type: 'Stock',
      transaction_type: 'BUY',
      quantity: '',
      price: '',
      notes: '',
    });
  };

  return (
    <PageTransition>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <ArrowLeftRight className="text-brand-400" size={24} /> Investment Transactions
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Record buys, sells, dividends, and withdrawals with automatic portfolio sync.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchTxData}
            title="Refresh Transactions"
            className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 transition-colors"
          >
            <RefreshCw size={16} />
          </button>
          <Button onClick={() => setShowModal(true)} className="flex items-center gap-2 text-sm py-2.5 px-4">
            <Plus size={16} /> Record Transaction
          </Button>
        </div>
      </div>

      {msg && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center gap-2.5 ${
            msg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          {msg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {msg.text}
        </div>
      )}

      {/* Transactions Table */}
      <div className="card overflow-hidden">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">Transaction History Logs</h3>
          <span className="text-sm text-slate-500">{transactions.length} Total</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500 text-sm">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-slate-600 dark:text-slate-400 text-sm">No transaction records found.</p>
            <Button onClick={() => setShowModal(true)} className="text-sm py-2 px-4">
              Record First Transaction
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 uppercase font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="p-4">Symbol</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Quantity</th>
                  <th className="p-4">Price</th>
                  <th className="p-4">Total Amount</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                {transactions.map((tx) => {
                  const isBuy = tx.transaction_type === 'BUY';
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{tx.symbol}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider border ${
                          isBuy 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50' 
                            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50'
                        }`}>
                          {tx.transaction_type}
                        </span>
                      </td>
                      <td className="p-4 font-semibold text-slate-800 dark:text-slate-200">{tx.quantity}</td>
                      <td className="p-4">{formatCurrency(tx.price, 2)}</td>
                      <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{formatCurrency(tx.total_amount)}</td>
                      <td className="p-4 text-xs font-medium text-slate-600 dark:text-slate-400">{tx.transaction_date}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleDelete(tx.id, tx.symbol)}
                          className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer"
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

      {/* Add Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="card max-w-md w-full p-6 space-y-5 relative border-slate-300 dark:border-slate-700 shadow-2xl bg-white dark:bg-slate-900">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"><X size={20} /></button>
            <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <PlusCircle size={20} className="text-cyan-600 dark:text-cyan-400" />
              Log New Transaction
            </h3>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Transaction Type</label>
                  <select
                    value={formData.transaction_type}
                    onChange={(e) => setFormData({ ...formData, transaction_type: e.target.value })}
                    className={fieldClass}
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                    <option value="DIVIDEND">DIVIDEND</option>
                    <option value="WITHDRAWAL">WITHDRAWAL</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Ticker Symbol</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. TCS"
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Asset Name</label>
                <input
                  type="text"
                  placeholder="e.g. Tata Consultancy Services"
                  value={formData.asset_name}
                  onChange={(e) => setFormData({ ...formData, asset_name: e.target.value })}
                  className={fieldClass}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Quantity</label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.001"
                    placeholder="10"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className={fieldClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Price Per Unit (₹)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0"
                    placeholder="4320"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className={fieldClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Monthly SIP execution"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className={fieldClass}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)} className="text-sm py-2 px-4">
                  Cancel
                </Button>
                <Button type="submit" className="text-sm py-2 px-4">
                  Submit Transaction
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
