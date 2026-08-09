export interface Pagination {
  limit: number;
  offset: number;
  page: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export function parsePagination(query: Record<string, unknown>): Pagination {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const requested = Number(query.limit ?? DEFAULT_PAGE_SIZE) || DEFAULT_PAGE_SIZE;
  const limit = Math.min(Math.max(1, requested), MAX_PAGE_SIZE);
  return { page, limit, offset: (page - 1) * limit };
}

export function parseIntOr(query: Record<string, unknown>, key: string, fallback: undefined | number = undefined): number | undefined {
  const raw = query[key];
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function parseBool(query: Record<string, unknown>, key: string): boolean | undefined {
  const raw = query[key];
  if (raw === undefined || raw === '') return undefined;
  return raw === 'true' || raw === '1';
}