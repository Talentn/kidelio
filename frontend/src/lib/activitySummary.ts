import { activityActionLabel, activityEntityLabel } from './orderStatus'

type ActivityLog = {
  action: string
  entity_type: string
  entity_name?: string
  changes: Record<string, unknown>
}

const FIELD_LABELS: Record<string, string> = {
  status: 'Statut',
  active: 'Actif',
  stock: 'Stock',
  price: 'Prix',
  role: 'Rôle',
  read: 'Lu',
  name: 'Nom',
  images: 'Images',
  image: 'Image',
  colors_order: 'Ordre des couleurs',
}

function fmt(value: unknown): string {
  if (value === null || value === undefined) return '—'
  return String(value)
}

/** One-line summary for the activity table */
export function activityLogSummary(log: ActivityLog): string {
  const changes = log.changes ?? {}
  const keys = Object.keys(changes)

  if (log.action === 'LOGIN') return 'Connexion'
  if (log.action === 'LOGOUT') return 'Déconnexion'
  if (log.action === 'DELETE') return 'Suppression'
  if (log.action === 'CREATE') {
    if (keys.length === 0) return 'Création'
    return `Création (${keys.length} champ${keys.length > 1 ? 's' : ''})`
  }

  if (log.action === 'STATUS_CHANGE' && changes.status) {
    const pair = changes.status
    if (Array.isArray(pair) && pair.length === 2) {
      return `${FIELD_LABELS.status}: ${fmt(pair[0])} → ${fmt(pair[1])}`
    }
  }

  if (keys.length === 0) return activityActionLabel(log.action)

  if (keys.length === 1) {
    const key = keys[0]
    const raw = changes[key]
    const label = FIELD_LABELS[key] ?? key.replace(/_/g, ' ')
    if (Array.isArray(raw) && raw.length === 2) {
      return `${label}: ${fmt(raw[0])} → ${fmt(raw[1])}`
    }
    return `${label}: ${fmt(raw)}`
  }

  const parts = keys.slice(0, 3).map((key) => {
    const raw = changes[key]
    const label = FIELD_LABELS[key] ?? key.replace(/_/g, ' ')
    if (Array.isArray(raw) && raw.length === 2) {
      return `${label} → ${fmt(raw[1])}`
    }
    return label
  })

  const more = keys.length > 3 ? ` +${keys.length - 3}` : ''
  return parts.join(' · ') + more
}

export const ACTIVITY_ENTITY_TYPES = [
  'Order',
  'Product',
  'Category',
  'ProductColor',
  'ProductColorSize',
  'SizeAttribute',
  'PromoCode',
  'PromoPopup',
  'User',
  'ContactMessage',
] as const

export function activityEntityFilterLabel(type: string): string {
  return activityEntityLabel(type)
}
