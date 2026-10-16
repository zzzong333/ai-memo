import { WheelItem } from '@/types/wheel'

const STORAGE_KEY = 'wheel-items'

const isWheelItem = (value: unknown): value is WheelItem => {
  if (typeof value !== 'object' || value === null) return false
  const item = value as Record<string, unknown>
  return (
    typeof item.id === 'string' &&
    typeof item.label === 'string' &&
    (item.memoId === undefined || typeof item.memoId === 'string')
  )
}

export const wheelStorage = {
  getItems: (): WheelItem[] => {
    // SSR 환경 체크 필수
    if (typeof window === 'undefined') return []

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.filter(isWheelItem) : []
    } catch (error) {
      console.error('Error reading wheel items:', error)
      return []
    }
  },

  saveItems: (items: WheelItem[]): void => {
    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch (error) {
      console.error('Error saving wheel items:', error)
    }
  },
}
