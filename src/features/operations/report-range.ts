export function reportRange(from: string, to: string) {
  const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
  if (!valid(from) || !valid(to)) return null;
  const start = new Date(`${from}T00:00:00+08:00`);
  const end = new Date(new Date(`${to}T00:00:00+08:00`).getTime() + 86400000);
  if (end <= start || end.getTime() - start.getTime() > 93 * 86400000) return null;
  return { start: start.toISOString(), end: end.toISOString() };
}
