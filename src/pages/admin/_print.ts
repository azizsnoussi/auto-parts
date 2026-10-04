/* -------------------------------------------------------------------------- */
/*  Printable document generator for ERP commercial documents                  */
/*  (Factures, Avoirs, Devis) — Tunisian fiscal layout.                        */
/*                                                                             */
/*  Opens a self-contained HTML document in a hidden iframe and triggers the   */
/*  browser print dialog. The user can then print on paper or "Save as PDF".   */
/*  No external dependency — works offline and keeps bundle size flat.         */
/* -------------------------------------------------------------------------- */

export interface PrintLine {
  label: string;
  qty: number;
  unitPrice: number; // HT
}

export interface PrintTotals {
  totalHT: number;
  tva: number;
  timbre: number;
  retenue?: number;
  totalTTC: number;
}

export interface PrintDoc {
  /** "Facture", "Avoir", "Devis" … (already localised by the caller). */
  docType: string;
  /** Document number, e.g. FAC-2026-0006. */
  number: string;
  client: string;
  clientMF?: string;
  clientKind?: string;
  issueDate: string; // ISO
  dueOrValidLabel: string; // "Échéance" / "Validité" (localised)
  dueOrValidDate: string; // ISO
  lines: PrintLine[];
  totals: PrintTotals;
  /** Localised labels so the print reads in the active language. */
  labels: {
    seller: string;
    billedTo: string;
    mf: string;
    issue: string;
    designation: string;
    qty: string;
    unitPrice: string;
    lineTotal: string;
    totalHT: string;
    tva: string;
    timbre: string;
    retenue: string;
    totalTTC: string;
    thanks: string;
  };
  /** Seller / company identity — safe defaults provided. */
  seller?: {
    name?: string;
    address?: string;
    mf?: string;
    phone?: string;
  };
}

const DEFAULT_SELLER = {
  name: 'Bouslama Auto',
  address: 'Route de Sousse, Tunisie',
  mf: '0000000/A/M/000',
  phone: '+216 00 000 000',
};

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('fr-TN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(n);
}

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-TN', { dateStyle: 'long' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildHtml(doc: PrintDoc): string {
  const seller = { ...DEFAULT_SELLER, ...(doc.seller ?? {}) };
  const L = doc.labels;

  const rows = doc.lines
    .map(
      (l) => `
        <tr>
          <td class="l">${esc(l.label)}</td>
          <td class="r num">${l.qty}</td>
          <td class="r num">${fmtMoney(l.unitPrice)}</td>
          <td class="r num">${fmtMoney(l.qty * l.unitPrice)}</td>
        </tr>`,
    )
    .join('');

  const retenueRow =
    doc.totals.retenue && doc.totals.retenue > 0
      ? `<tr><td>${esc(L.retenue)}</td><td class="r num">- ${fmtMoney(
          doc.totals.retenue,
        )}</td></tr>`
      : '';

  const timbreRow =
    doc.totals.timbre > 0
      ? `<tr><td>${esc(L.timbre)}</td><td class="r num">${fmtMoney(
          doc.totals.timbre,
        )}</td></tr>`
      : '';

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>${esc(doc.docType)} ${esc(doc.number)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color: #1a1a1a; margin: 0; padding: 32px 40px; font-size: 13px;
  }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 3px solid #caa63c; padding-bottom: 18px; margin-bottom: 22px; }
  .seller h1 { margin: 0 0 6px; font-size: 22px; color: #caa63c; letter-spacing: .5px; }
  .seller p { margin: 1px 0; color: #555; font-size: 12px; }
  .doc { text-align: right; }
  .doc .type { font-size: 20px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
  .doc .num  { font-size: 15px; color: #caa63c; font-weight: 700; margin-top: 2px; }
  .doc .date { color: #666; font-size: 12px; margin-top: 6px; }
  .parties { display: flex; justify-content: space-between; gap: 24px; margin-bottom: 22px; }
  .box { background: #faf7ef; border: 1px solid #ecdfb8; border-radius: 10px; padding: 12px 14px; flex: 1; }
  .box .cap { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #a98b2e; font-weight: 800; margin-bottom: 4px; }
  .box .val { font-weight: 700; font-size: 14px; }
  .box .sub { color: #666; font-size: 12px; margin-top: 2px; }
  table.items { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  table.items thead th { background: #1a1a1a; color: #fff; padding: 8px 10px; font-size: 11px;
    text-transform: uppercase; letter-spacing: .5px; text-align: left; }
  table.items thead th.r { text-align: right; }
  table.items tbody td { padding: 8px 10px; border-bottom: 1px solid #eee; }
  td.r { text-align: right; } td.l { text-align: left; }
  .num { font-variant-numeric: tabular-nums; }
  .totals { width: 300px; margin-left: auto; }
  .totals table { width: 100%; border-collapse: collapse; }
  .totals td { padding: 5px 4px; color: #444; }
  .totals tr.grand td { border-top: 2px solid #1a1a1a; font-size: 15px; font-weight: 800; color: #000; padding-top: 8px; }
  .foot { margin-top: 40px; text-align: center; color: #888; font-size: 11px;
    border-top: 1px solid #eee; padding-top: 14px; }
  @media print { body { padding: 0; } @page { margin: 16mm; } }
</style>
</head>
<body>
  <div class="head">
    <div class="seller">
      <h1>${esc(seller.name)}</h1>
      <p>${esc(seller.address)}</p>
      <p>${esc(L.mf)}: ${esc(seller.mf)}</p>
      <p>${esc(seller.phone)}</p>
    </div>
    <div class="doc">
      <div class="type">${esc(doc.docType)}</div>
      <div class="num">${esc(doc.number)}</div>
      <div class="date">${esc(L.issue)}: ${fmtDate(doc.issueDate)}</div>
      <div class="date">${esc(doc.dueOrValidLabel)}: ${fmtDate(doc.dueOrValidDate)}</div>
    </div>
  </div>

  <div class="parties">
    <div class="box">
      <div class="cap">${esc(L.billedTo)}</div>
      <div class="val">${esc(doc.client)}</div>
      ${doc.clientKind ? `<div class="sub">${esc(doc.clientKind)}</div>` : ''}
      ${
        doc.clientMF && doc.clientMF !== '—'
          ? `<div class="sub">${esc(L.mf)}: ${esc(doc.clientMF)}</div>`
          : ''
      }
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th>${esc(L.designation)}</th>
        <th class="r">${esc(L.qty)}</th>
        <th class="r">${esc(L.unitPrice)}</th>
        <th class="r">${esc(L.lineTotal)}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <table>
      <tr><td>${esc(L.totalHT)}</td><td class="r num">${fmtMoney(doc.totals.totalHT)}</td></tr>
      <tr><td>${esc(L.tva)}</td><td class="r num">${fmtMoney(doc.totals.tva)}</td></tr>
      ${timbreRow}
      ${retenueRow}
      <tr class="grand"><td>${esc(L.totalTTC)}</td><td class="r num">${fmtMoney(doc.totals.totalTTC)} DT</td></tr>
    </table>
  </div>

  <div class="foot">${esc(L.thanks)}</div>
</body>
</html>`;
}

/**
 * Render `doc` into a hidden iframe and open the browser print dialog.
 * Falls back to a new tab if the iframe approach is blocked.
 */
export function printDocument(doc: PrintDoc): void {
  const html = buildHtml(doc);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const cleanup = () => {
    window.setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1000);
  };

  const win = iframe.contentWindow;
  if (!win) {
    // Fallback: open in a new tab.
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    }
    cleanup();
    return;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();

  // Give the browser a tick to lay out before printing.
  window.setTimeout(() => {
    try {
      win.focus();
      win.print();
    } finally {
      cleanup();
    }
  }, 250);
}
