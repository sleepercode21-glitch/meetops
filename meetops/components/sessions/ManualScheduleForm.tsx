"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/common/Buttons";
import { formatDateRange } from "@/lib/date-time";
import type { PollOption } from "@/types/domain";

export function ManualScheduleForm({
  sessionId,
  options,
  hostTimezone,
  viewerTimezone,
}: {
  sessionId: string;
  options: PollOption[];
  hostTimezone?: string;
  viewerTimezone?: string;
}) {
  const router = useRouter();
  const displayTimezone = useViewerTimezone(viewerTimezone);
  const sourceTimezone = hostTimezone || displayTimezone;
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
            <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm transition hover:border-zinc-300">
              <input
                type="radio"
                name="selected_option"
                value={option.id}
                checked={selectedOptionId === option.id}
                onChange={() => setSelectedOptionId(option.id)}
                className="mt-1"
              />
              <OptionTimeLabel option={option} hostTimezone={sourceTimezone} viewerTimezone={displayTimezone} />
            </label>
          ))}
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 text-sm transition hover:border-zinc-300">
            <input
              type="radio"
              name="selected_option"
              checked={!selectedOptionId}
              onChange={() => setSelectedOptionId("")}
              className="mt-1"
            />
            <span className="font-medium text-zinc-950">Choose a custom time</span>
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
        <ButtonLink href={`/sessions/${sessionId}/polls/new?type=final_timing`}>Run Another Timing Poll</ButtonLink>
      </div>
    </div>
  );
}

function OptionTimeLabel({
  option,
  hostTimezone,
  viewerTimezone,
}: {
  option: PollOption;
  hostTimezone: string;
  viewerTimezone: string;
}) {
  if (!option.startAt) {
    return <span className="font-medium text-zinc-950">{option.label}</span>;
  }

  const hostText = formatDateRange(option.startAt, option.endAt, hostTimezone);
  const viewerText = formatDateRange(option.startAt, option.endAt, viewerTimezone);
  const sameZone = hostTimezone === viewerTimezone;
  return (
    <span className="min-w-0">
      <span className="block font-medium text-zinc-950">{hostText}</span>
      <span className="mt-1 block text-xs text-zinc-500">Host time · {zoneLabel(hostTimezone)}</span>
      {!sameZone ? (
        <span className="mt-1 block text-sm font-medium text-teal-800">
          Your time · {viewerText} ({zoneLabel(viewerTimezone)})
        </span>
      ) : null}
      {option.label && !isGeneratedTimeLabel(option.label) ? (
        <span className="mt-1 block text-xs text-zinc-500">{option.label}</span>
      ) : null}
    </span>
  );
}

function toLocalDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function useViewerTimezone(savedTimezone?: string) {
  return useSyncExternalStore(
    () => () => undefined,
    () => savedTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    () => savedTimezone || "UTC",
  );
}

function zoneLabel(timeZone: string) {
  if (timeZone === "America/Phoenix") return "Arizona time";
  return timeZone.replaceAll("_", " ");
}

function isGeneratedTimeLabel(label: string) {
  return /^\d{4}-\d{2}-\d{2}T.* - \d{4}-\d{2}-\d{2}T/.test(label);
}
