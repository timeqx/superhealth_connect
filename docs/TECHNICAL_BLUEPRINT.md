# SuperHealth Connect
## Technical blueprint and implementation specification

Version 1.0 · 20 October 2026 · Proposed capstone implementation

Repository: https://github.com/timeqx/superhealth_connect

## 1. Product goal

Build a mobile-friendly website where residents can discover services, register and verify their account, request an appointment, receive an administrator's decision, and track their queue after arriving at Batasan Hills Super Health Center. Administrators manage account verification, availability, appointments, queues, inquiries, and operational reports.

Use one Next.js application with React and TypeScript, backed by Supabase Auth, PostgreSQL, private Storage, and Realtime. Keep the implementation a modular monolith: one codebase and database, with small feature modules and explicit business rules.

This document specifies the proposed system; it does not claim an existing implementation or deployment. Repository inspection found README.md containing only the project name and SuperHealth-Connect-Flowchart.pdf. No application code or package versions were present at the repository root.

## 2. Evidence, scope, and assumptions

### Center context

The Quezon City government directory identifies Batasan Hills Super Health Center at **2 IBP Road, Barangay Batasan Hills**, under District 2. It lists **0998 324 7864** and **batasanhillsshc.cityhealth@quezoncity.gov.ph**. A separate official facility page describes a second-floor location at IBP Road corner Commonwealth Avenue and lists different telephone numbers. Confirm the preferred address, map pin, and contact number with center personnel before publishing. Do not confuse this center with Batasan Hills Annex.

Official sources confirm the facility, but do not establish the live appointment hours, capacity, eligibility rules, or all seven service categories in the supplied diagram. Treat those categories as project requirements awaiting facility validation, not a verified current service directory.

### Flowchart traceability

| Source | Requirement | Implementation interpretation |
|---|---|---|
| Page 1 | Patient and Admin entry points | Patient sign-in plus a discreet staff sign-in link; actual access comes from server-controlled roles |
| Page 2 | Names, barangay, contact verification, QC ID, registration | Supabase email/password registration, email verification, private ID upload, account review |
| Page 2 | Five barangays and Others | Bagong Silangan, Batasan Hills, Commonwealth, Holy Spirit, Payatas; Others enables a text field |
| Page 3 | Appointment or inquiry | Separate booking wizard and asynchronous inquiry form |
| Page 3 | Service, calendar, submit, confirmation | Request receipt first; approved appointment confirmation only after admin approval |
| Page 4 | Approve/decline and suggest reschedule | Explicit pending, scheduled, rejected and cancelled states; reason and proposed alternative |
| Page 4 | Account review and staff identity | Protected review workflow; employee ID is a staff profile field, never an authentication credential |
| Page 4 | Availability, history, inquiry replies | Admin schedule editor, filtered history, draft/reply/follow-up workflow |
| Pages 5–6 | Research, pilot, observation, evaluation | Delivery milestones and anonymous evaluation metrics; no research survey engine in the MVP |
| User request | Queue | Proposed check-in and queue workflow defined below; absent from the original diagram |

### Explicit design decisions

1. Use verified email and password for MVP authentication. Phone is a contact field, not implicitly verified. SMS verification is a later integration with a provider and budget.
2. Create the Auth identity before uploading the QC ID so Storage can enforce ownership. This changes the diagram's technical ordering while retaining verification and account review.
3. A patient may log in while awaiting review, but may not request appointments until approved. They may view their review status and submit inquiries.
4. Require the diagram's QC ID for the prototype using synthetic files. Confirm acceptable alternatives, minors/guardian handling, and real-world eligibility before a live pilot.
5. Pending requests reserve capacity. Rejected/cancelled requests release it. A missed review deadline must appear in the admin dashboard; requests are not silently approved.
6. Queue tickets are issued on staff-confirmed arrival, not when requesting a future appointment. Appointment reference and queue number are different identifiers.
7. One appointment is for the account holder in MVP. Guardian/dependent bookings require a separate patient/guardian model and are not silently treated as the account holder.

## 3. Scope and roles

### MVP

- Public service directory, center information and instructions.
- Registration, email confirmation, login/logout, password reset.
- Profile completion, QC ID submission, approval/rejection and resubmission.
- Service/date/session selection, request submission, admin approval, cancellation and rescheduling.
- Staff check-in, call next, start service, complete, skip, recall and no-show handling.
- Patient appointment history, queue status and in-app notifications.
- Inquiries with admin drafts, follow-up flags and replies; email alerts linking back to the secure website.
- Admin service availability, account review, history, aggregate reports and audit trail.

Defer payments, diagnosis, medical records, prescriptions, AI advice, telemedicine, native mobile apps, complex resource optimization, walk-in integration, SMS and push notifications. The website is an appointment tool, not an emergency intake channel.

| Capability | Visitor | Patient | Admin |
|---|---|---|---|
| Read published services | Yes | Yes | Yes |
| Access private account data | No | Own only | Only for approved operational duties |
| Book/cancel | No | Own, after approval | On behalf of a patient with audit reason |
| Review IDs/accounts | No | Own submission status | Yes |
| Change schedule/queue | No | No | Yes |
| Read inquiries | No | Own thread | Assigned/operational inbox |
| Change roles | No | No | Restricted provisioning procedure |

Start with two application roles. Do not add a complex permission framework for a capstone. Bootstrap the first admin through a protected maintenance script; additional staff must be provisioned by the project operator, never by a public role selector.

## 4. Patient and administrator workflows

### Registration

Name + email + password → Supabase signup → email verification → profile and barangay → private QC ID upload → submit for review → pending review → approved or rejected with reason → correction and resubmission if necessary.

Middle name is optional. Normalize Philippine phone numbers to international format. Validate on the server as well as in the form. Store passwords only in Supabase Auth. Use generic authentication errors, rate limits and provider protections; a browser-only login-attempt counter is not a security control.

### Appointment

1. Select an active service and read its requirements.
2. Select a date and available session/slot with remaining capacity.
3. Review details and submit once using an idempotency key.
4. Receive a reference and **Pending approval** status.
5. Admin approves or declines with a reason and optional suggested alternative.
6. On approval, show **Scheduled**, arrival instructions and cancellation action.
7. On the appointment day, staff validates arrival and checks the patient in.
8. Patient receives a queue ticket and sees their current state and people ahead.
9. Staff completes service; the appointment becomes Completed.

Service seeds from the flowchart: Maternal & Child Care; Family Planning; Animal Bite Treatment; Mental Health Support; Immunizations; TB DOTS; Screening Services. Use one shared booking flow with service-specific text and schedule data. Do not build seven duplicated booking pages. Seed as drafts until center staff validate availability and requirements.

### Appointment state transitions

| Current | Allowed next states | Actor/guard |
|---|---|---|
| pending | scheduled, rejected, cancelled | Admin approval/rejection; patient may cancel own request |
| scheduled | checked_in, cancelled, no_show | Admin check-in/no-show; cancellation before service |
| checked_in | in_service, cancelled, no_show | Admin; synchronize ticket in the same transaction |
| in_service | completed | Admin |
| completed, rejected, cancelled, no_show | None | Terminal; corrections require audited maintenance, not arbitrary edits |

Use rejected for an administrator's decline and cancelled for withdrawal or facility cancellation. The diagram labels a decline Cancelled; the distinction above makes reporting clearer.

Rescheduling before check-in updates the slot transactionally and returns the appointment to pending. Lock old and new slot rows in deterministic ID order, validate target capacity, release old capacity and reserve new capacity atomically. If the target is full, preserve the original appointment. Record the previous slot and state in history. Admin suggestions do not change the booking until accepted.

### Queue policy — proposed, to validate with the center

- Maintain one queue session per service and Manila calendar date; one service desk per queue for MVP.
- Staff checks in only scheduled appointments for that service date and within a configurable arrival window. Proposed prototype default: 30 minutes before slot start through slot end, with a reason-required staff override.
- Assign a monotonic integer under a locked queue-session counter. Display a neutral ticket such as Q-023 alongside the service context. Enforce one ticket per appointment and unique number within the queue session.
- Serve checked-in patients by sequence. No automatic priority classification. Center-approved priority/triage rules must be agreed before a public pilot; record any permitted override and reason.
- Ticket states: waiting → called → serving → completed. Called may become skipped. Skipped may return to waiting at the end via a new ordering sequence, retaining its original ticket number. Waiting/called/skipped may become cancelled or no_show through authorized actions.
- Call next locks the queue session, rejects if another ticket is called/serving, then claims the first waiting ticket. Repeated clicks or competing admins cannot call two patients simultaneously.
- Start service updates the ticket to serving and appointment to in_service. Complete updates both records in one transaction. Skipping leaves the appointment checked_in.
- Show queue number, status, people ahead and last updated time. Position counts active waiting/called/serving tickets ordered before the patient; skipped tickets do not count until requeued. Do not promise exact waiting minutes.
- Closing a session with unresolved tickets requires explicit resolution and notifications. Never delete or silently carry tickets into tomorrow.
- Live updates are helpful, but the database is authoritative. On reconnect, fetch a fresh snapshot. Poll every 15 seconds while the active queue page is visible if Realtime disconnects; show a stale-data notice.

### Inquiries

Patient submits subject, category and message → receives a receipt → admin marks open/in_progress/waiting_for_follow_up → drafts or posts a reply → resolves. Patients can read only published replies in their own thread. Drafts remain staff-only. A further patient reply reopens the inquiry. Email contains a generic alert and secure link, not the sensitive message body.

## 5. Responsive interface and visual direction

**Design character:** calm, modern, accessible public service. Warm white surfaces, dark slate text, deep teal actions, restrained borders, generous spacing. Avoid oversized decorative dashboards and clinical stock imagery that crowds the booking task.

Suggested tokens: background #F8FAFC; surface #FFFFFF; primary #0F766E; text #0F172A; muted #475569; border #CBD5E1. Validate final contrast rather than assuming token choices pass. Use a single readable sans-serif, 16px body text, 24–32px page titles, 8px spacing rhythm, 12px card radius, and at least 44px interactive targets.

| Screen | Mobile | Desktop |
|---|---|---|
| Landing | Compact introduction, Book appointment button, service list, center contact | Same content in a restrained two-column layout |
| Patient dashboard | Next appointment first; Book and Inquiry actions; notifications | Next appointment and queue card beside concise history |
| Booking | Stepper: Service → Date & time → Review; sticky next action | Main form plus persistent summary |
| Queue | Large ticket and status; people ahead; last update | Same focused card, no unnecessary full-screen chart |
| Admin | Collapsible navigation, stacked record cards and filters | Sidebar, concise counts, searchable tables, detail panel |
| Schedule | Date list and session cards | Calendar plus editable session detail |

Patient navigation: Home, Appointments, Inquiries, Profile. Queue appears within the active appointment. Admin navigation: Overview, Appointments, Queue, Schedule, Account reviews, Inquiries, Reports, Services.

Support 360px, 768px and 1440px layouts without page-level horizontal overflow. Use semantic headings, visible keyboard focus, labelled fields, inline errors, keyboard-operable calendars and an accessible date-list alternative. Status uses text/icons as well as color. Announce queue changes politely without repeatedly stealing focus.

Provide loading, empty, permission-denied, validation, full-slot, rejected-account, disconnected-queue and submission-failure states. Preserve form data after recoverable failures. Confirm cancellation and explain its effect. Clear sensitive client state on logout. Never claim a request is confirmed before approval.

## 6. Stack and clean architecture

| Concern | Choice |
|---|---|
| Web application | Next.js App Router, React, TypeScript strict mode |
| Styling | Tailwind CSS; a small accessible component set such as shadcn/ui |
| Forms and validation | React Hook Form and Zod |
| Identity | Supabase Auth email/password, email verification and reset |
| Database and access | Supabase PostgreSQL, SQL migrations, RLS, database functions |
| Files | Supabase private Storage bucket for verification documents |
| Live updates | Supabase Realtime on authorized data; polling fallback |
| Tests | Vitest for rules; database integration tests; Playwright for core journeys |
| Hosting | A Next.js-compatible host and separate Supabase projects for test/pilot |

Choose compatible stable versions when initializing the application and commit the lockfile. React is the UI library inside Next.js; do not create separate React and Next.js applications. No separate FastAPI service, microservices or custom authentication server is needed.

### Dependency direction

Presentation → application use cases → domain contracts. Infrastructure implements the contracts. Domain rules must not import React, Next.js or the Supabase SDK.

```text
src/
  app/                         # Routes, layouts, route handlers, thin server actions
    (public)/
    (auth)/
    (patient)/
    admin/
  features/
    appointments/
      domain/                  # States, transitions, repository interface
      application/             # Request, approve, cancel, reschedule
      infrastructure/          # Supabase mappings and RPC adapter
      presentation/            # Forms, cards, hooks
    accounts/
    services/
    queue/
    inquiries/
    notifications/
  shared/
    ui/                        # Button, input, dialog, badge, empty/error states
    lib/                       # Date, validation, error helpers
    supabase/                  # Server/browser clients and generated DB types
  server/                      # Composition and protected integrations
supabase/
  migrations/
  seed.sql                     # Synthetic demo records only
  tests/
tests/e2e/
docs/
```

Do not create empty layers for trivial formatting components. Use repository interfaces where use cases benefit from isolation, not a generic CRUD repository for every table. Keep Supabase snake_case-to-domain mappings in infrastructure. Create reusable AppointmentCard, StatusBadge, ServiceCard, SlotPicker, QueueTicket, InquiryThread and ReviewPanel components.

Server Components load initial authorized data. Client Components handle interactive forms, calendars and subscriptions. Server Actions call use cases for ordinary mutations; route handlers handle Auth callbacks and scheduled delivery hooks. Database functions enforce transactions and concurrency rules that cannot safely be spread across several HTTP calls.

Use request-scoped Supabase clients with cookie-based SSR via @supabase/ssr. Verify authentication on the server and enforce authorization inside every action/function, not only navigation or route guards. Follow the installed Next.js version's session-refresh integration. Do not share-cache authenticated pages or responses that set session cookies.

## 7. Logical data model

UUID primary keys unless noted. Store timestamps as timestamptz, persist instants in UTC, and display in Asia/Manila. Queue service_date is explicitly computed in Asia/Manila. All mutable entities include created_at and updated_at.

| Table | Important fields and relationships |
|---|---|
| profiles | id FK auth.users; first_name, middle_name nullable, last_name, barangay_code, other_barangay nullable, phone, review_status, submitted_at, reviewed_by, reviewed_at, rejection_reason |
| user_roles | user_id FK auth.users unique; role patient/admin; employee_id nullable; disabled_at; provisioning metadata; protected from patient writes |
| verification_documents | id, user_id, storage_path, mime_type, size_bytes, review_version, uploaded_at, deleted_at; metadata only, no public URL |
| services | id, slug unique, name, description, requirements, queue_label, is_published, is_bookable |
| service_slots | id, service_id FK, starts_at, ends_at, capacity, is_open; unique(service_id, starts_at); ends_at > starts_at and capacity > 0 |
| appointments | id, public_reference unique, patient_id FK profiles, slot_id FK, status, idempotency_key, requested_at, decided_at, decided_by, decision_reason, suggested_slot_id nullable; unique(patient_id, idempotency_key) |
| appointment_events | id, appointment_id, actor_id, action, from_status, to_status, old_slot_id, new_slot_id, reason, created_at; append-only |
| queue_sessions | id, service_id, service_date, next_ticket_number, next_order_sequence, status; unique(service_id, service_date) |
| queue_tickets | id, queue_session_id, appointment_id unique, ticket_number, order_sequence, status, checked_in_at, called_at, service_started_at, completed_at; unique(queue_session_id, ticket_number) |
| inquiries | id, patient_id, subject, category, status, assigned_admin_id nullable, resolved_at |
| inquiry_messages | id, inquiry_id, author_id, body, is_draft, published_at; draft visibility restricted to admins |
| notifications | id, recipient_id, event_key unique, type, entity_type, entity_id, read_at, created_at; minimal non-sensitive message |
| email_outbox | id, notification_id unique, state, attempt_count, available_at, claimed_at, sent_at, provider_message_id, last_error; backend-only |
| audit_logs | id, actor_id, action, entity_type, entity_id, safe metadata, created_at; append-only |

Indexes: appointments(patient_id, requested_at desc), appointments(slot_id,status), appointments(status,requested_at), queue_tickets(queue_session_id,status,order_sequence), inquiries(status,created_at), notifications(recipient_id,created_at desc), and all frequently joined foreign keys. Add a partial unique index on (patient_id, slot_id) for active appointment statuses to prevent duplicate requests with different idempotency keys.

Avoid hard-deleting referenced services, slots or appointments. Deactivate or cancel them with history. A blocked slot does not automatically erase its existing appointments; admin must resolve those bookings explicitly. Prevent capacity reduction below reservations. Reject overlapping sessions for the same service in the MVP; overlapping resource schedules require a later resource model.

## 8. Transaction and operation contracts

All operations derive the actor from the verified session. Never trust client-supplied patient_id, role, approval status or ticket number. Return typed errors: UNAUTHENTICATED, FORBIDDEN, VALIDATION_ERROR, SLOT_FULL, SLOT_CLOSED, INVALID_TRANSITION, DUPLICATE_REQUEST and CONFLICT.

| Operation | Input | Required behavior |
|---|---|---|
| request_appointment | slot_id, idempotency_key | Validate approved account and future open slot; lock slot; check duplicates and reserved count; insert pending request, event and notification |
| decide_appointment | appointment_id, decision, reason, expected_updated_at | Admin only; lock slot then appointment; ensure pending; approve/reject and notify atomically |
| cancel_appointment | appointment_id, reason | Owner/admin; validate transition; cancel active ticket if any and notify |
| reschedule_appointment | appointment_id, target_slot_id | Lock slot rows in sorted order then appointment; validate new capacity; preserve original on failure; return pending |
| check_in | appointment_id | Admin only; validate date/window; lock session and appointment in defined order; return existing ticket on retry or allocate once |
| advance_queue | session_id, action, ticket_id when needed | Admin only; serialize on session; enforce valid state and update related appointment |
| reply_inquiry | inquiry_id, message, publish | Admin; drafts private; published reply creates notification and email job |
| mark_notification_read | notification_id | Recipient only; server sets read timestamp |

Capacity counts appointments in pending, scheduled, checked_in, in_service and completed states for a slot; cancelled, rejected and no_show do not reserve capacity. Completed appointments continue counting so a used slot is not accidentally resold. Reject new requests once the slot starts.

All code paths affecting capacity must acquire the same slot locks. All queue mutations acquire the session lock before related appointment/ticket locks. Operations that need both capacity and queue changes use slot → queue session → appointment/ticket order. Review this ordering in integration tests to avoid deadlocks.

For idempotency, repeating the same actor/key and payload returns the original result. Reusing a key with a different slot returns CONFLICT. Store enough request data to compare. Recheck eligibility and state inside SQL, even if the application already validated them.

Use tightly scoped database functions for protected mutations. If SECURITY DEFINER is necessary, set a fixed safe search_path, qualify table names, revoke public/anonymous execution, grant only needed access, and check auth.uid() and the protected role table within the function. Do not expose unrestricted table writes that bypass these invariants.

## 9. Security, files and privacy

Enable RLS on every exposed table. Public users can read published service information and safe slot availability only. Patients can read their own profile, appointments, tickets, inquiry threads and notifications. Patient profile updates must exclude review status and reviewer fields; enforce column privileges or narrow functions, not only row ownership.

Admins receive explicit operational policies. Role assignment, audit modification and email-outbox access remain restricted. Routine requests use the user's authenticated client so RLS applies. Privileged keys exist only in trusted server jobs/provisioning; never in NEXT_PUBLIC variables, source control or browser bundles.

QC IDs belong in a private bucket. Proposed upload policy: JPEG/PNG/PDF only, maximum 5 MB, validated extension, detected type and size; randomized object path under the authenticated user ID. Never accept HTML/SVG uploads. Use short-lived authorized links for reviewers, do not log file contents or signed URLs, and do not allow public listing. Keep replacement submission history in metadata; approve a specific submitted version.

The live queue page exposes only the signed-in patient's ticket plus an aggregate count of people ahead. Never stream the full private queue to all patients. A later lobby display must use an explicitly sanitized projection with neutral ticket labels and no names, diagnoses, phone numbers or patient identifiers.

Minimize collected information. No medical diagnosis field is required for booking. Avoid sensitive service names or inquiry bodies in email subjects and analytics. Keep audit metadata minimal. Before a real pilot, center stakeholders must approve privacy notices, ID alternatives, access responsibility, retention/deletion periods and research participation procedures. Use synthetic accounts and documents in development and demonstrations.

## 10. Notifications and reliability

Commit domain changes, an in-app notification and an outbox row in the same database transaction. An authenticated scheduled server job claims email jobs, sends through a transactional provider, retries transient failures with bounded backoff and records failures for admin visibility. Use a stable event/provider idempotency key where supported; do not claim exactly-once email delivery when the provider cannot guarantee it.

A failed email must not undo an approved appointment. The dashboard is the source of truth. MVP email events: account decision, appointment decision/change/cancellation, and inquiry reply. Queue state is in-app; reminders and SMS can be added later.

Log request correlation IDs, function names, durations and sanitized error codes. Monitor booking conflicts, queue failures and overdue pending requests. Never log passwords, tokens, IDs, inquiry bodies or unrestricted patient records. Prepare a manual downtime process with staff; reconcile offline actions before restoring queue writes.

## 11. Validation and acceptance criteria

| Area | Required evidence |
|---|---|
| Auth and roles | Unverified users cannot book; patients cannot self-approve or become admin; disabled staff cannot mutate data |
| Registration | All five barangay choices plus Others work; invalid IDs rejected; pending/rejected users see clear next steps |
| Booking | For capacity 1, simultaneous requests from two users produce exactly one reservation; retries create one appointment |
| Reschedule | Full target leaves original unchanged; successful move releases old capacity and requires new approval |
| Authorization | Direct API/RPC calls by patient A cannot read or mutate patient B's records or private files |
| Queue | Repeated check-in yields one ticket; concurrent call-next yields one active call; skipped patient can rejoin once |
| Consistency | Complete/cancel updates appointment and queue together; rollback leaves both unchanged on failure |
| Realtime | Reconnect restores authoritative state; fallback indicates stale data and never leaks other patients |
| Inquiries | Drafts invisible to patients; published reply is visible only to thread owner and authorized admin |
| Notifications | Failed email retries without creating duplicate in-app notices or reversing business state |
| UI | Full patient journey works at 360px and desktop with keyboard navigation and readable errors |
| Scheduling | Manila date-boundary tests; closed/past slots blocked; capacity cannot shrink below reservations |

Unit-test pure state and validation rules. Integration-test database locks, RLS, private Storage and functions against a test Supabase environment. Use Playwright for registration/review, appointment approval/check-in/completion, cancellation and inquiries. Prefer these meaningful tests over snapshots of every component.

Proposed pilot targets, to measure rather than claim: booking submission p95 under 2 seconds excluding external email; queue updates within 5 seconds on a healthy connection; no overbooking under a 50-request concurrency test. Record test environment and workload with results.

## 12. Delivery sequence

1. **Confirm operations:** validate services, identity alternatives, capacity, arrival/late rules, priority handling and queue ownership with center personnel. Produce approved workflow decisions.
2. **Foundation:** initialize Next.js/TypeScript, shared UI, lint/typecheck, Supabase local setup, environment template and migration process. Build the public shell.
3. **Accounts:** Auth SSR, email verification/reset, profile, private upload, admin provisioning, account review and RLS tests.
4. **Booking:** services, availability, transactional requests, admin decisions, cancellation/rescheduling, event history and in-app notices. Prove no-overbooking tests before moving on.
5. **Queue:** check-in and atomic ticket allocation, staff console, patient status, reconnect behavior and concurrency tests.
6. **Inquiries and email:** staff drafts/replies, outbox delivery, retries and secure deep links.
7. **Pilot readiness:** responsive/accessibility checks, operational reports, privacy review, backup/restore exercise, user guide and center acceptance testing.
8. **Research evaluation:** compare baseline/pilot observations, task completion, waiting times and usability results; document limitations and improvements.

A milestone is complete when its acceptance tests pass, not simply when screens exist. Keep research approval and participant consent separate from routine account registration.

## 13. Deployment and capstone evidence

Maintain .env.example with public URL/key placeholders and server-only provider settings. Never commit .env.local. Use separate test and pilot credentials and synthetic preview data. Configure Auth redirect allowlists, production email delivery and staff access before pilot use. Apply versioned migrations through a controlled deployment job; never reset the pilot database. Back up before risky schema changes and verify available restore procedures against the chosen plan.

CI: install from lockfile → lint → typecheck → unit tests → database integration tests → production build → core E2E tests. Keep deployment manual until pilot acceptance. Do not assume a free plan supports the intended email volume, backups or availability; verify actual provider limits before launch.

Collect operational metrics from timestamps: request-to-decision duration; check-in-to-service-start wait; service duration; completion and no-show rates. Report denominators, dates and exclusions, especially skipped/priority cases. Compare baseline and pilot using similar services and time windows. Store research data separately with pseudonymous participant codes; anonymize exports and avoid small groups that could identify individuals. SUS/TAM instruments and qualitative feedback belong to the approved research protocol, not automatically to clinical account records.

## 14. Decisions needed before a live pilot

- Which listed services actually accept online bookings, and at what hours/capacity?
- Are all five barangays eligible, and how are Others handled?
- Is QC ID mandatory; what alternatives apply to minors or residents without it?
- Does the center require guardian bookings in the first release?
- What are staff response deadlines, cancellation cutoff, late-arrival and no-show rules?
- How are walk-ins, legally/operationally prioritized patients and urgent cases handled alongside appointments?
- Is a service-level daily queue appropriate, or must sessions/desks have separate queues?
- Which contact details and map pin should be published?
- Who controls staff provisioning, records retention, backups and pilot support?

These are operational decisions, not reasons to stop building the synthetic-data prototype. The defaults above make development concrete while keeping unverified policies explicit.

## 15. Source register

Reviewed 20 October 2026.

1. Supplied **SuperHealth-Connect-Flowchart(1).pdf**, six pages: website flow pp. 1–4; research flow pp. 5–6. Primary source for user/admin requirements.
2. Repository and README: https://github.com/timeqx/superhealth_connect — inspected through the GitHub connector; no application implementation identified at the root.
3. Quezon City facility page: https://quezoncity.gov.ph/health_centers/batasan-hills-shc/ — facility location and alternate contact details.
4. Quezon City health center directory: https://quezoncity.gov.ph/qcitizen-guides/quezon-city-health-centers/ — District 2 facility identity, address and directory contact.
5. Supabase SSR client guidance: https://supabase.com/docs/guides/auth/server-side/nextjs — cookie-based SSR client integration.
6. Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security — database access-control reference.
7. Next.js Server and Client Components: https://nextjs.org/docs/app/getting-started/server-and-client-components — rendering and interactivity boundaries.

Queue rules, data model, architecture, delivery phases and test targets are proposed engineering decisions derived for this project, not claims that the center already operates this way.
