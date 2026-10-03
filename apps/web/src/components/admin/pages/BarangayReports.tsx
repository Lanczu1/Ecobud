import { useEffect, useState } from 'react';
import { adminGet, API_HOST } from '../../../utils/adminApi';
import { Reports as SystemReports } from './Reports';

type Report = {
  barangay: string | null; barangays: string[]; from: string; to: string; generatedAt: string; notes: string;
  sections: { title: string; metrics: Record<string, number> }[];
  announcements: { id: string; title: string; status: string; category: string; publishedAt: string }[];
};
const todayPht = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10);

export function Reports({ role }: { role?: 'admin' | 'moderator' } = {}) {
  const [isAdmin] = useState(() => {
    if (role) return role === 'admin';
    try { return JSON.parse(localStorage.getItem('ecobud_admin_user') || '{}').role === 'admin'; } catch { return false; }
  });
  const [system, setSystem] = useState(false);
  const [from, setFrom] = useState(() => `${todayPht().slice(0, 7)}-01`);
  const [to, setTo] = useState(todayPht);
  const [barangay, setBarangay] = useState('all');
  const [report, setReport] = useState<Report | null>(null);
  const [barangays, setBarangays] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [exporting, setExporting] = useState('');
  const [refresh, setRefresh] = useState(0);
  const params = new URLSearchParams({ from, to, ...(isAdmin ? { barangay } : {}) }).toString();

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(''); setReport(null); setExportError('');
    if (!from || !to || from > to) { setError('Choose a valid start and end date.'); setLoading(false); return; }
    adminGet<Report>(`/admin/reports/barangay?${params}`, { bypassCache: true })
      .then(data => { if (alive) { setReport(data); setBarangays(data.barangays); } })
      .catch(err => { if (alive) setError(err instanceof Error ? err.message : 'Could not load reports.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [params, refresh, from, to]);

  async function download(format: 'pdf' | 'excel') {
    if (!report || loading || exporting) return;
    setExporting(format); setExportError('');
    try {
      const response = await fetch(`${API_HOST}/api/admin/reports/barangay/${format}?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('ecobud_admin_token') || ''}` },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || 'Could not export report.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url; link.download = `ECOBUD-${report.barangay ?? 'All-Barangays'}-${report.from}-${report.to}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setExportError(err instanceof Error ? err.message : 'Could not export report.'); }
    finally { setExporting(''); }
  }

  const control = 'h-11 min-w-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-green-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
  const dateControl = `${control} w-full [color-scheme:light] dark:[color-scheme:dark]`;
  return <div className="min-h-full min-w-0 space-y-6 bg-gray-50/50 p-4 text-gray-900 sm:p-6 lg:p-8 dark:bg-transparent dark:text-gray-100">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-serif font-bold">Reports</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{isAdmin ? 'Review activity across barangays or select one barangay.' : 'Activity and reports for your assigned barangay.'}</p></div>
      {isAdmin && <button className={control} onClick={() => setSystem(!system)}>{system ? 'Barangay reports' : 'System overview'}</button>}
    </header>
    {system && isAdmin ? <SystemReports /> : <>
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid w-full min-w-0 gap-3 sm:w-auto sm:flex sm:flex-wrap sm:items-end">
        {isAdmin && <label className="grid min-w-0 gap-1.5 text-sm sm:w-52">Barangay<select className={`${control} w-full`} value={barangay} onChange={e => setBarangay(e.target.value)}><option value="all">All barangays</option>{barangays.map(name => <option key={name}>{name}</option>)}</select></label>}
        <div className="grid min-w-0 grid-cols-2 gap-3">
        <label className="grid min-w-0 gap-1.5 text-sm sm:w-44">From<input className={dateControl} type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} /></label>
        <label className="grid min-w-0 gap-1.5 text-sm sm:w-44">To<input className={dateControl} type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} /></label>
        </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <button className={control} onClick={() => setRefresh(value => value + 1)} disabled={loading}>Refresh</button>
        <button className={control} disabled={!report || loading || !!exporting} onClick={() => void download('pdf')}>{exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}</button>
        <button className={control} disabled={!report || loading || !!exporting} onClick={() => void download('excel')}>{exporting === 'excel' ? 'Exporting…' : 'Export Excel'}</button>
        </div>
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-300">Dates use Asia/Manila. Select up to 366 days. The default is this month.</p>
      </div>
      {loading && <p role="status" className="py-8">Loading barangay report…</p>}
      {error && <div role="alert" className="rounded-lg border border-red-300 p-4 text-red-800 dark:text-red-200">{error}<button className={`${control} ml-3`} onClick={() => setRefresh(value => value + 1)}>Retry</button></div>}
      {exportError && <p role="alert" className="text-red-800 dark:text-red-200">{exportError}</p>}
      {!loading && report && <>
        <p className="text-sm font-semibold">{report.barangay ? `Barangay ${report.barangay}` : 'All barangays'} · {report.from} to {report.to}</p>
        {report.sections.map(section => <section key={section.title} aria-label={section.title} className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-lg font-semibold">{section.title}</h2>
          <dl className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Object.entries(section.metrics).map(([label, value]) => <div key={label} className="min-w-0"><dt className="min-h-10 text-sm leading-5 text-gray-600 dark:text-gray-300">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-green-800 dark:text-green-300">{value.toLocaleString()}</dd></div>)}
          </dl>
          {section.title === 'Announcements' && <div className="mt-4">
            {report.announcements.length ? <ul className="divide-y divide-gray-200 dark:divide-gray-700">{report.announcements.map(item => <li key={item.id} className="py-3 break-words"><p className="font-medium">{item.title}</p><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{item.category} · {item.status} · {new Date(item.publishedAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}</p></li>)}</ul> : <p className="text-sm text-gray-600 dark:text-gray-300">No published announcements for this barangay in the selected period.</p>}
          </div>}
        </section>)}
        <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">{report.notes}</p>
        <p className="text-xs text-gray-600 dark:text-gray-300">Generated {new Date(report.generatedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</p>
      </>}
    </>}
  </div>;
}
