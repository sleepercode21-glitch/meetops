import Link from "next/link";
import { getCurrentUser } from "@/lib/web-api";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const currentUser = await getCurrentUser();

  return (
    <div className="min-h-screen text-zinc-950">
      <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-8">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold sm:text-base">
            <span className="flex size-8 items-center justify-center rounded-lg bg-teal-900 text-xs font-semibold text-white">
              TU
            </span>
            <span>TechUp Sessions</span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="hidden rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 sm:inline"
            >
              My Groups
            </Link>
            <form action="/api/auth/logout" method="post" className="hidden sm:block">
              <button
                type="submit"
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-transparent bg-transparent px-3.5 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
              >
                Sign out
              </button>
            </form>
            <Link
              href="/profile"
              aria-label="Profile"
              className="flex size-9 items-center justify-center rounded-full bg-zinc-950 text-xs font-semibold text-white shadow-sm ring-2 ring-white"
            >
              {currentUser.avatarInitials}
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-8 sm:py-7">
        {children}
      </main>
    </div>
  );
}
