import { useState, useEffect } from 'react';
import { Shield, Trash2, Tag, Package, Search, CheckCircle, Clock, XCircle, AlertTriangle, Ban, User } from 'lucide-react';
import { adminGet, adminDelete, adminPatch } from '../../../utils/adminApi';

interface SwapListingItem {
  id: string;
  title: string;
  category: string;
  condition: string;
  lookingFor: string;
  postedBy: string;
  postedByEmail: string;
  userId: string;
  date: string;
  approvalStatus: string;
  isActive: boolean;
  isReported: boolean;
  reportCount: number;
  reportReason: string | null;
  images: any;
  meetupMethod: string;
  city: string | null;
  province: string | null;
  description: string;
  quantity: string;
}

interface SwapStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  reported: number;
}

const conditionColors: Record<string, string> = {
  New: 'text-green-600',
  'Like New': 'text-blue-600',
  Good: 'text-gray-600',
  Fair: 'text-orange-500',
};

const approvalConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: 'bg-yellow-50 text-yellow-700 border-yellow-100', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
  approved: { color: 'bg-green-50 text-green-700 border-green-100', icon: <CheckCircle className="w-3 h-3" />, label: 'Approved' },
  rejected: { color: 'bg-red-50 text-red-600 border-red-100', icon: <XCircle className="w-3 h-3" />, label: 'Rejected' },
};

export function GiveAndGetHub() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [listings, setListings] = useState<SwapListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SwapStats | null>(null);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; listingId: string | null }>({ open: false, listingId: null });
  const [rejectReason, setRejectReason] = useState('');
  const [reportModal, setReportModal] = useState<{ open: boolean; listingId: string | null }>({ open: false, listingId: null });
  const [reportReason, setReportReason] = useState('');

  const fetchListings = async () => {
    try {
      setLoading(true);
      const [listingsData, statsData] = await Promise.all([
        adminGet<SwapListingItem[]>('/give-and-get/swap-listings'),
        adminGet<SwapStats>('/give-and-get/swap-listings/stats'),
      ]);
      setListings(listingsData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch swap listings', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchListings(); }, []);

  const handleApprove = async (id: string) => {
    try {
      await adminPatch(`/give-and-get/swap-listings/${id}/approve`, {});
      setListings(prev => prev.map(l => l.id === id ? { ...l, approvalStatus: 'approved', isReported: false, reportCount: 0 } : l));
      if (stats) setStats({ ...stats, pending: stats.pending - 1, approved: stats.approved + 1 });
    } catch (error) {
      console.error('Failed to approve listing', error);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.listingId) return;
    try {
      await adminPatch(`/give-and-get/swap-listings/${rejectModal.listingId}/reject`, { reason: rejectReason });
      setListings(prev => prev.map(l => l.id === rejectModal.listingId ? { ...l, approvalStatus: 'rejected', isActive: false, reportReason: rejectReason } : l));
      setRejectModal({ open: false, listingId: null });
      setRejectReason('');
      if (stats) setStats({ ...stats, pending: stats.pending - 1, rejected: stats.rejected + 1 });
    } catch (error) {
      console.error('Failed to reject listing', error);
    }
  };

  const handleReport = async () => {
    if (!reportModal.listingId) return;
    try {
      await adminPatch(`/give-and-get/swap-listings/${reportModal.listingId}/report`, { reason: reportReason });
      setListings(prev => prev.map(l => l.id === reportModal.listingId ? { ...l, isReported: true, reportCount: l.reportCount + 1, reportReason: reportReason } : l));
      setReportModal({ open: false, listingId: null });
      setReportReason('');
      if (stats) setStats({ ...stats, reported: stats.reported + 1 });
    } catch (error) {
      console.error('Failed to report listing', error);
    }
  };

  const handleDeleteListing = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this listing?')) {
      try {
        await adminDelete(`/give-and-get/swap-listings/${id}`);
        setListings(prev => prev.filter(l => l.id !== id));
        if (stats) setStats({ ...stats, total: stats.total - 1 });
      } catch (error) {
        console.error('Failed to delete listing', error);
      }
    }
  };

  const filteredListings = listings.filter(l => {
    if (filterStatus === 'pending') return l.approvalStatus === 'pending';
    if (filterStatus === 'approved') return l.approvalStatus === 'approved';
    if (filterStatus === 'rejected') return l.approvalStatus === 'rejected';
    if (filterStatus === 'reported') return l.isReported;
    return true;
  }).filter(l => l.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-8 space-y-6 bg-gray-50/50 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Manage Listings</h2>
          <p className="text-gray-500 text-sm mt-1">Review, approve, and moderate community swap listings</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-900' },
            { label: 'Pending', value: stats.pending, color: 'text-yellow-600' },
            { label: 'Approved', value: stats.approved, color: 'text-green-600' },
            { label: 'Rejected', value: stats.rejected, color: 'text-red-600' },
            { label: 'Reported', value: stats.reported, color: 'text-orange-600' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300">
              <p className="text-sm text-gray-500 font-medium">{s.label}</p>
              <p className={`text-3xl font-serif font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search listings..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all"
          />
        </div>
        {[
          { key: 'all', label: 'All' },
          { key: 'pending', label: 'Pending', icon: <Clock className="w-3 h-3" /> },
          { key: 'approved', label: 'Approved', icon: <CheckCircle className="w-3 h-3" /> },
          { key: 'rejected', label: 'Rejected', icon: <XCircle className="w-3 h-3" /> },
          { key: 'reported', label: 'Reported', icon: <AlertTriangle className="w-3 h-3" /> },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl border font-medium transition-all ${filterStatus === f.key ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}
          >
            {f.icon}{f.label}
          </button>
        ))}
      </div>

      {/* Listings */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredListings.map(listing => {
            const approval = approvalConfig[listing.approvalStatus] || approvalConfig.pending;
            return (
              <div key={listing.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 overflow-hidden group">
                <div className="bg-gradient-to-br from-emerald-50 to-green-100 p-6 flex items-center justify-center relative">
                  {listing.images && Array.isArray(listing.images) && listing.images.length > 0 ? (
                    <img src={listing.images[0]} alt={listing.title} className="w-16 h-16 object-cover rounded-xl" />
                  ) : (
                    <Package className="w-12 h-12 text-emerald-300" />
                  )}
                  {listing.isReported && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" /> {listing.reportCount} Report{listing.reportCount !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <span className={`flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${approval.color}`}>
                      {approval.icon}
                      {approval.label}
                    </span>
                    <span className="text-xs text-gray-400">{listing.date}</span>
                  </div>

                  <h3 className="font-serif font-bold text-gray-900 mb-1">{listing.title}</h3>

                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Tag className="w-3 h-3" />{listing.category}
                    </span>
                    <span className="text-gray-200">•</span>
                    <span className={`text-xs font-semibold ${conditionColors[listing.condition] || 'text-gray-600'}`}>
                      {listing.condition}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                    <Package className="w-3 h-3 text-gray-300" />
                    <span className="text-gray-400">Looking for:</span>
                    <span className="font-medium text-gray-700">{listing.lookingFor}</span>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
                    <User className="w-3 h-3 text-gray-300" />
                    <span className="font-medium text-gray-700">{listing.postedBy}</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-400">{listing.city || 'N/A'}</span>
                  </div>

                  {listing.description && (
                    <p className="text-xs text-gray-400 mt-2 line-clamp-2">{listing.description}</p>
                  )}

                  {listing.isReported && listing.reportReason && (
                    <div className="mt-2 p-2 bg-orange-50 rounded-lg border border-orange-100">
                      <p className="text-[11px] text-orange-600 font-medium">Report reason: {listing.reportReason}</p>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    {listing.approvalStatus === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(listing.id)}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-50 text-green-700 text-xs font-semibold rounded-xl hover:bg-green-100 transition-colors"
                        >
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                        <button
                          onClick={() => setRejectModal({ open: true, listingId: listing.id })}
                          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-50 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-100 transition-colors"
                        >
                          <Ban className="w-3 h-3" /> Reject
                        </button>
                      </>
                    )}
                    {listing.approvalStatus === 'approved' && (
                      <button
                        onClick={() => setRejectModal({ open: true, listingId: listing.id })}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-50 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-100 transition-colors"
                      >
                        <Ban className="w-3 h-3" /> Reject
                      </button>
                    )}
                    {listing.approvalStatus === 'rejected' && (
                      <button
                        onClick={() => handleApprove(listing.id)}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-50 text-green-700 text-xs font-semibold rounded-xl hover:bg-green-100 transition-colors"
                      >
                        <CheckCircle className="w-3 h-3" /> Approve
                      </button>
                    )}
                    <button
                      onClick={() => setReportModal({ open: true, listingId: listing.id })}
                      className="flex items-center justify-center px-3 py-2 bg-orange-50 text-orange-600 text-xs font-semibold rounded-xl hover:bg-orange-100 transition-colors"
                      title="Report listing"
                    >
                      <AlertTriangle className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteListing(listing.id)}
                      className="flex items-center justify-center px-3 py-2 bg-red-50 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filteredListings.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Shield className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">No listings found</p>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setRejectModal({ open: false, listingId: null })}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-serif font-bold text-gray-900 mb-2">Reject Listing</h3>
            <p className="text-sm text-gray-500 mb-4">Provide a reason for rejecting this listing.</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Inappropriate content, spam, nonsense post..."
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-400 resize-none h-24"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setRejectModal({ open: false, listingId: null })}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportModal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setReportModal({ open: false, listingId: null })}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-serif font-bold text-gray-900 mb-2">Report Listing</h3>
            <p className="text-sm text-gray-500 mb-4">Flag this listing for moderation review.</p>
            <textarea
              value={reportReason}
              onChange={e => setReportReason(e.target.value)}
              placeholder="e.g. Fake listing, offensive content..."
              className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400 resize-none h-24"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setReportModal({ open: false, listingId: null })}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-orange-600 rounded-xl hover:bg-orange-700 transition-colors"
              >
                Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
