export interface AdminPaginationQuery {
  page: number;
  pageSize: number;
  skip: number;
}

export interface AdminPaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function parseAdminPagination(query: Record<string, unknown>): AdminPaginationQuery {
  const pageValue = Number(query.page ?? 1);
  const pageSizeValue = Number(query.pageSize ?? 25);
  const page = Number.isFinite(pageValue) ? Math.max(1, Math.floor(pageValue)) : 1;
  const pageSize = Number.isFinite(pageSizeValue)
    ? Math.min(100, Math.max(1, Math.floor(pageSizeValue)))
    : 25;

  return { page, pageSize, skip: (page - 1) * pageSize };
}

export function paginatedResult<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
): AdminPaginatedResult<T> {
  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}
