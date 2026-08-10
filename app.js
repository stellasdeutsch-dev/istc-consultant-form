/* ============================================================
   ISTC Consultant Database — Expression of Interest
   Schema-driven form: every step and question comes from
   schema.js (editable in admin.html). This file owns flow —
   navigation, validation, widgets, drafts, review, submission.
   ============================================================ */

'use strict';

const CONFIG = {
  SUBMIT_URL: '',
  MIN_FILE_FALLBACK_MB: 10,
};

const schema = loadSchema();

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const form = $('#eoiForm');
renderForm(schema, form);

const DRAFT_KEY = 'istc-eoi-answers-v1';
const TOTAL_STEPS = schema.steps.length + 1; // + review
const REVIEW_STEP = TOTAL_STEPS;

const STEP_LABELS = [...schema.steps.map((s) => s.navLabel || s.title), 'Review'];

/* Shared widget state the render adapters read from */
window.__formFiles = {};
window.__countryPickers = {};
window.__languageSets = {};
window.__assignmentSets = {};

const state = { step: 0 };
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const steps = new Map();
$$('.step').forEach((el) => steps.set(el.dataset.step, el));

const stepNav = $('#stepNav');
const backBtn = $('#backBtn');
const nextBtn = $('#nextBtn');
const progressFill = $('#progressFill');
const stepIndicator = $('#stepIndicator');
const themeToggle = $('#themeToggle');

const allQuestions = schema.steps.flatMap((s) => s.questions);
const questionById = new Map(allQuestions.map((q) => [q.id, q]));
const stepOfQuestion = new Map();
schema.steps.forEach((s, i) => s.questions.forEach((q) => stepOfQuestion.set(q.id, i + 1)));

const adapterFor = (q) => ADAPTERS[q.type] || ADAPTERS.short_text;

/* ------------------------------------------------------------ Theme */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute('aria-label',
    theme === 'dark' ? 'Switch to light appearance' : 'Switch to dark appearance');
  try { localStorage.setItem('istc-theme', theme); } catch (_) { /* ignore */ }
}

themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});
applyTheme(document.documentElement.dataset.theme || 'light');

/* ------------------------------------------------------------ Helpers */

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncate(text, max) {
  const t = (text || '').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------ Errors */

function showError(key, message) {
  const el = $(`[data-error-for="${key}"]`);
  if (el) { el.textContent = message; el.hidden = false; }
  const anchor = $(`[data-error-anchor="${key}"]`) || document.getElementById(key);
  if (anchor) {
    anchor.setAttribute('aria-invalid', 'true');
    if (!prefersReducedMotion.matches) {
      anchor.classList.remove('shake');
      void anchor.offsetWidth;
      anchor.classList.add('shake');
    }
  }
}

function clearErrors(root) {
  $$('.field-error', root).forEach((el) => { el.hidden = true; el.textContent = ''; });
  $$('[aria-invalid]', root).forEach((el) => el.removeAttribute('aria-invalid'));
}

/* ------------------------------------------------------------ Autocomplete */

function attachAutocomplete(input, items, { onSelect } = {}) {
  const anchor = input.closest('.combo-anchor') || input.closest('.field') || input.parentElement;
  anchor.classList.add('combo-anchor');

  const menu = document.createElement('div');
  menu.className = 'combo-menu';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  anchor.appendChild(menu);

  let current = [];
  let active = -1;

  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('autocomplete', 'off');

  const close = () => { menu.hidden = true; active = -1; input.setAttribute('aria-expanded', 'false'); };

  function paint() {
    [...menu.children].forEach((el, i) => el.classList.toggle('active', i === active));
    menu.children[active]?.scrollIntoView({ block: 'nearest' });
  }

  function filter() {
    const q = input.value.trim().toLowerCase();
    if (!q) return close();
    current = items
      .filter((v) => v.toLowerCase().includes(q))
      .sort((a, b) => Number(b.toLowerCase().startsWith(q)) - Number(a.toLowerCase().startsWith(q)))
      .slice(0, 8);
    active = -1;
    menu.innerHTML = current
      .map((v, i) => `<button type="button" class="combo-option" role="option" data-i="${i}">${escapeHtml(v)}</button>`)
      .join('');
    menu.hidden = !current.length;
    input.setAttribute('aria-expanded', String(!!current.length));
  }

  function choose(i) {
    const value = current[i];
    if (value == null) return;
    if (onSelect) onSelect(value);
    else { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }
    close();
  }

  input.addEventListener('input', filter);
  input.addEventListener('focus', filter);
  input.addEventListener('blur', () => setTimeout(close, 120));
  menu.addEventListener('pointerdown', (e) => e.preventDefault());
  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('.combo-option');
    if (btn) choose(Number(btn.dataset.i));
  });

  input.addEventListener('keydown', (e) => {
    if (menu.hidden) { if (e.key === 'ArrowDown') filter(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, current.length - 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); choose(active >= 0 ? active : 0); }
    else if (e.key === 'Escape' || e.key === 'Tab') close();
  });
}

/* ------------------------------------------------------------ Widget: files */

function initFileQuestion(q) {
  const zone = $(`.dropzone[data-file-key="${q.id}"]`);
  if (!zone) return;
  const input = $('input[type="file"]', zone);
  const empty = $('.dropzone-empty', zone);
  const chip = $('.file-chip', zone);
  const nameEl = $('.file-chip-name', zone);
  const sizeEl = $('.file-chip-size', zone);
  const removeBtn = $('.file-chip-remove', zone);
  const maxBytes = (q.maxMB || CONFIG.MIN_FILE_FALLBACK_MB) * 1024 * 1024;

  function render() {
    const file = window.__formFiles[q.id];
    empty.hidden = !!file;
    chip.hidden = !file;
    zone.classList.toggle('has-file', !!file);
    if (file) { nameEl.textContent = file.name; sizeEl.textContent = formatBytes(file.size); }
  }

  function accept(file) {
    const errEl = $(`[data-error-for="${q.id}"]`);
    if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
    if (!file) return;
    if (file.size > maxBytes) {
      showError(q.id, `"${file.name}" is ${formatBytes(file.size)} — the limit is ${q.maxMB || 10} MB.`);
      return;
    }
    window.__formFiles[q.id] = file;
    render();
    updateStepper();
  }

  zone.addEventListener('click', (e) => {
    if (e.target.closest('.file-chip-remove')) return;
    if (!window.__formFiles[q.id]) input.click();
  });
  zone.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !window.__formFiles[q.id]) { e.preventDefault(); input.click(); }
  });
  input.addEventListener('change', () => { accept(input.files[0]); input.value = ''; });
  ['dragenter', 'dragover'].forEach((evt) => zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach((evt) => zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.remove('dragover'); }));
  zone.addEventListener('drop', (e) => accept(e.dataTransfer.files[0]));
  removeBtn.addEventListener('click', () => { window.__formFiles[q.id] = null; render(); updateStepper(); });
}

/* ------------------------------------------------------------ Widget: languages */

window.__setLanguages = (qid, list) => {
  window.__languageSets[qid] = (list || []).filter((l) => l && l.name);
  renderLanguageChips(qid);
};

function renderLanguageChips(qid) {
  const host = $(`[data-lang-chips="${qid}"]`);
  if (!host) return;
  host.innerHTML = (window.__languageSets[qid] || []).map((lang, i) => `
    <span class="chip">
      <span class="chip-name">${escapeHtml(lang.name)}</span>
      <select class="chip-level" data-i="${i}" aria-label="Proficiency for ${escapeHtml(lang.name)}">
        ${PROFICIENCY_LEVELS.map((lvl) => `<option value="${lvl}"${lvl === lang.level ? ' selected' : ''}>${lvl}</option>`).join('')}
      </select>
      <button type="button" class="chip-x" data-i="${i}" aria-label="Remove ${escapeHtml(lang.name)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </span>`).join('');
}

function initLanguagesQuestion(q) {
  const field = $(`[data-lang-for="${q.id}"]`);
  const input = document.getElementById(`${q.id}__input`);
  const chips = $(`[data-lang-chips="${q.id}"]`);
  if (!field || !input) return;
  window.__languageSets[q.id] = window.__languageSets[q.id] || [];

  const add = (name, level = 'Working') => {
    const clean = (name || '').trim().replace(/,+$/, '');
    if (!clean) return;
    const list = window.__languageSets[q.id];
    if (list.some((l) => l.name.toLowerCase() === clean.toLowerCase())) return;
    list.push({ name: clean, level });
    renderLanguageChips(q.id);
    const err = $(`[data-error-for="${q.id}"]`);
    if (err) err.hidden = true;
    field.removeAttribute('aria-invalid');
    saveDraft();
  };

  attachAutocomplete(input, LANGUAGES, { onSelect: (v) => { add(v); input.value = ''; } });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault(); e.stopPropagation(); add(input.value); input.value = '';
    } else if (e.key === 'Backspace' && !input.value && window.__languageSets[q.id].length) {
      window.__languageSets[q.id].pop(); renderLanguageChips(q.id); saveDraft();
    }
  });

  field.addEventListener('click', (e) => { if (e.target === field || e.target === chips) input.focus(); });
  chips.addEventListener('change', (e) => {
    const sel = e.target.closest('.chip-level');
    if (!sel) return;
    window.__languageSets[q.id][Number(sel.dataset.i)].level = sel.value;
    saveDraft();
  });
  chips.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip-x');
    if (!btn) return;
    window.__languageSets[q.id].splice(Number(btn.dataset.i), 1);
    renderLanguageChips(q.id); input.focus(); saveDraft();
  });

  // Adopt whatever is still typed when the step is validated
  field.dataset.pendingInput = `${q.id}__input`;
  field.__adopt = () => { if (input.value.trim()) { add(input.value); input.value = ''; } };
}

/* ------------------------------------------------------------ Widget: country map */

function initCountryQuestion(q) {
  const stage = $(`[data-map-for="${q.id}"]`);
  if (!stage) return;
  const chipsEl = $(`[data-chips-for="${q.id}"]`);
  const countEl = $(`[data-count-for="${q.id}"]`);
  const clearBtn = $(`[data-clear-for="${q.id}"]`);
  const regionsEl = $(`[data-regions-for="${q.id}"]`);
  const search = document.getElementById(`${q.id}__search`);

  const picker = createWorldMap(stage, {
    mode: 'picker',
    onChange: () => { paint(); saveDraft(); },
  });
  window.__countryPickers[q.id] = picker;

  function paint() {
    const { ids } = picker.getSelection();
    countEl.textContent = ids.length
      ? `${ids.length} ${ids.length === 1 ? 'country' : 'countries'} selected`
      : 'No countries selected yet';
    clearBtn.hidden = !ids.length;
    $$('.region-chip', regionsEl).forEach((chip) => {
      const list = countriesInRegion(chip.dataset.region);
      chip.classList.toggle('is-on', list.length > 0 && list.every((c) => picker.has(c.i)));
    });
    chipsEl.innerHTML = ids.map((id) => COUNTRY_BY_ID.get(id))
      .sort((a, b) => a.n.localeCompare(b.n))
      .map((c) => `<span class="country-chip">${escapeHtml(c.n)}
        <button type="button" data-remove-country="${c.i}" aria-label="Remove ${escapeHtml(c.n)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button></span>`).join('');
    if (ids.length) { const err = $(`[data-error-for="${q.id}"]`); if (err) err.hidden = true; }
  }

  regionsEl.innerHTML = ISTC_REGIONS
    .map((r) => `<button type="button" class="region-chip" data-region="${escapeHtml(r)}">${escapeHtml(r)}</button>`)
    .join('');
  regionsEl.addEventListener('click', (e) => {
    const chip = e.target.closest('.region-chip');
    if (chip) picker.toggleRegion(chip.dataset.region);
  });
  chipsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-country]');
    if (btn) picker.remove([btn.dataset.removeCountry]);
  });
  clearBtn.addEventListener('click', () => picker.clear());

  if (search) {
    search.insertAdjacentHTML('beforebegin', typeof icon === 'function' ? icon('eye', 'input-ico') : '');
    attachAutocomplete(search, WORLD_MAP.countries.map((c) => c.n), {
      onSelect: (name) => {
        const match = WORLD_MAP.countries.find((c) => c.n === name);
        if (!match) return;
        picker.add([match.i]); picker.flash(match.i); search.value = '';
      },
    });
  }

  paint();
}

/* ------------------------------------------------------------ Widget: assignments */

function emptyAssignment() {
  return { title: '', client: '', country: '', from: '', to: '', role: '', description: '' };
}

window.__setAssignments = (qid, list) => {
  window.__assignmentSets[qid] = (list && list.length ? list : [emptyAssignment()])
    .map((a) => (typeof a === 'string' ? { ...emptyAssignment(), description: a } : { ...emptyAssignment(), ...a }));
  renderAssignments(qid);
};

const ASSIGNMENT_MAX_PX = 560;

function autoGrow(el) {
  if (!el || !el.offsetParent) return;
  el.style.height = 'auto';
  const cs = getComputedStyle(el);
  const border = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  const full = el.scrollHeight + border;
  el.style.height = `${Math.min(full, ASSIGNMENT_MAX_PX)}px`;
  el.style.overflowY = full > ASSIGNMENT_MAX_PX ? 'auto' : 'hidden';
}

function assignmentField(qid, i, key, label, iconName, placeholder, opts = {}) {
  const a = window.__assignmentSets[qid][i];
  return `
    <div class="a-field${opts.span ? ' a-span' : ''}${opts.combo ? ' combo-anchor' : ''}">
      <label class="sub-label" for="${qid}-${key}-${i}">${label}</label>
      <div class="input-wrap">
        ${typeof icon === 'function' ? icon(iconName, 'input-ico') : ''}
        <input class="text-input text-input-sm has-ico" type="${opts.type || 'text'}"
               id="${qid}-${key}-${i}" data-a-i="${i}" data-a-k="${key}"
               value="${escapeHtml(a[key])}"
               ${placeholder ? `placeholder="${escapeHtml(placeholder)}"` : ''} />
      </div>
    </div>`;
}

function renderAssignments(qid) {
  const host = $(`[data-assignments-for="${qid}"]`);
  if (!host) return;
  const list = window.__assignmentSets[qid];
  const q = questionById.get(qid);
  const max = q?.maxItems || 3;

  host.innerHTML = list.map((a, i) => `
    <div class="assignment-card">
      <div class="assignment-head">
        <span class="assignment-num">Assignment ${i + 1}${i > 0 ? ' · optional' : ''}</span>
        ${list.length > 1 ? `<button type="button" class="assignment-remove" data-a-remove="${i}">Remove</button>` : ''}
      </div>
      <div class="assignment-grid">
        ${assignmentField(qid, i, 'title', 'Title of project', 'clipboard', 'Enterprise Cloud Migration & Modernization', { span: true })}
        ${assignmentField(qid, i, 'client', 'Client / Organization', 'building', 'Global FinTech Solutions')}
        ${assignmentField(qid, i, 'country', 'Country', 'globe', 'Start typing…', { combo: true })}
        ${assignmentField(qid, i, 'from', 'From', 'calendar', '', { type: 'month' })}
        ${assignmentField(qid, i, 'to', 'To', 'calendar', '', { type: 'month' })}
        ${assignmentField(qid, i, 'role', 'Your role', 'user', 'Lead Project Manager', { span: true })}
        <div class="a-field a-span">
          <label class="sub-label" for="${qid}-description-${i}">Short description</label>
          <textarea class="text-input assignment-text" id="${qid}-description-${i}" rows="3"
                    data-a-i="${i}" data-a-k="description"
                    placeholder="What you delivered, the scale of it, and the outcome.">${escapeHtml(a.description)}</textarea>
        </div>
      </div>
    </div>`).join('');

  const addBtn = $(`[data-add-assignment="${qid}"]`);
  if (addBtn) addBtn.hidden = list.length >= max;

  $$('.assignment-text', host).forEach(autoGrow);
  $$('input[data-a-k="country"]', host).forEach((input) => {
    if (input.dataset.combo) return;
    attachAutocomplete(input, COUNTRIES);
    input.dataset.combo = '1';
  });
}

function initAssignmentsQuestion(q) {
  const host = $(`[data-assignments-for="${q.id}"]`);
  if (!host) return;
  window.__assignmentSets[q.id] = window.__assignmentSets[q.id] || [emptyAssignment()];
  renderAssignments(q.id);

  host.addEventListener('input', (e) => {
    const { aI, aK } = e.target.dataset;
    if (aI == null || !aK) return;
    window.__assignmentSets[q.id][Number(aI)][aK] = e.target.value;
    if (aK === 'description') autoGrow(e.target);
    saveDraft();
  });

  host.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-a-remove]');
    if (!btn) return;
    const list = window.__assignmentSets[q.id];
    list.splice(Number(btn.dataset.aRemove), 1);
    if (!list.length) list.push(emptyAssignment());
    renderAssignments(q.id); saveDraft();
  });

  $(`[data-add-assignment="${q.id}"]`)?.addEventListener('click', () => {
    const list = window.__assignmentSets[q.id];
    if (list.length >= (q.maxItems || 3)) return;
    list.push(emptyAssignment());
    renderAssignments(q.id);
    document.getElementById(`${q.id}-title-${list.length - 1}`)?.focus();
    saveDraft();
  });
}

/* ------------------------------------------------------------ Widget: rate pair */

function initRatePair(q) {
  const daily = document.getElementById(`${q.id}__daily`);
  const hourly = document.getElementById(`${q.id}__hourly`);
  const hint = $(`[data-rate-hint="${q.id}"]`);
  if (!daily || !hourly) return;
  const HOURS = 8;
  let dailySuggested = false;
  let hourlySuggested = false;

  function updateHint() {
    const d = Number(daily.value);
    const h = Number(hourly.value);
    if (d > 0 && h > 0) {
      hint.textContent = (dailySuggested || hourlySuggested)
        ? `Based on an ${HOURS}-hour day we filled in the other rate — edit it if your rate differs.`
        : `That works out to ${(d / h).toFixed(1)} hours per day.`;
      hint.hidden = false;
    } else hint.hidden = true;
  }

  daily.addEventListener('input', () => {
    dailySuggested = false;
    const d = Number(daily.value);
    if (d > 0 && (!hourly.value || hourlySuggested)) { hourly.value = Math.round(d / HOURS); hourlySuggested = true; }
    updateHint();
  });
  hourly.addEventListener('input', () => {
    hourlySuggested = false;
    const h = Number(hourly.value);
    if (h > 0 && (!daily.value || dailySuggested)) { daily.value = Math.round(h * HOURS); dailySuggested = true; }
    updateHint();
  });
  [daily, hourly].forEach((el) => el.addEventListener('keydown', (e) => {
    if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
  }));
}

/* ------------------------------------------------------------ Init all questions */

allQuestions.forEach((q) => {
  const adapter = adapterFor(q);
  if (adapter.init) adapter.init(q);
  if (q.type === 'file') initFileQuestion(q);
  if (q.type === 'languages') initLanguagesQuestion(q);
  if (q.type === 'country_map') initCountryQuestion(q);
  if (q.type === 'assignments') initAssignmentsQuestion(q);
  if (q.type === 'rate_pair') initRatePair(q);
  if (q.type === 'short_text' && q.source) {
    const input = document.getElementById(q.id);
    const list = q.source === 'countries' ? COUNTRIES
      : q.source === 'nationalities' ? NATIONALITIES
        : q.source === 'languages' ? LANGUAGES : null;
    if (input && list) attachAutocomplete(input, list);
  }
});

/* ------------------------------------------------------------ Conditional questions */

function syncConditionals() {
  allQuestions.forEach((q) => {
    if (!q.showIf) return;
    const host = $(`[data-question="${q.id}"]`);
    if (!host) return;
    const source = questionById.get(q.showIf.question);
    const value = source ? adapterFor(source).get(source) : '';
    const match = Array.isArray(value) ? value.includes(q.showIf.equals) : value === q.showIf.equals;
    host.hidden = !match;
  });
  // "Other" text boxes follow their choice group
  allQuestions.filter((q) => q.allowOther).forEach((q) => {
    const box = $(`[data-other-for="${q.id}"]`);
    if (!box) return;
    const picked = [...document.querySelectorAll(`input[name="${q.id}"]:checked`)].map((i) => i.value);
    box.hidden = !picked.includes('Other (specify)');
  });
}

form.addEventListener('change', () => { syncConditionals(); saveDraft(); });
form.addEventListener('input', saveDraft);

form.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (e.target.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="file"])')) {
    e.preventDefault();
    nextBtn.click();
  }
});
form.addEventListener('submit', (e) => e.preventDefault());

/* ------------------------------------------------------------ Validation */

function isQuestionVisible(q) {
  const host = $(`[data-question="${q.id}"]`);
  return host ? !host.hidden : true;
}

function validateStep(stepNumber, { silent = false } = {}) {
  const stepEl = steps.get(String(stepNumber));
  if (!silent && stepEl) clearErrors(stepEl);
  const step = schema.steps[stepNumber - 1];
  if (!step) return true;

  if (!silent) {
    // adopt any half-typed language before judging the step
    $$('.chip-field', stepEl).forEach((f) => f.__adopt && f.__adopt());
  }

  const errors = [];
  step.questions.forEach((q) => {
    if (!isQuestionVisible(q)) return;
    const message = adapterFor(q).validate(q);
    if (message) errors.push([q.id, message]);
  });

  if (!silent) {
    errors.forEach(([key, message]) => showError(key, message));
    if (errors.length) {
      const anchor = $(`[data-error-anchor="${errors[0][0]}"]`) || document.getElementById(errors[0][0]);
      anchor?.scrollIntoView({ block: 'center', behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' });
    }
  }
  return errors.length === 0;
}

const isStepComplete = (n) => (n >= REVIEW_STEP ? false : validateStep(n, { silent: true }));

function incompleteSteps() {
  const out = [];
  for (let n = 1; n < REVIEW_STEP; n++) if (!isStepComplete(n)) out.push(n);
  return out;
}

/* ------------------------------------------------------------ Step navigator */

const stepper = $('#stepper');
const stepperTrack = $('#stepperTrack');
const TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 13l5 5L20 6"/></svg>';

stepperTrack.innerHTML = STEP_LABELS.map((label, i) => `
  <button type="button" class="step-dot" data-step-to="${i + 1}">
    <span class="step-dot-num">${i + 1}</span>
    <span class="step-dot-label">${escapeHtml(label)}</span>
  </button>`).join('');

const stepDots = $$('.step-dot', stepperTrack);

function updateStepper() {
  stepDots.forEach((dot, i) => {
    const n = i + 1;
    const done = n !== REVIEW_STEP && isStepComplete(n);
    dot.classList.toggle('is-current', n === state.step);
    dot.classList.toggle('is-done', done && n !== state.step);
    dot.setAttribute('aria-current', n === state.step ? 'step' : 'false');
    dot.setAttribute('aria-label', `Step ${n}: ${STEP_LABELS[i]}${done ? ' — complete' : ''}`);
    $('.step-dot-num', dot).innerHTML = done && n !== state.step ? TICK : String(n);
  });
  const active = stepDots[state.step - 1];
  if (!active) return;
  const t = stepperTrack;
  const left = active.offsetLeft;
  const right = left + active.offsetWidth;
  const behavior = prefersReducedMotion.matches ? 'auto' : 'smooth';
  if (left < t.scrollLeft + 12) t.scrollTo({ left: Math.max(0, left - 24), behavior });
  else if (right > t.scrollLeft + t.clientWidth - 12) t.scrollTo({ left: right - t.clientWidth + 24, behavior });
}

stepperTrack.addEventListener('click', (e) => {
  const dot = e.target.closest('[data-step-to]');
  if (dot && Number(dot.dataset.stepTo) !== state.step) goToStep(Number(dot.dataset.stepTo));
});

/* ------------------------------------------------------------ Navigation */

const stepKey = (n) => (n === 0 ? 'intro' : n === TOTAL_STEPS + 1 ? 'success' : String(n));

function goToStep(next, { animate = true } = {}) {
  const direction = next > state.step ? 'forward' : 'back';
  const current = steps.get(stepKey(state.step));
  const target = steps.get(stepKey(next));
  if (!target) return;

  if (current) { current.hidden = true; current.classList.remove('entering', 'entering-back'); }
  state.step = next;
  target.hidden = false;

  if (animate) {
    target.classList.remove('entering', 'entering-back');
    void target.offsetWidth;
    target.classList.add(direction === 'forward' ? 'entering' : 'entering-back');
  }

  const inForm = next >= 1 && next <= TOTAL_STEPS;
  stepNav.hidden = !inForm;
  stepper.hidden = !inForm;
  nextBtn.textContent = next === REVIEW_STEP ? 'Submit application' : 'Continue';
  backBtn.textContent = 'Back';

  progressFill.style.width = `${next === 0 ? 0 : next > TOTAL_STEPS ? 100 : Math.round((next / TOTAL_STEPS) * 100)}%`;
  stepIndicator.textContent = inForm ? `Step ${next} of ${TOTAL_STEPS}` : next > TOTAL_STEPS ? 'Submitted' : '';

  window.scrollTo({ top: 0, behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' });
  $('.step-title, .success-title', target)?.focus({ preventScroll: true });

  if (inForm) {
    updateStepper();
    $$('.assignment-text', target).forEach(autoGrow);
  }
  if (next === REVIEW_STEP) renderReview();
}

[$('#startBtn'), $('#startBtn2'), $('#startBtn3')].filter(Boolean)
  .forEach((btn) => btn.addEventListener('click', () => goToStep(1)));

backBtn.addEventListener('click', () => goToStep(state.step > 1 ? state.step - 1 : 0));

nextBtn.addEventListener('click', () => {
  if (!validateStep(state.step)) return;
  if (state.step === REVIEW_STEP) submitApplication();
  else goToStep(state.step + 1);
});

/* ------------------------------------------------------------ Answers & drafts */

function collectAnswers() {
  const answers = {};
  allQuestions.forEach((q) => {
    if (q.type === 'file') return;
    answers[q.id] = adapterFor(q).get(q);
  });
  return answers;
}

let draftTimer = null;
function saveDraft() {
  if (state.step >= 1 && state.step <= TOTAL_STEPS) updateStepper();
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(collectAnswers())); } catch (_) { /* ignore */ }
  }, 400);
}

function restoreDraft() {
  let draft;
  try { draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (_) { return; }
  if (!draft) return;
  allQuestions.forEach((q) => {
    if (q.type === 'file' || !(q.id in draft)) return;
    try { adapterFor(q).set(q, draft[q.id]); } catch (_) { /* skip incompatible */ }
  });
  syncConditionals();
}

restoreDraft();
syncConditionals();

/* ------------------------------------------------------------ Review */

function answerSummary(q) {
  const v = adapterFor(q).get(q);
  if (q.type === 'file') {
    const f = window.__formFiles[q.id];
    return f ? `${f.name} (${formatBytes(f.size)})` : '—';
  }
  if (q.type === 'country_map') {
    return v.ids.length ? `${v.ids.length} selected — ${truncate(v.names.join(', '), 160)}` : '—';
  }
  if (q.type === 'languages') {
    return v.length ? v.map((l) => `${l.name} (${l.level})`).join(', ') : '—';
  }
  if (q.type === 'assignments') {
    const filled = v.filter((a) => Object.values(a).some((x) => x && x.trim()));
    return filled.length
      ? filled.map((a) => truncate([a.title || 'Untitled', a.client].filter(Boolean).join(' — '), 90)).join('\n')
      : '—';
  }
  if (q.type === 'rate_pair') {
    return v.daily || v.hourly ? `€${v.daily || '—'} / day · €${v.hourly || '—'} / hour` : '—';
  }
  if (q.type === 'paragraph' && q.minWords) {
    return v ? `${v.split(/\s+/).filter(Boolean).length} words` : '—';
  }
  if (Array.isArray(v)) return v.join('\n') || '—';
  return v || '—';
}

function renderReview() {
  const missing = incompleteSteps();
  const banner = missing.length ? `
    <div class="review-warn">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9"/></svg>
      <div>
        <strong>${missing.length} ${missing.length === 1 ? 'step still needs' : 'steps still need'} an answer</strong>
        <p>${missing.map((n) => `<button type="button" class="review-warn-link" data-goto="${n}">${n}. ${escapeHtml(STEP_LABELS[n - 1])}</button>`).join('')}</p>
      </div>
    </div>` : '';

  const groups = schema.steps.map((step, i) => `
    <div class="review-group">
      <div class="review-group-head">
        <span class="review-group-title">${escapeHtml(step.title)}</span>
        <button type="button" class="review-edit" data-goto="${i + 1}">Edit</button>
      </div>
      ${step.questions.filter(isQuestionVisible).map((q) => `
        <div class="review-row">
          <span class="review-key">${escapeHtml(q.title)}</span>
          <span class="review-val">${escapeHtml(answerSummary(q))}</span>
        </div>`).join('')}
    </div>`).join('');

  $('#reviewContent').innerHTML = banner + groups;
  $$('#reviewContent [data-goto]').forEach((btn) =>
    btn.addEventListener('click', () => goToStep(Number(btn.dataset.goto))));
}

/* ------------------------------------------------------------ Submission */

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function buildPayload() {
  const files = {};
  for (const q of allQuestions.filter((x) => x.type === 'file')) {
    const file = window.__formFiles[q.id];
    if (file) {
      files[q.id] = { name: file.name, type: file.type, size: file.size, data: await fileToBase64(file) };
    }
  }
  const answers = allQuestions
    .filter((q) => q.type !== 'file' && isQuestionVisible(q))
    .map((q) => ({ id: q.id, title: q.title, value: answerSummary(q) }));
  return { schemaVersion: schema.version, answers, raw: collectAnswers(), files, submittedAt: new Date().toISOString() };
}

async function submitApplication() {
  const errEl = $('#submitError');
  errEl.hidden = true;

  const missing = incompleteSteps();
  if (missing.length) { goToStep(missing[0]); validateStep(missing[0]); return; }

  if (!CONFIG.SUBMIT_URL) {
    errEl.textContent = 'Submissions are not open yet — the form is not connected to a submission service. '
      + 'Please try again later or contact consulting.tenders@istc.int.';
    errEl.hidden = false;
    return;
  }

  nextBtn.disabled = true;
  backBtn.disabled = true;
  nextBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span>Submitting…';

  try {
    const response = await fetch(CONFIG.SUBMIT_URL, { method: 'POST', body: JSON.stringify(await buildPayload()) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) throw new Error(result.error || `Server responded with ${response.status}`);
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) { /* ignore */ }
    goToStep(TOTAL_STEPS + 1);
  } catch (err) {
    errEl.textContent = `Something went wrong while submitting. Please check your connection and try again. (${err.message})`;
    errEl.hidden = false;
  } finally {
    nextBtn.disabled = false;
    backBtn.disabled = false;
    nextBtn.textContent = 'Submit application';
  }
}
