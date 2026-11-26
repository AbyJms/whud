
'use strict'

const net = require('node:net')

const PIPE_PATH = '\\\\.\\pipe\\whatsapp-hud'
const MAX_MESSAGE_SIZE = 16 * 1024 * 1024

let pipe = null
let inputBuffer = Buffer.alloc(0)
let pipeBuffer = ''

const pendingMessages = []

function log(...args) {
  process.stderr.write(`[WHUD Native Host] ${args.join(' ')}\n`)
}

// Native Messaging uses a 4-byte little-endian length prefix.
function sendToBrave(message) {
  const payload = Buffer.from(JSON.stringify(message), 'utf8')
  const header = Buffer.alloc(4)

  header.writeUInt32LE(payload.length, 0)

  process.stdout.write(Buffer.concat([header, payload]))
}

// Connect to the Electron named pipe.
function connectToElectron() {
  if (pipe) return

  const connection = net.createConnection(PIPE_PATH)

  pipe = connection

  connection.on('connect', () => {
    log('Connected to Electron')

    while (pendingMessages.length > 0) {
      connection.write(JSON.stringify(pendingMessages.shift()) + '\n')
    }
  })

  connection.on('data', (chunk) => {
    pipeBuffer += chunk.toString('utf8')

    let newlineIndex

    while ((newlineIndex = pipeBuffer.indexOf('\n')) !== -1) {
      const line = pipeBuffer.slice(0, newlineIndex)
      pipeBuffer = pipeBuffer.slice(newlineIndex + 1)

      if (!line.trim()) continue

      try {
        sendToBrave(JSON.parse(line))
      } catch {
        log('Invalid response from Electron')
      }
    }
  })

  connection.on('error', (error) => {
    log('Electron pipe error:', error.message)
  })

  connection.on('close', () => {
    pipe = null
    pipeBuffer = ''
    log('Electron connection closed')
  })
}

// Process messages received from Brave.
function handleNativeMessage(message) {
  if (!message || typeof message !== 'object') return

  if (pipe && !pipe.destroyed && pipe.writable) {
    pipe.write(JSON.stringify(message) + '\n')
  } else {
    pendingMessages.push(message)
    connectToElectron()
  }
}

// Read Native Messaging frames from stdin.
function processInput() {
  while (inputBuffer.length >= 4) {
    const messageLength = inputBuffer.readUInt32LE(0)

    if (messageLength > MAX_MESSAGE_SIZE) {
      log('Message exceeds maximum allowed size')
      process.exit(1)
    }

    if (inputBuffer.length < messageLength + 4) {
      return
    }

    const payload = inputBuffer.subarray(4, messageLength + 4)
    inputBuffer = inputBuffer.subarray(messageLength + 4)

    try {
      const message = JSON.parse(payload.toString('utf8'))
      handleNativeMessage(message)
    } catch {
      log('Invalid JSON received from Brave')
    }
  }
}

process.stdin.on('data', (chunk) => {
  inputBuffer = Buffer.concat([inputBuffer, chunk])
  processInput()
})

process.stdin.on('end', () => {
  pipe?.end()
  process.exit(0)
})

process.on('uncaughtException', (error) => {
  log('Unexpected error:', error.message)
})

log('Native messaging host started')
connectToElectron()
