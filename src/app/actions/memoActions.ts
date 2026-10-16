'use server'

import { v4 as uuidv4 } from 'uuid'
import { DEFAULT_CATEGORIES, Memo, MemoFormData } from '@/types/memo'
import { getSupabaseServer } from '@/utils/supabaseServer'
import { MemoRow, rowToMemo } from '@/utils/memoMapper'

const MAX_TITLE_LENGTH = 200
const MAX_CONTENT_LENGTH = 100000
const MAX_TAGS = 50

const validateFormData = (formData: MemoFormData): MemoFormData => {
  const title = formData.title?.trim()
  if (!title || title.length > MAX_TITLE_LENGTH) {
    throw new Error('제목이 올바르지 않습니다.')
  }
  if (
    typeof formData.content !== 'string' ||
    formData.content.length > MAX_CONTENT_LENGTH
  ) {
    throw new Error('내용이 올바르지 않습니다.')
  }
  if (!(DEFAULT_CATEGORIES as string[]).includes(formData.category)) {
    throw new Error('카테고리가 올바르지 않습니다.')
  }
  if (!Array.isArray(formData.tags) || formData.tags.length > MAX_TAGS) {
    throw new Error('태그가 올바르지 않습니다.')
  }
  return {
    title,
    content: formData.content,
    category: formData.category,
    tags: formData.tags.map(tag => String(tag)),
  }
}

export async function getMemosAction(): Promise<Memo[]> {
  const { data, error } = await getSupabaseServer()
    .from('memos')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Failed to fetch memos:', error)
    throw new Error('메모를 불러오지 못했습니다.')
  }
  return (data as MemoRow[]).map(rowToMemo)
}

export async function createMemoAction(formData: MemoFormData): Promise<Memo> {
  const valid = validateFormData(formData)
  const now = new Date().toISOString()
  const { data, error } = await getSupabaseServer()
    .from('memos')
    .insert({ id: uuidv4(), ...valid, created_at: now, updated_at: now })
    .select()
    .single()
  if (error) {
    console.error('Failed to create memo:', error)
    throw new Error('메모를 저장하지 못했습니다.')
  }
  return rowToMemo(data as MemoRow)
}

export async function updateMemoAction(
  id: string,
  formData: MemoFormData
): Promise<Memo> {
  const valid = validateFormData(formData)
  const { data, error } = await getSupabaseServer()
    .from('memos')
    .update({ ...valid, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('Failed to update memo:', error)
    throw new Error('메모를 수정하지 못했습니다.')
  }
  return rowToMemo(data as MemoRow)
}

// 요약 저장: updated_at은 변경하지 않음
export async function setMemoSummaryAction(
  id: string,
  summary: string
): Promise<Memo> {
  const { data, error } = await getSupabaseServer()
    .from('memos')
    .update({ summary, summarized_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) {
    console.error('Failed to save summary:', error)
    throw new Error('요약을 저장하지 못했습니다.')
  }
  return rowToMemo(data as MemoRow)
}

export async function deleteMemoAction(id: string): Promise<void> {
  const { error } = await getSupabaseServer()
    .from('memos')
    .delete()
    .eq('id', id)
  if (error) {
    console.error('Failed to delete memo:', error)
    throw new Error('메모를 삭제하지 못했습니다.')
  }
}
