(function () {
  const revealTargets = document.querySelectorAll('[data-reveal]');
  if (revealTargets.length === 0) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    // Reduced motion, or no IntersectionObserver support: never add the
    // js-reveal-enabled class, so the CSS default (fully visible, no
    // hide-then-reveal) stays in effect. Nothing to observe or reveal.
    return;
  }

  // Only now — once we know JS is running AND IntersectionObserver exists
  // — do we opt into the hide-then-reveal behavior. This ordering is the
  // whole point: a failed script load, JS disabled, an old browser, or a
  // reduced-motion preference all leave content visible by default,
  // rather than hidden and dependent on JS to rescue it.
  document.documentElement.classList.add('js-reveal-enabled');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target); // Reveal once, don't re-trigger on scroll-back.
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  revealTargets.forEach((el) => observer.observe(el));
})();

