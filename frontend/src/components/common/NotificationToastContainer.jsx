import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, AlertTriangle, Target, Shield, Bell, Sparkles } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

const getToastIcon = (type) => {
  switch (type) {
    case 'goal_completed':
      return CheckCircle2;
    case 'goal_milestone':
      return Target;
    case 'portfolio_risk':
    case 'kyc_alert':
    case 'portfolio_pnl':
      return AlertTriangle;
    case 'security':
      return Shield;
    case 'portfolio_milestone':
      return Sparkles;
    default:
      return Bell;
  }
};

const getSeverityTheme = (severity) => {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-red-950/95 border-red-500/80 text-white shadow-red-950/50',
        iconBg: 'bg-red-500/20 text-red-400 border border-red-500/30',
        badge: 'bg-red-500 text-white',
        title: 'text-red-300 font-bold',
        msg: 'text-red-100',
      };
    case 'warning':
      return {
        bg: 'bg-amber-950/95 border-amber-500/80 text-white shadow-amber-950/50',
        iconBg: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
        badge: 'bg-amber-500 text-slate-950',
        title: 'text-amber-300 font-bold',
        msg: 'text-amber-100',
      };
    case 'success':
      return {
        bg: 'bg-emerald-950/95 border-emerald-500/80 text-white shadow-emerald-950/50',
        iconBg: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
        badge: 'bg-emerald-500 text-white',
        title: 'text-emerald-300 font-bold',
        msg: 'text-emerald-100',
      };
    default:
      return {
        bg: 'bg-slate-900/95 border-cyan-500/70 text-white shadow-slate-950/60',
        iconBg: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
        badge: 'bg-cyan-500 text-slate-950',
        title: 'text-cyan-300 font-bold',
        msg: 'text-slate-200',
      };
  }
};

export const NotificationToastContainer = () => {
  const { toasts, dismissToast, markAsRead } = useNotifications();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-2 sm:px-0">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = getToastIcon(toast.type);
          const theme = getSeverityTheme(toast.severity);

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.9 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className={`pointer-events-auto p-3.5 rounded-2xl backdrop-blur-xl border shadow-2xl flex items-start gap-3 relative overflow-hidden group ${theme.bg}`}
            >
              {/* Pulsing indicator */}
              <div className="absolute top-0 left-0 bottom-0 w-1 bg-current opacity-80" />

              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${theme.iconBg}`}>
                <Icon size={18} />
              </div>

              <div className="flex-1 min-w-0 pr-6">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-white/10 text-white/90">
                    Live Alert
                  </span>
                  <h4 className={`text-xs truncate ${theme.title}`}>{toast.title}</h4>
                </div>
                <p className={`text-xs font-medium leading-relaxed line-clamp-2 ${theme.msg}`}>
                  {toast.message}
                </p>
              </div>

              <button
                onClick={() => {
                  if (toast.notificationId) {
                    markAsRead(toast.notificationId);
                  }
                  dismissToast(toast.id);
                }}
                className="absolute top-2.5 right-2.5 p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Dismiss alert"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
