import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  Plus,
  FolderPlus,
  MoreHorizontal,
  RefreshCw,
  Search,
  ListTree,
} from 'lucide-react'
import type { FileNode, Workspace } from '../../shared/types'
export function Sidebar({
  workspace,
  activePath,
  open,
  openWorkspace,
  action,
  refresh,
  mode,
  setMode,
  searchPanel,
  outlinePanel,
}: {
  mode: 'files' | 'search' | 'outline'
  setMode: (mode: 'files' | 'search' | 'outline') => void
  searchPanel: ReactNode
  outlinePanel: ReactNode
  workspace: Workspace | null
  activePath?: string | null
  open: (path: string) => void
  openWorkspace: () => void
  action: (action: 'file' | 'directory' | 'rename' | 'delete', path: string) => void
  refresh: () => void
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<string | null>(null)
  const render = (nodes: FileNode[], depth = 0) =>
    nodes.map((node) => {
      const isOpen = expanded.has(node.path)
      return (
        <div key={node.path}>
          <div
            className={`tree-row ${activePath === node.path ? 'active' : ''}`}
            style={{ paddingLeft: 12 + depth * 14 }}
          >
            <button
              className="tree-name"
              title={node.path}
              onClick={() => {
                if (node.kind === 'file') open(node.path)
                else
                  setExpanded((prev) => {
                    const next = new Set(prev)
                    if (isOpen) next.delete(node.path)
                    else next.add(node.path)
                    return next
                  })
              }}
            >
              {node.kind === 'directory' ? (
                <>
                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  {isOpen ? <FolderOpen size={15} /> : <Folder size={15} />}
                </>
              ) : (
                <>
                  <span className="tree-spacer" />
                  <FileText size={15} className="file-icon" />
                </>
              )}
              <span>{node.name}</span>
            </button>
            <button
              className="tree-more"
              title={`Actions pour ${node.name}`}
              aria-label={`Actions pour ${node.name}`}
              onClick={() => setMenu(menu === node.path ? null : node.path)}
            >
              <MoreHorizontal size={15} />
            </button>
          </div>
          {menu === node.path && (
            <div className="tree-menu">
              {node.kind === 'directory' && (
                <>
                  <button
                    onClick={() => {
                      setMenu(null)
                      action('file', node.path)
                    }}
                  >
                    Nouveau fichier
                  </button>
                  <button
                    onClick={() => {
                      setMenu(null)
                      action('directory', node.path)
                    }}
                  >
                    Nouveau dossier
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setMenu(null)
                  action('rename', node.path)
                }}
              >
                Renommer
              </button>
              <button
                className="danger"
                onClick={() => {
                  setMenu(null)
                  action('delete', node.path)
                }}
              >
                Supprimer…
              </button>
            </div>
          )}
          {node.kind === 'directory' && isOpen && render(node.children ?? [], depth + 1)}
        </div>
      )
    })
  return (
    <aside className="sidebar">
      <div className="sidebar-tabs" role="group" aria-label="Panneau latéral">
        <button
          aria-label="Explorateur"
          title="Explorateur"
          aria-pressed={mode === 'files'}
          onClick={() => setMode('files')}
        >
          <FolderOpen size={17} />
        </button>
        <button
          aria-label="Recherche workspace"
          title="Recherche · ⌘/Ctrl Shift F"
          aria-pressed={mode === 'search'}
          onClick={() => setMode('search')}
        >
          <Search size={17} />
        </button>
        <button
          aria-label="Sommaire"
          title="Sommaire"
          aria-pressed={mode === 'outline'}
          onClick={() => setMode('outline')}
        >
          <ListTree size={17} />
        </button>
      </div>
      {mode === 'search' ? (
        searchPanel
      ) : mode === 'outline' ? (
        outlinePanel
      ) : (
        <>
          <div className="sidebar-heading">
            <span>EXPLORATEUR</span>
            <button title="Actualiser" aria-label="Actualiser l’explorateur" onClick={refresh}>
              <RefreshCw size={14} />
            </button>
          </div>
          {workspace ? (
            <>
              <div className="workspace-heading">
                <FolderOpen size={15} />
                <span title={workspace.path}>{workspace.path.split(/[\\/]/).pop()}</span>
                <button
                  title="Nouveau fichier"
                  aria-label="Créer un fichier dans le workspace"
                  onClick={() => action('file', workspace.path)}
                >
                  <Plus size={15} />
                </button>
                <button
                  title="Nouveau dossier"
                  aria-label="Créer un dossier dans le workspace"
                  onClick={() => action('directory', workspace.path)}
                >
                  <FolderPlus size={15} />
                </button>
              </div>
              <nav aria-label="Fichiers du workspace" className="file-tree">
                {workspace.tree.length ? (
                  render(workspace.tree)
                ) : (
                  <p className="sidebar-hint">
                    Ce dossier est vide. Créez votre premier fichier Markdown.
                  </p>
                )}
              </nav>
            </>
          ) : (
            <div className="sidebar-empty">
              <FolderOpen size={28} />
              <p>Un espace pour vos idées.</p>
              <button className="secondary" onClick={openWorkspace}>
                Ouvrir un dossier
              </button>
              <p className="sidebar-hint">Vos fichiers restent sur votre ordinateur.</p>
            </div>
          )}
        </>
      )}
      <div className="sidebar-footer">
        <span className="local-dot" /> Espace local <span>Markdown Studio</span>
      </div>
    </aside>
  )
}
