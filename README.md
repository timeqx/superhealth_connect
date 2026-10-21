# SuperHealth Connect

A responsive appointment, service and queue website planned for Batasan Hills Super Health Center.

**Status:** foundation, private verification uploads and staff account review implemented.
Live authenticated acceptance testing, staff appointment operations and the live queue
remain incomplete. Use synthetic data only.

## Start here
- [Codex / VS Code handoff](docs/CODEX_HANDOFF.md)
- [Technical blueprint](docs/TECHNICAL_BLUEPRINT.md)
- [Figma screen map and design guidance](docs/FIGMA_DESIGN.md)
- [Implementation checklist](docs/IMPLEMENTATION_STATUS.md)
- [Agent instructions](AGENTS.md)
- [Original flowchart](docs/SuperHealth-Connect-Flowchart.pdf)
- [Open Figma prototype](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra)

## Stack
Next.js App Router, React, TypeScript, shadcn/ui and Supabase (Auth, PostgreSQL,
private Storage and Realtime). Shared shadcn components live in `src/shared/ui`;
`components.json` configures future additions using the project's theme.

## Run locally
Requires Node.js 22.12 or newer.
```sh
npm ci
npm run dev
```

Open http://localhost:3000. Without configuration, public pages and labelled
`/preview/patient`, `/preview/booking`, `/preview/admin`, `/preview/queue` are available. Protected
workspaces show setup guidance; there is no demo authentication bypass.

## Supabase setup

1. Install Supabase CLI and a supported local Docker-compatible runtime.
2. Run `supabase start`, then `supabase db reset` **only against this disposable
   local project** to apply migrations and draft catalog seeds.
3. Copy `.env.example` to `.env.local`, fill the local URL and publishable key
   from `supabase status`, and retain `APP_URL=http://localhost:3000`.
4. Restart Next.js. Local verification emails appear in Inbucket on port 54324.
5. Keep email confirmation enabled and configure the callback URLs from
   `supabase/config.toml`. Use synthetic accounts only.

For an existing hosted project, use its URL and publishable key in your ignored
`.env` or `.env.local`, and configure Auth redirect URLs for your application.
The application requires all four SQL migrations and the private `verification`
bucket. A connection alone does not install the schema. Do not run a local reset
against a hosted database. Hosted migrations require a separate operator step.

Set `SUPABASE_SECRET_KEY` for server-side private uploads; never prefix it with
`NEXT_PUBLIC_`. The bucket denies browser uploads. The server checks the signed-in
patient, profile state, file size, extension and JPEG/PNG/PDF signature before
uploading. Signature checks are not malware scanning or full document parsing.
Save a profile, submit a synthetic document, then review it at `/admin/reviews`
using a staff account. Review links expire after 60 seconds. Rejections require
correction instructions; resubmissions create a new document version.

Provision an existing email-confirmed synthetic account with an operator PostgreSQL
connection in `STAFF_DATABASE_URL` (not required by the app):

```sh
npm run staff:provision -- --user USER-UUID --employee STAFF-001 --operator local-developer
```

This defaults to a dry run. Add `--apply` only when you intend to change the
configured database. The script records an audit entry. Staff use normal sign-in
and are directed to `/admin`; roles never come from signup metadata. Disable staff
with `user_roles.disabled_at`. No staff account was provisioned by this implementation.

An upload whose database submission fails may leave a private, unreferenced object.
Retries reconcile committed submissions without deleting a possibly committed file.
Operator reconciliation/retention automation remains pending.

All seven seed services are unpublished and not bookable. Confirm services,
requirements and future Manila sessions before configuring availability.
A hosted connection and private bucket were checked read-only during development.
No live migration or application-data write was performed by the implementation agent.

## Checks

| Command | Purpose |
| --- | --- |
| `npm run build` / `npm start` | Production build / local production server |
| `npm run lint` | ESLint, warnings fail |
| `npm run typecheck` | Route types and TypeScript |
| `npm test` | Domain and validation tests |
| `npm run test:db` | Embedded PostgreSQL migrations/RLS/workflow tests |
| `npx playwright install chromium` | Browser test runtime |
| `npm run test:e2e` | Public/disconnected UI at 360, 768 and 1440px |
| `npm run db:types` | Generate types from local Supabase |

Database tests use PGlite with minimal Auth and Storage table stubs. They do not prove
multi-connection concurrency, Supabase Storage, Auth emails, or Realtime.
Generated database types await a running local Supabase environment.
Optionally set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an existing Chromium binary.
See the implementation checklist for precise results and remaining milestones.


## UI preview and screenshots
The redesigned UI uses the shared shadcn-compatible theme and labelled synthetic
previews. `/preview/booking` exercises service, date/session, review and a pending
receipt without saving an appointment. `/preview/queue` shows the five visual
queue states, including disconnected updates. The staff preview demonstrates
local-only queue transitions; the secure staff workspace retains real account
review and read-only appointment requests.

Run `npm run test:e2e` to capture screenshots and check 360, 390, 768 and 1440px.
Screenshots live under `test-results/foundation-responsive-screens-do-not-overflow-*/`
and `test-results/redesign-*/`. The runner uses a separate `.next-e2e` directory,
port 3100 and empty Supabase configuration. See the implementation status for
checks actually run and authenticated flows still awaiting acceptance.

## Staff appointment review
Signed-in staff can review pending requests at `/admin`, inspect the patient and
session, and approve or decline with confirmation. Declining requires an explanation.
Approval changes the appointment to Scheduled; staff check-in and live queue UI
remain pending. Decisions use the existing transactional RPC with stale-record
protection and retry keys. Use synthetic accounts while authenticated acceptance
checks remain outstanding. `/preview/admin` remains a read-only decision preview.

## Additional connected workflows
- Patients can cancel or request a different session from **Manage appointment**.
- Staff use `/admin/queue` for arrivals, check-in and service queue transitions.
- Checked-in patients see their own queue on `/patient/appointments`, refreshed
  every 15 seconds while visible, with immediate refresh on their own notification events.
- Staff use `/admin/inquiries` for private drafts and published replies; patients
  can follow up from their inquiry threads.
These adapters use existing database functions; signed-in browser and hosted
acceptance testing remains outstanding. See IMPLEMENTATION_STATUS.md for all
remaining MVP work; these changes do not finish the whole application.

## Operations continuation

Staff services/schedules are at `/admin/schedules`; request reports and recent
audit activity are at `/admin/reports`. Patient notifications are at
`/patient/notifications`, with private Realtime refresh and polling fallback.

See [operations setup](docs/OPERATIONS.md) for the notification email worker
(`npm run email:worker`, read-only by default), its required credentials, and the
isolated authenticated browser runner (`npm run test:e2e:auth`). These require
external/local setup before delivery and authenticated acceptance can be verified.
