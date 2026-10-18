import type { CSSProperties } from 'react';

// Kept out of the admin pages so the app can show these while a page's code is still downloading.

/** The one placeholder block every admin skeleton is built from. */
export function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
  return <div aria-hidden="true" className={`animate-pulse bg-gray-200 dark:bg-gray-800 rounded ${className}`} style={style} />;
}

// Announced to screen readers only when standing alone; inside a page skeleton the page announces itself.
const statusProps = (label?: string) => label ? { role: 'status', 'aria-label': label } : {};

const CELL_WIDTHS = ['w-40', 'w-24', 'w-20', 'w-28', 'w-16', 'w-24', 'w-20', 'w-16', 'w-12'];

/** Table rows for a loading state; the one placeholder used wherever records are on their way. */
export function TableRowsSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return <>{Array.from({ length: rows }).map((_, row) => (
    <tr key={row} className="border-t border-gray-100 dark:border-gray-800">
      {Array.from({ length: columns }).map((_, column) => (
        <td key={column} className="px-5 py-4">
          {column === 0
            ? <div className="flex items-center gap-3"><Skeleton className="h-9 w-9 shrink-0 rounded-xl" /><div className="space-y-1.5"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-24" /></div></div>
            : <Skeleton className={`h-4 ${CELL_WIDTHS[column % CELL_WIDTHS.length]}`} />}
        </td>
      ))}
    </tr>
  ))}</>;
}

/** A table-shaped card with a header row and placeholder rows. bare drops the card when it sits inside one already. */
export function TableSkeleton({ rows = 5, columns = 4, label = 'Loading', bare = false }: { rows?: number; columns?: number; label?: string; bare?: boolean }) {
  return <div role="status" aria-label={label} className={bare ? 'overflow-hidden' : 'bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden'}>
    <table className="w-full">
      <thead><tr className="bg-gray-50/70 dark:bg-gray-800/40">
        {Array.from({ length: columns }).map((_, i) => <th key={i} className="px-5 py-3 text-left"><Skeleton className="h-3 w-20" /></th>)}
      </tr></thead>
      <tbody><TableRowsSkeleton rows={rows} columns={columns} /></tbody>
    </table>
  </div>;
}

/** A stat value while its figure loads, in place of a dash. */
export function StatSkeleton({ className = 'h-8 w-14' }: { className?: string }) {
  return <Skeleton className={`inline-block align-middle ${className}`} />;
}

/** Stat cards in a row while their figures load. */
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return <div className={`grid grid-cols-2 gap-4 ${count === 5 ? 'lg:grid-cols-5' : count === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-14" />
      </div>
    ))}
  </div>;
}

/** Image cards in a responsive grid, as on Events, Give and Get Hub and Redeem. */
export function CardGridSkeleton({ count = 6, label }: { count?: number; label?: string }) {
  return <div {...statusProps(label)} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <Skeleton className="h-32 w-full rounded-none" />
        <div className="p-5 space-y-3">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-full" />
          <div className="flex gap-2 pt-2"><Skeleton className="h-8 flex-1 rounded-xl" /><Skeleton className="h-8 flex-1 rounded-xl" /></div>
        </div>
      </div>
    ))}
  </div>;
}

/** Stacked rows, as on ID Verification and Announcements. */
export function RowListSkeleton({ count = 4, label }: { count?: number; label?: string }) {
  return <div {...statusProps(label)} className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm space-y-3">
        <div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/2" /></div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <Skeleton className="h-3 w-full" />
      </div>
    ))}
  </div>;
}

type PageSkeletonProps = {
  /** The page's real heading; a placeholder bar stands in when it is omitted. */
  title?: string;
  /** Omitted when the real subtitle depends on the account; a placeholder bar stands in. */
  subtitle?: string;
  stats?: number;
  action?: boolean;
  body: 'grid' | 'list' | 'table';
};

/** A whole admin page in its loading state: the real title, then placeholders laid out like the page. */
export function AdminPageSkeleton({ title, subtitle, stats = 4, action = false, body }: PageSkeletonProps) {
  return <div role="status" aria-label={`Loading ${title ?? 'page'}`} className="p-4 sm:p-8 space-y-6 bg-gray-50/50 min-h-full">
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        {title ? <h2 className="text-2xl font-serif font-bold text-gray-900 dark:text-white">{title}</h2> : <Skeleton className="h-7 w-48" />}
        {subtitle ? <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{subtitle}</p> : <Skeleton className="h-4 w-72 max-w-full mt-2" />}
      </div>
      {action && <Skeleton className="h-10 w-36 rounded-xl shrink-0" />}
    </div>
    {stats > 0 && <StatCardsSkeleton count={stats} />}
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 flex flex-wrap gap-3">
      <Skeleton className="h-10 flex-1 min-w-48 rounded-xl" />
      <Skeleton className="h-10 w-24 rounded-xl" />
      <Skeleton className="h-10 w-24 rounded-xl" />
    </div>
    {body === 'grid' ? <CardGridSkeleton /> : body === 'list' ? <RowListSkeleton /> : <TableSkeleton rows={6} columns={5} />}
  </div>;
}
