import { createSignal } from 'solid-js'
import { describe, expect, test } from 'bun:test'

import type {
  QuestionnaireAnswers,
  QuestionnaireProps,
  QuestionnaireQuestion,
} from '../src/components/ui/questionnaire/questionnaire'
import { useDom } from './helpers/dom'

const dom = useDom()

// Loaded once the window exists: the module registers its delegated handlers on the
// document as it evaluates, so a static import would run before the window was installed.
const { Questionnaire } = await import('../src/components/ui/questionnaire/questionnaire')
const tick = (ms = 10) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const text: QuestionnaireQuestion = { id: 'why', prompt: 'Why this approach?' }
const single: QuestionnaireQuestion = {
  id: 'db',
  prompt: 'Which database?',
  description: 'The one the service will own.',
  options: [
    { id: 'pg', label: 'Postgres', description: 'Relational' },
    { id: 'sqlite', label: 'SQLite' },
  ],
}
const multiple: QuestionnaireQuestion = {
  id: 'env',
  prompt: 'Which environments?',
  multiple: true,
  allowText: true,
  textLabel: 'Anything else?',
  options: [
    { id: 'dev', label: 'Dev' },
    { id: 'prod', label: 'Prod' },
  ],
}

const mount = (props: Partial<QuestionnaireProps> = {}) =>
  dom.mount(() => <Questionnaire questions={[text]} {...props} />)
const field = (root: HTMLElement) => root.querySelector('textarea') as HTMLTextAreaElement
const type = (area: HTMLTextAreaElement, value: string) => {
  area.value = value
  area.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
}
const buttons = (root: HTMLElement) =>
  [...root.querySelectorAll('footer button')] as HTMLButtonElement[]
const button = (root: HTMLElement, label: string) => {
  const found = buttons(root).find((candidate) => candidate.textContent?.trim() === label)
  if (!found) throw new Error(`no ${label} button`)
  return found
}
const ctrlEnter = (target: Element) =>
  target.dispatchEvent(
    new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
  )

describe('Questionnaire with a text question', () => {
  test('asks the question with a text box labelled for the answer', () => {
    const root = mount({ title: 'Need input' })
    const section = root.querySelector('section')!
    expect(section.getAttribute('aria-label')).toBe('Need input')
    expect(section.getAttribute('data-status')).toBe('open')
    expect(root.querySelector('h3')?.textContent).toBe('Need input')
    expect(root.querySelector('h4')?.textContent).toBe('Why this approach?')
    expect(root.querySelector('label')?.textContent).toBe('Your answer')
    expect(root.textContent).not.toContain('Question 1 of')
  })

  test('has default headings when the host names none', () => {
    const root = mount({ description: 'Pick wisely' })
    expect(root.querySelector('section')?.getAttribute('aria-label')).toBe(
      'Question from the agent'
    )
    expect(root.querySelector('h3')?.textContent).toBe('The agent has a question')
    expect(root.querySelector('header p')?.textContent).toBe('Pick wisely')
  })

  test('cannot be sent until there is an answer, then sends exactly what was typed', async () => {
    const sent: QuestionnaireAnswers[] = []
    const changes: QuestionnaireAnswers[] = []
    const root = mount({
      onSubmit: (answers) => void sent.push(answers),
      onAnswersChange: (answers) => void changes.push(answers),
    })
    const send = button(root, 'Send answer')
    expect(send.disabled).toBe(true)
    type(field(root), '  because  ')
    expect(send.disabled).toBe(false)
    expect(changes.at(-1)).toEqual({ why: { optionIds: [], text: '  because  ' } })
    send.click()
    await tick()
    expect(sent).toEqual([{ why: { optionIds: [], text: '  because  ' } }])
  })

  test('whitespace alone is not an answer', () => {
    const root = mount({ onSubmit: () => {} })
    type(field(root), '   ')
    expect(button(root, 'Send answer').disabled).toBe(true)
  })

  test('Ctrl+Enter sends from the text box, and a second one while sending is ignored', async () => {
    let calls = 0
    let release: (() => void) | undefined
    const root = mount({
      defaultAnswers: { why: { optionIds: [], text: 'ready' } },
      onSubmit: () => {
        calls += 1
        return new Promise<void>((resolve) => (release = resolve))
      },
    })
    ctrlEnter(field(root))
    ctrlEnter(field(root))
    expect(calls).toBe(1)
    release?.()
    await tick()
    ctrlEnter(field(root))
    expect(calls).toBe(2)
    release?.()
  })

  test('plain Enter stays a newline and sends nothing', () => {
    let calls = 0
    const root = mount({
      defaultAnswers: { why: { optionIds: [], text: 'ready' } },
      onSubmit: () => void (calls += 1),
    })
    const event = new dom.window.KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })
    field(root).dispatchEvent(event)
    expect(calls).toBe(0)
    expect(event.defaultPrevented).toBe(false)
  })

  test('a custom label and placeholder reach the box', () => {
    const root = mount({
      questions: [{ ...text, textLabel: 'In a sentence', textPlaceholder: 'Be brief' }],
      submitLabel: 'Reply',
    })
    expect(root.querySelector('label')?.textContent).toBe('In a sentence')
    expect(field(root).getAttribute('placeholder')).toBe('Be brief')
    expect(button(root, 'Reply')).toBeDefined()
  })

  test('says why it cannot send when the host gives no way to send', () => {
    const root = mount({ defaultAnswers: { why: { optionIds: [], text: 'x' } } })
    expect(root.querySelector('[role="status"]')?.textContent).toBe(
      'Sending answers is not available here.'
    )
    expect(button(root, 'Send answer').disabled).toBe(true)
  })

  test('a host reason locks the fields and is connected to the box and the button', () => {
    const root = mount({
      disabledReason: 'Reconnect to answer',
      onSubmit: () => {},
      defaultAnswers: { why: { optionIds: [], text: 'x' } },
    })
    const reason = root.querySelector('[role="status"]')!
    expect(reason.textContent).toBe('Reconnect to answer')
    expect(field(root).disabled).toBe(true)
    expect(field(root).getAttribute('aria-describedby')).toBe(reason.id)
    expect(root.querySelector('fieldset')?.disabled).toBe(true)
    const send = button(root, 'Send answer')
    expect(send.disabled).toBe(true)
    expect(send.getAttribute('aria-describedby')).toBe(reason.id)
  })

  test('a blank host reason does not lock the questionnaire', () => {
    const root = mount({ disabledReason: '   ', onSubmit: () => {} })
    expect(field(root).disabled).toBe(false)
  })

  test('submitting locks the form and shows the spinner on the button', () => {
    const root = mount({
      status: 'submitting',
      onSubmit: () => {},
      defaultAnswers: { why: { optionIds: [], text: 'x' } },
    })
    expect(field(root).disabled).toBe(true)
    const send = button(root, 'Send answer')
    expect(send.disabled).toBe(true)
    expect(send.querySelector('svg')).not.toBeNull()
  })

  test('a failed submit is announced as an alert', () => {
    const root = mount({ error: 'The agent went away', onSubmit: () => {} })
    expect(root.querySelector('[role="alert"]')?.textContent).toBe('The agent went away')
  })

  test('a controlled answer is shown as given and typing is only reported', () => {
    const changes: QuestionnaireAnswers[] = []
    const root = mount({
      answers: { why: { optionIds: [], text: 'fixed' } },
      onAnswersChange: (answers) => void changes.push(answers),
    })
    expect(field(root).value).toBe('fixed')
    type(field(root), 'other')
    expect(changes).toEqual([{ why: { optionIds: [], text: 'other' } }])
  })
})

describe('Questionnaire with options', () => {
  test('a single-choice question is a radio group that records one option', () => {
    const changes: QuestionnaireAnswers[] = []
    const root = mount({
      questions: [single],
      onAnswersChange: (answers) => void changes.push(answers),
      onSubmit: () => {},
    })
    expect(root.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe(
      'Which database?'
    )
    expect(root.querySelector('legend')?.textContent).toContain('The one the service will own.')
    expect(root.querySelector('textarea')).toBeNull()
    const radios = [...root.querySelectorAll('input[type="radio"]')] as HTMLInputElement[]
    expect(radios.length).toBe(2)
    expect(button(root, 'Send answer').disabled).toBe(true)
    radios[1]!.click()
    expect(changes.at(-1)).toEqual({ db: { optionIds: ['sqlite'], text: '' } })
    expect(button(root, 'Send answer').disabled).toBe(false)
    radios[0]!.click()
    expect(changes.at(-1)).toEqual({ db: { optionIds: ['pg'], text: '' } })
  })

  test('a multiple-choice question is a group of checkboxes, with an extra text answer', () => {
    const changes: QuestionnaireAnswers[] = []
    const root = mount({
      questions: [multiple],
      onAnswersChange: (answers) => void changes.push(answers),
    })
    expect(root.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
      'Which environments?'
    )
    expect(root.querySelector('label[for$="-text"]')?.textContent).toBe('Anything else?')
    const boxes = [...root.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[]
    boxes[0]!.click()
    boxes[1]!.click()
    expect(changes.at(-1)).toEqual({ env: { optionIds: ['dev', 'prod'], text: '' } })
    boxes[0]!.click()
    expect(changes.at(-1)).toEqual({ env: { optionIds: ['prod'], text: '' } })
    type(field(root), 'staging too')
    expect(changes.at(-1)).toEqual({ env: { optionIds: ['prod'], text: 'staging too' } })
  })

  test('a text answer beside single-choice options is labelled as the alternative', () => {
    const root = mount({ questions: [{ ...single, allowText: true }] })
    expect(root.querySelector('label[for$="-text"]')?.textContent).toBe('Something else')
  })

  test('a question marked optional can be sent unanswered', () => {
    const root = mount({ questions: [{ ...text, optional: true }], onSubmit: () => {} })
    expect(button(root, 'Send answer').disabled).toBe(false)
  })
})

describe('Questionnaire with several questions', () => {
  const questions = [text, single, multiple]

  test('asks one at a time, gates Next on an answer, and returns focus to the question', async () => {
    const root = mount({ questions, onSubmit: () => {} })
    expect(root.textContent).toContain('Question 1 of 3')
    expect(button(root, 'Back').disabled).toBe(true)
    expect(button(root, 'Next').disabled).toBe(true)
    type(field(root), 'because')
    button(root, 'Next').click()
    await tick()
    expect(root.textContent).toContain('Question 2 of 3')
    expect(root.querySelector('h4')?.textContent).toBe('Which database?')
    expect(dom.window.document.activeElement).toBe(root.querySelector('h4'))
    button(root, 'Back').click()
    await tick()
    expect(root.querySelector('h4')?.textContent).toBe('Why this approach?')
    expect(field(root).value).toBe('because')
  })

  test('sends every answer from the last question, and only then', async () => {
    const sent: QuestionnaireAnswers[] = []
    const root = mount({
      questions,
      onSubmit: (answers) => void sent.push(answers),
      defaultAnswers: {
        why: { optionIds: [], text: 'because' },
        db: { optionIds: ['pg'], text: '' },
      },
    })
    button(root, 'Next').click()
    await tick()
    button(root, 'Next').click()
    await tick()
    expect(button(root, 'Send answer').disabled).toBe(true)
    const box = root.querySelector('input[type="checkbox"]') as HTMLInputElement
    box.click()
    // Ctrl+Enter works from the last question only.
    ctrlEnter(field(root))
    await tick()
    expect(sent).toEqual([
      {
        why: { optionIds: [], text: 'because' },
        db: { optionIds: ['pg'], text: '' },
        env: { optionIds: ['dev'], text: '' },
      },
    ])
  })

  test('Ctrl+Enter before the last question does nothing', async () => {
    let calls = 0
    const root = mount({
      questions,
      onSubmit: () => void (calls += 1),
      defaultAnswers: {
        why: { optionIds: [], text: 'a' },
        db: { optionIds: ['pg'], text: '' },
        env: { optionIds: ['dev'], text: '' },
      },
    })
    ctrlEnter(field(root))
    await tick()
    expect(calls).toBe(0)
  })

  test('a locked questionnaire cannot move between questions', () => {
    const root = mount({ questions, status: 'submitting', onSubmit: () => {} })
    expect(button(root, 'Next').disabled).toBe(true)
    expect(button(root, 'Back').disabled).toBe(true)
  })

  test('the Next button points at the host reason when one exists', () => {
    const root = mount({ questions, disabledReason: 'Offline', onSubmit: () => {} })
    const reason = root.querySelector('[role="status"]')!
    expect(button(root, 'Next').getAttribute('aria-describedby')).toBe(reason.id)
  })
})

// Focus is inside, leaves through `focusout`, and the exchange then settles: does it land on the record?
const settleAfterFocusOut = async (relatedTo?: (root: HTMLElement) => Element) => {
  const [status, setStatus] = createSignal<QuestionnaireProps['status']>('open')
  const root = dom.mount(() => (
    <Questionnaire
      questions={[text]}
      status={status()}
      answers={{ why: { optionIds: [], text: 'x' } }}
      onSubmit={() => {}}
    />
  ))
  const section = root.querySelector('section')!
  const area = field(root)
  area.focus()
  area.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true }))
  expect(dom.window.document.activeElement).toBe(area)
  area.dispatchEvent(
    new dom.window.FocusEvent('focusout', {
      bubbles: true,
      relatedTarget: relatedTo?.(root) ?? null,
    })
  )
  setStatus('answered')
  await tick()
  expect(root.querySelector('textarea')).toBeNull()
  expect(section.getAttribute('data-status')).toBe('answered')
  return { section, active: dom.window.document.activeElement }
}

describe('Questionnaire once settled', () => {
  const answers: QuestionnaireAnswers = {
    db: { optionIds: ['pg'], text: 'with extensions' },
    why: { optionIds: [], text: '' },
  }

  test('answered shows the exchange read-only, with skipped questions named', () => {
    const root = mount({ questions: [single, text], status: 'answered', answers })
    expect(root.querySelector('[data-status="answered"]')).not.toBeNull()
    expect(root.querySelector('header')?.textContent).toContain('Answered')
    expect(root.querySelector('textarea')).toBeNull()
    expect(root.querySelector('footer')).toBeNull()
    const terms = [...root.querySelectorAll('dt')].map((node) => node.textContent)
    expect(terms).toEqual(['Which database?', 'Why this approach?'])
    const values = [...root.querySelectorAll('dd')].map((node) => node.textContent)
    expect(values).toEqual(['Postgres, with extensions', 'Skipped'])
  })

  test('expired says it is no longer waiting', () => {
    const root = mount({ questions: [single], status: 'expired', answers: {} })
    expect(root.querySelector('header')?.textContent).toContain('No longer waiting')
    expect(root.querySelector('dd')?.textContent).toBe('Skipped')
  })

  test('question ids that name inherited properties are not read as answers', () => {
    const root = mount({
      questions: [{ id: 'constructor', prompt: 'Odd id?' }],
      status: 'answered',
      answers: {},
    })
    expect(root.querySelector('dd')?.textContent).toBe('Skipped')
  })

  test('focus inside the form moves to the record when it settles', async () => {
    const [status, setStatus] = createSignal<QuestionnaireProps['status']>('open')
    const root = dom.mount(() => (
      <Questionnaire
        questions={[text]}
        status={status()}
        answers={{ why: { optionIds: [], text: 'x' } }}
        onSubmit={() => {}}
      />
    ))
    const area = field(root)
    area.focus()
    area.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true }))
    setStatus('submitting')
    await tick()
    setStatus('answered')
    await tick()
    expect(dom.window.document.activeElement).toBe(root.querySelector('section'))
  })

  test('focus that was elsewhere is left alone when it settles', async () => {
    const [status, setStatus] = createSignal<QuestionnaireProps['status']>('open')
    const root = dom.mount(() => (
      <Questionnaire
        questions={[text]}
        status={status()}
        answers={{ why: { optionIds: [], text: 'x' } }}
        onSubmit={() => {}}
      />
    ))
    const area = field(root)
    area.focus()
    area.dispatchEvent(new dom.window.FocusEvent('focusin', { bubbles: true }))
    const outside = dom.window.document.createElement('button')
    dom.window.document.body.appendChild(outside)
    outside.focus()
    area.dispatchEvent(
      new dom.window.FocusEvent('focusout', { bubbles: true, relatedTarget: outside })
    )
    ;(dom.window.document.activeElement as HTMLElement).blur()
    setStatus('answered')
    await tick()
    expect(dom.window.document.activeElement).not.toBe(root.querySelector('section'))
  })

  test('focus that leaves for nowhere, as when its control is removed, still lands on the record', async () => {
    const { section, active } = await settleAfterFocusOut()
    expect(active).toBe(section)
  })

  test('focus that moves to the questionnaire’s own Send button still lands on the record', async () => {
    const { section, active } = await settleAfterFocusOut((root) => button(root, 'Send answer'))
    expect(active).toBe(section)
  })
})
