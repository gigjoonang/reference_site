/**
 * 로컬 개발용 실행 진입점.
 * 실행: npm install && npm start
 * (API 키는 서버가 아니라 브라우저에서 방문자가 우측 상단 "설정"으로 직접 입력합니다.
 *  .env는 ANTHROPIC_MODEL, PORT 등 선택적인 설정에만 씁니다.)
 */
require("dotenv").config();
const app = require("./src/app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`무드보드 앱 실행 중: http://localhost:${PORT}`);
});
