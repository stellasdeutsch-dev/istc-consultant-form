# ISTC Consultant Database — Expression of Interest

A standalone, Apple-styled replacement for the Google Form used to collect
Expressions of Interest for the ISTC Consultant Database.

**Live site:** hosted on GitHub Pages (static — no build step, no dependencies).

## Structure

| File | Purpose |
| --- | --- |
| `admin.html` | **Form editor** — add/edit/reorder questions and sections, no code needed |
| `admin.js` / `admin.css` | The editor's logic and chrome |
| `schema.js` | Question types + the built-in default form definition |
| `form-schema.js` | The **published** form. Replace it with the file from *Publish…* to change the live form |
| `render.js` | Turns the schema into the form's DOM; owns each question type's rendering, value and validation |
| `index.html` | Landing page + the application shell (steps are rendered from the schema) |
| `styles.css` | Design system: two-tone display type, glossy gradient CTAs, navy accent cards, light/dark themes, reduced-motion support |
| `app.js` | Step navigation, validation, smart inputs, file uploads, draft autosave, submission |
| `map.js` | Interactive world map component (showcase tour + country picker) |
| `map-data.js` | **Generated** — 175 country SVG paths, Robinson projection. Rebuild with `scripts/build-map.js`, don't hand-edit |
| `landing.js` | Landing page behaviour: map tour, scroll reveals, header hairline |
| `data.js` | Suggestion lists for autocomplete (countries, nationalities, languages) |
| `apps-script/Code.gs` | Google Apps Script backend that stores submissions in a Google Sheet + Drive |

## Editing the questions (admin panel)

Open **`admin.html`** — a Google-Forms-style editor. You can:

- add, rename, duplicate, delete and drag-reorder **sections** and **questions**;
- switch a question's **type** (short answer, paragraph, multiple choice,
  checkboxes, dropdown, linear scale, email, phone, number, month, file upload,
  statement + consent, plus the custom widgets: country map, languages,
  repeatable assignments, paired rates);
- edit **options** (label, description, icon) for choice questions, and enable
  an "Other" box;
- toggle **Required**, add help text, set half-width layout, hide a title;
- set per-type **validation** — minimum words, file size and accepted types,
  autocomplete source, text rules, min/max for numbers;
- make a question **conditional** ("show only if … equals …");
- **Preview** a section exactly as applicants will see it.

**Saving is not publishing.** Edits go to the editor's own browser storage as
you type. Press **Publish…**, then commit the downloaded `form-schema.js` over
the existing one — that is what changes the form for everyone. **Reset**
discards local edits and shows the published version again.

> `admin.html` is not a security boundary: a static site cannot keep anyone out
> of a page, and no browser-side password would be real. It only changes what
> the form *asks* — it cannot read submissions. Keep the URL internal and treat
> repository write access as the real gate on what goes live.

The Apps Script backend derives its spreadsheet columns from each submission,
so questions added in the editor appear as new columns automatically.

## Deploying

Push to `main` and GitHub Pages rebuilds within a minute or two.

**Bump the cache token when you change any CSS or JS.** Asset URLs in
`index.html` carry a `?v=` query string (e.g. `styles.css?v=2026-08-10a`).
GitHub Pages caches assets for ~10 minutes, so without a new token some
visitors would run new HTML against stale CSS/JS. Change every `?v=` to the
same new value in one edit.

## The country map

Geographic experience is captured with an interactive world map instead of a
checkbox list. Applicants can click any country, add a whole region in one tap,
or search by name — selections appear as removable chips under the map.

`map-data.js` is generated from [Natural Earth](https://www.naturalearthdata.com/)
admin-0 data (public domain), projected with Robinson and simplified with
Douglas-Peucker to ~119 KB (~44 KB gzipped).

**Boundaries.** The build uses Natural Earth's **Ukraine point-of-view**
edition (`ne_10m_admin_0_countries_ukr`). Natural Earth's default file draws
*de facto* control, which places Crimea inside Russia; the point-of-view
edition shows Crimea as Ukrainian territory, consistent with UN General
Assembly Resolution 68/262. Point-of-view editions are only published at the
10m scale, which is why the source is 10m rather than 110m — the extra detail
costs nothing in output, since `TOLERANCE` governs the final vertex density.

To regenerate:

```bash
curl -sLo /tmp/ne10m_ukr.geojson https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_ukr.geojson
```

```bash
node scripts/build-map.js
```

Each country carries a UN-subregion-derived region tag, which drives the
region quick-select chips and the regions recorded on submission.

## Excel and PDF from the answers

`export.js` builds both in the browser, with no libraries:

- **Excel** — a real `.xlsx` (minimal OOXML inside a store-only ZIP). Verified
  against `unzip` and `openpyxl`; Cyrillic, newlines and characters like `<`
  and `&` all round-trip intact. Every cell is written as an inline string so
  Excel never reinterprets a phone number or a leading zero.
- **PDF** — the answers are laid out as a print-ready HTML document and sent
  through the browser's own print pipeline (*Save as PDF*). Going through the
  browser rather than hand-writing a PDF is deliberate: the standard PDF fonts
  cover Latin-1 only, so a hand-rolled writer would mangle Cyrillic.

Applicants get both as buttons on the review page and again after submitting.
Each submission also carries a ready-made workbook and the printable HTML, so
the receiving flow can file them without regenerating anything.

## ⚠️ Connect the backend (required before accepting submissions)

Two options, same payload — set `CONFIG.SUBMIT_URL` in [`app.js`](app.js) to
whichever you deploy:

- **OneDrive / Excel / PDF** → [`power-automate/README.md`](power-automate/README.md)
- **Google Sheets / Drive** → the Apps Script below

A static site cannot write to OneDrive by itself: Microsoft Graph needs an
authenticated caller and no secret can live in public JavaScript. A Power
Automate flow with an HTTP trigger is the supported route — ISTC owns the flow
and its OneDrive credentials, and the form only knows a URL.

GitHub Pages only serves static files — it cannot store submissions. The included
Google Apps Script backend writes each application to a Google Sheet and saves
uploaded files (CV, certifications, publications) to Google Drive.

1. Create a new **Google Sheet** (it will hold the responses).
2. In the Sheet: **Extensions → Apps Script**, delete the sample code, and paste
   the full contents of [`apps-script/Code.gs`](apps-script/Code.gs).
3. **Deploy → New deployment → Web app**, with:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
4. Authorize the script, then copy the **Web app URL**
   (`https://script.google.com/macros/s/…/exec`).
5. In [`app.js`](app.js), set:
   ```js
   const CONFIG = {
     SUBMIT_URL: 'https://script.google.com/macros/s/…/exec',
     ...
   };
   ```
6. Commit and push — done. New submissions appear as rows in the Sheet, with
   links to the uploaded files in Drive.

Until `SUBMIT_URL` is set, the form validates fully but shows a "submissions
are not open yet" message on the final submit.

## Features

- **11 steps** mirroring the original Google Form: application type, general
  information, documents, expertise, technical profile, background,
  availability, rates, previous collaboration, declarations, and a review page.
- **Branching**: firm/organization applicants get an Organization Name field;
  "Other" options reveal text fields; "Yes" to previous ISTC work reveals the
  reference-number field.
- **Smart inputs**: autocomplete pickers for nationality and country of
  residence; a token-based Languages field (type-ahead suggestions, per-language
  proficiency: Basic / Working / Fluent / Native); structured Key Assignments
  builder (up to 3 cards with title, client, country, duration, role,
  description); a live daily→hourly rate equivalence hint.
- **Light theme by default** with a dark-mode toggle in the header (persisted).
- **File uploads** with drag & drop, 10 MB limit (CV required; certifications
  and publications optional).
- **500-word minimum** live word counter on the expertise summary.
- **Draft autosave** — text answers persist in `localStorage`, so applicants
  can safely leave and come back (files must be re-attached).
- **Review before submit** with per-section Edit buttons.
- **Accessible**: keyboard operable, focus management between steps, inline
  validation with `role="alert"`, respects `prefers-reduced-motion`,
  `prefers-reduced-transparency`, `prefers-contrast`, and dark mode.

## Local preview

Any static server works:

```bash
python3 -m http.server 4173
```

then open <http://localhost:4173>.

## Customizing

- **Questions/options** — expertise and region lists live at the top of
  `app.js` (`EXPERTISE_OPTIONS`, `GEOGRAPHY_OPTIONS`); everything else is
  plain HTML in `index.html`.
- **Word minimum / file size** — `CONFIG.MIN_SUMMARY_WORDS`,
  `CONFIG.MAX_FILE_BYTES` in `app.js`.
- **Colors** — CSS custom properties at the top of `styles.css`.
