import { useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw, CaseSensitive } from 'lucide-react'
import { findTextMatches, type SearchResults, type TextMatch } from '../../shared/search'
import type { Workspace } from '../../shared/types'
import type { Tab } from './Tabs'
import { isDirty } from './Tabs'
import { workspaceFiles } from '../services/workspace'
export function WorkspaceSearch({
  workspace,
  tabs,
  navigate,
}: {
  workspace: Workspace | null
  tabs: Tab[]
  navigate: (match: TextMatch) => void
}) {
  const [query, setQuery] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [result, setResult] = useState<SearchResults | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const request = useRef(0)
  const [refresh, setRefresh] = useState(0)
  const revisions = tabs.map((tab) => `${tab.path}:${tab.revision}`).join('\0')
  useEffect(() => {
    const current = ++request.current
    setResult(null)
    setError(null)
    if (!workspace || !query.trim()) {
      setBusy(false)
      return
    }
    setBusy(true)
    const timer = setTimeout(() => {
      void window.studio
        .search(query, matchCase)
        .then((response) => {
          if (request.current !== current) return
          if (response.ok) setResult(response.value)
          else if (response.code !== 'CANCELLED') setError(response.error)
          setBusy(false)
        })
        .catch((error) => {
          if (request.current === current) {
            setError(String(error))
            setBusy(false)
          }
        })
    }, 250)
    return () => {
      request.current++
      clearTimeout(timer)
      void window.studio.cancelSearch().catch(() => {})
    }
  }, [query, matchCase, workspace?.path, workspace?.tree, revisions, refresh])
  const visible = useMemo(() => {
    if (!result) return []
    const paths = new Set(workspaceFiles(workspace?.tree ?? []).map((file) => file.path))
    const dirty = tabs.filter((tab) => tab.path && paths.has(tab.path) && isDirty(tab))
    const dirtyPaths = new Set(dirty.map((tab) => tab.path))
    return [
      ...result.matches.filter((match) => !dirtyPaths.has(match.path)),
      ...dirty.flatMap((tab) => findTextMatches(tab.content, query, tab.path!, matchCase)),
    ]
      .sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.column - b.column)
      .slice(0, 300)
  }, [result, tabs, workspace?.tree, query, matchCase])
  const limitReached = result?.limited || visible.length >= 300
  return (
    <section className="search-panel" aria-label="Recherche dans le workspace">
      <div className="sidebar-heading">
        <span>RECHERCHE</span>
        <button
          aria-label="Relancer la recherche"
          title="Relancer la recherche"
          disabled={!workspace || !query.trim() || busy}
          onClick={() => setRefresh((value) => value + 1)}
        >
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="workspace-query">
        <input
          autoFocus
          aria-label="Rechercher dans le workspace"
          maxLength={200}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Texte dans les fichiers…"
        />
        <button
          aria-label="Respecter la casse"
          title="Respecter la casse"
          aria-pressed={matchCase}
          onClick={() => setMatchCase((value) => !value)}
        >
          <CaseSensitive size={17} />
        </button>
      </div>
      {!workspace ? (
        <p className="sidebar-hint">Ouvrez un dossier pour rechercher dans vos documents.</p>
      ) : !query.trim() ? (
        <p className="sidebar-hint">
          Recherchez du texte dans les fichiers Markdown. Les modifications des onglets ouverts sont
          incluses.
        </p>
      ) : (
        <p className="search-summary" role="status">
          {busy
            ? 'Recherche…'
            : error
              ? error
              : `${visible.length} résultat${visible.length > 1 ? 's' : ''} · ${result?.scannedFiles ?? 0} fichiers lus`}
        </p>
      )}
      {result && !busy && (
        <div className="search-results">
          {(limitReached || result.skippedFiles > 0) && (
            <p className="sidebar-hint">
              {limitReached ? 'Limite atteinte : 300 correspondances ou 50 Mo lus. ' : ''}
              {result.skippedFiles > 0 ? `${result.skippedFiles} fichier(s) ignoré(s).` : ''}
            </p>
          )}
          {visible.map((match) => (
            <button
              className="search-result"
              key={`${match.path}:${match.line}:${match.column}`}
              title={match.path}
              onClick={() => navigate(match)}
            >
              <span className="search-file">
                {match.path.slice((workspace?.path.length ?? 0) + 1)}
                <small>
                  :{match.line}:{match.column}
                </small>
              </span>
              <span className="search-excerpt">
                {match.excerpt.slice(0, match.from)}
                <mark>{match.excerpt.slice(match.from, match.to)}</mark>
                {match.excerpt.slice(match.to)}
              </span>
            </button>
          ))}
          {!visible.length && <p className="sidebar-hint">Aucune correspondance.</p>}
        </div>
      )}
    </section>
  )
}
