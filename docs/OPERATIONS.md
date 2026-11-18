# Staff operations and delivery

## Staff workspace

Patients, staff, and admins have separate roles. Staff and admins use the same
`/staff/sign-in` page and `/admin` portal, with these permissions:

| Role | Available staff-portal tabs |
| --- | --- |
| `staff` | Requests, Queue, Inquiries, Reports |
| `admin` | Every tab, including History, Accounts, Staff, and Schedules |

The staff role can approve or decline requests, operate queues, manage inquiry
replies and drafts, and view or export reports. Account approval and verification
documents, service and schedule management, booking on behalf of patients,
appointment-history actions, and audit browsing require an admin. Direct page
requests, server actions, and database permissions enforce the same role split.

Apply `202611180001_staff_roles.sql` after all preceding migrations before
deploying these pages. Existing staff-portal accounts already have the `admin`
role and keep all their access. Patient permissions are unchanged.

## Staff account management

The admin-only **Staff** tab at `/admin/staff` creates staff and admin accounts and
manages their roles. Enter a first and last name, email address, password of at
least 12 characters, optional employee ID, and either Staff or Admin. New accounts
are ready to sign in at `/staff/sign-in` immediately. No invitation or confirmation
email is sent. Give the account holder their email and password directly; the form
clears the password after successful creation.

Staff receives Requests, Queue, Inquiries, and Reports. Admin receives every portal
tab. The account list shows both roles and allows changes between them for active
accounts. It does not convert patient accounts or reactivate disabled accounts. Duplicate email addresses do not overwrite an existing
account. After an interrupted create request, refresh the list before retrying to
check whether the account was created.

The database rejects stale role edits and prevents removing the last active admin.
An admin may change their own role to Staff when another active admin remains;
they return to Requests and lose access to the Staff tab. New requests use the
current database role, so an existing session does not preserve old admin access.
Account creation and role changes record the acting admin and selected roles in
the audit log, without passwords.

Apply `202611180002_staff_account_management.sql` after all earlier migrations and
configure `SUPABASE_SECRET_KEY` on the application server. Account creation uses
the server-only Supabase Auth Admin API with email confirmation supplied by the
admin. The migration provisions the profile, role, and audit entry inside the Auth
creation transaction using trusted application metadata and rechecks the creating
admin's access. Patient signup and email verification retain their existing flow.
Listing accounts and changing roles use protected RPCs with the signed-in admin's
session and do not need the secret key. Never expose that key in browser code.

References: [Supabase admin account creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser)
and [trusted application metadata](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Operator provisioning

Use the operator command to bootstrap the first admin or recover access when the
portal cannot be used. The command defaults new provisions to `staff`:

```sh
npm run staff:provision -- --user USER-UUID --employee STAFF-001 --operator OPERATOR
npm run staff:provision -- --user USER-UUID --employee ADMIN-001 --operator OPERATOR --role admin
```

Both commands are dry runs until `--apply` is added. They require a confirmed
account and the server-only `STAFF_DATABASE_URL` operator connection. Updating an
existing admin requires an explicit `--role admin` to retain access or
`--role staff` to reduce it. Successful changes record the previous and selected
role in the audit log.

## Admin services and schedules

`/admin/schedules` supports service creation with available weekdays, opening/closing
times, session duration in minutes and patient slots per session. All times are Manila
local times. A service open 8 AM–4 PM with 60-minute sessions and capacity 6 offers eight
separate sessions for up to 48 patients. Use the **1 hour** duration shortcut or enter 60
minutes; the daily preview lists 8–9 AM, 9–10 AM and every later session through 3–4 PM,
each with six patient slots. Each patient chooses one session and submits a separate appointment
request; pending requests consume capacity immediately. The database locks each slot
when reserving capacity and refuses bookings once that session is full. Other sessions
on the same day retain their own capacity.

Upcoming sessions are grouped into one summary per service and Manila date, with
session count, time range, configured capacity and open/closed counts. Date fields use
MM/DD/YYYY (Month/Day/Year), with a calendar button for selection. The upcoming-session
date filter applies immediately; Previous day, Next day and Today switch dates without
an extra submit step. All dates restores all upcoming dates. Adjacent dates are prefetched
for faster navigation. Expand a summary
to view and edit individual sessions. Pagination keeps each daily group together.

New services stay unpublished until an admin enables publication and online booking.
Regular hours generate complete intervals over the next 30 days, including today's
remaining times. Session duration must fit inside opening hours. A leftover interval
shorter than the session duration is not offered. No selected weekdays disables
automatic generation. Existing services keep their previous full-day configuration until
an admin saves a new session duration and capacity. For an existing full-day service,
set opening time to 08:00, closing time to 16:00, duration to 60 and capacity to 6,
then save the session schedule. This requires migration
`202611160001_appointment_time_slots.sql` and its predecessors.

Saving regular hours rebuilds empty future dates. Dates with appointment history,
manual sessions or individual overrides retain all their time slots. Use Sessions to
change or close an individual slot; closing one slot does not close the whole date.
Slot hours can be edited only before the slot starts and while it has no appointment
records. Existing reservations are retained when a slot closes, and capacity cannot
fall below reserved visits. Service definitions, regular hours and slot edits detect
stale timestamps and support retry-safe saves. Publication, booking availability,
requirements and arrival settings currently use last-write-wins.
Only publish policies approved by center staff. Seed values are not approved policies.

## Reports

`/admin/reports` is available to staff and admins and provides exact counts by
current status for requests submitted within an inclusive Manila date range
(maximum 93 days). The denominator includes
all statuses. This is a request-cohort report, not visits performed during that
period. Admins also see the latest 30 audit actions separately without record metadata.
Decision, waiting and service-duration averages are available after the staff-management
migration, with sample counts and exclusions. Reports can export request-outcome
counts as CSV for the selected dates; duration metrics are not included in that
export. `/admin/audit` is admin-only and provides paginated exact-action filtering
without sensitive metadata. Both routes enforce their role requirements independently.

## Private updates

`/patient/notifications` has paginated own-account notices and retry-safe read
acknowledgements. Patient layouts subscribe to their own notifications using the
existing `supabase_realtime` publication and RLS; events trigger authoritative
server reads. Reconnection/visibility changes also refresh, with a 60-second
fallback while visible. Own queue snapshots continue polling every 15 seconds
because another person's queue movement does not emit a notification to this
patient. No full queue is exposed to patients. Staff layouts subscribe to appointments,
queue tickets and inquiry changes after the staff-management migration; existing RLS
still applies to every subscriber. Cross-browser acceptance and a five-second
queue-update target remain unverified.

## Additional staff workflows

New appointment requests stay pending until staff approves them. `/admin` lists
pending requests oldest first and supports individual review or bulk approval/decline
of up to 25 selected requests on the current page. Search matches reference, patient
or service within that page. Bulk decline requires a note that each selected patient
can read. Each request is checked independently; stale or unavailable requests show
an error while successful decisions are retained. Repeating an unchanged decision
uses the original retry key to avoid duplicate notifications. Patients see **Approved**
on their dashboard and appointment list after approval, plus an appointment notification.
Check-in is available only after approval. Bulk decisions use the existing appointment
database functions and do not require an additional migration.

Admins can use `/admin/history` for status/reference filtering, cancellation and
no-show decisions with reasons. The admin-only `/admin/book` creates pending
requests on behalf of approved patients. Admins must confirm identity, consent
and applicable policy before acting.
The request dashboard can flag requests older than `APPOINTMENT_REVIEW_HOURS`;
leave this unset until the center approves a deadline.

The local migration `20261021064654_staff_management.sql` adds protected service
definition, draft editing, staff booking and duration-report RPCs, plus staff
Realtime table publications. Apply through the normal reviewed migration workflow
before using those features.

Reference: [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

## Notification email worker

Configure server-only `EMAIL_DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM` (a
verified sender), and trusted `APP_URL`. The database credential needs SELECT on
notifications, auth.users and user_roles, and SELECT/UPDATE on email_outbox. It is
an operator credential, never a browser key. Preserve TLS certificate validation.

`npm run email:worker` performs a read-only count by outbox state. No mail is sent.
`npm run email:worker -- --send` processes up to 20 eligible messages and exits.
`npm run test:email` checks provider failure/retry behavior offline without sending
mail or connecting to a database. This does not verify provider deliverability.
Run this command from an operator-controlled scheduler every minute after setup
and delivery acceptance.

Workers claim rows atomically with SKIP LOCKED, use a two-minute lease, a 15-second
provider timeout, and a stable provider idempotency key. Retries use exponential
backoff and stop after five attempts. A first-claim timestamp bounds automatic
retries to 23 hours; expired ambiguous attempts require provider reconciliation
before any manual replay. Do not blindly reset failed rows: an interrupted response
may already have been accepted by the provider. Inspect provider delivery records
privately, using the outbox UUID/idempotency key or saved provider message ID.

Only generic account-update text and a sign-in link are emailed, with no service,
medical, identity document or inquiry content. Unconfirmed/disabled recipients
are not sent mail. Provider bodies and addresses are not logged. `sent` means
provider acceptance, not delivery to an inbox. Bounce/webhook monitoring and domain
deliverability acceptance remain required. Auth verification/reset mail is separate:
configure Supabase Auth SMTP and redirect allowlists independently.

Reference: [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email).

## Authenticated browser verification

Use a disposable **local** Supabase with repository migrations applied through the
normal local setup workflow. Provision three synthetic, email-confirmed accounts:
an approved patient with a complete synthetic profile, an active `staff` account,
and an active `admin` account. Assign the staff and admin roles explicitly using
the operator provisioning command.
Never point this runner at hosted or pilot data. No automatic migration/reset or
privileged provisioning is performed by these tests.

Set the following in the test process environment (do not commit credentials):

```
E2E_SUPABASE_URL=http://127.0.0.1:54321
E2E_SUPABASE_KEY=<local publishable key>
E2E_PATIENT_EMAIL=<synthetic patient>
E2E_PATIENT_PASSWORD=<test password>
E2E_STAFF_EMAIL=<synthetic staff>
E2E_STAFF_PASSWORD=<test password>
E2E_ADMIN_EMAIL=<synthetic admin>
E2E_ADMIN_PASSWORD=<test password>
E2E_SUPABASE_SECRET_KEY=<isolated local Auth admin key, optional for account-creation tests>
```

Run `npm run test:e2e:auth`. It starts a separate app on port 3101, refuses a
non-loopback database endpoint and exercises real sign-in, patient staff-page
denial, staff navigation and admin-page denial, the single account header,
admin schedules/reports/queue reads, inquiry
draft isolation, published replies and notification acknowledgement. With
`E2E_SUPABASE_SECRET_KEY`, it also creates synthetic staff/admin accounts, checks
immediate sign-in without email confirmation, and verifies that role changes alter
access for existing sessions. It leaves synthetic accounts and inquiries in the
disposable database; reset that database only through
your local test lifecycle. Traces/screenshots/video are disabled to avoid storing
credentials. Do not run simultaneously with the public E2E server (shared build
directory). Appointment, upload/review, email, reconnect and multi-connection race
journeys still need broader acceptance coverage.


## Staff account edits and deletion

Apply `202611180005_staff_account_editing.sql` after preceding migrations.
The Staff tab offers Edit details (name, email, employee ID), New password, and
Delete account. Passwords are set directly without an email link and are never
included in audit metadata. Email edits are confirmed by the admin.
Deletion requires confirmation and uses Auth soft deletion to preserve historical
references. Access is disabled first; if Auth deletion fails, the account remains
visible as disabled and Delete account can be retried. Deleted accounts are hidden
from the directory. An admin cannot delete their own signed-in account; another
admin must do it. The last active admin remains protected.
