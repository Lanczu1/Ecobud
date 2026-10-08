import { useLocalDrafts, useDraftAutosave } from '../../../hooks/useLocalDrafts';
import { LocalDraftPanel } from '../LocalDraftPanel';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Megaphone, Plus, Edit3, Trash2, Users, Clock, Search,
  AlertCircle, X, Loader2, ImagePlus, Eye,
  Copy, Send, Calendar, AlertTriangle, CheckCircle2,
  CalendarClock, FileText, Wifi, ArrowLeft, ArrowRight,
  ExternalLink, ChevronLeft, ChevronRight, Tag
} from 'lucide-react';
import { adminGet, adminPost, adminPut, adminDelete, adminPostForm, API_HOST } from '../../../utils/adminApi';
import { useAdminLiveRefresh } from '../../../hooks/useAdminLiveRefresh';
import { notificationTarget } from '../../../services/adminNotifications';
import { AdminPagination } from '../AdminPagination';
import { useModalScrollLock } from '../../../hooks/useModalScrollLock';
import './Announcements.css';
import { AnnouncementEditor } from './AnnouncementEditor';

const categories = [
  'General',
  'Waste Management',
  'Eco Challenge',
  'Eco Event',
  'Rewards',
  'Learning',
  'Important Notice',
  'Community',
];

const statuses = ['Draft', 'Scheduled', 'Published', 'Archived'];
const actions = [
  'No Action',
  'View Eco Challenge',
  'View Eco Event',
  'View Learning Module',
  'View Rewards',
  'Open External Link',
];

export interface Announcement {
  id?: string;
  title: string;
  content: string;
  category: string;
  image: string | null;
  images?: string[];
  canManage?: boolean;
  status: string;
  priority: string;
  targetAudience: string;
  barangays: string[];
  publishAt: string | null;
  expiresAt: string | null;
  ctaLabel: string | null;
  ctaType: string;
  ctaValue: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: { name: string; role?: string };
}

const blank = (): Announcement => ({
  title: '',
  content: '',
  category: 'General',
  image: null,
  images: [],
  status: 'Draft',
  priority: 'Normal',
  targetAudience: 'All Residents',
  barangays: [],
  publishAt: null,
  expiresAt: null,
  ctaLabel: null,
  ctaType: 'No Action',
  ctaValue: null,
});

const date = (v?: string | null) =>
  v ? new Date(v).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : 'Not set';

const localDate = (v: string | null) =>
  v ? new Date(Date.parse(v) + 8 * 3600000).toISOString().slice(0, 16) : '';

const iso = (v: string) => (v ? new Date(`${v}:00+08:00`).toISOString() : null);

const audience = (a: Announcement) =>
  a.targetAudience === 'All Residents'
    ? a.targetAudience
    : (a.barangays && a.barangays.length > 0 ? a.barangays.join(', ') : 'No barangays selected');

function resolveImageUrl(imageUrl?: string | null) {
  if (!imageUrl) return null;
  if (/^(https?:\/\/|data:)/i.test(imageUrl)) return imageUrl;
  return `${API_HOST.replace(/\/$/, '')}/${imageUrl.replace(/^\//, '')}`;
}

function announcementImages(item?: Announcement | null): string[] {
  if (!item) return [];
  return item.images ?? (item.image ? [item.image] : []);
}

const statusColors: Record<string, string> = {
  Published: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/60 dark:text-green-300 dark:border-green-800',
  Scheduled: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  Draft: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  Archived: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
};

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 dark:bg-gray-800 rounded ${className}`} />;
}

function safeLink(value: string) {
  return /^https?:\/\//i.test(value) ? value : undefined;
}

function InlineText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
        if (/^\*\*\*[^*]+\*\*\*$/.test(part)) return <strong key={i}><em>{part.slice(3, -3)}</em></strong>;
        if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i} className="font-semibold text-gray-900 dark:text-white">{part.slice(2, -2)}</strong>;
        if (/^\*[^*]+\*$/.test(part)) return <em key={i} className="italic">{part.slice(1, -1)}</em>;
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link && safeLink(link[2])) {
          return (
            <a key={i} href={link[2]} target="_blank" rel="noreferrer" className="text-green-600 dark:text-green-400 underline hover:text-green-700">
              {link[1]}
            </a>
          );
        }
        return part;
      })}
    </>
  );
}

function Content({ text }: { text: string }) {
  const lines = text.split('\n');
  const nodes: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const bullet = /^[-*] /.test(lines[i]);
    const numbered = /^\d+\. /.test(lines[i]);
    if (bullet || numbered) {
      const entries: ReactNode[] = [];
      const start = i;
      while (i < lines.length && (bullet ? /^[-*] /.test(lines[i]) : /^\d+\. /.test(lines[i]))) {
        entries.push(
          <li key={i} className="text-sm text-gray-700 dark:text-gray-300 my-1">
            <InlineText text={lines[i].replace(bullet ? /^[-*] / : /^\d+\. /, '')} />
          </li>
        );
        i++;
      }
      i--;
      nodes.push(
        bullet ? (
          <ul key={start} className="list-disc pl-5 my-2 space-y-1">
            {entries}
          </ul>
        ) : (
          <ol key={start} className="list-decimal pl-5 my-2 space-y-1">
            {entries}
          </ol>
        )
      );
    } else {
      nodes.push(
        <p key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-2">
          <InlineText text={lines[i] || '\u00a0'} />
        </p>
      );
    }
  }
  return <div className="announcement-content">{nodes}</div>;
}

function Preview({ item, mobile }: { item: Announcement | null; mobile: boolean }) {
  const [activeImg, setActiveImg] = useState(0);
  const images = announcementImages(item);

  useEffect(() => {
    if (activeImg >= images.length) {
      setActiveImg(Math.max(0, images.length - 1));
    }
  }, [images.length, activeImg]);

  if (!item) return null;

  const dateStr = item.publishAt
    ? new Date(item.publishAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })
    : new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });

  const renderAnnouncementBody = (isPhone: boolean) => (
    <div className="space-y-4">
      {/* Category, Priority & Date Row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60">
            <Tag size={12} className="text-emerald-600 dark:text-emerald-400" />
            {item.category || 'General'}
          </span>
          {item.priority === 'Important' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
              <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400" />
              Important
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-medium flex items-center gap-1">
          <Calendar size={12} />
          {dateStr}
        </span>
      </div>

      {/* Title */}
      <h3 className={`${isPhone ? 'text-lg' : 'text-2xl'} font-bold text-gray-900 dark:text-white leading-tight tracking-tight wrap-break-word font-sans`}>
        {item.title || 'Announcement title'}
      </h3>

      {/* Image Gallery */}
      {images.length > 0 && (
        <div className="space-y-2">
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80 shadow-xs group">
            <img
              src={resolveImageUrl(images[activeImg]) || images[activeImg]}
              alt={`Announcement picture ${activeImg + 1}`}
              className="w-full h-full object-cover transition-all"
            />
            {images.length > 1 && (
              <>
                <div className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-black/60 backdrop-blur-xs text-white">
                  {activeImg + 1} / {images.length}
                </div>
                <button
                  type="button"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveImg(prev => (prev > 0 ? prev - 1 : images.length - 1));
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 hover:bg-black/75 text-white backdrop-blur-xs transition-all opacity-80 hover:opacity-100 cursor-pointer"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveImg(prev => (prev < images.length - 1 ? prev + 1 : 0));
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 hover:bg-black/75 text-white backdrop-blur-xs transition-all opacity-80 hover:opacity-100 cursor-pointer"
                  aria-label="Next image"
                >
                  <ChevronRight size={16} />
                </button>
              </>
            )}
          </div>

          {/* Thumbnails if > 1 image */}
          {images.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {images.map((url, idx) => (
                <button
                  key={url + idx}
                  type="button"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveImg(idx);
                  }}
                  className={`relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                    activeImg === idx
                      ? 'border-emerald-600 scale-105 shadow-xs'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={resolveImageUrl(url) || url}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="pt-1">
        <Content text={item.content || 'Your announcement content will appear here.'} />
      </div>

      {/* CTA Button */}
      {item.ctaType !== 'No Action' && (
        <div className={isPhone ? 'pt-2' : 'pt-4'}>
          <span
            className={`${
              isPhone ? 'w-full' : 'inline-flex'
            } py-3 px-5 bg-linear-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 select-none cursor-pointer`}
          >
            <span>{item.ctaLabel || 'Action button'}</span>
            {item.ctaType === 'Open External Link' ? (
              <ExternalLink size={16} />
            ) : (
              <ArrowRight size={16} />
            )}
          </span>
        </div>
      )}
    </div>
  );

  if (mobile) {
    return (
      <div className="phone-preview-shell font-sans text-gray-900 dark:text-white transition-all">
        {/* Phone Top Status Bar */}
        <div className="pt-2 px-5 pb-1 flex items-center justify-between text-[11px] font-semibold text-gray-800 dark:text-gray-200 bg-white dark:bg-[#0b110e] select-none">
          <span>9:41</span>
          <div className="w-20 h-4 bg-gray-900 dark:bg-black rounded-full flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-gray-800 dark:bg-gray-900 mr-2" />
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
          </div>
          <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
            <Wifi size={12} />
            <div className="w-4 h-2.5 border border-current rounded-xs p-0.5 flex items-center">
              <div className="w-full h-full bg-current rounded-2xs" />
            </div>
          </div>
        </div>

        {/* Mobile Header Bar */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800/80 bg-white/95 dark:bg-[#0b110e]/95 backdrop-blur-xs select-none">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-full text-gray-600 dark:text-gray-300">
              <ArrowLeft size={18} />
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-white">Announcement</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/40">
            <Megaphone size={12} />
            <span>EcoBud</span>
          </div>
        </div>

        {/* Mobile Content Area */}
        <div className="p-4 overflow-y-auto max-h-120 phone-scrollbar bg-[#F7F9F7] dark:bg-[#0B110E]">
          {renderAnnouncementBody(true)}
        </div>

        {/* Phone Bottom Home Indicator */}
        <div className="py-2.5 bg-white dark:bg-[#0b110e] flex justify-center select-none border-t border-gray-50 dark:border-gray-900">
          <div className="w-28 h-1 bg-gray-300 dark:bg-gray-700 rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <article className="announcement-preview w-full max-w-2xl mx-auto bg-white dark:bg-[#0f1713] rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs font-sans text-gray-900 dark:text-white">
      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-bold mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
        <Megaphone size={18} />
        <span>ECOBUD Community Announcement</span>
      </div>
      {renderAnnouncementBody(false)}
    </article>
  );
}

interface AnnouncementDraft { form: Announcement; imageFiles: File[]; }

export function Announcements() {
  const drafts = useLocalDrafts<AnnouncementDraft>('announcements');
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = pendingImages.map(file => URL.createObjectURL(file));
    setPendingPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [pendingImages]);
  const isModerator = (() => {
    try { return JSON.parse(localStorage.getItem('ecobud_admin_user') || '{}').role === 'moderator'; }
    catch { return false; }
  })();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [period, setPeriod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  // Modals state
  const [editor, setEditor] = useState<Announcement | null>(null);
  useDraftAutosave(drafts, { form: editor ?? blank(), imageFiles: pendingImages }, !!editor && !editor.id);
  const [details, setDetails] = useState<Announcement | null>(null);
  useEffect(() => {
    const target=notificationTarget('announcement'); if (!target) return;
    let cancelled=false;
    void adminGet<Announcement>(`/admin/announcements/${encodeURIComponent(target)}`,{ bypassCache:true }).then(item=>{ if (!cancelled) setDetails(item); }).catch(e=>{ if (!cancelled) setError(e.message); });
    return () => { cancelled=true; };
  },[]);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ open: boolean; item: Announcement | null }>({
    open: false,
    item: null,
  });

  const [busy, setBusy] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [barangays, setBarangays] = useState<string[]>([]);
  const [assignedBarangay, setAssignedBarangay] = useState<string | null>(null);
  const [filterBarangay, setFilterBarangay] = useState('');
  const [barangayError, setBarangayError] = useState('');
  const [mobilePreview, setMobilePreview] = useState(true);

  const [isClosing, setIsClosing] = useState(false);

  const isModalOpen = !!(editor || details || deleteConfirmModal.open);
  useModalScrollLock(isModalOpen);

  const loadInFlight = useRef<Promise<void> | null>(null);
  async function load(fresh = true, background = false) {
    if (loadInFlight.current) {
      await loadInFlight.current;
      if (!background) return load(fresh, background);
      return;
    }
    const task = (async () => {
      if (!background) setLoading(true);
      if (!background) setError('');
      try {
        const data = await adminGet<{ items: Announcement[] }>('/admin/announcements', { bypassCache: fresh });
        setItems(current => JSON.stringify(current) === JSON.stringify(data.items) ? current : data.items);
      } catch (e: any) {
        if (!background) setError(e.message || 'Unable to load announcements. Please try again.');
      } finally {
        if (!background) setLoading(false);
      }
    })();
    loadInFlight.current = task;
    try { await task; } finally { if (loadInFlight.current === task) loadInFlight.current = null; }
  }

  useEffect(() => {
    void load();
    void adminGet<{ items: string[]; assignedBarangay: string | null }>('/admin/announcements/barangays')
      .then(v => { setBarangays(v.items); setAssignedBarangay(v.assignedBarangay); })
      .catch(() => setBarangayError('Unable to load barangays. Reopen this page to retry.'));

    const refresh = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void load(true, true);
    };
    const timer = window.setInterval(refresh, 10_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, []);
  useAdminLiveRefresh(() => { if (navigator.onLine) void load(true, true); });

  // Auto-dismiss notice after 4 seconds
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  function handleCloseModal(callback: () => void) {
    setIsClosing(true);
    setTimeout(() => {
      callback();
      setIsClosing(false);
      setSaveError('');
    }, 280);
  }

  function edit(item: Announcement, restoring = false) {
    if (isModerator && item.id && !item.canManage) return;
    if (isModerator && !assignedBarangay) return;
    if (!item.id && !restoring && !drafts.start()) return;
    if (!restoring) setPendingImages([]);
    setSaveError('');
    setDetails(null);
    setEditor({ ...item, images: announcementImages(item), ...(isModerator ? { targetAudience: 'Specific Barangay', barangays: [assignedBarangay!] } : {}) });
  }

  function duplicate(item: Announcement) {
    if (isModerator && !item.canManage) return;
    edit({
      ...item,
      id: undefined,
      title: `${item.title} (copy)`.slice(0, 120),
      status: 'Draft',
      publishAt: null,
      expiresAt: null,
    });
  }

  const filtered = useMemo(() => {
    const now = new Date();
    const today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);
    const dayStart = Date.parse(`${today}T00:00:00+08:00`);
    const weekday = new Date(dayStart + 8 * 3600000).getUTCDay();
    const start =
      period === 'Today'
        ? dayStart
        : period === 'This Week'
        ? dayStart - ((weekday + 6) % 7) * 86400000
        : period === 'This Month'
        ? Date.parse(`${today.slice(0, 7)}-01T00:00:00+08:00`)
        : period === 'Custom Date Range' && from
        ? Date.parse(`${from}T00:00:00+08:00`)
        : 0;
    const end =
      period === 'Custom Date Range' && to
        ? Date.parse(`${to}T23:59:59.999+08:00`)
        : period
        ? now.getTime()
        : Infinity;

    return items.filter(a => {
      if (a.createdBy?.role !== (isModerator ? 'moderator' : 'admin')) return false;
      if (isModerator && (!assignedBarangay || a.targetAudience === 'All Residents' || !a.barangays.includes(assignedBarangay))) return false;
      const matchQuery =
        !query ||
        `${a.title} ${a.content}`.toLowerCase().includes(query.toLowerCase());
      const matchCategory = !category || category === a.category;
      const matchStatus = !status || status === a.status;
      const matchPeriod =
        !period ||
        (!!a.createdAt &&
          Date.parse(a.createdAt) >= start &&
          Date.parse(a.createdAt) <= end);
      const matchBarangay = !filterBarangay || a.targetAudience === 'All Residents' || a.barangays.includes(filterBarangay);
      return matchQuery && matchCategory && matchStatus && matchPeriod && matchBarangay;
    });
  }, [items, query, category, status, period, from, to, filterBarangay, isModerator, assignedBarangay]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function change(field: keyof Announcement, value: unknown) {
    setEditor(prev => (prev ? { ...prev, [field]: value } : prev));
  }

  async function persist(item: Announcement) {
    setBusy(true);
    setSaveError('');
    try {
      if (item.id) {
        await adminPut(`/admin/announcements/${item.id}`, item);
      } else {
        const images = [...announcementImages(item)];
        for (const file of pendingImages) {
          const data = new FormData();
          data.append('image', file);
          const result = await adminPostForm<{ url: string }>('/admin/announcements/upload', data);
          images.push(result.url);
        }
        await adminPost('/admin/announcements', { ...item, images, image: images[0] ?? null });
        await drafts.complete();
      }
      setNotice({ type: 'success', message: 'Announcement saved successfully.' });
      handleCloseModal(() => setEditor(null));
      await load(true);
    } catch (e: any) {
      setSaveError(e.message || 'Unable to save this announcement. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function upload(files: File[]) {
    if (!files.length || !editor || uploadingImage || busy) return;
    if (announcementImages(editor).length + pendingImages.length + files.length > 10) {
      setSaveError('You can attach up to 10 pictures per announcement.');
      return;
    }
    if (files.some(file => !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setSaveError('Choose JPEG, PNG, or WebP pictures, up to 5 MB each.');
      return;
    }
    if (!editor.id) {
      setPendingImages(current => [...current, ...files]);
      setSaveError('');
      return;
    }
    setUploadingImage(true);
    setSaveError('');
    try {
      for (const file of files) {
        const form = new FormData();
        form.append('image', file);
        const res = await adminPostForm<{ url: string }>('/admin/announcements/upload', form);
        setEditor(prev => {
          if (!prev) return prev;
          const images = [...announcementImages(prev), res.url];
          return { ...prev, images, image: images[0] ?? null };
        });
      }
    } catch {
      setSaveError('An image could not be uploaded. Completed uploads are retained; please retry the remaining pictures.');
    } finally {
      setUploadingImage(false);
    }
  }

  function removeImage(index: number) {
    setEditor(prev => {
      if (!prev) return prev;
      const images = announcementImages(prev).filter((_, i) => i !== index);
      return { ...prev, images, image: images[0] ?? null };
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (editor && !uploadingImage) {
      if (!editor.content.trim() || editor.content.length > 20000) {
        setSaveError('Content is required and must be 20,000 characters or fewer.');
        return;
      }
      void persist(editor);
    }
  }

  async function confirmDelete() {
    if (!deleteConfirmModal.item) return;
    const itemToDelete = deleteConfirmModal.item;
    setDeleting(itemToDelete);
    try {
      await adminDelete(`/admin/announcements/${itemToDelete.id}?confirmPublished=true`);
      setNotice({ type: 'success', message: 'Announcement deleted successfully.' });
      setDeleteConfirmModal({ open: false, item: null });
      await load(true);
    } catch {
      setNotice({ type: 'error', message: 'Unable to delete this announcement. Please try again.' });
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="relative p-8 space-y-6 bg-gray-50/50 min-h-full">
      <LocalDraftPanel controller={drafts} disabled={!!editor || (isModerator && !assignedBarangay)} onResume={record => {
        if (drafts.start(record)) {
          setPendingImages(record.data.imageFiles);
          edit(record.data.form, true);
        }
      }} />
      {/* Toast Notice */}
      {notice && (
        <div
          className={`fixed right-6 top-6 z-9999 flex max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl ${
            notice.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200'
              : 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
          }`}
          role="status"
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          <p className="flex-1 text-sm font-semibold">{notice.message}</p>
          <button
            onClick={() => setNotice(null)}
            className="rounded-md p-0.5 opacity-60 transition-opacity hover:opacity-100"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header */}
      {isModerator && <p className="text-sm text-gray-600 dark:text-gray-300" role="status">
        {assignedBarangay ? `Your barangay: ${assignedBarangay}. Only moderator announcements for this barangay are shown. You can manage your own posts; other moderators' posts are view only.` : barangayError || 'An assigned barangay is required before you can create an announcement.'}
      </p>}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900 dark:text-white">Announcements</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Create, publish, and manage community announcements</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => edit(blank())}
            disabled={isModerator && !assignedBarangay}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 hover:shadow-lg active:scale-95 transition-all duration-200 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Announcement</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 rounded-2xl p-4 flex items-center gap-3 animate-reveal">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Announcements', value: loading ? '—' : items.length, color: 'text-gray-900 dark:text-white', icon: Megaphone },
          { label: 'Published', value: loading ? '—' : items.filter(a => a.status === 'Published').length, color: 'text-green-600 dark:text-green-400', icon: Send },
          { label: 'Drafts', value: loading ? '—' : items.filter(a => a.status === 'Draft').length, color: 'text-gray-500 dark:text-gray-400', icon: FileText },
          { label: 'Scheduled', value: loading ? '—' : items.filter(a => a.status === 'Scheduled').length, color: 'text-amber-600 dark:text-amber-400', icon: CalendarClock },
        ].map((s, idx) => {
          const delayClass = idx === 0 ? '' : idx === 1 ? 'delay-60' : idx === 2 ? 'delay-160' : 'delay-280';
          return (
            <div
              key={s.label}
              className={`bg-white dark:bg-[#0f1713] rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm animate-reveal ${delayClass} hover:-translate-y-1 hover:shadow-md transition-all duration-300`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{s.label}</p>
                <s.icon className={`w-5 h-5 ${s.color} opacity-80`} />
              </div>
              <p className={`text-3xl font-serif font-bold mt-2 ${s.color}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white dark:bg-[#0f1713] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex flex-wrap gap-3 items-center animate-reveal delay-160">
        <div className="relative flex-1 min-w-50">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search announcements..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 focus:border-green-400 transition-all"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {['All', 'Published', 'Scheduled', 'Draft', 'Archived'].map(f => {
            const isActive = (f === 'All' && !status) || status === f;
            return (
              <button
                key={f}
                onClick={() => {
                  setStatus(f === 'All' ? '' : f);
                  setPage(1);
                }}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-green-600 text-white border-green-600 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-green-300'
                }`}
              >
                {f}
              </button>
            );
          })}
        </div>

        {/* Category & Period Dropdowns */}
        <div className="flex items-center gap-2">
          <select
            value={category}
            onChange={e => {
              setCategory(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 transition-all cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={period}
            onChange={e => {
              setPeriod(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 text-xs font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 transition-all cursor-pointer"
          >
            <option value="">All Dates</option>
            {['Today', 'This Week', 'This Month', 'Custom Date Range'].map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select aria-label="Filter by barangay" value={isModerator ? assignedBarangay ?? '' : filterBarangay} disabled={isModerator} onChange={e => { setFilterBarangay(e.target.value); setPage(1); }} className="px-3 py-2 text-xs font-medium border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed">
            <option value="">{isModerator ? 'No assigned barangay' : 'All 52 Barangays'}</option>
            {barangays.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      {/* Custom Date Range Row */}
      {period === 'Custom Date Range' && (
        <div className="bg-white dark:bg-[#0f1713] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex flex-wrap gap-4 items-center animate-reveal delay-60">
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 font-medium">
            From:
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={e => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 font-medium">
            To:
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={e => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200"
            />
          </label>
        </div>
      )}

      {/* Announcements Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-reveal delay-280">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-[#0f1713] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))
          : pagedItems.map(item => (
              <div
                key={item.id}
                className={`bg-white dark:bg-[#0f1713] rounded-2xl border ${
                  item.priority === 'Important'
                    ? 'border-amber-300 dark:border-amber-700 shadow-amber-500/5 ring-1 ring-amber-300/60'
                    : 'border-gray-100 dark:border-gray-800'
                } shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 overflow-hidden group flex flex-col`}
              >
                {/* Image Banner */}
                <div className="h-36 w-full relative shrink-0 overflow-hidden bg-emerald-950/20">
                  {item.image ? (
                    <img
                      src={resolveImageUrl(item.image) || item.image}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-linear-to-br from-green-700/20 via-emerald-800/10 to-teal-900/30 flex items-center justify-center">
                      <Megaphone className="w-12 h-12 text-green-600/30 dark:text-green-400/20" />
                    </div>
                  )}

                  {/* Priority Badge */}
                  {item.priority === 'Important' && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-amber-400 text-amber-950 shadow-md">
                      <AlertTriangle className="w-3.5 h-3.5 fill-current text-amber-950" />
                      <span>Important</span>
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <span
                      className={`px-2.5 py-1 text-xs font-semibold rounded-full border bg-white/90 dark:bg-[#0f1713]/90 backdrop-blur-sm shadow-xs ${
                        statusColors[item.status] || 'bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                        <div className="w-10 h-10 bg-green-50 dark:bg-green-950/40 border border-green-100 dark:border-green-900/50 rounded-xl flex items-center justify-center text-green-700 dark:text-green-400 shrink-0">
                          <Megaphone className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3
                            className="font-serif font-bold text-gray-900 dark:text-white line-clamp-1 text-base cursor-pointer hover:text-green-600 dark:hover:text-green-400 transition-colors"
                            onClick={() => setDetails(item)}
                            title={item.title}
                          >
                            {item.title}
                          </h3>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            By {item.createdBy?.name || 'Admin'} •{' '}
                            <span className="text-green-700 dark:text-green-400 font-medium">
                              {item.category}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <Users className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
                        <span className="truncate">{audience(item)}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
                          {item.status === 'Scheduled' ? `Sched: ${date(item.publishAt)}` : `Pub: ${date(item.publishAt)}`}
                        </span>
                        {item.expiresAt && (
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 shrink-0" />
                            Exp: {date(item.expiresAt)}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-2 leading-relaxed">
                        <Content text={item.content} />
                      </div>
                      {item.ctaType !== 'No Action' && (
                        <div className="pt-1">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 rounded-lg text-xs font-semibold">
                            <Send className="w-3 h-3" />
                            {item.ctaLabel || 'Action'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Hover Action Buttons */}
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pt-2 border-t border-gray-100 dark:border-gray-800/80">
                    {(!isModerator || item.canManage) && <button
                      onClick={() => setDetails(item)}
                      className="flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      title="View details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View</span>
                    </button>}
                    <button
                      onClick={() => isModerator && !item.canManage ? setDetails(item) : edit(item)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      {isModerator && !item.canManage ? <Eye className="w-3.5 h-3.5" /> : <Edit3 className="w-3.5 h-3.5" />}
                      <span>{isModerator && !item.canManage ? 'View' : 'Edit'}</span>
                    </button>
                    {(!isModerator || item.canManage) && <>
                    <button
                      onClick={() => duplicate(item)}
                      disabled={isModerator && !item.canManage}
                      className="flex items-center justify-center gap-1 px-3 py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      title="Duplicate Announcement"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmModal({ open: true, item })}
                      disabled={isModerator && !item.canManage}
                      className="flex items-center justify-center px-3 py-2 bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      title="Delete Announcement"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    </>}
                  </div>
                </div>
              </div>
            ))}
      </div>

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="bg-white dark:bg-[#0f1713] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-12 text-center animate-reveal">
          <Megaphone className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 dark:text-gray-500 font-medium">
            {items.length === 0 ? 'No announcements yet. Create your first one!' : 'No announcements match your search.'}
          </p>
          {items.length === 0 && (
            <button
              onClick={() => edit(blank())}
              disabled={isModerator && !assignedBarangay}
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 active:scale-95 transition-all shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Announcement</span>
            </button>
          )}
        </div>
      )}

      {/* Pagination */}
      <AdminPagination
        page={currentPage}
        totalPages={totalPages}
        total={filtered.length}
        onPageChange={setPage}
      />

      {/* Create / Edit Announcement Modal */}
      {editor &&
        createPortal(
          <div
            className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
            onClick={() => !busy && !uploadingImage && handleCloseModal(() => setEditor(null))}
          >
            <div
              className={`relative z-10 bg-white dark:bg-[#0f1713] text-gray-900 dark:text-white rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 w-full max-w-2xl flex flex-col overflow-hidden ${
                isClosing ? 'animate-modal-exit' : 'animate-modal'
              }`}
              style={{ maxHeight: 'calc(100vh - 80px)' }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
                <h2 className="text-lg font-serif font-bold text-gray-900 dark:text-white">
                  {editor.id ? 'Edit Announcement' : 'Create Announcement'}
                </h2>
                <button
                  type="button"
                  onClick={() => !busy && !uploadingImage && handleCloseModal(() => setEditor(null))}
                  disabled={busy || uploadingImage}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form id="announcement-form" onSubmit={submit} className="flex-1 overflow-y-auto p-6 space-y-4">
                {saveError && (
                  <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 rounded-xl px-4 py-3">
                    {saveError}
                  </p>
                )}

                {/* Title */}
                <fieldset className="space-y-4 min-w-0">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title *
                  </label>
                  <input
                    required
                    maxLength={120}
                    value={editor.title}
                    onChange={e => change('title', e.target.value)}
                    placeholder="Example: New Eco Challenge Available!"
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 focus:border-green-400 transition-colors"
                  />
                  <div className="flex justify-end mt-1">
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {editor.title.length}/120
                    </span>
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category *
                  </label>
                  <select
                    value={editor.category}
                    onChange={e => change('category', e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 focus:border-green-400 transition-colors cursor-pointer"
                  >
                    {categories.map(v => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Content with Markdown Toolbar */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Content *
                  </label>
                  <AnnouncementEditor initialContent={<Content text={editor.content} />} onChange={text => change('content', text)} />
                </div>

                {/* Cover Image Upload */}
                </fieldset>
                <div
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    if (!busy && !uploadingImage) void upload(Array.from(e.dataTransfer.files));
                  }}
                  className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-4 transition-colors hover:border-green-400 dark:hover:border-green-500"
                >
                  <p className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Pictures ({announcementImages(editor).length + pendingImages.length}/10)</p>
                  <div className="grid grid-cols-2 gap-3">
                  {announcementImages(editor).map((url, index) => (
                    <div key={url} className="relative aspect-video w-full rounded-xl overflow-hidden mb-3 border border-gray-200 dark:border-gray-700">
                      <img
                        src={resolveImageUrl(url) || url}
                        alt={`Picture ${index + 1} preview`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        disabled={busy || uploadingImage}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors cursor-pointer"
                        title={`Remove picture ${index + 1}`}
                        aria-label={`Remove picture ${index + 1}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                      {index === 0 && <span className="absolute bottom-2 left-2 bg-black/60 text-white rounded px-2 py-1 text-xs">Cover</span>}
                    </div>
                  ))}
                  {pendingPreviews.map((url, index) => (
                    <div key={url} className="relative aspect-video w-full rounded-xl overflow-hidden mb-3 border border-gray-200 dark:border-gray-700">
                      <img src={url} alt={`Picture ${announcementImages(editor).length + index + 1} preview`} className="w-full h-full object-cover" />
                      <button type="button" aria-label={`Remove pending attachment ${index + 1}`} title={`Remove picture ${announcementImages(editor).length + index + 1}`} disabled={busy || uploadingImage}
                        onClick={() => setPendingImages(files => files.filter((_, i) => i !== index))}
                        className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg transition-colors cursor-pointer">
                        <X className="w-4 h-4" />
                      </button>
                      {announcementImages(editor).length === 0 && index === 0 && <span className="absolute bottom-2 left-2 bg-black/60 text-white rounded px-2 py-1 text-xs">Cover</span>}
                    </div>
                  ))}
                  </div>
                  {pendingPreviews.length > 0 && <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">These images will upload when you save the announcement.</p>}
                  <div className="flex items-center gap-3">
                    <label
                      htmlFor="announcement-image-input"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                    >
                      <ImagePlus className="w-4 h-4" />
                      <span>Add pictures</span>
                      <input
                        id="announcement-image-input"
                        type="file"
                        multiple
                        disabled={busy || uploadingImage || announcementImages(editor).length + pendingImages.length >= 10}
                        className="hidden"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={e => {
                          void upload(Array.from(e.target.files || []));
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {uploadingImage
                        ? 'Uploading pictures...'
                        : 'Select or drop multiple pictures. Up to 10, 5 MB each. JPEG, PNG, WebP. First picture is the cover.'}
                    </span>
                  </div>
                </div>

                {/* Target Audience */}
                <fieldset className="space-y-4 min-w-0">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Target Audience
                  </label>
                  <select
                    value={editor.targetAudience}
                    disabled={isModerator}
                    onChange={e => {
                      change('targetAudience', e.target.value);
                      change('barangays', []);
                    }}
                    className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 focus:border-green-400 transition-colors cursor-pointer"
                  >
                    {isModerator ? (
                      <option value="Specific Barangay">{assignedBarangay}</option>
                    ) : ['All Residents', 'Specific Barangay', 'Multiple Barangays'].map(v => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  {isModerator && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Announcements are limited to your assigned barangay: {assignedBarangay}.
                    </p>
                  )}
                </div>

                {/* Barangay Selection when not All Residents */}
                {!isModerator && editor.targetAudience !== 'All Residents' && (
                  <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Select Barangays
                    </p>
                    {barangayError ? (
                      <p className="text-xs text-red-500">{barangayError}</p>
                    ) : !barangays.length ? (
                      <p className="text-xs text-gray-400">No resident barangays available.</p>
                    ) : (
                      <div className="max-h-36 overflow-y-auto space-y-1.5 pr-2">
                        {barangays.map(v => (
                          <label key={v} className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                            <input
                              type={editor.targetAudience === 'Specific Barangay' ? 'radio' : 'checkbox'}
                              name="barangays"
                              disabled={isModerator}
                              checked={editor.barangays.includes(v)}
                              onChange={e => {
                                change(
                                  'barangays',
                                  editor.targetAudience === 'Specific Barangay'
                                    ? [v]
                                    : e.target.checked
                                    ? [...editor.barangays, v]
                                    : editor.barangays.filter(b => b !== v)
                                );
                              }}
                              className="rounded text-green-600 focus:ring-green-500"
                            />
                            <span>{v}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Publishing Settings Grid */}
                <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Publishing Settings
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Publish Status
                      </label>
                      <select
                        value={editor.status}
                        onChange={e => change('status', e.target.value)}
                        className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 focus:border-green-400 transition-colors cursor-pointer"
                      >
                        {statuses.map(v => (
                          <option key={v} value={v}>
                            {v === 'Draft'
                              ? 'Save as Draft'
                              : v === 'Published'
                              ? 'Publish Now'
                              : v === 'Scheduled'
                              ? 'Schedule'
                              : v}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Announcement Priority
                      </label>
                      <select
                        value={editor.priority}
                        onChange={e => change('priority', e.target.value)}
                        className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 focus:border-green-400 transition-colors cursor-pointer"
                      >
                        <option value="Normal">Normal</option>
                        <option value="Important">Important</option>
                      </select>
                    </div>
                  </div>

                  {editor.status === 'Scheduled' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Publish Date &amp; Time (Philippine Time) *
                      </label>
                      <input
                        required
                        type="datetime-local"
                        value={localDate(editor.publishAt)}
                        onChange={e => change('publishAt', iso(e.target.value))}
                        className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 focus:border-green-400 transition-colors"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Expiration Date &amp; Time (Optional)
                    </label>
                    <input
                      type="datetime-local"
                      value={localDate(editor.expiresAt)}
                      onChange={e => change('expiresAt', iso(e.target.value))}
                      className="w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800 focus:border-green-400 transition-colors"
                    />
                    <span className="text-xs text-gray-400 dark:text-gray-500 mt-1 block">
                      {editor.expiresAt ? `Expires: ${date(editor.expiresAt)}` : 'No expiration date set'}
                    </span>
                  </div>
                </div>

                {/* Call To Action (Action Button) */}
                <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-3">
                  <label className="flex items-center gap-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editor.ctaType !== 'No Action'}
                      onChange={e => change('ctaType', e.target.checked ? 'Open External Link' : 'No Action')}
                      className="rounded border-gray-300 dark:border-gray-700 text-green-600 focus:ring-green-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Enable Action Button</span>
                  </label>

                  {editor.ctaType !== 'No Action' && (
                    <div className="bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                            Button Label *
                          </label>
                          <input
                            required
                            maxLength={40}
                            value={editor.ctaLabel || ''}
                            onChange={e => change('ctaLabel', e.target.value)}
                            placeholder="e.g. View Challenge"
                            className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                            Action Type *
                          </label>
                          <select
                            value={editor.ctaType}
                            onChange={e => {
                              change('ctaType', e.target.value);
                              change('ctaValue', null);
                            }}
                            className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200"
                          >
                            {actions.map(v => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                          {editor.ctaType === 'Open External Link' ? 'HTTPS URL *' : 'Destination Record ID *'}
                        </label>
                        <input
                          required
                          type={editor.ctaType === 'Open External Link' ? 'url' : 'text'}
                          value={editor.ctaValue || ''}
                          onChange={e => change('ctaValue', e.target.value)}
                          placeholder={
                            editor.ctaType === 'Open External Link'
                              ? 'https://example.com'
                              : 'ID of challenge or event'
                          }
                          className="w-full px-3 py-2 text-xs border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-200"
                        />
                      </div>
                    </div>
                  )}
                </div>

                </fieldset>
                {/* Live Preview Toggle */}
                <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Live Preview
                    </h4>
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setMobilePreview(true)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                          mobilePreview
                            ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        Mobile
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobilePreview(false)}
                        className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                          !mobilePreview
                            ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                        }`}
                      >
                        Desktop
                      </button>
                    </div>
                  </div>
                  <div className="p-4 bg-gray-100/60 dark:bg-gray-950/60 rounded-2xl border border-gray-200/70 dark:border-gray-800 flex justify-center items-center overflow-hidden">
                    <Preview item={editor} mobile={mobilePreview} />
                  </div>
                </div>
              </form>

              {/* Modal Footer */}
              <div className="shrink-0 p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#0f1713] flex flex-wrap items-center justify-end gap-3">
                {!editor.id && <p role={drafts.error ? 'alert' : 'status'} className="mr-auto text-left text-sm text-gray-600 dark:text-gray-300">{drafts.error || drafts.status}</p>}
                <button
                  type="button"
                  onClick={() => !busy && !uploadingImage && handleCloseModal(() => setEditor(null))}
                  disabled={busy || uploadingImage}
                  className="px-6 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  form="announcement-form"
                  type="submit"
                  disabled={busy || uploadingImage}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 active:scale-95 rounded-xl transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {busy
                      ? 'Saving…'
                      : editor.status === 'Published'
                      ? editor.id
                        ? 'Update & Publish'
                        : 'Publish Announcement'
                      : editor.status === 'Scheduled'
                      ? 'Schedule Announcement'
                      : 'Save Announcement'}
                  </span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Announcement Details Modal */}
      {details &&
        createPortal(
          <div
            className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
            onClick={() => handleCloseModal(() => setDetails(null))}
          >
            <div
              className={`relative z-10 bg-white dark:bg-[#0f1713] text-gray-900 dark:text-white rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 w-full max-w-xl flex flex-col overflow-hidden ${
                isClosing ? 'animate-modal-exit' : 'animate-modal'
              }`}
              style={{ maxHeight: 'calc(100vh - 80px)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 shrink-0">
                <h3 className="text-lg font-serif font-bold text-gray-900 dark:text-white">
                  Announcement Details
                </h3>
                <button
                  onClick={() => handleCloseModal(() => setDetails(null))}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <Preview item={details} mobile={false} />

                <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                    Metadata
                  </h4>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl">
                      <dt className="text-gray-400 dark:text-gray-500 mb-1">Category</dt>
                      <dd className="font-semibold text-gray-900 dark:text-white">{details.category}</dd>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl">
                      <dt className="text-gray-400 dark:text-gray-500 mb-1">Status</dt>
                      <dd className="font-semibold text-gray-900 dark:text-white">{details.status}</dd>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl">
                      <dt className="text-gray-400 dark:text-gray-500 mb-1">Author</dt>
                      <dd className="font-semibold text-gray-900 dark:text-white">
                        {details.createdBy?.name || 'Administrator'}
                      </dd>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl">
                      <dt className="text-gray-400 dark:text-gray-500 mb-1">Target Audience</dt>
                      <dd className="font-semibold text-gray-900 dark:text-white">{audience(details)}</dd>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl">
                      <dt className="text-gray-400 dark:text-gray-500 mb-1">Published Date</dt>
                      <dd className="font-semibold text-gray-900 dark:text-white">{date(details.publishAt)}</dd>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl">
                      <dt className="text-gray-400 dark:text-gray-500 mb-1">Expiration</dt>
                      <dd className="font-semibold text-gray-900 dark:text-white">
                        {details.expiresAt ? date(details.expiresAt) : 'No expiration'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="shrink-0 p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#0f1713] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => handleCloseModal(() => setDetails(null))}
                  className="px-6 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                >
                  Close
                </button>
                {(!isModerator || details.canManage) && <button
                  onClick={() => {
                    const itemToEdit = details;
                    setDetails(null);
                    edit(itemToEdit);
                  }}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 active:scale-95 rounded-xl transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit Announcement</span>
                </button>}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Custom Delete Confirmation Modal (Eco Events Style) */}
      {deleteConfirmModal.open && deleteConfirmModal.item &&
        createPortal(
          <div
            className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn"
            onClick={() => !deleting && setDeleteConfirmModal({ open: false, item: null })}
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
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">Delete Announcement</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Irreversible community action</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !deleting && setDeleteConfirmModal({ open: false, item: null })}
                  disabled={!!deleting}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-3">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Are you sure you want to permanently delete{' '}
                  <strong className="text-gray-900 dark:text-white">
                    "{deleteConfirmModal.item.title}"
                  </strong>
                  ?
                </p>
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    Warning:
                  </p>
                  <p>
                    This action cannot be undone. If published, it will immediately be removed from user announcement feeds.
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmModal({ open: false, item: null })}
                  disabled={!!deleting}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={!!deleting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:scale-98 rounded-xl transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {deleting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Announcement</span>
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
