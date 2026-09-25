import { describe, expect, test } from 'bun:test'
import { createRoot, createSignal } from 'solid-js'
import { keyedRows } from './keyed-rows'

type Task = Readonly<{ id: string; title: string; version: number }>

const task = (id: string, title: string, version = 1): Task => ({ id, title, version })

describe('keyedRows', () => {
  test('keeps each row object identical across refetches', () => {
    createRoot((dispose) => {
      const [list, setList] = createSignal<readonly Task[]>([task('a', 'First')])
      const rows = keyedRows(list, (item) => item.id)

      const first = rows()[0]!

      // A refetch: the server sends a fresh object with the same id.
      setList([task('a', 'First')])

      const second = rows()[0]!
      expect(second).toBe(first)
      dispose()
    })
  })

  test('pushes a changed item through the row accessor', () => {
    createRoot((dispose) => {
      const [list, setList] = createSignal<readonly Task[]>([task('a', 'First')])
      const rows = keyedRows(list, (item) => item.id)
      const row = rows()[0]!

      setList([task('a', 'Renamed')])

      expect(row.item().title).toBe('Renamed')
      dispose()
    })
  })

  test('drops removed keys and appends new ones', () => {
    createRoot((dispose) => {
      const [list, setList] = createSignal<readonly Task[]>([
        task('a', 'First'),
        task('b', 'Second'),
      ])
      const rows = keyedRows(list, (item) => item.id)
      const firstRow = rows()[0]!

      setList([task('a', 'First'), task('c', 'Third')])

      expect(rows().map((row) => row.item().id)).toEqual(['a', 'c'])
      // The surviving key kept its row; the new one got a fresh row.
      expect(rows()[0]).toBe(firstRow)
      dispose()
    })
  })

  test('keeps rows when the list reorders', () => {
    createRoot((dispose) => {
      const [list, setList] = createSignal<readonly Task[]>([
        task('a', 'First'),
        task('b', 'Second'),
      ])
      const rows = keyedRows(list, (item) => item.id)
      const [rowA, rowB] = [rows()[0]!, rows()[1]!]

      setList([task('b', 'Second'), task('a', 'First')])

      expect(rows()[0]).toBe(rowB)
      expect(rows()[1]).toBe(rowA)
      dispose()
    })
  })

  test('a duplicate key reuses the first entry row', () => {
    createRoot((dispose) => {
      const [list] = createSignal<readonly Task[]>([task('a', 'First'), task('a', 'Dupe')])
      const rows = keyedRows(list, (item) => item.id)

      expect(rows()[0]).toBe(rows()[1])
      expect(rows()[0]!.item().title).toBe('First')
      dispose()
    })
  })

  test('the default equality treats every new object as a change', () => {
    createRoot((dispose) => {
      const [list, setList] = createSignal<readonly Task[]>([task('a', 'First', 1)])
      const rows = keyedRows(list, (item) => item.id)
      const row = rows()[0]!

      // Same version, different object identity: still a change, because the
      // default renders every field.
      setList([task('a', 'First', 1)])

      expect(row.item().version).toBe(1)
      dispose()
    })
  })

  test('a field-level comparator skips redundant updates', () => {
    createRoot((dispose) => {
      const [list, setList] = createSignal<readonly Task[]>([task('a', 'First', 7)])
      const rows = keyedRows(
        list,
        (item) => item.id,
        (previous, next) => previous.version === next.version
      )
      const row = rows()[0]!
      const before = row.item()

      // Same version: the stored value is not replaced at all.
      setList([task('a', 'Rewritten but same version', 7)])
      expect(row.item()).toBe(before)

      // A new version does replace it.
      setList([task('a', 'Rewritten', 8)])
      expect(row.item().title).toBe('Rewritten')
      dispose()
    })
  })

  test('an empty list yields no rows', () => {
    createRoot((dispose) => {
      const [list] = createSignal<readonly Task[]>([])
      expect(keyedRows(list, (item) => item.id)()).toEqual([])
      dispose()
    })
  })
})
