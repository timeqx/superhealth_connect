import env from "@next/env";
import pg from "pg";

env.loadEnvConfig(process.cwd());
const send = process.argv.includes("--send");
const connectionString = process.env.EMAIL_DATABASE_URL;
if (!connectionString) { console.error("Set server-only EMAIL_DATABASE_URL. No messages sent."); process.exit(1); }
const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10000, statement_timeout: 15000 });
try {
  if (send && (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !process.env.APP_URL)) throw new Error("CONFIG");
  const origin = new URL(process.env.APP_URL || "http://localhost:3000");
  if (send && origin.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(origin.hostname)) throw new Error("CONFIG");
  await client.connect();
  if (!send) {
    const { rows } = await client.query("select state,count(*)::int as count from public.email_outbox group by state order by state");
    console.log(JSON.stringify({ mode: "read-only", counts: rows }));
  } else {
    // Never retry beyond the provider's 24-hour deduplication window. An operator
    // must reconcile these ambiguous messages with the provider before replaying.
    await client.query(`update public.email_outbox set state='failed',last_error='RECONCILE_REQUIRED'
      where state in ('pending','claimed') and claimed_at < now()-interval '23 hours'`);
    for (let index = 0; index < 20; index++) {
      const { rows } = await client.query(`update public.email_outbox set state='claimed',
        attempt_count=attempt_count+1,claimed_at=coalesce(claimed_at,now()),available_at=now()+interval '2 minutes'
        where id=(select id from public.email_outbox where state in ('pending','claimed')
          and available_at<=now() and attempt_count<5 order by available_at,id for update skip locked limit 1)
        returning id,notification_id,attempt_count`);
      const job = rows[0]; if (!job) break;
      let providerId;
      let failure = "DELIVERY_INTERRUPTED";
      let terminal = false;
      try {
        const recipient = await client.query(`select u.email from public.notifications n
          join auth.users u on u.id=n.recipient_id join public.user_roles r on r.user_id=u.id
          where n.id=$1 and r.disabled_at is null and u.email_confirmed_at is not null`, [job.notification_id]);
        if (!recipient.rows[0]?.email) { terminal = true; throw new Error("RECIPIENT_UNAVAILABLE"); }
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST", signal: AbortSignal.timeout(15000),
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `care-notification/${job.id}` },
          body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [recipient.rows[0].email], subject: "An update is available in SuperHealth Connect", text: `You have an account update. Sign in to view it securely:\n${new URL("/patient/notifications", origin.origin).href}\n\nThis email contains no medical or identity document details.` }),
        });
        if (!response.ok) { failure = `PROVIDER_HTTP_${response.status}`; terminal = response.status < 500 && ![408, 429].includes(response.status); throw new Error(failure); }
        const result = await response.json();
        if (typeof result.id !== "string") throw new Error("INVALID_RECEIPT");
        providerId = result.id;
      } catch { /* Store only fixed error codes; never provider bodies or addresses. */ }
      if (providerId) {
        await client.query("update public.email_outbox set state='sent',sent_at=now(),provider_message_id=$2,last_error=null where id=$1 and attempt_count=$3 and state='claimed'", [job.id, providerId, job.attempt_count]);
      } else {
        await client.query(`update public.email_outbox set state=$2,last_error=$3,
          available_at=now()+($4 * interval '1 minute') where id=$1 and attempt_count=$5 and state='claimed'`,
        [job.id, terminal || job.attempt_count >= 5 ? "failed" : "pending", failure, 2 ** job.attempt_count, job.attempt_count]);
      }
      console.log(providerId ? "Email accepted by provider." : "Email deferred or held for review.");
    }
    await client.query("update public.email_outbox set state='failed',last_error='RECONCILE_REQUIRED' where state='claimed' and attempt_count>=5 and available_at<=now()");
  }
} catch {
  console.error("Email worker stopped. Check server configuration and database/provider availability; no sensitive error details are logged.");
  process.exitCode = 1;
} finally { await client.end(); }
