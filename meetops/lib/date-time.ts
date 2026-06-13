function displayFormatter(timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });
}

function timeFormatter(timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });
}

export function formatDateTime(value?: string, timeZone?: string) {
  if (!value) return "Not scheduled";
  return displayFormatter(timeZone).format(new Date(value));
}

export function formatDateRange(start?: string, end?: string, timeZone?: string) {
  if (!start) return "Not scheduled";
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : undefined;
  const startText = displayFormatter(timeZone).format(startDate);
  if (!endDate) return startText;
  return `${startText} - ${timeFormatter(timeZone).format(endDate)}`;
}

export function relativeDeadline(value?: string) {
  if (!value) return "No deadline";
  const deadline = new Date(value).getTime();
  const diffMs = deadline - Date.now();
  if (diffMs <= 0) return "Closed";
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  if (hours >= 24) return `Closes ${formatDateTime(value)}`;
  if (hours > 0) return `Closes in ${hours}h ${minutes}m`;
  return `Closes in ${minutes}m`;
}
