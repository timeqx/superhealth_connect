# SuperHealth Connect

Appointment scheduling and queue management for Batasan Hills Super Health Center.
Built with Next.js, React, TypeScript and Supabase.

## Local development

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. In PowerShell, use `npm.cmd` if script execution is restricted.

Copy `.env.example` to `.env.local` and configure these values. Keep an existing
`.env` if it already contains your configuration; `.env.local` takes precedence.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public application key |
| `SUPABASE_SECRET_KEY` | Server-only key for private verification uploads |
| `APP_URL` | Application origin; `http://localhost:3000` locally |
| `STAFF_DATABASE_URL` | Operator connection for staff provisioning |
| `EMAIL_DATABASE_URL` | Notification worker database connection |
| `RESEND_API_KEY` | Notification email provider key |
| `EMAIL_FROM` | Verified notification sender |
| `APPOINTMENT_REVIEW_HOURS` | Optional review deadline; blank disables overdue alerts |
| `TEST_DATABASE_URL` | Optional disposable local test database |

Restart the server after changing environment variables. Without Supabase configuration,
account and service pages display an unavailable message. Keep secret keys and database
connections server-side; never commit environment files.

## Database and authentication

For a local Supabase instance, install the Supabase CLI and a Docker-compatible runtime:

```sh
supabase start
supabase db reset
supabase status
```

Run `db reset` only against a disposable local database. It applies the migrations
and draft service catalog in `supabase/`. Use the local URL and keys from `supabase status`.
Local verification emails are available on port 54324.

An existing hosted project needs all migrations in `supabase/migrations/`, including
the private `verification` storage bucket. Apply hosted migrations through your database
release process. Service seeds are unpublished; staff must configure services and sessions.

Keep email confirmation enabled. Allow `APP_URL/auth/callback` in Supabase Auth redirect
URLs and configure Auth SMTP for signup and password recovery. Verification links must
open in the same browser profile that started registration. Email verification and staff
account approval are separate steps. Patients enter their name and barangay, then their
mobile number and an optional QC ID file, before creating their email and password. A
selected file is submitted after email confirmation; a skipped file can be uploaded later
from the profile. Patients can sign in after email confirmation, while appointment requests
remain blocked until staff approves the QC ID.

To provision an existing email-confirmed staff account, configure `STAFF_DATABASE_URL`:

```sh
npm run staff:provision -- --user USER-UUID --employee STAFF-001 --operator OPERATOR
```

The command defaults to a dry run. Add `--apply` to save the role and audit entry.
Staff sign in through the regular sign-in page.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route types and TypeScript validation |
| `npm test` | Application unit tests |
| `npm run test:db` | Database workflow and authorization tests |
| `npm run test:email` | Notification delivery tests |
| `npm run test:e2e` | Public browser tests |
| `npm run test:e2e:auth` | Authenticated local browser tests |
| `npm run db:types` | Generate types from local Supabase |
| `npm run email:worker` | Inspect notification delivery status |

Install the browser runtime with `npx playwright install chromium` before running
browser tests. Database tests use embedded PostgreSQL with Auth and Storage stubs;
they do not verify hosted services or simultaneous database connections. Use test
accounts and documents for development.

## Project layout

- `src/app`: routes, layouts and pages.
- `src/features`: account, appointment, queue, inquiry and staff workflows.
- `src/shared`: shared UI, utilities and Supabase clients.
- `src/server`: session and server-action helpers.
- `supabase`: schema migrations, seeds and database tests.
- `scripts`: staff provisioning and notification delivery.
- `tests`: browser tests.

See [operations](docs/OPERATIONS.md) for staff workflows, email delivery and authenticated
test setup. Production use requires authentication, private upload, delivery and concurrency
acceptance checks, plus center approval of service policies and privacy practices.
