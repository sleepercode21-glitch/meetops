import { ButtonLink } from "@/components/common/Buttons";

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const failed = Boolean(error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
        {failed ? (
          <>
            <div className="mx-auto mb-4 flex size-10 items-center justify-center rounded-full bg-rose-50 text-rose-700">
              !
            </div>
            <h1 className="text-lg font-semibold">Sign in failed</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Google sign in could not be completed. This can happen if the
              request expired or the account is not allowed to test the app.
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <ButtonLink href="/login?error=google" tone="primary">
                Try again
              </ButtonLink>
              <ButtonLink href="/" tone="secondary">
                Back home
              </ButtonLink>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
            <h1 className="text-lg font-semibold">Finishing sign in...</h1>
            <p className="mt-2 text-sm text-zinc-600">
              Redirecting you into TechUp Sessions.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
