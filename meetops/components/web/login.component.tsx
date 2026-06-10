import Link from "next/link";
import { ButtonLink } from "@/components/common/Buttons";

const steps = [
  "Join a group",
  "Host a session",
  "Collect votes",
  "Schedule the Meet",
];

export function LoginComponent() {
  return (
    <main className="h-screen overflow-hidden bg-zinc-50 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4 sm:px-8">
          <Link href="/" className="font-semibold">
            TechUp Sessions
          </Link>
          <ButtonLink href="/login" tone="secondary">
            Sign in
          </ButtonLink>
        </div>
      </header>
      <section className="mx-auto grid h-[calc(100vh-3rem)] max-w-5xl content-center gap-6 px-4 py-5 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-normal text-zinc-950 sm:text-5xl">
            Plan group sessions without WhatsApp chaos.
          </h1>
          <p className="mt-4 max-w-xl text-base text-zinc-600 sm:text-lg">
            Create a session, collect topic or timing votes, and schedule a Google
            Meet link for your private group.
          </p>
          <ButtonLink href="/api/auth/google/start" tone="primary" className="mt-5">
            Sign in with Google
          </ButtonLink>
        </div>
        <section>
          <h2 className="text-sm font-semibold uppercase text-zinc-500">
            How it works
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {steps.map((step, index) => (
              <div
                key={step}
                className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm"
              >
                <div className="text-xs font-medium text-zinc-500">
                  {index + 1}
                </div>
                <div className="mt-1 text-sm font-medium">{step}</div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
