
(() => {
  'use strict'

  const SELECTORS = {
    main: '#main',
    header: '[data-testid="conversation-info-header"]',
    title: '[data-testid="conversation-info-header-chat-title-name"]',
    subtitle: '[data-testid="chat-subtitle"]',
    messages: '[data-testid="conversation-panel-messages"]',
    message: '[data-testid="msg-container"]',
    text: '[data-testid="selectable-text"]',
    composer: '#main footer [contenteditable="true"][role="textbox"]',
    sendButton: '#main footer button[aria-label="Send"]'
  }

  let observer = null
  let observedMain = null
  let debounceTimer = null
  let lastSnapshot = ''
  let ownSenderName = ''

  function normalizeName(name) {
    return (name || '').trim().replace(/\s+/g, ' ').toLowerCase()
  }

  function getContact(main) {
    const header = main.querySelector(SELECTORS.header)
    const title = header?.querySelector(SELECTORS.title)
    const name = title?.innerText?.trim()

    if (!name) return null

    const subtitle = header.querySelector(SELECTORS.subtitle)
    const subtitleText = subtitle?.innerText?.trim() || ''

    let status = 'unknown'

    if (/^typing(?:\.\.\.)?$/i.test(subtitleText)) {
      status = 'typing'
    } else if (/^online$/i.test(subtitleText)) {
      status = 'online'
    } else if (/^recording audio(?:\.\.\.)?$/i.test(subtitleText)) {
      status = 'recording audio'
    }

    return { name, status }
  }

  function getMetadata(element) {
    const metadata = element
      .querySelector('[data-pre-plain-text]')
      ?.getAttribute('data-pre-plain-text') || ''

    const match = metadata.match(
      /^\[([^,\]]+),\s*([^\]]+)\]\s*(.*?):\s*$/
    )

    return {
      time: match ? match[1].trim() : '',
      senderName: match ? match[3].trim() : ''
    }
  }

  function getMediaLabel(element, direction, rawText) {
    const ids = [
      ...element.querySelectorAll('[data-testid]')
    ].map(node => node.getAttribute('data-testid'))

    const labels = [
      ...element.querySelectorAll('[aria-label]')
    ].map(node => node.getAttribute('aria-label') || '')

    const has = (id) => ids.includes(id)

    const hasLabel = (pattern) =>
      labels.some(label => pattern.test(label))

    const action =
      direction === 'outgoing' ? 'sent' :
      direction === 'incoming' ? 'received' : null

    // Detect the exact received view-once notification.
    const elementText = element.innerText || ''

    if (/You received a view once message/i.test(elementText)) {
      return '[View-once message received]'
    }

    // Detect view-once media using WhatsApp's actual SVG identifier.
    const hasViewOnceIcon = [
      ...element.querySelectorAll('svg title')
    ].some(title =>
      title.textContent?.trim() === 'wds-ic-view-once'
    )

    if (
      hasViewOnceIcon ||
      has('view-once-complete') ||
      /view once (photo|video|image)/i.test(labels.join(' '))
    ) {
      if (action === 'sent') return '[View-once media sent]'
      if (action === 'received') return '[View-once media received]'
      return '[View-once media]'
    }

    // Stickers.
    if (has('sticker-container')) {
      return action ? `[Sticker ${action}]` : '[Sticker]'
    }

    // GIFs.
    if (
      has('image-thumb-gif') ||
      has('chat_thread_gif_thumb_image') ||
      has('media-state-gif-icon') ||
      hasLabel(/^play gif$/i)
    ) {
      return action ? `[GIF ${action}]` : '[GIF]'
    }

    // Videos.
    if (has('video-content')) {
      const duration = rawText.match(/\b\d{1,2}:\d{2}\b/)

      if (duration) {
        return action
          ? `[Video ${action} · ${duration[0]}]`
          : `[Video · ${duration[0]}]`
      }

      return action ? `[Video ${action}]` : '[Video]'
    }

    // Voice messages.
    if (
      hasLabel(/voice message|voice note/i) ||
      hasLabel(/play voice message/i)
    ) {
      return action ? `[Voice message ${action}]` : '[Voice message]'
    }

    // Other audio.
    if (hasLabel(/download audio|audio message/i)) {
      return action ? `[Audio ${action}]` : '[Audio]'
    }

    // Images: explicit WhatsApp media identifiers only.
    if (
      has('image-thumb') ||
      has('media-url-provider')
    ) {
      return action ? `[Image ${action}]` : '[Image]'
    }

    // Documents.
    if (
      hasLabel(/download document|open document/i) ||
      has('document-thumb')
    ) {
      return action ? `[Document ${action}]` : '[Document]'
    }

    return null
  }

  function extractText(element) {
    const textElements = [...element.querySelectorAll(SELECTORS.text)]

    const parts = textElements
      .filter(node => !node.parentElement?.closest(SELECTORS.text))
      .map(node => (node.innerText || node.textContent || '').trim())
      .filter(Boolean)

    return [...new Set(parts)].join('\n')
  }

  function getMessageDirection(element, senderName, previousDirection) {
    const incoming = element.querySelector('[data-testid="tail-in"]')
    const outgoing = element.querySelector('[data-testid="tail-out"]')

    if (incoming) return 'incoming'
    if (outgoing) return 'outgoing'

    if (senderName && ownSenderName) {
      return normalizeName(senderName) === normalizeName(ownSenderName)
        ? 'outgoing'
        : 'incoming'
    }

    return previousDirection
  }

  function isSystemMessage(element) {
    return Boolean(
      element.querySelector(
        '[data-testid="voip_ice_bubble_1on1_call"], [data-testid="call-log-system-message"]'
      )
    )
  }

  function createSnapshot() {
    const main = document.querySelector(SELECTORS.main)
    if (!main) return null

    const contact = getContact(main)
    if (!contact) return null

    const panel = main.querySelector(SELECTORS.messages)

    const elements = panel
      ? [...panel.querySelectorAll(SELECTORS.message)].slice(-100)
      : []

    // Learn the current user's name from confirmed outgoing messages.
    for (const element of elements) {
      if (!element.querySelector('[data-testid="tail-out"]')) continue

      const { senderName } = getMetadata(element)

      if (senderName) {
        ownSenderName = senderName
        break
      }
    }

    const messages = []
    let previousDirection = 'unknown'

    elements.forEach((element, index) => {
      if (isSystemMessage(element)) {
        const systemText = (element.innerText || '').trim()

        if (systemText) {
          messages.push({
            id: `system-${index}-${systemText}`,
            sender: 'unknown',
            senderName: '',
            text: systemText,
            time: ''
          })
        }

        previousDirection = 'unknown'
        return
      }

      const { time, senderName } = getMetadata(element)

      const sender = getMessageDirection(
        element,
        senderName,
        previousDirection
      )

      if (sender !== 'unknown') {
        previousDirection = sender
      }

      let text = extractText(element)

      const forwarded = element.querySelector(
        '[data-testid="forwarded-header"]'
      )

      if (forwarded && text) {
        text = `[Forwarded] ${text}`
      }

      const mediaLabel = getMediaLabel(element, sender, text)

      if (mediaLabel) {
        text = text
          ? `${text}\n${mediaLabel}`
          : mediaLabel
      }

      if (!text) return

      const dataId =
        element.getAttribute('data-id') ||
        element.querySelector('[data-id]')?.getAttribute('data-id')

      const id = dataId || `${time}-${sender}-${index}-${text}`

      messages.push({
        id,
        sender,
        senderName,
        text,
        time
      })
    })

    return {
      type: 'CHAT_SNAPSHOT',
      contact,
      messages
    }
  }

  function publishSnapshot() {
    const snapshot = createSnapshot()
    if (!snapshot) return

    const serialized = JSON.stringify(snapshot)

    if (serialized === lastSnapshot) return

    lastSnapshot = serialized

    chrome.runtime.sendMessage(snapshot).catch(() => {})
  }

  function scheduleSnapshot() {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(publishSnapshot, 200)
  }

  function observeConversation() {
    const main = document.querySelector(SELECTORS.main)
    if (!main) return

    observer?.disconnect()
    observedMain = main

    observer = new MutationObserver(scheduleSnapshot)

    observer.observe(main, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['data-id', 'title']
    })

    lastSnapshot = ''
    publishSnapshot()
  }

  async function sendWhatsAppMessage(text) {
    if (typeof text !== 'string' || !text.trim()) {
      return { success: false, error: 'Message is empty' }
    }

    const composer = document.querySelector(SELECTORS.composer)

    if (!composer) {
      return { success: false, error: 'Message composer not found' }
    }

    composer.focus()

    const inserted = document.execCommand(
      'insertText',
      false,
      text.trim()
    )

    if (!inserted) {
      return { success: false, error: 'Text insertion failed' }
    }

    await new Promise(resolve => setTimeout(resolve, 200))

    const sendButton = document.querySelector(SELECTORS.sendButton)

    if (!sendButton || sendButton.disabled) {
      return { success: false, error: 'Send button unavailable' }
    }

    sendButton.click()

    console.log('[WhatsApp HUD] WhatsApp Send button clicked')

    await new Promise(resolve => setTimeout(resolve, 300))

    return { success: true }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'SEND_MESSAGE') return

    sendWhatsAppMessage(message.text)
      .then(sendResponse)
      .catch(error => {
        console.error('[WhatsApp HUD] Sending error:', error)

        sendResponse({
          success: false,
          error: error.message || 'Unknown error'
        })
      })

    return true
  })

  const startupObserver = new MutationObserver(() => {
    if (document.querySelector(SELECTORS.main)) {
      startupObserver.disconnect()
      observeConversation()
    }
  })

  startupObserver.observe(document.body, {
    childList: true,
    subtree: true
  })

  if (document.querySelector(SELECTORS.main)) {
    startupObserver.disconnect()
    observeConversation()
  }

  setInterval(() => {
    const main = document.querySelector(SELECTORS.main)
    if (!main) return

    if (main !== observedMain) {
      observeConversation()
    } else {
      publishSnapshot()
    }
  }, 1500)

  console.log('[WhatsApp HUD] View-once detection enabled')
})()
