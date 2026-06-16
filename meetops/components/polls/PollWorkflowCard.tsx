"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { PollStatusBadge } from "@/components/common/Badge";
import { Button, ButtonLink } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";
import { ConfirmButton } from "@/components/common/ConfirmAction";
import { pollTypeLabels } from "@/lib/labels";
import type { CalendarInvitePolicy, Poll, PollOption } from "@/types/domain";

export function PollWorkflowCard({
  poll,
  canManage,
  hostTimezone,
  viewerTimezone,
}: {
  poll: Poll;
  canManage: boolean;
  hostTimezone?: string;
  viewerTimezone?: string;
}) {
  if (poll.type === "availability") {
    return <AvailabilityPollCard poll={poll} canManage={canManage} hostTimezone={hostTimezone} viewerTimezone={viewerTimezone} />;
  }
  if (poll.type === "final_timing") {
    return <FinalTimingPollCard poll={poll} canManage={canManage} hostTimezone={hostTimezone} viewerTimezone={viewerTimezone} />;
  }
  return <StandardPollCard poll={poll} canManage={canManage} hostTimezone={hostTimezone} viewerTimezone={viewerTimezone} />;
}

function AvailabilityPollCard({
  poll,
  canManage,
  hostTimezone,
  viewerTimezone,
}: {
  poll: Poll;
  canManage: boolean;
  hostTimezone?: string;
  viewerTimezone?: string;
}) {
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
          <RankedResults options={rankedOptions} emptyText="No availability votes were submitted." hostTimezone={hostTimezone} viewerTimezone={viewerTimezone} />
        </Card>
        {canManage ? <CreateFinalTimingFromAvailabilityCard poll={poll} hostTimezone={hostTimezone} viewerTimezone={viewerTimezone} /> : null}
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
          <ConfirmButton
            tone="primary"
            disabled={pending === "close"}
            onConfirm={() => void closePoll()}
            confirm={{
              title: "Close availability poll?",
              message: "Members will stop being able to update availability. The host can review results and create the final timing vote.",
              confirmLabel: "Close poll",
            }}
          >
            {pending === "close" ? "Closing..." : "Close Poll"}
          </ConfirmButton>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        {canManage && poll.status === "active" ? (
          <>
            <AvailabilityLiveSummary options={rankedOptions} hostTimezone={hostTimezone} viewerTimezone={viewerTimezone} />
            <RankedResults options={rankedOptions} emptyText="No availability responses yet." hostTimezone={hostTimezone} viewerTimezone={viewerTimezone} />
          </>
        ) : null}
        {poll.status === "active" ? (
          <AvailabilityResponseForm poll={poll} viewerTimezone={viewerTimezone} />
        ) : (
          poll.options.map((option) => <WindowRow key={option.id} option={option} hostTimezone={hostTimezone} viewerTimezone={viewerTimezone} />)
        )}
      </div>
      {message ? <p className="mt-3 text-sm text-zinc-700">{message}</p> : null}
      {canManage && poll.status === "draft" ? <DraftControls poll={poll} pending={pending} setPending={setPending} setMessage={setMessage} /> : null}
    </Card>
  );
}

function AvailabilityLiveSummary({ options, hostTimezone, viewerTimezone }: { options: PollOption[]; hostTimezone?: string; viewerTimezone?: string }) {
  const topVoteCount = options[0]?.voteCount ?? 0;
  const best = topVoteCount > 0 ? options.filter((option) => option.voteCount === topVoteCount) : [];
  const topOption = best[0];
  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-teal-800">Current best</div>
          {best.length ? (
            <div className="mt-1 text-sm font-medium text-teal-950">
              {best.length > 1 ? `${best.length} times tied` : <DualTimeRange option={topOption} hostTimezone={hostTimezone} viewerTimezone={viewerTimezone} compact />}
            </div>
          ) : (
            <div className="mt-1 text-sm font-medium text-teal-950">Waiting for availability</div>
          )}
        </div>
        <span className="rounded-full border border-teal-200 bg-white px-2.5 py-1 text-xs font-medium text-teal-800">
          {topVoteCount} {topVoteCount === 1 ? "person" : "people"}
        </span>
      </div>
    </div>
  );
}

function FinalTimingPollCard({
  poll,
  canManage,
  hostTimezone,
  viewerTimezone,
}: {
  poll: Poll;
  canManage: boolean;
  hostTimezone?: string;
  viewerTimezone?: string;
}) {
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
        <RankedResults options={ranked(poll.options)} emptyText="No final timing votes were submitted." hostTimezone={hostTimezone} viewerTimezone={viewerTimezone} />
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
          <ConfirmButton
            tone="primary"
            disabled={pending === "close"}
            onConfirm={() => void closePoll()}
            confirm={{
              title: "Close and schedule?",
              message: "This closes the final timing vote. If there is a clear winner, the session will be scheduled from that result.",
              confirmLabel: "Close and schedule",
            }}
          >
            {pending === "close" ? "Closing..." : "Close & Schedule"}
          </ConfirmButton>
        ) : null}
      </div>

      <div className="mt-4 space-y-3">
        {canManage && poll.status === "active" ? (
          <>
            <FinalTimingLiveSummary options={ranked(poll.options)} hostTimezone={hostTimezone} viewerTimezone={viewerTimezone} />
          </>
        ) : null}
        {poll.status === "active" ? (
          <TimeSlotVoteGrid
            options={poll.options}
            selectedIds={selected}
            mode="single"
            disabled={pending === "vote"}
            viewerTimezone={viewerTimezone}
            onToggle={(option) => setSelected([option.id])}
          />
        ) : (
          <RankedResults options={ranked(poll.options)} emptyText="No final timing votes yet." hostTimezone={hostTimezone} viewerTimezone={viewerTimezone} />
        )}
      </div>

      {poll.status === "active" ? (
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
    </Card>
  );
}

function StandardPollCard({
  poll,
  canManage,
  hostTimezone,
  viewerTimezone,
}: {
  poll: Poll;
  canManage: boolean;
  hostTimezone?: string;
  viewerTimezone?: string;
}) {
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
  const resultOnly = poll.status !== "active";

  return (
    <Card>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PollHeading title={pollTypeLabels[poll.type]} subtitle={poll.type === "topic" ? "Choose or suggest a topic." : undefined} poll={poll} />
        {canManage && poll.status === "active" ? (
          <ConfirmButton
            tone="primary"
            disabled={pending === "close"}
            onConfirm={() => void closePoll()}
            confirm={{
              title: "Close poll?",
              message: "Members will stop being able to vote. Results will remain visible for review.",
              confirmLabel: "Close poll",
            }}
          >
            {pending === "close" ? "Closing..." : "Close Poll"}
          </ConfirmButton>
        ) : null}
      </div>

      <div className="mt-4 space-y-2">
        {resultOnly ? (
          <CompactResults options={poll.options} emptyText="No votes yet." hostTimezone={hostTimezone} viewerTimezone={viewerTimezone} />
        ) : (
          poll.options.map((option) => {
            const checked = selected.includes(option.id);
            return (
              <OptionVoteRow
                key={option.id}
                option={option}
                checked={checked}
                multiChoice={poll.multiChoice}
                disabled={poll.status !== "active" || pending === "vote"}
                showResults={showResults}
                totalVotes={totalVotes(poll.options)}
                hostTimezone={hostTimezone}
                viewerTimezone={viewerTimezone}
                onClick={() => {
                  const next = poll.multiChoice ? toggleMulti(selected, option.id) : [option.id];
                  setSelected(next);
                  if (poll.status === "active") void submitVote(next);
                }}
              />
            );
          })
        )}
      </div>

      {message ? <p className="mt-3 text-sm text-zinc-700">{message}</p> : null}
      {canManage && poll.status === "draft" ? <DraftControls poll={poll} pending={pending} setPending={setPending} setMessage={setMessage} /> : null}
    </Card>
  );
}

function FinalTimingLiveSummary({ options, hostTimezone, viewerTimezone }: { options: PollOption[]; hostTimezone?: string; viewerTimezone?: string }) {
  const topVoteCount = options[0]?.voteCount ?? 0;
  const leaders = topVoteCount > 0 ? options.filter((option) => option.voteCount === topVoteCount) : [];
  const leader = leaders[0];
  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-teal-800">Current leader</div>
          <div className="mt-1 text-sm font-medium text-teal-950">
            {leaders.length === 0
              ? "Waiting for votes"
              : leaders.length > 1
                ? `${leaders.length} times tied`
                : <DualTimeRange option={leader} hostTimezone={hostTimezone} viewerTimezone={viewerTimezone} compact />}
          </div>
        </div>
        <span className="rounded-full border border-teal-200 bg-white px-2.5 py-1 text-xs font-medium text-teal-800">
          {topVoteCount} {topVoteCount === 1 ? "vote" : "votes"}
        </span>
      </div>
    </div>
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

type AvailabilityRecommendation = {
  option_id: number;
  start_at: string;
  end_at: string;
  available_count: number;
  duration_minutes: number;
};

function AvailabilityResponseForm({
  poll,
  viewerTimezone,
}: {
  poll: Poll;
  viewerTimezone?: string;
}) {
  const router = useRouter();
  const displayTimezone = useViewerTimezone(viewerTimezone);
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
            startAt: toDateTimeInputInZone(response.start_at, displayTimezone),
            endAt: toDateTimeInputInZone(response.end_at, displayTimezone),
          };
        }
        setValues(next);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [displayTimezone, poll.id]);

  function toggleOption(option: PollOption) {
    if (!loaded || pending || !option.startAt || !option.endAt) return;
    const current = values[option.id];
    if (current?.startAt && current?.endAt) {
      setValues((existing) => {
        const next = { ...existing };
        delete next[option.id];
        return next;
      });
      return;
    }
    setValues((existing) => ({
      ...existing,
      [option.id]: {
        startAt: toDateTimeInputInZone(option.startAt, displayTimezone),
        endAt: toDateTimeInputInZone(option.endAt, displayTimezone),
      },
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
      const startIso = zonedInputToIso(value.startAt, displayTimezone);
      const endIso = zonedInputToIso(value.endAt, displayTimezone);
      if (option.startAt && new Date(startIso) < new Date(option.startAt)) {
        throw new Error("Start time must be inside the host window.");
      }
      if (option.endAt && new Date(endIso) > new Date(option.endAt)) {
        throw new Error("End time must be inside the host window.");
      }
      return [{
        option_id: Number(option.id),
        start_at: startIso,
        end_at: endIso,
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

  const hasSelectedAvailability = Object.values(values).some((value) => value.startAt && value.endAt);

  return (
    <div className="space-y-3">
      <TimeSlotVoteGrid
        options={poll.options}
        selectedIds={Object.entries(values).flatMap(([optionId, value]) => value.startAt && value.endAt ? [optionId] : [])}
        mode="multiple"
        disabled={!loaded || pending}
        viewerTimezone={displayTimezone}
        onToggle={toggleOption}
      />
      <Button type="button" tone="primary" className="w-full sm:w-auto" disabled={!loaded || pending} onClick={safeSubmit}>
        {pending ? "Saving..." : hasSelectedAvailability ? "Update Availability" : "Submit Availability"}
      </Button>
      {message ? <p className="text-sm text-zinc-700">{message}</p> : null}
    </div>
  );
}

function TimeSlotVoteGrid({
  options,
  selectedIds,
  mode,
  disabled,
  viewerTimezone,
  onToggle,
}: {
  options: PollOption[];
  selectedIds: string[];
  mode: "single" | "multiple";
  disabled: boolean;
  viewerTimezone?: string;
  onToggle: (option: PollOption) => void;
}) {
  const displayTimezone = useViewerTimezone(viewerTimezone);
  const timeOptions = options.filter((option) => option.startAt && option.endAt);
  const textOptions = options.filter((option) => !option.startAt || !option.endAt);
  const dateKeys = uniqueSortedDateKeys(timeOptions.map((option) => dateKeyInZone(option.startAt!, displayTimezone)));
  const byDate = new Map<string, Map<number, PollOption>>();

  for (const option of timeOptions) {
    const dateKey = dateKeyInZone(option.startAt!, displayTimezone);
    const hour = hourInZone(option.startAt!, displayTimezone);
    const dateOptions = byDate.get(dateKey) ?? new Map<number, PollOption>();
    dateOptions.set(hour, option);
    byDate.set(dateKey, dateOptions);
  }

  return (
    <div className="space-y-3">
      {dateKeys.map((dateKey) => (
        <TimeSlotVoteBar
          key={dateKey}
          dateKey={dateKey}
          optionsByHour={byDate.get(dateKey) ?? new Map()}
          selectedIds={selectedIds}
          mode={mode}
          disabled={disabled}
          onToggle={onToggle}
        />
      ))}
      {textOptions.map((option) => {
        const checked = selectedIds.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(option)}
            className={`flex min-h-14 w-full items-center gap-3 rounded-lg border p-4 text-left transition ${
              checked ? "border-teal-400 bg-teal-50" : "border-zinc-200 bg-white"
            } ${disabled ? "cursor-default opacity-80" : "hover:border-teal-300 hover:bg-teal-50/60"}`}
            aria-pressed={checked}
          >
            <SelectionMark selected={checked} mode={mode} />
            <span className="font-medium text-zinc-950">{option.label}</span>
          </button>
        );
      })}
      {!timeOptions.length && !textOptions.length ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">No options yet.</p>
      ) : null}
      {timeOptions.length ? (
        <p className="text-xs text-zinc-500">
          Tap {mode === "single" ? "one time slot" : "the time slots"} that work for you. Times are shown in {zoneLabel(displayTimezone)}.
        </p>
      ) : null}
    </div>
  );
}

function TimeSlotVoteBar({
  dateKey,
  optionsByHour,
  selectedIds,
  mode,
  disabled,
  onToggle,
}: {
  dateKey: string;
  optionsByHour: Map<number, PollOption>;
  selectedIds: string[];
  mode: "single" | "multiple";
  disabled: boolean;
  onToggle: (option: PollOption) => void;
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
          const option = optionsByHour.get(hour);
          const selected = option ? selectedIds.includes(option.id) : false;
          const unavailable = !option;
          return (
            <button
              key={`${dateKey}-${hour}`}
              type="button"
              disabled={disabled || unavailable}
              onClick={() => option ? onToggle(option) : undefined}
              className={`flex min-h-14 min-w-0 flex-col items-center justify-center border-l border-white/70 text-xs font-semibold transition ${
                selected
                  ? "bg-teal-600 text-white shadow-inner"
                  : unavailable
                    ? "bg-zinc-100 text-zinc-300"
                    : "bg-teal-50 text-teal-800 hover:bg-teal-100"
              } ${disabled || unavailable ? "cursor-not-allowed" : ""}`}
              aria-pressed={selected}
              aria-label={`${mode === "single" ? "Choose" : selected ? "Remove" : "Add"} ${formatHour(hour)} on ${dateKey}`}
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

function SelectionMark({ selected, mode }: { selected: boolean; mode: "single" | "multiple" }) {
  return (
    <span className={`flex size-5 shrink-0 items-center justify-center ${mode === "single" ? "rounded-full" : "rounded"} border ${selected ? "border-teal-700 bg-teal-700" : "border-zinc-400 bg-white"}`}>
      {selected ? <span className={`${mode === "single" ? "size-2 rounded-full" : "size-2.5 rounded-sm"} bg-white`} /> : null}
    </span>
  );
}

function WindowRow({ option, hostTimezone, viewerTimezone }: { option: PollOption; hostTimezone?: string; viewerTimezone?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4">
      <TimeOptionContent option={option} showLabel={false} hostTimezone={hostTimezone} viewerTimezone={viewerTimezone} />
    </div>
  );
}

function TimeOptionContent({
  option,
  showLabel = true,
  hostTimezone,
  viewerTimezone,
  preferViewer = false,
}: {
  option: PollOption;
  showLabel?: boolean;
  hostTimezone?: string;
  viewerTimezone?: string;
  preferViewer?: boolean;
}) {
  const visibleLabel = showLabel && !isGeneratedTimeLabel(option.label) ? option.label : "";
  return (
    <span className="min-w-0">
      <DualTimeRange option={option} hostTimezone={hostTimezone} viewerTimezone={viewerTimezone} preferViewer={preferViewer} />
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
  hostTimezone,
  viewerTimezone,
  onClick,
}: {
  option: PollOption;
  checked: boolean;
  multiChoice: boolean;
  disabled: boolean;
  showResults: boolean;
  totalVotes: number;
  hostTimezone?: string;
  viewerTimezone?: string;
  onClick: () => void;
}) {
  const percent = votesTotal ? Math.round((option.voteCount / votesTotal) * 100) : 0;
  const hasTimeWindow = Boolean(option.startAt && option.endAt);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`block w-full rounded-lg border p-4 text-left transition ${
        checked ? "border-teal-400 bg-teal-50" : "border-zinc-200 bg-white"
      } ${disabled ? "cursor-default opacity-80" : "hover:border-teal-300"}`}
      aria-pressed={checked}
    >
      <div className="flex items-start gap-3">
        <span className={`mt-1 flex size-5 shrink-0 items-center justify-center ${multiChoice ? "rounded" : "rounded-full"} border ${checked ? "border-teal-700 bg-teal-700 text-white" : "border-zinc-400 bg-white"}`}>
          {checked ? (multiChoice ? <span className="size-2.5 rounded-sm bg-white" /> : <span className="size-2 rounded-full bg-white" />) : null}
        </span>
        <div className="min-w-0 flex-1">
          {hasTimeWindow ? (
            <TimeOptionContent option={option} showLabel={false} hostTimezone={hostTimezone} viewerTimezone={viewerTimezone} />
          ) : (
            <div className="font-medium text-zinc-950">{option.label}</div>
          )}
          {showResults ? <ResultMeter option={option} totalVotes={votesTotal} percent={percent} /> : null}
        </div>
      </div>
    </button>
  );
}

function CompactResults({
  options,
  emptyText,
  hostTimezone,
  viewerTimezone,
}: {
  options: PollOption[];
  emptyText: string;
  hostTimezone?: string;
  viewerTimezone?: string;
}) {
  if (!options.some((option) => option.voteCount > 0)) {
    return <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">{emptyText}</p>;
  }
  const votesTotal = totalVotes(options);
  return (
    <div className="space-y-2">
      {ranked(options).map((option) => {
        const percent = votesTotal ? Math.round((option.voteCount / votesTotal) * 100) : 0;
        return (
          <div key={option.id} className="rounded-lg border border-zinc-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 font-medium text-zinc-950">
                {option.startAt && option.endAt ? (
                  <TimeOptionContent option={option} showLabel={false} hostTimezone={hostTimezone} viewerTimezone={viewerTimezone} />
                ) : (
                  option.label
                )}
              </div>
              <div className="shrink-0 text-sm text-zinc-500">
                {option.voteCount} {option.voteCount === 1 ? "vote" : "votes"} · {percent}%
              </div>
            </div>
            <div className="mt-2 h-2 rounded-full bg-zinc-100">
              <div className="h-2 rounded-full bg-zinc-900" style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RankedResults({
  options,
  emptyText,
  hostTimezone,
  viewerTimezone,
}: {
  options: PollOption[];
  emptyText: string;
  hostTimezone?: string;
  viewerTimezone?: string;
}) {
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
                <DualTimeRange option={option} hostTimezone={hostTimezone} viewerTimezone={viewerTimezone} />
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

function CreateFinalTimingFromAvailabilityCard({
  poll,
  hostTimezone,
  viewerTimezone,
}: {
  poll: Poll;
  hostTimezone?: string;
  viewerTimezone?: string;
}) {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<AvailabilityRecommendation[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const displayTimezone = useViewerTimezone(viewerTimezone);
  const [deadline, setDeadline] = useState(() => toDateTimeInputInZone(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), displayTimezone));
  const [calendarInvitePolicy, setCalendarInvitePolicy] = useState<CalendarInvitePolicy>("all_members");
  const [minDeadline] = useState(() => toDateTimeInputInZone(new Date(Date.now() + 60_000).toISOString(), displayTimezone));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/polls/${poll.id}/availability-recommendations`)
      .then((response) => response.ok ? response.json() : null)
      .then((body: { data?: AvailabilityRecommendation[] } | null) => {
        if (cancelled) return;
        const next = body?.data ?? [];
        setRecommendations(next);
        setSelected(next.slice(0, 3).map(recommendationKey));
      })
      .catch(() => {
        if (!cancelled) setRecommendations([]);
      });
    return () => {
      cancelled = true;
    };
  }, [poll.id]);

  async function createFinalTimingPoll() {
    if (selected.length < 1) {
      setMessage("Choose at least one recommended time for the final vote.");
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
        windows: recommendations
          .filter((recommendation) => selected.includes(recommendationKey(recommendation)))
          .map((recommendation) => ({
            start_at: recommendation.start_at,
            end_at: recommendation.end_at,
          })),
        deadline: zonedInputToIso(deadline, displayTimezone),
        calendar_invite_policy: calendarInvitePolicy,
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
      <h2 className="text-lg font-semibold text-zinc-950">Choose final vote options</h2>
      <p className="mt-1 text-sm text-zinc-600">Selected overlap windows become the choices in the final timing poll.</p>
      <div className="mt-4 space-y-2">
        {recommendations.length ? recommendations.map((recommendation) => {
          const key = recommendationKey(recommendation);
          return (
            <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3">
              <input
                type="checkbox"
                className="mt-1 size-4"
                checked={selected.includes(key)}
                onChange={() => setSelected((current) => toggleMulti(current, key))}
              />
              <span className="min-w-0 flex-1">
                <DualTimeRange option={recommendationOption(recommendation)} hostTimezone={hostTimezone} viewerTimezone={displayTimezone} />
                <span className="mt-1 block text-sm text-zinc-500">
                  {recommendation.available_count} {recommendation.available_count === 1 ? "person" : "people"} available · {recommendation.duration_minutes} min overlap
                </span>
              </span>
            </label>
          );
        }) : (
          <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
            No overlapping availability was submitted. Ask members to add availability or pick a timing manually.
          </p>
        )}
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
      <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50/60 p-3">
        <div className="text-sm font-semibold text-teal-950">Calendar invites after this vote</div>
        <div className="mt-2 grid gap-2">
          <FinalInvitePolicyRadio
            value="all_members"
            current={calendarInvitePolicy}
            title="Invite everyone"
            description="Use this if interest was skipped or everyone should get the event."
            onChange={setCalendarInvitePolicy}
          />
          <FinalInvitePolicyRadio
            value="interested_members"
            current={calendarInvitePolicy}
            title="Invite interested members"
            description="Use this only if an interest check decided who is attending."
            onChange={setCalendarInvitePolicy}
          />
          <FinalInvitePolicyRadio
            value="app_only"
            current={calendarInvitePolicy}
            title="App link only"
            description="Create the Meet link without sending Calendar invites."
            onChange={setCalendarInvitePolicy}
          />
        </div>
      </div>
      <Button type="button" tone="primary" className="mt-4 w-full sm:w-auto" disabled={pending || !recommendations.length} onClick={createFinalTimingPoll}>
        {pending ? "Creating..." : "Create poll"}
      </Button>
      {message ? <p className="mt-3 text-sm text-zinc-700">{message}</p> : null}
    </Card>
  );
}

function FinalInvitePolicyRadio({
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
    <label className="flex cursor-pointer gap-3 rounded-md border border-teal-100 bg-white/80 p-2.5">
      <input
        type="radio"
        className="mt-1"
        checked={current === value}
        onChange={() => onChange(value)}
      />
      <span>
        <span className="block text-sm font-medium text-zinc-950">{title}</span>
        <span className="text-xs text-zinc-600">{description}</span>
      </span>
    </label>
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
  async function deleteDraftPoll() {
    setPending("delete");
    setMessage(null);
    const response = await fetch(`/api/v1/polls/${poll.id}`, { method: "DELETE" });
    setPending(null);
    if (!response.ok) {
      setMessage(await apiMessage(response, "Could not delete draft poll."));
      return;
    }
    router.refresh();
  }

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
      <ConfirmButton
        tone="danger"
        disabled={pending === "delete"}
        onConfirm={() => void deleteDraftPoll()}
        confirm={{
          title: "Delete draft poll?",
          message: "This permanently removes this poll draft and its options.",
          confirmLabel: "Delete draft",
          cancelLabel: "Keep draft",
        }}
      >
        {pending === "delete" ? "Deleting..." : "Delete Draft"}
      </ConfirmButton>
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

function recommendationKey(recommendation: AvailabilityRecommendation) {
  return `${recommendation.start_at}|${recommendation.end_at}`;
}

function recommendationOption(recommendation: AvailabilityRecommendation): PollOption {
  return {
    id: recommendationKey(recommendation),
    label: `${recommendation.start_at} - ${recommendation.end_at}`,
    startAt: recommendation.start_at,
    endAt: recommendation.end_at,
    voteCount: recommendation.available_count,
  };
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

function DualTimeRange({
  option,
  hostTimezone,
  viewerTimezone,
  compact = false,
  preferViewer = false,
}: {
  option: PollOption;
  hostTimezone?: string;
  viewerTimezone?: string;
  compact?: boolean;
  preferViewer?: boolean;
}) {
  const displayTimezone = useViewerTimezone(viewerTimezone);
  const sourceTimezone = hostTimezone || displayTimezone;
  const hostText = formatRangeInZone(option.startAt, option.endAt, sourceTimezone);
  const viewerText = formatRangeInZone(option.startAt, option.endAt, displayTimezone);
  const sameZone = sourceTimezone === displayTimezone;

  if (compact) {
    return (
      <span className="block">
        <span className="block font-medium text-zinc-950">{hostText}</span>
        <span className="mt-0.5 block text-xs font-normal text-zinc-500">
          Host time · {zoneLabel(sourceTimezone)}
          {sameZone ? " · also your time" : ` · Your time: ${viewerText} (${zoneLabel(displayTimezone)})`}
        </span>
      </span>
    );
  }

  return (
    <span className="block">
      {preferViewer && !sameZone ? (
        <>
          <span className="block font-medium text-teal-900">Your time · {viewerText}</span>
          <span className="mt-1 block text-xs text-zinc-500">
            Host time · {hostText} ({zoneLabel(sourceTimezone)})
          </span>
        </>
      ) : sameZone ? (
        <>
          <span className="block font-medium text-zinc-950">{hostText}</span>
          <span className="mt-1 block text-sm font-medium text-teal-800">This is your local time.</span>
        </>
      ) : (
        <>
          <span className="block font-medium text-zinc-950">{hostText}</span>
          <span className="mt-1 block text-xs text-zinc-500">Host time · {zoneLabel(sourceTimezone)}</span>
          <span className="mt-1 block text-sm font-medium text-teal-800">
            Your time · {viewerText} ({zoneLabel(displayTimezone)})
          </span>
        </>
      )}
    </span>
  );
}

function useViewerTimezone(savedTimezone?: string) {
  return useSyncExternalStore(
    () => () => undefined,
    () => savedTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    () => savedTimezone || "UTC",
  );
}

function formatRangeInZone(start?: string, end?: string, timeZone = "UTC") {
  if (!start) return "Time not set";
  const sameDay = end && dateKeyInZone(start, timeZone) === dateKeyInZone(end, timeZone);
  const startText = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(start));
  if (!end) return startText;
  const endText = new Intl.DateTimeFormat("en-US", sameDay ? {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  } : {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(end));
  return `${startText} - ${endText}`;
}

function dateKeyInZone(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(new Date(value));
}

function hourInZone(value: string, timeZone: string) {
  const hour = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(value));
  return Number(hour);
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

function zoneLabel(timeZone: string) {
  if (timeZone === "America/Phoenix") return "Arizona time";
  return timeZone.replaceAll("_", " ");
}

function isGeneratedTimeLabel(label: string) {
  return /^\d{4}-\d{2}-\d{2}T.* - \d{4}-\d{2}-\d{2}T/.test(label);
}

function toDateTimeInputInZone(value: string | undefined, timeZone: string) {
  if (!value) return "";
  const parts = dateTimePartsInZone(new Date(value), timeZone);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

function zonedInputToIso(value: string, timeZone: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return new Date(value).toISOString();
  const [, year, month, day, hour, minute] = match;
  const utcGuess = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)));
  const firstPass = new Date(utcGuess.getTime() - offsetForZone(utcGuess, timeZone));
  const corrected = new Date(utcGuess.getTime() - offsetForZone(firstPass, timeZone));
  return corrected.toISOString();
}

function offsetForZone(date: Date, timeZone: string) {
  const parts = dateTimePartsInZone(date, timeZone);
  const wallAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
  );
  const roundedDate = Math.floor(date.getTime() / 60000) * 60000;
  return wallAsUtc - roundedDate;
}

function dateTimePartsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: value.year,
    month: value.month,
    day: value.day,
    hour: value.hour === "24" ? "00" : value.hour,
    minute: value.minute,
  };
}

async function apiMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return body?.error?.message ?? fallback;
}
