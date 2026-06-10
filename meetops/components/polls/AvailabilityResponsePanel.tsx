"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Buttons";
import { TimeDisplay } from "@/components/common/TimeDisplay";
import type { Poll } from "@/types/domain";

type ExistingResponse = {
  option_id: number;
  start_at: string;
  end_at: string;
};

type Recommendation = {
  source_option_id: number;
  start_at: string;
  end_at: string;
  available_count: number;
  duration_minutes: number;
};

export function AvailabilityResponsePanel({
  poll,
  canManage,
}: {
  poll: Poll;
  canManage: boolean;
}) {
  if (canManage && poll.status === "closed") {
    return <AvailabilityRecommendations poll={poll} />;
  }

  if (!canManage && poll.status === "active") {
    return <MemberAvailabilityForm poll={poll} />;
  }

  return null;
}

function MemberAvailabilityForm({ poll }: { poll: Poll }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, { start: string; end: string }>>({});
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/v1/polls/${poll.id}/availability-responses`)
      .then((response) => response.ok ? response.json() : null)
      .then((body: { data?: ExistingResponse[] } | null) => {
        if (!mounted || !body?.data) return;
        const next: Record<string, { start: string; end: string }> = {};
        for (const item of body.data) {
          next[String(item.option_id)] = {
            start: toLocalDateTime(item.start_at),
            end: toLocalDateTime(item.end_at),
          };
        }
        setValues(next);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [poll.id]);

  async function submit(optionId: string) {
    const value = values[optionId];
    if (!value?.start || !value?.end) {
      setMessage("Choose when you are free inside that window.");
      return;
    }
    setPending(optionId);
    setMessage(null);
    const response = await fetch(`/api/v1/polls/${poll.id}/availability-responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        option_id: Number(optionId),
        start_at: new Date(value.start).toISOString(),
        end_at: new Date(value.end).toISOString(),
      }),
    });
    setPending(null);
    if (!response.ok) {
      setMessage(await apiMessage(response, "Could not save availability."));
      return;
    }
    setMessage("Availability saved.");
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-zinc-600">
        For each host window, choose the exact time range where you are free.
      </p>
      {poll.options.map((option) => {
        const value = values[option.id] ?? { start: "", end: "" };
        return (
          <div key={option.id} className="rounded-md border border-zinc-200 bg-white p-3">
            <div className="font-medium text-zinc-950">{option.label}</div>
            {option.startAt ? <TimeDisplay start={option.startAt} end={option.endAt} /> : null}
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                type="datetime-local"
                value={value.start}
                min={toLocalDateTime(option.startAt)}
                max={toLocalDateTime(option.endAt)}
                className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm"
                onChange={(event) => setValues((current) => ({
                  ...current,
                  [option.id]: { ...value, start: event.target.value },
                }))}
              />
              <input
                type="datetime-local"
                value={value.end}
                min={value.start || toLocalDateTime(option.startAt)}
                max={toLocalDateTime(option.endAt)}
                className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm"
                onChange={(event) => setValues((current) => ({
                  ...current,
                  [option.id]: { ...value, end: event.target.value },
                }))}
              />
              <Button type="button" disabled={pending === option.id} onClick={() => submit(option.id)}>
                {pending === option.id ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        );
      })}
      {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
    </div>
  );
}

function AvailabilityRecommendations({ poll }: { poll: Poll }) {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetch(`/api/v1/polls/${poll.id}/availability-recommendations`)
      .then((response) => response.ok ? response.json() : null)
      .then((body: { data?: Recommendation[] } | null) => {
        if (mounted && body?.data) setRecommendations(body.data);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [poll.id]);

  async function promote(recommendation: Recommendation) {
    const key = `${recommendation.start_at}-${recommendation.end_at}`;
    setPending(key);
    setMessage(null);
    const response = await fetch(`/api/v1/polls/${poll.id}/promote-availability-recommendation`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        start_at: recommendation.start_at,
        end_at: recommendation.end_at,
        label: `${recommendation.available_count} available`,
      }),
    });
    setPending(null);
    if (!response.ok) {
      setMessage(await apiMessage(response, "Could not add recommendation."));
      return;
    }
    setMessage("Added to the final timing poll.");
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3">
      <div className="text-sm font-semibold text-emerald-950">Best overlap times</div>
      <div className="mt-3 space-y-2">
        {recommendations.length ? recommendations.map((recommendation) => {
          const key = `${recommendation.start_at}-${recommendation.end_at}`;
          return (
            <div key={key} className="rounded-md border border-emerald-200 bg-white p-3">
              <div className="text-sm font-medium text-zinc-950">
                {recommendation.available_count} member{recommendation.available_count === 1 ? "" : "s"} available
              </div>
              <TimeDisplay start={recommendation.start_at} end={recommendation.end_at} />
              <Button type="button" className="mt-3" disabled={pending === key} onClick={() => promote(recommendation)}>
                {pending === key ? "Adding..." : "Add to Final Timing"}
              </Button>
            </div>
          );
        }) : (
          <p className="text-sm text-emerald-800">No member availability responses yet.</p>
        )}
      </div>
      {message ? <p className="mt-3 text-sm text-emerald-900">{message}</p> : null}
    </div>
  );
}

function toLocalDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

async function apiMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return body?.error?.message ?? fallback;
}
