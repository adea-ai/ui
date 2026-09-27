import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import {
  TranscriptComposition,
  type TranscriptRow,
} from '../../src/components/conversation/transcript-composition'
import './style.css'

type Message = Readonly<{ label: string }>

const prompt: TranscriptRow<Message> = {
  id: 'prompt',
  value: { label: 'Question' },
  opensTurn: 'reset',
}
const request: TranscriptRow<Message> = {
  id: 'request',
  value: { label: 'Tool request' },
  working: true,
  fold: 'tool',
  call: { phase: 'request', id: 'call-1' },
}
const result: TranscriptRow<Message> = {
  id: 'result',
  value: { label: 'Tool result' },
  working: true,
  fold: 'tool',
  call: { phase: 'result', id: 'call-1' },
}
const approval: TranscriptRow<Message> = {
  id: 'approval',
  value: { label: 'Pending approval' },
  fold: 'tool',
  alwaysVisible: true,
}
const diff: TranscriptRow<Message> = {
  id: 'diff',
  value: { label: 'Review required' },
  fold: 'tool',
  alwaysVisible: true,
}
const reasoning: TranscriptRow<Message> = {
  id: 'reasoning',
  value: { label: 'Interim reasoning' },
  reasoning: true,
  fold: 'prose',
}
const answer: TranscriptRow<Message> = {
  id: 'answer',
  value: { label: 'Final answer' },
  fold: 'prose',
  conclusion: true,
  turnEnd: true,
}

const initialRows = [prompt, request, result] as const
const promotedRows = [prompt, request, result, approval, diff, reasoning, answer] as const

function Fixture() {
  const [rows, setRows] = createSignal<readonly TranscriptRow<Message>[]>(initialRows)
  const [running, setRunning] = createSignal(true)
  const [foldState, setFoldState] = createSignal<'default' | 'collapsed' | 'expanded'>('default')
  const [resetKey, setResetKey] = createSignal('transcript-a')
  return (
    <section class="flex flex-col gap-2 p-4">
      <div class="flex flex-wrap gap-2">
        <button type="button" onClick={() => setRows(promotedRows)}>
          Promote turn
        </button>
        <button type="button" onClick={() => setRunning((value) => !value)}>
          Toggle running
        </button>
        <button
          type="button"
          onClick={() =>
            setResetKey((value) => (value === 'transcript-a' ? 'transcript-b' : 'transcript-a'))
          }
        >
          Switch transcript
        </button>
        <button
          type="button"
          onClick={() => {
            setRows(initialRows)
            setRunning(false)
            setFoldState('default')
          }}
        >
          Reset to tool-only transcript
        </button>
      </div>
      <output aria-label="Running state">{running() ? 'running' : 'settled'}</output>
      <TranscriptComposition
        rows={rows()}
        running={running()}
        foldMode="tools"
        foldState={foldState()}
        onFoldStateChange={setFoldState}
        resetKey={resetKey()}
        renderRow={(props) => (
          <article data-render-key={props.row.id} data-render-kind={props.context.displayKind}>
            <span data-render-label={props.row.value.label}>{props.row.value.label}</span>
            <span data-source-index>{props.context.index}</span>
          </article>
        )}
      />
    </section>
  )
}

render(() => <Fixture />, document.getElementById('app')!)
