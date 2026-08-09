# 무드보드 앱 (Claude API 연동 버전)

정적 HTML 무드보드를, 화면에서 바로 "이 레퍼런스 빼고 다시 찾아줘"를 실행할 수 있는 작은 웹 앱으로 만든 버전입니다. 카드 오른쪽 위 체크박스로 제외할 항목을 표시하면, 서버가 Claude API(web_search 툴)로 Awwwards / CSS Design Awards / GDWEB을 실시간 재검색해서 같은 개수만큼 새 레퍼런스로 채워 넣습니다.

Vercel 등 서버리스 배포를 고려해 **서버는 상태를 저장하지 않습니다.** 새로 찾은 레퍼런스는 브라우저의 localStorage에만 저장됩니다 (기기/브라우저별로 별도 보관, 새로고침해도 유지).

## 로컬 실행

```bash
cd moodboard-app
npm install
cp .env.example .env
# .env 파일을 열어 ANTHROPIC_API_KEY 값을 채워넣으세요
npm start
```

브라우저에서 http://localhost:3000 을 엽니다.

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

### 3. 환경변수(API 키) 설정
로컬의 `.env` 파일은 Vercel에 자동으로 올라가지 않습니다. 아래처럼 직접 등록해야 합니다.
```bash
vercel env add ANTHROPIC_API_KEY
```
프롬프트가 뜨면 API 키 값을 붙여넣고, Production/Preview/Development 중 필요한 환경을 선택합니다. (또는 Vercel 대시보드 → 프로젝트 → Settings → Environment Variables 에서 등록 가능)

환경변수를 추가한 뒤에는 다시 배포해야 반영됩니다:
```bash
vercel --prod
```

### 4. 커스텀 도메인 등록
Vercel 대시보드 → 프로젝트 → **Settings → Domains** 에서 진행합니다. 두 가지 경우가 있습니다.

- **이미 갖고 있는 도메인을 연결하는 경우**: 도메인 이름을 입력하면 Vercel이 추가해야 할 DNS 레코드(A 또는 CNAME)를 보여줍니다. 그 값을 도메인을 구매한 곳(가비아, 후이즈, Cloudflare 등)의 DNS 설정에 등록하면 됩니다.
- **새 도메인을 구매하는 경우**: 같은 화면에서 원하는 도메인을 검색해 Vercel을 통해 바로 구매할 수 있습니다. 이건 결제가 들어가는 절차라 대시보드에서 직접 진행해주셔야 해요.

CLI로도 가능합니다:
```bash
vercel domains add yourdomain.com
```

DNS가 전파되면(보통 몇 분~몇 시간) `https://yourdomain.com` 으로 접속됩니다.

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

## 알아둘 점

- `web_search` 툴 파라미터(`type` 버전 등)는 Anthropic API가 업데이트되면 바뀔 수 있습니다. 에러가 나면 `src/app.js`의 `WEB_SEARCH_TOOL` 상수를 최신 [Claude API 문서](https://docs.claude.com)에 맞게 수정하세요.
- API 키는 `.env`(로컬) 또는 Vercel 환경변수(배포)에만 두고, 절대 코드에 하드코딩하거나 외부에 공유하지 마세요.
- 이 앱은 기본적으로 인증이 없습니다. 배포 URL을 아는 누구나 "새로 찾기" 버튼을 눌러 준환님의 API 사용량(비용)을 소모할 수 있으니, 공개 배포 시에는 접근 제한(Vercel Password Protection 등, Pro 플랜 기능)을 고려하세요.
