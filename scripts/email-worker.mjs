import { processOutbox } from "./email-delivery.mjs";
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
    await processOutbox({ client, origin, apiKey: process.env.RESEND_API_KEY, sender: process.env.EMAIL_FROM, log: console.log });
  }
} catch {
  console.error("Email worker stopped. Check server configuration and database/provider availability; no sensitive error details are logged.");
  process.exitCode = 1;
} finally { await client.end(); }
