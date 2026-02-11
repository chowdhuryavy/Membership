
import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '../components/ui';
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
  Lock
} from 'lucide-react';
import { db } from '../services/mockSupabase';
import { Member, MassageBooking } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, endOfMonth, differenceInCalendarDays, isSameMonth, startOfMonth, subMonths, isSameDay, isAfter } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const parseISO = (dateString: string) => new Date(dateString);

interface PerformanceTrendData {
  month: string;
  revenue: number;
  intake: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentOutlet, currentProperty, formatMoney, hasPermission } = useSettings();
  
  const [dashboardMonth, setDashboardMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [currentTime, setCurrentTime] = useState(new Date());

  const [stats, setStats] = useState({
    activeMembers: 0,
    frozenMembers: 0,
    newMembersThisMonth: 0,
    dailyAccrual: 0,
    revenueThisMonth: 0,
    futureRevenue: 0,
    projectedEndMonth: 0,
    bookingCount: 0,
    bookingYield: 0
  });
  
  const [monthlyExpiringMembers, setMonthlyExpiringMembers] = useState<Member[]>([]);
  const [performanceTrendData, setPerformanceTrendData] = useState<PerformanceTrendData[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<MassageBooking[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if(currentOutlet) {
      loadStats();
    }
  }, [currentOutlet, currentProperty, dashboardMonth]);

  const loadStats = async () => {
    if (!currentOutlet || !currentProperty) return;
    
    const [members, freezes, bookings] = await Promise.all([
      db.getMembers(currentOutlet.id),
      db.getFreezes(),
      db.getMassageBookings(currentProperty.id)
    ]);
    
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const viewDate = parseISO(dashboardMonth + '-01');
    const isCurrentMonth = isSameMonth(viewDate, now);
    
    const contextStart = startOfMonth(viewDate);
    const auditPoint = isCurrentMonth ? now : endOfMonth(viewDate);
    
    let activeAtPointCount = 0;
    let frozenAtPointCount = 0;
    let mtdRevenue = 0;
    let deferredRevenueAtPoint = 0;
    let monthEnrollments = 0;
    let totalDailyAccrual = 0;

    members.forEach(m => {
      const mStart = parseISO(m.start_date);
      const mEnd = parseISO(m.current_end_date);
      const enrollmentDate = parseISO(m.created_at || m.start_date);

      if (isSameMonth(enrollmentDate, viewDate)) monthEnrollments++;
      
      const memberFreezes = freezes.filter(f => f.member_id === m.id);
      mtdRevenue += RevenueEngine.calculateRevenuePeriod(m, memberFreezes, contextStart, auditPoint);
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
          }
      }
    });

    const performanceTrend: PerformanceTrendData[] = [];
    for (let i = 5; i >= 0; i--) {
        const targetMonthDate = subMonths(viewDate, i);
        const monthStart = startOfMonth(targetMonthDate);
        const monthEnd = endOfMonth(targetMonthDate);
        
        const intakeInMonth = members.filter(m => isSameMonth(parseISO(m.start_date), targetMonthDate)).length;

        let revenueInMonth = 0;
        members.forEach(m => {
            const mStart = parseISO(m.start_date);
            const mEnd = parseISO(m.current_end_date);
            if (mEnd >= monthStart && mStart <= monthEnd) {
                const memberFreezes = freezes.filter(f => f.member_id === m.id);
                revenueInMonth += RevenueEngine.calculateRevenuePeriod(m, memberFreezes, monthStart, monthEnd);
            }
        });
        performanceTrend.push({ month: format(targetMonthDate, 'MMM'), revenue: revenueInMonth, intake: intakeInMonth });
    }
    setPerformanceTrendData(performanceTrend);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const monthlyExpiring = members.filter(m => {
        const mEnd = parseISO(m.current_end_date);
        if (!isSameMonth(mEnd, viewDate)) return false;
        if (mEnd < today) return false;
        return true;
    }).sort((a, b) => a.current_end_date.localeCompare(b.current_end_date)).slice(0, 10);
    
    // Booking Logic
    const todayBookings = bookings.filter(b => b.date === todayStr && b.status !== 'cancelled');
    const upcoming = bookings.filter(b => (b.date === todayStr || isAfter(parseISO(b.date), today)) && b.status === 'confirmed')
                             .sort((a, b) => `${a.date} ${a.start_time}`.localeCompare(`${b.date} ${b.start_time}`))
                             .slice(0, 5);

    const endOfMonthDate = endOfMonth(viewDate);
    const daysRemaining = Math.max(0, differenceInCalendarDays(endOfMonthDate, auditPoint));
    const projectedMonthEnd = mtdRevenue + (totalDailyAccrual * daysRemaining);

    setStats({
      activeMembers: activeAtPointCount, frozenMembers: frozenAtPointCount,
      newMembersThisMonth: monthEnrollments, dailyAccrual: totalDailyAccrual, revenueThisMonth: mtdRevenue,
      futureRevenue: deferredRevenueAtPoint, projectedEndMonth: projectedMonthEnd,
      bookingCount: todayBookings.length,
      bookingYield: todayBookings.filter(b => b.status === 'completed').length
    });
    setMonthlyExpiringMembers(monthlyExpiring);
    setUpcomingBookings(upcoming);
  };

  const displayName = useMemo(() => {
      if (!user?.name) return 'Admin';
      return user.name.trim().split(/\s+/)[0];
  }, [user?.name]);
  
  const canViewDashboard = user && hasPermission(user.role_id, 'dashboard:view');
  const canViewFinancials = user && hasPermission(user.role_id, 'dashboard:view_financials');

  const kpiData = [
    { title: "Active Portfolio", value: stats.activeMembers, icon: Users, color: "text-emerald-600" },
    { title: "Service Occupancy", value: `${stats.bookingCount} Services`, icon: Zap, color: "text-indigo-600" },
    // Only show financial KPIs if permitted
    ...(canViewFinancials ? [
        { title: "MTD Recognition", value: formatMoney(stats.revenueThisMonth), icon: BarChart4, color: "text-blue-600" },
        { title: "Daily Accrual", value: formatMoney(stats.dailyAccrual), icon: Activity, color: "text-amber-600" }
    ] : [])
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all duration-500">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-indigo-100/50 transition-colors duration-700"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">{displayName}</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-2">
            Operational context for <span className="font-bold text-slate-700">{format(parseISO(dashboardMonth+'-01'), 'MMMM yyyy')}</span>.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-end relative z-10 gap-3">
            <div className="flex items-center gap-3 bg-white border border-slate-200 p-2 pl-4 rounded-2xl shadow-sm">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <input 
                    type="month" 
                    value={dashboardMonth} 
                    onChange={e => setDashboardMonth(e.target.value)} 
                    className="h-8 border-none outline-none font-black text-xs uppercase bg-transparent w-36 cursor-pointer" 
                />
            </div>
          <div className="flex items-center gap-3 bg-slate-950 text-white px-5 py-3 rounded-2xl shadow-xl shadow-slate-200 group-hover:shadow-2xl group-hover:scale-105 transition-all duration-300">
             <Clock className="w-5 h-5 text-indigo-400" />
             <span className="text-xl font-black tracking-tighter tabular-nums">
               {format(currentTime, 'HH:mm:ss')}
             </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiData.map((kpi) => (
            <Card key={kpi.title} className="border-slate-200/60 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{kpi.title}</p>
                        <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{kpi.value}</h3>
                </CardContent>
            </Card>
        ))}
        {!canViewFinancials && (
            <Card className="border-dashed border-slate-300 bg-slate-50/50 shadow-none">
                <CardContent className="p-6 flex flex-col items-center justify-center h-full text-center opacity-60">
                    <Lock className="w-6 h-6 text-slate-400 mb-2" />
                    <p className="text-[10px] font-black uppercase text-slate-400">Financial Data Restricted</p>
                </CardContent>
            </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg h-full">
                <CardHeader className="p-8 border-b border-slate-100">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <TrendingUp className="w-5 h-5 text-indigo-600" /> 6-Month Performance Review
                    </h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Recognition Curve vs. New Member Intake</p>
                </CardHeader>
                <CardContent className="p-8 h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={performanceTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="left" tickFormatter={(val) => canViewFinancials ? formatMoney(val).split(' ')[1] : '***'} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '1rem', color: 'white', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                labelStyle={{ fontWeight: 'bold', textTransform: 'uppercase' }}
                                itemStyle={{ fontWeight: 'bold' }}
                                formatter={(value: any, name: any) => {
                                    if (name === 'Revenue' && !canViewFinancials) return ['***', name];
                                    if (name === 'Revenue') return [formatMoney(value), name];
                                    return [value, name];
                                }}
                                cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }}
                            />
                            <Legend wrapperStyle={{fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", paddingTop: "20px"}} iconType="circle" />
                            <Bar yAxisId="right" dataKey="intake" name="New Members" fill="#a5b4fc" radius={[6, 6, 0, 0]} barSize={20} />
                            {canViewFinancials && <Bar yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={20} />}
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
        
        <div className="space-y-8">
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg">
                <CardHeader className="p-8 border-b border-slate-100">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <CalendarClock className="w-5 h-5 text-indigo-600" /> Upcoming Reservations
                    </h3>
                </CardHeader>
                <CardContent className="p-4 space-y-1">
                    {upcomingBookings.length === 0 ? (
                        <div className="py-10 text-center">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No pending sessions.</p>
                        </div>
                    ) : (
                        upcomingBookings.map(b => (
                            <div key={b.id} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl transition-colors border border-transparent hover:border-slate-100 group">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xs">
                                        <Clock className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{b.start_time}</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{format(parseISO(b.date), 'dd MMM')}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-600 uppercase">Confirmed</p>
                                    <p className="text-[8px] font-bold text-indigo-600 uppercase tracking-widest">Staff Assigned</p>
                                </div>
                            </div>
                        ))
                    )}
                    <button onClick={() => navigate('/bookings')} className="w-full mt-4 py-3 text-[9px] font-black text-indigo-600 uppercase tracking-widest border-t border-slate-100 hover:bg-indigo-50/50 rounded-b-2xl transition-colors">
                        View Service Grid
                    </button>
                </CardContent>
            </Card>
            
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-sm bg-white overflow-hidden group">
                <CardHeader className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-600"/> Expiring Members
                    </h3>
                </CardHeader>
                <CardContent className="p-2">
                    {monthlyExpiringMembers.length === 0 ? (
                        <div className="py-10 text-center">
                            <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-500">No upcoming expiries.</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {monthlyExpiringMembers.map(m => {
                                const daysLeft = differenceInCalendarDays(parseISO(m.current_end_date), new Date());
                                return (
                                <button 
                                    key={m.id} 
                                    onClick={() => navigate('/members', { state: { selectedMemberId: m.id } })}
                                    className="w-full text-left p-4 flex items-center justify-between hover:bg-indigo-50/70 transition-colors rounded-2xl"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-black text-xs">
                                            {m.guest_name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-700 text-xs">{m.guest_name}</h4>
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{m.membership_number}</p>
                                        </div>
                                    </div>
                                    <span className={`text-[9px] font-black px-2 py-1 rounded-md border whitespace-nowrap bg-amber-50 text-amber-600 border-amber-100`}>
                                        {`${daysLeft}d`}
                                    </span>
                                </button>
                                )}
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
