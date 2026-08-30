import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
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
import { ThemeProvider } from './context/ThemeContext';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', color: '#f87171', backgroundColor: '#0b0f17', minHeight: '100vh' }}>
          <h2>Something went wrong while loading WealthTrack.</h2>
          <p>Check the browser console for the exact error.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/oauth/callback" element={<OAuthCallback />} />
              
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<DashboardHome />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/goals" element={<GoalsPage />} />
                <Route path="/portfolio" element={<PortfolioPage />} />
                <Route path="/calculators" element={<CalculatorsPage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="/market" element={<MarketPrices />} />
              </Route>
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
}