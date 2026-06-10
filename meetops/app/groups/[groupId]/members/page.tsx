import { redirect } from "next/navigation";
import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { ButtonLink } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { MemberActions } from "@/components/groups/GroupForms";
import { RoleBadge } from "@/components/common/Badge";
import {
  ApiRequestError,
  getGroupDetail,
  getGroupMembers,
} from "@/lib/web-api";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const { group, members } = await getMembersData(groupId);
  const currentUserIsAdmin = group.current_user_membership.is_admin;

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader
          title="Members"
          subtitle={`${members.length} ${members.length === 1 ? "person" : "people"} in this group.`}
          primaryAction={<ButtonLink href={`/groups/${groupId}`}>Back to Group</ButtonLink>}
        />
        <div className="flex gap-2 border-b border-zinc-200 text-sm">
          <ButtonLink href={`/groups/${groupId}`} tone="ghost" className="rounded-b-none border-transparent border-x-0 border-t-0 px-2.5">Sessions</ButtonLink>
          <ButtonLink href={`/groups/${groupId}/members`} tone="ghost" className="rounded-b-none border-zinc-950 border-x-0 border-t-0 px-2.5 text-zinc-950">Members</ButtonLink>
          {currentUserIsAdmin ? (
            <ButtonLink href={`/groups/${groupId}/settings`} tone="ghost" className="rounded-b-none border-transparent border-x-0 border-t-0 px-2.5">Settings</ButtonLink>
          ) : null}
        </div>
        <Card className="overflow-x-auto">
          <div className="mb-4 text-sm text-zinc-600">
            {members.length} {members.length === 1 ? "person" : "people"} in this group.
          </div>
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="text-xs uppercase text-zinc-500">
              <tr>
                <th className="py-3">Member</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Calendar</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {members.map((member) => (
                <tr key={member.user_id}>
                  <td className="py-3">
                    <div className="font-medium text-zinc-950">
                      {[member.firstname, member.lastname].filter(Boolean).join(" ") || member.email}
                    </div>
                    <div className="text-zinc-500">{member.email}</div>
                  </td>
                  <td><RoleBadge role={member.is_admin ? "admin" : "member"} /></td>
                  <td>{new Date(member.joined_at).toLocaleDateString()}</td>
                  <td>{member.calendar_events_scope_granted ? "Connected" : "Needs reconnect"}</td>
                  <td>
                    {currentUserIsAdmin ? (
                      <MemberActions groupId={groupId} member={member} />
                    ) : (
                      <span className="text-zinc-500">No actions</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </AuthenticatedPage>
  );
}

async function getMembersData(groupId: string) {
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
