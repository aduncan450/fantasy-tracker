# Buff Husky Fantasy Tracker

2026–2027 fantasy football league tracker for Duncan, Jacob, Matt, and Weston.

## Architecture

- Public site: read-only league dashboard with live current-week Sleeper scores when available
- `/admin`: commissioner-only data entry and maintenance
- Canonical production storage: Supabase (public read, authenticated admin write via RLS)
- Admin TEST MODE: isolated disposable browser-local copy using the same league schema/business logic; never read by the public dashboard
- GitHub Pages: static hosting
- JSON export/import: independent backup and recovery
- Money: integer cents only
- Derived state: dues, pot balance, player summaries, and week status are calculated from canonical inputs
- Sleeper: configured league metadata, roster mapping, live public scores, and commissioner final-score sync

## Automated QA

The repository has an automated regression suite so routine QA does not depend on manually replaying every league workflow.

- `npm run test:unit` runs Node's built-in test runner against league rules, dues, payment reversal, historical score corrections, bet accounting, parlay stats, live-score finality, Week 17 restrictions, and legacy week normalization.
- `npm run test:e2e` runs Playwright browser tests against a local static server with mocked Supabase/Sleeper responses. It covers TEST MODE persistence/isolation, payment/accounting behavior, historical corrections, public live Sleeper overlays, and graceful Sleeper fallback.
- `npm test` runs both layers.
- Browser tests run in desktop Chromium and an iPhone-sized Playwright project.
- `.github/workflows/qa.yml` runs the automated suite on every push to `main` and on pull requests.

The tests mock external writes and APIs; they do not modify the production Supabase league row. Manual TEST MODE QA remains useful for visual judgment and genuinely new workflows, but existing covered behavior should be protected by automated tests first.

## Sleeper behavior

The Sleeper league ID is configured in the app, so there is no persistent "connect" step. The admin automatically loads league/roster metadata. Roster mapping is setup/correction data and can be edited when needed.

For the current NFL/fantasy week, the public dashboard requests matchups and scores directly from Sleeper on page load and labels them **LIVE · SLEEPER**. Those live values are display-only: they do not write Supabase, generate dues, or change pot/accounting. If Sleeper is unavailable, the public page falls back to saved tracker data.

The commissioner can still sync a week's Sleeper scores into tracker data. Synced scores remain non-final for dues until Sleeper advances beyond that NFL week. Supabase remains canonical for finalized historical scores and all accounting. Sleeper projections are intentionally not tracked; they duplicated information already available in Sleeper without serving a tracker-specific workflow.

## Admin TEST MODE

Use TEST MODE for destructive manual/end-to-end QA instead of editing the live league. After commissioner sign-in, the admin portal can start from either a snapshot of current production data or a clean generated league.

While TEST MODE is active, the admin portal is given an unmistakable yellow warning treatment. Admin save paths write only to isolated `localStorage`; they do not write the production Supabase league row. The public dashboard continues to load production Supabase plus its read-only live Sleeper overlay and therefore cannot display test data.

TEST MODE persists across refreshes on the same browser. **Reset test data** restores the exact seed used when the mode was entered. **Exit & discard** deletes the test dataset and reloads production. TEST MODE deliberately is not a shared/multi-device test environment.

The real admin workflows remain in use, including scores, dues/payment state, pot/accounting calculations, $10 parlay legs, $5 bets, PrizePicks actual wagers, Sleeper mapping/sync/finality, Weeks 15–16 playoffs, Week 17 final betting, and backup import/export. Production authentication and RLS are unchanged.

## Frontend deployment / cache busting

GitHub Pages and mobile browsers may continue serving cached CSS or JavaScript after a deployment. Asset cache busting is required for every frontend change.

- Public asset URLs in `index.html` use version query strings.
- Admin asset URLs in `admin/index.html` use the same pattern.
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
- Ties require commissioner resolution
- Season payout projection: playoff champion 30%, each of the other three players 20%, Playoff Betting Fund 10%

Existing league rows and older valid backups are normalized in memory to the current Weeks 1–17 shape before validation. Data created during the brief Week-16-final-betting implementation is migrated so Week 16 becomes a playoff week and its betting-only data moves to Week 17.

### PrizePicks $5 stake adjustment tracking

PrizePicks may reduce the amount actually wagered below the $5 funded by the pot. The commissioner records the actual weekly wager and the tracker calculates `$5.00 - actual wager` as the amount the bet placer owes back to the pot at season end. This is admin-only and excluded from the public dashboard, ledger, live pot, and payout projection.

### Recurring regular-season matchup cycle

1. Duncan vs Matt; Jacob vs Weston
2. Duncan vs Weston; Jacob vs Matt
3. Duncan vs Jacob; Weston vs Matt

The cycle repeats through Week 14. Sleeper score sync may replace a week's matchup ordering with actual Sleeper matchup data. Weeks 15 and 16 are playoff weeks. Week 17 intentionally has no matchups.

## Status

Core tracker functionality is live and in active enhancement/QA. The repository and `docs/SPEC.md` are the durable sources of truth for implementation decisions.
