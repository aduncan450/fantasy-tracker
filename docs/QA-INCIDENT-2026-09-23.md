# QA Recovery Retrospective — 2026-09-23

## What happened

Automated QA began failing after a sequence of admin portal and TEST MODE changes. The recovery eventually identified three different classes of problems:

1. stale browser assertions that still targeted old copy or element behavior;
2. a real TEST MODE launcher race caused by moving live event-wired controls across DOM roots while the admin UI rerendered;
3. a final Playwright timing issue where the test clicked the TEST MODE dialog action before that proxy button was visible.

The final recovery commit was `767d774efec016d0c9645bcf6be79c02b833ef32`. Automated QA and GitHub Pages both succeeded for that exact commit.

## Decisions that were correct

### Keep broken recovery work off `main`

Once QA was red, diagnosis and repair stayed on a branch/PR. This prevented each investigative commit from becoming a GitHub Pages deployment. This is the correct default for future release-signal failures.

### Distinguish stale tests from product regressions

Several failures were test assumptions rather than application defects. Good fixes included:

- targeting the stable `#weekly-bet-adjustments` section instead of presentation copy;
- verifying payment effects through pot/accounting behavior rather than expecting a checkbox DOM node to remain mounted after a rerender;
- waiting for the TEST MODE dialog proxy action to become visible before clicking it.

Tests should assert the behavior that matters and synchronize on intended UI state, not incidental DOM lifetime or exact wording unless wording is itself a requirement.

### Replace cross-root control movement with stable proxy controls

The original TEST MODE enhancement physically moved event-wired core buttons out of `#app` into a dialog. That interacted badly with the admin rerender lifecycle. Keeping the live core controls in their original render tree and delegating through stable dialog proxy buttons is simpler and more robust.

This is a reusable admin-UI rule: preserve ownership of live controls and delegate to them rather than reparenting them across independently managed DOM roots.

### Require QA and Pages to pass on the same commit

A successful Pages deployment and a successful QA run on different commits is not enough. Recovery was only complete after both succeeded on merge commit `767d774e`. This removes ambiguity about what is actually deployed.

### Temporary diagnostic isolation can be useful

Splitting the E2E suite by spec temporarily showed that every individual spec passed and that the remaining failure only appeared in normal combined execution. That was useful evidence.

The important constraint is that diagnostic CI changes remain temporary, are reverted before merge, and do not replace the normal release workflow.

## Mistakes and what to do instead

### We changed architecture before fully exploiting the failing log

The biggest process mistake was iterating through several readiness/lifecycle fixes before obtaining and following the exact Playwright failure evidence. The final failure was straightforward once the job log was read: the target button existed but was not yet visible.

**Rule:** start with the exact failed assertion, call log, stack trace, and trace/artifact when available. Form one hypothesis from that evidence and make the smallest change that tests it.

### We let one failure trigger too many simultaneous hypotheses

At points the investigation mixed product race fixes, test-helper changes, lifecycle changes, and CI restructuring. That made it harder to know which change actually improved the situation.

**Rule:** one evidence-backed hypothesis per iteration. Prefer the smallest code or test change, then rerun the normal QA workflow before introducing another layer of change.

### We treated combined-suite failure as proof of a deeper application architecture problem too quickly

When every spec passed independently but the normal suite failed, deeper shared-state or timing interactions were plausible, but not yet proven. The remaining issue turned out to be test synchronization.

**Rule:** when isolated tests pass but the combined suite fails, inspect timing, shared browser/server state, parallel execution, and test synchronization before redesigning application architecture.

### We overused diagnostic workflow changes

The split CI workflow was informative, but it added operational churn and could have become a distraction if left in place.

**Rule:** use workflow instrumentation only when ordinary logs cannot isolate the failure. Revert diagnostic workflow changes immediately after they answer the specific question.

### A green branch run was treated as stronger evidence than it really was

Intermittent timing problems can produce a green run without being fixed. A single pass after a race-related change is useful but not definitive if the preceding evidence suggests nondeterminism.

**Rule:** for a suspected race/flaky timing fix, rerun the normal workflow at least once before merge when practical. Do not create extra architecture solely to chase certainty; use one repeat run as a bounded confidence check.

## Preferred recovery sequence

For future QA failures:

1. Keep `main` unchanged if a red `main` release signal is under investigation.
2. Read the exact failing job log before changing code.
3. Classify the failure as likely product bug, stale assertion, test synchronization problem, or infrastructure issue.
4. Make one minimal evidence-backed change.
5. Run the normal QA workflow, not a permanently modified diagnostic workflow.
6. If the problem is timing/race-related, one repeat green run is reasonable before merge.
7. Merge once.
8. Verify Automated QA and Pages both succeed on the exact merge SHA.
9. Only then declare recovery complete.

## Documentation placement

Product and league behavior still belongs in `docs/SPEC.md`. The lessons in this incident are engineering/process rules, so the durable rules belong in `AGENTS.md`; this retrospective preserves the reasoning and incident history without bloating the product specification.
