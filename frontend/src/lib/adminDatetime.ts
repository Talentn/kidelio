const TZ = 'Africa/Tunis'

/** Full date + time for admin tables (Tunisia). */
export function formatAdminDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('fr-TN', {
    timeZone: TZ,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Short date for charts. */
export function formatAdminDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-TN', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
  })
}

/** Relative label: "il y a 5 min" or full date if older than 24h. */
export function formatAdminRelative(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 60_000) return "à l'instant"
  if (diff < 3_600_000) return `il y a ${Math.round(diff / 60_000)} min`
  if (diff < 86_400_000) return `il y a ${Math.round(diff / 3_600_000)} h`
  return formatAdminDateTime(iso)
}

export function formatPctChange(pct: number | null | undefined): string {
  if (pct == null) return '—'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct}%`
}
