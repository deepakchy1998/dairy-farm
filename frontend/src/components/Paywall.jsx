import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { FiLock, FiCreditCard, FiSettings, FiLogOut, FiClock } from 'react-icons/fi';

// Pages that are accessible even when subscription expired
const ALLOWED_PATHS = ['/subscription', '/settings', '/admin'];

// Double-check: the real enforcement is on the backend (403 SUBSCRIPTION_EXPIRED).
// This paywall is UX-only — even if someone bypasses it, the API blocks all data access.

export default function Paywall({ children }) {
  const { user, subscription, subLoading, isSubscriptionActive, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Admin always passes
  if (user?.role === 'admin') return children;

  // Still loading subscription status
  if (subLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Subscription is active — allow access
  if (isSubscriptionActive) {
    // Show warning if expiring soon (3 days or less)
    if (subscription?.daysLeft <= 3 && subscription?.daysLeft > 0 && !ALLOWED_PATHS.some(p => location.pathname.startsWith(p))) {
      return (
        <>
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <FiClock size={16} />
              <span className="text-sm font-medium">
                Your plan expires in <strong>{subscription.daysLeft} day{subscription.daysLeft > 1 ? 's' : ''}</strong>.
              </span>
            </div>
            <button onClick={() => navigate('/subscription')} className="text-xs bg-amber-600 text-white px-3 py-1 rounded-lg hover:bg-amber-700 transition">
              Renew Now
            </button>
          </div>
          {children}
        </>
      );
    }
    return children;
  }

  // Subscription expired — check if current page is allowed
  if (ALLOWED_PATHS.some(p => location.pathname.startsWith(p))) {
    return children;
  }

  // BLOCKED — show paywall
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-red-100 dark:border-red-900/30 p-8">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiLock className="text-red-500" size={28} />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {subscription?.subscription ? 'Plan Expired' : 'Free Trial Ended'}
          </h2>

          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {subscription?.subscription
              ? 'Your subscription plan has expired. Please renew to continue accessing your farm data.'
              : 'Your 5-day free trial has ended. Subscribe to a plan to continue using DairyPro.'
            }
          </p>

          <div className="space-y-3">
            <button
              onClick={() => navigate('/subscription')}
              className="w-full btn-primary flex items-center justify-center gap-2 py-3 text-base"
            >
              <FiCreditCard size={18} />
              Choose a Plan
            </button>

            <div className="flex gap-3">
              <button onClick={() => navigate('/settings')} className="flex-1 btn-secondary flex items-center justify-center gap-2">
                <FiSettings size={16} /> Settings
              </button>
              <button onClick={() => { logout(); navigate('/login'); }} className="flex-1 btn-danger flex items-center justify-center gap-2">
                <FiLogOut size={16} /> Logout
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-400 dark:text-gray-600 mt-4">
          Need help? Contact support from the Settings page.
        </p>
      </div>
    </div>
  );
}
