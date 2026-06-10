import { redirect } from "next/navigation";
import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { Card, SectionTitle } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { TimeDisplay } from "@/components/common/TimeDisplay";
import { ManualScheduleForm } from "@/components/sessions/ManualScheduleForm";
import { ApiRequestError, getSessionDetail, getSessionPolls } from "@/lib/web-api";

export default async function ReschedulePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { session, finalOptions } = await getData(sessionId);

  return (
    <AuthenticatedPage>
      <div className="space-y-5">
        <PageHeader
          title="Choose Final Session Time"
          subtitle={session.topic ?? "Handle tie, no-vote, or rescheduling state."}
        />
        <Card>
          <SectionTitle title="Current schedule" />
          <TimeDisplay start={session.scheduledStartTime} end={session.scheduledEndTime} />
          <p className="mt-3 text-sm text-zinc-600">
            If this session already has a Calendar event, scheduling will update it instead of creating a duplicate.
          </p>
        </Card>
        <Card>
          <SectionTitle title="Schedule manually" subtitle="Pick a final timing option or enter a time." />
          <ManualScheduleForm sessionId={sessionId} options={finalOptions} />
        </Card>
      </div>
    </AuthenticatedPage>
  );
}

async function getData(sessionId: string) {
  try {
    const [session, polls] = await Promise.all([
      getSessionDetail(sessionId),
      getSessionPolls(sessionId),
    ]);
    const finalOptions = polls
      .filter((poll) => poll.type === "final_timing")
      .flatMap((poll) => poll.options)
      .filter((option) => option.startAt && option.endAt);
    return { session, finalOptions };
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      (error.status === 403 || error.status === 404)
    ) {
      redirect("/dashboard");
    }
    throw error;
  }
}
