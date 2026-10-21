import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { serverClient } from "@/shared/supabase/server";
import { supabaseConfig } from "@/shared/supabase/config";
import type { Profile } from "@/features/accounts/domain/validation";
export const getActor = cache(async () => {
  const client = await serverClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return null;
  // Independent reads share the verified actor and remain protected by RLS.
  const [roleResult, profileResult] = await Promise.all([
    client.from("user_roles").select("role,disabled_at").eq("user_id", user.id).single(),
    client.from("profiles").select("*").eq("id", user.id).single(),
  ]);
  const { data: role, error: roleError } = roleResult;
  if (roleError) throw new Error("Account access could not be verified.");
  if (!role || role.disabled_at) return null;
  const { data: profile, error: profileError } = profileResult;
  if (profileError) throw new Error("Your profile could not be loaded.");
  return {
    client,
    user,
    role: role.role as "patient" | "admin",
    profile: profile as Profile,
  };
});
export async function requireActor(admin = false) {
  if (!supabaseConfig()) redirect("/setup");
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  if (admin && actor.role !== "admin") redirect("/access-denied");
  return actor;
}
