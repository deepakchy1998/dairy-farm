import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate, formatCurrency } from '../../utils/helpers';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import Pagination from '../../components/Pagination';
import { FiPlus, FiEdit2, FiTrash2, FiAlertCircle, FiDownload, FiFileText, FiHeart, FiLayers, FiClock } from 'react-icons/fi';
import { FaIndianRupeeSign } from 'react-icons/fa6';
import DateRangeFilter, { getDateRange } from '../../components/DateRangeFilter';
import { exportPdf } from '../../utils/exportPdf';
import { exportCsv } from '../../utils/exportCsv';
import { useAppConfig } from '../../context/AppConfigContext';
import toast from 'react-hot-toast';

const BADGE_COLORS = ['bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400', 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400', 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400', 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400', 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400'];

const defaultForm = { cattleId: '', date: new Date().toISOString().slice(0, 10), type: 'vaccination', description: '', medicine: '', cost: '', nextDueDate: '', vetName: '', notes: '' };

export default function HealthRecords() {
  const { healthRecordTypes: types } = useAppConfig();
  const typeBadge = Object.fromEntries(types.map((t, i) => [t, BADGE_COLORS[i % BADGE_COLORS.length]]));
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
  
  // Confirm dialog state
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });

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

  const handleDelete = (id) => {
    setConfirm({ 
      open: true, 
      title: 'Delete Record?', 
      message: 'This health record will be permanently deleted.', 
      variant: 'danger', 
      onConfirm: async () => {
        try { await api.delete(`/health/${id}`); toast.success('Deleted'); fetch(); } catch { toast.error('Failed'); }
      }
    });
  };

  const summaryCardsData = [
    { label: 'Total Records', value: summary.count, color: 'blue' },
    { label: 'Total Cost', value: formatCurrency(summary.totalCost), color: 'red' },
    ...(summary.byType.vaccination ? [{ label: 'Vaccinations', value: summary.byType.vaccination, color: 'indigo' }] : []),
    ...(summary.byType.treatment ? [{ label: 'Treatments', value: summary.byType.treatment, color: 'amber' }] : []),
  ];

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Health Records 💉</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Vaccinations, treatments & checkups</p>
          </div>
          <button onClick={() => { setForm(defaultForm); setEditId(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2 flex-shrink-0"><FiPlus size={16} /> <span className="hidden sm:inline">Add Record</span><span className="sm:hidden">Add</span></button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv({
            filename: 'health_records',
            headers: ['Date', 'Cattle', 'Type', 'Description', 'Medicine', 'Cost', 'Vet', 'Next Due'],
            rows: records.map(r => [formatDate(r.date), r.cattleId?.tagNumber || '-', r.type, r.description, r.medicine || '', r.cost || 0, r.vetName || '', r.nextDueDate ? formatDate(r.nextDueDate) : '']),
          })} className="btn-secondary flex items-center gap-1 text-xs sm:text-sm"><FiFileText size={14} /> <span className="hidden sm:inline">Export</span> CSV</button>
          <button onClick={() => exportPdf({
            title: 'Health Records Report',
            period: `${filters.startDate || 'All'} to ${filters.endDate || 'Now'}`,
            summaryCards: summaryCardsData.map(s => ({ label: s.label, value: s.value })),
            tableHeaders: ['Date', 'Cattle', 'Type', 'Description', 'Medicine', 'Cost', 'Next Due'],
            tableRows: records.map(r => [formatDate(r.date), r.cattleId?.tagNumber || '-', r.type, r.description, r.medicine || '-', r.cost ? formatCurrency(r.cost) : '-', r.nextDueDate ? formatDate(r.nextDueDate) : '-']),
          })} className="btn-secondary flex items-center gap-1 text-xs sm:text-sm"><FiDownload size={14} /> <span className="hidden sm:inline">Export</span> PDF</button>
        </div>
      </div>

      {/* Upcoming Vaccinations Alert */}
      {upcoming.length > 0 && (
        <div className="bg-orange-100 border-l-4 border-orange-500 p-4 rounded-lg dark:bg-orange-900/20 dark:border-orange-400">
          <div className="flex items-start">
            <FiAlertCircle className="text-orange-500 dark:text-orange-400 mt-0.5 mr-3" size={18} />
            <div className="flex-1">
              <h3 className="font-semibold text-orange-800 dark:text-orange-200 text-sm">Upcoming Due — Next 14 Days</h3>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {upcoming.slice(0, 6).map((u, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-lg p-2 text-sm">
                    <p className="font-medium text-gray-900 dark:text-white">{u.cattleId?.tagNumber}</p>
                    <p className="text-gray-600 dark:text-gray-400 text-xs">{u.description} — {formatDate(u.nextDueDate)}</p>
                  </div>
                ))}
              </div>
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
        <div className="grid grid-cols-2 sm:flex gap-3">
          <select className="input sm:w-auto" value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value, page: 1 })}>
            <option value="">All Types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="input sm:w-auto" value={filters.cattleId} onChange={e => setFilters({ ...filters, cattleId: e.target.value, page: 1 })}>
            <option value="">All Cattle</option>
            {cattleList.map(c => <option key={c._id} value={c._id}>{c.tagNumber} - {c.breed}</option>)}
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
          <div className="py-8 text-center text-gray-400">No health records found</div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50 dark:bg-gray-800 border-b text-xs text-gray-500 uppercase">
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Cattle</th>
                  <th className="px-3 py-2 text-left">Type</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Medicine</th>
                  <th className="px-3 py-2 text-left">Cost</th>
                  <th className="px-3 py-2 text-left">Next Due</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr></thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={r._id} className={`border-b ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}`}>
                      <td className="px-4 py-2">
                        <span className="text-gray-600 dark:text-gray-400">{formatDate(r.date)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-semibold dark:text-white">{r.cattleId?.tagNumber || '-'}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${typeBadge[r.type]}`}>{r.type}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="truncate max-w-[200px] block dark:text-gray-300">{r.description}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="dark:text-gray-400">{r.medicine || '-'}</span>
                      </td>
                      <td className="px-3 py-2">
                        {r.cost ? <span className="font-bold text-red-600 dark:text-red-400">{formatCurrency(r.cost)}</span> : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-3 py-2">
                        {r.nextDueDate ? (
                          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
                            {formatDate(r.nextDueDate)}
                          </span>
                        ) : <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-3 py-2">
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

            {/* Mobile Cards */}
            <div className="md:hidden divide-y dark:divide-gray-800">
              {records.map((r, i) => (
                <div key={r._id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold dark:text-white">{r.cattleId?.tagNumber || '-'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${typeBadge[r.type]}`}>{r.type}</span>
                      </div>
                      <p className="text-xs text-gray-400">{formatDate(r.date)}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(r)} className="p-2 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"><FiEdit2 size={16} /></button>
                      <button onClick={() => handleDelete(r._id)} className="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"><FiTrash2 size={16} /></button>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-900 dark:text-gray-100">{r.description}</p>
                    {r.medicine && <p className="text-gray-600 dark:text-gray-400"><strong>Medicine:</strong> {r.medicine}</p>}
                    {r.cost && <p className="font-bold text-red-600 dark:text-red-400"><strong>Cost:</strong> {formatCurrency(r.cost)}</p>}
                    {r.nextDueDate && (
                      <p className="text-orange-700 dark:text-orange-400">
                        <strong>Next Due:</strong> {formatDate(r.nextDueDate)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      {/* Confirm Dialog */}
      <ConfirmDialog 
        isOpen={confirm.open} 
        onClose={() => setConfirm({ ...confirm, open: false })} 
        title={confirm.title} 
        message={confirm.message} 
        variant={confirm.variant} 
        onConfirm={confirm.onConfirm} 
      />
    </div>
  );
}