
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Button, Card } from '../components/ui';
import { db } from '../services/mockSupabase';
import { MembershipCategory, Member, Freeze } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, startOfMonth, endOfMonth, parseISO, subDays, differenceInCalendarDays } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Building2, Calculator, ReceiptText, FileSpreadsheet, Settings2, Check, X } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface ReportRow {
  sl_no: number;
  guest_name: string;
  from: string;
  to: string;
  total_days: number;
  original_fees: number;
  actual_fees: number;
  carry_forward: number;
  daily: number;
  current_month_rev: number;
  controll: number;
  balance: number;
  remarks: string;
  membership_no: string;
  category_id: string;
  category_name: string;
}

const ALL_POSSIBLE_COLUMNS = [
    { key: 'sl_no', label: 'Sl.', width: 'w-12', defaultVisible: true },
    { key: 'guest_name', label: 'Guest Name / Profile', width: 'min-w-[200px]', defaultVisible: true },
    { key: 'from', label: 'Start Date', width: 'w-24', defaultVisible: true },
    { key: 'to', label: 'End Date', width: 'w-24', defaultVisible: true },
    { key: 'total_days', label: 'Days', width: 'w-16', defaultVisible: true },
    { key: 'actual_fees', label: 'Net Fees', width: 'w-32', defaultVisible: true },
    { key: 'carry_forward', label: 'Prev. Accrual', width: 'w-32', defaultVisible: true },
    { key: 'current_month_rev', label: 'Period Revenue', width: 'w-36', defaultVisible: true }, 
    { key: 'balance', label: 'Deferred', width: 'w-32', defaultVisible: true },
    { key: 'remarks', label: 'Remarks', width: 'w-32', defaultVisible: false }
];

const Reports = () => {
  const { user } = useAuth();
  const { currentOutlet, currentProperty, formatMoney, hasPermission } = useSettings();
  const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(
    ALL_POSSIBLE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key)
  );
  const [showConfig, setShowConfig] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  useEffect(() => { if (currentOutlet) loadData(); }, [reportMonth, currentOutlet]);

  const loadData = async () => {
    if (!currentOutlet) return;
    try {
        const [members, cats, freezes] = await Promise.all([
            db.getMembers(currentOutlet.id),
            db.getCategories(currentOutlet.id),
            db.getFreezes() 
        ]);
        
        setCategories(cats);
        const targetDate = parseISO(reportMonth + '-01'); 
        const startOfReport = startOfMonth(targetDate);
        const endOfReport = endOfMonth(targetDate);
        const prevMonthEnd = subDays(startOfReport, 1);

        const reportRows: ReportRow[] = members.filter(m => {
            const mEnd = parseISO(m.current_end_date);
            const mStart = parseISO(m.start_date);
            return mEnd >= startOfReport && mStart <= endOfReport;
        }).map((m, idx) => {
            const memFreezes = freezes.filter(f => f.member_id === m.id);
            const carryForward = RevenueEngine.calculateRevenuePeriod(m, memFreezes, parseISO(m.start_date), prevMonthEnd);
            const currentRev = RevenueEngine.calculateRevenuePeriod(m, memFreezes, startOfReport, endOfReport);
            const controll = carryForward + currentRev;
            const balance = Math.max(0, m.net_amount - controll);
            const totalDays = differenceInCalendarDays(parseISO(m.current_end_date), parseISO(m.start_date)) + 1;
            return {
                sl_no: idx + 1,
                guest_name: m.guest_name,
                from: format(parseISO(m.start_date), 'yy-MM-dd'),
                to: format(parseISO(m.current_end_date), 'yy-MM-dd'),
                total_days: totalDays,
                original_fees: m.actual_rate, 
                actual_fees: m.net_amount,
                carry_forward: carryForward,
                daily: m.daily_rate,
                current_month_rev: currentRev,
                controll: controll,
                balance: balance,
                remarks: m.check_no || '',
                membership_no: m.membership_number,
                category_id: m.category_id,
                category_name: cats.find(c => c.id === m.category_id)?.name || 'Uncategorized'
            };
        });
        setRows(reportRows);
    } catch (e) { console.error(e); }
  };

  const groupedRows = useMemo(() => {
    const groups: { [catName: string]: ReportRow[] } = {};
    rows.forEach(row => {
      if (!groups[row.category_name]) groups[row.category_name] = [];
      groups[row.category_name].push(row);
    });
    return groups;
  }, [rows]);

  const totals = useMemo(() => {
    return rows.reduce((acc, row) => ({
      fees: acc.fees + row.actual_fees,
      prev: acc.prev + row.carry_forward,
      current: acc.current + row.current_month_rev,
      balance: acc.balance + row.balance
    }), { fees: 0, prev: 0, current: 0, balance: 0 });
  }, [rows]);

  const activeColumns = useMemo(() => 
    ALL_POSSIBLE_COLUMNS.filter(col => visibleColumnKeys.includes(col.key))
  , [visibleColumnKeys]);

  const toggleColumn = (key: string) => {
    setVisibleColumnKeys(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPDF(true);
    const element = reportRef.current;
    
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.width = '2000px'; 
    clone.style.position = 'fixed';
    clone.style.top = '0';
    clone.style.left = '-5000px'; 
    clone.style.backgroundColor = '#ffffff';
    document.body.appendChild(clone);

    try {
      const canvas = await html2canvas(clone, { 
        scale: 3, 
        useCORS: true, 
        backgroundColor: '#ffffff', 
        width: 2000, 
        windowWidth: 2000,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Statement_${currentProperty?.name || 'Report'}_${reportMonth}.pdf`);
    } catch (err) { 
        console.error("PDF engine failure:", err); 
    } finally { 
        document.body.removeChild(clone); 
        setIsGeneratingPDF(false); 
    }
  };

  const canExport = hasPermission(user?.role_id || '', 'reports:export');

  return (
    <div className={isPreviewMode ? "fixed inset-0 z-[9999] bg-slate-900 overflow-auto p-10" : "space-y-6"}>
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl shadow-sm no-print border border-slate-200 gap-4">
            <div className="flex items-center gap-4">
                <FileSpreadsheet className="w-8 h-8 text-indigo-600" />
                <div>
                  <h2 className="text-xl font-black tracking-tighter">Revenue Ledger</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Financial Reporting Context</p>
                </div>
                <div className="h-10 w-px bg-slate-200 mx-2 hidden sm:block"></div>
                <input 
                    type="month" 
                    value={reportMonth} 
                    onChange={e => setReportMonth(e.target.value)}
                    className="h-10 px-4 rounded-xl border border-slate-200 font-black text-xs uppercase tracking-widest bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                />
            </div>
            <div className="flex gap-2">
                <div className="relative">
                    <Button 
                        variant="outline" 
                        className={`rounded-xl font-black text-xs uppercase tracking-widest h-11 px-6 ${showConfig ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : ''}`}
                        onClick={() => setShowConfig(!showConfig)}
                    >
                        <Settings2 className="w-4 h-4 mr-2" /> Line Setup
                    </Button>
                    {showConfig && (
                        <div className="absolute top-full right-0 mt-3 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl p-4 z-[100] w-64 animate-in zoom-in-95 duration-200">
                            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-50">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Visible Columns</span>
                                <button onClick={() => setShowConfig(false)} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4"/></button>
                            </div>
                            <div className="space-y-1 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                                {ALL_POSSIBLE_COLUMNS.map(col => (
                                    <button 
                                        key={col.key} 
                                        onClick={() => toggleColumn(col.key)}
                                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left text-[11px] font-bold transition-all ${visibleColumnKeys.includes(col.key) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`}
                                    >
                                        {col.label} {visibleColumnKeys.includes(col.key) && <Check className="w-3 h-3"/>}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <Button variant="outline" className="rounded-xl font-black text-xs uppercase tracking-widest h-11 px-6" onClick={() => setIsPreviewMode(!isPreviewMode)}>
                  {isPreviewMode ? 'Exit Mode' : 'Ledger Preview'}
                </Button>
                {canExport && (
                  <Button className="rounded-xl font-black text-xs uppercase tracking-widest h-11 px-6 shadow-xl shadow-indigo-100" onClick={handleDownloadPDF} isLoading={isGeneratingPDF}>
                    {isGeneratingPDF ? 'Rendering...' : 'Export Statement'}
                  </Button>
                )}
            </div>
        </div>

        <div ref={reportRef} className="bg-white p-6 md:p-16 rounded-[3rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.12)] max-w-[1400px] mx-auto min-h-[1000px] print-container border border-slate-100 relative overflow-x-auto">
            {/* Professional Header Section - Fully Restored */}
            <div className="flex flex-col md:flex-row justify-between items-start border-b-[6px] border-slate-950 pb-12 mb-12 gap-10 min-w-[1250px]">
                <div className="flex items-center gap-10">
                    {currentProperty?.logo_url ? (
                        <img src={currentProperty.logo_url} alt="Logo" className="h-28 w-auto object-contain shrink-0" />
                    ) : (
                        <div className="w-24 h-24 bg-slate-900 rounded-3xl flex items-center justify-center shadow-2xl shrink-0">
                          <Building2 className="w-12 h-12 text-white" />
                        </div>
                    )}
                    <div className="overflow-visible">
                        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-slate-900 leading-none whitespace-nowrap overflow-visible">
                            {currentProperty?.name || 'Property Portfolio'}
                        </h1>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em] mt-3">{currentProperty?.address || 'Corporate Headquarters'}</p>
                        <div className="flex items-center gap-4 mt-8 flex-wrap">
                          <div className="flex items-center gap-3 bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-xl shadow-indigo-100">
                              <Activity className="w-4 h-4" />
                              <span className="text-xs font-black uppercase tracking-widest">{currentOutlet?.name || 'Authorized Facility'}</span>
                          </div>
                          <div className="px-5 py-3 border-2 border-slate-100 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Ref: {reportMonth}-STMT
                          </div>
                        </div>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 mb-2">Statement Range</h2>
                    <p className="text-4xl font-black text-slate-950 tracking-tighter tabular-nums mb-2">{format(parseISO(reportMonth + '-01'), 'MMMM yyyy')}</p>
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full text-[9px] font-black text-emerald-700 uppercase tracking-widest shadow-sm">
                        <Check className="w-3 h-3 inline mr-1"/> Reconciled Audit
                    </div>
                </div>
            </div>

            <table className="w-full text-[11px] border-collapse min-w-[1250px]">
                <thead>
                    <tr className="bg-slate-900 text-white rounded-t-xl overflow-hidden">
                        {activeColumns.map(col => (
                            <th key={col.key} className={`px-4 py-6 text-center font-black uppercase tracking-[0.15em] border-r border-white/10 last:border-0 ${col.width}`}>{col.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {Object.keys(groupedRows).map(catName => {
                      const groupRows = groupedRows[catName];
                      const groupTotals = groupRows.reduce((acc, r) => ({
                        fees: acc.fees + r.actual_fees,
                        prev: acc.prev + r.carry_forward,
                        current: acc.current + r.current_month_rev,
                        balance: acc.balance + r.balance
                      }), { fees: 0, prev: 0, current: 0, balance: 0 });

                      return (
                        <React.Fragment key={catName}>
                          <tr className="bg-slate-50 border-y border-slate-200">
                            <td colSpan={activeColumns.length} className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <ReceiptText className="w-4 h-4 text-indigo-600" />
                                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900">{catName}</span>
                                <span className="ml-2 px-2 py-0.5 bg-white border border-slate-200 rounded text-[9px] font-bold text-slate-400 uppercase tracking-widest">{groupRows.length} Accounts</span>
                              </div>
                            </td>
                          </tr>
                          {groupRows.map((row) => (
                            <tr key={`${row.membership_no}-${row.sl_no}`} className="hover:bg-slate-50 transition-colors group/row">
                                {activeColumns.map(col => (
                                    <td key={col.key} className={`px-4 py-4 border-r border-slate-50 last:border-0 ${['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(col.key) ? 'text-right' : 'text-center'} ${col.key === 'guest_name' ? 'text-left font-black text-slate-900' : ''}`}>
                                        <span className={`
                                            ${col.key === 'current_month_rev' ? 'text-indigo-600 font-black' : ''} 
                                            ${col.key === 'balance' ? 'text-red-600 font-black' : ''}
                                            ${['actual_fees', 'carry_forward'].includes(col.key) ? 'font-bold text-slate-700' : ''}
                                        `}>
                                            {['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(col.key) 
                                                ? formatMoney(row[col.key as keyof ReportRow] as number)
                                                : row[col.key as keyof ReportRow]
                                            }
                                        </span>
                                    </td>
                                ))}
                            </tr>
                          ))}
                          {/* Category Sub-totals */}
                          <tr className="bg-indigo-50/20 border-b border-indigo-100">
                            <td colSpan={activeColumns.findIndex(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key))} className="px-6 py-4 text-right text-[10px] font-black uppercase tracking-widest text-indigo-400">Sub-total: {catName}</td>
                            {activeColumns.filter(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key)).map(col => (
                                <td key={col.key} className={`px-4 py-4 text-right font-black border-x border-slate-100 ${col.key === 'current_month_rev' ? 'text-indigo-800 bg-indigo-50/30' : ''}`}>
                                    {col.key === 'actual_fees' ? formatMoney(groupTotals.fees) : col.key === 'carry_forward' ? formatMoney(groupTotals.prev) : col.key === 'current_month_rev' ? formatMoney(groupTotals.current) : formatMoney(groupTotals.balance)}
                                </td>
                            ))}
                            {activeColumns.filter(c => !['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key) && activeColumns.indexOf(c) > activeColumns.findIndex(d => d.key === 'balance')).map(col => (
                                <td key={col.key} className="px-4 py-4 border-l border-slate-100"></td>
                            ))}
                          </tr>
                        </React.Fragment>
                      );
                    })}
                </tbody>
                {rows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-950 text-white shadow-2xl">
                      <td colSpan={activeColumns.findIndex(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key))} className="px-6 py-8 text-right text-xs font-black uppercase tracking-[0.3em] border-r border-white/5">Consolidated Totals</td>
                      {activeColumns.filter(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key)).map(col => (
                          <td key={col.key} className={`px-4 py-8 text-right font-black border-r border-white/5 last:border-0 ${col.key === 'current_month_rev' ? 'bg-indigo-600' : ''}`}>
                             {col.key === 'actual_fees' ? formatMoney(totals.fees) : col.key === 'carry_forward' ? formatMoney(totals.prev) : col.key === 'current_month_rev' ? formatMoney(totals.current) : formatMoney(totals.balance)}
                          </td>
                      ))}
                      {activeColumns.filter(c => !['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key) && activeColumns.indexOf(c) > activeColumns.findIndex(d => d.key === 'balance')).map(col => (
                          <td key={col.key} className="px-4 py-8 border-l border-white/5"></td>
                      ))}
                    </tr>
                  </tfoot>
                )}
            </table>

            {rows.length === 0 && (
                <div className="py-60 text-center min-w-[1250px]">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                        <Calculator className="w-10 h-10 text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-black uppercase tracking-[0.3em] text-xs">Zero operational activities recorded for this period.</p>
                </div>
            )}
            
            <div className="mt-40 pt-16 border-t-2 border-slate-100 flex flex-col md:flex-row justify-between items-end gap-12 min-w-[1250px]">
                <div className="space-y-6 w-full md:w-auto">
                    <div className="flex flex-col sm:flex-row gap-12">
                      <div className="space-y-4"><div className="w-56 h-px bg-slate-300"></div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">General Manager Approval</p></div>
                      <div className="space-y-4"><div className="w-56 h-px bg-slate-300"></div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Controller Authorization</p></div>
                    </div>
                </div>
                <div className="text-right text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] space-y-2">
                    <p className="text-slate-950 font-black uppercase">Audit ID: {crypto.randomUUID().slice(0, 16).toUpperCase()}</p>
                    <p>Internal Governance Policy - Restricted Data</p>
                    <p>Generated at {format(new Date(), 'PPpp')}</p>
                </div>
            </div>
        </div>
    </div>
  );
};

const CheckCircle2 = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
);

export default Reports;
