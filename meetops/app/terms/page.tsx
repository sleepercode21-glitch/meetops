import { ButtonLink } from "@/components/common/Buttons";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#e6f5ef_0,#f6f7f4_45%,#ffffff_100%)] px-4 py-10 text-zinc-950">
      <article className="mx-auto max-w-3xl rounded-lg border border-zinc-200/80 bg-white/95 p-6 shadow-[0_20px_70px_rgba(16,24,20,0.10)]">
        <div className="flex flex-col gap-4 border-b border-zinc-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-teal-900">TechUp Sessions</p>
            <h1 className="mt-2 text-3xl font-semibold">Terms of Service</h1>
            <p className="mt-2 text-sm text-zinc-600">Last updated June 12, 2026</p>
          </div>
          <ButtonLink href="/" tone="secondary">Home</ButtonLink>
        </div>

        <div className="mt-6 space-y-6 text-sm leading-6 text-zinc-700">
          <section>
            <h2 className="text-lg font-semibold text-zinc-950">Use of the Service</h2>
            <p className="mt-2">
              TechUp Sessions helps groups coordinate session topics, availability, final timing votes, Calendar invites,
              and Google Meet links. You agree to use the service only for lawful group coordination.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">Your Responsibilities</h2>
            <p className="mt-2">
              You are responsible for the content you post, including session titles, descriptions, poll options, and
              comments. Do not post harmful, unlawful, or misleading content.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">Google Services</h2>
            <p className="mt-2">
              When you connect Google, the app may create, update, or cancel Calendar events and Meet links on your behalf
              for sessions you host or manage. Your use of Google services is also governed by Google&apos;s terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">Availability</h2>
            <p className="mt-2">
              The service is provided as-is. We may change, pause, or discontinue features as the product evolves.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">Contact</h2>
            <p className="mt-2">
              For questions about these terms, contact the TechUp Sessions project owner.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
