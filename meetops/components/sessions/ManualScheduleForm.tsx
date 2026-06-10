"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/common/Buttons";
import type { PollOption } from "@/types/domain";

export function ManualScheduleForm({
  sessionId,
  options,
}: {
  sessionId: string;
  options: PollOption[];
}) {
  const router = useRouter();
  const [selectedOptionId, setSelectedOptionId] = useState(options[0]?.id ?? "");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [minimumDateTime] = useState(() => toLocalDateTime(new Date(Date.now() + 60_000).toISOString()));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    const useOption = Boolean(selectedOptionId);
    if (!useOption && (!startAt || !endAt || startAt < minimumDateTime || endAt <= startAt)) {
      setPending(false);
      setError("Choose a future start time and an end time after it.");
      return;
    }
    const response = await fetch(`/api/v1/sessions/${sessionId}/manual-schedule`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        useOption
          ? { selected_option_id: Number(selectedOptionId) }
          : {
              start_at: startAt ? new Date(startAt).toISOString() : null,
              end_at: endAt ? new Date(endAt).toISOString() : null,
            },
      ),
    });
    setPending(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error?.message ?? "Could not schedule session.");
      return;
    }
    router.push(`/sessions/${sessionId}`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {options.length ? (
        <div className="space-y-2">
          {options.map((option) => (
            <label key={option.id} className="block rounded-md border border-zinc-200 p-3 text-sm">
              <input
                type="radio"
                name="selected_option"
                value={option.id}
                checked={selectedOptionId === option.id}
                onChange={() => setSelectedOptionId(option.id)}
                className="mr-2"
              />
              {option.label}
            </label>
          ))}
          <label className="block rounded-md border border-zinc-200 p-3 text-sm">
            <input
              type="radio"
              name="selected_option"
              checked={!selectedOptionId}
              onChange={() => setSelectedOptionId("")}
              className="mr-2"
            />
            Choose a custom time
          </label>
        </div>
      ) : null}
      {!selectedOptionId ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Start</span>
            <input type="datetime-local" value={startAt} min={minimumDateTime} onChange={(event) => setStartAt(event.target.value)} className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">End</span>
            <input type="datetime-local" value={endAt} min={startAt || minimumDateTime} onChange={(event) => setEndAt(event.target.value)} className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm" />
          </label>
        </div>
      ) : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button tone="primary" disabled={pending} onClick={submit}>
          {pending ? "Scheduling..." : selectedOptionId ? "Schedule This Time" : "Schedule Custom Time"}
        </Button>
        <ButtonLink href={`/sessions/${sessionId}/polls/new`}>Run Another Timing Poll</ButtonLink>
      </div>
    </div>
  );
}

function toLocalDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
