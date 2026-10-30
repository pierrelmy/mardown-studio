import { _electron as electron, expect } from '@playwright/test'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import assert from 'node:assert/strict'

const root = await fs.mkdtemp(join(tmpdir(), 'markdown-studio-desktop-'))
const workspace = join(root, 'workspace')
const profile = join(root, 'profile')
await fs.mkdir(workspace)
await fs.mkdir(profile)
const file = join(workspace, 'Guide.md')
const second = join(workspace, 'Deuxième.md')
const initial =
  '# Bonjour Studio\n\nUne **idée** à développer.\n\n| Colonne | Valeur |\n| --- | --- |\n| Test | OK |\n\n- [x] Terminé\n\n```typescript\nconst answer = 42\n```\n\n$$\nx^2 + y^2 = z^2\n$$\n\n```mermaid\ngraph LR\n A[Idée] --> B[Document]\n```\n\n<img src=x onerror="alert(1)">\n'
await fs.writeFile(file, initial)
await fs.writeFile(second, '# Deuxième document\n')
await fs.writeFile(
  join(workspace, 'pixel.png'),
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4XcAAAAASUVORK5CYII=',
    'base64',
  ),
)
const env = { ...process.env, STUDIO_TEST_USER_DATA: profile }
delete env.ELECTRON_RUN_AS_NODE
let app
let page
const errors = []
const launch = async () => {
  app = await electron.launch({ args: [resolve('.')], env })
  page = await app.firstWindow()
  page.on('pageerror', (error) => errors.push(error.message))
  await expect(page.locator('.app-body')).toHaveAttribute('aria-busy', 'false')
}
const openChoice = async (path) =>
  app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
  }, path)
const saveChoice = async (path) =>
  app.evaluate(({ dialog }, path) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: path })
  }, path)
const editor = () => page.locator('.cm-content')
const edit = async (text) => {
  await editor().fill(text)
}
const waitDisk = async (text) => expect.poll(() => fs.readFile(file, 'utf8')).toBe(text)
try {
  await launch()
  assert.equal(await app.evaluate(({ app }) => app.getPath('userData')), profile)
  const security = await app.evaluate(({ BrowserWindow }) => {
    const prefs = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()
    return {
      contextIsolation: prefs.contextIsolation,
      nodeIntegration: prefs.nodeIntegration,
      sandbox: prefs.sandbox,
    }
  })
  assert.deepEqual(security, { contextIsolation: true, nodeIntegration: false, sandbox: true })
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined')
  await openChoice(workspace)
  await page.getByRole('button', { name: 'Ouvrir un dossier', exact: true }).first().click()
  await page.getByRole('button', { name: 'Guide.md', exact: true }).click()
  await expect(page.locator('.prose h1')).toHaveText('Bonjour Studio')
  await expect(page.locator('.prose table')).toHaveCount(1)
  await expect(page.locator('.prose .katex')).toHaveCount(1)
  assert.ok(
    (await page.locator('.prose .katex [style]').count()) > 0,
    'KaTeX positioning styles must survive sanitization',
  )
  await expect(page.locator('.prose .mermaid-diagram svg')).toHaveCount(1)
  await expect(page.locator('.prose .hljs-keyword')).toHaveCount(1)
  await expect(page.locator('.prose img')).toHaveCount(0)
  console.log('OK desktop, sécurité, workspace, Markdown, code, KaTeX, Mermaid et HTML brut')

  const updated = initial + '\nTexte sauvegardé automatiquement.\n\n![Pixel](pixel.png)\n'
  await edit(updated)
  await waitDisk(updated)
  await expect(page.locator('.save-status')).toHaveText('Enregistré')
  await expect
    .poll(() => page.locator('.prose img').evaluate((img) => img.complete && img.naturalWidth > 0))
    .toBe(true)
  await page.getByRole('button', { name: 'Deuxième.md', exact: true }).click()
  await expect(editor()).toContainText('Deuxième document')
  await page.getByRole('tab', { name: 'Guide.md', exact: true }).click()
  await expect(editor()).toContainText('Texte sauvegardé automatiquement.')
  await page.getByRole('button', { name: 'Éditeur', exact: true }).click()
  await expect(page.locator('.preview-panel')).toHaveCount(0)
  await page.getByRole('button', { name: 'Aperçu', exact: true }).click()
  await expect(page.locator('.editor-panel')).toHaveCount(0)
  await page.getByRole('button', { name: 'Vue partagée', exact: true }).click()
  const separator = page.getByRole('separator')
  await separator.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(separator).toHaveAttribute('aria-valuenow', '48')
  await page.getByRole('button', { name: 'Changer le thème' }).click()
  await expect(page.locator('.app')).toHaveAttribute('data-theme', 'light')
  console.log('OK autosave, images locales, onglets, modes, redimensionnement et thème')

  await fs.writeFile(file, '# Changement externe propre\n')
  await expect(editor()).toContainText('Changement externe propre', { timeout: 10000 })
  await page.getByRole('button', { name: 'Autosave activé' }).click()
  await edit('# Mon brouillon local\n')
  await fs.writeFile(file, '# Autre application\n')
  await expect(page.locator('.conflict-banner')).toBeVisible({ timeout: 10000 })
  await expect(editor()).toContainText('Mon brouillon local')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  assert.equal(await fs.readFile(file, 'utf8'), '# Autre application\n')
  await page.getByRole('button', { name: 'Recharger', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Recharger', exact: true }).click()
  await expect(editor()).toContainText('Autre application')
  await edit('# Modifications à préserver\n')
  await page.getByRole('button', { name: 'Fermer Guide.md', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Annuler', exact: true }).click()
  await expect(editor()).toContainText('Modifications à préserver')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await waitDisk('# Modifications à préserver\n')
  console.log('OK mises à jour externes, conflits, sauvegarde manuelle et fermeture protégée')

  await page.getByRole('button', { name: 'Créer un fichier dans le workspace' }).click()
  await page.getByRole('textbox', { name: 'Nom' }).fill('Création')
  await page.getByRole('button', { name: 'Créer', exact: true }).click()
  await expect(editor()).toHaveText('')
  const created = join(workspace, 'Création.md')
  assert.equal(await fs.readFile(created, 'utf8'), '')
  await page.getByRole('button', { name: 'Actions pour Création.md' }).click()
  await page.getByRole('button', { name: 'Renommer', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nom' }).fill('Renommé.md')
  await page.getByRole('dialog').getByRole('button', { name: 'Renommer', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Renommé.md', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Créer un dossier dans le workspace' }).click()
  await page.getByRole('textbox', { name: 'Nom' }).fill('Notes')
  await page.getByRole('button', { name: 'Créer', exact: true }).click()
  assert.equal((await fs.stat(join(workspace, 'Notes'))).isDirectory(), true)
  // Cancel deletion through the same native confirmation used in production.
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 0, checkboxChecked: false })
  })
  await page.getByRole('button', { name: 'Actions pour Renommé.md' }).click()
  await page.getByRole('button', { name: 'Supprimer…', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Renommé.md', exact: true })).toBeVisible()
  console.log('OK création fichier/dossier, renommage et annulation de suppression')

  await page.getByRole('tab', { name: 'Guide.md', exact: true }).click()
  await edit(initial + '\n![Pixel](pixel.png)\n')
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await waitDisk(initial + '\n![Pixel](pixel.png)\n')
  await expect(page.locator('[data-preview]')).toHaveAttribute('aria-busy', 'false')
  const htmlPath = join(root, 'export.html')
  await saveChoice(htmlPath)
  await page.getByRole('button', { name: 'Exporter', exact: true }).click()
  await page.getByRole('button', { name: 'Exporter HTML', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 15000 })
  const html = await fs.readFile(htmlPath, 'utf8')
  assert.ok(html.includes('data:image/png;base64,'))
  assert.ok(
    html.includes('data:font/woff2;base64,') ||
      html.includes('data:application/font-woff;base64,') ||
      /url\(data:/.test(html),
  )
  assert.ok(html.includes('<svg'))
  assert.ok(!html.includes('<script'))
  const pdfPath = join(root, 'export.pdf')
  await saveChoice(pdfPath)
  await page.getByRole('button', { name: 'Exporter', exact: true }).click()
  await page.getByRole('button', { name: 'Exporter PDF', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 15000 })
  assert.equal((await fs.readFile(pdfPath)).subarray(0, 5).toString(), '%PDF-')
  console.log('OK exports HTML autonome et PDF avec formules/diagrammes/images')

  await page.screenshot({ path: join(root, 'studio-light.png') })
  await page.getByRole('button', { name: 'Changer le thème' }).click()
  await page.screenshot({ path: join(root, 'studio-dark.png') })
  // Flush and close using the real renderer handshake.
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
  await app.waitForEvent('close')
  app = null
  await launch()
  await expect(page.getByRole('tab')).toHaveCount(3)
  await expect(page.getByRole('tab', { name: 'Guide.md', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.locator('.app')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('separator')).toHaveAttribute('aria-valuenow', '48')
  await expect(page.getByRole('button', { name: 'Autosave désactivé' })).toBeVisible()
  const denied = await page.evaluate(() => window.studio.read('/etc/passwd'))
  assert.equal(denied.ok, false)
  assert.deepEqual(errors, [])
  console.log('OK fermeture, restauration session/préférences et refus IPC non autorisé')
  await page.getByRole('button', { name: 'Nouveau document', exact: true }).click()
  await edit('# Brouillon sans chemin\n')
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Annuler', exact: true }).click()
  await expect(editor()).toContainText('Brouillon sans chemin')
  const draftPath = join(root, 'Brouillon.md')
  await saveChoice(draftPath)
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()
  await expect.poll(() => fs.readFile(draftPath, 'utf8')).toBe('# Brouillon sans chemin\n')
  await expect(page.getByRole('tab', { name: 'Brouillon.md', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Fermer Brouillon.md', exact: true }).click()
  await openChoice(draftPath)
  await page.getByRole('button', { name: 'Ouvrir un fichier', exact: true }).click()
  await expect(editor()).toContainText('Brouillon sans chemin')
  console.log(
    'OK nouveau brouillon, fermeture fenêtre protégée, Enregistrer sous et ouverture hors workspace',
  )
  console.log(`Artefacts de vérification : ${root}`)
} catch (error) {
  if (page) await page.screenshot({ path: join(root, 'failure.png') }).catch(() => {})
  console.error(`Artefacts de diagnostic : ${root}`)
  throw error
} finally {
  if (app) await app.evaluate(({ app }) => app.exit()).catch(() => {})
}
