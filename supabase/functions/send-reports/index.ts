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

    const now = new Date()
    const currentHour = now.getUTCHours()
    const currentMinute = now.getUTCMinutes()

    const filteredRecipients = recipients?.filter(r => {
      if (isTest) return true
      if (!r.send_time) return false
      const [h, m] = r.send_time.split(':').map(Number)
      
      // Scheduler Logic: Check if current time is within 30 mins of scheduled time
      // AND check if it was already sent today
      const scheduledTotalMins = h * 60 + m
      const currentTotalMins = currentHour * 60 + currentMinute
      const diff = Math.abs(scheduledTotalMins - currentTotalMins)
      
      if (diff >= 30) return false

      // Check if already sent today (UTC)
      if (r.last_sent_at) {
        const lastSent = new Date(r.last_sent_at)
        const isSameDay = lastSent.getUTCFullYear() === now.getUTCFullYear() &&
                         lastSent.getUTCMonth() === now.getUTCMonth() &&
                         lastSent.getUTCDate() === now.getUTCDate()
        if (isSameDay) return false
      }

      return true
    }) || []

    const results = []

    for (const recipient of filteredRecipients) {
      try {
        // Fetch property and currency info
        const { data: property } = await supabase.from('properties').select('name, currency_id').eq('id', recipient.property_id).single()
        const { data: currency } = await supabase.from('currencies').select('symbol').eq('id', property?.currency_id || 'default').single()
        const currencySymbol = currency?.symbol || '$'
        const propertyName = property?.name || 'Property'

        // Fetch Outlet Name
        let outletName = 'All Outlets';
        if (recipient.outlet_id !== 'all') {
          const { data: outletData } = await supabase.from('outlets').select('name').eq('id', recipient.outlet_id).single();
          if (outletData) {
            outletName = outletData.name;
          }
        }

        // Determine report date (yesterday for daily reports)
        const reportDate = new Date()
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
          date: reportDate
        })

        const pdfBase64 = doc.output('datauristring').split(',')[1]

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
