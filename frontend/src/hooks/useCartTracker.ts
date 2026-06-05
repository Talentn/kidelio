// Sends cart add/remove events to the Go service over WebSocket.
// The connection is lazy — only opens when the first event fires.
import { useRef, useCallback } from 'react'
import { goWsUrl } from '../lib/goApi'

type CartAction = 'add' | 'remove' | 'update' | 'clear'

interface CartEventPayload {
  action: CartAction
  product_id?: number
  product_name?: string
  quantity?: number
  price?: number
}

export function useCartTracker() {
  const wsRef = useRef<WebSocket | null>(null)

  const ensureWs = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) return wsRef.current
    const ws = new WebSocket(goWsUrl('/cart/ws'))
    ws.onclose = () => { wsRef.current = null }
    wsRef.current = ws
    return ws
  }, [])

  const track = useCallback((payload: CartEventPayload) => {
    const ws = ensureWs()
    const send = () => ws.send(JSON.stringify(payload))
    if (ws.readyState === WebSocket.OPEN) {
      send()
    } else {
      ws.addEventListener('open', send, { once: true })
    }
  }, [ensureWs])

  return { track }
}
