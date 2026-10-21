import env from "@next/env";
import pg from "pg";

env.loadEnvConfig(process.cwd());
const args = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(name);
  return index === -1 ? "" : (args[index + 1] ?? "");
}
const userId = option("--user");
const employeeId = option("--employee");
const operator = option("--operator");
if (
  !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(userId) ||
  !employeeId.trim() ||
  employeeId.length > 80 ||
  !operator.trim() ||
  operator.length > 100
) {
  console.error(
    "Usage: npm run staff:provision -- --user UUID --employee STAFF-ID --operator OPERATOR-NAME [--apply]",
  );
  process.exit(1);
}
if (!process.env.STAFF_DATABASE_URL) {
  console.error(
    "Set STAFF_DATABASE_URL in your local environment to an operator PostgreSQL connection. Do not put it on the command line.",
  );
  process.exit(1);
}
const client = new pg.Client({
  connectionString: process.env.STAFF_DATABASE_URL,
  connectionTimeoutMillis: 10000,
});
try {
  await client.connect();
  await client.query("begin");
  const { rows } = await client.query(
    "select r.role, r.disabled_at, u.email_confirmed_at from public.user_roles r join auth.users u on u.id=r.user_id where r.user_id=$1 for update of r",
    [userId],
  );
  if (!rows.length || !rows[0].email_confirmed_at)
    throw new Error("USER_NOT_READY");
  if (!args.includes("--apply")) {
    await client.query("rollback");
    console.log(
      "Dry run passed: verified account exists. Add --apply to provision staff on the configured database.",
    );
  } else {
    await client.query(
      "update public.user_roles set role='admin',employee_id=$2,disabled_at=null,provisioned_at=now(),provisioned_by=$3 where user_id=$1",
      [userId, employeeId.trim(), operator.trim()],
    );
    await client.query(
      "insert into public.audit_logs(action,entity_type,entity_id,metadata) values('provision_staff','user_role',$1,jsonb_build_object('operator',$2::text,'previous_role',$3::text,'previously_disabled',$4::boolean))",
      [userId, operator.trim(), rows[0].role, Boolean(rows[0].disabled_at)],
    );
    await client.query("commit");
    console.log(
      "Staff role provisioned and audited. Sign in through the normal sign-in page.",
    );
  }
} catch (error) {
  await client.query("rollback").catch(() => {});
  // Fixed messages only: raw PostgreSQL/network errors can contain credentials,
  // connection details or account data.
  const guidance = {
    ENOTFOUND: "Database hostname could not be resolved. If using Supabase's IPv6 direct endpoint, copy Connect > Session pooler into STAFF_DATABASE_URL for IPv4 access. Copy its full host AND username.",
    EAI_AGAIN: "Database DNS lookup temporarily failed. Check DNS/network availability before retrying.",
    ENETUNREACH: "Database network is unreachable. Use Supabase Connect > Session pooler on an IPv4-only network.",
    ECONNREFUSED: "Database connection refused. Check the copied host/port and whether the project is running.",
    ETIMEDOUT: "Database connection timed out. Check network access, project availability and database network restrictions.",
    "28P01": "Database password authentication failed. Use the database password (not an API key), percent-encode reserved characters, and copy the username from Connect.",
    "42501": "Operator database role lacks permission. Use an authorized provisioning connection; do not disable RLS.",
    "42P01": "Required database tables are missing. Check the selected project and installed migrations.",
    "42703": "Required database columns are missing. Check that the repository migrations are installed.",
    SELF_SIGNED_CERT_IN_CHAIN: "TLS certificate verification failed. Configure the trusted database CA; do not disable certificate verification.",
  };
  const message = error.message === "USER_NOT_READY"
    ? "The account does not exist in user_roles or its email is unverified. Confirm the account and foundation migration."
    : guidance[error.code] ?? (/timeout/i.test(error.message ?? "")
      ? "Connection timed out. Check database endpoint, network reachability and project availability."
      : "Check the operator connection, database schema and permissions. Sensitive error details were withheld.");
  console.error(`Provisioning stopped: ${message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
