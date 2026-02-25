import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 30000,
});

// ─── Request deduplication for GET requests ───
const pendingRequests = new Map();

function getRequestKey(config) {
  if (config.method !== 'get') return null;
  return `${config.method}:${config.baseURL}${config.url}:${JSON.stringify(config.params || {})}`;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    // Check if token is expired
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(new Error('Token expired'));
      }
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
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
    // Clean up dedup tracking
    if (res.config._dedupeKey) pendingRequests.delete(res.config._dedupeKey);
    return res;
  },
  (error) => {
    // Clean up dedup tracking
    if (error.config?._dedupeKey) pendingRequests.delete(error.config._dedupeKey);

    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    // Subscription expired — redirect to subscription page
    if (error.response?.status === 403 && error.response?.data?.code === 'SUBSCRIPTION_EXPIRED') {
      // Don't redirect if already on subscription/settings/payment page
      const path = window.location.pathname;
      if (!['/subscription', '/settings', '/payment'].some(p => path.startsWith(p))) {
        window.location.href = '/subscription';
      }
    }
    // Network error — provide a user-friendly message
    if (!error.response && error.message !== 'canceled') {
      error.userMessage = 'Network error. Please check your internet connection.';
    }
    return Promise.reject(error);
  }
);

export default api;
