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

import { getMonthlyRevenueData } from './monthlyRevenueReportLogic';

export interface ReportContext {
  supabase: any;
  propertyId: string;
  outletId: string | 'all';
  reportType: string;
  date: Date;
  dateType?: 'today' | 'yesterday';
  incentiveDept?: 'Massage' | 'Membership' | 'Personal Training' | 'Sale' | 'Referral';
  selectedMembershipTypeId?: string | 'all';
  revenueMode?: 'cash' | 'accrual';
  endMonthIndex?: number;
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
  'monthly_revenue': 'Monthly Revenue Report',
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

    const membersRes = await membersQuery;

    if (membersRes.error) {
      console.error('Error fetching members:', membersRes.error);
      throw new Error(`Failed to fetch members: ${membersRes.error.message}`);
    }

    const members = membersRes.data || [];
    const memberIds = members.map((m: any) => m.id);
    
    // Fetch freezes ONLY for the members we are reporting on
    let freezesQuery = supabase.from('freezes').select('*');
    if (memberIds.length > 0) {
        freezesQuery = freezesQuery.in('member_id', memberIds);
    } else {
        // No members, no freezes needed
        freezesQuery = supabase.from('freezes').select('*').limit(0);
    }

    const [freezesRes, categoriesRes, typesRes] = await Promise.all([
      freezesQuery,
      supabase.from('membership_categories').select('id, name, duration_months').in('outlet_id', outletIds),
      supabase.from('membership_types').select('id, name').in('outlet_id', outletIds)
    ]);

    const freezes = freezesRes.data || [];
    const categories = categoriesRes.data || [];
    const types = typesRes.data || [];
    const categoryMap = Object.fromEntries(categories.map((c: any) => [c.id, c.name]));
    const categoryDurationMap = Object.fromEntries(categories.map((c: any) => [c.id, c.duration_months]));
    const typeMap = Object.fromEntries(types.map((t: any) => [t.id, t.name]));

    console.log(`DEBUG: Found ${members.length} members for property ${propertyId}`);

    // Calculate for the month of the provided date
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 1); // First day of next month for exclusive end date logic

    let totalEarned = 0;
    let totalDeferred = 0;
    let totalNetFees = 0;

    const rows = members
      .filter((m: any) => m.status !== 'tentative')
      .map((m: any) => {
        const mStart = safeParseDate(m.start_date);
        const mEnd = safeParseDate(m.current_end_date);
        
        const memberFreezes = freezes.filter((f: any) => f.member_id === m.id);
        const prevAccrual = mStart ? RevenueEngine.calculateRevenuePeriod(m, memberFreezes, mStart, subDays(start, 1)) : 0;
        const periodRev = RevenueEngine.calculateRevenuePeriod(m, memberFreezes, start, subDays(end, 1));
        
        const dailyRate = Number(m.daily_rate || 0);
        
        let deferred = (m.net_amount || 0) - (prevAccrual + periodRev);
        if (deferred < 0) deferred = 0;

        // Calculate total active days for the entire membership duration
        const totalActiveDays = Math.round((m.net_amount || 0) / dailyRate) || 0;
        
        return {
          id: m.id,
          guest_name: m.guest_name || m.name,
          membership_no: m.membership_number || m.membership_no || 'N/A',
          category_name: categoryMap[m.category_id] || 'Other',
          category_duration: categoryDurationMap[m.category_id] || 0,
          membership_type_name: typeMap[m.membership_type_id] || 'Membership',
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
          debug_info: `Total Active Days: ${totalActiveDays}`,
          _mEnd: mEnd, // Internal field for filtering
          _mStart: mStart // Internal field for filtering
        };
      })
      .filter((row: any) => {
        // 1. If they expired BEFORE the start of this month, hide them.
        if (row._mEnd && row._mEnd < start) return false;

        // 2. If they joined AFTER the end of this month, hide them.
        if (row._mStart && row._mStart >= end) return false;

        // 3. If they have recognized revenue this month (> 0.001), always show.
        if (row.period_rev > 0.001) return true;
        
        // 4. If they have deferred revenue (> 0.001), always show.
        if (row.deferred > 0.001) return true;
        
        // 5. If they are active but have zero revenue and zero deferred, 
        // we hide them to keep the audit report focused on financial activity.
        return false;
      })
      .map((row: any) => {
        // Remove internal filtering fields
        const { _mEnd, _mStart, ...rest } = row;
        return { ...rest, _mStart }; // Keep _mStart for sorting
      })
      .sort((a: any, b: any) => {
        // Sort by membership type (tier)
        const typeCompare = (a.membership_type_name || '').localeCompare(b.membership_type_name || '');
        if (typeCompare !== 0) return typeCompare;
        
        // Then by start date
        const dateA = a._mStart ? a._mStart.getTime() : 0;
        const dateB = b._mStart ? b._mStart.getTime() : 0;
        return dateA - dateB;
      })
      .map((row: any) => {
        // Final cleanup of internal fields
        const { _mStart, ...rest } = row;
        return rest;
      });

    // Calculate totals from filtered rows
    rows.forEach(row => {
      totalEarned += row.period_rev;
      totalDeferred += row.deferred;
      totalNetFees += row.net_fees;
    });

    // Group by category for the frontend/email
    const grouped = rows.reduce((acc: any, row: any) => {
      const typeKey = selectedMembershipTypeId === 'all' ? (row.membership_type_name || 'Membership') : 'All';
      const catKey = row.category_name || 'Other';
      
      if (!acc[typeKey]) acc[typeKey] = {};
      if (!acc[typeKey][catKey]) acc[typeKey][catKey] = [];
      
      acc[typeKey][catKey].push(row);
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

    // members_joined
    let membersQuery = supabase.from('members').select('*').in('outlet_id', outletIds).gte('start_date', startStr).lte('start_date', endStr);
    if (selectedMembershipTypeId && selectedMembershipTypeId !== 'all') {
      membersQuery = membersQuery.eq('membership_type_id', selectedMembershipTypeId);
    }

    const [membersRes, categoriesRes, typesRes] = await Promise.all([
      membersQuery,
      supabase.from('membership_categories').select('id, name'),
      supabase.from('membership_types').select('id, name').in('outlet_id', outletIds)
    ]);

    const members = membersRes.data || [];
    const categories = categoriesRes.data || [];
    const types = typesRes.data || [];
    const categoryMap = Object.fromEntries(categories.map((c: any) => [c.id, c.name]));
    const typeMap = Object.fromEntries(types.map((t: any) => [t.id, t.name]));

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
        guest_name: m.guest_name || m.name,
        membership_no: m.membership_number || m.membership_no || 'N/A',
        category: categoryMap[m.category_id] || 'Other',
        membership_type_name: typeMap[m.membership_type_id] || 'Membership',
        check_no: m.check_no || '#---',
        item_name: 'Membership',
        actual_price: actualPrice,
        discount_percent: discPercent,
        discount_amount: discountAmt,
        net_revenue: netRev,
        remarks: m.status,
        referrer_name: (m.referrer_name || '').replace(/^\[NO-INC\]\s*/i, '').replace(/^Referral:\s*/i, '').trim() || 'N/A'
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

    // expiring_memberships
    let membersQuery = supabase.from('members').select('*').in('outlet_id', outletIds);
    if (selectedMembershipTypeId && selectedMembershipTypeId !== 'all') {
      membersQuery = membersQuery.eq('membership_type_id', selectedMembershipTypeId);
    }

    const [membersRes, categoriesRes, typesRes] = await Promise.all([
      membersQuery,
      supabase.from('membership_categories').select('id, name'),
      supabase.from('membership_types').select('id, name').in('outlet_id', outletIds)
    ]);

    const members = membersRes.data || [];
    const categories = categoriesRes.data || [];
    const types = typesRes.data || [];
    const categoryMap = Object.fromEntries(categories.map((c: any) => [c.id, c.name]));
    const typeMap = Object.fromEntries(types.map((t: any) => [t.id, t.name]));

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
      membership_type_name: typeMap[m.membership_type_id] || 'Membership',
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
    const startStr = format(startOfMonth(date), 'yyyy-MM-dd');
    const endStr = format(endOfMonth(date), 'yyyy-MM-dd');
    
    let outletIds: string[] = [];
    let allPropertyOutletIds: string[] = [];

    const { data: allOutlets } = await supabase.from('outlets').select('id, name').eq('property_id', propertyId);
    const outletMap = Object.fromEntries((allOutlets || []).map((o: any) => [o.id, o.name]));
    allPropertyOutletIds = (allOutlets || []).map((o: any) => o.id);

    if (outletId === 'all') {
      outletIds = allPropertyOutletIds;
    } else {
      outletIds = [outletId];
    }

    if (outletIds.length === 0) return { rows: [], summary: { totalIncentive: 0, count: 0, staffList: [] } };

    const dept = incentiveDept || 'Massage';

    // For most incentive reports, we want staff from all outlets in the property to ensure we can match sales reps
    const staffQueryOutletIds = (dept === 'Personal Training' || dept === 'Massage' || dept === 'Membership' || dept === 'Referral') ? allPropertyOutletIds : outletIds;

    const [salesRes, bookingsRes, membersRes, rulesRes, staffRes, inventoryRes, mTypesRes, categoriesRes, guestsRes] = await Promise.all([
      supabase.from('sales').select('*').in('outlet_id', outletIds).eq('status', 'completed').gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${endStr}T23:59:59`),
      supabase.from('massage_bookings').select('*').in('outlet_id', outletIds).eq('status', 'completed').gte('date', startStr).lte('date', endStr),
      supabase.from('members').select('*').in('outlet_id', outletIds).neq('status', 'tentative').gte('start_date', startStr).lte('start_date', endStr),
      supabase.from('incentive_rules').select('*').eq('is_active', true),
      supabase.from('staff').select('*, leaves:staff_leaves!fk_staff_leaves_staff(*)'),
      supabase.from('inventory').select('*').in('outlet_id', outletIds),
      supabase.from('massage_types').select('*').eq('property_id', propertyId),
      supabase.from('membership_categories').select('*'),
      supabase.from('guests').select('id, name')
    ]);

    console.log(`DEBUG: Loaded ${staffRes.data?.length || 0} staff members from DB.`);
    console.log('DEBUG: outletIds:', outletIds);

    const bookings = bookingsRes.data || [];
    const members = membersRes.data || [];
    let rules = rulesRes.data || [];

    // Filter rules by scope manually to avoid column errors
    rules = rules.filter((r: any) => {
      if (r.scope === 'Global') return true;
      if (r.scope === 'Property' && r.scope_id === propertyId) return true;
      if (r.scope === 'Outlet' && outletIds.includes(r.scope_id)) return true;
      return false;
    });
    // rawStaffList is used for matching specific staff IDs/names to rows.
    // It should include all staff in the property to ensure we can match creators/reps 
    // even if they aren't primarily assigned to the currently selected outlet.
    const rawStaffList = (staffRes.data || []);
    
    // staffList defines which staff columns are shown in the report.
    // This should be strictly filtered by the selected outlet(s) and assigned range.
    const staffList = rawStaffList.filter((s: any) => {
      // 1. Eligibility & Lifecycle
      if (!s.is_active || s.is_eligible_for_incentives === false) return false;
      
      // 2. Strict Outlet Assignment check for the report period
      const belongsToOutlet = (outletIds.includes('all')) 
        ? true 
        : outletIds.some(id => wasStaffAssignedToOutletInRange(s, id, startStr, endStr));
      
      if (!belongsToOutlet) return false;

      // 3. Filter by joining date
      if (s.joining_date) {
        const joinDate = new Date(s.joining_date);
        joinDate.setHours(0,0,0,0);
        const reportEndDate = new Date(endStr);
        reportEndDate.setHours(23,59,59,999);
        if (joinDate > reportEndDate) return false;
      }
      
      // 4. Role-based filtering for specific departments
      if (dept === 'Personal Training' && s.role !== 'Personal Trainer') return false;
      if (dept === 'Massage' && !['Therapist', 'Masseur', 'Masseuse'].includes(s.role || '')) return false;
      
      return true; 
    });
    console.log(`DEBUG: staffList after filtering (${dept}):`, staffList.length);
    const inventory = inventoryRes.data || [];
    const mTypes = mTypesRes.data || [];
    const mCats = categoriesRes.data || [];
    const guests = guestsRes.data || [];
    const guestMap = Object.fromEntries(guests.map((g: any) => [g.id, g.name]));

    const rows: any[] = [];
    let sl = 1;

    if (dept === 'Massage' || dept === 'Personal Training') {
      // Process Bookings
      bookings.filter(b => {
        const type = mTypes.find(m => m.id === b.massage_type_id) || mTypes.find(m => m.id === b.inventory_item_id) || inventory.find(i => i.id === b.inventory_item_id);
        const cat = type?.category?.trim();
        const normCat = (cat || '').toLowerCase();
        const normDept = dept.toLowerCase();
        
        if (dept === 'Massage') {
          return normCat.includes('massage') || !cat;
        }
        // Personal Training check
        return normCat.includes(normDept) || normCat === 'pt' || normCat.includes('trainer') || normCat.includes('training');
      }).forEach(b => {
        const type = mTypes.find(m => m.id === b.massage_type_id) || mTypes.find(m => m.id === b.inventory_item_id) || inventory.find(i => i.id === b.inventory_item_id);
        if (!type) return;
        const rule = findBestRule(rules, dept, (b.massage_type_id || b.inventory_item_id || ''), type.price, type.duration_minutes, b.outlet_id);
        
        const actualPrice = b.price || type.price;
        const discountAmt = b.discount || 0;
        const netRev = actualPrice - discountAmt;
        const discPercent = actualPrice > 0 ? (discountAmt / actualPrice) * 100 : 0;

        let baseInc = 0;
        let incDiscVal = 0;
        let incNet = 0;
        const staffSplits: Record<string, number> = {};

        let remarks = !rule ? 'No Rule' : '';
        if (rule) {
          baseInc = rule.calculation_type === 'Fixed' ? rule.value : (actualPrice * rule.value / 100);
          incDiscVal = (rule.apply_discount_percentage !== false) ? (baseInc * discPercent) / 100 : 0;
          incNet = baseInc - incDiscVal;
          
          if (rule.distribution_type === 'Shared') {
            const available = staffList.filter(s => {
              return isStaffAssignedToOutletOnDate(s, b.outlet_id, b.date);
            });
            if (available.length > 0) {
              const share = incNet / available.length;
              available.forEach(s => staffSplits[s.id] = share);
            } else {
              remarks = 'Shared: No eligible staff available';
            }
          } else if (b.therapist_id) {
            const trainerId = b.therapist_id;
            const therapist = rawStaffList.find(s => s.id === trainerId);
            if (therapist) {
              const isPersonalTrainer = dept === 'Personal Training' ? therapist.role === 'Personal Trainer' : true;
              const isEligible = therapist.is_eligible_for_incentives !== false && isPersonalTrainer;
              if (!isEligible) {
                remarks = isPersonalTrainer ? 'Staff not eligible for incentives' : 'Staff role not PT';
                staffSplits[trainerId] = 0;
              } else if (isStaffOnLeaveOnDate(therapist, b.date) || isStaffOnProbationOnDate(therapist, b.date)) {
                remarks = 'Staff on Leave/Probation';
                staffSplits[trainerId] = 0;
              } else {
                staffSplits[trainerId] = incNet;
              }
            } else {
              remarks = 'Staff not found';
            }
          }
        } else {
          if (b.therapist_id) {
            staffSplits[b.therapist_id] = 0;
          }
        }

        rows.push({
          id: b.id,
          sl_no: sl++,
          date: format(new Date(`${b.date}T${b.start_time}`), 'dd-MMM-yy'),
          guest_name: guestMap[b.guest_id] || 'Guest',
          item_name: type.name,
          therapist_name: rule?.distribution_type === 'Shared' ? 'Shared' : (rawStaffList.find(s => s.id === b.therapist_id)?.name || 'N/A'),
          outlet_name: outletMap[b.outlet_id] || 'Unknown',
          actual_price: actualPrice,
          discount_percent: discPercent,
          discount_amount: discountAmt,
          net_revenue: netRev,
          inc_total: baseInc,
          inc_discount_percent: discPercent,
          inc_discount_val: incDiscVal,
          inc_net: incNet,
          remarks: remarks,
          check_no: (b as any).check_no || '',
          duration: type.duration_minutes ? `${type.duration_minutes}m` : '',
          staff_splits: staffSplits
        });
      });

      // Process Sales for Personal Training
      if (dept === 'Personal Training') {
        const sales = (salesRes.data || []).filter(s => s.category === 'Personal Training');
        sales.forEach(s => {
          const item = inventory.find(i => i.id === s.item_id);
          const rule = findBestRule(rules, dept, s.item_id || '', s.unit_price, 0, s.outlet_id);
          
          const actualPrice = s.gross_amount;
          const discountAmt = s.discount_amount || 0;
          const netRev = s.net_amount;
          const discPercent = actualPrice > 0 ? (discountAmt / actualPrice) * 100 : 0;

          let baseInc = 0;
          let incDiscVal = 0;
          let incNet = 0;
          const staffSplits: Record<string, number> = {};

          let remarks = !rule ? 'No Rule' : '';
          if (rule) {
            baseInc = rule.calculation_type === 'Fixed' ? rule.value : (actualPrice * rule.value / 100);
            incDiscVal = (rule.apply_discount_percentage !== false) ? (baseInc * discPercent) / 100 : 0;
            incNet = baseInc - incDiscVal;
            
            if (rule.distribution_type === 'Shared') {
              const available = staffList.filter(st => {
                return isStaffAssignedToOutletOnDate(st, s.outlet_id, s.created_at);
              });
              if (available.length > 0) {
                const share = incNet / available.length;
                available.forEach(st => staffSplits[st.id] = share);
              } else {
                remarks = 'Shared: No eligible staff available';
              }
            } else {
              const trainerId = [s.therapist_id, s.trainer_id, s.sold_by_id].find(id => id && id !== '' && id !== 'N/A' && id !== 'null' && id !== 'undefined');
              
              if (trainerId) {
                const staff = rawStaffList.find(st => st.id === trainerId);
                if (staff) {
                  const isPersonalTrainer = dept === 'Personal Training' ? staff.role === 'Personal Trainer' : true;
                  const isEligible = staff.is_eligible_for_incentives !== false && isPersonalTrainer;
                  if (!isEligible) {
                    remarks = isPersonalTrainer ? 'Staff not eligible for incentives' : 'Staff role not PT';
                    staffSplits[trainerId] = 0;
                  } else if (isStaffOnLeaveOnDate(staff, s.created_at) || isStaffOnProbationOnDate(staff, s.created_at)) {
                    remarks = 'Staff on Leave/Probation';
                    staffSplits[trainerId] = 0;
                  } else {
                    staffSplits[trainerId] = incNet;
                  }
                } else {
                  remarks = `Staff not found (ID: ${trainerId})`;
                }
              } else {
                remarks = 'No trainer/seller assigned';
              }
            }
          } else {
            const trainerId = [s.therapist_id, s.trainer_id, s.sold_by_id].find(id => id && id !== '' && id !== 'N/A' && id !== 'null' && id !== 'undefined');
            if (trainerId) {
              staffSplits[trainerId] = 0;
            }
          }

          const displayTrainerId = [s.therapist_id, s.trainer_id, s.sold_by_id].find(id => id && id !== '' && id !== 'N/A' && id !== 'null' && id !== 'undefined');
          
          const cleanRefForPT = (s.referrer_name || '').replace(/^\[NO-INC\]\s*/i, '').replace(/^Referral:\s*/i, '').trim() || '';
          
          rows.push({
            id: s.id,
            sl_no: sl++,
            date: format(new Date(s.created_at), 'dd-MMM-yy'),
            guest_name: s.guest_name || 'Guest',
            item_name: s.item_name || item?.name || 'PT Service',
            therapist_name: rule?.distribution_type === 'Shared' ? 'Shared' : (rawStaffList.find(st => st.id === displayTrainerId)?.name || 'N/A'),
            outlet_name: outletMap[s.outlet_id] || 'Unknown',
            actual_price: actualPrice,
            discount_percent: discPercent,
            discount_amount: discountAmt,
            net_revenue: netRev,
            inc_total: baseInc,
            inc_discount_percent: discPercent,
            inc_discount_val: incDiscVal,
            inc_net: incNet,
            remarks: remarks,
            check_no: s.check_no || '',
            duration: 'Sale',
            staff_splits: staffSplits,
            referrer_name: cleanRefForPT
          });
        });
      }
    } else if (dept === 'Membership') {
      members
        .forEach(m => {
        // 1. Find Rules
        const cat = mCats.find(c => c.id === m.category_id);
        const isNoInc = (m.referrer_name || '').startsWith('[NO-INC]');
        const cleanReferrerName = (m.referrer_name || '').replace(/^\[NO-INC\]\s*/i, '').replace(/^Referral:\s*/i, '').trim();
        const normalize = (n: string) => n.toLowerCase().replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
        const cleanRefNorm = normalize(cleanReferrerName);

        const actualPrice = m.actual_rate || (m.net_amount + (m.discount || 0));
        
        const refRule = (!isNoInc && cleanReferrerName) ? findBestRule(rules, 'Referral', m.category_id, actualPrice, 0, m.outlet_id, m.membership_type_id ? `type:${m.membership_type_id}` : undefined) : null;
        const rule = findBestRule(rules, 'Membership', m.category_id, actualPrice, 0, m.outlet_id, m.membership_type_id ? `type:${m.membership_type_id}` : undefined);

        // 2. Constants
        const discountAmt = m.discount || 0;
        const netRev = m.net_amount;
        const discPercent = actualPrice > 0 ? (discountAmt / actualPrice) * 100 : 0;

        let baseInc = 0;
        let incDiscVal = 0;
        let incNet = 0;

        const staffSplits: Record<string, number> = {};
        let remarks = m.remarks || '';

        // 3. Process Referral Rule (for checking if staff portion is triggered)
        if (refRule) {
          const payeeMode = refRule.referral_payee || 'Referrer';
          const isBoth = payeeMode === 'Both';
          const isReferrer = payeeMode === 'Referrer' || isBoth;

          if (isReferrer) {
            remarks = `Referral (${payeeMode})`;
            // Referrer portion is NOT shown in Membership (Staff) report
          }
        }

        // 4. Process Membership Rule (for Staff portion)
        const isRefDisabled = refRule && refRule.disable_shared_incentive;
        const isStaffViaReferral = refRule && (refRule.referral_payee === 'Staff' || refRule.referral_payee === 'Sales Staff' || refRule.referral_payee === 'Both');
        
        if (isRefDisabled && !isStaffViaReferral) {
          remarks = remarks ? `${remarks} + (Mem Inc Disabled)` : 'Mem Inc Disabled';
        } else if (!rule) {
          remarks = remarks ? `${remarks} (No Mem Rule)` : 'No Mem Rule';
        } else {
          const mBase = rule.calculation_type === 'Fixed' ? rule.value : (actualPrice * rule.value / 100);
          const mDiscVal = (rule.apply_discount_percentage !== false) ? (mBase * discPercent) / 100 : 0;
          const mNet = mBase - mDiscVal;

          baseInc += mBase;
          incDiscVal += mDiscVal;
          incNet += mNet;
          remarks = remarks ? `${remarks} + Regular Membership` : 'Regular Membership';

          // Shared logic for membership report as per user request
          let available = staffList.filter(s => {
            return isStaffAssignedToOutletOnDate(s, m.outlet_id, m.start_date);
          });

          // Fallback: If no historical assignment found, use any staff currently assigned to this outlet
          if (available.length === 0) {
            available = staffList.filter(s => getStaffOutlets(s).includes(m.outlet_id));
          }

          if (available.length > 0) {
            const share = mNet / available.length;
            available.forEach(s => staffSplits[s.id] = (staffSplits[s.id] || 0) + share);
          } else {
            remarks += ' (Membership: No eligible staff for share)';
          }
        }

          const displaySalesRepId = [m.sales_rep_id].find(id => id && id !== '' && id !== 'N/A' && id !== 'null' && id !== 'undefined');
          const cleanRefForMem = (m.referrer_name || '').replace(/^\[NO-INC\]\s*/i, '').replace(/^Referral:\s*/i, '').trim() || '';
          rows.push({
            id: m.id,
            sl_no: sl++,
            date: format(new Date(m.start_date), 'dd-MMM-yy'),
            guest_name: m.guest_name,
            membership_no: m.membership_number || m.membership_no || 'N/A',
            item_name: cat?.name || m.category_id || 'Unknown Tier',
            therapist_name: rule?.distribution_type === 'Shared' ? 'Shared' : (rawStaffList.find(s => s.id === displaySalesRepId)?.name || m._matched_sales_rep_name || 'N/A'),
            outlet_name: outletMap[m.outlet_id] || 'Unknown',
            actual_price: actualPrice,
            discount_percent: discPercent,
            discount_amount: discountAmt,
            net_revenue: netRev,
            inc_total: baseInc,
            inc_discount_percent: discPercent,
            inc_discount_val: incDiscVal,
            inc_net: incNet,
            remarks: remarks,
            check_no: m.check_no || '',
            duration: cat?.name || '',
            staff_splits: staffSplits,
            referrer_name: cleanRefForMem
          });
      });
    } else if (dept === 'Sale') {
      const sales = (salesRes.data || []).filter(s => s.category !== 'Personal Training');
      sales.forEach(s => {
        const item = inventory.find(i => i.id === s.item_id);
        const rule = findBestRule(rules, dept, s.item_id || '', s.unit_price, 0, s.outlet_id, s.category);
        
        const actualPrice = s.gross_amount;
        const discountAmt = s.discount_amount || 0;
        const netRev = s.net_amount;
        const discPercent = actualPrice > 0 ? (discountAmt / actualPrice) * 100 : 0;

        let baseInc = 0;
        let incDiscVal = 0;
        let incNet = 0;
        const staffSplits: Record<string, number> = {};

        let remarks = !rule ? 'No Rule' : '';
        if (rule) {
          baseInc = rule.calculation_type === 'Fixed' ? rule.value : (actualPrice * rule.value / 100);
          incDiscVal = (rule.apply_discount_percentage !== false) ? (baseInc * discPercent) / 100 : 0;
          incNet = baseInc - incDiscVal;
          
          if (rule.distribution_type === 'Shared') {
            const available = staffList.filter(st => {
              const isEligible = st.is_eligible_for_incentives !== false;
              const sOutlets = getStaffOutlets(st);
              return isEligible && sOutlets.includes(s.outlet_id) && !isStaffOnLeaveOnDate(st, s.created_at) && !isStaffOnProbationOnDate(st, s.created_at);
            });
            if (available.length > 0) {
              const share = incNet / available.length;
              available.forEach(st => staffSplits[st.id] = share);
            } else {
              remarks = 'Shared: No eligible staff available';
            }
          } else {
            const sellerId = [s.therapist_id, s.trainer_id, s.sold_by_id].find(id => id && id !== '' && id !== 'N/A' && id !== 'null' && id !== 'undefined');
            if (sellerId) {
              const staff = rawStaffList.find(st => st.id === sellerId);
              if (staff) {
                const isEligible = staff.is_eligible_for_incentives !== false;
                if (!isEligible) {
                  remarks = 'Staff not eligible for incentives';
                  staffSplits[sellerId] = 0;
                } else if (isStaffOnLeaveOnDate(staff, s.created_at) || isStaffOnProbationOnDate(staff, s.created_at)) {
                  remarks = 'Staff on Leave/Probation';
                  staffSplits[sellerId] = 0;
                } else {
                  staffSplits[sellerId] = incNet;
                }
              } else {
                remarks = 'Staff not found';
              }
            } else {
              remarks = 'No seller assigned';
            }
          }
        } else {
          const sellerId = [s.therapist_id, s.trainer_id, s.sold_by_id].find(id => id && id !== '' && id !== 'N/A' && id !== 'null' && id !== 'undefined');
          if (sellerId) {
            staffSplits[sellerId] = 0;
          }
        }

        const displayTrainerId = [s.therapist_id, s.trainer_id, s.sold_by_id].find(id => id && id !== '' && id !== 'N/A' && id !== 'null' && id !== 'undefined');
        
        const cleanRefForSale = (s.referrer_name || '').replace(/^\[NO-INC\]\s*/i, '').replace(/^Referral:\s*/i, '').trim() || '';
        
        rows.push({
          id: s.id,
          sl_no: sl++,
          date: format(new Date(s.created_at), 'dd-MMM-yy'),
          guest_name: s.guest_name || 'Guest',
          item_name: s.item_name || item?.name || s.category,
          therapist_name: rule?.distribution_type === 'Shared' ? 'Shared' : (rawStaffList.find(st => st.id === displayTrainerId)?.name || 'N/A'),
          outlet_name: outletMap[s.outlet_id] || 'Unknown',
          actual_price: actualPrice,
          discount_percent: discPercent,
          discount_amount: discountAmt,
          net_revenue: netRev,
          inc_total: baseInc,
          inc_discount_percent: discPercent,
          inc_discount_val: incDiscVal,
          inc_net: incNet,
          remarks: remarks,
          check_no: s.check_no || '',
          duration: 'Sale',
          staff_splits: staffSplits,
          referrer_name: cleanRefForSale
        });
      });
    } else if (dept === 'Referral') {
      const referrerTotals: Record<string, number> = {};
      members
        .filter(m => m.referrer_name && m.referrer_name.trim() !== '')
        .forEach(m => {
        const cat = mCats.find(c => c.id === m.category_id);
        
        const isNoInc = (m.referrer_name || '').startsWith('[NO-INC]');
        const cleanReferrerName = (m.referrer_name || '').replace(/^\[NO-INC\]\s*/i, '').replace(/^Referral:\s*/i, '').trim();
        const normalize = (n: string) => n.toLowerCase().replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
        const cleanRefNorm = normalize(cleanReferrerName);
        const cleanRefForReport = cleanReferrerName || '';
        
        const rule = (!isNoInc && cleanReferrerName) ? findBestRule(rules, 'Referral', m.category_id, m.net_amount, 0, m.outlet_id, m.membership_type_id ? `type:${m.membership_type_id}` : undefined) : null;
        const memRule = findBestRule(rules, 'Membership', m.category_id, m.net_amount, 0, m.outlet_id, m.membership_type_id ? `type:${m.membership_type_id}` : undefined);

        const actualPrice = m.actual_rate || (m.net_amount + (m.discount || 0));
        const discountAmt = m.discount || 0;
        const netRev = m.net_amount;
        const discPercent = actualPrice > 0 ? (discountAmt / actualPrice) * 100 : 0;

        let baseInc = 0;
        let incDiscVal = 0;
        let incNet = 0;

        const staffSplits: Record<string, number> = {};
        let remarks = m.remarks || '';
        let referrerNet = 0;

        if (!rule) {
          remarks = remarks ? `${remarks} (No Referral Rule found)` : 'No Referral Rule found';
        } else {
          const rBase = rule.calculation_type === 'Fixed' ? rule.value : (actualPrice * rule.value / 100);
          const rDiscVal = (rule.apply_discount_percentage !== false) ? (rBase * discPercent) / 100 : 0;
          const rNet = rBase - rDiscVal;
          
          const payeeMode = rule.referral_payee || 'Referrer';
          const isBoth = payeeMode === 'Both';
          const isReferrer = payeeMode === 'Referrer' || isBoth;

          remarks = `Referral Payee: ${payeeMode}`;

          if (isReferrer) {
            baseInc = rBase;
            incDiscVal = rDiscVal;
            incNet = rNet;
            referrerNet = rNet;
            referrerTotals[cleanReferrerName] = (referrerTotals[cleanReferrerName] || 0) + rNet;
          }
        }

        // --- STAFF PORTION NOT SHOWN IN REFERRAL REPORT ---
        // (It will be shown in Membership/Staff reports instead)
        
        const displayStaffName = cleanReferrerName || 'N/A';

        rows.push({
          id: m.id,
          sl_no: sl++,
          date: format(new Date(m.start_date), 'dd-MMM-yy'),
          guest_name: m.guest_name,
          membership_no: m.membership_number || m.membership_no || 'N/A', 
          item_name: cat?.name || m.category_id || 'Tier Info',
          therapist_name: m._matched_sales_rep_name || cleanReferrerName,
          outlet_name: outletMap[m.outlet_id] || 'Unknown',
          actual_price: actualPrice,
          discount_percent: discPercent,
          discount_amount: discountAmt,
          net_revenue: netRev,
          inc_total: baseInc,
          inc_discount_percent: discPercent,
          inc_discount_val: incDiscVal,
          inc_net: incNet,
          remarks: remarks,
          check_no: m.check_no || '',
          duration: 'Referral',
          staff_splits: staffSplits,
          referrer_name: cleanRefForReport,
          referrer_amount: referrerNet
        });
      });

      // Add referrer summaries to result in Step 2 after processing all members
      (rows as any)._referrerTotals = referrerTotals;
    }

    const totalIncentive = rows.reduce((sum, r) => sum + r.inc_net, 0);

    // Filter staffList to only include relevant staff for this report
    let finalStaffList = staffList.filter(s => {
      const hasEarned = rows.some(r => r.staff_splits && r.staff_splits[s.id] > 0);
      if (hasEarned) return true;
      
      // For Referral report, only show staff who earned something in this period
      if (dept === 'Referral') return false;
      
      // For Membership and others, show experts/reps even if 0 earned (to show they are active)
      return true;
    });

    // If no staff found by role, show all active staff in the outlet as fallback
    if (finalStaffList.length === 0 && dept !== 'Referral') {
      finalStaffList = staffList;
    }

    return {
      rows,
      summary: {
        totalIncentive,
        count: rows.length,
        staffList: finalStaffList,
        referrerSummaries: (rows as any)._referrerTotals ? Object.entries((rows as any)._referrerTotals).map(([name, amount], idx) => ({ sl_no: idx + 1, name, amount })) : []
      }
    };
  }

  if (reportType === 'monthly_revenue') {
    const year = date.getFullYear();
    const data = await getMonthlyRevenueData(supabase, propertyId, outletId, year, ctx.revenueMode || 'cash', ctx.endMonthIndex);
    return {
      rows: data.rows,
      summary: {
        monthlyTotals: data.monthlyTotals,
        yearlyTotal: data.yearlyTotal,
        previousYearTotals: data.previousYearTotals,
        previousYearlyTotal: data.previousYearlyTotal,
        months: data.months,
        year: data.year,
        revenueMode: data.revenueMode
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
  currencyCode?: string;
  reportTitle: string;
  outletId?: string;
  date: Date;
  logoUrl?: string;
  reportType: string;
  membershipTypeName?: string;
  userName?: string;
  summary?: any;
  signatoryConfig?: any;
}

export const generateCustomReportPDF = (options: {
  jsPDF: any;
  autoTable: any;
  title: string;
  subtitle: string;
  headers: string[];
  body: any[][];
  propertyName: string;
  logoUrl?: string;
  userName?: string;
  filename: string;
}) => {
  const { jsPDF, autoTable, title, subtitle, headers, body, propertyName, logoUrl, userName, filename } = options;
  
  const JsPDFConstructor = typeof jsPDF === 'function' ? jsPDF : (jsPDF.jsPDF || jsPDF.default || jsPDF);
  const doc = new JsPDFConstructor({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let currentY = margin;

  // Header
  if (logoUrl) {
    try { doc.addImage(logoUrl, 'PNG', margin, currentY, 15, 15); } catch (e) {}
  }
  
  // Left: Property Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(propertyName.toUpperCase(), margin + (logoUrl ? 20 : 0), currentY + 6);
  
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(subtitle.toUpperCase(), margin + (logoUrl ? 20 : 0), currentY + 11);

  // Right: Title & Audit Info
  doc.setFontSize(16);
  doc.setTextColor(79, 70, 229); // indigo-600
  doc.text(title.toUpperCase(), pageWidth - margin, currentY + 6, { align: 'right' });
  
  doc.setFontSize(8);
  doc.setTextColor(79, 70, 229);
  doc.text("VERIFIED AUDIT TRAIL", pageWidth - margin, currentY + 11, { align: 'right' });

  currentY += 20;

  // Table
  autoTable(doc, {
    startY: currentY,
    head: [headers],
    body: body,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 4
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
      cellPadding: 4
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: margin, right: margin }
  });

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.text(`Page ${i} of ${pageCount}`, margin, footerY);
    doc.text(`Exported by ${userName || 'Admin'} on ${format(new Date(), 'dd MMM yyyy HH:mm')}`, pageWidth / 2, footerY, { align: 'center' });
    doc.text(`© ${new Date().getFullYear()} ${propertyName}`, pageWidth - margin, footerY, { align: 'right' });
  }

  doc.save(filename);
};

export const generateReportPDF = (options: PDFOptions) => {
  const { jsPDF, autoTable, data, propertyName, outletName, outletId, currencySymbol, currencyCode, reportTitle, date, logoUrl, reportType, membershipTypeName, userName, summary, signatoryConfig } = options;
  
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
  const margin = 10; // Back to tight but safe margin
  const contentWidth = pageWidth - (margin * 2);

  // Helper to handle currency formatting
  const formatCurrency = (val: number | undefined | null, skipSymbol = false) => {
    const safeAmount = (val === null || val === undefined || isNaN(Number(val))) ? 0 : Number(val);
    const formatted = safeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    if (skipSymbol) return formatted;

    // jsPDF default fonts only support WinAnsiEncoding (mostly Latin-1).
    // Symbols like 'ر.ق' (Qatari Riyal) will render as garbled text (e.g. þÕ.þ-).
    // We check if the currency symbol contains characters outside the safe range.
    // If it does, we fallback to the currency code (e.g. QAR) to ensure the PDF is readable.
    if (/[^\x00-\xFF\u20AC]/.test(currencySymbol || '')) {
      return `${currencyCode || ''} ${formatted}`.trim();
    }
    return `${currencySymbol || '$'} ${formatted}`;
  };

  // --- HEADER SECTION ---
  let currentY = margin - 5; // Start slightly higher

  // 1. Logo
  if (logoUrl) {
    try {
      doc.addImage(logoUrl, 'PNG', margin, currentY, 15, 15);
    } catch (e) {
      console.error('Logo add error:', e);
    }
  }

  const propertyX = margin + (logoUrl ? 20 : 0);
  
  // Property Name & Subtitle
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42); 
  doc.text(propertyName.toUpperCase(), propertyX, currentY + 6);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`${outletName.toUpperCase()} • ISO-9001 CERTIFIED`, propertyX, currentY + 10);

  // Membership Type Badge (Left side now)
  let leftY = currentY + 12;
  if (membershipTypeName) {
    const typeWidth = doc.getTextWidth(membershipTypeName.toUpperCase()) + 8;
    doc.setFillColor(238, 242, 255);
    doc.roundedRect(propertyX, leftY, typeWidth, 5, 0.8, 0.8, 'F');
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(79, 70, 229);
    doc.text(membershipTypeName.toUpperCase(), propertyX + (typeWidth / 2), leftY + 3.5, { align: 'center' });
    leftY += 6;
  }

  // 1. Internal Verification Badge (Left side)
  const verifyWidth = doc.getTextWidth("INTERNAL VERIFICATION") + 6;
  doc.setDrawColor(79, 70, 229);
  doc.setLineWidth(0.2);
  doc.roundedRect(propertyX, leftY, verifyWidth, 4.5, 0.5, 0.5, 'S');
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.5);
  doc.setTextColor(79, 70, 229);
  doc.text("INTERNAL VERIFICATION", propertyX + (verifyWidth / 2), leftY + 3, { align: 'center' });

  // 2. Report Title & Period (Right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(reportTitle.toUpperCase(), pageWidth - margin, currentY + 6, { align: 'right' });

  // Period Box (Tucked into top right)
  const boxWidth = 30;
  const boxHeight = 8;
  const boxX = pageWidth - margin - boxWidth;
  const boxY = currentY + 10; // Pull up to match UI better

  doc.setFillColor(15, 23, 42);
  doc.roundedRect(boxX, boxY, boxWidth, boxHeight, 1, 1, 'F');
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5);
  doc.setTextColor(255, 255, 255, 0.7);
  doc.text("AUDIT PERIOD", boxX + (boxWidth / 2), boxY + 3, { align: 'center' });
  
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  const periodStr = reportType === 'daily_sales' 
    ? format(date, 'dd MMM yyyy').toUpperCase()
    : reportType === 'monthly_revenue'
    ? format(date, 'yyyy').toUpperCase()
    : format(date, 'MMM yyyy').toUpperCase();
  doc.text(periodStr, boxX + (boxWidth / 2), boxY + 6.5, { align: 'center' });

  // Audit Trail Badge (Matching UI)
  const trailWidth = 25;
  const trailX = pageWidth - margin - trailWidth;
  const trailY = currentY + 20; // Drastically pulled up
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(trailX, trailY, trailWidth, 4, 0.5, 0.5, 'S');
  doc.setFontSize(4.5);
  doc.setTextColor(100, 116, 139);
  doc.text("VERIFIED AUDIT TRAIL", trailX + (trailWidth / 2), trailY + 2.8, { align: 'center' });

  // Divider
  const dividerY = currentY + 28; // Header is now very compact
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, dividerY, pageWidth - margin, dividerY);

  currentY = dividerY + 5;

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
    // Use grouped data from reportData if available
    const grouped = data.groupedRows;

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
      
      Object.entries(grouped).forEach(([type, categories]) => {
        Object.entries(categories as Record<string, any[]>).forEach(([categoryName, groupRows]) => {
          const groupRowsArray = [...groupRows].sort((a: any, b: any) => {
            const dateA = parse(a.start_date, 'dd-MM-yyyy', new Date());
            const dateB = parse(b.start_date, 'dd-MM-yyyy', new Date());
            return dateA.getTime() - dateB.getTime();
          });
          
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
            body: [[{ content: `TIER: ${categoryName.toUpperCase()} (${type.toUpperCase()})`, colSpan: 13 }]],
            theme: 'plain',
            styles: { 
              fillColor: [238, 242, 255], 
              textColor: [49, 46, 129], 
              fontStyle: 'bold', 
              fontSize: 8, 
              cellPadding: 2,
              font: 'helvetica'
            },
            margin: { left: margin, right: margin },
            tableWidth: contentWidth
          });
          
          currentY = (doc as any).lastAutoTable?.finalY || currentY + 10;

          callAutoTable(doc, {
            startY: currentY,
            head: [['SL.', 'GUEST NAME / PROFILE', 'MEM. NO', 'START DATE', 'END DATE', 'DAYS', 'DAILY RATE', 'ACTUAL RATE', 'DISCOUNT', 'NET FEES', 'PREV. ACCRUAL', 'PERIOD REV', 'DEFERRED']],
            body: [
              ...groupRowsArray.map((r: any, idx: number) => [
                idx + 1,
                r.guest_name,
                r.membership_no || 'N/A',
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
              // Subtotal Row integrated into the same table for perfect alignment
              [
                { content: `TIER SUBTOTAL: ${categoryName.toUpperCase()}`, colSpan: 6, styles: { halign: 'left', fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [49, 46, 129], lineWidth: 0.1, lineColor: [0, 0, 0] } },
                { content: formatCurrency(subtotals.daily_rate), styles: { halign: 'right', fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [49, 46, 129], lineWidth: 0.1, lineColor: [0, 0, 0] } },
                { content: formatCurrency(subtotals.actual_rate), styles: { halign: 'right', fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [49, 46, 129], lineWidth: 0.1, lineColor: [0, 0, 0] } },
                { content: formatCurrency(subtotals.discount), styles: { halign: 'right', fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [49, 46, 129], lineWidth: 0.1, lineColor: [0, 0, 0] } },
                { content: formatCurrency(subtotals.net_fees), styles: { halign: 'right', fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [49, 46, 129], lineWidth: 0.1, lineColor: [0, 0, 0] } },
                { content: formatCurrency(subtotals.prev_accrual), styles: { halign: 'right', fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [49, 46, 129], lineWidth: 0.1, lineColor: [0, 0, 0] } },
                { content: formatCurrency(subtotals.period_rev), styles: { halign: 'right', fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [49, 46, 129], lineWidth: 0.1, lineColor: [0, 0, 0] } },
                { content: formatCurrency(subtotals.deferred), styles: { halign: 'right', fontStyle: 'bold', fillColor: [224, 231, 255], textColor: [49, 46, 129], lineWidth: 0.1, lineColor: [0, 0, 0] } }
              ]
            ],
            theme: 'grid',
            headStyles: { 
              fillColor: [15, 23, 42], 
              textColor: [255, 255, 255], 
              fontStyle: 'bold', 
              fontSize: 7, 
              halign: 'center',
              font: 'helvetica'
            },
            styles: { 
              fontSize: 7, 
              cellPadding: 2, 
              font: 'helvetica',
              lineColor: [0, 0, 0], 
              lineWidth: 0.1,
              overflow: 'linebreak'
            },
            columnStyles: {
              0: { halign: 'center', cellWidth: 8 },
              1: { fontStyle: 'bold' }, // Flexible column
              2: { halign: 'center', cellWidth: 15 },
              3: { halign: 'center', cellWidth: 20 },
              4: { halign: 'center', cellWidth: 20 },
              5: { halign: 'center', cellWidth: 12 },
              6: { halign: 'right', cellWidth: 20 },
              7: { halign: 'right', cellWidth: 20 },
              8: { halign: 'right', cellWidth: 20 },
              9: { halign: 'right', cellWidth: 20 },
              10: { halign: 'right', cellWidth: 20, textColor: [100, 116, 139] },
              11: { halign: 'right', fontStyle: 'bold', cellWidth: 20, textColor: [79, 70, 229] },
              12: { halign: 'right', fontStyle: 'bold', cellWidth: 22, textColor: [239, 68, 68] }
            },
            margin: { left: margin, right: margin },
            tableWidth: contentWidth
          });

          currentY = (doc as any).lastAutoTable?.finalY || currentY + 15;
        });
      });
      
      // Grand Total Row
      callAutoTable(doc, {
        startY: currentY + 5,
        body: [[
          { content: "VERIFIED PORTFOLIO TOTAL", colSpan: 6, styles: { halign: 'left', fontStyle: 'bold', lineWidth: 0.1, lineColor: [255, 255, 255] } },
          { content: formatCurrency(grandTotals.daily_rate), styles: { halign: 'right', fontStyle: 'bold', lineWidth: 0.1, lineColor: [255, 255, 255] } },
          { content: formatCurrency(grandTotals.actual_rate), styles: { halign: 'right', fontStyle: 'bold', lineWidth: 0.1, lineColor: [255, 255, 255] } },
          { content: formatCurrency(grandTotals.discount), styles: { halign: 'right', fontStyle: 'bold', lineWidth: 0.1, lineColor: [255, 255, 255] } },
          { content: formatCurrency(grandTotals.net_fees), styles: { halign: 'right', fontStyle: 'bold', lineWidth: 0.1, lineColor: [255, 255, 255] } },
          { content: formatCurrency(grandTotals.prev_accrual), styles: { halign: 'right', fontStyle: 'bold', lineWidth: 0.1, lineColor: [255, 255, 255] } },
          { content: formatCurrency(grandTotals.period_rev), styles: { halign: 'right', fontStyle: 'bold', lineWidth: 0.1, lineColor: [255, 255, 255] } },
          { content: formatCurrency(grandTotals.deferred), styles: { halign: 'right', fontStyle: 'bold', lineWidth: 0.1, lineColor: [255, 255, 255] } }
        ]],
        theme: 'grid',
        styles: { 
          fillColor: [15, 23, 42], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 7, 
          cellPadding: 2,
          font: 'helvetica'
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8 },
          1: { fontStyle: 'bold' },
          2: { halign: 'center', cellWidth: 15 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'center', cellWidth: 20 },
          5: { halign: 'center', cellWidth: 12 },
          6: { halign: 'right', cellWidth: 20 },
          7: { halign: 'right', cellWidth: 20 },
          8: { halign: 'right', cellWidth: 20 },
          9: { halign: 'right', cellWidth: 20 },
          10: { halign: 'right', cellWidth: 20 },
          11: { halign: 'right', cellWidth: 20 },
          12: { halign: 'right', cellWidth: 22 }
        },
        margin: { left: margin, right: margin },
        tableWidth: contentWidth
      });

      currentY = (doc as any).lastAutoTable?.finalY || currentY + 15;
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
          formatCurrency(r.actual_price),
          r.discount_percent > 0 ? `${r.discount_percent.toFixed(0)}%` : '',
          formatCurrency(r.discount_amount),
          formatCurrency(r.net_revenue),
          r.remarks
        ]),
        foot: [[
          { content: 'AGGREGATE PORTFOLIO TOTALS', colSpan: 7, styles: { halign: 'right' } },
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
      
      let specialistLabel = 'STAFF';
      if (reportTitle.includes('Massage')) specialistLabel = 'THERAPIST';
      if (reportTitle.includes('Personal Training')) specialistLabel = 'PERSONAL TRAINER';
      if (reportTitle.includes('Membership')) specialistLabel = 'SALES REP';

      const head = [
        [
          { content: 'SL.NO.', rowSpan: 2 },
          { content: 'DATE', rowSpan: 2 },
          { content: 'GUEST / MEMBER', rowSpan: 2 },
          { content: 'CHECK NO.', rowSpan: 2 },
          ...(outletId === 'all' ? [{ content: 'OUTLET', rowSpan: 2 }] : []),
          { content: 'ITEM / SERVICE', rowSpan: 2 },
          { content: 'DUR.', rowSpan: 2 },
          { content: specialistLabel, rowSpan: 2 },
          { content: 'GROSS AMOUNT', rowSpan: 2 },
          { content: 'DISC %', rowSpan: 2 },
          { content: 'DISCOUNT AMT', rowSpan: 2 },
          { content: 'NET REVENUE', rowSpan: 2 },
          { content: 'INCENTIVE BREAKDOWN', colSpan: 4, styles: { halign: 'center', fillColor: [254, 243, 199], textColor: [15, 23, 42] } },
          { content: 'REMARKS', rowSpan: 2 },
          ...staffHeaders.map((h: string) => ({ content: h, rowSpan: 2 }))
        ],
        [
          { content: 'Total', styles: { fillColor: [255, 255, 255], textColor: [15, 23, 42] } },
          { content: 'Disc %', styles: { fillColor: [255, 255, 255], textColor: [15, 23, 42] } },
          { content: 'Disc. Inc', styles: { fillColor: [255, 255, 255], textColor: [15, 23, 42] } },
          { content: 'Net', styles: { fillColor: [255, 255, 255], textColor: [15, 23, 42] } }
        ]
      ];

      const body = data.rows.map((r: any) => {
        const row = [
          r.sl_no,
          r.date,
          r.guest_name,
          r.check_no || '',
          ...(outletId === 'all' ? [r.outlet_name || ''] : []),
          r.item_name,
          r.duration || '',
          r.therapist_name,
          formatCurrency(r.actual_price),
          r.discount_percent > 0 ? `${r.discount_percent.toFixed(0)}%` : '',
          formatCurrency(r.discount_amount),
          formatCurrency(r.net_revenue),
          formatCurrency(r.inc_total),
          r.inc_discount_percent > 0 ? `${r.inc_discount_percent.toFixed(0)}%` : '',
          formatCurrency(r.inc_discount_val),
          formatCurrency(r.inc_net),
          r.remarks
        ];
        
        // Add staff splits
        staffList.forEach((s: any) => {
          const split = r.staff_splits[s.id];
          row.push(split && split > 0 ? formatCurrency(split) : formatCurrency(0));
        });
        
        return row;
      });

      const staffTotals = staffList.map((s: any) => {
        const total = data.rows.reduce((sum: number, r: any) => sum + (r.staff_splits[s.id] || 0), 0);
        return total > 0 ? formatCurrency(total) : formatCurrency(0);
      });

      const totalActual = data.rows.reduce((sum: number, r: any) => sum + Number(r.actual_price || 0), 0);
      const totalDiscount = data.rows.reduce((sum: number, r: any) => sum + Number(r.discount_amount || 0), 0);
      const totalNetRev = data.rows.reduce((sum: number, r: any) => sum + Number(r.net_revenue || 0), 0);
      const totalIncTotal = data.rows.reduce((sum: number, r: any) => sum + Number(r.inc_total || 0), 0);
      const totalIncDiscountVal = data.rows.reduce((sum: number, r: any) => sum + Number(r.inc_discount_val || 0), 0);
      const totalIncNet = data.rows.reduce((sum: number, r: any) => sum + Number(r.inc_net || 0), 0);

      callAutoTable(doc, {
        startY: currentY,
        head: head,
        body: body,
        foot: [[
          { content: 'AGGREGATE PORTFOLIO TOTALS', colSpan: outletId === 'all' ? 8 : 7, styles: { halign: 'right' } },
          { content: formatCurrency(totalActual), styles: { halign: 'right' } },
          { content: '', styles: {} },
          { content: formatCurrency(totalDiscount), styles: { halign: 'right' } },
          { content: formatCurrency(totalNetRev), styles: { halign: 'right' } },
          { content: formatCurrency(totalIncTotal), styles: { halign: 'right' } },
          { content: '', styles: {} },
          { content: formatCurrency(totalIncDiscountVal), styles: { halign: 'right' } },
          { content: formatCurrency(totalIncNet), styles: { halign: 'right', fillColor: [79, 70, 229] } },
          { content: '', styles: {} },
          ...staffTotals.map((t: string) => ({ content: t, styles: { halign: 'right' } }))
        ]],
        footStyles: { 
          fillColor: [15, 23, 42], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 5.5, 
          cellPadding: 1,
          font: 'helvetica'
        },
        theme: 'grid',
        headStyles: { 
          fillColor: [15, 23, 42], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 5.5, 
          halign: 'center',
          font: 'helvetica'
        },
        styles: { fontSize: 5, cellPadding: 1, font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: {
          0: { halign: 'center', cellWidth: 6 },
          1: { halign: 'center', cellWidth: 12 },
          2: { fontStyle: 'bold', cellWidth: 18 },
          3: { halign: 'center', cellWidth: 12 },
          ...(outletId === 'all' ? { 4: { cellWidth: 12 } } : {}),
          [outletId === 'all' ? 5 : 4]: { cellWidth: 18 },
          [outletId === 'all' ? 6 : 5]: { halign: 'center', cellWidth: 8 },
          [outletId === 'all' ? 7 : 6]: { fontStyle: 'bold', cellWidth: 15 },
          [outletId === 'all' ? 8 : 7]: { halign: 'right', cellWidth: 12 },
          [outletId === 'all' ? 9 : 8]: { halign: 'center', cellWidth: 7 },
          [outletId === 'all' ? 10 : 9]: { halign: 'right', cellWidth: 12 },
          [outletId === 'all' ? 11 : 10]: { halign: 'right', cellWidth: 12 },
          [outletId === 'all' ? 12 : 11]: { halign: 'right', cellWidth: 12 },
          [outletId === 'all' ? 13 : 12]: { halign: 'center', cellWidth: 7 },
          [outletId === 'all' ? 14 : 13]: { halign: 'right', cellWidth: 12 },
          [outletId === 'all' ? 15 : 14]: { halign: 'right', fontStyle: 'bold', cellWidth: 12 },
          [outletId === 'all' ? 16 : 15]: { fontSize: 4, cellWidth: 15 },
          ...staffList.reduce((acc: any, _, idx: number) => {
            acc[(outletId === 'all' ? 17 : 16) + idx] = { halign: 'right', cellWidth: 10 };
            return acc;
          }, {})
        },
        margin: { left: margin, right: margin }
      });

      // Add Summary Table
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      
      const summaryHead = [['STAFF NAME', 'INCENTIVES']];
      const summaryBody = staffList.map((s: any) => {
        const total = data.rows.reduce((sum: number, r: any) => sum + (r.staff_splits[s.id] || 0), 0);
        return [s.name, formatCurrency(total)];
      });
      
      summaryBody.push([
        { content: 'TOTAL', styles: { fontStyle: 'bold', halign: 'center', fillColor: [248, 250, 252] } },
        { content: formatCurrency(totalIncNet), styles: { fontStyle: 'bold', halign: 'right', fillColor: [248, 250, 252] } }
      ]);
      summaryBody.push([
        { content: 'DISCOUNTED AMOUNT', styles: { fontStyle: 'bold', halign: 'left', fillColor: [238, 242, 255] } },
        { content: formatCurrency(totalDiscount), styles: { fontStyle: 'bold', halign: 'right', fillColor: [238, 242, 255] } }
      ]);
      summaryBody.push([
        { content: 'NET REVENUE', styles: { fontStyle: 'bold', halign: 'left', fillColor: [219, 234, 254] } },
        { content: formatCurrency(totalNetRev), styles: { fontStyle: 'bold', halign: 'right', fillColor: [219, 234, 254] } }
      ]);

      callAutoTable(doc, {
        startY: finalY,
        head: summaryHead,
        body: summaryBody,
        theme: 'grid',
        headStyles: { 
          fillColor: [254, 243, 199], 
          textColor: [15, 23, 42], 
          fontStyle: 'bold', 
          fontSize: 6, 
          halign: 'left',
          font: 'helvetica'
        },
        styles: { fontSize: 6, cellPadding: 2, font: 'helvetica', lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { halign: 'right', cellWidth: 30 }
        },
        margin: { left: margin }
      });
    }
  } else if (reportType === 'monthly_revenue') {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(79, 70, 229);
    doc.text(`MODE: ${data.summary.revenueMode === 'cash' ? 'CASH BASIS' : 'AMORTIZATION'}`, margin, currentY - 5);

    if (data.rows.length === 0) {
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("No revenue data found for this period.", margin, currentY);
    } else {
      // Main Table
      callAutoTable(doc, {
        startY: currentY,
        head: [['MONTH', ...monthNames, 'Total']],
        body: [
          ...data.rows.map((r: any) => [
            r.category,
            ...r.values.map((v: number) => v > 0 ? formatCurrency(v) : ''),
            formatCurrency(r.total)
          ]),
          [
            { content: 'Monthly Revenue', styles: { fontStyle: 'bold', fillColor: [226, 232, 240] } },
            ...data.summary.monthlyTotals.map((v: number) => ({ content: v > 0 ? formatCurrency(v) : '-', styles: { fontStyle: 'bold', fillColor: [226, 232, 240] } })),
            { content: formatCurrency(data.summary.yearlyTotal), styles: { fontStyle: 'bold', fillColor: [226, 232, 240] } }
          ],
          [{ content: '', colSpan: 14, styles: { fillColor: [255, 255, 255], minCellHeight: 10 } }],
          [
            { content: `Monthly Revenue ${data.summary.year - 1}`, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
            ...data.summary.previousYearTotals.map((v: number) => ({ content: v > 0 ? formatCurrency(v) : '-', styles: { halign: 'right' } })),
            { content: formatCurrency(data.summary.previousYearlyTotal), styles: { fontStyle: 'bold', halign: 'right' } }
          ],
          [
            { content: 'Amount (+ / -)', styles: { fontStyle: 'bold' } },
            ...data.summary.monthlyTotals.map((v: number, i: number) => {
              const diff = v - data.summary.previousYearTotals[i];
              const isNegative = diff < 0;
              const text = diff !== 0 ? (isNegative ? `(${formatCurrency(Math.abs(diff))})` : formatCurrency(diff)) : '-';
              return { content: text, styles: { halign: 'right', textColor: isNegative ? [220, 38, 38] : [15, 23, 42] } };
            }),
            (() => {
              const diff = data.summary.yearlyTotal - data.summary.previousYearlyTotal;
              const isNegative = diff < 0;
              const text = diff !== 0 ? (isNegative ? `(${formatCurrency(Math.abs(diff))})` : formatCurrency(diff)) : '-';
              return { content: text, styles: { fontStyle: 'bold', halign: 'right', textColor: isNegative ? [220, 38, 38] : [15, 23, 42] } };
            })()
          ],
          [
            { content: 'Percentage % (+ / -)', styles: { fontStyle: 'bold' } },
            ...data.summary.monthlyTotals.map((v: number, i: number) => {
              const prev = data.summary.previousYearTotals[i];
              const diff = v - prev;
              let pct = 0;
              if (prev > 0) pct = (diff / prev) * 100;
              else if (v > 0) pct = 100;
              else if (v === 0 && prev === 0) return { content: '-', styles: { halign: 'right' } };
              else pct = -100;
              const isNegative = pct < 0;
              return { content: isNegative ? `(${Math.abs(pct).toFixed(2)})` : pct.toFixed(2), styles: { halign: 'right', textColor: isNegative ? [220, 38, 38] : [15, 23, 42] } };
            }),
            (() => {
              const prev = data.summary.previousYearlyTotal;
              const diff = data.summary.yearlyTotal - prev;
              let pct = 0;
              if (prev > 0) pct = (diff / prev) * 100;
              else if (data.summary.yearlyTotal > 0) pct = 100;
              else if (data.summary.yearlyTotal === 0 && prev === 0) return { content: '-', styles: { halign: 'right' } };
              else pct = -100;
              const isNegative = pct < 0;
              return { content: isNegative ? `(${Math.abs(pct).toFixed(2)})` : pct.toFixed(2), styles: { fontStyle: 'bold', halign: 'right', textColor: isNegative ? [220, 38, 38] : [15, 23, 42] } };
            })()
          ]
        ],
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, textColor: [15, 23, 42] },
        headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
          0: { fontStyle: 'bold', halign: 'left', cellWidth: 30 },
          1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' },
          5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' }, 8: { halign: 'right' },
          9: { halign: 'right' }, 10: { halign: 'right' }, 11: { halign: 'right' }, 12: { halign: 'right' },
          13: { halign: 'right', fontStyle: 'bold', fillColor: [248, 250, 252] }
        }
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

  // Render Signatories
  const finalTableY = (doc as any).lastAutoTable?.finalY || currentY + 15;
  if (signatoryConfig) {
    const sigY = finalTableY + 15;
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    
    const sigWidth = contentWidth / 3;
    
    doc.text("PREPARED BY", margin + (sigWidth * 0), sigY);
    doc.text(signatoryConfig.prepared, margin + (sigWidth * 0), sigY + 5);
    
    doc.text("REVIEWED BY", margin + (sigWidth * 1), sigY);
    doc.text(signatoryConfig.reviewed, margin + (sigWidth * 1), sigY + 5);
    
    doc.text("APPROVED BY", margin + (sigWidth * 2), sigY);
    doc.text(signatoryConfig.approved, margin + (sigWidth * 2), sigY + 5);
  }

  // --- FOOTER SECTION ---
  const footerY = pageHeight - margin;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`Page 1 of 1 • System ID: ${Math.random().toString(36).substring(7).toUpperCase()}`, margin, footerY);
  
  const exportDateStr = format(new Date(), 'dd-MMM-yyyy');
  const exportInfo = `Exported on: ${exportDateStr}${userName ? ` by ${userName}` : ''}`;
  doc.text(exportInfo, pageWidth / 2, footerY, { align: 'center' });

  doc.text(`© ${new Date().getFullYear()} ${propertyName}. All rights reserved.`, pageWidth - margin, footerY, { align: 'right' });

  return doc;
};

// --- INCENTIVE HELPERS ---

export function findBestRule(rules: any[], department: string, targetId: string, price: number, duration: number, scopeId?: string, secondaryId?: string) {
  // 1. Filter candidates by active status and department (Case-insensitive)
  const targetDept = String(department || '').toLowerCase().trim();
  const candidates = rules.filter(r => {
    const rDept = String(r.applies_to || r.department || '').toLowerCase().trim();
    return r.is_active !== false && rDept === targetDept;
  });
  
  if (candidates.length === 0) return null;

  // 2. Find matches
  const matches = candidates.filter(r => {
    // Scope Match: If rule has an outlet scope, it must match the provided scopeId
    if (r.scope === 'Outlet' && scopeId && String(r.scope_id) !== String(scopeId)) return false;

    // Target Match
    const rtRaw = String(r.target_id || '').toLowerCase().trim();
    const t1Raw = String(targetId || '').toLowerCase().trim();
    const t2Raw = secondaryId ? String(secondaryId).toLowerCase().trim() : '';

    const cleanTargetId = rtRaw.replace(/^type:/, '');
    const cleanMainId = t1Raw.replace(/^type:/, '');
    const cleanSecId = t2Raw.replace(/^type:/, '');

    const isAll = rtRaw === 'all' || !rtRaw;
    const targetMatch = 
      isAll || 
      rtRaw === t1Raw || 
      rtRaw === t2Raw ||
      cleanTargetId === cleanMainId || 
      (cleanSecId && cleanTargetId === cleanSecId);
    
    if (!targetMatch) return false;

    // Price Match
    const minPrice = Number(r.min_price || 0);
    const maxPrice = Number(r.max_price || 999999);
    if (price < minPrice || price > maxPrice) return false;

    // Duration Match (mostly for massage)
    if (targetDept === 'massage' && duration > 0) {
      const minDur = Number(r.min_duration_minutes || 0);
      const maxDur = Number(r.max_duration_minutes || 9999);
      if (duration < minDur || duration > maxDur) return false;
    }

    return true;
  });

  if (matches.length === 0) return null;

  // 3. Sort matches by specificity:
  // - Specific Target ID > 'all'
  // - Scope: Outlet (0) > Property (1) > Global (2)
  return matches.sort((a, b) => {
    const aRt = String(a.target_id || '').toLowerCase().trim();
    const bRt = String(b.target_id || '').toLowerCase().trim();
    const aIsAll = aRt === 'all' || !aRt;
    const bIsAll = bRt === 'all' || !bRt;

    // Target specificity
    if (!aIsAll && bIsAll) return -1;
    if (aIsAll && !bIsAll) return 1;
    
    // Scope specificity (Outlet is most specific, then Property, then Global)
    const scopeOrder: Record<string, number> = { 'Outlet': 0, 'Property': 1, 'Global': 2 };
    const aScope = scopeOrder[a.scope] ?? 9;
    const bScope = scopeOrder[b.scope] ?? 9;
    if (aScope !== bScope) return aScope - bScope;

    return 0;
  })[0];
}

export function getStaffOutlets(s: any): string[] {
  const outlets = new Set<string>();
  
  // Checkboxes / Current
  if (Array.isArray(s.outlet_ids)) {
    s.outlet_ids.forEach((id: any) => id && outlets.add(id));
  } else if (typeof s.outlet_ids === 'string') {
    try {
      const parsed = JSON.parse(s.outlet_ids);
      if (Array.isArray(parsed)) parsed.forEach((id: any) => id && outlets.add(id));
    } catch (e) {}
  }
  
  if (s.outlet_id) outlets.add(s.outlet_id);

  // Historical assignments (ensure they appear in old reports too)
  if (Array.isArray(s.outlet_assignments)) {
    s.outlet_assignments.forEach((a: any) => {
      if (a.outlet_id) outlets.add(a.outlet_id);
    });
  }

  return Array.from(outlets);
}

export function isStaffAssignedToOutletOnDate(staff: any, outletId: string, dateStr: string): boolean {
  if (!staff || !outletId || !dateStr) return false;
  
  const assignments = Array.isArray(staff.outlet_assignments) ? staff.outlet_assignments : [];
  
  // Historical check via assignments
  if (assignments.length > 0) {
    // Sort assignments by start_date ascending to find gaps/ranges
    const sorted = [...assignments].sort((a: any, b: any) => a.start_date.localeCompare(b.start_date));
    
    // 1. Check if date falls into a specific recorded assignment for THIS outlet
    const match = sorted.find((a: any) => {
      const start = a.start_date;
      const end = a.end_date;
      // Note: We use dateStr.split('T')[0] to ensure we're comparing YYYY-MM-DD
      const d = dateStr.split('T')[0];
      return a.outlet_id === outletId && d >= start && (!end || d <= end);
    });

    if (match) {
      return true;
    }

    // 2. Check if the date is before the first recorded assignment
    // If user hasn't recorded the entire past, we fallback to current outlet_ids
    // but we EXCLUDE the outlet that is specifically marked as starting in the future
    const firstStart = sorted[0].start_date;
    const d = dateStr.split('T')[0];
    
    if (d < firstStart) {
      if (staff.joining_date && d < staff.joining_date) return false;
      
      const currentOutlets = getStaffOutlets(staff);
      // If the outlet we are checking is the one that STARTS in the future, 
      // we know they weren't there yet.
      if (outletId === sorted[0].outlet_id) return false;
      
      return currentOutlets.includes(outletId);
    }
    
    // 3. Fallback for dates after all assignments (if no open-ended ones exist)
    // If every assignment has an end_date, they technically "left" the company or moved to a non-tracked state
    return false;
  }

  // Fallback to current outlet_ids for legacy data (assuming they were always there if no history recorded)
  const currentOutlets = getStaffOutlets(staff);
  return currentOutlets.includes(outletId);
}

export function wasStaffAssignedToOutletInRange(staff: any, outletId: string, startStr: string, endStr: string): boolean {
  if (!staff || !outletId || !startStr || !endStr) return false;
  
  const assignments = Array.isArray(staff.outlet_assignments) ? staff.outlet_assignments : [];
  
  if (assignments.length > 0) {
    const sorted = [...assignments].sort((a: any, b: any) => a.start_date.localeCompare(b.start_date));
    
    // 1. Check if any assignment overlaps with the report range
    const hasOverlap = sorted.some((a: any) => {
      if (a.outlet_id !== outletId) return false;
      const aStart = a.start_date;
      const aEnd = a.end_date;
      return aStart <= endStr && (!aEnd || aEnd >= startStr);
    });
    
    if (hasOverlap) return true;

    // 2. Logic for dates before the first recorded assignment
    // Fallback to current outlets but exclude the one that starts in the future
    if (endStr < sorted[0].start_date) {
      if (staff.joining_date && endStr < staff.joining_date) return false;
      if (outletId === sorted[0].outlet_id) return false;
      return getStaffOutlets(staff).includes(outletId);
    }
    
    return false;
  }

  // Fallback to legacy behavior if no history tracked
  const currentOutlets = getStaffOutlets(staff);
  return currentOutlets.includes(outletId);
}

export function isStaffOnLeaveOnDate(staff: any, dateStr: string) {
  if (!staff.leaves || !Array.isArray(staff.leaves) || !dateStr) return false;
  
  // Normalize comparison date to YYYY-MM-DD
  const compareDate = dateStr.split('T')[0];
  const date = new Date(compareDate);
  
  return staff.leaves.some((l: any) => {
    if (!l.start_date || !l.end_date) return false;
    
    // Normalize leave dates to YYYY-MM-DD
    const startStr = l.start_date.split('T')[0];
    const endStr = l.end_date.split('T')[0];
    
    const start = new Date(startStr);
    const end = new Date(endStr);
    
    return date >= start && date <= end && (!l.status || l.status === 'approved');
  });
}

export function isStaffOnProbationOnDate(staff: any, dateStr: string) {
  if (!staff.probation_end_date || !dateStr) return false;
  
  const compareDate = dateStr.split('T')[0];
  const date = new Date(compareDate);
  
  const probationEndStr = staff.probation_end_date.split('T')[0];
  const probationEnd = new Date(probationEndStr);
  
  return date < probationEnd;
}