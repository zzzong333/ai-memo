export interface WheelItem {
  id: string
  label: string
  // 메모에서 가져온 항목이면 원본 메모 ID를 보관한다
  memoId?: string
}

export const MAX_WHEEL_ITEMS = 12
export const MAX_WHEEL_LABEL_LENGTH = 30
