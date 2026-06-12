"use client";

import { useState } from "react";
import { ButtonLink } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";
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
};

const workflowSteps: { id: WorkflowStep; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "interest", label: "Interest" },
  { id: "topic", label: "Topic" },
  { id: "availability", label: "Availability" },
  { id: "timing", label: "Timing" },
  { id: "scheduled", label: "Scheduled" },
];

export function SessionWorkflowStepper({
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
  const currentStep = currentWorkflowStep(session, polls);
  const [selectedStep, setSelectedStep] = useState<WorkflowStep>(currentStep);
  const currentIndex = workflowSteps.findIndex((step) => step.id === currentStep);
  const selectedIndex = workflowSteps.findIndex((step) => step.id === selectedStep);

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-zinc-200 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-950">Flow</h2>
            <p className="mt-0.5 text-sm text-zinc-600">Click any reached step to review it.</p>
          </div>
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-600">
            Step {selectedIndex + 1} of {workflowSteps.length}
          </span>
        </div>
        <div className="overflow-x-auto pb-1">
          <div className="flex min-w-[680px] items-center gap-2">
            {workflowSteps.map((step, index) => {
              const status = stepStatus(step.id, index, currentIndex, session, polls);
              const selected = selectedStep === step.id;
              return (
                <div key={step.id} className="flex flex-1 items-center gap-2 last:flex-none">
                  <button
                    type="button"
                    onClick={() => setSelectedStep(step.id)}
                    className={`group flex min-h-10 items-center gap-2 rounded-full border px-2 py-1.5 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${stepButtonTone(status, selected)}`}
                    aria-current={selected ? "step" : undefined}
                  >
                    <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${stepCircleTone(status, selected)}`}>
                      {status === "finish" ? <span className="size-2.5 rounded-full bg-current" /> : index + 1}
                    </span>
                    <span className="whitespace-nowrap text-sm font-semibold">{step.label}</span>
                  </button>
                  {index < workflowSteps.length - 1 ? (
                    <div className={`h-px flex-1 ${index < currentIndex ? "bg-emerald-300" : "bg-zinc-300"}`} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-zinc-50/60 p-4">
        <SelectedStepPanel
          session={session}
          polls={polls}
          step={selectedStep}
          currentStep={currentStep}
          canManage={canManage}
          nextAction={nextAction}
        />
      </div>
    </Card>
  );
}

function SelectedStepPanel({
  session,
  polls,
  step,
  currentStep,
  canManage,
  nextAction,
}: {
  session: Session;
  polls: Poll[];
  step: WorkflowStep;
  currentStep: WorkflowStep;
  canManage: boolean;
  nextAction?: WorkflowAction;
}) {
  if (step === "draft") {
    return <DraftReview session={session} canManage={canManage} />;
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
  const stepAction = hostActionForStep(session.id, step, polls);
  const actionForEmptyCurrent = stepAction ?? nextAction;
  const rerunAction = rerunActionForStep(session.id, step, stepPolls);

  if (selectedPoll) {
    return (
      <div className="space-y-4">
        <PollWorkflowCard poll={selectedPoll} canManage={canManage && isCurrent} />
        {canManage && selectedPoll.status === "closed" ? (
          <StepActionCard
            nextAction={isCurrent ? actionForEmptyCurrent : undefined}
            rerunAction={rerunAction}
          />
        ) : null}
        {previousPolls.length ? (
          <PreviousPolls polls={previousPolls} canManage={canManage} />
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
      {isCurrent && canManage && actionForEmptyCurrent ? (
        <ButtonLink href={actionForEmptyCurrent.href} tone="primary" className="mt-4 w-full sm:w-auto">
          {actionForEmptyCurrent.label}
        </ButtonLink>
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
  };
}

function DraftReview({ session, canManage }: { session: Session; canManage: boolean }) {
  return (
    <Card className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-zinc-950">Draft</h3>
          <p className="mt-1 text-sm text-zinc-600">
            {session.description || "Session details are ready to edit before the flow moves forward."}
          </p>
        </div>
        {canManage && !["cancelled", "completed"].includes(session.status) ? (
          <ButtonLink href={`/sessions/${session.id}/edit`} tone="primary" className="w-full sm:w-auto">
            Edit Details
          </ButtonLink>
        ) : null}
      </div>
    </Card>
  );
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
          <ButtonLink href={`/sessions/${session.id}/polls/new?type=availability`} className="w-full sm:w-auto">
            Collect Availability Again
          </ButtonLink>
          <ButtonLink href={`/sessions/${session.id}/polls/new?type=final_timing`} className="w-full sm:w-auto">
            Run Timing Again
          </ButtonLink>
          <ButtonLink href={`/sessions/${session.id}/reschedule`} className="w-full sm:w-auto">
            Pick Time Manually
          </ButtonLink>
        </div>
      ) : null}
    </Card>
  );
}

function StepActionCard({
  nextAction,
  rerunAction,
}: {
  nextAction?: WorkflowAction;
  rerunAction?: WorkflowAction;
}) {
  if (!nextAction && !rerunAction) return null;
  return (
    <Card>
      <div className="grid gap-3 md:grid-cols-2">
        {nextAction ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <h3 className="text-base font-semibold text-emerald-950">{nextAction.heading}</h3>
            <p className="mt-1 text-sm text-emerald-800">{nextAction.description}</p>
            <ButtonLink href={nextAction.href} tone="primary" className="mt-4 w-full">
              {nextAction.label}
            </ButtonLink>
          </div>
        ) : null}
        {rerunAction ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <h3 className="text-base font-semibold text-zinc-950">{rerunAction.heading}</h3>
            <p className="mt-1 text-sm text-zinc-600">{rerunAction.description}</p>
            <ButtonLink href={rerunAction.href} className="mt-4 w-full">
              {rerunAction.label}
            </ButtonLink>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function PreviousPolls({ polls, canManage }: { polls: Poll[]; canManage: boolean }) {
  return (
    <details className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-700">
        Previous polls ({polls.length})
      </summary>
      <div className="mt-3 space-y-3">
        {polls.map((poll) => (
          <PollWorkflowCard key={poll.id} poll={poll} canManage={canManage && poll.status === "closed"} />
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
  if (index < currentIndex) return "finish" as const;
  if (index === currentIndex) return "process" as const;
  if (pollsForStep(polls, step).some((poll) => poll.status === "closed" || poll.status === "superseded")) {
    return "finish" as const;
  }
  return "wait" as const;
}

function stepButtonTone(status: ReturnType<typeof stepStatus>, selected: boolean) {
  if (selected) return "border-zinc-950 bg-zinc-950 text-white shadow-sm";
  if (status === "finish") return "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-300";
  if (status === "process") return "border-blue-200 bg-blue-50 text-blue-800 hover:border-blue-300";
  if (status === "error") return "border-rose-200 bg-rose-50 text-rose-800";
  return "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-700";
}

function stepCircleTone(status: ReturnType<typeof stepStatus>, selected: boolean) {
  if (selected) return "bg-white text-zinc-950";
  if (status === "finish") return "bg-emerald-100 text-emerald-700";
  if (status === "process") return "bg-blue-600 text-white";
  if (status === "error") return "bg-rose-100 text-rose-700";
  return "bg-zinc-100 text-zinc-600";
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
