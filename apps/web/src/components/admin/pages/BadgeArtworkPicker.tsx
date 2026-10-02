import { useEffect, useRef, useState } from 'react';
import { BookOpen, Leaf, Recycle, Gift, Award, UploadCloud, Loader2 } from 'lucide-react';

const icons = [
  { name: 'Learning', Icon: BookOpen, paths: '<path d="M12 7v14m0-14C9 4 5 4 2 5v15c3-1 7-1 10 1m0-14c3-3 7-3 10-2v15c-3-1-7-1-10 1"/>' },
  { name: 'Eco action', Icon: Leaf, paths: '<path d="M20 3C10 2 3 6 3 13a7 7 0 0 0 14 0c0-4 1-7 3-10ZM3 21 14 10"/>' },
  { name: 'Recycling', Icon: Recycle, paths: '<path d="m8 6 3-4 5 8m0-5v5h-5m9 3 2 5H12m4 4-4-4 4-4M9 18H3l5-9M3 10l5-1 1 5"/>' },
  { name: 'Give and Get', Icon: Gift, paths: '<path d="M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8H8a3 3 0 1 1 3-3l1 3Zm0 0h4a3 3 0 1 0-3-3l-1 3Z"/>' },
  { name: 'Achievement', Icon: Award, paths: '<circle cx="12" cy="8" r="6"/><path d="m8 13-1 9 5-3 5 3-1-9"/>' },
];

async function resizeArtwork(source: Blob, name: string): Promise<File> {
  const url = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is unavailable in this browser.');
    const scale = Math.min(224 / image.width, 224 / image.height);
    const width = image.width * scale; const height = image.height * scale;
    ctx.drawImage(image, (256 - width) / 2, (256 - height) / 2, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Unable to prepare image.')), 'image/png'));
    return new File([blob], name, { type: 'image/png' });
  } finally { URL.revokeObjectURL(url); }
}

export function BadgeArtworkPicker({ hasImage, disabled, color, onChange, onBusyChange }: { hasImage: boolean; disabled: boolean; color: string; onChange: (file: File | null) => void; onBusyChange: (busy: boolean) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function prepare(source: Blob, name: string) {
    setError(''); setBusy(true); onBusyChange(true);
    try { const file = await resizeArtwork(source, name); if (mounted.current) onChange(file); }
    catch { if (mounted.current) setError('Unable to read this image. Choose another PNG, WebP, or JPEG file.'); }
    finally { if (mounted.current) { setBusy(false); onBusyChange(false); } }
  }
  function selectFile(file?: File) {
    if (!file || disabled || busy) return;
    if (!['image/png', 'image/webp', 'image/jpeg'].includes(file.type)) { setError('Choose a PNG, WebP, or JPEG image.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be 5 MB or smaller.'); return; }
    void prepare(file, 'badge-image.png');
  }
  return <fieldset className="space-y-3" disabled={disabled || busy}>
    <legend className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Badge image *</legend>
    <button type="button" onClick={() => input.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); selectFile(e.dataTransfer.files[0]); }} className="w-full flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-5 text-sm hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors disabled:opacity-60">
      {busy ? <Loader2 className="w-6 h-6 animate-spin text-green-600" /> : <UploadCloud className="w-6 h-6 text-green-600 dark:text-green-400" />}
      <span className="font-semibold">{busy ? 'Preparing image…' : hasImage ? 'Replace image' : 'Upload badge image'}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400">Click to select or drag and drop · PNG, WebP, JPEG · Max 5 MB</span>
    </button>
    <input ref={input} type="file" accept="image/png,image/webp,image/jpeg" className="hidden" onChange={e => { selectFile(e.target.files?.[0]); e.target.value = ''; }} />
    <div className="flex items-center justify-between gap-3"><p className="text-xs text-gray-500 dark:text-gray-400">Transparent PNG/WebP works best. Images resize to 256 × 256.</p>{hasImage && <button type="button" onClick={() => { onChange(null); setError(''); }} className="text-xs font-semibold text-red-600 dark:text-red-400 shrink-0">Remove image</button>}</div>
    <p className="text-sm font-medium">Or choose a built-in icon</p>
    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 104px), 1fr))' }}>{icons.map(({ name, Icon, paths }) => <button key={name} type="button" onClick={() => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="256" height="256" fill="none" stroke="${/^#[0-9a-f]{6}$/i.test(color) ? color : '#16A34A'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
      void prepare(new Blob([svg], { type: 'image/svg+xml' }), 'badge-icon.png');
    }} className="flex min-h-24 min-w-0 flex-col items-center justify-start gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-4 text-xs hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-950/20 transition-colors"><Icon className="w-6 h-6 shrink-0" style={{ color }} /><span className="w-full text-center leading-4 break-words">{name}</span></button>)}</div>
    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
  </fieldset>;
}
