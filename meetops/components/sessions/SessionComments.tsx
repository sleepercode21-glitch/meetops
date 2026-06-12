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
    <Card className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-950">Comments</h2>
          <p className="mt-1 text-xs text-zinc-600">Live for this session.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      <div className="mt-3 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2">
        {comments.length ? (
          comments.map((comment) => (
            <div key={comment.comment_id} className="rounded-md bg-white p-2 shadow-sm">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span className="font-semibold text-zinc-800">{comment.author_name}</span>
                <span>{new Date(comment.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">{comment.body}</p>
            </div>
          ))
        ) : (
          <p className="rounded-md border border-dashed border-zinc-300 bg-white p-3 text-sm text-zinc-600">
            No comments yet.
          </p>
        )}
      </div>

      {!disabled ? (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
          <input
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={1000}
            placeholder="Add a comment"
            className="min-h-10 flex-1 rounded-md border border-zinc-300 px-3 text-sm"
            disabled={pending}
          />
          <Button type="submit" tone="primary" disabled={pending} className="w-full">
            {pending ? "Posting..." : "Post"}
          </Button>
        </form>
      ) : null}
      {message ? <p className="mt-2 text-sm text-zinc-600">{message}</p> : null}
    </Card>
  );
}
