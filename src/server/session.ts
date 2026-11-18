import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { serverClient } from "@/shared/supabase/server";
import { supabaseConfig } from "@/shared/supabase/config";
import type { Profile } from "@/features/accounts/domain/validation";
import { isStaffRole, isUserRole } from "@/features/accounts/domain/roles";
export const getActor = cache(async () => {
  const client = await serverClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) return null;
  const [roleResult, profileResult] = await Promise.all([
    client.from("user_roles").select("role,disabled_at").eq("user_id", user.id).single(),
    client.from("profiles").select("*").eq("id", user.id).single(),
  ]);
  const { data: role, error: roleError } = roleResult;
  if (roleError) throw new Error("Account access could not be verified.");
  if (!role || role.disabled_at || !isUserRole(role.role)) return null;
  const { data: profile, error: profileError } = profileResult;
  if (profileError) throw new Error("Your profile could not be loaded.");
  return {
    client,
    user,
    role: role.role,
    profile: profile as Profile,
  };
});
export async function requireActor(admin = false) {
  if (!supabaseConfig()) redirect("/setup");
  const actor = await getActor();
  if (!actor) redirect(admin ? "/staff/sign-in" : "/sign-in");
  if (admin && actor.role !== "admin") redirect("/access-denied");
  return actor;
}

export async function requireStaffActor() {
  if (!supabaseConfig()) redirect("/setup");
  const actor = await getActor();
  if (!actor) redirect("/staff/sign-in");
  if (!isStaffRole(actor.role)) redirect("/access-denied");
  return actor;
}
