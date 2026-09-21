# Buff Husky Fantasy Tracker — Product & Technical Specification v4

_Last consolidated: 2026-09-20. This is the living implementation specification and must be reviewed as part of every functional change._

## 1. Purpose
Buff Husky Fantasy Tracker is a small, mobile-first fantasy-football league app for Duncan, Jacob, Matt, and Weston. The public dashboard is polished/read-only; `/admin/` is the authenticated commissioner interface. Priorities: minimal commissioner effort, data safety/traceability, mobile usability, maintainable vanilla JS, and effectively zero infrastructure cost.

## 2. Architecture
- GitHub Pages static hosting; HTML/CSS/vanilla JS, no build step.
- Supabase JSON league row is canonical production storage. Public may read; authenticated commissioner writes are protected by RLS.
- Only the public/anon Supabase key may ship in frontend code.
- Production league state never uses browser storage as canonical storage. `localStorage` stores the commissioner auth session and, only while TEST MODE is explicitly active, an isolated disposable test dataset.
- `js/storage.js` is the persistence boundary and selects production Supabase or isolated TEST MODE persistence for the admin portal.
- Magic-link redirect: `https://aduncan450.github.io/fantasy-tracker/admin/`.
- Sessions persist locally and refresh with the Supabase refresh token shortly before expiry. A page refresh should not normally require a new magic link.

## 3. League configuration
Season 2026–2027; starting pot $0; players Duncan, Jacob, Matt, Weston; regular season Weeks 1–14; playoffs begin Week 15. Recurring matchup cycle: (1) Duncan–Matt / Jacob–Weston, (2) Duncan–Weston / Jacob–Matt, (3) Duncan–Jacob / Weston–Matt, repeated through Week 14 unless replaced by confirmed Sleeper matchups.

## 4. Weekly dues
After all four regular-season scores are final, lowest overall scorer owes $10 and loser of the other matchup owes $5. Scores support two decimals. Ties stop automatic resolution. Each weekly charge has its own paid/unpaid state. Unpaid charges increase Unpaid/Owes but not the pot; paid charges increase Collected and the pot. Historical score changes recalculate derived dues.

Weekly calculations fail closed if the matchup structure is malformed: a regular-season week must contain exactly two matchups and use all four configured players exactly once. Invalid matchup data must never silently generate dues.

## 5. Sleeper integration
The commissioner can map all four Sleeper rosters to tracker players. Score sync may occur while games are live. A Sleeper sync stores the scores plus a finality flag derived from Sleeper's current NFL state. Synced scores do not resolve dues, advance the workflow week, enter season averages, or appear as completed results until Sleeper has advanced beyond the synced NFL week. Re-syncing after advancement marks that week's scores final. Manual score entry is an explicit commissioner override and removes the Sleeper sync/finality markers before applying the manually entered values.

Sleeper matchups can replace the default matchup cycle for the synced week. Projections are pulled separately, reviewed, and saved. Public upcoming matchups show season average and saved Sleeper projection with equal visual treatment.

In TEST MODE the real read-only Sleeper APIs are still used so mapping, score-sync/finality, and projection workflows can be exercised. Their results are written only into the isolated test dataset.

## 6. Betting
Standard weekly bets are a $10 parlay and a $5 bet. Bet statuses: `placed`, `won`, `lost`, `push`, `void`. Recording a bet removes its full funded stake from the pot. `payoutCents` is total cash returned, not profit, and is added in full.

The $10 parlay has one leg per league player. Individual leg statuses are `pending`, `hit`, `miss`, `push` and may be saved as each leg settles independently of the overall parlay outcome. Public player cards summarize decided parlay legs and recent leg outcomes. Validation prevents duplicate players within structured parlay legs. Existing pre-leg-tracking $10 parlays stored as descriptions remain valid and are upgraded by the admin editor when edited.

### PrizePicks $5 stake adjustment
PrizePicks may reduce the amount actually wagered below the $5 funded by the pot so the possible payout is an even dollar amount. The commissioner records the actual wager for each week containing a $5 bet. The difference `$5.00 - actual wager` is the amount the bet placer owes back to the pot at season end.

This tracking is strictly admin-only during the season. `betPlacerActualBets` is canonical informational data, but its calculated amount owed is excluded from the public dashboard, ledger, current pot, payout projection, and all other live accounting. PrizePicks inputs mutate the same in-memory league object used by the rest of the admin portal and are persisted only by the portal's normal save lifecycle. The feature must never independently load/save a second full league copy. Saving these values must never create an adjustment transaction. Any legacy `season-bet-placer-adjustment` row is ignored by live ledger calculations and is removed when PrizePicks tracking is edited. Season-end settlement will be implemented explicitly when needed.

## 7. Pot and payout semantics
`current pot = starting pot + paid weekly dues - bet stakes + bet payouts + valid explicit adjustments`.
Balance is derived and never directly editable. Public metrics include Balance, Collected, Unpaid, Week; player cards include $10 weeks, $5 weeks, parlay-leg results, and Owes.

Current-pot projection: 30% playoff champion, 20% each other player, 10% Playoff Betting Fund. The 10% is for gambling on this season's playoffs after the fantasy league ends, not a fee or next-season reserve. Rounding must reconcile exactly to the pot.

## 8. Canonical vs derived data
Canonical production data: season config, players, weekly matchups, scores, score-finality state, payments, bets/legs/statuses/payouts, Sleeper roster mapping, saved projections/sync timestamps, PrizePicks actual wagers, explicit legitimate adjustments, playoff results, metadata.

Derived: matchup results, dues, player counts/owes, parlay hit-rate summary, collected/unpaid totals, PrizePicks amount owed, ledger, pot, workflow week, averages, payout projections.

TEST MODE contains a disposable validated copy of the same canonical data shape so the same schema, calculations, Sleeper code, admin forms, import/export, and save workflows are exercised without creating a second business-logic implementation.

## 9. Last updated
`metadata.lastUpdated` means the last successful save through the active persistence target. In production this is the last successful commissioner save to Supabase and drives the public Updated display. In TEST MODE it is test-only metadata and is never visible publicly. Public page loads/refreshes never modify production `lastUpdated`.

## 10. UX invariants
Mobile-first dark sports aesthetic, green accent, dense/readable cards, symmetric gutters, no accidental horizontal overflow. Most labels/headings are uppercase but people's names remain title case; uppercase typography should be compact. Public is read-only and visually polished. Admin may be utilitarian but must remain comfortable on an iPhone. Local edits must clearly distinguish themselves from saved state.

The admin portal defaults to the derived workflow week but includes an explicit week selector so the commissioner can return to prior weeks to review or edit historical scores, bets, projections, and related data. Selecting a historical week must not change the derived workflow week itself.

TEST MODE must be unmistakable: the admin page uses a yellow warning treatment, persistent TEST MODE banner, and explicit copy that production Supabase is not being written. Reset and Exit & discard controls are available at the top and are sized for mobile use.

## 11. Data safety and validation
Supabase is authoritative for production. Preserve integer-cent money math, per-charge payment traceability, explicit adjustments instead of direct balance edits, full JSON export/import, confirmation before imported data replaces in-memory state, explicit save after import, and remote-data preservation on failed saves.

`validateLeague()` is a safety boundary for production remote loads/saves, TEST MODE persistence, and backup imports. It validates configured players, required Weeks 1–15 and week types, regular-season matchup uniqueness/completeness, nonnegative scores/projections, supported $5/$10 bet stakes and status enums, structured parlay-leg uniqueness/statuses, payment-key shape, Sleeper roster mapping/timestamps and score-finality state, PrizePicks actual-wager bounds, and explicit adjustment structure. Adjustments must have a nonzero integer-cent amount and a meaningful reason; week-scoped adjustments must reference a real week. Validation should reject malformed canonical state before it can participate in accounting.

## 12. Admin TEST MODE
TEST MODE is an admin-only manual/end-to-end QA sandbox implemented at the persistence boundary.

- Authentication is unchanged. The commissioner must still use the normal Supabase session; TEST MODE does not weaken auth or RLS.
- Entering TEST MODE supports both useful seeds: **Test copy of production** reads and clones the current Supabase league row; **Test clean league** uses `initialLeague()`.
- On entry, the seed is validated and stored separately from the mutable test working copy. The seed enables reliable reset to the exact starting snapshot.
- While active, admin loads and all admin save paths use the isolated test working copy in `localStorage`; no league write request is sent to Supabase. This includes Save test changes, saved Sleeper projections, and partial parlay-leg saves.
- TEST MODE persists across page refreshes in the same browser so refresh/session behavior can be tested without losing the scenario.
- The admin week selector allows QA to move backward and forward through Weeks 1–15 without altering the derived workflow week.
- **Reset test data** discards mutations and restores the original test seed. **Exit & discard** deletes all test-mode league keys and reloads production from Supabase.
- The public dashboard never reads TEST MODE keys and continues to read the production Supabase row, so test changes cannot leak onto the public dashboard.
- Backup export exports the active test dataset with a test-specific filename. Backup import runs the same production validation and replaces only the in-memory test data until the test save action is used.
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
`index.html` public shell; `admin/index.html` admin shell; `styles.css` shared styles plus TEST MODE warning treatment; `js/config.js` public config; `js/schema.js` initial data + validation; `js/calculations.js` business rules; `js/storage.js` Supabase/auth and TEST MODE persistence boundary; `js/sleeper.js` Sleeper API; `js/public.js` public rendering; `js/admin.js` core admin UI, shared in-memory admin state, historical week selector, and TEST MODE controls; `js/bet-adjustments-admin.js` admin-only weekly PrizePicks UI operating on that shared state; `supabase/schema.sql` database/RLS bootstrap; `README.md` concise repository overview; `AGENTS.md` standing implementation instructions; this file is the living product/technical specification.

Business rules belong in calculation/schema/storage modules rather than UI rendering code. Superseded implementations should be deleted, not hidden with DOM cleanup or left as dead handlers. Unused exported workflow helpers should likewise be removed rather than retained speculatively.

## 15. Current implementation state
Core app is deployed. Supabase read/write/auth/session refresh, automatic dues, individual payment tracking, betting, per-leg parlay outcomes, Sleeper score sync with live/final gating, Sleeper projections, season payout projection, backups, commissioner-save timestamp semantics, admin historical week navigation, admin-only PrizePicks stake tracking, and isolated admin TEST MODE exist. The project is in enhancement/QA phase, not initial architecture design.

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
16. Malformed matchup or canonical data must fail validation/calculation safely rather than generate financial results.
17. Sleeper-synced live scores must not create dues or completed-week statistics until the synced week is final.
18. Admin features that edit canonical league data must share the main admin in-memory/save lifecycle rather than independently loading and saving the full league row.
19. TEST MODE must never write the production league row or expose test data through the public dashboard.
20. TEST MODE must exercise the same league data shape, validation, calculations, admin workflows, and external Sleeper reads as production wherever applicable.
21. Admin historical-week navigation is a view/edit selection only and must not alter the derived workflow week.
