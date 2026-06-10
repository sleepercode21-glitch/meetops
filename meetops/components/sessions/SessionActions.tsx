"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink } from "@/components/common/Buttons";
import type { Session } from "@/types/domain";

export function SessionActions({
  session,
  canManage,
}: {
  session: Session;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!canManage) {
    return <p className="text-sm text-zinc-600">Host actions are hidden for members.</p>;
  }

  async function post(path: string, action: string) {
    setPending(action);
    setMessage(null);
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    setPending(null);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setMessage(body?.error?.message ?? `Could not ${action}.`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {session.status === "draft" || session.status === "polling" ? (
        <ButtonLink href={`/sessions/${session.id}/polls/new`} tone="primary" className="w-full">
          Create Poll
        </ButtonLink>
      ) : null}
      {session.status === "needs_host_decision" ? (
        <ManualScheduleButton sessionId={session.id} />
      ) : null}
      {session.status === "scheduling_failed" ? (
        <Button
          tone="primary"
          className="w-full"
          disabled={pending === "retry"}
          onClick={() => post(`/api/v1/sessions/${session.id}/retry-scheduling`, "retry scheduling")}
        >
          {pending === "retry" ? "Retrying..." : "Retry Scheduling"}
        </Button>
      ) : null}
      {session.status === "scheduled" ? (
        <>
          <Button
            className="w-full"
            disabled={pending === "complete"}
            onClick={() => post(`/api/v1/sessions/${session.id}/complete`, "complete session")}
          >
            Mark Completed
          </Button>
          <Button
            className="w-full"
            disabled={pending === "reschedule"}
            onClick={() => post(`/api/v1/sessions/${session.id}/reschedule`, "reschedule")}
          >
            Reschedule
          </Button>
        </>
      ) : null}
      {!["cancelled", "completed", "scheduling"].includes(session.status) ? (
        <Button
          tone="danger"
          className="w-full"
          disabled={pending === "cancel"}
          onClick={() => post(`/api/v1/sessions/${session.id}/cancel`, "cancel session")}
        >
          Cancel Session
        </Button>
      ) : null}
      {message ? <p className="text-sm text-rose-700">{message}</p> : null}
    </div>
  );
}

function ManualScheduleButton({ sessionId }: { sessionId: string }) {
  return (
    <ButtonLink href={`/sessions/${sessionId}/reschedule`} tone="primary" className="w-full">
      Choose Time
    </ButtonLink>
  );
}
