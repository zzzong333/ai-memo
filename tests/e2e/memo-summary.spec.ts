import { test, expect, Page } from '@playwright/test'
import { v4 as uuidv4 } from 'uuid'
import {
  deleteTestMemos,
  fetchMemoSummary,
  insertTestMemo,
} from './helpers/testDb'

// 병렬 실행(브라우저 3종)에서 서로 충돌하지 않도록 제목은 항상 고유하게 만든다
const uniqueTitle = (base: string) => `[E2E] ${base} ${uuidv4().slice(0, 8)}`

// 요약 API를 mock하고 호출 횟수를 추적한다 (실제 Gemini는 호출하지 않는다)
const mockSummarizeApi = async (
  page: Page,
  handler: (callCount: number) => { status?: number; json: object }
) => {
  const state = { calls: 0 }
  await page.route('**/api/summarize', route => {
    state.calls += 1
    return route.fulfill(handler(state.calls))
  })
  return state
}

const openMemo = async (page: Page, title: string) => {
  await page.getByText(title, { exact: true }).first().click()
  await expect(page.getByTestId('memo-viewer')).toBeVisible()
}

test.describe('메모 AI 요약 (모달 열 때 자동)', () => {
  const createdIds: string[] = []

  const seed = async (title: string, content: string, summary?: string) => {
    const id = await insertTestMemo({ title, content, summary })
    createdIds.push(id)
    return id
  }

  test.afterEach(async () => {
    await deleteTestMemos(createdIds.splice(0))
  })

  test('요약이 없는 메모를 열면 자동으로 요약하고 새로고침 후에는 재호출하지 않는다', async ({
    page,
  }) => {
    const title = uniqueTitle('요약 대상 메모')
    const id = await seed(title, '긴 본문 내용입니다.')
    const api = await mockSummarizeApi(page, () => ({
      json: { summary: '모의 요약 결과' },
    }))

    await page.goto('/')
    await openMemo(page, title)

    // 버튼을 누르지 않아도 자동으로 요약된다
    await expect(page.getByTestId('summary-content')).toContainText(
      '모의 요약 결과'
    )
    await expect(page.getByTestId('summarize-btn')).toHaveText('다시 요약')
    expect(api.calls).toBe(1)

    // DB에 저장되어 있으므로 새로고침 후 다시 열어도 호출하지 않는다
    await expect.poll(() => fetchMemoSummary(id)).toBe('모의 요약 결과')
    await page.reload()
    await openMemo(page, title)
    await expect(page.getByTestId('summary-content')).toContainText(
      '모의 요약 결과'
    )
    expect(api.calls).toBe(1)
  })

  test('요약 중에는 로딩 문구를 보여 준다', async ({ page }) => {
    const title = uniqueTitle('요약 대상 메모')
    await seed(title, '본문')
    await page.route('**/api/summarize', async route => {
      await new Promise(resolve => setTimeout(resolve, 500))
      await route.fulfill({ json: { summary: '지연된 요약' } })
    })

    await page.goto('/')
    await openMemo(page, title)

    await expect(page.getByTestId('summary-loading')).toBeVisible()
    await expect(page.getByTestId('summarize-btn')).toBeDisabled()
    await expect(page.getByTestId('summary-content')).toContainText(
      '지연된 요약'
    )
    await expect(page.getByTestId('summary-loading')).toHaveCount(0)
  })

  test('자동 요약이 실패하면 에러를 보여 주고 자동 재시도 없이 다시 시도 버튼으로 성공한다', async ({
    page,
  }) => {
    const title = uniqueTitle('요약 대상 메모')
    await seed(title, '본문')
    const api = await mockSummarizeApi(page, callCount =>
      callCount === 1
        ? {
            status: 502,
            json: { error: '요약 생성에 실패했습니다. 다시 시도해 주세요.' },
          }
        : { json: { summary: '재시도 요약' } }
    )

    await page.goto('/')
    await openMemo(page, title)

    await expect(page.getByTestId('summary-error')).toContainText(
      '요약 생성에 실패했습니다'
    )
    await expect(page.getByTestId('summarize-btn')).toHaveText('다시 시도')
    // 에러 상태에서 자동으로 다시 호출하지 않는다
    await page.waitForTimeout(500)
    expect(api.calls).toBe(1)

    await page.getByTestId('summarize-btn').click()
    await expect(page.getByTestId('summary-content')).toContainText(
      '재시도 요약'
    )
    await expect(page.getByTestId('summary-error')).toHaveCount(0)
    expect(api.calls).toBe(2)
  })

  test('이미 요약이 있는 메모는 열어도 자동 호출하지 않고, 재요약이 실패해도 기존 요약을 유지한다', async ({
    page,
  }) => {
    const title = uniqueTitle('요약 대상 메모')
    await seed(title, '본문', '기존 요약')
    const api = await mockSummarizeApi(page, () => ({
      status: 502,
      json: { error: '요약 생성 실패' },
    }))

    await page.goto('/')
    await openMemo(page, title)
    await expect(page.getByTestId('summary-content')).toContainText('기존 요약')
    await page.waitForTimeout(500)
    expect(api.calls).toBe(0)

    await page.getByTestId('summarize-btn').click()
    await expect(page.getByTestId('summary-error')).toBeVisible()
    await expect(page.getByTestId('summary-content')).toContainText('기존 요약')
    expect(api.calls).toBe(1)
  })

  test('본문이 비어 있으면 자동 호출하지 않고 버튼이 비활성화된다', async ({
    page,
  }) => {
    const title = uniqueTitle('빈 본문 메모')
    await seed(title, '   ')
    const api = await mockSummarizeApi(page, () => ({
      json: { summary: '호출되면 안 됨' },
    }))

    await page.goto('/')
    await openMemo(page, title)
    await expect(page.getByTestId('summarize-btn')).toBeDisabled()
    await page.waitForTimeout(500)
    expect(api.calls).toBe(0)
  })

  test('본문을 수정해도 요약은 유지되고 다시 요약하면 갱신된다', async ({
    page,
  }) => {
    const title = uniqueTitle('수정 대상 메모')
    await seed(title, '원본 본문', '기존 요약')
    const api = await mockSummarizeApi(page, () => ({
      json: { summary: '갱신된 요약' },
    }))

    await page.goto('/')
    await openMemo(page, title)

    // 편집 폼에서 본문을 수정하고 저장
    await page.getByTestId('viewer-edit-btn').click()
    await page.locator('#content').fill('수정된 본문')
    await page.getByRole('button', { name: '수정하기' }).click()

    // 다시 열어도 요약이 이미 있으므로 자동 호출하지 않고 기존 요약이 유지된다
    await openMemo(page, title)
    await expect(page.getByTestId('memo-viewer-content')).toContainText(
      '수정된 본문'
    )
    await expect(page.getByTestId('summary-content')).toContainText('기존 요약')
    expect(api.calls).toBe(0)

    await page.getByTestId('summarize-btn').click()
    await expect(page.getByTestId('summary-content')).toContainText(
      '갱신된 요약'
    )
    expect(api.calls).toBe(1)
  })
})
