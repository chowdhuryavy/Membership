
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui';
import { Users, CreditCard, AlertCircle, TrendingUp } from 'lucide-react';
import { db } from '../services/mockSupabase';
import { Member, MemberStatus } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';

const Dashboard = () => {
  const { currentOutlet, formatMoney } = useSettings();
  const [stats, setStats] = useState({
    totalMembers: 0,
    activeMembers: 0,
    frozenMembers: 0,
    revenueThisMonth: 0
  });

  useEffect(() => {
    if(currentOutlet) loadStats();
  }, [currentOutlet]);

  const loadStats = async () => {
    if (!currentOutlet) return;
    
    const members = await db.getMembers(currentOutlet.id);
    const freezes = await db.getFreezes(); // get all freezes
    
    const active = members.filter(m => m.status === MemberStatus.ACTIVE).length;
    const frozen = members.filter(m => m.status === MemberStatus.FROZEN).length;
    
    // Calculate revenue for current month
    let monthlyRev = 0;
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    
    members.forEach(m => {
      const memberFreezes = freezes.filter(f => f.member_id === m.id);
      const earned = RevenueEngine.calculateRevenuePeriod(m, memberFreezes, start, end);
      monthlyRev += earned;
    });

    setStats({
      totalMembers: members.length,
      activeMembers: active,
      frozenMembers: frozen,
      revenueThisMonth: monthlyRev
    });
  };

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <Card>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h4 className="text-2xl font-bold text-slate-900 mt-2">{value}</h4>
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Overview for <span className="font-semibold text-slate-700">{currentOutlet?.name}</span></p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Members" 
          value={stats.totalMembers} 
          icon={Users} 
          color="bg-blue-500" 
        />
        <StatCard 
          title="Active Members" 
          value={stats.activeMembers} 
          icon={TrendingUp} 
          color="bg-green-500" 
        />
        <StatCard 
          title="Frozen Members" 
          value={stats.frozenMembers} 
          icon={AlertCircle} 
          color="bg-amber-500" 
        />
        <StatCard 
          title="Est. Revenue (MTD)" 
          value={formatMoney(stats.revenueThisMonth)} 
          icon={CreditCard} 
          color="bg-indigo-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="h-64">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex flex-col gap-4">
               <p className="text-slate-600">Navigate to the Members tab to manage subscriptions or the Reports tab to view detailed revenue breakdowns for <b>{currentOutlet?.name}</b>.</p>
             </div>
          </CardContent>
        </Card>
        
        <Card className="h-64">
           <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                 <span className="text-slate-600">Database Connection</span>
                 <span className="text-green-600 font-medium">Healthy</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                 <span className="text-slate-600">Last Sync</span>
                 <span className="text-slate-900">{format(new Date(), 'PP p')}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                 <span className="text-slate-600">Revenue Engine</span>
                 <span className="text-green-600 font-medium">Online</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
