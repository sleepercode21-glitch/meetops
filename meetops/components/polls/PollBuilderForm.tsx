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
  defaultPollType = "interest",
}: {
  sessionId: string;
  defaultPollType?: PollType;
  existingPoll?: {
    id: string;
    type: PollType;
    multiChoice: boolean;
    deadline?: string;
    options: { id: string; label: string; startAt?: string; endAt?: string }[];
  };
}) {
  const router = useRouter();
  const initialPollType = existingPoll?.type ?? defaultPollType;
  const [pollType, setPollType] = useState<PollType>(initialPollType);
  const [multiChoice, setMultiChoice] = useState(existingPoll?.multiChoice ?? initialPollType === "availability");
  const [deadline, setDeadline] = useState(toLocalDateTime(existingPoll?.deadline));
  const [minimumDeadline] = useState(() => toLocalDateTime(new Date(Date.now() + 60_000).toISOString()));
  const [options, setOptions] = useState<DraftOption[]>(
    initialPollType === "interest"
      ? fixedInterestOptions(existingPoll?.options)
      : existingPoll?.options.length
      ? existingPoll.options.map((option) => ({
          id: option.id,
          label: option.label,
          start_at: toLocalDateTime(option.startAt),
          end_at: toLocalDateTime(option.endAt),
        }))
      : emptyOptionsForType(initialPollType),
  );
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timeBased = pollType === "availability" || pollType === "final_timing";
  const fixedInterest = pollType === "interest";
  const activeOptions = options.filter((option) => !option.deleted);

  function changePollType(nextType: PollType) {
    setPollType(nextType);
    if (nextType === "interest") {
      setMultiChoice(false);
      setOptions(fixedInterestOptions());
    } else {
      setMultiChoice(nextType === "availability");
      if (pollType === "interest" || options.filter((option) => !option.deleted).length <= 1) {
        setOptions(emptyOptionsForType(nextType));
      }
    }
  }

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
      if (publish && (!deadline || deadline <= minimumDeadline)) {
        throw new Error("Set a future deadline before publishing so members have time to vote.");
      }
      if (timeBased) {
        const validTimeOptions = options.filter((option) => (
          !option.deleted &&
          !isBlankDraftOption(option, timeBased) &&
          option.start_at &&
          option.end_at &&
          option.start_at >= minimumDeadline &&
          option.end_at > option.start_at
        ));
        if (publish && validTimeOptions.length < 1) {
          throw new Error("Publishing requires at least one valid future time option.");
        }
        const invalidOption = options.some((option) => (
          !option.deleted &&
          !isBlankDraftOption(option, timeBased) &&
          (!option.start_at || !option.end_at || option.start_at < minimumDeadline || option.end_at <= option.start_at)
        ));
        if (invalidOption) {
          throw new Error("Time options must start in the future and end after they start.");
        }
      }
      const pollId = existingPoll?.id ?? await createPoll();
      if (existingPoll) {
        await updatePoll(pollId);
      }
      for (const [index, option] of options.entries()) {
        if (option.deleted && option.id) {
          await deleteOption(option.id);
        } else if (option.id && isBlankDraftOption(option, timeBased)) {
          await deleteOption(option.id);
        } else if (!option.deleted && option.id) {
          await updateExistingOption(option.id, option, index);
        } else if (!option.deleted && !isBlankDraftOption(option, timeBased)) {
          await createOption(pollId, option, index);
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

  async function createOption(pollId: string, option: DraftOption, index: number) {
    const label = pollType === "availability" ? "" : option.label || (timeBased ? `Option ${index + 1}` : "");
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

  async function updateExistingOption(optionId: string, option: DraftOption, index: number) {
    const response = await fetch(`/api/v1/poll-options/${optionId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(optionBody(option, timeBased, index, pollType)),
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
        {([
          { label: "Interest", type: "interest" },
          { label: "Topic", type: "topic" },
          { label: "Availability", type: "availability" },
          { label: "Timing", type: "final_timing" },
        ] as const).map((step, index) => (
          <div
            key={step.type}
            className={`rounded-md border p-3 text-sm ${
              step.type === pollType
                ? "border-zinc-950 bg-zinc-950 text-white"
                : index < pollFlowIndex(pollType)
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200 bg-zinc-50 text-zinc-500"
            }`}
          >
            <div className="text-xs font-medium opacity-75">Step {index + 1}</div>
            <div className="mt-1 font-semibold">{step.label}</div>
          </div>
        ))}
      </div>

      <section className="rounded-md border border-zinc-200 p-4">
        <div className="mb-3">
          <div className="text-sm font-semibold text-zinc-950">Next Poll</div>
          {!existingPoll ? (
            <p className="mt-1 text-xs text-zinc-500">
              This is selected from the current session state. Change it only if you want to skip or repeat a step.
            </p>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="text-sm font-medium">Type</span>
            <select
              value={pollType}
              disabled={Boolean(existingPoll)}
              className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
              onChange={(event) => changePollType(event.target.value as PollType)}
            >
              <option value="interest">Interest check</option>
              <option value="topic">Topic poll</option>
              <option value="availability">Availability poll</option>
              <option value="final_timing">Final timing poll</option>
            </select>
          </label>
          {!fixedInterest ? <div>
            <div className="mb-1 text-sm font-medium">Voting</div>
            <div className="flex gap-2">
              <label className="rounded-md border border-zinc-200 px-3 py-2 text-sm">
                <input type="radio" checked={!multiChoice} onChange={() => setMultiChoice(false)} /> Single
              </label>
              <label className="rounded-md border border-zinc-200 px-3 py-2 text-sm">
                <input type="radio" checked={multiChoice} onChange={() => setMultiChoice(true)} /> Multiple
              </label>
            </div>
          </div> : (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
              Interest polls use Interested / Maybe.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-md border border-zinc-200 p-4">
        <label className="block">
          <span className="text-sm font-semibold text-zinc-950">Deadline</span>
          <input
            type="datetime-local"
            value={deadline}
            min={minimumDeadline}
            className="mt-2 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
            onChange={(event) => setDeadline(event.target.value)}
          />
          <span className="mt-1 block text-xs text-zinc-500">
            Publishing requires a future deadline. Voting stays open until this time.
          </span>
        </label>
      </section>

      <section className="rounded-md border border-zinc-200 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-zinc-950">
            {fixedInterest ? "Interest Options" : timeBased ? "Time Options" : "Official Options"}
          </div>
          <div className="text-xs text-zinc-500">{activeOptions.length} option{activeOptions.length === 1 ? "" : "s"}</div>
        </div>
        <div className="space-y-3">
          {options.map((option, index) => option.deleted ? null : (
            <div key={option.id ?? index} className="grid gap-2 rounded-md border border-zinc-200 p-3 md:grid-cols-[1fr_auto]">
              <div className={`grid gap-2 ${pollType === "availability" ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
                {pollType !== "availability" ? (
                  <input
                    value={option.label}
                    disabled={fixedInterest}
                    className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm"
                    placeholder={timeBased ? "Label optional" : "Option label"}
                    onChange={(event) => updateOption(index, { label: event.target.value })}
                  />
                ) : null}
                {timeBased ? (
                  <>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-zinc-600">From</span>
                      <input type="datetime-local" value={option.start_at} min={minimumDeadline} className="min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm" onChange={(event) => updateOption(index, { start_at: event.target.value })} />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-zinc-600">To</span>
                      <input type="datetime-local" value={option.end_at} min={option.start_at || minimumDeadline} className="min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm" onChange={(event) => updateOption(index, { end_at: event.target.value })} />
                    </label>
                  </>
                ) : null}
              </div>
              {!fixedInterest ? <Button
                type="button"
                className="min-h-10"
                onClick={() => removeOption(index)}
              >
                Remove
              </Button> : null}
            </div>
          ))}
        </div>
        {!fixedInterest ? <Button type="button" className="mt-3" onClick={() => setOptions((current) => [...current, { label: "", start_at: "", end_at: "" }])}>
          {timeBased ? "Add Time Option" : "Add Option"}
        </Button> : null}
      </section>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" disabled={pending === "draft"} onClick={() => submit(false)}>
          {pending === "draft" ? "Saving..." : "Save Draft"}
        </Button>
        <Button type="button" tone="primary" disabled={pending === "publish"} onClick={() => submit(true)}>
          {pending === "publish" ? "Publishing..." : "Publish Poll"}
        </Button>
      </div>
    </form>
  );
}

function fixedInterestOptions(existing: { id: string; label: string; startAt?: string; endAt?: string }[] = []): DraftOption[] {
  const interested = existing.find((option) => option.label.trim().toLowerCase() === "interested");
  const maybe = existing.find((option) => option.label.trim().toLowerCase() === "maybe");
  return [
    { id: interested?.id, label: "Interested", start_at: "", end_at: "" },
    { id: maybe?.id, label: "Maybe", start_at: "", end_at: "" },
  ];
}

function emptyOptionsForType(type: PollType): DraftOption[] {
  if (type === "availability") {
    return [
      { label: "", start_at: "", end_at: "" },
    ];
  }
  return [{ label: "", start_at: "", end_at: "" }];
}

function pollFlowIndex(type: PollType) {
  return ["interest", "topic", "availability", "final_timing"].indexOf(type);
}

function optionBody(option: DraftOption, timeBased: boolean, index: number, pollType: PollType) {
  const label = pollType === "availability" ? "" : option.label || (timeBased ? `Option ${index + 1}` : "");
  return {
    label,
    start_at: timeBased && option.start_at ? new Date(option.start_at).toISOString() : null,
    end_at: timeBased && option.end_at ? new Date(option.end_at).toISOString() : null,
  };
}

function isBlankDraftOption(option: DraftOption, timeBased: boolean) {
  if (option.deleted) return false;
  if (timeBased) return !option.label.trim() && !option.start_at && !option.end_at;
  return !option.label.trim();
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
