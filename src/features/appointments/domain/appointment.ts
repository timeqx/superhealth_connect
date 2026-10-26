export const appointmentStates = [
  "pending",
  "scheduled",
  "checked_in",
  "in_service",
  "completed",
  "rejected",
  "cancelled",
  "no_show",
] as const;
export type AppointmentState = (typeof appointmentStates)[number];
const transitions: Record<AppointmentState, readonly AppointmentState[]> = {
  pending: ["scheduled", "rejected", "cancelled"],
  scheduled: ["checked_in", "cancelled", "no_show"],
  checked_in: ["in_service", "cancelled", "no_show"],
  in_service: ["completed"],
  completed: [],
  rejected: [],
  cancelled: [],
  no_show: [],
};
export function canTransition(from: AppointmentState, to: AppointmentState) {
  return transitions[from].includes(to);
}
export function reservesCapacity(state: AppointmentState) {
  return [
    "pending",
    "scheduled",
    "checked_in",
    "in_service",
    "completed",
  ].includes(state);
}
export type Appointment = {
  id: string;
  public_reference: string;
  patient_id: string;
  slot_id: string;
  status: AppointmentState;
  updated_at: string;
  decision_reason: string | null;
  suggested_slot_id: string | null;
  service_slots: {
    starts_at: string;
    ends_at: string;
    service_id: string;
    services: { name: string } | null;
  };
};
export type Slot = {
  id: string;
  starts_at: string;
  ends_at: string;
  remaining: number;
};
export interface AppointmentRepository {
  request(
    slotId: string,
    idempotencyKey: string,
  ): Promise<{ id: string; public_reference: string }>;
}
