import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Trophy, Plus, Edit3, Trash2, Coins, Search, Target, AlertCircle, X, 
  Loader2, UploadCloud, Power, Star, CheckCircle, XCircle, ShieldCheck, 
  QrCode, ChevronDown, ChevronRight, User, Layers, Filter, 
  RefreshCw, CheckCircle2, Clock
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { adminGet, adminPost, adminPut, adminDelete, adminPostForm, API_HOST } from '../../../utils/adminApi';
import { useModalScrollLock } from '../../../hooks/useModalScrollLock';

interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  category: string | null;
  startDate: string | null;
  endDate: string | null;
  expReward: number;
  ecoCoinReward: number;
  active: boolean;
  imageUrl: string | null;
  badgeLabel: string | null;
  type: string;
  aiDetectionTargets: string[];
  aiMinimumConfidence: number;
  isFeatured: boolean;
  availableQuantity: number;
  weeklyIncrementQuantity: number;
  quantityUnit: string;
  collectionPointName?: string;
  createdAt: string;
  updatedAt: string;
  userChallenges?: { id: string }[];
  instances?: { id: string; startDate: string; endDate: string; status: string }[];
}

interface ChallengeSubmission {
  id: string;
  userId: string;
  challengeId: string;
  proofUrl: string | null;
  afterProofUrl: string | null;
  status: 'pending' | 'approved' | 'approved_collection' | 'rejected' | 'completed' | 'final_review';
  moderatorNotes: string | null;
  detectedQuantity: number;
  reservedQuantity: number;
  qrToken: string | null;
  qrVerified: boolean;
  adminPreliminaryApproved: boolean;
  adminFinalApproved: boolean;
  rewardAwarded: boolean;
  createdAt: string;
  submissionType?: string;
  user: { id: string; name: string; profile: { displayName: string | null; avatarUrl: string | null } | null };
  challenge: { id: string; title: string; type: string; quantityUnit?: string; collectionPointName?: string };
}

const statusColors: Record<string, string> = {
  Active: 'bg-green-50 text-green-700 border-green-100',
  Inactive: 'bg-gray-100 text-gray-500 border-gray-200',
  Expired: 'bg-red-50 text-red-600 border-red-100',
};

const difficultyColors: Record<string, string> = {
  Easy: 'bg-green-50 text-green-600',
  Medium: 'bg-yellow-50 text-yellow-700',
  Hard: 'bg-red-50 text-red-600',
  Expert: 'bg-purple-50 text-purple-700',
};

const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Expert'];
const CATEGORIES = ['General', 'Waste', 'Transport', 'Food', 'Energy', 'Nature', 'Water', 'Lifestyle'];
const AI_TARGET_OPTIONS = ['Plastic Bottle', 'Glass Bottle'];

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

interface FormData {
  title: string;
  description: string;
  difficulty: string;
  category: string;
  startDate: string | null;
  endDate: string | null;
  expReward: number;
  ecoCoinReward: number;
  active: boolean;
  badgeLabel: string;
  type: string;
  imageUrl: string;
  aiDetectionTargets: string[];
  aiMinimumConfidence: number;
  isFeatured: boolean;
  availableQuantity: number;
  weeklyIncrementQuantity: number;
  quantityUnit: string;
  collectionPointName: string;
}
const emptyForm: FormData = { title: '', description: '', difficulty: 'Easy', category: 'General', startDate: null, endDate: null, expReward: 100, ecoCoinReward: 0, active: true, badgeLabel: '', type: 'AI Image Recognition Challenge', imageUrl: '', aiDetectionTargets: [], aiMinimumConfidence: 80, isFeatured: false, availableQuantity: 50, weeklyIncrementQuantity: 50, quantityUnit: 'bottles', collectionPointName: 'Municipal Waste Collection Center' };

interface ModalProps {
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  initial?: Challenge | null;
}

function ChallengeModal({ onClose, onSave, initial }: ModalProps) {
  const [form, setForm] = useState<FormData>(
    initial
      ? { title: initial.title, description: initial.description, difficulty: initial.difficulty, category: initial.category || 'General', startDate: initial.startDate || null, endDate: initial.endDate || null, expReward: initial.expReward, ecoCoinReward: initial.ecoCoinReward, active: initial.active, badgeLabel: initial.badgeLabel || '', type: 'AI Image Recognition Challenge', imageUrl: initial.imageUrl || '', aiDetectionTargets: initial.aiDetectionTargets || [], aiMinimumConfidence: initial.aiMinimumConfidence || 80, isFeatured: initial.isFeatured || false, availableQuantity: initial.availableQuantity ?? 50, weeklyIncrementQuantity: initial.weeklyIncrementQuantity ?? 50, quantityUnit: initial.quantityUnit || 'bottles', collectionPointName: initial.collectionPointName || 'Municipal Waste Collection Center' }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [err, setErr] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lock background scroll while modal is open
  useModalScrollLock(true);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 280);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    setErr('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await adminPostForm<{ url: string }>('/admin/upload', formData);
      setForm(f => ({ ...f, imageUrl: res.url }));
    } catch (err: any) {
      setErr(err.message || 'Failed to upload image');
    } finally {
      setUploadingImg(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description) { setErr('Title and description are required.'); return; }
    setSaving(true); setErr('');
    try { await onSave({ ...form, startDate: null, endDate: null }); handleClose(); }
    catch (e: any) { setErr(e.message || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={handleClose}>
      <div className={`relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-240 flex flex-col overflow-hidden ${isClosing ? 'animate-modal-exit' : 'animate-modal'}`} style={{ maxHeight: 'calc(100vh - 100px)' }} onClick={e => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-serif font-bold text-gray-900">{initial ? 'Edit Challenge' : 'New Challenge'}</h2>
          <button onClick={handleClose} type="button" className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <form id="challenge-form" onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* Left Side */}
          <div className="flex-1 space-y-4 overflow-y-auto challenge-modal-scroll p-6">
            {err && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{err}</p>}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all" placeholder="Challenge title" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all resize-none" placeholder="Challenge description" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Challenge Image</label>
              <div className="flex items-center gap-4">
                {form.imageUrl ? (
                  <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 shrink-0">
                    <img src={form.imageUrl.startsWith('http') ? form.imageUrl : `${API_HOST}${form.imageUrl}`} alt="Challenge" className="w-full h-full object-cover" />
                    <button type="button" onClick={async () => {
                        if (form.imageUrl) {
                          try { await adminPost('/admin/upload/delete', { url: form.imageUrl }); } catch (e) { console.error('Failed to delete image', e); }
                        }
                        setForm(f => ({ ...f, imageUrl: '' }));
                      }} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div onClick={() => fileInputRef.current?.click()} className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors shrink-0">
                    {uploadingImg ? <Loader2 className="w-6 h-6 text-green-500 animate-spin" /> : <UploadCloud className="w-6 h-6 text-gray-400" />}
                    <span className="text-[10px] text-gray-500 mt-1">{uploadingImg ? 'Uploading...' : 'Upload'}</span>
                  </div>
                )}
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                <div className="flex-1 text-xs text-gray-500">
                  Upload an engaging image for this challenge. Ideal size: 800x600px.
                </div>
              </div>
            </div>

            {form.type === 'AI Image Recognition Challenge' && (
              <div className="bg-gray-50/50 rounded-xl border border-gray-200 p-5 shadow-sm mt-6">
                <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Target className="w-4 h-4" /> AI Detection Settings
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Targets to Detect</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {AI_TARGET_OPTIONS.map(target => (
                        <label key={target} className="flex items-center gap-2 text-sm text-gray-900 bg-white px-3 py-2 rounded-lg border border-gray-200 cursor-pointer hover:bg-green-50 hover:border-green-100 transition-colors">
                          <input
                            type="checkbox"
                            checked={form.aiDetectionTargets.includes(target)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setForm(f => ({
                                ...f,
                                aiDetectionTargets: checked
                                  ? [...f.aiDetectionTargets, target]
                                  : f.aiDetectionTargets.filter(t => t !== target)
                              }));
                            }}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          {target}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Confidence (%)</label>
                    <input
                      type="number" min={1} max={100}
                      value={form.aiMinimumConfidence}
                      onChange={e => setForm(f => ({ ...f, aiMinimumConfidence: Number(e.target.value) }))}
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Collection Point Name</label>
              <input value={form.collectionPointName} onChange={e => setForm(f => ({ ...f, collectionPointName: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all" placeholder="e.g. Municipal Waste Collection Center" />
            </div>
            
            <div className="h-2 w-full shrink-0" />
          </div>

          {/* Right Side */}
          <div className="w-full md:w-100 flex flex-col gap-6 overflow-y-auto challenge-modal-scroll p-6 border-l border-gray-100">
            <div className="bg-gray-50/50 rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <h3 className="font-semibold text-gray-800">Configuration</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all bg-white">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all bg-white">
                    {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Badge Label (optional)</label>
                <input value={form.badgeLabel} onChange={e => setForm(f => ({ ...f, badgeLabel: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all bg-white" placeholder="e.g. Eco Warrior" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Available Qty</label>
                  <input type="number" min={0} value={form.availableQuantity} onChange={e => setForm(f => ({ ...f, availableQuantity: Number(e.target.value) }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all bg-white" placeholder="e.g. 50" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weekly +Add</label>
                  <input type="number" min={0} value={form.weeklyIncrementQuantity} onChange={e => setForm(f => ({ ...f, weeklyIncrementQuantity: Number(e.target.value) }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all bg-white" placeholder="e.g. 50" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Unit</label>
                <input value={form.quantityUnit} onChange={e => setForm(f => ({ ...f, quantityUnit: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all bg-white" placeholder="e.g. bottles, kg, units" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Points / Item</label>
                  <input type="number" min={0} value={form.expReward} onChange={e => setForm(f => ({ ...f, expReward: Number(e.target.value) }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Coin / Item</label>
                  <input type="number" min={0} value={form.ecoCoinReward} onChange={e => setForm(f => ({ ...f, ecoCoinReward: Number(e.target.value) }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all" />
                </div>
              </div>
              
              <div className="pt-2 border-t border-gray-100 space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${form.isFeatured ? 'bg-indigo-500' : 'bg-gray-300'}`} onClick={() => setForm(f => ({ ...f, isFeatured: !f.isFeatured }))}>
                    <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${form.isFeatured ? 'translate-x-4' : ''}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Feature this challenge</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${form.active ? 'bg-green-500' : 'bg-gray-300'}`} onClick={() => setForm(f => ({ ...f, active: !f.active }))}>
                    <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${form.active ? 'translate-x-4' : ''}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Set active</span>
                </label>
              </div>
            </div>
          </div>
        </form>
        {/* Footer buttons */}
        <div className="shrink-0 p-4 border-t border-gray-200 bg-white flex justify-end gap-3 z-10">
          <button type="button" onClick={handleClose} className="px-6 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
          <button form="challenge-form" type="submit" disabled={saving} className="px-6 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : (initial ? 'Update Challenge' : 'Create Challenge')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function Challenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Challenge | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [togglingFeatured, setTogglingFeatured] = useState<string | null>(null);

  // ── Submissions tab state ────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'challenges' | 'submissions'>('challenges');
  const [submissions, setSubmissions] = useState<ChallengeSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [processingSubId, setProcessingSubId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedQr, setSelectedQr] = useState<ChallengeSubmission | null>(null);
  const [subSearch, setSubSearch] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState<string>('All');
  const [selectedUserIdFilter, setSelectedUserIdFilter] = useState<string>('All');
  const [collapsedUsers, setCollapsedUsers] = useState<Record<string, boolean>>({});
  const [collapsedChallenges, setCollapsedChallenges] = useState<Record<string, boolean>>({});

  const load = async () => {
    try {
      const data = await adminGet<Challenge[]>('/admin/challenges');
      setChallenges(data);
    } catch (err: any) { setError(err.message || 'Failed to load challenges.'); }
    finally { setLoading(false); }
  };

  const loadSubmissions = async () => {
    setSubmissionsLoading(true);
    try {
      const data = await adminGet<ChallengeSubmission[]>('/admin/submissions');
      // Filter to only challenge submissions (not events)
      setSubmissions(data.filter(s => !s.submissionType || s.submissionType === 'CHALLENGE'));
    } catch (err: any) { console.error('Failed to load submissions', err); }
    finally { setSubmissionsLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (activeTab === 'submissions') loadSubmissions();
  }, [activeTab]);

  // Preliminary approval: sends approved_collection status
  const handlePreliminaryApprove = async (id: string) => {
    setProcessingSubId(id);
    try {
      await adminPost(`/admin/submissions/${id}/review`, { status: 'approved_collection' });
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'approved_collection' } : s));
    } catch (err: any) { alert(err.message || 'Failed to approve'); }
    finally { setProcessingSubId(null); }
  };

  // Final approval: sends approved status (rewards granted)
  const handleFinalApprove = async (id: string) => {
    setProcessingSubId(id);
    try {
      await adminPost(`/admin/submissions/${id}/review`, { status: 'approved' });
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'approved' } : s));
    } catch (err: any) { alert(err.message || 'Failed to approve'); }
    finally { setProcessingSubId(null); }
  };

  const handleRejectSubmission = async (id: string) => {
    const notes = window.prompt('Enter reason for rejection (optional):');
    if (notes === null) return;
    setProcessingSubId(id);
    try {
      await adminPost(`/admin/submissions/${id}/review`, { status: 'rejected', notes });
      setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: 'rejected', moderatorNotes: notes } : s));
    } catch (err: any) { alert(err.message || 'Failed to reject'); }
    finally { setProcessingSubId(null); }
  };

  const filtered = useMemo(() => {
    const now = new Date();
    return challenges.filter(c => {
      const isExpired = c.endDate ? new Date(c.endDate) < now : false;
      const status = isExpired ? 'Expired' : (c.active ? 'Active' : 'Inactive');
      
      const matchStatus = filterStatus === 'All' || filterStatus === status;
      const matchSearch = c.title.toLowerCase().includes(search.toLowerCase());
      
      return matchStatus && matchSearch;
    });
  }, [challenges, search, filterStatus]);

  // Group submissions hierarchically: User -> Challenge -> Submissions
  const groupedSubmissions = useMemo(() => {
    // 1. Filter submissions based on search, status filter, and selected user filter
    const filteredSubs = submissions.filter(sub => {
      const userName = sub.user?.profile?.displayName || sub.user?.name || 'Unknown';
      const challengeTitle = sub.challenge?.title || (sub as any).challengeInstance?.challenge?.title || 'Eco Challenge';
      const matchSearch = subSearch.trim() === '' || 
        userName.toLowerCase().includes(subSearch.toLowerCase()) || 
        challengeTitle.toLowerCase().includes(subSearch.toLowerCase()) ||
        (sub.moderatorNotes && sub.moderatorNotes.toLowerCase().includes(subSearch.toLowerCase()));
      
      const matchStatus = subStatusFilter === 'All' || sub.status === subStatusFilter;
      const matchUser = selectedUserIdFilter === 'All' || sub.userId === selectedUserIdFilter;

      return matchSearch && matchStatus && matchUser;
    });

    // 2. Compute true chronological submission numbering per (userId + challengeId)
    const userChallengeSortedMap = new Map<string, ChallengeSubmission[]>();
    submissions.forEach(sub => {
      const key = `${sub.userId}___${sub.challengeId}`;
      if (!userChallengeSortedMap.has(key)) {
        userChallengeSortedMap.set(key, []);
      }
      userChallengeSortedMap.get(key)!.push(sub);
    });

    userChallengeSortedMap.forEach(list => {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    });

    const getSubmissionIndex = (sub: ChallengeSubmission) => {
      const key = `${sub.userId}___${sub.challengeId}`;
      const list = userChallengeSortedMap.get(key) || [];
      const idx = list.findIndex(s => s.id === sub.id);
      return idx >= 0 ? idx + 1 : 1;
    };

    // 3. Group by User -> Challenge
    interface UserGroup {
      userId: string;
      userName: string;
      displayName: string;
      avatarUrl: string | null;
      totalSubmissions: number;
      pendingCount: number;
      approvedCount: number;
      collectionCount: number;
      finalReviewCount: number;
      rejectedCount: number;
      latestCreatedAt: string;
      challenges: {
        challengeId: string;
        challengeTitle: string;
        quantityUnit: string;
        totalQuantity: number;
        pendingCount: number;
        submissions: {
          sub: ChallengeSubmission;
          submissionNumber: number;
        }[];
      }[];
    }

    const userMap = new Map<string, UserGroup>();

    filteredSubs.forEach(sub => {
      const userId = sub.userId || 'unknown';
      const userName = sub.user?.name || 'Unknown User';
      const displayName = sub.user?.profile?.displayName || userName;
      const avatarUrl = sub.user?.profile?.avatarUrl 
        ? (sub.user.profile.avatarUrl.startsWith('/') ? `${API_HOST}${sub.user.profile.avatarUrl}` : sub.user.profile.avatarUrl)
        : null;
      
      const challengeId = sub.challengeId || 'unknown-challenge';
      const challengeTitle = sub.challenge?.title || (sub as any).challengeInstance?.challenge?.title || 'Eco Challenge';
      const quantityUnit = sub.challenge?.quantityUnit || 'items';
      const quantity = sub.detectedQuantity || sub.reservedQuantity || 1;
      const submissionNumber = getSubmissionIndex(sub);

      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          userName,
          displayName,
          avatarUrl,
          totalSubmissions: 0,
          pendingCount: 0,
          approvedCount: 0,
          collectionCount: 0,
          finalReviewCount: 0,
          rejectedCount: 0,
          latestCreatedAt: sub.createdAt,
          challenges: []
        });
      }

      const userGroup = userMap.get(userId)!;
      userGroup.totalSubmissions += 1;
      if (sub.status === 'pending') userGroup.pendingCount += 1;
      if (sub.status === 'approved') userGroup.approvedCount += 1;
      if (sub.status === 'approved_collection') userGroup.collectionCount += 1;
      if (sub.status === 'final_review') userGroup.finalReviewCount += 1;
      if (sub.status === 'rejected') userGroup.rejectedCount += 1;

      if (new Date(sub.createdAt).getTime() > new Date(userGroup.latestCreatedAt).getTime()) {
        userGroup.latestCreatedAt = sub.createdAt;
      }

      let challengeGroup = userGroup.challenges.find(c => c.challengeId === challengeId);
      if (!challengeGroup) {
        challengeGroup = {
          challengeId,
          challengeTitle,
          quantityUnit,
          totalQuantity: 0,
          pendingCount: 0,
          submissions: []
        };
        userGroup.challenges.push(challengeGroup);
      }

      challengeGroup.totalQuantity += quantity;
      if (sub.status === 'pending' || sub.status === 'final_review') challengeGroup.pendingCount += 1;
      challengeGroup.submissions.push({
        sub,
        submissionNumber
      });
    });

    userMap.forEach(userGroup => {
      userGroup.challenges.forEach(ch => {
        // Sort submissions within each challenge so Submission #1, #2, etc. are ordered cleanly
        ch.submissions.sort((a, b) => b.submissionNumber - a.submissionNumber);
      });
      // Sort challenges with pending count first
      userGroup.challenges.sort((a, b) => b.pendingCount - a.pendingCount || a.challengeTitle.localeCompare(b.challengeTitle));
    });

    return Array.from(userMap.values()).sort((a, b) => {
      if (b.pendingCount !== a.pendingCount) {
        return b.pendingCount - a.pendingCount;
      }
      return new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime();
    });
  }, [submissions, subSearch, subStatusFilter, selectedUserIdFilter]);

  // Unique list of users for dropdown filter
  const uniqueUsers = useMemo(() => {
    const map = new Map<string, string>();
    submissions.forEach(s => {
      if (s.userId) {
        map.set(s.userId, s.user?.profile?.displayName || s.user?.name || 'Unknown User');
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [submissions]);

  const toggleUserCollapse = (userId: string) => {
    setCollapsedUsers(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  const toggleChallengeCollapse = (key: string) => {
    setCollapsedChallenges(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    setCollapsedUsers({});
    setCollapsedChallenges({});
  };

  const collapseAll = () => {
    const userCol: Record<string, boolean> = {};
    groupedSubmissions.forEach(u => {
      userCol[u.userId] = true;
    });
    setCollapsedUsers(userCol);
  };

  const handleAdd = async (form: FormData) => {
    const item = await adminPost<Challenge>('/admin/challenges', form);
    setChallenges(prev => [item, ...prev]);
  };

  const handleEdit = async (form: FormData) => {
    if (!editing) return;
    const updated = await adminPut<Challenge>(`/admin/challenges/${editing.id}`, form);
    setChallenges(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this challenge? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await adminDelete(`/admin/challenges/${id}`);
      setChallenges(prev => prev.filter(c => c.id !== id));
    } catch (err: any) { alert(err.message || 'Failed to delete.'); }
    finally { setDeleting(null); }
  };

  const handleToggleActive = async (challenge: Challenge) => {
    setToggling(challenge.id);
    const nextActive = !challenge.active;
    // Optimistically update the UI
    setChallenges(prev => prev.map(c => c.id === challenge.id ? { ...c, active: nextActive } : c));
    try {
      const updated = await adminPut<Challenge>(`/admin/challenges/${challenge.id}`, { active: nextActive });
      setChallenges(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch (err: any) {
      // Revert on failure
      setChallenges(prev => prev.map(c => c.id === challenge.id ? { ...c, active: challenge.active } : c));
      alert(err.message || 'Failed to toggle status.');
    } finally {
      setToggling(null);
    }
  };

  const handleToggleFeatured = async (challenge: Challenge) => {
    setTogglingFeatured(challenge.id);
    const nextFeatured = !challenge.isFeatured;
    setChallenges(prev => prev.map(c => c.id === challenge.id ? { ...c, isFeatured: nextFeatured } : c));
    try {
      const updated = await adminPut<Challenge>(`/admin/challenges/${challenge.id}`, { isFeatured: nextFeatured });
      setChallenges(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch (err: any) {
      setChallenges(prev => prev.map(c => c.id === challenge.id ? { ...c, isFeatured: challenge.isFeatured } : c));
      alert(err.message || 'Failed to toggle featured status.');
    } finally {
      setTogglingFeatured(null);
    }
  };

  const totalPoints = challenges.reduce((a, c) => a + c.expReward, 0);

  return (
    <div className="relative p-8 space-y-6 bg-gray-50/50 min-h-full">
      {modal === 'add' && <ChallengeModal onClose={() => setModal(null)} onSave={handleAdd} />}
      {modal === 'edit' && editing && <ChallengeModal onClose={() => { setModal(null); setEditing(null); }} onSave={handleEdit} initial={editing} />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Challenges</h2>
          <p className="text-gray-500 text-sm mt-1">Design and manage eco-challenges for the community</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Tab toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-800/50 rounded-xl p-1 gap-1">
            <button
              onClick={() => setActiveTab('challenges')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'challenges' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white dark:border dark:border-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 inline mr-1.5" />
              Challenges
            </button>
            <button
              onClick={() => setActiveTab('submissions')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all relative ${
                activeTab === 'submissions' ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white dark:border dark:border-gray-700' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 inline mr-1.5" />
              Submissions
              {submissions.filter(s => s.status === 'pending').length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {submissions.filter(s => s.status === 'pending').length}
                </span>
              )}
            </button>
          </div>
          {activeTab === 'challenges' && (
            <button onClick={() => setModal('add')} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 hover:shadow-lg active:scale-95 transition-all duration-200">
              <Plus className="w-4 h-4" />New Challenge
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {activeTab === 'challenges' ? (
        <>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Challenges', value: loading ? '—' : challenges.length, color: 'text-gray-900', icon: Trophy },
          { label: 'Active', value: loading ? '—' : challenges.filter(c => c.active).length, color: 'text-green-600', icon: Target },
          { label: 'Total Points', value: loading ? '—' : totalPoints.toLocaleString(), color: 'text-orange-500', icon: Coins },
        ].map((s, idx) => {
          const delayClass = idx === 0 ? '' : idx === 1 ? 'delay-60' : 'delay-160';
          return (
            <div key={s.label} className={`bg-white rounded-2xl border border-gray-100 p-5 shadow-sm animate-reveal ${delayClass} hover:-translate-y-1 hover:shadow-md transition-all duration-300`}>
              <div className="flex items-center gap-2 mb-2">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <p className="text-sm text-gray-500 font-medium">{s.label}</p>
              </div>
              <p className={`text-2xl font-serif font-bold ${s.color}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex gap-3 items-center animate-reveal delay-160">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search challenges..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all" />
        </div>
        {['All', 'Active', 'Inactive', 'Expired'].map(f => (
          <button key={f} onClick={() => setFilterStatus(f)} className={`px-4 py-2 text-sm rounded-xl border font-medium transition-all ${filterStatus === f ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}>{f}</button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-reveal delay-280">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/70">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-6 py-4">Challenge</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-4">Difficulty</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-4">Reward / Item</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-4">Available Qty</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-4">Status</th>
              <th className="px-4 py-4"></th>
            </tr>
          </thead>
          <tbody className="">
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-6 py-4"><div className="space-y-1.5"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-24" /></div></td>
                  <td className="px-4 py-4"><Skeleton className="h-6 w-14 rounded-full" /></td>
                  <td className="px-4 py-4"><Skeleton className="h-4 w-12" /></td>
                  <td className="px-4 py-4"><Skeleton className="h-4 w-8" /></td>
                  <td className="px-4 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
                  <td className="px-4 py-4"><Skeleton className="h-8 w-20 rounded-xl" /></td>
                </tr>
              ))
              : filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-green-50 border border-green-100 shrink-0 flex items-center justify-center">
                        {c.imageUrl ? (
                          <img src={c.imageUrl.startsWith('http') ? c.imageUrl : `${API_HOST}${c.imageUrl}`} className="w-full h-full object-cover" alt="Challenge" />
                        ) : (
                          <Trophy className="w-5 h-5 text-green-600 opacity-60" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{c.title}</p>
                        <p className="text-xs text-gray-400">{c.category || 'General'}{c.badgeLabel ? ` · ${c.badgeLabel}` : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${difficultyColors[c.difficulty] || 'bg-gray-100 text-gray-500'}`}>{c.difficulty}</span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-bold text-orange-500 flex items-center gap-1"><Trophy className="w-3.5 h-3.5" />{c.expReward} EXP</span>
                      {c.ecoCoinReward > 0 && <span className="text-sm font-bold text-green-600 flex items-center gap-1"><Coins className="w-3.5 h-3.5" />{c.ecoCoinReward} Coins</span>}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`text-sm font-bold ${c.availableQuantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {c.availableQuantity} {c.quantityUnit || 'items'}
                    </span>
                    <p className="text-[10px] text-gray-400">+{c.weeklyIncrementQuantity || 50}/wk</p>
                  </td>
                  <td className="px-4 py-4">
                    {(() => {
                      const statusLabel = c.active ? 'Active' : 'Inactive';
                      return (
                        <button
                          onClick={() => handleToggleActive(c)}
                          disabled={toggling === c.id}
                          title={c.active ? 'Click to set Inactive (hides from mobile app)' : 'Click to set Active (shows on mobile app)'}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors disabled:opacity-60 ${statusColors[statusLabel]} hover:brightness-95`}
                        >
                          {toggling === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
                          {statusLabel}
                        </button>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleToggleFeatured(c)} disabled={togglingFeatured === c.id} title={c.isFeatured ? 'Unfeature' : 'Feature'} className={`p-1.5 rounded-lg transition-colors disabled:opacity-60 ${c.isFeatured ? 'text-yellow-500 hover:bg-yellow-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                        {togglingFeatured === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className={`w-4 h-4 ${c.isFeatured ? 'fill-current' : ''}`} />}
                      </button>
                      <button onClick={() => handleToggleActive(c)} disabled={toggling === c.id} title={c.active ? 'Deactivate' : 'Activate'} className={`p-1.5 rounded-lg transition-colors disabled:opacity-60 ${c.active ? 'text-gray-500 hover:bg-gray-100' : 'text-green-600 hover:bg-green-50'}`}>
                        {toggling === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                      </button>
                      <button onClick={() => { setEditing(c); setModal('edit'); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-60">
                        {deleting === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
          {!loading && filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              {challenges.length === 0 ? 'No challenges yet. Create your first one!' : 'No challenges match your search.'}
            </div>
          )}
        </div>
        </>
      ) : (
        /* ─── SUBMISSIONS TAB (HIERARCHICAL USER -> CHALLENGE -> SUBMISSION) ─── */
        <div className="space-y-6">
          {/* Submissions stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Pending Review', value: submissions.filter(s => s.status === 'pending').length, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-100 dark:border-orange-800' },
              { label: 'Approved for Collection', value: submissions.filter(s => s.status === 'approved_collection').length, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100 dark:border-blue-800' },
              { label: 'Final Review', value: submissions.filter(s => s.status === 'final_review').length, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-100 dark:border-purple-800' },
              { label: 'Completed', value: submissions.filter(s => s.status === 'approved').length, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-100 dark:border-green-800' },
            ].map((s, idx) => {
              const delayClass = idx === 0 ? '' : idx === 1 ? 'delay-60' : 'delay-160';
              return (
              <div key={s.label} className={`${s.bg} rounded-2xl border ${s.border} p-5 shadow-sm animate-reveal ${delayClass}`}>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{s.label}</p>
                <p className={`text-3xl font-serif font-bold mt-1 ${s.color}`}>{submissionsLoading ? '—' : s.value}</p>
              </div>
            )})}
          </div>

          {/* Info banner about the flow */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-2xl p-4 flex items-start justify-between gap-3 animate-reveal delay-160">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-500 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Submissions Filtered by User & Challenge:</strong> Multiple submissions from the same user are grouped together hierarchically per challenge so you can review consecutive Before & After photos easily.
              </div>
            </div>
            <button onClick={loadSubmissions} className="text-xs text-blue-700 dark:text-blue-300 hover:underline flex items-center gap-1 font-semibold shrink-0 bg-blue-100/70 dark:bg-blue-800/40 px-3 py-1.5 rounded-lg">
              <RefreshCw className={`w-3.5 h-3.5 ${submissionsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 space-y-3 animate-reveal delay-160">
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search by user name, challenge title, or notes..." 
                  value={subSearch} 
                  onChange={e => setSubSearch(e.target.value)} 
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 dark:text-white transition-all" 
                />
              </div>

              {/* User Selector filter */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
                  <User className="w-4 h-4 text-gray-400" />
                  <select 
                    value={selectedUserIdFilter} 
                    onChange={e => setSelectedUserIdFilter(e.target.value)}
                    className="text-xs font-semibold bg-transparent text-gray-700 dark:text-gray-200 focus:outline-none cursor-pointer"
                  >
                    <option value="All">All Users ({uniqueUsers.length})</option>
                    {uniqueUsers.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                {/* Expand / Collapse All buttons */}
                <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-700 pl-2">
                  <button 
                    onClick={expandAll} 
                    className="px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    title="Expand All Users & Challenges"
                  >
                    Expand All
                  </button>
                  <button 
                    onClick={collapseAll} 
                    className="px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    title="Collapse All Users"
                  >
                    Collapse All
                  </button>
                </div>
              </div>
            </div>

            {/* Status pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 border-t border-gray-100 dark:border-gray-800 text-xs">
              <span className="text-gray-400 font-medium shrink-0 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filter Status:
              </span>
              {[
                { key: 'All', label: 'All Submissions' },
                { key: 'pending', label: 'Pending Review' },
                { key: 'approved_collection', label: 'Approved Collection' },
                { key: 'final_review', label: 'Final Review' },
                { key: 'approved', label: 'Completed / Approved' },
                { key: 'rejected', label: 'Rejected' },
              ].map(f => {
                const isActive = subStatusFilter === f.key;
                return (
                  <button
                    key={f.key}
                    onClick={() => setSubStatusFilter(f.key)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 ${
                      isActive 
                        ? 'bg-green-600 text-white shadow-sm' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grouped Submission Tree View */}
          {submissionsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 space-y-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800" />
                    <div className="space-y-2">
                      <div className="w-36 h-4 bg-gray-200 dark:bg-gray-800 rounded" />
                      <div className="w-24 h-3 bg-gray-200 dark:bg-gray-800 rounded" />
                    </div>
                  </div>
                  <div className="h-20 bg-gray-100 dark:bg-gray-800/50 rounded-xl" />
                </div>
              ))}
            </div>
          ) : groupedSubmissions.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-12 text-center text-gray-400 dark:text-gray-500 shadow-sm">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-30 text-gray-400" />
              <p className="text-base font-semibold text-gray-700 dark:text-gray-300">No submissions found</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try adjusting your search query or status filter.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {groupedSubmissions.map((userGroup) => {
                const isUserCollapsed = !!collapsedUsers[userGroup.userId];

                return (
                  <div 
                    key={userGroup.userId} 
                    className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-150 dark:border-gray-800 shadow-sm overflow-hidden transition-all duration-200"
                  >
                    {/* User Header */}
                    <div 
                      onClick={() => toggleUserCollapse(userGroup.userId)}
                      className="px-6 py-4 bg-linear-to-r from-gray-50/90 to-white dark:from-gray-800/80 dark:to-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors select-none"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="relative">
                          {userGroup.avatarUrl ? (
                            <img src={userGroup.avatarUrl} alt={userGroup.userName} className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-linear-to-tr from-green-600 to-emerald-400 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                              {userGroup.displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {userGroup.pendingCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 border-2 border-white dark:border-gray-900 rounded-full flex items-center justify-center text-[9px] font-bold text-white">
                              {userGroup.pendingCount}
                            </span>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-gray-900 dark:text-white">{userGroup.displayName}</h4>
                            {userGroup.userName !== userGroup.displayName && (
                              <span className="text-xs text-gray-400 font-normal">(@{userGroup.userName})</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-0.5">
                            <span>{userGroup.challenges.length} {userGroup.challenges.length === 1 ? 'Challenge' : 'Challenges'}</span>
                            <span>•</span>
                            <span>{userGroup.totalSubmissions} Total {userGroup.totalSubmissions === 1 ? 'Submission' : 'Submissions'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {userGroup.pendingCount > 0 && (
                          <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border border-orange-200 dark:border-orange-800 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {userGroup.pendingCount} Pending Review
                          </span>
                        )}
                        <button className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                          {isUserCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {/* User Challenges & Submissions Body */}
                    {!isUserCollapsed && (
                      <div className="p-5 sm:p-6 space-y-5 bg-gray-50/40 dark:bg-gray-950/40">
                        {userGroup.challenges.map((challengeGroup) => {
                          const challengeKey = `${userGroup.userId}___${challengeGroup.challengeId}`;
                          const isChallengeCollapsed = !!collapsedChallenges[challengeKey];

                          return (
                            <div 
                              key={challengeGroup.challengeId}
                              className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200/80 dark:border-gray-800 shadow-sm overflow-hidden"
                            >
                              {/* Challenge Sub-Header */}
                              <div 
                                onClick={() => toggleChallengeCollapse(challengeKey)}
                                className="px-5 py-3.5 bg-gray-50/70 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between cursor-pointer hover:bg-gray-100/70 dark:hover:bg-gray-800/70 transition-colors select-none"
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center font-bold">
                                    <Trophy className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <span className="text-sm font-bold text-gray-900 dark:text-white">
                                      {challengeGroup.challengeTitle}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2.5">
                                      ({challengeGroup.submissions.length} {challengeGroup.submissions.length === 1 ? 'submission' : 'submissions'} · {challengeGroup.totalQuantity} {challengeGroup.quantityUnit})
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {challengeGroup.pendingCount > 0 && (
                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                      {challengeGroup.pendingCount} action needed
                                    </span>
                                  )}
                                  {isChallengeCollapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                                </div>
                              </div>

                              {/* Submissions Table / Cards */}
                              {!isChallengeCollapsed && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-left">
                                    <thead>
                                      <tr className="border-b border-gray-100 dark:border-gray-800 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-white dark:bg-gray-900">
                                        <th className="px-5 py-3 w-36">Submission #</th>
                                        <th className="px-4 py-3">Quantity</th>
                                        <th className="px-4 py-3">Photos (Before / After)</th>
                                        <th className="px-4 py-3">Stage / Status</th>
                                        <th className="px-4 py-3">Municipal QR</th>
                                        <th className="px-4 py-3">Date Submitted</th>
                                        <th className="px-5 py-3 text-right">Review Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                                      {challengeGroup.submissions.map(({ sub, submissionNumber }) => {
                                        const fullProofUrl = sub.proofUrl ? (sub.proofUrl.startsWith('/') ? `${API_HOST}${sub.proofUrl}` : sub.proofUrl) : null;
                                        const fullAfterUrl = sub.afterProofUrl ? (sub.afterProofUrl.startsWith('/') ? `${API_HOST}${sub.afterProofUrl}` : sub.afterProofUrl) : null;

                                        const statusBg: Record<string, string> = {
                                          pending: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
                                          approved: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
                                          approved_collection: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
                                          final_review: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800',
                                          rejected: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
                                        };

                                        return (
                                          <tr key={sub.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors">
                                            {/* Submission Number */}
                                            <td className="px-5 py-4">
                                              <div className="flex items-center gap-2">
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-green-100/80 text-green-800 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-800">
                                                  Submission #{submissionNumber}
                                                </span>
                                              </div>
                                            </td>

                                            {/* Count / Quantity */}
                                            <td className="px-4 py-4">
                                              <span className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                                {sub.detectedQuantity || sub.reservedQuantity || 1} {sub.challenge?.quantityUnit || challengeGroup.quantityUnit || 'items'}
                                              </span>
                                            </td>

                                            {/* Photos */}
                                            <td className="px-4 py-4">
                                              <div className="flex items-center gap-2">
                                                {fullProofUrl ? (
                                                  <button 
                                                    onClick={() => setSelectedImage(fullProofUrl)} 
                                                    className="relative w-14 h-11 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group/img cursor-pointer hover:ring-2 hover:ring-green-400 transition-all shadow-xs"
                                                    title="Click to zoom BEFORE photo"
                                                  >
                                                    <img src={fullProofUrl} alt="Before" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                      <span className="text-white text-[9px] font-bold">BEFORE</span>
                                                    </div>
                                                  </button>
                                                ) : (
                                                  <span className="text-xs text-gray-400 dark:text-gray-500 italic">No before</span>
                                                )}

                                                {fullAfterUrl ? (
                                                  <button 
                                                    onClick={() => setSelectedImage(fullAfterUrl)} 
                                                    className="relative w-14 h-11 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group/img cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all shadow-xs"
                                                    title="Click to zoom AFTER photo"
                                                  >
                                                    <img src={fullAfterUrl} alt="After" className="w-full h-full object-cover" />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                      <span className="text-white text-[9px] font-bold">AFTER</span>
                                                    </div>
                                                  </button>
                                                ) : (
                                                  <span className="text-[11px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md">
                                                    Awaiting after photo
                                                  </span>
                                                )}
                                              </div>
                                            </td>

                                            {/* Stage / Status */}
                                            <td className="px-4 py-4">
                                              <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full border ${statusBg[sub.status] || 'bg-gray-50 text-gray-600 border-gray-100 dark:bg-gray-800 dark:text-gray-400'}`}>
                                                {sub.status === 'approved_collection' ? '📦 Approved for Collection' : sub.status === 'final_review' ? '🔍 Final Review (Weekend)' : sub.status === 'approved' ? '✅ Completed / Approved' : sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                                              </span>
                                              {sub.moderatorNotes && (
                                                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 max-w-44 truncate" title={sub.moderatorNotes}>
                                                  Note: {sub.moderatorNotes}
                                                </p>
                                              )}
                                            </td>

                                            {/* QR */}
                                            <td className="px-4 py-4">
                                              {sub.qrToken ? (
                                                <button
                                                  onClick={() => setSelectedQr(sub)}
                                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                                                >
                                                  <QrCode className="w-3.5 h-3.5" />
                                                  {sub.qrVerified ? 'Verified ✓' : 'View QR'}
                                                </button>
                                              ) : (
                                                <span className="text-xs text-gray-400 dark:text-gray-500">—</span>
                                              )}
                                            </td>

                                            {/* Date */}
                                            <td className="px-4 py-4">
                                              <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                                                {new Date(sub.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                                              </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-5 py-4 text-right">
                                              <div className="flex items-center gap-1.5 justify-end">
                                                {sub.status === 'pending' && (
                                                  <button
                                                    onClick={() => handlePreliminaryApprove(sub.id)}
                                                    disabled={processingSubId === sub.id}
                                                    title="Preliminary Approve → Approved for Collection & Generate QR"
                                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-all shadow-xs active:scale-95 disabled:opacity-50"
                                                  >
                                                    {processingSubId === sub.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                                                    Prelim. Approve
                                                  </button>
                                                )}
                                                {(sub.status === 'final_review' || (sub.status === 'approved_collection' && sub.afterProofUrl)) && (
                                                  <button
                                                    onClick={() => handleFinalApprove(sub.id)}
                                                    disabled={processingSubId === sub.id}
                                                    title="Final Approve → Grant linear YOLO rewards"
                                                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-green-600 text-white hover:bg-green-700 rounded-lg transition-all shadow-xs active:scale-95 disabled:opacity-50"
                                                  >
                                                    {processingSubId === sub.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                                                    Final Approve
                                                  </button>
                                                )}
                                                {(sub.status === 'pending' || sub.status === 'final_review') && (
                                                  <button
                                                    onClick={() => handleRejectSubmission(sub.id)}
                                                    disabled={processingSubId === sub.id}
                                                    title="Reject & Return Reserved Quantity"
                                                    className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 disabled:opacity-50 rounded-lg transition-colors"
                                                  >
                                                    {processingSubId === sub.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                                  </button>
                                                )}
                                                {sub.status === 'approved' && (
                                                  <span className="text-xs font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                                                    <CheckCircle2 className="w-4 h-4" /> Approved
                                                  </span>
                                                )}
                                                {sub.status === 'rejected' && (
                                                  <span className="text-xs font-semibold text-red-500 flex items-center gap-1">
                                                    <XCircle className="w-4 h-4" /> Rejected
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* QR Code Modal for Verification */}
      {selectedQr && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setSelectedQr(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full flex flex-col items-center shadow-2xl relative animate-modal" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedQr(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 text-center">Municipal Collection QR</h3>
            <p className="text-xs text-gray-500 text-center mt-1 mb-4">
              Scan this QR at the collection point on the weekend to unlock the After photo step.
            </p>
            
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center mb-4">
              <QRCodeCanvas
                value={selectedQr.qrToken || JSON.stringify({ subId: selectedQr.id, userId: selectedQr.userId })}
                size={200}
                level="H"
                includeMargin
              />
            </div>

            <div className="w-full bg-gray-50 rounded-xl p-3 text-xs space-y-1 text-gray-600 border border-gray-200">
              <p><strong>User:</strong> {selectedQr.user?.profile?.displayName || selectedQr.user?.name}</p>
              <p><strong>Challenge:</strong> {selectedQr.challenge?.title}</p>
              <p><strong>Quantity:</strong> {selectedQr.detectedQuantity || selectedQr.reservedQuantity || 1} items</p>
              <p><strong>Status:</strong> {selectedQr.qrVerified ? '✅ QR Verified' : '⏳ Awaiting Scan'}</p>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Image preview modal */}
      {selectedImage && createPortal(
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh] flex items-center justify-center animate-modal" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedImage(null)} className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white">
              <XCircle className="w-8 h-8" />
            </button>
            <img src={selectedImage} alt="Proof" className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/10" />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
