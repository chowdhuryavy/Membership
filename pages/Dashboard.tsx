
import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '../components/ui';
import { 
  Users, 
  AlertCircle, 
  Clock, 
  Activity, 
  ShieldCheck, 
  BarChart4, 
  UserPlus, 
  Database, 
  Layers, 
  FileText, 
  History, 
  Info, 
  TrendingUp,
  Calendar,
  Snowflake,
  UserCheck,
  TrendingDown,
  AreaChart,
  FileEdit,
  Trash2
} from 'lucide-react';
import { db } from '../services/mockSupabase';
import { MemberStatus, Member } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, endOfMonth, differenceInCalendarDays, isSameMonth, startOfMonth, subMonths, formatDistanceToNow } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line } from 'recharts';

const parseISO = (dateString: string) => new Date(dateString);

interface PerformanceTrendData {
  month: string;
  revenue: number;
  intake: number;
}

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentOutlet, formatMoney, hasPermission } = useSettings();
  
  const [dashboardMonth, setDashboardMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [currentTime, setCurrentTime] = useState(new Date());
  const [auditPointDate, setAuditPointDate] = useState(new Date());

  const canViewFinances = user ? hasPermission(user.role_id, 'reports:view') : false;

  const [stats, setStats] = useState({
    activeMembers: 0,
    frozenMembers: 0,
    expiringSoon: 0,
    newMembersThisMonth: 0,
    dailyAccrual: 0,
    revenueThisMonth: 0,
    futureRevenue: 0,
    projectedEndMonth: 0,
  });
  
  const [expiringMembers, setExpiringMembers] = useState<Member[]>([]);
  const [monthlyExpiringMembers, setMonthlyExpiringMembers] = useState<Member[]>([]);
  const [performanceTrendData, setPerformanceTrendData] = useState<PerformanceTrendData[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if(currentOutlet) {
      loadStats();
    }
  }, [currentOutlet, dashboardMonth]);

  const loadStats = async () => {
    if (!currentOutlet) return;
    
    const [members, freezes] = await Promise.all([
      db.getMembers(currentOutlet.id),
      db.getFreezes(),
    ]);
    
    const now = new Date();
    const viewDate = parseISO(dashboardMonth + '-01');
    const isCurrentMonth = isSameMonth(viewDate, now);
    
    const contextStart = startOfMonth(viewDate);
    const auditPoint = isCurrentMonth ? now : endOfMonth(viewDate);
    setAuditPointDate(auditPoint);
    
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

    const expiring = members.filter(m => {
        const mEnd = parseISO(m.current_end_date);
        const mStart = parseISO(m.start_date);
        if (auditPoint < mStart || auditPoint > mEnd) return false;
        const memberFreezes = freezes.filter(f => f.member_id === m.id);
        const isFrozenAtPoint = memberFreezes.some(f => auditPoint >= parseISO(f.start_date) && auditPoint <= parseISO(f.end_date));
        if (isFrozenAtPoint) return false;
        const daysLeft = differenceInCalendarDays(mEnd, auditPoint);
        return daysLeft >= 0 && daysLeft <= 30;
    }).sort((a, b) => a.current_end_date.localeCompare(b.current_end_date)).slice(0, 5);
    
    const monthlyExpiring = members.filter(m => {
        const mEnd = parseISO(m.current_end_date);
        const mStart = parseISO(m.start_date);

        // The member must expire in the selected month.
        if (!isSameMonth(mEnd, viewDate)) {
            return false;
        }

        // The member's term must overlap with the month to be considered.
        const monthStart = startOfMonth(viewDate);
        const monthEnd = endOfMonth(viewDate);
        if (mStart > monthEnd || mEnd < monthStart) {
            return false;
        }
        
        return true;
    }).sort((a, b) => a.current_end_date.localeCompare(b.current_end_date)).slice(0, 5);

    const expiringSoonCount = members.filter(m => {
        const mEnd = parseISO(m.current_end_date);
        const mStart = parseISO(m.start_date);
        if (auditPoint < mStart || auditPoint > mEnd) return false;
        const memberFreezes = freezes.filter(f => f.member_id === m.id);
        const isFrozenAtPoint = memberFreezes.some(f => auditPoint >= parseISO(f.start_date) && auditPoint <= parseISO(f.end_date));
        if (isFrozenAtPoint) return false;
        const days = differenceInCalendarDays(mEnd, auditPoint);
        return days >= 0 && days <= 7;
    }).length;
    
    const endOfMonthDate = endOfMonth(viewDate);
    const daysRemaining = Math.max(0, differenceInCalendarDays(endOfMonthDate, auditPoint));
    const projectedMonthEnd = mtdRevenue + (totalDailyAccrual * daysRemaining);

    setStats({
      activeMembers: activeAtPointCount, frozenMembers: frozenAtPointCount, expiringSoon: expiringSoonCount,
      newMembersThisMonth: monthEnrollments, dailyAccrual: totalDailyAccrual, revenueThisMonth: mtdRevenue,
      futureRevenue: deferredRevenueAtPoint, projectedEndMonth: projectedMonthEnd
    });
    setExpiringMembers(expiring);
    setMonthlyExpiringMembers(monthlyExpiring);
  };

  const displayName = useMemo(() => {
      if (!user?.name) return 'Admin';
      return user.name.trim().split(/\s+/)[0];
  }, [user?.name]);
  
  const kpiData = [
    { title: "Active Members", value: stats.activeMembers, icon: Users, color: "text-emerald-600" },
    { title: "Frozen Members", value: stats.frozenMembers, icon: Snowflake, color: "text-indigo-600" },
    { title: "MTD Earned Rev.", value: formatMoney(stats.revenueThisMonth), icon: BarChart4, color: "text-blue-600" },
    { title: "Daily Accrual Rate", value: formatMoney(stats.dailyAccrual), icon: Activity, color: "text-amber-600" },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all duration-500">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-indigo-100/50 transition-colors duration-700"></div>
        <div className="relative z-10">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">{displayName}</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-2">
            Audit context for <span className="font-bold text-slate-700">{format(parseISO(dashboardMonth+'-01'), 'MMMM yyyy')}</span>.
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg h-full">
                <CardHeader className="p-8 border-b border-slate-100">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <TrendingUp className="w-5 h-5 text-indigo-600" /> 6-Month Performance Review
                    </h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Revenue Recognition vs. New Member Intake</p>
                </CardHeader>
                <CardContent className="p-8 h-[400px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={performanceTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                            <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="left" tickFormatter={(val) => formatMoney(val).split(' ')[1]} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '1rem', color: 'white', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                labelStyle={{ fontWeight: 'bold', textTransform: 'uppercase' }}
                                itemStyle={{ fontWeight: 'bold' }}
                                cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }}
                            />
                            <Legend wrapperStyle={{fontSize: "10px", fontWeight: "bold", textTransform: "uppercase", paddingTop: "20px"}} iconType="circle" />
                            <Bar yAxisId="right" dataKey="intake" name="New Members" fill="#a5b4fc" radius={[6, 6, 0, 0]} barSize={20} />
                            <Bar yAxisId="left" type="monotone" dataKey="revenue" name="Revenue" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
        
        <div className="space-y-8">
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg">
                <CardHeader className="p-8 border-b border-slate-100">
                    <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Database className="w-5 h-5 text-indigo-600" /> Financial Snapshot
                    </h3>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div>
                        <div className="flex justify-between items-baseline mb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MTD Earned</span>
                            <span className="text-base font-black text-indigo-600">{formatMoney(stats.revenueThisMonth)}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5">
                            <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: `${stats.projectedEndMonth > 0 ? (stats.revenueThisMonth / stats.projectedEndMonth) * 100 : 0}%` }}></div>
                        </div>
                    </div>
                     <div>
                        <div className="flex justify-between items-baseline">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Projected Month-End</span>
                            <span className="text-base font-black text-emerald-600">{formatMoney(stats.projectedEndMonth)}</span>
                        </div>
                    </div>
                     <div className="pt-4 border-t border-slate-100">
                        <div className="flex justify-between items-baseline">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deferred Value</span>
                            <span className="text-base font-black text-amber-600">{formatMoney(stats.futureRevenue)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-sm bg-white overflow-hidden group">
                <CardHeader className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600"/> Immediate Retention Targets
                    </h3>
                </CardHeader>
                <CardContent className="p-2">
                    {expiringMembers.length === 0 ? (
                        <div className="py-10 text-center">
                            <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-500">Portfolio Stable</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {expiringMembers.map(m => {
                                const daysLeft = differenceInCalendarDays(parseISO(m.current_end_date), auditPointDate);
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
                                    <span className={`text-[9px] font-black px-2 py-1 rounded-md border whitespace-nowrap ${daysLeft < 0 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                                        {daysLeft < 0 ? 'EXPIRED' : `${daysLeft} Days Left`}
                                    </span>
                                </button>
                                )}
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-sm bg-white overflow-hidden group">
                <CardHeader className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-600"/> Current Month Expiries
                    </h3>
                </CardHeader>
                <CardContent className="p-2">
                    {monthlyExpiringMembers.length === 0 ? (
                        <div className="py-10 text-center">
                            <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-500">No expiries this month.</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {monthlyExpiringMembers.map(m => {
                                const daysLeft = differenceInCalendarDays(parseISO(m.current_end_date), auditPointDate);
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
                                        {daysLeft >= 0 ? `${daysLeft} Days Left` : 'Expired'}
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
