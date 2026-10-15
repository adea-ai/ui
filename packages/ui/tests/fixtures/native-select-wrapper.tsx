import { render } from 'solid-js/web'
import { NativeSelect } from '../../src/components/ui/native-select'
import '../../src/styles/globals.css'

const options = [
  { value: 'all', label: 'All relationships' },
  { value: 'long', label: 'A relationship kind with a very long descriptive name' },
]

function NativeSelectWrapperFixture() {
  return (
    <main class="flex w-96 flex-col gap-6 p-4">
      <div class="flex flex-col items-start" data-case="default">
        <NativeSelect aria-label="Default" options={options.slice(0, 1)} />
      </div>
      <div class="flex flex-col" data-case="fixed">
        <NativeSelect aria-label="Fixed" wrapperClass="w-64" options={options} />
      </div>
      <div class="flex gap-2" data-case="toolbar">
        <NativeSelect size="sm" aria-label="Grows" wrapperClass="flex-1" options={options} />
        <NativeSelect size="sm" aria-label="Capped" wrapperClass="max-w-32" options={options} />
      </div>
    </main>
  )
}

const root = document.getElementById('app')
if (root) render(() => <NativeSelectWrapperFixture />, root)
