import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { formatDate } from '../../utils/helpers';
import { FiUser, FiLock, FiHome, FiSave } from 'react-icons/fi';
import toast from 'react-hot-toast';

export default function Settings() {
  const { user, setUser } = useAuth();
  const [tab, setTab] = useState('profile');
  const [farm, setFarm] = useState(null);
  const [profileForm, setProfileForm] = useState({ name: '', email: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [farmForm, setFarmForm] = useState({ name: '', address: '', city: '', state: '', phone: '', description: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({ name: user.name || '', email: user.email || '', phone: user.phone || '' });
    }
  }, [user]);

  useEffect(() => {
    api.get('/farm').then(res => {
      const f = res.data.data;
      setFarm(f);
      setFarmForm({ name: f.name || '', address: f.address || '', city: f.city || '', state: f.state || '', phone: f.phone || '', description: f.description || '' });
    }).catch(() => {});
  }, []);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', profileForm);
      setUser(res.data.data);
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
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Settings ⚙️</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your profile, password & farm details</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${tab === t.id ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm ring-1 ring-emerald-200 dark:ring-emerald-800' : 'bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><FiUser /> Profile Information</h2>
          <form onSubmit={handleProfileUpdate} className="space-y-4">
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
    </div>
  );
}
