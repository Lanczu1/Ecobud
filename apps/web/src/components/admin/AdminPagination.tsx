interface AdminPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function AdminPagination({ page, totalPages, total, onPageChange }: AdminPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
      <span>{total.toLocaleString()} records · Page {page} of {totalPages}</span>
      <div className="flex gap-2">
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="rounded-lg border border-gray-200 px-3 py-1.5 font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
