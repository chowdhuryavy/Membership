import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button } from '../components/ui';
import { db } from '../services/mockSupabase';
import { Member, MembershipCategory, MemberStatus } from '../types';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { CalendarX, FileDown, Search, Filter } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ExpiringMembershipsReportProps {
    isEmbedded?: boolean;
    embeddedMonth?: string;
}

export default function ExpiringMembershipsReport({ isEmbedded, embeddedMonth }: ExpiringMembershipsReportProps = {}) {
    const { user } = useAuth();
    const { currentOutlet, currentProperty } = useSettings();
    const [members, setMembers] = useState<Member[]>([]);
    const [categories, setCategories] = useState<MembershipCategory[]>([]);
    const [reportMonth, setReportMonth] = useState(embeddedMonth || format(new Date(), 'yyyy-MM'));
    const [isLoading, setIsLoading] = useState(true);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    useEffect(() => {
        if (embeddedMonth) {
            setReportMonth(embeddedMonth);
        }
    }, [embeddedMonth]);

    useEffect(() => {
        if (currentOutlet && currentProperty) {
            loadData();
        }
    }, [currentOutlet, currentProperty, reportMonth]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [membersData, catsData] = await Promise.all([
                db.getMembers(),
                db.getCategories()
            ]);
            
            // Filter members for the current outlet
            const outletMembers = membersData.filter(m => m.outlet_id === currentOutlet?.id);
            setMembers(outletMembers);
            setCategories(catsData);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const expiringMembers = useMemo(() => {
        if (!reportMonth) return [];
        
        const [year, month] = reportMonth.split('-').map(Number);
        const start = startOfMonth(new Date(year, month - 1));
        const end = endOfMonth(new Date(year, month - 1));

        return members.filter(m => {
            if (m.status === MemberStatus.TENTATIVE || m.status === MemberStatus.PENDING) return false;
            if (!m.current_end_date) return false;
            
            const endDate = parseISO(m.current_end_date);
            return isWithinInterval(endDate, { start, end });
        }).sort((a, b) => parseISO(a.current_end_date).getTime() - parseISO(b.current_end_date).getTime());
    }, [members, reportMonth]);

    const handleExportPDF = () => {
        window.print();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className={`space-y-8 animate-in fade-in duration-700 ${isEmbedded ? '' : 'pb-20'}`}>
            {!isEmbedded && (
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-xl no-print">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-rose-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-rose-100">
                            <CalendarX className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Expiring Memberships</h1>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">Monthly Expiration Audit</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                        <div className="flex items-center gap-3 bg-white border border-slate-200 px-5 py-3 rounded-2xl shadow-sm">
                            <input 
                                type="month" 
                                value={reportMonth} 
                                onChange={e => setReportMonth(e.target.value)} 
                                className="text-[11px] font-black uppercase bg-transparent outline-none cursor-pointer text-slate-700" 
                            />
                        </div>
                        <Button onClick={handleExportPDF} isLoading={isGeneratingPDF} className="h-12 px-8 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 transition-all active:scale-95">
                            <FileDown className="w-4 h-4 mr-2" /> Export PDF
                        </Button>
                    </div>
                </div>
            )}

            <Card className={`rounded-[2.5rem] border-slate-200/60 overflow-hidden bg-white ${isEmbedded ? 'shadow-none border-none' : 'shadow-2xl'}`}>
                {!isEmbedded && (
                    <CardHeader className="bg-slate-950 text-white p-8 border-b border-slate-800 flex flex-row items-center justify-between no-print">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3">
                            <Filter className="w-4 h-4 text-rose-400" /> Expiration List for {format(new Date(reportMonth + '-01'), 'MMMM yyyy')}
                        </CardTitle>
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Total Expiring: <span className="text-white text-sm ml-2">{expiringMembers.length}</span>
                        </div>
                    </CardHeader>
                )}
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <div id="expiring-report-content" className="print-container min-w-max bg-white">
                            <div className="p-8 pb-4 hidden print:block">
                                <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Expiring Memberships Report</h2>
                                <p className="text-sm text-slate-500 font-medium">Month: {format(new Date(reportMonth + '-01'), 'MMMM yyyy')}</p>
                                <p className="text-sm text-slate-500 font-medium">Property: {currentProperty?.name} | Outlet: {currentOutlet?.name}</p>
                            </div>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100">
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">#</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Member Name</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Membership No.</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Date</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">End Date</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {expiringMembers.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium text-sm">
                                                No memberships expiring in this month.
                                            </td>
                                        </tr>
                                    ) : (
                                        expiringMembers.map((member, idx) => {
                                            const cat = categories.find(c => c.id === member.category_id);
                                            return (
                                                <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-6 py-4 text-sm font-bold text-slate-400">{idx + 1}</td>
                                                    <td className="px-6 py-4 text-sm font-black text-slate-700">{member.guest_name}</td>
                                                    <td className="px-6 py-4 text-sm font-mono text-slate-500">{member.membership_number}</td>
                                                    <td className="px-6 py-4 text-sm font-bold text-indigo-600">{cat?.name || 'Unknown'}</td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">{format(parseISO(member.start_date), 'dd MMM yyyy')}</td>
                                                    <td className="px-6 py-4 text-sm font-black text-rose-600">{format(parseISO(member.current_end_date), 'dd MMM yyyy')}</td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
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
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
