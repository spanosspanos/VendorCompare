'use strict'

const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const { spawn } = require('child_process')
const path = require('path')
const http = require('http')
const fs = require('fs')

const LOG_FILE = path.join(require('os').homedir(), 'Library', 'Logs', 'VendorCompare MCP', 'startup.log')
function log(msg) {
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true })
    fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`)
  } catch (_) {}
}

const PORT = 8000
const HEALTH_URL = `http://127.0.0.1:${PORT}/api/health`
const MAX_WAIT_MS = 30000
const POLL_MS = 500

let mainWindow = null
let backendProcess = null

// ─── Data dir helpers ──────────────────────────────────────────────────────

function getDataDir() {
  const dir = app.getPath('userData')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

function ensureDatabase() {
  const dbPath = path.join(getDataDir(), 'vendorcompare.db')
  if (!fs.existsSync(dbPath)) {
    const seedDb = app.isPackaged
      ? path.join(process.resourcesPath, 'seed.db')
      : path.join(__dirname, 'seed.db')
    if (fs.existsSync(seedDb)) {
      fs.copyFileSync(seedDb, dbPath)
      log(`First run: copied seed database to ${dbPath}`)
    } else {
      log(`WARNING: seed.db not found at ${seedDb} — starting with empty database`)
    }
  }
  return dbPath
}

// ─── Backend spawn ─────────────────────────────────────────────────────────

function loadBackendEnv() {
  const envPaths = app.isPackaged
    ? [path.join(process.resourcesPath, 'backend.env')]
    : [
        path.join(__dirname, '..', 'backend', '.env'),
        path.join(__dirname, '..', 'backend', '.env.local'),
      ]
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eq = trimmed.indexOf('=')
        if (eq < 1) continue
        const key = trimmed.slice(0, eq).trim()
        const val = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
        if (key && !(key in process.env)) {
          process.env[key] = val
        }
      }
      log(`Loaded env from ${envPath}`)
      break
    }
  }
}

function spawnBackend() {
  loadBackendEnv()
  const dbPath = ensureDatabase()
  const env = {
    ...process.env,
    DATABASE_URL: `sqlite:///${dbPath}`,
  }

  log(`isPackaged=${app.isPackaged} resourcesPath=${process.resourcesPath}`)

  if (app.isPackaged) {
    const binary = path.join(process.resourcesPath, 'backend_dist', 'vendorcompare_backend')
    log(`spawning binary: ${binary}`)
    log(`binary exists: ${fs.existsSync(binary)}`)
    backendProcess = spawn(binary, [], { env })
  } else {
    const backendDir = path.join(__dirname, '..', 'backend')
    log(`dev mode: spawning uvicorn from ${backendDir}`)
    backendProcess = spawn('python3', [
      '-m', 'uvicorn', 'app.main:app',
      '--host', '127.0.0.1',
      '--port', String(PORT),
    ], { cwd: backendDir, env })
  }

  backendProcess.stdout.on('data', (d) => { log(`[out] ${d.toString().trim()}`); process.stdout.write(`[backend] ${d}`) })
  backendProcess.stderr.on('data', (d) => { log(`[err] ${d.toString().trim()}`); process.stderr.write(`[backend] ${d}`) })
  backendProcess.on('error', (e) => log(`spawn error: ${e.message}`))
  backendProcess.on('exit', (code) => log(`exited (${code})`))
}

function pollHealth(resolve, reject, deadline) {
  http.get(HEALTH_URL, (res) => {
    if (res.statusCode === 200) return resolve()
    scheduleRetry(resolve, reject, deadline)
  }).on('error', () => scheduleRetry(resolve, reject, deadline))
}

function scheduleRetry(resolve, reject, deadline) {
  if (Date.now() > deadline) return reject(new Error('Backend did not start within 30s'))
  setTimeout(() => pollHealth(resolve, reject, deadline), POLL_MS)
}

function waitForBackend() {
  return new Promise((resolve, reject) => {
    pollHealth(resolve, reject, Date.now() + MAX_WAIT_MS)
  })
}

// ─── Window ────────────────────────────────────────────────────────────────

function getFrontendPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'frontend_dist', 'index.html')
  }
  return path.join(__dirname, '..', 'frontend', 'dist', 'index.html')
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
    title: 'VendorCompare MCP',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  mainWindow.loadFile(getFrontendPath())
  mainWindow.on('closed', () => { mainWindow = null })
}

// ─── App lifecycle ─────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    log('Step 1: Starting backend')
    spawnBackend()

    log('Step 2: Waiting for backend...')
    await waitForBackend()
    log('Backend ready')

    log('Step 3: Creating window')
    await createWindow()
  } catch (err) {
    log(`Startup error: ${err.message}`)
    dialog.showErrorBox('VendorCompare MCP — Startup Error', err.message)
    app.quit()
  }

  app.on('activate', () => {
    if (!mainWindow) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  if (backendProcess) {
    backendProcess.kill('SIGTERM')
    log('Backend killed')
  }
})

// ─── ToS IPC ───────────────────────────────────────────────────────────────

ipcMain.handle('tos-record', (_event, record) => {
  const dest = path.join(getDataDir(), 'tos_acceptance.json')
  try {
    const durableRecord = {
      ...record,
      recorded_at: new Date().toISOString(),
      storage: 'electron-userData',
    }
    fs.writeFileSync(dest, JSON.stringify(durableRecord, null, 2))
    log(`ToS acceptance written to ${dest}`)
    return { ok: true, path: dest }
  } catch (e) {
    log(`Failed to write tos_acceptance.json: ${e.message}`)
    return { ok: false, error: e.message }
  }
})
