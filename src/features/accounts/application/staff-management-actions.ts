"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getActor } from "@/server/session";
import { authAdminClient } from "@/shared/supabase/privileged";
import { safeError, type ActionResult } from "@/shared/lib/errors";
import { changeStaffRoleSchema, createStaffAccountSchema } from "../domain/staff-management";

function failure(error: unknown): ActionResult {
  if (error instanceof z.ZodError) return { ok: false, message: error.issues[0].message };
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  const message = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (message.includes("SELF_DELETE")) return { ok: false, message: "Another admin must delete your account. You cannot delete the account you are signed in with." };
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

export async function manageStaffAccount(kind: "details" | "password" | "delete", input: unknown): Promise<ActionResult> {
  try {
    const actor = await getActor();
    if (!actor || actor.role !== "admin") throw new Error("FORBIDDEN");
    const base = z.object({ id: z.uuid(), expected: z.iso.datetime({ offset: true }) }).parse(input);
    const admin = authAdminClient();
    // Check the new migration exists before attempting an Auth change.
    const target = await actor.client.rpc("list_staff_accounts", { p_offset: 0, p_limit: 1 });
    if (target.error) throw target.error;
    if (kind === "delete") {
      const prepared = await actor.client.rpc("prepare_staff_deletion", { p_user: base.id, p_expected: base.expected });
      if (prepared.error) throw prepared.error;
      const { error } = await admin.auth.admin.deleteUser(base.id, true);
      refreshStaffViews();
      if (error) return { ok: false, message: "Access has been disabled, but deletion could not finish. Refresh and retry Delete account." };
      return { ok: true, message: "Account deleted. Historical activity is retained." };
    }
    const details = kind === "details" ? createStaffAccountSchema.omit({ password: true, role: true }).parse(input) : null;
    const password = kind === "password" ? createStaffAccountSchema.shape.password.parse((input as { password?: unknown }).password) : undefined;
    if (!details && !password) throw new Error("VALIDATION_ERROR");
    const ready = await actor.client.rpc("staff_editing_ready");
    if (ready.error || ready.data !== true) throw ready.error || new Error("STAFF_MANAGEMENT_NOT_CONFIGURED");
    const { error } = await admin.auth.admin.updateUserById(base.id, {
      ...(details ? { email: details.email, email_confirm: true } : { password }),
      app_metadata: { staff_edit: { actor_id: actor.user.id, expected: base.expected, key: randomUUID(), kind, ...(details ? { first: details.first, last: details.last, employeeId: details.employeeId } : {}) } },
    });
    if (error) throw error;
    refreshStaffViews();
    return { ok: true, message: details ? "Account details updated." : "New password saved. Share it directly with the account holder." };
  } catch (error) { return failure(error); }
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
