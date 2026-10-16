'use client'

import { useCallback, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import {
  Memo,
  MemoCategory,
  MEMO_CATEGORIES,
  CATEGORY_COLORS,
} from '@/types/memo'
import { useSummarize } from '@/hooks/useSummarize'

const MarkdownPreview = dynamic(
  () => import('@uiw/react-md-editor').then(mod => mod.default.Markdown),
  { ssr: false }
)

interface MemoViewerProps {
  memo: Memo | null
  onClose: () => void
  onEdit: (memo: Memo) => void
  onDelete: (id: string) => void
  onSummaryChange: (id: string, summary: string) => void
}

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export default function MemoViewer({
  memo,
  onClose,
  onEdit,
  onDelete,
  onSummaryChange,
}: MemoViewerProps) {
  const isOpen = memo !== null
  const {
    loading: isSummarizing,
    error: summaryError,
    summarize,
  } = useSummarize()

  const memoId = memo?.id ?? null
  const memoContent = memo?.content ?? ''
  const hasSummary = Boolean(memo?.summary)
  const hasContent = memoContent.trim() !== ''
  const autoRequestedRef = useRef(false)

  // 요청 시점의 id로 저장하므로, 응답 전에 다른 메모로 바뀌어도 올바른 메모에 저장된다
  const requestSummary = useCallback(
    async (id: string, content: string) => {
      const summary = await summarize(content)
      if (summary) onSummaryChange(id, summary)
    },
    [summarize, onSummaryChange]
  )

  // 모달이 열릴 때 요약이 없는 메모는 자동으로 요약 (열릴 때마다 1회, 실패 시 자동 재시도 없음)
  useEffect(() => {
    if (!memoId || hasSummary || !hasContent || autoRequestedRef.current) return
    autoRequestedRef.current = true
    void requestSummary(memoId, memoContent)
  }, [memoId, hasSummary, hasContent, memoContent, requestSummary])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!memo) return null

  const categoryColor =
    CATEGORY_COLORS[memo.category as MemoCategory] || CATEGORY_COLORS.other

  const handleSummarize = () => requestSummary(memo.id, memo.content)

  const handleDelete = () => {
    if (window.confirm('정말로 이 메모를 삭제하시겠습니까?')) {
      onDelete(memo.id)
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      data-testid="memo-viewer-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="memo-viewer-title"
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
        data-testid="memo-viewer"
      >
        {/* 헤더 */}
        <div className="flex justify-between items-start p-6 border-b border-gray-200">
          <div className="flex-1 min-w-0">
            <h2
              id="memo-viewer-title"
              className="text-xl font-semibold text-gray-900 mb-2 break-words"
            >
              {memo.title}
            </h2>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${categoryColor}`}
              >
                {MEMO_CATEGORIES[memo.category as MemoCategory] ||
                  memo.category}
              </span>
              <span className="text-xs text-gray-500">
                작성 {formatDate(memo.createdAt)}
              </span>
              <span className="text-xs text-gray-500">
                수정 {formatDate(memo.updatedAt)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="ml-4 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            data-testid="close-viewer-btn"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* AI 요약 */}
          <section
            className="mb-6 rounded-lg border border-blue-100 bg-blue-50 p-4"
            data-testid="summary-section"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-blue-900">AI 요약</h3>
              <button
                onClick={handleSummarize}
                disabled={!hasContent || isSummarizing}
                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="summarize-btn"
              >
                {isSummarizing
                  ? '요약 중...'
                  : summaryError
                    ? '다시 시도'
                    : memo.summary
                      ? '다시 요약'
                      : 'AI 요약하기'}
              </button>
            </div>
            {memo.summary && (
              <div className="mt-3">
                <div data-color-mode="light" data-testid="summary-content">
                  <MarkdownPreview
                    source={memo.summary}
                    className="!bg-transparent !text-sm"
                  />
                </div>
                {memo.summarizedAt && (
                  <p className="mt-2 text-xs text-gray-500">
                    요약 생성 {formatDate(memo.summarizedAt)}
                  </p>
                )}
              </div>
            )}
            {isSummarizing && !memo.summary && (
              <p
                className="mt-3 text-sm text-gray-600"
                data-testid="summary-loading"
              >
                AI가 메모를 요약하고 있습니다...
              </p>
            )}
            {summaryError && (
              <p
                role="alert"
                className="mt-3 text-sm text-red-600"
                data-testid="summary-error"
              >
                {summaryError}
              </p>
            )}
            {!memo.summary && !summaryError && !hasContent && (
              <p className="mt-3 text-xs text-gray-500">
                본문이 비어 있어 요약할 수 없습니다.
              </p>
            )}
          </section>

          <div data-color-mode="light" data-testid="memo-viewer-content">
            <MarkdownPreview
              source={memo.content}
              className="!bg-transparent !text-sm"
            />
          </div>
          {memo.tags.length > 0 && (
            <div className="flex gap-2 flex-wrap mt-4">
              {memo.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 액션 */}
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
          <button
            onClick={() => onEdit(memo)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            data-testid="viewer-edit-btn"
          >
            편집
          </button>
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition-colors"
            data-testid="viewer-delete-btn"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}
