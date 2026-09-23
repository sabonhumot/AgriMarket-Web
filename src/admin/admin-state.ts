import type { ReviewItem, ReviewStatus } from './types'

export type SearchableRecord = Record<'title' | 'subject' | 'type', string>

export function matchesQuery(record: SearchableRecord, query: string) {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return true

  return [record.title, record.subject, record.type]
    .some((value) => value.toLocaleLowerCase().includes(normalized))
}

export function updateReviewStatus<T extends Pick<ReviewItem, 'id' | 'status'>>(
  items: T[],
  id: string,
  status: ReviewStatus,
) {
  return items.map((item) => item.id === id ? { ...item, status } : item)
}
