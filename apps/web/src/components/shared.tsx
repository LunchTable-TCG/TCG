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
  return new Date(timestamp).toLocaleTimeString();
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
    <output className={`status-banner status-banner-${notice.tone}`}>
      <p className="status-title">{notice.title}</p>
      <p className="status-body">{notice.body}</p>
    </output>
  );
}
