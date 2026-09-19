# Buff Husky Fantasy Tracker

2026–2027 fantasy football league tracker for Duncan, Jacob, Matt, and Weston.

## Architecture

- Public site: polished, read-only league dashboard
- `/admin`: commissioner-only data entry and maintenance
- Canonical storage: Supabase (public read, authenticated admin write via RLS)
- GitHub Pages: static hosting
- JSON export/import: independent backup and recovery
- Money: integer cents only
- Derived state: dues, pot balance, player summaries, and week status are calculated from canonical inputs
- Sleeper: commissioner-assisted roster mapping, score sync, and weekly projections

## Frontend deployment / cache busting

GitHub Pages and mobile browsers may continue serving cached CSS or JavaScript after a deployment. Asset cache busting is therefore a required part of every frontend change.

- Public asset URLs in `index.html` use a version query string, e.g. `styles.css?v=...` and `js/public.js?v=...`.
- Admin asset URLs in `admin/index.html` use the same pattern for `styles.css`, `js/admin.js`, and `js/bet-adjustments-admin.js`.
- **Whenever a CSS or JavaScript entry asset referenced by HTML changes, bump its `?v=` value in every HTML page that loads it as part of the same change.**
- `styles.css` is shared by the public and admin views, so changing it requires bumping its version in both `index.html` and `admin/index.html`.
- Changes to imported JavaScript modules must also be reviewed for cache impact; do not assume changing an unrelated HTML version automatically invalidates every transitive module import.
- Do not rely on users manually refreshing, clearing Safari/Chrome cache, or reopening the site to receive frontend fixes.
- Keep the existing no-cache HTML meta directives so the HTML itself is refreshed and can point browsers at newly versioned assets.

This is a standing implementation requirement for future sessions and frontend work.

## Documentation maintenance

Documentation is part of the change, not a separate cleanup task.

- For every implementation change, review `docs/SPEC.md` and this README for affected behavior, architecture, invariants, workflows, deployment requirements, or known limitations.
- Update documentation in the same change whenever the implementation makes existing documentation incomplete, stale, or misleading.
- If no documentation change is needed, that should be a deliberate conclusion after review rather than an assumption.
- `docs/SPEC.md` is the canonical product/technical handoff. The README is a shorter operational overview and must not contradict the spec.

## League rules

- Regular season: Weeks 1–14
- Playoffs begin Week 15
- Lowest weekly score owes $10
- Loser of the other matchup owes $5
- Weekly bets: one $10 parlay and one $5 wager
- Placing a bet removes its recorded stake from the pot
- Bet payout means total cash returned and is added to the pot
- Bet statuses: placed, won, lost, push, void
- Parlay legs may settle independently as pending, hit, miss, or push before the overall parlay is decided
- Ties are treated as rare exceptions and require commissioner resolution
- Season payout projection: playoff champion 30%, each of the other three players 20%, Playoff Betting Fund 10%
- The 10% Playoff Betting Fund is for gambling on this season's playoffs after the fantasy league ends

### PrizePicks $5 stake adjustment tracking

PrizePicks may reduce the amount actually wagered below the $5 funded by the pot so the potential payout is an even dollar amount. The commissioner records the actual weekly wager in the admin portal, and the tracker calculates `$5.00 - actual wager` as the amount the bet placer owes back to the pot at season end.

This tracking is admin-only. It is excluded from the public dashboard, ledger, live pot, and payout projection. Saving weekly adjustment amounts must not create a pot adjustment or otherwise change public accounting.

### Recurring regular-season matchup cycle

1. Duncan vs Matt; Jacob vs Weston
2. Duncan vs Weston; Jacob vs Matt
3. Duncan vs Jacob; Weston vs Matt

The cycle repeats through Week 14. Sleeper score sync may replace a week's matchup ordering with the actual Sleeper matchup data. Week 15 playoff matchups are entered when known.

## Status

Core tracker functionality is live and in active enhancement/QA. The repository and `docs/SPEC.md` are the durable sources of truth for implementation decisions.
