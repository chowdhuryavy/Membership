
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Button, Card } from '../components/ui';
import { db } from '../services/mockSupabase';
import { MembershipCategory, Member, Freeze } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, endOfMonth, differenceInCalendarDays, addDays } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Building2, Calculator, ReceiptText, Settings2, Check, X, ShieldCheck, FileText, Printer, FileDown } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

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
    { key: 'sl_no', label: 'SL.', width: 'w-16', defaultVisible: true },
    { key: 'guest_name', label: 'GUEST NAME / PROFILE', width: 'min-w-[320px]', defaultVisible: true },
    { key: 'from', label: 'START DATE', width: 'w-32', defaultVisible: true },
    { key: 'to', label: 'END DATE', width: 'w-32', defaultVisible: true },
    { key: 'total_days', label: 'DAYS', width: 'w-20', defaultVisible: true },
    { key: 'actual_fees', label: 'NET FEES', width: 'w-36', defaultVisible: true },
    { key: 'carry_forward', label: 'PREV. ACCRUAL', width: 'w-36', defaultVisible: true },
    { key: 'current_month_rev', label: 'PERIOD REVENUE', width: 'w-40', defaultVisible: true }, 
    { key: 'balance', label: 'DEFERRED', width: 'w-36', defaultVisible: true },
];

const Reports = () => {
  const { user } = useAuth();
  const { settings, currentOutlet, currentProperty, formatMoney, hasPermission } = useSettings();
  const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(
    ALL_POSSIBLE_COLUMNS.filter(c => c.defaultVisible).map(c => c.key)
  );
  const [showConfig, setShowConfig] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
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
    
    // Logic: Multi-page Tiled Render
    // We capture the entire element at high scale, then iterate through vertical slices
    // that fit perfectly onto landscape A4/A3 page formats.
    const element = reportRef.current;
    const originalScrollPos = window.scrollY;
    window.scrollTo(0, 0);

    try {
      const scale = 2.5; // High-res for professional banking standards
      const canvas = await html2canvas(element, { 
        scale: scale,
        useCORS: true, 
        backgroundColor: '#ffffff',
        logging: false,
        width: element.scrollWidth,
        height: element.scrollHeight,
        onclone: (clonedDoc) => {
            const container = clonedDoc.querySelector('.print-container') as HTMLElement;
            if (container) {
                container.style.boxShadow = 'none';
                container.style.border = 'none';
                container.style.borderRadius = '0';
                container.style.margin = '0';
                container.style.padding = '100px'; 
            }
        }
      });
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Page setup for landscape
      const pdf = new jsPDF('l', 'px', [imgWidth, (imgWidth * 0.707)]); // A-series landscape aspect ratio
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate how many physical pages are needed
      const totalPages = Math.ceil(imgHeight / pageHeight);
      
      for (let i = 0; i < totalPages; i++) {
          if (i > 0) pdf.addPage();
          
          // Slice the canvas for the current page
          const sourceY = i * pageHeight;
          const sectionCanvas = document.createElement('canvas');
          sectionCanvas.width = imgWidth;
          sectionCanvas.height = Math.min(pageHeight, imgHeight - sourceY);
          
          const ctx = sectionCanvas.getContext('2d');
          if (ctx) {
              ctx.drawImage(canvas, 0, sourceY, imgWidth, sectionCanvas.height, 0, 0, imgWidth, sectionCanvas.height);
              const imgData = sectionCanvas.toDataURL('image/jpeg', 0.9);
              pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, sectionCanvas.height * (pageWidth / imgWidth));
          }
      }
      
      pdf.save(`Ledger_${currentOutlet?.name || 'TTH'}_${reportMonth}.pdf`);
    } catch (err) { 
        console.error("PDF engine failure:", err); 
    } finally { 
        window.scrollTo(0, originalScrollPos);
        setIsGeneratingPDF(false); 
    }
  };

  const canExport = hasPermission(user?.role_id || '', 'reports:export');
  let globalIndexCounter = 0;

  return (
    <div className="space-y-6">
        <style>
          {`
            @media print {
              @page { size: landscape; margin: 15mm; }
              body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .print-container { 
                margin: 0 !important; 
                padding: 0 !important; 
                box-shadow: none !important; 
                border: none !important;
                width: 100% !important;
                max-width: 100% !important;
                min-height: auto !important;
                overflow: visible !important;
              }
              .no-print { display: none !important; }
              .signature-block { page-break-inside: avoid !important; margin-top: 50mm !important; break-before: auto !important; }
              table { width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; }
              thead { display: table-header-group !important; }
              tr { page-break-inside: avoid !important; page-break-after: auto !important; }
              td, th { overflow: hidden !important; }
            }
            .deferred-text { color: #dc2626 !important; font-weight: 900 !important; }
            .revenue-text { color: #4f46e5 !important; font-weight: 900 !important; }
          `}
        </style>
        
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-3xl shadow-sm no-print border border-slate-200 gap-4">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                    <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tighter">Revenue Ledger</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Financial Reporting</p>
                </div>
                <div className="h-10 w-px bg-slate-200 mx-2 hidden sm:block"></div>
                <input 
                    type="month" 
                    value={reportMonth} 
                    onChange={e => setReportMonth(e.target.value)}
                    className="h-11 px-5 rounded-xl border border-slate-200 font-black text-xs uppercase tracking-[0.2em] bg-slate-50 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                />
            </div>
            <div className="flex gap-3">
                <Button variant="outline" className={`rounded-xl font-black text-[10px] uppercase tracking-widest h-11 px-6 border-slate-200 transition-all ${showConfig ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : ''}`} onClick={() => setShowConfig(!showConfig)}>
                    <Settings2 className="w-4 h-4 mr-2" /> Columns
                </Button>
                
                {showConfig && (
                    <div className="absolute top-24 right-48 mt-3 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl p-5 z-[100] w-72">
                        <div className="flex justify-between items-center mb-4 pb-3 border-b">
                            <span className="text-[10px] font-black uppercase text-slate-400">Visibility Setup</span>
                            <button onClick={() => setShowConfig(false)} className="text-slate-400 p-1 hover:bg-slate-50 rounded-lg transition-colors"><X className="w-4 h-4"/></button>
                        </div>
                        <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
                            {ALL_POSSIBLE_COLUMNS.map(col => (
                                <button key={col.key} onClick={() => toggleColumn(col.key)} className={`w-full flex items-center justify-between p-3 rounded-xl text-left text-[11px] font-bold transition-all ${visibleColumnKeys.includes(col.key) ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50 border border-transparent'}`}>
                                    {col.label} {visibleColumnKeys.includes(col.key) && <Check className="w-3.5 h-3.5"/>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                <Button variant="outline" className="rounded-xl font-black text-[10px] uppercase tracking-widest h-11 px-6 border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-all" onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" /> Print
                </Button>
                
                {canExport && (
                  <Button className="rounded-xl font-black text-[10px] uppercase tracking-widest h-11 px-8 shadow-xl shadow-indigo-100 transition-all" onClick={handleDownloadPDF} isLoading={isGeneratingPDF}>
                    {isGeneratingPDF ? 'Compiling Pages...' : 'Download PDF'} <FileDown className="w-4 h-4 ml-2" />
                  </Button>
                )}
            </div>
        </div>

        {/* Professional Document Layer */}
        <div ref={reportRef} className="bg-white p-12 md:p-24 rounded-[3.5rem] shadow-2xl max-w-[1700px] mx-auto min-h-screen print-container border border-slate-50 relative flex flex-col">
            
            {/* Executive Branding Header */}
            <div className="flex flex-col md:flex-row justify-between items-start border-b-[6px] border-slate-950 pb-12 mb-12 gap-10 min-w-[1200px]">
                <div className="flex items-center gap-12">
                    {currentProperty?.logo_url ? (
                        <img src={currentProperty.logo_url} alt="Logo" className="h-40 w-auto object-contain shrink-0" />
                    ) : (
                        <div className="w-28 h-28 bg-slate-900 rounded-[2rem] flex items-center justify-center shadow-xl shrink-0">
                          <Building2 className="w-12 h-12 text-white" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-slate-950 leading-[0.8] mb-4">
                            {currentProperty?.name || 'The Torch Doha'}
                        </h1>
                        <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.4em] mb-10">{currentProperty?.address || 'Corporate Headquarters'}</p>
                        <div className="flex items-center gap-6 flex-wrap">
                          <div className="flex items-center gap-4 bg-indigo-600 text-white px-8 py-4 rounded-2xl shadow-xl shadow-indigo-100">
                              <Activity className="w-5 h-5" />
                              <span className="text-[11px] font-black uppercase tracking-[0.2em]">{currentOutlet?.name || 'Health Club'}</span>
                          </div>
                          <div className="px-6 py-4 border-[3px] border-slate-100 rounded-2xl text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                            REF: {reportMonth}-STMT
                          </div>
                        </div>
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <h2 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 mb-4 text-right">Audit Interval</h2>
                    <p className="text-6xl font-black text-slate-950 tracking-tighter tabular-nums mb-4">
                        {format(parseISO(reportMonth + '-01'), 'MMMM yyyy')}
                    </p>
                    <div className="inline-flex items-center gap-4 px-6 py-3 bg-emerald-50 border-[2px] border-emerald-100 rounded-2xl text-[10px] font-black text-emerald-700 uppercase tracking-[0.2em] shadow-sm">
                        <ShieldCheck className="w-5 h-5"/> RECONCILED AUDIT
                    </div>
                </div>
            </div>

            {/* Financial Ledger Core */}
            <div className="flex-1">
                <table className="w-full text-[13px] border-collapse min-w-[1200px]">
                    <thead>
                        <tr className="bg-[#0f172a] text-white">
                            {activeColumns.map(col => (
                                <th key={col.key} className={`px-6 py-8 text-center font-black uppercase tracking-[0.2em] border-r border-white/10 last:border-0 ${col.width}`}>
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
                            <tr className="bg-slate-50/40 border-b-2 border-slate-100">
                                <td colSpan={activeColumns.length} className="px-10 py-10">
                                <div className="flex items-center gap-6">
                                    <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-100"><ReceiptText className="w-5 h-5 text-white" /></div>
                                    <span className="text-[14px] font-black uppercase tracking-[0.4em] text-slate-950">{catName}</span>
                                    <span className="ml-4 px-4 py-1.5 bg-white border-2 border-slate-200 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest shadow-sm">
                                        {groupRows.length} ACTIVE ACCOUNTS
                                    </span>
                                </div>
                                </td>
                            </tr>
                            
                            {groupRows.map((row) => {
                                globalIndexCounter++;
                                return (
                                    <tr key={`${row.membership_no}-${row.sl_no}`} className="hover:bg-slate-50/50 transition-colors">
                                        {activeColumns.map(col => (
                                            <td key={col.key} className={`px-6 py-6 border-r border-slate-50 last:border-0 ${['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(col.key) ? 'text-right tabular-nums' : 'text-center'} ${col.key === 'guest_name' ? 'text-left font-black text-slate-800' : ''}`}>
                                                <span className={`
                                                    ${col.key === 'current_month_rev' ? 'revenue-text' : ''} 
                                                    ${col.key === 'balance' && row.balance > 0 ? 'deferred-text' : ''}
                                                    ${['actual_fees', 'carry_forward'].includes(col.key) ? 'font-bold text-slate-700' : ''}
                                                `}>
                                                    {col.key === 'sl_no' ? globalIndexCounter : (
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

                            <tr className="bg-indigo-50/10 border-y-2 border-indigo-100/30">
                                <td colSpan={activeColumns.findIndex(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key))} className="px-10 py-6 text-right">
                                    <span className="text-[11px] font-black uppercase tracking-[0.3em] text-indigo-400">
                                        SUB-TOTAL: {catName}
                                    </span>
                                </td>
                                {activeColumns.filter(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key)).map(col => (
                                    <td key={col.key} className={`px-6 py-6 text-right font-black border-x-2 border-white ${col.key === 'current_month_rev' ? 'text-indigo-950 bg-indigo-50/40' : 'text-slate-800'}`}>
                                        {col.key === 'actual_fees' ? formatMoney(groupTotals.fees) : col.key === 'carry_forward' ? formatMoney(groupTotals.prev) : col.key === 'current_month_rev' ? formatMoney(groupTotals.current) : formatMoney(groupTotals.balance)}
                                    </td>
                                ))}
                                {activeColumns.filter(c => !['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key) && activeColumns.indexOf(c) > activeColumns.findIndex(d => d.key === 'balance')).map(col => (
                                    <td key={col.key} className="px-6 py-6"></td>
                                ))}
                            </tr>
                            </React.Fragment>
                        );
                        })}
                    </tbody>

                    <tfoot>
                        <tr className="bg-slate-950 text-white shadow-2xl relative z-10">
                        <td colSpan={activeColumns.findIndex(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key))} className="px-12 py-10 text-right text-[13px] font-black uppercase tracking-[0.6em] border-r border-white/5">
                            CONSOLIDATED LEDGER TOTALS
                        </td>
                        {activeColumns.filter(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key)).map(col => (
                            <td key={col.key} className={`px-6 py-10 text-right font-black border-r border-white/5 last:border-0 ${col.key === 'current_month_rev' ? 'bg-indigo-700' : ''}`}>
                                {col.key === 'actual_fees' ? formatMoney(totals.fees) : col.key === 'carry_forward' ? formatMoney(totals.prev) : col.key === 'current_month_rev' ? formatMoney(totals.current) : formatMoney(totals.balance)}
                            </td>
                        ))}
                        {activeColumns.filter(c => !['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key) && activeColumns.indexOf(c) > activeColumns.findIndex(d => d.key === 'balance')).map(col => (
                            <td key={col.key} className="px-6 py-10 border-l border-white/5"></td>
                        ))}
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Authoritative Signatory Block */}
            <div className="signature-block mt-40 pt-20 border-t-[4px] border-slate-100 flex justify-between items-start gap-24 min-w-[1200px]">
                <div className="flex-1 text-center space-y-16">
                    <p className="text-[15px] font-black text-slate-900 uppercase tracking-[0.4em]">Prepared By:</p>
                    <div className="pt-10 border-t-[2px] border-slate-200 w-4/5 mx-auto">
                      <p className="text-[13px] font-bold text-slate-500 uppercase tracking-widest leading-loose">
                        {settings?.signatory_prepared_role || 'Cluster Income Auditor'}
                      </p>
                    </div>
                </div>

                <div className="flex-1 text-center space-y-16">
                    <p className="text-[15px] font-black text-slate-900 uppercase tracking-[0.4em]">Reviewed By:</p>
                    <div className="pt-10 border-t-[2px] border-slate-200 w-4/5 mx-auto">
                      <p className="text-[13px] font-bold text-slate-500 uppercase tracking-widest leading-loose">
                        {settings?.signatory_reviewed_role || 'Cluster Assist. Financial Controller'}
                      </p>
                    </div>
                </div>

                <div className="flex-1 text-center space-y-16">
                    <p className="text-[15px] font-black text-slate-900 uppercase tracking-[0.4em]">Approved By:</p>
                    <div className="pt-10 border-t-[2px] border-slate-200 w-4/5 mx-auto">
                      <p className="text-[13px] font-bold text-slate-500 uppercase tracking-widest leading-loose">
                        {settings?.signatory_approved_role || 'Cluster Ex- Assist. Director of Finance'}
                      </p>
                    </div>
                </div>
            </div>
            
            <div className="mt-24 pt-8 border-t-2 border-slate-50 text-center opacity-30">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.8em]">Automated Financial Audit Integrity Report &bull; Generated: {format(new Date(), 'PPpp')}</p>
            </div>
        </div>
    </div>
  );
};

export default Reports;
