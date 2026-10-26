import type { ReactNode } from "react";
import { AuthShell } from "@/shared/ui/auth-shell";

export default function AccountLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
