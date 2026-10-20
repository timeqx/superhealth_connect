import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { AppHeader } from "@/shared/ui/app-header";
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
        <AppHeader />
        <main id="main" className="container">
          {children}
        </main>
        <footer className="footer">
          <p>
            Development prototype · Illustrative services and schedules, subject
            to center confirmation.
          </p>
          <Link href="/privacy">Privacy notice</Link>
          <Link href="/admin">Staff portal</Link>
          <Link href="/preview/patient">Synthetic patient preview</Link>
          <Link href="/preview/admin">Synthetic staff preview</Link>
        </footer>
      </body>
    </html>
  );
}
