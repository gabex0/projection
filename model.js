// ── Retirement Projection — model.js ──

let projectionData = [];
let chart = null;

const $ = id => document.getElementById(id);

// IRS Uniform Lifetime Table (SECURE 2.0, effective 2022)
const RMD_TABLE = {
  73:26.5, 74:25.5, 75:24.6, 76:23.7, 77:22.9, 78:22.0, 79:21.1,
  80:20.2, 81:19.4, 82:18.5, 83:17.7, 84:16.8, 85:16.0, 86:15.2, 87:14.4,
  88:13.7, 89:12.9, 90:12.2, 91:11.5, 92:10.8, 93:10.1, 94:9.5,  95:8.9,
  96:8.4,  97:7.8,  98:7.3,  99:6.8,  100:6.4, 101:6.0, 102:5.6, 103:5.2,
  104:4.9, 105:4.6, 106:4.3, 107:4.1, 108:3.9, 109:3.7, 110:3.5
};

// ── URL param map — all 13 inputs ──
const PARAM_MAP = {
  startAge:           'sa',
  endAge:             'ea',
  taxableBalance:     'tb',
  retirementBalance:  'rb',
  taxableReturn:      'tr',
  retirementReturn:   'rr',
  inflationRate:      'ir',
  retireAge:          'ra',
  taxableContrib:     'tc',
  retirementContrib:  'rc',
  initialSpending:    'sp',
  retirementTaxPct:   'rt',
  rmdTaxPct:          'rm',
};

function getVal(id) {
  const el = $(id);
  return el ? (parseFloat(el.value) || 0) : 0;
}

// ── URL share ──
function loadFromURL() {
  const params = new URLSearchParams(window.location.search);
  for (const [id, key] of Object.entries(PARAM_MAP)) {
    if (params.has(key)) {
      const el = $(id);
      if (el) el.value = params.get(key);
    }
  }
}

function buildShareURL() {
  const params = new URLSearchParams();
  for (const [id, key] of Object.entries(PARAM_MAP)) {
    params.set(key, getVal(id));
  }
  return window.location.origin + window.location.pathname + '?' + params.toString();
}

function copyShareLink() {
  const url = buildShareURL();
  navigator.clipboard.writeText(url).then(() => {
    showToast('Link copied!', 'success');
  }).catch(() => {
    const el = document.createElement('textarea');
    el.value = url; el.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(el); el.select();
    document.execCommand('copy'); document.body.removeChild(el);
    showToast('Link copied!', 'success');
  });
}

// ── Formatting ──
function fmtRaw(n) {
  if (!n && n !== 0) return '—';
  if (n === 0) return '—';
  return '$' + Math.round(n).toLocaleString('en-US');
}
function fmtShort(n) {
  const a = Math.abs(n);
  if (a >= 1e9) return '$' + (n/1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M';
  if (a >= 1e3) return '$' + (n/1e3).toFixed(0) + 'K';
  return '$' + Math.round(n).toLocaleString();
}
function fmtPct(n) { return (+n).toFixed(1) + '%'; }

// ── Core Model ──
function runModel() {
  const startAge    = getVal('startAge');
  const endAge      = getVal('endAge');
  const retireAge   = getVal('retireAge');
  const taxStart    = getVal('taxableBalance');
  const retStart    = getVal('retirementBalance');
  const taxRate     = getVal('taxableReturn') / 100;
  const retRate     = getVal('retirementReturn') / 100;
  const inflation   = getVal('inflationRate') / 100;
  const taxContrib  = getVal('taxableContrib');
  const retContrib  = getVal('retirementContrib');
  const initSpend   = getVal('initialSpending');
  const retTaxRate  = getVal('retirementTaxPct') / 100;
  const rmdTaxRate  = getVal('rmdTaxPct') / 100;

  projectionData = [];
  let taxable    = taxStart;
  let retirement = retStart;
  let spending   = initSpend;

  for (let age = startAge; age <= endAge; age++) {
    const isRetired = age >= retireAge;

    // Spending grows with inflation each year after the first retirement year
    if (isRetired && age > retireAge) {
      spending = spending * (1 + inflation);
    } else if (!isRetired) {
      spending = initSpend;
    }

    const netReturn     = taxable * taxRate + retirement * retRate;
    const contributions = isRetired ? 0 : (taxContrib + retContrib);
    const spendAmt      = isRetired ? spending : 0;

    // RMD calculation (SECURE 2.0: starts at age 73)
    let rmdGross = 0, rmdTax = 0, rmdAfterTax = 0;
    if (isRetired && age >= 73 && RMD_TABLE[age]) {
      rmdGross    = Math.min(retirement, retirement / RMD_TABLE[age]);
      rmdTax      = rmdGross * rmdTaxRate;
      rmdAfterTax = rmdGross - rmdTax;
    }

    let endTaxable, endRetirement, retWdGross = 0, retWdTax = 0;

    if (!isRetired) {
      endTaxable    = taxable * (1 + taxRate) + taxContrib;
      endRetirement = retirement * (1 + retRate) + retContrib;
    } else {
      // Retirement account: grow, then deduct RMD
      const retAfterRmd = Math.max(0, retirement - rmdGross);
      const grownRet    = retAfterRmd * (1 + retRate);

      // Taxable account: grow, add after-tax RMD proceeds
      const grownTax = taxable * (1 + taxRate) + rmdAfterTax;

      // Spend from taxable first, then retirement
      const taxableWd = Math.min(grownTax, spendAmt);
      const remaining = Math.max(0, spendAmt - taxableWd);

      // If still need more, gross up from retirement to cover tax
      if (remaining > 0 && retTaxRate < 1) {
        retWdGross = Math.min(grownRet, remaining / (1 - retTaxRate));
        retWdTax   = retWdGross * retTaxRate;
      }

      endTaxable    = Math.max(0, grownTax - taxableWd);
      endRetirement = Math.max(0, grownRet - retWdGross);
    }

    const totalBalance = endTaxable + endRetirement;

    projectionData.push({
      age, isRetired,
      phase:           isRetired ? 'Retirement' : 'Accumulation',
      taxableStart:    taxable,
      retirementStart: retirement,
      netReturn,
      contributions,
      spending:        spendAmt,
      rmdGross,
      rmdTax,
      retWdGross,
      retWdTax,
      endTaxable,
      endRetirement,
      totalBalance
    });

    taxable    = endTaxable;
    retirement = endRetirement;

    if (isRetired && age === retireAge) spending = initSpend;
  }

  renderSummary();
  renderProjectionTable();
  renderAssumptions();
  renderChart();
  if (typeof renderSlideshow === 'function') renderSlideshow();
}

// ── Summary Cards ──
function renderSummary() {
  const retRow   = projectionData.find(r => r.isRetired);
  const peak     = projectionData.reduce((a,b) => b.totalBalance > a.totalBalance ? b : a, projectionData[0]);
  const endRow   = projectionData[projectionData.length - 1];
  const totalRMD = projectionData.reduce((s,r) => s + r.rmdGross, 0);

  const retTotal = retRow
    ? retRow.taxableStart + retRow.retirementStart
    : projectionData[0].totalBalance;

  $('val-retire').textContent   = fmtShort(retTotal);
  $('val-peak').textContent     = fmtShort(peak.totalBalance);
  $('val-peak-age').textContent = `Age ${peak.age}`;
  $('val-end').textContent      = fmtShort(endRow.totalBalance);
  $('val-rmds').textContent     = fmtShort(totalRMD);
}

// ── Projection Table ──
function renderProjectionTable() {
  const tbody     = $('projectionBody');
  const retireAge = getVal('retireAge');
  tbody.innerHTML = '';

  projectionData.forEach(row => {
    const tr = document.createElement('tr');
    if (row.age === retireAge) tr.classList.add('retire-start');

    const pillCls  = row.isRetired ? 'pill-ret' : 'pill-acc';
    const retCls   = row.netReturn >= 0 ? 'v-pos' : 'v-neg';
    const contrib  = row.contributions > 0 ? `<span class="v-pos">${fmtRaw(row.contributions)}</span>` : `<span class="v-dim">—</span>`;
    const spend    = row.spending > 0 ? `<span class="v-neg">(${fmtRaw(row.spending)})</span>` : `<span class="v-dim">—</span>`;
    const rmd      = row.rmdGross > 0 ? `<span>${fmtRaw(row.rmdGross)}</span>` : `<span class="v-dim">—</span>`;
    const rmdTx    = row.rmdTax > 0 ? `<span class="v-neg">(${fmtRaw(row.rmdTax)})</span>` : `<span class="v-dim">—</span>`;
    const retWdTx  = row.retWdTax > 0 ? `<span class="v-neg">(${fmtRaw(row.retWdTax)})</span>` : `<span class="v-dim">—</span>`;

    tr.innerHTML = `
      <td class="sticky-col">${row.age}</td>
      <td><span class="pill ${pillCls}">${row.phase}</span></td>
      <td>${fmtRaw(row.taxableStart)}</td>
      <td>${fmtRaw(row.retirementStart)}</td>
      <td class="${retCls}">${fmtRaw(row.netReturn)}</td>
      <td>${contrib}</td>
      <td>${spend}</td>
      <td class="col-rmd">${rmd}</td>
      <td class="col-rmd">${rmdTx}</td>
      <td class="col-rmd">${retWdTx}</td>
      <td>${fmtRaw(row.endTaxable)}</td>
      <td>${fmtRaw(row.endRetirement)}</td>
      <td>${fmtRaw(row.totalBalance)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Assumptions Table ──
function renderAssumptions() {
  const tbody = $('assumptionsBody');
  tbody.innerHTML = '';

  const rows = [
    { section: 'Starting Position' },
    { label: 'Starting Age',                   value: getVal('startAge') },
    { label: 'End Age',                         value: getVal('endAge') },
    { label: 'Starting Taxable Balance',        value: fmtRaw(getVal('taxableBalance')) },
    { label: 'Starting Retirement Balance',     value: fmtRaw(getVal('retirementBalance')) },
    { section: 'Return Rates' },
    { label: 'Taxable Return Rate',             value: fmtPct(getVal('taxableReturn')) },
    { label: 'Retirement Return Rate',          value: fmtPct(getVal('retirementReturn')) },
    { label: 'Inflation Rate',                  value: fmtPct(getVal('inflationRate')) },
    { section: 'Contributions' },
    { label: 'Retirement Age',                  value: getVal('retireAge') },
    { label: 'Annual Taxable Contribution',     value: fmtRaw(getVal('taxableContrib')) },
    { label: 'Annual Retirement Contribution',  value: fmtRaw(getVal('retirementContrib')) },
    { section: 'Retirement Spending' },
    { label: 'Year-1 Spending',                 value: fmtRaw(getVal('initialSpending')) },
    { section: 'Taxes' },
    { label: 'Retirement Withdrawal Tax Rate',  value: fmtPct(getVal('retirementTaxPct')) },
    { label: 'RMD Tax Rate',                    value: fmtPct(getVal('rmdTaxPct')) },
    { section: 'Model Logic' },
    { label: 'Accumulation',    value: 'End = Start × (1 + return) + contribution' },
    { label: 'Retirement Draw', value: 'Taxable-first; retirement grossed up for taxes' },
    { label: 'RMD',             value: 'SECURE 2.0: starts age 73, IRS Uniform Lifetime Table' },
    { label: 'Spending Growth', value: 'Inflation-adjusted annually' },
    { note: 'For illustrative purposes only. Not financial advice.' },
  ];

  rows.forEach(r => {
    const tr = document.createElement('tr');
    if (r.section) {
      tr.classList.add('section-row');
      tr.innerHTML = `<td colspan="2">${r.section}</td>`;
    } else if (r.note) {
      tr.classList.add('note-row');
      tr.innerHTML = `<td colspan="2">${r.note}</td>`;
    } else {
      tr.innerHTML = `<td>${r.label}</td><td>${r.value}</td>`;
    }
    tbody.appendChild(tr);
  });
}

// ── Main chart ──
function renderChart() {
  const labels  = projectionData.map(r => r.age);
  const totData = projectionData.map(r => Math.round(r.totalBalance));
  const taxData = projectionData.map(r => Math.round(r.endTaxable));
  const retData = projectionData.map(r => Math.round(r.endRetirement));

  const ctx = $('projectionChart').getContext('2d');
  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Total', data: totData, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.06)', borderWidth: 2, fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4 },
        { label: 'Taxable', data: taxData, borderColor: '#15803d', backgroundColor: 'transparent', borderWidth: 1.2, borderDash: [4,3], tension: 0.3, pointRadius: 0, pointHoverRadius: 3 },
        { label: 'Retirement', data: retData, borderColor: '#b45309', backgroundColor: 'transparent', borderWidth: 1.2, borderDash: [4,3], tension: 0.3, pointRadius: 0, pointHoverRadius: 3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#6b7280', font: { family: "'Inter', sans-serif", size: 11 }, boxWidth: 24, boxHeight: 2, padding: 16 } },
        tooltip: { backgroundColor: '#111827', titleColor: '#f9fafb', bodyColor: '#d1d5db', borderColor: '#374151', borderWidth: 1, padding: 10, callbacks: { title: i => `Age ${i[0].label}`, label: i => ` ${i.dataset.label}: ${fmtShort(i.raw)}` } }
      },
      scales: {
        x: { grid: { color: '#f3f4f6' }, border: { display: false }, ticks: { color: '#9ca3af', font: { family: "'JetBrains Mono', monospace", size: 10 }, maxTicksLimit: 14 } },
        y: { grid: { color: '#f3f4f6' }, border: { display: false }, ticks: { color: '#9ca3af', font: { family: "'JetBrains Mono', monospace", size: 10 }, callback: v => fmtShort(v) } }
      }
    }
  });
}

// ── Tab switching ──
function switchMainTab(name) {
  document.querySelectorAll('.main-tab').forEach(t => t.classList.toggle('active', t.dataset.mtab === name));
  document.querySelectorAll('.main-pane').forEach(p => p.classList.toggle('active', p.id === 'pane-' + name));
  if (name === 'slideshow' && typeof goToSlide === 'function') goToSlide(currentSlide);
}

function switchTab(name) {
  document.querySelectorAll('.sheet-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
}

// ── Toast ──
let toastTimer;
function showToast(msg, type = '') {
  const el = $('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3000);
}

// ── Wire inputs ──
document.querySelectorAll('input[type="number"]').forEach(el => el.addEventListener('input', runModel));

// ── Init ──
loadFromURL();
runModel();
