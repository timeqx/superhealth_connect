"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isStaffRole, staffPortalLinks, type UserRole } from "@/features/accounts/domain/roles";
import { navigationBadge, type PortalBadgeCounts } from "@/features/notifications/portal-badges";
import { NavigationBadge } from "./navigation-badge";
import {
  Bell,
  CalendarDays,
  LayoutDashboard,
  MessageCircle,
  UserRound,
} from "lucide-react";
export function WorkspaceNav({ role = "patient", counts }: { role?: UserRole; counts?: PortalBadgeCounts }) {
  const path = usePathname();
  const staff = isStaffRole(role);
  const links = staff
    ? staffPortalLinks(role).map(link => ({ ...link, Icon: link.href === "/admin/inquiries" ? MessageCircle : LayoutDashboard }))
    : [
        { href: "/patient", label: "Home", Icon: LayoutDashboard },
        {
          href: "/patient/appointments",
          label: "Appointments",
          Icon: CalendarDays,
        },
        { href: "/patient/inquiries", label: "Inquiries", Icon: MessageCircle },
        { href: "/patient/profile", label: "Profile", Icon: UserRound },
        { href: "/patient/notifications", label: "Notifications", Icon: Bell },
      ];
  return (
    <nav
      className="workspace-nav"
      aria-label={staff ? "Staff navigation" : "Patient navigation"}
    >
      {links.map(({ href, label, Icon }) => {
        const badge = navigationBadge(href, counts);
        return <Link
          key={href}
          href={href}
          aria-current={path === href ? "page" : undefined}
          aria-label={badge ? `${label}, ${badge.count} ${badge.description}` : undefined}
        >
          <Icon size={18} />
          <span className="navigation-label">{label}</span>
          {badge && <NavigationBadge {...badge} />}
        </Link>;
      })}
    </nav>
  );
}
