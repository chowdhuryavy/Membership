
import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  Building2,
  RefreshCcw,
  Clock,
  ArrowRight,
  TrendingUp,
  SearchCode,
  Info,
  Calendar,
  ArrowLeft,
  UserCheck,
  UserPlus,
  Zap,
  RotateCcw,
  ShieldCheck,
  UserSearch,
  XCircle,
  Command
} from 'lucide-react';
import { db } from '../services/mockSupabase';
import { Member, MembershipCategory, MemberStatus, Freeze } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, differenceInCalendarDays, addDays, isAfter, isBefore, isEqual, startOfDay } from 'date-fns';
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
  const { currentOutlet, currentProperty, formatMoney, hasPermission, checkShortcut } = useSettings();
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<MemberStatus | 'All' | 'Renewed'>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [lastSavedMember, setLastSavedMember] = useState<Member | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isRenewal, setIsRenewal] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [autoFreeze, setAutoFreeze] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Shortcut Listener for List View
  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
        if (view === 'list') {
            if (checkShortcut(e, 'action_create')) {
                e.preventDefault();
                handleAddNew();
            }
            if (checkShortcut(e, 'global_search')) {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [view, canCreate]);

  // Helper to determine real-time status (handles auto-expiry)
  const getEffectiveStatus = (member: Member) => {
      // Frozen and Pending status override date logic
      if (member.status === MemberStatus.FROZEN || member.status === MemberStatus.PENDING) {
          return member.status;
      }
      
      const end = parseISO(member.current_end_date);
      const today = startOfDay(new Date());
      
      // If end date is before today (meaning it expired yesterday or earlier), treat as expired
      if (isBefore(end, today)) {
          return MemberStatus.EXPIRED;
      }
      
      return MemberStatus.ACTIVE;
  };

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
      setIsRenewal(false);
      setView('form');
  };

  const handleRenew = (member: Member, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canCreate) return;
    setSelectedMember(member);
    setIsEditing(false);
    setIsRenewal(true);
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
      setIsRenewal(false);
      setView('form');
  };

  const handleFormSuccess = (member: Member) => {
      loadData();
      setLastSavedMember(member);
      setView('list'); 
  };

  const filteredMembers = useMemo(() => {
    // Pre-calculate membership frequency for the "Renewed" filter
    const membershipCounts = members.reduce((acc, m) => {
        acc[m.membership_number] = (acc[m.membership_number] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return members.filter(m => {
      const matchesSearch = 
        m.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        m.membership_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.check_no && m.check_no.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const effectiveStatus = getEffectiveStatus(m);

      let matchesStatus = false;
      if (statusFilter === 'All') {
          matchesStatus = true;
      } else if (statusFilter === 'Renewed') {
          matchesStatus = membershipCounts[m.membership_number] > 1;
      } else {
          matchesStatus = effectiveStatus === statusFilter;
      }
      
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

  const StatusChip = ({ status, active, onClick, icon: Icon, colorClass }: any) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
        active 
          ? `${colorClass || 'bg-indigo-600 border-indigo-600 text-white'} shadow-lg shadow-indigo-200` 
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
            <div className="shrink-0">
                 <h1 className="text-5xl font-black text-slate-900 tracking-tighter">Members</h1>
                 <p className="text-sm font-medium text-slate-500 mt-2 italic">Active portfolio for <span className="text-indigo-600 font-bold">{currentOutlet?.name}</span></p>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative group flex-1 md:min-w-[320px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                    ref={searchInputRef}
                    placeholder="Search name, ID, or reference..." 
                    className="w-full h-12 pl-12 pr-4 rounded-2xl bg-white border border-slate-200 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-sm font-bold placeholder:text-slate-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className={`h-12 px-5 rounded-2xl border-slate-200 ${showFilters ? 'bg-slate-100 text-indigo-600 border-indigo-200 shadow-inner' : ''}`}>
                <Filter className="w-4 h-4 mr-2" /> 
                <span className="hidden sm:inline">Advanced</span>
              </Button>
              
              {canCreate && (
                <Button onClick={handleAddNew} className="h-12 px-6 rounded-2xl shadow-xl shadow-indigo-100 font-black tracking-tight">
                    <Plus className="w-5 h-5 mr-1" /> Add Members
                </Button>
              )}
            </div>
          </div>

          <Card className={`border-slate-200/60 shadow-sm transition-all overflow-hidden ${showFilters ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 border-none py-0'}`}>
            <CardContent className="p-6 space-y-6 bg-slate-50/50">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lifecycle Status Filter</label>
                  <div className="flex flex-wrap gap-2">
                    <StatusChip status="All" active={statusFilter === 'All'} onClick={() => setStatusFilter('All')} />
                    <StatusChip status="Active" active={statusFilter === MemberStatus.ACTIVE} onClick={() => setStatusFilter(MemberStatus.ACTIVE)} icon={CheckCircle2} />
                    <StatusChip status="Frozen" active={statusFilter === MemberStatus.FROZEN} onClick={() => setStatusFilter(MemberStatus.FROZEN)} icon={Snowflake} />
                    <StatusChip status="Expired" active={statusFilter === MemberStatus.EXPIRED} onClick={() => setStatusFilter(MemberStatus.EXPIRED)} icon={Clock} colorClass="bg-red-600 border-red-600 text-white" />
                    <StatusChip status="Renewed" active={statusFilter === 'Renewed'} onClick={() => setStatusFilter('Renewed')} icon={RefreshCcw} colorClass="bg-emerald-600 border-emerald-600 text-white" />
                  </div>
                </div>
              </div>

              {(statusFilter !== 'All' || categoryFilter !== 'All') && (
                <div className="flex justify-between items-center pt-4 border-t border-slate-200/60">
                  <p className="text-xs text-slate-500 font-medium italic">
                    Applying lifecycle filters to current repository view
                  </p>
                  <button onClick={resetFilters} className="text-xs font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1">
                    <X className="w-3 h-3" /> Clear Filters
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-8">
            {groupedMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
                        <SearchCode className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">No Matches Found</h3>
                    <p className="text-sm text-slate-500 mt-2 max-w-sm">We couldn't find any members matching your status criteria. Try a different lifecycle filter or tier scope.</p>
                    <button onClick={resetFilters} className="mt-6 text-xs font-black text-indigo-600 uppercase tracking-widest border-b-2 border-indigo-200 pb-1">Reset Search Parameters</button>
                </div>
            ) : groupedMembers.map((group) => (
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
                        <span className="bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter shadow-md shadow-indigo-100">
                            {group.members.length} {group.members.length === 1 ? 'Record' : 'Records'}
                        </span>
                    </div>
                    {group.members.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 font-medium italic">No matching members in this tier.</div>
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
                                {(canEdit || canDelete || canCreate) && <th className="px-8 py-4 text-center">Operations</th>}
                            </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                            {group.members.map((member) => {
                                const effectiveStatus = getEffectiveStatus(member);
                                return (
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
                                    ${effectiveStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                        effectiveStatus === 'Frozen' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 
                                        effectiveStatus === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                                        effectiveStatus === 'Expired' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                                    {effectiveStatus}
                                    </span>
                                </td>
                                <td className="px-8 py-5 text-slate-500 font-medium">{member.start_date}</td>
                                <td className="px-8 py-5 text-indigo-600 font-black tracking-tight">{member.current_end_date}</td>
                                <td className="px-8 py-5 text-right font-black tabular-nums">{formatMoney(member.net_amount)}</td>
                                {(canEdit || canDelete || canCreate) && (
                                  <td className="px-8 py-5">
                                      <div className="flex justify-center gap-1" onClick={e => e.stopPropagation()}>
                                          {canCreate && <button type="button" title="Renew Membership" onClick={(e) => handleRenew(member, e)} className="p-2 text-slate-400 hover:text-emerald-600 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 transition-all"><RefreshCcw className="w-4 h-4" /></button>}
                                          {canEdit && <button type="button" title="Freeze Account" onClick={(e) => handleFreezeClick(member, e)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 transition-all"><Snowflake className="w-4 h-4" /></button>}
                                          {canEdit && <button type="button" title="Edit Profile" onClick={(e) => handleEdit(member, e)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 transition-all"><Edit2 className="w-4 h-4" /></button>}
                                          {canDelete && <button type="button" title="Delete Profile" onClick={(e) => { setDeleteId(member.id); }} className="p-2 text-slate-400 hover:text-red-600 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 transition-all"><Trash2 className="w-4 h-4" /></button>}
                                      </div>
                                  </td>
                                )}
                                </tr>
                            )})}
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
          members={members}
          existingMember={isEditing || isRenewal ? selectedMember : null}
          isRenewal={isRenewal}
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
          categories={categories}
          initialFreeze={autoFreeze}
          getEffectiveStatus={getEffectiveStatus}
          onBack={() => { setView('list'); setSelectedMember(null); setAutoFreeze(false); }}
          onUpdate={() => { loadData(); setAutoFreeze(false); }} 
          onRenew={() => { setIsRenewal(true); setView('form'); }}
        />
      )}
    </div>
  );
};

const MemberForm = ({ categories, members, existingMember, isRenewal, currentOutletId, onCancel, onSuccess, canCreate, canEdit }: { categories: MembershipCategory[], members: Member[], existingMember: Member | null, isRenewal?: boolean, currentOutletId: string, onCancel: () => void, onSuccess: (m: Member) => void, canCreate: boolean | null, canEdit: boolean | null }) => {
  const { formatMoney, currency, checkShortcut } = useSettings();
  
  const initialStartDate = useMemo(() => {
    if (isRenewal && existingMember) {
        const nextDay = addDays(parseISO(existingMember.current_end_date), 1);
        return format(nextDay, 'yyyy-MM-dd');
    }
    return format(new Date(), 'yyyy-MM-dd');
  }, [isRenewal, existingMember]);

  const { register, handleSubmit, watch, setValue, resetField, setError, formState: { errors } } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: (existingMember && !isRenewal) ? {
        membership_number: existingMember.membership_number,
        guest_name: existingMember.guest_name,
        category_id: existingMember.category_id,
        start_date: existingMember.start_date,
        discount: existingMember.discount,
        check_no: existingMember.check_no
    } : {
      membership_number: existingMember?.membership_number || '',
      guest_name: existingMember?.guest_name || '',
      discount: 0,
      start_date: initialStartDate
    }
  });

  // Form Shortcuts
  useEffect(() => {
    const handleFormShortcuts = (e: KeyboardEvent) => {
        if (checkShortcut(e, 'action_save')) {
            e.preventDefault();
            handleSubmit(onSubmit)();
        }
        if (checkShortcut(e, 'action_cancel')) {
            e.preventDefault();
            onCancel();
        }
    };
    window.addEventListener('keydown', handleFormShortcuts);
    return () => window.removeEventListener('keydown', handleFormShortcuts);
  }, [handleSubmit, onCancel]);

  const categoryId = watch('category_id');
  const startDate = watch('start_date');
  const discount = watch('discount');
  const membershipNumber = watch('membership_number');

  // SMART RETRIEVAL LOGIC
  const matchedMember = useMemo(() => {
    // We only pull data if we are NOT in edit mode (except for manual renewal typing)
    if (existingMember && !isRenewal) return null; 
    if (!membershipNumber || membershipNumber.trim().length < 2) return null;
    return members.find(m => m.membership_number.trim().toLowerCase() === membershipNumber.trim().toLowerCase());
  }, [membershipNumber, members, existingMember, isRenewal]);

  // EFFECT: Handle Auto-Sync and Auto-Reset
  useEffect(() => {
    // If we're editing a specific record (not renewal), don't trigger auto-sync
    if (existingMember && !isRenewal) return;

    if (matchedMember) {
        // ID Matched: Pull Data
        setValue('guest_name', matchedMember.guest_name);
        setValue('category_id', matchedMember.category_id);
        
        // Default to current date as requested
        setValue('start_date', format(new Date(), 'yyyy-MM-dd'));
        
        // Feedback
        console.log(`Identity Sync: Found ${matchedMember.guest_name}. Start date defaulted to today.`);
    } else if (!membershipNumber || membershipNumber.trim() === '') {
        // ID Cleared: Perform Clean Slate Reset
        resetField('guest_name');
        resetField('category_id');
        resetField('discount');
        resetField('check_no');
        setValue('start_date', format(new Date(), 'yyyy-MM-dd'));
    }
  }, [matchedMember, membershipNumber, setValue, resetField, existingMember, isRenewal]);

  const selectedCategory = categories.find((c: any) => c.id === categoryId);
  const baseRate = selectedCategory?.base_rate || 0;
  const netAmount = Math.max(0, baseRate - (Number(discount) || 0));
  
  let endDateStr = '';
  let dailyRate = 0;

  if (startDate && selectedCategory) {
    const start = parseISO(startDate);
    const end = RevenueEngine.calculateOriginalEndDate(start, selectedCategory.duration_months);
    endDateStr = format(end, 'yyyy-MM-dd');
    dailyRate = RevenueEngine.calculateDailyRate(netAmount, start, end);
  }

  const effectiveRefMember = matchedMember || existingMember;
  const isInternalRenewal = isRenewal || !!matchedMember;

  const continuityStatus = useMemo(() => {
      if (!isInternalRenewal || !effectiveRefMember || !startDate) return null;
      const currentEnd = parseISO(effectiveRefMember.current_end_date);
      const newStart = parseISO(startDate);
      const idealStart = addDays(currentEnd, 1);
      return { 
        isContinuous: isEqual(newStart, idealStart),
        isGap: isAfter(newStart, idealStart),
        isOverlap: isBefore(newStart, currentEnd) || isEqual(newStart, currentEnd),
        gapDays: differenceInCalendarDays(newStart, idealStart)
      };
  }, [isInternalRenewal, effectiveRefMember, startDate]);

  const onSubmit = async (data: MemberFormValues) => {
    if (!currentOutletId) return;
    
    // Safety check for renewals (warning only, but allowing manual override since "can change")
    if (isInternalRenewal && effectiveRefMember) {
        const currentEnd = parseISO(effectiveRefMember.current_end_date);
        const newStart = parseISO(data.start_date);
    }

    const isEditMode = existingMember && !isRenewal;
    const payload: Member = {
      id: isEditMode ? existingMember.id : crypto.randomUUID(),
      outlet_id: currentOutletId,
      membership_number: data.membership_number,
      guest_name: data.guest_name,
      category_id: data.category_id,
      start_date: data.start_date,
      original_end_date: endDateStr,
      current_end_date: endDateStr,
      actual_rate: baseRate,
      discount: data.discount,
      net_amount: netAmount,
      daily_rate: dailyRate,
      check_no: data.check_no,
      status: isEditMode ? existingMember.status : MemberStatus.ACTIVE
    };

    try {
      if (isEditMode) {
        await db.updateMember(existingMember.id, payload);
      } else {
        await db.addMember(payload);
      }
      onSuccess(payload);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Card className="max-w-4xl mx-auto rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
      <CardHeader className={`${(isInternalRenewal) ? 'bg-indigo-950 shadow-inner' : 'bg-slate-900'} text-white p-8 relative transition-all duration-500`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 ${isInternalRenewal ? 'bg-indigo-500/20' : 'bg-white/10'} rounded-2xl flex items-center justify-center transition-colors`}>
            {isInternalRenewal ? <RefreshCcw className="w-6 h-6 text-indigo-400 animate-in spin-in-180" /> : <UserPlus className="w-6 h-6 text-indigo-400" />}
          </div>
          <div>
            <CardTitle className="text-2xl font-black tracking-tight">
              {isRenewal ? 'Renew Membership' : matchedMember ? 'Process Re-Enrollment' : existingMember ? 'Edit Profile' : 'New Enrollment'}
            </CardTitle>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Lifecycle Management Console</p>
          </div>
        </div>
        <button onClick={onCancel} className="absolute top-8 right-8 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
          <X className="w-6 h-6" />
        </button>
      </CardHeader>
      
      <CardContent className="p-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          
          {/* Identity Sync Indicator */}
          {matchedMember && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-[1.8rem] p-6 flex flex-col md:flex-row justify-between items-center gap-4 animate-in zoom-in-95 duration-500">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                        <History className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-emerald-900 uppercase tracking-widest flex items-center gap-2">
                           <Zap className="w-3 h-3 fill-emerald-600" /> Identity Matched
                        </h4>
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">
                            Guest History: Active from <span className="font-black underline">{matchedMember.start_date}</span> to <span className="font-black underline">{matchedMember.current_end_date}</span>
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-white border border-emerald-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-emerald-700">
                        {categories.find(c => c.id === matchedMember.category_id)?.name || 'Prev. Tier'}
                    </span>
                    <button type="button" title="Clear ID" onClick={() => resetField('membership_number')} className="p-2 text-emerald-400 hover:text-red-500 transition-colors">
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                 <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Membership No. / ID</label>
                    {!membershipNumber && (
                        <span className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                           Type ID to pull profile
                        </span>
                    )}
                 </div>
                 <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                        <UserSearch className={`w-4 h-4 transition-colors ${matchedMember ? 'text-emerald-500' : 'text-slate-400'}`} />
                    </div>
                    <Input 
                        {...register('membership_number')} 
                        readOnly={isRenewal} 
                        error={errors.membership_number?.message} 
                        className={`h-12 pl-11 rounded-xl font-bold transition-all ${matchedMember ? 'border-emerald-500 ring-2 ring-emerald-500/10' : ''}`} 
                    />
                 </div>
              </div>
              
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Guest Profile Name</label>
                 <Input 
                    {...register('guest_name')} 
                    readOnly={isRenewal || !!matchedMember} 
                    error={errors.guest_name?.message} 
                    className={`h-12 rounded-xl font-bold transition-all ${matchedMember ? 'bg-slate-50 border-indigo-200 text-slate-600' : ''}`} 
                 />
              </div>

              <Input label="Reference / Check No. (Audit)" {...register('check_no')} className="h-12 rounded-xl font-bold" />
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Membership Tier</label>
                <select 
                  {...register('category_id')} 
                  className={`flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all ${matchedMember ? 'border-indigo-200' : ''} ${errors.category_id ? 'border-red-500' : ''}`}
                >
                  <option value="">Select Category...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.category_id && <p className="text-xs text-red-500">{errors.category_id.message}</p>}
                {matchedMember && matchedMember.category_id !== categoryId && categoryId && (
                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-600 uppercase mt-1">
                        <Info className="w-3 h-3" /> Tier adjustment selected for re-enrollment
                    </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Effective Start Date</label>
                    {isInternalRenewal && effectiveRefMember && (
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Defaulted to Today</span>
                    )}
                </div>
                <input 
                  type="date" 
                  {...register('start_date')} 
                  className={`flex h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all ${errors.start_date ? 'border-red-500' : ''}`}
                />
                {errors.start_date && <p className="text-xs text-red-500 mt-1">{errors.start_date.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Discount Allocation ({currency?.symbol || '$'})</label>
                <Input type="number" step="0.01" {...register('discount', { valueAsNumber: true })} className="h-12 rounded-xl font-bold" />
              </div>
            </div>
          </div>

          {continuityStatus && (
              <div className={`p-5 rounded-[2rem] flex items-center gap-4 border shadow-sm animate-in slide-in-from-top-2 duration-500 ${continuityStatus.isOverlap ? 'bg-red-50 border-red-100 text-red-700' : continuityStatus.isGap ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
                  <div className={`p-2 rounded-xl ${continuityStatus.isOverlap ? 'bg-red-100' : continuityStatus.isGap ? 'bg-amber-100' : 'bg-indigo-100'}`}>
                    {continuityStatus.isGap ? <Clock className="w-5 h-5"/> : continuityStatus.isOverlap ? <AlertCircle className="w-5 h-5"/> : <ShieldCheck className="w-5 h-5"/>}
                  </div>
                  <div>
                      <h5 className="text-[10px] font-black uppercase tracking-widest mb-0.5">Timeline Integrity Audit</h5>
                      <p className="text-xs font-bold leading-none">
                          {continuityStatus.isGap ? `Retention Gap: ${continuityStatus.gapDays} days after previous record.` : 
                           continuityStatus.isOverlap ? `Notice: Overlapping previous term (Exp: ${effectiveRefMember?.current_end_date})` : 
                           'Secured: Continuity verified with previous profile.'}
                      </p>
                  </div>
              </div>
          )}

          <div className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-200/60 grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base Rate</p>
                  <p className="text-sm font-black text-slate-900">{formatMoney(baseRate)}</p>
              </div>
              <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Net Revenue</p>
                  <p className="text-sm font-black text-indigo-600">{formatMoney(netAmount)}</p>
              </div>
              <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Expected Expiry</p>
                  <p className="text-sm font-black text-slate-900">{endDateStr || '---'}</p>
              </div>
              <div className="space-y-1">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Daily Accrual</p>
                  <p className="text-sm font-black text-emerald-600">{formatMoney(dailyRate)}/Day</p>
              </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="button" variant="secondary" onClick={onCancel} className="flex-1 h-14 rounded-2xl font-bold bg-white border-slate-200">
                <span className="flex items-center gap-2"><Command className="w-3 h-3 text-slate-400"/> Cancel</span>
            </Button>
            <Button type="submit" className={`flex-1 h-14 rounded-2xl font-black text-base shadow-xl transition-all ${isInternalRenewal ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' : 'shadow-indigo-100'}`}>
              <span className="flex items-center gap-2">
                {isRenewal ? 'Commit Renewal' : matchedMember ? 'Finalize Re-Enrollment' : existingMember ? 'Sync Profile' : 'Confirm Enrollment'}
                <Command className="w-3 h-3 opacity-50"/>
              </span>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

const MemberDetail = ({ member, categories, initialFreeze, getEffectiveStatus, onBack, onUpdate, onRenew }: { member: Member, categories: MembershipCategory[], initialFreeze: boolean, getEffectiveStatus: (m: Member) => string, onBack: () => void, onUpdate: () => void, onRenew: () => void }) => {
  const { formatMoney, hasPermission } = useSettings();
  const { user } = useAuth();
  const [freezes, setFreezes] = useState<Freeze[]>([]);
  const [showFreezeModal, setShowFreezeModal] = useState(initialFreeze);
  const [freezeForm, setFreezeForm] = useState({ start_date: format(new Date(), 'yyyy-MM-dd'), end_date: '' });
  const [history, setHistory] = useState<Member[]>([]);

  useEffect(() => {
    const loadHistory = async () => {
      if (member.membership_number) {
        const historyData = await db.getMemberHistory(member.membership_number);
        setHistory(historyData);
      }
    };
    loadHistory();
  }, [member.membership_number]);

  useEffect(() => {
    loadFreezes();
  }, [member.id]);

  const loadFreezes = async () => {
    const f = await db.getFreezes(member.id);
    setFreezes(f);
  };

  const handleAddFreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freezeForm.start_date || !freezeForm.end_date) return;
    
    const start = parseISO(freezeForm.start_date);
    const end = parseISO(freezeForm.end_date);
    
    if (end < start) {
        alert("End date cannot be before start date");
        return;
    }

    const totalDays = differenceInCalendarDays(end, start) + 1;
    const isOverlap = RevenueEngine.checkFreezeOverlap(start, end, freezes);
    
    if (isOverlap) {
        alert("This period overlaps with an existing Freezing.");
        return;
    }

    const freeze: Freeze = {
        id: crypto.randomUUID(),
        member_id: member.id,
        start_date: freezeForm.start_date,
        end_date: freezeForm.end_date,
        total_days: totalDays
    };

    try {
        await db.addFreeze(freeze);
        setShowFreezeModal(false);
        loadFreezes();
        onUpdate();
    } catch (err) {
        console.error(err);
    }
  };

  const deleteFreeze = async (id: string) => {
    await db.deleteFreeze(id);
    loadFreezes();
    onUpdate();
  };

  const catName = categories.find(c => c.id === member.category_id)?.name || 'Unknown Tier';
  const canEdit = user && hasPermission(user.role_id, 'members:edit');
  const effectiveStatus = getEffectiveStatus(member);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
        <button onClick={onBack} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Directory
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                    <div className="h-32 bg-slate-900 w-full relative">
                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '16px 16px' }}></div>
                    </div>
                    <CardContent className="px-8 pb-8 -mt-12 text-center relative z-10">
                        <div className="inline-flex p-1.5 bg-white rounded-3xl shadow-xl mb-4">
                            <div className="w-24 h-24 bg-indigo-600 rounded-[1.8rem] flex items-center justify-center text-white text-4xl font-black">
                                {member.guest_name.charAt(0)}
                            </div>
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{member.guest_name}</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">ID: {member.membership_number}</p>
                        
                        <div className="mt-6 flex flex-wrap justify-center gap-2">
                             <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${effectiveStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                effectiveStatus === 'Frozen' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                effectiveStatus === 'Expired' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                                {effectiveStatus}
                             </span>
                             <span className="px-4 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-full text-[10px] font-black uppercase tracking-widest">
                                {catName}
                             </span>
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-100 grid grid-cols-2 gap-4">
                            <div className="text-center">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Recognition</p>
                                <p className="text-xs font-black text-slate-900">{formatMoney(member.daily_rate)}/Day</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Net Fees</p>
                                <p className="text-xs font-black text-indigo-600">{formatMoney(member.net_amount)}</p>
                            </div>
                        </div>

                        {canEdit && (
                            <div className="mt-8 flex gap-2">
                                <Button onClick={onRenew} className="flex-1 rounded-xl font-bold h-11 text-xs">Renew</Button>
                                <Button variant="outline" onClick={() => setShowFreezeModal(true)} className="flex-1 rounded-xl font-bold h-11 text-xs border-slate-200">Freeze</Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="lg:col-span-2 space-y-8">
                <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden">
                    <CardHeader className="p-8 border-b border-slate-100 flex items-center justify-between">
                        <CardTitle className="text-lg font-black tracking-tight flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-indigo-600" /> Operational History
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Enrollment Date</p>
                                <p className="font-bold text-slate-900">{member.start_date}</p>
                            </div>
                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Original End Date</p>
                                <p className="font-bold text-slate-900">{member.original_end_date}</p>
                            </div>
                            <div className="p-5 bg-indigo-50 rounded-2xl border border-indigo-100">
                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">Current Expiry</p>
                                <p className="font-bold text-indigo-700">{member.current_end_date}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                <Snowflake className="w-4 h-4 text-indigo-600" /> Freezing Ledger
                            </h4>
                            {freezes.length === 0 ? (
                                <div className="p-10 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                                    <p className="text-xs font-medium text-slate-400">No Freezing history recorded for this account.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                                    {freezes.map(fz => (
                                        <div key={fz.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2 bg-white shadow-sm border border-slate-100 rounded-lg">
                                                    <Clock className="w-4 h-4 text-indigo-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-700">{fz.start_date} &rarr; {fz.end_date}</p>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{fz.total_days} Total Days Deferred</p>
                                                </div>
                                            </div>
                                            {canEdit && (
                                                <button onClick={() => deleteFreeze(fz.id)} className="p-2 text-slate-300 hover:text-red-600 transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {history.length > 1 && (
                    <Card className="rounded-[2.5rem] border-slate-200/60 shadow-lg overflow-hidden">
                        <CardHeader className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <CardTitle className="text-lg font-black tracking-tight flex items-center gap-3">
                                <History className="w-5 h-5 text-indigo-600" /> Lifecycle History
                            </CardTitle>
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {history.length} Total Records
                            </span>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100">
                                {history.map(histMember => {
                                    const isCurrent = histMember.id === member.id;
                                    const histCatName = categories.find(c => c.id === histMember.category_id)?.name || 'Unknown Tier';
                                    const histStatus = getEffectiveStatus(histMember);
                                    return (
                                        <div key={histMember.id} className={`p-6 flex items-center justify-between transition-colors ${isCurrent ? 'bg-indigo-50' : 'hover:bg-slate-50/70'}`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm ${isCurrent ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 border-slate-200'}`}>
                                                    <Layers className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h5 className="font-bold text-sm tracking-tight text-slate-800">{histCatName}</h5>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                        {histMember.start_date} &rarr; {histMember.current_end_date}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                                                    histStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                                    histStatus === 'Frozen' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                                    histStatus === 'Expired' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-50 text-slate-700 border-slate-200'
                                                }`}>{histStatus}</span>
                                                <p className="font-black text-xs text-slate-600 mt-1.5 tabular-nums">{formatMoney(histMember.net_amount)}</p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>

        {showFreezeModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                <Card className="max-w-md w-full rounded-[2.5rem] border-slate-200/60 shadow-2xl overflow-hidden animate-in zoom-in-95">
                    <CardHeader className="bg-slate-900 text-white p-6 relative">
                        <CardTitle className="text-lg font-black tracking-tight">Freeze Account</CardTitle>
                        <button onClick={() => setShowFreezeModal(false)} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><X className="w-5 h-5"/></button>
                    </CardHeader>
                    <CardContent className="p-8">
                        <form onSubmit={handleAddFreeze} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Freezing</label>
                                <Input type="date" value={freezeForm.start_date} onChange={e => setFreezeForm({...freezeForm, start_date: e.target.value})} className="h-12 rounded-xl" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Freezing</label>
                                <Input type="date" value={freezeForm.end_date} onChange={e => setFreezeForm({...freezeForm, end_date: e.target.value})} className="h-12 rounded-xl" />
                            </div>
                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-start gap-3">
                                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-[10px] font-bold text-amber-800 leading-relaxed uppercase tracking-tight">
                                    Freezing automatically extend the membership expiry date by the total number of days deferred.
                                </p>
                            </div>
                            <Button type="submit" className="w-full h-14 rounded-2xl font-black shadow-xl shadow-indigo-100">Commit Freezing</Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        )}
    </div>
  );
};

export default Members;
