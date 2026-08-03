import React from 'react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, Plus, Edit3, Trash2, MapPin, Users, Clock, Search, AlertCircle, X, Loader2, Image as ImageIcon, QrCode, Download, Leaf, FileText, BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { adminGet, adminPost, adminPut, adminDelete, adminPostForm, adminPutForm, API_HOST } from '../../../utils/adminApi';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface AdminEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  startDatetime: string;
  endDatetime: string;
  capacity: number;
  expReward: number;
  ecoCoinsReward: number;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
  registrations: { id: string }[];
  managedBy: { id: string; name: string; email: string };
}

interface EventReportStats {
  totalRegistered: number;
  attended: number;
  qrVerified: number;
  pendingVerification: number;
  approved: number;
  rejected: number;
  totalCoinsAwarded: number;
  totalExpAwarded: number;
}

interface EventReportData {
  event: AdminEvent;
  stats: EventReportStats;
  participants: {
    name: string;
    email: string;
    attendanceStatus: string;
    qrVerification: string;
    rewardStatus: string;
    coinsAwarded: number;
    expAwarded: number;
    joinedDate: string;
  }[];
  photos: string[];
}

const statusColors: Record<string, string> = {
  Upcoming: 'bg-blue-50 text-blue-700 border-blue-100',
  Past: 'bg-gray-100 text-gray-500 border-gray-200',
  Full: 'bg-red-50 text-red-700 border-red-100',
};

function getEventStatus(event: AdminEvent) {
  const now = new Date();
  const eventDate = new Date(event.startDatetime);
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
  startDatetime: string;
  endDatetime: string;
  capacity: number;
  pointsReward: number;
  coinReward: number;
  latitude: number | null;
  longitude: number | null;
  imageFile?: File | null;
  imageUrl?: string | null;
}

function formatDateForInput(dateStr?: string | Date): string {
  const date = dateStr ? new Date(dateStr) : new Date();
  try {
    return date.toLocaleString('sv-SE', { timeZone: 'Asia/Manila' }).replace(' ', 'T').slice(0, 16);
  } catch (err) {
    const iso = date.toISOString();
    return iso.substring(0, 16);
  }
}

const emptyForm: FormData = {
  title: '',
  description: '',
  location: '',
  startDatetime: '',
  endDatetime: '',
  capacity: 50,
  pointsReward: 100,
  coinReward: 10,
  latitude: null,
  longitude: null,
  imageFile: null,
  imageUrl: null,
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
        startDatetime: formatDateForInput(initial.startDatetime),
        endDatetime: formatDateForInput(initial.endDatetime),
        capacity: initial.capacity,
        pointsReward: initial.expReward,
        coinReward: initial.ecoCoinsReward ?? 0,
        latitude: initial.latitude,
        longitude: initial.longitude,
      }
        : { 
            ...emptyForm, 
            startDatetime: formatDateForInput(), 
            endDatetime: (() => {
              const d = new Date();
              d.setHours(d.getHours() + 1);
              return formatDateForInput(d);
            })() 
          }
  );
  const [imagePreview, setImagePreview] = useState<string | null>(initial?.imageUrl ? `${API_HOST}${initial.imageUrl}` : null);
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
    if (!form.title || !form.description || !form.location || !form.startDatetime || !form.endDatetime) {
      setErr('All fields are required.');
      return;
    }
    if (new Date(form.endDatetime) <= new Date(form.startDatetime)) {
      setErr('End date & time must be after start date & time.');
      return;
    }
    setSaving(true); setErr('');
    try { 
      const payload = { ...form };
      if (!payload.startDatetime.includes('+') && !payload.startDatetime.endsWith('Z')) {
        payload.startDatetime = `${payload.startDatetime}:00+08:00`;
      }
      if (!payload.endDatetime.includes('+') && !payload.endDatetime.endsWith('Z')) {
        payload.endDatetime = `${payload.endDatetime}:00+08:00`;
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Event Image</label>
            <div className="flex items-center gap-4">
              {imagePreview && (
                <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 relative">
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setForm(f => ({ ...f, imageFile: file }));
                      setImagePreview(URL.createObjectURL(file));
                    }
                  }} 
                  className="hidden" 
                  id="event-image-upload" 
                />
                <label 
                  htmlFor="event-image-upload" 
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm border-2 border-dashed border-gray-300 rounded-xl hover:border-green-400 hover:bg-green-50 cursor-pointer transition-colors text-gray-500"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Choose an image...</span>
                </label>
              </div>
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-sm font-medium text-gray-700">Map Pin (Optional)</label>
              <button 
                type="button"
                onClick={() => {
                  if (navigator.geolocation) {
                    const handleSuccess = async (pos: GeolocationPosition) => {
                      const lat = pos.coords.latitude;
                      const lng = pos.coords.longitude;
                      setForm(f => ({ ...f, latitude: lat, longitude: lng }));
                      try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
                        const data = await res.json();
                        if (data) {
                          const { address, name } = data;
                          let loc = '';
                          if (address) {
                            const parts = [];
                            if (name) parts.push(name);
                            else if (address.amenity) parts.push(address.amenity);
                            else if (address.building) parts.push(address.building);
                            else if (address.road) parts.push(address.road);
                            
                            if (address.neighbourhood) parts.push(address.neighbourhood);
                            else if (address.suburb) parts.push(address.suburb);
                            else if (address.village) parts.push(address.village);
                            
                            if (address.city || address.town || address.municipality) {
                              parts.push(address.city || address.town || address.municipality);
                            }
                            
                            loc = Array.from(new Set(parts)).filter(Boolean).join(', ');
                          }
                          setForm(f => ({ ...f, location: loc || data.display_name }));
                        }
                      } catch (e) {
                        console.error('Reverse geocoding failed', e);
                      }
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
                  onChange={async (lat, lng) => {
                    setForm(f => ({ ...f, latitude: lat, longitude: lng }));
                    try {
                      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
                      const data = await res.json();
                      if (data) {
                        const { address, name } = data;
                        let loc = '';
                        if (address) {
                          const parts = [];
                          if (name) parts.push(name);
                          else if (address.amenity) parts.push(address.amenity);
                          else if (address.building) parts.push(address.building);
                          else if (address.road) parts.push(address.road);
                          
                          if (address.neighbourhood) parts.push(address.neighbourhood);
                          else if (address.suburb) parts.push(address.suburb);
                          else if (address.village) parts.push(address.village);
                          
                          if (address.city || address.town || address.municipality) {
                            parts.push(address.city || address.town || address.municipality);
                          }
                          
                          loc = Array.from(new Set(parts)).filter(Boolean).join(', ');
                        }
                        setForm(f => ({ ...f, location: loc || data.display_name }));
                      }
                    } catch (e) {
                      console.error('Reverse geocoding failed', e);
                    }
                  }}
                />
              </MapContainer>
            </div>
            <p className="text-xs text-gray-500 mt-1">Tap on the map to pin the exact coordinates for the mobile app.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date &amp; Time *</label>
              <input type="datetime-local" value={form.startDatetime} onChange={e => setForm(f => ({ ...f, startDatetime: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date &amp; Time *</label>
              <input type="datetime-local" value={form.endDatetime} onChange={e => setForm(f => ({ ...f, endDatetime: e.target.value }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
            </div>
          </div>

          <div className="bg-[#0a0a0a] rounded-xl overflow-hidden text-white border border-gray-800 my-4">
            <div className="p-4 border-b border-gray-800">
              <h3 className="font-semibold text-sm">Automatic status</h3>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="pb-3 font-medium">Current Time</th>
                    <th className="pb-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  <tr>
                    <td className="py-3">Before {form.startDatetime ? new Date(form.startDatetime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '[Start Time]'}</td>
                    <td className="py-3">Upcoming</td>
                  </tr>
                  <tr>
                    <td className="py-3">{form.startDatetime ? new Date(form.startDatetime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '[Start Time]'} – {form.endDatetime ? new Date(form.endDatetime).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' }) : '[End Time]'}</td>
                    <td className="py-3">Ongoing</td>
                  </tr>
                  <tr>
                    <td className="py-3">After {form.endDatetime ? new Date(form.endDatetime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '[End Time]'}</td>
                    <td className="py-3">Ended</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
              <input type="number" min={1} value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: Number(e.target.value) }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Leaf className="w-3.5 h-3.5 text-green-500" /> Points Reward</label>
              <input type="number" min={0} value={form.pointsReward} onChange={e => setForm(f => ({ ...f, pointsReward: Number(e.target.value) }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 focus:border-green-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><img src="/coin.png" alt="eco coin" className="w-3.5 h-3.5 object-contain" /> Coin Reward</label>
              <input type="number" min={0} value={form.coinReward} onChange={e => setForm(f => ({ ...f, coinReward: Number(e.target.value) }))} className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-200 focus:border-yellow-400" />
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
  const [qrModal, setQrModal] = useState<{ open: boolean, eventId: string | null, qrData: string | null, loading: boolean }>({ open: false, eventId: null, qrData: null, loading: false });
  const [reportModal, setReportModal] = useState<{ open: boolean, eventId: string | null, eventTitle: string }>({ open: false, eventId: null, eventTitle: '' });
  const [activeTab, setActiveTab] = useState<'events' | 'reports'>('events');
  const [reportDataCache, setReportDataCache] = useState<Record<string, EventReportData>>({});
  const [reportLoading, setReportLoading] = useState<string | null>(null);
  const [expandedReport, setExpandedReport] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await adminGet<AdminEvent[]>('/admin/events');
      setEvents(data);
    } catch (err: any) { setError(err.message || 'Failed to load events.'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    // Auto-sync / auto-update the page by polling every 5 seconds
    const interval = setInterval(() => {
      load();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Fetch report data for all events when switching to reports tab
  useEffect(() => {
    if (activeTab === 'reports') {
      events.forEach(async (event) => {
        if (!reportDataCache[event.id]) {
          try {
            const data = await adminGet<EventReportData>(`/reports/events/${event.id}`);
            setReportDataCache(prev => ({ ...prev, [event.id]: data }));
          } catch {
            // Silently fail - will show dashes
          }
        }
      });
    }
  }, [activeTab, events]);

  const filtered = useMemo(() => {
    return events.filter(e => {
      const status = getEventStatus(e);
      return (filterStatus === 'All' || status === filterStatus) &&
        e.title.toLowerCase().includes(search.toLowerCase());
    });
  }, [events, search, filterStatus]);

  const handleAdd = async (form: FormData) => {
    let item: AdminEvent;
    if (form.imageFile) {
      const data = new window.FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value !== null && value !== undefined && key !== 'imageFile' && key !== 'imageUrl') {
          data.append(key, String(value));
        }
      });
      data.append('image', form.imageFile);
      item = await adminPostForm<AdminEvent>('/admin/events', data);
    } else {
      const { imageFile, imageUrl, ...rest } = form;
      item = await adminPost<AdminEvent>('/admin/events', rest);
    }
    setEvents(prev => [item, ...prev]);
  };

  const handleEdit = async (form: FormData) => {
    if (!editing) return;
    let updated: AdminEvent;
    if (form.imageFile) {
      const data = new window.FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value !== null && value !== undefined && key !== 'imageFile' && key !== 'imageUrl') {
          data.append(key, String(value));
        }
      });
      data.append('image', form.imageFile);
      updated = await adminPutForm<AdminEvent>(`/admin/events/${editing.id}`, data);
    } else {
      const { imageFile, imageUrl, ...rest } = form;
      updated = await adminPut<AdminEvent>(`/admin/events/${editing.id}`, rest);
    }
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

  const handleOpenQr = async (eventId: string) => {
    setQrModal({ open: true, eventId, qrData: null, loading: true });
    try {
      const data = await adminGet<{ qrData: string }>(`/admin/events/${eventId}/qr`);
      setQrModal(prev => ({ ...prev, qrData: data.qrData, loading: false }));
    } catch (err: any) {
      if (err.message && err.message.includes('No QR code generated yet')) {
        setQrModal(prev => ({ ...prev, loading: false })); // No QR yet
      } else {
        alert(err.message || 'Failed to fetch QR code.');
        setQrModal({ open: false, eventId: null, qrData: null, loading: false });
      }
    }
  };

  const handleGenerateQr = async () => {
    if (!qrModal.eventId) return;
    setQrModal(prev => ({ ...prev, loading: true }));
    try {
      const data = await adminPost<{ qrData: string }>(`/admin/events/${qrModal.eventId}/qr`, {});
      setQrModal(prev => ({ ...prev, qrData: data.qrData, loading: false }));
    } catch (err: any) {
      alert(err.message || 'Failed to generate QR code.');
      setQrModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleDownloadQr = () => {
    const canvas = document.getElementById('event-qr-canvas') as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `event-qr-${qrModal.eventId}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };

  const handleDownloadReport = async (eventId: string, format: 'pdf' | 'excel') => {
    setReportLoading(eventId);
    try {
      const token = localStorage.getItem('ecobud_admin_token') || '';
      const url = `http://localhost:3000/api/reports/events/${eventId}/${format === 'pdf' ? 'pdf' : 'excel'}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to generate report');
      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?(.+?)"?$/);
      const filename = match ? match[1] : `event-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (err: any) {
      alert(err.message || 'Failed to download report.');
    } finally {
      setReportLoading(null);
    }
  };

  const totalAttendees = events.reduce((a, e) => a + e.registrations.length, 0);

  return (
    <div className="relative p-8 space-y-6 bg-gray-50/50 min-h-full">
      {/* Backdrop overlay - blur only, covers full scroll content area */}
      {(modal || qrModal.open || reportModal.open) && (
        <div
          className="absolute inset-0 z-40 backdrop-blur-sm pointer-events-auto"
          onClick={() => { setModal(null); setEditing(null); setQrModal({ open: false, eventId: null, qrData: null, loading: false }); setReportModal({ open: false, eventId: null, eventTitle: '' }); }}
        />
      )}
      {modal === 'add' && <EventModal onClose={() => setModal(null)} onSave={handleAdd} />}
      {modal === 'edit' && editing && <EventModal onClose={() => { setModal(null); setEditing(null); }} onSave={handleEdit} initial={editing} />}
      
      {qrModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
          <div className="bg-white rounded-3xl w-full max-w-md pointer-events-auto flex flex-col shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] overflow-hidden max-h-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-serif font-bold text-gray-900">Event QR Code</h3>
                <p className="text-sm text-gray-500 mt-1">Users will scan this at the venue</p>
              </div>
              <button onClick={() => setQrModal({ open: false, eventId: null, qrData: null, loading: false })} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-8 flex flex-col items-center justify-center bg-gray-50/50">
              {qrModal.loading ? (
                <div className="flex flex-col items-center justify-center p-12">
                  <Loader2 className="w-8 h-8 text-green-600 animate-spin mb-4" />
                  <p className="text-gray-500 text-sm">Loading QR Code...</p>
                </div>
              ) : qrModal.qrData ? (
                <div className="flex flex-col items-center">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                    <QRCodeCanvas 
                      id="event-qr-canvas"
                      value={qrModal.qrData} 
                      size={240} 
                      bgColor={"#ffffff"} 
                      fgColor={"#126027"} 
                      level={"H"}
                      includeMargin={false}
                    />
                  </div>
                  <button
                    onClick={handleDownloadQr}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-50 text-blue-700 font-semibold rounded-xl hover:bg-blue-100 transition-colors mb-6"
                  >
                    <Download className="w-4 h-4" /> Download PNG
                  </button>
                </div>
              ) : (
                <div className="text-center p-8 bg-gray-100 rounded-3xl mb-6 border border-dashed border-gray-300 w-full">
                  <QrCode className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium mb-1">No QR Code generated yet</p>
                  <p className="text-sm text-gray-500">Generate one so attendees can check in.</p>
                </div>
              )}
              
              {!qrModal.loading && (
                <button
                  onClick={handleGenerateQr}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 active:scale-95 transition-all shadow-md"
                >
                  <QrCode className="w-5 h-5" />
                  {qrModal.qrData ? 'Regenerate New QR Code' : 'Generate QR Code'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report Format Modal */}
      {reportModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm pointer-events-auto flex flex-col shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-serif font-bold text-gray-900">Generate Report</h3>
                <p className="text-sm text-gray-500 mt-1 truncate max-w-[240px]">{reportModal.eventTitle}</p>
              </div>
              <button onClick={() => setReportModal({ open: false, eventId: null, eventTitle: '' })} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Report Info Fields */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Date Generated</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {new Date().toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Generated By</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {(() => {
                      try {
                        const userJson = localStorage.getItem('ecobud_admin_user');
                        const user = userJson ? JSON.parse(userJson) : null;
                        return user?.name || user?.email || 'Admin';
                      } catch { return 'Admin'; }
                    })()}
                  </span>
                </div>
              </div>

              {/* Format Selection */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Report Format</p>
                <div className="space-y-2">
                  <button
                    onClick={() => { if (reportModal.eventId) handleDownloadReport(reportModal.eventId, 'pdf'); setReportModal({ open: false, eventId: null, eventTitle: '' }); }}
                    disabled={reportLoading !== null}
                    className="w-full flex items-center gap-3 px-5 py-4 bg-red-50 text-red-700 font-semibold rounded-xl hover:bg-red-100 transition-colors text-left disabled:opacity-50"
                  >
                    {reportLoading === reportModal.eventId ? (
                      <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5 flex-shrink-0" />
                    )}
                    <div>
                      <p className="font-bold">PDF Report</p>
                      <p className="text-xs text-red-500 font-normal">Full report with summary, stats, participant list &amp; photos</p>
                    </div>
                  </button>
                  <button
                    onClick={() => { if (reportModal.eventId) handleDownloadReport(reportModal.eventId, 'excel'); setReportModal({ open: false, eventId: null, eventTitle: '' }); }}
                    disabled={reportLoading !== null}
                    className="w-full flex items-center gap-3 px-5 py-4 bg-green-50 text-green-700 font-semibold rounded-xl hover:bg-green-100 transition-colors text-left disabled:opacity-50"
                  >
                    {reportLoading === reportModal.eventId ? (
                      <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5 flex-shrink-0" />
                    )}
                    <div>
                      <p className="font-bold">Excel Report</p>
                      <p className="text-xs text-green-600 font-normal">4 worksheets: Info, Participants, Statistics, Rewards</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900">Events</h2>
          <p className="text-gray-500 text-sm mt-1">Organize and track community eco-events</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setModal('add')} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 hover:shadow-lg active:scale-95 transition-all duration-200">
            <Plus className="w-4 h-4" />Create Event
          </button>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1.5 flex gap-1.5 animate-reveal">
        <button
          onClick={() => setActiveTab('events')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            activeTab === 'events'
              ? 'bg-green-600 text-white shadow-md'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Calendar className="w-4 h-4" />
          Events
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            activeTab === 'reports'
              ? 'bg-green-600 text-white shadow-md'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FileText className="w-4 h-4" />
          Automated Reports
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ═══ EVENTS TAB ═══ */}
      {activeTab === 'events' && (
        <>
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
              <div key={event.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 overflow-hidden group flex flex-col">
                <div className="h-32 w-full relative shrink-0">
                  <img 
                    src={event.imageUrl ? (event.imageUrl.startsWith('http') ? event.imageUrl : `${API_HOST}${event.imageUrl}`) : 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?q=80&w=800&auto=format&fit=crop'} 
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 right-3">
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border bg-white/90 backdrop-blur-sm ${statusColors[status]}`}>{status}</span>
                  </div>
                </div>
                
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-xl shrink-0">
                        🌿
                      </div>
                      <div>
                        <h3 className="font-serif font-bold text-gray-900 line-clamp-1" title={event.title}>{event.title}</h3>
                        <p className="text-xs text-gray-400">By {event.managedBy.name}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <MapPin className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />{event.location}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-gray-300" />{new Date(event.startDatetime).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-gray-300" />{new Date(event.startDatetime).toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-2">{event.description}</p>
                    <div className="flex items-center gap-4 text-xs font-semibold pt-1">
                      {event.expReward > 0 && (
                        <span className="flex items-center gap-1 text-green-600">
                          <Leaf className="w-3.5 h-3.5" />
                          {event.expReward} Points
                        </span>
                      )}
                      {event.ecoCoinsReward > 0 && (
                        <span className="flex items-center gap-1 text-yellow-600">
                          <img src="/coin.png" alt="coin" className="w-3.5 h-3.5 object-contain" />
                          {event.ecoCoinsReward} Coins
                        </span>
                      )}
                    </div>
                  </div>

                {/* Capacity bar */}
                <div className="mb-4 mt-auto">
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
                  <button onClick={() => handleOpenQr(event.id)} className="flex items-center justify-center px-3 py-2 bg-purple-50 text-purple-700 text-xs font-semibold rounded-xl hover:bg-purple-100 transition-colors">
                    <QrCode className="w-3 h-3" />
                  </button>
                  <button onClick={() => setReportModal({ open: true, eventId: event.id, eventTitle: event.title })} className="flex items-center justify-center px-3 py-2 bg-orange-50 text-orange-700 text-xs font-semibold rounded-xl hover:bg-orange-100 transition-colors">
                    <Download className="w-3 h-3" />
                  </button>
                  <button onClick={() => { setEditing(event); setModal('edit'); }} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 text-xs font-semibold rounded-xl hover:bg-blue-100 transition-colors">
                    <Edit3 className="w-3 h-3" />Edit
                  </button>
                  <button onClick={() => handleDelete(event.id)} disabled={deleting === event.id} className="flex items-center justify-center px-3 py-2 bg-red-50 text-red-600 text-xs font-semibold rounded-xl hover:bg-red-100 transition-colors disabled:opacity-60">
                    {deleting === event.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </button>
                </div>
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
        </>
      )}

      {/* ═══ AUTOMATED REPORTS TAB ═══ */}
      {activeTab === 'reports' && (
        <div className="space-y-5 animate-reveal">
          {/* Reports Stats */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Total Events', value: events.length, color: 'text-gray-900' },
              { label: 'With Reports', value: Object.keys(reportDataCache).length, color: 'text-green-600' },
              { label: 'Total Participants', value: Object.values(reportDataCache).reduce((a, d) => a + d.stats.totalRegistered, 0), color: 'text-blue-600' },
              { label: 'Total Rewards Given', value: Object.values(reportDataCache).reduce((a, d) => a + d.stats.totalCoinsAwarded + d.stats.totalExpAwarded, 0), color: 'text-purple-600' },
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

          {/* Reports Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-reveal delay-160">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-serif font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-600" />
                Automated Event Reports
              </h3>
              <p className="text-sm text-gray-500 mt-1">Download PDF and Excel reports for each event</p>
            </div>

            {loading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 text-green-600 animate-spin mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Loading events...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400">No events to generate reports for.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Event</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Registered</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Attended</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">QR Verified</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Approved</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rejected</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Coins</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">EXP</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {events.map((event) => {
                      const reportData = reportDataCache[event.id];
                      const stats = reportData?.stats;
                      const isExpanded = expandedReport === event.id;
                      return (
                        <React.Fragment key={event.id}>
                        <tr className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-lg">
                                🌿
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 text-sm">{event.title}</p>
                                <p className="text-xs text-gray-400">{new Date(event.startDatetime).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</p>
                              </div>
                            </div>
                          </td>
                          <td className="text-center px-4 py-4">
                            <span className="text-sm font-semibold text-gray-900">{stats ? stats.totalRegistered : '—'}</span>
                          </td>
                          <td className="text-center px-4 py-4">
                            <span className="text-sm font-semibold text-green-600">{stats ? stats.attended : '—'}</span>
                          </td>
                          <td className="text-center px-4 py-4">
                            <span className="text-sm font-semibold text-blue-600">{stats ? stats.qrVerified : '—'}</span>
                          </td>
                          <td className="text-center px-4 py-4">
                            <span className="text-sm font-semibold text-emerald-600">{stats ? stats.approved : '—'}</span>
                          </td>
                          <td className="text-center px-4 py-4">
                            <span className="text-sm font-semibold text-red-500">{stats ? stats.rejected : '—'}</span>
                          </td>
                          <td className="text-center px-4 py-4">
                            <span className="text-sm font-semibold text-yellow-600">{stats ? stats.totalCoinsAwarded : '—'}</span>
                          </td>
                          <td className="text-center px-4 py-4">
                            <span className="text-sm font-semibold text-purple-600">{stats ? stats.totalExpAwarded : '—'}</span>
                          </td>
                          <td className="text-center px-4 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setReportModal({ open: true, eventId: event.id, eventTitle: event.title })}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 active:scale-95 transition-all"
                              >
                                <Download className="w-3 h-3" />
                                Generate
                              </button>
                              <button
                                onClick={() => setExpandedReport(isExpanded ? null : event.id)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                title="View details"
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Details Row */}
                        {isExpanded && reportData && (
                          <tr>
                            <td colSpan={9} className="px-6 py-0 bg-gray-50/80">
                              <div className="py-5 space-y-6">
                                {/* Event Info Summary */}
                                <div className="bg-white rounded-xl border border-gray-100 p-4">
                                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-green-600" />
                                    Event Information
                                  </h4>
                                  <div className="grid grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <p className="text-gray-500">Location</p>
                                      <p className="font-semibold text-gray-900">{event.location}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Organizer</p>
                                      <p className="font-semibold text-gray-900">{event.managedBy.name}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Capacity</p>
                                      <p className="font-semibold text-gray-900">{event.capacity}</p>
                                    </div>
                                    <div>
                                      <p className="text-gray-500">Rewards</p>
                                      <p className="font-semibold text-gray-900">{event.ecoCoinsReward} coins / {event.expReward} EXP</p>
                                    </div>
                                  </div>
                                </div>

                                {/* Approved Submission Photos */}
                                <div className="bg-white rounded-xl border border-gray-100 p-4">
                                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4 text-green-600" />
                                    Approved Attendance Photos
                                    {reportData.photos.length > 0 && (
                                      <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                                        {reportData.photos.length}
                                      </span>
                                    )}
                                  </h4>
                                  {reportData.photos.length === 0 ? (
                                    <p className="text-sm text-gray-400 py-4 text-center">No approved photos yet.</p>
                                  ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                      {reportData.photos.map((photoUrl, idx) => (
                                        <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-100">
                                          <img
                                            src={`${API_HOST}${photoUrl}`}
                                            alt={`Attendance ${idx + 1}`}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                              (e.target as HTMLImageElement).style.display = 'none';
                                              const parent = (e.target as HTMLImageElement).parentElement;
                                              if (parent) {
                                                const placeholder = document.createElement('div');
                                                placeholder.className = 'absolute inset-0 flex items-center justify-center text-gray-400 text-xs';
                                                placeholder.textContent = 'Photo unavailable';
                                                parent.appendChild(placeholder);
                                              }
                                            }}
                                          />
                                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Participant Submissions */}
                                <div className="bg-white rounded-xl border border-gray-100 p-4">
                                  <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-green-600" />
                                    Participant Submissions
                                  </h4>
                                  {reportData.participants.length === 0 ? (
                                    <p className="text-sm text-gray-400 py-4 text-center">No participants yet.</p>
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-sm">
                                        <thead>
                                          <tr className="border-b border-gray-100">
                                            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Name</th>
                                            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Status</th>
                                            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">QR</th>
                                            <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Reward</th>
                                            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Coins</th>
                                            <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">EXP</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                          {reportData.participants.map((p, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50/50">
                                              <td className="py-2 px-3">
                                                <div>
                                                  <p className="font-medium text-gray-900">{p.name}</p>
                                                  <p className="text-xs text-gray-400">{p.email}</p>
                                                </div>
                                              </td>
                                              <td className="py-2 px-3">
                                                <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                                                  p.attendanceStatus === 'Attended' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                  {p.attendanceStatus}
                                                </span>
                                              </td>
                                              <td className="py-2 px-3">
                                                <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                                                  p.qrVerification === 'Verified' ? 'bg-blue-100 text-blue-700' :
                                                  p.qrVerification === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                  'bg-gray-100 text-gray-600'
                                                }`}>
                                                  {p.qrVerification}
                                                </span>
                                              </td>
                                              <td className="py-2 px-3">
                                                <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${
                                                  p.rewardStatus === 'Awarded' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                  {p.rewardStatus}
                                                </span>
                                              </td>
                                              <td className="py-2 px-3 text-right font-semibold text-yellow-600">{p.coinsAwarded}</td>
                                              <td className="py-2 px-3 text-right font-semibold text-purple-600">{p.expAwarded}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
