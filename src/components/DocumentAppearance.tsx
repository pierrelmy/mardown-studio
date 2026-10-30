import type { CSSProperties } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import { Modal } from './Modal'
import {
  defaultDocumentAppearance,
  documentThemes,
  documentVariables,
  type DocumentAppearance,
} from '../../shared/document-themes'

export function DocumentAppearancePanel({
  appearance,
  update,
  close,
}: {
  appearance: DocumentAppearance
  update: (patch: Partial<DocumentAppearance>) => void
  close: () => void
}) {
  return (
    <Modal title="Style du document" close={close}>
      <div className="appearance-settings">
        <p className="appearance-intro">
          Choisissez une identité pour vos documents. Ces réglages s’appliquent à l’aperçu et aux
          exports HTML et PDF, et sont conservés entre les sessions.
        </p>
        <div className="theme-gallery" role="group" aria-label="Thèmes de document">
          {documentThemes.map((theme) => (
            <button
              key={theme.id}
              className={`theme-card ${appearance.documentTheme === theme.id ? 'selected' : ''}`}
              aria-label={`Thème ${theme.name}`}
              aria-pressed={appearance.documentTheme === theme.id}
              onClick={() => update({ documentTheme: theme.id })}
            >
              <div
                className="theme-specimen document-surface"
                style={
                  documentVariables({ ...appearance, documentTheme: theme.id }) as CSSProperties
                }
              >
                <span className="specimen-caption">MARKDOWN STUDIO</span>
                <strong>Les idées prennent forme.</strong>
                <span className="specimen-rule" />
                <span className="specimen-text">Un espace pour écrire, explorer et partager.</span>
                <code>const idée = 'demain'</code>
              </div>
              <div className="theme-card-label">
                <strong>{theme.name}</strong>
                {appearance.documentTheme === theme.id && <Check size={15} />}
              </div>
              <span className="theme-description">{theme.description}</span>
            </button>
          ))}
        </div>
        <div className="appearance-controls">
          <label>
            Taille du texte <output>{appearance.documentFontSize} px</output>
            <input
              aria-label="Taille du texte"
              type="range"
              min="12"
              max="24"
              step="1"
              value={appearance.documentFontSize}
              onChange={(event) => update({ documentFontSize: Number(event.target.value) })}
            />
          </label>
          <label>
            Interligne <output>{appearance.documentLineHeight.toFixed(2)}</output>
            <input
              aria-label="Interligne"
              type="range"
              min="1.4"
              max="2.2"
              step="0.05"
              value={appearance.documentLineHeight}
              onChange={(event) => update({ documentLineHeight: Number(event.target.value) })}
            />
          </label>
          <label>
            Largeur de lecture
            <select
              aria-label="Largeur de lecture"
              value={appearance.documentWidth}
              onChange={(event) =>
                update({ documentWidth: event.target.value as DocumentAppearance['documentWidth'] })
              }
            >
              <option value="narrow">Étroite · 640 px</option>
              <option value="standard">Standard · 820 px</option>
              <option value="wide">Large · 1040 px</option>
            </select>
          </label>
          <PageSizeControl appearance={appearance} update={update} />
        </div>
        <div className="appearance-note">
          Le style de vos fichiers Markdown reste indépendant du contenu. Le format papier concerne
          uniquement les exports PDF.
        </div>
        <div className="modal-actions">
          <button className="secondary" onClick={() => update(defaultDocumentAppearance)}>
            <RotateCcw size={14} />
            Réinitialiser
          </button>
          <button className="primary" onClick={close}>
            Terminé
          </button>
        </div>
      </div>
    </Modal>
  )
}
export function PageSizeControl({
  appearance,
  update,
  disabled = false,
}: {
  appearance: DocumentAppearance
  update: (patch: Partial<DocumentAppearance>) => void
  disabled?: boolean
}) {
  return (
    <label>
      Format du PDF
      <select
        aria-label="Format du PDF"
        disabled={disabled}
        value={appearance.exportPageSize}
        onChange={(event) =>
          update({ exportPageSize: event.target.value as DocumentAppearance['exportPageSize'] })
        }
      >
        <option value="A4">A4 · 210 × 297 mm</option>
        <option value="Letter">Letter · 8,5 × 11 pouces</option>
      </select>
    </label>
  )
}
