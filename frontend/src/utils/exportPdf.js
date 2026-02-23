const pdfStyles = `<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; color: #1f2937; font-size: 13px; background: #fff; }

  /* Header */
  .report-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 24px; margin-bottom: 28px; border-bottom: 3px solid #059669; }
  .report-header .brand { display: flex; align-items: center; gap: 12px; }
  .report-header .brand .logo { width: 48px; height: 48px; background: linear-gradient(135deg, #059669, #10b981); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; color: white; }
  .report-header .brand h1 { font-size: 22px; font-weight: 700; color: #065f46; letter-spacing: -0.5px; }
  .report-header .brand p { font-size: 12px; color: #6b7280; margin-top: 2px; }
  .report-header .meta { text-align: right; }
  .report-header .meta .name { font-size: 14px; font-weight: 600; color: #374151; }
  .report-header .meta .date { font-size: 11px; color: #9ca3af; margin-top: 4px; }
  .report-header .meta .period { display: inline-block; background: #ecfdf5; color: #059669; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; margin-top: 6px; }

  /* Summary Cards */
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin: 24px 0; }
  .summary-card { background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border: 1px solid #d1fae5; border-radius: 14px; padding: 18px 16px; text-align: center; }
  .summary-card .value { font-size: 24px; font-weight: 700; color: #059669; letter-spacing: -0.5px; }
  .summary-card .label { font-size: 11px; font-weight: 500; color: #6b7280; margin-top: 6px; text-transform: uppercase; letter-spacing: 0.5px; }

  /* Section headings */
  .section-title { font-size: 15px; font-weight: 700; color: #1f2937; margin: 28px 0 12px; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; display: flex; align-items: center; gap: 8px; }

  /* Table */
  .data-table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 12px 0; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
  .data-table thead th { background: #f8fafc; color: #374151; padding: 12px 14px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #e5e7eb; }
  .data-table tbody td { padding: 11px 14px; font-size: 12.5px; color: #4b5563; border-bottom: 1px solid #f3f4f6; }
  .data-table tbody tr:last-child td { border-bottom: none; }
  .data-table tbody tr:nth-child(even) { background: #fafbfc; }
  .data-table tbody tr:hover { background: #f0fdf4; }

  /* Footer */
  .report-footer { margin-top: 40px; padding-top: 16px; border-top: 2px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
  .report-footer .left { font-size: 11px; color: #9ca3af; }
  .report-footer .right { font-size: 10px; color: #d1d5db; }
  .report-footer .brand-mark { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; color: #059669; }

  /* Watermark */
  .watermark { position: fixed; bottom: 30px; right: 40px; font-size: 60px; opacity: 0.03; font-weight: 900; color: #059669; transform: rotate(-15deg); pointer-events: none; }

  @media print {
    body { padding: 20px; }
    .data-table tbody tr:hover { background: inherit; }
  }
</style>`;

export function exportPdf({ title, period, summaryCards = [], tableHeaders = [], tableRows = [], userName = '', sections = [] }) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const summaryHtml = summaryCards.length > 0
    ? `<div class="summary-grid">${summaryCards.map(s =>
        `<div class="summary-card"><div class="value">${s.value}</div><div class="label">${s.label}</div></div>`
      ).join('')}</div>`
    : '';

  const mainTableHtml = tableRows.length > 0
    ? `<table class="data-table"><thead><tr>${tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${
        tableRows.map(row => `<tr>${row.map(cell => `<td>${cell ?? '-'}</td>`).join('')}</tr>`).join('')
      }</tbody></table>`
    : '<div style="text-align:center;padding:30px;color:#9ca3af;font-size:13px">No records for this period</div>';

  // Extra sections (for multi-section reports)
  const sectionsHtml = sections.map(s => `
    <div class="section-title">${s.icon || ''} ${s.title}</div>
    ${s.cards ? `<div class="summary-grid">${s.cards.map(c => `<div class="summary-card"><div class="value">${c.value}</div><div class="label">${c.label}</div></div>`).join('')}</div>` : ''}
    ${s.tableHeaders && s.tableRows?.length > 0
      ? `<table class="data-table"><thead><tr>${s.tableHeaders.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${s.tableRows.map(row => `<tr>${row.map(cell => `<td>${cell ?? '-'}</td>`).join('')}</tr>`).join('')}</tbody></table>`
      : s.content || ''
    }
  `).join('');

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title} — DairyPro</title>${pdfStyles}</head><body>
    <div class="watermark">DairyPro</div>

    <div class="report-header">
      <div class="brand">
        <div class="logo">🐄</div>
        <div>
          <h1>DairyPro</h1>
          <p>${title}</p>
        </div>
      </div>
      <div class="meta">
        ${userName ? `<div class="name">${userName}</div>` : ''}
        <div class="date">${dateStr} at ${timeStr}</div>
        ${period ? `<div class="period">📅 ${period}</div>` : ''}
      </div>
    </div>

    ${summaryHtml}
    ${mainTableHtml}
    ${sectionsHtml}

    <div class="report-footer">
      <div class="left">
        <span class="brand-mark">🐄 DairyPro</span> — Smart Dairy Farm Management
      </div>
      <div class="right">Page 1 · Generated automatically · ${dateStr}</div>
    </div>
  </body></html>`;

  const w = window.open('', '_blank');
  if (!w) {
    alert('Please allow popups to download the PDF report.');
    return;
  }
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 600);
}
