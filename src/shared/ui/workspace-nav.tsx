"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isStaffRole, staffPortalLinks, type UserRole } from "@/features/accounts/domain/roles";
import {
  CalendarDays,
  LayoutDashboard,
  MessageCircle,
  UserRound,
} from "lucide-react";
export function WorkspaceNav({ role = "patient" }: { role?: UserRole }) {
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
      ];
  return (
    <nav
      className="workspace-nav"
      aria-label={staff ? "Staff navigation" : "Patient navigation"}
    >
      {links.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={path === href ? "page" : undefined}
        >
          <Icon size={18} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
