# Fantasy Tracker — Standing Development Instructions

These instructions apply to every future implementation session working in this repository.

## Change discipline

1. Read `docs/SPEC.md` before changing product behavior or league/accounting rules.
2. Inspect the current version of every file before overwriting it.
3. Preserve the core invariants in `docs/SPEC.md`; do not silently reinterpret league rules.
4. Prefer small, understandable vanilla-JavaScript changes over unnecessary architecture or framework changes.
5. Treat mobile/iPhone usability as a requirement, not an optional polish pass.

## Documentation is part of every change

For **every** code, configuration, schema, UX, workflow, or deployment change:

1. Review `docs/SPEC.md` and `README.md` for anything affected by the change.
2. Update the relevant documentation in the same work whenever existing text would become incomplete, stale, ambiguous, or misleading.
3. Add newly discovered durable implementation lessons/invariants when they would help prevent a future regression.
4. Keep `docs/SPEC.md` as the canonical product/technical handoff and keep `README.md` consistent with it.
5. If no documentation edit is necessary, make that a deliberate conclusion after review.

Do not leave important behavior documented only in a chat transcript.

## Frontend deployment and cache safety

GitHub Pages/mobile-browser caching has caused real stale-asset behavior in production.

1. Any change to an HTML-referenced CSS or JavaScript entry asset must include the corresponding `?v=` cache-busting version bump in every HTML page that loads it.
2. `styles.css` is shared by public and admin pages; changing it requires bumping the stylesheet version in both HTML files.
3. Admin-only CSS may use a separate versioned stylesheet loaded only by `admin/index.html`; changing it still requires a new URL there.
4. Review transitive ES-module imports when changing imported modules. An HTML query-string change on an entry module does not automatically prove that every imported module has been invalidated in every browser cache.
5. Keep the existing no-cache HTML meta directives.
6. Never make manual cache clearing or hard refresh a required deployment step for end users.

## Automated QA is the default regression layer

Routine regression coverage belongs in code, not repeated manual checklists.

1. Run `npm test` for implementation changes when the environment allows it.
2. Add or update unit tests for changes to calculations, validation, normalization, accounting, finality, or other deterministic business rules.
3. Add or update Playwright tests for browser workflows that can be exercised safely with mocked Supabase/Sleeper responses.
4. Existing automated coverage must remain green before considering a change complete.
5. `.github/workflows/qa.yml` runs the suite on `main` pushes and pull requests; do not weaken or bypass it to land a change.
6. Tests must not write production Supabase data. Browser tests should mock external APIs unless the specific purpose is a read-only integration check.
7. Keep both desktop Chromium and iPhone-sized browser coverage for core flows.
8. When a manual QA session discovers a reproducible regression, add an automated regression test for it whenever practical before or with the fix.
9. A QA job that hangs, times out, or is cancelled is a failed release signal, not a neutral result. Investigate it before declaring a frontend change complete.
10. Browser tests should target stable semantic contracts (element IDs, names, roles, or dedicated test attributes) instead of exact presentation copy when the wording itself is not the behavior under test. If visible wording changes intentionally, update copy assertions only where the wording is part of the requirement.
11. When QA is red on `main`, perform diagnosis and repair on a branch/PR so intermediate commits do not trigger GitHub Pages deployments. Merge only after branch QA is green, then confirm both Automated QA and Pages deployment succeed for the exact same merge commit before declaring recovery complete.

Manual testing remains appropriate for visual judgment, real-device ergonomics, and novel workflows not yet represented in the suite, but it should not be the primary way previously verified business behavior is rechecked.

## Admin DOM rerender safety

The admin portal has repeatedly been frozen by independent `MutationObserver` loops. The failure mode is important: a companion script observes DOM mutations, then writes to the same observed area; that write creates another mutation, which can trigger that script or another companion script again. The page may render partially while the browser event loop is starved, making the portal appear completely down.

1. `js/admin-bootstrap.js` is the **only** admin module allowed to create a `MutationObserver` for `#app`. It observes top-level child replacement only and emits the `fantasy-admin-rendered` event after a core rerender.
2. Admin companion modules (`admin-layout.js`, `admin-qol.js`, `admin-bet-entry.js`, `bet-adjustments-admin.js`, `bet-results-admin.js`, and future equivalents) must subscribe to `fantasy-admin-rendered`; they must not add their own DOM observers.
3. The bootstrap coordinator must ignore enhancement-only top-level mutations so enhancement rendering cannot recursively signal itself.
4. Companion render functions must remain idempotent where practical. Before assigning text/attributes or inserting/removing nodes, skip no-op writes when the existing state already matches.
5. If a UI enhancement can be rendered directly in `admin.js` rather than repaired after render, prefer the direct rendering path. Remove superseded post-render hacks when practical.
6. Any regression involving a frozen/blank admin portal must get a short-timeout browser startup/interactivity test and a structural unit test that protects this single-observer architecture.
7. When CI takes dramatically longer after an admin DOM change, inspect for rerender feedback immediately. Do not treat a timeout as an unrelated flaky test.
8. Enhancement launchers rendered outside `#app` must remain hidden or inert until the controls they expose have been moved into their final target and are ready for interaction. Never expose a clickable header/dialog trigger during the transient initial-render state when its target controls are still absent.

## Admin mutation and dirty-state discipline

The admin portal protects in-memory changes that have not yet reached the active persistence target.

1. Any new admin path that mutates league data without immediately persisting it must participate in the existing dirty-state mechanism and expose the unsaved warning/sticky save behavior.
2. Keep unsaved-state behavior centralized in the admin quality-of-life layer. New admin companion modules must emit ordinary DOM events or otherwise integrate with that layer rather than inventing a separate dirty-state implementation.
3. Successful production or TEST MODE persistence must clear dirty state; failed saves must leave it dirty.
4. Browser unloads and destructive actions that can discard dirty data must remain guarded.
5. Track raw form typing that still requires its existing **Apply** action as unapplied draft state, not dirty league state. Warn before discarding that draft, and reserve the sticky save indicator for data the main save path can actually persist.
6. Weekly closeout and week-selector attention markers are derived UI state only. Do not add schema fields or persistence solely to store those indicators.

## QA expectations

Before considering a change complete, check for consistency across:

- canonical vs derived data
- public vs admin behavior
- accounting/ledger/pot semantics
- labels and terminology
- mobile layout and overflow
- authentication/session behavior when relevant
- import/export validation when the data shape changes
- documentation
- cache-busting/version references for frontend assets

For destructive/manual admin QA, use the built-in TEST MODE before touching production data. Test both production-snapshot and clean-league seeds when relevant. Verify reset, page refresh persistence, Exit & discard, and that the public dashboard remains unchanged while test data is mutated. TEST MODE must remain isolated at the storage boundary: do not add feature-specific test implementations or any test path that can write the production league row.

Production league data must never become canonical in `localStorage`; only disposable TEST MODE copies may live there. Authentication and Supabase RLS remain the production security boundary and must not be weakened to make testing easier.

Remove superseded code rather than leaving duplicate implementations hidden by runtime DOM manipulation whenever practical.
