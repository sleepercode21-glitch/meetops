import { redirect } from "next/navigation";
import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { Card, SectionTitle } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { PollBuilderForm } from "@/components/polls/PollBuilderForm";
import { pollTypeLabels } from "@/lib/labels";
import { ApiRequestError, getPollDetail, getSessionDetail, getSessionPolls } from "@/lib/web-api";
import type { Poll, PollType, Session } from "@/types/domain";

export async function PollEditorPage({
  sessionId,
  pollId,
  requestedType,
}: {
  sessionId: string;
  pollId?: string;
  requestedType?: string;
}) {
  const { session, poll, polls } = await getEditorData(sessionId, pollId);
  const defaultPollType = poll?.type ?? requestedPollType(requestedType) ?? nextPollType(session, polls);
  const title = pollId ? "Edit Poll" : `Create ${pollTypeLabels[defaultPollType]}`;

  return (
    <AuthenticatedPage>
      <div className="space-y-5">
        <PageHeader
          breadcrumb={`Session / ${session.topic ?? "Untitled session"}`}
          title={title}
          subtitle={pollId ? "Update this poll and keep the session moving." : "The poll type follows the current session flow. Add options, set a deadline, then open voting."}
        />
        <div className="grid gap-5 lg:grid-cols-[1.3fr_0.8fr]">
          <Card>
            <PollBuilderForm
              sessionId={sessionId}
              existingPoll={poll}
              defaultPollType={defaultPollType}
            />
          </Card>
          <Card>
            <SectionTitle title="Poll rules" />
            <div className="space-y-3 text-sm text-zinc-600">
              <p>Only official options are voteable.</p>
              <p>Availability and final timing polls require start and end times.</p>
              <p>Members can vote after the poll is published.</p>
            </div>
          </Card>
        </div>
      </div>
    </AuthenticatedPage>
  );
}

async function getEditorData(sessionId: string, pollId?: string) {
  try {
    const [session, polls, poll] = await Promise.all([
      getSessionDetail(sessionId),
      getSessionPolls(sessionId),
      pollId ? getPollDetail(pollId) : Promise.resolve(undefined),
    ]);
    return { session, polls, poll };
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      (error.status === 403 || error.status === 404)
    ) {
      redirect(`/sessions/${sessionId}`);
    }
    throw error;
  }
}

function nextPollType(session: Session, polls: Poll[]): PollType {
  if (session.status === "draft") return "interest";
  if (session.status === "interest_check") return "topic";
  if (session.status === "topic_selection") return "availability";
  if (
    session.status === "availability_collection" ||
    session.status === "polling" ||
    session.status === "needs_host_decision" ||
    session.status === "scheduling_failed" ||
    session.status === "rescheduling"
  ) {
    return "final_timing";
  }

  const latestOpenPoll = [...polls]
    .reverse()
    .find((poll) => poll.status === "active" || poll.status === "draft");
  if (latestOpenPoll) return latestOpenPoll.type;

  const completedTypes = new Set(
    polls
      .filter((poll) => poll.status === "closed" || poll.status === "superseded")
      .map((poll) => poll.type),
  );
  if (!completedTypes.has("interest")) return "interest";
  if (!completedTypes.has("topic")) return "topic";
  if (!completedTypes.has("availability")) return "availability";
  return "final_timing";
}

function requestedPollType(value?: string): PollType | undefined {
  if (value === "interest" || value === "topic" || value === "availability" || value === "final_timing") {
    return value;
  }
  return undefined;
}
