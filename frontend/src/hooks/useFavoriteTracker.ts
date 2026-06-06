import { useCallback, useRef } from 'react'
import { goWsUrl, goWsEnabled, goTrack } from '../lib/goApi'

export function useFavoriteTracker() {
  const wsRef = useRef<WebSocket | null>(null)

  const track = useCallback((action: 'add' | 'remove', productId: number, productName: string) => {
    const payload = { action, product_id: productId, product_name: productName }
    try {
      if (!goWsEnabled()) {
        goTrack('/favorites/events', payload)
        return
      }
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        const ws = new WebSocket(goWsUrl('/favorites/ws'))
        ws.onclose = () => { wsRef.current = null }
        wsRef.current = ws
      }
      const body = JSON.stringify(payload)
      const ws = wsRef.current!
      const send = () => ws.send(body)
      if (ws.readyState === WebSocket.OPEN) {
        send()
      } else {
        ws.addEventListener('open', send, { once: true })
      }
    } catch { /* non-critical */ }
  }, [])

  return { track }
}
