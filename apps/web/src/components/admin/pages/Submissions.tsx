import { useState, useEffect, useMemo } from 'react';
import { Search, Filter, AlertCircle, Loader2, CheckCircle, XCircle, Trash2, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { adminGet, adminPost, adminDelete, API_HOST } from '../../../utils/adminApi';

interface Submission {
  id: string;
  userId: string;
  challengeId: string;
  proofText: string | null;
  proofUrl: string | null;
  afterProofUrl: string | null;
  status: 'pending' | 'approved' | 'rejected';
  moderatorNotes: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    profile: {
      displayName: string | null;
      avatarUrl: string | null;
    } | null;
  };
  challenge: {
    id: string;
    title: string;
    type: string;
  };
}

const statusColors: Record<string, string> = {
  approved: 'bg-green-50 text-green-700 border-green-100',
  rejected: 'bg-red-50 text-red-700 border-red-100',
  pending: 'bg-yellow-50 text-yellow-700 border-yellow-100',
};

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

export function Submissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState('center center');

  const loadSubmissions = async () => {
    try {
      const data = await adminGet<Submission[]>('/admin/submissions');
      setSubmissions(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      await adminPost(`/admin/submissions/${id}/review`, { status: 'approved' });
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'approved' } : s));
    } catch (err: any) {
      alert(err.message || 'Failed to approve submission');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const notes = window.prompt('Enter reason for rejection (optional):');
    if (notes === null) return; // User cancelled
    
    setProcessingId(id);
    try {
      await adminPost(`/admin/submissions/${id}/review`, { status: 'rejected', notes });
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'rejected', moderatorNotes: notes } : s));
    } catch (err: any) {
      alert(err.message || 'Failed to reject submission');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this submission?')) return;
    
    setProcessingId(id);
    try {
      await adminDelete(`/admin/submissions/${id}`);
      setSubmissions(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete submission');
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = useMemo(() =>
    submissions.filter(s => {
      const matchStatus = filterStatus === 'All' || s.status === filterStatus.toLowerCase();
      const userName = s.user?.profile?.displayName || s.user?.name || '';
      const matchSearch = userName.toLowerCase().includes(search.toLowerCase()) || 
                          s.challenge?.title.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    }), [submissions, search, filterStatus]);

  const totalPending = submissions.filter(s => s.status === 'pending').length;
  const totalApproved = submissions.filter(s => s.status === 'approved').length;
  const totalRejected = submissions.filter(s => s.status === 'rejected').length;

  return (
    <div className="p-8 space-y-6 bg-gray-50/50 min-h-full">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-serif font-bold text-gray-900">Review Submissions</h2>
            <p className="text-gray-500 text-sm mt-1">Manage user proofs and AI challenge submissions</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: loading ? '—' : submissions.length, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Pending', value: loading ? '—' : totalPending, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Approved', value: loading ? '—' : totalApproved, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Rejected', value: loading ? '—' : totalRejected, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((s, idx) => {
          const delayClass = idx === 0 ? '' : idx === 1 ? 'delay-60' : idx === 2 ? 'delay-100' : 'delay-160';
          return (
            <div key={s.label} className={`${s.bg} rounded-2xl border border-gray-100 p-5 shadow-sm animate-reveal ${delayClass} hover:-translate-y-1 hover:shadow-md transition-all duration-300`}>
              <p className="text-sm text-gray-500 font-medium">{s.label}</p>
              <p className={`text-3xl font-serif font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3 items-center animate-reveal delay-160">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by user or challenge title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {['All', 'Pending', 'Approved', 'Rejected'].map(f => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`px-4 py-2 text-sm rounded-xl border font-medium transition-all ${filterStatus === f ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300 hover:text-green-700'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-reveal delay-280">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/70">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">User</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-4">Challenge</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-4">Proof</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-4">Status</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-4">Date</th>
              <th className="px-4 py-4 w-[160px]"></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-9 h-9 rounded-full" />
                        <div className="space-y-1.5">
                          <Skeleton className="h-3 w-28" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-10 w-16 rounded" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-6 w-20 rounded-full" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="px-4 py-4"></td>
                  </tr>
                ))
              : filtered.map(sub => {
                  const fullProofUrl = sub.proofUrl ? (sub.proofUrl.startsWith('/') ? `${API_HOST}${sub.proofUrl}` : sub.proofUrl) : null;
                  
                  return (
                    <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {sub.user?.profile?.avatarUrl ? (
                            <img src={sub.user.profile.avatarUrl} alt={sub.user.name} className="w-9 h-9 rounded-full bg-gray-100 object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center">
                              <span className="text-xs font-bold text-green-700">{(sub.user?.name || '?').charAt(0).toUpperCase()}</span>
                            </div>
                          )}
                          <span className="text-sm font-semibold text-gray-900">{sub.user?.profile?.displayName || sub.user?.name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <p className="text-sm font-medium text-gray-900">{sub.challenge?.title || 'Unknown Challenge'}</p>
                        <p className="text-xs text-gray-500">{sub.challenge?.type || 'Standard'}</p>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          {fullProofUrl ? (
                            <button 
                              onClick={() => setSelectedImage(fullProofUrl)} 
                              className="block relative w-16 h-12 rounded-lg overflow-hidden border border-gray-200 group/img cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-400"
                            >
                              <img src={fullProofUrl} alt="Before Proof" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white text-[10px] font-bold absolute bottom-1 left-1">BEFORE</span>
                                <ExternalLink className="w-4 h-4 text-white" />
                              </div>
                            </button>
                          ) : sub.proofText ? (
                            <div className="text-sm text-gray-600 max-w-[150px] truncate" title={sub.proofText}>
                              {sub.proofText}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">No proof</span>
                          )}

                          {sub.afterProofUrl && (
                            <button 
                              onClick={() => setSelectedImage(sub.afterProofUrl!.startsWith('/') ? `${API_HOST}${sub.afterProofUrl}` : sub.afterProofUrl!)} 
                              className="block relative w-16 h-12 rounded-lg overflow-hidden border border-gray-200 group/img cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-400"
                            >
                              <img src={sub.afterProofUrl.startsWith('/') ? `${API_HOST}${sub.afterProofUrl}` : sub.afterProofUrl} alt="After Proof" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white text-[10px] font-bold absolute bottom-1 left-1">AFTER</span>
                                <ExternalLink className="w-4 h-4 text-white" />
                              </div>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 text-xs font-semibold rounded-full border w-fit ${statusColors[sub.status]}`}>
                            {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                          </span>
                          {sub.moderatorNotes && (
                            <span className="text-[10px] text-gray-500 truncate max-w-[120px]" title={sub.moderatorNotes}>
                              Note: {sub.moderatorNotes}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-xs text-gray-500">
                          {new Date(sub.createdAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                          {sub.status === 'pending' && (
                            <>
                              <button 
                                onClick={() => handleApprove(sub.id)}
                                disabled={processingId === sub.id}
                                title="Approve"
                                className="p-1.5 text-green-600 bg-green-50 hover:bg-green-100 disabled:opacity-50 rounded-lg transition-colors"
                              >
                                {processingId === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                              </button>
                              <button 
                                onClick={() => handleReject(sub.id)}
                                disabled={processingId === sub.id}
                                title="Reject"
                                className="p-1.5 text-orange-600 bg-orange-50 hover:bg-orange-100 disabled:opacity-50 rounded-lg transition-colors"
                              >
                                {processingId === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                              </button>
                            </>
                          )}
                          <button 
                            onClick={() => handleDelete(sub.id)}
                            disabled={processingId === sub.id}
                            title="Delete"
                            className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 rounded-lg transition-colors"
                          >
                            {processingId === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            {submissions.length === 0 ? (
              <div className="flex flex-col items-center gap-2">
                <ImageIcon className="w-6 h-6 text-gray-300" />
                <p>No submissions found</p>
              </div>
            ) : 'No submissions match your filters.'}
          </div>
        )}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => { setSelectedImage(null); setIsZoomed(false); }}
        >
          <div className="relative w-full h-full flex flex-col items-center justify-center">
            <button 
              onClick={(e) => { e.stopPropagation(); setSelectedImage(null); setIsZoomed(false); }}
              className="absolute top-6 right-6 p-2 text-white/70 hover:text-white transition-colors z-[110]"
            >
              <XCircle className="w-8 h-8" />
            </button>
            <div 
              className={`relative overflow-hidden flex items-center justify-center max-w-5xl max-h-[90vh] rounded-xl shadow-2xl border border-white/10 ${isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'}`}
              onClick={(e) => {
                e.stopPropagation();
                setIsZoomed(!isZoomed);
              }}
              onMouseMove={(e) => {
                if (!isZoomed) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  setZoomOrigin(`${x}% ${y}%`);
                }
              }}
            >
              <img 
                src={selectedImage} 
                alt="Proof Full View" 
                style={{ 
                  transform: isZoomed ? 'scale(2.5)' : 'scale(1)', 
                  transformOrigin: zoomOrigin,
                  transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                className="max-w-full max-h-[90vh] object-contain pointer-events-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
