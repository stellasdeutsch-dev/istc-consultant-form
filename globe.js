/* ============================================================
   Landing page visuals
   1. Interactive dot-globe with animated collaboration arcs.
      Drag to spin — 1:1 tracking, velocity handoff on release,
      momentum decay (Apple's projection model), auto-idle spin.
   2. Scroll reveal + animated stat counters.
   ============================================================ */

'use strict';

(function landingVisuals() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------- Globe */

  const canvas = document.getElementById('globeCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Points of presence — roughly the regions ISTC works across.
  const HUBS = [
    { lat: 48.0, lon: 66.9, name: 'Central Asia' },
    { lat: 41.7, lon: 44.8, name: 'South Caucasus' },
    { lat: 50.4, lon: 30.5, name: 'Eastern Europe' },
    { lat: 48.2, lon: 16.4, name: 'Vienna' },
    { lat: 31.8, lon: 35.2, name: 'Middle East' },
    { lat: 9.1, lon: 7.4, name: 'Africa' },
    { lat: -1.3, lon: 36.8, name: 'East Africa' },
    { lat: 13.8, lon: 100.5, name: 'Southeast Asia' },
    { lat: 35.7, lon: 139.7, name: 'East Asia' },
    { lat: -15.8, lon: -47.9, name: 'South America' },
    { lat: 19.4, lon: -99.1, name: 'Central America' },
    { lat: 38.9, lon: -77.0, name: 'North America' },
    { lat: 55.8, lon: 37.6, name: 'Northern Eurasia' },
    { lat: 28.6, lon: 77.2, name: 'South Asia' },
  ];

  // Arcs connect Vienna (index 3) outward, plus a few cross links.
  const ARC_PAIRS = [
    [3, 0], [3, 1], [3, 4], [3, 5], [3, 7], [3, 9], [3, 11],
    [0, 13], [7, 8], [5, 6], [11, 10], [2, 12],
  ];

  const DOT_ROWS = 34; // latitude bands of the dotted sphere

  const sphereDots = [];
  for (let i = 0; i < DOT_ROWS; i++) {
    const lat = -90 + (180 * (i + 0.5)) / DOT_ROWS;
    const circumference = Math.cos((lat * Math.PI) / 180);
    const count = Math.max(1, Math.round(DOT_ROWS * 2.2 * circumference));
    for (let j = 0; j < count; j++) {
      sphereDots.push({ lat, lon: -180 + (360 * j) / count });
    }
  }

  const state = {
    rotation: -0.4,
    tilt: 0.16, // positive tips the northern hemisphere toward the viewer
    velocity: 0.0016, // idle drift, radians per frame
    dragging: false,
    lastX: 0,
    lastY: 0,
    history: [],
    width: 0,
    height: 0,
    radius: 0,
    dpr: 1,
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = rect.width;
    state.height = rect.height;
    state.radius = Math.min(rect.width, rect.height) * 0.42;
    canvas.width = Math.round(rect.width * state.dpr);
    canvas.height = Math.round(rect.height * state.dpr);
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  }

  // Project a lat/lon onto the rotated sphere. Returns screen x/y plus
  // z-depth (>0 = front hemisphere) for occlusion and fading.
  function project(lat, lon) {
    const phi = (lat * Math.PI) / 180;
    const theta = (lon * Math.PI) / 180 + state.rotation;
    const cosPhi = Math.cos(phi);

    let x = cosPhi * Math.sin(theta);
    let y = Math.sin(phi);
    let z = cosPhi * Math.cos(theta);

    // Tilt around the X axis so the north pole leans toward the viewer
    const cosT = Math.cos(state.tilt);
    const sinT = Math.sin(state.tilt);
    const y2 = y * cosT - z * sinT;
    const z2 = y * sinT + z * cosT;

    return {
      x: state.width / 2 + x * state.radius,
      y: state.height / 2 - y2 * state.radius,
      z: z2,
    };
  }

  function themeColors() {
    const dark = document.documentElement.dataset.theme === 'dark';
    return {
      dot: dark ? '175, 195, 225' : '46, 66, 105',
      accent: dark ? '10, 132, 255' : '0, 113, 227',
      violet: dark ? '150, 120, 255' : '123, 92, 255',
      halo: dark ? '10, 132, 255' : '0, 113, 227',
      bodyHi: dark ? '40, 70, 130' : '255, 255, 255',
      bodyHiA: dark ? 0.5 : 0.85,
      bodyLo: dark ? '10, 18, 40' : '214, 226, 245',
      bodyLoA: dark ? 0.85 : 0.9,
    };
  }

  // Great-circle interpolation between two lat/lon points
  function slerp(a, b, t) {
    const toRad = Math.PI / 180;
    const φ1 = a.lat * toRad, λ1 = a.lon * toRad;
    const φ2 = b.lat * toRad, λ2 = b.lon * toRad;
    const d =
      2 *
      Math.asin(
        Math.sqrt(
          Math.sin((φ2 - φ1) / 2) ** 2 +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2
        )
      );
    if (!d) return { lat: a.lat, lon: a.lon };
    const A = Math.sin((1 - t) * d) / Math.sin(d);
    const B = Math.sin(t * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    return {
      lat: Math.atan2(z, Math.sqrt(x * x + y * y)) / toRad,
      lon: Math.atan2(y, x) / toRad,
    };
  }

  const arcs = ARC_PAIRS.map(([from, to], i) => ({
    from: HUBS[from],
    to: HUBS[to],
    phase: (i / ARC_PAIRS.length) * 1.0,
    speed: 0.12 + (i % 5) * 0.018,
  }));

  let time = 0;

  function draw() {
    const c = themeColors();
    ctx.clearRect(0, 0, state.width, state.height);

    const cx = state.width / 2;
    const cy = state.height / 2;

    // Atmospheric halo
    const halo = ctx.createRadialGradient(cx, cy, state.radius * 0.72, cx, cy, state.radius * 1.3);
    halo.addColorStop(0, `rgba(${c.halo}, 0.2)`);
    halo.addColorStop(1, `rgba(${c.halo}, 0)`);
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, state.radius * 1.3, 0, Math.PI * 2);
    ctx.fill();

    // Sphere body — a lit globe reads as a solid object, not a cloud of dots
    const body = ctx.createRadialGradient(
      cx - state.radius * 0.34, cy - state.radius * 0.4, state.radius * 0.1,
      cx, cy, state.radius
    );
    body.addColorStop(0, `rgba(${c.bodyHi}, ${c.bodyHiA})`);
    body.addColorStop(1, `rgba(${c.bodyLo}, ${c.bodyLoA})`);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, state.radius, 0, Math.PI * 2);
    ctx.fill();

    // Terminator rim — light catching the edge of the sphere
    ctx.strokeStyle = `rgba(${c.accent}, 0.28)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, state.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Sphere dots — back hemisphere dimmer, front crisp
    for (const dot of sphereDots) {
      const p = project(dot.lat, dot.lon);
      const front = p.z > 0;
      const depth = (p.z + 1) / 2; // 0 back … 1 front
      const alpha = front ? 0.22 + depth * 0.55 : 0.05 + depth * 0.1;
      const size = front ? 0.9 + depth * 1.0 : 0.7;
      ctx.fillStyle = `rgba(${c.dot}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Connection arcs with travelling pulses
    for (const arc of arcs) {
      const steps = 48;
      const head = ((time * arc.speed + arc.phase) % 1.6) - 0.3; // pause between sweeps

      ctx.lineCap = 'round';
      for (let s = 0; s < steps; s++) {
        const t0 = s / steps;
        const t1 = (s + 1) / steps;
        const a = slerp(arc.from, arc.to, t0);
        const b = slerp(arc.from, arc.to, t1);
        const pa = project(a.lat, a.lon);
        const pb = project(b.lat, b.lon);
        if (pa.z <= 0 && pb.z <= 0) continue; // hidden behind the globe

        const depth = Math.max(0, (pa.z + pb.z) / 2);
        // Brightness peaks where the pulse currently is
        const dist = Math.abs(t0 - head);
        const pulse = Math.max(0, 1 - dist / 0.22);
        const base = 0.22 + depth * 0.3;
        ctx.lineWidth = 1.5 + pulse * 1.6;
        ctx.strokeStyle = `rgba(${c.accent}, ${Math.min(1, base + pulse * 0.65)})`;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }
    }

    // Hub markers
    for (const hub of HUBS) {
      const p = project(hub.lat, hub.lon);
      if (p.z <= 0) continue;
      const depth = p.z;
      const pulse = 0.5 + 0.5 * Math.sin(time * 2 + hub.lon);

      // Expanding sonar ring
      ctx.strokeStyle = `rgba(${c.violet}, ${0.35 * depth * (1 - pulse)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5 + pulse * 9, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(${c.violet}, ${0.18 * depth})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 + pulse * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(${c.accent}, ${0.7 + depth * 0.3})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.8 + depth * 1.1, 0, Math.PI * 2);
      ctx.fill();

      // Bright core so hubs pop against the sphere
      ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * depth})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.1 + depth * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  let raf = null;
  let lastFrame = 0;

  function frame(now) {
    const dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.05) : 0.016;
    lastFrame = now;
    time += dt;

    if (!state.dragging) {
      state.rotation += state.velocity;
      // Decay toward the gentle idle drift rather than a dead stop
      const idle = 0.0016;
      state.velocity = idle + (state.velocity - idle) * 0.94;
    }

    draw();
    raf = requestAnimationFrame(frame);
  }

  /* ------------------------------------------------ Drag interaction */

  canvas.addEventListener('pointerdown', (e) => {
    state.dragging = true;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    state.history = [{ x: e.clientX, t: performance.now() }];
    // Capture keeps tracking alive outside the canvas; never let a failure
    // here strand the globe in a permanent "dragging" state.
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* capture unavailable */ }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!state.dragging) return;
    const dx = e.clientX - state.lastX;
    const dy = e.clientY - state.lastY;
    state.lastX = e.clientX;
    state.lastY = e.clientY;

    // 1:1 tracking — the surface follows the finger exactly
    state.rotation += dx * 0.006;
    state.tilt = Math.max(-0.15, Math.min(0.85, state.tilt - dy * 0.003));

    state.history.push({ x: e.clientX, t: performance.now() });
    if (state.history.length > 6) state.history.shift();
  });

  function endDrag(e) {
    if (!state.dragging) return;
    state.dragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ }

    // Velocity handoff: carry the release speed into the spin
    const h = state.history;
    if (h.length >= 2) {
      const first = h[0];
      const last = h[h.length - 1];
      const dt = (last.t - first.t) / 1000;
      if (dt > 0) {
        const pxPerSec = (last.x - first.x) / dt;
        state.velocity = Math.max(-0.06, Math.min(0.06, pxPerSec * 0.006 / 60));
      }
    }
    state.history = [];
  }

  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  /* ------------------------------------------------ Lifecycle */

  const ro = new ResizeObserver(() => { resize(); draw(); });
  ro.observe(canvas);
  resize();

  function start() {
    if (raf == null) {
      lastFrame = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  function stop() {
    if (raf != null) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  }

  if (reduceMotion.matches) {
    draw(); // one static frame — still shows the network, just doesn't move
  } else {
    start();
  }

  // Don't burn frames when the globe is off-screen or the tab is hidden
  const visibility = new IntersectionObserver(
    (entries) => {
      const visible = entries[0].isIntersecting;
      if (visible && !reduceMotion.matches && !document.hidden) start();
      else stop();
    },
    { threshold: 0.01 }
  );
  visibility.observe(canvas);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (!reduceMotion.matches) start();
  });

  reduceMotion.addEventListener('change', () => {
    if (reduceMotion.matches) { stop(); draw(); } else start();
  });

  // Repaint immediately when the theme flips
  new MutationObserver(() => draw()).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  /* ---------------------------------------------------------- Scroll reveal */

  const revealTargets = [
    ...document.querySelectorAll('.intro-card'),
    ...document.querySelectorAll('.how-step'),
    document.querySelector('.how .section-title'),
    document.querySelector('.closer'),
  ].filter(Boolean);

  revealTargets.forEach((el, i) => {
    el.classList.add('reveal');
    el.style.transitionDelay = `${(i % 4) * 70}ms`;
  });

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14, rootMargin: '0px 0px -8% 0px' }
  );

  revealTargets.forEach((el) => revealObserver.observe(el));

  /* ---------------------------------------------------------- Stat counters */

  const statNums = [...document.querySelectorAll('.stat-num')];

  function countUp(el) {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    if (reduceMotion.matches) {
      el.textContent = target + suffix;
      return;
    }
    const duration = 1400;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const statObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          countUp(entry.target);
          statObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  statNums.forEach((el) => statObserver.observe(el));
})();
