import { redirect } from "next/navigation";
import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { Card } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { SessionEditForm } from "@/components/sessions/SessionEditForm";
import { ApiRequestError, getGroupMembers, getSessionDetail } from "@/lib/web-api";

export default async function EditSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { session, members } = await getEditableSession(sessionId);

  if (!session.currentUserCanManage) {
    redirect(`/sessions/${session.id}`);
  }

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader
          title="Edit Session"
          subtitle={session.topic ?? "Untitled session"}
        />
        <Card className="mx-auto max-w-3xl">
          <SessionEditForm session={session} members={members} />
        </Card>
      </div>
    </AuthenticatedPage>
  );
}

async function getEditableSession(sessionId: string) {
  try {
    const session = await getSessionDetail(sessionId);
    const { members } = await getGroupMembers(session.groupId);
    return { session, members };
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      (error.status === 403 || error.status === 404)
    ) {
      redirect("/sessions");
    }
    throw error;
  }
}
