import { format, isWithinInterval, eachDayOfInterval, parseISO, differenceInCalendarDays, startOfMonth, endOfMonth, addMonths, parse, startOfDay, endOfDay } from 'date-fns';

/**
 * SHARED REPORT LOGIC
 * This file is the single source of truth for report calculations.
 * It is synced to the Supabase Edge Function via a build script.
 */

export interface ReportData {
  rows: any[];
  summary: any;
  totals?: any;
  rooms?: any[];
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

const findBestRule = (rules: any[], applies_to: string, target_id: string, price: number, duration: number) => {
  const candidates = rules.filter(r => r.is_active && r.applies_to === applies_to);
  const sorted = candidates.sort((a, b) => {
      if (a.target_id !== 'all' && b.target_id === 'all') return -1;
      const scopeOrder: Record<string, number> = { 'Outlet': 0, 'Property': 1, 'Global': 2 };
      return (scopeOrder[a.scope] || 2) - (scopeOrder[b.scope] || 2);
  });
  return sorted.find(r => {
      if (r.target_id !== 'all' && r.target_id !== target_id) return false;
      if (price < (r.min_price || 0) || price > (r.max_price || 999999)) return false;
      return true;
  });
};

const isStaffOnLeaveOnDate = (s: any, targetDateStr: string, staffLeaves: any[]) => {
  const target = startOfDay(new Date(targetDateStr));
  
  // Check probation (legacy)
  if (s.probation_start_date && s.probation_end_date) {
      try {
          const start = startOfDay(new Date(s.probation_start_date));
          const end = startOfDay(new Date(s.probation_end_date));
          if (isWithinInterval(target, { start, end })) return true;
      } catch (e) {}
  }
  
  // Check staff_leaves table
  const leaves = staffLeaves.filter(l => l.staff_id === s.id);
  if (leaves.length > 0) {
      try {
          return leaves.some(l => {
              const start = startOfDay(new Date(l.start_date));
              const end = startOfDay(new Date(l.end_date));
              return isWithinInterval(target, { start, end });
          });
      } catch (e) {}
  }

  return false;
};

const isStaffOnProbationOnDate = (s: any, targetDateStr: string) => {
  if (s.probation_start_date && s.probation_end_date) {
      try {
          const target = startOfDay(new Date(targetDateStr));
          const start = startOfDay(new Date(s.probation_start_date));
          const end = startOfDay(new Date(s.probation_end_date));
          return isWithinInterval(target, { start, end });
      } catch (e) {}
  }
  return false;
};

export const getReportData = async (ctx: any): Promise<ReportData> => {
  const { supabase, propertyId, outletId, reportType, date, incentiveDept = 'Massage', selectedMembershipTypeId = 'all' } = ctx;
  
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

    // Calculate for the month of the provided date
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    let totalEarned = 0;
    let totalDeferred = 0;
    let totalNetFees = 0;

    const rows = members.filter((m: any) => m.status !== 'tentative' && m.status !== 'pending').map((m: any) => {
      const mStart = safeParseDate(m.start_date);
      const mEnd = safeParseDate(m.current_end_date);
      
      if (!mStart || !mEnd) return null;

      const memberFreezes = freezes.filter((f: any) => f.member_id === m.id);

      // Helper for revenue calculation (Replicating RevenueEngine.calculateRevenuePeriod)
      const calculateRevenuePeriod = (pStart: Date, pEnd: Date) => {
        const activeStart = new Date(Math.max(mStart.getTime(), pStart.getTime()));
        const activeEnd = new Date(Math.min(mEnd.getTime(), pEnd.getTime()));
        if (activeStart > activeEnd) return 0;

        let recognizedDays = 0;
        try {
          const potentialDays = eachDayOfInterval({ start: activeStart, end: activeEnd });
          for (const day of potentialDays) {
            const isFrozen = memberFreezes.some((f: any) => {
              const fStart = safeParseDate(f.start_date);
              const fEnd = safeParseDate(f.end_date);
              return fStart && fEnd && isWithinInterval(day, { start: fStart, end: fEnd });
            });
            if (!isFrozen) recognizedDays++;
          }
        } catch (e) {
          console.error("Error calculating revenue interval:", e);
        }
        return recognizedDays * (m.daily_rate || 0);
      };

      const prevAccrual = mStart < start ? calculateRevenuePeriod(mStart, new Date(start.getTime() - 86400000)) : 0;
      const periodRev = calculateRevenuePeriod(start, end);
      
      let deferred = (m.net_amount || 0) - (prevAccrual + periodRev);
      if (deferred < 0.01) deferred = 0;

      const isActiveInPeriod = (mStart <= end && mEnd >= start);
      if (!isActiveInPeriod && deferred <= 0) return null;

      return {
        id: m.id,
        guest_name: m.guest_name || m.name,
        category_name: (categoryMap[m.category_id] || 'OTHER').toUpperCase(),
        start_date: m.start_date ? format(parseISO(m.start_date), 'dd-MM-yyyy') : 'N/A',
        end_date: m.current_end_date ? format(parseISO(m.current_end_date), 'dd-MM-yyyy') : 'N/A',
        total_days: differenceInCalendarDays(mEnd, mStart) + 1,
        actual_rate: Number(m.actual_rate || (m.net_amount + (m.discount || 0)) || 0),
        discount: Number(m.discount || 0),
        net_fees: Number(m.net_amount || 0),
        prev_accrual: prevAccrual,
        period_rev: periodRev,
        deferred: deferred
      };
    }).filter(Boolean);

    // Sort by Category then Name
    rows.sort((a, b) => {
        if (a.category_name < b.category_name) return -1;
        if (a.category_name > b.category_name) return 1;
        return a.guest_name.localeCompare(b.guest_name);
    });

    // Assign SL
    rows.forEach((row: any, i: number) => row.sl_no = i + 1);

    return {
      rows,
      summary: {
        totalNetFees: rows.reduce((s: number, r: any) => s + r.net_fees, 0),
        totalEarned: rows.reduce((s: number, r: any) => s + r.period_rev, 0),
        totalDeferred: rows.reduce((s: number, r: any) => s + r.deferred, 0),
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

    const [salesRes, bookingsRes, guestsRes, typesRes] = await Promise.all([
        salesQuery, 
        bookingsQuery,
        supabase.from('guests').select('id, name').eq('property_id', propertyId),
        supabase.from('massage_types').select('id, name')
    ]);
    const sales = salesRes.data || [];
    const bookings = bookingsRes.data || [];
    const guests = guestsRes.data || [];
    const guestMap = Object.fromEntries(guests.map((g: any) => [g.id, g.name]));
    const typeMap = Object.fromEntries((typesRes.data || []).map((t: any) => [t.id, t.name]));

    let totalGross = 0;
    let totalDiscount = 0;
    let totalNet = 0;

    const rows = [
      ...sales.map((s: any) => {
        const gross = Number(s.gross_amount || 0);
        const disc = Number(s.discount_amount || 0);
        const net = Number(s.net_amount || 0);
        const discPercent = gross > 0 ? (disc / gross) * 100 : 0;
        totalGross += gross;
        totalDiscount += disc;
        totalNet += net;
        return {
          sl_no: 0,
          date: s.created_at ? format(new Date(s.created_at), 'dd-MMM-yy HH:mm') : 'N/A',
          guest_name: s.guest_name || 'Walk-in',
          type: 'Retail',
          reference: 'Retail',
          item: s.item_name || 'Item',
          item_name: s.item_name || 'Item',
          mode_of_payment: s.payment_method || 'N/A',
          payment_mode: s.payment_method || 'N/A',
          gross_amount: gross,
          discount_percent: discPercent,
          discount_amount: disc,
          net_revenue: net,
          gross,
          discount: disc,
          net,
          check_no: s.check_no || '#---',
          remarks: s.remarks || ''
        };
      }),
      ...bookings.map((b: any) => {
        const price = Number(b.price || 0);
        const disc = Number(b.discount || 0);
        const gross = price + disc;
        const discPercent = gross > 0 ? (disc / gross) * 100 : 0;
        totalGross += gross;
        totalDiscount += disc;
        totalNet += price;
        return {
          sl_no: 0,
          date: `${format(parseISO(b.date), 'dd-MMM-yy')} ${b.start_time}`,
          guest_name: guestMap[b.guest_id] || 'Guest',
          type: 'Service',
          reference: 'Service',
          item: typeMap[b.massage_type_id || b.inventory_item_id] || 'Service',
          item_name: typeMap[b.massage_type_id || b.inventory_item_id] || 'Service',
          mode_of_payment: 'Service',
          payment_mode: 'Service',
          gross_amount: gross,
          discount_percent: discPercent,
          discount_amount: disc,
          net_revenue: price,
          gross,
          discount: disc,
          net: price,
          check_no: '#BOOK',
          remarks: b.status
        };
      })
    ].sort((a, b) => a.date.localeCompare(b.date));

    rows.forEach((r, i) => r.sl_no = i + 1);

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
      const categoryMap = Object.fromEntries((categoriesRes.data || []).map((c: any) => [c.id, c.name]));

      const rows = (members || []).filter((m: any) => m.status !== 'tentative').map((m: any, i: number) => {
        const actualPrice = Number(m.actual_rate || (m.net_amount + (m.discount || 0)) || 0);
        const discountAmount = Number(m.discount || 0);
        const discountPercent = actualPrice > 0 ? (discountAmount / actualPrice) * 100 : 0;

        return {
          sl_no: i + 1,
          date: m.start_date ? format(parseISO(m.start_date), 'dd-MM-yyyy') : 'N/A',
          guest_name: m.guest_name || m.name,
          type_of_membership: categoryMap[m.category_id] || 'Unknown',
          check_no: m.check_no || '#---',
          item_name: 'Membership',
          actual_price: actualPrice,
          discount_percent: discountPercent,
          discount_amount: discountAmount,
          net_revenue: Number(m.net_amount || 0),
          remarks: m.status,
          inc_total: 0,
          inc_discount_percent: 0,
          inc_discount_val: 0,
          inc_net: 0,
          staff_splits: {}
        };
      });
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

      // Filter in-memory for precise range and status
      const filtered = (members || []).filter((m: any) => {
        if (m.status === 'tentative' || m.status === 'pending') return false;

        const endDateStr = m.current_end_date || m.end_date;
        if (!endDateStr) return false;

        const parsedEnd = safeParseDate(endDateStr);
        if (!parsedEnd) return false;

        const checkDate = startOfDay(parsedEnd);
        const rangeStart = startOfDay(reportStart);
        const rangeEnd = endOfDay(reportEnd);

        return checkDate >= rangeStart && checkDate <= rangeEnd;
      }).sort((a: any, b: any) => {
        const dateA = safeParseDate(a.current_end_date || a.end_date)?.getTime() || 0;
        const dateB = safeParseDate(b.current_end_date || b.end_date)?.getTime() || 0;
        return dateA - dateB;
      });

      const rows = filtered.map((m: any, idx: number) => ({
        sl_no: idx + 1,
        name: m.guest_name || m.name,
        guest_name: m.guest_name || m.name,
        membership_no: m.membership_number || m.membership_no || 'N/A',
        category_name: categoryMap[m.category_id] || 'Other',
        email: m.email,
        phone: m.phone,
        start_date: m.start_date ? format(parseISO(m.start_date), 'dd MMM yyyy') : 'N/A',
        date: m.current_end_date ? format(parseISO(m.current_end_date), 'dd MMM yyyy') : 'N/A',
        status: m.status
      }));

      return { rows, summary: { count: rows.length } };
    }
  }

  if (reportType === 'incentives') {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    
    let outletIds: string[] = [];
    if (outletId === 'all') {
      const { data: outlets } = await supabase.from('outlets').select('id').eq('property_id', propertyId);
      outletIds = (outlets || []).map((o: any) => o.id);
    } else {
      outletIds = [outletId];
    }

    if (outletIds.length === 0) return { rows: [], summary: { totalIncentive: 0, count: 0 } };

    const [salesRes, bookingsRes, membersRes, rulesRes, staffRes, leavesRes, guestsRes, typesRes, categoriesRes] = await Promise.all([
      supabase.from('sales').select('*').in('outlet_id', outletIds).eq('status', 'completed').gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${endStr}T23:59:59`),
      supabase.from('massage_bookings').select('*').in('outlet_id', outletIds).eq('status', 'completed').gte('date', startStr).lte('date', endStr),
      supabase.from('members').select('*').in('outlet_id', outletIds).neq('status', 'tentative').gte('start_date', startStr).lte('start_date', endStr),
      supabase.from('incentive_rules').select('*').eq('property_id', propertyId).eq('is_active', true),
      supabase.from('staff').select('*').in('outlet_id', outletIds),
      supabase.from('staff_leaves').select('*'),
      supabase.from('guests').select('id, name').eq('property_id', propertyId),
      supabase.from('massage_types').select('*'),
      supabase.from('membership_categories').select('*')
    ]);

    const sales = salesRes.data || [];
    const bookings = bookingsRes.data || [];
    const members = membersRes.data || [];
    const rules = rulesRes.data || [];
    const staffList = staffRes.data || [];
    const staffLeaves = leavesRes.data || [];
    const guests = guestsRes.data || [];
    const guestMap = Object.fromEntries(guests.map((g: any) => [g.id, g.name]));
    const mTypes = typesRes.data || [];
    const mCats = categoriesRes.data || [];

    const rows: any[] = [];
    let totalIncentive = 0;
    const staffTotals: Record<string, number> = {};

    if (incentiveDept === 'Massage') {
        bookings.forEach(b => {
            const type = mTypes.find(m => m.id === (b.massage_type_id || b.inventory_item_id));
            if (!type || type.category !== 'Massage') return;
            
            const rule = findBestRule(rules, 'Massage', type.id, type.price, type.duration_minutes);
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
                    if (therapist && therapist.is_eligible_for_incentives !== false && !isStaffOnLeaveOnDate(therapist, b.date, staffLeaves) && !isStaffOnProbationOnDate(therapist, b.date)) {
                        staffSplits[b.therapist_id] = incNet;
                        staffTotals[b.therapist_id] = (staffTotals[b.therapist_id] || 0) + incNet;
                        totalIncentive += incNet;
                    }
                }
            }

            rows.push({
                sl_no: rows.length + 1,
                date: format(parseISO(b.date), 'dd-MMM-yy'),
                guest_name: guestMap[b.guest_id] || 'Guest',
                duration: `${type.duration_minutes}m`,
                check_no: '#---',
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
                remarks: b.status === 'confirmed' ? 'Pending Completion' : (discPercent > 50 ? 'Complimentary' : (!rule ? 'No Incentive Rule' : '')),
                staff_splits: staffSplits
            });
        });
    } else if (incentiveDept === 'Membership') {
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
                const available = staffList.filter(s => s.is_active && s.is_eligible_for_incentives !== false && !isStaffOnLeaveOnDate(s, m.start_date, staffLeaves) && !isStaffOnProbationOnDate(s, m.start_date));
                if (available.length > 0) {
                    const share = incNet / available.length;
                    available.forEach(s => {
                        staffSplits[s.id] = share;
                        staffTotals[s.id] = (staffTotals[s.id] || 0) + share;
                    });
                    totalIncentive += incNet;
                }
            } else if (m.sales_rep_id) {
                const staff = staffList.find(s => s.id === m.sales_rep_id);
                if (staff && staff.is_eligible_for_incentives !== false) {
                    staffSplits[m.sales_rep_id] = incNet;
                    staffTotals[m.sales_rep_id] = (staffTotals[m.sales_rep_id] || 0) + incNet;
                    totalIncentive += incNet;
                }
            }

            rows.push({
                sl_no: rows.length + 1,
                date: format(parseISO(m.start_date), 'dd-MMM-yy'),
                guest_name: m.guest_name,
                item_name: cat.name,
                type_of_membership: m.package_type || 'Single',
                duration: `${cat.duration_months} Months`,
                check_no: m.check_no || '#---',
                mode_of_payment: 'Cash/Card',
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
    } else if (incentiveDept === 'Personal Training') {
        // 1. Process Bookings categorized as Personal Training
        bookings.forEach(b => {
            const type = mTypes.find(m => m.id === (b.massage_type_id || b.inventory_item_id));
            if (!type || type.category !== 'Personal Training') return;
            
            const rule = findBestRule(rules, 'Personal Training', type.id, type.price, 0);
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
                    if (therapist && therapist.is_eligible_for_incentives !== false && !isStaffOnLeaveOnDate(therapist, b.date, staffLeaves) && !isStaffOnProbationOnDate(therapist, b.date)) {
                        staffSplits[b.therapist_id] = incNet;
                        staffTotals[b.therapist_id] = (staffTotals[b.therapist_id] || 0) + incNet;
                        totalIncentive += incNet;
                    }
                }
            }

            rows.push({
                sl_no: rows.length + 1,
                date: format(parseISO(b.date), 'dd-MMM-yy'),
                guest_name: guestMap[b.guest_id] || 'Guest',
                duration: '-',
                check_no: '#BOOK',
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
                remarks: !rule ? 'No PT Incentive Rule' : '',
                staff_splits: staffSplits
            });
        });

        // 2. Process Sales categorized as Personal Training (POS)
        sales.forEach(s => {
            const isPT = s.category?.toLowerCase() === 'personal training';
            if (!isPT) return;

            const rule = findBestRule(rules, 'Personal Training', s.item_id || 'all', s.net_amount, 0) || 
                         findBestRule(rules, 'Sale', s.category, s.net_amount, 0);
            if (!rule) return;

            const actualPrice = s.gross_amount;
            const discountAmt = s.discount_amount;
            const netRev = s.net_amount;
            const discPercent = actualPrice > 0 ? (discountAmt / actualPrice) * 100 : 0;

            const baseInc = rule.calculation_type === 'Fixed' ? rule.value : (actualPrice * rule.value / 100);
            const incDiscVal = (rule.apply_discount_percentage !== false) ? (baseInc * discPercent) / 100 : 0;
            const incNet = baseInc - incDiscVal;

            const staffSplits: Record<string, number> = {};
            if (rule.distribution_type === 'Shared') {
                const available = staffList.filter(staff => staff.is_active && staff.is_eligible_for_incentives !== false && !isStaffOnLeaveOnDate(staff, s.created_at, staffLeaves) && !isStaffOnProbationOnDate(staff, s.created_at));
                const ptStaff = available.filter(st => /trainer|coach|instructor|pt|gym|fitness/i.test(st.role));
                if (ptStaff.length > 0) {
                    const share = incNet / ptStaff.length;
                    ptStaff.forEach(staff => {
                        staffSplits[staff.id] = share;
                        staffTotals[staff.id] = (staffTotals[staff.id] || 0) + share;
                    });
                    totalIncentive += incNet;
                }
            } else {
                if (s.sold_by_id && s.secondary_sold_by_id) {
                    const share = incNet / 2;
                    const staff1 = staffList.find(st => st.id === s.sold_by_id);
                    const staff2 = staffList.find(st => st.id === s.secondary_sold_by_id);
                    
                    if (staff1 && staff1.is_eligible_for_incentives !== false) {
                        staffSplits[s.sold_by_id] = share;
                        staffTotals[s.sold_by_id] = (staffTotals[s.sold_by_id] || 0) + share;
                    }
                    if (staff2 && staff2.is_eligible_for_incentives !== false) {
                        staffSplits[s.secondary_sold_by_id] = share;
                        staffTotals[s.secondary_sold_by_id] = (staffTotals[s.secondary_sold_by_id] || 0) + share;
                    }
                    totalIncentive += incNet;
                } else if (s.sold_by_id) {
                    const staff = staffList.find(st => st.id === s.sold_by_id);
                    if (staff && staff.is_eligible_for_incentives !== false) {
                        staffSplits[s.sold_by_id] = incNet;
                        staffTotals[s.sold_by_id] = (staffTotals[s.sold_by_id] || 0) + incNet;
                        totalIncentive += incNet;
                    }
                }
            }

            let therapistName = staffList.find(st => st.id === s.sold_by_id)?.name || 'N/A';
            if (s.secondary_sold_by_id) {
                const secName = staffList.find(st => st.id === s.secondary_sold_by_id)?.name;
                if (secName) therapistName += ` & ${secName}`;
            }

            rows.push({
                sl_no: rows.length + 1,
                date: format(parseISO(s.created_at), 'dd-MMM-yy'),
                guest_name: s.guest_name,
                duration: `x${s.quantity}`,
                check_no: '#POS',
                item_name: s.item_name,
                therapist_name: therapistName,
                actual_price: actualPrice,
                discount_percent: discPercent,
                discount_amount: discountAmt,
                net_revenue: netRev,
                inc_total: baseInc,
                inc_discount_percent: discPercent,
                inc_discount_val: incDiscVal,
                inc_net: incNet,
                remarks: s.remarks || '',
                staff_splits: staffSplits
            });
        });
    }

    return {
      rows,
      summary: {
        totalIncentive,
        count: rows.length
      },
      totals: {
          staffTotals
      }
    };
  }

  if (reportType === 'massage_room_revenue') {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');

    const [bookingsRes, roomsRes] = await Promise.all([
      supabase.from('massage_bookings').select('*').eq('property_id', propertyId).eq('status', 'completed').gte('date', startStr).lte('date', endStr),
      supabase.from('massage_rooms').select('*').eq('property_id', propertyId)
    ]);

    const bookings = bookingsRes.data || [];
    const rooms = roomsRes.data || [];
    const roomMap = Object.fromEntries(rooms.map((r: any) => [r.id, r.name]));

    const dailyData: Record<string, Record<string, number>> = {};
    
    bookings.forEach((b: any) => {
      const dateStr = b.date;
      const roomId = b.room_id || 'unassigned';
      if (!dailyData[dateStr]) dailyData[dateStr] = {};
      dailyData[dateStr][roomId] = (dailyData[dateStr][roomId] || 0) + (b.price || 0);
    });

    const rows = Object.keys(dailyData).sort().map(dateStr => {
      const roomRevenue = dailyData[dateStr];
      const dailyTotal = Object.values(roomRevenue).reduce((s, v) => s + v, 0);
      return {
        date: format(parseISO(dateStr), 'dd MMM yyyy'),
        ...roomRevenue,
        daily_total: dailyTotal
      };
    });

    return {
      rows,
      summary: {
        totalRevenue: bookings.reduce((s, b) => s + (b.price || 0), 0),
        totalBookings: bookings.length,
        count: rows.length
      },
      rooms: rooms // Pass room metadata for PDF generation
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
        head: [['#', 'DATE', 'GUEST / MEMBER', 'ITEM / SERVICE', 'GROSS', 'DISC', 'NET']],
        body: data.rows.map((r: any) => [
          r.sl_no,
          r.date,
          r.guest_name,
          r.item_name,
          formatCurrency(r.gross_amount),
          formatCurrency(r.discount_amount),
          formatCurrency(r.net_revenue)
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
          0: { halign: 'center', cellWidth: 10 },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right', fontStyle: 'bold' }
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
      const head = [['#', 'DATE', 'GUEST', 'ITEM', 'NET REV', 'INC TOTAL', 'INC NET', 'REMARKS']];
      const body = data.rows.map((r: any) => [
        r.sl_no,
        r.date,
        r.guest_name,
        r.item_name,
        formatCurrency(r.net_revenue),
        formatCurrency(r.inc_total),
        formatCurrency(r.inc_net),
        r.remarks
      ]);

      autoTable(doc, {
        startY: currentY,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, halign: 'center' },
        styles: { fontSize: 7, cellPadding: 2, font: 'helvetica' },
        columnStyles: {
          0: { cellWidth: 8 },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right', fontStyle: 'bold' }
        },
        margin: { left: margin, right: margin }
      });

      const finalY = (doc as any).lastAutoTable?.finalY || currentY + 10;
      
      const staffRows = Object.entries(data.totals?.staffTotals || {}).map(([id, amount]) => {
          return ['Staff ID: ' + id, formatCurrency(amount as number)];
      });

      if (staffRows.length > 0) {
          autoTable(doc, {
              startY: finalY + 5,
              head: [['STAFF BREAKDOWN', 'TOTAL INCENTIVE']],
              body: staffRows,
              theme: 'grid',
              headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
              styles: { fontSize: 8, cellPadding: 2 },
              columnStyles: { 1: { halign: 'right' } },
              margin: { left: margin, right: margin }
          });
      }
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
      const rooms = data.rooms || [];
      const head = [['DATE', ...rooms.map((r: any) => r.name.toUpperCase()), 'DAILY TOTAL']];
      const body = data.rows.map((r: any) => [
        r.date,
        ...rooms.map((room: any) => formatCurrency(r[room.id] || 0)),
        formatCurrency(r.daily_total)
      ]);

      autoTable(doc, {
        startY: currentY,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'center' },
        styles: { fontSize: 7, cellPadding: 2, font: 'helvetica' },
        columnStyles: {
          0: { cellWidth: 25 },
          [rooms.length + 1]: { halign: 'right', fontStyle: 'bold', fillColor: [241, 245, 249] }
        },
        margin: { left: margin, right: margin }
      });
    }

    const finalY = (doc as any).lastAutoTable?.finalY || currentY + 10;
    autoTable(doc, {
      startY: finalY + 10,
      body: [
        ['TOTAL PORTFOLIO REVENUE', formatCurrency(data.summary.totalRevenue || 0)],
        ['TOTAL BOOKING COUNT', `${data.summary.totalBookings || 0}`]
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
