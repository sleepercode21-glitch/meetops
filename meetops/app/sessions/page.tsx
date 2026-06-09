import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { ButtonLink } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { SessionCard } from "@/components/sessions/SessionCard";
import { sessions } from "@/lib/mock-data";

export default function SessionsPage() {
  return <SessionsList title="Sessions" subtitle="Browse sessions across your groups." filter="all" />;
}

export function SessionsList({
  title,
  subtitle,
  filter,
}: {
  title: string;
  subtitle: string;
  filter: "all" | "hosted" | "upcoming" | "past";
}) {
  const filtered = sessions.filter((session) => {
    if (filter === "hosted") return session.hostId === "u1";
    if (filter === "upcoming") return session.status === "scheduled";
    if (filter === "past") return ["completed", "cancelled"].includes(session.status);
    return true;
  });

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader
          title={title}
          subtitle={subtitle}
          primaryAction={<ButtonLink href="/sessions/new" tone="primary">Create session</ButtonLink>}
        />
        <Card>
          <div className="grid gap-3 md:grid-cols-5">
            <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" placeholder="Search by topic" />
            <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm"><option>All groups</option></select>
            <select className="rounded-md border border-zinc-300 px-3 py-2 text-sm"><option>All statuses</option></select>
            <input className="rounded-md border border-zinc-300 px-3 py-2 text-sm" type="date" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" /> Hosted by me</label>
          </div>
        </Card>
        <div className="space-y-3">
          {filtered.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      </div>
    </AuthenticatedPage>
  );
}
