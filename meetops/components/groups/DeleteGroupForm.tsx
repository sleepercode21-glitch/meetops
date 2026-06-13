"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/common/ConfirmAction";
import type { ApiGroupDetail } from "@/lib/web-api";

type ApiErrorBody = {
  error?: {
    message?: string;
  };
};

export function DeleteGroupForm({ group }: { group: ApiGroupDetail }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function deleteGroup() {
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/v1/groups/${group.group_id}`, {
      method: "DELETE",
    });
    setPending(false);

    if (!response.ok) {
      setMessage(await errorMessage(response));
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
        Deleting this group permanently removes its sessions, polls, votes, comments, invite code, and members.
        Sessions are marked cancelled first, and scheduled calendar events are cancelled when Google access is still valid.
      </div>
      <FormError message={message} />
      <ConfirmButton
        tone="danger"
        disabled={pending}
        onConfirm={() => void deleteGroup()}
        confirm={{
          title: `Delete ${group.name}?`,
          message: "This cannot be undone. Everyone will lose access to this group and all of its sessions.",
          confirmLabel: "Delete group",
          cancelLabel: "Keep group",
        }}
      >
        {pending ? "Deleting..." : "Delete group"}
      </ConfirmButton>
    </div>
  );
}

async function errorMessage(response: Response) {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body.error?.message ?? "Something went wrong.";
  } catch {
    return "Something went wrong.";
  }
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-rose-600">{message}</p>;
}
