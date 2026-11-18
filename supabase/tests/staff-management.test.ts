import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const db = new PGlite();
const admin = randomUUID();
const patient = randomUUID();
const staff = randomUUID();
type Role = { user_id: string; role: string; provisioned_at: string; provisioned_by: string; employee_id: string | null };

async function asUser(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}

async function roleOf(id: string) {
  await db.exec("reset role");
  return (await db.query<{ value: Role }>("select to_jsonb(r) as value from public.user_roles r where user_id=$1", [id])).rows[0].value;
}

function provision(role: string, actor = admin) {
  return { staff_provisioning: { actor_id: actor, role, first_name: " New ", last_name: " Colleague ", employee_id: " EMP-42 " } };
}

// Mirror Auth Admin's transaction: INSERT user, UPDATE app metadata, confirm.
// Supporting the INSERT metadata variant also covers future Auth implementations.
async function createAuthAccount(id: string, metadata: object, atInsert = false) {
  await db.exec("reset role;begin");
  try {
    await db.query("insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)", [id, `${id}@example.test`, atInsert ? metadata : { provider: "email" }]);
    if (!atInsert) await db.query("update auth.users set raw_app_meta_data=$2 where id=$1", [id, metadata]);
    await db.query("update auth.users set email_confirmed_at=now() where id=$1", [id]);
    await db.exec("commit");
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}

beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,email text unique,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
    create publication supabase_realtime;`);
  for (const name of [
    "202610200001_foundation.sql", "202610200002_workflows.sql", "202610200003_accounts_operations.sql",
    "20261021064654_staff_management.sql", "202610300002_recurring_schedules.sql",
    "202611160001_appointment_time_slots.sql", "202611180001_staff_roles.sql", "202611180002_staff_account_management.sql", "202611180005_staff_account_editing.sql",
  ]) await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  for (const id of [admin, patient, staff]) await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())", [id, `${id}@example.test`]);
  await db.query("update public.user_roles set role='admin' where user_id=$1", [admin]);
  await db.query("update public.user_roles set role='staff' where user_id=$1", [staff]);
});
afterAll(() => db.close());

describe("admin staff account management", () => {
  it.each(["staff", "admin"])("atomically provisions %s through the actual Auth metadata-update sequence", async role => {
    const id = randomUUID();
    await createAuthAccount(id, provision(role));
    expect(await roleOf(id)).toMatchObject({ role, provisioned_by: admin, employee_id: "EMP-42" });
    expect((await db.query("select first_name,last_name,review_status from public.profiles where id=$1", [id])).rows[0])
      .toEqual({ first_name: "New", last_name: "Colleague", review_status: "incomplete" });
    expect((await db.query("select email_confirmed_at is not null as confirmed from auth.users where id=$1", [id])).rows[0]).toEqual({ confirmed: true });
    expect((await db.query("select actor_id,action,metadata from public.audit_logs where entity_id=$1", [id])).rows)
      .toEqual([{ actor_id: admin, action: "create_staff_account", metadata: { role } }]);
    await asUser(id);
    expect((await db.query("select private.is_staff() as staff,private.is_admin() as admin")).rows[0])
      .toEqual({ staff: true, admin: role === "admin" });
  });

  it("also handles metadata supplied at insert and never reapplies the original role", async () => {
    const id = randomUUID();
    await createAuthAccount(id, provision("admin"), true);
    const target = await roleOf(id);
    await asUser(admin);
    await db.query("select public.update_staff_role($1,'staff',$2)", [id, target.provisioned_at]);
    await db.exec("reset role");
    await db.query("update auth.users set raw_app_meta_data=raw_app_meta_data || '{\"provider\":\"email\"}'::jsonb where id=$1", [id]);
    expect((await roleOf(id)).role).toBe("staff");
    expect((await db.query("select id from public.audit_logs where entity_id=$1 and action='create_staff_account'", [id])).rows).toHaveLength(1);
  });

  it("ignores patient-controlled metadata and retains ordinary signup behavior", async () => {
    const id = randomUUID();
    await db.exec("reset role");
    await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)", [id, `${id}@example.test`, { ...provision("admin"), role: "admin" }]);
    expect(await roleOf(id)).toMatchObject({ role: "patient", provisioned_by: "signup" });
    expect((await db.query("select email_confirmed_at from auth.users where id=$1", [id])).rows[0]).toEqual({ email_confirmed_at: null });
    expect((await db.query("select id from public.audit_logs where entity_id=$1", [id])).rows).toHaveLength(0);
  });

  it.each([staff, patient, randomUUID()])("rolls back Auth creation when the creating account is not an active admin: %s", async actor => {
    const id = randomUUID();
    await expect(createAuthAccount(id, provision("admin", actor))).rejects.toThrow("FORBIDDEN");
    for (const [table, column] of [["auth.users", "id"], ["public.profiles", "id"], ["public.user_roles", "user_id"], ["public.audit_logs", "entity_id"]]) {
      expect((await db.query(`select * from ${table} where ${column}=$1`, [id])).rows).toHaveLength(0);
    }
  });

  it("rejects a disabled creating admin and invalid target roles", async () => {
    const id = randomUUID();
    await db.exec("reset role");
    await db.query("update public.user_roles set disabled_at=now() where user_id=$1", [admin]);
    await expect(createAuthAccount(id, provision("staff"))).rejects.toThrow("FORBIDDEN");
    await db.query("update public.user_roles set disabled_at=null where user_id=$1", [admin]);
    await expect(createAuthAccount(id, provision("patient"))).rejects.toThrow("VALIDATION_ERROR");
    expect((await db.query("select id from auth.users where id=$1", [id])).rows).toHaveLength(0);
  });

  it("keeps directory emails and role operations admin-only", async () => {
    const expected = (await roleOf(staff)).provisioned_at;
    for (const actor of [patient, staff]) {
      await asUser(actor);
      await expect(db.query("select public.staff_management_ready()")).rejects.toThrow("FORBIDDEN");
      await expect(db.query("select public.list_staff_accounts()")).rejects.toThrow("FORBIDDEN");
      await expect(db.query("select public.update_staff_role($1,'admin',$2)", [staff, expected])).rejects.toThrow("FORBIDDEN");
      await expect(db.query("update public.user_roles set role='admin' where user_id=$1", [actor])).rejects.toThrow("permission denied");
    }
    await asUser(admin);
    expect((await db.query("select public.staff_management_ready() as ready")).rows[0]).toEqual({ ready: true });
    const result = (await db.query<{ value: { accounts: { id: string; email: string; role: string }[]; count: number } }>("select public.list_staff_accounts(0,100) as value")).rows[0].value;
    expect(result.count).toBe(result.accounts.length);
    expect(result.accounts.some(a => a.id === admin && a.email === `${admin}@example.test`)).toBe(true);
    expect(result.accounts.every(a => ["staff", "admin"].includes(a.role))).toBe(true);
    expect(result.accounts.some(a => a.id === patient)).toBe(false);
    const page = (await db.query<{ value: { accounts: unknown[]; count: number } }>("select public.list_staff_accounts(0,1) as value")).rows[0].value;
    expect(page.accounts).toHaveLength(1);
    expect(page.count).toBe(result.count);
    await expect(db.query("select public.list_staff_accounts(-1,20)")).rejects.toThrow("VALIDATION_ERROR");
  });

  it("changes both roles, audits changes, and rejects stale edits", async () => {
    const before = await roleOf(staff);
    await asUser(admin);
    const changed = (await db.query<{ value: { role: string; provisioned_at: string } }>("select public.update_staff_role($1,'admin',$2) as value", [staff, before.provisioned_at])).rows[0].value;
    expect(changed.role).toBe("admin");
    await expect(db.query("select public.update_staff_role($1,'staff',$2)", [staff, before.provisioned_at])).rejects.toThrow("CONFLICT");
    await db.query("select public.update_staff_role($1,'staff',$2)", [staff, changed.provisioned_at]);
    expect((await db.query("select metadata from public.audit_logs where entity_id=$1 and action='update_staff_role' order by created_at", [staff])).rows)
      .toEqual([{ metadata: { previous_role: "staff", role: "admin" } }, { metadata: { previous_role: "admin", role: "staff" } }]);
  });

  it("cannot convert patients, reactivate disabled accounts, or assign arbitrary roles", async () => {
    const patientRole = await roleOf(patient);
    const staffRole = await roleOf(staff);
    await db.query("update public.user_roles set disabled_at=now() where user_id=$1", [staff]);
    await asUser(admin);
    await expect(db.query("select public.update_staff_role($1,'admin',$2)", [patient, patientRole.provisioned_at])).rejects.toThrow("FORBIDDEN");
    await expect(db.query("select public.update_staff_role($1,'admin',$2)", [staff, staffRole.provisioned_at])).rejects.toThrow("FORBIDDEN");
    await expect(db.query("select public.update_staff_role($1,'owner',$2)", [staff, staffRole.provisioned_at])).rejects.toThrow("VALIDATION_ERROR");
    await db.exec("reset role");
    await db.query("update public.user_roles set disabled_at=null where user_id=$1", [staff]);
  });

  it("edits details atomically and rejects unauthorized metadata changes", async () => {
    const id = randomUUID();
    await createAuthAccount(id, provision("staff"));
    const before = await roleOf(id);
    const edit = { actor_id: admin, expected: before.provisioned_at, kind: "details", first: "Edited", last: "Name", employeeId: "EDIT-1", key: randomUUID() };
    await db.query("update auth.users set raw_app_meta_data=raw_app_meta_data || jsonb_build_object('staff_edit',$2::jsonb) where id=$1", [id, JSON.stringify(edit)]);
    expect((await db.query("select first_name,last_name from public.profiles where id=$1", [id])).rows[0]).toEqual({ first_name: "Edited", last_name: "Name" });
    expect((await roleOf(id)).employee_id).toBe("EDIT-1");
    await expect(db.query("update auth.users set raw_app_meta_data=raw_app_meta_data || jsonb_build_object('staff_edit',$2::jsonb) where id=$1", [id, JSON.stringify({ ...edit, key: randomUUID() })])).rejects.toThrow("CONFLICT");
    await expect(db.query("update auth.users set raw_app_meta_data=raw_app_meta_data || jsonb_build_object('staff_edit',$2::jsonb) where id=$1", [id, JSON.stringify({ ...edit, actor_id: patient, key: randomUUID() })])).rejects.toThrow("FORBIDDEN");
    const latest = await roleOf(id);
    await db.query("update auth.users set raw_app_meta_data=raw_app_meta_data || jsonb_build_object('staff_edit',$2::jsonb) where id=$1", [id, JSON.stringify({ actor_id: admin, expected: latest.provisioned_at, kind: "password", key: randomUUID() })]);
    expect((await db.query("select metadata from public.audit_logs where entity_id=$1 and action='set_staff_password'", [id])).rows).toEqual([{ metadata: {} }]);
  });

  it("restricts deletion and disables access before Auth deletion", async () => {
    const id = randomUUID();
    await createAuthAccount(id, provision("staff"));
    const before = await roleOf(id);
    await asUser(patient);
    await expect(db.query("select public.prepare_staff_deletion($1,$2)", [id, before.provisioned_at])).rejects.toThrow("FORBIDDEN");
    await asUser(admin);
    await db.query("select public.prepare_staff_deletion($1,$2)", [id, before.provisioned_at]);
    await asUser(id);
    expect((await db.query("select private.is_active() as active")).rows[0]).toEqual({ active: false });
    const own = await roleOf(admin);
    await asUser(admin);
    await expect(db.query("select public.prepare_staff_deletion($1,$2)", [admin, own.provisioned_at])).rejects.toThrow("SELF_DELETE");
  });

  it("blocks last-admin demotion and allows self-demotion only with another active admin", async () => {
    await db.exec("reset role");
    await db.query("update public.user_roles set role='staff' where role='admin' and user_id<>$1", [admin]);
    const before = await roleOf(admin);
    await asUser(admin);
    await expect(db.query("select public.update_staff_role($1,'staff',$2)", [admin, before.provisioned_at])).rejects.toThrow("LAST_ADMIN");
    await db.exec("reset role");
    await db.query("update public.user_roles set role='admin',disabled_at=now() where user_id=$1", [staff]);
    await asUser(admin);
    await expect(db.query("select public.update_staff_role($1,'staff',$2)", [admin, before.provisioned_at])).rejects.toThrow("LAST_ADMIN");
    await db.exec("reset role");
    await db.query("update public.user_roles set disabled_at=null where user_id=$1", [staff]);
    await asUser(admin);
    await db.query("select public.update_staff_role($1,'staff',$2)", [admin, before.provisioned_at]);
    await expect(db.query("select public.list_staff_accounts()")).rejects.toThrow("FORBIDDEN");
    expect((await db.query("select private.is_staff() as staff,private.is_admin() as admin")).rows[0]).toEqual({ staff: true, admin: false });
  });

  it("exposes no anonymous directory or direct provisioning helper", async () => {
    await db.exec("reset role;set role anon");
    await expect(db.query("select public.list_staff_accounts()")).rejects.toThrow("permission denied");
    await expect(db.query("select public.staff_management_ready()")).rejects.toThrow("permission denied");
    await expect(db.query("select public.update_staff_role($1,'admin',now())", [patient])).rejects.toThrow("permission denied");
    await asUser(staff);
    await expect(db.query("select private.provision_staff_account($1,$2)", [patient, provision("admin").staff_provisioning])).rejects.toThrow("permission denied");
    await expect(db.query("update auth.users set raw_app_meta_data=$2 where id=$1", [patient, provision("admin")])).rejects.toThrow("permission denied");
  });
});
