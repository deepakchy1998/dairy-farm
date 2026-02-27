import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate } from '../../utils/helpers';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import Pagination from '../../components/Pagination';
import { FiPlus, FiEdit2, FiTrash2, FiDownload, FiFileText, FiActivity, FiLayers, FiCheckCircle, FiClock } from 'react-icons/fi';
import DateRangeFilter, { getDateRange } from '../../components/DateRangeFilter';
import { exportPdf } from '../../utils/exportPdf';
import { exportCsv } from '../../utils/exportCsv';
import toast from 'react-hot-toast';

const statusBadge = {
  pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  confirmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  delivered: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
};
const statusIcons = { pending: '⏳', confirmed: '✅', delivered: '🐣', failed: '❌' };
const defaultForm = { cattleId: '', breedingDate: '', bullDetails: '', method: 'natural', expectedDelivery: '', status: 'pending', notes: '' };
const defaultCalfForm = { tagNumber: '', gender: 'female', breed: '', dateOfBirth: new Date().toISOString().slice(0, 10), weight: '', source: 'born_on_farm', motherTag: '', category: 'calf' };
const statusFlow = { pending: 'confirmed', confirmed: 'delivered' };

export default function BreedingRecords() {
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({});
  const [cattleList, setCattleList] = useState([]);
  const [loading, setLoading] = useState(true);
  const initRange = getDateRange('monthly');
  const [filters, setFilters] = useState({ status: '', startDate: initRange.startDate, endDate: initRange.endDate, page: 1 });
  const [period, setPeriod] = useState('monthly');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState({ count: 0, byStatus: {}, byMethod: {} });
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });
  const [calfModalOpen, setCalfModalOpen] = useState(false);
  const [calfForm, setCalfForm] = useState(defaultCalfForm);
  const [savingCalf, setSavingCalf] = useState(false);

  useEffect(() => { api.get('/cattle', { params: { limit: 500, gender: 'female' } }).then(r => setCattleList(r.data.data)).catch(() => {}); }, []);

  const fetch = () => {
    setLoading(true);
    const params = { ...filters, limit: 500 };
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
    api.get('/breeding', { params }).then(r => {
      const data = r.data.data;
      setRecords(data);
      setPagination(r.data.pagination);
      const byStatus = {}, byMethod = {};
      data.forEach(r => {
        byStatus[r.status] = (byStatus[r.status] || 0) + 1;
        byMethod[r.method] = (byMethod[r.method] || 0) + 1;
      });
      setSummary({ count: data.length, byStatus, byMethod });
    }).catch(() => toast.error('Failed')).finally(() => setLoading(false));
  };
  useEffect(() => { fetch(); }, [filters]);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editId) { await api.put(`/breeding/${editId}`, form); toast.success('Updated'); }
      else { await api.post('/breeding', form); toast.success('Breeding record added'); }
      const wasDelivered = form.status === 'delivered';
      const motherId = form.cattleId;
      setModalOpen(false); setForm(defaultForm); setEditId(null); fetch();
      if (wasDelivered && motherId) {
        const mother = cattleList.find(c => c._id === motherId);
        setCalfForm({ ...defaultCalfForm, dateOfBirth: new Date().toISOString().slice(0, 10), breed: mother?.breed || 'Crossbred', motherTag: mother?.tagNumber || '', source: 'born_on_farm', category: 'calf' });
        setCalfModalOpen(true);
      }
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); } finally { setSaving(false); }
  };

  const handleSaveCalf = async (e) => {
    e.preventDefault(); setSavingCalf(true);
    try {
      await api.post('/cattle', { tagNumber: calfForm.tagNumber, gender: calfForm.gender, breed: calfForm.breed, dateOfBirth: calfForm.dateOfBirth, weight: calfForm.weight ? Number(calfForm.weight) : undefined, source: calfForm.source, motherTag: calfForm.motherTag, category: calfForm.category });
      toast.success('🐣 Calf added to cattle list!');
      setCalfModalOpen(false); setCalfForm(defaultCalfForm);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add calf'); } finally { setSavingCalf(false); }
  };

  const handleQuickToggle = async (record) => {
    const nextStatus = statusFlow[record.status];
    if (!nextStatus) return;
    try {
      await api.put(`/breeding/${record._id}`, { ...record, cattleId: record.cattleId?._id || record.cattleId, breedingDate: record.breedingDate?.slice(0, 10), expectedDelivery: record.expectedDelivery?.slice(0, 10) || '', status: nextStatus });
      toast.success(`Status → ${nextStatus}`);
      if (nextStatus === 'delivered' && record.cattleId) {
        const motherId = record.cattleId?._id || record.cattleId;
        const mother = cattleList.find(c => c._id === motherId);
        setCalfForm({ ...defaultCalfForm, dateOfBirth: new Date().toISOString().slice(0, 10), breed: mother?.breed || 'Crossbred', motherTag: mother?.tagNumber || record.cattleId?.tagNumber || '', source: 'born_on_farm', category: 'calf' });
        setCalfModalOpen(true);
      }
      fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleEdit = (r) => {
    setForm({ cattleId: r.cattleId?._id || r.cattleId, breedingDate: r.breedingDate?.slice(0, 10), bullDetails: r.bullDetails || '', method: r.method, expectedDelivery: r.expectedDelivery?.slice(0, 10) || '', status: r.status, notes: r.notes || '' });
    setEditId(r._id); setModalOpen(true);
  };

  const handleDelete = (id) => {
    setConfirm({ open: true, title: 'Delete Record?', message: 'Delete this breeding record? This action cannot be undone.', variant: 'danger', onConfirm: async () => {
      try { await api.delete(`/breeding/${id}`); toast.success('Deleted'); fetch(); } catch { toast.error('Failed'); }
    }});
  };

  const summaryCardsData = [
    { label: 'Total Records', value: summary.count, color: 'blue' },
    ...(summary.byStatus.confirmed ? [{ label: 'Confirmed', value: summary.byStatus.confirmed, color: 'emerald' }] : []),
    ...(summary.byStatus.pending ? [{ label: 'Pending', value: summary.byStatus.pending, color: 'amber' }] : []),
    ...(summary.byStatus.delivered ? [{ label: 'Delivered', value: summary.byStatus.delivered, color: 'pink' }] : []),
  ];

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Breeding Records 🐣</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Track breeding, pregnancy & deliveries</p>
          </div>
          <button onClick={() => { setForm(defaultForm); setEditId(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2 flex-shrink-0"><FiPlus size={16} /> <span className="hidden sm:inline">Add Record</span><span className="sm:hidden">Add</span></button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv({
            filename: 'breeding_records',
            headers: ['Cattle', 'Breeding Date', 'Method', 'Bull Details', 'Expected Delivery', 'Status'],
            rows: records.map(r => [r.cattleId?.tagNumber || '-', formatDate(r.breedingDate), r.method, r.bullDetails || '', formatDate(r.expectedDelivery), r.status]),
          })} className="btn-secondary flex items-center gap-1 text-xs sm:text-sm"><FiFileText size={14} /> <span className="hidden sm:inline">Export</span> CSV</button>
          <button onClick={() => exportPdf({
            title: 'Breeding Records Report',
            period: `${filters.startDate || 'All'} to ${filters.endDate || 'Now'}`,
            summaryCards: summaryCardsData.map(s => ({ label: s.label, value: s.value })),
            tableHeaders: ['Cattle', 'Breeding Date', 'Method', 'Bull Details', 'Expected Delivery', 'Status'],
            tableRows: records.map(r => [r.cattleId?.tagNumber || '-', formatDate(r.breedingDate), r.method === 'artificial' ? 'AI' : 'Natural', r.bullDetails || '-', formatDate(r.expectedDelivery), r.status]),
          })} className="btn-secondary flex items-center gap-1 text-xs sm:text-sm"><FiDownload size={14} /> <span className="hidden sm:inline">Export</span> PDF</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card !p-4 space-y-3">
        <DateRangeFilter value={period} onChange={({ period: p, startDate, endDate }) => {
          setPeriod(p);
          setFilters({ ...filters, startDate: startDate || '', endDate: endDate || '', page: 1 });
        }} />
        <div>
          <select className="input w-auto" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value, page: 1 })}>
            <option value="">All Status</option>
            <option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="delivered">Delivered</option><option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {!loading && records.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {summaryCardsData.map((s, i) => (
            <div key={i} className={`bg-${s.color}-50 dark:bg-${s.color}-900/20 rounded-xl p-3 text-center`}>
              <p className={`text-xs text-${s.color}-500`}>{s.label}</p>
              <p className={`text-2xl font-bold text-${s.color}-700 dark:text-${s.color}-300`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
          </div>
        ) : records.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">No breeding records found</div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-gray-50 dark:bg-gray-800 border-b text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2 text-left">Cattle</th>
                    <th className="px-3 py-2 text-left">Breeding Date</th>
                    <th className="px-3 py-2 text-center">Method</th>
                    <th className="px-3 py-2 text-left">Bull Details</th>
                    <th className="px-3 py-2 text-center">Expected Delivery</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={r._id} className={`border-b ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}`}>
                      <td className="px-4 py-2">
                        <span className="font-semibold dark:text-white">{r.cattleId?.tagNumber || '-'}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="dark:text-gray-400">{formatDate(r.breedingDate)}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${r.method === 'artificial' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                          {r.method === 'artificial' ? '🧪 AI' : '🐂 Natural'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="dark:text-gray-400">{r.bullDetails || '-'}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {r.expectedDelivery ? (
                          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400">{formatDate(r.expectedDelivery)}</span>
                        ) : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span onClick={() => statusFlow[r.status] && handleQuickToggle(r)} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge[r.status]} ${statusFlow[r.status] ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-current transition-all' : ''}`} title={statusFlow[r.status] ? `Click to change to ${statusFlow[r.status]}` : ''}>
                          {statusIcons[r.status]} {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex gap-1.5 justify-center">
                          <button onClick={() => handleEdit(r)} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"><FiEdit2 size={15} /></button>
                          <button onClick={() => handleDelete(r._id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><FiTrash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y dark:divide-gray-800 max-h-[60vh] overflow-y-auto">
              {records.map((r, i) => (
                <div key={r._id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm dark:text-white">{r.cattleId?.tagNumber || '-'}</p>
                      <p className="text-xs text-gray-400">{formatDate(r.breedingDate)}</p>
                    </div>
                    <span onClick={() => statusFlow[r.status] && handleQuickToggle(r)} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge[r.status]} ${statusFlow[r.status] ? 'cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-current transition-all' : ''}`} title={statusFlow[r.status] ? `Click to change to ${statusFlow[r.status]}` : ''}>
                      {statusIcons[r.status]} {r.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${r.method === 'artificial' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'}`}>
                      {r.method === 'artificial' ? '🧪 AI' : '🐂 Natural'}
                    </span>
                    <div className="flex gap-1.5">
                      <button onClick={() => handleEdit(r)} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"><FiEdit2 size={15} /></button>
                      <button onClick={() => handleDelete(r._id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><FiTrash2 size={15} /></button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    {r.bullDetails && <p><strong>Bull:</strong> {r.bullDetails}</p>}
                    {r.expectedDelivery && <p><strong>Expected:</strong> {formatDate(r.expectedDelivery)}</p>}
                  </div>
                </div>
              ))}
            </div>

            <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onPageChange={p => setFilters({ ...filters, page: p })} />
          </>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Record' : 'Add Breeding Record'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label">Cattle (Female) *</label><select className="input" required value={form.cattleId} onChange={e => setForm({ ...form, cattleId: e.target.value })}><option value="">Select cattle</option>{cattleList.map(c => <option key={c._id} value={c._id}>{c.tagNumber} - {c.breed}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Breeding Date *</label><input type="date" className="input" required value={form.breedingDate} onChange={e => {
              const bd = e.target.value;
              const update = { ...form, breedingDate: bd };
              if (bd) {
                const d = new Date(bd);
                d.setDate(d.getDate() + 283);
                update.expectedDelivery = d.toISOString().slice(0, 10);
              }
              setForm(update);
            }} /></div>
            <div><label className="label">Method</label><select className="input" value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}><option value="natural">🐂 Natural</option><option value="artificial">🧪 Artificial Insemination</option></select></div>
          </div>
          <div><label className="label">Bull Details</label><input className="input" value={form.bullDetails} onChange={e => setForm({ ...form, bullDetails: e.target.value })} placeholder="Bull name/ID or semen details" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Expected Delivery</label><input type="date" className="input" value={form.expectedDelivery} onChange={e => setForm({ ...form, expectedDelivery: e.target.value })} /></div>
            <div><label className="label">Status</label><select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="pending">⏳ Pending</option><option value="confirmed">✅ Confirmed</option><option value="delivered">🐣 Delivered</option><option value="failed">❌ Failed</option></select></div>
          </div>
          <div><label className="label">Notes</label><textarea className="input" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes..." /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editId ? 'Update' : 'Add Record'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={confirm.open} onClose={() => setConfirm({ ...confirm, open: false })} title={confirm.title} message={confirm.message} variant={confirm.variant} onConfirm={confirm.onConfirm} />

      {/* Add Calf Modal */}
      <Modal isOpen={calfModalOpen} onClose={() => setCalfModalOpen(false)} title="🐣 Add Newborn Calf">
        <form onSubmit={handleSaveCalf} className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">Mother: <strong>{calfForm.motherTag}</strong> — Add the newborn calf to your cattle list</p>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Tag Number *</label><input className="input" required value={calfForm.tagNumber} onChange={e => setCalfForm({ ...calfForm, tagNumber: e.target.value })} placeholder="e.g., C-101" /></div>
            <div><label className="label">Gender</label><select className="input" value={calfForm.gender} onChange={e => setCalfForm({ ...calfForm, gender: e.target.value })}><option value="female">Female</option><option value="male">Male</option></select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Breed</label><input className="input" value={calfForm.breed} onChange={e => setCalfForm({ ...calfForm, breed: e.target.value })} /></div>
            <div><label className="label">Date of Birth</label><input type="date" className="input" value={calfForm.dateOfBirth} onChange={e => setCalfForm({ ...calfForm, dateOfBirth: e.target.value })} /></div>
          </div>
          <div><label className="label">Weight (kg)</label><input type="number" step="0.1" className="input" value={calfForm.weight} onChange={e => setCalfForm({ ...calfForm, weight: e.target.value })} placeholder="Optional" /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setCalfModalOpen(false)} className="btn-secondary">Skip</button>
            <button type="submit" disabled={savingCalf} className="btn-primary">{savingCalf ? 'Adding...' : '🐣 Add Calf'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}