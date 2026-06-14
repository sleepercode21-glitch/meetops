"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Buttons";
import type { ApiMember } from "@/lib/web-api";

type ApiErrorBody = {
  error?: {
    message?: string;
  };
};

export function HostSessionForm({
  groupId,
  members,
}: {
  groupId: string;
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
    const response = await fetch(`/api/v1/groups/${groupId}/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        topic: form.get("topic"),
        description: form.get("description"),
        meeting_owner: numericOrNull(form.get("meeting_owner")),
      }),
    });

    setPending(false);

    if (!response.ok) {
      setError(await errorMessage(response));
      return;
    }

    const body = (await response.json()) as { data: { session_id: number } };
    router.push(`/sessions/${body.data.session_id}`);
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={submit}>
      <Field
        name="topic"
        label="Session topic"
        placeholder="Backend System Design: Logging and Metrics"
        required
      />
      <TextArea
        name="description"
        label="Description"
        placeholder="We will discuss metrics, logs, alerts, and dashboards."
      />
      <label className="block">
        <span className="text-sm font-medium text-zinc-800">Google Meet account</span>
        <select
          name="meeting_owner"
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
          This Google account creates the Calendar event and Meet link after the final timing vote.
        </span>
      </label>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <Button tone="primary" type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create Session"}
      </Button>
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        className="mt-1 min-h-10 w-full rounded-md border border-zinc-300 px-3 text-sm"
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-800">{label}</span>
      <textarea
        name={name}
        placeholder={placeholder}
        rows={4}
        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

async function errorMessage(response: Response) {
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  return body.error?.message ?? "Could not create session.";
}

function numericOrNull(value: FormDataEntryValue | null) {
  if (!value) return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function displayMember(member: ApiMember) {
  return [member.firstname, member.lastname].filter(Boolean).join(" ") || member.email;
}
