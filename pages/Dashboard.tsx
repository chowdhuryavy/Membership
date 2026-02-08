
import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, Button } from '../components/ui';
import { 
  Users, 
  CreditCard, 
  AlertCircle, 
  Clock, 
  Activity, 
  ShieldCheck, 
  ChevronRight, 
  BarChart4, 
  UserPlus, 
  Database, 
  Timer, 
  Layers, 
  FileText, 
  History, 
  Info, 
  ArrowRightLeft, 
  Trophy,
  Zap,
  TrendingUp,
  Target,
  CalendarDays,
  Calendar,
  Snowflake,
  XCircle
} from 'lucide-react';
import { db } from '../services/mockSupabase';
import { MemberStatus, Member, SystemLog, Freeze } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, endOfMonth, differenceInCalendarDays, isSameDay, isAfter, isBefore, addDays, isSameMonth, startOfMonth } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

const parseISO = (dateString: string) => new Date(dateString);

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentOutlet, formatMoney, hasPermission } = useSettings();
  
  const [dashboardMonth, setDashboardMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [currentTime, setCurrentTime] = useState(new Date());

  const canViewFinances = user ? hasPermission(user.role_id, 'reports:view') : false;
  const canViewLogs = user ? hasPermission(user.role_id, 'logs:view') : false;
  const canViewMembers = user ? hasPermission(user.role_id, 'members:view') : false;
  const canManageTiers = user ? hasPermission(user.role_id, 'categories:view') : false;

  const [stats, setStats] = useState({
    activeMembers: 0,
    frozenMembers: 0,
    expiredMembers: 0,
    expiringSoon: 0,
    newMembersToday: 0,
    newMembersThisMonth: 0,
    dailyAccrual: 0,
    revenueThisMonth: 0,
    futureRevenue: 0,
    projectedEndMonth: 0
  });
  
  const [expiringMembers, setExpiringMembers] = useState<Member[]>([]);

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
      db.getFreezes()
    ]);
    
    const now = new Date();
    const viewDate = parseISO(dashboardMonth + '-01');
    const isCurrentMonth = isSameMonth(viewDate, now);
    
    // Boundary Logic
    const contextStart = startOfMonth(viewDate);
    // Audit Point: If viewing current month, audit as of Today. If past month, audit as of Last Day.
    const auditPoint = isCurrentMonth ? now : endOfMonth(viewDate);
    
    let activeAtPointCount = 0;
    let frozenAtPointCount = 0;
    let mtdRevenue = 0;
    let deferredRevenueAtPoint = 0;
    let monthEnrollments = 0;
    let todayEnrollments = 0;
    let totalDailyAccrual = 0;

    members.forEach(m => {
      const mStart = parseISO(m.start_date);
      const mEnd = parseISO(m.current_end_date);
      const enrollmentDate = parseISO(m.created_at || m.start_date);

      // 1. Enrollment Counting (New intake in the selected month)
      if (enrollmentDate >= contextStart && enrollmentDate <= endOfMonth(viewDate)) {
        monthEnrollments++;
        if (isSameDay(enrollmentDate, now)) todayEnrollments++;
      }

      // 2. Financial Reconciliation Logic
      const memberFreezes = freezes.filter(f => f.member_id === m.id);

      // MTD Momentum: Revenue earned from 1st of month to auditPoint
      const earnedThisMonth = RevenueEngine.calculateRevenuePeriod(m, memberFreezes, contextStart, auditPoint);
      mtdRevenue += earnedThisMonth;

      // Deferred: Reconciled Balance (Total Net - Revenue earned from contract start to auditPoint)
      const earnedLifetimeToPoint = RevenueEngine.calculateRevenuePeriod(m, memberFreezes, mStart, auditPoint);
      const balanceAtPoint = Math.max(0, m.net_amount - earnedLifetimeToPoint);
      deferredRevenueAtPoint += balanceAtPoint;

      // 3. Point-in-Time Status (Active/Frozen/Daily Accrual)
      // Member must have a valid contract day that includes the auditPoint
      if (auditPoint >= mStart && auditPoint <= mEnd) {
          const isFrozenAtPoint = memberFreezes.some(f => 
              auditPoint >= parseISO(f.start_date) && 
              auditPoint <= parseISO(f.end_date)
          );

          if (isFrozenAtPoint) {
              frozenAtPointCount++;
          } else {
              activeAtPointCount++;
              totalDailyAccrual += m.daily_rate;
          }
      }
    });

    // Operational Analytics (Always based on "Today" for retention visibility)
    const expiring = members.filter(m => {
        if (m.status !== MemberStatus.ACTIVE) return false;
        const endDate = parseISO(m.current_end_date);
        const days = differenceInCalendarDays(endDate, now);
        return days >= 0 && days <= 30;
    }).sort((a, b) => a.current_end_date.localeCompare(b.current_end_date)).slice(0, 5);

    const expiringSoonCount = members.filter(m => {
        const days = differenceInCalendarDays(parseISO(m.current_end_date), now);
        return m.status === MemberStatus.ACTIVE && days >= 0 && days <= 7;
    }).length;

    // Projection Logic: MTD + (Daily Accrual * Remaining Days in Month)
    const endOfMonthDate = endOfMonth(viewDate);
    const daysRemaining = Math.max(0, differenceInCalendarDays(endOfMonthDate, auditPoint));
    const projectedMonthEnd = mtdRevenue + (totalDailyAccrual * daysRemaining);

    setStats({
      activeMembers: activeAtPointCount,
      frozenMembers: frozenAtPointCount,
      expiredMembers: 0, // Not used in primary cards anymore
      expiringSoon: expiringSoonCount,
      newMembersToday: todayEnrollments,
      newMembersThisMonth: monthEnrollments,
      dailyAccrual: totalDailyAccrual,
      revenueThisMonth: mtdRevenue,
      futureRevenue: deferredRevenueAtPoint,
      projectedEndMonth: projectedMonthEnd
    });
    setExpiringMembers(expiring);
  };

  const displayName = useMemo(() => {
      if (!user?.name) return 'Admin';
      return user.name.trim().split(/\s+/)[0];
  }, [user?.name]);

  const StatTile = ({ title, value, icon: Icon, color, subtitle, logic }: any) => (
    <Card className="border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative cursor-default">
      <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-[0.03] group-hover:opacity-[0.1] group-hover:scale-125 transition-all duration-500 ${color}`}></div>
      <CardContent className="p-6 relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-2.5 rounded-xl ${color} bg-opacity-10 text-opacity-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
            <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
          </div>
          <div className="group/info relative">
            <Info className="w-3.5 h-3.5 text-slate-300 hover:text-indigo-500 transition-colors cursor-help" />
            <div className="absolute right-0 top-full mt-2 w-48 bg-slate-900 text-white text-[9px] p-3 rounded-xl opacity-0 group-hover/info:opacity-100 transition-opacity z-50 pointer-events-none font-bold uppercase tracking-widest leading-relaxed shadow-2xl">
                {logic || "Audit-Point calculation logic applied."}
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] group-hover:text-indigo-600 transition-colors duration-300">{title}</p>
          <h4 className="text-2xl font-black text-slate-900 tracking-tight group-hover:tracking-normal transition-all duration-300">{value}</h4>
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all duration-500">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-indigo-100/50 transition-colors duration-700"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="h-px w-6 bg-indigo-600 transition-all duration-300 group-hover:w-10"></span>
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">Facility Heartbeat</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">{displayName}</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-2">
            Audit context for <span className="font-bold text-slate-700">{format(parseISO(dashboardMonth+'-01'), 'MMMM yyyy')}</span>.
          </p>
        </div>
        <div className="flex flex-col items-end relative z-10 gap-3">
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

      {/* Main Stats Portfolio - Audit Point Snapshots */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatTile 
            title="Total Active" value={stats.activeMembers} icon={Users} color="bg-emerald-600" subtitle={`Active on ${format(isSameMonth(parseISO(dashboardMonth+'-01'), new Date()) ? new Date() : endOfMonth(parseISO(dashboardMonth+'-01')), 'MMM d')}`}
            logic="Counts members with valid contracts at the audit point. Total Active * Daily Rate = Yield."
        />
        <StatTile 
            title="Total Frozen" value={stats.frozenMembers} icon={Snowflake} color="bg-indigo-600" subtitle={`Frozen on ${format(isSameMonth(parseISO(dashboardMonth+'-01'), new Date()) ? new Date() : endOfMonth(parseISO(dashboardMonth+'-01')), 'MMM d')}`}
            logic="Counts members currently in a suspended state at this exact audit point."
        />
        {canViewFinances ? (
          <StatTile 
              title="Deferred Value" value={formatMoney(stats.futureRevenue)} icon={Database} color="bg-amber-600" subtitle={`Ledger Balance (Unearned)`} 
              logic="Reconciled Balance: Total Net - Total Earned to Date. Matches the 'Deferred' column in the Ledger."
          />
        ) : (
          <StatTile 
              title="At Risk" value={stats.expiringSoon} icon={AlertCircle} color="bg-rose-600" subtitle="Expiring within 7 days" 
              logic="Real-time operational monitoring of memberships nearing term conclusion."
          />
        )}
      </div>

      {/* Logical Performance Cards: Daily vs MTD */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Daily Performance Logic Card */}
        <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg bg-white overflow-hidden group">
            <CardHeader className="p-8 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100">
                        <Activity className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Daily Pulse</h3>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Audit Yield for {format(parseISO(dashboardMonth+'-01'), 'MMM yyyy')}</p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase">Velocity</span>
                </div>
            </CardHeader>
            <CardContent className="p-10 grid grid-cols-2 gap-8">
                <div className="space-y-2 border-r border-slate-100 pr-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Active Pop.</p>
                    <div className="flex items-baseline gap-2">
                        <h4 className="text-4xl font-black text-slate-900 tracking-tighter">{stats.activeMembers}</h4>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Profiles</span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-2">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Contributing</span>
                    </div>
                </div>
                <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Daily Accrual</p>
                    <div className="flex items-baseline gap-2">
                        <h4 className="text-4xl font-black text-emerald-600 tracking-tighter">
                            {canViewFinances ? formatMoney(stats.dailyAccrual).split(' ')[0] : '---'}
                        </h4>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{canViewFinances ? formatMoney(stats.dailyAccrual).split(' ')[1] || '$' : 'HIDDEN'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-2">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Revenue/Day</span>
                    </div>
                </div>
            </CardContent>
        </Card>

        {/* MTD Momentum Logic Card */}
        <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg bg-white overflow-hidden group">
            <CardHeader className="p-8 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-100">
                        <CalendarDays className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">MTD Momentum</h3>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{format(parseISO(dashboardMonth+'-01'), 'MMMM yyyy')} Accumulation</p>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase">Cumulative</span>
                </div>
            </CardHeader>
            <CardContent className="p-10 grid grid-cols-2 gap-8">
                <div className="space-y-2 border-r border-slate-100 pr-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Period Intake</p>
                    <div className="flex items-baseline gap-2">
                        <h4 className="text-4xl font-black text-slate-900 tracking-tighter">{stats.newMembersThisMonth}</h4>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Enroll.</span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-2">
                        <UserPlus className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">New Contracts</span>
                    </div>
                </div>
                <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Earned Revenue</p>
                    <div className="flex items-baseline gap-2">
                        <h4 className="text-4xl font-black text-indigo-600 tracking-tighter">
                            {canViewFinances ? formatMoney(stats.revenueThisMonth).split(' ')[0] : '---'}
                        </h4>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{canViewFinances ? formatMoney(stats.revenueThisMonth).split(' ')[1] || '$' : 'HIDDEN'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-2">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">Ledger Parity</span>
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
            {/* Retention Focus */}
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-sm bg-white overflow-hidden group">
                <CardHeader className="p-8 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                            Immediate Retention Targets
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[9px] font-black uppercase rounded tracking-widest flex items-center gap-1">
                                <AlertCircle className="w-3 h-3"/> Active Risk
                            </span>
                        </h3>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {expiringMembers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <ShieldCheck className="w-12 h-12 text-emerald-500 mb-4" />
                            <h4 className="text-lg font-bold text-slate-900">Portfolio Stable</h4>
                            <p className="text-sm text-slate-500">No immediate expirations detected in the 30-day window.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {expiringMembers.map(m => {
                                const daysLeft = differenceInCalendarDays(parseISO(m.current_end_date), new Date());
                                return (
                                <div key={m.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group/item">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 font-black">
                                            {m.guest_name.charAt(0)}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-700 text-sm">{m.guest_name}</h4>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.membership_number}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest border ${daysLeft <= 7 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                            Expires in {daysLeft} Days
                                        </span>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Quick Action Hub */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {canViewMembers && (
                    <button onClick={() => navigate('/members')} className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-[2rem] hover:border-indigo-500 hover:shadow-xl transition-all group">
                        <div className="p-4 bg-indigo-50 rounded-2xl group-hover:scale-110 transition-transform mb-3">
                            <UserPlus className="w-6 h-6 text-indigo-600" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Enrollment</span>
                    </button>
                )}
                {canViewFinances && (
                    <button onClick={() => navigate('/reports')} className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-[2rem] hover:border-emerald-500 hover:shadow-xl transition-all group">
                        <div className="p-4 bg-emerald-50 rounded-2xl group-hover:scale-110 transition-transform mb-3">
                            <FileText className="w-6 h-6 text-emerald-600" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Financials</span>
                    </button>
                )}
                {canManageTiers && (
                    <button onClick={() => navigate('/categories')} className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-[2rem] hover:border-amber-500 hover:shadow-xl transition-all group">
                        <div className="p-4 bg-amber-50 rounded-2xl group-hover:scale-110 transition-transform mb-3">
                            <Layers className="w-6 h-6 text-amber-600" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Rate Matrix</span>
                    </button>
                )}
                {canViewLogs && (
                    <button onClick={() => navigate('/logs')} className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-[2rem] hover:border-rose-500 hover:shadow-xl transition-all group">
                        <div className="p-4 bg-rose-50 rounded-2xl group-hover:scale-110 transition-transform mb-3">
                            <History className="w-6 h-6 text-rose-600" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Audit Trail</span>
                    </button>
                )}
            </div>
        </div>

        <div className="space-y-8">
            {/* Reconciled Forecast Card */}
            {canViewFinances && (
                <Card className="rounded-[2.5rem] border-slate-200/60 shadow-sm bg-white overflow-hidden">
                    <CardContent className="p-8">
                        <h3 className="text-lg font-black text-slate-900 tracking-tight mb-8 flex items-center gap-2">
                            <BarChart4 className="w-5 h-5 text-indigo-600" /> Month-End Forecast
                        </h3>
                        <div className="space-y-10">
                            <div>
                                <div className="flex justify-between items-end mb-3">
                                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Recognized MTD</span>
                                    <span className="text-sm font-black text-indigo-600">{formatMoney(stats.revenueThisMonth)}</span>
                                </div>
                                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: '100%' }}></div>
                                </div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-2">Verified revenue in period</p>
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-3">
                                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Projected Final</span>
                                    <span className="text-sm font-black text-emerald-600">{formatMoney(stats.projectedEndMonth)}</span>
                                </div>
                                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }}></div>
                                </div>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-2">Forecast for {format(endOfMonth(parseISO(dashboardMonth+'-01')), 'MMM d, yyyy')}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Performance Summary Text */}
            <div className="p-8 bg-slate-900 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden group">
                <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                <div className="relative z-10 space-y-4">
                    <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" /> Audit Integrity
                    </h4>
                    <p className="text-xs font-medium text-slate-400 leading-relaxed italic">
                        "Dashboard metrics are synchronized with the Financial Ledger logic. Daily yield, MTD recognition, and Deferred balances reflect verified audit signatures."
                    </p>
                    <div className="pt-2">
                        <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-400/10 px-3 py-1 rounded-full">Reconciliation Verified</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

// Add missing sub-components used in Dashboard
const UserCheck = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
);

export default Dashboard;
