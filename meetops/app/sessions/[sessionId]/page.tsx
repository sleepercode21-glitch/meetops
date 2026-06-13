import { redirect } from "next/navigation";
import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { SessionSetupWizard } from "@/components/sessions/SessionSetupWizard";
import {
  ApiRequestError,
  getGroupDetail,
  getCurrentUser,
  getSessionDetail,
  getSessionPolls,
} from "@/lib/web-api";

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { session, polls, group, currentUser } = await getSessionData(sessionId);

  return (
    <AuthenticatedPage>
      <SessionSetupWizard session={session} polls={polls} group={group} viewerTimezone={currentUser.timezone} />
    </AuthenticatedPage>
  );
}

async function getSessionData(sessionId: string) {
  try {
    const session = await getSessionDetail(sessionId);
    const [polls, group, currentUser] = await Promise.all([
      getSessionPolls(sessionId),
      getGroupDetail(session.groupId),
      getCurrentUser(),
    ]);
    return { session, polls, group, currentUser };
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
