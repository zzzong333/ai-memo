import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

// 테스트 실행 시 .env.local의 Supabase 설정을 로드한다 (이미 설정된 환경변수는 유지)
try {
  process.loadEnvFile('.env.local')
} catch {
  // 파일이 없으면 셸 환경변수를 그대로 사용한다
}

let client: SupabaseClient | null = null

const getClient = (): SupabaseClient => {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'E2E 테스트에는 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요합니다.'
    )
  }
  client = createClient(url, key, { auth: { persistSession: false } })
  return client
}

export interface TestMemoInput {
  title: string
  content: string
  summary?: string
}

// 테스트 전용 메모를 DB에 넣고 id를 반환한다. 다른 데이터에 영향이 없도록 제목은 고유해야 한다.
export const insertTestMemo = async (input: TestMemoInput): Promise<string> => {
  const id = uuidv4()
  const { error } = await getClient()
    .from('memos')
    .insert({
      id,
      title: input.title,
      content: input.content,
      category: 'work',
      tags: [],
      summary: input.summary ?? null,
      summarized_at: input.summary ? new Date().toISOString() : null,
    })
  if (error) throw new Error(`테스트 메모 생성 실패: ${error.message}`)
  return id
}

export const deleteTestMemos = async (ids: string[]): Promise<void> => {
  if (ids.length === 0) return
  const { error } = await getClient().from('memos').delete().in('id', ids)
  if (error) throw new Error(`테스트 메모 삭제 실패: ${error.message}`)
}

export const fetchMemoSummary = async (id: string): Promise<string | null> => {
  const { data, error } = await getClient()
    .from('memos')
    .select('summary')
    .eq('id', id)
    .single()
  if (error) throw new Error(`테스트 메모 조회 실패: ${error.message}`)
  return data.summary
}
