import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7"
import { Resend } from "https://esm.sh/resend@3.1.0"
import jsPDF from "https://esm.sh/jspdf@2.5.1"
import autoTable from "https://esm.sh/jspdf-autotable@5.0.7"
import { getReportData, generateReportPDF, getReportTitle } from "./reportLogic.ts"

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

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    console.log(`DEBUG: Resend API Key present: ${!!resendApiKey}`);
    const resend = new Resend(resendApiKey)
    const body = await req.json().catch(() => ({}))
    const isTest = body.test === true
    const testRecipientId = body.recipientId
    console.log(`DEBUG: Request params - isTest: ${isTest}, testRecipientId: ${testRecipientId}`);

    // Explicitly patch jsPDF with autoTable for the Edge Function environment
    try {
      const JsPDFConstructor = (jsPDF as any).jsPDF || (jsPDF as any).default || jsPDF;
      const plugin = (autoTable as any).default || autoTable;
      
      console.log(`DEBUG: JsPDFConstructor type: ${typeof JsPDFConstructor}`);
      console.log(`DEBUG: autoTable plugin type: ${typeof plugin}`);

      if (typeof plugin === 'function') {
        // Try standard patching
        try {
          plugin(JsPDFConstructor);
          console.log("DEBUG: jsPDF patched with plugin(JsPDFConstructor)");
        } catch (e) {
          console.warn("DEBUG: plugin(JsPDFConstructor) failed:", e.message);
        }

        // Try applyPlugin if it exists
        if (typeof (autoTable as any).applyPlugin === 'function') {
          try {
            (autoTable as any).applyPlugin(JsPDFConstructor);
            console.log("DEBUG: jsPDF patched with applyPlugin");
          } catch (e) {
            console.warn("DEBUG: applyPlugin failed:", e.message);
          }
        }
        
        // Manual prototype patching as a fallback
        if (JsPDFConstructor.prototype && typeof JsPDFConstructor.prototype.autoTable !== 'function') {
          JsPDFConstructor.prototype.autoTable = function(options: any) {
            return plugin(this, options);
          };
          console.log("DEBUG: jsPDF.prototype.autoTable manually patched");
        }

        // Also try patching the global if it exists
        if (typeof (globalThis as any).jsPDF === 'undefined') {
          (globalThis as any).jsPDF = JsPDFConstructor;
        }
      } else {
        console.warn("DEBUG: autoTable plugin is not a function, skipping patch");
      }
    } catch (e) {
      console.error("DEBUG: Error patching jsPDF with autoTable:", e);
    }

    // Fetch company settings
    const { data: settings } = await supabase.from('company_settings').select('*').eq('id', 'global').maybeSingle()
    const appName = settings?.report_title || 'Health Club Management'
    const fromEmail = Deno.env.get('EMAIL_FROM') || 'noreply@saavargroup.com'

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
      hourCycle: 'h23'
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
        // Fallback for 24h format if no AM/PM
        [h, m] = timeStr.split(':').map(Number);
      }
      
      const scheduledTotalMins = h * 60 + m
      const currentTotalMins = currentHour * 60 + currentMinute
      
      // Handle day wrap-around (e.g., scheduled at 23:45, runs at 00:00)
      const diff = (currentTotalMins - scheduledTotalMins + 1440) % 1440
      
      console.log(`[DEBUG] Recipient ${r.email}:`);
      console.log(`  - Scheduled: ${r.send_time} (Parsed: ${h}:${m}, ${scheduledTotalMins} mins)`);
      console.log(`  - Current Qatar Time: ${currentHour}:${currentMinute} (${currentTotalMins} mins)`);
      console.log(`  - Diff: ${diff} mins`);
      console.log(`  - isDaily: ${isDaily}`);
      console.log(`  - currentDay: ${currentDay}`);
      console.log(`  - r.last_sent_at: ${r.last_sent_at}`);

      // Allow a wider window to ensure it triggers (up to 60 mins for hourly cron jobs)
      if (diff > 60) {
        console.log(`  - Result: FAILED (Outside window: 0 to 60 mins)`);
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

    // Group recipients by unique report parameters to avoid redundant data fetching
    const reportGroups: Record<string, { 
      recipients: any[], 
      params: any 
    }> = {};

    filteredRecipients.forEach(recipient => {
      const incentiveDept = recipient.incentive_dept || 'Massage';
      const selectedMembershipTypeId = recipient.selected_membership_type_id || 'all';
      
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

      const key = `${recipient.property_id}|${recipient.outlet_id}|${recipient.report_type}|${reportDate.toISOString()}|${incentiveDept}|${selectedMembershipTypeId}`;
      
      if (!reportGroups[key]) {
        reportGroups[key] = {
          recipients: [],
          params: {
            propertyId: recipient.property_id,
            outletId: recipient.outlet_id,
            reportType: recipient.report_type,
            date: reportDate,
            incentiveDept,
            selectedMembershipTypeId
          }
        };
      }
      reportGroups[key].recipients.push(recipient);
    });

    const results: any[] = [];

    // Helper function to format currency for email
    const formatCurrency = (val: number, symbol: string) => {
      const formatted = val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `${symbol} ${formatted}`;
    };

    // Common styles
    const tableStyle = "width: 100%; border-collapse: collapse; font-size: 13px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin-bottom: 20px;";
    const headerStyle = "background: #0f172a; color: white; font-weight: bold; padding: 12px 8px; border: 1px solid #cbd5e1; text-align: left;";
    const cellStyle = "padding: 8px; border: 1px solid #cbd5e1; color: #334155; text-align: left;";
    const numericCellStyle = "padding: 8px; border: 1px solid #cbd5e1; color: #334155; text-align: right;";
    const headerNumericStyle = "background: #0f172a; color: white; font-weight: bold; padding: 12px 8px; border: 1px solid #cbd5e1; text-align: right;";

    for (const group of Object.values(reportGroups)) {
      try {
        const { params, recipients } = group;
        
        console.log(`DEBUG: Processing group for ${params.reportType} (Property: ${params.propertyId}, Outlet: ${params.outletId})`);
        
        // Fetch data once for the entire group
        const reportData = await getReportData({
          supabase,
          propertyId: params.propertyId,
          outletId: params.outletId,
          reportType: params.reportType,
          date: params.date,
          incentiveDept: params.incentiveDept,
          selectedMembershipTypeId: params.selectedMembershipTypeId
        });
        
        console.log(`DEBUG: Report Data rows: ${reportData.rows.length}`);

        // Fetch property and currency info (once per group)
        const { data: property, error: propertyError } = await supabase.from('properties').select('name, logo_url, signatory_config').eq('id', params.propertyId).single()
        if (propertyError) {
          console.error(`Error fetching property ${params.propertyId}:`, propertyError);
        }
        
        // Fetch outlet specific signatory config
        let outletSignatoryConfig = null;
        if (params.outletId !== 'all') {
          const { data: outletData } = await supabase.from('outlets').select('signatory_config').eq('id', params.outletId).single();
          if (outletData) {
            outletSignatoryConfig = outletData.signatory_config;
          }
        }
        
        let currencySymbol = '$';
        let currencyCode = 'USD';
        if (settings?.currency_id) {
          const { data: currency } = await supabase.from('currencies').select('symbol, code').eq('id', settings.currency_id).single();
          if (currency?.symbol) currencySymbol = currency.symbol;
          if (currency?.code) currencyCode = currency.code;
        } else {
          const { data: currency } = await supabase.from('currencies').select('symbol, code').eq('is_default', true).limit(1).maybeSingle();
          if (currency?.symbol) currencySymbol = currency.symbol;
          if (currency?.code) currencyCode = currency.code;
        }
        const propertyName = property?.name || 'Property'
        let logoUrl = property?.logo_url || null

        // Fetch and convert logo to base64 if it's a URL
        if (logoUrl && logoUrl.startsWith('http')) {
          try {
            const logoRes = await fetch(logoUrl)
            if (logoRes.ok) {
              const arrayBuffer = await logoRes.arrayBuffer();
              const uint8Array = new Uint8Array(arrayBuffer);
              let binary = '';
              const len = uint8Array.byteLength;
              for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(uint8Array[i]);
              }
              const base64 = btoa(binary);
              logoUrl = `data:${logoRes.headers.get('content-type') || 'image/png'};base64,${base64}`;
            }
          } catch (e) {
            console.error('Error fetching logo:', e)
          }
        }

        // Fetch Outlet Name
        let outletName = 'All Outlets';
        if (params.outletId !== 'all') {
          const { data: outletData } = await supabase.from('outlets').select('name').eq('id', params.outletId).single();
          if (outletData) {
            outletName = outletData.name;
          }
        }

        const reportTitle = getReportTitle(params.reportType, params.incentiveDept);
        
        // Generate PDF once for the group
        const doc = generateReportPDF({
          jsPDF,
          autoTable,
          data: reportData,
          propertyName,
          outletName,
          currencySymbol,
          currencyCode,
          reportTitle,
          date: params.date,
          logoUrl,
          reportType: params.reportType
        });

        const pdfBase64 = doc.output('datauristring').split(',')[1];

        // Helper function to get signatory config hierarchy
        const getSignatoryConfig = () => {
          const resolveConfig = (config: any, type: string) => {
            if (!config) return null;
            const specific = config[type];
            if (!specific) return null;
            return {
              prepared: specific.prepared || 'Accountant',
              reviewed: specific.reviewed || '',
              approved: specific.approved || 'General Manager'
            };
          };
          
          // Hierarchy: Outlet Specific -> Property Specific -> Global
          const outletRes = resolveConfig(outletSignatoryConfig, params.reportType);
          if (outletRes) return outletRes;
          
          const propertyRes = resolveConfig(property?.signatory_config, params.reportType);
          if (propertyRes) return propertyRes;
          
          const globalRes = resolveConfig(settings?.signatory_config, params.reportType);
          if (globalRes) return globalRes;
          
          return null;
        };
        
        const signatoryConfig = getSignatoryConfig();
        
        // Build summary list items
        let summaryListItems = '';
        if (reportData.summary) {
          summaryListItems = Object.entries(reportData.summary)
            .filter(([key]) => !['staffList', 'count', 'rooms'].includes(key))
            .map(([key, value]) => {
              const label = key.split(/(?=[A-Z])/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              let formattedValue = value;
              if (typeof value === 'number') {
                if (key.toLowerCase().includes('revenue') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('total') || key.toLowerCase().includes('earned') || key.toLowerCase().includes('deferred') || key.toLowerCase().includes('gross') || key.toLowerCase().includes('discount') || key.toLowerCase().includes('net')) {
                  formattedValue = formatCurrency(value, currencySymbol);
                } else {
                  formattedValue = value.toLocaleString();
                }
              }
              return `
                <tr>
                  <td align="left" style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 500;">${label}</td>
                  <td align="right" style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${formattedValue}</td>
                </tr>`;
            })
            .join('\n');
        }

        // Build HTML Table for email body
        let tableHtml = '';
        if (reportData.rows && reportData.rows.length > 0) {
          let headers: string[] = [];
          if (params.reportType === 'daily_sales') {
            headers = ['SL.NO.', 'DATE', 'GUEST / MEMBER', 'DURATION', 'CHECK NO.', 'PAYMENT MODE', 'ITEM / SERVICE', 'GROSS AMOUNT', 'DISC %', 'DISCOUNT AMT', 'NET REVENUE'];
          } else if (params.reportType === 'revenue_recognition') {
            headers = ['SL.NO.', 'GUEST / MEMBER', 'MEMBERSHIP NO.', 'START DATE', 'END DATE', 'DAYS', 'ACTUAL RATE', 'DAILY RATE', 'DISCOUNT', 'NET FEES', 'PREV. ACCRUAL', 'PERIOD REV', 'DEFERRED'];
          } else if (params.reportType === 'members_joined') {
            headers = ['SL.NO.', 'DATE', 'GUEST / MEMBER', 'CATEGORY', 'CHECK NO.', 'ITEM / SERVICE', 'GROSS AMOUNT', 'DISC %', 'DISCOUNT AMT', 'NET REVENUE'];
          } else if (params.reportType === 'expiring_memberships') {
            headers = ['SL.NO.', 'GUEST / MEMBER', 'MEMBERSHIP NO.', 'CATEGORY', 'START DATE', 'END DATE', 'DAYS LEFT', 'STATUS'];
          } else if (params.reportType === 'massage_room_revenue') {
            headers = ['DATE', 'ROOM', 'REVENUE'];
          } else if (params.reportType === 'monthly_revenue') {
            headers = ['CATEGORY', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'TOTAL'];
          } else {
            headers = ['SL.NO.', 'DATE', 'GUEST / MEMBER', 'ITEM / SERVICE', 'NET REVENUE'];
          }

          tableHtml = `
            <div style="margin: 30px 0; overflow-x: auto;">
              <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">Detailed Report Data</h3>
              <table width="100%" cellpadding="8" cellspacing="0" border="1" style="border-collapse: collapse; border-color: #e2e8f0; font-size: 12px; text-align: left;">
                <thead>
                  <tr style="background-color: #f8fafc; color: #0f172a;">
                    ${headers.map(h => `<th style="padding: 8px; border: 1px solid #e2e8f0;">${h}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${reportData.rows.map((r: any, idx: number) => {
                    let cells: string[] = [];
                    if (params.reportType === 'daily_sales') {
                      cells = [
                        (idx + 1).toString(),
                        r.date || '',
                        r.guest_name || '',
                        r.duration || '-',
                        r.check_no || '',
                        r.mode_of_payment || '',
                        r.item_name || '',
                        formatCurrency(r.actual_price, currencySymbol),
                        r.discount_percent > 0 ? \`\${r.discount_percent.toFixed(0)}%\` : '',
                        formatCurrency(r.discount_amount, currencySymbol),
                        formatCurrency(r.net_revenue, currencySymbol)
                      ];
                    } else if (params.reportType === 'revenue_recognition') {
                      cells = [
                        (idx + 1).toString(),
                        r.guest_name || '',
                        r.membership_no || '',
                        r.start_date || '',
                        r.end_date || '',
                        (r.total_days || 0).toString(),
                        formatCurrency(r.actual_rate, currencySymbol),
                        formatCurrency(r.daily_rate, currencySymbol),
                        formatCurrency(r.discount, currencySymbol),
                        formatCurrency(r.net_fees, currencySymbol),
                        formatCurrency(r.prev_accrual, currencySymbol),
                        formatCurrency(r.period_rev, currencySymbol),
                        formatCurrency(r.deferred, currencySymbol)
                      ];
                    } else if (params.reportType === 'members_joined') {
                      cells = [
                        (idx + 1).toString(),
                        r.date || '',
                        r.name || '',
                        r.category || '',
                        r.check_no || '',
                        r.item || '',
                        formatCurrency(r.gross, currencySymbol),
                        r.discount_percent > 0 ? \`\${r.discount_percent.toFixed(0)}%\` : '',
                        formatCurrency(r.discount_amt, currencySymbol),
                        formatCurrency(r.net, currencySymbol)
                      ];
                    } else if (params.reportType === 'expiring_memberships') {
                      cells = [
                        (idx + 1).toString(),
                        r.guest_name || '',
                        r.membership_no || '',
                        r.category_name || '',
                        r.start_date || '',
                        r.end_date || '',
                        (r.days_left || 0).toString(),
                        r.status || ''
                      ];
                    } else if (params.reportType === 'massage_room_revenue') {
                      cells = [
                        r.date || '',
                        r.room_name || 'Unassigned',
                        formatCurrency(r.revenue, currencySymbol)
                      ];
                    } else if (params.reportType === 'monthly_revenue') {
                      cells = [
                        r.category || '',
                        ...(r.values || []).map((v: number) => v > 0 ? formatCurrency(v, currencySymbol) : '-'),
                        formatCurrency(r.total, currencySymbol)
                      ];
                    } else {
                        cells = [
                            (idx + 1).toString(),
                            r.date || '',
                            r.guest_name || '',
                            r.item_name || '',
                            formatCurrency(r.net_revenue || r.net || 0, currencySymbol)
                        ];
                    }
                    return \`<tr>\${cells.map(c => \`<td style="padding: 8px; border: 1px solid #e2e8f0;">\${c}</td>\`).join('')}</tr>\`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          `;
        }

        // Professional message for email body
        const professionalMessage = `
          <div style="color: #475569; font-size: 14px; line-height: 1.6; margin: 20px 0; padding: 20px; background: #f8fafc; border-left: 4px solid #0f172a; border-radius: 8px;">
            <p style="margin-top: 0;">Please find the detailed <strong>${reportTitle}</strong> attached as a PDF document.</p>
            <p style="margin-bottom: 0;">If you require further analysis or have any questions regarding this data, please contact the finance department.</p>
          </div>
        `;


        // Process each recipient in the group
        await Promise.all(recipients.map(async (recipient) => {
          try {
            // Send email
            const emails = recipient.email ? recipient.email.split(',').map((e: string) => e.trim()) : [];
            
            const emailHtml = `
              <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 1200px; margin: 0 auto; padding: 40px 20px; background: #f1f5f9;">
                <div style="background: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px;">
                    <tr>
                      <td align="left" valign="top">
                        <h1 style="color: #0f172a; margin: 0; font-size: 24px; letter-spacing: -0.025em;">${reportTitle}</h1>
                        <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">${propertyName} • ${outletName}</p>
                      </td>
                      <td align="right" valign="top">
                        <p style="color: #64748b; margin: 0; font-size: 12px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Report Date</p>
                        <p style="color: #0f172a; margin: 0; font-size: 16px; font-weight: 600;">${params.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </td>
                    </tr>
                  </table>

                  <p style="color: #475569; font-size: 16px;">Hello,</p>
                  
                  <div style="margin: 30px 0; padding: 25px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
                    <h3 style="margin: 0 0 15px 0; font-size: 18px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 10px;">Executive Summary</h3>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 10px;">
                      ${summaryListItems}
                    </table>
                  </div>

                  ${professionalMessage}
                  
                  ${tableHtml}
                  
                  ${signatoryConfig ? `
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top: 40px;">
                    <tr>
                      <td width="${signatoryConfig.reviewed ? '33%' : '50%'}" align="center" valign="top" style="padding-right: 10px;">
                        <div style="border-top: 1px solid #0f172a; margin-bottom: 10px; width: 80%; margin-left: auto; margin-right: auto;"></div>
                        <p style="font-weight: bold; margin: 0; color: #0f172a; font-size: 14px;">Prepared By:</p>
                        <p style="color: #64748b; margin: 5px 0 0; font-size: 14px;">${signatoryConfig.prepared}</p>
                      </td>
                      ${signatoryConfig.reviewed ? `
                      <td width="33%" align="center" valign="top" style="padding-left: 10px; padding-right: 10px;">
                        <div style="border-top: 1px solid #0f172a; margin-bottom: 10px; width: 80%; margin-left: auto; margin-right: auto;"></div>
                        <p style="font-weight: bold; margin: 0; color: #0f172a; font-size: 14px;">Reviewed By:</p>
                        <p style="color: #64748b; margin: 5px 0 0; font-size: 14px;">${signatoryConfig.reviewed}</p>
                      </td>
                      ` : ''}
                      <td width="${signatoryConfig.reviewed ? '33%' : '50%'}" align="center" valign="top" style="padding-left: 10px;">
                        <div style="border-top: 1px solid #0f172a; margin-bottom: 10px; width: 80%; margin-left: auto; margin-right: auto;"></div>
                        <p style="font-weight: bold; margin: 0; color: #0f172a; font-size: 14px;">Approved By:</p>
                        <p style="color: #64748b; margin: 5px 0 0; font-size: 14px;">${signatoryConfig.approved}</p>
                      </td>
                    </tr>
                  </table>
                  ` : ''}
                  
                  <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #f1f5f9; text-align: center;">
                    <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} ${propertyName}. All rights reserved.</p>
                    <p style="color: #94a3b8; font-size: 10px; margin: 5px 0 0 0;">Powered by ${appName} • Automated Audit System</p>
                  </div>
                </div>
              </div>
            `;

            console.log(`DEBUG: Attempting to send email to ${emails.join(', ')} from ${fromEmail}`);
            
            const { data: emailRes, error: emailError } = await resend.emails.send({
              from: `${appName} <${fromEmail}>`,
              to: emails,
              subject: `${reportTitle} - ${propertyName} - ${params.date.toLocaleDateString()}`,
              html: emailHtml,
              attachments: [
                {
                  filename: `${recipient.report_type}_report_${params.date.toISOString().split('T')[0]}.pdf`,
                  content: pdfBase64,
                },
              ],
            });
            
            if (emailError) {
              console.error(`DEBUG: Email sending error for ${recipient.email}:`, JSON.stringify(emailError, null, 2));
              throw new Error(`Resend Error: ${emailError.message || JSON.stringify(emailError)}`);
            }
            console.log(`DEBUG: Email sent successfully to ${recipient.email}. ID: ${emailRes?.id}`);

            // Update last_sent_at
            if (!isTest) {
              await supabase.from('report_recipients').update({ last_sent_at: new Date().toISOString() }).eq('id', recipient.id);
            }

            results.push({ recipient: recipient.email, status: 'success', id: emailRes?.id });
          } catch (err: any) {
            console.error(`Error sending to ${recipient.email}:`, err);
            results.push({ recipient: recipient.email, status: 'error', error: err.message });
          }
        }));
      } catch (err: any) {
        console.error(`Error processing group:`, err);
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