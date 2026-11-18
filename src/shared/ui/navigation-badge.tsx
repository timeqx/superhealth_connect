export function NavigationBadge({ count, description }: { count: number; description: string }) {
  return <span className="navigation-badge" aria-hidden="true" title={`${count} ${description}`}>{count}</span>;
}
