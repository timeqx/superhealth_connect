export type PortalBadgeCounts = {
  notifications: number;
  inquiries: number;
  requests: number;
  accounts: number;
};

export function parsePortalBadgeCounts(value: unknown): PortalBadgeCounts | undefined {
  if (!value || typeof value !== "object") return;
  const counts = value as Record<string, unknown>;
  const keys = ["notifications", "inquiries", "requests", "accounts"] as const;
  if (!keys.every(key => typeof counts[key] === "number" && Number.isSafeInteger(counts[key]) && counts[key] >= 0)) return;
  return Object.fromEntries(keys.map(key => [key, counts[key]])) as PortalBadgeCounts;
}

export function navigationBadge(href: string, counts?: PortalBadgeCounts) {
  if (!counts) return null;
  const badge = {
    "/patient/notifications": { count: counts.notifications, description: "unread notifications" },
    "/patient/inquiries": { count: counts.inquiries, description: "conversations with unread updates" },
    "/admin/inquiries": { count: counts.inquiries, description: "conversations with unread patient messages" },
    "/admin": { count: counts.requests, description: "requests awaiting a decision" },
    "/admin/reviews": { count: counts.accounts, description: "accounts awaiting a decision" },
  }[href];
  return badge && badge.count > 0 ? badge : null;
}
