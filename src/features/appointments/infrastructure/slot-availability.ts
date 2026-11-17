import type { SupabaseClient } from "@supabase/supabase-js";
import type { Slot } from "../domain/appointment";

// Short appointment intervals can exceed the API's default row limit.
export async function loadAvailableSlots(client: SupabaseClient, service: string) {
  const slots: Slot[] = [];
  const pageSize = 500;
  let after: string | undefined;
  for (;;) {
    let query = client.rpc("slot_availability", { p_service: service })
      .order("starts_at").limit(pageSize);
    // Start times are unique per service. A cursor keeps earlier slots expiring
    // between requests from shifting subsequent pages and hiding availability.
    if (after) query = query.gt("starts_at", after);
    const { data, error } = await query;
    if (error) throw error;
    const page = data as Slot[];
    slots.push(...page);
    if (page.length < pageSize) return slots;
    after = page[page.length - 1].starts_at;
  }
}
