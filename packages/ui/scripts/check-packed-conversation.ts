/** Actual tarball pilot for the pending shared conversation composition. */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { chromium, webkit, expect } from '@playwright/test'
import tailwindcss from '@tailwindcss/vite'
import { build, type EnvironmentOptions } from 'vite'
import solid from 'vite-plugin-solid'
import {
  assertAtomicIncrementBudget,
  assertComposedGzipBudget,
  MAX_ATOMIC_INCREMENT_GZIP_BYTES,
} from './conversation-packed-budget'
import { sharedPackedUiArchive } from './packed-artifact.mjs'
import { waitForFiniteAnimations } from './finite-animations'

const root = resolve(import.meta.dir, '..')
const consumer = mkdtempSync(join(tmpdir(), 'adea-ui-packed-conversation-'))
console.log(`Owned pilot runner PID: ${process.pid}`)
const packedComposerFieldsFixture = readFileSync(
  join(root, 'tests/fixtures/message-composer.tsx'),
  'utf8'
)
  .replace(
    '../../src/components/conversation/message-composer',
    '@adea-ai/ui/components/conversation'
  )
  .replace('../../src/components/ui/button/button', '@adea-ai/ui/components/ui/button')
  .replace('../../src/styles/globals.css', './style.css')
if (packedComposerFieldsFixture === '') throw new Error('Composer field fixture is empty')
if (
  packedComposerFieldsFixture.includes('../../src/') ||
  !packedComposerFieldsFixture.includes("'@adea-ai/ui/components/conversation'") ||
  !packedComposerFieldsFixture.includes("'@adea-ai/ui/components/ui/button'")
)
  throw new Error(
    'Packed composer fixture retained a source alias or missed a package import rewrite'
  )
// First packed baseline: 23,880/23,936 gzip JS bytes and 40,203 raw CSS bytes.
// Small fixture-specific headroom; module exclusions remain independent gates.
// Re-baselined 26 → 33 KiB (2026-09) for the `cn` swap: measured 32,238 gzip —
// the config-extended merge runtime ships cn's compiler and default tables.
// Re-baselined 33 → 50 KiB (2026-10) for the composer's ActionButton send
// control: the shared Tooltip pulls the Kobalte popper and FloatingUI stack
// into the conversation pilots (measured 49,214 locally, 50,055 in CI).
const MAX_GZIP_BYTES = 50 * 1024
// Re-baselined 42 → 43 KiB (2026-10) for the shared scene controls'
// coarse-pointer touch rung: atomic measured 43,355 against main's 42,717
// (+638 bytes of base CSS — the same delta that re-baselined the packed
// consumer's list-row cap from 32 to 34 KiB).
const MAX_CSS_BYTES = 43 * 1024
// Busy menu baseline: 50,308/50,470 gzip JS bytes; CSS shares the 43 KiB cap.
// Re-baselined 50 → 60 KiB (2026-09) for the `cn` swap; measured 58,651 gzip.
const MAX_BUSY_GZIP_BYTES = 60 * 1024
const results: unknown[] = []
const sizeMeasurements = new Map<
  string,
  {
    js: number
    gzip: number
    css: number
    editorBytes: number
    tooltipBytes: number
    kobalteModules: { id: string; bytes: number }[]
  }
>()
const fixture = `
import { render } from 'solid-js/web';
import { createSignal, For, Show } from 'solid-js';
import { ConversationSurface, MessageComposer } from '@adea-ai/ui/components/conversation';
import './style.css';
function Pilot() {
  const [draft, setDraft] = createSignal('');
  const [tail, setTail] = createSignal('Streaming response');
  const [sends, setSends] = createSignal(0);
  const [fail, setFail] = createSignal(true);
  const [mounted, setMounted] = createSignal(true);
  const [channel, setChannel] = createSignal('Product');
  const channelPositions = new Map();
  let readingPosition;
  return <main class="flex h-96 flex-col gap-2 p-4">
    <h1>Shared conversation pilot</h1>
    <Show when={mounted()}><ConversationSurface role="log" aria-label="Transcript"
      initialReadingPosition={readingPosition} onReadingPositionChange={position=>{readingPosition=position}}>
      <For each={Array.from({length: 30}, (_, i) => i)}>{i => <p>Retained event {i}: readable earlier content in the transcript.</p>}</For>
      <p data-tail>{tail()}</p>
    </ConversationSurface></Show>
    <section class="flex h-96 flex-col">
      <button type="button" onClick={() => setChannel(channel() === 'Product' ? 'Research Agent' : 'Product')}>Switch channel</button>
      <ConversationSurface role="region" aria-label="Cached channel transcript"
        resetKey={channel()} initialReadingPosition={channelPositions.get(channel())}
        onReadingPositionChange={position => channelPositions.set(channel(), position)}>
        <For each={Array.from({length: channel() === 'Product' ? 60 : 3}, (_, i) => i)}>{i => <p data-channel-row={i}>{channel()} event {i + 1}</p>}</For>
      </ConversationSurface>
    </section>
    <MessageComposer value={draft()} onValueChange={setDraft} onSubmit={() => {
      if (fail()) throw new Error('Disposable transport refusal');
      setSends(sends() + 1); setDraft('');
    }} />
    <button type="button" onClick={() => setFail(false)}>Recover transport</button>
    <button type="button" onClick={() => setTail(tail() + ' streamed text'.repeat(100))}>Grow response</button>
    <button type="button" onClick={() => setMounted(!mounted())}>Toggle transcript</button>
    <output aria-label="Delivered count">{sends()}</output>
  </main>;
}
render(Pilot, document.getElementById('app')!);
`
const busyFixture = `
import { render } from 'solid-js/web';
import { createSignal } from 'solid-js';
import { BusySendButton } from '@adea-ai/ui/components/conversation';
import './style.css';
function Pilot() {
  const [mode, setMode] = createSignal('steer');
  const [disabled, setDisabled] = createSignal(true);
  const [blocked, setBlocked] = createSignal(false);
  const [fired, setFired] = createSignal('none');
  return <main class="p-4">
    <h1>Shared busy action pilot</h1>
    <BusySendButton mode={mode()} onModeChange={setMode} disabled={disabled()}
      unavailable={blocked() ? {queue: 'Queue operation unavailable'} : {}}
      onFire={() => setFired(mode())} />
    <div class="mt-64 flex gap-2">
      <button type="button" onClick={() => setDisabled(false)}>Enable send</button>
      <button type="button" onClick={() => setBlocked(true)}>Block queue</button>
      <button type="button" onClick={() => setMode('steer')}>Restore steer</button>
    </div>
    <output aria-label="Fired action">{fired()}</output>
  </main>;
}
render(Pilot, document.getElementById('app')!);
`
const composedFixture = `
import { render } from 'solid-js/web';
import { createSignal } from 'solid-js';
import { ChatComposer } from '@adea-ai/ui/components/conversation';
import './style.css';
function Pilot() {
 const [draft,setDraft]=createSignal('');
 const [collapsed,setCollapsed]=createSignal(false);
 const [fail,setFail]=createSignal(true);
 const [sent,setSent]=createSignal(0);
 const [busy,setBusy]=createSignal(false);
 const [mode,setMode]=createSignal('steer');
 const [last,setLast]=createSignal('none');
 const [references,setReferences]=createSignal(false);
 const [delayed,setDelayed]=createSignal(false);
 let finish;
 const submit=input=>{setLast(input.action);if(delayed()) return new Promise(resolve=>{finish=resolve});if(fail()) throw new Error('Refusal');setSent(sent()+1);setDraft('')};
 return <main class="p-4">
  <h1>Composed input pilot</h1>
  <ChatComposer value={draft()} onValueChange={setDraft}
   sendableActions={references()?{send:true,queue:true,steer:false}:undefined}
   collapse={{value:collapsed(),onChange:setCollapsed}}
   busy={busy()?{mode:mode(),onModeChange:setMode}:undefined}
   context={<button type="button">Model context</button>} onSubmit={submit}/>
  <div class="mt-64 flex gap-2">
   <button type="button" onClick={()=>setFail(false)}>Recover delivery</button>
   <button type="button" onClick={()=>setBusy(true)}>Run busy</button>
   <button type="button" onClick={()=>setReferences(true)}>Stage references</button>
   <button type="button" onClick={()=>{setBusy(false);setDelayed(true)}}>Delay delivery</button>
   <button type="button" onClick={()=>finish?.()}>Finish delivery</button>
  </div>
  <output aria-label="Submitted action">{last()}</output>
  <output aria-label="Sent">{sent()}</output>
 </main>;
}
render(Pilot, document.getElementById('app')!);
`
const atomicFixture = `
import { render } from 'solid-js/web';
import { createSignal } from 'solid-js';
import { AtomicChatComposer } from '@adea-ai/ui/components/conversation/atomic';
import './style.css';
function Pilot() {
 const [draft,setDraft]=createSignal('');
 const [blocks,setBlocks]=createSignal([]);
 const [transactions,setTransactions]=createSignal(0);
 const [collapsed,setCollapsed]=createSignal(false);
 const [fail,setFail]=createSignal(true);
 const [sent,setSent]=createSignal(0);
 const [busy,setBusy]=createSignal(false);
 const [mode,setMode]=createSignal('steer');
 const [last,setLast]=createSignal('none');
 const [submittedBlocks,setSubmittedBlocks]=createSignal('[]');
 const [references,setReferences]=createSignal(false);
 const [delayed,setDelayed]=createSignal(false);
 let blockId=0;
 let finish;
 const submit=async input=>{setLast(input.action);setSubmittedBlocks(JSON.stringify(input.blocks));if(delayed()) await new Promise(resolve=>{finish=resolve});if(fail()) throw new Error('Refusal');setSent(sent()+1);setDraft('');setBlocks([])};
 return <main class="p-4">
  <h1>Atomic composed input pilot</h1>
  <AtomicChatComposer value={draft()} pasteTokens={{blocks:blocks(),createBlockId:()=>\`packed-\${++blockId}\`,
   onChange:next=>{setDraft(next.text);setBlocks(next.blocks);setTransactions(transactions()+1)}}}
   sendableActions={references()?{send:true,queue:true,steer:false}:undefined}
   collapse={{value:collapsed(),onChange:setCollapsed}}
   busy={busy()?{mode:mode(),onModeChange:setMode}:undefined}
   context={<button type="button">Model context</button>} onSubmit={submit}/>
  <div class="mt-64 flex gap-2">
   <button type="button" onClick={()=>setFail(false)}>Recover delivery</button>
   <button type="button" onClick={()=>setBusy(true)}>Run busy</button>
   <button type="button" onClick={()=>setReferences(true)}>Stage references</button>
   <button type="button" onClick={()=>{setBusy(false);setDelayed(true)}}>Delay delivery</button>
   <button type="button" onClick={()=>finish?.()}>Finish delivery</button>
  </div>
  <output aria-label="Submitted action">{last()}</output>
  <output aria-label="Submitted blocks">{submittedBlocks()}</output>
  <output aria-label="Token transactions">{transactions()}</output>
  <output aria-label="Token blocks">{blocks().length}</output>
  <output aria-label="Sent">{sent()}</output>
 </main>;
}
render(Pilot, document.getElementById('app')!);
`
try {
  const sharedArchive = sharedPackedUiArchive()
  let archivePath = sharedArchive
  if (!archivePath) {
    const [archive] = JSON.parse(
      execFileSync('npm', ['pack', '--json', '--pack-destination', consumer], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60_000,
      })
    )
    archivePath = join(consumer, archive.filename)
  }
  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      dependencies: {
        '@adea-ai/ui': `file:${archivePath}`,
        'solid-js': manifest.peerDependencies['solid-js'],
        tailwindcss: '^4.3.3',
      },
    })
  )
  execFileSync('bun', ['install', '--ignore-scripts', '--omit=optional'], {
    cwd: consumer,
    stdio: 'pipe',
    timeout: 120_000,
  })
  const packedUi = join(consumer, 'node_modules/@adea-ai/ui')
  const publicComposerDeclarations = readFileSync(
    join(packedUi, 'dist/components/conversation/index.d.ts'),
    'utf8'
  )
  const atomicComposerDeclarations = readFileSync(
    join(packedUi, 'dist/components/conversation/atomic/index.d.ts'),
    'utf8'
  )
  if (
    /ChatComposerShell|ChatComposerInputRenderProps/.test(
      publicComposerDeclarations + atomicComposerDeclarations
    )
  )
    throw new Error('Packed public composer declarations exposed the private input-render seam')
  const typedConsumer = join(consumer, 'message-composer-consumer.tsx')
  writeFileSync(
    typedConsumer,
    `import type { ComponentProps } from 'solid-js'
import { MessageComposer } from '@adea-ai/ui/components/conversation'

let textarea: HTMLTextAreaElement | undefined
const props: ComponentProps<typeof MessageComposer> = {
  value: 'Draft',
  onValueChange: () => undefined,
  onSubmit: async () => undefined,
  inputRef: (element) => { textarea = element },
  inputId: 'message-draft',
  inputLabel: 'Message',
  inputDescription: 'Messages support Markdown.',
  inputDescribedBy: 'host-instructions',
  inputSize: 'comfortable',
  inputResize: 'vertical',
  submitLabel: 'Reply',
}

export function PackedMessageComposerConsumer() {
  return <MessageComposer {...props} />
}

void textarea
`
  )
  writeFileSync(
    join(consumer, 'message-composer-tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        strict: true,
        jsx: 'preserve',
        jsxImportSource: 'solid-js',
        noEmit: true,
        skipLibCheck: true,
        lib: ['ES2022', 'DOM'],
      },
      include: [typedConsumer],
    })
  )
  execFileSync(resolve(root, '../../node_modules/.bin/tsc'), [
    '--project',
    join(consumer, 'message-composer-tsconfig.json'),
  ])
  if (Object.keys(manifest.exports).some((key) => /(?:^|\/)internal(?:\/|$)/.test(key)))
    throw new Error('Packed UI export map exposes an internal module path')
  const privateImportProbe = `
    for (const specifier of [
      '@adea-ai/ui/internal/chat-composer-shell',
      '@adea-ai/ui/components/conversation/internal/chat-composer-shell',
    ]) {
      try {
        await import(specifier);
        throw new Error('Private composer shell unexpectedly resolved: ' + specifier);
      } catch (error) {
        if (error.message?.startsWith('Private composer shell unexpectedly resolved:')) throw error;
        if (!['ERR_PACKAGE_PATH_NOT_EXPORTED', 'ERR_MODULE_NOT_FOUND'].includes(error.code)) throw error;
      }
    }
  `
  execFileSync('node', ['--input-type=module', '-e', privateImportProbe], {
    cwd: consumer,
    stdio: 'pipe',
    timeout: 30_000,
  })
  for (const peer of ['chart.js', 'solid-chartjs', 'embla-carousel', 'embla-carousel-solid']) {
    if (existsSync(join(consumer, 'node_modules', peer)))
      throw new Error(`Optional engine installed in core composition: ${peer}`)
  }
  const notice = readFileSync(join(consumer, 'node_modules/@adea-ai/ui/dist/NOTICE'), 'utf8')
  for (const heading of [
    'Composer IME input ownership translated from KiroCrew',
    'Plain transcript follow translated from KiroCrew',
    'Busy composer action translated from KiroCrew',
    'Composed input and reading collapse translated from KiroCrew',
    'Paste-token model translated from KiroCrew (issue #532)',
    'Controlled paste-token editor translated from KiroCrew (issue #532)',
  ]) {
    if (!notice.includes(heading)) throw new Error(`Packed NOTICE lost ${heading}`)
  }
  if (
    !readFileSync(join(consumer, 'node_modules/@adea-ai/ui/dist/LICENSE'), 'utf8').includes(
      'Apache License'
    )
  )
    throw new Error('Packed LICENSE missing')
  // Each public entry gets an independent source-condition SSR graph. The plain
  // shell must not retain the optional atomic editor.
  const serverCases = [
    {
      pilot: 'composed',
      fixture: 'chat-composer-ssr.tsx',
      localImport: '../../src/components/conversation/chat-composer',
      publicImport: '@adea-ai/ui/components/conversation',
      renderSource:
        "import { renderComposer } from './server-fixture.mjs'; process.stdout.write(JSON.stringify([renderComposer(false),renderComposer(true)]));",
    },
    {
      pilot: 'atomic',
      fixture: 'atomic-chat-composer-ssr.tsx',
      localImport: '../../src/components/conversation/atomic',
      publicImport: '@adea-ai/ui/components/conversation/atomic',
      renderSource:
        "import { renderTokenComposer } from './server-fixture.mjs'; process.stdout.write(JSON.stringify([renderTokenComposer()]));",
    },
    {
      pilot: 'scroll',
      fixture: 'transcript-ssr.tsx',
      localImport: '../../src/components/conversation/conversation-surface',
      publicImport: '@adea-ai/ui/components/conversation',
      renderSource:
        "import { renderTranscript } from './server-fixture.mjs'; process.stdout.write(JSON.stringify([renderTranscript()]));",
    },
  ] as const
  for (const serverCase of serverCases) {
    const serverEntry = join(consumer, `${serverCase.pilot}-server.tsx`)
    const fixtureSource = readFileSync(join(root, 'tests/fixtures', serverCase.fixture), 'utf8')
    const packedFixture = fixtureSource.replace(serverCase.localImport, serverCase.publicImport)
    if (packedFixture === fixtureSource)
      throw new Error(`Failed to map ${serverCase.pilot} SSR entry`)
    writeFileSync(serverEntry, packedFixture)
    const serverBuild = await build({
      root: consumer,
      configFile: false,
      logLevel: 'warn',
      plugins: [solid({ ssr: true })],
      resolve: { conditions: ['solid', 'node', 'import'] },
      ssr: { noExternal: true },
      build: { write: false, minify: false, ssr: serverEntry },
    })
    const serverChunks = (Array.isArray(serverBuild) ? serverBuild : [serverBuild])
      .flatMap((output) => ('output' in output ? output.output : []))
      .filter((asset) => asset.type === 'chunk')
    if (serverChunks.length !== 1) throw new Error(`Expected one ${serverCase.pilot} SSR chunk`)
    const serverChunk = serverChunks[0]
    if (!serverChunk) throw new Error(`Missing ${serverCase.pilot} SSR chunk`)
    const serverModules = Object.keys(serverChunk.modules)
    const serverUi = serverModules.filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
    if (
      !serverUi.some((id) => id.includes('/src/')) ||
      serverUi.some((id) => id.includes('/dist/'))
    )
      throw new Error(`${serverCase.pilot} packed SSR did not select unmixed Solid source`)
    const hasAtomicEditor = serverUi.some((id) =>
      /\/conversation\/atomic\/chat-composer\./.test(id)
    )
    const hasPasteEditor = serverUi.some((id) => /\/conversation\/paste-token-editor\./.test(id))
    if (serverCase.pilot === 'composed' && (hasAtomicEditor || hasPasteEditor))
      throw new Error('Plain packed SSR retained the optional atomic editor')
    if (serverCase.pilot === 'atomic' && (!hasAtomicEditor || !hasPasteEditor))
      throw new Error('Atomic packed SSR lost its editor modules')
    writeFileSync(join(consumer, 'server-fixture.mjs'), serverChunk.code)
    writeFileSync(join(consumer, `${serverCase.pilot}-render.mjs`), serverCase.renderSource)
    const rendered = JSON.parse(
      execFileSync('node', [join(consumer, `${serverCase.pilot}-render.mjs`)], {
        cwd: consumer,
        encoding: 'utf8',
        timeout: 30_000,
      })
    ) as string[]
    if (serverCase.pilot === 'scroll') {
      if (
        !rendered[0]?.includes('data-slot="conversation-content"') ||
        !rendered[0].includes('A server-rendered reply.') ||
        rendered[0].includes('Jump to latest')
      )
        throw new Error('Packed native Node SSR lost scroll surface output')
    } else if (serverCase.pilot === 'composed') {
      const [expanded, collapsed] = rendered
      if (
        !expanded?.includes('data-slot="composer-input"') ||
        !expanded.includes('data-slot="composer-context"') ||
        expanded.includes('data-slot="paste-token-mirror"') ||
        collapsed?.includes('data-slot="composer-input"') ||
        collapsed?.includes('data-slot="composer-context"') ||
        !collapsed?.includes('Show the message input') ||
        !collapsed.includes('A server-side draft')
      )
        throw new Error('Packed native Node SSR lost plain composer composition')
    } else {
      const [tokenized] = rendered
      if (
        !tokenized?.includes('Paste-token server draft') ||
        !tokenized.includes('data-slot="paste-token-mirror"') ||
        !tokenized.includes('aria-hidden="true"') ||
        !tokenized.includes('[ Paste #1 · 3 lines ]')
      )
        throw new Error('Packed native Node SSR lost atomic token-editor composition')
    }
    results.push({
      pilot: serverCase.pilot,
      condition: 'solid-ssr-native-node',
      checks:
        serverCase.pilot === 'scroll'
          ? ['conversation-content', 'server-reply', 'no-browser-only-controls']
          : serverCase.pilot === 'composed'
            ? ['expanded-input-context', 'collapsed-draft-preview', 'plain-excludes-atomic-editor']
            : ['token-editor-mirror', 'atomic-public-subpath'],
      retainedModules: serverModules,
    })
  }
  for (const pilot of ['conversation', 'composer-fields', 'busy', 'composed', 'atomic'] as const) {
    for (const condition of ['compiled', 'solid'] as const) {
      const dir = join(consumer, pilot + '-' + condition)
      mkdirSync(dir)
      writeFileSync(
        join(dir, 'index.html'),
        '<div id="app"></div><script type="module" src="/main.tsx"></script>'
      )
      writeFileSync(
        join(dir, 'main.tsx'),
        pilot === 'conversation'
          ? fixture
          : pilot === 'composer-fields'
            ? packedComposerFieldsFixture
            : pilot === 'busy'
              ? busyFixture
              : pilot === 'composed'
                ? composedFixture
                : atomicFixture
      )
      writeFileSync(
        join(dir, 'style.css'),
        "@import 'tailwindcss';\n@import '@adea-ai/ui/theme.css';\n@import '@adea-ai/ui/base.css';\n" +
          (pilot === 'conversation' || pilot === 'composer-fields'
            ? [
                'components/conversation/message-composer.tsx',
                'components/ui/textarea/textarea.tsx',
                'components/ui/spinner/spinner.tsx',
                'components/ui/kbd/kbd.tsx',
                ...(pilot === 'conversation'
                  ? ['components/conversation/conversation-surface.tsx']
                  : []),
              ]
            : [
                ...(pilot === 'composed' || pilot === 'atomic'
                  ? [
                      'components/conversation/chat-composer.tsx',
                      'components/ui/spinner/spinner.tsx',
                    ]
                  : []),
                ...(pilot === 'atomic' ? ['components/conversation/paste-token-editor.tsx'] : []),
                'components/conversation/busy-send-button.tsx',
                'components/ui/button-group/button-group.tsx',
                'components/ui/separator/separator.tsx',
                'components/ui/dropdown-menu/dropdown-menu.tsx',
                'lib/overlay.ts',
              ]
          )
            .concat(['components/ui/button/button.tsx', 'lib/variants.ts'])
            .map((path) => `@source '../node_modules/@adea-ai/ui/src/${path}';\n`)
            .join('')
      )
      const result = await build({
        root: dir,
        configFile: false,
        logLevel: 'warn',
        plugins: [
          solid(),
          tailwindcss(),
          ...(condition === 'compiled'
            ? [
                {
                  name: 'packed-compiled-condition',
                  enforce: 'post' as const,
                  configEnvironment(_name: string, config: EnvironmentOptions) {
                    config.resolve ??= {}
                    config.resolve.conditions = (config.resolve.conditions ?? []).filter(
                      (value) => value !== 'solid' && value !== 'development'
                    )
                  },
                },
              ]
            : []),
        ],
        resolve: {
          conditions: condition === 'solid' ? ['solid', 'browser'] : ['browser', 'import'],
        },
        build: { write: false, minify: 'esbuild', target: 'esnext', modulePreload: false },
      })
      const outputs = Array.isArray(result) ? result : [result]
      const chunks = outputs.flatMap((output) => ('output' in output ? output.output : []))
      const js = chunks.filter((chunk) => chunk.type === 'chunk')
      if (js.length !== 1)
        throw new Error('Conversation pilot unexpectedly emitted additional JS chunks')
      const modules = js.flatMap((chunk) =>
        Object.entries(chunk.modules)
          .filter(([, value]) => value.renderedLength > 0)
          .map(([id]) => id)
      )
      const renderedModules = js.flatMap((chunk) =>
        Object.entries(chunk.modules)
          .filter(([, value]) => value.renderedLength > 0)
          .map(([id, value]) => ({ id, bytes: value.renderedLength }))
      )
      const uiModules = modules.filter((id) => id.includes('/node_modules/@adea-ai/ui/'))
      const expected = condition === 'compiled' ? '/dist/' : '/src/'
      if (!uiModules.some((id) => id.includes(expected)))
        throw new Error(`Wrong ${condition} export selection`)
      if (uiModules.some((id) => id.includes(condition === 'compiled' ? '/src/' : '/dist/')))
        throw new Error('Mixed UI conditions')
      const forbidden = modules.filter((id) =>
        /chart\.js|solid-chartjs|embla|xterm|codemirror|shiki|storybook|@adea-ai\/themes|\/components\/(?:theme|layout)|\/lib\/themes/.test(
          id
        )
      )
      if (forbidden.length) throw new Error(`Unrelated retained modules: ${forbidden.join(', ')}`)
      const unrelatedConversation = uiModules.filter((id) =>
        pilot === 'busy'
          ? /\/conversation\/(?:message-composer|chat-composer|atomic|conversation-surface|ime-guard|scroll-follow)/.test(
              id
            )
          : pilot === 'conversation'
            ? /\/conversation\/(?:busy-send-button|chat-composer|atomic|paste-token-editor)/.test(
                id
              )
            : pilot === 'composer-fields'
              ? /\/conversation\/(?:busy-send-button|chat-composer|atomic|paste-token-editor|conversation-surface|scroll-follow)/.test(
                  id
                )
              : /\/conversation\/(?:message-composer|conversation-surface|scroll-follow)/.test(id)
      )
      if (unrelatedConversation.length)
        throw new Error(`Unrelated conversation units: ${unrelatedConversation.join(', ')}`)
      if (
        pilot === 'composed' &&
        uiModules.some((id) =>
          /\/conversation\/(?:atomic\/chat-composer|paste-token-editor|paste-tokens)(?:\/|\.)/.test(
            id
          )
        )
      )
        throw new Error('Plain composed entry retained the optional atomic editor/model')
      const kobalteModules = renderedModules.filter(({ id }) => /@kobalte(?:\+|\/)core/.test(id))
      if (pilot === 'atomic') {
        const atomicEntries = uiModules.filter((id) =>
          /\/conversation\/atomic\/chat-composer\./.test(id)
        )
        const editorEntries = uiModules.filter((id) =>
          /\/conversation\/paste-token-editor\./.test(id)
        )
        const sharedShells = uiModules.filter((id) =>
          /\/conversation\/internal\/chat-composer-shell\.(?:js|tsx?)$/.test(id)
        )
        const hasTooltipSource = readFileSync(
          join(root, 'src/components/conversation/paste-token-editor.tsx'),
          'utf8'
        ).includes("from '@kobalte/core/tooltip'")
        if (
          atomicEntries.length !== 1 ||
          editorEntries.length !== 1 ||
          !hasTooltipSource ||
          !kobalteModules.length ||
          sharedShells.length !== 1
        )
          throw new Error(
            `Atomic entry lost its editor, one shared shell, or Kobalte Tooltip closure: ${JSON.stringify(
              {
                atomicEntries,
                editorEntries,
                hasTooltipSource,
                retainedKobalteModules: kobalteModules.length,
                sharedShells,
              }
            )}`
          )
      }
      const solidRoots = new Set(
        modules
          .filter((id) => id.includes('/node_modules/solid-js/'))
          .map((id) =>
            id.slice(0, id.indexOf('/node_modules/solid-js/') + '/node_modules/solid-js'.length)
          )
      )
      if (solidRoots.size !== 1)
        throw new Error(`Expected one Solid runtime, got ${solidRoots.size}`)
      if (chunks.some((chunk) => /\.woff2?$/.test(chunk.fileName)))
        throw new Error('Unexpected font asset')
      const code = js.map((chunk) => chunk.code).join('\n')
      const gzipBytes = gzipSync(code).length
      const css = chunks
        .filter((chunk) => chunk.type === 'asset' && chunk.fileName.endsWith('.css'))
        .map((chunk) => (chunk.type === 'asset' ? String(chunk.source) : ''))
        .join('\n')
      const editorBytes = renderedModules
        .filter(({ id }) =>
          /\/conversation\/atomic\/chat-composer\.|\/conversation\/paste-token-editor\.|\/conversation\/paste-tokens\./.test(
            id
          )
        )
        .reduce((total, module) => total + module.bytes, 0)
      const plainKobalteModules =
        sizeMeasurements.get(`${condition}:composed`)?.kobalteModules ?? []
      const tooltipModules =
        pilot === 'atomic'
          ? kobalteModules.filter(
              ({ id }) => !plainKobalteModules.some((module) => module.id === id)
            )
          : []
      const tooltipBytes = tooltipModules.reduce((total, module) => total + module.bytes, 0)
      sizeMeasurements.set(`${condition}:${pilot}`, {
        js: Buffer.byteLength(code),
        gzip: gzipBytes,
        css: Buffer.byteLength(css),
        editorBytes,
        tooltipBytes,
        kobalteModules,
      })
      console.log(
        JSON.stringify({
          pilot,
          condition,
          js: Buffer.byteLength(code),
          gzip: gzipBytes,
          css: Buffer.byteLength(css),
          ...(pilot === 'atomic'
            ? {
                editorBytes,
                kobalteTooltipIncrementalBytes: tooltipBytes,
                incrementalGzipBudget: MAX_ATOMIC_INCREMENT_GZIP_BYTES,
              }
            : {}),
        })
      )
      const acceptedGzipBudget =
        pilot === 'conversation' || pilot === 'composer-fields'
          ? MAX_GZIP_BYTES
          : pilot === 'busy'
            ? MAX_BUSY_GZIP_BYTES
            : undefined
      if (acceptedGzipBudget !== undefined && gzipBytes > acceptedGzipBudget)
        throw new Error(`Packed ${pilot} exceeds its gzip JS budget`)
      if (pilot === 'composed') assertComposedGzipBudget(gzipBytes)
      if (pilot === 'atomic') {
        const plain = sizeMeasurements.get(`${condition}:composed`)
        if (!plain) throw new Error(`Missing ${condition} composed baseline for atomic size check`)
        assertAtomicIncrementBudget(plain.gzip, gzipBytes)
      }
      if (Buffer.byteLength(css) > MAX_CSS_BYTES)
        throw new Error(`Packed ${pilot} exceeds its raw CSS budget`)
      for (const [engine, browserType] of [
        ['chromium', chromium],
        ['webkit', webkit],
      ] as const) {
        console.log(`Packed ${pilot}/${condition}/${engine}: interactions starting`)
        const browser = await browserType.launch({ headless: true })
        try {
          const page = await browser.newPage({ viewport: { width: 768, height: 700 } })
          const errors: string[] = []
          page.on('pageerror', (error) => errors.push(error.message))
          await page.setContent('<div id="app"></div>')
          await page.addStyleTag({ content: css })
          await page.addScriptTag({ type: 'module', content: code })
          if (pilot === 'composer-fields') {
            const field = page.getByRole('textbox', { name: 'Message', exact: true })
            // The fixture's <output> also exposes role=status, so a bare getByRole
            // resolves to two elements; the announcer is the one declaring both.
            const announcer = page.locator('[role="status"][aria-live="polite"]')
            await expect(field).toHaveAttribute('id', 'message-draft')
            const describedBy = (await field.getAttribute('aria-describedby'))?.split(' ') ?? []
            if (
              !describedBy.includes('message-instructions') ||
              describedBy.length !== 2 ||
              !describedBy.some((id) => id !== 'message-instructions')
            )
              throw new Error('Packed composer lost its host and field descriptions')
            await expect(page.locator('#message-instructions')).toHaveText(
              'Do not include secrets in a message.'
            )
            await page.getByRole('button', { name: 'Focus message' }).click()
            await expect(field).toBeFocused()
            await page.getByRole('button', { name: 'Use reply action' }).click()
            const replyField = page.getByRole('textbox', { name: 'Reply message', exact: true })
            await expect(replyField).toBeVisible()
            const reply = page.getByRole('button', { name: 'Reply', exact: true })
            await reply.hover()
            await expect(page.getByRole('tooltip')).toHaveText('Reply')

            await page.getByRole('button', { name: 'Hold next send' }).click()
            await reply.click()
            await expect(announcer).toHaveText('Sending reply…')
            await expect(page.getByRole('button', { name: 'Sending reply' })).toHaveAttribute(
              'aria-disabled',
              'true'
            )
            await expect(replyField).toHaveValue('A draft')
            await replyField.press('Enter')
            await expect(page.getByLabel('Send count')).toHaveText('1')
            await expect(replyField).toHaveValue('A draft')
            await page.getByRole('button', { name: 'Confirm pending send' }).click()
            await expect(replyField).toHaveValue('')
            await expect(announcer).toBeEmpty()

            await replyField.fill('A draft')
            await page.getByRole('button', { name: 'Hold next send' }).click()
            await reply.click()
            await expect(announcer).toHaveText('Sending reply…')
            await page.getByRole('button', { name: 'Reject pending send' }).click()
            await expect(announcer).toContainText('Message not sent')
            await expect(replyField).toHaveValue('A draft')
            await expect(page.getByLabel('Send count')).toHaveText('2')

            await page.getByRole('button', { name: 'Reject next send' }).click()
            await reply.click()
            const alert = announcer.getByText('Message not sent')
            await expect(alert).toContainText('Message not sent')
            await expect(reply).toBeFocused()
            await reply.press('Escape')
            await expect(alert).toHaveCount(0)
            await expect(reply).toBeFocused()
            await expect(replyField).toHaveValue('A draft')

            await page.getByRole('button', { name: 'Reject next send' }).click()
            await reply.click()
            await expect(alert).toContainText('Message not sent')
            const suggestion = page.getByRole('button', { name: 'Suggestion', exact: true })
            await suggestion.focus()
            await suggestion.press('Escape')
            await expect(alert).toBeVisible()
            await suggestion.evaluate((element) => {
              element.dispatchEvent(
                new KeyboardEvent('keydown', {
                  key: 'Escape',
                  bubbles: true,
                  cancelable: true,
                  isComposing: true,
                  keyCode: 229,
                })
              )
            })
            await expect(alert).toBeVisible()
            await replyField.press('Escape')
            await expect(alert).toHaveCount(0)
            await expect(replyField).toHaveValue('A draft')
            if (errors.length) throw new Error(`Browser errors: ${errors.join(', ')}`)
            results.push({
              pilot,
              condition,
              engine,
              checks: [
                'installed-field-api-and-description',
                'host-textarea-ref',
                'submit-label-action-and-tooltip',
                'pending-status-and-no-duplicate-send',
                'host-confirmed-draft-clear',
                'deferred-rejection-retains-draft',
                'button-origin-escape-focus',
                'prevented-overlay-and-ime-escape',
              ],
              js: Buffer.byteLength(code),
              gzip: gzipSync(code).length,
              css: Buffer.byteLength(css),
              chunks: js.length,
              retainedModules: modules,
            })
            continue
          }
          if (pilot === 'atomic') {
            const field = page.getByRole('textbox', { name: 'Message', exact: true })
            await field.fill('Atomic draft before collapse')
            await expect(page.getByLabel('Token transactions')).toHaveText('1')
            await page.getByRole('button', { name: 'Message input options' }).press('ArrowDown')
            await page.getByRole('menuitem', { name: /Collapse the message input/ }).click()
            const bar = page.getByRole('button', { name: 'Show the message input', exact: true })
            await expect(bar).toBeFocused()
            await expect(field).toHaveCount(0)
            await bar.click()
            await expect(field).toBeFocused()
            await expect(field).toHaveValue('Atomic draft before collapse')
            await field.fill('')
            const tracePointerAndSelection = async () =>
              page.evaluate(() => {
                const events: unknown[] = []
                const record = (event: Event) => {
                  const mouse = event instanceof MouseEvent ? event : null
                  const target = event.target
                  const fieldElement = document.querySelector<HTMLTextAreaElement>(
                    '[data-slot="composer-input"]'
                  )
                  const hit =
                    mouse && Number.isFinite(mouse.clientX) && Number.isFinite(mouse.clientY)
                      ? document.elementFromPoint(mouse.clientX, mouse.clientY)
                      : null
                  events.push({
                    type: event.type,
                    target:
                      target instanceof Element
                        ? `${target.tagName}[${target.getAttribute('data-slot') ?? ''}]`
                        : null,
                    hit:
                      hit instanceof Element
                        ? `${hit.tagName}[${hit.getAttribute('data-slot') ?? ''}]`
                        : null,
                    x: mouse?.clientX ?? null,
                    y: mouse?.clientY ?? null,
                    buttons: mouse?.buttons ?? null,
                    selectionStart: fieldElement?.selectionStart ?? null,
                    selectionEnd: fieldElement?.selectionEnd ?? null,
                    valueLength: fieldElement?.value.length ?? null,
                    fieldScrollTop: fieldElement?.scrollTop ?? null,
                    mirrorScrollTop:
                      document.querySelector<HTMLElement>('[data-slot="paste-token-mirror"]')
                        ?.scrollTop ?? null,
                    activeSlot: document.activeElement?.getAttribute('data-slot') ?? null,
                    maxTouchPoints: navigator.maxTouchPoints,
                    coarsePointer: matchMedia('(pointer: coarse)').matches,
                    noHover: matchMedia('(hover: none)').matches,
                    timeStamp: event.timeStamp,
                    time: performance.now(),
                  })
                  document.documentElement.dataset.pasteHoverTrace = JSON.stringify(events)
                }
                for (const type of [
                  'pointermove',
                  'pointerout',
                  'pointerleave',
                  'mousemove',
                  'mouseleave',
                  'select',
                  'scroll',
                ])
                  document.addEventListener(type, record, true)
              })
            const paste = async () => {
              const prevented = await field.evaluate((element) => {
                const clipboardData = new DataTransfer()
                clipboardData.setData('text/plain', 'red\ngreen\nblue')
                const event = new ClipboardEvent('paste', {
                  bubbles: true,
                  cancelable: true,
                  clipboardData,
                })
                element.dispatchEvent(event)
                return event.defaultPrevented
              })
              // Paste restores the caret on the next animation frame. Drain its
              // queued select event before a new pointer interaction, so it cannot
              // cancel the hover timer after the fixture has moved onto a token.
              await page.evaluate(
                () =>
                  new Promise<void>((done) =>
                    requestAnimationFrame(() => requestAnimationFrame(() => done()))
                  )
              )
              return prevented
            }
            await tracePointerAndSelection()
            if (!(await paste())) throw new Error('Packed atomic paste was not collapsed')
            await expect(field).toHaveValue('[ Paste #1 · 3 lines ]')
            await expect(page.getByLabel('Token transactions')).toHaveText('3')
            await expect(page.getByLabel('Token blocks')).toHaveText('1')
            const token = page.locator('[data-paste-seq="1"]')
            const tokenBox = (await token.boundingBox())!
            const pointer = {
              x: tokenBox.x + tokenBox.width / 2,
              y: tokenBox.y + tokenBox.height / 2,
            }
            const inspectPointer = () =>
              page.evaluate(({ x, y }) => {
                const tokenElement = document.querySelector<HTMLElement>('[data-paste-seq="1"]')
                const fieldElement = document.querySelector<HTMLTextAreaElement>(
                  '[data-slot="composer-input"]'
                )
                const hit = document.elementFromPoint(x, y)
                const tokenBounds = tokenElement?.getBoundingClientRect()
                const fieldBounds = fieldElement?.getBoundingClientRect()
                return {
                  point: { x, y },
                  token: tokenBounds
                    ? {
                        x: tokenBounds.x,
                        y: tokenBounds.y,
                        width: tokenBounds.width,
                        height: tokenBounds.height,
                        right: tokenBounds.right,
                        bottom: tokenBounds.bottom,
                      }
                    : null,
                  textarea: fieldBounds
                    ? {
                        x: fieldBounds.x,
                        y: fieldBounds.y,
                        width: fieldBounds.width,
                        height: fieldBounds.height,
                        right: fieldBounds.right,
                        bottom: fieldBounds.bottom,
                      }
                    : null,
                  tokenPointerEvents: tokenElement
                    ? getComputedStyle(tokenElement).pointerEvents
                    : null,
                  hit: hit
                    ? {
                        tagName: hit.tagName,
                        slot: hit.getAttribute('data-slot'),
                        className: typeof hit.className === 'string' ? hit.className : null,
                      }
                    : null,
                  hitIsTextarea: hit === fieldElement,
                  activeSlot: document.activeElement?.getAttribute('data-slot') ?? null,
                  selectionStart: fieldElement?.selectionStart ?? null,
                  selectionEnd: fieldElement?.selectionEnd ?? null,
                  valueLength: fieldElement?.value.length ?? null,
                  fieldScrollTop: fieldElement?.scrollTop ?? null,
                  mirrorScrollTop:
                    document.querySelector<HTMLElement>('[data-slot="paste-token-mirror"]')
                      ?.scrollTop ?? null,
                  maxTouchPoints: navigator.maxTouchPoints,
                  coarsePointer: matchMedia('(pointer: coarse)').matches,
                  noHover: matchMedia('(hover: none)').matches,
                  preview: document.querySelector('[data-slot="paste-token-preview"]') !== null,
                  describedBy: fieldElement?.getAttribute('aria-describedby') ?? null,
                }
              }, pointer)
            const pointerBeforeMove = await inspectPointer()
            await page.mouse.move(pointer.x, pointer.y)
            try {
              await expect(page.getByRole('tooltip')).toContainText('red\ngreen\nblue')
            } catch (error) {
              console.error(
                'Packed paste-token hover geometry before mouse move:',
                pointerBeforeMove
              )
              console.error(
                'Packed paste-token hover geometry after tooltip failure:',
                await inspectPointer()
              )
              console.error(
                'Packed paste-token hover event trace after tooltip failure:',
                await page.locator('html').getAttribute('data-paste-hover-trace')
              )
              throw error
            }
            await expect(field).toHaveAttribute('aria-describedby', /.+/)
            await page.keyboard.press('Escape')
            await field.fill('Ordinary text prunes the token')
            await expect(page.getByLabel('Token transactions')).toHaveText('4')
            await expect(page.getByLabel('Token blocks')).toHaveText('0')
            if (!(await paste())) throw new Error('Packed paste after pruning was not collapsed')
            await expect(page.getByLabel('Token transactions')).toHaveText('5')
            await expect(page.getByLabel('Token blocks')).toHaveText('1')
            await field.press('Enter')
            await expect(page.getByRole('alert')).toContainText('Message not sent')
            const snapshot = JSON.stringify([
              { id: 'packed-2', seq: 1, lines: 3, content: 'red\ngreen\nblue' },
            ])
            await expect(page.getByLabel('Submitted blocks')).toHaveText(snapshot)
            await expect(page.getByLabel('Sent')).toHaveText('0')
            await expect(page.getByLabel('Token blocks')).toHaveText('1')
            await page.getByRole('button', { name: 'Recover delivery' }).click()
            await field.press('Enter')
            await expect(page.getByLabel('Sent')).toHaveText('1')
            await expect(page.getByLabel('Submitted blocks')).toHaveText(snapshot)
            await expect(page.getByLabel('Token blocks')).toHaveText('0')
            await page.getByRole('button', { name: 'Delay delivery' }).click()
            await field.fill('Pending delivery')
            await field.press('Enter')
            await expect(page.getByRole('button', { name: 'Sending message' })).toBeDisabled()
            await expect(field).toHaveAttribute('readonly', '')
            const spinner = page.locator('[data-slot="spinner"]')
            await expect(spinner).toBeVisible()
            if (
              (await spinner.evaluate((element) => getComputedStyle(element).animationName)) !==
              'spin'
            )
              throw new Error('Packed atomic pending spinner CSS missing')
            await page.getByRole('button', { name: 'Finish delivery' }).click()
            await expect(field).not.toHaveAttribute('readonly', '')
            await expect(page.getByLabel('Sent')).toHaveText('2')
            if (errors.length) throw new Error(`Browser errors: ${errors.join(', ')}`)
            results.push({
              pilot,
              condition,
              engine,
              checks: [
                'shared-collapse-and-caret-focus',
                'atomic-paste-transaction',
                'plain-input-prunes-blocks',
                'accessible-hover-preview',
                'failed-submit-retains-paired-draft',
                'submit-snapshot-before-host-clear',
                'pending-readonly-and-spinner',
              ],
              js: Buffer.byteLength(code),
              gzip: gzipBytes,
              css: Buffer.byteLength(css),
              chunks: js.length,
              retainedModules: modules,
            })
            continue
          }
          if (pilot === 'composed') {
            const field = page.getByRole('textbox', { name: 'Message', exact: true })
            await field.fill('A packed unsent draft')
            await page.getByRole('button', { name: 'Message input options' }).press('ArrowDown')
            const menu = page.getByRole('menu')
            await expect(menu).toBeVisible()
            if (
              (await menu.evaluate((element) => getComputedStyle(element).backgroundColor)) ===
              'rgba(0, 0, 0, 0)'
            )
              throw new Error('Packed composer options surface CSS missing')
            await page.getByRole('menuitem', { name: /Collapse the message input/ }).click()
            const bar = page.getByRole('button', { name: 'Show the message input', exact: true })
            await expect(bar).toBeFocused()
            await expect(field).toHaveCount(0)
            await expect(page.getByRole('button', { name: 'Model context' })).toHaveCount(0)
            await bar.click()
            await expect(field).toBeFocused()
            await expect(field).toHaveValue('A packed unsent draft')
            await field.press('Enter')
            await expect(page.getByRole('alert')).toContainText('Message not sent')
            await expect(field).toHaveValue('A packed unsent draft')
            await page.getByRole('button', { name: 'Recover delivery' }).click()
            await field.press('Enter')
            await expect(page.getByLabel('Sent')).toHaveText('1')
            await page.getByRole('button', { name: 'Run busy' }).click()
            await page.getByRole('button', { name: 'Send options' }).click()
            const queueOption = page.getByRole('menuitemradio', { name: /Queue/ })
            await expect(queueOption).toBeVisible()
            await page.getByRole('menu').evaluate(waitForFiniteAnimations)
            await queueOption.click()
            await expect(page.getByLabel('Sent')).toHaveText('1')
            await field.fill('Queue this')
            await field.press('Enter')
            await expect(page.getByLabel('Submitted action')).toHaveText('queue')
            await field.fill('Act now')
            await field.press('Control+Enter')
            await expect(page.getByLabel('Submitted action')).toHaveText('steer')
            const candidatePrevented = await field.evaluate((element) => {
              const event = new KeyboardEvent('keydown', {
                key: 'Enter',
                isComposing: true,
                bubbles: true,
                cancelable: true,
              })
              element.dispatchEvent(event)
              return event.defaultPrevented
            })
            if (candidatePrevented)
              throw new Error('Composed input consumed native candidate default')
            if ((await field.evaluate((element) => getComputedStyle(element).resize)) !== 'none')
              throw new Error('Composed input CSS missing')
            await page.getByRole('button', { name: 'Stage references' }).click()
            await expect(
              page.getByRole('button', { name: 'Queue message', exact: true })
            ).toBeEnabled()
            await page.getByRole('button', { name: 'Send options' }).click()
            await expect(
              page.getByText('Ctrl/Cmd+Enter uses the other action', { exact: true })
            ).toHaveCount(0)
            await page.keyboard.press('Escape')
            await field.fill('Contextual text that cannot be steered')
            await field.press('Control+Enter')
            await expect(field).toHaveValue('Contextual text that cannot be steered')
            await expect(page.getByLabel('Sent')).toHaveText('3')
            await expect(page.getByLabel('Submitted action')).toHaveText('steer')
            await field.press('Enter')
            await expect(page.getByLabel('Sent')).toHaveText('4')
            await expect(page.getByLabel('Submitted action')).toHaveText('queue')
            await page.getByRole('button', { name: 'Delay delivery' }).click()
            await field.fill('Pending delivery')
            await field.press('Enter')
            await expect(page.getByRole('button', { name: 'Sending message' })).toBeDisabled()
            await expect(field).toHaveAttribute('readonly', '')
            const spinner = page.locator('[data-slot="spinner"]')
            await expect(spinner).toBeVisible()
            if (
              (await spinner.evaluate((element) => getComputedStyle(element).animationName)) !==
              'spin'
            )
              throw new Error('Packed pending spinner animation CSS missing')
            await page.getByRole('button', { name: 'Finish delivery' }).click()
            await expect(field).not.toHaveAttribute('readonly', '')
            if (errors.length) throw new Error(`Browser errors: ${errors.join(', ')}`)
            results.push({
              pilot,
              condition,
              engine,
              checks: [
                'collapse-draft',
                'collapse-unmount-shelf',
                'focus-restoration',
                'delivery-recovery',
                'busy-mode-selection',
                'alternate-busy-action',
                'reference-only-queue',
                'reference-only-steer-refusal',
                'host-action-mask-with-text',
                'pending-delivery-style',
                'native-ime-default',
                'tailwind-style',
              ],
              js: Buffer.byteLength(code),
              gzip: gzipSync(code).length,
              css: Buffer.byteLength(css),
              chunks: js.length,
              retainedModules: modules,
            })
            continue
          }
          if (pilot === 'busy') {
            const trigger = page.getByRole('button', { name: 'Send options' })
            await expect(trigger).toBeVisible()
            await expect(page.getByRole('button', { name: 'Steer', exact: true })).toBeDisabled()
            await trigger.press('ArrowDown')
            const menu = page.getByRole('menu')
            await expect(menu).toBeVisible()
            if (
              (await menu.evaluate((element) => getComputedStyle(element).backgroundColor)) ===
              'rgba(0, 0, 0, 0)'
            )
              throw new Error('Packed dropdown surface CSS missing')
            const steer = page.getByRole('menuitemradio', { name: /Steer/ })
            const queue = page.getByRole('menuitemradio', { name: /Queue/ })
            await expect(steer).toBeFocused()
            await steer.press('Tab')
            await expect(queue).toBeFocused()
            await queue.press('Enter')
            await expect(trigger).toBeFocused()
            await expect(page.getByLabel('Fired action')).toHaveText('none')
            await page.getByRole('button', { name: 'Enable send' }).click()
            const fire = page.getByRole('button', { name: 'Queue message', exact: true })
            await fire.click()
            await expect(page.getByLabel('Fired action')).toHaveText('queue')
            await page.getByRole('button', { name: 'Block queue' }).click()
            await expect(fire).toBeDisabled()
            await expect(
              page.getByText('Queue operation unavailable', { exact: true })
            ).toBeVisible()
            await trigger.press('ArrowDown')
            await expect(queue).toHaveAttribute('aria-disabled', 'true')
            await steer.press('Enter')
            await expect(trigger).toBeFocused()
            await expect(page.getByRole('button', { name: 'Steer', exact: true })).toBeEnabled()
            const geometry = await trigger.evaluate((element) => {
              const rect = element.getBoundingClientRect()
              const size = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
              return { width: rect.width, height: rect.height, expected: (28 * size) / 16 }
            })
            if (
              Math.abs(geometry.width - geometry.expected) > 0.5 ||
              Math.abs(geometry.height - geometry.expected) > 0.5
            )
              throw new Error('Packed icon control lost square height tokens')
            if (errors.length) throw new Error(`Browser errors: ${errors.join(', ')}`)
            results.push({
              pilot,
              condition,
              engine,
              checks: [
                'disabled-fire-live-picker',
                'scoped-tab-cycle',
                'controlled-selection-focus',
                'fire-only-execution',
                'unavailable-recovery',
                'square-control-style',
              ],
              js: Buffer.byteLength(code),
              gzip: gzipSync(code).length,
              css: Buffer.byteLength(css),
              chunks: js.length,
              retainedModules: modules,
            })
            continue
          }
          const field = page.getByRole('textbox', { name: 'Message', exact: true })
          await field.waitFor()
          await field.fill('Keep my failed draft')
          await field.press('Enter')
          await page.getByText('Message not sent.', { exact: false }).waitFor()
          if ((await field.inputValue()) !== 'Keep my failed draft')
            throw new Error('Failure lost draft')
          await page.getByRole('button', { name: 'Recover transport' }).click()
          await field.press('Enter')
          await page.waitForFunction(() => document.querySelector('output')?.textContent === '1')
          if ((await field.inputValue()) !== '')
            throw new Error('Successful send did not clear controlled draft')
          await field.fill('IME candidate')
          const candidatePrevented = await field.evaluate((element) => {
            const event = new KeyboardEvent('keydown', {
              key: 'Enter',
              isComposing: true,
              bubbles: true,
              cancelable: true,
            })
            element.dispatchEvent(event)
            return event.defaultPrevented
          })
          if (candidatePrevented)
            throw new Error('Packed composer prevented native candidate default')
          const latchPrevented = await field.evaluate((element) => {
            element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
            element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
            const event = new KeyboardEvent('keydown', {
              key: 'Enter',
              bubbles: true,
              cancelable: true,
            })
            element.dispatchEvent(event)
            return event.defaultPrevented
          })
          if (!latchPrevented) throw new Error('Packed composer lost post-composition Enter latch')
          if (
            (await page.locator('output').textContent()) !== '1' ||
            (await field.inputValue()) !== 'IME candidate'
          )
            throw new Error('Packed composer sent candidate commit')
          await page.waitForTimeout(70)
          await field.press('Enter')
          await page.waitForFunction(() => document.querySelector('output')?.textContent === '2')
          const scroller = page.getByRole('log', { name: 'Transcript', exact: true })
          await scroller.evaluate((element) => {
            element.scrollTop = element.scrollHeight
            element.dispatchEvent(new Event('scroll'))
          })
          await scroller.evaluate((element) => {
            element.scrollTop -= 30
            element.dispatchEvent(new Event('scroll'))
          })
          const before = await scroller.evaluate((element) => element.scrollTop)
          await page.getByRole('button', { name: 'Toggle transcript' }).click()
          await page.getByRole('button', { name: 'Toggle transcript' }).click()
          await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBe(before)
          await page.getByRole('button', { name: 'Grow response' }).click()
          await page.waitForFunction(
            () => document.querySelector('[data-tail]')!.textContent!.length > 1000
          )
          await page.waitForTimeout(100)
          if (Math.abs((await scroller.evaluate((element) => element.scrollTop)) - before) > 2)
            throw new Error('Packed follow yanked the reader')
          await scroller.locator('..').getByRole('button', { name: 'Jump to latest' }).click()
          const bottom = await scroller.evaluate(
            (element) => element.scrollHeight - element.clientHeight - element.scrollTop
          )
          if (bottom > 2) throw new Error('Packed jump did not reach bottom')
          if (!(await scroller.evaluate((element) => document.activeElement === element)))
            throw new Error('Packed jump lost keyboard focus')
          if (pilot === 'conversation') {
            const cached = page.getByRole('region', { name: 'Cached channel transcript' })
            const switchChannel = page.getByRole('button', { name: 'Switch channel' })
            await cached.evaluate((element) => {
              element.scrollTop = 420
              element.dispatchEvent(new Event('scroll'))
            })
            await expect.poll(() => cached.evaluate((element) => element.scrollTop)).toBe(420)
            await switchChannel.click()
            await expect(cached.locator('[data-channel-row]')).toHaveCount(3)
            await expect
              .poll(() => cached.evaluate((element) => element.scrollHeight))
              .toBeLessThan(500)
            await switchChannel.click()
            await expect(cached.locator('[data-channel-row]')).toHaveCount(60)
            await expect.poll(() => cached.evaluate((element) => element.scrollTop)).toBe(420)
          }
          // #192 made the composer textarea resize vertically; the UA default
          // (what remains without Tailwind) is 'both'.
          if ((await field.evaluate((element) => getComputedStyle(element).resize)) !== 'vertical')
            throw new Error('Packed Tailwind composer styles missing')
          if (errors.length) throw new Error(`Browser errors: ${errors.join(', ')}`)
          results.push({
            pilot,
            condition,
            engine,
            checks: [
              'failed-draft',
              'recovered-send',
              'restored-reading-intent',
              'native-ime-default',
              'ime-commit-latch',
              'reader-intent',
              'jump-focus',
              ...(pilot === 'conversation' ? ['cached-channel-restoration'] : []),
              'tailwind-style',
            ],
            js: Buffer.byteLength(code),
            gzip: gzipSync(code).length,
            css: Buffer.byteLength(css),
            chunks: js.length,
            retainedModules: modules,
          })
        } finally {
          await browser.close()
        }
      }
    }
  }
  for (const condition of ['compiled', 'solid'] as const) {
    const plain = sizeMeasurements.get(`${condition}:composed`)
    const atomic = sizeMeasurements.get(`${condition}:atomic`)
    if (!plain || !atomic) throw new Error(`Missing ${condition} atomic/ plain measurements`)
    const wholeGzipDelta = assertAtomicIncrementBudget(plain.gzip, atomic.gzip)
    results.push({
      pilot: 'atomic-increment',
      condition,
      plainWholeGzip: plain.gzip,
      atomicWholeGzip: atomic.gzip,
      wholeGzipDelta,
      incrementalGzipBudget: MAX_ATOMIC_INCREMENT_GZIP_BYTES,
      editorAndModelRenderedBytes: atomic.editorBytes,
      kobalteTooltipIncrementalBytes: atomic.tooltipBytes,
      kobalteTooltipIncrementalModuleCount: atomic.kobalteModules.filter(
        ({ id }) => !plain.kobalteModules.some((module) => module.id === id)
      ).length,
      cssDelta: atomic.css - plain.css,
      note: '6 KiB feature-specific increment cap; common plain modules are excluded by paired-fixture delta.',
    })
  }
  console.log(JSON.stringify({ archive: basename(archivePath), results }, null, 2))
} finally {
  rmSync(consumer, { recursive: true, force: true })
}
