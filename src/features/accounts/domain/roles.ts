export type UserRole = "patient" | "staff" | "admin";

export function isUserRole(role: unknown): role is UserRole {
  return role === "patient" || role === "staff" || role === "admin";
}

export function isStaffRole(role: unknown): role is "staff" | "admin" {
  return role === "staff" || role === "admin";
}

const portalLinks = [
  { href: "/admin", label: "Requests", adminOnly: false },
  { href: "/admin/queue", label: "Queue", adminOnly: false },
  { href: "/admin/history", label: "History", adminOnly: true },
  { href: "/admin/inquiries", label: "Inquiries", adminOnly: false },
  { href: "/admin/reviews", label: "Accounts", adminOnly: true },
  { href: "/admin/staff", label: "Staff", adminOnly: true },
  { href: "/admin/schedules", label: "Schedules", adminOnly: true },
  { href: "/admin/reports", label: "Reports", adminOnly: false },
] as const;

export function staffPortalLinks(role: UserRole) {
  return portalLinks.filter(link => isStaffRole(role) && (!link.adminOnly || role === "admin"));
}
