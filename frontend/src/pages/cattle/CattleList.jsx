import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';
import { formatDate, formatCurrency } from '../../utils/helpers';
import Modal from '../../components/Modal';
import DataTable from '../../components/DataTable';
import Pagination from '../../components/Pagination';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiEye, FiDownload, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import toast from 'react-hot-toast';

const categories = ['', 'milking', 'dry', 'heifer', 'calf', 'bull', 'pregnant'];
const statuses = ['', 'active', 'sold', 'dead'];
const categoryBadge = {
  milking: 'bg-emerald-100 text-emerald-700', dry: 'bg-yellow-100 text-yellow-700',
  heifer: 'bg-purple-100 text-purple-700', calf: 'bg-blue-100 text-blue-700',
  bull: 'bg-red-100 text-red-700', pregnant: 'bg-pink-100 text-pink-700',
};
const genBadge = {
  F1: 'bg-orange-100 text-orange-700', F2: 'bg-amber-100 text-amber-700',
  F3: 'bg-yellow-100 text-yellow-700', F4: 'bg-lime-100 text-lime-700',
  F5: 'bg-green-100 text-green-700',
};

const defaultForm = {
  tagNumber: '', breed: '', gender: 'female', category: 'milking',
  source: 'born_on_farm', motherTag: '', dateOfBirth: '', purchaseDate: '', purchasePrice: '', weight: '',
  notes: '', lactationNumber: '',
  semenName: '', semenCode: '', semenCompany: '',
};

export default function CattleList() {
  const [cattle, setCattle] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', category: '', status: 'active', page: 1 });
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [predictedGen, setPredictedGen] = useState(null); // { generation, mother }
  const [predicting, setPredicting] = useState(false);
  const [showSemen, setShowSemen] = useState(false);

  const fetchCattle = () => {
    setLoading(true);
    const params = { ...filters, limit: 20 };
    Object.keys(params).forEach(k => { if (!params[k]) delete params[k]; });
    api.get('/cattle', { params })
      .then(res => { setCattle(res.data.data); setPagination(res.data.pagination); })
      .catch(() => toast.error('Failed to load cattle'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCattle(); }, [filters]);

  // Predict generation when mother tag is entered
  const fetchGeneration = useCallback(async (motherTag) => {
    if (!motherTag || motherTag.length < 1) { setPredictedGen(null); return; }
    setPredicting(true);
    try {
      const res = await api.get(`/cattle/predict-generation/${motherTag}`);
      setPredictedGen(res.data.data);
      if (res.data.data.generation) {
        toast.success(`Predicted generation: ${res.data.data.generation}`, { duration: 2000, icon: '🧬' });
      }
    } catch { setPredictedGen(null); }
    finally { setPredicting(false); }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await api.put(`/cattle/${editId}`, form);
        toast.success('Cattle updated');
      } else {
        await api.post('/cattle', form);
        toast.success('Cattle added');
      }
      setModalOpen(false); setForm(defaultForm); setEditId(null); setPredictedGen(null); setShowSemen(false);
      fetchCattle();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleEdit = (c) => {
    setForm({
      tagNumber: c.tagNumber, breed: c.breed, gender: c.gender,
      category: c.category, source: c.source || 'born_on_farm',
      motherTag: c.motherTag || '',
      dateOfBirth: c.dateOfBirth?.slice(0, 10) || '',
      purchaseDate: c.purchaseDate?.slice(0, 10) || '', purchasePrice: c.purchasePrice || '',
      weight: c.weight || '', notes: c.notes || '',
      semenName: c.semenName || '', semenCode: c.semenCode || '', semenCompany: c.semenCompany || '',
      lactationNumber: c.lactationNumber || '',
    });
    setPredictedGen(c.generation ? { generation: c.generation, mother: null } : null);
    setShowSemen(!!(c.semenName || c.semenCode || c.semenCompany));
    setEditId(c._id); setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this cattle record?')) return;
    try { await api.delete(`/cattle/${id}`); toast.success('Deleted'); fetchCattle(); } catch { toast.error('Failed'); }
  };

  const handleDownloadPdf = async (id, tagNumber) => {
    try {
      toast.loading('Generating PDF...', { id: 'pdf' });
      const res = await api.get(`/cattle/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url; link.download = `cattle-${tagNumber}-profile.pdf`; link.click();
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded!', { id: 'pdf' });
    } catch { toast.error('Failed to generate PDF', { id: 'pdf' }); }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const columns = [
    { key: 'tagNumber', label: 'Tag No', render: (r) => <Link to={`/cattle/${r._id}`} className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">{r.tagNumber}</Link> },
    { key: 'breed', label: 'Breed' },
    { key: 'category', label: 'Category', render: (r) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${categoryBadge[r.category] || 'bg-gray-100'}`}>{r.category}</span> },
    { key: 'source', label: 'Source', render: (r) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.source === 'purchased' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>{r.source === 'purchased' ? '🛒 Purchased' : '🏠 Farm'}</span> },
    { key: 'generation', label: 'Generation', render: (r) => r.generation ? <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${genBadge[r.generation] || 'bg-teal-100 text-teal-700'}`}>{r.generation}</span> : <span className="text-gray-300">-</span> },
    { key: 'lactation', label: 'Lactation', render: (r) => r.gender === 'female' && r.lactationNumber > 0 ? <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400">L-{r.lactationNumber}</span> : <span className="text-gray-300 dark:text-gray-600">-</span> },
    { key: 'actions', label: 'Actions', render: (r) => (
      <div className="flex gap-1.5">
        <button onClick={(e) => { e.stopPropagation(); setDetailModal(r); }} className="text-blue-500 hover:text-blue-700" title="View"><FiEye size={15} /></button>
        <button onClick={(e) => { e.stopPropagation(); handleEdit(r); }} className="text-emerald-500 hover:text-emerald-700" title="Edit"><FiEdit2 size={15} /></button>
        <button onClick={(e) => { e.stopPropagation(); handleDownloadPdf(r._id, r.tagNumber); }} className="text-purple-500 hover:text-purple-700" title="PDF"><FiDownload size={15} /></button>
        <button onClick={(e) => { e.stopPropagation(); handleDelete(r._id); }} className="text-red-400 hover:text-red-600" title="Delete"><FiTrash2 size={15} /></button>
      </div>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">🐄 Cattle Management</h1>
          <p className="text-gray-500 text-sm">Manage your cattle records</p>
        </div>
        <button onClick={() => { setForm(defaultForm); setEditId(null); setPredictedGen(null); setShowSemen(false); setModalOpen(true); }} className="btn-primary flex items-center gap-2">
          <FiPlus size={18} /> Add Cattle
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="input pl-10" placeholder="Search by tag no..." value={filters.search} onChange={e => setFilters({ ...filters, search: e.target.value, page: 1 })} />
            </div>
          </div>
          <select className="input w-auto" value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value, page: 1 })}>
            <option value="">All Categories</option>
            {categories.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input w-auto" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value, page: 1 })}>
            {statuses.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
          </select>
        </div>
      </div>

      <div className="card p-0">
        {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div></div> : (
          <>
            <DataTable columns={columns} data={cattle} emptyMessage="No cattle found. Add your first one!" />
            <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onPageChange={p => setFilters({ ...filters, page: p })} />
          </>
        )}
      </div>

      {/* ═══ Add/Edit Modal ═══ */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Cattle' : 'Add Cattle'} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <h3 className="text-sm font-bold text-emerald-700 uppercase tracking-wide">Basic Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Tag No *</label><input className="input" required value={form.tagNumber} onChange={set('tagNumber')} placeholder="e.g. 101 or IN081234567" /></div>
            <div><label className="label">Breed *</label><input className="input" required value={form.breed} onChange={set('breed')} placeholder="Holstein, Gir, Sahiwal" /></div>
            <div><label className="label">Gender *</label><select className="input" value={form.gender} onChange={set('gender')}><option value="female">Female</option><option value="male">Male</option></select></div>
            <div><label className="label">Category *</label><select className="input" value={form.category} onChange={set('category')}>{categories.filter(Boolean).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="label">Weight (kg)</label><input type="number" className="input" value={form.weight} onChange={set('weight')} /></div>
            {form.gender === 'female' && ['milking', 'dry', 'pregnant'].includes(form.category) && (
              <div><label className="label">Lactation No.</label><input type="number" min="0" className="input" value={form.lactationNumber} onChange={set('lactationNumber')} placeholder="e.g. 2" /></div>
            )}
            <div><label className="label">Date of Birth</label><input type="date" className="input" value={form.dateOfBirth} onChange={set('dateOfBirth')} /></div>
            <div className="col-span-2">
              <label className="label mb-2">Source *</label>
              <div className="flex gap-3">
                <button type="button" onClick={() => setForm({ ...form, source: 'born_on_farm', purchaseDate: '', purchasePrice: '' })} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border-2 transition-all ${form.source === 'born_on_farm' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                  🏠 Born on Farm
                </button>
                <button type="button" onClick={() => setForm({ ...form, source: 'purchased', motherTag: '' })} className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium border-2 transition-all ${form.source === 'purchased' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'}`}>
                  🛒 Purchased from Outside
                </button>
              </div>
            </div>

            {/* Born on Farm → Mother Tag + Generation */}
            {form.source === 'born_on_farm' && (
              <>
                <div>
                  <label className="label">Mother's Tag No</label>
                  <input className="input" value={form.motherTag} onChange={set('motherTag')} onBlur={() => fetchGeneration(form.motherTag)} placeholder="Enter mother's tag #" />
                </div>
                <div>
                  <label className="label">Predicted Generation</label>
                  <div className="flex items-center gap-2 h-[42px]">
                    {predicting ? (
                      <div className="flex items-center gap-2 text-sm text-gray-400"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div> Predicting...</div>
                    ) : predictedGen?.generation ? (
                      <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${genBadge[predictedGen.generation] || 'bg-teal-100 text-teal-700'}`}>
                        🧬 {predictedGen.generation}
                        {predictedGen.mother && <span className="font-normal text-xs ml-2">(Mother: {predictedGen.mother.tagNumber}{predictedGen.mother.generation ? ` — ${predictedGen.mother.generation}` : ''})</span>}
                      </span>
                    ) : form.motherTag ? (
                      <span className="text-xs text-gray-400">Enter mother tag & click outside to predict</span>
                    ) : (
                      <span className="text-xs text-gray-400">Enter mother tag to auto-predict</span>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Purchased → Purchase fields */}
            {form.source === 'purchased' && (
              <>
                <div><label className="label">Purchase Date *</label><input type="date" className="input" required value={form.purchaseDate} onChange={set('purchaseDate')} /></div>
                <div><label className="label">Purchase Price (₹) *</label><input type="number" className="input" required value={form.purchasePrice} onChange={set('purchasePrice')} /></div>
              </>
            )}
          </div>

          {/* Semen / Genetics — always visible for born_on_farm, collapsible for purchased */}
          {form.source === 'born_on_farm' ? (
            <>
              <h3 className="text-sm font-bold text-purple-700 uppercase tracking-wide mt-4">🧬 Semen / Genetics Details</h3>
              <div className="grid grid-cols-3 gap-4 bg-purple-50 p-3 rounded-lg">
                <div><label className="label">Semen Name</label><input className="input" value={form.semenName} onChange={set('semenName')} placeholder="e.g. ABS Hammer" /></div>
                <div><label className="label">Semen Code</label><input className="input" value={form.semenCode} onChange={set('semenCode')} placeholder="Straw code" /></div>
                <div><label className="label">Company</label><input className="input" value={form.semenCompany} onChange={set('semenCompany')} placeholder="ABS, Select Sires..." /></div>
              </div>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setShowSemen(!showSemen)} className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800 font-medium mt-2">
                {showSemen ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                🧬 Semen / Genetics Details (Optional)
              </button>
              {showSemen && (
                <div className="grid grid-cols-3 gap-4 bg-purple-50 p-3 rounded-lg">
                  <div><label className="label">Semen Name</label><input className="input" value={form.semenName} onChange={set('semenName')} placeholder="e.g. ABS Hammer" /></div>
                  <div><label className="label">Semen Code</label><input className="input" value={form.semenCode} onChange={set('semenCode')} placeholder="Straw code" /></div>
                  <div><label className="label">Company</label><input className="input" value={form.semenCompany} onChange={set('semenCompany')} placeholder="ABS, Select Sires..." /></div>
                </div>
              )}
            </>
          )}

          <div><label className="label">Notes</label><textarea className="input" rows={2} value={form.notes} onChange={set('notes')} /></div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : editId ? 'Update' : 'Add Cattle'}</button>
          </div>
        </form>
      </Modal>

      {/* ═══ Detail Modal ═══ */}
      <Modal isOpen={!!detailModal} onClose={() => setDetailModal(null)} title="Cattle Details" size="lg">
        {detailModal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Tag No:</span> <strong>{detailModal.tagNumber}</strong></div>
              <div><span className="text-gray-500">Breed:</span> <strong>{detailModal.breed}</strong></div>
              <div><span className="text-gray-500">Category:</span> <strong>{detailModal.category}</strong></div>
              <div><span className="text-gray-500">Gender:</span> <strong>{detailModal.gender}</strong></div>
              <div><span className="text-gray-500">Weight:</span> <strong>{detailModal.weight ? `${detailModal.weight} kg` : '-'}</strong></div>
              {detailModal.gender === 'female' && detailModal.lactationNumber > 0 && (
                <div><span className="text-gray-500">Lactation:</span> <strong className="text-pink-600">L-{detailModal.lactationNumber}</strong></div>
              )}
              <div><span className="text-gray-500">DOB:</span> <strong>{formatDate(detailModal.dateOfBirth)}</strong></div>
              <div><span className="text-gray-500">Source:</span> <strong>{detailModal.source === 'purchased' ? '🛒 Purchased' : '🏠 Born on Farm'}</strong></div>
              {detailModal.source !== 'purchased' && detailModal.motherTag && (
                <div><span className="text-gray-500">Mother Tag:</span> <strong>{detailModal.motherTag}</strong></div>
              )}
              {detailModal.generation && (
                <div><span className="text-gray-500">Generation:</span> <strong className={`px-2 py-0.5 rounded-full text-xs ${genBadge[detailModal.generation] || 'bg-teal-100 text-teal-700'}`}>{detailModal.generation}</strong></div>
              )}
              {detailModal.source === 'purchased' && (
                <>
                  <div><span className="text-gray-500">Purchase Date:</span> <strong>{formatDate(detailModal.purchaseDate)}</strong></div>
                  <div><span className="text-gray-500">Purchase Price:</span> <strong>{detailModal.purchasePrice ? formatCurrency(detailModal.purchasePrice) : '-'}</strong></div>
                </>
              )}
            </div>
            {detailModal.semenName && (
              <div className="bg-purple-50 p-3 rounded-lg">
                <p className="text-xs font-bold text-purple-600 mb-1">🧬 Semen / Genetics</p>
                <p className="text-sm"><strong>{detailModal.semenName}</strong> {detailModal.semenCode && `(${detailModal.semenCode})`} {detailModal.semenCompany && `— ${detailModal.semenCompany}`}</p>
              </div>
            )}
            <div className="flex gap-2 pt-3 border-t">
              <button onClick={() => handleDownloadPdf(detailModal._id, detailModal.tagNumber)} className="btn-primary flex items-center gap-2 text-sm"><FiDownload size={16} /> Download PDF</button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
