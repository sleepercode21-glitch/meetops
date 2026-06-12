import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { ButtonLink } from "@/components/common/Buttons";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/States";
import { GroupCard } from "@/components/groups/GroupCard";
import { RealtimeSessionRefresh } from "@/components/sessions/RealtimeSessionRefresh";
import { getGroups } from "@/lib/web-api";

export default async function GroupsPage() {
  const groups = await getGroups();

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader
          title="My Groups"
          subtitle="Pick a group to host, vote, or join a scheduled session."
          badge={<RealtimeSessionRefresh enabled intervalMs={3000} />}
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
            body="Join with an invite code or create a group for your community."
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
