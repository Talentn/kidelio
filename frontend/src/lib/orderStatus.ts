/** Libellés français des statuts de commande (clés API inchangées). */

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'refunded',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Commande reçue',
  confirmed: 'Confirmée',
  processing: 'En préparation',
  shipped: 'Expédiée',
  out_for_delivery: 'En cours de livraison',
  delivered: 'Livrée',
  cancelled: 'Annulée',
  refunded: 'Remboursée',
}

export const ORDER_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-sky-100 text-sky-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  out_for_delivery: 'bg-indigo-100 text-indigo-700',
  delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
  refunded: 'bg-gray-100 text-gray-600',
}

/** Colored borders for admin status dropdowns */
export const ORDER_STATUS_SELECT_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 border-amber-300 text-amber-800',
  confirmed: 'bg-sky-50 border-sky-300 text-sky-800',
  processing: 'bg-blue-50 border-blue-300 text-blue-800',
  shipped: 'bg-purple-50 border-purple-300 text-purple-800',
  out_for_delivery: 'bg-indigo-50 border-indigo-300 text-indigo-800',
  delivered: 'bg-emerald-50 border-emerald-400 text-emerald-800',
  cancelled: 'bg-red-50 border-red-300 text-red-800',
  refunded: 'bg-slate-100 border-slate-300 text-slate-600',
}

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? 'Statut inconnu'
}

export function orderStatusStyle(status: string): string {
  return ORDER_STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-600'
}

export function orderStatusSelectClass(status: string): string {
  const colors = ORDER_STATUS_SELECT_STYLES[status] ?? 'bg-slate-50 border-slate-200 text-slate-700'
  return `border rounded-lg px-2 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-brand-300 outline-none min-w-[9.5rem] ${colors}`
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces à la livraison',
}

export function paymentMethodLabel(method?: string | null): string {
  if (!method) return '—'
  return PAYMENT_METHOD_LABELS[method] ?? method
}

export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  CREATE: 'Création',
  UPDATE: 'Modification',
  DELETE: 'Suppression',
  STATUS_CHANGE: 'Changement de statut',
  LOGIN: 'Connexion',
  LOGOUT: 'Déconnexion',
}

export const ACTIVITY_ENTITY_LABELS: Record<string, string> = {
  Order: 'Commande',
  Product: 'Produit',
  Category: 'Catégorie',
  User: 'Utilisateur',
  PromoPopup: 'Bannière promo',
  PromoCode: 'Code promo',
  ContactMessage: 'Message contact',
  ProductColor: 'Couleur produit',
  ProductColorSize: 'Stock taille',
  SizeAttribute: 'Taille (attribut)',
  HeroSlider: 'Slide accueil',
  HomePageAsset: 'Image accueil',
}

export function activityActionLabel(action: string): string {
  return ACTIVITY_ACTION_LABELS[action] ?? action
}

export function activityEntityLabel(entityType: string): string {
  return ACTIVITY_ENTITY_LABELS[entityType] ?? entityType
}

export const USER_ROLE_LABELS: Record<string, string> = {
  client: 'Client',
  employee: 'Employé',
  admin: 'Administrateur',
}

export function userRoleLabel(role?: string | null): string {
  if (!role) return '—'
  return USER_ROLE_LABELS[role] ?? role
}

const USER_ROLE_STYLES: Record<string, string> = {
  client: 'bg-slate-100 text-slate-600',
  employee: 'bg-sky-100 text-sky-700',
  admin: 'bg-violet-100 text-violet-700',
}

export function userRoleStyle(role?: string | null): string {
  if (!role) return 'bg-slate-100 text-slate-500'
  return USER_ROLE_STYLES[role] ?? 'bg-slate-100 text-slate-600'
}
