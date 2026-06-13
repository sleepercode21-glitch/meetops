export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-[linear-gradient(180deg,#e6f5ef_0,#f6f7f4_45%,#ffffff_100%)] p-4">
      <section className="w-full max-w-sm rounded-lg border border-zinc-200/80 bg-white/95 p-5 shadow-[0_20px_70px_rgba(16,24,20,0.12)]">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-teal-900 text-sm font-semibold text-white">
            TU
          </div>
          <div>
            <h1 className="text-xl font-semibold text-zinc-950">TechUp Sessions</h1>
            <p className="text-sm text-zinc-600">Sign in to coordinate.</p>
          </div>
        </div>
        {error ? (
          <div className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            Google sign in did not finish. Please try again.
          </div>
        ) : null}
        <a
          href="/api/auth/google/start"
          className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-teal-900 bg-teal-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-teal-800"
        >
          Continue with Google
        </a>
        <p className="mt-3 text-xs leading-5 text-zinc-500">
          Uses Google Calendar and Meet for scheduling.
        </p>
      </section>
    </main>
  );
}
