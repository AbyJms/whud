
'use strict'

console.log('[WhatsApp HUD] Background service worker started')

let nativePort = null
let activeWhatsAppTabId = null

function connectNativeHost() {
  if (nativePort) return

  try {
    nativePort = chrome.runtime.connectNative('com.whatsapp.hud')

    nativePort.onMessage.addListener((message) => {
      console.log('[WhatsApp HUD] Message from native host:', message)

      if (message.type === 'SEND_MESSAGE') {
        if (activeWhatsAppTabId === null) {
          console.error('[WhatsApp HUD] No active WhatsApp tab')
          return
        }

        chrome.tabs.sendMessage(activeWhatsAppTabId, message)
          .then((response) => {
            console.log('[WhatsApp HUD] Send result:', response)
          })
          .catch((error) => {
            console.error('[WhatsApp HUD] Could not reach WhatsApp tab:', error)
          })
      }
    })

    nativePort.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError

      console.error(
        '[WhatsApp HUD] Native host disconnected:',
        error?.message || 'Connection closed'
      )

      nativePort = null
    })

    console.log('[WhatsApp HUD] Native host connection opened')
  } catch (error) {
    console.error('[WhatsApp HUD] Native connection failed:', error)
    nativePort = null
  }
}

chrome.runtime.onMessage.addListener((message, sender) => {
  if (!sender.url?.startsWith('https://web.whatsapp.com/')) return
  if (message.type !== 'CHAT_SNAPSHOT') return

  if (sender.tab?.id !== undefined) {
    activeWhatsAppTabId = sender.tab.id
  }

  console.log('[WhatsApp HUD] Chat:', message.contact.name)
  console.log('[WhatsApp HUD] Status:', message.contact.status)
  console.table(message.messages)

  connectNativeHost()
  nativePort?.postMessage(message)
})
