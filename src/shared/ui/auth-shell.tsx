"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ContentTransition } from "./content-transition";
import {
  HeartPulse,
  ShieldCheck,
  CalendarCheck,
  MessageCircle,
} from "lucide-react";
export function AuthShell({ children }: { children: ReactNode }) {
  const staff = usePathname().startsWith("/staff/");
  return (
    <div className="auth-layout">
      <aside className="auth-intro">
        <span className="icon-tile">
          <HeartPulse size={26} />
        </span>
        <p className="eyebrow">{staff ? "SUPERHEALTH STAFF PORTAL" : "SUPERHEALTH CONNECT"}</p>
        <h2>
          {staff ? "Care starts" : "Your care."}
          <br />{staff ? "with your team." : "A little closer."}
        </h2>
        <p>
          {staff ? "Your workspace for coordinating visits, reviewing patient accounts, and keeping the center running smoothly." : "Make room for what matters. Manage your visits with a clear next step, wherever you are."}
        </p>
        <ul className="auth-benefits">
          <li>
            <CalendarCheck size={20} />
            {staff ? "Manage appointments and daily queues" : "Request a visit that fits your day"}
          </li>
          <li>
            <MessageCircle size={20} />
            {staff ? "Respond to patient inquiries" : "Keep your questions in one place"}
          </li>
          <li>
            <ShieldCheck size={20} />
            {staff ? "Review patient verification securely" : "Share verification documents privately"}
          </li>
        </ul>
        <p className="caption">
          Batasan Hills Super Health Center

        </p>
      </aside>
      <ContentTransition className="auth-content stack">{children}</ContentTransition>
    </div>
  );
}
