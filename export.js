// ── export.js — Excel, CSV, Google Drive ──

// ── Cell address helpers ──
function colLetter(c) {
  let s = '';
  do { s = String.fromCharCode(65 + (c % 26)) + s; c = Math.floor(c / 26) - 1; } while (c >= 0);
  return s;
}
function addr(col, row) { return colLetter(col) + (row + 1); }

// ── Number formats ──
const FMT_DOLLAR = '_($* #,##0_);_($* (#,##0);_($* "-"_);_(@_)';
const FMT_PCT    = '0.0%';
const FMT_INT    = '#,##0';

// ── Color palette ── (must be 6-char hex, NO #)
const C = {
  // Backgrounds
  navyBg:   '1E3A5F',
  blueBg:   'DBEAFE',
  greenBg:  'DCFCE7',
  amberBg:  'FEF3C7',
  redBg:    'FEE2E2',
  purpleBg: 'EDE9FE',
  whiteBg:  'FFFFFF',
  grayBg:   'F8FAFC',
  slateHdr: 'F1F5F9',
  rowAlt:   'F9FAFB',
  inputBg:  'EFF6FF',
  // Foregrounds
  navyFg:   'FFFFFF',
  blueFg:   '1E40AF',
  greenFg:  '14532D',
  amberFg:  '92400E',
  redFg:    '7F1D1D',
  purpleFg: '4C1D95',
  bodyFg:   '1F2937',
  mutedFg:  '6B7280',
  inputFg:  '1D4ED8',
  // Borders
  border:   'E2E8F0',
  navyBdr:  '1E3A5F',
};

// ── Border builder ──
function bdr(color, style) {
  const b = { style: style || 'thin', color: { rgb: color || C.border } };
  return { top: b, bottom: b, left: b, right: b };
}
function bdrThick(color) {
  return {
    top:    { style: 'medium', color: { rgb: color || C.navyBg } },
    bottom: { style: 'medium', color: { rgb: color || C.navyBg } },
    left:   { style: 'medium', color: { rgb: color || C.navyBg } },
    right:  { style: 'medium', color: { rgb: color || C.navyBg } },
  };
}

// ── Style builder ──
function sty(bg, fg, bold, align, fmt, extra) {
  return {
    font:      { name: 'Calibri', sz: 11, bold: !!bold, color: { rgb: fg || C.bodyFg } },
    fill:      { fgColor: { rgb: bg || C.whiteBg } },
    alignment: { horizontal: align || 'right', vertical: 'center', wrapText: false },
    border:    bdr(C.border),
    ...(extra || {})
  };
}

// ── Set a cell ──
function setCell(ws, col, row, value, numFmt, style) {
  const a = addr(col, row);
  const isFormula = typeof value === 'string' && value.startsWith('=');
  ws[a] = {
    t: isFormula ? 'n' : (typeof value === 'number' ? 'n' : 's'),
    v: isFormula ? undefined : value,
    f: isFormula ? value.slice(1) : undefined,
  };
  if (numFmt) ws[a].z = numFmt;
  if (style)  ws[a].s = style;
}

// ════════════════════════════════════════════════════════
// MAIN EXPORT
// ════════════════════════════════════════════════════════
function downloadExcel() {
  if (!projectionData.length) { showToast('No data to export', 'error'); return; }

  const wb = XLSX.utils.book_new();

  // ════ SHEET 1 — INPUTS ════
  buildInputsSheet(wb);

  // ════ SHEET 2 — PROJECTION ════
  buildProjectionSheet(wb);

  // ════ SHEET 3 — SUMMARY ════
  buildSummarySheet(wb);

  XLSX.writeFile(wb, 'Retirement_Projection.xlsx');
  showToast('Excel downloaded — edit yellow cells in Inputs!', 'success');
}

// ── INPUTS SHEET ──
function buildInputsSheet(wb) {
  const ws = {};

  const inputs = [
    { label: 'RETIREMENT PROJECTION MODEL', isTitle: true },
    { label: 'Edit the yellow cells below. All formulas in the Projection sheet update automatically.', isNote: true },
    { label: null },  // spacer
    { label: 'STARTING POSITION', isSection: true },
    { label: 'Starting Age',                   id: 'startAge',          fmt: FMT_INT    },
    { label: 'End Age',                        id: 'endAge',            fmt: FMT_INT    },
    { label: 'Retirement Age',                 id: 'retireAge',         fmt: FMT_INT    },
    { label: 'Starting Taxable Balance',       id: 'taxableBalance',    fmt: FMT_DOLLAR },
    { label: 'Starting Retirement Balance',    id: 'retirementBalance', fmt: FMT_DOLLAR },
    { label: null },
    { label: 'RETURN RATES', isSection: true },
    { label: 'Taxable Return Rate',            id: 'taxableReturn',     fmt: FMT_PCT,   pct: true },
    { label: 'Retirement Return Rate',         id: 'retirementReturn',  fmt: FMT_PCT,   pct: true },
    { label: 'Inflation Rate',                 id: 'inflationRate',     fmt: FMT_PCT,   pct: true },
    { label: null },
    { label: 'CONTRIBUTIONS', isSection: true },
    { label: 'Annual Taxable Contribution',    id: 'taxableContrib',    fmt: FMT_DOLLAR },
    { label: 'Annual Retirement Contribution', id: 'retirementContrib', fmt: FMT_DOLLAR },
    { label: null },
    { label: 'RETIREMENT SPENDING', isSection: true },
    { label: 'Year-1 Spending',                id: 'initialSpending',   fmt: FMT_DOLLAR },
    { label: null },
    { label: 'TAXES', isSection: true },
    { label: 'Retirement Withdrawal Tax Rate', id: 'retirementTaxPct',  fmt: FMT_PCT,   pct: true },
    { label: 'RMD Tax Rate',                   id: 'rmdTaxPct',         fmt: FMT_PCT,   pct: true },
    { label: null },
    { label: 'MODEL NOTE', isSection: true },
    { label: 'For illustrative purposes only. Not financial advice.', isNote: true },
  ];

  const TITLE_STYLE = { font: { name: 'Calibri Light', sz: 16, bold: true, color: { rgb: C.navyFg } }, fill: { fgColor: { rgb: C.navyBg } }, alignment: { horizontal: 'left', vertical: 'center' }, border: bdrThick(C.navyBg) };
  const NOTE_STYLE  = { font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: C.amberFg } }, fill: { fgColor: { rgb: C.amberBg } }, alignment: { horizontal: 'left', vertical: 'center' }, border: bdr(C.border) };
  const SEC_STYLE   = { font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: C.blueFg } }, fill: { fgColor: { rgb: C.blueBg } }, alignment: { horizontal: 'left', vertical: 'center' }, border: bdr(C.border) };
  const LBL_STYLE   = { font: { name: 'Calibri', sz: 11, color: { rgb: C.bodyFg } }, fill: { fgColor: { rgb: C.whiteBg } }, alignment: { horizontal: 'left', vertical: 'center' }, border: bdr(C.border) };
  const VAL_STYLE   = { font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: C.inputFg } }, fill: { fgColor: { rgb: 'FEFCE8' } }, alignment: { horizontal: 'right', vertical: 'center' }, border: { ...bdr(C.border), left: { style: 'medium', color: { rgb: 'CA8A04' } }, right: { style: 'medium', color: { rgb: 'CA8A04' } } } };
  const SPACER      = { font: { name: 'Calibri', sz: 6 }, fill: { fgColor: { rgb: C.grayBg } }, border: bdr(C.grayBg) };

  let r = 0;
  inputs.forEach(inp => {
    if (inp.isTitle) {
      setCell(ws, 0, r, inp.label, null, TITLE_STYLE);
      setCell(ws, 1, r, '', null, TITLE_STYLE);
      setCell(ws, 2, r, '', null, TITLE_STYLE);
    } else if (inp.isNote) {
      setCell(ws, 0, r, inp.label, null, NOTE_STYLE);
      setCell(ws, 1, r, '', null, NOTE_STYLE);
      setCell(ws, 2, r, '', null, NOTE_STYLE);
    } else if (inp.isSection) {
      setCell(ws, 0, r, inp.label, null, SEC_STYLE);
      setCell(ws, 1, r, '', null, SEC_STYLE);
      setCell(ws, 2, r, '', null, SEC_STYLE);
    } else if (!inp.label) {
      setCell(ws, 0, r, '', null, SPACER);
      setCell(ws, 1, r, '', null, SPACER);
      setCell(ws, 2, r, '', null, SPACER);
    } else {
      const rawVal = getVal(inp.id);
      const val    = inp.pct ? rawVal / 100 : rawVal;
      setCell(ws, 0, r, inp.label, null, LBL_STYLE);
      setCell(ws, 1, r, val, inp.fmt, VAL_STYLE);
      setCell(ws, 2, r, '← edit this cell', null, { font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: C.mutedFg } }, fill: { fgColor: { rgb: C.whiteBg } }, alignment: { horizontal: 'left', vertical: 'center' }, border: bdr(C.border) });
    }
    r++;
  });

  ws['!ref']  = `A1:C${r}`;
  ws['!cols'] = [{ wch: 36 }, { wch: 18 }, { wch: 18 }];
  ws['!rows'] = Array(r).fill(null).map((_, i) => {
    const inp = inputs[i];
    if (!inp || !inp.label) return { hpt: 8 };
    if (inp.isTitle) return { hpt: 30 };
    if (inp.isSection) return { hpt: 22 };
    return { hpt: 20 };
  });
  XLSX.utils.book_append_sheet(wb, ws, 'Inputs');
}

// ── PROJECTION SHEET ──
function buildProjectionSheet(wb) {
  const ws = {};
  const N  = projectionData.length;
  const DS = 1; // data starts at row 1 (0-based), so excel row 2

  // IRS RMD table in hidden helper columns P/Q (cols 15,16)
  const RMD_DATA = [
    [73,26.5],[74,25.5],[75,24.6],[76,23.7],[77,22.9],[78,22.0],[79,21.1],
    [80,20.2],[81,19.4],[82,18.5],[83,17.7],[84,16.8],[85,16.0],[86,15.2],[87,14.4],
    [88,13.7],[89,12.9],[90,12.2],[91,11.5],[92,10.8],[93,10.1],[94,9.5],[95,8.9],
    [96,8.4],[97,7.8],[98,7.3],[99,6.8],[100,6.4],[101,6.0],[102,5.6],[103,5.2],
    [104,4.9],[105,4.6],[106,4.3],[107,4.1],[108,3.9],[109,3.7],[110,3.5],
  ];
  const QC = 15, RC = 16;
  const rmdHdrSty = sty(C.purpleBg, C.purpleFg, true, 'center');
  setCell(ws, QC, 0, 'RMD Age', null, rmdHdrSty);
  setCell(ws, RC, 0, 'Divisor',  null, rmdHdrSty);
  RMD_DATA.forEach(([age, div], i) => {
    const s = sty(C.grayBg, C.mutedFg, false, 'center');
    setCell(ws, QC, i + 1, age, '0',   s);
    setCell(ws, RC, i + 1, div, '0.0', s);
  });
  const RMD_RANGE = `$P$2:$Q$${RMD_DATA.length + 1}`;

  // Column mapping
  const PC = { age:0, phase:1, stTax:2, stRet:3, netRet:4, contrib:5, spending:6, rmdGross:7, rmdTax:8, retWdTax:9, endTax:10, endRet:11, total:12 };

  // Header row
  const HDRS = ['Age','Phase','Starting Taxable','Starting Retirement','Net Return','Contributions','Spending','RMD (Gross)','RMD Tax','Ret. WD Tax','Ending Taxable','Ending Retirement','Total Balance'];
  HDRS.forEach((h, ci) => {
    const isRMD = ci >= 7 && ci <= 9;
    setCell(ws, ci, 0, h, null, {
      font:      { name: 'Calibri', sz: 10, bold: true, color: { rgb: isRMD ? C.purpleFg : C.navyFg } },
      fill:      { fgColor: { rgb: isRMD ? C.purpleBg : C.navyBg } },
      alignment: { horizontal: ci <= 1 ? 'left' : 'center', vertical: 'center', wrapText: true },
      border:    { ...bdr(C.border), bottom: { style: 'medium', color: { rgb: isRMD ? C.purpleFg : 'BFDBFE' } } }
    });
  });

  // Inputs sheet references (row 1-based)
  const INPUT_ROWS = {
    startAge: 5, endAge: 6, retireAge: 7,
    taxableBalance: 8, retirementBalance: 9,
    taxableReturn: 12, retirementReturn: 13, inflationRate: 14,
    taxableContrib: 17, retirementContrib: 18,
    initialSpending: 21,
    retirementTaxPct: 24, rmdTaxPct: 25,
  };
  const I = (key) => `Inputs!$B$${INPUT_ROWS[key]}`;

  const taxR  = I('taxableReturn');
  const retR  = I('retirementReturn');
  const infR  = I('inflationRate');
  const taxC  = I('taxableContrib');
  const retC  = I('retirementContrib');
  const sp0   = I('initialSpending');
  const rAge  = I('retireAge');
  const retTx = I('retirementTaxPct');
  const rmdTx = I('rmdTaxPct');

  // Data rows
  projectionData.forEach((row, ri) => {
    const r        = DS + ri;
    const isFirst  = ri === 0;
    const A = (c) => addr(c, r);
    const P = (c) => addr(c, r - 1); // previous row

    // Retirement year highlight
    const isRetired    = row.isRetired;
    const isRetireStart= row.age === getVal('retireAge');
    const rowBg = isRetireStart ? 'FEF9C3'
                : isRetired     ? 'FFFBEB'
                : ri % 2 === 0  ? C.whiteBg : C.rowAlt;

    const baseSty = (fg, bold) => ({
      font:      { name: 'Calibri', sz: 10, bold: !!bold, color: { rgb: fg || C.bodyFg } },
      fill:      { fgColor: { rgb: rowBg } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    bdr(C.border),
    });

    // Age
    setCell(ws, PC.age, r, row.age, '0', { ...baseSty(C.bodyFg, true), alignment: { horizontal: 'left', vertical: 'center' } });

    // Phase
    const phaseFg = isRetired ? C.amberFg : C.blueFg;
    const phaseBg = isRetired ? 'FEF3C7'  : 'DBEAFE';
    setCell(ws, PC.phase, r, row.phase, null, { font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: phaseFg } }, fill: { fgColor: { rgb: phaseBg } }, alignment: { horizontal: 'center', vertical: 'center' }, border: bdr(C.border) });

    // Starting Taxable
    const stTaxF = isFirst ? `=${I('taxableBalance')}` : `=${P(PC.endTax)}`;
    setCell(ws, PC.stTax, r, stTaxF, FMT_DOLLAR, baseSty(C.bodyFg));

    // Starting Retirement
    const stRetF = isFirst ? `=${I('retirementBalance')}` : `=${P(PC.endRet)}`;
    setCell(ws, PC.stRet, r, stRetF, FMT_DOLLAR, baseSty(C.bodyFg));

    // Net Return
    const netRetF = `=${A(PC.stTax)}*${taxR}+${A(PC.stRet)}*${retR}`;
    setCell(ws, PC.netRet, r, netRetF, FMT_DOLLAR, baseSty(C.greenFg));

    // Contributions
    const contribF = `=IF(${A(PC.phase)}="Accumulation",${taxC}+${retC},0)`;
    setCell(ws, PC.contrib, r, contribF, FMT_DOLLAR, baseSty(C.greenFg));

    // Spending (inflation-compounded)
    let spendF;
    if (isFirst) {
      spendF = `=IF(${A(PC.phase)}="Retirement",${sp0},0)`;
    } else {
      spendF = `=IF(${A(PC.phase)}="Accumulation",0,IF(${P(PC.phase)}="Accumulation",${sp0},${P(PC.spending)}*(1+${infR})))`;
    }
    setCell(ws, PC.spending, r, spendF, FMT_DOLLAR, baseSty(C.redFg));

    // RMD Gross (VLOOKUP into helper table)
    const rmdF = `=IF(AND(${A(PC.phase)}="Retirement",${A(PC.age)}>=73),IFERROR(${A(PC.stRet)}/VLOOKUP(${A(PC.age)},${RMD_RANGE},2,FALSE),0),0)`;
    setCell(ws, PC.rmdGross, r, rmdF, FMT_DOLLAR, {
      font:      { name: 'Calibri', sz: 10, color: { rgb: C.purpleFg } },
      fill:      { fgColor: { rgb: C.purpleBg } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    bdr(C.border),
    });

    // RMD Tax
    setCell(ws, PC.rmdTax, r, `=${A(PC.rmdGross)}*${rmdTx}`, FMT_DOLLAR, {
      font:      { name: 'Calibri', sz: 10, color: { rgb: C.redFg } },
      fill:      { fgColor: { rgb: C.purpleBg } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    bdr(C.border),
    });

    // Intermediate pieces
    const grownRet   = `MAX(0,(${A(PC.stRet)}-${A(PC.rmdGross)})*(1+${retR}))`;
    const afterRmd   = `(${A(PC.rmdGross)}-${A(PC.rmdTax)})`;
    const grownTax   = `(${A(PC.stTax)}*(1+${taxR})+${afterRmd})`;
    const taxableWd  = `MIN(${grownTax},${A(PC.spending)})`;
    const remaining  = `MAX(0,${A(PC.spending)}-${taxableWd})`;
    const retWdGross = `IF(AND(${A(PC.phase)}="Retirement",${remaining}>0),MIN(${grownRet},IF(1-${retTx}>0,${remaining}/(1-${retTx}),${grownRet})),0)`;

    // Ret. WD Tax
    setCell(ws, PC.retWdTax, r, `=${retWdGross}*${retTx}`, FMT_DOLLAR, {
      font:      { name: 'Calibri', sz: 10, color: { rgb: C.redFg } },
      fill:      { fgColor: { rgb: C.purpleBg } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    bdr(C.border),
    });

    // Ending Taxable
    const endTaxF = `=IF(${A(PC.phase)}="Accumulation",${A(PC.stTax)}*(1+${taxR})+${taxC},MAX(0,${grownTax}-${taxableWd}))`;
    setCell(ws, PC.endTax, r, endTaxF, FMT_DOLLAR, {
      font:      { name: 'Calibri', sz: 10, bold: false, color: { rgb: C.bodyFg } },
      fill:      { fgColor: { rgb: C.greenBg } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    bdr(C.border),
    });

    // Ending Retirement
    const endRetF = `=IF(${A(PC.phase)}="Accumulation",${A(PC.stRet)}*(1+${retR})+${retC},MAX(0,${grownRet}-${retWdGross}))`;
    setCell(ws, PC.endRet, r, endRetF, FMT_DOLLAR, {
      font:      { name: 'Calibri', sz: 10, bold: false, color: { rgb: C.bodyFg } },
      fill:      { fgColor: { rgb: C.amberBg } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    bdr(C.border),
    });

    // Total Balance
    setCell(ws, PC.total, r, `=${A(PC.endTax)}+${A(PC.endRet)}`, FMT_DOLLAR, {
      font:      { name: 'Calibri', sz: 10, bold: true, color: { rgb: C.navyBg } },
      fill:      { fgColor: { rgb: C.blueBg } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border:    bdrThick(C.blueFg),
    });
  });

  ws['!ref']    = `A1:Q${DS + N}`;
  ws['!cols']   = [
    {wch:6},{wch:14},{wch:18},{wch:18},{wch:16},{wch:16},{wch:14},
    {wch:14},{wch:12},{wch:14},{wch:18},{wch:18},{wch:16},
    {wch:1},{wch:1},{wch:8},{wch:10},
  ];
  ws['!rows']   = [{ hpt: 30 }, ...Array(N).fill({ hpt: 18 })];
  ws['!freeze'] = { xSplit: 1, ySplit: 1, topLeftCell: 'B2', activePane: 'bottomRight' };
  XLSX.utils.book_append_sheet(wb, ws, 'Projection');
}

// ── SUMMARY SHEET ──
function buildSummarySheet(wb) {
  const ws = {};
  const N  = projectionData.length;
  const lastDataRow = 1 + N; // excel row (1-based)

  const rows = [
    { label: 'SUMMARY METRICS', isTitle: true },
    { label: 'Metric', value: 'Value', isColHdr: true },
    { label: 'Starting Taxable Balance',    value: `=Projection!$C$2`,                                                            fmt: FMT_DOLLAR },
    { label: 'Starting Retirement Balance', value: `=Projection!$D$2`,                                                            fmt: FMT_DOLLAR },
    { label: 'Retirement Age',              value: `=Inputs!$B$7`,                                                                fmt: FMT_INT    },
    { label: 'End Age',                     value: `=Inputs!$B$6`,                                                                fmt: FMT_INT    },
    { label: 'Retirement Years',            value: `=Inputs!$B$6-Inputs!$B$7`,                                                    fmt: '0 "yrs"'  },
    { label: 'Balance at Retirement',       value: `=IFERROR(INDEX(Projection!$M$2:$M$${lastDataRow},MATCH(Inputs!$B$7,Projection!$A$2:$A$${lastDataRow},0)),0)`, fmt: FMT_DOLLAR },
    { label: 'Peak Total Balance',          value: `=MAX(Projection!$M$2:$M$${lastDataRow})`,                                     fmt: FMT_DOLLAR },
    { label: 'Final Balance (End Age)',     value: `=Projection!$M$${lastDataRow}`,                                               fmt: FMT_DOLLAR },
    { label: null },
    { label: 'Total Contributions',        value: `=SUMIF(Projection!$B$2:$B$${lastDataRow},"Accumulation",Projection!$F$2:$F$${lastDataRow})`, fmt: FMT_DOLLAR },
    { label: 'Total Investment Returns',   value: `=SUMPRODUCT(Projection!$E$2:$E$${lastDataRow})`,                              fmt: FMT_DOLLAR },
    { label: 'Total Spending',             value: `=SUMIF(Projection!$B$2:$B$${lastDataRow},"Retirement",Projection!$G$2:$G$${lastDataRow})`, fmt: FMT_DOLLAR },
    { label: null },
    { label: 'Total RMDs Distributed',     value: `=SUM(Projection!$H$2:$H$${lastDataRow})`,                                     fmt: FMT_DOLLAR },
    { label: 'Total RMD Tax Paid',         value: `=SUM(Projection!$I$2:$I$${lastDataRow})`,                                     fmt: FMT_DOLLAR },
    { label: 'Total Ret. WD Tax Paid',     value: `=SUM(Projection!$J$2:$J$${lastDataRow})`,                                     fmt: FMT_DOLLAR },
    { label: 'Total All Taxes Paid',       value: `=SUM(Projection!$I$2:$I$${lastDataRow},Projection!$J$2:$J$${lastDataRow})`,   fmt: FMT_DOLLAR },
    { label: null },
    { label: 'For illustrative purposes only. Not financial advice.', isNote: true },
  ];

  const T_STYLE  = { font: { name: 'Calibri Light', sz: 16, bold: true, color: { rgb: C.navyFg } }, fill: { fgColor: { rgb: C.navyBg } }, alignment: { horizontal: 'left', vertical: 'center' }, border: bdrThick(C.navyBg) };
  const H_STYLE  = (ci) => ({ font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: C.navyFg } }, fill: { fgColor: { rgb: '334155' } }, alignment: { horizontal: ci === 0 ? 'left' : 'right', vertical: 'center' }, border: bdr(C.border) });
  const L_STYLE  = (ri) => ({ font: { name: 'Calibri', sz: 11, color: { rgb: C.bodyFg } }, fill: { fgColor: { rgb: ri % 2 === 0 ? C.whiteBg : C.rowAlt } }, alignment: { horizontal: 'left', vertical: 'center' }, border: bdr(C.border) });
  const V_STYLE  = (ri) => ({ font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: C.blueFg } }, fill: { fgColor: { rgb: C.blueBg } }, alignment: { horizontal: 'right', vertical: 'center' }, border: bdr(C.border) });
  const SP_STYLE = { font: { name: 'Calibri', sz: 6 }, fill: { fgColor: { rgb: C.grayBg } }, border: bdr(C.grayBg) };
  const N_STYLE  = { font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: C.amberFg } }, fill: { fgColor: { rgb: C.amberBg } }, alignment: { horizontal: 'left', vertical: 'center' }, border: bdr(C.border) };

  rows.forEach((row, ri) => {
    if (row.isTitle) {
      setCell(ws, 0, ri, row.label, null, T_STYLE);
      setCell(ws, 1, ri, '',        null, T_STYLE);
    } else if (row.isColHdr) {
      setCell(ws, 0, ri, row.label, null, H_STYLE(0));
      setCell(ws, 1, ri, row.value, null, H_STYLE(1));
    } else if (!row.label) {
      setCell(ws, 0, ri, '', null, SP_STYLE);
      setCell(ws, 1, ri, '', null, SP_STYLE);
    } else if (row.isNote) {
      setCell(ws, 0, ri, row.label, null, N_STYLE);
      setCell(ws, 1, ri, '',        null, N_STYLE);
    } else {
      setCell(ws, 0, ri, row.label, null, L_STYLE(ri));
      setCell(ws, 1, ri, row.value, row.fmt, V_STYLE(ri));
    }
  });

  ws['!ref']  = `A1:B${rows.length}`;
  ws['!cols'] = [{ wch: 36 }, { wch: 22 }];
  ws['!rows'] = rows.map(r => r ? (r.isTitle ? { hpt: 30 } : { hpt: 20 }) : { hpt: 8 });
  XLSX.utils.book_append_sheet(wb, ws, 'Summary');
}

// ── CSV ──
function downloadCSV() {
  if (!projectionData.length) { showToast('No data to export', 'error'); return; }
  const headers = ['Age','Phase','Starting Taxable','Starting Retirement','Net Return','Contributions','Spending','RMD Gross','RMD Tax','Ret WD Tax','Ending Taxable','Ending Retirement','Total Balance'];
  const rows = projectionData.map(r => [
    r.age, r.phase,
    Math.round(r.taxableStart),    Math.round(r.retirementStart),
    Math.round(r.netReturn),       Math.round(r.contributions),
    Math.round(r.spending),        Math.round(r.rmdGross),
    Math.round(r.rmdTax),          Math.round(r.retWdTax),
    Math.round(r.endTaxable),      Math.round(r.endRetirement),
    Math.round(r.totalBalance),
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

// ── getVal for export context ──
function getVal(id) {
  const el = document.getElementById(id);
  return el ? (parseFloat(el.value) || 0) : 0;
}
