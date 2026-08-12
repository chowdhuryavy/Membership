import { reportService } from './reportService';
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

    // Method 1: Call Express server API endpoint
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
      }
    } catch (apiErr) {
      console.warn('[Email Service] Express /api/send-email unreachable or failed, trying Supabase Edge Function fallback...', apiErr);
    }

    // Method 2: Fallback to Supabase Edge Function
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
          console.error('[Email Service] Edge Function returned error:', error || data?.error);
        }
      }
    } catch (err: any) {
      console.error('[Email Service] Exception sending email via Edge Function:', err);
    }

    return { success: false, error: 'Failed to send email via both Express server and Supabase Edge Function.' };
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
            TTH Health Club Management System &bull; Confidential Audit Trail
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

      // Find recipients configured for members_joined, or all active recipients for outlet
      let targetEmails: string[] = [];
      const purchasedRecipients = recipients.filter(r => r.is_active && r.report_type === 'members_joined' && (r.outlet_id === 'all' || r.outlet_id === member.outlet_id));
      
      if (purchasedRecipients.length > 0) {
        targetEmails = purchasedRecipients.flatMap(r => r.email.split(',').map(e => e.trim()));
      } else {
        const activeRecipients = recipients.filter(r => r.is_active && (r.outlet_id === 'all' || r.outlet_id === member.outlet_id));
        targetEmails = activeRecipients.flatMap(r => r.email.split(',').map(e => e.trim()));
      }

      if (member.email && member.email.trim() && !targetEmails.includes(member.email.trim())) {
        targetEmails.push(member.email.trim());
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
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #0f172a; margin: 0; padding: 24px; line-height: 1.6; }
            .container { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 20px; padding: 36px; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05); }
            .badge { display: inline-block; background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 800; text-transform: uppercase; padding: 6px 14px; border-radius: 9999px; letter-spacing: 0.08em; margin-bottom: 16px; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 18px; margin-bottom: 24px; }
            .title { font-size: 24px; font-weight: 900; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: -0.02em; }
            .subtitle { font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px; }
            .attachment-banner { background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 14px 18px; margin: 20px 0; font-size: 13px; color: #1e40af; display: flex; align-items: center; }
            .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f8fafc; padding: 22px; border-radius: 16px; border: 1px solid #e2e8f0; margin: 24px 0; }
            .detail-item { font-size: 13px; }
            .detail-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.06em; }
            .detail-value { font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px; }
            .amount-box { background: #0f172a; color: #ffffff; padding: 22px; border-radius: 16px; text-align: center; margin: 24px 0; }
            .amount-val { font-size: 30px; font-weight: 900; color: #818cf8; letter-spacing: -0.02em; }
            .agreement-box { background: #fafafa; border: 1px solid #e2e8f0; padding: 18px; border-radius: 12px; font-size: 12px; color: #334155; margin-top: 20px; white-space: pre-wrap; line-height: 1.5; }
            .footer { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 18px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="badge">✓ Enrollment Confirmed</div>
            <div class="header">
              <h1 class="title">${property?.name || 'THE TORCH DOHA'}</h1>
              <div class="subtitle">${outlet?.name || 'TORCH CLUB'} &bull; Official Membership Enrollment</div>
            </div>

            <p style="font-size: 15px; margin-bottom: 8px;"><strong>Dear ${member.guest_name},</strong></p>
            <p style="font-size: 14px; color: #334155; margin-top: 0;">Welcome to <strong>${property?.name || 'THE TORCH DOHA'}</strong>! Your membership agreement has been completed and registered in our system.</p>

            ${pdfBase64 ? `
            <div class="attachment-banner">
              <strong>📄 Official Document Attached:</strong> Your signed <strong>Membership Agreement & Facility Rules PDF</strong> is attached to this email (<code>Membership_Agreement_${member.membership_number}.pdf</code>).
            </div>
            ` : ''}

            <div class="details-grid">
              <div class="detail-item">
                <div class="detail-label">Member Name</div>
                <div class="detail-value">${member.guest_name}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Membership Number</div>
                <div class="detail-value">${member.membership_number}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Package & Access</div>
                <div class="detail-value">${member.package_type || 'Single'} (${member.access_type || 'Both'})</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Enrollment Type</div>
                <div class="detail-value">${member.membership_type || 'New'}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Commencement Date</div>
                <div class="detail-value">${startDateFormatted}</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Expiry Date (Validity)</div>
                <div class="detail-value">${endDateFormatted}</div>
              </div>
            </div>

            <div class="amount-box">
              <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #a5b4fc; letter-spacing: 0.1em;">Total Contribution Paid</div>
              <div class="amount-val">${symbol} ${(member.net_amount || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
              <div style="font-size: 11px; color: #cbd5e1; margin-top: 4px;">Payment Ref: ${member.check_no || 'Direct Registration'}</div>
            </div>

            <div style="font-weight: 800; font-size: 12px; text-transform: uppercase; color: #0f172a; margin-top: 24px;">Terms & Conditions Summary</div>
            <div class="agreement-box">
${cleanTerms}
            </div>

            <div class="footer">
              ${property?.name || 'THE TORCH DOHA'} &bull; ${outlet?.name || 'TORCH CLUB'}<br/>
              Verified Member Enrollment System &bull; Confidential
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
