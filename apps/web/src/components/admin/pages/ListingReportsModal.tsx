import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { adminGet } from '../../../utils/adminApi';
import { useModalScrollLock } from '../../../hooks/useModalScrollLock';
import { AdminPagination } from '../AdminPagination';

interface ReportPage {
  items: { id: string; account: string; reportName: string; reason: string; occurrences: number; createdAt: string; resolvedAt: string | null }[];
  activeCount: number;
  totalReports: number;
  pagination: { page: number; total: number; totalPages: number };
}

export function ListingReportsModal({ listing, onClose }: { listing: { id: string; title: string }; onClose: () => void }) {
  useModalScrollLock();
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);
  function close() {
    if (closingRef.current) return;
    closingRef.current = true;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { onCloseRef.current(); return; }
    setClosing(true);
    closeTimer.current = setTimeout(() => onCloseRef.current(), 300);
  }
  const closeActionRef = useRef(close);
  closeActionRef.current = close;
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [data, setData] = useState<ReportPage | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') closeActionRef.current(); };
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('keydown', escape); if (closeTimer.current) clearTimeout(closeTimer.current); previous?.focus(); };
  }, []);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    adminGet<ReportPage>(`/give-and-get/swap-listings/${listing.id}/reports?page=${page}&pageSize=25`, { bypassCache: true })
      .then(result => { if (alive) setData(result); })
      .catch(err => { if (alive) setError(err instanceof Error ? err.message : 'Could not load reports.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [listing.id, page, retry]);
  return createPortal(
    <div className={`listing-reports-overlay fixed inset-0 z-9999 flex items-center justify-center bg-black/60 p-4 ${closing ? 'animate-fade-out' : 'animate-fade-in'}`} onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby="listing-reports-title" className={`listing-reports-dialog flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-xl dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 ${closing ? 'animate-modal-exit' : 'animate-modal'}`} onClick={event => event.stopPropagation()} onKeyDown={event => {
        if (event.key !== 'Tab') return;
        const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input, select, textarea, [tabindex="0"]');
        const first = controls[0]; const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }}>
        <div className="border-b border-gray-200 p-5 dark:border-gray-700">
          <div className="flex items-start justify-between gap-3">
            <h2 id="listing-reports-title" className="text-lg font-bold">Listing Reports</h2>
            <button ref={closeRef} type="button" onClick={close} className="rounded-lg px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800">Close</button>
          </div>
          <p className="break-words text-sm text-gray-500 dark:text-gray-400">{listing.title}</p>
          {data && <p className="mt-2 text-sm font-semibold">{data.activeCount} active reports · {data.totalReports} total reports</p>}
        </div>
        <div className="overflow-y-auto p-5">
          {loading ? <p role="status">Loading reports…</p> : error ? <div role="alert"><p>{error}</p><button type="button" className="mt-3 rounded-lg border px-3 py-2" onClick={() => setRetry(value => value + 1)}>Try again</button></div> : data?.items.length ? <div className="space-y-3">
            {data.items.map(report => <article key={report.id} className="space-y-2 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{report.resolvedAt ? 'Resolved' : 'Awaiting review'} · {new Date(report.createdAt).toLocaleString()}</p>
              <dl className="space-y-2 text-sm">
                <div><dt className="font-semibold">Account:</dt><dd className="break-words">{report.account}</dd></div>
                <div><dt className="font-semibold">Report Name:</dt><dd>{report.reportName}</dd></div>
                <div><dt className="font-semibold">Reason:</dt><dd className="whitespace-pre-wrap break-words">{report.reason}</dd></div>
              </dl>
              {report.occurrences > 1 && <p className="text-xs text-gray-500 dark:text-gray-400">{report.occurrences} earlier reports were counted together. Individual accounts and reasons were not saved.</p>}
            </article>)}
          </div> : <p>No reports recorded for this listing.</p>}
        </div>
        {!loading && !error && data && <AdminPagination page={page} totalPages={data.pagination.totalPages} total={data.pagination.total} onPageChange={setPage} />}
      </div>
    </div>, document.body,
  );
}
