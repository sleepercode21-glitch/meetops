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
          <ButtonLink href={`/groups/${groupId}/history`} tone="ghost" className="rounded-b-none border-transparent border-x-0 border-t-0 px-2.5">History</ButtonLink>
          {currentUserIsAdmin ? (
            <ButtonLink href={`/groups/${groupId}/settings`} tone="ghost" className="rounded-b-none border-transparent border-x-0 border-t-0 px-2.5">Settings</ButtonLink>
          ) : null}
        </div>
        <Card>
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.user_id}
                className="grid gap-4 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-[minmax(260px,1fr)_auto]"
              >
                <div className="flex min-w-0 gap-3">
                  {member.profile_photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.profile_photo}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-full border border-zinc-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-sm font-semibold text-white">
                      {memberInitials(member)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate font-medium text-zinc-950">
                        {memberName(member)}
                      </div>
                      <RoleBadge role={member.is_admin ? "admin" : "member"} />
                    </div>
                    <div className="truncate text-sm text-zinc-500">{member.email}</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-600">
                      <InfoChip label="Timezone" value={member.timezone ?? "Not set"} />
                      <InfoChip label="Joined" value={formatDate(member.joined_at)} />
                      <InfoChip
                        label="Calendar"
                        value={
                          member.calendar_events_scope_granted
                            ? "Ready"
                            : member.calendar_connected
                              ? "Reconnect"
                              : "Not connected"
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-start md:justify-end">
                  {currentUserIsAdmin ? (
                    <MemberActions groupId={groupId} member={member} />
                  ) : (
                    <span className="text-sm text-zinc-500">No actions</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AuthenticatedPage>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1">
      <span className="text-zinc-500">{label}: </span>
      <span className="font-medium text-zinc-800">{value}</span>
    </span>
  );
}

function memberName(member: {
  firstname: string | null;
  lastname: string | null;
  email: string;
}) {
  return [member.firstname, member.lastname].filter(Boolean).join(" ") || member.email;
}

function memberInitials(member: {
  firstname: string | null;
  lastname: string | null;
  email: string;
}) {
  const name = memberName(member);
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) {
    return "Not available";
  }
  return new Date(value).toLocaleDateString();
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
