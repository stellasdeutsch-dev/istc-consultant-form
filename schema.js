/* ============================================================
   Form schema — the single source of truth for what the
   application asks. The admin panel edits this shape; the public
   form renders it. Anything an admin can change lives here.

   A saved schema in localStorage (or form-schema.json next to
   index.html) overrides DEFAULT_SCHEMA.
   ============================================================ */

'use strict';

const SCHEMA_STORAGE_KEY = 'istc-form-schema-v1';

/* Question types the renderer understands. `fields` drives which
   editors the admin panel shows for each type. */
const QUESTION_TYPES = {
  short_text: { label: 'Short answer', icon: 'pen', fields: ['placeholder', 'source', 'pattern'] },
  paragraph: { label: 'Paragraph', icon: 'doc', fields: ['placeholder', 'minWords'] },
  radio: { label: 'Multiple choice', icon: 'check', fields: ['options', 'allowOther', 'layout'] },
  checkbox: { label: 'Checkboxes', icon: 'clipboard', fields: ['options', 'allowOther', 'layout'] },
  dropdown: { label: 'Dropdown', icon: 'layers', fields: ['options'] },
  scale: { label: 'Linear scale', icon: 'chart', fields: ['options'] },
  email: { label: 'Email', icon: 'mail', fields: ['placeholder'] },
  phone: { label: 'Phone number', icon: 'phone', fields: ['placeholder'] },
  number: { label: 'Number', icon: 'euro', fields: ['prefix', 'suffix', 'min', 'max'] },
  date_month: { label: 'Month & year', icon: 'calendar', fields: [] },
  file: { label: 'File upload', icon: 'upload', fields: ['accept', 'maxMB'] },
  statement: { label: 'Statement + consent', icon: 'shield', fields: ['body', 'consentLabel'] },
  country_map: { label: 'Countries (world map)', icon: 'globe', fields: [] },
  languages: { label: 'Languages (with proficiency)', icon: 'translate', fields: [] },
  assignments: { label: 'Assignments (repeatable)', icon: 'briefcase', fields: ['maxItems'] },
  rate_pair: { label: 'Paired rates (day / hour)', icon: 'euro', fields: [] },
};

const EXPERTISE_DEFAULTS = [
  ['Chemical Risk, Safety & Security', 'flask'],
  ['Biological Risk, Safety & Security', 'bio'],
  ['Radiological & Nuclear Risk, Safety & Security', 'atom'],
  ['CBRN Incident Response Planning', 'alert'],
  ['Legislative Harmonization & Implementation Support', 'scale'],
  ['Disease Surveillance & Epidemiology', 'pulse'],
  ['Effect of Climate Change on Security Culture', 'climate'],
  ['Space-based Technologies', 'rocket'],
  ['Cybersecurity', 'lock'],
  ['Physical and Operational Security of Facilities', 'facility'],
  ['Open Source Intelligence', 'eye'],
  ['Export Control & Non-Proliferation', 'box'],
  ['Research Proposal Evaluation (Peer Review / Ex-ante Evaluation)', 'clipboard'],
  ['Ex-post Project Evaluation', 'chart'],
];

const DEFAULT_SCHEMA = {
  version: 1,
  title: 'ISTC Consultant Database — Expression of Interest',
  description: 'Submit an Expression of Interest for inclusion in the ISTC Consultant Database.',
  steps: [
    {
      id: 'type',
      title: 'Application Type',
      subtitle: 'Tell us how you would like to work with ISTC.',
      icon: 'briefcase',
      navLabel: 'Type',
      questions: [
        {
          id: 'role', type: 'radio', title: 'Role', required: true, icon: 'briefcase',
          options: [
            { value: 'Consultant (Technical / Advisory Assignments)', label: 'Consultant', desc: 'Technical / advisory assignments', icon: 'briefcase' },
            { value: 'Peer reviewer (Proposal / Project Evaluation)', label: 'Peer reviewer', desc: 'Proposal / project evaluation', icon: 'clipboard' },
            { value: 'Researcher (research, implementation, training, and evaluation)', label: 'Researcher', desc: 'Research, implementation, training, and evaluation', icon: 'flask' },
          ],
        },
        {
          id: 'legalStatus', type: 'radio', title: 'Legal Status', required: true, layout: 'row', icon: 'building',
          options: [
            { value: 'Individual Consultant', label: 'Individual', desc: 'Individual consultant', icon: 'user' },
            { value: 'Consulting Firm / Organization', label: 'Firm', desc: 'Consulting firm / organization', icon: 'building' },
          ],
        },
      ],
    },
    {
      id: 'general',
      title: 'General Information',
      subtitle: 'How can we reach you?',
      icon: 'user',
      navLabel: 'Details',
      questions: [
        { id: 'orgName', type: 'short_text', title: 'Organization Name', required: true, icon: 'building',
          showIf: { question: 'legalStatus', equals: 'Consulting Firm / Organization' } },
        { id: 'fullName', type: 'short_text', title: 'Full Name', required: true, icon: 'user',
          pattern: 'name', patternMessage: 'Please enter a real name.' },
        { id: 'nationality', type: 'short_text', title: 'Nationality', required: true, icon: 'flag',
          placeholder: 'Start typing…', source: 'nationalities', half: true,
          pattern: 'letters', patternMessage: 'Please enter a valid nationality, e.g. Kazakhstani.' },
        { id: 'countryResidence', type: 'short_text', title: 'Country of Residence', required: true, icon: 'globe',
          placeholder: 'Start typing…', source: 'countries', half: true,
          pattern: 'letters', patternMessage: 'Please enter a valid country name.' },
        { id: 'email', type: 'email', title: 'Email Address', required: true, icon: 'mail', half: true },
        { id: 'phone', type: 'phone', title: 'Phone Number', required: true, icon: 'phone',
          placeholder: '+1 234 567 8900', half: true },
      ],
    },
    {
      id: 'documents',
      title: 'Supporting Documents',
      subtitle: 'PDF or Word documents, one file each, up to 10 MB.',
      icon: 'doc',
      navLabel: 'Documents',
      questions: [
        { id: 'cv', type: 'file', title: 'Curriculum Vitae', required: true, maxMB: 10,
          accept: '.pdf,.doc,.docx,.rtf,.odt,.txt' },
        { id: 'certifications', type: 'file', title: 'Relevant Certifications', required: false, maxMB: 10,
          accept: '.pdf,.doc,.docx,.rtf,.odt,.txt' },
        { id: 'publications', type: 'file', title: 'Publications', required: false, maxMB: 10,
          accept: '.pdf,.doc,.docx,.rtf,.odt,.txt' },
      ],
    },
    {
      id: 'expertise',
      title: 'Area of Expertise',
      subtitle: 'Select all areas that apply to your experience.',
      icon: 'shield',
      navLabel: 'Expertise',
      questions: [
        {
          id: 'expertise', type: 'checkbox', title: 'Area of expertise', required: true,
          hideTitle: true, layout: 'grid', allowOther: true,
          options: EXPERTISE_DEFAULTS.map(([v, ic]) => ({ value: v, label: v, icon: ic })),
        },
      ],
    },
    {
      id: 'profile',
      title: 'Technical Profile',
      subtitle: 'Your experience at a glance.',
      icon: 'globe',
      navLabel: 'Profile',
      wide: true,
      questions: [
        {
          id: 'experience', type: 'scale', title: 'Years of Relevant Experience', required: true,
          caption: 'years',
          options: [
            { value: '3-5 years', label: '3–5' },
            { value: '5-10 years', label: '5–10' },
            { value: '10-15 years', label: '10–15' },
            { value: '15+ years', label: '15+' },
          ],
        },
        {
          id: 'geography', type: 'country_map', title: 'Geographic Experience', required: true,
          help: "Click countries on the map, or add a whole region at once. Search by name if it's easier — everything you pick appears below the map.",
        },
      ],
    },
    {
      id: 'background',
      title: 'Professional Background',
      subtitle: 'Tell us about your expertise in your own words.',
      icon: 'pen',
      navLabel: 'Background',
      questions: [
        { id: 'languages', type: 'languages', title: 'Languages', required: true,
          help: 'Start typing and pick from the list. Add as many as apply, then set your proficiency for each.' },
        { id: 'summary', type: 'paragraph', title: 'Summary of Expertise and/or Research Experience',
          required: true, minWords: 500, help: 'Minimum 500 words', icon: 'pen' },
        { id: 'assignments', type: 'assignments', title: 'Key Assignments / Achievements', required: true,
          maxItems: 3,
          help: 'Add up to three (3) assignments or achievements from the last 5–7 years that best demonstrate your expertise. The first one is required.' },
      ],
    },
    {
      id: 'availability',
      title: 'Availability',
      subtitle: 'What kinds of assignments can you take on? Select all that apply.',
      icon: 'calendar',
      navLabel: 'Availability',
      questions: [
        {
          id: 'availability', type: 'checkbox', title: 'Availability', required: true, hideTitle: true,
          options: [
            { value: 'Short-term assignments (<3 months)', label: 'Short-term assignments', desc: 'Under 3 months', icon: 'clock' },
            { value: 'Medium-term (3-12 months)', label: 'Medium-term', desc: '3–12 months', icon: 'hourglass' },
            { value: 'Long-term (>12 months)', label: 'Long-term', desc: 'Over 12 months', icon: 'calendar' },
            { value: 'Remote only', label: 'Remote only', icon: 'remote' },
            { value: 'Field-based assignments possible', label: 'Field-based assignments possible', icon: 'pin' },
          ],
        },
      ],
    },
    {
      id: 'rates',
      title: 'Proposed Rate',
      subtitle: 'Please indicate your proposed all-inclusive rates in EUR.',
      icon: 'euro',
      navLabel: 'Rates',
      questions: [
        { id: 'rates', type: 'rate_pair', title: 'Proposed rate', required: true, hideTitle: true },
      ],
    },
    {
      id: 'history',
      title: 'Previous Collaboration',
      subtitle: 'Have you worked with ISTC before?',
      icon: 'history',
      navLabel: 'History',
      questions: [
        {
          id: 'previousWork', type: 'radio', title: 'Previous work with ISTC', required: true,
          hideTitle: true, layout: 'row',
          options: [{ value: 'No', label: 'No' }, { value: 'Yes', label: 'Yes' }],
        },
        { id: 'referenceNumber', type: 'short_text', title: 'Assignment reference number', required: true,
          icon: 'hash', showIf: { question: 'previousWork', equals: 'Yes' } },
      ],
    },
    {
      id: 'declarations',
      title: 'Declarations',
      subtitle: 'Please read and confirm the statements below.',
      icon: 'check',
      navLabel: 'Declarations',
      questions: [
        {
          id: 'conflictAgree', type: 'statement', title: 'Conflict of Interest', required: true,
          body: 'I declare that the information provided is accurate and complete. I agree to inform ISTC of any potential conflicts of interest related to future assignments.',
          consentLabel: 'I agree',
        },
        {
          id: 'dataAgree', type: 'statement', title: 'Data Protection & Disclaimer', required: true,
          body: "Submission of this form constitutes an Expression of Interest for inclusion in the ISTC Consultant Database. Inclusion in the database does not create any entitlement to, or guarantee of, a consultancy contract. Consultant selection shall be conducted in accordance with ISTC's applicable procedures and approval requirements.",
          consentLabel: 'I acknowledge and agree',
        },
      ],
    },
  ],
};

/* ------------------------------------------------------------ Normalization

   Schemas arrive from places we don't control — localStorage that an old
   version wrote, JSON pasted into the admin import box, a hand-edited
   form-schema.js. Everything downstream (render.js, app.js, admin.js)
   assumes a well-formed shape, so this is the single choke point that
   repairs anything repairable and reports what it changed. */

const CHOICE_TYPES = ['radio', 'checkbox', 'dropdown', 'scale'];

/* ids are interpolated into querySelector strings and DOM ids, so they
   must stay strictly [A-Za-z0-9_-]. */
function sanitizeId(raw) {
  return String(raw ?? '').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 64);
}

function ensureUniqueId(base, taken) {
  let id = base || 'q';
  let n = 2;
  while (taken.has(id)) id = `${base}_${n++}`;
  taken.add(id);
  return id;
}

function coerceNumber(value) {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/* Returns { schema, issues } — schema is always safe to render, issues is
   a human-readable list of every repair that was made. */
function normalizeSchema(input) {
  const issues = [];
  const src = input && typeof input === 'object' ? deepClone(input) : null;
  if (!src || !Array.isArray(src.steps) || !src.steps.length) {
    return { schema: deepClone(DEFAULT_SCHEMA), issues: ['Schema was empty or malformed — using the default form.'] };
  }

  const schema = {
    version: coerceNumber(src.version) ?? 1,
    title: typeof src.title === 'string' && src.title.trim() ? src.title : DEFAULT_SCHEMA.title,
    description: typeof src.description === 'string' ? src.description : '',
    steps: [],
  };

  /* Sections and questions are separate namespaces: a section id never
     reaches the DOM, while a question id becomes an element id and a
     showIf target. Sharing one set would rename innocent questions. */
  const takenStepIds = new Set();
  const takenIds = new Set();

  src.steps.forEach((rawStep, si) => {
    if (!rawStep || typeof rawStep !== 'object') {
      issues.push(`Section ${si + 1} was not an object — removed.`);
      return;
    }
    const step = {
      id: ensureUniqueId(sanitizeId(rawStep.id) || `s_${si + 1}`, takenStepIds),
      title: typeof rawStep.title === 'string' && rawStep.title.trim() ? rawStep.title : `Section ${si + 1}`,
      subtitle: typeof rawStep.subtitle === 'string' ? rawStep.subtitle : '',
      icon: typeof rawStep.icon === 'string' ? rawStep.icon : 'layers',
      navLabel: typeof rawStep.navLabel === 'string' && rawStep.navLabel.trim() ? rawStep.navLabel : undefined,
      questions: [],
    };
    if (rawStep.wide) step.wide = true;
    if (!rawStep.title || !String(rawStep.title).trim()) issues.push(`Section ${si + 1} had no title.`);

    const rawQuestions = Array.isArray(rawStep.questions) ? rawStep.questions : [];
    if (!Array.isArray(rawStep.questions)) issues.push(`Section “${step.title}” had no questions array.`);

    rawQuestions.forEach((rawQ, qi) => {
      if (!rawQ || typeof rawQ !== 'object') {
        issues.push(`Question ${qi + 1} in “${step.title}” was not an object — removed.`);
        return;
      }
      const q = { ...rawQ };
      delete q.__open; // admin UI state, never part of the form

      const cleanId = sanitizeId(q.id);
      if (cleanId !== String(q.id ?? '')) issues.push(`Question id “${q.id}” contained unsafe characters — now “${cleanId || '(generated)'}”.`);
      q.id = ensureUniqueId(cleanId || `q_${si + 1}_${qi + 1}`, takenIds);
      if (q.id !== cleanId && cleanId) issues.push(`Duplicate question id “${cleanId}” — renamed to “${q.id}”.`);

      if (typeof q.title !== 'string' || !q.title.trim()) {
        issues.push(`Question “${q.id}” had no title.`);
        q.title = 'Untitled question';
      }
      if (!QUESTION_TYPES[q.type]) {
        issues.push(`Question “${q.title}” had unknown type “${q.type}” — treated as short answer.`);
        q.type = 'short_text';
      }

      if (CHOICE_TYPES.includes(q.type)) {
        const opts = (Array.isArray(q.options) ? q.options : [])
          .map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
          .filter((o) => o && typeof o === 'object' && String(o.value ?? o.label ?? '').trim())
          .map((o) => ({ ...o, value: String(o.value ?? o.label), label: String(o.label ?? o.value) }));
        if (!opts.length) {
          issues.push(`Choice question “${q.title}” had no options — added a placeholder.`);
          opts.push({ value: 'Option 1', label: 'Option 1' });
        }
        q.options = opts;
      } else if ('options' in q && q.type !== 'country_map') {
        delete q.options;
      }

      ['minWords', 'maxMB', 'maxItems', 'min', 'max'].forEach((key) => {
        if (key in q) {
          const n = coerceNumber(q[key]);
          if (n === undefined) { issues.push(`Question “${q.title}”: ${key} was not a number — removed.`); delete q[key]; }
          else q[key] = n;
        }
      });

      q.required = !!q.required;
      step.questions.push(q);
    });

    schema.steps.push(step);
  });

  if (!schema.steps.length) {
    return { schema: deepClone(DEFAULT_SCHEMA), issues: [...issues, 'No usable sections were left — using the default form.'] };
  }

  /* Second pass: showIf may point forward, so it can only be checked once
     every surviving question id is known. A dangling condition would hide
     the question forever — dropping it (always show) is the safe repair. */
  const allIds = new Set(schema.steps.flatMap((s) => s.questions.map((q) => q.id)));
  schema.steps.forEach((s) => s.questions.forEach((q) => {
    if (!q.showIf) return;
    const ok = q.showIf && typeof q.showIf === 'object'
      && typeof q.showIf.question === 'string' && allIds.has(q.showIf.question)
      && q.showIf.question !== q.id && typeof q.showIf.equals === 'string';
    if (!ok) {
      issues.push(`Question “${q.title}”: its “show only if” pointed at a missing question — it is now always shown.`);
      delete q.showIf;
    }
  }));

  return { schema, issues };
}

/* ------------------------------------------------------------ Storage */

/* Precedence: this browser's unpublished edits → the published
   form-schema.js committed to the repo → the built-in default.
   Whatever wins is normalized, so downstream code never sees a
   malformed schema. */
function loadSchema() {
  let candidate = null;
  try {
    const raw = localStorage.getItem(SCHEMA_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.steps) && parsed.steps.length) candidate = parsed;
    }
  } catch (_) { /* fall through */ }

  if (!candidate) {
    const published = typeof window !== 'undefined' ? window.PUBLISHED_SCHEMA : null;
    if (published && Array.isArray(published.steps) && published.steps.length) candidate = published;
  }

  return normalizeSchema(candidate || DEFAULT_SCHEMA).schema;
}

function clearSchemaOverride() {
  try { localStorage.removeItem(SCHEMA_STORAGE_KEY); } catch (_) { /* ignore */ }
}

function saveSchema(schema) {
  localStorage.setItem(SCHEMA_STORAGE_KEY, JSON.stringify(schema));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

/* Timestamp alone is not enough — duplicating twice in the same
   millisecond must still give distinct ids, hence the counter. */
let __uidCounter = 0;
function uid(prefix) {
  __uidCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${__uidCounter.toString(36)}`;
}

function newQuestion(type = 'short_text') {
  const q = {
    id: uid('q'),
    type,
    title: 'Untitled question',
    required: false,
  };
  if (['radio', 'checkbox', 'dropdown', 'scale'].includes(type)) {
    q.options = [{ value: 'Option 1', label: 'Option 1' }];
  }
  if (type === 'statement') {
    q.body = 'Statement text';
    q.consentLabel = 'I agree';
  }
  if (type === 'assignments') q.maxItems = 3;
  if (type === 'file') { q.maxMB = 10; q.accept = '.pdf,.doc,.docx'; }
  return q;
}

function newStep() {
  return {
    id: uid('s'),
    title: 'Untitled section',
    subtitle: '',
    icon: 'layers',
    navLabel: 'Section',
    questions: [newQuestion('short_text')],
  };
}

/* Node (tests) — browsers ignore this block. */
if (typeof module !== 'undefined') {
  module.exports = {
    SCHEMA_STORAGE_KEY, QUESTION_TYPES, DEFAULT_SCHEMA, CHOICE_TYPES,
    normalizeSchema, sanitizeId, ensureUniqueId, coerceNumber,
    loadSchema, saveSchema, clearSchemaOverride, deepClone, uid, newQuestion, newStep,
  };
}
