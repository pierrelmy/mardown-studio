import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { relative } from 'node:path'

const coverage = JSON.parse(await readFile('coverage/coverage-summary.json', 'utf8'))
const metrics = ['lines', 'statements', 'functions', 'branches']
const escape = (value) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('|', '&#124;')
    .replaceAll('`', '&#96;')
    .replaceAll(/[\r\n]/g, ' ')
const row = (label, summary) =>
  `| ${label} | ${metrics.map((key) => `${summary[key].pct}% (${summary[key].covered}/${summary[key].total})`).join(' | ')} |`
const report = [
  '## Couverture des tests unitaires',
  '',
  'Tous les fichiers TypeScript de production sont inclus, même sans test. Les tests Electron de bout en bout sont exécutés séparément et ne contribuent pas à ces pourcentages.',
  '',
  '| Fichier | Lignes | Instructions | Fonctions | Branches |',
  '| --- | --- | --- | --- | --- |',
  row('**Total**', coverage.total),
  ...Object.entries(coverage)
    .filter(([file]) => file !== 'total')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, summary]) =>
      row(escape(relative(process.cwd(), file).replaceAll('\\', '/')), summary),
    ),
  '',
  'Le rapport détaillé HTML, LCOV et JSON est disponible dans l’artefact **coverage-report** de cette exécution. Décompressez-le puis ouvrez `index.html`.',
  '',
].join('\n')

await writeFile('coverage/summary.md', report)
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report)
else console.log(report)
