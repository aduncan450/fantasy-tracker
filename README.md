# Buff Husky Fantasy Tracker

2026–2027 fantasy football league tracker for Duncan, Jacob, Matt, and Weston.

## Architecture

- Public site: polished, read-only league dashboard
- `/admin`: commissioner-only data entry and maintenance
- Canonical storage: Supabase (public read, authenticated admin write via RLS)
- GitHub Pages: static hosting
- JSON export/import: independent backup and recovery
- Money: integer cents only
- Derived state: standings, dues, pot balance, and week status are calculated from canonical inputs

## Frontend deployment / cache busting

GitHub Pages and mobile browsers may continue serving cached CSS or JavaScript after a deployment. Asset cache busting is therefore a required part of every frontend change.

- Public asset URLs in `index.html` use a version query string, e.g. `styles.css?v=...` and `js/public.js?v=...`.
- Admin asset URLs in `admin/index.html` use the same pattern for `styles.css`, `js/admin.js`, and `js/bet-adjustments-admin.js`.
- **Whenever any referenced CSS or JavaScript file is changed, bump the corresponding `?v=` value in every HTML page that loads that asset as part of the same change/commit.**
- `styles.css` is shared by the public and admin views, so changing it requires bumping its version in both `index.html` and `admin/index.html`.
- Do not rely on users manually refreshing, clearing Safari/Chrome cache, or reopening the site to receive frontend fixes.
- Keep the existing no-cache HTML meta directives so the HTML itself is refreshed and can point browsers at the newly versioned assets.

This is a standing implementation requirement for future sessions and frontend work.

## League rules

- Regular season: Weeks 1–14
- Playoffs begin Week 15
- Lowest weekly score owes $10
- Each matchup loser owes $5
- Weekly bets: one $10 and one $5 wager
- Placing a bet removes its stake from the pot
- Bet payout means total cash returned and is added to the pot
- Bet statuses: placed, won, lost, push, void
- Ties are treated as rare exceptions and require commissioner resolution
- Season payouts: 1st 30%, 2nd 20%, 3rd 20%, 4th 20%, league fee 10%

### Recurring regular-season matchup cycle

1. Duncan vs Matt; Jacob vs Weston
2. Duncan vs Weston; Jacob vs Matt
3. Duncan vs Jacob; Weston vs Matt

The cycle repeats through Week 14. Week 15 playoff matchups are entered when known.

## Status

Initial build in progress. The repository is the durable source of truth for implementation decisions.
