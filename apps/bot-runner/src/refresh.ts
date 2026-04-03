export function shouldRefreshSeatViewAfterSubmit(input: {
  accepted: boolean;
  reason?: string | null;
}) {
  return input.accepted || input.reason === "staleStateVersion";
}
