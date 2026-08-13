import { db } from './mockSupabase';
import { supabase } from './supabase';
import { format, parseISO } from 'date-fns';
import { generateMemberAgreementPdfBase64 } from './memberAgreementPdfService';

const recentlySentMembersSet = new Set<string>();

export function resolveLogoUrl(
  outlet?: { logo_url?: string; name?: string } | null,
  property?: { logo_url?: string; name?: string } | null,
  settings?: { logo_url?: string } | null
): string {
  const candidates = [
    outlet?.logo_url,
    property?.logo_url,
    settings?.logo_url
  ];

  for (const rawUrl of candidates) {
    if (rawUrl && typeof rawUrl === 'string' && rawUrl.trim()) {
      const clean = rawUrl.trim();
      if (clean.startsWith('http://') || clean.startsWith('https://') || clean.startsWith('data:image/')) {
        return clean;
      }
      if (typeof window !== 'undefined' && window.location?.origin) {
        return `${window.location.origin}${clean.startsWith('/') ? '' : '/'}${clean}`;
      }
      return clean;
    }
  }

  const displayName = outlet?.name || property?.name || 'TTH';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0f172a&color=ffffff&size=200&format=png&bold=true`;
}

export function buildBoxedEmailHtml(params: {
  bannerType?: 'success' | 'warning' | 'alert' | 'info';
  bannerText?: string;
  logoUrl?: string;
  propertyName: string;
  outletName?: string;
  subtitle?: string;
  greeting?: string;
  introParagraph?: string;
  calloutBox?: string;
  dataFields: Array<{ label: string; value: string }>;
  amountBox?: {
    label: string;
    amount: string | number;
    currency?: string;
    subtext?: string;
  };
  footerText?: string;
  timestamp?: string;
}): string {
  const bannerBg = params.bannerType === 'warning' ? '#fef3c7'
    : params.bannerType === 'alert' ? '#fee2e2'
    : params.bannerType === 'info' ? '#e0f2fe'
    : '#dcfce7';

  const bannerColor = params.bannerType === 'warning' ? '#92400e'
    : params.bannerType === 'alert' ? '#991b1b'
    : params.bannerType === 'info' ? '#0369a1'
    : '#166534';

  const defaultBannerText = params.bannerType === 'warning' ? '⚠️ MEMBERSHIP FREEZE ACTION LOGGED'
    : params.bannerType === 'alert' ? '❌ TRANSACTION VOID ACTION LOGGED'
    : params.bannerType === 'info' ? 'ℹ️ SYSTEM INFORMATION DISPATCH'
    : '✓ ENROLLMENT CONFIRMED';

  const banner = params.bannerText || defaultBannerText;
  const propName = params.propertyName || 'The Torch Doha';
  const outlet = params.outletName || 'Torch Club';
  const sub = params.subtitle || 'OFFICIAL MEMBERSHIP ENROLLMENT';
  const greeting = params.greeting !== undefined ? params.greeting : 'Dear Admin,';

  const dataRowsHtml = params.dataFields.map((f, i) => `
    <tr>
      <td style="padding: 10px 12px 10px 0; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; width: 42%; vertical-align: top; text-align: left; ${i < params.dataFields.length - 1 ? 'border-bottom: 1px solid #e2e8f0;' : ''}">
        ${f.label}
      </td>
      <td style="padding: 10px 0; font-size: 13px; font-weight: 700; color: #0f172a; vertical-align: top; text-align: left; ${i < params.dataFields.length - 1 ? 'border-bottom: 1px solid #e2e8f0;' : ''}">
        ${f.value || 'N/A'}
      </td>
    </tr>
  `).join('');

  const amountValueFormatted = params.amountBox
    ? (typeof params.amountBox.amount === 'number'
        ? params.amountBox.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : params.amountBox.amount)
    : '';

  const amountHtml = params.amountBox ? `
    <div style="background-color: #0f172a; border-radius: 8px; padding: 18px 24px; text-align: center; margin: 20px 0 10px 0;">
      <div style="font-size: 10px; font-weight: 700; color: #a5b4fc; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">
        ${params.amountBox.label}
      </div>
      <div style="font-size: 26px; font-weight: 900; color: #ffffff; margin: 2px 0;">
        ${amountValueFormatted}${params.amountBox.currency ? ` ${params.amountBox.currency}` : ''}
      </div>
      ${params.amountBox.subtext ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">${params.amountBox.subtext}</div>` : ''}
    </div>
  ` : '';

  const calloutHtml = params.calloutBox ? `
    <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #0369a1; font-weight: 500;">
      ${params.calloutBox}
    </div>
  ` : '';

  const logoHtml = params.logoUrl ? `
    <img src="${params.logoUrl}" width="140" style="max-width: 140px; max-height: 70px; margin-bottom: 12px; object-fit: contain; display: block;" alt="${propName}" />
  ` : '';

  const timeStr = params.timestamp || format(new Date(), 'HH:mm:ss dd/MM/yyyy');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${propName} Dispatch</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; -webkit-font-smoothing: antialiased; }
    table { border-collapse: collapse; }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 10px; width: 100%;">
    <tr>
      <td align="center">
        <!--[if (gte mso 9)|(IE)]>
        <table width="600" align="center" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td>
        <![endif]-->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- TOP BANNER -->
          <tr>
            <td style="background-color: ${bannerBg}; color: ${bannerColor}; padding: 10px 20px; font-weight: 800; font-size: 11px; text-transform: uppercase; text-align: left; letter-spacing: 0.05em;">
              ${banner}
            </td>
          </tr>

          <!-- HEADER -->
          <tr>
            <td style="padding: 24px 30px 16px 30px; text-align: left;">
              ${logoHtml}
              <h1 style="font-size: 22px; font-weight: 900; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: -0.01em;">${propName}</h1>
              <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 4px;">${outlet} &bull; ${sub}</div>
              <div style="height: 2px; background-color: #0f172a; margin-top: 16px; width: 100%;"></div>
            </td>
          </tr>

          <!-- CONTENT BODY -->
          <tr>
            <td style="padding: 0 30px 24px 30px; color: #334155; font-size: 14px; line-height: 1.6;">
              ${greeting ? `<p style="margin: 0 0 12px 0; font-weight: 700; color: #0f172a;">${greeting}</p>` : ''}
              ${params.introParagraph ? `<p style="margin: 0 0 16px 0; color: #475569; font-size: 13px;">${params.introParagraph}</p>` : ''}
              ${calloutHtml}

              <!-- SHADED DATA BOX -->
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin: 16px 0;">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                  ${dataRowsHtml}
                </table>
              </div>

              ${amountHtml}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color: #ffffff; padding: 20px 30px 24px 30px; text-align: center; border-top: 1px solid #f1f5f9; color: #94a3b8; font-size: 11px; line-height: 1.5;">
              <div style="font-weight: 600; color: #64748b;">${propName} &bull; ${outlet}</div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Verified Member Enrollment System &bull; Confidential</div>
              <div style="font-size: 10px; font-style: italic; color: #cbd5e1; margin-top: 8px;">Audit recorded at: ${timeStr}</div>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export const emailService = {
  async sendEmail(to: string | string[], subject: string, html: string, attachments: { filename: string; content: string }[] = []) {
    const targetStr = Array.isArray(to) ? to.join(', ') : to;
    console.log(`[Email Service] Dispatching email to: ${targetStr}`);
    console.log(`[Email Service] Subject: ${subject}`);
    console.log(`[Email Service] Attachments: ${attachments.length}`);

    let lastErrorMessage = '';

    // Primary Method: Send via Supabase Edge Function directly if available
    try {
      if (supabase) {
        const { data, error } = await supabase.functions.invoke('send-reports', {
          body: {
            directEmail: {
              to,
              subject,
              html,
              attachments
            }
          }
        });

        if (!error && data && data.success !== false) {
          console.log('[Email Service] Email successfully sent via Resend Edge Function:', data?.id);
          return { success: true, messageId: data?.id || Math.random().toString(36).substring(7) };
        } else {
          lastErrorMessage = error?.message || data?.error || 'Edge Function error';
          console.warn('[Email Service] Edge Function returned error, trying local Express fallback...', lastErrorMessage);
        }
      }
    } catch (err: any) {
      lastErrorMessage = err?.message || String(err);
      console.warn('[Email Service] Exception sending email via Edge Function, trying Express server fallback...', err);
    }

    // Fallback Method: Call Express server API endpoint
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html, attachments })
      });
      
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        console.log('[Email Service] Email successfully sent via Express /api/send-email:', data.id);
        return { success: true, messageId: data.id };
      } else {
        const errorReason = data.error || `Server API failed with status ${res.status}`;
        console.error(`[Email Service] Express API failed with status ${res.status}:`, errorReason);
        return { success: false, error: errorReason };
      }
    } catch (apiErr: any) {
      console.warn('[Email Service] Express /api/send-email unreachable or failed:', apiErr);
      return { success: false, error: apiErr?.message || lastErrorMessage || 'Failed to dispatch email' };
    }
  },

  async sendReportEmail(
    recipients: string,
    reportTitle: string,
    propertyName: string,
    outletName: string,
    pdfBase64: string,
    summaryText?: string
  ) {
    const toList = recipients.split(',').map(e => e.trim()).filter(Boolean);
    if (toList.length === 0) return { success: false, error: 'No recipient email addresses provided' };

    const dateStr = format(new Date(), 'dd MMM yyyy');
    const subject = `${reportTitle} - ${propertyName} (${outletName}) - ${dateStr}`;
    const filename = `${reportTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f5f9; color: #1e293b; margin: 0; padding: 40px 10px; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 40px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .badge { display: inline-block; background: #e0e7ff; color: #4338ca; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 6px 14px; border-radius: 999px; letter-spacing: 0.1em; margin-bottom: 24px; }
          .header { border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 32px; text-align: left; }
          .title { font-size: 24px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin: 0; letter-spacing: -0.025em; }
          .subtitle { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; margin-top: 8px; }
          .content { font-size: 14px; color: #475569; }
          .meta { background: #f8fafc; padding: 24px; border-radius: 12px; margin: 24px 0; font-size: 13px; border: 1px solid #f1f5f9; }
          .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 24px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="badge">Intelligence Dispatch</div>
          <div class="header">
            <h1 class="title">${propertyName}</h1>
            <div class="subtitle">${reportTitle} &bull; ${outletName}</div>
          </div>
          <div class="content">
            <p>Greetings Administrator,</p>
            <p>The official <strong>${reportTitle}</strong> has been successfully generated and compiled.</p>
            ${summaryText ? `<div class="meta">${summaryText}</div>` : ''}
            <p>The detailed intelligence ledger is attached to this email as a PDF document for your records and review.</p>
          </div>
          <div class="footer">
            ${propertyName} &bull; Internal Intelligence Dispatch
          </div>
        </div>
      </body>
      </html>
    `;

    let lastResult: any = { success: false, error: 'No emails sent' };
    for (const recipient of toList) {
      lastResult = await this.sendEmail(recipient, subject, html, [{ filename, content: pdfBase64 }]);
    }
    return lastResult;
  },

  async sendMemberPurchaseEmail(member: any) {
    const memberKey = `${member?.id || ''}_${member?.membership_number || ''}_${member?.guest_name || ''}`;
    if (recentlySentMembersSet.has(memberKey)) {
      console.log(`[Email Service] Skipping duplicate sendMemberPurchaseEmail call for key: ${memberKey}`);
      return;
    }
    recentlySentMembersSet.add(memberKey);
    setTimeout(() => recentlySentMembersSet.delete(memberKey), 10000);

    console.log('[Email Service] sendMemberPurchaseEmail triggered for member:', member?.id || member?.guest_name);
    try {
      const properties = await db.getProperties();
      const outlets = await db.getOutlets();
      const recipients = await db.getReportRecipients();
      const settings = await db.getSettings();
      const currencies = await db.getCurrencies();

      const outlet = outlets.find(o => o.id === member.outlet_id);
      const property = outlet ? properties.find(p => p.id === outlet.property_id) : properties[0];
      const currency = (settings && currencies.find(c => c.id === settings.currency_id)) || currencies[0];
      const symbol = currency?.symbol || 'QAR';

      // Find recipients configured for members_joined, or all active recipients for property and outlet
      let targetEmails: string[] = [];
      const purchasedRecipients = recipients.filter(r => r.is_active && r.report_type === 'members_joined' && (!r.property_id || r.property_id === property?.id) && (r.outlet_id === 'all' || r.outlet_id === member.outlet_id));
      
      if (purchasedRecipients.length > 0) {
        targetEmails = purchasedRecipients.flatMap(r => r.email.split(',').map(e => e.trim()));
      } else {
        const activeRecipients = recipients.filter(r => r.is_active && (!r.property_id || r.property_id === property?.id) && (r.outlet_id === 'all' || r.outlet_id === member.outlet_id));
        targetEmails = activeRecipients.flatMap(r => r.email.split(',').map(e => e.trim()));
      }

      targetEmails = Array.from(new Set(targetEmails.filter(Boolean)));
      console.log(`[Email Service] Targeted recipients for purchase: ${targetEmails.length}`, targetEmails);
      
      if (targetEmails.length === 0) {
        console.log('[Email Service] No recipient emails found for member purchase notification.');
        return;
      }

      // Generate Member Agreement PDF Attachment
      let pdfBase64 = '';
      try {
        pdfBase64 = await generateMemberAgreementPdfBase64(member, outlet, property, settings);
      } catch (pdfErr) {
        console.error('[Email Service] Error generating Member Agreement PDF base64:', pdfErr);
      }

      const rawContractTemplate = outlet?.contract_template || (property as any)?.contract_template || (settings as any)?.contract_template || 'Standard Health Club Membership Agreement';
      const rawTermsConditions = outlet?.conditions || (property as any)?.conditions || (settings as any)?.conditions || 'All club rules and regulations apply.';

      // Replace template placeholders if present
      const cleanContract = rawContractTemplate
        .replace(/\{\{guest_name\}\}/g, member.guest_name || 'Member')
        .replace(/\{\{membership_number\}\}/g, member.membership_number || '')
        .replace(/\{\{start_date\}\}/g, member.start_date || '')
        .replace(/\{\{end_date\}\}/g, member.current_end_date || member.original_end_date || '');

      const cleanTerms = rawTermsConditions
        .replace(/\{\{guest_name\}\}/g, member.guest_name || 'Member')
        .replace(/\{\{membership_number\}\}/g, member.membership_number || '');

      const startDateFormatted = member.start_date ? format(parseISO(member.start_date), 'dd MMM yyyy') : 'N/A';
      const endDateFormatted = (member.current_end_date || member.original_end_date) ? format(parseISO(member.current_end_date || member.original_end_date), 'dd MMM yyyy') : 'N/A';

      const subject = `Membership Purchase Confirmed - ${member.guest_name} (${member.membership_number})`;
      
      const logoUrl = resolveLogoUrl(outlet, property, settings);

      const html = buildBoxedEmailHtml({
        bannerType: 'success',
        bannerText: '✓ ENROLLMENT CONFIRMED',
        logoUrl,
        propertyName: property?.name || 'The Torch Doha',
        outletName: outlet?.name || 'Torch Club',
        subtitle: 'OFFICIAL MEMBERSHIP ENROLLMENT',
        greeting: 'Dear Admin,',
        introParagraph: `A new membership purchase has been completed and registered in the system for <strong>${property?.name || 'The Torch Doha'}</strong> (${outlet?.name || 'Torch Club'}). Below are the member enrollment details and attached agreement.`,
        calloutBox: pdfBase64 ? `📄 <strong>Official Document Attached:</strong> Your signed Membership Agreement & Facility Rules PDF is attached to this email (Membership_Agreement_${member.membership_number || 'Record'}.pdf).` : undefined,
        dataFields: [
          { label: 'MEMBER NAME', value: member.guest_name || 'N/A' },
          { label: 'MEMBERSHIP NUMBER', value: member.membership_number || 'N/A' },
          { label: 'PACKAGE & ACCESS', value: `${member.package_type || 'Single'} (${member.access_type || 'Both'})` },
          { label: 'ENROLLMENT TYPE', value: member.membership_type || 'New' },
          { label: 'COMMENCEMENT DATE', value: startDateFormatted },
          { label: 'EXPIRY DATE (VALIDITY)', value: endDateFormatted }
        ],
        amountBox: {
          label: 'TOTAL CONTRIBUTION PAID',
          amount: (member.net_amount || 0),
          currency: symbol,
          subtext: `Payment Ref: ${member.check_no || 'Direct Registration'}`
        },
        timestamp: format(new Date(), 'HH:mm:ss dd/MM/yyyy')
      });

      const attachments = pdfBase64 ? [{
        filename: `Membership_Agreement_${member.membership_number || 'Record'}.pdf`,
        content: pdfBase64
      }] : [];

      for (const email of targetEmails) {
        await this.sendEmail(email, subject, html, attachments);
      }
      console.log(`[Email Service] Member purchase notification email sent to: ${targetEmails.join(', ')} with ${attachments.length} attachments.`);
    } catch (err) {
      console.error('[Email Service] Error sending member purchase email:', err);
    }
  }
};

export const schedulerService = {
  async processScheduledReports() {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    
    try {
      const recipients = await db.getReportRecipients();
      const properties = await db.getProperties();
      const outlets = await db.getOutlets();

      for (const recipient of recipients) {
        if (!recipient.is_active) continue;
        
        // Check if it's time to send
        if (recipient.send_time === currentTime) {
          console.log(`[Scheduler] Triggering report for ${recipient.email} at ${recipient.send_time}`);
          
          const property = properties.find(p => p.id === recipient.property_id);
          if (!property) continue;

          const outlet = recipient.outlet_id === 'all' 
            ? 'all' 
            : outlets.find(o => o.id === recipient.outlet_id);
          
          if (!outlet) continue;

          // Trigger Headless DOM Renderer for exact PDF matching
          const reportEvent = new CustomEvent('TRIGGER_REPORT_DISPATCH', {
            detail: {
              recipient,
              property,
              outlet,
              date: now,
              isManual: false
            }
          });
          window.dispatchEvent(reportEvent);
        }
      }
    } catch (error) {
      console.error('[Scheduler] Error processing reports:', error);
    }
  }
};
