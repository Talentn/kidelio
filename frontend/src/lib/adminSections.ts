import { isSuperOps } from './superOps'

/**
 * Canonical back-office sections. Keys must stay in sync with
 * User::ADMIN_SECTIONS on the Rails API. "dashboard" is always visible.
 */
export const ADMIN_SECTIONS = [
  { key: 'statistics', label: 'Statistiques' },
  { key: 'products', label: 'Produits' },
  { key: 'stock', label: 'Stock' },
  { key: 'orders', label: 'Commandes' },
  { key: 'reviews', label: 'Avis clients' },
  { key: 'categories', label: 'Catégories' },
  { key: 'homepage', label: "Page d'accueil" },
  { key: 'messages', label: 'Messages' },
  { key: 'promos', label: 'Popups promo' },
  { key: 'promo_codes', label: 'Codes promo' },
  { key: 'users', label: 'Utilisateurs' },
  { key: 'attributes', label: 'Attributs' },
  { key: 'activity', label: 'Activité' },
  { key: 'chat', label: 'Chat Support' },
  { key: 'chat_archives', label: 'Archives chat' },
  { key: 'client_analytics', label: 'Comportement clients' },
] as const

export type AdminSectionKey = (typeof ADMIN_SECTIONS)[number]['key'] | 'dashboard'

type SectionUser = { email?: string | null; admin_sections?: string[] | null } | null

/** null / undefined admin_sections = full access; super admin always has access. */
export function sectionAllowed(user: SectionUser, section: AdminSectionKey): boolean {
  if (!user) return false
  if (section === 'dashboard') return true
  if (isSuperOps(user.email)) return true
  if (user.admin_sections == null) return true
  return user.admin_sections.includes(section)
}
