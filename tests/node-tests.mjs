/* ============================================================
   Node test suite — the pure-logic half of the tests.
   Run with:  node tests/node-tests.mjs
   (zero dependencies; exits non-zero on any failure)

   The DOM half lives in tests/tests.html — open it in a browser.
   ============================================================ */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const {
  QUESTION_TYPES, DEFAULT_SCHEMA, normalizeSchema, sanitizeId,
  ensureUniqueId, coerceNumber, deepClone, uid, newQuestion, newStep,
} = require(path.join(ROOT, 'schema.js'));

const { buildXlsx, buildApplicationHtml, zipStore, crc32, utf8Bytes } = require(path.join(ROOT, 'export.js'));

/* ------------------------------------------------------------ harness */

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.error(`  ✗ ${name}\n    ${err.message}`);
  }
}

/* ------------------------------------------------------------ normalizeSchema */

console.log('\nnormalizeSchema');

test('default schema normalizes with zero issues', () => {
  const { schema, issues } = normalizeSchema(DEFAULT_SCHEMA);
  assert.equal(issues.length, 0, `unexpected issues: ${issues.join(' | ')}`);
  assert.equal(schema.steps.length, DEFAULT_SCHEMA.steps.length);
  assert.equal(schema.title, DEFAULT_SCHEMA.title);
});

test('null / garbage input falls back to the default form', () => {
  for (const bad of [null, undefined, 42, 'hello', {}, { steps: [] }, { steps: 'nope' }]) {
    const { schema, issues } = normalizeSchema(bad);
    assert.equal(schema.steps.length, DEFAULT_SCHEMA.steps.length);
    assert.ok(issues.length >= 1);
  }
});

const NASTY = {
  title: '',
  steps: [
    {
      title: '',
      questions: [
        { id: 'a b"c]', type: 'radio', title: 'Q1', options: ['One', { value: 'Two' }, null, {}, { label: 'Three' }] },
        { id: 'dup', type: 'no_such_type', title: '' },
        { id: 'dup', type: 'paragraph', title: 'P', minWords: 'abc' },
        'garbage string',
        { id: 'cond', type: 'short_text', title: 'C', showIf: { question: 'ghost', equals: 'x' } },
        { id: 'self', type: 'short_text', title: 'S', showIf: { question: 'self', equals: 'x' } },
        { id: 'empty_opts', type: 'checkbox', title: 'K', options: [], __open: true },
        { id: 'good_cond', type: 'short_text', title: 'G', showIf: { question: 'a_b_c_', equals: 'One' } },
      ],
    },
    null,
    { title: 'No questions key here' },
  ],
};

test('unsafe ids are sanitized to [A-Za-z0-9_-]', () => {
  const { schema } = normalizeSchema(NASTY);
  for (const q of schema.steps.flatMap((s) => s.questions)) {
    assert.match(q.id, /^[A-Za-z0-9_-]+$/, `id "${q.id}" is unsafe`);
  }
});

test('duplicate ids are renamed, all ids unique', () => {
  const { schema } = normalizeSchema(NASTY);
  const ids = schema.steps.flatMap((s) => s.questions.map((q) => q.id));
  assert.equal(new Set(ids).size, ids.length, `duplicates in: ${ids.join(', ')}`);
});

test('a section id may equal a question id — separate namespaces', () => {
  const { schema, issues } = normalizeSchema({
    steps: [{ id: 'expertise', title: 'S', questions: [{ id: 'expertise', type: 'short_text', title: 'Q' }] }],
  });
  assert.equal(issues.length, 0, `unexpected: ${issues.join(' | ')}`);
  assert.equal(schema.steps[0].id, 'expertise');
  assert.equal(schema.steps[0].questions[0].id, 'expertise');
});

test('unknown question type degrades to short_text', () => {
  const { schema } = normalizeSchema(NASTY);
  const q = schema.steps[0].questions[1];
  assert.equal(q.type, 'short_text');
});

test('missing titles get placeholders', () => {
  const { schema } = normalizeSchema(NASTY);
  assert.equal(schema.steps[0].title, 'Section 1');
  assert.equal(schema.steps[0].questions[1].title, 'Untitled question');
});

test('non-numeric minWords is dropped', () => {
  const { schema } = normalizeSchema(NASTY);
  const p = schema.steps[0].questions.find((q) => q.type === 'paragraph');
  assert.ok(!('minWords' in p));
});

test('non-object questions and sections are removed', () => {
  const { schema } = normalizeSchema(NASTY);
  assert.equal(schema.steps.length, 2); // null section removed
  assert.equal(schema.steps[0].questions.length, 7); // 'garbage string' removed
});

test('a section without a questions array survives with []', () => {
  const { schema } = normalizeSchema(NASTY);
  assert.deepEqual(schema.steps[1].questions, []);
});

test('string options are coerced, empty ones dropped', () => {
  const { schema } = normalizeSchema(NASTY);
  const q1 = schema.steps[0].questions[0];
  assert.deepEqual(q1.options.map((o) => o.value), ['One', 'Two', 'Three']);
  assert.deepEqual(q1.options.map((o) => o.label), ['One', 'Two', 'Three']);
});

test('a choice question with no options gets a placeholder option', () => {
  const { schema } = normalizeSchema(NASTY);
  const q = schema.steps[0].questions.find((x) => x.id === 'empty_opts');
  assert.equal(q.options.length, 1);
});

test('dangling and self-referencing showIf are dropped; valid showIf survives', () => {
  const { schema } = normalizeSchema(NASTY);
  const byId = new Map(schema.steps.flatMap((s) => s.questions).map((q) => [q.id, q]));
  assert.ok(!byId.get('cond').showIf, 'dangling showIf kept');
  assert.ok(!byId.get('self').showIf, 'self showIf kept');
  assert.ok(byId.get('good_cond').showIf, 'valid showIf dropped');
});

test('admin-only __open flag never survives', () => {
  const { schema } = normalizeSchema(NASTY);
  for (const q of schema.steps.flatMap((s) => s.questions)) assert.ok(!('__open' in q));
});

test('normalization is idempotent (second pass finds nothing to fix)', () => {
  const first = normalizeSchema(NASTY).schema;
  const { schema: second, issues } = normalizeSchema(first);
  assert.equal(issues.length, 0, `second pass still complained: ${issues.join(' | ')}`);
  assert.deepEqual(second, first);
});

test('every question type from newQuestion() is publishable as-is', () => {
  for (const type of Object.keys(QUESTION_TYPES)) {
    const q = newQuestion(type);
    q.title = 'T';
    const { issues } = normalizeSchema({ steps: [{ title: 'S', questions: [q] }] });
    assert.equal(issues.length, 0, `${type}: ${issues.join(' | ')}`);
  }
});

/* ------------------------------------------------------------ ids */

console.log('\nids');

test('uid() never collides, even within one millisecond', () => {
  const seen = new Set();
  for (let i = 0; i < 5000; i++) seen.add(uid('q'));
  assert.equal(seen.size, 5000);
});

test('ensureUniqueId appends a counter on collision and records the id', () => {
  const taken = new Set(['a', 'a_2']);
  assert.equal(ensureUniqueId('a', taken), 'a_3');
  assert.ok(taken.has('a_3'));
  assert.equal(ensureUniqueId('b', taken), 'b');
});

test('sanitizeId strips everything a querySelector would trip on', () => {
  assert.equal(sanitizeId('ab"c] d\\e'), 'ab_c__d_e');
  assert.equal(sanitizeId(undefined), '');
  assert.equal(sanitizeId('ok-id_9'), 'ok-id_9');
});

test('coerceNumber accepts numbers, rejects junk and negatives', () => {
  assert.equal(coerceNumber('5'), 5);
  assert.equal(coerceNumber(0), 0);
  assert.equal(coerceNumber(''), undefined);
  assert.equal(coerceNumber('abc'), undefined);
  assert.equal(coerceNumber(-1), undefined);
  assert.equal(coerceNumber(null), undefined);
});

test('newStep() always contains one valid question', () => {
  const s = newStep();
  assert.equal(s.questions.length, 1);
  assert.ok(QUESTION_TYPES[s.questions[0].type]);
});

/* ------------------------------------------------------------ publish round-trip */

console.log('\npublish round-trip');

test('the admin import regex recovers exactly what Publish writes', () => {
  const clean = normalizeSchema(DEFAULT_SCHEMA).schema;
  const body = `/* Published form definition — generated by admin.html.\n`
    + `   Commit this file to make the changes live for everyone. */\n\n`
    + `window.PUBLISHED_SCHEMA = ${JSON.stringify(clean, null, 2)};\n`;
  // the exact strip admin.js applies on import
  const text = body.trim()
    .replace(/^[\s\S]*?window\.PUBLISHED_SCHEMA\s*=\s*/, '')
    .replace(/;\s*$/, '');
  assert.deepEqual(JSON.parse(text), clean);
});

test('the committed form-schema.js is valid (null or a normalizable schema)', () => {
  const src = require('node:fs').readFileSync(path.join(ROOT, 'form-schema.js'), 'utf8');
  const win = {};
  new Function('window', src)(win);
  if (win.PUBLISHED_SCHEMA !== null && win.PUBLISHED_SCHEMA !== undefined) {
    const { issues } = normalizeSchema(win.PUBLISHED_SCHEMA);
    assert.equal(issues.length, 0, `published schema needed repairs: ${issues.join(' | ')}`);
  }
});

/* ------------------------------------------------------------ xlsx / zip */

console.log('\nxlsx');

/* Independent CRC32 (bit-by-bit, no table) so a table bug in export.js
   can't hide from its own checksum. */
function crcRef(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function readU16(b, p) { return b[p] | (b[p + 1] << 8); }
function readU32(b, p) { return (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) >>> 0; }

/* Minimal ZIP reader: walks local file headers, checks CRCs, returns
   { name: text } for every stored entry. */
function readZip(bytes) {
  const entries = {};
  let p = 0;
  while (readU32(bytes, p) === 0x04034b50) {
    const crc = readU32(bytes, p + 14);
    const size = readU32(bytes, p + 18);
    const nameLen = readU16(bytes, p + 26);
    const extraLen = readU16(bytes, p + 28);
    const name = new TextDecoder().decode(bytes.subarray(p + 30, p + 30 + nameLen));
    const data = bytes.subarray(p + 30 + nameLen + extraLen, p + 30 + nameLen + extraLen + size);
    assert.equal(crcRef(data), crc, `CRC mismatch in ${name}`);
    entries[name] = new TextDecoder().decode(data);
    p += 30 + nameLen + extraLen + size;
  }
  return { entries, centralOffset: p };
}

const ROWS = [
  ['Section', 'Question', 'Answer'],
  ['Общая информация', 'Имя', 'Тимур Ережепов'],
  ['Docs', 'Tricky <chars> & "quotes"', 'line one\nline two'],
  ['Rates', 'Phone', '0071234567'],
];

test('buildXlsx produces a structurally valid store-only ZIP', () => {
  const bytes = buildXlsx(ROWS, 'Application');
  assert.equal(readU32(bytes, 0), 0x04034b50, 'missing local header signature');
  const { entries, centralOffset } = readZip(bytes);
  assert.deepEqual(Object.keys(entries).sort(), [
    '[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels',
    'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml',
  ].sort());
  // EOCD: last 22 bytes, entry count and central directory offset must agree
  const eocd = bytes.length - 22;
  assert.equal(readU32(bytes, eocd), 0x06054b50, 'missing EOCD');
  assert.equal(readU16(bytes, eocd + 10), 6, 'EOCD entry count');
  assert.equal(readU32(bytes, eocd + 16), centralOffset, 'central directory offset');
});

test('cyrillic, angle brackets and leading zeros survive into the sheet', () => {
  const { entries } = readZip(buildXlsx(ROWS));
  const sheet = entries['xl/worksheets/sheet1.xml'];
  assert.ok(sheet.includes('Тимур Ережепов'), 'cyrillic lost');
  assert.ok(sheet.includes('Tricky &lt;chars&gt; &amp; &quot;quotes&quot;'), 'escaping wrong');
  assert.ok(sheet.includes('0071234567'), 'leading zeros lost');
  assert.ok(sheet.includes('xml:space="preserve"'), 'whitespace not preserved');
  assert.ok(!/<c [^>]*>(?!<is>)/.test(sheet.replace(/<c ([^>]*)><is>/g, '')), 'non-inline cells present');
});

test('control characters are stripped, newlines kept', () => {
  const { entries } = readZip(buildXlsx([['ab\nc']]));
  const sheet = entries['xl/worksheets/sheet1.xml'];
  assert.ok(sheet.includes('ab\nc'), 'bell char not stripped or newline lost');
});

test('sheet name is escaped and capped at 31 chars', () => {
  const { entries } = readZip(buildXlsx([['x']], 'A very <long> & strange workbook name indeed'));
  const wb = entries['xl/workbook.xml'];
  const m = wb.match(/<sheet name="([^"]*)"/);
  assert.ok(m, 'no sheet name');
  assert.ok(m[1].length <= 31 + 9, `name too long: ${m[1]}`); // +9 allows &amp;/&lt; entities
  assert.ok(!m[1].includes('<'), 'raw < in sheet name');
});

test('zipStore round-trips arbitrary binary data', () => {
  const data = new Uint8Array(256).map((_, i) => i);
  const bytes = zipStore([{ name: 'bin.dat', data }]);
  const size = readU32(bytes, 18);
  assert.equal(size, 256);
  assert.equal(crc32(data), crcRef(data), 'export crc32 disagrees with reference');
});

/* ------------------------------------------------------------ printable html */

console.log('\nprintable html');

test('answers are escaped — a hostile answer cannot inject markup', () => {
  const html = buildApplicationHtml('T', [
    { title: 'S', rows: [['Q', '<script>alert(1)</script>'], ['K', 'a\nb']] },
  ], { reference: '<img src=x>' });
  assert.ok(!html.includes('<script>alert'), 'script injected');
  assert.ok(html.includes('&lt;script&gt;'), 'answer not escaped');
  assert.ok(!html.includes('<img src=x>'), 'meta not escaped');
  assert.ok(html.includes('a<br />b'), 'newline not converted');
});

test('cyrillic titles and answers appear verbatim', () => {
  const html = buildApplicationHtml('Заявка', [{ title: 'Секция', rows: [['Вопрос', 'Ответ']] }]);
  for (const word of ['Заявка', 'Секция', 'Вопрос', 'Ответ']) assert.ok(html.includes(word), `${word} missing`);
});

/* ------------------------------------------------------------ summary */

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
