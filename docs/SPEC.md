# Buff Husky Fantasy Tracker — Product & Technical Specification

## 1. Purpose
Buff Husky Fantasy Tracker is a small, free/static GitHub Pages + Supabase application for a four-person fantasy league. It tracks weekly fantasy results, loser-funded dues, the shared betting pot, weekly bets, parlay-leg performance, Sleeper scores/projections, season payouts, and commissioner-only PrizePicks actual-wager differences.

The public dashboard is read-only. The commissioner portal is the only write UI. Production Supabase league data is canonical; localStorage must never become canonical production league storage.

## 2. Players and season
Configured players are Duncan, Jacob, Matt, and Weston. Weeks 1–14 are the regular season. Weeks 15–16 are fantasy playoffs. Week 17 is a final betting-only period so returns from the Week 16 playoff period can fund one final set of bets. Week 17 has no fantasy scores, matchups, dues, projections, or Sleeper score sync.

## 3. Weekly dues
For each completed regular-season week, the unique lowest scorer owes $10. The loser of the other matchup owes $5. A single player is never charged both weekly dues. A lowest-score tie or matchup tie requires commissioner resolution and generates no dues until corrected.

Dues are derived from scores and matchups; they are not stored as independent canonical charge rows. Payment status is stored per derived weekly charge using the player and charge amount. Editing historical scores therefore recalculates the applicable dues. Payment flags only continue to apply when the recalculated charge has the same player and amount.

Incomplete or live Sleeper scores never generate dues. A score value of zero is allowed, but an entirely zero week is treated as incomplete rather than a final result.

## 4. Pot accounting
The pot is derived from ledger events and is never manually edited as a balance. Starting pot plus paid dues plus bet payouts plus explicit adjustments minus recorded bet stakes equals the current pot.

Unpaid dues are not cash and do not increase the pot. Recording a $10 parlay removes $10 from the pot. Recording a $5 bet removes $5. A bet payout is the total amount returned, not profit, and the full payout is added back to the pot. Push/void behavior is represented through the payout amount actually returned.

PrizePicks actual-wager differences are deliberately excluded from live pot accounting. They are season-end informational tracking only until an explicit settlement decision is made.

## 5. Weekly bets
Each betting period can contain one $10 parlay and one $5 bet. The parlay has one leg per league player and each leg independently tracks pending, hit, miss, or push. Partial leg outcomes can be saved before the overall parlay settles. Overall bet status supports placed, won, lost, push, and void.

Bets are indexed by the week in which they are placed, not by the dues week that may have contributed cash to the pooled pot. Weeks 1–16 can contain the normal betting records alongside their fantasy-week data. Week 17 is betting-only.

The admin-only $5 bet stake adjustment records the actual PrizePicks amount wagered for each week with a $5 bet. The amount owed to the pot is `$5.00 - actual wager`, bounded from $0 to $5. The season total is derived from those weekly values. It does not create ledger entries and is omitted from the public dashboard.

## 6. Sleeper integration
The configured Sleeper league is used for roster mapping, weekly matchup/score sync, and projections. The commissioner maps each of the four Sleeper rosters to a different configured tracker player. The mapping is stored in league data.

Sleeper score sync can run while a week is live. Synced live scores and matchups may be displayed and saved, but dues stay locked until Sleeper has advanced beyond that NFL week. A synced week records its sync timestamp and finality state. Manually applying scores removes Sleeper sync/finality metadata so manual correction is explicit.

Sleeper projections are pulled separately from scores, reviewed, and explicitly saved. Projection timestamps are stored separately from score-sync timestamps.

## 7. Admin portal
The commissioner portal requires the existing Supabase magic-link session. Session tokens are persisted and refreshed before expiry so normal page refreshes do not require a new email on every visit. Authentication and RLS remain unchanged in TEST MODE.

The admin can navigate directly among Weeks 1–17 without changing the derived workflow week. For Weeks 1–16, matchup context and editable score inputs are presented together in one **Matchups & scores** card so each score is visibly tied to its opponent while entering, reviewing, or syncing scores. The same score form and business logic are used for manual entry and Sleeper-synced data. Week 17 omits scores/matchups/Sleeper controls and retains betting/accounting controls only.

The admin can edit scores, mark each derived weekly due paid/unpaid, create/update bets, save individual parlay leg outcomes, track PrizePicks actual wagers, connect/map/sync Sleeper, pull/save projections, export/import backups, and save all changes. Admin-only PrizePicks tracking is rendered separately but participates in the same main save lifecycle.

## 8. Public dashboard
The public dashboard is read-only and always loads production Supabase data. It shows the current pot, current fantasy week/status, player summaries, unpaid dues, recent results, betting information, parlay performance, season payout projection, and commissioner last-updated time. TEST MODE data is never read by the public dashboard.

When Week 17 contains betting activity, the public betting area identifies it as the final betting week. Week 17 must not be presented as a fantasy matchup/scoring week.

## 9. Season payout
The season payout split is 30% playoff winner, 20% to each of the other three players, and 10% reserved for the current season's Playoff Betting Fund. The 10% is not a generic next-season fund.

## 10. Presentation rules
Names remain normal case. Most labels/headings use the established uppercase visual treatment. Mobile layouts must remain comfortable on an iPhone. Equal-information score/projection fields should have equal visible widths. Avoid arbitrary wrapping that makes paired values appear unrelated. The TEST MODE warning treatment must remain unmistakable and the Exit & discard control must remain legible.

TEST MODE must be unmistakable: the admin page uses a yellow warning treatment, persistent TEST MODE banner, and explicit copy that production Supabase is not being written. Reset and Exit & discard controls are available at the top and are sized for mobile use.

## 11. Data safety and validation
Supabase is authoritative for production. Preserve integer-cent money math, per-charge payment traceability, explicit adjustments instead of direct balance edits, full JSON export/import, confirmation before imported data replaces in-memory state, explicit save after import, and remote-data preservation on failed saves.

`validateLeague()` is a safety boundary for production remote loads/saves, TEST MODE persistence, and backup imports. It validates configured players, required Weeks 1–17 and week types, regular-season matchup uniqueness/completeness, playoff Week 15–16 types, Week 17 betting-only restrictions, nonnegative scores/projections where allowed, supported $5/$10 bet stakes and status enums, structured parlay-leg uniqueness/statuses, payment-key shape, Sleeper roster mapping/timestamps and score-finality state, PrizePicks actual-wager bounds, and explicit adjustment structure. Adjustments must have a nonzero integer-cent amount and a meaningful reason; week-scoped adjustments must reference a real week. Validation should reject malformed canonical state before it can participate in accounting.

`normalizeLeague()` runs before validation on loaded production data, TEST MODE data, and imports so older valid data is upgraded safely in memory instead of being rejected solely for predating Weeks 16–17. It also safely migrates data from the superseded Week-16-final-betting shape into the correct Week 17 record.

## 12. Admin TEST MODE
TEST MODE is an admin-only manual/end-to-end QA sandbox implemented at the persistence boundary.

- Authentication is unchanged. The commissioner must still use the normal Supabase session; TEST MODE does not weaken auth or RLS.
- Entering TEST MODE supports both useful seeds: **Test copy of production** reads and clones the current Supabase league row; **Test clean league** uses `initialLeague()`.
- On entry, the seed is normalized, validated, and stored separately from the mutable test working copy. The seed enables reliable reset to the exact starting snapshot.
- While active, admin loads and all admin save paths use the isolated test working copy in `localStorage`; no league write request is sent to Supabase. This includes Save test changes, saved Sleeper projections, partial parlay-leg saves, Week 17 bets, and PrizePicks actual-wager tracking.
- TEST MODE persists across page refreshes in the same browser so refresh/session behavior can be tested without losing the scenario.
- The admin week selector allows QA to move backward and forward through Weeks 1–17 without altering the derived workflow week.
- **Reset test data** discards mutations and restores the original test seed. **Exit & discard** deletes all test-mode league keys and reloads production from Supabase.
- The public dashboard never reads TEST MODE keys and continues to read the production Supabase row, so test changes cannot leak onto the public dashboard.
- Backup export exports the active test dataset with a test-specific filename. Backup import normalizes and validates the same production shape and replaces only the in-memory test data until the test save action is used.
- `localStorage` TEST MODE data is deliberately browser-local and disposable. It is not production canonical storage, not a shared test environment, and not intended for multi-device persistence.
- This architecture is preferred over a second Supabase row because it requires no RLS/schema expansion, cannot accidentally be selected by the public dashboard, costs nothing, and reuses the production business/UI code. The tradeoff is that the sandbox is tied to one browser/device and can be cleared by browser storage cleanup; for manual QA this is desirable isolation rather than a production durability requirement.

## 13. Frontend cache busting — mandatory
GitHub Pages/mobile browsers can retain stale JS/CSS. Every frontend deployment must ensure changed assets and their dependency graph receive a new URL.

- HTML entry assets use `?v=<deployment-version>`.
- JavaScript ES-module imports also carry the deployment version for local imported modules. Versioning only `public.js` or `admin.js` is insufficient because browsers can separately cache `storage.js`, `calculations.js`, `schema.js`, etc.
- When a shared dependency changes, bump the deployment version through every entry point/import path that can load it.
- Shared CSS changes require a version bump in both public and admin HTML.
- Keep the no-cache HTML meta directives.
- Never rely on users clearing cache or hard-refreshing.

## 14. Source layout
`index.html` public shell; `admin/index.html` admin shell; `styles.css` shared styles plus TEST MODE warning treatment; `js/config.js` public config; `js/schema.js` initial data, Weeks 16–17 normalization/migration, and validation; `js/calculations.js` business rules; `js/storage.js` Supabase/auth, data normalization, and TEST MODE persistence boundary; `js/sleeper.js` Sleeper API; `js/public.js` public rendering including current/final betting-week display; `js/admin.js` core admin UI, shared in-memory admin state, Weeks 1–17 selector, combined matchup/score editor, betting-only Week 17 behavior, and TEST MODE controls; `js/bet-adjustments-admin.js` admin-only weekly PrizePicks UI operating on that shared state; `supabase/schema.sql` database/RLS bootstrap; `README.md` concise repository overview; `AGENTS.md` standing implementation instructions; this file is the living product/technical specification.

Business rules belong in calculation/schema/storage modules rather than UI rendering code. Superseded implementations should be deleted, not hidden with DOM cleanup or left as dead handlers. Unused exported workflow helpers should likewise be removed rather than retained speculatively.

## 15. Current implementation state
Core app is deployed. Supabase read/write/auth/session refresh, automatic dues, individual payment tracking, betting, playoff Weeks 15–16, final betting-only Week 17, per-leg parlay outcomes, Sleeper score sync with live/final gating, Sleeper projections, season payout projection, backups, commissioner-save timestamp semantics, admin historical week navigation, combined matchup/score entry, admin-only PrizePicks stake tracking, backward-compatible Weeks 16–17 normalization/migration, and isolated admin TEST MODE exist. The project is in enhancement/QA phase, not initial architecture design.

## 16. Development workflow
Future sessions should work directly against `aduncan450/fantasy-tracker` when GitHub access is available, inspect current files before overwriting, make concrete commits, and report commit SHAs. Favor small understandable vanilla-JS changes. Use actual mobile screenshots as visual truth. Minimize human setup and assume the commissioner may be mobile-only.

Every implementation change must include a documentation-impact check. Update this spec whenever behavior, data shape, invariants, architecture, deployment procedure, or supported workflow changes. Update README when the concise user/developer overview changes. Update `AGENTS.md` when a new standing engineering lesson or rule is discovered. Documentation is part of the definition of done, not optional follow-up work.

For manual/runtime QA, use TEST MODE for destructive/admin workflow scenarios first. Verify the public dashboard remains unchanged in a separate tab/device as an isolation check. Production should only be used for read-only verification or narrowly intentional real changes.

## 17. Core invariants
1. Unpaid dues are not cash in the pot.
2. Paid dues add cash to the pot.
3. Recording a bet removes its funded stake.
4. Payout is total returned and adds the full amount.
5. Payment status is tracked per weekly charge.
6. Balance is derived, never manually edited.
7. Public users cannot edit league data.
8. Commissioner writes require authenticated Supabase access.
9. Production `lastUpdated` changes only on successful commissioner save to Supabase.
10. The 10% allocation is the current-season Playoff Betting Fund.
11. Names remain normal case while most UI labels are uppercase.
12. The application remains comfortable on a phone.
13. PrizePicks actual-stake differences are admin-only informational tracking until explicit season-end settlement and never affect live pot accounting.
14. Frontend changes must invalidate every changed browser-cached asset, including transitive ES-module dependencies.
15. Documentation must remain synchronized with implementation as part of each change.
