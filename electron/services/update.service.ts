import semver from 'semver'
import type { ReleaseNotes, UpdateState } from '../../shared/updates'
export interface UpdateBackend {
  check(): Promise<string | null>
  download(): Promise<void>
  install(): void | Promise<void>
  onProgress(callback: (percent: number) => void): void
  onError(callback: (message: string) => void): void
}
export class UpdateService {
  private state: UpdateState
  private active: Promise<UpdateState> | null = null
  constructor(
    private backend: UpdateBackend,
    private notes: (current: string, latest: string) => Promise<ReleaseNotes[]>,
    private notify: (state: UpdateState) => void,
    options: {
      version: string
      repository: string
      packaged: boolean
      canInstall: boolean
      reason?: string
    },
  ) {
    this.state = {
      currentVersion: options.version,
      phase: options.packaged ? 'idle' : 'unavailable',
      latestVersion: null,
      releases: [],
      progress: 0,
      message: options.reason ?? null,
      installationNotice: options.reason ?? null,
      canInstall: options.canInstall,
      releaseURL: `https://github.com/${options.repository}/releases`,
    }
    backend.onProgress((percent) => {
      if (this.state.phase === 'downloading')
        this.set({ progress: Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0 })
    })
    backend.onError((message) => {
      if (this.state.phase !== 'unavailable') this.set({ phase: 'error', message })
    })
  }
  snapshot(): UpdateState {
    return structuredClone(this.state)
  }
  private set(patch: Partial<UpdateState>): UpdateState {
    this.state = { ...this.state, ...patch }
    const snapshot = this.snapshot()
    this.notify(snapshot)
    return snapshot
  }
  async check(): Promise<UpdateState> {
    if (this.active) return this.active
    if (['unavailable', 'downloaded', 'installing'].includes(this.state.phase))
      return this.snapshot()
    this.active = (async () => {
      this.set({ phase: 'checking', message: null })
      try {
        const latest = await this.backend.check()
        if (!latest || !semver.valid(latest) || !semver.gt(latest, this.state.currentVersion))
          return this.set({ phase: 'current', latestVersion: null, releases: [] })
        const releases = await this.notes(this.state.currentVersion, latest)
        if (!releases.some((release) => release.version === semver.valid(latest)))
          throw new Error(
            'Le changelog de la dernière version est indisponible. Réessayez plus tard.',
          )
        return this.set({ phase: 'available', latestVersion: latest, releases, progress: 0 })
      } catch (error) {
        return this.set({
          phase: 'error',
          message: error instanceof Error ? error.message : 'La vérification a échoué.',
        })
      }
    })()
    try {
      return await this.active
    } finally {
      this.active = null
    }
  }
  async download(): Promise<UpdateState> {
    if (this.active) return this.active
    if (!this.state.canInstall || this.state.phase !== 'available')
      throw new Error('Aucune mise à jour installable n’est prête au téléchargement.')
    this.active = (async () => {
      this.set({ phase: 'downloading', progress: 0, message: null })
      try {
        await this.backend.download()
        return this.set({ phase: 'downloaded', progress: 100 })
      } catch (error) {
        return this.set({
          phase: 'error',
          message: error instanceof Error ? error.message : 'Le téléchargement a échoué.',
        })
      }
    })()
    try {
      return await this.active
    } finally {
      this.active = null
    }
  }
  async install(): Promise<void> {
    if (!this.state.canInstall || this.state.phase !== 'downloaded')
      throw new Error('Téléchargez la mise à jour avant de l’installer.')
    this.set({ phase: 'installing' })
    try {
      await this.backend.install()
    } catch (error) {
      this.set({
        phase: 'error',
        message: error instanceof Error ? error.message : 'Installation impossible.',
      })
      throw error
    }
  }
}
