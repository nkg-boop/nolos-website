(function () {
  const toggle = document.getElementById('navToggle');
  const nav = document.querySelector('.nav');
  if (!toggle || !nav) return;

  function positionDropdown() {
    // Computed from the toggle button's actual on-screen position rather
    // than hardcoded pixel values. The previous version guessed the
    // header height (top: 64px) and container padding (right: 24px) as
    // fixed numbers — those silently drift out of sync the moment either
    // value changes elsewhere (e.g. container padding shrinking on small
    // phones), misaligning the dropdown from the button that opens it.
    const toggleRect = toggle.getBoundingClientRect();
    nav.style.top = `${toggleRect.bottom + 8}px`;
    nav.style.right = `${window.innerWidth - toggleRect.right}px`;
  }

  function closeDropdown() {
    nav.style.display = 'none';
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', function () {
    const isOpen = nav.style.display === 'flex';

    if (isOpen) {
      closeDropdown();
      return;
    }

    positionDropdown();
    nav.style.display = 'flex';
    nav.style.flexDirection = 'column';
    nav.style.position = 'fixed'; // fixed, not absolute — stays correctly placed even if the page has scrolled.
    nav.style.background = 'var(--cream)';
    nav.style.border = '0.5px solid rgba(46,42,40,0.1)';
    nav.style.borderRadius = '12px';
    nav.style.padding = '12px 20px';
    nav.style.boxShadow = '0 4px 16px rgba(46,42,40,0.08)';
    nav.style.zIndex = '60'; // Above the sticky header (z-index: 50).
    toggle.setAttribute('aria-expanded', 'true');
  });

  // Re-measure on resize/orientation change — a phone rotated from
  // portrait to landscape, or a browser window resized, would otherwise
  // leave the dropdown positioned for the previous viewport size.
  window.addEventListener('resize', function () {
    if (nav.style.display === 'flex') {
      positionDropdown();
    }
  });

  // Close the dropdown if a nav link is actually clicked, so navigating
  // to a new page doesn't leave the menu visibly open mid-transition.
  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeDropdown);
  });
})();

