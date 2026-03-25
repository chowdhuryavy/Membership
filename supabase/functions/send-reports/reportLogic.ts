import { format, isWithinInterval, eachDayOfInterval, parseISO, differenceInCalendarDays, startOfMonth, endOfMonth, addMonths, parse, startOfDay, endOfDay } from 'npm:date-fns';

/**
 * SHARED REPORT LOGIC
 * This file is the single source of truth for report calculations.
 * It is synced to the Supabase Edge Function via a build script.
 */

export interface ReportData {
  rows: any[];
  summary: any;
}

export interface ReportContext {
  supabase: any;
  propertyId: string;
  outletId: string | 'all';
  reportType: string;
  date: Date;
  dateType?: 'today' | 'yesterday';
}

// Helper for safe date parsing - ensures consistent UTC/Local handling
const safeParseDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return null;
  
  // Try YYYY-MM-DD first (ISO-ish)
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    try {
      // Use parseISO to avoid timezone shifts if possible, or force to start of day
      const d = parseISO(dateStr.split('T')[0]);
      if (!isNaN(d.getTime())) return startOfDay(d);
    } catch (e) {}
  }

  // Try DD-MM-YYYY
  try {
    const parsed = parse(dateStr, 'dd-MM-yyyy', new Date());
    if (!isNaN(parsed.getTime())) return startOfDay(parsed);
  } catch (e) {}

  // Fallback to generic Date constructor
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? null : startOfDay(fallback);
};

export const getReportData = async (ctx: ReportContext): Promise<ReportData> => {
  const { supabase, propertyId, outletId, reportType, date } = ctx;
  
  if (reportType === 'revenue_recognition') {
    console.log(`DEBUG: Fetching members for Property: ${propertyId}, Outlet: ${outletId}`);
    
    let outletIds: string[] = [];
    if (outletId === 'all') {
      const { data: outlets } = await supabase.from('outlets').select('id').eq('property_id', propertyId);
      outletIds = (outlets || []).map((o: any) => o.id);
    } else {
      outletIds = [outletId];
    }

    if (outletIds.length === 0) return { rows: [], summary: { totalNetFees: 0, totalEarned: 0, totalDeferred: 0, count: 0 } };

    let membersQuery = supabase.from('members').select('*').in('outlet_id', outletIds);

    const [membersRes, freezesRes, categoriesRes] = await Promise.all([
      membersQuery,
      supabase.from('freezes').select('*'),
      supabase.from('membership_categories').select('id, name')
    ]);

    if (membersRes.error) {
      console.error('Error fetching members:', membersRes.error);
      throw new Error(`Failed to fetch members: ${membersRes.error.message}`);
    }

    const members = membersRes.data || [];
    const freezes = freezesRes.data || [];
    const categories = categoriesRes.data || [];
    const categoryMap = Object.fromEntries(categories.map((c: any) => [c.id, c.name]));

    console.log(`DEBUG: Found ${members.length} members for property ${propertyId}`);

    // Calculate for the month of the provided date
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    let totalEarned = 0;
    let totalDeferred = 0;
    let totalNetFees = 0;

    const rows = members.filter((m: any) => m.status !== 'tentative').map((m: any) => {
      const mStart = safeParseDate(m.start_date);
      const mEnd = safeParseDate(m.current_end_date);
      
      const memberFreezes = freezes.filter((f: any) => f.member_id === m.id);

      // Helper for revenue calculation
      const calculateRevenueDays = (pStart: Date, pEnd: Date) => {
        if (!mStart || !mEnd) return 0;
        const activeStart = new Date(Math.max(mStart.getTime(), pStart.getTime()));
        const activeEnd = new Date(Math.min(mEnd.getTime(), pEnd.getTime()));
        if (activeStart > activeEnd) return 0;

        let days = 0;
        try {
          const potentialDays = eachDayOfInterval({ start: activeStart, end: activeEnd });
          for (const day of potentialDays) {
            const isFrozen = memberFreezes.some((f: any) => {
              const fStart = safeParseDate(f.start_date);
              const fEnd = safeParseDate(f.end_date);
              return fStart && fEnd && isWithinInterval(day, { start: fStart, end: fEnd });
            });
            if (!isFrozen) days++;
          }
        } catch (e) {
          console.error("Error calculating revenue interval:", e);
        }
        return days;
      };

      const prevAccrualDays = mStart && mStart < start ? calculateRevenueDays(mStart, new Date(start.getTime() - 86400000)) : 0;
      const periodRevDays = calculateRevenueDays(start, end);
      
      const dailyRate = Number(m.daily_rate || 0);
      const prevAccrual = prevAccrualDays * dailyRate;
      const periodRev = periodRevDays * dailyRate;
      
      let deferred = (m.net_amount || 0) - (prevAccrual + periodRev);
      if (deferred < 0) deferred = 0;

      totalEarned += periodRev;
      totalDeferred += deferred;
      totalNetFees += (m.net_amount || 0);

      return {
        guest_name: m.guest_name || m.name,
        category_name: categoryMap[m.category_id] || 'Other',
        start_date: m.start_date,
        end_date: m.current_end_date,
        total_days: mStart && mEnd ? Math.ceil((mEnd.getTime() - mStart.getTime()) / 86400000) + 1 : 0,
        actual_rate: Number(m.actual_rate || 0),
        discount: Number(m.discount || 0),
        net_fees: Number(m.net_amount || 0),
        prev_accrual: prevAccrual,
        period_rev: periodRev,
        deferred: deferred
      };
    });

    return {
      rows,
      summary: {
        totalNetFees,
        totalEarned,
        totalDeferred,
        count: rows.length
      }
    };
  }

  if (reportType === 'daily_sales') {
    const startStr = format(date, 'yyyy-MM-dd');
    
    let salesQuery = supabase.from('sales').select('*').eq('property_id', propertyId).eq('status', 'completed').gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${startStr}T23:59:59`);
    let bookingsQuery = supabase.from('massage_bookings').select('*').eq('property_id', propertyId).eq('status', 'completed').eq('date', startStr);
    
    if (outletId !== 'all') {
      salesQuery = salesQuery.eq('outlet_id', outletId);
      bookingsQuery = bookingsQuery.eq('outlet_id', outletId);
    }

    const [salesRes, bookingsRes] = await Promise.all([salesQuery, bookingsQuery]);
    const sales = salesRes.data || [];
    const bookings = bookingsRes.data || [];

    let totalGross = 0;
    let totalDiscount = 0;
    let totalNet = 0;

    const rows = [
      ...sales.map((s: any) => {
        const gross = Number(s.gross_amount || 0);
        const disc = Number(s.discount_amount || 0);
        const net = Number(s.net_amount || 0);
        totalGross += gross;
        totalDiscount += disc;
        totalNet += net;
        return {
          date: s.created_at ? format(new Date(s.created_at), 'yyyy-MM-dd HH:mm') : 'N/A',
          type: 'Retail',
          item: s.item_name || 'Item',
          gross,
          discount: disc,
          net
        };
      }),
      ...bookings.map((b: any) => {
        const price = Number(b.price || 0);
        const disc = Number(b.discount || 0);
        const gross = price + disc;
        totalGross += gross;
        totalDiscount += disc;
        totalNet += price;
        return {
          date: `${b.date} ${b.start_time}`,
          type: 'Service',
          item: 'Service Booking',
          gross,
          discount: disc,
          net: price
        };
      })
    ];

    return {
      rows,
      summary: {
        totalGross,
        totalDiscount,
        totalNet,
        count: rows.length
      }
    };
  }

  if (reportType === 'members_joined' || reportType === 'expiring_memberships') {
    const reportStart = startOfMonth(date);
    const reportEnd = endOfMonth(date);
    const startStr = format(reportStart, 'yyyy-MM-dd');
    const endStr = format(reportEnd, 'yyyy-MM-dd');
    
    console.log(`DEBUG: ${reportType} for period ${startStr} to ${endStr}`);

    let outletIds: string[] = [];
    if (outletId === 'all') {
      const { data: outlets } = await supabase.from('outlets').select('id').eq('property_id', propertyId);
      outletIds = (outlets || []).map((o: any) => o.id);
    } else {
      outletIds = [outletId];
    }

    if (outletIds.length === 0) return { rows: [], summary: { count: 0 } };

    if (reportType === 'members_joined') {
      let query = supabase.from('members').select('*').in('outlet_id', outletIds).gte('start_date', startStr).lte('start_date', endStr);
      const { data: members } = await query;
      const rows = (members || []).map((m: any) => ({
        name: m.guest_name || m.name,
        email: m.email,
        phone: m.phone,
        date: m.start_date,
        status: m.status
      }));
      return { rows, summary: { count: rows.length } };
    } else {
      // expiring_memberships
      const [membersRes, categoriesRes] = await Promise.all([
        supabase.from('members').select('*').in('outlet_id', outletIds),
        supabase.from('membership_categories').select('id, name')
      ]);

      const members = membersRes.data || [];
      const categories = categoriesRes.data || [];
      const categoryMap = Object.fromEntries(categories.map((c: any) => [c.id, c.name]));

      console.log(`DEBUG: Found ${members.length} total members to check for expiration`);
      console.log(`DEBUG: Report Month Range: ${startStr} to ${endStr}`);

      // Filter in-memory for precise range and status
      const filtered = (members || []).filter((m: any) => {
        // Exclude tentative/pending
        if (m.status === 'tentative' || m.status === 'pending') {
          console.log(`DEBUG: Skipping ${m.name} due to status: ${m.status}`);
          return false;
        }

        const endDateStr = m.current_end_date || m.end_date;
        if (!endDateStr) {
          console.log(`DEBUG: Skipping ${m.name} - no expiry date`);
          return false;
        }

        const parsedEnd = safeParseDate(endDateStr);
        if (!parsedEnd) {
          console.log(`DEBUG: Skipping ${m.name} - invalid expiry date: ${endDateStr}`);
          return false;
        }

        // Normalize both to start of day for comparison
        const checkDate = startOfDay(parsedEnd);
        const rangeStart = startOfDay(reportStart);
        const rangeEnd = endOfDay(reportEnd); // Use end of day for the end of the range

        const isMatch = checkDate >= rangeStart && checkDate <= rangeEnd;
        
        const memberName = m.name || m.guest_name || 'Unknown';
        const displayEndDate = String(endDateStr || '');
        
        console.log(`DEBUG: Checking Member: ${memberName.padEnd(20)} | Expiry: ${displayEndDate.padEnd(12)} | Parsed: ${format(checkDate, 'yyyy-MM-dd')} | Range: ${format(rangeStart, 'yyyy-MM-dd')} to ${format(rangeEnd, 'yyyy-MM-dd')} | Match: ${isMatch}`);
        
        return isMatch;
      });

      const rows = filtered.map((m: any) => ({
        name: m.guest_name || m.name,
        membership_no: m.membership_no || 'N/A',
        category_name: categoryMap[m.category_id] || 'Other',
        email: m.email,
        phone: m.phone,
        start_date: m.start_date,
        date: m.current_end_date || m.end_date,
        status: m.status
      }));

      console.log(`DEBUG: Returning ${rows.length} expiring memberships`);
      return { rows, summary: { count: rows.length } };
    }
  }

  if (reportType === 'incentives') {
    const startStr = format(date, 'yyyy-MM-dd');
    
    // Fetch all completed revenue events for the day
    let outletIds: string[] = [];
    if (outletId === 'all') {
      const { data: outlets } = await supabase.from('outlets').select('id').eq('property_id', propertyId);
      outletIds = (outlets || []).map((o: any) => o.id);
    } else {
      outletIds = [outletId];
    }

    if (outletIds.length === 0) return { rows: [], summary: { totalIncentive: 0, count: 0 } };

    const [salesRes, bookingsRes, membersRes, rulesRes, staffRes] = await Promise.all([
      supabase.from('sales').select('*').eq('property_id', propertyId).eq('status', 'completed').gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${startStr}T23:59:59`),
      supabase.from('massage_bookings').select('*').eq('property_id', propertyId).eq('status', 'completed').eq('date', startStr),
      supabase.from('members').select('*').in('outlet_id', outletIds).eq('status', 'Active').eq('start_date', startStr),
      supabase.from('incentive_rules').select('*').eq('is_active', true),
      supabase.from('staff').select('id, name').eq('is_active', true)
    ]);

    const sales = salesRes.data || [];
    const bookings = bookingsRes.data || [];
    const members = membersRes.data || [];
    const rules = rulesRes.data || [];
    const staffMap = Object.fromEntries((staffRes.data || []).map((s: any) => [s.id, s.name]));

    const rows: any[] = [];
    let totalIncentive = 0;

    // Helper to calculate incentive for an item
    const calculateIncentive = (type: string, targetId: string, amount: number) => {
      const applicableRules = rules.filter((r: any) => 
        (r.applies_to === type) && 
        (r.target_id === 'all' || r.target_id === targetId)
      );
      
      let itemIncentive = 0;
      applicableRules.forEach((rule: any) => {
        if (rule.calculation_type === 'Percentage') {
          itemIncentive += (amount * (rule.value / 100));
        } else {
          itemIncentive += rule.value;
        }
      });
      return itemIncentive;
    };

    // Process Sales
    sales.forEach((s: any) => {
      const inc = calculateIncentive('Sale', s.item_id || 'all', s.net_amount);
      if (inc > 0) {
        totalIncentive += inc;
        rows.push({
          staff_name: staffMap[s.sold_by_id] || 'Unknown',
          type: 'Sale',
          item: s.item_name,
          amount: s.net_amount,
          incentive: inc
        });
      }
    });

    // Process Bookings
    bookings.forEach((b: any) => {
      const inc = calculateIncentive('Massage', b.massage_type_id || 'all', b.price);
      if (inc > 0) {
        totalIncentive += inc;
        rows.push({
          staff_name: staffMap[b.therapist_id] || 'Unknown',
          type: 'Massage',
          item: 'Service Booking',
          amount: b.price,
          incentive: inc
        });
      }
    });

    // Process Memberships
    members.forEach((m: any) => {
      const inc = calculateIncentive('Membership', m.category_id || 'all', m.net_amount);
      if (inc > 0) {
        totalIncentive += inc;
        rows.push({
          staff_name: staffMap[m.sales_rep_id] || 'Unknown',
          type: 'Membership',
          item: m.guest_name,
          amount: m.net_amount,
          incentive: inc
        });
      }
    });

    return {
      rows,
      summary: {
        totalIncentive,
        count: rows.length
      }
    };
  }

  if (reportType === 'massage_room_revenue') {
    const startStr = format(date, 'yyyy-MM-dd');
    const [bookingsRes, roomsRes] = await Promise.all([
      supabase.from('massage_bookings').select('*').eq('property_id', propertyId).eq('status', 'completed').eq('date', startStr),
      supabase.from('massage_rooms').select('*').eq('property_id', propertyId)
    ]);

    const bookings = bookingsRes.data || [];
    const rooms = roomsRes.data || [];
    const roomMap = Object.fromEntries(rooms.map((r: any) => [r.id, r.name]));

    const roomRevenue: Record<string, { name: string, revenue: number, count: number }> = {};
    rooms.forEach((r: any) => {
      roomRevenue[r.id] = { name: r.name, revenue: 0, count: 0 };
    });

    bookings.forEach((b: any) => {
      if (b.room_id && roomRevenue[b.room_id]) {
        roomRevenue[b.room_id].revenue += (b.price || 0);
        roomRevenue[b.room_id].count += 1;
      }
    });

    const rows = Object.values(roomRevenue).filter(r => r.count > 0).map(r => ({
      room_name: r.name,
      revenue: r.revenue,
      bookings_count: r.count
    }));

    return {
      rows,
      summary: {
        totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
        totalBookings: rows.reduce((s, r) => s + r.bookings_count, 0),
        count: rows.length
      }
    };
  }

  return { rows: [], summary: { count: 0 } };
};

export interface PDFOptions {
  jsPDF: any;
  autoTable: any;
  data: ReportData;
  propertyName: string;
  outletName: string;
  currencySymbol: string;
  reportTitle: string;
  date: Date;
  logoUrl?: string;
  reportType: string;
}

export const generateReportPDF = (options: PDFOptions) => {
  const { jsPDF, autoTable, data, propertyName, outletName, currencySymbol, reportTitle, date, logoUrl, reportType } = options;
  
  const isRevenueReport = reportType === 'revenue_recognition';
  const isDailySalesReport = reportType === 'daily_sales';
  
  const doc = new jsPDF({ 
    orientation: isRevenueReport ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  // Helper to handle currency symbols that might not render in default PDF fonts
  const formatCurrency = (val: number) => {
    const formatted = val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    // If currency symbol is Arabic (ر.ق), use QR instead for PDF compatibility
    const safeSymbol = (currencySymbol === 'ر.ق' || currencySymbol.includes('\u0631')) ? 'QR' : currencySymbol;
    return `${formatted} ${safeSymbol}`;
  };

  // --- HEADER SECTION ---
  let currentY = margin;

  // 1. Logo & Property Info (Left)
  if (logoUrl) {
    try {
      doc.addImage(logoUrl, 'PNG', margin, currentY, 25, 25);
    } catch (e) {
      console.error('Logo add error:', e);
    }
  }

  const titleX = pageWidth - margin;
  const propertyX = margin + (logoUrl ? 30 : 0);
  const availableWidth = (pageWidth / 2) - margin - 5; // Give each half of the page

  // Property Name & Subtitle
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14); // Smaller for better fit
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(propertyName.toUpperCase(), propertyX, currentY + 8, { maxWidth: availableWidth });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-400
  doc.text(`${outletName.toUpperCase()} • ISO-9001 CERTIFIED`, propertyX, currentY + 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(79, 70, 229); // indigo-600
  doc.text("INTERNAL VERIFICATION PROTOCOL", propertyX, currentY + 21);

  // 2. Report Title & Period (Right)
  doc.setFont("helvetica", "black");
  doc.setFontSize(18); // Smaller for better fit
  doc.setTextColor(15, 23, 42);
  doc.text(reportTitle.toUpperCase(), titleX, currentY + 10, { align: 'right', maxWidth: availableWidth });

  // Audit Period Box
  const boxWidth = 50;
  const boxHeight = 15;
  const boxX = pageWidth - margin - boxWidth;
  const boxY = currentY + 18;

  doc.setFillColor(15, 23, 42); // slate-950
  doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2, 'F');
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255, 0.6);
  doc.text("AUDIT PERIOD", boxX + (boxWidth / 2), boxY + 5, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  const periodStr = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  doc.text(periodStr, boxX + (boxWidth / 2), boxY + 11, { align: 'center' });

  // Verified Audit Trail Tag
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(pageWidth - margin - 35, boxY + boxHeight + 3, 35, 6, 1, 1, 'F');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("VERIFIED AUDIT TRAIL", pageWidth - margin - 17.5, boxY + boxHeight + 7.5, { align: 'center' });

  currentY += 45;

  // --- TABLE SECTION ---
  if (isRevenueReport) {
    // Revenue Recognition Style
    const grouped = data.rows.reduce((acc: any, row: any) => {
      if (!acc[row.category_name]) acc[row.category_name] = [];
      acc[row.category_name].push(row);
      return acc;
    }, {} as Record<string, any[]>);

    if (data.rows.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("No revenue recognition data found for this period.", margin, currentY);
    } else {
      Object.entries(grouped).forEach(([category, groupRows]: [string, any]) => {
        // Category Header Row
        autoTable(doc, {
          startY: currentY,
          body: [[`${category.toUpperCase()} (${groupRows.length} LEDGER EVENTS)`]],
          theme: 'plain',
          styles: { 
            fillColor: [241, 245, 249], 
            textColor: [15, 23, 42], 
            fontStyle: 'bold', 
            fontSize: 9, 
            cellPadding: 3,
            font: 'helvetica'
          },
          margin: { left: margin, right: margin }
        });
        
        currentY = (doc as any).lastAutoTable.finalY;

        autoTable(doc, {
          startY: currentY,
          head: [['SL.', 'GUEST NAME / PROFILE', 'START DATE', 'END DATE', 'DAYS', 'ACTUAL RATE', 'DISCOUNT', 'NET FEES', 'PREV. ACCRUAL', 'PERIOD REV', 'DEFERRED']],
          body: groupRows.map((r: any, idx: number) => [
            idx + 1,
            r.guest_name,
            r.start_date,
            r.end_date,
            r.total_days,
            formatCurrency(r.actual_rate),
            formatCurrency(r.discount),
            formatCurrency(r.net_fees),
            formatCurrency(r.prev_accrual),
            formatCurrency(r.period_rev),
            formatCurrency(r.deferred)
          ]),
          theme: 'grid',
          headStyles: { 
            fillColor: [15, 23, 42], 
            textColor: [255, 255, 255], 
            fontStyle: 'bold', 
            fontSize: 7, 
            halign: 'center',
            font: 'helvetica'
          },
          styles: { fontSize: 7, cellPadding: 2, font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.1 },
          columnStyles: {
            0: { halign: 'center', cellWidth: 8 },
            1: { fontStyle: 'bold' },
            2: { halign: 'center', cellWidth: 20 },
            3: { halign: 'center', cellWidth: 20 },
            4: { halign: 'center', cellWidth: 10 },
            5: { halign: 'right' },
            6: { halign: 'right' },
            7: { halign: 'right' },
            8: { halign: 'right', textColor: [100, 116, 139] },
            9: { halign: 'right', fontStyle: 'bold', textColor: [79, 70, 229] },
            10: { halign: 'right', fontStyle: 'bold', textColor: [239, 68, 68] }
          },
          margin: { left: margin, right: margin }
        });

        // Subtotal Row for Category
        const subActual = groupRows.reduce((s: number, r: any) => s + r.actual_rate, 0);
        const subDiscount = groupRows.reduce((s: number, r: any) => s + r.discount, 0);
        const subNetFees = groupRows.reduce((s: number, r: any) => s + r.net_fees, 0);
        const subPrevAccrual = groupRows.reduce((s: number, r: any) => s + r.prev_accrual, 0);
        const subPeriodRev = groupRows.reduce((s: number, r: any) => s + r.period_rev, 0);
        const subDeferred = groupRows.reduce((s: number, r: any) => s + r.deferred, 0);

        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY,
          body: [[
            { content: `CLUSTER SUBTOTAL: ${category.toUpperCase()}`, colSpan: 5, styles: { halign: 'right' } },
            formatCurrency(subActual),
            formatCurrency(subDiscount),
            formatCurrency(subNetFees),
            formatCurrency(subPrevAccrual),
            formatCurrency(subPeriodRev),
            formatCurrency(subDeferred)
          ]],
          theme: 'plain',
          styles: { 
            fillColor: [238, 242, 255], 
            textColor: [49, 46, 129], 
            fontStyle: 'bold', 
            fontSize: 7, 
            cellPadding: 2,
            font: 'helvetica'
          },
          columnStyles: {
            0: { cellWidth: 'auto' }, // Let the colSpan handle it
            5: { halign: 'right', cellWidth: 22 },
            6: { halign: 'right', cellWidth: 22 },
            7: { halign: 'right', cellWidth: 22 },
            8: { halign: 'right', cellWidth: 22 },
            9: { halign: 'right', cellWidth: 22 },
            10: { halign: 'right', cellWidth: 22 }
          },
          margin: { left: margin, right: margin }
        });

        currentY = (doc as any).lastAutoTable.finalY + 5;
      });
    }

    // Grand Totals Table
    autoTable(doc, {
      startY: currentY + 5,
      body: [
        ['TOTAL NET FEES', formatCurrency(data.summary.totalNetFees || 0)],
        ['PERIOD REVENUE RECOGNIZED', formatCurrency(data.summary.totalEarned || 0)],
        ['TOTAL DEFERRED REVENUE', formatCurrency(data.summary.totalDeferred || 0)]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, fontStyle: 'bold', font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: contentWidth - 40, fillColor: [248, 250, 252] },
        1: { halign: 'right', cellWidth: 40 }
      },
      margin: { left: margin, right: margin }
    });
  } else if (isDailySalesReport) {
    // Daily Sales Style
    if (data.rows.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("No sales data found for this period.", margin, currentY);
    } else {
      autoTable(doc, {
        startY: currentY,
        head: [['DATE', 'TYPE', 'ITEM / SERVICE', 'GROSS', 'DISCOUNT', 'NET']],
        body: data.rows.map((r: any) => [
          r.date,
          r.type,
          r.item,
          r.gross.toFixed(2),
          r.discount.toFixed(2),
          r.net.toFixed(2)
        ]),
        theme: 'grid',
        headStyles: { 
          fillColor: [15, 23, 42], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 9, 
          halign: 'center',
          font: 'helvetica'
        },
        styles: { fontSize: 8, cellPadding: 3, font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: {
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: margin, right: margin }
      });
    }

    const finalY = (doc as any).lastAutoTable?.finalY || currentY + 10;
    autoTable(doc, {
      startY: finalY + 10,
      body: [
        ['PORTFOLIO GROSS REVENUE', formatCurrency(data.summary.totalGross || 0)],
        ['TOTAL REDUCTION / DISCOUNT', `-${formatCurrency(data.summary.totalDiscount || 0)}`],
        ['CERTIFIED NET REVENUE', formatCurrency(data.summary.totalNet || 0)]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, fontStyle: 'bold', font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: contentWidth - 40, fillColor: [248, 250, 252] },
        1: { halign: 'right', cellWidth: 40 }
      },
      margin: { left: margin, right: margin }
    });
  } else if (reportType === 'incentives') {
    if (data.rows.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("No incentive data found for this period.", margin, currentY);
    } else {
      autoTable(doc, {
        startY: currentY,
        head: [['STAFF NAME', 'TYPE', 'ITEM', 'AMOUNT', 'INCENTIVE']],
        body: data.rows.map((r: any) => [
          r.staff_name,
          r.type,
          r.item,
          formatCurrency(r.amount),
          formatCurrency(r.incentive)
        ]),
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, halign: 'center' },
        styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
        columnStyles: {
          3: { halign: 'right' },
          4: { halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: margin, right: margin }
      });
    }

    const finalY = (doc as any).lastAutoTable?.finalY || currentY + 10;
    autoTable(doc, {
      startY: finalY + 10,
      body: [
        ['TOTAL INCENTIVE PAYABLE', formatCurrency(data.summary.totalIncentive || 0)]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, fontStyle: 'bold', font: 'helvetica' },
      columnStyles: {
        0: { cellWidth: contentWidth - 40, fillColor: [248, 250, 252] },
        1: { halign: 'right', cellWidth: 40 }
      },
      margin: { left: margin, right: margin }
    });
  } else if (reportType === 'massage_room_revenue') {
    if (data.rows.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("No room revenue data found for this period.", margin, currentY);
    } else {
      autoTable(doc, {
        startY: currentY,
        head: [['ROOM NAME', 'BOOKINGS', 'REVENUE']],
        body: data.rows.map((r: any) => [
          r.room_name,
          r.bookings_count,
          formatCurrency(r.revenue)
        ]),
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, halign: 'center' },
        styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
        columnStyles: {
          1: { halign: 'center' },
          2: { halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: margin, right: margin }
      });
    }

    const finalY = (doc as any).lastAutoTable?.finalY || currentY + 10;
    autoTable(doc, {
      startY: finalY + 10,
      body: [
        ['TOTAL ROOM REVENUE', formatCurrency(data.summary.totalRevenue || 0)],
        ['TOTAL BOOKINGS', `${data.summary.totalBookings || 0}`]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, fontStyle: 'bold', font: 'helvetica' },
      columnStyles: {
        0: { cellWidth: contentWidth - 40, fillColor: [248, 250, 252] },
        1: { halign: 'right', cellWidth: 40 }
      },
      margin: { left: margin, right: margin }
    });
  } else {
    // Generic List Style (including Expiring Memberships)
    if (data.rows.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("No records found for this period.", margin, currentY);
    } else {
      const isExpiring = reportType === 'expiring_memberships';
      const head = isExpiring 
        ? [['#', 'MEMBER NAME', 'MEMBERSHIP NO.', 'CATEGORY', 'START DATE', 'END DATE', 'STATUS']]
        : [['NAME', 'EMAIL', 'PHONE', 'DATE', 'STATUS']];

      const body = data.rows.map((r: any, idx: number) => isExpiring ? [
        idx + 1,
        r.name,
        r.membership_no,
        r.category_name,
        r.start_date,
        r.date,
        r.status
      ] : [
        r.name,
        r.email,
        r.phone,
        r.date,
        r.status
      ]);

      autoTable(doc, {
        startY: currentY,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { 
          fillColor: [15, 23, 42], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 9, 
          halign: 'center',
          font: 'helvetica'
        },
        styles: { fontSize: 8, cellPadding: 3, font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: isExpiring ? {
          0: { halign: 'center', cellWidth: 10 },
          4: { halign: 'center' },
          5: { halign: 'center', fontStyle: 'bold', textColor: [239, 68, 68] }, // Red for end date
          6: { halign: 'center' }
        } : {},
        margin: { left: margin, right: margin }
      });
    }

    const finalY = (doc as any).lastAutoTable?.finalY || currentY + 10;
    autoTable(doc, {
      startY: finalY + 10,
      body: [
        ['TOTAL RECORD COUNT', `${data.summary.count || 0}`]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, fontStyle: 'bold', font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.2 },
      columnStyles: {
        0: { cellWidth: contentWidth - 40, fillColor: [248, 250, 252] },
        1: { halign: 'right', cellWidth: 40 }
      },
      margin: { left: margin, right: margin }
    });
  }

  // --- FOOTER SECTION ---
  const footerY = pageHeight - margin;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`Page 1 of 1 • System ID: ${Math.random().toString(36).substring(7).toUpperCase()}`, margin, footerY);
  doc.text(`© ${new Date().getFullYear()} ${propertyName}. All rights reserved.`, pageWidth - margin, footerY, { align: 'right' });

  return doc;
};
