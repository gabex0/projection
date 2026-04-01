// ── export.js — Excel, CSV, Google Drive ──

// ── Cell address helper ──
function colLetter(c) {
  let s = '';
  do { s = String.fromCharCode(65 + (c % 26)) + s; c = Math.floor(c / 26) - 1; } while (c >= 0);
  return s;
}
function addr(col, row) { return colLetter(col) + (row + 1); }

const FMT_DOLLAR = '_($* #,##0_);_($* (#,##0);_($* "-"_);_(@_)';
const FMT_PCT    = '0.0%';
const FMT_INT    = '#,##0';

// Palette matching website CSS variables
const C = {
  navyBg:    '1E3A5F', navyFg:  'FFFFFF',
  blueBg:    'DBEAFE', blueFg:  '1E40AF',
  inputBg:   'EFF6FF', inputFg: '1D4ED8',
  slateBg:   'F1F5F9', slateFg: '374151',
  whiteBg:   'FFFFFF', bodyFg:  '111827',
  greenFg:   '15803D',
  redFg:     'B91C1C',
  amberBg:   'FFFBEB', amberFg: 'B45309',
  amber100:  'FEF3C7',
  purpleBg:  'F5F3FF', purpleFg:'6D28D9',
  greenThin: 'F0FDF4',
  border:    'E5E7EB',
};

function mkBorder(color) {
  const b = { style: 'thin', color: { rgb: color || C.border } };
  return { top: b, bottom: b, left: b, right: b };
}

function setCell(ws, col, row, value, fmt, s) {
  const a = addr(col, row);
  const isF = typeof value === 'string' && value.startsWith('=');
  ws[a] = {
    t: isF ? 'n' : (typeof value === 'number' ? 'n' : 's'),
    v: isF ? undefined : value,
    f: isF ? value.slice(1) : undefined,
  };
  if (fmt) ws[a].z = fmt;
  if (s)   ws[a].s = s;
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────
function downloadExcel() {
  if (!projectionData.length) { showToast('No data to export', 'error'); return; }

  const wb = XLSX.utils.book_new();

  // ════════════════════════════════════════════════════════
  // SHEET 1 — INPUTS  (edit blue cells → Projection updates)
  // ════════════════════════════════════════════════════════
  const wsI = {};

  // Ordered list: [label, value, format]
  const INPUT_DEF = [
    ['INPUTS', null, null],
    ['Starting Age',                   getVal('startAge'),               FMT_INT],
    ['End Age',                        getVal('endAge'),                  FMT_INT],
    ['Retirement Age',                 getVal('retireAge'),               FMT_INT],
    ['Starting Taxable Balance',       getVal('taxableBalance'),          FMT_DOLLAR],
    ['Starting Retirement Balance',    getVal('retirementBalance'),       FMT_DOLLAR],
    ['Taxable Return Rate',            getVal('taxableReturn') / 100,    FMT_PCT],
    ['Retirement Return Rate',         getVal('retirementReturn') / 100, FMT_PCT],
    ['Inflation Rate',                 getVal('inflationRate') / 100,    FMT_PCT],
    ['Annual Taxable Contribution',    getVal('taxableContrib'),          FMT_DOLLAR],
    ['Annual Retirement Contribution', getVal('retirementContrib'),       FMT_DOLLAR],
    ['Year-1 Spending',                getVal('initialSpending'),         FMT_DOLLAR],
    ['Retirement Withdrawal Tax Rate', getVal('retirementTaxPct') / 100, FMT_PCT],
    ['RMD Tax Rate',                   getVal('rmdTaxPct') / 100,        FMT_PCT],
  ];

  // Map label -> excel row number (1-based)
  const IR = {};
  INPUT_DEF.forEach(([label], ri) => { if (label !== 'INPUTS') IR[label] = ri + 1; });

  INPUT_DEF.forEach(([label, val, fmt], ri) => {
    const isHdr = label === 'INPUTS';
    const lStyle = {
      font:      { name: 'Calibri', sz: isHdr ? 11 : 10, bold: isHdr, color: { rgb: isHdr ? C.navyFg : C.slateFg } },
      fill:      { fgColor: { rgb: isHdr ? C.navyBg : C.whiteBg } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border:    mkBorder(),
    };
    const vStyle = {
      font:      { name: 'Calibri', sz: 10, bold: false, color: { rgb: isHdr ? C.navyFg : C.inputFg } },
      fill:      { fgColor: { rgb: isHdr ? C.navyBg : C.inputBg } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    mkBorder(),
    };
    setCell(wsI, 0, ri, label, null, lStyle);
    setCell(wsI, 1, ri, val !== null ? val : '', val !== null ? fmt : null, vStyle);
  });

  // Note row
  const noteR = INPUT_DEF.length;
  const noteStyle = { font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: 'B45309' } }, fill: { fgColor: { rgb: 'FFF7ED' } }, alignment: { horizontal: 'left', vertical: 'center' }, border: mkBorder() };
  setCell(wsI, 0, noteR, '✏  Edit blue cells above — all formulas in Projection sheet update automatically', null, noteStyle);
  setCell(wsI, 1, noteR, '', null, { ...noteStyle, alignment: { horizontal: 'right' } });

  wsI['!ref']  = `A1:B${noteR + 1}`;
  wsI['!cols'] = [{ wch: 38 }, { wch: 20 }];
  wsI['!rows'] = Array(noteR + 1).fill({ hpt: 18 });
  XLSX.utils.book_append_sheet(wb, wsI, 'Inputs');

  // Shorthand: get Inputs cell reference
  const I = {};
  Object.entries(IR).forEach(([label, row]) => { I[label] = `Inputs!$B$${row}`; });

  // ════════════════════════════════════════════════════════
  // SHEET 2 — PROJECTION  (formula-driven)
  // ════════════════════════════════════════════════════════
  const wsP = {};

  // ── IRS RMD table in helper columns Q/R ──
  const RMD_DATA = [
    [73,26.5],[74,25.5],[75,24.6],[76,23.7],[77,22.9],[78,22.0],[79,21.1],
    [80,20.2],[81,19.4],[82,18.5],[83,17.7],[84,16.8],[85,16.0],[86,15.2],[87,14.4],
    [88,13.7],[89,12.9],[90,12.2],[91,11.5],[92,10.8],[93,10.1],[94,9.5],[95,8.9],
    [96,8.4],[97,7.8],[98,7.3],[99,6.8],[100,6.4],[101,6.0],[102,5.6],[103,5.2],
    [104,4.9],[105,4.6],[106,4.3],[107,4.1],[108,3.9],[109,3.7],[110,3.5],
  ];
  const QC = 16, RC = 17; // Q=col16, R=col17
  const pHdr = { font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: C.purpleFg } }, fill: { fgColor: { rgb: C.purpleBg } }, alignment: { horizontal: 'center', vertical: 'center' }, border: mkBorder() };
  setCell(wsP, QC, 0, 'RMD Age', null, pHdr);
  setCell(wsP, RC, 0, 'IRS Divisor', null, pHdr);
  RMD_DATA.forEach(([age, div], i) => {
    const pData = { font: { name: 'Calibri', sz: 9, color: { rgb: '4B5563' } }, fill: { fgColor: { rgb: 'FAF5FF' } }, alignment: { horizontal: 'center', vertical: 'center' }, border: mkBorder() };
    setCell(wsP, QC, i + 1, age, '0',   pData);
    setCell(wsP, RC, i + 1, div, '0.0', pData);
  });
  const RMD_LOOKUP_RANGE = `$Q$2:$R$${RMD_DATA.length + 1}`;

  // ── Column indices ──
  const PC = { age:0, phase:1, stTax:2, stRet:3, netRet:4, contrib:5, spending:6, rmdGross:7, rmdTax:8, retWdTax:9, endTax:10, endRet:11, total:12 };

  // ── Header row ──
  const HEADERS = ['Age','Phase','Starting Taxable','Starting Retirement','Net Return','Contributions','Spending','RMD (Gross)','RMD Tax','Ret. WD Tax','Ending Taxable','Ending Retirement','Total Balance'];
  HEADERS.forEach((h, ci) => {
    const isRmd = ci >= 7 && ci <= 9;
    setCell(wsP, ci, 0, h, null, {
      font:      { name: 'Calibri', sz: 10, bold: true, color: { rgb: isRmd ? C.purpleFg : C.navyFg } },
      fill:      { fgColor: { rgb: isRmd ? C.purpleBg : C.navyBg } },
      alignment: { horizontal: ci <= 1 ? 'left' : 'right', vertical: 'center', wrapText: true },
      border: {
        top:    { style: 'thin',   color: { rgb: C.border } },
        bottom: { style: 'medium', color: { rgb: isRmd ? C.purpleFg : '93C5FD' } },
        left:   { style: 'thin',   color: { rgb: C.border } },
        right:  { style: 'thin',   color: { rgb: C.border } },
      },
    });
  });

  // ── Data rows ──
  const startAge = getVal('startAge');
  const endAge   = getVal('endAge');
  const N        = endAge - startAge + 1;
  const DS       = 1; // data start row index (0-based)

  const taxR  = I['Taxable Return Rate'];
  const retR  = I['Retirement Return Rate'];
  const taxC  = I['Annual Taxable Contribution'];
  const retC  = I['Annual Retirement Contribution'];
  const retTx = I['Retirement Withdrawal Tax Rate'];
  const rmdTx = I['RMD Tax Rate'];
  const retAgeRef = I['Retirement Age'];
  const infR  = I['Inflation Rate'];
  const sp0   = I['Year-1 Spending'];

  for (let ri = 0; ri < N; ri++) {
    const r    = DS + ri;    // 0-based sheet row
    const prev = r - 1;      // previous row (0-based)
    const isFirst = ri === 0;

    const A = c => addr(c, r);       // current row cell
    const P = c => addr(c, prev);    // previous row cell

    // ── Age ──
    setCell(wsP, PC.age, r,
      isFirst ? `=${I['Starting Age']}` : `=${P(PC.age)}+1`,
      '0', {
        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: C.bodyFg } },
        fill: { fgColor: { rgb: C.slateBg } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: mkBorder(),
      });

    // ── Phase ──
    setCell(wsP, PC.phase, r,
      `=IF(${A(PC.age)}>=${retAgeRef},"Retirement","Accumulation")`,
      null, {
        font: { name: 'Calibri', sz: 10, color: { rgb: C.slateFg } },
        fill: { fgColor: { rgb: C.whiteBg } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: mkBorder(),
      });

    // ── Starting Taxable ──
    setCell(wsP, PC.stTax, r,
      isFirst ? `=${I['Starting Taxable Balance']}` : `=${P(PC.endTax)}`,
      FMT_DOLLAR, { font: { name: 'Calibri', sz: 10, color: { rgb: C.bodyFg } }, fill: { fgColor: { rgb: C.whiteBg } }, alignment: { horizontal: 'right', vertical: 'center' }, border: mkBorder() });

    // ── Starting Retirement ──
    setCell(wsP, PC.stRet, r,
      isFirst ? `=${I['Starting Retirement Balance']}` : `=${P(PC.endRet)}`,
      FMT_DOLLAR, { font: { name: 'Calibri', sz: 10, color: { rgb: C.bodyFg } }, fill: { fgColor: { rgb: C.whiteBg } }, alignment: { horizontal: 'right', vertical: 'center' }, border: mkBorder() });

    // ── Net Return ──
    setCell(wsP, PC.netRet, r,
      `=${A(PC.stTax)}*${taxR}+${A(PC.stRet)}*${retR}`,
      FMT_DOLLAR, { font: { name: 'Calibri', sz: 10, color: { rgb: C.greenFg } }, fill: { fgColor: { rgb: C.whiteBg } }, alignment: { horizontal: 'right', vertical: 'center' }, border: mkBorder() });

    // ── Contributions ──
    setCell(wsP, PC.contrib, r,
      `=IF(${A(PC.phase)}="Accumulation",${taxC}+${retC},0)`,
      FMT_DOLLAR, { font: { name: 'Calibri', sz: 10, color: { rgb: C.greenFg } }, fill: { fgColor: { rgb: C.whiteBg } }, alignment: { horizontal: 'right', vertical: 'center' }, border: mkBorder() });

    // ── Spending (inflates each retirement year after first) ──
    let spendF;
    if (isFirst) {
      spendF = `=IF(${A(PC.phase)}="Retirement",${sp0},0)`;
    } else {
      spendF = `=IF(${A(PC.phase)}="Accumulation",0,IF(${P(PC.phase)}="Accumulation",${sp0},${P(PC.spending)}*(1+${infR})))`;
    }
    setCell(wsP, PC.spending, r, spendF, FMT_DOLLAR,
      { font: { name: 'Calibri', sz: 10, color: { rgb: C.redFg } }, fill: { fgColor: { rgb: C.whiteBg } }, alignment: { horizontal: 'right', vertical: 'center' }, border: mkBorder() });

    // ── RMD Gross — VLOOKUP into helper table, 0 if not retired or age < 73 ──
    const rmdF = `=IF(AND(${A(PC.phase)}="Retirement",${A(PC.age)}>=73),IFERROR(${A(PC.stRet)}/VLOOKUP(${A(PC.age)},${RMD_LOOKUP_RANGE},2,0),${A(PC.stRet)}/2),0)`;
    setCell(wsP, PC.rmdGross, r, rmdF, FMT_DOLLAR,
      { font: { name: 'Calibri', sz: 10, color: { rgb: C.purpleFg } }, fill: { fgColor: { rgb: C.purpleBg } }, alignment: { horizontal: 'right', vertical: 'center' }, border: mkBorder() });

    // ── RMD Tax ──
    setCell(wsP, PC.rmdTax, r,
      `=${A(PC.rmdGross)}*${rmdTx}`,
      FMT_DOLLAR, { font: { name: 'Calibri', sz: 10, color: { rgb: C.redFg } }, fill: { fgColor: { rgb: C.purpleBg } }, alignment: { horizontal: 'right', vertical: 'center' }, border: mkBorder() });

    // ── Intermediate named pieces (used in endTax, endRet, retWdTax) ──
    // grownRet    = MAX(0, (stRet - rmdGross) * (1+retR))
    // afterTaxRmd = rmdGross - rmdTax
    // grownTax    = stTax*(1+taxR) + afterTaxRmd
    // taxableWd   = MIN(grownTax, spending)      [retirement only]
    // remaining   = MAX(0, spending - taxableWd) [retirement only]
    // retWdGross  = MIN(grownRet, remaining/(1-retTx))  [if remaining>0 & retTx<1]
    const grownRet   = `MAX(0,(${A(PC.stRet)}-${A(PC.rmdGross)})*(1+${retR}))`;
    const afterRmd   = `(${A(PC.rmdGross)}-${A(PC.rmdTax)})`;
    const grownTax   = `(${A(PC.stTax)}*(1+${taxR})+${afterRmd})`;
    const taxableWd  = `MIN(${grownTax},${A(PC.spending)})`;
    const remaining  = `MAX(0,${A(PC.spending)}-${taxableWd})`;
    const retWdGross = `IF(AND(${A(PC.phase)}="Retirement",${remaining}>0),MIN(${grownRet},IF(1-${retTx}>0,${remaining}/(1-${retTx}),${grownRet})),0)`;

    // ── Retirement WD Tax ──
    setCell(wsP, PC.retWdTax, r,
      `=${retWdGross}*${retTx}`,
      FMT_DOLLAR, { font: { name: 'Calibri', sz: 10, color: { rgb: C.redFg } }, fill: { fgColor: { rgb: C.purpleBg } }, alignment: { horizontal: 'right', vertical: 'center' }, border: mkBorder() });

    // ── Ending Taxable ──
    // Accumulation: stTax*(1+taxR)+taxC
    // Retirement:   MAX(0, grownTax - taxableWd)  [taxableWd = MIN(grownTax,spending)]
    const endTaxF = `=IF(${A(PC.phase)}="Accumulation",${A(PC.stTax)}*(1+${taxR})+${taxC},MAX(0,${grownTax}-${taxableWd}))`;
    setCell(wsP, PC.endTax, r, endTaxF, FMT_DOLLAR,
      { font: { name: 'Calibri', sz: 10, color: { rgb: C.bodyFg } }, fill: { fgColor: { rgb: C.greenThin } }, alignment: { horizontal: 'right', vertical: 'center' }, border: mkBorder() });

    // ── Ending Retirement ──
    // Accumulation: stRet*(1+retR)+retC
    // Retirement:   MAX(0, grownRet - retWdGross)
    const endRetF = `=IF(${A(PC.phase)}="Accumulation",${A(PC.stRet)}*(1+${retR})+${retC},MAX(0,${grownRet}-${retWdGross}))`;
    setCell(wsP, PC.endRet, r, endRetF, FMT_DOLLAR,
      { font: { name: 'Calibri', sz: 10, color: { rgb: C.bodyFg } }, fill: { fgColor: { rgb: C.amberBg } }, alignment: { horizontal: 'right', vertical: 'center' }, border: mkBorder() });

    // ── Total Balance ──
    setCell(wsP, PC.total, r,
      `=${A(PC.endTax)}+${A(PC.endRet)}`,
      FMT_DOLLAR, { font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: C.blueFg } }, fill: { fgColor: { rgb: C.blueBg } }, alignment: { horizontal: 'right', vertical: 'center' }, border: mkBorder() });
  }

  wsP['!ref']  = `A1:R${DS + N}`;
  wsP['!cols'] = [
    {wch:6},{wch:14},{wch:18},{wch:18},{wch:16},{wch:16},{wch:14},
    {wch:14},{wch:12},{wch:14},{wch:18},{wch:18},{wch:16},
    {wch:2},{wch:2},{wch:2},{wch:8},{wch:10},
  ];
  wsP['!rows']   = [{ hpt: 28 }, ...Array(N).fill({ hpt: 17 })];
  wsP['!freeze'] = { xSplit: 1, ySplit: 1, topLeftCell: 'B2', activePane: 'bottomRight' };
  XLSX.utils.book_append_sheet(wb, wsP, 'Projection');

  // ════════════════════════════════════════════════════════
  // SHEET 3 — SUMMARY  (formula references)
  // ════════════════════════════════════════════════════════
  const wsS = {};
  const lastDataRow = DS + N; // 1-based excel row of last data row

  const SUM_ROWS = [
    ['SUMMARY METRICS', null, null, true],
    ['Metric', 'Value', null, false, true],
    ['Starting Taxable Balance',       `=Projection!$C$2`,                                      FMT_DOLLAR],
    ['Starting Retirement Balance',    `=Projection!$D$2`,                                      FMT_DOLLAR],
    ['Retirement Age',                 `=${I['Retirement Age']}`,                               FMT_INT],
    ['End Age',                        `=${I['End Age']}`,                                      FMT_INT],
    ['Retirement Years',               `=${I['End Age']}-${I['Retirement Age']}`,               '0 "yrs"'],
    ['Total Balance at Retirement',    `=IFERROR(INDEX(Projection!$M$2:$M$${lastDataRow},MATCH(${I['Retirement Age']},Projection!$A$2:$A$${lastDataRow},0)),0)`, FMT_DOLLAR],
    ['Peak Total Balance',             `=MAX(Projection!$M$2:$M$${lastDataRow})`,               FMT_DOLLAR],
    ['Final Balance (End Age)',        `=Projection!$M$${lastDataRow}`,                         FMT_DOLLAR],
    ['Total RMDs Distributed',         `=SUMIF(Projection!$B$2:$B$${lastDataRow},"Retirement",Projection!$H$2:$H$${lastDataRow})`, FMT_DOLLAR],
    ['Total RMD Tax Paid',             `=SUMIF(Projection!$B$2:$B$${lastDataRow},"Retirement",Projection!$I$2:$I$${lastDataRow})`, FMT_DOLLAR],
    ['Total Retirement WD Tax Paid',   `=SUMIF(Projection!$B$2:$B$${lastDataRow},"Retirement",Projection!$J$2:$J$${lastDataRow})`, FMT_DOLLAR],
    ['Total All Taxes Paid',           `=SUM(Projection!$I$2:$I$${lastDataRow},Projection!$J$2:$J$${lastDataRow})`, FMT_DOLLAR],
  ];

  SUM_ROWS.forEach(([label, val, fmt, isMainHdr, isColHdr], ri) => {
    const lStyle = {
      font: { name: 'Calibri', sz: isMainHdr ? 11 : 10, bold: isMainHdr || isColHdr, color: { rgb: (isMainHdr || isColHdr) ? C.navyFg : C.slateFg } },
      fill: { fgColor: { rgb: (isMainHdr || isColHdr) ? C.navyBg : (ri % 2 === 0 ? C.whiteBg : C.slateBg) } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: mkBorder(),
    };
    const vStyle = {
      font: { name: 'Calibri', sz: 10, bold: isColHdr, color: { rgb: (isMainHdr || isColHdr) ? C.navyFg : C.blueFg } },
      fill: { fgColor: { rgb: (isMainHdr || isColHdr) ? C.navyBg : C.blueBg } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: mkBorder(),
    };
    setCell(wsS, 0, ri, label, null, lStyle);
    setCell(wsS, 1, ri, val !== null ? val : '', fmt || null, vStyle);
  });

  wsS['!ref']  = `A1:B${SUM_ROWS.length}`;
  wsS['!cols'] = [{ wch: 36 }, { wch: 20 }];
  wsS['!rows'] = SUM_ROWS.map(() => ({ hpt: 20 }));
  XLSX.utils.book_append_sheet(wb, wsS, 'Summary');

  XLSX.writeFile(wb, 'Retirement_Projection.xlsx');
  showToast('Excel downloaded — edit blue cells in Inputs tab!', 'success');
}

// ── CSV Download ──
function downloadCSV() {
  if (!projectionData.length) { showToast('No data to export', 'error'); return; }

  const headers = ['Age','Phase','Starting Taxable','Starting Retirement','Net Return','Contributions','Spending','RMD Gross','RMD Tax','Ret WD Tax','Ending Taxable','Ending Retirement','Total Balance'];
  const rows = projectionData.map(r => [
    r.age, r.phase,
    Math.round(r.taxableStart), Math.round(r.retirementStart),
    Math.round(r.netReturn),    Math.round(r.contributions),
    Math.round(r.spending),     Math.round(r.rmdGross),
    Math.round(r.rmdTax),       Math.round(r.retWdTax),
    Math.round(r.endTaxable),   Math.round(r.endRetirement),
    Math.round(r.totalBalance),
  ]);

  const csv = [headers, ...rows].map(row =>
    row.map(cell => { const s = String(cell); return s.includes(',') ? `"${s}"` : s; }).join(',')
  ).join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: 'Retirement_Projection.csv' }).click();
  URL.revokeObjectURL(url);
  showToast('CSV downloaded', 'success');
}

// ── Google Drive modal ──
function saveToGoogleDrive() { $('drive-modal').style.display = 'flex'; }
function closeModal()        { $('drive-modal').style.display = 'none'; }

function getVal(id) {
  const el = document.getElementById(id);
  return el ? (parseFloat(el.value) || 0) : 0;
}
