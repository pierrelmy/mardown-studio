import semver from 'semver'
import type { ReleaseNotes } from '../../shared/updates'
export interface GitHubRelease {
  tag_name: string
  body: string | null
  published_at: string | null
  draft: boolean
  prerelease: boolean
}
export function releasesBetween(
  releases: GitHubRelease[],
  current: string,
  latest: string,
): ReleaseNotes[] {
  const seen = new Set<string>()
  return releases
    .flatMap((release) => {
      const version = semver.valid(release.tag_name)
      if (
        !version ||
        release.draft ||
        release.prerelease ||
        semver.prerelease(version) ||
        !semver.gt(version, current) ||
        semver.gt(version, latest) ||
        seen.has(version)
      )
        return []
      seen.add(version)
      return [
        {
          version,
          notes: release.body?.trim() || 'Aucune note de version disponible.',
          publishedAt: release.published_at,
        },
      ]
    })
    .sort((a, b) => semver.rcompare(a.version, b.version))
}
export async function fetchReleaseNotes(
  repository: string,
  current: string,
  latest: string,
  request: typeof fetch = fetch,
): Promise<ReleaseNotes[]> {
  if (
    !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]+$/.test(repository) ||
    ['.', '..'].includes(repository.split('/')[1])
  )
    throw new Error('Dépôt de mise à jour invalide.')
  const releases: GitHubRelease[] = []
  for (let page = 1; page <= 100; page++) {
    const response = await request(
      `https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`,
      {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Markdown-Studio' },
        signal: AbortSignal.timeout(15000),
      },
    )
    if (!response.ok)
      throw new Error(
        response.status === 404
          ? 'Les releases sont inaccessibles. Vérifiez que le dépôt de distribution est public.'
          : `Impossible de charger le changelog GitHub (HTTP ${response.status}).`,
      )
    const payload: unknown = await response.json()
    if (
      !Array.isArray(payload) ||
      payload.some(
        (value) =>
          !value ||
          typeof value.tag_name !== 'string' ||
          (value.body !== null && typeof value.body !== 'string'),
      )
    )
      throw new Error('Réponse GitHub invalide.')
    releases.push(...(payload as GitHubRelease[]))
    if (payload.length < 100) return releasesBetween(releases, current, latest)
  }
  throw new Error('Historique trop volumineux : le changelog complet n’a pas pu être chargé.')
}
