import { ButtonLink } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";
import { TimeDisplay } from "@/components/common/TimeDisplay";
import { RealtimeSessionRefresh } from "@/components/sessions/RealtimeSessionRefresh";
import { SessionActions } from "@/components/sessions/SessionActions";
import { SessionComments } from "@/components/sessions/SessionComments";
import { SessionWorkflowStepper, type WorkflowAction } from "@/components/sessions/SessionWorkflowStepper";
import { calendarInvitePolicyLabels } from "@/lib/labels";
import type { ApiGroupDetail } from "@/lib/web-api";
import type { Poll, Session, SessionStatus } from "@/types/domain";

export function SessionSetupWizard({
  session,
  polls,
  group,
}: {
  session: Session;
  polls: Poll[];
  group: ApiGroupDetail;
}) {
  const canManage = Boolean(session.currentUserCanManage);
  const canManageFlow = canManage && !terminalStatus(session.status);
  const nextAction = nextHostAction(session, polls);
  const liveEnabled = shouldRefresh(session, polls);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium text-zinc-500">
            <a className="hover:text-zinc-900" href={`/groups/${group.group_id}`}>{group.name}</a>
            <span> / Session</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold text-zinc-950">{session.topic ?? "Untitled session"}</h1>
            <SessionStatusPill status={derivedStatus(session)} />
            <RealtimeSessionRefresh enabled={liveEnabled} />
          </div>
        </div>
        {session.status === "scheduled" && session.meetLink ? (
          <ButtonLink href={session.meetLink} tone="primary" className="w-full sm:w-auto">
            Open Meet
          </ButtonLink>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <SessionWorkflowStepper
          session={session}
          polls={polls}
          canManage={canManageFlow}
          nextAction={nextAction}
        />

        <aside className="space-y-4 lg:sticky lg:top-20">
          <SessionSummaryCard session={session} />
          {canManage ? (
            <HostControlsCard
              session={session}
              canManage={canManage}
              nextAction={nextAction}
            />
          ) : null}
          <SessionComments
            sessionId={session.id}
            disabled={session.status === "cancelled" || session.status === "completed"}
          />
        </aside>
      </div>
    </div>
  );
}

function SessionSummaryCard({ session }: { session: Session }) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-zinc-950">Session</h2>
      {session.description ? (
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-zinc-600">{session.description}</p>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">No description yet.</p>
      )}
      <div className="mt-4 space-y-3 text-sm">
        <Info label="Host" value={session.hostName ?? "Host"} />
        <Info label="Invite policy" value={calendarInvitePolicyLabels[session.calendarInvitePolicy]} />
        <Info label="Meet account" value={session.meetingOwnerName ?? "Group default, then host"} />
      </div>
      {session.scheduledStartTime ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Scheduled</div>
          <TimeDisplay start={session.scheduledStartTime} end={session.scheduledEndTime} />
        </div>
      ) : null}
    </Card>
  );
}

function HostControlsCard({
  session,
  canManage,
  nextAction,
}: {
  session: Session;
  canManage: boolean;
  nextAction?: WorkflowAction;
}) {
  if (terminalStatus(session.status)) return null;
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-zinc-950">Host Controls</h2>
      <div className="mt-3 space-y-2">
        {nextAction ? (
          <ButtonLink href={nextAction.href} tone="primary" className="w-full">
            {nextAction.label}
          </ButtonLink>
        ) : null}
        <SessionActions session={session} canManage={canManage} />
      </div>
    </Card>
  );
}

function SessionStatusPill({ status }: { status: SimpleSessionStatus }) {
  const tone: Record<SimpleSessionStatus, string> = {
    Draft: "border-zinc-200 bg-zinc-50 text-zinc-700",
    "Collecting Availability": "border-indigo-200 bg-indigo-50 text-indigo-700",
    "Final Vote Open": "border-blue-200 bg-blue-50 text-blue-700",
    "Needs Host Decision": "border-amber-200 bg-amber-50 text-amber-800",
    Scheduled: "border-emerald-200 bg-emerald-50 text-emerald-700",
    "Scheduling Failed": "border-rose-200 bg-rose-50 text-rose-700",
    Cancelled: "border-zinc-200 bg-zinc-100 text-zinc-500",
  };
  return (
    <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${tone[status]}`}>
      {status}
    </span>
  );
}

type SimpleSessionStatus =
  | "Draft"
  | "Collecting Availability"
  | "Final Vote Open"
  | "Needs Host Decision"
  | "Scheduled"
  | "Scheduling Failed"
  | "Cancelled";

function derivedStatus(session: Session): SimpleSessionStatus {
  if (session.status === "availability_collection") return "Collecting Availability";
  if (session.status === "polling") return "Final Vote Open";
  if (session.status === "needs_host_decision" || session.status === "rescheduling") return "Needs Host Decision";
  if (session.status === "scheduled") return "Scheduled";
  if (session.status === "scheduling_failed") return "Scheduling Failed";
  if (session.status === "cancelled" || session.status === "completed") return "Cancelled";
  return "Draft";
}

function nextHostAction(session: Session, polls: Poll[]): WorkflowAction | undefined {
  if (terminalStatus(session.status) || session.status === "scheduling") return undefined;
  const activeOrDraft = polls.some((poll) => poll.status === "active" || poll.status === "draft");
  if (activeOrDraft) return undefined;

  const closedTypes = new Set(
    polls
      .filter((poll) => poll.status === "closed" || poll.status === "superseded")
      .map((poll) => poll.type),
  );

  if (!closedTypes.has("interest")) {
    return pollAction(session.id, "interest", "Create Interest Poll", "Start with interest", "Check who wants to attend before choosing topic and timing.", "No poll yet. Start with an interest check.");
  }
  if (!closedTypes.has("topic")) {
    return pollAction(session.id, "topic", "Create Topic Poll", "Next: choose the topic", "Interest is collected. Now narrow down what this session should cover.", "Interest is collected. Create a topic poll next.");
  }
  if (!closedTypes.has("availability")) {
    return pollAction(session.id, "availability", "Create Availability Poll", "Next: collect availability", "The topic is ready. Now collect time windows that work for members.", "Topic selection is done. Create an availability poll next.");
  }
  if (!closedTypes.has("final_timing") || session.status === "needs_host_decision" || session.status === "rescheduling" || session.status === "scheduling_failed") {
    return pollAction(session.id, "final_timing", "Create Final Timing Poll", "Next: final timing vote", "Use the best availability windows as final options.", "Create a final timing poll so members can choose one session time.");
  }
  return undefined;
}

function pollAction(
  sessionId: string,
  type: Poll["type"],
  label: string,
  heading: string,
  description: string,
  emptyText: string,
): WorkflowAction {
  return {
    href: `/sessions/${sessionId}/polls/new?type=${type}`,
    label,
    heading,
    description,
    emptyText,
  };
}

function terminalStatus(status: SessionStatus) {
  return status === "cancelled" || status === "completed";
}

function shouldRefresh(session: Session, polls: Poll[]) {
  if (["cancelled", "completed"].includes(session.status)) return false;
  if (["scheduling", "scheduling_failed", "needs_host_decision", "rescheduling"].includes(session.status)) return true;
  return polls.some((poll) => poll.status === "active" || poll.status === "draft");
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 break-words text-zinc-900">{value}</div>
    </div>
  );
}
