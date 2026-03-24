import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"
import { Resend } from "https://esm.sh/resend@3.1.0"
import { jsPDF } from "https://esm.sh/jspdf@2.5.1"
import autoTable from "https://esm.sh/jspdf-autotable@3.8.1"
import { getReportData, generateReportPDF } from "./reportLogic.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const resend = new Resend(Deno.env.get('RESEND_API_KEY'))
    const body = await req.json().catch(() => ({}))
    const isTest = body.test === true
    const testRecipientId = body.recipientId

    // Fetch company settings
    const { data: settings } = await supabase.from('company_settings').select('*').eq('id', 'global').maybeSingle()
    const appName = settings?.report_title || 'The Torch Reports'
    const fromEmail = Deno.env.get('EMAIL_FROM') || 'reports@resend.dev'

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
    const currentDayStr = `${parseInt(getPart('year'))}-${parseInt(getPart('month'))}-${parseInt(getPart('day'))}`;

    console.log(`Current Qatar Time: ${currentHour}:${currentMinute}, Day: ${currentDayStr}`);

    const filteredRecipients = recipients?.filter(r => {
      if (isTest) {
        console.log(`Recipient ${r.email}: Test mode enabled.`);
        return true;
      }
      if (!r.send_time) {
        console.log(`Recipient ${r.email}: No send_time set.`);
        return false;
      }
      const [h, m] = r.send_time.split(':').map(Number)
      
      // Scheduler Logic: Check if current time is at or after scheduled time, within 120 mins (in Qatar Time)
      const scheduledTotalMins = h * 60 + m
      const currentTotalMins = currentHour * 60 + currentMinute
      const diff = currentTotalMins - scheduledTotalMins
      
      console.log(`Recipient ${r.email}: Scheduled for ${r.send_time} (${scheduledTotalMins} mins), Current ${currentHour}:${currentMinute} (${currentTotalMins} mins), Diff: ${diff} mins`);

      if (diff < 0 || diff >= 120) {
        console.log(`Recipient ${r.email}: Outside window (must be 0-120 mins after scheduled time).`);
        return false;
      }

      // Check if already sent today (using Qatar calendar day)
      if (r.last_sent_at) {
        const lastSentParts = qatarFormatter.formatToParts(new Date(r.last_sent_at));
        const lastSentDayStr = `${parseInt(lastSentParts.find(p => p.type === 'year')?.value || '0')}-${parseInt(lastSentParts.find(p => p.type === 'month')?.value || '0')}-${parseInt(lastSentParts.find(p => p.type === 'day')?.value || '0')}`;
        
        console.log(`Recipient ${r.email}: Last sent at ${r.last_sent_at} (Day: ${lastSentDayStr}), Current Day: ${currentDayStr}`);
        if (lastSentDayStr === currentDayStr) {
          console.log(`Recipient ${r.email}: Already sent today.`);
          return false;
        }
      }

      console.log(`Recipient ${r.email}: Passed all filters. Proceeding to send.`);
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
        }

        // Use shared logic to get data
        const reportData = await getReportData({
          supabase,
          propertyId: recipient.property_id,
          outletId: recipient.outlet_id,
          reportType: recipient.report_type,
          date: reportDate
        })

        // Use shared logic to generate PDF
        const reportTitles: Record<string, string> = {
          'daily_sales': 'Daily Sales & Revenue Report',
          'revenue_recognition': 'Revenue Recognition Audit',
          'members_joined': 'Membership Acquisition Log',
          'expiring_memberships': 'Membership Retention Audit'
        };
        const reportTitle = reportTitles[recipient.report_type] || recipient.report_type.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        
        const doc = generateReportPDF({
          jsPDF,
          autoTable,
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
              const formattedValue = typeof value === 'number' ? 
                (key.includes('revenue') || key.includes('amount') || key.includes('total') ? 
                  `${currencySymbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 
                  value.toLocaleString()) : 
                value;
              return `<li><strong>${label}:</strong> ${formattedValue}</li>`;
            })
            .join('\n');
        }

        // Send email
        const emails = recipient.email ? recipient.email.split(',').map((e: string) => e.trim()) : [];
        const { data: emailRes, error: emailError } = await resend.emails.send({
          from: `${appName} <${fromEmail}>`,
          to: emails,
          subject: `${reportTitle} - ${propertyName} - ${reportDate.toLocaleDateString()}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
              <h2 style="color: #0f172a; margin-top: 0;">${reportTitle}</h2>
              <p style="color: #475569;">Hello,</p>
              <p style="color: #475569;">This is an automated report from <strong>${appName}</strong>. Please find the details below.</p>
              
              <div style="margin: 20px 0; padding: 15px; background: #f8fafc; border-radius: 6px;">
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

              <p style="color: #475569; font-size: 14px;">The full report is attached as a PDF for your review.</p>
              
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="color: #94a3b8; font-size: 12px; text-align: center;">&copy; ${new Date().getFullYear()} ${propertyName}. All rights reserved.</p>
              <p style="color: #94a3b8; font-size: 10px; text-align: center;">Powered by ${appName}</p>
            </div>
          `,
          attachments: [
            {
              filename: `${recipient.report_type}_report_${reportDate.toISOString().split('T')[0]}.pdf`,
              content: pdfBase64,
            },
          ],
        })

        if (emailError) throw emailError

        // Update last_sent_at to prevent duplicate sends today
        if (!isTest) {
          await supabase.from('report_recipients').update({ last_sent_at: new Date().toISOString() }).eq('id', recipient.id)
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
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
