import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "./button";
export function ButtonLink({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Button asChild variant={secondary ? "outline" : "default"}>
      <Link href={href}>{children}</Link>
    </Button>
  );
}
export function Card({
  children,
  soft = false,
  className = "",
}: {
  children: ReactNode;
  soft?: boolean;
  className?: string;
}) {
  return <section data-slot="card" className={`card ${soft ? "soft" : ""} ${className}`}>{children}</section>;
}
export function Badge({ children }: { children: ReactNode }) {
  return <span data-slot="badge" className="badge">{children}</span>;
}
export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  );
}
export function SetupNotice() {
  return (
    <Card>
      <h2>Online accounts are not connected yet</h2>
      <p>
        This local application needs Supabase configuration before you can sign
        in or access records. No appointment has been created.
      </p>
      <ButtonLink href="/preview/patient" secondary>
        Explore the synthetic preview
      </ButtonLink>
    </Card>
  );
}
