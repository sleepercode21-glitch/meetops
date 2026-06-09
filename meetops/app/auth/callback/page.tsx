import { ButtonLink } from "@/components/common/Buttons";

export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <section className="rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
        <h1 className="text-lg font-semibold">Finishing sign in...</h1>
        <p className="mt-2 text-sm text-zinc-600">Demo mode is ready to continue to your dashboard.</p>
        <ButtonLink href="/dashboard" tone="primary" className="mt-5">Go to dashboard</ButtonLink>
      </section>
    </main>
  );
}
