import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { OAuthCallback } from './pages/OAuthCallback';
import { Profile } from './pages/Profile';
import { DashboardHome } from './pages/DashboardHome';
import { GoalsPage } from './pages/GoalsPage';
import { PortfolioPage } from './pages/PortfolioPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { MarketPrices } from './pages/MarketPrices';
import { CalculatorsPage } from './pages/CalculatorsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationToastContainer } from './components/common/NotificationToastContainer';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <NotificationProvider>
              <NotificationToastContainer />
              <Routes>
                {/* Public Authentication Entry Routes */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/oauth/callback" element={<OAuthCallback />} />
                
                {/* Protected Application Routes */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/dashboard" element={<DashboardHome />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/goals" element={<GoalsPage />} />
                  <Route path="/portfolio" element={<PortfolioPage />} />
                  <Route path="/calculators" element={<CalculatorsPage />} />
                  <Route path="/transactions" element={<TransactionsPage />} />
                  <Route path="/market" element={<MarketPrices />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                </Route>
              </Routes>
            </NotificationProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}