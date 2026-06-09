import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { ButtonLink } from "@/components/common/Buttons";
import { PageHeader } from "@/components/common/PageHeader";
import { GroupCard } from "@/components/groups/GroupCard";
import { groups } from "@/lib/mock-data";

export default function GroupsPage() {
  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader
          title="Groups"
          subtitle="Private communities you belong to."
          primaryAction={<ButtonLink href="/groups/new" tone="primary">Create group</ButtonLink>}
          secondaryActions={<ButtonLink href="/groups/join">Join with code</ButtonLink>}
        />
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      </div>
    </AuthenticatedPage>
  );
}
