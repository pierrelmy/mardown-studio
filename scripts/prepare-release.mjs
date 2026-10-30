import { execFileSync } from 'node:child_process'
import { readFile, writeFile, appendFile, mkdir } from 'node:fs/promises'
import semver from 'semver'
import { planVersion } from './release-version.mjs'

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
const pkg = JSON.parse(await readFile('package.json', 'utf8'))
const tags = git('tag', '--merged', 'HEAD', '--list', 'v*')
  .split('\n')
  .filter((tag) => semver.valid(tag) && !semver.prerelease(tag))
  .sort(semver.rcompare)
const allTags = git('tag', '--list', 'v*')
  .split('\n')
  .filter((tag) => semver.valid(tag) && !semver.prerelease(tag))
  .sort(semver.rcompare)
if (allTags[0] && !tags.includes(allTags[0])) {
  console.log('Un commit plus récent a déjà été publié ; cette exécution est obsolète.')
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, 'publish=false\nversion=\ntag=\n')
  await mkdir('release-plan', { recursive: true })
  await writeFile('release-plan/plan.json', JSON.stringify({ skipped: true }))
  process.exit(0)
}
const previous = tags[0] ?? null
const base = previous ? semver.valid(previous) : pkg.version
const range = previous ? `${previous}..HEAD` : 'HEAD'
const log = git('log', range, '--format=%H%x1f%s%x1f%b%x1e')
const commits = log
  .split('\x1e')
  .map((record) => record.trim())
  .filter(Boolean)
  .map((record) => {
    const [hash, subject, body = ''] = record.split('\x1f')
    return { hash, subject, body }
  })
const plan = planVersion(base, commits)
await mkdir('release-plan', { recursive: true })
await writeFile(
  'release-plan/plan.json',
  JSON.stringify({ ...plan, sha: git('rev-parse', 'HEAD'), previous }, null, 2),
)
if (plan) await writeFile('release-plan/notes.md', plan.notes)
if (process.env.GITHUB_OUTPUT)
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `publish=${Boolean(plan)}\nversion=${plan?.version ?? ''}\ntag=${plan ? `v${plan.version}` : ''}\n`,
  )
console.log(plan ? `Prochaine version : ${plan.version} (${plan.bump})` : 'Aucun commit à publier.')
