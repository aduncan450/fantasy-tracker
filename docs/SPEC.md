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

PrizePicks actual-wager differences are excluded from live pot accounting while they are being tracked. At season end, the commissioner can explicitly settle the accumulated difference into the pot as one positive Week 17 adjustment; only that settlement affects the pot and public ledger.

## 5. Weekly bets
Each betting period can contain one $10 parlay and one $5 bet. The parlay has one leg per league player; each leg independently tracks pending, hit, miss, or push. Overall bet status supports placed, won, lost, push, and void.

Bets are indexed by the week in which they are placed. Weeks 1–16 can contain bets alongside fantasy-week data. Week 17 is betting-only.

The admin-only $5 bet stake adjustment records the actual PrizePicks amount wagered for each week with a $5 bet. Amount owed to the pot is `$5.00 - actual wager`, bounded from $0 to $5. Weekly tracking itself creates no ledger entries and is omitted from the public dashboard. On the Week 17 admin page, the season total can be settled once into the pot; this creates a traceable explicit adjustment labeled `Gambler paid $5 bet stake adjustments` and then participates in normal pot accounting.

New bet entry is structured while preserving the existing canonical string fields. Parlay legs use an ESPN-backed active-player combo box filtered to QB, RB, TE, WR, FB, K, and P, plus a prop selector, over/under selector, and numeric line. Supported player picks are written in a compact canonical grammar intended to fit the public mobile layout: `pass yds`, `rush yds`, `rec yds`, `pass TD`, `rush TD`, `rec TD`, `anytime TD`, `INT`, and `receptions`. Legacy long-form wording such as `passing yards` or `rushing touchdowns` remains accepted by parsers and imports; `normalizeLeague()` rewrites supported legacy parlay-leg strings into the compact canonical form. Unsupported legacy free text is preserved rather than guessed or discarded.

The $5 bet editor supports three structured bet types: winner by moneyline, winner against the spread, and game-total over/under. New structured $5 entries capture both teams plus schedule venue while presenting NFL teams by full team name in admin. Moneyline and spread canonical descriptions preserve whether the pick is away (`@`) or home (`vs`), for example `Buffalo Bills @ Detroit Lions ML` and `Buffalo Bills -3.5 @ Detroit Lions ATS`. Game totals are canonicalized away-team first, for example `Buffalo Bills @ Detroit Lions over 54.5 total`, regardless of which team was initially selected in the editor. Legacy abbreviation-based and older supported descriptions such as `Buffalo Bills to beat Detroit Lions` remain readable/editable and are parsed into the same structured controls when possible; unsupported free text is preserved rather than discarded.

Supported bet descriptions can be checked against ESPN NFL scoreboard/box-score data. Result detection is review/display-first: it only settles supported outcomes from final games, never changes payouts, never changes the overall parlay status, and never writes canonical data directly. Unsupported or ambiguous descriptions, live games, unavailable source data, and non-unique player/team matches remain unchanged.

Supported player descriptions are rushing/receiving/passing yards, receptions, rushing/receiving/passing touchdowns, anytime TD, and interceptions, including their compact canonical aliases. Supported $5 team descriptions are moneyline/team winner, against-the-spread, and game-total over/under, including the venue-aware full-name canonical formats and supported legacy aliases.

## 6. Sleeper integration
The Sleeper league ID is configured in code. There is no user-facing connection/authentication step because Sleeper league metadata and public matchup data require no persistent connection. Admin automatically loads league and roster metadata when available.

The commissioner maps each Sleeper roster to a different tracker player. The mapping is stored in league data and normally only needs setup once; admin provides an edit-mapping control for corrections.

For the public dashboard's current calendar week, the dashboard requests that week's Sleeper matchups and scores on page load when the Sleeper NFL state reports the same week. These values are a read-only presentation overlay labeled **LIVE · SLEEPER**. They are never written to Supabase by the public page, never generate dues, and never affect pot/accounting. If Sleeper is unavailable, public rendering falls back to saved production data.

Commissioner score sync remains available. It imports Sleeper matchups/scores into the selected tracker week and records sync/finality metadata. Synced scores do not generate dues until Sleeper has advanced beyond that NFL week. Manually applying scores removes Sleeper sync/finality metadata so manual correction is explicit.

Sleeper projections are intentionally not part of the tracker. They duplicated information already available in Sleeper and did not drive a tracker-specific workflow.

## 7. Admin portal
The commissioner portal requires the existing Supabase magic-link session. Session tokens persist and refresh before expiry. Authentication and RLS are unchanged in TEST MODE.

The admin has a completion-driven workflow week derived from league data and can also navigate Weeks 1–17 manually. Completing a week may advance this admin workflow week immediately. This is intentionally separate from the public dashboard calendar week.

For Weeks 1–16, matchup context and editable score inputs share one **Matchups & scores** card. Week 17 omits scores/matchups/Sleeper controls and retains betting/accounting controls only.

The admin can edit scores, mark each derived due paid/unpaid, create/update bets through structured bet-entry controls, save individual parlay leg outcomes, preview supported NFL bet results, apply detected statuses locally for commissioner review, track PrizePicks actual wagers, edit Sleeper roster mapping, sync Sleeper scores, export/import backups, and save all changes. Admin-only PrizePicks tracking participates in the same main save lifecycle. On Week 17 only, the Adjustments card exposes the one-time season-end settlement from the gambler to the pot. The settlement is applied locally first and requires the normal main save action before it becomes canonical.

Structured bet entry is a presentation/input layer only; it writes the same `pick` and `description` string fields already used by the league schema. Active NFL player suggestions are loaded from ESPN team rosters in the admin browser and are not persisted. The roster list is advisory input assistance; final canonical values remain the generated bet strings inside league data. Supported parlay picks use the compact canonical player-prop grammar described above. The structured $5 editor requires a selected team and opponent for all three supported team-bet types, normalizes recognized team aliases to full NFL team names, and uses the selected team's NFL schedule entry to persist venue-aware canonical wording.

Admin in-memory mutations are tracked with explicit dirty state. After an Apply/import/sync/payment/direct-entry action changes tracker data without persisting it, the portal shows **UNSAVED CHANGES** plus a fixed mobile-friendly **Save now** control. Successful production or TEST MODE persistence clears the dirty state. Browser unloads and destructive admin actions warn before discarding dirty data. Draft text that still requires an existing **Apply** action is tracked separately and must not be falsely represented as saved tracker data. Week changes are intercepted before the core week-change handler so dismissing the draft-discard warning reliably preserves both the current week and the draft values.

The admin also derives a **Weekly closeout** checklist from existing tracker state; no new closeout fields are stored. Started/current weeks are evaluated for score finality where applicable, regular-season dues payment completion, overall parlay settlement, individual parlay-leg completion, and $5 bet settlement. Week 1 is exempt from bet-entry checks because there is no preceding funded betting period. The week selector marks the derived workflow week with `← CURRENT`, unresolved started weeks with `•`, and cleared started weeks with `✓`. Future untouched weeks remain unmarked.

Automated bet-result checking is deliberately separate from persistence/accounting. **Check results** is read-only. **Apply detected statuses locally** only changes the current admin form/data in memory. Production Supabase and pot/accounting change only after the existing main save action. Payout values and overall parlay status remain commissioner-entered.

## 8. Public dashboard week timing
The public dashboard week is calendar-driven, not completion-driven. Completing fantasy scores or settling bets does not advance the public page early.

For the 2026 season, Week 1 begins Thursday, September 10, 2026. The displayed public week advances every Wednesday at **12:00 PM America/Chicago**, beginning with the Week 1 → Week 2 rollover on Wednesday, September 16. Therefore the dashboard remains on the just-played week through Wednesday morning, then switches to the next week at noon Central. The public week clamps at Week 17.

This schedule is implemented separately from `currentWeek()` so admin workflow/closeout behavior can continue to use completion-driven advancement.

## 9. Public dashboard
The public dashboard loads canonical production Supabase data for accounting/history and may overlay current-week Sleeper matchups/scores plus supported unresolved NFL bet outcomes for display only. TEST MODE data is never read by the public dashboard.

The dashboard order is:

1. Pot/week summary
2. Player summary cards
3. Current fantasy matchups
4. Current-week bets
5. Season payout
6. Recent completed matchups
7. Pot activity

The top summary is one cohesive panel with only an outer container border. **Week** is left-most; **Pot** is the other primary value; **Collected** and **Unpaid** are smaller stacked secondary values. Internal divider borders are intentionally omitted so the four values read as one balanced summary. Use a plain calendar icon for Week and coin imagery for Pot.

The header uses uppercase **BUFF HUSKY FANTASY TRACKER** preceded by the green vertical bar, followed by `2026–2027 SEASON | WEEK X`. The last commissioner update date/time sits directly below on one line with evenly distributed fields. The header intentionally has no mascot, mountain illustration, or other decorative art.

Current matchup lifecycle belongs in the matchup section: **UPCOMING** before live scores, **LIVE · SLEEPER** while the current-week overlay is active, and **FINAL** when saved scores are final. The current-week matchup list uses the same stacked matchup-card pattern as recent results rather than a separate desktop-only two-column treatment. When the current week's saved scores are final, the same compact right-aligned dues pills used in recent matchups appear beneath the current matchup list; they are omitted entirely while the week is upcoming or live. Internal implementation/explainer copy such as how Sleeper refreshes scores is not displayed publicly.

Recent completed matchups are labeled **RECENT MATCHUPS** and each result card spans the available section width. Final winners may use a restrained green gradient and trophy icon. Preserve muted loser colors: the unique lowest scorer uses muted red and the other matchup loser uses muted orange. Compact dues chips show only `Name · Amount`, omit the rule explanation, and are right-aligned beneath the result.

For betting, commissioner-saved statuses always take precedence. Only parlay legs still saved as `pending` and $5 bets still saved as `placed` are eligible for a public automatic overlay. A supported final result may display as an `auto` result beside the unresolved saved status. Public automatic results never update Supabase, payouts, overall parlay status, player parlay statistics, ledger entries, pot balance, or season payout calculations.

The betting section title is simply **BETS** in the established green heading treatment. The header itself has no dice icon and no week label. The $10 parlay uses a dice icon; the $5 bet uses a dart hitting a bullseye icon. Public parlay-leg pick text is deliberately compact and single-line on phone layouts: first names may be reduced to an initial for display while canonical supported prop wording uses the compact labels above. Supported $5 team bets render as a matchup card using both full NFL team names, an explicit pick/total line, and the real ESPN-hosted team logo assets for each side; the logo images are display-only and are not persisted in league data. Legacy supported descriptions such as `Bills to Win vs Lions` resolve to the same full-name/logo presentation when both teams can be identified. Presentation-only betting lifecycle is: no badge before any bet exists, **PLACED** after entry, **LIVE** once outcomes begin resolving while at least one overall bet remains placed, and **FINAL** once commissioner-saved overall statuses are settled.

Public **POT ACTIVITY** keeps every ledger row on one line on phone layouts. $5 bet stake and payout rows use team nicknames without locations: moneyline as `Bills @ Lions ML` or `Bills vs Lions ML`, spread as `Bills -3.5 @ Lions ATS` or `Bills -3.5 vs Lions ATS`, and totals as away-team-first `Bills @ Lions over 54.5` / `under 54.5`. Older supported descriptions are compacted for display without rewriting historical accounting data; if an old description did not preserve venue, its legacy `vs`/`at` wording is used until that bet is re-saved in the structured editor.

Season payout shows the three split rows directly under **SEASON PAYOUT**. Do not show a redundant `Current pot split` subheading. The only explanatory note is `Projected from the current pot.`

The Week 17 season-end gambler settlement is a normal explicit ledger adjustment after it is saved. It increases the displayed pot and appears in public **POT ACTIVITY** with its settlement label, preserving a traceable record of the one-time payment.

## 10. Presentation rules
Names remain normal case. Most labels/headings use the established uppercase visual treatment. Mobile layouts must remain comfortable on an iPhone. Equal-information fields should have equal visible widths. Avoid arbitrary wrapping that makes paired values appear unrelated.

The public dashboard uses dedicated `public.css`; matchup-logo styling for the public $5 card lives in `public-team-bets.css`, while one-line pot-ledger constraints live in `public-pot-activity.css`, so these visual treatments stay isolated from admin. Admin styling must not be changed as a side effect of public visual iteration. Styling should stay dashboard-first rather than poster-like. Decorative slogans and decorative header imagery are not part of the product.

TEST MODE must remain unmistakable with its yellow warning treatment, persistent banner, and explicit production-safety copy. Reset and Exit & discard controls must remain legible and mobile-friendly.

Admin dirty-state controls must remain visible without forcing the commissioner back to the top of a long mobile page. The sticky save control must not obscure form content.

Structured bet-entry controls may collapse to one field per row on narrow phones. Player suggestions should include player name plus team and position when the browser displays datalist labels.

## 11. Data safety and validation
Supabase is authoritative for production. Preserve integer-cent money math, per-charge payment traceability, explicit adjustments instead of direct balance edits, JSON export/import, confirmation before import replacement, explicit save after import, and remote-data preservation on failed saves.

`validateLeague()` is the safety boundary for production loads/saves, TEST MODE persistence, and backup imports. It validates configured players, Weeks 1–17 and week types, regular-season matchups, playoff Weeks 15–16, Week 17 restrictions, scores, supported bets/statuses, parlay legs, payment keys, Sleeper roster mapping/sync state, PrizePicks actual-wager bounds, and explicit adjustments. Legacy projection fields may remain valid in older backups/data for backward compatibility, but the application no longer creates or displays projections.

`normalizeLeague()` runs before validation on production data, TEST MODE data, and imports. It upgrades older valid data, migrates the superseded Week-16-final-betting shape into Week 17, and canonicalizes supported legacy parlay-leg strings into the compact player-prop grammar. Unsupported free-text leg history remains unchanged.

Bet-result proposals/overlays, admin structured-entry controls, ESPN roster suggestions, admin dirty state, unapplied-draft state, weekly closeout status, week-selector attention markers, public team-logo presentation, and public calendar-week display state are transient UI state and are not league-schema fields. No external result feed may write canonical league data directly.

## 12. Admin TEST MODE
TEST MODE is an admin-only manual/end-to-end QA sandbox implemented at the persistence boundary.

- Authentication is unchanged.
- **Test copy of production** clones current Supabase league data; **Test clean league** uses `initialLeague()`.
- Seed and mutable working copy are stored separately for reliable reset.
- Admin save paths use isolated test `localStorage`; no league write is sent to Supabase.
- TEST MODE persists across page refreshes in the same browser.
- The week selector supports Weeks 1–17 and retains the same derived closeout/attention markers as production admin.
- **Reset test data** restores the seed. **Exit & discard** deletes test keys and reloads production.
- Dirty-state warnings, unapplied-draft warnings, and sticky save behave the same way in TEST MODE, while saving targets only isolated test storage.
- The public dashboard never reads TEST MODE keys.
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
`index.html` public shell; `admin/index.html` admin shell; `styles.css` shared base styling; `public.css` public-only branded dashboard styling; `public-team-bets.css` public $5 matchup/logo styling; `public-pot-activity.css` public one-line pot-ledger styling; `admin.css` admin-only styling; `js/config.js` config; `js/schema.js` initial data/normalization/validation; `js/calculations.js` business rules and completion-driven admin `currentWeek()`; `js/dashboard-week.js` Wednesday-noon-Central public calendar-week logic; `js/storage.js` Supabase/auth and TEST MODE persistence boundary; `js/sleeper.js` Sleeper metadata/live reads/score import; `js/bet-entry.js` structured bet string builders/parsers, venue-aware team grammar, NFL team metadata/logo URLs, compact canonicalization, and ESPN roster normalization; `js/admin-bet-entry.js` ESPN-backed admin structured-entry UI; `js/bet-results.js` ESPN NFL result parsing/evaluation; `js/public.js` public rendering; `js/admin.js` core admin UI; `js/admin-qol.js` admin dirty-state/draft/closeout/selector enhancements; `js/bet-adjustments-admin.js` PrizePicks UI and Week 17 season-end settlement; `js/bet-results-admin.js` result preview/apply workflow; `tests/unit/` deterministic business-rule regressions; `tests/e2e/` Playwright browser workflows; `.github/workflows/qa.yml` CI.

Business rules belong in calculation/schema/storage modules rather than UI rendering code. Public calendar presentation belongs in `dashboard-week.js` and must stay separate from admin completion logic.

## 15. Current implementation state
Core app is deployed. Supabase read/write/auth/session refresh, automatic dues, individual payment tracking, betting, structured ESPN-backed parlay/$5 bet entry, compact canonical parlay prop wording, venue-aware $5 descriptions, compact one-line $5 pot-activity labels, ESPN-hosted team-logo public presentation, moneyline/spread/game-total result evaluation, playoff Weeks 15–16, final betting-only Week 17, per-leg parlay outcomes, admin ESPN bet-result preview/apply, public read-only automatic unresolved bet outcomes, automatic Sleeper metadata loading, public current-week live Sleeper scores, commissioner Sleeper score sync with live/final gating, Wednesday-noon public dashboard week timing, public branded dashboard presentation, season payout projection, backups, commissioner-save timestamp semantics, admin historical week navigation, weekly closeout/attention markers, unsaved-change protection with sticky save, PrizePicks stake tracking and Week 17 one-time settlement, backward-compatible normalization/migration, isolated TEST MODE, and automated unit/browser regression coverage exist. Sleeper projections remain intentionally removed.

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
6. Pot is derived, never manually edited.
7. Public users cannot edit league data.
8. Commissioner writes require authenticated Supabase access.
9. Production `lastUpdated` changes only on successful commissioner save to Supabase.
10. The 10% allocation is the current-season Playoff Betting Fund.
11. Names remain normal case while most UI labels are uppercase.
12. The application remains comfortable on a phone.
13. PrizePicks actual-stake differences never affect live pot accounting until the explicit one-time Week 17 settlement is recorded.
14. Public live Sleeper data is display-only and never canonical accounting state.
15. Frontend changes must invalidate changed browser-cached assets and transitive dependencies.
16. Documentation must remain synchronized with implemented behavior.
17. TEST MODE must never write league changes to production Supabase.
18. The season-end gambler settlement is one explicit Week 17 ledger adjustment and must not be duplicated by the admin UI.
19. Supported parlay player-prop history uses the compact canonical wording; legacy supported wording is normalized without changing the meaning or result status, while unsupported free text is preserved.
20. New structured $5 team entries must identify both teams and preserve matchup venue; public logo and compact ledger presentation are derived from recognized team names and are never separate canonical league fields.