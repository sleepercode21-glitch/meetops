import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { ButtonLink } from "@/components/common/Buttons";
import { Card, SectionTitle } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/States";
import { getGroups } from "@/lib/web-api";

export default async function CreateSessionPage() {
  const groups = await getGroups();

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader
          title="Choose a Group"
          subtitle="Sessions belong to a group, so pick where this planning flow should live."
          secondaryActions={<ButtonLink href="/groups/new">Create Group</ButtonLink>}
        />
        {groups.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {groups.map((group) => (
              <Card key={group.id}>
                <SectionTitle title={group.name} subtitle={group.description || "Private group session planning."} />
                <div className="mt-4 flex items-center justify-between gap-3 text-sm text-zinc-600">
                  <span>{group.memberCount} members</span>
                  <ButtonLink href={`/groups/${group.id}/sessions/new`} tone="primary">
                    Host Here
                  </ButtonLink>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No groups yet"
            body="Join or create a group before hosting a session."
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
