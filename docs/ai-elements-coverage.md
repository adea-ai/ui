# AI Elements coverage

Every pattern in the shadcn AI Elements suite (October 2026) and what this
library ships for it. "Foundation" patterns are the building blocks the rest are
composed from. Import paths are the published subpaths of `@adea-ai/ui`
(`@adea-ai/ui/components/<layer>/<name>`); everything is also on the package
barrel.

Read [`ai-elements.md`](./ai-elements.md) first: every row below follows the same
rule, that a component draws only the data and handlers a host gives it. The
last column says what that is, so a host knows what it must be able to supply
before it shows the pattern, and what to leave out when it cannot.

## Foundation

| Pattern          | Module                        | Stories                       | The host must supply                                                                                                                                                                  |
| ---------------- | ----------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Message Scroller | `composites/message-scroller` | `Composites/Message Scroller` | Turns as children; `resetKey` per session; `onLoadOlder` + `hasOlder` only if earlier turns can really be loaded                                                                      |
| Message          | `ui/message`                  | `UI/Message`                  | A role, a label, and the text. `streaming` marks a reply that is still arriving. `citations` and a per-block `codeBlockProps` function only when the host has sources or marked lines |
| Bubble           | `ui/bubble`                   | `UI/Bubble`                   | The person's text; `state` only for a send the host tracks                                                                                                                            |
| Trace            | `ui/trace`                    | `UI/Trace`                    | One `TraceLine` per thing done. `status` only when the host states one                                                                                                                |
| Code Block       | `ui/code-block`               | `UI/Code Block`               | Source text and, optionally, a language and a lazy highlighter. `complete` is false only while the text is still growing                                                              |
| Marker           | `ui/marker`                   | `UI/Marker`                   | A label; `action` only for a handler that exists                                                                                                                                      |
| Attachment       | `ui/attachment`               | `UI/Attachment`               | Name, kind, size; `onRemove`/`onOpen` only when they work                                                                                                                             |
| Questionnaire    | `ui/questionnaire`            | `UI/Questionnaire`            | Questions, answers, `onSubmit`; `disabledReason` when the person may not answer                                                                                                       |

## The suite

| Group        | Pattern          | Module                                               | Stories                                                   | The host must supply                                                                                               |
| ------------ | ---------------- | ---------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Conversation | Chat             | `composites/chat`                                    | `Composites/Chat`, `Composites/Chat Scenario`             | Slots: header, notices, thread, composer                                                                           |
| Conversation | Message          | `ui/message`                                         | see Foundation                                            |                                                                                                                    |
| Conversation | Prompt Input     | `conversation/chat-composer` (+ `ChatComposerShell`) | `Conversation/Composed input`, `Composites/Chat Scenario` | A draft, `onSend`; Stop/Steer only for operations that exist                                                       |
| Conversation | Suggestion       | `composites/suggestion`                              | `Composites/Suggestion`                                   | Prompt strings and `onSelect`                                                                                      |
| Activity     | Chain of Thought | `composites/chain-of-thought`                        | `Composites/Chain Of Thought`                             | A summary and the steps the host chose to show                                                                     |
| Activity     | Reasoning        | `composites/reasoning`                               | `Composites/Reasoning`                                    | Text the host marked as user-visible. No text, no body                                                             |
| Activity     | Tool             | `composites/tool`                                    | `Composites/Tool`                                         | Name, and `status` (`cancelled` only for a call the host knows was stopped)/`input`/`output` only if known         |
| Activity     | Subagent         | `composites/subagent`                                | `Composites/Subagent`                                     | Name, task, status; its steps as children                                                                          |
| Activity     | Task             | `composites/task`                                    | `Composites/Task`                                         | Items with optional status and files                                                                               |
| Activity     | Plan             | `composites/plan`                                    | `Composites/Plan`                                         | Steps; actions only for handlers that exist                                                                        |
| Activity     | Queue            | `composites/queue`                                   | `Composites/Queue`                                        | Todo items; `QueueFollowUps` only if the host can queue messages                                                   |
| Results      | Terminal         | `composites/terminal`                                | `Composites/Terminal`                                     | Command output (ANSI is parsed and restricted)                                                                     |
| Results      | Stack Trace      | `composites/stack-trace`                             | `Composites/Stack Trace`                                  | Trace text                                                                                                         |
| Results      | Test Results     | `composites/test-results`                            | `Composites/Test Results`                                 | A structured run: summary and/or suites                                                                            |
| Results      | File Tree        | `composites/file-tree`                               | `Composites/File Tree`                                    | Paths and an optional change kind each                                                                             |
| Grounding    | Sources          | `composites/sources`                                 | `Composites/Sources`                                      | `{ title, url, snippet? }` the model really used                                                                   |
| Grounding    | Inline Citation  | `composites/inline-citation`                         | `Composites/Inline Citation`                              | Source references that resolve to those sources; `messageCitations(sources)` binds `[^n]` markers in `MessageText` |
| Controls     | Confirmation     | `composites/confirmation`                            | `Composites/Confirmation`                                 | A request, `onApprove`/`onDeny` that reach the runtime, and the outcome only when known                            |
| Controls     | Checkpoint       | `composites/checkpoint`                              | `Composites/Checkpoint`                                   | A named point; `onRestore` only if restoring is real                                                               |
| Controls     | Context          | `composites/context`                                 | `Composites/Context`                                      | Any of used/total/breakdown/cost. Nothing known, nothing drawn                                                     |
| Controls     | Model Selector   | `composites/model-selector`                          | `Composites/Model Selector`                               | Models, current value, `onChange`; efforts per model                                                               |

## Composed scenarios

`Composites/Activity Scenario`, `Composites/Grounding And Controls Scenario`,
`Composites/Results Scenario` and `Composites/Chat Scenario` each put several of
the patterns in one realistic turn instead of showing every control at once. They
use fixture data and are for design review and tests only; nothing in a story
is evidence that a host can produce the same data.

## Where a pattern has no producer

A pattern in this table is _available_, not _live_. The Adea chat shows only the
rows for which its runtime emits real data; the others are listed with the missing
contract in Adea's `docs/evidence/chat-canvas-2026-10-15.md`.
