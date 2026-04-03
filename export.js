// ── export.js — ExcelJS-powered Excel export ──
// ExcelJS supports real cell fills, fonts, borders — unlike SheetJS community.

function getVal(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  if (el.type === 'checkbox') return el.checked ? 1 : 0;
  return parseFloat(el.value) || 0;
}
function getStr(id) {
  const el = document.getElementById(id); return el ? (el.value || '') : '';
}

// ── Color tokens (ARGB for ExcelJS — always "FF" prefix) ──
const XC = {
  navyBg:   'FF1E3A5F', navyFg:   'FFFFFFFF',
  blueBg:   'FFDBEAFE', blueFg:   'FF1E40AF',
  greenBg:  'FFDCFCE7', greenFg:  'FF14532D',
  amberBg:  'FFFEF3C7', amberFg:  'FF92400E',
  redBg:    'FFFEE2E2', redFg:    'FF7F1D1D',
  purpleBg: 'FFEDE9FE', purpleFg: 'FF4C1D95',
  whiteBg:  'FFFFFFFF', bodyFg:   'FF1F2937',
  mutedFg:  'FF6B7280', inputFg:  'FF1D4ED8',
  rowAlt:   'FFF9FAFB', grayBg:   'FFF8FAFC',
  yellowBg: 'FFFEFCE8', yellowFg: 'FFCA8A04',
  slateHdr: 'FF334155', slateFg:  'FFFFFFFF',
  border:   'FFE2E8F0', navyBdr:  'FF1E3A5F',
  accent:   'FF2563EB',
};

function xBorder(color, style) {
  const c = color || XC.border;
  const s = style || 'thin';
  return { style: s, color: { argb: c } };
}
function xAllBorders(color, style) {
  const b = xBorder(color, style);
  return { top: b, bottom: b, left: b, right: b };
}
function xFill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}
function xFont(argb, bold, sz, name) {
  return { color: { argb: argb || XC.bodyFg }, bold: !!bold, size: sz || 11, name: name || 'Calibri' };
}

// ─────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────
async function downloadExcel() {
  if (!projectionData.length) { showToast('No data to export', 'error'); return; }
  if (typeof ExcelJS === 'undefined') { showToast('ExcelJS not loaded', 'error'); return; }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Retirement Projection Model';
  wb.created = new Date();

  buildCoverSheet(wb);
  buildInputsSheet(wb);
  buildProjectionSheet(wb);
  buildSummarySheet(wb);

  // Write to buffer and trigger download
  const buf  = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'Retirement_Projection.xlsx' });
  a.click();
  URL.revokeObjectURL(url);
  showToast('Excel downloaded with full formatting!', 'success');
}

// ── COVER SHEET ──
function buildCoverSheet(wb) {
  const ws = wb.addWorksheet('Cover');
  ws.columns = [{ width: 4 }, { width: 32 }, { width: 22 }, { width: 4 }];

  // Title band
  const titleRow = ws.getRow(2);
  titleRow.height = 40;
  const tc = ws.getCell('B2');
  tc.value = getStr('planName') || 'Retirement Projection Model';
  tc.font  = xFont(XC.navyFg, true, 20, 'Calibri Light');
  tc.fill  = xFill(XC.navyBg);
  tc.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.mergeCells('B2:C2');

  // Sub-title
  const subRow = ws.getRow(3);
  subRow.height = 20;
  const sc = ws.getCell('B3');
  sc.value = `Ages ${getVal('startAge')} – ${getVal('endAge')}  ·  Retirement at ${getVal('retireAge')}  ·  Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
  sc.font  = xFont(XC.mutedFg, false, 10);
  sc.fill  = xFill(XC.navyBg);
  sc.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.mergeCells('B3:C3');
  ws.getRow(4).height = 10;

  // KPI boxes
  const kpis = [];
  if (projectionData.length) {
    const retRow  = projectionData.find(r => r.isRetired);
    const peak    = projectionData.reduce((a,b) => b.totalBalance > a.totalBalance ? b : a, projectionData[0]);
    const endRow  = projectionData[projectionData.length - 1];
    const totRMD  = projectionData.reduce((s,r) => s + r.rmdGross, 0);
    const retTot  = retRow ? retRow.taxableStart + retRow.retirementStart : 0;
    kpis.push(['At Retirement', '$' + Math.round(retTot).toLocaleString()],
              ['Peak Wealth',   '$' + Math.round(peak.totalBalance).toLocaleString() + ' (Age ' + peak.age + ')'],
              ['End Balance',   '$' + Math.round(endRow.totalBalance).toLocaleString()],
              ['Total RMDs',    '$' + Math.round(totRMD).toLocaleString()]);
  }

  kpis.forEach(([label, value], i) => {
    const rIdx = 5 + i * 3;
    const lr = ws.getRow(rIdx); lr.height = 14;
    const vr = ws.getRow(rIdx + 1); vr.height = 22;
    ws.getRow(rIdx + 2).height = 6;

    const lc = ws.getCell(`B${rIdx}`);
    lc.value = label;
    lc.font  = xFont(XC.mutedFg, true, 9);
    lc.fill  = xFill(XC.grayBg);
    lc.alignment = { horizontal: 'left', vertical: 'middle' };
    lc.border = { top: xBorder(XC.border), left: xBorder(XC.border) };

    const lc2 = ws.getCell(`C${rIdx}`);
    lc2.fill   = xFill(XC.grayBg);
    lc2.border = { top: xBorder(XC.border), right: xBorder(XC.border) };

    const vc = ws.getCell(`B${rIdx + 1}`);
    vc.value = value;
    vc.font  = xFont(XC.accent, true, 14);
    vc.fill  = xFill(XC.blueBg);
    vc.alignment = { horizontal: 'left', vertical: 'middle' };
    vc.border = { bottom: xBorder(XC.border), left: xBorder(XC.border) };

    const vc2 = ws.getCell(`C${rIdx + 1}`);
    vc2.fill   = xFill(XC.blueBg);
    vc2.border = { bottom: xBorder(XC.border), right: xBorder(XC.border) };
  });

  // Note
  const noteRow = 5 + kpis.length * 3 + 2;
  const nc = ws.getCell(`B${noteRow}`);
  nc.value = 'For illustrative purposes only. Not financial advice. All values are projections.';
  nc.font  = xFont(XC.amberFg, false, 9);
  nc.fill  = xFill(XC.amberBg);
  nc.alignment = { horizontal: 'left', vertical: 'middle' };
  ws.mergeCells(`B${noteRow}:C${noteRow}`);
  ws.getRow(noteRow).height = 18;
}

// ── INPUTS SHEET ──
function buildInputsSheet(wb) {
  const ws = wb.addWorksheet('Inputs');
  ws.columns = [{ width: 38 }, { width: 20 }, { width: 18 }];

  function addTitle(text) {
    const r = ws.addRow([text, '', '← Edit yellow cells']);
    r.height = 30;
    ['A','B','C'].forEach(col => {
      const c = r.getCell(col);
      c.fill = xFill(XC.navyBg);
      c.font = col === 'A' ? xFont(XC.navyFg, true, 14, 'Calibri Light') : xFont(XC.mutedFg, false, 9);
      c.alignment = { vertical: 'middle', horizontal: col === 'A' ? 'left' : (col === 'B' ? 'right' : 'left') };
    });
  }

  function addSection(text) {
    ws.addRow([]); // spacer
    const r = ws.addRow([text, '', '']);
    r.height = 20;
    ['A','B'].forEach(col => {
      const c = r.getCell(col);
      c.fill = xFill(XC.blueBg);
      c.font = xFont(XC.blueFg, true, 9);
      c.alignment = { vertical: 'middle', horizontal: 'left' };
      c.border = xAllBorders(XC.border);
    });
  }

  function addInput(label, value, isPercent) {
    const r = ws.addRow([label, isPercent ? value / 100 : value, '']);
    r.height = 20;

    const lc = r.getCell(1);
    lc.fill = xFill(XC.whiteBg);
    lc.font = xFont(XC.bodyFg, false, 11);
    lc.alignment = { vertical: 'middle', horizontal: 'left' };
    lc.border = xAllBorders(XC.border);

    const vc = r.getCell(2);
    vc.fill = xFill(XC.yellowBg);
    vc.font = xFont(XC.inputFg, true, 11);
    vc.alignment = { vertical: 'middle', horizontal: 'right' };
    vc.numFmt = isPercent ? '0.0%' : '_($* #,##0_);_($* (#,##0);_($* "-"_);_(@_)';
    vc.border = {
      top: xBorder(XC.border), bottom: xBorder(XC.border),
      left:  { style: 'medium', color: { argb: 'FFCA8A04' } },
      right: { style: 'medium', color: { argb: 'FFCA8A04' } },
    };

    const nc = r.getCell(3);
    nc.fill = xFill(XC.whiteBg);
    nc.font = xFont(XC.mutedFg, false, 9);
    nc.value = '← edit this cell';
    nc.alignment = { vertical: 'middle', horizontal: 'left' };
    nc.border = xAllBorders(XC.border);
  }

  function addIntInput(label, value) {
    const r = ws.addRow([label, value, '']);
    r.height = 20;
    const lc = r.getCell(1);
    lc.fill = xFill(XC.whiteBg); lc.font = xFont(XC.bodyFg, false, 11);
    lc.alignment = { vertical: 'middle', horizontal: 'left' }; lc.border = xAllBorders(XC.border);
    const vc = r.getCell(2);
    vc.fill = xFill(XC.yellowBg); vc.font = xFont(XC.inputFg, true, 11);
    vc.numFmt = '#,##0'; vc.alignment = { vertical: 'middle', horizontal: 'right' };
    vc.border = { top: xBorder(XC.border), bottom: xBorder(XC.border), left: { style: 'medium', color: { argb: 'FFCA8A04' } }, right: { style: 'medium', color: { argb: 'FFCA8A04' } } };
    const nc = r.getCell(3); nc.fill = xFill(XC.whiteBg); nc.font = xFont(XC.mutedFg, false, 9);
    nc.value = '← edit this cell'; nc.alignment = { vertical: 'middle', horizontal: 'left' }; nc.border = xAllBorders(XC.border);
  }

  addTitle('Retirement Projection — Inputs');
  addSection('TIME');
  addIntInput('Starting Age',   getVal('startAge'));
  addIntInput('Retirement Age', getVal('retireAge'));
  addIntInput('End Age',        getVal('endAge'));
  addSection('ASSETS');
  addInput('Starting Taxable Balance',    getVal('taxableBalance'),    false);
  addInput('Starting Retirement Balance', getVal('retirementBalance'), false);
  addSection('GROWTH');
  addInput('Taxable Return Rate',    getVal('taxableReturn'),    true);
  addInput('Retirement Return Rate', getVal('retirementReturn'), true);
  addInput('Inflation Rate',         getVal('inflationRate'),    true);
  addSection('CASH FLOW');
  addInput('Annual Taxable Contribution',    getVal('taxableContrib'),    false);
  addInput('Annual Retirement Contribution', getVal('retirementContrib'), false);
  addInput('Year-1 Retirement Spending',     getVal('initialSpending'),   false);
  addSection('INCOME STREAMS');
  addInput('Social Security (monthly)',  getVal('ssMonthly'),     false);
  addIntInput('SS Start Age',            getVal('ssStartAge'));
  addInput('Pension (monthly)',          getVal('pensionMonthly'), false);
  addInput('Rental Income (annual)',     getVal('rentalAnnual'),   false);
  addSection('TAXES');
  addInput('Ordinary Income Tax Rate',  getVal('retirementTaxPct'),  true);
  addInput('Capital Gains Tax Rate',    getVal('capitalGainsTaxPct'), true);
  addInput('RMD Tax Rate',              getVal('rmdTaxPct'),          true);

  // Note row
  ws.addRow([]);
  const nr = ws.addRow(['For illustrative purposes only. Not financial advice.', '', '']);
  nr.height = 20;
  const nc = nr.getCell(1);
  nc.fill = xFill(XC.amberBg); nc.font = xFont(XC.amberFg, false, 9);
  nc.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.mergeCells(`A${nr.number}:C${nr.number}`);
}

// ── PROJECTION SHEET ──
function buildProjectionSheet(wb) {
  const ws = wb.addWorksheet('Projection');

  const COLS = [
    { header: 'Age',                 key: 'age',     width: 7 },
    { header: 'Phase',               key: 'phase',   width: 14 },
    { header: 'Starting Taxable',    key: 'stTax',   width: 18 },
    { header: 'Starting Retirement', key: 'stRet',   width: 19 },
    { header: 'Net Return',          key: 'netRet',  width: 16 },
    { header: 'Contributions',       key: 'contrib', width: 16 },
    { header: 'Income',              key: 'income',  width: 14 },
    { header: 'Spending',            key: 'spend',   width: 14 },
    { header: 'RMD (Gross)',         key: 'rmdGross',width: 14 },
    { header: 'RMD Tax',             key: 'rmdTax',  width: 12 },
    { header: 'Ret. WD Tax',         key: 'retTax',  width: 12 },
    { header: 'Ending Taxable',      key: 'endTax',  width: 18 },
    { header: 'Ending Retirement',   key: 'endRet',  width: 19 },
    { header: 'Total Balance',       key: 'total',   width: 16 },
  ];

  ws.columns = COLS.map(c => ({ key: c.key, width: c.width }));

  // Header row
  const hdr = ws.getRow(1);
  hdr.height = 28;
  COLS.forEach((col, i) => {
    const cell = hdr.getCell(i + 1);
    const isRMD = col.key.startsWith('rmd') || col.key === 'retTax';
    cell.value = col.header;
    cell.font  = xFont(XC.navyFg, true, 10);
    cell.fill  = xFill(isRMD ? XC.purpleBg : XC.navyBg);
    cell.font.color = { argb: isRMD ? XC.purpleFg : XC.navyFg };
    cell.alignment = { horizontal: i <= 1 ? 'left' : 'right', vertical: 'middle', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: isRMD ? XC.purpleFg : 'FF93C5FD' } }, ...xAllBorders(XC.navyBg) };
  });

  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];

  const retireAge = getVal('retireAge');
  const FMT_DOLLAR = '_($* #,##0_);_($* (#,##0);_($* "-"_);_(@_)';

  projectionData.forEach((row, ri) => {
    const r = ws.addRow({
      age: row.age, phase: row.phase,
      stTax:   Math.round(row.taxableStart),
      stRet:   Math.round(row.retirementStart),
      netRet:  Math.round(row.netReturn),
      contrib: Math.round(row.contributions),
      income:  Math.round(row.income || 0),
      spend:   Math.round(row.spending),
      rmdGross:Math.round(row.rmdGross),
      rmdTax:  Math.round(row.rmdTax),
      retTax:  Math.round(row.retWdTax),
      endTax:  Math.round(row.endTaxable),
      endRet:  Math.round(row.endRetirement),
      total:   Math.round(row.totalBalance),
    });
    r.height = 18;

    // Row background
    const isRetireStart = row.age === retireAge;
    const rowBg = isRetireStart ? XC.amberBg
                : row.isRetired ? 'FFFFFBEB'
                : ri % 2 === 0   ? XC.whiteBg : XC.rowAlt;

    COLS.forEach((col, ci) => {
      const cell = r.getCell(ci + 1);
      const isRMD = col.key.startsWith('rmd') || col.key === 'retTax';
      const bg    = isRMD ? XC.purpleBg : rowBg;

      // Fill
      cell.fill = xFill(bg);
      cell.border = xAllBorders(isRetireStart ? 'FFFDE68A' : XC.border);

      // Alignment
      cell.alignment = { horizontal: ci <= 1 ? 'left' : 'right', vertical: 'middle' };

      // Font colors
      let fgColor = XC.bodyFg;
      if (ci === 4) fgColor = row.netReturn >= 0 ? XC.greenFg : XC.redFg;        // net return
      if (ci === 5) fgColor = row.contributions > 0 ? XC.greenFg : XC.mutedFg;   // contributions
      if (ci === 6) fgColor = (row.income || 0) > 0 ? XC.greenFg : XC.mutedFg;  // income
      if (ci === 7) fgColor = row.spending > 0 ? XC.redFg : XC.mutedFg;         // spending
      if (isRMD)    fgColor = XC.purpleFg;
      if (ci === 13) fgColor = XC.blueFg;                                          // total

      const isBold = ci === 0 || ci === 13;
      cell.font = xFont(fgColor, isBold, 10);

      // Number format
      if (ci >= 2) cell.numFmt = FMT_DOLLAR;

      // Phase cell styling
      if (ci === 1) {
        cell.font = xFont(row.isRetired ? XC.amberFg : XC.blueFg, true, 9);
        cell.fill = xFill(row.isRetired ? XC.amberBg : XC.blueBg);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      // Total column — bold blue background
      if (ci === 13) {
        cell.fill   = xFill(XC.blueBg);
        cell.border = {
          top: { style: 'medium', color: { argb: XC.blueFg } },
          bottom: { style: 'medium', color: { argb: XC.blueFg } },
          left: { style: 'medium', color: { argb: XC.blueFg } },
          right: { style: 'medium', color: { argb: XC.blueFg } },
        };
      }

      // Green tint for ending taxable
      if (ci === 11) cell.fill = xFill(XC.greenBg);
      // Amber tint for ending retirement
      if (ci === 12) cell.fill = xFill(XC.amberBg);
    });
  });
}

// ── SUMMARY SHEET ──
function buildSummarySheet(wb) {
  const ws = wb.addWorksheet('Summary');
  ws.columns = [{ width: 38 }, { width: 22 }];

  function addTitleRow(text) {
    const r = ws.addRow([text, '']);
    r.height = 32;
    ['A','B'].forEach(col => {
      const c = r.getCell(col);
      c.fill = xFill(XC.navyBg);
      c.font = xFont(XC.navyFg, true, 16, 'Calibri Light');
      c.alignment = { vertical: 'middle', horizontal: 'left' };
    });
    ws.mergeCells(`A${r.number}:B${r.number}`);
  }

  function addSectionRow(text) {
    ws.addRow([]);
    const r = ws.addRow([text, '']);
    r.height = 20;
    ['A','B'].forEach(col => {
      const c = r.getCell(col);
      c.fill = xFill(XC.slateHdr);
      c.font = xFont(XC.slateFg, true, 10);
      c.alignment = { vertical: 'middle', horizontal: 'left' };
      c.border = xAllBorders(XC.border);
    });
    ws.mergeCells(`A${r.number}:B${r.number}`);
  }

  function addMetricRow(label, value, fmt, ri) {
    const r = ws.addRow([label, value]);
    r.height = 20;
    const lc = r.getCell(1);
    lc.fill = xFill(ri % 2 === 0 ? XC.whiteBg : XC.rowAlt);
    lc.font = xFont(XC.bodyFg, false, 11);
    lc.alignment = { vertical: 'middle', horizontal: 'left' };
    lc.border = xAllBorders(XC.border);
    const vc = r.getCell(2);
    vc.fill = xFill(XC.blueBg);
    vc.font = xFont(XC.blueFg, true, 11);
    vc.numFmt = fmt || '_($* #,##0_);_($* (#,##0);_($* "-"_);_(@_)';
    vc.alignment = { vertical: 'middle', horizontal: 'right' };
    vc.border = xAllBorders(XC.border);
  }

  if (!projectionData.length) return;
  const retRow   = projectionData.find(r => r.isRetired) || projectionData[0];
  const peak     = projectionData.reduce((a,b) => b.totalBalance > a.totalBalance ? b : a, projectionData[0]);
  const endRow   = projectionData[projectionData.length - 1];
  const totalRMD = projectionData.reduce((s,r) => s + r.rmdGross, 0);
  const totalRMDTax = projectionData.reduce((s,r) => s + r.rmdTax, 0);
  const totalRetTax = projectionData.reduce((s,r) => s + r.retWdTax, 0);
  const totalSpend  = projectionData.filter(r => r.isRetired).reduce((s,r) => s + r.spending, 0);
  const totalContrib = projectionData.reduce((s,r) => s + r.contributions, 0);
  const retTotal    = retRow.taxableStart + retRow.retirementStart;
  const retYears    = projectionData.filter(r => r.isRetired).length;

  addTitleRow('Summary Metrics');
  addSectionRow('PORTFOLIO MILESTONES');
  let ri = 0;
  addMetricRow('Starting Taxable Balance',    getVal('taxableBalance'),    undefined, ri++);
  addMetricRow('Starting Retirement Balance', getVal('retirementBalance'), undefined, ri++);
  addMetricRow('Balance at Retirement',       retTotal,                    undefined, ri++);
  addMetricRow('Peak Total Balance',          peak.totalBalance,           undefined, ri++);
  addMetricRow('Age at Peak',                 peak.age,                    '#,##0',   ri++);
  addMetricRow('Final Balance (End Age)',      endRow.totalBalance,         undefined, ri++);
  addSectionRow('LIFETIME FLOWS'); ri = 0;
  addMetricRow('Total Contributions',         totalContrib,    undefined, ri++);
  addMetricRow('Total Retirement Spending',   totalSpend,      undefined, ri++);
  addMetricRow('Retirement Years',            retYears,        '#,##0 "yrs"', ri++);
  addSectionRow('RMDs & TAXES'); ri = 0;
  addMetricRow('Total RMDs Distributed',      totalRMD,        undefined, ri++);
  addMetricRow('Total RMD Tax Paid',          totalRMDTax,     undefined, ri++);
  addMetricRow('Total Ret. WD Tax Paid',      totalRetTax,     undefined, ri++);
  addMetricRow('Total All Taxes Paid',        totalRMDTax + totalRetTax, undefined, ri++);
  addSectionRow('RATES & ASSUMPTIONS'); ri = 0;
  addMetricRow('Taxable Return Rate',         getVal('taxableReturn')/100,    '0.0%', ri++);
  addMetricRow('Retirement Return Rate',      getVal('retirementReturn')/100, '0.0%', ri++);
  addMetricRow('Inflation Rate',              getVal('inflationRate')/100,    '0.0%', ri++);
  addMetricRow('Ordinary Income Tax Rate',    getVal('retirementTaxPct')/100, '0.0%', ri++);
  addMetricRow('RMD Tax Rate',                getVal('rmdTaxPct')/100,        '0.0%', ri++);

  // Note
  ws.addRow([]);
  const nr = ws.addRow(['For illustrative purposes only. Not financial advice.']);
  nr.height = 20;
  const nc = nr.getCell(1);
  nc.fill = xFill(XC.amberBg); nc.font = xFont(XC.amberFg, false, 9);
  nc.alignment = { vertical: 'middle', horizontal: 'left' };
  ws.mergeCells(`A${nr.number}:B${nr.number}`);
}

// ── CSV ──
function downloadCSV() {
  if (!projectionData.length) { showToast('No data to export', 'error'); return; }
  const headers = ['Age','Phase','Starting Taxable','Starting Retirement','Net Return','Contributions','Income','Spending','RMD Gross','RMD Tax','Ret WD Tax','Ending Taxable','Ending Retirement','Total Balance'];
  const rows = projectionData.map(r => [
    r.age, r.phase,
    Math.round(r.taxableStart), Math.round(r.retirementStart),
    Math.round(r.netReturn),    Math.round(r.contributions),
    Math.round(r.income || 0), Math.round(r.spending),
    Math.round(r.rmdGross),     Math.round(r.rmdTax),
    Math.round(r.retWdTax),     Math.round(r.endTaxable),
    Math.round(r.endRetirement),Math.round(r.totalBalance),
  ]);
  const csv = [headers, ...rows].map(row => row.map(c => { const s = String(c); return s.includes(',') ? `"${s}"` : s; }).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: 'Retirement_Projection.csv' }).click();
  URL.revokeObjectURL(url);
  showToast('CSV downloaded', 'success');
}

// ── Drive modal ──
function saveToGoogleDrive() { document.getElementById('drive-modal').style.display = 'flex'; }
function closeModal()        { document.getElementById('drive-modal').style.display = 'none'; }
