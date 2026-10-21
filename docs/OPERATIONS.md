# Staff operations and delivery

## Staff workspace

`/admin/schedules` uses the staff-only `save_slot` and `update_service` RPCs.
Create sessions using Manila local times. Existing session time/service cannot be
edited: close it to new requests and create another session. Existing reservations
are retained when a session closes. Capacity cannot fall below reserved visits.
Services support publication, booking availability, requirements and arrival rules;
creating/renaming service definitions is available after the staff-management migration. Service
settings currently use last-write-wins; session updates detect stale timestamps.
Only publish policies approved by center staff. Seed values are not approved policies.

`/admin/reports` provides exact counts by current status for requests submitted
within an inclusive Manila date range (maximum 93 days). The denominator includes
all statuses. This is a request-cohort report, not visits performed during that
period. The latest 30 audit actions are shown separately without record metadata.
Decision, waiting and service-duration averages are available after the staff-management
migration, with sample counts and exclusions. Reports can export request-outcome
counts as CSV for the selected dates; duration metrics are not included in that
export. `/admin/audit` provides paginated exact-action filtering without sensitive
metadata. Both routes enforce staff access independently.

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

`/admin/history` supports status/reference filtering, cancellation and no-show
decisions with reasons. `/admin/book` creates pending requests on behalf of approved
patients. Staff must confirm identity, consent and applicable policy before acting.
The request dashboard can flag requests older than `APPOINTMENT_REVIEW_HOURS`;
leave this unset until the center approves a deadline.

The local migration `20261021064654_staff_management.sql` adds protected service
definition, draft editing, staff booking and duration-report RPCs, plus staff
Realtime table publications. Apply through the normal reviewed migration workflow
before using those features. This implementation did not apply it to hosted data.

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
and delivery acceptance; this change does not configure any scheduler or send mail.

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
normal local setup workflow. Provision two synthetic, email-confirmed accounts:
an approved patient with a complete synthetic profile and an active staff member.
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
```

Run `npm run test:e2e:auth`. It starts a separate app on port 3101, refuses a
non-loopback database endpoint and exercises real sign-in, patient staff-page
denial, the single account header, staff schedules/reports/queue reads, inquiry
draft isolation, published replies and notification acknowledgement. It leaves
synthetic inquiries in the disposable database; reset that database only through
your local test lifecycle. Traces/screenshots/video are disabled to avoid storing
credentials. Do not run simultaneously with the public E2E server (shared build
directory). Appointment, upload/review, email, reconnect and multi-connection race
journeys still need broader acceptance coverage.
