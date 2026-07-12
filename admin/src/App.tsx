import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { useAuth } from './auth/auth-context';
import LoginPage from './pages/LoginPage';
import Layout from './components/Layout';
import CouponsPage from './pages/CouponsPage';
import InfluencersPage from './pages/InfluencersPage';
import CouponStatsPage from './pages/CouponStatsPage';

function PrivateRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="boot">Carregando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/cupons" replace />} />
        <Route path="cupons" element={<CouponsPage />} />
        <Route path="cupons/:id" element={<CouponStatsPage />} />
        <Route path="influencers" element={<InfluencersPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
