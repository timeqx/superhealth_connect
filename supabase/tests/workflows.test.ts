import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
const a = "10000000-0000-4000-8000-000000000001",
  b = "10000000-0000-4000-8000-000000000002",
  staff = "10000000-0000-4000-8000-000000000003";
const service = "20000000-0000-4000-8000-000000000001",
  slot = "30000000-0000-4000-8000-000000000001";
async function actor(id: string) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id}',false);set role authenticated;`,
  );
}
async function request(key: string) {
  return db.query<{
    value: { id: string; status: string; updated_at: string };
  }>("select public.request_appointment($1,$2) as value", [slot, key]);
}
beforeAll(async () => {
  await db.exec("create publication supabase_realtime;");
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
  );
  for (const name of [
    "202610200001_foundation.sql",
    "202610200002_workflows.sql",
    "202610200003_accounts_operations.sql",
    "20261021064654_staff_management.sql",
  ])
    await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  await db.exec(
    `insert into auth.users values('${a}',now()),('${b}',now()),('${staff}',now());update public.profiles set review_status='approved';update public.user_roles set role='admin' where user_id='${staff}';insert into public.services(id,slug,name,description,is_published,is_bookable) values('${service}','sample','Synthetic service','Test only',true,true);insert into public.service_slots(id,service_id,starts_at,ends_at,capacity) values('${slot}','${service}',now()+interval '1 day',now()+interval '1 day 30 minutes',1);`,
  );
});
afterAll(async () => {
  await db.close();
});
describe("PostgreSQL functions and RLS (embedded PostgreSQL, not Supabase integration)", () => {
  it("protects service creation and replays staff changes", async () => {
    const args = [null, "Synthetic new service", "synthetic-new", "Synthetic only", null, "90000000-0000-4000-8000-000000000001"];
    const sql = "select public.save_service_definition($1,$2,$3,$4,$5,$6) as value";
    await actor(a);
    await expect(db.query(sql, args)).rejects.toThrow("FORBIDDEN");
    await actor(staff);
    const first = await db.query<{value: {id: string; is_published: boolean}}>(sql,args);
    const second = await db.query<{value: {id: string}}>(sql,args);
    expect(first.rows[0].value.id).toBe(second.rows[0].value.id);
    expect(first.rows[0].value.is_published).toBe(false);
    await expect(db.query(sql,[first.rows[0].value.id,"Changed","synthetic-new","Synthetic only","2000-01-01","90000000-0000-4000-8000-000000000002"])).rejects.toThrow("CONFLICT");
  });
  it("edits drafts privately and publishes once", async () => {
    await actor(a);
    const thread = await db.query<{value: {id: string}}>("select public.create_inquiry('Synthetic draft edit','General','Question',$1) as value", ["91000000-0000-4000-8000-000000000001"]);
    await actor(staff);
    const draft = await db.query<{value: {id: string; updated_at: string}}>("select public.reply_inquiry($1,'Draft',false,'in_progress',$2) as value", [thread.rows[0].value.id,"91000000-0000-4000-8000-000000000002"]);
    const sql = "select public.edit_inquiry_draft($1,$2,$3,$4,$5,$6) as value";
    const args = [draft.rows[0].value.id,"Edited privately",false,"in_progress",draft.rows[0].value.updated_at,"91000000-0000-4000-8000-000000000003"];
    await actor(a);
    await expect(db.query(sql,args)).rejects.toThrow("FORBIDDEN");
    await actor(staff);
    const edit = await db.query<{value: {updated_at: string}}>(sql,args);
    await actor(a);
    expect((await db.query("select id from public.inquiry_messages where id=$1",[args[0]])).rows).toHaveLength(0);
    await actor(staff);
    const publish = [args[0],"Published edited reply",true,"resolved",edit.rows[0].value.updated_at,"91000000-0000-4000-8000-000000000004"];
    await db.query(sql,publish); await db.query(sql,publish);
    await expect(db.query(sql,[...publish.slice(0,5),"91000000-0000-4000-8000-000000000005"])).rejects.toThrow("CONFLICT");
    await actor(a);
    expect((await db.query("select id from public.inquiry_messages where id=$1",[args[0]])).rows).toHaveLength(1);
  });
  it("reserves capacity once and replays identical requests", async () => {
    await actor(a);
    const key = "40000000-0000-4000-8000-000000000001";
    const first = await request(key);
    const second = await request(key);
    expect(first.rows[0].value.status).toBe("pending");
    expect(second.rows[0].value.id).toBe(first.rows[0].value.id);
  });
  it("rejects another patient when pending consumes capacity", async () => {
    await actor(b);
    await expect(
      request("40000000-0000-4000-8000-000000000002"),
    ).rejects.toThrow("SLOT_FULL");
  });
  it("isolates patient reads and blocks direct writes", async () => {
    await actor(b);
    expect(
      (await db.query("select * from public.appointments")).rows,
    ).toHaveLength(0);
    await expect(
      db.exec("update public.profiles set review_status='approved'"),
    ).rejects.toThrow("permission denied");
    await expect(
      db.exec("update public.user_roles set role='admin'"),
    ).rejects.toThrow("permission denied");
    await expect(db.exec("select * from public.email_outbox")).rejects.toThrow(
      "permission denied",
    );
  });
  it("rejects patient approval and disabled staff", async () => {
    await actor(a);
    const { rows } = await db.query<{ id: string; updated_at: string }>(
      "select id,updated_at from public.appointments",
    );
    await expect(
      db.query("select public.change_appointment($1,'approve',$2,$3)", [
        rows[0].id,
        "40000000-0000-4000-8000-000000000003",
        rows[0].updated_at,
      ]),
    ).rejects.toThrow("FORBIDDEN");
    await db.exec(
      `reset role;update public.user_roles set disabled_at=now() where user_id='${staff}';`,
    );
    await actor(staff);
    await expect(
      db.query("select public.change_appointment($1,'approve',$2,$3)", [
        rows[0].id,
        "40000000-0000-4000-8000-000000000004",
        rows[0].updated_at,
      ]),
    ).rejects.toThrow("FORBIDDEN");
  });
  it("full reschedule target preserves the original reservation", async () => {
    const target = "30000000-0000-4000-8000-000000000002";
    await db.exec(
      `reset role;insert into public.service_slots(id,service_id,starts_at,ends_at,capacity) values('${target}','${service}',now()+interval '2 days',now()+interval '2 days 30 minutes',1);`,
    );
    await actor(b);
    await db.query("select public.request_appointment($1,$2)", [
      target,
      "40000000-0000-4000-8000-000000000005",
    ]);
    await actor(a);
    const { rows } = await db.query<{ id: string; updated_at: string }>(
      "select id,updated_at from public.appointments",
    );
    await expect(
      db.query(
        "select public.change_appointment($1,'reschedule',$2,$3,null,$4)",
        [
          rows[0].id,
          "40000000-0000-4000-8000-000000000006",
          rows[0].updated_at,
          target,
        ],
      ),
    ).rejects.toThrow("SLOT_FULL");
    expect(
      (
        await db.query<{ slot_id: string }>(
          "select slot_id from public.appointments",
        )
      ).rows[0].slot_id,
    ).toBe(slot);
  });
  it("check-in retries return one ticket and queue completion stays synchronized", async () => {
    await db.exec(
      `reset role;update public.user_roles set disabled_at=null where user_id='${staff}';update public.service_slots set starts_at=date_trunc('day',now() at time zone 'Asia/Manila') at time zone 'Asia/Manila',ends_at=(date_trunc('day',now() at time zone 'Asia/Manila')+interval '23 hours 59 minutes') at time zone 'Asia/Manila' where id='${slot}';`,
    );
    await actor(staff);
    const { rows } = await db.query<{ id: string; updated_at: string }>(
      "select id,updated_at from public.appointments where slot_id=$1",
      [slot],
    );
    await db.query("select public.change_appointment($1,'approve',$2,$3)", [
      rows[0].id,
      "40000000-0000-4000-8000-000000000007",
      rows[0].updated_at,
    ]);
    const first = await db.query<{
      value: { id: string; queue_session_id: string };
    }>("select public.check_in($1,$2) as value", [
      rows[0].id,
      "40000000-0000-4000-8000-000000000008",
    ]);
    const second = await db.query<{ value: { id: string } }>(
      "select public.check_in($1,$2) as value",
      [rows[0].id, "40000000-0000-4000-8000-000000000009"],
    );
    expect(first.rows[0].value.id).toBe(second.rows[0].value.id);
    const ticket = first.rows[0].value;
    await db.query("select public.advance_queue($1,'call_next',$2)", [
      ticket.queue_session_id,
      "40000000-0000-4000-8000-000000000010",
    ]);
    await expect(
      db.query("select public.advance_queue($1,'call_next',$2)", [
        ticket.queue_session_id,
        "40000000-0000-4000-8000-000000000011",
      ]),
    ).rejects.toThrow("CONFLICT");
    await db.query("select public.advance_queue($1,'skip',$2,$3)", [
      ticket.queue_session_id,
      "40000000-0000-4000-8000-000000000012",
      ticket.id,
    ]);
    await db.query("select public.advance_queue($1,'requeue',$2,$3)", [
      ticket.queue_session_id,
      "40000000-0000-4000-8000-000000000013",
      ticket.id,
    ]);
    await expect(
      db.query("select public.advance_queue($1,'requeue',$2,$3)", [
        ticket.queue_session_id,
        "40000000-0000-4000-8000-000000000014",
        ticket.id,
      ]),
    ).rejects.toThrow("INVALID_TRANSITION");
    for (const [action, key] of [
      ["call_next", "015"],
      ["start", "016"],
      ["complete", "017"],
    ]) {
      await db.query("select public.advance_queue($1,$2,$3,$4)", [
        ticket.queue_session_id,
        action,
        `40000000-0000-4000-8000-000000000${key}`,
        ticket.id,
      ]);
    }
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.appointments where id=$1",
          [rows[0].id],
        )
      ).rows[0].status,
    ).toBe("completed");
    expect(
      (
        await db.query<{ status: string }>(
          "select status from public.queue_tickets where id=$1",
          [ticket.id],
        )
      ).rows[0].status,
    ).toBe("completed");
  });
  it("guards schedule edits, replays creation, and rejects stale updates", async () => {
    await actor(a);
    await expect(db.query("select public.update_service($1,true,true,'Synthetic requirements',15)", [service])).rejects.toThrow("FORBIDDEN");
    await actor(staff);
    const key = "80000000-0000-4000-8000-000000000001";
    const args = [service, "2099-01-01T09:00:00+08:00", "2099-01-01T10:00:00+08:00", key];
    const sql = "select public.save_slot(null,$1,$2,$3,2,true,null,$4) as value";
    const first = await db.query<{value: {id: string; updated_at: string}}>(sql, args);
    const replay = await db.query<{value: {id: string}}>(sql, args);
    expect(first.rows[0].value.id).toBe(replay.rows[0].value.id);
    const id = first.rows[0].value.id;
    for (const [user, key] of [[a,"002"],[b,"003"]]) {
      await actor(user);
      await db.query("select public.request_appointment($1,$2)", [id, `80000000-0000-4000-8000-000000000${key}`]);
    }
    await actor(staff);
    await expect(db.query("select public.save_slot($1,$2,$3,$4,1,true,$5,$6)", [id, ...args.slice(0,3), first.rows[0].value.updated_at, "80000000-0000-4000-8000-000000000004"])).rejects.toThrow("SLOT_FULL");
    await expect(db.query("select public.save_slot($1,$2,$3,$4,2,false,'2000-01-01',$5)", [id, ...args.slice(0,3), "80000000-0000-4000-8000-000000000005"])).rejects.toThrow("CONFLICT");
  });
  it("isolates notifications and makes read acknowledgement retry-safe", async () => {
    await actor(a);
    const {rows} = await db.query<{id: string}>("select id from public.notifications limit 1");
    expect(rows).toHaveLength(1);
    const id = rows[0].id;
    await actor(b);
    expect((await db.query("select id from public.notifications where id=$1", [id])).rows).toHaveLength(0);
    await expect(db.query("select public.mark_notification_read($1)", [id])).rejects.toThrow("FORBIDDEN");
    await actor(a);
    await db.query("select public.mark_notification_read($1)", [id]);
    await db.query("select public.mark_notification_read($1)", [id]);
    expect((await db.query<{read_at: string}>("select read_at from public.notifications where id=$1", [id])).rows[0].read_at).toBeTruthy();
  });
  it("staff booking reserves once, denies patient callers and records no-shows", async () => {
    await actor(staff);
    const created = await db.query<{value: {id: string}}>("select public.save_slot(null,$1,'2098-01-01T09:00:00+08:00','2098-01-01T10:00:00+08:00',1,true,null,$2) as value",[service,"92000000-0000-4000-8000-000000000001"]);
    const id = created.rows[0].value.id;
    const args = [a,id,"Patient requested staff assistance","92000000-0000-4000-8000-000000000002"];
    const sql = "select public.staff_request_appointment($1,$2,$3,$4) as value";
    await actor(a);
    await expect(db.query(sql,args)).rejects.toThrow("FORBIDDEN");
    await actor(staff);
    const booked = await db.query<{value: {id: string; updated_at: string}}>(sql,args);
    const replay = await db.query<{value: {id: string}}>(sql,args);
    expect(booked.rows[0].value.id).toBe(replay.rows[0].value.id);
    await expect(db.query(sql,[b,id,"Other request","92000000-0000-4000-8000-000000000003"])).rejects.toThrow("SLOT_FULL");
    const approved = await db.query<{value: {updated_at: string}}>("select public.change_appointment($1,'approve',$2,$3) as value",[booked.rows[0].value.id,"92000000-0000-4000-8000-000000000004",booked.rows[0].value.updated_at]);
    const missed = await db.query<{value: {status: string}}>("select public.change_appointment($1,'no_show',$2,$3,'Synthetic policy decision') as value",[booked.rows[0].value.id,"92000000-0000-4000-8000-000000000005",approved.rows[0].value.updated_at]);
    expect(missed.rows[0].value.status).toBe("no_show");
  });
  it("limits duration reports to staff and bounded cohorts", async () => {
    await actor(a);
    await expect(db.query("select public.operational_durations(now()-interval '1 day',now()+interval '1 day')")).rejects.toThrow("FORBIDDEN");
    await actor(staff);
    await expect(db.query("select public.operational_durations(now()-interval '100 days',now())")).rejects.toThrow("VALIDATION_ERROR");
    const report = await db.query<{value: {decisions: {cohort: number}; queue: {wait_samples: number; service_samples: number}}}>("select public.operational_durations(now()-interval '1 day',now()+interval '1 day') as value");
    expect(report.rows[0].value.decisions.cohort).toBeGreaterThan(0);
    expect(report.rows[0].value.queue.wait_samples).toBe(1);
    expect(report.rows[0].value.queue.service_samples).toBe(1);
  });
  it("keeps inquiry drafts staff-only and publishes replies to the owner", async () => {
    await actor(a);
    const { rows } = await db.query<{ value: { id: string } }>(
      "select public.create_inquiry('Synthetic question','General','Test message',$1) as value",
      ["50000000-0000-4000-8000-000000000001"],
    );
    const id = rows[0].value.id;
    await actor(staff);
    await db.query(
      "select public.reply_inquiry($1,'Private staff draft',false,'in_progress',$2)",
      [id, "50000000-0000-4000-8000-000000000002"],
    );
    await actor(a);
    expect(
      (await db.query("select * from public.inquiry_messages where inquiry_id=$1", [id])).rows,
    ).toHaveLength(1);
    await actor(b);
    expect(
      (await db.query("select * from public.inquiry_messages where inquiry_id=$1", [id])).rows,
    ).toHaveLength(0);
    await actor(staff);
    await db.query(
      "select public.reply_inquiry($1,'Published answer',true,'resolved',$2)",
      [id, "50000000-0000-4000-8000-000000000003"],
    );
    await actor(a);
    expect(
      (await db.query("select * from public.inquiry_messages where inquiry_id=$1", [id])).rows,
    ).toHaveLength(2);
  });
});
