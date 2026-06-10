"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PollStatusBadge } from "@/components/common/Badge";
import { Button, ButtonLink } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";
import { TimeDisplay } from "@/components/common/TimeDisplay";
import { SuggestionPanel } from "@/components/polls/SuggestionPanel";
import { pollTypeLabels } from "@/lib/labels";
import type { Poll } from "@/types/domain";

export function PollWorkflowCard({
  poll,
  canManage,
}: {
  poll: Poll;
  canManage: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(poll.currentUserVoteIds);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const totalVotes = poll.options.reduce((sum, option) => sum + option.voteCount, 0);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggleOption(optionId: string) {
    const next = nextSelection(optionId);
    setSelected(next);
    if (!canManage && poll.status === "active") {
      void saveVote(next, optionId);
    }
  }

  function nextSelection(optionId: string) {
    if (poll.multiChoice) {
      return selected.includes(optionId)
        ? selected.filter((id) => id !== optionId)
        : [...selected, optionId];
    }
    return [optionId];
  }

  async function saveVote(optionIds: string[], sourceOptionId?: string) {
    if (optionIds.length === 0) return;
    setPending("vote");
    setMessage(null);
    const response = await fetch(`/api/v1/polls/${poll.id}/vote`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ option_ids: optionIds.map(Number) }),
    });
    setPending(null);
    if (!response.ok) {
      if (sourceOptionId) {
        setSelected(poll.currentUserVoteIds);
      }
      setMessage(await apiMessage(response, "Could not save your vote."));
      return;
    }
    setMessage(canManage ? "Your vote has been saved." : "Saved.");
    router.refresh();
  }

  async function action(path: string, label: string) {
    setPending(label);
    setMessage(null);
    const response = await fetch(path, { method: "POST" });
    setPending(null);
    if (!response.ok) {
      setMessage(await apiMessage(response, `Could not ${label}.`));
      return;
    }
    router.refresh();
  }

  async function promoteOption(optionId: string) {
    setPending(`promote-${optionId}`);
    setMessage(null);
    const response = await fetch(`/api/v1/poll-options/${optionId}/promote-to-final-timing`, {
      method: "POST",
    });
    setPending(null);
    if (!response.ok) {
      setMessage(await apiMessage(response, "Could not add this time to final timing."));
      return;
    }
    setMessage("Added to the final timing poll.");
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
          {poll.deadline && poll.status === "active" ? (
            <p className="mt-1 text-sm text-zinc-500">
              Open until {new Date(poll.deadline).toLocaleString()}
            </p>
          ) : null}
        </div>
        {canManage && poll.status === "active" ? (
          <Button
            tone="primary"
            disabled={pending === "close"}
            onClick={() => action(`/api/v1/polls/${poll.id}/close`, "close")}
          >
            {pending === "close" ? "Closing..." : poll.type === "final_timing" ? "Close & Schedule" : "Close Poll"}
          </Button>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {poll.options.length ? (
          poll.options.map((option) => {
            const checked = selectedSet.has(option.id);
            const percent = totalVotes ? Math.round((option.voteCount / totalVotes) * 100) : 0;
            const showResults = poll.resultsVisible || poll.status !== "active" || canManage;
            return (
              <button
                type="button"
                key={option.id}
                disabled={canManage || poll.status !== "active" || pending === "vote"}
                onClick={() => toggleOption(option.id)}
                className={`block w-full rounded-md border p-3 text-left transition ${
                  checked ? "border-blue-300 bg-blue-50" : "border-zinc-200 bg-white"
                } ${!canManage && poll.status === "active" ? "hover:border-zinc-400" : "cursor-default"} disabled:opacity-80`}
                aria-pressed={checked}
              >
                <div className="flex items-start gap-3">
                  {!canManage && poll.status === "active" ? (
                    <span
                      aria-hidden
                      className={`mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border ${
                        checked ? "border-blue-700 bg-blue-700" : "border-zinc-400 bg-white"
                      }`}
                    >
                      {checked ? <span className="size-1.5 rounded-full bg-white" /> : null}
                    </span>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-zinc-950">{option.label}</div>
                    {option.startAt ? <TimeDisplay start={option.startAt} end={option.endAt} /> : null}
                    {selectedSet.has(option.id) ? (
                      <div className="mt-1 text-xs font-medium text-blue-700">You voted for this</div>
                    ) : null}
                    {showResults ? (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-zinc-500">
                          <span>{option.voteCount} votes</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-zinc-100">
                          <div className="h-2 rounded-full bg-zinc-900" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Draft poll has no options and cannot be published.
          </div>
        )}
      </div>

      {message ? <p className="mt-3 text-sm text-zinc-700">{message}</p> : null}

      {poll.status === "active" && !canManage ? (
        <p className="mt-3 text-sm text-zinc-600">
          {pending === "vote" ? "Saving..." : "Tap an option to vote."}
        </p>
      ) : null}

      {poll.status === "closed" && !canManage ? (
        <p className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
          Voting is closed for this poll.
        </p>
      ) : null}

      {canManage && poll.status === "closed" && poll.type === "availability" ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-sm font-semibold text-emerald-950">Promote availability result</div>
          <p className="mt-1 text-sm text-emerald-800">
            Add a high-vote availability window to the final timing poll.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...poll.options]
              .filter((option) => option.startAt && option.endAt)
              .sort((a, b) => b.voteCount - a.voteCount)
              .slice(0, 3)
              .map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  disabled={pending === `promote-${option.id}`}
                  onClick={() => promoteOption(option.id)}
                >
                  {pending === `promote-${option.id}` ? "Adding..." : `Use ${option.label}`}
                </Button>
              ))}
          </div>
        </div>
      ) : null}

      {canManage && poll.status === "draft" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={`/sessions/${poll.sessionId}/polls/${poll.id}/edit`} tone="primary">
            Edit
          </ButtonLink>
          <Button
            disabled={!poll.options.length || !poll.deadline || pending === "publish"}
            onClick={() => action(`/api/v1/polls/${poll.id}/publish`, "publish")}
          >
            {pending === "publish" ? "Opening..." : "Open Voting"}
          </Button>
        </div>
      ) : null}

      {poll.acceptsSuggestions ? (
        canManage ? (
          <details className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-950">
              Suggestions {poll.suggestions.length ? `(${poll.suggestions.length})` : ""}
            </summary>
            <div className="mt-3">
              <SuggestionPanel
                pollId={poll.id}
                pollType={poll.type}
                pollStatus={poll.status}
                suggestions={poll.suggestions}
                canManage={canManage}
              />
            </div>
          </details>
        ) : poll.status === "draft" || (poll.status === "active" && poll.type === "topic") ? (
          <div className="mt-4">
            <SuggestionPanel
              pollId={poll.id}
              pollType={poll.type}
              pollStatus={poll.status}
              suggestions={poll.suggestions}
              canManage={canManage}
            />
          </div>
        ) : null
      ) : null}
    </Card>
  );
}

async function apiMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return body?.error?.message ?? fallback;
}
