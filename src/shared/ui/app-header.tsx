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
];
export function AppHeader({ role = null, pending = false, unavailable = false }: {
  role?: "patient" | "admin" | null;
  pending?: boolean;
  unavailable?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const preview = pathname.startsWith("/preview/");
  const staffPreview = pathname === "/preview/admin";
  const staffHeader = role === "admin" || staffPreview;
  // Preview navigation changes presentation only; secure routes still check the actor.
  const links = staffPreview
    ? [["/preview/admin", "Staff overview"], ["/admin", "Appointment requests"], ["/admin/reviews", "Account reviews"]]
    : preview
    ? [["/preview/patient", "Patient overview"], ["/preview/booking", "Booking flow"], ["/preview/queue", "Patient queue"], ["/preview/admin", "Staff preview"]]
    : pending || unavailable ? [] : role === "patient" ? patientLinks : role === "admin"
    ? [["/admin", "Appointment requests"], ["/admin/queue", "Arrivals & queue"], ["/admin/inquiries", "Inquiries"], ["/admin/reviews", "Account reviews"]]
    : [["/services", "Services"], ["/patient/book", "Book a visit"]];
  const accountAction = role ? (
    <form action={signOut}><Button type="submit" variant="ghost">Sign out</Button></form>
  ) : pending ? (
    <span className="skeleton h-11 w-24" role="status" aria-label="Loading account" />
  ) : (
    <Button asChild variant="ghost"><Link href={unavailable ? (pathname.startsWith("/admin") ? "/admin" : "/patient") : "/sign-in"} onClick={() => setOpen(false)}>
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
        <Link className="brand" href={staffPreview ? "/preview/admin" : role === "admin" ? "/admin" : "/"} aria-label={staffHeader ? "SuperHealth staff workspace" : "SuperHealth Connect home"}>
          <span className="brand-mark">
            <HeartPulse size={23} strokeWidth={1.8} />
          </span>
          <span>
            SuperHealth<span className="brand-subtitle">{staffPreview ? "STAFF PREVIEW" : staffHeader ? "STAFF PORTAL" : preview ? "PATIENT PREVIEW" : "CONNECT"}</span>
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
                {!role && !pending && <Link href="/admin" onClick={() => setOpen(false)}>
                  Staff portal
                </Link>}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}


