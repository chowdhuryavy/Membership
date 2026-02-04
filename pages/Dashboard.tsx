
import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, Button } from '../components/ui';
import { 
  Users, 
  CreditCard, 
  AlertCircle, 
  TrendingUp, 
  Clock, 
  Activity, 
  ShieldCheck, 
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  Sparkles,
  RefreshCcw,
  Zap
} from 'lucide-react';
import { db } from '../services/mockSupabase';
import { MemberStatus, Member } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { generateFinancialInsight } from '../services/geminiService';
import { format, endOfMonth, differenceInCalendarDays } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const parseISO = (dateString: string) => new Date(dateString);

const Dashboard = () => {
  const { user } = useAuth();
  const { currentOutlet, formatMoney, currency, settings } = useSettings();
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    frozenMembers: 0,
    revenueThisMonth: 0
  });
  const [expiringMembers, setExpiringMembers] = useState<Member[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if(currentOutlet) {
      loadStats();
      setAiInsight(''); // Reset insight on facility change
    }
  }, [currentOutlet]);

  const loadStats = async () => {
    if (!currentOutlet) return;
    
    const members = await db.getMembers(currentOutlet.id);
    const freezes = await db.getFreezes(); 
    
    const active = members.filter(m => m.status === MemberStatus.ACTIVE).length;
    const frozen = members.filter(m => m.status === MemberStatus.FROZEN).length;
    
    let monthlyRev = 0;
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    
    members.forEach(m => {
      const memberFreezes = freezes.filter(f => f.member_id === m.id);
      const earned = RevenueEngine.calculateRevenuePeriod(m, memberFreezes, start, end);
      monthlyRev += earned;
    });

    const expiring = members.filter(m => {
        if (m.status !== MemberStatus.ACTIVE) return false;
        const endDate = parseISO(m.current_end_date);
        const days = differenceInCalendarDays(endDate, now);
        return days >= 0 && days <= 30;
    }).sort((a, b) => a.current_end_date.localeCompare(b.current_end_date)).slice(0, 4);

    setStats({
      totalMembers: members.length,
      activeMembers: active,
      frozenMembers: frozen,
      revenueThisMonth: monthlyRev
    });
    setExpiringMembers(expiring);
  };

  const handleGenerateInsight = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    
    const dataContext = `
      Facility: ${currentOutlet?.name}
      Total Members: ${stats.totalMembers}
      Active: ${stats.activeMembers}
      Frozen: ${stats.frozenMembers}
      Revenue this month: ${formatMoney(stats.revenueThisMonth)}
      Expiring in 30 days: ${expiringMembers.length}
    `;

    const insight = await generateFinancialInsight(dataContext);
    setAiInsight(insight);
    setIsAnalyzing(false);
  };

  const displayName = useMemo(() => {
      if (!user?.name) return 'Admin';
      const rawName = user.name.trim();
      if (rawName.toLowerCase().includes('system administrator')) return 'Administrator';
      return rawName.split(/\s+/)[0];
  }, [user?.name]);

  const StatTile = ({ title, value, icon: Icon, color, trend }: any) => (
    <Card className="border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative cursor-default">
      <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-[0.03] group-hover:opacity-[0.1] group-hover:scale-125 transition-all duration-500 ${color}`}></div>
      <CardContent className="p-6 relative z-10">
        <div className="flex justify-between items-start mb-4">
          <div className={`p-2.5 rounded-xl ${color} bg-opacity-10 text-opacity-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-sm`}>
            <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
          </div>
          {trend && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full uppercase tracking-tighter shadow-sm group-hover:bg-emerald-100 transition-colors">
              <ArrowUpRight className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform duration-300" /> {trend}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] group-hover:text-indigo-600 transition-colors duration-300">{title}</p>
          <h4 className="text-2xl font-black text-slate-900 tracking-tight group-hover:tracking-normal transition-all duration-300">{value}</h4>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-8 rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all duration-500">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full -mr-32 -mt-32 blur-3xl group-hover:bg-indigo-100/50 transition-colors duration-700"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <span className="h-px w-6 bg-indigo-600 transition-all duration-300 group-hover:w-10"></span>
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">Operational Overview</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">{displayName}</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">
            Analyzing metrics for <span className="font-bold text-slate-700">{currentOutlet?.name || 'Authorized Facility'}</span>.
          </p>
        </div>
        <div className="flex flex-col items-end relative z-10">
          <div className="flex items-center gap-3 bg-slate-950 text-white px-5 py-3 rounded-2xl shadow-xl shadow-slate-200 group-hover:shadow-2xl group-hover:scale-105 transition-all duration-300">
             <Clock className="w-5 h-5 text-indigo-400" />
             <span className="text-xl font-black tracking-tighter tabular-nums">
               {format(currentTime, 'HH:mm:ss')}
             </span>
          </div>
          <span className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">
            {format(currentTime, 'EEEE, do MMMM yyyy')}
          </span>
        </div>
      </div>

      {/* AI Insights Bar */}
      <Card className="rounded-[2rem] border-indigo-200 bg-gradient-to-r from-indigo-50 to-white overflow-hidden relative shadow-lg shadow-indigo-50 group">
        <div className="absolute -left-12 -top-12 w-48 h-48 bg-indigo-100/50 rounded-full blur-3xl group-hover:bg-indigo-200/50 transition-colors duration-500"></div>
        <CardContent className="p-8 relative z-10">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200 animate-pulse-slow">
                <Sparkles className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">AI Operational Intelligence</h3>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Real-time Financial Reasoning Engine</p>
              </div>
            </div>
            <Button 
              onClick={handleGenerateInsight} 
              isLoading={isAnalyzing}
              className="h-12 px-8 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest shadow-xl transition-all transform active:scale-95"
            >
              <RefreshCcw className={`w-4 h-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
              {isAnalyzing ? 'Analyzing Portfolio...' : 'Generate Strategic Insight'}
            </Button>
          </div>
          
          {aiInsight ? (
            <div className="mt-8 p-6 bg-white border border-indigo-100 rounded-2xl shadow-inner animate-in fade-in slide-in-from-top-2 duration-500">
               <div className="flex items-start gap-4">
                  <div className="p-2 bg-indigo-50 rounded-lg shrink-0 mt-1">
                    <Zap className="w-4 h-4 text-indigo-600" />
                  </div>
                  <p className="text-slate-700 leading-relaxed font-medium text-sm italic">
                    {aiInsight}
                  </p>
               </div>
            </div>
          ) : !isAnalyzing && (
            <div className="mt-6 flex items-center gap-3 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
              <Info className="w-3 h-3" /> System ready for trend analysis.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatTile title="Total Portfolio" value={stats.totalMembers} icon={Users} color="bg-blue-600" trend="+12%" />
        <StatTile title="Active Capacity" value={stats.activeMembers} icon={TrendingUp} color="bg-emerald-600" trend="Healthy" />
        <StatTile title="Deferred/Frozen" value={stats.frozenMembers} icon={AlertCircle} color="bg-amber-600" />
        <StatTile title="Recognized Revenue" value={formatMoney(stats.revenueThisMonth)} icon={CreditCard} color="bg-indigo-600" trend="On Track" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-slate-200/60 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-500 rounded-[2rem] overflow-hidden group">
          <CardHeader className="bg-white border-b border-slate-100 p-8 flex flex-row justify-between items-center">
             <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                   Retention Focus
                   <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-black uppercase rounded tracking-widest flex items-center gap-1">
                      <AlertCircle className="w-3 h-3"/> Action Required
                   </span>
                </h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Memberships expiring within 30 days</p>
             </div>
             <div className="hidden sm:block">
                 <CalendarDays className="w-10 h-10 text-slate-100" />
             </div>
          </CardHeader>
          <CardContent className="p-0">
             {expiringMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                   <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                      <ShieldCheck className="w-8 h-8 text-emerald-500" />
                   </div>
                   <h4 className="text-lg font-bold text-slate-900">All Clear</h4>
                   <p className="text-sm text-slate-500 max-w-xs mt-1">No upcoming expirations detected.</p>
                </div>
             ) : (
                <div className="divide-y divide-slate-50">
                    {expiringMembers.map(m => {
                        const daysLeft = differenceInCalendarDays(parseISO(m.current_end_date), new Date());
                        return (
                           <div key={m.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group/item">
                               <div className="flex items-center gap-4">
                                   <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold group-hover/item:bg-indigo-100 group-hover/item:text-indigo-600 transition-colors shadow-sm">
                                       {m.guest_name.charAt(0)}
                                   </div>
                                   <div>
                                       <h4 className="font-bold text-slate-700 text-sm group-hover/item:text-indigo-700 transition-colors">{m.guest_name}</h4>
                                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.membership_number}</p>
                                   </div>
                               </div>
                               <div className="text-right">
                                   <div className="flex items-center justify-end gap-2 mb-1">
                                      <span className={`text-xs font-black px-2 py-0.5 rounded uppercase tracking-widest ${daysLeft <= 7 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}`}>
                                          {daysLeft} Days Left
                                      </span>
                                   </div>
                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Exp: {m.current_end_date}</p>
                               </div>
                           </div>
                        );
                    })}
                </div>
             )}
             <div className="bg-slate-50/80 p-4 border-t border-slate-100 text-center">
                <Link to="/members" className="inline-flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition-colors">
                    Manage All Memberships <ChevronRight className="w-3 h-3" />
                </Link>
             </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/60 rounded-[2rem] hover:shadow-lg transition-all duration-500 hover:border-indigo-100/50 group">
          <CardContent className="p-8">
            <h3 className="text-xl font-black text-slate-900 tracking-tight mb-8">System Telemetry</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between group/item hover:bg-slate-50 p-2 rounded-xl transition-colors -mx-2">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-emerald-100 rounded-lg group-hover/item:scale-110 transition-transform"><Activity className="w-4 h-4 text-emerald-600" /></div>
                   <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Engine Status</span>
                </div>
                <span className="text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 px-2 py-1 rounded shadow-sm">Optimal</span>
              </div>
              <div className="flex items-center justify-between group/item hover:bg-slate-50 p-2 rounded-xl transition-colors -mx-2">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-blue-100 rounded-lg group-hover/item:scale-110 transition-transform"><ShieldCheck className="w-4 h-4 text-blue-600" /></div>
                   <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Sync Integrity</span>
                </div>
                <span className="text-[10px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-1 rounded shadow-sm">100% Secure</span>
              </div>
              <div className="pt-6 border-t border-slate-100 mt-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 group-hover:text-indigo-500 transition-colors">Instance Details</p>
                  <div className="space-y-3">
                     <div className="flex justify-between text-[11px] font-bold"><span className="text-slate-500">Node Status</span><span className="text-slate-900">Active</span></div>
                     <div className="flex justify-between text-[11px] font-bold"><span className="text-slate-500">Last Sync</span><span className="text-slate-900">{format(new Date(), 'HH:mm')}</span></div>
                  </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const Info = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default Dashboard;
