import { AuthenticatedPage } from "@/components/app-shell/AuthenticatedPage";
import { Button } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";
import { PageHeader } from "@/components/common/PageHeader";

export default function CreateGroupPage() {
  return (
    <AuthenticatedPage>
      <FormShell title="Create group" subtitle="Create a private group for your community.">
        <Field label="Group name" placeholder="TechUp Programmers" />
        <TextArea label="Description" placeholder="What is this community about?" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked /> Enable invite code</label>
        <Field label="Max uses" placeholder="50" type="number" />
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          The meeting owner is the Google account used to create Calendar events and Meet links. It defaults to you.
        </div>
        <Button tone="primary">Create group</Button>
      </FormShell>
    </AuthenticatedPage>
  );
}

export function FormShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />
      <Card className="mx-auto max-w-3xl">
        <form className="space-y-4">{children}</form>
      </Card>
    </div>
  );
}

export function Field({ label, placeholder, type = "text" }: { label: string; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      <input type={type} placeholder={placeholder} className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm" />
    </label>
  );
}

export function TextArea({ label, placeholder }: { label: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      <textarea placeholder={placeholder} rows={4} className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
    </label>
  );
}
