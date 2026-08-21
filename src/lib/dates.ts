/** Today as YYYY-MM-DD in local time -- an evening purchase belongs to today. */
export function today(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** "12 August 2026" from a YYYY-MM-DD string, without timezone drift. */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** The local calendar date (YYYY-MM-DD) an ISO timestamp falls on. */
export function localDateOf(isoTimestamp: string): string {
  const at = new Date(isoTimestamp);
  const offset = at.getTimezoneOffset() * 60_000;
  return new Date(at.getTime() - offset).toISOString().slice(0, 10);
}
