/* ============================================================
   Landing page behaviour: the showcase map tour, scroll reveals,
   and the sticky header hairline.
   ============================================================ */

'use strict';

(function landing() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------- Schema-derived copy

     The landing page quotes counts that an admin can change in admin.html,
     so read them from the schema rather than letting the markup go stale. */

  const stats = {
    steps: () => (typeof schema !== 'undefined' ? schema.steps.length + 1 : null),
    /* The headline "N domains of expertise" must match the question the
       applicant actually meets. Prefer the question that still carries the
       expertise id; only if an admin renamed it do we fall back to the
       longest option list, which is what that question has always been. */
    'expertise-options': () => {
      if (typeof schema === 'undefined') return null;
      const all = schema.steps.flatMap((s) => s.questions).filter((x) => Array.isArray(x.options));
      const named = all.find((x) => x.id === 'expertise');
      const q = named || all.slice().sort((a, b) => b.options.length - a.options.length)[0];
      return q ? q.options.length : null;
    },
  };

  document.querySelectorAll('[data-schema-stat]').forEach((el) => {
    const value = stats[el.dataset.schemaStat]?.();
    if (value != null) el.textContent = String(value);
  });

  /* ---------------------------------------------------------- Showcase map */

  const stage = document.getElementById('showcaseMap');
  const caption = document.getElementById('tourCaption');
  const regionEl = caption ? caption.querySelector('.tour-region') : null;
  const countEl = caption ? caption.querySelector('.tour-count') : null;

  let showcase = null;

  if (stage) {
    showcase = createWorldMap(stage, {
      mode: 'showcase',
      onTour(region, count) {
        if (regionEl) regionEl.textContent = region;
        if (countEl) countEl.textContent = `${count} ${count === 1 ? 'country' : 'countries'}`;
      },
    });

    // Only run the tour while the map is actually on screen
    const tourObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !document.hidden) showcase.startTour();
        else showcase.stopTour();
      },
      { threshold: 0.15 }
    );
    tourObserver.observe(stage);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) showcase.stopTour();
    });
  }

  /* ---------------------------------------------------------- Scroll reveal */

  const revealTargets = [
    ...document.querySelectorAll('.intro-card'),
    ...document.querySelectorAll('.work-dark'),
    ...document.querySelectorAll('.work-card'),
    ...document.querySelectorAll('.how .section-title'),
    ...document.querySelectorAll('.how-card'),
    ...document.querySelectorAll('.closer'),
  ].filter(Boolean);

  revealTargets.forEach((el) => el.classList.add('reveal'));

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        // Stagger siblings so a grid animates in as a wave, not a block
        const siblings = [...entry.target.parentElement.children].filter((el) =>
          el.classList.contains('reveal')
        );
        const i = Math.max(0, siblings.indexOf(entry.target));
        entry.target.style.transitionDelay = `${Math.min(i, 5) * 70}ms`;
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
  );

  revealTargets.forEach((el) => revealObserver.observe(el));

  /* ---------------------------------------------------------- Header hairline */

  const siteHeader = document.getElementById('siteHeader');
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      siteHeader.classList.toggle('scrolled', window.scrollY > 8);
      ticking = false;
    });
  });

  void reduceMotion;
})();
