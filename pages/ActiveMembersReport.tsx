import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '../components/ui';
import { supabase } from '../services/supabase';
import { Member, MembershipCategory, MemberStatus } from '../types';
import { format, parseISO } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { UserCheck, FileDown, Filter } from 'lucide-react';

interface ActiveMembersReportProps {
    isEmbedded?: boolean;
    selectedMembershipTypeId?: string;
}

export default function ActiveMembersReport({ isEmbedded, selectedMembershipTypeId = 'all' }: ActiveMembersReportProps = {}) {
    const { currentOutlet, currentProperty, formatMoney } = useSettings();
    const [members, setMembers] = useState<Member[]>([]);
    const [categories, setCategories] = useState<MembershipCategory[]>([]);
    const [membershipTypes, setMembershipTypes] = useState<{id: string, name: string}[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (currentOutlet && currentProperty) {
            loadData();
        }
    }, [currentOutlet, currentProperty, selectedMembershipTypeId]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            let query = supabase.from('members').select('*').eq('outlet_id', currentOutlet?.id);
            
            if (selectedMembershipTypeId && selectedMembershipTypeId !== 'all') {
                query = query.eq('membership_type_id', selectedMembershipTypeId);
            }

            const [membersRes, catsRes, typesRes] = await Promise.all([
                query,
                supabase.from('membership_categories').select('*'),
                supabase.from('membership_types').select('id, name').eq('outlet_id', currentOutlet?.id)
            ]);
            
            setMembers(membersRes.data || []);
            setCategories(catsRes.data || []);
            setMembershipTypes(typesRes.data || []);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const activeMembers = useMemo(() => {
        return members.filter(m => m.status === MemberStatus.ACTIVE)
            .sort((a, b) => a.guest_name.localeCompare(b.guest_name));
    }, [members]);

    const groupedMembers = useMemo(() => {
        if (selectedMembershipTypeId !== 'all') {
            const filteredGrouped: Record<string, Record<string, Member[]>> = { 'Filtered Results': {} };
            activeMembers.forEach(member => {
                const cat = categories.find(c => c.id === member.category_id);
                const catKey = cat?.name || 'Other';
                if (!filteredGrouped['Filtered Results'][catKey]) filteredGrouped['Filtered Results'][catKey] = [];
                filteredGrouped['Filtered Results'][catKey].push(member);
            });
            return filteredGrouped;
        }

        return activeMembers.reduce((acc, member) => {
            const type = membershipTypes.find(t => t.id === member.membership_type_id);
            const typeKey = type?.name || 'Membership';
            const cat = categories.find(c => c.id === member.category_id);
            const catKey = cat?.name || 'Other';
            
            if (!acc[typeKey]) acc[typeKey] = {};
            if (!acc[typeKey][catKey]) acc[typeKey][catKey] = [];
            
            acc[typeKey][catKey].push(member);
            return acc;
        }, {} as Record<string, Record<string, Member[]>>);
    }, [activeMembers, membershipTypes, categories, selectedMembershipTypeId]);

    const handleExportPDF = () => {
        window.print();
    };

    // Removing full page spinner to prevent UI jumping
    // We will just dim the content while loading if needed

    return (
        <div className={`space-y-8 animate-in fade-in duration-700 ${isEmbedded ? '' : 'pb-20'} transition-opacity ${isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
            {!isEmbedded && (
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-xl no-print">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-indigo-100">
                            <UserCheck className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Active Members</h1>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">Current Active Status Roster</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                        <Button onClick={handleExportPDF} className="h-12 px-8 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 transition-all active:scale-95">
                            <FileDown className="w-4 h-4 mr-2" /> Export PDF
                        </Button>
                    </div>
                </div>
            )}

            <Card className={`rounded-none border-slate-200/60 overflow-hidden bg-white ${isEmbedded ? 'shadow-none border-none' : 'shadow-2xl'}`}>
                {!isEmbedded && (
                    <CardHeader className="bg-slate-950 text-white p-8 border-b border-slate-800 flex flex-row items-center justify-between no-print">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3">
                            <Filter className="w-4 h-4 text-indigo-400" /> Active Roster for {format(new Date(), 'dd MMM yyyy')}
                        </CardTitle>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Total Active: <span className="text-white text-sm ml-2">{activeMembers.length}</span>
                        </div>
                    </CardHeader>
                )}
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <div id="active-report-content" className={`${isEmbedded ? 'w-full' : 'print-container min-w-max'} bg-white`}>
                            {!isEmbedded && (
                                <div className="p-8 pb-4 hidden print:block">
                                    <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Active Members Report</h2>
                                    <p className="text-sm text-slate-500 font-medium">Date: {format(new Date(), 'dd MMMM yyyy')}</p>
                                    <p className="text-sm text-slate-500 font-medium">Property: {currentProperty?.name} | Outlet: {currentOutlet?.name}</p>
                                </div>
                            )}
                            <table className={`w-full text-left border-collapse border-2 border-black ${isEmbedded ? 'text-[9px]' : ''}`}>
                                <thead>
                                    <tr className={`${isEmbedded ? 'bg-slate-950 text-white font-black uppercase tracking-widest' : 'bg-slate-50 border-b border-slate-100'}`}>
                                        <th className={`px-2 py-4 tracking-widest w-16 border border-black ${isEmbedded ? '' : 'px-6 text-[10px] text-slate-400 uppercase'}`}>#</th>
                                        <th className={`px-2 py-4 tracking-widest border border-black ${isEmbedded ? '' : 'px-6 text-[10px] text-slate-400 uppercase'}`}>Member Name</th>
                                        <th className={`px-2 py-4 tracking-widest border border-black ${isEmbedded ? '' : 'px-6 text-[10px] text-slate-400 uppercase'}`}>Membership No.</th>
                                        <th className={`px-2 py-4 tracking-widest border border-black ${isEmbedded ? '' : 'px-6 text-[10px] text-slate-400 uppercase'}`}>Category</th>
                                        <th className={`px-2 py-4 tracking-widest border border-black ${isEmbedded ? '' : 'px-6 text-[10px] text-slate-400 uppercase'}`}>Start Date</th>
                                        <th className={`px-2 py-4 tracking-widest border border-black ${isEmbedded ? '' : 'px-6 text-[10px] text-slate-400 uppercase'}`}>End Date</th>
                                        <th className={`px-2 py-4 tracking-widest border border-black ${isEmbedded ? 'text-right' : 'px-6 text-[10px] text-slate-400 uppercase text-right'}`}>Actual Rate</th>
                                        <th className={`px-2 py-4 tracking-widest border border-black ${isEmbedded ? 'text-right' : 'px-6 text-[10px] text-slate-400 uppercase text-right'}`}>Discount</th>
                                        <th className={`px-2 py-4 tracking-widest border border-black ${isEmbedded ? 'text-right' : 'px-6 text-[10px] text-slate-400 uppercase text-right'}`}>Net Rate</th>
                                        <th className={`px-2 py-4 tracking-widest border border-black ${isEmbedded ? '' : 'px-6 text-[10px] text-slate-400 uppercase'}`}>Status</th>
                                    </tr>
                                </thead>
                                <tbody className={isEmbedded ? '' : 'divide-y divide-slate-100'}>
                                    {activeMembers.length === 0 ? (
                                        <tr>
                                            <td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-medium text-sm border border-black">
                                                No active members found.
                                            </td>
                                        </tr>
                                    ) : (
                                        Object.entries(groupedMembers).map(([type, categoriesData]) => {
                                            const typeCategories = categoriesData as Record<string, Member[]>;
                                            const typeTotalCount = Object.values(typeCategories).flat().length;

                                            return (
                                                <React.Fragment key={type}>
                                                    {selectedMembershipTypeId === 'all' && (
                                                        <tr className="bg-slate-900 text-white">
                                                            <td colSpan={10} className="px-4 py-2 font-black uppercase tracking-widest text-[11px] border border-black">
                                                                Type: {type}
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {Object.entries(typeCategories).map(([catName, groupMembers]) => (
                                                        <React.Fragment key={catName}>
                                                            <tr className="bg-slate-100">
                                                                <td colSpan={10} className="px-4 py-2 font-black text-slate-900 uppercase tracking-tight text-[10px] border border-black pl-8">
                                                                    Tier: {catName} ({groupMembers.length} Members)
                                                                </td>
                                                            </tr>
                                                            {groupMembers.map((member, idx) => {
                                                                const cat = categories.find(c => c.id === member.category_id);
                                                                return (
                                                                    <tr key={member.id} className={`${isEmbedded ? 'border-b border-slate-100' : 'hover:bg-slate-50/50 transition-colors'}`}>
                                                                        <td className={`px-2 py-3 font-bold border border-black ${isEmbedded ? 'text-slate-400 text-center' : 'px-6 text-sm text-slate-400'}`}>{idx + 1}</td>
                                                                        <td className={`px-2 py-3 font-black border border-black ${isEmbedded ? 'text-slate-800' : 'px-6 text-sm text-slate-700'}`}>{member.guest_name}</td>
                                                                        <td className={`px-2 py-3 font-mono border border-black ${isEmbedded ? 'text-slate-500 text-center' : 'px-6 text-sm text-slate-500'}`}>{member.membership_number}</td>
                                                                        <td className={`px-2 py-3 font-bold border border-black ${isEmbedded ? 'text-indigo-600' : 'px-6 text-sm text-indigo-600'}`}>{cat?.name || 'Unknown'}</td>
                                                                        <td className={`px-2 py-3 border border-black ${isEmbedded ? 'text-slate-600 text-center' : 'px-6 text-sm text-slate-500'}`}>{format(parseISO(member.start_date), 'dd MMM yyyy')}</td>
                                                                        <td className={`px-2 py-3 font-black border border-black ${isEmbedded ? 'text-indigo-600 text-center' : 'px-6 text-sm text-indigo-600'}`}>{format(parseISO(member.current_end_date), 'dd MMM yyyy')}</td>
                                                                        <td className={`px-2 py-3 font-mono border border-black ${isEmbedded ? 'text-slate-500 text-right' : 'px-6 text-sm text-slate-500 text-right'}`}>{formatMoney(member.actual_rate || 0)}</td>
                                                                        <td className={`px-2 py-3 font-mono border border-black ${isEmbedded ? 'text-red-500 text-right' : 'px-6 text-sm text-red-500 text-right'}`}>{member.discount ? formatMoney(member.discount) : '-'}</td>
                                                                        <td className={`px-2 py-3 font-black border border-black ${isEmbedded ? 'text-indigo-900 text-right' : 'px-6 text-sm text-indigo-900 text-right'}`}>{formatMoney((member.original_net_amount && member.original_net_amount > 0) ? member.original_net_amount : ((member.actual_rate || 0) - (member.discount || 0)))}</td>
                                                                        <td className={`px-2 py-3 border border-black ${isEmbedded ? 'text-center' : 'px-6'}`}>
                                                                            <span className={`px-3 py-1 rounded-sm text-[10px] font-black uppercase tracking-widest ${
                                                                                member.status === MemberStatus.ACTIVE ? 'bg-emerald-100 text-emerald-700' :
                                                                                member.status === MemberStatus.EXPIRED ? 'bg-rose-100 text-rose-700' :
                                                                                member.status === MemberStatus.FROZEN ? 'bg-blue-100 text-blue-700' :
                                                                                'bg-slate-100 text-slate-700'
                                                                            }`}>
                                                                                {member.status}
                                                                            </span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                            <tr className="bg-slate-50 font-bold text-[9px]">
                                                                <td colSpan={9} className="px-4 py-2 text-right uppercase tracking-widest border border-black italic">Tier Subtotal ({catName}):</td>
                                                                <td className="px-2 py-2 text-center text-indigo-600 border border-black">{groupMembers.length}</td>
                                                            </tr>
                                                        </React.Fragment>
                                                    ))}
                                                    {selectedMembershipTypeId === 'all' && (
                                                        <tr className="bg-indigo-100 font-black text-[10px]">
                                                            <td colSpan={9} className="px-4 py-2 text-right uppercase tracking-widest border border-black">Type Total ({type}):</td>
                                                            <td className="px-2 py-2 text-center text-indigo-900 border border-black">{typeTotalCount}</td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })
                                    )}
                                </tbody>
                                {isEmbedded && activeMembers.length > 0 && (
                                    <tfoot>
                                        <tr className="bg-slate-50 text-slate-900 font-black text-[10px]">
                                            <td colSpan={9} className="px-4 py-4 text-right uppercase tracking-widest border border-black">Aggregate Active Total</td>
                                            <td className="px-2 py-4 text-center text-indigo-600 border border-black">{activeMembers.length}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
