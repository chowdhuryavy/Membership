import { db } from './mockSupabase';
import { supabase } from './supabase';
import { format, parseISO } from 'date-fns';
import { generateMemberAgreementPdfBase64 } from './memberAgreementPdfService';

const recentlySentMembersSet = new Set<string>();

export const emailService = {
  async sendEmail(to: string | string[], subject: string, html: string, attachments: { filename: string; content: string }[] = []) {
    const targetStr = Array.isArray(to) ? to.join(', ') : to;
    console.log(`[Email Service] Dispatching email to: ${targetStr}`);
    console.log(`[Email Service] Subject: ${subject}`);
    console.log(`[Email Service] Attachments: ${attachments.length}`);

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
          console.warn('[Email Service] Edge Function returned error, trying local Express fallback...', error || data?.error);
        }
      }
    } catch (err: any) {
      console.warn('[Email Service] Exception sending email via Edge Function, trying Express server fallback...', err);
    }

    // Fallback Method: Call Express server API endpoint
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, html, attachments })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          console.log('[Email Service] Email successfully sent via Express /api/send-email:', data.id);
          return { success: true, messageId: data.id };
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error(`[Email Service] Express API failed with status ${res.status}:`, errorData.error || res.statusText);
        
        if (res.status === 401) {
          console.warn('[Email Service] 401 Unauthorized: This usually means RESEND_API_KEY is missing from your environment variables.');
        }
      }
    } catch (apiErr) {
      console.warn('[Email Service] Express /api/send-email unreachable or failed:', apiErr);
    }

    return { success: false, error: 'Failed to send email via both Supabase Edge Function and Express server.' };
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
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f1f5f9; color: #1e293b; margin: 0; padding: 40px 20px; line-height: 1.6; }
          .container { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 24px; padding: 48px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
          .badge { display: inline-block; background: #e0e7ff; color: #4338ca; font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 6px 14px; border-radius: 999px; letter-spacing: 0.1em; margin-bottom: 24px; }
          .header { border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 32px; text-align: left; }
          .title { font-size: 26px; font-weight: 900; text-transform: uppercase; color: #0f172a; margin: 0; letter-spacing: -0.025em; }
          .subtitle { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.15em; margin-top: 8px; }
          .content { font-size: 14px; color: #475569; }
          .meta { background: #f8fafc; padding: 24px; border-radius: 16px; margin: 24px 0; font-size: 13px; border: 1px solid #f1f5f9; }
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
      
      const logoUrl = property?.logo_url || settings?.logo_url || 'https://api.dicebear.com/7.x/initials/svg?seed=TTH';

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #334155; margin: 0; padding: 0; background-color: #f1f5f9; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 10px; }
            .card { background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border: 1px solid #e2e8f0; }
            .header { background-color: #ffffff; padding: 32px 40px 24px; text-align: center; border-bottom: 1px solid #f1f5f9; }
            .logo { max-width: 160px; max-height: 80px; margin-bottom: 16px; object-fit: contain; }
            .title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.05em; }
            .subtitle { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 6px; }
            
            .success-banner { background-color: #dcfce7; color: #166534; padding: 10px 20px; font-weight: 700; font-size: 12px; text-transform: uppercase; text-align: center; letter-spacing: 0.05em; }
            
            .content { padding: 32px 40px; }
            .welcome-box { text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px dashed #dcfce7; }
            .welcome-name { font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 4px; }
            
            .info-table { width: 100%; border-collapse: collapse; margin: 24px 0; }
            .info-row { border-bottom: 1px solid #f8fafc; }
            .info-row:last-child { border-bottom: none; }
            .info-label { padding: 12px 0; font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; width: 35%; vertical-align: top; text-align: left; }
            .info-value { padding: 12px 0; font-size: 14px; font-weight: 600; color: #334155; text-align: right; }
            
            .amount-box { background: #0f172a; color: #ffffff; padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0; }
            .amount-val { font-size: 28px; font-weight: 900; color: #818cf8; }
            
            .footer { background-color: #f8fafc; padding: 24px 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
            .timestamp { font-size: 10px; font-style: italic; color: #cbd5e1; margin-top: 16px; display: block; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header">
                <img src="${logoUrl}" class="logo" alt="${property?.name}" />
                <h1 class="title">${property?.name || 'Operational Insight'}</h1>
                <div class="subtitle">${outlet?.name || ''} &bull; Strategic Enrollment Ledger</div>
              </div>

              <div class="success-banner">✓ Membership Enrollment Verified</div>

              <div class="content">
                <div class="welcome-box">
                  <div class="welcome-name">${member.guest_name}</div>
                  <div style="font-size: 13px; color: #64748b;">Member ID: #${member.membership_number}</div>
                </div>

                <p style="font-size: 14px; color: #64748b; margin-bottom: 24px; text-align: center;">A new membership purchase has been finalized and integrated into the global registry. Comprehensive enrollment data is provided below.</p>

                <table class="info-table">
                  <tr class="info-row"><td class="info-label">Property</td><td class="info-value">${property?.name}</td></tr>
                  <tr class="info-row"><td class="info-label">Facility</td><td class="info-value">${outlet?.name}</td></tr>
                  <tr class="info-row"><td class="info-label">Package</td><td class="info-value">${member.package_type || 'Single'} (${member.access_type || 'Both'})</td></tr>
                  <tr class="info-row"><td class="info-label">Tier</td><td class="info-value">${member.membership_type || 'New'}</td></tr>
                  <tr class="info-row"><td class="info-label">Commencement</td><td class="info-value">${startDateFormatted}</td></tr>
                  <tr class="info-row"><td class="info-label">Maturity</td><td class="info-value">${endDateFormatted}</td></tr>
                </table>

                <div class="amount-box">
                  <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #a5b4fc; letter-spacing: 0.1em; margin-bottom: 8px;">Total Investment Recognized</div>
                  <div class="amount-val">${symbol} ${(member.net_amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                  <div style="font-size: 11px; color: #94a3b8; margin-top: 8px;">Audit Ref: ${member.check_no || 'Direct Capture'}</div>
                </div>
                
                <span class="timestamp">Intelligence recorded at: ${format(new Date(), 'HH:mm:ss dd/MM/yyyy')}</span>
              </div>

              <div class="footer">
                ${property?.name || ''} &bull; Internal Intelligence Dispatch
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

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
