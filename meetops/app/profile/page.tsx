import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { Card, SectionTitle } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { getCurrentUser } from "@/lib/web-api";

export default async function ProfilePage() {
  const currentUser = await getCurrentUser();

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader title="Profile" subtitle="Your account and timezone details." />
        <Card>
          <SectionTitle title={currentUser.name} subtitle={currentUser.email} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Info label="Timezone" value={currentUser.timezone} />
            <Info label="Calendar permission" value={currentUser.hasCalendarScope ? "Connected" : "Needs reconnect"} />
          </div>
        </Card>
      </div>
    </AuthenticatedPage>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md border border-zinc-200 p-3"><div className="text-xs uppercase text-zinc-500">{label}</div><div className="mt-1 text-sm font-medium">{value}</div></div>;
}
