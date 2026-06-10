"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Buttons";

type ApiErrorBody = {
  error?: {
    message?: string;
  };
};

export function HostSessionForm({ groupId }: { groupId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        calendar_invite_policy: form.get("calendar_invite_policy"),
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
      <div>
        <div className="mb-2 text-sm font-medium text-zinc-800">
          Calendar invite policy
        </div>
        <div className="grid gap-3">
          <Radio
            value="all_members"
            title="Invite all group members"
            description="Everyone in the group gets the Calendar invite."
          />
          <Radio
            value="interested_members"
            title="Invite interested members only"
            description="Only members who show interest or vote attending are invited."
            defaultChecked
          />
          <Radio
            value="app_only"
            title="App link only"
            description="No Calendar invites. Members open the Meet link in the app."
          />
        </div>
      </div>
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

function Radio({
  title,
  value,
  description,
  defaultChecked = false,
}: {
  title: string;
  value: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex gap-3 rounded-md border border-zinc-200 p-3">
      <input
        type="radio"
        name="calendar_invite_policy"
        value={value}
        defaultChecked={defaultChecked}
      />
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="text-sm text-zinc-600">{description}</span>
      </span>
    </label>
  );
}

async function errorMessage(response: Response) {
  const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
  return body.error?.message ?? "Could not create session.";
}
