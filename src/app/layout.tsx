import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { AppHeader } from "@/shared/ui/app-header";
import { SessionHeader } from "@/shared/ui/session-header";
import { Suspense } from "react";
import { SnackbarProvider } from "@/shared/ui/snackbar";
import { ContentTransition } from "@/shared/ui/content-transition";
export const metadata: Metadata = {
  title: "SuperHealth Connect",
  description:
    "Appointments and visit updates for Batasan Hills Super Health Center.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SnackbarProvider>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Suspense fallback={<AppHeader pending />}>
          <SessionHeader />
        </Suspense>
        <main id="main" className="container">
          <ContentTransition excludeAuth>{children}</ContentTransition>
        </main>
        <footer className="footer">
          <Link href="/privacy">Privacy notice</Link>
          <Link href="/admin">Staff portal</Link>
          <p>Batasan Hills Super Health Center</p>
        </footer>
        </SnackbarProvider>
      </body>
    </html>
  );
}
