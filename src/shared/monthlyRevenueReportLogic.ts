import { supabase } from '../../services/supabase';
import { format, startOfYear, endOfYear, parseISO, subYears, getMonth, startOfMonth, endOfMonth, differenceInCalendarDays } from 'date-fns';
import { RevenueEngine } from '../../services/revenueEngine';

export interface MonthlyRevenueData {
  year: number;
  revenueMode: 'cash' | 'accrual';
  months: number[]; // 0 to 11
  rows: {
    category: string;
    values: number[]; // 12 months
    total: number;
  }[];
  monthlyTotals: number[];
  yearlyTotal: number;
  previousYearTotals: number[];
  previousYearlyTotal: number;
}

export const getMonthlyRevenueData = async (
  supabase: any,
  propertyId: string,
  outletId: string,
  year: number,
  revenueMode: 'cash' | 'accrual' = 'cash',
  endMonthIndex?: number
): Promise<MonthlyRevenueData> => {
  const startDate = startOfYear(new Date(year, 0, 1));
  const endDate = endOfYear(new Date(year, 0, 1));
  const prevStartDate = startOfYear(subYears(startDate, 1));
  const prevEndDate = endOfYear(subYears(startDate, 1));

  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');
  const prevStartStr = format(prevStartDate, 'yyyy-MM-dd');
  const prevEndStr = format(prevEndDate, 'yyyy-MM-dd');

  let outletIds: string[] = [];
  let isSingleOutlet = false;
  if (outletId === 'all') {
    const { data: outlets } = await supabase.from('outlets').select('id').eq('property_id', propertyId);
    outletIds = (outlets || []).map((o: any) => o.id);
  } else {
    outletIds = [outletId];
    isSingleOutlet = true;
  }

  if (outletIds.length === 0) {
    return {
      year,
      revenueMode,
      months: Array.from({ length: 12 }, (_, i) => i),
      rows: [],
      monthlyTotals: Array(12).fill(0),
      yearlyTotal: 0,
      previousYearTotals: Array(12).fill(0),
      previousYearlyTotal: 0
    };
  }

  // Helper to build query
  const buildQuery = (table: string, columns: string) => {
    let query = supabase.from(table).select(columns);
    if (isSingleOutlet) {
      query = query.eq('outlet_id', outletIds[0]);
    } else {
      query = query.in('outlet_id', outletIds);
    }
    return query;
  };

  // Fetch data
  const [
    bookingsRes,
    salesRes,
    typesRes,
    prevBookingsRes,
    prevSalesRes,
    freezesRes
  ] = await Promise.all([
    buildQuery('massage_bookings', 'date, price, discount').eq('status', 'completed'),
    buildQuery('sales', 'created_at, net_amount, category').eq('status', 'completed'),
    buildQuery('membership_types', 'id, name'),
    buildQuery('massage_bookings', 'date, price, discount').eq('status', 'completed'),
    buildQuery('sales', 'created_at, net_amount').eq('status', 'completed'),
    supabase.from('freezes').select('*')
  ]);

  const bookings = (bookingsRes.data || []).filter(b => b.date >= startStr && b.date <= endStr);
  const sales = (salesRes.data || []).filter(s => s.created_at >= `${startStr}T00:00:00` && s.created_at <= `${endStr}T23:59:59`);
  const prevBookings = (prevBookingsRes.data || []).filter(b => b.date >= prevStartStr && b.date <= prevEndStr);
  const prevSales = (prevSalesRes.data || []).filter(s => s.created_at >= `${prevStartStr}T00:00:00` && s.created_at <= `${prevEndStr}T23:59:59`);

  // Fetch members differently based on mode
  let membersRes, prevMembersRes;
  if (revenueMode === 'cash') {
    [membersRes, prevMembersRes] = await Promise.all([
      supabase.from('members').select('start_date, net_amount, membership_type_id').in('outlet_id', outletIds).gte('start_date', startStr).lte('start_date', endStr),
      supabase.from('members').select('start_date, net_amount').in('outlet_id', outletIds).gte('start_date', prevStartStr).lte('start_date', prevEndStr)
    ]);
  } else {
    // Accrual mode: fetch all members who could have active days in current or previous year
    [membersRes, prevMembersRes] = await Promise.all([
      supabase.from('members').select('*').in('outlet_id', outletIds).lte('start_date', endStr).gte('current_end_date', startStr),
      supabase.from('members').select('*').in('outlet_id', outletIds).lte('start_date', prevEndStr).gte('current_end_date', prevStartStr)
    ]);
  }

  const members = membersRes.data || [];
  const types = typesRes.data || [];
  const freezes = freezesRes.data || [];
  const typeMap = Object.fromEntries(types.map((t: any) => [t.id, t.name]));

  const prevMembers = prevMembersRes.data || [];

  // Initialize rows
  const rowMap: Record<string, number[]> = {
    'Massage': Array(12).fill(0),
    'P. Training': Array(12).fill(0),
    'Entrance Fee': Array(12).fill(0),
    'Retail Items': Array(12).fill(0)
  };

  // Add membership types to rows
  types.forEach((t: any) => {
    rowMap[t.name] = Array(12).fill(0);
  });

  // Process current year data
  bookings.forEach((b: any) => {
    if (!b.date) return;
    const month = getMonth(parseISO(b.date));
    rowMap['Massage'][month] += ((b.price || 0) - (b.discount || 0));
  });

  sales.forEach((s: any) => {
    if (!s.created_at) return;
    const month = getMonth(parseISO(s.created_at));
    if (s.category === 'Personal Training') {
      rowMap['P. Training'][month] += (s.net_amount || 0);
    } else if (s.category === 'Day Use' || s.category === 'Entrance Fee') {
      rowMap['Entrance Fee'][month] += (s.net_amount || 0);
    } else if (s.category === 'Retail' || s.category === 'Retail Items') {
      rowMap['Retail Items'][month] += (s.net_amount || 0);
    } else {
      const otherCat = s.category || 'Other';
      if (!rowMap[otherCat]) rowMap[otherCat] = Array(12).fill(0);
      rowMap[otherCat][month] += (s.net_amount || 0);
    }
  });

  if (revenueMode === 'cash') {
    members.forEach((m: any) => {
      if (!m.start_date) return;
      const mDate = parseISO(m.start_date);
      const month = getMonth(mDate);
      const typeName = typeMap[m.membership_type_id] || 'Membership';
      if (!rowMap[typeName]) rowMap[typeName] = Array(12).fill(0);
      rowMap[typeName][month] += (m.net_amount || 0);
    });
  } else {
    // Accrual Mode - Optimized
    // Group freezes by member_id first to avoid O(N*M) filtering
    const freezesByMemberId: Record<string, any[]> = {};
    freezes.forEach((f: any) => {
      if (!freezesByMemberId[f.member_id]) freezesByMemberId[f.member_id] = [];
      freezesByMemberId[f.member_id].push({
        _start: parseISO(f.start_date),
        _end: parseISO(f.end_date)
      });
    });

    const parsedMembers = members.map((m: any) => ({
      ...m,
      _start: parseISO(m.start_date),
      _end: parseISO(m.current_end_date),
      _freezes: freezesByMemberId[m.id] || []
    }));

    parsedMembers.forEach((m: any) => {
      const typeName = typeMap[m.membership_type_id] || 'Membership';
      if (!rowMap[typeName]) rowMap[typeName] = Array(12).fill(0);
      
      const mStartMonth = getMonth(m._start);
      const mEndMonth = getMonth(m._end);
      const mYear = m._start.getFullYear();
      const mEndYear = m._end.getFullYear();

      for (let month = 0; month < 12; month++) {
        // Skip months where member definitely wasn't active
        if (year < mYear || year > mEndYear) continue;
        if (year === mYear && month < mStartMonth) continue;
        if (year === mEndYear && month > mEndMonth) continue;

        const monthStart = startOfMonth(new Date(year, month, 1));
        const monthEnd = endOfMonth(new Date(year, month, 1));
        
        // Inline calculateRevenuePeriod logic to avoid repeated parsing
        const activeStart = monthStart > m._start ? monthStart : m._start;
        const activeEnd = monthEnd < m._end ? monthEnd : m._end;

        if (activeStart > activeEnd) continue;

        const totalPotentialDays = differenceInCalendarDays(activeEnd, activeStart) + 1;
        let frozenDays = 0;

        m._freezes.forEach((f: any) => {
          const intersectStart = f._start > activeStart ? f._start : activeStart;
          const intersectEnd = f._end < activeEnd ? f._end : activeEnd;
          if (intersectStart <= intersectEnd) {
            frozenDays += differenceInCalendarDays(intersectEnd, intersectStart) + 1;
          }
        });

        const recognizedDays = Math.max(0, totalPotentialDays - frozenDays);
        rowMap[typeName][month] += recognizedDays * (m.daily_rate || 0);
      }
    });
  }

  // Calculate monthly totals
  const monthlyTotals = Array(12).fill(0);
  const rows = Object.keys(rowMap).map(category => {
    const values = rowMap[category];
    const total = values.reduce((sum, val) => sum + val, 0);
    values.forEach((val, i) => {
      monthlyTotals[i] += val;
    });
    return { category, values, total };
  });

  // Sort rows
  const sortedRows = [];
  const mainCats = ['Massage', 'P. Training', 'Entrance Fee', 'Retail Items'];
  const membershipRows = rows.filter(r => !mainCats.includes(r.category)).sort((a, b) => a.category.localeCompare(b.category));
  
  const massageRow = rows.find(r => r.category === 'Massage');
  if (massageRow) sortedRows.push(massageRow);
  sortedRows.push(...membershipRows);
  
  const ptRow = rows.find(r => r.category === 'P. Training');
  if (ptRow) sortedRows.push(ptRow);
  const entranceFeeRow = rows.find(r => r.category === 'Entrance Fee');
  if (entranceFeeRow) sortedRows.push(entranceFeeRow);
  const retailRow = rows.find(r => r.category === 'Retail Items');
  if (retailRow) sortedRows.push(retailRow);

  const yearlyTotal = monthlyTotals.reduce((sum, val) => sum + val, 0);

  // Process previous year data
  const previousYearTotals = Array(12).fill(0);
  prevBookings.forEach((b: any) => {
    if (!b.date) return;
    const month = getMonth(parseISO(b.date));
    previousYearTotals[month] += ((b.price || 0) - (b.discount || 0));
  });
  prevSales.forEach((s: any) => {
    if (!s.created_at) return;
    const month = getMonth(parseISO(s.created_at));
    previousYearTotals[month] += (s.net_amount || 0);
  });

  if (revenueMode === 'cash') {
    prevMembers.forEach((m: any) => {
      if (!m.start_date) return;
      const month = getMonth(parseISO(m.start_date));
      previousYearTotals[month] += (m.net_amount || 0);
    });
  } else {
    // Accrual Mode for previous year - Optimized
    // Group freezes by member_id if not already done (it might be out of scope)
    const freezesByMemberId: Record<string, any[]> = {};
    freezes.forEach((f: any) => {
      if (!freezesByMemberId[f.member_id]) freezesByMemberId[f.member_id] = [];
      freezesByMemberId[f.member_id].push({
        _start: parseISO(f.start_date),
        _end: parseISO(f.end_date)
      });
    });

    const prevYearMembers = prevMembers.map((m: any) => ({
      ...m,
      _start: parseISO(m.start_date),
      _end: parseISO(m.current_end_date),
      _freezes: freezesByMemberId[m.id] || []
    }));

    prevYearMembers.forEach((m: any) => {
      const mStartMonth = getMonth(m._start);
      const mEndMonth = getMonth(m._end);
      const mYear = m._start.getFullYear();
      const mEndYear = m._end.getFullYear();
      const prevYear = year - 1;

      for (let month = 0; month < 12; month++) {
        // Skip months where member definitely wasn't active in prevYear
        if (prevYear < mYear || prevYear > mEndYear) continue;
        if (prevYear === mYear && month < mStartMonth) continue;
        if (prevYear === mEndYear && month > mEndMonth) continue;

        const monthStart = startOfMonth(new Date(prevYear, month, 1));
        const monthEnd = endOfMonth(new Date(prevYear, month, 1));
        
        const activeStart = monthStart > m._start ? monthStart : m._start;
        const activeEnd = monthEnd < m._end ? monthEnd : m._end;

        if (activeStart > activeEnd) continue;

        const totalPotentialDays = differenceInCalendarDays(activeEnd, activeStart) + 1;
        let frozenDays = 0;

        m._freezes.forEach((f: any) => {
          const intersectStart = f._start > activeStart ? f._start : activeStart;
          const intersectEnd = f._end < activeEnd ? f._end : activeEnd;
          if (intersectStart <= intersectEnd) {
            frozenDays += differenceInCalendarDays(intersectEnd, intersectStart) + 1;
          }
        });

        const recognizedDays = Math.max(0, totalPotentialDays - frozenDays);
        previousYearTotals[month] += recognizedDays * (m.daily_rate || 0);
      }
    });
  }

  if (endMonthIndex !== undefined) {
    sortedRows.forEach(row => {
      row.values = row.values.map((v, i) => i > endMonthIndex ? 0 : v);
      row.total = row.values.reduce((sum, val) => sum + val, 0);
    });
    monthlyTotals.forEach((_, i) => {
      if (i > endMonthIndex) monthlyTotals[i] = 0;
    });
    previousYearTotals.forEach((_, i) => {
      if (i > endMonthIndex) previousYearTotals[i] = 0;
    });
  }

  const finalYearlyTotal = monthlyTotals.reduce((sum, val) => sum + val, 0);
  const finalPreviousYearlyTotal = previousYearTotals.reduce((sum, val) => sum + val, 0);

  return {
    year,
    revenueMode,
    months: Array.from({ length: 12 }, (_, i) => i),
    rows: sortedRows,
    monthlyTotals,
    yearlyTotal: finalYearlyTotal,
    previousYearTotals,
    previousYearlyTotal: finalPreviousYearlyTotal
  };
};
