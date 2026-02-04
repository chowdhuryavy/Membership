
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Button, Card } from '../components/ui';
import { db } from '../services/mockSupabase';
import { MembershipCategory, Member, Freeze } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
// Fix: Verifying and ensuring correct named exports from date-fns
import { format, endOfMonth, differenceInCalendarDays, addDays } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Building2, Calculator, ReceiptText, FileSpreadsheet, Settings2, Check, X, ShieldCheck, FileText, Printer } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Local implementations for missing date-fns members
const parseISO = (dateString: string) => new Date(dateString);
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const subDays = (date: Date, amount: number) => addDays(date, -amount);

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
    { key: 'sl_no', label: 'SL.', width: 'w-12', defaultVisible: true },
    { key: 'guest_name', label: 'GUEST NAME / PROFILE', width: 'min-w-[280px]', defaultVisible: true },
    { key: 'from', label: 'START DATE', width: 'w-24', defaultVisible: true },
    { key: 'to', label: 'END DATE', width: 'w-24', defaultVisible: true },
    { key: 'total_days', label: 'DAYS', width: 'w-16', defaultVisible: true },
    { key: 'actual_fees', label: 'NET FEES', width: 'w-32', defaultVisible: true },
    { key: 'carry_forward', label: 'PREV. ACCRUAL', width: 'w-32', defaultVisible: true },
    { key: 'current_month_rev', label: 'PERIOD REVENUE', width: 'w-36', defaultVisible: true }, 
    { key: 'balance', label: 'DEFERRED', width: 'w-32', defaultVisible: true },
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
                from: format(parseISO(m.start_date), 'dd-MM-yy'),
                to: format(parseISO(m.current_end_date), 'dd-MM-yy'),
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

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPDF(true);
    const element = reportRef.current;
    
    // Create high-fidelity clone for rendering
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.width = '1600px'; 
    clone.style.position = 'fixed';
    clone.style.top = '0';
    clone.style.left = '-5000px'; 
    clone.style.backgroundColor = '#ffffff';
    document.body.appendChild(clone);

    try {
      const canvas = await html2canvas(clone, { 
        scale: 2.5, 
        useCORS: true, 
        backgroundColor: '#ffffff', 
        width: 1600, 
        windowWidth: 1600,
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

  // This counter is used to provide correct serial numbers in grouped output
  let globalIndex = 0;

  return (
    <div className={isPreviewMode ? "fixed inset-0 z-[9999] bg-[#0a0f1e] overflow-auto p-10" : "space-y-6"}>
        <style>
          {`
            @media print {
              @page { size: landscape; margin: 0; }
              body { background: white !important; }
              .print-container { 
                margin: 0 !important; 
                padding: 40px !important; 
                box-shadow: none !important; 
                border: none !important;
                width: 100% !important;
                max-width: none !important;
                min-height: auto !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print { display: none !important; }
              tr { page-break-inside: avoid; }
            }
          `}
        </style>
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl shadow-sm no-print border border-slate-200 gap-4">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                    <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tighter">Revenue Ledger</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Financial Reporting Context</p>
                </div>
                <div className="h-10 w-px bg-slate-200 mx-2 hidden sm:block"></div>
                <input 
                    type="month" 
                    value={reportMonth} 
                    onChange={e => setReportMonth(e.target.value)}
                    className="h-11 px-5 rounded-xl border border-slate-200 font-black text-xs uppercase tracking-[0.2em] bg-slate-50 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
                />
            </div>
            <div className="flex gap-3">
                <Button 
                    variant="outline" 
                    className={`rounded-xl font-black text-[10px] uppercase tracking-widest h-11 px-6 border-slate-200 transition-all ${showConfig ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-inner' : ''}`}
                    onClick={() => setShowConfig(!showConfig)}
                >
                    <Settings2 className="w-4 h-4 mr-2" /> Line Setup
                </Button>
                
                {showConfig && (
                    <div className="absolute top-24 right-48 mt-3 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl p-5 z-[100] w-72 animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Visible Columns</span>
                            <button onClick={() => setShowConfig(false)} className="text-slate-400 hover:text-red-500 p-1 rounded-lg hover:bg-slate-50 transition-colors"><X className="w-4 h-4"/></button>
                        </div>
                        <div className="space-y-1.5 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
                            {ALL_POSSIBLE_COLUMNS.map(col => (
                                <button 
                                    key={col.key} 
                                    onClick={() => toggleColumn(col.key)}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-[11px] font-bold transition-all ${visibleColumnKeys.includes(col.key) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50 border border-transparent hover:border-slate-100'}`}
                                >
                                    {col.label} {visibleColumnKeys.includes(col.key) && <Check className="w-3.5 h-3.5"/>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                <Button variant="outline" className={`rounded-xl font-black text-[10px] uppercase tracking-widest h-11 px-6 border-slate-200 transition-all ${isPreviewMode ? 'bg-indigo-900 text-white border-transparent shadow-xl' : ''}`} onClick={() => setIsPreviewMode(!isPreviewMode)}>
                  {isPreviewMode ? 'Exit Mode' : 'Ledger Preview'}
                </Button>

                <Button variant="outline" className="rounded-xl font-black text-[10px] uppercase tracking-widest h-11 px-6 border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-all" onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" /> Print Statement
                </Button>
                
                {canExport && (
                  <Button className="rounded-xl font-black text-[10px] uppercase tracking-widest h-11 px-8 shadow-xl shadow-indigo-100 transition-all hover:-translate-y-0.5" onClick={handleDownloadPDF} isLoading={isGeneratingPDF}>
                    {isGeneratingPDF ? 'Generating...' : 'Export PDF'}
                  </Button>
                )}
            </div>
        </div>

        <div ref={reportRef} className="bg-white p-6 md:p-20 rounded-[3rem] shadow-[0_32px_128px_-16px_rgba(0,0,0,0.12)] max-w-[1500px] mx-auto min-h-[1000px] print-container border border-slate-100 relative overflow-x-auto">
            
            <div className="flex flex-col md:flex-row justify-between items-start border-b-[4px] border-slate-950 pb-12 mb-12 gap-10 min-w-[1300px]">
                <div className="flex items-center gap-10">
                    {currentProperty?.logo_url ? (
                        <img src={currentProperty.logo_url} alt="Logo" className="h-32 w-auto object-contain shrink-0" />
                    ) : (
                        <div className="w-28 h-28 bg-slate-900 rounded-3xl flex items-center justify-center shadow-2xl shrink-0">
                          <Building2 className="w-14 h-14 text-white" />
                        </div>
                    )}
                    <div className="overflow-visible">
                        <h1 className="text-5xl md:text-6xl font-black uppercase tracking-tighter text-slate-950 leading-[0.85] whitespace-nowrap overflow-visible mb-2">
                            {currentProperty?.name || 'Property Portfolio'}
                        </h1>
                        <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em] mb-10">{currentProperty?.address || 'Corporate Headquarters'}</p>
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="flex items-center gap-3 bg-indigo-600 text-white px-8 py-3.5 rounded-2xl shadow-xl shadow-indigo-100 transition-all cursor-default">
                              <Activity className="w-4 h-4" />
                              <span className="text-[11px] font-black uppercase tracking-[0.2em]">{currentOutlet?.name || 'Authorized Facility'}</span>
                          </div>
                          <div className="px-6 py-3.5 border-2 border-slate-100 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                            REF: {reportMonth}-STMT
                          </div>
                        </div>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-3">Statement Range</h2>
                    <p className="text-5xl font-black text-slate-950 tracking-tighter tabular-nums mb-3">
                        {format(parseISO(reportMonth + '-01'), 'MMMM yyyy')}
                    </p>
                    <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-emerald-50 border border-emerald-100 rounded-2xl text-[10px] font-black text-emerald-700 uppercase tracking-widest shadow-sm">
                        <ShieldCheck className="w-4 h-4"/> RECONCILED AUDIT
                    </div>
                </div>
            </div>

            <table className="w-full text-[11px] border-collapse min-w-[1300px]">
                <thead>
                    <tr className="bg-[#0f172a] text-white">
                        {activeColumns.map(col => (
                            <th key={col.key} className={`px-4 py-7 text-center font-black uppercase tracking-[0.2em] border-r border-white/10 last:border-0 ${col.width}`}>
                                {col.label}
                            </th>
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
                          <tr className="bg-white border-b border-slate-100">
                            <td colSpan={activeColumns.length} className="px-6 py-6">
                              <div className="flex items-center gap-4">
                                <div className="p-1.5 bg-indigo-50 rounded-lg"><ReceiptText className="w-4 h-4 text-indigo-600" /></div>
                                <span className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-950">{catName}</span>
                                <span className="ml-2 px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-widest shadow-sm">
                                    {groupRows.length} ACCOUNTS
                                </span>
                              </div>
                            </td>
                          </tr>
                          
                          {groupRows.map((row) => {
                            globalIndex++;
                            return (
                                <tr key={`${row.membership_no}-${row.sl_no}`} className="hover:bg-slate-50 transition-colors group/row">
                                    {activeColumns.map(col => (
                                        <td key={col.key} className={`px-4 py-5 border-r border-slate-50 last:border-0 ${['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(col.key) ? 'text-right' : 'text-center'} ${col.key === 'guest_name' ? 'text-left font-black text-slate-800' : ''}`}>
                                            <span className={`
                                                ${col.key === 'current_month_rev' ? 'text-indigo-600 font-black' : ''} 
                                                ${col.key === 'balance' ? 'text-red-600 font-black' : ''}
                                                ${['actual_fees', 'carry_forward'].includes(col.key) ? 'font-bold text-slate-700' : ''}
                                            `}>
                                                {col.key === 'sl_no' ? globalIndex : (
                                                   ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(col.key) 
                                                   ? formatMoney(row[col.key as keyof ReportRow] as number)
                                                   : row[col.key as keyof ReportRow]
                                                )}
                                            </span>
                                        </td>
                                    ))}
                                </tr>
                            );
                          })}

                          <tr className="bg-indigo-50/30 border-b border-indigo-100/50">
                            <td colSpan={activeColumns.findIndex(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key))} className="px-6 py-4 text-right">
                                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-indigo-400">
                                    SUB-TOTAL: {catName}
                                </span>
                            </td>
                            {activeColumns.filter(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key)).map(col => (
                                <td key={col.key} className={`px-4 py-4 text-right font-black border-x border-white ${col.key === 'current_month_rev' ? 'text-indigo-800' : 'text-slate-800'}`}>
                                    {col.key === 'actual_fees' ? formatMoney(groupTotals.fees) : col.key === 'carry_forward' ? formatMoney(groupTotals.prev) : col.key === 'current_month_rev' ? formatMoney(groupTotals.current) : formatMoney(groupTotals.balance)}
                                </td>
                            ))}
                            {activeColumns.filter(c => !['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key) && activeColumns.indexOf(c) > activeColumns.findIndex(d => d.key === 'balance')).map(col => (
                                <td key={col.key} className="px-4 py-4"></td>
                            ))}
                          </tr>
                        </React.Fragment>
                      );
                    })}
                </tbody>

                {rows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-950 text-white">
                      <td colSpan={activeColumns.findIndex(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key))} className="px-6 py-8 text-right text-[11px] font-black uppercase tracking-[0.4em] border-r border-white/5">
                        Consolidated Ledger Totals
                      </td>
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
                <div className="py-64 text-center min-w-[1300px]">
                    <div className="w-28 h-28 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-10 shadow-inner">
                        <Calculator className="w-12 h-12 text-slate-300" />
                    </div>
                    <p className="text-slate-400 font-black uppercase tracking-[0.4em] text-xs">Zero operational activities recorded for this period.</p>
                </div>
            )}
            
            <div className="mt-48 pt-20 border-t-[3px] border-slate-100 flex justify-between items-start gap-16 min-w-[1300px]">
                <div className="flex-1 text-center space-y-12">
                    <p className="text-[14px] font-black text-slate-900 uppercase tracking-widest">Prepared By:</p>
                    <div className="pt-8">
                      <p className="text-[12px] font-bold text-slate-600 uppercase tracking-widest">Cluster Income Auditor</p>
                    </div>
                </div>

                <div className="flex-1 text-center space-y-12">
                    <p className="text-[14px] font-black text-slate-900 uppercase tracking-widest">Reviewed By:</p>
                    <div className="pt-8">
                      <p className="text-[12px] font-bold text-slate-600 uppercase tracking-widest">Cluster Assist. Financial Controller</p>
                    </div>
                </div>

                <div className="flex-1 text-center space-y-12">
                    <p className="text-[14px] font-black text-slate-900 uppercase tracking-widest">Approved By:</p>
                    <div className="pt-8">
                      <p className="text-[12px] font-bold text-slate-600 uppercase tracking-widest">Cluster Ex- Assist. Director of Finance</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Reports;
