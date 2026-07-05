(function () {
  const toggle = document.getElementById('navToggle');
  const nav = document.querySelector('.nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', function () {
    const isOpen = nav.style.display === 'flex';
    nav.style.display = isOpen ? 'none' : 'flex';
    nav.style.flexDirection = 'column';
    nav.style.position = 'absolute';
    nav.style.top = '64px';
    nav.style.right = '24px';
    nav.style.background = 'var(--cream)';
    nav.style.border = '0.5px solid rgba(46,42,40,0.1)';
    nav.style.borderRadius = '12px';
    nav.style.padding = '12px 20px';
    nav.style.boxShadow = '0 4px 16px rgba(46,42,40,0.08)';
    toggle.setAttribute('aria-expanded', String(!isOpen));
  });
})();
