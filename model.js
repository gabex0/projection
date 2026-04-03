// ── model.js — Projection Engine ──

let projectionData  = [];   // active scenario data
let allScenarioData = {};   // all scenarios: { id: { name, color, data } }
let chart = null;
let currentMode = 'forward';

const $ = id => document.getElementById(id);

const RMD_TABLE = {
  73:26.5,74:25.5,75:24.6,76:23.7,77:22.9,78:22.0,79:21.1,
  80:20.2,81:19.4,82:18.5,83:17.7,84:16.8,85:16.0,86:15.2,87:14.4,
  88:13.7,89:12.9,90:12.2,91:11.5,92:10.8,93:10.1,94:9.5,95:8.9,
  96:8.4,97:7.8,98:7.3,99:6.8,100:6.4,101:6.0,102:5.6,103:5.2,
  104:4.9,105:4.6,106:4.3,107:4.1,108:3.9,109:3.7,110:3.5
};

function getVal(id) {
  const el = $(id);
  if (!el) return 0;
  if (el.type === 'checkbox') return el.checked ? 1 : 0;
  return parseFloat(el.value) || 0;
}
function getStr(id) { const el=$(id); return el ? (el.value||'') : ''; }

// ── Formatting ──
function fmtRaw(n) { if(!n&&n!==0)return'—'; if(n===0)return'—'; return '$'+Math.round(n).toLocaleString('en-US'); }
function fmtShort(n) {
  const a=Math.abs(n);
  if(a>=1e9)return'$'+(n/1e9).toFixed(2)+'B';
  if(a>=1e6)return'$'+(n/1e6).toFixed(2)+'M';
  if(a>=1e3)return'$'+(n/1e3).toFixed(0)+'K';
  return'$'+Math.round(n).toLocaleString();
}
function fmtPct(n) { return(+n).toFixed(1)+'%'; }

// ── Mode ──
function setMode(mode) {
  currentMode = mode;
  $('btn-forward')?.classList.toggle('active', mode === 'forward');
  $('btn-reverse')?.classList.toggle('active', mode === 'reverse');

  // Show/hide reverse-specific fields
  $('taxContribField')?.classList.toggle('hidden', mode === 'reverse');
  $('retContribField')?.classList.toggle('hidden', mode === 'reverse');
  $('spendModelField')?.classList.toggle('hidden', mode === 'reverse');
  $('spending-fixed-inputs')?.classList.toggle('hidden', mode === 'reverse');
  $('targetIncomeField')?.classList.toggle('hidden', mode !== 'reverse');
  $('reverseBanner')?.classList.toggle('hidden', mode !== 'reverse');

  runModel();
}

// ── Spending model UI ──
function onSpendingModelChange() {
  const model = getStr('spendingModel');
  $('spending-fixed-inputs')?.classList.toggle('hidden', model !== 'fixed');
  $('spending-pct-inputs')?.classList.toggle('hidden', model !== 'pct');
  $('spending-guardrails-inputs')?.classList.toggle('hidden', model !== 'guardrails');
  $('spending-curve-inputs')?.classList.toggle('hidden', model !== 'curve');
}

// ── Income ──
function annualIncome(age) {
  const retireAge = getVal('retireAge');
  if (age < retireAge) return 0;
  let income = 0;
  const ssStart = getVal('ssStartAge');
  if (age >= ssStart) income += getVal('ssMonthly') * 12;
  income += getVal('pensionMonthly') * 12;
  income += getVal('rentalAnnual');
  return income;
}

// ── Spending calculator ──
function computeSpending(age, isRetired, totalBal, prevSpend, retireAge) {
  if (!isRetired) return 0;
  const model    = getStr('spendingModel');
  const inflation= getVal('inflationRate') / 100;
  const initSpend= getVal('initialSpending');
  if (model === 'pct') return totalBal * (getVal('spendPct') / 100);
  if (model === 'guardrails') {
    const base   = getVal('guardBase');
    const floor  = getVal('guardFloor');
    const ceiling= getVal('guardCeiling');
    const target = prevSpend > 0 ? prevSpend * (1 + inflation) : base;
    const ratio  = totalBal > 0 ? totalBal / (base / 0.04 || 1) : 1;
    if (ratio > 1.1) return Math.min(ceiling, target * 1.05);
    if (ratio < 0.8) return Math.max(floor, target * 0.90);
    return Math.min(ceiling, Math.max(floor, target));
  }
  if (model === 'curve') {
    const yrs = age - retireAge;
    if (yrs < 10)  return getVal('curveEarly') * Math.pow(1+inflation, yrs);
    if (yrs < 20)  return getVal('curveMid')   * Math.pow(1+inflation, yrs-10);
    return               getVal('curveLate')   * Math.pow(1+inflation, yrs-20);
  }
  if (age === retireAge) return initSpend;
  return prevSpend > 0 ? prevSpend * (1 + inflation) : initSpend;
}

// ── Core projection (overrides allow scenario/stress runs) ──
function projectScenario(overrides = {}) {
  const startAge    = overrides.startAge     ?? getVal('startAge');
  const endAge      = overrides.endAge       ?? getVal('endAge');
  const retireAge   = overrides.retireAge    ?? getVal('retireAge');
  const taxStart    = overrides.taxStart     ?? getVal('taxableBalance');
  const retStart    = overrides.retStart     ?? getVal('retirementBalance');
  const taxRate     = overrides.taxRate      ?? getVal('taxableReturn')     / 100;
  const retRate     = overrides.retRate      ?? getVal('retirementReturn')  / 100;
  const inflation   = overrides.inflation    ?? getVal('inflationRate')     / 100;
  const taxContrib  = overrides.taxContrib   ?? getVal('taxableContrib');
  const retContrib  = overrides.retContrib   ?? getVal('retirementContrib');
  const retTaxRate  = overrides.retTaxRate   ?? getVal('retirementTaxPct') / 100;
  const rmdTaxRate  = overrides.rmdTaxRate   ?? getVal('rmdTaxPct')         / 100;
  const doRoth      = overrides.doRoth       ?? getVal('rothConversion') === 1;
  const rothAnnual  = overrides.rothAnnual   ?? getVal('rothAnnual');

  const data = [];
  let taxable    = taxStart;
  let retirement = retStart;
  let prevSpend  = 0;

  for (let age = startAge; age <= endAge; age++) {
    const isRetired = age >= retireAge;
    const totalBal  = taxable + retirement;
    const income    = annualIncome(age);
    const spending  = computeSpending(age, isRetired, totalBal, prevSpend, retireAge);
    if (isRetired) prevSpend = spending;
    else           prevSpend = 0;
    const netSpend  = Math.max(0, spending - income);
    const netReturn = taxable * taxRate + retirement * retRate;
    const contributions = isRetired ? 0 : (taxContrib + retContrib);

    let rothConverted=0, rothTax=0;
    if (doRoth && isRetired && age < 73 && retirement > 0) {
      rothConverted = Math.min(rothAnnual, retirement);
      rothTax       = rothConverted * retTaxRate;
    }

    let rmdGross=0, rmdTax=0, rmdAfterTax=0;
    if (isRetired && age >= 73 && RMD_TABLE[age]) {
      rmdGross    = Math.min(retirement, retirement / RMD_TABLE[age]);
      rmdTax      = rmdGross * rmdTaxRate;
      rmdAfterTax = rmdGross - rmdTax;
    }

    let endTaxable, endRetirement, retWdGross=0, retWdTax=0;
    if (!isRetired) {
      endTaxable    = taxable * (1 + taxRate) + taxContrib;
      endRetirement = retirement * (1 + retRate) + retContrib;
    } else {
      const retAfterRoth= Math.max(0, retirement - rothConverted);
      const retAfterRmd = Math.max(0, retAfterRoth - rmdGross);
      const grownRet    = retAfterRmd * (1 + retRate);
      const grownTax    = taxable * (1 + taxRate) + (rothConverted - rothTax) + rmdAfterTax;
      const taxableWd   = Math.min(grownTax, netSpend);
      const remaining   = Math.max(0, netSpend - taxableWd);
      if (remaining > 0 && retTaxRate < 1) {
        retWdGross = Math.min(grownRet, remaining / (1 - retTaxRate));
        retWdTax   = retWdGross * retTaxRate;
      }
      endTaxable    = Math.max(0, grownTax - taxableWd);
      endRetirement = Math.max(0, grownRet - retWdGross);
    }

    data.push({ age, isRetired, phase: isRetired?'Retirement':'Accumulation',
      taxableStart:taxable, retirementStart:retirement, netReturn, contributions,
      income, spending, netSpend, rothConverted, rothTax,
      rmdGross, rmdTax, rmdAfterTax, retWdGross, retWdTax,
      endTaxable, endRetirement, totalBalance: endTaxable+endRetirement });

    taxable    = endTaxable;
    retirement = endRetirement;
  }
  return data;
}

// ── Reverse planning solver ──
function solveReversePlanning() {
  const targetIncome = getVal('targetIncome') || getVal('initialSpending');
  const retireAge    = getVal('retireAge');
  const startAge     = getVal('startAge');
  const endAge       = getVal('endAge');
  const yearsToRetire= retireAge - startAge;
  if (yearsToRetire <= 0) return { required: 0, data: [] };

  let lo = 0, hi = 5000000, required = 0, bestData = [];
  for (let iter = 0; iter < 50; iter++) {
    const mid = (lo + hi) / 2;
    const data = projectScenario({
      taxContrib: mid * 0.8,
      retContrib: mid * 0.2,
      initialSpending: targetIncome,
    });
    const finalRow = data[data.length - 1];
    if (finalRow && finalRow.totalBalance > 0) {
      required = mid;
      bestData = data;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return { required, data: bestData };
}

// ── Risk score ──
function computeRiskScore(data) {
  if (!data.length) return { label:'—', level:'unknown' };
  const retRow  = data.find(r=>r.isRetired);
  const endRow  = data[data.length-1];
  const retTotal= retRow ? retRow.taxableStart+retRow.retirementStart : 0;
  const drawRate= retTotal>0&&retRow ? (retRow.spending/retTotal*100) : 0;
  let score = 0;
  if (drawRate>6) score+=3; else if(drawRate>4) score+=2; else if(drawRate>3) score+=1;
  if (endRow.totalBalance<=0) score+=4; else if(endRow.totalBalance<500000) score+=2;
  const realReturn = getVal('taxableReturn') - getVal('inflationRate');
  if (realReturn>8) score+=2; else if(realReturn>6) score+=1;
  if ((getVal('endAge')-getVal('retireAge'))>35) score+=1;
  if (score>=6) return { label:'Very High', level:'very-high' };
  if (score>=4) return { label:'High',      level:'high' };
  if (score>=2) return { label:'Moderate',  level:'moderate' };
  return              { label:'Low',        level:'low' };
}

// ── Auto-narrative ──
function generateNarrative(data) {
  if (!data.length) return 'Enter your values to see a personalized summary.';
  const retRow = data.find(r=>r.isRetired);
  const peak   = data.reduce((a,b)=>b.totalBalance>a.totalBalance?b:a,data[0]);
  const endRow = data[data.length-1];
  const retTotal = retRow ? retRow.taxableStart+retRow.retirementStart : 0;
  const drawRate = retTotal>0&&retRow ? ((retRow.spending/retTotal)*100).toFixed(1) : '?';
  const totalRMD = data.reduce((s,r)=>s+r.rmdGross,0);
  const risk = computeRiskScore(data);
  const plan = getStr('planName')||'This plan';
  const retireAge = getVal('retireAge');

  let txt = `${plan} reaches ${fmtShort(retTotal)} by retirement at age ${retireAge}, with an initial draw rate of ${drawRate}%. `;
  if (peak.totalBalance > retTotal) txt += `Portfolio peaks at ${fmtShort(peak.totalBalance)} at age ${peak.age}. `;
  if (endRow.totalBalance > 100000) txt += `The plan remains solvent with ${fmtShort(endRow.totalBalance)} at the end of the projection. `;
  else if (endRow.totalBalance <= 0) txt += `⚠️ Portfolio is projected to be depleted — consider adjusting contributions or spending. `;
  if (totalRMD > 0) txt += `RMDs starting at age 73 total ${fmtShort(totalRMD)} over the retirement period. `;
  txt += `Overall risk: ${risk.label}.`;
  return txt;
}

// ── Main run ──
function runModel() {
  if (currentMode === 'reverse') {
    const { required, data } = solveReversePlanning();
    projectionData = data.length ? data : projectScenario({ taxContrib: required*0.8, retContrib: required*0.2, initialSpending: getVal('targetIncome') });

    // Update banner
    const bannerVal = $('reverseBannerVal');
    const bannerSub = $('reverseBannerSub');
    if (bannerVal) bannerVal.textContent = required > 0 ? fmtShort(required) + ' / year' : '—';
    if (bannerSub) bannerSub.textContent = required > 0 ? `(${fmtShort(required*0.8)}/yr taxable + ${fmtShort(required*0.2)}/yr retirement)` : '';
  } else {
    projectionData = projectScenario();
  }

  // Run all scenarios
  if (typeof getAllScenarioData === 'function') {
    allScenarioData = getAllScenarioData();
  }

  // Stress scenarios for slideshow
  window.stressResults = {
    base:          projectionData,
    lowReturn:     projectScenario({ taxRate: Math.max(0,getVal('taxableReturn')/100-.02), retRate: Math.max(0,getVal('retirementReturn')/100-.02) }),
    highInflation: projectScenario({ inflation: getVal('inflationRate')/100+.02 }),
  };

  renderSummary();
  renderProjectionTable();
  renderAssumptions();
  renderChart();
  if (typeof renderSlideshow === 'function') renderSlideshow();
}

// ── Summary ──
function renderSummary() {
  if (!projectionData.length) return;
  const retRow  = projectionData.find(r=>r.isRetired);
  const peak    = projectionData.reduce((a,b)=>b.totalBalance>a.totalBalance?b:a,projectionData[0]);
  const endRow  = projectionData[projectionData.length-1];
  const totalRMD= projectionData.reduce((s,r)=>s+r.rmdGross,0);
  const retTotal= retRow ? retRow.taxableStart+retRow.retirementStart : projectionData[0].totalBalance;
  const totInc  = projectionData.filter(r=>r.isRetired).reduce((s,r)=>s+(r.income||0),0);
  const totSpend= projectionData.filter(r=>r.isRetired).reduce((s,r)=>s+r.spending,0);
  const incPct  = totSpend>0 ? Math.min(100,totInc/totSpend*100).toFixed(0)+'%' : '0%';
  const risk    = computeRiskScore(projectionData);

  $('val-retire').textContent   = fmtShort(retTotal);
  $('val-peak').textContent     = fmtShort(peak.totalBalance);
  $('val-peak-age').textContent = `Age ${peak.age}`;
  $('val-end').textContent      = fmtShort(endRow.totalBalance);
  $('val-rmds').textContent     = fmtShort(totalRMD);
  $('val-income-pct').textContent = incPct;
  const riskEl = $('val-risk');
  if (riskEl) { riskEl.textContent = risk.label; riskEl.className = `risk-badge risk-${risk.level}`; }
  const nt = $('narrative-text'); if (nt) nt.textContent = generateNarrative(projectionData);
}

// ── Projection Table ──
function renderProjectionTable() {
  const tbody = $('projectionBody'); if (!tbody) return;
  const retireAge = getVal('retireAge');
  tbody.innerHTML = '';
  projectionData.forEach(row => {
    const tr = document.createElement('tr');
    if (row.age === retireAge) tr.classList.add('retire-start');
    const pillCls = row.isRetired ? 'pill-ret' : 'pill-acc';
    const retCls  = row.netReturn>=0 ? 'v-pos' : 'v-neg';
    const contrib = row.contributions>0 ? `<span class="v-pos">${fmtRaw(row.contributions)}</span>` : `<span class="v-dim">—</span>`;
    const income  = (row.income||0)>0 ? `<span class="v-pos">${fmtRaw(row.income)}</span>` : `<span class="v-dim">—</span>`;
    const spend   = row.spending>0 ? `<span class="v-neg">(${fmtRaw(row.spending)})</span>` : `<span class="v-dim">—</span>`;
    const rmd     = row.rmdGross>0 ? `<span class="v-purple">${fmtRaw(row.rmdGross)}</span>` : `<span class="v-dim">—</span>`;
    const rmdTx   = row.rmdTax>0 ? `<span class="v-neg">(${fmtRaw(row.rmdTax)})</span>` : `<span class="v-dim">—</span>`;
    const retWdTx = row.retWdTax>0 ? `<span class="v-neg">(${fmtRaw(row.retWdTax)})</span>` : `<span class="v-dim">—</span>`;
    tr.innerHTML = `
      <td class="sticky-col">${row.age}</td>
      <td><span class="pill ${pillCls}">${row.phase}</span></td>
      <td>${fmtRaw(row.taxableStart)}</td><td>${fmtRaw(row.retirementStart)}</td>
      <td class="${retCls}">${fmtRaw(row.netReturn)}</td>
      <td>${contrib}</td><td>${income}</td><td>${spend}</td>
      <td class="col-rmd">${rmd}</td><td class="col-rmd">${rmdTx}</td><td class="col-rmd">${retWdTx}</td>
      <td>${fmtRaw(row.endTaxable)}</td><td>${fmtRaw(row.endRetirement)}</td>
      <td>${fmtRaw(row.totalBalance)}</td>`;
    tbody.appendChild(tr);
  });
}

// ── Assumptions ──
function renderAssumptions() {
  const tbody = $('assumptionsBody'); if (!tbody) return;
  tbody.innerHTML = '';
  const model = getStr('spendingModel');
  const modelLbl = {fixed:'Fixed + Inflation',pct:'% of Portfolio',guardrails:'Guardrails',curve:'Custom Curve'}[model]||model;
  const rows = [
    {section:'Time'},{label:'Starting Age',value:getVal('startAge')},{label:'Retirement Age',value:getVal('retireAge')},{label:'End Age',value:getVal('endAge')},
    {section:'Assets'},{label:'Starting Taxable Balance',value:fmtRaw(getVal('taxableBalance'))},{label:'Starting Retirement Balance',value:fmtRaw(getVal('retirementBalance'))},
    {section:'Growth'},{label:'Taxable Return Rate',value:fmtPct(getVal('taxableReturn'))},{label:'Retirement Return Rate',value:fmtPct(getVal('retirementReturn'))},{label:'Inflation Rate',value:fmtPct(getVal('inflationRate'))},
    {section:'Cash Flow'},{label:'Annual Taxable Contribution',value:fmtRaw(getVal('taxableContrib'))},{label:'Annual Retirement Contribution',value:fmtRaw(getVal('retirementContrib'))},{label:'Spending Model',value:modelLbl},{label:'Year-1 Spending',value:fmtRaw(getVal('initialSpending'))},
    {section:'Income Streams'},{label:'Social Security (monthly)',value:fmtRaw(getVal('ssMonthly'))},{label:'SS Start Age',value:getVal('ssStartAge')},{label:'Pension (monthly)',value:fmtRaw(getVal('pensionMonthly'))},{label:'Rental Income (annual)',value:fmtRaw(getVal('rentalAnnual'))},
    {section:'Taxes'},{label:'Ordinary Income Tax Rate',value:fmtPct(getVal('retirementTaxPct'))},{label:'Capital Gains Tax Rate',value:fmtPct(getVal('capitalGainsTaxPct'))},{label:'RMD Tax Rate',value:fmtPct(getVal('rmdTaxPct'))},{label:'Roth Conversions',value:getVal('rothConversion')?'Enabled':'Off'},
    {section:'Model Notes'},{label:'RMD',value:'SECURE 2.0 — starts age 73, IRS Uniform Lifetime Table'},{label:'Withdrawal order',value:'Taxable-first; retirement grossed up for tax'},
    {note:'For illustrative purposes only. Not financial advice.'},
  ];
  rows.forEach(r => {
    const tr = document.createElement('tr');
    if (r.section) { tr.classList.add('section-row'); tr.innerHTML=`<td colspan="2">${r.section}</td>`; }
    else if (r.note) { tr.classList.add('note-row'); tr.innerHTML=`<td colspan="2">${r.note}</td>`; }
    else { tr.innerHTML=`<td>${r.label}</td><td>${r.value}</td>`; }
    tbody.appendChild(tr);
  });
}

// ── Main chart — all scenarios overlaid ──
function renderChart() {
  const ctx = $('projectionChart')?.getContext('2d');
  if (!ctx) return;
  if (chart) chart.destroy();

  const labels = projectionData.map(r => r.age);
  const datasets = [];

  // All scenario lines
  if (allScenarioData && Object.keys(allScenarioData).length > 0) {
    Object.values(allScenarioData).forEach((sc, i) => {
      const isActive = sc.name === (scenarioStore?.find(s=>s.id===activeScenarioId)?.name);
      datasets.push({
        label: sc.name,
        data: (sc.data||[]).map(r => r.totalBalance),
        borderColor: sc.color,
        backgroundColor: isActive ? sc.color.replace(')', ',0.06)').replace('rgb','rgba') : 'transparent',
        borderWidth: isActive ? 2.5 : 1.5,
        fill: isActive,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        borderDash: isActive ? [] : [4,3],
      });
    });
  } else {
    // Fallback: single active scenario
    datasets.push({
      label: 'Total',
      data: projectionData.map(r => r.totalBalance),
      borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.06)',
      borderWidth: 2, fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4,
    });
  }

  // Reverse mode: add required savings line
  if (currentMode === 'reverse') {
    const req = parseFloat($('reverseBannerVal')?.textContent?.replace(/[^0-9.]/g,'')) || 0;
    if (req > 0) {
      // Annual savings cumulative line
      const cumSavings = labels.map((age, i) => {
        const retireAge = getVal('retireAge');
        if (age >= retireAge) return null;
        return Math.round(req * (i + 1));
      });
      datasets.push({
        label: 'Required Savings Trajectory',
        data: cumSavings,
        borderColor: '#10b981',
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderDash: [6,3],
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 3,
        spanGaps: false,
      });
    }
  }

  // Taxable + Retirement sub-lines for active scenario
  datasets.push(
    { label:'Taxable (active)', data:projectionData.map(r=>r.endTaxable), borderColor:'#15803d', backgroundColor:'transparent', borderWidth:1, borderDash:[3,3], tension:.3, pointRadius:0, pointHoverRadius:3 },
    { label:'Retirement (active)', data:projectionData.map(r=>r.endRetirement), borderColor:'#b45309', backgroundColor:'transparent', borderWidth:1, borderDash:[3,3], tension:.3, pointRadius:0, pointHoverRadius:3 },
  );

  chart = new Chart(ctx, {
    type:'line',
    data:{ labels, datasets },
    options:{
      responsive:true, maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{labels:{color:'#6b7280',font:{family:"'Inter',sans-serif",size:10},boxWidth:20,boxHeight:2,padding:12}},
        tooltip:{backgroundColor:'#111827',titleColor:'#f9fafb',bodyColor:'#d1d5db',borderColor:'#374151',borderWidth:1,padding:9,callbacks:{title:i=>`Age ${i[0].label}`,label:i=>` ${i.dataset.label}: ${fmtShort(i.raw)}`}},
      },
      scales:{
        x:{grid:{color:'#f3f4f6'},border:{display:false},ticks:{color:'#9ca3af',font:{family:"'JetBrains Mono',monospace",size:10},maxTicksLimit:14}},
        y:{grid:{color:'#f3f4f6'},border:{display:false},ticks:{color:'#9ca3af',font:{family:"'JetBrains Mono',monospace",size:10},callback:v=>fmtShort(v)}},
      },
    },
  });
}

// ── Tab switching ──
function switchMainTab(name) {
  document.querySelectorAll('.main-tab').forEach(t=>t.classList.toggle('active',t.dataset.mtab===name));
  document.querySelectorAll('.main-pane').forEach(p=>p.classList.toggle('active',p.id==='pane-'+name));
  if (name==='slideshow'&&typeof goToSlide==='function') goToSlide(currentSlide);
}
function switchTab(name) {
  document.querySelectorAll('.sheet-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===name));
  document.querySelectorAll('.tab-pane').forEach(p=>p.classList.toggle('active',p.id==='tab-'+name));
}

// ── Toast ──
let toastTimer;
function showToast(msg,type=''){
  const el=$('toast'); if(!el)return;
  el.textContent=msg; el.className='toast show'+(type?' '+type:'');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>{el.className='toast';},3200);
}

// ── Dark mode toggle ──
function toggleDarkMode() {
  const html     = document.documentElement;
  const isDark   = html.getAttribute('data-theme') === 'dark';
  const iconDark  = $('icon-dark');
  const iconLight = $('icon-light');
  if (isDark) {
    html.removeAttribute('data-theme');
    if (iconDark)  iconDark.style.display  = '';
    if (iconLight) iconLight.style.display = 'none';
  } else {
    html.setAttribute('data-theme', 'dark');
    if (iconDark)  iconDark.style.display  = 'none';
    if (iconLight) iconLight.style.display = '';
  }
  markDirty();
}

// ── Instructions ──
function openInstructions() { $('instructions-modal').style.display='flex'; }
function closeInstructions() { $('instructions-modal').style.display='none'; }
function toggleInstr(btn) {
  const content = btn.nextElementSibling;
  const arrow   = btn.querySelector('.instr-arrow');
  const open    = content.classList.toggle('open');
  if (arrow) arrow.textContent = open ? '▾' : '▸';
}

// ── Wire inputs ──
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input,select').forEach(el => {
    el.addEventListener('input', runModel);
    el.addEventListener('change', runModel);
  });
  const roth = $('rothConversion');
  if (roth) roth.addEventListener('change', () => {
    $('roth-inputs')?.classList.toggle('hidden', !roth.checked);
    runModel();
  });

  // Apply any state restored from a share link
  if (window._restoredMode && typeof setMode === 'function') {
    setMode(window._restoredMode);
    window._restoredMode = null;
  }

  // Init
  onSpendingModelChange();
  runModel();
});
