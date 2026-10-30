import { useEffect, useRef, useState } from 'react'
import DOMPurify from 'dompurify'
import { renderMarkdown, localImageURL } from '../services/markdown'
import type { Theme } from '../../shared/types'
let renderSequence = 0
let mermaidQueue = Promise.resolve()
export function Preview({ content, path, theme }: { content: string; path: string | null; theme: Theme }) {
  const host = useRef<HTMLDivElement>(null)
  const [rendering, setRendering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    setRendering(true)
    const timer = setTimeout(() => {
      const run = async () => {
        if (cancelled || !host.current) return
        try {
          const container = document.createElement('div')
          container.innerHTML = renderMarkdown(content)
          for (const image of container.querySelectorAll('img')) {
            const url = localImageURL(image.getAttribute('src') ?? '', path)
            if (url) image.src = url
            else { image.removeAttribute('src'); image.alt = `${image.alt} (image locale : enregistrez le document dans un workspace)` }
            image.loading = 'eager'
          }
          const diagrams = container.querySelectorAll<HTMLElement>('[data-mermaid]')
          if (diagrams.length) {
            const { default: mermaid } = await import('mermaid')
            mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: theme === 'dark' ? 'dark' : 'default', maxTextSize: 50000, suppressErrorRendering: true })
            for (const diagram of diagrams) {
              if (cancelled) return
              try {
                const { svg } = await mermaid.render(`diagram-${++renderSequence}`, diagram.textContent ?? '')
                diagram.outerHTML = `<div class="mermaid-diagram">${DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, ADD_TAGS: ['foreignObject'], ADD_ATTR: ['dominant-baseline'] })}</div>`
              } catch (error) { diagram.className = 'diagram-error'; diagram.textContent = `Diagramme Mermaid invalide : ${error instanceof Error ? error.message : String(error)}` }
            }
          }
          if (!cancelled && host.current) { host.current.replaceChildren(...container.childNodes); setError(null) }
        } catch (error) { if (!cancelled) setError(error instanceof Error ? error.message : String(error)) }
        finally { if (!cancelled) setRendering(false) }
      }
      mermaidQueue = mermaidQueue.then(run, run)
    }, 180)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [content, path, theme])
  return <section className="preview-panel"><div className="panel-label"><span>APERÇU</span><span>{rendering ? 'Mise à jour…' : 'Rendu en direct'}</span></div><div className="preview-scroll">{error && <p className="preview-error" role="alert">{error}</p>}<article ref={host} className="prose" data-preview aria-busy={rendering} onClick={event => {
    const anchor = (event.target as Element).closest('a')
    if (!anchor) return
    event.preventDefault()
    const href = anchor.getAttribute('href') ?? ''
    if (href.startsWith('#')) { try { host.current?.querySelector(`#${CSS.escape(decodeURIComponent(href.slice(1)))}`)?.scrollIntoView() } catch { /* invalid anchor */ } }
    else if (/^(https?:|mailto:)/i.test(href)) void window.studio.external(href)
  }} /></div></section>
}
