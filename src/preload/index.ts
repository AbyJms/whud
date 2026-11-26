
import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

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

const api = {
  onChatSnapshot: (
    callback: (snapshot: WhatsAppChatSnapshot) => void
  ) => {
    const listener = (
      _event: IpcRendererEvent,
      snapshot: WhatsAppChatSnapshot
    ): void => {
      callback(snapshot)
    }

    ipcRenderer.on('whatsapp:chat-snapshot', listener)

    return (): void => {
      ipcRenderer.removeListener('whatsapp:chat-snapshot', listener)
    }
  },

  sendMessage: (text: string): Promise<boolean> => {
    return ipcRenderer.invoke('whatsapp:send-message', text)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  Object.assign(window, {
    electron: electronAPI,
    api
  })
}
