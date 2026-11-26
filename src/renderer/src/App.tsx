
import { useEffect, useRef, useState } from 'react'

interface Message {
  id: string
  text: string
  sender: 'incoming' | 'outgoing' | 'unknown'
  time: string
}

interface Contact {
  name: string
  status: string
}

function App(): React.JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const [contact, setContact] = useState<Contact>({
    name: 'WhatsApp',
    status: ''
  })

  const [input, setInput] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [sending, setSending] = useState(false)

  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const unsubscribe = window.api.onChatSnapshot((snapshot) => {
      setContact(snapshot.contact)

      setMessages(
        snapshot.messages.map((message) => ({
          id: message.id,
          text: message.text,
          sender: message.sender,
          time: message.time
        }))
      )
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    const container = messagesRef.current

    if (autoScroll && container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [messages, autoScroll])

  const handleScroll = (): void => {
    const container = messagesRef.current
    if (!container) return

    const distance =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight

    setAutoScroll(distance < 40)
  }

  const sendMessage = async (): Promise<void> => {
    const text = input.trim()

    if (!text || sending) return

    setSending(true)

    try {
      const accepted = await window.api.sendMessage(text)

      if (accepted) {
        setInput('')
        setAutoScroll(true)
      } else {
        console.error('[HUD] Message could not be forwarded to WhatsApp')
      }
    } catch (error) {
      console.error('[HUD] Message sending failed:', error)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  return (
    <main className="hud-shell">
      <header className="chat-header">
        <span className="contact-name">{contact.name}</span>

        {contact.status && (
          <>
            <span className="status-separator">·</span>
            <span className="contact-status">{contact.status}</span>
          </>
        )}
      </header>

      <section
        className="messages-container"
        ref={messagesRef}
        onScroll={handleScroll}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message-row ${message.sender}`}
          >
            <div className="message-bubble">
              <div className="message-text">{message.text}</div>
              <div className="message-time">{message.time}</div>
            </div>
          </div>
        ))}
      </section>

      <form
        className="message-composer"
        onSubmit={(event) => {
          event.preventDefault()
          void sendMessage()
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Message..."
          autoComplete="off"
          disabled={sending}
        />
      </form>
    </main>
  )
}

export default App
