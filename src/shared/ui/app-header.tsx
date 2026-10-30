"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { HeartPulse, Menu, ArrowUpRight } from "lucide-react";
import { Button } from "./button";
import { signOut } from "@/features/accounts/application/auth-actions";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "./sheet";
const patientLinks = [
  ["/patient", "Overview"],
  ["/patient/appointments", "Appointments"],
  ["/services", "Services"],
  ["/patient/inquiries", "Inquiries"],
  ["/patient/profile", "Profile"],
  ["/patient/notifications", "Notifications"],
];
export function AppHeader({ role = null, pending = false, unavailable = false }: {
  role?: "patient" | "admin" | null;
  pending?: boolean;
  unavailable?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const staffHeader = role === "admin";
  const links = pending || unavailable ? [] : role === "patient" ? patientLinks : role === "admin"
    ? [["/admin", "Requests"], ["/admin/queue", "Queue"], ["/admin/history", "History"], ["/admin/inquiries", "Inquiries"], ["/admin/reviews", "Accounts"], ["/admin/schedules", "Schedules"], ["/admin/reports", "Reports"]]
    : [["/services", "Services"], ["/patient/book", "Book a visit"], ["/staff/sign-in", "Staff portal"]];
  const accountAction = role ? (
    <form action={signOut}><Button type="submit" variant="ghost">Sign out</Button></form>
  ) : pending ? (
    <span className="skeleton h-11 w-24" role="status" aria-label="Loading account" />
  ) : (
    <Button asChild variant="ghost"><Link href={unavailable ? (pathname.startsWith("/admin") ? "/admin" : "/patient") : pathname.startsWith("/staff/") ? "/staff/sign-in" : "/sign-in"} onClick={() => setOpen(false)}>
      {unavailable ? "My account" : "Sign in"} <ArrowUpRight />
    </Link></Button>
  );
  const items = links.map(([href, label]) => (
    <Link
      key={href}
      href={href}
      aria-current={pathname === href ? "page" : undefined}
      onClick={() => setOpen(false)}
    >
      {label}
    </Link>
  ));
  return (
    <header className="site-header glass-surface">
      <div className="header-inner">
        <Link className="brand" href={role === "admin" ? "/admin" : "/"} aria-label={staffHeader ? "SuperHealth staff workspace" : "SuperHealth Connect home"}>
          <span className="brand-mark">
            <HeartPulse size={23} strokeWidth={1.8} />
          </span>
          <span>
            SuperHealth<span className="brand-subtitle">{staffHeader ? "STAFF PORTAL" : "CONNECT"}</span>
          </span>
        </Link>
        <nav
          className="navigation desktop-navigation"
          aria-label="Main navigation"
        >
          {items}
        </nav>
        <div className="header-actions">
          <div className="desktop-navigation">{accountAction}</div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="mobile-menu"
                aria-label="Open navigation"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle>Where would you like to go?</SheetTitle>
              <SheetDescription>{staffHeader ? "Manage appointment requests and account reviews." : "Your care, connected."}</SheetDescription>
              <nav className="mobile-navigation" aria-label="Mobile navigation">
                {items}
                {accountAction}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}


