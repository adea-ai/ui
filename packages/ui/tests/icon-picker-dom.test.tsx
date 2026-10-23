import { createSignal } from 'solid-js'
import { afterEach, describe, expect, test } from 'bun:test'

import {
  IconPicker,
  IconPickerDropdown,
} from '../src/components/composites/icon-picker/icon-picker'
import { markImageProblemCopy } from '../src/components/composites/icon-picker/image-data-url'
import { shellIconEntries } from '../src/components/composites/icon-picker/shell-icons'
import { useDom } from './helpers/dom'
import { preserveGlobals } from './helpers/globals'

const dom = useDom()
const doc = () => dom.window.document
const tick = (ms = 30) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const radios = () => [...doc().querySelectorAll('input[type="radio"]')] as HTMLInputElement[]
const buttonNamed = (text: string) =>
  [...doc().querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as
    | HTMLButtonElement
    | undefined

const restoreGlobals = preserveGlobals('createImageBitmap')
afterEach(restoreGlobals)

/** Pick a file the way the browser does: set the input's files, then dispatch `change`. */
function pickFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  input.dispatchEvent(new dom.window.Event('change', { bubbles: true }))
}

describe('IconPicker', () => {
  test('offers every curated icon as a radio inside a labelled group', () => {
    dom.mount(() => <IconPicker label="Workspace icon" value="box" onValueChange={() => {}} />)
    const group = doc().querySelector('[role="radiogroup"]')!
    expect(group.getAttribute('aria-label')).toBe('Workspace icon')
    expect(radios().length).toBe(shellIconEntries.length)
    const checked = radios().filter((radio) => radio.checked)
    expect(checked.length).toBe(1)
    expect(checked[0]?.value).toBe('box')
  })

  test('choosing an icon reports its key', () => {
    const chosen: string[] = []
    dom.mount(() => (
      <IconPicker label="Icon" value="box" onValueChange={(key) => chosen.push(key)} />
    ))
    const folder = radios().find((radio) => radio.value === 'folder')!
    folder.click()
    expect(chosen).toEqual(['folder'])
  })

  test('marks the default icon in its title and for assistive tech', () => {
    dom.mount(() => (
      <IconPicker label="Icon" value="box" defaultKey="folder" onValueChange={() => {}} />
    ))
    const label = [...doc().querySelectorAll('label')].find((candidate) =>
      candidate.textContent?.includes('(default)')
    )!
    expect(label.textContent).toContain('Folder (default)')
    expect(label.getAttribute('title')).toBe('Folder (default)')
  })

  test('a disabled picker cannot be changed', () => {
    const chosen: string[] = []
    dom.mount(() => (
      <IconPicker label="Icon" value="box" disabled onValueChange={(key) => chosen.push(key)} />
    ))
    expect(radios().every((radio) => radio.disabled)).toBe(true)
    radios()[3]?.click()
    expect(chosen).toEqual([])
  })

  test('without an image handler there is no upload section', () => {
    dom.mount(() => <IconPicker label="Icon" value="box" onValueChange={() => {}} />)
    expect(doc().querySelector('[data-slot="icon-picker-upload"]')).toBeNull()
  })

  test('with an uploaded image no icon is selected, and the upload says Replace and offers Remove', () => {
    const images: Array<string | undefined> = []
    dom.mount(() => (
      <IconPicker
        label="Icon"
        value="box"
        image="data:image/png;base64,AAAA"
        onValueChange={() => {}}
        onImageChange={(image) => images.push(image)}
      />
    ))
    expect(radios().some((radio) => radio.checked)).toBe(false)
    expect(doc().querySelector('input[type="file"]')?.getAttribute('aria-label')).toBe(
      'Replace image'
    )
    expect(doc().querySelector('[data-slot="icon-picker-upload"] img')?.getAttribute('src')).toBe(
      'data:image/png;base64,AAAA'
    )
    buttonNamed('Remove image')!.click()
    expect(images).toEqual([undefined])
  })

  test('without an image the upload invites one and has no Remove', () => {
    dom.mount(() => (
      <IconPicker label="Icon" value="box" onValueChange={() => {}} onImageChange={() => {}} />
    ))
    expect(doc().querySelector('input[type="file"]')?.getAttribute('aria-label')).toBe(
      'Upload image'
    )
    expect(buttonNamed('Remove image')).toBeUndefined()
    expect(doc().body.textContent).toContain('up to 8 MB')
  })

  test('the Upload button opens the file chooser', () => {
    dom.mount(() => (
      <IconPicker label="Icon" value="box" onValueChange={() => {}} onImageChange={() => {}} />
    ))
    const input = doc().querySelector('input[type="file"]') as HTMLInputElement
    let opened = 0
    input.click = () => void (opened += 1)
    buttonNamed('Upload image')!.click()
    expect(opened).toBe(1)
  })

  test('a file that is not an image is refused with a reason and nothing is stored', async () => {
    const images: Array<string | undefined> = []
    dom.mount(() => (
      <IconPicker
        label="Icon"
        value="box"
        onValueChange={() => {}}
        onImageChange={(image) => images.push(image)}
      />
    ))
    pickFile(
      doc().querySelector('input[type="file"]') as HTMLInputElement,
      new dom.window.File(['text'], 'notes.txt', { type: 'text/plain' })
    )
    await tick()
    expect(doc().querySelector('[role="alert"]')?.textContent).toBe(markImageProblemCopy.type)
    expect(images).toEqual([])
  })

  test('an unreadable image is reported as unreadable', async () => {
    ;(globalThis as { createImageBitmap?: unknown }).createImageBitmap = () =>
      Promise.reject(new Error('corrupt'))
    dom.mount(() => (
      <IconPicker label="Icon" value="box" onValueChange={() => {}} onImageChange={() => {}} />
    ))
    pickFile(
      doc().querySelector('input[type="file"]') as HTMLInputElement,
      new dom.window.File(['x'], 'bad.png', { type: 'image/png' })
    )
    await tick()
    expect(doc().querySelector('[role="alert"]')?.textContent).toBe(markImageProblemCopy.unreadable)
  })

  test('a readable image is cropped and stored, and a later Remove clears the old problem', async () => {
    const images: Array<string | undefined> = []
    let closed = 0
    ;(globalThis as { createImageBitmap?: unknown }).createImageBitmap = () =>
      Promise.resolve({ width: 300, height: 200, close: () => void (closed += 1) })
    const canvas = dom.window.HTMLCanvasElement.prototype
    const getContext = canvas.getContext
    const toDataURL = canvas.toDataURL
    canvas.getContext = (() => ({ drawImage: () => {} })) as never
    canvas.toDataURL = ((type: string) => `data:${type};base64,QUJD`) as never
    try {
      const [image, setImage] = createSignal<string | undefined>()
      dom.mount(() => (
        <IconPicker
          label="Icon"
          value="box"
          image={image()}
          onValueChange={() => {}}
          onImageChange={(next) => {
            images.push(next)
            setImage(next)
          }}
        />
      ))
      pickFile(
        doc().querySelector('input[type="file"]') as HTMLInputElement,
        new dom.window.File(['x'], 'ok.png', { type: 'image/png' })
      )
      await tick(60)
      expect(images).toEqual(['data:image/webp;base64,QUJD'])
      expect(closed).toBe(1)
      expect(doc().querySelector('[role="alert"]')).toBeNull()
      buttonNamed('Remove image')!.click()
      expect(images.at(-1)).toBeUndefined()
    } finally {
      canvas.getContext = getContext
      canvas.toDataURL = toDataURL
    }
  })
})

describe('IconPickerDropdown', () => {
  test('shows the current icon in a trigger that names the choice', () => {
    dom.mount(() => <IconPickerDropdown label="Icon" value="folder" onValueChange={() => {}} />)
    const trigger = doc().querySelector('[data-slot="icon-picker-trigger"]')!
    expect(trigger.getAttribute('aria-label')).toBe('Icon: Folder')
    expect(trigger.querySelector('svg')).not.toBeNull()
  })

  test('falls back to the default icon, and says an uploaded image is in use', () => {
    const [image, setImage] = createSignal<string | undefined>()
    dom.mount(() => (
      <IconPickerDropdown
        label="Icon"
        value={undefined}
        defaultKey="box"
        image={image()}
        onValueChange={() => {}}
      />
    ))
    const trigger = doc().querySelector('[data-slot="icon-picker-trigger"]')!
    expect(trigger.getAttribute('aria-label')).toBe('Icon: Box')
    setImage('data:image/png;base64,AAAA')
    expect(trigger.getAttribute('aria-label')).toBe('Icon: uploaded image')
    expect(trigger.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,AAAA')
  })

  test('a custom trigger glyph replaces the icon', () => {
    dom.mount(() => (
      <IconPickerDropdown
        label="Icon"
        value="box"
        trigger={<i data-testid="custom" />}
        onValueChange={() => {}}
      />
    ))
    expect(
      doc().querySelector('[data-slot="icon-picker-trigger"] [data-testid="custom"]')
    ).not.toBeNull()
  })

  test('opens the picker, and choosing an icon reports it and closes the popover', async () => {
    const chosen: string[] = []
    dom.mount(() => (
      <IconPickerDropdown label="Icon" value="box" onValueChange={(key) => chosen.push(key)} />
    ))
    const trigger = doc().querySelector('[data-slot="icon-picker-trigger"]') as HTMLButtonElement
    expect(radios().length).toBe(0)
    trigger.click()
    await tick()
    expect(radios().length).toBe(shellIconEntries.length)
    radios()
      .find((radio) => radio.value === 'anchor')!
      .click()
    await tick(60)
    expect(chosen).toEqual(['anchor'])
    expect(radios().length).toBe(0)
  })

  test('a disabled dropdown cannot open', () => {
    dom.mount(() => (
      <IconPickerDropdown label="Icon" value="box" disabled onValueChange={() => {}} />
    ))
    const trigger = doc().querySelector('[data-slot="icon-picker-trigger"]') as HTMLButtonElement
    expect(trigger.disabled).toBe(true)
  })
})
