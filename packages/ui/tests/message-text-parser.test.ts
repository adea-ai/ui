import { describe, expect, test } from 'bun:test'
import {
  parseInline,
  parseMessageText,
  safeHref,
  type MessageBlock,
  type MessageInline,
} from '../src/components/ui/message/parse-message-text'

function measureContinuations(count: number): number {
  const source = `- root\n${'  detail\n'.repeat(count)}`
  const start = performance.now()
  const [block] = parseMessageText(source)
  const elapsed = performance.now() - start
  expect(block?.kind).toBe('list')
  if (block?.kind === 'list') {
    expect(block.items).toHaveLength(1)
    expect(block.items[0]).toHaveLength(1 + count * 2)
  }
  return elapsed
}

/**
 * The parser reads untrusted text, so these hold three things: what it
 * recognises (and what it must leave alone), that nothing it returns can become
 * markup or a dangerous link, and that no input — however long or hostile —
 * makes it throw or take more than a linear amount of time.
 */

const codeBlocks = (blocks: readonly MessageBlock[]) =>
  blocks.filter((block): block is Extract<MessageBlock, { kind: 'code' }> => block.kind === 'code')

const language = (line: string) => codeBlocks(parseMessageText(`${line}\nx\n\`\`\``))[0]?.language
const isFence = (line: string) => codeBlocks(parseMessageText(`${line}\nx`)).length > 0

const heading = (line: string) => {
  const [block] = parseMessageText(line)
  return block?.kind === 'heading' ? { level: block.level, text: plain(block.inline) } : block?.kind
}

/** Flatten inline spans to the text a reader would see, to compare against the input. */
function plain(nodes: readonly MessageInline[]): string {
  return nodes
    .map((node) =>
      node.kind === 'text' || node.kind === 'code'
        ? node.text
        : node.kind === 'cite'
          ? node.raw
          : plain(node.children)
    )
    .join('')
}

function links(nodes: readonly MessageInline[]): string[] {
  return nodes.flatMap((node) =>
    node.kind === 'link'
      ? [node.href, ...links(node.children)]
      : node.kind === 'strong' || node.kind === 'em'
        ? links(node.children)
        : []
  )
}

describe('fenced code', () => {
  test('reads a backtick fence with its language', () => {
    const [block] = codeBlocks(parseMessageText('```ts\nconst a = 1\n```'))
    expect(block).toMatchObject({ language: 'ts', code: 'const a = 1', complete: true })
  })

  test('reads a tilde fence', () => {
    const blocks = parseMessageText('~~~py\nprint(1)\n~~~')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({ kind: 'code', language: 'py', code: 'print(1)' })
  })

  test('a longer fence holds a shorter one as content', () => {
    const blocks = parseMessageText('````md\n```js\nx\n```\n````\nafter')
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({ kind: 'code', language: 'md', code: '```js\nx\n```' })
    expect(blocks[1]).toMatchObject({ kind: 'paragraph', raw: 'after' })
  })

  test('a closing fence must be as long as the opening one and the same character', () => {
    const shorter = parseMessageText('````\nx\n```\ny')
    expect(shorter).toHaveLength(1)
    expect(shorter[0]).toMatchObject({ code: 'x\n```\ny', complete: true })

    const otherChar = parseMessageText('```\n~~~\nstill code\n```')
    expect(otherChar).toHaveLength(1)
    expect(otherChar[0]).toMatchObject({ code: '~~~\nstill code' })
  })

  test('a language-less fence has no language', () => {
    const [block] = codeBlocks(parseMessageText('```\nx\n```'))
    expect(block?.language).toBeUndefined()
    expect(block?.code).toBe('x')
  })

  test('takes the first word of the info string as the language', () => {
    const [block] = codeBlocks(parseMessageText('```ts title="a.ts"\nx\n```'))
    expect(block?.language).toBe('ts')
  })

  test('an unterminated fence is partial while streaming and plain code after', () => {
    const streaming = parseMessageText('intro\n```ts\nconst a', { streaming: true })
    expect(streaming.map((block) => block.kind)).toEqual(['paragraph', 'code'])
    expect(codeBlocks(streaming)[0]).toMatchObject({
      language: 'ts',
      code: 'const a',
      complete: false,
    })

    const finished = parseMessageText('intro\n```ts\nconst a')
    expect(codeBlocks(finished)[0]).toMatchObject({ code: 'const a', complete: true })
  })

  test('a terminated fence is complete even while streaming', () => {
    const [block] = codeBlocks(parseMessageText('```\nx\n```', { streaming: true }))
    expect(block?.complete).toBe(true)
  })

  test('an opening fence alone is an empty partial block while streaming', () => {
    const [block] = parseMessageText('```', { streaming: true })
    expect(block).toMatchObject({ kind: 'code', code: '', complete: false })
  })

  test('inline syntax inside a fence is not interpreted', () => {
    const [block] = codeBlocks(
      parseMessageText('```\n**not bold** <b>x</b> [a](javascript:1)\n```')
    )
    expect(block?.code).toBe('**not bold** <b>x</b> [a](javascript:1)')
  })

  test('a growing stream keeps earlier blocks identical in content', () => {
    const text = 'First paragraph.\n\n```ts\nconst a = 1\n```\n\nSecond paragraph being typed'
    const full = parseMessageText(text, { streaming: true })
    for (let end = 1; end <= text.length; end += 1) {
      const partial = parseMessageText(text.slice(0, end), { streaming: true })
      // Every block but the last is final, so its `raw` never changes later.
      partial.slice(0, -1).forEach((block, index) => {
        expect(block.raw).toBe(full[index]!.raw)
      })
    }
  })

  test('normalises CRLF and lone CR line endings', () => {
    const blocks = parseMessageText('a\r\nb\r\n\r\n```\r\nx\r\ny\r\n```\rz')
    expect(blocks[0]).toMatchObject({ kind: 'paragraph', raw: 'a\nb' })
    expect(blocks[1]).toMatchObject({ kind: 'code', code: 'x\ny' })
    expect(blocks[2]).toMatchObject({ kind: 'paragraph', raw: 'z' })
  })
})

describe('blocks', () => {
  test('empty and whitespace-only text have no blocks', () => {
    expect(parseMessageText('')).toEqual([])
    expect(parseMessageText('  \n\n \t\n')).toEqual([])
  })

  test('headings stop at level 4 and need a space after the hashes', () => {
    const blocks = parseMessageText('# One\n##### Five\n###   Three ##\n#nospace')
    expect(blocks.map((block) => block.kind)).toEqual([
      'heading',
      'paragraph',
      'heading',
      'paragraph',
    ])
    expect(blocks[0]).toMatchObject({ level: 1 })
    expect(blocks[2]).toMatchObject({ level: 3 })
    expect(plain((blocks[2] as Extract<MessageBlock, { kind: 'heading' }>).inline)).toBe('Three')
  })

  test('flat lists, ordered starts and continuation lines', () => {
    const blocks = parseMessageText('- a\n- b\n  more\n* c\n\n3. x\n4) y')
    const [bullets, numbers] = blocks as Extract<MessageBlock, { kind: 'list' }>[]
    expect(bullets).toMatchObject({ ordered: false })
    expect(bullets?.items.map(plain)).toEqual(['a', 'b more', 'c'])
    expect(numbers).toMatchObject({ ordered: true, start: 3 })
    expect(numbers?.items.map(plain)).toEqual(['x', 'y'])
  })

  test('a quote joins its lines and ends at the first plain line', () => {
    const blocks = parseMessageText('> a\n> b\nplain')
    expect(blocks.map((block) => block.kind)).toEqual(['quote', 'paragraph'])
    expect(blocks[0]?.raw).toBe('a\nb')
  })

  test('a paragraph keeps its line breaks', () => {
    const [block] = parseMessageText('one\ntwo\nthree')
    expect(block).toMatchObject({ kind: 'paragraph', raw: 'one\ntwo\nthree' })
  })

  test('unsupported syntax survives as readable paragraph text', () => {
    const source = '| a | b |\n|---|---|\n| 1 | 2 |'
    const [block] = parseMessageText(source)
    expect(block).toMatchObject({ kind: 'paragraph', raw: source })
  })
})

describe('inline spans', () => {
  test('code, strong, emphasis and links', () => {
    const nodes = parseInline('a `code` **bold** *it* [l](https://example.com)')
    expect(nodes.map((node) => node.kind)).toEqual([
      'text',
      'code',
      'text',
      'strong',
      'text',
      'em',
      'text',
      'link',
    ])
  })

  test('nests emphasis in strong', () => {
    expect(parseInline('**bold *it* more**')).toEqual([
      {
        kind: 'strong',
        children: [
          { kind: 'text', text: 'bold ' },
          { kind: 'em', children: [{ kind: 'text', text: 'it' }] },
          { kind: 'text', text: ' more' },
        ],
      },
    ])
    expect(parseInline('***x***')).toEqual([
      { kind: 'strong', children: [{ kind: 'em', children: [{ kind: 'text', text: 'x' }] }] },
    ])
  })

  test('nests strong in emphasis: *it **b** it*', () => {
    expect(parseInline('*it **b** it*')).toEqual([
      {
        kind: 'em',
        children: [
          { kind: 'text', text: 'it ' },
          { kind: 'strong', children: [{ kind: 'text', text: 'b' }] },
          { kind: 'text', text: ' it' },
        ],
      },
    ])
  })

  test('nests strong in emphasis with underscores, links and several spans', () => {
    expect(parseInline('_it __b__ it_')).toEqual([
      {
        kind: 'em',
        children: [
          { kind: 'text', text: 'it ' },
          { kind: 'strong', children: [{ kind: 'text', text: 'b' }] },
          { kind: 'text', text: ' it' },
        ],
      },
    ])
    const nodes = parseInline('*a **b** c **d** e* and *f*')
    expect(nodes.map((node) => node.kind)).toEqual(['em', 'text', 'em'])
    const [first] = nodes as [Extract<MessageInline, { kind: 'em' }>]
    expect(first.children.map((node) => node.kind)).toEqual([
      'text',
      'strong',
      'text',
      'strong',
      'text',
    ])
  })

  test('an unclosed strong before emphasis leaves both readable', () => {
    const nodes = parseInline('**a *b*')
    expect(plain(nodes)).toBe('**a b')
    expect(nodes.map((node) => node.kind)).toEqual(['text', 'em'])
  })

  test('a misread nesting still shows every character and no markup', () => {
    const nodes = parseInline('*it **b** it*')
    expect(plain(nodes).replaceAll('*', '')).toBe('it b it')
    expect(links(nodes)).toEqual([])
  })

  test('formatting works inside a link label', () => {
    const [link] = parseInline('[**b** `c`](https://x.y)')
    expect(link).toMatchObject({ kind: 'link', href: 'https://x.y' })
    expect((link as Extract<MessageInline, { kind: 'link' }>).children.map((n) => n.kind)).toEqual([
      'strong',
      'text',
      'code',
    ])
  })

  test('snake_case words are not emphasis', () => {
    expect(parseInline('snake_case_words and my_var_name')).toEqual([
      { kind: 'text', text: 'snake_case_words and my_var_name' },
    ])
  })

  test('word-internal underscore pairs stay literal before valid emphasis', () => {
    expect(parseInline('a__b a__b _italic_ __bold__')).toEqual([
      { kind: 'text', text: 'a__b a__b ' },
      { kind: 'em', children: [{ kind: 'text', text: 'italic' }] },
      { kind: 'text', text: ' ' },
      { kind: 'strong', children: [{ kind: 'text', text: 'bold' }] },
    ])
  })

  test('arithmetic stays arithmetic', () => {
    expect(parseInline('2 * 3 * 4')).toEqual([{ kind: 'text', text: '2 * 3 * 4' }])
    expect(parseInline('a * b')).toEqual([{ kind: 'text', text: 'a * b' }])
    expect(parseInline('5 ** 2 ** 3')).toEqual([{ kind: 'text', text: '5 ** 2 ** 3' }])
  })

  test('unmatched delimiters stay literal', () => {
    for (const source of [
      '**oops',
      '*half',
      '_half',
      '`tick',
      '[link](http://x',
      '[label only]',
      '[a](',
      'trailing *',
      '** **',
    ]) {
      expect(parseInline(source), source).toEqual([{ kind: 'text', text: source }])
    }
  })

  test('code spans can hold backticks and delimiters', () => {
    expect(parseInline('use `` a`b `` ok')).toEqual([
      { kind: 'text', text: 'use ' },
      { kind: 'code', text: 'a`b' },
      { kind: 'text', text: ' ok' },
    ])
    expect(parseInline('`**x**`')).toEqual([{ kind: 'code', text: '**x**' }])
  })

  test('HTML stays text', () => {
    const source = '<b>x</b> <script>alert(1)</script> <img src=x onerror=alert(1)> &lt;'
    expect(parseInline(source)).toEqual([{ kind: 'text', text: source }])
    const [paragraph] = parseMessageText(source)
    expect(paragraph).toMatchObject({ kind: 'paragraph', raw: source })
  })

  test('recursion is bounded', () => {
    const deep = `${'*'.repeat(500)}x${'*'.repeat(500)}`
    expect(() => parseInline(deep)).not.toThrow()
    const nestedLinks = `${'['.repeat(500)}x${']'.repeat(500)}`
    expect(plain(parseInline(nestedLinks))).toBe(nestedLinks)
  })

  test('the text a reader sees is never more than was written', () => {
    // Markup characters may be consumed, but no characters are invented.
    for (const source of ['a **b** c', '[x](https://a.co)', '`c`', '*a* _b_']) {
      expect(plain(parseInline(source)).length).toBeLessThanOrEqual(source.length)
    }
  })
})

describe('safeHref', () => {
  test('accepts http, https and mailto', () => {
    expect(safeHref('https://example.com/a?b=c#d')).toBe('https://example.com/a?b=c#d')
    expect(safeHref('http://example.com')).toBe('http://example.com')
    expect(safeHref('mailto:a@b.co')).toBe('mailto:a@b.co')
    expect(safeHref('  https://example.com  ')).toBe('https://example.com')
    expect(safeHref('https://example.com/é')).toBe('https://example.com/é')
  })

  test('rejects every other scheme, in any case', () => {
    for (const value of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      'ftp://example.com',
      'blob:https://example.com/id',
      'tel:+15555555555',
    ]) {
      expect(safeHref(value), value).toBeUndefined()
    }
  })

  test('rejects relative, protocol-relative and empty values', () => {
    for (const value of ['', '   ', '/relative', '//evil.example', 'example.com', '#anchor']) {
      expect(safeHref(value), value).toBeUndefined()
    }
  })

  test('rejects whitespace and control characters inside the URL', () => {
    for (const value of [
      'https://example.com/a b',
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      'https://example.com/\u0000',
      'https://example.com/\u0007',
      'https://example.com/\u007f',
      'https://example.com/\r\nSet-Cookie: x=1',
    ]) {
      expect(safeHref(value), JSON.stringify(value)).toBeUndefined()
    }
  })

  test('rejects a URL over 2048 characters and accepts one at the limit', () => {
    const base = 'https://example.com/'
    expect(safeHref(base + 'a'.repeat(2048 - base.length))).toHaveLength(2048)
    expect(safeHref(base + 'a'.repeat(2049 - base.length))).toBeUndefined()
    expect(safeHref(base + 'a'.repeat(100_000))).toBeUndefined()
  })

  test('a rejected link renders as its source text, never as a link', () => {
    for (const source of [
      '[x](javascript:alert(1))',
      '[x](JAVASCRIPT:alert(1))',
      '[x](data:text/html,<script>)',
      '[x](vbscript:msgbox)',
      '[x](http://a b)',
      '[x](java\tscript:alert(1))',
      `[x](https://a.co/${'a'.repeat(3000)})`,
    ]) {
      const nodes = parseInline(source)
      expect(links(nodes), source).toEqual([])
      expect(nodes, source).toEqual([{ kind: 'text', text: source }])
    }
    expect(links(parseInline('[m](mailto:a@b.co)'))).toEqual(['mailto:a@b.co'])
  })

  test('every href the parser ever returns passes safeHref', () => {
    const random = prng(7)
    const parts = [
      '[',
      ']',
      '(',
      ')',
      'x',
      'https://a.co',
      'javascript:',
      'mailto:a@b.co',
      ' ',
      '*',
    ]
    for (let run = 0; run < 400; run += 1) {
      const source = Array.from(
        { length: 30 },
        () => parts[Math.floor(random() * parts.length)]
      ).join('')
      for (const href of links(parseInline(source))) expect(safeHref(href)).toBe(href)
    }
  })
})

describe('robustness', () => {
  test('word-internal underscore pairs scale linearly', () => {
    // Warm up before comparing the best of three runs to limit scheduler noise.
    measureUnderscores(2_000)
    const small = Math.min(...Array.from({ length: 3 }, () => measureUnderscores(2_000)))
    const large = Math.min(...Array.from({ length: 3 }, () => measureUnderscores(8_000)))
    // Four times the input is ~4x for a linear parser and ~16x for the regression.
    expect(large / Math.max(small, 1)).toBeLessThan(10)
  })

  test('random input never throws and keeps its invariants', () => {
    const random = prng(0xadea)
    const alphabet = [
      ...'`*_[]()<>#-+~>\n\r\t \\!&"\'',
      'a',
      'Z',
      '1',
      '.',
      '😀',
      '\u0000',
      '\u202e',
    ]
    const words = [
      '```',
      '~~~',
      '**',
      '__',
      '](',
      'https://x.co',
      'javascript:',
      '- ',
      '1. ',
      '> ',
      '# ',
    ]
    for (let run = 0; run < 1500; run += 1) {
      const length = Math.floor(random() * 120)
      let text = ''
      while (text.length < length) {
        text +=
          random() < 0.3
            ? words[Math.floor(random() * words.length)]
            : alphabet[Math.floor(random() * alphabet.length)]
      }
      for (const streaming of [false, true]) {
        const blocks = parseMessageText(text, { streaming })
        for (const block of blocks) {
          expect(typeof block.raw).toBe('string')
          if (block.kind === 'code') {
            expect(block.complete || streaming).toBe(true)
            continue
          }
          const spans = block.kind === 'list' ? block.items.flat() : block.inline
          for (const href of links(spans)) expect(safeHref(href)).toBe(href)
        }
      }
    }
  })

  test('every prefix of a hostile document parses', () => {
    const document = [
      '# Title <script>alert(1)</script>',
      '```js',
      'alert(1)',
      '~~~',
      '[a](javascript:alert(1)) **b *c** `d',
      '> <img src=x onerror=alert(1)>',
      '- [x](https://ok.example) _y_ snake_case',
      '````',
      'tail',
    ].join('\n')
    for (let end = 0; end <= document.length; end += 1) {
      expect(() => parseMessageText(document.slice(0, end), { streaming: true })).not.toThrow()
    }
  })

  test('a very long document parses in linear time', () => {
    const MB = 1024 * 1024
    const prose = 'Hello *world*, see `code` and [a link](https://example.com/a). Done.\n'
    const cases: Record<string, string> = {
      prose: prose.repeat(Math.ceil(MB / prose.length)),
      'one 1 MB line': 'word '.repeat(MB / 5),
      'one 1 MB code block': '```\n' + 'const a = 1\n'.repeat(MB / 12) + '```',
      'unterminated 1 MB fence': '```ts\n' + 'line\n'.repeat(MB / 5),
      'many short fences': '```\nx\n```\n'.repeat(MB / 10),
      // Each of these is a quadratic trap for a parser that rescans from every
      // opener to the end of its line or text.
      'unclosed brackets': '['.repeat(MB),
      'unclosed labels': '[a '.repeat(MB / 3),
      'unclosed links': '[a]('.repeat(MB / 4),
      'links closed at the very end': '[a]('.repeat(MB / 4) + ')',
      'unclosed stars': '*a '.repeat(MB / 3),
      'unclosed strong': '**a '.repeat(MB / 4),
      // A single opener skips strong pairs to find its close; each stops at the next odd run.
      'emphasis over unclosed strong': '*a **b '.repeat(MB / 7),
      'unclosed citations': '[^1 [^1] '.repeat(MB / 9),
      'unclosed underscores': '_a '.repeat(MB / 3),
      'word-internal underscore pairs': 'a__b '.repeat(MB / 5),
      'unclosed backticks': '`a '.repeat(MB / 3),
      'nested emphasis': '*'.repeat(MB / 2) + 'x' + '*'.repeat(MB / 2),
      'long list': '- item\n'.repeat(MB / 7),
      'long quote': '> quote\n'.repeat(MB / 8),
      'many headings': '# h\n'.repeat(MB / 4),
    }
    for (const [name, text] of Object.entries(cases)) {
      const start = performance.now()
      parseMessageText(text, { citations: 3 })
      const elapsed = performance.now() - start
      // A linear parse takes a fraction of a second; a quadratic one takes minutes.
      expect(elapsed, `${name} took ${Math.round(elapsed)}ms`).toBeLessThan(5_000)
    }
  })

  test('long list continuations scale linearly', () => {
    measureContinuations(2_000)
    const small = Math.min(...Array.from({ length: 3 }, () => measureContinuations(8_000)))
    const large = Math.min(...Array.from({ length: 3 }, () => measureContinuations(32_000)))
    // Four times the lines should not take much more than four times as long.
    expect(large / Math.max(small, 1)).toBeLessThan(10)
  })

  test('a long info string that a stray backtick ends parses in bounded time', () => {
    const run = 'a'.repeat(65_536)
    for (const [name, line] of Object.entries({
      'backticks, a long word, a backtick': `\`\`\`${run}\``,
      'tildes, a long word, a backtick': `~~~${run}\``,
      'a long run of blanks, then a backtick': `\`\`\` ${' '.repeat(65_536)}a\``,
      'a long marker run, then a backtick': `${'`'.repeat(65_536)}a\``,
      'a long info string that ends the line': `\`\`\`${run}`,
    })) {
      const start = performance.now()
      const blocks = parseMessageText(line)
      const elapsed = performance.now() - start
      expect(elapsed, `${name} took ${Math.round(elapsed)}ms`).toBeLessThan(1_000)
      expect(blocks.length, name).toBeGreaterThan(0)
    }
  })

  test('a fence line keeps its syntax whatever follows the marker', () => {
    expect(language('```ts')).toBe('ts')
    expect(language('```  ts   extra words')).toBe('ts')
    expect(language('~~~~py')).toBe('py')
    expect(language('   ```')).toBeUndefined()
    expect(language('~~~ has`tick')).toBeUndefined()
    // Not fences: too few marks, four leading spaces, or a backtick in the info string.
    expect(isFence('``ts')).toBe(false)
    expect(isFence('    ```ts')).toBe(false)
    expect(isFence('```ts`')).toBe(false)
    expect(isFence('``` a ```')).toBe(false)
    expect(isFence('~~~ a`')).toBe(false)
    // A long word is the language, in full.
    expect(language(`\`\`\`${'a'.repeat(20_000)}`)).toBe('a'.repeat(20_000))
  })

  test('long runs of blanks after a heading or list marker parse in bounded time', () => {
    const blanks = ' '.repeat(65_536)
    for (const [name, line] of Object.entries({
      heading: `# x${blanks}y`,
      'heading with closing marks': `# x ${'# '.repeat(32_768)}y`,
      'heading, only blanks': `#${blanks}`,
      bullet: `- ${blanks}\u2028`,
      ordered: `1. ${blanks}\u2028`,
    })) {
      const start = performance.now()
      parseMessageText(line)
      const elapsed = performance.now() - start
      expect(elapsed, `${name} took ${Math.round(elapsed)}ms`).toBeLessThan(1_000)
    }
  })

  test('a heading keeps its text, its level and its closing marks', () => {
    expect(heading('# Title')).toEqual({ level: 1, text: 'Title' })
    expect(heading('   #### Deep ###  ')).toEqual({ level: 4, text: 'Deep' })
    expect(heading('## C# is a language')).toEqual({ level: 2, text: 'C# is a language' })
    expect(heading('## a #')).toEqual({ level: 2, text: 'a' })
    expect(heading('# #')).toEqual({ level: 1, text: '#' })
    expect(heading('#\tTabbed')).toEqual({ level: 1, text: 'Tabbed' })
    expect(heading('##### five')).toBe('paragraph')
    expect(heading('#nospace')).toBe('paragraph')
    expect(heading('    # indented')).toBe('paragraph')
  })

  test('one list continuation of very many spans appends every span', () => {
    const spans = 100_000
    const [block] = parseMessageText(`- root\n  ${'*x* '.repeat(spans)}`)
    expect(block?.kind).toBe('list')
    if (block?.kind !== 'list') return
    expect(block.items).toHaveLength(1)
    const item = block.items[0]!
    expect(item[0]).toEqual({ kind: 'text', text: 'root' })
    expect(item.filter((node) => node.kind === 'em')).toHaveLength(spans)
    // The root, the joining blank, and then each emphasis with the blank after it.
    expect(plain(item)).toBe(`root ${'x '.repeat(spans - 1)}x`)
  })

  test('doubling the input does not much more than double the time', () => {
    for (const unit of ['[a ', '[a](', '*a ', '`a ', '*a `']) {
      const small = unit.repeat(100_000)
      const large = unit.repeat(400_000)
      // One slow run (a garbage collection, a busy neighbour on a shared runner)
      // must not decide the ratio: warm both sizes up, then compare the medians
      // of several runs. A genuine quadratic parse is slow in every run, so the
      // median still shows it.
      measure(small)
      measure(large)
      const base = Math.max(median(small), 5)
      // Four times the input: linear is ~4x; quadratic is ~16x. Generous slack
      // for a noisy machine, still far below quadratic.
      expect(median(large) / base, unit).toBeLessThan(12)
    }
  })
})

/** Milliseconds one parse takes. */
function measureUnderscores(repeats: number): number {
  const source = 'a__b '.repeat(repeats)
  const start = performance.now()
  const nodes = parseInline(source)
  const elapsed = performance.now() - start
  expect(nodes).toEqual([{ kind: 'text', text: source }])
  return elapsed
}

/** The median of several timed parses of one input, in milliseconds. */
function median(text: string, runs = 5): number {
  const times = Array.from({ length: runs }, () => measure(text)).toSorted((a, b) => a - b)
  return times[Math.floor(runs / 2)]!
}

/** Milliseconds one block parse takes. */
function measure(text: string): number {
  const start = performance.now()
  parseMessageText(text)
  return performance.now() - start
}

/** A small deterministic generator, so a failing fuzz case reproduces. */
function prng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const cites = (nodes: readonly MessageInline[]) =>
  nodes.flatMap((node) => (node.kind === 'cite' ? [node.numbers] : []))

/** Every citation's numbers, depth-first through emphasis and strong. */
const deep = (nodes: readonly MessageInline[]): number[][] =>
  nodes.flatMap((node) =>
    node.kind === 'cite' ? [[...node.numbers]] : 'children' in node ? deep(node.children) : []
  )

describe('citation markers', () => {
  test('a marker is a citation only when the host has sources', () => {
    expect(cites(parseInline('claim [^1].'))).toEqual([])
    expect(cites(parseInline('claim [^1].', 0, { citations: 0 }))).toEqual([])
    expect(plain(parseInline('claim [^1].'))).toBe('claim [^1].')
  })

  test('numbers within the source count resolve, in order, without repeats', () => {
    expect(cites(parseInline('a [^1] b [^2, 3] c [^2,2]', 0, { citations: 3 }))).toEqual([
      [1],
      [2, 3],
      [2],
    ])
  })

  test('a number beyond the sources, zero, or too many numbers stays literal', () => {
    for (const source of ['[^4]', '[^0]', '[^1,4]', '[^1,2,3,4,5,6,7]', '[^]', '[^a]', '[^1']) {
      const nodes = parseInline(`x ${source}`, 0, { citations: 3 })
      expect(cites(nodes), source).toEqual([])
      expect(plain(nodes), source).toBe(`x ${source}`)
    }
  })

  test('ordinary brackets are never citations', () => {
    const nodes = parseInline('arr[1] and [1] and [^note]', 0, { citations: 3 })
    expect(cites(nodes)).toEqual([])
    expect(plain(nodes)).toBe('arr[1] and [1] and [^note]')
  })

  test('a code span keeps its marker as code, and a link label cannot hold one', () => {
    const [text, code] = parseInline('see `[^1]` here', 0, { citations: 2 })
    expect(text).toMatchObject({ kind: 'text' })
    expect(code).toEqual({ kind: 'code', text: '[^1]' })
    const [link] = parseInline('[label [^1]](https://example.com)', 0, { citations: 2 })
    expect(link).toMatchObject({ kind: 'link' })
    expect(cites((link as Extract<MessageInline, { kind: 'link' }>).children)).toEqual([])
  })

  test('markers work inside emphasis, lists, headings and quotes', () => {
    const blocks = parseMessageText(
      '# Title [^1]\n\n*em [^2]* and **strong [^1]**\n\n- item [^2]\n\n> quote [^1]',
      { citations: 2 }
    )
    const found = blocks.flatMap((block) => {
      const spans =
        block.kind === 'list' ? block.items.flat() : block.kind === 'code' ? [] : block.inline
      return deep(spans)
    })
    expect(found).toEqual([[1], [2], [1], [2], [1]])
  })

  test('a streamed marker is literal until it closes', () => {
    const open = parseMessageText('claim [^1', { streaming: true, citations: 2 })
    expect(open[0]).toMatchObject({ raw: 'claim [^1' })
    expect(cites((open[0] as Extract<MessageBlock, { kind: 'paragraph' }>).inline)).toEqual([])
  })

  test('a very long line of unclosed markers parses in bounded time', () => {
    const text = '[^1'.repeat(300_000)
    const start = performance.now()
    parseMessageText(text, { citations: 3 })
    expect(performance.now() - start).toBeLessThan(5_000)
  })

  test('code fences never hold citations', () => {
    const [block] = parseMessageText('```\n[^1]\n```', { citations: 2 })
    expect(block).toMatchObject({ kind: 'code', code: '[^1]' })
  })
})
