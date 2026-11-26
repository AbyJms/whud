
import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  screen
} from 'electron'
import { join } from 'path'
import net from 'node:net'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

let mainWindow: BrowserWindow | null = null
let isInteractive = true

const PIPE_PATH = '\\\\.\\pipe\\whatsapp-hud'

let nativeHostSocket: net.Socket | null = null
let latestChatSnapshot: unknown = null

function createNativeMessagingServer(): void {
  const server = net.createServer((socket) => {
    console.log('[WHUD] Native host connected to Electron')

    nativeHostSocket?.destroy()
    nativeHostSocket = socket

    let buffer = ''

    socket.setEncoding('utf8')

    socket.on('data', (chunk: string) => {
      buffer += chunk

      let newlineIndex: number

      while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIndex)
        buffer = buffer.slice(newlineIndex + 1)

        if (!line.trim()) continue

        try {
          const message: unknown = JSON.parse(line)

          if (
            !message ||
            typeof message !== 'object' ||
            (message as { type?: unknown }).type !== 'CHAT_SNAPSHOT'
          ) {
            continue
          }

          latestChatSnapshot = message

          console.log(
            '[WHUD] Received chat snapshot from:',
            (message as { contact?: { name?: string } }).contact?.name
          )

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('whatsapp:chat-snapshot', message)
          }
        } catch (error) {
          console.error('[WHUD] Invalid message from native host:', error)
        }
      }
    })

    socket.on('error', (error) => {
      console.error('[WHUD] Native host socket error:', error.message)
    })

    socket.on('close', () => {
      console.log('[WHUD] Native host disconnected')

      if (nativeHostSocket === socket) {
        nativeHostSocket = null
      }
    })
  })

  server.on('error', (error) => {
    console.error('[WHUD] Named pipe server error:', error)
  })

  server.listen(PIPE_PATH, () => {
    console.log('[WHUD] Named pipe server listening:', PIPE_PATH)
  })
}

function setInteractiveMode(interactive: boolean): void {
  if (!mainWindow) return

  isInteractive = interactive

  mainWindow.setIgnoreMouseEvents(!interactive, { forward: true })
  mainWindow.setFocusable(interactive)

  if (interactive) {
    mainWindow.focus()
  }

  console.log(`HUD mode: ${interactive ? 'Interactive' : 'Click-through'}`)
}

function createWindow(): void {
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea

  const windowWidth = 300
  const windowHeight = 350
  const windowMargin = 24

  const windowX = x + width - windowWidth - windowMargin
  const windowY = y + Math.round((height - windowHeight) / 2)

  mainWindow = new BrowserWindow({
    x: windowX,
    y: windowY,
    width: windowWidth,
    height: windowHeight,

    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,

    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    autoHideMenuBar: true,

    ...(process.platform === 'linux' ? { icon } : {}),

    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.on('did-finish-load', () => {
    if (latestChatSnapshot) {
      mainWindow?.webContents.send(
        'whatsapp:chat-snapshot',
        latestChatSnapshot
      )
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev) {
    optimizer.watchWindowShortcuts(mainWindow)
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerShortcuts(): void {
  const visibilityRegistered = globalShortcut.register(
    'Alt+Shift+H',
    () => {
      if (!mainWindow) return

      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()

        if (isInteractive) {
          mainWindow.focus()
        }
      }
    }
  )

  const interactionRegistered = globalShortcut.register(
    'Alt+Shift+I',
    () => {
      setInteractiveMode(!isInteractive)
    }
  )

  console.log('Visibility shortcut registered:', visibilityRegistered)
  console.log('Interaction shortcut registered:', interactionRegistered)
}

// Receive a send request from the React HUD.
ipcMain.handle('whatsapp:send-message', async (_event, text: unknown) => {
  if (typeof text !== 'string' || !text.trim()) {
    return false
  }

  if (
    !nativeHostSocket ||
    nativeHostSocket.destroyed ||
    !nativeHostSocket.writable
  ) {
    console.error('[WHUD] Cannot send: native host is disconnected')
    return false
  }

  const message = {
    type: 'SEND_MESSAGE',
    text: text.trim()
  }

  return new Promise<boolean>((resolve) => {
    nativeHostSocket!.write(`${JSON.stringify(message)}\n`, (error) => {
      if (error) {
        console.error('[WHUD] Failed to forward message:', error)
        resolve(false)
      } else {
        console.log('[WHUD] Send request forwarded to Brave')
        resolve(true)
      }
    })
  })
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.whatsapp.hud')

  ipcMain.on('ping', () => console.log('pong'))

  createNativeMessagingServer()
  createWindow()
  registerShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  nativeHostSocket?.destroy()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
