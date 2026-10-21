# #481 — the unreproduced Packed conversation WebKit crash: recovered context, reproduction, isolation

Tracks [adea-ai/ui#481](https://github.com/adea-ai/ui/issues/481). The reported crash is a **one-off**
failure of the "Packed conversation" gate. It is reproduced here, and it is **not fixed here**: what is
fixed is that the gate now _says_ which leg lost the browser and that the leg is unproven, instead of
failing with one opaque line.

Nothing in this document claims provider acceptance, native acceptance, readiness or a merge.

## 1. The recovered crash context

The original failure is preserved in the CI record of the `adea-ai/ui` "Design System Gates" workflow:

| Field                          | Value                                                                                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflow run                   | Design System Gates **#1802**, run id `39633349576`                                                                                                                   |
| Trigger                        | `pull_request` (**synchronize**), PR #477, branch `claude/lazy-workspace-reorder-dialog`                                                                              |
| Head                           | `f6c7d8e8` — _"test(ui): type the split-chunk fixture bodies as strings"_                                                                                             |
| Created                        | 2026-10-21T16:16:58Z · conclusion **failure**                                                                                                                         |
| Failing job                    | `119337285987`… **`Packed conversation`**, 2 m 12 s                                                                                                                   |
| Failing step                   | **9 — "Verify packed conversation composition"** (`bun run check:packed-conversation`), 16:20:35Z → 16:21:52Z (77 s)                                                  |
| Annotation                     | _"Process completed with exit code 1."_                                                                                                                               |
| Second failure in the same run | job `119337228690` — **"Component interactions (3/6)"**, step 8, 4 m 32 s (a different lane; the changed spec in that head lands in shards 3/6 and 6/6)               |
| Sibling runs, same branch      | **#1801** (head `11dbc455`) **success** · **#1803** (head `c397eb27`) **success**                                                                                     |
| Runs after it                  | **#1806** (`1f9638b3`, the merged #477 on main), **#1809** (`6e4a750b`, 0.145.2), **#1810** (`bec67ef8`, #478), **#1813** (`822827eb`, **0.146.0**) — all **success** |

**The exact environment of that failure**

| Item       | Value                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runner     | `ubuntu-latest` (linux/amd64) in the container `mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27` |
| Playwright | 1.63.0, exactly the version the lockfile pins (`@playwright/test@1.63.0` → `playwright@1.63.0` → `playwright-core@1.63.0`)                                          |
| Engines    | chromium and **webkit build 2359** from that image                                                                                                                  |
| Toolchain  | bun 1.4.3, node 24.21.0, ubuntu 26 image migration announced by the runner                                                                                          |
| Gate       | `bun run check:packed-conversation` → `packages/ui/scripts/check-packed-conversation.ts`                                                                            |

**What was not recoverable.** The failing job's own log is admin-only: the API answers
`403 "Must have admin rights to Repository."` and the web view asks a reader to sign in. The original
engine output was therefore never read, and the only thing the CI record kept was _"Process completed with
exit code 1."_ The signature below is characterised from the local reproduction, not from that log.

## 2. The reproduction attempts

All attempts used the repository's own gate, unmodified except for the diagnosis in §4, and the pinned
Playwright/WebKit build.

| Batch                                     | Platform                                    | Attempts | Result                                                |
| ----------------------------------------- | ------------------------------------------- | -------- | ----------------------------------------------------- |
| Earlier host campaign                     | macOS arm64, Playwright 1.63.0, WebKit 2359 | 10       | 10 pass                                               |
| Container batch 1                         | the pinned image, **linux/arm64**           | 6        | 6 pass                                                |
| Container batch 2                         | the pinned image, **linux/arm64**           | 6        | 5 pass, **1 fail**                                    |
| Container campaign 1 (`DEBUG=pw:browser`) | the pinned image, **linux/arm64**           | 10       | 10 pass                                               |
| Container campaign 2 (`DEBUG=pw:browser`) | the pinned image, **linux/arm64**           | 12       | 10 pass, **2 fail**                                   |
| **Total**                                 |                                             | **41**   | **38 pass, 3 fail** (7.3%), 820 legs, 410 WebKit legs |

Every attempt builds the package from the locked dependencies and runs the whole gate: ten pilots × two
conditions × two engines = **twenty legs**, ten of them WebKit.

**The preserved failures**

| #   | Leg                                 | Signature                                                                        |
| --- | ----------------------------------- | -------------------------------------------------------------------------------- |
| 1   | leg 17 — `atomic/compiled/chromium` | `error: evaluate: Target page, context or browser has been closed` / ` log: [],` |
| 2   | leg 20 — `atomic/solid/webkit`      | `error: evaluate: Target crashed` / ` log: [],`                                  |
| 3   | leg 18 — `atomic/compiled/webkit`   | `error: evaluate: Target page, context or browser has been closed` / ` log: [],` |

The engine's own output for failure 2 (kept with `DEBUG=pw:browser`, so the **failing run's own** engine
output is preserved) shows the engine exiting with `exitCode=0, signal=null` and _"gracefully close end"_ —
no crash signal and no out-of-memory message. The only `CRITICAL` line WebKit prints is the ambient
`WebKitWebView is-controlled-by-automation set but automation is not allowed in the context`, which appears
on **every** WebKit launch, successful ones included.

**Two distinct signatures, one shape.** A renderer crash (`Target crashed`) and the browser going away
(`Target page, context or browser has been closed`) are the same class of event seen from two angles: the
WebKit engine dies under the packed fixture and Playwright reports the loss. In every case the **immediate
re-run of the same gate passes all twenty legs** — which is why the CI failure was a one-off and why the
earlier rounds did not see it.

## 3. The smallest failing case

All three reproduced failures land in the **`atomic` pilot** (legs 17–20) — the largest packed fixture,
which is the only one that bundles the editor, the token transactions, the collapsible composer and the
scene controls in one composition. The other four pilots (conversation, composer-fields, busy, composed)
never failed in 41 attempts.

Within the pilot, the failures are not leg-stable (17, 18 and 20), and they are not engine-stable either:
one landed on a chromium leg and two on WebKit legs. **The isolation is therefore the pilot, not a single
leg and not a single engine.**

## 4. What is fixed, and what is not

**Fixed — the gate now says what happened.** A browser process that dies mid-interaction used to leave the
gate with one opaque Playwright line and no indication of which leg lost the browser, so the CI record
kept only _"Process completed with exit code 1."_ The gate now names the leg and states that the packed
contract is unproven in that run:

```
Packed atomic/compiled/webkit: the browser process went away mid-interaction
(click: Target page, context or browser has been closed); the packed contract is
unproven in this run
```

The original error is kept as the cause, so Playwright's own detail is not lost, and **every other
failure is returned unchanged** — the gate's fail-closed behaviour and all of its assertions are untouched.
The diagnosis lives in `packages/ui/scripts/packed-browser-gone.mjs` and is pinned by
`packages/ui/scripts/check-packed-browser-gone.test.mjs`, which runs first in the gate's own script, exactly
as `check:packed-layout` runs its own test first.

**Not fixed — the crash itself.** The engine still dies under the packed fixture. This revision changes no
assertion, no budget, no engine and no environment, so **the crash is not claimed as fixed**: the honest
statement is that it is _reproduced_ (7.3% of attempts on this machine), _isolated_ (the `atomic` pilot),
and _now diagnosable_, and that the cause of the engine death is not established. The candidates the
evidence keeps open, none of them established by this work:

- the renderer dying under the atomic fixture's memory or scheduling pressure (every failure landed in the
  largest composition, and the failures drift across legs);
- an engine-level fault in the WebKit build under this fixture;
- runner contention on the CI host (the same run also failed an unrelated component shard).

The CI container is linux/amd64 and this investigation ran the **linux/arm64** variant of the same pinned
digest, because the amd64 image cannot execute on this arm64 host (Rosetta translation of its binaries
fails). The engine build is the same (webkit-2359) and the toolchain matches CI's, but the platform does
not. The failing CI job's own log is still unread, and reading it from an admin context is the one step
that would settle which candidate applies.

**Proposed next steps, for the owner — not taken here**

1. Read run `39633349576`, job `119337285987` from an admin context, and attach the engine's own output to
   #481. The diagnosis in §4 will then name the leg in that log too.
2. Establish whether the `atomic` pilot's composition is what the engine cannot carry — the pilot's fixture
   size against the runner's memory — before changing anything about the fixture.
3. If the engine death cannot be removed, decide whether the gate should retry a lost leg once. That is a
   release-gate decision, and it is deliberately **not** taken here: it would change what the gate
   accepts, and this investigation does not establish that a retry is sound.

## 5. What was not done

No credential access, no broad log collection, no production traffic, no weakened test, no change to the
packed tree or the release, no unrelated change. The gate's assertions, budgets, engines and environment are
unchanged; the only behaviour change is the wording of a failure that already failed the job.
