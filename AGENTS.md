# SuperHealth Connect — agent instructions

Read these before implementing:
1. docs/CODEX_HANDOFF.md — context, current status, scope and next steps.
2. docs/TECHNICAL_BLUEPRINT.md — business rules, data model, architecture and acceptance criteria.
3. docs/FIGMA_DESIGN.md — design references, tokens, screen map and prototype limitations.

Use docs/SuperHealth-Connect-Flowchart.pdf as the original requirements source. Render its image-based pages when needed; text extraction alone misses the flows.

## Implementation rules
- Build one responsive Next.js App Router + React + TypeScript application with Supabase Auth, PostgreSQL, private Storage and Realtime.
- Use feature-based clean architecture with reusable components. Keep domain rules independent of Next.js and Supabase. Avoid unnecessary abstractions or microservices.
- Figma defines visual intent; the blueprint defines business behavior. Prototype demo buttons must not become production authorization bypasses.
- Read actual Figma nodes through available tools when possible. If inaccessible, use the documented design fallback and disclose that visual fidelity has not been verified.
- Enforce roles and record ownership server-side and with RLS. Never trust role, patient ID, review status or ticket number supplied by the browser.
- Pending appointment requests reserve capacity; admin approval produces Scheduled; staff check-in creates the queue ticket.
- Protect capacity allocation, rescheduling, check-in and call-next with database transactions and locks; implement retry-safe operations.
- Use Asia/Manila for displayed dates and queue service dates, UTC timestamps for stored instants.
- No real patient data or QC IDs in demos, fixtures, logs or commits. Keep uploads private and privileged credentials server-only.
- Never commit environment secrets. Include placeholder .env.example entries and document required setup.
- Prototype values are samples, not live facility policies or schedules. Keep unconfirmed operational rules explicit.
- Inspect current code and git status before changes. Preserve existing work. Start implementation on a feature branch; do not force push.
- Test state transitions, RLS isolation, duplicate submissions, simultaneous booking and queue operations. Run available lint, typecheck, tests and build; report actual results and blockers.
- Keep docs/IMPLEMENTATION_STATUS.md current with implemented, tested, pending and blocked items. Do not equate mock interactions with backend completion.
- Do not deploy or apply migrations to a live database as part of local implementation unless requested.

There are no application commands guaranteed by this documentation handoff. Inspect package.json when one exists; add and document the project's commands during scaffolding.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
