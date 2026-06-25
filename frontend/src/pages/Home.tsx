import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Banknote, RefreshCw, ShieldCheck, Truck } from 'lucide-react'
import { api, apiV1Fresh, peekCacheV1, peekFreshCacheV1 } from '../api/client'
import { SEO } from '../components/SEO'
import { HeroCarousel, type HeroSlide } from '../components/home/HeroCarousel'
import { FallbackHero } from '../components/home/FallbackHero'
import { AgeShopRail } from '../components/home/AgeShopRail'
import { CategoryPhotoGrid } from '../components/home/CategoryPhotoGrid'
import type { ShopCategory } from '../lib/categories'
import { ProductRow } from '../components/home/ProductRow'
import { ValuesStrip } from '../components/home/ValuesStrip'
import type { HomeProduct } from '../components/home/ProductCard'

const SLICE = 8

const DEFAULT_ASSETS = {
  hero_fallback: '/hero-femme.png',
  banner_collection: '/banner-collection.png',
  banner_babies: '/banner-babies.png',
  banner_toys: '/banner-toys.png',
}

const LCP_HERO_KEY = 'kidelio_lcp_hero'

type HomeAssets = Record<string, string | null | undefined>

function resolveHeroImage(sliders: HeroSlide[], assets: HomeAssets): string {
  const slideImage = sliders.find((s) => s.image_url)?.image_url
  if (slideImage) return slideImage
  return assets.hero_fallback || DEFAULT_ASSETS.hero_fallback
}

export function Home() {
  const cachedHome = peekFreshCacheV1<{ assets: HomeAssets; sliders: HeroSlide[] }>('/homepage')
  const [sliders, setSliders] = useState<HeroSlide[]>(() => cachedHome?.sliders ?? [])
  const [assets, setAssets] = useState<HomeAssets>(() => cachedHome?.assets ?? {})
  const [homeHeroReady, setHomeHeroReady] = useState(() => Boolean(cachedHome))
  const [categories, setCategories] = useState<ShopCategory[]>(
    () => peekCacheV1<{ categories: ShopCategory[] }>('/categories')?.categories ?? []
  )
  const [newIn, setNewIn] = useState<HomeProduct[]>(
    () => peekCacheV1<{ products: HomeProduct[] }>('/products')?.products?.slice(0, SLICE) ?? []
  )
  const [promos, setPromos] = useState<HomeProduct[]>(
    () => peekCacheV1<{ products: HomeProduct[] }>('/products?on_promo=true')?.products?.slice(0, SLICE) ?? []
  )
  const [featured, setFeatured] = useState<HomeProduct[]>(
    () => peekCacheV1<{ products: HomeProduct[] }>('/products?featured=true')?.products?.slice(0, SLICE) ?? []
  )
  const [loading, setLoading] = useState(
    () => !peekCacheV1('/products?featured=true')
  )

  useEffect(() => {
    const heroImage = resolveHeroImage(sliders, assets)
    try {
      sessionStorage.setItem(LCP_HERO_KEY, heroImage)
    } catch {
      /* private browsing */
    }
    const link = document.querySelector<HTMLLinkElement>('link[data-lcp-hero]')
    if (link) link.href = heroImage
  }, [sliders, assets])

  useEffect(() => {
    Promise.all([
      apiV1Fresh<{ assets: HomeAssets; sliders: HeroSlide[] }>('/homepage'),
      api<{ categories: ShopCategory[] }>('/categories'),
      api<{ products: HomeProduct[] }>('/products'),
      api<{ products: HomeProduct[] }>('/products?on_promo=true'),
      api<{ products: HomeProduct[] }>('/products?featured=true'),
    ])
      .then(([home, cd, all, promo, feat]) => {
        setAssets(home.assets ?? {})
        setSliders(home.sliders ?? [])
        setCategories(cd.categories)
        setNewIn(all.products.slice(0, SLICE))
        setPromos(promo.products.slice(0, SLICE))
        setFeatured(feat.products.slice(0, SLICE))
        setHomeHeroReady(true)
      })
      .catch(() => setHomeHeroReady(true))
      .finally(() => setLoading(false))
  }, [])

  const img = (key: keyof typeof DEFAULT_ASSETS) =>
    assets[key] || DEFAULT_ASSETS[key]

  const slidesWithImage = sliders.filter((s) => Boolean(s.image_url))

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Kidelio',
      url: 'https://kideliowear.com',
      description: 'Boutique de mode femme & enfant en Tunisie. Robes, prêt-à-porter et essentiels.',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://kideliowear.com/produits?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Kidelio',
      url: 'https://kideliowear.com',
      logo: 'https://kideliowear.com/kidelio-logo.png',
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        availableLanguage: 'French',
        areaServed: 'TN',
      },
    },
  ]

  return (
    <div className="bg-white">
      <SEO url="/" jsonLd={jsonLd} />
      {/* Fixed-height hero — show fallback immediately; swap to carousel only when confirmed */}
      <div className="hero-slot min-h-[420px] sm:min-h-[480px] md:min-h-[560px] lg:min-h-[620px]">
        {homeHeroReady && slidesWithImage.length > 0 ? (
          <HeroCarousel slides={slidesWithImage} />
        ) : (
          <FallbackHero heroImage={img('hero_fallback')} />
        )}
      </div>

      <div className="age-rail-slot min-h-[148px] sm:min-h-[156px]">
        {homeHeroReady ? <AgeShopRail /> : null}
      </div>

      <div className="border-y border-gray-100 bg-white">
        <div className="page-wrap py-3">
          <div className="flex items-center gap-6 xs:gap-10 overflow-x-auto scrollbar-hide">
            {[
              { icon: Truck, text: 'Livraison partout en Tunisie' },
              { icon: Banknote, text: 'Paiement à la livraison' },
              { icon: ShieldCheck, text: 'Qualité garantie' },
              { icon: RefreshCw, text: 'Échanges faciles' },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-2 text-xs font-semibold text-gray-600 whitespace-nowrap flex-shrink-0 py-1"
              >
                <Icon size={14} className="text-brand-500 flex-shrink-0" />
                {text}
              </div>
            ))}
          </div>
        </div>
      </div>

      <CategoryPhotoGrid categories={categories} assets={assets} />

      <section className="page-wrap py-8 md:py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <Link
            to="/produits"
            className="group relative overflow-hidden rounded-2xl md:col-span-2 h-64 sm:h-80 md:h-96 block"
          >
            <img
              src={img('banner_collection')}
              alt="Mode femme"
              className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 p-5 md:p-7">
              <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Prêt-à-porter</p>
              <h3 className="font-display font-bold text-2xl md:text-3xl text-white leading-snug mb-3">
                Mode Femme
              </h3>
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-white border-b border-white pb-0.5 group-hover:gap-3 transition-all">
                Découvrir <ArrowRight size={14} />
              </span>
            </div>
          </Link>
          <div className="flex flex-col gap-3 md:gap-4">
            <Link
              to="/produits?q=robe"
              className="group relative overflow-hidden rounded-2xl h-48 md:h-auto md:flex-1 block"
            >
              <img
                src={img('banner_babies')}
                alt="Robes femme"
                className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 p-4 md:p-5">
                <p className="text-white/70 text-[11px] font-bold uppercase tracking-widest mb-0.5">Tendance</p>
                <h3 className="font-display font-bold text-lg md:text-xl text-white leading-tight">Robes</h3>
              </div>
            </Link>
            <Link
              to="/produits?age=6-12"
              className="group relative overflow-hidden rounded-2xl h-48 md:h-auto md:flex-1 block"
            >
              <img
                src={img('banner_toys')}
                alt="Mode enfant"
                className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 p-4 md:p-5">
                <p className="text-white/70 text-[11px] font-bold uppercase tracking-widest mb-0.5">Pour les petits</p>
                <h3 className="font-display font-bold text-lg md:text-xl text-white leading-tight">Enfant</h3>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <ProductRow
        title="Nouveautés"
        subtitle="Les dernières arrivées en boutique"
        viewAllHref="/produits"
        products={newIn}
        loading={loading}
        bg="muted"
      />

      <ProductRow
        title="Promotions"
        subtitle="Les meilleures offres du moment"
        viewAllHref="/produits?on_promo=true"
        products={promos}
        loading={loading}
        bg="white"
      />

      <ProductRow
        title="Coups de cœur"
        subtitle="Nos favoris de la saison"
        viewAllHref="/produits?featured=true"
        products={featured}
        loading={loading}
        bg="muted"
      />

      <section className="page-wrap py-8 md:py-10">
        <div className="relative overflow-hidden rounded-2xl bg-gray-900 text-white flex flex-col md:flex-row items-center gap-6 md:gap-0 px-8 md:px-14 py-10 md:py-12">
          <div className="flex-1 text-center md:text-left">
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Offre spéciale</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight mb-2">Livraison offerte</h2>
            <p className="text-gray-300 text-sm">
              Pour toute commande supérieure à <strong className="text-white">200 TND</strong>
            </p>
          </div>
          <div className="hidden md:block w-px h-20 bg-white/10 mx-14" />
          <div className="text-center md:text-right">
            <Link
              to="/produits?on_promo=true"
              className="inline-flex items-center gap-2 bg-white text-gray-900 font-bold px-7 py-3.5 rounded-full hover:bg-gray-100 transition-colors text-sm"
            >
              Profiter de l&apos;offre <ArrowRight size={16} />
            </Link>
          </div>
          <div className="absolute -left-12 -top-12 w-40 h-40 bg-white/5 rounded-full pointer-events-none" />
          <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full pointer-events-none" />
        </div>
      </section>

      <ValuesStrip />

      <section className="bg-brand-50 border-t border-brand-100">
        <div className="page-wrap py-10 md:py-12 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <h2 className="font-display text-xl md:text-2xl font-bold text-gray-900 mb-1">
              Besoin d&apos;un conseil taille ?
            </h2>
            <p className="text-gray-600 text-sm">Notre équipe vous répond rapidement par téléphone ou e-mail.</p>
          </div>
          <Link to="/contact" className="btn-primary btn-sm whitespace-nowrap">
            Nous contacter <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </div>
  )
}
