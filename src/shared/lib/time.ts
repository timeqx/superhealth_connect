export const timeZone = "Asia/Manila";
export function manilaDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}
export function formatTime(value: string | Date) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
export function manilaInputToUtc(value: string) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))
    throw new Error("VALIDATION_ERROR");
  const date = new Date(`${value}:00+08:00`);
  if (Number.isNaN(date.getTime())) throw new Error("VALIDATION_ERROR");
  if (new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16) !== value)
    throw new Error("VALIDATION_ERROR");
  return date.toISOString();
}
