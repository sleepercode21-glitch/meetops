import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { Button } from "@/components/common/Buttons";
import { Card, SectionTitle } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";
import { getGroup, getUser } from "@/lib/mock-data";

export default async function GroupSettingsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const group = getGroup(groupId);
  const owner = getUser(group?.meetingOwnerId);

  return (
    <AuthenticatedPage>
      <div className="space-y-6">
        <PageHeader title="Group Settings" subtitle={group?.name ?? "Admin settings"} primaryAction={<Button tone="primary">Save changes</Button>} />
        <SettingsCard title="Group profile">
          <Input label="Name" defaultValue={group?.name} />
          <Textarea label="Description" defaultValue={group?.description} />
          <Button tone="primary">Save profile</Button>
        </SettingsCard>
        <SettingsCard title="Invite settings">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked={group?.inviteEnabled} /> Invite code enabled</label>
          <Input label="Invite code" defaultValue={group?.inviteCode} />
          <Input label="Max uses" defaultValue={String(group?.inviteMaxUses ?? "")} />
          <p className="text-sm text-zinc-600">{group?.inviteUsedCount ?? 0} / {group?.inviteMaxUses ?? 0} used</p>
          <div className="flex flex-wrap gap-2"><Button>Copy invite link</Button><Button>Regenerate code</Button></div>
        </SettingsCard>
        <SettingsCard title="Meeting owner">
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            The meeting owner is the Google account used to create the Google Calendar event and Google Meet link. This can be different from the session host.
          </div>
          <Input label="Default meeting owner" defaultValue={owner?.email ?? "Fallback to host"} />
          <p className={owner?.hasCalendarScope ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>
            {owner?.hasCalendarScope ? "Calendar permission connected." : "Selected meeting owner needs to reconnect Google Calendar permission."}
          </p>
          <Button tone="primary">Save meeting owner</Button>
        </SettingsCard>
        <SettingsCard title="Calendar defaults">
          <select className="min-h-10 rounded-md border border-zinc-300 px-3 text-sm">
            <option>Do not invite members; show Meet link in app only</option>
            <option>Invite all group members</option>
            <option>Invite interested/attending members only</option>
          </select>
        </SettingsCard>
        <SettingsCard title="Danger zone">
          <Button tone="danger">Disable invite code</Button>
        </SettingsCard>
      </div>
    </AuthenticatedPage>
  );
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card className="space-y-4"><SectionTitle title={title} />{children}</Card>;
}

function Input({ label, defaultValue }: { label: string; defaultValue?: string }) {
  return <label className="block"><span className="text-sm font-medium">{label}</span><input defaultValue={defaultValue} className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm" /></label>;
}

function Textarea({ label, defaultValue }: { label: string; defaultValue?: string }) {
  return <label className="block"><span className="text-sm font-medium">{label}</span><textarea defaultValue={defaultValue} rows={4} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" /></label>;
}
