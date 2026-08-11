/* ============================================================
   Schema → DOM. Every question type declares how it renders,
   how its value is read/written, and how it validates. The public
   form and the admin preview both go through here, so what an
   admin sees while editing is what an applicant gets.
   ============================================================ */

'use strict';

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ico = (name, cls) => (typeof icon === 'function' && name ? icon(name, cls) : '');

function questionLabel(q) {
  if (q.hideTitle) return '';
  const req = q.required ? ' <span class="req" aria-hidden="true">*</span>' : '';
  const optional = !q.required ? ' <span class="optional">Optional</span>' : '';
  return `<span class="field-label">${esc(q.title)}${req}${optional}</span>`;
}

function labelFor(q, forId) {
  if (q.hideTitle) return '';
  const req = q.required ? ' <span class="req" aria-hidden="true">*</span>' : '';
  const optional = !q.required ? ' <span class="optional">Optional</span>' : '';
  return `<label class="field-label" for="${esc(forId)}">${esc(q.title)}${req}${optional}</label>`;
}

const helpText = (q) => (q.help ? `<p class="field-hint">${esc(q.help)}</p>` : '');
const errorSlot = (q) => `<p class="field-error" data-error-for="${esc(q.id)}" role="alert" hidden></p>`;

/* ------------------------------------------------------------ choice markup */

function optionCard(q, opt, inputType) {
  const shape = inputType === 'checkbox' ? ' option-check-square' : '';
  const compact = q.layout === 'grid' ? ' option-compact' : '';
  const badge = opt.icon ? `<span class="option-ico">${ico(opt.icon)}</span>` : '';
  const desc = opt.desc ? `<span class="option-desc">${esc(opt.desc)}</span>` : '';
  return `
    <label class="option${compact}">
      <input type="${inputType}" name="${esc(q.id)}" value="${esc(opt.value)}" />
      <span class="option-check${shape}" aria-hidden="true"></span>
      ${badge}
      <span class="option-body">
        <span class="option-title">${esc(opt.label ?? opt.value)}</span>${desc}
      </span>
    </label>`;
}

function choiceGroup(q, inputType) {
  const opts = (q.options || []).slice();
  if (q.allowOther) opts.push({ value: 'Other (specify)', label: 'Other (specify)', icon: 'sparkle' });
  const layout = q.layout === 'grid' ? ' option-grid' : q.layout === 'row' ? ' option-group-row' : '';
  return `
    <div class="option-group${layout}" data-error-anchor="${esc(q.id)}">
      ${opts.map((o) => optionCard(q, o, inputType)).join('')}
    </div>
    ${q.allowOther ? `
    <div class="field other-field" data-other-for="${esc(q.id)}" hidden>
      <label class="field-label" for="${esc(q.id)}__other">Please specify</label>
      <input class="text-input" type="text" id="${esc(q.id)}__other" />
      <p class="field-error" data-error-for="${esc(q.id)}__other" role="alert" hidden></p>
    </div>` : ''}`;
}

/* ------------------------------------------------------------ adapters */

const ADAPTERS = {
  short_text: {
    render(q) {
      const type = q.type === 'email' ? 'email' : q.type === 'phone' ? 'tel' : 'text';
      const ph = q.placeholder ? ` placeholder="${esc(q.placeholder)}"` : '';
      return `
        ${labelFor(q, q.id)}${helpText(q)}
        <div class="input-wrap">
          ${ico(q.icon, 'input-ico')}
          <input class="text-input${q.icon ? ' has-ico' : ''}" type="${type}" id="${esc(q.id)}"
                 name="${esc(q.id)}"${ph} autocomplete="off" />
        </div>
        ${errorSlot(q)}`;
    },
    get: (q) => (document.getElementById(q.id)?.value || '').trim(),
    set: (q, v) => { const el = document.getElementById(q.id); if (el) el.value = v ?? ''; },
    validate(q) {
      const v = this.get(q);
      if (!v) return q.required ? `Please enter ${(q.title || 'this field').toLowerCase()}.` : null;
      if (q.pattern === 'name' && !/\p{L}.*\p{L}/u.test(v)) return q.patternMessage || 'Please enter a valid value.';
      if (q.pattern === 'letters' && !/^\p{L}[\p{L}\s'’.()\-]*$/u.test(v)) return q.patternMessage || 'Please enter a valid value.';
      return null;
    },
  },

  email: {
    render(q) { return ADAPTERS.short_text.render({ ...q, type: 'email' }); },
    get: (q) => ADAPTERS.short_text.get(q),
    set: (q, v) => ADAPTERS.short_text.set(q, v),
    validate(q) {
      const v = ADAPTERS.short_text.get(q);
      if (!v) return q.required ? 'Please enter your email address.' : null;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'That doesn’t look like a valid email address.';
    },
  },

  phone: {
    render(q) { return ADAPTERS.short_text.render({ ...q, type: 'phone' }); },
    get: (q) => ADAPTERS.short_text.get(q),
    set: (q, v) => ADAPTERS.short_text.set(q, v),
    validate(q) {
      const v = ADAPTERS.short_text.get(q);
      if (!v) return q.required ? 'Please enter your phone number.' : null;
      const digits = v.replace(/\D/g, '');
      return digits.length >= 7 && digits.length <= 15
        ? null : 'Please enter a valid phone number, e.g. +7 700 123 4567.';
    },
    init(q) {
      const el = document.getElementById(q.id);
      if (!el) return;
      el.addEventListener('input', () => {
        const cleaned = el.value.replace(/[^\d+()\-\s]/g, '').replace(/(?!^)\+/g, '');
        if (cleaned !== el.value) {
          const pos = el.selectionStart - (el.value.length - cleaned.length);
          el.value = cleaned;
          el.setSelectionRange(Math.max(0, pos), Math.max(0, pos));
        }
      });
    },
  },

  paragraph: {
    render(q) {
      return `
        ${labelFor(q, q.id)}${helpText(q)}
        <textarea class="text-input textarea" id="${esc(q.id)}" name="${esc(q.id)}" rows="10"></textarea>
        ${q.minWords ? `<div class="word-counter" data-counter-for="${esc(q.id)}" aria-live="polite">0 / ${q.minWords} words</div>` : ''}
        ${errorSlot(q)}`;
    },
    get: (q) => (document.getElementById(q.id)?.value || '').trim(),
    set: (q, v) => { const el = document.getElementById(q.id); if (el) el.value = v ?? ''; },
    validate(q) {
      const v = this.get(q);
      if (!v) return q.required ? `Please complete “${q.title}”.` : null;
      if (q.minWords) {
        const words = v.split(/\s+/).filter(Boolean).length;
        if (words < q.minWords) return `Please write at least ${q.minWords} words (currently ${words}).`;
      }
      return null;
    },
    init(q) {
      if (!q.minWords) return;
      const el = document.getElementById(q.id);
      const counter = document.querySelector(`[data-counter-for="${q.id}"]`);
      if (!el || !counter) return;
      const update = () => {
        const words = el.value.trim().split(/\s+/).filter(Boolean).length;
        counter.textContent = `${words} / ${q.minWords} words`;
        counter.classList.toggle('ok', words >= q.minWords);
      };
      el.addEventListener('input', update);
      update();
    },
  },

  radio: {
    render(q) { return `${questionLabel(q)}${helpText(q)}${choiceGroup(q, 'radio')}${errorSlot(q)}`; },
    get: (q) => {
      const el = document.querySelector(`input[name="${q.id}"]:checked`);
      const other = document.getElementById(`${q.id}__other`);
      const v = el ? el.value : '';
      return v === 'Other (specify)' && other?.value ? other.value.trim() : v;
    },
    set: (q, v) => {
      if (!v) return;
      const inputs = [...document.querySelectorAll(`input[name="${q.id}"]`)];
      const el = inputs.find((i) => i.value === v);
      if (el) { el.checked = true; return; }
      // Drafts store the resolved "Other" text, not the sentinel value —
      // without this branch a custom answer would vanish on restore.
      const other = document.getElementById(`${q.id}__other`);
      const otherInput = inputs.find((i) => i.value === 'Other (specify)');
      if (q.allowOther && other && otherInput) {
        otherInput.checked = true;
        other.value = v;
        const box = document.querySelector(`[data-other-for="${q.id}"]`);
        if (box) box.hidden = false;
      }
    },
    validate(q) {
      const chosen = document.querySelector(`input[name="${q.id}"]:checked`);
      if (!chosen) return q.required ? 'Please choose an option.' : null;
      if (chosen.value === 'Other (specify)' && !document.getElementById(`${q.id}__other`)?.value.trim()) {
        return 'Please specify your answer.';
      }
      return null;
    },
  },

  checkbox: {
    render(q) { return `${questionLabel(q)}${helpText(q)}${choiceGroup(q, 'checkbox')}${errorSlot(q)}`; },
    get: (q) => {
      const vals = [...document.querySelectorAll(`input[name="${q.id}"]:checked`)].map((i) => i.value);
      const other = document.getElementById(`${q.id}__other`);
      return vals.map((v) => (v === 'Other (specify)' && other?.value ? other.value.trim() : v));
    },
    set: (q, list) => {
      const inputs = [...document.querySelectorAll(`input[name="${q.id}"]`)];
      const unmatched = [];
      (list || []).forEach((v) => {
        const el = inputs.find((i) => i.value === v);
        if (el) el.checked = true;
        else if (v) unmatched.push(v);
      });
      // A resolved "Other" answer won't match any box — restore it explicitly.
      const other = document.getElementById(`${q.id}__other`);
      const otherInput = inputs.find((i) => i.value === 'Other (specify)');
      if (q.allowOther && unmatched.length && other && otherInput) {
        otherInput.checked = true;
        other.value = unmatched[0];
        const box = document.querySelector(`[data-other-for="${q.id}"]`);
        if (box) box.hidden = false;
      }
    },
    validate(q) {
      const checked = document.querySelectorAll(`input[name="${q.id}"]:checked`);
      if (!checked.length) return q.required ? 'Please select at least one option.' : null;
      const hasOther = [...checked].some((i) => i.value === 'Other (specify)');
      if (hasOther && !document.getElementById(`${q.id}__other`)?.value.trim()) {
        return 'Please specify your other answer.';
      }
      return null;
    },
  },

  dropdown: {
    render(q) {
      return `
        ${labelFor(q, q.id)}${helpText(q)}
        <select class="text-input" id="${esc(q.id)}" name="${esc(q.id)}" data-error-anchor="${esc(q.id)}">
          <option value="">Choose…</option>
          ${(q.options || []).map((o) => `<option value="${esc(o.value)}">${esc(o.label ?? o.value)}</option>`).join('')}
        </select>
        ${errorSlot(q)}`;
    },
    get: (q) => document.getElementById(q.id)?.value || '',
    set: (q, v) => { const el = document.getElementById(q.id); if (el) el.value = v ?? ''; },
    validate: (q) => (q.required && !document.getElementById(q.id)?.value ? 'Please choose an option.' : null),
  },

  scale: {
    render(q) {
      return `
        ${questionLabel(q)}${helpText(q)}
        <div class="segmented" data-error-anchor="${esc(q.id)}" role="radiogroup" aria-label="${esc(q.title)}">
          ${(q.options || []).map((o) => `
            <label class="segment">
              <input type="radio" name="${esc(q.id)}" value="${esc(o.value)}" />
              <span>${esc(o.label ?? o.value)}</span>
            </label>`).join('')}
        </div>
        ${q.caption ? `<p class="segmented-caption">${esc(q.caption)}</p>` : ''}
        ${errorSlot(q)}`;
    },
    get: (q) => document.querySelector(`input[name="${q.id}"]:checked`)?.value || '',
    set: (q, v) => ADAPTERS.radio.set(q, v),
    validate: (q) => (q.required && !document.querySelector(`input[name="${q.id}"]:checked`)
      ? 'Please select an option.' : null),
  },

  number: {
    render(q) {
      return `
        ${labelFor(q, q.id)}${helpText(q)}
        <div class="rate-input">
          ${q.prefix ? `<span class="rate-prefix" aria-hidden="true">${esc(q.prefix)}</span>` : ''}
          <input class="text-input" type="number" id="${esc(q.id)}" name="${esc(q.id)}"
                 ${q.min != null ? `min="${esc(q.min)}"` : ''} ${q.max != null ? `max="${esc(q.max)}"` : ''} inputmode="numeric" placeholder="0" />
          ${q.suffix ? `<span class="rate-suffix" aria-hidden="true">${esc(q.suffix)}</span>` : ''}
        </div>
        ${errorSlot(q)}`;
    },
    get: (q) => document.getElementById(q.id)?.value || '',
    set: (q, v) => { const el = document.getElementById(q.id); if (el) el.value = v ?? ''; },
    validate(q) {
      const v = this.get(q);
      if (!v) return q.required ? `Please enter ${(q.title || 'this field').toLowerCase()}.` : null;
      if (q.min != null && Number(v) < Number(q.min)) return `Must be at least ${q.min}.`;
      if (q.max != null && Number(v) > Number(q.max)) return `Must be at most ${q.max}.`;
      return null;
    },
  },

  date_month: {
    render(q) {
      return `${labelFor(q, q.id)}${helpText(q)}
        <div class="input-wrap">${ico('calendar', 'input-ico')}
          <input class="text-input has-ico" type="month" id="${esc(q.id)}" name="${esc(q.id)}" />
        </div>${errorSlot(q)}`;
    },
    get: (q) => document.getElementById(q.id)?.value || '',
    set: (q, v) => { const el = document.getElementById(q.id); if (el) el.value = v ?? ''; },
    validate: (q) => (q.required && !document.getElementById(q.id)?.value ? 'Please choose a month.' : null),
  },

  statement: {
    render(q) {
      return `
        <div class="declaration">
          <h3 class="declaration-title">${esc(q.title)}</h3>
          <p class="declaration-text">${esc(q.body || '')}</p>
          <label class="option option-agree" data-error-anchor="${esc(q.id)}">
            <input type="checkbox" name="${esc(q.id)}" value="${esc(q.consentLabel || 'I agree')}" />
            <span class="option-check option-check-square" aria-hidden="true"></span>
            <span class="option-body"><span class="option-title">${esc(q.consentLabel || 'I agree')}</span></span>
          </label>
          ${errorSlot(q)}
        </div>`;
    },
    get: (q) => (document.querySelector(`input[name="${q.id}"]`)?.checked ? (q.consentLabel || 'I agree') : ''),
    set: (q, v) => { const el = document.querySelector(`input[name="${q.id}"]`); if (el && v) el.checked = true; },
    validate: (q) => (q.required && !document.querySelector(`input[name="${q.id}"]`)?.checked
      ? 'You must agree to continue.' : null),
  },

  file: {
    render(q) {
      const req = q.required ? ' <span class="req" aria-hidden="true">*</span>' : ' <span class="optional">Optional</span>';
      return `
        <span class="field-label" id="${esc(q.id)}__label">${esc(q.title)}${req}</span>
        ${helpText(q)}
        <div class="dropzone" data-file-key="${esc(q.id)}" tabindex="0" role="button" aria-labelledby="${esc(q.id)}__label">
          <input type="file" accept="${esc(q.accept || '')}" hidden />
          <div class="dropzone-empty">
            ${ico('upload', 'dropzone-icon')}
            <span class="dropzone-text"><strong>Choose a file</strong> or drag it here</span>
            <span class="dropzone-hint">Max ${esc(q.maxMB || 10)} MB</span>
          </div>
          <div class="file-chip" hidden>
            ${ico('doc', 'file-chip-icon')}
            <span class="file-chip-info">
              <span class="file-chip-name"></span><span class="file-chip-size"></span>
            </span>
            <button type="button" class="file-chip-remove" aria-label="Remove file">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </div>
        </div>
        ${errorSlot(q)}`;
    },
    get: () => null, // files live outside the serialisable answer set
    set: () => {},
    validate: (q) => (q.required && !window.__formFiles?.[q.id]
      ? `Please upload ${(q.title || 'this file').toLowerCase()}.` : null),
  },

  country_map: {
    render(q) {
      return `
        ${questionLabel(q)}${helpText(q)}
        <div class="picker" data-error-anchor="${esc(q.id)}">
          <div class="picker-toolbar">
            <div class="picker-search combo-anchor">
              <input type="text" id="${esc(q.id)}__search" data-helper-input placeholder="Search for a country…" autocomplete="off" aria-label="Search for a country to add" />
            </div>
            <button type="button" class="picker-clear" data-clear-for="${esc(q.id)}" hidden>Clear all</button>
          </div>
          <div class="region-chips" data-regions-for="${esc(q.id)}"></div>
          <div class="map-stage map-stage-picker" data-map-for="${esc(q.id)}"></div>
          <div class="picker-footer">
            <span class="picker-count" data-count-for="${esc(q.id)}" aria-live="polite">No countries selected yet</span>
          </div>
          <div class="country-chips" data-chips-for="${esc(q.id)}"></div>
        </div>
        ${errorSlot(q)}`;
    },
    get: (q) => window.__countryPickers?.[q.id]?.getSelection() || { ids: [], names: [], regions: [] },
    set: (q, v) => {
      const p = window.__countryPickers?.[q.id];
      if (!p || !v?.ids) return;
      p.setSelection(v.ids);
      if (p.refreshUi) p.refreshUi(); // chips, counter and region buttons
    },
    validate: (q) => (q.required && !(window.__countryPickers?.[q.id]?.size())
      ? 'Please select at least one country — click the map, or add a whole region.' : null),
  },

  languages: {
    render(q) {
      return `
        ${labelFor(q, `${q.id}__input`)}${helpText(q)}
        <div class="text-input chip-field has-ico" data-error-anchor="${esc(q.id)}" data-lang-for="${esc(q.id)}">
          ${ico('translate', 'input-ico input-ico-static')}
          <span data-lang-chips="${esc(q.id)}"></span>
          <input type="text" id="${esc(q.id)}__input" data-helper-input placeholder="Type a language…" autocomplete="off" />
        </div>
        ${errorSlot(q)}`;
    },
    get: (q) => (window.__languageSets?.[q.id] || []).slice(),
    set: (q, list) => { if (window.__setLanguages) window.__setLanguages(q.id, list || []); },
    validate: (q) => (q.required && !(window.__languageSets?.[q.id] || []).length
      ? 'Please add at least one language.' : null),
  },

  assignments: {
    render(q) {
      return `
        ${questionLabel(q)}${helpText(q)}
        <div data-assignments-for="${esc(q.id)}" data-error-anchor="${esc(q.id)}"></div>
        <button type="button" class="btn-add" data-add-assignment="${esc(q.id)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
          Add another assignment
        </button>
        ${errorSlot(q)}`;
    },
    get: (q) => (window.__assignmentSets?.[q.id] || []).slice(),
    set: (q, list) => { if (window.__setAssignments) window.__setAssignments(q.id, list || []); },
    validate(q) {
      if (!q.required) return null;
      const first = (window.__assignmentSets?.[q.id] || [])[0];
      if (!first || !first.title?.trim() || !first.description?.trim()) {
        return 'Assignment 1 needs at least a project title and a short description.';
      }
      return null;
    },
  },

  rate_pair: {
    render(q) {
      return `
        ${questionLabel(q)}${helpText(q)}
        <div class="field-row">
          <div class="field">
            <label class="field-label" for="${esc(q.id)}__daily">${ico('clock', 'label-ico')}Daily rate <span class="req" aria-hidden="true">*</span></label>
            <div class="rate-input">
              <span class="rate-prefix" aria-hidden="true">€</span>
              <input class="text-input" type="number" id="${esc(q.id)}__daily" min="0" step="10" inputmode="numeric" placeholder="0" />
              <span class="rate-suffix" aria-hidden="true">/ day</span>
            </div>
            <p class="field-error" data-error-for="${esc(q.id)}__daily" role="alert" hidden></p>
          </div>
          <div class="field">
            <label class="field-label" for="${esc(q.id)}__hourly">${ico('hourglass', 'label-ico')}Hourly rate <span class="req" aria-hidden="true">*</span></label>
            <div class="rate-input">
              <span class="rate-prefix" aria-hidden="true">€</span>
              <input class="text-input" type="number" id="${esc(q.id)}__hourly" min="0" step="5" inputmode="numeric" placeholder="0" />
              <span class="rate-suffix" aria-hidden="true">/ hour</span>
            </div>
            <p class="field-error" data-error-for="${esc(q.id)}__hourly" role="alert" hidden></p>
          </div>
        </div>
        <p class="field-hint rate-hint" data-rate-hint="${esc(q.id)}" hidden></p>
        ${errorSlot(q)}`;
    },
    get: (q) => ({
      daily: document.getElementById(`${q.id}__daily`)?.value || '',
      hourly: document.getElementById(`${q.id}__hourly`)?.value || '',
    }),
    set: (q, v) => {
      const d = document.getElementById(`${q.id}__daily`);
      const h = document.getElementById(`${q.id}__hourly`);
      if (d) d.value = v?.daily ?? '';
      if (h) h.value = v?.hourly ?? '';
    },
    validate(q) {
      const { daily, hourly } = this.get(q);
      // Optional and untouched → fine; but a half-filled pair is never fine.
      if (!q.required && !daily && !hourly) return null;
      if (!daily || Number(daily) <= 0) return 'Please enter your daily rate.';
      if (!hourly || Number(hourly) <= 0) return 'Please enter your hourly rate.';
      return null;
    },
  },
};

/* ------------------------------------------------------------ step rendering */

function renderQuestion(q) {
  const adapter = ADAPTERS[q.type] || ADAPTERS.short_text;
  const half = q.half ? ' q-half' : '';
  return `<div class="field${half}" data-question="${esc(q.id)}" data-type="${esc(q.type)}">${adapter.render(q)}</div>`;
}

function renderStep(step, index) {
  const questions = step.questions.map(renderQuestion).join('');
  return `
    <section class="step" data-step="${index + 1}" hidden>
      <div class="step-card${step.wide ? ' step-card-wide' : ''}">
        <span class="step-ico">${ico(step.icon || 'layers')}</span>
        <h2 class="step-title" tabindex="-1">${esc(step.title)}</h2>
        ${step.subtitle ? `<p class="step-subtitle">${esc(step.subtitle)}</p>` : ''}
        <div class="step-questions">${questions}</div>
      </div>
    </section>`;
}

/* Review step is appended after the schema steps. */
function renderReviewStep(index) {
  return `
    <section class="step" data-step="${index + 1}" hidden>
      <div class="step-card">
        <span class="step-ico">${ico('layers')}</span>
        <h2 class="step-title" tabindex="-1">Review &amp; Submit</h2>
        <p class="step-subtitle">Please check your answers before submitting.</p>
        <div id="reviewContent"></div>
        <p class="field-error" id="submitError" role="alert" hidden></p>
      </div>
    </section>`;
}

function renderForm(schema, container) {
  container.innerHTML =
    schema.steps.map(renderStep).join('') +
    renderReviewStep(schema.steps.length) +
    `<div class="step-nav" id="stepNav" hidden>
       <button type="button" class="btn btn-ghost" id="backBtn">Back</button>
       <button type="button" class="btn btn-glow" id="nextBtn">Continue</button>
     </div>`;
}
