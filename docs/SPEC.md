# Buff Husky Fantasy Tracker — Product & Technical Specification

## 1. Purpose
Buff Husky Fantasy Tracker is a small, free/static GitHub Pages + Supabase application for a four-person fantasy league. It tracks weekly fantasy results, loser-funded dues, the shared betting pot, weekly bets, parlay-leg performance, Sleeper scores, season payouts, and commissioner-only PrizePicks actual-wager differences.

The public dashboard is read-only. The commissioner portal is the only write UI. Production Supabase league data is canonical; localStorage must never become canonical production league storage.

## 2. Players and season
Configured players are Duncan, Jacob, Matt, and Weston. Weeks 1–14 are the regular season. Weeks 15–16 are fantasy playoffs. Week 17 is a final betting-only period so returns from Week 16 can fund one final set of bets. Week 17 has no fantasy scores, matchups, dues, or Sleeper score sync.

## 3. Weekly dues
For each completed regular-season week, the unique lowest scorer owes $10. The loser of the other matchup owes $5. A single player is never charged both weekly dues. A lowest-score tie or matchup tie requires commissioner resolution and generates no dues until corrected.

Dues are derived from scores and matchups. Payment status is stored per derived weekly charge using player and charge amount. Editing historical scores recalculates dues; payment flags only continue to apply when the recalculated charge has the same player and amount.

Incomplete or live Sleeper scores never generate dues. A score value of zero is allowed, but an entirely zero week is treated as incomplete rather than final.

## 4. Pot accounting
The pot is derived: starting pot + paid dues + bet payouts + explicit adjustments - recorded bet stakes. Unpaid dues are not cash. A bet payout is total cash returned, not profit.

PrizePicks actual-wager differences are excluded from live pot accounting and are season-end informational tracking only until an explicit settlement decision is made.

## 5. Weekly bets
Each betting period can contain one $10 parlay and one $5 bet. The parlay has one leg per league player; each leg independently tracks pending, hit, miss, or push. Overall bet status supports placed, won, lost, push, and void.

Bets are indexed by the week in which they are placed. Weeks 1–16 can contain bets alongside fantasy-week data. Week 17 is betting-only.

The admin-only $5 bet stake adjustment records the actual PrizePicks amount wagered for each week with a $5 bet. Amount owed to the pot is `$5.00 - actual wager`, bounded from $0 to $5. It does not create ledger entries and is omitted from the public dashboard.

Supported bet descriptions can be checked against ESPN NFL scoreboard/box-score data. Result detection is review/display-first: it only settles supported outcomes from final games, never changes payouts, never changes the overall parlay status, and never writes canonical data directly. Unsupported/ambiguous descriptions, live games, unavailable source data, and non-unique player/team matches remain unchanged.

Initial supported descriptions are rushing/receiving/passing yards, receptions, rushing/receiving/passing touchdowns, anytime TD, and team-to-win/moneyline wording.

## 6. Sleeper integration
The Sleeper league ID is configured in code. There is no user-facing connection/authentication step because Sleeper league metadata and public matchup data require no persistent connection. Admin automatically loads league and roster metadata when available.

The commissioner maps each Sleeper roster to a different tracker player. The mapping is stored in league data and normally only needs setup once; admin provides an edit-mapping control for corrections.

For the current NFL/fantasy week, the public dashboard fetches that week's Sleeper matchups and scores directly on page load. These values are a read-only presentation overlay labeled **LIVE · SLEEPER**. They are never written to Supabase by the public page, never generate dues, and never affect pot/accounting. If Sleeper is unavailable or the tracker workflow week does not match Sleeper's current NFL week, public rendering falls back to saved production data.

Commissioner score sync remains available. It imports Sleeper matchups/scores into the selected tracker week and records sync/finality metadata. Synced scores do not generate dues until Sleeper has advanced beyond that NFL week. Manually applying scores removes Sleeper sync/finality metadata so manual correction is explicit.

Sleeper projections are intentionally not part of the tracker. They duplicated information already available in Sleeper and did not drive a tracker-specific workflow.

## 7. Admin portal
The commissioner portal requires the existing Supabase magic-link session. Session tokens persist and refresh before expiry. Authentication and RLS are unchanged in TEST MODE.

The admin can navigate Weeks 1–17 without changing the derived workflow week. For Weeks 1–16, matchup context and editable score inputs share one **Matchups & scores** card. Week 17 omits scores/matchups/Sleeper controls and retains betting/accounting controls only.

The admin can edit scores, mark each derived due paid/unpaid, create/update bets, save individual parlay leg outcomes, preview supported NFL bet results, apply detected statuses locally for commissioner review, track PrizePicks actual wagers, edit Sleeper roster mapping, sync Sleeper scores, export/import backups, and save all changes. Admin-only PrizePicks tracking participates in the same main save lifecycle.

Admin in-memory mutations are tracked with an explicit dirty state. After an Apply/import/sync/payment/direct-entry action changes tracker data without persisting it, the portal shows **UNSAVED CHANGES** plus a fixed mobile-friendly **Save now** control. Successful production or TEST MODE persistence clears the dirty state. Browser unloads and destructive admin actions such as sign-out or changing test datasets warn before discarding dirty data. Draft text typed into forms that still require their existing **Apply** action is not falsely represented as persisted in-memory tracker data; changing weeks or otherwise discarding an unapplied draft prompts separately.

The admin also derives a **Weekly closeout** checklist from existing tracker state; no new closeout fields are stored. Started/current weeks are evaluated for score finality where applicable, regular-season dues payment completion, overall parlay settlement, individual parlay-leg completion, and $5 bet settlement. The week selector marks the derived workflow week with `← CURRENT`, unresolved started weeks with `•`, and cleared started weeks with `✓`. Future untouched weeks remain unmarked. Historical cleared weeks drop out of the closeout card while remaining visibly checked in the selector.

Automated bet-result checking is deliberately separate from persistence/accounting. The checker reads the currently entered bet descriptions, fetches the selected NFL week's ESPN scoreboard and box scores, and shows evidence for each proposal. **Check results** is read-only. **Apply detected statuses locally** only changes the current admin form/data in memory. Production Supabase and pot/accounting change only after the existing **Save all changes** action, exactly like other admin edits. Payout values and overall parlay status remain commissioner-entered.

## 8. Public dashboard
The public dashboard loads canonical production Supabase data for accounting/history and may overlay current-week Sleeper matchups/scores plus supported unresolved NFL bet outcomes for display only. TEST MODE data is never read by the public dashboard.

It shows pot, current fantasy week, player summaries, unpaid dues, recent finalized results, current live/upcoming matchup information, betting information, parlay performance, season payout projection, and last commissioner-save status. Matchup lifecycle is attached to the matchup section itself: **UPCOMING** before live scores, **LIVE · SLEEPER** while a current-week Sleeper overlay is active, and **FINAL** on finalized result cards. The global header no longer acts as the live-state indicator; it retains the last commissioner-update timestamp.

For betting, commissioner-saved statuses always take precedence. Only parlay legs still saved as `pending` and $5 bets still saved as `placed` are eligible for a public automatic overlay. A supported final result may display as an `auto` result beside/over the unresolved saved status, together with copy that it is read-only until the commissioner saves the official status. Public automatic results never update Supabase, payouts, overall parlay status, player parlay statistics, ledger entries, pot balance, or season payout calculations. If ESPN is unavailable or the result cannot be resolved safely, the public page falls back to saved tracker status. Already commissioner-settled bets do not need an ESPN check.

The betting section also derives a presentation-only lifecycle separate from canonical bet status. Before any bet exists there is no lifecycle badge. Entered but unresolved bets display **PLACED**; the section displays **LIVE** once saved/automatic leg or single-bet outcomes begin resolving while at least one overall bet remains placed; it displays **FINAL** after the commissioner-saved overall bet statuses are all settled. When Week 17 contains betting activity, the public betting area identifies it as the final betting week. Week 17 is never presented as a fantasy matchup/scoring week.

## 9. Season payout
The season payout split is 30% playoff winner, 20% to each other player, and 10% reserved for the current season's Playoff Betting Fund.

## 10. Presentation rules
Names remain normal case. Most labels/headings use the established uppercase visual treatment. Mobile layouts must remain comfortable on an iPhone. Equal-information fields should have equal visible widths. Avoid arbitrary wrapping that makes paired values appear unrelated.

The public dashboard uses a dedicated visual layer rather than changing admin styling. Its header uses uppercase **BUFF HUSKY FANTASY TRACKER** preceded by the green vertical bar, a smaller `2026–2027 SEASON | WEEK X` line, and restrained husky-with-sunglasses/mountain artwork. The public top summary is one cohesive panel: **Week** and **Pot** are the primary values; **Collected** and **Unpaid** are secondary stacked values. Use icons where they improve scanability (calendar/week, pot/coins, trophies for winners, dice for the parlay, target/dart for the $5 bet), but avoid decorative slogans or iconography with no data meaning.

Final matchup styling may emphasize winners with a restrained green gradient and trophy icon. Preserve the dues-result colors: the unique lowest scorer uses muted red and the other matchup loser uses muted orange. Styling should stay dashboard-first rather than poster-like; brand art is concentrated in the header and should not compete with the data.

TEST MODE must be unmistakable with its yellow warning treatment, persistent banner, and explicit production-safety copy. Reset and Exit & discard controls must remain legible and mobile-friendly.

Admin dirty-state controls must remain visible without forcing the commissioner back to the top of a long mobile page. The sticky save control must not obscure form content; the admin shell reserves bottom space while it is visible.

## 11. Data safety and validation
Supabase is authoritative for production. Preserve integer-cent money math, per-charge payment traceability, explicit adjustments instead of direct balance edits, JSON export/import, confirmation before import replacement, explicit save after import, and remote-data preservation on failed saves.

`validateLeague()` is the safety boundary for production loads/saves, TEST MODE persistence, and backup imports. It validates configured players, Weeks 1–17 and week types, regular-season matchups, playoff Weeks 15–16, Week 17 restrictions, scores, supported bets/statuses, parlay legs, payment keys, Sleeper roster mapping/sync state, PrizePicks actual-wager bounds, and explicit adjustments. Legacy projection fields may remain valid in older backups/data for backward compatibility, but the application no longer creates or displays projections.

`normalizeLeague()` runs before validation on production data, TEST MODE data, and imports. It upgrades older valid data and migrates the superseded Week-16-final-betting shape into Week 17.

Bet-result proposals/overlays, admin dirty state, unapplied-draft state, weekly closeout status, and week-selector attention markers are transient UI state and are not part of the league schema. No external result feed is allowed to write canonical league data directly.

## 12. Admin TEST MODE
TEST MODE is an admin-only manual/end-to-end QA sandbox implemented at the persistence boundary.

- Authentication is unchanged.
- **Test copy of production** clones current Supabase league data; **Test clean league** uses `initialLeague()`.
- Seed and mutable working copy are stored separately for reliable reset.
- Admin save paths use isolated test `localStorage`; no league write is sent to Supabase.
- TEST MODE persists across page refreshes in the same browser.
- The week selector supports Weeks 1–17 and retains the same derived closeout/attention markers as production admin.
- **Reset test data** restores the seed. **Exit & discard** deletes test keys and reloads production.
- Dirty-state warnings, unapplied-draft warnings, and the sticky save control behave the same way in TEST MODE, while saving targets only isolated test storage.
- The public dashboard never reads TEST MODE keys. Its live Sleeper and automatic bet-result overlays are independent of TEST MODE and remain read-only.
- Backup export/import uses the active test dataset while TEST MODE is active.
- TEST MODE is browser-local and disposable, not canonical or multi-device storage.

## 13. Frontend cache busting — mandatory
GitHub Pages/mobile browsers can retain stale JS/CSS. Every frontend deployment must ensure changed assets and their dependency graph receive a new URL.

- HTML entry assets use `?v=<deployment-version>`.
- JavaScript ES-module imports also carry the deployment version for local imported modules.
- When a shared dependency changes, bump the deployment version through every entry point/import path that can load it.
- Shared CSS changes require a version bump in both public and admin HTML.
- Public-only CSS uses its own versioned URL in `index.html`; admin-only CSS uses its own versioned URL in `admin/index.html`.
- Keep no-cache HTML meta directives.
- Never rely on users clearing cache or hard-refreshing.

## 14. Source layout
`index.html` public shell; `admin/index.html` admin shell; `styles.css` shared base styling; `public.css` public-only branded dashboard styling; `admin.css` admin-only closeout/dirty-state styling; `js/config.js` config; `js/schema.js` initial data/normalization/validation; `js/calculations.js` business rules; `js/storage.js` Supabase/auth and TEST MODE persistence boundary; `js/sleeper.js` Sleeper metadata, live reads, and score import; `js/bet-results.js` ESPN NFL result parsing/evaluation with no persistence side effects; `js/public.js` public rendering plus read-only live Sleeper and automatic bet-result overlays; `js/admin.js` core admin UI, automatic Sleeper metadata load, score sync, Weeks 1–17 selector, betting and TEST MODE; `js/admin-qol.js` admin-only dirty-state/draft protection, sticky save, weekly closeout, and selector attention markers; `js/bet-adjustments-admin.js` admin-only PrizePicks UI; `js/bet-results-admin.js` admin-only result preview/apply workflow; `tests/unit/` deterministic business-rule regressions; `tests/e2e/` Playwright browser workflows with mocked external APIs; `playwright.config.js` desktop/iPhone browser configuration; `.github/workflows/qa.yml` CI; `supabase/schema.sql` database/RLS bootstrap; `README.md`, `AGENTS.md`, and this spec are durable documentation.

Business rules belong in calculation/schema/storage modules rather than UI rendering code. Superseded implementations should be deleted rather than hidden or left as dead handlers.

## 15. Current implementation state
Core app is deployed. Supabase read/write/auth/session refresh, automatic dues, individual payment tracking, betting, playoff Weeks 15–16, final betting-only Week 17, per-leg parlay outcomes, admin ESPN bet-result preview/apply for supported final NFL outcomes, public read-only automatic unresolved bet outcomes, automatic Sleeper metadata loading, public current-week live Sleeper scores, commissioner Sleeper score sync with live/final gating, public branded dashboard presentation with section-local matchup/bet lifecycle statuses, season payout projection, backups, commissioner-save timestamp semantics, admin historical week navigation, derived weekly closeout/attention markers, unsaved-change protection with sticky save, combined matchup/score entry, PrizePicks stake tracking, backward-compatible normalization/migration, isolated admin TEST MODE, and automated unit/browser regression coverage exist. Sleeper projections have been removed.

## 16. Development workflow
Work directly against `aduncan450/fantasy-tracker`, inspect current files before overwriting, make concrete commits, and report commit SHAs. Favor small understandable vanilla-JS changes. Use actual mobile screenshots as visual truth. Minimize human setup and assume the commissioner may be mobile-only.

Every implementation change requires a documentation-impact check. Update this spec whenever behavior, data shape, invariants, architecture, deployment procedure, or supported workflow changes. Update README when the concise overview changes. Update `AGENTS.md` when a standing engineering lesson/rule changes.

Automated regression tests are the default repeatable QA layer. Run `npm test` when possible and add/update tests alongside changes to covered behavior. Manual TEST MODE QA is reserved for visual judgment, real-device ergonomics, read-only live integration checks, and novel workflows not yet automated.

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
13. PrizePicks actual-stake differences never affect live pot accounting.
14. Public live Sleeper data is display-only and never canonical accounting state.
15. Frontend changes must invalidate changed browser-cached assets and transitive dependencies.
16. Documentation must remain synchronized with implementation.
17. Previously verified deterministic behavior should be protected by automated regression tests whenever practical; tests must never write production league data.
18. External bet-result feeds may display or propose outcomes but must never directly write canonical league data, payouts, overall parlay status, player statistics, ledger entries, or pot state.
19. Commissioner-saved bet statuses always take precedence over automatic public result overlays.
20. Admin dirty state, unapplied-draft state, closeout status, and attention markers are derived UI state only and must never become canonical league fields.
21. Any admin path that mutates in-memory league data without immediately persisting it must participate in dirty-state protection.

## 18. Automated QA architecture
The test suite deliberately stays lightweight and free to run in the public GitHub repository.

- `node --test` exercises deterministic league behavior directly against production modules. Coverage includes matchup/dues rules, incomplete/tied weeks, Sleeper live/final gating, paid/unpaid accounting, payment reversal, historical score corrections, stake/payout math, parlay stats, Week 17 constraints, legacy Week 16→17 migration, bet-description parsing, player/team matching, final-game gating, and supported ESPN result evaluation.
- Playwright serves the static app locally and intercepts Supabase/Sleeper/ESPN requests. This lets browser tests exercise the real admin/public JavaScript without production writes, external API instability, or a second implementation of business rules.
- Core browser scenarios run in desktop Chromium and an iPhone-sized project. Current coverage includes TEST MODE persistence/public isolation, payment/accounting behavior, historical corrections, public live Sleeper score rendering, graceful Sleeper fallback, admin dirty-state/sticky-save protection, unapplied-draft week-navigation protection, weekly closeout/selector attention markers, admin bet-result preview/apply without automatic payout or overall-parlay changes, public automatic unresolved bet-result display without accounting changes, and saved-status precedence that skips unnecessary ESPN checks.
- `.github/workflows/qa.yml` installs the test dependencies/browser and runs `npm test` on every push to `main` and on pull requests.
- Manual QA findings that expose reproducible regressions should become automated regression tests whenever practical so they are not repeatedly rechecked by hand.
