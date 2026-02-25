import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../utils/api';
import {
  FiHome, FiMenu, FiX, FiLogOut, FiSettings, FiUser, FiBell,
  FiMessageSquare, FiActivity, FiHeart,
  FiBarChart2, FiPackage, FiCreditCard, FiUsers, FiShield, FiSun, FiMoon, FiBriefcase,
  FiCheck, FiAlertTriangle, FiAlertCircle, FiInfo,
} from 'react-icons/fi';
import { FaIndianRupeeSign } from 'react-icons/fa6';
import { GiCow, GiMilkCarton } from 'react-icons/gi';
import { formatDistanceToNow } from 'date-fns';
import ChatBubble from './ChatBubble';
import Paywall from './Paywall';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: FiHome },
  { path: '/cattle', label: 'Cattle', icon: GiCow },
  { path: '/milk', label: 'Milk Records', icon: GiMilkCarton },
  { path: '/health', label: 'Health', icon: FiHeart },
  { path: '/breeding', label: 'Breeding', icon: FiActivity },
  { path: '/feed', label: 'Feed', icon: FiPackage },
  { path: '/finance', label: 'Finance', icon: FaIndianRupeeSign },
  { path: '/milk-delivery', label: 'Dudh Khata', icon: FiUsers },
  { path: '/employees', label: 'Employees', icon: FiBriefcase },
  { path: '/insurance', label: 'Insurance', icon: FiShield },
  { path: '/reports', label: 'Reports', icon: FiBarChart2 },
  { path: '/subscription', label: 'Subscription', icon: FiCreditCard },
  { path: '/chatbot', label: 'Farm Assistant', icon: FiMessageSquare },
];

const adminItems = [
  { path: '/admin', label: 'Admin Panel', icon: FiShield },
];

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef(null);
  const prevUnreadRef = useRef(0);
  const { user, logout } = useAuth();
  const { dark, toggle: toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const showBrowserNotification = (title, body, url) => {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      const notif = new Notification(title, {
        body,
        icon: '/icon-192.png',
        tag: 'dairypro-' + Date.now(),
        vibrate: [200, 100, 200],
      });
      notif.onclick = () => {
        window.focus();
        if (url) navigate(url);
        notif.close();
      };
    }
  };

  // Fetch unread count
  const fetchUnread = async () => {
    try {
      const r = await api.get('/notifications/count');
      const newCount = r.data.data?.unread || 0;
      if (newCount > prevUnreadRef.current && prevUnreadRef.current >= 0) {
        // New notifications arrived — fetch latest to show browser notif
        const latest = await api.get('/notifications', { params: { limit: 1 } });
        const n = latest.data.data?.[0];
        if (n && !n.read) {
          showBrowserNotification(n.title, n.message, n.actionUrl);
        }
      }
      prevUnreadRef.current = newCount;
      setUnreadCount(newCount);
    } catch {}
  };

  // Auto-generate + fetch on mount, then poll every 5 min
  useEffect(() => {
    // Request push notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    api.post('/notifications/generate').catch(() => {});
    fetchUnread();
    const interval = setInterval(() => {
      api.post('/notifications/generate').catch(() => {});
      fetchUnread();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch notifications when panel opens
  useEffect(() => {
    if (notifOpen) {
      api.get('/notifications', { params: { limit: 15 } }).then(r => setNotifications(r.data.data || [])).catch(() => {});
    }
  }, [notifOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = () => {
    api.put('/notifications/read-all').then(() => { setUnreadCount(0); setNotifications(ns => ns.map(n => ({ ...n, read: true }))); }).catch(() => {});
  };

  const markRead = (id) => {
    api.put(`/notifications/${id}/read`).then(() => {
      setUnreadCount(c => Math.max(0, c - 1));
      setNotifications(ns => ns.map(n => n._id === id ? { ...n, read: true } : n));
    }).catch(() => {});
  };

  const severityIcon = { critical: <FiAlertTriangle size={16} className="text-red-500" />, warning: <FiAlertCircle size={16} className="text-orange-500" />, info: <FiInfo size={16} className="text-blue-500" /> };

  const allItems = user?.role === 'admin' ? [...navItems, ...adminItems] : navItems;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200 dark:border-gray-800">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="text-2xl">🐄</span>
            <span className="text-xl font-bold text-emerald-700">DairyPro</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-gray-500">
            <FiX size={20} />
          </button>
        </div>

        <nav className="p-3 space-y-1 overflow-y-auto h-[calc(100vh-8rem)]">
          {allItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <div className="flex items-center gap-3 px-3 py-2">
            {user?.profilePhoto ? (
              <img src={user.profilePhoto} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                <FiUser size={16} className="text-emerald-700" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.role}</p>
            </div>
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-500" title="Logout">
              <FiLogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4 lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-gray-500 dark:text-gray-400">
            <FiMenu size={24} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-1">
            <button onClick={toggleTheme} className="p-2 text-gray-500 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-gray-800 rounded-lg transition-colors" title={dark ? 'Light mode' : 'Dark mode'}>
              {dark ? <FiSun size={20} /> : <FiMoon size={20} />}
            </button>

            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button onClick={() => setNotifOpen(!notifOpen)} className="relative p-2 text-gray-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Notifications" aria-label={`${unreadCount} unread notifications`}>
                <FiBell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {notifOpen && (
                <div className="fixed inset-x-3 top-16 sm:absolute sm:inset-auto sm:right-0 sm:top-12 sm:w-96 max-h-[70vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 animate-modalSlide overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <h3 className="font-bold text-sm dark:text-white">Notifications</h3>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
                          Mark all read
                        </button>
                      )}
                      <button onClick={() => setNotifOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" title="Close">
                        <FiX size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-gray-400 dark:text-gray-600 text-sm">
                        <FiBell size={24} className="mx-auto mb-2 opacity-30" />
                        No notifications yet
                      </div>
                    ) : notifications.map(n => (
                      <div
                        key={n._id}
                        className={`flex gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer ${!n.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                        onClick={() => { markRead(n._id); if (n.actionUrl) { navigate(n.actionUrl); setNotifOpen(false); } }}
                      >
                        <div className="shrink-0 mt-0.5">{severityIcon[n.severity] || severityIcon.info}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold dark:text-white truncate">{n.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.message}</p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-1.5" />}
                      </div>
                    ))}
                    {notifications.length >= 15 && (
                      <button
                        onClick={() => {
                          api.get('/notifications', { params: { limit: 15, skip: notifications.length } })
                            .then(r => {
                              const more = r.data.data || [];
                              if (more.length) setNotifications(prev => [...prev, ...more]);
                            }).catch(() => {});
                        }}
                        className="w-full py-2 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
                      >
                        Load more...
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link to="/chatbot" className="relative p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Farm Assistant">
              <FiMessageSquare size={20} />
            </Link>
            <Link to="/settings" className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors" title="Settings">
              <FiSettings size={20} />
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-6 dark:text-gray-100 max-w-full">
          <div className="page-enter">
            <Paywall>{children}</Paywall>
          </div>
        </main>
      </div>

      {/* Floating Chat Bubble */}
      <ChatBubble />
    </div>
  );
}
