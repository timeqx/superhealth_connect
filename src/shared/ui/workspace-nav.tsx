"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  LayoutDashboard,
  MessageCircle,
  UserRound,
  ShieldCheck,
} from "lucide-react";
export function WorkspaceNav({ staff = false }: { staff?: boolean }) {
  const path = usePathname();
  const links = staff
    ? [
        { href: "/admin", label: "Appointment requests", Icon: CalendarDays },
        { href: "/admin/reviews", label: "Account reviews", Icon: ShieldCheck },
        { href: "/patient", label: "My account", Icon: UserRound },
      ]
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
