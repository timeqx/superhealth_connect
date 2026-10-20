# Implementation status

Updated: 20 October 2026. Branch: `feat/superhealth-foundation`.
Base commit: `01909d4`; implementation is currently uncommitted.

## Completed planning deliverables
- [x] Original flowchart added to repository.
- [x] Technical blueprint prepared.
- [x] Native Figma design prototype created with 23 screens.
- [x] Codex handoff, design map and repository instructions prepared.

## Current milestone

Runnable foundation and account verification/review milestone implemented. The complete starter roadmap and MVP remain
**partial**, not ready for real patient use. Nothing has been deployed and no live
database migration has been applied.

## Implemented

- Next.js 16.4.2 / React 19.3.1 / strict TypeScript / Tailwind setup, lockfile,
  local DM Sans fonts, lint, typecheck, build, unit, SQL and browser test commands.
- Responsive public landing and seven-service catalog, shared cards/buttons/
  badges, patient and staff shells, error/loading/not-found/setup states.
- Read actual Figma context and screenshots for nodes `3:601`, `3:653`, `3:696`,
  `3:743`, `3:766`, `3:872`, `3:968`; rendered original PDF website pages 1–4.
- Separate labelled synthetic patient/staff/queue previews; no demo authorization
  or workflow bypasses.
- Supabase SSR clients, cookie refresh proxy, verified-user/protected-role checks;
  signup/sign-in/reset/callback/logout adapters.
- Profile form with separate names, five barangays plus Others, mobile contact
  normalization and account status display.
- shadcn/ui configuration and themed Button, Input, Label, Textarea and
  AlertDialog components; adopted in auth, profile, upload and account review.
- Private server uploads with size/type/signature checks, actor-derived paths,
  retry reconciliation and versioned rejected-account resubmission.
- Staff account-review list, expiring private document links, confirmation
  dialogs, required rejection instructions and SQL-backed decisions.
- Operator-only audited staff provisioning script (dry run by default) and
  role-aware sign-in routing. No staff account provisioned by the agent.
- Additional Figma verification and appointment-review nodes `3:791` and
  `3:1019` inspected. Account review adapts shared tokens; the latter reference
  depicts appointment review, not a dedicated account-review screen.
- Authenticated service/session/review booking form and pending receipt adapter;
  own appointment history, inquiry creation and RLS-filtered message display.
- Staff page provides an authorized read-only pending-request list.
- SQL schema, RLS, protected roles, event/audit records, narrow mutations, draft
  catalog seeds and private bucket configuration.
- Transactional request/decision/cancellation/reschedule/check-in/queue functions,
  retry receipts, capacity locks and queue-session serialization.
- SQL profile/review/schedule/service operations, inquiry drafts/replies,
  notifications and transactional email-outbox enqueueing.

## Pending implementation

1. Live authenticated account acceptance checks and private orphan-object
   reconciliation/retention automation. File signature checks are not malware
   scanning or complete document parsing.
2. Staff decisions, scheduling/service management, queue console, and patient
   cancellation/rescheduling controls. SQL alone is not an integrated journey.
3. Live patient queue, authorized Realtime, reconnect and 15-second polling
   fallback. Publication configuration is prepared, not integrated.
4. Inquiry draft editing/publishing/follow-up UI, notifications, email worker
   with claims/retries/provider integration. Outbox rows do not send email.
5. Reports, audit interface, operational guide, downtime procedure and pilot
   acceptance.
6. Generated database types and relation mappings from local Supabase.

## External setup
- Hosted Supabase: user connected environment configuration. Read-only probes
  confirmed services REST access and a private verification bucket with the
  expected 5 MB limit and JPEG/PNG/PDF types. Server secret is configured.
  No live migrations, users, uploads or application-data changes were made.
- Local runtime: initial Podman inspection failed
  on a local configuration-directory error; runtime configuration was not changed.
  PGlite was used for isolated SQL tests.
- Email provider and production sender: not configured.
- Figma: access succeeded; nine reference screens inspected.
- Live center operational policies: confirm the open decisions in the blueprint.

## Verification log
Commands ran on the working tree on 20 October 2026:

| Check | Result / boundary |
| --- | --- |
| `npm run lint` | Passed, zero warnings |
| `npm run typecheck` | Passed |
| `npm test` | 15 passed |
| `npm run test:db` | 13 passed against PGlite with minimal Auth/Storage stubs |
| `npm run build` | Passed |
| `npm run test:e2e` | 12 passed at 360px, 768px, 1440px |
| `node --check scripts/provision-staff.mjs` | Passed; actual provisioning not executed |
| `npm audit --omit=dev` | Zero production dependency vulnerabilities |
| `npm audit` | 5 high findings in lint chain through braces 3.0.3; no newer braces version available |

SQL tests apply migrations 001–004 across two suites: duplicate replay, pending capacity, ownership,
denied role/review/outbox access, disabled staff, full-target reschedule rollback,
retry-safe check-in, busy desk refusal, skip/requeue, synchronized completion and
inquiry draft visibility. Account tests cover submission privileges, frozen
profiles, owner/other-patient/staff private-object policy access, rejection reasons,
version conflicts, resubmission, duplicate decisions and disabled staff.
Sequential embedded SQL tests do **not** prove concurrent
operations across connections.

Browser checks cover public navigation, disconnected authentication feedback,
setup guards, protected document-route denial, synthetic previews and horizontal overflow. Existing local Chromium
`chromium-1243` was selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.
Desktop/mobile landing screenshots were visually inspected against Figma;
artifacts are in ignored `test-results/`. Full visual fidelity, keyboard journeys
and accessibility audits remain pending. The authenticated upload/review screens
have not been exercised end-to-end in a browser.

Browser testing initially encountered the existing development-server lock, then
cold compilation timeouts with ten workers. A separate `.next-e2e` output directory,
two workers and explicit development-server timeouts resolved these failures;
the existing development server was not stopped.

Initial Vitest API, lint, ambiguous browser selector and unconfigured child-page
loading issues were fixed before passing checks. Next.js dev added its own
documentation-guidance block to AGENTS.md; project instructions were preserved.

Still required: live Supabase Auth and Storage HTTP/private-file isolation,
Realtime, full authenticated E2E, multi-connection capacity-1 and
50-request booking tests, simultaneous reschedule/check-in/cancel/call-next,
deadlock/rollback checks, and operational policy approval.

See README.md for setup and staff provisioning. Staff appointment operations
and authenticated acceptance checks are the next milestone; the full booking
journey is not yet complete.
