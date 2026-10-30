import DOMPurify from 'dompurify'
import { useEffect, useRef, useState } from 'react'
import { Download, RefreshCw, RotateCw, ArrowUpRight, Bell } from 'lucide-react'
import { Modal } from './Modal'
import { renderMarkdown } from '../services/markdown'
import type { UpdateState } from '../../shared/updates'
import { unwrap } from '../hooks/useStudio'

export function UpdateCenter({ prepareForQuit }: { prepareForQuit: () => Promise<boolean> }) {
  const [state, setState] = useState<UpdateState | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const announced = useRef<string | null>(null)
  useEffect(() => {
    let alive = true
    const receive = (value: UpdateState) => {
      if (!alive) return
      setState(value)
      if (
        value.phase === 'available' &&
        value.latestVersion !== announced.current &&
        !document.querySelector('dialog[open]')
      ) {
        announced.current = value.latestVersion
        setOpen(true)
      }
    }
    const unlisten = window.studio.onUpdateState(receive)
    void window.studio.updateState().then((result) => {
      if (result.ok) receive(result.value)
    })
    return () => {
      alive = false
      unlisten()
    }
  }, [])
  const perform = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      setBusy(false)
    }
  }
  if (!state) return null
  const working = busy || ['checking', 'downloading', 'installing'].includes(state.phase)
  const pending = ['available', 'downloaded'].includes(state.phase)
  return (
    <>
      <button
        className={`update-trigger ${pending ? 'has-update' : ''}`}
        title="Versions et mises à jour"
        aria-label="Versions et mises à jour"
        onClick={() => setOpen(true)}
      >
        <Bell size={14} />
        <span>v{state.currentVersion}</span>
        {pending && <span className="dirty-dot" />}
      </button>
      {open && (
        <Modal
          title="Versions et mises à jour"
          close={() => {
            if (!working) setOpen(false)
          }}
        >
          <div className="update-center">
            <div className="update-version">
              <span>VERSION INSTALLÉE</span>
              <strong>{state.currentVersion}</strong>
              {state.latestVersion && (
                <>
                  <span>→</span>
                  <strong className="update-new-version">{state.latestVersion}</strong>
                </>
              )}
            </div>
            <p role="status">
              {state.phase === 'checking'
                ? 'Recherche d’une nouvelle version…'
                : state.phase === 'current'
                  ? 'Votre application est à jour.'
                  : state.phase === 'available'
                    ? 'Une nouvelle version est disponible.'
                    : state.phase === 'downloading'
                      ? 'Téléchargement de la mise à jour…'
                      : state.phase === 'downloaded'
                        ? 'La mise à jour est prête. Vos documents seront vérifiés avant le redémarrage.'
                        : state.phase === 'installing'
                          ? 'Installation et redémarrage…'
                          : state.phase === 'unavailable'
                            ? state.installationNotice
                            : state.phase === 'error'
                              ? state.message
                              : 'Recherchez les dernières nouveautés de Markdown Studio.'}
            </p>
            {state.phase === 'downloading' && (
              <div className="update-progress">
                <progress
                  max={100}
                  value={state.progress}
                  aria-label="Téléchargement de la mise à jour"
                />
                <span>{Math.round(state.progress)} %</span>
              </div>
            )}
            {state.installationNotice && state.phase !== 'unavailable' && (
              <p className="update-notice">{state.installationNotice}</p>
            )}
            {error && (
              <p className="preview-error" role="alert">
                {error}
              </p>
            )}
            {!!state.releases.length && (
              <div className="release-history" aria-label="Changements depuis la version installée">
                {state.releases.map((release) => (
                  <section key={release.version}>
                    <header>
                      <strong>Version {release.version}</strong>
                      {release.publishedAt && (
                        <time dateTime={release.publishedAt}>
                          {new Date(release.publishedAt).toLocaleDateString('fr-CA')}
                        </time>
                      )}
                    </header>
                    <article
                      className="prose release-notes"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(renderMarkdown(release.notes), {
                          FORBID_TAGS: ['img'],
                        }),
                      }}
                      onClick={(event) => {
                        const link = (event.target as Element).closest('a')
                        if (link) {
                          event.preventDefault()
                          const href = link.getAttribute('href') ?? ''
                          if (/^https?:/i.test(href)) void window.studio.external(href)
                        }
                      }}
                    />
                  </section>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button
                className="secondary"
                onClick={() => {
                  void window.studio.external(state.releaseURL)
                }}
              >
                <ArrowUpRight size={14} />
                GitHub Releases
              </button>
              <button
                className="secondary"
                disabled={working || state.phase === 'unavailable'}
                onClick={() => {
                  void perform(async () => setState(unwrap(await window.studio.checkUpdate())))
                }}
              >
                <RefreshCw size={14} />
                Vérifier
              </button>
              {state.phase === 'available' && state.canInstall && (
                <button
                  className="primary"
                  disabled={working}
                  onClick={() => {
                    void perform(async () => setState(unwrap(await window.studio.downloadUpdate())))
                  }}
                >
                  <Download size={14} />
                  Télécharger la mise à jour
                </button>
              )}
              {state.phase === 'downloaded' && (
                <button
                  className="primary"
                  disabled={working}
                  onClick={() => {
                    void perform(async () => {
                      if (await prepareForQuit()) unwrap(await window.studio.installUpdate())
                    })
                  }}
                >
                  <RotateCw size={14} />
                  Installer et relancer
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
