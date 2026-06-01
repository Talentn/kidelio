import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import type { ShopCategory } from '../lib/categories'

function categoryHref(id: number) {
  return `/produits?category=${id}`
}

type LinkItemProps = {
  to: string
  label: string
  sub?: boolean
  onNavigate?: () => void
}

function NavCategoryLink({ to, label, sub, onNavigate }: LinkItemProps) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={`block rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
        sub
          ? 'text-gray-600 hover:bg-brand-50 hover:text-brand-700 pl-5'
          : 'text-gray-800 hover:bg-brand-50 hover:text-brand-700'
      }`}
    >
      {label}
    </Link>
  )
}

/** One category in the desktop nav bar with optional sub dropdown (portaled to escape overflow clip) */
function CategoryNavItem({
  category,
  onNavigate,
}: {
  category: ShopCategory
  onNavigate?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const wrapRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const children = category.children ?? []
  const hasKids = children.length > 0

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  const openMenu = () => {
    cancelClose()
    updatePosition()
    setOpen(true)
  }

  const updatePosition = useCallback(() => {
    const btn = btnRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 6, left: rect.left })
  }, [])

  useEffect(() => {
    if (!open) return
    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (wrapRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const close = () => {
    setOpen(false)
    onNavigate?.()
  }

  if (!hasKids) {
    return (
      <Link
        to={categoryHref(category.id)}
        onClick={onNavigate}
        className="px-4 py-2 rounded-full text-sm font-semibold text-gray-600 hover:text-brand-600 hover:bg-brand-50 transition-all whitespace-nowrap flex-shrink-0"
      >
        {category.name}
      </Link>
    )
  }

  const menu = open
    ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed min-w-[12rem] rounded-2xl border border-gray-100 bg-white shadow-xl py-2 animate-fade-in"
          style={{ top: menuPos.top, left: menuPos.left, zIndex: 200 }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <NavCategoryLink
            to={categoryHref(category.id)}
            label={`Tout ${category.name}`}
            onNavigate={close}
          />
          <div className="my-1 border-t border-gray-100" />
          {children.map((ch) => (
            <NavCategoryLink
              key={ch.id}
              to={categoryHref(ch.id)}
              label={ch.name}
              sub
              onNavigate={close}
            />
          ))}
        </div>,
        document.body
      )
    : null

  return (
    <>
      <div
        ref={wrapRef}
        className="relative flex-shrink-0"
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
      >
        <button
          ref={btnRef}
          type="button"
          onClick={() => {
            if (open) {
              setOpen(false)
            } else {
              openMenu()
            }
          }}
          className={`inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap ${
            open ? 'bg-brand-100 text-brand-700' : 'text-gray-600 hover:text-brand-600 hover:bg-brand-50'
          }`}
          aria-expanded={open}
          aria-haspopup="true"
        >
          {category.name}
          <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {menu}
    </>
  )
}

/** Desktop: horizontal category nav */
export function CategoryNavBar({
  categories,
  onNavigate,
}: {
  categories: ShopCategory[]
  onNavigate?: () => void
}) {
  if (categories.length === 0) {
    return (
      <Link
        to="/produits"
        className="px-4 py-2 rounded-full text-sm font-semibold text-gray-600 hover:text-brand-600 hover:bg-brand-50"
      >
        Boutique
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto scrollbar-hide py-1">
      <Link
        to="/produits"
        onClick={onNavigate}
        className="px-4 py-2 rounded-full text-sm font-semibold text-gray-600 hover:text-brand-600 hover:bg-brand-50 transition-all whitespace-nowrap flex-shrink-0"
      >
        Tout
      </Link>
      {categories.map((cat) => (
        <CategoryNavItem key={cat.id} category={cat} onNavigate={onNavigate} />
      ))}
    </div>
  )
}

/** Mobile hamburger: category list with dropdowns */
export function CategoryNavMobile({
  categories,
  onNavigate,
}: {
  categories: ShopCategory[]
  onNavigate?: () => void
}) {
  const [expanded, setExpanded] = useState<number | null>(null)

  return (
    <nav className="flex flex-col gap-0.5">
      <Link
        to="/produits"
        onClick={onNavigate}
        className="flex items-center justify-between px-4 py-3.5 rounded-xl font-bold text-brand-700 bg-brand-50"
      >
        Toute la boutique
        <ChevronRight size={16} className="text-brand-400" />
      </Link>
      {categories.length === 0 ? (
        <p className="px-4 py-3 text-sm text-gray-400">Aucune catégorie pour le moment.</p>
      ) : (
        categories.map((root) => {
          const hasKids = (root.children?.length ?? 0) > 0
          const isOpen = expanded === root.id
          return (
            <div key={root.id}>
              {hasKids ? (
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : root.id)}
                  className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl font-semibold text-gray-800 hover:bg-brand-50 hover:text-brand-700 text-left"
                  aria-expanded={isOpen}
                >
                  {root.name}
                  <ChevronDown size={20} className={`text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              ) : (
                <Link
                  to={categoryHref(root.id)}
                  onClick={onNavigate}
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl font-semibold text-gray-800 hover:bg-brand-50 hover:text-brand-700"
                >
                  {root.name}
                  <ChevronRight size={16} className="text-gray-400" />
                </Link>
              )}
              {hasKids && isOpen && (
                <div className="ml-4 mr-2 mb-2 border-l-2 border-brand-100 pl-3 space-y-0.5">
                  <Link
                    to={categoryHref(root.id)}
                    onClick={onNavigate}
                    className="block px-3 py-2.5 rounded-lg text-sm font-semibold text-brand-600 hover:bg-brand-50"
                  >
                    Tout {root.name}
                  </Link>
                  {(root.children ?? []).map((ch) => (
                    <Link
                      key={ch.id}
                      to={categoryHref(ch.id)}
                      onClick={onNavigate}
                      className="block px-3 py-2.5 rounded-lg text-sm font-semibold text-gray-600 hover:bg-brand-50 hover:text-brand-700"
                    >
                      {ch.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })
      )}
      <Link
        to="/contact"
        onClick={onNavigate}
        className="flex items-center justify-between px-4 py-3.5 mt-2 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 border-t border-gray-100 pt-4"
      >
        Contact
        <ChevronRight size={16} className="text-gray-400" />
      </Link>
    </nav>
  )
}

/** Footer column from API categories */
export function CategoryFooterLinks({ categories }: { categories: ShopCategory[] }) {
  if (categories.length === 0) {
    return (
      <ul className="space-y-2 text-sm">
        <li>
          <Link to="/produits" className="hover:text-brand-400 transition-colors">
            Tous les produits
          </Link>
        </li>
      </ul>
    )
  }

  return (
    <ul className="space-y-3 text-sm">
      <li>
        <Link to="/produits" className="hover:text-brand-400 transition-colors font-semibold">
          Tous les produits
        </Link>
      </li>
      {categories.map((root) => (
        <li key={root.id}>
          <Link to={categoryHref(root.id)} className="hover:text-brand-400 transition-colors font-semibold text-white/90">
            {root.name}
          </Link>
          {(root.children ?? []).length > 0 && (
            <ul className="mt-1.5 ml-3 space-y-1 border-l border-gray-700 pl-3">
              {(root.children ?? []).map((ch) => (
                <li key={ch.id}>
                  <Link to={categoryHref(ch.id)} className="text-gray-400 hover:text-brand-400 transition-colors">
                    {ch.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Mobile bottom sheet: categories (Boutique tab) */
export function CategoryShopSheet({
  open,
  onClose,
  categories,
}: {
  open: boolean
  onClose: () => void
  categories: ShopCategory[]
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Fermer" />
      <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl animate-fade-in pb-[calc(env(safe-area-inset-bottom,0px)+4.5rem)]">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <h2 className="font-display font-bold text-lg text-gray-900">Catégories</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-500" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>
        <div className="p-3">
          <CategoryNavMobile categories={categories} onNavigate={onClose} />
        </div>
      </div>
    </div>
  )
}
