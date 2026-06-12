import Link from "next/link";
import { getCurrentUser } from "@/lib/web-api";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 sm:px-8">
          <Link href="/dashboard" className="text-sm font-semibold sm:text-base">
            TechUp Sessions
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden text-sm font-medium text-zinc-700 hover:text-zinc-950 sm:inline"
            >
              My Groups
            </Link>
            <form action="/api/auth/logout" method="post" className="hidden sm:block">
              <button
                type="submit"
                className="inline-flex min-h-10 items-center justify-center rounded-md border border-transparent bg-transparent px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
              >
                Sign out
              </button>
            </form>
            <Link
              href="/profile"
              aria-label="Profile"
              className="flex size-9 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white"
            >
              {currentUser.avatarInitials}
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-3 sm:px-8 sm:py-4">
        {children}
      </main>
    </div>
  );
}
