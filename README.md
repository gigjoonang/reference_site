# 무드보드 앱 (Claude API 연동 버전)

정적 HTML 무드보드를, 화면에서 바로 "이 레퍼런스 빼고 다시 찾아줘"를 실행할 수 있는 작은 웹 앱으로 만든 버전입니다. 카드 오른쪽 위 체크박스로 제외할 항목을 표시하면, 서버가 Claude API(web_search 툴)로 Awwwards / CSS Design Awards / GDWEB을 실시간 재검색해서 같은 개수만큼 새 레퍼런스로 채워 넣습니다.

Vercel 등 서버리스 배포를 고려해 **서버는 상태를 저장하지 않습니다.** 새로 찾은 레퍼런스는 브라우저의 localStorage에만 저장됩니다 (기기/브라우저별로 별도 보관, 새로고침해도 유지).

## API 키는 "방문자 본인의 키"를 씁니다 (중요)

이 앱은 서버(배포한 사람)의 API 키를 쓰지 않습니다. 방문자가 우측 상단 **"설정"** 버튼을 눌러 본인의 Anthropic API 키를 입력해야만 검색/피드백 기능을 쓸 수 있습니다.

- 입력한 키는 그 브라우저의 localStorage에만 저장되고, 요청할 때마다 서버로 함께 전달되어 **그 요청 한 번에만** 사용됩니다. 서버나 DB에 저장되지 않습니다.
- 키가 없는 방문자는 이용이 막히고(설정 모달이 자동으로 뜸), 배포한 사람(준환님)의 API 사용량은 전혀 소모되지 않습니다.
- 방문자는 https://console.anthropic.com/settings/keys 에서 본인 키를 발급받을 수 있습니다.

## 로컬 실행

```bash
cd moodboard-app
npm install
npm start
```

브라우저에서 http://localhost:3000 을 열고, 우측 상단 "설정"에서 본인의 API 키를 입력하면 바로 쓸 수 있습니다. (`.env`는 이제 선택사항이며 `ANTHROPIC_MODEL`, `PORT` 같은 값에만 씁니다.)

## Vercel에 배포하고 도메인 연결하기

아래 1~4번은 준환님 계정으로 직접 진행하셔야 하는 단계입니다 (로그인·결제가 필요해서 제가 대신 할 수 없어요). 코드는 이미 Vercel 배포용으로 준비되어 있습니다 (`vercel.json`, `api/index.js`).

### 1. Vercel CLI 설치 및 로그인
```bash
npm install -g vercel
vercel login
```
이메일 인증 또는 GitHub/GitLab 계정으로 로그인합니다.

### 2. 프로젝트 배포
`moodboard-app` 폴더 안에서:
```bash
vercel
```
- 첫 실행 시 "Set up and deploy?" 등 몇 가지 질문에 답하면 미리보기(preview) 배포가 생성되고 `https://프로젝트명-xxxx.vercel.app` 같은 URL을 받습니다.
- 운영 배포로 올리려면:
```bash
vercel --prod
```

또는 CLI 대신 GitHub에 이 폴더를 푸시한 뒤 https://vercel.com/new 에서 "Import Git Repository"로 연결해도 됩니다 (이후 git push마다 자동 배포).

### 3. 환경변수 설정 (선택사항)
API 키는 이제 서버 환경변수로 등록할 필요가 없습니다 — 방문자가 브라우저에서 직접 입력합니다. `ANTHROPIC_MODEL`처럼 모델을 바꾸고 싶을 때만 선택적으로 등록하면 됩니다:
```bash
vercel env add ANTHROPIC_MODEL
```
(또는 Vercel 대시보드 → 프로젝트 → Settings → Environment Variables)

### 4. 커스텀 도메인 등록
Vercel 대시보드 → 프로젝트 → **Settings → Domains** 에서 진행합니다. 두 가지 경우가 있습니다.

- **이미 갖고 있는 도메인을 연결하는 경우**: 도메인 이름을 입력하면 Vercel이 추가해야 할 DNS 레코드(A 또는 CNAME)를 보여줍니다. 그 값을 도메인을 구매한 곳(가비아, 후이즈, Cloudflare 등)의 DNS 설정에 등록하면 됩니다.
- **새 도메인을 구매하는 경우**: 같은 화면에서 원하는 도메인을 검색해 Vercel을 통해 바로 구매할 수 있습니다. 이건 결제가 들어가는 절차라 대시보드에서 직접 진행해주셔야 해요.

CLI로도 가능합니다:
```bash
vercel domains add yourdomain.com
```

DNS가 전파되면(보통 몇 분~몇 시간) `https://yourdomain.com` 으로 접속됩니다.

## 최신 업데이트 (1차 컨펌 리뷰: 인앱 AI 피드백)

- "1차 컨펌 리뷰" 탭의 AI 피드백 흐름을 바꿨습니다. 기존에는 "검토 프롬프트 생성 → Claude 대화창에 붙여넣기 → 응답을 복사해서 다시 붙여넣기"였는데, 이제 **"AI 피드백 받기" 버튼 하나만 누르면 이 사이트에서 바로 Claude Vision이 첨부된 시안을 분석**해서 결과를 보여줍니다.
- 자가 체크리스트와 AI 검토 기준 양쪽에 **"타이포그래피 위계 & 균형감"** 카테고리를 추가했습니다: 제목/본문 등 텍스트 위계, 폰트·자간·줄간격의 일관성, 레이아웃 균형감, 톤앤매너의 시안 전체 통일성을 짚어줍니다.
- 새로 추가된 API: `POST /api/review-feedback` (이미지 + 검토 기준을 Claude Vision에 전달하고 피드백 텍스트를 받아옴). 전송 전 이미지는 브라우저에서 자동으로 리사이즈(최대 가로 1400px, JPEG 85%)해서 용량을 줄입니다.

**이번에 바뀐 파일**: `public/review.html`, `src/app.js`

### 참고 (이미지 업로드 용량)

- Vercel 서버리스 함수는 요청 본문 크기에 상한이 있습니다(플랜에 따라 다르며 보통 수 MB 수준). 시안 이미지를 아주 여러 장 한 번에 첨부하면 `/api/review-feedback` 요청이 너무 커져 실패할 수 있습니다. 그럴 땐 이미지를 나눠서(2~3장씩) 여러 번 "AI 피드백 받기"를 눌러주세요.

## 최신 업데이트 (로고 교체 + 대화형 검색 UI)

- 로고를 첨부해주신 "AI WORK MXC" 이미지(`public/logo-mxc.png`)로 교체하고 크기를 22px로 살짝 줄였습니다 (두 페이지 공통).
- "레퍼런스 찾기" 페이지 기본 화면을 카드 그리드 대신 **대화창 하나만** 보이는 랜딩 화면으로 바꿨습니다. 예시 프롬프트 칩을 누르거나 직접 입력 후 Enter를 누르면 검색이 시작되고, 결과가 나오면 그때부터 상단 컴팩트 검색바 + Tier 1·2·3 카드가 나타납니다.
- 마지막으로 검색한 결과는 브라우저에 저장되어 새로고침해도 유지됩니다. "처음으로" 링크를 누르면 다시 빈 대화창으로 돌아갑니다.

**이번에 바뀌거나 새로 추가된 파일**: `public/index.html`, `public/app.js`, `public/review.html`(로고만 교체), `public/logo-mxc.png`(신규). 기존 `public/logo.png`는 더 이상 쓰이지 않습니다.

## 이번 업데이트 내용

- **통합 네비게이션**: 상단에 "1차 컨펌 리뷰" 사이트에서 쓰던 로고를 그대로 쓰고, `레퍼런스 찾기` / `1차 컨펌 리뷰` 두 탭으로 한 사이트에서 오갈 수 있습니다.
  - `public/index.html` — 레퍼런스 찾기 (기존 무드보드)
  - `public/review.html` — 1차 컨펌 리뷰 툴 (업로드해주신 파일을 그대로 이식, 기능 변경 없음)
  - `public/logo.png` — 두 페이지가 공통으로 쓰는 로고
- **자연어 검색으로 신규 무드보드 생성**: 레퍼런스 찾기 페이지 상단 검색창에 "아모레퍼시픽 기업사이트를 찾아줘"처럼 입력하면, Claude가 기업명·업종을 파악한 뒤 Tier 1·2·3 각 6개(총 18개)를 그 기업 전용으로 새로 검색해서 보여줍니다. 결과는 이 브라우저에 저장되고, 이후 기존처럼 카드별로 "제외 후 다시 찾기"도 가능합니다.
  - 새로 추가된 API: `POST /api/parse-query` (검색어 → 기업명/업종 추출), `POST /api/generate-tier` (Tier 하나당 레퍼런스 여러 개를 병렬로 검색)

### Vercel 재배포 시 덮어써야 할 파일

이미 배포된 프로젝트 폴더에 파일만 교체하고 싶다면, 이번에 바뀐 파일은 이것뿐입니다:

**수정된 파일**
- `public/index.html`
- `public/app.js`
- `src/app.js`

**새로 추가된 파일**
- `public/review.html`
- `public/logo.png`

`server.js`, `api/index.js`, `vercel.json`, `package.json`, `data/moodboard_data_amorepacific.json`은 이번에 바뀌지 않았습니다.

가장 안전한 방법은 그냥 이 폴더 전체로 다시 배포하는 것입니다 (`vercel --prod`, 또는 Git 연동이라면 그냥 push). 파일을 하나씩 수동으로 교체하는 경우 위 5개 파일만 덮어쓰면 됩니다.

## 사용 방법 (배포 후에도 동일)

1. 카드 오른쪽 위 "제외" 체크박스로 바꾸고 싶은 레퍼런스를 선택합니다.
2. 각 Tier 하단의 "선택 항목 제외하고 새로 찾기" 버튼을 누릅니다.
3. Claude API가 실제 검색을 수행하는 동안 잠시 기다립니다 (항목당 수 초~수십 초).
4. 완료되면 선택했던 카드가 새로 찾은 레퍼런스로 자동 교체되고, 이 브라우저에 저장됩니다.
5. 처음 상태로 되돌리려면 페이지 하단의 "초기 데이터로 리셋" 링크를 누릅니다.

## 데이터/상태 구조

- `data/moodboard_data_amorepacific.json` — 배포에 포함되는 **읽기 전용 시드 데이터**입니다. 최초 로딩 시 한 번만 사용되고, 그 이후 변경사항(제외/추가)은 서버 파일이 아니라 브라우저 localStorage에 저장됩니다.
- 여러 사람이 같은 배포 URL을 열어도 서로의 브라우저 상태에는 영향을 주지 않습니다(공유 DB가 아님). 팀원끼리 결과를 공유하려면 브라우저 개발자도구 콘솔에서 `localStorage.getItem(storageKey)` 값을 복사해 전달하거나, 추후 실제 DB(Vercel Postgres/KV 등) 연동이 필요합니다.
- 다른 프로젝트로 새로 시작하려면 이 JSON 파일의 `project`, `genre`, `references`를 교체하고 다시 배포하세요.

## 알아둘 점 (검색 기능 관련)

- `/api/generate-tier`는 Tier 하나(6개)를 병렬로 검색하므로 요청 하나당 대략 가장 느린 검색 1건 정도의 시간(약 10~30초)이 걸립니다. Vercel 서버리스 함수 실행 시간 제한(플랜별로 다름, Hobby는 기본적으로 짧고 Pro는 더 김)에 걸린다면, `src/app.js`의 `count`를 6보다 줄이거나 Vercel 플랜/`maxDuration` 설정을 확인하세요.
- 병렬로 6개를 동시에 찾다 보니 아주 드물게 같은 사이트가 중복으로 나올 수 있습니다. 발견하면 카드의 "제외" 체크 후 "선택 항목 제외하고 새로 찾기"로 바로 하나만 다시 뽑을 수 있습니다.

## 알아둘 점

- `web_search` 툴 파라미터(`type` 버전 등)는 Anthropic API가 업데이트되면 바뀔 수 있습니다. 에러가 나면 `src/app.js`의 `WEB_SEARCH_TOOL` 상수를 최신 [Claude API 문서](https://docs.claude.com)에 맞게 수정하세요.
- 이제 이 앱은 방문자가 본인의 API 키를 우측 상단 "설정"에 입력해야만 쓸 수 있습니다. 준환님의 키를 서버에 등록할 필요가 없고, 배포 URL을 아는 누구가 써도 준환님의 API 사용량(비용)은 소모되지 않습니다.

## 최신 업데이트 (방문자 개인 API 키로 전환)

- 서버가 더 이상 자체 API 키를 쓰지 않습니다. `/api/parse-query`, `/api/generate-tier`, `/api/research`, `/api/review-feedback` 모두 요청 body의 `apiKey`를 받아 그 요청 한 번에만 사용합니다(서버에 저장 안 함). 키가 없으면 401과 함께 `code: "NO_API_KEY"`를 반환합니다.
- 두 페이지(레퍼런스 찾기 / 1차 컨펌 리뷰) 우측 상단에 **"설정"** 버튼과 API 키 입력 모달을 추가했습니다. 키는 브라우저 localStorage(`user_anthropic_api_key`)에만 저장됩니다. 키가 없는 상태로 검색/피드백을 시도하면 자동으로 모달이 뜹니다.
- `.env`/Vercel 환경변수의 `ANTHROPIC_API_KEY`는 더 이상 필요 없습니다 (`ANTHROPIC_MODEL`, `PORT`만 선택적으로 사용).

**이번에 바뀐 파일**: `src/app.js`, `public/index.html`, `public/app.js`, `public/review.html`, `server.js`, `.env.example`
