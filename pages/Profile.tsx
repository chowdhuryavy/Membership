
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, Button, Input } from '../components/ui';
import { db } from '../services/mockSupabase';
import { supabase } from '../services/supabase';
import { getReportData } from '../src/shared/reportLogic';
import { useSettings } from '../contexts/SettingsContext';
import { Lock, User, CheckCircle, AlertCircle, Mail, UserCircle2, Award, TrendingUp, Sparkles, Calendar, RefreshCcw } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Staff } from '../types';

const Profile = () => {
    const { user, changePassword, updateProfile } = useAuth();
    const { settings, formatMoney } = useSettings();
    const [profileData, setProfileData] = useState({ name: '', email: '' });
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
    const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null);
    const [loading, setLoading] = useState(false);

    const [linkedStaff, setLinkedStaff] = useState<Staff | null>(null);
    const [incentiveData, setIncentiveData] = useState<any[]>([]);
    const [incentiveSummary, setIncentiveSummary] = useState<any>({});
    const [incentiveLoading, setIncentiveLoading] = useState(false);
    const [incentiveDate, setIncentiveDate] = useState(new Date());

    useEffect(() => {
        if (user) {
            setProfileData({ name: user.name, email: user.email });
            findLinkedStaff();
        }
    }, [user]);

    useEffect(() => {
      if (linkedStaff) {
        loadIncentives();
      }
    }, [linkedStaff, incentiveDate]);

    const findLinkedStaff = async () => {
      if (!user) return;
      try {
        // Use user's first allowed outlet to find property_id
        const propId = user.allowed_outlets?.[0] ? (await db.getOutlets()).find(o => o.id === user.allowed_outlets[0])?.property_id : '';
        const staffList = await db.getStaff(propId || '', !propId);
        const match = staffList.find(s => s.email?.toLowerCase() === user.email.toLowerCase());
        setLinkedStaff(match || null);
      } catch (error) {
        console.error("Error finding linked staff:", error);
      }
    };

    const loadIncentives = async () => {
      if (!linkedStaff) return;
      setIncentiveLoading(true);
      try {
        const propertyId = linkedStaff.property_id;
        const depts: ('Massage' | 'Membership' | 'Personal Training')[] = ['Massage', 'Membership', 'Personal Training'];
        let allRows: any[] = [];
        let totalInc = 0;

        for (const dept of depts) {
          const result = await getReportData({
            supabase,
            propertyId,
            outletId: 'all',
            reportType: 'incentives',
            date: incentiveDate,
            incentiveDept: dept
          });

          const staffRows = result.rows.filter(r => r.staff_splits && r.staff_splits[linkedStaff.id]);
          const rowsWithDept = staffRows.map(r => ({
            ...r,
            department: dept,
            my_incentive: r.staff_splits[linkedStaff.id]
          }));

          allRows = [...allRows, ...rowsWithDept];
          totalInc += rowsWithDept.reduce((sum, r) => sum + r.my_incentive, 0);
        }

        allRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setIncentiveData(allRows);
        setIncentiveSummary({ total: totalInc, count: allRows.length });
      } catch (error) {
        console.error("Failed to load incentives:", error);
      } finally {
        setIncentiveLoading(false);
      }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setLoading(true);
        try {
            await updateProfile({ name: profileData.name });
            setMessage({ type: 'success', text: "Profile identity synchronized successfully." });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || "Failed to sync profile." });
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        if (passwords.new !== passwords.confirm) {
            setMessage({ type: 'error', text: "New passwords do not match." });
            return;
        }
        if (passwords.new.length < 6) {
             setMessage({ type: 'error', text: "Security key must be at least 6 characters." });
             return;
        }
        
        setLoading(true);
        try {
            await changePassword(passwords.current, passwords.new);
            setMessage({ type: 'success', text: "Security key updated successfully." });
            setPasswords({ current: '', new: '', confirm: '' });
        } catch (err: any) {
             setMessage({ type: 'error', text: err.message || "Credential update failed." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-4">
                <UserCircle2 className="w-10 h-10 text-indigo-600" />
                <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Profile Management</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                        <div className="h-24 bg-indigo-600 w-full"></div>
                        <CardContent className="px-8 pb-8 -mt-12 text-center">
                            <div className="inline-flex p-1.5 bg-white rounded-3xl shadow-xl mb-4">
                                <div className="w-24 h-24 bg-slate-900 rounded-[1.8rem] flex items-center justify-center text-white text-4xl font-black">
                                    {user?.name.charAt(0)}
                                </div>
                            </div>
                            <h3 className="text-xl font-black text-slate-900 tracking-tight">{user?.name}</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{user?.email}</p>
                            <div className="mt-6 inline-block px-4 py-1.5 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest rounded-full border border-indigo-100">
                                {user?.role_id} Clearance
                            </div>
                        </CardContent>
                    </Card>

                    {message && (
                        <div className={`p-5 rounded-3xl text-xs font-black uppercase tracking-widest flex items-center gap-3 border animate-in zoom-in-95 duration-300 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                            {message.type === 'success' ? <CheckCircle className="w-5 h-5"/> : <AlertCircle className="w-5 h-5"/>}
                            {message.text}
                        </div>
                    )}
                </div>

                <div className="lg:col-span-3 space-y-8">
                    <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden">
                        <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
                            <CardTitle className="text-lg font-black tracking-tight flex items-center gap-3">
                                <User className="w-5 h-5 text-indigo-600" /> Identity Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8">
                            <form onSubmit={handleUpdateProfile} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preferred Name</label>
                                    <Input 
                                        value={profileData.name} 
                                        onChange={e => setProfileData({...profileData, name: e.target.value})}
                                        className="h-12 rounded-xl"
                                        placeholder="Display Name"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Work Email</label>
                                    <Input 
                                        type="email"
                                        value={profileData.email} 
                                        disabled
                                        readOnly
                                        className="h-12 rounded-xl bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed"
                                        placeholder="Email Address"
                                    />
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider ml-1">Contact system administrator to update email.</p>
                                </div>
                                <Button type="submit" disabled={loading} className="h-14 px-10 rounded-2xl font-black shadow-xl shadow-indigo-100 mt-2">
                                    Save Profile Changes
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden">
                        <CardHeader className="bg-slate-50 p-8 border-b border-slate-100">
                            <CardTitle className="text-lg font-black tracking-tight flex items-center gap-3">
                                <Lock className="w-5 h-5 text-indigo-600" /> Security Protocol
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8">
                            <form onSubmit={handlePasswordSubmit} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Security Key</label>
                                    <Input 
                                        type="password" 
                                        value={passwords.current} 
                                        onChange={e => setPasswords({...passwords, current: e.target.value})}
                                        className="h-12 rounded-xl"
                                        placeholder="••••••••"
                                    />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Security Key</label>
                                        <Input 
                                            type="password" 
                                            value={passwords.new} 
                                            onChange={e => setPasswords({...passwords, new: e.target.value})}
                                            className="h-12 rounded-xl"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm New Key</label>
                                        <Input 
                                            type="password" 
                                            value={passwords.confirm} 
                                            onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                                            className="h-12 rounded-xl"
                                            placeholder="••••••••"
                                        />
                                    </div>
                                </div>
                                <Button type="submit" variant="secondary" disabled={loading} className="h-14 px-10 rounded-2xl font-black bg-slate-100 hover:bg-slate-200 mt-2">
                                    Deploy New Security Key
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    {linkedStaff && (
                      <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
                        <CardHeader className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100 shadow-sm"><Award className="w-5 h-5 text-indigo-600" /></div>
                            <div>
                                <CardTitle className="text-lg font-black tracking-tight">My Incentive Earnings</CardTitle>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Performance Based Payouts</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setIncentiveDate(new Date(incentiveDate.getFullYear(), incentiveDate.getMonth() - 1, 1))}
                              className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400"
                            >
                              <RefreshCcw className="w-3.5 h-3.5 rotate-[-90deg]" />
                            </button>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 min-w-[80px] text-center">
                              {format(incentiveDate, 'MMM yyyy')}
                            </span>
                            <button 
                              onClick={() => setIncentiveDate(new Date(incentiveDate.getFullYear(), incentiveDate.getMonth() + 1, 1))}
                              className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400"
                            >
                              <RefreshCcw className="w-3.5 h-3.5 rotate-[90deg]" />
                            </button>
                          </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Earnings</div>
                              <div className="text-2xl font-black text-white">{formatMoney(incentiveSummary.total)}</div>
                            </div>
                            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Services</div>
                              <div className="text-2xl font-black text-slate-900">{incentiveSummary.count || 0}</div>
                            </div>
                          </div>

                          {incentiveLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 space-y-4">
                              <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Calculating...</p>
                            </div>
                          ) : incentiveData.length === 0 ? (
                            <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200/60 text-center">
                              <Award className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No incentives for this period</p>
                            </div>
                          ) : (
                            <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                              <AnimatePresence mode="popLayout">
                                {incentiveData.map((item, index) => (
                                  <motion.div 
                                    key={item.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.02 }}
                                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center group hover:border-indigo-200 transition-all"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className={`p-2 rounded-lg ${
                                        item.department === 'Massage' ? 'bg-indigo-50 text-indigo-600' :
                                        item.department === 'Membership' ? 'bg-emerald-50 text-emerald-600' :
                                        'bg-amber-50 text-amber-600'
                                      }`}>
                                        {item.department === 'Massage' ? <Sparkles className="w-4 h-4" /> :
                                         item.department === 'Membership' ? <TrendingUp className="w-4 h-4" /> :
                                         <Award className="w-4 h-4" />}
                                      </div>
                                      <div>
                                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{item.item_name}</h4>
                                        <div className="flex items-center gap-2 mt-0.5">
                                          <Calendar className="w-2.5 h-2.5 text-slate-300" />
                                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{item.date}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                      <p className="text-sm font-black text-indigo-600">{formatMoney(item.my_incentive)}</p>
                                      <div className="flex items-center gap-2 mt-1 opacity-60">
                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Price: {formatMoney(item.actual_price)}</span>
                                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Net: {formatMoney(item.net_revenue)}</span>
                                      </div>
                                    </div>
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Profile;
