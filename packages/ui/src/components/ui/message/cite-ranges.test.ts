import { describe, expect, test } from 'bun:test'
import { placeCitationMarkers } from './cite-ranges'

const at = (text: string, needle: string) => text.indexOf(needle) + needle.length

describe('placeCitationMarkers', () => {
  test('puts a marker after the cited span and nowhere else', () => {
    const text = 'Rust has no GC. It is fast.'
    const out = placeCitationMarkers(text, [{ end: at(text, 'no GC.'), numbers: [1] }], 2)
    expect(out).toMatchObject({ text: 'Rust has no GC.[^1] It is fast.', placed: 1, skipped: 0 })
  })

  test('spans ending together share one marker, in source order, without repeats', () => {
    const text = 'Claim.'
    const out = placeCitationMarkers(
      text,
      [
        { end: 6, numbers: [2] },
        { end: 6, numbers: [1, 2] },
      ],
      3
    )
    expect(out.text).toBe('Claim.[^1,2]')
  })

  test('more than six sources at one place chain markers', () => {
    const out = placeCitationMarkers('x.', [{ end: 2, numbers: [1, 2, 3, 4, 5, 6, 7] }], 7)
    expect(out.text).toBe('x.[^1,2,3,4,5,6][^7]')
  })

  test('numbers outside the source list and bad positions are ignored, not guessed', () => {
    const out = placeCitationMarkers(
      'abc',
      [
        { end: 3, numbers: [9] },
        { end: 99, numbers: [1] },
        { end: 0, numbers: [1] },
        { end: 1.5, numbers: [1] },
      ],
      2
    )
    expect(out).toMatchObject({ text: 'abc', placed: 0, skipped: 0 })
  })

  test('a position inside a fenced block or an inline code span gets no marker', () => {
    const text = 'Use `npm i` now.\n\n```ts\nconst a = 1\n```\n\nDone.'
    const out = placeCitationMarkers(
      text,
      [
        { end: at(text, 'npm i'), numbers: [1] },
        { end: at(text, 'const a = 1'), numbers: [1] },
        { end: at(text, 'now.'), numbers: [2] },
        { end: at(text, 'Done.'), numbers: [1] },
      ],
      2
    )
    expect(out.text).toBe('Use `npm i` now.[^2]\n\n```ts\nconst a = 1\n```\n\nDone.[^1]')
    expect(out).toMatchObject({ placed: 2, skipped: 2 })
    // `ends` names exactly the positions that got a marker, so a host can count its own spans.
    expect(out.ends).toEqual([at(text, 'now.'), at(text, 'Done.')])
  })

  test('a position that would change how the prose reads is dropped', () => {
    // Between the two stars that close a bold span, a marker would break the span.
    const text = 'a **bold** c'
    const out = placeCitationMarkers(text, [{ end: at(text, '**bold*'), numbers: [1] }], 1)
    expect(out.text).toBe(text)
    expect(out.skipped).toBe(1)
  })

  test('footnote marks the text already has mean no markers at all', () => {
    const text = 'Typed by a model[^1] and cited.'
    const out = placeCitationMarkers(text, [{ end: text.length, numbers: [1] }], 1)
    expect(out).toEqual({ text, placed: 0, ends: [], skipped: 1, collision: true })
  })

  test('no citations is the text untouched', () => {
    expect(placeCitationMarkers('plain', [], 3)).toEqual({
      text: 'plain',
      placed: 0,
      ends: [],
      skipped: 0,
      collision: false,
    })
  })

  test('a thousand citations on a long text stay fast', () => {
    const text = Array.from({ length: 1000 }, (_, index) => `Sentence ${index}.`).join(' ')
    const citations = Array.from({ length: 128 }, (_, index) => ({
      end: at(text, `Sentence ${index * 7}.`),
      numbers: [1],
    }))
    const started = performance.now()
    const out = placeCitationMarkers(text, citations, 1)
    expect(performance.now() - started).toBeLessThan(250)
    expect(out.placed).toBe(128)
  })
})
