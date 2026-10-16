import { Memo } from '@/types/memo'

// Supabase memos 테이블 row (snake_case)
export interface MemoRow {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  created_at: string
  updated_at: string
  summary: string | null
  summarized_at: string | null
}

export const rowToMemo = (row: MemoRow): Memo => ({
  id: row.id,
  title: row.title,
  content: row.content,
  category: row.category,
  tags: row.tags ?? [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  ...(row.summary !== null && { summary: row.summary }),
  ...(row.summarized_at !== null && { summarizedAt: row.summarized_at }),
})
