import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

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
  const [subscription, setSubscription] = useState(null); // { isActive, daysLeft, hasPendingPayment, ... }
  const [subLoading, setSubLoading] = useState(true);

  // Restore session
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
      if (token) clearSession();
      setLoading(false);
      setSubLoading(false);
    }
  }, []);

  // Fetch subscription status whenever user changes
  useEffect(() => {
    if (user) {
      fetchSubscription();
    } else {
      setSubscription(null);
      setSubLoading(false);
    }
  }, [user?._id]);

  const fetchSubscription = async () => {
    setSubLoading(true);
    try {
      const res = await api.get('/subscription/current');
      setSubscription(res.data.data);
    } catch {
      setSubscription({ isActive: false, daysLeft: 0 });
    } finally {
      setSubLoading(false);
    }
  };

  // Check token every 5 min
  useEffect(() => {
    const interval = setInterval(() => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token && !isTokenValid(token)) {
        clearSession();
        window.location.href = '/login';
      }
      // Also refresh subscription status
      if (user) fetchSubscription();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setSubscription(null);
  };

  const saveSession = (token, userData, rememberEmail) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    if (rememberEmail) {
      localStorage.setItem(REMEMBER_KEY, 'true');
      localStorage.setItem(LOGIN_EMAIL_KEY, userData.email);
    }
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
    if (remember) {
      localStorage.setItem(REMEMBER_KEY, 'true');
      localStorage.setItem(LOGIN_EMAIL_KEY, email);
    }
  };

  const getSavedEmail = () => localStorage.getItem(LOGIN_EMAIL_KEY) || '';
  const isRemembered = () => localStorage.getItem(REMEMBER_KEY) === 'true';

  // Computed
  const isSubscriptionActive = subscription?.isActive || subscription?.isAdmin || false;

  return (
    <AuthContext.Provider value={{
      user, setUser, login, register, logout, loading,
      subscription, subLoading, isSubscriptionActive, fetchSubscription,
      getSavedEmail, isRemembered,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
