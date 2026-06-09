import { PollStatusBadge } from "@/components/common/Badge";
import { Button, ButtonLink } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";
import { TimeDisplay } from "@/components/common/TimeDisplay";
import { pollTypeLabels } from "@/lib/labels";
import { relativeDeadline } from "@/lib/date-time";
import type { Poll } from "@/types/domain";

export function PollCard({ poll }: { poll: Poll }) {
  const totalVotes = poll.options.reduce((sum, option) => sum + option.voteCount, 0);
  const isActive = poll.status === "active";

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
          <p className="mt-1 text-sm text-zinc-500">{relativeDeadline(poll.deadline)}</p>
        </div>
        {isActive ? <Button tone="primary">Submit vote</Button> : null}
      </div>
      <div className="mt-4 space-y-2">
        {poll.options.length ? (
          poll.options.map((option) => {
            const selected = poll.currentUserVoteIds.includes(option.id);
            const percent = totalVotes ? Math.round((option.voteCount / totalVotes) * 100) : 0;
            return (
              <label
                key={option.id}
                className={`block rounded-md border p-3 ${
                  selected ? "border-blue-300 bg-blue-50" : "border-zinc-200 bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    readOnly
                    checked={selected}
                    type={poll.multiChoice ? "checkbox" : "radio"}
                    name={poll.id}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-zinc-950">{option.label}</div>
                    {option.startAt ? (
                      <TimeDisplay start={option.startAt} end={option.endAt} />
                    ) : null}
                    {selected ? (
                      <div className="mt-1 text-xs font-medium text-blue-700">
                        You voted for this
                      </div>
                    ) : null}
                    {!isActive ? (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-zinc-500">
                          <span>{option.voteCount} votes</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-zinc-100">
                          <div
                            className="h-2 rounded-full bg-zinc-900"
                            style={{ width: `${percent}%` }}
                          />
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
      {poll.status === "draft" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={`/sessions/${poll.sessionId}/polls/${poll.id}/edit`} tone="primary">
            Edit draft
          </ButtonLink>
          <Button disabled={!poll.options.length}>Publish</Button>
        </div>
      ) : null}
    </Card>
  );
}
