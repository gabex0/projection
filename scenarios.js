// ── scenarios.js — Browser-tab Scenario Engine + Share Links ──

const SCENARIO_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#f97316','#84cc16'];

let scenarioStore    = [];
let activeScenarioId = null;
let hasUnsavedData   = false;

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

// ── Random name generator ──
const ADJ  = ['Blue','Swift','Bright','Calm','Bold','Clear','Sage','Silver','Golden','Steady'];
const NOUN = ['Mountain','Horizon','River','Summit','Valley','Harbor','Meadow','Ridge','Crest','Path'];
function randomName() {
  return ADJ[Math.floor(Math.random()*ADJ.length)] + NOUN[Math.floor(Math.random()*NOUN.length)];
}

// ── Generate a unique 5-digit numeric suffix ──
function randomSuffix() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

// ── Read sidebar inputs ──
function readInputs() {
  const obj = {};
  INPUT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    obj[id] = el.type === 'checkbox' ? el.checked : el.value;
  });
  return obj;
}

// ── Write inputs to sidebar ──
function writeInputs(obj) {
  INPUT_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el || obj[id] === undefined) return;
    if (el.type === 'checkbox') el.checked = !!obj[id];
    else el.value = obj[id];
  });
  if (typeof onSpendingModelChange === 'function') onSpendingModelChange();
  const roth = document.getElementById('rothConversion');
  const rothInputs = document.getElementById('roth-inputs');
  if (roth && rothInputs) rothInputs.classList.toggle('hidden', !roth.checked);
}

// ── Save current sidebar to active scenario ──
function saveActiveInputs() {
  const sc = scenarioStore.find(s => s.id === activeScenarioId);
  if (sc) sc.inputs = readInputs();
}

// ── Render tab bar ──
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
      ${scenarioStore.length > 1 ? `<button class="scen-tab-close" onclick="deleteScenario('${sc.id}',event)" title="Remove">×</button>` : ''}
    `;
    tab.addEventListener('click', () => switchScenario(sc.id));
    list.appendChild(tab);
  });

  const sc = scenarioStore.find(s => s.id === activeScenarioId);
  if (sc) {
    const dot = document.getElementById('sidebarScenDot');
    const lbl = document.getElementById('sidebarScenLabel');
    if (dot) dot.style.background = sc.color;
    if (lbl) lbl.textContent = sc.name;
  }
}

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

function addScenario() {
  saveActiveInputs();
  const id    = 'sc_' + Date.now();
  const name  = 'Scenario ' + (scenarioStore.length + 1);
  const color = SCENARIO_COLORS[scenarioStore.length % SCENARIO_COLORS.length];
  const inputs = readInputs();
  scenarioStore.push({ id, name, color, inputs });
  activeScenarioId = id;
  writeInputs(inputs);
  renderScenarioTabs();
  markDirty();
  if (typeof runModel === 'function') runModel();
}

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

function renameScenario(id) {
  const sc = scenarioStore.find(s => s.id === id);
  if (!sc) return;
  const tab = document.querySelector(`.scen-tab[data-id="${id}"] .scen-tab-name`);
  if (!tab) return;
  const orig = sc.name;
  tab.contentEditable = 'true';
  tab.focus();
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
  tab.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); tab.blur(); }
    if (e.key === 'Escape') { tab.textContent = orig; tab.blur(); }
  }, { once: true });
}

function getAllScenarioData() {
  saveActiveInputs();
  const results = {};
  scenarioStore.forEach(sc => {
    const prev = readInputs();
    writeInputs(sc.inputs);
    const data = typeof projectScenario === 'function' ? projectScenario() : [];
    results[sc.id] = { name: sc.name, color: sc.color, data };
    writeInputs(prev);
  });
  const active = scenarioStore.find(s => s.id === activeScenarioId);
  if (active) writeInputs(active.inputs);
  return results;
}

// ════════════════════════════════════════════════════
// SHARE LINK  —  Each "Copy Link" generates a NEW,
// unique key so two people with the same plan name
// never overwrite each other.
// Format: PlanName_XXXXX  (5-digit random suffix)
// ════════════════════════════════════════════════════
function copyShareLink() {
  saveActiveInputs();

  const planName = (document.getElementById('planName')?.value || '').trim() || randomName();
  const slug     = planName.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20) || 'Plan';

  // Always a fresh suffix — never reuses a prior key
  const suffix   = randomSuffix();
  const shareKey = slug + '_' + suffix;

  // ── Everything that must survive the link ──
  const payload = JSON.stringify({
    // Plan identity
    planName,

    // All scenario tabs + their inputs
    scenarios:   scenarioStore,
    activeId:    activeScenarioId,

    // UI state
    theme:    typeof currentTheme !== 'undefined' ? currentTheme : 'dark',
    mode:     typeof currentMode  !== 'undefined' ? currentMode  : 'forward',
    darkMode: document.documentElement.getAttribute('data-theme') === 'dark',

    // ── Add any new state here in future updates ──
    // e.g.  someNewFlag: someValue,
  });

  try {
    localStorage.setItem('rp_' + shareKey, payload);
  } catch(e) {
    showToast('Local storage full — clear old plans first', 'error');
    return;
  }

  const url = window.location.origin + window.location.pathname + '?id=' + encodeURIComponent(shareKey);

  const writeToClipboard = (text) => {
    return navigator.clipboard.writeText(text).catch(() => {
      const el = Object.assign(document.createElement('textarea'), { value: text });
      el.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
  };

  writeToClipboard(url).then(() => {
    showToast(`Link copied — ID: ${shareKey}`, 'success');
    hasUnsavedData = false;
  });
}

// ── Load from URL ──
function loadFromURL() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('id')) return false;

  const shareKey = params.get('id');
  try {
    const stored = localStorage.getItem('rp_' + shareKey);
    if (!stored) {
      // Key not in this browser's storage — show a helpful message after load
      window._shareMissing = shareKey;
      return false;
    }

    const payload = JSON.parse(stored);

    // Plan name
    const nameEl = document.getElementById('planName');
    if (nameEl && payload.planName) nameEl.value = payload.planName;

    // Scenarios
    if (payload.scenarios?.length) {
      scenarioStore    = payload.scenarios;
      activeScenarioId = payload.activeId || scenarioStore[0]?.id;
      const active = scenarioStore.find(s => s.id === activeScenarioId);
      if (active) writeInputs(active.inputs);
    }

    // Dark mode
    if (payload.darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      const iconDark  = document.getElementById('icon-dark');
      const iconLight = document.getElementById('icon-light');
      if (iconDark)  iconDark.style.display  = 'none';
      if (iconLight) iconLight.style.display = '';
    }

    // Slideshow theme — applied after slideshow.js initializes
    if (payload.theme) window._restoredTheme = payload.theme;

    // Forward/reverse mode — applied after model.js initializes
    if (payload.mode) window._restoredMode = payload.mode;

    renderScenarioTabs();
    return true;
  } catch(e) {
    console.warn('Failed to load share data:', e);
    return false;
  }
}

// ── Plan name input handler ──
function onPlanNameChange() { markDirty(); }

// ── Dirty tracking ──
function markDirty() { hasUnsavedData = true; }

window.addEventListener('beforeunload', e => {
  if (hasUnsavedData) { e.preventDefault(); e.returnValue = ''; }
});

document.addEventListener('keydown', e => {
  if (hasUnsavedData && (e.key === 'F5' || (e.ctrlKey && e.key === 'r') || (e.metaKey && e.key === 'r'))) {
    e.preventDefault();
    document.getElementById('unsaved-modal').style.display = 'flex';
  }
});

function closeUnsavedModal() { document.getElementById('unsaved-modal').style.display = 'none'; }
function hardRefresh() { hasUnsavedData = false; window.location.reload(); }

// ── Init ──
function initScenarios() {
  const loaded = loadFromURL();
  if (!loaded) {
    const defaultInputs = readInputs();
    scenarioStore    = [{ id: 'sc_1', name: 'Scenario 1', color: SCENARIO_COLORS[0], inputs: defaultInputs }];
    activeScenarioId = 'sc_1';
  }
  renderScenarioTabs();

  // Show notice if link ID was not found in this browser
  if (window._shareMissing) {
    setTimeout(() => showToast(`Plan "${window._shareMissing}" not found in this browser — links only work on the browser where they were created`, 'error'), 800);
    window._shareMissing = null;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initScenarios();
  document.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input',  () => { markDirty(); saveActiveInputs(); });
    el.addEventListener('change', () => { markDirty(); saveActiveInputs(); });
  });
});
