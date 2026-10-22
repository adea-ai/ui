# #481 — the unreproduced Packed conversation WebKit crash: recovered context, reproduction, isolation

Tracks [adea-ai/ui#481](https://github.com/adea-ai/ui/issues/481). The reported crash is a **one-off**
failure of the "Packed conversation" gate. It is reproduced here, and it is **not fixed here**: what is
fixed is that the gate now _says_ which leg lost the browser or renderer, instead of failing with one
opaque line. **The crash itself remains unresolved** — its cause is not established — and issue #481 stays
open.

Nothing in this document claims provider acceptance, native acceptance, readiness or a merge.

## 1. The recovered crash context

The original failure is preserved in the CI record of the `adea-ai/ui` "Design System Gates" workflow:

| Field                          | Value                                                                                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflow run                   | Design System Gates **#1802**, run id `39633349576`                                                                                                                   |
| Trigger                        | `pull_request` (**synchronize**), PR #477, branch `claude/lazy-workspace-reorder-dialog`                                                                              |
| Head                           | `f6c7d8e8` — _"test(ui): type the split-chunk fixture bodies as strings"_                                                                                             |
| Created                        | 2026-10-21T16:16:58Z · conclusion **failure**                                                                                                                         |
| Failing job                    | **`Packed conversation`**, 2 m 12 s                                                                                                                                   |
| Failing step                   | **9 — "Verify packed conversation composition"** (`bun run check:packed-conversation`), 16:20:35Z → 16:21:52Z (77 s)                                                  |
| Annotation                     | _"Process completed with exit code 1."_                                                                                                                               |
| Second failure in the same run | **"Component interactions (3/6)"**, step 8, 4 m 32 s (a different lane; the changed spec in that head lands in shards 3/6 and 6/6)                                    |
| Sibling runs, same branch      | **#1801** (head `11dbc455`) **success** · **#1803** (head `c397eb27`) **success**                                                                                     |
| Runs after it                  | **#1806** (`1f9638b3`, the merged #477 on main), **#1809** (`6e4a750b`, 0.145.2), **#1810** (`bec67ef8`, #478), **#1813** (`822827eb`, **0.146.0**) — all **success** |

**The exact environment of that failure**

| Item       | Value                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runner     | `ubuntu-latest` (linux/amd64) in the container `mcr.microsoft.com/playwright:v1.63.0-noble@sha256:eff16c30e6f3f4af0a03fa4b706120d5e9b0891c344a27d64559aff5900a4a27` |
| Playwright | 1.63.0, exactly the version the lockfile pins (`@playwright/test@1.63.0` → `playwright@1.63.0` → `playwright-core@1.63.0`)                                          |
| Engines    | chromium and **webkit build 2359** from that image                                                                                                                  |
| Toolchain  | bun 1.4.3, node 24.21.0                                                                                                                                             |
| Gate       | `bun run check:packed-conversation` → `packages/ui/scripts/check-packed-conversation.ts`                                                                            |

**What was not recoverable.** The failing job's own log is admin-only: the API answers
`403 "Must have admin rights to Repository."` and the web view asks a reader to sign in. **The signature of
the original CI failure was therefore never read.** The signatures below are the ones the _local_ runs
produced; they are **not** evidence of what happened in CI, and the local reproductions do not establish
the CI cause. The only thing the CI record kept is _"Process completed with exit code 1."_

## 2. The reproduction attempts

The repository's own gate, the pinned Playwright/WebKit build. The gate is a matrix of **five pilots × two
conditions × two engines = twenty legs**, ten of them WebKit; within a (pilot, condition) the chromium leg
runs first and the WebKit leg second, so an even leg number is a WebKit leg.

| Batch                                     | Platform                                    | Attempts | Result              |
| ----------------------------------------- | ------------------------------------------- | -------- | ------------------- |
| Host campaign                             | macOS arm64, Playwright 1.63.0, WebKit 2359 | 10       | 10 pass             |
| Container batch 1                         | the pinned image, **linux/arm64**           | 6        | 6 pass              |
| Container batch 2                         | the pinned image, linux/arm64               | 6        | 5 pass, **1 fail**  |
| Container campaign 1 (`DEBUG=pw:browser`) | the pinned image, linux/arm64               | 10       | 10 pass             |
| Container campaign 2 (`DEBUG=pw:browser`) | the pinned image, linux/arm64               | 12       | 10 pass, **2 fail** |
| **Total**                                 |                                             | **44**   | **41 pass, 3 fail** |

Every attempt builds the package from the locked dependencies and runs the whole twenty-leg gate: 44
attempts, 880 legs, 440 of them WebKit.

**The three failures, from their receipts**

| #   | Fail-fast count (legs started) | Failing leg                        | Signature                                                                        | Directly observed?                |
| --- | ------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------- | --------------------------------- |
| 1   | 16 legs (8 WebKit)             | **#16 — `composed/solid/webkit`**  | not read                                                                         | **no** — see below                |
| 2   | 20 legs (10 WebKit)            | **#20 — `atomic/solid/webkit`**    | `error: evaluate: Target crashed` / ` log: [],`                                  | yes, with the engine's own output |
| 3   | 18 legs (9 WebKit)             | **#18 — `atomic/compiled/webkit`** | `error: evaluate: Target page, context or browser has been closed` / ` log: [],` | yes                               |

Failure 1's own log was overwritten by a later campaign phase before it was copied, so only its count
receipt survives and neither its signature nor its browser is directly observed. **An earlier revision of
this document placed that failure at leg 17, `atomic/compiled/chromium`; the fail-fast count places it in
the preceding WebKit leg, #16.** The earlier row is recorded here rather than dropped, because the count is
the evidence and the earlier row was an off-by-one over it.

**What the engine output shows.** For failure 2 the engine exits with `exitCode=0, signal=null` and _"gracefully
close end"_ — **no crash signal and no out-of-memory message**. The only `CRITICAL` line WebKit prints is
the ambient `WebKitWebView is-controlled-by-automation set but automation is not allowed in the context`,
which appears on **every** WebKit launch, successful ones included. The container has no memory limit
(`cgroup memory.max = max`, 15.9 GB visible, 14 GB free) and no log carries OOM text.

**Two signatures, and what they do not say.** A renderer that died (`Target crashed`) and a browser that
went away (`Target page, context or browser has been closed`) are two shapes of engine failure seen from
the packed gate. They are **local** observations: they say that this gate loses a browser or renderer
under this fixture on this machine. They do not say that the archived CI failure was either of them.

## 3. The isolated case

All three failures land in the **later legs of a run** — legs 16, 18 and 20 — inside the two largest
compositions, `composed` (leg 16) and `atomic` (legs 18 and 20). The other three pilots never failed in
44 attempts. The failures drift across the legs of those pilots and were all on WebKit legs; **no local
failure was recorded on a chromium leg**, and the earlier revision's claim that one was is corrected above
by the fail-fast counts.

The pilot is therefore the isolation, not a single leg and not an engine.

## 4. What is fixed, and what is not

**Fixed — the gate now says what happened.** A browser or renderer that dies mid-interaction used to leave
the gate with one opaque Playwright line and no indication of which leg lost it, so the CI record kept only
_"Process completed with exit code 1."_ The gate now names the leg and states that the packed contract is
unproven in that run:

```
Packed atomic/compiled/webkit: the browser process went away mid-interaction
(click: Target page, context or browser has been closed); the packed contract is
unproven in this run
```

and a renderer that died is named apart from a browser that went away, because the two are different
failures:

```
Packed atomic/solid/webkit: the page's renderer crashed mid-interaction
(evaluate: Target crashed); the packed contract is unproven in this run
```

The original error is kept as the cause, so Playwright's own detail is not lost, and **every other failure is
returned unchanged** — the gate's fail-closed behaviour and all of its assertions are untouched. The
diagnosis lives in `packages/ui/scripts/packed-browser-gone.mjs` and is pinned by
`packages/ui/scripts/check-packed-browser-gone.test.mjs`, which runs first in the gate's own script, exactly
as `check:packed-layout` runs its own test first.

**Not fixed — the crash.** The engine still dies under the packed fixture. The cause is **not established**
and the crash is therefore **unresolved**. The candidates the evidence keeps open, none of them established
by this work:

- the renderer dying under the largest compositions' memory or scheduling pressure (every failure landed in
  the later legs of a twenty-leg run, and the failures drift across legs);
- an engine-level fault in the WebKit build under this fixture;
- runner contention on the CI host (the same run also failed an unrelated component shard).

The local reproductions do **not** establish the CI cause, and the new diagnosis does **not** annotate the
archived log: that log stays exactly as it is, and a future failure in the same gate carries its own leg in
its own log.

**Proposed next steps, for the owner — not taken here**

1. Read run `39633349576`, job `119337285987` from an admin context and attach the engine's own output to
   #481, so the archived occurrence is characterised from its own evidence.
2. Establish whether the `composed`/`atomic` compositions are what the engine cannot carry — the pilot's
   fixture size against the runner's memory — before changing anything about the fixture.
3. If the engine death cannot be removed, decide whether the gate should retry a lost leg once. That is a
   release-gate decision and is deliberately **not** taken here: it would change what the gate accepts, and
   this investigation does not establish that a retry is sound.

## 5. What was not done

No credential access, no broad log collection, no production traffic, no weakened test, no change to the
packed tree or the release, no unrelated change. The gate's assertions, budgets, engines and environment are
unchanged; the only behaviour change is the wording of a failure that already failed the job.
