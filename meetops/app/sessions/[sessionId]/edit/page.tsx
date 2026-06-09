import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { Button } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { calendarInvitePolicyLabels } from "@/lib/labels";
import { getGroup, getSession, getUser } from "@/lib/mock-data";

export default async function EditSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = getSession(sessionId);
  const group = getGroup(session?.groupId ?? "");
  const host = getUser(session?.hostId);

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader title="Edit session" subtitle={session?.topic ?? "Untitled session"} />
        <Card className="mx-auto max-w-3xl">
          <form className="space-y-4">
            <Input label="Topic" defaultValue={session?.topic ?? ""} />
            <Textarea label="Description" defaultValue={session?.description ?? ""} />
            <label className="block">
              <span className="text-sm font-medium">Calendar invitation policy</span>
              <select defaultValue={session?.calendarInvitePolicy} className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm">
                {Object.entries(calendarInvitePolicyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
              Group: {group?.name ?? "Unknown"} · Host: {host?.name ?? "Unknown"} · Status: {session?.status ?? "Unknown"}
            </div>
            <div className="flex gap-2"><Button tone="primary">Save changes</Button><Button>Cancel</Button></div>
          </form>
        </Card>
      </div>
    </AuthenticatedPage>
  );
}

function Input({ label, defaultValue }: { label: string; defaultValue: string }) {
  return <label className="block"><span className="text-sm font-medium">{label}</span><input defaultValue={defaultValue} className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm" /></label>;
}

function Textarea({ label, defaultValue }: { label: string; defaultValue: string }) {
  return <label className="block"><span className="text-sm font-medium">{label}</span><textarea defaultValue={defaultValue} rows={4} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" /></label>;
}
