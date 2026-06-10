import { redirect } from "next/navigation";
import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { ButtonLink } from "@/components/common/Buttons";
import { Card, SectionTitle } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import {
  GroupProfileForm,
  InviteSettingsForm,
  MeetingOwnerForm,
} from "@/components/groups/GroupForms";
import {
  ApiRequestError,
  getGroupDetail,
  getGroupMembers,
} from "@/lib/web-api";

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const { group, members } = await getSettingsData(groupId);

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader
          title="Settings"
          subtitle={group.name}
          primaryAction={<ButtonLink href={`/groups/${groupId}`}>Back to Group</ButtonLink>}
        />
        <div className="flex gap-2 border-b border-zinc-200 text-sm">
          <ButtonLink href={`/groups/${groupId}`} tone="ghost" className="rounded-b-none border-transparent border-x-0 border-t-0 px-2.5">Sessions</ButtonLink>
          <ButtonLink href={`/groups/${groupId}/members`} tone="ghost" className="rounded-b-none border-transparent border-x-0 border-t-0 px-2.5">Members</ButtonLink>
          <ButtonLink href={`/groups/${groupId}/settings`} tone="ghost" className="rounded-b-none border-zinc-950 border-x-0 border-t-0 px-2.5 text-zinc-950">Settings</ButtonLink>
        </div>
        <SettingsCard title="Group profile">
          <GroupProfileForm group={group} />
        </SettingsCard>
        <SettingsCard title="Invite settings">
          <InviteSettingsForm group={group} />
        </SettingsCard>
        <SettingsCard title="Meeting owner">
          <MeetingOwnerForm group={group} members={members} />
        </SettingsCard>
      </div>
    </AuthenticatedPage>
  );
}

async function getSettingsData(groupId: string) {
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

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card className="space-y-4"><SectionTitle title={title} />{children}</Card>;
}
