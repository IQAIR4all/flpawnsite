module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const origin = req.headers.origin;
  if (!origin || (() => { try { return new URL(origin).host !== req.headers.host; } catch { return true; } })()) {
    return res.status(403).json({ error: 'Invalid origin' });
  }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { return res.status(400).json({ error: 'Invalid request' }); } }
  if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid request' });
  if (body.website) return res.status(200).json({ success: true });
  const { name, phone, email, item, amount } = body;
  if ([name, phone, email, item].some(v => typeof v !== 'string' || !v.trim()) ||
      name.length > 100 || phone.length > 40 || email.length > 254 || item.length > 2000 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || /[\r\n]/.test(email) ||
      typeof amount !== 'string' || !/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) < 1 || Number(amount) > 1000000) {
    return res.status(400).json({ error: 'Please check all fields' });
  }
  const domain = process.env.RESEND_EMAIL_DOMAIN;
  if (!process.env.RESEND_API_KEY || !domain || !/^[a-z0-9.-]+$/i.test(domain)) {
    return res.status(503).json({ error: 'Email service unavailable' });
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `Florida Pawn <loans@${domain}>`, to: ['everyone@flpawn.com'], reply_to: email.trim(),
        subject: 'New pawn loan inquiry',
        text: `Name: ${name.trim()}\nPhone: ${phone.trim()}\nEmail: ${email.trim()}\nRequested amount (USD): ${amount}\n\nItem description:\n${item.trim()}`
      }), signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return res.status(502).json({ error: 'Unable to send request' });
    return res.status(200).json({ success: true });
  } catch { return res.status(502).json({ error: 'Unable to send request' }); }
};
