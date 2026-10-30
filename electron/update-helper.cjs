// Standalone helper copied outside app.asar. Runs with Electron's Node mode after user approval.
// Electron's virtual ASAR filesystem cannot recursively delete a physical .app bundle.
const fs = require(process.versions.electron ? 'original-fs' : 'node:fs').promises
const path = require('node:path')
const { spawn } = require('node:child_process')
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function waitForExit(pid) {
  for (let i = 0; i < 600; i++) {
    try {
      process.kill(pid, 0)
    } catch (error) {
      if (error.code === 'ESRCH') return
      throw error
    }
    await pause(200)
  }
  throw new Error('La version précédente ne s’est pas fermée.')
}
function launch(appPath, args = []) {
  const executable = path.join(appPath, 'Contents', 'MacOS', 'Markdown Studio')
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const child = spawn(executable, args, { detached: true, stdio: 'ignore', env })
  child.unref()
  return new Promise((resolve, reject) => {
    child.once('spawn', () => resolve(child))
    child.once('error', reject)
  })
}
async function waitForReady(receipt, version, child) {
  let ended = false
  child.once('exit', () => {
    ended = true
  })
  for (let i = 0; i < 600; i++) {
    if (ended) throw new Error('La nouvelle application s’est arrêtée avant son initialisation.')
    try {
      const data = JSON.parse(await fs.readFile(receipt, 'utf8'))
      if (data.version === version) return
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error
    }
    await pause(200)
  }
  throw new Error('La nouvelle application n’a pas confirmé son démarrage.')
}
async function terminate(child) {
  if (child.exitCode !== null) return
  child.kill('SIGTERM')
  for (let i = 0; i < 25; i++) {
    try {
      process.kill(child.pid, 0)
    } catch (error) {
      if (error.code === 'ESRCH') return
      throw error
    }
    await pause(200)
  }
  child.kill('SIGKILL')
  await waitForExit(child.pid)
}
function validateConfig(config) {
  if (
    !config ||
    !Number.isInteger(config.parentPid) ||
    config.parentPid < 1 ||
    !/^[a-f0-9-]{36}$/.test(config.token) ||
    typeof config.version !== 'string'
  )
    throw new Error('Configuration de mise à jour invalide.')
  for (const key of [
    'userData',
    'appPath',
    'stagingRoot',
    'stagedApp',
    'backupPath',
    'receiptPath',
    'resultPath',
  ])
    if (typeof config[key] !== 'string' || !path.isAbsolute(config[key]))
      throw new Error('Chemin de mise à jour invalide.')
  if (
    !config.appPath.endsWith('.app') ||
    path.dirname(config.stagingRoot) !== path.dirname(config.appPath) ||
    path.dirname(config.stagedApp) !== config.stagingRoot ||
    path.basename(config.stagedApp) !== path.basename(config.appPath) ||
    config.backupPath !== `${config.appPath}.backup-${config.token}` ||
    path.basename(config.receiptPath) !== `${config.token}.ready` ||
    path.dirname(config.receiptPath) !== path.join(config.userData, 'updates') ||
    path.dirname(config.resultPath) !== path.join(config.userData, 'updates')
  )
    throw new Error('Les chemins de remplacement ne sont pas cohérents.')
}
async function runUpdate(config, ports = {}) {
  validateConfig(config)
  const io = {
    waitForExit,
    launch,
    waitForReady,
    terminate,
    ...ports,
  }
  let backedUp = false
  let replaced = false
  let child
  try {
    await io.waitForExit(config.parentPid)
    // Reject symlink bundles before any mutation. The prepared bundle was verified by the app.
    if (
      !(await fs.lstat(config.appPath)).isDirectory() ||
      !(await fs.lstat(config.stagedApp)).isDirectory()
    )
      throw new Error('Bundle invalide.')
    try {
      await fs.lstat(config.backupPath)
      throw new Error('La sauvegarde cible existe déjà.')
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
    }
    await fs.rename(config.appPath, config.backupPath)
    backedUp = true
    await fs.rename(config.stagedApp, config.appPath)
    replaced = true
    child = await io.launch(config.appPath, [
      `--studio-update-token=${config.token}`,
      `--user-data-dir=${config.userData}`,
    ])
    await io.waitForReady(config.receiptPath, config.version, child)
  } catch (error) {
    if (child) {
      try {
        await io.terminate(child)
      } catch {
        /* preserve the original error */
      }
    }
    if (replaced) await fs.rename(config.appPath, config.stagedApp)
    if (backedUp) await fs.rename(config.backupPath, config.appPath)
    await fs
      .writeFile(
        config.resultPath,
        JSON.stringify({ ok: false, version: config.version, error: error.message }),
      )
      .catch(() => {})
    // If no mutation occurred, the original app may still be running; don't launch a duplicate.
    if (backedUp)
      await io.launch(config.appPath, [
        '--studio-update-failed',
        `--user-data-dir=${config.userData}`,
      ])
    return false
  }
  // Cleanup failures must never roll back an application that has already started successfully.
  const cleanupErrors = []
  for (const target of [config.backupPath, config.stagingRoot]) {
    try {
      await fs.rm(target, { recursive: true, force: true })
    } catch (error) {
      cleanupErrors.push({ path: target, code: error.code, message: error.message })
    }
  }
  if (cleanupErrors.length)
    await fs.writeFile(
      path.join(config.userData, 'updates', 'cleanup.json'),
      JSON.stringify(cleanupErrors.map((error) => error.path)),
    )
  await fs.rm(config.receiptPath, { force: true }).catch(() => {})
  await fs.writeFile(
    config.resultPath,
    JSON.stringify({ ok: true, version: config.version, pid: child.pid, cleanupErrors }),
  )
  return true
}
module.exports = { runUpdate, validateConfig }
if (require.main === module) {
  fs.readFile(process.argv[2], 'utf8')
    .then(JSON.parse)
    .then((config) => runUpdate(config))
    .then((ok) => {
      process.exitCode = ok ? 0 : 1
    })
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
}
