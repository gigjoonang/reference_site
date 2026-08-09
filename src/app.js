/**
 * 디자인 레퍼런스 무드보드 - API 연동 백엔드 (Express 앱 본체)
 * -------------------------------------------------
 * Vercel 등 서버리스 환경은 파일시스템이 읽기 전용이라(요청마다 인스턴스가
 * 새로 뜰 수 있음) 서버가 결과를 디스크에 "영구 저장"할 수 없다. 그래서 이
 * 앱은 상태를 서버에 저장하지 않는다:
 *   - GET  /api/data     : 배포에 포함된 시드(seed) JSON을 읽기 전용으로 반환
 *   - POST /api/research : Claude로 새 레퍼런스를 찾아서 "반환"만 한다.
 *                          실제 상태 반영(제외 처리 + 추가)은 브라우저(localStorage)가 담당.
 *
 * 로컬 실행: server.js 참고 (app.listen)
 * Vercel 배포: api/index.js 에서 이 app을 그대로 export
 */

const path = require("path");
const fs = require("fs/promises");
const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
const DATA_PATH = path.join(__dirname, "..", "data", "moodboard_data_amorepacific.json");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Anthropic 서버사이드 웹서치 툴 정의. 세 갤러리 도메인으로만 검색을 제한한다.
// 주의: type 버전 등은 Anthropic API가 업데이트되면 바뀔 수 있다.
// 에러가 나면 https://docs.claude.com 의 "Web search tool" 문서를 확인해서 맞춘다.
const WEB_SEARCH_TOOL = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 6,
  allowed_domains: ["awwwards.com", "cssdesignawards.com", "gdweb.co.kr"],
};

const TIER_SPEC = {
  1: {
    label: "Tier 1 — 평범한 레이아웃",
    rule: "업계 표준에 가까운, 검증된 안전한 레이아웃. 리스크가 거의 없는 선택.",
  },
  2: {
    label: "Tier 2 — 트렌디하지만 정돈된 레이아웃",
    rule: "최신 감각은 담되 구조는 여전히 예측 가능하고 정돈된 선택. 과도한 WebGL/3D 몰입형 인터랙션은 넣지 않는다(Tier 3 영역).",
  },
  3: {
    label: "Tier 3 — 매우 트렌디하면서 과감한 인터랙션",
    rule: "WebGL, 3D, 파격적인 스크롤/모션 등 실험적 인터랙션이 두드러지는 선택. 업종은 굳이 맞추지 않아도 된다.",
  },
};

async function readSeedData() {
  const raw = await fs.readFile(DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

/**
 * Claude에게 대체 레퍼런스 1개를 찾아달라고 요청한다.
 */
async function findReplacementReference({ tier, genre, projectName, excludeNames }) {
  const spec = TIER_SPEC[tier];
  const genreInstruction =
    tier === 3
      ? "업종은 무관하게, 스타일과 인터랙션이 Tier 3 기준에 맞고 반응도가 검증된 사이트를 찾는다."
      : `대상 기업(${projectName})과 동일하거나 인접한 장르(${genre})의 실제 기업/브랜드 사이트를 찾는다.`;

  const prompt = `당신은 디자인 레퍼런스 큐레이터다. "${projectName}" 신규 기업사이트 제안을 위한 무드보드에 넣을 레퍼런스 1개를 새로 찾아라.

[Tier 규칙] ${spec.label}
${spec.rule}
${genreInstruction}

[출처 제한] Awwwards, CSS Design Awards, GDWEB 세 곳에서만 찾는다. web_search 툴로 실제로 검색하고, 상세페이지를 확인해서 아래 반응도 근거를 반드시 확보한다.
- Awwwards: 커뮤니티 평균 평점, Site of the Day/Honorable Mention 여부
- CSS Design Awards: 심사위원 최종 점수, WOTD/Special Kudos 여부
- GDWEB: WINNER 배지 여부

[중복 금지] 다음 이름들은 이미 무드보드에 있으므로 제외: ${excludeNames.join(", ") || "(없음)"}

[출력 형식] 다른 설명 없이 아래 JSON 하나만 출력하라. 마크다운 코드블록도 쓰지 마라.
{
  "name": "사이트/기업 이름",
  "source": "Awwwards | CSS Design Awards | GDWEB",
  "url": "실제 확인한 원본 또는 상세페이지 URL",
  "image": "실제 확인한 대표 이미지 URL",
  "tags": ["특징1", "특징2", "특징3"],
  "reason": "선정 이유 1~2문장. 반응도/점수 근거 포함."
}

실제로 web_search로 확인하지 못했으면 절대 지어내지 말고, 대신 "error" 필드에 이유를 담아 { "error": "..." } 형태로만 응답하라.`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    tools: [WEB_SEARCH_TOOL],
    messages: [{ role: "user", content: prompt }],
  });

  const textBlocks = response.content.filter((b) => b.type === "text").map((b) => b.text);
  const fullText = textBlocks.join("\n");
  const match = fullText.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Claude 응답에서 JSON을 찾지 못했습니다: " + fullText.slice(0, 300));
  }
  const parsed = JSON.parse(match[0]);
  if (parsed.error) {
    throw new Error(parsed.error);
  }
  return parsed;
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// 배포에 포함된 시드 데이터 조회 (읽기 전용 - 서버리스에서도 안전)
app.get("/api/data", async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      res.setHeader("X-Api-Key-Missing", "1");
    }
    const data = await readSeedData();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 새 레퍼런스를 찾아서 "반환"만 한다 (서버는 아무것도 저장하지 않는다).
// body: { tier: 1|2|3, count: number, genre: string, project: string, excludeNames: string[] }
app.post("/api/research", async (req, res) => {
  try {
    const { tier, count = 1, genre = "", project = "", excludeNames = [] } = req.body;
    if (![1, 2, 3].includes(tier)) {
      return res.status(400).json({ error: "tier는 1, 2, 3 중 하나여야 합니다." });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "서버에 ANTHROPIC_API_KEY가 설정되어 있지 않습니다." });
    }

    const added = [];
    const seenNames = [...excludeNames];
    for (let i = 0; i < count; i++) {
      const newRef = await findReplacementReference({
        tier,
        genre,
        projectName: project || "프로젝트",
        excludeNames: seenNames,
      });
      added.push({ ...newRef, tier, status: "active" });
      seenNames.push(newRef.name);
    }

    res.json({ added });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = app;
