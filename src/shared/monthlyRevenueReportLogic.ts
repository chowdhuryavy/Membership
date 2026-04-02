import { supabase } from '../../services/supabase';
import { format, startOfYear, endOfYear, parseISO, subYears, getMonth } from 'date-fns';

export interface MonthlyRevenueData {
  year: number;
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
  propertyId: string,
  outletId: string,
  year: number
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
  if (outletId === 'all') {
    const { data: outlets } = await supabase.from('outlets').select('id').eq('property_id', propertyId);
    outletIds = (outlets || []).map((o: any) => o.id);
  } else {
    outletIds = [outletId];
  }

  if (outletIds.length === 0) {
    return {
      year,
      months: Array.from({ length: 12 }, (_, i) => i),
      rows: [],
      monthlyTotals: Array(12).fill(0),
      yearlyTotal: 0,
      previousYearTotals: Array(12).fill(0),
      previousYearlyTotal: 0
    };
  }

  // Fetch data for current year
  const [
    membersRes,
    bookingsRes,
    salesRes,
    typesRes,
    prevMembersRes,
    prevBookingsRes,
    prevSalesRes
  ] = await Promise.all([
    supabase.from('members').select('start_date, net_amount, membership_type_id').in('outlet_id', outletIds).gte('start_date', startStr).lte('start_date', endStr),
    supabase.from('massage_bookings').select('date, net_revenue').in('outlet_id', outletIds).eq('status', 'completed').gte('date', startStr).lte('date', endStr),
    supabase.from('sales').select('created_at, net_amount, category').in('outlet_id', outletIds).eq('status', 'completed').gte('created_at', `${startStr}T00:00:00`).lte('created_at', `${endStr}T23:59:59`),
    supabase.from('membership_types').select('id, name').in('outlet_id', outletIds),
    // Previous year data for comparison
    supabase.from('members').select('start_date, net_amount').in('outlet_id', outletIds).gte('start_date', prevStartStr).lte('start_date', prevEndStr),
    supabase.from('massage_bookings').select('date, net_revenue').in('outlet_id', outletIds).eq('status', 'completed').gte('date', prevStartStr).lte('date', prevEndStr),
    supabase.from('sales').select('created_at, net_amount').in('outlet_id', outletIds).eq('status', 'completed').gte('created_at', `${prevStartStr}T00:00:00`).lte('created_at', `${prevEndStr}T23:59:59`)
  ]);

  const members = membersRes.data || [];
  const bookings = bookingsRes.data || [];
  const sales = salesRes.data || [];
  const types = typesRes.data || [];
  const typeMap = Object.fromEntries(types.map((t: any) => [t.id, t.name]));

  const prevMembers = prevMembersRes.data || [];
  const prevBookings = prevBookingsRes.data || [];
  const prevSales = prevSalesRes.data || [];

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
    rowMap['Massage'][month] += (b.net_revenue || 0);
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
      // Catch-all for other categories to ensure they are not missed in the total
      const otherCat = s.category || 'Other';
      if (!rowMap[otherCat]) rowMap[otherCat] = Array(12).fill(0);
      rowMap[otherCat][month] += (s.net_amount || 0);
    }
  });

  members.forEach((m: any) => {
    if (!m.start_date) return;
    const month = getMonth(parseISO(m.start_date));
    const typeName = typeMap[m.membership_type_id] || 'Other Membership';
    if (!rowMap[typeName]) rowMap[typeName] = Array(12).fill(0);
    rowMap[typeName][month] += (m.net_amount || 0);
  });

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

  // Sort rows: Massage first, then memberships, then P. Training, Entrance Fee, Retail
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
    previousYearTotals[month] += (b.net_revenue || 0);
  });
  prevSales.forEach((s: any) => {
    if (!s.created_at) return;
    const month = getMonth(parseISO(s.created_at));
    previousYearTotals[month] += (s.net_amount || 0);
  });
  prevMembers.forEach((m: any) => {
    if (!m.start_date) return;
    const month = getMonth(parseISO(m.start_date));
    previousYearTotals[month] += (m.net_amount || 0);
  });

  const previousYearlyTotal = previousYearTotals.reduce((sum, val) => sum + val, 0);

  return {
    year,
    months: Array.from({ length: 12 }, (_, i) => i),
    rows: sortedRows,
    monthlyTotals,
    yearlyTotal,
    previousYearTotals,
    previousYearlyTotal
  };
};
