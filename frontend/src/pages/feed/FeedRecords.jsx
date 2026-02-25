import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate, formatCurrency } from '../../utils/helpers';
import Modal from '../../components/Modal';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import { FiPlus, FiEdit2, FiTrash2, FiDownload, FiFileText, FiPackage, FiLayers, FiDatabase } from 'react-icons/fi';
import { FaIndianRupeeSign } from 'react-icons/fa6';
import DateRangeFilter, { getDateRange } from '../../components/DateRangeFilter';
import { exportPdf } from '../../utils/exportPdf';
import { exportCsv } from '../../utils/exportCsv';
import toast from 'react-hot-toast';

const defaultForm = { date: new Date().toISOString().slice(0, 10), feedType: '', quantity: '', unit: 'kg', cost: '', notes: '' };

export default function FeedRecords() {
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const initRange = getDateRange('monthly');
  const [filters, setFilters] = useState({ feedType: '', startDate: initRange.startDate, endDate: initRange.endDate, page: 1 });
  const [period, setPeriod] = useState('monthly');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState({ totalCost: 0, totalQty: 0, count: 0, byType: {} });

  const fetch = () => {
    setLoading(true);
    const params = { ...filters, limit: 500 };
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
    api.get('/feed', { params }).then(r => {
      const data = r.data.data;
      setRecords(data);
      setPagination(r.data.pagination);
      const totalCost = data.reduce((s, r) => s + (r.cost || 0), 0);
      const totalQty = data.reduce((s, r) => s + (r.quantity || 0), 0);
      const byType = {};
      data.forEach(r => { byType[r.feedType] = (byType[r.feedType] || 0) + (r.cost || 0); });
      setSummary({ totalCost, totalQty, count: data.length, byType });
    }).catch(() => toast.error('Failed to load records')).finally(() => setLoading(false));
  };
  useEffect(() => { fetch(); }, [filters]);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editId) { await api.put(`/feed/${editId}`, form); toast.success('Updated'); }
      else { await api.post('/feed', form); toast.success('Feed record added'); }
      setModalOpen(false); setForm(defaultForm); setEditId(null); fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); } finally { setSaving(false); }
  };

  const handleEdit = (r) => {
    setForm({ date: r.date?.slice(0, 10), feedType: r.feedType, quantity: r.quantity, unit: r.unit || 'kg', cost: r.cost || '', notes: r.notes || '' });
    setEditId(r._id); setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this record?')) return;
    try { await api.delete(`/feed/${id}`); toast.success('Deleted'); fetch(); } catch { toast.error('Failed'); }
  };

  const columns = [
    { key: 'date', label: 'Date', render: r => <span className="text-gray-600 dark:text-gray-400">{formatDate(r.date)}</span> },
    { key: 'feedType', label: 'Feed Type', render: r => (
      <span className="inline-flex items-center gap-1.5 font-semibold text-gray-800 dark:text-gray-200">
        <FiPackage size={13} className="text-emerald-500" /> {r.feedType}
      </span>
    )},
    { key: 'quantity', label: 'Quantity', render: r => <span className="font-medium dark:text-gray-300">{r.quantity} {r.unit || 'kg'}</span> },
    { key: 'cost', label: 'Cost', render: r => <span className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(r.cost)}</span> },
    { key: 'notes', label: 'Notes', render: r => <span className="text-gray-500 dark:text-gray-400 truncate max-w-[150px] block">{r.notes || '-'}</span> },
    { key: 'actions', label: '', render: r => (
      <div className="flex gap-1.5">
        <button onClick={() => handleEdit(r)} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors" title="Edit"><FiEdit2 size={15} /></button>
        <button onClick={() => handleDelete(r._id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" title="Delete"><FiTrash2 size={15} /></button>
      </div>
    )},
  ];

  const summaryCards = [
    { label: 'Total Feed Cost', value: formatCurrency(summary.totalCost), icon: FaIndianRupeeSign, gradient: 'from-orange-500 to-amber-600' },
    { label: 'Total Quantity', value: `${summary.totalQty.toFixed(1)} kg`, icon: FiDatabase, gradient: 'from-emerald-500 to-teal-600' },
    { label: 'Records', value: summary.count, icon: FiLayers, gradient: 'from-blue-500 to-cyan-600' },
    { label: 'Feed Types', value: Object.keys(summary.byType).length, icon: FiPackage, gradient: 'from-violet-500 to-purple-600' },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Feed Management 🌾</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Track feed usage, types & costs</p>
          </div>
          <button onClick={() => { setForm(defaultForm); setEditId(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2"><FiPlus size={16} /> Add Record</button>
        </div>
        <div className="flex gap-2 justify-center">
          <button onClick={() => exportCsv({
            filename: 'feed_records',
            headers: ['Date', 'Feed Type', 'Quantity', 'Unit', 'Cost', 'Notes'],
            rows: records.map(r => [formatDate(r.date), r.feedType, r.quantity, r.unit || 'kg', r.cost || 0, r.notes || '']),
          })} className="btn-secondary flex items-center gap-2 text-sm"><FiFileText size={15} /> Export CSV</button>
          <button onClick={() => exportPdf({
            title: 'Feed Records Report',
            period: `${filters.startDate || 'All'} to ${filters.endDate || 'Now'}`,
            summaryCards: summaryCards.map(s => ({ label: s.label, value: s.value })),
            tableHeaders: ['Date', 'Feed Type', 'Quantity', 'Cost', 'Notes'],
            tableRows: records.map(r => [formatDate(r.date), r.feedType, `${r.quantity} ${r.unit || 'kg'}`, formatCurrency(r.cost), r.notes || '-']),
          })} className="btn-secondary flex items-center gap-2 text-sm"><FiDownload size={15} /> Export PDF</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card !p-4">
        <DateRangeFilter value={period} onChange={({ period: p, startDate, endDate }) => {
          setPeriod(p);
          setFilters({ ...filters, startDate: startDate || '', endDate: endDate || '', page: 1 });
        }} />
      </div>

      {/* Summary Cards */}
      {!loading && records.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {summaryCards.map((s, i) => (
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
            <DataTable columns={columns} data={records} emptyMessage="No feed records found" />
            <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onPageChange={p => setFilters({ ...filters, page: p })} />
          </>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Feed Record' : 'Add Feed Record'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label">Date *</label><input type="date" className="input" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <div><label className="label">Feed Type *</label><input className="input" required value={form.feedType} onChange={e => setForm({ ...form, feedType: e.target.value })} placeholder="e.g. Green Fodder, Dry Hay, Concentrate" /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Quantity *</label><input type="number" step="0.1" className="input" required value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></div>
            <div><label className="label">Unit</label><select className="input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}><option value="kg">Kg</option><option value="quintal">Quintal</option><option value="ton">Ton</option></select></div>
            <div><label className="label">Cost (₹)</label><input type="number" className="input" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} /></div>
          </div>
          <div><label className="label">Notes</label><input className="input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" /></div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editId ? 'Update' : 'Add Record'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
