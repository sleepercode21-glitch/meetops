"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Buttons";
import { SectionTitle } from "@/components/common/Card";
import type { PollType, Suggestion } from "@/types/domain";

export function SuggestionPanel({
  pollId,
  pollType,
  pollStatus,
  suggestions,
  canManage,
}: {
  pollId: string;
  pollType: PollType;
  pollStatus: "draft" | "active" | "closed" | "cancelled" | "superseded";
  suggestions: Suggestion[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [suggestion, setSuggestion] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const acceptsSuggestions = pollStatus === "draft" || pollStatus === "active";

  async function submitSuggestion() {
    if (!suggestion.trim()) return;
    setPending("suggest");
    setMessage(null);
    const response = await fetch(`/api/v1/polls/${pollId}/suggestions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ suggestion }),
    });
    setPending(null);
    if (!response.ok) {
      setMessage(await apiMessage(response, "Could not submit suggestion."));
      return;
    }
    setSuggestion("");
    router.refresh();
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <SectionTitle
        title="Member Suggestions"
        subtitle="Suggestions are ideas for the host. They are not voteable until added as official options."
      />
      {acceptsSuggestions ? (
        <div className="flex gap-2">
          <input
            value={suggestion}
            className="min-h-10 flex-1 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-zinc-900"
            placeholder="Suggest an option"
            onChange={(event) => setSuggestion(event.target.value)}
          />
          <Button type="button" tone="primary" disabled={pending === "suggest"} onClick={submitSuggestion}>
            {pending === "suggest" ? "Submitting..." : "Submit"}
          </Button>
        </div>
      ) : null}
      {message ? <p className="mt-3 text-sm text-rose-700">{message}</p> : null}
      <div className="mt-4 space-y-3">
        {suggestions.length ? (
          suggestions.map((item) => (
            <SuggestionRow
              key={item.id}
              suggestion={item}
              pollType={pollType}
              canConvert={canManage && pollStatus === "draft"}
            />
          ))
        ) : (
          <p className="text-sm text-zinc-500">No suggestions yet.</p>
        )}
      </div>
    </div>
  );
}

function SuggestionRow({
  suggestion,
  pollType,
  canConvert,
}: {
  suggestion: Suggestion;
  pollType: PollType;
  canConvert: boolean;
}) {
  const router = useRouter();
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const timeBased = pollType === "availability" || pollType === "final_timing";

  async function convert() {
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/v1/suggestions/${suggestion.id}/convert-to-option`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label: suggestion.text,
        start_at: timeBased && startAt ? new Date(startAt).toISOString() : null,
        end_at: timeBased && endAt ? new Date(endAt).toISOString() : null,
      }),
    });
    setPending(false);
    if (!response.ok) {
      setMessage(await apiMessage(response, "Could not add suggestion as an option."));
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-md border border-zinc-200 p-3">
      <div className="mb-1 text-xs font-medium uppercase text-zinc-500">Suggestion</div>
      <p className="text-sm text-zinc-900">{suggestion.text}</p>
      <div className="mt-2 text-xs text-zinc-500">{suggestion.authorName}</div>
      {canConvert ? (
        <div className="mt-3 grid gap-2">
          {timeBased ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="datetime-local"
                value={startAt}
                className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm"
                onChange={(event) => setStartAt(event.target.value)}
              />
              <input
                type="datetime-local"
                value={endAt}
                className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm"
                onChange={(event) => setEndAt(event.target.value)}
              />
            </div>
          ) : null}
          <Button type="button" className="justify-self-start" disabled={pending} onClick={convert}>
            {pending ? "Adding..." : "Add as official option"}
          </Button>
          {message ? <p className="text-sm text-rose-700">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

async function apiMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return body?.error?.message ?? fallback;
}
