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
| `SUPABASE_SECRET_KEY` | Server-only key for private verification uploads and staff account creation |
| `APP_URL` | Application origin; `http://localhost:3000` locally |
| `STAFF_DATABASE_URL` | Operator connection for staff and admin provisioning |
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
and default service catalog in `supabase/`. Use the local URL and keys from `supabase status`.
Local verification emails are available on port 54324.

An existing hosted project needs all migrations in `supabase/migrations/`, including
the private `verification` storage bucket. Apply hosted migrations through your database
release process. The default catalog contains General Consultation, Pre-natal, Dental,
Laboratory, Family Planning, TB DOTS, and Immunizations (NIP), published and enabled for
booking. Booking still requires an open session with capacity. Admins can temporarily
disable booking or hide a service in Services & schedules. The catalog migration retires
the original demonstration services, including Animal Bite, while preserving history.
New services include available days, opening/closing times, session duration and
patient slots per session. For example, 8 AM–4 PM with one-hour sessions and capacity 6
creates eight sessions (8–9 AM, 9–10 AM, through 3–4 PM), each accepting six separate
patients, for 48 patients that day. The creation form previews every session and its
capacity. Patients choose one session; filling it does not fill the other sessions. Only complete intervals
are created; leftover minutes before closing are not offered. Creation defaults to
Monday–Friday, 8 AM–5 PM Asia/Manila, 30-minute slots and one patient per slot. New
services remain drafts until an admin publishes them and enables online booking.
Authenticated booking and schedule pages prepare a rolling 30-day window, including
today's future slots, so no cron job is required. Pending requests reserve a place;
cancelled or rejected requests release it. Regular schedule edits rebuild empty future
dates while preserving whole dates with appointment history, manual sessions or individual
overrides. Close individual slots in Sessions, or disable online booking to pause a service.
Apply all migrations, including `202611160001_appointment_time_slots.sql`, before deploying
the updated pages. The migration retains existing services' full-day slots and capacity;
admins can choose a shorter session duration under Services when ready.

Portal navigation badges require `202611180006_portal_badges.sql`. Notifications count
unread updates; Inquiries counts conversations with unread incoming messages for each
signed-in user. Opening a conversation marks its displayed updates and matching patient
notifications as read. Private drafts do not count. Requests and Accounts count all pending
decisions, including items on other pages; opening those tabs does not clear their counts.
Accounts remains available only to admins. Zero counts are hidden, and existing live updates
refresh the badges as messages arrive or staff approve or decline submissions.
The patient Notifications page also offers **Mark all as read**, covering every page
and refreshing the unread badge. Apply `202611180007_mark_all_notifications_read.sql`
to enable this action.

Keep email confirmation enabled. Allow `APP_URL/auth/callback` in Supabase Auth redirect
URLs and configure Auth SMTP for signup and password recovery. Verification links must
open in the same browser profile that started registration. Email verification and admin
account approval are separate steps. Patients enter their name and barangay, then their
mobile number and an optional QC ID file, before creating their email and password. A
selected file is submitted after email confirmation; a skipped file can be uploaded later
from the profile. Patients can sign in after email confirmation, while appointment requests
remain blocked until an admin approves the QC ID.

The application has three roles: `patient`, `staff`, and `admin`. Staff and admins
share `/staff/sign-in` and the same `/admin` portal. Staff can access Requests,
Queue, Inquiries, and Reports. Admins can access every existing portal tab,
including History, Accounts, Staff, and Schedules, plus patient booking and audit pages.
Patients keep their existing portal and access.

Apply `202611180001_staff_roles.sql` and all earlier migrations before deploying
this role split or provisioning a new staff account. Existing staff-portal
accounts are already stored as `admin` and retain full access; no reprovisioning
is needed.

Admins can create staff and admin accounts in the **Staff** tab at `/admin/staff`.
Enter the person's name, email, password, optional employee ID, and role. These
accounts can sign in immediately at `/staff/sign-in`; no confirmation email is
sent or required. Give the account holder their sign-in details directly. Patient
registration continues to require email confirmation.

The same tab lists staff and admin accounts and lets admins switch active accounts
between those two roles. The last active admin cannot be changed to staff.
Disabled accounts cannot be reactivated or edited here. Creation and role changes
are audited, and passwords are never included in those audit entries.

Apply `202611180002_staff_account_management.sql` after the role migration and
configure the server-only `SUPABASE_SECRET_KEY` before creating accounts from the
portal. Listing accounts and changing roles use the signed-in admin's database
permissions; they do not require the secret key.

For initial admin setup or operator recovery, provision an existing email-confirmed
account using `STAFF_DATABASE_URL`:

```sh
npm run staff:provision -- --user USER-UUID --employee STAFF-001 --operator OPERATOR
npm run staff:provision -- --user USER-UUID --employee ADMIN-001 --operator OPERATOR --role admin
```

The command defaults to the `staff` role and a dry run. Use `--role admin` for full
portal access and add `--apply` to save the role and audit entry. When updating an
existing admin, specify `--role admin` to retain access or `--role staff` to reduce
it explicitly; an omitted role cannot silently downgrade an admin.

Patients sign in at `/sign-in`; staff and admins sign in at `/staff/sign-in` using
admin- or operator-provisioned accounts. Each sign-in action checks the account role on the
server and rejects accounts belonging to the other portal. Staff and admin
password recovery starts at `/staff/forgot-password`, and sign-out returns to
`/staff/sign-in`. Both portals use the existing Supabase project and browser session;
they are separate entry points, not simultaneous independent sessions.

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
