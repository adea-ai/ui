# #481 — the unreproduced Packed conversation WebKit crash: recovered context, reproduction, isolation

Tracks [adea-ai/ui#481](https://github.com/adea-ai/ui/issues/481). The reported crash is a **one-off**
failure of the "Packed conversation" gate. It is reproduced here, and **the crash itself remains
unresolved** — its cause is not established — and issue #481 stays open. Two things _are_ fixed: the gate
now _says_ which leg lost the browser or renderer, instead of failing with one opaque line, and it no
longer tears a WebKit page down on a running CSS transition, which is the one path on which the harness
itself could kill a renderer.

Nothing in this document claims provider acceptance, native acceptance, readiness or a merge.

## 1. The recovered crash context

The original failure is preserved in the CI record of the `adea-ai/ui` "Design System Gates" workflow:

| Field                          | Value                                                                                                                                                                                                                                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflow run                   | Design System Gates **#1802**, run id `39633349576`                                                                                                                                                                                                                                                                           |
| Trigger                        | `pull_request` (**synchronize**), PR #477, branch `claude/lazy-workspace-reorder-dialog`                                                                                                                                                                                                                                      |
| Head                           | `f6c7d8e8` — _"test(ui): type the split-chunk fixture bodies as strings"_                                                                                                                                                                                                                                                     |
| Created                        | 2026-10-21T16:16:58Z · conclusion **failure**                                                                                                                                                                                                                                                                                 |
| Failing job                    | **`Packed conversation`**, 2 m 12 s                                                                                                                                                                                                                                                                                           |
| Failing step                   | **9 — "Verify packed conversation composition"** (`bun run check:packed-conversation`), 16:20:35Z → 16:21:52Z (77 s)                                                                                                                                                                                                          |
| Annotation                     | _"Process completed with exit code 1."_                                                                                                                                                                                                                                                                                       |
| Second failure in the same run | **"Component interactions (3/6)"** (job `119337228690`), step 8, 4 m 32 s — a different lane's failure, and **not** evidence of this crash. The "Workshop" and "Registry" jobs in that run are aggregation gates that failed because the jobs they aggregate had failed. Only the "Packed conversation" job is evidence here. |
| Sibling runs, same branch      | **#1801** (head `11dbc455`) **success** · **#1803** (head `c397eb27`) **success**                                                                                                                                                                                                                                             |
| Runs after it                  | **#1806** (`1f9638b3`, the merged #477 on main), **#1809** (`6e4a750b`, 0.145.2), **#1810** (`bec67ef8`, #478), **#1813** (`822827eb`, **0.146.0**) — all **success**                                                                                                                                                         |

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

### What the attempts ruled out

The reproduction is rare, so the cause was approached by elimination, on the supported path, with the same
pinned image and the same gate.

| Candidate                  | Experiment                                                  | Result                                                                                                                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A container memory ceiling | the container capped at **2 GiB** (`--memory=2g`)           | 8 runs, **0 failures**; the peak footprint was unchanged, so the cap never bound                                                                                                                                                          |
| … at a harder ceiling      | capped at **1 GiB**                                         | the gate still completes and passes; the crash does not appear                                                                                                                                                                            |
| A shared-memory shortfall  | `/dev/shm` shrunk to **32 MB** and to **4 MB**              | the gate cannot even install the packed consumer (0 legs, a different failure), so a shortfall below the default is not the trigger — and the CI packed jobs run at exactly that 64 MB default, since the workflow declares no `options:` |
| Process accumulation       | the engine process count sampled every 0.5 s across a run   | it alternates **2 → 3** and never climbs: each browser is reaped before the next, so nothing accumulates                                                                                                                                  |
| One pilot                  | only the two largest pilots (`composed` + `atomic`, 8 legs) | 8 runs, **0 failures**: the crash needs the whole twenty-leg sequence, not one pilot                                                                                                                                                      |
| The measured footprint     | the same sampler                                            | the engine processes hold **~1.26 GiB** RSS across three processes, ~1.72–1.77 GiB in total, **stable from run to run**                                                                                                                   |

**What the failures do show.** The **renderer** dies while the engine itself closes cleanly
(`exitCode=0, signal=null`, _"gracefully close end"_), with no crash signal and no out-of-memory text in
any log; the only `CRITICAL` line WebKit prints is ambient, on every launch. The failures need the whole
sequence and land in its later legs.

**The cause is not established.** The evidence above excludes a container memory ceiling, a shared-memory
shortfall, process accumulation and a single-pilot fault; it does not identify what kills the renderer.
The historical UI #241 (keyboard focus from a packed tree item) and #169 (tag-path AbortError during release
publication) are **distinct** failures and are not evidence for or against this one.

### The exact process and stderr evidence

A failing run and a passing run have the **same process topology**: twenty engine processes in ten pairs, the
same roles, and the same exits. Every logged child process — in the failing run and in a passing one alike —
ends as:

```
pw:browser [pid=…] <gracefully close start>
pw:browser [pid=…] <process did exit: exitCode=0, signal=null>
pw:browser [pid=…] <gracefully close end>
```

**No process dies with a signal, and the engine closes gracefully.** The renderer that "crashed" is not among
the logged processes, which is why the client's `Target crashed` is all the client sees.

The engine's **stderr** is the same in both: the set of stderr lines a failing run contains and a passing
run does not is **empty** (the only difference is the per-call `--playwright--set--content--<hash>` console
marker, whose hash differs per call). The single `CRITICAL` line WebKit prints —
`WebKitWebView is-controlled-by-automation set but automation is not allowed in the context, falling back to
default session` — appears **10 times in a passing run and 10 times in the failing one**: it is ambient, once
per WebKit launch, and not the differentiator. There is no assertion, no out-of-memory text and no crash
report in any of the three failures.

### The controlled arms

| Arm            | What it controls                                                                               | Result                        |
| -------------- | ---------------------------------------------------------------------------------------------- | ----------------------------- |
| **baseline**   | the released gate from `main` (`822827eb`), the same script with none of this branch's changes | 8 runs, 8 pass                |
| **current**    | this branch's gate                                                                             | 8 runs, 8 pass                |
| **concurrent** | four gates at once in one container                                                            | 12 runs, 12 pass              |
| **40 legs**    | the same five pilots twice in one process                                                      | 3 runs, 3 pass (40 legs each) |

**No further failure was recorded.** The arms are 31 further full-gate attempts, the fixed gate accounts for
six more, and a **crash-time probe** — the fixed gate with the page's running-transition count read every
250 ms, so that the state at the moment of a crash would be on the record — accounts for sixteen, and **not
one of them failed in a browser**. The only failures in that traffic were `npm pack` failing on a
half-written `packages/ui/dist` — two containers building and packing the same mounted worktree at once —
which is a race in the measurement harness, not in the gate, and which happened before the gate reached a
browser.

The crash-time probe therefore **could not read the state at the crash**: the crash is too rare to be caught
in sixteen attempts, and no reading is claimed from it.

The crash is **not** introduced by this pull request: the archived CI failure was on PR #477's branch, which
contains none of this branch's code, and the released baseline gate and this branch's gate behave the same.

## 3. The isolated case

All three failures land in the **later legs of a run** — legs 16, 18 and 20 — inside the two largest
compositions, `composed` (leg 16) and `atomic` (legs 18 and 20). The other three pilots never failed in
44 attempts. The failures drift across the legs of those pilots and were all on WebKit legs; **no local
failure was recorded on a chromium leg**, and the earlier revision's claim that one was is corrected above
by the fail-fast counts.

The pilot is therefore the isolation, not a single leg and not an engine.

The two pilots that fail are also the two that **collapse and re-expand the composer and check the IME
candidate** (`composed` and `atomic`); `conversation`, `composer-fields` and `busy` never failed in 44
attempts. That is where the search for a cause should continue, and it is the UI package's composer
collapse path — the shared `ime-guard` and the composer's focus restoration — rather than anything in this
gate's own control flow.

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

**Fixed — the gate no longer tears a WebKit page down on a running transition.** The gate's own teardown
was the one path on which the harness itself could kill a renderer, and it did so in the shape this issue
describes: the renderer dies and the engine still exits cleanly, with nothing in the log to say so. Measured
on the packed gate, **8 of its 20 legs ended with CSS transitions still running** — fourteen at once on
each composer-fields leg and four on each busy leg — and the browser was closed on them. The gate now
settles the page's finite transitions before it closes. The same count, measured in the run that carries the
fix, is:

| Leg                               | running before | running after |
| --------------------------------- | -------------- | ------------- |
| composer-fields/compiled/chromium | 19             | **0**         |
| composer-fields/compiled/webkit   | 14             | **0**         |
| composer-fields/solid/chromium    | 15             | **0**         |
| composer-fields/solid/webkit      | 14             | **0**         |
| busy/compiled/chromium            | 4              | **0**         |
| busy/compiled/webkit              | 4              | **0**         |
| busy/solid/webkit                 | 4              | **0**         |
| every other leg                   | 0              | **0**         |

"running before" is the number of CSS transitions still running when the leg ended; "running after" is
the same count once the settle has run. **Every leg now ends with nothing running.**

The settle is **strict**: on a leg that passed, a transition that fails for any reason other than a
cancelled one still fails the leg; only a leg that has _already_ failed treats the settle as best-effort, so
that its own error is the informative one. Nothing about the gate's assertions, budgets, engines,
environment, timeouts or retry behaviour changes, and no failure is masked: the leg still fails, and the
failure is now named.

**Not fixed — the crash.** The engine still dies under the packed fixture. The cause is **not established**
and the crash is therefore **unresolved**. The candidates the evidence keeps open, none of them established
by this work:

- the renderer dying under the largest compositions' memory or scheduling pressure (every failure landed in
  the later legs of a twenty-leg run, and the failures drift across legs) — note that a _container_ memory
  ceiling is excluded, but that does not exclude a limit the renderer itself reaches;
- an engine-level fault in the WebKit build under this fixture;
- runner contention on the CI host (the same run also failed an unrelated component shard).

**One teardown path is closed; the cause is not.** A fix here would have to be aimed at a cause, and the
cause is not established: the elimination above rules candidates out without identifying one. What the
revision does is remove the harness's own contribution to that class of failure — a page torn down on a
running transition — because that one _is_ demonstrable and measured, and the archived CI failure is a
renderer that died with no stderr while its engine exited cleanly. Changing the fixture, the gate's engine,
the job's resources or the retry policy on the strength of an unestablished cause would be a guess, and a
guess that weakens a release gate is worse than the open question.

The local reproductions do **not** establish the CI cause, and the new diagnosis does **not** annotate the
archived log: that log stays exactly as it is, and a future failure in the same gate carries its own leg in
its own log.

**Proposed next steps, for the owner — not taken here**

1. Read run `39633349576`, job **`119338375987`** ("Packed conversation") from an admin context and attach
   the engine's own output to #481, so the archived occurrence is characterised from its own evidence.
2. Keep the container's shared memory in view when reading that log: the packed consumer's own install
   already needs more than the 64 MB default, so the environment has no headroom to give, and a renderer
   that dies for want of memory would leave the kind of trace the CI log may hold. This is a **lead**, not a
   demonstrated cause — the gate cannot even reach the browser when shared memory is reduced below the
   default, so it cannot be tested from here.
3. Establish whether the `composed`/`atomic` compositions are what the engine cannot carry — the pilot's
   fixture size against the renderer's ~1.26 GiB — before changing anything about the fixture.
4. If the engine death cannot be removed, decide whether the gate should retry a lost leg once. That is a
   release-gate decision and is deliberately **not** taken here: it would change what the gate accepts, and
   this investigation does not establish that a retry is sound.

## 5. What was not done

No credential access, no broad log collection, no production traffic, no weakened test, no change to the
packed tree or the release, no unrelated change. The gate's assertions, budgets, engines and environment are
unchanged. The two behaviour changes are the wording of a failure that already failed the job, and the
settle-before-close step: a leg still fails on the same conditions, with the same thresholds and with no
retry, and the recorded 3-failures-in-41 evidence is unchanged.

**No fix is claimed for the crash.** The elimination in §2 rules candidates out without identifying a cause,
so the crash is reported as reproduced-but-unresolved rather than as fixed. What this revision does fix is
the harness's own teardown, which was demonstrable: the gate closed a WebKit page with up to nineteen CSS
transitions still running on it, and a renderer torn down that way dies exactly as this issue describes —
silently, while the engine exits cleanly. That path is now closed, and it is closed by waiting, not by
retrying, not by raising a threshold and not by skipping a check.

The search for the remaining cause should continue in the UI package's composer collapse path — the
`ime-guard` and the composer's focus restoration — which is where all three failures landed and which this
work does not touch.
