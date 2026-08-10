/* ============================================================
   ISTC Consultant Database — Expression of Interest
   Multi-step form: navigation, validation, smart inputs,
   files, drafts, submission. Depends on data.js lists.
   ============================================================ */

'use strict';

/* ------------------------------------------------------------
   CONFIG — set SUBMIT_URL to your deployed Google Apps Script
   web-app URL (see apps-script/Code.gs and README.md).
   ------------------------------------------------------------ */
const CONFIG = {
  SUBMIT_URL: '',
  MAX_FILE_BYTES: 10 * 1024 * 1024, // 10 MB
  MIN_SUMMARY_WORDS: 500,
};

const EXPERTISE_OPTIONS = [
  'Chemical Risk, Safety & Security',
  'Biological Risk, Safety & Security',
  'Radiological & Nuclear Risk, Safety & Security',
  'CBRN Incident Response Planning',
  'Legislative Harmonization & Implementation Support',
  'Disease Surveillance & Epidemiology',
  'Effect of Climate Change on Security Culture',
  'Space-based Technologies',
  'Cybersecurity',
  'Physical and Operational Security of Facilities',
  'Open Source Intelligence',
  'Export Control & Non-Proliferation',
  'Research Proposal Evaluation (Peer Review / Ex-ante Evaluation)',
  'Ex-post Project Evaluation',
  'Other (specify)',
];

const TOTAL_STEPS = 11;
const DRAFT_KEY = 'istc-eoi-draft-v4';
const MAX_ASSIGNMENTS = 3;

/* ------------------------------------------------------------ State */

const state = {
  step: 0, // 0 = intro, 1..11 = form, 12 = success
  files: { cv: null, certifications: null, publications: null },
  languages: [], // [{ name, level }]
  assignments: [''], // one free-text block per assignment, up to 3
};

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ------------------------------------------------------------ Elements */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const form = $('#eoiForm');
const steps = new Map($$('.step').map((el) => [el.dataset.step, el]));
const stepNav = $('#stepNav');
const backBtn = $('#backBtn');
const nextBtn = $('#nextBtn');
const startBtn = $('#startBtn');
const progressFill = $('#progressFill');
const stepIndicator = $('#stepIndicator');
const themeToggle = $('#themeToggle');
const languageInput = $('#languageInput');
const languageChipsEl = $('#languageChips');
const languageField = $('#languageField');

/* ------------------------------------------------------------ Theme (light by default, dark opt-in) */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeToggle.setAttribute(
    'aria-label',
    theme === 'dark' ? 'Switch to light appearance' : 'Switch to dark appearance'
  );
  try { localStorage.setItem('istc-theme', theme); } catch (_) { /* ignore */ }
}

themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

applyTheme(document.documentElement.dataset.theme || 'light');

/* ------------------------------------------------------------ Helpers */

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getRadio(name) {
  const el = form.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : '';
}

function getChecks(name) {
  return $$(`input[name="${name}"]:checked`, form).map((el) => el.value);
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function isFirm() {
  return getRadio('legalStatus') === 'Consulting Firm / Organization';
}

function truncate(text, max) {
  const t = (text || '').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------ Option injection */

function injectOptions(container, name, options) {
  container.innerHTML = options
    .map(
      (value) => `
      <label class="option option-compact">
        <input type="checkbox" name="${name}" value="${escapeHtml(value)}" />
        <span class="option-check option-check-square" aria-hidden="true"></span>
        <span class="option-body"><span class="option-title">${escapeHtml(value)}</span></span>
      </label>`
    )
    .join('');
}

injectOptions($('[data-error-anchor="expertise"]'), 'expertise', EXPERTISE_OPTIONS);

/* ------------------------------------------------------------ Errors */

function showError(key, message) {
  const el = form.querySelector(`[data-error-for="${key}"]`) || $(`[data-error-for="${key}"]`);
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  const anchor = form.querySelector(`[data-error-anchor="${key}"]`) || document.getElementById(key);
  if (anchor) {
    anchor.setAttribute('aria-invalid', 'true');
    if (!prefersReducedMotion.matches) {
      anchor.classList.remove('shake');
      void anchor.offsetWidth; // restart animation
      anchor.classList.add('shake');
    }
  }
}

function clearErrors(stepEl) {
  $$('.field-error', stepEl).forEach((el) => {
    el.hidden = true;
    el.textContent = '';
  });
  $$('[aria-invalid]', stepEl).forEach((el) => el.removeAttribute('aria-invalid'));
}

/* ------------------------------------------------------------ Autocomplete (combobox) */

function attachAutocomplete(input, items, { onSelect } = {}) {
  // Honour an explicit .combo-anchor (the country search sits inside a wider
  // field and must drop its menu under the input, not the whole block).
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

  function close() {
    menu.hidden = true;
    active = -1;
    input.setAttribute('aria-expanded', 'false');
  }

  function paint() {
    [...menu.children].forEach((el, i) => el.classList.toggle('active', i === active));
    const el = menu.children[active];
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function open(list) {
    current = list;
    active = -1;
    menu.innerHTML = list
      .map((v, i) => `<button type="button" class="combo-option" role="option" data-i="${i}">${escapeHtml(v)}</button>`)
      .join('');
    menu.hidden = !list.length;
    input.setAttribute('aria-expanded', String(!!list.length));
  }

  function filter() {
    const q = input.value.trim().toLowerCase();
    if (!q) return close();
    const list = items
      .filter((v) => v.toLowerCase().includes(q))
      .sort((a, b) => Number(b.toLowerCase().startsWith(q)) - Number(a.toLowerCase().startsWith(q)))
      .slice(0, 8);
    open(list);
  }

  function choose(i) {
    const value = current[i];
    if (value == null) return;
    if (onSelect) {
      onSelect(value);
    } else {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    close();
  }

  input.addEventListener('input', filter);
  input.addEventListener('focus', filter);
  input.addEventListener('blur', () => setTimeout(close, 120));
  menu.addEventListener('pointerdown', (e) => e.preventDefault()); // keep input focus
  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('.combo-option');
    if (btn) choose(Number(btn.dataset.i));
  });

  input.addEventListener('keydown', (e) => {
    if (menu.hidden) {
      if (e.key === 'ArrowDown') filter();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = Math.min(active + 1, current.length - 1);
      paint();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(active - 1, 0);
      paint();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopImmediatePropagation();
      choose(active >= 0 ? active : 0);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      close();
    }
  });
}

attachAutocomplete($('#nationality'), NATIONALITIES);
attachAutocomplete($('#countryResidence'), COUNTRIES);

/* ------------------------------------------------------------ Languages (chips with proficiency) */

function renderLanguageChips() {
  languageChipsEl.innerHTML = state.languages
    .map(
      (lang, i) => `
      <span class="chip">
        <span class="chip-name">${escapeHtml(lang.name)}</span>
        <select class="chip-level" data-i="${i}" aria-label="Proficiency for ${escapeHtml(lang.name)}">
          ${PROFICIENCY_LEVELS.map(
            (level) => `<option value="${level}"${level === lang.level ? ' selected' : ''}>${level}</option>`
          ).join('')}
        </select>
        <button type="button" class="chip-x" data-i="${i}" aria-label="Remove ${escapeHtml(lang.name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </span>`
    )
    .join('');
}

function addLanguage(name, level = 'Working') {
  const clean = name.trim().replace(/,+$/, '');
  if (!clean) return;
  if (state.languages.some((l) => l.name.toLowerCase() === clean.toLowerCase())) return;
  state.languages.push({ name: clean, level });
  renderLanguageChips();
  const errEl = form.querySelector('[data-error-for="languages"]');
  if (errEl) { errEl.hidden = true; }
  languageField.removeAttribute('aria-invalid');
  saveDraft();
}

attachAutocomplete(languageInput, LANGUAGES, {
  onSelect: (value) => {
    addLanguage(value);
    languageInput.value = '';
  },
});

languageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && languageInput.value.trim()) {
    e.preventDefault();
    e.stopPropagation();
    addLanguage(languageInput.value);
    languageInput.value = '';
  } else if (e.key === 'Backspace' && !languageInput.value && state.languages.length) {
    state.languages.pop();
    renderLanguageChips();
    saveDraft();
  }
});

languageField.addEventListener('click', (e) => {
  if (e.target === languageField || e.target === languageChipsEl) languageInput.focus();
});

languageChipsEl.addEventListener('change', (e) => {
  const select = e.target.closest('.chip-level');
  if (!select) return;
  state.languages[Number(select.dataset.i)].level = select.value;
  saveDraft();
});

languageChipsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('.chip-x');
  if (!btn) return;
  state.languages.splice(Number(btn.dataset.i), 1);
  renderLanguageChips();
  languageInput.focus();
  saveDraft();
});

function serializeLanguages() {
  return state.languages.map((l) => `${l.name} (${l.level})`).join(', ');
}

/* ------------------------------------------------------------ Geographic experience (map picker) */

const regionChipsEl = $('#regionChips');
const countryChipsEl = $('#countryChips');
const countryCountEl = $('#countryCount');
const clearCountriesBtn = $('#clearCountries');
const countrySearch = $('#countrySearch');

const picker = createWorldMap($('#pickerMap'), {
  mode: 'picker',
  onChange: () => {
    renderPickerState();
    saveDraft();
  },
});

function renderPickerState() {
  const { ids, names } = picker.getSelection();

  countryCountEl.textContent = ids.length
    ? `${ids.length} ${ids.length === 1 ? 'country' : 'countries'} selected`
    : 'No countries selected yet';
  clearCountriesBtn.hidden = !ids.length;

  // Region chips reflect "every country in this region is on"
  $$('.region-chip', regionChipsEl).forEach((chip) => {
    const list = countriesInRegion(chip.dataset.region);
    chip.classList.toggle('is-on', list.length > 0 && list.every((c) => picker.has(c.i)));
  });

  countryChipsEl.innerHTML = ids
    .map((id) => COUNTRY_BY_ID.get(id))
    .sort((a, b) => a.n.localeCompare(b.n))
    .map(
      (c) => `
      <span class="country-chip">
        ${escapeHtml(c.n)}
        <button type="button" data-remove-country="${c.i}" aria-label="Remove ${escapeHtml(c.n)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </span>`
    )
    .join('');

  if (ids.length) {
    const errEl = form.querySelector('[data-error-for="geography"]');
    if (errEl) errEl.hidden = true;
  }
  void names;
}

regionChipsEl.innerHTML = ISTC_REGIONS.map(
  (r) => `<button type="button" class="region-chip" data-region="${escapeHtml(r)}">${escapeHtml(r)}</button>`
).join('');

regionChipsEl.addEventListener('click', (e) => {
  const chip = e.target.closest('.region-chip');
  if (chip) picker.toggleRegion(chip.dataset.region);
});

countryChipsEl.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove-country]');
  if (btn) picker.remove([btn.dataset.removeCountry]);
});

clearCountriesBtn.addEventListener('click', () => picker.clear());

attachAutocomplete(countrySearch, WORLD_MAP.countries.map((c) => c.n), {
  onSelect: (name) => {
    const match = WORLD_MAP.countries.find((c) => c.n === name);
    if (!match) return;
    picker.add([match.i]);
    picker.flash(match.i);
    countrySearch.value = '';
  },
});

renderPickerState();

/* ------------------------------------------------------------ Assignments (free text, up to 3) */

const assignmentsList = $('#assignmentsList');
const addAssignmentBtn = $('#addAssignment');

const ASSIGNMENT_PLACEHOLDER =
  'e.g. Biosafety capacity building programme — UNODA, Kazakhstan, Mar 2022 – Jan 2023, Lead consultant.\n'
  + 'Designed and delivered national biosafety training for 120 laboratory specialists…';

function renderAssignments() {
  assignmentsList.innerHTML = state.assignments
    .map(
      (text, i) => `
      <div class="assignment-card">
        <div class="assignment-head">
          <label class="assignment-num" for="assignment-${i}">Assignment ${i + 1}${i > 0 ? ' · optional' : ''}</label>
          ${state.assignments.length > 1
            ? `<button type="button" class="assignment-remove" data-remove="${i}">Remove</button>`
            : ''}
        </div>
        <textarea class="text-input assignment-text" id="assignment-${i}" rows="4"
          data-i="${i}" placeholder="${escapeHtml(ASSIGNMENT_PLACEHOLDER)}">${escapeHtml(text)}</textarea>
      </div>`
    )
    .join('');
  addAssignmentBtn.hidden = state.assignments.length >= MAX_ASSIGNMENTS;
}

assignmentsList.addEventListener('input', (e) => {
  const { i } = e.target.dataset;
  if (i == null) return;
  state.assignments[Number(i)] = e.target.value;
  saveDraft();
});

assignmentsList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-remove]');
  if (!btn) return;
  state.assignments.splice(Number(btn.dataset.remove), 1);
  if (!state.assignments.length) state.assignments.push('');
  renderAssignments();
  saveDraft();
});

addAssignmentBtn.addEventListener('click', () => {
  if (state.assignments.length >= MAX_ASSIGNMENTS) return;
  state.assignments.push('');
  renderAssignments();
  const added = document.getElementById(`assignment-${state.assignments.length - 1}`);
  if (added) added.focus();
  saveDraft();
});

function filledAssignments() {
  return state.assignments.map((t) => t.trim()).filter(Boolean);
}

function serializeAssignments() {
  return filledAssignments()
    .map((text, i) => `${i + 1}. ${text}`)
    .join('\n\n');
}

renderAssignments();

/* ------------------------------------------------------------ Validation */

const validators = {
  1() {
    const errors = [];
    if (!getRadio('role')) errors.push(['role', 'Please choose a role.']);
    if (!getRadio('legalStatus')) errors.push(['legalStatus', 'Please choose a legal status.']);
    return errors;
  },
  2() {
    const errors = [];
    if (isFirm() && !getValue('orgName')) errors.push(['orgName', 'Please enter your organization name.']);

    const fullName = getValue('fullName');
    if (!fullName) errors.push(['fullName', 'Please enter a name.']);
    else if (!/\p{L}.*\p{L}/u.test(fullName)) errors.push(['fullName', 'Please enter a real name.']);

    const nameLike = (v) => /^\p{L}[\p{L}\s'’.()\-]*$/u.test(v);
    const nationality = getValue('nationality');
    if (!nationality) errors.push(['nationality', 'Please enter your nationality.']);
    else if (!nameLike(nationality)) errors.push(['nationality', 'Please enter a valid nationality, e.g. Kazakhstani.']);

    const country = getValue('countryResidence');
    if (!country) errors.push(['countryResidence', 'Please enter your country of residence.']);
    else if (!nameLike(country)) errors.push(['countryResidence', 'Please enter a valid country name.']);

    const email = getValue('email');
    if (!email) errors.push(['email', 'Please enter your email address.']);
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(['email', 'That doesn’t look like a valid email address.']);

    const phone = getValue('phone');
    const phoneDigits = phone.replace(/\D/g, '');
    if (!phone) errors.push(['phone', 'Please enter your phone number.']);
    else if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      errors.push(['phone', 'Please enter a valid phone number, e.g. +7 700 123 4567.']);
    }
    return errors;
  },
  3() {
    const errors = [];
    if (!state.files.cv) errors.push(['cv', 'Please upload your CV.']);
    return errors;
  },
  4() {
    const errors = [];
    const chosen = getChecks('expertise');
    if (!chosen.length) errors.push(['expertise', 'Please select at least one area of expertise.']);
    if (chosen.includes('Other (specify)') && !getValue('expertiseOther')) {
      errors.push(['expertiseOther', 'Please specify your other area of expertise.']);
    }
    return errors;
  },
  5() {
    const errors = [];
    if (!getRadio('experience')) errors.push(['experience', 'Please select your years of experience.']);
    if (!picker.size()) {
      errors.push(['geography', 'Please select at least one country — click the map, or add a whole region.']);
    }
    return errors;
  },
  6() {
    const errors = [];
    // Adopt any language still sitting in the input box
    if (languageInput.value.trim()) {
      addLanguage(languageInput.value);
      languageInput.value = '';
    }
    if (!state.languages.length) errors.push(['languages', 'Please add at least one language.']);
    const words = wordCount(getValue('summary'));
    if (!words) errors.push(['summary', 'Please write a summary of your expertise.']);
    else if (words < CONFIG.MIN_SUMMARY_WORDS) {
      errors.push(['summary', `Please write at least ${CONFIG.MIN_SUMMARY_WORDS} words (currently ${words}).`]);
    }
    const first = (state.assignments[0] || '').trim();
    if (first.length < 20) {
      errors.push(['assignments', 'Please describe Assignment 1 — include the project title, client, and a short description.']);
    }
    return errors;
  },
  7() {
    return getChecks('availability').length ? [] : [['availability', 'Please select at least one option.']];
  },
  8() {
    const errors = [];
    const daily = getValue('dailyRate');
    const hourly = getValue('hourlyRate');
    if (!daily || Number(daily) <= 0) errors.push(['dailyRate', 'Please enter your daily rate.']);
    if (!hourly || Number(hourly) <= 0) errors.push(['hourlyRate', 'Please enter your hourly rate.']);
    return errors;
  },
  9() {
    const errors = [];
    const prev = getRadio('previousWork');
    if (!prev) errors.push(['previousWork', 'Please choose an option.']);
    if (prev === 'Yes' && !getValue('referenceNumber')) {
      errors.push(['referenceNumber', 'Please provide the assignment reference number.']);
    }
    return errors;
  },
  10() {
    const errors = [];
    if (!form.querySelector('input[name="conflictAgree"]').checked) {
      errors.push(['conflictAgree', 'You must agree to the conflict of interest declaration to continue.']);
    }
    if (!form.querySelector('input[name="dataAgree"]').checked) {
      errors.push(['dataAgree', 'You must acknowledge the data protection notice to continue.']);
    }
    return errors;
  },
  11() {
    return [];
  },
};

function validateStep(step) {
  const stepEl = steps.get(String(step));
  clearErrors(stepEl);
  const errors = (validators[step] || (() => []))();
  errors.forEach(([key, message]) => showError(key, message));
  if (errors.length) {
    const firstAnchor =
      form.querySelector(`[data-error-anchor="${errors[0][0]}"]`) ||
      document.getElementById(errors[0][0]);
    if (firstAnchor) firstAnchor.scrollIntoView({ block: 'center', behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' });
  }
  return errors.length === 0;
}

/* ------------------------------------------------------------ Navigation */

function stepKey(step) {
  if (step === 0) return 'intro';
  if (step === 12) return 'success';
  return String(step);
}

function goToStep(next, { animate = true } = {}) {
  const direction = next > state.step ? 'forward' : 'back';
  const current = steps.get(stepKey(state.step));
  const target = steps.get(stepKey(next));
  if (!target) return;

  current.hidden = true;
  current.classList.remove('entering', 'entering-back');

  state.step = next;
  target.hidden = false;

  if (animate) {
    target.classList.remove('entering', 'entering-back');
    void target.offsetWidth;
    target.classList.add(direction === 'forward' ? 'entering' : 'entering-back');
  }

  const inForm = next >= 1 && next <= TOTAL_STEPS;
  stepNav.hidden = !inForm;
  backBtn.textContent = 'Back';
  nextBtn.textContent = next === TOTAL_STEPS ? 'Submit application' : 'Continue';

  const pct = next === 0 ? 0 : next >= 12 ? 100 : Math.round((next / TOTAL_STEPS) * 100);
  progressFill.style.width = `${pct}%`;
  stepIndicator.textContent = inForm ? `Step ${next} of ${TOTAL_STEPS}` : next >= 12 ? 'Submitted' : '';

  window.scrollTo({ top: 0, behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' });

  const heading = $('.step-title, .success-title', target);
  if (heading) heading.focus({ preventScroll: true });

  if (next === 2) syncLegalStatusUI();
  if (next === TOTAL_STEPS) renderReview();
}

[startBtn, $('#startBtn2'), $('#startBtn3')].filter(Boolean).forEach((btn) =>
  btn.addEventListener('click', () => goToStep(1))
);

backBtn.addEventListener('click', () => {
  if (state.step > 1) goToStep(state.step - 1);
  else goToStep(0);
});

nextBtn.addEventListener('click', () => {
  if (!validateStep(state.step)) return;
  if (state.step === TOTAL_STEPS) {
    submitApplication();
  } else {
    goToStep(state.step + 1);
  }
});

form.addEventListener('submit', (e) => e.preventDefault());

// Enter in a single-line input advances the step (textareas keep Enter for newlines;
// comboboxes and the language input consume Enter themselves when relevant)
form.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  if (e.target.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="file"])')) {
    e.preventDefault();
    nextBtn.click();
  }
});

/* ------------------------------------------------------------ Conditional fields */

function syncLegalStatusUI() {
  const firm = isFirm();
  $('#orgNameField').hidden = !firm;
  $('#fullNameLabel').innerHTML = firm
    ? 'Contact Person <span class="req" aria-hidden="true">*</span>'
    : 'Full Name <span class="req" aria-hidden="true">*</span>';
}

form.addEventListener('change', (e) => {
  const { name, value } = e.target;

  if (name === 'legalStatus') syncLegalStatusUI();

  if (name === 'expertise') {
    $('#expertiseOtherField').hidden = !getChecks('expertise').includes('Other (specify)');
  }

  if (name === 'previousWork') {
    $('#referenceField').hidden = value !== 'Yes';
  }

  saveDraft();
});

/* ------------------------------------------------------------ Word counter */

const summaryEl = $('#summary');
const summaryCounter = $('#summaryCounter');

summaryEl.addEventListener('input', () => {
  const words = wordCount(summaryEl.value);
  summaryCounter.textContent = `${words} / ${CONFIG.MIN_SUMMARY_WORDS} words`;
  summaryCounter.classList.toggle('ok', words >= CONFIG.MIN_SUMMARY_WORDS);
});

/* ------------------------------------------------------------ Input sanitizers */

// Phone: only digits, one leading +, spaces, parentheses, dashes — letters never appear
const phoneEl = $('#phone');
phoneEl.addEventListener('input', () => {
  const cleaned = phoneEl.value
    .replace(/[^\d+()\-\s]/g, '')
    .replace(/(?!^)\+/g, ''); // + allowed only as the first character
  if (cleaned !== phoneEl.value) {
    const pos = phoneEl.selectionStart - (phoneEl.value.length - cleaned.length);
    phoneEl.value = cleaned;
    phoneEl.setSelectionRange(Math.max(0, pos), Math.max(0, pos));
  }
});

// Live "valid" affordance on email as you type
const emailEl = $('#email');
emailEl.addEventListener('input', () => {
  if (emailEl.getAttribute('aria-invalid') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailEl.value.trim())) {
    emailEl.removeAttribute('aria-invalid');
    const errEl = form.querySelector('[data-error-for="email"]');
    if (errEl) errEl.hidden = true;
  }
});

/* ------------------------------------------------------------ Rate helper */

const dailyRateEl = $('#dailyRate');
const hourlyRateEl = $('#hourlyRate');
const rateHint = $('#rateHint');

function updateRateHint() {
  const daily = Number(dailyRateEl.value);
  if (daily > 0) {
    rateHint.textContent = `For reference: €${daily} / day ≈ €${Math.round(daily / 8)} / hour on an 8-hour day.`;
    rateHint.hidden = false;
  } else {
    rateHint.hidden = true;
  }
}

dailyRateEl.addEventListener('input', updateRateHint);

// Number fields: block exponent/sign keys so only digits (and a dot) can be typed
[dailyRateEl, hourlyRateEl].forEach((el) =>
  el.addEventListener('keydown', (e) => {
    if (['e', 'E', '+', '-'].includes(e.key)) e.preventDefault();
  })
);

/* ------------------------------------------------------------ File uploads */

$$('.dropzone').forEach((zone) => {
  const key = zone.dataset.fileKey;
  const input = $('input[type="file"]', zone);
  const empty = $('.dropzone-empty', zone);
  const chip = $('.file-chip', zone);
  const nameEl = $('.file-chip-name', zone);
  const sizeEl = $('.file-chip-size', zone);
  const removeBtn = $('.file-chip-remove', zone);

  function render() {
    const file = state.files[key];
    empty.hidden = !!file;
    chip.hidden = !file;
    zone.classList.toggle('has-file', !!file);
    if (file) {
      nameEl.textContent = file.name;
      sizeEl.textContent = formatBytes(file.size);
    }
  }

  function accept(file) {
    const errEl = form.querySelector(`[data-error-for="${key}"]`);
    if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
    if (!file) return;
    if (file.size > CONFIG.MAX_FILE_BYTES) {
      showError(key, `"${file.name}" is ${formatBytes(file.size)} — the limit is 10 MB.`);
      return;
    }
    state.files[key] = file;
    render();
  }

  zone.addEventListener('click', (e) => {
    if (e.target.closest('.file-chip-remove')) return;
    if (!state.files[key]) input.click();
  });

  zone.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !state.files[key]) {
      e.preventDefault();
      input.click();
    }
  });

  input.addEventListener('change', () => {
    accept(input.files[0]);
    input.value = '';
  });

  ['dragenter', 'dragover'].forEach((evt) =>
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    })
  );

  ['dragleave', 'drop'].forEach((evt) =>
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
    })
  );

  zone.addEventListener('drop', (e) => {
    accept(e.dataTransfer.files[0]);
  });

  removeBtn.addEventListener('click', () => {
    state.files[key] = null;
    render();
  });
});

/* ------------------------------------------------------------ Draft persistence (no files) */

function collectTextState() {
  const geo = picker.getSelection();
  return {
    role: getRadio('role'),
    legalStatus: getRadio('legalStatus'),
    orgName: getValue('orgName'),
    fullName: getValue('fullName'),
    nationality: getValue('nationality'),
    countryResidence: getValue('countryResidence'),
    email: getValue('email'),
    phone: getValue('phone'),
    expertise: getChecks('expertise'),
    expertiseOther: getValue('expertiseOther'),
    experience: getRadio('experience'),
    geography: geo.regions,
    countries: geo.names,
    countryCodes: geo.ids,
    languages: serializeLanguages(),
    summary: getValue('summary'),
    assignments: serializeAssignments(),
    availability: getChecks('availability'),
    dailyRate: getValue('dailyRate'),
    hourlyRate: getValue('hourlyRate'),
    previousWork: getRadio('previousWork'),
    referenceNumber: getValue('referenceNumber'),
    conflictAgree: form.querySelector('input[name="conflictAgree"]').checked,
    dataAgree: form.querySelector('input[name="dataAgree"]').checked,
  };
}

let draftTimer = null;
function saveDraft() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          ...collectTextState(),
          languagesList: state.languages,
          assignmentsList: state.assignments,
        })
      );
    } catch (_) { /* storage unavailable — ignore */ }
  }, 400);
}

form.addEventListener('input', saveDraft);

function restoreDraft() {
  let draft;
  try {
    draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
  } catch (_) {
    return;
  }
  if (!draft) return;

  const setRadio = (name, value) => {
    if (!value) return;
    const el = [...form.querySelectorAll(`input[name="${name}"]`)].find((i) => i.value === value);
    if (el) el.checked = true;
  };
  const setChecks = (name, values = []) => values.forEach((value) => setRadio(name, value));
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el && value != null) el.value = value;
  };

  setRadio('role', draft.role);
  setRadio('legalStatus', draft.legalStatus);
  setText('orgName', draft.orgName);
  setText('fullName', draft.fullName);
  setText('nationality', draft.nationality);
  setText('countryResidence', draft.countryResidence);
  setText('email', draft.email);
  setText('phone', draft.phone);
  setChecks('expertise', draft.expertise);
  setText('expertiseOther', draft.expertiseOther);
  setRadio('experience', draft.experience);
  setText('summary', draft.summary);
  setChecks('availability', draft.availability);
  setText('dailyRate', draft.dailyRate);
  setText('hourlyRate', draft.hourlyRate);
  setRadio('previousWork', draft.previousWork);
  setText('referenceNumber', draft.referenceNumber);
  if (draft.conflictAgree) form.querySelector('input[name="conflictAgree"]').checked = true;
  if (draft.dataAgree) form.querySelector('input[name="dataAgree"]').checked = true;

  if (Array.isArray(draft.languagesList)) {
    state.languages = draft.languagesList.filter((l) => l && l.name);
    renderLanguageChips();
  }
  if (Array.isArray(draft.countryCodes)) {
    picker.setSelection(draft.countryCodes);
    renderPickerState();
  }
  if (Array.isArray(draft.assignmentsList) && draft.assignmentsList.length) {
    state.assignments = draft.assignmentsList
      .slice(0, MAX_ASSIGNMENTS)
      .map((a) => {
        if (typeof a === 'string') return a;
        // migrate old structured drafts to free text
        const meta = [a.client, a.country, a.duration, a.role].filter(Boolean).join(', ');
        return [[a.title, meta].filter(Boolean).join(' — '), a.description || ''].filter(Boolean).join('\n');
      });
    renderAssignments();
  }

  syncLegalStatusUI();
  $('#expertiseOtherField').hidden = !(draft.expertise || []).includes('Other (specify)');
  $('#referenceField').hidden = draft.previousWork !== 'Yes';
  summaryEl.dispatchEvent(new Event('input'));
  updateRateHint();
}

restoreDraft();

/* ------------------------------------------------------------ Review */

function renderReview() {
  const data = collectTextState();
  const fileLabel = (key) =>
    state.files[key] ? `${state.files[key].name} (${formatBytes(state.files[key].size)})` : null;

  const groups = [
    {
      title: 'Application Type', step: 1,
      rows: [
        ['Role', data.role],
        ['Legal status', data.legalStatus],
      ],
    },
    {
      title: 'General Information', step: 2,
      rows: [
        ...(isFirm() ? [['Organization', data.orgName]] : []),
        [isFirm() ? 'Contact person' : 'Full name', data.fullName],
        ['Nationality', data.nationality],
        ['Country of residence', data.countryResidence],
        ['Email', data.email],
        ['Phone', data.phone],
      ],
    },
    {
      title: 'Documents', step: 3,
      rows: [
        ['CV', fileLabel('cv')],
        ['Certifications', fileLabel('certifications') || '—'],
        ['Publications', fileLabel('publications') || '—'],
      ],
    },
    {
      title: 'Expertise', step: 4,
      rows: [
        ['Areas', data.expertise.filter((v) => v !== 'Other (specify)').join('\n') || '—'],
        ...(data.expertiseOther ? [['Other', data.expertiseOther]] : []),
      ],
    },
    {
      title: 'Technical Profile', step: 5,
      rows: [
        ['Experience', data.experience],
        ['Regions', data.geography.join('\n') || '—'],
        ['Countries', data.countries.length
          ? `${data.countries.length} selected — ${truncate(data.countries.join(', '), 160)}`
          : '—'],
      ],
    },
    {
      title: 'Professional Background', step: 6,
      rows: [
        ['Languages', data.languages],
        ['Summary', `${wordCount(data.summary)} words`],
        ['Key assignments', filledAssignments().map((t) => {
          const firstLine = t.split('\n')[0];
          return firstLine.length > 90 ? `${firstLine.slice(0, 90)}…` : firstLine;
        }).join('\n') || '—'],
      ],
    },
    {
      title: 'Availability & Rates', step: 7,
      rows: [
        ['Availability', data.availability.join('\n')],
        ['Daily rate', data.dailyRate ? `€${data.dailyRate} / day` : ''],
        ['Hourly rate', data.hourlyRate ? `€${data.hourlyRate} / hour` : ''],
      ],
    },
    {
      title: 'Previous Collaboration', step: 9,
      rows: [
        ['Worked with ISTC', data.previousWork],
        ...(data.previousWork === 'Yes' ? [['Reference number', data.referenceNumber]] : []),
      ],
    },
  ];

  $('#reviewContent').innerHTML = groups
    .map(
      (group) => `
      <div class="review-group">
        <div class="review-group-head">
          <span class="review-group-title">${group.title}</span>
          <button type="button" class="review-edit" data-goto="${group.step}">Edit</button>
        </div>
        ${group.rows
          .map(
            ([key, value]) => `
          <div class="review-row">
            <span class="review-key">${escapeHtml(key)}</span>
            <span class="review-val${value === '—' ? ' muted' : ''}">${escapeHtml(value || '—')}</span>
          </div>`
          )
          .join('')}
      </div>`
    )
    .join('');

  $$('#reviewContent .review-edit').forEach((btn) =>
    btn.addEventListener('click', () => goToStep(Number(btn.dataset.goto)))
  );
}

/* ------------------------------------------------------------ Submission */

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(String(reader.result).split(',')[1] || '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function buildPayload() {
  const data = collectTextState();
  const files = {};
  for (const key of ['cv', 'certifications', 'publications']) {
    const file = state.files[key];
    if (file) {
      files[key] = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: await fileToBase64(file),
      };
    }
  }
  return { ...data, files, submittedAt: new Date().toISOString() };
}

async function submitApplication() {
  const errEl = $('#submitError');
  errEl.hidden = true;

  if (!CONFIG.SUBMIT_URL) {
    errEl.textContent =
      'Submissions are not open yet — the form is not connected to a submission service. ' +
      'Please try again later or contact consulting.tenders@istc.int.';
    errEl.hidden = false;
    return;
  }

  nextBtn.disabled = true;
  backBtn.disabled = true;
  nextBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span>Submitting…';

  try {
    const payload = await buildPayload();
    const response = await fetch(CONFIG.SUBMIT_URL, {
      method: 'POST',
      body: JSON.stringify(payload), // no Content-Type header → simple request, no CORS preflight
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      throw new Error(result.error || `Server responded with ${response.status}`);
    }
    try { localStorage.removeItem(DRAFT_KEY); } catch (_) { /* ignore */ }
    goToStep(12);
  } catch (err) {
    errEl.textContent =
      'Something went wrong while submitting. Please check your connection and try again. ' +
      `(${err.message})`;
    errEl.hidden = false;
  } finally {
    nextBtn.disabled = false;
    backBtn.disabled = false;
    nextBtn.textContent = 'Submit application';
  }
}

/* The sticky-header hairline lives in landing.js, which owns scroll behaviour. */
