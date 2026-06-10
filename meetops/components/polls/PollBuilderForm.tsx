"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Buttons";
import type { PollType } from "@/types/domain";

type DraftOption = {
  id?: string;
  label: string;
  start_at: string;
  end_at: string;
  deleted?: boolean;
};

export function PollBuilderForm({
  sessionId,
  existingPoll,
}: {
  sessionId: string;
  existingPoll?: {
    id: string;
    type: PollType;
    multiChoice: boolean;
    deadline?: string;
    options: { id: string; label: string; startAt?: string; endAt?: string }[];
  };
}) {
  const router = useRouter();
  const [pollType, setPollType] = useState<PollType>(existingPoll?.type ?? "final_timing");
  const [multiChoice, setMultiChoice] = useState(existingPoll?.multiChoice ?? false);
  const [deadline, setDeadline] = useState(toLocalDateTime(existingPoll?.deadline));
  const [options, setOptions] = useState<DraftOption[]>(
    existingPoll?.options.length
      ? existingPoll.options.map((option) => ({
          id: option.id,
          label: option.label,
          start_at: toLocalDateTime(option.startAt),
          end_at: toLocalDateTime(option.endAt),
        }))
      : [{ label: "", start_at: "", end_at: "" }],
  );
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeBased = pollType === "availability" || pollType === "final_timing";
  const activeOptions = options.filter((option) => !option.deleted);

  function updateOption(index: number, patch: Partial<DraftOption>) {
    setOptions((current) =>
      current.map((option, optionIndex) =>
        optionIndex === index ? { ...option, ...patch } : option,
      ),
    );
  }

  function removeOption(index: number) {
    setOptions((current) => {
      const next = current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, deleted: true } : item,
      );
      return next.every((item) => item.deleted)
        ? [...next, { label: "", start_at: "", end_at: "" }]
        : next;
    });
  }

  async function submit(publish: boolean) {
    setPending(publish ? "publish" : "draft");
    setError(null);
    try {
      const pollId = existingPoll?.id ?? await createPoll();
      if (existingPoll) {
        await updatePoll(pollId);
      }
      for (const option of options) {
        if (option.deleted && option.id) {
          await deleteOption(option.id);
        } else if (!option.deleted && option.id) {
          await updateExistingOption(option.id, option);
        } else if (!option.deleted) {
          await createOption(pollId, option);
        }
      }
      if (publish) {
        const response = await fetch(`/api/v1/polls/${pollId}/publish`, { method: "POST" });
        if (!response.ok) throw new Error(await apiMessage(response, "Could not publish poll."));
      }
      router.push(`/sessions/${sessionId}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save poll.");
    } finally {
      setPending(null);
    }
  }

  async function createPoll() {
    const response = await fetch(`/api/v1/sessions/${sessionId}/polls`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: pollType,
        multi_choice: multiChoice,
        deadline: deadline ? new Date(deadline).toISOString() : null,
      }),
    });
    if (!response.ok) throw new Error(await apiMessage(response, "Could not create poll."));
    const body = (await response.json()) as { data: { poll_id: number } };
    return String(body.data.poll_id);
  }

  async function updatePoll(pollId: string) {
    const response = await fetch(`/api/v1/polls/${pollId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        multi_choice: multiChoice,
        deadline: deadline ? new Date(deadline).toISOString() : null,
      }),
    });
    if (!response.ok) throw new Error(await apiMessage(response, "Could not update poll."));
  }

  async function createOption(pollId: string, option: DraftOption) {
    const label = option.label || (timeBased ? "Time option" : "");
    const response = await fetch(`/api/v1/polls/${pollId}/options`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label,
        start_at: timeBased && option.start_at ? new Date(option.start_at).toISOString() : null,
        end_at: timeBased && option.end_at ? new Date(option.end_at).toISOString() : null,
      }),
    });
    if (!response.ok) throw new Error(await apiMessage(response, "Could not add option."));
  }

  async function updateExistingOption(optionId: string, option: DraftOption) {
    const response = await fetch(`/api/v1/poll-options/${optionId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(optionBody(option, timeBased)),
    });
    if (!response.ok) throw new Error(await apiMessage(response, "Could not update option."));
  }

  async function deleteOption(optionId: string) {
    const response = await fetch(`/api/v1/poll-options/${optionId}`, { method: "DELETE" });
    if (!response.ok) throw new Error(await apiMessage(response, "Could not delete option."));
  }

  return (
    <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
      <div className="grid gap-2 sm:grid-cols-4">
        {["Poll Type", "Deadline", "Options", "Publish"].map((step, index) => (
          <div
            key={step}
            className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm"
          >
            <div className="text-xs font-medium text-zinc-500">Step {index + 1}</div>
            <div className="mt-1 font-semibold text-zinc-950">{step}</div>
          </div>
        ))}
      </div>

      <section className="rounded-md border border-zinc-200 p-4">
        <div className="mb-3 text-sm font-semibold text-zinc-950">Poll Type</div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="text-sm font-medium">Type</span>
            <select
              value={pollType}
              disabled={Boolean(existingPoll)}
              className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              onChange={(event) => setPollType(event.target.value as PollType)}
            >
              <option value="interest">Interest check</option>
              <option value="topic">Topic poll</option>
              <option value="availability">Availability poll</option>
              <option value="final_timing">Final timing poll</option>
            </select>
          </label>
          <div>
            <div className="mb-1 text-sm font-medium">Voting</div>
            <div className="flex gap-2">
              <label className="rounded-md border border-zinc-200 px-3 py-2 text-sm">
                <input type="radio" checked={!multiChoice} onChange={() => setMultiChoice(false)} /> Single
              </label>
              <label className="rounded-md border border-zinc-200 px-3 py-2 text-sm">
                <input type="radio" checked={multiChoice} onChange={() => setMultiChoice(true)} /> Multiple
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 p-4">
        <label className="block">
          <span className="text-sm font-semibold text-zinc-950">Deadline</span>
          <input
            type="datetime-local"
            value={deadline}
            className="mt-2 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
            onChange={(event) => setDeadline(event.target.value)}
          />
        </label>
      </section>

      <section className="rounded-md border border-zinc-200 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-zinc-950">Official Options</div>
          <div className="text-xs text-zinc-500">{activeOptions.length} option{activeOptions.length === 1 ? "" : "s"}</div>
        </div>
        <div className="space-y-3">
          {options.map((option, index) => option.deleted ? null : (
            <div key={option.id ?? index} className="grid gap-2 rounded-md border border-zinc-200 p-3 md:grid-cols-[1fr_auto]">
              <div className="grid gap-2 md:grid-cols-3">
                <input
                  value={option.label}
                  className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm"
                  placeholder={timeBased ? "Label optional" : "Option label"}
                  onChange={(event) => updateOption(index, { label: event.target.value })}
                />
                {timeBased ? (
                  <>
                    <input type="datetime-local" value={option.start_at} className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm" onChange={(event) => updateOption(index, { start_at: event.target.value })} />
                    <input type="datetime-local" value={option.end_at} className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm" onChange={(event) => updateOption(index, { end_at: event.target.value })} />
                  </>
                ) : null}
              </div>
              <Button
                type="button"
                className="min-h-10"
                onClick={() => removeOption(index)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" className="mt-3" onClick={() => setOptions((current) => [...current, { label: "", start_at: "", end_at: "" }])}>
          Add Option
        </Button>
      </section>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" disabled={pending === "draft"} onClick={() => submit(false)}>
          {pending === "draft" ? "Saving..." : "Save Draft"}
        </Button>
        <Button type="button" tone="primary" disabled={pending === "publish"} onClick={() => submit(true)}>
          {pending === "publish" ? "Publishing..." : "Publish Now"}
        </Button>
      </div>
    </form>
  );
}

function optionBody(option: DraftOption, timeBased: boolean) {
  const label = option.label || (timeBased ? "Time option" : "");
  return {
    label,
    start_at: timeBased && option.start_at ? new Date(option.start_at).toISOString() : null,
    end_at: timeBased && option.end_at ? new Date(option.end_at).toISOString() : null,
  };
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
