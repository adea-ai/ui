import { render } from 'solid-js/web'
import { MessageBody } from '../../src/components/conversation/message-row'
import '../../src/styles/globals.css'

const fenced = [
  'Before the fence.',
  '```ts',
  'const answer = 42',
  '```',
  '',
  'After the fence.',
  '',
  'A second paragraph.',
].join('\n')

render(
  () => (
    <main class="w-96 p-4">
      <MessageBody id="fenced" text={fenced} />
    </main>
  ),
  document.body
)
