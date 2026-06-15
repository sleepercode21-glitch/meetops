"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PollStatusBadge } from "@/components/common/Badge";
import { ButtonLink } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";
import { TimeDisplay } from "@/components/common/TimeDisplay";
import { pollTypeLabels } from "@/lib/labels";
import { relativeDeadline } from "@/lib/date-time";
import type { Poll } from "@/types/domain";

export function PollCard({ poll }: { poll: Poll }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(poll.currentUserVoteIds);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const totalVotes = poll.options.reduce((sum, option) => sum + option.voteCount, 0);
  const isActive = poll.status === "active";
  const isAvailabilityPoll = poll.type === "availability";
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function nextSelection(optionId: string) {
    if (!poll.multiChoice) return [optionId];
    return selected.includes(optionId)
      ? selected.filter((id) => id !== optionId)
      : [...selected, optionId];
  }

  async function saveVote(optionId: string) {
    if (!isActive || pending || isAvailabilityPoll) return;
    const next = nextSelection(optionId);
    if (!next.length) return;
    setSelected(next);
    setPending(true);
    setMessage(null);

    const response = await fetch(`/api/v1/polls/${poll.id}/vote`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ option_ids: next.map(Number) }),
    });

    setPending(false);
    if (!response.ok) {
      setSelected(poll.currentUserVoteIds);
      setMessage(await apiMessage(response, "Could not save your vote."));
      return;
    }

    setMessage("Saved.");
    router.refresh();
  }

  return (
    <Card>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-zinc-950">{pollTypeLabels[poll.type]}</h2>
            <PollStatusBadge status={poll.status} />
            {poll.multiChoice ? (
              <span className="rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600">
                Multiple choice
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-zinc-500">{relativeDeadline(poll.deadline)}</p>
        </div>
        <ButtonLink href={`/sessions/${poll.sessionId}`} tone={isActive ? "primary" : "secondary"}>
          Open Session
        </ButtonLink>
      </div>
      <div className="mt-4 space-y-2">
        {poll.options.length ? (
          poll.options.map((option) => {
            const optionSelected = selectedSet.has(option.id);
            const percent = totalVotes ? Math.round((option.voteCount / totalVotes) * 100) : 0;
            const hasTimeWindow = Boolean(option.startAt && option.endAt);
            const showLabel = !hasTimeWindow || !isGeneratedTimeLabel(option.label);
            const markerClass = poll.multiChoice
              ? "rounded border"
              : "rounded-full border";
            const markerSelectedClass = poll.multiChoice
              ? "border-blue-700 bg-blue-700"
              : "border-blue-700 bg-blue-700";
            const markerIdleClass = "border-zinc-400 bg-white";
            const rowClass = `block w-full rounded-md border p-3 text-left transition ${
              optionSelected ? "border-blue-300 bg-blue-50" : "border-zinc-200 bg-white"
            } ${isActive && !isAvailabilityPoll ? "hover:border-zinc-400" : "cursor-default"} disabled:opacity-80`;
            const content = (
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className={`mt-1 flex size-4 shrink-0 items-center justify-center ${markerClass} ${
                    optionSelected ? markerSelectedClass : markerIdleClass
                  }`}
                >
                  {optionSelected ? <span className={poll.multiChoice ? "size-2 rounded-sm bg-white" : "size-1.5 rounded-full bg-white"} /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  {hasTimeWindow ? (
                    <TimeDisplay start={option.startAt} end={option.endAt} />
                  ) : null}
                  {showLabel ? (
                    <div className={hasTimeWindow ? "mt-1 text-sm text-zinc-500" : "font-medium text-zinc-950"}>
                      {option.label}
                    </div>
                  ) : null}
                  {optionSelected ? (
                    <div className="mt-1 text-xs font-medium text-blue-700">
                      You voted for this
                    </div>
                  ) : null}
                  {!isActive ? (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-zinc-500">
                        <span>{option.voteCount} votes</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-zinc-100">
                        <div
                          className="h-2 rounded-full bg-zinc-900"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
            if (isAvailabilityPoll) {
              return (
                <div key={option.id} className={rowClass}>
                  {content}
                </div>
              );
            }
            return (
              <button
                type="button"
                key={option.id}
                disabled={!isActive || pending}
                onClick={() => saveVote(option.id)}
                className={rowClass}
                aria-pressed={optionSelected}
              >
                {content}
              </button>
            );
          })
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Draft poll has no options and cannot be published.
          </div>
        )}
      </div>
      {isActive ? (
        <p className="mt-3 text-sm text-zinc-600">
          {isAvailabilityPoll
            ? "Open the session to enter the exact time you are free."
            : pending
              ? "Saving..."
              : "Click an option to save your vote. Click another option to change it."}
        </p>
      ) : null}
      {message ? <p className="mt-2 text-sm text-zinc-700">{message}</p> : null}
      {poll.status === "draft" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={`/sessions/${poll.sessionId}/polls/${poll.id}/edit`} tone="primary">
            Edit draft
          </ButtonLink>
        </div>
      ) : null}
    </Card>
  );
}

function isGeneratedTimeLabel(label: string) {
  return /^\d{4}-\d{2}-\d{2}T/.test(label) || label.includes(".000Z - ");
}

async function apiMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return body?.error?.message ?? fallback;
}
