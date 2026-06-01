import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  ShoppingBag,
  User,
  Home,
  Grid3X3,
  Menu,
  X,
  Phone,
  Mail,
  Instagram,
  Facebook,
  ChevronRight,
  Truck,
  ShieldCheck,
  Headphones,
  Banknote,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useUI } from '../context/UIContext'
import { useShopCategories } from '../hooks/useShopCategories'
import { CategoryFooterLinks, CategoryNavBar, CategoryNavMobile, CategoryShopSheet } from './CategoryNavMenu'
import { UserAccountMenu } from './UserAccountMenu'
import { CartDrawer } from './CartDrawer'

export function Layout() {
  const { user } = useAuth()
  const { count } = useCart()
  const { openCart } = useUI()
  const [menuOpen, setMenuOpen] = useState(false)
  const [shopSheetOpen, setShopSheetOpen] = useState(false)
  const location = useLocation()
  const categories = useShopCategories()

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="flex flex-col min-h-dvh">
      {/* ── Announcement bar ── */}
      <div className="bg-ink text-white/90 text-center text-xs sm:text-sm py-2 px-4 font-medium flex items-center justify-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5"><Truck size={14} /> Livraison gratuite dès 200 TND</span>
        <span className="text-white/30">·</span>
        <span className="inline-flex items-center gap-1.5"><Banknote size={14} /> Paiement à la livraison</span>
      </div>

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm overflow-visible">
        <div className="page-wrap flex items-center gap-2 sm:gap-3 h-20 md:h-24 overflow-visible">
          {/* Logo */}
          <Link to="/" className="flex items-center flex-shrink-0 mr-1 md:mr-2 min-w-0">
            <img src="/kidelio-logo.png" alt="Kidelio" className="h-12 sm:h-14 md:h-20 w-auto object-contain" />
          </Link>

          {/* Desktop: category nav */}
          <nav className="hidden md:flex flex-1 min-w-0 items-center overflow-visible">
            <CategoryNavBar categories={categories} />
          </nav>

          {/* Right: account, cart, mobile menu */}
          <div className="ml-auto flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <div className="flex-shrink-0 max-w-[9rem] sm:max-w-[11rem]">
              <UserAccountMenu align="right" />
            </div>

            <button
              type="button"
              onClick={openCart}
              className="relative flex items-center gap-1.5 btn-primary btn-sm"
            >
              <ShoppingBag size={17} />
              <span className="hidden sm:inline">Panier</span>
              {count > 0 && (
                <span className="absolute -top-2 -right-2 bg-amber-400 text-gray-900 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                  {count}
                </span>
              )}
            </button>

            <button
              type="button"
              className="md:hidden p-2 rounded-full hover:bg-gray-100 transition-colors"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu catégories"
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile: categories menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white animate-fade-in max-h-[70vh] overflow-y-auto">
            <div className="page-wrap py-4">
              <CategoryNavMobile categories={categories} onNavigate={closeMenu} />
            </div>
          </div>
        )}
      </header>

      {/* ── Main content ── */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 text-gray-300 mt-16 pb-16 md:pb-0">
        <div className="border-b border-gray-800">
          <div className="page-wrap py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: <Truck size={24} />, title: 'Livraison rapide', desc: 'Partout en Tunisie' },
              { icon: <Banknote size={24} />, title: 'Paiement à la livraison', desc: 'En espèces, sans frais' },
              { icon: <ShieldCheck size={24} />, title: 'Qualité garantie', desc: 'Articles soigneusement sélectionnés' },
              { icon: <Headphones size={24} />, title: 'Service client', desc: 'Disponible 7j/7' },
            ].map((b) => (
              <div key={b.title} className="flex items-center gap-3">
                <div className="text-brand-400 flex-shrink-0">{b.icon}</div>
                <div>
                  <p className="text-white font-bold text-sm">{b.title}</p>
                  <p className="text-gray-500 text-xs">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="page-wrap py-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          <div>
            <div className="mb-4">
              <img src="/kidelio-logo.png" alt="Kidelio" className="h-12 w-auto object-contain brightness-0 invert opacity-90" />
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              La boutique en ligne dédiée aux bébés et aux enfants en Tunisie.
              Mode, jouets et essentiels à prix accessibles.
            </p>
            <div className="flex gap-3 mt-4">
              <a href="#" className="p-2 rounded-full bg-gray-800 hover:bg-brand-500 text-gray-400 hover:text-white transition-colors">
                <Facebook size={16} />
              </a>
              <a href="#" className="p-2 rounded-full bg-gray-800 hover:bg-brand-500 text-gray-400 hover:text-white transition-colors">
                <Instagram size={16} />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Boutique</h3>
            <CategoryFooterLinks categories={categories} />
            <ul className="space-y-2 text-sm mt-4">
              <li><Link to="/suivi" className="hover:text-brand-400 transition-colors">Suivre ma commande</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Contact</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><Phone size={14} className="text-brand-400" /><span>+216 XX XXX XXX</span></li>
              <li className="flex items-center gap-2"><Mail size={14} className="text-brand-400" /><span>contact@kidelio.tn</span></li>
            </ul>
            <Link
              to="/contact"
              className="inline-flex items-center gap-1.5 mt-4 text-sm text-brand-400 hover:text-brand-300 font-semibold transition-colors"
            >
              Nous contacter <ChevronRight size={14} />
            </Link>
          </div>
        </div>

        <div className="border-t border-gray-800">
          <div className="page-wrap py-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-gray-600">
            <p>© {new Date().getFullYear()} Kidelio — Tous droits réservés</p>
            <p>Conçu avec soin en Tunisie</p>
          </div>
        </div>
      </footer>

      {/* ── Mobile bottom nav ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 grid grid-cols-4 shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {[
          { to: '/', label: 'Accueil', icon: <Home size={20} />, action: 'link' as const },
          { to: '/produits', label: 'Catégories', icon: <Grid3X3 size={20} />, action: 'shop' as const },
          {
            to: user ? '/compte' : '/connexion',
            label: 'Compte',
            icon: <User size={20} />,
            action: 'link' as const,
          },
        ].map((item) => {
          const isActive =
            item.action === 'shop'
              ? location.pathname.startsWith('/produits')
              : item.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.to)

          if (item.action === 'shop') {
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => setShopSheetOpen(true)}
                className={`flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-semibold transition-colors w-full ${
                  isActive ? 'text-brand-600' : 'text-gray-400 hover:text-brand-500'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            )
          }

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-semibold transition-colors ${
                isActive ? 'text-brand-600' : 'text-gray-400 hover:text-brand-500'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={openCart}
          className="flex flex-col items-center justify-center py-2 gap-0.5 text-xs font-semibold text-gray-400 hover:text-brand-500 transition-colors relative"
        >
          {count > 0 && (
            <span className="absolute top-1.5 right-1/2 translate-x-3 -translate-y-0.5 bg-brand-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {count}
            </span>
          )}
          <ShoppingBag size={20} />
          Panier
        </button>
      </nav>

      <CategoryShopSheet open={shopSheetOpen} onClose={() => setShopSheetOpen(false)} categories={categories} />
      <CartDrawer />
    </div>
  )
}
