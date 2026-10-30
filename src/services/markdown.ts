import { createHeadingSlugger, blockMathPattern } from './headings'
import { Marked, type Tokens } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'
import hljs from 'highlight.js/lib/common'

export const escapeHTML = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )
function mathHTML(text: string, displayMode: boolean): string {
  try {
    return katex.renderToString(text, {
      displayMode,
      throwOnError: false,
      trust: false,
      output: 'htmlAndMathml',
      maxExpand: 1000,
      maxSize: 20,
    })
  } catch {
    return `<code>${escapeHTML(text)}</code>`
  }
}
let headingSlug = createHeadingSlugger()
const parser = new Marked({ gfm: true, breaks: false })
parser.use({
  extensions: [
    {
      name: 'blockMath',
      level: 'block',
      start: (src) => src.indexOf('$$'),
      tokenizer(src) {
        const match = blockMathPattern.exec(src)
        if (match) return { type: 'blockMath', raw: match[0], text: match[1].trim() }
      },
      renderer: (token) => mathHTML(String(token.text), true),
    },
    {
      name: 'inlineMath',
      level: 'inline',
      start: (src) => src.indexOf('$'),
      tokenizer(src) {
        const match = /^\$(?!\s|\$)((?:\\.|[^$\n])+?)(?<!\s)\$(?!\d)/.exec(src)
        if (match) return { type: 'inlineMath', raw: match[0], text: match[1] }
      },
      renderer: (token) => mathHTML(String(token.text), false),
    },
  ],
  renderer: {
    heading({ tokens, text, depth }: Tokens.Heading) {
      const id = headingSlug(text)
      return `<h${depth} id="${escapeHTML(id)}">${this.parser.parseInline(tokens)}</h${depth}>`
    },
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHTML(text)
    },
    code({ text, lang }: Tokens.Code) {
      const language = lang?.split(/\s/)[0] ?? ''
      if (language === 'mermaid')
        return `<pre class="mermaid-source" data-mermaid="true">${escapeHTML(text)}</pre>`
      const highlighted =
        language && hljs.getLanguage(language)
          ? hljs.highlight(text, { language, ignoreIllegals: true }).value
          : escapeHTML(text)
      return `<pre><code class="hljs language-${escapeHTML(language)}">${highlighted}</code></pre>`
    },
  },
})
export function renderMarkdown(content: string): string {
  headingSlug = createHeadingSlugger()
  const html = parser.parse(content, { async: false }) as string
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, mathMl: true },
    ADD_ATTR: ['data-mermaid'],
    FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form'],
  })
}
export function localImageURL(source: string, documentPath: string | null): string | null {
  if (/^(https:\/\/|data:image\/(?:png|jpeg|gif|webp|avif);base64,)/i.test(source)) return source
  if (!documentPath || /^[a-z][a-z\d+.-]*:/i.test(source) || source.startsWith('//')) return null
  const base = documentPath.replace(/\\/g, '/')
  const prefix = base.startsWith('/') ? '' : '/'
  try {
    const url = new URL(source, `file://${prefix}${base}`)
    return `studio-asset://local/?path=${encodeURIComponent(decodeURIComponent(url.pathname).replace(/^\/([a-z]:\/)/i, '$1'))}`
  } catch {
    return null
  }
}
