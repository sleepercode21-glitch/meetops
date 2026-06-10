import { ButtonLink } from "@/components/common/Buttons";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex h-screen items-center justify-center overflow-hidden bg-zinc-50 p-4">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-zinc-950 text-sm font-semibold text-white">
          TS
        </div>
        <h1 className="text-xl font-semibold">TechUp Sessions</h1>
        <p className="mt-1 text-sm text-zinc-600">Sign in to continue.</p>
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
