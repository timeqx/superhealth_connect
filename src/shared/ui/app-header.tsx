"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { HeartPulse, Menu, ArrowUpRight } from "lucide-react";
import { Button } from "./button";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "./sheet";
const links = [["/patient", "Overview"], ["/patient/appointments", "Appointments"], ["/services", "Services"], ["/patient/inquiries", "Inquiries"]];
export function AppHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} onClick={() => setOpen(false)}>{label}</Link>);
  return <header className="site-header glass-surface">
    <div className="header-inner">
      <Link className="brand" href="/" aria-label="SuperHealth Connect home"><span className="brand-mark"><HeartPulse size={23} strokeWidth={1.8} /></span><span>SuperHealth<span className="brand-subtitle">CONNECT</span></span></Link>
      <nav className="navigation desktop-navigation" aria-label="Main navigation">{items}</nav>
      <div className="header-actions"><Button asChild variant="ghost" className="desktop-navigation"><Link href="/sign-in">Sign in <ArrowUpRight /></Link></Button>
        <Sheet open={open} onOpenChange={setOpen}><SheetTrigger asChild><Button variant="outline" className="mobile-menu" aria-label="Open navigation"><Menu /></Button></SheetTrigger>
          <SheetContent><SheetTitle>Where would you like to go?</SheetTitle><SheetDescription>Your care, connected.</SheetDescription><nav className="mobile-navigation" aria-label="Mobile navigation">{items}<Link href="/sign-in" onClick={() => setOpen(false)}>Sign in</Link><Link href="/admin" onClick={() => setOpen(false)}>Staff portal</Link></nav></SheetContent>
        </Sheet>
      </div>
    </div>
  </header>;
}
