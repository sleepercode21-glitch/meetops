import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { ButtonLink } from "@/components/common/Buttons";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/States";
import { GroupCard } from "@/components/groups/GroupCard";
import { getGroups } from "@/lib/web-api";

export default async function DashboardPage() {
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
          <EmptyState
            title="No groups yet"
            body="Join a group using an invite code, or create a new group for your community."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink href="/groups/join" tone="primary">Join Group</ButtonLink>
                <ButtonLink href="/groups/new">Create Group</ButtonLink>
              </div>
            }
          />
        )}
      </div>
    </AuthenticatedPage>
  );
}
