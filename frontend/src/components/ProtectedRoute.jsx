import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAppConfig } from '../context/AppConfigContext';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, authReason } = useAuth();
  const appConfig = useAppConfig();
  const maintenanceMode = appConfig.maintenanceMode;
  const maintenanceMessage = appConfig.maintenanceMessage;
  const configLoaded = appConfig.loaded;
  const location = useLocation();

  if (loading || !configLoaded) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
    </div>
  );

  // Not logged in → go to login (React Navigate, no page reload)
  if (!user) return <Navigate to="/login" replace />;

  // Admin check
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;

  // Maintenance mode — block non-admin users (admins see a banner instead)
  if (maintenanceMode && user.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950 p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🚧</div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Under Maintenance</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {maintenanceMessage || 'The app is currently under maintenance. Please try again later.'}
          </p>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              We're working on improving the app. This won't take long — please check back soon!
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Subscription expired → redirect to subscription page (unless already there)
  if (authReason === 'subscription_expired' && !['/subscription', '/settings'].includes(location.pathname)) {
    return <Navigate to="/subscription" replace />;
  }

  return children;
}
