import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Card, CardContent, CardHeader, Button } from '../components/ui';
import { 
  Users, 
  Clock, 
  Activity, 
  ShieldCheck, 
  BarChart4, 
  Database, 
  TrendingUp,
  Calendar,
  Snowflake,
  Zap,
  CheckCircle2,
  CalendarClock,
  Sparkles,
  Lock,
  ShoppingBag,
  Contact2,
  PieChart as PieChartIcon,
  ChevronRight,
  Filter,
  Building2,
  Store,
  Terminal,
  RefreshCcw,
  Award,
  AlertTriangle
} from 'lucide-react';
import { db } from '../services/mockSupabase';
import { Member, MassageBooking, Sale, Staff, MemberStatus, InventoryItem, MassageRoom } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
// Fix: Added isSameDay to date-fns imports to resolve compiler error on line 185
import { format, endOfMonth, differenceInCalendarDays, isSameMonth, startOfMonth, subMonths, isAfter, startOfDay, isWithinInterval, parse, isSameDay } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

const parseISO = (dateString: string) => {
  if (!dateString) return new Date();
  let d = new Date(dateString);
  if (!isNaN(d.getTime())) return d;
  try {
    return parse(dateString, 'dd-MM-yyyy', new Date());
  } catch (e) {
    return new Date();
  }
};

interface PerformanceTrendData {
  month: string;
  revenue: number;
  intake: number;
}

const PerformanceLeaderboard = ({ staff, bookings }: { staff: Staff[], bookings: MassageBooking[] }) => {
  const leaderboard = useMemo(() => {
    const performance: Record<string, { name: string, count: number }> = {};
    
    bookings.filter(b => b.status === 'completed').forEach(b => {
      if (b.therapist_id) {
        if (!performance[b.therapist_id]) {
          const s = staff.find(st => st.id === b.therapist_id);
          performance[b.therapist_id] = { name: s?.name || 'Unknown', count: 0 };
        }
        performance[b.therapist_id].count += 1;
      }
    });
    
    return Object.values(performance).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [staff, bookings]);

  return (
    <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg bg-white overflow-hidden">
      <CardHeader className="p-6 border-b border-slate-100">
        <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
          <Award className="w-4 h-4 text-amber-600" /> Performance Leaderboard
        </h3>
      </CardHeader>
      <CardContent className="p-4">
        {leaderboard.length === 0 ? (
            <p className="text-xs font-black text-slate-400 text-center py-4">No data available</p>
        ) : (
            leaderboard.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-slate-400">#{index + 1}</span>
                  <span className="text-xs font-black text-slate-900">{item.name}</span>
                </div>
                <span className="text-xs font-black text-indigo-600">{item.count} Sessions</span>
              </div>
            ))
        )}
      </CardContent>
    </Card>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentOutlet, currentProperty, formatMoney, hasPermission, outlets = [], setPageLoading } = useSettings();
  
  const [dashboardMonth, setDashboardMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewScope, setViewScope] = useState<'outlet' | 'property'>('outlet');
  const [loading, setLoading] = useState(true);

  const allowedOutletsInProperty = useMemo(() => {
    if (!currentProperty || !user || !outlets) return [];
    if (user.role_id?.toLowerCase() === 'admin') {
        return outlets.filter(o => o.property_id === currentProperty.id);
    }
    return outlets.filter(o => 
        o.property_id === currentProperty.id && 
        user.allowed_outlets?.includes(o.id)
    );
  }, [currentProperty, user, outlets]);

  const [stats, setStats] = useState({
    activeMembers: 0,
    frozenMembers: 0,
    newMembersThisMonth: 0,
    dailyAccrual: 0,
    revenueThisMonth: 0,
    futureRevenue: 0,
    projectedEndMonth: 0,
    bookingCount: 0,
    bookingYield: 0,
    todaySalesTotal: 0,
    todaySalesCount: 0,
    staffActive: 0,
    staffOnLeave: 0,
    atv: 0,
    grossRevenue: 0,
    totalDiscounts: 0,
    netRevenue: 0,
    momGrowth: 0,
    roomUtilization: 0,
    cancellationRate: 0,
    guestRevenue: 0,
    memberRevenue: 0
  });
  
  const [monthlyExpiringMembers, setMonthlyExpiringMembers] = useState<Member[]>([]);
  const [performanceTrendData, setPerformanceTrendData] = useState<PerformanceTrendData[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<MassageBooking[]>([]);
  const [revenueMix, setRevenueMix] = useState<{name: string, value: number, color: string}[]>([]);
  const [membershipTypeMix, setMembershipTypeMix] = useState<{name: string, value: number, color: string}[]>([]);
  const [membershipTypes, setMembershipTypes] = useState<any[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [bookings, setBookings] = useState<MassageBooking[]>([]);
  const [lowStockItems, setLowStockItems] = useState<InventoryItem[]>([]);
  const [topProducts, setTopProducts] = useState<{name: string, count: number}[]>([]);
  const [topSpenders, setTopSpenders] = useState<{name: string, amount: number}[]>([]);
  const [peakHours, setPeakHours] = useState<{hour: string, count: number}[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if(currentOutlet && currentProperty) {
      loadStats();
    } else {
      setLoading(false);
    }
  }, [currentOutlet, currentProperty, dashboardMonth, viewScope]);

  // Real-time synchronization subscription
  useEffect(() => {
    if (!currentOutlet || !currentProperty) return;

    const channel = supabase
      .channel('realtime-dashboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members' },
        () => loadStats()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'massage_bookings' },
        () => loadStats()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales' },
        () => loadStats()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff' },
        () => loadStats()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff_leaves' },
        () => loadStats()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'freezes' },
        () => loadStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOutlet, currentProperty]);

  const loadStats = async () => {
    if (!currentOutlet || !currentProperty) return;
    setLoading(true);
    setPageLoading(true);
    
    try {
        const now = new Date();
        const todayStr = format(now, 'yyyy-MM-dd');
        const viewDate = startOfMonth(parseISO(dashboardMonth + '-01'));
        const isCurrentMonth = isSameMonth(viewDate, now);
        const contextStart = startOfMonth(viewDate);
        const auditPoint = isCurrentMonth ? now : endOfMonth(viewDate);

        // Scoping Logic
        const isProperty = viewScope === 'property';
        const scopeId = isProperty ? currentProperty.id : currentOutlet.id;
        
        let limitToIds: string[] | undefined = undefined;
        if (isProperty && user?.role_id?.toLowerCase() !== 'admin') {
            limitToIds = allowedOutletsInProperty.map(o => o.id);
        }

        // Fetch data with scope awareness
        const [members, freezes, bookings, sales, staff, leaves, inventory, rooms, mTypes] = await Promise.all([
          db.getMembers(scopeId, isProperty, limitToIds),
          db.getFreezes(),
          db.getMassageBookings(scopeId, isProperty, limitToIds),
          db.getSales(scopeId, isProperty, limitToIds),
          db.getStaff(scopeId, isProperty, limitToIds),
          db.getAllStaffLeaves(),
          db.getInventory(scopeId, isProperty, limitToIds),
          db.getMassageRooms(currentOutlet.id, currentProperty.id),
          db.getMembershipTypes(scopeId, isProperty, limitToIds)
        ]);
        
        setMembershipTypes(mTypes);

        // 1. Membership Logic
        let activeAtPointCount = 0;
        let frozenAtPointCount = 0;
        let mtdMembershipRevenue = 0;
        let deferredRevenueAtPoint = 0;
        let monthEnrollments = 0;
        let totalDailyAccrual = 0;
        
        const typeRevenueMap: Record<string, number> = {};
        const typeCountMap: Record<string, number> = {};

        members.forEach(m => {
          const mStart = parseISO(m.start_date);
          const mEnd = parseISO(m.current_end_date);
          const enrollmentDate = parseISO(m.created_at || m.start_date);

          if (isSameMonth(enrollmentDate, viewDate)) monthEnrollments++;
          
          const memberFreezes = freezes.filter(f => f.member_id === m.id);
          const earnedInPeriod = RevenueEngine.calculateRevenuePeriod(m, memberFreezes, contextStart, auditPoint);
          mtdMembershipRevenue += earnedInPeriod;
          
          // Track by type
          if (m.membership_type_id) {
              typeRevenueMap[m.membership_type_id] = (typeRevenueMap[m.membership_type_id] || 0) + earnedInPeriod;
          } else {
              typeRevenueMap['unassigned'] = (typeRevenueMap['unassigned'] || 0) + earnedInPeriod;
          }

          const earnedLifetimeToPoint = RevenueEngine.calculateRevenuePeriod(m, memberFreezes, mStart, auditPoint);
          deferredRevenueAtPoint += Math.max(0, m.net_amount - earnedLifetimeToPoint);

          if (auditPoint >= mStart && auditPoint <= mEnd) {
              const isFrozenAtPoint = memberFreezes.some(f => 
                  auditPoint >= parseISO(f.start_date) && 
                  auditPoint <= parseISO(f.end_date)
              );
              if (isFrozenAtPoint) frozenAtPointCount++;
              else {
                  activeAtPointCount++;
                  totalDailyAccrual += m.daily_rate;
                  
                  if (m.membership_type_id) {
                      typeCountMap[m.membership_type_id] = (typeCountMap[m.membership_type_id] || 0) + 1;
                  } else {
                      typeCountMap['unassigned'] = (typeCountMap['unassigned'] || 0) + 1;
                  }
              }
          }
        });

        // Prepare Membership Type Mix
        const typeMix: {name: string, value: number, count: number, color: string}[] = [];
        
        // 1. Add known types
        mTypes.forEach((t, i) => {
            typeMix.push({
                name: t.name,
                value: typeRevenueMap[t.id] || 0,
                count: typeCountMap[t.id] || 0,
                color: ['#4f46e5', '#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b'][i % 5]
            });
        });

        // 2. Add "Unassigned" or "Other" for any revenue/count not in mTypes
        const knownTypeIds = new Set(mTypes.map(t => t.id));
        let otherRevenue = typeRevenueMap['unassigned'] || 0;
        let otherCount = typeCountMap['unassigned'] || 0;

        Object.keys(typeRevenueMap).forEach(id => {
            if (id !== 'unassigned' && !knownTypeIds.has(id)) {
                otherRevenue += typeRevenueMap[id];
            }
        });
        Object.keys(typeCountMap).forEach(id => {
            if (id !== 'unassigned' && !knownTypeIds.has(id)) {
                otherCount += typeCountMap[id];
            }
        });

        if (otherRevenue > 0 || otherCount > 0) {
            typeMix.push({
                name: mTypes.length > 0 ? 'Other / Unassigned' : 'All Members (Unassigned)',
                value: otherRevenue,
                count: otherCount,
                color: '#94a3b8'
            });
        }
        
        // Filter out 0-value entries for the Pie Chart specifically if needed, 
        // but for now let's keep them so the user sees the types exist.
        setMembershipTypeMix(typeMix);

        // 2. Performance Trend (6 months)
        const performanceTrend: PerformanceTrendData[] = [];
        for (let i = 5; i >= 0; i--) {
            const targetMonthDate = subMonths(viewDate, i);
            const monthStart = startOfMonth(targetMonthDate);
            const monthEnd = endOfMonth(targetMonthDate);
            const intakeInMonth = members.filter(m => isSameMonth(parseISO(m.start_date), targetMonthDate)).length;

            let totalRevInMonth = 0;
            members.forEach(m => {
                const mStart = parseISO(m.start_date);
                const mEnd = parseISO(m.current_end_date);
                if (mEnd >= monthStart && mStart <= monthEnd) {
                    const memberFreezes = freezes.filter(f => f.member_id === m.id);
                    totalRevInMonth += RevenueEngine.calculateRevenuePeriod(m, memberFreezes, monthStart, monthEnd);
                }
            });
            sales.filter(s => {
                const d = new Date(s.created_at);
                return s.status === 'completed' && d >= monthStart && d <= monthEnd;
            }).forEach(s => totalRevInMonth += Number(s.net_amount));
            bookings.filter(b => {
                const d = parseISO(b.date);
                return b.status === 'completed' && d >= monthStart && d <= monthEnd;
            }).forEach(b => totalRevInMonth += Number(b.price));

            performanceTrend.push({ month: format(targetMonthDate, 'MMM'), revenue: totalRevInMonth, intake: intakeInMonth });
        }
        setPerformanceTrendData(performanceTrend);

        // 3. Daily Stats (Sales & Staff)
        const todaySales = sales.filter(s => s.status === 'completed' && isSameDay(new Date(s.created_at), now));
        const staffOnProbationCount = staff.filter(s => {
            const today = startOfDay(new Date());
            
            // Check probation fields
            if (s.probation_start_date && s.probation_end_date) {
                try {
                    const start = startOfDay(parseISO(s.probation_start_date));
                    const end = startOfDay(parseISO(s.probation_end_date));
                    if (isWithinInterval(today, { start, end })) return true;
                } catch (e) {}
            }
            return false;
        }).length;

        const staffOnLeaveCount = staff.filter(s => {
            const today = startOfDay(new Date());
            
            // Check new staff_leaves table
            const sLeaves = leaves.filter(l => l.staff_id === s.id);
            return sLeaves.some(l => {
                try {
                    const start = startOfDay(parseISO(l.start_date));
                    const end = startOfDay(parseISO(l.end_date));
                    return isWithinInterval(today, { start, end });
                } catch (e) { return false; }
            });
        }).length;

        // 4. Revenue Mix (MTD)
        let mtdServiceRevenue = 0;
        bookings.filter(b => b.status === 'completed' && isSameMonth(parseISO(b.date), viewDate))
                .forEach(b => mtdServiceRevenue += Number(b.price));
        
        let mtdSalesRevenue = 0;
        sales.filter(s => s.status === 'completed' && isSameMonth(new Date(s.created_at), viewDate))
             .forEach(s => mtdSalesRevenue += Number(s.net_amount));

        setRevenueMix([
            { name: 'Membership', value: mtdMembershipRevenue, color: '#4f46e5' },
            { name: 'Treatments', value: mtdServiceRevenue, color: '#8b5cf6' },
            { name: 'Retail POS', value: mtdSalesRevenue, color: '#0ea5e9' }
        ]);

        // 5. Expiries & Upcoming
        const todayAtZero = startOfDay(now);
        const monthlyExpiring = members.filter(m => {
            const mEnd = parseISO(m.current_end_date);
            if (!isSameMonth(mEnd, viewDate)) return false;
            if (mEnd < todayAtZero) return false;
            return true;
        }).sort((a, b) => a.current_end_date.localeCompare(b.current_end_date)).slice(0, 10);
        
        const todayBookings = bookings.filter(b => b.date === todayStr && b.status !== 'cancelled');
        const upcoming = bookings.filter(b => (b.date === todayStr || isAfter(parseISO(b.date), todayAtZero)) && b.status === 'confirmed')
                                 .sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`))
                                 .slice(0, 5);

        // 6. New Metrics
        const mtdSales = sales.filter(s => s.status === 'completed' && isSameMonth(new Date(s.created_at), viewDate));
        const mtdSalesCount = mtdSales.length;
        const atv = mtdSalesCount > 0 ? mtdSalesRevenue / mtdSalesCount : 0;

        let grossRevenue = 0;
        let totalDiscounts = 0;
        mtdSales.forEach(s => {
            grossRevenue += Number(s.gross_amount || s.net_amount);
            totalDiscounts += Number(s.discount_amount || 0);
        });
        
        // MoM Growth
        const prevMonthDate = subMonths(viewDate, 1);
        let prevMonthRevenue = 0;
        sales.filter(s => s.status === 'completed' && isSameMonth(new Date(s.created_at), prevMonthDate))
             .forEach(s => prevMonthRevenue += Number(s.net_amount));
        bookings.filter(b => b.status === 'completed' && isSameMonth(parseISO(b.date), prevMonthDate))
                .forEach(b => prevMonthRevenue += Number(b.price));
        members.forEach(m => {
            const mStart = parseISO(m.start_date);
            const mEnd = parseISO(m.current_end_date);
            const monthStart = startOfMonth(prevMonthDate);
            const monthEnd = endOfMonth(prevMonthDate);
            if (mEnd >= monthStart && mStart <= monthEnd) {
                const memberFreezes = freezes.filter(f => f.member_id === m.id);
                prevMonthRevenue += RevenueEngine.calculateRevenuePeriod(m, memberFreezes, monthStart, monthEnd);
            }
        });
        
        const currentTotalRevenue = mtdMembershipRevenue + mtdServiceRevenue + mtdSalesRevenue;
        const momGrowth = prevMonthRevenue > 0 ? ((currentTotalRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : 0;

        // Room Utilization
        const totalBookedHours = bookings.filter(b => b.status === 'completed' && isSameMonth(parseISO(b.date), viewDate)).length; // Assuming 1 hour per booking for simplicity
        const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
        const totalAvailableHours = rooms.length * 12 * daysInMonth; // 12 hours a day
        const roomUtilization = totalAvailableHours > 0 ? (totalBookedHours / totalAvailableHours) * 100 : 0;

        // Cancellation Rate
        const totalMonthBookings = bookings.filter(b => isSameMonth(parseISO(b.date), viewDate)).length;
        const cancelledMonthBookings = bookings.filter(b => b.status === 'cancelled' && isSameMonth(parseISO(b.date), viewDate)).length;
        const cancellationRate = totalMonthBookings > 0 ? (cancelledMonthBookings / totalMonthBookings) * 100 : 0;

        // Guest vs Member Revenue
        let guestRevenue = 0;
        let memberRevenue = 0;
        mtdSales.forEach(s => {
            if (s.guest_id) memberRevenue += Number(s.net_amount);
            else guestRevenue += Number(s.net_amount);
        });

        // Top Spenders
        const spenderMap: Record<string, number> = {};
        mtdSales.forEach(s => {
            if (s.guest_name) {
                spenderMap[s.guest_name] = (spenderMap[s.guest_name] || 0) + Number(s.net_amount);
            }
        });
        const topSpendersList = Object.entries(spenderMap)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);

        // Low Stock Items
        const lowStock = inventory.filter(i => i.track_inventory && i.stock_quantity <= 10);
        setLowStockItems(lowStock);

        // Top Products
        const productMap: Record<string, number> = {};
        mtdSales.forEach(s => {
            if (s.item_name && s.category === 'Retail') {
                productMap[s.item_name] = (productMap[s.item_name] || 0) + Number(s.quantity || 1);
            }
        });
        const topProductsList = Object.entries(productMap)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        setTopProducts(topProductsList);

        // Peak Hours Heatmap
        const hourMap: Record<string, number> = {};
        bookings.filter(b => b.status === 'completed' && isSameMonth(parseISO(b.date), viewDate)).forEach(b => {
            const hour = b.start_time.split(':')[0] + ':00';
            hourMap[hour] = (hourMap[hour] || 0) + 1;
        });
        const peakHoursList = Object.entries(hourMap)
            .map(([hour, count]) => ({ hour, count }))
            .sort((a, b) => a.hour.localeCompare(b.hour));
        setPeakHours(peakHoursList);
        setTopSpenders(topSpendersList);

        setStats({
          activeMembers: activeAtPointCount, 
          frozenMembers: frozenAtPointCount,
          newMembersThisMonth: monthEnrollments, 
          dailyAccrual: totalDailyAccrual, 
          revenueThisMonth: currentTotalRevenue,
          futureRevenue: deferredRevenueAtPoint, 
          projectedEndMonth: mtdMembershipRevenue + (totalDailyAccrual * Math.max(0, differenceInCalendarDays(endOfMonth(viewDate), auditPoint))),
          bookingCount: todayBookings.length,
          bookingYield: todayBookings.filter(b => b.status === 'completed').length,
          todaySalesTotal: todaySales.reduce((acc, s) => acc + s.net_amount, 0),
          todaySalesCount: todaySales.length,
          staffActive: staff.filter(s => s.is_active).length - staffOnLeaveCount - staffOnProbationCount,
          staffOnLeave: staffOnLeaveCount,
          staffOnProbation: staffOnProbationCount,
          atv,
          grossRevenue,
          totalDiscounts,
          netRevenue: mtdSalesRevenue,
          momGrowth,
          roomUtilization,
          cancellationRate,
          guestRevenue,
          memberRevenue
        });

        setMonthlyExpiringMembers(monthlyExpiring);
        setUpcomingBookings(upcoming);
        setStaff(staff);
        setSales(sales);
        setBookings(bookings);
    } catch (e) {
        console.error("Dashboard Intelligence Error:", e);
    } finally {
        setLoading(false);
        setPageLoading(false);
    }
  };

  const displayName = useMemo(() => {
      if (!user?.name) return 'Admin';
      return user.name.trim().split(/\s+/)[0];
  }, [user?.name]);
  
  const canViewDashboard = user && hasPermission(user.role_id, 'dashboard:view');
  const canViewFinancials = user && hasPermission(user.role_id, 'dashboard:view_financials');
  const canViewInsights = user && hasPermission(user.role_id, 'dashboard:view_insights');
  const canSwitchScope = user && hasPermission(user.role_id, 'settings:view_properties') && allowedOutletsInProperty.length > 1;

  const kpiData = [
    { title: "Active Portfolio", value: stats.activeMembers, icon: Users, color: "text-emerald-600" },
    { title: "Service Load", value: `${stats.bookingCount} Sessions`, icon: Zap, color: "text-indigo-600" },
    { title: "Staff Status", value: `${stats.staffActive} Active`, icon: Contact2, color: "text-amber-600", sub: `${stats.staffOnLeave} on leave` },
    ...(canViewFinancials ? [
        { title: "POS Volume", value: formatMoney(stats.todaySalesTotal), icon: ShoppingBag, color: "text-blue-600", sub: `${stats.todaySalesCount} txns today` }
    ] : [])
  ];

  const advancedKpiData = [
    ...(canViewFinancials ? [
        { title: "Avg Transaction Value", value: formatMoney(stats.atv), icon: ShoppingBag, color: "text-blue-500", sub: "MTD Sales" },
        { title: "MoM Growth", value: `${stats.momGrowth > 0 ? '+' : ''}${stats.momGrowth.toFixed(1)}%`, icon: TrendingUp, color: stats.momGrowth >= 0 ? "text-emerald-500" : "text-red-500", sub: "vs Last Month" }
    ] : []),
    { title: "Room Utilization", value: `${stats.roomUtilization.toFixed(1)}%`, icon: Building2, color: "text-indigo-500", sub: "MTD Booked Hours" },
    { title: "Cancellation Rate", value: `${stats.cancellationRate.toFixed(1)}%`, icon: Clock, color: "text-rose-500", sub: "MTD Bookings" }
  ];

  if (!canViewDashboard) {
      return (
          <div className="flex items-center justify-center h-screen">
              <Card className="max-w-md text-center p-8 border-red-100 bg-red-50/30 rounded-[2rem]">
                  <ShieldCheck className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Operational Block</h3>
                  <p className="text-slate-500 mt-2 text-sm">Your security clearance does not allow access to high-level dashboard intelligence.</p>
              </Card>
          </div>
      );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all duration-500">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-indigo-100/50 transition-colors duration-700"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none uppercase">
            Hello, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">{displayName}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <p className="text-slate-500 text-xs font-black uppercase tracking-widest">
              Intelligence Center &bull; <span className="text-indigo-600 font-bold">{format(parseISO(dashboardMonth+'-01'), 'MMMM yyyy')}</span>
            </p>
            {canSwitchScope && (
                <>
                    <div className="h-3 w-px bg-slate-200"></div>
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button onClick={() => setViewScope('outlet')} className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all flex items-center gap-1.5 ${viewScope === 'outlet' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                            <Store className="w-2.5 h-2.5" /> Outlet
                        </button>
                        <button onClick={() => setViewScope('property')} className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all flex items-center gap-1.5 ${viewScope === 'property' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                            <Building2 className="w-2.5 h-2.5" /> Property
                        </button>
                    </div>
                </>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-end relative z-10 gap-3">
            <div className="flex items-center gap-3 bg-white border border-slate-200 p-2 pl-4 rounded-2xl shadow-sm">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <input type="month" value={dashboardMonth} onChange={e => setDashboardMonth(e.target.value)} className="h-8 border-none outline-none font-black text-[10px] uppercase bg-transparent w-36 cursor-pointer" />
            </div>
          <div className="flex items-center gap-3 bg-slate-950 text-white px-5 py-3 rounded-2xl shadow-xl shadow-slate-200 group-hover:shadow-2xl group-hover:scale-105 transition-all duration-300">
             <Clock className="w-5 h-5 text-indigo-400" />
             <span className="text-xl font-black tracking-tighter tabular-nums">{format(currentTime, 'HH:mm:ss')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi) => (
            <Card key={kpi.title} className="border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-[1.8rem]">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{kpi.title}</p>
                        <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">{kpi.value}</h3>
                    {kpi.sub && <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">{kpi.sub}</p>}
                </CardContent>
            </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {advancedKpiData.map((kpi) => (
            <Card key={kpi.title} className="border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 rounded-[1.8rem] bg-slate-50">
                <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">{kpi.title}</p>
                        <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">{kpi.value}</h3>
                    {kpi.sub && <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">{kpi.sub}</p>}
                </CardContent>
            </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-8 flex flex-col gap-4">
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg bg-white overflow-hidden">
                <CardHeader className="p-8 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <TrendingUp className="w-5 h-5 text-indigo-600" /> Executive Performance Curve
                        </h3>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Consolidated Gross Yield & Intake</p>
                    </div>
                </CardHeader>
                <CardContent className="p-8 h-[380px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={performanceTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="left" tickFormatter={(val) => canViewFinancials ? formatMoney(val).split(' ')[1] : '***'} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '1rem', color: 'white' }}
                                labelStyle={{ fontWeight: 'black', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}
                                itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                                formatter={(value: any, name: any) => {
                                    if (name === 'Revenue' && !canViewFinancials) return ['***', name];
                                    if (name === 'Revenue') return [formatMoney(value), name];
                                    return [value, name];
                                }}
                            />
                            <Legend wrapperStyle={{fontSize: "9px", fontWeight: "900", textTransform: "uppercase", paddingTop: "20px"}} iconType="circle" />
                            <Bar yAxisId="right" dataKey="intake" name="New Members" fill="#a5b4fc" radius={[4, 4, 0, 0]} barSize={18} />
                            {canViewFinancials && <Bar yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={18} />}
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg bg-white overflow-hidden">
                    <CardHeader className="p-6 border-b border-slate-100">
                        <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
                            <PieChartIcon className="w-4 h-4 text-indigo-600" /> Revenue Mix (MTD)
                        </h3>
                    </CardHeader>
                    <CardContent className="p-0 h-[260px] flex items-center">
                        <div className="flex-1 h-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={revenueMix} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                        {revenueMix.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip formatter={(val: number) => formatMoney(val)} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-40 pr-8 space-y-3">
                            {revenueMix.map(item => (
                                <div key={item.name} className="space-y-0.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{backgroundColor: item.color}}></div>
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{item.name}</span>
                                    </div>
                                    <p className="text-xs font-black text-slate-900 pl-4">{formatMoney(item.value)}</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg bg-white overflow-hidden">
                    <CardHeader className="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
                            <Clock className="w-4 h-4 text-amber-600" /> Expiry Sentinel
                        </h3>
                        <span className="text-[8px] font-black text-slate-400 uppercase">Next 30 Days</span>
                    </CardHeader>
                    <CardContent className="p-2 max-h-[260px] overflow-y-auto custom-scrollbar">
                        {monthlyExpiringMembers.length === 0 ? (
                            <div className="py-20 text-center opacity-40">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                                <p className="text-[10px] font-black uppercase">No immediate expiries</p>
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {monthlyExpiringMembers.map(m => {
                                    const daysLeft = differenceInCalendarDays(parseISO(m.current_end_date), new Date());
                                    return (
                                        <button key={m.id} onClick={() => navigate('/members', { state: { selectedMemberId: m.id } })} className="w-full text-left p-3 flex items-center justify-between hover:bg-slate-50 transition-colors rounded-2xl group">
                                            <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 font-black text-[9px] uppercase">{m.guest_name.charAt(0)}</div>
                                                <div>
                                                    <h4 className="font-black text-slate-700 text-[10px] uppercase tracking-tight">{m.guest_name}</h4>
                                                    <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">{m.membership_number}</p>
                                                </div>
                                            </div>
                                            <span className={`text-[8px] font-black px-2 py-1 rounded-md border whitespace-nowrap bg-amber-50 text-amber-600 border-amber-100 group-hover:bg-amber-600 group-hover:text-white transition-colors`}>
                                                {daysLeft}d Remaining
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
        
        <div className="lg:col-span-4 flex flex-col gap-4">
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg bg-white overflow-hidden h-full flex flex-col">
                <CardHeader className="p-8 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3 uppercase">
                        <CalendarClock className="w-5 h-5 text-indigo-600" /> Reservation Grid
                    </h3>
                </CardHeader>
                <CardContent className="p-6 flex-1 flex flex-col">
                    <div className="space-y-3 flex-1">
                        {upcomingBookings.length === 0 ? (
                            <div className="py-20 text-center flex flex-col items-center">
                                <div className="p-5 bg-indigo-50 rounded-3xl mb-4"><Calendar className="w-8 h-8 text-indigo-200" /></div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">No confirmed sessions</p>
                            </div>
                        ) : (
                            upcomingBookings.map(b => (
                                <div key={b.id} className="flex items-center justify-between p-5 bg-slate-50/50 hover:bg-white hover:shadow-xl hover:-translate-y-1 transition-all rounded-[1.8rem] border border-transparent hover:border-slate-100 group cursor-pointer">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100 font-black text-xs">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{b.start_time} - {b.end_time}</p>
                                            <p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest">{format(parseISO(b.date), 'EEEE, dd MMM')}</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
                                </div>
                            ))
                        )}
                    </div>
                    <Button onClick={() => navigate('/bookings')} variant="secondary" className="w-full mt-8 h-14 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] bg-slate-100 hover:bg-indigo-600 hover:text-white transition-all">
                        Full Service Grid
                    </Button>
                </CardContent>
            </Card>

            {canViewFinancials && (
                <Card className="rounded-[2.5rem] border-indigo-200 bg-indigo-900 shadow-2xl overflow-hidden group">
                    <CardContent className="p-8 relative">
                        <div className="absolute -right-8 -bottom-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                            <Sparkles className="w-40 h-40 text-white" />
                        </div>
                        <div className="relative z-10">
                            <p className="text-[9px] font-black text-indigo-300 uppercase tracking-[0.3em] mb-4">Financial Health Check</p>
                            <div className="space-y-4">
                                <div className="flex justify-between items-end border-b border-indigo-800 pb-4">
                                    <span className="text-white/60 text-xs font-bold">Daily Accrual Rate</span>
                                    <span className="text-white font-black text-xl tracking-tighter">{formatMoney(stats.dailyAccrual)}</span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <span className="text-white/60 text-xs font-bold">Projected Month End</span>
                                    <span className="text-indigo-400 font-black text-xl tracking-tighter">{formatMoney(stats.projectedEndMonth)}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
            <PerformanceLeaderboard staff={staff} bookings={bookings} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg bg-white overflow-hidden">
            <CardHeader className="p-6 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
                    <PieChartIcon className="w-4 h-4 text-indigo-600" /> Revenue by Membership Type
                </h3>
            </CardHeader>
            <CardContent className="p-0 h-[260px] flex items-center">
                <div className="flex-1 h-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={membershipTypeMix} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                {membershipTypeMix.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                            </Pie>
                            <Tooltip formatter={(val: number) => formatMoney(val)} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="w-48 pr-8 space-y-3">
                    {membershipTypeMix.map(item => (
                        <div key={item.name} className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{backgroundColor: item.color}}></div>
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter truncate max-w-[100px]">{item.name}</span>
                            </div>
                            <p className="text-xs font-black text-slate-900 pl-4">{formatMoney(item.value)}</p>
                        </div>
                    ))}
                    {membershipTypeMix.length === 0 && <p className="text-[10px] font-black text-slate-400 uppercase">No data</p>}
                </div>
            </CardContent>
        </Card>

        <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg bg-white overflow-hidden">
            <CardHeader className="p-6 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
                    <Users className="w-4 h-4 text-emerald-600" /> Active Members by Type
                </h3>
            </CardHeader>
            <CardContent className="p-6 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={membershipTypeMix} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis 
                            dataKey="name" 
                            type="category" 
                            tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} 
                            axisLine={false} 
                            tickLine={false}
                            width={80}
                        />
                        <Tooltip 
                            cursor={{fill: 'transparent'}}
                            contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '1rem', color: 'white' }}
                            itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                        />
                        <Bar dataKey="count" name="Active Members" radius={[0, 4, 4, 0]} barSize={20}>
                            {membershipTypeMix.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Top Spenders */}
        <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg bg-white overflow-hidden">
            <CardHeader className="p-6 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
                    <Award className="w-4 h-4 text-amber-500" /> Top Spenders (VIPs)
                </h3>
            </CardHeader>
            <CardContent className="p-4">
                <div className="space-y-2">
                    {topSpenders.map((s, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl">
                            <span className="text-xs font-bold text-slate-700">{s.name}</span>
                            <span className="text-xs font-black text-indigo-600">{formatMoney(s.amount)}</span>
                        </div>
                    ))}
                    {topSpenders.length === 0 && <p className="text-center text-xs text-slate-400 py-4">No data</p>}
                </div>
            </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg bg-white overflow-hidden">
            <CardHeader className="p-6 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
                    <ShoppingBag className="w-4 h-4 text-blue-500" /> Top Moving Products
                </h3>
            </CardHeader>
            <CardContent className="p-4">
                <div className="space-y-2">
                    {topProducts.map((p, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl">
                            <span className="text-xs font-bold text-slate-700">{p.name}</span>
                            <span className="text-xs font-black text-blue-600">{p.count} sold</span>
                        </div>
                    ))}
                    {topProducts.length === 0 && <p className="text-center text-xs text-slate-400 py-4">No data</p>}
                </div>
            </CardContent>
        </Card>

        {/* Low Stock */}
        <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg bg-white overflow-hidden">
            <CardHeader className="p-6 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
                    <AlertTriangle className="w-4 h-4 text-red-500" /> Low Stock Warnings
                </h3>
            </CardHeader>
            <CardContent className="p-4">
                <div className="space-y-2">
                    {lowStockItems.slice(0, 5).map((item, i) => (
                        <div key={i} className="flex justify-between items-center p-3 bg-red-50 rounded-2xl">
                            <span className="text-xs font-bold text-slate-700">{item.name}</span>
                            <span className="text-xs font-black text-red-600">{item.stock_quantity} left</span>
                        </div>
                    ))}
                    {lowStockItems.length === 0 && <p className="text-center text-xs text-slate-400 py-4">Stock levels normal</p>}
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Peak Hours Heatmap */}
        <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg bg-white overflow-hidden">
            <CardHeader className="p-6 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
                    <Clock className="w-4 h-4 text-indigo-500" /> Peak Hours (Bookings)
                </h3>
            </CardHeader>
            <CardContent className="p-6 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={peakHours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                        <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                        <Tooltip
                            contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '1rem', color: 'white' }}
                            labelStyle={{ fontWeight: 'black', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}
                            itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                        />
                        <Bar dataKey="count" name="Bookings" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>

        {/* Guest vs Member Revenue */}
        {canViewFinancials && (
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg bg-white overflow-hidden">
                <CardHeader className="p-6 border-b border-slate-100">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
                        <Users className="w-4 h-4 text-emerald-500" /> Guest vs Member Revenue
                    </h3>
                </CardHeader>
                <CardContent className="p-6 h-[300px] flex items-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={[
                                { name: 'Member', value: stats.memberRevenue, color: '#10b981' },
                                { name: 'Guest', value: stats.guestRevenue, color: '#f59e0b' }
                            ]} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                {[{color: '#10b981'}, {color: '#f59e0b'}].map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                            </Pie>
                            <Tooltip formatter={(val: number) => formatMoney(val)} />
                            <Legend wrapperStyle={{fontSize: "9px", fontWeight: "900", textTransform: "uppercase"}} />
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        )}
      </div>

      {canViewFinancials && (
          <div className="grid grid-cols-1 gap-4">
            {/* Revenue vs Discount */}
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg bg-white overflow-hidden">
                <CardHeader className="p-6 border-b border-slate-100">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2 uppercase">
                        <TrendingUp className="w-4 h-4 text-indigo-500" /> Revenue vs Discount Analysis (MTD Sales)
                    </h3>
                </CardHeader>
                <CardContent className="p-6 h-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={[{ name: 'MTD Sales', Gross: stats.grossRevenue, Discount: stats.totalDiscounts, Net: stats.netRevenue }]} layout="vertical" margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                            <XAxis type="number" tickFormatter={(val) => formatMoney(val).split(' ')[1]} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="name" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 'bold' }} axisLine={false} tickLine={false} width={80} />
                            <Tooltip
                                contentStyle={{ background: '#0f172a', border: 'none', borderRadius: '1rem', color: 'white' }}
                                labelStyle={{ fontWeight: 'black', fontSize: '10px', textTransform: 'uppercase', marginBottom: '4px' }}
                                itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                                formatter={(value: any, name: any) => [formatMoney(value), name]}
                            />
                            <Legend wrapperStyle={{fontSize: "9px", fontWeight: "900", textTransform: "uppercase"}} />
                            <Bar dataKey="Gross" fill="#94a3b8" radius={[0, 4, 4, 0]} barSize={20} />
                            <Bar dataKey="Discount" fill="#f43f5e" radius={[0, 4, 4, 0]} barSize={20} />
                            <Bar dataKey="Net" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
          </div>
      )}
    </div>
  );
};

export default Dashboard;