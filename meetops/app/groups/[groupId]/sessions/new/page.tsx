import { redirect } from "next/navigation";
import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { Card } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { HostSessionForm } from "@/components/sessions/SessionForms";
import { ApiRequestError, getGroupDetail, getGroupMembers } from "@/lib/web-api";

export default async function HostSessionPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const { group, members } = await getAccessibleGroup(groupId);

  return (
    <AuthenticatedPage>
      <div className="mx-auto max-w-2xl space-y-6">
        <PageHeader
          breadcrumb={`${group.name} / Sessions`}
          title="Host a Session"
          subtitle="Create a session idea. You can add a poll after this."
        />
        <Card>
          <HostSessionForm groupId={groupId} members={members} />
        </Card>
      </div>
    </AuthenticatedPage>
  );
}

async function getAccessibleGroup(groupId: string) {
  try {
    const [group, { members }] = await Promise.all([
      getGroupDetail(groupId),
      getGroupMembers(groupId),
    ]);
    return { group, members };
  } catch (error) {
    if (
      error instanceof ApiRequestError &&
      (error.status === 403 || error.status === 404)
    ) {
      redirect("/groups");
    }
    throw error;
  }
}
