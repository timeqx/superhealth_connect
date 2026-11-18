import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

const db = new PGlite();
const patient = randomUUID();
const other = randomUUID();
const staff = randomUUID();
const admin = randomUUID();
const document = randomUUID();
const service = randomUUID();
const slot = randomUUID();

type Appointment = { id: string; status: string; updated_at: string; decided_by: string };
type Message = { id: string; is_draft: boolean; updated_at: string };

async function actor(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}

async function request() {
  await db.exec("reset role");
  const target = randomUUID();
  await db.query(`insert into public.service_slots(id,service_id,starts_at,ends_at,capacity)
    values($1,$2,((now() at time zone 'Asia/Manila')::date+1+time '08:00') at time zone 'Asia/Manila' + ($3::integer * interval '1 minute'),
      ((now() at time zone 'Asia/Manila')::date+1+time '08:30') at time zone 'Asia/Manila' + ($3::integer * interval '1 minute'),2)`,
  [target, service, nextSlot++]);
  await actor(patient);
  return (await db.query<{ value: Appointment }>("select public.request_appointment($1,$2) as value", [target, randomUUID()])).rows[0].value;
}
let nextSlot = 1;

beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,email text,raw_app_meta_data jsonb default '{}',raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;
    create publication supabase_realtime;`);
  for (const name of readdirSync("supabase/migrations").filter(name => name.endsWith(".sql")).sort()) {
    if (name === "202611180001_staff_roles.sql") {
      await db.query("insert into auth.users values($1,now()),($2,now()),($3,now()),($4,now())", [patient, other, staff, admin]);
      await db.query("update public.user_roles set role='admin',employee_id='LEGACY-001',provisioned_by='legacy operator' where user_id=$1", [admin]);
    }
    await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  }
  await db.query("update public.user_roles set role='staff' where user_id=$1", [staff]);
  await db.exec("update public.profiles set review_status='approved'");
  await db.query("insert into public.services(id,slug,name,description,is_published,is_bookable) values($1,'role-tests','Role test service','Synthetic data',true,true)", [service]);
  await db.query(`insert into public.service_slots(id,service_id,starts_at,ends_at,capacity)
    values($1,$2,((now() at time zone 'Asia/Manila')::date+1+time '08:00') at time zone 'Asia/Manila',
      ((now() at time zone 'Asia/Manila')::date+1+time '08:30') at time zone 'Asia/Manila',5)`, [slot, service]);
  await db.query("insert into public.verification_documents(id,user_id,storage_path,mime_type,size_bytes,review_version) values($1,$2,$3,'image/png',100,1)", [document, patient, `${patient}/${document}.png`]);
  await db.query("insert into storage.objects(bucket_id,name) values('verification',$1)", [`${patient}/${document}.png`]);
  await db.query("insert into public.audit_logs(action,entity_type,entity_id) values('role_test','service',$1)", [service]);
});

afterAll(async () => db.close());

describe("patient, staff and admin database authorization", () => {
  it("preserves existing staff-portal accounts as administrators with their provisioning details", async () => {
    await actor(admin);
    expect((await db.query("select role,employee_id,provisioned_by from public.user_roles")).rows).toEqual([
      { role: "admin", employee_id: "LEGACY-001", provisioned_by: "legacy operator" },
    ]);
    expect((await db.query("select private.is_admin() as admin,private.is_staff() as staff")).rows[0]).toEqual({ admin: true, staff: true });
    await actor(staff);
    expect((await db.query("select private.is_admin() as admin,private.is_staff() as staff")).rows[0]).toEqual({ admin: false, staff: true });
    await expect(db.query("update public.user_roles set role='admin' where user_id=$1", [staff])).rejects.toThrow("permission denied");
    await expect(db.query("select private.require_staff()")).rejects.toThrow("permission denied");
    expect((await db.query(`select has_function_privilege('anon',oid,'execute') as allowed
      from pg_proc where pronamespace='public'::regnamespace
      and proname in ('change_appointment','check_in','advance_queue','reply_inquiry','edit_inquiry_draft','operational_durations')`)).rows).toEqual(
      Array.from({ length: 6 }, () => ({ allowed: false })),
    );
  });

  it("lets staff approve and decline requests, including replay, and leaves patients isolated", async () => {
    const approved = await request();
    const declined = await request();
    await expect(db.query("select public.change_appointment($1,'approve',$2,$3)", [approved.id, randomUUID(), approved.updated_at])).rejects.toThrow("FORBIDDEN");
    await actor(staff);
    const args = [approved.id, randomUUID(), approved.updated_at];
    const sql = "select public.change_appointment($1,'approve',$2,$3) as value";
    expect((await db.query<{ value: Appointment }>(sql, args)).rows[0].value).toMatchObject({ status: "scheduled", decided_by: staff });
    expect((await db.query<{ value: Appointment }>(sql, args)).rows[0].value.status).toBe("scheduled");
    expect((await db.query<{ value: Appointment }>("select public.change_appointment($1,'reject',$2,$3,'Choose another time') as value", [declined.id, randomUUID(), declined.updated_at])).rows[0].value.status).toBe("rejected");
    expect((await db.query("select id from public.slot_availability($1) where id=$2", [service, slot])).rows).toEqual([{ id: slot }]);
    expect((await db.query("select id from public.profiles where id=$1", [patient])).rows).toHaveLength(1);
    await actor(other);
    expect((await db.query("select id from public.appointments where id=any($1)", [[approved.id, declined.id]])).rows).toHaveLength(0);
    await actor(patient);
    expect((await db.query("select id from public.notifications where entity_id=any($1)", [[approved.id, declined.id]])).rows).toHaveLength(4);
  });

  it("lets staff check in patients, advance queues and read operational reports", async () => {
    const appointment = await request();
    await actor(staff);
    await db.query("select public.change_appointment($1,'approve',$2,$3)", [appointment.id, randomUUID(), appointment.updated_at]);
    await db.exec("reset role");
    await db.query(`update public.service_slots set starts_at=((now() at time zone 'Asia/Manila')::date+time '00:00') at time zone 'Asia/Manila',
      ends_at=((now() at time zone 'Asia/Manila')::date+time '23:59:59') at time zone 'Asia/Manila'
      where id=(select slot_id from public.appointments where id=$1)`, [appointment.id]);
    await actor(staff);
    const ticket = (await db.query<{ value: { id: string; queue_session_id: string } }>("select public.check_in($1,$2) as value", [appointment.id, randomUUID()])).rows[0].value;
    expect((await db.query("select id from public.queue_sessions where id=$1", [ticket.queue_session_id])).rows).toHaveLength(1);
    expect((await db.query("select id from public.queue_tickets where id=$1", [ticket.id])).rows).toHaveLength(1);
    for (const action of ["call_next", "start", "complete"]) {
      await db.query("select public.advance_queue($1,$2,$3,$4)", [ticket.queue_session_id, action, randomUUID(), ticket.id]);
    }
    expect((await db.query("select status from public.appointments where id=$1", [appointment.id])).rows[0]).toEqual({ status: "completed" });
    const report = await db.query<{ value: { decisions: { samples: number }; queue: { service_samples: number } } }>("select public.operational_durations(now()-interval '1 day',now()+interval '1 day') as value");
    expect(report.rows[0].value.decisions.samples).toBeGreaterThan(0);
    expect(report.rows[0].value.queue.service_samples).toBe(1);
    await actor(patient);
    await expect(db.query("select public.operational_durations(now()-interval '1 day',now()+interval '1 day')")).rejects.toThrow("FORBIDDEN");
  });

  it("lets staff manage private inquiry drafts and publish patient-visible replies", async () => {
    await actor(patient);
    const inquiry = (await db.query<{ value: { id: string } }>("select public.create_inquiry('Role question','General','Test question',$1) as value", [randomUUID()])).rows[0].value;
    await actor(staff);
    expect((await db.query("select id from public.inquiries where id=$1", [inquiry.id])).rows).toHaveLength(1);
    const draft = (await db.query<{ value: Message }>("select public.reply_inquiry($1,'Private draft',false,'in_progress',$2) as value", [inquiry.id, randomUUID()])).rows[0].value;
    expect((await db.query("select id from public.inquiry_messages where id=$1", [draft.id])).rows).toHaveLength(1);
    await actor(patient);
    expect((await db.query("select id from public.inquiry_messages where id=$1", [draft.id])).rows).toHaveLength(0);
    await expect(db.query("select public.edit_inquiry_draft($1,'Publish',true,'resolved',$2,$3)", [draft.id, draft.updated_at, randomUUID()])).rejects.toThrow("FORBIDDEN");
    await actor(staff);
    const published = (await db.query<{ value: Message }>("select public.edit_inquiry_draft($1,'Published answer',true,'resolved',$2,$3) as value", [draft.id, draft.updated_at, randomUUID()])).rows[0].value;
    expect(published.is_draft).toBe(false);
    await actor(patient);
    expect((await db.query("select body from public.inquiry_messages where id=$1", [draft.id])).rows).toEqual([{ body: "Published answer" }]);
    expect((await db.query("select id from public.notifications where entity_id=$1 and type='inquiry_reply'", [inquiry.id])).rows).toHaveLength(1);
    await actor(other);
    expect((await db.query("select id from public.inquiries where id=$1", [inquiry.id])).rows).toHaveLength(0);
  });

  it("denies staff administrative RPCs, document access, audit reads and direct mutations", async () => {
    const appointment = await request();
    await actor(staff);
    const forbidden = [
      ["select public.review_account($1,$2,'approved','',gen_random_uuid())", [patient, document]],
      ["select public.save_service_definition(null,'Forbidden','forbidden','Test',null,gen_random_uuid())", []],
      ["select public.update_service($1,true,true,'Test requirements',15)", [service]],
      ["select public.save_service_schedule($1,'08:00','10:00',30,2,array[1],now(),gen_random_uuid())", [service]],
      ["select public.save_slot(null,$1,now()+interval '1 day',now()+interval '1 day 30 minutes',2,true,null,gen_random_uuid())", [service]],
      ["select public.staff_request_appointment($1,$2,'Requested help',gen_random_uuid())", [patient, slot]],
      ["select public.ensure_service_sessions(null)", []],
      ...["cancel", "reschedule", "no_show"].map(action => ["select public.change_appointment($1,$2,gen_random_uuid(),$3,'Test reason',$4)", [appointment.id, action, appointment.updated_at, slot]]),
    ] as [string, unknown[]][];
    for (const [sql, args] of forbidden) await expect(db.query(sql, args)).rejects.toThrow("FORBIDDEN");
    for (const table of ["verification_documents", "audit_logs"]) {
      expect((await db.query(`select id from public.${table}`)).rows).toHaveLength(0);
    }
    expect((await db.query("select id from storage.objects")).rows).toHaveLength(0);
    await expect(db.query("update public.appointments set status='scheduled' where id=$1", [appointment.id])).rejects.toThrow("permission denied");
    await actor(admin);
    expect((await db.query("select id from public.verification_documents where id=$1", [document])).rows).toHaveLength(1);
    expect((await db.query("select id from storage.objects")).rows).toHaveLength(1);
    expect((await db.query("select id from public.audit_logs")).rows.length).toBeGreaterThan(0);
    await db.query("select public.update_service($1,true,true,'Admin can manage',15)", [service]);
    await db.query("select public.staff_request_appointment($1,$2,'Admin can book',gen_random_uuid())", [patient, slot]);
  });

  it("keeps patient-owned cancellation available and denies disabled staff operational access", async () => {
    const appointment = await request();
    await db.query("select public.change_appointment($1,'cancel',gen_random_uuid(),$2,'Plans changed')", [appointment.id, appointment.updated_at]);
    expect((await db.query("select status from public.appointments where id=$1", [appointment.id])).rows[0]).toEqual({ status: "cancelled" });
    await db.exec("reset role");
    await db.query("update public.user_roles set disabled_at=now() where user_id=$1", [staff]);
    await actor(staff);
    expect((await db.query("select private.is_staff() as staff")).rows[0]).toEqual({ staff: false });
    for (const table of ["appointments", "queue_sessions", "queue_tickets", "inquiries", "inquiry_messages"]) {
      expect((await db.query(`select id from public.${table}`)).rows).toHaveLength(0);
    }
    await expect(db.query("select public.check_in($1,gen_random_uuid())", [appointment.id])).rejects.toThrow("FORBIDDEN");
    await expect(db.query("select public.change_appointment($1,'approve',gen_random_uuid(),$2)", [appointment.id, appointment.updated_at])).rejects.toThrow("FORBIDDEN");
    await expect(db.query("select public.operational_durations(now()-interval '1 day',now()+interval '1 day')")).rejects.toThrow("FORBIDDEN");
  });
});
