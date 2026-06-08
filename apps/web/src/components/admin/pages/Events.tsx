import { useState, useEffect, useMemo } from 'react';
import { Calendar, Plus, Edit3, Trash2, MapPin, Users, Clock, Search, AlertCircle, X, Loader2 } from 'lucide-react';
import { adminGet, adminPost, adminPut, adminDelete } from '../../../utils/adminApi';

interface AdminEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  date: string;
  capacity: number;
  pointsReward: number;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
  registrations: { id: string }[];
  managedBy: { id: string; name: string; email: string };
}

const statusColors: Record<string, string> = {
  Upcoming: 'bg-blue-50 text-blue-700 border-blue-100',
  Past: 'bg-gray-100 text-gray-500 border-gray-200',
  Full: 'bg-red-50 text-red-700 border-red-100',
};

function getEventStatus(event: AdminEvent) {
  const now = new Date();
  const eventDate = new Date(event.date);
  if (eventDate < now) return 'Past';
  if (event.registrations.length >= event.capacity) return 'Full';
  return 'Upcoming';
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

interface FormData {
  title: string;
  description: string;
  location: string;
  date: string;
  capacity: number;
  pointsReward: number;
}

const emptyForm: FormData = {
  title: '',
  description: '',
  location: '',
  date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  capacity: 50,
  pointsReward: 100,
};

interface ModalProps {
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  initial?: AdminEvent | null;
}

function EventModal({ onClose, onSave, initial }: ModalProps) {
  const [form, setForm] = useState<FormData>(
    initial
      ? {
          title: initial.title,
          description: initial.description,
          location: initial.location,
          date: new Date(initial.date).toISOString().slice(0, 16),
          capacity: initial.capacity,
          pointsReward: initial.pointsReward,
        }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.location || !form.date) {
      setErr('All fields are required.');
      return;
    }
    setSaving(true); setErr('');
    try { await onSave(form); onClose(); }
    catch (e: any) { setErr(e.message || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-serif font-bold text-gray-900">{initial ? 'Edit Event' : 'Create Event'}</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {err && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{err}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" placeholder="Event title" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" placeholder="e.g. Bondi Beach, Sydney" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time *</label>
            <input type="datetime-local" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
              <input type="number" min={1} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: Number(e.target.value) }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Points Reward</label>
              <input type="number" min={0} value={form.pointsReward} onChange={e => setForm(f => ({ ...f, pointsReward: Number(e.target.value) }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving…' : (initial ? 'Update Event' : 'Create Event')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Events() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [modal, setModal] = useState<'add' | 'edit' | null>(null);
  const [editing, setEditing] = useState<AdminEvent | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await adminGet<AdminEvent[]>('/admin/events');
      setEvents(data);
    } catch (err: any) { setError(err.message || 'Failed to load events.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return events.filter(e => {
      const status = getEventStatus(e);
      return (filterStatus === 'All' || status === filterStatus) &&
        e.title.toLowerCase().includes(search.toLowerCase());
    });
  }, [events, search, filterStatus]);

  const handleAdd = async (form: FormData) => {
    const item = await adminPost<AdminEvent>('/admin/events', form);
    setEvents(prev => [item, ...prev]);
  };

  const handleEdit = async (form: FormData) => {
    if (!editing) return;
    const updated = await adminPut<AdminEvent>(`/admin/events/${editing.id}`, form);
    setEvents(prev => prev.map(e => e.id === updated.id ? updated : e));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event? All registrations will also be removed.')) return;
    setDeleting(id);
    try {
      await adminDelete(`/admin/events/${id}`);
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (err: any) { alert(err.message || 'Failed to delete.'); }
    finally { setDeleting(null); }
  };

  const totalAttendees = events.reduce((a, e) => a + e.registrations.length, 0);

  return (
    <div className="p-8 space-y-6 bg-gray-50/50 min-h-full">
      {modal === 'add' && <EventModal onClose={() => setModal(null)} onSave={handleAdd} />}
      {modal === 'edit' && editing && <EventModal onClose={() => { setModal(null); setEditing(null); }} onSave={handleEdit} initial={editing} />}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Events</h2>
          <p className="text-gray-500 text-sm mt-1">Organize and track community eco-events</p>
        </div>
        <button onClick={() => setModal('add')} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 hover:shadow-lg active:scale-95 transition-all duration-200">
          <Plus className="w-4 h-4" />Create Event
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
          { label: 'Total Events', value: loading ? '—' : events.length, color: 'text-gray-900' },
          { label: 'Upcoming', value: loading ? '—' : events.filter(e => getEventStatus(e) === 'Upcoming').length, color: 'text-blue-600' },
          { label: 'Total Attendees', value: loading ? '—' : totalAttendees, color: 'text-green-600' },
          { label: 'Past Events', value: loading ? '—' : events.filter(e => getEventStatus(e) === 'Past').length, color: 'text-gray-500' },
        ].map((s, idx) => {
          const delayClass = idx === 0 ? '' : idx === 1 ? 'delay-60' : idx === 2 ? 'delay-160' : 'delay-280';
          return (
            <div key={s.label} className={`bg-white rounded-2xl border border-gray-100 p-5 shadow-sm animate-reveal ${delayClass} hover:-translate-y-1 hover:shadow-md transition-all duration-300`}>
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
          <input type="text" placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400 transition-all" />
        </div>
        {['All', 'Upcoming', 'Past', 'Full'].map(f => (
          <button key={f} onClick={() => setFilterStatus(f)} className={`px-4 py-2 text-sm rounded-xl border font-medium transition-all ${filterStatus === f ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'}`}>{f}</button>
        ))}
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-reveal delay-280">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))
          : filtered.map(event => {
              const fillPct = Math.min(100, Math.round((event.registrations.length / event.capacity) * 100));
              const status = getEventStatus(event);
              return (
                <div key={event.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 p-5 group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center text-2xl">
                        🌿
                      </div>
                      <div>
                        <h3 className="font-serif font-bold text-gray-900">{event.title}</h3>
                        <p className="text-xs text-gray-400">By {event.managedBy.name}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${statusColors[status]}`}>{status}</span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <MapPin className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />{event.location}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-gray-300" />{new Date(event.date).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-300" />{new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{event.description}</p>
                  </div>

                  {/* Capacity bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{event.registrations.length} attending</span>
                      <span>{fillPct}% full ({event.capacity} cap.)</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${fillPct >= 90 ? 'bg-red-400' : fillPct >= 70 ? 'bg-orange-400' : 'bg-green-400'}`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button onClick={() => { setEditing(event); setModal('edit'); }} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-xs font-semibold rounded-xl hover:bg-blue-100 transition-colors">
                      <Edit3 className="w-3 h-3" />Edit
                    </button>
                    <button onClick={() => handleDelete(event.id)} disabled={deleting === event.id} className="flex items-center justify-center px-3 py-2 bg-red-50 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-100 transition-colors disabled:opacity-60">
                      {deleting === event.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              );
            })}
      </div>

      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">{events.length === 0 ? 'No events yet. Create your first one!' : 'No events match your search.'}</p>
        </div>
      )}
    </div>
  );
}
