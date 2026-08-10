/* ============================================================
   Interactive world map.

   Two modes:
   · showcase — landing hero. Auto-tours ISTC regions, hover to
     inspect a country. Not selectable.
   · picker   — form step. Click countries to toggle, quick-select
     whole regions, search by name. The map is a visual layer over
     an accessible search + chip list, never the only way in.
   ============================================================ */

'use strict';

const ISTC_REGIONS = [
  'Central Asia',
  'Eastern Europe',
  'South Caucasus',
  'Middle East',
  'Africa',
  'Southeast Asia',
  'South America',
  'Central America',
  'Europe',
  'North America',
  'East Asia',
  'South Asia',
  'Oceania',
];

const COUNTRY_BY_ID = new Map(WORLD_MAP.countries.map((c) => [c.i, c]));

function countriesInRegion(region) {
  return WORLD_MAP.countries.filter((c) => c.r === region);
}

function createWorldMap(container, options = {}) {
  const { mode = 'picker', onChange } = options;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', WORLD_MAP.viewBox);
  svg.setAttribute('class', 'world-map');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const paths = new Map();
  const frag = document.createDocumentFragment();

  for (const c of WORLD_MAP.countries) {
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', c.d);
    path.setAttribute('class', 'country');
    path.dataset.id = c.i;
    path.dataset.region = c.r;
    paths.set(c.i, path);
    frag.appendChild(path);
  }
  svg.appendChild(frag);
  container.appendChild(svg);

  const tooltip = document.createElement('div');
  tooltip.className = 'map-tip';
  tooltip.hidden = true;
  container.appendChild(tooltip);

  const selected = new Set();

  /* ------------------------------------------------ painting */

  function paint() {
    for (const [id, path] of paths) {
      path.classList.toggle('is-on', selected.has(id));
    }
  }

  function emit() {
    if (onChange) onChange(getSelection());
  }

  function getSelection() {
    const ids = [...selected];
    const regions = [...new Set(ids.map((id) => COUNTRY_BY_ID.get(id).r))];
    return {
      ids,
      names: ids.map((id) => COUNTRY_BY_ID.get(id).n).sort((a, b) => a.localeCompare(b)),
      regions: regions.sort(),
    };
  }

  /* ------------------------------------------------ tooltip */

  function showTip(text, evt) {
    tooltip.textContent = text;
    tooltip.hidden = false;
    const rect = container.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const y = evt.clientY - rect.top;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  svg.addEventListener('pointermove', (e) => {
    const path = e.target.closest('.country');
    if (!path) { tooltip.hidden = true; return; }
    const c = COUNTRY_BY_ID.get(path.dataset.id);
    showTip(mode === 'picker' && selected.has(c.i) ? `${c.n} · selected` : c.n, e);
  });

  svg.addEventListener('pointerleave', () => { tooltip.hidden = true; });

  /* ------------------------------------------------ picker interaction */

  if (mode === 'picker') {
    svg.classList.add('is-picker');
    svg.removeAttribute('aria-hidden');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'World map. Use the search field or region buttons to choose countries.');

    svg.addEventListener('click', (e) => {
      const path = e.target.closest('.country');
      if (!path) return;
      toggle(path.dataset.id);
    });
  }

  /* ------------------------------------------------ showcase tour */

  let tourTimer = null;

  function startTour() {
    if (mode !== 'showcase' || reduceMotion.matches) {
      // Static fallback: light up every ISTC operating region at once
      ISTC_REGIONS.slice(0, 8).forEach((r) =>
        countriesInRegion(r).forEach((c) => selected.add(c.i))
      );
      paint();
      return;
    }
    const tour = ['Central Asia', 'South Caucasus', 'Eastern Europe', 'Middle East',
                  'Africa', 'Southeast Asia', 'South America', 'Central America'];
    let step = 0;
    const advance = () => {
      const region = tour[step % tour.length];
      selected.clear();
      countriesInRegion(region).forEach((c) => selected.add(c.i));
      paint();
      if (options.onTour) options.onTour(region, countriesInRegion(region).length);
      step++;
      tourTimer = setTimeout(advance, 2600);
    };
    advance();
  }

  function stopTour() {
    if (tourTimer) { clearTimeout(tourTimer); tourTimer = null; }
  }

  /* ------------------------------------------------ public API */

  function toggle(id) {
    if (!COUNTRY_BY_ID.has(id)) return;
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    paint();
    emit();
  }

  function add(ids) {
    ids.forEach((id) => { if (COUNTRY_BY_ID.has(id)) selected.add(id); });
    paint();
    emit();
  }

  function remove(ids) {
    ids.forEach((id) => selected.delete(id));
    paint();
    emit();
  }

  function toggleRegion(region) {
    const list = countriesInRegion(region);
    const allOn = list.every((c) => selected.has(c.i));
    if (allOn) list.forEach((c) => selected.delete(c.i));
    else list.forEach((c) => selected.add(c.i));
    paint();
    emit();
  }

  function clear() {
    selected.clear();
    paint();
    emit();
  }

  function setSelection(ids) {
    selected.clear();
    ids.forEach((id) => { if (COUNTRY_BY_ID.has(id)) selected.add(id); });
    paint();
  }

  function flash(id) {
    const path = paths.get(id);
    if (!path || reduceMotion.matches) return;
    path.classList.remove('flash');
    void path.getBoundingClientRect();
    path.classList.add('flash');
    setTimeout(() => path.classList.remove('flash'), 900);
  }

  return {
    svg,
    toggle, add, remove, toggleRegion, clear, setSelection, flash,
    getSelection,
    startTour, stopTour,
    has: (id) => selected.has(id),
    size: () => selected.size,
  };
}
