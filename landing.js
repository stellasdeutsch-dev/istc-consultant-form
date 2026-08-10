/* ============================================================
   Landing page behaviour: the showcase map tour, scroll reveals,
   and the sticky header hairline.
   ============================================================ */

'use strict';

(function landing() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

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
