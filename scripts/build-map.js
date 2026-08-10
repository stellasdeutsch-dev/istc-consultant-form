/* Build a compact SVG world map from Natural Earth 110m GeoJSON.
   Robinson projection + Douglas-Peucker simplification. */

const fs = require('fs');

const SRC = process.env.NE_GEOJSON || '/tmp/ne110m.geojson'; // Natural Earth 110m admin-0 GeoJSON
const OUT = require('path').join(__dirname, '..', 'map-data.js');

const WIDTH = 1000;          // output viewBox width
const TOLERANCE = 0.42;      // simplification tolerance, output units
const MIN_RING_AREA = 0.55;  // drop specks smaller than this (output units²)

/* ---------------- Robinson projection ---------------- */

const R_TABLE = [
  [1.0000, 0.0000], [0.9986, 0.0620], [0.9954, 0.1240], [0.9900, 0.1860],
  [0.9822, 0.2480], [0.9730, 0.3100], [0.9600, 0.3720], [0.9427, 0.4340],
  [0.9216, 0.4958], [0.8962, 0.5571], [0.8679, 0.6176], [0.8350, 0.6769],
  [0.7986, 0.7346], [0.7597, 0.7903], [0.7186, 0.8435], [0.6732, 0.8936],
  [0.6213, 0.9394], [0.5722, 0.9761], [0.5322, 1.0000],
];

function robinson(lon, lat) {
  const alat = Math.min(Math.abs(lat), 90);
  const i = Math.min(Math.floor(alat / 5), 17);
  const t = (alat - i * 5) / 5;
  const X = R_TABLE[i][0] + (R_TABLE[i + 1][0] - R_TABLE[i][0]) * t;
  const Y = R_TABLE[i][1] + (R_TABLE[i + 1][1] - R_TABLE[i][1]) * t;
  return {
    x: 0.8487 * X * (lon * Math.PI / 180),
    y: 1.3523 * Y * (lat < 0 ? -1 : 1),
  };
}

/* ---------------- Douglas-Peucker ---------------- */

function perpDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (!len2) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function simplify(points, tol) {
  if (points.length < 3) return points;
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], points[0], points[points.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD > tol) {
    const left = simplify(points.slice(0, idx + 1), tol);
    const right = simplify(points.slice(idx), tol);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

function ringArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return Math.abs(a / 2);
}

/* ---------------- Region mapping (ISTC's own buckets) ---------------- */

const SOUTH_CAUCASUS = new Set(['ARM', 'AZE', 'GEO']);

function regionFor(props) {
  const sub = props.SUBREGION;
  const iso = props.ISO_A3;
  if (SOUTH_CAUCASUS.has(iso)) return 'South Caucasus';
  switch (sub) {
    case 'Central Asia': return 'Central Asia';
    case 'Eastern Europe': return 'Eastern Europe';
    case 'Western Asia': return 'Middle East';
    case 'Northern Africa':
    case 'Western Africa':
    case 'Middle Africa':
    case 'Eastern Africa':
    case 'Southern Africa': return 'Africa';
    case 'South-Eastern Asia': return 'Southeast Asia';
    case 'South America': return 'South America';
    case 'Central America':
    case 'Caribbean': return 'Central America';
    case 'Northern Europe':
    case 'Western Europe':
    case 'Southern Europe': return 'Europe';
    case 'Northern America': return 'North America';
    case 'Eastern Asia': return 'East Asia';
    case 'Southern Asia': return 'South Asia';
    case 'Melanesia':
    case 'Micronesia':
    case 'Polynesia':
    case 'Australia and New Zealand': return 'Oceania';
    default: return 'Other';
  }
}

/* ---------------- Build ---------------- */

const geo = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const SKIP_SUB = new Set(['Antarctica', 'Seven seas (open ocean)']);

// First pass: project everything, find bounds
const projected = [];
let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

for (const f of geo.features) {
  const p = f.properties;
  if (SKIP_SUB.has(p.SUBREGION)) continue;
  if (p.NAME === 'Antarctica') continue;

  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const rings = [];
  for (const poly of polys) {
    for (const ring of poly) {
      const pts = ring.map(([lon, lat]) => {
        const q = robinson(lon, lat);
        if (q.x < minX) minX = q.x;
        if (q.x > maxX) maxX = q.x;
        if (q.y < minY) minY = q.y;
        if (q.y > maxY) maxY = q.y;
        return [q.x, q.y];
      });
      rings.push(pts);
    }
  }

  let id = p.ISO_A3;
  if (!id || id === '-99') id = p.NAME.replace(/[^A-Za-z]/g, '').slice(0, 6).toUpperCase();

  projected.push({ id, name: p.NAME_EN || p.NAME, region: regionFor(p), rings });
}

const scale = WIDTH / (maxX - minX);
const height = Math.round((maxY - minY) * scale);

function toScreen(pt) {
  return [
    (pt[0] - minX) * scale,
    (maxY - pt[1]) * scale, // flip Y
  ];
}

const num = (v) => {
  const r = Math.round(v * 10) / 10;
  return String(r === 0 ? 0 : r);
};

const countries = [];
const seen = new Map();

for (const c of projected) {
  const parts = [];
  for (const ring of c.rings) {
    let pts = ring.map(toScreen);
    pts = simplify(pts, TOLERANCE);
    if (pts.length < 3) continue;
    if (ringArea(pts) < MIN_RING_AREA) continue;
    let d = `M${num(pts[0][0])} ${num(pts[0][1])}`;
    for (let i = 1; i < pts.length; i++) d += `L${num(pts[i][0])} ${num(pts[i][1])}`;
    parts.push(d + 'Z');
  }
  if (!parts.length) continue;

  // Merge duplicate ISO ids (e.g. split territories)
  if (seen.has(c.id)) {
    seen.get(c.id).d += parts.join('');
    continue;
  }
  const entry = { i: c.id, n: c.name, r: c.region, d: parts.join('') };
  seen.set(c.id, entry);
  countries.push(entry);
}

countries.sort((a, b) => a.n.localeCompare(b.n));

const out =
  `/* Auto-generated from Natural Earth 110m (public domain).\n` +
  `   Robinson projection, simplified for the web. Do not hand-edit. */\n\n` +
  `'use strict';\n\n` +
  `const WORLD_MAP = {\n` +
  `  viewBox: '0 0 ${WIDTH} ${height}',\n` +
  `  countries: ${JSON.stringify(countries)}\n` +
  `};\n`;

fs.writeFileSync(OUT, out);

const byRegion = {};
countries.forEach((c) => { byRegion[c.r] = (byRegion[c.r] || 0) + 1; });
console.log('countries:', countries.length);
console.log('viewBox: 0 0', WIDTH, height);
console.log('file KB:', Math.round(out.length / 1024));
console.log('regions:', JSON.stringify(byRegion, null, 0));
