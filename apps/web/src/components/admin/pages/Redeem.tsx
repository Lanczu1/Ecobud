import { useState, useEffect, useRef } from 'react';
import { Gift, Trash2, Search, CheckCircle, XCircle, Package, Plus, Edit2, Tag, Coins, Upload, X, Clock, User, AlertTriangle, Eye } from 'lucide-react';
import { adminGet, adminDelete, adminPatch, adminPost, adminPostForm, API_HOST } from '../../../utils/adminApi';

interface RedeemItem {
  id: string;
  title: string;
  description: string;
  coinCost: number;
  imageUrl: string | null;
  category: string;
  stock: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RedeemStats {
  total: number;
  active: number;
  inactive: number;
  outOfStock: number;
}

interface RedeemRequest {
  id: string;
  userId: string;
  itemId: string;
  coinCost: number;
  status: string;
  rejectReason: string | null;
  userName: string;
  itemTitle: string;
  itemImage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RequestStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  readyToClaim: number;
  claimed: number;
}

const categoryOptions = ['general', 'eco-friendly', 'lifestyle', 'accessories', 'food', 'merch'];

const statusColors: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  ready_to_claim: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  claimed: 'bg-gray-50 text-gray-600 border-gray-200',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  ready_to_claim: 'Ready to Claim',
  rejected: 'Rejected',
  claimed: 'Claimed',
};

export function Redeem() {
  const [mainTab, setMainTab] = useState<'items' | 'requests'>('items');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [items, setItems] = useState<RedeemItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<RedeemStats | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editItem, setEditItem] = useState<RedeemItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCoinCost, setFormCoinCost] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formCategory, setFormCategory] = useState('general');
  const [formStock, setFormStock] = useState('-1');

  // Requests state
  const [requests, setRequests] = useState<RedeemRequest[]>([]);
  const [requestStats, setRequestStats] = useState<RequestStats | null>(null);
  const [requestFilter, setRequestFilter] = useState('all');
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; requestId: string }>({ open: false, requestId: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [approveModal, setApproveModal] = useState<{ open: boolean; requestId: string }>({ open: false, requestId: '' });
  const [approveLocation, setApproveLocation] = useState('Barangay San Isidro Hall');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // ─── Items ──────────────────────────────────────────────────────────────

  const fetchItems = async () => {
    try {
      setLoading(true);
      const [itemsData, statsData] = await Promise.all([
        adminGet<RedeemItem[]>('/redeem'),
        adminGet<RedeemStats>('/redeem/stats'),
      ]);
      setItems(itemsData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch redeem items', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormCoinCost('');
    setFormImageUrl('');
    setFormImageFile(null);
    setFormImagePreview('');
    setFormCategory('general');
    setFormStock('-1');
    setEditItem(null);
  };

  const openCreateModal = () => { resetForm(); setShowCreateModal(true); };

  const openEditModal = (item: RedeemItem) => {
    setFormTitle(item.title);
    setFormDescription(item.description);
    setFormCoinCost(String(item.coinCost));
    setFormImageUrl(item.imageUrl || '');
    setFormImagePreview(item.imageUrl ? (item.imageUrl.startsWith('http') ? item.imageUrl : `${API_HOST}${item.imageUrl}`) : '');
    setFormCategory(item.category);
    setFormStock(String(item.stock));
    setEditItem(item);
    setShowCreateModal(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }
    setFormImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setFormImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setFormImageFile(null);
    setFormImageUrl('');
    setFormImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!formImageFile) return formImageUrl || null;
    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('image', formImageFile);
      const result = await adminPostForm<{ url: string }>('/redeem/upload', formData);
      return result.url;
    } catch (error) { throw error; } finally { setUploadingImage(false); }
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formCoinCost) return;
    try {
      let imageUrl = formImageUrl || null;
      if (formImageFile) imageUrl = await uploadImage();
      const body = { title: formTitle.trim(), description: formDescription.trim(), coinCost: Number(formCoinCost), imageUrl, category: formCategory, stock: Number(formStock) };
      if (editItem) {
        await adminPatch(`/redeem/${editItem.id}`, body);
      } else {
        await adminPost<RedeemItem>('/redeem', body);
      }
      setShowCreateModal(false);
      resetForm();
      fetchItems();
    } catch (error) { console.error('Failed to save redeem item', error); }
  };

  const handleToggleActive = async (id: string) => {
    try {
      const updated = await adminPatch<RedeemItem>(`/redeem/${id}/toggle`, {});
      setItems(prev => prev.map(i => i.id === id ? { ...i, isActive: updated.isActive } : i));
      if (stats) setStats({ ...stats, active: updated.isActive ? stats.active + 1 : stats.active - 1, inactive: updated.isActive ? stats.inactive - 1 : stats.inactive + 1 });
    } catch (error) { console.error('Failed to toggle item', error); }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await adminDelete(`/redeem/${id}`);
        setItems(prev => prev.filter(i => i.id !== id));
        if (stats) setStats({ ...stats, total: stats.total - 1 });
      } catch (error) { console.error('Failed to delete item', error); }
    }
  };

  const filteredItems = items.filter(i => {
    if (filterStatus === 'active') return i.isActive;
    if (filterStatus === 'inactive') return !i.isActive;
    if (filterStatus === 'outOfStock') return i.stock === 0;
    return true;
  }).filter(i => i.title.toLowerCase().includes(search.toLowerCase()));

  // ─── Requests ───────────────────────────────────────────────────────────

  const fetchRequests = async () => {
    try {
      setRequestsLoading(true);
      const [reqsData, statsData] = await Promise.all([
        adminGet<RedeemRequest[]>(`/redeem/requests${requestFilter !== 'all' ? `?status=${requestFilter}` : ''}`),
        adminGet<RequestStats>('/redeem/requests/stats'),
      ]);
      setRequests(reqsData);
      setRequestStats(statsData);
    } catch (error) { console.error('Failed to fetch requests', error); }
    finally { setRequestsLoading(false); }
  };

  useEffect(() => { if (mainTab === 'requests') fetchRequests(); }, [mainTab, requestFilter]);

  const openApproveModal = (id: string) => {
    setApproveLocation('Barangay San Isidro Hall');
    setApproveModal({ open: true, requestId: id });
  };

  const handleApprove = async () => {
    try {
      setProcessingId(approveModal.requestId);
      await adminPatch(`/redeem/requests/${approveModal.requestId}/approve`, { claimLocation: approveLocation });
      setApproveModal({ open: false, requestId: '' });
      fetchRequests();
    } catch (error) { console.error('Failed to approve', error); }
    finally { setProcessingId(null); }
  };

  const openRejectModal = (id: string) => {
    setRejectReason('');
    setRejectModal({ open: true, requestId: id });
  };

  const handleReject = async () => {
    try {
      setProcessingId(rejectModal.requestId);
      await adminPatch(`/redeem/requests/${rejectModal.requestId}/reject`, { reason: rejectReason });
      setRejectModal({ open: false, requestId: '' });
      fetchRequests();
    } catch (error) { console.error('Failed to reject', error); }
    finally { setProcessingId(null); }
  };

  const filteredRequests = requests.filter(r => {
    if (requestFilter !== 'all' && r.status !== requestFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return r.userName.toLowerCase().includes(q) || r.itemTitle.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="p-8 space-y-6 bg-gray-50/50 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Redeem</h2>
          <p className="text-gray-500 text-sm mt-1">Manage reward catalog and redemption requests</p>
        </div>
        {mainTab === 'items' && (
          <button onClick={openCreateModal} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Item
          </button>
        )}
      </div>

      {/* Main Tabs */}
      <div className="flex gap-2 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: 'items', label: 'Manage Items', icon: <Gift className="w-4 h-4" /> },
          { key: 'requests', label: 'Redemption Requests', icon: <Clock className="w-4 h-4" /> },
        ].map(t => (
          <button key={t.key} onClick={() => setMainTab(t.key as any)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${mainTab === t.key ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.icon}{t.label}
            {t.key === 'requests' && requestStats && requestStats.pending > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{requestStats.pending}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ ITEMS TAB ═══ */}
      {mainTab === 'items' && (
        <>
          {stats && (
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Total Items', value: stats.total, color: 'text-gray-900' },
                { label: 'Active', value: stats.active, color: 'text-green-600' },
                { label: 'Inactive', value: stats.inactive, color: 'text-red-600' },
                { label: 'Out of Stock', value: stats.outOfStock, color: 'text-orange-600' },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                  <p className="text-sm text-gray-500 font-medium">{s.label}</p>
                  <p className={`text-3xl font-serif font-bold mt-1 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all" />
            </div>
            {[
              { key: 'all', label: 'All' },
              { key: 'active', label: 'Active', icon: <CheckCircle className="w-3 h-3" /> },
              { key: 'inactive', label: 'Inactive', icon: <XCircle className="w-3 h-3" /> },
              { key: 'outOfStock', label: 'Out of Stock', icon: <Package className="w-3 h-3" /> },
            ].map(f => (
              <button key={f.key} onClick={() => setFilterStatus(f.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl border font-medium transition-all ${filterStatus === f.key ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}>
                {f.icon}{f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredItems.map(item => (
                <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
                  <div className="relative h-36 overflow-hidden bg-gradient-to-br from-amber-50 to-yellow-100">
                    {item.imageUrl ? (
                      <img src={item.imageUrl.startsWith('http') ? item.imageUrl : `${API_HOST}${item.imageUrl}`} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Gift className="w-12 h-12 text-amber-300" /></div>
                    )}
                    {!item.isActive && <div className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">INACTIVE</div>}
                    {item.stock === 0 && <div className="absolute top-3 left-3 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">OUT OF STOCK</div>}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <span className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border bg-gray-50 text-gray-600 border-gray-100">
                        <Tag className="w-3 h-3" />{item.category}
                      </span>
                      <div className="flex items-center gap-1 text-amber-600 font-bold text-sm">
                        <Coins className="w-4 h-4" />{item.coinCost}
                      </div>
                    </div>
                    <h3 className="font-serif font-bold text-gray-900 mb-1">{item.title}</h3>
                    {item.description && <p className="text-xs text-gray-400 mb-3 line-clamp-2">{item.description}</p>}
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                      <Package className="w-3 h-3" /><span>Stock: {item.stock === -1 ? 'Unlimited' : item.stock}</span>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button onClick={() => handleToggleActive(item.id)}
                        className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold rounded-xl transition-colors ${item.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}>
                        {item.isActive ? <><XCircle className="w-3 h-3" /> Deactivate</> : <><CheckCircle className="w-3 h-3" /> Activate</>}
                      </button>
                      <button onClick={() => openEditModal(item)} className="flex items-center justify-center px-3 py-2 bg-blue-50 text-blue-600 text-xs font-semibold rounded-xl hover:bg-blue-100 transition-colors">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="flex items-center justify-center px-3 py-2 bg-red-50 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-100 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && filteredItems.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <Gift className="w-12 h-12 text-gray-200 mx-auto mb-3" /><p className="text-gray-400">No redeem items found</p>
            </div>
          )}
        </>
      )}

      {/* ═══ REQUESTS TAB ═══ */}
      {mainTab === 'requests' && (
        <>
          {requestStats && (
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: 'Pending', value: requestStats.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Approved', value: requestStats.approved, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Ready to Claim', value: requestStats.readyToClaim, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Rejected', value: requestStats.rejected, color: 'text-red-600', bg: 'bg-red-50' },
                { label: 'Claimed', value: requestStats.claimed, color: 'text-gray-600', bg: 'bg-gray-50' },
              ].map(s => (
                <div key={s.label} className={`${s.bg} rounded-2xl border border-gray-100 p-5 shadow-sm`}>
                  <p className="text-sm text-gray-500 font-medium">{s.label}</p>
                  <p className={`text-3xl font-serif font-bold mt-1 ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search by user or item..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all" />
            </div>
            {[
              { key: 'all', label: 'All' },
              { key: 'pending', label: 'Pending', icon: <Clock className="w-3 h-3" /> },
              { key: 'ready_to_claim', label: 'Ready', icon: <CheckCircle className="w-3 h-3" /> },
              { key: 'rejected', label: 'Rejected', icon: <XCircle className="w-3 h-3" /> },
              { key: 'claimed', label: 'Claimed', icon: <Eye className="w-3 h-3" /> },
            ].map(f => (
              <button key={f.key} onClick={() => setRequestFilter(f.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl border font-medium transition-all ${requestFilter === f.key ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}>
                {f.icon}{f.label}
              </button>
            ))}
          </div>

          {requestsLoading ? (
            <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div></div>
          ) : filteredRequests.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
              <Clock className="w-12 h-12 text-gray-200 mx-auto mb-3" /><p className="text-gray-400">No redemption requests found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map(req => (
                <div key={req.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    {/* Item Image */}
                    <div className="w-16 h-16 rounded-xl bg-gray-50 overflow-hidden flex-shrink-0">
                      {req.itemImage ? (
                        <img src={req.itemImage.startsWith('http') ? req.itemImage : `${API_HOST}${req.itemImage}`} alt={req.itemTitle} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Gift className="w-6 h-6 text-gray-300" /></div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-serif font-bold text-gray-900 truncate">{req.itemTitle}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${statusColors[req.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {statusLabels[req.status] || req.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{req.userName || 'Unknown'}</span>
                        <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-amber-500" />{req.coinCost} coins</span>
                        <span>{new Date(req.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {req.status === 'ready_to_claim' && req.claimCode && (
                        <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-2.5 text-xs space-y-1">
                          <div className="flex items-center gap-2"><span className="font-bold text-green-800">Code:</span><span className="font-mono font-bold text-green-700">{req.claimCode}</span></div>
                          {req.claimLocation && <div className="flex items-center gap-2"><span className="font-bold text-green-800">Location:</span><span className="text-green-700">{req.claimLocation}</span></div>}
                          {req.claimUntil && <div className="flex items-center gap-2"><span className="font-bold text-green-800">Until:</span><span className="text-green-700">{new Date(req.claimUntil).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</span></div>}
                        </div>
                      )}
                      {req.status === 'rejected' && req.rejectReason && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{req.rejectReason}</p>
                      )}
                    </div>

                    {/* Actions */}
                    {req.status === 'pending' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => openApproveModal(req.id)} disabled={processingId === req.id}
                          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50">
                          {processingId === req.id ? <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div> : <CheckCircle className="w-3.5 h-3.5" />}
                          Approve
                        </button>
                        <button onClick={() => openRejectModal(req.id)} disabled={processingId === req.id}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 transition-colors border border-red-200 disabled:opacity-50">
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ═══ REJECT MODAL ═══ */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setRejectModal({ open: false, requestId: '' })}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-serif font-bold text-gray-900 mb-2">Reject Request</h3>
            <p className="text-sm text-gray-500 mb-4">Provide a reason (optional). Coins will be refunded to the user.</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection..."
              className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 resize-none h-20" />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setRejectModal({ open: false, requestId: '' })}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={handleReject} disabled={processingId === rejectModal.requestId}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {processingId === rejectModal.requestId && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                Reject & Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ APPROVE MODAL ═══ */}
      {approveModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setApproveModal({ open: false, requestId: '' })}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-serif font-bold text-gray-900 mb-2">Approve Request</h3>
            <p className="text-sm text-gray-500 mb-4">Set the claim location. A claim code and deadline will be generated automatically.</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1 block">Claim Location</label>
                <input type="text" value={approveLocation} onChange={e => setApproveLocation(e.target.value)}
                  placeholder="e.g. Barangay San Isidro Hall"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
              </div>
              <div className="bg-green-50 rounded-xl p-3 text-xs text-green-700 space-y-1">
                <p className="font-semibold">Auto-generated on approval:</p>
                <p>• Claim Code: ECO-XXXXXX</p>
                <p>• Claim Until: 7 days from now</p>
                <p>• Instructions: Present code, valid ID, claim within period</p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setApproveModal({ open: false, requestId: '' })}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={handleApprove} disabled={processingId === approveModal.requestId}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {processingId === approveModal.requestId && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                Approve & Generate Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CREATE/EDIT MODAL ═══ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => { setShowCreateModal(false); resetForm(); }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-serif font-bold text-gray-900 mb-4">{editItem ? 'Edit Item' : 'Add New Item'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1 block">Title *</label>
                <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. Eco Water Bottle"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1 block">Description</label>
                <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Describe the item..."
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 resize-none h-20" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1 block">Coin Cost *</label>
                  <input type="number" value={formCoinCost} onChange={e => setFormCoinCost(e.target.value)} placeholder="100"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1 block">Stock (-1 = unlimited)</label>
                  <input type="number" value={formStock} onChange={e => setFormStock(e.target.value)} placeholder="-1"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1 block">Image</label>
                {formImagePreview ? (
                  <div className="relative w-full h-32 rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                    <img src={formImagePreview} alt="Preview" className="w-full h-full object-contain" />
                    <button onClick={handleRemoveImage} className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()} type="button"
                    className="w-full h-32 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center gap-2 hover:border-green-400 hover:bg-green-50 transition-all cursor-pointer">
                    <Upload className="w-8 h-8 text-gray-400" /><span className="text-sm text-gray-500">Click to upload image</span><span className="text-xs text-gray-400">JPG, PNG up to 5MB</span>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1 block">Category</label>
                <select value={formCategory} onChange={e => setFormCategory(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 bg-white">
                  {categoryOptions.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={!formTitle.trim() || !formCoinCost || uploadingImage}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {uploadingImage && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
                {editItem ? 'Save Changes' : 'Create Item'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
