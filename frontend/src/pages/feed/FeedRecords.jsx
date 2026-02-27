import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { formatDate, formatCurrency } from '../../utils/helpers';
import Modal from '../../components/Modal';
import ConfirmDialog from '../../components/ConfirmDialog';
import Pagination from '../../components/Pagination';
import { FiPlus, FiEdit2, FiTrash2, FiDownload, FiFileText, FiPackage, FiLayers, FiDatabase } from 'react-icons/fi';
import { FaIndianRupeeSign } from 'react-icons/fa6';
import DateRangeFilter, { getDateRange } from '../../components/DateRangeFilter';
import { exportPdf } from '../../utils/exportPdf';
import { exportCsv } from '../../utils/exportCsv';
import { useAppConfig } from '../../context/AppConfigContext';
import toast from 'react-hot-toast';

const defaultForm = { date: new Date().toISOString().slice(0, 10), feedType: '', quantity: '', unit: 'kg', cost: '', notes: '' };

export default function FeedRecords() {
  const { feedTypes } = useAppConfig();
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
  const [confirm, setConfirm] = useState({ open: false, title: '', message: '', onConfirm: null, variant: 'danger' });

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
    setConfirm({ 
      open: true, 
      title: 'Delete Record?', 
      message: 'Delete this feed record? This action cannot be undone.', 
      variant: 'danger',
      onConfirm: async () => {
        try { await api.delete(`/feed/${id}`); toast.success('Deleted'); fetch(); } catch { toast.error('Failed'); }
      }
    });
  };

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Feed Management 🌾</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">Track feed usage, types & costs</p>
          </div>
          <button onClick={() => { setForm(defaultForm); setEditId(null); setModalOpen(true); }} className="btn-primary flex items-center gap-2 flex-shrink-0"><FiPlus size={16} /> <span className="hidden sm:inline">Add Record</span><span className="sm:hidden">Add</span></button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCsv({
            filename: 'feed_records',
            headers: ['Date', 'Feed Type', 'Quantity', 'Unit', 'Cost', 'Notes'],
            rows: records.map(r => [formatDate(r.date), r.feedType, r.quantity, r.unit || 'kg', r.cost || 0, r.notes || '']),
          })} className="btn-secondary flex items-center gap-1 text-xs sm:text-sm"><FiFileText size={14} /> <span className="hidden sm:inline">Export</span> CSV</button>
          <button onClick={() => exportPdf({
            title: 'Feed Records Report',
            period: `${filters.startDate || 'All'} to ${filters.endDate || 'Now'}`,
            summaryCards: [
              { label: 'Total Feed Cost', value: formatCurrency(summary.totalCost) },
              { label: 'Total Quantity', value: `${summary.totalQty.toFixed(1)} kg` },
              { label: 'Records', value: summary.count },
              { label: 'Feed Types', value: Object.keys(summary.byType).length }
            ],
            tableHeaders: ['Date', 'Feed Type', 'Quantity', 'Cost', 'Notes'],
            tableRows: records.map(r => [formatDate(r.date), r.feedType, `${r.quantity} ${r.unit || 'kg'}`, formatCurrency(r.cost), r.notes || '-']),
          })} className="btn-secondary flex items-center gap-1 text-xs sm:text-sm"><FiDownload size={14} /> <span className="hidden sm:inline">Export</span> PDF</button>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-orange-500">Total Feed Cost</p>
            <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{formatCurrency(summary.totalCost)}</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-emerald-500">Total Quantity</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{summary.totalQty.toFixed(1)} kg</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-blue-500">Records</p>
            <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{summary.count}</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 text-center">
            <p className="text-xs text-purple-500">Feed Types</p>
            <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{Object.keys(summary.byType).length}</p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-emerald-200 dark:border-emerald-900 border-t-emerald-600"></div>
            <p className="text-sm text-gray-400 dark:text-gray-500">Loading records...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="py-8 text-center text-gray-400">
            <p className="mb-3">No feed records found</p>
            <button onClick={() => { setForm(defaultForm); setEditId(null); setModalOpen(true); }} className="btn-primary text-sm"><FiPlus size={14} className="inline mr-1" /> Add Record</button>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10"><tr className="bg-gray-50 dark:bg-gray-800 border-b text-xs text-gray-500 uppercase">
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Feed Type</th>
                  <th className="px-3 py-2 text-center">Quantity</th>
                  <th className="px-3 py-2 text-center">Cost</th>
                  <th className="px-3 py-2 text-left">Notes</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr></thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={r._id} className={`border-b ${i % 2 ? 'bg-gray-50/50 dark:bg-gray-800/20' : ''}`}>
                      <td className="px-4 py-2">
                        <span className="text-gray-600 dark:text-gray-400">{formatDate(r.date)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-gray-800 dark:text-gray-200">
                          <FiPackage size={13} className="text-emerald-500" /> {r.feedType}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="font-medium dark:text-gray-300">{r.quantity} {r.unit || 'kg'}</span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(r.cost)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-gray-500 dark:text-gray-400 truncate max-w-[150px] block">{r.notes || '-'}</span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1.5 justify-center">
                          <button onClick={() => handleEdit(r)} className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors" title="Edit">
                            <FiEdit2 size={15} />
                          </button>
                          <button onClick={() => handleDelete(r._id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" title="Delete">
                            <FiTrash2 size={15} />
                          </button>
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
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FiPackage size={14} className="text-emerald-500" />
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{r.feedType}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(r.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(r.cost)}</p>
                      <p className="text-xs text-gray-500">{r.quantity} {r.unit || 'kg'}</p>
                    </div>
                  </div>
                  {r.notes && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded px-2 py-1">
                      {r.notes}
                    </p>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => handleEdit(r)} className="flex-1 btn-secondary text-xs py-1.5 flex items-center justify-center gap-1">
                      <FiEdit2 size={12} /> Edit
                    </button>
                    <button onClick={() => handleDelete(r._id)} className="btn-danger text-xs py-1.5 px-3">
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onPageChange={p => setFilters({ ...filters, page: p })} />
          </>
        )}
      </div>

      {/* Modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Feed Record' : 'Add Feed Record'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label">Date *</label><input type="date" className="input" required value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <div><label className="label">Feed Type *</label><input className="input" required list="feedtype-list" value={form.feedType} onChange={e => setForm({ ...form, feedType: e.target.value })} placeholder="Select or type feed" /><datalist id="feedtype-list">{feedTypes.map(f => <option key={f} value={f} />)}</datalist></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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