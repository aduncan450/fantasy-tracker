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
3. Review transitive ES-module imports when changing imported modules. An HTML query-string change on an entry module does not automatically prove that every imported module has been invalidated in every browser cache.
4. Keep the existing no-cache HTML meta directives.
5. Never make manual cache clearing or hard refresh a required deployment step for end users.

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

Remove superseded code rather than leaving duplicate implementations hidden by runtime DOM manipulation whenever practical.
