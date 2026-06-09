import { formatDateRange } from "@/lib/date-time";

export function TimeDisplay({
  start,
  end,
  timezone = "America/Phoenix",
}: {
  start?: string;
  end?: string;
  timezone?: string;
}) {
  return (
    <div className="text-sm">
      <div className="font-medium text-zinc-950">{formatDateRange(start, end)}</div>
      <div className="text-zinc-500">{timezone}</div>
    </div>
  );
}
