import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api, { onAuthEvent } from '../utils/api';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

function isTokenValid(token) {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch { return false; }
}

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const REMEMBER_KEY = 'rememberMe';
const LOGIN_EMAIL_KEY = 'lastLoginEmail';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [subLoading, setSubLoading] = useState(true);
  const [authReason, setAuthReason] = useState(null); // 'blocked' | 'inactive' | 'subscription_expired' | null

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setSubscription(null);
  }, []);

  // ─── Listen for auth events from api.js (no window.location.href anywhere!) ───
  useEffect(() => {
    return onAuthEvent((e) => {
      const reason = e.detail?.reason;
      if (['unauthorized', 'expired', 'invalid', 'blocked'].includes(reason)) {
        clearSession();
        if (reason === 'blocked') setAuthReason('blocked');
      }
      if (reason === 'subscription_expired') {
        setAuthReason('subscription_expired');
      }
    });
  }, [clearSession]);

  // ─── Restore session on mount ───
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);

    if (token && isTokenValid(token)) {
      if (savedUser) {
        try { setUser(JSON.parse(savedUser)); } catch {}
      }
      api.get('/auth/me')
        .then(res => {
          const userData = res.data.data.user || res.data.data;
          setUser(userData);
          localStorage.setItem(USER_KEY, JSON.stringify(userData));
        })
        .catch(() => { clearSession(); })
        .finally(() => setLoading(false));
    } else {
      if (token) clearSession(); // stale token — clean up silently
      setLoading(false);
      setSubLoading(false);
    }
  }, [clearSession]);

  // ─── Fetch subscription when user changes ───
  const fetchSubscription = useCallback(async () => {
    setSubLoading(true);
    try {
      const res = await api.get('/subscription/current');
      setSubscription(res.data.data);
    } catch {
      setSubscription({ isActive: false, daysLeft: 0 });
    } finally {
      setSubLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchSubscription();
    } else {
      setSubscription(null);
      setSubLoading(false);
    }
  }, [user?._id, fetchSubscription]);

  // ─── Periodic checks: token validity + inactivity (no window.location.href) ───
  useEffect(() => {
    if (!user) return;

    let lastActivity = Date.now();
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 min

    const resetActivity = () => { lastActivity = Date.now(); };
    window.addEventListener('mousemove', resetActivity, { passive: true });
    window.addEventListener('keydown', resetActivity, { passive: true });
    window.addEventListener('touchstart', resetActivity, { passive: true });
    window.addEventListener('scroll', resetActivity, { passive: true });

    const interval = setInterval(() => {
      // Token check
      const token = localStorage.getItem(TOKEN_KEY);
      if (token && !isTokenValid(token)) {
        clearSession();
        setAuthReason('expired');
        return;
      }
      // Inactivity check
      if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
        clearSession();
        setAuthReason('inactive');
        return;
      }
      // Refresh subscription
      fetchSubscription();
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('mousemove', resetActivity);
      window.removeEventListener('keydown', resetActivity);
      window.removeEventListener('touchstart', resetActivity);
      window.removeEventListener('scroll', resetActivity);
    };
  }, [user, clearSession, fetchSubscription]);

  // ─── Session management ───
  const saveSession = (token, userData, rememberEmail) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    if (rememberEmail) {
      localStorage.setItem(REMEMBER_KEY, 'true');
      localStorage.setItem(LOGIN_EMAIL_KEY, userData.email);
    }
    setAuthReason(null); // clear any previous logout reason
    setUser(userData);
  };

  const login = async (email, password, rememberMe = false) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user: userData } = res.data.data;
    saveSession(token, userData, rememberMe);
    return res.data;
  };

  const register = async (data) => {
    const res = await api.post('/auth/register', data);
    const { token, user: userData } = res.data.data;
    saveSession(token, userData, true);
    return res.data;
  };

  const logout = () => {
    const remember = localStorage.getItem(REMEMBER_KEY);
    const email = localStorage.getItem(LOGIN_EMAIL_KEY);
    clearSession();
    setAuthReason(null);
    if (remember) {
      localStorage.setItem(REMEMBER_KEY, 'true');
      localStorage.setItem(LOGIN_EMAIL_KEY, email);
    }
  };

  const getSavedEmail = () => localStorage.getItem(LOGIN_EMAIL_KEY) || '';
  const isRemembered = () => localStorage.getItem(REMEMBER_KEY) === 'true';
  const consumeAuthReason = () => { const r = authReason; setAuthReason(null); return r; };

  const isSubscriptionActive = subscription?.isActive || subscription?.isAdmin || false;

  return (
    <AuthContext.Provider value={{
      user, setUser, login, register, logout, loading,
      subscription, subLoading, isSubscriptionActive, fetchSubscription,
      getSavedEmail, isRemembered,
      authReason, consumeAuthReason,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
