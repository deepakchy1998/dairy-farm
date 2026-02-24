import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate, formatCurrency } from '../../utils/helpers';
import Modal from '../../components/Modal';
import DataTable from '../../components/DataTable';
import { FiUsers, FiHome, FiCreditCard, FiSettings, FiCheck, FiX, FiShield, FiPlus, FiTrash2 } from 'react-icons/fi';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import Pagination from '../../components/Pagination';
import toast from 'react-hot-toast';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function AdminPanel() {
  const [tab, setTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [settingsModal, setSettingsModal] = useState(false);
  const [settingsForm, setSettingsForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [websiteForm, setWebsiteForm] = useState({});
  const [usersPage, setUsersPage] = useState(1);
  const [usersPagination, setUsersPagination] = useState({});
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [paymentsPagination, setPaymentsPagination] = useState({});

  useEffect(() => {
    setLoading(true);
    const promises = [api.get('/admin/revenue-dashboard')];
    if (tab === 'users') promises.push(api.get('/admin/users', { params: { page: usersPage, limit: 20 } }));
    if (tab === 'payments') promises.push(api.get('/admin/payments', { params: { page: paymentsPage, limit: 20 } }));
    if (tab === 'settings' || tab === 'website') promises.push(api.get('/admin/settings'));

    Promise.all(promises).then(results => {
      setDashboard(results[0].data.data);
      if (tab === 'users') { setUsers(results[1].data.data); setUsersPagination(results[1].data.pagination || {}); }
      if (tab === 'payments') { setPayments(results[1].data.data); setPaymentsPagination(results[1].data.pagination || {}); }
      if (tab === 'settings') { setSettings(results[1].data.data); setSettingsForm(results[1].data.data); }
      if (tab === 'website') { setSettings(results[1].data.data); setWebsiteForm(results[1].data.data); }
    }).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  }, [tab, usersPage, paymentsPage]);

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
      await api.put(`/admin/payments/${id}/reject`, { note });
      toast.success('Payment rejected');
      setPayments(prev => prev.map(p => p._id === id ? { ...p, status: 'rejected' } : p));
    } catch { toast.error('Failed'); }
  };

  const toggleBlock = async (userId, isBlocked) => {
    try {
      await api.put(`/admin/users/${userId}/${isBlocked ? 'unblock' : 'block'}`);
      toast.success(`User ${isBlocked ? 'unblocked' : 'blocked'}`);
      setUsers(prev => prev.map(u => u._id === userId ? { ...u, isBlocked: !isBlocked } : u));
    } catch { toast.error('Failed'); }
  };

  const saveSettings = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      const res = await api.put('/admin/settings', settingsForm);
      setSettings(res.data.data);
      toast.success('Settings saved');
      setSettingsModal(false);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div></div>;

  const tabs = [
    { id: 'overview', label: '📊 Overview', icon: FiHome },
    { id: 'users', label: '👥 Users', icon: FiUsers },
    { id: 'payments', label: '💳 Payments', icon: FiCreditCard },
    { id: 'website', label: '🌐 Website', icon: FiHome },
    { id: 'settings', label: '⚙️ Settings', icon: FiSettings },
  ];

  const paymentColumns = [
    { key: 'user', label: 'User', render: r => <div><p className="font-medium">{r.userId?.name}</p><p className="text-xs text-gray-500">{r.userId?.email}</p></div> },
    { key: 'plan', label: 'Plan', render: r => <span className="capitalize font-medium">{r.plan}</span> },
    { key: 'amount', label: 'Amount', render: r => formatCurrency(r.amount) },
    { key: 'txnId', label: 'Txn ID', render: r => <span className="font-mono text-xs">{r.upiTransactionId}</span> },
    { key: 'date', label: 'Date', render: r => formatDate(r.createdAt) },
    { key: 'status', label: 'Status', render: r => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.status === 'verified' ? 'bg-green-100 text-green-700' : r.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.status}</span> },
    { key: 'actions', label: 'Actions', render: r => r.status === 'pending' ? (
      <div className="flex gap-2">
        <button onClick={() => verifyPayment(r._id)} className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-xs font-medium hover:bg-green-200 flex items-center gap-1"><FiCheck size={14} /> Verify</button>
        <button onClick={() => rejectPayment(r._id)} className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-medium hover:bg-red-200 flex items-center gap-1"><FiX size={14} /> Reject</button>
      </div>
    ) : '-' },
  ];

  const userColumns = [
    { key: 'name', label: 'Name', render: r => <div><p className="font-medium">{r.name}</p><p className="text-xs text-gray-500">{r.email}</p></div> },
    { key: 'farm', label: 'Farm', render: r => r.farmId?.name || '-' },
    { key: 'role', label: 'Role', render: r => <span className="capitalize">{r.role}</span> },
    { key: 'joined', label: 'Joined', render: r => formatDate(r.createdAt) },
    { key: 'status', label: 'Status', render: r => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.isBlocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{r.isBlocked ? 'Blocked' : 'Active'}</span> },
    { key: 'actions', label: '', render: r => r.role !== 'admin' && (
      <button onClick={() => toggleBlock(r._id, r.isBlocked)} className={`text-xs px-3 py-1 rounded-lg font-medium ${r.isBlocked ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}>
        {r.isBlocked ? 'Unblock' : 'Block'}
      </button>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FiShield className="text-emerald-600" size={28} />
        <div><h1 className="text-2xl font-bold">Admin Panel</h1><p className="text-gray-500 text-sm">Manage users, payments & settings</p></div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.id ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{t.label}</button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && dashboard && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="stat-card"><div><p className="text-xs text-gray-500">Total Users</p><p className="text-2xl font-bold">{dashboard.totalUsers}</p></div></div>
            <div className="stat-card"><div><p className="text-xs text-gray-500">Total Farms</p><p className="text-2xl font-bold">{dashboard.totalFarms}</p></div></div>
            <div className="stat-card"><div><p className="text-xs text-gray-500">Active Subscriptions</p><p className="text-2xl font-bold text-emerald-600">{dashboard.activeSubscriptions}</p></div></div>
            <div className="stat-card"><div><p className="text-xs text-gray-500">Pending Payments</p><p className="text-2xl font-bold text-yellow-600">{dashboard.pendingPayments}</p></div></div>
            <div className="stat-card"><div><p className="text-xs text-gray-500">Total Revenue</p><p className="text-2xl font-bold text-green-600">{formatCurrency(dashboard.totalRevenue)}</p></div></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-semibold mb-4">Monthly Revenue</h3>
              {dashboard.monthlyRevenue?.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dashboard.monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => formatCurrency(v)} />
                    <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-center py-8">No revenue data yet</p>}
            </div>
            <div className="card">
              <h3 className="font-semibold mb-4">Plan Distribution</h3>
              {dashboard.planDistribution?.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={dashboard.planDistribution.map(d => ({ name: d._id, value: d.count }))} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                      {dashboard.planDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-gray-400 text-center py-8">No subscription data</p>}
            </div>
          </div>
        </div>
      )}

      {/* Users */}
      {tab === 'users' && (
        <div className="card p-0">
          <DataTable columns={userColumns} data={users} emptyMessage="No users yet" />
          <Pagination page={usersPagination.page} pages={usersPagination.pages} total={usersPagination.total} onPageChange={p => setUsersPage(p)} />
        </div>
      )}

      {/* Payments */}
      {tab === 'payments' && (
        <div className="card p-0">
          <DataTable columns={paymentColumns} data={payments} emptyMessage="No payments yet" />
          <Pagination page={paymentsPagination.page} pages={paymentsPagination.pages} total={paymentsPagination.total} onPageChange={p => setPaymentsPage(p)} />
        </div>
      )}

      {/* Website Content */}
      {tab === 'website' && (
        <div className="space-y-6 max-w-3xl">
          <div className="card">
            <h3 className="font-semibold mb-4">🏠 Hero Section</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Hero Title</label>
                <input className="input" value={websiteForm.heroTitle || ''} onChange={e => setWebsiteForm({ ...websiteForm, heroTitle: e.target.value })} placeholder="Manage Your Dairy Farm Smarter" />
              </div>
              <div>
                <label className="label">Hero Subtitle</label>
                <textarea className="input" rows={3} value={websiteForm.heroSubtitle || ''} onChange={e => setWebsiteForm({ ...websiteForm, heroSubtitle: e.target.value })} placeholder="Track cattle, milk production..." />
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-4">📊 Stats (shown on hero)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Active Farms</label><input className="input" value={websiteForm.statsActiveFarms || ''} onChange={e => setWebsiteForm({ ...websiteForm, statsActiveFarms: e.target.value })} placeholder="500+" /></div>
              <div><label className="label">Cattle Managed</label><input className="input" value={websiteForm.statsCattleManaged || ''} onChange={e => setWebsiteForm({ ...websiteForm, statsCattleManaged: e.target.value })} placeholder="50,000+" /></div>
              <div><label className="label">Milk Records</label><input className="input" value={websiteForm.statsMilkRecords || ''} onChange={e => setWebsiteForm({ ...websiteForm, statsMilkRecords: e.target.value })} placeholder="10L+" /></div>
              <div><label className="label">Uptime</label><input className="input" value={websiteForm.statsUptime || ''} onChange={e => setWebsiteForm({ ...websiteForm, statsUptime: e.target.value })} placeholder="99.9%" /></div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-4">📞 Contact Info</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Phone</label><input className="input" value={websiteForm.supportPhone || ''} onChange={e => setWebsiteForm({ ...websiteForm, supportPhone: e.target.value })} placeholder="+91 98765 43210" /></div>
              <div><label className="label">Email</label><input className="input" value={websiteForm.supportEmail || ''} onChange={e => setWebsiteForm({ ...websiteForm, supportEmail: e.target.value })} placeholder="support@dairypro.in" /></div>
            </div>
            <div className="mt-4"><label className="label">Address</label><input className="input" value={websiteForm.contactAddress || ''} onChange={e => setWebsiteForm({ ...websiteForm, contactAddress: e.target.value })} placeholder="Punjab, India" /></div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">⭐ Testimonials</h3>
              <button onClick={() => setWebsiteForm({ ...websiteForm, testimonials: [...(websiteForm.testimonials || []), { name: '', location: '', text: '', stars: 5 }] })} className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-200 flex items-center gap-1">
                <FiPlus size={14} /> Add
              </button>
            </div>
            <div className="space-y-4">
              {(websiteForm.testimonials || []).map((t, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-4 space-y-3 relative">
                  <button onClick={() => {
                    const updated = [...websiteForm.testimonials];
                    updated.splice(i, 1);
                    setWebsiteForm({ ...websiteForm, testimonials: updated });
                  }} className="absolute top-3 right-3 text-red-400 hover:text-red-600"><FiTrash2 size={14} /></button>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label text-xs">Name</label><input className="input" value={t.name} onChange={e => {
                      const updated = [...websiteForm.testimonials]; updated[i].name = e.target.value; setWebsiteForm({ ...websiteForm, testimonials: updated });
                    }} placeholder="Customer name" /></div>
                    <div><label className="label text-xs">Location</label><input className="input" value={t.location || ''} onChange={e => {
                      const updated = [...websiteForm.testimonials]; updated[i].location = e.target.value; setWebsiteForm({ ...websiteForm, testimonials: updated });
                    }} placeholder="City, State" /></div>
                  </div>
                  <div><label className="label text-xs">Review</label><textarea className="input" rows={2} value={t.text} onChange={e => {
                    const updated = [...websiteForm.testimonials]; updated[i].text = e.target.value; setWebsiteForm({ ...websiteForm, testimonials: updated });
                  }} placeholder="What do they say about DairyPro?" /></div>
                  <div><label className="label text-xs">Stars (1-5)</label><input type="number" min="1" max="5" className="input w-20" value={t.stars} onChange={e => {
                    const updated = [...websiteForm.testimonials]; updated[i].stars = +e.target.value; setWebsiteForm({ ...websiteForm, testimonials: updated });
                  }} /></div>
                </div>
              ))}
              {(!websiteForm.testimonials || websiteForm.testimonials.length === 0) && <p className="text-sm text-gray-400 text-center py-4">No testimonials yet. Click "Add" to create one.</p>}
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-4">💰 Pricing (also in Settings)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Monthly (₹)</label><input type="number" className="input" value={websiteForm.monthlyPrice || ''} onChange={e => setWebsiteForm({ ...websiteForm, monthlyPrice: +e.target.value })} /></div>
              <div><label className="label">Quarterly (₹)</label><input type="number" className="input" value={websiteForm.quarterlyPrice || ''} onChange={e => setWebsiteForm({ ...websiteForm, quarterlyPrice: +e.target.value })} /></div>
              <div><label className="label">Half Yearly (₹)</label><input type="number" className="input" value={websiteForm.halfyearlyPrice || ''} onChange={e => setWebsiteForm({ ...websiteForm, halfyearlyPrice: +e.target.value })} /></div>
              <div><label className="label">Yearly (₹)</label><input type="number" className="input" value={websiteForm.yearlyPrice || ''} onChange={e => setWebsiteForm({ ...websiteForm, yearlyPrice: +e.target.value })} /></div>
            </div>
            <div className="mt-4"><label className="label">Free Trial Days</label><input type="number" className="input w-32" value={websiteForm.trialDays || ''} onChange={e => setWebsiteForm({ ...websiteForm, trialDays: +e.target.value })} /></div>
          </div>

          <button onClick={async () => {
            setSaving(true);
            try {
              await api.put('/admin/settings', websiteForm);
              toast.success('Website content saved!');
            } catch (err) { toast.error('Failed to save'); }
            finally { setSaving(false); }
          }} disabled={saving} className="btn-primary w-full py-3 text-lg">
            {saving ? 'Saving...' : '💾 Save All Website Content'}
          </button>
        </div>
      )}

      {/* Settings */}
      {tab === 'settings' && (
        <div className="card max-w-lg">
          <h3 className="font-semibold mb-4">Platform Settings</h3>
          <form onSubmit={saveSettings} className="space-y-4">
            <div><label className="label">UPI ID *</label><input className="input" required value={settingsForm.upiId || ''} onChange={e => setSettingsForm({ ...settingsForm, upiId: e.target.value })} placeholder="yourname@upi" /></div>
            <div><label className="label">UPI Name</label><input className="input" value={settingsForm.upiName || ''} onChange={e => setSettingsForm({ ...settingsForm, upiName: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label">Monthly (₹)</label><input type="number" className="input" value={settingsForm.monthlyPrice || ''} onChange={e => setSettingsForm({ ...settingsForm, monthlyPrice: +e.target.value })} /></div>
              <div><label className="label">Quarterly (₹)</label><input type="number" className="input" value={settingsForm.quarterlyPrice || ''} onChange={e => setSettingsForm({ ...settingsForm, quarterlyPrice: +e.target.value })} /></div>
              <div><label className="label">Half Yearly (₹)</label><input type="number" className="input" value={settingsForm.halfyearlyPrice || ''} onChange={e => setSettingsForm({ ...settingsForm, halfyearlyPrice: +e.target.value })} /></div>
              <div><label className="label">Yearly (₹)</label><input type="number" className="input" value={settingsForm.yearlyPrice || ''} onChange={e => setSettingsForm({ ...settingsForm, yearlyPrice: +e.target.value })} /></div>
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
    </div>
  );
}
