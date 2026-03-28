import { format, isWithinInterval, eachDayOfInterval, parseISO, differenceInCalendarDays, startOfMonth, endOfMonth, addMonths, parse, startOfDay, endOfDay, addDays, subDays } from 'date-fns';

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
  incentiveDept?: 'Massage' | 'Membership' | 'Personal Training';
  selectedMembershipTypeId?: string | 'all';
}

// Helper for safe date parsing - ensures consistent Local handling
const safeParseDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return null;
  
  // Try YYYY-MM-DD first (ISO-ish)
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    try {
      const parts = dateStr.split('T')[0].split('-');
      // Use new Date(y, m, d) to ensure local time parsing
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
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
  const { supabase, propertyId, outletId, reportType, date, incentiveDept, selectedMembershipTypeId } = ctx;
  
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
    if (selectedMembershipTypeId && selectedMembershipTypeId !== 'all') {
      membersQuery = membersQuery.eq('membership_type_id', selectedMembershipTypeId);
    }

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
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1); // First day of next month for exclusive end date logic

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
        
        // Ensure we only look at the intersection of the membership and the requested period
        // We use startOfDay for consistent comparison
        const activeStart = startOfDay(new Date(Math.max(mStart.getTime(), pStart.getTime())));
        const activeEnd = startOfDay(new Date(Math.min(mEnd.getTime(), pEnd.getTime())));
        
        // Exclusive end date: If start is same as end, it's 0 days
        if (activeStart >= activeEnd) return 0;

        let days = 0;
        try {
          // We iterate until activeEnd - 1 day (exclusive end date)
          const potentialDays = eachDayOfInterval({ 
            start: activeStart, 
            end: subDays(activeEnd, 1) 
          });
          for (const day of potentialDays) {
            const dStr = format(day, 'yyyy-MM-dd');
            const isFrozen = memberFreezes.some((f: any) => {
              const fStart = safeParseDate(f.start_date);
              const fEnd = safeParseDate(f.end_date);
              if (!fStart || !fEnd) return false;
              
              const fsStr = format(fStart, 'yyyy-MM-dd');
              const feStr = format(fEnd, 'yyyy-MM-dd');
              return dStr >= fsStr && dStr <= feStr;
            });
            if (!isFrozen) {
                days++;
            }
          }
        } catch (e) {
          console.error("Error calculating revenue interval:", e);
        }
        return days;
      };

      const prevAccrualDays = mStart && mStart < start ? calculateRevenueDays(mStart, start) : 0;
      const periodRevDays = calculateRevenueDays(start, end);
      
      const dailyRate = Number(m.daily_rate || 0);
      const prevAccrual = prevAccrualDays * dailyRate;
      const periodRev = periodRevDays * dailyRate;
      
      let deferred = (m.net_amount || 0) - (prevAccrual + periodRev);
      if (deferred < 0) deferred = 0;

      totalEarned += periodRev;
      totalDeferred += deferred;
      totalNetFees += (m.net_amount || 0);

      // Calculate total active days for the entire membership duration
      const totalActiveDays = calculateRevenueDays(mStart, mEnd);
      
      if (m.guest_name?.includes('Test') || m.name?.includes('Test')) {
        console.log(`DEBUG [RevRec]: ${m.guest_name || m.name}`);
        console.log(`  - Membership: ${m.start_date} to ${m.current_end_date}`);
        console.log(`  - Total Active Days: ${totalActiveDays}`);
        console.log(`  - Daily Rate: ${dailyRate}`);
        console.log(`  - Period: ${format(start, 'yyyy-MM-dd')} to ${format(end, 'yyyy-MM-dd')}`);
        console.log(`  - Period Days: ${periodRevDays}`);
        console.log(`  - Period Rev: ${periodRev}`);
      }

      return {
        guest_name: m.guest_name || m.name,
        membership_no: m.membership_number || m.membership_no || 'N/A',
        category_name: categoryMap[m.category_id] || 'Other',
        start_date: m.start_date,
        end_date: m.current_end_date,
        total_days: totalActiveDays,
        daily_rate: dailyRate,
        actual_rate: Number(m.actual_rate || 0),
        discount: Number(m.discount || 0),
        net_fees: Number(m.net_amount || 0),
        prev_accrual: prevAccrual,
        period_rev: periodRev,
        deferred: deferred,
        debug_info: `Total Active Days: ${totalActiveDays}, Period Days: ${periodRevDays}`
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
      const [membersRes, categoriesRes] = await Promise.all([
        supabase.from('members').select('*').in('outlet_id', outletIds).gte('start_date', startStr).lte('start_date', endStr),
        supabase.from('membership_categories').select('id, name')
      ]);

      const members = membersRes.data || [];
      const categories = categoriesRes.data || [];
      const categoryMap = Object.fromEntries(categories.map((c: any) => [c.id, c.name]));

      let totalGross = 0;
      let totalDiscount = 0;
      let totalNet = 0;

      const rows = members.filter((m: any) => m.status !== 'tentative').map((m: any) => {
        const actualPrice = Number(m.actual_rate || (m.net_amount + (m.discount || 0)) || 0);
        const discountAmt = Number(m.discount || 0);
        const netRev = Number(m.net_amount || 0);
        const discPercent = actualPrice > 0 ? (discountAmt / actualPrice) * 100 : 0;

        totalGross += actualPrice;
        totalDiscount += discountAmt;
        totalNet += netRev;

        return {
          date: m.start_date ? format(safeParseDate(m.start_date)!, 'dd-MM-yyyy') : 'N/A',
          name: m.guest_name || m.name,
          membership_no: m.membership_number || m.membership_no || 'N/A',
          category: categoryMap[m.category_id] || 'Other',
          check_no: m.check_no || '#---',
          item: 'Membership',
          gross: actualPrice,
          discount_percent: discPercent,
          discount_amt: discountAmt,
          net: netRev,
          status: m.status
        };
      });

      return { 
        rows, 
        summary: { 
          count: rows.length,
          totalGross,
          totalDiscount,
          totalNet
        } 
      };
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
        
        return isMatch;
      });

      const rows = filtered.map((m: any) => ({
        name: m.guest_name || m.name,
        membership_no: m.membership_number || m.membership_no || 'N/A',
        category_name: categoryMap[m.category_id] || 'Other',
        email: m.email,
        phone: m.phone,
        start_date: m.start_date ? format(safeParseDate(m.start_date)!, 'dd MMM yyyy') : 'N/A',
        date: (m.current_end_date || m.end_date) ? format(safeParseDate(m.current_end_date || m.end_date)!, 'dd MMM yyyy') : 'N/A',
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

    const dept = incentiveDept || 'Massage';

    const [salesRes, bookingsRes, membersRes, rulesRes, staffRes, inventoryRes, mTypesRes] = await Promise.all([
      dept === 'Massage' || dept === 'Personal Training' ? supabase.from('sales').select('*').eq('property_id', propertyId).eq('status', 'completed').gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${startStr}T23:59:59`) : Promise.resolve({ data: [] }),
      dept === 'Massage' || dept === 'Personal Training' ? supabase.from('massage_bookings').select('*').eq('property_id', propertyId).eq('status', 'completed').eq('date', startStr) : Promise.resolve({ data: [] }),
      dept === 'Membership' ? supabase.from('members').select('*').in('outlet_id', outletIds).eq('status', 'Active').eq('start_date', startStr) : Promise.resolve({ data: [] }),
      supabase.from('incentive_rules').select('*').eq('is_active', true),
      supabase.from('staff').select('id, name').eq('is_active', true),
      supabase.from('inventory_items').select('*'),
      supabase.from('massage_types').select('*')
    ]);

    const sales = salesRes.data || [];
    const bookings = bookingsRes.data || [];
    const members = membersRes.data || [];
    const rules = rulesRes.data || [];
    const inventory = inventoryRes.data || [];
    const mTypes = mTypesRes.data || [];
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

    // Process Sales (Only if relevant to dept)
    if (dept === 'Massage' || dept === 'Personal Training') {
      sales.forEach((s: any) => {
        const item = inventory.find(i => i.id === s.item_id);
        if (!item) return;
        
        // Filter by dept
        if (dept === 'Massage' && item.category !== 'Massage') return;
        if (dept === 'Personal Training' && item.category !== 'Personal Training') return;

        const inc = calculateIncentive(dept, s.item_id || 'all', s.net_amount);
        if (inc > 0) {
          totalIncentive += inc;
          rows.push({
            staff_name: staffMap[s.sold_by_id] || 'Unknown',
            type: dept,
            item: s.item_name,
            amount: s.net_amount,
            incentive: inc
          });
        }
      });
    }

    // Process Bookings
    if (dept === 'Massage' || dept === 'Personal Training') {
      bookings.forEach((b: any) => {
        const type = mTypes.find(t => t.id === (b.massage_type_id || b.inventory_item_id));
        if (!type) return;

        // Filter by dept
        if (dept === 'Massage' && type.category !== 'Massage') return;
        if (dept === 'Personal Training' && type.category !== 'Personal Training') return;

        const inc = calculateIncentive(dept, (b.massage_type_id || b.inventory_item_id || 'all'), b.price);
        if (inc > 0) {
          totalIncentive += inc;
          rows.push({
            staff_name: staffMap[b.therapist_id] || 'Unknown',
            type: dept,
            item: type.name,
            amount: b.price,
            incentive: inc
          });
        }
      });
    }

    // Process Memberships
    if (dept === 'Membership') {
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
    }

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
  const isExpiringReport = reportType === 'expiring_memberships';
  const isMembersJoinedReport = reportType === 'members_joined';
  
  // Robust constructor resolution
  const JsPDFConstructor = typeof jsPDF === 'function' ? jsPDF : (jsPDF.jsPDF || jsPDF.default || jsPDF);
  
  const doc = new JsPDFConstructor({ 
    orientation: 'landscape',
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
      doc.addImage(logoUrl, 'PNG', margin, currentY, 22, 22);
    } catch (e) {
      console.error('Logo add error:', e);
    }
  }

  const titleX = pageWidth - margin;
  const propertyX = margin + (logoUrl ? 28 : 0);
  const availableWidth = (pageWidth / 2) - margin - 10;

  // Property Name & Subtitle
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(propertyName.toUpperCase(), propertyX, currentY + 7, { maxWidth: availableWidth });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-400
  doc.text(`${outletName.toUpperCase()} • OPERATIONAL CONTEXT`, propertyX, currentY + 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(79, 70, 229); // indigo-600
  doc.text("INTERNAL AUDIT & VERIFICATION PROTOCOL", propertyX, currentY + 19);

  // 2. Report Title & Period (Right)
  doc.setFont("helvetica", "black");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(reportTitle.toUpperCase(), titleX, currentY + 8, { align: 'right', maxWidth: availableWidth });

  // Audit Period Box
  const boxWidth = 45;
  const boxHeight = 12;
  const boxX = pageWidth - margin - boxWidth;
  const boxY = currentY + 18;

  doc.setFillColor(15, 23, 42); // slate-950
  doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 1.5, 1.5, 'F');
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(255, 255, 255, 0.7);
  doc.text("AUDIT PERIOD", boxX + (boxWidth / 2), boxY + 4, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  const periodStr = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  doc.text(periodStr, boxX + (boxWidth / 2), boxY + 9, { align: 'center' });

  // Verified Audit Trail Tag
  doc.setFillColor(241, 245, 249); // slate-100
  doc.roundedRect(pageWidth - margin - 35, boxY + boxHeight + 3, 35, 6, 1, 1, 'F');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("VERIFIED AUDIT TRAIL", pageWidth - margin - 17.5, boxY + boxHeight + 7.5, { align: 'center' });

  // Subtle Header Divider
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(margin, boxY + boxHeight + 12, pageWidth - margin, boxY + boxHeight + 12);

  currentY = boxY + boxHeight + 20;

  const callAutoTable = (doc: any, options: any) => {
    // 1. Try doc.autoTable if it exists (plugin style)
    if (typeof doc.autoTable === 'function') {
      try {
        return doc.autoTable(options);
      } catch (e) {
        console.error('Error calling doc.autoTable:', e);
      }
    }
    
    // 2. Try calling the plugin function directly (function style)
    // In many environments, autoTable is the function itself
    const plugin = (autoTable as any).default || autoTable;
    if (typeof plugin === 'function') {
      try {
        // Modern way: autoTable(doc, options)
        return plugin(doc, options);
      } catch (e) {
        console.error('Error calling autoTable as standalone function:', e);
        
        // Fallback: try to patch the instance if it's a patching function
        try {
          if (typeof plugin.apply === 'function') {
            plugin(doc);
            if (typeof doc.autoTable === 'function') {
              return doc.autoTable(options);
            }
          }
        } catch (e2) {
          console.error('Error patching doc with autoTable:', e2);
        }
      }
    }
    
    // 3. Last ditch effort: check if it's on the constructor
    const JsPDFConstructor = doc.constructor;
    if (JsPDFConstructor && typeof (JsPDFConstructor as any).autoTable === 'function') {
      try {
        return (JsPDFConstructor as any).autoTable(doc, options);
      } catch (e) {
        console.error('Error calling JsPDF.autoTable:', e);
      }
    }

    console.error('autoTable function not found on doc or as standalone function');
    // If we can't use autoTable, we might want to at least not crash
    return null;
  };

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
        callAutoTable(doc, {
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
        
        currentY = (doc as any).lastAutoTable?.finalY || currentY + 10;

        callAutoTable(doc, {
          startY: currentY,
          head: [['SL.', 'GUEST NAME / PROFILE', 'MEMBERSHIP NO.', 'START DATE', 'END DATE', 'DAYS', 'DAILY RATE', 'ACTUAL RATE', 'DISCOUNT', 'NET FEES', 'PREV. ACCRUAL', 'PERIOD REV', 'DEFERRED']],
          body: groupRows.map((r: any, idx: number) => [
            idx + 1,
            r.guest_name,
            r.membership_no,
            r.start_date,
            r.end_date,
            r.total_days,
            formatCurrency(r.daily_rate),
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
            3: { halign: 'center', cellWidth: 18 },
            4: { halign: 'center', cellWidth: 18 },
            5: { halign: 'center', cellWidth: 10 },
            6: { halign: 'right' },
            7: { halign: 'right' },
            8: { halign: 'right' },
            9: { halign: 'right' },
            10: { halign: 'right', textColor: [100, 116, 139] },
            11: { halign: 'right', fontStyle: 'bold', textColor: [79, 70, 229] },
            12: { halign: 'right', fontStyle: 'bold', textColor: [239, 68, 68] }
          },
          margin: { left: margin, right: margin }
        });

        // Subtotal Row for Category
        const subDailyRate = groupRows.reduce((s: number, r: any) => s + r.daily_rate, 0);
        const subActual = groupRows.reduce((s: number, r: any) => s + r.actual_rate, 0);
        const subDiscount = groupRows.reduce((s: number, r: any) => s + r.discount, 0);
        const subNetFees = groupRows.reduce((s: number, r: any) => s + r.net_fees, 0);
        const subPrevAccrual = groupRows.reduce((s: number, r: any) => s + r.prev_accrual, 0);
        const subPeriodRev = groupRows.reduce((s: number, r: any) => s + r.period_rev, 0);
        const subDeferred = groupRows.reduce((s: number, r: any) => s + r.deferred, 0);

        callAutoTable(doc, {
          startY: (doc as any).lastAutoTable?.finalY || currentY + 10,
          body: [[
            { content: `CLUSTER SUBTOTAL: ${category.toUpperCase()}`, colSpan: 6, styles: { halign: 'right' } },
            formatCurrency(subDailyRate),
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
            5: { halign: 'right', cellWidth: 20 },
            6: { halign: 'right', cellWidth: 20 },
            7: { halign: 'right', cellWidth: 20 },
            8: { halign: 'right', cellWidth: 20 },
            9: { halign: 'right', cellWidth: 20 },
            10: { halign: 'right', cellWidth: 20 },
            11: { halign: 'right', cellWidth: 20 }
          },
          margin: { left: margin, right: margin }
        });

        currentY = (doc as any).lastAutoTable?.finalY || currentY + 15;
      });
    }

    // Grand Totals Table
    const totalDailyRate = data.rows.reduce((s: number, r: any) => s + r.daily_rate, 0);
    callAutoTable(doc, {
      startY: currentY + 5,
      body: [
        ['TOTAL DAILY RATE', formatCurrency(totalDailyRate)],
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
  } else if (reportType === 'members_joined') {
    // Members Joined Audit Style (Image 1)
    if (data.rows.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("No membership acquisitions found for this period.", margin, currentY);
    } else {
      callAutoTable(doc, {
        startY: currentY,
        head: [['SL.NO.', 'DATE', 'GUEST / MEMBER', 'MEMBERSHIP NO.', 'CATEGORY', 'CHECK NO.', 'ITEM / SERVICE', 'GROSS AMOUNT', 'DISC %', 'DISCOUNT AMT', 'NET REVENUE', 'REMARKS']],
        body: data.rows.map((r: any, idx: number) => [
          idx + 1,
          r.date,
          r.name,
          r.membership_no,
          r.category,
          r.check_no,
          r.item,
          r.gross.toFixed(2),
          r.discount_percent > 0 ? `${r.discount_percent.toFixed(0)}%` : '',
          r.discount_amt.toFixed(2),
          r.net.toFixed(2),
          r.status
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
          0: { halign: 'center', cellWidth: 10 },
          1: { halign: 'center', cellWidth: 18 },
          2: { fontStyle: 'bold' },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center' },
          5: { halign: 'center' },
          7: { halign: 'right' },
          8: { halign: 'center' },
          9: { halign: 'right' },
          10: { halign: 'right', fontStyle: 'bold' },
          11: { fontSize: 6, fontStyle: 'italic', textColor: [100, 116, 139] }
        },
        margin: { left: margin, right: margin }
      });

      const finalY = (doc as any).lastAutoTable?.finalY || currentY + 10;
      callAutoTable(doc, {
        startY: finalY,
        body: [[
          { content: 'AGGREGATE PORTFOLIO TOTALS', colSpan: 6, styles: { halign: 'right' } },
          data.summary.totalGross.toFixed(2),
          '',
          data.summary.totalDiscount.toFixed(2),
          data.summary.totalNet.toFixed(2),
          ''
        ]],
        theme: 'plain',
        styles: { 
          fillColor: [15, 23, 42], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 8, 
          cellPadding: 3,
          font: 'helvetica'
        },
        columnStyles: {
          6: { halign: 'right', cellWidth: 22 },
          7: { halign: 'center', cellWidth: 15 },
          8: { halign: 'right', cellWidth: 22 },
          9: { halign: 'right', cellWidth: 22 },
          10: { cellWidth: 20 }
        },
        margin: { left: margin, right: margin }
      });
    }
  } else if (isDailySalesReport) {
    // Daily Sales Style
    if (data.rows.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("No sales data found for this period.", margin, currentY);
    } else {
      callAutoTable(doc, {
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
    callAutoTable(doc, {
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
      callAutoTable(doc, {
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
    callAutoTable(doc, {
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
      callAutoTable(doc, {
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
    callAutoTable(doc, {
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
        r.status?.toUpperCase() || 'N/A'
      ] : [
        r.name,
        r.email,
        r.phone,
        r.date,
        r.status?.toUpperCase() || 'N/A'
      ]);

      callAutoTable(doc, {
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
        didParseCell: (data: any) => {
          if (isExpiring && data.section === 'body' && data.column.index === 6) {
            const status = String(data.cell.raw || '').toUpperCase();
            if (status === 'ACTIVE') {
              data.cell.styles.fillColor = [187, 247, 208]; // green-100
              data.cell.styles.textColor = [22, 101, 52]; // green-800
              data.cell.styles.fontStyle = 'bold';
            } else if (status === 'EXPIRED') {
              data.cell.styles.fillColor = [254, 226, 226]; // red-100
              data.cell.styles.textColor = [153, 27, 27]; // red-800
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
        margin: { left: margin, right: margin }
      });
    }

    const finalY = (doc as any).lastAutoTable?.finalY || currentY + 10;
    callAutoTable(doc, {
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
