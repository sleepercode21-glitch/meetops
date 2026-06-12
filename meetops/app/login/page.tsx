import { ButtonLink } from "@/components/common/Buttons";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex h-screen items-center justify-center overflow-hidden bg-[linear-gradient(180deg,#e6f5ef_0,#f6f7f4_48%,#ffffff_100%)] p-4">
      <section className="w-full max-w-md rounded-lg border border-zinc-200/80 bg-white/95 p-6 shadow-[0_20px_70px_rgba(16,24,20,0.12)]">
        <div className="mb-5 flex size-11 items-center justify-center rounded-lg bg-teal-900 text-sm font-semibold text-white">
          TU
        </div>
        <h1 className="text-2xl font-semibold text-zinc-950">TechUp Sessions</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">Coordinate group sessions, decide timing, and create Meet links without admin clutter.</p>
        {error ? (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            Google sign in did not finish. Please try again.
          </div>
        ) : null}
        <ButtonLink
          href="/api/auth/google/start"
          tone="primary"
          className="mt-5 w-full"
        >
          Continue with Google
        </ButtonLink>
        <p className="mt-4 text-sm text-zinc-500">
          You need a Google account because sessions use Google Calendar and Meet.
        </p>
      </section>
    </main>
  );
}
