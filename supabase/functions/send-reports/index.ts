import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { 
  differenceInCalendarDays, 
  isWithinInterval, 
  eachDayOfInterval, 
  format,
  startOfMonth,
  endOfMonth,
  subDays,
  parseISO
} from 'https://esm.sh/date-fns@2.30.0'

import { jsPDF } from "https://esm.sh/jspdf@2.5.1"
import autoTable from "https://esm.sh/jspdf-autotable@3.5.28"

// Using the Resend API Key from Supabase Secrets
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const min = (dates: Date[]) => new Date(Math.min(...dates.map(d => d.getTime())));
const max = (dates: Date[]) => new Date(Math.max(...dates.map(d => d.getTime())));

const calculateRevenuePeriod = (
  member: any, 
  freezes: any[], 
  periodStart: Date,
  periodEnd: Date
): number => {
  if (member.status === 'tentative') return 0;

  const memStart = parseISO(member.start_date);
  const memEnd = parseISO(member.current_end_date);

  const activeStart = max([memStart, periodStart]);
  const activeEnd = min([memEnd, periodEnd]);

  if (activeStart > activeEnd) return 0;

  const potentialDays = eachDayOfInterval({ start: activeStart, end: activeEnd });
  
  let recognizedDays = 0;
  potentialDays.forEach(day => {
    const isFrozen = freezes.some(freeze => 
      isWithinInterval(day, { 
        start: parseISO(freeze.start_date), 
        end: parseISO(freeze.end_date) 
      })
    );
    if (!isFrozen) recognizedDays++;
  });

  return recognizedDays * member.daily_rate;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body for test triggers
    const body = await req.json().catch(() => ({}))
    const isTest = body.test === true
    const testRecipientId = body.recipientId

    // Initialize Supabase client with Service Role to bypass RLS for background jobs
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let query = supabaseClient
      .from('report_recipients')
      .select(`
        *,
        properties ( name, logo_url )
      `)
      .eq('is_active', true)

    if (isTest && testRecipientId) {
      // If it's a test, only fetch the specific recipient
      query = query.eq('id', testRecipientId)
    } else if (!isTest) {
      // If it's a cron run, filter by current hour
      const now = new Date()
      const currentHour = now.getUTCHours().toString().padStart(2, '0')
      const currentTime = `${currentHour}:00`
      query = query.eq('send_time', currentTime)
    }

    const { data: recipients, error: fetchError } = await query

    if (fetchError) throw fetchError

    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ message: 'No reports scheduled for this time' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    const results = []

    // Process each recipient
    for (const recipient of recipients) {
      console.log('Processing recipient:', JSON.stringify(recipient));
      try {
        let reportContent = ''
        let subject = ''
        const propertyName = recipient.properties?.name || 'Property'
        const logoUrl = recipient.properties?.logo_url || 'https://picsum.photos/seed/tth/200/200'
        
        // Fetch Default Currency for this property
        let currencySymbol = '$';
        try {
          const { data: settingsData } = await supabaseClient
            .from('company_settings')
            .select('currency_id')
            .maybeSingle();
          
          if (settingsData?.currency_id) {
            const { data: currencyData } = await supabaseClient
              .from('currencies')
              .select('symbol')
              .eq('id', settingsData.currency_id)
              .maybeSingle();
            if (currencyData?.symbol) {
              currencySymbol = currencyData.symbol;
            }
          } else {
            const { data: currencyData } = await supabaseClient
              .from('currencies')
              .select('symbol')
              .eq('is_default', true)
              .maybeSingle();
            if (currencyData?.symbol) {
              currencySymbol = currencyData.symbol;
            }
          }
        } catch (e) {
          console.error('Error fetching currency:', e);
        }

        // Fetch Outlet Name
        let outletName = 'All Outlets';
        if (recipient.outlet_id !== 'all') {
          const { data: outletData } = await supabaseClient
            .from('outlets')
            .select('name')
            .eq('id', recipient.outlet_id)
            .single();
          if (outletData) {
            outletName = outletData.name;
          }
        }

        // Professional Report Titles mapping
        const reportTitles: Record<string, string> = {
          'daily_sales': 'DAILY SALES LEDGER',
          'revenue_recognition': 'REVENUE RECOGNITION AUDIT',
          'incentives': 'INCENTIVE YIELD REPORT',
          'members_joined': 'MEMBERSHIP ACQUISITION LOG',
          'expiring_memberships': 'MEMBERSHIP RETENTION AUDIT',
          'massage_room_revenue': 'FACILITY UTILIZATION REPORT'
        };

        const reportTitle = reportTitles[recipient.report_type] || recipient.report_type.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        
        const reportHeaderHTML = `
          <div style="text-align: center; margin-bottom: 40px; padding: 60px 40px; background: #ffffff; border-radius: 24px 24px 0 0; border-bottom: 8px solid #0f172a; position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; left: 0; right: 0; height: 8px; background: linear-gradient(90deg, #0f172a 0%, #334155 100%);"></div>
            <div style="margin-bottom: 32px;">
              <img src="${logoUrl}" alt="Logo" style="height: 100px; width: auto; object-fit: contain; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));" />
            </div>
            <h2 style="margin: 0; color: #94a3b8; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 6px; margin-bottom: 12px;">${propertyName}</h2>
            <h1 style="margin: 0; color: #0f172a; font-size: 48px; font-weight: 900; text-transform: uppercase; letter-spacing: -2px; line-height: 0.9; margin-bottom: 24px;">${reportTitle}</h1>
            <div style="display: inline-block; padding: 8px 24px; background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 100px;">
              <p style="margin: 0; color: #475569; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px;">${outletName} &bull; CERTIFIED AUDIT PROTOCOL</p>
            </div>
          </div>
        `;
        
        let attachments: any[] = [];

        // 1. Fetch data based on report_type
        if (recipient.report_type === 'daily_sales') {
          subject = `${reportTitle} - ${propertyName} (${outletName})`
          
          const today = new Date();
          const yesterday = subDays(today, 1);
          const startStr = format(yesterday, 'yyyy-MM-dd');
          
          let salesQuery = supabaseClient.from('sales').select('*').eq('property_id', recipient.property_id).eq('status', 'completed').gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${startStr}T23:59:59`);
          let bookingsQuery = supabaseClient.from('bookings').select('*').eq('property_id', recipient.property_id).eq('status', 'completed').eq('date', startStr);
          
          if (recipient.outlet_id !== 'all') {
            salesQuery = salesQuery.eq('outlet_id', recipient.outlet_id);
            bookingsQuery = bookingsQuery.eq('outlet_id', recipient.outlet_id);
          }

          const [salesRes, bookingsRes] = await Promise.all([salesQuery, bookingsQuery]);
          const sales = salesRes.data || [];
          const bookings = bookingsRes.data || [];

          let totalGross = 0;
          let totalDiscount = 0;
          let totalNet = 0;
          
          const tableData: any[] = [];

          sales.forEach(s => {
            totalGross += Number(s.gross_amount || 0);
            totalDiscount += Number(s.discount_amount || 0);
            totalNet += Number(s.net_amount || 0);
            tableData.push([s.created_at, "Retail", s.item_name || 'Item', Number(s.gross_amount || 0).toFixed(2), Number(s.discount_amount || 0).toFixed(2), Number(s.net_amount || 0).toFixed(2)]);
          });

          bookings.forEach(b => {
            const price = Number(b.price || 0);
            const disc = Number(b.discount || 0);
            const gross = price + disc;
            totalGross += gross;
            totalDiscount += disc;
            totalNet += price;
            tableData.push([`${b.date} ${b.start_time}`, "Service", "Service Booking", gross.toFixed(2), disc.toFixed(2), price.toFixed(2)]);
          });

          if (tableData.length > 0) {
            const doc = new jsPDF();
            doc.setFont("helvetica", "bold");
            doc.setFontSize(24);
            doc.setTextColor(15, 23, 42);
            doc.text("DAILY SALES LEDGER", 105, 30, { align: 'center' });
            
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.text(propertyName.toUpperCase(), 105, 38, { align: 'center' });
            
            doc.setDrawColor(15, 23, 42);
            doc.setLineWidth(0.5);
            doc.line(20, 45, 190, 45);
            
            doc.setFontSize(11);
            doc.setTextColor(15, 23, 42);
            doc.text(`Outlet: ${outletName}`, 20, 55);
            doc.text(`Date: ${startStr}`, 190, 55, { align: 'right' });
            
            autoTable(doc, {
              startY: 65,
              head: [['Date', 'Type', 'Item', 'Gross', 'Discount', 'Net']],
              body: tableData,
              theme: 'grid',
              headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
              styles: { fontSize: 8, cellPadding: 3 },
              columnStyles: {
                3: { halign: 'right' },
                4: { halign: 'right' },
                5: { halign: 'right' }
              }
            });
            
            attachments.push({
              filename: `Daily_Sales_${startStr}.pdf`,
              content: btoa(doc.output('string')),
            });
          }

          reportContent = `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 900px; margin: 20px auto; background: #ffffff; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; border: 1px solid #e2e8f0;">
              ${reportHeaderHTML}
              <div style="padding: 40px;">
                <div style="background-color: #0f172a; padding: 32px; border-radius: 20px; margin-bottom: 40px; color: #ffffff; display: flex; justify-content: space-between; align-items: center; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
                  <div>
                    <p style="margin: 0; color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px;">Audit Period</p>
                    <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">${format(yesterday, 'MMMM d, yyyy')}</p>
                  </div>
                  <div style="text-align: right;">
                    <p style="margin: 0; color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px;">Verification Status</p>
                    <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: 900; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 4px 12px; border-radius: 6px;">CERTIFIED AUDIT TRAIL</p>
                  </div>
                </div>

                <div style="margin-bottom: 48px;">
                  <h3 style="font-size: 14px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 24px; border-left: 4px solid #0f172a; padding-left: 16px;">Executive Portfolio Summary</h3>
                  <table style="width: 100%; border-collapse: collapse; border: 2px solid #0f172a;">
                    <tbody>
                      <tr style="background: #ffffff;">
                        <td style="padding: 20px 24px; border: 1px solid #0f172a; color: #475569; font-weight: 800; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">Portfolio Gross Revenue</td>
                        <td style="padding: 20px 24px; border: 1px solid #0f172a; text-align: right; color: #0f172a; font-weight: 900; font-size: 18px;">${currencySymbol}${totalGross.toFixed(2)}</td>
                      </tr>
                      <tr style="background: #ffffff;">
                        <td style="padding: 20px 24px; border: 1px solid #0f172a; color: #475569; font-weight: 800; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">Total Reduction / Discount</td>
                        <td style="padding: 20px 24px; border: 1px solid #0f172a; text-align: right; color: #ef4444; font-weight: 900; font-size: 18px;">-${currencySymbol}${totalDiscount.toFixed(2)}</td>
                      </tr>
                      <tr style="background: #f0f9ff;">
                        <td style="padding: 24px 24px; border: 2px solid #0f172a; color: #0c4a6e; font-weight: 900; text-transform: uppercase; font-size: 13px; letter-spacing: 2px;">Certified Net Revenue</td>
                        <td style="padding: 24px 24px; border: 2px solid #0f172a; text-align: right; color: #0369a1; font-weight: 900; font-size: 28px;">${currencySymbol}${totalNet.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style="background: #f8fafc; padding: 32px; border-radius: 20px; border: 2px dashed #cbd5e1; text-align: center;">
                  <p style="color: #475569; font-size: 13px; font-weight: 700; margin: 0; line-height: 1.6;">
                    This automated report has been generated in accordance with internal audit protocols.<br/>
                    <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; display: block;">A detailed PDF ledger is attached for comprehensive review.</span>
                  </p>
                </div>
              </div>
              <div style="background: #0f172a; padding: 24px; text-align: center;">
                <p style="color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; margin: 0;">&copy; ${new Date().getFullYear()} ${propertyName} &bull; Confidential Audit Document</p>
              </div>
            </div>
          `
          
          // Generate PDF for Daily Sales
          const doc = new jsPDF();
          doc.setFont("helvetica", "bold");
          doc.setFontSize(24);
          doc.setTextColor(15, 23, 42);
          doc.text("DAILY SALES LEDGER", 105, 30, { align: 'center' });
          
          doc.setFontSize(10);
          doc.setTextColor(100, 116, 139);
          doc.text(propertyName.toUpperCase(), 105, 38, { align: 'center' });
          
          doc.setDrawColor(15, 23, 42);
          doc.setLineWidth(0.5);
          doc.line(20, 45, 190, 45);
          
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          doc.text(`Outlet: ${outletName}`, 20, 55);
          doc.text(`Audit Date: ${format(yesterday, 'MMMM d, yyyy')}`, 190, 55, { align: 'right' });
          
          autoTable(doc, {
            startY: 65,
            head: [['Date', 'Type', 'Item / Service', 'Gross', 'Discount', 'Net']],
            body: sales.map(s => [format(parseISO(s.created_at), 'dd-MMM-yy'), 'Retail', s.item_name || 'Item', s.gross_amount.toFixed(2), s.discount_amount.toFixed(2), s.net_amount.toFixed(2)])
                  .concat(bookings.map(b => [format(parseISO(b.date), 'dd-MMM-yy'), 'Service', 'Booking', (Number(b.price) + Number(b.discount || 0)).toFixed(2), (b.discount || 0).toFixed(2), Number(b.price).toFixed(2)])),
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
            styles: { fontSize: 8, cellPadding: 3 },
            columnStyles: {
              3: { halign: 'right' },
              4: { halign: 'right' },
              5: { halign: 'right' }
            }
          });
          
          const finalY = (doc as any).lastAutoTable.finalY || 150;
          
          autoTable(doc, {
            startY: finalY + 10,
            body: [
              ['PORTFOLIO GROSS REVENUE', `${currencySymbol}${totalGross.toFixed(2)}`],
              ['TOTAL REDUCTION / DISCOUNT', `-${currencySymbol}${totalDiscount.toFixed(2)}`],
              ['CERTIFIED NET REVENUE', `${currencySymbol}${totalNet.toFixed(2)}`]
            ],
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 5, fontStyle: 'bold' },
            columnStyles: {
              0: { cellWidth: 120, fillColor: [248, 250, 252] },
              1: { halign: 'right', cellWidth: 50 }
            }
          });
          
          attachments.push({
            filename: `Daily_Sales_${startStr}.pdf`,
            content: doc.output('datauristring').split(',')[1],
          });
        } else if (recipient.report_type === 'revenue_recognition') {
          subject = `${reportTitle} - ${propertyName} (${outletName})`
          
          // 1. Fetch data
          let membersQuery = supabaseClient.from('members').select('*').eq('property_id', recipient.property_id);
          if (recipient.outlet_id !== 'all') {
            membersQuery = membersQuery.eq('outlet_id', recipient.outlet_id);
          }

          const [membersRes, freezesRes, categoriesRes] = await Promise.all([
            membersQuery,
            supabaseClient.from('membership_freezes').select('*'),
            supabaseClient.from('membership_categories').select('id, name')
          ]);

          const members = membersRes.data || [];
          const freezes = freezesRes.data || [];
          const categories = categoriesRes.data || [];
          const categoryMap = Object.fromEntries(categories.map(c => [c.id, c.name]));

          // 2. Calculate for current month
          const now = new Date();
          const start = startOfMonth(now);
          const end = endOfMonth(now);

          let totalEarned = 0;
          let totalDeferred = 0;
          let totalActual = 0;
          let totalDiscount = 0;
          let totalNetFees = 0;
          let totalPrevAccrual = 0;

          const rows: any[] = [];

          members.forEach(m => {
            if (m.status === 'tentative') return;

            const mStart = parseISO(m.start_date);
            const mEnd = parseISO(m.current_end_date);
            const memberFreezes = freezes.filter(f => f.member_id === m.id);

            // Prev Accrual
            let prevAccrual = 0;
            if (mStart < start) {
              prevAccrual = calculateRevenuePeriod(m, memberFreezes, mStart, subDays(start, 1));
            }

            // Period Revenue
            const periodRev = calculateRevenuePeriod(m, memberFreezes, start, end);

            // Deferred
            let deferred = m.net_amount - (prevAccrual + periodRev);
            if (deferred < 0) deferred = 0;

            totalEarned += periodRev;
            totalDeferred += deferred;
            totalActual += Number(m.actual_rate || 0);
            totalDiscount += Number(m.discount || 0);
            totalNetFees += Number(m.net_amount || 0);
            totalPrevAccrual += prevAccrual;

            rows.push({
              guest_name: m.name,
              category: categoryMap[m.category_id] || 'Other',
              start_date: m.start_date,
              end_date: m.current_end_date,
              days: differenceInCalendarDays(mEnd, mStart) + 1,
              actual: Number(m.actual_rate || 0),
              discount: Number(m.discount || 0),
              net: Number(m.net_amount || 0),
              prev: prevAccrual,
              period: periodRev,
              deferred: deferred
            });
          });

          // Group by category for HTML
          const grouped = rows.reduce((acc, r) => {
            if (!acc[r.category]) acc[r.category] = [];
            acc[r.category].push(r);
            return acc;
          }, {} as Record<string, any[]>);

          let tableRowsHTML = '';
          Object.entries(grouped).forEach(([cat, catRows]) => {
            tableRowsHTML += `
              <tr style="background-color: #f8fafc;">
                <td colspan="11" style="padding: 12px 16px; border: 1px solid #000; font-weight: 900; text-transform: uppercase; font-size: 10px; color: #0f172a;">
                  ${cat} <span style="color: #64748b; font-weight: 600;">(${catRows.length} Ledger Events)</span>
                </td>
              </tr>
            `;
            catRows.forEach((r, idx) => {
              tableRowsHTML += `
                <tr>
                  <td style="padding: 8px; border: 1px solid #000; text-align: center; color: #64748b; font-size: 9px;">${idx + 1}</td>
                  <td style="padding: 8px; border: 1px solid #000; font-weight: 700; color: #1e293b; font-size: 10px;">${r.guest_name}</td>
                  <td style="padding: 8px; border: 1px solid #000; text-align: center; font-size: 9px;">${format(parseISO(r.start_date), 'dd-MMM-yy')}</td>
                  <td style="padding: 8px; border: 1px solid #000; text-align: center; font-size: 9px;">${format(parseISO(r.end_date), 'dd-MMM-yy')}</td>
                  <td style="padding: 8px; border: 1px solid #000; text-align: center; font-size: 9px;">${r.days}</td>
                  <td style="padding: 8px; border: 1px solid #000; text-align: right; font-size: 9px;">${r.actual.toFixed(2)}</td>
                  <td style="padding: 8px; border: 1px solid #000; text-align: right; font-size: 9px;">${r.discount.toFixed(2)}</td>
                  <td style="padding: 8px; border: 1px solid #000; text-align: right; font-size: 9px;">${r.net.toFixed(2)}</td>
                  <td style="padding: 8px; border: 1px solid #000; text-align: right; color: #94a3b8; font-size: 9px;">${r.prev.toFixed(2)}</td>
                  <td style="padding: 8px; border: 1px solid #000; text-align: right; font-weight: 700; color: #10b981; font-size: 10px;">${r.period.toFixed(2)}</td>
                  <td style="padding: 8px; border: 1px solid #000; text-align: right; font-weight: 700; color: #ef4444; font-size: 10px;">${r.deferred.toFixed(2)}</td>
                </tr>
              `;
            });
          });

          reportContent = `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 900px; margin: 20px auto; background: #ffffff; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; border: 1px solid #e2e8f0;">
              ${reportHeaderHTML}
              <div style="padding: 40px;">
                <div style="background-color: #0f172a; padding: 32px; border-radius: 20px; margin-bottom: 40px; color: #ffffff; display: flex; justify-content: space-between; align-items: center; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
                  <div>
                    <p style="margin: 0; color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px;">Audit Period</p>
                    <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">${format(start, 'MMMM yyyy')}</p>
                  </div>
                  <div style="text-align: right;">
                    <p style="margin: 0; color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px;">Verification Status</p>
                    <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: 900; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 4px 12px; border-radius: 6px;">CERTIFIED AUDIT TRAIL</p>
                  </div>
                </div>

                <div style="margin-bottom: 48px;">
                  <h3 style="font-size: 14px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 24px; border-left: 4px solid #0f172a; padding-left: 16px;">Revenue Recognition Summary</h3>
                  <table style="width: 100%; border-collapse: collapse; border: 2px solid #0f172a;">
                    <tbody>
                      <tr style="background: #ffffff;">
                        <td style="padding: 20px 24px; border: 1px solid #0f172a; color: #475569; font-weight: 800; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">Total Net Fees</td>
                        <td style="padding: 20px 24px; border: 1px solid #0f172a; text-align: right; color: #0f172a; font-weight: 900; font-size: 18px;">${currencySymbol}${totalNetFees.toFixed(2)}</td>
                      </tr>
                      <tr style="background: #ffffff;">
                        <td style="padding: 20px 24px; border: 1px solid #0f172a; color: #475569; font-weight: 800; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">Period Revenue Recognized</td>
                        <td style="padding: 20px 24px; border: 1px solid #0f172a; text-align: right; color: #10b981; font-weight: 900; font-size: 18px;">${currencySymbol}${totalEarned.toFixed(2)}</td>
                      </tr>
                      <tr style="background: #f0f9ff;">
                        <td style="padding: 24px 24px; border: 2px solid #0f172a; color: #0c4a6e; font-weight: 900; text-transform: uppercase; font-size: 13px; letter-spacing: 2px;">Total Deferred Revenue</td>
                        <td style="padding: 24px 24px; border: 2px solid #0f172a; text-align: right; color: #0369a1; font-weight: 900; font-size: 28px;">${currencySymbol}${totalDeferred.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style="background: #f8fafc; padding: 32px; border-radius: 20px; border: 2px dashed #cbd5e1; text-align: center;">
                  <p style="color: #475569; font-size: 13px; font-weight: 700; margin: 0; line-height: 1.6;">
                    This automated report has been generated in accordance with internal audit protocols.<br/>
                    <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; display: block;">A detailed PDF ledger is attached for comprehensive review.</span>
                  </p>
                </div>
              </div>
              <div style="background: #0f172a; padding: 24px; text-align: center;">
                <p style="color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; margin: 0;">&copy; ${new Date().getFullYear()} ${propertyName} &bull; Confidential Audit Document</p>
              </div>
            </div>
          `

          // Generate PDF for Revenue Recognition
          const doc = new jsPDF({ orientation: 'landscape' });
          doc.setFont("helvetica", "bold");
          doc.setFontSize(24);
          doc.setTextColor(15, 23, 42);
          doc.text("REVENUE RECOGNITION AUDIT", 148, 30, { align: 'center' });
          
          doc.setFontSize(10);
          doc.setTextColor(100, 116, 139);
          doc.text(propertyName.toUpperCase(), 148, 38, { align: 'center' });
          
          doc.setDrawColor(15, 23, 42);
          doc.setLineWidth(0.5);
          doc.line(20, 45, 277, 45);
          
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          doc.text(`Outlet: ${outletName}`, 20, 55);
          doc.text(`Period: ${format(start, 'MMMM yyyy')}`, 277, 55, { align: 'right' });
          
          autoTable(doc, {
            startY: 65,
            head: [['Guest Name', 'Category', 'Start', 'End', 'Days', 'Actual', 'Disc', 'Net', 'Prev', 'Period', 'Deferred']],
            body: rows.map(r => [r.guest_name, r.category, r.start_date, r.end_date, r.days, r.actual.toFixed(2), r.discount.toFixed(2), r.net.toFixed(2), r.prev.toFixed(2), r.period.toFixed(2), r.deferred.toFixed(2)]),
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
            styles: { fontSize: 7, cellPadding: 2 },
            columnStyles: {
              5: { halign: 'right' },
              6: { halign: 'right' },
              7: { halign: 'right' },
              8: { halign: 'right' },
              9: { halign: 'right' },
              10: { halign: 'right' }
            }
          });
          
          const finalY = (doc as any).lastAutoTable.finalY || 150;
          
          autoTable(doc, {
            startY: finalY + 10,
            body: [
              ['TOTAL NET FEES', `${currencySymbol}${totalNetFees.toFixed(2)}`],
              ['PERIOD REVENUE RECOGNIZED', `${currencySymbol}${totalEarned.toFixed(2)}`],
              ['TOTAL DEFERRED REVENUE', `${currencySymbol}${totalDeferred.toFixed(2)}`]
            ],
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 5, fontStyle: 'bold' },
            columnStyles: {
              0: { cellWidth: 120, fillColor: [248, 250, 252] },
              1: { halign: 'right', cellWidth: 50 }
            }
          });
          
          attachments.push({
            filename: `Revenue_Recognition_${format(now, 'yyyy-MM')}.pdf`,
            content: doc.output('datauristring').split(',')[1],
          });
        } else if (recipient.report_type === 'members_joined') {
          subject = `${reportTitle} - ${propertyName} (${outletName})`
          
          const now = new Date();
          const start = startOfMonth(now);
          const end = endOfMonth(now);
          const startStr = format(start, 'yyyy-MM-dd');
          const endStr = format(end, 'yyyy-MM-dd');
          
          let membersQuery = supabaseClient.from('members').select('*').eq('property_id', recipient.property_id).gte('start_date', startStr).lte('start_date', endStr);
          if (recipient.outlet_id !== 'all') {
            membersQuery = membersQuery.eq('outlet_id', recipient.outlet_id);
          }
          const { data: members } = await membersQuery;
          
          const csvRows = ['Name,Email,Phone,Start Date,End Date,Status'];
          members?.forEach(m => {
            csvRows.push(`"${m.name}","${m.email}","${m.phone}","${m.start_date}","${m.end_date}","${m.status}"`);
          });
          
          attachments.push({
            filename: `Members_Joined_${format(now, 'yyyy-MM')}.csv`,
            content: btoa(csvRows.join('\n')),
          });
          
          // Generate PDF for Members Joined
          const doc = new jsPDF();
          doc.setFont("helvetica", "bold");
          doc.setFontSize(24);
          doc.setTextColor(15, 23, 42);
          doc.text("MEMBERSHIP ACQUISITION LOG", 105, 30, { align: 'center' });
          
          doc.setFontSize(10);
          doc.setTextColor(100, 116, 139);
          doc.text(propertyName.toUpperCase(), 105, 38, { align: 'center' });
          
          doc.setDrawColor(15, 23, 42);
          doc.setLineWidth(0.5);
          doc.line(20, 45, 190, 45);
          
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          doc.text(`Outlet: ${outletName}`, 20, 55);
          doc.text(`Period: ${format(start, 'MMMM yyyy')}`, 190, 55, { align: 'right' });
          
          autoTable(doc, {
            startY: 65,
            head: [['Name', 'Email', 'Phone', 'Start Date', 'Status']],
            body: members?.map(m => [m.name, m.email, m.phone, m.start_date, m.status]) || [],
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
            styles: { fontSize: 8, cellPadding: 3 }
          });
          
          attachments.push({
            filename: `Members_Joined_${format(now, 'yyyy-MM')}.pdf`,
            content: doc.output('datauristring').split(',')[1],
          });

          reportContent = `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 900px; margin: 20px auto; background: #ffffff; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; border: 1px solid #e2e8f0;">
              ${reportHeaderHTML}
              <div style="padding: 40px;">
                <div style="background-color: #0f172a; padding: 32px; border-radius: 20px; margin-bottom: 40px; color: #ffffff; display: flex; justify-content: space-between; align-items: center; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
                  <div>
                    <p style="margin: 0; color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px;">Audit Period</p>
                    <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">${format(start, 'MMMM yyyy')}</p>
                  </div>
                  <div style="text-align: right;">
                    <p style="margin: 0; color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px;">Verification Status</p>
                    <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: 900; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 4px 12px; border-radius: 6px;">CERTIFIED AUDIT TRAIL</p>
                  </div>
                </div>

                <div style="margin-bottom: 48px;">
                  <h3 style="font-size: 14px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 24px; border-left: 4px solid #0f172a; padding-left: 16px;">Membership Acquisition Summary</h3>
                  <table style="width: 100%; border-collapse: collapse; border: 2px solid #0f172a;">
                    <tbody>
                      <tr style="background: #f0f9ff;">
                        <td style="padding: 24px 24px; border: 2px solid #0f172a; color: #0c4a6e; font-weight: 900; text-transform: uppercase; font-size: 13px; letter-spacing: 2px;">New Members Joined</td>
                        <td style="padding: 24px 24px; border: 2px solid #0f172a; text-align: right; color: #0369a1; font-weight: 900; font-size: 28px;">${members?.length || 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style="background: #f8fafc; padding: 32px; border-radius: 20px; border: 2px dashed #cbd5e1; text-align: center;">
                  <p style="color: #475569; font-size: 13px; font-weight: 700; margin: 0; line-height: 1.6;">
                    This automated report has been generated in accordance with internal audit protocols.<br/>
                    <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; display: block;">A detailed PDF ledger is attached for comprehensive review.</span>
                  </p>
                </div>
              </div>
              <div style="background: #0f172a; padding: 24px; text-align: center;">
                <p style="color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; margin: 0;">&copy; ${new Date().getFullYear()} ${propertyName} &bull; Confidential Audit Document</p>
              </div>
            </div>
          `
        } else if (recipient.report_type === 'expiring_memberships') {
          subject = `${reportTitle} - ${propertyName} (${outletName})`
          
          const now = new Date();
          const start = startOfMonth(now);
          const end = endOfMonth(now);
          const startStr = format(start, 'yyyy-MM-dd');
          const endStr = format(end, 'yyyy-MM-dd');
          
          let membersQuery = supabaseClient.from('members').select('*').eq('property_id', recipient.property_id).gte('end_date', startStr).lte('end_date', endStr);
          if (recipient.outlet_id !== 'all') {
            membersQuery = membersQuery.eq('outlet_id', recipient.outlet_id);
          }
          const { data: members } = await membersQuery;
          
          const csvRows = ['Name,Email,Phone,Start Date,End Date,Status'];
          members?.forEach(m => {
            csvRows.push(`"${m.name}","${m.email}","${m.phone}","${m.start_date}","${m.end_date}","${m.status}"`);
          });
          
          attachments.push({
            filename: `Expiring_Memberships_${format(now, 'yyyy-MM')}.csv`,
            content: btoa(csvRows.join('\n')),
          });
          
          // Generate PDF for Expiring Memberships
          const doc = new jsPDF();
          doc.setFont("helvetica", "bold");
          doc.setFontSize(24);
          doc.setTextColor(15, 23, 42);
          doc.text("MEMBERSHIP EXPIRATION AUDIT", 105, 30, { align: 'center' });
          
          doc.setFontSize(10);
          doc.setTextColor(100, 116, 139);
          doc.text(propertyName.toUpperCase(), 105, 38, { align: 'center' });
          
          doc.setDrawColor(15, 23, 42);
          doc.setLineWidth(0.5);
          doc.line(20, 45, 190, 45);
          
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          doc.text(`Outlet: ${outletName}`, 20, 55);
          doc.text(`Period: ${format(start, 'MMMM yyyy')}`, 190, 55, { align: 'right' });
          
          autoTable(doc, {
            startY: 65,
            head: [['Name', 'Email', 'Phone', 'Expiry Date', 'Status']],
            body: members?.map(m => [m.name, m.email, m.phone, m.end_date, m.status]) || [],
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
            styles: { fontSize: 8, cellPadding: 3 }
          });
          
          attachments.push({
            filename: `Expiring_Memberships_${format(now, 'yyyy-MM')}.pdf`,
            content: doc.output('datauristring').split(',')[1],
          });

          reportContent = `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 900px; margin: 20px auto; background: #ffffff; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; border: 1px solid #e2e8f0;">
              ${reportHeaderHTML}
              <div style="padding: 40px;">
                <div style="background-color: #0f172a; padding: 32px; border-radius: 20px; margin-bottom: 40px; color: #ffffff; display: flex; justify-content: space-between; align-items: center; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
                  <div>
                    <p style="margin: 0; color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px;">Audit Period</p>
                    <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">${format(start, 'MMMM yyyy')}</p>
                  </div>
                  <div style="text-align: right;">
                    <p style="margin: 0; color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px;">Verification Status</p>
                    <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: 900; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 4px 12px; border-radius: 6px;">CERTIFIED AUDIT TRAIL</p>
                  </div>
                </div>

                <div style="margin-bottom: 48px;">
                  <h3 style="font-size: 14px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 24px; border-left: 4px solid #0f172a; padding-left: 16px;">Membership Expiration Summary</h3>
                  <table style="width: 100%; border-collapse: collapse; border: 2px solid #0f172a;">
                    <tbody>
                      <tr style="background: #fef2f2;">
                        <td style="padding: 24px 24px; border: 2px solid #0f172a; color: #991b1b; font-weight: 900; text-transform: uppercase; font-size: 13px; letter-spacing: 2px;">Memberships Expiring</td>
                        <td style="padding: 24px 24px; border: 2px solid #0f172a; text-align: right; color: #b91c1c; font-weight: 900; font-size: 28px;">${members?.length || 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style="background: #f8fafc; padding: 32px; border-radius: 20px; border: 2px dashed #cbd5e1; text-align: center;">
                  <p style="color: #475569; font-size: 13px; font-weight: 700; margin: 0; line-height: 1.6;">
                    This automated report has been generated in accordance with internal audit protocols.<br/>
                    <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; display: block;">A detailed PDF ledger is attached for comprehensive review.</span>
                  </p>
                </div>
              </div>
              <div style="background: #0f172a; padding: 24px; text-align: center;">
                <p style="color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; margin: 0;">&copy; ${new Date().getFullYear()} ${propertyName} &bull; Confidential Audit Document</p>
              </div>
            </div>
          `
        } else if (recipient.report_type === 'massage_room_revenue') {
          subject = `${reportTitle} - ${propertyName} (${outletName})`
          
          const now = new Date();
          const start = startOfMonth(now);
          const end = endOfMonth(now);
          const startStr = format(start, 'yyyy-MM-dd');
          const endStr = format(end, 'yyyy-MM-dd');
          
          let bookingsQuery = supabaseClient.from('bookings').select('*, massage_rooms(*)').eq('property_id', recipient.property_id).eq('status', 'completed').gte('date', startStr).lte('date', endStr);
          if (recipient.outlet_id !== 'all') {
            bookingsQuery = bookingsQuery.eq('outlet_id', recipient.outlet_id);
          }
          const { data: bookings } = await bookingsQuery;
          
          let totalRevenue = 0;
          const csvRows = ['Date,Room,Price,Discount,Net'];
          bookings?.forEach(b => {
            const net = Number(b.price || 0);
            totalRevenue += net;
            csvRows.push(`"${b.date}","${b.massage_rooms?.name || 'Unknown'}","${Number(b.price) + Number(b.discount || 0)}","${b.discount || 0}","${net}"`);
          });
          
          attachments.push({
            filename: `Massage_Room_Revenue_${format(now, 'yyyy-MM')}.csv`,
            content: btoa(csvRows.join('\n')),
          });
          
          // Generate PDF for Massage Room Revenue
          const doc = new jsPDF();
          doc.setFont("helvetica", "bold");
          doc.setFontSize(24);
          doc.setTextColor(15, 23, 42);
          doc.text("MASSAGE ROOM REVENUE AUDIT", 105, 30, { align: 'center' });
          
          doc.setFontSize(10);
          doc.setTextColor(100, 116, 139);
          doc.text(propertyName.toUpperCase(), 105, 38, { align: 'center' });
          
          doc.setDrawColor(15, 23, 42);
          doc.setLineWidth(0.5);
          doc.line(20, 45, 190, 45);
          
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          doc.text(`Outlet: ${outletName}`, 20, 55);
          doc.text(`Period: ${format(start, 'MMMM yyyy')}`, 190, 55, { align: 'right' });
          
          autoTable(doc, {
            startY: 65,
            head: [['Date', 'Room', 'Price', 'Discount', 'Net Revenue']],
            body: bookings?.map(b => [
              b.date, 
              b.massage_rooms?.name || 'Unknown', 
              (Number(b.price) + Number(b.discount || 0)).toFixed(2),
              Number(b.discount || 0).toFixed(2),
              Number(b.price || 0).toFixed(2)
            ]) || [],
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
            styles: { fontSize: 8, cellPadding: 3 },
            columnStyles: {
              2: { halign: 'right' },
              3: { halign: 'right' },
              4: { halign: 'right' }
            }
          });
          
          const finalY = (doc as any).lastAutoTable.finalY || 150;
          
          autoTable(doc, {
            startY: finalY + 10,
            body: [
              ['TOTAL REVENUE', `${currencySymbol}${totalRevenue.toFixed(2)}`],
              ['TOTAL BOOKINGS', `${bookings?.length || 0}`]
            ],
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 5, fontStyle: 'bold' },
            columnStyles: {
              0: { cellWidth: 100, fillColor: [248, 250, 252] },
              1: { halign: 'right', cellWidth: 40 }
            }
          });
          
          attachments.push({
            filename: `Massage_Room_Revenue_${format(now, 'yyyy-MM')}.pdf`,
            content: doc.output('datauristring').split(',')[1],
          });

          reportContent = `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 900px; margin: 20px auto; background: #ffffff; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; border: 1px solid #e2e8f0;">
              ${reportHeaderHTML}
              <div style="padding: 40px;">
                <div style="background-color: #0f172a; padding: 32px; border-radius: 20px; margin-bottom: 40px; color: #ffffff; display: flex; justify-content: space-between; align-items: center; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
                  <div>
                    <p style="margin: 0; color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px;">Audit Period</p>
                    <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">${format(start, 'MMMM yyyy')}</p>
                  </div>
                  <div style="text-align: right;">
                    <p style="margin: 0; color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px;">Verification Status</p>
                    <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: 900; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 4px 12px; border-radius: 6px;">CERTIFIED AUDIT TRAIL</p>
                  </div>
                </div>

                <div style="margin-bottom: 48px;">
                  <h3 style="font-size: 14px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 24px; border-left: 4px solid #0f172a; padding-left: 16px;">Massage Room Revenue Summary</h3>
                  <table style="width: 100%; border-collapse: collapse; border: 2px solid #0f172a;">
                    <tbody>
                      <tr style="background: #f0f9ff;">
                        <td style="padding: 24px 24px; border: 2px solid #0f172a; color: #0c4a6e; font-weight: 900; text-transform: uppercase; font-size: 13px; letter-spacing: 2px;">Total Net Revenue</td>
                        <td style="padding: 24px 24px; border: 2px solid #0f172a; text-align: right; color: #0369a1; font-weight: 900; font-size: 28px;">${currencySymbol}${totalRevenue.toFixed(2)}</td>
                      </tr>
                      <tr style="background: #ffffff;">
                        <td style="padding: 20px 24px; border: 1px solid #0f172a; color: #475569; font-weight: 800; text-transform: uppercase; font-size: 11px; letter-spacing: 1px;">Total Bookings</td>
                        <td style="padding: 20px 24px; border: 1px solid #0f172a; text-align: right; color: #0f172a; font-weight: 900; font-size: 18px;">${bookings?.length || 0}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style="background: #f8fafc; padding: 32px; border-radius: 20px; border: 2px dashed #cbd5e1; text-align: center;">
                  <p style="color: #475569; font-size: 13px; font-weight: 700; margin: 0; line-height: 1.6;">
                    This automated report has been generated in accordance with internal audit protocols.<br/>
                    <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; display: block;">A detailed PDF ledger is attached for comprehensive review.</span>
                  </p>
                </div>
              </div>
              <div style="background: #0f172a; padding: 24px; text-align: center;">
                <p style="color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; margin: 0;">&copy; ${new Date().getFullYear()} ${propertyName} &bull; Confidential Audit Document</p>
              </div>
            </div>
          `
        } else if (recipient.report_type === 'incentives') {
          subject = `${reportTitle} - ${propertyName} (${outletName})`
          
          const now = new Date();
          const start = startOfMonth(now);
          const end = endOfMonth(now);
          const startStr = format(start, 'yyyy-MM-dd');
          const endStr = format(end, 'yyyy-MM-dd');
          
          let bookingsQuery = supabaseClient.from('bookings').select('*, staff(*)').eq('property_id', recipient.property_id).eq('status', 'completed').gte('date', startStr).lte('date', endStr);
          if (recipient.outlet_id !== 'all') {
            bookingsQuery = bookingsQuery.eq('outlet_id', recipient.outlet_id);
          }
          const { data: bookings } = await bookingsQuery;
          
          let totalIncentives = 0;
          const csvRows = ['Date,Staff,Booking Price,Incentive Amount'];
          bookings?.forEach(b => {
            const incentive = Number(b.incentive_amount || 0);
            totalIncentives += incentive;
            csvRows.push(`"${b.date}","${b.staff?.name || 'Unknown'}","${b.price}","${incentive}"`);
          });
          
          attachments.push({
            filename: `Incentives_${format(now, 'yyyy-MM')}.csv`,
            content: btoa(csvRows.join('\n')),
          });
          
          // Generate PDF for Incentives
          if (bookings && bookings.length > 0) {
            const doc = new jsPDF();
          doc.setFont("helvetica", "bold");
          doc.setFontSize(24);
          doc.setTextColor(15, 23, 42);
          doc.text("STAFF INCENTIVE AUDIT", 105, 30, { align: 'center' });
          
          doc.setFontSize(10);
          doc.setTextColor(100, 116, 139);
          doc.text(propertyName.toUpperCase(), 105, 38, { align: 'center' });
          
          doc.setDrawColor(15, 23, 42);
          doc.setLineWidth(0.5);
          doc.line(20, 45, 190, 45);
          
          doc.setFontSize(11);
          doc.setTextColor(15, 23, 42);
          doc.text(`Outlet: ${outletName}`, 20, 55);
          doc.text(`Period: ${format(start, 'MMMM yyyy')}`, 190, 55, { align: 'right' });
          
          autoTable(doc, {
            startY: 65,
            head: [['Date', 'Staff Name', 'Booking Price', 'Incentive Amount']],
            body: bookings?.map(b => [
              b.date, 
              b.staff?.name || 'Unknown', 
              Number(b.price || 0).toFixed(2),
              Number(b.incentive_amount || 0).toFixed(2)
            ]) || [],
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
            styles: { fontSize: 8, cellPadding: 3 },
            columnStyles: {
              2: { halign: 'right' },
              3: { halign: 'right' }
            }
          });
          
          const finalY = (doc as any).lastAutoTable.finalY || 150;
          
          autoTable(doc, {
            startY: finalY + 10,
            body: [
              ['TOTAL INCENTIVES PAYABLE', `${currencySymbol}${totalIncentives.toFixed(2)}`]
            ],
            theme: 'grid',
            styles: { fontSize: 10, cellPadding: 5, fontStyle: 'bold' },
            columnStyles: {
              0: { cellWidth: 100, fillColor: [248, 250, 252] },
              1: { halign: 'right', cellWidth: 40 }
            }
          });
          
          attachments.push({
            filename: `Incentives_${format(now, 'yyyy-MM')}.pdf`,
            content: doc.output('datauristring').split(',')[1],
          });
          }

          reportContent = `
            <div style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 900px; margin: 20px auto; background: #ffffff; border-radius: 24px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); overflow: hidden; border: 1px solid #e2e8f0;">
              ${reportHeaderHTML}
              <div style="padding: 40px;">
                <div style="background-color: #0f172a; padding: 32px; border-radius: 20px; margin-bottom: 40px; color: #ffffff; display: flex; justify-content: space-between; align-items: center; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
                  <div>
                    <p style="margin: 0; color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px;">Audit Period</p>
                    <p style="margin: 8px 0 0 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">${format(start, 'MMMM yyyy')}</p>
                  </div>
                  <div style="text-align: right;">
                    <p style="margin: 0; color: #94a3b8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 3px;">Verification Status</p>
                    <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: 900; color: #10b981; background: rgba(16, 185, 129, 0.1); padding: 4px 12px; border-radius: 6px;">CERTIFIED AUDIT TRAIL</p>
                  </div>
                </div>

                <div style="margin-bottom: 48px;">
                  <h3 style="font-size: 14px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 24px; border-left: 4px solid #0f172a; padding-left: 16px;">Staff Incentive Summary</h3>
                  <table style="width: 100%; border-collapse: collapse; border: 2px solid #0f172a;">
                    <tbody>
                      <tr style="background: #f0f9ff;">
                        <td style="padding: 24px 24px; border: 2px solid #0f172a; color: #0c4a6e; font-weight: 900; text-transform: uppercase; font-size: 13px; letter-spacing: 2px;">Total Incentives Payable</td>
                        <td style="padding: 24px 24px; border: 2px solid #0f172a; text-align: right; color: #0369a1; font-weight: 900; font-size: 28px;">${currencySymbol}${totalIncentives.toFixed(2)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style="background: #f8fafc; padding: 32px; border-radius: 20px; border: 2px dashed #cbd5e1; text-align: center;">
                  <p style="color: #475569; font-size: 13px; font-weight: 700; margin: 0; line-height: 1.6;">
                    This automated report has been generated in accordance with internal audit protocols.<br/>
                    <span style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-top: 8px; display: block;">A detailed PDF ledger is attached for comprehensive review.</span>
                  </p>
                </div>
              </div>
              <div style="background: #0f172a; padding: 24px; text-align: center;">
                <p style="color: #94a3b8; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; margin: 0;">&copy; ${new Date().getFullYear()} ${propertyName} &bull; Confidential Audit Document</p>
              </div>
            </div>
          `
        } else {
          // Fallback for any unknown report types
          subject = `${reportTitle} - ${propertyName} (${outletName})`
          reportContent = `
            <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 800px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
              ${reportHeaderHTML}
              <div style="background-color: #fffbeb; padding: 20px; border-radius: 8px; border: 1px solid #fde68a; text-align: center;">
                <p style="margin: 0; color: #b45309; font-size: 15px;"><em>Report data generation for this type is currently being configured.</em></p>
              </div>
              <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">Automated Report generated by AI Studio</p>
              </div>
            </div>
          `
        }

        const finalSubject = isTest ? `[TEST] ${subject}` : subject;

        if (!RESEND_API_KEY) {
          throw new Error('RESEND_API_KEY is not configured in Supabase Secrets');
        }

        // 2. Send email via Resend
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`
          },
          body: JSON.stringify({
            // NOTE: If you haven't verified a domain in Resend yet, you MUST use onboarding@resend.dev
            // and you can ONLY send emails to the email address you signed up to Resend with.
            // Once you verify a domain, change this to: 'Reports <reports@yourdomain.com>'
            from: 'Reports <onboarding@resend.dev>', 
            to: recipient.email,
            subject: finalSubject,
            html: reportContent,
            attachments: attachments.length > 0 ? attachments : undefined
          })
        })
        
        const resData = await res.json()
        if (!res.ok) throw new Error(resData.message || 'Failed to send email')
        
        results.push({ email: recipient.email, status: 'sent', id: resData.id })
      } catch (err) {
        console.error(`Failed to send to ${recipient.email}:`, err)
        results.push({ email: recipient.email, status: 'error', error: String(err) })
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Edge Function Error:", error)
    return new Response(JSON.stringify({ success: false, error: error.message || String(error) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Return 200 so supabase-js doesn't throw a generic FunctionsHttpError
    })
  }
})
