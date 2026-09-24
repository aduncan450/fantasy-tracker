# Buff Husky Fantasy Tracker

2026–2027 fantasy football league tracker for Duncan, Jacob, Matt, and Weston.

## Architecture

- Public site: read-only branded league dashboard with calendar-based week display, live current-week Sleeper scores, section-local lifecycle statuses, and read-only automatic supported NFL bet outcomes when available
- `/admin`: commissioner-only data entry and maintenance, with derived weekly closeout/attention status and unsaved-change protection
- Canonical production storage: Supabase (public read, authenticated admin write via RLS)
- Admin TEST MODE: isolated disposable browser-local copy using the same league schema/business logic; never read by the public dashboard
- GitHub Pages: static hosting
- JSON export/import: independent backup and recovery
- Money: integer cents only
- Derived state: dues, pot balance, player summaries, admin workflow week, and closeout/attention markers are calculated from canonical inputs
- Sleeper: configured league metadata, roster mapping, live public scores, and commissioner final-score sync
- NFL bet results: ESPN scoreboard/box-score reads can display supported unresolved outcomes publicly and propose the same outcomes in admin; only commissioner save makes them canonical

## Automated QA

The repository has an automated regression suite so routine QA does not depend on manually replaying every league workflow.

- `npm run test:unit` runs Node's built-in test runner against league rules, dues, payment reversal, historical score corrections, bet accounting, parlay stats, live-score finality, Week 17 restrictions, legacy week normalization, compact canonical parlay-history normalization, supported NFL bet-result parsing/evaluation, and Wednesday-noon public dashboard week rollover.
- `npm run test:e2e` runs Playwright browser tests against a local static server with mocked Supabase/Sleeper/ESPN responses. It covers TEST MODE persistence/isolation, payment/accounting behavior, historical corrections, public live Sleeper overlays, public read-only automatic bet outcomes, public dashboard/status rendering, compact one-line parlay-leg rendering and mobile overflow safety, graceful external-feed fallback, admin dirty-state/sticky-save behavior, unapplied-draft navigation protection, weekly closeout/selector markers, and admin bet-result preview/apply behavior.
- `npm test` runs both layers.
- Browser tests run in desktop Chromium and an iPhone-sized Playwright project.
- Calendar-dependent public browser tests freeze their date so CI remains stable across future weeks; unit tests verify the real Wednesday-noon rollover boundary, including daylight-saving transitions.
- `.github/workflows/qa.yml` runs the automated suite on every push to `main` and on pull requests.

The tests mock external writes and APIs; they do not modify the production Supabase league row. Manual TEST MODE QA remains useful for visual judgment and genuinely new workflows, but existing covered behavior should be protected by automated tests first.

## Public dashboard presentation and week timing

The public dashboard uses a dedicated `public.css` layer so visual iteration does not restyle the commissioner portal. The header is intentionally restrained: **BUFF HUSKY FANTASY TRACKER** is uppercase with the green bar accent, followed by `2026–2027 SEASON | WEEK X` and the last commissioner update date/time on one evenly spaced line. Decorative mascot and mountain artwork are intentionally omitted.

The top summary is one cohesive open panel with **Week** left-most, **Pot** as the other primary value, and **Collected/Unpaid** stacked as secondary values. It uses only the outer panel border rather than internal dividers. Matchup cards use a consistent stacked layout on desktop and mobile, without public implementation copy explaining how Sleeper refresh works.

Finalized winners receive a restrained green gradient and trophy icon; the unique lowest scorer keeps muted red treatment and the other matchup loser keeps muted orange. **RECENT MATCHUPS** cards span the section width and compact `Name · Amount` dues chips are right-aligned.

The public dashboard week is intentionally different from the admin workflow week. For the 2026 season, Week 1 begins Thursday, September 10. The public page advances every Wednesday at **12:00 PM America/Chicago**, beginning with the Week 1 → Week 2 rollover on September 16. Finalizing a matchup on Monday still does not make the public dashboard jump ahead early; it remains on the just-played week until Wednesday noon. Admin remains completion-driven for commissioner workflow/closeout purposes.

Fantasy matchup lifecycle is shown beside the matchup data itself as **UPCOMING**, **LIVE · SLEEPER**, or **FINAL** rather than as a global page status. The betting section uses no header icon or week label; the $10 parlay uses dice and the $5 bet uses a dart hitting a bullseye. Betting display lifecycle is no badge before entry, then **PLACED**, **LIVE** once outcomes begin resolving, and **FINAL** after commissioner-saved bet statuses are settled. These display labels are derived UI only and do not change canonical bet statuses.

Parlay player-prop strings use a compact canonical grammar: `pass yds`, `rush yds`, `rec yds`, `pass TD`, `rush TD`, `rec TD`, `anytime TD`, `INT`, and `receptions`. Legacy long-form strings remain readable and are normalized into the compact form when league data is loaded/saved/imported. Public rendering also abbreviates a full first name to an initial when possible so each parlay leg can stay on one line on an iPhone without changing the underlying player identity or bet meaning. Unsupported legacy free-text picks are preserved unchanged.

The public dashboard section order is: pot/week summary, player cards, current matchups, current bets, season payout, recent matchups, then pot activity.

## Admin workflow safeguards

The commissioner portal tracks when in-memory league data has changed but has not yet been persisted. After an Apply/import/sync/payment/direct-entry action mutates tracker data, **UNSAVED CHANGES** appears and a fixed **Save now** control stays available at the bottom of the page. Successful production or TEST MODE saves clear that state. Browser unloads and destructive actions such as sign-out warn before dirty data is discarded. Form text that still requires its existing **Apply** action is tracked separately: changing weeks warns before discarding that unapplied draft, while the sticky save only claims to save changes already applied to tracker data. The draft guard intercepts week navigation before the core change handler so dismissing the warning reliably preserves the selected week and draft values.

The portal also includes a derived **Weekly closeout** card. It checks started/current weeks for score finality where applicable, regular-season dues payments, overall parlay status, individual parlay-leg completion, and the $5 bet. The week selector uses `← CURRENT` for the workflow week, `•` for unresolved started weeks, and `✓` for cleared started weeks. These indicators are UI-only and are never stored in league data.

## Sleeper behavior

The Sleeper league ID is configured in the app, so there is no persistent "connect" step. The admin automatically loads league/roster metadata. Roster mapping is setup/correction data and can be edited when needed.

For the public calendar week, the dashboard requests that week's matchups and scores directly from Sleeper on page load when Sleeper reports the same NFL week, and labels them **LIVE · SLEEPER**. Those live values are display-only: they do not write Supabase, generate dues, or change pot/accounting. If Sleeper is unavailable, the public page falls back to saved tracker data.

The commissioner can still sync a week's Sleeper scores into tracker data. Synced scores remain non-final for dues until Sleeper advances beyond that NFL week. Supabase remains canonical for finalized historical scores and all accounting. Sleeper projections are intentionally not tracked; they duplicated information already available in Sleeper without serving a tracker-specific workflow.

## Automatic bet-result behavior

Supported unresolved NFL bets can be evaluated from ESPN scoreboard and box-score data. The public dashboard uses the same detection logic as admin for display only.

On the public page, a parlay leg still saved as **pending** may display a detected `hit · auto`, `miss · auto`, or `push · auto`. A $5 wager still saved as **placed** may display an automatic won/lost/push result beside that saved status. The page clearly notes that automatic results are read-only until the commissioner saves the official status in Admin. These overlays never change Supabase, payouts, overall parlay status, player parlay statistics, the ledger, or pot accounting. Commissioner-saved statuses always take precedence, and already settled saved bets do not trigger an ESPN check.

In admin, **Check Week N results** is read-only and shows the proposed status plus the underlying final-game evidence. It does not change tracker state. **Apply detected statuses locally** copies only settled supported statuses into the current admin form/data. The normal **Save all changes** action is still required before production Supabase changes, so pot/accounting behavior follows the same commissioner-submit boundary as the rest of the portal.

The checker currently supports rushing/receiving/passing yards, receptions, rushing/receiving/passing touchdowns, anytime TD, interceptions, moneyline/team winner, against-the-spread, and game-total over/under wording. Compact canonical player-prop wording and legacy long-form wording are both accepted. Live games, unsupported descriptions, ambiguous player/team matches, and unavailable ESPN data are not guessed. Payout values and overall parlay status stay manual even when individual results are detected automatically.

## Admin TEST MODE

Use TEST MODE for destructive manual/end-to-end QA instead of editing the live league. After commissioner sign-in, the admin portal can start from either a snapshot of current production data or a clean generated league.

While TEST MODE is active, the admin portal is given an unmistakable yellow warning treatment. Admin save paths write only to isolated `localStorage`; they do not write the production Supabase league row. The public dashboard continues to load production Supabase plus its read-only external-data overlays and therefore cannot display test data.

TEST MODE persists across refreshes on the same browser. **Reset test data** restores the exact seed used when the mode was entered. **Exit & discard** deletes the test dataset and reloads production. TEST MODE deliberately is not a shared/multi-device test environment.

The real admin workflows remain in use, including scores, dues/payment state, pot/accounting calculations, $10 parlay legs, $5 bets, PrizePicks actual wagers, Sleeper mapping/sync/finality, Weeks 15–16 playoffs, Week 17 final betting, weekly closeout/attention indicators, dirty-state and unapplied-draft protection, admin bet-result preview/apply, and backup import/export. Production authentication and RLS are unchanged.

## Frontend deployment / cache busting

GitHub Pages and mobile browsers may continue serving cached CSS or JavaScript after a deployment. Asset cache busting is required for every frontend change.

- Public asset URLs in `index.html` use version query strings.
- Admin asset URLs in `admin/index.html` use the same pattern, including admin-only CSS.
- Whenever a CSS or JavaScript entry asset referenced by HTML changes, bump its `?v=` value in every HTML page that loads it.
- Changes to imported JavaScript modules must also receive new URLs through the dependency graph.
- Do not rely on users manually clearing browser cache.
- Keep the existing no-cache HTML meta directives.

## Documentation maintenance

Documentation is part of the change. Review and update `docs/SPEC.md`, this README, and `AGENTS.md` as applicable whenever behavior, architecture, invariants, workflows, or deployment requirements change.

## League rules

- Regular season: Weeks 1–14
- Fantasy playoffs: Weeks 15–16
- Final betting period: Week 17, betting-only, so Week 16 bet returns can fund one last $10 parlay and $5 wager
- Week 17 has no fantasy scores, matchups, dues, or Sleeper score workflow
- Lowest weekly score owes $10 during the regular season
- Loser of the other matchup owes $5 during the regular season
- Weekly bets: one $10 parlay and one $5 wager
- Placing a bet removes its recorded stake from the pot
- Bet payout means total cash returned and is added to the pot
- Bet statuses: placed, won, lost, push, void
- Parlay legs may settle independently as pending, hit, miss, or push before the overall parlay is decided
- Automated result detection may display/propose supported outcomes, but commissioner apply/save remains required for canonical status and payouts are never auto-filled
- Ties require commissioner resolution
- Season payout projection: playoff champion 30%, each of the other three players 20%, Playoff Betting Fund 10%

Existing league rows and older valid backups are normalized in memory to the current Weeks 1–17 shape before validation. Data created during the brief Week-16-final-betting implementation is migrated so Week 16 becomes a playoff week and its betting-only data moves to Week 17. Supported legacy parlay player-prop strings are also normalized to the compact canonical grammar while unsupported free text is preserved.

### PrizePicks $5 stake adjustment tracking

PrizePicks may reduce the amount actually wagered below the $5 funded by the pot. The commissioner records the actual weekly wager and the tracker calculates `$5.00 - actual wager` as the amount the bet placer owes back to the pot at season end. This is admin-only and excluded from the public dashboard, ledger, live pot, and payout projection.

### Recurring regular-season matchup cycle

1. Duncan vs Matt; Jacob vs Weston
2. Duncan vs Weston; Jacob vs Matt
3. Duncan vs Jacob; Weston vs Matt

The cycle repeats through Week 14. Sleeper score sync may replace a week's matchup ordering with actual Sleeper matchup data. Weeks 15 and 16 are playoff weeks. Week 17 intentionally has no matchups.

## Status

Core tracker functionality is live and in active enhancement/QA. The repository and `docs/SPEC.md` are the durable sources of truth for implementation decisions.
