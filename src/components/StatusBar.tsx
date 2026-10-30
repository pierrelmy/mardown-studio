import { Check, Circle, LoaderCircle, AlertCircle } from 'lucide-react'
import type { Tab } from './Tabs'
export function StatusBar({
  tab,
  autosave,
  toggleAutosave,
}: {
  tab?: Tab
  autosave: boolean
  toggleAutosave: () => void
}) {
  const content = tab?.content ?? ''
  const state = tab?.state ?? 'saved'
  return (
    <footer className="statusbar">
      <span className="status-brand">
        M↓ <span>Markdown</span>
      </span>
      <span className={`save-status ${state}`}>
        {state === 'saving' ? (
          <LoaderCircle size={12} className="spin" />
        ) : state === 'error' || state === 'conflict' ? (
          <AlertCircle size={12} />
        ) : state === 'dirty' ? (
          <Circle size={10} />
        ) : (
          <Check size={12} />
        )}
        {state === 'saving'
          ? 'Enregistrement…'
          : state === 'conflict'
            ? 'Conflit sur disque'
            : state === 'error'
              ? 'Échec de sauvegarde'
              : state === 'dirty'
                ? 'Modifications en attente'
                : 'Enregistré'}
      </span>
      <button className="autosave" aria-pressed={autosave} onClick={toggleAutosave}>
        Autosave {autosave ? 'activé' : 'désactivé'}
      </button>
      <div className="stats">
        <span>{content.trim() ? content.trim().split(/\s+/u).length : 0} mots</span>
        <span>{[...content].length} caractères</span>
        <span>{content.split('\n').length} lignes</span>
        <span>UTF-8</span>
      </div>
    </footer>
  )
}
