import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { ButtonLink } from "@/components/common/Buttons";
import { PageHeader } from "@/components/common/PageHeader";
import { GroupCard } from "@/components/groups/GroupCard";
import { getGroups } from "@/lib/web-api";

export default async function GroupsPage() {
  const groups = await getGroups();

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader
          title="My Groups"
          subtitle="Groups you belong to."
          primaryAction={<ButtonLink href="/groups/join" tone="primary">Join Group</ButtonLink>}
          secondaryActions={<ButtonLink href="/groups/new">Create Group</ButtonLink>}
        />
        {groups.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600">
            Join a group using an invite code, or create a new group for your community.
          </div>
        )}
      </div>
    </AuthenticatedPage>
  );
}
