import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";

const db = new PGlite();
const patient = randomUUID();
const other = randomUUID();
const staff = randomUUID();
const admin = randomUUID();
const first = "2020-01-01T00:00:00.000001Z";
const second = "2020-01-01T00:00:00.000002Z";
const third = "2020-01-01T00:00:00.000003Z";
type Counts = { notifications: number; inquiries: number; requests: number; accounts: number };

async function actor(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function counts(id: string) {
  await actor(id);
  return (await db.query<{ value: Counts }>("select public.portal_badge_counts() as value")).rows[0].value;
}
async function inquiry(owner = patient) {
  await db.exec("reset role");
  const id = randomUUID();
  await db.query("insert into public.inquiries(id,patient_id,subject,category,idempotency_key) values($1,$2,'Synthetic inquiry','General',$3)", [id, owner, randomUUID()]);
  await message(id, owner, first);
  return id;
}
async function message(thread: string, author: string, time: string, draft = false) {
  await db.exec("reset role");
  const id = randomUUID();
  await db.query(`insert into public.inquiry_messages(id,inquiry_id,author_id,body,is_draft,published_at,idempotency_key,created_at,updated_at)
    values($1,$2,$3,'Synthetic message',$4,case when $4 then null else $5::timestamptz end,$6,$5,$5)`, [id, thread, author, draft, time, randomUUID()]);
  return id;
}
async function notification(thread: string, messageId: string, recipient = patient) {
  await db.exec("reset role");
  await db.query("insert into public.notifications(recipient_id,event_key,type,entity_type,entity_id) values($1,$2,'inquiry_reply','inquiry',$3)", [recipient, `reply:${messageId}`, thread]);
}
async function read(id: string, thread: string, through: string) {
  await actor(id);
  await db.query("select public.mark_inquiry_read($1,$2)", [thread, through]);
}

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
    await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  }
});
beforeEach(async () => {
  await db.exec("reset role; begin");
  await db.query("insert into auth.users(id,email_confirmed_at) values($1,now()),($2,now()),($3,now()),($4,now())", [patient, other, staff, admin]);
  await db.query("update public.user_roles set role='staff' where user_id=$1", [staff]);
  await db.query("update public.user_roles set role='admin' where user_id=$1", [admin]);
});
afterEach(async () => db.exec("rollback"));
afterAll(async () => db.close());

describe("portal badges and per-person inquiry read state", () => {
  it("counts unread incoming conversations, excluding drafts and staff messages from staff badges", async () => {
    const thread = await inquiry();
    await message(thread, staff, second, true);
    expect(await counts(patient)).toEqual({ notifications: 0, inquiries: 0, requests: 0, accounts: 0 });
    expect((await counts(staff)).inquiries).toBe(1);
    await read(staff, thread, first);
    await message(thread, admin, second);
    await message(thread, staff, third);
    expect((await counts(staff)).inquiries).toBe(0);
    expect((await counts(patient)).inquiries).toBe(1);
    expect((await counts(other)).inquiries).toBe(0);
    // Two unread replies in a single conversation contribute one badge item.
    await inquiry();
    expect((await counts(staff)).inquiries).toBe(1);
    expect((await counts(admin)).inquiries).toBe(2);
  });

  it("counts all pages and only pending requests and account reviews", async () => {
    await db.exec("reset role");
    const service = randomUUID();
    await db.query("insert into public.services(id,slug,name,description) values($1,'badge-fixture','Badge fixture','Synthetic service')", [service]);
    for (let n = 0; n < 25; n++) {
      const thread = await inquiry();
      const reply = await message(thread, staff, second);
      await notification(thread, reply);
      const review = randomUUID();
      const slot = randomUUID();
      await db.query("insert into auth.users(id,email_confirmed_at) values($1,now())", [review]);
      await db.query("update public.profiles set review_status='pending' where id=$1", [review]);
      await db.query(`insert into public.service_slots(id,service_id,starts_at,ends_at,capacity)
        values($1,$2,'2030-01-01 01:00Z'::timestamptz+($3::integer*interval '1 minute'),'2030-01-01 01:30Z'::timestamptz+($3::integer*interval '1 minute'),1)`, [slot, service, n]);
      await db.query("insert into public.appointments(patient_id,slot_id,original_slot_id,idempotency_key) values($1,$2,$2,$3)", [patient, slot, randomUUID()]);
    }
    expect(await counts(patient)).toEqual({ notifications: 25, inquiries: 25, requests: 0, accounts: 0 });
    expect(await counts(staff)).toEqual({ notifications: 0, inquiries: 25, requests: 25, accounts: 0 });
    expect(await counts(admin)).toEqual({ notifications: 0, inquiries: 25, requests: 25, accounts: 25 });
    await db.exec("reset role");
    const appointments = (await db.query<{ id: string }>("select id from public.appointments order by id limit 2")).rows;
    await db.query("update public.appointments set status='scheduled' where id=$1", [appointments[0].id]);
    await db.query("update public.appointments set status='rejected' where id=$1", [appointments[1].id]);
    const reviews = (await db.query<{ id: string }>("select id from public.profiles where review_status='pending' order by id limit 2")).rows;
    await db.query("update public.profiles set review_status='approved' where id=$1", [reviews[0].id]);
    await db.query("update public.profiles set review_status='rejected' where id=$1", [reviews[1].id]);
    expect(await counts(admin)).toMatchObject({ requests: 23, accounts: 23 });
  });

  it("acknowledges only viewed replies and their notifications without moving a newer read backwards", async () => {
    const thread = await inquiry();
    const reply1 = await message(thread, staff, second);
    const reply2 = await message(thread, staff, third);
    await notification(thread, reply1);
    await notification(thread, reply2);
    await read(patient, thread, second);
    expect(await counts(patient)).toMatchObject({ notifications: 1, inquiries: 1 });
    await read(patient, thread, third);
    expect(await counts(patient)).toMatchObject({ notifications: 0, inquiries: 0 });
    await read(patient, thread, second);
    expect((await counts(patient)).inquiries).toBe(0);
    await read(staff, thread, first);
    expect((await counts(staff)).inquiries).toBe(0);
    expect((await counts(admin)).inquiries).toBe(1);
    await message(thread, patient, third);
    expect((await counts(staff)).inquiries).toBe(1);
  });

  it("clamps future cutoffs so later messages remain unread and ignores drafts", async () => {
    const thread = await inquiry();
    await message(thread, staff, second);
    await message(thread, staff, "2030-01-01T00:00:00Z", true);
    await read(patient, thread, "2031-01-01T00:00:00Z");
    expect((await counts(patient)).inquiries).toBe(0);
    await message(thread, staff, third);
    expect((await counts(patient)).inquiries).toBe(1);
  });

  it("treats publishing an older draft as a new incoming update", async () => {
    const thread = await inquiry();
    const draft = await message(thread, staff, first, true);
    await message(thread, staff, second);
    await read(patient, thread, second);
    expect((await counts(patient)).inquiries).toBe(0);
    await actor(staff);
    const expected = (await db.query<{ updated: string }>("select updated_at::text as updated from public.inquiry_messages where id=$1", [draft])).rows[0].updated;
    await db.query("select public.edit_inquiry_draft($1,'Published response',true,'in_progress',$2,$3)", [draft, expected, randomUUID()]);
    expect(await counts(patient)).toMatchObject({ inquiries: 1, notifications: 1 });
  });

  it("marks notifications across all pages while preserving other accounts, existing reads and unread conversations", async () => {
    const thread = await inquiry();
    for (let n = 0; n < 25; n++) {
      const reply = await message(thread, staff, second);
      await notification(thread, reply);
    }
    const alreadyRead = await message(thread, staff, second);
    await notification(thread, alreadyRead);
    await db.query("update public.notifications set read_at=$1 where event_key=$2", [first, `reply:${alreadyRead}`]);
    const previousRead = (await db.query<{ read: string }>("select read_at::text as read from public.notifications where event_key=$1", [`reply:${alreadyRead}`])).rows[0].read;
    await notification(thread, randomUUID(), other);

    expect(await counts(patient)).toMatchObject({ notifications: 25, inquiries: 1 });
    expect((await db.query<{ marked: number }>("select public.mark_all_notifications_read()::integer as marked")).rows[0].marked).toBe(25);
    expect(await counts(patient)).toMatchObject({ notifications: 0, inquiries: 1 });
    expect((await db.query<{ read: string }>("select read_at::text as read from public.notifications where event_key=$1", [`reply:${alreadyRead}`])).rows[0].read).toBe(previousRead);
    expect((await db.query("select * from public.inquiry_reads")).rows).toHaveLength(0);
    expect((await db.query<{ marked: number }>("select public.mark_all_notifications_read()::integer as marked")).rows[0].marked).toBe(0);
    expect((await counts(other)).notifications).toBe(1);

    // Notifications arriving after this operation stay unread.
    const laterReply = await message(thread, staff, third);
    await notification(thread, laterReply);
    expect((await counts(patient)).notifications).toBe(1);
  });

  it("allows only an active authenticated account to mark its own notifications in bulk", async () => {
    const thread = await inquiry();
    await notification(thread, randomUUID());
    await db.query("update public.user_roles set disabled_at=now() where user_id=$1", [patient]);
    async function rejects(error: string) {
      await db.exec("savepoint rejected_bulk_read");
      await expect(db.query("select public.mark_all_notifications_read()")).rejects.toThrow(error);
      await db.exec("rollback to savepoint rejected_bulk_read");
    }
    await actor(patient);
    await rejects("FORBIDDEN");
    await actor("");
    await rejects("UNAUTHENTICATED");
    await db.exec("reset role; set role anon");
    await rejects("permission denied");
    await db.exec("reset role");
    expect((await db.query("select id from public.notifications where read_at is null")).rows).toHaveLength(1);
  });

  it("keeps read markers private and denies direct writes, other patients, disabled users and anonymous access", async () => {
    const thread = await inquiry();
    await message(thread, staff, second);
    await read(patient, thread, second);
    await actor(other);
    expect((await db.query("select * from public.inquiry_reads")).rows).toHaveLength(0);
    // Each rejected operation has its own savepoint because PostgreSQL aborts the transaction on errors.
    async function rejects(sql: string, params: unknown[], error: string) {
      await db.exec("savepoint rejected_operation");
      await expect(db.query(sql, params)).rejects.toThrow(error);
      await db.exec("rollback to savepoint rejected_operation");
    }
    await rejects("select public.mark_inquiry_read($1,$2)", [thread, second], "FORBIDDEN");
    await rejects("insert into public.inquiry_reads(user_id,inquiry_id,last_read_at) values($1,$2,now())", [other, thread], "permission denied");
    await actor(patient);
    expect((await db.query("select * from public.inquiry_reads")).rows).toHaveLength(1);
    await rejects("select public.mark_inquiry_read($1,null)", [thread], "VALIDATION_ERROR");
    await rejects("select public.mark_inquiry_read($1,'infinity')", [thread], "VALIDATION_ERROR");
    await db.exec("reset role");
    await db.query("update public.user_roles set disabled_at=now() where user_id=$1", [patient]);
    await actor(patient);
    expect((await db.query("select * from public.inquiry_reads")).rows).toHaveLength(0);
    await rejects("select public.portal_badge_counts()", [], "FORBIDDEN");
    await rejects("select public.mark_inquiry_read($1,$2)", [thread, second], "FORBIDDEN");
    await actor("");
    await rejects("select public.portal_badge_counts()", [], "UNAUTHENTICATED");
    await db.exec("reset role; set role anon");
    await rejects("select public.portal_badge_counts()", [], "permission denied");
    await rejects("select public.mark_inquiry_read($1,$2)", [thread, second], "permission denied");
  });
});
