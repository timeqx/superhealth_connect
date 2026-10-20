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
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;`,
  );
  for (const name of [
    "202610200001_foundation.sql",
    "202610200002_workflows.sql",
    "202610200003_accounts_operations.sql",
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
      (await db.query("select * from public.inquiry_messages")).rows,
    ).toHaveLength(1);
    await actor(b);
    expect(
      (await db.query("select * from public.inquiry_messages")).rows,
    ).toHaveLength(0);
    await actor(staff);
    await db.query(
      "select public.reply_inquiry($1,'Published answer',true,'resolved',$2)",
      [id, "50000000-0000-4000-8000-000000000003"],
    );
    await actor(a);
    expect(
      (await db.query("select * from public.inquiry_messages")).rows,
    ).toHaveLength(2);
  });
});
