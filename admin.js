/* ============================================================
   Form editor — a Google-Forms-style builder for schema.js.
   Sections, questions, types, options, required, validation,
   drag reorder, preview, import/export.
   ============================================================ */

'use strict';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

let schema = loadSchema();
let activeSection = 0;

const esc2 = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ------------------------------------------------------------ theme */

const themeToggle = $('#themeToggle');
themeToggle.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('istc-theme', next); } catch (_) { /* ignore */ }
});

/* ------------------------------------------------------------ persistence */

/* Every id currently in the schema — duplicated sections/questions must
   pick ids that collide with none of them. */
function allSchemaIds() {
  const ids = new Set();
  schema.steps.forEach((s) => { ids.add(s.id); s.questions.forEach((q) => ids.add(q.id)); });
  return ids;
}

/* A deleted question may be the source of other questions' "show only if".
   Left dangling, those questions would be hidden forever on the live form. */
function dropDanglingShowIf(removedIds) {
  schema.steps.forEach((s) => s.questions.forEach((q) => {
    if (q.showIf && removedIds.has(q.showIf.question)) delete q.showIf;
  }));
}

/* Renaming an option must follow through to conditions that match on it. */
function renameShowIfValue(sourceQuestionId, oldValue, newValue) {
  if (oldValue === newValue) return;
  schema.steps.forEach((s) => s.questions.forEach((q) => {
    if (q.showIf && q.showIf.question === sourceQuestionId && q.showIf.equals === oldValue) {
      q.showIf.equals = newValue;
    }
  }));
}

let savedTimer = null;
function persist() {
  saveSchema(schema);
  const badge = $('#savedState');
  badge.textContent = 'Saved';
  badge.classList.add('is-on');
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => badge.classList.remove('is-on'), 1600);
}

/* ------------------------------------------------------------ sections */

function renderSectionList() {
  $('#sectionList').innerHTML = schema.steps.map((s, i) => `
    <li class="section-item${i === activeSection ? ' is-active' : ''}" data-section="${i}" draggable="true">
      <span class="section-num">${i + 1}</span>
      <span class="section-name">${esc2(s.title || 'Untitled section')}</span>
      <span class="section-count">${s.questions.length}</span>
      <span class="section-tools">
        <button type="button" class="mini" data-dup-section="${i}" title="Duplicate">⧉</button>
        <button type="button" class="mini mini-danger" data-del-section="${i}" title="Delete">×</button>
      </span>
    </li>`).join('');
}

$('#sectionList').addEventListener('click', (e) => {
  const dup = e.target.closest('[data-dup-section]');
  const del = e.target.closest('[data-del-section]');
  const item = e.target.closest('[data-section]');

  if (dup) {
    const i = Number(dup.dataset.dupSection);
    const copy = deepClone(schema.steps[i]);
    const taken = allSchemaIds();
    copy.id = ensureUniqueId(`${copy.id}_copy`, taken);
    copy.title = `${copy.title} (copy)`;
    // Re-point conditions that referenced a sibling inside this section at
    // the sibling's copy; conditions on questions elsewhere stay as they are.
    const remap = new Map();
    copy.questions.forEach((q) => {
      const fresh = ensureUniqueId(`${q.id}_copy`, taken);
      remap.set(q.id, fresh);
      q.id = fresh;
    });
    copy.questions.forEach((q) => {
      if (q.showIf && remap.has(q.showIf.question)) q.showIf.question = remap.get(q.showIf.question);
    });
    schema.steps.splice(i + 1, 0, copy);
    activeSection = i + 1;
    persist();
    return renderAll();
  }
  if (del) {
    const i = Number(del.dataset.delSection);
    if (schema.steps.length === 1) return alert('A form needs at least one section.');
    if (!confirm(`Delete section “${schema.steps[i].title}” and its ${schema.steps[i].questions.length} question(s)?`)) return;
    const removedIds = new Set(schema.steps[i].questions.map((q) => q.id));
    schema.steps.splice(i, 1);
    dropDanglingShowIf(removedIds);
    activeSection = Math.max(0, Math.min(activeSection, schema.steps.length - 1));
    persist();
    return renderAll();
  }
  if (item) { activeSection = Number(item.dataset.section); renderAll(); }
});

$('#addSectionBtn').addEventListener('click', () => {
  schema.steps.push(newStep());
  activeSection = schema.steps.length - 1;
  persist();
  renderAll();
});

/* Drag to reorder sections */
let dragSection = null;
$('#sectionList').addEventListener('dragstart', (e) => {
  const item = e.target.closest('[data-section]');
  if (!item) return;
  dragSection = Number(item.dataset.section);
  item.classList.add('dragging');
});
$('#sectionList').addEventListener('dragend', (e) => {
  e.target.closest('[data-section]')?.classList.remove('dragging');
  dragSection = null;
});
$('#sectionList').addEventListener('dragover', (e) => {
  e.preventDefault();
  const over = e.target.closest('[data-section]');
  if (!over || dragSection == null) return;
  const to = Number(over.dataset.section);
  if (to === dragSection) return;
  const [moved] = schema.steps.splice(dragSection, 1);
  schema.steps.splice(to, 0, moved);
  activeSection = to;
  dragSection = to;
  persist();
  renderAll();
});

/* ------------------------------------------------------------ section header fields */

function bindSectionField(id, key) {
  const el = document.getElementById(id);
  el.addEventListener('input', () => {
    schema.steps[activeSection][key] = el.value;
    if (key === 'title') renderSectionList();
    persist();
  });
}

bindSectionField('sectionTitle', 'title');
bindSectionField('sectionSubtitle', 'subtitle');
bindSectionField('sectionNav', 'navLabel');

$('#sectionIcon').innerHTML = Object.keys(ICONS)
  .map((n) => `<option value="${n}">${n}</option>`).join('');
$('#sectionIcon').addEventListener('change', () => {
  schema.steps[activeSection].icon = $('#sectionIcon').value;
  persist();
});

$('#formTitle').addEventListener('input', () => { schema.title = $('#formTitle').value; persist(); });
$('#formDesc').addEventListener('input', () => { schema.description = $('#formDesc').value; persist(); });

/* ------------------------------------------------------------ questions */

function typeOptions(selected) {
  return Object.entries(QUESTION_TYPES)
    .map(([key, meta]) => `<option value="${key}"${key === selected ? ' selected' : ''}>${meta.label}</option>`)
    .join('');
}

function optionRows(q, qi) {
  return (q.options || []).map((o, oi) => `
    <div class="opt-row" draggable="true" data-q="${qi}" data-opt="${oi}">
      <span class="opt-grip" aria-hidden="true">⠿</span>
      <span class="opt-marker${q.type === 'checkbox' ? ' square' : ''}" aria-hidden="true"></span>
      <input class="admin-input opt-input" data-q="${qi}" data-opt="${oi}" data-k="label"
             value="${esc2(o.label ?? o.value)}" placeholder="Option ${oi + 1}" />
      <input class="admin-input opt-input opt-desc" data-q="${qi}" data-opt="${oi}" data-k="desc"
             value="${esc2(o.desc || '')}" placeholder="Description (optional)" />
      <select class="admin-input opt-icon" data-q="${qi}" data-opt="${oi}" data-k="icon">
        <option value="">no icon</option>
        ${Object.keys(ICONS).map((n) => `<option value="${n}"${o.icon === n ? ' selected' : ''}>${n}</option>`).join('')}
      </select>
      <button type="button" class="mini mini-danger" data-del-opt="${oi}" data-q="${qi}" title="Remove option">×</button>
    </div>`).join('');
}

function settingRow(label, control) {
  return `<label class="setting"><span>${label}</span>${control}</label>`;
}

function questionSettings(q, qi) {
  const fields = QUESTION_TYPES[q.type]?.fields || [];
  const bits = [];

  if (fields.includes('placeholder')) {
    bits.push(settingRow('Placeholder',
      `<input class="admin-input" data-q="${qi}" data-set="placeholder" value="${esc2(q.placeholder || '')}" />`));
  }
  if (fields.includes('minWords')) {
    bits.push(settingRow('Minimum words',
      `<input class="admin-input" type="number" min="0" data-q="${qi}" data-set="minWords" value="${esc2(q.minWords || '')}" />`));
  }
  if (fields.includes('source')) {
    bits.push(settingRow('Autocomplete list',
      `<select class="admin-input" data-q="${qi}" data-set="source">
         <option value="">none</option>
         ${['countries', 'nationalities', 'languages'].map((s) => `<option value="${s}"${q.source === s ? ' selected' : ''}>${s}</option>`).join('')}
       </select>`));
  }
  if (fields.includes('pattern')) {
    bits.push(settingRow('Text rule',
      `<select class="admin-input" data-q="${qi}" data-set="pattern">
         <option value="">any text</option>
         <option value="name"${q.pattern === 'name' ? ' selected' : ''}>looks like a name</option>
         <option value="letters"${q.pattern === 'letters' ? ' selected' : ''}>letters only</option>
       </select>`));
  }
  if (fields.includes('layout')) {
    bits.push(settingRow('Layout',
      `<select class="admin-input" data-q="${qi}" data-set="layout">
         <option value="">stacked</option>
         <option value="row"${q.layout === 'row' ? ' selected' : ''}>side by side</option>
         <option value="grid"${q.layout === 'grid' ? ' selected' : ''}>two-column grid</option>
       </select>`));
  }
  if (fields.includes('allowOther')) {
    bits.push(settingRow('“Other” option',
      `<input type="checkbox" data-q="${qi}" data-set="allowOther"${q.allowOther ? ' checked' : ''} />`));
  }
  if (fields.includes('maxMB')) {
    bits.push(settingRow('Max file size (MB)',
      `<input class="admin-input" type="number" min="1" data-q="${qi}" data-set="maxMB" value="${esc2(q.maxMB || 10)}" />`));
  }
  if (fields.includes('accept')) {
    bits.push(settingRow('Accepted types',
      `<input class="admin-input" data-q="${qi}" data-set="accept" value="${esc2(q.accept || '')}" placeholder=".pdf,.docx" />`));
  }
  if (fields.includes('maxItems')) {
    bits.push(settingRow('Maximum entries',
      `<input class="admin-input" type="number" min="1" max="10" data-q="${qi}" data-set="maxItems" value="${esc2(q.maxItems || 3)}" />`));
  }
  if (fields.includes('prefix')) {
    bits.push(settingRow('Prefix', `<input class="admin-input" data-q="${qi}" data-set="prefix" value="${esc2(q.prefix || '')}" />`));
    bits.push(settingRow('Suffix', `<input class="admin-input" data-q="${qi}" data-set="suffix" value="${esc2(q.suffix || '')}" />`));
  }
  if (fields.includes('min')) {
    bits.push(settingRow('Minimum value',
      `<input class="admin-input" type="number" data-q="${qi}" data-set="min" value="${esc2(q.min ?? '')}" />`));
    bits.push(settingRow('Maximum value',
      `<input class="admin-input" type="number" data-q="${qi}" data-set="max" value="${esc2(q.max ?? '')}" />`));
  }
  if (fields.includes('body')) {
    bits.push(`<label class="setting setting-wide"><span>Statement text</span>
      <textarea class="admin-input" rows="4" data-q="${qi}" data-set="body">${esc2(q.body || '')}</textarea></label>`);
    bits.push(settingRow('Consent label',
      `<input class="admin-input" data-q="${qi}" data-set="consentLabel" value="${esc2(q.consentLabel || 'I agree')}" />`));
  }

  bits.push(settingRow('Half width',
    `<input type="checkbox" data-q="${qi}" data-set="half"${q.half ? ' checked' : ''} />`));
  bits.push(settingRow('Hide the question title',
    `<input type="checkbox" data-q="${qi}" data-set="hideTitle"${q.hideTitle ? ' checked' : ''} />`));

  // Conditional display
  const others = schema.steps.flatMap((s) => s.questions)
    .filter((o) => o.id !== q.id && ['radio', 'checkbox', 'dropdown', 'scale'].includes(o.type));
  bits.push(settingRow('Show only if',
    `<select class="admin-input" data-q="${qi}" data-set="showIfQuestion">
       <option value="">always show</option>
       ${others.map((o) => `<option value="${esc2(o.id)}"${q.showIf?.question === o.id ? ' selected' : ''}>${esc2(o.title)}</option>`).join('')}
     </select>`));
  if (q.showIf?.question) {
    const src = others.find((o) => o.id === q.showIf.question);
    bits.push(settingRow('…equals',
      `<select class="admin-input" data-q="${qi}" data-set="showIfEquals">
         ${(src?.options || []).map((o) => `<option value="${esc2(o.value)}"${q.showIf.equals === o.value ? ' selected' : ''}>${esc2(o.label ?? o.value)}</option>`).join('')}
       </select>`));
  }

  return `<div class="q-settings">${bits.join('')}</div>`;
}

function renderQuestions() {
  const step = schema.steps[activeSection];
  $('#questionList').innerHTML = step.questions.map((q, qi) => {
    const meta = QUESTION_TYPES[q.type] || QUESTION_TYPES.short_text;
    const hasOptions = (QUESTION_TYPES[q.type]?.fields || []).includes('options');
    return `
      <article class="q-card${q.__open ? ' is-open' : ''}" data-q="${qi}" draggable="true">
        <div class="q-grip" aria-hidden="true">⠿</div>

        <div class="q-main">
          <div class="q-top">
            <input class="admin-input q-title" data-q="${qi}" data-set="title"
                   value="${esc2(q.title)}" placeholder="Question" />
            <select class="admin-input q-type" data-q="${qi}" data-type-select>
              ${typeOptions(q.type)}
            </select>
          </div>

          <input class="admin-input q-help" data-q="${qi}" data-set="help"
                 value="${esc2(q.help || '')}" placeholder="Help text shown under the question (optional)" />

          ${hasOptions ? `
            <div class="opt-list" data-optlist="${qi}">${optionRows(q, qi)}</div>
            <button type="button" class="admin-add admin-add-sm" data-add-opt="${qi}">
              <span aria-hidden="true">+</span> Add option
            </button>` : `
            <p class="q-native">${esc2(meta.label)} — rendered by the form's built-in widget.</p>`}

          ${q.__open ? questionSettings(q, qi) : ''}

          <div class="q-foot">
            <label class="q-required">
              <input type="checkbox" data-q="${qi}" data-set="required"${q.required ? ' checked' : ''} />
              <span>Required</span>
            </label>
            <span class="q-id">id: <code>${esc2(q.id)}</code></span>
            <span class="q-foot-tools">
              <button type="button" class="mini" data-toggle-settings="${qi}">${q.__open ? 'Hide settings' : 'Settings'}</button>
              <button type="button" class="mini" data-dup-q="${qi}" title="Duplicate">⧉</button>
              <button type="button" class="mini mini-danger" data-del-q="${qi}" title="Delete">×</button>
            </span>
          </div>
        </div>
      </article>`;
  }).join('');
}

/* --- question events --- */

const list = $('#questionList');

list.addEventListener('input', (e) => {
  const el = e.target;
  const step = schema.steps[activeSection];
  const qi = Number(el.dataset.q);
  if (Number.isNaN(qi)) return;
  const q = step.questions[qi];

  if (el.dataset.set) {
    const key = el.dataset.set;
    // The showIf selects have their own handler below; letting the generic
    // one see them would write stray showIfQuestion/showIfEquals keys.
    if (key === 'showIfQuestion' || key === 'showIfEquals') return;

    let value = el.type === 'checkbox' ? el.checked : el.value;
    if (['minWords', 'maxMB', 'maxItems', 'min', 'max'].includes(key)) {
      value = value === '' ? undefined : Number(value);
      if (Number.isNaN(value)) value = undefined; // never persist NaN
    }
    // title is not optional — code downstream builds error messages from it
    if (key === 'title') { q.title = String(value || ''); persist(); return; }
    if (value === '' || value === false || value === undefined) delete q[key]; else q[key] = value;
    persist();
    return;
  }

  if (el.dataset.opt != null && el.dataset.k) {
    const opt = q.options[Number(el.dataset.opt)];
    const k = el.dataset.k;
    if (k === 'label') {
      const oldValue = opt.value;
      opt.label = el.value; opt.value = el.value;
      renameShowIfValue(q.id, oldValue, el.value);
    }
    else if (el.value) opt[k] = el.value;
    else delete opt[k];
    persist();
  }
});

list.addEventListener('change', (e) => {
  const el = e.target;
  const step = schema.steps[activeSection];
  const qi = Number(el.dataset.q);
  if (Number.isNaN(qi)) return;
  const q = step.questions[qi];

  if (el.hasAttribute('data-type-select')) {
    const nextFields = QUESTION_TYPES[el.value]?.fields || [];
    const losesOptions = q.options?.length > 1 && !nextFields.includes('options');
    if (losesOptions && !confirm(`“${el.value}” has no options — the ${q.options.length} options on this question will be removed. Continue?`)) {
      el.value = q.type; // put the dropdown back
      return;
    }
    q.type = el.value;
    const fields = nextFields;
    const needsOptions = fields.includes('options');
    if (needsOptions && !q.options?.length) q.options = [{ value: 'Option 1', label: 'Option 1' }];
    if (!needsOptions) delete q.options;
    if (q.type === 'statement') { q.body = q.body || 'Statement text'; q.consentLabel = q.consentLabel || 'I agree'; }
    // Strip settings that belong to the previous type, so a paragraph
    // switched to multiple choice doesn't publish a stale minWords etc.
    const keep = new Set(fields.flatMap((f) => (
      f === 'pattern' ? ['pattern', 'patternMessage']
        : f === 'prefix' ? ['prefix', 'suffix', 'min', 'max']
          : f === 'body' ? ['body', 'consentLabel'] : [f])));
    if (q.type === 'scale') keep.add('caption');
    ['placeholder', 'source', 'pattern', 'patternMessage', 'minWords', 'layout', 'allowOther',
      'maxMB', 'accept', 'maxItems', 'prefix', 'suffix', 'min', 'max', 'body', 'consentLabel', 'caption']
      .forEach((key) => { if (!keep.has(key)) delete q[key]; });
    // Only choice questions can drive a condition — losing the options
    // makes every condition pointing here unsatisfiable.
    if (!needsOptions) dropDanglingShowIf(new Set([q.id]));
    persist(); renderAll();
    return;
  }

  if (el.dataset.set === 'showIfQuestion') {
    if (!el.value) delete q.showIf;
    else {
      const src = schema.steps.flatMap((s) => s.questions).find((o) => o.id === el.value);
      q.showIf = { question: el.value, equals: src?.options?.[0]?.value || '' };
    }
    persist(); renderQuestions();
    return;
  }
  if (el.dataset.set === 'showIfEquals') { q.showIf.equals = el.value; persist(); return; }
  if (el.dataset.set === 'allowOther' || el.dataset.set === 'half' || el.dataset.set === 'hideTitle' || el.dataset.set === 'required') {
    persist();
  }
  if (el.dataset.opt != null && el.dataset.k === 'icon') persist();
});

list.addEventListener('click', (e) => {
  const step = schema.steps[activeSection];
  const t = (sel) => e.target.closest(sel);

  const addOpt = t('[data-add-opt]');
  if (addOpt) {
    const q = step.questions[Number(addOpt.dataset.addOpt)];
    const n = (q.options?.length || 0) + 1;
    (q.options ||= []).push({ value: `Option ${n}`, label: `Option ${n}` });
    persist(); renderQuestions(); return;
  }
  const delOpt = t('[data-del-opt]');
  if (delOpt) {
    const q = step.questions[Number(delOpt.dataset.q)];
    if (q.options.length === 1) return alert('A choice question needs at least one option.');
    q.options.splice(Number(delOpt.dataset.delOpt), 1);
    persist(); renderQuestions(); return;
  }
  const toggle = t('[data-toggle-settings]');
  if (toggle) {
    const q = step.questions[Number(toggle.dataset.toggleSettings)];
    q.__open = !q.__open;
    renderQuestions(); return;
  }
  const dup = t('[data-dup-q]');
  if (dup) {
    const i = Number(dup.dataset.dupQ);
    const copy = deepClone(step.questions[i]);
    copy.id = ensureUniqueId(`${copy.id}_copy`, allSchemaIds());
    copy.title = `${copy.title} (copy)`;
    step.questions.splice(i + 1, 0, copy);
    persist(); renderAll(); return;
  }
  const del = t('[data-del-q]');
  if (del) {
    const i = Number(del.dataset.delQ);
    const target = step.questions[i];
    const dependents = schema.steps.flatMap((s) => s.questions)
      .filter((o) => o.showIf?.question === target.id);
    const warning = dependents.length
      ? `\n\n${dependents.length} other question(s) are shown based on this one — they will become always visible.`
      : '';
    if (!confirm(`Delete question “${target.title}”?${warning}`)) return;
    step.questions.splice(i, 1);
    dropDanglingShowIf(new Set([target.id]));
    persist(); renderAll();
  }
});

$('#addQuestionBtn').addEventListener('click', () => {
  schema.steps[activeSection].questions.push(newQuestion('short_text'));
  persist(); renderAll();
  list.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

/* Drag to reorder questions. Option rows live inside question cards and
   both handlers listen on the same node, so a drag that starts on an
   option row must never be treated as a question drag — stopPropagation
   can't help between listeners on one element. */
let dragQ = null;
list.addEventListener('dragstart', (e) => {
  if (e.target.closest('.opt-row')) return; // option drag — handled below
  const card = e.target.closest('.q-card');
  if (!card) return;
  dragQ = Number(card.dataset.q);
  card.classList.add('dragging');
});
list.addEventListener('dragend', (e) => {
  e.target.closest('.q-card')?.classList.remove('dragging');
  dragQ = null;
});
list.addEventListener('dragover', (e) => {
  e.preventDefault();
  const over = e.target.closest('.q-card');
  if (!over || dragQ == null) return;
  const to = Number(over.dataset.q);
  if (to === dragQ) return;
  const qs = schema.steps[activeSection].questions;
  const [moved] = qs.splice(dragQ, 1);
  qs.splice(to, 0, moved);
  dragQ = to;
  persist(); renderQuestions();
});

/* Option reorder */
list.addEventListener('dragstart', (e) => {
  const row = e.target.closest('.opt-row');
  if (row) row.dataset.dragging = '1';
});
list.addEventListener('dragend', () => {
  // A drop that never matched a target would leave the marker behind
  $$('.opt-row[data-dragging]', list).forEach((r) => delete r.dataset.dragging);
});
list.addEventListener('dragover', (e) => {
  const row = e.target.closest('.opt-row');
  const src = $('.opt-row[data-dragging]', list);
  if (!row || !src || row === src) return;
  e.preventDefault(); e.stopPropagation();
  const qi = Number(src.dataset.q);
  if (Number(row.dataset.q) !== qi) return;
  const opts = schema.steps[activeSection].questions[qi].options;
  const [moved] = opts.splice(Number(src.dataset.opt), 1);
  opts.splice(Number(row.dataset.opt), 0, moved);
  delete src.dataset.dragging;
  persist(); renderQuestions();
});

/* ------------------------------------------------------------ preview */

$('#previewBtn').addEventListener('click', () => {
  const step = schema.steps[activeSection];
  $('#previewStepName').textContent = step.title;
  $('#previewHost').innerHTML = `
    <span class="step-ico">${typeof icon === 'function' ? icon(step.icon || 'layers') : ''}</span>
    <h2 class="step-title">${esc2(step.title)}</h2>
    ${step.subtitle ? `<p class="step-subtitle">${esc2(step.subtitle)}</p>` : ''}
    <div class="step-questions">${step.questions.map(renderQuestion).join('')}</div>`;
  $('#previewModal').hidden = false;
});
$('#closePreview').addEventListener('click', () => { $('#previewModal').hidden = true; });

/* ------------------------------------------------------------ import / export */

/* Normalization strips editor-only state (__open), repairs anything
   repairable, and reports what it fixed — publishing a broken definition
   silently is the one thing this editor must never do. */
function cleanSchema({ confirmIssues = false } = {}) {
  const { schema: clean, issues } = normalizeSchema(schema);
  if (confirmIssues && issues.length) {
    const ok = confirm(`The form definition needed ${issues.length} repair(s):\n\n`
      + issues.map((s) => `• ${s}`).join('\n')
      + '\n\nContinue with the repaired version?');
    if (!ok) return null;
  }
  return clean;
}

function download(filename, text, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* Publish → a drop-in replacement for form-schema.js. It is a script rather
   than raw JSON so the form can read it synchronously, before rendering. */
$('#exportBtn').addEventListener('click', () => {
  const clean = cleanSchema({ confirmIssues: true });
  if (!clean) return;
  const body = `/* Published form definition — generated by admin.html.\n`
    + `   Commit this file to make the changes live for everyone. */\n\n`
    + `window.PUBLISHED_SCHEMA = ${JSON.stringify(clean, null, 2)};\n`;
  download('form-schema.js', body, 'application/javascript');
});

$('#exportJsonBtn').addEventListener('click', () => {
  const clean = cleanSchema({ confirmIssues: true });
  if (clean) download('form-schema.json', JSON.stringify(clean, null, 2), 'application/json');
});

$('#importBtn').addEventListener('click', () => {
  $('#importText').value = '';
  $('#importError').hidden = true;
  $('#importModal').hidden = false;
});
$('#closeImport').addEventListener('click', () => { $('#importModal').hidden = true; });

$('#doImport').addEventListener('click', () => {
  const err = $('#importError');
  try {
    // Accept either raw JSON or a pasted form-schema.js
    const text = $('#importText').value.trim()
      .replace(/^[\s\S]*?window\.PUBLISHED_SCHEMA\s*=\s*/, '')
      .replace(/;\s*$/, '');
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.steps) || !parsed.steps.length) {
      throw new Error('JSON must contain a non-empty "steps" array.');
    }
    const { schema: normalized, issues } = normalizeSchema(parsed);
    schema = normalized;
    activeSection = 0;
    persist(); renderAll();
    $('#importModal').hidden = true;
    if (issues.length) {
      alert(`Imported with ${issues.length} repair(s):\n\n${issues.map((s) => `• ${s}`).join('\n')}`);
    }
  } catch (e) {
    err.textContent = `Could not import: ${e.message}`;
    err.hidden = false;
  }
});

/* Drops this browser's local edits so the published schema (or the built-in
   default) takes over again — the same state a visitor sees. */
$('#resetBtn').addEventListener('click', () => {
  if (!confirm('Discard the edits saved in this browser and reload the published form?')) return;
  clearSchemaOverride();
  schema = loadSchema();
  activeSection = 0;
  renderAll();
  const badge = $('#savedState');
  badge.textContent = 'Reset';
  badge.classList.add('is-on');
  setTimeout(() => badge.classList.remove('is-on'), 1600);
});

/* ------------------------------------------------------------ boot */

function renderAll() {
  const step = schema.steps[activeSection];
  $('#formTitle').value = schema.title || '';
  $('#formDesc').value = schema.description || '';
  $('#sectionTitle').value = step.title || '';
  $('#sectionSubtitle').value = step.subtitle || '';
  $('#sectionNav').value = step.navLabel || '';
  $('#sectionIcon').value = step.icon || 'layers';
  renderSectionList();
  renderQuestions();
}

renderAll();
