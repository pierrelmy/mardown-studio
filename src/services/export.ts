import { renderMarkdown, escapeHTML, localImageURL } from './markdown'
import { renderDiagram } from './diagram'
import previewCSS from '../styles/preview.css?inline'
import katexCSS from 'katex/dist/katex.min.css?inline'
import type { Theme } from '../../shared/types'
export async function buildExport(content: string, path: string | null, title: string, _theme: Theme): Promise<string> {
  const container = document.createElement('div')
  container.innerHTML = renderMarkdown(content)
  for (const image of container.querySelectorAll('img')) {
    const url = localImageURL(image.getAttribute('src') ?? '', path)
    if (url) image.src = url
    else image.removeAttribute('src')
  }
  const diagrams = container.querySelectorAll('[data-mermaid]')
  if (diagrams.length) {
    for (const diagram of diagrams) {
      try { const svg = await renderDiagram(diagram.textContent ?? '', 'light'); diagram.outerHTML = `<div class="mermaid-diagram">${svg}</div>` }
      catch { diagram.textContent = 'Diagramme Mermaid invalide.' }
    }
  }
  // Export a portable light page; diagrams use the same light theme for legible printing.
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; font-src data:;"><title>${escapeHTML(title)}</title><style>${katexCSS}\n${previewCSS}\nbody{margin:40px;background:#fff;--text:#282c36;--line:#ddd;--accent:#7152bf;--muted:#666;--panel:#f6f6f8;--hover:#eee} @page{size:A4;margin:16mm}</style></head><body><article class="prose">${container.innerHTML}</article></body></html>`
}
