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
