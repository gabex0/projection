// ── slideshow.js — Presentation Engine with 10 Themes, Fullscreen, PPTX ──

let currentSlide  = 0;
let currentTheme  = 'dark';
const slideCharts = {};

// ════ 10 THEMES ════
const THEMES = {
  dark:    { bg:'#0f172a', card:'#1e293b', border:'#334155', text:'#f1f5f9', muted:'#64748b', accent:'#3b82f6', grid:'rgba(255,255,255,0.055)', header:'#1e3a5f', subBg:'linear-gradient(135deg,#0f172a 0%,#1e1b4b 60%,#0f172a 100%)' },
  navy:    { bg:'#03122f', card:'#0a2040', border:'#1a3a6a', text:'#e2eaf5', muted:'#5a7fa0', accent:'#60a5fa', grid:'rgba(96,165,250,0.08)', header:'#051a4a', subBg:'linear-gradient(135deg,#03122f 0%,#0a2a5e 60%,#03122f 100%)' },
  slate:   { bg:'#1c1f26', card:'#252932', border:'#383e4d', text:'#d6dce8', muted:'#6b7590', accent:'#a78bfa', grid:'rgba(167,139,250,0.07)', header:'#2a2f3e', subBg:'linear-gradient(135deg,#1c1f26 0%,#2d3148 60%,#1c1f26 100%)' },
  earth:   { bg:'#1a1208', card:'#2a1e0e', border:'#4a3520', text:'#f0e5d0', muted:'#9a7f5a', accent:'#d97706', grid:'rgba(217,119,6,0.08)', header:'#3d2a0f', subBg:'linear-gradient(135deg,#1a1208 0%,#2e1d0a 60%,#1a1208 100%)' },
  ocean:   { bg:'#021220', card:'#052035', border:'#0a3d60', text:'#cce8f8', muted:'#4a8aac', accent:'#06b6d4', grid:'rgba(6,182,212,0.07)', header:'#03253d', subBg:'linear-gradient(135deg,#021220 0%,#02304c 60%,#021220 100%)' },
  forest:  { bg:'#081a0e', card:'#112518', border:'#1e4028', text:'#d0ead8', muted:'#4a8060', accent:'#22c55e', grid:'rgba(34,197,94,0.07)', header:'#0f2e17', subBg:'linear-gradient(135deg,#081a0e 0%,#0e2e18 60%,#081a0e 100%)' },
  rose:    { bg:'#1a0a12', card:'#2a1220', border:'#4a2035', text:'#f5d0e0', muted:'#9a5070', accent:'#f43f5e', grid:'rgba(244,63,94,0.07)', header:'#3d0f22', subBg:'linear-gradient(135deg,#1a0a12 0%,#2e0e1e 60%,#1a0a12 100%)' },
  mono:    { bg:'#0a0a0a', card:'#161616', border:'#2a2a2a', text:'#e8e8e8', muted:'#666666', accent:'#ffffff', grid:'rgba(255,255,255,0.05)', header:'#1a1a1a', subBg:'linear-gradient(135deg,#0a0a0a 0%,#1a1a1a 60%,#0a0a0a 100%)' },
  sunrise: { bg:'#1a0c00', card:'#2a1600', border:'#4a2c00', text:'#ffe8c0', muted:'#9a6430', accent:'#f97316', grid:'rgba(249,115,22,0.07)', header:'#3d1e00', subBg:'linear-gradient(135deg,#1a0c00 0%,#2e1a00 60%,#1a0c00 100%)' },
  emerald: { bg:'#041a12', card:'#07271c', border:'#0f4030', text:'#ccf0e0', muted:'#3a8060', accent:'#10b981', grid:'rgba(16,185,129,0.07)', header:'#063020', subBg:'linear-gradient(135deg,#041a12 0%,#063820 60%,#041a12 100%)' },
};

let T = THEMES.dark; // active theme shorthand

function applyTheme(name) {
  currentTheme = name;
  T = THEMES[name] || THEMES.dark;
  const vp = document.getElementById('slides-viewport');
  const sc = document.getElementById('slidesContainer');
  if (sc) { sc.style.setProperty('--sl-bg', T.bg); sc.style.setProperty('--sl-card', T.card); }
  if (vp) {
    vp.style.background = T.bg;
    document.querySelectorAll('.slide').forEach(s => s.style.background = T.bg);
    document.querySelectorAll('.slide-card').forEach(c => { c.style.background=T.card; c.style.borderColor=T.border; });
    document.querySelectorAll('.slide-title').forEach(e => e.style.color=T.text);
    document.querySelectorAll('.kpi-box').forEach(e => { e.style.background=T.card; e.style.borderColor=T.border; });
    document.querySelectorAll('.hstat').forEach(e => { e.style.background=T.card; e.style.borderColor=T.border; });
  }
  renderSlideshow();
}

// SL helper — always reads from T
function sl() { return T; }
function sfont(sz,mono){return{family:mono?"'JetBrains Mono',monospace":"'Inter',sans-serif",size:sz||10}}
function stip(){return{backgroundColor:T.card,titleColor:T.text,bodyColor:T.muted,borderColor:T.border,borderWidth:1,padding:10}}
function stk(mono=true){return{color:T.muted,font:sfont(10,mono)}}

function dChart(key){if(slideCharts[key]){slideCharts[key].destroy();delete slideCharts[key];}}

function safeD(){return typeof projectionData!=='undefined'&&projectionData.length>0;}
function ss(){
  if(!safeD())return{retireTotal:0,peakTotal:0,peakAge:'—',endTotal:0,accYears:0,retYears:0,totalContrib:0,totalSpend:0,totalRMD:0,totalRMDTax:0,totalRetTax:0,totalIncome:0,rmdStartAge:'—',retireAge:getVal('retireAge'),startAge:getVal('startAge'),endAge:getVal('endAge')};
  const retRow=projectionData.find(r=>r.isRetired)||projectionData[0];
  const peak=projectionData.reduce((a,b)=>b.totalBalance>a.totalBalance?b:a,projectionData[0]);
  const endRow=projectionData[projectionData.length-1];
  return{
    retireTotal:retRow.taxableStart+retRow.retirementStart,peakTotal:peak.totalBalance,peakAge:peak.age,
    endTotal:endRow.totalBalance,accYears:projectionData.filter(r=>!r.isRetired).length,
    retYears:projectionData.filter(r=>r.isRetired).length,
    totalContrib:projectionData.reduce((s,r)=>s+r.contributions,0),
    totalSpend:projectionData.filter(r=>r.isRetired).reduce((s,r)=>s+r.spending,0),
    totalRMD:projectionData.reduce((s,r)=>s+r.rmdGross,0),
    totalRMDTax:projectionData.reduce((s,r)=>s+r.rmdTax,0),
    totalRetTax:projectionData.reduce((s,r)=>s+r.retWdTax,0),
    totalIncome:projectionData.filter(r=>r.isRetired).reduce((s,r)=>s+(r.income||0),0),
    rmdStartAge:(projectionData.find(r=>r.rmdGross>0)||{}).age||'—',
    retireAge:getVal('retireAge'),startAge:getVal('startAge'),endAge:getVal('endAge'),
  };
}

// ══ SLIDE 0: COVER ══
function buildS0(){
  const s=ss();
  const plan=document.getElementById('planName')?.value||'Retirement Plan';
  const risk=safeD()?computeRiskScore(projectionData):{label:'—',level:'unknown'};
  const narr=safeD()?generateNarrative(projectionData):'Enter values to see your plan summary.';
  const isRev=typeof currentMode!=='undefined'&&currentMode==='reverse';
  const revVal=isRev?(document.getElementById('reverseBannerVal')?.textContent||'—'):'';
  return`<div style="background:${T.subBg};padding:1.6rem 2rem;height:100%;display:flex;flex-direction:column;justify-content:center;">
    <div style="font-size:.6rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${T.accent};margin-bottom:.3rem;">Retirement Projection Report</div>
    <div style="font-family:'Playfair Display',serif;font-size:2.1rem;font-weight:600;color:${T.text};line-height:1.15;margin-bottom:.45rem;">${plan}</div>
    <div style="font-size:.85rem;color:${T.muted};margin-bottom:1.8rem;">Ages ${s.startAge}–${s.endAge} &nbsp;·&nbsp; ${s.accYears} yrs accumulation &nbsp;·&nbsp; ${s.retYears} yrs retirement${isRev?' &nbsp;·&nbsp; Reverse Mode':''}</div>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.7rem;max-width:460px;margin-bottom:1.5rem;">
      ${[['At Retirement',fmtShort(s.retireTotal),'Age '+s.retireAge],['Peak Wealth',fmtShort(s.peakTotal),'Age '+s.peakAge],['End Balance',fmtShort(s.endTotal),'Age '+s.endAge],isRev?['Required Savings',revVal,'per year']:['Total RMDs',fmtShort(s.totalRMD),'Lifetime']].map(([l,v,sub])=>`
        <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:.8rem 1rem;">
          <div style="font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${T.muted};margin-bottom:.22rem;">${l}</div>
          <div style="font-family:'JetBrains Mono',monospace;font-size:1.25rem;font-weight:500;color:${T.accent};">${v}</div>
          <div style="font-size:.63rem;color:${T.muted};margin-top:.1rem;">${sub}</div>
        </div>`).join('')}
    </div>
    <div style="max-width:500px;font-size:.78rem;color:${T.muted};line-height:1.6;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:8px;padding:.8rem 1rem;margin-bottom:.9rem;">${narr}</div>
    <div style="display:inline-flex;align-items:center;gap:.4rem;font-size:.72rem;color:${T.muted};">
      <span class="risk-badge risk-${risk.level}" style="font-size:.72rem;">${risk.label} Risk</span>
    </div>
  </div>`;
}

// ══ SLIDE 1: WEALTH TRAJECTORY ══
function buildS1(){
  const s=ss();
  const scenNames = safeD()&&allScenarioData ? Object.values(allScenarioData).map(sc=>`<span style="display:inline-flex;align-items:center;gap:.3rem;font-size:.68rem;color:${sc.color};"><span style="width:12px;height:2px;background:${sc.color};display:inline-block;"></span>${sc.name}</span>`).join(' &nbsp; ') : '';
  return`<div class="slide-header" style="color:${T.text}"><div class="slide-eyebrow" style="color:${T.accent}">Overview</div><div class="slide-title" style="color:${T.text}">Total Wealth Trajectory</div><div class="slide-subtitle" style="color:${T.muted}">Ages ${s.startAge} – ${s.endAge} ${scenNames?'· '+scenNames:''}</div></div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.6rem;margin-bottom:.8rem;">
    ${[['Starting',fmtShort(getVal('taxableBalance')+getVal('retirementBalance')),'Age '+s.startAge,T.accent],['At Retirement',fmtShort(s.retireTotal),'Age '+s.retireAge,'#4ade80'],['Peak',fmtShort(s.peakTotal),'Age '+s.peakAge,'#fbbf24'],['End',fmtShort(s.endTotal),'Age '+s.endAge,T.accent]].map(([l,v,sub,c])=>`
    <div style="background:${T.card};border:1px solid ${T.border};border-radius:9px;padding:.7rem .9rem;">
      <div style="font-size:.58rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${T.muted};margin-bottom:.18rem;">${l}</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:1.05rem;font-weight:600;color:${c};">${v}</div>
      <div style="font-size:.61rem;color:${T.muted};margin-top:.1rem;">${sub}</div>
    </div>`).join('')}
  </div>
  <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:.9rem 1.1rem;flex:1;min-height:0;display:flex;flex-direction:column;">
    <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${T.muted};margin-bottom:.55rem;">All Scenarios — Total Balance Over Time</div>
    <canvas id="sc-wealth" style="flex:1;max-height:220px;"></canvas>
  </div>`;
}
function drawS1(){
  dChart('wealth');
  const ctx=document.getElementById('sc-wealth');if(!ctx||!safeD())return;
  const labels=projectionData.map(r=>r.age);
  const datasets=[];
  if(allScenarioData&&Object.keys(allScenarioData).length>0){
    Object.values(allScenarioData).forEach(sc=>{
      const isActive=sc.name===(scenarioStore?.find(s=>s.id===activeScenarioId)?.name);
      datasets.push({label:sc.name,data:(sc.data||[]).map(r=>r.totalBalance),borderColor:sc.color,backgroundColor:'transparent',borderWidth:isActive?2.5:1.5,borderDash:isActive?[]:[4,3],tension:.3,pointRadius:0,pointHoverRadius:4});
    });
  } else {
    datasets.push({label:'Total',data:projectionData.map(r=>r.totalBalance),borderColor:T.accent,backgroundColor:'transparent',borderWidth:2.5,tension:.3,pointRadius:0,pointHoverRadius:4});
  }
  slideCharts['wealth']=new Chart(ctx,{type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:T.muted,font:sfont(10),boxWidth:20,boxHeight:2,padding:12}},tooltip:{...stip(),callbacks:{title:i=>`Age ${i[0].label}`,label:i=>` ${i.dataset.label}: ${fmtShort(i.raw)}`}}},scales:{x:{grid:{color:T.grid},ticks:stk()},y:{grid:{color:T.grid},ticks:{...stk(true),callback:v=>fmtShort(v)}}}}});
}

// ══ SLIDE 2: TIMELINE ══
function buildS2(){
  const s=ss();
  const milestones=[];
  if(safeD()){
    const rmdRow=projectionData.find(r=>r.rmdGross>0);
    const peak=projectionData.reduce((a,b)=>b.totalBalance>a.totalBalance?b:a,projectionData[0]);
    const depRow=projectionData.find(r=>r.endTaxable<1000&&r.isRetired);
    milestones.push({age:s.startAge,label:'Start',color:T.accent});
    milestones.push({age:s.retireAge,label:'Retirement',color:'#fbbf24'});
    if(rmdRow)milestones.push({age:rmdRow.age,label:'RMDs Begin',color:'#c084fc'});
    milestones.push({age:peak.age,label:'Peak',color:'#4ade80'});
    if(depRow)milestones.push({age:depRow.age,label:'Taxable Depleted',color:'#f87171'});
    milestones.push({age:s.endAge,label:'End',color:T.muted});
  }
  milestones.sort((a,b)=>a.age-b.age);
  const span=s.endAge-s.startAge||1;
  const W=520,midY=45;
  let svg=`<svg viewBox="0 0 ${W} 90" style="width:100%;overflow:visible;"><line x1="20" y1="${midY}" x2="${W-20}" y2="${midY}" stroke="${T.border}" stroke-width="2"/>`;
  milestones.forEach((m,i)=>{
    const x=20+(m.age-s.startAge)/span*(W-40);
    const up=i%2===0;
    const ty=up?midY-24:midY+24;
    svg+=`<circle cx="${x}" cy="${midY}" r="7" fill="${m.color}" stroke="${T.bg}" stroke-width="2"/>`;
    svg+=`<line x1="${x}" y1="${midY+(up?-8:8)}" x2="${x}" y2="${ty+(up?10:-10)}" stroke="${m.color}" stroke-width="1" stroke-dasharray="3,2"/>`;
    svg+=`<text x="${x}" y="${ty+(up?0:14)}" text-anchor="middle" fill="${m.color}" font-size="10" font-family="Inter,sans-serif" font-weight="700">${m.age}</text>`;
    svg+=`<text x="${x}" y="${ty+(up?12:26)}" text-anchor="middle" fill="${T.muted}" font-size="8.5" font-family="Inter,sans-serif">${m.label}</text>`;
  });
  svg+=`</svg>`;
  const tableRows=milestones.map(m=>{const row=safeD()?projectionData.find(r=>r.age===m.age):null;return`<tr><td style="color:${m.color}">${m.label}</td><td style="color:${m.color}">${m.age}</td><td style="font-weight:700;color:${T.text}">${row?fmtShort(row.totalBalance):'—'}</td></tr>`;}).join('');
  return`<div style="color:${T.text}">
    <div class="slide-eyebrow" style="color:${T.accent}">Plan Timeline</div>
    <div class="slide-title" style="color:${T.text};font-family:'Playfair Display',serif;margin-bottom:.2rem;">Key Life Milestones</div>
    <div style="color:${T.muted};font-size:.75rem;margin-bottom:.9rem;">Automatically calculated from your inputs</div>
  </div>
  <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:1rem;margin-bottom:.8rem;">
    <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${T.muted};margin-bottom:.5rem;">Financial Timeline</div>
    ${svg}
  </div>
  <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:.9rem;flex:1;">
    <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${T.muted};margin-bottom:.5rem;">Milestone Balances</div>
    <table class="slide-data-table" style="--sl-text:${T.muted};--sl-bold:${T.text}"><thead><tr><th>Event</th><th>Age</th><th>Total Balance</th></tr></thead><tbody>${tableRows}</tbody></table>
  </div>`;
}

// ══ SLIDE 3: ACCUMULATION ══
function buildS3(){
  const s=ss();
  const growth=Math.max(0,s.retireTotal-(getVal('taxableBalance')+getVal('retirementBalance'))-s.totalContrib);
  return`<div><div class="slide-eyebrow" style="color:${T.accent}">Phase 1</div><div class="slide-title" style="color:${T.text};font-family:'Playfair Display',serif;">Accumulation Years</div><div style="color:${T.muted};font-size:.75rem;margin-bottom:.9rem;">Ages ${s.startAge}–${s.retireAge-1} · ${s.accYears} years of growth</div></div>
  <div style="display:flex;gap:.6rem;margin-bottom:.8rem;">
    ${[['Starting Balance',fmtShort(getVal('taxableBalance')+getVal('retirementBalance'))],['Total Contributions',fmtShort(s.totalContrib)],['Investment Growth',fmtShort(growth)],['At Retirement',fmtShort(s.retireTotal)]].map(([l,v])=>`<div style="background:${T.card};border:1px solid ${T.border};border-radius:7px;padding:.55rem .8rem;flex:1;"><div style="font-size:.57rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${T.muted};margin-bottom:.1rem;">${l}</div><div style="font-family:'JetBrains Mono',monospace;font-size:.85rem;font-weight:500;color:${T.text};">${v}</div></div>`).join('')}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.9rem;flex:1;min-height:0;">
    <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:.9rem;display:flex;flex-direction:column;"><div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${T.muted};margin-bottom:.55rem;">Growth by Year</div><canvas id="sc-accum" style="flex:1;max-height:180px;"></canvas></div>
    <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:.9rem;display:flex;flex-direction:column;"><div style="font-size:.63rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${T.muted};margin-bottom:.55rem;">Retirement Portfolio Composition</div><canvas id="sc-accum-pie" style="flex:1;max-height:180px;"></canvas></div>
  </div>`;
}
function drawS3(){
  dChart('accum');dChart('accum-pie');
  const accRows=safeD()?projectionData.filter(r=>!r.isRetired):[];
  const ctx1=document.getElementById('sc-accum');
  if(ctx1&&accRows.length){slideCharts['accum']=new Chart(ctx1,{type:'bar',data:{labels:accRows.map(r=>r.age),datasets:[{label:'Taxable',data:accRows.map(r=>r.endTaxable),backgroundColor:T.accent+'26',borderColor:T.accent,borderWidth:1,borderRadius:2,stack:'a'},{label:'Retirement',data:accRows.map(r=>r.endRetirement),backgroundColor:'rgba(251,191,36,.14)',borderColor:'#fbbf24',borderWidth:1,borderRadius:2,stack:'a'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:T.muted,font:sfont(10),boxWidth:12,boxHeight:12,padding:10}},tooltip:{...stip(),callbacks:{title:i=>`Age ${i[0].label}`,label:i=>` ${i.dataset.label}: ${fmtShort(i.raw)}`}}},scales:{x:{stacked:true,grid:{color:T.grid},ticks:stk()},y:{stacked:true,grid:{color:T.grid},ticks:{...stk(true),callback:v=>fmtShort(v)}}}}});}
  const ctx2=document.getElementById('sc-accum-pie');
  const s=ss();
  if(ctx2){
    const sT=getVal('taxableBalance'),sR=getVal('retirementBalance'),tc=getVal('taxableContrib')*s.accYears,rc=getVal('retirementContrib')*s.accYears,g=Math.max(0,s.retireTotal-sT-sR-tc-rc);
    slideCharts['accum-pie']=new Chart(ctx2,{type:'doughnut',data:{labels:['Starting Taxable','Starting Retirement','Taxable Contribs','Ret. Contribs','Investment Growth'],datasets:[{data:[sT,sR,tc,rc,g],backgroundColor:[T.accent+'40','rgba(251,191,36,.25)',T.accent+'80','rgba(251,191,36,.5)','rgba(74,222,128,.4)'],borderColor:T.bg,borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:T.muted,font:sfont(9.5),padding:7,boxWidth:10}},tooltip:{...stip(),callbacks:{label:i=>` ${i.label}: ${fmtShort(i.raw)}`}}}}});
  }
}

// ══ SLIDE 4: RETIREMENT ══
function buildS4(){
  const s=ss();
  const retRows=safeD()?projectionData.filter(r=>r.isRetired):[];
  const keyAges=[s.retireAge,s.retireAge+5,s.retireAge+10,73,80,85,s.endAge].filter((a,i,arr)=>a>=s.retireAge&&a<=s.endAge&&arr.indexOf(a)===i).sort((a,b)=>a-b).slice(0,7);
  const tRows=keyAges.map(age=>projectionData.find(r=>r.age===age)).filter(Boolean).map(r=>`<tr><td style="color:${T.muted}">${r.age}</td><td style="color:#f87171">${r.spending>0?fmtShort(r.spending):'—'}</td><td style="color:#4ade80">${(r.income||0)>0?fmtShort(r.income):'—'}</td><td style="color:#c084fc">${r.rmdGross>0?fmtShort(r.rmdGross):'—'}</td><td style="font-weight:700;color:${T.text}">${fmtShort(r.totalBalance)}</td></tr>`).join('');
  const incPct=s.totalSpend>0?Math.min(100,(s.totalIncome||0)/s.totalSpend*100).toFixed(0)+'%':'0%';
  return`<div><div class="slide-eyebrow" style="color:${T.accent}">Phase 2</div><div class="slide-title" style="color:${T.text};font-family:'Playfair Display',serif;">Retirement Cash Flow</div><div style="color:${T.muted};font-size:.75rem;margin-bottom:.8rem;">Ages ${s.retireAge}–${s.endAge} · ${s.retYears} years</div></div>
  <div style="display:flex;gap:.6rem;margin-bottom:.8rem;">${[['Year-1 Spending',fmtShort(getVal('initialSpending'))],['Total Spending',fmtShort(s.totalSpend)],['Income Covered',incPct],['Legacy Balance',fmtShort(s.endTotal)]].map(([l,v])=>`<div style="background:${T.card};border:1px solid ${T.border};border-radius:7px;padding:.55rem .8rem;flex:1;"><div style="font-size:.57rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${T.muted};margin-bottom:.1rem;">${l}</div><div style="font-family:'JetBrains Mono',monospace;font-size:.85rem;font-weight:500;color:${T.text};">${v}</div></div>`).join('')}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.9rem;flex:1;min-height:0;">
    <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:.9rem;overflow:auto;"><div style="font-size:.63rem;font-weight:700;text-transform:uppercase;color:${T.muted};margin-bottom:.5rem;">Key Years</div><table class="slide-data-table"><thead><tr><th>Age</th><th>Spending</th><th>Income</th><th>RMD</th><th>Balance</th></tr></thead><tbody>${tRows}</tbody></table></div>
    <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:.9rem;display:flex;flex-direction:column;"><div style="font-size:.63rem;font-weight:700;text-transform:uppercase;color:${T.muted};margin-bottom:.55rem;">Balance During Retirement</div><canvas id="sc-ret-bal" style="flex:1;max-height:180px;"></canvas></div>
  </div>`;
}
function drawS4(){
  dChart('ret-bal');
  const ctx=document.getElementById('sc-ret-bal');if(!ctx||!safeD())return;
  const retRows=projectionData.filter(r=>r.isRetired);
  slideCharts['ret-bal']=new Chart(ctx,{type:'line',data:{labels:retRows.map(r=>r.age),datasets:[{label:'Total',data:retRows.map(r=>r.totalBalance),borderColor:T.accent,backgroundColor:T.accent+'18',borderWidth:2,fill:true,tension:.3,pointRadius:0,pointHoverRadius:4},{label:'Taxable',data:retRows.map(r=>r.endTaxable),borderColor:'#4ade80',backgroundColor:'transparent',borderWidth:1.2,borderDash:[4,3],tension:.3,pointRadius:0,pointHoverRadius:3},{label:'Retirement',data:retRows.map(r=>r.endRetirement),borderColor:'#fbbf24',backgroundColor:'transparent',borderWidth:1.2,borderDash:[4,3],tension:.3,pointRadius:0,pointHoverRadius:3}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:T.muted,font:sfont(10),boxWidth:16,boxHeight:2,padding:10}},tooltip:{...stip(),callbacks:{title:i=>`Age ${i[0].label}`,label:i=>` ${i.dataset.label}: ${fmtShort(i.raw)}`}}},scales:{x:{grid:{color:T.grid},ticks:stk()},y:{grid:{color:T.grid},ticks:{...stk(true),callback:v=>fmtShort(v)}}}}});
}

// ══ SLIDE 5: REVERSE PLANNING (shown when in reverse mode, else RMDs) ══
function buildS5(){
  const isRev=typeof currentMode!=='undefined'&&currentMode==='reverse';
  if(isRev) return buildReverseSlide();
  return buildRMDSlide();
}
function drawS5(){
  const isRev=typeof currentMode!=='undefined'&&currentMode==='reverse';
  if(isRev) drawReverseSlide(); else drawRMDSlide();
}

function buildReverseSlide(){
  const target=getVal('targetIncome');
  const revVal=document.getElementById('reverseBannerVal')?.textContent||'—';
  const revSub=document.getElementById('reverseBannerSub')?.textContent||'';
  const s=ss();
  return`<div><div class="slide-eyebrow" style="color:${T.accent}">Reverse Planning</div><div class="slide-title" style="color:${T.text};font-family:'Playfair Display',serif;">Required Savings Analysis</div><div style="color:${T.muted};font-size:.75rem;margin-bottom:.9rem;">Solving for savings rate needed to sustain target retirement income</div></div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.6rem;margin-bottom:.8rem;">
    ${[['Target Income',fmtShort(target),'per year'],['Required Savings',revVal,'per year'],['Taxable Portion',revVal!=='—'?fmtShort(parseFloat(revVal.replace(/[^0-9.]/g,''))*1e6*.8||0):'—','80% of savings'],['Retirement Portion',revVal!=='—'?fmtShort(parseFloat(revVal.replace(/[^0-9.]/g,''))*1e6*.2||0):'—','20% of savings']].map(([l,v,sub])=>`<div style="background:${T.card};border:1px solid ${T.border};border-radius:9px;padding:.7rem .9rem;"><div style="font-size:.58rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${T.muted};margin-bottom:.18rem;">${l}</div><div style="font-family:'JetBrains Mono',monospace;font-size:1rem;font-weight:600;color:${T.accent};">${v}</div><div style="font-size:.61rem;color:${T.muted};margin-top:.1rem;">${sub}</div></div>`).join('')}
  </div>
  <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:.9rem;flex:1;display:flex;flex-direction:column;"><div style="font-size:.63rem;font-weight:700;text-transform:uppercase;color:${T.muted};margin-bottom:.55rem;">Portfolio Trajectory (Required Savings Scenario)</div><canvas id="sc-reverse" style="flex:1;max-height:220px;"></canvas></div>`;
}
function drawReverseSlide(){
  dChart('reverse');
  const ctx=document.getElementById('sc-reverse');if(!ctx||!safeD())return;
  const labels=projectionData.map(r=>r.age);
  slideCharts['reverse']=new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'Portfolio Balance',data:projectionData.map(r=>r.totalBalance),borderColor:T.accent,backgroundColor:T.accent+'18',borderWidth:2.5,fill:true,tension:.3,pointRadius:0,pointHoverRadius:4},{label:'Taxable',data:projectionData.map(r=>r.endTaxable),borderColor:'#4ade80',backgroundColor:'transparent',borderWidth:1.2,borderDash:[4,3],tension:.3,pointRadius:0,pointHoverRadius:3},{label:'Retirement',data:projectionData.map(r=>r.endRetirement),borderColor:'#fbbf24',backgroundColor:'transparent',borderWidth:1.2,borderDash:[4,3],tension:.3,pointRadius:0,pointHoverRadius:3}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:T.muted,font:sfont(10),boxWidth:16,boxHeight:2,padding:12}},tooltip:{...stip(),callbacks:{title:i=>`Age ${i[0].label}`,label:i=>` ${i.dataset.label}: ${fmtShort(i.raw)}`}}},scales:{x:{grid:{color:T.grid},ticks:stk()},y:{grid:{color:T.grid},ticks:{...stk(true),callback:v=>fmtShort(v)}}}}});
}

function buildRMDSlide(){
  const s=ss();
  return`<div><div class="slide-eyebrow" style="color:${T.accent}">RMDs</div><div class="slide-title" style="color:${T.text};font-family:'Playfair Display',serif;">Required Minimum Distributions</div><div style="color:${T.muted};font-size:.75rem;margin-bottom:.8rem;">SECURE 2.0 — begins age 73 · IRS Uniform Lifetime Table</div></div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.6rem;margin-bottom:.8rem;">
    ${[['RMD Start',s.rmdStartAge,'Age'],['Total RMDs',fmtShort(s.totalRMD),'Gross'],['RMD Tax',fmtShort(s.totalRMDTax),'At '+fmtPct(getVal('rmdTaxPct'))],['After-Tax',fmtShort(s.totalRMD-s.totalRMDTax),'To taxable']].map(([l,v,sub])=>`<div style="background:${T.card};border:1px solid ${T.border};border-radius:9px;padding:.7rem .9rem;"><div style="font-size:.58rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${T.muted};margin-bottom:.18rem;">${l}</div><div style="font-family:'JetBrains Mono',monospace;font-size:1rem;font-weight:600;color:#c084fc;">${v}</div><div style="font-size:.61rem;color:${T.muted};margin-top:.1rem;">${sub}</div></div>`).join('')}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.9rem;flex:1;min-height:0;">
    <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:.9rem;display:flex;flex-direction:column;"><div style="font-size:.63rem;font-weight:700;text-transform:uppercase;color:${T.muted};margin-bottom:.55rem;">Annual RMD vs Spending</div><canvas id="sc-rmd-bar" style="flex:1;max-height:180px;"></canvas></div>
    <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:.9rem;display:flex;flex-direction:column;"><div style="font-size:.63rem;font-weight:700;text-transform:uppercase;color:${T.muted};margin-bottom:.55rem;">RMD Breakdown</div><canvas id="sc-rmd-pie" style="flex:1;max-height:180px;"></canvas></div>
  </div>`;
}
function drawRMDSlide(){
  dChart('rmd-bar');dChart('rmd-pie');
  const retRows=safeD()?projectionData.filter(r=>r.isRetired):[];
  const ctx1=document.getElementById('sc-rmd-bar');
  if(ctx1&&retRows.length)slideCharts['rmd-bar']=new Chart(ctx1,{type:'bar',data:{labels:retRows.map(r=>r.age),datasets:[{label:'Spending',data:retRows.map(r=>r.spending),backgroundColor:'rgba(248,113,113,.14)',borderColor:'#f87171',borderWidth:1,borderRadius:2},{label:'RMD Gross',data:retRows.map(r=>r.rmdGross),backgroundColor:'rgba(192,132,252,.14)',borderColor:'#c084fc',borderWidth:1,borderRadius:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:T.muted,font:sfont(10),boxWidth:12,boxHeight:12,padding:10}},tooltip:{...stip(),callbacks:{title:i=>`Age ${i[0].label}`,label:i=>` ${i.dataset.label}: ${fmtShort(i.raw)}`}}},scales:{x:{grid:{color:T.grid},ticks:stk()},y:{grid:{color:T.grid},ticks:{...stk(true),callback:v=>fmtShort(v)}}}}});
  const ctx2=document.getElementById('sc-rmd-pie');const s=ss();
  if(ctx2)slideCharts['rmd-pie']=new Chart(ctx2,{type:'doughnut',data:{labels:['After-Tax','RMD Tax'],datasets:[{data:[Math.max(1,s.totalRMD-s.totalRMDTax),s.totalRMDTax],backgroundColor:['rgba(192,132,252,.25)','rgba(248,113,113,.25)'],borderColor:['#c084fc','#f87171'],borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:T.muted,font:sfont(10),padding:8,boxWidth:10}},tooltip:{...stip(),callbacks:{label:i=>` ${i.label}: ${fmtShort(i.raw)}`}}}}});
}

// ══ SLIDE 6: TAX ══
function buildS6(){
  const s=ss();const tot=s.totalRMDTax+s.totalRetTax;
  return`<div><div class="slide-eyebrow" style="color:${T.accent}">Tax Impact</div><div class="slide-title" style="color:${T.text};font-family:'Playfair Display',serif;">Lifetime Tax Analysis</div><div style="color:${T.muted};font-size:.75rem;margin-bottom:.8rem;">All taxes paid across retirement</div></div>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.6rem;margin-bottom:.8rem;">${[['Ordinary Rate',fmtPct(getVal('retirementTaxPct')),'Retirement WDs'],['Cap Gains Rate',fmtPct(getVal('capitalGainsTaxPct')),'Taxable account'],['Total Tax',fmtShort(tot),'All years'],['Tax Drag',s.totalSpend>0?((tot/s.totalSpend)*100).toFixed(1)+'%':'—','% of spending']].map(([l,v,sub])=>`<div style="background:${T.card};border:1px solid ${T.border};border-radius:9px;padding:.7rem .9rem;"><div style="font-size:.58rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${T.muted};margin-bottom:.18rem;">${l}</div><div style="font-family:'JetBrains Mono',monospace;font-size:1rem;font-weight:600;color:#f87171;">${v}</div><div style="font-size:.61rem;color:${T.muted};margin-top:.1rem;">${sub}</div></div>`).join('')}</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.9rem;flex:1;min-height:0;">
    <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:.9rem;display:flex;flex-direction:column;"><div style="font-size:.63rem;font-weight:700;text-transform:uppercase;color:${T.muted};margin-bottom:.55rem;">Annual Tax Breakdown</div><canvas id="sc-tax-bar" style="flex:1;max-height:180px;"></canvas></div>
    <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:.9rem;display:flex;flex-direction:column;"><div style="font-size:.63rem;font-weight:700;text-transform:uppercase;color:${T.muted};margin-bottom:.55rem;">Tax Composition</div><canvas id="sc-tax-pie" style="flex:1;max-height:180px;"></canvas></div>
  </div>`;
}
function drawS6(){
  dChart('tax-bar');dChart('tax-pie');
  const retRows=safeD()?projectionData.filter(r=>r.isRetired):[];
  const ctx1=document.getElementById('sc-tax-bar');
  if(ctx1&&retRows.length)slideCharts['tax-bar']=new Chart(ctx1,{type:'bar',data:{labels:retRows.map(r=>r.age),datasets:[{label:'RMD Tax',data:retRows.map(r=>r.rmdTax),backgroundColor:'rgba(192,132,252,.14)',borderColor:'#c084fc',borderWidth:1,borderRadius:2,stack:'t'},{label:'Ret. WD Tax',data:retRows.map(r=>r.retWdTax),backgroundColor:'rgba(248,113,113,.14)',borderColor:'#f87171',borderWidth:1,borderRadius:2,stack:'t'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:T.muted,font:sfont(10),boxWidth:12,boxHeight:12,padding:10}},tooltip:{...stip(),callbacks:{title:i=>`Age ${i[0].label}`,label:i=>` ${i.dataset.label}: ${fmtShort(i.raw)}`}}},scales:{x:{stacked:true,grid:{color:T.grid},ticks:stk()},y:{stacked:true,grid:{color:T.grid},ticks:{...stk(true),callback:v=>fmtShort(v)}}}}});
  const ctx2=document.getElementById('sc-tax-pie');const s=ss();
  if(ctx2)slideCharts['tax-pie']=new Chart(ctx2,{type:'doughnut',data:{labels:['RMD Tax','Ret. WD Tax'],datasets:[{data:[s.totalRMDTax||1,s.totalRetTax||1],backgroundColor:['rgba(192,132,252,.25)','rgba(248,113,113,.25)'],borderColor:['#c084fc','#f87171'],borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{color:T.muted,font:sfont(10),padding:8,boxWidth:10}},tooltip:{...stip(),callbacks:{label:i=>` ${i.label}: ${fmtShort(i.raw)}`}}}}});
}

// ══ SLIDE 7: STRESS TEST ══
function buildS7(){
  const s=ss();
  const stress=window.stressResults||{};
  const scenarios=[{key:'base',label:'Base Case',color:T.accent},{key:'lowReturn',label:'Returns −2%',color:'#fbbf24'},{key:'highInflation',label:'Inflation +2%',color:'#f87171'}];
  const ends=scenarios.map(sc=>{const d=stress[sc.key]||[];const e=d[d.length-1];return{...sc,endBal:e?.totalBalance||0};});
  const tRows=ends.map(sc=>`<tr><td style="color:${sc.color}">${sc.label}</td><td style="font-weight:700;color:${T.text}">${fmtShort(sc.endBal)}</td><td style="color:${sc.endBal>0?'#4ade80':'#f87171'}">${sc.endBal>0?'✓ Solvent':'⚠ Depleted'}</td></tr>`).join('');
  return`<div><div class="slide-eyebrow" style="color:${T.accent}">Risk Analysis</div><div class="slide-title" style="color:${T.text};font-family:'Playfair Display',serif;">Stress Test Scenarios</div><div style="color:${T.muted};font-size:.75rem;margin-bottom:.8rem;">Portfolio performance under adverse conditions</div></div>
  <div style="display:flex;gap:.6rem;margin-bottom:.8rem;">${ends.map(sc=>`<div style="background:${T.card};border:1px solid ${T.border};border-radius:7px;padding:.55rem .8rem;flex:1;"><div style="font-size:.57rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${sc.color};margin-bottom:.1rem;">${sc.label}</div><div style="font-family:'JetBrains Mono',monospace;font-size:.85rem;font-weight:500;color:${T.text};">${fmtShort(sc.endBal)}</div><div style="font-size:.61rem;color:${sc.endBal>0?'#4ade80':'#f87171'};margin-top:.1rem;">${sc.endBal>0?'Solvent':'Depleted'}</div></div>`).join('')}</div>
  <div style="display:grid;grid-template-columns:3fr 2fr;gap:.9rem;flex:1;min-height:0;">
    <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:.9rem;display:flex;flex-direction:column;"><div style="font-size:.63rem;font-weight:700;text-transform:uppercase;color:${T.muted};margin-bottom:.55rem;">Scenario Comparison</div><canvas id="sc-stress" style="flex:1;max-height:200px;"></canvas></div>
    <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:.9rem;display:flex;flex-direction:column;justify-content:space-between;"><div style="font-size:.63rem;font-weight:700;text-transform:uppercase;color:${T.muted};margin-bottom:.5rem;">Results</div><table class="slide-data-table"><thead><tr><th>Scenario</th><th>End Bal.</th><th>Status</th></tr></thead><tbody>${tRows}</tbody></table><div style="font-size:.64rem;color:${T.muted};line-height:1.5;margin-top:.6rem;">Shocks applied to returns and inflation. All other inputs held constant. For illustrative purposes only.</div></div>
  </div>`;
}
function drawS7(){
  dChart('stress');
  const ctx=document.getElementById('sc-stress');if(!ctx)return;
  const stress=window.stressResults||{};
  const labels=(stress.base||projectionData||[]).map(r=>r.age);
  const sc=[{key:'base',label:'Base',color:T.accent,w:2.5},{key:'lowReturn',label:'Returns −2%',color:'#fbbf24',w:1.5},{key:'highInflation',label:'Inflation +2%',color:'#f87171',w:1.5}];
  const datasets=sc.map(s=>({label:s.label,data:(stress[s.key]||[]).map(r=>r.totalBalance),borderColor:s.color,backgroundColor:'transparent',borderWidth:s.w,borderDash:s.w<2?[4,3]:[],tension:.3,pointRadius:0,pointHoverRadius:4})).filter(d=>d.data.length>0);
  slideCharts['stress']=new Chart(ctx,{type:'line',data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:T.muted,font:sfont(10),boxWidth:16,boxHeight:2,padding:12}},tooltip:{...stip(),callbacks:{title:i=>`Age ${i[0].label}`,label:i=>` ${i.dataset.label}: ${fmtShort(i.raw)}`}}},scales:{x:{grid:{color:T.grid},ticks:stk()},y:{grid:{color:T.grid},ticks:{...stk(true),callback:v=>fmtShort(v)}}}}});
}

// ══ SLIDE 8: SUMMARY ══
function buildS8(){
  const s=ss();const tot=s.totalRMDTax+s.totalRetTax;
  const netRet=safeD()?projectionData.reduce((sum,r)=>sum+r.netReturn,0):0;
  return`<div><div class="slide-eyebrow" style="color:${T.accent}">Summary</div><div class="slide-title" style="color:${T.text};font-family:'Playfair Display',serif;">Legacy & Portfolio Summary</div><div style="color:${T.muted};font-size:.75rem;margin-bottom:.8rem;">Complete financial lifetime overview</div></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:.9rem;flex:1;min-height:0;">
    <div style="display:flex;flex-direction:column;gap:.8rem;overflow:auto;">
      <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:.9rem;">
        <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;color:${T.muted};margin-bottom:.5rem;">Lifetime Cash Flows</div>
        <table class="slide-data-table"><thead><tr><th>Category</th><th>Amount</th></tr></thead><tbody>
          <tr><td>Starting Wealth</td><td style="font-weight:700;color:${T.text}">${fmtShort(getVal('taxableBalance')+getVal('retirementBalance'))}</td></tr>
          <tr><td>Total Contributions</td><td style="color:#4ade80">${fmtShort(s.totalContrib)}</td></tr>
          <tr><td>Investment Returns</td><td style="color:#4ade80">${fmtShort(netRet)}</td></tr>
          <tr><td>Guaranteed Income</td><td style="color:#4ade80">${fmtShort(s.totalIncome||0)}</td></tr>
          <tr><td>Total Spending</td><td style="color:#f87171">${fmtShort(s.totalSpend)}</td></tr>
          <tr><td>Total RMDs</td><td style="color:#c084fc">${fmtShort(s.totalRMD)}</td></tr>
          <tr><td>Total Taxes</td><td style="color:#f87171">${fmtShort(tot)}</td></tr>
          <tr><td><strong>Final Balance</strong></td><td style="font-weight:700;color:${T.accent}">${fmtShort(s.endTotal)}</td></tr>
        </tbody></table>
      </div>
      <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:.9rem;">
        <div style="font-size:.63rem;font-weight:700;text-transform:uppercase;color:${T.muted};margin-bottom:.5rem;">Key Assumptions</div>
        <table class="slide-data-table"><thead><tr><th>Input</th><th>Value</th></tr></thead><tbody>
          <tr><td>Taxable Return</td><td>${fmtPct(getVal('taxableReturn'))}</td></tr>
          <tr><td>Retirement Return</td><td>${fmtPct(getVal('retirementReturn'))}</td></tr>
          <tr><td>Inflation</td><td>${fmtPct(getVal('inflationRate'))}</td></tr>
          <tr><td>Ordinary Income Tax</td><td>${fmtPct(getVal('retirementTaxPct'))}</td></tr>
          <tr><td>RMD Tax Rate</td><td>${fmtPct(getVal('rmdTaxPct'))}</td></tr>
        </tbody></table>
      </div>
    </div>
    <div style="background:${T.card};border:1px solid ${T.border};border-radius:10px;padding:.9rem;display:flex;flex-direction:column;"><div style="font-size:.63rem;font-weight:700;text-transform:uppercase;color:${T.muted};margin-bottom:.55rem;">Portfolio Mix Over Time</div><canvas id="sc-legacy" style="flex:1;max-height:none;"></canvas></div>
  </div>`;
}
function drawS8(){
  dChart('legacy');
  const ctx=document.getElementById('sc-legacy');if(!ctx||!safeD())return;
  const step=Math.max(1,Math.floor(projectionData.length/22));
  const samp=projectionData.filter((_,i)=>i%step===0||i===projectionData.length-1);
  slideCharts['legacy']=new Chart(ctx,{type:'bar',data:{labels:samp.map(r=>r.age),datasets:[{label:'Taxable',data:samp.map(r=>r.endTaxable),backgroundColor:T.accent+'26',borderColor:T.accent,borderWidth:1,borderRadius:2,stack:'s'},{label:'Retirement',data:samp.map(r=>r.endRetirement),backgroundColor:'rgba(251,191,36,.18)',borderColor:'#fbbf24',borderWidth:1,borderRadius:2,stack:'s'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:T.muted,font:sfont(10),boxWidth:12,boxHeight:12,padding:10}},tooltip:{...stip(),callbacks:{title:i=>`Age ${i[0].label}`,label:i=>` ${i.dataset.label}: ${fmtShort(i.raw)}`}}},scales:{x:{stacked:true,grid:{color:T.grid},ticks:stk()},y:{stacked:true,grid:{color:T.grid},ticks:{...stk(true),callback:v=>fmtShort(v)}}}}});
}

// ════ ENGINE ════
const SLIDES = [
  {build:buildS0,draw:null},
  {build:buildS1,draw:drawS1},
  {build:buildS2,draw:null},
  {build:buildS3,draw:drawS3},
  {build:buildS4,draw:drawS4},
  {build:buildS5,draw:drawS5},
  {build:buildS6,draw:drawS6},
  {build:buildS7,draw:drawS7},
  {build:buildS8,draw:drawS8},
];

function renderSlideshow(){
  const vp=document.getElementById('slides-viewport');if(!vp)return;
  const dots=document.getElementById('slide-dots');
  const tot=document.getElementById('slide-total');
  if(tot)tot.textContent=SLIDES.length;
  vp.style.background=T.bg;
  vp.innerHTML=SLIDES.map((s,i)=>`<div class="slide${i===currentSlide?' active':''}" id="slide-${i}" style="background:${T.bg};color:${T.text};">${s.build()}</div>`).join('');
  if(dots)dots.innerHTML=SLIDES.map((_,i)=>`<div class="slide-dot${i===currentSlide?' active':''}" onclick="goToSlide(${i})"></div>`).join('');
  drawCurrentSlide();
  updateNavBtns();
}

function drawCurrentSlide(){const s=SLIDES[currentSlide];if(s?.draw)setTimeout(()=>s.draw(),60);}

function goToSlide(idx){
  if(idx<0||idx>=SLIDES.length)return;
  const old=document.getElementById(`slide-${currentSlide}`);
  if(old){old.classList.add('exit');setTimeout(()=>old.classList.remove('exit','active'),300);}
  currentSlide=idx;
  document.getElementById('slide-current').textContent=currentSlide+1;
  const s=SLIDES[currentSlide];
  const el=document.getElementById(`slide-${currentSlide}`);
  if(el){el.innerHTML=s.build();el.style.background=T.bg;el.style.color=T.text;el.classList.remove('exit');el.classList.add('active');}
  document.querySelectorAll('.slide-dot').forEach((d,i)=>d.classList.toggle('active',i===currentSlide));
  updateNavBtns();
  drawCurrentSlide();
}

function nextSlide(){goToSlide(currentSlide+1);}
function prevSlide(){goToSlide(currentSlide-1);}
function updateNavBtns(){const p=document.getElementById('btn-prev'),n=document.getElementById('btn-next');if(p)p.disabled=currentSlide===0;if(n)n.disabled=currentSlide===SLIDES.length-1;}

// ── Fullscreen ──
function toggleFullscreen(){
  const sc=document.getElementById('slidesContainer');
  if(!document.fullscreenElement){sc.requestFullscreen?.();document.getElementById('btn-fullscreen').innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>';}
  else{document.exitFullscreen?.();document.getElementById('btn-fullscreen').innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';}
}
document.addEventListener('fullscreenchange',()=>{
  const sc=document.getElementById('slidesContainer');
  if(sc&&document.fullscreenElement===sc){sc.style.height='100vh';sc.style.background=T.bg;}
  else if(sc){sc.style.height='';}
});

// ── PPTX Export ──
async function downloadPPTX(){
  if(typeof PptxGenJS==='undefined'){showToast('PptxGenJS not loaded','error');return;}
  const pptx=new PptxGenJS();
  pptx.layout='LAYOUT_WIDE';
  const thBg=T.bg.replace('#','');
  const thAccent=T.accent.replace('#','');
  const thText=T.text.replace('#','');
  const thMuted=T.muted.replace('#','');
  const plan=document.getElementById('planName')?.value||'Retirement Plan';
  const s=ss();

  // Slide 0: Cover
  let sl=pptx.addSlide();
  sl.background={color:thBg};
  sl.addText(plan,{x:.4,y:.6,w:8,h:1.2,fontSize:36,fontFace:'Georgia',color:thText,bold:true});
  sl.addText(`Ages ${s.startAge}–${s.endAge} · Retirement at ${s.retireAge}`,{x:.4,y:1.85,w:8,h:.4,fontSize:13,color:thMuted});
  const kpis=[['At Retirement',fmtShort(s.retireTotal)],['Peak Wealth',fmtShort(s.peakTotal)],['End Balance',fmtShort(s.endTotal)],['Total RMDs',fmtShort(s.totalRMD)]];
  kpis.forEach(([l,v],i)=>{
    const x=.4+(i%2)*4.7,y=2.5+Math.floor(i/2)*1.1;
    sl.addShape(pptx.ShapeType.rect,{x,y,w:4.3,h:.95,fill:{color:'112233'},line:{color:'223344',w:1}});
    sl.addText(l,{x:x+.15,y:y+.08,w:4,h:.3,fontSize:9,color:thMuted});
    sl.addText(v,{x:x+.15,y:y+.35,w:4,h:.45,fontSize:18,fontFace:'Courier New',color:thAccent,bold:true});
  });

  // Remaining slides: text-based summaries
  const slideDefs=[
    {title:'Wealth Trajectory',eyebrow:'Overview',bullets:[`Starting wealth: ${fmtShort(getVal('taxableBalance')+getVal('retirementBalance'))}`,`At retirement: ${fmtShort(s.retireTotal)} (Age ${s.retireAge})`,`Peak wealth: ${fmtShort(s.peakTotal)} (Age ${s.peakAge})`,`End balance: ${fmtShort(s.endTotal)} (Age ${s.endAge})`]},
    {title:'Accumulation Phase',eyebrow:'Phase 1',bullets:[`Accumulation: ${s.accYears} years (Ages ${s.startAge}–${s.retireAge-1})`,`Total contributions: ${fmtShort(s.totalContrib)}`,`Investment growth: ${fmtShort(Math.max(0,s.retireTotal-(getVal('taxableBalance')+getVal('retirementBalance'))-s.totalContrib))}`,`Balance at retirement: ${fmtShort(s.retireTotal)}`]},
    {title:'Retirement Cash Flow',eyebrow:'Phase 2',bullets:[`Retirement: ${s.retYears} years (Ages ${s.retireAge}–${s.endAge})`,`Year-1 spending: ${fmtShort(getVal('initialSpending'))}`,`Total lifetime spending: ${fmtShort(s.totalSpend)}`,`Income covered by guaranteed income: ${s.totalSpend>0?((s.totalIncome/s.totalSpend)*100).toFixed(0)+'%':'0%'}`,`Legacy balance: ${fmtShort(s.endTotal)}`]},
    {title:'RMD Analysis',eyebrow:'Required Minimum Distributions',bullets:[`RMD start age: ${s.rmdStartAge} (SECURE 2.0)`,`Total RMDs distributed: ${fmtShort(s.totalRMD)}`,`RMD tax paid (${fmtPct(getVal('rmdTaxPct'))}): ${fmtShort(s.totalRMDTax)}`,`After-tax RMDs to taxable: ${fmtShort(s.totalRMD-s.totalRMDTax)}`]},
    {title:'Tax Analysis',eyebrow:'Lifetime Tax Impact',bullets:[`Ordinary income tax rate: ${fmtPct(getVal('retirementTaxPct'))}`,`Capital gains tax rate: ${fmtPct(getVal('capitalGainsTaxPct'))}`,`RMD tax rate: ${fmtPct(getVal('rmdTaxPct'))}`,`Total taxes paid: ${fmtShort(s.totalRMDTax+s.totalRetTax)}`]},
    {title:'Stress Test',eyebrow:'Risk Analysis',bullets:[`Base case end balance: ${fmtShort(s.endTotal)}`,`Returns −2% scenario: ${fmtShort((window.stressResults?.lowReturn||[])[((window.stressResults?.lowReturn||[]).length-1)]?.totalBalance||0)}`,`Inflation +2% scenario: ${fmtShort((window.stressResults?.highInflation||[])[(window.stressResults?.highInflation||[]).length-1]?.totalBalance||0)}`]},
    {title:'Legacy Summary',eyebrow:'Summary',bullets:[`Starting wealth: ${fmtShort(getVal('taxableBalance')+getVal('retirementBalance'))}`,`Total contributions: ${fmtShort(s.totalContrib)}`,`Investment returns: ${fmtShort(safeD()?projectionData.reduce((sm,r)=>sm+r.netReturn,0):0)}`,`Total spending: ${fmtShort(s.totalSpend)}`,`Total taxes: ${fmtShort(s.totalRMDTax+s.totalRetTax)}`,`Final balance: ${fmtShort(s.endTotal)}`]},
  ];

  slideDefs.forEach(def=>{
    const sl=pptx.addSlide();
    sl.background={color:thBg};
    sl.addShape(pptx.ShapeType.rect,{x:0,y:0,w:.06,h:7.5,fill:{color:thAccent}});
    sl.addText(def.eyebrow.toUpperCase(),{x:.3,y:.3,w:9,h:.3,fontSize:9,color:thAccent,bold:true,charSpacing:3});
    sl.addText(def.title,{x:.3,y:.6,w:9,h:.7,fontSize:28,fontFace:'Georgia',color:thText,bold:true});
    def.bullets.forEach((b,i)=>{
      sl.addShape(pptx.ShapeType.ellipse,{x:.35,y:1.6+i*.55,w:.12,h:.12,fill:{color:thAccent}});
      sl.addText(b,{x:.6,y:1.52+i*.55,w:8.8,h:.4,fontSize:13,color:thText});
    });
    sl.addText(`For illustrative purposes only · Not financial advice`,{x:.3,y:7,w:9,h:.25,fontSize:8,color:thMuted,italic:true});
  });

  await pptx.writeFile({fileName:`${plan.replace(/[^a-zA-Z0-9]/g,'_')}_Presentation.pptx`});
  showToast('PowerPoint downloaded!','success');
}

// ── Keyboard ──
document.addEventListener('keydown',e=>{
  const pane=document.getElementById('pane-slideshow');
  if(!pane?.classList.contains('active'))return;
  if(e.key==='ArrowRight'||e.key==='ArrowDown')nextSlide();
  if(e.key==='ArrowLeft'||e.key==='ArrowUp')prevSlide();
  if(e.key.toLowerCase()==='f')toggleFullscreen();
});

// ── Init ──
document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    // Apply theme restored from a share link
    if (window._restoredTheme) {
      const sel = document.getElementById('themeSelect');
      if (sel) sel.value = window._restoredTheme;
      applyTheme(window._restoredTheme);
      window._restoredTheme = null;
    } else {
      if (typeof renderSlideshow==='function') renderSlideshow();
    }
  },150);
});
