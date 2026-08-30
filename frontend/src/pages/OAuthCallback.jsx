import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');

    if (accessToken && refreshToken) {
      // Successfully authenticated
      login({ access_token: accessToken, refresh_token: refreshToken });
      navigate('/');
    } else {
      // Error or missing tokens
      navigate('/login', { state: { message: 'Google Authentication failed. Please try again.' } });
    }
  }, [searchParams, navigate, login]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Loader2 size={40} className="animate-spin text-cyan-400 mb-4" />
      <h2 className="text-2xl font-bold">Completing authentication...</h2>
      <p className="text-slate-600 dark:text-slate-400 mt-2">Please wait while we log you in.</p>
    </div>
  );
};
