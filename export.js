/* ============================================================
   Export helpers — build a real .xlsx workbook and a print-ready
   HTML document from a submission, with no external libraries.

   The workbook is written as minimal OOXML inside a store-only
   ZIP (no compression), which Excel, Numbers and LibreOffice all
   open. The HTML doubles as the applicant's PDF copy: it prints
   cleanly, and the OneDrive flow converts the same file to PDF
   server-side, which keeps non-Latin text intact.
   ============================================================ */

'use strict';

/* ------------------------------------------------------------ bytes */

function utf8Bytes(str) {
  return new TextEncoder().encode(str);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* Store-only ZIP (method 0). Enough for OOXML, and keeps this dependency-free. */
function zipStore(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

  for (const entry of entries) {
    const nameBytes = utf8Bytes(entry.name);
    const data = entry.data;
    const crc = crc32(data);

    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0), // UTF-8 flag
      ...u16(0), ...u16(0),                                       // time, date
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0),
    ];
    chunks.push(new Uint8Array(local), nameBytes, data);

    central.push({
      crc, size: data.length, nameBytes, offset,
    });
    offset += local.length + nameBytes.length + data.length;
  }

  const centralChunks = [];
  let centralSize = 0;
  for (const c of central) {
    const header = [
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(0), ...u16(0),
      ...u32(c.crc), ...u32(c.size), ...u32(c.size),
      ...u16(c.nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(c.offset),
    ];
    centralChunks.push(new Uint8Array(header), c.nameBytes);
    centralSize += header.length + c.nameBytes.length;
  }

  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(central.length), ...u16(central.length),
    ...u32(centralSize), ...u32(offset), ...u16(0),
  ]);

  const all = [...chunks, ...centralChunks, end];
  const total = all.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of all) { out.set(c, p); p += c.length; }
  return out;
}

/* ------------------------------------------------------------ xlsx */

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
    // Excel rejects most control characters outright
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}

function columnName(index) {
  let name = '';
  let n = index;
  while (n >= 0) {
    name = String.fromCharCode(65 + (n % 26)) + name;
    n = Math.floor(n / 26) - 1;
  }
  return name;
}

/**
 * rows: array of arrays of primitives. Everything is written as an inline
 * string, which avoids a shared-string table and never mangles values Excel
 * would otherwise guess at (phone numbers, leading zeros, dates).
 */
function buildXlsx(rows, sheetName = 'Application') {
  const sheetRows = rows.map((cells, r) => {
    const tds = cells.map((value, c) => {
      const ref = `${columnName(c)}${r + 1}`;
      return `<c r="${ref}" t="inlineStr" s="${r === 0 ? 1 : 0}"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
    }).join('');
    return `<row r="${r + 1}">${tds}</row>`;
  }).join('');

  const widest = rows.reduce((max, r) => Math.max(max, r.length), 0);

  const files = [
    ['[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`],

    ['_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`],

    ['xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${xmlEscape(sheetName).slice(0, 31)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`],

    ['xl/_rels/workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`],

    ['xl/styles.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`],

    ['xl/worksheets/sheet1.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="${Math.max(2, widest)}" width="60" customWidth="1"/></cols>
<sheetData>${sheetRows}</sheetData>
</worksheet>`],
  ];

  return zipStore(files.map(([name, xml]) => ({ name, data: utf8Bytes(xml) })));
}

/* ------------------------------------------------------------ printable document */

function buildApplicationHtml(title, sections, meta = {}) {
  const rows = sections.map((section) => `
    <section>
      <h2>${xmlEscape(section.title)}</h2>
      <table>
        ${section.rows.map(([k, v]) => `
          <tr><th>${xmlEscape(k)}</th><td>${xmlEscape(v).replace(/\n/g, '<br />')}</td></tr>`).join('')}
      </table>
    </section>`).join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" />
<title>${xmlEscape(title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.5 -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #14202f; margin: 0; }
  header { border-bottom: 2px solid #204068; padding-bottom: 10px; margin-bottom: 18px; }
  .mark { font-weight: 800; letter-spacing: .04em; color: #204068; font-size: 13pt; }
  h1 { font-size: 16pt; margin: 6px 0 2px; }
  .meta { font-size: 9pt; color: #6b7889; }
  section { margin-bottom: 16px; break-inside: avoid; }
  h2 { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .08em;
       color: #6b7889; margin: 0 0 6px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; vertical-align: top; padding: 5px 8px 5px 0;
           border-bottom: 1px solid #e6eaf1; font-weight: 400; }
  th { width: 34%; color: #6b7889; font-size: 10pt; }
  td { font-size: 10.5pt; }
  footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e6eaf1;
           font-size: 8.5pt; color: #98a3b2; }
</style></head>
<body>
  <header>
    <div class="mark">ISTC</div>
    <h1>${xmlEscape(title)}</h1>
    <p class="meta">${xmlEscape(meta.submittedAt || '')}${meta.reference ? ` · Reference ${xmlEscape(meta.reference)}` : ''}</p>
  </header>
  ${rows}
  <footer>
    Expression of Interest submitted to the ISTC Consultant Database.
    Inclusion in the database does not create any entitlement to, or guarantee of, a contract award.
  </footer>
</body></html>`;
}

/* ------------------------------------------------------------ browser helpers */

if (typeof window !== 'undefined') {
  window.buildXlsx = buildXlsx;
  window.buildApplicationHtml = buildApplicationHtml;

  window.downloadBytes = function downloadBytes(filename, bytes, mime) {
    const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  /* Print-to-PDF in a hidden frame: the browser handles fonts and any
     script, so Cyrillic and other non-Latin answers survive intact. */
  window.printHtmlAsPdf = function printHtmlAsPdf(html) {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(frame);
    frame.srcdoc = html;
    frame.onload = () => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 60000);
    };
  };
}

if (typeof module !== 'undefined') {
  module.exports = { buildXlsx, buildApplicationHtml, zipStore, crc32, utf8Bytes };
}
