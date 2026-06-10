import { AppShell } from "@/components/app-shell/AppShell";

export async function AuthenticatedPage({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
