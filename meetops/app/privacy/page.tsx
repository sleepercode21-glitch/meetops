import { ButtonLink } from "@/components/common/Buttons";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#e6f5ef_0,#f6f7f4_45%,#ffffff_100%)] px-4 py-10 text-zinc-950">
      <article className="mx-auto max-w-3xl rounded-lg border border-zinc-200/80 bg-white/95 p-6 shadow-[0_20px_70px_rgba(16,24,20,0.10)]">
        <div className="flex flex-col gap-4 border-b border-zinc-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-teal-900">TechUp Sessions</p>
            <h1 className="mt-2 text-3xl font-semibold">Privacy Policy</h1>
            <p className="mt-2 text-sm text-zinc-600">Last updated June 12, 2026</p>
          </div>
          <ButtonLink href="/" tone="secondary">Home</ButtonLink>
        </div>

        <div className="mt-6 space-y-6 text-sm leading-6 text-zinc-700">
          <section>
            <h2 className="text-lg font-semibold text-zinc-950">What We Collect</h2>
            <p className="mt-2">
              TechUp Sessions uses Google sign-in to identify you and coordinate group sessions. We may store your name,
              email address, profile image, group memberships, session comments, poll responses, and scheduling choices.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">Google Calendar Access</h2>
            <p className="mt-2">
              If you grant Calendar access, we use it only to create, update, or cancel Calendar events and Google Meet
              links for sessions you host or manage. We do not read your full calendar history for analytics or advertising.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">How We Use Data</h2>
            <p className="mt-2">
              We use your information to let you join groups, vote in polls, post session comments, schedule sessions, and
              send Calendar invitations. We do not sell your personal information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">Data Sharing</h2>
            <p className="mt-2">
              Session and group information is visible to other members of the relevant group. Calendar invites may share
              event title, description, time, attendees, and Meet link with invited participants through Google Calendar.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-zinc-950">Contact</h2>
            <p className="mt-2">
              For privacy questions or data deletion requests, contact the TechUp Sessions project owner.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
