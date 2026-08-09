/**
 * 로컬 개발용 실행 진입점.
 * 실행: npm install && cp .env.example .env (키 채우기) && npm start
 */
require("dotenv").config();
const app = require("./src/app");

const PORT = process.env.PORT || 3000;

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("[경고] ANTHROPIC_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.");
}

app.listen(PORT, () => {
  console.log(`무드보드 앱 실행 중: http://localhost:${PORT}`);
});
