# ISTC Consultant Database — Expression of Interest

A standalone, Apple-styled replacement for the Google Form used to collect
Expressions of Interest for the ISTC Consultant Database.

**Live site:** hosted on GitHub Pages (static — no build step, no dependencies).

## Structure

| File | Purpose |
| --- | --- |
| `index.html` | Landing page + the multi-step application form (11 steps + review + success) |
| `styles.css` | Design system: two-tone display type, glossy gradient CTAs, navy accent cards, light/dark themes, reduced-motion support |
| `app.js` | Step navigation, validation, smart inputs, file uploads, draft autosave, submission |
| `map.js` | Interactive world map component (showcase tour + country picker) |
| `map-data.js` | **Generated** — 175 country SVG paths, Robinson projection. Rebuild with `scripts/build-map.js`, don't hand-edit |
| `landing.js` | Landing page behaviour: map tour, scroll reveals, header hairline |
| `data.js` | Suggestion lists for autocomplete (countries, nationalities, languages) |
| `apps-script/Code.gs` | Google Apps Script backend that stores submissions in a Google Sheet + Drive |

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
110m admin-0 data (public domain), projected with Robinson and simplified with
Douglas-Peucker to ~85 KB (~25 KB gzipped). To regenerate:

```bash
node scripts/build-map.js
```

Each country carries a UN-subregion-derived region tag, which drives the
region quick-select chips and the regions recorded on submission.

## ⚠️ Connect the backend (required before accepting submissions)

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
