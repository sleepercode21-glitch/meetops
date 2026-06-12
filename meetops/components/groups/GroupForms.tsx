"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Buttons";
import type { ApiGroupDetail, ApiMember } from "@/lib/web-api";

type ApiErrorBody = {
  error?: {
    message?: string;
  };
};

export function CreateGroupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description"),
        invite_enabled: form.get("invite_enabled") === "on",
        invite_max_uses: Number(form.get("invite_max_uses") || 50),
      }),
    });

    setPending(false);

    if (!response.ok) {
      setError(await errorMessage(response));
      return;
    }

    const { data } = (await response.json()) as { data: { group_id: number } };
    router.push(`/groups/${data.group_id}`);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field name="name" label="Group name" placeholder="TechUp Programmers" required />
      <TextArea name="description" label="Description" placeholder="What is this community about?" />
      <label className="flex items-center gap-2 text-sm">
        <input name="invite_enabled" type="checkbox" defaultChecked />
        Enable invite code
      </label>
      <Field name="invite_max_uses" label="Max uses" placeholder="50" type="number" min={1} max={10000} />
      <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
        The group creator becomes the first admin. You can set a default meeting owner after creating the group.
      </div>
      <FormError message={error} />
      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "Creating..." : "Create group"}
      </Button>
    </form>
  );
}

export function JoinGroupForm({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/v1/groups/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        invite_code: form.get("invite_code"),
      }),
    });

    setPending(false);

    if (!response.ok) {
      setError(await errorMessage(response));
      return;
    }

    const { data } = (await response.json()) as { data: { group_id: number } };
    router.push(`/groups/${data.group_id}`);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field name="invite_code" label="Invite code" placeholder="TECHUP7H2K" defaultValue={initialCode} required />
      <FormError message={error} />
      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "Joining..." : "Join group"}
      </Button>
    </form>
  );
}

export function GroupProfileForm({ group }: { group: ApiGroupDetail }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/groups/${group.group_id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description"),
      }),
    });

    setPending(false);
    if (!response.ok) {
      setMessage(await errorMessage(response));
      return;
    }

    setMessage("Saved.");
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <Field name="name" label="Name" defaultValue={group.name} required />
      <TextArea name="description" label="Description" defaultValue={group.description ?? ""} />
      <FormError message={message} />
      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "Saving..." : "Save profile"}
      </Button>
    </form>
  );
}

export function InviteSettingsForm({ group }: { group: ApiGroupDetail }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const regenerate = submitter?.value === "regenerate";
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/groups/${group.group_id}/invite`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        invite_enabled: form.get("invite_enabled") === "on",
        invite_max_uses: Number(form.get("invite_max_uses") || group.invite_max_uses),
        regenerate_invite_code: regenerate,
      }),
    });

    setPending(false);
    if (!response.ok) {
      setMessage(await errorMessage(response));
      return;
    }

    setMessage(regenerate ? "Invite code regenerated." : "Invite settings saved.");
    router.refresh();
  }

  async function copyInvite() {
    const code = group.invite_code;
    if (!code) return;
    await navigator.clipboard.writeText(`${window.location.origin}/join/${code}`);
    setMessage("Invite link copied.");
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <label className="flex items-center gap-2 text-sm">
        <input name="invite_enabled" type="checkbox" defaultChecked={group.invite_enabled} />
        Invite code enabled
      </label>
      <Field name="invite_code" label="Invite code" defaultValue={group.invite_code ?? ""} disabled />
      <Field name="invite_max_uses" label="Max uses" defaultValue={String(group.invite_max_uses)} type="number" min={group.invite_used_count} max={10000} />
      <p className="text-sm text-zinc-600">
        {group.invite_used_count} / {group.invite_max_uses} used
      </p>
      <FormError message={message} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" tone="primary" disabled={pending}>
          {pending ? "Saving..." : "Save invite"}
        </Button>
        <Button type="button" onClick={copyInvite} disabled={!group.invite_code}>
          Copy invite link
        </Button>
        <Button type="submit" name="action" value="regenerate" disabled={pending}>
          Regenerate code
        </Button>
      </div>
    </form>
  );
}

export function MeetingOwnerForm({
  group,
  members,
}: {
  group: ApiGroupDetail;
  members: ApiMember[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const calendarReadyMembers = members.filter((member) => member.calendar_events_scope_granted);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const selected = form.get("default_meeting_owner");
    const response = await fetch(`/api/v1/groups/${group.group_id}/meeting-owner`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        default_meeting_owner: selected ? Number(selected) : null,
      }),
    });

    setPending(false);
    if (!response.ok) {
      setMessage(await errorMessage(response));
      return;
    }

    setMessage("Meeting owner saved.");
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
        The meeting owner is the Google account used to create the Google Calendar event and Google Meet link.
      </div>
      <label className="block">
        <span className="text-sm font-medium">Default meeting owner</span>
        <select
          name="default_meeting_owner"
          defaultValue={group.default_meeting_owner?.user_id ?? ""}
          className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
        >
          <option value="">Fallback to session host</option>
          {calendarReadyMembers.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {displayMember(member)}
            </option>
          ))}
        </select>
      </label>
      <FormError message={message} />
      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "Saving..." : "Save meeting owner"}
      </Button>
    </form>
  );
}

export function MemberActions({
  groupId,
  member,
}: {
  groupId: number | string;
  member: ApiMember;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function updateRole(isAdmin: boolean) {
    setPending(true);
    await fetch(`/api/v1/groups/${groupId}/members/${member.user_id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_admin: isAdmin }),
    });
    setPending(false);
    router.refresh();
  }

  async function removeMember() {
    setPending(true);
    await fetch(`/api/v1/groups/${groupId}/members/${member.user_id}`, {
      method: "DELETE",
    });
    setPending(false);
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <Button disabled={pending} onClick={() => updateRole(!member.is_admin)}>
        {member.is_admin ? "Demote" : "Promote"}
      </Button>
      <Button tone="danger" disabled={pending} onClick={removeMember}>
        Remove
      </Button>
    </div>
  );
}

export function Field({
  label,
  name,
  placeholder,
  type = "text",
  defaultValue,
  required,
  disabled,
  min,
  max,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
        className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm disabled:bg-zinc-100"
      />
    </label>
  );
}

export function TextArea({
  label,
  name,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      <textarea
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        rows={4}
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  const success = message.endsWith(".");
  return (
    <p className={success ? "text-sm text-emerald-700" : "text-sm text-rose-700"}>
      {message}
    </p>
  );
}

async function errorMessage(response: Response) {
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  return body.error?.message ?? "Something went wrong.";
}

function displayMember(member: ApiMember) {
  return (
    [member.firstname, member.lastname].filter(Boolean).join(" ") ||
    member.email
  );
}
