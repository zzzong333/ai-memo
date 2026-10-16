'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { useWheelItems } from '@/hooks/useWheelItems'
import { Memo } from '@/types/memo'
import {
  MAX_WHEEL_ITEMS,
  MAX_WHEEL_LABEL_LENGTH,
  WheelItem,
} from '@/types/wheel'

interface MemoWheelProps {
  isOpen: boolean
  memos: Memo[]
  onClose: () => void
  onSelectMemo: (memo: Memo) => void
}

const SPIN_DURATION_MS = 4000
const SLICE_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
]
const RADIUS = 100

const polar = (angleDeg: number, r: number) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: RADIUS + r * Math.cos(rad), y: RADIUS + r * Math.sin(rad) }
}

const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max)}…` : text

export default function MemoWheel({
  isOpen,
  memos,
  onClose,
  onSelectMemo,
}: MemoWheelProps) {
  const { items, addItem, updateItem, deleteItem, importMemos } =
    useWheelItems()

  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<WheelItem | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')
  const [notice, setNotice] = useState('')

  const sliceAngle = items.length > 0 ? 360 / items.length : 360
  const isFull = items.length >= MAX_WHEEL_ITEMS

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !spinning) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, spinning, onClose])

  const handleSpin = useCallback(() => {
    if (spinning || items.length === 0) return
    const index = Math.floor(Math.random() * items.length)
    const center = (index + 0.5) * sliceAngle
    const offset = (((-center - rotation) % 360) + 360) % 360
    setWinner(null)
    setNotice('')
    setEditingId(null)
    setSpinning(true)
    setRotation(rotation + 360 * 5 + offset)
    window.setTimeout(() => {
      setWinner(items[index])
      setSpinning(false)
    }, SPIN_DURATION_MS)
  }, [spinning, items, sliceAngle, rotation])

  const handleClose = () => {
    if (spinning) return
    setWinner(null)
    setEditingId(null)
    onClose()
  }

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    if (addItem(newLabel)) {
      setNewLabel('')
      setWinner(null)
      setNotice('')
    }
  }

  const handleStartEdit = (item: WheelItem) => {
    setEditingId(item.id)
    setEditingLabel(item.label)
  }

  const handleSaveEdit = (e: FormEvent) => {
    e.preventDefault()
    if (editingId && updateItem(editingId, editingLabel)) {
      setEditingId(null)
      setWinner(null)
    }
  }

  const handleDelete = (id: string) => {
    deleteItem(id)
    setWinner(null)
    if (editingId === id) setEditingId(null)
  }

  const handleImport = () => {
    const added = importMemos(memos)
    setWinner(null)
    setNotice(
      added > 0
        ? `메모 ${added}개를 가져왔습니다.`
        : '가져올 새 메모가 없거나 돌림판이 가득 찼습니다.'
    )
  }

  const winnerMemo = winner?.memoId
    ? (memos.find(memo => memo.id === winner.memoId) ?? null)
    : null

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-label="메모 돌림판"
        data-testid="memo-wheel"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto overflow-x-hidden rounded-xl bg-white p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">🎡 돌림판</h2>
          <button
            onClick={handleClose}
            aria-label="돌림판 닫기"
            disabled={spinning}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-40"
          >
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <p
            data-testid="memo-wheel-empty"
            className="py-8 text-center text-sm text-gray-500"
          >
            돌림판 항목이 없습니다. 아래에서 항목을 추가하거나 메모를
            가져오세요.
          </p>
        ) : (
          <div className="relative mx-auto aspect-square w-full max-w-xs">
            {/* 포인터 */}
            <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1 text-2xl text-red-600">
              ▼
            </div>
            <svg
              viewBox="0 0 200 200"
              data-testid="memo-wheel-svg"
              className="h-full w-full"
              // 회전 각도와 transition은 런타임 값이라 인라인 스타일이 불가피하다
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning
                  ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`
                  : 'none',
              }}
            >
              {items.map((item, i) => {
                const start = i * sliceAngle
                const end = (i + 1) * sliceAngle
                const p1 = polar(start, RADIUS)
                const p2 = polar(end, RADIUS)
                const mid = polar(start + sliceAngle / 2, RADIUS * 0.62)
                const color = SLICE_COLORS[i % SLICE_COLORS.length]
                const d =
                  items.length === 1
                    ? `M ${RADIUS} 0 A ${RADIUS} ${RADIUS} 0 1 1 ${RADIUS} ${RADIUS * 2} A ${RADIUS} ${RADIUS} 0 1 1 ${RADIUS} 0 Z`
                    : `M ${RADIUS} ${RADIUS} L ${p1.x} ${p1.y} A ${RADIUS} ${RADIUS} 0 ${sliceAngle > 180 ? 1 : 0} 1 ${p2.x} ${p2.y} Z`
                return (
                  <g key={item.id}>
                    <path d={d} fill={color} stroke="white" strokeWidth={1} />
                    <text
                      x={mid.x}
                      y={mid.y}
                      fill="white"
                      fontSize={8}
                      fontWeight={600}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${start + sliceAngle / 2 - 90} ${mid.x} ${mid.y})`}
                    >
                      {truncate(item.label, 10)}
                    </text>
                  </g>
                )
              })}
              <circle cx={RADIUS} cy={RADIUS} r={8} fill="white" />
            </svg>
          </div>
        )}

        <div className="mt-4 text-center" aria-live="polite">
          {winner && (
            <div data-testid="memo-wheel-result" className="mb-3">
              <p className="text-sm text-gray-500">당첨!</p>
              <p className="text-lg font-bold text-gray-900">{winner.label}</p>
              {winnerMemo && (
                <button
                  onClick={() => {
                    onSelectMemo(winnerMemo)
                    handleClose()
                  }}
                  data-testid="memo-wheel-open-btn"
                  className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  메모 열기
                </button>
              )}
            </div>
          )}
          <button
            onClick={handleSpin}
            disabled={spinning || items.length === 0}
            data-testid="memo-wheel-spin-btn"
            className="inline-flex items-center rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {spinning ? '돌아가는 중...' : winner ? '다시 돌리기' : '돌리기'}
          </button>
        </div>

        {/* 항목 편집 */}
        <div className="mt-6 border-t border-gray-200 pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              항목 ({items.length}/{MAX_WHEEL_ITEMS})
            </h3>
            <button
              onClick={handleImport}
              disabled={spinning || isFull || memos.length === 0}
              data-testid="memo-wheel-import-btn"
              className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-gray-400"
            >
              메모에서 가져오기
            </button>
          </div>
          {notice && (
            <p
              data-testid="memo-wheel-notice"
              className="mb-2 text-xs text-gray-500"
            >
              {notice}
            </p>
          )}

          <form onSubmit={handleAdd} className="mb-3 flex gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              maxLength={MAX_WHEEL_LABEL_LENGTH}
              disabled={spinning || isFull}
              placeholder={isFull ? '항목이 가득 찼습니다' : '새 항목 입력'}
              aria-label="새 돌림판 항목"
              data-testid="memo-wheel-add-input"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
            <button
              type="submit"
              disabled={spinning || isFull || !newLabel.trim()}
              data-testid="memo-wheel-add-btn"
              className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              추가
            </button>
          </form>

          <ul className="space-y-1.5">
            {items.map(item => (
              <li
                key={item.id}
                data-testid="memo-wheel-item"
                className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-1.5"
              >
                {editingId === item.id ? (
                  <form onSubmit={handleSaveEdit} className="flex flex-1 gap-2">
                    <input
                      type="text"
                      value={editingLabel}
                      onChange={e => setEditingLabel(e.target.value)}
                      maxLength={MAX_WHEEL_LABEL_LENGTH}
                      autoFocus
                      aria-label="항목 이름 수정"
                      data-testid="memo-wheel-edit-input"
                      className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!editingLabel.trim()}
                      data-testid="memo-wheel-save-btn"
                      className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      취소
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm text-gray-700">
                      {item.label}
                    </span>
                    <button
                      onClick={() => handleStartEdit(item)}
                      disabled={spinning}
                      aria-label={`${item.label} 수정`}
                      data-testid="memo-wheel-edit-btn"
                      className="text-xs text-gray-500 hover:text-blue-600 disabled:opacity-40"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={spinning}
                      aria-label={`${item.label} 삭제`}
                      data-testid="memo-wheel-delete-btn"
                      className="text-xs text-gray-500 hover:text-red-600 disabled:opacity-40"
                    >
                      삭제
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
