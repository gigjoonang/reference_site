// 무드보드 프론트엔드 로직
// - 서버는 상태를 저장하지 않는다(Vercel 등 서버리스 대응). 대신 브라우저 localStorage에
//   현재 상태(제외 처리 + 새로 추가된 레퍼런스)를 저장한다.
// - 최초 로딩: localStorage에 저장된 값이 있으면 그걸 쓰고, 없으면 /api/data(배포에 포함된
//   시드 JSON)를 읽어와 localStorage에 저장한다.
// - "선택 항목 제외하고 새로 찾기": 선택된 카드는 로컬에서 바로 excluded 처리하고,
//   POST /api/research 로 같은 개수만큼 새 레퍼런스를 받아와 추가한다.

let currentData = null;
let storageKey = "moodboard_state_default";
const excludedSelection = { 1: new Set(), 2: new Set(), 3: new Set() };

async function loadData() {
  const cached = localStorage.getItem(storageKeyGuess());
  if (cached) {
    try {
      currentData = JSON.parse(cached);
      storageKey = storageKeyFor(currentData.project);
      finishLoad();
      return;
    } catch (e) {
      // 캐시가 깨졌으면 무시하고 시드로 다시 불러온다.
    }
  }

  const res = await fetch("/api/data");
  if (!res.ok) throw new Error("데이터를 불러오지 못했습니다.");
  currentData = await res.json();
  storageKey = storageKeyFor(currentData.project);
  saveToLocalStorage();
  finishLoad();
}

// 프로젝트명을 아직 모르는 최초 호출 시점엔 알려진 기본 키로 먼저 시도한다.
function storageKeyGuess() {
  return storageKey;
}
function storageKeyFor(project) {
  return "moodboard_state_" + (project || "default").replace(/\s+/g, "_");
}

function finishLoad() {
  document.getElementById("page-title-text").textContent =
    (currentData.project || "무드보드") + " 디자인 레퍼런스 무드보드";
  document.getElementById("footer-text").innerHTML =
    `Tier 1·2·3 기준 무드보드입니다. 이 브라우저에만 저장됩니다 (localStorage). ` +
    `<a href="#" onclick="resetToSeed();return false;" style="color:var(--sub);">초기 데이터로 리셋</a>`;
  render();
}

function saveToLocalStorage() {
  localStorage.setItem(storageKey, JSON.stringify(currentData));
}

async function resetToSeed() {
  if (!confirm("지금까지 이 브라우저에서 바꾼 내용을 지우고 초기 데이터로 되돌릴까요?")) return;
  localStorage.removeItem(storageKey);
  const res = await fetch("/api/data");
  currentData = await res.json();
  storageKey = storageKeyFor(currentData.project);
  saveToLocalStorage();
  excludedSelection[1].clear();
  excludedSelection[2].clear();
  excludedSelection[3].clear();
  render();
}

function render() {
  for (const tier of [1, 2, 3]) {
    const grid = document.getElementById(`grid-${tier}`);
    grid.innerHTML = "";
    const items = currentData.references.filter(
      (r) => r.tier === tier && r.status === "active"
    );
    items.forEach((ref) => {
      grid.appendChild(renderCard(ref, tier));
    });
    updateStatusLabel(tier);
  }
}

function renderCard(ref, tier) {
  const card = document.createElement("div");
  card.className = "ref-card";
  card.dataset.name = ref.name;

  const isMarked = excludedSelection[tier].has(ref.name);
  if (isMarked) card.classList.add("marked");

  const tagsHtml = (ref.tags || [])
    .map((t) => `<span>${escapeHtml(t)}</span>`)
    .join("");

  card.innerHTML = `
    <a class="thumb-link" href="${escapeAttr(ref.url)}" target="_blank" rel="noopener">
      <img class="thumb" src="${escapeAttr(ref.image)}" alt="${escapeAttr(ref.name)}">
      <label class="exclude-toggle" onclick="event.stopPropagation()">
        <input type="checkbox" ${isMarked ? "checked" : ""} onchange="toggleExclude(${tier}, '${escapeJs(ref.name)}', this.checked)">
        제외
      </label>
    </a>
    <div class="body">
      <h3><a href="${escapeAttr(ref.url)}" target="_blank" rel="noopener">${escapeHtml(ref.name)}</a></h3>
      <div class="tags">${tagsHtml}</div>
      <p class="reason">${escapeHtml(ref.reason || "")}</p>
    </div>
  `;
  return card;
}

function toggleExclude(tier, name, checked) {
  if (checked) excludedSelection[tier].add(name);
  else excludedSelection[tier].delete(name);
  render();
}

function updateStatusLabel(tier) {
  const n = excludedSelection[tier].size;
  const statusEl = document.getElementById(`status-${tier}`);
  statusEl.textContent = n > 0 ? `${n}개 선택됨` : "";
  document.getElementById(`btn-${tier}`).disabled = n === 0;
}

async function requestNewReferences(tier) {
  const names = Array.from(excludedSelection[tier]);
  if (names.length === 0) return;

  const btn = document.getElementById(`btn-${tier}`);
  const statusEl = document.getElementById(`status-${tier}`);
  btn.disabled = true;
  statusEl.textContent = `Claude가 ${names.length}개 레퍼런스를 재검색 중입니다... (몇십 초 걸릴 수 있어요)`;

  try {
    // 1) 로컬에서 먼저 제외 처리
    currentData.references.forEach((r) => {
      if (names.includes(r.name)) r.status = "excluded";
    });
    const allNames = currentData.references.map((r) => r.name);

    // 2) 서버(Claude API)에 같은 개수만큼 새 레퍼런스 요청
    const res = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tier,
        count: names.length,
        genre: currentData.genre,
        project: currentData.project,
        excludeNames: allNames,
      }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "요청이 실패했습니다.");

    currentData.references.push(...body.added);
    saveToLocalStorage();
    excludedSelection[tier].clear();
    document.getElementById("setup-warning").style.display = "none";
    render();
    statusEl.textContent = `${body.added.length}개 교체 완료`;
  } catch (err) {
    console.error(err);
    statusEl.textContent = "오류: " + err.message;
    if (/api[_-]?key/i.test(err.message)) {
      document.getElementById("setup-warning").style.display = "block";
    }
    btn.disabled = false;
  }
}

// 검색창: "OOO 기업사이트를 찾아줘" 같은 자유 텍스트로 완전히 새 무드보드(18개)를 생성한다.
async function searchNewProject() {
  const input = document.getElementById("searchInput");
  const btn = document.getElementById("searchBtn");
  const status = document.getElementById("searchStatus");
  const query = input.value.trim();
  if (!query) return;

  btn.disabled = true;
  input.disabled = true;
  status.textContent = "요청을 분석하는 중...";

  try {
    // 1) 기업명/장르 추출
    const parseRes = await fetch("/api/parse-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const parsed = await parseRes.json();
    if (!parseRes.ok) throw new Error(parsed.error || "요청을 이해하지 못했습니다.");

    const newData = { project: parsed.project, genre: parsed.genre, references: [] };
    const allNames = [];

    // 2) Tier 1 -> 2 -> 3 순서로 6개씩 생성 (진행 상황을 화면에 표시)
    const tierLabels = { 1: "Tier 1 (평범한 레이아웃)", 2: "Tier 2 (트렌디하지만 정돈된 레이아웃)", 3: "Tier 3 (과감한 인터랙션)" };
    for (const tier of [1, 2, 3]) {
      status.textContent = `${parsed.project} - ${tierLabels[tier]} 6개 검색 중... (몇십 초 걸릴 수 있어요)`;
      const res = await fetch("/api/generate-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: parsed.project,
          genre: parsed.genre,
          tier,
          count: 6,
          excludeNames: allNames,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `Tier ${tier} 생성에 실패했습니다.`);
      newData.references.push(...body.added);
      body.added.forEach((r) => allNames.push(r.name));
      // 중간 결과를 바로 화면에 반영해서 진행 상황이 보이게 한다.
      currentData = newData;
      render();
    }

    storageKey = storageKeyFor(newData.project);
    currentData = newData;
    saveToLocalStorage();
    excludedSelection[1].clear();
    excludedSelection[2].clear();
    excludedSelection[3].clear();
    finishLoad();
    status.textContent = `"${parsed.project}" 무드보드 생성 완료 (18개)`;
  } catch (err) {
    console.error(err);
    status.textContent = "오류: " + err.message;
  } finally {
    btn.disabled = false;
    input.disabled = false;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
function escapeJs(str) {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("searchInput");
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") searchNewProject();
    });
  }
});

loadData().catch((err) => {
  document.querySelector(".wrap").insertAdjacentHTML(
    "afterbegin",
    `<div class="setup-warning" style="display:block;">초기 데이터 로딩 실패: ${escapeHtml(err.message)}. 서버가 정상 배포/실행 중인지 확인하세요.</div>`
  );
});
