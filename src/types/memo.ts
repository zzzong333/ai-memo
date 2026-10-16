export interface Memo {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  createdAt: string
  updatedAt: string
  summary?: string
  summarizedAt?: string
}

export interface MemoFormData {
  title: string
  content: string
  category: string
  tags: string[]
}

export type MemoCategory = 'personal' | 'work' | 'study' | 'idea' | 'other'

export const MEMO_CATEGORIES: Record<MemoCategory, string> = {
  personal: '개인',
  work: '업무',
  study: '학습',
  idea: '아이디어',
  other: '기타',
}

export const CATEGORY_COLORS: Record<MemoCategory, string> = {
  personal: 'bg-blue-100 text-blue-800',
  work: 'bg-green-100 text-green-800',
  study: 'bg-purple-100 text-purple-800',
  idea: 'bg-yellow-100 text-yellow-800',
  other: 'bg-gray-100 text-gray-800',
}

export const DEFAULT_CATEGORIES = Object.keys(MEMO_CATEGORIES) as MemoCategory[]
