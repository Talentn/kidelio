import type { ProductRating } from '../components/ProductStarRating'

const BASE_URL = 'https://kideliowear.com'

export type ProductReviewPreview = {
  stars: number
  created_at: string
  author_name: string
}

type ProductSchemaInput = {
  id: number
  name: string
  slug: string
  description?: string
  effective_price: number
  in_stock: boolean
  image_urls: string[]
  category?: { name: string }
}

const MERCHANT_RETURN_POLICY = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'TN',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 7,
  returnMethod: 'https://schema.org/ReturnByMail',
  returnFees: 'https://schema.org/FreeReturn',
}

function buildShippingDetails(shippingCost = 7) {
  return {
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: shippingCost.toFixed(3),
      currency: 'TND',
    },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: 'TN',
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        minValue: 1,
        maxValue: 2,
        unitCode: 'DAY',
      },
      transitTime: {
        '@type': 'QuantitativeValue',
        minValue: 2,
        maxValue: 5,
        unitCode: 'DAY',
      },
    },
  }
}

function absoluteImageUrl(url: string) {
  return url.startsWith('http') ? url : `${BASE_URL}${url}`
}

function productDescription(product: ProductSchemaInput) {
  return (
    product.description?.trim() ||
    `Achetez ${product.name} sur Kidelio. Livraison rapide en Tunisie, paiement à la livraison.`
  )
}

function buildReviewJsonLd(reviews: ProductReviewPreview[]) {
  return reviews.map((review) => ({
    '@type': 'Review',
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.stars,
      bestRating: 5,
      worstRating: 1,
    },
    author: {
      '@type': 'Person',
      name: review.author_name,
    },
    datePublished: review.created_at.slice(0, 10),
  }))
}

export function buildProductJsonLd(
  product: ProductSchemaInput,
  rating: ProductRating,
  reviews: ProductReviewPreview[] = [],
  shippingCost = 7,
) {
  const productUrl = `${BASE_URL}/produits/${product.slug}`
  const images = product.image_urls.length
    ? product.image_urls.map(absoluteImageUrl)
    : [`${BASE_URL}/kidelio-logo.png`]

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: productDescription(product),
    image: images.length === 1 ? images[0] : images,
    sku: String(product.id),
    url: productUrl,
    brand: { '@type': 'Brand', name: 'Kidelio' },
    ...(product.category && { category: product.category.name }),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'TND',
      price: Number(product.effective_price).toFixed(3),
      itemCondition: 'https://schema.org/NewCondition',
      availability: product.in_stock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: productUrl,
      seller: { '@type': 'Organization', name: 'Kidelio' },
      hasMerchantReturnPolicy: MERCHANT_RETURN_POLICY,
      shippingDetails: buildShippingDetails(shippingCost),
    },
    ...(rating.count > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: rating.average,
        reviewCount: rating.count,
        bestRating: 5,
        worstRating: 1,
      },
    }),
    ...(reviews.length > 0 && { review: buildReviewJsonLd(reviews) }),
  }
}
