import { useEffect, useRef } from 'react'
import { basicSetup } from 'codemirror'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { indentWithTab } from '@codemirror/commands'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
import type { Theme } from '../../shared/types'

export function Editor({
  id,
  content,
  theme,
  change,
}: {
  id: string
  content: string
  theme: Theme
  change: (value: string) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const onChange = useRef(change)
  const initial = useRef(content)
  const currentTheme = useRef(theme)
  const themeSlot = useRef(new Compartment())
  onChange.current = change
  currentTheme.current = theme
  useEffect(() => {
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: initial.current,
        extensions: [
          basicSetup,
          markdown({ codeLanguages: languages }),
          keymap.of([indentWithTab]),
          EditorView.lineWrapping,
          syntaxHighlighting(
            HighlightStyle.define([
              { tag: tags.heading, color: 'var(--accent)', fontWeight: '600' },
              { tag: [tags.keyword, tags.modifier], color: 'var(--syntax-purple)' },
              { tag: [tags.string, tags.special(tags.string)], color: 'var(--syntax-green)' },
              { tag: [tags.number, tags.bool, tags.atom], color: 'var(--syntax-orange)' },
              {
                tag: [tags.link, tags.url, tags.function(tags.variableName)],
                color: 'var(--syntax-blue)',
              },
              { tag: [tags.comment, tags.meta, tags.processingInstruction], color: 'var(--muted)' },
              { tag: tags.strong, fontWeight: 'bold' },
              { tag: tags.emphasis, fontStyle: 'italic' },
              { tag: tags.invalid, color: 'var(--error)' },
            ]),
          ),
          themeSlot.current.of(EditorView.theme({}, { dark: currentTheme.current === 'dark' })),
          EditorView.contentAttributes.of({ 'aria-label': 'Éditeur Markdown', spellcheck: 'true' }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChange.current(update.state.doc.toString())
          }),
        ],
      }),
    })
    view.current = editor
    return () => {
      editor.destroy()
      view.current = null
    }
  }, [id])
  useEffect(() => {
    const editor = view.current
    if (editor && editor.state.doc.toString() !== content)
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: content } })
  }, [content])
  useEffect(() => {
    view.current?.dispatch({
      effects: themeSlot.current.reconfigure(EditorView.theme({}, { dark: theme === 'dark' })),
    })
  }, [theme])
  return (
    <section className="editor-panel">
      <div className="panel-label">
        <span>ÉDITEUR</span>
        <span>Markdown</span>
      </div>
      <div className="editor-host" ref={host} />
    </section>
  )
}
