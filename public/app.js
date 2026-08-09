// 무드보드 프론트엔드 로직
// - 기본 화면은 대화창(빈 상태)만 보여준다. 사용자가 기업명을 입력해서 검색하면
//   Claude가 Tier 1~3 각 6개(총 18개)를 실시간으로 찾아오고, 그때부터 결과 화면으로 전환된다.
// - 서버는 상태를 저장하지 않는다(Vercel 등 서버리스 대응). 대신 브라우저 localStorage에
//   "가장 최근 검색한 프로젝트가 무엇인지" + "그 프로젝트의 데이터"를 저장해서, 새로고침해도
//   마지막 결과 화면이 유지되게 한다.

const LAST_KEY_POINTER = "moodboard_last_key";
const API_KEY_STORAGE = "user_anthropic_api_key";

let currentData = null;
let storageKey = null;
const excludedSelection = { 1: new Set(), 2: new Set(), 3: new Set() };

// ===== 방문자 개인 API 키 관리 (서버에는 저장하지 않고, 이 브라우저에만 보관) =====
function getApiKey() {
  return (localStorage.getItem(API_KEY_STORAGE) || "").trim();
}
function hasApiKey() {
  return getApiKey().length > 0;
}
function updateSettingsIndicator() {
  const btn = document.getElementById("settingsBtn");
  if (btn) btn.classList.toggle("has-key", hasApiKey());
}
function openSettingsModal() {
  const modal = document.getElementById("settingsModal");
  const input = document.getElementById("apiKeyInput");
  if (!modal) return;
  input.value = getApiKey();
  document.getElementById("modalStatus").textContent = "";
  document.getElementById("modalStatus").className = "modal-status";
  modal.style.display = "flex";
  setTimeout(() => input.focus(), 0);
}
function closeSettingsModal() {
  const modal = document.getElementById("settingsModal");
  if (modal) modal.style.display = "none";
}
function saveApiKey() {
  const input = document.getElementById("apiKeyInput");
  const status = document.getElementById("modalStatus");
  const value = (input.value || "").trim();
  if (!value) {
    status.textContent = "API 키를 입력해주세요.";
    status.className = "modal-status error";
    return;
  }
  localStorage.setItem(API_KEY_STORAGE, value);
  updateSettingsIndicator();
  status.textContent = "저장되었습니다.";
  status.className = "modal-status ok";
  setTimeout(closeSettingsModal, 500);
}
function clearApiKey() {
  localStorage.removeItem(API_KEY_STORAGE);
  document.getElementById("apiKeyInput").value = "";
  updateSettingsIndicator();
  const status = document.getElementById("modalStatus");
  status.textContent = "키를 삭제했습니다.";
  status.className = "modal-status ok";
}

function storageKeyFor(project) {
  return "moodboard_state_" + (project || "default").replace(/\s+/g, "_");
}

// ===== 화면 상태 전환 (빈 상태 <-> 결과 상태) =====
function showEmptyState() {
  document.getElementById("empty-state").style.display = "flex";
  document.getElementById("results-state").style.display = "none";
}
function enterResultsView() {
  document.getElementById("empty-state").style.display = "none";
  document.getElementById("results-state").style.display = "block";
}
function isEmptyStateVisible() {
  return document.getElementById("empty-state").style.display !== "none";
}

// 현재 보이는 상태에 맞는 입력창/버튼/상태표시 요소를 돌려준다.
function getActiveControls() {
  if (isEmptyStateVisible()) {
    return {
      input: document.getElementById("chatInput"),
      button: document.getElementById("chatSendBtn"),
      status: document.getElementById("searchStatus"),
    };
  }
  return {
    input: document.getElementById("compactInput"),
    button: document.getElementById("compactSendBtn"),
    status: document.getElementById("compactStatus"),
  };
}

// ===== 최초 로딩: 마지막으로 검색했던 결과가 있으면 그걸 보여주고, 없으면 빈 대화창만 보여준다 =====
async function loadData() {
  const lastKey = localStorage.getItem(LAST_KEY_POINTER);
  if (lastKey) {
    const cached = localStorage.getItem(lastKey);
    if (cached) {
      try {
        currentData = JSON.parse(cached);
        storageKey = lastKey;
        finishLoad();
        enterResultsView();
        return;
      } catch (e) {
        // 캐시가 깨졌으면 무시하고 빈 상태로 시작한다.
      }
    }
  }
  showEmptyState();
}

function finishLoad() {
  document.getElementById("page-title-text").textContent =
    (currentData.project || "무드보드") + " 디자인 레퍼런스 무드보드";
  document.getElementById("footer-text").innerHTML =
    `Tier 1·2·3 기준 무드보드입니다. 이 브라우저에만 저장됩니다 (localStorage). ` +
    `<a href="#" onclick="resetToEmpty();return false;" style="color:var(--sub);">처음으로 (새로 검색)</a>`;
  render();
}

function saveToLocalStorage() {
  localStorage.setItem(storageKey, JSON.stringify(currentData));
  localStorage.setItem(LAST_KEY_POINTER, storageKey);
}

function resetToEmpty() {
  if (!confirm("지금 보고 있는 무드보드를 닫고 새로 검색할까요? (저장된 결과는 지워지지 않고 다음에 같은 기업을 검색하면 다시 나타날 수 있습니다)")) return;
  currentData = null;
  storageKey = null;
  excludedSelection[1].clear();
  excludedSelection[2].clear();
  excludedSelection[3].clear();
  showEmptyState();
  const input = document.getElementById("chatInput");
  if (input) { input.value = ""; input.focus(); }
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

// ===== 기존 결과에서 선택한 카드만 다시 찾기 (Tier 단위) =====
async function requestNewReferences(tier) {
  const names = Array.from(excludedSelection[tier]);
  if (names.length === 0) return;

  if (!hasApiKey()) {
    openSettingsModal();
    return;
  }

  const btn = document.getElementById(`btn-${tier}`);
  const statusEl = document.getElementById(`status-${tier}`);
  btn.disabled = true;
  statusEl.textContent = `Claude가 ${names.length}개 레퍼런스를 재검색 중입니다... (몇십 초 걸릴 수 있어요)`;

  try {
    currentData.references.forEach((r) => {
      if (names.includes(r.name)) r.status = "excluded";
    });
    const allNames = currentData.references.map((r) => r.name);

    const res = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: getApiKey(),
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
    render();
    statusEl.textContent = `${body.added.length}개 교체 완료`;
  } catch (err) {
    console.error(err);
    statusEl.textContent = "오류: " + err.message;
    if (/api[_-]?key/i.test(err.message)) openSettingsModal();
    btn.disabled = false;
  }
}

// ===== 대화창 검색: 자유 텍스트로 완전히 새 무드보드(18개)를 생성한다 =====
async function searchNewProject() {
  const { input, button, status } = getActiveControls();
  const query = (input.value || "").trim();
  if (!query) { input.focus(); return; }

  if (!hasApiKey()) {
    openSettingsModal();
    status.textContent = "먼저 우측 상단 '설정'에서 본인의 API 키를 등록해주세요.";
    return;
  }

  const wasEmptyState = isEmptyStateVisible();
  button.disabled = true;
  input.disabled = true;
  status.textContent = "요청을 분석하는 중...";

  try {
    const parseRes = await fetch("/api/parse-query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: getApiKey(), query }),
    });
    const parsed = await parseRes.json();
    if (!parseRes.ok) throw new Error(parsed.error || "요청을 이해하지 못했습니다.");

    const newData = { project: parsed.project, genre: parsed.genre, references: [] };
    const allNames = [];

    const tierLabels = { 1: "Tier 1 (평범한 레이아웃)", 2: "Tier 2 (트렌디하지만 정돈된 레이아웃)", 3: "Tier 3 (과감한 인터랙션)" };
    for (const tier of [1, 2, 3]) {
      status.textContent = `${parsed.project} - ${tierLabels[tier]} 6개 검색 중... (몇십 초 걸릴 수 있어요)`;
      const res = await fetch("/api/generate-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: getApiKey(),
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

      // 첫 Tier 결과가 도착하는 순간 결과 화면으로 전환해서 진행 상황이 바로 보이게 한다.
      if (isEmptyStateVisible()) enterResultsView();
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

    const { status: finalStatus } = getActiveControls();
    finalStatus.textContent = `"${parsed.project}" 무드보드 생성 완료 (18개)`;
    input.value = "";
  } catch (err) {
    console.error(err);
    status.textContent = "오류: " + err.message;
    if (/api[_-]?key/i.test(err.message)) openSettingsModal();
    // 실패했고 아직 결과 화면으로 전환되지 않았다면 빈 상태 그대로 유지한다.
    if (wasEmptyState && !currentData) showEmptyState();
  } finally {
    const controls = getActiveControls();
    controls.button.disabled = false;
    controls.input.disabled = false;
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
  updateSettingsIndicator();
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSettingsModal();
  });
  const chatInput = document.getElementById("chatInput");
  if (chatInput) {
    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") searchNewProject();
    });
  }
  const compactInput = document.getElementById("compactInput");
  if (compactInput) {
    compactInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") searchNewProject();
    });
  }
});

loadData().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<div class="setup-warning" style="display:block;">초기화 실패: ${escapeHtml(err.message)}. 서버가 정상 배포/실행 중인지 확인하세요.</div>`
  );
});
