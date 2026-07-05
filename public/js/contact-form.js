(function () {
  const form = document.getElementById('enquiryForm');
  if (!form) return;

  const errorBox = document.getElementById('formError');
  const successBox = document.getElementById('formSuccess');
  const successMessage = document.getElementById('successMessage');
  const whatsappLink = document.getElementById('whatsappLink');
  const submitBtn = document.getElementById('submitBtn');
  const submitBtnText = document.getElementById('submitBtnText');

  function showError(messages) {
    errorBox.innerHTML = messages.map((m) => `<div>${m}</div>`).join('');
    errorBox.classList.add('visible');
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearError() {
    errorBox.classList.remove('visible');
    errorBox.innerHTML = '';
  }

  function setSubmitting(isSubmitting) {
    submitBtn.disabled = isSubmitting;
    submitBtnText.textContent = isSubmitting ? 'Sending…' : 'Request consultation';
  }

  // Client-side checks exist purely for fast feedback — the server
  // re-validates everything independently and is the actual source
  // of truth. Never trust client validation alone for a real app.
  function clientSideValidate(data) {
    const errors = [];
    if (!data.name || !data.name.trim()) {
      errors.push('Please enter your name.');
    }
    if (!data.phone || !data.phone.trim()) {
      errors.push('Please enter a phone number.');
    }
    if (!data.services || data.services.length === 0) {
      errors.push('Please select at least one type of care.');
    }
    return errors;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    clearError();

    const formData = new FormData(form);
    const payload = {
      name: formData.get('name'),
      phone: formData.get('phone'),
      email: formData.get('email') || undefined,
      services: formData.getAll('services'),
      message: formData.get('message') || undefined,
    };

    const clientErrors = clientSideValidate(payload);
    if (clientErrors.length > 0) {
      showError(clientErrors);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        showError(result.errors || ['Something went wrong. Please try again or call us directly.']);
        setSubmitting(false);
        return;
      }

      // Success: hide the form, show the WhatsApp handoff.
      form.style.display = 'none';
      successMessage.textContent =
        "We've saved your details. Tap below to send the same enquiry straight to our WhatsApp so we can reply faster.";
      whatsappLink.href = result.whatsappUrl;
      successBox.classList.add('visible');
    } catch (err) {
      showError(['We could not reach the server. Please check your connection and try again, or call us directly on 072 097 1423.']);
      setSubmitting(false);
    }
  });
})();
