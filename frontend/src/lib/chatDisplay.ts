/** Customer-facing label for staff chat messages. */
export function chatAgentLabel(senderType: string, senderName?: string): string {
  if (senderType === 'agent') return 'Support'
  return senderName || ''
}
