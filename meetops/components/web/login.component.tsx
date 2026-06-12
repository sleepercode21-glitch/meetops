import { ButtonLink } from "@/components/common/Buttons";

export function LoginComponent() {
  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(180deg,#e6f5ef_0,#f6f7f4_48%,#ffffff_100%)] p-4 text-zinc-950">
      <section className="w-full max-w-lg rounded-lg border border-zinc-200/80 bg-white/95 p-6 shadow-[0_20px_70px_rgba(16,24,20,0.12)]">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-teal-900 text-sm font-semibold text-white">TU</div>
          <div>
            <h1 className="text-2xl font-semibold">TechUp Sessions</h1>
            <p className="text-sm text-zinc-600">Plan group sessions without chat chaos.</p>
          </div>
        </div>
        <p className="mt-5 text-sm leading-6 text-zinc-600">
          Join a group, vote on topic and time, then create the Calendar invite and Meet link from the winning slot.
        </p>
        <ButtonLink href="/api/auth/google/start" tone="primary" className="mt-5 w-full">
          Continue with Google
        </ButtonLink>
      </section>
    </main>
  );
}
