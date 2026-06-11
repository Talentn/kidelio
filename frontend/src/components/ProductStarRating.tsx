import { useState } from 'react'
import { Star } from 'lucide-react'
import { apiV1 as api } from '../lib/api'

export type ProductRating = {
  average: number
  count: number
  user_stars?: number | null
}

type Props = {
  productSlug: string
  rating: ProductRating
  onRated: (rating: ProductRating) => void
}

export function ProductStarRating({ productSlug, rating, onRated }: Props) {
  const [hover, setHover] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const displayAverage = rating.count > 0 ? rating.average.toFixed(1) : null
  const activeStars = hover || rating.user_stars || 0

  const submit = async (stars: number) => {
    if (submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res = await api<{ rating: ProductRating; user_stars: number }>(
        `/products/${productSlug}/review`,
        { method: 'POST', body: JSON.stringify({ stars }) },
      )
      onRated({ ...res.rating, user_stars: res.user_stars })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible d\'enregistrer votre note')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className="flex items-center gap-0.5"
          onMouseLeave={() => setHover(0)}
          role="group"
          aria-label="Noter ce produit"
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = n <= activeStars
            return (
              <button
                key={n}
                type="button"
                disabled={submitting}
                onMouseEnter={() => setHover(n)}
                onClick={() => submit(n)}
                aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
                className="p-0.5 text-amber-400 hover:scale-110 transition-transform disabled:opacity-50"
              >
                <Star
                  size={24}
                  fill={filled ? 'currentColor' : 'none'}
                  strokeWidth={filled ? 0 : 1.5}
                />
              </button>
            )
          })}
        </div>

        {displayAverage ? (
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-800">{displayAverage}</span>
            {' · '}
            {rating.count} avis
          </p>
        ) : (
          <p className="text-sm text-gray-500">Soyez le premier à noter</p>
        )}
      </div>

      {rating.user_stars ? (
        <p className="text-xs text-gray-500 mt-1.5">Votre note : {rating.user_stars}/5</p>
      ) : (
        <p className="text-xs text-gray-500 mt-1.5">Cliquez pour noter ce produit</p>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}
