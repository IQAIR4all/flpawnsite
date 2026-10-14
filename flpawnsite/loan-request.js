const form = document.getElementById('loan-request-form');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById('loan-status');
  const files = Array.from(document.getElementById('loan-photos').files);
  if (files.length > 3 || files.some(file => !['image/jpeg', 'image/png'].includes(file.type) || file.size === 0 || file.size > 1000000)) {
    status.textContent = 'Choose up to 3 JPG/PNG photos, each no larger than 1 MB.';
    return;
  }
  button.disabled = true;
  status.textContent = 'Sending…';
  try {
    const data = Object.fromEntries(new FormData(form));
    data.photos = await Promise.all(files.map(file => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ type: file.type, content: reader.result.split(',')[1] });
      reader.onerror = () => reject(new Error('Unable to read photo'));
      reader.readAsDataURL(file);
    })));
    const response = await fetch('/api/loan-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Submission failed');
    status.textContent = 'Your request was sent. We’ll contact you about your item.';
    form.reset();
  } catch {
    status.textContent = 'We couldn’t confirm your request was sent. Please call us, or try again later.';
  } finally { button.disabled = false; }
});
