import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useModalScrollLock } from '../../../hooks/useModalScrollLock';
import {
  Shield,
  Trash2,
  Tag,
  Package,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Ban,
  User,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  Images as ImagesIcon,
  MapPin,
  Mail,
  Layers,
  Eye,
  Gift,
  Compass,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { adminGet, adminDelete, adminPatch, API_HOST } from '../../../utils/adminApi';

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
  meetupLocation?: string | null;
  meetupLandmark?: string | null;
  meetupNotes?: string | null;
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

const conditionColors: Record<string, { badge: string; text: string }> = {
  New: {
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  'Like New': {
    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60',
    text: 'text-blue-600 dark:text-blue-400',
  },
  Good: {
    badge: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800/60',
    text: 'text-cyan-600 dark:text-cyan-400',
  },
  Fair: {
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
    text: 'text-amber-600 dark:text-amber-400',
  },
};

const meetupMethodLabels: Record<string, { label: string; icon: string; bg: string }> = {
  public: {
    label: 'Public Meetup',
    icon: '🤝',
    bg: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/60',
  },
  dropoff: {
    label: 'Drop-off',
    icon: '📦',
    bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60',
  },
  pickup: {
    label: 'Pick-up',
    icon: '🏠',
    bg: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/60',
  },
  flexible: {
    label: 'Flexible',
    icon: '✨',
    bg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/60',
  },
};

const approvalConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: {
    color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60',
    icon: <Clock className="w-3 h-3" />,
    label: 'Pending',
  },
  approved: {
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60',
    icon: <CheckCircle className="w-3 h-3" />,
    label: 'Approved',
  },
  rejected: {
    color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60',
    icon: <XCircle className="w-3 h-3" />,
    label: 'Rejected',
  },
};

// Helper to parse and resolve listing images
function resolveListingImages(rawImages: any, userId: string): string[] {
  if (!rawImages) return [];
  let list = rawImages;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      list = [list];
    }
  }
  if (!Array.isArray(list)) {
    list = [list];
  }
  return list
    .map((item: any) => {
      let img = item;
      if (typeof img === 'object' && img !== null) {
        img = img.url || img.path || img.src || Object.values(img)[0];
      }
      if (typeof img !== 'string' || !img.trim()) return '';
      img = img.trim();
      if (img.startsWith('http://') || img.startsWith('https://')) return img;
      if (img.startsWith('/')) return `${API_HOST}${img}`;
      if (img.startsWith('uploads/')) return `${API_HOST}/${img}`;
      return `${API_HOST}/uploads/swap-images/${userId}/${img}`;
    })
    .filter(Boolean);
}

interface SwapListingCardProps {
  listing: SwapListingItem;
  onApprove: (id: string) => void;
  onOpenReject: (id: string) => void;
  onOpenReport: (id: string) => void;
  onDelete: (id: string) => void;
  onPreviewImages: (images: string[], initialIdx: number, title: string) => void;
  onViewDetails: (listing: SwapListingItem) => void;
}

function SwapListingCard({
  listing,
  onApprove,
  onOpenReject,
  onOpenReport,
  onDelete,
  onPreviewImages,
  onViewDetails,
}: SwapListingCardProps) {
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const images = resolveListingImages(listing.images, listing.userId);
  const approval = approvalConfig[listing.approvalStatus] || approvalConfig.pending;
  const conditionInfo = conditionColors[listing.condition] || {
    badge: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    text: 'text-gray-600 dark:text-gray-400',
  };
  const meetupInfo = meetupMethodLabels[listing.meetupMethod] || {
    label: listing.meetupMethod || 'Meetup',
    icon: '📍',
    bg: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  };

  const isGiveaway = listing.lookingFor?.toLowerCase().includes('giveaway');
  const fullLocation = [listing.city, listing.province].filter(Boolean).join(', ') || 'Location not specified';

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImgIdx(prev => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveImgIdx(prev => (prev < images.length - 1 ? prev + 1 : 0));
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/80 dark:border-gray-800 shadow-sm hover:shadow-lg dark:hover:border-emerald-700/60 transition-all duration-300 overflow-hidden group flex flex-col hover:border-emerald-300">
      {/* Image / Carousel Section */}
      <div className="bg-gray-100 dark:bg-gray-800/80 w-full relative">
        <div className="h-60 w-full relative overflow-hidden bg-gray-900/5 dark:bg-black/30 group/img">
          {images.length > 0 ? (
            <>
              <img
                src={images[activeImgIdx] || images[0]}
                alt={listing.title || 'Listing image'}
                className="w-full h-full object-cover cursor-pointer transition-transform duration-300 hover:scale-105"
                onClick={() => onPreviewImages(images, activeImgIdx, listing.title)}
              />

              {/* Expand / Lightbox overlay button */}
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  onPreviewImages(images, activeImgIdx, listing.title);
                }}
                className="absolute top-2.5 left-2.5 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-lg backdrop-blur-sm transition-all opacity-0 group-hover/img:opacity-100 shadow-sm"
                title="View full image"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>

              {/* Prev / Next Arrows */}
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={handlePrevImage}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-all opacity-80 hover:opacity-100 shadow-md"
                    title="Previous image"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextImage}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full backdrop-blur-sm transition-all opacity-80 hover:opacity-100 shadow-md"
                    title="Next image"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}

              {/* Photo count indicator */}
              {images.length > 1 && (
                <div className="absolute bottom-2.5 right-2.5 bg-black/70 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm pointer-events-none">
                  <ImagesIcon className="w-3 h-3" />
                  <span>
                    {activeImgIdx + 1} / {images.length}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 text-gray-300 dark:text-gray-600">
              <Package className="w-12 h-12 mb-1" />
              <span className="text-xs text-gray-400 dark:text-gray-500">No images provided</span>
            </div>
          )}

          {listing.isReported && (
            <div className="absolute top-3 right-3 flex items-center gap-1 bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md z-10 animate-pulse">
              <AlertTriangle className="w-3 h-3" /> {listing.reportCount} Report{listing.reportCount !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Mini Thumbnail Gallery Strip */}
        {images.length > 1 && (
          <div className="p-2 bg-gray-50 dark:bg-gray-800/90 border-t border-gray-100 dark:border-gray-800 flex items-center gap-2 overflow-x-auto">
            {images.map((imgUrl, idx) => {
              const isActive = idx === activeImgIdx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImgIdx(idx)}
                  className={`relative shrink-0 w-11 h-11 rounded-lg overflow-hidden border-2 transition-all ${
                    isActive
                      ? 'border-emerald-500 ring-2 ring-emerald-500/30 scale-105 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100 hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                  title={`Photo ${idx + 1}`}
                >
                  <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div className="space-y-3">
          {/* Header Row: Status, Date, Quick Details Button */}
          <div className="flex items-center justify-between">
            <span className={`flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${approval.color}`}>
              {approval.icon}
              {approval.label}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">{listing.date}</span>
              <button
                type="button"
                onClick={() => onViewDetails(listing)}
                className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 font-semibold flex items-center gap-1 hover:underline"
                title="View full details dialog"
              >
                <Eye className="w-3.5 h-3.5" /> Details
              </button>
            </div>
          </div>

          {/* Title & Quantity */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-serif font-bold text-gray-900 dark:text-white text-base leading-snug wrap-break-word">
                {listing.title}
              </h3>
              {listing.quantity && (
                <span className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60 px-2 py-0.5 rounded-lg border">
                  <Layers className="w-3 h-3" />
                  Qty: {listing.quantity}
                </span>
              )}
            </div>
          </div>

          {/* Key Badges: Category, Condition, Looking For */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 border">
              <Tag className="w-3 h-3 text-gray-500 dark:text-gray-400" />
              {listing.category}
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-lg border ${conditionInfo.badge}`}>
              {listing.condition}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border ${
                isGiveaway
                  ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800/60'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60'
              }`}
            >
              {isGiveaway ? <Gift className="w-3 h-3" /> : <Package className="w-3 h-3" />}
              {listing.lookingFor ? `Looking for: ${listing.lookingFor}` : 'Giveaway'}
            </span>
          </div>

          {/* User & Location Information Box */}
          <div className="bg-gray-50/90 dark:bg-gray-800/70 rounded-xl p-3 border border-gray-100 dark:border-gray-700/60 space-y-1.5 text-xs">
            {/* User */}
            <div className="flex items-center justify-between text-gray-700 dark:text-gray-200">
              <div className="flex items-center gap-1.5 font-medium truncate">
                <User className="w-3.5 h-3.5 text-gray-400 dark:text-gray-400 shrink-0" />
                <span className="text-gray-900 dark:text-gray-100 font-semibold">{listing.postedBy || 'Anonymous'}</span>
              </div>
              {listing.postedByEmail && (
                <div className="flex items-center gap-1 text-gray-400 dark:text-gray-400 text-[11px] truncate max-w-35" title={listing.postedByEmail}>
                  <Mail className="w-3 h-3 shrink-0" />
                  <span className="truncate">{listing.postedByEmail}</span>
                </div>
              )}
            </div>

            {/* City & Province */}
            <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate font-medium">{fullLocation}</span>
            </div>

            {/* Meetup Method */}
            <div className="flex items-center gap-1.5 pt-1 border-t border-gray-200/60 dark:border-gray-700/60">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${meetupInfo.bg}`}>
                <span>{meetupInfo.icon}</span>
                <span>{meetupInfo.label}</span>
              </span>
              {listing.meetupLocation && (
                <span className="text-gray-600 dark:text-gray-300 text-[11px] truncate" title={listing.meetupLocation}>
                  <strong className="text-gray-700 dark:text-gray-200 font-medium">Location:</strong> {listing.meetupLocation}
                </span>
              )}
            </div>

            {/* Landmark & Notes (if any) */}
            {(listing.meetupLandmark || listing.meetupNotes) && (
              <div className="pt-1 text-[11px] text-gray-500 dark:text-gray-400 space-y-0.5">
                {listing.meetupLandmark && (
                  <p className="truncate">
                    <strong className="text-gray-700 dark:text-gray-200 font-medium">Landmark:</strong> {listing.meetupLandmark}
                  </p>
                )}
                {listing.meetupNotes && (
                  <p className="truncate text-gray-600 dark:text-gray-300 italic">
                    <strong className="text-gray-700 dark:text-gray-200 not-italic font-medium">Notes:</strong> {listing.meetupNotes}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Description Section */}
          {listing.description ? (
            <div className="text-xs text-gray-700 dark:text-gray-300 bg-emerald-50/30 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-100/60 dark:border-emerald-900/40">
              <p className={`leading-relaxed ${isDescExpanded ? '' : 'line-clamp-2'}`}>
                {listing.description}
              </p>
              {listing.description.length > 90 && (
                <button
                  type="button"
                  onClick={() => setIsDescExpanded(!isDescExpanded)}
                  className="mt-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-0.5"
                >
                  {isDescExpanded ? (
                    <>Show less <ChevronUp className="w-3 h-3" /></>
                  ) : (
                    <>Show more <ChevronDown className="w-3 h-3" /></>
                  )}
                </button>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">No additional description provided.</p>
          )}

          {/* Report Alert Banner (if reported) */}
          {listing.isReported && listing.reportReason && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 rounded-xl border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 space-y-0.5">
              <div className="flex items-center gap-1 font-bold text-xs text-rose-700 dark:text-rose-400">
                <AlertTriangle className="w-3.5 h-3.5" /> Moderation Notice:
              </div>
              <p className="text-[11px] leading-snug">{listing.reportReason}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
          {listing.approvalStatus === 'pending' && (
            <>
              <button
                onClick={() => onApprove(listing.id)}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 text-xs font-semibold rounded-xl transition-colors shadow-sm"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                onClick={() => onOpenReject(listing.id)}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border-rose-800/60 text-xs font-semibold rounded-xl transition-colors"
              >
                <Ban className="w-3.5 h-3.5" /> Reject
              </button>
            </>
          )}
          {listing.approvalStatus === 'approved' && (
            <button
              onClick={() => onOpenReject(listing.id)}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border-rose-800/60 text-xs font-semibold rounded-xl transition-colors"
            >
              <Ban className="w-3.5 h-3.5" /> Reject
            </button>
          )}
          {listing.approvalStatus === 'rejected' && (
            <button
              onClick={() => onApprove(listing.id)}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 text-xs font-semibold rounded-xl transition-colors shadow-sm"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Re-Approve
            </button>
          )}
          <button
            onClick={() => onOpenReport(listing.id)}
            className="flex items-center justify-center px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 dark:text-amber-300 dark:border-amber-800/60 text-xs font-semibold rounded-xl transition-colors"
            title="Flag/Report listing"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(listing.id)}
            className="flex items-center justify-center px-3 py-2 bg-gray-50 hover:bg-rose-50 text-gray-600 hover:text-rose-600 border border-gray-200 dark:bg-gray-800 dark:hover:bg-rose-950/60 dark:text-gray-400 dark:hover:text-rose-300 dark:border-gray-700 text-xs font-semibold rounded-xl transition-colors"
            title="Delete listing permanently"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Full Details Modal using createPortal to view complete comprehensive metadata
function ListingFullDetailsModal({
  listing,
  onClose,
  onApprove,
  onOpenReject,
  onPreviewImages,
}: {
  listing: SwapListingItem;
  onClose: () => void;
  onApprove: (id: string) => void;
  onOpenReject: (id: string) => void;
  onPreviewImages: (images: string[], idx: number, title: string) => void;
}) {
  const [isClosing, setIsClosing] = useState(false);
  const images = resolveListingImages(listing.images, listing.userId);
  const approval = approvalConfig[listing.approvalStatus] || approvalConfig.pending;
  const conditionInfo = conditionColors[listing.condition] || {
    badge: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    text: 'text-gray-600 dark:text-gray-400',
  };
  const meetupInfo = meetupMethodLabels[listing.meetupMethod] || {
    label: listing.meetupMethod || 'Meetup',
    icon: '📍',
    bg: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
  };

  useModalScrollLock(true);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 280);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className={`relative z-10 bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-800 w-full max-w-3xl flex flex-col overflow-hidden ${
          isClosing ? 'animate-modal-exit' : 'animate-modal'
        }`}
        style={{ maxHeight: 'calc(100vh - 80px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-emerald-950 dark:bg-emerald-950/90 text-white shrink-0">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${approval.color}`}>
              {approval.label}
            </span>
            <h2 className="text-xl font-serif font-bold truncate max-w-md">{listing.title}</h2>
          </div>
          <button
            onClick={handleClose}
            type="button"
            className="p-2 text-emerald-300 hover:text-white hover:bg-emerald-900 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Images Strip */}
          {images.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1.5">
                <ImagesIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Attached Photos ({images.length})
              </h4>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {images.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => onPreviewImages(images, idx, listing.title)}
                    className="relative group h-24 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 cursor-pointer hover:border-emerald-600 dark:hover:border-emerald-500 shadow-sm"
                  >
                    <img src={img} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <Maximize2 className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Listing Specs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Item Info Box */}
            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-4 border border-gray-100 dark:border-gray-700/60 space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Item Details
              </h4>
              <div className="space-y-1.5 text-xs text-gray-700 dark:text-gray-200">
                <div className="flex justify-between py-1 border-b border-gray-200/60 dark:border-gray-700/60">
                  <span className="text-gray-500 dark:text-gray-400">Category:</span>
                  <span className="font-semibold">{listing.category}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200/60 dark:border-gray-700/60">
                  <span className="text-gray-500 dark:text-gray-400">Quantity:</span>
                  <span className="font-semibold">{listing.quantity || '1'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200/60 dark:border-gray-700/60">
                  <span className="text-gray-500 dark:text-gray-400">Condition:</span>
                  <span className={`font-semibold px-2 py-0.5 rounded-md border ${conditionInfo.badge}`}>
                    {listing.condition}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200/60 dark:border-gray-700/60">
                  <span className="text-gray-500 dark:text-gray-400">Looking For:</span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">{listing.lookingFor || 'Giveaway'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 dark:text-gray-400">Date Posted:</span>
                  <span className="font-semibold">{listing.date}</span>
                </div>
              </div>
            </div>

            {/* Poster & Location Box */}
            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-4 border border-gray-100 dark:border-gray-700/60 space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Posted By & Location
              </h4>
              <div className="space-y-1.5 text-xs text-gray-700 dark:text-gray-200">
                <div className="flex justify-between py-1 border-b border-gray-200/60 dark:border-gray-700/60">
                  <span className="text-gray-500 dark:text-gray-400">User Name:</span>
                  <span className="font-semibold">{listing.postedBy || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200/60 dark:border-gray-700/60">
                  <span className="text-gray-500 dark:text-gray-400">Email:</span>
                  <span className="font-semibold">{listing.postedByEmail || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200/60 dark:border-gray-700/60">
                  <span className="text-gray-500 dark:text-gray-400">User ID:</span>
                  <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">{listing.userId}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200/60 dark:border-gray-700/60">
                  <span className="text-gray-500 dark:text-gray-400">City / Municipality:</span>
                  <span className="font-semibold">{listing.city || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 dark:text-gray-400">Province / Region:</span>
                  <span className="font-semibold">{listing.province || 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery & Meetup Details */}
          <div className="bg-emerald-50/40 dark:bg-emerald-950/30 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-900/40 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Delivery & Meetup Preferences
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white dark:bg-gray-800/90 rounded-xl border border-emerald-100 dark:border-emerald-900/50 space-y-1">
                <span className="text-gray-400 dark:text-gray-500 block text-[11px]">Method:</span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold border ${meetupInfo.bg}`}>
                  <span>{meetupInfo.icon}</span>
                  <span>{meetupInfo.label}</span>
                </span>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800/90 rounded-xl border border-emerald-100 dark:border-emerald-900/50 space-y-1">
                <span className="text-gray-400 dark:text-gray-500 block text-[11px]">Preferred Location:</span>
                <p className="font-semibold text-gray-800 dark:text-gray-200">{listing.meetupLocation || 'Not specified'}</p>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800/90 rounded-xl border border-emerald-100 dark:border-emerald-900/50 space-y-1">
                <span className="text-gray-400 dark:text-gray-500 block text-[11px]">Landmark:</span>
                <p className="font-semibold text-gray-800 dark:text-gray-200">{listing.meetupLandmark || 'Not specified'}</p>
              </div>
              <div className="p-3 bg-white dark:bg-gray-800/90 rounded-xl border border-emerald-100 dark:border-emerald-900/50 space-y-1">
                <span className="text-gray-400 dark:text-gray-500 block text-[11px]">Schedule / Meetup Notes:</span>
                <p className="font-semibold text-gray-800 dark:text-gray-200">{listing.meetupNotes || 'None'}</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-2xl p-4 border border-gray-100 dark:border-gray-700/60 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Item Description
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
              {listing.description || 'No description provided by the user.'}
            </p>
          </div>

          {/* Moderation Info */}
          {listing.isReported && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/50 rounded-2xl border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-rose-700 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4" /> Moderation Reports ({listing.reportCount})
              </div>
              <p className="text-xs leading-relaxed bg-white/70 dark:bg-gray-900/70 p-3 rounded-xl border border-rose-100 dark:border-rose-900/50 font-medium">
                Reason: {listing.reportReason || 'No specific reason provided.'}
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/90 flex items-center justify-between shrink-0">
          <div className="flex gap-2">
            {listing.approvalStatus !== 'approved' && (
              <button
                type="button"
                onClick={() => {
                  onApprove(listing.id);
                  handleClose();
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm flex items-center gap-1"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Approve Listing
              </button>
            )}
            {listing.approvalStatus !== 'rejected' && (
              <button
                type="button"
                onClick={() => {
                  handleClose();
                  onOpenReject(listing.id);
                }}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border-rose-800/60 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1"
              >
                <Ban className="w-3.5 h-3.5" /> Reject Listing
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-semibold hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Preview Modal using createPortal to document.body
function ListingImagePreviewModal({
  images,
  initialIndex,
  title,
  onClose,
}: {
  images: string[];
  initialIndex: number;
  title: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const container = document.getElementById('admin-scroll-container');
    const origContainerOverflow = container?.style.overflowY || '';
    const origBodyOverflow = document.body.style.overflow;

    if (container) container.style.overflowY = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      if (container) container.style.overflowY = origContainerOverflow;
      document.body.style.overflow = origBodyOverflow;
    };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 280);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowLeft') {
        setIndex(prev => (prev > 0 ? prev - 1 : images.length - 1));
      } else if (e.key === 'ArrowRight') {
        setIndex(prev => (prev < images.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length]);

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className={`relative z-10 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 w-full max-w-200 flex flex-col overflow-hidden ${
          isClosing ? 'animate-modal-exit' : 'animate-modal'
        }`}
        style={{ maxHeight: 'calc(100vh - 100px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-serif font-bold text-gray-900 dark:text-white">{title}</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Photo {index + 1} of {images.length}
            </p>
          </div>
          <button
            onClick={handleClose}
            type="button"
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Image Area */}
        <div className="p-6 bg-gray-50/50 dark:bg-gray-950/60 flex flex-col items-center justify-center relative min-h-90 max-h-[56vh] overflow-hidden">
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setIndex(prev => (prev > 0 ? prev - 1 : images.length - 1))}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 dark:bg-gray-800/90 dark:hover:bg-gray-800 dark:text-white p-2.5 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 backdrop-blur-sm transition-all z-20"
                title="Previous photo"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setIndex(prev => (prev < images.length - 1 ? prev + 1 : 0))}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white text-gray-800 dark:bg-gray-800/90 dark:hover:bg-gray-800 dark:text-white p-2.5 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 backdrop-blur-sm transition-all z-20"
                title="Next photo"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          <img
            src={images[index]}
            alt={title}
            className="max-h-[50vh] max-w-full object-contain rounded-xl shadow-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 select-none"
          />
        </div>

        {/* Thumbnail Selector Strip (if multiple images) */}
        {images.length > 1 && (
          <div className="p-3 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 flex items-center justify-center gap-2 overflow-x-auto">
            {images.map((imgUrl, idx) => {
              const isActive = idx === index;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setIndex(idx)}
                  className={`relative w-12 h-12 rounded-xl overflow-hidden border-2 transition-all shrink-0 ${
                    isActive
                      ? 'border-emerald-500 ring-2 ring-emerald-500/30 scale-105 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100 hover:border-gray-400'
                  }`}
                >
                  <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="shrink-0 p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end gap-3 z-10">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Reject Modal using createPortal
function RejectListingModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const container = document.getElementById('admin-scroll-container');
    const origContainerOverflow = container?.style.overflowY || '';
    const origBodyOverflow = document.body.style.overflow;

    if (container) container.style.overflowY = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      if (container) container.style.overflowY = origContainerOverflow;
      document.body.style.overflow = origBodyOverflow;
    };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 280);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onConfirm(reason);
      handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className={`relative z-10 bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col ${
          isClosing ? 'animate-modal-exit' : 'animate-modal'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-serif font-bold text-gray-900 dark:text-white mb-2">Reject Listing</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Provide a reason for rejecting this listing.</p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Inappropriate content, spam, nonsense post..."
          className="w-full px-4 py-3 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200 dark:focus:ring-rose-900 focus:border-rose-400 resize-none h-24"
        />
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-rose-600 rounded-xl hover:bg-rose-700 transition-colors disabled:opacity-60"
          >
            {submitting ? 'Rejecting...' : 'Reject'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Report Modal using createPortal
function ReportListingModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const container = document.getElementById('admin-scroll-container');
    const origContainerOverflow = container?.style.overflowY || '';
    const origBodyOverflow = document.body.style.overflow;

    if (container) container.style.overflowY = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      if (container) container.style.overflowY = origContainerOverflow;
      document.body.style.overflow = origBodyOverflow;
    };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 280);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onConfirm(reason);
      handleClose();
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className={`relative z-10 bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col ${
          isClosing ? 'animate-modal-exit' : 'animate-modal'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-serif font-bold text-gray-900 dark:text-white mb-2">Report Listing</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Flag this listing for moderation review.</p>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Fake listing, offensive content..."
          className="w-full px-4 py-3 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-200 dark:focus:ring-amber-900 focus:border-amber-400 resize-none h-24"
        />
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-amber-600 rounded-xl hover:bg-amber-700 transition-colors disabled:opacity-60"
          >
            {submitting ? 'Reporting...' : 'Report'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function GiveAndGetHub() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [listings, setListings] = useState<SwapListingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SwapStats | null>(null);
  const [rejectModal, setRejectModal] = useState<{ open: boolean; listingId: string | null }>({ open: false, listingId: null });
  const [reportModal, setReportModal] = useState<{ open: boolean; listingId: string | null }>({ open: false, listingId: null });
  const [detailsModalListing, setDetailsModalListing] = useState<SwapListingItem | null>(null);

  // Image Lightbox Modal State
  const [previewModal, setPreviewModal] = useState<{
    open: boolean;
    images: string[];
    index: number;
    title: string;
  }>({
    open: false,
    images: [],
    index: 0,
    title: '',
  });

  const fetchListings = async () => {
    try {
      setLoading(true);
      const [listingsData, statsData] = await Promise.all([
        adminGet<SwapListingItem[]>('/give-and-get/swap-listings'),
        adminGet<SwapStats>('/give-and-get/swap-listings/stats'),
      ]);
      setListings(listingsData);
      setStats(statsData);
    } catch (error: any) {
      console.error('Failed to fetch swap listings', error);
      alert(`Failed to fetch swap listings: ${error.message || error}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await adminPatch(`/give-and-get/swap-listings/${id}/approve`, {});
      setListings(prev => prev.map(l => (l.id === id ? { ...l, approvalStatus: 'approved', isReported: false, reportCount: 0 } : l)));
      if (stats) setStats({ ...stats, pending: stats.pending - 1, approved: stats.approved + 1 });
    } catch (error: any) {
      console.error('Failed to approve listing', error);
      alert(`Failed to approve listing: ${error.message || error}`);
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectModal.listingId) return;
    try {
      await adminPatch(`/give-and-get/swap-listings/${rejectModal.listingId}/reject`, { reason });
      setListings(prev =>
        prev.map(l => (l.id === rejectModal.listingId ? { ...l, approvalStatus: 'rejected', isActive: false, reportReason: reason } : l))
      );
      if (stats) setStats({ ...stats, pending: stats.pending - 1, rejected: stats.rejected + 1 });
    } catch (error: any) {
      console.error('Failed to reject listing', error);
      alert(`Failed to reject listing: ${error.message || error}`);
    }
  };

  const handleReportConfirm = async (reason: string) => {
    if (!reportModal.listingId) return;
    try {
      await adminPatch(`/give-and-get/swap-listings/${reportModal.listingId}/report`, { reason });
      setListings(prev =>
        prev.map(l => (l.id === reportModal.listingId ? { ...l, isReported: true, reportCount: l.reportCount + 1, reportReason: reason } : l))
      );
      if (stats) setStats({ ...stats, reported: stats.reported + 1 });
    } catch (error: any) {
      console.error('Failed to report listing', error);
      alert(`Failed to report listing: ${error.message || error}`);
    }
  };

  const handleDeleteListing = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this listing?')) {
      try {
        await adminDelete(`/give-and-get/swap-listings/${id}`);
        setListings(prev => prev.filter(l => l.id !== id));
        if (stats) setStats({ ...stats, total: stats.total - 1 });
      } catch (error: any) {
        console.error('Failed to delete listing', error);
        alert(`Failed to delete listing: ${error.message || error}`);
      }
    }
  };

  const handlePreviewImages = (images: string[], initialIdx: number, title: string) => {
    setPreviewModal({
      open: true,
      images,
      index: initialIdx,
      title,
    });
  };

  const filteredListings = listings
    .filter(l => {
      if (filterStatus === 'pending') return l.approvalStatus === 'pending';
      if (filterStatus === 'approved') return l.approvalStatus === 'approved';
      if (filterStatus === 'rejected') return l.approvalStatus === 'rejected';
      if (filterStatus === 'reported') return l.isReported;
      return true;
    })
    .filter(l => l.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative p-8 space-y-6 bg-gray-50/50 dark:bg-emerald-950/20 min-h-full">
      {/* Listing Full Details Modal via Portal */}
      {detailsModalListing && (
        <ListingFullDetailsModal
          listing={detailsModalListing}
          onClose={() => setDetailsModalListing(null)}
          onApprove={(id) => {
            handleApprove(id);
            setDetailsModalListing(prev => (prev && prev.id === id ? { ...prev, approvalStatus: 'approved', isReported: false, reportCount: 0 } : prev));
          }}
          onOpenReject={(id) => {
            setDetailsModalListing(null);
            setRejectModal({ open: true, listingId: id });
          }}
          onPreviewImages={handlePreviewImages}
        />
      )}

      {/* Image Preview Modal via Portal */}
      {previewModal.open && (
        <ListingImagePreviewModal
          images={previewModal.images}
          initialIndex={previewModal.index}
          title={previewModal.title}
          onClose={() => setPreviewModal(prev => ({ ...prev, open: false }))}
        />
      )}

      {/* Reject Modal via Portal */}
      {rejectModal.open && rejectModal.listingId && (
        <RejectListingModal
          onClose={() => setRejectModal({ open: false, listingId: null })}
          onConfirm={handleRejectConfirm}
        />
      )}

      {/* Report Modal via Portal */}
      {reportModal.open && reportModal.listingId && (
        <ReportListingModal
          onClose={() => setReportModal({ open: false, listingId: null })}
          onConfirm={handleReportConfirm}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-gray-900 dark:text-white">Manage Listings</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Review, approve, and moderate community swap listings</p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-900 dark:text-white' },
            { label: 'Pending', value: stats.pending, color: 'text-yellow-600 dark:text-yellow-400' },
            { label: 'Approved', value: stats.approved, color: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Rejected', value: stats.rejected, color: 'text-rose-600 dark:text-rose-400' },
            { label: 'Reported', value: stats.reported, color: 'text-amber-600 dark:text-amber-400' },
          ].map(s => (
            <div
              key={s.label}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm hover:-translate-y-1 hover:shadow-md transition-all duration-300"
            >
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{s.label}</p>
              <p className={`text-3xl font-serif font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex gap-3 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Search listings..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-900 focus:border-emerald-400 transition-all"
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
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-xl border font-medium transition-all ${
              filterStatus === f.key
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-emerald-300 dark:hover:border-emerald-600'
            }`}
          >
            {f.icon}
            {f.label}
          </button>
        ))}
      </div>

      {/* Listings Grid */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredListings.map(listing => (
            <SwapListingCard
              key={listing.id}
              listing={listing}
              onApprove={handleApprove}
              onOpenReject={id => setRejectModal({ open: true, listingId: id })}
              onOpenReport={id => setReportModal({ open: true, listingId: id })}
              onDelete={handleDeleteListing}
              onPreviewImages={handlePreviewImages}
              onViewDetails={setDetailsModalListing}
            />
          ))}
        </div>
      )}

      {!loading && filteredListings.length === 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-12 text-center">
          <Shield className="w-12 h-12 text-gray-200 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 dark:text-gray-500">No listings found</p>
        </div>
      )}
    </div>
  );
}
