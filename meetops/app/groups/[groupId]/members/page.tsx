import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { RoleBadge } from "@/components/common/Badge";
import { Button, ButtonLink } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { users } from "@/lib/mock-data";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader
          title="Members"
          subtitle="Manage who belongs to this group."
          primaryAction={<ButtonLink href={`/groups/${groupId}`}>Copy invite link</ButtonLink>}
        />
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs uppercase text-zinc-500">
              <tr><th className="py-3">Member</th><th>Role</th><th>Joined at</th><th>Marker</th><th>Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((user, index) => (
                <tr key={user.id}>
                  <td className="py-3"><div className="font-medium text-zinc-950">{user.name}</div><div className="text-zinc-500">{user.email}</div></td>
                  <td><RoleBadge role={index === 0 ? "admin" : "member"} /></td>
                  <td>Jun {index + 2}, 2026</td>
                  <td>{user.hasCalendarScope ? "Calendar connected" : "Needs reconnect"}</td>
                  <td><div className="flex gap-2"><Button>Promote</Button><Button tone="danger">Remove</Button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </AuthenticatedPage>
  );
}
