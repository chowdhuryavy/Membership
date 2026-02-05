
import React, { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Select, ConfirmationModal } from '../components/ui';
import { 
  Plus, 
  Search, 
  Filter, 
  Snowflake, 
  Trash2, 
  Edit2, 
  Layers, 
  AlertCircle, 
  CalendarDays,
  CalendarClock,
  X,
  CheckCircle2,
  Activity,
  History,
  Check,
  Building2
} from 'lucide-react';
import { db } from '../services/mockSupabase';
import { Member, MembershipCategory, MemberStatus, Freeze } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, differenceInCalendarDays, addDays } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';

const parseISO = (dateString: string) => new Date(dateString);

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
  const { currentOutlet, currentProperty, formatMoney, hasPermission } = useSettings();
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<MemberStatus | 'All'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [lastSavedMember, setLastSavedMember] = useState<Member | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
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
    
    if (selectedMember) {
        const updated = m.find(mem => mem.id === selectedMember.id);
        if (updated) setSelectedMember(updated);
    }
  };

  const canCreate = user && hasPermission(user.role_id, 'members:create');
  const canEdit = user && hasPermission(user.role_id, 'members:edit');
  const canDelete = user && hasPermission(user.role_id, 'members:delete');

  const confirmDelete = async () => {
      if (deleteId && canDelete) {
          await db.deleteMember(deleteId);
          loadData();
          setDeleteId(null);
          if (lastSavedMember?.id === deleteId) setLastSavedMember(null);
      }
  };

  const handleEdit = (member: Member, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!canEdit) return;
      setSelectedMember(member);
      setIsEditing(true);
      setView('form');
  };

  const handleFreezeClick = (member: Member, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!canEdit) return;
      setSelectedMember(member);
      setAutoFreeze(true);
      setView('detail');
  };

  const handleAddNew = () => {
      if (!canCreate) return;
      setSelectedMember(null);
      setIsEditing(false);
      setView('form');
  };

  const handleFormSuccess = (member: Member) => {
      loadData();
      setLastSavedMember(member);
      setView('list'); 
  };

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchesSearch = 
        m.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        m.membership_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.check_no && m.check_no.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === 'All' || m.status === statusFilter;
      const matchesCategory = categoryFilter === 'All' || m.category_id === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [members, searchTerm, statusFilter, categoryFilter]);

  const groupedMembers = useMemo(() => {
    const groups = categories.map(cat => ({
        category: cat,
        members: filteredMembers.filter(m => m.category_id === cat.id)
    })).filter(g => g.members.length > 0 || (searchTerm === '' && statusFilter === 'All' && categoryFilter === 'All'));

    const orphanMembers = filteredMembers.filter(m => !categories.find(c => c.id === m.category_id));
    if (orphanMembers.length > 0) {
        groups.push({
            category: { id: 'unknown', name: 'Uncategorized', base_rate: 0, duration_months: 0, outlet_id: currentOutlet?.id },
            members: orphanMembers
        });
    }
    return groups;
  }, [categories, filteredMembers, searchTerm, statusFilter, categoryFilter, currentOutlet]);

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('All');
    setCategoryFilter('All');
  };

  const StatusChip = ({ status, active, onClick, icon: Icon }: any) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
        active 
          ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200' 
          : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600'
      }`}
    >
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {status}
    </button>
  );

  return (
    <div className="space-y-6">
      {view === 'list' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/60 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-100">
                <Building2 className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col items-start overflow-hidden text-left">
                <span className="text-xs font-black tracking-widest w-full uppercase text-slate-400 leading-none mb-1">
                    {currentProperty?.name || 'Facility Scope'}
                </span>
                <span className="text-base font-black text-slate-900 w-full leading-tight">
                    {currentOutlet?.name || 'Select Outlet'}
                </span>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
                 <h1 className="text-5xl font-black text-slate-900 tracking-tighter">Members</h1>
                 <p className="text-sm font-medium text-slate-500 mt-2">Managing portfolio for <span className="text-indigo-600 font-bold">{currentOutlet?.name}</span></p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              {lastSavedMember && (
                <Button 
                  onClick={() => { setSelectedMember(lastSavedMember); setView('detail'); }} 
                  className="hidden md:flex flex-1 md:flex-none h-12 px-5 rounded-2xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 font-bold shadow-sm"
                >
                  <History className="w-4 h-4 mr-2" /> View Last Saved
                </Button>
              )}
              <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className={`flex-1 md:flex-none h-12 px-5 rounded-2xl border-slate-200 ${showFilters ? 'bg-slate-100 text-indigo-600 border-indigo-200' : ''}`}>
                <Filter className="w-4 h-4 mr-2" /> 
                Filters
              </Button>
              {canCreate && (
                <Button onClick={handleAddNew} className="flex-1 md:flex-none h-12 px-6 rounded-2xl shadow-xl shadow-indigo-100 font-bold">
                    <Plus className="w-5 h-5 mr-2" /> Add Member
                </Button>
              )}
            </div>
          </div>

          <Card className={`border-slate-200/60 shadow-sm transition-all overflow-hidden ${showFilters ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 border-none py-0'}`}>
            <CardContent className="p-6 space-y-6 bg-slate-50/50">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Universal Search</label>
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input 
                        placeholder="Name, ID, or Reference" 
                        className="w-full h-12 pl-11 pr-4 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-sm font-medium"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tier Filter</label>
                  <select 
                    className="w-full h-12 px-4 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-sm font-medium appearance-none"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value="All">All Tiers</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status Filter</label>
                  <div className="flex flex-wrap gap-2">
                    <StatusChip status="All" active={statusFilter === 'All'} onClick={() => setStatusFilter('All')} />
                    <StatusChip status="Active" active={statusFilter === MemberStatus.ACTIVE} onClick={() => setStatusFilter(MemberStatus.ACTIVE)} icon={CheckCircle2} />
                    <StatusChip status="Frozen" active={statusFilter === MemberStatus.FROZEN} onClick={() => setStatusFilter(MemberStatus.FROZEN)} icon={Snowflake} />
                  </div>
                </div>
              </div>

              {(searchTerm || statusFilter !== 'All' || categoryFilter !== 'All') && (
                <div className="flex justify-between items-center pt-4 border-t border-slate-200/60">
                  <p className="text-xs text-slate-500 font-medium italic">
                    Found <span className="font-bold text-indigo-600">{filteredMembers.length}</span> members
                  </p>
                  <button onClick={resetFilters} className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                    <X className="w-3 h-3" /> Clear All
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-8">
            {groupedMembers.map((group) => (
                <Card key={group.category.id} className="overflow-hidden border-slate-200/60 shadow-sm group">
                    <div className="bg-slate-50/80 px-4 md:px-8 py-4 border-b border-slate-200/60 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-white rounded-lg border border-slate-200">
                              <Layers className="w-4 h-4 text-indigo-600" />
                            </div>
                            <div>
                              <h3 className="font-black text-slate-800 tracking-tight uppercase text-xs">{group.category.name}</h3>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Base: {formatMoney(group.category.base_rate)}</p>
                            </div>
                        </div>
                        <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">
                            {group.members.length} Total
                        </span>
                    </div>
                    {group.members.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 font-medium italic">No members in this tier matching criteria.</div>
                    ) : (
                        <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left min-w-[700px]">
                            <thead className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] border-b border-slate-100 bg-slate-50/30">
                            <tr>
                                <th className="px-8 py-4">Membership #</th>
                                <th className="px-8 py-4">Guest Profile</th>
                                <th className="px-8 py-4">Status</th>
                                <th className="px-8 py-4">Start Date</th>
                                <th className="px-8 py-4">Expiry Date</th>
                                <th className="px-8 py-4 text-right">Net Amount</th>
                                {(canEdit || canDelete) && <th className="px-8 py-4 text-center">Operations</th>}
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                            {group.members.map((member) => (
                                <tr 
                                    key={member.id} 
                                    className="hover:bg-indigo-50/30 cursor-pointer transition-colors"
                                    onClick={() => { setSelectedMember(member); setView('detail'); }}
                                >
                                <td className="px-8 py-5 font-black text-slate-900 tracking-tighter">{member.membership_number}</td>
                                <td className="px-8 py-5">
                                    <div className="font-bold text-slate-700">{member.guest_name}</div>
                                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{member.check_no || 'Ref: N/A'}</div>
                                </td>
                                <td className="px-8 py-5">
                                    <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border
                                    ${member.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                        member.status === 'Frozen' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                    {member.status}
                                    </span>
                                </td>
                                <td className="px-8 py-5 text-slate-500 font-medium">{member.start_date}</td>
                                <td className="px-8 py-5 text-indigo-600 font-black tracking-tight">{member.current_end_date}</td>
                                <td className="px-8 py-5 text-right font-black tabular-nums">{formatMoney(member.net_amount)}</td>
                                {(canEdit || canDelete) && (
                                  <td className="px-8 py-5">
                                      <div className="flex justify-center gap-1" onClick={e => e.stopPropagation()}>
                                          {canEdit && <button type="button" onClick={(e) => handleFreezeClick(member, e)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 transition-all"><Snowflake className="w-4 h-4" /></button>}
                                          {canEdit && <button type="button" onClick={(e) => handleEdit(member, e)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 transition-all"><Edit2 className="w-4 h-4" /></button>}
                                          {canDelete && <button type="button" onClick={(e) => { setDeleteId(member.id); }} className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 transition-all"><Trash2 className="w-4 h-4" /></button>}
                                      </div>
                                  </td>
                                )}
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        </div>
                    )}
                </Card>
            ))}
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
          onSuccess={handleFormSuccess} 
          canCreate={canCreate}
          canEdit={canEdit}
        />
      )}

      {view === 'detail' && selectedMember && (
        <MemberDetail 
          member={selectedMember} 
          initialFreeze={autoFreeze}
          onBack={() => { setView('list'); setSelectedMember(null); setAutoFreeze(false); }}
          onUpdate={() => { loadData(); setAutoFreeze(false); }} 
        />
      )}
    </div>
  );
};

const MemberForm = ({ categories, existingMember, currentOutletId, onCancel, onSuccess, canCreate, canEdit }: { categories: MembershipCategory[], existingMember: Member | null, currentOutletId: string, onCancel: () => void, onSuccess: (m: Member) => void, canCreate: boolean | null, canEdit: boolean | null }) => {
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

  const selectedCategory = categories.find((c: any) => c.id === categoryId);
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
    // Strict permission guard
    if (existingMember && !canEdit) return;
    if (!existingMember && !canCreate) return;

    if (!selectedCategory || !endDateStr) return;
    const memberId = existingMember ? existingMember.id : `mem_${Date.now()}`;
    const memberData: Member = {
      id: memberId,
      outlet_id: currentOutletId, 
      membership_number: data.membership_number,
      guest_name: data.guest_name,
      category_id: data.category_id,
      start_date: data.start_date,
      original_end_date: endDateStr, 
      current_end_date: existingMember ? existingMember.current_end_date : endDateStr,  
      actual_rate: selectedCategory.base_rate,
      discount: data.discount,
      net_amount: netAmount,
      daily_rate: dailyRate,
      check_no: data.check_no,
      status: existingMember ? existingMember.status : MemberStatus.ACTIVE
    };
    existingMember ? await db.updateMember(memberId, memberData) : await db.addMember(memberData);
    onSuccess(memberData);
  };

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-500">
      <Card className="rounded-[2.5rem] border-slate-200/60 shadow-2xl overflow-hidden">
        <CardHeader className="bg-slate-50 border-b border-slate-100 p-6 md:p-10">
          <CardTitle className="text-2xl font-black tracking-tight text-slate-900">
            {existingMember ? 'Edit Profile' : 'New Enrollment'}
          </CardTitle>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Fill in the membership details</p>
        </CardHeader>
        <CardContent className="p-6 md:p-10">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Membership No.</label>
                 <Input {...register('membership_number')} error={errors.membership_number?.message} className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Guest Name</label>
                 <Input {...register('guest_name')} error={errors.guest_name?.message} className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Membership Tier</label>
                 <Select options={[{ value: '', label: 'Select Tier...' }, ...categories.map((c: any) => ({ value: c.id, label: `${c.name} (${formatMoney(c.base_rate)})` }))]} {...register('category_id')} error={errors.category_id?.message} className="h-12 rounded-xl" />
              </div>
              
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                 <input 
                    type="date" 
                    {...register('start_date')}
                    onClick={(e) => {
                        try {
                            if (typeof (e.currentTarget as any).showPicker === 'function') {
                                (e.currentTarget as any).showPicker();
                            }
                        } catch (err) {}
                    }} 
                    className={`flex h-12 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-medium cursor-pointer ${errors.start_date ? 'border-red-500 focus:ring-red-500' : ''}`}
                 />
                 {errors.start_date?.message && <p className="text-xs text-red-500 mt-1">{errors.start_date.message}</p>}
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Expiry (Auto)</label>
                 <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                        <CalendarClock className="w-5 h-5" />
                    </div>
                    <input 
                        value={endDateStr || '-'} 
                        disabled 
                        className="flex h-12 w-full rounded-xl border border-slate-100 bg-slate-50 pl-12 pr-4 py-2 text-sm text-slate-500 font-bold focus:outline-none"
                    />
                 </div>
              </div>

              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Discount ({currency?.symbol || '$'})</label>
                 <Input type="number" {...register('discount', { valueAsNumber: true })} error={errors.discount?.message} className="h-12 rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Check / Reference (Optional)</label>
                 <Input {...register('check_no')} className="h-12 rounded-xl" />
            </div>
            
            <div className="bg-indigo-50/50 p-6 rounded-[2rem] border border-indigo-100/50 mt-4 space-y-4">
              <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Revenue Preview
              </h4>
              <div className="grid grid-cols-2 gap-y-3 gap-x-8 text-xs font-bold">
                <div className="flex justify-between"><span className="text-slate-500">Gross:</span><span className="text-slate-900">{formatMoney(baseRate)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Net:</span><span className="text-indigo-600">{formatMoney(netAmount)}</span></div>
                <div className="flex justify-between border-t border-indigo-100 pt-3"><span className="text-slate-500">Term:</span><span className="text-slate-900">{totalDays} Days</span></div>
                <div className="flex justify-between border-t border-indigo-100 pt-3"><span className="text-slate-500">Accrual:</span><span className="text-indigo-600 tabular-nums">{currency?.symbol || '$'}{dailyRate.toFixed(2)}/day</span></div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-6">
              <Button type="button" variant="secondary" onClick={onCancel} className="h-14 px-8 rounded-2xl font-bold bg-white border-slate-200">Cancel</Button>
              <Button type="submit" className="h-14 px-10 rounded-2xl font-black shadow-xl shadow-indigo-100">{existingMember ? 'Save Changes' : 'Finalize Enrollment'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

const MemberDetail = ({ member, initialFreeze = false, onBack, onUpdate }: any) => {
  const { user } = useAuth();
  const { formatMoney, currency, hasPermission } = useSettings();
  const [freezes, setFreezes] = useState<Freeze[]>([]);
  const [isFreezing, setIsFreezing] = useState(initialFreeze);
  const [editingFreezeId, setEditingFreezeId] = useState<string | null>(null);
  const [freezeStart, setFreezeStart] = useState('');
  const [freezeDays, setFreezeDays] = useState(0);
  const [error, setError] = useState('');
  const [freezeToDelete, setFreezeToDelete] = useState<string | null>(null);

  const canEdit = user && hasPermission(user.role_id, 'members:edit');

  const loadFreezes = async () => {
    const data = await db.getFreezes(member.id);
    setFreezes(data);
  };

  useEffect(() => { loadFreezes(); }, [member.id]);

  const handleAddFreeze = async () => {
    if (!canEdit) return;
    setError('');
    if (!freezeStart || freezeDays <= 0) return;
    const start = parseISO(freezeStart);
    const end = addDays(start, freezeDays - 1);
    
    // Check overlap with OTHER freezes
    const otherFreezes = editingFreezeId ? freezes.filter(f => f.id !== editingFreezeId) : freezes;
    if (RevenueEngine.checkFreezeOverlap(start, end, otherFreezes)) { setError("Overlap with existing freeze."); return; }
    
    if (editingFreezeId) {
        await db.updateFreeze(editingFreezeId, { 
          start_date: freezeStart, 
          end_date: format(end, 'yyyy-MM-dd'), 
          total_days: freezeDays 
        });
        setEditingFreezeId(null);
    } else {
        await db.addFreeze({ 
          id: `fz_${Date.now()}`, 
          member_id: member.id, 
          start_date: freezeStart, 
          end_date: format(end, 'yyyy-MM-dd'), 
          total_days: freezeDays 
        });
    }
    
    setIsFreezing(false);
    setFreezeStart('');
    setFreezeDays(0);
    loadFreezes();
    onUpdate(); 
  };

  const startEditFreeze = (fz: Freeze) => {
      setEditingFreezeId(fz.id);
      setFreezeStart(fz.start_date);
      setFreezeDays(fz.total_days);
      setIsFreezing(true);
  };

  const confirmDeleteFreeze = async () => {
      if (freezeToDelete) {
          await db.deleteFreeze(freezeToDelete);
          setFreezeToDelete(null);
          loadFreezes();
          onUpdate();
      }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
      <button onClick={onBack} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"><X className="w-4 h-4" /> Close Details</button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
            <CardHeader className="bg-slate-50 border-b border-slate-100 p-8">
              <div className="flex justify-between items-start">
                <div><CardTitle className="text-3xl font-black text-slate-900 tracking-tighter">{member.guest_name}</CardTitle><p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.3em] mt-2">ID: {member.membership_number}</p></div>
                <span className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border ${member.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : member.status === 'Frozen' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-red-50 text-red-700 border-red-200'}`}>{member.status}</span>
              </div>
            </CardHeader>
            <CardContent className="p-8 grid grid-cols-2 md:grid-cols-3 gap-8">
               <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Enrollment Date</label><p className="font-bold text-slate-700">{member.start_date}</p></div>
               <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Adjusted Expiry</label><p className="font-black text-indigo-600">{member.current_end_date}</p></div>
               <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ref No.</label><p className="font-bold text-slate-700 uppercase">{member.check_no || 'N/A'}</p></div>
            </CardContent>
          </Card>
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
            <CardHeader className="flex flex-row justify-between items-center p-8 border-b border-slate-100 bg-white">
              <div><CardTitle className="text-xl font-black text-slate-900 tracking-tight">Freeze History</CardTitle><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Lifecycle Extensions</p></div>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => { setIsFreezing(!isFreezing); setEditingFreezeId(null); }} className="rounded-xl font-black h-10 border-slate-200">
                    <Snowflake className="w-4 h-4 mr-2" /> {isFreezing && !editingFreezeId ? 'Cancel' : 'Add Freeze'}
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-8">
              {isFreezing && canEdit && (
                <div className="bg-indigo-50/50 p-6 mb-8 rounded-[1.5rem] border border-indigo-100 animate-in zoom-in-95">
                  <div className="flex justify-between items-center mb-4">
                      <h4 className="text-[10px] font-black text-indigo-900 uppercase tracking-widest">{editingFreezeId ? 'Modify Suspension' : 'New Suspension'}</h4>
                      {editingFreezeId && <button onClick={() => { setIsFreezing(false); setEditingFreezeId(null); }} className="text-indigo-400 hover:text-indigo-600"><X className="w-4 h-4"/></button>}
                  </div>
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="w-full md:flex-1 space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label><Input type="date" value={freezeStart} onChange={e => setFreezeStart(e.target.value)} className="h-12 rounded-xl bg-white border-indigo-100" /></div>
                    <div className="w-full md:flex-1 space-y-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Days</label><Input type="number" value={freezeDays} onChange={e => setFreezeDays(parseInt(e.target.value))} className="h-12 rounded-xl bg-white border-indigo-100" /></div>
                    <Button onClick={handleAddFreeze} className="w-full md:w-auto h-12 px-8 rounded-xl font-black flex items-center gap-2">
                        {editingFreezeId ? <Check className="w-4 h-4" /> : null}
                        {editingFreezeId ? 'Update' : 'Apply'}
                    </Button>
                  </div>
                  {error && <div className="text-red-600 text-[10px] font-black uppercase mt-3 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> {error}</div>}
                </div>
              )}
              {freezes.length === 0 ? (<div className="text-center py-12 text-slate-400 font-medium italic">No freeze logs found.</div>) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                                <th className="pb-4">Start Date</th>
                                <th className="pb-4">End Date</th>
                                <th className="pb-4 text-center">Duration</th>
                                {canEdit && <th className="pb-4 text-right">Operations</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {freezes.map(f => (
                                <tr key={f.id} className="group hover:bg-slate-50 transition-colors">
                                    <td className="py-4 font-bold text-slate-700">{f.start_date}</td>
                                    <td className="py-4 font-bold text-slate-700">{f.end_date}</td>
                                    <td className="py-4 text-center">
                                        <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                                            {f.total_days} Days
                                        </span>
                                    </td>
                                    {canEdit && (
                                        <td className="py-4 text-right">
                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => startEditFreeze(f)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 transition-all">
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => setFreezeToDelete(f.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 transition-all">
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-8">
           <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
             <CardHeader className="p-8 border-b border-slate-100"><CardTitle className="text-xl font-black text-slate-900 tracking-tight">Financial Summary</CardTitle></CardHeader>
             <CardContent className="p-8 space-y-6">
               <div className="flex justify-between items-center text-xs font-bold"><span className="text-slate-400 uppercase tracking-widest">Gross Rate</span><span className="text-slate-900">{formatMoney(member.actual_rate)}</span></div>
               <div className="flex justify-between items-center text-xs font-bold"><span className="text-slate-400 uppercase tracking-widest">Discount</span><span className="text-red-500">{formatMoney(member.discount)}</span></div>
               <div className="pt-4 border-t border-slate-100 flex justify-between items-center"><span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Net Recognized</span><span className="text-2xl font-black text-indigo-600 tracking-tighter tabular-nums">{formatMoney(member.net_amount)}</span></div>
               <div className="pt-6 bg-slate-50 p-6 rounded-[1.5rem] space-y-4 border border-slate-100 shadow-inner">
                 <div className="flex justify-between items-center text-[10px] font-black"><span className="text-slate-400 uppercase tracking-widest">Daily Velocity</span><span className="text-indigo-900 font-mono tracking-tighter">{currency?.symbol || '$'}{member.daily_rate.toFixed(2)} / DAY</span></div>
                 <div className="flex justify-between items-center text-[10px] font-black"><span className="text-slate-400 uppercase tracking-widest">Logic</span><span className="text-emerald-600 uppercase">Linear Extension</span></div>
               </div>
             </CardContent>
           </Card>
        </div>
      </div>
      
      <ConfirmationModal 
        isOpen={!!freezeToDelete}
        onClose={() => setFreezeToDelete(null)}
        onConfirm={confirmDeleteFreeze}
        title="Revoke Suspension"
        description="Are you sure you want to delete this freeze? The membership expiry date will be automatically adjusted (reduced) by the duration of this suspension."
        confirmText="Confirm Deletion"
        isDestructive={true}
      />
    </div>
  );
};

export default Members;