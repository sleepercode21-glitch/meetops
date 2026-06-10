import { redirect } from "next/navigation";
import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { SessionSetupWizard } from "@/components/sessions/SessionSetupWizard";
import {
  ApiRequestError,
  getGroupDetail,
  getSessionDetail,
  getSessionPolls,
} from "@/lib/web-api";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { session, polls, group } = await getSessionData(sessionId);

  return (
    <AuthenticatedPage>
      <SessionSetupWizard session={session} polls={polls} group={group} />
    </AuthenticatedPage>
  );
}

async function getSessionData(sessionId: string) {
  try {
    const session = await getSessionDetail(sessionId);
    const [polls, group] = await Promise.all([
      getSessionPolls(sessionId),
      getGroupDetail(session.groupId),
    ]);
    return { session, polls, group };
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
