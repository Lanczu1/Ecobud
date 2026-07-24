import { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, Plus, Edit3, Trash2, MapPin, Users, Clock, Search, AlertCircle, X, Loader2 } from 'lucide-react';
import { adminGet, adminPost, adminPut, adminDelete } from '../../../utils/adminApi';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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
  latitude: number | null;
  longitude: number | null;
}

function formatDateForInput(dateStr?: string | Date): string {
  const date = dateStr ? new Date(dateStr) : new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

const emptyForm: FormData = {
  title: '',
  description: '',
  location: '',
  date: '', // Set in component
  capacity: 50,
  pointsReward: 100,
  latitude: null,
  longitude: null,
};

interface ModalProps {
  onClose: () => void;
  onSave: (data: FormData) => Promise<void>;
  initial?: AdminEvent | null;
}

function LocationPickerMarker({ position, onChange }: { position: [number, number] | null, onChange: (lat: number, lng: number) => void }) {
  const map = useMap();

  const prevPos = useRef<[number, number] | null>(null);

  useEffect(() => {
    if (position && (!prevPos.current || prevPos.current[0] !== position[0] || prevPos.current[1] !== position[1])) {
      map.flyTo(position, 16);
      prevPos.current = position;
    }
  }, [position, map]);

  const icon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });

  return position === null ? null : (
    <Marker position={position} icon={icon} />
  );
}

function EventModal({ onClose, onSave, initial }: ModalProps) {
  const [form, setForm] = useState<FormData>(
    initial
      ? {
        title: initial.title,
        description: initial.description,
        location: initial.location,
        date: formatDateForInput(initial.date),
        capacity: initial.capacity,
        pointsReward: initial.pointsReward,
        latitude: initial.latitude,
        longitude: initial.longitude,
      }
      : { ...emptyForm, date: formatDateForInput() }
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  const modalWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = document.getElementById('admin-scroll-container');
    if (!container) return;
    let rafId: number;
    const updatePosition = () => {
      if (modalWrapperRef.current) {
        modalWrapperRef.current.style.transform = `translateY(${container.scrollTop + 40}px)`;
      }
    };
    const onScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updatePosition);
    };
    updatePosition();
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 280);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description || !form.location || !form.date) {
      setErr('All fields are required.');
      return;
    }
    setSaving(true); setErr('');
    try { 
      const payload = { ...form };
      if (!payload.date.includes('+') && !payload.date.endsWith('Z')) {
        payload.date = `${payload.date}:00+08:00`; // append seconds and PH offset
      }
      await onSave(payload); 
      handleClose(); 
    }
    catch (e: any) { setErr(e.message || 'Failed to save.'); }
    finally { setSaving(false); }
  };

  return (
    <div ref={modalWrapperRef} className="absolute inset-x-0 z-50 flex justify-center p-4 pointer-events-none" style={{ top: 0, willChange: 'transform' }}>
      <div className={`relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden pointer-events-auto ${isClosing ? 'animate-modal-exit' : 'animate-modal'}`} style={{ maxHeight: 'calc(100vh - 160px)' }}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-serif font-bold text-gray-900">{initial ? 'Edit Event' : 'Create Event'}</h2>
          <button type="button" onClick={handleClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form id="event-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
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
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">Map Pin (Optional)</label>
              <button 
                type="button"
                onClick={() => {
                  if (navigator.geolocation) {
                    const handleSuccess = (pos: GeolocationPosition) => {
                      setForm(f => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
                    };
                    const handleFallback = (err: GeolocationPositionError) => {
                      if (err.code === err.TIMEOUT || err.code === err.POSITION_UNAVAILABLE) {
                        // Fallback to low accuracy
                        navigator.geolocation.getCurrentPosition(
                          handleSuccess,
                          (err2) => alert('Unable to fetch location: ' + err2.message),
                          { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
                        );
                      } else {
                        alert('Unable to fetch location: ' + err.message);
                      }
                    };
                    navigator.geolocation.getCurrentPosition(
                      handleSuccess,
                      handleFallback,
                      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
                    );
                  } else {
                    alert('Geolocation is not supported by this browser.');
                  }
                }}
                className="text-xs text-green-600 hover:text-green-700 font-semibold flex items-center gap-1"
              >
                <MapPin className="w-3 h-3" /> Use My Location
              </button>
            </div>
            <div className="h-48 rounded-xl overflow-hidden border border-gray-200 relative z-0">
              <MapContainer 
                center={form.latitude && form.longitude ? [form.latitude, form.longitude] : [14.5995, 120.9842]}
                zoom={11} 
                scrollWheelZoom={false}
                className="w-full h-full"
                style={{ height: '100%', width: '100%', zIndex: 0 }}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <LocationPickerMarker 
                  position={form.latitude && form.longitude ? [form.latitude, form.longitude] : null}
                  onChange={(lat, lng) => setForm(f => ({ ...f, latitude: lat, longitude: lng }))}
                />
              </MapContainer>
            </div>
            <p className="text-xs text-gray-500 mt-1">Tap on the map to pin the exact coordinates for the mobile app.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date &amp; Time *</label>
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
        </form>
        {/* Footer buttons */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-white flex justify-end gap-3">
          <button type="button" onClick={handleClose} className="px-6 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
          <button form="event-form" type="submit" disabled={saving} className="px-6 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : (initial ? 'Update Event' : 'Create Event')}
          </button>
        </div>
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
    <div className="relative p-8 space-y-6 bg-gray-50/50 min-h-full">
      {/* Backdrop overlay - blur only, covers full scroll content area */}
      {modal && (
        <div
          className="absolute inset-0 z-40 backdrop-blur-sm pointer-events-auto"
          onClick={() => { setModal(null); setEditing(null); }}
        />
      )}
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
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-gray-300" />{new Date(event.date).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-300" />{new Date(event.date).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })}</span>
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
