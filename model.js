// ── Retirement Projection — model.js ──

let projectionData = [];
let chart = null;

const $ = id => document.getElementById(id);

// ── Input IDs and their URL param keys ──
const PARAM_MAP = {
  startAge:           'sa',
  taxableBalance:     'tb',
  retirementBalance:  'rb',
  endAge:             'ea',
  taxableReturn:      'tr',
  retirementReturn:   'rr',
  inflationRate:      'ir',
  retireAge:          'ra',
  taxableContrib:     'tc',
  retirementContrib:  'rc',
  initialSpending:    'sp',
  taxableWithdrawPct: 'tw',
  retirementTaxPct:   'rt',
};

function getVal(id) {
  return parseFloat($(id).value) || 0;
}

// ── Load values from URL params on page load ──
function loadFromURL() {
  const params = new URLSearchParams(window.location.search);
  for (const [inputId, paramKey] of Object.entries(PARAM_MAP)) {
    if (params.has(paramKey)) {
      const el = $(inputId);
      if (el) el.value = params.get(paramKey);
    }
  }
}

// ── Build a shareable URL from current inputs ──
function buildShareURL() {
  const params = new URLSearchParams();
  for (const [inputId, paramKey] of Object.entries(PARAM_MAP)) {
    params.set(paramKey, getVal(inputId));
  }
  const base = window.location.origin + window.location.pathname;
  return base + '?' + params.toString();
}

// ── Copy share link to clipboard ──
function copyShareLink() {
  const url = buildShareURL();
  navigator.clipboard.writeText(url).then(() => {
    showToast('Link copied to clipboard!', 'success');
  }).catch(() => {
    // Fallback for older browsers
    const el = document.createElement('textarea');
    el.value = url;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('Link copied to clipboard!', 'success');
  });
}

// ── Formatting ──
function fmt(n) {
  if (n === null || n === undefined) return '—';
  if (n === 0) return '—';
  const neg = n < 0;
  const abs = Math.abs(Math.round(n));
  return (neg ? '(' : '') + '$' + abs.toLocaleString('en-US') + (neg ? ')' : '');
}

function fmtRaw(n) {
  if (!n) return '—';
  return '$' + Math.round(n).toLocaleString('en-US');
}

function fmtShort(n) {
  const abs = Math.abs(n);
  if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + Math.round(n).toLocaleString();
}

function fmtPct(n) { return (+n).toFixed(1) + '%'; }

// ── Core Model ──
function runModel() {
  const startAge     = getVal('startAge');
  const endAge       = getVal('endAge');
  const retireAge    = getVal('retireAge');
  const taxableStart = getVal('taxableBalance');
  const retireStart  = getVal('retirementBalance');
  const taxReturn    = getVal('taxableReturn') / 100;
  const retReturn    = getVal('retirementReturn') / 100;
  const inflation    = getVal('inflationRate') / 100;
  const taxContrib   = getVal('taxableContrib');
  const retContrib   = getVal('retirementContrib');
  const initSpend    = getVal('initialSpending');
  const taxWdPct     = getVal('taxableWithdrawPct') / 100;
  const retTaxGross  = getVal('retirementTaxPct') / 100;

  projectionData = [];
  let taxable    = taxableStart;
  let retirement = retireStart;
  let spending   = initSpend;

  for (let age = startAge; age <= endAge; age++) {
    const isRetired = age >= retireAge;

    if (isRetired && age > retireAge) {
      spending = spending * (1 + inflation);
    } else if (!isRetired) {
      spending = initSpend;
    }

    const netReturn     = taxable * taxReturn + retirement * retReturn;
    const contributions = isRetired ? 0 : (taxContrib + retContrib);
    const spendAmt      = isRetired ? spending : 0;

    let endTaxable, endRetirement;

    if (!isRetired) {
      endTaxable    = taxable * (1 + taxReturn) + taxContrib;
      endRetirement = retirement * (1 + retReturn) + retContrib;
    } else {
      const taxableWd    = spendAmt * taxWdPct;
      const retirementWd = spendAmt * (1 - taxWdPct) * (1 + retTaxGross);
      endTaxable    = Math.max(0, taxable * (1 + taxReturn) - taxableWd);
      endRetirement = Math.max(0, retirement * (1 + retReturn) - retirementWd);
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
      endTaxable,
      endRetirement,
      totalBalance
    });

    taxable    = endTaxable;
    retirement = endRetirement;

    // Reset spending to initSpend at the start of retirement for first year
    if (isRetired && age === retireAge) spending = initSpend;
  }

  renderSummary();
  renderProjectionTable();
  renderAssumptions();
  renderChart();
}

// ── Summary Cards ──
function renderSummary() {
  const retireRow = projectionData.find(r => r.isRetired);
  const peak      = projectionData.reduce((a,b) => b.totalBalance > a.totalBalance ? b : a, projectionData[0]);
  const endRow    = projectionData[projectionData.length - 1];
  const retYears  = projectionData.filter(r => r.isRetired).length;

  const retireTotal = retireRow
    ? retireRow.taxableStart + retireRow.retirementStart
    : projectionData[0].totalBalance;

  $('val-retire').textContent   = fmtShort(retireTotal);
  $('val-peak').textContent     = fmtShort(peak.totalBalance);
  $('val-peak-age').textContent = `Age ${peak.age}`;
  $('val-end').textContent      = fmtShort(endRow.totalBalance);
  $('val-years').textContent    = retYears > 0 ? retYears + ' yrs' : '—';
}

// ── Projection Table ──
function renderProjectionTable() {
  const tbody    = $('projectionBody');
  const retireAge = getVal('retireAge');
  tbody.innerHTML = '';

  projectionData.forEach(row => {
    const tr = document.createElement('tr');
    if (row.age === retireAge) tr.classList.add('retire-start');

    const pillClass  = row.isRetired ? 'pill-ret' : 'pill-acc';
    const retClass   = row.netReturn >= 0 ? 'v-pos' : 'v-neg';
    const contribStr = row.contributions > 0
      ? `<span class="v-pos">${fmtRaw(row.contributions)}</span>`
      : `<span class="v-dim">—</span>`;
    const spendStr   = row.spending > 0
      ? `<span class="v-neg">(${fmtRaw(row.spending)})</span>`
      : `<span class="v-dim">—</span>`;

    tr.innerHTML = `
      <td class="sticky-col">${row.age}</td>
      <td><span class="pill ${pillClass}">${row.phase}</span></td>
      <td>${fmtRaw(row.taxableStart)}</td>
      <td>${fmtRaw(row.retirementStart)}</td>
      <td class="${retClass}">${fmtRaw(row.netReturn)}</td>
      <td>${contribStr}</td>
      <td>${spendStr}</td>
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
    { label: 'Starting Age',                  value: getVal('startAge') },
    { label: 'Retirement Age',                value: getVal('retireAge') },
    { label: 'End Age',                       value: getVal('endAge') },
    { label: 'Starting Taxable Balance',      value: fmtRaw(getVal('taxableBalance')) },
    { label: 'Starting Retirement Balance',   value: fmtRaw(getVal('retirementBalance')) },
    { section: 'Return Rates' },
    { label: 'Taxable Return Rate',           value: fmtPct(getVal('taxableReturn')) },
    { label: 'Retirement Account Return',     value: fmtPct(getVal('retirementReturn')) },
    { label: 'Inflation Rate',                value: fmtPct(getVal('inflationRate')) },
    { section: 'Contributions' },
    { label: 'Annual Taxable Contribution',   value: fmtRaw(getVal('taxableContrib')) },
    { label: 'Annual Retirement Contribution',value: fmtRaw(getVal('retirementContrib')) },
    { section: 'Retirement Spending' },
    { label: 'Year-1 Spending',               value: fmtRaw(getVal('initialSpending')) },
    { label: 'Taxable Withdrawal Split',      value: fmtPct(getVal('taxableWithdrawPct')) },
    { label: 'Retirement Tax Gross-Up',       value: fmtPct(getVal('retirementTaxPct')) },
    { section: 'Formulas' },
    { label: 'Accumulation',   value: 'End = Start × (1 + return) + contribution' },
    { label: 'Retirement Draw',value: 'Split by taxable % · retirement grossed up for taxes' },
    { label: 'Spending Growth', value: 'Compounds at inflation rate each retirement year' },
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

// ── Chart ──
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
        {
          label: 'Total',
          data: totData,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37,99,235,0.06)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: 'Taxable',
          data: taxData,
          borderColor: '#15803d',
          backgroundColor: 'transparent',
          borderWidth: 1.2,
          borderDash: [4,3],
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 3,
        },
        {
          label: 'Retirement',
          data: retData,
          borderColor: '#b45309',
          backgroundColor: 'transparent',
          borderWidth: 1.2,
          borderDash: [4,3],
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 3,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: '#6b7280',
            font: { family: "'Inter', sans-serif", size: 11 },
            boxWidth: 24, boxHeight: 2, padding: 16,
          }
        },
        tooltip: {
          backgroundColor: '#111827',
          titleColor: '#f9fafb',
          bodyColor: '#d1d5db',
          borderColor: '#374151',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            title: items => `Age ${items[0].label}`,
            label: item => ` ${item.dataset.label}: ${fmtShort(item.raw)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#f3f4f6' },
          border: { display: false },
          ticks: {
            color: '#9ca3af',
            font: { family: "'JetBrains Mono', monospace", size: 10 },
            maxTicksLimit: 14,
          }
        },
        y: {
          grid: { color: '#f3f4f6' },
          border: { display: false },
          ticks: {
            color: '#9ca3af',
            font: { family: "'JetBrains Mono', monospace", size: 10 },
            callback: v => fmtShort(v),
          }
        }
      }
    }
  });
}

// ── Tab switching ──
function switchTab(name) {
  document.querySelectorAll('.sheet-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === name);
  });
  document.querySelectorAll('.tab-pane').forEach(p => {
    p.classList.toggle('active', p.id === 'tab-' + name);
  });
}

// ── Toast ──
let toastTimer;
function showToast(msg, type = '') {
  const el = $('toast');
  el.textContent = msg;
  el.className = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.className = 'toast';
  }, 3000);
}

// ── Wire inputs to model ──
document.querySelectorAll('input[type="number"]').forEach(input => {
  input.addEventListener('input', runModel);
});

// ── Init ──
loadFromURL();
runModel();
