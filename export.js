// ── export.js — Excel, CSV, Google Drive ──

// ── Build raw data arrays ──
function buildProjectionRows() {
  return projectionData.map(r => [
    r.age,
    r.phase,
    Math.round(r.taxableStart),
    Math.round(r.retirementStart),
    Math.round(r.netReturn),
    Math.round(r.contributions),
    Math.round(r.spending),
    Math.round(r.endTaxable),
    Math.round(r.endRetirement),
    Math.round(r.totalBalance),
  ]);
}

function buildAssumptionRows() {
  return [
    ['Parameter', 'Value'],
    ['— Starting Position —', ''],
    ['Starting Age',                   getVal('startAge')],
    ['Retirement Age',                 getVal('retireAge')],
    ['End Age',                        getVal('endAge')],
    ['Starting Taxable Balance',       getVal('taxableBalance')],
    ['Starting Retirement Balance',    getVal('retirementBalance')],
    ['— Return Rates —', ''],
    ['Taxable Return Rate (%)',         getVal('taxableReturn')],
    ['Retirement Account Return (%)',   getVal('retirementReturn')],
    ['Inflation Rate (%)',              getVal('inflationRate')],
    ['— Contributions —', ''],
    ['Annual Taxable Contribution',     getVal('taxableContrib')],
    ['Annual Retirement Contribution',  getVal('retirementContrib')],
    ['— Retirement Spending —', ''],
    ['Year-1 Spending',                 getVal('initialSpending')],
    ['Taxable Withdrawal Split (%)',    getVal('taxableWithdrawPct')],
    ['Retirement Tax Gross-Up (%)',     getVal('retirementTaxPct')],
    ['', ''],
    ['Note', 'For illustrative purposes only. Not financial advice.'],
  ];
}

// ── XLSX helpers ──
function cellAddr(col, row) {
  // col is 0-based, row is 0-based
  let colStr = '';
  let c = col;
  do {
    colStr = String.fromCharCode(65 + (c % 26)) + colStr;
    c = Math.floor(c / 26) - 1;
  } while (c >= 0);
  return colStr + (row + 1);
}

function applyStyle(ws, addr, style) {
  if (!ws[addr]) ws[addr] = { t: 'z', v: '' };
  ws[addr].s = style;
}

// ── Build formatted Excel workbook ──
function downloadExcel() {
  if (!projectionData.length) { showToast('No data to export', 'error'); return; }

  const wb = XLSX.utils.book_new();

  // ═══ SHEET 1: PROJECTION ═══
  const headers = [
    'Age', 'Phase',
    'Starting Taxable', 'Starting Retirement',
    'Net Return', 'Contributions', 'Spending',
    'Ending Taxable', 'Ending Retirement', 'Total Balance'
  ];

  const projRows = buildProjectionRows();
  const projData = [headers, ...projRows];
  const ws1 = XLSX.utils.aoa_to_sheet(projData);

  // Column widths
  ws1['!cols'] = [
    { wch: 6 },   // Age
    { wch: 14 },  // Phase
    { wch: 18 },  // Starting Taxable
    { wch: 20 },  // Starting Retirement
    { wch: 16 },  // Net Return
    { wch: 16 },  // Contributions
    { wch: 14 },  // Spending
    { wch: 18 },  // Ending Taxable
    { wch: 20 },  // Ending Retirement
    { wch: 16 },  // Total Balance
  ];

  // Freeze header row
  ws1['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };

  const numCols  = [2,3,4,5,6,7,8,9]; // 0-based, columns with $ values
  const retireAge = getVal('retireAge');

  // Style each row
  projRows.forEach((row, ri) => {
    const excelRow = ri + 1; // +1 for header
    const isRetired  = row[1] === 'Retirement';
    const isRetireStart = row[0] === retireAge;

    const rowBg = isRetireStart
      ? 'FFFDE7'   // amber tint for retirement start
      : isRetired
        ? 'FFFDF5'  // very light amber for retirement rows
        : 'FFFFFF'; // white for accumulation

    for (let ci = 0; ci < 10; ci++) {
      const addr = cellAddr(ci, excelRow);
      if (!ws1[addr]) continue;

      const isNumCol = numCols.includes(ci);
      const val      = row[ci];

      // Number format for money columns
      if (isNumCol && typeof val === 'number') {
        ws1[addr].t = 'n';
        ws1[addr].z = '_($* #,##0_);_($* (#,##0);_($* "-"_);_(@_)';
      }

      ws1[addr].s = {
        fill: { fgColor: { rgb: rowBg } },
        font: {
          name: 'Calibri',
          sz: 11,
          bold: ci === 9, // bold Total Balance
          color: {
            rgb: ci === 4 && val > 0 ? '15803D'   // green for net return
               : ci === 4 && val < 0 ? 'B91C1C'   // red for negative
               : ci === 5 && val > 0 ? '15803D'   // green for contributions
               : ci === 6 && val > 0 ? 'B91C1C'   // red for spending
               : ci === 9            ? '1E3A5F'   // dark blue for total
               : '374151'
          }
        },
        alignment: {
          horizontal: (ci === 0 || ci === 1) ? 'left' : 'right',
          vertical: 'center'
        },
        border: {
          top:    { style: isRetireStart ? 'medium' : 'thin', color: { rgb: isRetireStart ? 'B45309' : 'E5E7EB' } },
          bottom: { style: 'thin', color: { rgb: isRetireStart ? 'B45309' : 'E5E7EB' } },
          left:   { style: 'thin', color: { rgb: 'E5E7EB' } },
          right:  { style: 'thin', color: { rgb: 'E5E7EB' } },
        }
      };
    }
  });

  // Style header row
  for (let ci = 0; ci < 10; ci++) {
    const addr = cellAddr(ci, 0);
    if (!ws1[addr]) continue;
    ws1[addr].s = {
      fill: { fgColor: { rgb: '1E3A5F' } },
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      alignment: { horizontal: (ci === 0 || ci === 1) ? 'left' : 'right', vertical: 'center' },
      border: {
        top:    { style: 'thin', color: { rgb: '1E3A5F' } },
        bottom: { style: 'medium', color: { rgb: '93C5FD' } },
        left:   { style: 'thin', color: { rgb: '1E3A5F' } },
        right:  { style: 'thin', color: { rgb: '1E3A5F' } },
      }
    };
  }

  XLSX.utils.book_append_sheet(wb, ws1, 'Projection');

  // ═══ SHEET 2: ASSUMPTIONS ═══
  const assumpRows = buildAssumptionRows();
  const ws2 = XLSX.utils.aoa_to_sheet(assumpRows);
  ws2['!cols'] = [{ wch: 36 }, { wch: 24 }];

  assumpRows.forEach((row, ri) => {
    const isHeader    = ri === 0;
    const isSection   = typeof row[0] === 'string' && row[0].startsWith('—');
    const isNote      = row[0] === 'Note';
    const isBlank     = row[0] === '' && row[1] === '';

    for (let ci = 0; ci < 2; ci++) {
      const addr = cellAddr(ci, ri);
      if (!ws2[addr]) continue;

      // Format numbers
      if (ci === 1 && typeof row[1] === 'number' && row[1] > 100) {
        ws2[addr].t = 'n';
        ws2[addr].z = '_($* #,##0_);_($* (#,##0);_($* "-"_);_(@_)';
      }

      ws2[addr].s = isHeader ? {
        fill: { fgColor: { rgb: '1E3A5F' } },
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: { bottom: { style: 'medium', color: { rgb: '93C5FD' } } }
      } : isSection ? {
        fill: { fgColor: { rgb: 'EFF6FF' } },
        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '1D4ED8' } },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: { top: { style: 'thin', color: { rgb: 'BFDBFE' } }, bottom: { style: 'thin', color: { rgb: 'BFDBFE' } } }
      } : isNote ? {
        fill: { fgColor: { rgb: 'FFF7ED' } },
        font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '92400E' } },
        alignment: { horizontal: 'left', vertical: 'center' }
      } : {
        fill: { fgColor: { rgb: 'FFFFFF' } },
        font: { name: 'Calibri', sz: 11, color: { rgb: ci === 0 ? '374151' : '111827' } },
        alignment: { horizontal: ci === 0 ? 'left' : 'right', vertical: 'center' },
        border: { bottom: { style: 'thin', color: { rgb: 'F3F4F6' } } }
      };
    }
  });

  XLSX.utils.book_append_sheet(wb, ws2, 'Assumptions');

  // ═══ SHEET 3: CHART DATA (for Excel to auto-chart) ═══
  const chartHeaders = ['Age', 'Total Balance', 'Taxable', 'Retirement'];
  const chartRows = projectionData.map(r => [
    r.age,
    Math.round(r.totalBalance),
    Math.round(r.endTaxable),
    Math.round(r.endRetirement),
  ]);
  const ws3 = XLSX.utils.aoa_to_sheet([chartHeaders, ...chartRows]);
  ws3['!cols'] = [{ wch: 8 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Chart Data');

  XLSX.writeFile(wb, 'Retirement_Projection.xlsx');
  showToast('Excel downloaded!', 'success');
}

// ── CSV Download ──
function downloadCSV() {
  if (!projectionData.length) { showToast('No data to export', 'error'); return; }

  const headers = ['Age','Phase','Starting Taxable','Starting Retirement','Net Return','Contributions','Spending','Ending Taxable','Ending Retirement','Total Balance'];
  const rows    = buildProjectionRows();
  const all     = [headers, ...rows];

  const csv = all.map(row =>
    row.map(cell => {
      const s = String(cell);
      return (s.includes(',') || s.includes('"')) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')
  ).join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'Retirement_Projection.csv' });
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV downloaded — import into Google Sheets', 'success');
}

// ── Google Drive modal ──
function saveToGoogleDrive() {
  $('drive-modal').style.display = 'flex';
}
function closeModal() {
  $('drive-modal').style.display = 'none';
}

// ── re-export getVal for export.js context ──
function getVal(id) {
  const el = document.getElementById(id);
  return el ? (parseFloat(el.value) || 0) : 0;
}
