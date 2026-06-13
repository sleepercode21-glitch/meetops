import { redirect } from "next/navigation";
import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { RoleBadge } from "@/components/common/Badge";
import { ButtonLink } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { auditActionLabels, pollTypeLabels, sessionStatusLabels } from "@/lib/labels";
import {
  ApiRequestError,
  getGroupDetail,
  getGroupHistory,
  groupRole,
  type ApiGroupHistorySession,
} from "@/lib/web-api";

export default async function GroupHistoryPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const { group, history } = await getHistoryData(groupId);
  const role = groupRole(group.current_user_membership.is_admin);
  const pollCount = history.reduce((sum, session) => sum + session.polls.length, 0);
  const commentCount = history.reduce((sum, session) => sum + session.comment_count, 0);

  return (
    <AuthenticatedPage>
      <div className="space-y-5">
        <PageHeader
          title="History"
          subtitle={`${history.length} sessions, ${pollCount} polls, ${commentCount} comments for ${group.name}.`}
          badge={<RoleBadge role={role} />}
          primaryAction={<ButtonLink href={`/groups/${groupId}/sessions/new`} tone="primary">Host Session</ButtonLink>}
        />
        <GroupTabs groupId={groupId} role={role} active="history" />

        <div className="space-y-4">
          {history.length ? history.map((session) => (
            <SessionHistoryCard key={session.session_id} session={session} />
          )) : (
            <Card>
              <p className="text-sm text-zinc-600">No session history yet.</p>
            </Card>
          )}
        </div>
      </div>
    </AuthenticatedPage>
  );
}

async function getHistoryData(groupId: string) {
  try {
    const [group, history] = await Promise.all([
      getGroupDetail(groupId),
      getGroupHistory(groupId),
    ]);
    return { group, history };
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      (error.status === 403 || error.status === 404)
    ) {
      redirect("/groups");
    }
    throw error;
  }
}

function SessionHistoryCard({ session }: { session: ApiGroupHistorySession }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-zinc-100 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-950">{session.topic ?? "Untitled session"}</h2>
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600">
                {sessionStatusLabels[session.status] ?? session.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-600">{session.description ?? `Hosted by ${session.host_name}`}</p>
          </div>
          <ButtonLink href={`/sessions/${session.session_id}`} className="w-full sm:w-auto">
            Open Session
          </ButtonLink>
        </div>
      </div>
      <div className="p-4">
        <div className="relative space-y-4 before:absolute before:left-3 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-zinc-200">
          {session.timeline.map((item) => (
            <div key={item.id} className="relative flex gap-3">
              <span className={`z-10 mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${timelineTone(item.kind)}`}>
                {timelineIcon(item.kind)}
              </span>
              <div className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white p-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <h3 className="font-medium text-zinc-950">{timelineTitle(item)}</h3>
                  <time className="text-xs text-zinc-500">{relativeTime(item.at)}</time>
                </div>
                {item.body ? <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600">{item.body}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function GroupTabs({
  groupId,
  role,
  active,
}: {
  groupId: string;
  role: "admin" | "member";
  active: "sessions" | "members" | "history" | "settings";
}) {
  return (
    <div className="flex gap-2 border-b border-zinc-200 text-sm">
      <Tab href={`/groups/${groupId}`} active={active === "sessions"}>Sessions</Tab>
      <Tab href={`/groups/${groupId}/members`} active={active === "members"}>Members</Tab>
      <Tab href={`/groups/${groupId}/history`} active={active === "history"}>History</Tab>
      {role === "admin" ? (
        <Tab href={`/groups/${groupId}/settings`} active={active === "settings"}>Settings</Tab>
      ) : null}
    </div>
  );
}

function Tab({
  href,
  active = false,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <ButtonLink
      href={href}
      tone="ghost"
      className={`rounded-b-none border-x-0 border-t-0 px-2.5 ${active ? "border-zinc-950 text-zinc-950" : "border-transparent"}`}
    >
      {children}
    </ButtonLink>
  );
}

function timelineTitle(item: ApiGroupHistorySession["timeline"][number]) {
  if (item.kind === "poll" && item.poll_type) {
    const pollLabel = pollTypeLabels[item.poll_type];
    if (item.title.includes("opened")) return `${pollLabel} opened`;
    if (item.title.includes("closed")) return `${pollLabel} closed`;
    if (item.title.includes("created")) return `${pollLabel} created`;
    return pollLabel;
  }
  if (item.kind === "event") return auditActionLabels[item.title] ?? item.title;
  return item.title;
}

function timelineTone(kind: ApiGroupHistorySession["timeline"][number]["kind"]) {
  if (kind === "comment") return "border-blue-200 bg-blue-50 text-blue-700";
  if (kind === "poll") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (kind === "event") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-700";
}

function timelineIcon(kind: ApiGroupHistorySession["timeline"][number]["kind"]) {
  if (kind === "comment") return "C";
  if (kind === "poll") return "P";
  if (kind === "event") return "E";
  return "S";
}

function relativeTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
