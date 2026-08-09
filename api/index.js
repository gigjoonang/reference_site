/**
 * Vercel 서버리스 함수 진입점.
 * vercel.json이 모든 요청을 이 파일로 라우팅한다.
 * 로컬 dotenv는 필요 없음 - Vercel 대시보드/CLI에서 설정한 환경변수를 그대로 사용.
 */
module.exports = require("../src/app");
