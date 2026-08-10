/* ============================================================
   ISTC Consultant Database — Expression of Interest
   Multi-step form: navigation, validation, files, submission.
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

const GEOGRAPHY_OPTIONS = [
  'Central Asia',
  'Eastern Europe',
  'South Caucasus',
  'Middle East',
  'Africa',
  'Southeast Asia',
  'South America',
  'Central America',
  'Global / Multi-Regional',
  'Other (specify)',
];

const TOTAL_STEPS = 11;
const DRAFT_KEY = 'istc-eoi-draft-v1';

/* ------------------------------------------------------------ State */

const state = {
  step: 0, // 0 = intro, 1..11 = form, 12 = success
  files: { cv: null, certifications: null, publications: null },
};

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

/* ------------------------------------------------------------ Elements */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const form = $('#eoiForm');
const steps = new Map(
  $$('.step').map((el) => [el.dataset.step, el])
);
const stepNav = $('#stepNav');
const backBtn = $('#backBtn');
const nextBtn = $('#nextBtn');
const startBtn = $('#startBtn');
const progressFill = $('#progressFill');
const stepIndicator = $('#stepIndicator');
const siteHeader = $('#siteHeader');

/* ------------------------------------------------------------ Option injection */

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function injectOptions(container, name, options) {
  container.innerHTML = options
    .map(
      (value) => `
      <label class="option option-compact">
        <input type="checkbox" name="${name}" value="${value.replace(/"/g, '&quot;')}" />
        <span class="option-check option-check-square" aria-hidden="true"></span>
        <span class="option-body"><span class="option-title">${value}</span></span>
      </label>`
    )
    .join('');
}

injectOptions($('[data-error-anchor="expertise"]'), 'expertise', EXPERTISE_OPTIONS);
injectOptions($('[data-error-anchor="geography"]'), 'geography', GEOGRAPHY_OPTIONS);

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
    if (!getValue('fullName')) errors.push(['fullName', 'Please enter a name.']);
    if (!getValue('nationality')) errors.push(['nationality', 'Please enter your nationality.']);
    if (!getValue('countryResidence')) errors.push(['countryResidence', 'Please enter your country of residence.']);
    const email = getValue('email');
    if (!email) errors.push(['email', 'Please enter your email address.']);
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(['email', 'That doesn’t look like a valid email address.']);
    if (!getValue('phone')) errors.push(['phone', 'Please enter your phone number.']);
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
    const geo = getChecks('geography');
    if (!geo.length) errors.push(['geography', 'Please select at least one region.']);
    if (geo.includes('Other (specify)') && !getValue('geographyOther')) {
      errors.push(['geographyOther', 'Please specify the other region.']);
    }
    return errors;
  },
  6() {
    const errors = [];
    if (!getValue('languages')) errors.push(['languages', 'Please list your working languages.']);
    const words = wordCount(getValue('summary'));
    if (!words) errors.push(['summary', 'Please write a summary of your expertise.']);
    else if (words < CONFIG.MIN_SUMMARY_WORDS) {
      errors.push(['summary', `Please write at least ${CONFIG.MIN_SUMMARY_WORDS} words (currently ${words}).`]);
    }
    if (!getValue('assignments')) errors.push(['assignments', 'Please describe up to three key assignments.']);
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

  // Progress
  const pct = next === 0 ? 0 : next >= 12 ? 100 : Math.round((next / TOTAL_STEPS) * 100);
  progressFill.style.width = `${pct}%`;
  stepIndicator.textContent = inForm ? `Step ${next} of ${TOTAL_STEPS}` : next >= 12 ? 'Submitted' : '';

  window.scrollTo({ top: 0, behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' });

  // Move focus to the step heading for screen readers
  const heading = $('.step-title, .success-title', target);
  if (heading) heading.focus({ preventScroll: true });

  if (next === 2) syncLegalStatusUI();
  if (next === TOTAL_STEPS) renderReview();
}

startBtn.addEventListener('click', () => goToStep(1));

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
    const otherOn = getChecks('expertise').includes('Other (specify)');
    $('#expertiseOtherField').hidden = !otherOn;
  }

  if (name === 'geography') {
    const otherOn = getChecks('geography').includes('Other (specify)');
    $('#geographyOtherField').hidden = !otherOn;
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

/* ------------------------------------------------------------ Draft persistence (text fields only) */

function collectTextState() {
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
    geography: getChecks('geography'),
    geographyOther: getValue('geographyOther'),
    languages: getValue('languages'),
    summary: getValue('summary'),
    assignments: getValue('assignments'),
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
      localStorage.setItem(DRAFT_KEY, JSON.stringify(collectTextState()));
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
    const el = form.querySelector(`input[name="${name}"][value="${CSS.escape(value)}"]`);
    if (el) el.checked = true;
  };
  const setChecks = (name, values = []) =>
    values.forEach((value) => setRadio(name, value));
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el && value != null) el.value = value;
  };

  setRadio('role', draft.role || '');
  setRadio('legalStatus', draft.legalStatus || '');
  setText('orgName', draft.orgName);
  setText('fullName', draft.fullName);
  setText('nationality', draft.nationality);
  setText('countryResidence', draft.countryResidence);
  setText('email', draft.email);
  setText('phone', draft.phone);
  setChecks('expertise', draft.expertise);
  setText('expertiseOther', draft.expertiseOther);
  setRadio('experience', draft.experience || '');
  setChecks('geography', draft.geography);
  setText('geographyOther', draft.geographyOther);
  setText('languages', draft.languages);
  setText('summary', draft.summary);
  setText('assignments', draft.assignments);
  setChecks('availability', draft.availability);
  setText('dailyRate', draft.dailyRate);
  setText('hourlyRate', draft.hourlyRate);
  setRadio('previousWork', draft.previousWork || '');
  setText('referenceNumber', draft.referenceNumber);
  if (draft.conflictAgree) form.querySelector('input[name="conflictAgree"]').checked = true;
  if (draft.dataAgree) form.querySelector('input[name="dataAgree"]').checked = true;

  // Sync conditional UI
  syncLegalStatusUI();
  $('#expertiseOtherField').hidden = !(draft.expertise || []).includes('Other (specify)');
  $('#geographyOtherField').hidden = !(draft.geography || []).includes('Other (specify)');
  $('#referenceField').hidden = draft.previousWork !== 'Yes';
  summaryEl.dispatchEvent(new Event('input'));
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
        ['Regions', data.geography.filter((v) => v !== 'Other (specify)').join('\n') || '—'],
        ...(data.geographyOther ? [['Other region', data.geographyOther]] : []),
      ],
    },
    {
      title: 'Professional Background', step: 6,
      rows: [
        ['Languages', data.languages],
        ['Summary', `${wordCount(data.summary)} words`],
        ['Key assignments', truncate(data.assignments, 220)],
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

function truncate(text, max) {
  const t = (text || '').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ------------------------------------------------------------ Submission */

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result; // data:<mime>;base64,<data>
      resolve(String(result).split(',')[1] || '');
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

/* ------------------------------------------------------------ Header hairline on scroll */

let scrollTicking = false;
window.addEventListener('scroll', () => {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    siteHeader.classList.toggle('scrolled', window.scrollY > 8);
    scrollTicking = false;
  });
});
