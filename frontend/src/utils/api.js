import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 30000,
});

// ─── Auth event bus ───
// Instead of using window.location.href (which causes full page reloads and
// potential infinite loops), we emit events that AuthContext listens to.
// React's ProtectedRoute component handles the actual redirect via <Navigate>.
const AUTH_EVENT = 'dairypro:auth';
export const onAuthEvent = (callback) => {
  window.addEventListener(AUTH_EVENT, callback);
  return () => window.removeEventListener(AUTH_EVENT, callback);
};
function emitAuthEvent(reason) {
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { reason } }));
}

// ─── Request deduplication for GET requests ───
const pendingRequests = new Map();

function getRequestKey(config) {
  if (config.method !== 'get') return null;
  return `${config.method}:${config.baseURL}${config.url}:${JSON.stringify(config.params || {})}`;
}

// Track if we already emitted a logout to prevent multiple events per cycle
let logoutEmitted = false;

function clearTokens() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    // Check if token is expired before even making the request
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) {
        clearTokens();
        if (!logoutEmitted) { logoutEmitted = true; emitAuthEvent('expired'); }
        return Promise.reject(new Error('Token expired'));
      }
    } catch {
      clearTokens();
      if (!logoutEmitted) { logoutEmitted = true; emitAuthEvent('invalid'); }
      return Promise.reject(new Error('Invalid token'));
    }
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Deduplicate concurrent identical GET requests
  const key = getRequestKey(config);
  if (key && pendingRequests.has(key)) {
    const controller = new AbortController();
    config.signal = controller.signal;
    controller.abort('Duplicate request cancelled');
    return config;
  }
  if (key) {
    pendingRequests.set(key, true);
    config._dedupeKey = key;
  }

  return config;
});

api.interceptors.response.use(
  (res) => {
    if (res.config._dedupeKey) pendingRequests.delete(res.config._dedupeKey);
    logoutEmitted = false; // Reset on successful response
    return res;
  },
  (error) => {
    if (error.config?._dedupeKey) pendingRequests.delete(error.config._dedupeKey);

    if (error.response?.status === 401) {
      clearTokens();
      if (!logoutEmitted) { logoutEmitted = true; emitAuthEvent('unauthorized'); }
    }

    // Blocked account
    if (error.response?.status === 403 && error.response?.data?.code === 'ACCOUNT_BLOCKED') {
      clearTokens();
      if (!logoutEmitted) { logoutEmitted = true; emitAuthEvent('blocked'); }
    }

    // Subscription expired
    if (error.response?.status === 403 && error.response?.data?.code === 'SUBSCRIPTION_EXPIRED') {
      emitAuthEvent('subscription_expired');
    }

    // Network error
    if (!error.response && error.message !== 'canceled') {
      error.userMessage = 'Network error. Please check your internet connection.';
    }

    return Promise.reject(error);
  }
);

export default api;
