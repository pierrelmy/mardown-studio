import {
  Columns2,
  PanelLeftClose,
  PanelLeftOpen,
  Code2,
  Eye,
  Sun,
  Moon,
  Save,
  FilePlus2,
  FolderOpen,
  FileUp,
  Download,
} from 'lucide-react'
import type { Preferences, ViewMode } from '../../shared/types'
export function Toolbar({
  preferences,
  update,
  save,
  openFile,
  openFolder,
  create,
  exportDocument,
  hasDocument,
}: {
  preferences: Preferences
  update: (patch: Partial<Preferences>) => void
  save: () => void
  openFile: () => void
  openFolder: () => void
  create: () => void
  exportDocument: () => void
  hasDocument: boolean
}) {
  const modes: { mode: ViewMode; label: string; icon: typeof Eye }[] = [
    { mode: 'editor', label: 'Éditeur', icon: Code2 },
    { mode: 'split', label: 'Vue partagée', icon: Columns2 },
    { mode: 'preview', label: 'Aperçu', icon: Eye },
  ]
  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark">
          M<span>↓</span>
        </span>
        <span>
          Markdown <strong>Studio</strong>
        </span>
      </div>
      <div className="toolbar-actions">
        <button
          title="Afficher / masquer l’explorateur"
          aria-label="Afficher / masquer l’explorateur"
          onClick={() => update({ sidebar: !preferences.sidebar })}
        >
          {preferences.sidebar ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
        </button>
        <span className="separator" />
        <button
          title="Ouvrir un fichier · ⌘/Ctrl O"
          aria-label="Ouvrir un fichier"
          onClick={openFile}
        >
          <FileUp size={17} />
        </button>
        <button title="Ouvrir un dossier" aria-label="Ouvrir un dossier" onClick={openFolder}>
          <FolderOpen size={17} />
        </button>
        <button title="Nouveau document · ⌘/Ctrl N" aria-label="Nouveau document" onClick={create}>
          <FilePlus2 size={17} />
        </button>
        <button
          disabled={!hasDocument}
          title="Enregistrer · ⌘/Ctrl S"
          aria-label="Enregistrer"
          onClick={save}
        >
          <Save size={17} />
        </button>
      </div>
      <div className="view-switch" role="group" aria-label="Mode d’affichage">
        {modes.map(({ mode, label, icon: Icon }) => (
          <button
            key={mode}
            title={label}
            aria-label={label}
            aria-pressed={preferences.mode === mode}
            className={preferences.mode === mode ? 'selected' : ''}
            onClick={() => update({ mode })}
          >
            <Icon size={16} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      <div className="toolbar-end">
        <button
          title="Exporter"
          aria-label="Exporter"
          disabled={!hasDocument}
          onClick={exportDocument}
        >
          <Download size={17} />
        </button>
        <button
          title="Changer le thème"
          aria-label="Changer le thème"
          onClick={() => update({ theme: preferences.theme === 'dark' ? 'light' : 'dark' })}
        >
          {preferences.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
    </header>
  )
}
