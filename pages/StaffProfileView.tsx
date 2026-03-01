import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, ConfirmationModal } from '../components/ui';
import { Staff, StaffLeave } from '../types';
import { db } from '../services/mockSupabase';
import { ArrowLeft, Calendar, Plus, Trash2, Edit2, ShieldCheck, Mail, Phone, CalendarX, X, Database, RefreshCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface StaffProfileViewProps {
  staff: Staff;
  onBack: () => void;
  canManage: boolean;
  canManageLeaves: boolean;
  onEdit: (s: Staff) => void;
}

const StaffProfileView: React.FC<StaffProfileViewProps> = ({ staff, onBack, canManage, canManageLeaves, onEdit }) => {
  const [leaves, setLeaves] = useState<StaffLeave[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLeaveForm, setShowLeaveForm] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ start_date: '', end_date: '' });
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null);

  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isSchemaMissing, setIsSchemaMissing] = useState(false);

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
      alert(`Failed to delete leave: ${e.message}`);
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
                  <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Safe Repair Protocol</h3>
                  <p className="text-slate-600 text-xs leading-relaxed font-medium">Please execute this script in your <span className="font-bold text-indigo-600">Supabase SQL Editor</span> to enable leave tracking.</p>
              </div>

              <div className="relative group">
                  <pre className="bg-slate-950 text-indigo-300 p-6 rounded-2xl overflow-x-auto text-[10px] font-mono leading-relaxed shadow-inner border border-white/10">
{`-- CREATE STAFF LEAVES TABLE
CREATE TABLE IF NOT EXISTS public.staff_leaves (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    staff_id TEXT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
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
          <Button onClick={() => onEdit(staff)} variant="secondary" className="relative z-10 rounded-xl h-11 px-6 font-black text-xs uppercase bg-white border-2 border-slate-100 hover:border-indigo-200 shadow-sm transition-all">
              <Edit2 className="w-4 h-4 mr-2" /> Modify Profile
          </Button>
        )}
      </div>

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
                </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-8">
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white flex flex-col min-h-[460px]">
              <CardHeader className="bg-slate-50 p-8 flex justify-between items-center border-b shrink-0">
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
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar">
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
                            <label className="text-[11px] font-bold text-slate-600 ml-1">Commencement Date</label>
                            <div className="relative group">
                                <input 
                                    type="date" 
                                    value={leaveForm.start_date} 
                                    onChange={e => setLeaveForm({...leaveForm, start_date: e.target.value})} 
                                    required
                                    className="w-full h-16 pl-6 pr-14 rounded-2xl border-2 focus:ring-0 font-black text-sm uppercase tracking-wider transition-all appearance-none cursor-pointer border-slate-100 focus:border-indigo-600 bg-white"
                                />
                                <Calendar className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors text-slate-400 group-focus-within:text-indigo-600" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-600 ml-1">Termination Date</label>
                            <div className="relative group">
                                <input 
                                    type="date" 
                                    value={leaveForm.end_date} 
                                    onChange={e => setLeaveForm({...leaveForm, end_date: e.target.value})} 
                                    required
                                    className="w-full h-16 pl-6 pr-14 rounded-2xl border-2 focus:ring-0 font-black text-sm uppercase tracking-wider transition-all appearance-none cursor-pointer border-slate-100 focus:border-indigo-600 bg-white"
                                />
                                <Calendar className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none transition-colors text-slate-400 group-focus-within:text-indigo-600" />
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
                            className="w-full h-16 rounded-[1.8rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl mt-4 active:scale-95 transition-all bg-[#a5b4fc] hover:bg-[#93a5f7] text-white"
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
    </div>
  );
};

export default StaffProfileView;
