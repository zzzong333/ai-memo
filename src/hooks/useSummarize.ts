'use client'

import { useState, useCallback } from 'react'

const DEFAULT_ERROR_MESSAGE = '요약 생성에 실패했습니다. 다시 시도해 주세요.'

export const useSummarize = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 성공 시 요약 문자열, 실패 시 null 반환 (실패 사유는 error 상태에 저장)
  const summarize = useCallback(
    async (content: string): Promise<string | null> => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        })
        const data: { summary?: string; error?: string } = await res
          .json()
          .catch(() => ({}))

        if (!res.ok || !data.summary) {
          setError(data.error ?? DEFAULT_ERROR_MESSAGE)
          return null
        }
        return data.summary
      } catch (err) {
        console.error('Failed to summarize memo:', err)
        setError(DEFAULT_ERROR_MESSAGE)
        return null
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { loading, error, summarize }
}
