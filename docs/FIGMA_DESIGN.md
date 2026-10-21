# Figma design handoff

File: https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra
File key: cL2gR8UAocta9ZRHmejlra
Page: 0:1 — SuperHealth • Prototype
Snapshot: 20 October 2026. Node references come from the created prototype; refresh through Figma if subsequently changed.

23 editable screens, reusable controls and linked demonstration flows were created. This is a native Figma Design file, not a running app or source-code export.

## Screen map
| Screen | Node | Direct link |
|---|---|---|
| Welcome / Desktop | 3:601 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-601) |
| Patient overview / Desktop | 3:653 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-653) |
| Admin requests / Desktop | 3:696 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-696) |
| Sign in | 3:743 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-743) |
| Create account | 3:766 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-766) |
| Verification upload | 3:791 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-791) |
| Account under review | 3:808 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-808) |
| Patient home | 3:824 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-824) |
| Choose service | 3:847 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-847) |
| Date and time | 3:872 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-872) |
| Review request | 3:903 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-903) |
| Request submitted | 3:931 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-931) |
| Approved appointment | 3:949 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-949) |
| Patient queue | 3:968 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-968) |
| Inquiry | 3:988 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-988) |
| Inquiry received | 3:1007 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-1007) |
| Staff review | 3:1019 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-1019) |
| Staff approved | 3:1038 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-1038) |
| Staff decline | 3:1050 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-1050) |
| Staff queue | 3:1068 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-1068) |
| Staff calling | 3:1086 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-1086) |
| Staff serving | 3:1100 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-1100) |
| Staff completed | 3:1112 | [Open](https://www.figma.com/design/cL2gR8UAocta9ZRHmejlra?node-id=3-1112) |

Prototype starting points: Welcome / Desktop; Sign in / Mobile; Admin requests / Desktop. Open Present and choose a flow.

## Visual system
- Font: DM Sans, Regular/Medium/Bold.
- Background #F5F8F7; white surface #FFFFFF; main text #153C39; secondary text #59716D.
- Primary teal #0F766E; soft green #E2F3EC; border #D9E6E1; pending notice #FFF2D6.
- Desktop screens 1440px wide; mobile examples 390px wide. Implement fluid layouts and verify at 360px, 768px and 1440px.
- Body 15–16px, small labels 12–14px, mobile titles 28px, desktop titles 36px, landing display 58px.
- Rounded white cards (approximately 18px), restrained borders, 24px card padding, 20–24px gaps.
- Buttons approximately 46–48px tall, 10px radius. Make interactive targets at least 44px.
- Adapt desktop columns into mobile stacks; do not render a fixed-size Figma canvas in the app.
- Shared components: buttons, inputs, status badges, service cards, appointment cards, date/slot picker, queue ticket, inquiry thread and staff review panel.

These are the original prototype colors. The implemented redesign section below supersedes them; blueprint behavior remains authoritative.

## Layout intent without Figma access
Landing: brand/navigation, two-column headline and “How it works” card, three service cards, concise footer.
Patient desktop: greeting, wide upcoming appointment card beside booking action, recent activity.
Admin desktop: overview metrics, requests table beside a queue summary.
Mobile: compact header, single-column tasks, clear primary action, readable status and details.
Booking: service selection → available date/session → review → pending receipt.
Queue: prominent neutral Q-number, waiting/called state, people ahead, current desk and last update.

## Prototype limitations — do not copy as business logic
- Inputs, upload controls, dates and metrics contain sample values. Not every visible element is wired.
- Some demo links jump between desktop and mobile frames. The app must remain responsive within one route system.
- “Preview approved account”, “Preview approved appointment” and “Preview after staff check-in” only demonstrate states. Remove them from production.
- The demonstrated booking path uses Immunizations and a 9:00 session. Implement real service/date/slot selection and retain the selected data throughout; never hardcode this path.
- Only a subset of seven service categories is represented by cards. Implement the full blueprint catalog as data.
- Registration needs the complete blueprint fields, not just the compact Figma form.
- Cancellation/rescheduling, reset-password, account rejection/resubmission, admin scheduling, service management, inquiry inbox/replies, notification history, reports and many error/empty/loading states still need UI implementation.
- Some screen-to-screen sample references are illustrative rather than one consistent database record.
- Staff queue demonstration is simplified. Implement skip/requeue, no-show, idempotency, concurrency and history per the blueprint.
- Center hours, eligibility, service requirements and priority rules need confirmation before a live pilot.

## Figma access in local Codex
A URL in this file does not grant access. Configure Figma MCP in your local Codex installation and authenticate an account that can access this file. See CODEX_HANDOFF.md. If tools are unavailable, use this document to start and request screenshots only when needed to resolve visual uncertainty.

## Implemented redesign direction — 21 October 2026

The user's redesign request supersedes the original visual-system and layout
intent sections above. The Figma screen map is a workflow reference, not a pixel
matching target. Figma MCP inspection for this redesign was blocked by the
Starter-plan tool limit. The app changed; the Figma file was not edited.

The application now uses warm off-white, charcoal/green text, deep teal actions,
soft mint and pale-blue ambient backgrounds. Glass is limited to inset navigation
and a small visit-preview panel; forms and records use solid surfaces. DM Sans
is locally hosted. Spacing and density vary by task: generous public introduction,
focused patient visit cards, and compact staff rows with a detail Sheet.

Theme authority: `src/app/globals.css`. Semantic variables include `background`,
`foreground`, `card`, `primary`, `secondary`, `muted`, `accent`, `border`, `input`,
`ring`, `destructive` and `radius`; foreground tokens accompany filled surfaces.
Shared `glass-surface` includes an opaque fallback. Motion respects reduced-motion.

| Product composition | Location / primitive mapping |
| --- | --- |
| AppHeader and mobile navigation | `shared/ui/app-header.tsx`; Button, Radix-backed Sheet |
| Patient navigation / staff sidebar | `shared/ui/workspace-nav.tsx`; active links with icons |
| ServiceCard, AppointmentCard, AppointmentStatusBadge | `shared/ui/care-components.tsx`; shared Card/Badge conventions |
| BookingStepper and SlotPicker | care components / booking-form; Input native calendar, radio labels, Button |
| QueueTicket | `shared/ui/queue-ticket.tsx`; display-only synthetic states, no live queue adapter |
| InquiryThread | `features/inquiries/presentation/inquiry-thread.tsx`; private published messages |
| AdminRequestPanel | `shared/ui/admin-request-panel.tsx`; accessible Sheet and existing review controls |
| AuthShell | `shared/ui/auth-shell.tsx`; existing auth forms and server actions |

Preview routes: `/preview/patient`, `/preview/booking`, `/preview/queue`,
`/preview/admin`. Every preview is explicitly synthetic. Booking maintains service,
date and session across review, and ends in pending approval rather than Scheduled.
The native date input provides browser calendar and keyboard entry; dates without
published sessions show an unavailable message. Full sessions remain visible and
disabled. On mobile, summaries are compact and staff rows stack without clipping.

Responsive screenshots are generated by `npm run test:e2e` at 360, 390, 768 and
1440px in `test-results/`. Live authenticated acceptance and a full accessibility
audit remain separate pending work; see IMPLEMENTATION_STATUS.md.
