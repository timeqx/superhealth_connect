import Link from "next/link";
export function pageNumber(value?: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(10000, Math.floor(parsed))) : 1;
}
export function Pagination({ page, count, size = 20, filters = {} }: { page: number; count: number; size?: number; filters?: Record<string, string> }) {
  const href = (value: number) => `?${new URLSearchParams({ ...filters, page: String(value) })}`;
  return <nav className="actions" aria-label="Results pages">{page > 1 && <Link href={href(page - 1)}>← Previous</Link>}<span>Page {page} · {count} results</span>{page * size < count && <Link href={href(page + 1)}>Next →</Link>}</nav>;
}
