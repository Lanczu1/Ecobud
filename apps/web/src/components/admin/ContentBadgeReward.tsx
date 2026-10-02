import { useEffect, useState } from 'react';
import { Award } from 'lucide-react';
import { adminGet, adminPostForm } from '../../utils/adminApi';
import { BadgeArtworkPicker } from './pages/BadgeArtworkPicker';

export type BadgeRewardPayload = { enabled: boolean; name?: string; description?: string; iconUrl?: string; accentColor?: string };
type RewardDetails = { name: string; description: string; iconUrl: string; accentColor: string; active?: boolean };
const empty: RewardDetails = { name: '', description: '', iconUrl: '', accentColor: '#16A34A' };
const fieldStyle = 'mt-1 w-full px-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-green-200 dark:focus:ring-green-800';

export function useContentBadgeReward(type: 'lesson' | 'challenge' | 'event' | 'exchange', sourceId?: string, allowed = true) {
  const [details, setDetails] = useState<RewardDetails>(empty);
  const [original, setOriginal] = useState<RewardDetails | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(!!sourceId && allowed);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let current = true;
    if (!sourceId || !allowed) return;
    setLoading(true); setError('');
    adminGet<{ badge: RewardDetails | null }>(`/admin/badges/source/${type}/${sourceId}`, { bypassCache: true }).then(({ badge }) => {
      if (!current) return;
      setOriginal(badge); setDetails(badge ? { ...badge, accentColor: badge.accentColor || '#16A34A' } : empty); setEnabled(!!badge?.active);
    }).catch(e => { if (current) setError(e.message || 'Unable to load badge reward.'); }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [type, sourceId, allowed, reload]);
  useEffect(() => {
    if (!file) { setPreview(''); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function prepare(): Promise<BadgeRewardPayload | undefined> {
    if (!allowed) return undefined;
    if (loading || processing) throw new Error('Wait for the badge image and reward to finish loading.');
    if (error) throw new Error('Retry loading the badge reward before saving.');
    if (!enabled) return original ? { ...original, enabled: false } : { enabled: false };
    if (!details.name.trim() || !details.description.trim() || (!file && !details.iconUrl)) throw new Error('Complete the badge name, image, and short description, or turn off the optional badge.');
    let iconUrl = details.iconUrl;
    if (file) {
      const data = new FormData(); data.append('image', file);
      iconUrl = (await adminPostForm<{ url: string }>('/admin/badges/upload', data)).url;
      setDetails(value => ({ ...value, iconUrl })); setFile(null);
    }
    return { enabled: true, name: details.name.trim(), description: details.description.trim(), iconUrl, accentColor: details.accentColor };
  }
  return { allowed, details, setDetails, enabled, setEnabled, file, setFile, preview, processing, setProcessing, loading, error, retry: () => setReload(value => value + 1), prepare };
}

export function ContentBadgeReward({ reward, disabled = false }: { reward: ReturnType<typeof useContentBadgeReward>; disabled?: boolean }) {
  if (!reward.allowed) return null;
  const { details, setDetails } = reward;
  return <section className="space-y-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 p-5">
    <label className="flex items-center gap-3 text-sm font-semibold text-gray-800 dark:text-gray-200"><input type="checkbox" checked={reward.enabled} disabled={disabled || reward.loading || !!reward.error} onChange={e => reward.setEnabled(e.target.checked)} className="h-4 w-4 accent-green-600" />Badge reward (optional)</label>
    <p className="text-xs text-gray-500 dark:text-gray-400">Saved with this activity and synced to Badges. Earned badges stay with residents when this reward is turned off.</p>
    {reward.loading && <p role="status" className="text-sm text-gray-500">Loading badge reward…</p>}
    {reward.error && <p role="alert" className="text-sm text-red-600">{reward.error} <button type="button" onClick={reward.retry} className="underline">Retry</button></p>}
    {reward.enabled && !reward.loading && <fieldset disabled={disabled} className="space-y-4">
      <label className="block text-sm text-gray-700 dark:text-gray-300">Badge Name *<input maxLength={80} value={details.name} onChange={e => setDetails({ ...details, name: e.target.value })} className={fieldStyle} placeholder="e.g. Waste Wise" /></label>
      <BadgeArtworkPicker hasImage={!!reward.file || !!details.iconUrl} disabled={disabled} color={details.accentColor} onBusyChange={reward.setProcessing} onChange={file => { reward.setFile(file); setDetails(current => ({ ...current, iconUrl: '' })); }} />
      <label className="block text-sm text-gray-700 dark:text-gray-300">Short description *<textarea maxLength={500} rows={2} value={details.description} onChange={e => setDetails({ ...details, description: e.target.value })} className={fieldStyle} placeholder="What did the resident accomplish?" /></label>
      <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">Accent color<input type="color" value={details.accentColor} onChange={e => setDetails({ ...details, accentColor: e.target.value })} className="h-9 w-14" /></label>
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4"><div className="flex h-14 w-14 shrink-0 items-center justify-center">{reward.preview || details.iconUrl ? <img src={reward.preview || details.iconUrl} alt="Badge preview" className="h-14 w-14 object-contain" /> : <Award className="h-10 w-10" style={{ color: details.accentColor }} />}</div><div className="min-w-0"><p className="font-semibold text-gray-900 dark:text-white break-words">{details.name || 'Badge preview'}</p><p className="text-xs text-gray-500 dark:text-gray-400 break-words">{details.description || 'Complete this activity to earn this badge.'}</p></div></div>
    </fieldset>}
  </section>;
}
