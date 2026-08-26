export function formatDateTime(value?: string) {
  if (!value) {
    return "Not synced yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatRelativeHours(hours: number) {
  if (hours <= 0) {
    return "Expired";
  }

  return `${hours.toFixed(1)} hours remaining`;
}

export function getHoursRemaining(targetIso?: string) {
  if (!targetIso) {
    return 0;
  }

  const remainingMs = new Date(targetIso).getTime() - Date.now();
  return Math.max(0, remainingMs / (1000 * 60 * 60));
}

export function formatCountdown(targetIso?: string) {
  if (!targetIso) {
    return "Not available";
  }

  const remainingMs = new Date(targetIso).getTime() - Date.now();
  if (remainingMs <= 0) {
    return "Expired";
  }

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  return `${hh}:${mm}:${ss} remaining`;
}

export function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
