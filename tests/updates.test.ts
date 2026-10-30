import { describe, expect, it, vi } from 'vitest'
import { UpdateService, type UpdateBackend } from '../electron/services/update.service'
import { releasesBetween, fetchReleaseNotes } from '../electron/services/release-notes.service'
import { planVersion } from '../scripts/release-version.mjs'
function fixture(overrides: Partial<UpdateBackend> = {}) {
  let progress = (_value: number) => {}
  let failure = (_value: string) => {}
  const backend: UpdateBackend = {
    check: vi.fn(async () => '1.2.0'),
    download: vi.fn(async () => {}),
    install: vi.fn(),
    onProgress: (cb) => {
      progress = cb
    },
    onError: (cb) => {
      failure = cb
    },
    ...overrides,
  }
  const notes = vi.fn(async () => [
    { version: '1.2.0', notes: 'Nouveautés', publishedAt: null },
    { version: '1.1.0', notes: 'Corrections', publishedAt: null },
  ])
  const service = new UpdateService(backend, notes, vi.fn(), {
    version: '1.0.0',
    repository: 'pierrelmy/mardown-studio',
    packaged: true,
    canInstall: true,
  })
  return {
    backend,
    notes,
    service,
    progress: (value: number) => progress(value),
    failure: (value: string) => failure(value),
  }
}
describe('version planning', () => {
  const commit = (subject: string, body = '') => ({ hash: 'abc1234567', subject, body })
  it('bumps every commit, including maintenance changes', () => {
    expect(planVersion('1.2.3', [commit('docs: improve guide')])?.version).toBe('1.2.4')
    expect(planVersion('1.2.3', [commit('fix: bug'), commit('feat(ui): themes')])?.version).toBe(
      '1.3.0',
    )
    expect(planVersion('1.2.3', [commit('feat!: new format')])?.version).toBe('2.0.0')
    expect(
      planVersion('1.2.3', [commit('chore: migration', 'BREAKING CHANGE: removed API')])?.version,
    ).toBe('2.0.0')
    expect(planVersion('1.2.3', [])).toBeNull()
    expect(() => planVersion('oops', [commit('fix: bug')])).toThrow()
  })
  it('includes all commit subjects and escapes Markdown content', () => {
    const result = planVersion('0.1.0', [
      commit('feat: preview'),
      commit('fix: save'),
      commit('test: <script>'),
    ])!
    expect(result.notes).toContain('Nouveautés')
    expect(result.notes).toContain('Corrections')
    expect(result.notes).toContain('Autres changements')
    expect(result.notes).not.toContain('<script>')
    expect(result.notes).toContain('abc1234')
  })
})
describe('complete release history', () => {
  const release = (tag_name: string, body = 'notes') => ({
    tag_name,
    body,
    draft: false,
    prerelease: false,
    published_at: null,
  })
  it('sorts SemVer and includes every intermediate stable version exactly once', () => {
    const releases = [
      release('v1.2.0'),
      release('v1.10.0'),
      release('v1.1.0'),
      release('v1.2.0'),
      release('v2.0.0'),
      release('bad'),
      { ...release('v1.9.0'), draft: true },
      { ...release('v1.8.0-beta.1'), prerelease: true },
    ]
    expect(releasesBetween(releases, '1.1.0', '1.10.0').map((value) => value.version)).toEqual([
      '1.10.0',
      '1.2.0',
    ])
  })
  it('paginates instead of dropping releases beyond the first page', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(Array.from({ length: 100 }, () => release('v1.2.0')))),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([release('v1.1.0', '')])))
    const notes = await fetchReleaseNotes('owner/repo', '1.0.0', '1.2.0', request)
    expect(request).toHaveBeenCalledTimes(2)
    expect(notes.map((value) => value.version)).toEqual(['1.2.0', '1.1.0'])
    expect(notes[1].notes).toContain('Aucune note')
  })
  it('reports network, permission and malformed responses without inventing notes', async () => {
    await expect(fetchReleaseNotes('../bad', '1.0.0', '1.1.0')).rejects.toThrow('invalide')
    await expect(
      fetchReleaseNotes(
        'owner/repo',
        '1.0.0',
        '1.1.0',
        vi.fn().mockResolvedValue(new Response('', { status: 404 })),
      ),
    ).rejects.toThrow('inaccessibles')
    await expect(
      fetchReleaseNotes(
        'owner/repo',
        '1.0.0',
        '1.1.0',
        vi.fn().mockResolvedValue(new Response('{}')),
      ),
    ).rejects.toThrow('invalide')
  })
})
describe('update state machine', () => {
  it('checks, loads changelogs, downloads with progress, then installs only on explicit request', async () => {
    const f = fixture()
    await expect(f.service.install()).rejects.toThrow()
    expect((await f.service.check()).phase).toBe('available')
    expect(f.notes).toHaveBeenCalledWith('1.0.0', '1.2.0')
    const download = f.service.download()
    f.progress(52)
    expect(f.service.snapshot().progress).toBe(52)
    await download
    expect(f.backend.install).not.toHaveBeenCalled()
    expect(f.service.snapshot().phase).toBe('downloaded')
    await f.service.install()
    expect(f.backend.install).toHaveBeenCalledOnce()
    expect(f.service.snapshot().phase).toBe('installing')
  })
  it('deduplicates checks and never downgrades or installs on network failure', async () => {
    const f = fixture({ check: vi.fn(async () => '0.9.0') })
    await Promise.all([f.service.check(), f.service.check()])
    expect(f.backend.check).toHaveBeenCalledOnce()
    expect(f.service.snapshot().phase).toBe('current')
    const broken = fixture({
      check: vi.fn(async () => {
        throw new Error('offline')
      }),
    })
    expect((await broken.service.check()).phase).toBe('error')
    expect(broken.backend.download).not.toHaveBeenCalled()
  })
  it('keeps incomplete changelogs and failed downloads from being installed', async () => {
    const f = fixture({
      download: vi.fn(async () => {
        throw new Error('checksum mismatch')
      }),
    })
    f.notes.mockResolvedValueOnce([])
    expect((await f.service.check()).phase).toBe('error')
    await expect(f.service.download()).rejects.toThrow()
    await f.service.check()
    expect((await f.service.download()).message).toBe('checksum mismatch')
    await expect(f.service.install()).rejects.toThrow()
  })
  it('disables development installs and preserves safe snapshots', async () => {
    const f = fixture()
    const disabled = new UpdateService(fixture().backend, f.notes, vi.fn(), {
      version: '1.0.0',
      repository: 'owner/repo',
      packaged: false,
      canInstall: false,
    })
    expect((await disabled.check()).phase).toBe('unavailable')
    expect(f.backend.check).not.toHaveBeenCalled()
    await expect(disabled.download()).rejects.toThrow()
    await f.service.check()
    f.service.snapshot().releases.length = 0
    expect(f.service.snapshot().releases).toHaveLength(2)
    f.failure('failure')
    expect(f.service.snapshot().phase).toBe('error')
  })
})
