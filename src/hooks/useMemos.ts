'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Memo, MemoFormData } from '@/types/memo'
import {
  createMemoAction,
  deleteMemoAction,
  getMemosAction,
  setMemoSummaryAction,
  updateMemoAction,
} from '@/app/actions/memoActions'

export const useMemos = () => {
  const [memos, setMemos] = useState<Memo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  // 메모 로드
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const loadedMemos = await getMemosAction()
        if (!cancelled) {
          setMemos(loadedMemos)
          setError(null)
        }
      } catch (err) {
        console.error('Failed to load memos:', err)
        if (!cancelled) setError('메모를 불러오지 못했습니다.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // 메모 생성 (성공 시 생성된 메모, 실패 시 null)
  const createMemo = useCallback(
    async (formData: MemoFormData): Promise<Memo | null> => {
      try {
        const newMemo = await createMemoAction(formData)
        setMemos(prev => [newMemo, ...prev])
        setError(null)
        return newMemo
      } catch (err) {
        console.error('Failed to create memo:', err)
        setError('메모를 저장하지 못했습니다.')
        return null
      }
    },
    []
  )

  // 메모 업데이트
  const updateMemo = useCallback(
    async (id: string, formData: MemoFormData): Promise<boolean> => {
      try {
        const updatedMemo = await updateMemoAction(id, formData)
        setMemos(prev =>
          prev.map(memo => (memo.id === id ? updatedMemo : memo))
        )
        setError(null)
        return true
      } catch (err) {
        console.error('Failed to update memo:', err)
        setError('메모를 수정하지 못했습니다.')
        return false
      }
    },
    []
  )

  // 메모 요약 저장 (updatedAt은 변경하지 않음)
  const setMemoSummary = useCallback(
    async (id: string, summary: string): Promise<void> => {
      try {
        const updatedMemo = await setMemoSummaryAction(id, summary)
        setMemos(prev =>
          prev.map(memo => (memo.id === id ? updatedMemo : memo))
        )
      } catch (err) {
        console.error('Failed to save summary:', err)
        setError('요약을 저장하지 못했습니다.')
      }
    },
    []
  )

  // 메모 삭제
  const deleteMemo = useCallback(async (id: string): Promise<void> => {
    try {
      await deleteMemoAction(id)
      setMemos(prev => prev.filter(memo => memo.id !== id))
      setError(null)
    } catch (err) {
      console.error('Failed to delete memo:', err)
      setError('메모를 삭제하지 못했습니다.')
    }
  }, [])

  // 메모 검색
  const searchMemos = useCallback((query: string): void => {
    setSearchQuery(query)
  }, [])

  // 카테고리 필터링
  const filterByCategory = useCallback((category: string): void => {
    setSelectedCategory(category)
  }, [])

  // 특정 메모 가져오기
  const getMemoById = useCallback(
    (id: string): Memo | undefined => {
      return memos.find(memo => memo.id === id)
    },
    [memos]
  )

  // 필터링된 메모 목록
  const filteredMemos = useMemo(() => {
    let filtered = memos

    // 카테고리 필터링
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(memo => memo.category === selectedCategory)
    }

    // 검색 필터링
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        memo =>
          memo.title.toLowerCase().includes(query) ||
          memo.content.toLowerCase().includes(query) ||
          memo.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    return filtered
  }, [memos, selectedCategory, searchQuery])

  // 통계 정보
  const stats = useMemo(() => {
    const totalMemos = memos.length
    const categoryCounts = memos.reduce(
      (acc, memo) => {
        acc[memo.category] = (acc[memo.category] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    return {
      total: totalMemos,
      byCategory: categoryCounts,
      filtered: filteredMemos.length,
    }
  }, [memos, filteredMemos])

  return {
    // 상태
    memos: filteredMemos,
    allMemos: memos,
    loading,
    error,
    searchQuery,
    selectedCategory,
    stats,

    // 메모 CRUD
    createMemo,
    updateMemo,
    setMemoSummary,
    deleteMemo,
    getMemoById,

    // 필터링 & 검색
    searchMemos,
    filterByCategory,
  }
}
