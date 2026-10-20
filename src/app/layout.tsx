import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
export const metadata: Metadata = {
  title: "SuperHealth Connect",
  description:
    "Appointments and visit updates for Batasan Hills Super Health Center. Development prototype.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <div className="header-inner">
            <Link className="brand" href="/">
              ✚ SuperHealth Connect
            </Link>
            <nav className="navigation" aria-label="Main navigation">
              <Link href="/patient">Overview</Link>
              <Link href="/patient/appointments">Appointments</Link>
              <Link href="/services">Services</Link>
              <Link href="/patient/inquiries">Inquiries</Link>
              <Link className="button secondary" href="/admin">
                Staff portal
              </Link>
            </nav>
          </div>
        </header>
        <main id="main" className="container">
          {children}
        </main>
        <footer className="footer">
          <p>
            Development prototype · Illustrative services and schedules, subject
            to center confirmation.
          </p>
          <Link href="/privacy">Privacy notice</Link>
          <Link href="/preview/patient">Synthetic patient preview</Link>
          <Link href="/preview/admin">Synthetic staff preview</Link>
        </footer>
      </body>
    </html>
  );
}
