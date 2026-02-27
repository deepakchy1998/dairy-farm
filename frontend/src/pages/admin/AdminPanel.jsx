import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate, formatCurrency } from '../../utils/helpers';
import Modal from '../../components/Modal';
import DataTable from '../../components/DataTable';
import ConfirmDialog from '../../components/ConfirmDialog';
import Pagination from '../../components/Pagination';
import toast from 'react-hot-toast';
import {
  FiUsers, FiHome, FiCreditCard, FiCheck, FiX, FiShield,
  FiPlus, FiTrash2, FiSearch, FiEye, FiArrowLeft, FiAlertTriangle,
  FiRefreshCw, FiDownload, FiServer, FiLock, FiUnlock, FiKey, FiActivity,
  FiMail, FiSend, FiLogIn, FiMessageSquare, FiEdit2,
} from 'react-icons/fi';
import { FaIndianRupeeSign } from 'react-icons/fa6';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area, LineChart, Line, Legend } from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminPanel() {
  const [tab, setTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [settings, setSettings] = useState({}); // kept for website tab
  const [loading, setLoading] = useState(true);

  const [websiteForm, setWebsiteForm] = useState({});
  const [websiteSubTab, setWebsiteSubTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPagination, setUsersPagination] = useState({});
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsPagination, setPaymentsPagination] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger', confirmText: 'Confirm' });

  // App Config management
  const [appConfig, setAppConfig] = useState(null);
  const [appConfigForm, setAppConfigForm] = useState({});
  const [savingConfig, setSavingConfig] = useState(false);

  // Plans management
  const [adminPlans, setAdminPlans] = useState([]);
  const [planModal, setPlanModal] = useState(false);
  const [planForm, setPlanForm] = useState({ name: '', label: '', price: '', days: '', period: '', features: 'All features included\nUnlimited cattle & records\nAI Farm Assistant\nReports & Analytics', isPopular: false, isActive: true, sortOrder: 0 });
  const [editPlanId, setEditPlanId] = useState(null);
  const [savingPlan, setSavingPlan] = useState(false);

  // New features
  const [searchQuery, setSearchQuery] = useState('');
  const [userStatusFilter, setUserStatusFilter] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
  const [userDetail, setUserDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [screenshotModal, setScreenshotModal] = useState(null);
  const [grantModal, setGrantModal] = useState(false);
  const [grantForm, setGrantForm] = useState({ plan: 'monthly', days: 30 });
  const [userOverridesForm, setUserOverridesForm] = useState({});
  const [savingOverrides, setSavingOverrides] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);

  // Support messages
  const [supportMessages, setSupportMessages] = useState([]);
  const [supportPagination, setSupportPagination] = useState({});
  const [supportPage, setSupportPage] = useState(1);
  const [supportStatusFilter, setSupportStatusFilter] = useState('');
  const [supportReplyModal, setSupportReplyModal] = useState(null);
  const [supportReplyText, setSupportReplyText] = useState('');

  // Broadcast
  const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '', severity: 'info' });
  const [broadcastSending, setBroadcastSending] = useState(false);

  // Farm data preview
  const [farmDataPreview, setFarmDataPreview] = useState(null);
  const [farmDataLoading, setFarmDataLoading] = useState(false);

  // ─── LOAD DATA ───
  const loadTab = async () => {
    setLoading(true);
    try {
      // Load dashboard only if not cached or on overview tab
      if (!dashboard || tab === 'overview') {
        api.get('/admin/revenue-dashboard').then(r => setDashboard(r.data.data)).catch(() => {});
      }

      // Load tab-specific data
      if (tab === 'users') {
        const r = await api.get('/admin/users', { params: { page: usersPage, limit: 20, search: searchQuery || undefined, status: userStatusFilter || undefined } });
        setUsers(r.data.data); setUsersPagination(r.data.pagination || {});
      }
      if (tab === 'payments') {
        const r = await api.get('/admin/payments', { params: { page: paymentsPage, limit: 20, status: paymentStatusFilter || undefined } });
        setPayments(r.data.data); setPaymentsPagination(r.data.pagination || {});
      }
      if (tab === 'website') {
        const [settingsRes, landingRes] = await Promise.all([
          api.get('/admin/settings'),
          api.get('/admin/landing'),
        ]);
        const merged = { ...settingsRes.data.data, ...landingRes.data.data };
        setSettings(merged); setWebsiteForm(merged);
      }
      if (tab === 'app-config') {
        const r = await api.get('/app-config');
        setAppConfig(r.data.data); setAppConfigForm(r.data.data);
      }
      if (tab === 'plans') {
        const [r, cfgRes] = await Promise.all([
          api.get('/admin/plans'),
          api.get('/app-config').catch(() => ({ data: { data: {} } })),
        ]);
        setAdminPlans(r.data.data);
        setAppConfigForm(prev => ({ ...prev, ...cfgRes.data.data }));
      }
      if (tab === 'logs') {
        const r = await api.get('/admin/audit-logs');
        setAuditLogs(r.data.data);
      }
      if (tab === 'support') {
        const r = await api.get('/admin/contact-messages', { params: { page: supportPage, limit: 20, status: supportStatusFilter || undefined } });
        setSupportMessages(r.data.data); setSupportPagination(r.data.pagination || {});
      }
      if (tab === 'system') {
        const r = await api.get('/admin/system-health');
        setSystemHealth(r.data.data);
      }
    } catch (err) {
      toast.error('Failed to load. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTab(); }, [tab, usersPage, paymentsPage, paymentStatusFilter, supportPage, supportStatusFilter]);

  // Search users with debounce
  useEffect(() => {
    if (tab !== 'users') return;
    const t = setTimeout(() => { setUsersPage(1); loadTab(); }, 400);
    return () => clearTimeout(t);
  }, [searchQuery, userStatusFilter]);

  // ─── USER ACTIONS ───
  const viewUserDetail = async (userId) => {
    setDetailLoading(true);
    try {
      const [res, plansRes] = await Promise.all([
        api.get(`/admin/users/${userId}/detail`),
        adminPlans.length ? null : api.get('/admin/plans'),
      ]);
      setUserDetail(res.data.data);
      if (plansRes) setAdminPlans(plansRes.data.data);
      // Load overrides separately so it doesn't block the detail view
      try {
        const overridesRes = await api.get(`/admin/users/${userId}/overrides`);
        setUserOverridesForm(overridesRes.data.data || {});
      } catch {
        // Fallback: read from user object
        const u = res.data.data?.user;
        setUserOverridesForm({
          chatBubbleEnabled: u?.chatBubbleEnabled !== false,
          farmEnabled: u?.farmEnabled !== false,
          modulesEnabled: u?.userOverrides?.modulesEnabled || {},
          maxCattle: u?.userOverrides?.maxCattle || null,
          maxEmployees: u?.userOverrides?.maxEmployees || null,
          maxCustomers: u?.userOverrides?.maxCustomers || null,
          customNotes: u?.userOverrides?.customNotes || '',
        });
      }
    } catch { toast.error('Failed to load user details'); }
    finally { setDetailLoading(false); }
  };

  const saveUserOverrides = async () => {
    if (!userDetail?.user?._id) return;
    setSavingOverrides(true);
    try {
      await api.put(`/admin/users/${userDetail.user._id}/overrides`, userOverridesForm);
      toast.success('User settings saved!');
      viewUserDetail(userDetail.user._id);
    } catch { toast.error('Failed to save user settings'); }
    finally { setSavingOverrides(false); }
  };

  const toggleBlock = async (userId, isBlocked) => {
    try {
      await api.put(`/admin/users/${userId}/${isBlocked ? 'unblock' : 'block'}`);
      toast.success(`User ${isBlocked ? 'unblocked' : 'blocked'}`);
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, isBlocked: !isBlocked } : u));
      if (userDetail?.user?._id === userId) setUserDetail(prev => ({ ...prev, user: { ...prev.user, isBlocked: !isBlocked } }));
    } catch { toast.error('Failed'); }
  };

  const forcePasswordReset = async (userId) => {
    try {
      const res = await api.post(`/admin/users/${userId}/force-reset`);
      toast.success(`New password: ${res.data.tempPassword}`, { duration: 15000 });
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const deleteUser = async (userId, userName) => {
    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success(`User "${userName}" deleted`);
      setUserDetail(null);
      loadTab();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const grantSubscription = async () => {
    if (!userDetail) return;
    try {
      const res = await api.post('/admin/subscription/grant', { userId: userDetail.user._id, plan: grantForm.plan, days: grantForm.days });
      toast.success(res.data.message);
      setGrantModal(false);
      viewUserDetail(userDetail.user._id);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const revokeSubscription = async (userId) => {
    try {
      await api.post('/admin/subscription/revoke', { userId });
      toast.success('Subscription revoked');
      if (userDetail?.user?._id === userId) viewUserDetail(userId);
    } catch { toast.error('Failed'); }
  };

  const changeRole = async (userId, newRole) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role: newRole });
      toast.success(`Role changed to ${newRole}`);
      if (userDetail?.user?._id === userId) viewUserDetail(userId);
      loadTab();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  // ─── PAYMENT ACTIONS ───
  const verifyPayment = async (id) => {
    try {
      await api.put(`/admin/payments/${id}/verify`);
      toast.success('Payment verified & subscription activated!');
      setPayments(prev => prev.map(p => p._id === id ? { ...p, status: 'verified' } : p));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const rejectPayment = async (id) => {
    const note = prompt('Rejection reason (optional):');
    try {
      await api.put(`/admin/payments/${id}/reject`, { adminNote: note });
      toast.success('Payment rejected');
      setPayments(prev => prev.map(p => p._id === id ? { ...p, status: 'rejected' } : p));
    } catch { toast.error('Failed'); }
  };

  const viewScreenshot = async (paymentId) => {
    try {
      const res = await api.get(`/admin/payments/${paymentId}/screenshot`);
      setScreenshotModal(res.data.data.screenshot);
    } catch { toast.error('No screenshot available'); }
  };



  if (loading && !dashboard) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>;

  // ═══════════════════════════════════════
  //  USER DETAIL VIEW
  // ═══════════════════════════════════════
  if (userDetail) {
    const u = userDetail.user;
    const sub = userDetail.subscription?.current;
    return (
      <div className="space-y-4 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => setUserDetail(null)} className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"><FiArrowLeft size={20} /></button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{u.name}</h1>
            <p className="text-gray-500 text-sm">{u.email} · {u.phone || 'No phone'}</p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${u.isBlocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {u.isBlocked ? '🚫 Blocked' : '✅ Active'}
          </span>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-blue-500">Cattle</p>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{userDetail.farmStats.cattle}</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-500">Milk Records</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{userDetail.farmStats.milkRecords}</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-purple-500">Employees</p>
            <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{userDetail.farmStats.employees}</p>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-amber-500">Customers</p>
            <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{userDetail.farmStats.customers}</p>
          </div>
        </div>

        {/* User Info */}
        <div className="card">
          <h3 className="font-semibold text-sm mb-3">👤 Account Details</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-400">Role:</span> <strong className="capitalize">{u.role}</strong></div>
            <div><span className="text-gray-400">Joined:</span> <strong>{formatDate(u.createdAt)}</strong></div>
            <div><span className="text-gray-400">Last Login:</span> <strong>{u.lastLogin ? formatDate(u.lastLogin) : 'Never'}</strong></div>
            <div><span className="text-gray-400">Registration IP:</span> <strong className="font-mono text-xs">{u.registrationIP || '-'}</strong></div>
            <div><span className="text-gray-400">Farm:</span> <strong>{u.farmId?.name || '-'}</strong></div>
            <div><span className="text-gray-400">Login Attempts:</span> <strong>{u.loginAttempts || 0}</strong></div>
          </div>
        </div>

        {/* Subscription */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">📋 Subscription</h3>
            <div className="flex gap-2">
              <button onClick={() => { setGrantForm({ plan: 'monthly', days: 30 }); setGrantModal(true); }} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg hover:bg-emerald-200"><FiPlus size={12} className="inline mr-1" /> Grant</button>
              {sub && <button onClick={() => setConfirmDialog({ open: true, title: 'Revoke Subscription?', message: 'This will immediately deactivate the subscription.', variant: 'danger', confirmText: 'Revoke', onConfirm: () => revokeSubscription(u._id) })} className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-lg hover:bg-red-200">Revoke</button>}
            </div>
          </div>
          {sub ? (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
              <p className="text-sm"><strong className="capitalize">{sub.plan}</strong> plan · Active until <strong>{formatDate(sub.endDate)}</strong></p>
              <p className="text-xs text-gray-500 mt-1">{Math.ceil((new Date(sub.endDate) - new Date()) / 86400000)} days remaining</p>
            </div>
          ) : (
            <p className="text-sm text-red-500">❌ No active subscription</p>
          )}
          {userDetail.subscription.history?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-400 mb-1">History:</p>
              <div className="space-y-1">
                {userDetail.subscription.history.map((s, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-1.5">
                    <span className="capitalize font-medium">{s.plan}</span>
                    <span>{formatDate(s.startDate)} → {formatDate(s.endDate)}</span>
                    <span className={s.isActive && new Date(s.endDate) >= new Date() ? 'text-emerald-600' : 'text-gray-400'}>{s.isActive && new Date(s.endDate) >= new Date() ? 'Active' : 'Expired'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Payments */}
        {userDetail.payments?.length > 0 && (
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b dark:border-gray-800"><h3 className="font-semibold text-sm">💳 Payments</h3></div>
            <div className="divide-y dark:divide-gray-800">
              {userDetail.payments.map(p => (
                <div key={p._id} className="px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="capitalize font-medium text-sm">{p.plan}</span>
                      <span className="font-semibold text-sm">{formatCurrency(p.amount)}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${p.status === 'verified' ? 'bg-green-100 text-green-700' : p.status === 'rejected' ? 'bg-red-100 text-red-700' : p.status === 'expired' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700'}`}>{p.status}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span className="font-mono">{p.upiTransactionId}</span>
                    <div className="flex items-center gap-2">
                      {p.screenshot && <button onClick={() => viewScreenshot(p._id)} className="text-blue-600 hover:underline">📷</button>}
                      <span>{formatDate(p.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Activity */}
        {userDetail.recentActivity?.length > 0 && (
          <div className="card p-0">
            <div className="px-4 py-3 border-b dark:border-gray-800"><h3 className="font-semibold text-sm">📝 Recent Activity</h3></div>
            <div className="divide-y dark:divide-gray-800 max-h-64 overflow-y-auto">
              {userDetail.recentActivity.map((a, i) => (
                <div key={i} className="px-4 py-2 flex items-center justify-between text-xs">
                  <span>{a.icon} {a.message}</span>
                  <span className="text-gray-400">{formatDate(a.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Per-User Settings ── */}
        <div className="card">
          <h3 className="font-semibold text-sm mb-4 text-blue-700 dark:text-blue-400 flex items-center gap-2">⚙️ User Settings <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-normal">Per-user overrides</span></h3>

          {/* Toggles */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">🤖 Chatbot Bubble</p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Show floating chatbot for this user</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={userOverridesForm.chatBubbleEnabled !== false}
                  onChange={e => setUserOverridesForm({ ...userOverridesForm, chatBubbleEnabled: e.target.checked })}
                  className="sr-only peer" />
                <div className="w-10 h-5 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div>
                <p className="text-sm font-medium text-blue-800 dark:text-blue-300">🐄 Farm Modules</p>
                <p className="text-[10px] text-blue-600 dark:text-blue-400">Enable/disable dairy farm features for this user</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={userOverridesForm.farmEnabled !== false}
                  onChange={e => setUserOverridesForm({ ...userOverridesForm, farmEnabled: e.target.checked })}
                  className="sr-only peer" />
                <div className="w-10 h-5 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>
          </div>

          {/* Per-user Module Toggles */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Module Access (override global settings for this user)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { key: 'cattle', label: 'Cattle', icon: '🐄' },
                { key: 'milk', label: 'Milk Records', icon: '🥛' },
                { key: 'health', label: 'Health', icon: '💉' },
                { key: 'breeding', label: 'Breeding', icon: '🐣' },
                { key: 'feed', label: 'Feed', icon: '🌾' },
                { key: 'finance', label: 'Finance', icon: '💰' },
                { key: 'milkDelivery', label: 'Dudh Khata', icon: '🏘️' },
                { key: 'employees', label: 'Employees', icon: '👷' },
                { key: 'insurance', label: 'Insurance', icon: '🛡️' },
                { key: 'reports', label: 'Reports', icon: '📊' },
                { key: 'chatbot', label: 'Farm Assistant', icon: '🤖' },
              ].map(mod => {
                const modules = userOverridesForm.modulesEnabled || {};
                const enabled = modules[mod.key] !== false;
                return (
                  <label key={mod.key} className={`flex items-center gap-1.5 p-2 rounded-lg border cursor-pointer text-xs transition-all ${enabled ? 'bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-700' : 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 opacity-50'}`}>
                    <input type="checkbox" checked={enabled}
                      onChange={e => setUserOverridesForm({ ...userOverridesForm, modulesEnabled: { ...modules, [mod.key]: e.target.checked } })}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span>{mod.icon}</span>
                    <span className="font-medium dark:text-white">{mod.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Limits */}
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Usage Limits (leave empty for unlimited)</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-gray-500 dark:text-gray-400">Max Cattle</label>
                <input type="number" className="input text-sm" placeholder="∞" value={userOverridesForm.maxCattle || ''}
                  onChange={e => setUserOverridesForm({ ...userOverridesForm, maxCattle: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 dark:text-gray-400">Max Employees</label>
                <input type="number" className="input text-sm" placeholder="∞" value={userOverridesForm.maxEmployees || ''}
                  onChange={e => setUserOverridesForm({ ...userOverridesForm, maxEmployees: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div>
                <label className="text-[10px] text-gray-500 dark:text-gray-400">Max Customers</label>
                <input type="number" className="input text-sm" placeholder="∞" value={userOverridesForm.maxCustomers || ''}
                  onChange={e => setUserOverridesForm({ ...userOverridesForm, maxCustomers: e.target.value ? Number(e.target.value) : null })} />
              </div>
            </div>
          </div>

          {/* Admin Notes */}
          <div className="mb-4">
            <label className="text-[10px] text-gray-500 dark:text-gray-400">Admin Notes (visible only to admins)</label>
            <textarea className="input text-sm" rows={2} placeholder="Internal notes about this user..."
              value={userOverridesForm.customNotes || ''}
              onChange={e => setUserOverridesForm({ ...userOverridesForm, customNotes: e.target.value })} />
          </div>

          <button onClick={saveUserOverrides} disabled={savingOverrides}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {savingOverrides ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Saving...</> : '💾 Save User Settings'}
          </button>
        </div>

        {/* Admin Actions */}
        <div className="card">
          <h3 className="font-semibold text-sm mb-3 text-red-600">⚠️ Admin Actions</h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => toggleBlock(u._id, u.isBlocked)} className={`text-xs px-3 py-2 rounded-lg font-medium flex items-center gap-1.5 ${u.isBlocked ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
              {u.isBlocked ? <><FiUnlock size={14} /> Unblock</> : <><FiLock size={14} /> Block User</>}
            </button>
            <button onClick={() => setConfirmDialog({ open: true, title: 'Force Password Reset?', message: 'This will generate a new random password. Share it with the user.', variant: 'info', confirmText: 'Reset', onConfirm: () => forcePasswordReset(u._id) })} className="text-xs px-3 py-2 rounded-lg font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 flex items-center gap-1.5">
              <FiKey size={14} /> Force Password Reset
            </button>
            {u.role !== 'admin' && (
              <button onClick={() => setConfirmDialog({ open: true, title: 'Make Admin?', message: 'This will give full admin access to this user. Are you sure?', variant: 'danger', confirmText: 'Make Admin', onConfirm: () => changeRole(u._id, 'admin') })} className="text-xs px-3 py-2 rounded-lg font-medium bg-purple-100 text-purple-700 hover:bg-purple-200 flex items-center gap-1.5">
                <FiShield size={14} /> Make Admin
              </button>
            )}
            {u.role === 'admin' && u._id !== 'self' && (
              <button onClick={() => changeRole(u._id, 'user')} className="text-xs px-3 py-2 rounded-lg font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center gap-1.5">
                Remove Admin
              </button>
            )}
            <button onClick={() => setConfirmDialog({ open: true, title: '🗑️ DELETE USER PERMANENTLY?', message: `This will permanently delete "${u.name}" and ALL their farm data (cattle, milk records, employees, payments, everything). THIS CANNOT BE UNDONE.`, variant: 'danger', confirmText: 'DELETE FOREVER', onConfirm: () => deleteUser(u._id, u.name) })} className="text-xs px-3 py-2 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 flex items-center gap-1.5">
              <FiTrash2 size={14} /> Delete User & All Data
            </button>
            <button onClick={async () => {
              try {
                const r = await api.post(`/admin/users/${u._id}/impersonate`);
                const token = r.data.token;
                window.open(`${window.location.origin}/dashboard?impersonate=${token}`, '_blank');
                toast.success(`Impersonating ${u.name} — token copied to new tab`);
              } catch { toast.error('Failed to impersonate'); }
            }} className="text-xs px-3 py-2 rounded-lg font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200 flex items-center gap-1.5">
              <FiLogIn size={14} /> Impersonate
            </button>
            <button onClick={async () => {
              setFarmDataLoading(true);
              try {
                const r = await api.get(`/admin/users/${u._id}/farm-data`);
                setFarmDataPreview(r.data.data);
              } catch { toast.error('Failed to load farm data'); }
              finally { setFarmDataLoading(false); }
            }} className="text-xs px-3 py-2 rounded-lg font-medium bg-teal-100 text-teal-700 hover:bg-teal-200 flex items-center gap-1.5">
              {farmDataLoading ? <div className="w-3 h-3 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" /> : <FiEye size={14} />} Farm Data
            </button>
          </div>
        </div>

        {/* Farm Data Preview */}
        {farmDataPreview && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-teal-700 dark:text-teal-400">🐄 Farm Data Preview</h3>
              <button onClick={() => setFarmDataPreview(null)} className="text-xs text-gray-400 hover:text-gray-600">✕ Close</button>
            </div>
            {!farmDataPreview.farmData ? (
              <p className="text-sm text-gray-500">No farm data — user hasn't created a farm yet.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                  {[
                    { label: 'Cattle', value: farmDataPreview.farmData.cattle?.count || 0, color: 'blue' },
                    { label: 'Milk Records', value: farmDataPreview.farmData.milkRecords, color: 'emerald' },
                    { label: 'Health Records', value: farmDataPreview.farmData.healthRecords, color: 'red' },
                    { label: 'Breeding', value: farmDataPreview.farmData.breedingRecords, color: 'pink' },
                    { label: 'Expenses', value: farmDataPreview.farmData.expenses, color: 'amber' },
                    { label: 'Revenues', value: farmDataPreview.farmData.revenues, color: 'green' },
                    { label: 'Feed Records', value: farmDataPreview.farmData.feedRecords, color: 'yellow' },
                    { label: 'Insurance', value: farmDataPreview.farmData.insuranceRecords, color: 'purple' },
                    { label: 'Employees', value: farmDataPreview.farmData.employees, color: 'indigo' },
                    { label: 'Customers', value: farmDataPreview.farmData.customers, color: 'orange' },
                    { label: 'Deliveries', value: farmDataPreview.farmData.deliveries, color: 'teal' },
                  ].map(item => (
                    <div key={item.label} className={`bg-${item.color}-50 dark:bg-${item.color}-900/20 rounded-lg p-2 text-center`}>
                      <p className="text-[10px] text-gray-500">{item.label}</p>
                      <p className="text-lg font-bold">{item.value}</p>
                    </div>
                  ))}
                </div>
                {farmDataPreview.farmData.cattle?.list?.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Cattle List:</p>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {farmDataPreview.farmData.cattle.list.map(c => (
                        <div key={c._id} className="flex items-center justify-between text-xs bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-1.5">
                          <span className="font-medium">{c.name || c.tagNumber}</span>
                          <span className="text-gray-400">{c.breed} · {c.gender} · {c.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Grant Modal */}
        <Modal isOpen={grantModal} onClose={() => setGrantModal(false)} title="🎁 Grant Subscription" size="md">
          <div className="space-y-4">
            <div><label className="label">Plan</label>
              <select className="input" value={grantForm.plan} onChange={e => { const sel = adminPlans.find(p => p.name === e.target.value); setGrantForm({ plan: e.target.value, days: sel?.days || grantForm.days }); }}>
                {adminPlans.filter(p => p.isActive).map(p => <option key={p._id} value={p.name}>{p.label} ({p.days} days)</option>)}
                <option value="manual">Custom</option>
              </select>
            </div>
            <div><label className="label">Days</label><input type="number" className="input" min="1" value={grantForm.days} onChange={e => setGrantForm({ ...grantForm, days: Number(e.target.value) })} /></div>
            <button onClick={grantSubscription} className="btn-primary w-full">Grant {grantForm.days} Days</button>
          </div>
        </Modal>

        <ConfirmDialog isOpen={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText} onConfirm={confirmDialog.onConfirm} />
      </div>
    );
  }

  // ═══════════════════════════════════════
  //  MAIN PANEL
  // ═══════════════════════════════════════
  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'users', label: '👥 Users' },
    { id: 'payments', label: '💳 Payments' },
    { id: 'plans', label: '📦 Plans' },
    { id: 'logs', label: '📝 Audit Logs' },
    { id: 'system', label: '🖥️ System' },
    { id: 'website', label: '🌐 Website' },
    { id: 'app-config', label: '🎛️ App Config' },
    { id: 'support', label: '📩 Support' },
    { id: 'broadcast', label: '📢 Broadcast' },
    { id: 'export', label: '📦 Export' },
  ];

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <FiShield className="text-emerald-600" size={28} />
        <div><h1 className="text-2xl font-bold">Admin Panel</h1><p className="text-gray-500 text-sm">Full control over users, payments, subscriptions & system</p></div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap ${tab === t.id ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-200 dark:ring-emerald-800' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}`}>{t.label}</button>
        ))}
      </div>

      {/* ═══ OVERVIEW ═══ */}
      {tab === 'overview' && dashboard && (
        <div className="space-y-5">
          {/* KPI Cards Row 1 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total Users', value: dashboard.totalUsers, icon: '👥', color: 'blue' },
              { label: 'Active Subs', value: dashboard.activeSubscriptions, icon: '✅', color: 'emerald' },
              { label: 'Pending Pay', value: dashboard.pendingPayments, icon: '⏳', color: 'amber' },
              { label: 'Total Revenue', value: formatCurrency(dashboard.totalRevenue), icon: '💰', color: 'green' },
              { label: 'Farms', value: dashboard.totalFarms, icon: '🏠', color: 'purple' },
              { label: 'Conversion', value: `${dashboard.conversionRate || 0}%`, icon: '📊', color: 'indigo' },
            ].map((kpi, i) => (
              <div key={i} className={`bg-${kpi.color}-50 dark:bg-${kpi.color}-900/20 rounded-xl p-4 text-center border border-${kpi.color}-100 dark:border-${kpi.color}-900/30`}>
                <span className="text-lg">{kpi.icon}</span>
                <p className={`text-[10px] text-${kpi.color}-500 mt-1 uppercase font-medium tracking-wide`}>{kpi.label}</p>
                <p className={`text-xl font-bold text-${kpi.color}-700 dark:text-${kpi.color}-300 mt-0.5`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Quick Insights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="card !p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-lg">🆕</div>
              <div><p className="text-xs text-gray-500">New Users (7d)</p><p className="text-lg font-bold dark:text-white">{dashboard.recentSignups || 0}</p></div>
            </div>
            <div className="card !p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-lg">⚠️</div>
              <div><p className="text-xs text-gray-500">Expiring (7d)</p><p className="text-lg font-bold dark:text-white">{dashboard.expiringSoon || 0}</p></div>
            </div>
            <div className="card !p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-lg">💵</div>
              <div><p className="text-xs text-gray-500">ARPU</p><p className="text-lg font-bold dark:text-white">{formatCurrency(dashboard.arpu || 0)}</p></div>
            </div>
            <div className="card !p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-lg">📈</div>
              <div><p className="text-xs text-gray-500">Conversion Rate</p><p className="text-lg font-bold dark:text-white">{dashboard.conversionRate || 0}%</p></div>
            </div>
          </div>

          {/* Charts Row 1: Revenue */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Monthly Revenue Bar Chart */}
            <div className="card">
              <h3 className="font-semibold mb-1 dark:text-white">📊 Monthly Revenue</h3>
              <p className="text-xs text-gray-400 mb-4">Last 12 months</p>
              {dashboard.monthlyRevenue?.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dashboard.monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="_id" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5) || v} />
                    <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={v => formatCurrency(v)} labelFormatter={l => `Month: ${l}`} />
                    <Bar dataKey="total" fill="#10b981" radius={[6, 6, 0, 0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-center py-12">No revenue data yet</p>}
            </div>

            {/* Daily Revenue Trend (Area Chart) */}
            <div className="card">
              <h3 className="font-semibold mb-1 dark:text-white">📈 Daily Revenue Trend</h3>
              <p className="text-xs text-gray-400 mb-4">Last 30 days</p>
              {dashboard.dailyRevenue?.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={dashboard.dailyRevenue}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="_id" tick={{ fontSize: 9 }} tickFormatter={v => v?.slice(5) || v} />
                    <YAxis tickFormatter={v => `₹${v}`} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v, name) => name === 'total' ? formatCurrency(v) : v} labelFormatter={l => `Date: ${l}`} />
                    <Area type="monotone" dataKey="total" stroke="#10b981" fill="url(#revenueGrad)" strokeWidth={2} name="Revenue" />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="Transactions" yAxisId={0} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-center py-12">No recent transactions</p>}
            </div>
          </div>

          {/* Charts Row 2: Users & Plans */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* User Growth Line Chart */}
            <div className="card">
              <h3 className="font-semibold mb-1 dark:text-white">👥 User Growth</h3>
              <p className="text-xs text-gray-400 mb-4">Monthly signups</p>
              {dashboard.userGrowth?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={dashboard.userGrowth}>
                    <defs>
                      <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="_id" tick={{ fontSize: 10 }} tickFormatter={v => v?.slice(5) || v} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip labelFormatter={l => `Month: ${l}`} />
                    <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="url(#userGrad)" strokeWidth={2} name="New Users" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-center py-8">No data</p>}
            </div>

            {/* Plan Distribution Pie */}
            <div className="card">
              <h3 className="font-semibold mb-1 dark:text-white">🎯 Active Plans</h3>
              <p className="text-xs text-gray-400 mb-4">Current distribution</p>
              {dashboard.planDistribution?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={dashboard.planDistribution.map(d => ({ name: d._id, value: d.count }))} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {dashboard.planDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-center py-8">No subscriptions</p>}
            </div>

            {/* Payment Status Pie */}
            <div className="card">
              <h3 className="font-semibold mb-1 dark:text-white">💳 Payment Status</h3>
              <p className="text-xs text-gray-400 mb-4">All-time breakdown</p>
              {dashboard.paymentStatusBreakdown?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={dashboard.paymentStatusBreakdown.map(d => ({ name: d._id, value: d.count }))} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {dashboard.paymentStatusBreakdown.map((d, i) => {
                        const statusColors = { verified: '#10b981', pending: '#f59e0b', rejected: '#ef4444', expired: '#9ca3af' };
                        return <Cell key={i} fill={statusColors[d._id] || COLORS[i % COLORS.length]} />;
                      })}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-center py-8">No payments</p>}
            </div>
          </div>

          {/* Charts Row 3: Revenue by Plan & Payment Methods */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Plans by Revenue */}
            <div className="card">
              <h3 className="font-semibold mb-1 dark:text-white">🏆 Revenue by Plan</h3>
              <p className="text-xs text-gray-400 mb-4">Which plans earn the most</p>
              {dashboard.topPlansByRevenue?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dashboard.topPlansByRevenue} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                    <YAxis type="category" dataKey="_id" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip formatter={(v, name) => name === 'totalRevenue' ? formatCurrency(v) : v} />
                    <Bar dataKey="totalRevenue" fill="#8b5cf6" radius={[0, 6, 6, 0]} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-center py-8">No data</p>}
            </div>

            {/* Payment Methods */}
            <div className="card">
              <h3 className="font-semibold mb-1 dark:text-white">💳 Payment Methods</h3>
              <p className="text-xs text-gray-400 mb-4">Razorpay vs Manual UPI</p>
              {dashboard.paymentMethodBreakdown?.length > 0 ? (
                <div className="space-y-4 pt-4">
                  {dashboard.paymentMethodBreakdown.map((m, i) => {
                    const totalPayments = dashboard.paymentMethodBreakdown.reduce((s, x) => s + x.count, 0);
                    const pct = totalPayments > 0 ? Math.round((m.count / totalPayments) * 100) : 0;
                    const isRazorpay = m._id === 'razorpay';
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium dark:text-white flex items-center gap-2">
                            {isRazorpay ? '💳' : '📱'} {isRazorpay ? 'Razorpay' : 'Manual UPI'}
                          </span>
                          <span className="text-sm text-gray-500">{m.count} payments · {formatCurrency(m.total)}</span>
                        </div>
                        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
                          <div className={`h-3 rounded-full transition-all ${isRazorpay ? 'bg-indigo-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }}></div>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">{pct}% of total payments</p>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-gray-400 text-center py-8">No verified payments</p>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ USERS ═══ */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input className="input pl-10 text-sm" placeholder="Search name, email, phone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex gap-2">
              {[{ v: '', l: 'All' }, { v: 'active', l: 'Active' }, { v: 'blocked', l: 'Blocked' }].map(f => (
                <button key={f.v} onClick={() => setUserStatusFilter(f.v)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium ${userStatusFilter === f.v ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{f.l}</button>
              ))}
            </div>
          </div>
          <div className="card p-0 overflow-hidden">
            {users.length === 0 ? <div className="py-8 text-center text-gray-400">No users found</div> : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-auto max-h-[60vh]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10"><tr className="bg-gray-50 dark:bg-gray-800 border-b text-xs text-gray-500 uppercase">
                      <th className="px-4 py-2 text-left">User</th>
                      <th className="px-3 py-2 text-left">Farm</th>
                      <th className="px-3 py-2 text-center">Role</th>
                      <th className="px-3 py-2 text-center">Subscription</th>
                      <th className="px-3 py-2 text-center">Status</th>
                      <th className="px-3 py-2 text-left">Joined</th>
                      <th className="px-3 py-2 text-center">Actions</th>
                    </tr></thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={u._id} className={`border-b hover:bg-gray-50 dark:hover:bg-gray-800/30 ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}`}>
                          <td className="px-4 py-2"><p className="font-medium">{u.name}</p><p className="text-xs text-gray-400">{u.email}</p></td>
                          <td className="px-3 py-2 text-xs text-gray-500">{u.farmId?.name || '-'}</td>
                          <td className="px-3 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span></td>
                          <td className="px-3 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.subscriptionActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>{u.subscriptionActive ? '✅ Active' : '❌ Expired'}</span></td>
                          <td className="px-3 py-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.isBlocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{u.isBlocked ? 'Blocked' : 'Active'}</span></td>
                          <td className="px-3 py-2 text-xs text-gray-500">{formatDate(u.createdAt)}</td>
                          <td className="px-3 py-2">
                            <div className="flex gap-1 justify-center">
                              <button onClick={() => viewUserDetail(u._id)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-200"><FiEye size={12} /></button>
                              {u.role !== 'admin' && (
                                <button onClick={() => toggleBlock(u._id, u.isBlocked)} className={`text-xs px-2 py-1 rounded-lg ${u.isBlocked ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                                  {u.isBlocked ? <FiUnlock size={12} /> : <FiLock size={12} />}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y dark:divide-gray-800 max-h-[60vh] overflow-y-auto">
                  {users.map(u => (
                    <div key={u._id} className="p-4 space-y-2" onClick={() => viewUserDetail(u._id)}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm dark:text-white">{u.name}</p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${u.isBlocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {u.isBlocked ? '🚫 Blocked' : '✅ Active'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${u.subscriptionActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>{u.subscriptionActive ? 'Subscribed' : 'No Sub'}</span>
                        {u.farmId?.name && <span className="text-[10px] text-gray-400">🏠 {u.farmId.name}</span>}
                        <span className="text-[10px] text-gray-400 ml-auto">{formatDate(u.createdAt)}</span>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={(e) => { e.stopPropagation(); viewUserDetail(u._id); }} className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 flex items-center gap-1"><FiEye size={12} /> View</button>
                        {u.role !== 'admin' && (
                          <button onClick={(e) => { e.stopPropagation(); toggleBlock(u._id, u.isBlocked); }} className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 ${u.isBlocked ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
                            {u.isBlocked ? <><FiUnlock size={12} /> Unblock</> : <><FiLock size={12} /> Block</>}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            <Pagination page={usersPagination.page} pages={usersPagination.pages} total={usersPagination.total} onPageChange={p => setUsersPage(p)} />
          </div>
        </div>
      )}

      {/* ═══ PAYMENTS ═══ */}
      {tab === 'payments' && (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[{ v: '', l: 'All' }, { v: 'pending', l: '⏳ Pending' }, { v: 'verified', l: '✅ Verified' }, { v: 'rejected', l: '❌ Rejected' }, { v: 'expired', l: '⏰ Expired' }].map(f => (
              <button key={f.v} onClick={() => { setPaymentStatusFilter(f.v); setPaymentsPage(1); }}
                className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 ${paymentStatusFilter === f.v ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{f.l}</button>
            ))}
          </div>
          <div className="card p-0 overflow-hidden">
            {payments.length === 0 ? <div className="py-8 text-center text-gray-400">No payments</div> : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-auto max-h-[60vh]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10"><tr className="bg-gray-50 dark:bg-gray-800 border-b text-xs text-gray-500 uppercase">
                      <th className="px-4 py-2 text-left">User</th>
                      <th className="px-3 py-2">Plan</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Txn ID</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Method</th>
                      <th className="px-3 py-2">Note</th>
                    </tr></thead>
                    <tbody>
                      {payments.map((p, i) => (
                        <tr key={p._id} className={`border-b ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}`}>
                          <td className="px-4 py-2"><p className="font-medium text-xs">{p.userId?.name}</p><p className="text-[10px] text-gray-400">{p.userId?.email}</p></td>
                          <td className="px-3 py-2 capitalize text-xs font-medium">{p.plan}</td>
                          <td className="px-3 py-2 text-xs font-semibold">{formatCurrency(p.amount)}</td>
                          <td className="px-3 py-2 font-mono text-[10px] text-gray-500">{p.upiTransactionId}</td>
                          <td className="px-3 py-2 text-xs text-gray-500">{formatDate(p.createdAt)}</td>
                          <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${p.status === 'verified' ? 'bg-green-100 text-green-700' : p.status === 'rejected' ? 'bg-red-100 text-red-700' : p.status === 'expired' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700'}`}>{p.status}</span></td>
                          <td className="px-3 py-2 text-xs text-gray-400">{p.paymentMethod === 'razorpay' ? '💳 Razorpay' : '📱 UPI'}</td>
                          <td className="px-3 py-2 text-xs text-gray-400">{p.adminNote || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y dark:divide-gray-800 max-h-[60vh] overflow-y-auto">
                  {payments.map(p => {
                    const statusColor = p.status === 'verified' ? 'bg-green-100 text-green-700' : p.status === 'rejected' ? 'bg-red-100 text-red-700' : p.status === 'expired' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700';
                    return (
                      <div key={p._id} className="p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-sm dark:text-white">{p.userId?.name}</p>
                            <p className="text-xs text-gray-400">{p.userId?.email}</p>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor}`}>{p.status}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold dark:text-white">{formatCurrency(p.amount)}</span>
                            <span className="text-xs capitalize bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">{p.plan}</span>
                          </div>
                          <span className="text-xs text-gray-400">{formatDate(p.createdAt)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span className="font-mono">{p.upiTransactionId}</span>
                          <span>{p.paymentMethod === 'razorpay' ? '💳 Razorpay' : '📱 UPI'}</span>
                        </div>
                        {p.status === 'pending' && (
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => verifyPayment(p._id)} className="flex-1 text-xs bg-emerald-100 text-emerald-700 py-1.5 rounded-lg hover:bg-emerald-200 font-medium flex items-center justify-center gap-1"><FiCheck size={12} /> Verify</button>
                            <button onClick={() => rejectPayment(p._id)} className="flex-1 text-xs bg-red-100 text-red-700 py-1.5 rounded-lg hover:bg-red-200 font-medium flex items-center justify-center gap-1"><FiX size={12} /> Reject</button>
                            {p.screenshot && <button onClick={() => viewScreenshot(p._id)} className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200">📷</button>}
                          </div>
                        )}
                        {p.adminNote && <p className="text-xs text-gray-400 italic">Note: {p.adminNote}</p>}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            <Pagination page={paymentsPagination.page} pages={paymentsPagination.pages} total={paymentsPagination.total} onPageChange={p => setPaymentsPage(p)} />
          </div>
        </div>
      )}

      {/* ═══ APP CONFIGURATION ═══ */}
      {tab === 'app-config' && appConfigForm && (() => {
        const configSections = [
          { key: 'employeeRoles', label: 'Employee Roles', icon: '👷', color: 'blue', desc: 'Available roles when adding employees' },
          { key: 'cattleCategories', label: 'Cattle Categories', icon: '🐄', color: 'emerald', desc: 'Categories like milking, dry, calf' },
          { key: 'cattleBreeds', label: 'Cattle Breeds', icon: '🧬', color: 'purple', desc: 'Breed suggestions when adding cattle' },
          { key: 'healthRecordTypes', label: 'Health Record Types', icon: '💉', color: 'red', desc: 'Vaccination, treatment, checkup, etc.' },
          { key: 'expenseCategories', label: 'Expense Categories', icon: '📉', color: 'amber', desc: 'Categories in finance expenses' },
          { key: 'revenueCategories', label: 'Revenue Categories', icon: '📈', color: 'green', desc: 'Categories in finance revenue' },
          { key: 'feedTypes', label: 'Feed Types', icon: '🌾', color: 'yellow', desc: 'Feed type options in feed records' },
          { key: 'paymentMethods', label: 'Payment Methods', icon: '💳', color: 'indigo', desc: 'For salary & customer payments' },
          { key: 'milkDeliverySessions', label: 'Delivery Sessions', icon: '🥛', color: 'cyan', desc: 'Morning, evening, etc.' },
        ];
        const tagColors = {
          blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
          emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
          purple: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
          red: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
          amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
          green: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
          yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800',
          indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800',
          cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300 dark:border-cyan-800',
        };
        const headerColors = {
          blue: 'from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-900/20',
          emerald: 'from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-900/20',
          purple: 'from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-900/20',
          red: 'from-red-100 to-red-50 dark:from-red-900/40 dark:to-red-900/20',
          amber: 'from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-900/20',
          green: 'from-green-100 to-green-50 dark:from-green-900/40 dark:to-green-900/20',
          yellow: 'from-yellow-100 to-yellow-50 dark:from-yellow-900/40 dark:to-yellow-900/20',
          indigo: 'from-indigo-100 to-indigo-50 dark:from-indigo-900/40 dark:to-indigo-900/20',
          cyan: 'from-cyan-100 to-cyan-50 dark:from-cyan-900/40 dark:to-cyan-900/20',
        };
        const headerTextColors = {
          blue: 'text-blue-800 dark:text-blue-300', emerald: 'text-emerald-800 dark:text-emerald-300', purple: 'text-purple-800 dark:text-purple-300',
          red: 'text-red-800 dark:text-red-300', amber: 'text-amber-800 dark:text-amber-300', green: 'text-green-800 dark:text-green-300',
          yellow: 'text-yellow-800 dark:text-yellow-300', indigo: 'text-indigo-800 dark:text-indigo-300', cyan: 'text-cyan-800 dark:text-cyan-300',
        };
        const badgeColors = {
          blue: 'bg-blue-200/60 text-blue-700 dark:bg-blue-800/40 dark:text-blue-300',
          emerald: 'bg-emerald-200/60 text-emerald-700 dark:bg-emerald-800/40 dark:text-emerald-300',
          purple: 'bg-purple-200/60 text-purple-700 dark:bg-purple-800/40 dark:text-purple-300',
          red: 'bg-red-200/60 text-red-700 dark:bg-red-800/40 dark:text-red-300',
          amber: 'bg-amber-200/60 text-amber-700 dark:bg-amber-800/40 dark:text-amber-300',
          green: 'bg-green-200/60 text-green-700 dark:bg-green-800/40 dark:text-green-300',
          yellow: 'bg-yellow-200/60 text-yellow-700 dark:bg-yellow-800/40 dark:text-yellow-300',
          indigo: 'bg-indigo-200/60 text-indigo-700 dark:bg-indigo-800/40 dark:text-indigo-300',
          cyan: 'bg-cyan-200/60 text-cyan-700 dark:bg-cyan-800/40 dark:text-cyan-300',
        };
        const btnColors = {
          blue: 'bg-blue-500 hover:bg-blue-600', emerald: 'bg-emerald-500 hover:bg-emerald-600', purple: 'bg-purple-500 hover:bg-purple-600',
          red: 'bg-red-500 hover:bg-red-600', amber: 'bg-amber-500 hover:bg-amber-600', green: 'bg-green-500 hover:bg-green-600',
          yellow: 'bg-yellow-500 hover:bg-yellow-600', indigo: 'bg-indigo-500 hover:bg-indigo-600', cyan: 'bg-cyan-500 hover:bg-cyan-600',
        };
        const getItems = (key) => {
          const val = appConfigForm[key];
          return Array.isArray(val) ? val : [];
        };
        const setItems = (key, items) => setAppConfigForm({ ...appConfigForm, [key]: items });
        const removeItem = (key, idx) => { const items = [...getItems(key)]; items.splice(idx, 1); setItems(key, items); };
        const addItem = (key, value) => { if (!value.trim()) return; const items = [...getItems(key)]; if (items.includes(value.trim())) return toast.error('Already exists'); items.push(value.trim()); setItems(key, items); };
        const saveConfig = async () => {
          setSavingConfig(true);
          try {
            await api.put('/app-config', appConfigForm);
            toast.success('✅ Configuration saved! All pages updated.');
            loadTab();
          } catch (err) { toast.error(err.response?.data?.message || 'Failed to save'); }
          finally { setSavingConfig(false); }
        };

        return (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
              <div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">🎛️ App Configuration</h2>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Customize every dropdown, category & option in your app</p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-xs text-gray-500 dark:text-gray-400">{configSections.length} sections · {configSections.reduce((sum, s) => sum + getItems(s.key).length, 0)} items</span>
                <button onClick={saveConfig} disabled={savingConfig}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-xl font-semibold transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 flex items-center gap-2 text-sm">
                  {savingConfig ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Saving...</> : '💾 Save Changes'}
                </button>
              </div>
            </div>

            {/* Config Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {configSections.map(({ key, label, icon, color, desc }) => {
                const items = getItems(key);
                return (
                  <div key={key} className="card !p-0 overflow-hidden group hover:shadow-md transition-shadow duration-300">
                    {/* Card Header */}
                    <div className={`bg-gradient-to-r ${headerColors[color]} px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800`}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{icon}</span>
                        <div>
                          <h3 className={`font-semibold text-sm ${headerTextColors[color]}`}>{label}</h3>
                          <p className="text-gray-500 dark:text-gray-400 text-[10px]">{desc}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${badgeColors[color]}`}>{items.length}</span>
                    </div>

                    {/* Tags */}
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2 min-h-[40px]">
                        {items.map((item, idx) => (
                          <span key={idx} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all hover:shadow-sm ${tagColors[color]}`}>
                            {item}
                            <button onClick={() => removeItem(key, idx)} className="hover:bg-black/10 dark:hover:bg-white/10 rounded-full w-4 h-4 flex items-center justify-center transition-colors" title="Remove">
                              <FiX size={10} />
                            </button>
                          </span>
                        ))}
                        {items.length === 0 && <span className="text-xs text-gray-400 italic">No items yet — add one below</span>}
                      </div>

                      {/* Add new item */}
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          className="input text-sm flex-1 !py-1.5"
                          placeholder={`Add new ${label.toLowerCase().replace(/s$/, '')}...`}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && e.target.value.trim()) {
                              addItem(key, e.target.value);
                              e.target.value = '';
                            }
                          }}
                        />
                        <button onClick={e => {
                          const input = e.target.closest('div').querySelector('input');
                          if (input.value.trim()) { addItem(key, input.value); input.value = ''; }
                        }} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${btnColors[color]} text-white transition flex items-center gap-1`}>
                          <FiPlus size={12} /> Add
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Branding & Chatbot */}
            <div className="card !p-0 overflow-hidden col-span-1 lg:col-span-2">
              <div className="bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-900/20 px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">🎨 Branding & Chatbot</h3>
                <p className="text-xs text-gray-500 mt-0.5">Customize app name, logo, and chatbot behavior</p>
              </div>
              <div className="p-5 space-y-6">
                {/* Branding */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Branding</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="label text-xs">App Name</label>
                      <input type="text" className="input text-sm" value={appConfigForm.appName || 'DairyPro'}
                        onChange={e => setAppConfigForm({ ...appConfigForm, appName: e.target.value })} />
                    </div>
                    <div>
                      <label className="label text-xs">App Logo (emoji or URL)</label>
                      <input type="text" className="input text-sm" value={appConfigForm.appLogo || '🐄'}
                        onChange={e => setAppConfigForm({ ...appConfigForm, appLogo: e.target.value })} />
                    </div>
                    <div>
                      <label className="label text-xs">App Tagline</label>
                      <input type="text" className="input text-sm" value={appConfigForm.appTagline || 'Smart Dairy Farm Management'}
                        onChange={e => setAppConfigForm({ ...appConfigForm, appTagline: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* Chatbot */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Chatbot</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="label text-xs">Chatbot Name</label>
                      <input type="text" className="input text-sm" value={appConfigForm.chatbotName || 'DairyPro AI'}
                        onChange={e => setAppConfigForm({ ...appConfigForm, chatbotName: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label text-xs">Chatbot Welcome Message (bubble)</label>
                      <textarea className="input text-sm" rows={2} value={appConfigForm.chatbotWelcome || ''}
                        onChange={e => setAppConfigForm({ ...appConfigForm, chatbotWelcome: e.target.value })}
                        placeholder="Namaste! 🐄 I have full access to your farm..." />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label text-xs">Chatbot Full Page Welcome (leave empty for default)</label>
                      <textarea className="input text-sm" rows={3} value={appConfigForm.chatbotFullWelcome || ''}
                        onChange={e => setAppConfigForm({ ...appConfigForm, chatbotFullWelcome: e.target.value })}
                        placeholder="Leave empty to use default welcome message" />
                    </div>
                  </div>

                  {/* Chatbot Suggestions */}
                  <div className="mt-4">
                    <label className="label text-xs">Chatbot Suggestions (bubble quick prompts)</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(appConfigForm.chatbotSuggestions || []).map((s, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs rounded-full border border-emerald-200 dark:border-emerald-800">
                          {s}
                          <button onClick={() => {
                            const items = [...(appConfigForm.chatbotSuggestions || [])];
                            items.splice(i, 1);
                            setAppConfigForm({ ...appConfigForm, chatbotSuggestions: items });
                          }} className="ml-1 text-emerald-400 hover:text-red-500">×</button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <input type="text" className="input text-sm flex-1" placeholder="Add suggestion..."
                        onKeyDown={e => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            const items = [...(appConfigForm.chatbotSuggestions || []), e.target.value.trim()];
                            setAppConfigForm({ ...appConfigForm, chatbotSuggestions: items });
                            e.target.value = '';
                          }
                        }} />
                      <button onClick={e => {
                        const input = e.target.closest('div').querySelector('input');
                        if (input.value.trim()) {
                          const items = [...(appConfigForm.chatbotSuggestions || []), input.value.trim()];
                          setAppConfigForm({ ...appConfigForm, chatbotSuggestions: items });
                          input.value = '';
                        }
                      }} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition">Add</button>
                    </div>
                  </div>

                  {/* Chatbot Quick Actions */}
                  <div className="mt-4">
                    <label className="label text-xs">Chatbot Quick Actions (full page — leave empty for defaults)</label>
                    <div className="space-y-2 mt-1">
                      {(appConfigForm.chatbotQuickActions || []).map((a, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input type="text" className="input text-sm flex-1" placeholder="Label (e.g. 🥛 Today's Milk)" value={a.label || ''}
                            onChange={e => {
                              const items = [...(appConfigForm.chatbotQuickActions || [])];
                              items[i] = { ...items[i], label: e.target.value };
                              setAppConfigForm({ ...appConfigForm, chatbotQuickActions: items });
                            }} />
                          <input type="text" className="input text-sm flex-1" placeholder="Message to send" value={a.message || ''}
                            onChange={e => {
                              const items = [...(appConfigForm.chatbotQuickActions || [])];
                              items[i] = { ...items[i], message: e.target.value };
                              setAppConfigForm({ ...appConfigForm, chatbotQuickActions: items });
                            }} />
                          <button onClick={() => {
                            const items = [...(appConfigForm.chatbotQuickActions || [])];
                            items.splice(i, 1);
                            setAppConfigForm({ ...appConfigForm, chatbotQuickActions: items });
                          }} className="text-red-400 hover:text-red-600 p-1">×</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => {
                      const items = [...(appConfigForm.chatbotQuickActions || []), { label: '', message: '', sortOrder: (appConfigForm.chatbotQuickActions || []).length }];
                      setAppConfigForm({ ...appConfigForm, chatbotQuickActions: items });
                    }} className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-white transition">+ Add Quick Action</button>
                  </div>
                </div>
              </div>
            </div>

            {/* App Behavior Settings */}
            <div className="card !p-0 overflow-hidden col-span-1 lg:col-span-2">
              <div className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-900 px-5 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-800 dark:text-white flex items-center gap-2">⚙️ App Behavior Settings</h3>
                <p className="text-xs text-gray-500 mt-0.5">Control app-wide behavior, limits and display options</p>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="label text-xs">🗑️ Notification Retention (days)</label>
                  <input type="number" min="1" className="input text-sm" value={appConfigForm.notificationRetentionDays || 30}
                    onChange={e => setAppConfigForm({ ...appConfigForm, notificationRetentionDays: Number(e.target.value) })} />
                  <p className="text-[10px] text-gray-400 mt-1">Auto-delete notifications older than this</p>
                </div>
                <div>
                  <label className="label text-xs">💾 Max Backup Records</label>
                  <input type="number" min="50" className="input text-sm" value={appConfigForm.maxBackupRecords || 500}
                    onChange={e => setAppConfigForm({ ...appConfigForm, maxBackupRecords: Number(e.target.value) })} />
                  <p className="text-[10px] text-gray-400 mt-1">Max records per section in exports</p>
                </div>
                <div>
                  <label className="label text-xs">🆓 Free Trial (days)</label>
                  <input type="number" min="0" className="input text-sm" value={appConfigForm.trialDays || 5}
                    onChange={e => setAppConfigForm({ ...appConfigForm, trialDays: Number(e.target.value) })} />
                  <p className="text-[10px] text-gray-400 mt-1">Free trial for new users</p>
                </div>
                <div>
                  <label className="label text-xs">📎 Max Upload Size (MB)</label>
                  <input type="number" min="1" max="20" className="input text-sm" value={appConfigForm.maxFileUploadMB || 2}
                    onChange={e => setAppConfigForm({ ...appConfigForm, maxFileUploadMB: Number(e.target.value) })} />
                  <p className="text-[10px] text-gray-400 mt-1">Photo & file upload limit</p>
                </div>
                <div>
                  <label className="label text-xs">⏰ Session Timeout (hours)</label>
                  <input type="number" min="1" className="input text-sm" value={appConfigForm.sessionTimeoutHours || 24}
                    onChange={e => setAppConfigForm({ ...appConfigForm, sessionTimeoutHours: Number(e.target.value) })} />
                  <p className="text-[10px] text-gray-400 mt-1">Auto-logout after inactivity</p>
                </div>
                <div>
                  <label className="label text-xs">💱 Currency Symbol</label>
                  <input type="text" className="input text-sm" value={appConfigForm.currencySymbol || '₹'}
                    onChange={e => setAppConfigForm({ ...appConfigForm, currencySymbol: e.target.value })} />
                </div>
                <div>
                  <label className="label text-xs">📅 Date Format</label>
                  <select className="input text-sm" value={appConfigForm.dateFormat || 'DD/MM/YYYY'}
                    onChange={e => setAppConfigForm({ ...appConfigForm, dateFormat: e.target.value })}>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>
                <div>
                  <label className="label text-xs">🥛 Milk Unit</label>
                  <select className="input text-sm" value={appConfigForm.milkUnit || 'liters'}
                    onChange={e => setAppConfigForm({ ...appConfigForm, milkUnit: e.target.value })}>
                    <option value="liters">Liters</option>
                    <option value="kg">Kilograms</option>
                    <option value="gallons">Gallons</option>
                  </select>
                </div>
                <div>
                  <label className="label text-xs">⚖️ Weight Unit</label>
                  <select className="input text-sm" value={appConfigForm.weightUnit || 'kg'}
                    onChange={e => setAppConfigForm({ ...appConfigForm, weightUnit: e.target.value })}>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="lbs">Pounds (lbs)</option>
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="label text-xs">👋 Welcome Message (Dashboard)</label>
                  <input type="text" className="input text-sm" value={appConfigForm.welcomeMessage || ''}
                    onChange={e => setAppConfigForm({ ...appConfigForm, welcomeMessage: e.target.value })}
                    placeholder="e.g. Welcome to DairyPro! 🐄" />
                  <p className="text-[10px] text-gray-400 mt-1">Custom welcome message shown on user dashboard (leave empty for default)</p>
                </div>
                {/* Chatbot Bubble Toggle */}
                <div className="sm:col-span-2 lg:col-span-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2">🤖 Chatbot Bubble</h4>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Show the floating AI chatbot bubble on all pages</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={appConfigForm.chatBubbleEnabled !== false}
                        onChange={e => setAppConfigForm({ ...appConfigForm, chatBubbleEnabled: e.target.checked })}
                        className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>

                {/* Farm Module Toggles */}
                <div className="sm:col-span-2 lg:col-span-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                  <div className="mb-3">
                    <h4 className="font-semibold text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">🏗️ Farm Management Modules</h4>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">Enable or disable specific modules for all users. Disabled modules will be hidden from the sidebar.</p>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {[
                      { key: 'cattle', label: 'Cattle', icon: '🐄' },
                      { key: 'milk', label: 'Milk Records', icon: '🥛' },
                      { key: 'health', label: 'Health', icon: '💉' },
                      { key: 'breeding', label: 'Breeding', icon: '🐣' },
                      { key: 'feed', label: 'Feed', icon: '🌾' },
                      { key: 'finance', label: 'Finance', icon: '💰' },
                      { key: 'milkDelivery', label: 'Dudh Khata', icon: '🏘️' },
                      { key: 'employees', label: 'Employees', icon: '👷' },
                      { key: 'insurance', label: 'Insurance', icon: '🛡️' },
                      { key: 'reports', label: 'Reports', icon: '📊' },
                      { key: 'chatbot', label: 'Farm Assistant', icon: '🤖' },
                    ].map(mod => {
                      const modules = appConfigForm.modulesEnabled || {};
                      const enabled = modules[mod.key] !== false;
                      return (
                        <label key={mod.key} className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${enabled ? 'bg-white dark:bg-gray-800 border-blue-200 dark:border-blue-700' : 'bg-gray-100 dark:bg-gray-900 border-gray-200 dark:border-gray-700 opacity-60'}`}>
                          <input type="checkbox" checked={enabled}
                            onChange={e => setAppConfigForm({ ...appConfigForm, modulesEnabled: { ...modules, [mod.key]: e.target.checked } })}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                          <span className="text-sm">{mod.icon}</span>
                          <span className="text-xs font-medium dark:text-white">{mod.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="sm:col-span-2 lg:col-span-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">🚧 Maintenance Mode</h4>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">When enabled, users see a maintenance page instead of the app</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={appConfigForm.maintenanceMode || false}
                        onChange={e => setAppConfigForm({ ...appConfigForm, maintenanceMode: e.target.checked })}
                        className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
                    </label>
                  </div>
                  {appConfigForm.maintenanceMode && (
                    <div className="mt-3">
                      <label className="label text-xs">Maintenance Message</label>
                      <input type="text" className="input text-sm" value={appConfigForm.maintenanceMessage || ''}
                        onChange={e => setAppConfigForm({ ...appConfigForm, maintenanceMessage: e.target.value })}
                        placeholder="The app is under maintenance..." />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Save */}
            <div className="sticky bottom-4 z-10">
              <button onClick={saveConfig} disabled={savingConfig}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-2xl font-bold text-lg transition-all shadow-lg shadow-emerald-200 dark:shadow-emerald-900/30 disabled:opacity-50 flex items-center justify-center gap-2">
                {savingConfig ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Saving...</> : '💾 Save All Configuration'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* ═══ PLANS MANAGEMENT ═══ */}
      {tab === 'plans' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Subscription Plans</h2>
            <button onClick={() => {
              setPlanForm({ name: '', label: '', price: '', days: '', period: '', features: 'All features included\nUnlimited cattle & records\nAI Farm Assistant\nReports & Analytics', isPopular: false, isActive: true, sortOrder: adminPlans.length });
              setEditPlanId(null);
              setPlanModal(true);
            }} className="btn-primary text-sm flex items-center gap-2"><FiPlus size={16} /> Add Plan</button>
          </div>

          {adminPlans.length === 0 ? (
            <div className="card text-center py-8 text-gray-400">
              <p className="mb-3">No plans yet. Default plans will be created when users visit the subscription page.</p>
              <button onClick={() => {
                setPlanForm({ name: 'monthly', label: 'Monthly', price: 499, days: 30, period: '/month', features: 'All features included\nUnlimited cattle & records\nAI Farm Assistant\nReports & Analytics', isPopular: false, isActive: true, sortOrder: 0 });
                setEditPlanId(null);
                setPlanModal(true);
              }} className="btn-primary text-sm"><FiPlus size={14} className="inline mr-1" /> Create First Plan</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminPlans.map(plan => (
                <div key={plan._id} className={`card !p-4 relative ${!plan.isActive ? 'opacity-60' : ''} ${plan.isPopular ? 'border-2 border-emerald-500' : ''}`}>
                  {plan.isPopular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-0.5 rounded-full">POPULAR</span>}
                  {!plan.isActive && <span className="absolute -top-3 right-3 bg-red-500 text-white text-xs font-bold px-3 py-0.5 rounded-full">INACTIVE</span>}
                  <h3 className="text-lg font-semibold mt-1">{plan.label}</h3>
                  <p className="text-xs text-gray-400 font-mono">{plan.name}</p>
                  <p className="text-2xl font-bold mt-2">{formatCurrency(plan.price)}<span className="text-sm font-normal text-gray-500">{plan.period}</span></p>
                  <p className="text-xs text-gray-400">{plan.days} days · ₹{(plan.price / plan.days).toFixed(1)}/day</p>
                  <ul className="mt-3 space-y-1 text-sm text-gray-500">
                    {plan.features?.map((f, i) => <li key={i} className="flex items-center gap-1.5"><FiCheck size={12} className="text-emerald-500" /> {f}</li>)}
                  </ul>
                  <div className="flex gap-2 mt-4">
                    <button onClick={() => {
                      setPlanForm({ name: plan.name, label: plan.label, price: plan.price, days: plan.days, period: plan.period || '', features: (plan.features || []).join('\n'), isPopular: plan.isPopular, isActive: plan.isActive, sortOrder: plan.sortOrder || 0 });
                      setEditPlanId(plan._id);
                      setPlanModal(true);
                    }} className="flex-1 btn-secondary text-xs py-1.5">✏️ Edit</button>
                    <button onClick={() => {
                      const newStatus = !plan.isActive;
                      api.put(`/admin/plans/${plan._id}`, { isActive: newStatus }).then(() => {
                        toast.success(newStatus ? 'Plan activated' : 'Plan deactivated');
                        loadTab();
                      }).catch(() => toast.error('Failed'));
                    }} className={`text-xs py-1.5 px-3 rounded-lg font-medium ${plan.isActive ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                      {plan.isActive ? '⏸ Deactivate' : '▶ Activate'}
                    </button>
                    <button onClick={() => setConfirmDialog({ open: true, title: 'Delete Plan?', message: `Delete "${plan.label}" plan permanently?`, variant: 'danger', confirmText: 'Delete', onConfirm: async () => {
                      try { await api.delete(`/admin/plans/${plan._id}`); toast.success('Plan deleted'); loadTab(); } catch { toast.error('Failed'); }
                    }})} className="text-xs py-1.5 px-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"><FiTrash2 size={14} /></button>
                  </div>
                  <p className="text-[10px] text-gray-300 mt-2">Sort order: {plan.sortOrder || 0}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Custom Plan Builder ── */}
          <div className="card mt-6">
            {/* Header row — stacks on mobile, horizontal on md+ */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">🛠️ Custom Plan Builder
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${appConfigForm.customPlanEnabled !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {appConfigForm.customPlanEnabled !== false ? 'Enabled' : 'Disabled'}
                  </span>
                </h3>
              </div>
              {/* Enable toggle + Min/Max prices */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer" title="Enable Custom Plans">
                  <input type="checkbox" checked={appConfigForm.customPlanEnabled !== false}
                    onChange={e => setAppConfigForm({ ...appConfigForm, customPlanEnabled: e.target.checked })}
                    className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">Show on pages</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-gray-500 whitespace-nowrap">Min ₹</label>
                    <input type="number" className="input w-full text-sm" placeholder="200"
                      value={appConfigForm.customPlanMinPrice || ''}
                      onChange={e => setAppConfigForm({ ...appConfigForm, customPlanMinPrice: +e.target.value })} />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-gray-500 whitespace-nowrap">Max ₹</label>
                    <input type="number" className="input w-full text-sm" placeholder="5000"
                      value={appConfigForm.customPlanMaxPrice || ''}
                      onChange={e => setAppConfigForm({ ...appConfigForm, customPlanMaxPrice: +e.target.value })} />
                  </div>
                </div>
              </div>
            </div>

            {/* Auto-generate — stacks on mobile, horizontal bar on sm+ */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl px-4 py-3 border border-indigo-200 dark:border-indigo-800 mb-5">
              <div className="flex-shrink-0">
                <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">⚡ Auto-Generate Prices</p>
                <p className="text-[10px] text-indigo-500 dark:text-indigo-400 sm:hidden">Distribute by module complexity</p>
              </div>
              <span className="text-[10px] text-indigo-500 dark:text-indigo-400 hidden sm:inline flex-shrink-0">Distribute by complexity →</span>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2 flex-1">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-indigo-500 whitespace-nowrap">Lower ₹</label>
                  <input type="number" className="input w-full sm:w-20 text-sm" placeholder="20" id="autoGenLower2" defaultValue={20} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-indigo-500 whitespace-nowrap">Upper ₹</label>
                  <input type="number" className="input w-full sm:w-20 text-sm" placeholder="80" id="autoGenUpper2" defaultValue={80} />
                </div>
              </div>
              <button type="button" onClick={() => {
                const lo = Math.min(Number(document.getElementById('autoGenLower2').value) || 20, Number(document.getElementById('autoGenUpper2').value) || 80);
                const hi = Math.max(Number(document.getElementById('autoGenLower2').value) || 20, Number(document.getElementById('autoGenUpper2').value) || 80);
                const weights = { cattle: 2.5, milk: 2.5, health: 2, breeding: 2, feed: 1.5, finance: 2, milkDelivery: 2.5, employees: 2, insurance: 1.5, reports: 2 };
                const wVals = Object.values(weights);
                const minW = Math.min(...wVals), maxW = Math.max(...wVals), range = maxW - minW || 1;
                const prices = {};
                for (const [k, w] of Object.entries(weights)) prices[k] = Math.round(lo + ((w - minW) / range) * (hi - lo));
                setAppConfigForm(prev => ({ ...prev, customPlanModulePrices: prices }));
              }} className="w-full sm:w-auto px-4 py-2 sm:py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition whitespace-nowrap">
                ⚡ Generate
              </button>
            </div>

            {/* Module Prices — horizontal 5-col grid */}
            <h4 className="font-semibold text-sm mb-3">Module Prices (₹/month)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-4">
              {[
                { id: 'cattle', name: 'Cattle', icon: '🐄' }, { id: 'milk', name: 'Milk', icon: '🥛' },
                { id: 'health', name: 'Health', icon: '💉' }, { id: 'breeding', name: 'Breeding', icon: '🐣' },
                { id: 'feed', name: 'Feed', icon: '🌾' }, { id: 'finance', name: 'Finance', icon: '💰' },
                { id: 'milkDelivery', name: 'Dudh Khata', icon: '🏘️' }, { id: 'employees', name: 'Employees', icon: '👷' },
                { id: 'insurance', name: 'Insurance', icon: '🛡️' }, { id: 'reports', name: 'Reports', icon: '📊' },
              ].map(mod => {
                const prices = appConfigForm.customPlanModulePrices || {};
                return (
                  <div key={mod.id} className="flex flex-col items-center gap-1 bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow">
                    <span className="text-2xl">{mod.icon}</span>
                    <label className="text-[11px] font-medium dark:text-gray-300 text-center">{mod.name}</label>
                    <div className="relative w-full">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">₹</span>
                      <input type="number" className="input pl-5 text-center text-sm font-semibold" placeholder="50"
                        value={prices[mod.id] || ''}
                        onChange={e => setAppConfigForm({ ...appConfigForm, customPlanModulePrices: { ...prices, [mod.id]: +e.target.value } })} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* AI chatbot price + Save — horizontal footer */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              {(() => {
                const prices = Object.values(appConfigForm.customPlanModulePrices || {}).sort((a, b) => a - b);
                const m = Math.floor(prices.length / 2);
                const median = prices.length === 0 ? 40 : prices.length % 2 === 0 ? Math.round((prices[m-1] + prices[m]) / 2) : prices[m];
                return (
                  <div className="flex items-center gap-3 bg-purple-50 dark:bg-purple-900/20 px-4 py-2.5 rounded-xl border border-purple-200 dark:border-purple-800">
                    <span className="text-xl">🤖</span>
                    <div>
                      <p className="text-xs font-medium text-purple-800 dark:text-purple-300">AI Farm Assistant</p>
                      <p className="text-[10px] text-purple-600 dark:text-purple-400">Auto-calculated median</p>
                    </div>
                    <span className="text-lg font-bold text-purple-700 dark:text-purple-300 ml-2">₹{median}/mo</span>
                  </div>
                );
              })()}
              <button onClick={async () => { setSaving(true); try { await api.put('/app-config', appConfigForm); toast.success('Custom plan settings saved!'); } catch { toast.error('Failed'); } finally { setSaving(false); } }}
                disabled={saving} className="btn-primary w-full sm:w-auto px-8 py-2.5">{saving ? 'Saving...' : '💾 Save Custom Plan Settings'}</button>
            </div>
          </div>

          {/* Plan Modal */}
          <Modal isOpen={planModal} onClose={() => setPlanModal(false)} title={editPlanId ? 'Edit Plan' : 'Create New Plan'} size="lg">
            <form onSubmit={async (e) => {
              e.preventDefault();
              setSavingPlan(true);
              try {
                const data = { ...planForm, price: Number(planForm.price), days: Number(planForm.days), sortOrder: Number(planForm.sortOrder), features: planForm.features.split('\n').map(f => f.trim()).filter(Boolean) };
                if (editPlanId) {
                  await api.put(`/admin/plans/${editPlanId}`, data);
                  toast.success('Plan updated');
                } else {
                  await api.post('/admin/plans', data);
                  toast.success('Plan created');
                }
                setPlanModal(false);
                loadTab();
              } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
              finally { setSavingPlan(false); }
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Plan ID (unique) *</label><input className="input" required value={planForm.name} onChange={e => setPlanForm({ ...planForm, name: e.target.value })} placeholder="e.g. monthly, yearly, premium_6mo" disabled={!!editPlanId} /></div>
                <div><label className="label">Display Name *</label><input className="input" required value={planForm.label} onChange={e => setPlanForm({ ...planForm, label: e.target.value })} placeholder="e.g. Monthly, Yearly" /></div>
                <div><label className="label">Price (₹) *</label><input type="number" min="1" className="input" required value={planForm.price} onChange={e => setPlanForm({ ...planForm, price: e.target.value })} placeholder="499" /></div>
                <div><label className="label">Duration (days) *</label><input type="number" min="1" className="input" required value={planForm.days} onChange={e => setPlanForm({ ...planForm, days: e.target.value })} placeholder="30" /></div>
                <div><label className="label">Period Label</label><input className="input" value={planForm.period} onChange={e => setPlanForm({ ...planForm, period: e.target.value })} placeholder="/month, /year, /6 months" /></div>
                <div><label className="label">Sort Order</label><input type="number" className="input" value={planForm.sortOrder} onChange={e => setPlanForm({ ...planForm, sortOrder: e.target.value })} /></div>
              </div>
              <div><label className="label">Features (one per line)</label><textarea className="input" rows={4} value={planForm.features} onChange={e => setPlanForm({ ...planForm, features: e.target.value })} placeholder="All features included&#10;Unlimited cattle & records" /></div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={planForm.isPopular} onChange={e => setPlanForm({ ...planForm, isPopular: e.target.checked })} className="rounded border-gray-300" /> Mark as Popular (BEST VALUE badge)</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={planForm.isActive} onChange={e => setPlanForm({ ...planForm, isActive: e.target.checked })} className="rounded border-gray-300" /> Active (visible to users)</label>
              </div>
              <div className="flex justify-end gap-3 pt-2 border-t">
                <button type="button" onClick={() => setPlanModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={savingPlan} className="btn-primary">{savingPlan ? 'Saving...' : editPlanId ? 'Update Plan' : 'Create Plan'}</button>
              </div>
            </form>
          </Modal>
        </div>
      )}

      {/* ═══ AUDIT LOGS ═══ */}
      {tab === 'logs' && (
        <div className="card p-0">
          <div className="px-4 py-3 border-b dark:border-gray-800 flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2"><FiActivity size={16} /> System Activity Logs</h3>
            <span className="text-xs text-gray-400">{auditLogs.length} entries</span>
          </div>
          {auditLogs.length === 0 ? <div className="py-8 text-center text-gray-400">No logs yet</div> : (
            <div className="divide-y dark:divide-gray-800 max-h-[600px] overflow-y-auto">
              {auditLogs.map((log, i) => (
                <div key={i} className="px-4 py-2 flex items-center justify-between text-sm hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{log.icon || '📋'}</span>
                    <div>
                      <p className="text-sm">{log.message}</p>
                      <p className="text-[10px] text-gray-400">{log.type} · Farm: {log.farmId?.toString().slice(-6) || '-'}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{formatDate(log.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ SYSTEM HEALTH ═══ */}
      {tab === 'system' && systemHealth && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center">
              <p className="text-xs text-emerald-500">Database</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 capitalize">{systemHealth.database}</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center">
              <p className="text-xs text-blue-500">Uptime</p>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{Math.floor(systemHealth.uptime / 3600)}h {Math.floor((systemHealth.uptime % 3600) / 60)}m</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center">
              <p className="text-xs text-purple-500">Memory (Heap)</p>
              <p className="text-xl font-bold text-purple-700 dark:text-purple-300">{systemHealth.memory.heap}</p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
              <p className="text-xs text-amber-500">Node.js</p>
              <p className="text-xl font-bold text-amber-700 dark:text-amber-300">{systemHealth.nodeVersion}</p>
            </div>
          </div>
          <div className="card">
            <h3 className="font-semibold text-sm mb-3">System Info</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">Environment:</span> <strong>{systemHealth.environment}</strong></div>
              <div><span className="text-gray-400">RSS Memory:</span> <strong>{systemHealth.memory.rss}</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ WEBSITE ═══ */}
      {tab === 'website' && (
        <div className="space-y-6 max-w-3xl">
          {/* Sub-tab pills */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { v: 'general', l: 'General' }, { v: 'features', l: 'Features' }, { v: 'modules', l: 'Modules' },
              { v: 'whyus', l: 'Why Us' }, { v: 'steps', l: 'Steps' }, { v: 'planfeatures', l: 'Plan Features' },
              { v: 'faqs', l: 'FAQs' }, { v: 'sections', l: 'Sections' },
            ].map(t => (
              <button key={t.v} onClick={() => setWebsiteSubTab(t.v)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${websiteSubTab === t.v ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>{t.l}</button>
            ))}
          </div>

          {/* ═══ GENERAL sub-tab ═══ */}
          {websiteSubTab === 'general' && (<>
          {/* Hero Section */}
          <div className="card">
            <h3 className="font-semibold mb-4">🏠 Hero Section</h3>
            <div className="space-y-4">
              <div><label className="label">Hero Title</label><input className="input" value={websiteForm.heroTitle || ''} onChange={e => setWebsiteForm({ ...websiteForm, heroTitle: e.target.value })} placeholder="Manage Your Dairy Farm Smarter" /></div>
              <div><label className="label">Hero Subtitle</label><textarea className="input" rows={3} value={websiteForm.heroSubtitle || ''} onChange={e => setWebsiteForm({ ...websiteForm, heroSubtitle: e.target.value })} placeholder="Track cattle, milk production, health records..." /></div>
              <div><label className="label">Badge Text</label><input className="input" value={websiteForm.heroBadge || ''} onChange={e => setWebsiteForm({ ...websiteForm, heroBadge: e.target.value })} placeholder="#1 Smart Dairy Farm Management Platform" /><p className="text-[10px] text-gray-400 mt-1">Small text shown above the hero title</p></div>
              <div><label className="label">CTA Button Text</label><input className="input" value={websiteForm.ctaText || ''} onChange={e => setWebsiteForm({ ...websiteForm, ctaText: e.target.value })} placeholder="Start Free Trial" /></div>
            </div>
          </div>
          {/* Stats */}
          <div className="card">
            <h3 className="font-semibold mb-4">📊 Stats (shown below hero)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Active Farms</label><input className="input" value={websiteForm.statsActiveFarms || ''} onChange={e => setWebsiteForm({ ...websiteForm, statsActiveFarms: e.target.value })} placeholder="500+" /></div>
              <div><label className="label">Cattle Managed</label><input className="input" value={websiteForm.statsCattleManaged || ''} onChange={e => setWebsiteForm({ ...websiteForm, statsCattleManaged: e.target.value })} placeholder="50,000+" /></div>
              <div><label className="label">Milk Records</label><input className="input" value={websiteForm.statsMilkRecords || ''} onChange={e => setWebsiteForm({ ...websiteForm, statsMilkRecords: e.target.value })} placeholder="10L+" /></div>
              <div><label className="label">Uptime</label><input className="input" value={websiteForm.statsUptime || ''} onChange={e => setWebsiteForm({ ...websiteForm, statsUptime: e.target.value })} placeholder="99.9%" /></div>
            </div>
          </div>
          {/* SEO & Branding */}
          <div className="card">
            <h3 className="font-semibold mb-4">🔍 SEO & Branding</h3>
            <div className="space-y-4">
              <div><label className="label">Meta Title</label><input className="input" value={websiteForm.metaTitle || ''} onChange={e => setWebsiteForm({ ...websiteForm, metaTitle: e.target.value })} placeholder="DairyPro - Smart Dairy Farm Management" /></div>
              <div><label className="label">Meta Description</label><textarea className="input" rows={2} value={websiteForm.metaDescription || ''} onChange={e => setWebsiteForm({ ...websiteForm, metaDescription: e.target.value })} placeholder="Track cattle, milk production, health records — all in one place." /></div>
              <div><label className="label">Footer Tagline</label><input className="input" value={websiteForm.footerTagline || ''} onChange={e => setWebsiteForm({ ...websiteForm, footerTagline: e.target.value })} placeholder="Smart dairy farm management platform built for Indian farmers." /></div>
              <div><label className="label">Copyright Text</label><input className="input" value={websiteForm.copyrightText || ''} onChange={e => setWebsiteForm({ ...websiteForm, copyrightText: e.target.value })} placeholder="© 2026 DairyPro. All rights reserved." /></div>
            </div>
          </div>
          {/* Social Links */}
          <div className="card">
            <h3 className="font-semibold mb-4">🔗 Social Links</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">WhatsApp Number</label><input className="input" value={websiteForm.whatsappNumber || ''} onChange={e => setWebsiteForm({ ...websiteForm, whatsappNumber: e.target.value })} placeholder="+919876543210" /></div>
              <div><label className="label">YouTube Channel URL</label><input className="input" value={websiteForm.youtubeUrl || ''} onChange={e => setWebsiteForm({ ...websiteForm, youtubeUrl: e.target.value })} placeholder="https://youtube.com/@dairypro" /></div>
              <div><label className="label">Facebook Page URL</label><input className="input" value={websiteForm.facebookUrl || ''} onChange={e => setWebsiteForm({ ...websiteForm, facebookUrl: e.target.value })} placeholder="https://facebook.com/dairypro" /></div>
              <div><label className="label">Instagram URL</label><input className="input" value={websiteForm.instagramUrl || ''} onChange={e => setWebsiteForm({ ...websiteForm, instagramUrl: e.target.value })} placeholder="https://instagram.com/dairypro" /></div>
              <div><label className="label">Twitter / X URL</label><input className="input" value={websiteForm.twitterUrl || ''} onChange={e => setWebsiteForm({ ...websiteForm, twitterUrl: e.target.value })} placeholder="https://x.com/dairypro" /></div>
              <div><label className="label">Play Store URL</label><input className="input" value={websiteForm.playStoreUrl || ''} onChange={e => setWebsiteForm({ ...websiteForm, playStoreUrl: e.target.value })} placeholder="https://play.google.com/store/apps/..." /></div>
            </div>
          </div>
          {/* Contact */}
          <div className="card">
            <h3 className="font-semibold mb-4">📞 Contact Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Phone</label><input className="input" value={websiteForm.supportPhone || ''} onChange={e => setWebsiteForm({ ...websiteForm, supportPhone: e.target.value })} /></div>
              <div><label className="label">Email</label><input className="input" value={websiteForm.supportEmail || ''} onChange={e => setWebsiteForm({ ...websiteForm, supportEmail: e.target.value })} /></div>
            </div>
            <div className="mt-4 space-y-4">
              <div><label className="label">Address</label><input className="input" value={websiteForm.contactAddress || ''} onChange={e => setWebsiteForm({ ...websiteForm, contactAddress: e.target.value })} /></div>
              <div><label className="label">Working Hours</label><input className="input" value={websiteForm.workingHours || ''} onChange={e => setWebsiteForm({ ...websiteForm, workingHours: e.target.value })} placeholder="Mon-Sat, 9am-6pm" /></div>
              <div><label className="label">Google Maps Embed URL</label><input className="input" value={websiteForm.mapEmbedUrl || ''} onChange={e => setWebsiteForm({ ...websiteForm, mapEmbedUrl: e.target.value })} placeholder="https://www.google.com/maps/embed?..." /><p className="text-[10px] text-gray-400 mt-1">Paste the iframe src URL from Google Maps</p></div>
            </div>
          </div>
          {/* Announcement Banner */}
          <div className="card">
            <h3 className="font-semibold mb-4">📢 Announcement Banner</h3>
            <p className="text-xs text-gray-500 mb-3">Show a banner at the top of the landing page (leave empty to hide)</p>
            <div className="space-y-4">
              <div><label className="label">Banner Text</label><input className="input" value={websiteForm.announcementText || ''} onChange={e => setWebsiteForm({ ...websiteForm, announcementText: e.target.value })} placeholder="🎉 New feature: AI Farm Assistant now supports Hindi!" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Link Text</label><input className="input" value={websiteForm.announcementLinkText || ''} onChange={e => setWebsiteForm({ ...websiteForm, announcementLinkText: e.target.value })} placeholder="Learn more →" /></div>
                <div><label className="label">Link URL</label><input className="input" value={websiteForm.announcementLinkUrl || ''} onChange={e => setWebsiteForm({ ...websiteForm, announcementLinkUrl: e.target.value })} placeholder="/register" /></div>
              </div>
            </div>
          </div>
          {/* Testimonials */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">⭐ Testimonials</h3>
              <button onClick={() => setWebsiteForm({ ...websiteForm, testimonials: [...(websiteForm.testimonials || []), { name: '', location: '', text: '', stars: 5 }] })} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-200 flex items-center gap-1"><FiPlus size={14} /> Add</button>
            </div>
            <div className="space-y-4">
              {(websiteForm.testimonials || []).map((t, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3 relative">
                  <button onClick={() => { const up = [...websiteForm.testimonials]; up.splice(i, 1); setWebsiteForm({ ...websiteForm, testimonials: up }); }} className="absolute top-3 right-3 text-red-400 hover:text-red-600"><FiTrash2 size={14} /></button>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label text-xs">Name</label><input className="input" value={t.name} onChange={e => { const up = [...websiteForm.testimonials]; up[i].name = e.target.value; setWebsiteForm({ ...websiteForm, testimonials: up }); }} /></div>
                    <div><label className="label text-xs">Location</label><input className="input" value={t.location || ''} onChange={e => { const up = [...websiteForm.testimonials]; up[i].location = e.target.value; setWebsiteForm({ ...websiteForm, testimonials: up }); }} /></div>
                  </div>
                  <div><label className="label text-xs">Review</label><textarea className="input" rows={2} value={t.text} onChange={e => { const up = [...websiteForm.testimonials]; up[i].text = e.target.value; setWebsiteForm({ ...websiteForm, testimonials: up }); }} /></div>
                  <div><label className="label text-xs">Stars (1-5)</label><input type="number" min="1" max="5" className="input w-20" value={t.stars || 5} onChange={e => { const up = [...websiteForm.testimonials]; up[i].stars = Number(e.target.value); setWebsiteForm({ ...websiteForm, testimonials: up }); }} /></div>
                </div>
              ))}
            </div>
          </div>
          </>)}

          {/* ═══ FEATURES sub-tab ═══ */}
          {websiteSubTab === 'features' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">⭐ Feature Cards</h3>
              <button onClick={() => setWebsiteForm({ ...websiteForm, features: [...(websiteForm.features || []), { icon: '', title: '', description: '', sortOrder: (websiteForm.features?.length || 0) }] })} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-200 flex items-center gap-1"><FiPlus size={14} /> Add Feature</button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Feature cards shown on the landing page. Leave empty to use defaults.</p>
            <div className="space-y-4">
              {(websiteForm.features || []).map((f, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3 relative">
                  <button onClick={() => { const up = [...websiteForm.features]; up.splice(i, 1); setWebsiteForm({ ...websiteForm, features: up }); }} className="absolute top-3 right-3 text-red-400 hover:text-red-600"><FiTrash2 size={14} /></button>
                  <div className="grid grid-cols-4 gap-3">
                    <div><label className="label text-xs">Icon (emoji)</label><input className="input" value={f.icon || ''} onChange={e => { const up = [...websiteForm.features]; up[i].icon = e.target.value; setWebsiteForm({ ...websiteForm, features: up }); }} placeholder="🐄" /></div>
                    <div className="col-span-2"><label className="label text-xs">Title</label><input className="input" value={f.title || ''} onChange={e => { const up = [...websiteForm.features]; up[i].title = e.target.value; setWebsiteForm({ ...websiteForm, features: up }); }} placeholder="Cattle Management" /></div>
                    <div><label className="label text-xs">Sort Order</label><input type="number" className="input" value={f.sortOrder || 0} onChange={e => { const up = [...websiteForm.features]; up[i].sortOrder = Number(e.target.value); setWebsiteForm({ ...websiteForm, features: up }); }} /></div>
                  </div>
                  <div><label className="label text-xs">Description</label><textarea className="input" rows={2} value={f.description || ''} onChange={e => { const up = [...websiteForm.features]; up[i].description = e.target.value; setWebsiteForm({ ...websiteForm, features: up }); }} placeholder="Track every animal..." /></div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* ═══ MODULES sub-tab ═══ */}
          {websiteSubTab === 'modules' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">📦 Module Detail Cards</h3>
              <button onClick={() => setWebsiteForm({ ...websiteForm, moduleDetails: [...(websiteForm.moduleDetails || []), { icon: '', title: '', points: [], sortOrder: (websiteForm.moduleDetails?.length || 0) }] })} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-200 flex items-center gap-1"><FiPlus size={14} /> Add Module</button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Module detail cards with bullet points. Leave empty to use defaults.</p>
            <div className="space-y-4">
              {(websiteForm.moduleDetails || []).map((m, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3 relative">
                  <button onClick={() => { const up = [...websiteForm.moduleDetails]; up.splice(i, 1); setWebsiteForm({ ...websiteForm, moduleDetails: up }); }} className="absolute top-3 right-3 text-red-400 hover:text-red-600"><FiTrash2 size={14} /></button>
                  <div className="grid grid-cols-4 gap-3">
                    <div><label className="label text-xs">Icon (emoji)</label><input className="input" value={m.icon || ''} onChange={e => { const up = [...websiteForm.moduleDetails]; up[i].icon = e.target.value; setWebsiteForm({ ...websiteForm, moduleDetails: up }); }} placeholder="🏘️" /></div>
                    <div className="col-span-2"><label className="label text-xs">Title</label><input className="input" value={m.title || ''} onChange={e => { const up = [...websiteForm.moduleDetails]; up[i].title = e.target.value; setWebsiteForm({ ...websiteForm, moduleDetails: up }); }} placeholder="Dudh Khata" /></div>
                    <div><label className="label text-xs">Sort Order</label><input type="number" className="input" value={m.sortOrder || 0} onChange={e => { const up = [...websiteForm.moduleDetails]; up[i].sortOrder = Number(e.target.value); setWebsiteForm({ ...websiteForm, moduleDetails: up }); }} /></div>
                  </div>
                  <div><label className="label text-xs">Points (one per line)</label><textarea className="input" rows={4} value={(m.points || []).join('\n')} onChange={e => { const up = [...websiteForm.moduleDetails]; up[i].points = e.target.value.split('\n'); setWebsiteForm({ ...websiteForm, moduleDetails: up }); }} placeholder="Customer-wise milk delivery ledger&#10;Daily quantity & rate tracking" /></div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* ═══ WHY US sub-tab ═══ */}
          {websiteSubTab === 'whyus' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">💚 Why Us Cards</h3>
              <button onClick={() => setWebsiteForm({ ...websiteForm, whyUsCards: [...(websiteForm.whyUsCards || []), { icon: '', title: '', description: '', sortOrder: (websiteForm.whyUsCards?.length || 0) }] })} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-200 flex items-center gap-1"><FiPlus size={14} /> Add Card</button>
            </div>
            <p className="text-xs text-gray-500 mb-3">"Why Farmers Love DairyPro" cards. Leave empty to use defaults.</p>
            <div className="space-y-4">
              {(websiteForm.whyUsCards || []).map((c, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3 relative">
                  <button onClick={() => { const up = [...websiteForm.whyUsCards]; up.splice(i, 1); setWebsiteForm({ ...websiteForm, whyUsCards: up }); }} className="absolute top-3 right-3 text-red-400 hover:text-red-600"><FiTrash2 size={14} /></button>
                  <div className="grid grid-cols-4 gap-3">
                    <div><label className="label text-xs">Icon (emoji)</label><input className="input" value={c.icon || ''} onChange={e => { const up = [...websiteForm.whyUsCards]; up[i].icon = e.target.value; setWebsiteForm({ ...websiteForm, whyUsCards: up }); }} placeholder="📱" /></div>
                    <div className="col-span-2"><label className="label text-xs">Title</label><input className="input" value={c.title || ''} onChange={e => { const up = [...websiteForm.whyUsCards]; up[i].title = e.target.value; setWebsiteForm({ ...websiteForm, whyUsCards: up }); }} placeholder="Mobile First" /></div>
                    <div><label className="label text-xs">Sort Order</label><input type="number" className="input" value={c.sortOrder || 0} onChange={e => { const up = [...websiteForm.whyUsCards]; up[i].sortOrder = Number(e.target.value); setWebsiteForm({ ...websiteForm, whyUsCards: up }); }} /></div>
                  </div>
                  <div><label className="label text-xs">Description</label><textarea className="input" rows={2} value={c.description || ''} onChange={e => { const up = [...websiteForm.whyUsCards]; up[i].description = e.target.value; setWebsiteForm({ ...websiteForm, whyUsCards: up }); }} placeholder="PWA app — install on phone like an app..." /></div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* ═══ STEPS sub-tab ═══ */}
          {websiteSubTab === 'steps' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">👣 How It Works Steps</h3>
              <button onClick={() => setWebsiteForm({ ...websiteForm, howItWorks: [...(websiteForm.howItWorks || []), { emoji: '', title: '', description: '', sortOrder: (websiteForm.howItWorks?.length || 0) }] })} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-200 flex items-center gap-1"><FiPlus size={14} /> Add Step</button>
            </div>
            <p className="text-xs text-gray-500 mb-3">"How It Works" steps. Leave empty to use defaults.</p>
            <div className="space-y-4">
              {(websiteForm.howItWorks || []).map((s, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3 relative">
                  <button onClick={() => { const up = [...websiteForm.howItWorks]; up.splice(i, 1); setWebsiteForm({ ...websiteForm, howItWorks: up }); }} className="absolute top-3 right-3 text-red-400 hover:text-red-600"><FiTrash2 size={14} /></button>
                  <div className="grid grid-cols-4 gap-3">
                    <div><label className="label text-xs">Emoji</label><input className="input" value={s.emoji || ''} onChange={e => { const up = [...websiteForm.howItWorks]; up[i].emoji = e.target.value; setWebsiteForm({ ...websiteForm, howItWorks: up }); }} placeholder="📝" /></div>
                    <div className="col-span-2"><label className="label text-xs">Title</label><input className="input" value={s.title || ''} onChange={e => { const up = [...websiteForm.howItWorks]; up[i].title = e.target.value; setWebsiteForm({ ...websiteForm, howItWorks: up }); }} placeholder="Create Account" /></div>
                    <div><label className="label text-xs">Sort Order</label><input type="number" className="input" value={s.sortOrder || 0} onChange={e => { const up = [...websiteForm.howItWorks]; up[i].sortOrder = Number(e.target.value); setWebsiteForm({ ...websiteForm, howItWorks: up }); }} /></div>
                  </div>
                  <div><label className="label text-xs">Description</label><textarea className="input" rows={2} value={s.description || ''} onChange={e => { const up = [...websiteForm.howItWorks]; up[i].description = e.target.value; setWebsiteForm({ ...websiteForm, howItWorks: up }); }} placeholder="Sign up in 30 seconds..." /></div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* ═══ PLAN FEATURES sub-tab ═══ */}
          {websiteSubTab === 'planfeatures' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">✅ Plan Feature Bullets</h3>
              <button onClick={() => setWebsiteForm({ ...websiteForm, planFeatures: [...(websiteForm.planFeatures || []), ''] })} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-200 flex items-center gap-1"><FiPlus size={14} /> Add</button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Feature bullets shown on pricing cards. Leave empty to use defaults.</p>
            <div className="space-y-3">
              {(websiteForm.planFeatures || []).map((f, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input className="input flex-1" value={f} onChange={e => { const up = [...websiteForm.planFeatures]; up[i] = e.target.value; setWebsiteForm({ ...websiteForm, planFeatures: up }); }} placeholder="All 12 modules included" />
                  <button onClick={() => { const up = [...websiteForm.planFeatures]; up.splice(i, 1); setWebsiteForm({ ...websiteForm, planFeatures: up }); }} className="text-red-400 hover:text-red-600"><FiTrash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* ═══ FAQS sub-tab ═══ */}
          {websiteSubTab === 'faqs' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">❓ FAQs</h3>
              <button onClick={() => setWebsiteForm({ ...websiteForm, faqs: [...(websiteForm.faqs || []), { q: '', a: '' }] })} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-200 flex items-center gap-1"><FiPlus size={14} /> Add FAQ</button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Custom FAQs shown on the landing page. Leave empty to use defaults.</p>
            <div className="space-y-4">
              {(websiteForm.faqs || []).map((faq, i) => (
                <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3 relative">
                  <button onClick={() => { const up = [...websiteForm.faqs]; up.splice(i, 1); setWebsiteForm({ ...websiteForm, faqs: up }); }} className="absolute top-3 right-3 text-red-400 hover:text-red-600"><FiTrash2 size={14} /></button>
                  <div><label className="label text-xs">Question</label><input className="input" value={faq.q || faq.question || ''} onChange={e => { const up = [...websiteForm.faqs]; up[i] = { ...up[i], q: e.target.value }; setWebsiteForm({ ...websiteForm, faqs: up }); }} placeholder="Is DairyPro free to try?" /></div>
                  <div><label className="label text-xs">Answer</label><textarea className="input" rows={2} value={faq.a || faq.answer || ''} onChange={e => { const up = [...websiteForm.faqs]; up[i] = { ...up[i], a: e.target.value }; setWebsiteForm({ ...websiteForm, faqs: up }); }} placeholder="Yes! You get a 5-day free trial..." /></div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* ═══ SECTIONS sub-tab ═══ */}
          {websiteSubTab === 'sections' && (
          <div className="card">
            <h3 className="font-semibold mb-4">👁️ Section Visibility</h3>
            <p className="text-xs text-gray-500 mb-4">Toggle sections on/off on the landing page.</p>
            <div className="space-y-3">
              {[
                { key: 'features', label: 'Features (12 cards)' },
                { key: 'moduleDetails', label: 'Module Details (bullet cards)' },
                { key: 'whyUs', label: 'Why Farmers Love DairyPro' },
                { key: 'customPlan', label: 'Custom Plan Builder' },
                { key: 'pricing', label: 'Pricing Cards' },
                { key: 'testimonials', label: 'Testimonials' },
                { key: 'howItWorks', label: 'How It Works Steps' },
                { key: 'downloadApp', label: 'Download App CTA' },
                { key: 'faq', label: 'FAQ Section' },
                { key: 'contact', label: 'Contact Section' },
              ].map(s => (
                <label key={s.key} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{s.label}</span>
                  <div className="relative">
                    <input type="checkbox" className="sr-only peer"
                      checked={(websiteForm.sectionVisibility || {})[s.key] !== false}
                      onChange={e => setWebsiteForm({ ...websiteForm, sectionVisibility: { ...(websiteForm.sectionVisibility || {}), [s.key]: e.target.checked } })} />
                    <div className="w-11 h-6 bg-gray-300 peer-checked:bg-emerald-500 rounded-full transition-colors"></div>
                    <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5"></div>
                  </div>
                </label>
              ))}
            </div>
          </div>
          )}

          {/* Save button — shown on all sub-tabs */}
          <button onClick={async () => {
            setSaving(true);
            try {
              // Save via /admin/landing (uses Object.assign, handles all fields)
              await api.put('/admin/landing', websiteForm);
              // Also save settings-specific fields via /admin/settings
              await api.put('/admin/settings', websiteForm);
              toast.success('Saved!');
            } catch { toast.error('Failed'); } finally { setSaving(false); }
          }} disabled={saving} className="btn-primary w-full py-3 text-lg">{saving ? 'Saving...' : '💾 Save Website Content'}</button>
        </div>
      )}

      {/* ═══ SUPPORT ═══ */}
      {tab === 'support' && (
        <div className="space-y-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[{ v: '', l: 'All' }, { v: 'open', l: '🟢 Open' }, { v: 'replied', l: '💬 Replied' }, { v: 'closed', l: '✅ Closed' }].map(f => (
              <button key={f.v} onClick={() => { setSupportStatusFilter(f.v); setSupportPage(1); }}
                className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${supportStatusFilter === f.v ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{f.l}</button>
            ))}
          </div>
          <div className="card p-0 overflow-hidden">
            {supportMessages.length === 0 ? <div className="py-8 text-center text-gray-400">No support messages</div> : (
              <div className="divide-y dark:divide-gray-800 max-h-[60vh] overflow-y-auto">
                {supportMessages.map(msg => (
                  <div key={msg._id} className="p-4 space-y-2 hover:bg-gray-50 dark:hover:bg-gray-800/30 cursor-pointer" onClick={() => { setSupportReplyModal(msg); setSupportReplyText(msg.adminReply || ''); }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-sm">{msg.subject}</p>
                        <p className="text-xs text-gray-400">{msg.name} ({msg.email})</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${msg.status === 'open' ? 'bg-green-100 text-green-700' : msg.status === 'replied' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{msg.status}</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{msg.message}</p>
                    <p className="text-[10px] text-gray-400">{formatDate(msg.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
            <Pagination page={supportPagination.page} pages={supportPagination.pages} total={supportPagination.total} onPageChange={p => setSupportPage(p)} />
          </div>

          {/* Reply Modal */}
          <Modal isOpen={!!supportReplyModal} onClose={() => setSupportReplyModal(null)} title="📩 Support Message" size="lg">
            {supportReplyModal && (
              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold">{supportReplyModal.subject}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${supportReplyModal.status === 'open' ? 'bg-green-100 text-green-700' : supportReplyModal.status === 'replied' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{supportReplyModal.status}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{supportReplyModal.message}</p>
                  <p className="text-xs text-gray-400 mt-2">From: {supportReplyModal.name} ({supportReplyModal.email}) · {formatDate(supportReplyModal.createdAt)}</p>
                </div>
                <div>
                  <label className="label">Admin Reply</label>
                  <textarea className="input" rows={4} value={supportReplyText} onChange={e => setSupportReplyText(e.target.value)} placeholder="Type your reply..." />
                </div>
                <div className="flex gap-2">
                  <button onClick={async () => {
                    try {
                      await api.put(`/admin/contact-messages/${supportReplyModal._id}`, { adminReply: supportReplyText, status: 'replied' });
                      toast.success('Reply sent'); setSupportReplyModal(null); loadTab();
                    } catch { toast.error('Failed'); }
                  }} className="btn-primary flex-1 flex items-center justify-center gap-2"><FiSend size={14} /> Reply</button>
                  <button onClick={async () => {
                    try {
                      await api.put(`/admin/contact-messages/${supportReplyModal._id}`, { status: 'closed' });
                      toast.success('Closed'); setSupportReplyModal(null); loadTab();
                    } catch { toast.error('Failed'); }
                  }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 text-sm font-medium">Close</button>
                </div>
              </div>
            )}
          </Modal>
        </div>
      )}

      {/* ═══ BROADCAST ═══ */}
      {tab === 'broadcast' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-sm mb-4">📢 Send Broadcast Notification</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Title</label>
                <input className="input" value={broadcastForm.title} onChange={e => setBroadcastForm({ ...broadcastForm, title: e.target.value })} placeholder="Notification title..." />
              </div>
              <div>
                <label className="label">Message</label>
                <textarea className="input" rows={4} value={broadcastForm.message} onChange={e => setBroadcastForm({ ...broadcastForm, message: e.target.value })} placeholder="Notification message..." />
              </div>
              <div>
                <label className="label">Severity</label>
                <select className="input" value={broadcastForm.severity} onChange={e => setBroadcastForm({ ...broadcastForm, severity: e.target.value })}>
                  <option value="info">ℹ️ Info</option>
                  <option value="warning">⚠️ Warning</option>
                  <option value="critical">🚨 Critical</option>
                </select>
              </div>
              <button onClick={async () => {
                if (!broadcastForm.title || !broadcastForm.message) return toast.error('Title and message required');
                setBroadcastSending(true);
                try {
                  const r = await api.post('/admin/notifications/broadcast', broadcastForm);
                  toast.success(r.data.message || 'Broadcast sent!');
                  setBroadcastForm({ title: '', message: '', severity: 'info' });
                } catch { toast.error('Failed to send broadcast'); }
                finally { setBroadcastSending(false); }
              }} disabled={broadcastSending} className="btn-primary w-full py-3 flex items-center justify-center gap-2">
                {broadcastSending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiSend size={16} />}
                {broadcastSending ? 'Sending...' : 'Send to All Users'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EXPORT ═══ */}
      {tab === 'export' && (
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-sm mb-4">📦 Export Platform Data</h3>
            <p className="text-sm text-gray-500 mb-4">Download all platform data including users, payments, subscriptions, and revenue summary.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={async () => {
                try {
                  toast.loading('Generating PDF...', { id: 'export' });
                  const r = await api.get('/admin/export?format=pdf', { responseType: 'blob' });
                  const blob = new Blob([r.data], { type: 'application/pdf' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `dairypro-export-${new Date().toISOString().slice(0, 10)}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success('PDF downloaded!', { id: 'export' });
                } catch { toast.error('PDF export failed', { id: 'export' }); }
              }} className="btn-primary py-3 flex items-center justify-center gap-2">
                <FiDownload size={16} /> Download PDF
              </button>
              <button onClick={async () => {
                try {
                  toast.loading('Generating CSV...', { id: 'export' });
                  const r = await api.get('/admin/export?format=csv', { responseType: 'blob' });
                  const blob = new Blob([r.data], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `dairypro-export-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success('CSV downloaded!', { id: 'export' });
                } catch { toast.error('CSV export failed', { id: 'export' }); }
              }} className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition">
                <FiDownload size={16} /> Download CSV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SETTINGS ═══ */}


      {/* Screenshot Modal */}
      <Modal isOpen={!!screenshotModal} onClose={() => setScreenshotModal(null)} title="Payment Screenshot" size="lg">
        {screenshotModal && <img src={screenshotModal} alt="Payment proof" className="w-full rounded-lg" />}
      </Modal>

      <ConfirmDialog isOpen={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText} onConfirm={confirmDialog.onConfirm} />
    </div>
  );
}
