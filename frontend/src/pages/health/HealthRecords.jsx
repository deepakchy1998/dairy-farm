import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate, formatCurrency } from '../../utils/helpers';
import Modal from '../../components/Modal';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import { FiPlus, FiEdit2, FiTrash2, FiAlertCircle, FiDownload, FiFileText, FiHeart, FiLayers, FiClock } from 'react-icons/fi';
import { FaIndianRupeeSign } from 'react-icons/fa6';
import DateRangeFilter, { getDateRange } from '../../components/DateRangeFilter';
import { exportPdf } from '../../utils/exportPdf';
import { exportCsv } from '../../utils/exportCsv';
import toast from 'react-hot-toast';

const types = ['vaccination', 'treatment', 'checkup', 'deworming'];
const typeBadge = {
  vaccination: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400',
  treatment: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
  checkup: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  deworming: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400',
};
const defaultForm = { cattleId: '', date: new Date().toISOString().slice(0, 10), type: 'vaccination', description: '', medicine: '', cost: '', nextDueDate: '', vetName: '', notes: '' };

export default function HealthRecords() {
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({});
  const [upcoming, setUpcoming] = useState([]);
  const [cattleList, setCattleList] = useState([]);
  const [loading, setLoading] = useState(true);
  const initRange = getDateRange('monthly');
  const [filters, setFilters] = useState({ type: '', cattleId: '', startDate: initRange.startDate, endDate: initRange.endDate, page: 1 });
  const [period, setPeriod] = useState('monthly');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState({ totalCost: 0, count: 0, byType: {} });

  useEffect(() => { api.get('/cattle', { params: { limit: 500 } }).then(r => setCattleList(r.data.data)).catch(() => {}); }, []);

  const fetch = () => {
    setLoading(true);
    const params = { ...filters, limit: 500 };
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
    api.get('/health', { params }).then(r => {
      const data = r.data.data;
      setRecords(data);
      setPagination(r.data.pagination);
      const totalCost = data.reduce((s, r) => s + (r.cost || 0), 0);
      const byType = {};
      data.forEach(r => { byType[r.type] = (byType[r.type] || 0) + 1; });
      setSummary({ totalCost, count: data.length, byType });
    }).catch(() => toast.error('Failed')).finally(() => setLoading(false));
  };
  useEffect(() => { fetch(); }, [filters]);
  useEffect(() => { api.get('/health/upcoming', { params: { days: 14 } }).then(r => setUpcoming(r.data.data)).catch(() => {}); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      if (editId) { await api.put(`/health/${editId}`, form); toast.success('Updated'); }
      else { await api.post('/health', form); toast.success('Health record added'); }
      setModalOpen(false); setForm(defaultForm); setEditId(null); fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); } finally { setSaving(false); }
  };

  const handleEdit = (r) => {
    setForm({ cattleId: r.cattleId?._id || r.cattleId, date: r.date?.slice(0, 10), type: r.type, description: r.description, medicine: r.medicine || '', cost: r.cost || '', nextDueDate: r.nextDueDate?.slice(0, 10) || '', vetName: r.vetName || '', notes: r.notes || '' });
    setEditId(r._id); setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this record?')) return;
    try { await api.delete(`/health/${id}`); toast.success('Deleted'); fetch(); } catch { toast.error('Failed'); }
  };

  const columns = [
    { key: 'date', label: 'Date', render: r => <span className="text-gray-600 dark:text-gray-400">{formatDate(r.date)}</span> },
    { key: 'cattle', label: 'Cattle', render: r => <span className="font-semibold dark:text-white">{r.cattleId?.tagNumber || '-'}</span> },
    { key: 'type', label: 'Type', render: r => <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${typeBadge[r.type]}`}>{r.type}</span> },
    { key: 'description', label: 'Description', render: r => <span className="truncate max-w-[200px] block dark:text-gray-300">{r.description}</span> },
    { key: 'medicine', label: 'Medicine', render: r => <span className="dark:text-gray-400">{r.medicine || '-'}</span> },
    { key: 'cost', label: 'Cost', render: r => r.cost ? <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(r.cost)}</span> : <span className="text-gray-400">-</span> },
    { key: 'nextDue', label: 'Next Due', render: r => r.nextDueDate ? (
      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
        {formatDate(r.nextDueDate)}
      </span>
    ) : <span className="text-gray-400">-</span> },
    { key: 'actions', label: '', render: r => (
      <div className="flex gap-1.5">
        <button onClick={() => handleEdit(r)} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"><FiEdit2 size={15} /></button>
        <button onClick={() => handleDelete(r._id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><FiTrash2 size={15} /></button>
      </div>
    )},
  ];

  const summaryCardsData = [
    { label: 'Total Records', value: summary.count, icon: FiLayers, gradient: 'from-blue-500 to-cyan-600' },
    { label: 'Total Cost', value: formatCurrency(summary.totalCost), icon: FaIndianRupeeSign, gradient: 'from-red-500 to-rose-600' },
    ...(summary.byType.vaccination ? [{ label: 'Vaccinations', value: summary.byType.vaccination, icon: FiHeart, gradient: 'from-indigo-500 to-blue-600' }] : []),
    ...(summary.byType.treatment ? [{ label: 'Treatments', value: summary.byType.treatment, icon: FiHeart, gradient: 'from-amber-500 to-orange-600' }] : []),
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Health Records 💉</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Vaccinations, treatments & checkups</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv({
            filename: 'health_records',
            headers: ['Date', 'Cattle', 'Type', 'Description', 'Medicine', 'Cost', 'Vet', 'Next Due'],
            rows: records.map(r => [formatDate(r.date), r.cattleId?.tagNumber || '-', r.type, r.description, r.medicine || '', r.cost || 0, r.vetName || '', r.nextDueDate ? formatDate(r.nextDueDate) : '']),
          })} className="btn-secondary flex items-center gap-2 text-sm"><FiFileText size={15} /> CSV</button>
          <button onClick={() => exportPdf({
            title: 'Health Records Report',
            period: `${filters.startDate || 'All'} to ${filters.endDate || 'Now'}`,
            summaryCards: summaryCardsData.map(s => ({ label: s.label, value: s.value })),
            tableHeaders: ['Date', 'Cattle', 'Type', 'Description', 'Medicine', 'Cost', 'Next Due'],
            tableRows: records.map(r => [formatDate(r.date), r.cattleId?.tagNumber || '-', r.type, r.description, r.medicine || '-', r.cost ? formatCurrency(r.cost) : '-', r.nextDueDate ? formatDate(r.nextDueDate) : '-']),
          })} className="btn-secondary flex items-center gap-2 text-sm"><FiDownload size={15} /> Export PDF</button>
          <button onClick={() => { setForm(defaultForm); setEditId(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2 text-sm"><FiPlus size={16} /> Add Record</button>
        </div>
      </div>

      {/* Upcoming Vaccinations Alert */}
      {upcoming.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 p-5 text-white shadow-lg">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-12 translate-x-12" />
          <div className="relative z-10">
            <h3 className="font-bold flex items-center gap-2 mb-3"><FiAlertCircle size={18} /> Upcoming Due — Next 14 Days</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {upcoming.slice(0, 6).map((u, i) => (
                <div key={i} className="bg-white/15 backdrop-blur-sm rounded-xl p-3 text-sm">
                  <p className="font-semibold">{u.cattleId?.tagNumber}</p>
                  <p className="text-white/80 text-xs">{u.description} — {formatDate(u.nextDueDate)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card !p-4 space-y-3">
        <DateRangeFilter value={period} onChange={({ period: p, startDate, endDate }) => {
          setPeriod(p);
          setFilters({ ...filters, startDate: startDate || '', endDate: endDate || '', page: 1 });
        }} />
        <div className="flex gap-3">
          <select className="input w-auto" value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value, page: 1 })}>
            <option value="">All Types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="input w-auto" value={filters.cattleId} onChange={e => setFilters({ ...filters, cattleId: e.target.value, page: 1 })}>
            <option value="">All Cattle</option>
            {cattleList.map(c => <option key={c._id} value={c._id}>{c.tagNumber} - {c.breed}</option>)}
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
            <DataTable columns={columns} data={records} emptyMessage="No health records found" />
            <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onPageChange={p => setFilters({ ...filters, page: p })} />
          </>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Record' : 'Add Health Record'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Cattle *</label><select className="input" required value={form.cattleId} onChange={e => setForm({ ...form, cattleId: e.target.value })}><option value="">Select cattle</option>{cattleList.map(c => <option key={c._id} value={c._id}>{c.tagNumber} - {c.breed}</option>)}</select></div>
            <div><label className="label">Type *</label><select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{types.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            <div><label className="label">Date *</label><input type="date" className="input" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div><label className="label">Next Due Date</label><input type="date" className="input" value={form.nextDueDate} onChange={e => setForm({ ...form, nextDueDate: e.target.value })} /></div>
          </div>
          <div><label className="label">Description *</label><input className="input" required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g. FMD Vaccination" /></div>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">Medicine</label><input className="input" value={form.medicine} onChange={e => setForm({ ...form, medicine: e.target.value })} placeholder="Name of medicine" /></div>
            <div><label className="label">Cost (₹)</label><input type="number" className="input" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} /></div>
            <div><label className="label">Vet Name</label><input className="input" value={form.vetName} onChange={e => setForm({ ...form, vetName: e.target.value })} /></div>
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
