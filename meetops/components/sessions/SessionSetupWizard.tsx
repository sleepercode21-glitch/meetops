import { StatusBadge } from "@/components/common/Badge";
import { ButtonLink } from "@/components/common/Buttons";
import { Card, SectionTitle } from "@/components/common/Card";
import { TimeDisplay } from "@/components/common/TimeDisplay";
import { PollWorkflowCard } from "@/components/polls/PollWorkflowCard";
import { RealtimeSessionRefresh } from "@/components/sessions/RealtimeSessionRefresh";
import { SessionActions } from "@/components/sessions/SessionActions";
import { SessionStatusBanner } from "@/components/sessions/SessionStatusBanner";
import { calendarInvitePolicyLabels } from "@/lib/labels";
import type { ApiGroupDetail } from "@/lib/web-api";
import type { Poll, PollType, Session } from "@/types/domain";

const stepOrder = [
  "draft",
  "interest",
  "topic",
  "availability",
  "timing",
  "scheduling",
  "scheduled",
  "cancelled",
  "completed",
] as const;

type WizardStep = (typeof stepOrder)[number];

const stepLabels: Record<WizardStep, string> = {
  draft: "Draft",
  interest: "Interest",
  topic: "Topic",
  availability: "Availability",
  timing: "Timing",
  scheduling: "Scheduling",
  scheduled: "Scheduled",
  cancelled: "Cancelled",
  completed: "Completed",
};

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
  const currentStep = stepForSession(session, polls);
  const activePolls = polls.filter((poll) => poll.status === "active");
  const draftPolls = polls.filter((poll) => poll.status === "draft");
  const closedPolls = polls.filter((poll) => poll.status === "closed");
  const currentPolls = pollsForStep(polls, currentStep);
  const liveEnabled = shouldRefresh(session, polls);

  if (!canManage) {
    return (
      <MemberSessionWizard
        session={session}
        polls={polls}
        group={group}
        currentStep={currentStep}
        liveEnabled={liveEnabled}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <a className="text-sm font-medium text-zinc-500 hover:text-zinc-900" href={`/groups/${group.group_id}`}>
            {group.name} / Sessions
          </a>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-zinc-950">
              {session.topic ?? "Untitled session"}
            </h1>
            <StatusBadge status={session.status} />
            <RealtimeSessionRefresh enabled={liveEnabled} />
          </div>
          {session.description ? (
            <p className="mt-2 max-w-3xl text-sm text-zinc-600">{session.description}</p>
          ) : null}
        </div>
        <PrimarySessionAction session={session} canManage={canManage} activePolls={activePolls} />
      </div>

      <SessionStatusBanner session={session} />

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-9">
          {stepOrder.map((step, index) => (
            <WizardStepItem
              key={step}
              label={stepLabels[step]}
              state={stepState(step, currentStep)}
              index={index + 1}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.7fr)]">
        <main className="space-y-5">
          <section id="current-step" className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <SectionTitle
              title={activeTitle(currentStep)}
              subtitle={activeSubtitle(currentStep, canManage)}
              action={
                canManage && !["scheduled", "cancelled", "completed"].includes(currentStep) ? (
                  <ButtonLink href={`/sessions/${session.id}/polls/new`} tone="primary">
                    New Poll
                  </ButtonLink>
                ) : null
              }
            />
            <div className="space-y-3">
              {currentPolls.length ? (
                currentPolls.map((poll) => (
                  <PollWorkflowCard key={poll.id} poll={poll} canManage={canManage} />
                ))
              ) : (
                <EmptyStep session={session} step={currentStep} canManage={canManage} />
              )}
            </div>
          </section>

          {draftPolls.some((poll) => !currentPolls.includes(poll)) ? (
            <PollSection
              title="Draft Queue"
              subtitle="Suggestions can continue here until the host publishes."
              polls={draftPolls.filter((poll) => !currentPolls.includes(poll))}
              canManage={canManage}
            />
          ) : null}

          {activePolls.some((poll) => !currentPolls.includes(poll)) ? (
            <PollSection
              title="Open Polls"
              polls={activePolls.filter((poll) => !currentPolls.includes(poll))}
              canManage={canManage}
            />
          ) : null}

          {closedPolls.length ? (
            <PollSection title="Closed Polls" polls={closedPolls} canManage={canManage} />
          ) : null}
        </main>

        <aside className="space-y-4">
          <Card>
            <SectionTitle title="Session Controls" />
            <SessionActions session={session} canManage={canManage} />
          </Card>
          <Card>
            <SectionTitle title="Meeting" />
            {session.scheduledStartTime ? (
              <TimeDisplay start={session.scheduledStartTime} end={session.scheduledEndTime} />
            ) : (
              <p className="text-sm text-zinc-600">Waiting for a final time.</p>
            )}
            <Info label="Invite policy" value={calendarInvitePolicyLabels[session.calendarInvitePolicy]} />
            <Info label="Meet link" value={session.meetLink ?? "Not created"} />
          </Card>
          <Card>
            <SectionTitle title="Poll Counts" />
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="Draft" value={draftPolls.length} />
              <Metric label="Open" value={activePolls.length} />
              <Metric label="Closed" value={closedPolls.length} />
            </div>
          </Card>
          {session.schedulingError ? (
            <Card className="border-rose-200 bg-rose-50">
              <SectionTitle title="Scheduling Error" />
              <p className="text-sm text-rose-800">{session.schedulingError}</p>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function MemberSessionWizard({
  session,
  polls,
  group,
  currentStep,
  liveEnabled,
}: {
  session: Session;
  polls: Poll[];
  group: ApiGroupDetail;
  currentStep: WizardStep;
  liveEnabled: boolean;
}) {
  const activePolls = polls.filter((poll) => poll.status === "active");
  const visibleDrafts = polls.filter((poll) => poll.status === "draft" && poll.acceptsSuggestions);
  const closedPolls = polls.filter((poll) => poll.status === "closed");
  const focusPolls = activePolls.length ? activePolls : visibleDrafts;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <a className="text-sm font-medium text-zinc-500 hover:text-zinc-900" href={`/groups/${group.group_id}`}>
          {group.name} / Sessions
        </a>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-950">
            {session.topic ?? "Untitled session"}
          </h1>
          <StatusBadge status={session.status} />
          <RealtimeSessionRefresh enabled={liveEnabled} />
        </div>
        {session.description ? (
          <p className="mt-2 text-sm text-zinc-600">{session.description}</p>
        ) : null}
      </div>

      <MemberProgress step={currentStep} />
      <MemberStatusPanel session={session} />

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <SectionTitle
          title={memberActionTitle(session, focusPolls)}
          subtitle={memberActionSubtitle(session, focusPolls)}
        />
        <div className="space-y-3">
          {focusPolls.length ? (
            focusPolls.map((poll) => (
              <PollWorkflowCard key={poll.id} poll={poll} canManage={false} />
            ))
          ) : (
            <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
              {memberEmptyText(session)}
            </div>
          )}
        </div>
      </section>

      {closedPolls.length ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <SectionTitle title="Past Results" />
          <div className="space-y-3">
            {closedPolls.map((poll) => (
              <PollWorkflowCard key={poll.id} poll={poll} canManage={false} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function MemberProgress({ step }: { step: WizardStep }) {
  if (step === "cancelled" || step === "completed") {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
        <WizardStepItem
          label={stepLabels[step]}
          state="current"
          index={1}
        />
      </section>
    );
  }

  const memberSteps: WizardStep[] = ["interest", "topic", "availability", "timing", "scheduled"];
  const normalized = step === "draft" || step === "scheduling" ? "timing" : step;
  const currentIndex = Math.max(0, memberSteps.indexOf(normalized));

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
      <div className="grid gap-2 sm:grid-cols-5">
        {memberSteps.map((item, index) => {
          const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";
          return (
            <WizardStepItem
              key={item}
              label={stepLabels[item]}
              state={state}
              index={index + 1}
            />
          );
        })}
      </div>
    </section>
  );
}

function MemberStatusPanel({ session }: { session: Session }) {
  if (session.status === "scheduled") {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
        <div className="font-semibold text-emerald-950">You are good to go</div>
        <div className="mt-2">
          <TimeDisplay start={session.scheduledStartTime} end={session.scheduledEndTime} />
        </div>
        {session.meetLink ? (
          <ButtonLink href={session.meetLink} tone="primary" className="mt-3">
            Open Meet Link
          </ButtonLink>
        ) : null}
      </div>
    );
  }

  if (session.status === "cancelled") {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <div className="font-semibold text-zinc-950">This session was cancelled</div>
        <p className="mt-1 text-sm text-zinc-600">Voting and suggestions are closed.</p>
      </div>
    );
  }

  if (session.status === "scheduling" || session.status === "scheduling_failed" || session.status === "needs_host_decision") {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="font-semibold text-amber-950">Waiting on scheduling</div>
        <p className="mt-1 text-sm text-amber-800">The host is choosing or confirming the final time.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="font-semibold text-blue-950">Session setup is moving</div>
      <p className="mt-1 text-sm text-blue-800">When a poll is open, click an option and your vote is saved instantly.</p>
    </div>
  );
}

function WizardStepItem({
  label,
  state,
  index,
}: {
  label: string;
  state: "done" | "current" | "todo";
  index: number;
}) {
  const tone =
    state === "current"
      ? "border-zinc-950 bg-zinc-950 text-white"
      : state === "done"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-zinc-200 bg-zinc-50 text-zinc-500";

  return (
    <div className={`min-h-20 rounded-md border p-3 ${tone}`}>
      <div className="text-xs font-medium opacity-75">Step {index}</div>
      <div className="mt-3 text-sm font-semibold">{label}</div>
    </div>
  );
}

function PollSection({
  title,
  subtitle,
  polls,
  canManage,
}: {
  title: string;
  subtitle?: string;
  polls: Poll[];
  canManage: boolean;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <SectionTitle title={title} subtitle={subtitle} />
      <div className="space-y-3">
        {polls.map((poll) => (
          <PollWorkflowCard key={poll.id} poll={poll} canManage={canManage} />
        ))}
      </div>
    </section>
  );
}

function EmptyStep({
  session,
  step,
  canManage,
}: {
  session: Session;
  step: WizardStep;
  canManage: boolean;
}) {
  if (step === "scheduled" && session.meetLink) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
        <TimeDisplay start={session.scheduledStartTime} end={session.scheduledEndTime} />
        <ButtonLink href={session.meetLink} tone="primary" className="mt-3">
          Open Meet Link
        </ButtonLink>
      </div>
    );
  }

  if (step === "cancelled") {
    return (
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-sm font-medium text-zinc-950">This session was cancelled.</p>
        <p className="mt-1 text-sm text-zinc-600">Draft and active polls were closed with it.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4">
      <p className="text-sm text-zinc-600">{emptyText(step, canManage)}</p>
      {canManage && !["scheduling", "scheduled", "cancelled", "completed"].includes(step) ? (
        <ButtonLink href={`/sessions/${session.id}/polls/new`} tone="primary" className="mt-3">
          Create Poll
        </ButtonLink>
      ) : null}
      {canManage && step === "timing" ? (
        <ButtonLink href={`/sessions/${session.id}/reschedule`} className="mt-3 ml-2">
          Choose Time
        </ButtonLink>
      ) : null}
    </div>
  );
}

function PrimarySessionAction({
  session,
  canManage,
  activePolls,
}: {
  session: Session;
  canManage: boolean;
  activePolls: Poll[];
}) {
  if (session.status === "scheduled" && session.meetLink) {
    return <ButtonLink href={session.meetLink} tone="primary">Open Meet Link</ButtonLink>;
  }
  if (canManage && session.status === "needs_host_decision") {
    return <ButtonLink href={`/sessions/${session.id}/reschedule`} tone="primary">Choose Time</ButtonLink>;
  }
  if (canManage && !["cancelled", "completed", "scheduling", "scheduled"].includes(session.status)) {
    return <ButtonLink href={`/sessions/${session.id}/polls/new`} tone="primary">Continue Setup</ButtonLink>;
  }
  if (activePolls.length) {
    return <ButtonLink href="#current-step" tone="primary">Vote Now</ButtonLink>;
  }
  return null;
}

function stepForSession(session: Session, polls: Poll[]): WizardStep {
  if (session.status === "cancelled") return "cancelled";
  if (session.status === "completed") return "completed";
  if (session.status === "scheduled") return "scheduled";
  if (session.status === "scheduling" || session.status === "scheduling_failed") return "scheduling";
  if (session.status === "needs_host_decision" || session.status === "rescheduling") return "timing";

  const latestLivePoll = [...polls]
    .reverse()
    .find((poll) => poll.status === "active" || poll.status === "draft");
  if (latestLivePoll) return stepForPollType(latestLivePoll.type);

  if (session.status === "interest_check") return "interest";
  if (session.status === "topic_selection") return "topic";
  if (session.status === "availability_collection") return "availability";
  if (session.status === "polling") return "timing";
  return "draft";
}

function stepForPollType(type: PollType): WizardStep {
  if (type === "interest") return "interest";
  if (type === "topic") return "topic";
  if (type === "availability") return "availability";
  return "timing";
}

function pollsForStep(polls: Poll[], step: WizardStep) {
  return polls.filter((poll) => stepForPollType(poll.type) === step && poll.status !== "cancelled" && poll.status !== "superseded");
}

function stepState(step: WizardStep, current: WizardStep) {
  const stepIndex = stepOrder.indexOf(step);
  const currentIndex = stepOrder.indexOf(current);
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "current";
  return "todo";
}

function activeTitle(step: WizardStep) {
  if (step === "draft") return "Session Draft";
  if (step === "scheduling") return "Scheduling";
  if (step === "cancelled") return "Session Cancelled";
  return `${stepLabels[step]} Step`;
}

function activeSubtitle(step: WizardStep, canManage: boolean) {
  if (step === "timing") return canManage ? "Close the final timing poll or choose a time manually." : "Vote for the final session time.";
  if (step === "topic") return "Collect topic ideas, convert suggestions, then publish official options.";
  if (step === "availability") return "Collect workable time windows before the final timing poll.";
  if (step === "interest") return "Check who wants to attend before narrowing the plan.";
  if (step === "scheduling") return "Calendar and Meet creation happen here.";
  if (step === "cancelled") return "This session is cancelled and no longer accepts votes or scheduling actions.";
  return undefined;
}

function emptyText(step: WizardStep, canManage: boolean) {
  if (step === "draft") return canManage ? "Start with an interest poll, topic poll, availability poll, or jump straight to timing." : "The host is setting up this session.";
  if (step === "scheduling") return "Scheduling is in progress or needs a retry.";
  if (step === "cancelled") return "This session was cancelled.";
  if (step === "completed") return "This session is no longer active.";
  return canManage ? "Create the next poll for this step." : "Waiting for the host.";
}

function memberActionTitle(session: Session, polls: Poll[]) {
  if (session.status === "scheduled") return "Session Ready";
  if (session.status === "cancelled") return "Session Cancelled";
  if (polls.some((poll) => poll.status === "active")) return "Cast Your Vote";
  if (polls.some((poll) => poll.status === "draft")) return "Suggest an Option";
  return "Waiting for Host";
}

function memberActionSubtitle(session: Session, polls: Poll[]) {
  if (session.status === "scheduled") return "The Meet link and time are ready.";
  if (session.status === "cancelled") return "No further action is needed.";
  if (polls.some((poll) => poll.status === "active")) return "Click an option to save your vote. Click another option to change it.";
  if (polls.some((poll) => poll.status === "draft")) return "Share ideas before the host publishes official options.";
  return "You will be able to vote when the host opens a poll.";
}

function memberEmptyText(session: Session) {
  if (session.status === "scheduled") return "This session has been scheduled.";
  if (session.status === "cancelled") return "This session was cancelled.";
  if (session.status === "completed") return "This session is completed.";
  return "The host is preparing the next step.";
}

function shouldRefresh(session: Session, polls: Poll[]) {
  if (["cancelled", "completed"].includes(session.status)) return false;
  if (["scheduling", "scheduling_failed", "needs_host_decision", "rescheduling"].includes(session.status)) return true;
  return polls.some((poll) => poll.status === "active" || poll.status === "draft");
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-3">
      <div className="text-xs font-medium uppercase text-zinc-500">{label}</div>
      <div className="mt-1 break-words text-sm text-zinc-900">{value}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="text-lg font-semibold text-zinc-950">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{label}</div>
    </div>
  );
}
