import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
const patient = "60000000-0000-4000-8000-000000000001";
const other = "60000000-0000-4000-8000-000000000002";
const staff = "60000000-0000-4000-8000-000000000003";
const doc1 = "70000000-0000-4000-8000-000000000001";
const doc2 = "70000000-0000-4000-8000-000000000002";
async function asUser(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
beforeAll(async () => {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;
    create publication supabase_realtime;`);
  for (const name of [
    "202610200001_foundation.sql",
    "202610200002_workflows.sql",
    "202610200003_accounts_operations.sql",
    "202610200004_storage_realtime.sql",
  ])
    await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  await db.query(
    "insert into auth.users values($1,now()),($2,now()),($3,now())",
    [patient, other, staff],
  );
  await db.query("update public.user_roles set role='admin' where user_id=$1", [
    staff,
  ]);
});
afterAll(async () => db.close());
describe("account review and Storage policy SQL with stub Auth/Storage schemas", () => {
  it("requires profile completion and prevents direct patient metadata submission", async () => {
    await asUser(patient);
    await expect(
      db.query("select public.submit_verification($1,$2,$3,'image/png',100)", [
        patient,
        doc1,
        `${patient}/${doc1}.png`,
      ]),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role");
    await expect(
      db.query("select public.submit_verification($1,$2,$3,'image/png',100)", [
        patient,
        doc1,
        `${patient}/${doc1}.png`,
      ]),
    ).rejects.toThrow("VALIDATION_ERROR");
  });
  it("submits a version and freezes pending profile updates", async () => {
    await asUser(patient);
    await db.query(
      "select public.save_profile('Synthetic','','Patient','Others','Sample barangay','+639171234567')",
    );
    await db.exec("reset role");
    await db.query(
      "select public.submit_verification($1,$2,$3,'image/png',100)",
      [patient, doc1, `${patient}/${doc1}.png`],
    );
    await db.query(
      "insert into storage.objects(bucket_id,name) values('verification',$1)",
      [`${patient}/${doc1}.png`],
    );
    await asUser(patient);
    expect(
      (
        await db.query<{ review_status: string; review_version: number }>(
          "select review_status,review_version from public.profiles",
        )
      ).rows[0],
    ).toEqual({ review_status: "pending", review_version: 1 });
    await expect(
      db.query(
        "select public.save_profile('Changed','','Patient','Others','Sample barangay','+639171234567')",
      ),
    ).rejects.toThrow("INVALID_TRANSITION");
  });
  it("isolates private metadata and Storage objects and denies browser uploads", async () => {
    await asUser(patient);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      1,
    );
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('verification',$1)",
        [`${patient}/bypass.png`],
      ),
    ).rejects.toThrow("row-level security");
    await asUser(other);
    expect(
      (await db.query("select * from public.verification_documents")).rows,
    ).toHaveLength(0);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    await asUser(staff);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      1,
    );
  });
  it("rejects self approval, stale document review, and rejection without a reason", async () => {
    await asUser(patient);
    await expect(
      db.query(
        "select public.review_account($1,$2,'approved','',gen_random_uuid())",
        [patient, doc1],
      ),
    ).rejects.toThrow("FORBIDDEN");
    await asUser(staff);
    await expect(
      db.query(
        "select public.review_account($1,$2,'approved','',gen_random_uuid())",
        [patient, doc2],
      ),
    ).rejects.toThrow("CONFLICT");
    await expect(
      db.query(
        "select public.review_account($1,$2,'rejected','',gen_random_uuid())",
        [patient, doc1],
      ),
    ).rejects.toThrow("VALIDATION_ERROR");
    await db.query(
      "select public.review_account($1,$2,'rejected','Please submit a readable synthetic image.',gen_random_uuid())",
      [patient, doc1],
    );
  });
  it("keeps version history and approves only the corrected version", async () => {
    await asUser(patient);
    await db.query(
      "select public.save_profile('Synthetic','','Patient','Others','Sample barangay','+639171234567')",
    );
    await db.exec("reset role");
    await db.query(
      "select public.submit_verification($1,$2,$3,'image/png',120)",
      [patient, doc2, `${patient}/${doc2}.png`],
    );
    await asUser(staff);
    await expect(
      db.query(
        "select public.review_account($1,$2,'approved','',gen_random_uuid())",
        [patient, doc1],
      ),
    ).rejects.toThrow("CONFLICT");
    const key = "80000000-0000-4000-8000-000000000001";
    await db.query("select public.review_account($1,$2,'approved','',$3)", [
      patient,
      doc2,
      key,
    ]);
    await db.query("select public.review_account($1,$2,'approved','',$3)", [
      patient,
      doc2,
      key,
    ]);
    await asUser(patient);
    const { rows } = await db.query<{
      review_status: string;
      review_version: number;
      current_document_id: string;
    }>(
      "select review_status,review_version,current_document_id from public.profiles",
    );
    expect(rows[0]).toEqual({
      review_status: "approved",
      review_version: 2,
      current_document_id: doc2,
    });
    expect(
      (await db.query("select * from public.verification_documents")).rows,
    ).toHaveLength(2);
    expect(
      (
        await db.query(
          "select * from public.notifications where type='account_approved'",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("denies documents and decisions to disabled staff", async () => {
    await db.exec("reset role");
    await db.query(
      "update public.user_roles set disabled_at=now() where user_id=$1",
      [staff],
    );
    await asUser(staff);
    expect((await db.query("select * from storage.objects")).rows).toHaveLength(
      0,
    );
    await expect(
      db.query(
        "select public.review_account($1,$2,'approved','',gen_random_uuid())",
        [patient, doc2],
      ),
    ).rejects.toThrow("FORBIDDEN");
  });
});
