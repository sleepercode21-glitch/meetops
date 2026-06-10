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
  const hasVoted = poll.currentUserVoteIds.length > 0;
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

  async function submitVote() {
    await saveVote(selected);
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

  async function clearVote() {
    setPending("clear");
    setMessage(null);
    const response = await fetch(`/api/v1/polls/${poll.id}/vote`, { method: "DELETE" });
    setPending(null);
    if (!response.ok) {
      setMessage(await apiMessage(response, "Could not clear your vote."));
      return;
    }
    setSelected([]);
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
          {poll.deadline ? (
            <p className="mt-1 text-sm text-zinc-500">
              Closes {new Date(poll.deadline).toLocaleString()}
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
              <label
                key={option.id}
                className={`block rounded-md border p-3 ${
                  checked ? "border-blue-300 bg-blue-50" : "border-zinc-200 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    checked={checked}
                    disabled={poll.status !== "active" || pending === "vote"}
                    type={poll.multiChoice ? "checkbox" : "radio"}
                    name={poll.id}
                    className="mt-1"
                    onChange={() => toggleOption(option.id)}
                  />
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
              </label>
            );
          })
        ) : (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Draft poll has no options and cannot be published.
          </div>
        )}
      </div>

      {message ? <p className="mt-3 text-sm text-zinc-700">{message}</p> : null}

      {poll.status === "active" && canManage ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            tone="primary"
            disabled={pending === "vote" || selected.length === 0}
            onClick={submitVote}
          >
            {pending === "vote" ? "Saving..." : hasVoted ? "Update Vote" : "Submit Vote"}
          </Button>
          {hasVoted ? (
            <Button disabled={pending === "clear"} onClick={clearVote}>
              {pending === "clear" ? "Clearing..." : "Clear Vote"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {poll.status === "active" && !canManage ? (
        <p className="mt-3 text-sm text-zinc-600">
          {pending === "vote" ? "Saving your choice..." : "Click an option to vote. Click another option to change it."}
        </p>
      ) : null}

      {canManage && poll.status === "draft" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={`/sessions/${poll.sessionId}/polls/${poll.id}/edit`} tone="primary">
            Edit Draft
          </ButtonLink>
          <Button
            disabled={!poll.options.length || !poll.deadline || pending === "publish"}
            onClick={() => action(`/api/v1/polls/${poll.id}/publish`, "publish")}
          >
            {pending === "publish" ? "Publishing..." : "Publish Poll"}
          </Button>
        </div>
      ) : null}

      {poll.acceptsSuggestions ? (
        <div className="mt-4">
          <SuggestionPanel
            pollId={poll.id}
            pollType={poll.type}
            pollStatus={poll.status}
            suggestions={poll.suggestions}
            canManage={canManage}
          />
        </div>
      ) : null}
    </Card>
  );
}

async function apiMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return body?.error?.message ?? fallback;
}
