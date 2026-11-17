import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const db = new PGlite();
const staff = randomUUID();
const patients = Array.from({ length: 4 }, () => randomUUID());
const legacyService = randomUUID();
const legacySlot = randomUUID();
const everyDay = [0, 1, 2, 3, 4, 5, 6];
const definitionSql = "select public.save_service_definition($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as value";
const scheduleSql = "select public.save_service_schedule($1,$2,$3,$4,$5,$6,$7,$8) as value";

type Service = {
  id: string;
  slug: string;
  opening_time: string;
  closing_time: string;
  slot_duration_minutes: number;
  slot_capacity: number;
  weekdays: number[];
  is_published: boolean;
  updated_at: string;
};
type Slot = {
  id: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  is_open: boolean;
  updated_at: string;
};
type Appointment = { id: string; updated_at: string };

async function actor(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}

function definitionArgs(open = "08:00", close = "10:00", duration = 30, capacity = 3, days = everyDay) {
  return [null, "Synthetic time slots", `slots-${randomUUID()}`, "Test appointments", null, randomUUID(), open, close, duration, capacity, days];
}

async function createService(open = "08:00", close = "10:00", duration = 30, capacity = 3, days = everyDay) {
  await actor(staff);
  const created = await db.query<{ value: Service }>(definitionSql, definitionArgs(open, close, duration, capacity, days));
  const service = created.rows[0].value;
  await db.query("select public.update_service($1,true,true,'Test requirements',15)", [service.id]);
  await db.query("select public.ensure_service_sessions($1)", [service.id]);
  return (await db.query<Service>("select *,updated_at::text from public.services where id=$1", [service.id])).rows[0];
}

async function daySlots(service: string, offset: number) {
  return (await db.query<Slot>(
    `select id,starts_at::text,ends_at::text,capacity,is_open,updated_at::text
     from public.service_slots where service_id=$1
       and (starts_at at time zone 'Asia/Manila')::date=(now() at time zone 'Asia/Manila')::date+$2::integer
     order by starts_at`, [service, offset],
  )).rows;
}

beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;
    grant execute on function auth.uid() to anon,authenticated;
    create publication supabase_realtime;`);
  for (const name of [
    "202610200001_foundation.sql",
    "202610200002_workflows.sql",
    "202610200003_accounts_operations.sql",
    "20261021064654_staff_management.sql",
    "202610300002_recurring_schedules.sql",
  ]) await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  for (const id of [staff, ...patients]) await db.query("insert into auth.users values($1,now())", [id]);
  await db.query("update public.user_roles set role='admin' where user_id=$1", [staff]);
  await db.exec("update public.profiles set review_status='approved'");
  await db.query("insert into public.services(id,slug,name,description,is_published,is_bookable) values($1,'legacy','Legacy service','Test legacy schedule',true,true)", [legacyService]);
  await db.query(`insert into public.service_slots(id,service_id,starts_at,ends_at,capacity,schedule_date)
    values($1,$2,((now() at time zone 'Asia/Manila')::date+1+time '08:00') at time zone 'Asia/Manila',
    ((now() at time zone 'Asia/Manila')::date+1+time '17:00') at time zone 'Asia/Manila',10,(now() at time zone 'Asia/Manila')::date+1)`, [legacySlot, legacyService]);
  await db.exec(readFileSync("supabase/migrations/202611160001_appointment_time_slots.sql", "utf8"));
});

afterAll(async () => db.close());

describe("service appointment time slots (embedded PostgreSQL)", () => {
  it("preserves existing daily schedules and sessions during migration", async () => {
    await actor(staff);
    const service = (await db.query<Service>("select * from public.services where id=$1", [legacyService])).rows[0];
    expect(service.slot_duration_minutes).toBe(540);
    expect(service.slot_capacity).toBe(10);
    await db.query("select public.ensure_service_sessions($1)", [legacyService]);
    expect(await daySlots(legacyService, 1)).toMatchObject([{ id: legacySlot, capacity: 10 }]);
  });

  it("creates schedule settings atomically, replays creation, and preserves them during details edits", async () => {
    const args = definitionArgs("09:00", "12:00", 20, 3, [1, 3, 5]);
    await actor(patients[0]);
    await expect(db.query(definitionSql, args)).rejects.toThrow("FORBIDDEN");
    await actor(staff);
    const created = (await db.query<{ value: Service }>(definitionSql, args)).rows[0].value;
    expect(created).toMatchObject({ opening_time: "09:00:00", closing_time: "12:00:00", slot_duration_minutes: 20, slot_capacity: 3, weekdays: [1, 3, 5], is_published: false });
    const replay = (await db.query<{ value: Service }>(definitionSql, args)).rows[0].value;
    expect(replay.id).toBe(created.id);
    const edited = (await db.query<{ value: Service }>("select public.save_service_definition($1,'Updated service',$2,'Updated description',$3,$4) as value", [created.id, created.slug, created.updated_at, randomUUID()])).rows[0].value;
    expect(edited).toMatchObject({ opening_time: "09:00:00", closing_time: "12:00:00", slot_duration_minutes: 20, slot_capacity: 3, weekdays: [1, 3, 5] });
    expect((await db.query("select id from public.service_slots where service_id=$1", [created.id])).rows).toHaveLength(0);
  });

  it("generates every full time slot with its own capacity and keeps generation idempotent", async () => {
    const service = await createService();
    const slots = await daySlots(service.id, 1);
    expect(slots).toHaveLength(4);
    const times = (await db.query<{ start: string; end: string; capacity: number }>(
      "select (starts_at at time zone 'Asia/Manila')::time::text as start,(ends_at at time zone 'Asia/Manila')::time::text as end,capacity from public.service_slots where id=any($1) order by starts_at", [slots.map(slot => slot.id)],
    )).rows;
    expect(times).toEqual([
      { start: "08:00:00", end: "08:30:00", capacity: 3 },
      { start: "08:30:00", end: "09:00:00", capacity: 3 },
      { start: "09:00:00", end: "09:30:00", capacity: 3 },
      { start: "09:30:00", end: "10:00:00", capacity: 3 },
    ]);
    await actor(patients[0]);
    await db.query("select public.ensure_service_sessions($1)", [service.id]);
    expect(await daySlots(service.id, 1)).toEqual(slots);
  });

  it("makes all 30 days available even when there are more than 180 time slots", async () => {
    const service = await createService("08:00", "17:00");
    const available = (await db.query<{ id: string }>("select * from public.slot_availability($1)", [service.id])).rows;
    expect(available.length).toBeGreaterThanOrEqual(540);
    const lastDay = await daySlots(service.id, 30);
    expect(lastDay).toHaveLength(18);
    expect(available.map(slot => slot.id)).toEqual(expect.arrayContaining(lastDay.map(slot => slot.id)));
  });

  it("does not generate a shortened appointment beyond the last full interval", async () => {
    const service = await createService("09:00", "10:20");
    const slots = await daySlots(service.id, 1);
    expect(slots).toHaveLength(2);
    expect(slots.every(slot => new Date(slot.ends_at).getTime() - new Date(slot.starts_at).getTime() === 30 * 60 * 1000)).toBe(true);
    const last = (await db.query<{ end: string }>("select (ends_at at time zone 'Asia/Manila')::time::text as end from public.service_slots where id=$1", [slots[1].id])).rows[0];
    expect(last.end).toBe("10:00:00");
  });

  it("offers today's later slots even after opening time has passed", async () => {
    const service = await createService("00:00", "23:59", 30);
    const actual = await daySlots(service.id, 0);
    const expected = (await db.query<{ start: string }>(
      `select start::text from generate_series(
        ((now() at time zone 'Asia/Manila')::date+time '00:00') at time zone 'Asia/Manila',
        ((now() at time zone 'Asia/Manila')::date+time '23:00') at time zone 'Asia/Manila',
        interval '30 minutes') as start where start>now() order by start`,
    )).rows;
    expect(actual.map(slot => slot.starts_at)).toEqual(expected.map(slot => slot.start));
  });

  it("allows three people at the same time, blocks a fourth, and releases cancelled capacity", async () => {
    const service = await createService();
    const [slot] = await daySlots(service.id, 1);
    let first: Appointment | undefined;
    for (const patient of patients.slice(0, 3)) {
      await actor(patient);
      const booked = (await db.query<{ value: Appointment }>("select public.request_appointment($1,$2) as value", [slot.id, randomUUID()])).rows[0].value;
      first ??= booked;
    }
    await actor(patients[3]);
    await expect(db.query("select public.request_appointment($1,$2)", [slot.id, randomUUID()])).rejects.toThrow("SLOT_FULL");
    expect((await db.query<{ remaining: number }>("select remaining from public.slot_availability($1) where id=$2", [service.id, slot.id])).rows[0].remaining).toBe(0);
    await actor(patients[0]);
    await db.query("select public.change_appointment($1,'cancel',$2,$3,'Patient cancelled')", [first!.id, randomUUID(), first!.updated_at]);
    expect((await db.query<{ remaining: number }>("select remaining from public.slot_availability($1) where id=$2", [service.id, slot.id])).rows[0].remaining).toBe(1);
    await actor(patients[3]);
    await expect(db.query("select public.request_appointment($1,$2)", [slot.id, randomUUID()])).resolves.toBeDefined();
  });

  it("rebuilds empty dates while preserving dates with appointments, closed overrides, or manual sessions", async () => {
    const service = await createService();
    const bookedDay = await daySlots(service.id, 1);
    const overrideDay = await daySlots(service.id, 2);
    const manualDay = await daySlots(service.id, 3);
    await actor(patients[0]);
    const appointment = (await db.query<{ value: Appointment }>("select public.request_appointment($1,$2) as value", [bookedDay[0].id, randomUUID()])).rows[0].value;
    await db.query("select public.change_appointment($1,'cancel',$2,$3,'Keep history')", [appointment.id, randomUUID(), appointment.updated_at]);
    await actor(staff);
    await db.query("select public.save_slot($1,$2,$3,$4,3,false,$5,$6)", [overrideDay[0].id, service.id, overrideDay[0].starts_at, overrideDay[0].ends_at, overrideDay[0].updated_at, randomUUID()]);
    await db.query(`select public.save_slot(null,$1,
      ((now() at time zone 'Asia/Manila')::date+3+time '12:00') at time zone 'Asia/Manila',
      ((now() at time zone 'Asia/Manila')::date+3+time '13:00') at time zone 'Asia/Manila',2,true,null,$2)`, [service.id, randomUUID()]);
    const overridesBefore = await daySlots(service.id, 2);
    const manualBefore = await daySlots(service.id, 3);
    expect(manualBefore).toHaveLength(manualDay.length + 1);
    const args = [service.id, "09:00", "12:00", 60, 2, everyDay, service.updated_at, randomUUID()];
    await actor(patients[0]);
    await expect(db.query(scheduleSql, args)).rejects.toThrow("FORBIDDEN");
    await actor(staff);
    await db.query(scheduleSql, args);
    await db.query(scheduleSql, args);
    expect(await daySlots(service.id, 1)).toEqual(bookedDay);
    expect(await daySlots(service.id, 2)).toEqual(overridesBefore);
    expect(await daySlots(service.id, 3)).toEqual(manualBefore);
    const emptyDay = await daySlots(service.id, 4);
    expect(emptyDay).toHaveLength(3);
    expect(emptyDay.every(slot => slot.capacity === 2 && new Date(slot.ends_at).getTime() - new Date(slot.starts_at).getTime() === 60 * 60 * 1000)).toBe(true);
    await expect(db.query(scheduleSql, [...args.slice(0, 7), randomUUID()])).rejects.toThrow("CONFLICT");
  });

  it("generates only selected weekdays and allows an empty weekday list to pause recurring slots", async () => {
    const service = await createService("08:00", "10:00", 30, 3, [1, 3, 5]);
    const days = (await db.query<{ day: number }>("select distinct extract(dow from starts_at at time zone 'Asia/Manila')::integer as day from public.service_slots where service_id=$1 order by day", [service.id])).rows;
    expect(days.map(day => day.day)).toEqual([1, 3, 5]);
    await db.query(scheduleSql, [service.id, "08:00", "10:00", 30, 3, [], service.updated_at, randomUUID()]);
    expect((await db.query("select id from public.service_slots where service_id=$1 and (starts_at at time zone 'Asia/Manila')::date>(now() at time zone 'Asia/Manila')::date", [service.id])).rows).toHaveLength(0);
  });

  it("preserves intermediate reschedule dates that remain referenced only by appointment events", async () => {
    const service = await createService();
    const [original] = await daySlots(service.id, 1);
    const intermediateDay = await daySlots(service.id, 2);
    const [current] = await daySlots(service.id, 3);
    await actor(patients[0]);
    let appointment = (await db.query<{ value: Appointment }>("select public.request_appointment($1,$2) as value", [original.id, randomUUID()])).rows[0].value;
    for (const target of [intermediateDay[0], current]) {
      appointment = (await db.query<{ value: Appointment }>("select public.change_appointment($1,'reschedule',$2,$3,null,$4) as value", [appointment.id, randomUUID(), appointment.updated_at, target.id])).rows[0].value;
    }
    expect((await db.query("select id from public.appointments where slot_id=$1 or original_slot_id=$1 or suggested_slot_id=$1", [intermediateDay[0].id])).rows).toHaveLength(0);
    await actor(staff);
    await db.query(scheduleSql, [service.id, "09:00", "12:00", 60, 2, everyDay, service.updated_at, randomUUID()]);
    expect(await daySlots(service.id, 2)).toEqual(intermediateDay);
  });

  it("denies anonymous mutations and patient access to generating all services", async () => {
    await actor(patients[0]);
    await expect(db.query("select public.ensure_service_sessions(null)")).rejects.toThrow("FORBIDDEN");
    await db.exec("reset role;select set_config('request.jwt.claim.sub','',false);set role anon");
    await expect(db.query(definitionSql, definitionArgs())).rejects.toThrow("permission denied");
    await expect(db.query("select public.ensure_service_sessions($1)", [legacyService])).rejects.toThrow("permission denied");
    await expect(db.query(scheduleSql, [legacyService, "08:00", "10:00", 30, 3, everyDay, "2000-01-01", randomUUID()])).rejects.toThrow("permission denied");
  });

  it("requires schedule settings when creating a service", async () => {
    await actor(staff);
    await expect(db.query("select public.save_service_definition(null,'Missing schedule','missing-schedule','Missing schedule settings',null,$1)", [randomUUID()])).rejects.toThrow("VALIDATION_ERROR");
    expect((await db.query("select id from public.services where slug='missing-schedule'")).rows).toHaveLength(0);
  });

  it.each([
    ["10:00", "09:00", 30, 3, everyDay],
    ["08:00", "09:00", 0, 3, everyDay],
    ["08:00", "09:00", 61, 3, everyDay],
    ["08:00", "09:00", 30, 0, everyDay],
    ["08:00", "09:00", 30, 501, everyDay],
    ["08:00", "09:00", 30, 3, [7]],
    ["08:00", "09:00", null, 3, everyDay],
    ["08:00", "09:00", 30, 3, null],
    ["08:00", "09:00", 30, 3, [null]],
  ])("rejects invalid schedule settings (%s–%s, %s minutes, capacity %s)", async (open, close, duration, capacity, days) => {
    await actor(staff);
    const args = [null, "Invalid schedule", `invalid-${randomUUID()}`, "Test validation", null, randomUUID(), open, close, duration, capacity, days];
    await expect(db.query(definitionSql, args)).rejects.toThrow("VALIDATION_ERROR");
    expect((await db.query("select id from public.services where slug=$1", [args[2]])).rows).toHaveLength(0);
  });
});
