import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate, formatCurrency } from '../../utils/helpers';
import Modal from '../../components/Modal';
import Pagination from '../../components/Pagination';
import { FiPlus, FiEdit2, FiTrash2, FiShield, FiAlertTriangle } from 'react-icons/fi';
import ConfirmDialog from '../../components/ConfirmDialog';
import toast from 'react-hot-toast';

export default function Insurance() {
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [cattle, setCattle] = useState([]);
  const [filters, setFilters] = useState({ status: '', page: 1 });
  const [form, setForm] = useState({
    cattleId: '', provider: '', policyNumber: '', sumInsured: '', premium: '',
    startDate: '', endDate: '', status: 'active', govtScheme: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger', confirmText: 'Confirm' });

  const fetchRecords = () => {
    setLoading(true);
    const params = { page: filters.page, limit: 15 };
    if (filters.status) params.status = filters.status;
    api.get('/insurance', { params })
      .then(r => { setRecords(r.data.data || []); setPagination(r.data.pagination || {}); })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRecords(); }, [filters]);
  useEffect(() => {
    api.get('/cattle', { params: { limit: 500, status: 'active' } })
      .then(r => setCattle(r.data.data || []))
      .catch(() => {});
  }, []);

  const openAdd = () => {
    setForm({ cattleId: '', provider: '', policyNumber: '', sumInsured: '', premium: '', startDate: '', endDate: '', status: 'active', govtScheme: '', notes: '' });
    setEditId(null);
    setModal(true);
  };

  const openEdit = (r) => {
    setForm({
      cattleId: r.cattleId?._id || r.cattleId, provider: r.provider, policyNumber: r.policyNumber,
      sumInsured: r.sumInsured, premium: r.premium, startDate: r.startDate?.slice(0, 10),
      endDate: r.endDate?.slice(0, 10), status: r.status, govtScheme: r.govtScheme || '', notes: r.notes || '',
    });
    setEditId(r._id);
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/insurance/${editId}`, form);
        toast.success('Updated');
      } else {
        await api.post('/insurance', form);
        toast.success('Insurance added');
      }
      setModal(false);
      fetchRecords();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    setConfirmDialog({ open: true, title: 'Delete Insurance?', message: 'This will permanently delete this insurance record.', variant: 'danger', confirmText: 'Delete', onConfirm: async () => {
      try { await api.delete(`/insurance/${id}`); toast.success('Deleted'); fetchRecords(); }
      catch { toast.error('Failed'); }
    }});
  };

  // Stats
  const activeCount = records.filter(r => r.status === 'active').length;
  const totalInsured = records.filter(r => r.status === 'active').reduce((s, r) => s + (r.sumInsured || 0), 0);
  const expiringSoon = records.filter(r => {
    if (r.status !== 'active') return false;
    const daysLeft = Math.ceil((new Date(r.endDate) - new Date()) / 86400000);
    return daysLeft <= 30 && daysLeft > 0;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">🛡️ Insurance</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">Track cattle insurance policies & claims</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2"><FiPlus size={18} /> Add Policy</button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
          <p className="text-xs text-emerald-500">Active Policies</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{activeCount}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
          <p className="text-xs text-blue-500">Total Insured</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(totalInsured)}</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 text-center">
          <p className="text-xs text-orange-500">Expiring Soon</p>
          <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{expiringSoon.length}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-900/20 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500">Total Records</p>
          <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">{pagination.total || records.length}</p>
        </div>
      </div>

      {/* Expiring Soon Alert */}
      {expiringSoon.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><FiAlertTriangle className="text-orange-500" /> <span className="font-semibold text-orange-700 dark:text-orange-400">Policies expiring within 30 days</span></div>
          <div className="space-y-1">
            {expiringSoon.map(r => (
              <p key={r._id} className="text-sm text-orange-600 dark:text-orange-300">
                Tag {r.cattleId?.tagNumber} — {r.provider} — expires {formatDate(r.endDate)}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['', 'active', 'expired', 'claimed'].map(s => (
          <button key={s} onClick={() => setFilters({ ...filters, status: s, page: 1 })}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition ${filters.status === s ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div>
        ) : records.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <FiShield size={40} className="mx-auto mb-3 opacity-30" />
            <p>No insurance records found</p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-hidden max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b text-xs text-gray-500 uppercase">
                    <th className="px-4 py-3 text-left">Cattle</th>
                    <th className="px-3 py-3 text-left">Provider</th>
                    <th className="px-3 py-3 text-left">Policy #</th>
                    <th className="px-3 py-3 text-right">Insured</th>
                    <th className="px-3 py-3 text-right">Premium</th>
                    <th className="px-3 py-3 text-center">Period</th>
                    <th className="px-3 py-3 text-center">Status</th>
                    <th className="px-3 py-3 text-center">Scheme</th>
                    <th className="px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {records.map((r, i) => {
                    const daysLeft = Math.ceil((new Date(r.endDate) - new Date()) / 86400000);
                    const statusColor = { active: 'bg-green-100 text-green-700', expired: 'bg-red-100 text-red-700', claimed: 'bg-blue-100 text-blue-700', cancelled: 'bg-gray-100 text-gray-700' };
                    return (
                      <tr key={r._id} className={`border-b ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''} hover:bg-gray-50 dark:hover:bg-gray-800/50`}>
                        <td className="px-4 py-3 font-medium">Tag {r.cattleId?.tagNumber || '-'}<br/><span className="text-xs text-gray-400">{r.cattleId?.breed}</span></td>
                        <td className="px-3 py-3">{r.provider}</td>
                        <td className="px-3 py-3 font-mono text-xs">{r.policyNumber}</td>
                        <td className="px-3 py-3 text-right font-semibold">{formatCurrency(r.sumInsured)}</td>
                        <td className="px-3 py-3 text-right">{formatCurrency(r.premium)}</td>
                        <td className="px-3 py-3 text-center text-xs">{formatDate(r.startDate)}<br/>to {formatDate(r.endDate)}{r.status === 'active' && daysLeft <= 30 && <span className="block text-orange-500 font-medium">{daysLeft}d left</span>}</td>
                        <td className="px-3 py-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[r.status] || ''}`}>{r.status}</span></td>
                        <td className="px-3 py-3 text-xs text-center">{r.govtScheme || '-'}</td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <button onClick={() => openEdit(r)} className="text-blue-500 hover:text-blue-700 mr-2"><FiEdit2 size={14} /></button>
                          <button onClick={() => handleDelete(r._id)} className="text-red-400 hover:text-red-600"><FiTrash2 size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y dark:divide-gray-800">
              {records.map((r, i) => {
                const daysLeft = Math.ceil((new Date(r.endDate) - new Date()) / 86400000);
                const statusColor = { active: 'bg-green-100 text-green-700', expired: 'bg-red-100 text-red-700', claimed: 'bg-blue-100 text-blue-700', cancelled: 'bg-gray-100 text-gray-700' };
                return (
                  <div key={r._id} className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Tag {r.cattleId?.tagNumber || '-'}</p>
                        <p className="text-xs text-gray-400">{r.cattleId?.breed} • {r.provider}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[r.status] || ''}`}>{r.status}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-400">Sum Insured</p>
                        <p className="font-semibold">{formatCurrency(r.sumInsured)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Premium</p>
                        <p className="font-semibold">{formatCurrency(r.premium)}</p>
                      </div>
                    </div>
                    {r.status === 'active' && daysLeft <= 30 && (
                      <div className="text-xs text-orange-600 bg-orange-50 rounded px-2 py-1">
                        ⚠️ Expires in {daysLeft} days ({formatDate(r.endDate)})
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => openEdit(r)} className="flex-1 btn-secondary text-xs py-1.5 flex items-center justify-center gap-1"><FiEdit2 size={12} /> Edit</button>
                      <button onClick={() => handleDelete(r._id)} className="btn-danger text-xs py-1.5 px-2"><FiTrash2 size={14} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onPageChange={p => setFilters({ ...filters, page: p })} />
      </div>

      <ConfirmDialog isOpen={confirmDialog.open} onClose={() => setConfirmDialog({ ...confirmDialog, open: false })} title={confirmDialog.title} message={confirmDialog.message} variant={confirmDialog.variant} confirmText={confirmDialog.confirmText || 'Confirm'} onConfirm={confirmDialog.onConfirm} />

      {/* Add/Edit Modal */}
      <Modal isOpen={modal} onClose={() => setModal(false)} title={editId ? 'Edit Insurance' : 'Add Insurance Policy'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Cattle *</label>
            <select className="input" required value={form.cattleId} onChange={e => setForm({ ...form, cattleId: e.target.value })}>
              <option value="">Select cattle</option>
              {cattle.map(c => <option key={c._id} value={c._id}>Tag {c.tagNumber} — {c.breed}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Provider *</label><input className="input" required value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value })} placeholder="e.g., United India Insurance" /></div>
            <div><label className="label">Policy Number *</label><input className="input" required value={form.policyNumber} onChange={e => setForm({ ...form, policyNumber: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Sum Insured (₹) *</label><input type="number" className="input" required value={form.sumInsured} onChange={e => setForm({ ...form, sumInsured: e.target.value })} /></div>
            <div><label className="label">Premium (₹) *</label><input type="number" className="input" required value={form.premium} onChange={e => setForm({ ...form, premium: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Start Date *</label><input type="date" className="input" required value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
            <div><label className="label">End Date *</label><input type="date" className="input" required value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option><option value="expired">Expired</option><option value="claimed">Claimed</option><option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div><label className="label">Govt. Scheme</label><input className="input" value={form.govtScheme} onChange={e => setForm({ ...form, govtScheme: e.target.value })} placeholder="e.g., Pashu Dhan Bima Yojana" /></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editId ? 'Update' : 'Add Policy'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}