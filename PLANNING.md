# ListenLore — Project Plan

A timeline platform for Listen Labs company history. Curated **milestones** form the
chronological spine; employee-submitted **moments** attach to milestones (or float free).
Launch target: **live before Sept 8, 2026** (Hawaii offsite, Sept 8–11).

## Concept

- **Milestones** — major company events (founding, YC, funding rounds, offsites,
  billboards, launches). Admin-curated only (Brannon + Claude). Big fixed nodes on the
  timeline.
- **Moments** — personal memories submitted by any Listen Labs employee. Unlimited per
  person, instantly published, attachable to a milestone. Fields: title/body,
  category, author (automatic from sign-in), tagged people, date (can be approximate),
  optional location, optional media, edit/delete own; admin can edit/delete any.
- **View 1 (launch):** vertical scrolling chronological timeline.
- **View 2 (post-launch):** spatial node-graph view — same data, second renderer.
  Data model is graph-shaped from day one (milestones = anchor nodes, moments =
  attached nodes, people = shared entities) so this is a re-projection, not a rebuild.
- **Later:** ElevenLabs synthetic CEO voice-over; a Listen Labs study that interviews
  employees about favorite memories and auto-converts parsed stories into moments
  (Claude session has Listen Labs MCP access — transcripts/analyses are readable
  programmatically).

## Stack & architecture decisions (settled)

| Decision | Choice |
|---|---|
| Frontend | Next.js (App Router), deployed on Vercel |
| Vercel team | **Listen Labs** (`team_wjbsRET4nYIQVL1oXEyzZ5dZ`, enterprise; Rippling SAML enforced + SCIM sync active) |
| Viewing wall | Vercel deployment protection → viewers must be Listen Labs team members via Rippling SSO. No app code needed. |
| App identity | Supabase Auth, **Sign in with Google restricted to `@listenlabs.ai`** — needed because Vercel's wall doesn't pass identity to the app. Used for authorship + edit/delete-own. |
| Database / storage | Supabase project `crutklapshsqpkqxfrqr` (https://crutklapshsqpkqxfrqr.supabase.co). Postgres for milestones/moments/people, Storage bucket for media. Keys live ONLY in env vars (local `.env.local`, Vercel env) — never committed. |
| Moderation | Instant publish; admin (Brannon) can edit/delete anything. |
| URL | Vercel URL first (e.g. listenlore.vercel.app on the LL team); custom domain later. |
| Categories | From the source sheet: **Fundraising / Product / Brand / Events / Team / Customers** — stored as data, not hardcoded, so they can change/grow. |
| HEIC media | Converted to JPEG at ingestion; uploads converted server-side or client-side at submit time. |

## Design direction (settled)

- **Brand:** Listen Labs brand plugin — https://github.com/brannonwellington-design/listen-labs-brand-plugin
  Paper theme default (warm cream `#F9F4EB` surfaces, ink `#120F08`, brand blue
  `#0021CC`), full light/dark token set in `GUIDELINES.md` + `docs/tokens.css`; logo SVG
  in `assets/`. Brand supplies **color, type, voice**.
- **Layout:** Müller-Brockmann Grid Systems skill —
  https://github.com/alex-hyperagent/hyperagent-public-skills/blob/main/skill-muller-brockmann-grid-systems.json
  Supplies **grid discipline, hierarchy, layout**: 12-col modular grid, 8px baseline,
  subgrid bands, optical alignment, verification harness. Where the two conflict on
  palette (M-B skill says white+red), **brand wins on color/type; M-B wins on structure**.
- Possible easter egg: keep the grid-overlay toggle (`G` key).

## Content sources

- **Seed spreadsheet** ("LORE", Google Sheets `1YDXYW7fkk6Ik30CVMtJkrTFewgA65p88FEEHjM3pgdw`):
  33 seeded moments with category/sub-category/description/author/tagged/date/location/media
  filename; plus an anchor list of 18 named events (the de-facto milestone list).
- **Milestones worksheet** (created for Brannon to fill in dates/blurbs, Google Sheets
  `1_jUOQcbpSuMvi6bfuEMsSf4SnusCNRWO68Ou0MQ7WSs`, in the LORE Drive folder): all 18
  anchors + Founding, Y Combinator, Seed Round, 100 Employees, Hawaii Offsite.
- **Media** (Google Drive folder `1kkDyypdp3941FUcJlplqf2RtXTgs_Fyq`, "LORE"): category
  subfolders (Fundraising/Product/Brand/Events/Team/Customers) each containing
  per-milestone subfolders; some files loose in root. Filenames follow
  `category_subcategory_MM-DD-YYYY[-n].ext`. Owners: diana@, maddie@listenlabs.ai.
- Known data caveat: many moment dates are upload dates (bulk 5/26/2026), not event
  dates — ingest as approximate; owners can correct via edit controls.

## Week plan

- **Sept 1–2** — unblock network (see below); Supabase schema + storage; ingest
  spreadsheet + Drive media; design mocks (brand × grid) for Brannon to react to.
- **Sept 3–4** — build timeline read-only; deploy to Listen Labs Vercel behind Rippling.
- **Sept 5–6** — Google sign-in, moment submission form, attach-to-milestone, media
  upload, edit/delete-own, admin controls.
- **Sept 7** — polish, seed Hawaii milestone, launch.
- **Post-launch** — node view, voice-over, study→moment pipeline.

## Open items

1. **Network policy (blocker):** session environment must allow `*.supabase.co`,
   `supabase.com`, `listenlabs.ai` (Custom allowlist + keep default package managers).
2. **Milestone dates/blurbs:** Brannon filling in the worksheet.
3. Supabase keys: Brannon has provided; store in env vars when unblocked.

## Session context

- Dev branch: `claude/listen-labs-planning-iq847x` (repo `brannonwellington-design/listenlore`).
- Listen Labs MCP orgs available: "Listen Labs Main" (admin), "Brannon's Personal".
- Brannon's strengths: design/layout/concepts/prototyping; wants the most support on
  hosting, GitHub, and front/back-end plumbing — explain those parts in plain language.
