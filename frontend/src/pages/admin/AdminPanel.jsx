import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate, formatCurrency } from '../../utils/helpers';
import Modal from '../../components/Modal';
import DataTable from '../../components/DataTable';
import ConfirmDialog from '../../components/ConfirmDialog';
import Pagination from '../../components/Pagination';
import toast from 'react-hot-toast';
import {
  FiUsers, FiHome, FiCreditCard, FiSettings, FiCheck, FiX, FiShield,
  FiPlus, FiTrash2, FiSearch, FiEye, FiArrowLeft, FiAlertTriangle,
  FiRefreshCw, FiDownload, FiServer, FiLock, FiUnlock, FiKey, FiActivity,
} from 'react-icons/fi';
import { FaIndianRupeeSign } from 'react-icons/fa6';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminPanel() {
  const [tab, setTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [settingsForm, setSettingsForm] = useState({});
  const [websiteForm, setWebsiteForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [usersPagination, setUsersPagination] = useState({});
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsPagination, setPaymentsPagination] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger', confirmText: 'Confirm' });

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
  const [auditLogs, setAuditLogs] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);

  // ─── LOAD DATA ───
  const loadTab = () => {
    setLoading(true);
    const promises = [api.get('/admin/revenue-dashboard')];
    if (tab === 'users') promises.push(api.get('/admin/users', { params: { page: usersPage, limit: 20, search: searchQuery || undefined, status: userStatusFilter || undefined } }));
    if (tab === 'payments') promises.push(api.get('/admin/payments', { params: { page: paymentsPage, limit: 20, status: paymentStatusFilter || undefined } }));
    if (tab === 'settings' || tab === 'website') promises.push(api.get('/admin/settings'));
    if (tab === 'plans') promises.push(api.get('/admin/plans'));
    if (tab === 'logs') promises.push(api.get('/admin/audit-logs'));
    if (tab === 'system') promises.push(api.get('/admin/system-health'));

    Promise.all(promises).then(results => {
      setDashboard(results[0].data.data);
      if (tab === 'users') { setUsers(results[1].data.data); setUsersPagination(results[1].data.pagination || {}); }
      if (tab === 'payments') { setPayments(results[1].data.data); setPaymentsPagination(results[1].data.pagination || {}); }
      if (tab === 'settings') { setSettings(results[1].data.data); setSettingsForm(results[1].data.data); }
      if (tab === 'plans') { setAdminPlans(results[1].data.data); }
      if (tab === 'website') { setSettings(results[1].data.data); setWebsiteForm(results[1].data.data); }
      if (tab === 'logs') { setAuditLogs(results[1].data.data); }
      if (tab === 'system') { setSystemHealth(results[1].data.data); }
    }).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  };

  useEffect(() => { loadTab(); }, [tab, usersPage, paymentsPage, paymentStatusFilter]);

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
    } catch { toast.error('Failed to load user details'); }
    finally { setDetailLoading(false); }
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

  // ─── SETTINGS ───
  const saveSettings = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await api.put('/admin/settings', settingsForm); toast.success('Settings saved'); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  if (loading && !dashboard) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>;

  // ═══════════════════════════════════════
  //  USER DETAIL VIEW
  // ═══════════════════════════════════════
  if (userDetail) {
    const u = userDetail.user;
    const sub = userDetail.subscription?.current;
    return (
      <div className="space-y-4">
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
          <div className="card p-0">
            <div className="px-4 py-3 border-b dark:border-gray-800"><h3 className="font-semibold text-sm">💳 Payments</h3></div>
            <div className="divide-y dark:divide-gray-800">
              {userDetail.payments.map(p => (
                <div key={p._id} className="px-4 py-2 flex items-center justify-between text-sm">
                  <div>
                    <span className="capitalize font-medium">{p.plan}</span>
                    <span className="text-gray-400 mx-2">·</span>
                    <span>{formatCurrency(p.amount)}</span>
                    <span className="text-gray-400 mx-2">·</span>
                    <span className="font-mono text-xs text-gray-500">{p.upiTransactionId}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${p.status === 'verified' ? 'bg-green-100 text-green-700' : p.status === 'rejected' ? 'bg-red-100 text-red-700' : p.status === 'expired' ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-700'}`}>{p.status}</span>
                    {p.screenshot && <button onClick={() => viewScreenshot(p._id)} className="text-xs text-blue-600 hover:underline">📷</button>}
                    <span className="text-xs text-gray-400">{formatDate(p.createdAt)}</span>
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
          </div>
        </div>

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
    { id: 'settings', label: '⚙️ Settings' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FiShield className="text-emerald-600" size={28} />
        <div><h1 className="text-2xl font-bold">Admin Panel</h1><p className="text-gray-500 text-sm">Full control over users, payments, subscriptions & system</p></div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${tab === t.id ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'}`}>{t.label}</button>
        ))}
      </div>

      {/* ═══ OVERVIEW ═══ */}
      {tab === 'overview' && dashboard && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 text-center"><p className="text-xs text-blue-500">Total Users</p><p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{dashboard.totalUsers}</p></div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 text-center"><p className="text-xs text-emerald-500">Active Subs</p><p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{dashboard.activeSubscriptions}</p></div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center"><p className="text-xs text-amber-500">Pending Pay</p><p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{dashboard.pendingPayments}</p></div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 text-center"><p className="text-xs text-green-500">Revenue</p><p className="text-2xl font-bold text-green-700 dark:text-green-300">{formatCurrency(dashboard.totalRevenue)}</p></div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 text-center"><p className="text-xs text-purple-500">Farms</p><p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{dashboard.totalFarms}</p></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card"><h3 className="font-semibold mb-4">Monthly Revenue</h3>
              {dashboard.monthlyRevenue?.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}><BarChart data={dashboard.monthlyRevenue}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="_id" tick={{ fontSize: 11 }} /><YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} /><Tooltip formatter={v => formatCurrency(v)} /><Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
              ) : <p className="text-gray-400 text-center py-8">No revenue data</p>}
            </div>
            <div className="card"><h3 className="font-semibold mb-4">Plan Distribution</h3>
              {dashboard.planDistribution?.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}><PieChart><Pie data={dashboard.planDistribution.map(d => ({ name: d._id, value: d.count }))} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>{dashboard.planDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
              ) : <p className="text-gray-400 text-center py-8">No data</p>}
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
          <div className="card p-0">
            {users.length === 0 ? <div className="py-8 text-center text-gray-400">No users found</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 dark:bg-gray-800/50 border-b text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2 text-left">User</th>
                    <th className="px-3 py-2 text-left">Farm</th>
                    <th className="px-3 py-2 text-center">Role</th>
                    <th className="px-3 py-2 text-center">Subscription</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2 text-left">Joined</th>
                    <th className="px-3 py-2">Actions</th>
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
                          <div className="flex gap-1">
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
            )}
            <Pagination page={usersPagination.page} pages={usersPagination.pages} total={usersPagination.total} onPageChange={p => setUsersPage(p)} />
          </div>
        </div>
      )}

      {/* ═══ PAYMENTS ═══ */}
      {tab === 'payments' && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {[{ v: '', l: 'All' }, { v: 'pending', l: '⏳ Pending' }, { v: 'verified', l: '✅ Verified' }, { v: 'rejected', l: '❌ Rejected' }, { v: 'expired', l: '⏰ Expired' }].map(f => (
              <button key={f.v} onClick={() => { setPaymentStatusFilter(f.v); setPaymentsPage(1); }}
                className={`px-3 py-2 rounded-lg text-xs font-medium ${paymentStatusFilter === f.v ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{f.l}</button>
            ))}
          </div>
          <div className="card p-0">
            {payments.length === 0 ? <div className="py-8 text-center text-gray-400">No payments</div> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 dark:bg-gray-800/50 border-b text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2 text-left">User</th>
                    <th className="px-3 py-2">Plan</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Txn ID</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Proof</th>
                    <th className="px-3 py-2">Actions</th>
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
                        <td className="px-3 py-2">{p.screenshot ? <button onClick={() => viewScreenshot(p._id)} className="text-xs text-blue-600 hover:underline">📷 View</button> : <span className="text-xs text-gray-300">—</span>}</td>
                        <td className="px-3 py-2">
                          {p.status === 'pending' && (
                            <div className="flex gap-1">
                              <button onClick={() => setConfirmDialog({ open: true, title: 'Verify?', message: 'Activate subscription for this user?', variant: 'info', confirmText: 'Verify', onConfirm: () => verifyPayment(p._id) })} className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-lg hover:bg-green-200"><FiCheck size={12} /></button>
                              <button onClick={() => setConfirmDialog({ open: true, title: 'Reject?', message: 'Reject this payment?', variant: 'danger', confirmText: 'Reject', onConfirm: () => rejectPayment(p._id) })} className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded-lg hover:bg-red-200"><FiX size={12} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={paymentsPagination.page} pages={paymentsPagination.pages} total={paymentsPagination.total} onPageChange={p => setPaymentsPage(p)} />
          </div>
        </div>
      )}

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
          <div className="card">
            <h3 className="font-semibold mb-4">🏠 Hero Section</h3>
            <div className="space-y-4">
              <div><label className="label">Hero Title</label><input className="input" value={websiteForm.heroTitle || ''} onChange={e => setWebsiteForm({ ...websiteForm, heroTitle: e.target.value })} /></div>
              <div><label className="label">Hero Subtitle</label><textarea className="input" rows={3} value={websiteForm.heroSubtitle || ''} onChange={e => setWebsiteForm({ ...websiteForm, heroSubtitle: e.target.value })} /></div>
            </div>
          </div>
          <div className="card">
            <h3 className="font-semibold mb-4">📊 Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Active Farms</label><input className="input" value={websiteForm.statsActiveFarms || ''} onChange={e => setWebsiteForm({ ...websiteForm, statsActiveFarms: e.target.value })} /></div>
              <div><label className="label">Cattle Managed</label><input className="input" value={websiteForm.statsCattleManaged || ''} onChange={e => setWebsiteForm({ ...websiteForm, statsCattleManaged: e.target.value })} /></div>
              <div><label className="label">Milk Records</label><input className="input" value={websiteForm.statsMilkRecords || ''} onChange={e => setWebsiteForm({ ...websiteForm, statsMilkRecords: e.target.value })} /></div>
              <div><label className="label">Uptime</label><input className="input" value={websiteForm.statsUptime || ''} onChange={e => setWebsiteForm({ ...websiteForm, statsUptime: e.target.value })} /></div>
            </div>
          </div>
          <div className="card">
            <h3 className="font-semibold mb-4">📞 Contact</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Phone</label><input className="input" value={websiteForm.supportPhone || ''} onChange={e => setWebsiteForm({ ...websiteForm, supportPhone: e.target.value })} /></div>
              <div><label className="label">Email</label><input className="input" value={websiteForm.supportEmail || ''} onChange={e => setWebsiteForm({ ...websiteForm, supportEmail: e.target.value })} /></div>
            </div>
            <div className="mt-4"><label className="label">Address</label><input className="input" value={websiteForm.contactAddress || ''} onChange={e => setWebsiteForm({ ...websiteForm, contactAddress: e.target.value })} /></div>
          </div>
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
                </div>
              ))}
            </div>
          </div>
          <button onClick={async () => { setSaving(true); try { await api.put('/admin/settings', websiteForm); toast.success('Saved!'); } catch { toast.error('Failed'); } finally { setSaving(false); } }} disabled={saving} className="btn-primary w-full py-3 text-lg">{saving ? 'Saving...' : '💾 Save Website Content'}</button>
        </div>
      )}

      {/* ═══ SETTINGS ═══ */}
      {tab === 'settings' && (
        <div className="card max-w-lg">
          <h3 className="font-semibold mb-4">Platform Settings</h3>
          <form onSubmit={saveSettings} className="space-y-4">
            <div><label className="label">UPI ID *</label><input className="input" required value={settingsForm.upiId || ''} onChange={e => setSettingsForm({ ...settingsForm, upiId: e.target.value })} /></div>
            <div><label className="label">UPI Name</label><input className="input" value={settingsForm.upiName || ''} onChange={e => setSettingsForm({ ...settingsForm, upiName: e.target.value })} /></div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-400">
              💡 <strong>Plan pricing</strong> is now managed from the <button onClick={() => setTab('plans')} className="underline font-semibold">📦 Plans tab</button>. Add, edit, or remove plans there.
            </div>
            <div><label className="label">Free Trial Days</label><input type="number" className="input" value={settingsForm.trialDays || ''} onChange={e => setSettingsForm({ ...settingsForm, trialDays: +e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Support Email</label><input className="input" value={settingsForm.supportEmail || ''} onChange={e => setSettingsForm({ ...settingsForm, supportEmail: e.target.value })} /></div>
              <div><label className="label">Support Phone</label><input className="input" value={settingsForm.supportPhone || ''} onChange={e => setSettingsForm({ ...settingsForm, supportPhone: e.target.value })} /></div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Settings'}</button>
          </form>
        </div>
      )}

      {/* Screenshot Modal */}
      <Modal isOpen={!!screenshotModal} onClose={() => setScreenshotModal(null)} title="Payment Screenshot" size="lg">
        {screenshotModal && <img src={screenshotModal} alt="Payment proof" className="w-full rounded-lg" />}
      </Modal>

      <ConfirmDialog isOpen={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText} onConfirm={confirmDialog.onConfirm} />
    </div>
  );
}
