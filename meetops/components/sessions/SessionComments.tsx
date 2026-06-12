"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/common/Buttons";
import { Card } from "@/components/common/Card";

type ApiComment = {
  comment_id: number;
  session_id: number;
  user_id: number;
  author_name: string;
  body: string;
  created_at: string;
};

type ApiEnvelope<T> = { data: T };

export function SessionComments({
  sessionId,
  disabled = false,
}: {
  sessionId: string;
  disabled?: boolean;
}) {
  const [comments, setComments] = useState<ApiComment[]>([]);
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const latestId = useRef(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch(`/api/v1/sessions/${sessionId}/comments`, { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as ApiEnvelope<ApiComment[]>;
      if (cancelled) return;
      setComments(payload.data);
      latestId.current = payload.data.at(-1)?.comment_id ?? latestId.current;
    }

    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [sessionId]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    list.scrollTop = list.scrollHeight;
  }, [comments.length]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (!text) {
      setMessage("Write a comment first.");
      return;
    }

    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/v1/sessions/${sessionId}/comments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    setPending(false);

    if (!response.ok) {
      setMessage("Could not post comment.");
      return;
    }

    const payload = (await response.json()) as ApiEnvelope<ApiComment>;
    setComments((current) => {
      if (current.some((comment) => comment.comment_id === payload.data.comment_id)) return current;
      return [...current, payload.data];
    });
    latestId.current = payload.data.comment_id;
    setBody("");
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-950">Session chat</h2>
          <p className="mt-0.5 text-xs text-zinc-500">Live comments from the group.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      <div ref={listRef} className="mx-3 mt-3 h-72 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3">
        {comments.length ? (
          comments.map((comment) => (
            <MessageRow key={comment.comment_id} comment={comment} />
          ))
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white px-4 text-center text-sm text-zinc-500">
            No messages yet.
          </div>
        )}
      </div>

      {!disabled ? (
        <form onSubmit={submit} className="flex gap-2 p-3">
          <input
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={1000}
            placeholder="Message the session"
            className="min-h-10 min-w-0 flex-1 rounded-full border border-zinc-300 bg-white px-4 text-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
            disabled={pending}
          />
          <Button type="submit" tone="primary" disabled={pending} className="shrink-0 rounded-full px-4">
            {pending ? "..." : "Send"}
          </Button>
        </form>
      ) : null}
      {message ? <p className="px-3 pb-3 text-sm text-zinc-600">{message}</p> : null}
    </Card>
  );
}

function MessageRow({ comment }: { comment: ApiComment }) {
  return (
    <div className="flex gap-2 py-1.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-semibold text-white">
        {initials(comment.author_name)}
      </div>
      <div className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-xs font-semibold text-zinc-950">{comment.author_name}</span>
          <span className="shrink-0 text-[11px] text-zinc-400">{formatChatTime(comment.created_at)}</span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-zinc-700">{comment.body}</p>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}

function formatChatTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
