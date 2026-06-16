"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Buttons";
import { ConfirmButton } from "@/components/common/ConfirmAction";
import type { CalendarInvitePolicy, PollType } from "@/types/domain";

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
  const [calendarInvitePolicy, setCalendarInvitePolicy] = useState<CalendarInvitePolicy>("all_members");
  const [deadline, setDeadline] = useState(toLocalDateTime(existingPoll?.deadline) || defaultDeadline());
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
  const lockedVoting = pollType === "interest" || pollType === "availability" || pollType === "final_timing";
  const effectiveMultiChoice = pollType === "availability" ? true : pollType === "topic" ? multiChoice : false;
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
        ? [...next, nextOptionForType(pollType, next)]
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
        const firstInvalid = options.find((option) => !option.deleted && !isBlankDraftOption(option, timeBased) && timeOptionError(option, minimumDeadline));
        if (firstInvalid) {
          throw new Error(timeOptionError(firstInvalid, minimumDeadline) ?? "Fix the invalid time option.");
        }
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
      if (pollType === "final_timing") {
        await updateSessionInvitePolicy();
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
        multi_choice: effectiveMultiChoice,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        ...(pollType === "final_timing" ? { calendar_invite_policy: calendarInvitePolicy } : {}),
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
        multi_choice: effectiveMultiChoice,
        deadline: deadline ? new Date(deadline).toISOString() : null,
      }),
    });
    if (!response.ok) throw new Error(await apiMessage(response, "Could not update poll."));
  }

  async function updateSessionInvitePolicy() {
    const response = await fetch(`/api/v1/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ calendar_invite_policy: calendarInvitePolicy }),
    });
    if (!response.ok) throw new Error(await apiMessage(response, "Could not update invite policy."));
  }

  async function createOption(pollId: string, option: DraftOption, index: number) {
    const label = optionLabel(option, timeBased, index);
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
      body: JSON.stringify(optionBody(option, timeBased, index)),
    });
    if (!response.ok) throw new Error(await apiMessage(response, "Could not update option."));
  }

  async function deleteOption(optionId: string) {
    const response = await fetch(`/api/v1/poll-options/${optionId}`, { method: "DELETE" });
    if (!response.ok) throw new Error(await apiMessage(response, "Could not delete option."));
  }

  async function deleteDraftPoll() {
    if (!existingPoll) return;
    setPending("delete");
    setError(null);
    const response = await fetch(`/api/v1/polls/${existingPoll.id}`, { method: "DELETE" });
    setPending(null);
    if (!response.ok) {
      setError(await apiMessage(response, "Could not delete draft poll."));
      return;
    }
    router.push(`/sessions/${sessionId}`);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={(event) => event.preventDefault()}>
      <div className="grid gap-2 sm:grid-cols-4">
        {([
          { label: "Interest", type: "interest" },
          { label: "Topic", type: "topic" },
          { label: "Availability", type: "availability" },
          { label: "Timing", type: "final_timing" },
        ] as const).map((step, index) => (
          <div
            key={step.type}
            className={`rounded-xl border px-4 py-3 text-sm ${
              step.type === pollType
                ? "border-zinc-950 bg-zinc-950 text-white"
                : index < pollFlowIndex(pollType)
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200 bg-zinc-50 text-zinc-500"
            }`}
          >
            <div className="font-semibold">{step.label}</div>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-zinc-950">Poll type</div>
            {!existingPoll ? (
              <p className="mt-1 text-xs text-zinc-500">
                Pick the step you want to run now. Interest, topic, and availability are optional.
              </p>
            ) : null}
          </div>
          {!existingPoll ? (
            <span className="text-xs font-medium text-zinc-500">Timing is required before scheduling.</span>
          ) : null}
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="block">
            <select
              value={pollType}
              disabled={Boolean(existingPoll)}
              className="mt-1 min-h-11 w-full rounded-lg border border-zinc-300 px-3 text-sm"
              onChange={(event) => changePollType(event.target.value as PollType)}
            >
              <option value="interest">Interest check</option>
              <option value="topic">Topic poll</option>
              <option value="availability">Availability poll</option>
              <option value="final_timing">Final timing poll</option>
            </select>
          </label>
          {!fixedInterest ? (
            <VotingControl
              pollType={pollType}
              multiChoice={effectiveMultiChoice}
              locked={lockedVoting}
              onChange={setMultiChoice}
            />
          ) : null}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <label className="block">
          <span className="text-sm font-semibold text-zinc-950">Deadline</span>
          <input
            type="datetime-local"
            value={deadline}
            min={minimumDeadline}
            className="mt-2 min-h-11 w-full rounded-lg border border-zinc-300 px-3 text-sm"
            onChange={(event) => setDeadline(event.target.value)}
          />
          <span className="mt-1 block text-xs text-zinc-500">
            Publishing requires a future deadline. Voting stays open until this time.
          </span>
        </label>
      </section>

      {pollType === "final_timing" ? (
        <InvitePolicySection
          value={calendarInvitePolicy}
          onChange={setCalendarInvitePolicy}
        />
      ) : null}

      {!fixedInterest ? <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-zinc-950">
            {fixedInterest ? "Interest Options" : timeBased ? "Time Options" : "Official Options"}
          </div>
          <div className="text-xs text-zinc-500">{activeOptions.length} option{activeOptions.length === 1 ? "" : "s"}</div>
        </div>
        {timeBased ? (
          <TimeSlotOptionsEditor
            options={options}
            minimumDateTime={minimumDeadline}
            onChange={setOptions}
          />
        ) : (
          <div className="space-y-3">
            {options.map((option, index) => {
              if (option.deleted) return null;
              return (
              <div key={option.id ?? index} className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-3">
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-zinc-600">Label</span>
                    <input
                      value={option.label}
                      disabled={fixedInterest}
                      className="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm"
                      placeholder="Option label"
                      onChange={(event) => updateOption(index, { label: event.target.value })}
                    />
                  </label>
                  <ConfirmButton
                    className="min-h-11 self-end"
                    onConfirm={() => removeOption(index)}
                    confirm={{
                      title: "Remove option?",
                      message: "This option will be removed from the poll draft.",
                      confirmLabel: "Remove",
                    }}
                  >
                    Remove
                  </ConfirmButton>
                </div>
              </div>
            );})}
            <Button type="button" className="mt-3" onClick={() => setOptions((current) => [...current, nextOptionForType(pollType, current)])}>
              Add Option
            </Button>
          </div>
        )}
      </section> : (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="text-sm font-semibold text-emerald-950">Interest check</h2>
          <p className="mt-1 text-sm text-emerald-800">
            Members will tap Interested or Maybe. No setup needed.
          </p>
        </section>
      )}
      {error ? <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending === "draft"} onClick={() => submit(false)}>
          {pending === "draft" ? "Saving..." : "Save Draft"}
        </Button>
        <Button type="button" tone="primary" disabled={pending === "publish"} onClick={() => submit(true)}>
          {pending === "publish" ? "Publishing..." : "Publish Poll"}
        </Button>
        {existingPoll ? (
          <ConfirmButton
            tone="danger"
            disabled={pending === "delete"}
            onConfirm={() => void deleteDraftPoll()}
            confirm={{
              title: "Delete draft poll?",
              message: "This permanently removes this poll draft and its draft options.",
              confirmLabel: "Delete draft",
              cancelLabel: "Keep draft",
            }}
          >
            {pending === "delete" ? "Deleting..." : "Delete Draft"}
          </ConfirmButton>
        ) : null}
      </div>
    </form>
  );
}

function InvitePolicySection({
  value,
  onChange,
}: {
  value: CalendarInvitePolicy;
  onChange: (value: CalendarInvitePolicy) => void;
}) {
  return (
    <section className="rounded-xl border border-teal-100 bg-teal-50/60 p-4">
      <h2 className="text-sm font-semibold text-teal-950">Calendar invites after this vote</h2>
      <p className="mt-1 text-sm text-teal-900">
        The winning final timing option can schedule the Meet. Choose who should receive the Calendar invite.
      </p>
      <div className="mt-3 grid gap-2">
        <PolicyRadio
          value="all_members"
          current={value}
          title="Invite all group members"
          description="Best when interest was skipped or everyone should receive the event."
          onChange={onChange}
        />
        <PolicyRadio
          value="interested_members"
          current={value}
          title="Invite interested members only"
          description="Use this when you ran an interest check and only interested/attending members should get the invite."
          onChange={onChange}
        />
        <PolicyRadio
          value="app_only"
          current={value}
          title="App link only"
          description="Create the Meet link, but do not send Calendar invites."
          onChange={onChange}
        />
      </div>
    </section>
  );
}

function PolicyRadio({
  value,
  current,
  title,
  description,
  onChange,
}: {
  value: CalendarInvitePolicy;
  current: CalendarInvitePolicy;
  title: string;
  description: string;
  onChange: (value: CalendarInvitePolicy) => void;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-lg border border-teal-100 bg-white/80 p-3">
      <input
        type="radio"
        className="mt-1"
        checked={current === value}
        onChange={() => onChange(value)}
      />
      <span>
        <span className="block text-sm font-medium text-zinc-950">{title}</span>
        <span className="text-sm text-zinc-600">{description}</span>
      </span>
    </label>
  );
}

function TimeSlotOptionsEditor({
  options,
  minimumDateTime,
  onChange,
}: {
  options: DraftOption[];
  minimumDateTime: string;
  onChange: (options: DraftOption[]) => void;
}) {
  const activeOptions = options.filter((option) => !option.deleted && option.start_at);
  const optionDateKeys = activeOptions.map((option) => localInputDate(option.start_at));
  const [extraDateKeys, setExtraDateKeys] = useState<string[]>([]);
  const dateKeys = uniqueSortedDateKeys([
    localInputDate(defaultStartTime()),
    ...optionDateKeys,
    ...extraDateKeys,
  ]);
  const selectedHours = new Set(
    activeOptions.map((option) => `${localInputDate(option.start_at)}:${localInputHour(option.start_at)}`),
  );

  function selectDate(dateKey: string) {
    setExtraDateKeys((current) => uniqueSortedDateKeys([...current, dateKey]));
  }

  function toggleHour(dateKey: string, hour: number) {
    const start = localDateTime(dateKey, hour);
    if (start < minimumDateTime) return;
    const existingIndex = options.findIndex((option) => (
      !option.deleted &&
      option.start_at &&
      localInputDate(option.start_at) === dateKey &&
      localInputHour(option.start_at) === hour
    ));
    if (existingIndex >= 0) {
      onChange(options.map((option, index) => index === existingIndex ? { ...option, deleted: true } : option));
    } else {
      onChange([
        ...options,
        {
          label: "",
          start_at: start,
          end_at: addMinutesToLocalDateTime(start, 60),
        },
      ]);
    }
  }

  const lastDate = dateKeys[dateKeys.length - 1] ?? localInputDate(defaultStartTime());

  return (
    <div>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="date"
          value={lastDate}
          min={localInputDate(minimumDateTime)}
          onChange={(event) => selectDate(event.target.value)}
          className="min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm sm:w-44"
          aria-label="Add date"
        />
        <div className="text-sm font-medium text-zinc-600">
          Click hours to add or remove 1-hour choices.
        </div>
      </div>
      <div className="space-y-2">
        {dateKeys.map((dateKey) => (
          <HourBar
            key={dateKey}
            dateKey={dateKey}
            selectedHours={selectedHours}
            minimumDateTime={minimumDateTime}
            onSelect={toggleHour}
          />
        ))}
      </div>
      <Button
        type="button"
        className="mt-3"
        onClick={() => setExtraDateKeys((current) => uniqueSortedDateKeys([...current, addDaysToDateKey(lastDate, 1)]))}
      >
        Add Next Day
      </Button>
      <p className="mt-2 text-xs text-zinc-500">
        Each selected hour becomes one vote option. Members can only choose from these selected slots.
      </p>
    </div>
  );
}

function HourBar({
  dateKey,
  selectedHours,
  minimumDateTime,
  onSelect,
}: {
  dateKey: string;
  selectedHours: Set<string>;
  minimumDateTime: string;
  onSelect: (dateKey: string, hour: number) => void;
}) {
  return (
    <div className="rounded-xl border border-teal-100 bg-teal-50 p-1">
      <div className="grid grid-cols-[56px_repeat(24,minmax(0,1fr))] items-stretch">
        <div className="flex min-h-14 flex-col items-center justify-center rounded-lg bg-teal-500 px-1 text-center text-[10px] font-bold uppercase leading-tight text-white">
          <span>{weekdayShort(dateKey)}</span>
          <span>{monthShort(dateKey)}</span>
          <span className="text-base leading-none">{dayNumber(dateKey)}</span>
        </div>
        {Array.from({ length: 24 }, (_, hour) => {
          const selected = selectedHours.has(`${dateKey}:${hour}`);
          const disabled = localDateTime(dateKey, hour) < minimumDateTime;
          return (
            <button
              key={`${dateKey}-${hour}`}
              type="button"
              disabled={disabled}
              className={`flex min-h-14 min-w-0 flex-col items-center justify-center border-l border-white/70 text-xs font-semibold transition ${
                selected
                  ? "bg-teal-500 text-white shadow-inner"
                  : disabled
                    ? "bg-zinc-100 text-zinc-300"
                    : "bg-teal-50 text-teal-800 hover:bg-teal-100"
              } ${disabled ? "cursor-not-allowed" : ""}`}
              onClick={() => onSelect(dateKey, hour)}
              aria-label={`${formatHour(hour)} on ${dateKey}`}
            >
              <span className="text-sm leading-none sm:text-base">{hourLabel(hour)}</span>
              <span className="text-[9px] leading-none">{hourMeridiem(hour)}</span>
            </button>
          );
        })}
      </div>
    </div>
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
  if (type === "availability" || type === "final_timing") {
    return [defaultTimeOption()];
  }
  return [{ label: "", start_at: "", end_at: "" }];
}

function VotingControl({
  pollType,
  multiChoice,
  locked,
  onChange,
}: {
  pollType: PollType;
  multiChoice: boolean;
  locked: boolean;
  onChange: (value: boolean) => void;
}) {
  if (locked) {
    const text = pollType === "availability"
      ? "Availability lets members choose multiple windows."
      : "Final timing is a single-choice vote.";
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
        <div className="font-medium text-zinc-900">{multiChoice ? "Multiple choice" : "Single choice"}</div>
        <div className="mt-0.5 text-xs">{text}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-1 text-sm font-medium">Voting</div>
      <div className="flex gap-2">
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
          <input type="radio" checked={!multiChoice} onChange={() => onChange(false)} /> Single
        </label>
        <label className="flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm">
          <input type="radio" checked={multiChoice} onChange={() => onChange(true)} /> Multiple
        </label>
      </div>
    </div>
  );
}

function pollFlowIndex(type: PollType) {
  return ["interest", "topic", "availability", "final_timing"].indexOf(type);
}

function optionBody(option: DraftOption, timeBased: boolean, index: number) {
  const label = optionLabel(option, timeBased, index);
  return {
    label,
    start_at: timeBased && option.start_at ? new Date(option.start_at).toISOString() : null,
    end_at: timeBased && option.end_at ? new Date(option.end_at).toISOString() : null,
  };
}

function optionLabel(option: DraftOption, timeBased: boolean, index: number) {
  if (timeBased && option.start_at && option.end_at) {
    return `${new Date(option.start_at).toISOString()} - ${new Date(option.end_at).toISOString()}`;
  }
  return option.label || (timeBased ? `Option ${index + 1}` : "");
}

function isBlankDraftOption(option: DraftOption, timeBased: boolean) {
  if (option.deleted) return false;
  if (timeBased) return !option.start_at && !option.end_at;
  return !option.label.trim();
}

function timeOptionError(option: DraftOption, minimumDeadline: string) {
  if (!option.start_at || !option.end_at) return "Add both a start and end time, or leave the row blank.";
  if (option.start_at < minimumDeadline) return "Start time must be in the future.";
  if (option.end_at <= option.start_at) return "End time must be after the start time.";
  return null;
}

function addMinutesToLocalDateTime(value: string, minutes: number) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() + minutes * 60_000 - offset).toISOString().slice(0, 16);
}

function addDaysToDateKey(value: string, days: number) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return dateKeyFromLocalDate(date);
}

function localDateTime(dateKey: string, hour: number) {
  return `${dateKey}T${String(hour).padStart(2, "0")}:00`;
}

function localInputDate(value: string) {
  return value.slice(0, 10);
}

function localInputHour(value: string) {
  const hour = Number(value.slice(11, 13));
  return Number.isFinite(hour) ? hour : 0;
}

function dateKeyFromLocalDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function uniqueSortedDateKeys(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime());
}

function weekdayShort(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(`${dateKey}T00:00:00`));
}

function monthShort(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short" }).format(new Date(`${dateKey}T00:00:00`));
}

function dayNumber(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(new Date(`${dateKey}T00:00:00`));
}

function hourLabel(hour: number) {
  const value = hour % 12;
  return String(value === 0 ? 12 : value);
}

function hourMeridiem(hour: number) {
  return hour < 12 ? "am" : "pm";
}

function formatHour(hour: number) {
  return `${hourLabel(hour)} ${hourMeridiem(hour)}`;
}

function nextOptionForType(type: PollType, current: DraftOption[]): DraftOption {
  if (type !== "availability" && type !== "final_timing") {
    return { label: "", start_at: "", end_at: "" };
  }
  const lastEnd = [...current].reverse().find((option) => !option.deleted && option.end_at)?.end_at;
  return defaultTimeOption(lastEnd);
}

function defaultTimeOption(after?: string): DraftOption {
  const fallback = defaultStartTime();
  const start = after && after > fallback ? after : fallback;
  return {
    label: "",
    start_at: start,
    end_at: addMinutesToLocalDateTime(start, 60),
  };
}

function defaultStartTime() {
  const date = new Date(Date.now() + 60 * 60_000);
  date.setMinutes(0, 0, 0);
  return toLocalDateTime(date.toISOString());
}

function defaultDeadline() {
  return toLocalDateTime(new Date(Date.now() + 24 * 60 * 60_000).toISOString());
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
