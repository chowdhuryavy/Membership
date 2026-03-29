import { format, isWithinInterval, eachDayOfInterval, parseISO, differenceInCalendarDays, startOfMonth, endOfMonth, addMonths, parse, startOfDay, endOfDay, addDays, subDays } from 'date-fns';
import { RevenueEngine } from '../../services/revenueEngine';

/**
 * SHARED REPORT LOGIC
 * This file is the single source of truth for report calculations.
 * It is synced to the Supabase Edge Function via a build script.
 */

export interface ReportData {
  rows: any[];
  groupedRows?: any; // For revenue recognition grouped data
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

export const REPORT_TITLES: Record<string, string> = {
  'daily_sales': 'Daily Sales & Revenue Report',
  'revenue_recognition': 'Revenue Recognition Audit',
  'members_joined': 'Membership Acquisition Log',
  'expiring_memberships': 'Expiring Memberships Audit',
  'massage_room_revenue': 'Massage Room Revenue Report',
  'incentives': 'Incentive Audit'
};

export const getReportTitle = (type: string, dept?: string) => {
  if (type === 'incentives' && dept) {
    return `${dept} Incentive Audit`;
  }
  return REPORT_TITLES[type] || type.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
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
      supabase.from('membership_categories').select('id, name').in('outlet_id', outletIds)
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

      const prevAccrual = mStart ? RevenueEngine.calculateRevenuePeriod(m, memberFreezes, mStart, subDays(start, 1)) : 0;
      const periodRev = RevenueEngine.calculateRevenuePeriod(m, memberFreezes, start, subDays(end, 1));
      
      const dailyRate = Number(m.daily_rate || 0);
      
      let deferred = (m.net_amount || 0) - (prevAccrual + periodRev);
      if (deferred < 0) deferred = 0;

      totalEarned += periodRev;
      totalDeferred += deferred;
      totalNetFees += (m.net_amount || 0);

      // Calculate total active days for the entire membership duration
      const totalActiveDays = Math.round((m.net_amount || 0) / dailyRate) || 0;
      
      if (m.guest_name?.includes('Test') || m.name?.includes('Test')) {
        console.log(`DEBUG [RevRec]: ${m.guest_name || m.name}`);
        console.log(`  - Membership: ${m.start_date} to ${m.current_end_date}`);
        console.log(`  - Total Active Days: ${totalActiveDays}`);
        console.log(`  - Daily Rate: ${dailyRate}`);
        console.log(`  - Period: ${format(start, 'yyyy-MM-dd')} to ${format(end, 'yyyy-MM-dd')}`);
        console.log(`  - Period Rev: ${periodRev}`);
      }

      return {
        id: m.id,
        guest_name: m.guest_name || m.name,
        membership_no: m.membership_number || m.membership_no || 'N/A',
        category_name: categoryMap[m.category_id] || 'Other',
        start_date: m.start_date ? format(safeParseDate(m.start_date)!, 'dd-MM-yyyy') : 'N/A',
        end_date: m.current_end_date ? format(safeParseDate(m.current_end_date)!, 'dd-MM-yyyy') : 'N/A',
        total_days: totalActiveDays,
        daily_rate: dailyRate,
        actual_rate: Number(m.actual_rate || 0),
        discount: Number(m.discount || 0),
        net_fees: Number(m.net_amount || 0),
        prev_accrual: prevAccrual,
        period_rev: periodRev,
        deferred: deferred,
        debug_info: `Total Active Days: ${totalActiveDays}`
      };
    });

    // Group by category for the frontend/email
    const grouped = rows.reduce((acc: any, row: any) => {
      if (!acc[row.category_name]) acc[row.category_name] = [];
      acc[row.category_name].push(row);
      return acc;
    }, {});

    return {
      rows,
      groupedRows: grouped,
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

    const [salesRes, bookingsRes, guestsRes, mTypesRes] = await Promise.all([
      salesQuery, 
      bookingsQuery,
      supabase.from('guests').select('id, name'),
      supabase.from('massage_types').select('id, name, duration_minutes')
    ]);

    const sales = salesRes.data || [];
    const bookings = bookingsRes.data || [];
    const guests = guestsRes.data || [];
    const mTypes = mTypesRes.data || [];
    const guestMap = Object.fromEntries(guests.map((g: any) => [g.id, g.name]));
    const mTypeMap = Object.fromEntries(mTypes.map((t: any) => [t.id, t]));

    let totalGross = 0;
    let totalDiscount = 0;
    let totalNet = 0;

    const combined = [
      ...sales.map((s: any) => ({
        date: s.created_at,
        guest_name: s.guest_name || 'Guest',
        item_name: s.item_name || 'Item',
        mode_of_payment: s.payment_method || 'N/A',
        check_no: s.check_no || '#POS',
        gross: Number(s.gross_amount || 0),
        discount: Number(s.discount_amount || 0),
        net: Number(s.net_amount || 0),
        type: 'Retail',
        remarks: s.remarks || '',
        duration: '-'
      })),
      ...bookings.map((b: any) => {
        const type = mTypes.find(t => t.id === (b.massage_type_id || b.inventory_item_id));
        const price = Number(b.price || 0);
        const disc = Number(b.discount || 0);
        const gross = price + disc;
        return {
          date: `${b.date}T${b.start_time}`,
          guest_name: guestMap[b.guest_id] || 'Guest',
          item_name: type?.name || 'Service',
          mode_of_payment: 'Service',
          check_no: '#SVC',
          gross,
          discount: disc,
          net: price,
          type: 'Service',
          remarks: b.notes || '',
          duration: type ? `${type.duration_minutes}m` : '-'
        };
      })
    ].sort((a, b) => a.date.localeCompare(b.date));

    const rows = combined.map((c, idx) => {
      totalGross += c.gross;
      totalDiscount += c.discount;
      totalNet += c.net;
      const discPercent = c.gross > 0 ? (c.discount / c.gross * 100) : 0;
      
      return {
        id: `sales-${idx}`,
        sl_no: idx + 1,
        date: format(new Date(c.date), 'dd-MMM-yy'),
        guest_name: c.guest_name,
        item_name: c.item_name,
        mode_of_payment: c.mode_of_payment,
        check_no: c.check_no,
        actual_price: c.gross,
        discount_percent: discPercent,
        discount_amount: c.discount,
        net_revenue: c.net,
        remarks: c.remarks,
        duration: c.duration,
        staff_splits: {}
      };
    });

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

  if (reportType === 'members_joined') {
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

    const rows = members.filter((m: any) => m.status !== 'tentative').map((m: any, idx: number) => {
      const actualPrice = Number(m.actual_rate || (m.net_amount + (m.discount || 0)) || 0);
      const discountAmt = Number(m.discount || 0);
      const netRev = Number(m.net_amount || 0);
      const discPercent = actualPrice > 0 ? (discountAmt / actualPrice) * 100 : 0;

      totalGross += actualPrice;
      totalDiscount += discountAmt;
      totalNet += netRev;

      return {
        id: m.id,
        sl_no: idx + 1,
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
        remarks: m.status
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
  }

  if (reportType === 'expiring_memberships') {
    const reportStart = startOfMonth(date);
    const reportEnd = endOfMonth(date);
    const startStr = format(reportStart, 'yyyy-MM-dd');
    const endStr = format(reportEnd, 'yyyy-MM-dd');
    
    console.log(`DEBUG: Expiring memberships for period ${startStr} to ${endStr}`);

    let outletIds: string[] = [];
    if (outletId === 'all') {
      const { data: outlets } = await supabase.from('outlets').select('id').eq('property_id', propertyId);
      outletIds = (outlets || []).map((o: any) => o.id);
    } else {
      outletIds = [outletId];
    }

    if (outletIds.length === 0) return { rows: [], summary: { count: 0 } };

    const [membersRes, categoriesRes] = await Promise.all([
      supabase.from('members').select('*').in('outlet_id', outletIds),
      supabase.from('membership_categories').select('id, name')
    ]);

    const members = membersRes.data || [];
    const categories = categoriesRes.data || [];
    const categoryMap = Object.fromEntries(categories.map((c: any) => [c.id, c.name]));

    console.log(`DEBUG: Found ${members.length} total members to check for expiration`);

    // Filter in-memory for precise range and status
    const filtered = (members || []).filter((m: any) => {
      // Exclude tentative/pending
      if (m.status === 'tentative' || m.status === 'pending') {
        return false;
      }

      const endDateStr = m.current_end_date || m.end_date;
      if (!endDateStr) {
        return false;
      }

      const parsedEnd = safeParseDate(endDateStr);
      if (!parsedEnd) {
        return false;
      }

      // Normalize both to start of day for comparison
      const checkDate = startOfDay(parsedEnd);
      const rangeStart = startOfDay(reportStart);
      const rangeEnd = endOfDay(reportEnd); // Use end of day for the end of the range

      const isMatch = checkDate >= rangeStart && checkDate <= rangeEnd;
      
      return isMatch;
    });

    const rows = filtered.map((m: any, idx: number) => ({
      id: m.id,
      sl_no: idx + 1,
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

  if (reportType === 'incentives') {
    const startStr = format(date, 'yyyy-MM-dd');
    
    let outletIds: string[] = [];
    if (outletId === 'all') {
      const { data: outlets } = await supabase.from('outlets').select('id').eq('property_id', propertyId);
      outletIds = (outlets || []).map((o: any) => o.id);
    } else {
      outletIds = [outletId];
    }

    if (outletIds.length === 0) return { rows: [], summary: { totalIncentive: 0, count: 0, staffList: [] } };

    const dept = incentiveDept || 'Massage';

    const [salesRes, bookingsRes, membersRes, rulesRes, staffRes, inventoryRes, mTypesRes, categoriesRes, guestsRes] = await Promise.all([
      supabase.from('sales').select('*').in('outlet_id', outletIds).eq('status', 'completed').gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${startStr}T23:59:59`),
      supabase.from('massage_bookings').select('*').in('outlet_id', outletIds).eq('status', 'completed').eq('date', startStr),
      supabase.from('members').select('*').in('outlet_id', outletIds).neq('status', 'tentative').gte('start_date', startStr).lte('start_date', startStr),
      supabase.from('incentive_rules').select('*').eq('property_id', propertyId).eq('is_active', true),
      supabase.from('staff').select('*, leaves:staff_leaves(*)').eq('property_id', propertyId),
      supabase.from('inventory_items').select('*').eq('property_id', propertyId),
      supabase.from('massage_types').select('*').eq('property_id', propertyId),
      supabase.from('membership_categories').select('*'),
      supabase.from('guests').select('id, name')
    ]);

    const bookings = bookingsRes.data || [];
    const members = membersRes.data || [];
    const rules = rulesRes.data || [];
    const staffList = staffRes.data || [];
    const inventory = inventoryRes.data || [];
    const mTypes = mTypesRes.data || [];
    const mCats = categoriesRes.data || [];
    const guests = guestsRes.data || [];
    const guestMap = Object.fromEntries(guests.map((g: any) => [g.id, g.name]));

    const rows: any[] = [];
    let sl = 1;

    if (dept === 'Massage') {
      bookings.filter(b => {
        const type = mTypes.find(m => m.id === (b.massage_type_id || b.inventory_item_id));
        return type?.category === 'Massage';
      }).forEach(b => {
        const type = mTypes.find(m => m.id === (b.massage_type_id || b.inventory_item_id));
        if (!type) return;
        const rule = findBestRule(rules, 'Massage', (b.massage_type_id || b.inventory_item_id || ''), type.price, type.duration_minutes);
        
        const actualPrice = type.price;
        const discountAmt = b.discount || 0;
        const netRev = actualPrice - discountAmt;
        const discPercent = actualPrice > 0 ? (discountAmt / actualPrice) * 100 : 0;

        let baseInc = 0;
        let incDiscVal = 0;
        let incNet = 0;
        const staffSplits: Record<string, number> = {};

        if (rule) {
          baseInc = rule.calculation_type === 'Fixed' ? rule.value : (actualPrice * rule.value / 100);
          incDiscVal = (rule.apply_discount_percentage !== false) ? (baseInc * discPercent) / 100 : 0;
          incNet = baseInc - incDiscVal;

          if (b.therapist_id) {
            const therapist = staffList.find(s => s.id === b.therapist_id);
            if (therapist && therapist.is_eligible_for_incentives !== false && !isStaffOnLeaveOnDate(therapist, b.date) && !isStaffOnProbationOnDate(therapist, b.date)) {
              staffSplits[b.therapist_id] = incNet;
            }
          }
        }

        rows.push({
          id: b.id,
          sl_no: sl++,
          date: format(new Date(`${b.date}T${b.start_time}`), 'dd-MMM-yy'),
          guest_name: guestMap[b.guest_id] || 'Guest',
          item_name: type.name,
          therapist_name: staffList.find(s => s.id === b.therapist_id)?.name || 'N/A',
          actual_price: actualPrice,
          discount_percent: discPercent,
          discount_amount: discountAmt,
          net_revenue: netRev,
          inc_total: baseInc,
          inc_discount_percent: discPercent,
          inc_discount_val: incDiscVal,
          inc_net: incNet,
          remarks: !rule ? 'No Rule' : '',
          staff_splits: staffSplits
        });
      });
    } else if (dept === 'Membership') {
      members.forEach(m => {
        const cat = mCats.find(c => c.id === m.category_id);
        if (!cat) return;
        const rule = findBestRule(rules, 'Membership', m.category_id, m.net_amount, 0);
        if (!rule) return;

        const actualPrice = m.actual_rate || (m.net_amount + (m.discount || 0));
        const discountAmt = m.discount || 0;
        const netRev = m.net_amount;
        const discPercent = actualPrice > 0 ? (discountAmt / actualPrice) * 100 : 0;

        const baseInc = rule.calculation_type === 'Fixed' ? rule.value : (actualPrice * rule.value / 100);
        const incDiscVal = (rule.apply_discount_percentage !== false) ? (baseInc * discPercent) / 100 : 0;
        const incNet = baseInc - incDiscVal;

        const staffSplits: Record<string, number> = {};
        if (rule.distribution_type === 'Shared') {
          let available = staffList.filter(s => s.is_active && (s.is_eligible_for_incentives !== false) && !isStaffOnLeaveOnDate(s, m.start_date) && !isStaffOnProbationOnDate(s, m.start_date));
          if (available.length > 0) {
            const share = incNet / available.length;
            available.forEach(s => staffSplits[s.id] = share);
          }
        } else if (m.sales_rep_id) {
          const staff = staffList.find(s => s.id === m.sales_rep_id);
          if (staff && staff.is_eligible_for_incentives !== false) {
            staffSplits[m.sales_rep_id] = incNet;
          }
        }

        rows.push({
          id: m.id,
          sl_no: sl++,
          date: format(new Date(m.start_date), 'dd-MMM-yy'),
          guest_name: m.guest_name,
          item_name: cat.name,
          therapist_name: rule.distribution_type === 'Shared' ? 'Shared' : (staffList.find(s => s.id === m.sales_rep_id)?.name || 'N/A'),
          actual_price: actualPrice,
          discount_percent: discPercent,
          discount_amount: discountAmt,
          net_revenue: netRev,
          inc_total: baseInc,
          inc_discount_percent: discPercent,
          inc_discount_val: incDiscVal,
          inc_net: incNet,
          remarks: m.remarks || '',
          staff_splits: staffSplits
        });
      });
    }

    const totalIncentive = rows.reduce((sum, r) => sum + r.inc_net, 0);

    return {
      rows,
      summary: {
        totalIncentive,
        count: rows.length,
        staffList: staffList.filter((s: any) => s.is_active && s.is_eligible_for_incentives !== false)
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
    
    // Group by date for a more detailed report (though for a single day it's just one row)
    const dates = [...new Set(bookings.map(b => b.date))].sort();
    
    const dailyData = dates.map(date => {
      const dayBookings = bookings.filter(b => b.date === date);
      const roomRevenue: Record<string, number> = {};
      rooms.forEach(r => {
        roomRevenue[r.name] = dayBookings.filter(b => b.room_id === r.id).reduce((sum, b) => sum + b.price, 0);
      });
      const unassigned = dayBookings.filter(b => !b.room_id).reduce((sum, b) => sum + b.price, 0);
      const total = dayBookings.reduce((sum, b) => sum + b.price, 0);
      
      return {
        date,
        ...roomRevenue,
        unassigned,
        total
      };
    });

    return {
      rows: dailyData,
      summary: {
        rooms: rooms.map(r => r.name),
        totalRevenue: bookings.reduce((s, b) => s + (b.price || 0), 0),
        totalBookings: bookings.length,
        count: dailyData.length
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
  
  if (!JsPDFConstructor) {
    console.error('DEBUG: jsPDF constructor not found', { jsPDFType: typeof jsPDF });
    throw new Error('jsPDF constructor not found');
  }

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
    const formatted = val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    // If currency symbol is Arabic (ر.ق), use QR instead for PDF compatibility
    const safeSymbol = (currencySymbol === 'ر.ق' || currencySymbol.includes('\u0631')) ? 'QR' : currencySymbol;
    return `${safeSymbol} ${formatted}`;
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

  const propertyX = margin + (logoUrl ? 28 : 0);
  const titleX = pageWidth - margin;
  const availableWidth = (pageWidth / 2) - margin - 10;

  // Vertical line between logo and property name
  if (logoUrl) {
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(margin + 24, currentY, margin + 24, currentY + 22);
  }

  // Property Name & Subtitle
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(propertyName.toUpperCase(), propertyX, currentY + 7, { maxWidth: availableWidth });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-400
  doc.text(`${outletName.toUpperCase()} • ISO-9001 CERTIFIED`, propertyX, currentY + 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(79, 70, 229); // indigo-600
  // Add a small circle/bullet for the "Internal Verification Protocol"
  doc.setFillColor(79, 70, 229);
  doc.circle(propertyX + 1, currentY + 18.5, 0.5, 'F');
  doc.text("INTERNAL VERIFICATION PROTOCOL", propertyX + 3, currentY + 19);

  // 2. Report Title & Period (Right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  doc.text(reportTitle.toUpperCase(), titleX, currentY + 8, { align: 'right', maxWidth: availableWidth });

  // Audit Period Box
  const boxWidth = 50;
  const boxHeight = 14;
  const boxX = pageWidth - margin - boxWidth;
  const boxY = currentY + 18;

  doc.setFillColor(15, 23, 42); // slate-950
  doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2, 'F');
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6);
  doc.setTextColor(255, 255, 255, 0.7);
  doc.text("AUDIT PERIOD", boxX + (boxWidth / 2), boxY + 5, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  // For daily sales, show the full date. For others, show month/year.
  const periodStr = reportType === 'daily_sales' 
    ? format(date, 'dd MMMM yyyy').toUpperCase()
    : format(date, 'MMMM yyyy').toUpperCase();
  doc.text(periodStr, boxX + (boxWidth / 2), boxY + 10, { align: 'center' });

  // Verified Audit Trail Tag
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(pageWidth - margin - 40, boxY + boxHeight + 4, 40, 7, 1, 1, 'F');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  // Small circle for audit trail
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.circle(pageWidth - margin - 37, boxY + boxHeight + 7.5, 0.8, 'D');
  doc.text("VERIFIED AUDIT TRAIL", pageWidth - margin - 18, boxY + boxHeight + 8.5, { align: 'center' });

  // Subtle Header Divider
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(margin, boxY + boxHeight + 15, pageWidth - margin, boxY + boxHeight + 15);

  currentY = boxY + boxHeight + 22;

  const callAutoTable = (doc: any, options: any) => {
    // 1. Try doc.autoTable if it exists (plugin style)
    if (typeof doc.autoTable === 'function') {
      try {
        return doc.autoTable(options);
      } catch (e) {
        console.error('DEBUG: Error calling doc.autoTable:', e.message);
      }
    }
    
    // 2. Try calling the plugin function directly (function style)
    const plugin = (autoTable as any).default || autoTable;
    if (typeof plugin === 'function') {
      try {
        // Modern way: autoTable(doc, options)
        return plugin(doc, options);
      } catch (e) {
        console.error('DEBUG: Error calling autoTable as standalone function:', e.message);
        
        // Fallback: try to patch the instance manually if it's a patching function
        try {
          plugin(doc);
          if (typeof doc.autoTable === 'function') {
            return doc.autoTable(options);
          }
        } catch (e2) {
          console.error('DEBUG: Error manual patching doc with autoTable:', e2.message);
        }
      }
    }
    
    // 3. Last ditch effort: check if it's on the constructor or global
    const Constructor = doc.constructor || JsPDFConstructor;
    if (Constructor && typeof (Constructor as any).autoTable === 'function') {
      try {
        return (Constructor as any).autoTable(doc, options);
      } catch (e) {
        console.error('DEBUG: Error calling Constructor.autoTable:', e.message);
      }
    }

    // 4. Final fallback: manually attach if we have the plugin
    if (typeof plugin === 'function') {
      try {
        doc.autoTable = function(opts: any) { return plugin(this, opts); };
        return doc.autoTable(options);
      } catch (e) {
        console.error('DEBUG: Final fallback autoTable failed:', e.message);
      }
    }

    console.error('DEBUG: autoTable function not found on doc or as standalone function');
    return null;
  };

  // --- TABLE SECTION ---
  if (isRevenueReport) {
    // Use grouped data from reportData if available, otherwise group on the fly
    const grouped = data.groupedRows || data.rows.reduce((acc: any, row: any) => {
      if (!acc[row.category_name]) acc[row.category_name] = [];
      acc[row.category_name].push(row);
      return acc;
    }, {} as Record<string, any[]>);

    if (data.rows.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("No revenue recognition data found for this period.", margin, currentY);
    } else {
      let grandTotals = {
        daily_rate: 0,
        actual_rate: 0,
        discount: 0,
        net_fees: 0,
        prev_accrual: 0,
        period_rev: 0,
        deferred: 0
      };
      
      Object.entries(grouped).forEach(([category, groupRows]: [string, any]) => {
        const groupRowsArray = groupRows as any[];
        
        // Calculate subtotals for this category
        const subtotals = {
          daily_rate: groupRowsArray.reduce((s: number, r: any) => s + (r.daily_rate || 0), 0),
          actual_rate: groupRowsArray.reduce((s: number, r: any) => s + (r.actual_rate || 0), 0),
          discount: groupRowsArray.reduce((s: number, r: any) => s + (r.discount || 0), 0),
          net_fees: groupRowsArray.reduce((s: number, r: any) => s + (r.net_fees || 0), 0),
          prev_accrual: groupRowsArray.reduce((s: number, r: any) => s + (r.prev_accrual || 0), 0),
          period_rev: groupRowsArray.reduce((s: number, r: any) => s + (r.period_rev || 0), 0),
          deferred: groupRowsArray.reduce((s: number, r: any) => s + (r.deferred || 0), 0)
        };
        
        // Update grand totals
        grandTotals.daily_rate += subtotals.daily_rate;
        grandTotals.actual_rate += subtotals.actual_rate;
        grandTotals.discount += subtotals.discount;
        grandTotals.net_fees += subtotals.net_fees;
        grandTotals.prev_accrual += subtotals.prev_accrual;
        grandTotals.period_rev += subtotals.period_rev;
        grandTotals.deferred += subtotals.deferred;
        
        // Category Header Row
        callAutoTable(doc, {
          startY: currentY,
          body: [[`${category.toUpperCase()} (${groupRowsArray.length} LEDGER EVENTS)`]],
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
          head: [['SL.', 'GUEST NAME / PROFILE', 'START DATE', 'END DATE', 'DAYS', 'DAILY RATE', 'ACTUAL RATE', 'DISCOUNT', 'NET FEES', 'PREV. ACCRUAL', 'PERIOD REV', 'DEFERRED']],
          body: groupRowsArray.map((r: any, idx: number) => [
            idx + 1,
            r.guest_name,
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
            3: { halign: 'center', cellWidth: 20 },
            4: { halign: 'center', cellWidth: 10 },
            5: { halign: 'right' },
            6: { halign: 'right' },
            7: { halign: 'right' },
            8: { halign: 'right' },
            9: { halign: 'right', textColor: [100, 116, 139] },
            10: { halign: 'right', fontStyle: 'bold', textColor: [79, 70, 229] },
            11: { halign: 'right', fontStyle: 'bold', textColor: [239, 68, 68] }
          },
          margin: { left: margin, right: margin }
        });

        // Subtotal Row for Category
        callAutoTable(doc, {
          startY: (doc as any).lastAutoTable?.finalY || currentY + 10,
          body: [[
            { content: `CLUSTER SUBTOTAL: ${category.toUpperCase()}`, colSpan: 5, styles: { halign: 'right' } },
            formatCurrency(subtotals.daily_rate),
            formatCurrency(subtotals.actual_rate),
            formatCurrency(subtotals.discount),
            formatCurrency(subtotals.net_fees),
            formatCurrency(subtotals.prev_accrual),
            formatCurrency(subtotals.period_rev),
            formatCurrency(subtotals.deferred)
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
      
      // Grand Total Row
      callAutoTable(doc, {
        startY: currentY + 5,
        body: [[
          { content: "VERIFIED PORTFOLIO TOTAL", colSpan: 5, styles: { halign: 'right', fontStyle: 'bold' } },
          formatCurrency(grandTotals.daily_rate),
          formatCurrency(grandTotals.actual_rate),
          formatCurrency(grandTotals.discount),
          formatCurrency(grandTotals.net_fees),
          formatCurrency(grandTotals.prev_accrual),
          formatCurrency(grandTotals.period_rev),
          formatCurrency(grandTotals.deferred)
        ]],
        theme: 'plain',
        styles: { 
          fillColor: [15, 23, 42], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 7, 
          cellPadding: 2,
          font: 'helvetica'
        },
        columnStyles: {
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
    }
  } else if (reportType === 'members_joined') {
    // Members Joined Audit Style
    if (data.rows.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("No membership acquisitions found for this period.", margin, currentY);
    } else {
      callAutoTable(doc, {
        startY: currentY,
        head: [['SL.NO.', 'DATE', 'GUEST / MEMBER', 'CATEGORY', 'CHECK NO.', 'ITEM / SERVICE', 'GROSS AMOUNT', 'DISC %', 'DISCOUNT AMT', 'NET REVENUE', 'REMARKS']],
        body: data.rows.map((r: any, idx: number) => [
          idx + 1,
          r.date,
          r.name,
          r.category,
          r.check_no,
          r.item,
          formatCurrency(r.gross),
          r.discount_percent > 0 ? `${r.discount_percent.toFixed(0)}%` : '',
          formatCurrency(r.discount_amt),
          formatCurrency(r.net),
          r.remarks
        ]),
        foot: [[
          { content: 'AGGREGATE PORTFOLIO TOTALS', colSpan: 6, styles: { halign: 'right' } },
          { content: formatCurrency(data.summary.totalGross), styles: { halign: 'right' } },
          { content: '', styles: {} },
          { content: formatCurrency(data.summary.totalDiscount), styles: { halign: 'right' } },
          { content: formatCurrency(data.summary.totalNet), styles: { halign: 'right' } },
          { content: '', styles: {} }
        ]],
        footStyles: { 
          fillColor: [15, 23, 42], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 7, 
          cellPadding: 2,
          font: 'helvetica'
        },
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
          3: { halign: 'center' },
          4: { halign: 'center' },
          6: { halign: 'right' },
          7: { halign: 'center' },
          8: { halign: 'right' },
          9: { halign: 'right', fontStyle: 'bold' },
          10: { fontSize: 6, fontStyle: 'italic', textColor: [100, 116, 139] }
        },
        margin: { left: margin, right: margin }
      });
    }
  } else if (reportType === 'daily_sales') {
    // Daily Sales Style
    if (data.rows.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("No sales data found for this period.", margin, currentY);
    } else {
      callAutoTable(doc, {
        startY: currentY,
        head: [['SL.NO.', 'DATE', 'GUEST / MEMBER', 'DURATION', 'CHECK NO.', 'PAYMENT MODE', 'ITEM / SERVICE', 'GROSS AMOUNT', 'DISC %', 'DISCOUNT AMT', 'NET REVENUE', 'REMARKS']],
        body: data.rows.map((r: any) => [
          r.sl_no,
          r.date,
          r.guest_name,
          r.duration || '-',
          r.check_no,
          r.mode_of_payment,
          r.item_name,
          r.actual_price.toFixed(2),
          r.discount_percent > 0 ? `${r.discount_percent.toFixed(0)}%` : '',
          r.discount_amount.toFixed(2),
          r.net_revenue.toFixed(2),
          r.remarks
        ]),
        foot: [[
          { content: 'AGGREGATE PORTFOLIO TOTALS', colSpan: 7, styles: { halign: 'right' } },
          { content: data.summary.totalGross.toFixed(2), styles: { halign: 'right' } },
          { content: '', styles: {} },
          { content: data.summary.totalDiscount.toFixed(2), styles: { halign: 'right' } },
          { content: data.summary.totalNet.toFixed(2), styles: { halign: 'right' } },
          { content: '', styles: {} }
        ]],
        footStyles: { 
          fillColor: [15, 23, 42], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 6, 
          cellPadding: 2,
          font: 'helvetica'
        },
        theme: 'grid',
        headStyles: { 
          fillColor: [15, 23, 42], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 7, 
          halign: 'center',
          font: 'helvetica'
        },
        styles: { fontSize: 6, cellPadding: 2, font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { halign: 'center', cellWidth: 18 },
          2: { fontStyle: 'bold', cellWidth: 30 },
          3: { halign: 'center', cellWidth: 15 },
          4: { halign: 'center', cellWidth: 15 },
          5: { halign: 'center', cellWidth: 20 },
          6: { cellWidth: 30 },
          7: { halign: 'right', cellWidth: 20 },
          8: { halign: 'center', cellWidth: 12 },
          9: { halign: 'right', cellWidth: 20 },
          10: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
          11: { fontSize: 5, cellWidth: 25 }
        },
        margin: { left: margin, right: margin }
      });
    }
  } else if (reportType === 'incentives') {
    if (data.rows.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("No incentive data found for this period.", margin, currentY);
    } else {
      const staffList = data.summary.staffList || [];
      const staffHeaders = staffList.map((s: any) => s.name.toUpperCase());
      
      const head = [
        ['SL.NO.', 'DATE', 'GUEST / MEMBER', 'ITEM / SERVICE', 'STAFF', 'ACTUAL PRICE', 'DISC %', 'DISCOUNT AMT', 'NET REVENUE', 'INC TOTAL', 'INC DISC %', 'INC DISC VAL', 'INC NET', 'REMARKS', ...staffHeaders]
      ];

      const body = data.rows.map((r: any) => {
        const row = [
          r.sl_no,
          r.date,
          r.guest_name,
          r.item_name,
          r.therapist_name,
          r.actual_price.toFixed(2),
          r.discount_percent > 0 ? `${r.discount_percent.toFixed(0)}%` : '',
          r.discount_amount.toFixed(2),
          r.net_revenue.toFixed(2),
          r.inc_total.toFixed(2),
          r.inc_discount_percent > 0 ? `${r.inc_discount_percent.toFixed(0)}%` : '',
          r.inc_discount_val.toFixed(2),
          r.inc_net.toFixed(2),
          r.remarks
        ];
        
        // Add staff splits
        staffList.forEach((s: any) => {
          const split = r.staff_splits[s.id];
          row.push(split && split > 0 ? split.toFixed(2) : '');
        });
        
        return row;
      });

      const staffTotals = staffList.map((s: any) => {
        const total = data.rows.reduce((sum: number, r: any) => sum + (r.staff_splits[s.id] || 0), 0);
        return total > 0 ? total.toFixed(2) : '0.00';
      });

      callAutoTable(doc, {
        startY: currentY,
        head: head,
        body: body,
        foot: [[
          { content: 'AGGREGATE INCENTIVE TOTALS', colSpan: 12, styles: { halign: 'right' } },
          { content: data.summary.totalIncentive.toFixed(2), styles: { halign: 'right' } },
          { content: '', styles: {} },
          ...staffTotals.map((t: string) => ({ content: t, styles: { halign: 'right' } }))
        ]],
        footStyles: { 
          fillColor: [15, 23, 42], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 5, 
          cellPadding: 1,
          font: 'helvetica'
        },
        theme: 'grid',
        headStyles: { 
          fillColor: [15, 23, 42], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 5, 
          halign: 'center',
          font: 'helvetica'
        },
        styles: { fontSize: 4.5, cellPadding: 1, font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: {
          0: { halign: 'center', cellWidth: 6 },
          1: { halign: 'center', cellWidth: 12 },
          2: { fontStyle: 'bold', cellWidth: 20 },
          3: { cellWidth: 20 },
          4: { fontStyle: 'bold', cellWidth: 15 },
          5: { halign: 'right', cellWidth: 14 },
          6: { halign: 'center', cellWidth: 8 },
          7: { halign: 'right', cellWidth: 14 },
          8: { halign: 'right', cellWidth: 14 },
          9: { halign: 'right', cellWidth: 14 },
          10: { halign: 'center', cellWidth: 8 },
          11: { halign: 'right', cellWidth: 14 },
          12: { halign: 'right', fontStyle: 'bold', cellWidth: 14 },
          13: { fontSize: 4, cellWidth: 15 }
        },
        margin: { left: margin, right: margin }
      });
    }
  } else if (reportType === 'massage_room_revenue') {
    if (data.rows.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("No room revenue data found for this period.", margin, currentY);
    } else {
      const rooms = data.summary.rooms || [];
      const tableHeaders = [
        'DATE',
        ...rooms,
        'UNASSIGNED',
        'DAILY TOTAL'
      ];

      const tableData = data.rows.map((item: any) => [
        item.date,
        ...rooms.map((r: string) => formatCurrency(item[r] || 0)),
        formatCurrency(item.unassigned || 0),
        formatCurrency(item.total || 0)
      ]);

      callAutoTable(doc, {
        startY: currentY,
        head: [tableHeaders],
        body: tableData,
        foot: [[
          { content: 'TOTAL REVENUE', colSpan: rooms.length + 2, styles: { halign: 'right' } },
          { content: formatCurrency(data.summary.totalRevenue || 0), styles: { halign: 'right' } }
        ]],
        footStyles: { 
          fillColor: [15, 23, 42], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 6, 
          cellPadding: 2,
          font: 'helvetica'
        },
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
        styles: { fontSize: 6, cellPadding: 2, font: 'helvetica' },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 20 },
          ...Object.fromEntries(rooms.map((_: any, i: number) => [i + 1, { halign: 'right' }])),
          [rooms.length + 1]: { halign: 'right' },
          [rooms.length + 2]: { halign: 'right', fontStyle: 'bold', fillColor: [248, 250, 252] }
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

// --- INCENTIVE HELPERS ---

export function findBestRule(rules: any[], department: string, itemId: string, price: number, duration: number) {
  // 1. Exact item match
  const exact = rules.find(r => r.department === department && r.item_id === itemId);
  if (exact) return exact;

  // 2. Department match with price/duration criteria (if applicable)
  // For now, just return the first rule for that department if no exact match
  const deptRule = rules.find(r => r.department === department && !r.item_id);
  return deptRule;
}

export function isStaffOnLeaveOnDate(staff: any, dateStr: string) {
  if (!staff.leaves || !Array.isArray(staff.leaves)) return false;
  const date = new Date(dateStr);
  return staff.leaves.some((l: any) => {
    const start = new Date(l.start_date);
    const end = new Date(l.end_date);
    return date >= start && date <= end && l.status === 'approved';
  });
}

export function isStaffOnProbationOnDate(staff: any, dateStr: string) {
  if (!staff.probation_end_date) return false;
  const date = new Date(dateStr);
  const probationEnd = new Date(staff.probation_end_date);
  return date < probationEnd;
}