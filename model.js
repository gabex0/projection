// ── Retirement Projection Model — model.js ──

let projectionData = [];
let chart = null;

// ── Value helpers ──
const $ = id => document.getElementById(id);

function getVal(id) {
  const sel = $(id);
  if (!sel) return 0;
  if (sel.tagName === 'SELECT') {
    if (sel.value === 'custom') {
      return parseFloat($(id + '_custom').value) || 0;
    }
    return parseFloat(sel.value) || 0;
  }
  return parseFloat(sel.value) || 0;
}

// Wire up "Custom…" dropdowns
document.querySelectorAll('select').forEach(sel => {
  sel.addEventListener('change', () => {
    const customInput = $(sel.id + '_custom');
    if (customInput) {
      if (sel.value === 'custom') {
        customInput.classList.remove('hidden');
        customInput.focus();
      } else {
        customInput.classList.add('hidden');
      }
    }
    runModel();
  });
});

// ── Formatting ──
function fmt(n) {
  if (n === 0) return '—';
  return '$' + Math.round(n).toLocaleString('en-US');
}
function fmtShort(n) {
  const abs = Math.abs(n);
  if (abs >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + Math.round(n).toLocaleString();
}
function fmtPct(n) { return n.toFixed(1) + '%'; }

// ── Core Model ──
function runModel() {
  const startAge       = getVal('startAge');
  const endAge         = getVal('endAge');
  const retireAge      = getVal('retireAge');
  const taxableStart   = getVal('taxableBalance');
  const retireStart    = getVal('retirementBalance');
  const taxReturn      = getVal('taxableReturn') / 100;
  const retReturn      = getVal('retirementReturn') / 100;
  const inflation      = getVal('inflationRate') / 100;
  const taxContrib     = getVal('taxableContrib');
  const retContrib     = getVal('retirementContrib');
  const initSpending   = getVal('initialSpending');
  const taxWdPct       = getVal('taxableWithdrawPct') / 100;
  const retTaxGross    = getVal('retirementTaxPct') / 100;

  projectionData = [];

  let taxable    = taxableStart;
  let retirement = retireStart;
  let spending   = initSpending;
  let firstRetireYear = true;

  for (let age = startAge; age <= endAge; age++) {
    const isRetired = age >= retireAge;

    // Spending escalates by inflation each year after first retirement year
    if (isRetired && age > retireAge) {
      spending = spending * (1 + inflation);
    } else if (!isRetired) {
      spending = initSpending; // reset to initial while accumulating (not used)
    }

    const netReturn      = taxable * taxReturn + retirement * retReturn;
    const contributions  = isRetired ? 0 : (taxContrib + retContrib);
    const spendingThisYr = isRetired ? spending : 0;

    let endingTaxable, endingRetirement;

    if (!isRetired) {
      endingTaxable    = taxable * (1 + taxReturn) + taxContrib;
      endingRetirement = retirement * (1 + retReturn) + retContrib;
    } else {
      const taxableWd    = spendingThisYr * taxWdPct;
      const retirementWd = spendingThisYr * (1 - taxWdPct) * (1 + retTaxGross);
      endingTaxable    = Math.max(0, taxable * (1 + taxReturn) - taxableWd);
      endingRetirement = Math.max(0, retirement * (1 + retReturn) - retirementWd);
    }

    const totalBalance = endingTaxable + endingRetirement;

    projectionData.push({
      age,
      isRetired,
      phase: isRetired ? 'Retirement' : 'Accumulation',
      taxableStart:    taxable,
      retirementStart: retirement,
      netReturn,
      contributions,
      spending: spendingThisYr,
      endingTaxable,
      endingRetirement,
      totalBalance
    });

    taxable    = endingTaxable;
    retirement = endingRetirement;

    if (isRetired && firstRetireYear) {
      spending = initSpending;
      firstRetireYear = false;
    }
  }

  renderSummary();
  renderTable();
  renderAssumptions();
  renderChart();
}

// ── Summary Cards ──
function renderSummary() {
  const retireRow = projectionData.find(r => r.isRetired);
  const peakRow   = projectionData.reduce((a,b) => b.totalBalance > a.totalBalance ? b : a, projectionData[0]);
  const endRow    = projectionData[projectionData.length - 1];
  const retYears  = projectionData.filter(r => r.isRetired).length;

  const retireTotal = retireRow
    ? retireRow.taxableStart + retireRow.retirementStart
    : projectionData[0].taxableStart + projectionData[0].retirementStart;

  $('val-retire').textContent   = fmtShort(retireTotal);
  $('val-peak').textContent     = fmtShort(peakRow.totalBalance);
  $('val-peak-age').textContent = `Age ${peakRow.age}`;
  $('val-end').textContent      = fmtShort(endRow.totalBalance);
  $('val-years').textContent    = retYears > 0 ? retYears + ' yrs' : '—';
}

// ── Spreadsheet Table ──
function renderTable() {
  const tbody = $('projectionBody');
  tbody.innerHTML = '';

  const retireAge = getVal('retireAge');

  projectionData.forEach(row => {
    const tr = document.createElement('tr');
    if (row.age === retireAge) tr.classList.add('retire-row');

    const pillClass  = row.isRetired ? 'pill-ret' : 'pill-acc';
    const retClass   = row.netReturn >= 0 ? 'c-green' : 'c-red';
    const contribStr = row.contributions > 0 ? `<span class="c-green">${fmt(row.contributions)}</span>` : `<span class="c-gray">—</span>`;
    const spendStr   = row.spending > 0 ? `<span class="c-red">(${fmt(row.spending)})</span>` : `<span class="c-gray">—</span>`;

    tr.innerHTML = `
      <td>${row.age}</td>
      <td><span class="pill ${pillClass}">${row.phase}</span></td>
      <td>${fmt(row.taxableStart)}</td>
      <td>${fmt(row.retirementStart)}</td>
      <td class="${retClass}">${fmt(row.netReturn)}</td>
      <td>${contribStr}</td>
      <td>${spendStr}</td>
      <td>${fmt(row.endingTaxable)}</td>
      <td>${fmt(row.endingRetirement)}</td>
      <td class="c-bold">${fmt(row.totalBalance)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ── Assumptions Tab ──
function renderAssumptions() {
  const tbody = $('assumptionsBody');
  tbody.innerHTML = '';

  const rows = [
    { section: 'Starting Position' },
    { label: 'Starting Age',              val: getVal('startAge') },
    { label: 'Retirement Age',            val: getVal('retireAge') },
    { label: 'End Age (Projection)',       val: getVal('endAge') },
    { label: 'Taxable Balance',           val: fmt(getVal('taxableBalance')) },
    { label: 'Retirement Balance',        val: fmt(getVal('retirementBalance')) },
    { section: 'Return Rates' },
    { label: 'Taxable Return Rate',       val: fmtPct(getVal('taxableReturn')) },
    { label: 'Retirement Return Rate',    val: fmtPct(getVal('retirementReturn')) },
    { label: 'Inflation Rate',            val: fmtPct(getVal('inflationRate')) },
    { section: 'Contributions' },
    { label: 'Annual Taxable Contrib.',   val: fmt(getVal('taxableContrib')) },
    { label: 'Annual Retirement Contrib.',val: fmt(getVal('retirementContrib')) },
    { section: 'Retirement Spending' },
    { label: 'Year-1 Spending',           val: fmt(getVal('initialSpending')) },
    { label: 'Taxable Withdrawal Split',  val: fmtPct(getVal('taxableWithdrawPct')) },
    { label: 'Retirement Tax Gross-Up',   val: fmtPct(getVal('retirementTaxPct')) },
    { section: 'Model Notes' },
    { label: 'Accumulation Formula',      val: 'End = Start × (1 + return) + contribution' },
    { label: 'Retirement Withdrawal',     val: 'Split by taxable % + retirement tax gross-up' },
    { label: 'Spending Growth',           val: 'Inflation-adjusted annually' },
  ];

  rows.forEach(r => {
    const tr = document.createElement('tr');
    if (r.section) {
      tr.classList.add('section-row');
      tr.innerHTML = `<td colspan="2">${r.section}</td>`;
    } else {
      tr.innerHTML = `<td>${r.label}</td><td>${r.val}</td>`;
    }
    tbody.appendChild(tr);
  });
}

// ── Chart ──
function renderChart() {
  const labels  = projectionData.map(r => r.age);
  const taxData = projectionData.map(r => Math.round(r.endingTaxable));
  const retData = projectionData.map(r => Math.round(r.endingRetirement));
  const totData = projectionData.map(r => Math.round(r.totalBalance));
  const retireAge = getVal('retireAge');
  const retireIdx = labels.indexOf(retireAge);

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
          backgroundColor: 'rgba(37,99,235,0.07)',
          borderWidth: 2,
          fill: true,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: 'Taxable',
          data: taxData,
          borderColor: '#16a34a',
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
          borderColor: '#d97706',
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
            font: { family: "'Geist', sans-serif", size: 11 },
            boxWidth: 20,
            boxHeight: 2,
            padding: 16,
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
          grid: { color: '#f3f4f6', drawBorder: false },
          ticks: {
            color: '#9ca3af',
            font: { family: "'Geist Mono', monospace", size: 10 },
            maxTicksLimit: 14,
          }
        },
        y: {
          grid: { color: '#f3f4f6', drawBorder: false },
          ticks: {
            color: '#9ca3af',
            font: { family: "'Geist Mono', monospace", size: 10 },
            callback: v => fmtShort(v)
          }
        }
      }
    }
  });
}

// ── Tab switching ──
let activeTab = 'projection';
function toggleAssumptionsTab() {
  const projTab   = document.querySelector('.sheet-tab');
  const assumpTab = $('tab-assumptions');
  const projSheet = $('sheet-projection');
  const assSheet  = $('sheet-assumptions');

  if (activeTab === 'projection') {
    activeTab = 'assumptions';
    projTab.classList.remove('active');
    assumpTab.classList.add('active');
    projSheet.classList.add('hidden');
    assSheet.classList.remove('hidden');
  } else {
    activeTab = 'projection';
    assumpTab.classList.remove('active');
    projTab.classList.add('active');
    assSheet.classList.add('hidden');
    projSheet.classList.remove('hidden');
  }
}
// Wire up first tab click
document.querySelector('.sheet-tab').addEventListener('click', () => {
  if (activeTab !== 'projection') toggleAssumptionsTab();
});

// ── Boot ──
runModel();
