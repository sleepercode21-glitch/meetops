import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { Button, ButtonLink } from "@/components/common/Buttons";
import { Card, SectionTitle } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { TimeDisplay } from "@/components/common/TimeDisplay";
import { getSession, getSessionPolls } from "@/lib/mock-data";

export default async function ReschedulePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = getSession(sessionId);
  const finalPoll = getSessionPolls(sessionId).find((poll) => poll.type === "final_timing");

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader title="Choose final session time" subtitle={session?.topic ?? "Handle tie, no-vote, or rescheduling state."} />
        <Card>
          <SectionTitle title="Current schedule" />
          <TimeDisplay start={session?.scheduledStartTime} end={session?.scheduledEndTime} />
          <p className="mt-3 text-sm text-zinc-600">Because this session may already have a Calendar event, the existing event will be updated instead of creating a duplicate.</p>
        </Card>
        <Card>
          <SectionTitle title="Final timing options" subtitle="Choose one option or create a new final timing poll." />
          <div className="space-y-2">
            {finalPoll?.options.map((option) => (
              <label key={option.id} className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 p-3">
                <span><input type="radio" name="winner" className="mr-2" />{option.label}</span>
                <span className="text-sm text-zinc-500">{option.voteCount} votes</span>
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button tone="primary">Schedule with selected time</Button>
            <ButtonLink href={`/sessions/${sessionId}/polls/new`}>Create new final timing poll</ButtonLink>
            <Button tone="danger">Cancel session</Button>
          </div>
        </Card>
      </div>
    </AuthenticatedPage>
  );
}
