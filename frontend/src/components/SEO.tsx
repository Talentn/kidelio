import { Helmet } from 'react-helmet-async'
import { useLocation } from 'react-router-dom'

const SITE_NAME = 'Kidelio'
const BASE_URL = 'https://kideliowear.com'
const DEFAULT_IMAGE = `${BASE_URL}/kidelio-logo.png`
const DEFAULT_DESCRIPTION =
  'Kidelio — La boutique en ligne dédiée aux bébés et enfants en Tunisie. Vêtements, jouets et essentiels à prix accessibles. Livraison rapide, paiement à la livraison.'

interface SEOProps {
  title?: string
  description?: string
  image?: string
  url?: string
  type?: 'website' | 'product'
  noIndex?: boolean
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
}

export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  noIndex = false,
  jsonLd,
}: SEOProps) {
  const location = useLocation()
  const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Mode & jouets pour enfants`
  const canonicalPath = url ?? (location.pathname || '/')
  const canonicalUrl = `${BASE_URL}${canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`}`
  const absoluteImage = image.startsWith('http') ? image : `${BASE_URL}${image}`

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={absoluteImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={type === 'product' ? 'product' : 'website'} />
      <meta property="og:locale" content="fr_TN" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteImage} />

      {/* JSON-LD structured data */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(Array.isArray(jsonLd) ? jsonLd : [jsonLd])}
        </script>
      )}
    </Helmet>
  )
}
