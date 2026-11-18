"use client";

import { useRef, useState } from "react";
import { useRouter, unstable_rethrow } from "next/navigation";
import { createStaffAccount, changeStaffRole, manageStaffAccount } from "../application/staff-management-actions";
import { DetailDialog } from "@/shared/ui/detail-dialog";
import type { StaffAccount } from "../domain/staff-management";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useSnackbar } from "@/shared/ui/snackbar";

export function StaffAccountTools({ account, currentUserId }: { account: StaffAccount; currentUserId: string }) {
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const router = useRouter();
  const notify = useSnackbar();
  async function submit(kind: "details" | "password" | "delete", form: HTMLFormElement) {
    if (busy.current) return;
    busy.current = true; setPending(true);
    try {
      const result = await manageStaffAccount(kind, { ...Object.fromEntries(new FormData(form)), id: account.id, expected: account.provisioned_at });
      notify(result.message, !result.ok);
      if (result.ok) form.reset();
      router.refresh();
    } catch (error) { unstable_rethrow(error); notify("The change could not be confirmed. Refresh before retrying.", true); }
    finally { busy.current = false; setPending(false); }
  }
  return <div className="actions">
    {!account.disabled_at && <>
      <DetailDialog title="Edit account details" description={account.email || "Staff account"} label="Edit details">
        <form onSubmit={e => { e.preventDefault(); void submit("details", e.currentTarget); }}><fieldset disabled={pending} className="form-grid">
          <label>First name<Input name="first" defaultValue={account.first_name} required maxLength={80} /></label>
          <label>Last name<Input name="last" defaultValue={account.last_name} required maxLength={80} /></label>
          <label>Email address<Input name="email" type="email" defaultValue={account.email || ""} required maxLength={254} /></label>
          <label>Employee ID<Input name="employeeId" defaultValue={account.employee_id || ""} maxLength={80} /></label>
          <Button type="submit">{pending ? "Saving…" : "Save details"}</Button>
        </fieldset></form>
      </DetailDialog>
      <DetailDialog title="Set new password" description={`Set a password for ${account.email || "this account"}. No email link is required.`} label="New password">
        <form onSubmit={e => { e.preventDefault(); void submit("password", e.currentTarget); }}><fieldset disabled={pending} className="form-grid">
          <label>New password<Input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} /></label>
          <Button type="submit">{pending ? "Saving…" : "Set password"}</Button>
        </fieldset></form>
      </DetailDialog>
    </>}
    {account.id !== currentUserId && <DetailDialog title="Delete account" description={`Delete ${account.email || "this account"}? Sign-in access will be removed. Historical activity will be retained. This cannot be undone here.`} label="Delete account">
      <form onSubmit={e => { e.preventDefault(); void submit("delete", e.currentTarget); }}>
        <label className="checkbox-field"><input type="checkbox" required disabled={pending} /> I confirm that this account should be deleted.</label>
        <Button type="submit" variant="destructive" disabled={pending}>{pending ? "Deleting…" : "Confirm deletion"}</Button>
      </form>
    </DetailDialog>}
  </div>;
}

export function CreateStaffAccountForm() {
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const router = useRouter();
  const notify = useSnackbar();

  return <form className="operations-form" onSubmit={async event => {
    event.preventDefault();
    if (busy.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    busy.current = true;
    setPending(true);
    try {
      const result = await createStaffAccount({
        first: data.get("first"), last: data.get("last"), email: data.get("email"),
        password: data.get("password"), role: data.get("role"), employeeId: data.get("employeeId"),
      });
      notify(result.message, !result.ok);
      if (result.ok) {
        form.reset();
        router.replace("/admin/staff");
        router.refresh();
      }
    } catch {
      notify("The connection was interrupted. Refresh the account list before trying again.", true);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }}>
    <fieldset disabled={pending} className="form-grid">
      <label>First name<Input name="first" autoComplete="off" required maxLength={80} /></label>
      <label>Last name<Input name="last" autoComplete="off" required maxLength={80} /></label>
      <label className="col-span-full">Email address<Input type="email" name="email" autoComplete="off" required maxLength={254} /></label>
      <div className="col-span-full grid gap-1"><label className="grid gap-1">Password<Input type="password" name="password" autoComplete="new-password" required minLength={12} maxLength={128} aria-describedby="staff-password-help" /></label>
        <small id="staff-password-help">Use at least 12 characters. Share the email and password directly with the account holder.</small>
      </div>
      <label>Role<select name="role" defaultValue="staff" required><option value="staff">Staff</option><option value="admin">Admin</option></select></label>
      <label>Employee ID (optional)<Input name="employeeId" autoComplete="off" maxLength={80} /></label>
      <Button type="submit">{pending ? "Creating account…" : "Create account"}</Button>
    </fieldset>
  </form>;
}

export function StaffAccountRoleForm({ account, currentUserId }: { account: StaffAccount; currentUserId: string }) {
  const [role, setRole] = useState(account.role);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const router = useRouter();
  const notify = useSnackbar();
  const selfDemotion = account.id === currentUserId && account.role === "admin" && role === "staff";

  return <form aria-label={`Role for ${account.email || `${account.first_name} ${account.last_name}`.trim() || "staff account"}`} onSubmit={async event => {
    event.preventDefault();
    if (busy.current || role === account.role || account.disabled_at) return;
    busy.current = true;
    setPending(true);
    try {
      const result = await changeStaffRole({ id: account.id, role, expected: account.provisioned_at });
      notify(result.message, !result.ok);
      if (result.ok) {
        if (result.redirectTo) router.replace(result.redirectTo);
        router.refresh();
      }
    } catch (error) {
      unstable_rethrow(error);
      notify("The role change could not be confirmed. Refresh the account list before trying again.", true);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }}>
    <fieldset disabled={pending || Boolean(account.disabled_at)} className="form-grid">
      <label>Account role<select value={role} onChange={event => setRole(event.target.value as StaffAccount["role"])}>
        <option value="staff">Staff</option><option value="admin">Admin</option>
      </select></label>
      <Button type="submit" variant="outline" disabled={role === account.role}>{pending ? "Saving role…" : "Save role"}</Button>
    </fieldset>
    {selfDemotion && <p className="caption">Changing your role to Staff removes your access to this tab. Another active admin must remain.</p>}
  </form>;
}
