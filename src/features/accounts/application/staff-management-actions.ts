"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActor } from "@/server/session";
import { authAdminClient } from "@/shared/supabase/privileged";
import { safeError, type ActionResult } from "@/shared/lib/errors";
import { changeStaffRoleSchema, createStaffAccountSchema } from "../domain/staff-management";

function failure(error: unknown): ActionResult {
  if (error instanceof z.ZodError) return { ok: false, message: error.issues[0].message };
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (code === "email_exists" || code === "user_already_exists") {
    return { ok: false, message: "An account already uses this email address. Refresh the Staff list to check existing accounts, or use a different address." };
  }
  if (code === "weak_password") return { ok: false, message: "Choose a stronger password with at least 12 characters." };
  if (code === "email_address_invalid") return { ok: false, message: "Enter a valid email address." };
  if (message.includes("LAST_ADMIN")) return { ok: false, message: "At least one active admin is required. Assign another admin before changing this role." };
  if (message.includes("STAFF_MANAGEMENT_NOT_CONFIGURED") || code === "PGRST202" || code === "42883") {
    return { ok: false, message: "Staff management is temporarily unavailable. Contact the project operator." };
  }
  return { ok: false, message: safeError(error) };
}

function refreshStaffViews() {
  revalidatePath("/admin/staff");
  revalidatePath("/admin/audit");
  revalidatePath("/admin/reports");
}

export async function createStaffAccount(input: unknown): Promise<ActionResult> {
  try {
    const actor = await getActor();
    if (!actor || actor.role !== "admin") throw new Error("FORBIDDEN");
    const value = createStaffAccountSchema.parse(input);

    // Refuse creation until the atomic staff-provisioning trigger is installed.
    // Otherwise Auth would create a patient account with the default signup trigger.
    const ready = await actor.client.rpc("staff_management_ready");
    if (ready.error) throw ready.error;
    if (ready.data !== true) throw new Error("STAFF_MANAGEMENT_NOT_CONFIGURED");

    const { data, error } = await authAdminClient().auth.admin.createUser({
      email: value.email,
      password: value.password,
      email_confirm: true,
      // Auth Admin owns app_metadata; public signup metadata cannot grant roles.
      // The database trigger rechecks this admin and commits profile, role, and
      // audit together with the Auth user, or rolls the creation back.
      app_metadata: {
        staff_provisioning: {
          actor_id: actor.user.id,
          role: value.role,
          first_name: value.first,
          last_name: value.last,
          employee_id: value.employeeId || null,
        },
      },
    });
    if (error) throw error;
    if (!data.user) throw new Error("Account creation failed.");
    refreshStaffViews();
    return { ok: true, message: `${value.role === "admin" ? "Admin" : "Staff"} account created. They can sign in at /staff/sign-in with the email and password you entered. No email confirmation is needed.` };
  } catch (error) {
    return failure(error);
  }
}

export async function changeStaffRole(input: unknown): Promise<ActionResult> {
  let result: ActionResult;
  try {
    const actor = await getActor();
    if (!actor || actor.role !== "admin") throw new Error("FORBIDDEN");
    const value = changeStaffRoleSchema.parse(input);
    const { error } = await actor.client.rpc("update_staff_role", {
      p_user: value.id,
      p_role: value.role,
      p_expected: value.expected,
    });
    if (error) throw error;
    refreshStaffViews();
    revalidatePath("/", "layout");
    result = {
      ok: true,
      message: `Role changed to ${value.role === "admin" ? "Admin" : "Staff"}.`,
      ...(value.id === actor.user.id && value.role === "staff" ? { redirectTo: "/admin" } : {}),
    };
  } catch (error) {
    return failure(error);
  }
  // Leave the admin-only page before its next render checks the reduced role.
  // Keep the redirect outside the catch so Next.js can handle navigation.
  if (result.redirectTo) redirect(result.redirectTo);
  return result;
}
