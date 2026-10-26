import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppointmentRepository } from "../domain/appointment";
export function appointmentRepository(
  client: SupabaseClient,
): AppointmentRepository {
  return {
    async request(slotId, key) {
      const { data, error } = await client.rpc("request_appointment", {
        p_slot: slotId,
        p_key: key,
      });
      if (error) throw error;
      return data as { id: string; public_reference: string };
    },
  };
}
