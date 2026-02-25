import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate } from '../../utils/helpers';
import Modal from '../../components/Modal';
import DataTable from '../../components/DataTable';
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
      setModalOpen(false); setForm(defaultForm); setEditId(null); fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); } finally { setSaving(false); }
  };

  const handleEdit = (r) => {
    setForm({ cattleId: r.cattleId?._id || r.cattleId, breedingDate: r.breedingDate?.slice(0, 10), bullDetails: r.bullDetails || '', method: r.method, expectedDelivery: r.expectedDelivery?.slice(0, 10) || '', status: r.status, notes: r.notes || '' });
    setEditId(r._id); setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this record?')) return;
    try { await api.delete(`/breeding/${id}`); toast.success('Deleted'); fetch(); } catch { toast.error('Failed'); }
  };

  const columns = [
    { key: 'cattle', label: 'Cattle', render: r => <span className="font-semibold dark:text-white">{r.cattleId?.tagNumber || '-'}</span> },
    { key: 'breedingDate', label: 'Breeding Date', render: r => <span className="dark:text-gray-400">{formatDate(r.breedingDate)}</span> },
    { key: 'method', label: 'Method', render: r => (
      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${r.method === 'artificial' ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'}`}>
        {r.method === 'artificial' ? '🧪 AI' : '🐂 Natural'}
      </span>
    )},
    { key: 'bullDetails', label: 'Bull Details', render: r => <span className="dark:text-gray-400">{r.bullDetails || '-'}</span> },
    { key: 'expectedDelivery', label: 'Expected Delivery', render: r => r.expectedDelivery ? (
      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400">{formatDate(r.expectedDelivery)}</span>
    ) : <span className="text-gray-400">-</span> },
    { key: 'status', label: 'Status', render: r => (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadge[r.status]}`}>
        {statusIcons[r.status]} {r.status}
      </span>
    )},
    { key: 'actions', label: '', render: r => (
      <div className="flex gap-1.5">
        <button onClick={() => handleEdit(r)} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"><FiEdit2 size={15} /></button>
        <button onClick={() => handleDelete(r._id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><FiTrash2 size={15} /></button>
      </div>
    )},
  ];

  const summaryCardsData = [
    { label: 'Total Records', value: summary.count, icon: FiLayers, gradient: 'from-blue-500 to-cyan-600' },
    ...(summary.byStatus.confirmed ? [{ label: 'Confirmed', value: summary.byStatus.confirmed, icon: FiCheckCircle, gradient: 'from-emerald-500 to-teal-600' }] : []),
    ...(summary.byStatus.pending ? [{ label: 'Pending', value: summary.byStatus.pending, icon: FiClock, gradient: 'from-yellow-500 to-amber-600' }] : []),
    ...(summary.byStatus.delivered ? [{ label: 'Delivered', value: summary.byStatus.delivered, icon: FiActivity, gradient: 'from-pink-500 to-rose-600' }] : []),
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Breeding Records 🐣</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Track breeding, pregnancy & deliveries</p>
          </div>
          <button onClick={() => { setForm(defaultForm); setEditId(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2"><FiPlus size={16} /> Add Record</button>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={() => exportCsv({
            filename: 'breeding_records',
            headers: ['Cattle', 'Breeding Date', 'Method', 'Bull Details', 'Expected Delivery', 'Status'],
            rows: records.map(r => [r.cattleId?.tagNumber || '-', formatDate(r.breedingDate), r.method, r.bullDetails || '', formatDate(r.expectedDelivery), r.status]),
          })} className="btn-secondary flex items-center gap-2 text-sm"><FiFileText size={15} /> Export CSV</button>
          <button onClick={() => exportPdf({
            title: 'Breeding Records Report',
            period: `${filters.startDate || 'All'} to ${filters.endDate || 'Now'}`,
            summaryCards: summaryCardsData.map(s => ({ label: s.label, value: s.value })),
            tableHeaders: ['Cattle', 'Breeding Date', 'Method', 'Bull Details', 'Expected Delivery', 'Status'],
            tableRows: records.map(r => [r.cattleId?.tagNumber || '-', formatDate(r.breedingDate), r.method === 'artificial' ? 'AI' : 'Natural', r.bullDetails || '-', formatDate(r.expectedDelivery), r.status]),
          })} className="btn-secondary flex items-center gap-2 text-sm"><FiDownload size={15} /> Export PDF</button>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCardsData.map((s, i) => (
            <div key={i} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${s.gradient} p-5 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5`}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
              <div className="relative z-10">
                <s.icon size={20} className="mb-2 opacity-80" />
                <p className="text-2xl font-extrabold">{s.value}</p>
                <p className="text-white/80 text-xs mt-1">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-emerald-200 dark:border-emerald-900 border-t-emerald-600"></div>
            <p className="text-sm text-gray-400 dark:text-gray-500">Loading records...</p>
          </div>
        ) : (
          <>
            <DataTable columns={columns} data={records} emptyMessage="No breeding records found" />
            <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onPageChange={p => setFilters({ ...filters, page: p })} />
          </>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Record' : 'Add Breeding Record'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label">Cattle (Female) *</label><select className="input" required value={form.cattleId} onChange={e => setForm({ ...form, cattleId: e.target.value })}><option value="">Select cattle</option>{cattleList.map(c => <option key={c._id} value={c._id}>{c.tagNumber} - {c.breed}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Breeding Date *</label><input type="date" className="input" required value={form.breedingDate} onChange={e => setForm({ ...form, breedingDate: e.target.value })} /></div>
            <div><label className="label">Method</label><select className="input" value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}><option value="natural">🐂 Natural</option><option value="artificial">🧪 Artificial Insemination</option></select></div>
          </div>
          <div><label className="label">Bull Details</label><input className="input" value={form.bullDetails} onChange={e => setForm({ ...form, bullDetails: e.target.value })} placeholder="Bull name/ID or semen details" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Expected Delivery</label><input type="date" className="input" value={form.expectedDelivery} onChange={e => setForm({ ...form, expectedDelivery: e.target.value })} /></div>
            <div><label className="label">Status</label><select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="pending">⏳ Pending</option><option value="confirmed">✅ Confirmed</option><option value="delivered">🐣 Delivered</option><option value="failed">❌ Failed</option></select></div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editId ? 'Update' : 'Add Record'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
