import test from "node:test";
import assert from "node:assert/strict";
import { processOutbox } from "./email-delivery.mjs";

function fixture(attempt = 1, eligible = true) {
  const writes = [];
  let claimed = false;
  return { writes, client: { async query(sql, args) {
    if (sql.includes("returning id,notification_id")) {
      if (claimed) return { rows: [] };
      claimed = true;
      return { rows: [{ id: "synthetic-job", notification_id: "synthetic-notice", attempt_count: attempt }] };
    }
    if (sql.includes("select u.email")) return { rows: eligible ? [{ email: "synthetic@example.invalid" }] : [] };
    writes.push({ sql, args }); return { rows: [] };
  } } };
}
const options = { origin: new URL("https://example.invalid"), apiKey: "synthetic", sender: "test@example.invalid" };
test("retries an interrupted provider response with a stable idempotency key", async () => {
  const keys = [];
  const first = fixture();
  await processOutbox({ ...options, client: first.client, deliver: async (_url, init) => { keys.push(init.headers["Idempotency-Key"]); throw new Error("private provider response"); } });
  assert.equal(first.writes.find(w => w.args?.[1] === "pending").args[2], "DELIVERY_INTERRUPTED");
  const second = fixture(2);
  await processOutbox({ ...options, client: second.client, deliver: async (_url, init) => { keys.push(init.headers["Idempotency-Key"]); return Response.json({ id: "provider-receipt" }); } });
  assert.equal(keys[0], keys[1]);
  assert.ok(second.writes.some(w => w.sql.includes("state='sent'") && w.args[1] === "provider-receipt"));
});
test("holds permanent failures and exhausted retries without storing response bodies", async () => {
  for (const [attempt, status] of [[1,422],[5,503]]) {
    const f = fixture(attempt);
    await processOutbox({ ...options, client: f.client, deliver: async () => new Response("sensitive response", { status }) });
    assert.ok(f.writes.some(w => w.args?.[1] === "failed"));
    assert.ok(!JSON.stringify(f.writes).includes("sensitive response"));
  }
});
test("does not contact the provider for an ineligible recipient", async () => {
  const f = fixture(1,false);
  await processOutbox({ ...options, client: f.client, deliver: async () => { assert.fail("must not send"); } });
  assert.ok(f.writes.some(w => w.args?.[2] === "RECIPIENT_UNAVAILABLE"));
});
