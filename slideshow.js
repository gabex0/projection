// ── slideshow.js — Presentation Engine ──
// 7 slides: Cover, Wealth Overview, Accumulation Deep Dive,
// Retirement Phase, RMD Impact, Tax Analysis, Legacy Summary

let currentSlide = 0;
const TOTAL_SLIDES = 7;
const slideCharts = {}; // keyed by slide+chartId to destroy/recreate

// Dark palette for slides
const SL = {
  blue:   '#3b82f6',  blueLight: 'rgba(59,130,246,0.15)',
  green:  '#4ade80',  greenLight: 'rgba(74,222,128,0.12)',
  amber:  '#fbbf24',  amberLight: 'rgba(251,191,36,0.12)',
  red:    '#f87171',  redLight: 'rgba(248,113,113,0.12)',
  purple: '#c084fc',  purpleLight: 'rgba(192,132,252,0.12)',
  slate:  '#94a3b8',
  grid:   'rgba(255,255,255,0.06)',
  text:   '#f1f5f9',
  muted:  '#64748b',
};

function slideFont(size = 10, mono = false) {
  return { family: mono ? "'JetBrains Mono', monospace" : "'Inter', sans-serif", size };
}
function slideTick(mono = true) {
  return { color: SL.muted, font: slideFont(10, mono) };
}
function slideTooltip(extra = {}) {
  return {
    backgroundColor: '#1e293b',
    titleColor: '#f1f5f9',
    bodyColor: '#94a3b8',
    borderColor: '#334155',
    borderWidth: 1,
    padding: 10,
    ...extra
  };
}

// ── Destroy a chart if it exists ──
function destroyChart(key) {
  if (slideCharts[key]) {
    slideCharts[key].destroy();
    delete slideCharts[key];
  }
}

// ── Helpers ──
function fmtS(n) { return fmtShort(n); }
function fmtP(n) { return fmtPct(n); }

function summaryStats() {
  if (!projectionData.length) return {};
  const retRow   = projectionData.find(r => r.isRetired) || projectionData[0];
  const peak     = projectionData.reduce((a,b) => b.totalBalance > a.totalBalance ? b : a, projectionData[0]);
  const endRow   = projectionData[projectionData.length - 1];
  const accRows  = projectionData.filter(r => !r.isRetired);
  const retRows  = projectionData.filter(r => r.isRetired);
  const rmdRows  = projectionData.filter(r => r.rmdGross > 0);

  return {
    retireTotal:  retRow.taxableStart + retRow.retirementStart,
    peakTotal:    peak.totalBalance,
    peakAge:      peak.age,
    endTotal:     endRow.totalBalance,
    accYears:     accRows.length,
    retYears:     retRows.length,
    totalContrib: projectionData.reduce((s,r) => s + r.contributions, 0),
    totalSpend:   projectionData.reduce((s,r) => s + r.spending, 0),
    totalRMD:     projectionData.reduce((s,r) => s + r.rmdGross, 0),
    totalRMDTax:  projectionData.reduce((s,r) => s + r.rmdTax, 0),
    totalRetTax:  projectionData.reduce((s,r) => s + r.retWdTax, 0),
    totalReturn:  projectionData.reduce((s,r) => s + r.netReturn, 0),
    rmdStartAge:  rmdRows.length ? rmdRows[0].age : null,
    retireAge:    getVal('retireAge'),
    startAge:     getVal('startAge'),
    endAge:       getVal('endAge'),
  };
}

// ════════════════════════════════════════════════════════
// SLIDE BUILDERS
// ════════════════════════════════════════════════════════

function buildSlide0() { // COVER
  const s = summaryStats();
  const retAge = getVal('retireAge');
  const accYrs = retAge - getVal('startAge');

  return `
    <div class="slide-cover" style="padding:2rem 2.5rem;">
      <div class="slide-eyebrow" style="margin-bottom:.4rem;">Retirement Projection</div>
      <div class="cover-title">Financial<br>Outlook Report</div>
      <div class="cover-sub">Ages ${getVal('startAge')} – ${getVal('endAge')} &nbsp;·&nbsp; ${accYrs}-year accumulation &nbsp;·&nbsp; ${s.retYears}-year retirement</div>
      <div class="cover-kpis">
        <div class="cover-kpi">
          <div class="cover-kpi-label">At Retirement</div>
          <div class="cover-kpi-val">${fmtS(s.retireTotal)}</div>
          <div class="cover-kpi-sub">Age ${retAge}</div>
        </div>
        <div class="cover-kpi">
          <div class="cover-kpi-label">Peak Wealth</div>
          <div class="cover-kpi-val">${fmtS(s.peakTotal)}</div>
          <div class="cover-kpi-sub">Age ${s.peakAge}</div>
        </div>
        <div class="cover-kpi">
          <div class="cover-kpi-label">End Balance</div>
          <div class="cover-kpi-val">${fmtS(s.endTotal)}</div>
          <div class="cover-kpi-sub">Age ${getVal('endAge')}</div>
        </div>
        <div class="cover-kpi">
          <div class="cover-kpi-label">Total Lifetime RMDs</div>
          <div class="cover-kpi-val">${fmtS(s.totalRMD)}</div>
          <div class="cover-kpi-sub">SECURE 2.0, starts 73</div>
        </div>
      </div>
      <div style="margin-top:2rem;font-size:.7rem;color:#334155;max-width:480px;">For illustrative purposes only · Not financial advice</div>
    </div>
  `;
}

function buildSlide1() { // WEALTH OVERVIEW
  const s = summaryStats();
  return `
    <div class="slide-header">
      <div class="slide-eyebrow">Overview</div>
      <div class="slide-title">Total Wealth Trajectory</div>
      <div class="slide-subtitle">Full projection from age ${s.startAge} to ${s.endAge}</div>
    </div>
    <div class="kpi-grid">
      <div class="kpi-box"><div class="kpi-label">Starting Wealth</div><div class="kpi-val blue">${fmtS(getVal('taxableBalance') + getVal('retirementBalance'))}</div><div class="kpi-sub">Age ${s.startAge}</div></div>
      <div class="kpi-box"><div class="kpi-label">At Retirement</div><div class="kpi-val green">${fmtS(s.retireTotal)}</div><div class="kpi-sub">Age ${s.retireAge}</div></div>
      <div class="kpi-box"><div class="kpi-label">Peak Wealth</div><div class="kpi-val amber">${fmtS(s.peakTotal)}</div><div class="kpi-sub">Age ${s.peakAge}</div></div>
      <div class="kpi-box"><div class="kpi-label">End Balance</div><div class="kpi-val blue">${fmtS(s.endTotal)}</div><div class="kpi-sub">Age ${s.endAge}</div></div>
    </div>
    <div class="slide-card" style="flex:1;min-height:0;">
      <div class="slide-card-title">Total Balance by Age</div>
      <canvas id="sc-wealth" style="max-height:none;flex:1;"></canvas>
    </div>
  `;
}
function drawSlide1() {
  destroyChart('wealth');
  const ctx = document.getElementById('sc-wealth');
  if (!ctx) return;
  const labels  = projectionData.map(r => r.age);
  const total   = projectionData.map(r => r.totalBalance);
  const taxable = projectionData.map(r => r.endTaxable);
  const ret     = projectionData.map(r => r.endRetirement);
  const retireIdx = labels.indexOf(getVal('retireAge'));

  slideCharts['wealth'] = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [
      { label: 'Total', data: total, borderColor: SL.blue, backgroundColor: SL.blueLight, borderWidth: 2.5, fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 5 },
      { label: 'Taxable', data: taxable, borderColor: SL.green, backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [5,3], tension: 0.3, pointRadius: 0, pointHoverRadius: 3 },
      { label: 'Retirement', data: ret, borderColor: SL.amber, backgroundColor: 'transparent', borderWidth: 1.5, borderDash: [5,3], tension: 0.3, pointRadius: 0, pointHoverRadius: 3 },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: SL.muted, font: slideFont(11), boxWidth: 20, boxHeight: 2, padding: 16 } },
        tooltip: { ...slideTooltip(), callbacks: { title: i => `Age ${i[0].label}`, label: i => ` ${i.dataset.label}: ${fmtS(i.raw)}` } },
        annotation: retireIdx >= 0 ? { annotations: { line1: { type:'line', xMin: retireIdx, xMax: retireIdx, borderColor: 'rgba(251,191,36,0.4)', borderWidth: 1, borderDash: [4,4] } } } : {}
      },
      scales: {
        x: { grid: { color: SL.grid }, ticks: slideTick(true) },
        y: { grid: { color: SL.grid }, ticks: { ...slideTick(true), callback: v => fmtS(v) } }
      }
    }
  });
}

function buildSlide2() { // ACCUMULATION
  const accRows = projectionData.filter(r => !r.isRetired);
  const s = summaryStats();
  const totalContrib = s.totalContrib;
  const totalGrowth  = s.retireTotal - (getVal('taxableBalance') + getVal('retirementBalance')) - totalContrib;

  return `
    <div class="slide-header">
      <div class="slide-eyebrow">Phase 1</div>
      <div class="slide-title">Accumulation Years</div>
      <div class="slide-subtitle">Ages ${s.startAge} – ${s.retireAge - 1} &nbsp;·&nbsp; ${s.accYears} years of growth</div>
    </div>
    <div class="hstat-row">
      <div class="hstat"><div class="hstat-label">Starting Balance</div><div class="hstat-val">${fmtS(getVal('taxableBalance') + getVal('retirementBalance'))}</div></div>
      <div class="hstat"><div class="hstat-label">Total Contributions</div><div class="hstat-val">${fmtS(totalContrib)}</div></div>
      <div class="hstat"><div class="hstat-label">Total Investment Growth</div><div class="hstat-val">${fmtS(totalGrowth)}</div></div>
      <div class="hstat"><div class="hstat-label">Balance at Retirement</div><div class="hstat-val">${fmtS(s.retireTotal)}</div></div>
    </div>
    <div class="slide-chart-grid" style="flex:1;min-height:0;">
      <div class="slide-card">
        <div class="slide-card-title">Wealth Growth During Accumulation</div>
        <canvas id="sc-accum" style="max-height:none;flex:1;"></canvas>
      </div>
      <div class="slide-card">
        <div class="slide-card-title">Retirement Balance Composition</div>
        <canvas id="sc-accum-pie" style="max-height:none;flex:1;"></canvas>
      </div>
    </div>
  `;
}
function drawSlide2() {
  destroyChart('accum'); destroyChart('accum-pie');
  const accRows = projectionData.filter(r => !r.isRetired);
  const ctx1 = document.getElementById('sc-accum');
  if (ctx1) {
    slideCharts['accum'] = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: accRows.map(r => r.age),
        datasets: [
          { label: 'Taxable', data: accRows.map(r => r.endTaxable), backgroundColor: SL.blueLight, borderColor: SL.blue, borderWidth: 1, borderRadius: 2, stack: 'a' },
          { label: 'Retirement', data: accRows.map(r => r.endRetirement), backgroundColor: SL.amberLight, borderColor: SL.amber, borderWidth: 1, borderRadius: 2, stack: 'a' },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: SL.muted, font: slideFont(10), boxWidth: 12, boxHeight: 12, padding: 12 } }, tooltip: { ...slideTooltip(), callbacks: { title: i => `Age ${i[0].label}`, label: i => ` ${i.dataset.label}: ${fmtS(i.raw)}` } } },
        scales: { x: { stacked: true, grid: { color: SL.grid }, ticks: slideTick() }, y: { stacked: true, grid: { color: SL.grid }, ticks: { ...slideTick(true), callback: v => fmtS(v) } } }
      }
    });
  }

  const ctx2 = document.getElementById('sc-accum-pie');
  const s = summaryStats();
  const retRow = projectionData.find(r => r.isRetired);
  if (ctx2 && retRow) {
    const startTax = getVal('taxableBalance');
    const startRet = getVal('retirementBalance');
    const tc = getVal('taxableContrib') * s.accYears;
    const rc = getVal('retirementContrib') * s.accYears;
    const growth = s.retireTotal - startTax - startRet - tc - rc;
    slideCharts['accum-pie'] = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['Starting Taxable', 'Starting Retirement', 'Taxable Contribs', 'Ret. Contribs', 'Investment Growth'],
        datasets: [{ data: [startTax, startRet, tc, rc, Math.max(0, growth)], backgroundColor: [SL.blueLight, SL.amberLight, SL.blue, SL.amber, SL.green], borderColor: '#1e293b', borderWidth: 2 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: SL.muted, font: slideFont(10), padding: 8, boxWidth: 10 } },
          tooltip: { ...slideTooltip(), callbacks: { label: i => ` ${i.label}: ${fmtS(i.raw)}` } }
        }
      }
    });
  }
}

function buildSlide3() { // RETIREMENT PHASE
  const s = summaryStats();
  const retRows = projectionData.filter(r => r.isRetired);
  const totalTax = s.totalRMDTax + s.totalRetTax;

  // Sample key years for table
  const keyAges = [s.retireAge, s.retireAge + 5, s.retireAge + 10, 73, 80, 85, s.endAge].filter((a,i,arr) => a >= s.retireAge && a <= s.endAge && arr.indexOf(a) === i).sort((a,b) => a-b).slice(0, 7);
  const tableRows = keyAges.map(age => projectionData.find(r => r.age === age)).filter(Boolean);

  return `
    <div class="slide-header">
      <div class="slide-eyebrow">Phase 2</div>
      <div class="slide-title">Retirement Cash Flow</div>
      <div class="slide-subtitle">Ages ${s.retireAge} – ${s.endAge} &nbsp;·&nbsp; ${s.retYears} years of distributions</div>
    </div>
    <div class="hstat-row">
      <div class="hstat"><div class="hstat-label">Year-1 Spending</div><div class="hstat-val">${fmtS(getVal('initialSpending'))}</div></div>
      <div class="hstat"><div class="hstat-label">Total Lifetime Spending</div><div class="hstat-val">${fmtS(s.totalSpend)}</div></div>
      <div class="hstat"><div class="hstat-label">Total Taxes Paid</div><div class="hstat-val">${fmtS(totalTax)}</div></div>
      <div class="hstat"><div class="hstat-label">Legacy Balance</div><div class="hstat-val">${fmtS(s.endTotal)}</div></div>
    </div>
    <div class="slide-2col" style="flex:1;min-height:0;">
      <div class="slide-card" style="overflow:auto;">
        <div class="slide-card-title">Key Retirement Years</div>
        <table class="slide-data-table">
          <thead><tr><th>Age</th><th>Spending</th><th>RMD</th><th>Total Bal.</th></tr></thead>
          <tbody>
            ${tableRows.map(r => `
              <tr class="${r.age === s.retireAge ? 'retire-row' : ''}">
                <td>${r.age}</td>
                <td class="td-neg">${r.spending > 0 ? fmtS(r.spending) : '—'}</td>
                <td class="td-purple">${r.rmdGross > 0 ? fmtS(r.rmdGross) : '—'}</td>
                <td class="td-bold">${fmtS(r.totalBalance)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="slide-card">
        <div class="slide-card-title">Retirement Balance Decline</div>
        <canvas id="sc-ret-balance" style="flex:1;max-height:none;"></canvas>
      </div>
    </div>
  `;
}
function drawSlide3() {
  destroyChart('ret-balance');
  const ctx = document.getElementById('sc-ret-balance');
  if (!ctx) return;
  const retRows = projectionData.filter(r => r.isRetired);
  slideCharts['ret-balance'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: retRows.map(r => r.age),
      datasets: [
        { label: 'Total', data: retRows.map(r => r.totalBalance), borderColor: SL.blue, backgroundColor: SL.blueLight, borderWidth: 2, fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4 },
        { label: 'Taxable', data: retRows.map(r => r.endTaxable), borderColor: SL.green, backgroundColor: 'transparent', borderWidth: 1.2, borderDash: [4,3], tension: 0.3, pointRadius: 0, pointHoverRadius: 3 },
        { label: 'Retirement', data: retRows.map(r => r.endRetirement), borderColor: SL.amber, backgroundColor: 'transparent', borderWidth: 1.2, borderDash: [4,3], tension: 0.3, pointRadius: 0, pointHoverRadius: 3 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: SL.muted, font: slideFont(10), boxWidth: 16, boxHeight: 2, padding: 12 } }, tooltip: { ...slideTooltip(), callbacks: { title: i => `Age ${i[0].label}`, label: i => ` ${i.dataset.label}: ${fmtS(i.raw)}` } } },
      scales: { x: { grid: { color: SL.grid }, ticks: slideTick() }, y: { grid: { color: SL.grid }, ticks: { ...slideTick(true), callback: v => fmtS(v) } } }
    }
  });
}

function buildSlide4() { // RMD IMPACT
  const s = summaryStats();
  const rmdRows = projectionData.filter(r => r.rmdGross > 0);
  const noRmds  = !rmdRows.length;

  return `
    <div class="slide-header">
      <div class="slide-eyebrow">Required Minimum Distributions</div>
      <div class="slide-title">RMD Analysis</div>
      <div class="slide-subtitle">SECURE 2.0 — begins age 73 &nbsp;·&nbsp; IRS Uniform Lifetime Table</div>
    </div>
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);">
      <div class="kpi-box"><div class="kpi-label">RMD Start Age</div><div class="kpi-val purple">${s.rmdStartAge || 'N/A'}</div><div class="kpi-sub">SECURE 2.0</div></div>
      <div class="kpi-box"><div class="kpi-label">Total RMDs</div><div class="kpi-val amber">${fmtS(s.totalRMD)}</div><div class="kpi-sub">Gross distributions</div></div>
      <div class="kpi-box"><div class="kpi-label">Total RMD Tax</div><div class="kpi-val red">${fmtS(s.totalRMDTax)}</div><div class="kpi-sub">At ${fmtP(getVal('rmdTaxPct'))} rate</div></div>
      <div class="kpi-box"><div class="kpi-label">After-Tax RMDs</div><div class="kpi-val green">${fmtS(s.totalRMD - s.totalRMDTax)}</div><div class="kpi-sub">To taxable account</div></div>
    </div>
    <div class="slide-chart-grid" style="flex:1;min-height:0;">
      <div class="slide-card">
        <div class="slide-card-title">Annual RMD vs Spending (Retirement Years)</div>
        <canvas id="sc-rmd-bar" style="flex:1;max-height:none;"></canvas>
      </div>
      <div class="slide-card">
        <div class="slide-card-title">RMD Breakdown${noRmds ? ' (No RMDs in range)' : ''}</div>
        <canvas id="sc-rmd-pie" style="flex:1;max-height:none;"></canvas>
      </div>
    </div>
  `;
}
function drawSlide4() {
  destroyChart('rmd-bar'); destroyChart('rmd-pie');
  const retRows = projectionData.filter(r => r.isRetired);
  const ctx1 = document.getElementById('sc-rmd-bar');
  if (ctx1 && retRows.length) {
    slideCharts['rmd-bar'] = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: retRows.map(r => r.age),
        datasets: [
          { label: 'Spending', data: retRows.map(r => r.spending), backgroundColor: SL.redLight, borderColor: SL.red, borderWidth: 1, borderRadius: 2 },
          { label: 'RMD (Gross)', data: retRows.map(r => r.rmdGross), backgroundColor: SL.purpleLight, borderColor: SL.purple, borderWidth: 1, borderRadius: 2 },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: SL.muted, font: slideFont(10), boxWidth: 12, boxHeight: 12, padding: 12 } }, tooltip: { ...slideTooltip(), callbacks: { title: i => `Age ${i[0].label}`, label: i => ` ${i.dataset.label}: ${fmtS(i.raw)}` } } },
        scales: { x: { grid: { color: SL.grid }, ticks: slideTick() }, y: { grid: { color: SL.grid }, ticks: { ...slideTick(true), callback: v => fmtS(v) } } }
      }
    });
  }

  const ctx2 = document.getElementById('sc-rmd-pie');
  const s = summaryStats();
  if (ctx2 && s.totalRMD > 0) {
    slideCharts['rmd-pie'] = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['After-Tax RMD (To Taxable)', 'RMD Tax Paid'],
        datasets: [{ data: [s.totalRMD - s.totalRMDTax, s.totalRMDTax], backgroundColor: [SL.purpleLight, SL.redLight], borderColor: [SL.purple, SL.red], borderWidth: 2 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: SL.muted, font: slideFont(10), padding: 10, boxWidth: 12 } },
          tooltip: { ...slideTooltip(), callbacks: { label: i => ` ${i.label}: ${fmtS(i.raw)} (${((i.raw/s.totalRMD)*100).toFixed(1)}%)` } }
        }
      }
    });
  } else if (ctx2) {
    // Show empty doughnut
    slideCharts['rmd-pie'] = new Chart(ctx2, {
      type: 'doughnut',
      data: { labels: ['No RMDs in projection range'], datasets: [{ data: [1], backgroundColor: ['#334155'], borderColor: '#1e293b', borderWidth: 1 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: SL.muted, font: slideFont(10) } } } }
    });
  }
}

function buildSlide5() { // TAX ANALYSIS
  const s = summaryStats();
  const totalTax = s.totalRMDTax + s.totalRetTax;

  return `
    <div class="slide-header">
      <div class="slide-eyebrow">Tax Impact</div>
      <div class="slide-title">Lifetime Tax Analysis</div>
      <div class="slide-subtitle">Retirement withdrawals · RMD distributions · Net impact on portfolio</div>
    </div>
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);">
      <div class="kpi-box"><div class="kpi-label">Ret. WD Tax Rate</div><div class="kpi-val amber">${fmtP(getVal('retirementTaxPct'))}</div><div class="kpi-sub">On retirement draws</div></div>
      <div class="kpi-box"><div class="kpi-label">RMD Tax Rate</div><div class="kpi-val purple">${fmtP(getVal('rmdTaxPct'))}</div><div class="kpi-sub">On mandatory dists.</div></div>
      <div class="kpi-box"><div class="kpi-label">Total Tax Paid</div><div class="kpi-val red">${fmtS(totalTax)}</div><div class="kpi-sub">All retirement years</div></div>
      <div class="kpi-box"><div class="kpi-label">Tax as % of Spending</div><div class="kpi-val amber">${s.totalSpend > 0 ? ((totalTax/s.totalSpend)*100).toFixed(1) + '%' : '—'}</div><div class="kpi-sub">Effective tax drag</div></div>
    </div>
    <div class="slide-2col" style="flex:1;min-height:0;">
      <div class="slide-card">
        <div class="slide-card-title">Annual Tax Breakdown (Retirement)</div>
        <canvas id="sc-tax-bar" style="flex:1;max-height:none;"></canvas>
      </div>
      <div class="slide-card">
        <div class="slide-card-title">Lifetime Tax Composition</div>
        <canvas id="sc-tax-pie" style="flex:1;max-height:none;"></canvas>
      </div>
    </div>
  `;
}
function drawSlide5() {
  destroyChart('tax-bar'); destroyChart('tax-pie');
  const retRows = projectionData.filter(r => r.isRetired);
  const ctx1 = document.getElementById('sc-tax-bar');
  if (ctx1 && retRows.length) {
    slideCharts['tax-bar'] = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: retRows.map(r => r.age),
        datasets: [
          { label: 'RMD Tax', data: retRows.map(r => r.rmdTax), backgroundColor: SL.purpleLight, borderColor: SL.purple, borderWidth: 1, borderRadius: 2, stack: 't' },
          { label: 'Ret. WD Tax', data: retRows.map(r => r.retWdTax), backgroundColor: SL.redLight, borderColor: SL.red, borderWidth: 1, borderRadius: 2, stack: 't' },
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: SL.muted, font: slideFont(10), boxWidth: 12, boxHeight: 12, padding: 12 } }, tooltip: { ...slideTooltip(), callbacks: { title: i => `Age ${i[0].label}`, label: i => ` ${i.dataset.label}: ${fmtS(i.raw)}` } } },
        scales: { x: { stacked: true, grid: { color: SL.grid }, ticks: slideTick() }, y: { stacked: true, grid: { color: SL.grid }, ticks: { ...slideTick(true), callback: v => fmtS(v) } } }
      }
    });
  }

  const ctx2 = document.getElementById('sc-tax-pie');
  const s = summaryStats();
  const totalTax = s.totalRMDTax + s.totalRetTax;
  if (ctx2 && totalTax > 0) {
    slideCharts['tax-pie'] = new Chart(ctx2, {
      type: 'doughnut',
      data: {
        labels: ['RMD Tax', 'Retirement WD Tax'],
        datasets: [{ data: [s.totalRMDTax, s.totalRetTax], backgroundColor: [SL.purpleLight, SL.redLight], borderColor: [SL.purple, SL.red], borderWidth: 2 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: SL.muted, font: slideFont(10), padding: 10, boxWidth: 12 } },
          tooltip: { ...slideTooltip(), callbacks: { label: i => ` ${i.label}: ${fmtS(i.raw)} (${((i.raw/totalTax)*100).toFixed(1)}%)` } }
        }
      }
    });
  }
}

function buildSlide6() { // LEGACY / SUMMARY
  const s = summaryStats();
  const totalTax = s.totalRMDTax + s.totalRetTax;
  const netReturn = s.totalReturn;
  const totalInflow = (getVal('taxableBalance') + getVal('retirementBalance')) + s.totalContrib + netReturn;

  return `
    <div class="slide-header">
      <div class="slide-eyebrow">Summary</div>
      <div class="slide-title">Legacy & Portfolio Summary</div>
      <div class="slide-subtitle">Complete financial lifetime overview</div>
    </div>
    <div class="slide-2col" style="flex:1;min-height:0;">
      <div style="display:flex;flex-direction:column;gap:.8rem;overflow:auto;">
        <div class="slide-card">
          <div class="slide-card-title">Lifetime Cash Flows</div>
          <table class="slide-data-table">
            <thead><tr><th>Category</th><th>Amount</th></tr></thead>
            <tbody>
              <tr><td>Starting Wealth</td><td class="td-bold">${fmtS(getVal('taxableBalance') + getVal('retirementBalance'))}</td></tr>
              <tr><td>Total Contributions</td><td class="td-pos">${fmtS(s.totalContrib)}</td></tr>
              <tr><td>Investment Returns</td><td class="td-pos">${fmtS(netReturn)}</td></tr>
              <tr><td>Total Spending</td><td class="td-neg">${fmtS(s.totalSpend)}</td></tr>
              <tr><td>Total RMDs Distributed</td><td class="td-purple">${fmtS(s.totalRMD)}</td></tr>
              <tr><td>Total Taxes Paid</td><td class="td-neg">${fmtS(totalTax)}</td></tr>
              <tr><td>Final Balance (Age ${s.endAge})</td><td class="td-bold">${fmtS(s.endTotal)}</td></tr>
            </tbody>
          </table>
        </div>
        <div class="slide-card">
          <div class="slide-card-title">Key Assumptions</div>
          <table class="slide-data-table">
            <thead><tr><th>Input</th><th>Value</th></tr></thead>
            <tbody>
              <tr><td>Taxable Return</td><td>${fmtP(getVal('taxableReturn'))}</td></tr>
              <tr><td>Retirement Return</td><td>${fmtP(getVal('retirementReturn'))}</td></tr>
              <tr><td>Inflation</td><td>${fmtP(getVal('inflationRate'))}</td></tr>
              <tr><td>Ret. WD Tax Rate</td><td>${fmtP(getVal('retirementTaxPct'))}</td></tr>
              <tr><td>RMD Tax Rate</td><td>${fmtP(getVal('rmdTaxPct'))}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="slide-card">
        <div class="slide-card-title">Portfolio Composition Over Time</div>
        <canvas id="sc-legacy-area" style="flex:1;max-height:none;"></canvas>
      </div>
    </div>
  `;
}
function drawSlide6() {
  destroyChart('legacy-area');
  const ctx = document.getElementById('sc-legacy-area');
  if (!ctx) return;
  const step = Math.max(1, Math.floor(projectionData.length / 20));
  const sampled = projectionData.filter((_,i) => i % step === 0 || i === projectionData.length - 1);
  slideCharts['legacy-area'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sampled.map(r => r.age),
      datasets: [
        { label: 'Taxable', data: sampled.map(r => r.endTaxable), backgroundColor: SL.blueLight, borderColor: SL.blue, borderWidth: 1, borderRadius: 2, stack: 's' },
        { label: 'Retirement', data: sampled.map(r => r.endRetirement), backgroundColor: SL.amberLight, borderColor: SL.amber, borderWidth: 1, borderRadius: 2, stack: 's' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: SL.muted, font: slideFont(10), boxWidth: 12, boxHeight: 12, padding: 12 } }, tooltip: { ...slideTooltip(), callbacks: { title: i => `Age ${i[0].label}`, label: i => ` ${i.dataset.label}: ${fmtS(i.raw)}` } } },
      scales: { x: { stacked: true, grid: { color: SL.grid }, ticks: slideTick() }, y: { stacked: true, grid: { color: SL.grid }, ticks: { ...slideTick(true), callback: v => fmtS(v) } } }
    }
  });
}

// ════════════════════════════════════════════════════════
// SLIDE ENGINE
// ════════════════════════════════════════════════════════

const SLIDES = [
  { build: buildSlide0, draw: null },
  { build: buildSlide1, draw: drawSlide1 },
  { build: buildSlide2, draw: drawSlide2 },
  { build: buildSlide3, draw: drawSlide3 },
  { build: buildSlide4, draw: drawSlide4 },
  { build: buildSlide5, draw: drawSlide5 },
  { build: buildSlide6, draw: drawSlide6 },
];

function renderSlideshow() {
  const viewport = document.getElementById('slides-viewport');
  const dots     = document.getElementById('slide-dots');
  document.getElementById('slide-total').textContent = SLIDES.length;

  // Rebuild all slides
  viewport.innerHTML = SLIDES.map((s, i) => `<div class="slide${i === currentSlide ? ' active' : ''}" id="slide-${i}">${s.build()}</div>`).join('');

  // Dots
  dots.innerHTML = SLIDES.map((_, i) => `<div class="slide-dot${i === currentSlide ? ' active' : ''}" onclick="goToSlide(${i})"></div>`).join('');

  // Draw current slide's charts
  drawCurrentSlide();
  updateNavButtons();
}

function drawCurrentSlide() {
  const s = SLIDES[currentSlide];
  if (s && s.draw) {
    // Small delay so DOM is ready
    setTimeout(() => { if (s.draw) s.draw(); }, 50);
  }
}

function goToSlide(idx) {
  if (idx < 0 || idx >= SLIDES.length) return;
  const old = document.getElementById(`slide-${currentSlide}`);
  if (old) { old.classList.add('exit'); setTimeout(() => old.classList.remove('exit','active'), 320); }

  currentSlide = idx;
  document.getElementById('slide-current').textContent = currentSlide + 1;

  // Rebuild target slide with fresh data
  const s = SLIDES[currentSlide];
  const el = document.getElementById(`slide-${currentSlide}`);
  if (el) {
    el.innerHTML = s.build();
    el.classList.remove('exit');
    el.classList.add('active');
  }

  // Update dots
  document.querySelectorAll('.slide-dot').forEach((d, i) => d.classList.toggle('active', i === currentSlide));
  updateNavButtons();
  drawCurrentSlide();
}

function nextSlide() { goToSlide(currentSlide + 1); }
function prevSlide() { goToSlide(currentSlide - 1); }

function updateNavButtons() {
  const prev = document.getElementById('btn-prev');
  const next = document.getElementById('btn-next');
  if (prev) prev.disabled = currentSlide === 0;
  if (next) next.disabled = currentSlide === SLIDES.length - 1;
}

// Keyboard navigation
document.addEventListener('keydown', e => {
  const pane = document.getElementById('pane-slideshow');
  if (!pane || !pane.classList.contains('active')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextSlide();
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   prevSlide();
});

// CSV export for slideshow data
function downloadSlideshowCSV() {
  downloadCSV(); // reuse main CSV
}
