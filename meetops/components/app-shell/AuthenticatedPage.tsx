import { AppShell } from "@/components/app-shell/AppShell";

export function AuthenticatedPage({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
