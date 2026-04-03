// ── scenarios.js — Browser-tab Scenario Engine + Share Links ──

// ── Scenario store ──
const SCENARIO_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#84cc16'];

let scenarioStore = []; // array of { id, name, color, inputs }
let activeScenarioId = null;
let hasUnsavedData = false;

const INPUT_IDS = [
  'startAge','retireAge','endAge',
  'taxableBalance','retirementBalance',
  'taxableReturn','retirementReturn','inflationRate',
  'taxableContrib','retirementContrib',
  'spendingModel','initialSpending','spendPct',
  'guardBase','guardFloor','guardCeiling',
  'curveEarly','curveMid','curveLate',
  'ssMonthly','ssStartAge','pensionMonthly','rentalAnnual',
  'retirementTaxPct','capitalGainsTaxPct','rmdTaxPct',
  'rothConversion','rothAnnual','targetIncome',
];

// ── Random name generator for anonymous plans ──
const ADJ  = ['Blue','Swift','Bright','Calm','Bold','Clear','Sage','Silver','Golden','Steady'];
const NOUN = ['Mountain','Horizon','River','Summit','Valley','Harbor','Meadow','Ridge','Crest','Path'];
function randomName() {
  return ADJ[Math.floor(Math.random()*ADJ.length)] + NOUN[Math.floor(Math.random()*NOUN.length)];
}

// ── Read all sidebar inputs into an object ──
function readInputs() {
  const obj = {};
  INPUT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') obj[id] = el.checked;
    else obj[id] = el.value;
  });
  return obj;
}

// ── Write an inputs object back to the sidebar ──
function writeInputs(obj) {
  INPUT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el || obj[id] === undefined) return;
    if (el.type === 'checkbox') el.checked = !!obj[id];
    else el.value = obj[id];
  });
  // Restore UI visibility
  if (typeof onSpendingModelChange === 'function') onSpendingModelChange();
  const roth = document.getElementById('rothConversion');
  const rothInputs = document.getElementById('roth-inputs');
  if (roth && rothInputs) rothInputs.classList.toggle('hidden', !roth.checked);
}

// ── Save current sidebar inputs to the active scenario ──
function saveActiveInputs() {
  const sc = scenarioStore.find(s => s.id === activeScenarioId);
  if (sc) sc.inputs = readInputs();
}

// ── Render the tab bar ──
function renderScenarioTabs() {
  const list = document.getElementById('scenTabsList');
  if (!list) return;
  list.innerHTML = '';
  scenarioStore.forEach(sc => {
    const tab = document.createElement('div');
    tab.className = 'scen-tab' + (sc.id === activeScenarioId ? ' active' : '');
    tab.dataset.id = sc.id;
    tab.style.setProperty('--tab-color', sc.color);
    tab.innerHTML = `
      <span class="scen-tab-dot" style="background:${sc.color}"></span>
      <span class="scen-tab-name" ondblclick="renameScenario('${sc.id}')">${sc.name}</span>
      ${scenarioStore.length > 1 ? `<button class="scen-tab-close" onclick="deleteScenario('${sc.id}',event)" title="Remove scenario">×</button>` : ''}
    `;
    tab.addEventListener('click', () => switchScenario(sc.id));
    list.appendChild(tab);
  });

  // Update sidebar header
  const sc = scenarioStore.find(s => s.id === activeScenarioId);
  if (sc) {
    const dot = document.getElementById('sidebarScenDot');
    const lbl = document.getElementById('sidebarScenLabel');
    if (dot) dot.style.background = sc.color;
    if (lbl) lbl.textContent = sc.name;
  }
}

// ── Switch active scenario ──
function switchScenario(id) {
  if (id === activeScenarioId) return;
  saveActiveInputs();
  activeScenarioId = id;
  const sc = scenarioStore.find(s => s.id === id);
  if (sc) writeInputs(sc.inputs);
  renderScenarioTabs();
  markDirty();
  if (typeof runModel === 'function') runModel();
}

// ── Add new scenario ──
function addScenario() {
  saveActiveInputs();
  const id    = 'sc_' + Date.now();
  const name  = 'Scenario ' + (scenarioStore.length + 1);
  const color = SCENARIO_COLORS[scenarioStore.length % SCENARIO_COLORS.length];
  // Copy current inputs as default
  const inputs = readInputs();
  scenarioStore.push({ id, name, color, inputs });
  activeScenarioId = id;
  writeInputs(inputs);
  renderScenarioTabs();
  markDirty();
  if (typeof runModel === 'function') runModel();
}

// ── Delete scenario ──
function deleteScenario(id, event) {
  event.stopPropagation();
  if (scenarioStore.length <= 1) return;
  const idx = scenarioStore.findIndex(s => s.id === id);
  scenarioStore.splice(idx, 1);
  if (activeScenarioId === id) {
    activeScenarioId = scenarioStore[Math.max(0, idx - 1)].id;
    writeInputs(scenarioStore.find(s => s.id === activeScenarioId).inputs);
  }
  renderScenarioTabs();
  markDirty();
  if (typeof runModel === 'function') runModel();
}

// ── Rename scenario ──
function renameScenario(id) {
  const sc = scenarioStore.find(s => s.id === id);
  if (!sc) return;
  const tab = document.querySelector(`.scen-tab[data-id="${id}"] .scen-tab-name`);
  if (!tab) return;
  const orig = sc.name;
  tab.contentEditable = 'true';
  tab.focus();
  // Select all text
  const range = document.createRange();
  range.selectNodeContents(tab);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);

  function finish() {
    tab.contentEditable = 'false';
    const newName = tab.textContent.trim() || orig;
    sc.name = newName;
    tab.textContent = newName;
    renderScenarioTabs();
    markDirty();
  }
  tab.addEventListener('blur', finish, { once: true });
  tab.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); tab.blur(); } if (e.key === 'Escape') { tab.textContent = orig; tab.blur(); } }, { once: true });
}

// ── Run all scenarios and return their projections ──
function getAllScenarioData() {
  saveActiveInputs();
  const results = {};
  scenarioStore.forEach(sc => {
    // Temporarily write inputs, project, restore
    const prev = readInputs();
    writeInputs(sc.inputs);
    // Read values silently
    const data = typeof projectScenario === 'function' ? projectScenario() : [];
    results[sc.id] = { name: sc.name, color: sc.color, data };
    writeInputs(prev);
  });
  // Restore active
  const active = scenarioStore.find(s => s.id === activeScenarioId);
  if (active) writeInputs(active.inputs);
  return results;
}

// ── Share link (localStorage-based) ──
function getShareId() {
  const planName = (document.getElementById('planName')?.value || '').trim();
  // Use plan name as slug (url-safe) or generate random
  if (planName && planName !== 'My Retirement Plan') {
    return planName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || randomName();
  }
  return randomName();
}

function copyShareLink() {
  saveActiveInputs();
  const shareId = getShareId();
  const planName = document.getElementById('planName')?.value || shareId;
  const payload  = JSON.stringify({ planName, scenarios: scenarioStore, activeId: activeScenarioId });
  try {
    localStorage.setItem('rp_' + shareId, payload);
  } catch(e) { /* storage full */ }

  const url = window.location.origin + window.location.pathname + '?id=' + encodeURIComponent(shareId);
  navigator.clipboard.writeText(url).then(() => {
    showToast(`Link copied: ?id=${shareId}`, 'success');
    hasUnsavedData = false;
  }).catch(() => {
    const el = document.createElement('textarea');
    el.value = url; el.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(el); el.select();
    document.execCommand('copy'); document.body.removeChild(el);
    showToast(`Link copied: ?id=${shareId}`, 'success');
    hasUnsavedData = false;
  });
}

// ── Load from URL (short ID → localStorage) ──
function loadFromURL() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('id')) {
    const shareId = params.get('id');
    try {
      const stored = localStorage.getItem('rp_' + shareId);
      if (stored) {
        const payload = JSON.parse(stored);
        document.getElementById('planName').value = payload.planName || shareId;
        scenarioStore   = payload.scenarios   || scenarioStore;
        activeScenarioId= payload.activeId    || scenarioStore[0]?.id;
        const active = scenarioStore.find(s => s.id === activeScenarioId);
        if (active) writeInputs(active.inputs);
        renderScenarioTabs();
        return true;
      }
    } catch(e) {}
  }
  return false;
}

// ── Plan name changes update tab if matching ──
function onPlanNameChange() {
  markDirty();
}

// ── Unsaved data tracking ──
function markDirty() {
  hasUnsavedData = true;
}

window.addEventListener('beforeunload', e => {
  if (hasUnsavedData) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// Intercept Ctrl+R / F5
document.addEventListener('keydown', e => {
  if (hasUnsavedData && (e.key === 'F5' || (e.ctrlKey && e.key === 'r') || (e.metaKey && e.key === 'r'))) {
    e.preventDefault();
    document.getElementById('unsaved-modal').style.display = 'flex';
  }
});

function closeUnsavedModal() {
  document.getElementById('unsaved-modal').style.display = 'none';
}
function hardRefresh() {
  hasUnsavedData = false;
  window.location.reload();
}

// ── Init scenarios ──
function initScenarios() {
  // Check if URL has data
  const loaded = loadFromURL();
  if (!loaded) {
    // Create default first scenario
    const defaultInputs = readInputs();
    scenarioStore   = [{ id: 'sc_1', name: 'Scenario 1', color: SCENARIO_COLORS[0], inputs: defaultInputs }];
    activeScenarioId= 'sc_1';
  }
  renderScenarioTabs();
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initScenarios();
  // Wire all inputs to mark dirty + run model
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input',  () => { markDirty(); saveActiveInputs(); });
    el.addEventListener('change', () => { markDirty(); saveActiveInputs(); });
  });
});
