import Link from "next/link";
import { currentUser, groups } from "@/lib/mock-data";
import { ButtonLink } from "@/components/common/Buttons";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/groups", label: "Groups" },
  { href: "/sessions/hosted", label: "My Hosted Sessions" },
  { href: "/sessions/upcoming", label: "Upcoming Sessions" },
  { href: "/sessions/past", label: "Past Sessions" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const currentGroup = groups[0];
  const isAdmin = currentGroup.role === "admin";

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="lg:grid lg:grid-cols-[260px_1fr]">
        <aside className="hidden min-h-screen border-r border-zinc-200 bg-white lg:flex lg:flex-col">
          <div className="border-b border-zinc-200 p-5">
            <div className="text-lg font-semibold">TechUp Sessions</div>
            <div className="text-sm text-zinc-500">Community scheduling</div>
          </div>
          <nav className="space-y-1 p-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="border-y border-zinc-200 p-4">
            <div className="text-xs font-medium uppercase text-zinc-500">Current group</div>
            <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <div className="text-sm font-medium">{currentGroup.name}</div>
              <Link href="/groups/join" className="mt-1 block text-sm text-blue-700">
                Join group
              </Link>
            </div>
          </div>
          {isAdmin ? (
            <div className="border-b border-zinc-200 p-3">
              <div className="px-3 py-2 text-xs font-medium uppercase text-zinc-500">
                Admin
              </div>
              <Link
                href={`/groups/${currentGroup.id}/settings`}
                className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Group Settings
              </Link>
              <Link
                href={`/groups/${currentGroup.id}/members`}
                className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Members
              </Link>
              <Link
                href={`/groups/${currentGroup.id}/audit-log`}
                className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
              >
                Audit Log
              </Link>
            </div>
          ) : null}
          <div className="mt-auto border-t border-zinc-200 p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                {currentUser.avatarInitials}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{currentUser.name}</div>
                <div className="truncate text-xs text-zinc-500">{currentUser.timezone}</div>
              </div>
            </div>
            <ButtonLink href="/" tone="ghost" className="mt-3 w-full">
              Sign out
            </ButtonLink>
          </div>
        </aside>
        <div className="min-w-0">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 lg:hidden">
            <Link href="/dashboard" className="font-semibold">
              TechUp Sessions
            </Link>
            <Link href="/profile" className="flex size-9 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
              {currentUser.avatarInitials}
            </Link>
          </header>
          <main className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
          <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-zinc-200 bg-white lg:hidden">
            {[
              ["Dashboard", "/dashboard"],
              ["Sessions", "/sessions"],
              ["Groups", "/groups"],
              ["Hosted", "/sessions/hosted"],
              ["Profile", "/profile"],
            ].map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="px-1 py-3 text-center text-xs font-medium text-zinc-700"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
