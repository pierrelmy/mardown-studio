import DOMPurify from 'dompurify'
import type { Theme } from '../../shared/types'
let sequence = 0
let queue: Promise<unknown> = Promise.resolve()
/** Mermaid has global configuration. Serialize preview/export to prevent theme and ID races. */
export function renderDiagram(source: string, theme: Theme): Promise<string> {
  const job = queue.catch(() => {}).then(async () => {
    const { default: mermaid } = await import('mermaid')
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: theme === 'dark' ? 'dark' : 'default', maxTextSize: 50000, suppressErrorRendering: true })
    const { svg } = await mermaid.render(`studio-diagram-${++sequence}`, source)
    return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, ADD_TAGS: ['foreignObject'], ADD_ATTR: ['dominant-baseline'] })
  })
  queue = job
  return job
}
