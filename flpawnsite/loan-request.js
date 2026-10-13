const form = document.getElementById('loan-request-form');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById('loan-status');
  button.disabled = true;
  status.textContent = 'Sending…';
  try {
    const response = await fetch('/api/loan-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    if (!response.ok) throw new Error('Submission failed');
    status.textContent = 'Your request was sent. We’ll contact you about your item.';
    form.reset();
  } catch {
    status.textContent = 'We couldn’t confirm your request was sent. Please call us, or try again later.';
  } finally { button.disabled = false; }
});
