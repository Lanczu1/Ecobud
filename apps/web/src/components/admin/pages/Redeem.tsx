import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Gift, Trash2, Search, CheckCircle, XCircle, Package, Plus, Edit2, Tag, Coins, Upload, X, Clock, User, AlertTriangle, Eye, Loader2, RefreshCw } from 'lucide-react';
import { adminGet, adminDelete, adminPatch, adminPost, adminPostForm, API_HOST } from '../../../utils/adminApi';
import { AdminPagination } from '../AdminPagination';
import { adminRealtimeService } from '../../../services/adminRealtimeService';
import { useToast } from '../../../context/ToastContext';

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
  claimCode?: string;
  claimLocation?: string;
  claimUntil?: string;
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
  pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  approved: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  ready_to_claim: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  rejected: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  claimed: 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
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
  const [itemPage, setItemPage] = useState(1);
  const [requestPage, setRequestPage] = useState(1);
  const [itemPagination, setItemPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [requestPagination, setRequestPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
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
  const [rejectModal, setRejectModal] = useState<{
    open: boolean;
    requestId: string;
    userName?: string;
    itemTitle?: string;
    coinCost?: number;
  }>({ open: false, requestId: '' });
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [approveModal, setApproveModal] = useState<{ open: boolean; requestId: string }>({ open: false, requestId: '' });
  const [approveLocation, setApproveLocation] = useState('Barangay San Isidro Hall');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deleteItemModal, setDeleteItemModal] = useState<{ open: boolean; item: RedeemItem | null }>({ open: false, item: null });
  const [removeRequestModal, setRemoveRequestModal] = useState<{ open: boolean; request: RedeemRequest | null }>({ open: false, request: null });
  const [deletingItem, setDeletingItem] = useState(false);
  const [removingRequest, setRemovingRequest] = useState(false);
  const toast = useToast();

  // ─── Items ──────────────────────────────────────────────────────────────

  const fetchItems = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const params = new URLSearchParams({ page: String(itemPage), pageSize: '25' });
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (search.trim()) params.set('search', search.trim());
      const [itemsData, statsData] = await Promise.all([
        adminGet<{ items: RedeemItem[]; pagination: typeof itemPagination }>(`/redeem?${params.toString()}`),
        adminGet<RedeemStats>('/redeem/stats'),
      ]);
      setItems(itemsData.items);
      setItemPagination(itemsData.pagination);
      setStats(statsData);
    } catch (error: any) {
      console.error('Failed to fetch redeem items', error);
      if (!silent) toast.error(error.message || 'Failed to fetch redeem items');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast, itemPage, filterStatus, search]);

  // Track main tab and filter via refs for realtime events
  const mainTabRef = useRef(mainTab);
  mainTabRef.current = mainTab;
  const requestFilterRef = useRef(requestFilter);
  requestFilterRef.current = requestFilter;

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
    if (!file.type.startsWith('image/')) { 
      toast.warning('Please select an image file (JPG or PNG)'); 
      return; 
    }
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
    } finally { setUploadingImage(false); }
  };

  const handleSave = async () => {
    if (!formTitle.trim() || !formCoinCost) return;
    try {
      let imageUrl = formImageUrl || null;
      if (formImageFile) imageUrl = await uploadImage();
      const body = { title: formTitle.trim(), description: formDescription.trim(), coinCost: Number(formCoinCost), imageUrl, category: formCategory, stock: Number(formStock) };
      if (editItem) {
        await adminPatch(`/redeem/${editItem.id}`, body);
        toast.success('Redeem item updated.');
      } else {
        await adminPost<RedeemItem>('/redeem', body);
        toast.success('New redeem item created.');
      }
      setShowCreateModal(false);
      resetForm();
      fetchItems();
    } catch (error: any) {
      console.error('Failed to save redeem item', error);
      toast.error(error.message || 'Failed to save redeem item');
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      const updated = await adminPatch<RedeemItem>(`/redeem/${id}/toggle`, {});
      setItems(prev => prev.map(i => i.id === id ? { ...i, isActive: updated.isActive } : i));
      if (stats) setStats({ ...stats, active: updated.isActive ? stats.active + 1 : stats.active - 1, inactive: updated.isActive ? stats.inactive - 1 : stats.inactive + 1 });
      toast.success(updated.isActive ? 'Item activated.' : 'Item deactivated.');
    } catch (error: any) {
      console.error('Failed to toggle item', error);
      toast.error(error.message || 'Failed to toggle item');
    }
  };

  const handleDelete = (item: RedeemItem) => {
    setDeleteItemModal({ open: true, item });
  };

  const confirmDeleteItem = async () => {
    if (!deleteItemModal.item) return;
    const item = deleteItemModal.item;
    setDeletingItem(true);
    try {
      await adminDelete(`/redeem/${item.id}`);
      setItems(prev => prev.filter(i => i.id !== item.id));
      if (stats) setStats({ ...stats, total: stats.total - 1 });
      toast.success(`Item "${item.title}" deleted.`);
      setDeleteItemModal({ open: false, item: null });
    } catch (error: any) {
      console.error('Failed to delete item', error);
      toast.error(error.message || 'Failed to delete item');
    } finally {
      setDeletingItem(false);
    }
  };

  const filteredItems = items.filter(i => {
    if (filterStatus === 'active') return i.isActive;
    if (filterStatus === 'inactive') return !i.isActive;
    if (filterStatus === 'outOfStock') return i.stock === 0;
    return true;
  }).filter(i => i.title.toLowerCase().includes(search.toLowerCase()));

  // ─── Requests ───────────────────────────────────────────────────────────

  const fetchRequests = useCallback(async (silent = false) => {
    try {
      if (!silent) setRequestsLoading(true);
      const params = new URLSearchParams({ page: String(requestPage), pageSize: '25' });
      if (requestFilterRef.current !== 'all') params.set('status', requestFilterRef.current);
      if (search.trim()) params.set('search', search.trim());
      const [reqsData, statsData] = await Promise.all([
        adminGet<{ items: RedeemRequest[]; pagination: typeof requestPagination }>(`/redeem/requests?${params.toString()}`),
        adminGet<RequestStats>('/redeem/requests/stats'),
      ]);
      setRequests(reqsData.items);
      setRequestPagination(reqsData.pagination);
      setRequestStats(statsData);
    } catch (error: any) {
      console.error('Failed to fetch requests', error);
      if (!silent) toast.error(error.message || 'Failed to fetch requests');
    } finally {
      if (!silent) setRequestsLoading(false);
    }
  }, [toast, requestPage, search]);

  // Initial fetch and filter change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mainTab === 'items') void fetchItems();
      if (mainTab === 'requests') void fetchRequests();
    }, 250);
    return () => clearTimeout(timer);
  }, [mainTab, requestFilter, fetchItems, fetchRequests]);

  // Real-time synchronization & automatic periodic background refresh
  useEffect(() => {
    // 1. Subscribe to adminRealtimeService
    const unsubscribe = adminRealtimeService.connect({
      onRedeemRefresh: () => {
        if (mainTabRef.current === 'items') fetchItems(true);
        if (mainTabRef.current === 'requests') fetchRequests(true);
      },
      onStatsRefresh: () => {
        fetchItems(true);
        if (mainTabRef.current === 'requests') {
          fetchRequests(true);
        }
      },
    });

    // Periodic refresh for whichever tab is currently visible.
    const interval = setInterval(() => {
      if (mainTabRef.current === 'items') fetchItems(true);
      if (mainTabRef.current === 'requests') {
        fetchRequests(true);
      }
    }, 30000);

    return () => {
      unsubscribe.then(unsub => unsub?.());
      clearInterval(interval);
    };
  }, [fetchItems, fetchRequests]);

  const openApproveModal = (id: string) => {
    setApproveLocation('Barangay San Isidro Hall');
    setApproveModal({ open: true, requestId: id });
  };

  const handleApprove = async () => {
    try {
      setProcessingId(approveModal.requestId);
      await adminPatch(`/redeem/requests/${approveModal.requestId}/approve`, { claimLocation: approveLocation });
      setApproveModal({ open: false, requestId: '' });
      toast.success('Redemption request approved.');
      fetchRequests();
    } catch (error: any) {
      console.error('Failed to approve', error);
      toast.error(error.message || 'Failed to approve');
    }
    finally { setProcessingId(null); }
  };

  const openRejectModal = (req: RedeemRequest) => {
    setRejectReason('');
    setRejectError(null);
    setRejectModal({
      open: true,
      requestId: req.id,
      userName: req.userName,
      itemTitle: req.itemTitle,
      coinCost: req.coinCost,
    });
  };

  const handleReject = async () => {
    if (!rejectModal.requestId) return;
    try {
      setProcessingId(rejectModal.requestId);
      setRejectError(null);
      await adminPatch(`/redeem/requests/${rejectModal.requestId}/reject`, { reason: rejectReason.trim() || undefined });
      setRejectModal({ open: false, requestId: '' });
      setRejectReason('');
      toast.success('Redemption request rejected.');
      fetchRequests();
    } catch (error: any) {
      console.error('Failed to reject redeem request', error);
      setRejectError(error.message || 'Failed to reject request. Please try again.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemoveRequest = (req: RedeemRequest) => {
    setRemoveRequestModal({ open: true, request: req });
  };

  const confirmRemoveRequest = async () => {
    if (!removeRequestModal.request) return;
    const req = removeRequestModal.request;
    setRemovingRequest(true);
    try {
      await adminDelete(`/redeem/requests/${req.id}`);
      toast.success('Request removed.');
      setRemoveRequestModal({ open: false, request: null });
      fetchRequests();
    } catch (error: any) {
      console.error('Failed to remove request', error);
      toast.error(error.message || 'Failed to remove request');
    } finally {
      setRemovingRequest(false);
    }
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
          <h2 className="text-2xl font-serif font-bold text-gray-900 dark:text-white">Redeem</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Manage reward catalog and redemption requests (Auto-syncing live)</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              fetchItems();
              if (mainTab === 'requests') fetchRequests();
            }}
            disabled={loading || requestsLoading}
            title="Refresh Data"
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 dark:text-gray-400 ${(loading || requestsLoading) ? 'animate-spin text-emerald-500' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {mainTab === 'items' && (
            <button onClick={openCreateModal} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 active:scale-95 transition-all duration-200 shadow-sm">
              <Plus className="w-4 h-4" /> Add Item
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1.5 bg-gray-100 dark:bg-gray-800/60 dark:border dark:border-gray-700/60 rounded-xl p-1 w-fit">
        {[
          { key: 'items', label: 'Manage Items', icon: <Gift className="w-4 h-4" /> },
          { key: 'requests', label: 'Redemption Requests', icon: <Clock className="w-4 h-4" /> },
        ].map(t => (
          <button key={t.key} onClick={() => setMainTab(t.key as any)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              mainTab === t.key
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-emerald-400 dark:border dark:border-gray-700'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}>
            {t.icon}{t.label}
            {t.key === 'requests' && requestStats && requestStats.pending > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">{requestStats.pending}</span>
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
                { label: 'Total Items', value: stats.total, color: 'text-gray-900 dark:text-white' },
                { label: 'Active', value: stats.active, color: 'text-green-600 dark:text-green-400' },
                { label: 'Inactive', value: stats.inactive, color: 'text-red-600 dark:text-red-400' },
                { label: 'Out of Stock', value: stats.outOfStock, color: 'text-orange-600 dark:text-orange-400' },
              ].map((s, idx) => {
                const delayClass = idx === 0 ? '' : idx === 1 ? 'delay-60' : idx === 2 ? 'delay-160' : 'delay-280';
                return (
                  <div key={s.label} className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 animate-reveal ${delayClass}`}>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{s.label}</p>
                    <p className={`text-3xl font-serif font-bold mt-1 ${s.color}`}>{s.value}</p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex gap-3 items-center animate-reveal delay-160">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search items..." value={search} onChange={e => { setSearch(e.target.value); setItemPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all" />
            </div>
            {[
              { key: 'all', label: 'All' },
              { key: 'active', label: 'Active', icon: <CheckCircle className="w-3 h-3" /> },
              { key: 'inactive', label: 'Inactive', icon: <XCircle className="w-3 h-3" /> },
              { key: 'outOfStock', label: 'Out of Stock', icon: <Package className="w-3 h-3" /> },
            ].map(f => (
              <button key={f.key} onClick={() => { setFilterStatus(f.key); setItemPage(1); }}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl border font-medium active:scale-95 transition-all ${filterStatus === f.key ? 'bg-green-600 text-white border-green-600 shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-green-300'}`}>
                {f.icon}{f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-4 animate-pulse">
                  <div className="h-36 bg-gray-200 dark:bg-gray-800 rounded-xl" />
                  <div className="space-y-2">
                    <div className="w-3/4 h-4 bg-gray-200 dark:bg-gray-800 rounded" />
                    <div className="w-1/2 h-3 bg-gray-200 dark:bg-gray-800 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-reveal delay-280">
              {filteredItems.map(item => (
                <div key={item.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
                  <div className="relative h-36 overflow-hidden bg-linear-to-br from-amber-50 to-yellow-100 dark:from-gray-800 dark:to-gray-900">
                    {item.imageUrl ? (
                      <img src={item.imageUrl.startsWith('http') ? item.imageUrl : `${API_HOST}${item.imageUrl}`} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Gift className="w-12 h-12 text-amber-300 dark:text-gray-600" /></div>
                    )}
                    {!item.isActive && <div className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">INACTIVE</div>}
                    {item.stock === 0 && <div className="absolute top-3 left-3 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">OUT OF STOCK</div>}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <span className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-100 dark:border-gray-700">
                        <Tag className="w-3 h-3" />{item.category}
                      </span>
                      <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold text-sm">
                        <Coins className="w-4 h-4" />{item.coinCost}
                      </div>
                    </div>
                    <h3 className="font-serif font-bold text-gray-900 dark:text-white mb-1">{item.title}</h3>
                    {item.description && <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 line-clamp-2">{item.description}</p>}
                    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mb-3">
                      <Package className="w-3 h-3" /><span>Stock: {item.stock === -1 ? 'Unlimited' : item.stock}</span>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <button onClick={() => handleToggleActive(item.id)}
                        className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold rounded-xl active:scale-95 transition-all duration-200 ${item.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400'}`}>
                        {item.isActive ? <><XCircle className="w-3 h-3" /> Deactivate</> : <><CheckCircle className="w-3 h-3" /> Activate</>}
                      </button>
                      <button onClick={() => openEditModal(item)} className="flex items-center justify-center px-3 py-2 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-semibold rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 active:scale-95 transition-all duration-200">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDelete(item)} className="flex items-center justify-center px-3 py-2 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-xs font-semibold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 active:scale-95 transition-all duration-200" title="Delete Item">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && filteredItems.length === 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-12 text-center">
              <Gift className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3 opacity-40" /><p className="text-gray-500 dark:text-gray-400 font-medium">No redeem items found</p>
            </div>
          )}
          <AdminPagination page={itemPagination.page} totalPages={itemPagination.totalPages} total={itemPagination.total} onPageChange={setItemPage} />
        </>
      )}

      {/* ═══ REQUESTS TAB ═══ */}
      {mainTab === 'requests' && (
        <>
          {requestStats && (
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: 'Pending', value: requestStats.pending, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-100 dark:border-amber-800/50' },
                { label: 'Approved', value: requestStats.approved, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100 dark:border-blue-800/50' },
                { label: 'Ready to Claim', value: requestStats.readyToClaim, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-100 dark:border-green-800/50' },
                { label: 'Rejected', value: requestStats.rejected, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-100 dark:border-red-800/50' },
                { label: 'Claimed', value: requestStats.claimed, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/40', border: 'border-gray-200 dark:border-gray-800' },
              ].map((s, idx) => {
                const delayClass = idx === 0 ? '' : idx === 1 ? 'delay-60' : idx === 2 ? 'delay-160' : 'delay-280';
                return (
                  <div key={s.label} className={`${s.bg} rounded-2xl border ${s.border} p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300 animate-reveal ${delayClass}`}>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{s.label}</p>
                    <p className={`text-3xl font-serif font-bold mt-1 ${s.color}`}>{requestsLoading ? '—' : s.value}</p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between animate-reveal delay-160">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search by user or item..." value={search} onChange={e => { setSearch(e.target.value); setRequestPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'all', label: 'All' },
                { key: 'pending', label: 'Pending', icon: <Clock className="w-3 h-3" /> },
                { key: 'ready_to_claim', label: 'Ready', icon: <CheckCircle className="w-3 h-3" /> },
                { key: 'rejected', label: 'Rejected', icon: <XCircle className="w-3 h-3" /> },
                { key: 'claimed', label: 'Claimed', icon: <Eye className="w-3 h-3" /> },
              ].map(f => (
                <button key={f.key} onClick={() => { setRequestFilter(f.key); setRequestPage(1); }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border active:scale-95 transition-all duration-200 ${requestFilter === f.key ? 'bg-green-600 text-white border-green-600 shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-green-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  {f.icon}{f.label}
                </button>
              ))}
              <button onClick={() => fetchRequests()} title="Refresh requests" className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 active:scale-95 transition-all duration-200">
                <RefreshCw className={`w-4 h-4 ${requestsLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {requestsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-100 dark:border-gray-800 space-y-3 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl bg-gray-200 dark:bg-gray-800 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="w-48 h-4 bg-gray-200 dark:bg-gray-800 rounded" />
                      <div className="w-32 h-3 bg-gray-200 dark:bg-gray-800 rounded" />
                    </div>
                    <div className="w-28 h-9 bg-gray-200 dark:bg-gray-800 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-12 text-center animate-reveal delay-160">
              <Clock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3 opacity-40" /><p className="text-gray-500 dark:text-gray-400 font-medium">No redemption requests found</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try adjusting your search query or status filter.</p>
            </div>
          ) : (
            <div className="space-y-3 animate-reveal delay-280">
              {filteredRequests.map(req => (
                <div key={req.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {/* Item Image */}
                    <div className="w-16 h-16 rounded-xl bg-gray-50 dark:bg-gray-800 overflow-hidden shrink-0 border border-gray-100 dark:border-gray-700/50">
                      {req.itemImage ? (
                        <img src={req.itemImage.startsWith('http') ? req.itemImage : `${API_HOST}${req.itemImage}`} alt={req.itemTitle} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Gift className="w-6 h-6 text-gray-300 dark:text-gray-600" /></div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-serif font-bold text-gray-900 dark:text-white truncate">{req.itemTitle}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-bold rounded-full border ${statusColors[req.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {statusLabels[req.status] || req.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1"><User className="w-3 h-3 text-gray-400" />{req.userName || 'Unknown'}</span>
                        <span className="flex items-center gap-1"><Coins className="w-3 h-3 text-amber-500" />{req.coinCost} coins</span>
                        <span>{new Date(req.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {req.status === 'ready_to_claim' && req.claimCode && (
                        <div className="mt-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-2.5 text-xs space-y-1">
                          <div className="flex items-center gap-2"><span className="font-bold text-green-800 dark:text-green-300">Code:</span><span className="font-mono font-bold text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-1.5 py-0.5 rounded">{req.claimCode}</span></div>
                          {req.claimLocation && <div className="flex items-center gap-2"><span className="font-bold text-green-800 dark:text-green-300">Location:</span><span className="text-green-700 dark:text-green-400">{req.claimLocation}</span></div>}
                          {req.claimUntil && <div className="flex items-center gap-2"><span className="font-bold text-green-800 dark:text-green-300">Until:</span><span className="text-green-700 dark:text-green-400">{new Date(req.claimUntil).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</span></div>}
                        </div>
                      )}
                      {req.status === 'rejected' && req.rejectReason && (
                        <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{req.rejectReason}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0 items-center self-end sm:self-center">
                      {req.status === 'pending' && (
                        <>
                          <button onClick={() => openApproveModal(req.id)} disabled={processingId === req.id}
                            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-semibold rounded-xl hover:bg-green-700 active:scale-95 transition-all duration-200 disabled:opacity-50 shadow-xs">
                            {processingId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            Approve
                          </button>
                          <button onClick={() => openRejectModal(req)} disabled={processingId === req.id}
                            className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 text-xs font-semibold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 active:scale-95 transition-all duration-200 disabled:opacity-50">
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      )}
                      <button onClick={() => handleRemoveRequest(req)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl active:scale-95 transition-all duration-200" title="Remove Request">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <AdminPagination page={requestPagination.page} totalPages={requestPagination.totalPages} total={requestPagination.total} onPageChange={setRequestPage} />
        </>
      )}

      {/* ═══ CUSTOM REJECT MODAL ═══ */}
      {rejectModal.open && createPortal(
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fadeIn" 
          onClick={() => {
            if (processingId !== rejectModal.requestId) {
              setRejectModal({ open: false, requestId: '' });
              setRejectReason('');
              setRejectError(null);
            }
          }}
        >
          <div 
            className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-modal" 
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-red-50/50 dark:bg-red-950/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Reject Redeem Request</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Cancel request and return coins</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (processingId !== rejectModal.requestId) {
                    setRejectModal({ open: false, requestId: '' });
                    setRejectReason('');
                    setRejectError(null);
                  }
                }}
                disabled={processingId === rejectModal.requestId}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Context card */}
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400">User:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1">
                    <User className="w-3 h-3 text-gray-400" />
                    {rejectModal.userName || 'Member'}
                  </span>
                </div>
                {rejectModal.itemTitle && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400">Item Requested:</span>
                    <span className="font-semibold text-gray-800 dark:text-gray-200">{rejectModal.itemTitle}</span>
                  </div>
                )}
                {rejectModal.coinCost !== undefined && (
                  <div className="flex justify-between items-center pt-1 border-t border-gray-200/50 dark:border-gray-700/50">
                    <span className="text-gray-500 dark:text-gray-400">Coins to Refund:</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5" />
                      +{rejectModal.coinCost} Coins
                    </span>
                  </div>
                )}
              </div>

              {/* Feedback reason input */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Reason for Rejection <span className="font-normal text-gray-400">(Optional)</span>
                </label>
                <textarea 
                  value={rejectReason} 
                  onChange={e => setRejectReason(e.target.value)} 
                  placeholder="e.g. Out of stock, duplicate order, or user cancellation..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:outline-hidden focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-all resize-none placeholder:text-gray-400" 
                />
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                  The user will be notified of this reason and their coins will be refunded immediately.
                </p>
              </div>

              {/* Inline error alert if API fails */}
              {rejectError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs text-red-600 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{rejectError}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2.5">
              <button 
                type="button"
                onClick={() => {
                  setRejectModal({ open: false, requestId: '' });
                  setRejectReason('');
                  setRejectError(null);
                }}
                disabled={processingId === rejectModal.requestId}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={handleReject} 
                disabled={processingId === rejectModal.requestId}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:scale-98 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {processingId === rejectModal.requestId ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject & Refund</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ═══ APPROVE MODAL ═══ */}
      {approveModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setApproveModal({ open: false, requestId: '' })}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-modal border border-gray-100 dark:border-gray-800" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-serif font-bold text-gray-900 dark:text-white mb-2">Approve Request</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Set the claim location. A claim code and deadline will be generated automatically.</p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1 block">Claim Location</label>
                <input type="text" value={approveLocation} onChange={e => setApproveLocation(e.target.value)}
                  placeholder="e.g. Barangay San Isidro Hall"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all" />
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800 rounded-xl p-3 text-xs text-green-700 dark:text-green-300 space-y-1">
                <p className="font-semibold">Auto-generated on approval:</p>
                <p>• Claim Code: ECO-XXXXXX</p>
                <p>• Claim Until: 7 days from now</p>
                <p>• Instructions: Present code, valid ID, claim within period</p>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setApproveModal({ open: false, requestId: '' })}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all duration-200">Cancel</button>
              <button onClick={handleApprove} disabled={processingId === approveModal.requestId}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 active:scale-95 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                {processingId === approveModal.requestId ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Approve & Generate Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CREATE/EDIT MODAL ═══ */}
      {showCreateModal && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => { setShowCreateModal(false); resetForm(); }}>
          <div
            className="relative z-10 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden animate-modal border border-gray-100 dark:border-gray-800"
            style={{ maxHeight: 'calc(100vh - 100px)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-serif font-bold text-gray-900 dark:text-white">{editItem ? 'Edit Item' : 'Add New Item'}</h2>
              <button
                type="button"
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="Close item modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              id="redeem-item-form"
              onSubmit={e => { e.preventDefault(); handleSave(); }}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title *</label>
                <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="e.g. Eco Water Bottle"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Describe the item..."
                  rows={3} className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 resize-none transition-all" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Coin Cost *</label>
                  <input type="number" min="1" value={formCoinCost} onChange={e => setFormCoinCost(e.target.value)} placeholder="100"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Stock (-1 = unlimited)</label>
                  <input type="number" min="-1" value={formStock} onChange={e => setFormStock(e.target.value)} placeholder="-1"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Item Image</label>
                <div className="flex items-center gap-4">
                  {formImagePreview && (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 shrink-0 bg-gray-50 dark:bg-gray-800">
                      <img src={formImagePreview} alt="Item preview" className="w-full h-full object-cover" />
                      <button type="button" onClick={handleRemoveImage} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 active:scale-95 transition-all" aria-label="Remove image">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                    className="flex-1 flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/10 cursor-pointer transition-colors text-gray-500 dark:text-gray-400"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{formImagePreview ? 'Choose a different image...' : 'Choose an image...'}</span>
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">JPG or PNG, up to 5MB.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select value={formCategory} onChange={e => setFormCategory(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400">
                  {categoryOptions.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                </select>
              </div>
            </form>

            <div className="shrink-0 p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end gap-3">
              <button type="button" onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="px-6 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Cancel</button>
              <button form="redeem-item-form" type="submit" disabled={!formTitle.trim() || !formCoinCost || uploadingImage}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                {uploadingImage && <Loader2 className="w-4 h-4 animate-spin" />}
                {uploadingImage ? 'Saving…' : editItem ? 'Save Changes' : 'Create Item'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Custom Delete Item Confirmation Modal */}
      {deleteItemModal.open && deleteItemModal.item && createPortal(
        <div
          className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => !deletingItem && setDeleteItemModal({ open: false, item: null })}
        >
          <div
            className="bg-white dark:bg-[#0f1713] rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-red-50/50 dark:bg-red-950/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete Redeem Item</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Irreversible catalog removal</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !deletingItem && setDeleteItemModal({ open: false, item: null })}
                disabled={deletingItem}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Are you sure you want to delete <strong className="text-gray-900 dark:text-white">"{deleteItemModal.item.title}"</strong>?
              </p>
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300">
                Users will no longer be able to spend EcoCoins on this reward item.
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteItemModal({ open: false, item: null })}
                disabled={deletingItem}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteItem}
                disabled={deletingItem}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:scale-98 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {deletingItem ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Item</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Custom Remove Request Confirmation Modal */}
      {removeRequestModal.open && removeRequestModal.request && createPortal(
        <div
          className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
          onClick={() => !removingRequest && setRemoveRequestModal({ open: false, request: null })}
        >
          <div
            className="bg-white dark:bg-[#0f1713] rounded-2xl w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-red-50/50 dark:bg-red-950/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Remove Request</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Redemption log cleanup</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !removingRequest && setRemoveRequestModal({ open: false, request: null })}
                disabled={removingRequest}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Are you sure you want to remove the redemption request for <strong className="text-gray-900 dark:text-white">"{removeRequestModal.request.itemTitle}"</strong> by <strong className="text-gray-900 dark:text-white">{removeRequestModal.request.userName}</strong>?
              </p>
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-400">
                This request log will be deleted from your admin history view.
              </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRemoveRequestModal({ open: false, request: null })}
                disabled={removingRequest}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoveRequest}
                disabled={removingRequest}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:scale-98 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {removingRequest ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Request</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
