import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, ConfirmationModal } from '../components/ui';
import { Staff, StaffLeave } from '../types';
import { db } from '../services/mockSupabase';
import { supabase } from '../services/supabase';
import { getReportData } from '../src/shared/reportLogic';
import { ArrowLeft, Calendar, Plus, Trash2, Edit2, ShieldCheck, Mail, Phone, CalendarX, X, Database, RefreshCcw, ShieldAlert, Award, TrendingUp, Sparkles, User, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '../contexts/SettingsContext';

interface StaffProfileViewProps {
  staff: Staff;
  onBack: () => void;
  canManage: boolean;
  canManageLeaves: boolean;
  onEdit: (s: Staff) => void;
  loadStaff: () => void;
}

const StaffProfileView: React.FC<StaffProfileViewProps> = ({ staff, onBack, canManage, canManageLeaves, onEdit, loadStaff }) => {
  const { settings, formatMoney } = useSettings();
  const [leaves, setLeaves] = useState<StaffLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null);
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '' });
  const [displayDates, setDisplayDates] = useState({ start: '', end: '' });
  
  const [activeTab, setActiveTab] = useState<'leaves' | 'incentives'>('leaves');
  const [incentiveData, setIncentiveData] = useState<any[]>([]);
  const [incentiveSummary, setIncentiveSummary] = useState<any>({});
  const [incentiveLoading, setIncentiveLoading] = useState(false);
  const [incentiveDate, setIncentiveDate] = useState(new Date());

  const toISODate = (displayDate: string) => {
    const parts = displayDate.split('/');
    if (parts.length !== 3) return '';
    let [d, m, y] = parts;
    if (!d || !m || !y) return '';
    if (y.length === 2) y = '20' + y;
    if (y.length !== 4) return '';
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  };

  const fromISODate = (isoDate: string) => {
    if (!isoDate) return '';
    const parts = isoDate.split('-');
    if (parts.length !== 3) return '';
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
  };

  const handleBlur = (field: 'start' | 'end') => {
    const val = displayDates[field];
    const parts = val.split('/');
    if (parts.length === 3) {
      let [d, m, y] = parts;
      if (y.length === 2) {
        const expandedYear = '20' + y;
        const newVal = `${d}/${m}/${expandedYear}`;
        setDisplayDates(prev => ({ ...prev, [field]: newVal }));
        const iso = toISODate(newVal);
        if (iso) {
          setLeaveForm(prev => ({ ...prev, [field === 'start' ? 'start_date' : 'end_date']: iso }));
        }
      }
    }
  };

  useEffect(() => {
    if (showLeaveForm) {
      setDisplayDates({
        start: fromISODate(leaveForm.start_date),
        end: fromISODate(leaveForm.end_date)
      });
    }
  }, [showLeaveForm]);

  const handleDisplayDateChange = (field: 'start' | 'end', value: string) => {
    // Simple mask: DD/MM/YYYY
    let cleaned = value.replace(/\D/g, '');
    if (cleaned.length > 8) cleaned = cleaned.slice(0, 8);
    
    let formatted = cleaned;
    if (cleaned.length > 2) formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
    if (cleaned.length > 4) formatted = formatted.slice(0, 5) + '/' + formatted.slice(5);
    
    setDisplayDates(prev => ({ ...prev, [field]: formatted }));
    
    if (cleaned.length === 8 || cleaned.length === 6) {
      const iso = toISODate(formatted);
      if (iso) {
        setLeaveForm(prev => ({ ...prev, [field === 'start' ? 'start_date' : 'end_date']: iso }));
      } else {
        setLeaveForm(prev => ({ ...prev, [field === 'start' ? 'start_date' : 'end_date']: '' }));
      }
    } else {
      setLeaveForm(prev => ({ ...prev, [field === 'start' ? 'start_date' : 'end_date']: '' }));
    }
  };

  const GhostPlaceholder = ({ value }: { value: string }) => {
    const placeholder = "DD/MM/YYYY";
    const ghost = " ".repeat(value.length) + placeholder.slice(value.length);
    return (
        <div className="absolute inset-0 pl-6 pr-14 flex items-center pointer-events-none">
            <span className="font-black text-sm uppercase tracking-wider text-slate-200 whitespace-pre">
                {ghost}
            </span>
        </div>
    );
  };


  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteStaffId, setDeleteStaffId] = useState<string | null>(null);
  const [isSchemaMissing, setIsSchemaMissing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadLeaves = async () => {
    setLoading(true);
    setIsSchemaMissing(false);
    try {
      const data = await db.getStaffLeaves(staff.id);
      setLeaves(data);
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('relation "public.staff_leaves" does not exist') || e.code === '42P01') {
        setIsSchemaMissing(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaves();
  }, [staff.id]);

  useEffect(() => {
    if (activeTab === 'incentives') {
      loadIncentives();
    }
  }, [staff.id, activeTab, incentiveDate]);

  const loadIncentives = async () => {
    if (!staff) return;
    setIncentiveLoading(true);
    try {
      const propertyId = staff.property_id;
      
      // We need to fetch incentives for each department and combine them
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

        // Filter rows for this specific staff member
        const staffRows = result.rows.filter(r => r.staff_splits && r.staff_splits[staff.id]);
        
        // Add department info to each row
        const rowsWithDept = staffRows.map(r => ({
          ...r,
          department: dept,
          my_incentive: r.staff_splits[staff.id]
        }));

        allRows = [...allRows, ...rowsWithDept];
        totalInc += rowsWithDept.reduce((sum, r) => sum + r.my_incentive, 0);
      }

      // Sort by date
      allRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setIncentiveData(allRows);
      setIncentiveSummary({ total: totalInc, count: allRows.length });
    } catch (error) {
      console.error("Failed to load incentives:", error);
    } finally {
      setIncentiveLoading(false);
    }
  };

  const [error, setError] = useState<string | null>(null);

  const handleSaveLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveForm.start_date || !leaveForm.end_date) return;
    setError(null);
    
    try {
      if (editingLeaveId) {
        await db.updateStaffLeave(editingLeaveId, leaveForm);
      } else {
        await db.addStaffLeave({
          staff_id: staff.id,
          start_date: leaveForm.start_date,
          end_date: leaveForm.end_date
        });
      }
      setShowLeaveForm(false);
      setEditingLeaveId(null);
      setLeaveForm({ start_date: '', end_date: '' });
      loadLeaves();
    } catch (e: any) {
      console.error(e);
      if (e.message?.includes('relation "public.staff_leaves" does not exist') || e.code === '42P01') {
        setIsSchemaMissing(true);
        setShowLeaveForm(false);
      } else {
        setError(e.message || "Failed to save leave record.");
      }
    }
  };

  const [leaveToDelete, setLeaveToDelete] = useState<StaffLeave | null>(null);

  const handleDeleteLeave = async (id: string) => {
    const leave = leaves.find(l => l.id === id);
    if (leave) setLeaveToDelete(leave);
  };

  const confirmDeleteLeave = async () => {
    if (!leaveToDelete) return;
    setIsDeleting(leaveToDelete.id);
    try {
      await db.deleteStaffLeave(leaveToDelete.id);
      loadLeaves();
    } catch (e: any) {
      console.error("Delete failed", e);
      setErrorMsg(`Failed to delete leave: ${e.message}`);
    } finally {
      setIsDeleting(null);
      setLeaveToDelete(null);
    }
  };

  const MissingLeavesTablePanel = () => (
    <div className="col-span-1 lg:col-span-12 mb-8">
      <Card className="rounded-[2.5rem] border-amber-200 bg-amber-50/30 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-amber-600 p-6 text-white flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                  <Database className="w-6 h-6" />
              </div>
              <div>
                  <h2 className="text-lg font-black uppercase tracking-tight">Leave Management System Update Required</h2>
                  <p className="text-amber-100 font-bold text-xs">The 'staff_leaves' table is missing or inaccessible.</p>
              </div>
          </div>
          <CardContent className="p-8 space-y-6">
              <div className="space-y-2">
                  <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Maintenance Mode</h3>
                  <p className="text-slate-600 text-xs leading-relaxed font-medium">Please execute this script in your <span className="font-bold text-indigo-600">Supabase SQL Editor</span> to enable leave tracking.</p>
              </div>

              <div className="relative group">
                  <pre className="bg-slate-950 text-indigo-300 p-6 rounded-2xl overflow-x-auto text-[10px] font-mono leading-relaxed shadow-inner border border-white/10">
{`-- CREATE STAFF LEAVES TABLE
CREATE TABLE IF NOT EXISTS public.staff_leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- ENABLE RLS
ALTER TABLE public.staff_leaves ENABLE ROW LEVEL SECURITY;

-- CREATE POLICIES
DROP POLICY IF EXISTS "Allow authenticated read access to staff_leaves" ON public.staff_leaves;
DROP POLICY IF EXISTS "Allow authenticated insert access to staff_leaves" ON public.staff_leaves;
DROP POLICY IF EXISTS "Allow authenticated update access to staff_leaves" ON public.staff_leaves;
DROP POLICY IF EXISTS "Allow authenticated delete access to staff_leaves" ON public.staff_leaves;

CREATE POLICY "Allow authenticated read access to staff_leaves" ON public.staff_leaves FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert access to staff_leaves" ON public.staff_leaves FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update access to staff_leaves" ON public.staff_leaves FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Allow authenticated delete access to staff_leaves" ON public.staff_leaves FOR DELETE TO authenticated USING (true);

-- GRANT PERMISSIONS
GRANT ALL ON TABLE public.staff_leaves TO anon, authenticated, postgres;

-- RELOAD SCHEMA
NOTIFY pgrst, 'reload schema';`}
                  </pre>
              </div>
              <Button onClick={() => window.location.reload()} className="h-10 px-6 rounded-xl font-black uppercase text-[9px] tracking-widest bg-amber-600 hover:bg-amber-700">
                  <RefreshCcw className="w-3.5 h-3.5 mr-2" /> Verify System Sync
              </Button>
          </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 pb-20">
      <div className="flex justify-between items-center bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <button onClick={onBack} className="relative z-10 flex items-center gap-2 px-5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-all bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
            <ArrowLeft className="w-4 h-4" /> Back to Roster
        </button>
        {canManage && (
          <div className="flex gap-2">
            <Button onClick={() => setDeleteStaffId(staff.id)} variant="secondary" className="relative z-10 rounded-xl h-11 px-6 font-black text-xs uppercase bg-white border-2 border-red-100 hover:border-red-200 text-red-600 shadow-sm transition-all">
                <Trash2 className="w-4 h-4 mr-2" /> Purge Staff
            </Button>
            <Button onClick={() => onEdit(staff)} variant="secondary" className="relative z-10 rounded-xl h-11 px-6 font-black text-xs uppercase bg-white border-2 border-slate-100 hover:border-indigo-200 shadow-sm transition-all">
                <Edit2 className="w-4 h-4 mr-2" /> Modify Profile
            </Button>
          </div>
        )}
      </div>

      <ConfirmationModal 
        isOpen={!!deleteStaffId} 
        onClose={() => setDeleteStaffId(null)} 
        onConfirm={async () => { await db.deleteStaff(staff.id); loadStaff(); onBack(); }} 
        title="Purge Staff Identity" 
        description="Permanently remove this personnel record from the system?" 
        confirmText="Confirm Purge" 
        isDestructive={true} 
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {isSchemaMissing && <MissingLeavesTablePanel />}
        
        <div className="lg:col-span-4 space-y-8">
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
            <div className="h-28 bg-slate-900 w-full relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 p-2 bg-white rounded-[2.5rem] shadow-2xl">
                  <div className="w-28 h-28 bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2.2rem] flex items-center justify-center text-white text-5xl font-black shadow-inner ring-8 ring-indigo-50/50">
                      {staff.name.charAt(0)}
                  </div>
                </div>
            </div>
            <CardContent className="pt-20 pb-8 text-center px-10">
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-tight mb-1">{staff.name}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> {staff.role}
                </p>
                
                <div className={`mt-6 inline-flex px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-full border shadow-sm ${staff.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  <div className={`w-2 h-2 rounded-full mr-2 ${staff.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                  {staff.is_active ? 'Active' : 'Inactive'}
                </div>
                
                <div className="mt-10 space-y-3">
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-black text-slate-700">
                      <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-600"><Phone className="w-4 h-4" /></div>
                      <span className="flex-1 text-left">{staff.phone || 'No phone'}</span>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs font-black text-slate-700 overflow-hidden">
                      <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-indigo-600"><Mail className="w-4 h-4 shrink-0" /></div>
                      <span className="truncate flex-1 text-left lowercase">{staff.email || 'No email'}</span>
                  </div>
                  {staff.probation_start_date && (
                    <div className="flex items-center gap-4 p-4 bg-amber-50/50 rounded-2xl border border-amber-100 text-[10px] font-black text-amber-700">
                        <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-amber-600"><ShieldAlert className="w-4 h-4" /></div>
                        <div className="flex-1 text-left">
                          <p className="uppercase opacity-60 text-[8px]">Probation Period</p>
                          <p>{format(parseISO(staff.probation_start_date), 'dd MMM yy')} - {format(parseISO(staff.probation_end_date || ''), 'dd MMM yy')}</p>
                        </div>
                    </div>
                  )}
                </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-8">
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white flex flex-col min-h-[550px]">
              <CardHeader className="bg-slate-50 p-0 flex flex-col border-b shrink-0">
                  <div className="flex border-b border-slate-200">
                    <button 
                      onClick={() => setActiveTab('leaves')}
                      className={`flex-1 py-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-4 ${activeTab === 'leaves' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'}`}
                    >
                      Leave History
                    </button>
                    <button 
                      onClick={() => setActiveTab('incentives')}
                      className={`flex-1 py-6 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-4 ${activeTab === 'incentives' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'}`}
                    >
                      Incentive Earnings
                    </button>
                  </div>

                  <div className="p-6 flex justify-between items-center">
                    {activeTab === 'leaves' ? (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-100 shadow-sm"><CalendarX className="w-5 h-5 text-amber-600" /></div>
                          <div>
                              <CardTitle className="text-[11px] font-black uppercase tracking-widest leading-none text-slate-900">Leave History</CardTitle>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Absence & Incentive Exemption Periods</p>
                          </div>
                        </div>
                        {canManageLeaves && (
                          <Button onClick={() => { setEditingLeaveId(null); setLeaveForm({ start_date: '', end_date: '' }); setShowLeaveForm(true); }} size="sm" variant="secondary" className="rounded-xl font-black uppercase text-[9px] tracking-widest h-9 px-5 bg-indigo-600 hover:bg-indigo-700 text-white border-none transition-all active:scale-95 shadow-lg shadow-indigo-900/40">
                              <Plus className="w-3.5 h-3.5 mr-1.5" /> Record Leave
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100 shadow-sm"><Award className="w-5 h-5 text-indigo-600" /></div>
                          <div>
                              <CardTitle className="text-[11px] font-black uppercase tracking-widest leading-none text-slate-900">Incentive Earnings</CardTitle>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Performance Based Payouts for {format(incentiveDate, 'MMMM yyyy')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setIncentiveDate(new Date(incentiveDate.getFullYear(), incentiveDate.getMonth() - 1, 1))}
                            className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400"
                          >
                            <RefreshCcw className="w-3.5 h-3.5 rotate-[-90deg]" />
                          </button>
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 min-w-[100px] text-center">
                            {format(incentiveDate, 'MMM yyyy')}
                          </span>
                          <button 
                            onClick={() => setIncentiveDate(new Date(incentiveDate.getFullYear(), incentiveDate.getMonth() + 1, 1))}
                            className="p-2 hover:bg-slate-200 rounded-lg transition-colors text-slate-400"
                          >
                            <RefreshCcw className="w-3.5 h-3.5 rotate-[90deg]" />
                          </button>
                          <Button 
                            onClick={loadIncentives} 
                            disabled={incentiveLoading} 
                            size="sm" 
                            variant="secondary" 
                            className="rounded-xl font-black uppercase text-[9px] tracking-widest h-9 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 border-none ml-2"
                          >
                            <RefreshCcw className={`w-3.5 h-3.5 mr-1.5 ${incentiveLoading ? 'animate-spin' : ''}`} /> Sync
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar">
                  {activeTab === 'leaves' ? (
                    <table className="w-full text-left table-fixed">
                        <thead className="bg-slate-50/30 text-[8px] font-black uppercase text-slate-400 tracking-[0.2em] border-b sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 w-[35%]">Commence</th>
                                <th className="px-6 py-4 w-[35%]">Terminate</th>
                                <th className="px-6 py-4 w-[30%] text-right">Ops</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {(!Array.isArray(leaves) || leaves.length === 0) ? (
                                <tr><td colSpan={3} className="px-8 py-28 text-center">
                                    <div className="flex flex-col items-center gap-4 opacity-30">
                                        <CalendarX className="w-12 h-12 text-slate-300" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No historical leaves</p>
                                    </div>
                                </td></tr>
                            ) : (
                                Array.isArray(leaves) && leaves.map(l => (
                                    <tr key={l.id} className="hover:bg-indigo-50/20 transition-colors group">
                                        <td className="px-6 py-5 text-[11px] font-black text-slate-700 whitespace-nowrap">{format(parseISO(l.start_date), 'dd MMM yyyy')}</td>
                                        <td className="px-6 py-5 text-[11px] font-black text-slate-700 whitespace-nowrap">{format(parseISO(l.end_date), 'dd MMM yyyy')}</td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {canManageLeaves && (
                                                  <>
                                                    <button onClick={() => { setEditingLeaveId(l.id); setLeaveForm({ start_date: l.start_date, end_date: l.end_date }); setShowLeaveForm(true); }} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors" title="Modify"><Edit2 className="w-3.5 h-3.5"/></button>
                                                    <button onClick={() => handleDeleteLeave(l.id)} disabled={isDeleting === l.id} className={`p-2 transition-colors ${isDeleting === l.id ? 'text-slate-200 cursor-wait' : 'text-slate-300 hover:text-red-500'}`} title="Delete">
                                                        {isDeleting === l.id ? <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-transparent rounded-full animate-spin"></div> : <Trash2 className="w-3.5 h-3.5"/>}
                                                    </button>
                                                  </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                  ) : (
                    <div className="p-6 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl"></div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Total Earnings</div>
                          <div className="text-3xl font-black text-white relative z-10">{formatMoney(incentiveSummary.total)}</div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Services</div>
                          <div className="text-3xl font-black text-slate-900">{incentiveSummary.count || 0}</div>
                        </div>
                      </div>

                      {incentiveLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Calculating Incentives...</p>
                        </div>
                      ) : incentiveData.length === 0 ? (
                        <div className="bg-slate-50 p-12 rounded-[2rem] border border-slate-200/60 text-center">
                          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-sm">
                            <Award className="w-8 h-8 text-slate-300" />
                          </div>
                          <h3 className="text-base font-black uppercase tracking-widest text-slate-900">No Earnings Found</h3>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 max-w-xs mx-auto leading-relaxed">No incentives recorded for this staff member in {format(incentiveDate, 'MMMM yyyy')}.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-4">
                          <AnimatePresence mode="popLayout">
                            {incentiveData.map((item, index) => (
                              <motion.div 
                                key={item.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: index * 0.02 }}
                                className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden group hover:shadow-md hover:border-indigo-200 transition-all duration-300"
                              >
                                <div className="flex justify-between items-start mb-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${
                                      item.department === 'Massage' ? 'bg-indigo-50 text-indigo-600' :
                                      item.department === 'Membership' ? 'bg-emerald-50 text-emerald-600' :
                                      'bg-amber-50 text-amber-600'
                                    }`}>
                                      {item.department === 'Massage' ? <Sparkles className="w-5 h-5" /> :
                                       item.department === 'Membership' ? <TrendingUp className="w-5 h-5" /> :
                                       <Award className="w-5 h-5" />}
                                    </div>
                                    <div>
                                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{item.department}</p>
                                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{item.item_name}</h4>
                                    </div>
                                  </div>
                                    <div className="text-right">
                                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Staff Share</p>
                                      <p className="text-lg font-black text-indigo-600">{formatMoney(item.my_incentive)}</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-3.5 h-3.5 text-slate-300" />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.date}</span>
                                  </div>
                                  <div className="flex items-center gap-2 justify-end">
                                    <User className="w-3.5 h-3.5 text-slate-300" />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate max-w-[100px]">{item.guest_name}</span>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  )}
              </CardContent>
          </Card>
        </div>
      </div>

      {showLeaveForm && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <Card className="w-full max-w-[400px] rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.4)] overflow-hidden bg-white border border-white/20">
                <CardHeader className="bg-[#0f172a] text-white p-10 relative flex flex-col items-center text-center">
                    <div className="w-14 h-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 border border-indigo-500/30">
                        <CalendarX className="w-7 h-7 text-indigo-400" />
                    </div>
                    <CardTitle className="text-2xl font-black uppercase tracking-tight leading-none mb-2">Record Leave</CardTitle>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Absence Period</p>
                    <button onClick={() => setShowLeaveForm(false)} className="absolute top-8 right-8 p-2.5 rounded-full bg-white/5 hover:bg-white/10 transition-all active:scale-90 shadow-lg border border-white/5">
                        <X className="w-5 h-5 text-slate-400"/>
                    </button>
                </CardHeader>
                <CardContent className="p-10 space-y-8">
                    <form onSubmit={handleSaveLeave} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-600 ml-1">Commencement Date (DD/MM/YYYY)</label>
                            <div className="relative group bg-slate-50/50 rounded-2xl border-2 border-slate-100 focus-within:border-indigo-600 transition-all">
                                <GhostPlaceholder value={displayDates.start} />
                                <input 
                                    type="text" 
                                    value={displayDates.start} 
                                    onChange={e => handleDisplayDateChange('start', e.target.value)} 
                                    onBlur={() => handleBlur('start')}
                                    required
                                    className="w-full h-16 pl-6 pr-14 rounded-2xl border-none focus:ring-0 font-black text-sm uppercase tracking-wider transition-all bg-transparent relative z-20"
                                />
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none transition-colors text-slate-400 group-focus-within:text-indigo-600 z-30">
                                    <Calendar className="w-4 h-4" />
                                </div>
                                <input 
                                    type="date"
                                    value={leaveForm.start_date}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 opacity-0 cursor-pointer z-40"
                                    title="Open Calendar"
                                    onChange={(e) => {
                                        const iso = e.target.value;
                                        if (iso) {
                                            setLeaveForm(prev => ({ ...prev, start_date: iso }));
                                            setDisplayDates(prev => ({ ...prev, start: fromISODate(iso) }));
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-600 ml-1">Termination Date (DD/MM/YYYY)</label>
                            <div className="relative group bg-slate-50/50 rounded-2xl border-2 border-slate-100 focus-within:border-indigo-600 transition-all">
                                <GhostPlaceholder value={displayDates.end} />
                                <input 
                                    type="text" 
                                    value={displayDates.end} 
                                    onChange={e => handleDisplayDateChange('end', e.target.value)} 
                                    onBlur={() => handleBlur('end')}
                                    required
                                    className="w-full h-16 pl-6 pr-14 rounded-2xl border-none focus:ring-0 font-black text-sm uppercase tracking-wider transition-all bg-transparent relative z-20"
                                />
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none transition-colors text-slate-400 group-focus-within:text-indigo-600 z-30">
                                    <Calendar className="w-4 h-4" />
                                </div>
                                <input 
                                    type="date"
                                    value={leaveForm.end_date}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 opacity-0 cursor-pointer z-40"
                                    title="Open Calendar"
                                    onChange={(e) => {
                                        const iso = e.target.value;
                                        if (iso) {
                                            setLeaveForm(prev => ({ ...prev, end_date: iso }));
                                            setDisplayDates(prev => ({ ...prev, end: fromISODate(iso) }));
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 text-[10px] font-bold p-4 rounded-xl flex items-center gap-3 animate-in shake duration-300">
                                <X className="w-4 h-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <Button 
                            type="submit" 
                            className={`w-full h-16 rounded-[1.8rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl mt-4 active:scale-95 transition-all ${leaveForm.start_date && leaveForm.end_date ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/40 scale-[1.02]' : 'bg-slate-200 text-slate-400'} text-white`}
                        >
                            {editingLeaveId ? 'Commit Modification' : 'Commit Leave'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
      )}
      
      <ConfirmationModal 
        isOpen={!!leaveToDelete} 
        onClose={() => setLeaveToDelete(null)} 
        onConfirm={confirmDeleteLeave} 
        title="Revoke Leave Period" 
        description={`Permanently remove this absence record (${leaveToDelete ? format(parseISO(leaveToDelete.start_date), 'dd MMM') : ''} - ${leaveToDelete ? format(parseISO(leaveToDelete.end_date), 'dd MMM') : ''})?`} 
        confirmText="Confirm Revocation" 
        isDestructive={true} 
      />

      <ConfirmationModal 
        isOpen={!!errorMsg} 
        onClose={() => setErrorMsg(null)} 
        onConfirm={() => setErrorMsg(null)} 
        title="Action Failed" 
        description={errorMsg || ""} 
        confirmText="Okay"
        showCancel={false}
      />
    </div>
  );
};

export default StaffProfileView;
