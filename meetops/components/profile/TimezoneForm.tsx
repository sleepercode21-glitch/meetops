"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/Buttons";

const fallbackTimezones = [
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "UTC",
];

export function TimezoneForm({ currentTimezone }: { currentTimezone: string }) {
  const router = useRouter();
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const timezones = useMemo(() => {
    const supported = typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : fallbackTimezones;
    return Array.from(new Set([currentTimezone, browserTimezone, ...fallbackTimezones, ...supported])).filter(Boolean).sort();
  }, [browserTimezone, currentTimezone]);
  const [timezone, setTimezone] = useState(currentTimezone);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save(nextTimezone = timezone) {
    setPending(true);
    setMessage(null);
    const response = await fetch("/api/v1/me", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timezone: nextTimezone }),
    });
    setPending(false);

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setMessage(body?.error?.message ?? "Could not update timezone.");
      return;
    }

    setTimezone(nextTimezone);
    setMessage("Timezone saved.");
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">Timezone</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Poll windows and availability inputs use this timezone across the app.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500">
            Your timezone
          </span>
          <select
            value={timezone}
            disabled={pending}
            onChange={(event) => setTimezone(event.target.value)}
            className="min-h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-950"
          >
            {timezones.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          disabled={pending || timezone === browserTimezone}
          onClick={() => void save(browserTimezone)}
        >
          Use this device
        </Button>
        <Button
          type="button"
          tone="primary"
          disabled={pending || timezone === currentTimezone}
          onClick={() => void save()}
        >
          {pending ? "Saving..." : "Save timezone"}
        </Button>
      </div>

      {message ? <p className="mt-3 text-sm text-zinc-700">{message}</p> : null}
    </div>
  );
}
