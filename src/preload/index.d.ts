
import type { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface WhatsAppMessage {
    id: string
    sender: 'incoming' | 'outgoing' | 'unknown'
    senderName: string
    text: string
    time: string
  }

  interface WhatsAppContact {
    name: string
    status: string
  }

  interface WhatsAppChatSnapshot {
    type: 'CHAT_SNAPSHOT'
    contact: WhatsAppContact
    messages: WhatsAppMessage[]
  }

  interface WhatsAppAPI {
    onChatSnapshot: (
      callback: (snapshot: WhatsAppChatSnapshot) => void
    ) => () => void

    sendMessage: (text: string) => Promise<boolean>
  }

  interface Window {
    electron: ElectronAPI
    api: WhatsAppAPI
  }
}

export {}
