import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api/v1';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Mutex / promise sharing for token refresh to avoid concurrent duplicate calls
let refreshPromise = null;

export const refreshAccessToken = async () => {
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    window.dispatchEvent(new CustomEvent('auth:logout'));
    throw new Error('No refresh token available');
  }

  refreshPromise = (async () => {
    try {
      const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });

      const { access_token, refresh_token: newRefreshToken } = data;
      localStorage.setItem('access_token', access_token);
      if (newRefreshToken) {
        localStorage.setItem('refresh_token', newRefreshToken);
      }

      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

      // Dispatch event to sync AuthContext and NotificationContext SSE stream
      window.dispatchEvent(
        new CustomEvent('auth:token_refreshed', {
          detail: {
            access_token,
            refresh_token: newRefreshToken || refreshToken,
          },
        })
      );

      console.log('[Auth] Token refreshed successfully');
      return access_token;
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        console.warn('[Auth] Refresh token expired or rejected, clearing session.');
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        delete api.defaults.headers.common['Authorization'];

        window.dispatchEvent(new CustomEvent('auth:logout'));
        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      } else {
        console.warn('[Auth] Token refresh network/server error:', err.message);
      }
      throw err;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

// ── Request interceptor: attach access token ────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response interceptor: silent token refresh on 401 ───────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        const newAccessToken = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(original);
      } catch (refreshErr) {
        return Promise.reject(refreshErr);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
