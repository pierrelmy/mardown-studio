import { useEffect, useRef, useState } from 'react'
import { renderDiagram } from '../services/diagram'
import { renderMarkdown, localImageURL } from '../services/markdown'
import type { Theme } from '../../shared/types'
let mermaidQueue = Promise.resolve()
export function Preview({
  content,
  path,
  theme,
}: {
  content: string
  path: string | null
  theme: Theme
}) {
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
            else {
              image.removeAttribute('src')
              image.alt = `${image.alt} (image locale : enregistrez le document dans un workspace)`
            }
            image.loading = 'eager'
          }
          const diagrams = container.querySelectorAll<HTMLElement>('[data-mermaid]')
          if (diagrams.length) {
            for (const diagram of diagrams) {
              if (cancelled) return
              try {
                const svg = await renderDiagram(diagram.textContent ?? '', theme)
                diagram.outerHTML = `<div class="mermaid-diagram">${svg}</div>`
              } catch (error) {
                diagram.className = 'diagram-error'
                diagram.textContent = `Diagramme Mermaid invalide : ${error instanceof Error ? error.message : String(error)}`
              }
            }
          }
          if (!cancelled && host.current) {
            host.current.replaceChildren(...container.childNodes)
            setError(null)
          }
        } catch (error) {
          if (!cancelled) setError(error instanceof Error ? error.message : String(error))
        } finally {
          if (!cancelled) setRendering(false)
        }
      }
      mermaidQueue = mermaidQueue.then(run, run)
    }, 180)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [content, path, theme])
  return (
    <section className="preview-panel">
      <div className="panel-label">
        <span>APERÇU</span>
        <span>{rendering ? 'Mise à jour…' : 'Rendu en direct'}</span>
      </div>
      <div className="preview-scroll">
        {error && (
          <p className="preview-error" role="alert">
            {error}
          </p>
        )}
        <article
          ref={host}
          className="prose"
          data-preview
          aria-busy={rendering}
          onClick={(event) => {
            const anchor = (event.target as Element).closest('a')
            if (!anchor) return
            event.preventDefault()
            const href = anchor.getAttribute('href') ?? ''
            if (href.startsWith('#')) {
              try {
                host.current
                  ?.querySelector(`#${CSS.escape(decodeURIComponent(href.slice(1)))}`)
                  ?.scrollIntoView()
              } catch {
                /* invalid anchor */
              }
            } else if (/^(https?:|mailto:)/i.test(href)) void window.studio.external(href)
          }}
        />
      </div>
    </section>
  )
}
