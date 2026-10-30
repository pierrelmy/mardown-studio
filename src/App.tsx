import { CommandPalette, type StudioCommand } from './components/CommandPalette'
import { WorkspaceSearch } from './components/WorkspaceSearch'
import { Outline } from './components/Outline'
import { workspaceFiles } from './services/workspace'
import { UpdateCenter } from './components/UpdateCenter'
import { DocumentAppearancePanel, PageSizeControl } from './components/DocumentAppearance'
import { documentThemes } from '../shared/document-themes'
import { useEffect, useRef, useState } from 'react'
import { FilePlus2, FolderOpen, X, AlertTriangle, ArrowUpRight } from 'lucide-react'
import { Toolbar } from './components/Toolbar'
import { Sidebar } from './components/Sidebar'
import { Tabs } from './components/Tabs'
import { StatusBar } from './components/StatusBar'
import { Editor } from './components/Editor'
import { Preview } from './components/Preview'
import { Modal } from './components/Modal'
import { useDialog } from './hooks/useDialog'
import { useStudio, unwrap } from './hooks/useStudio'
import { buildExport } from './services/export'

export default function App() {
  const { ask, dialog } = useDialog()
  const studio = useStudio(ask)
  const { preferences, active } = studio
  const area = useRef<HTMLDivElement>(null)
  const [sidebarMode, setSidebarMode] = useState<'files' | 'search' | 'outline'>('files')
  const [paletteMode, setPaletteMode] = useState<'files' | 'commands' | null>(null)
  const [headingNavigation, setHeadingNavigation] = useState<{
    id: string
    headingId: string
    line: number
    sequence: number
  } | null>(null)
  const [appearanceOpen, setAppearanceOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  useEffect(() => {
    document.documentElement.style.colorScheme = preferences.theme
    document.title = active ? `${active.name} — Markdown Studio` : 'Markdown Studio'
  }, [preferences.theme, active?.name])
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        document.querySelector('dialog[open]')
      )
        return
      const key = event.key.toLowerCase()
      if (
        ['s', 'o', 'n', 'w', 'b', 'p', 'k'].includes(key) ||
        (key === 'f' && event.shiftKey) ||
        key === '\\'
      )
        event.preventDefault()
      if (studio.busy) return
      if (key === 'p') setPaletteMode(event.shiftKey ? 'commands' : 'files')
      if (key === 'k') setPaletteMode('commands')
      if (key === 'f' && event.shiftKey) showSidebar('search')
      if (key === 's' && active) void studio.save(active.id, event.shiftKey)
      if (key === 'o') {
        if (event.shiftKey) void studio.openFolder()
        else void studio.openFile()
      }
      if (key === 'n') studio.create()
      if (key === 'w' && active) void studio.close(active.id)
      if (key === 'b') studio.update({ sidebar: !preferences.sidebar })
      if (key === '\\')
        studio.update({
          mode:
            preferences.mode === 'split'
              ? 'editor'
              : preferences.mode === 'editor'
                ? 'preview'
                : 'split',
        })
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [studio, active, preferences])
  const exportDocument = async (format: 'html' | 'pdf') => {
    if (!active) return
    setExporting(true)
    try {
      const html = await buildExport(active.content, active.path, active.name, preferences)
      unwrap(await window.studio.export(format, html, active.name))
      setExportOpen(false)
    } catch (error) {
      studio.setError(error instanceof Error ? error.message : String(error))
    } finally {
      setExporting(false)
    }
  }
  const showSidebar = (mode: 'search' | 'outline' | 'files') => {
    studio.update({ sidebar: true })
    setSidebarMode(mode)
    if (mode === 'search')
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLInputElement>('[aria-label="Rechercher dans le workspace"]')
          ?.focus(),
      )
  }
  const commands: StudioCommand[] = [
    { id: 'new', label: 'Nouveau document', shortcut: '⌘/Ctrl N', run: studio.create },
    {
      id: 'open-file',
      label: 'Ouvrir un fichier',
      shortcut: '⌘/Ctrl O',
      run: () => {
        void studio.openFile()
      },
    },
    {
      id: 'workspace',
      label: 'Ouvrir un dossier',
      keywords: 'workspace projet',
      run: () => {
        void studio.openFolder()
      },
    },
    {
      id: 'save',
      label: 'Enregistrer le document',
      shortcut: '⌘/Ctrl S',
      disabled: !active,
      run: () => {
        if (active) void studio.save(active.id)
      },
    },
    {
      id: 'save-as',
      label: 'Enregistrer une copie',
      shortcut: '⌘/Ctrl Shift S',
      disabled: !active,
      run: () => {
        if (active) void studio.save(active.id, true)
      },
    },
    {
      id: 'search',
      label: 'Rechercher dans le workspace',
      shortcut: '⌘/Ctrl Shift F',
      run: () => showSidebar('search'),
    },
    {
      id: 'outline',
      label: 'Afficher le sommaire',
      keywords: 'titres navigation plan',
      run: () => showSidebar('outline'),
    },
    { id: 'explorer', label: 'Afficher l’explorateur', run: () => showSidebar('files') },
    {
      id: 'appearance',
      label: 'Personnaliser le style du document',
      keywords: 'theme police apparence',
      run: () => setAppearanceOpen(true),
    },
    {
      id: 'theme',
      label: 'Changer le thème de l’interface',
      run: () => studio.update({ theme: preferences.theme === 'dark' ? 'light' : 'dark' }),
    },
    {
      id: 'export',
      label: 'Exporter le document',
      keywords: 'html pdf',
      disabled: !active,
      run: () => setExportOpen(true),
    },
    ...(['editor', 'preview', 'split'] as const).map((mode) => ({
      id: mode,
      label: mode === 'editor' ? 'Vue éditeur' : mode === 'preview' ? 'Vue aperçu' : 'Vue partagée',
      run: () => studio.update({ mode }),
    })),
  ]
  const headingSelection =
    active && headingNavigation?.id === active.id
      ? { line: headingNavigation.line, column: 1, sequence: headingNavigation.sequence }
      : null
  const searchSelection = studio.navigation?.id === active?.id ? studio.navigation : null
  const selection =
    headingSelection && (!searchSelection || headingSelection.sequence >= searchSelection.sequence)
      ? headingSelection
      : searchSelection
  return (
    <div className="app" data-theme={preferences.theme}>
      <Toolbar
        commands={() => setPaletteMode('commands')}
        preferences={preferences}
        update={studio.update}
        save={() => {
          if (active) void studio.save(active.id)
        }}
        openFile={() => {
          void studio.openFile()
        }}
        openFolder={() => {
          void studio.openFolder()
        }}
        create={studio.create}
        exportDocument={() => setExportOpen(true)}
        appearance={() => setAppearanceOpen(true)}
        hasDocument={!!active}
      />
      {studio.error && (
        <div role="alert" className="error-banner">
          <AlertTriangle size={15} />
          <span>{studio.error}</span>
          <button
            title="Masquer le message"
            aria-label="Masquer le message"
            onClick={() => studio.setError(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
      <div
        className={`app-body ${studio.busy ? 'busy' : ''}`}
        aria-busy={studio.busy || !studio.ready}
      >
        {preferences.sidebar && (
          <Sidebar
            mode={sidebarMode}
            setMode={showSidebar}
            searchPanel={
              <WorkspaceSearch
                workspace={studio.workspace}
                tabs={studio.tabs}
                navigate={(match) => {
                  setHeadingNavigation(null)
                  if (preferences.mode === 'preview') studio.update({ mode: 'split' })
                  void studio.openAt(match.path, match.line, match.column)
                }}
              />
            }
            outlinePanel={
              <Outline
                content={active?.content ?? ''}
                hasDocument={!!active}
                navigate={(heading) => {
                  if (active)
                    setHeadingNavigation({
                      id: active.id,
                      headingId: heading.id,
                      line: heading.line,
                      sequence: Date.now(),
                    })
                }}
              />
            }
            workspace={studio.workspace}
            activePath={active?.path}
            open={(path) => {
              void studio.open(path)
            }}
            openWorkspace={() => {
              void studio.openFolder()
            }}
            action={(action, path) => {
              void studio.fileAction(action, path)
            }}
            refresh={() => {
              void studio.refresh()
            }}
          />
        )}
        <main className="main">
          <Tabs
            tabs={studio.tabs}
            activeId={studio.activeId}
            select={studio.activate}
            close={(id) => {
              void studio.close(id)
            }}
            create={studio.create}
          />
          {!studio.ready ? (
            <div className="welcome">
              <p>Restauration de votre espace…</p>
            </div>
          ) : active ? (
            <>
              {(active.state === 'conflict' || active.state === 'error') && (
                <div className="conflict-banner">
                  <AlertTriangle size={15} />
                  <span>{active.error ?? 'La sauvegarde a échoué.'}</span>
                  <button
                    className="secondary"
                    onClick={() => {
                      void studio.reload(active.id)
                    }}
                  >
                    Recharger
                  </button>
                  <button
                    className="secondary"
                    onClick={() => {
                      void studio.save(active.id, true)
                    }}
                  >
                    Enregistrer une copie
                  </button>
                </div>
              )}
              <div className="document-breadcrumb">
                <span>{studio.workspace?.path.split(/[\\/]/).pop() ?? 'Documents'}</span>
                <span>/</span>
                <span>{active.name}</span>
                {!active.path && (
                  <span className="draft-label">
                    Brouillon · Enregistrez pour activer l’autosave
                  </span>
                )}
              </div>
              <div className="document-area" ref={area}>
                {preferences.mode !== 'preview' && (
                  <div
                    className="editor-wrapper"
                    style={{
                      flex: preferences.mode === 'split' ? `0 0 ${preferences.split}%` : '1',
                    }}
                  >
                    <Editor
                      key={active.id}
                      id={active.id}
                      selection={selection}
                      content={active.content}
                      theme={preferences.theme}
                      change={(content) => studio.edit(active.id, content)}
                    />
                  </div>
                )}
                {preferences.mode === 'split' && (
                  <div
                    className="split-handle"
                    role="separator"
                    aria-label="Redimensionner les panneaux"
                    aria-orientation="vertical"
                    aria-valuemin={25}
                    aria-valuemax={75}
                    aria-valuenow={Math.round(preferences.split)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                        event.preventDefault()
                        studio.update({
                          split: Math.max(
                            25,
                            Math.min(75, preferences.split + (event.key === 'ArrowLeft' ? -2 : 2)),
                          ),
                        })
                      }
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault()
                      event.currentTarget.setPointerCapture(event.pointerId)
                    }}
                    onPointerMove={(event) => {
                      if (!event.currentTarget.hasPointerCapture(event.pointerId) || !area.current)
                        return
                      const rect = area.current.getBoundingClientRect()
                      studio.update({
                        split: Math.max(
                          25,
                          Math.min(75, ((event.clientX - rect.left) / rect.width) * 100),
                        ),
                      })
                    }}
                    onPointerUp={(event) => {
                      if (event.currentTarget.hasPointerCapture(event.pointerId))
                        event.currentTarget.releasePointerCapture(event.pointerId)
                    }}
                  />
                )}
                {preferences.mode !== 'editor' && (
                  <Preview
                    content={active.content}
                    path={active.path}
                    appearance={preferences}
                    scrollTo={
                      headingNavigation?.id === active.id
                        ? { id: headingNavigation.headingId, sequence: headingNavigation.sequence }
                        : null
                    }
                  />
                )}
              </div>
            </>
          ) : (
            <div className="welcome">
              <div className="welcome-eyebrow">VOTRE ESPACE D’ÉCRITURE</div>
              <div className="welcome-mark">M↓</div>
              <h1>De l’idée à la page.</h1>
              <p>
                Notes, documentation, prochaine grande idée.
                <br />
                Tout commence par quelques mots.
              </p>
              <div className="welcome-actions">
                <button
                  className="primary"
                  onClick={() => {
                    void studio.openFolder()
                  }}
                >
                  <FolderOpen size={16} />
                  Ouvrir un dossier
                </button>
                <button className="secondary" onClick={studio.create}>
                  <FilePlus2 size={16} />
                  Nouveau document
                </button>
              </div>
              <button
                className="welcome-link"
                onClick={() => {
                  void studio.openFile()
                }}
              >
                Ouvrir un fichier Markdown <ArrowUpRight size={13} />
              </button>
              <div className="welcome-shortcuts">
                <span>
                  <kbd>⌘ / Ctrl</kbd> + <kbd>N</kbd> Nouveau
                </span>
                <span>
                  <kbd>⌘ / Ctrl</kbd> + <kbd>O</kbd> Ouvrir
                </span>
              </div>
            </div>
          )}
        </main>
      </div>
      <StatusBar
        updates={studio.ready && <UpdateCenter prepareForQuit={studio.prepareForQuit} />}
        tab={active}
        autosave={preferences.autosave}
        toggleAutosave={() => studio.update({ autosave: !preferences.autosave })}
      />
      {paletteMode && (
        <CommandPalette
          mode={paletteMode}
          commands={commands}
          files={workspaceFiles(studio.workspace?.tree ?? [])}
          openFile={(path) => {
            void studio.open(path)
          }}
          close={() => setPaletteMode(null)}
        />
      )}
      {dialog}
      {appearanceOpen && (
        <DocumentAppearancePanel
          appearance={preferences}
          update={studio.update}
          close={() => setAppearanceOpen(false)}
        />
      )}
      {exportOpen && (
        <Modal
          title="Exporter le document"
          close={() => {
            if (!exporting) setExportOpen(false)
          }}
        >
          <p>
            Le rendu inclut les tableaux, le code, les formules et les diagrammes. Les images
            locales autorisées sont intégrées dans le fichier exporté.
          </p>
          <div className="appearance-controls export-settings">
            <label>
              Thème du document
              <select
                aria-label="Thème de l’export"
                disabled={exporting}
                value={preferences.documentTheme}
                onChange={(event) =>
                  studio.update({
                    documentTheme: event.target.value as typeof preferences.documentTheme,
                  })
                }
              >
                {documentThemes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </select>
            </label>
            <PageSizeControl appearance={preferences} update={studio.update} disabled={exporting} />
          </div>
          <p className="export-style-summary">
            Texte {preferences.documentFontSize} px · Interligne{' '}
            {preferences.documentLineHeight.toFixed(2)} · Même style que l’aperçu
          </p>
          <button
            className="secondary"
            disabled={exporting}
            onClick={() => {
              setExportOpen(false)
              setAppearanceOpen(true)
            }}
          >
            Personnaliser le style…
          </button>
          <div className="modal-actions">
            <button
              className="secondary"
              disabled={exporting}
              onClick={() => {
                void exportDocument('html')
              }}
            >
              Exporter HTML
            </button>
            <button
              className="primary"
              disabled={exporting}
              onClick={() => {
                void exportDocument('pdf')
              }}
            >
              {exporting ? 'Export en cours…' : 'Exporter PDF'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
