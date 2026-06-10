import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { Card } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { CreateGroupForm } from "@/components/groups/GroupForms";

export default function CreateGroupPage() {
  return (
    <AuthenticatedPage>
      <FormShell title="Create Group" subtitle="Start a private group for sessions and polls.">
        <CreateGroupForm />
      </FormShell>
    </AuthenticatedPage>
  );
}

export function FormShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />
      <Card className="mx-auto max-w-3xl">{children}</Card>
    </div>
  );
}
