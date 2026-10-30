export const documentThemeIds = ['studio', 'editorial', 'technical', 'midnight'] as const
export type DocumentThemeId = (typeof documentThemeIds)[number]
export interface DocumentAppearance {
  documentTheme: DocumentThemeId
  documentFontSize: number
  documentLineHeight: number
  documentWidth: 'narrow' | 'standard' | 'wide'
  exportPageSize: 'A4' | 'Letter'
}
export const defaultDocumentAppearance: DocumentAppearance = {
  documentTheme: 'studio',
  documentFontSize: 16,
  documentLineHeight: 1.85,
  documentWidth: 'standard',
  exportPageSize: 'A4',
}
interface DocumentTheme {
  id: DocumentThemeId
  name: string
  description: string
  mode: 'light' | 'dark'
  tokens: Record<string, string>
}
const sans = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
const serif = 'Georgia, "Times New Roman", serif'
const mono = '"SFMono-Regular", Consolas, "Liberation Mono", monospace'
export const documentThemes: readonly DocumentTheme[] = [
  {
    id: 'studio',
    name: 'Studio',
    description: 'Clair et équilibré, pour les notes du quotidien.',
    mode: 'light',
    tokens: {
      '--doc-background': '#ffffff',
      '--text': '#282c36',
      '--muted': '#626979',
      '--accent': '#7152bf',
      '--line': '#e0deea',
      '--panel': '#f6f5fa',
      '--hover': '#eeecf4',
      '--doc-font': sans,
      '--doc-heading-font': sans,
      '--doc-heading-weight': '650',
      '--doc-radius': '7px',
      '--code-keyword': '#814ba8',
      '--code-string': '#417447',
      '--code-number': '#9e592c',
      '--code-comment': '#737b89',
      '--code-title': '#286b9f',
    },
  },
  {
    id: 'editorial',
    name: 'Éditorial',
    description: 'Papier ivoire et typographie littéraire.',
    mode: 'light',
    tokens: {
      '--doc-background': '#fbf7ed',
      '--text': '#3e352b',
      '--muted': '#756856',
      '--accent': '#9a4e2e',
      '--line': '#ded3c0',
      '--panel': '#f1eadc',
      '--hover': '#eae1d1',
      '--doc-font': serif,
      '--doc-heading-font': serif,
      '--doc-heading-weight': '500',
      '--doc-radius': '2px',
      '--code-keyword': '#854c74',
      '--code-string': '#4b7041',
      '--code-number': '#9a4e2e',
      '--code-comment': '#7c7366',
      '--code-title': '#426b83',
    },
  },
  {
    id: 'technical',
    name: 'Technique',
    description: 'Titres monospace et accents bleus, pour la documentation.',
    mode: 'light',
    tokens: {
      '--doc-background': '#f8fafc',
      '--text': '#203044',
      '--muted': '#596c80',
      '--accent': '#126da3',
      '--line': '#cddce8',
      '--panel': '#eaf1f7',
      '--hover': '#dfebf4',
      '--doc-font': sans,
      '--doc-heading-font': mono,
      '--doc-heading-weight': '650',
      '--doc-radius': '4px',
      '--code-keyword': '#8053ac',
      '--code-string': '#347345',
      '--code-number': '#a65c24',
      '--code-comment': '#63778a',
      '--code-title': '#126da3',
    },
  },
  {
    id: 'midnight',
    name: 'Minuit',
    description: 'Fond encre et accents lavande, pour lire dans le calme.',
    mode: 'dark',
    tokens: {
      '--doc-background': '#1c2130',
      '--text': '#e0e6f0',
      '--muted': '#a3afc3',
      '--accent': '#bdaafa',
      '--line': '#39425a',
      '--panel': '#252d40',
      '--hover': '#323c53',
      '--doc-font': sans,
      '--doc-heading-font': sans,
      '--doc-heading-weight': '600',
      '--doc-radius': '9px',
      '--code-keyword': '#c5a1e8',
      '--code-string': '#9ec79d',
      '--code-number': '#dfb18a',
      '--code-comment': '#a0adc2',
      '--code-title': '#8fb9df',
    },
  },
]
export function getDocumentTheme(id: unknown): DocumentTheme {
  return documentThemes.find((theme) => theme.id === id) ?? documentThemes[0]
}
const bounded = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
export function normalizeDocumentAppearance(input: unknown): DocumentAppearance {
  const value = input && typeof input === 'object' ? (input as Partial<DocumentAppearance>) : {}
  return {
    documentTheme: getDocumentTheme(value.documentTheme).id,
    documentFontSize: bounded(
      value.documentFontSize,
      12,
      24,
      defaultDocumentAppearance.documentFontSize,
    ),
    documentLineHeight: bounded(
      value.documentLineHeight,
      1.4,
      2.2,
      defaultDocumentAppearance.documentLineHeight,
    ),
    documentWidth:
      value.documentWidth === 'narrow' || value.documentWidth === 'wide'
        ? value.documentWidth
        : 'standard',
    exportPageSize: value.exportPageSize === 'Letter' ? 'Letter' : 'A4',
  }
}
export function documentVariables(input: DocumentAppearance): Record<string, string> {
  const appearance = normalizeDocumentAppearance(input)
  const theme = getDocumentTheme(appearance.documentTheme)
  return {
    ...theme.tokens,
    '--doc-font-size': `${appearance.documentFontSize}px`,
    '--doc-line-height': String(appearance.documentLineHeight),
    '--doc-width': { narrow: '640px', standard: '820px', wide: '1040px' }[appearance.documentWidth],
    '--doc-color-scheme': theme.mode,
  }
}
/** Only validated numbers and catalog tokens become CSS; document content cannot inject styles. */
export function documentStylesheet(input: DocumentAppearance): string {
  const appearance = normalizeDocumentAppearance(input)
  const tokens = Object.entries(documentVariables(appearance))
    .map(([key, value]) => `${key}:${value}`)
    .join(';')
  return `:root{${tokens}} @page{size:${appearance.exportPageSize};margin:16mm;background:var(--doc-background)} body{margin:0;padding:40px;background:var(--doc-background)} @media print{html,body{background:var(--doc-background);print-color-adjust:exact;-webkit-print-color-adjust:exact}body{padding:0}}`
}
