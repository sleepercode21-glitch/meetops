"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PollStatusBadge } from "@/components/common/Badge";
import { Button, ButtonLink } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";
import { SuggestionPanel } from "@/components/polls/SuggestionPanel";
import { pollTypeLabels } from "@/lib/labels";
import type { Poll, PollOption } from "@/types/domain";

export function PollWorkflowCard({
  poll,
  canManage,
}: {
  poll: Poll;
  canManage: boolean;
}) {
  if (poll.type === "availability") {
    return <AvailabilityPollCard poll={poll} canManage={canManage} />;
  }
  if (poll.type === "final_timing") {
    return <FinalTimingPollCard poll={poll} canManage={canManage} />;
  }
  return <StandardPollCard poll={poll} canManage={canManage} />;
}

function AvailabilityPollCard({ poll, canManage }: { poll: Poll; canManage: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const rankedOptions = useMemo(() => ranked(poll.options), [poll.options]);

  async function closePoll() {
    await runAction(`/api/v1/polls/${poll.id}/close`, "close", setPending, setMessage, () => router.refresh());
  }

  if (poll.status === "closed") {
    return (
      <div className="space-y-4">
        <Card>
          <PollHeading
            title="Availability Results"
            subtitle="These results help the host choose the final timing options."
            poll={poll}
          />
          <RankedResults options={rankedOptions} emptyText="No availability votes were submitted." />
        </Card>
        {canManage ? <CreateFinalTimingFromAvailabilityCard poll={poll} /> : null}
      </div>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PollHeading
          title="Availability Poll"
          subtitle={canManage ? "Members enter the time they are free inside each window." : "Enter the time you are free inside any window."}
          poll={poll}
        />
        {canManage && poll.status === "active" ? (
          <Button type="button" tone="primary" disabled={pending === "close"} onClick={closePoll}>
            {pending === "close" ? "Closing..." : "Close Poll"}
          </Button>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        {canManage || poll.status !== "active" ? (
          poll.options.map((option) => (
            <WindowRow key={option.id} option={option} />
          ))
        ) : (
          <AvailabilityResponseForm poll={poll} />
        )}
      </div>
      {message ? <p className="mt-3 text-sm text-zinc-700">{message}</p> : null}
      {canManage && poll.status === "draft" ? <DraftControls poll={poll} pending={pending} setPending={setPending} setMessage={setMessage} /> : null}
      <PollComments poll={poll} canManage={canManage} />
    </Card>
  );
}

function FinalTimingPollCard({ poll, canManage }: { poll: Poll; canManage: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(poll.currentUserVoteIds);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submitVote() {
    if (selected.length !== 1) {
      setMessage("Choose one final time.");
      return;
    }
    setPending("vote");
    setMessage(null);
    const response = await saveVote(poll.id, selected);
    setPending(null);
    if (!response.ok) {
      setMessage(await apiMessage(response, "Could not save your vote."));
      return;
    }
    setMessage("Vote submitted. You can update it until the poll closes.");
    router.refresh();
  }

  async function closePoll() {
    await runAction(`/api/v1/polls/${poll.id}/close`, "close", setPending, setMessage, () => router.refresh());
  }

  if (poll.status === "closed") {
    return (
      <Card>
        <PollHeading
          title="Final Timing Results"
          subtitle="The final timing poll is closed."
          poll={poll}
        />
        <RankedResults options={ranked(poll.options)} emptyText="No final timing votes were submitted." />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PollHeading
          title="Final Timing Vote"
          subtitle="Choose one final time for the session."
          poll={poll}
        />
        {canManage && poll.status === "active" ? (
          <Button type="button" tone="primary" disabled={pending === "close"} onClick={closePoll}>
            {pending === "close" ? "Closing..." : "Close & Schedule"}
          </Button>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        {poll.options.map((option) => (
          <FinalTimingOptionRadioRow
            key={option.id}
            option={option}
            checked={selected.includes(option.id)}
            disabled={canManage || poll.status !== "active" || pending === "vote"}
            onSelect={() => setSelected([option.id])}
          />
        ))}
      </div>

      {!canManage && poll.status === "active" ? (
        <div className="mt-4">
          <Button
            type="button"
            tone="primary"
            className="w-full sm:w-auto"
            disabled={pending === "vote"}
            onClick={submitVote}
          >
            {pending === "vote" ? "Saving..." : "Submit Vote"}
          </Button>
        </div>
      ) : null}
      {message ? <p className="mt-3 text-sm text-zinc-700">{message}</p> : null}
      {canManage && poll.status === "draft" ? <DraftControls poll={poll} pending={pending} setPending={setPending} setMessage={setMessage} /> : null}
      <PollComments poll={poll} canManage={canManage} />
    </Card>
  );
}

function StandardPollCard({ poll, canManage }: { poll: Poll; canManage: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(poll.currentUserVoteIds);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submitVote(nextSelected: string[]) {
    if (!nextSelected.length) return;
    setPending("vote");
    setMessage(null);
    const response = await saveVote(poll.id, nextSelected);
    setPending(null);
    if (!response.ok) {
      setSelected(poll.currentUserVoteIds);
      setMessage(await apiMessage(response, "Could not save your vote."));
      return;
    }
    setMessage("Saved.");
    router.refresh();
  }

  async function closePoll() {
    await runAction(`/api/v1/polls/${poll.id}/close`, "close", setPending, setMessage, () => router.refresh());
  }

  const showResults = poll.resultsVisible || poll.status !== "active" || canManage;

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PollHeading title={pollTypeLabels[poll.type]} subtitle={poll.type === "topic" ? "Choose or suggest a topic." : undefined} poll={poll} />
        {canManage && poll.status === "active" ? (
          <Button type="button" tone="primary" disabled={pending === "close"} onClick={closePoll}>
            {pending === "close" ? "Closing..." : "Close Poll"}
          </Button>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {poll.options.map((option) => {
          const checked = selected.includes(option.id);
          return (
            <OptionVoteRow
              key={option.id}
              option={option}
              checked={checked}
              multiChoice={poll.multiChoice}
              disabled={canManage || poll.status !== "active" || pending === "vote"}
              showResults={showResults}
              totalVotes={totalVotes(poll.options)}
              onClick={() => {
                const next = poll.multiChoice ? toggleMulti(selected, option.id) : [option.id];
                setSelected(next);
                if (!canManage && poll.status === "active") void submitVote(next);
              }}
            />
          );
        })}
      </div>

      {message ? <p className="mt-3 text-sm text-zinc-700">{message}</p> : null}
      {canManage && poll.status === "draft" ? <DraftControls poll={poll} pending={pending} setPending={setPending} setMessage={setMessage} /> : null}
      <PollComments poll={poll} canManage={canManage} />
    </Card>
  );
}

function PollComments({ poll, canManage }: { poll: Poll; canManage: boolean }) {
  if (!poll.acceptsSuggestions && !poll.suggestions.length) return null;
  return (
    <SuggestionPanel
      pollId={poll.id}
      pollType={poll.type}
      pollStatus={poll.status}
      suggestions={poll.suggestions}
      canManage={canManage}
    />
  );
}

function PollHeading({
  title,
  subtitle,
  poll,
}: {
  title: string;
  subtitle?: string;
  poll: Poll;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
        <PollStatusBadge status={poll.status} />
        {poll.deadline && poll.status === "active" ? <PollDeadlineBadge deadline={poll.deadline} /> : null}
      </div>
      {subtitle ? <p className="mt-1 text-sm text-zinc-600">{subtitle}</p> : null}
    </div>
  );
}

function PollDeadlineBadge({ deadline }: { deadline: string }) {
  return (
    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs text-zinc-600">
      Deadline {new Date(deadline).toLocaleString()}
    </span>
  );
}

type AvailabilityResponse = {
  option_id: number;
  start_at: string;
  end_at: string;
};

function AvailabilityResponseForm({ poll }: { poll: Poll }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, { startAt: string; endAt: string }>>({});
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/polls/${poll.id}/availability-responses`)
      .then((response) => response.ok ? response.json() : null)
      .then((body: { data?: AvailabilityResponse[] } | null) => {
        if (cancelled) return;
        const next: Record<string, { startAt: string; endAt: string }> = {};
        for (const response of body?.data ?? []) {
          next[String(response.option_id)] = {
            startAt: toLocalDateTime(response.start_at),
            endAt: toLocalDateTime(response.end_at),
          };
        }
        setValues(next);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [poll.id]);

  function update(optionId: string, patch: Partial<{ startAt: string; endAt: string }>) {
    setValues((current) => ({
      ...current,
      [optionId]: { ...(current[optionId] ?? { startAt: "", endAt: "" }), ...patch },
    }));
  }

  async function submit() {
    const responses = poll.options.flatMap((option) => {
      const value = values[option.id];
      if (!value?.startAt && !value?.endAt) return [];
      if (!value.startAt || !value.endAt) {
        throw new Error("Fill both start and end, or leave the window blank.");
      }
      if (value.endAt <= value.startAt) {
        throw new Error("End time must be after start time.");
      }
      if (option.startAt && value.startAt < toLocalDateTime(option.startAt)) {
        throw new Error("Start time must be inside the host window.");
      }
      if (option.endAt && value.endAt > toLocalDateTime(option.endAt)) {
        throw new Error("End time must be inside the host window.");
      }
      return [{
        option_id: Number(option.id),
        start_at: new Date(value.startAt).toISOString(),
        end_at: new Date(value.endAt).toISOString(),
      }];
    });

    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/v1/polls/${poll.id}/availability-responses`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ responses }),
    });
    setPending(false);
    if (!response.ok) {
      setMessage(await apiMessage(response, "Could not save availability."));
      return;
    }
    setMessage(responses.length ? "Availability submitted. You can update it until the poll closes." : "Availability cleared.");
    router.refresh();
  }

  async function safeSubmit() {
    try {
      await submit();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save availability.");
    }
  }

  return (
    <div className="space-y-3">
      {poll.options.map((option) => {
        const value = values[option.id] ?? { startAt: "", endAt: "" };
        return (
          <div key={option.id} className="rounded-lg border border-zinc-200 bg-white p-4">
            <TimeOptionContent option={option} showLabel={false} />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-600">I am free from</span>
                <input
                  type="datetime-local"
                  min={toLocalDateTime(option.startAt)}
                  max={toLocalDateTime(option.endAt)}
                  value={value.startAt}
                  disabled={!loaded || pending}
                  className="min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
                  onChange={(event) => update(option.id, { startAt: event.target.value })}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-zinc-600">until</span>
                <input
                  type="datetime-local"
                  min={value.startAt || toLocalDateTime(option.startAt)}
                  max={toLocalDateTime(option.endAt)}
                  value={value.endAt}
                  disabled={!loaded || pending}
                  className="min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
                  onChange={(event) => update(option.id, { endAt: event.target.value })}
                />
              </label>
            </div>
          </div>
        );
      })}
      <Button type="button" tone="primary" className="w-full sm:w-auto" disabled={!loaded || pending} onClick={safeSubmit}>
        {pending ? "Saving..." : poll.currentUserVoteIds.length ? "Update Availability" : "Submit Availability"}
      </Button>
      {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
    </div>
  );
}

function WindowRow({ option }: { option: PollOption }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <TimeOptionContent option={option} showLabel={false} />
    </div>
  );
}

function FinalTimingOptionRadioRow({
  option,
  checked,
  disabled,
  onSelect,
}: {
  option: PollOption;
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={`flex min-h-20 w-full items-start gap-3 rounded-lg border p-4 text-left transition ${
        checked ? "border-blue-400 bg-blue-50" : "border-zinc-200 bg-white"
      } ${disabled ? "cursor-default opacity-80" : "hover:border-zinc-400"}`}
      aria-pressed={checked}
    >
      <span className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border ${checked ? "border-blue-700 bg-blue-700" : "border-zinc-400 bg-white"}`}>
        {checked ? <span className="size-2 rounded-full bg-white" /> : null}
      </span>
      <TimeOptionContent option={option} />
    </button>
  );
}

function TimeOptionContent({ option, showLabel = true }: { option: PollOption; showLabel?: boolean }) {
  const visibleLabel = showLabel && !isGeneratedTimeLabel(option.label) ? option.label : "";
  return (
    <span className="min-w-0">
      <span className="block font-medium text-zinc-950">{formatDay(option.startAt)}</span>
      <span className="mt-1 block text-sm text-zinc-700">{formatTimeRange(option.startAt, option.endAt)}</span>
      {visibleLabel ? <span className="mt-1 block text-sm text-zinc-500">{visibleLabel}</span> : null}
    </span>
  );
}

function OptionVoteRow({
  option,
  checked,
  multiChoice,
  disabled,
  showResults,
  totalVotes: votesTotal,
  onClick,
}: {
  option: PollOption;
  checked: boolean;
  multiChoice: boolean;
  disabled: boolean;
  showResults: boolean;
  totalVotes: number;
  onClick: () => void;
}) {
  const percent = votesTotal ? Math.round((option.voteCount / votesTotal) * 100) : 0;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`block w-full rounded-lg border p-4 text-left transition ${
        checked ? "border-blue-400 bg-blue-50" : "border-zinc-200 bg-white"
      } ${disabled ? "cursor-default opacity-80" : "hover:border-zinc-400"}`}
      aria-pressed={checked}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-1 flex size-5 shrink-0 items-center justify-center ${multiChoice ? "rounded" : "rounded-full"} border ${checked ? "border-blue-700 bg-blue-700 text-white" : "border-zinc-400 bg-white"}`}>
          {checked ? (multiChoice ? <span className="size-2.5 rounded-sm bg-white" /> : <span className="size-2 rounded-full bg-white" />) : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-zinc-950">{option.label}</div>
          {showResults ? <ResultMeter option={option} totalVotes={votesTotal} percent={percent} /> : null}
        </div>
      </div>
    </button>
  );
}

function RankedResults({ options, emptyText }: { options: PollOption[]; emptyText: string }) {
  if (!options.some((option) => option.voteCount > 0)) {
    return <p className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">{emptyText}</p>;
  }
  const votesTotal = totalVotes(options);
  return (
    <div className="mt-4 space-y-3">
      {options.map((option, index) => {
        const percent = votesTotal ? Math.round((option.voteCount / votesTotal) * 100) : 0;
        return (
          <div key={option.id} className="rounded-lg border border-zinc-200 p-4">
            <div className="flex gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-zinc-950">
                  {formatDay(option.startAt)} · {formatTimeRange(option.startAt, option.endAt)}
                </div>
                {!isGeneratedTimeLabel(option.label) ? <div className="mt-1 text-sm text-zinc-500">{option.label}</div> : null}
                <div className="mt-2 text-sm text-zinc-600">
                  {option.voteCount} {option.voteCount === 1 ? "person" : "people"} available
                </div>
                <ResultMeter option={option} totalVotes={votesTotal} percent={percent} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ResultMeter({ option, totalVotes: votesTotal, percent }: { option: PollOption; totalVotes: number; percent: number }) {
  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs text-zinc-500">
        <span>{option.voteCount} votes</span>
        <span>{votesTotal ? percent : 0}%</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-zinc-100">
        <div className="h-2 rounded-full bg-zinc-900" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function CreateFinalTimingFromAvailabilityCard({ poll }: { poll: Poll }) {
  const router = useRouter();
  const topOptions = useMemo(() => ranked(poll.options).slice(0, 3), [poll.options]);
  const [selected, setSelected] = useState<string[]>(topOptions.map((option) => option.id));
  const [deadline, setDeadline] = useState(() => toLocalDateTime(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()));
  const [minDeadline] = useState(() => toLocalDateTime(new Date(Date.now() + 60_000).toISOString()));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function createFinalTimingPoll() {
    if (selected.length < 1) {
      setMessage("Choose at least one option for the final vote.");
      return;
    }
    if (!deadline || deadline <= minDeadline) {
      setMessage("Choose a future deadline for the final vote.");
      return;
    }
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/v1/polls/${poll.id}/create-final-timing`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        option_ids: selected.map(Number),
        deadline: new Date(deadline).toISOString(),
      }),
    });
    setPending(false);
    if (!response.ok) {
      setMessage(await apiMessage(response, "Could not create final timing poll."));
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-zinc-950">Create Final Timing Poll</h2>
      <p className="mt-1 text-sm text-zinc-600">Choose the best availability options for the final vote.</p>
      <div className="mt-4 space-y-2">
        {ranked(poll.options).map((option) => (
          <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={selected.includes(option.id)}
              onChange={() => setSelected((current) => toggleMulti(current, option.id))}
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-zinc-950">
                {formatDay(option.startAt)} · {formatTimeRange(option.startAt, option.endAt)}
              </span>
              <span className="mt-1 block text-sm text-zinc-500">
                {option.voteCount} {option.voteCount === 1 ? "vote" : "votes"}{!isGeneratedTimeLabel(option.label) ? ` · ${option.label}` : ""}
              </span>
            </span>
          </label>
        ))}
      </div>
      <label className="mt-4 block">
        <span className="text-sm font-medium text-zinc-950">Final vote deadline</span>
        <input
          type="datetime-local"
          min={minDeadline}
          value={deadline}
          onChange={(event) => setDeadline(event.target.value)}
          className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
        />
      </label>
      <Button type="button" tone="primary" className="mt-4 w-full sm:w-auto" disabled={pending} onClick={createFinalTimingPoll}>
        {pending ? "Creating..." : "Create Final Timing Poll"}
      </Button>
      {message ? <p className="mt-3 text-sm text-zinc-700">{message}</p> : null}
    </Card>
  );
}

function DraftControls({
  poll,
  pending,
  setPending,
  setMessage,
}: {
  poll: Poll;
  pending: string | null;
  setPending: (value: string | null) => void;
  setMessage: (value: string | null) => void;
}) {
  const router = useRouter();
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <ButtonLink href={`/sessions/${poll.sessionId}/polls/${poll.id}/edit`} tone="primary">
        Edit Draft
      </ButtonLink>
      <Button
        type="button"
        disabled={!poll.options.length || !poll.deadline || pending === "publish"}
        onClick={() => runAction(`/api/v1/polls/${poll.id}/publish`, "publish", setPending, setMessage, () => router.refresh())}
      >
        {pending === "publish" ? "Publishing..." : "Publish Poll"}
      </Button>
    </div>
  );
}

async function saveVote(pollId: string, optionIds: string[]) {
  return fetch(`/api/v1/polls/${pollId}/vote`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ option_ids: optionIds.map(Number) }),
  });
}

async function runAction(
  path: string,
  label: string,
  setPending: (value: string | null) => void,
  setMessage: (value: string | null) => void,
  refresh: () => void,
) {
  setPending(label);
  setMessage(null);
  const response = await fetch(path, { method: "POST" });
  setPending(null);
  if (!response.ok) {
    setMessage(await apiMessage(response, `Could not ${label}.`));
    return;
  }
  refresh();
}

function toggleMulti(current: string[], optionId: string) {
  return current.includes(optionId)
    ? current.filter((id) => id !== optionId)
    : [...current, optionId];
}

function ranked(options: PollOption[]) {
  return [...options].sort((a, b) => b.voteCount - a.voteCount || startTime(a).getTime() - startTime(b).getTime());
}

function startTime(option: PollOption) {
  return option.startAt ? new Date(option.startAt) : new Date(0);
}

function totalVotes(options: PollOption[]) {
  return options.reduce((sum, option) => sum + option.voteCount, 0);
}

function formatDay(value?: string) {
  if (!value) return "Time";
  return new Date(value).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTimeRange(start?: string, end?: string) {
  if (!start) return "Time not set";
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : null;
  const startText = startDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const endText = endDate?.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return endText ? `${startText} - ${endText}` : startText;
}

function isGeneratedTimeLabel(label: string) {
  return /^\d{4}-\d{2}-\d{2}T.* - \d{4}-\d{2}-\d{2}T/.test(label);
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
