import type { ReactNode } from "react";
import {
  HeartPulse,
  ShieldCheck,
  CalendarCheck,
  MessageCircle,
} from "lucide-react";
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <aside className="auth-intro">
        <span className="icon-tile">
          <HeartPulse size={26} />
        </span>
        <p className="eyebrow">SUPERHEALTH CONNECT</p>
        <h2>
          Your care.
          <br />A little closer.
        </h2>
        <p>
          Make room for what matters. Manage your visits with a clear next step,
          wherever you are.
        </p>
        <ul className="auth-benefits">
          <li>
            <CalendarCheck size={20} />
            Request a visit that fits your day
          </li>
          <li>
            <MessageCircle size={20} />
            Keep your questions in one place
          </li>
          <li>
            <ShieldCheck size={20} />
            Share verification documents privately
          </li>
        </ul>
        <p className="caption">
          Batasan Hills Super Health Center
          <br />
          Development prototype · synthetic information only
        </p>
      </aside>
      <div className="auth-content stack">{children}</div>
    </div>
  );
}
