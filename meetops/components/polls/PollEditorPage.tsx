import { redirect } from "next/navigation";
import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { Card, SectionTitle } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { PollBuilderForm } from "@/components/polls/PollBuilderForm";
import { ApiRequestError, getPollDetail, getSessionDetail } from "@/lib/web-api";

export async function PollEditorPage({
  sessionId,
  pollId,
}: {
  sessionId: string;
  pollId?: string;
}) {
  const { session, poll } = await getEditorData(sessionId, pollId);

  return (
    <AuthenticatedPage>
      <div className="space-y-5">
        <PageHeader
          breadcrumb={`Session / ${session.topic ?? "Untitled session"}`}
          title={pollId ? "Edit Poll" : "Create Poll"}
          subtitle="Create a draft poll, add official options, and publish when it is ready."
        />
        <div className="grid gap-5 lg:grid-cols-[1.3fr_0.8fr]">
          <Card>
            <PollBuilderForm sessionId={sessionId} existingPoll={poll} />
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
    const [session, poll] = await Promise.all([
      getSessionDetail(sessionId),
      pollId ? getPollDetail(pollId) : Promise.resolve(undefined),
    ]);
    return { session, poll };
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
