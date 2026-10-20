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
  console.error(
    error.message === "USER_NOT_READY"
      ? "Provisioning stopped: the account does not exist or its email is unverified."
      : "Provisioning failed. Check the operator connection, database schema, and permissions. No credentials or database response were logged.",
  );
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
