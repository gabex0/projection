// ── slideshow.js — 9-Slide Presentation Engine ──

let currentSlide = 0;
const slideCharts = {};

const SL = {
  blue:'#3b82f6', blueL:'rgba(59,130,246,0.14)',
  green:'#4ade80', greenL:'rgba(74,222,128,0.11)',
  amber:'#fbbf24', amberL:'rgba(251,191,36,0.11)',
  red:'#f87171',   redL:'rgba(248,113,113,0.11)',
  purple:'#c084fc',purpleL:'rgba(192,132,252,0.11)',
  slate:'#94a3b8', grid:'rgba(255,255,255,0.055)',
  text:'#f1f5f9',  muted:'#64748b',
};
const sfont = (sz, mono) => ({ family: mono ? "'JetBrains Mono',monospace" : "'Inter',sans-serif", size: sz || 10 });
const stip  = (x={}) => ({ backgroundColor:'#1e293b', titleColor:'#f1f5f9', bodyColor:'#94a3b8', borderColor:'#334155', borderWidth:1, padding:10, ...x });
const stk   = (mono=true) => ({ color:SL.muted, font:sfont(10,mono) });

function dChart(key) {
  if (slideCharts[key]) { slideCharts[key].destroy(); delete slideCharts[key]; }
}

// Safe helpers — won't crash if projectionData is empty
function safeData() { return projectionData && projectionData.length > 0; }
function ss() {
  if (!safeData()) return { retireTotal:0, peakTotal:0, peakAge:'—', endTotal:0, accYears:0, retYears:0, totalContrib:0, totalSpend:0, totalRMD:0, totalRMDTax:0, totalRetTax:0, rmdStartAge:'—', retireAge:0, startAge:0, endAge:0 };
  const retRow  = projectionData.find(r=>r.isRetired)||projectionData[0];
  const peak    = projectionData.reduce((a,b)=>b.totalBalance>a.totalBalance?b:a,projectionData[0]);
  const endRow  = projectionData[projectionData.length-1];
  return {
    retireTotal:  retRow.taxableStart+retRow.retirementStart,
    peakTotal:    peak.totalBalance,
    peakAge:      peak.age,
    endTotal:     endRow.totalBalance,
    accYears:     projectionData.filter(r=>!r.isRetired).length,
    retYears:     projectionData.filter(r=>r.isRetired).length,
    totalContrib: projectionData.reduce((s,r)=>s+r.contributions,0),
    totalSpend:   projectionData.filter(r=>r.isRetired).reduce((s,r)=>s+r.spending,0),
    totalRMD:     projectionData.reduce((s,r)=>s+r.rmdGross,0),
    totalRMDTax:  projectionData.reduce((s,r)=>s+r.rmdTax,0),
    totalRetTax:  projectionData.reduce((s,r)=>s+r.retWdTax,0),
    totalIncome:  projectionData.filter(r=>r.isRetired).reduce((s,r)=>s+(r.income||0),0),
    rmdStartAge:  (projectionData.find(r=>r.rmdGross>0)||{}).age||'—',
    retireAge:    getVal('retireAge'),
    startAge:     getVal('startAge'),
    endAge:       getVal('endAge'),
  };
}

// ════ SLIDE BUILDERS ════

// 0: COVER
function buildS0() {
  const s = ss(), plan = (document.getElementById('planName')||{}).value || 'Retirement Plan';
  const risk = safeData() ? computeRiskScore(projectionData) : { label:'—', level:'unknown' };
  const narr = safeData() ? generateNarrative(projectionData) : 'Enter your values to see a personalized summary.';
  const incPct = s.totalSpend > 0 ? Math.min(100,((s.totalIncome||0)/s.totalSpend*100)).toFixed(0)+'%' : '0%';
  return `
    <div class="slide-cover" style="padding:1.6rem 2rem;">
      <div class="slide-eyebrow">Retirement Projection Report</div>
      <div class="cover-title">${plan}</div>
      <div class="cover-sub">Ages ${s.startAge} – ${s.endAge} &nbsp;·&nbsp; ${s.accYears} yrs accumulation &nbsp;·&nbsp; ${s.retYears} yrs retirement</div>
      <div class="cover-kpis">
        <div class="cover-kpi"><div class="cover-kpi-label">At Retirement</div><div class="cover-kpi-val">${fmtShort(s.retireTotal)}</div><div class="cover-kpi-sub">Age ${s.retireAge}</div></div>
        <div class="cover-kpi"><div class="cover-kpi-label">Peak Wealth</div><div class="cover-kpi-val">${fmtShort(s.peakTotal)}</div><div class="cover-kpi-sub">Age ${s.peakAge}</div></div>
        <div class="cover-kpi"><div class="cover-kpi-label">End Balance</div><div class="cover-kpi-val">${fmtShort(s.endTotal)}</div><div class="cover-kpi-sub">Age ${s.endAge}</div></div>
        <div class="cover-kpi"><div class="cover-kpi-label">Income Covered</div><div class="cover-kpi-val">${incPct}</div><div class="cover-kpi-sub">by guaranteed income</div></div>
      </div>
      <div class="cover-narrative">${narr}</div>
      <div class="cover-risk"><span class="risk-badge risk-${risk.level}" style="font-size:.72rem;">${risk.label} Risk</span>&nbsp; Risk assessment based on withdrawal rate, longevity, and return assumptions.</div>
    </div>`;
}

// 1: WEALTH TRAJECTORY
function buildS1() {
  const s = ss();
  return `
    <div class="slide-header"><div class="slide-eyebrow">Overview</div><div class="slide-title">Total Wealth Trajectory</div><div class="slide-subtitle">Full projection from age ${s.startAge} to ${s.endAge}</div></div>
    <div class="kpi-grid">
      <div class="kpi-box"><div class="kpi-label">Starting Wealth</div><div class="kpi-val blue">${fmtShort(getVal('taxableBalance')+getVal('retirementBalance'))}</div><div class="kpi-sub">Age ${s.startAge}</div></div>
      <div class="kpi-box"><div class="kpi-label">At Retirement</div><div class="kpi-val green">${fmtShort(s.retireTotal)}</div><div class="kpi-sub">Age ${s.retireAge}</div></div>
      <div class="kpi-box"><div class="kpi-label">Peak Wealth</div><div class="kpi-val amber">${fmtShort(s.peakTotal)}</div><div class="kpi-sub">Age ${s.peakAge}</div></div>
      <div class="kpi-box"><div class="kpi-label">End Balance</div><div class="kpi-val blue">${fmtShort(s.endTotal)}</div><div class="kpi-sub">Age ${s.endAge}</div></div>
    </div>
    <div class="slide-card" style="flex:1;min-height:0;"><div class="slide-card-title">Total Balance by Age — All Scenarios</div><canvas id="sc-wealth" style="max-height:none;flex:1;"></canvas></div>`;
}
function drawS1() {
  dChart('wealth');
  const ctx = document.getElementById('sc-wealth'); if(!ctx||!safeData()) return;
  const labels = projectionData.map(r=>r.age);
  const datasets = [
    { label:'Base', data:projectionData.map(r=>r.totalBalance), borderColor:SL.blue, backgroundColor:SL.blueL, borderWidth:2.5, fill:true, tension:.3, pointRadius:0, pointHoverRadius:5 },
    { label:'Taxable', data:projectionData.map(r=>r.endTaxable), borderColor:SL.green, backgroundColor:'transparent', borderWidth:1.2, borderDash:[5,3], tension:.3, pointRadius:0, pointHoverRadius:3 },
    { label:'Retirement', data:projectionData.map(r=>r.endRetirement), borderColor:SL.amber, backgroundColor:'transparent', borderWidth:1.2, borderDash:[5,3], tension:.3, pointRadius:0, pointHoverRadius:3 },
  ];
  if (window.scenarioResults) {
    const cols = { conservative:SL.red, aggressive:SL.green };
    for (const [k,d] of Object.entries(window.scenarioResults)) {
      if (d&&d.length) datasets.push({ label:k.charAt(0).toUpperCase()+k.slice(1), data:d.map(r=>r.totalBalance), borderColor:cols[k]||SL.purple, backgroundColor:'transparent', borderWidth:1.5, borderDash:[3,3], tension:.3, pointRadius:0, pointHoverRadius:3 });
    }
  }
  slideCharts['wealth'] = new Chart(ctx, {
    type:'line', data:{ labels, datasets },
    options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false},
      plugins:{ legend:{labels:{color:SL.muted,font:sfont(11),boxWidth:20,boxHeight:2,padding:16}}, tooltip:{...stip(),callbacks:{title:i=>`Age ${i[0].label}`,label:i=>` ${i.dataset.label}: ${fmtShort(i.raw)}`}} },
      scales:{ x:{grid:{color:SL.grid},ticks:stk()}, y:{grid:{color:SL.grid},ticks:{...stk(true),callback:v=>fmtShort(v)}} }
    }
  });
}

// 2: TIMELINE MILESTONES
function buildS2() {
  const s = ss();
  const milestones = [];
  if (safeData()) {
    const retRow = projectionData.find(r=>r.isRetired);
    const peak   = projectionData.reduce((a,b)=>b.totalBalance>a.totalBalance?b:a,projectionData[0]);
    const rmdRow = projectionData.find(r=>r.rmdGross>0);
    const depRow = projectionData.find(r=>r.endTaxable<1000&&r.isRetired);
    milestones.push({ age:s.startAge, label:'Start', color:SL.blue, icon:'🚀' });
    if (retRow) milestones.push({ age:s.retireAge, label:'Retirement', color:SL.amber, icon:'🏖' });
    if (rmdRow) milestones.push({ age:rmdRow.age, label:'RMDs Begin', color:SL.purple, icon:'📋' });
    milestones.push({ age:peak.age, label:'Peak Wealth', color:SL.green, icon:'📈' });
    if (depRow) milestones.push({ age:depRow.age, label:'Taxable Depleted', color:SL.red, icon:'⚠️' });
    milestones.push({ age:s.endAge, label:'End', color:SL.slate, icon:'🏁' });
  }
  milestones.sort((a,b)=>a.age-b.age);

  const totalSpan  = s.endAge - s.startAge || 1;
  const svgW = 520, svgH = 80;
  const markerY = 40;
  const lineY   = 40;

  let svgContent = `<svg viewBox="0 0 ${svgW} ${svgH}" style="width:100%;overflow:visible;margin-top:1rem;">`;
  // Background line
  svgContent += `<line x1="20" y1="${lineY}" x2="${svgW-20}" y2="${lineY}" stroke="#334155" stroke-width="2"/>`;
  // Milestones
  milestones.forEach((m, i) => {
    const pct = (m.age - s.startAge) / totalSpan;
    const x   = 20 + pct * (svgW - 40);
    const above = i % 2 === 0;
    const ty  = above ? lineY - 22 : lineY + 22;
    svgContent += `<circle cx="${x}" cy="${lineY}" r="7" fill="${m.color}" stroke="#0f172a" stroke-width="2"/>`;
    svgContent += `<line x1="${x}" y1="${lineY + (above ? -8 : 8)}" x2="${x}" y2="${ty + (above ? 12 : -12)}" stroke="${m.color}" stroke-width="1" stroke-dasharray="3,2"/>`;
    svgContent += `<text x="${x}" y="${ty + (above ? 0 : 14)}" text-anchor="middle" fill="${m.color}" font-size="10" font-family="Inter,sans-serif" font-weight="700">${m.age}</text>`;
    svgContent += `<text x="${x}" y="${ty + (above ? 12 : 26)}" text-anchor="middle" fill="#94a3b8" font-size="9" font-family="Inter,sans-serif">${m.label}</text>`;
  });
  svgContent += `</svg>`;

  const tableRows = milestones.map(m => {
    const row = safeData() ? projectionData.find(r=>r.age===m.age) : null;
    return `<tr><td>${m.icon} ${m.label}</td><td style="color:${m.color}">${m.age}</td><td>${row?fmtShort(row.totalBalance):'—'}</td></tr>`;
  }).join('');

  return `
    <div class="slide-header"><div class="slide-eyebrow">Plan Timeline</div><div class="slide-title">Key Life Milestones</div><div class="slide-subtitle">Automatically calculated from your inputs</div></div>
    <div class="slide-card" style="margin-bottom:.8rem;">
      <div class="slide-card-title">Financial Milestones Timeline</div>
      <div class="timeline-svg-wrap">${svgContent}</div>
    </div>
    <div class="slide-card" style="flex:1;overflow:auto;">
      <div class="slide-card-title">Milestone Summary</div>
      <table class="slide-data-table">
        <thead><tr><th>Event</th><th>Age</th><th>Total Balance</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;
}

// 3: ACCUMULATION
function buildS3() {
  const s = ss();
  const totalGrowth = s.retireTotal - (getVal('taxableBalance')+getVal('retirementBalance')) - s.totalContrib;
  return `
    <div class="slide-header"><div class="slide-eyebrow">Phase 1</div><div class="slide-title">Accumulation Years</div><div class="slide-subtitle">Ages ${s.startAge} – ${s.retireAge-1} · ${s.accYears} years of growth</div></div>
    <div class="hstat-row">
      <div class="hstat"><div class="hstat-label">Starting Balance</div><div class="hstat-val">${fmtShort(getVal('taxableBalance')+getVal('retirementBalance'))}</div></div>
      <div class="hstat"><div class="hstat-label">Total Contributions</div><div class="hstat-val">${fmtShort(s.totalContrib)}</div></div>
      <div class="hstat"><div class="hstat-label">Investment Growth</div><div class="hstat-val">${fmtShort(Math.max(0,totalGrowth))}</div></div>
      <div class="hstat"><div class="hstat-label">At Retirement</div><div class="hstat-val">${fmtShort(s.retireTotal)}</div></div>
    </div>
    <div class="slide-2col" style="flex:1;min-height:0;">
      <div class="slide-card"><div class="slide-card-title">Accumulation Growth (Stacked)</div><canvas id="sc-accum" style="max-height:none;flex:1;"></canvas></div>
      <div class="slide-card"><div class="slide-card-title">Retirement Portfolio Composition</div><canvas id="sc-accum-pie" style="max-height:none;flex:1;"></canvas></div>
    </div>`;
}
function drawS3() {
  dChart('accum'); dChart('accum-pie');
  const accRows = safeData() ? projectionData.filter(r=>!r.isRetired) : [];
  const ctx1 = document.getElementById('sc-accum');
  if (ctx1 && accRows.length) {
    slideCharts['accum'] = new Chart(ctx1, {
      type:'bar', data:{ labels:accRows.map(r=>r.age),
        datasets:[ { label:'Taxable', data:accRows.map(r=>r.endTaxable), backgroundColor:SL.blueL, borderColor:SL.blue, borderWidth:1, borderRadius:2, stack:'a' }, { label:'Retirement', data:accRows.map(r=>r.endRetirement), backgroundColor:SL.amberL, borderColor:SL.amber, borderWidth:1, borderRadius:2, stack:'a' } ]
      },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:SL.muted,font:sfont(10),boxWidth:12,boxHeight:12,padding:12}},tooltip:{...stip(),callbacks:{title:i=>`Age ${i[0].label}`,label:i=>` ${i.dataset.label}: ${fmtShort(i.raw)}`}}}, scales:{x:{stacked:true,grid:{color:SL.grid},ticks:stk()},y:{stacked:true,grid:{color:SL.grid},ticks:{...stk(true),callback:v=>fmtShort(v)}}} }
    });
  }
  const ctx2 = document.getElementById('sc-accum-pie');
  const s = ss();
  if (ctx2) {
    const startT = getVal('taxableBalance'), startR = getVal('retirementBalance');
    const tc = getVal('taxableContrib')*s.accYears, rc = getVal('retirementContrib')*s.accYears;
    const growth = Math.max(0, s.retireTotal - startT - startR - tc - rc);
    slideCharts['accum-pie'] = new Chart(ctx2, {
      type:'doughnut',
      data:{ labels:['Starting Taxable','Starting Retirement','Taxable Contribs','Ret. Contribs','Investment Growth'],
        datasets:[{data:[startT,startR,tc,rc,growth], backgroundColor:[SL.blueL,SL.amberL,SL.blue,SL.amber,SL.green], borderColor:'#1e293b', borderWidth:2}] },
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom',labels:{color:SL.muted,font:sfont(10),padding:8,boxWidth:10}},tooltip:{...stip(),callbacks:{label:i=>` ${i.label}: ${fmtShort(i.raw)}`}}} }
    });
  }
}

// 4: RETIREMENT PHASE
function buildS4() {
  const s = ss();
  const incPct = s.totalSpend>0 ? Math.min(100,((s.totalIncome||0)/s.totalSpend*100)).toFixed(0)+'%' : '0%';
  const retRows = safeData() ? projectionData.filter(r=>r.isRetired) : [];
  const keyAges = [s.retireAge, s.retireAge+5, s.retireAge+10, 73, 80, 85, s.endAge].filter((a,i,arr)=>a>=s.retireAge&&a<=s.endAge&&arr.indexOf(a)===i).sort((a,b)=>a-b).slice(0,7);
  const tableRows = keyAges.map(age=>projectionData.find(r=>r.age===age)).filter(Boolean).map(r=>`
    <tr class="${r.age===s.retireAge?'retire-row':''}"><td>${r.age}</td><td class="td-neg">${r.spending>0?fmtShort(r.spending):'—'}</td><td class="td-pos">${(r.income||0)>0?fmtShort(r.income):'—'}</td><td class="td-purple">${r.rmdGross>0?fmtShort(r.rmdGross):'—'}</td><td class="td-bold">${fmtShort(r.totalBalance)}</td></tr>`).join('');
  return `
    <div class="slide-header"><div class="slide-eyebrow">Phase 2</div><div class="slide-title">Retirement Cash Flow</div><div class="slide-subtitle">Ages ${s.retireAge} – ${s.endAge} · ${s.retYears} years of distributions</div></div>
    <div class="hstat-row">
      <div class="hstat"><div class="hstat-label">Year-1 Spending</div><div class="hstat-val">${fmtShort(getVal('initialSpending'))}</div></div>
      <div class="hstat"><div class="hstat-label">Total Spending</div><div class="hstat-val">${fmtShort(s.totalSpend)}</div></div>
      <div class="hstat"><div class="hstat-label">Income Covered</div><div class="hstat-val">${incPct}</div></div>
      <div class="hstat"><div class="hstat-label">Legacy Balance</div><div class="hstat-val">${fmtShort(s.endTotal)}</div></div>
    </div>
    <div class="slide-2col" style="flex:1;min-height:0;">
      <div class="slide-card" style="overflow:auto;"><div class="slide-card-title">Key Retirement Years</div>
        <table class="slide-data-table"><thead><tr><th>Age</th><th>Spending</th><th>Income</th><th>RMD</th><th>Total Bal.</th></tr></thead><tbody>${tableRows}</tbody></table>
      </div>
      <div class="slide-card"><div class="slide-card-title">Balance During Retirement</div><canvas id="sc-ret-bal" style="flex:1;max-height:none;"></canvas></div>
    </div>`;
}
function drawS4() {
  dChart('ret-bal');
  const ctx = document.getElementById('sc-ret-bal'); if(!ctx||!safeData()) return;
  const retRows = projectionData.filter(r=>r.isRetired);
  slideCharts['ret-bal'] = new Chart(ctx, {
    type:'line', data:{ labels:retRows.map(r=>r.age),
      datasets:[
        {label:'Total',data:retRows.map(r=>r.totalBalance),borderColor:SL.blue,backgroundColor:SL.blueL,borderWidth:2,fill:true,tension:.3,pointRadius:0,pointHoverRadius:4},
        {label:'Taxable',data:retRows.map(r=>r.endTaxable),borderColor:SL.green,backgroundColor:'transparent',borderWidth:1.2,borderDash:[4,3],tension:.3,pointRadius:0,pointHoverRadius:3},
        {label:'Retirement',data:retRows.map(r=>r.endRetirement),borderColor:SL.amber,backgroundColor:'transparent',borderWidth:1.2,borderDash:[4,3],tension:.3,pointRadius:0,pointHoverRadius:3},
      ]},
    options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false}, plugins:{legend:{labels:{color:SL.muted,font:sfont(10),boxWidth:16,boxHeight:2,padding:12}},tooltip:{...stip(),callbacks:{title:i=>`Age ${i[0].label}`,label:i=>` ${i.dataset.label}: ${fmtShort(i.raw)}`}}}, scales:{x:{grid:{color:SL.grid},ticks:stk()},y:{grid:{color:SL.grid},ticks:{...stk(true),callback:v=>fmtShort(v)}}} }
  });
}

// 5: RMD ANALYSIS
function buildS5() {
  const s = ss();
  return `
    <div class="slide-header"><div class="slide-eyebrow">RMDs</div><div class="slide-title">Required Minimum Distributions</div><div class="slide-subtitle">SECURE 2.0 — begins age 73 · IRS Uniform Lifetime Table</div></div>
    <div class="kpi-grid">
      <div class="kpi-box"><div class="kpi-label">RMD Start Age</div><div class="kpi-val purple">${s.rmdStartAge}</div><div class="kpi-sub">SECURE 2.0</div></div>
      <div class="kpi-box"><div class="kpi-label">Total RMDs</div><div class="kpi-val amber">${fmtShort(s.totalRMD)}</div><div class="kpi-sub">Gross</div></div>
      <div class="kpi-box"><div class="kpi-label">Total RMD Tax</div><div class="kpi-val red">${fmtShort(s.totalRMDTax)}</div><div class="kpi-sub">At ${fmtPct(getVal('rmdTaxPct'))} rate</div></div>
      <div class="kpi-box"><div class="kpi-label">After-Tax RMDs</div><div class="kpi-val green">${fmtShort(s.totalRMD-s.totalRMDTax)}</div><div class="kpi-sub">To taxable account</div></div>
    </div>
    <div class="slide-2col" style="flex:1;min-height:0;">
      <div class="slide-card"><div class="slide-card-title">Annual RMD vs Spending</div><canvas id="sc-rmd-bar" style="flex:1;max-height:none;"></canvas></div>
      <div class="slide-card"><div class="slide-card-title">RMD Distribution Breakdown</div><canvas id="sc-rmd-pie" style="flex:1;max-height:none;"></canvas></div>
    </div>`;
}
function drawS5() {
  dChart('rmd-bar'); dChart('rmd-pie');
  const retRows = safeData() ? projectionData.filter(r=>r.isRetired) : [];
  const ctx1 = document.getElementById('sc-rmd-bar');
  if (ctx1&&retRows.length) {
    slideCharts['rmd-bar'] = new Chart(ctx1, {
      type:'bar', data:{ labels:retRows.map(r=>r.age),
        datasets:[{label:'Spending',data:retRows.map(r=>r.spending),backgroundColor:SL.redL,borderColor:SL.red,borderWidth:1,borderRadius:2},{label:'RMD (Gross)',data:retRows.map(r=>r.rmdGross),backgroundColor:SL.purpleL,borderColor:SL.purple,borderWidth:1,borderRadius:2}]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:SL.muted,font:sfont(10),boxWidth:12,boxHeight:12,padding:12}},tooltip:{...stip(),callbacks:{title:i=>`Age ${i[0].label}`,label:i=>` ${i.dataset.label}: ${fmtShort(i.raw)}`}}}, scales:{x:{grid:{color:SL.grid},ticks:stk()},y:{grid:{color:SL.grid},ticks:{...stk(true),callback:v=>fmtShort(v)}}} }
    });
  }
  const ctx2 = document.getElementById('sc-rmd-pie');
  const s = ss();
  if (ctx2) {
    const after = s.totalRMD-s.totalRMDTax;
    slideCharts['rmd-pie'] = new Chart(ctx2, {
      type:'doughnut',
      data:{ labels:['After-Tax (to Taxable)','RMD Tax Paid'], datasets:[{data:[after>0?after:1,s.totalRMDTax],backgroundColor:[SL.purpleL,SL.redL],borderColor:[SL.purple,SL.red],borderWidth:2}]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom',labels:{color:SL.muted,font:sfont(10),padding:10,boxWidth:12}},tooltip:{...stip(),callbacks:{label:i=>` ${i.label}: ${fmtShort(i.raw)}`}}} }
    });
  }
}

// 6: TAX ANALYSIS
function buildS6() {
  const s = ss();
  const totalTax = s.totalRMDTax+s.totalRetTax;
  const taxDrag  = s.totalSpend>0?((totalTax/s.totalSpend)*100).toFixed(1)+'%':'—';
  return `
    <div class="slide-header"><div class="slide-eyebrow">Tax Impact</div><div class="slide-title">Lifetime Tax Analysis</div><div class="slide-subtitle">Retirement withdrawals · RMD distributions · Net impact</div></div>
    <div class="kpi-grid">
      <div class="kpi-box"><div class="kpi-label">Ordinary Income Rate</div><div class="kpi-val amber">${fmtPct(getVal('retirementTaxPct'))}</div><div class="kpi-sub">Retirement withdrawals</div></div>
      <div class="kpi-box"><div class="kpi-label">Capital Gains Rate</div><div class="kpi-val blue">${fmtPct(getVal('capitalGainsTaxPct'))}</div><div class="kpi-sub">Taxable account</div></div>
      <div class="kpi-box"><div class="kpi-label">Total Tax Paid</div><div class="kpi-val red">${fmtShort(totalTax)}</div><div class="kpi-sub">All retirement years</div></div>
      <div class="kpi-box"><div class="kpi-label">Tax Drag</div><div class="kpi-val amber">${taxDrag}</div><div class="kpi-sub">% of total spending</div></div>
    </div>
    <div class="slide-2col" style="flex:1;min-height:0;">
      <div class="slide-card"><div class="slide-card-title">Annual Tax Breakdown</div><canvas id="sc-tax-bar" style="flex:1;max-height:none;"></canvas></div>
      <div class="slide-card"><div class="slide-card-title">Lifetime Tax Composition</div><canvas id="sc-tax-pie" style="flex:1;max-height:none;"></canvas></div>
    </div>`;
}
function drawS6() {
  dChart('tax-bar'); dChart('tax-pie');
  const retRows = safeData() ? projectionData.filter(r=>r.isRetired) : [];
  const ctx1 = document.getElementById('sc-tax-bar');
  if (ctx1&&retRows.length) {
    slideCharts['tax-bar'] = new Chart(ctx1, {
      type:'bar', data:{ labels:retRows.map(r=>r.age),
        datasets:[{label:'RMD Tax',data:retRows.map(r=>r.rmdTax),backgroundColor:SL.purpleL,borderColor:SL.purple,borderWidth:1,borderRadius:2,stack:'t'},{label:'Ret. WD Tax',data:retRows.map(r=>r.retWdTax),backgroundColor:SL.redL,borderColor:SL.red,borderWidth:1,borderRadius:2,stack:'t'}]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:SL.muted,font:sfont(10),boxWidth:12,boxHeight:12,padding:12}},tooltip:{...stip(),callbacks:{title:i=>`Age ${i[0].label}`,label:i=>` ${i.dataset.label}: ${fmtShort(i.raw)}`}}}, scales:{x:{stacked:true,grid:{color:SL.grid},ticks:stk()},y:{stacked:true,grid:{color:SL.grid},ticks:{...stk(true),callback:v=>fmtShort(v)}}} }
    });
  }
  const ctx2 = document.getElementById('sc-tax-pie');
  const s = ss();
  if (ctx2) {
    slideCharts['tax-pie'] = new Chart(ctx2, {
      type:'doughnut',
      data:{ labels:['RMD Tax','Ret. WD Tax'], datasets:[{data:[s.totalRMDTax||1,s.totalRetTax||1],backgroundColor:[SL.purpleL,SL.redL],borderColor:[SL.purple,SL.red],borderWidth:2}]},
      options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'bottom',labels:{color:SL.muted,font:sfont(10),padding:10,boxWidth:12}},tooltip:{...stip(),callbacks:{label:i=>` ${i.label}: ${fmtShort(i.raw)}`}}} }
    });
  }
}

// 7: STRESS TEST
function buildS7() {
  const s = ss();
  const stressScenarios = [
    { key:'base',         label:'Base Case',        color:SL.blue   },
    { key:'lowReturn',    label:'Returns −2%',      color:SL.amber  },
    { key:'highInflation',label:'Inflation +2%',    color:SL.red    },
  ];
  const endRows = stressScenarios.map(sc => {
    const d = window.stressResults?.[sc.key]||[];
    const end = d[d.length-1];
    return { ...sc, endBal: end?.totalBalance||0 };
  });
  const tableRows = endRows.map(sc=>`<tr><td style="color:${sc.color}">${sc.label}</td><td class="td-bold">${fmtShort(sc.endBal)}</td><td class="${sc.endBal>0?'td-pos':'td-neg'}">${sc.endBal>0?'✓ Solvent':'⚠ Depleted'}</td></tr>`).join('');

  return `
    <div class="slide-header"><div class="slide-eyebrow">Risk Analysis</div><div class="slide-title">Stress Test Scenarios</div><div class="slide-subtitle">How your plan performs under adverse conditions</div></div>
    <div class="hstat-row">
      <div class="hstat"><div class="hstat-label">Base End Balance</div><div class="hstat-val">${fmtShort(s.endTotal)}</div></div>
      <div class="hstat"><div class="hstat-label">Returns −2% Scenario</div><div class="hstat-val">${fmtShort(endRows.find(r=>r.key==='lowReturn')?.endBal||0)}</div></div>
      <div class="hstat"><div class="hstat-label">Inflation +2% Scenario</div><div class="hstat-val">${fmtShort(endRows.find(r=>r.key==='highInflation')?.endBal||0)}</div></div>
    </div>
    <div class="slide-2col" style="flex:1;min-height:0;">
      <div class="slide-card"><div class="slide-card-title">Scenario Comparison — Total Balance</div><canvas id="sc-stress" style="flex:1;max-height:none;"></canvas></div>
      <div class="slide-card" style="overflow:auto;">
        <div class="slide-card-title">Stress Test Results</div>
        <table class="slide-data-table"><thead><tr><th>Scenario</th><th>End Balance</th><th>Status</th></tr></thead><tbody>${tableRows}</tbody></table>
        <div style="margin-top:1rem;font-size:.68rem;color:#64748b;line-height:1.6;">These scenarios apply shocks to return rates and inflation while keeping all other inputs constant. Results illustrate portfolio sensitivity — not predictions of future performance.</div>
      </div>
    </div>`;
}
function drawS7() {
  dChart('stress');
  const ctx = document.getElementById('sc-stress'); if(!ctx) return;
  const stressMap = window.stressResults||{};
  const labels = (stressMap.base||projectionData||[]).map(r=>r.age);
  const scenarios = [
    { key:'base',          label:'Base',           color:SL.blue,  width:2.5 },
    { key:'lowReturn',     label:'Returns −2%',    color:SL.amber, width:1.5 },
    { key:'highInflation', label:'Inflation +2%',  color:SL.red,   width:1.5 },
  ];
  const datasets = scenarios.map(sc => ({
    label: sc.label,
    data: (stressMap[sc.key]||[]).map(r=>r.totalBalance),
    borderColor: sc.color, backgroundColor:'transparent',
    borderWidth: sc.width, borderDash: sc.width<2?[4,3]:[], tension:.3, pointRadius:0, pointHoverRadius:4
  })).filter(d=>d.data.length>0);

  slideCharts['stress'] = new Chart(ctx, {
    type:'line', data:{ labels, datasets },
    options:{ responsive:true, maintainAspectRatio:false, interaction:{mode:'index',intersect:false}, plugins:{legend:{labels:{color:SL.muted,font:sfont(11),boxWidth:20,boxHeight:2,padding:14}},tooltip:{...stip(),callbacks:{title:i=>`Age ${i[0].label}`,label:i=>` ${i.dataset.label}: ${fmtShort(i.raw)}`}}}, scales:{x:{grid:{color:SL.grid},ticks:stk()},y:{grid:{color:SL.grid},ticks:{...stk(true),callback:v=>fmtShort(v)}}} }
  });
}

// 8: LEGACY SUMMARY
function buildS8() {
  const s = ss();
  const totalTax = s.totalRMDTax+s.totalRetTax;
  const netReturn = safeData()?projectionData.reduce((sum,r)=>sum+r.netReturn,0):0;
  return `
    <div class="slide-header"><div class="slide-eyebrow">Summary</div><div class="slide-title">Legacy & Portfolio Summary</div><div class="slide-subtitle">Complete financial lifetime overview</div></div>
    <div class="slide-2col" style="flex:1;min-height:0;">
      <div style="display:flex;flex-direction:column;gap:.8rem;overflow:auto;">
        <div class="slide-card">
          <div class="slide-card-title">Lifetime Cash Flows</div>
          <table class="slide-data-table"><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody>
            <tr><td>Starting Wealth</td><td class="td-bold">${fmtShort(getVal('taxableBalance')+getVal('retirementBalance'))}</td></tr>
            <tr><td>Total Contributions</td><td class="td-pos">${fmtShort(s.totalContrib)}</td></tr>
            <tr><td>Investment Returns</td><td class="td-pos">${fmtShort(netReturn)}</td></tr>
            <tr><td>Total Spending</td><td class="td-neg">${fmtShort(s.totalSpend)}</td></tr>
            <tr><td>Guaranteed Income</td><td class="td-pos">${fmtShort(s.totalIncome||0)}</td></tr>
            <tr><td>Total RMDs</td><td class="td-purple">${fmtShort(s.totalRMD)}</td></tr>
            <tr><td>Total Taxes</td><td class="td-neg">${fmtShort(totalTax)}</td></tr>
            <tr><td>Final Balance</td><td class="td-bold">${fmtShort(s.endTotal)}</td></tr>
          </tbody></table>
        </div>
        <div class="slide-card">
          <div class="slide-card-title">Key Assumptions</div>
          <table class="slide-data-table"><thead><tr><th>Input</th><th>Value</th></tr></thead><tbody>
            <tr><td>Taxable Return</td><td>${fmtPct(getVal('taxableReturn'))}</td></tr>
            <tr><td>Retirement Return</td><td>${fmtPct(getVal('retirementReturn'))}</td></tr>
            <tr><td>Inflation</td><td>${fmtPct(getVal('inflationRate'))}</td></tr>
            <tr><td>Ordinary Income Tax</td><td>${fmtPct(getVal('retirementTaxPct'))}</td></tr>
            <tr><td>RMD Tax Rate</td><td>${fmtPct(getVal('rmdTaxPct'))}</td></tr>
          </tbody></table>
        </div>
      </div>
      <div class="slide-card"><div class="slide-card-title">Portfolio Mix Over Time</div><canvas id="sc-legacy" style="flex:1;max-height:none;"></canvas></div>
    </div>`;
}
function drawS8() {
  dChart('legacy');
  const ctx = document.getElementById('sc-legacy'); if(!ctx||!safeData()) return;
  const step = Math.max(1,Math.floor(projectionData.length/22));
  const samp = projectionData.filter((_,i)=>i%step===0||i===projectionData.length-1);
  slideCharts['legacy'] = new Chart(ctx, {
    type:'bar', data:{ labels:samp.map(r=>r.age),
      datasets:[{label:'Taxable',data:samp.map(r=>r.endTaxable),backgroundColor:SL.blueL,borderColor:SL.blue,borderWidth:1,borderRadius:2,stack:'s'},{label:'Retirement',data:samp.map(r=>r.endRetirement),backgroundColor:SL.amberL,borderColor:SL.amber,borderWidth:1,borderRadius:2,stack:'s'}]},
    options:{ responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:SL.muted,font:sfont(10),boxWidth:12,boxHeight:12,padding:12}},tooltip:{...stip(),callbacks:{title:i=>`Age ${i[0].label}`,label:i=>` ${i.dataset.label}: ${fmtShort(i.raw)}`}}}, scales:{x:{stacked:true,grid:{color:SL.grid},ticks:stk()},y:{stacked:true,grid:{color:SL.grid},ticks:{...stk(true),callback:v=>fmtShort(v)}}} }
  });
}

// ════ ENGINE ════

const SLIDES = [
  { build:buildS0, draw:null },
  { build:buildS1, draw:drawS1 },
  { build:buildS2, draw:null   },
  { build:buildS3, draw:drawS3 },
  { build:buildS4, draw:drawS4 },
  { build:buildS5, draw:drawS5 },
  { build:buildS6, draw:drawS6 },
  { build:buildS7, draw:drawS7 },
  { build:buildS8, draw:drawS8 },
];

function renderSlideshow() {
  const vp   = document.getElementById('slides-viewport'); if (!vp) return;
  const dots = document.getElementById('slide-dots');
  const tot  = document.getElementById('slide-total');
  if (tot) tot.textContent = SLIDES.length;

  vp.innerHTML = SLIDES.map((s,i)=>`<div class="slide${i===currentSlide?' active':''}" id="slide-${i}">${s.build()}</div>`).join('');
  if (dots) dots.innerHTML = SLIDES.map((_,i)=>`<div class="slide-dot${i===currentSlide?' active':''}" onclick="goToSlide(${i})"></div>`).join('');

  drawCurrentSlide();
  updateNavBtns();
}

function drawCurrentSlide() {
  const s = SLIDES[currentSlide];
  if (s?.draw) setTimeout(()=>s.draw(), 60);
}

function goToSlide(idx) {
  if (idx<0||idx>=SLIDES.length) return;
  const old = document.getElementById(`slide-${currentSlide}`);
  if (old) { old.classList.add('exit'); setTimeout(()=>old.classList.remove('exit','active'),300); }
  currentSlide = idx;
  document.getElementById('slide-current').textContent = currentSlide + 1;
  const s = SLIDES[currentSlide];
  const el = document.getElementById(`slide-${currentSlide}`);
  if (el) { el.innerHTML = s.build(); el.classList.remove('exit'); el.classList.add('active'); }
  document.querySelectorAll('.slide-dot').forEach((d,i)=>d.classList.toggle('active',i===currentSlide));
  updateNavBtns();
  drawCurrentSlide();
}

function nextSlide() { goToSlide(currentSlide+1); }
function prevSlide() { goToSlide(currentSlide-1); }

function updateNavBtns() {
  const p = document.getElementById('btn-prev'), n = document.getElementById('btn-next');
  if (p) p.disabled = currentSlide===0;
  if (n) n.disabled = currentSlide===SLIDES.length-1;
}

document.addEventListener('keydown', e => {
  const pane = document.getElementById('pane-slideshow');
  if (!pane?.classList.contains('active')) return;
  if (e.key==='ArrowRight'||e.key==='ArrowDown') nextSlide();
  if (e.key==='ArrowLeft' ||e.key==='ArrowUp')   prevSlide();
});

// ── Initialize with default values immediately on load ──
document.addEventListener('DOMContentLoaded', () => {
  // Give model.js time to run first
  setTimeout(() => {
    if (typeof renderSlideshow === 'function') renderSlideshow();
  }, 100);
});
