import React from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an uncaught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 font-['Inter',sans-serif]">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-6">
            
            {/* Warning icon */}
            <div className="mx-auto h-16 w-16 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 animate-bounce">
              <AlertCircle size={32} />
            </div>

            {/* Error Message */}
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50">
                Something went wrong
              </h2>
              <p className="text-sm text-slate-650 dark:text-slate-400 leading-relaxed">
                An unexpected error occurred while loading this page. Our team has been notified.
              </p>
              {this.state.error && (
                <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-100 dark:border-rose-900/30 text-xs font-mono text-left text-rose-600 dark:text-rose-400 overflow-x-auto max-h-32">
                  {this.state.error.toString()}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 active:scale-[0.98] text-sm font-semibold text-white flex items-center justify-center gap-2 transition-all duration-200 shadow-md shadow-cyan-500/10"
              >
                <RotateCcw size={16} />
                Try Again
              </button>
              
              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex-1 h-11 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850/80 text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 transition-all duration-200 shadow-sm"
              >
                <Home size={16} />
                Go Home
              </button>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
