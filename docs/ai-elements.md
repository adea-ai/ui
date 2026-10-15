# AI Elements

A Solid-native port of the shadcn AI Elements suite (October 2026 architecture),
built on this library's tokens and primitives. The suite is a set of *patterns*:
Trace, Code Block, Message Scroller, Message, Bubble, Marker, Attachment and
Questionnaire are the foundation, and the twenty-one named patterns are
compositions of them. Nothing here knows about a harness, a model vendor or a
transport. A host passes data and handlers; the components draw what they are
given and nothing else.

## Principles (read before writing a component)

1. **A status is a claim.** Every status, citation, checkpoint, test result and
   action exists only when the host supplied the data or the handler. A
   component without `onRestore` shows no restore button; a tool line with no
   `status` shows no tick; reasoning is only ever text the host marked as
   user-visible. Fixtures are for stories and tests and are never presented as
   live behaviour.
2. **One quiet column.** Agent activity is `Trace` lines under the answer, not
   cards. Only a component the reader must act on (`Questionnaire`,
   `Confirmation`) is allowed a surface of its own.
3. **Text is text.** Model output, tool output, file names, URLs and languages are
   untrusted. Render text nodes; never `innerHTML`; a link needs `http:`,
   `https:` or `mailto:`; a name is never used as a path.
4. **Streaming is the normal case.** Keyed or positional children so finished
   parts keep their DOM (selection, focus, scroll) while the growing part
   updates; no work per token that is proportional to the whole transcript.
5. **Accessible by construction.** Real buttons with `aria-expanded`; every
   status also spoken; focus never lost when a control is replaced; hover-only
   actions are visible for `(hover: none)` and on focus; `prefers-reduced-motion`
   drops spinners, shimmer and carets.
6. **Tokens only.** Spacing/typography from the existing ladders, colours from
   `theme.css`, `cn()` object form for conditional classes, no inline style
   outside the shared component directory's allowed cases, never restyle another
   component (use its variants; extend its contract if one is missing).

## Layering

| Layer | Contents |
| --- | --- |
| `components/ui/*` | Foundation primitives: `trace`, `code-block`, `message`, `bubble`, `marker`, `attachment`, `questionnaire` |
| `components/composites/*` | The suite: scrolling, activity, results, grounding, controls |
| `components/conversation/*` | Pre-existing transcript pieces (`ConversationSurface`, `MessageRow`, `TranscriptComposition`, paste-token composer). Unchanged; Cortana still consumes them. |

## Coverage matrix

See the table at the end of this file; each row names the component, its
module path and the host data that makes it live.

## Composition

`Composites/Chat Scenario` (`packages/ui/src/components/composites/chat/chat-scenario.stories.tsx`)
assembles the suite into whole conversations, one realistic scene per story, and
is the reference for how the parts fit together. `Composites/Chat`
(`chat.stories.tsx`) shows the frame on its own.

| Story                 | What it shows                                                                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Working`             | A run in flight: reasoning, tools (one running), a subagent, grounded prose with `Sources`, a streaming tail, and a busy composer with Stop, a queued follow-up and a staged file |
| `WaitingForApproval`  | The run has stopped on a `Questionnaire` and a `Confirmation`; Send is off with the reason in words and clears as each is answered                                                |
| `Finished`            | `Terminal`, `TestResults` (one failing), `StackTrace`, `FileTree`, a restorable `Checkpoint` and an answer with a diff                                                            |
| `Reconnecting`        | A live `ChatNotice` with a retry; the last turn stays readable and Send is off with a reason                                                                                      |
| `Failed`, `Cancelled` | A `Marker` note records the end of the run; nothing is spinning                                                                                                                   |
| `Empty`               | `ChatEmpty` with `Suggestions`                                                                                                                                                    |

Which component fills which role:

| Role                                                   | Component                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frame, header, whole-conversation notices              | `Chat`, `ChatHeader`, `ChatNotice`                                                                                                                                                                                                                                                 |
| The thread and its turns                               | `MessageScroller`, `Message`, `Bubble`                                                                                                                                                                                                                                             |
| What the agent did (one quiet column under the answer) | `Trace` lines: `Reasoning`, `Tool`, `Subagent`, `Terminal`, `TestResults`, `StackTrace`, `FileTree`                                                                                                                                                                                |
| What the reader must act on (the only surfaces)        | `Questionnaire`, `Confirmation`                                                                                                                                                                                                                                                    |
| Grounding the prose                                    | `Sources`, `InlineCitation`                                                                                                                                                                                                                                                        |
| Events between and inside turns                        | `Checkpoint`, `Marker`                                                                                                                                                                                                                                                             |
| Empty thread                                           | `ChatEmpty`, `Suggestions`                                                                                                                                                                                                                                                         |
| Composer                                               | `ChatComposer`: `Suggestions` in `followUps`, `QueueFollowUps` in `band`, `Attachment` in `attachments`, `ComposerAttachmentButton` in `leadingActions`, a Stop `Button` in `trailingActions`, `ModelSelector` and `Context` in `context`, and `blockedReason` for a disabled Send |

Two rules these scenes keep, from the principles above: every status, citation
and checkpoint is data the story supplies (a running tool has no duration, the
unrestorable case has no Restore), and the only reasoning shown is a summary the
host marked as visible.
