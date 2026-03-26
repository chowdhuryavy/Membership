import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"
import { Resend } from "https://esm.sh/resend@3.1.0"
import { jsPDF } from "https://esm.sh/jspdf@2.5.1"
import autoTable from "https://esm.sh/jspdf-autotable@3.8.1"
import { getReportData, generateReportPDF } from "./reportLogic.ts"

// Apply the plugin
const plugin = (autoTable as any).default || autoTable;
(jsPDF as any).API.autoTable = plugin;

// Check if it was applied
console.log('jsPDF.API.autoTable exists:', !!(jsPDF as any).API.autoTable);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-customer-id',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req) => {
  console.log(`DEBUG: Received ${req.method} request to send-reports`);
  const authHeader = req.headers.get('Authorization');
  console.log(`DEBUG: Authorization header: ${authHeader ? authHeader.substring(0, 20) + '...' : 'NONE'}`);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    console.log(`DEBUG: Supabase URL: ${supabaseUrl.substring(0, 15)}...`);
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
    const body = await req.json().catch(() => ({}))
    const isTest = body.test === true
    const testRecipientId = body.recipientId
    console.log(`DEBUG: Request params - isTest: ${isTest}, testRecipientId: ${testRecipientId}`);

    // Fetch company settings
    const { data: settings } = await supabase.from('company_settings').select('*').eq('id', 'global').maybeSingle()
    const appName = settings?.report_title || 'Health Club Management'
    const fromEmail = Deno.env.get('EMAIL_FROM') || 'info@saavargroup.com'

    // Fetch recipients
    let recipientsQuery = supabase.from('report_recipients').select('*').eq('is_active', true)
    
    if (isTest && testRecipientId) {
      recipientsQuery = recipientsQuery.eq('id', testRecipientId)
    }

    const { data: recipients, error: recipientsError } = await recipientsQuery
    if (recipientsError) throw recipientsError

    console.log(`Fetched ${recipients?.length || 0} active recipients.`);

    const now = new Date()
    
    // Use Intl.DateTimeFormat to get current time in Qatar (Asia/Qatar)
    const qatarFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Qatar',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    });
    
    const parts = qatarFormatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
    
    const currentHour = parseInt(getPart('hour'));
    const currentMinute = parseInt(getPart('minute'));
    
    // Helper to get a consistent day string for Qatar time
    const getQatarDayStr = (date: Date) => {
      const p = qatarFormatter.formatToParts(date);
      const year = p.find(part => part.type === 'year')?.value || '0';
      const month = p.find(part => part.type === 'month')?.value || '0';
      const day = p.find(part => part.type === 'day')?.value || '0';
      return `${parseInt(year)}-${parseInt(month)}-${parseInt(day)}`;
    };

    // Helper to get a consistent month string for Qatar time
    const getQatarMonthStr = (date: Date) => {
      const p = qatarFormatter.formatToParts(date);
      const year = p.find(part => part.type === 'year')?.value || '0';
      const month = p.find(part => part.type === 'month')?.value || '0';
      return `${parseInt(year)}-${parseInt(month)}`;
    };

    const currentDay = parseInt(getPart('day'));
    const currentMonth = parseInt(getPart('month'));
    const currentYear = parseInt(getPart('year'));

    const currentDayStr = getQatarDayStr(now);
    const currentMonthStr = getQatarMonthStr(now);

    console.log(`Current Qatar Time: ${currentHour}:${currentMinute}, Day: ${currentDayStr}, Month: ${currentMonthStr}`);

    const filteredRecipients = recipients?.filter(r => {
      if (isTest) {
        console.log(`Recipient ${r.email}: Test mode enabled.`);
        return true;
      }
      if (!r.send_time) {
        console.log(`Recipient ${r.email}: No send_time set.`);
        return false;
      }
      
      const isDaily = r.report_type === 'daily_sales';

      // 1. Time of day check (applies to all)
      let h: number, m: number;
      const timeStr = r.send_time.trim().toUpperCase();
      const timeMatch = timeStr.match(/^(\d+):(\d+)\s*(AM|PM)?$/);
      
      if (timeMatch) {
        h = parseInt(timeMatch[1]);
        m = parseInt(timeMatch[2]);
        const modifier = timeMatch[3];
        if (modifier === 'PM' && h < 12) h += 12;
        if (modifier === 'AM' && h === 12) h = 0;
      } else {
        [h, m] = timeStr.split(':').map(Number);
      }
      
      const scheduledTotalMins = h * 60 + m
      const currentTotalMins = currentHour * 60 + currentMinute
      const diff = currentTotalMins - scheduledTotalMins
      
      console.log(`[DEBUG] Recipient ${r.email}:`);
      console.log(`  - Scheduled: ${r.send_time} (Parsed: ${h}:${m}, ${scheduledTotalMins} mins)`);
      console.log(`  - Current Qatar Time: ${currentHour}:${currentMinute} (${currentTotalMins} mins)`);
      console.log(`  - Diff: ${diff} mins`);

      if (diff < -5 || diff >= 45) {
        console.log(`  - Result: FAILED (Outside window: -5 to 45 mins)`);
        return false;
      }

      // 2. Frequency check
      if (!isDaily) {
        // Monthly check: must be 1st of the month
        if (currentDay !== 1) {
          console.log(`  - Result: FAILED (Not 1st of month)`);
          return false;
        }
      }

      // 3. Already sent check
      if (r.last_sent_at) {
        const lastSentDate = new Date(r.last_sent_at);
        
        if (isDaily) {
          // Daily check: already sent today?
          const lastSentDayStr = getQatarDayStr(lastSentDate);
          if (lastSentDayStr === currentDayStr) {
            console.log(`  - Result: FAILED (Already sent today)`);
            return false;
          }
        } else {
          // Monthly check: already sent this month?
          const lastSentMonthStr = getQatarMonthStr(lastSentDate);
          if (lastSentMonthStr === currentMonthStr) {
            console.log(`  - Result: FAILED (Already sent this month)`);
            return false;
          }
        }
      }

      console.log(`  - Result: PASSED (Proceeding to send)`);
      return true
    }) || []

    console.log(`Recipients to process after filtering: ${filteredRecipients.length}`);

    const results = []

    for (const recipient of filteredRecipients) {
      try {
        // Fetch property and currency info
        const { data: property, error: propertyError } = await supabase.from('properties').select('name, logo_url').eq('id', recipient.property_id).single()
        if (propertyError) {
          console.error(`Error fetching property ${recipient.property_id}:`, propertyError);
        }
        console.log(`DEBUG: Fetched property: ${JSON.stringify(property)}`);
        const { data: currency } = await supabase.from('currencies').select('symbol').eq('id', 'default').single()
        const currencySymbol = currency?.symbol || '$'
        const propertyName = property?.name || 'Property'
        let logoUrl = property?.logo_url || null

        // Fetch and convert logo to base64 if it's a URL
        if (logoUrl && logoUrl.startsWith('http')) {
          try {
            const logoRes = await fetch(logoUrl)
            if (logoRes.ok) {
              const blob = await logoRes.blob()
              const reader = new FileReader()
              const base64Promise = new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result)
                reader.readAsDataURL(blob)
              })
              logoUrl = await base64Promise as string
            }
          } catch (e) {
            console.error('Error fetching logo:', e)
          }
        }

        // Fetch Outlet Name
        let outletName = 'All Outlets';
        if (recipient.outlet_id !== 'all') {
          const { data: outletData } = await supabase.from('outlets').select('name').eq('id', recipient.outlet_id).single();
          if (outletData) {
            outletName = outletData.name;
          }
        }

        // Determine report date (today or yesterday) relative to Qatar calendar
        const qatarYear = parseInt(getPart('year'));
        const qatarMonth = parseInt(getPart('month')) - 1; // 0-indexed
        const qatarDay = parseInt(getPart('day'));
        const reportDate = new Date(qatarYear, qatarMonth, qatarDay);

        if (recipient.report_date_type === 'yesterday') {
          reportDate.setDate(reportDate.getDate() - 1)
        } else if (recipient.report_type !== 'daily_sales') {
          // Monthly report: send for previous month
          reportDate.setMonth(reportDate.getMonth() - 1);
        }

        // Parse incentive_dept from recipient if available (for incentive reports)
        const incentiveDept = recipient.incentive_dept || 'Massage';
        const selectedMembershipTypeId = recipient.selected_membership_type_id || 'all';

        // Use shared logic to get data
        console.log(`DEBUG: Fetching data for ${recipient.report_type} (Property: ${recipient.property_id}, Outlet: ${recipient.outlet_id}, Dept: ${incentiveDept})`);
        const reportData = await getReportData({
          supabase,
          propertyId: recipient.property_id,
          outletId: recipient.outlet_id,
          reportType: recipient.report_type,
          date: reportDate,
          incentiveDept: incentiveDept,
          selectedMembershipTypeId: selectedMembershipTypeId
        })
        console.log(`DEBUG: Report Data rows: ${reportData.rows.length}`);

        // Use shared logic to generate PDF
        const reportTitles: Record<string, string> = {
          'daily_sales': 'Daily Sales & Revenue Report',
          'revenue_recognition': 'Revenue Recognition Audit',
          'members_joined': 'Membership Acquisition Log',
          'expiring_memberships': 'EXPIRING MEMBERSHIPS AUDIT',
          'massage_room_revenue': 'Massage Room Revenue Report',
          'incentives': `${incentiveDept} Incentive Audit`
        };
        const reportTitle = reportTitles[recipient.report_type] || recipient.report_type.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        
        const doc = generateReportPDF({
          jsPDF,
          data: reportData,
          propertyName,
          outletName,
          currencySymbol,
          reportTitle,
          date: reportDate,
          logoUrl,
          reportType: recipient.report_type
        })

        const pdfBase64 = doc.output('datauristring').split(',')[1]

        // Build dynamic summary text for email body
        let summaryListItems = '';
        if (reportData.summary) {
          summaryListItems = Object.entries(reportData.summary)
            .map(([key, value]) => {
              const label = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              let formattedValue = value;
              if (typeof value === 'number') {
                if (key.includes('revenue') || key.includes('amount') || key.includes('total') || key.includes('earned') || key.includes('deferred')) {
                  formattedValue = `${currencySymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                } else {
                  formattedValue = value.toLocaleString();
                }
              }
              return `<li><strong>${label}:</strong> ${formattedValue}</li>`;
            })
            .join('\n');
        }

        // Add staff totals for incentive reports
        let staffTotalsHtml = '';
        if (recipient.report_type === 'incentives' && reportData.rows.length > 0) {
          const staffTotals: Record<string, number> = {};
          reportData.rows.forEach((r: any) => {
            if (r.staff_name) {
              staffTotals[r.staff_name] = (staffTotals[r.staff_name] || 0) + (r.incentive || 0);
            }
          });

          if (Object.keys(staffTotals).length > 0) {
            staffTotalsHtml = `
              <div style="margin: 20px 0; padding: 15px; background: #fef3c7; border-radius: 6px; border: 1px solid #f59e0b;">
                <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #92400e;">Staff Incentive Breakdown</h3>
                <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 14px;">
                  ${Object.entries(staffTotals).map(([staffName, amount]) => {
                    return `<li><strong>${staffName}:</strong> ${currencySymbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>`;
                  }).join('\n')}
                </ul>
              </div>
            `;
          }
        }

        // Professional message for email body
        const professionalMessage = `
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            We are pleased to provide you with the latest ${reportTitle} for your review. 
            This automated report contains comprehensive data regarding the specified period.
          </p>
          <p style="color: #475569; font-size: 14px; line-height: 1.6;">
            Please find the detailed report attached as a PDF document. Should you require any further information or have questions regarding the data presented, please do not hesitate to contact our support team.
          </p>
        `;

        // Send email
        const emails = recipient.email ? recipient.email.split(',').map((e: string) => e.trim()) : [];
        console.log(`DEBUG: Sending email to ${emails.join(', ')} with PDF size: ${pdfBase64.length}`);
        
        const emailHtml = `
          <div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h2 style="color: #0f172a; margin-top: 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">${reportTitle}</h2>
            <p style="color: #475569;">Hello,</p>
            <p style="color: #475569;">This is an automated report from <strong>${appName}</strong>. Please find the details below.</p>
            
            <div style="margin: 20px 0; padding: 15px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0;">
              <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #0f172a;">Report Summary</h3>
              <ul style="margin: 0; padding-left: 20px; color: #334155; font-size: 14px;">
                <li><strong>Application:</strong> ${appName}</li>
                <li><strong>Property:</strong> ${propertyName}</li>
                <li><strong>Outlet:</strong> ${outletName}</li>
                <li><strong>Report Type:</strong> ${reportTitle}</li>
                <li><strong>Date:</strong> ${reportDate.toLocaleDateString()}</li>
                ${summaryListItems}
              </ul>
            </div>

            ${staffTotalsHtml}

            ${professionalMessage}
            
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="color: #94a3b8; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} ${propertyName}. All rights reserved.</p>
            <p style="color: #94a3b8; font-size: 10px; text-align: center;">Powered by ${appName}</p>
          </div>
        `;

        const { data: emailRes, error: emailError } = await resend.emails.send({
          from: `${appName} <${fromEmail}>`,
          to: emails,
          subject: `${reportTitle} - ${propertyName} - ${reportDate.toLocaleDateString()}`,
          html: emailHtml,
          attachments: [
            {
              filename: `${recipient.report_type}_report_${reportDate.toISOString().split('T')[0]}.pdf`,
              content: pdfBase64,
            },
          ],
        });
        
        if (emailError) {
          console.error(`DEBUG: Email sending error: ${JSON.stringify(emailError)}`);
          throw emailError;
        }
        console.log(`DEBUG: Email sent successfully. ID: ${emailRes?.id}`);

        // Update last_sent_at to prevent duplicate sends today, using the actual current timestamp
        // Only update if it's NOT a test send, so automated schedules can still run
        if (!isTest) {
          const { error: updateError } = await supabase.from('report_recipients').update({ last_sent_at: new Date().toISOString() }).eq('id', recipient.id)
          if (updateError) {
            console.error(`DEBUG: Error updating last_sent_at for ${recipient.email}:`, updateError);
          } else {
            console.log(`DEBUG: Updated last_sent_at for ${recipient.email}`);
          }
        } else {
          console.log(`DEBUG: Test mode - skipping last_sent_at update for ${recipient.email}`);
        }

        results.push({ recipient: recipient.email, status: 'success', id: emailRes?.id })

      } catch (err) {
        console.error(`Error sending to ${recipient.email}:`, err)
        results.push({ recipient: recipient.email, status: 'error', error: err.message })
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error('Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})