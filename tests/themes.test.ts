import { describe, expect, it } from 'vitest'
import {
  defaultDocumentAppearance,
  documentStylesheet,
  documentThemes,
  documentVariables,
  normalizeDocumentAppearance,
} from '../shared/document-themes'
import { parseSession } from '../electron/services/session.service'

describe('document appearance and exported styles', () => {
  it('migrates existing sessions without changing the application theme', () => {
    const session = parseSession({ preferences: { theme: 'light', mode: 'preview', split: 60 } })
    expect(session.preferences).toMatchObject({
      ...defaultDocumentAppearance,
      theme: 'light',
      mode: 'preview',
      split: 60,
    })
  })
  it('preserves all document preferences separately from the application theme', () => {
    const appearance = {
      documentTheme: 'midnight',
      documentFontSize: 18,
      documentLineHeight: 1.7,
      documentWidth: 'wide',
      exportPageSize: 'Letter',
    } as const
    expect(
      parseSession({ preferences: { ...appearance, theme: 'light' } }).preferences,
    ).toMatchObject({ ...appearance, theme: 'light' })
  })
  it('normalizes corrupt settings and prevents arbitrary CSS interpolation', () => {
    expect(normalizeDocumentAppearance(null)).toEqual(defaultDocumentAppearance)
    const invalid = {
      documentTheme: '</style><script>',
      documentFontSize: Infinity,
      documentLineHeight: '2; color:red',
      documentWidth: 'evil',
      exportPageSize: 'A4; margin:0',
    }
    expect(normalizeDocumentAppearance(invalid)).toEqual(defaultDocumentAppearance)
    expect(
      normalizeDocumentAppearance({ documentFontSize: 100, documentLineHeight: 0 }),
    ).toMatchObject({ documentFontSize: 24, documentLineHeight: 1.4 })
    const css = documentStylesheet(invalid as unknown as typeof defaultDocumentAppearance)
    expect(css).not.toMatch(/<script>|evil|color:red/)
    expect(css).toContain('size:A4')
  })
  it.each(documentThemes)(
    'shares the $name palette between preview and portable export',
    (theme) => {
      const appearance = {
        ...defaultDocumentAppearance,
        documentTheme: theme.id,
        documentFontSize: 20,
        documentLineHeight: 2,
        documentWidth: 'narrow',
        exportPageSize: 'Letter',
      } as const
      const variables = documentVariables(appearance)
      expect(variables['--doc-background']).toBe(theme.tokens['--doc-background'])
      expect(variables['--doc-font-size']).toBe('20px')
      expect(variables['--doc-line-height']).toBe('2')
      expect(variables['--doc-width']).toBe('640px')
      expect(variables['--doc-color-scheme']).toBe(theme.mode)
      const css = documentStylesheet(appearance)
      for (const [key, value] of Object.entries(variables)) expect(css).toContain(`${key}:${value}`)
      expect(css).toContain('size:Letter')
      expect(css).toContain('print-color-adjust:exact')
    },
  )
})
