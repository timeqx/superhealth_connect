export function validDateOnly(value: string) {
  return /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function displayDateInput(value: string) {
  return validDateOnly(value) ? `${value.slice(5, 7)}/${value.slice(8, 10)}/${value.slice(0, 4)}` : "";
}
export function parseDateInput(value: string) {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const iso = `${match[3]}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  return validDateOnly(iso) ? iso : null;
}
export function shiftDate(value: string, days: number) {
  if (!validDateOnly(value)) throw new Error("Invalid date");
  return new Date(Date.parse(`${value}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
