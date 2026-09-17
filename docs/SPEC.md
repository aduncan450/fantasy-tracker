# Buff Husky Fantasy Tracker — Product & Technical Specification v3

_Last consolidated: 2026-09-17. This document supersedes the earlier v1/v2 planning assumptions. Backward compatibility with v1 is not a requirement._

## 1. Purpose

Buff Husky Fantasy Tracker is a small, mobile-first fantasy-football league app for Duncan, Jacob, Matt, and Weston. It has two intentionally different experiences:

- **Public dashboard:** polished, read-only, compact, and designed for league members.
- **Commissioner portal (`/admin/`):** authenticated editing interface for scores, weekly dues payments, bets, backups, and future league-management features.

The priority order is: minimal commissioner effort, data safety/traceability, mobile usability, simple maintainable code, and effectively zero infrastructure cost.

## 2. Current production architecture

- Repository: `aduncan450/fantasy-tracker`
- Hosting: GitHub Pages from the public GitHub repository.
- Frontend: static HTML, CSS, and vanilla JavaScript; no build step required.
- Canonical datastore: Supabase.
- Supabase contains a league row whose JSON `data` document is the source of truth.
- Public browser clients may read league data.
- Writes require an authenticated commissioner session and are protected by Supabase Row Level Security.
- Commissioner authentication uses Supabase email magic links.
- Browser `localStorage` is used only to retain the commissioner auth session; it is **not** canonical league storage.
- The browser contains only the public/anon Supabase key. Never ship a service-role or privileged key.
- `js/storage.js` is the persistence boundary so storage can be replaced later without rewriting league calculations.

### Important auth/deployment details

The commissioner magic-link redirect must target the deployed admin route:

`https://aduncan450.github.io/fantasy-tracker/admin/`

Supabase URL configuration must permit the deployed GitHub Pages URLs. Magic-link email sending is subject to Supabase's project email rate limit; verification has a separate per-IP rate limit. Do not diagnose every failed test as a redirect bug when the email-send quota has been exhausted.

## 3. 2026–2027 league configuration

- Season: **2026–2027**
- Starting pot: **$0.00**
- Players: Duncan, Jacob, Matt, Weston
- Regular season: Weeks **1–14**
- Fantasy playoffs begin: **Week 15**
- The complete real-world matchup schedule may be supplied later; until then, regular-season matchups use the confirmed recurring three-week cycle below.

### Matchup cycle

1. Duncan vs Matt; Jacob vs Weston
2. Duncan vs Weston; Jacob vs Matt
3. Duncan vs Jacob; Weston vs Matt

Repeat this cycle through Week 14.

## 4. Weekly dues rules

After all four scores for a regular-season week are entered:

- The **lowest overall scorer owes $10**.
- The **loser of the other matchup owes $5**.
- The app derives both charges automatically from scores. The commissioner should not manually assign the $10/$5 payer in normal operation.
- Scores support two decimal places.
- Ties are considered extraordinarily unlikely. If a lowest-score or matchup tie occurs, flag it and stop automatic resolution so the commissioner can decide. Do not over-engineer tie handling unless an actual tie occurs.

### Payment traceability

Each derived weekly charge has its own paid/unpaid state tied to the week that generated it.

Example: if Week 3 creates a $10 Duncan charge and a $5 Matt charge, those are two independently traceable obligations. The commissioner marks each individual weekly charge paid.

This is intentional. Do **not** replace it with only a player-level running payment total.

### Dues accounting

- A generated but unpaid charge increases **Unpaid** and that player's **Owes** amount.
- An unpaid charge does **not** increase the pot.
- Marking a charge paid increases **Collected** and increases the pot by that charge amount.
- Unmarking it reverses that effect.

## 5. Betting rules

The weekly betting model currently supports the league's standard **$10** and **$5** bets.

Bet statuses:

- `placed`
- `won`
- `lost`
- `push`
- `void`

Accounting semantics are intentionally simple:

- **Placing/recording a bet removes its stake from the pot.**
- `payoutCents` means the **total amount returned**, not profit.
- **Any payout entered adds that full amount back to the pot.**
- Therefore a push/void can be represented by returning the stake as the payout when appropriate.

All money is stored/calculated as integer cents.

## 6. Pot and ledger semantics

The pot is derived; it is never a manually editable balance.

`current pot = starting pot + paid weekly dues - bet stakes + bet payouts + explicit adjustments`

Every pot change should be attributable to an event. Explicit corrections should be represented as adjustment transactions rather than editing the balance directly.

### Public summary metrics

The public dashboard must expose at least:

- **Balance:** actual cash currently in the pot.
- **Collected:** weekly dues that have actually been marked paid.
- **Unpaid:** derived weekly dues still outstanding.
- **Week:** current week/workflow position.

Per player, show:

- Number of **$10 weeks**
- Number of **$5 weeks**
- **Owes** amount

These values are derived from weekly history, not independently maintained counters.

## 7. Season payout projection

The current pot is projected as:

- **30% — Playoff champion**
- **20% — each of the other three players**
- **10% — Playoff betting fund**

The 10% is **not a next-season reserve**. It is money reserved for gambling on **this season's playoffs after the fantasy league ends**.

The public dashboard currently labels the section **Season Payout / Current Pot Split**. The three displayed rows should stay compact and mobile-friendly. The “other three players” row does not need the word “each”; it is implied. Current preferred final label for the 10% row is **Playoff Betting Fund**.

Payout projections are based on the live current pot. Rounding must reconcile exactly to the available pot; any residual cent(s) should be absorbed deterministically rather than allowing the displayed split to disagree with the pot.

## 8. Canonical vs derived data

### Canonical data

Store facts the commissioner actually enters or confirms:

- season configuration
- players
- weekly matchup definitions
- scores
- weekly payment flags
- bets and their statuses/payouts
- explicit adjustments
- playoff winner/results when applicable
- metadata such as `lastUpdated`

### Derived data

Calculate rather than independently store:

- matchup winners/losers
- $10/$5 weekly dues
- $10-week/$5-week player counts
- amount owed per player
- collected/unpaid totals
- ledger rows
- current pot
- current week/workflow state
- payout projection amounts

Historical score edits must automatically change any dependent derived results.

## 9. Last-updated semantics

The public header's **Updated** time means **the last time the commissioner successfully saved league data from the admin portal to Supabase**.

It must **not** mean page-load time or page-refresh time.

- `metadata.lastUpdated` starts as `null` for untouched preseason data.
- A successful `saveLeague()` sets it to the save timestamp.
- Public refreshes do not modify it.
- Before the first commissioner save, display a preseason/unsaved state rather than a fabricated current timestamp.

## 10. Public dashboard UX

The public experience is view-only and should be noticeably sleeker than the commissioner portal. Do not expose add/edit/save controls there.

Current visual direction:

- dark sports/fantasy aesthetic
- mobile first
- dense but readable cards
- green accent
- high contrast
- minimal decoration
- equal/symmetrical mobile gutters
- no horizontal page drift; only intentionally scrollable components may overflow horizontally
- most UI labels/headings are uppercase
- **people's names remain normal title case**
- uppercase typography should be smaller/tighter than name/body typography so it does not feel oversized or shouty

Current public information hierarchy includes:

1. season / update state
2. league title
3. Balance / Collected / Unpaid / Week metrics
4. player cards with $10 weeks / $5 weeks / Owes
5. season payout projection
6. Next Up
7. current-week matchup/score/dues details
8. bets
9. recent pot activity/history

The design is still allowed to evolve during enhancement work; preserve the information and accounting semantics, not every current pixel.

## 11. Commissioner portal UX

The admin portal is allowed to be more utilitarian than the public view, but must remain easy to use on an iPhone.

Current capabilities:

- Supabase magic-link sign in
- enter/apply four weekly scores
- automatically derive weekly dues
- mark **individual weekly dues charges** paid/unpaid
- enter the standard $10 and $5 bets
- choose bet status: placed/won/lost/push/void
- enter total payout returned
- save all in-memory changes to Supabase
- export full JSON backup
- import/validate JSON backup into memory, review it, then explicitly save
- sign out

Local edits should not pretend to be remotely saved. UI messaging should distinguish “applied locally” from “saved to Supabase.”

## 12. Data safety

Supabase is authoritative. Preserve these safeguards:

- no direct editable pot field
- integer-cent money math
- schema validation before save/import
- import requires confirmation before replacing current in-memory data
- imported data is not remote until the commissioner explicitly saves
- full JSON export remains available
- failed remote saves must leave previous remote data intact
- historical edits recalculate dependent values
- no privileged Supabase secret in frontend code

## 13. Current source layout

Key files in the repository:

- `index.html` — public shell
- `admin/index.html` — commissioner shell
- `styles.css` — shared visual system/responsive layout
- `js/config.js` — public Supabase configuration + league ID
- `js/schema.js` — initial league document, schedule, validation
- `js/calculations.js` — league rules, dues, player stats, ledger, pot, workflow
- `js/storage.js` — Supabase reads/writes and commissioner auth/session handling
- `js/public.js` — public dashboard rendering
- `js/admin.js` — commissioner portal rendering/actions
- `supabase/schema.sql` — Supabase table/RLS bootstrap
- `docs/SPEC.md` — this living specification/handoff

Keep business rules centralized in calculations/schema/storage modules rather than duplicating them in UI rendering code.

## 14. Current implementation state at handoff

The core foundation is built and deployed:

- GitHub repository is public and GitHub Pages is enabled.
- Public dashboard is live.
- Supabase project is configured and frontend credentials are present.
- Supabase is the canonical remote datastore.
- Public read path works.
- Commissioner magic-link authentication has been wired and tested through the deployment/debug cycle.
- Score entry and automatic dues derivation exist.
- Individual weekly dues payment tracking exists.
- Balance / Collected / Unpaid and per-player $10/$5/Owes metrics exist.
- Bet entry/status/payout accounting exists.
- Season payout projection exists with the corrected 10% playoff-betting meaning.
- JSON export/import exists.
- Last-updated timestamp semantics are commissioner-save based.
- Mobile styling has been iterated, including compact uppercase labels and centered gutters.

The next chat should treat this as an **enhancement phase**, not restart the architecture or rebuild the core.

## 15. Known limitations / good enhancement candidates

These are not necessarily bugs; they are natural next areas to improve:

- The full matchup schedule may later replace/augment the recurring Week 1–14 cycle when provided.
- Week navigation/historical editing can become more explicit and polished.
- “Next Up” workflow logic can become more sophisticated around bets, payment collection, and playoffs.
- Playoff Week 15 setup/results need richer commissioner UX.
- Season-end finalization and actual payout transaction handling can be expanded beyond the current projection.
- Ledger/history presentation can become more complete and filterable.
- Admin unsaved-change indication/recovery can be improved.
- Validation and error messaging can be hardened as real season data exercises edge cases.
- Auth UX can be improved to reduce magic-link friction/rate-limit confusion, while retaining a real security boundary.
- Public visual polish can continue based on real-phone screenshots.

## 16. Human-input principle for future work

Minimize human setup. If ChatGPT/code can safely perform a task, prefer that over asking the commissioner to click through provider dashboards.

Human action should generally be reserved for things requiring account ownership, authorization, secrets/permissions, or subjective league decisions. When a human step is unavoidable, provide phone-friendly, exact step-by-step instructions.

The commissioner is often working **mobile-only**, so do not assume desktop Git/GitHub/Supabase workflows are available.

## 17. Development guidance for future chats

- Work directly against the existing `aduncan450/fantasy-tracker` repository when GitHub access is available.
- Make concrete commits rather than only describing code changes.
- Verify the current file before overwriting it and report the resulting commit SHA.
- Do not optimize for v1 backward compatibility.
- Preserve Supabase as canonical storage unless there is a compelling reason to migrate.
- Preserve the public/admin separation.
- Preserve individual weekly payment traceability.
- Preserve payout semantics and bet accounting exactly unless the commissioner changes a league rule.
- Favor small, understandable vanilla-JS changes over framework migration.
- Use actual mobile screenshots as the source of truth for visual iteration.

## 18. Core invariants

Future enhancements must not accidentally violate these:

1. **Unpaid dues are not cash in the pot.**
2. **Paid weekly dues add cash to the pot.**
3. **Bet stake removes cash when the bet is recorded.**
4. **Payout is total returned and adds the full entered amount.**
5. **Payment status is tracked per weekly charge.**
6. **Balance is derived, never manually edited.**
7. **Public users cannot edit league data.**
8. **Commissioner writes require authenticated Supabase access.**
9. **`lastUpdated` changes only on successful commissioner save.**
10. **The 10% season allocation is for betting on this season's playoffs, not next season.**
11. **Names stay normal case even though most UI labels are uppercase.**
12. **The application must remain comfortable to operate from a phone.**

## 19. Immediate next-chat starting point

Start by reviewing this spec and the current repository, then ask what enhancement should be built first. Do not re-litigate the storage choice, auth architecture, weekly rules, payment semantics, or payout split unless a new requested feature genuinely requires a change.
