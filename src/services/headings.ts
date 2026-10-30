import { Lexer, Marked, type Token, type Tokens } from 'marked'
export interface Heading {
  id: string
  title: string
  level: number
  line: number
}
export const blockMathPattern = /^\$\$\s*\n?([\s\S]+?)\n?\$\$(?:\n|$)/
export function headingTitle(markdown: string): string {
  const plain = (tokens: Token[]): string =>
    tokens
      .map((token) => {
        if ('tokens' in token && Array.isArray(token.tokens)) return plain(token.tokens)
        return 'text' in token ? String(token.text) : token.raw
      })
      .join('')
  return plain(Lexer.lexInline(markdown))
    .replace(
      /&(?:amp|lt|gt|quot|apos|nbsp);/g,
      (entity) =>
        ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' })[
          entity
        ]!,
    )
    .replace(/\s+/g, ' ')
    .trim()
}
export function createHeadingSlugger(): (text: string) => string {
  const used = new Set<string>()
  return (text) => {
    const base =
      headingTitle(text)
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, '')
        .trim()
        .replace(/\s+/g, '-') || 'section'
    let candidate = base
    for (let index = 2; used.has(candidate); index++) candidate = `${base}-${index}`
    used.add(candidate)
    return candidate
  }
}
const lexer = new Marked()
lexer.use({
  extensions: [
    {
      name: 'blockMath',
      level: 'block',
      start: (src) => src.indexOf('$$'),
      tokenizer(src) {
        const match = blockMathPattern.exec(src)
        if (match) return { type: 'blockMath', raw: match[0] }
      },
    },
  ],
})
export function extractHeadings(content: string): Heading[] {
  const headings: Heading[] = []
  const slug = createHeadingSlugger()
  const countLines = (text: string) => (text.match(/\n/g) ?? []).length
  const visit = (tokens: Token[], firstLine: number) => {
    let line = firstLine
    for (const token of tokens) {
      if (token.type === 'heading') {
        const heading = token as Tokens.Heading
        headings.push({
          id: slug(heading.text),
          title: headingTitle(heading.text) || 'Section sans titre',
          level: heading.depth,
          line,
        })
      } else if (token.type === 'blockquote') visit((token as Tokens.Blockquote).tokens, line)
      else if (token.type === 'list') {
        let cursor = 0
        for (const item of (token as Tokens.List).items) {
          const offset = token.raw.indexOf(item.raw, cursor)
          visit(item.tokens, line + countLines(token.raw.slice(0, Math.max(0, offset))))
          cursor = Math.max(0, offset) + item.raw.length
        }
      }
      line += countLines(token.raw)
    }
  }
  visit(lexer.lexer(content), 1)
  return headings
}
