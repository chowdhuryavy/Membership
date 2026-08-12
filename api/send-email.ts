import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, subject, html, attachments } = req.body || {};
    const resendApiKey = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY;

    if (!resendApiKey) {
      console.error('[Vercel /api/send-email] Missing RESEND_API_KEY in environment variables');
      return res.status(500).json({ success: false, error: 'RESEND_API_KEY is not configured in Vercel environment variables' });
    }

    const rawToList = Array.isArray(to) ? to : [to];
    const emails = rawToList
      .flatMap((e: string) => (typeof e === 'string' ? e.split(',') : [e]))
      .map((e: string) => (typeof e === 'string' ? e.trim() : ''))
      .filter(Boolean);

    if (emails.length === 0) {
      return res.status(400).json({ success: false, error: 'No recipient email addresses provided' });
    }

    const fromEmail = process.env.EMAIL_FROM || 'noreply@perfection.my';
    const appName = 'Health Club Management';

    console.log(`[Vercel /api/send-email] Sending email to ${emails.join(', ')}...`);

    // Attempt 1: Try configured domain fromEmail
    let resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `${appName} <${fromEmail}>`,
        to: emails,
        subject,
        html,
        attachments: attachments || []
      })
    });

    let resendResult: any = await resendResponse.json();

    // Fallback if domain is unverified on Resend
    if (!resendResponse.ok && fromEmail !== 'onboarding@resend.dev') {
      console.warn(`[Vercel /api/send-email] Primary email attempt (${fromEmail}) failed:`, resendResult, '. Retrying with onboarding@resend.dev...');
      resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `${appName} <onboarding@resend.dev>`,
          to: emails,
          subject,
          html,
          attachments: attachments || []
        })
      });
      resendResult = await resendResponse.json();
    }

    if (!resendResponse.ok) {
      console.error('[Vercel /api/send-email] Resend API Error:', resendResult);
      return res.status(resendResponse.status).json({
        success: false,
        error: resendResult.message || JSON.stringify(resendResult)
      });
    }

    console.log('[Vercel /api/send-email] Email delivered successfully. Resend ID:', resendResult.id);
    return res.status(200).json({ success: true, id: resendResult.id });
  } catch (err: any) {
    console.error('[Vercel /api/send-email] Error:', err);
    return res.status(500).json({ success: false, error: err?.message || String(err) });
  }
}
