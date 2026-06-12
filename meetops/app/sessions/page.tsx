import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { ButtonLink } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/States";
import { RealtimeSessionRefresh } from "@/components/sessions/RealtimeSessionRefresh";
import { SessionCard } from "@/components/sessions/SessionCard";
import { getAllUserSessions, getCurrentUser } from "@/lib/web-api";
import type { Session } from "@/types/domain";

const activeStatuses = new Set<Session["status"]>([
  "draft",
  "interest_check",
  "topic_selection",
  "availability_collection",
  "polling",
  "needs_host_decision",
  "scheduling",
  "scheduling_failed",
  "rescheduling",
  "scheduled",
]);

export default function SessionsPage() {
  return <SessionsList title="Active Sessions" subtitle="Sessions that still need planning, voting, scheduling, or attendance." filter="active" />;
}

export async function SessionsList({
  title,
  subtitle,
  filter,
}: {
  title: string;
  subtitle: string;
  filter: "active" | "hosted" | "upcoming" | "past";
}) {
  const [sessions, currentUser] = await Promise.all([
    getAllUserSessions(),
    getCurrentUser(),
  ]);
  const filtered = sessions
    .filter((session) => sessionMatchesFilter(session, filter, currentUser.id))
    .sort(sortSessions);

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader
          title={title}
          subtitle={subtitle}
          badge={<RealtimeSessionRefresh enabled intervalMs={3000} />}
          primaryAction={<ButtonLink href="/groups" tone="primary">Host from Group</ButtonLink>}
        />
        <Card>
          <div className="grid gap-3 text-sm text-zinc-600 md:grid-cols-4">
            <Summary label="Active" value={sessions.filter(isActiveSession).length} />
            <Summary label="Upcoming" value={sessions.filter(isUpcomingSession).length} />
            <Summary label="Hosted" value={sessions.filter((session) => session.hostId === currentUser.id && isActiveSession(session)).length} />
            <Summary label="Past" value={sessions.filter(isPastSession).length} />
          </div>
        </Card>
        {filtered.length ? (
          <div className="space-y-3">
            {filtered.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No sessions here"
            body="This view only shows sessions that match its lifecycle status."
            action={<ButtonLink href="/groups" tone="primary">Go to groups</ButtonLink>}
          />
        )}
      </div>
    </AuthenticatedPage>
  );
}

function sessionMatchesFilter(session: Session, filter: "active" | "hosted" | "upcoming" | "past", userId: string) {
  if (filter === "hosted") return session.hostId === userId && isActiveSession(session);
  if (filter === "upcoming") return isUpcomingSession(session);
  if (filter === "past") return isPastSession(session);
  return isActiveSession(session);
}

function isActiveSession(session: Session) {
  return activeStatuses.has(session.status);
}

function isPastSession(session: Session) {
  return session.status === "completed" || session.status === "cancelled";
}

function isUpcomingSession(session: Session) {
  return session.status === "scheduled";
}

function sortSessions(a: Session, b: Session) {
  const left = a.scheduledStartTime ? new Date(a.scheduledStartTime).getTime() : Number.MAX_SAFE_INTEGER;
  const right = b.scheduledStartTime ? new Date(b.scheduledStartTime).getTime() : Number.MAX_SAFE_INTEGER;
  if (left !== right) return left - right;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="text-lg font-semibold text-zinc-950">{value}</div>
      <div className="text-xs font-medium uppercase text-zinc-500">{label}</div>
    </div>
  );
}
