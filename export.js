// ── export.js — Download & Google Drive ──

function buildSheetArray() {
  const headers = [
    'Age', 'Phase',
    'Starting Taxable ($)', 'Starting Retirement ($)',
    'Net Return ($)', 'Contributions ($)', 'Spending ($)',
    'Ending Taxable ($)', 'Ending Retirement ($)', 'Total Balance ($)'
  ];
  const rows = projectionData.map(r => [
    r.age, r.phase,
    Math.round(r.taxableStart),
    Math.round(r.retirementStart),
    Math.round(r.netReturn),
    Math.round(r.contributions),
    Math.round(r.spending),
    Math.round(r.endingTaxable),
    Math.round(r.endingRetirement),
    Math.round(r.totalBalance)
  ]);
  return [headers, ...rows];
}

function buildAssumptionsArray() {
  return [
    ['RETIREMENT PROJECTION MODEL — ASSUMPTIONS', ''],
    ['Generated', new Date().toLocaleDateString('en-US', { dateStyle: 'long' })],
    ['', ''],
    ['Parameter', 'Value'],
    ['Starting Age',               getVal('startAge')],
    ['Retirement Age',             getVal('retireAge')],
    ['End Age',                    getVal('endAge')],
    ['Starting Taxable Balance',   getVal('taxableBalance')],
    ['Starting Retirement Balance',getVal('retirementBalance')],
    ['Taxable Return Rate (%)',     getVal('taxableReturn')],
    ['Retirement Return Rate (%)',  getVal('retirementReturn')],
    ['Inflation Rate (%)',          getVal('inflationRate')],
    ['Annual Taxable Contribution', getVal('taxableContrib')],
    ['Annual Retirement Contribution', getVal('retirementContrib')],
    ['Year-1 Retirement Spending', getVal('initialSpending')],
    ['Taxable Withdrawal Split (%)',getVal('taxableWithdrawPct')],
    ['Retirement Tax Gross-Up (%)', getVal('retirementTaxPct')],
    ['', ''],
    ['Note', 'For illustrative purposes only. Not financial advice.'],
  ];
}

// ── Excel download ──
function downloadExcel() {
  if (!projectionData.length) { toast('Run the model first.', 'error'); return; }

  const wb = XLSX.utils.book_new();

  // Projection sheet
  const projWS = XLSX.utils.aoa_to_sheet(buildSheetArray());
  projWS['!cols'] = [6,14,20,22,18,18,18,20,22,18].map(w => ({ wch: w }));
  projWS['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };
  XLSX.utils.book_append_sheet(wb, projWS, 'Projection');

  // Assumptions sheet
  const assWS = XLSX.utils.aoa_to_sheet(buildAssumptionsArray());
  assWS['!cols'] = [{ wch: 36 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, assWS, 'Assumptions');

  XLSX.writeFile(wb, 'Retirement_Projection.xlsx');
  toast('Excel file downloaded', 'success');
}

// ── CSV download (for Google Sheets import) ──
function downloadCSV() {
  if (!projectionData.length) { toast('Run the model first.', 'error'); return; }

  const data = buildSheetArray();
  const csv  = data.map(row =>
    row.map(cell => {
      const s = String(cell);
      return (s.includes(',') || s.includes('"')) ? `"${s.replace(/"/g,'""')}"` : s;
    }).join(',')
  ).join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: 'Retirement_Projection.csv' });
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV downloaded — import into Google Sheets', 'success');
}

// ── Google Drive modal ──
function saveToGoogleDrive() {
  document.getElementById('drive-modal').classList.remove('hidden');
}
function closeModal() {
  document.getElementById('drive-modal').classList.add('hidden');
}
document.getElementById('drive-modal').addEventListener('click', e => {
  if (e.target.id === 'drive-modal') closeModal();
});

// ── Toast ──
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (type ? ' ' + type : '');
  el.classList.remove('hidden');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add('hidden'), 3000);
}
