'use client'

import { useCallback, useEffect, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { Memo } from '@/types/memo'
import {
  MAX_WHEEL_ITEMS,
  MAX_WHEEL_LABEL_LENGTH,
  WheelItem,
} from '@/types/wheel'
import { wheelStorage } from '@/utils/wheelStorage'

const normalizeLabel = (label: string) =>
  label.trim().slice(0, MAX_WHEEL_LABEL_LENGTH)

export function useWheelItems() {
  const [items, setItems] = useState<WheelItem[]>([])
  const [loaded, setLoaded] = useState(false)

  // SSR 하이드레이션 불일치를 피하려고 마운트 후에 LocalStorage에서 읽는다
  useEffect(() => {
    setItems(wheelStorage.getItems())
    setLoaded(true)
  }, [])

  const commit = useCallback((next: WheelItem[]) => {
    setItems(next)
    wheelStorage.saveItems(next)
  }, [])

  const addItem = useCallback(
    (label: string): boolean => {
      const normalized = normalizeLabel(label)
      if (!normalized || items.length >= MAX_WHEEL_ITEMS) return false
      commit([...items, { id: uuidv4(), label: normalized }])
      return true
    },
    [items, commit]
  )

  const updateItem = useCallback(
    (id: string, label: string): boolean => {
      const normalized = normalizeLabel(label)
      if (!normalized) return false
      commit(
        items.map(item =>
          item.id === id ? { ...item, label: normalized } : item
        )
      )
      return true
    },
    [items, commit]
  )

  const deleteItem = useCallback(
    (id: string) => {
      commit(items.filter(item => item.id !== id))
    },
    [items, commit]
  )

  // 아직 추가되지 않은 메모를 남은 자리만큼 가져온다. 추가된 개수를 반환한다.
  const importMemos = useCallback(
    (memos: Memo[]): number => {
      const existing = new Set(items.map(item => item.memoId))
      const room = MAX_WHEEL_ITEMS - items.length
      const added = memos
        .filter(memo => !existing.has(memo.id))
        .slice(0, Math.max(room, 0))
        .map<WheelItem>(memo => ({
          id: uuidv4(),
          label: normalizeLabel(memo.title) || '(제목 없음)',
          memoId: memo.id,
        }))
      if (added.length > 0) commit([...items, ...added])
      return added.length
    },
    [items, commit]
  )

  return { items, loaded, addItem, updateItem, deleteItem, importMemos }
}
