import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";
function privilegedClient(configurationError: string) {
  const config = supabaseConfig();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!config || !secret) throw new Error(configurationError);
  return createClient(config.url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function uploadClient() {
  return privilegedClient("UPLOAD_NOT_CONFIGURED");
}

export function authAdminClient() {
  return privilegedClient("STAFF_MANAGEMENT_NOT_CONFIGURED");
}
