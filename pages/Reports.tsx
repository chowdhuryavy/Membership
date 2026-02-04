
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Button, Card } from '../components/ui';
import { db } from '../services/mockSupabase';
import { MembershipCategory, Member, Freeze } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, endOfMonth, differenceInCalendarDays, addDays } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Building2, ReceiptText, Settings2, Check, X, ShieldCheck, FileText, Printer, FileDown } from 'lucide-react';
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
    { key: 'sl_no', label: 'SL.', width: 'w-12', defaultVisible: true },
    { key: 'guest_name', label: 'GUEST NAME / PROFILE', width: 'min-w-[280px]', defaultVisible: true },
    { key: 'from', label: 'START DATE', width: 'w-28', defaultVisible: true },
    { key: 'to', label: 'END DATE', width: 'w-28', defaultVisible: true },
    { key: 'total_days', label: 'DAYS', width: 'w-16', defaultVisible: true },
    { key: 'actual_fees', label: 'NET FEES', width: 'w-32', defaultVisible: true },
    { key: 'carry_forward', label: 'PREV. ACCRUAL', width: 'w-32', defaultVisible: true },
    { key: 'current_month_rev', label: 'PERIOD REVENUE', width: 'w-36', defaultVisible: true }, 
    { key: 'balance', label: 'DEFERRED', width: 'w-32', defaultVisible: true },
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
    
    const element = reportRef.current;
    const originalScrollPos = window.scrollY;
    window.scrollTo(0, 0);

    try {
      const scale = 2.0; 
      const canvas = await html2canvas(element, { 
        scale: scale,
        useCORS: true, 
        backgroundColor: '#ffffff',
        logging: false,
        width: 1400, // Fixed width for landscape consistency
        onclone: (clonedDoc) => {
            const container = clonedDoc.querySelector('.print-container') as HTMLElement;
            if (container) {
                container.style.boxShadow = 'none';
                container.style.border = 'none';
                container.style.borderRadius = '0';
                container.style.margin = '0';
                container.style.padding = '40px'; 
                container.style.width = '1320px';
            }
            // Remove any web-only buttons in the clone
            clonedDoc.querySelectorAll('.no-print').forEach(el => (el as HTMLElement).style.display = 'none');
        }
      });
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Page setup: landscape. 0.707 is A4/A3 ratio for landscape slicing
      const pdf = new jsPDF('l', 'px', [imgWidth, (imgWidth * 0.707)]); 
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const totalPages = Math.ceil(imgHeight / pageHeight);
      
      for (let i = 0; i < totalPages; i++) {
          if (i > 0) pdf.addPage();
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
          
          // Page number footer in PDF
          pdf.setFontSize(10);
          pdf.setTextColor(150);
          pdf.text(`Generated by TTH ERP • Page ${i + 1} of ${totalPages}`, 40, pageHeight - 20);
      }
      
      pdf.save(`Revenue_Audit_${currentOutlet?.name || 'ERP'}_${reportMonth}.pdf`);
    } catch (err) { 
        console.error("PDF Engine Error:", err); 
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
              @page { size: landscape; margin: 10mm; }
              body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .print-container { 
                margin: 0 !important; 
                padding: 10mm !important; 
                box-shadow: none !important; 
                border: none !important;
                width: 100% !important;
                max-width: 100% !important;
                overflow: visible !important;
              }
              .no-print { display: none !important; }
              .signature-block { page-break-inside: avoid !important; margin-top: 30mm !important; }
              thead { display: table-header-group !important; }
              tr { page-break-inside: avoid !important; }
            }
            .deferred-text { color: #dc2626 !important; font-weight: 800 !important; }
            .revenue-text { color: #4f46e5 !important; font-weight: 800 !important; }
          `}
        </style>
        
        {/* Controls Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-5 rounded-2xl shadow-sm no-print border border-slate-200 gap-4">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                    <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-slate-900">Financial Ledger</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Revenue Audit Engine</p>
                </div>
                <div className="h-8 w-px bg-slate-200 mx-1 hidden sm:block"></div>
                <input 
                    type="month" 
                    value={reportMonth} 
                    onChange={e => setReportMonth(e.target.value)}
                    className="h-10 px-4 rounded-lg border border-slate-200 font-bold text-xs uppercase bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
            </div>
            <div className="flex gap-2">
                <Button variant="outline" className="rounded-lg font-bold text-[10px] uppercase h-10 px-4 border-slate-200 transition-all" onClick={() => setShowConfig(!showConfig)}>
                    <Settings2 className="w-4 h-4 mr-2" /> Columns
                </Button>
                {showConfig && (
                    <div className="absolute top-24 right-48 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl p-4 z-[100] w-64 animate-in fade-in slide-in-from-top-2">
                        <div className="flex justify-between items-center mb-3 pb-2 border-b">
                            <span className="text-[10px] font-black uppercase text-slate-400">Ledger View</span>
                            <button onClick={() => setShowConfig(false)} className="text-slate-400 p-1 hover:bg-slate-50 rounded-lg"><X className="w-4 h-4"/></button>
                        </div>
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                            {ALL_POSSIBLE_COLUMNS.map(col => (
                                <button key={col.key} onClick={() => toggleColumn(col.key)} className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left text-[10px] font-bold transition-all ${visibleColumnKeys.includes(col.key) ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>
                                    {col.label} {visibleColumnKeys.includes(col.key) && <Check className="w-3.5 h-3.5"/>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                <Button variant="outline" className="rounded-lg font-bold text-[10px] uppercase h-10 px-4 border-indigo-200 text-indigo-600" onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" /> Print
                </Button>
                {canExport && (
                  <Button className="rounded-lg font-black text-[10px] uppercase h-10 px-6 shadow-md shadow-indigo-100" onClick={handleDownloadPDF} isLoading={isGeneratingPDF}>
                    {isGeneratingPDF ? 'Exporting...' : 'Download PDF'} <FileDown className="w-4 h-4 ml-2" />
                  </Button>
                )}
            </div>
        </div>

        {/* The Professional Document Layer */}
        <div ref={reportRef} className="bg-white p-12 md:p-16 rounded-[1rem] shadow-xl max-w-[1400px] mx-auto min-h-screen print-container border border-slate-100 flex flex-col overflow-hidden">
            
            {/* Optimized Landscape Header Grid */}
            <div className="grid grid-cols-3 items-start gap-8 border-b-4 border-slate-900 pb-8 mb-10 min-w-[1200px]">
                {/* Column 1: Brand Logo */}
                <div className="flex items-center gap-6">
                    {currentProperty?.logo_url ? (
                        <img src={currentProperty.logo_url} alt="Logo" className="h-24 w-auto object-contain" />
                    ) : (
                        <div className="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg shrink-0">
                          <Building2 className="w-10 h-10 text-white" />
                        </div>
                    )}
                    <div className="hidden xl:block">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Portfolio Parent</span>
                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-tighter">{currentProperty?.name || 'TTH HQ'}</h4>
                    </div>
                </div>

                {/* Column 2: Facility & Identity (Center Alignment) */}
                <div className="text-center">
                    <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-950 leading-tight mb-2">
                        {currentProperty?.name || 'The Torch Doha'}
                    </h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">
                        {currentProperty?.address || 'Corporate Headquarters'}
                    </p>
                    <div className="mt-6 inline-flex items-center gap-4 bg-indigo-600 text-white px-8 py-3 rounded-xl shadow-lg">
                        <Activity className="w-4 h-4" />
                        <span className="text-[11px] font-black uppercase tracking-widest">{currentOutlet?.name || 'Health Club'}</span>
                    </div>
                </div>

                {/* Column 3: Audit Period (Right Alignment) */}
                <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-1">Audit Interval</p>
                    <h2 className="text-4xl font-black text-slate-950 tracking-tighter tabular-nums mb-3">
                        {format(parseISO(reportMonth + '-01'), 'MMMM yyyy')}
                    </h2>
                    <div className="inline-flex items-center gap-3 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl text-[10px] font-black text-emerald-700 uppercase tracking-widest shadow-sm">
                        <ShieldCheck className="w-4 h-4"/> RECONCILED AUDIT
                    </div>
                    <div className="mt-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">REF: {reportMonth}-STMT</div>
                </div>
            </div>

            {/* Main Ledger Table */}
            <div className="flex-1">
                <table className="w-full text-[12px] border-collapse min-w-[1200px]">
                    <thead>
                        <tr className="bg-[#0f172a] text-white">
                            {activeColumns.map(col => (
                                <th key={col.key} className={`px-4 py-4 text-center font-black uppercase tracking-widest border-r border-white/10 last:border-0 ${col.width}`}>
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
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
                            <tr className="bg-slate-50/60 border-b border-slate-200">
                                <td colSpan={activeColumns.length} className="px-6 py-5">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 bg-indigo-100 rounded-lg"><ReceiptText className="w-4 h-4 text-indigo-600" /></div>
                                    <span className="text-[13px] font-black uppercase tracking-widest text-slate-950">{catName}</span>
                                    <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                        {groupRows.length} Accounts
                                    </span>
                                </div>
                                </td>
                            </tr>
                            
                            {groupRows.map((row) => {
                                globalIndexCounter++;
                                return (
                                    <tr key={`${row.membership_no}-${row.sl_no}`} className="hover:bg-slate-50 transition-colors">
                                        {activeColumns.map(col => (
                                            <td key={col.key} className={`px-4 py-4 border-r border-slate-100 last:border-0 ${['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(col.key) ? 'text-right tabular-nums' : 'text-center'} ${col.key === 'guest_name' ? 'text-left font-bold text-slate-800' : ''}`}>
                                                <span className={`
                                                    ${col.key === 'current_month_rev' ? 'revenue-text' : ''} 
                                                    ${col.key === 'balance' && row.balance > 0 ? 'deferred-text' : ''}
                                                    ${['actual_fees', 'carry_forward'].includes(col.key) ? 'text-slate-600' : ''}
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

                            <tr className="bg-indigo-50/10 border-y border-indigo-100">
                                <td colSpan={activeColumns.findIndex(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key))} className="px-6 py-4 text-right">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">
                                        SUB-TOTAL: {catName}
                                    </span>
                                </td>
                                {activeColumns.filter(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key)).map(col => (
                                    <td key={col.key} className={`px-4 py-4 text-right font-black border-x border-white ${col.key === 'current_month_rev' ? 'text-indigo-950 bg-indigo-50/30' : 'text-slate-800'}`}>
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

                    <tfoot>
                        <tr className="bg-slate-950 text-white shadow-lg">
                        <td colSpan={activeColumns.findIndex(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key))} className="px-8 py-8 text-right text-[12px] font-black uppercase tracking-widest border-r border-white/5">
                            Consolidated Ledger Totals
                        </td>
                        {activeColumns.filter(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key)).map(col => (
                            <td key={col.key} className={`px-4 py-8 text-right font-black border-r border-white/5 last:border-0 ${col.key === 'current_month_rev' ? 'bg-indigo-700' : ''}`}>
                                {col.key === 'actual_fees' ? formatMoney(totals.fees) : col.key === 'carry_forward' ? formatMoney(totals.prev) : col.key === 'current_month_rev' ? formatMoney(totals.current) : formatMoney(totals.balance)}
                            </td>
                        ))}
                        {activeColumns.filter(c => !['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key) && activeColumns.indexOf(c) > activeColumns.findIndex(d => d.key === 'balance')).map(col => (
                            <td key={col.key} className="px-4 py-8 border-l border-white/5"></td>
                        ))}
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Authoritative Signatory Block */}
            <div className="signature-block mt-24 pt-16 border-t-2 border-slate-100 flex justify-between items-start gap-20 min-w-[1200px]">
                <div className="flex-1 text-center space-y-12">
                    <p className="text-[13px] font-black text-slate-900 uppercase tracking-widest">Prepared By:</p>
                    <div className="pt-8 border-t border-slate-200 w-3/4 mx-auto">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                        {settings?.signatory_prepared_role || 'Cluster Income Auditor'}
                      </p>
                    </div>
                </div>

                <div className="flex-1 text-center space-y-12">
                    <p className="text-[13px] font-black text-slate-900 uppercase tracking-widest">Reviewed By:</p>
                    <div className="pt-8 border-t border-slate-200 w-3/4 mx-auto">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                        {settings?.signatory_reviewed_role || 'Cluster Assist. Financial Controller'}
                      </p>
                    </div>
                </div>

                <div className="flex-1 text-center space-y-12">
                    <p className="text-[13px] font-black text-slate-900 uppercase tracking-widest">Approved By:</p>
                    <div className="pt-8 border-t border-slate-200 w-3/4 mx-auto">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                        {settings?.signatory_approved_role || 'Cluster Ex- Assist. Director of Finance'}
                      </p>
                    </div>
                </div>
            </div>
            
            <div className="mt-20 pt-6 border-t border-slate-50 text-center opacity-40">
                <p className="text-[8px] font-black text-slate-300 uppercase tracking-[1em]">Automated Financial Integrity Audit • {format(new Date(), 'PPpp')}</p>
            </div>
        </div>
    </div>
  );
};

export default Reports;
