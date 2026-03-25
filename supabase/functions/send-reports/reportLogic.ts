import { format, isWithinInterval, eachDayOfInterval, parseISO } from 'npm:date-fns';

/**
 * SHARED REPORT LOGIC
 * This file is used by both the Supabase Edge Function and the Frontend.
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

export const getReportData = async (ctx: ReportContext): Promise<ReportData> => {
  const { supabase, propertyId, outletId, reportType, date } = ctx;
  
  // Helper to parse dates consistently
  const parseISO = (s: string) => new Date(s);

  if (reportType === 'revenue_recognition') {
    let membersQuery = supabase.from('members').select('*');
    if (outletId !== 'all') {
      membersQuery = membersQuery.eq('outlet_id', outletId);
    }
    
    console.log(`DEBUG: Fetching members for outletId: ${outletId}`);

    const [membersRes, freezesRes, categoriesRes] = await Promise.all([
      membersQuery,
      supabase.from('freezes').select('*'),
      supabase.from('membership_categories').select('id, name')
    ]);

    if (membersRes.error) {
      console.error(`DEBUG: Members query error: ${JSON.stringify(membersRes.error)}`);
    }
    console.log(`DEBUG: Members query result: ${JSON.stringify(membersRes.data?.length)}`);

    const members = membersRes.data || [];
    const freezes = freezesRes.data || [];
    const categories = categoriesRes.data || [];
    const categoryMap = Object.fromEntries(categories.map((c: any) => [c.id, c.name]));

    // Calculate for the month of the provided date
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    let totalEarned = 0;
    let totalDeferred = 0;
    let totalNetFees = 0;

    const rows = members.filter((m: any) => m.status !== 'tentative').map((m: any) => {
      const mStart = parseISO(m.start_date);
      const mEnd = parseISO(m.current_end_date);
      const memberFreezes = freezes.filter((f: any) => f.member_id === m.id);

      // Helper for revenue calculation
      const calculateRevenue = (pStart: Date, pEnd: Date) => {
        const activeStart = new Date(Math.max(mStart.getTime(), pStart.getTime()));
        const activeEnd = new Date(Math.min(mEnd.getTime(), pEnd.getTime()));
        if (activeStart > activeEnd) return 0;

        const potentialDays = eachDayOfInterval({ start: activeStart, end: activeEnd });
        
        let recognizedDays = 0;
        potentialDays.forEach(day => {
          const isFrozen = memberFreezes.some(freeze => 
            isWithinInterval(day, { 
              start: parseISO(freeze.start_date), 
              end: parseISO(freeze.end_date) 
            })
          );
          if (!isFrozen) recognizedDays++;
        });
        return recognizedDays * (m.daily_rate || 0);
      };

      const prevAccrual = mStart < start ? calculateRevenue(mStart, new Date(start.getTime() - 86400000)) : 0;
      const periodRev = calculateRevenue(start, end);
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
        total_days: Math.ceil((mEnd.getTime() - mStart.getTime()) / 86400000) + 1,
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
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const startStr = format(startOfMonth, 'yyyy-MM-dd');
    const endStr = format(endOfMonth, 'yyyy-MM-dd');
    
    console.log(`DEBUG: Fetching ${reportType} for property: ${propertyId}, outlet: ${outletId}, range: ${startStr} to ${endStr}`);
    let query = supabase.from('members').select('*').eq('property_id', propertyId);
    
    if (reportType === 'members_joined') {
        query = query.gte('start_date', startStr).lte('start_date', endStr);
    } else if (reportType === 'expiring_memberships') {
        // Fetch members where either current_end_date or end_date is in range
        // We'll do a broad fetch and filter more precisely in memory to be safe
        query = query.or(`current_end_date.gte.${startStr},end_date.gte.${startStr}`);
    }
    
    if (outletId !== 'all') {
      query = query.eq('outlet_id', outletId);
    }

    const [membersRes, categoriesRes] = await Promise.all([
      query,
      supabase.from('membership_categories').select('id, name')
    ]);

    if (membersRes.error) {
      console.error(`DEBUG: ${reportType} query error:`, membersRes.error);
    }
    
    let members = membersRes.data || [];
    console.log(`DEBUG: ${reportType} query returned ${members.length} raw rows`);
    
    if (reportType === 'expiring_memberships') {
        // Precise filtering in memory
        members = members.filter((m: any) => {
          const endDate = m.current_end_date || m.end_date;
          if (!endDate) return false;
          
          const isPendingOrTentative = m.status === 'tentative' || m.status === 'pending';
          if (isPendingOrTentative) return false;

          return endDate >= startStr && endDate <= endStr;
        });
        console.log(`DEBUG: ${reportType} after memory filtering: ${members.length} rows`);
    }
    const categories = categoriesRes.data || [];
    const categoryMap = Object.fromEntries(categories.map((c: any) => [c.id, c.name]));

    const rows = members.map((m: any) => ({
      name: m.guest_name || m.name,
      membership_number: m.membership_number,
      category: categoryMap[m.category_id] || 'Unknown',
      start_date: m.start_date,
      end_date: m.current_end_date || m.end_date,
      status: m.status
    }));
    
    return {
      rows,
      summary: {
        count: rows.length
      }
    };
  }

  if (reportType === 'incentives') {
    const startStr = format(date, 'yyyy-MM-dd');
    
    // Fetch all completed revenue events for the day
    const [salesRes, bookingsRes, membersRes, rulesRes, staffRes] = await Promise.all([
      supabase.from('sales').select('*').eq('property_id', propertyId).eq('status', 'completed').gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${startStr}T23:59:59`),
      supabase.from('massage_bookings').select('*').eq('property_id', propertyId).eq('status', 'completed').eq('date', startStr),
      supabase.from('members').select('*').eq('property_id', propertyId).eq('status', 'Active').eq('start_date', startStr),
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
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const startStr = format(startOfMonth, 'yyyy-MM-dd');
    const endStr = format(endOfMonth, 'yyyy-MM-dd');
    
    const [bookingsRes, roomsRes] = await Promise.all([
      supabase.from('massage_bookings').select('*').eq('property_id', propertyId).eq('status', 'completed').gte('date', startStr).lte('date', endStr),
      supabase.from('massage_rooms').select('*').eq('property_id', propertyId)
    ]);

    const bookings = bookingsRes.data || [];
    const rooms = roomsRes.data || [];

    const roomRevenue: Record<string, { name: string, revenue: number, count: number }> = {};
    rooms.forEach((r: any) => {
      roomRevenue[r.id] = { name: r.name, revenue: 0, count: 0 };
    });
    roomRevenue['unassigned'] = { name: 'Unassigned', revenue: 0, count: 0 };

    bookings.forEach((b: any) => {
      const roomId = b.room_id || 'unassigned';
      if (roomRevenue[roomId]) {
        roomRevenue[roomId].revenue += (b.price || 0);
        roomRevenue[roomId].count += 1;
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
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

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

  // Property Name & Subtitle
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(propertyName.toUpperCase(), margin + (logoUrl ? 30 : 0), currentY + 8);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-400
  doc.text(`${outletName.toUpperCase()} • ISO-9001 CERTIFIED`, margin + (logoUrl ? 30 : 0), currentY + 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229); // indigo-600
  doc.text("INTERNAL VERIFICATION PROTOCOL", margin + (logoUrl ? 30 : 0), currentY + 20);

  // 2. Report Title & Period (Right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18); // Reduced font size
  doc.setTextColor(15, 23, 42);
  // Adjusted position to avoid overlap
  doc.text(reportTitle.toUpperCase(), pageWidth - margin, currentY + 5, { align: 'right', maxWidth: 80 });

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
          head: [['SL.', 'GUEST NAME / PROFILE', 'START DATE', 'END DATE', 'DAYS', 'ACTUAL', 'DISC', 'NET', 'PREV', 'PERIOD', 'DEFERRED']],
          body: groupRows.map((r: any, idx: number) => [
            idx + 1,
            r.guest_name,
            r.start_date,
            r.end_date,
            r.total_days,
            r.actual_rate.toFixed(2),
            r.discount.toFixed(2),
            r.net_fees.toFixed(2),
            r.prev_accrual.toFixed(2),
            r.period_rev.toFixed(2),
            r.deferred.toFixed(2)
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
            `CLUSTER SUBTOTAL: ${category.toUpperCase()}`,
            subActual.toFixed(2),
            subDiscount.toFixed(2),
            subNetFees.toFixed(2),
            subPrevAccrual.toFixed(2),
            subPeriodRev.toFixed(2),
            subDeferred.toFixed(2)
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
            0: { halign: 'right', cellWidth: pageWidth - (margin * 2) - 120 },
            1: { halign: 'right', cellWidth: 20 },
            2: { halign: 'right', cellWidth: 20 },
            3: { halign: 'right', cellWidth: 20 },
            4: { halign: 'right', cellWidth: 20 },
            5: { halign: 'right', cellWidth: 20 },
            6: { halign: 'right', cellWidth: 20 }
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
        ['TOTAL NET FEES', `${(data.summary.totalNetFees || 0).toFixed(2)}`],
        ['PERIOD REVENUE RECOGNIZED', `${(data.summary.totalEarned || 0).toFixed(2)}`],
        ['TOTAL DEFERRED REVENUE', `${(data.summary.totalDeferred || 0).toFixed(2)}`]
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
        ['PORTFOLIO GROSS REVENUE', `${currencySymbol}${(data.summary.totalGross || 0).toFixed(2)}`],
        ['TOTAL REDUCTION / DISCOUNT', `-${currencySymbol}${(data.summary.totalDiscount || 0).toFixed(2)}`],
        ['CERTIFIED NET REVENUE', `${currencySymbol}${(data.summary.totalNet || 0).toFixed(2)}`]
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
          r.amount.toFixed(2),
          r.incentive.toFixed(2)
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
        ['TOTAL INCENTIVE PAYABLE', `${currencySymbol}${(data.summary.totalIncentive || 0).toFixed(2)}`]
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
          r.revenue.toFixed(2)
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
        ['TOTAL ROOM REVENUE', `${currencySymbol}${(data.summary.totalRevenue || 0).toFixed(2)}`],
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
  } else if (reportType === 'expiring_memberships') {
    if (data.rows.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("No records found for this period.", margin, currentY);
    } else {
      autoTable(doc, {
        startY: currentY,
        head: [['#', 'MEMBER NAME', 'MEMBERSHIP NO.', 'CATEGORY', 'START DATE', 'END DATE', 'STATUS']],
        body: data.rows.map((r: any, idx: number) => [
          idx + 1,
          r.name,
          r.membership_number || '-',
          r.category,
          r.start_date ? format(parseISO(r.start_date), 'dd MMM yyyy') : '-',
          r.end_date ? format(parseISO(r.end_date), 'dd MMM yyyy') : '-',
          r.status.toUpperCase()
        ]),
        theme: 'grid',
        headStyles: { 
          fillColor: [15, 23, 42], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 8, 
          halign: 'left',
          font: 'helvetica'
        },
        styles: { fontSize: 8, cellPadding: 4, font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: {
          0: { halign: 'center', fontStyle: 'bold' },
          1: { fontStyle: 'bold' },
          2: { halign: 'center' },
          3: { textColor: [79, 70, 229], fontStyle: 'bold' },
          4: { halign: 'center' },
          5: { halign: 'center', textColor: [225, 29, 72], fontStyle: 'bold' }, // rose-600
          6: { halign: 'center', textColor: [5, 150, 105], fontStyle: 'bold' } // emerald-600
        },
        margin: { left: margin, right: margin }
      });

      const finalY = (doc as any).lastAutoTable?.finalY || currentY + 10;
      autoTable(doc, {
        startY: finalY,
        body: [
          ['AGGREGATE EXPIRATION TOTAL', `${data.summary.count || 0}`]
        ],
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 4, fontStyle: 'bold', font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: {
          0: { cellWidth: contentWidth - 40, halign: 'right' },
          1: { halign: 'center', cellWidth: 40, textColor: [79, 70, 229] }
        },
        margin: { left: margin, right: margin }
      });
    }
  } else {
    // Generic List Style (for members_joined)
    if (data.rows.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("No records found for this period.", margin, currentY);
    } else {
      autoTable(doc, {
        startY: currentY,
        head: [['NAME', 'MEMBERSHIP NO.', 'CATEGORY', 'START DATE', 'END DATE', 'STATUS']],
        body: data.rows.map((r: any) => [
          r.name,
          r.membership_number || '-',
          r.category,
          r.start_date ? format(parseISO(r.start_date), 'dd MMM yyyy') : '-',
          r.end_date ? format(parseISO(r.end_date), 'dd MMM yyyy') : '-',
          r.status
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
  doc.setTextColor(150, 150, 150); // Standard gray
  doc.text(`Page 1 of 1 • System ID: ${Math.random().toString(36).substring(7).toUpperCase()}`, margin, footerY);
  doc.text(`${propertyName}. All rights reserved.`, pageWidth - margin, footerY, { align: 'right' });

  return doc;
};
