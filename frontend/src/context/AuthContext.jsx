import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Token expiry check
function isTokenValid(token) {
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 > Date.now();
  } catch { return false; }
}

// Session storage keys
const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const REMEMBER_KEY = 'rememberMe';
const LOGIN_EMAIL_KEY = 'lastLoginEmail';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check and restore session on mount
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);

    if (token && isTokenValid(token)) {
      // Try to use cached user first for instant load
      if (savedUser) {
        try { setUser(JSON.parse(savedUser)); } catch {}
      }
      // Then verify with server
      api.get('/auth/me')
        .then(res => {
          const userData = res.data.data.user || res.data.data;
          setUser(userData);
          localStorage.setItem(USER_KEY, JSON.stringify(userData));
        })
        .catch(() => { clearSession(); })
        .finally(() => setLoading(false));
    } else {
      if (token) clearSession(); // expired token cleanup
      setLoading(false);
    }
  }, []);

  // Auto-refresh: check token every 5 min
  useEffect(() => {
    const interval = setInterval(() => {
      const token = localStorage.getItem(TOKEN_KEY);
      if (token && !isTokenValid(token)) {
        clearSession();
        window.location.href = '/login';
      }
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
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

  const googleLogin = async (credential) => {
    const res = await api.post('/auth/google', { credential });
    const { token, user: userData } = res.data.data;
    saveSession(token, userData, true);
    return res.data;
  };

  const logout = () => {
    const remember = localStorage.getItem(REMEMBER_KEY);
    const email = localStorage.getItem(LOGIN_EMAIL_KEY);
    clearSession();
    // Keep remembered email
    if (remember) {
      localStorage.setItem(REMEMBER_KEY, 'true');
      localStorage.setItem(LOGIN_EMAIL_KEY, email);
    }
  };

  // Helpers for remember me
  const getSavedEmail = () => localStorage.getItem(LOGIN_EMAIL_KEY) || '';
  const isRemembered = () => localStorage.getItem(REMEMBER_KEY) === 'true';

  return (
    <AuthContext.Provider value={{
      user, setUser, login, register, googleLogin, logout, loading,
      getSavedEmail, isRemembered,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
