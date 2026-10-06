import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import axios from 'axios';
import { getProfile } from '../services/userService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    try {
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(localStorage.getItem('access_token') || null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
    setToken(null);
    delete axios.defaults.headers.common['Authorization'];
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const data = await getProfile();
      setUser(data);
      localStorage.setItem('user', JSON.stringify(data));
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) {
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + storedToken;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  useEffect(() => {
    const handleTokenRefreshed = (e) => {
      const newToken = e.detail?.access_token;
      if (newToken) {
        setToken(newToken);
        axios.defaults.headers.common['Authorization'] = 'Bearer ' + newToken;
      }
    };

    const handleAuthLogout = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth:token_refreshed', handleTokenRefreshed);
    window.addEventListener('auth:logout', handleAuthLogout);

    return () => {
      window.removeEventListener('auth:token_refreshed', handleTokenRefreshed);
      window.removeEventListener('auth:logout', handleAuthLogout);
    };
  }, []);

  const handleAuthTokens = useCallback(async (accessToken, refreshToken = null, initialUserData = null) => {
    localStorage.setItem('access_token', accessToken);
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    }
    setToken(accessToken);
    axios.defaults.headers.common['Authorization'] = 'Bearer ' + accessToken;

    let userData = initialUserData;
    if (!userData) {
      try {
        userData = await getProfile();
      } catch (err) {
        console.warn('Could not load profile immediately after token save:', err);
      }
    }

    if (userData) {
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    }

    window.dispatchEvent(
      new CustomEvent('auth:token_refreshed', {
        detail: { access_token: accessToken, refresh_token: refreshToken },
      })
    );

    return { access_token: accessToken, refresh_token: refreshToken, user: userData };
  }, []);

  const login = async (emailOrTokens, password) => {
    // If called with a token object { access_token, refresh_token, user }
    if (typeof emailOrTokens === 'object' && emailOrTokens !== null && emailOrTokens.access_token) {
      return await handleAuthTokens(
        emailOrTokens.access_token,
        emailOrTokens.refresh_token,
        emailOrTokens.user
      );
    }

    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/v1';
    const response = await axios.post(`${BASE_URL}/auth/login`, { email: emailOrTokens, password });
    const { access_token, refresh_token, user: userData } = response.data;
    await handleAuthTokens(access_token, refresh_token, userData);
    return response.data;
  };

  const loginWithGoogle = async (credential) => {
    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/v1';
    const response = await axios.post(`${BASE_URL}/auth/google`, { credential });
    const { access_token, refresh_token, user: userData } = response.data;
    await handleAuthTokens(access_token, refresh_token, userData);
    return response.data;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        token,
        setToken,
        loading,
        login,
        loginWithTokens: handleAuthTokens,
        handleAuthTokens,
        loginWithGoogle,
        logout,
        fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

