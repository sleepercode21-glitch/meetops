import { ButtonLink } from "@/components/common/Buttons";

const features = [
  "Topic and timing polls",
  "Google Meet link generation",
  "Calendar invites when needed",
  "Host/admin decision handling",
];

export function LoginComponent() {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-950">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-8">
          <div>
            <p className="text-sm font-medium uppercase text-zinc-500">
              TechUp Sessions
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-normal text-zinc-950 sm:text-5xl">
              Coordinate community sessions without WhatsApp chaos.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-zinc-600">
              Create sessions, collect topic ideas, vote on times, and generate Google
              Meet links from one shared workflow.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {features.map((feature) => (
              <div
                key={feature}
                className="rounded-lg border border-zinc-200 bg-white p-4 text-sm font-medium shadow-sm"
              >
                {feature}
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex size-12 items-center justify-center rounded-lg bg-zinc-950 text-lg font-semibold text-white">
            TS
          </div>
          <h2 className="text-xl font-semibold">Sign in to TechUp Sessions</h2>
          <p className="mt-2 text-sm text-zinc-600">
            Google is used for login and Calendar event creation. Tokens are never
            shown in the browser.
          </p>
          <ButtonLink
            href="/api/auth/google/start"
            tone="primary"
            className="mt-6 w-full"
          >
            Continue with Google
          </ButtonLink>
          <p className="mt-4 text-xs text-zinc-500">
            Google will ask for Calendar event permission so the app can create Meet links.
          </p>
        </section>
      </div>
    </main>
  );
}
