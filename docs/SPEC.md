# Buff Husky Fantasy Tracker — Specification v2.1

## Product
Mobile-first tracker for Duncan, Jacob, Matt, and Weston. Public users get a polished read-only dashboard. The commissioner uses `/admin/` for all edits.

## 2026–2027 rules
- Starting pot: $0.
- Regular season: Weeks 1–14; playoffs begin Week 15.
- Matchup cycle repeats every three weeks: (1) Duncan–Matt / Jacob–Weston; (2) Duncan–Weston / Jacob–Matt; (3) Duncan–Jacob / Weston–Matt.
- Weekly dues: lowest overall scorer owes $10; loser of the other matchup owes $5.
- Weekly bets: $10 and $5.
- Placing a bet subtracts the stake from the pot. Any entered payout is total cash returned and adds to the pot. Statuses: placed, won, lost, push, void.
- Score ties are exceptional: flag and require commissioner resolution; do not guess.
- Season allocation: 30% / 20% / 20% / 20% / 10%.

## Architecture
GitHub Pages hosts static HTML/CSS/JS. Supabase is the canonical remote datastore. Public clients have read-only access. Authenticated commissioner sessions may write, enforced by Row Level Security. `localStorage` is used only for the admin auth session, never as canonical league storage.

The frontend contains a small storage adapter so persistence can be replaced without rewriting business logic. No service-role key or other privileged secret may be shipped to the browser. The publishable/anon key is expected in frontend configuration and relies on RLS for security.

## Canonical vs derived data
Canonical: season config, players, weekly matchup definitions, scores, bets, adjustments, playoff winner. Derived: winners, dues, pot, ledger totals, current week, workflow state, payout amounts. Money is always integer cents.

## Ledger
Current pot = starting pot + derived dues − bet stakes + entered payouts + explicit adjustments. Never directly edit pot balance.

## Data safety
Remote Supabase data is authoritative. Admin offers full JSON export/import. Import validates schema and requires confirmation before replacement. Historical edits recalculate derived state.

## Human-setup principle
Human work should be limited to provider/account actions that cannot safely be automated: connect GitHub, create Supabase project, create commissioner auth identity, provide public project URL + publishable/anon key, and enable GitHub Pages. Everything else belongs in code or documented SQL.

## Current implementation status
Initial static public/admin shell, league schema, recurring schedule, calculations, remote storage adapter, backup UI, and Supabase RLS bootstrap are implemented. Supabase credentials and deployment remain to be configured.
