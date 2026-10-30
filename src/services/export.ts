import { renderMarkdown, escapeHTML, localImageURL } from './markdown'
import { renderDiagram } from './diagram'
import previewCSS from '../styles/preview.css?inline'
import katexCSS from 'katex/dist/katex.min.css?inline'
import {
  documentStylesheet,
  getDocumentTheme,
  normalizeDocumentAppearance,
  type DocumentAppearance,
} from '../../shared/document-themes'
export async function buildExport(
  content: string,
  path: string | null,
  title: string,
  appearance: DocumentAppearance,
): Promise<string> {
  const settings = normalizeDocumentAppearance(appearance)
  const theme = getDocumentTheme(settings.documentTheme)
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
      try {
        const svg = await renderDiagram(diagram.textContent ?? '', theme.mode, theme.tokens)
        diagram.outerHTML = `<div class="mermaid-diagram">${svg}</div>`
      } catch {
        diagram.textContent = 'Diagramme Mermaid invalide.'
      }
    }
  }
  // The same theme variables and typography are used by the preview and both export formats.
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; font-src data:;"><title>${escapeHTML(title)}</title><style>${katexCSS}\n${previewCSS}\n${documentStylesheet(settings)}</style></head><body class="document-surface" data-document-theme="${theme.id}"><article class="prose">${container.innerHTML}</article></body></html>`
}
