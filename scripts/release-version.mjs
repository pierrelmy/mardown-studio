import semver from 'semver'
export function planVersion(base, commits) {
  if (!semver.valid(base)) throw new Error('Version de base invalide')
  if (!commits.length) return null
  let bump = 'patch'
  for (const commit of commits) {
    if (
      /^[\w-]+(?:\([^\n)]+\))?!:/.test(commit.subject) ||
      /^BREAKING[ -]CHANGE:/m.test(commit.body)
    ) {
      bump = 'major'
      break
    }
    if (/^feat(?:\([^\n)]+\))?:/.test(commit.subject)) bump = 'minor'
  }
  const version = semver.inc(base, bump)
  const escape = (value) => value.replace(/[\\`*_\[\]<>]/g, '\\$&').replace(/[\r\n]/g, ' ')
  const groups = [
    ['Nouveautés', /^feat(?:\(|!?:)/],
    ['Corrections', /^fix(?:\(|!?:)/],
    ['Autres changements', null],
  ]
  const remaining = [...commits]
  const sections = []
  for (const [title, pattern] of groups) {
    const matches = remaining.filter((commit) => !pattern || pattern.test(commit.subject))
    if (!matches.length) continue
    sections.push(
      `## ${title}\n\n${matches.map((commit) => `- ${escape(commit.subject)} (${commit.hash.slice(0, 7)})`).join('\n')}`,
    )
    for (const commit of matches) remaining.splice(remaining.indexOf(commit), 1)
  }
  return { version, bump, notes: `# Version ${version}\n\n${sections.join('\n\n')}\n` }
}
