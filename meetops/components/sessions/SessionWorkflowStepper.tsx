"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";
import { ConfirmLink } from "@/components/common/ConfirmAction";
import { TimeDisplay } from "@/components/common/TimeDisplay";
import { PollWorkflowCard } from "@/components/polls/PollWorkflowCard";
import type { Poll, Session } from "@/types/domain";

export type WorkflowStep = "draft" | "interest" | "topic" | "availability" | "timing" | "scheduled";

export type WorkflowAction = {
  href: string;
  label: string;
  heading: string;
  description: string;
  emptyText: string;
  confirmMessage?: string;
};

type StepLinkAction = {
  href: string;
  label: string;
  confirmMessage?: string;
};

type ManagementRole = "admin" | "host";

const workflowSteps: { id: WorkflowStep; label: string; shortLabel: string }[] = [
  { id: "draft", label: "Draft", shortLabel: "Draft" },
  { id: "interest", label: "Interest", shortLabel: "Interest" },
  { id: "topic", label: "Topic", shortLabel: "Topic" },
  { id: "availability", label: "Availability", shortLabel: "Avail" },
  { id: "timing", label: "Timing", shortLabel: "Timing" },
  { id: "scheduled", label: "Scheduled", shortLabel: "Meet" },
];

export function SessionWorkflowStepper({
  session,
  polls,
  canManage,
  managementRole,
  nextAction,
  viewerTimezone,
  controls,
}: {
  session: Session;
  polls: Poll[];
  canManage: boolean;
  managementRole?: ManagementRole;
  nextAction?: WorkflowAction;
  viewerTimezone?: string;
  controls?: React.ReactNode;
}) {
  const currentStep = currentWorkflowStep(session, polls);
  const [selection, setSelection] = useState<{ currentStep: WorkflowStep; selectedStep: WorkflowStep }>({
    currentStep,
    selectedStep: currentStep,
  });
  const selectedStep = selection.currentStep === currentStep ? selection.selectedStep : currentStep;
  const currentIndex = workflowSteps.findIndex((step) => step.id === currentStep);
  const selectedIndex = workflowSteps.findIndex((step) => step.id === selectedStep);

  if (session.status === "cancelled" || session.status === "completed") {
    return (
      <Card className="overflow-hidden p-0">
        <div className="border-b border-zinc-200 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-zinc-950">Flow</h2>
              <p className="mt-0.5 text-sm text-zinc-600">
                {session.status === "cancelled"
                  ? "This session was cancelled. Polls and setup actions are closed."
                  : "This session is complete. Polls and setup actions are closed."}
              </p>
            </div>
            <span className="inline-flex min-h-9 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
              {session.status === "cancelled" ? "Cancelled" : "Completed"}
            </span>
          </div>
        </div>
        <div className="bg-zinc-50/60 p-4">
          <ClosedSessionPanel session={session} polls={polls} viewerTimezone={viewerTimezone} />
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-zinc-200 p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xl">
            <h2 className="text-base font-semibold text-zinc-950">Flow</h2>
            <p className="mt-0.5 text-sm text-zinc-600">{flowHelperText(managementRole)}</p>
          </div>
          <span className="inline-flex min-h-9 w-fit shrink-0 items-center justify-center whitespace-nowrap rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
            Step {selectedIndex + 1} of {workflowSteps.length}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {workflowSteps.map((step, index) => {
              const status = stepStatus(step.id, index, currentIndex, session, polls);
              const selected = selectedStep === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setSelection({ currentStep, selectedStep: step.id })}
                  className={`group flex min-h-10 items-center gap-2 rounded-full border px-2 py-1.5 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${stepButtonTone(status, selected)}`}
                  aria-current={selected ? "step" : undefined}
                >
                  <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${stepCircleTone(status, selected)}`}>
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold sm:text-sm">{step.shortLabel}</span>
                    {status === "skipped" ? <span className="block text-[10px] font-medium opacity-80">Skipped</span> : null}
                  </span>
                </button>
              );
            })}
        </div>
        {controls ? (
          <div className="mt-4 border-t border-zinc-100 pt-3">
            {controls}
          </div>
        ) : null}
      </div>

      <div className="bg-zinc-50/60 p-4 sm:p-5">
        <SelectedStepPanel
          session={session}
          polls={polls}
          step={selectedStep}
          currentStep={currentStep}
          canManage={canManage}
          nextAction={nextAction}
          viewerTimezone={viewerTimezone}
        />
      </div>
    </Card>
  );
}

function ClosedSessionPanel({
  session,
  polls,
  viewerTimezone,
}: {
  session: Session;
  polls: Poll[];
  viewerTimezone?: string;
}) {
  const latestPolls = ["interest", "topic", "availability", "timing"]
    .map((step) => preferredPollForStep(pollsForStep(polls, step as WorkflowStep)))
    .filter((poll): poll is Poll => Boolean(poll));

  return (
    <div className="space-y-4">
      <Card className={session.status === "cancelled" ? "border-zinc-200 bg-zinc-50" : "border-emerald-200 bg-emerald-50"}>
        <h3 className="text-lg font-semibold text-zinc-950">
          {session.status === "cancelled" ? "Session Cancelled" : "Session Completed"}
        </h3>
        <p className="mt-1 text-sm text-zinc-600">
          {session.status === "cancelled"
            ? "This session is no longer active. Voting and scheduling are closed."
            : "This session has ended. The setup flow is now read-only."}
        </p>
        {session.status === "completed" && session.scheduledStartTime ? (
          <p className="mt-3 text-sm font-medium text-zinc-800">
            <TimeDisplay start={session.scheduledStartTime} end={session.scheduledEndTime} timezone={viewerTimezone} />
          </p>
        ) : null}
      </Card>
      {latestPolls.length ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-zinc-700">Final poll snapshots</h3>
          {latestPolls.map((poll) => (
            <PollWorkflowCard key={poll.id} poll={poll} canManage={false} hostTimezone={session.hostTimezone} viewerTimezone={viewerTimezone} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SelectedStepPanel({
  session,
  polls,
  step,
  currentStep,
  canManage,
  nextAction,
  viewerTimezone,
}: {
  session: Session;
  polls: Poll[];
  step: WorkflowStep;
  currentStep: WorkflowStep;
  canManage: boolean;
  nextAction?: WorkflowAction;
  viewerTimezone?: string;
}) {
  if (step === "draft") {
    return <DraftReview session={session} polls={polls} canManage={canManage} nextAction={step === currentStep ? nextAction : undefined} />;
  }

  if (step === "scheduled") {
    return <ScheduledReview session={session} canManage={canManage} />;
  }

  const stepPolls = pollsForStep(polls, step);
  const selectedPoll = preferredPollForStep(stepPolls);
  const previousPolls = selectedPoll
    ? stepPolls.filter((poll) => poll.id !== selectedPoll.id)
    : [];
  const isCurrent = step === currentStep;
  const skipped = isSkippedStep(step, currentStep, polls);
  const stepAction = hostActionForStep(session.id, step, polls);
  const actionForEmptyCurrent = stepAction ?? nextAction;
  const rerunAction = rerunActionForStep(session.id, step, stepPolls);

  if (skipped) {
    return (
      <Card className="border-zinc-200 bg-zinc-50">
        <h3 className="text-lg font-semibold text-zinc-950">{workflowSteps.find((item) => item.id === step)?.label} Skipped</h3>
        <p className="mt-1 text-sm text-zinc-600">
          The host moved past this optional step. This step is locked for this run.
        </p>
      </Card>
    );
  }

  if (selectedPoll) {
    const showStepActions = canManage && (selectedPoll.status === "closed" || selectedPoll.status === "superseded");
    return (
      <div className="space-y-4">
        <PollWorkflowCard poll={selectedPoll} canManage={canManage && isCurrent} hostTimezone={session.hostTimezone} viewerTimezone={viewerTimezone} />
        {showStepActions ? (
          <StepActionCard
            sessionId={session.id}
            step={step}
            nextAction={isCurrent && step !== "availability" ? actionForEmptyCurrent : undefined}
            rerunAction={rerunAction}
          />
        ) : null}
        {previousPolls.length ? (
          <PreviousPolls polls={previousPolls} canManage={canManage} hostTimezone={session.hostTimezone} viewerTimezone={viewerTimezone} />
        ) : null}
      </div>
    );
  }

  if (isCurrent && session.status === "needs_host_decision") {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <h3 className="text-lg font-semibold text-amber-950">Needs Host Decision</h3>
        <p className="mt-1 text-sm text-amber-800">
          The final timing vote ended in a tie or had no votes. The host can choose the final time.
        </p>
        {canManage ? (
          <ButtonLink href={`/sessions/${session.id}/reschedule`} tone="primary" className="mt-4 w-full sm:w-auto">
            Choose Final Time
          </ButtonLink>
        ) : null}
      </Card>
    );
  }

  if (isCurrent && session.status === "scheduling_failed") {
    return (
      <Card className="border-rose-200 bg-rose-50">
        <h3 className="text-lg font-semibold text-rose-950">Scheduling Failed</h3>
        <p className="mt-1 text-sm text-rose-800">{session.schedulingError ?? "Google Calendar could not create the event."}</p>
        {canManage ? (
          <ButtonLink href={`/sessions/${session.id}/reschedule`} tone="primary" className="mt-4 w-full sm:w-auto">
            Choose or Retry Time
          </ButtonLink>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="border-dashed bg-white">
      <h3 className="text-lg font-semibold text-zinc-950">{emptyTitle(step, isCurrent)}</h3>
      <p className="mt-1 text-sm text-zinc-600">
        {isCurrent && canManage
          ? actionForEmptyCurrent?.emptyText ?? "Create the next poll to keep the session moving."
          : isCurrent
            ? "No poll is active yet. Check back after the host creates one."
            : "This step has not happened yet."}
      </p>
      {canManage ? (
        <div className="mt-4">
          <StepLaunchActions
            sessionId={session.id}
            step={step}
            primaryAction={isCurrent ? actionForEmptyCurrent : stepAction}
            polls={polls}
          />
        </div>
      ) : null}
    </Card>
  );
}

function hostActionForStep(sessionId: string, step: WorkflowStep, polls: Poll[]): WorkflowAction | undefined {
  const stepPolls = pollsForStep(polls, step);
  if (stepPolls.some((poll) => poll.status === "active" || poll.status === "draft")) return undefined;
  if (step === "interest" && !stepPolls.some((poll) => poll.status === "closed")) {
    return workflowAction(sessionId, "interest", "Create Interest Poll", "Start with interest", "Check who wants to attend before choosing topic and timing.", "No interest poll yet. Start with an interest check.");
  }
  if (step === "topic" && !stepPolls.some((poll) => poll.status === "closed")) {
    return workflowAction(sessionId, "topic", "Create Topic Poll", "Choose the topic", "Collect topic votes or suggestions before asking about availability.", "No topic poll yet. Create a topic poll next.");
  }
  if (step === "availability" && !stepPolls.some((poll) => poll.status === "closed")) {
    return workflowAction(sessionId, "availability", "Create Availability Poll", "Collect availability", "Add possible time windows so members can select every time that works.", "No availability poll yet. Create availability options for members.");
  }
  if (step === "timing" && !stepPolls.some((poll) => poll.status === "closed")) {
    return workflowAction(sessionId, "final_timing", "Create Final Timing Poll", "Run the final timing vote", "Members choose one final time from the best options.", "No final timing poll yet. Create the final vote.");
  }
  return undefined;
}

function rerunActionForStep(sessionId: string, step: WorkflowStep, stepPolls: Poll[]): WorkflowAction | undefined {
  if (step === "draft" || step === "scheduled") return undefined;
  if (stepPolls.some((poll) => poll.status === "active" || poll.status === "draft")) return undefined;
  const closedExists = stepPolls.some((poll) => poll.status === "closed" || poll.status === "superseded");
  if (!closedExists) return undefined;
  if (step === "interest") {
    return workflowAction(sessionId, "interest", "Run Interest Again", "Run interest again", "Create a fresh interest poll. The latest result becomes the result for this step.", "Create another interest poll.");
  }
  if (step === "topic") {
    return workflowAction(sessionId, "topic", "Run Topic Again", "Run topic again", "Create a fresh topic poll. The latest result becomes the topic result used by the flow.", "Create another topic poll.");
  }
  if (step === "availability") {
    return workflowAction(sessionId, "availability", "Run Availability Again", "Run availability again", "Create fresh availability windows. The latest availability results are used for final timing.", "Create another availability poll.");
  }
  return workflowAction(sessionId, "final_timing", "Run Timing Again", "Run timing again", "Create a fresh final timing vote. Only the latest final timing result can schedule the session.", "Create another final timing poll.");
}

function workflowAction(
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
    confirmMessage: label.toLowerCase().includes("skip")
      ? "Skip this optional step and move forward?"
      : label.toLowerCase().includes("again")
        ? "Run this step again? The newest poll will become the result for this step."
        : undefined,
  };
}

function flowHelperText(managementRole?: ManagementRole) {
  if (managementRole === "admin") {
    return "Admin view: you can step in, edit, cancel, or recover the session flow.";
  }
  if (managementRole === "host") {
    return "Host view: run the steps you need, skip optional ones, and finish with timing.";
  }
  return "Interest, topic, and availability are optional. Timing is required.";
}

function DraftReview({
  session,
  polls,
  canManage,
  nextAction,
}: {
  session: Session;
  polls: Poll[];
  canManage: boolean;
  nextAction?: WorkflowAction;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-zinc-950">Draft</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600">
            {session.description || "Session details are ready to edit before the flow moves forward."}
          </p>
        </div>
        {canManage && !["cancelled", "completed"].includes(session.status) ? (
          <ButtonLink href={`/sessions/${session.id}/edit`} className="w-full sm:w-auto">
            Edit Details
          </ButtonLink>
        ) : null}
      </div>
      {canManage && !["cancelled", "completed"].includes(session.status) ? (
        <div className="mt-5 border-t border-zinc-100 pt-4">
          <StepLaunchActions sessionId={session.id} step="draft" primaryAction={nextAction} polls={polls} />
        </div>
      ) : null}
    </Card>
  );
}

function StepLaunchActions({
  sessionId,
  step,
  primaryAction,
  polls,
}: {
  sessionId: string;
  step: WorkflowStep;
  primaryAction?: WorkflowAction;
  polls: Poll[];
}) {
  const activeOrDraft = polls.some((poll) => poll.status === "active" || poll.status === "draft");
  if (activeOrDraft) return null;
  const actions = actionsForStep(sessionId, step);
  const primaryHref = primaryAction?.href;
  const visibleActions = actions.filter((action) => action.href !== primaryHref);
  return (
    <div className="flex flex-wrap gap-2.5">
      {primaryAction ? (
        <ActionLink action={primaryAction} tone="primary" className="w-full sm:w-auto" />
      ) : null}
      {visibleActions.map((action) => (
        <ActionLink key={action.href} action={action} className="w-full sm:w-auto" />
      ))}
    </div>
  );
}

function actionsForStep(sessionId: string, step: WorkflowStep): StepLinkAction[] {
  if (step === "draft") {
    return [
      { href: `/sessions/${sessionId}/polls/new?type=interest`, label: "Start Interest" },
      { href: `/sessions/${sessionId}/polls/new?type=topic`, label: "Skip to Topic" },
      { href: `/sessions/${sessionId}/polls/new?type=availability`, label: "Skip to Availability" },
      { href: `/sessions/${sessionId}/polls/new?type=final_timing`, label: "Skip to Timing" },
    ];
  }
  if (step === "interest") {
    return [
      { href: `/sessions/${sessionId}/polls/new?type=interest`, label: "Run Interest" },
      { href: `/sessions/${sessionId}/polls/new?type=topic`, label: "Skip to Topic" },
      { href: `/sessions/${sessionId}/polls/new?type=availability`, label: "Skip to Availability" },
      { href: `/sessions/${sessionId}/polls/new?type=final_timing`, label: "Skip to Timing" },
    ];
  }
  if (step === "topic") {
    return [
      { href: `/sessions/${sessionId}/polls/new?type=topic`, label: "Run Topic" },
      { href: `/sessions/${sessionId}/polls/new?type=availability`, label: "Skip to Availability" },
      { href: `/sessions/${sessionId}/polls/new?type=final_timing`, label: "Skip to Timing" },
    ];
  }
  if (step === "availability") {
    return [
      { href: `/sessions/${sessionId}/polls/new?type=availability`, label: "Run Availability" },
      { href: `/sessions/${sessionId}/polls/new?type=final_timing`, label: "Skip to Timing" },
    ];
  }
  if (step === "timing") {
    return [{ href: `/sessions/${sessionId}/polls/new?type=final_timing`, label: "Run Timing" }];
  }
  return [];
}

function ScheduledReview({ session, canManage }: { session: Session; canManage: boolean }) {
  if (!session.scheduledStartTime) {
    return (
      <Card className="border-dashed bg-white">
        <h3 className="text-lg font-semibold text-zinc-950">No selected time yet</h3>
        <p className="mt-1 text-sm text-zinc-600">The final session time has not been selected yet.</p>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50">
      <h3 className="text-lg font-semibold text-emerald-950">Session Scheduled</h3>
      <div className="mt-3">
        <TimeDisplay start={session.scheduledStartTime} end={session.scheduledEndTime} />
      </div>
      {session.meetLink ? (
        <ButtonLink href={session.meetLink} tone="primary" className="mt-4 w-full sm:w-auto">
          Open Meet
        </ButtonLink>
      ) : null}
      {canManage ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <ConfirmLink
            href={`/sessions/${session.id}/polls/new?type=availability`}
            className="w-full sm:w-auto"
            confirm={{ title: "Collect availability again?", message: "This starts a fresh availability step and the latest results will be used moving forward.", confirmLabel: "Start again" }}
          >
            Collect Availability Again
          </ConfirmLink>
          <ConfirmLink
            href={`/sessions/${session.id}/polls/new?type=final_timing`}
            className="w-full sm:w-auto"
            confirm={{ title: "Run timing again?", message: "This starts a fresh final timing poll. Only the latest timing result can schedule the session.", confirmLabel: "Run again" }}
          >
            Run Timing Again
          </ConfirmLink>
          <ConfirmLink
            href={`/sessions/${session.id}/reschedule`}
            className="w-full sm:w-auto"
            confirm={{ title: "Pick a manual time?", message: "You will choose the final session time manually instead of using a poll result.", confirmLabel: "Choose time" }}
          >
            Pick Time Manually
          </ConfirmLink>
        </div>
      ) : null}
    </Card>
  );
}

function StepActionCard({
  sessionId,
  step,
  nextAction,
  rerunAction,
}: {
  sessionId: string;
  step: WorkflowStep;
  nextAction?: WorkflowAction;
  rerunAction?: WorkflowAction;
}) {
  const skipActions = nextAction
    ? skipActionsForStep(sessionId, step).filter((action) => action.href !== nextAction.href)
    : [];
  if (!nextAction && !rerunAction && !skipActions.length) return null;
  return (
    <Card>
      <div className="grid gap-3 md:grid-cols-2">
        {nextAction ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
            <h3 className="text-base font-semibold text-emerald-950">{nextAction.heading}</h3>
            <p className="mt-1 text-sm text-emerald-800">{nextAction.description}</p>
            <ActionLink action={nextAction} tone="primary" className="mt-4 w-full" />
          </div>
        ) : null}
        {rerunAction ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <h3 className="text-base font-semibold text-zinc-950">{rerunAction.heading}</h3>
            <p className="mt-1 text-sm text-zinc-600">{rerunAction.description}</p>
            <ActionLink action={rerunAction} className="mt-4 w-full" />
          </div>
        ) : null}
      </div>
      {skipActions.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {skipActions.map((action) => (
            <ActionLink key={action.href} action={action} className="w-full sm:w-auto" />
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function skipActionsForStep(sessionId: string, step: WorkflowStep): StepLinkAction[] {
  if (step === "interest") {
    return [
      { href: `/sessions/${sessionId}/polls/new?type=topic`, label: "Skip to Topic", confirmMessage: "Skip interest and move to topic selection?" },
      { href: `/sessions/${sessionId}/polls/new?type=availability`, label: "Skip to Availability", confirmMessage: "Skip interest/topic and move to availability?" },
      { href: `/sessions/${sessionId}/polls/new?type=final_timing`, label: "Skip to Timing", confirmMessage: "Skip optional planning steps and move straight to the final timing vote?" },
    ];
  }
  if (step === "topic") {
    return [
      { href: `/sessions/${sessionId}/polls/new?type=availability`, label: "Skip to Availability", confirmMessage: "Skip topic selection and move to availability?" },
      { href: `/sessions/${sessionId}/polls/new?type=final_timing`, label: "Skip to Timing", confirmMessage: "Skip topic/availability and move straight to the final timing vote?" },
    ];
  }
  if (step === "availability") {
    return [{ href: `/sessions/${sessionId}/polls/new?type=final_timing`, label: "Skip to Timing", confirmMessage: "Skip availability and move to the final timing vote?" }];
  }
  return [];
}

function PreviousPolls({
  polls,
  canManage,
  hostTimezone,
  viewerTimezone,
}: {
  polls: Poll[];
  canManage: boolean;
  hostTimezone?: string;
  viewerTimezone?: string;
}) {
  return (
    <details className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
        Previous polls ({polls.length})
      </summary>
      <div className="mt-3 space-y-3">
        {polls.map((poll) => (
          <PollWorkflowCard
            key={poll.id}
            poll={poll}
            canManage={canManage && poll.status === "closed"}
            hostTimezone={hostTimezone}
            viewerTimezone={viewerTimezone}
          />
        ))}
      </div>
    </details>
  );
}

function currentWorkflowStep(session: Session, polls: Poll[]): WorkflowStep {
  if (session.status === "scheduled" || session.status === "completed") return "scheduled";
  const livePoll = [...polls].find((poll) => poll.status === "active" || poll.status === "draft");
  if (livePoll) return stepForPollType(livePoll.type);
  if (session.status === "interest_check") return "interest";
  if (session.status === "topic_selection") return "topic";
  if (session.status === "availability_collection") return "availability";
  if (["polling", "needs_host_decision", "rescheduling", "scheduling_failed", "scheduling"].includes(session.status)) return "timing";
  return "draft";
}

function stepStatus(
  step: WorkflowStep,
  index: number,
  currentIndex: number,
  session: Session,
  polls: Poll[],
) {
  if (session.status === "cancelled") return index <= currentIndex ? "error" as const : "wait" as const;
  if (step === "scheduled" && session.scheduledStartTime) return "finish" as const;
  if (index < currentIndex) {
    return isOptionalWorkflowStep(step) && !pollsForStep(polls, step).length ? "skipped" as const : "finish" as const;
  }
  if (index === currentIndex) return "process" as const;
  if (pollsForStep(polls, step).some((poll) => poll.status === "closed" || poll.status === "superseded")) {
    return "finish" as const;
  }
  return "wait" as const;
}

function stepButtonTone(status: ReturnType<typeof stepStatus>, selected: boolean) {
  if (selected) return "border-zinc-950 bg-zinc-950 text-white shadow-sm";
  if (status === "finish") return "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300";
  if (status === "skipped") return "border-zinc-200 bg-zinc-100 text-zinc-500 hover:border-zinc-300";
  if (status === "process") return "border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-300";
  if (status === "error") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-700";
}

function stepCircleTone(status: ReturnType<typeof stepStatus>, selected: boolean) {
  if (selected) return "bg-white text-zinc-950";
  if (status === "finish") return "bg-emerald-100 text-emerald-700";
  if (status === "skipped") return "bg-zinc-200 text-zinc-500";
  if (status === "process") return "bg-blue-600 text-white";
  if (status === "error") return "bg-rose-100 text-rose-700";
  return "bg-zinc-100 text-zinc-600";
}

function isSkippedStep(step: WorkflowStep, currentStep: WorkflowStep, polls: Poll[]) {
  const stepIndex = workflowSteps.findIndex((item) => item.id === step);
  const currentIndex = workflowSteps.findIndex((item) => item.id === currentStep);
  return stepIndex < currentIndex && isOptionalWorkflowStep(step) && !pollsForStep(polls, step).length;
}

function isOptionalWorkflowStep(step: WorkflowStep) {
  return step === "interest" || step === "topic" || step === "availability";
}

function ActionLink({
  action,
  tone = "secondary",
  className = "",
}: {
  action: Pick<WorkflowAction, "href" | "label" | "confirmMessage">;
  tone?: "primary" | "secondary";
  className?: string;
}) {
  if (!action.confirmMessage) {
    return (
      <ButtonLink href={action.href} tone={tone} className={className}>
        {action.label}
      </ButtonLink>
    );
  }

  return (
    <ConfirmLink
      href={action.href}
      tone={tone}
      className={className}
      confirm={{
        title: action.label,
        message: action.confirmMessage,
        confirmLabel: action.label,
      }}
    >
      {action.label}
    </ConfirmLink>
  );
}

function pollsForStep(polls: Poll[], step: WorkflowStep) {
  if (step === "draft" || step === "scheduled") return [];
  return polls.filter((poll) => stepForPollType(poll.type) === step);
}

function preferredPollForStep(polls: Poll[]) {
  return polls.find((poll) => poll.status === "active")
    ?? polls.find((poll) => poll.status === "draft")
    ?? polls.find((poll) => poll.status === "closed")
    ?? polls[0];
}

function stepForPollType(type: Poll["type"]): WorkflowStep {
  if (type === "interest") return "interest";
  if (type === "topic") return "topic";
  if (type === "availability") return "availability";
  return "timing";
}

function emptyTitle(step: WorkflowStep, isCurrent: boolean) {
  if (isCurrent) return "Current Step";
  return `${workflowSteps.find((item) => item.id === step)?.label ?? "Step"} Not Started`;
}
