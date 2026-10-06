import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';

export const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleAuthTokens } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const error = searchParams.get('error');
    const errorDesc = searchParams.get('error_description');

    if (error || errorDesc) {
      const displayErr = errorDesc || error || 'Google authentication failed. Please try again.';
      setErrorMessage(displayErr);
      const timer = setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: { message: displayErr },
        });
      }, 2000);
      return () => clearTimeout(timer);
    }

    if (accessToken) {
      let isMounted = true;
      const processTokens = async () => {
        try {
          await handleAuthTokens(accessToken, refreshToken);
          if (isMounted) {
            navigate('/dashboard', { replace: true });
          }
        } catch (err) {
          console.error('[OAuthCallback] Failed to establish session:', err);
          if (isMounted) {
            setErrorMessage('Session establishment failed. Redirecting to login...');
            setTimeout(() => {
              navigate('/login', {
                replace: true,
                state: { message: 'Failed to establish session. Please try again.' },
              });
            }, 1800);
          }
        }
      };

      processTokens();
      return () => {
        isMounted = false;
      };
    } else {
      setErrorMessage('Missing authentication token from server.');
      const timer = setTimeout(() => {
        navigate('/login', {
          replace: true,
          state: { message: 'Google authentication failed. Missing token.' },
        });
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [searchParams, navigate, handleAuthTokens]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-4">
      {errorMessage ? (
        <div className="flex flex-col items-center text-center max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-rose-200 dark:border-rose-900/50">
          <AlertCircle size={44} className="text-rose-500 mb-3 animate-bounce" />
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Authentication Error</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{errorMessage}</p>
          <span className="text-xs text-slate-400">Redirecting to login page...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center text-center">
          <Loader2 size={44} className="animate-spin text-cyan-500 mb-4" />
          <h2 className="text-2xl font-extrabold tracking-tight">Completing authentication...</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2 font-medium">Please wait while we set up your session.</p>
        </div>
      )}
    </div>
  );
};
