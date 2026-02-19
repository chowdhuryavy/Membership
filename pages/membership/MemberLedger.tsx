import React, { useState, useMemo } from 'react';
import { Card, Button } from '../../components/ui';
import { 
  Plus, Search, Filter, Layers, Building2, Store, RefreshCcw, 
  Milestone, Edit2, Trash2, ChevronRight, UserCircle2, ShieldCheck,
  Zap, ArrowRight, UserPlus, Snowflake, Pencil
} from 'lucide-react';
import { Member, MembershipCategory, MemberStatus } from '../../types';
import { useSettings } from '../../contexts/SettingsContext';
import { useAuth } from '../../contexts/AuthContext';
import { format, isBefore, startOfDay, parse } from 'date-fns';

const parseISO = (dateString: string) => {
  if (!dateString) return new Date();
  let d = new Date(dateString);
  if (!isNaN(d.getTime())) return d;
  try {
    return parse(dateString, 'dd-MM-yyyy', new Date());
  } catch (e) {
    return new Date();
  }
};

interface MemberLedgerProps {
  members: Member[];
  categories: MembershipCategory[];
  loading: boolean;
  viewScope: 'outlet' | 'property';
  setViewScope: (s: 'outlet' | 'property') => void;
  onAdd: () => void;
  onViewDetail: (m: Member) => void;
  onEdit: (m: Member) => void;
  onRenew: (m: Member) => void;
  onDelete: (id: string) => void;
}

const MemberLedger: React.FC<MemberLedgerProps> = ({ 
  members, categories, loading, viewScope, setViewScope, 
  onAdd, onViewDetail, onEdit, onRenew, onDelete 
}) => {
  const { user } = useAuth();
  const { currentOutlet, formatMoney, hasPermission } = useSettings();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<MemberStatus | 'All'>('All');

  const canCreate = user && hasPermission(user.role_id, 'members:create');
  const canEdit = user && hasPermission(user.role_id, 'members:edit');
  const canDelete = user && hasPermission(user.role_id, 'members:delete');
  const canSwitchScope = user && hasPermission(user.role_id, 'settings:view_properties');

  const getEffectiveStatus = (member: Member) => {
    if (member.status === MemberStatus.FROZEN || member.status === MemberStatus.PENDING || member.status === MemberStatus.TENTATIVE) {
        return member.status;
    }
    const endString = member.current_end_date || member.original_end_date;
    if (!endString) return MemberStatus.ACTIVE;
    const end = parseISO(endString);
    const today = startOfDay(new Date());
    if (isBefore(end, today)) return MemberStatus.EXPIRED;
    return MemberStatus.ACTIVE;
  };

  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      const matchesSearch = m.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           m.membership_number.toLowerCase().includes(searchTerm.toLowerCase());
      const effectiveStatus = getEffectiveStatus(m);
      let matchesStatus = (statusFilter === 'All') || (effectiveStatus === statusFilter);
      return matchesSearch && matchesStatus;
    });
  }, [members, searchTerm, statusFilter]);

  const groupedMembers = useMemo(() => {
    const groups: { category: MembershipCategory | null, members: Member[] }[] = [];
    categories.forEach(cat => {
        const matching = filteredMembers.filter(m => m.category_id === cat.id);
        if (matching.length > 0) groups.push({ category: cat, members: matching });
    });
    const uncategorized = filteredMembers.filter(m => !categories.find(c => c.id === m.category_id));
    if (uncategorized.length > 0) groups.push({ category: null, members: uncategorized });
    return groups;
  }, [categories, filteredMembers]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      
      {/* LEDGER HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-1000"><ShieldCheck className="w-64 h-64" /></div>
        <div className="flex items-center gap-6 relative z-10">
           <div className="w-16 h-16 bg-slate-900 rounded-[2rem] flex items-center justify-center text-white shadow-2xl ring-8 ring-slate-50"><Building2 className="w-8 h-8" /></div>
           <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-2">Members Ledger</h1>
              <div className="flex flex-wrap items-center gap-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2">
                    <Store className="w-3.5 h-3.5 text-indigo-400" /> {currentOutlet?.name}
                  </p>
                  {canSwitchScope && (
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button onClick={() => setViewScope('outlet')} className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all flex items-center gap-2 ${viewScope === 'outlet' ? 'bg-white text-indigo-600 shadow-md border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>
                            <Filter className="w-2.5 h-2.5" /> Outlet Scope
                        </button>
                        <button onClick={() => setViewScope('property')} className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all flex items-center gap-2 ${viewScope === 'property' ? 'bg-white text-indigo-600 shadow-md border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}>
                            <Building2 className="w-2.5 h-2.5" /> Property Portfolio
                        </button>
                    </div>
                  )}
              </div>
           </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto relative z-10">
          <div className="relative group flex-1 md:min-w-[340px]">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 group-focus-within:bg-indigo-600 group-focus-within:text-white transition-all"><Search className="h-4 w-4" /></div>
            <input placeholder="Search ledger identity or serial ID..." className="w-full h-14 pl-14 pr-4 rounded-2xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold placeholder:text-slate-400 shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          {canCreate && (
            <Button onClick={onAdd} className="h-14 px-10 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl shadow-indigo-100 bg-indigo-600 transition-transform active:scale-95">
              <UserPlus className="w-5 h-5 mr-2" /> New Enrollment
            </Button>
          )}
        </div>
      </div>

      {/* LEDGER GRID */}
      <div className="space-y-10">
        {loading ? (
            <div className="flex flex-col items-center justify-center py-40 text-slate-400 animate-pulse"><RefreshCcw className="w-10 h-10 animate-spin mb-6" /><p className="text-[10px] font-black uppercase tracking-[0.4em]">Synchronizing Portfolio Buffers...</p></div>
        ) : groupedMembers.length === 0 ? (
            <Card className="p-32 text-center rounded-[3.5rem] border-dashed border-2 bg-white/50"><Milestone className="w-16 h-16 text-slate-200 mx-auto mb-6" /><h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">Historical Ledger Empty</h3></Card>
        ) : groupedMembers.map((group) => (
            <Card key={group.category?.id || 'none'} className="overflow-hidden border-slate-200/60 shadow-xl group bg-white rounded-[2.5rem] transition-all hover:shadow-2xl">
                <div className="bg-slate-50/50 px-10 py-8 border-b flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm"><Layers className="w-6 h-6 text-indigo-600" /></div>
                        <div>
                            <h3 className="font-black text-slate-900 tracking-tight uppercase text-lg leading-tight">{group.category?.name || 'Unassigned Portfolios'}</h3>
                            {group.category && <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1 flex items-center gap-2"><Zap className="w-3 h-3 text-indigo-400" /> Base yield: {formatMoney(group.category.base_rate)}</p>}
                        </div>
                    </div>
                    <span className="bg-[#1a2335] text-white text-[10px] font-black px-6 py-2.5 rounded-full uppercase tracking-[0.2em] shadow-lg border-2 border-white/10">{group.members.length} VERIFIED RECORDS</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-[9px] text-slate-400 font-black uppercase tracking-[0.25em] border-b bg-slate-50/20">
                          <tr>
                            <th className="px-10 py-6">Identity Serial</th>
                            <th className="px-10 py-6">Guest Profile</th>
                            <th className="px-10 py-6 text-center">Recognition Status</th>
                            <th className="px-10 py-6">Commencement</th>
                            <th className="px-10 py-6">Expiry Sentinel</th>
                            <th className="px-10 py-6 text-right">Net Investment</th>
                            <th className="px-10 py-6 text-center">Operations</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                        {group.members.map((m) => {
                            const effectiveStatus = getEffectiveStatus(m);
                            return (
                            <tr key={m.id} className="hover:bg-indigo-50/30 cursor-pointer transition-colors group/row" onClick={() => onViewDetail(m)}>
                                <td className="px-10 py-7 font-black text-indigo-600 text-base tracking-widest uppercase">{m.membership_number}</td>
                                <td className="px-10 py-7">
                                  <div className="flex items-center gap-4">
                                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs group-hover/row:bg-indigo-600 group-hover/row:text-white transition-all uppercase">{m.guest_name.charAt(0)}</div>
                                      <div>
                                          <div className="font-black text-slate-800 text-sm uppercase tracking-tight">{m.guest_name}</div>
                                          <div className="text-[9px] font-bold text-slate-400 tracking-widest uppercase mt-0.5">{m.package_type} Manifesto</div>
                                      </div>
                                  </div>
                                </td>
                                <td className="px-10 py-7 text-center"><span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border shadow-sm ${effectiveStatus === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : effectiveStatus === 'Frozen' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-red-50 text-red-700 border-red-100'}`}>{effectiveStatus}</span></td>
                                <td className="px-10 py-7 font-bold text-slate-500 text-xs">{format(parseISO(m.start_date), 'dd MMM yyyy')}</td>
                                <td className="px-10 py-7 text-slate-900 font-black text-sm tracking-tight">{m.current_end_date ? format(parseISO(m.current_end_date), 'dd MMM yyyy') : '---'}</td>
                                <td className="px-10 py-7 text-right font-black text-slate-900 tabular-nums text-base">{formatMoney(m.net_amount)}</td>
                                <td className="px-10 py-7 text-center" onClick={e => e.stopPropagation()}>
                                  <div className="flex items-center justify-center gap-2">
                                    <button 
                                      onClick={() => onRenew(m)} 
                                      title="Renew Membership" 
                                      className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:shadow-lg transition-all active:scale-90"
                                    >
                                        <RefreshCcw className="w-4 h-4"/>
                                    </button>
                                    <button 
                                      onClick={() => onViewDetail(m)} 
                                      title="Freeze Membership" 
                                      className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:shadow-lg transition-all active:scale-90"
                                    >
                                        <Snowflake className="w-4 h-4"/>
                                    </button>
                                    <button 
                                      onClick={() => onEdit(m)} 
                                      title="Edit Profile" 
                                      className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-100 hover:shadow-lg transition-all active:scale-90"
                                    >
                                        <Edit2 className="w-4 h-4"/>
                                    </button>
                                    <button 
                                      onClick={() => onDelete(m.id)} 
                                      title="Purge Record" 
                                      className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-red-600 hover:border-red-100 hover:shadow-lg transition-all active:scale-90"
                                    >
                                        <Trash2 className="w-4 h-4"/>
                                    </button>
                                  </div>
                                </td>
                            </tr>
                        )})}
                        </tbody>
                    </table>
                </div>
            </Card>
        ))}
      </div>
    </div>
  );
};

export default MemberLedger;