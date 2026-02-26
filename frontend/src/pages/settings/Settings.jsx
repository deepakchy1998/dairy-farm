import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { formatDate } from '../../utils/helpers';
import { FiUser, FiLock, FiHome, FiSave, FiDownload, FiCamera, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user, setUser } = useAuth();
  const [tab, setTab] = useState('profile');
  const [farm, setFarm] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [farmForm, setFarmForm] = useState({ name: '', address: '', city: '', state: '', phone: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState('');

  useEffect(() => {
    if (user) {
      setProfileForm({ name: user.name || '', email: user.email || '', phone: user.phone || '', farmEnabled: user.farmEnabled !== false, chatBubbleEnabled: user.chatBubbleEnabled !== false });
      setPhotoPreview(user.profilePhoto || '');
    }
  }, [user]);

  useEffect(() => {
    api.get('/farm').then(res => {
      const f = res.data.data;
      setFarm(f);
      setFarmForm({ name: f.name || '', address: f.address || '', city: f.city || '', state: f.state || '', phone: f.phone || '', description: f.description || '' });
    }).catch(() => {});
  }, []);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Photo must be under 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => setPhotoPreview('');

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...profileForm, profilePhoto: photoPreview, farmEnabled: profileForm.farmEnabled !== false, chatBubbleEnabled: profileForm.chatBubbleEnabled !== false };
      const res = await api.put('/auth/profile', payload);
      setUser(res.data.data);
      localStorage.setItem('user', JSON.stringify(res.data.data));
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally { setSaving(false); }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return toast.error('New passwords do not match');
    }
    if (passwordForm.newPassword.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    setSaving(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success('Password changed successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally { setSaving(false); }
  };

  const handleFarmUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/farm', farmForm);
      setFarm(res.data.data);
      toast.success('Farm details updated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update farm');
    } finally { setSaving(false); }
  };

  const tabs = [
    { id: 'profile', label: '👤 Profile', icon: FiUser },
    { id: 'password', label: '🔒 Password', icon: FiLock },
    { id: 'farm', label: '🏠 Farm Details', icon: FiHome },
    { id: 'backup', label: '💾 Backup', icon: FiDownload },
  ];

  return (
    <div className="space-y-6 max-w-2xl w-full overflow-hidden">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings ⚙️</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your profile, password & farm details</p>
      </div>

      {/* Tabs — all 4 in one row */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap flex-shrink-0 ${tab === t.id ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-200 dark:ring-emerald-800' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><FiUser /> Profile Information</h2>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            {/* Profile Photo */}
            <div className="flex items-center gap-5">
              <div className="relative group">
                {photoPreview ? (
                  <img src={photoPreview} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-emerald-200 dark:border-emerald-800" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <FiUser size={32} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                )}
                <label className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer">
                  <FiCamera size={20} className="text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                </label>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Profile Photo</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">JPG, PNG under 2MB</p>
                <div className="flex gap-2">
                  <label className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer font-medium">
                    Upload
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </label>
                  {photoPreview && (
                    <button type="button" onClick={handleRemovePhoto} className="text-xs text-red-500 hover:underline font-medium flex items-center gap-1">
                      <FiTrash2 size={12} /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="label">Full Name</label>
              <input className="input" required value={profileForm.name}
                onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} />
            </div>
            <div>
              <label className="label">Email Address</label>
              <input type="email" className="input" required value={profileForm.email}
                onChange={e => setProfileForm({ ...profileForm, email: e.target.value })} />
              <p className="text-xs text-gray-400 mt-1">This is your login email</p>
            </div>
            <div>
              <label className="label">Phone Number</label>
              <input className="input" value={profileForm.phone}
                onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                placeholder="+91 98765 43210" />
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-sm text-gray-500 dark:text-gray-400">
              <p><strong>Role:</strong> <span className="capitalize">{user?.role}</span></p>
              <p><strong>Member since:</strong> {formatDate(user?.createdAt)}</p>
            </div>

            {/* Chatbot Bubble Toggle — All users */}
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-2">🤖 Chatbot Bubble</h4>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {profileForm.chatBubbleEnabled !== false
                      ? 'Floating AI chatbot bubble is shown on all pages'
                      : 'Chatbot bubble is hidden — you can still access it from the sidebar'}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={profileForm.chatBubbleEnabled !== false}
                    onChange={e => setProfileForm({ ...profileForm, chatBubbleEnabled: e.target.checked })}
                    className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            </div>

            {/* Personal Farm Toggle — Admin only */}
            {user?.role === 'admin' && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-sm text-blue-800 dark:text-blue-300 flex items-center gap-2">🐄 Personal Dairy Farm</h4>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                      {profileForm.farmEnabled !== false
                        ? 'Farm modules are visible in your sidebar (cattle, milk, health, etc.)'
                        : 'Farm modules are hidden — only admin panel and settings are visible'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={profileForm.farmEnabled !== false}
                      onChange={e => setProfileForm({ ...profileForm, farmEnabled: e.target.checked })}
                      className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                  </label>
                </div>
              </div>
            )}

            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              <FiSave size={16} /> {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      )}

      {/* Password Tab */}
      {tab === 'password' && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><FiLock /> Change Password</h2>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="label">Current Password</label>
              <input type="password" className="input" required value={passwordForm.currentPassword}
                onChange={e => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                placeholder="Enter current password" />
            </div>
            <div>
              <label className="label">New Password</label>
              <input type="password" className="input" required minLength={6} value={passwordForm.newPassword}
                onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder="Min 6 characters" />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input type="password" className="input" required minLength={6} value={passwordForm.confirmPassword}
                onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                placeholder="Re-enter new password" />
            </div>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              <FiLock size={16} /> {saving ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>
      )}

      {/* Farm Tab */}
      {tab === 'farm' && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><FiHome /> Farm Details</h2>
          <form onSubmit={handleFarmUpdate} className="space-y-4">
            <div>
              <label className="label">Farm Name</label>
              <input className="input" required value={farmForm.name}
                onChange={e => setFarmForm({ ...farmForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">City</label>
                <input className="input" value={farmForm.city}
                  onChange={e => setFarmForm({ ...farmForm, city: e.target.value })} />
              </div>
              <div>
                <label className="label">State</label>
                <input className="input" value={farmForm.state}
                  onChange={e => setFarmForm({ ...farmForm, state: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label">Address</label>
              <input className="input" value={farmForm.address}
                onChange={e => setFarmForm({ ...farmForm, address: e.target.value })} />
            </div>
            <div>
              <label className="label">Farm Phone</label>
              <input className="input" value={farmForm.phone}
                onChange={e => setFarmForm({ ...farmForm, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={3} value={farmForm.description}
                onChange={e => setFarmForm({ ...farmForm, description: e.target.value })}
                placeholder="Tell us about your farm..." />
            </div>
            {farm && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-sm text-gray-500 dark:text-gray-400">
                <p><strong>Total Cattle:</strong> {farm.totalCattle}</p>
                <p><strong>Farm ID:</strong> <span className="font-mono text-xs">{farm._id}</span></p>
              </div>
            )}
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              <FiSave size={16} /> {saving ? 'Saving...' : 'Save Farm Details'}
            </button>
          </form>
        </div>
      )}
      {/* Backup Tab */}
      {tab === 'backup' && (
        <div className="card space-y-6 overflow-hidden">
          <div>
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">💾 Farm Data Backup</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Download a complete backup of all your farm data. Choose PDF for a printable report or CSV for spreadsheet use.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* PDF Export */}
              <button onClick={async () => {
                try {
                  toast.loading('Generating PDF...');
                  const res = await api.get('/farm/export');
                  const d = res.data;
                  const cattle = d.cattle || [];
                  const milkRecords = d.milkRecords || [];
                  const healthRecords = d.healthRecords || [];
                  const expenses = d.expenses || [];
                  const revenues = d.revenues || [];
                  const breedingRecords = d.breedingRecords || [];
                  const insurances = d.insurances || [];

                  const cattleRows = cattle.map(c => `<tr><td>${c.tagNumber}</td><td>${c.breed}</td><td>${c.category}</td><td>${c.gender}</td><td>${c.status}</td><td>${c.weight || '-'}</td></tr>`).join('');
                  const milkRows = milkRecords.slice(-50).map(m => `<tr><td>${new Date(m.date).toLocaleDateString('en-IN')}</td><td>${m.cattleId}</td><td>${m.morningYield || 0}</td><td>${m.afternoonYield || 0}</td><td>${m.eveningYield || 0}</td><td><strong>${m.totalYield || 0}</strong></td></tr>`).join('');
                  const healthRows = healthRecords.slice(-30).map(h => `<tr><td>${new Date(h.date).toLocaleDateString('en-IN')}</td><td>${h.cattleId}</td><td>${h.type}</td><td>${h.description}</td><td>₹${h.cost || 0}</td></tr>`).join('');
                  const expenseRows = expenses.slice(-30).map(e => `<tr><td>${new Date(e.date).toLocaleDateString('en-IN')}</td><td>${e.category}</td><td>${e.description || '-'}</td><td>₹${e.amount?.toLocaleString('en-IN')}</td></tr>`).join('');
                  const revenueRows = revenues.slice(-30).map(r => `<tr><td>${new Date(r.date).toLocaleDateString('en-IN')}</td><td>${r.category?.replace('_',' ')}</td><td>${r.description || '-'}</td><td>₹${r.amount?.toLocaleString('en-IN')}</td></tr>`).join('');
                  const insuranceRows = insurances.map(i => `<tr><td>${i.cattleId}</td><td>${i.provider}</td><td>${i.policyNumber}</td><td>₹${i.sumInsured?.toLocaleString('en-IN')}</td><td>${i.status}</td><td>${new Date(i.endDate).toLocaleDateString('en-IN')}</td></tr>`).join('');

                  const totalExpense = expenses.reduce((s, e) => s + (e.amount || 0), 0);
                  const totalRevenue = revenues.reduce((s, r) => s + (r.amount || 0), 0);
                  const totalMilk = milkRecords.reduce((s, m) => s + (m.totalYield || 0), 0);

                  const html = `<!DOCTYPE html><html><head><title>DairyPro Farm Backup</title><style>
                    body{font-family:'Segoe UI',Arial,sans-serif;padding:30px;color:#333;font-size:12px}
                    h1{color:#059669;margin-bottom:5px;font-size:22px} h2{color:#065f46;margin-top:25px;border-bottom:2px solid #d1fae5;padding-bottom:5px;font-size:16px}
                    .header{border-bottom:3px solid #059669;padding-bottom:15px;margin-bottom:20px}
                    .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:15px 0}
                    .stat{background:#ecfdf5;border-radius:10px;padding:15px;text-align:center}
                    .stat .num{font-size:22px;font-weight:700;color:#059669} .stat .lbl{font-size:10px;color:#666;margin-top:3px}
                    table{width:100%;border-collapse:collapse;margin:8px 0;font-size:11px}
                    th{background:#ecfdf5;color:#065f46;padding:8px;text-align:left;font-weight:600}
                    td{padding:8px;border-bottom:1px solid #e5e7eb}
                    tr:nth-child(even){background:#fafafa}
                    .footer{text-align:center;color:#999;font-size:10px;margin-top:30px;border-top:1px solid #e5e7eb;padding-top:10px}
                    @media print{body{padding:15px;font-size:10px} .stat .num{font-size:18px} table{font-size:9px}}
                  </style></head><body>
                  <div class="header">
                    <h1>🐄 DairyPro — Complete Farm Backup</h1>
                    <p style="color:#666">Farm: ${d.farm?.name || 'My Farm'} | Exported: ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })}</p>
                  </div>
                  <div class="stats">
                    <div class="stat"><div class="num">${cattle.length}</div><div class="lbl">Total Cattle</div></div>
                    <div class="stat"><div class="num">${totalMilk.toFixed(0)}L</div><div class="lbl">Total Milk</div></div>
                    <div class="stat"><div class="num">₹${totalRevenue.toLocaleString('en-IN')}</div><div class="lbl">Total Revenue</div></div>
                    <div class="stat"><div class="num">₹${totalExpense.toLocaleString('en-IN')}</div><div class="lbl">Total Expense</div></div>
                  </div>
                  <h2>🐄 Cattle (${cattle.length})</h2>
                  <table><tr><th>Tag</th><th>Breed</th><th>Category</th><th>Gender</th><th>Status</th><th>Weight</th></tr>${cattleRows || '<tr><td colspan="6">No cattle</td></tr>'}</table>
                  <h2>🥛 Milk Records (last 50 of ${milkRecords.length})</h2>
                  <table><tr><th>Date</th><th>Cattle</th><th>Morning</th><th>Afternoon</th><th>Evening</th><th>Total</th></tr>${milkRows || '<tr><td colspan="6">No records</td></tr>'}</table>
                  <h2>💉 Health Records (last 30 of ${healthRecords.length})</h2>
                  <table><tr><th>Date</th><th>Cattle</th><th>Type</th><th>Description</th><th>Cost</th></tr>${healthRows || '<tr><td colspan="5">No records</td></tr>'}</table>
                  <h2>💰 Expenses (last 30 of ${expenses.length})</h2>
                  <table><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr>${expenseRows || '<tr><td colspan="4">No expenses</td></tr>'}</table>
                  <h2>📈 Revenue (last 30 of ${revenues.length})</h2>
                  <table><tr><th>Date</th><th>Category</th><th>Description</th><th>Amount</th></tr>${revenueRows || '<tr><td colspan="4">No revenue</td></tr>'}</table>
                  ${insurances.length ? `<h2>🛡️ Insurance (${insurances.length})</h2><table><tr><th>Cattle</th><th>Provider</th><th>Policy #</th><th>Insured</th><th>Status</th><th>Expires</th></tr>${insuranceRows}</table>` : ''}
                  <div class="footer">DairyPro — Smart Dairy Farm Management • Backup generated automatically</div>
                  </body></html>`;
                  const w = window.open('', '_blank');
                  w.document.write(html);
                  w.document.close();
                  setTimeout(() => { w.print(); }, 500);
                  toast.dismiss();
                  toast.success('PDF ready — use Print dialog to save');
                } catch { toast.dismiss(); toast.error('Failed to generate PDF'); }
              }} className="btn-primary flex items-center gap-2 justify-center py-3">
                <FiDownload size={16} /> 📄 Download PDF
              </button>

              {/* CSV Export */}
              <button onClick={async () => {
                try {
                  toast.loading('Generating CSV...');
                  const res = await api.get('/farm/export');
                  const d = res.data;

                  const sections = [];

                  // Cattle CSV
                  if (d.cattle?.length) {
                    sections.push('=== CATTLE ===');
                    sections.push('Tag,Breed,Category,Gender,Status,Weight,DOB,Purchase Price');
                    d.cattle.forEach(c => sections.push(`"${c.tagNumber}","${c.breed}","${c.category}","${c.gender}","${c.status}","${c.weight || ''}","${c.dateOfBirth ? new Date(c.dateOfBirth).toLocaleDateString('en-IN') : ''}","${c.purchasePrice || ''}"`));
                  }

                  // Milk CSV
                  if (d.milkRecords?.length) {
                    sections.push('');
                    sections.push('=== MILK RECORDS ===');
                    sections.push('Date,Cattle ID,Morning,Afternoon,Evening,Total');
                    d.milkRecords.forEach(m => sections.push(`"${new Date(m.date).toLocaleDateString('en-IN')}","${m.cattleId}","${m.morningYield || 0}","${m.afternoonYield || 0}","${m.eveningYield || 0}","${m.totalYield || 0}"`));
                  }

                  // Health CSV
                  if (d.healthRecords?.length) {
                    sections.push('');
                    sections.push('=== HEALTH RECORDS ===');
                    sections.push('Date,Cattle ID,Type,Description,Medicine,Cost,Next Due');
                    d.healthRecords.forEach(h => sections.push(`"${new Date(h.date).toLocaleDateString('en-IN')}","${h.cattleId}","${h.type}","${h.description}","${h.medicine || ''}","${h.cost || 0}","${h.nextDueDate ? new Date(h.nextDueDate).toLocaleDateString('en-IN') : ''}"`));
                  }

                  // Expenses CSV
                  if (d.expenses?.length) {
                    sections.push('');
                    sections.push('=== EXPENSES ===');
                    sections.push('Date,Category,Description,Amount');
                    d.expenses.forEach(e => sections.push(`"${new Date(e.date).toLocaleDateString('en-IN')}","${e.category}","${e.description || ''}","${e.amount}"`));
                  }

                  // Revenue CSV
                  if (d.revenues?.length) {
                    sections.push('');
                    sections.push('=== REVENUE ===');
                    sections.push('Date,Category,Description,Amount');
                    d.revenues.forEach(r => sections.push(`"${new Date(r.date).toLocaleDateString('en-IN')}","${r.category}","${r.description || ''}","${r.amount}"`));
                  }

                  // Insurance CSV
                  if (d.insurances?.length) {
                    sections.push('');
                    sections.push('=== INSURANCE ===');
                    sections.push('Cattle ID,Provider,Policy Number,Sum Insured,Premium,Start,End,Status');
                    d.insurances.forEach(i => sections.push(`"${i.cattleId}","${i.provider}","${i.policyNumber}","${i.sumInsured}","${i.premium}","${new Date(i.startDate).toLocaleDateString('en-IN')}","${new Date(i.endDate).toLocaleDateString('en-IN')}","${i.status}"`));
                  }

                  const csv = '\ufeff' + sections.join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `dairypro-backup-${new Date().toISOString().split('T')[0]}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.dismiss();
                  toast.success('CSV downloaded!');
                } catch { toast.dismiss(); toast.error('Failed to generate CSV'); }
              }} className="btn-secondary flex items-center gap-2 justify-center py-3">
                <FiDownload size={16} /> 📊 Download CSV
              </button>
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">What's included:</h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>✅ All cattle records & weight history</li>
              <li>✅ All milk production records</li>
              <li>✅ Health & vaccination records</li>
              <li>✅ Breeding records</li>
              <li>✅ Feed records</li>
              <li>✅ All financial data (expenses & revenue)</li>
              <li>✅ Insurance policies</li>
              <li>✅ Farm details</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
