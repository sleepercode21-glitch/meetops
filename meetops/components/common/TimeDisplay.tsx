"use client";

import { useSyncExternalStore } from "react";
import { formatDateRange } from "@/lib/date-time";

export function TimeDisplay({
  start,
  end,
  timezone,
  label = "Your time",
}: {
  start?: string;
  end?: string;
  timezone?: string;
  label?: string;
}) {
  const viewerTimezone = useViewerTimezone();
  const displayTimezone = timezone ?? viewerTimezone;

  return (
    <div className="text-sm">
      <div className="font-medium text-zinc-950">{formatDateRange(start, end, displayTimezone)}</div>
      <div className="text-zinc-500">
        {label} · {displayTimezone}
      </div>
    </div>
  );
}

function useViewerTimezone() {
  return useSyncExternalStore(
    () => () => undefined,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "UTC",
  );
}
