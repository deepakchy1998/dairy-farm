import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, authReason } = useAuth();
  const location = useLocation();

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
    </div>
  );

  // Not logged in → go to login (React Navigate, no page reload)
  if (!user) return <Navigate to="/login" replace />;

  // Admin check
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;

  // Subscription expired → redirect to subscription page (unless already there)
  if (authReason === 'subscription_expired' && !['/subscription', '/settings'].includes(location.pathname)) {
    return <Navigate to="/subscription" replace />;
  }

  return children;
}
