// Kept out of the report pages so the app can show these while that code is still downloading.
import { Skeleton } from './PageSkeletons';

// Fixed heights so the placeholder bars do not jump on every render.
const BAR_HEIGHTS = [55, 80, 40, 95, 65, 75, 50];

export function KpiCardsSkeleton() {
  return <>{Array.from({ length: 4 }).map((_, i) => (
    <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
      <div className="flex justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="w-11 h-11 rounded-xl" />
      </div>
      <Skeleton className="h-4 w-32" />
    </div>
  ))}</>;
}

export function BarChartSkeleton() {
  return <div className="flex items-end gap-3 h-40 pt-4">
    {BAR_HEIGHTS.map((height, i) => <Skeleton key={i} className="flex-1 rounded-t-lg" style={{ height: `${height}%` }} />)}
  </div>;
}

export function SummaryRowsSkeleton() {
  return <>{Array.from({ length: 7 }).map((_, i) => (
    <tr key={i}>
      <td className="px-6 py-3.5"><Skeleton className="h-4 w-32" /></td>
      <td className="px-4 py-3.5"><Skeleton className="h-4 w-12" /></td>
      <td className="px-4 py-3.5"><Skeleton className="h-4 w-12" /></td>
    </tr>
  ))}</>;
}

export function OverviewCardsSkeleton() {
  return <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-3 w-36" />
      </div>
    ))}
  </div>;
}

/** The admin Reports & Analytics page while its code or data loads. */
export function SystemReportsPageSkeleton() {
  const chartCard = <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
    <div className="mb-6 space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-20" /></div>
    <BarChartSkeleton />
  </div>;
  return <div role="status" aria-label="Loading reports" className="p-8 space-y-6 bg-gray-50/50 min-h-full">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-serif font-bold text-gray-900">Reports & Analytics</h2>
        <p className="text-gray-500 text-sm mt-1">Platform-wide performance metrics and insights</p>
      </div>
      <Skeleton className="h-10 w-40 rounded-xl" />
    </div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-5"><KpiCardsSkeleton /></div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">{chartCard}{chartCard}</div>
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-gray-50 space-y-2"><Skeleton className="h-5 w-48" /><Skeleton className="h-3 w-40" /></div>
      <table className="w-full"><tbody><SummaryRowsSkeleton /></tbody></table>
    </div>
    <OverviewCardsSkeleton />
  </div>;
}

/** The barangay report sections while they load, shaped like the real metric cards. */
export function BarangayReportSkeleton() {
  return <div role="status" aria-label="Loading barangay report" className="space-y-6">
    <Skeleton className="h-4 w-64" />
    {[3, 1, 5, 4].map((metrics, i) => (
      <div key={i} className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 dark:border-gray-700 dark:bg-gray-900">
        <Skeleton className="h-5 w-44" />
        <div className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: metrics }).map((_, j) => <div key={j} className="space-y-2"><Skeleton className="h-4 w-48 max-w-full" /><Skeleton className="h-7 w-16" /></div>)}
        </div>
      </div>
    ))}
  </div>;
}

/** The moderator's barangay Reports page while its code loads. */
export function BarangayReportsPageSkeleton() {
  return <div className="min-h-full min-w-0 space-y-6 bg-gray-50/50 p-4 text-gray-900 sm:p-6 lg:p-8 dark:bg-transparent dark:text-gray-100">
    <header><h1 className="text-2xl font-serif font-bold">Reports</h1><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">Activity and reports for your assigned barangay.</p></header>
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid grid-cols-2 gap-3"><Skeleton className="h-11 w-full sm:w-44" /><Skeleton className="h-11 w-full sm:w-44" /></div>
        <div className="flex gap-2"><Skeleton className="h-11 w-20" /><Skeleton className="h-11 w-24" /><Skeleton className="h-11 w-28" /></div>
      </div>
      <Skeleton className="h-3 w-72 max-w-full" />
    </div>
    <BarangayReportSkeleton />
  </div>;
}
