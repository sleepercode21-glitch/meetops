"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Buttons";
import { calendarInvitePolicyLabels } from "@/lib/labels";
import type { ApiMember } from "@/lib/web-api";
import type { Session } from "@/types/domain";

type ApiErrorBody = { error?: { message?: string } };

export function SessionEditForm({
  session,
  members,
}: {
  session: Session;
  members: ApiMember[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const calendarReadyMembers = members.filter((member) => member.calendar_events_scope_granted);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic: form.get("topic"),
        description: form.get("description"),
        calendar_invite_policy: form.get("calendar_invite_policy"),
        meeting_owner: numericOrNull(form.get("meeting_owner")),
      }),
    });
    setPending(false);
    if (!response.ok) {
      setError(await errorMessage(response));
      return;
    }
    router.push(`/sessions/${session.id}`);
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <label className="block">
        <span className="text-sm font-medium">Topic</span>
        <input
          name="topic"
          defaultValue={session.topic ?? ""}
          className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Description</span>
        <textarea
          name="description"
          defaultValue={session.description ?? ""}
          rows={4}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Calendar invitation policy</span>
        <select
          name="calendar_invite_policy"
          defaultValue={session.calendarInvitePolicy}
          className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
        >
          {Object.entries(calendarInvitePolicyLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Google Meet account</span>
        <select
          name="meeting_owner"
          defaultValue={session.meetingOwnerId ?? ""}
          className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
        >
          <option value="">Use group default, then host</option>
          {calendarReadyMembers.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {displayMember(member)}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-zinc-500">
          This Google account creates or updates the Calendar invite and Meet link.
        </span>
      </label>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button tone="primary" type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save Changes"}
        </Button>
        <Button type="button" onClick={() => router.push(`/sessions/${session.id}`)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

async function errorMessage(response: Response) {
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  return body.error?.message ?? "Could not update session.";
}

function numericOrNull(value: FormDataEntryValue | null) {
  if (!value) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function displayMember(member: ApiMember) {
  return [member.firstname, member.lastname].filter(Boolean).join(" ") || member.email;
}
