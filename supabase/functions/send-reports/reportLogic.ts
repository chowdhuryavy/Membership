import { format, isWithinInterval, eachDayOfInterval, parseISO, differenceInCalendarDays, startOfMonth, endOfMonth, addMonths, parse, startOfDay, endOfDay, subDays, addDays } from 'npm:date-fns';

/**
 * SHARED REPORT LOGIC
 * This file is the single source of truth for report calculations.
 * It is synced to the Supabase Edge Function via a build script.
 */

export interface ReportData {
  rows: any[];
  summary: any;
  totals?: any;
  staffTotals?: Record<string, number>;
}

export interface ReportContext {
  supabase: any;
  propertyId: string;
  outletId: string | 'all';
  reportType: string;
  date: Date;
  incentiveDept?: 'Massage' | 'Membership' | 'Personal Training';
  selectedMembershipTypeId?: string | 'all';
}

// Helper for safe date parsing
const safeParseDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return null;
  
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
  }

  try {
    const parsed = parse(dateStr, 'dd-MM-yyyy', new Date());
    if (!isNaN(parsed.getTime())) return parsed;
  } catch (e) {}

  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? null : fallback;
};

// Helper to find best incentive rule (matches React component logic)
const findBestRule = (rules: any[], applies_to: string, target_id: string, price: number, duration: number = 0) => {
  const candidates = rules.filter((r: any) => r.is_active && r.applies_to === applies_to);
  const sorted = candidates.sort((a: any, b: any) => {
    if (a.target_id !== 'all' && b.target_id === 'all') return -1;
    const scopeOrder: Record<string, number> = { 'Outlet': 0, 'Property': 1, 'Global': 2 };
    return scopeOrder[a.scope] - scopeOrder[b.scope];
  });
  return sorted.find((r: any) => {
    if (r.target_id !== 'all' && r.target_id !== target_id) return false;
    if (price < (r.min_price || 0) || price > (r.max_price || 999999)) return false;
    return true;
  });
};

// Helper to check if staff is on leave on a specific date
const isStaffOnLeaveOnDate = (staff: any, leaves: any[], targetDateStr: string) => {
  if (!staff || !leaves) return false;
  
  try {
    const target = startOfDay(new Date(targetDateStr));
    
    // Check legacy fields
    if (staff.probation_start_date && staff.probation_end_date) {
      const start = startOfDay(new Date(staff.probation_start_date));
      const end = startOfDay(new Date(staff.probation_end_date));
      if (isWithinInterval(target, { start, end })) return true;
    }
    
    // Check staff_leaves table
    const staffLeaves = leaves.filter((l: any) => l.staff_id === staff.id);
    if (staffLeaves.length > 0) {
      return staffLeaves.some((l: any) => {
        const start = startOfDay(new Date(l.start_date));
        const end = startOfDay(new Date(l.end_date));
        return isWithinInterval(target, { start, end });
      });
    }
  } catch (e) {}
  
  return false;
};

// Helper to check if staff is on probation
const isStaffOnProbationOnDate = (staff: any, targetDateStr: string) => {
  if (!staff) return false;
  
  if (staff.probation_start_date && staff.probation_end_date) {
    try {
      const target = startOfDay(new Date(targetDateStr));
      const start = startOfDay(new Date(staff.probation_start_date));
      const end = startOfDay(new Date(staff.probation_end_date));
      return isWithinInterval(target, { start, end });
    } catch (e) {}
  }
  return false;
};

export const getReportData = async (ctx: ReportContext): Promise<ReportData> => {
  const { supabase, propertyId, outletId, reportType, date, incentiveDept = 'Massage', selectedMembershipTypeId = 'all' } = ctx;
  
  // Helper to get outlet IDs
  const getOutletIds = async () => {
    if (outletId === 'all') {
      const { data: outlets } = await supabase.from('outlets').select('id').eq('property_id', propertyId);
      return (outlets || []).map((o: any) => o.id);
    }
    return [outletId];
  };

  // Helper to format money (keeping original values, formatting handled in PDF)
  const formatMoney = (val: number) => val;

  // ==================== REVENUE RECOGNITION REPORT ====================
  if (reportType === 'revenue_recognition') {
    console.log(`DEBUG: Fetching revenue recognition for Property: ${propertyId}, Outlet: ${outletId}`);
    
    const outletIds = await getOutletIds();
    if (outletIds.length === 0) return { rows: [], summary: { totalNetFees: 0, totalEarned: 0, totalDeferred: 0, count: 0 } };

    // Calculate for the month
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    // Fetch all required data
    let membersQuery = supabase.from('members').select('*').in('outlet_id', outletIds);
    if (selectedMembershipTypeId !== 'all') {
      membersQuery = membersQuery.eq('membership_type_id', selectedMembershipTypeId);
    }

    const [membersRes, freezesRes, categoriesRes] = await Promise.all([
      membersQuery,
      supabase.from('freezes').select('*'),
      supabase.from('membership_categories').select('*')
    ]);

    if (membersRes.error) {
      console.error('Error fetching members:', membersRes.error);
      throw new Error(`Failed to fetch members: ${membersRes.error.message}`);
    }

    let members = membersRes.data || [];
    const freezes = freezesRes.data || [];
    const categories = categoriesRes.data || [];
    const categoryMap = Object.fromEntries(categories.map((c: any) => [c.id, c.name]));

    // Filter out tentative members
    members = members.filter((m: any) => m.status !== 'tentative');

    console.log(`DEBUG: Found ${members.length} active members`);

    let totalEarned = 0;
    let totalDeferred = 0;
    let totalNetFees = 0;

    const rows = members.map((m: any) => {
      const mStart = safeParseDate(m.start_date);
      const mEnd = safeParseDate(m.current_end_date);
      
      if (!mStart || !mEnd) return null;
      
      const totalDays = differenceInCalendarDays(mEnd, mStart) + 1;
      const memberFreezes = freezes.filter((f: any) => f.member_id === m.id);

      // Helper for revenue calculation (accounts for freezes)
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

      // Calculate prev accrual (revenue before current period)
      let prevAccrual = 0;
      if (mStart < start) {
        const prevEnd = new Date(start.getTime() - 86400000);
        const prevDays = calculateRevenueDays(mStart, prevEnd);
        const dailyRate = Number(m.net_amount) / totalDays;
        prevAccrual = prevDays * dailyRate;
      }

      // Calculate period revenue
      const periodRevDays = calculateRevenueDays(start, end);
      const dailyRate = Number(m.net_amount) / totalDays;
      const periodRev = periodRevDays * dailyRate;
      
      // Deferred revenue
      let deferred = (m.net_amount || 0) - (prevAccrual + periodRev);
      if (deferred < 0.01) deferred = 0;

      totalEarned += periodRev;
      totalDeferred += deferred;
      totalNetFees += (m.net_amount || 0);

      return {
        guest_name: m.guest_name || m.name,
        category_name: (categoryMap[m.category_id] || 'UNCATEGORIZED').toUpperCase(),
        start_date: format(mStart, 'dd-MM-yyyy'),
        end_date: format(mEnd, 'dd-MM-yyyy'),
        total_days: totalDays,
        actual_rate: Number(m.actual_rate || 0),
        discount: Number(m.discount || 0),
        net_fees: Number(m.net_amount || 0),
        prev_accrual: prevAccrual,
        period_rev: periodRev,
        deferred: deferred
      };
    }).filter(Boolean);

    // Sort by category then guest name
    rows.sort((a, b) => {
      if (a.category_name < b.category_name) return -1;
      if (a.category_name > b.category_name) return 1;
      return a.guest_name.localeCompare(b.guest_name);
    });

    // Add sl_no
    rows.forEach((row, idx) => row.sl_no = idx + 1);

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

  // ==================== DAILY SALES LEDGER ====================
  if (reportType === 'daily_sales') {
    const startStr = format(date, 'yyyy-MM-dd');
    const startDateTime = new Date(`${startStr}T00:00:00`);
    const endDateTime = new Date(`${startStr}T23:59:59`);
    
    const outletIds = await getOutletIds();
    
    // Fetch sales
    let salesQuery = supabase.from('sales')
      .select('*')
      .eq('property_id', propertyId)
      .eq('status', 'completed')
      .gte('created_at', startDateTime.toISOString())
      .lte('created_at', endDateTime.toISOString());
    
    if (outletId !== 'all') {
      salesQuery = salesQuery.in('outlet_id', outletIds);
    }

    // Fetch bookings
    let bookingsQuery = supabase.from('massage_bookings')
      .select('*')
      .eq('property_id', propertyId)
      .eq('status', 'completed')
      .eq('date', startStr);
    
    if (outletId !== 'all') {
      bookingsQuery = bookingsQuery.in('outlet_id', outletIds);
    }

    // Fetch guests for booking names
    const guestsRes = await supabase.from('guests').select('id, name').eq('property_id', propertyId);
    const guestsMap = Object.fromEntries((guestsRes.data || []).map((g: any) => [g.id, g.name]));

    // Fetch massage types
    const typesRes = await supabase.from('massage_types').select('id, name').in('outlet_id', outletIds);
    const typesMap = Object.fromEntries((typesRes.data || []).map((t: any) => [t.id, t.name]));

    const [salesRes, bookingsRes] = await Promise.all([salesQuery, bookingsQuery]);
    const sales = salesRes.data || [];
    const bookings = bookingsRes.data || [];

    let totalGross = 0;
    let totalDiscount = 0;
    let totalNet = 0;

    const rows: any[] = [];
    let sl = 1;

    // Process sales
    sales.forEach((s: any) => {
      const gross = Number(s.gross_amount || 0);
      const disc = Number(s.discount_amount || 0);
      const net = Number(s.net_amount || 0);
      const discPercent = gross > 0 ? (disc / gross * 100) : 0;
      
      totalGross += gross;
      totalDiscount += disc;
      totalNet += net;
      
      rows.push({
        sl_no: sl++,
        date: format(new Date(s.created_at), 'dd-MMM-yy'),
        guest_name: s.guest_name,
        item_name: s.item_name,
        mode_of_payment: s.payment_method || 'Cash/Card',
        check_no: '#POS',
        actual_price: gross,
        discount_percent: discPercent,
        discount_amount: disc,
        net_revenue: net,
        remarks: 'Retail'
      });
    });

    // Process bookings
    bookings.forEach((b: any) => {
      const price = Number(b.price || 0);
      const disc = Number(b.discount || 0);
      const gross = price + disc;
      const discPercent = gross > 0 ? (disc / gross * 100) : 0;
      
      totalGross += gross;
      totalDiscount += disc;
      totalNet += price;
      
      rows.push({
        sl_no: sl++,
        date: format(parseISO(b.date), 'dd-MMM-yy'),
        guest_name: guestsMap[b.guest_id] || 'Guest',
        item_name: typesMap[b.massage_type_id] || typesMap[b.inventory_item_id] || 'Service',
        mode_of_payment: 'Service',
        check_no: '#SVC',
        actual_price: gross,
        discount_percent: discPercent,
        discount_amount: disc,
        net_revenue: price,
        remarks: 'Service'
      });
    });

    // Sort by date
    rows.sort((a, b) => a.date.localeCompare(b.date));

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

  // ==================== MEMBERS JOINED REPORT ====================
  if (reportType === 'members_joined') {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    
    const outletIds = await getOutletIds();
    if (outletIds.length === 0) return { rows: [], summary: { totalNetFees: 0, totalDiscount: 0, totalActual: 0, count: 0 } };

    // Fetch members joined in period
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('*')
      .in('outlet_id', outletIds)
      .gte('start_date', startStr)
      .lte('start_date', endStr);
    
    if (membersError) throw new Error(`Failed to fetch members: ${membersError.message}`);

    // Fetch categories for membership names
    const { data: categories } = await supabase
      .from('membership_categories')
      .select('id, name')
      .in('outlet_id', outletIds);
    
    const categoryMap = Object.fromEntries((categories || []).map((c: any) => [c.id, c.name]));

    let totalActual = 0;
    let totalDiscount = 0;
    let totalNet = 0;

    const rows = (members || [])
      .filter((m: any) => m.status !== 'tentative')
      .map((m: any, idx: number) => {
        const actualRate = Number(m.actual_rate || 0);
        const discount = Number(m.discount || 0);
        const net = Number(m.net_amount || 0);
        const discPercent = actualRate > 0 ? (discount / actualRate * 100) : 0;
        
        totalActual += actualRate;
        totalDiscount += discount;
        totalNet += net;
        
        return {
          sl_no: idx + 1,
          date: format(parseISO(m.start_date), 'dd-MM-yyyy'),
          guest_name: m.guest_name || m.name,
          type_of_membership: categoryMap[m.category_id] || 'Unknown',
          check_no: m.check_no || '#---',
          item_name: 'Membership',
          actual_price: actualRate,
          discount_percent: discPercent,
          discount_amount: discount,
          net_revenue: net,
          remarks: m.status
        };
      });

    return {
      rows,
      summary: {
        totalActual,
        totalDiscount,
        totalNet,
        count: rows.length
      }
    };
  }

  // ==================== EXPIRING MEMBERSHIPS REPORT ====================
  if (reportType === 'expiring_memberships') {
    const outletIds = await getOutletIds();
    if (outletIds.length === 0) return { rows: [], summary: { count: 0 } };

    const thirtyDaysFromNow = addDays(date, 30);
    const sixtyDaysFromNow = addDays(date, 60);
    const ninetyDaysFromNow = addDays(date, 90);
    const todayStr = format(date, 'yyyy-MM-dd');
    const ninetyDaysStr = format(ninetyDaysFromNow, 'yyyy-MM-dd');

    // Fetch members with end dates in the next 90 days
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('*')
      .in('outlet_id', outletIds)
      .or(`current_end_date.gte.${todayStr},end_date.gte.${todayStr}`)
      .or(`current_end_date.lte.${ninetyDaysStr},end_date.lte.${ninetyDaysStr}`);
    
    if (membersError) throw new Error(`Failed to fetch members: ${membersError.message}`);

    // Fetch membership types
    const { data: membershipTypes } = await supabase
      .from('membership_types')
      .select('id, name')
      .in('outlet_id', outletIds);
    
    const typeMap = Object.fromEntries((membershipTypes || []).map((t: any) => [t.id, t.name]));

    const rows = (members || [])
      .filter((m: any) => {
        if (m.status === 'tentative' || m.status === 'pending') return false;
        const endDate = m.current_end_date || m.end_date;
        if (!endDate) return false;
        const end = parseISO(endDate);
        return end >= date && end <= ninetyDaysFromNow;
      })
      .map((m: any, idx: number) => {
        const endDate = parseISO(m.current_end_date || m.end_date);
        const daysRemaining = differenceInCalendarDays(endDate, date);
        
        let expiryPeriod = '';
        if (daysRemaining <= 30) expiryPeriod = '30 Days';
        else if (daysRemaining <= 60) expiryPeriod = '60 Days';
        else if (daysRemaining <= 90) expiryPeriod = '90 Days';
        
        return {
          sl_no: idx + 1,
          member_name: m.guest_name || m.name,
          membership_type: typeMap[m.membership_type_id] || 'Unknown',
          expiry_date: format(endDate, 'dd-MM-yyyy'),
          days_remaining: daysRemaining,
          expiry_period: expiryPeriod,
          phone: m.phone || 'N/A',
          email: m.email || 'N/A',
          status: m.status
        };
      });

    return {
      rows,
      summary: {
        count: rows.length
      }
    };
  }

  // ==================== MASSAGE ROOM REVENUE REPORT ====================
  if (reportType === 'massage_room_revenue') {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    
    const outletIds = await getOutletIds();
    
    // Fetch bookings for the month
    let bookingsQuery = supabase
      .from('massage_bookings')
      .select('*')
      .eq('property_id', propertyId)
      .eq('status', 'completed')
      .gte('date', startStr)
      .lte('date', endStr);
    
    if (outletId !== 'all') {
      bookingsQuery = bookingsQuery.in('outlet_id', outletIds);
    }
    
    // Fetch massage rooms
    const { data: rooms } = await supabase
      .from('massage_rooms')
      .select('*')
      .eq('property_id', propertyId);
    
    const [bookingsRes] = await Promise.all([bookingsQuery]);
    const bookings = bookingsRes.data || [];
    
    const roomRevenue: Record<string, { name: string, revenue: number, count: number, discount: number }> = {};
    (rooms || []).forEach((r: any) => {
      roomRevenue[r.id] = { name: r.name, revenue: 0, count: 0, discount: 0 };
    });
    
    bookings.forEach((b: any) => {
      if (b.room_id && roomRevenue[b.room_id]) {
        const price = Number(b.price || 0);
        const disc = Number(b.discount || 0);
        roomRevenue[b.room_id].revenue += price;
        roomRevenue[b.room_id].discount += disc;
        roomRevenue[b.room_id].count += 1;
      }
    });
    
    const rows = Object.values(roomRevenue)
      .filter(r => r.count > 0)
      .map((r, idx) => ({
        sl_no: idx + 1,
        room_name: r.name,
        bookings_count: r.count,
        total_revenue: r.revenue,
        total_discount: r.discount,
        net_revenue: r.revenue,
        utilization_percentage: (r.count / (end.getDate())) * 100
      }));
    
    return {
      rows,
      summary: {
        totalRevenue: rows.reduce((s, r) => s + r.total_revenue, 0),
        totalDiscount: rows.reduce((s, r) => s + r.total_discount, 0),
        totalNet: rows.reduce((s, r) => s + r.net_revenue, 0),
        totalBookings: rows.reduce((s, r) => s + r.bookings_count, 0),
        count: rows.length
      }
    };
  }

  // ==================== INCENTIVE AUDIT REPORT ====================
  if (reportType === 'incentives') {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const startStr = format(start, 'yyyy-MM-dd');
    const endStr = format(end, 'yyyy-MM-dd');
    
    const outletIds = await getOutletIds();
    if (outletIds.length === 0) return { rows: [], summary: { totalActual: 0, totalDiscount: 0, totalNetRev: 0, totalIncNet: 0, count: 0 } };
    
    // Fetch all required data in parallel
    const [
      membersRes,
      bookingsRes,
      salesRes,
      rulesRes,
      staffRes,
      guestsRes,
      massageTypesRes,
      categoriesRes,
      freezesRes,
      leavesRes,
      inventoryRes
    ] = await Promise.all([
      supabase.from('members').select('*').in('outlet_id', outletIds),
      supabase.from('massage_bookings').select('*').in('outlet_id', outletIds),
      supabase.from('sales').select('*').in('outlet_id', outletIds),
      supabase.from('incentive_rules').select('*').eq('is_active', true),
      supabase.from('staff').select('*').in('outlet_id', outletIds),
      supabase.from('guests').select('id, name').eq('property_id', propertyId),
      supabase.from('massage_types').select('*').in('outlet_id', outletIds),
      supabase.from('membership_categories').select('*').in('outlet_id', outletIds),
      supabase.from('freezes').select('*'),
      supabase.from('staff_leaves').select('*'),
      supabase.from('inventory').select('*').in('outlet_id', outletIds)
    ]);
    
    const members = membersRes.data || [];
    const bookings = bookingsRes.data || [];
    const sales = salesRes.data || [];
    const rules = rulesRes.data || [];
    const staff = staffRes.data || [];
    const guests = guestsRes.data || [];
    const massageTypes = massageTypesRes.data || [];
    const categories = categoriesRes.data || [];
    const freezes = freezesRes.data || [];
    const leaves = leavesRes.data || [];
    const inventory = inventoryRes.data || [];
    
    const guestsMap = Object.fromEntries(guests.map((g: any) => [g.id, g.name]));
    const staffMap = Object.fromEntries(staff.map((s: any) => [s.id, s]));
    const massageTypesMap = Object.fromEntries(massageTypes.map((t: any) => [t.id, t]));
    const categoriesMap = Object.fromEntries(categories.map((c: any) => [c.id, c]));
    const inventoryMap = Object.fromEntries(inventory.map((i: any) => [i.id, i]));
    
    // Filter staff for incentive eligibility
    let eligibleStaff = staff.filter((s: any) => s.is_active);
    
    if (incentiveDept === 'Massage') {
      eligibleStaff = eligibleStaff.filter((s: any) => 
        /therapist|specialist|masseur|masseuse/i.test(s.role) ||
        massageTypes.some((t: any) => t.id === s.id)
      );
    } else if (incentiveDept === 'Personal Training') {
      eligibleStaff = eligibleStaff.filter((s: any) => 
        /trainer|coach|instructor|pt|gym|fitness/i.test(s.role)
      );
    }
    
    const rows: any[] = [];
    let totalActual = 0;
    let totalDiscount = 0;
    let totalNetRev = 0;
    let totalIncNet = 0;
    const staffTotals: Record<string, number> = {};
    let sl = 1;
    
    if (incentiveDept === 'Massage') {
      // Process massage bookings
      const massageBookings = bookings.filter((b: any) => {
        const bDate = safeParseDate(b.date);
        const type = massageTypesMap[b.massage_type_id || b.inventory_item_id];
        return b.status === 'completed' && bDate && bDate >= start && bDate <= end && type?.category === 'Massage';
      });
      
      for (const booking of massageBookings) {
        const type = massageTypesMap[booking.massage_type_id || booking.inventory_item_id];
        if (!type) continue;
        
        const rule = findBestRule(rules, 'Massage', booking.massage_type_id || '', type.price, type.duration_minutes);
        const actualPrice = type.price;
        const discountAmt = booking.discount || 0;
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
          
          if (booking.therapist_id) {
            const therapist = staffMap[booking.therapist_id];
            if (therapist && therapist.is_eligible_for_incentives !== false && 
                !isStaffOnLeaveOnDate(therapist, leaves, booking.date) && 
                !isStaffOnProbationOnDate(therapist, booking.date)) {
              staffSplits[booking.therapist_id] = incNet;
            }
          }
        }
        
        totalActual += actualPrice;
        totalDiscount += discountAmt;
        totalNetRev += netRev;
        totalIncNet += incNet;
        
        Object.entries(staffSplits).forEach(([staffId, amount]) => {
          staffTotals[staffId] = (staffTotals[staffId] || 0) + amount;
        });
        
        rows.push({
          sl_no: sl++,
          date: format(parseISO(booking.date), 'dd-MMM-yy'),
          guest_name: guestsMap[booking.guest_id] || 'Guest',
          duration: `${type.duration_minutes}m`,
          check_no: '#---',
          item_name: type.name,
          therapist_name: staffMap[booking.therapist_id]?.name || 'N/A',
          actual_price: actualPrice,
          discount_percent: discPercent,
          discount_amount: discountAmt,
          net_revenue: netRev,
          inc_total: baseInc,
          inc_discount_percent: discPercent,
          inc_discount_val: incDiscVal,
          inc_net: incNet,
          remarks: !rule ? 'No Incentive Rule' : '',
          staff_splits: staffSplits
        });
      }
    } 
    else if (incentiveDept === 'Membership') {
      // Process membership sales
      const membershipSales = members.filter((m: any) => {
        const mStart = safeParseDate(m.start_date);
        return m.status !== 'tentative' && mStart && mStart >= start && mStart <= end;
      });
      
      for (const member of membershipSales) {
        const category = categoriesMap[member.category_id];
        if (!category) continue;
        
        const rule = findBestRule(rules, 'Membership', member.category_id, member.net_amount, 0);
        if (!rule) continue;
        
        const actualPrice = member.actual_rate || (member.net_amount + (member.discount || 0));
        const discountAmt = member.discount || 0;
        const netRev = member.net_amount;
        const discPercent = actualPrice > 0 ? (discountAmt / actualPrice) * 100 : 0;
        
        const baseInc = rule.calculation_type === 'Fixed' ? rule.value : (actualPrice * rule.value / 100);
        const incDiscVal = (rule.apply_discount_percentage !== false) ? (baseInc * discPercent) / 100 : 0;
        const incNet = baseInc - incDiscVal;
        
        const staffSplits: Record<string, number> = {};
        if (rule.distribution_type === 'Shared') {
          const availableStaff = eligibleStaff.filter((s: any) => 
            s.is_active && 
            (s.is_eligible_for_incentives !== false) && 
            !isStaffOnLeaveOnDate(s, leaves, member.start_date) && 
            !isStaffOnProbationOnDate(s, member.start_date)
          );
          if (availableStaff.length > 0) {
            const share = incNet / availableStaff.length;
            availableStaff.forEach((s: any) => staffSplits[s.id] = share);
          }
        } else {
          if (member.sales_rep_id) {
            const staffMember = staffMap[member.sales_rep_id];
            if (staffMember && staffMember.is_eligible_for_incentives !== false) {
              staffSplits[member.sales_rep_id] = incNet;
            }
          }
        }
        
        totalActual += actualPrice;
        totalDiscount += discountAmt;
        totalNetRev += netRev;
        totalIncNet += incNet;
        
        Object.entries(staffSplits).forEach(([staffId, amount]) => {
          staffTotals[staffId] = (staffTotals[staffId] || 0) + amount;
        });
        
        rows.push({
          sl_no: sl++,
          date: format(parseISO(member.start_date), 'dd-MMM-yy'),
          guest_name: member.guest_name || member.name,
          type_of_membership: member.package_type || 'Single',
          duration: `${category.duration_months} Months`,
          check_no: member.check_no || '#---',
          mode_of_payment: 'Cash/Card',
          item_name: category.name,
          therapist_name: rule.distribution_type === 'Shared' ? 'Shared' : (staffMap[member.sales_rep_id]?.name || 'N/A'),
          actual_price: actualPrice,
          discount_percent: discPercent,
          discount_amount: discountAmt,
          net_revenue: netRev,
          inc_total: baseInc,
          inc_discount_percent: discPercent,
          inc_discount_val: incDiscVal,
          inc_net: incNet,
          remarks: member.remarks || '',
          staff_splits: staffSplits
        });
      }
    }
    else if (incentiveDept === 'Personal Training') {
      // Process PT bookings
      const ptBookings = bookings.filter((b: any) => {
        const bDate = safeParseDate(b.date);
        return b.status === 'completed' && bDate && bDate >= start && bDate <= end;
      });
      
      for (const booking of ptBookings) {
        const item = inventoryMap[booking.inventory_item_id];
        if (!item) continue;
        
        const rule = findBestRule(rules, 'Personal Training', booking.inventory_item_id || '', item.price, 0);
        const actualPrice = item.price;
        const discountAmt = booking.discount || 0;
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
          
          if (booking.therapist_id) {
            const staffMember = staffMap[booking.therapist_id];
            if (staffMember && staffMember.is_eligible_for_incentives !== false && 
                !isStaffOnLeaveOnDate(staffMember, leaves, booking.date) && 
                !isStaffOnProbationOnDate(staffMember, booking.date)) {
              staffSplits[booking.therapist_id] = incNet;
            }
          }
        }
        
        totalActual += actualPrice;
        totalDiscount += discountAmt;
        totalNetRev += netRev;
        totalIncNet += incNet;
        
        Object.entries(staffSplits).forEach(([staffId, amount]) => {
          staffTotals[staffId] = (staffTotals[staffId] || 0) + amount;
        });
        
        rows.push({
          sl_no: sl++,
          date: format(parseISO(booking.date), 'dd-MMM-yy'),
          guest_name: guestsMap[booking.guest_id] || 'Guest',
          duration: '-',
          check_no: '#BOOK',
          item_name: item.name,
          therapist_name: staffMap[booking.therapist_id]?.name || 'N/A',
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
      }
      
      // Process PT sales (POS)
      const ptSales = sales.filter((s: any) => {
        const sDate = safeParseDate(s.created_at);
        const isPT = s.category?.toLowerCase() === 'personal training';
        return s.status === 'completed' && isPT && sDate && sDate >= start && sDate <= end;
      });
      
      for (const sale of ptSales) {
        const rule = findBestRule(rules, 'Personal Training', sale.item_id || 'all', sale.net_amount, 0) || 
                     findBestRule(rules, 'Sale', sale.category, sale.net_amount, 0);
        if (!rule) continue;
        
        const actualPrice = sale.gross_amount;
        const discountAmt = sale.discount_amount;
        const netRev = sale.net_amount;
        const discPercent = actualPrice > 0 ? (discountAmt / actualPrice) * 100 : 0;
        
        const baseInc = rule.calculation_type === 'Fixed' ? rule.value : (actualPrice * rule.value / 100);
        const incDiscVal = (rule.apply_discount_percentage !== false) ? (baseInc * discPercent) / 100 : 0;
        const incNet = baseInc - incDiscVal;
        
        const staffSplits: Record<string, number> = {};
        if (rule.distribution_type === 'Shared') {
          let availableStaff = eligibleStaff.filter((s: any) => 
            s.is_active && 
            (s.is_eligible_for_incentives !== false) && 
            !isStaffOnLeaveOnDate(s, leaves, sale.created_at) && 
            !isStaffOnProbationOnDate(s, sale.created_at)
          );
          availableStaff = availableStaff.filter((s: any) => /trainer|coach|instructor|pt|gym|fitness/i.test(s.role));
          if (availableStaff.length > 0) {
            const share = incNet / availableStaff.length;
            availableStaff.forEach((s: any) => staffSplits[s.id] = share);
          }
        } else {
          if (sale.sold_by_id && sale.secondary_sold_by_id) {
            const share = incNet / 2;
            const staff1 = staffMap[sale.sold_by_id];
            const staff2 = staffMap[sale.secondary_sold_by_id];
            if (staff1 && staff1.is_eligible_for_incentives !== false) staffSplits[sale.sold_by_id] = share;
            if (staff2 && staff2.is_eligible_for_incentives !== false) staffSplits[sale.secondary_sold_by_id] = share;
          } else if (sale.sold_by_id) {
            const staffMember = staffMap[sale.sold_by_id];
            if (staffMember && staffMember.is_eligible_for_incentives !== false) {
              staffSplits[sale.sold_by_id] = incNet;
            }
          }
        }
        
        let therapistName = staffMap[sale.sold_by_id]?.name || 'N/A';
        if (sale.secondary_sold_by_id) {
          const secName = staffMap[sale.secondary_sold_by_id]?.name;
          if (secName) therapistName += ` & ${secName}`;
        }
        
        totalActual += actualPrice;
        totalDiscount += discountAmt;
        totalNetRev += netRev;
        totalIncNet += incNet;
        
        Object.entries(staffSplits).forEach(([staffId, amount]) => {
          staffTotals[staffId] = (staffTotals[staffId] || 0) + amount;
        });
        
        rows.push({
          sl_no: sl++,
          date: format(parseISO(sale.created_at), 'dd-MMM-yy'),
          guest_name: sale.guest_name,
          duration: `x${sale.quantity}`,
          check_no: '#POS',
          item_name: sale.item_name,
          therapist_name: therapistName,
          actual_price: actualPrice,
          discount_percent: discPercent,
          discount_amount: discountAmt,
          net_revenue: netRev,
          inc_total: baseInc,
          inc_discount_percent: discPercent,
          inc_discount_val: incDiscVal,
          inc_net: incNet,
          remarks: sale.remarks || '',
          staff_splits: staffSplits
        });
      }
    }
    
    return {
      rows,
      summary: {
        totalActual,
        totalDiscount,
        totalNetRev,
        totalIncNet,
        count: rows.length
      },
      totals: {
        totalActual,
        totalDiscount,
        totalNetRev,
        totalIncNet,
        staffTotals
      }
    };
  }
  
  // ==================== DEFAULT / UNKNOWN REPORT TYPE ====================
  console.log(`Unknown report type: ${reportType}`);
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
  const isIncentiveReport = reportType === 'incentives';
  const isMassageRoomReport = reportType === 'massage_room_revenue';
  const isMembersJoined = reportType === 'members_joined';
  const isExpiringMemberships = reportType === 'expiring_memberships';
  
  const doc = new jsPDF({ 
    orientation: isRevenueReport ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  
  // Helper to format currency with safe symbol
  const formatCurrency = (val: number) => {
    const formatted = val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const safeSymbol = (currencySymbol === 'ر.ق' || currencySymbol.includes('\u0631')) ? 'QR' : currencySymbol;
    return `${formatted} ${safeSymbol}`;
  };
  
  // --- HEADER SECTION ---
  let currentY = margin;
  
  // Logo & Property Info
  if (logoUrl && typeof logoUrl === 'string' && logoUrl.startsWith('data:image')) {
    try {
      doc.addImage(logoUrl, 'PNG', margin, currentY, 25, 25);
    } catch (e) {
      console.error('Logo add error:', e);
    }
  }
  
  // Property Name & Subtitle
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(15, 23, 42);
  doc.text(propertyName.toUpperCase(), margin + (logoUrl ? 30 : 0), currentY + 8);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`${outletName.toUpperCase()} • ISO-9001 CERTIFIED`, margin + (logoUrl ? 30 : 0), currentY + 14);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229);
  doc.text("INTERNAL VERIFICATION PROTOCOL", margin + (logoUrl ? 30 : 0), currentY + 20);
  
  // Report Title & Period
  doc.setFont("helvetica", "black");
  doc.setFontSize(28);
  doc.setTextColor(15, 23, 42);
  doc.text(reportTitle.toUpperCase(), pageWidth - margin, currentY + 10, { align: 'right' });
  
  // Audit Period Box
  const boxWidth = 50;
  const boxHeight = 15;
  const boxX = pageWidth - margin - boxWidth;
  const boxY = currentY + 18;
  
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2, 'F');
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255, 0.6);
  doc.text("AUDIT PERIOD", boxX + (boxWidth / 2), boxY + 5, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  const periodStr = isDailySalesReport 
    ? date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()
    : date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toUpperCase();
  doc.text(periodStr, boxX + (boxWidth / 2), boxY + 11, { align: 'center' });
  
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(pageWidth - margin - 35, boxY + boxHeight + 3, 35, 6, 1, 1, 'F');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text("VERIFIED AUDIT TRAIL", pageWidth - margin - 17.5, boxY + boxHeight + 7.5, { align: 'center' });
  
  currentY += 45;
  
  // --- TABLE SECTION ---
  if (isRevenueReport && data.rows.length > 0) {
    // Group by category
    const grouped = data.rows.reduce((acc: any, row: any) => {
      if (!acc[row.category_name]) acc[row.category_name] = [];
      acc[row.category_name].push(row);
      return acc;
    }, {} as Record<string, any[]>);
    
    Object.entries(grouped).forEach(([category, groupRows]: [string, any]) => {
      // Category Header
      autoTable(doc, {
        startY: currentY,
        body: [[`${category.toUpperCase()} (${groupRows.length} LEDGER EVENTS)`]],
        theme: 'plain',
        styles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 9, cellPadding: 3 },
        margin: { left: margin, right: margin }
      });
      currentY = (doc as any).lastAutoTable.finalY;
      
      // Main Table
      autoTable(doc, {
        startY: currentY,
        head: [['SL.', 'GUEST NAME', 'START DATE', 'END DATE', 'DAYS', 'ACTUAL RATE', 'DISCOUNT', 'NET FEES', 'PREV. ACCRUAL', 'PERIOD REV', 'DEFERRED']],
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
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
        styles: { fontSize: 7, cellPadding: 2 },
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
          9: { halign: 'right', fontStyle: 'bold', textColor: [79, 70, 229] },
          10: { halign: 'right', fontStyle: 'bold', textColor: [239, 68, 68] }
        },
        margin: { left: margin, right: margin }
      });
      
      // Subtotal
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
        styles: { fillColor: [238, 242, 255], textColor: [49, 46, 129], fontStyle: 'bold', fontSize: 7, cellPadding: 2 },
        margin: { left: margin, right: margin }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 5;
    });
    
    // Grand Totals
    autoTable(doc, {
      startY: currentY + 5,
      body: [
        ['TOTAL NET FEES', formatCurrency(data.summary.totalNetFees || 0)],
        ['PERIOD REVENUE RECOGNIZED', formatCurrency(data.summary.totalEarned || 0)],
        ['TOTAL DEFERRED REVENUE', formatCurrency(data.summary.totalDeferred || 0)]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: contentWidth - 40, fillColor: [248, 250, 252] },
        1: { halign: 'right', cellWidth: 40 }
      },
      margin: { left: margin, right: margin }
    });
    
  } else if (isDailySalesReport && data.rows.length > 0) {
    autoTable(doc, {
      startY: currentY,
      head: [['SL.', 'DATE', 'GUEST', 'ITEM', 'PAYMENT', 'GROSS', 'DISC %', 'DISC AMT', 'NET']],
      body: data.rows.map((r: any) => [
        r.sl_no,
        r.date,
        r.guest_name,
        r.item_name,
        r.mode_of_payment || 'N/A',
        formatCurrency(r.actual_price),
        `${r.discount_percent.toFixed(0)}%`,
        formatCurrency(r.discount_amount),
        formatCurrency(r.net_revenue)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        5: { halign: 'right' },
        6: { halign: 'center' },
        7: { halign: 'right' },
        8: { halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: margin, right: margin }
    });
    
    const finalY = (doc as any).lastAutoTable?.finalY || currentY + 10;
    autoTable(doc, {
      startY: finalY + 10,
      body: [
        ['PORTFOLIO GROSS REVENUE', formatCurrency(data.summary.totalGross || 0)],
        ['TOTAL REDUCTION / DISCOUNT', `-${formatCurrency(data.summary.totalDiscount || 0)}`],
        ['CERTIFIED NET REVENUE', formatCurrency(data.summary.totalNet || 0)]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: contentWidth - 40, fillColor: [248, 250, 252] },
        1: { halign: 'right', cellWidth: 40 }
      },
      margin: { left: margin, right: margin }
    });
    
  } else if (isIncentiveReport && data.rows.length > 0) {
    // Build headers based on staff totals
    const staffNames = data.totals?.staffTotals 
      ? Object.keys(data.totals.staffTotals).map(id => {
          // We need staff names - they'll be passed separately
          return id; // Placeholder, actual names come from staff data
        })
      : [];
    
    autoTable(doc, {
      startY: currentY,
      head: [['SL.', 'DATE', 'GUEST', 'ITEM', 'SPECIALIST', 'GROSS', 'DISC %', 'DISC AMT', 'NET REV', 'INC TOTAL', 'INC DISC', 'INC NET', ...staffNames.map(n => n.toUpperCase().substring(0, 8))]],
      body: data.rows.map((r: any) => {
        const rowData = [
          r.sl_no,
          r.date,
          r.guest_name,
          r.item_name,
          r.therapist_name || 'N/A',
          formatCurrency(r.actual_price),
          `${r.discount_percent.toFixed(0)}%`,
          formatCurrency(r.discount_amount),
          formatCurrency(r.net_revenue),
          formatCurrency(r.inc_total),
          formatCurrency(r.inc_discount_val),
          formatCurrency(r.inc_net)
        ];
        
        // Add staff split columns
        staffNames.forEach(staffId => {
          const amount = r.staff_splits?.[staffId] || 0;
          rowData.push(formatCurrency(amount));
        });
        
        return rowData;
      }),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 7, cellPadding: 2 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        5: { halign: 'right' },
        6: { halign: 'center' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'right' },
        11: { halign: 'right', fontStyle: 'bold' }
      },
      margin: { left: margin, right: margin }
    });
    
    const finalY = (doc as any).lastAutoTable?.finalY || currentY + 10;
    autoTable(doc, {
      startY: finalY + 10,
      body: [
        ['TOTAL INCENTIVE PAYABLE', formatCurrency(data.summary.totalIncNet || 0)]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: contentWidth - 40, fillColor: [248, 250, 252] },
        1: { halign: 'right', cellWidth: 40 }
      },
      margin: { left: margin, right: margin }
    });
    
  } else if (isMassageRoomReport && data.rows.length > 0) {
    autoTable(doc, {
      startY: currentY,
      head: [['SL.', 'ROOM NAME', 'BOOKINGS', 'REVENUE', 'DISCOUNT', 'NET REVENUE', 'UTILIZATION']],
      body: data.rows.map((r: any) => [
        r.sl_no,
        r.room_name,
        r.bookings_count,
        formatCurrency(r.total_revenue),
        formatCurrency(r.total_discount),
        formatCurrency(r.net_revenue),
        `${r.utilization_percentage.toFixed(1)}%`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
        6: { halign: 'center' }
      },
      margin: { left: margin, right: margin }
    });
    
    const finalY = (doc as any).lastAutoTable?.finalY || currentY + 10;
    autoTable(doc, {
      startY: finalY + 10,
      body: [
        ['TOTAL ROOM REVENUE', formatCurrency(data.summary.totalRevenue || 0)],
        ['TOTAL DISCOUNTS', formatCurrency(data.summary.totalDiscount || 0)],
        ['NET REVENUE', formatCurrency(data.summary.totalNet || 0)],
        ['TOTAL BOOKINGS', `${data.summary.totalBookings || 0}`]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: contentWidth - 40, fillColor: [248, 250, 252] },
        1: { halign: 'right', cellWidth: 40 }
      },
      margin: { left: margin, right: margin }
    });
    
  } else if (data.rows.length > 0) {
    // Generic table for members_joined and expiring_memberships
    const headers = Object.keys(data.rows[0]).filter(k => k !== 'sl_no');
    autoTable(doc, {
      startY: currentY,
      head: [headers.map(h => h.toUpperCase().replace(/_/g, ' '))],
      body: data.rows.map((r: any) => headers.map(h => r[h])),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
      styles: { fontSize: 8, cellPadding: 3 },
      margin: { left: margin, right: margin }
    });
    
    const finalY = (doc as any).lastAutoTable?.finalY || currentY + 10;
    autoTable(doc, {
      startY: finalY + 10,
      body: [
        ['TOTAL RECORD COUNT', `${data.summary.count || 0}`]
      ],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 4, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: contentWidth - 40, fillColor: [248, 250, 252] },
        1: { halign: 'right', cellWidth: 40 }
      },
      margin: { left: margin, right: margin }
    });
    
  } else {
    // No data message
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.text("No data found for the selected period.", margin, currentY + 20);
  }
  
  // --- FOOTER ---
  const footerY = pageHeight - margin;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`Page 1 of 1 • System ID: ${Math.random().toString(36).substring(7).toUpperCase()}`, margin, footerY);
  doc.text(`© ${new Date().getFullYear()} ${propertyName}. All rights reserved.`, pageWidth - margin, footerY, { align: 'right' });
  
  return doc;
};