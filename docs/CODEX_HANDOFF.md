# Continue SuperHealth Connect in Codex

## What this transfers
This is a project-focused handoff from the planning conversation, not a full chat transcript. Do not assume your local Codex session can see the original conversation, ChatGPT attachments or its connected app permissions. The repo contains the durable context needed to start.

## User intent
Build a capstone appointment and queue website for Batasan Hills Super Health Center. It should be simple, modern, minimalistic and responsive on mobile and desktop. Use React within Next.js, Supabase Auth and reusable clean architecture. Patient login, appointment scheduling and a queue are central; account review, inquiries and admin operations are also in the supplied flowchart.

## Source map
- TECHNICAL_BLUEPRINT.md: complete proposed specification and acceptance criteria.
- FIGMA_DESIGN.md: Figma URL, 23 screen links, design tokens and implementation gaps.
- SuperHealth-Connect-Flowchart.pdf: original website and research flows.
- ../AGENTS.md: concise instructions for coding agents.
- IMPLEMENTATION_STATUS.md: starting checklist and continuing progress log.

Read the business rules before translating screens. Prefer the blueprint for behavior over demo transitions. If a later user instruction changes a decision, update the affected docs instead of silently keeping conflicting rules.

## Current state
As of this handoff: design and specification are complete as planning deliverables. Application scaffolding, database migrations, authentication, backend integration and tests have not been implemented by this conversation. No Supabase project has been connected and nothing has been deployed. Inspect current repository contents in case implementation has since started.

Queue issuance at staff check-in, pending requests reserving capacity, and manual appointment approval are proposed engineering defaults, not independently approved center policy.

## Open in VS Code
For a fresh checkout:
```powershell
git clone https://github.com/timeqx/superhealth_connect.git
cd superhealth_connect
code .
```

For an existing checkout, preserve uncommitted work, switch to the branch receiving these docs and pull with `git pull --ff-only`. Start a new Codex task from the repository root so its AGENTS.md is included. If the docs are not visible, check the current branch and pull result.

This handoff does not yet create package.json. npm install/npm run dev become available after scaffolding.

## Connect Figma to Codex in VS Code
In the Codex extension, open the gear menu → MCP servers → Add server. Name it figma, select Streamable HTTP, and enter:
```text
https://mcp.figma.com/mcp
```
Save and restart the extension. Authenticate the server with your Figma account when prompted. If an existing Figma plugin already exposes the required tools, use it instead of adding a duplicate server.

If Codex CLI is installed, the equivalent setup is:
```sh
codex mcp add figma --url https://mcp.figma.com/mcp
codex mcp login figma
codex mcp list
```
If the CLI command is unavailable, use the extension UI; do not confuse the VS Code extension with a guaranteed globally installed CLI.

Give Codex a specific screen URL from FIGMA_DESIGN.md. Ask it to inspect the design context and screenshot before implementation. Figma account permissions and tool limits still apply. Repository instructions work without Figma access; visual inspection requires the connection.

The blueprint is already in the repository and needs no separate connector. GitHub MCP is optional for coding a local clone; ordinary git handles local version control and pushing after authentication.

## Starter task to paste into Codex
```text
Read AGENTS.md, docs/CODEX_HANDOFF.md, docs/TECHNICAL_BLUEPRINT.md,
docs/FIGMA_DESIGN.md and docs/IMPLEMENTATION_STATUS.md.
Inspect the repository and preserve existing work.
Implement SuperHealth Connect incrementally on a feature branch using Next.js
App Router, React, TypeScript and Supabase. Start with scaffolding, shared UI
and responsive public/patient/admin layouts based on the linked Figma nodes.
Use the blueprint for real business rules; do not implement prototype bypass buttons.
Inspect Figma through available tools; disclose if unavailable and use the repo's
design fallback. Build real forms, routes and meaningful loading/error states.
Then implement migrations, RLS and transactional appointment/queue workflows in
coherent milestones. Keep credentials out of git. If external credentials are
missing, continue with migrations, tests and clearly labelled synthetic demo UI,
and document the exact setup required. Never claim mock behavior is integrated.
Run the checks actually available and update IMPLEMENTATION_STATUS.md with
completed work, test results, remaining work and blockers.
```

## Practical development approach
1. Scaffold and validate a runnable responsive UI with shared components.
2. Add the account and authorization foundation with local/test Supabase.
3. Implement appointment request/approval/cancellation/reschedule transactions.
4. Implement check-in, queue transitions and live status.
5. Implement inquiries, notification outbox and admin management.
6. Complete security/concurrency/E2E checks and pilot documentation.

Use approved synthetic data for development. No live deployment is implied by the starter task.

## Official setup references
Checked 20 October 2026:
- Codex project instructions: https://developers.openai.com/codex/guides/agents-md/
- Codex MCP and IDE configuration: https://developers.openai.com/codex/mcp/
