export type StatusTone = "error" | "neutral" | "success" | "warning";

export interface StatusNotice {
  body: string;
  title: string;
  tone: StatusTone;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected error";
}

export function formatLocalTime(timestamp: number): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime())
    ? "Invalid time"
    : date.toLocaleTimeString();
}

export function getStatusBannerA11yProps() {
  return {
    "aria-atomic": "true" as const,
    "aria-live": "polite" as const,
  };
}

export function StatusBanner({
  notice,
}: {
  notice: StatusNotice | null;
}) {
  if (!notice) {
    return null;
  }

  return (
    <output
      className={`status-banner status-banner-${notice.tone}`}
      {...getStatusBannerA11yProps()}
    >
      {/* Keep this surface text-only; React escapes strings here by default. */}
      <p className="status-title">{notice.title}</p>
      <p className="status-body">{notice.body}</p>
    </output>
  );
}
