
import React, { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { Plus, Search, Filter, Snowflake, Trash2, Edit2, ChevronDown, ChevronRight, Layers, AlertCircle, CalendarDays } from 'lucide-react';
import { db } from '../services/mockSupabase';
import { Member, MembershipCategory, MemberStatus, Freeze } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, parseISO, differenceInCalendarDays, addDays } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

// --- Zod Schema ---
const memberSchema = z.object({
  membership_number: z.string().min(1, "Required"),
  guest_name: z.string().min(2, "Name too short"),
  category_id: z.string().min(1, "Required"),
  start_date: z.string().min(1, "Required"),
  discount: z.number().min(0),
  check_no: z.string().optional(),
});

type MemberFormValues = z.infer<typeof memberSchema>;

const Members = () => {
  const { user } = useAuth();
  const { currentOutlet, formatMoney, currency } = useSettings();
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // State to auto-open freeze section in detail view
  const [autoFreeze, setAutoFreeze] = useState(false);

  useEffect(() => {
    if (currentOutlet) loadData();
  }, [currentOutlet]);

  const loadData = async () => {
    if (!currentOutlet) return;
    const [m, c] = await Promise.all([
        db.getMembers(currentOutlet.id), 
        db.getCategories(currentOutlet.id)
    ]);
    setMembers(m);
    setCategories(c);
  };

  const confirmDelete = async () => {
      if (deleteId) {
          await db.deleteMember(deleteId);
          loadData();
          setDeleteId(null);
      }
  };

  const handleEdit = (member: Member, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedMember(member);
      setIsEditing(true);
      setView('form');
  };

  const handleFreezeClick = (member: Member, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedMember(member);
      setAutoFreeze(true);
      setView('detail');
  };

  const handleAddNew = () => {
      setSelectedMember(null);
      setIsEditing(false);
      setView('form');
  };

  // Grouping Logic
  const filteredMembers = members.filter(m => 
    m.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    m.membership_number.includes(searchTerm)
  );

  const groupedMembers = categories.map(cat => ({
      category: cat,
      members: filteredMembers.filter(m => m.category_id === cat.id)
  })).filter(g => g.members.length > 0 || searchTerm === '');

  const orphanMembers = filteredMembers.filter(m => !categories.find(c => c.id === m.category_id));
  if (orphanMembers.length > 0) {
      groupedMembers.push({
          category: { id: 'unknown', name: 'Uncategorized / Archived', base_rate: 0, duration_months: 0, outlet_id: currentOutlet?.id },
          members: orphanMembers
      });
  }

  return (
    <div className="space-y-6">
      {view === 'list' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                 <h1 className="text-2xl font-bold text-slate-900">Members</h1>
                 <p className="text-sm text-slate-500">Managing {currentOutlet?.name}</p>
            </div>
            
            <Button onClick={handleAddNew}>
              <Plus className="w-4 h-4 mr-2" /> Add Member
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input 
                placeholder="Search by name, ID or check number..." 
                className="pl-9 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="space-y-6">
            {groupedMembers.map((group) => (
                <Card key={group.category.id} className="overflow-hidden border-slate-200">
                    <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-500" />
                        <h3 className="font-semibold text-slate-700">{group.category.name}</h3>
                        <span className="bg-slate-200 text-slate-600 text-xs px-2 py-0.5 rounded-full">
                            {group.members.length}
                        </span>
                    </div>
                    {group.members.length === 0 ? (
                        <div className="p-6 text-center text-slate-500 text-sm">No members found in this category.</div>
                    ) : (
                        <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase border-b">
                            <tr>
                                <th className="px-6 py-3">ID</th>
                                <th className="px-6 py-3">Name</th>
                                <th className="px-6 py-3">Status</th>
                                <th className="px-6 py-3">Start</th>
                                <th className="px-6 py-3">End</th>
                                <th className="px-6 py-3 text-right">Net ({currency?.symbol || '$'})</th>
                                <th className="px-6 py-3 text-center">Actions</th>
                            </tr>
                            </thead>
                            <tbody>
                            {group.members.map((member) => (
                                <tr 
                                    key={member.id} 
                                    className="border-b last:border-0 hover:bg-slate-50 cursor-pointer transition-colors"
                                    onClick={() => { setSelectedMember(member); setView('detail'); }}
                                >
                                <td className="px-6 py-4 font-medium text-slate-900">{member.membership_number}</td>
                                <td className="px-6 py-4 font-medium">{member.guest_name}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold
                                    ${member.status === 'Active' ? 'bg-green-100 text-green-700' : 
                                        member.status === 'Frozen' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                    {member.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-slate-500">{member.start_date}</td>
                                <td className="px-6 py-4 text-indigo-600 font-medium">{member.current_end_date}</td>
                                <td className="px-6 py-4 text-right font-mono">{formatMoney(member.net_amount)}</td>
                                <td className="px-6 py-4">
                                    <div className="flex justify-center gap-2">
                                        <button 
                                            type="button"
                                            onClick={(e) => handleFreezeClick(member, e)}
                                            className="p-1 text-slate-400 hover:text-amber-600 rounded hover:bg-amber-50"
                                            title="Freeze Membership"
                                        >
                                            <Snowflake className="w-4 h-4" />
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={(e) => handleEdit(member, e)}
                                            className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50"
                                            title="Edit Member"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setDeleteId(member.id); }}
                                            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50"
                                            title="Delete Member"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        </div>
                    )}
                </Card>
            ))}
            
            {groupedMembers.length === 0 && (
                <div className="text-center py-10 text-slate-500">
                    No members found matching your search.
                </div>
            )}
          </div>
          
          <ConfirmationModal 
            isOpen={!!deleteId}
            onClose={() => setDeleteId(null)}
            onConfirm={confirmDelete}
            title="Delete Member"
            description="Are you sure you want to delete this member? This action cannot be undone."
            confirmText="Delete Member"
            isDestructive={true}
          />
        </div>
      )}

      {view === 'form' && (
        <MemberForm 
          categories={categories} 
          existingMember={isEditing ? selectedMember : null}
          currentOutletId={currentOutlet?.id || ''}
          onCancel={() => setView('list')} 
          onSuccess={() => { loadData(); setView('list'); }} 
        />
      )}

      {view === 'detail' && selectedMember && (
        <MemberDetail 
          member={selectedMember} 
          initialFreeze={autoFreeze}
          onBack={() => { setView('list'); setSelectedMember(null); setAutoFreeze(false); }}
          onUpdate={() => { loadData(); setView('list'); setAutoFreeze(false); }} 
        />
      )}
    </div>
  );
};

// --- Member Form Component ---
const MemberForm = ({ 
    categories, 
    existingMember,
    currentOutletId,
    onCancel, 
    onSuccess 
}: { 
    categories: MembershipCategory[], 
    existingMember: Member | null,
    currentOutletId: string,
    onCancel: () => void, 
    onSuccess: () => void 
}) => {
  const { formatMoney, currency } = useSettings();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: existingMember ? {
        membership_number: existingMember.membership_number,
        guest_name: existingMember.guest_name,
        category_id: existingMember.category_id,
        start_date: existingMember.start_date,
        discount: existingMember.discount,
        check_no: existingMember.check_no
    } : {
      discount: 0,
      start_date: format(new Date(), 'yyyy-MM-dd')
    }
  });

  const categoryId = watch('category_id');
  const startDate = watch('start_date');
  const discount = watch('discount');

  const selectedCategory = categories.find(c => c.id === categoryId);
  const baseRate = selectedCategory?.base_rate || 0;
  const netAmount = Math.max(0, baseRate - (Number(discount) || 0));
  
  let endDateStr = '';
  let dailyRate = 0;
  let totalDays = 0;

  if (startDate && selectedCategory) {
    const start = parseISO(startDate);
    const end = RevenueEngine.calculateOriginalEndDate(start, selectedCategory.duration_months);
    endDateStr = format(end, 'yyyy-MM-dd');
    dailyRate = RevenueEngine.calculateDailyRate(netAmount, start, end);
    totalDays = differenceInCalendarDays(end, start) + 1;
  }

  const onSubmit = async (data: MemberFormValues) => {
    if (!selectedCategory || !endDateStr) return;

    const memberId = existingMember ? existingMember.id : `mem_${Date.now()}`;
    const status = existingMember ? existingMember.status : MemberStatus.ACTIVE;
    
    const memberData: Member = {
      id: memberId,
      outlet_id: currentOutletId, 
      membership_number: data.membership_number,
      guest_name: data.guest_name,
      category_id: data.category_id,
      start_date: data.start_date,
      original_end_date: endDateStr, 
      current_end_date: endDateStr,  
      actual_rate: selectedCategory.base_rate,
      discount: data.discount,
      net_amount: netAmount,
      daily_rate: dailyRate,
      check_no: data.check_no,
      status: status
    };

    if (existingMember) {
        await db.updateMember(memberId, memberData);
    } else {
        await db.addMember(memberData);
    }
    
    onSuccess();
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>{existingMember ? 'Edit Member' : 'Register New Member'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Membership ID" {...register('membership_number')} error={errors.membership_number?.message} />
              <Input label="Guest Name" {...register('guest_name')} error={errors.guest_name?.message} />
              
              <Select 
                label="Category" 
                options={[
                    { value: '', label: 'Select...' }, 
                    ...categories.map(c => ({ 
                        value: c.id, 
                        label: `${c.name} (${formatMoney(c.base_rate)})` 
                    }))
                ]} 
                {...register('category_id')}
                error={errors.category_id?.message}
              />
              <Input type="date" label="Start Date" {...register('start_date')} error={errors.start_date?.message} />
              
              <Input 
                label="End Date (Calculated)" 
                value={endDateStr || '-'} 
                disabled 
                className="bg-slate-50 text-slate-600"
              />

              <Input 
                type="number" 
                label={`Discount Amount (${currency?.symbol || '$'})`}
                {...register('discount', { valueAsNumber: true })} 
                error={errors.discount?.message} 
              />
              <Input label="Check/Reference No." {...register('check_no')} />
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4 space-y-2">
              <h4 className="font-semibold text-slate-700 mb-2">Revenue Engine Preview</h4>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Base Rate:</span>
                <span>{formatMoney(baseRate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Net Amount:</span>
                <span className="font-medium text-indigo-600">{formatMoney(netAmount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Calculated End Date:</span>
                <span>{endDateStr || '-'}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                <span className="text-slate-500 flex items-center gap-1">
                   <CalendarDays className="w-3.5 h-3.5" /> Total Membership Days:
                </span>
                <span className="font-bold text-slate-900">{totalDays} Days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Daily Revenue Recognition:</span>
                <span className="font-mono text-indigo-700">{currency?.symbol || '$'} {dailyRate.toFixed(2)} / day</span>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
              <Button type="submit">{existingMember ? 'Update Member' : 'Submit Membership'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

const MemberDetail = ({ member, initialFreeze = false, onBack, onUpdate }: { member: Member, initialFreeze?: boolean, onBack: () => void, onUpdate: () => void }) => {
  const { formatMoney, currency } = useSettings();
  const [freezes, setFreezes] = useState<Freeze[]>([]);
  const [isFreezing, setIsFreezing] = useState(initialFreeze);
  const [freezeStart, setFreezeStart] = useState('');
  const [freezeDays, setFreezeDays] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    db.getFreezes(member.id).then(setFreezes);
  }, [member.id]);

  const handleAddFreeze = async () => {
    setError('');
    if (!freezeStart || freezeDays <= 0) return;
    
    const start = parseISO(freezeStart);
    const end = addDays(start, freezeDays - 1);
    
    if (RevenueEngine.checkFreezeOverlap(start, end, freezes)) {
      setError("Freeze period overlaps with an existing freeze.");
      return;
    }

    const newFreeze: Freeze = {
      id: `fz_${Date.now()}`,
      member_id: member.id,
      start_date: freezeStart,
      end_date: format(end, 'yyyy-MM-dd'),
      total_days: freezeDays
    };

    await db.addFreeze(newFreeze);
    setIsFreezing(false);
    onUpdate(); 
  };

  return (
    <div className="space-y-6">
      <Button variant="secondary" size="sm" onClick={onBack}>&larr; Back to List</Button>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Member Profile</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
               <div>
                 <label className="text-xs text-slate-500 uppercase">Guest Name</label>
                 <p className="font-medium text-lg">{member.guest_name}</p>
                 <p className="text-xs text-slate-400">ID: {member.membership_number}</p>
               </div>
               <div>
                 <label className="text-xs text-slate-500 uppercase">Status</label>
                 <div>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold
                          ${member.status === 'Active' ? 'bg-green-100 text-green-700' : 
                            member.status === 'Frozen' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {member.status}
                    </span>
                 </div>
               </div>
               <div>
                 <label className="text-xs text-slate-500 uppercase">Start Date</label>
                 <p>{member.start_date}</p>
               </div>
               <div>
                 <label className="text-xs text-slate-500 uppercase">Current End Date</label>
                 <p className="text-indigo-600 font-bold text-lg">{member.current_end_date}</p>
               </div>
               {member.check_no && (
                   <div>
                       <label className="text-xs text-slate-500 uppercase">Reference / Check</label>
                       <p>{member.check_no}</p>
                   </div>
               )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle>Freeze History</CardTitle>
              <Button size="sm" variant="outline" onClick={() => setIsFreezing(!isFreezing)}>
                <Snowflake className="w-4 h-4 mr-2" />
                {isFreezing ? 'Cancel' : 'Add Freeze'}
              </Button>
            </CardHeader>
            <CardContent>
              {isFreezing && (
                <div className="bg-slate-50 p-4 mb-4 rounded border border-slate-200">
                  <h5 className="font-medium text-sm mb-2">New Freeze Period</h5>
                  <div className="flex gap-4 items-end">
                    <Input 
                      type="date" 
                      label="Start Date" 
                      value={freezeStart} 
                      onChange={e => setFreezeStart(e.target.value)} 
                    />
                    <Input 
                      type="number" 
                      label="Duration (Days)" 
                      value={freezeDays} 
                      onChange={e => setFreezeDays(parseInt(e.target.value))} 
                    />
                    <Button onClick={handleAddFreeze}>Save</Button>
                  </div>
                  {error && <div className="text-red-600 text-xs mt-2 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {error}</div>}
                  <p className="text-xs text-slate-500 mt-2">Revenue recognition will pause during this period, and the membership end date will be extended.</p>
                </div>
              )}

              {freezes.length === 0 ? (
                <p className="text-slate-500 text-sm">No freeze records found.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="font-normal pb-2">Start Date</th>
                      <th className="font-normal pb-2">End Date</th>
                      <th className="font-normal pb-2">Total Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {freezes.map(f => (
                      <tr key={f.id} className="border-b last:border-0">
                        <td className="py-2">{f.start_date}</td>
                        <td className="py-2">{f.end_date}</td>
                        <td className="py-2">{f.total_days}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
           <Card>
             <CardHeader><CardTitle>Financial Breakdown</CardTitle></CardHeader>
             <CardContent className="space-y-4">
               <div className="flex justify-between border-b border-slate-100 pb-2">
                 <span className="text-slate-500">Base Rate</span>
                 <span className="font-medium">{formatMoney(member.actual_rate)}</span>
               </div>
               <div className="flex justify-between border-b border-slate-100 pb-2">
                 <span className="text-slate-500">Discount Applied</span>
                 <span className="text-red-500">-{formatMoney(member.discount)}</span>
               </div>
               <div className="flex justify-between border-b border-slate-100 pb-2">
                 <span className="text-slate-900 font-bold">Net Amount</span>
                 <span className="font-bold text-indigo-600 text-lg">{formatMoney(member.net_amount)}</span>
               </div>
               
               <div className="pt-2 bg-slate-50 p-3 rounded text-sm space-y-2">
                 <div className="flex justify-between">
                    <span className="text-slate-500">Daily Rev. Rec.</span>
                    <span className="font-mono">{currency?.symbol || '$'} {member.daily_rate.toFixed(2)} / day</span>
                 </div>
                 <div className="flex justify-between">
                    <span className="text-slate-500">Revenue Model</span>
                    <span>Straight-Line</span>
                 </div>
               </div>
             </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
};

export default Members;
