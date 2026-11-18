import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const db = new PGlite();
const staff = randomUUID();
const patients = Array.from({ length: 3 }, () => randomUUID());

type Appointment = {
  id: string;
  patient_id: string;
  status: string;
  updated_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
};

async function actor(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}

async function createSlot(capacity = 3) {
  const service = randomUUID();
  const slot = randomUUID();
  await db.exec("reset role");
  await db.query("insert into public.services(id,slug,name,description,is_published,is_bookable) values($1,$2,'Approval service','Synthetic approval tests',true,true)", [service, `approval-${service}`]);
  await db.query(`insert into public.service_slots(id,service_id,starts_at,ends_at,capacity)
    values($1,$2,((now() at time zone 'Asia/Manila')::date+1+time '08:00') at time zone 'Asia/Manila',
    ((now() at time zone 'Asia/Manila')::date+1+time '08:30') at time zone 'Asia/Manila',$3)`, [slot, service, capacity]);
  return { service, slot };
}

async function request(patient: string, slot: string) {
  await actor(patient);
  return (await db.query<{ value: Appointment }>("select public.request_appointment($1,$2) as value", [slot, randomUUID()])).rows[0].value;
}

beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create publication supabase_realtime;`);
  for (const name of [
    "202610200001_foundation.sql",
    "202610200002_workflows.sql",
    "202610200003_accounts_operations.sql",
    "20261021064654_staff_management.sql",
    "202610300001_service_catalog.sql",
    "202610300002_recurring_schedules.sql",
    "202611160001_appointment_time_slots.sql",
    "202611180001_staff_roles.sql",
    "202611180002_staff_account_management.sql",
  ]) await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  for (const id of [staff, ...patients]) await db.query("insert into auth.users values($1,now())", [id]);
  await db.query("update public.user_roles set role='admin' where user_id=$1", [staff]);
  await db.exec("update public.profiles set review_status='approved'");
});

afterAll(async () => db.close());

describe("staff appointment approval and patient visibility (embedded PostgreSQL)", () => {
  it("keeps a new request pending and refuses self-approval or check-in before staff approval", async () => {
    const { slot } = await createSlot();
    const appointment = await request(patients[0], slot);
    expect(appointment).toMatchObject({ status: "pending", decided_by: null, decided_at: null });
    await expect(db.query("select public.change_appointment($1,'approve',$2,$3)", [appointment.id, randomUUID(), appointment.updated_at])).rejects.toThrow("FORBIDDEN");
    await expect(db.query("update public.appointments set status='scheduled' where id=$1", [appointment.id])).rejects.toThrow("permission denied");
    await actor(staff);
    await expect(db.query("select public.check_in($1,$2)", [appointment.id, randomUUID()])).rejects.toThrow("INVALID_TRANSITION");
    expect((await db.query("select id from public.queue_tickets where appointment_id=$1", [appointment.id])).rows).toHaveLength(0);
    await actor(patients[0]);
    expect((await db.query<{ status: string }>("select status from public.appointments where id=$1", [appointment.id])).rows[0].status).toBe("pending");
  });

  it("approves several patients in one shared slot and publishes one private approval notification per patient", async () => {
    const { service, slot } = await createSlot();
    const appointments: Appointment[] = [];
    for (const patient of patients) appointments.push(await request(patient, slot));
    await actor(staff);
    for (const appointment of appointments) {
      const args = [appointment.id, randomUUID(), appointment.updated_at];
      const sql = "select public.change_appointment($1,'approve',$2,$3) as value";
      const approved = (await db.query<{ value: Appointment }>(sql, args)).rows[0].value;
      expect(approved).toMatchObject({ status: "scheduled", decided_by: staff });
      expect(approved.decided_at).toBeTruthy();
      expect((await db.query<{ value: Appointment }>(sql, args)).rows[0].value).toEqual(approved);
    }
    expect((await db.query("select id from public.queue_tickets where appointment_id=any($1)", [appointments.map(appointment => appointment.id)])).rows).toHaveLength(0);
    expect((await db.query<{ remaining: number }>("select remaining from public.slot_availability($1) where id=$2", [service, slot])).rows[0].remaining).toBe(0);
    for (const appointment of appointments) {
      await actor(appointment.patient_id);
      const visible = (await db.query<Appointment>("select * from public.appointments where id=any($1)", [appointments.map(value => value.id)])).rows;
      expect(visible).toHaveLength(1);
      expect(visible[0]).toMatchObject({ id: appointment.id, status: "scheduled", decided_by: staff });
      const notifications = (await db.query<{ recipient_id: string; entity_id: string; read_at: string | null }>("select recipient_id,entity_id,read_at from public.notifications where type='appointment_approve' and entity_id=any($1)", [appointments.map(value => value.id)])).rows;
      expect(notifications).toEqual([{ recipient_id: appointment.patient_id, entity_id: appointment.id, read_at: null }]);
    }
  });

  it("requires a decline reason, displays it to the patient, and releases the reserved place", async () => {
    const { service, slot } = await createSlot(1);
    const appointment = await request(patients[0], slot);
    await actor(staff);
    await expect(db.query("select public.change_appointment($1,'reject',$2,$3,'   ')", [appointment.id, randomUUID(), appointment.updated_at])).rejects.toThrow("VALIDATION_ERROR");
    expect((await db.query<{ remaining: number }>("select remaining from public.slot_availability($1) where id=$2", [service, slot])).rows[0].remaining).toBe(0);
    const reason = "Please choose another appointment time.";
    await db.query("select public.change_appointment($1,'reject',$2,$3,$4)", [appointment.id, randomUUID(), appointment.updated_at, reason]);
    await actor(patients[0]);
    expect((await db.query<Appointment>("select * from public.appointments where id=$1", [appointment.id])).rows[0]).toMatchObject({ status: "rejected", decision_reason: reason, decided_by: staff });
    expect((await db.query("select id from public.notifications where type='appointment_reject' and entity_id=$1", [appointment.id])).rows).toHaveLength(1);
    expect((await db.query<{ remaining: number }>("select remaining from public.slot_availability($1) where id=$2", [service, slot])).rows[0].remaining).toBe(1);
    expect((await request(patients[1], slot)).status).toBe("pending");
  });

  it("rejects a stale selected request without preventing another valid approval", async () => {
    const { slot } = await createSlot();
    const cancelled = await request(patients[0], slot);
    const pending = await request(patients[1], slot);
    await actor(patients[0]);
    await db.query("select public.change_appointment($1,'cancel',$2,$3,'Plans changed')", [cancelled.id, randomUUID(), cancelled.updated_at]);
    await actor(staff);
    await expect(db.query("select public.change_appointment($1,'approve',$2,$3)", [cancelled.id, randomUUID(), cancelled.updated_at])).rejects.toThrow("CONFLICT");
    await db.query("select public.change_appointment($1,'approve',$2,$3)", [pending.id, randomUUID(), pending.updated_at]);
    const statuses = (await db.query<{ id: string; status: string }>("select id,status from public.appointments where id=any($1)", [[cancelled.id, pending.id]])).rows;
    expect(statuses).toEqual(expect.arrayContaining([{ id: cancelled.id, status: "cancelled" }, { id: pending.id, status: "scheduled" }]));
    await actor(patients[0]);
    expect((await db.query("select id from public.notifications where type='appointment_approve' and entity_id=$1", [cancelled.id])).rows).toHaveLength(0);
  });
});
