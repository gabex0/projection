// ── model.js — Retirement Projection Engine ──

let projectionData = [];
let chart = null;
let currentMode = 'forward'; // 'forward' | 'reverse'

const $ = id => document.getElementById(id);

// IRS Uniform Lifetime Table (SECURE 2.0)
const RMD_TABLE = {
  73:26.5,74:25.5,75:24.6,76:23.7,77:22.9,78:22.0,79:21.1,
  80:20.2,81:19.4,82:18.5,83:17.7,84:16.8,85:16.0,86:15.2,87:14.4,
  88:13.7,89:12.9,90:12.2,91:11.5,92:10.8,93:10.1,94:9.5,95:8.9,
  96:8.4,97:7.8,98:7.3,99:6.8,100:6.4,101:6.0,102:5.6,103:5.2,
  104:4.9,105:4.6,106:4.3,107:4.1,108:3.9,109:3.7,110:3.5
};

// ── URL param map (all inputs) ──
const PARAM_MAP = {
  planName:'pn', startAge:'sa', retireAge:'ra', endAge:'ea',
  taxableBalance:'tb', retirementBalance:'rb',
  taxableReturn:'tr', retirementReturn:'rr', inflationRate:'ir',
  taxableContrib:'tc', retirementContrib:'rc',
  spendingModel:'sm', initialSpending:'sp', spendPct:'spc',
  guardBase:'gb', guardFloor:'gf', guardCeiling:'gc',
  curveEarly:'ce', curveMid:'cm', curveLate:'cl',
  ssMonthly:'ss', ssStartAge:'ssa', pensionMonthly:'pen', rentalAnnual:'ren',
  retirementTaxPct:'rt', capitalGainsTaxPct:'cg', rmdTaxPct:'rm',
  rothAnnual:'ro',
};

function getVal(id) {
  const el = $(id);
  if (!el) return 0;
  if (el.type === 'checkbox') return el.checked ? 1 : 0;
  return parseFloat(el.value) || 0;
}
function getStr(id) {
  const el = $(id); return el ? (el.value || '') : '';
}

// ── URL share ──
function loadFromURL() {
  const params = new URLSearchParams(window.location.search);
  for (const [id, key] of Object.entries(PARAM_MAP)) {
    if (!params.has(key)) continue;
    const el = $(id);
    if (!el) continue;
    if (el.type === 'checkbox') {
      el.checked = params.get(key) === '1';
    } else {
      el.value = params.get(key);
    }
  }
  // restore spending model visibility
  onSpendingModelChange();
  // restore roth
  const rothEl = $('rothConversion');
  if (rothEl) {
    $('roth-inputs').classList.toggle('hidden', !rothEl.checked);
  }
}

function buildShareURL() {
  const params = new URLSearchParams();
  // Plan name
  params.set('pn', getStr('planName'));
  for (const [id, key] of Object.entries(PARAM_MAP)) {
    if (id === 'planName') continue;
    const el = $(id);
    if (!el) continue;
    if (el.type === 'checkbox') {
      params.set(key, el.checked ? '1' : '0');
    } else {
      params.set(key, el.value || '0');
    }
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

// ── Spending model UI ──
function onSpendingModelChange() {
  const model = getStr('spendingModel');
  $('spending-fixed-inputs').classList.toggle('hidden', model !== 'fixed');
  $('spending-pct-inputs').classList.toggle('hidden', model !== 'pct');
  $('spending-guardrails-inputs').classList.toggle('hidden', model !== 'guardrails');
  $('spending-curve-inputs').classList.toggle('hidden', model !== 'curve');
  runModel();
}

// ── Mode ──
function setMode(mode) {
  currentMode = mode;
  $('btn-forward').classList.toggle('active', mode === 'forward');
  $('btn-reverse').classList.toggle('active', mode === 'reverse');
  $('reverse-output').classList.toggle('hidden', mode !== 'reverse');
  runModel();
}

// ── Roth toggle ──
const rothEl = document.getElementById('rothConversion');
if (rothEl) rothEl.addEventListener('change', () => {
  $('roth-inputs').classList.toggle('hidden', !rothEl.checked);
  runModel();
});

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

// ── Compute annual income (SS + Pension + Rental) for a given age ──
function annualIncome(age) {
  const ssMonthly    = getVal('ssMonthly');
  const ssStartAge   = getVal('ssStartAge');
  const pension      = getVal('pensionMonthly');
  const retireAge    = getVal('retireAge');
  const rental       = getVal('rentalAnnual');
  let income = 0;
  if (age >= retireAge) {
    if (age >= ssStartAge && ssMonthly > 0) income += ssMonthly * 12;
    if (pension > 0) income += pension * 12;
    income += rental;
  }
  return income;
}

// ── Compute spending for a given age given model ──
function computeSpending(age, isRetired, totalBal, prevSpending, retireAge) {
  if (!isRetired) return 0;
  const model     = getStr('spendingModel');
  const inflation = getVal('inflationRate') / 100;
  const initSpend = getVal('initialSpending');

  if (model === 'pct') {
    return totalBal * (getVal('spendPct') / 100);
  }
  if (model === 'guardrails') {
    const base     = getVal('guardBase');
    const floor    = getVal('guardFloor');
    const ceiling  = getVal('guardCeiling');
    const target   = prevSpending > 0 ? prevSpending * (1 + inflation) : base;
    // If portfolio is large enough for ceiling, step up; if small, step down
    const pctOfPeak = totalBal > 0 ? Math.min(1.5, totalBal / (base / 0.04)) : 1;
    if (pctOfPeak > 1.1) return Math.min(ceiling, target * 1.05);
    if (pctOfPeak < 0.8) return Math.max(floor, target * 0.90);
    return Math.min(ceiling, Math.max(floor, target));
  }
  if (model === 'curve') {
    const yrsRetired = age - retireAge;
    if (yrsRetired < 10)  return getVal('curveEarly') * Math.pow(1 + inflation, yrsRetired);
    if (yrsRetired < 20)  return getVal('curveMid') * Math.pow(1 + inflation, yrsRetired - 10);
    return getVal('curveLate') * Math.pow(1 + inflation, yrsRetired - 20);
  }
  // Default: fixed + inflation
  if (age === retireAge) return initSpend;
  return prevSpending > 0 ? prevSpending * (1 + inflation) : initSpend;
}

// ── Core projection engine ──
function projectScenario(overrides = {}) {
  const startAge    = overrides.startAge    ?? getVal('startAge');
  const endAge      = overrides.endAge      ?? getVal('endAge');
  const retireAge   = overrides.retireAge   ?? getVal('retireAge');
  const taxStart    = overrides.taxStart    ?? getVal('taxableBalance');
  const retStart    = overrides.retStart    ?? getVal('retirementBalance');
  const taxRate     = overrides.taxRate     ?? (getVal('taxableReturn') / 100);
  const retRate     = overrides.retRate     ?? (getVal('retirementReturn') / 100);
  const inflation   = overrides.inflation   ?? (getVal('inflationRate') / 100);
  const taxContrib  = overrides.taxContrib  ?? getVal('taxableContrib');
  const retContrib  = overrides.retContrib  ?? getVal('retirementContrib');
  const retTaxRate  = overrides.retTaxRate  ?? (getVal('retirementTaxPct') / 100);
  const cgTaxRate   = overrides.cgTaxRate   ?? (getVal('capitalGainsTaxPct') / 100);
  const rmdTaxRate  = overrides.rmdTaxRate  ?? (getVal('rmdTaxPct') / 100);
  const doRoth      = overrides.doRoth      ?? (getVal('rothConversion') === 1);
  const rothAnnual  = overrides.rothAnnual  ?? getVal('rothAnnual');

  const data = [];
  let taxable    = taxStart;
  let retirement = retStart;
  let spending   = 0;
  let prevSpend  = 0;

  for (let age = startAge; age <= endAge; age++) {
    const isRetired = age >= retireAge;
    const income    = annualIncome(age);
    const totalBal  = taxable + retirement;

    // Spending this year
    if (isRetired) {
      spending = computeSpending(age, isRetired, totalBal, prevSpend, retireAge);
      prevSpend = spending;
    } else {
      spending = 0;
      prevSpend = 0;
    }

    // Net spending after guaranteed income
    const netSpend = Math.max(0, spending - income);

    const netReturn     = taxable * taxRate + retirement * retRate;
    const contributions = isRetired ? 0 : (taxContrib + retContrib);

    // Roth conversion (pre-73, retirement years only, if enabled)
    let rothConverted = 0, rothTax = 0;
    if (doRoth && isRetired && age < 73 && retirement > 0) {
      rothConverted = Math.min(rothAnnual, retirement);
      rothTax       = rothConverted * retTaxRate;
    }

    // RMD
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
      // Roth: move from retirement to taxable (after-tax)
      const retAfterRoth = Math.max(0, retirement - rothConverted);

      // RMD: taken from post-roth retirement balance
      const retAfterRmd  = Math.max(0, retAfterRoth - rmdGross);
      const grownRet     = retAfterRmd * (1 + retRate);

      // Taxable: grow, add after-tax roth + after-tax RMD
      const grownTax = taxable * (1 + taxRate) + (rothConverted - rothTax) + rmdAfterTax;

      // Spend from taxable first, then retirement (grossed up)
      const taxableWd = Math.min(grownTax, netSpend);
      const remaining = Math.max(0, netSpend - taxableWd);

      if (remaining > 0 && retTaxRate < 1) {
        retWdGross = Math.min(grownRet, remaining / (1 - retTaxRate));
        retWdTax   = retWdGross * retTaxRate;
      }

      endTaxable    = Math.max(0, grownTax - taxableWd);
      endRetirement = Math.max(0, grownRet - retWdGross);
    }

    const totalBalance = endTaxable + endRetirement;

    data.push({
      age, isRetired,
      phase:           isRetired ? 'Retirement' : 'Accumulation',
      taxableStart:    taxable,
      retirementStart: retirement,
      netReturn,
      contributions,
      income,
      spending,
      netSpend,
      rothConverted,
      rothTax,
      rmdGross,
      rmdTax,
      rmdAfterTax,
      retWdGross,
      retWdTax,
      endTaxable,
      endRetirement,
      totalBalance
    });

    taxable    = endTaxable;
    retirement = endRetirement;
  }
  return data;
}

// ── Reverse planning: find required savings to achieve target income ──
function solveReversePlanning() {
  const targetIncome = getVal('initialSpending');
  const retireAge    = getVal('retireAge');
  const endAge       = getVal('endAge');
  const taxStart     = getVal('taxableBalance');
  const retStart     = getVal('retirementBalance');
  const taxRate      = getVal('taxableReturn') / 100;
  const retRate      = getVal('retirementReturn') / 100;
  const retTaxRate   = getVal('retirementTaxPct') / 100;
  const startAge     = getVal('startAge');
  const yearsToRetire = retireAge - startAge;

  if (yearsToRetire <= 0) return 0;

  // Binary search for the annual savings (taxable + retirement) needed
  // such that the portfolio can sustain targetIncome for the full retirement
  let lo = 0, hi = 5000000, required = 0;
  for (let iter = 0; iter < 50; iter++) {
    const mid = (lo + hi) / 2;
    // Project with mid as total annual contrib, split 80/20 taxable/retirement
    const splitTax = mid * 0.8;
    const splitRet = mid * 0.2;
    const data = projectScenario({ taxContrib: splitTax, retContrib: splitRet });
    const retRow = data.find(r => r.isRetired);
    if (!retRow) break;
    const retTotal = retRow.taxableStart + retRow.retirementStart;
    // Does it sustain? Check final balance
    const finalRow = data[data.length - 1];
    if (finalRow.totalBalance > 0) {
      required = mid;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return required;
}

// ── Risk scoring ──
function computeRiskScore(data) {
  if (!data.length) return { label: '—', level: 'unknown' };
  const retRow      = data.find(r => r.isRetired);
  const endRow      = data[data.length - 1];
  const taxReturn   = getVal('taxableReturn');
  const inflation   = getVal('inflationRate');
  const realReturn  = taxReturn - inflation;
  const endAge      = getVal('endAge');
  const retireAge   = getVal('retireAge');

  let score = 0; // 0=low, higher=risky

  // 1. Withdrawal rate
  if (retRow) {
    const retTotal   = retRow.taxableStart + retRow.retirementStart;
    const withdrawRate = retTotal > 0 ? (retRow.spending / retTotal) * 100 : 0;
    if (withdrawRate > 6)      score += 3;
    else if (withdrawRate > 4) score += 2;
    else if (withdrawRate > 3) score += 1;
  }

  // 2. Longevity — does portfolio survive to end age?
  if (endRow.totalBalance <= 0)       score += 4;
  else if (endRow.totalBalance < 500000) score += 2;

  // 3. Real return assumption
  if (realReturn > 8)       score += 2;
  else if (realReturn > 6)  score += 1;

  // 4. Retirement length
  const retYears = endAge - retireAge;
  if (retYears > 35) score += 1;

  if (score >= 6) return { label: 'Very High', level: 'very-high' };
  if (score >= 4) return { label: 'High',      level: 'high' };
  if (score >= 2) return { label: 'Moderate',  level: 'moderate' };
  return            { label: 'Low',       level: 'low' };
}

// ── Auto-narrative ──
function generateNarrative(data) {
  if (!data.length) return 'Enter your values to see a personalized summary.';
  const retRow     = data.find(r => r.isRetired);
  const peak       = data.reduce((a,b) => b.totalBalance > a.totalBalance ? b : a, data[0]);
  const endRow     = data[data.length - 1];
  const retYears   = data.filter(r => r.isRetired).length;
  const totalRMD   = data.reduce((s,r) => s + r.rmdGross, 0);
  const retireAge  = getVal('retireAge');
  const retTotal   = retRow ? retRow.taxableStart + retRow.retirementStart : 0;
  const drawRate   = retTotal > 0 && retRow ? ((retRow.spending / retTotal) * 100).toFixed(1) : '?';
  const risk       = computeRiskScore(data);
  const planName   = getStr('planName') || 'This plan';
  const income     = retRow ? retRow.income : 0;
  const incomeStr  = income > 0 ? ` Guaranteed income of ${fmtShort(income)}/yr covers a portion of expenses.` : '';

  let narrative = `${planName} reaches ${fmtShort(retTotal)} by retirement at age ${retireAge}, with an initial draw rate of ${drawRate}%. `;

  if (peak.totalBalance > retTotal) {
    narrative += `Wealth continues growing to a peak of ${fmtShort(peak.totalBalance)} at age ${peak.age}. `;
  }

  if (endRow.totalBalance > 100000) {
    narrative += `The portfolio remains healthy at ${fmtShort(endRow.totalBalance)} at end of projection.${incomeStr} `;
  } else if (endRow.totalBalance <= 0) {
    narrative += `⚠️ The portfolio is projected to be depleted before the end of the projection period. Consider reducing spending or increasing savings.${incomeStr} `;
  }

  if (totalRMD > 0) {
    narrative += `Required Minimum Distributions beginning at age 73 total ${fmtShort(totalRMD)} over ${retYears} retirement years. `;
  }

  narrative += `Overall risk assessment: ${risk.label}.`;
  return narrative;
}

// ── Main run ──
function runModel() {
  // Project base scenario
  projectionData = projectScenario();

  // Reverse mode
  if (currentMode === 'reverse') {
    const req = solveReversePlanning();
    const el = $('reverse-savings');
    if (el) el.textContent = req > 0 ? fmtShort(req) + '/yr' : 'N/A';
  }

  renderSummary();
  renderProjectionTable();
  renderAssumptions();
  renderChart();
  if (typeof renderSlideshow === 'function') renderSlideshow();
  if (typeof runScenarios === 'function') runScenarios();
}

// ── Summary ──
function renderSummary() {
  if (!projectionData.length) return;
  const retRow   = projectionData.find(r => r.isRetired);
  const peak     = projectionData.reduce((a,b) => b.totalBalance > a.totalBalance ? b : a, projectionData[0]);
  const endRow   = projectionData[projectionData.length - 1];
  const totalRMD = projectionData.reduce((s,r) => s + r.rmdGross, 0);

  const retTotal = retRow ? retRow.taxableStart + retRow.retirementStart : projectionData[0].totalBalance;
  const totalIncome = projectionData.filter(r => r.isRetired).reduce((s,r) => s + r.income, 0);
  const totalSpend  = projectionData.filter(r => r.isRetired).reduce((s,r) => s + r.spending, 0);
  const incPct = totalSpend > 0 ? Math.min(100, (totalIncome / totalSpend * 100)).toFixed(0) + '%' : '0%';

  $('val-retire').textContent   = fmtShort(retTotal);
  $('val-peak').textContent     = fmtShort(peak.totalBalance);
  $('val-peak-age').textContent = `Age ${peak.age}`;
  $('val-end').textContent      = fmtShort(endRow.totalBalance);
  $('val-rmds').textContent     = fmtShort(totalRMD);
  $('val-income-pct').textContent = incPct;

  // Risk score
  const risk = computeRiskScore(projectionData);
  const riskEl = $('val-risk');
  riskEl.textContent = risk.label;
  riskEl.className = `risk-badge risk-${risk.level}`;

  // Narrative
  $('narrative-text').textContent = generateNarrative(projectionData);
}

// ── Projection Table ──
function renderProjectionTable() {
  const tbody     = $('projectionBody');
  const retireAge = getVal('retireAge');
  tbody.innerHTML = '';

  projectionData.forEach(row => {
    const tr = document.createElement('tr');
    if (row.age === retireAge) tr.classList.add('retire-start');

    const pillCls = row.isRetired ? 'pill-ret' : 'pill-acc';
    const retCls  = row.netReturn >= 0 ? 'v-pos' : 'v-neg';
    const contrib = row.contributions > 0 ? `<span class="v-pos">${fmtRaw(row.contributions)}</span>` : `<span class="v-dim">—</span>`;
    const income  = row.income > 0 ? `<span class="v-pos">${fmtRaw(row.income)}</span>` : `<span class="v-dim">—</span>`;
    const spend   = row.spending > 0 ? `<span class="v-neg">(${fmtRaw(row.spending)})</span>` : `<span class="v-dim">—</span>`;
    const rmd     = row.rmdGross > 0 ? `<span class="v-purple">${fmtRaw(row.rmdGross)}</span>` : `<span class="v-dim">—</span>`;
    const rmdTx   = row.rmdTax > 0 ? `<span class="v-neg">(${fmtRaw(row.rmdTax)})</span>` : `<span class="v-dim">—</span>`;
    const retWdTx = row.retWdTax > 0 ? `<span class="v-neg">(${fmtRaw(row.retWdTax)})</span>` : `<span class="v-dim">—</span>`;

    tr.innerHTML = `
      <td class="sticky-col">${row.age}</td>
      <td><span class="pill ${pillCls}">${row.phase}</span></td>
      <td>${fmtRaw(row.taxableStart)}</td>
      <td>${fmtRaw(row.retirementStart)}</td>
      <td class="${retCls}">${fmtRaw(row.netReturn)}</td>
      <td>${contrib}</td>
      <td>${income}</td>
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

// ── Assumptions table ──
function renderAssumptions() {
  const tbody = $('assumptionsBody');
  tbody.innerHTML = '';
  const model = getStr('spendingModel');
  const modelLabel = { fixed:'Fixed + Inflation', pct:'% of Portfolio', guardrails:'Guardrails', curve:'Custom Curve' }[model] || model;

  const rows = [
    { section: 'Time' },
    { label: 'Starting Age',   value: getVal('startAge') },
    { label: 'Retirement Age', value: getVal('retireAge') },
    { label: 'End Age',        value: getVal('endAge') },
    { section: 'Assets' },
    { label: 'Starting Taxable Balance',     value: fmtRaw(getVal('taxableBalance')) },
    { label: 'Starting Retirement Balance',  value: fmtRaw(getVal('retirementBalance')) },
    { section: 'Growth' },
    { label: 'Taxable Return Rate',   value: fmtPct(getVal('taxableReturn')) },
    { label: 'Retirement Return Rate',value: fmtPct(getVal('retirementReturn')) },
    { label: 'Inflation Rate',        value: fmtPct(getVal('inflationRate')) },
    { section: 'Cash Flow' },
    { label: 'Annual Taxable Contribution',    value: fmtRaw(getVal('taxableContrib')) },
    { label: 'Annual Retirement Contribution', value: fmtRaw(getVal('retirementContrib')) },
    { label: 'Spending Model', value: modelLabel },
    { label: 'Year-1 Spending', value: fmtRaw(getVal('initialSpending')) },
    { section: 'Income Streams' },
    { label: 'Social Security (monthly)', value: fmtRaw(getVal('ssMonthly')) },
    { label: 'SS Start Age', value: getVal('ssStartAge') },
    { label: 'Pension (monthly)', value: fmtRaw(getVal('pensionMonthly')) },
    { label: 'Rental Income (annual)', value: fmtRaw(getVal('rentalAnnual')) },
    { section: 'Taxes' },
    { label: 'Ordinary Income Tax Rate',  value: fmtPct(getVal('retirementTaxPct')) },
    { label: 'Capital Gains Tax Rate',    value: fmtPct(getVal('capitalGainsTaxPct')) },
    { label: 'RMD Tax Rate',              value: fmtPct(getVal('rmdTaxPct')) },
    { label: 'Roth Conversions',          value: getVal('rothConversion') ? 'Enabled' : 'Off' },
    { section: 'Model Notes' },
    { label: 'RMD',             value: 'SECURE 2.0: starts age 73, IRS table' },
    { label: 'Withdrawal order', value: 'Taxable-first; retirement grossed up for tax' },
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

  // scenario datasets
  const extraDatasets = [];
  if (window.scenarioResults) {
    const colors = { conservative: '#ef4444', aggressive: '#10b981', custom: '#8b5cf6' };
    for (const [key, data] of Object.entries(window.scenarioResults)) {
      if (key === 'base' || !data) continue;
      extraDatasets.push({
        label: key.charAt(0).toUpperCase() + key.slice(1),
        data: data.map(r => Math.round(r.totalBalance)),
        borderColor: colors[key] || '#888',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [3,3],
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 3,
      });
    }
  }

  chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Total', data: totData, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.06)', borderWidth: 2, fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4 },
        { label: 'Taxable', data: taxData, borderColor: '#15803d', backgroundColor: 'transparent', borderWidth: 1.2, borderDash: [4,3], tension: 0.3, pointRadius: 0, pointHoverRadius: 3 },
        { label: 'Retirement', data: retData, borderColor: '#b45309', backgroundColor: 'transparent', borderWidth: 1.2, borderDash: [4,3], tension: 0.3, pointRadius: 0, pointHoverRadius: 3 },
        ...extraDatasets,
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

// ── Wire all inputs ──
document.querySelectorAll('input[type="number"], input[type="text"], select').forEach(el => {
  el.addEventListener('input', runModel);
  el.addEventListener('change', runModel);
});

// ── Init ──
loadFromURL();
runModel();
