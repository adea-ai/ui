import { expect, test } from 'bun:test'
import { paneDropIntent } from '../src/components/layout/split-layout/drop'
const rect = { left: 100, top: 50, width: 200, height: 100 }
test('accepted Adea closest-edge placement retains reading-order ties', () => {
  expect(paneDropIntent(101, 100, rect)).toEqual({ direction: 'row', placement: 'before' })
  expect(paneDropIntent(299, 100, rect)).toEqual({ direction: 'row', placement: 'after' })
  expect(paneDropIntent(200, 51, rect)).toEqual({ direction: 'column', placement: 'before' })
  expect(paneDropIntent(200, 149, rect)).toEqual({ direction: 'column', placement: 'after' })
  expect(paneDropIntent(100, 50, rect)).toEqual({ direction: 'row', placement: 'before' })
})
test('unusable or outside pane geometry does not invent a drop', () => {
  for (const [x, y, box] of [
    [99, 100, rect],
    [200, 151, rect],
    [Number.NaN, 100, rect],
    [100, 50, { ...rect, width: 0 }],
    [100, 50, { ...rect, height: Infinity }],
  ] as const)
    expect(paneDropIntent(x, y, box)).toBeUndefined()
})
