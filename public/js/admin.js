(function () {
  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const loginBtn = document.getElementById('loginBtn');
  const loginBtnText = document.getElementById('loginBtnText');
  const logoutBtn = document.getElementById('logoutBtn');
  const enquiryList = document.getElementById('enquiryList');
  const enquiryError = document.getElementById('enquiryError');
  const emptyState = document.getElementById('emptyState');

  const SERVICE_LABELS = {
    stayIn: 'Stay-in nanny placement',
    dayNanny: 'Day nanny placement',
    afterSchool: 'After-school nanny placement',
    sleepover: 'Sleepover / weekend care',
    holiday: 'Public holiday cover',
    fullDay: 'Day nanny placement',
  };

  function showError(el, message) {
    el.textContent = message;
    el.classList.add('visible');
  }

  function clearError(el) {
    el.classList.remove('visible');
    el.textContent = '';
  }

  function showDashboard() {
    loginView.style.display = 'none';
    dashboardView.style.display = 'block';
    loadEnquiries();
  }

  function showLogin() {
    dashboardView.style.display = 'none';
    loginView.style.display = 'block';
  }

  // Escapes text before inserting into innerHTML. Enquiry data (name,
  // phone, message) comes from anonymous website visitors and must never
  // be treated as trusted HTML — without this, a visitor could submit a
  // name like "<img src=x onerror=alert(1)>" and have it execute in the
  // admin's browser when this page renders it (a stored XSS attack).
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function renderEnquiries(enquiries) {
    if (enquiries.length === 0) {
      enquiryList.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    // Newest first.
    const sorted = [...enquiries].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

    enquiryList.innerHTML = sorted
      .map((e) => {
        const services = (e.services || []).map((s) => escapeHtml(SERVICE_LABELS[s] || s)).join(', ');
        const date = new Date(e.submittedAt).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' });
        return `
          <div class="card" style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
              <strong style="color: var(--ink); font-size: 1rem;">${escapeHtml(e.name)}</strong>
              <span style="font-size: 0.78rem; color: var(--ink-soft);">${escapeHtml(date)}</span>
            </div>
            <div style="font-size: 0.85rem; color: var(--ink-soft); margin-bottom: 6px;">
              <i class="ti ti-phone" aria-hidden="true"></i> ${escapeHtml(e.phone)}
              ${e.email ? ` &middot; <i class="ti ti-mail" aria-hidden="true"></i> ${escapeHtml(e.email)}` : ''}
            </div>
            <div style="font-size: 0.85rem; margin-bottom: 6px;"><strong>Care needed:</strong> ${services}</div>
            ${e.message ? `<div style="font-size: 0.85rem; color: var(--ink-soft);"><strong>Notes:</strong> ${escapeHtml(e.message)}</div>` : ''}
          </div>
        `;
      })
      .join('');
  }

  async function loadEnquiries() {
    clearError(enquiryError);
    try {
      const response = await fetch('/api/enquiries', { credentials: 'same-origin' });
      if (response.status === 401) {
        showLogin();
        return;
      }
      const data = await response.json();
      if (!response.ok) {
        showError(enquiryError, data.error || 'Could not load enquiries.');
        return;
      }
      renderEnquiries(data.enquiries || []);
    } catch (err) {
      showError(enquiryError, 'Could not reach the server. Please check your connection.');
    }
  }

  async function checkSession() {
    try {
      const response = await fetch('/api/admin/session', { credentials: 'same-origin' });
      const data = await response.json();
      if (data.isAdmin) {
        showDashboard();
      } else {
        showLogin();
      }
    } catch (err) {
      showLogin();
    }
  }

  loginForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    clearError(loginError);
    loginBtn.disabled = true;
    loginBtnText.textContent = 'Logging in…';

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        showError(loginError, data.error || 'Login failed.');
        loginBtn.disabled = false;
        loginBtnText.textContent = 'Log in';
        return;
      }

      // Clear the password field from memory/DOM before navigating away.
      document.getElementById('password').value = '';
      showDashboard();
    } catch (err) {
      showError(loginError, 'Could not reach the server. Please check your connection.');
      loginBtn.disabled = false;
      loginBtnText.textContent = 'Log in';
    }
  });

  logoutBtn.addEventListener('click', async function () {
    try {
      await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    } catch (err) {
      // Even if the network call fails, show the login screen — the
      // session cookie will still expire on its own, and there's no
      // useful recovery action for the admin to take here.
    }
    showLogin();
  });

  checkSession();
})();
