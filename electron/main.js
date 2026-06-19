'use strict'

const { app, BrowserWindow, dialog, ipcMain } = require('electron')
const { autoUpdater } = require('electron-updater')
const { spawn } = require('child_process')
const path = require('path')
const http = require('http')
const fs = require('fs')

const LOG_FILE = path.join(require('os').homedir(), 'Library', 'Logs', 'VendorCompare AI', 'startup.log')
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

const OLLAMA_PORT = 11435
const OLLAMA_HOST_URL = `http://localhost:${OLLAMA_PORT}`
const OLLAMA_MODEL = 'qwen2.5:7b'

let mainWindow = null
let backendProcess = null
let ollamaProcess = null

// ─── Logging ───────────────────────────────────────────────────────────────

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

// ─── Ollama sidecar ────────────────────────────────────────────────────────

function getOllamaBin() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', 'ollama')
  }
  // Dev mode: binary relative to electron/ directory
  return path.join(__dirname, 'resources', 'bin', 'ollama')
}

function getOllamaLibDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin')
  }
  return path.join(__dirname, 'resources', 'bin')
}

function getOllamaModelsDir() {
  return path.join(app.getPath('userData'), 'ollama', 'models')
}

function startOllama() {
  const ollamaBin = getOllamaBin()
  const ollamaLibDir = getOllamaLibDir()
  const modelsDir = getOllamaModelsDir()

  log(`Starting Ollama: ${ollamaBin}`)
  log(`Ollama lib dir: ${ollamaLibDir}`)
  log(`Ollama models dir: ${modelsDir}`)

  fs.mkdirSync(modelsDir, { recursive: true })

  if (!fs.existsSync(ollamaBin)) {
    log(`WARNING: Ollama binary not found at ${ollamaBin}`)
    return
  }

  // Ensure binary is executable
  try { fs.chmodSync(ollamaBin, 0o755) } catch (_) {}

  ollamaProcess = spawn(ollamaBin, ['serve'], {
    env: {
      ...process.env,
      OLLAMA_HOST: `0.0.0.0:${OLLAMA_PORT}`,
      OLLAMA_MODELS: modelsDir,
      // Ensure dylibs in bin/ are found on macOS
      DYLD_LIBRARY_PATH: `${ollamaLibDir}:${process.env.DYLD_LIBRARY_PATH || ''}`,
    },
    stdio: 'ignore',
    detached: false,
  })

  ollamaProcess.on('error', (err) => {
    log(`Ollama failed to start: ${err.message}`)
  })

  ollamaProcess.on('exit', (code) => {
    log(`Ollama exited (${code})`)
  })

  log('Ollama process spawned')
}

function waitForOllama(maxWaitMs = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      http.get(`${OLLAMA_HOST_URL}/api/tags`, (res) => {
        if (res.statusCode === 200) {
          log('Ollama is ready')
          resolve()
        } else {
          retry()
        }
        res.resume()
      }).on('error', retry)
    }
    const retry = () => {
      if (Date.now() - start > maxWaitMs) {
        reject(new Error('Ollama did not start within 30s'))
      } else {
        setTimeout(check, 500)
      }
    }
    check()
  })
}

// ─── Ollama IPC handlers ───────────────────────────────────────────────────

ipcMain.handle('ollama-check-model', async (_event, modelName) => {
  return new Promise((resolve) => {
    http.get(`${OLLAMA_HOST_URL}/api/tags`, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const tags = JSON.parse(data)
          const baseName = modelName.split(':')[0]
          const exists = tags.models && tags.models.some(m => m.name.startsWith(baseName))
          log(`Model check ${modelName}: ${exists}`)
          resolve(exists)
        } catch (e) {
          log(`Model check parse error: ${e.message}`)
          resolve(false)
        }
      })
    }).on('error', (e) => {
      log(`Model check request error: ${e.message}`)
      resolve(false)
    })
  })
})

ipcMain.handle('ollama-pull-model', async (event, modelName) => {
  log(`Starting model pull: ${modelName}`)
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ name: modelName, stream: true })
    const req = http.request({
      hostname: 'localhost',
      port: OLLAMA_PORT,
      path: '/api/pull',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let buffer = ''
      res.on('data', (chunk) => {
        buffer += chunk.toString()
        // Process complete JSON lines
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete last line
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const progress = JSON.parse(line)
            event.sender.send('ollama-pull-progress', progress)
            if (progress.status === 'success') {
              log(`Model pull complete: ${modelName}`)
            }
          } catch (_) {}
        }
      })
      res.on('end', () => {
        // Process any remaining buffer
        if (buffer.trim()) {
          try {
            const progress = JSON.parse(buffer)
            event.sender.send('ollama-pull-progress', progress)
          } catch (_) {}
        }
        resolve()
      })
    })
    req.on('error', (e) => {
      log(`Model pull request error: ${e.message}`)
      reject(e)
    })
    req.write(postData)
    req.end()
  })
})

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
    // Override Ollama URL to use our bundled sidecar on port 11435
    OLLAMA_BASE_URL: `http://localhost:${OLLAMA_PORT}/v1`,
    VENDORCOMPARE_MODEL: OLLAMA_MODEL,
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
    title: 'VendorCompare AI',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  mainWindow.loadFile(getFrontendPath())
  mainWindow.on('closed', () => { mainWindow = null })
}

// ─── Auto-updater ──────────────────────────────────────────────────────────

function installUpdate(version) {
  const dmgUrl = `https://aitoolchest.space/vendorcompare/download/VendorCompare-${version}-arm64.dmg`
  const scriptPath = `/tmp/vc_update_${version}.sh`
  const script = [
    '#!/bin/sh',
    'hdiutil detach /Volumes/VendorCompare* -quiet 2>/dev/null || true',
    `curl -sL "${dmgUrl}" -o /tmp/VC_update.dmg || exit 1`,
    'hdiutil attach /tmp/VC_update.dmg -nobrowse -quiet || exit 1',
    'cp -R /Volumes/VendorCompare*/VendorCompare.app /Applications/ || exit 1',
    'xattr -cr /Applications/VendorCompare.app',
    'hdiutil detach /Volumes/VendorCompare* -quiet 2>/dev/null || true',
    'rm -f /tmp/VC_update.dmg',
    'sleep 5',
    'open /Applications/VendorCompare.app',
  ].join('\n')
  try {
    fs.writeFileSync(scriptPath, script, { mode: 0o755 })
  } catch (e) {
    log(`Failed to write update script: ${e.message}`)
    return
  }
  log(`Installing update ${version} — opening Terminal`)
  const { execFileSync } = require('child_process')
  try {
    execFileSync('osascript', [
      '-e', `tell application "Terminal" to do script "bash '${scriptPath}'; exit" activate`,
    ])
  } catch (e) {
    log(`osascript failed: ${e.message}`)
  }
  setTimeout(() => app.quit(), 500)
}

function initAutoUpdater() {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', (info) => {
    log(`Update available: ${info.version}`)
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `VendorCompare ${info.version} is ready to install.`,
      detail: 'Click Install Now to update automatically. The app will reopen when done.',
      buttons: ['Install Now', 'Later'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) installUpdate(info.version)
    })
  })

  autoUpdater.on('error', (err) => {
    log(`Auto-updater error: ${err.message}`)
  })

  autoUpdater.checkForUpdates().catch((err) => {
    log(`Update check failed: ${err.message}`)
  })
}

// ─── App lifecycle ─────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  try {
    // 1. Start bundled Ollama sidecar
    log('Step 1: Starting Ollama sidecar')
    startOllama()

    // 2. Wait for Ollama to be ready (poll /api/tags)
    log('Step 2: Waiting for Ollama...')
    await waitForOllama()
    log('Ollama ready')

    // 3. Start FastAPI backend (with OLLAMA_BASE_URL injected)
    log('Step 3: Starting backend')
    spawnBackend()

    // 4. Wait for backend health check
    log('Step 4: Waiting for backend...')
    await waitForBackend()
    log('Backend ready')

    // 5. Open window — frontend handles model check/download UI
    log('Step 5: Creating window')
    await createWindow()

    if (app.isPackaged) initAutoUpdater()
  } catch (err) {
    log(`Startup error: ${err.message}`)
    dialog.showErrorBox('VendorCompare — Startup Error', err.message)
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
  if (ollamaProcess) {
    ollamaProcess.kill('SIGTERM')
    log('Ollama killed')
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
