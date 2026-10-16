# AI 메모 요약 기능 구현 계획

## 1. 목표

메모 상세보기 모달(`MemoViewer`)에서 메모 본문을 AI(`gemini-3.1-flash-lite`)로 요약하고, 결과를 메모 데이터(LocalStorage)에 저장한다.

## 2. 확정된 요구사항

| 항목           | 결정                                                                                 |
| -------------- | ------------------------------------------------------------------------------------ |
| 요약 위치      | 상세보기 모달 (`src/components/MemoViewer.tsx`)                                      |
| 모델           | `gemini-3.1-flash-lite`                                                              |
| 호출 방식      | Next.js Route Handler(서버)에서 Gemini REST 호출. 브라우저 직접 호출 금지            |
| API 키         | `.env.local`의 `GEMINI_API_KEY` (서버 전용, `NEXT_PUBLIC_` 금지). 사용자가 직접 입력 |
| 저장           | 요약을 `Memo`에 함께 저장 (LocalStorage)                                             |
| 갱신           | 본문을 수정해도 요약은 유지. 사용자가 "다시 요약"을 눌러야 갱신                      |
| 출력 형식      | 프롬프트로 강제하지 않음 (모델이 본문 길이에 맞춰 결정)                              |
| 실패 처리      | 한국어 에러 메시지 + "다시 시도" 버튼. 기존 요약은 유지                              |
| 빈 본문        | `trim()` 기준 비어 있으면 요약 버튼 비활성화                                         |
| 요약 시각      | 화면에 표시                                                                          |
| 본문 길이 상한 | 서버에서 약 30,000자 초과 시 400 오류                                                |
| 테스트         | Playwright E2E에서 요약 API를 mock. 테스트에서 실제 API 호출 금지                    |

### 제외 범위

- 목록 페이지(`MemoItem`, `MemoList`)에 요약 표시
- 스트리밍 응답
- 사용자의 요약 직접 편집
- 본문 수정 시 자동 요약 / 자동 삭제 / "오래됨" 표시

## 3. 현재 코드 구조 (확인 결과)

- 상세보기는 페이지가 아닌 모달 `MemoViewer`이며, `src/app/page.tsx`에서 `viewingMemoId`로 제어한다.
- `useMemos.updateMemo`는 `{...existingMemo, ...formData}`로 병합하므로, `Memo`에 요약 필드를 추가해도 본문 수정 시 요약이 유지된다.
- `localStorageUtils`는 SSR 체크(`typeof window === 'undefined'`)가 이미 적용되어 있다.
- `.gitignore`에 `.env*`가 포함되어 `.env.local`은 커밋되지 않는다.
- `tests/` 디렉터리는 아직 없다. `playwright.config.ts`의 `testDir`은 `./tests`이다.
- 문서 불일치: `AGENTS.md`는 Next.js 15.4.4, `package.json`은 `16.2.9`.

## 4. 구현 단계

### 4-1. 타입 확장 — `src/types/memo.ts`

- `Memo`에 선택 필드 추가: `summary?: string`, `summarizedAt?: string`
- 선택 필드이므로 기존 LocalStorage 데이터는 마이그레이션 없이 호환된다.
- `MemoFormData`는 변경하지 않는다.

### 4-2. 서버 API — `src/app/api/summarize/route.ts` (신규)

- `POST { content: string }` → 성공 `{ summary: string }`, 실패 `{ error: string }`
- 키는 `process.env.GEMINI_API_KEY`에서만 읽는다. 없으면 500 + 한국어 메시지.
- 입력 검증
  - `content`가 문자열이 아니거나 `trim()` 후 비어 있으면 400
  - 약 30,000자 초과 시 400
- Gemini REST `generateContent`를 `fetch`로 호출한다 (의존성 추가 없음). 키는 `x-goog-api-key` 헤더로 전달한다.
- 프롬프트: 메모를 한국어로 요약하도록 지시하고, 본문은 지시문이 아닌 데이터로 취급되도록 구분자로 감싼다. 형식은 강제하지 않는다.
- 상위 API 오류, 타임아웃은 서버에서 `console.error`로만 기록하고 클라이언트에는 일반화된 한국어 메시지를 반환한다. 키와 상세 오류는 노출하지 않는다.
- 구현 전 확인: Next 16 Route Handler 규약, Gemini REST 스펙(엔드포인트, 모델 ID)을 context7로 조회한다. 모델 ID 유효성은 실제 호출로 검증한다.

### 4-3. 환경변수

- `.env.local`: 사용자가 직접 `GEMINI_API_KEY=...` 입력
- `.env.example`: 변수명만 포함(값 없음). `.gitignore`에 `!.env.example` 예외를 추가한다.

### 4-4. 훅 — `src/hooks/useMemos.ts`

- `setMemoSummary(id, summary)`를 `useCallback`으로 추가한다.
- `summary`, `summarizedAt`만 갱신하고 `updatedAt`은 변경하지 않는다.
- `localStorageUtils.updateMemo`와 `setMemos`를 함께 갱신한다.

### 4-5. 요약 호출 훅 — `src/hooks/useSummarize.ts` (신규)

- 상태: `idle | loading | error`, 에러 메시지
- `summarize(content)`: `/api/summarize` 호출 후 성공 시 요약 문자열 반환
- 실패 시 에러 상태만 설정하고 저장된 요약은 건드리지 않는다.

### 4-6. UI — `MemoViewer.tsx`, `page.tsx`

- `page.tsx`: `setMemoSummary`를 `MemoViewer`의 새 prop `onSummaryChange`로 전달
- `MemoViewer`: 본문 영역 위에 "AI 요약" 섹션 추가

| 상태           | 표시                                                        |
| -------------- | ----------------------------------------------------------- |
| 요약 없음      | "AI 요약하기" 버튼                                          |
| 요약 있음      | 요약 텍스트(`MarkdownPreview`), 생성 시각, "다시 요약" 버튼 |
| 로딩           | 버튼 비활성화 + "요약 중..."                                |
| 실패           | 한국어 에러 메시지 + "다시 시도" 버튼 (기존 요약 유지)      |
| 본문 비어 있음 | 버튼 비활성화                                               |

- 레이스 방어: 요청 시점의 `memo.id`로 요약을 저장한다. `page.tsx`에서 `MemoViewer`에 `key={viewingMemoId}`를 주어 메모가 바뀌면 상태(로딩/에러)가 초기화되고, 응답이 늦게 도착해도 요청한 메모에 올바르게 저장된다. (구현 중 "결과 폐기"에서 "올바른 메모에 저장"으로 변경)
- `data-testid`: `summary-section`, `summarize-btn`, `summary-content`, `summary-error`
- `'use client'`, Tailwind 유틸리티, 한국어 UI 텍스트, `useCallback`/`useMemo` 규칙을 따른다.

### 4-7. E2E 테스트 — `tests/e2e/memo-summary.spec.ts` (신규)

`page.route('**/api/summarize', ...)`로 모든 케이스를 mock한다.

1. 요약 성공 후 화면 표시
2. 새로고침 후에도 요약 유지 (LocalStorage 저장)
3. API 실패 시 에러 메시지 표시, "다시 시도"로 성공
4. 실패해도 기존 요약 유지
5. 본문이 빈 메모는 버튼 비활성화
6. 본문 수정 후에도 요약 유지, "다시 요약" 시 갱신

## 5. 변경 파일 목록

| 구분 | 파일                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 수정 | `src/types/memo.ts`, `src/hooks/useMemos.ts`, `src/components/MemoViewer.tsx`, `src/app/page.tsx`, `.gitignore`                            |
| 신규 | `src/app/api/summarize/route.ts`, `src/hooks/useSummarize.ts`, `tests/e2e/memo-summary.spec.ts`, `.env.example`, `docs/PLAN_AI_SUMMARY.md` |

## 6. 완료 기준

- [ ] 상세보기에서 요약 생성, 저장, 새로고침 후 유지가 동작한다.
- [ ] "다시 요약"으로 갱신되고, 본문 수정만으로는 요약이 바뀌지 않는다.
- [ ] 실패, 빈 본문, 길이 초과 시 한국어 안내가 표시되고 기존 요약이 유지된다.
- [ ] 브라우저 번들과 저장소 어디에도 API 키가 포함되지 않는다.
- [ ] `npm run lint`, `npm run build` 통과
- [ ] `tests/e2e/memo-summary.spec.ts` 통과 (mock 기반)
- [ ] Playwright MCP로 실제 브라우저에서 확인 후 결과 보고 (성공, 로딩, 에러 화면, 키 설정 후 실제 Gemini 1회 호출)
- [ ] `AGENTS.md`(Next 버전, 요약 필드, API 라우트) 업데이트 제안

## 7. 보안 및 운영 메모

- API 키가 개발 중 대화에 노출되었으므로, 개발 완료 후 폐기하고 재발급한다.
- 키는 `.env.local`에만 두고 코드, 문서, 테스트에 값을 쓰지 않는다.
- 서버 API는 인증이 없으므로 배포 시 외부 남용(호출량, 비용)에 주의한다. 이번 범위에서는 로컬 사용을 전제로 하며, 배포 시 별도 속도 제한을 검토한다.

## 8. 구현 후 변경 이력

- 요약 시점을 버튼 클릭에서 **모달 열릴 때 자동 실행**으로 변경 (요약이 없고 본문이 있는 메모만, 열 때마다 1회, 실패 시 자동 재시도 없음).
- 서버에서 Gemini 429/503 응답 시 최대 2회 재시도 (전체 제한 시간 30초).
- 모델을 `gemini-3.1-flash-lite`에서 `gemini-flash-lite-latest`로 변경. 2026-10-16 측정에서 3.1-flash-lite는 503이 잦고 응답이 17~58초로 느렸으며, `gemini-flash-lite-latest`는 연속 호출이 모두 성공(4~7초)했다. `-latest` 별칭이라 가리키는 모델이 바뀔 수 있다.
- 위 본문의 `gemini-3.1-flash-lite` 표기는 최초 요구사항 기준이다.

## 9. 열린 질문

- `gemini-3.1-flash-lite` 모델 ID와 키 형식이 REST 호출에서 정상 동작하는지는 구현 중 실제 호출로 확인한다.
- 요청 타임아웃 값(기본 제안: 20초)은 구현 시 확정한다.
