import { useState, useEffect, useMemo } from 'react';
import { Trophy, Plus, Edit3, Trash2, Users, Clock, Coins, Search, Target, AlertCircle, X, Loader2 } from 'lucide-react';
import { adminGet, adminPost, adminPut, adminDelete } from '../../../utils/adminApi';

interface Challenge {
  id: string;
  title: string;
  description: string;
  difficulty: string;
  category: string | null;
  durationDays: number;
  expReward: number;
  ecoCoinReward: number;
  active: boolean;
  imageUrl: string | null;
  badgeLabel: string | null;
  type: string;
  aiDetectionTargets: string[];
  aiMinimumConfidence: number;
  createdAt: string;
  updatedAt: string;
  userChallenges?: { id: string }[];
}

const statusColors: Record<string, string> = {
  Active: 'bg-green-50 text-green-700 border-green-100',
  Inactive: 'bg-gray-100 text-gray-500 border-gray-200',
};

const difficultyColors: Record<string, string> = {
  Easy: 'bg-green-50 text-green-600',
  Medium: 'bg-yellow-50 text-yellow-700',
  Hard: 'bg-red-50 text-red-600',
  Expert: 'bg-purple-50 text-purple-700',
};

const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Expert'];
const CATEGORIES = ['General', 'Waste', 'Transport', 'Food', 'Energy', 'Nature', 'Water', 'Lifestyle'];
const CHALLENGE_TYPES = ['Standard Challenge', 'AI Image Recognition Challenge', 'Event Challenge', 'Quiz Challenge'];
const AI_TARGET_OPTIONS = ['Plastic Bottle', 'Glass Bottle', 'Can', 'Paper', 'Cardboard'];

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

interface FormData {
  title: string;
  description: string;
  difficulty: string;
  category: string;
  durationDays: number;
  expReward: number;
  ecoCoinReward: number;
  active: boolean;
  badgeLabel: string;
  type: string;
  aiDetectionTargets: string[];
  aiMinimumConfidence: number;
}
const emptyForm: FormData = { title: '', description: '', difficulty: 'Easy', category: 'General', durationDays: 7, expReward: 100, ecoCoinReward: 0, active: true, badgeLabel: '', type: 'Standard Challenge', aiDetectionTargets: [], aiMinimumConfidence: 80 };

interface ModalProps {
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  initial?: Challenge | null;
}

function ChallengeModal({ onClose, onSave, initial }: ModalProps) {
  const [form, setForm] = useState<FormData>(
    initial
      ? { title: initial.title, description: initial.description, difficulty: initial.difficulty, category: initial.category || 'General', durationDays: initial.durationDays, expReward: initial.expReward, ecoCoinReward: initial.ecoCoinReward, active: initial.active, badgeLabel: initial.badgeLabel || '', type: initial.type || 'Standard Challenge', aiDetectionTargets: initial.aiDetectionTargets || [], aiMinimumConfidence: initial.aiMinimumConfidence || 80 }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description) { setErr('Title and description are required.'); return; }
    setSaving(true); setErr('');
    try { await onSave(form); onClose(); }
    catch (e: any) { setErr(e.message || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-serif font-bold text-gray-900">{initial ? 'Edit Challenge' : 'New Challenge'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3 mb-4">{err}</p>}
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" placeholder="Challenge title" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={6} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Challenge Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400">
                  {CHALLENGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {form.type === 'AI Image Recognition Challenge' && (
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl space-y-4">
                  <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                    <Target className="w-4 h-4" /> AI Detection Settings
                  </h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-2">Targets to Detect</label>
                    <div className="grid grid-cols-2 gap-2">
                      {AI_TARGET_OPTIONS.map(target => (
                        <label key={target} className="flex items-center gap-2 text-sm text-blue-900 bg-white px-3 py-2 rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-50 transition-colors">
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
                            className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                          />
                          {target}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-800 mb-1">Minimum Confidence (%)</label>
                    <input 
                      type="number" min={1} max={100} 
                      value={form.aiMinimumConfidence} 
                      onChange={e => setForm(f => ({ ...f, aiMinimumConfidence: Number(e.target.value) }))} 
                      className="w-full px-4 py-2.5 text-sm border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-white" 
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                  <select value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400">
                    {DIFFICULTIES.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400">
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (days)</label>
                  <input type="number" min={1} value={form.durationDays} onChange={e => setForm(f => ({ ...f, durationDays: Number(e.target.value) }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">EXP Points Reward</label>
                  <input type="number" min={0} value={form.expReward} onChange={e => setForm(f => ({ ...f, expReward: Number(e.target.value) }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Eco Coin Reward</label>
                  <input type="number" min={0} value={form.ecoCoinReward} onChange={e => setForm(f => ({ ...f, ecoCoinReward: Number(e.target.value) }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Badge Label (optional)</label>
                <input value={form.badgeLabel} onChange={e => setForm(f => ({ ...f, badgeLabel: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" placeholder="e.g. Eco Warrior" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer pt-2">
                <div className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${form.active ? 'bg-green-500' : 'bg-gray-300'}`} onClick={() => setForm(f => ({ ...f, active: !f.active }))}>
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${form.active ? 'translate-x-4' : ''}`} />
                </div>
                <span className="text-sm font-medium text-gray-700">Active (visible to users)</span>
              </label>
            </div>
          </div>
          <div className="flex gap-3 pt-6 mt-6 border-t border-gray-100">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving…' : (initial ? 'Update' : 'Create Challenge')}
            </button>
          </div>
        </form>
      </div>
    </div>
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

  const load = async () => {
    try {
      const data = await adminGet<Challenge[]>('/admin/challenges');
      setChallenges(data);
    } catch (err: any) { setError(err.message || 'Failed to load challenges.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    challenges.filter(c =>
      (filterStatus === 'All' || (filterStatus === 'Active' ? c.active : !c.active)) &&
      c.title.toLowerCase().includes(search.toLowerCase())
    ), [challenges, search, filterStatus]);

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

  const totalParticipants = challenges.reduce((a, c) => a + (c.userChallenges?.length || 0), 0);
  const totalPoints = challenges.reduce((a, c) => a + c.expReward, 0);

  return (
    <div className="p-8 space-y-6 bg-gray-50/50 min-h-full">
      {modal === 'add' && <ChallengeModal onClose={() => setModal(null)} onSave={handleAdd} />}
      {modal === 'edit' && editing && <ChallengeModal onClose={() => { setModal(null); setEditing(null); }} onSave={handleEdit} initial={editing} />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Challenges</h2>
          <p className="text-gray-500 text-sm mt-1">Design and manage eco-challenges for the community</p>
        </div>
        <button onClick={() => setModal('add')} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 hover:shadow-lg active:scale-95 transition-all duration-200">
          <Plus className="w-4 h-4" />New Challenge
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Challenges', value: loading ? '—' : challenges.length, color: 'text-gray-900', icon: Trophy },
          { label: 'Active', value: loading ? '—' : challenges.filter(c => c.active).length, color: 'text-green-600', icon: Target },
          { label: 'Participants', value: loading ? '—' : totalParticipants.toLocaleString(), color: 'text-blue-600', icon: Users },
          { label: 'Total Points', value: loading ? '—' : totalPoints.toLocaleString(), color: 'text-orange-500', icon: Coins },
        ].map((s, idx) => {
          const delayClass = idx === 0 ? '' : idx === 1 ? 'delay-60' : idx === 2 ? 'delay-160' : 'delay-280';
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
        {['All', 'Active', 'Inactive'].map(f => (
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
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-4">Rewards</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-4">Duration</th>
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
                    <td className="px-4 py-4"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
                    <td className="px-4 py-4"><Skeleton className="h-8 w-20 rounded-xl" /></td>
                  </tr>
                ))
              : filtered.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900">{c.title}</p>
                      <p className="text-xs text-gray-400">{c.category || 'General'}{c.badgeLabel ? ` · ${c.badgeLabel}` : ''}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${difficultyColors[c.difficulty] || 'bg-gray-100 text-gray-500'}`}>{c.difficulty}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-orange-500 flex items-center gap-1"><Trophy className="w-3.5 h-3.5" />{c.expReward} EXP Points</span>
                        {c.ecoCoinReward > 0 && <span className="text-sm font-bold text-green-600 flex items-center gap-1"><Coins className="w-3.5 h-3.5" />{c.ecoCoinReward} Coins</span>}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-500 flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-300" />{c.durationDays}d</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${statusColors[c.active ? 'Active' : 'Inactive']}`}>{c.active ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
    </div>
  );
}
