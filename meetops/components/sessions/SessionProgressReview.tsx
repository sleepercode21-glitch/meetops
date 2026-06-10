"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/common/Buttons";
import { TimeDisplay } from "@/components/common/TimeDisplay";
import { PollWorkflowCard } from "@/components/polls/PollWorkflowCard";
import { calendarInvitePolicyLabels } from "@/lib/labels";
import type { Poll, PollType, Session } from "@/types/domain";

export type ProgressStep =
  | "draft"
  | "interest"
  | "topic"
  | "availability"
  | "timing"
  | "scheduling"
  | "scheduled"
  | "cancelled"
  | "completed";

export function SessionProgressReview({
  title,
  steps,
  currentStep,
  polls,
  session,
  canManage,
  currentContent,
}: {
  title: string;
  steps: ProgressStep[];
  currentStep: ProgressStep;
  polls: Poll[];
  session: Session;
  canManage: boolean;
  currentContent?: ReactNode;
}) {
  const [selectedStep, setSelectedStep] = useState(currentStep);
  const selectedPolls = useMemo(
    () => polls.filter((poll) => stepForPollType(poll.type) === selectedStep),
    [polls, selectedStep],
  );
  const selectedState = stepState(selectedStep, currentStep, steps, selectedPolls, polls, session);
  const selectedIsCurrent = selectedStep === currentStep;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-sm font-semibold text-zinc-950">{title}</div>
      <div className="flex flex-wrap gap-2">
        {steps.map((step, index) => {
          const state = stepState(
            step,
            currentStep,
            steps,
            polls.filter((poll) => stepForPollType(poll.type) === step),
            polls,
            session,
          );
          const active = selectedStep === step;
          return (
            <button
              key={step}
              type="button"
              className={`flex min-h-12 items-center gap-2 rounded-full border px-3 py-2 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${stepTone(state, active)}`}
              onClick={() => setSelectedStep(step)}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-current bg-white/10 text-xs font-semibold">
                {state === "done" ? "✓" : index + 1}
              </span>
              <span className="text-sm font-semibold leading-tight">{stepLabels[step]}</span>
            </button>
          );
        })}
      </div>

      <div id={`step-${selectedStep}`} className="mt-4 scroll-mt-24 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-950">{stepLabels[selectedStep]}</h2>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${badgeTone(selectedState)}`}>
            {selectedState === "now" ? "Now" : selectedState === "done" ? "Done" : "Waiting"}
          </span>
        </div>

        <div className="mt-3">
          {selectedIsCurrent && currentContent ? (
            currentContent
          ) : selectedIsCurrent && hasLivePoll(selectedPolls) ? (
            <p className="text-sm text-zinc-600">This checkpoint is active.</p>
          ) : selectedPolls.length ? (
            <div className="space-y-3">
              {selectedPolls.map((poll) => (
                <PollWorkflowCard
                  key={poll.id}
                  poll={poll}
                  canManage={canManage && (selectedIsCurrent || poll.status === "closed")}
                />
              ))}
            </div>
          ) : (
            <EmptyStepReview
              step={selectedStep}
              session={session}
              state={selectedState}
              canManage={canManage}
            />
          )}
        </div>
      </div>
    </section>
  );
}

const stepLabels: Record<ProgressStep, string> = {
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

function stepForPollType(type: PollType): ProgressStep {
  if (type === "interest") return "interest";
  if (type === "topic") return "topic";
  if (type === "availability") return "availability";
  return "timing";
}

function stepState(
  step: ProgressStep,
  currentStep: ProgressStep,
  steps: ProgressStep[],
  stepPolls: Poll[],
  allPolls: Poll[],
  session: Session,
) {
  if (step === currentStep) return "now";
  if (step === "draft") return allPolls.length || currentStep !== "draft" ? "done" : "now";
  if (step === "scheduled") return session.scheduledStartTime ? "done" : "waiting";
  if (step === "completed") return session.status === "completed" ? "done" : "waiting";
  if (step === "scheduling") {
    return ["scheduled", "completed"].includes(session.status) ? "done" : "waiting";
  }
  if (stepPolls.some((poll) => poll.status === "closed" || poll.status === "superseded")) return "done";
  return steps.indexOf(step) < steps.indexOf(currentStep) ? "done" : "waiting";
}

function hasLivePoll(polls: Poll[]) {
  return polls.some((poll) => poll.status === "active" || poll.status === "draft");
}

function stepTone(state: string, active: boolean) {
  if (active || state === "now") return "border-zinc-950 bg-zinc-950 text-white shadow-sm";
  if (state === "done") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-zinc-200 bg-zinc-50 text-zinc-500";
}

function badgeTone(state: string) {
  if (state === "now") return "border-zinc-950 bg-zinc-950 text-white";
  if (state === "done") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-zinc-200 bg-white text-zinc-500";
}

function EmptyStepReview({
  step,
  session,
  state,
  canManage,
}: {
  step: ProgressStep;
  session: Session;
  state: string;
  canManage: boolean;
}) {
  if (step === "draft") {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Detail label="Topic" value={session.topic ?? "Untitled session"} />
          <Detail label="Invite policy" value={calendarInvitePolicyLabels[session.calendarInvitePolicy]} />
        </div>
        {session.description ? (
          <div className="mt-3">
            <Detail label="Description" value={session.description} />
          </div>
        ) : null}
        {canManage && !["cancelled", "completed"].includes(session.status) ? (
          <ButtonLink href={`/sessions/${session.id}/edit`} tone="primary" className="mt-4">
            Edit Details
          </ButtonLink>
        ) : null}
      </div>
    );
  }

  if (step === "scheduled" && session.scheduledStartTime) {
    return <TimeDisplay start={session.scheduledStartTime} end={session.scheduledEndTime} />;
  }

  const text =
    state === "waiting"
      ? "This checkpoint has not started yet."
      : "No poll was created for this checkpoint.";

  return <p className="text-sm text-zinc-600">{text}</p>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase text-zinc-500">{label}</div>
      <div className="mt-1 text-sm text-zinc-950">{value}</div>
    </div>
  );
}
