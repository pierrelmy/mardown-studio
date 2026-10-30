export interface CommitInfo {
  hash: string
  subject: string
  body: string
}
export function planVersion(
  base: string,
  commits: CommitInfo[],
): { version: string; bump: 'major' | 'minor' | 'patch'; notes: string } | null
