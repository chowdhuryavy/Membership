
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
  const formatISO = (d: Date) => d.toISOString().split('T')[0];

  if (reportType === 'revenue_recognition') {
    let membersQuery = supabase.from('members').select('*').eq('property_id', propertyId);
    if (outletId !== 'all') {
      membersQuery = membersQuery.eq('outlet_id', outletId);
    }

    const [membersRes, freezesRes, categoriesRes] = await Promise.all([
      membersQuery,
      supabase.from('membership_freezes').select('*'),
      supabase.from('membership_categories').select('id, name')
    ]);

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

        let days = 0;
        for (let d = new Date(activeStart); d <= activeEnd; d.setDate(d.getDate() + 1)) {
          const isFrozen = memberFreezes.some((f: any) => {
            const fStart = parseISO(f.start_date);
            const fEnd = parseISO(f.end_date);
            return d >= fStart && d <= fEnd;
          });
          if (!isFrozen) days++;
        }
        return days * (m.daily_rate || 0);
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
        totalDeferred
      }
    };
  }

  if (reportType === 'daily_sales') {
    const startStr = formatISO(date);
    
    let salesQuery = supabase.from('sales').select('*').eq('property_id', propertyId).eq('status', 'completed').gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${startStr}T23:59:59`);
    let bookingsQuery = supabase.from('bookings').select('*').eq('property_id', propertyId).eq('status', 'completed').eq('date', startStr);
    
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
        totalGross += Number(s.gross_amount || 0);
        totalDiscount += Number(s.discount_amount || 0);
        totalNet += Number(s.net_amount || 0);
        return {
          date: s.created_at,
          type: 'Retail',
          item: s.item_name || 'Item',
          gross: Number(s.gross_amount || 0),
          discount: Number(s.discount_amount || 0),
          net: Number(s.net_amount || 0)
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
        totalNet
      }
    };
  }

  if (reportType === 'members_joined' || reportType === 'expiring_memberships') {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startStr = start.toISOString().split('T')[0];
    const endStr = end.toISOString().split('T')[0];
    
    const dateField = reportType === 'members_joined' ? 'start_date' : 'end_date';
    let query = supabase.from('members').select('*').eq('property_id', propertyId).gte(dateField, startStr).lte(dateField, endStr);
    
    if (outletId !== 'all') {
      query = query.eq('outlet_id', outletId);
    }
    const { data: members } = await query;
    
    return {
      rows: (members || []).map((m: any) => ({
        name: m.name,
        email: m.email,
        phone: m.phone,
        date: m[dateField],
        status: m.status
      })),
      summary: {
        count: (members || []).length
      }
    };
  }

  return { rows: [], summary: {} };
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
}

export const generateReportPDF = (options: PDFOptions) => {
  const { jsPDF, autoTable, data, propertyName, outletName, currencySymbol, reportTitle, date } = options;
  
  const isLandscape = data.rows.length > 0 && 'deferred' in data.rows[0];
  const doc = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const centerX = pageWidth / 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(15, 23, 42);
  doc.text(reportTitle, centerX, 30, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(propertyName.toUpperCase(), centerX, 38, { align: 'center' });
  
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.5);
  doc.line(20, 45, pageWidth - 20, 45);
  
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`Outlet: ${outletName}`, 20, 55);
  
  const dateStr = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', day: isLandscape ? undefined : 'numeric' });
  doc.text(`Period: ${dateStr}`, pageWidth - 20, 55, { align: 'right' });

  if (isLandscape) {
    // Revenue Recognition Style
    const grouped = data.rows.reduce((acc: any, row: any) => {
      if (!acc[row.category_name]) acc[row.category_name] = [];
      acc[row.category_name].push(row);
      return acc;
    }, {} as Record<string, any[]>);

    let currentY = 65;
    Object.entries(grouped).forEach(([category, groupRows]: [string, any]) => {
      autoTable(doc, {
        startY: currentY,
        head: [['SL.', 'Guest Name', 'Start Date', 'End Date', 'Days', 'Actual', 'Disc', 'Net', 'Prev', 'Period', 'Deferred']],
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
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, font: 'helvetica' },
        styles: { fontSize: 7, cellPadding: 2, font: 'helvetica' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          4: { halign: 'center' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right' },
          8: { halign: 'right' },
          9: { halign: 'right' },
          10: { halign: 'right' }
        }
      });
      currentY = (doc as any).lastAutoTable.finalY + 5;
    });

    autoTable(doc, {
      startY: currentY + 5,
      body: [
        ['TOTAL NET FEES', `${currencySymbol}${data.summary.totalNetFees.toFixed(2)}`],
        ['PERIOD REVENUE RECOGNIZED', `${currencySymbol}${data.summary.totalEarned.toFixed(2)}`],
        ['TOTAL DEFERRED REVENUE', `${currencySymbol}${data.summary.totalDeferred.toFixed(2)}`]
      ],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 5, fontStyle: 'bold', font: 'helvetica' },
      columnStyles: {
        0: { cellWidth: 120, fillColor: [248, 250, 252] },
        1: { halign: 'right', cellWidth: 50 }
      }
    });
  } else if (data.rows.length > 0 && 'gross' in data.rows[0]) {
    // Daily Sales Style
    autoTable(doc, {
      startY: 65,
      head: [['Date', 'Type', 'Item / Service', 'Gross', 'Discount', 'Net']],
      body: data.rows.map((r: any) => [
        r.date,
        r.type,
        r.item,
        r.gross.toFixed(2),
        r.discount.toFixed(2),
        r.net.toFixed(2)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, font: 'helvetica' },
      styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' },
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
        ['PORTFOLIO GROSS REVENUE', `${currencySymbol}${data.summary.totalGross.toFixed(2)}`],
        ['TOTAL REDUCTION / DISCOUNT', `-${currencySymbol}${data.summary.totalDiscount.toFixed(2)}`],
        ['CERTIFIED NET REVENUE', `${currencySymbol}${data.summary.totalNet.toFixed(2)}`]
      ],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 5, fontStyle: 'bold', font: 'helvetica' },
      columnStyles: {
        0: { cellWidth: 120, fillColor: [248, 250, 252] },
        1: { halign: 'right', cellWidth: 50 }
      }
    });
  } else {
    // Generic List Style (Members Joined / Expiring)
    autoTable(doc, {
      startY: 65,
      head: [['Name', 'Email', 'Phone', 'Date', 'Status']],
      body: data.rows.map((r: any) => [
        r.name,
        r.email,
        r.phone,
        r.date,
        r.status
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, font: 'helvetica' },
      styles: { fontSize: 8, cellPadding: 3, font: 'helvetica' }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 150;
    autoTable(doc, {
      startY: finalY + 10,
      body: [
        ['TOTAL RECORD COUNT', `${data.summary.count}`]
      ],
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 5, fontStyle: 'bold', font: 'helvetica' },
      columnStyles: {
        0: { cellWidth: 120, fillColor: [248, 250, 252] },
        1: { halign: 'right', cellWidth: 50 }
      }
    });
  }

  return doc;
};
