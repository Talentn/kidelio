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
  Heart,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useFavorites } from '../context/FavoritesContext'
import { useUI } from '../context/UIContext'
import { useShopCategories } from '../hooks/useShopCategories'
import { CategoryFooterLinks, CategoryNavBar, CategoryNavMobile, CategoryShopSheet } from './CategoryNavMenu'
import { UserAccountMenu } from './UserAccountMenu'
import { CartDrawer } from './CartDrawer'

export function Layout() {
  const { user } = useAuth()
  const { count } = useCart()
  const { count: favCount } = useFavorites()
  const { openCart } = useUI()
  const [menuOpen, setMenuOpen] = useState(false)
  const [shopSheetOpen, setShopSheetOpen] = useState(false)
  const location = useLocation()
  const categories = useShopCategories()

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="flex flex-col min-h-dvh">
      {/* ── Announcement bar ── */}
      <div className="bg-ink text-white/90 text-center text-xs sm:text-sm py-2 px-4 font-medium flex items-center justify-center gap-2 flex-wrap" role="status">
        <span className="inline-flex items-center gap-1.5"><Truck size={14} /> Livraison gratuite dès 200 TND</span>
        <span className="text-white/30">·</span>
        <span className="inline-flex items-center gap-1.5"><Banknote size={14} /> Paiement à la livraison</span>
      </div>

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm overflow-visible" role="banner">
        <div className="page-wrap flex items-center gap-2 sm:gap-3 h-20 md:h-24 overflow-visible">
          {/* Logo */}
          <Link to="/" className="flex items-center flex-shrink-0 mr-1 md:mr-2 min-w-0" aria-label="Kidelio — Accueil">
            <img src="/kidelio-logo.png" alt="" width={160} height={80} className="h-12 sm:h-14 md:h-20 w-auto object-contain" />
          </Link>

          {/* Desktop: category nav */}
          <nav className="hidden md:flex flex-1 min-w-0 items-center overflow-visible" aria-label="Catégories">
            <CategoryNavBar categories={categories} />
          </nav>

          {/* Right: account, cart, mobile menu */}
          <div className="ml-auto flex items-center gap-1 sm:gap-2 flex-shrink-0">
            <div className="flex-shrink-0 max-w-[9rem] sm:max-w-[11rem]">
              <UserAccountMenu align="right" />
            </div>

            <Link
              to="/favoris"
              className="relative min-w-11 min-h-11 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-gray-600 hover:text-pink-500"
              aria-label={favCount > 0 ? `Mes favoris, ${favCount} article${favCount > 1 ? 's' : ''}` : 'Mes favoris'}
            >
              <Heart size={20} />
              {favCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-pink-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {favCount > 9 ? '9+' : favCount}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={openCart}
              className="relative flex items-center gap-1.5 btn-primary btn-sm min-h-11"
              aria-label={count > 0 ? `Panier, ${count} article${count > 1 ? 's' : ''}` : 'Ouvrir le panier'}
            >
              <ShoppingBag size={17} aria-hidden="true" />
              <span className="hidden sm:inline">Panier</span>
              {count > 0 && (
                <span className="absolute -top-2 -right-2 bg-amber-400 text-gray-900 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm" aria-hidden="true">
                  {count}
                </span>
              )}
            </button>

            <button
              type="button"
              className="md:hidden min-w-11 min-h-11 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls="mobile-category-menu"
              aria-label={menuOpen ? 'Fermer le menu catégories' : 'Ouvrir le menu catégories'}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile: categories menu */}
        {menuOpen && (
          <div id="mobile-category-menu" className="md:hidden border-t border-gray-100 bg-white animate-fade-in max-h-[70vh] overflow-y-auto">
            <div className="page-wrap py-4">
              <CategoryNavMobile categories={categories} onNavigate={closeMenu} />
            </div>
          </div>
        )}
      </header>

      {/* ── Main content ── */}
      <main id="main-content" className="flex-1" tabIndex={-1}>
        <Outlet />
      </main>

      {/* ── Footer ── */}
      <footer className="bg-gray-900 text-gray-300 mt-16 pb-16 md:pb-0" role="contentinfo">
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
              <a
                href="https://www.facebook.com/profile.php?id=61590348549914"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Kidelio sur Facebook"
                className="p-2 rounded-full bg-gray-800 hover:bg-brand-500 text-gray-400 hover:text-white transition-colors"
              >
                <Facebook size={16} />
              </a>
              <a
                href="https://www.instagram.com/kideliowear/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Kidelio sur Instagram"
                className="p-2 rounded-full bg-gray-800 hover:bg-brand-500 text-gray-400 hover:text-white transition-colors"
              >
                <Instagram size={16} />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Boutique</h3>
            <CategoryFooterLinks categories={categories} />
            <ul className="space-y-2 text-sm mt-4">
              <li><Link to="/favoris" className="hover:text-brand-400 transition-colors">Mes favoris</Link></li>
              <li><Link to="/suivi" className="hover:text-brand-400 transition-colors">Suivre ma commande</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Contact</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2"><Phone size={14} className="text-brand-400" /><span>+216 XX XXX XXX</span></li>
              <li className="flex items-center gap-2"><Mail size={14} className="text-brand-400" /><span>contact@kideliowear.com</span></li>
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
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 grid grid-cols-5 shadow-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Navigation mobile"
      >
        {[
          { to: '/', label: 'Accueil', icon: <Home size={20} aria-hidden="true" />, action: 'link' as const },
          { to: '/produits', label: 'Boutique', icon: <Grid3X3 size={20} aria-hidden="true" />, action: 'shop' as const },
          { to: '/favoris', label: 'Favoris', icon: <Heart size={20} aria-hidden="true" />, action: 'link' as const },
          {
            to: user ? '/compte' : '/connexion',
            label: 'Compte',
            icon: <User size={20} aria-hidden="true" />,
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
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center min-h-14 py-2 gap-0.5 text-[11px] font-semibold transition-colors w-full ${
                  isActive ? 'text-brand-600' : 'text-gray-500 hover:text-brand-500'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            )
          }

          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.to === '/favoris' && favCount > 0 ? `Favoris, ${favCount} article${favCount > 1 ? 's' : ''}` : item.label}
              className={`flex flex-col items-center justify-center min-h-14 py-2 gap-0.5 text-[11px] font-semibold transition-colors ${
                isActive ? 'text-brand-600' : 'text-gray-500 hover:text-brand-500'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.to === '/favoris' && favCount > 0 && (
                <span className="sr-only">{favCount} favori{favCount > 1 ? 's' : ''}</span>
              )}
            </Link>
          )
        })}
        <button
          type="button"
          onClick={openCart}
          aria-label={count > 0 ? `Panier, ${count} article${count > 1 ? 's' : ''}` : 'Panier'}
          className="flex flex-col items-center justify-center min-h-14 py-2 gap-0.5 text-[11px] font-semibold text-gray-500 hover:text-brand-500 transition-colors relative"
        >
          {count > 0 && (
            <span className="absolute top-2 right-1/2 translate-x-4 bg-brand-500 text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center" aria-hidden="true">
              {count > 9 ? '9+' : count}
            </span>
          )}
          <ShoppingBag size={20} aria-hidden="true" />
          <span>Panier</span>
        </button>
      </nav>

      <CategoryShopSheet open={shopSheetOpen} onClose={() => setShopSheetOpen(false)} categories={categories} />
      <CartDrawer />
    </div>
  )
}
