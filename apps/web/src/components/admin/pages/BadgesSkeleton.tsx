// Kept out of Badges.tsx so the app can show it while that page's code is still downloading.

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 dark:bg-gray-800 rounded ${className}`} />;
}

export function BadgeCountSkeleton() {
  return <Skeleton className="h-4 w-44" />;
}

export function BadgeListSkeleton() {
  return <div role="status" aria-label="Loading badges" className="space-y-3">
    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 dark:bg-gray-900 dark:border-gray-700">
      <Skeleton className="h-20 w-20 rounded-xl" />
      <div className="min-w-0 flex-1 basis-48 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-full max-w-md" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-8 w-16 rounded-xl" />
      <div className="flex gap-2"><Skeleton className="h-8 w-16 rounded-xl" /><Skeleton className="h-8 w-10 rounded-xl" /></div>
    </div>)}
  </div>;
}

/** The whole Badges page in its loading state, laid out like the real page so nothing jumps when it arrives. */
export function BadgesPageSkeleton() {
  return <div className="min-h-full bg-gray-50/50 p-4 sm:p-8 space-y-6 dark:bg-gray-950 dark:text-white">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><h2 className="text-2xl font-serif font-bold text-gray-900 dark:text-white">Badges</h2><p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage the rewards residents earn for their eco activities.</p></div>
      <Skeleton className="h-10 w-36 rounded-xl" />
    </div>
    <Skeleton className="h-4 w-full max-w-2xl" />
    <div className="flex flex-wrap items-center justify-between gap-3"><Skeleton className="h-11 w-full sm:max-w-sm rounded-xl" /><BadgeCountSkeleton /></div>
    <BadgeListSkeleton />
  </div>;
}
