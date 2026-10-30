import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { FileText, Command, Search } from 'lucide-react'
import { Modal } from './Modal'
import { matchesQuery } from '../services/workspace'
import type { FileNode } from '../../shared/types'
export interface StudioCommand {
  id: string
  label: string
  keywords?: string
  shortcut?: string
  disabled?: boolean
  run: () => void
}
export function CommandPalette({
  mode: initialMode,
  commands,
  files,
  openFile,
  close,
}: {
  mode: 'commands' | 'files'
  commands: StudioCommand[]
  files: FileNode[]
  openFile: (path: string) => void
  close: () => void
}) {
  const [mode, setMode] = useState(initialMode)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const prefix = useId()
  const list = useRef<HTMLDivElement>(null)
  const entries = useMemo(
    () =>
      (mode === 'commands'
        ? commands
            .filter(
              (command) =>
                !command.disabled &&
                matchesQuery(`${command.label} ${command.keywords ?? ''}`, query),
            )
            .map((command) => ({
              id: command.id,
              title: command.label,
              detail: command.shortcut,
              run: command.run,
            }))
        : files
            .filter((file) => matchesQuery(file.path, query))
            .map((file) => ({
              id: file.path,
              title: file.name,
              detail: file.path,
              run: () => openFile(file.path),
            }))
      ).slice(0, 50),
    [mode, query, commands, files, openFile],
  )
  const selected = Math.min(index, Math.max(0, entries.length - 1))
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [selected, query, mode])
  const choose = (position: number) => {
    const entry = entries[position]
    if (entry) {
      close()
      entry.run()
    }
  }
  return (
    <Modal title="Palette de commandes" close={close}>
      <div className="command-palette">
        <div className="palette-modes" role="group" aria-label="Type de navigation">
          <button
            aria-pressed={mode === 'commands'}
            onClick={() => {
              setMode('commands')
              setIndex(0)
            }}
          >
            <Command size={14} />
            Commandes
          </button>
          <button
            aria-pressed={mode === 'files'}
            onClick={() => {
              setMode('files')
              setIndex(0)
            }}
          >
            <FileText size={14} />
            Fichiers
          </button>
        </div>
        <div className="palette-input">
          <Search size={17} />
          <input
            autoFocus
            role="combobox"
            aria-label={mode === 'files' ? 'Rechercher un fichier' : 'Rechercher une commande'}
            aria-autocomplete="list"
            aria-controls={`${prefix}-list`}
            aria-expanded="true"
            aria-activedescendant={entries[selected] ? `${prefix}-${selected}` : undefined}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setIndex(0)
            }}
            placeholder={
              mode === 'files' ? 'Nom ou chemin d’un fichier…' : 'Que souhaitez-vous faire ?'
            }
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                setIndex((previous) =>
                  entries.length
                    ? (previous + (event.key === 'ArrowDown' ? 1 : -1) + entries.length) %
                      entries.length
                    : 0,
                )
              }
              if (event.key === 'Enter') {
                event.preventDefault()
                choose(selected)
              }
            }}
          />
        </div>
        <div
          className="palette-results"
          role="listbox"
          id={`${prefix}-list`}
          ref={list}
          aria-label="Résultats de navigation"
        >
          {entries.map((entry, position) => (
            <button
              role="option"
              aria-selected={position === selected}
              id={`${prefix}-${position}`}
              key={entry.id}
              onClick={() => choose(position)}
            >
              <span>{entry.title}</span>
              <small title={entry.detail}>{entry.detail}</small>
            </button>
          ))}
        </div>
        {!entries.length && (
          <p className="palette-empty">
            {mode === 'files' && !files.length
              ? 'Ouvrez un dossier pour parcourir ses fichiers.'
              : 'Aucun résultat.'}
          </p>
        )}
        <div className="palette-hint">
          ↑ ↓ Naviguer · Entrée Ouvrir · Échap Fermer
          {entries.length === 50 && ' · 50 résultats affichés'}
        </div>
      </div>
    </Modal>
  )
}
