
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Button } from '../components/ui';
import { db } from '../services/mockSupabase';
import { MembershipCategory, Member, Freeze } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, endOfMonth, differenceInCalendarDays, addDays } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { Activity, Building2, ReceiptText, Settings2, Check, X, ShieldCheck, FileText, Printer, FileDown, Globe } from 'lucide-react';
import jsPDF from 'jspdf';
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
    { key: 'actual_fees', label: 'NET FEES', width: 'w-28', defaultVisible: true },
    { key: 'carry_forward', label: 'PREV. ACCRUAL', width: 'w-28', defaultVisible: true },
    { key: 'current_month_rev', label: 'PERIOD REV', width: 'w-32', defaultVisible: true }, 
    { key: 'balance', label: 'DEFERRED', width: 'w-28', defaultVisible: true },
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
  
  const logoUrl = currentProperty?.logo_url || settings?.logo_url;
  const [imgError, setImgError] = useState(false);

  useEffect(() => { if (currentOutlet) loadData(); }, [reportMonth, currentOutlet]);
  
  useEffect(() => {
    setImgError(false);
  }, [logoUrl]);

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
                from: format(parseISO(m.start_date), 'dd-MM-yyyy'),
                to: format(parseISO(m.current_end_date), 'dd-MM-yyyy'),
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
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
        width: 1300, 
        windowWidth: 1300,
        onclone: (clonedDoc) => {
            const container = clonedDoc.querySelector('.print-container') as HTMLElement;
            if (container) {
                container.style.boxShadow = 'none';
                container.style.margin = '0';
                container.style.padding = '40px'; 
                container.style.width = '1300px';
                container.style.maxWidth = '1300px';
            }
        }
      });
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
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
              const imgData = sectionCanvas.toDataURL('image/jpeg', 0.95);
              pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, sectionCanvas.height * (pageWidth / imgWidth));
          }
      }
      
      pdf.save(`Ledger_${currentOutlet?.name || 'ERP'}_${reportMonth}.pdf`);
    } catch (err) { 
        console.error("PDF Error:", err); 
        alert("PDF Generation Failed. This can happen if the logo image server has strict CORS policies. Please try using the Print option or check the browser console for more details.");
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
              @page { size: landscape; margin: 0; }
              body { background: white !important; }
              body * {
                visibility: hidden;
              }
              .print-container, .print-container * {
                visibility: visible;
              }
              .print-container {
                position: absolute;
                left: 0;
                top: 0;
                margin: 0 !important;
                padding: 10mm !important;
                width: 100% !important;
                box-shadow: none !important;
                border: none !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .no-print { display: none !important; }
              thead { display: table-header-group !important; }
              tr { page-break-inside: avoid !important; }
            }
          `}
        </style>
        
        {/* Navigation / Controls */}
        <div className="flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm no-print border border-slate-200 gap-4">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                    <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-slate-900 leading-none">Financial Ledger</h2>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Audit Reporting Suite</p>
                </div>
                <div className="h-8 w-px bg-slate-200 mx-2 hidden sm:block"></div>
                <input 
                    type="month" 
                    value={reportMonth} 
                    onChange={e => setReportMonth(e.target.value)}
                    className="h-10 px-3 rounded-lg border border-slate-200 font-bold text-xs uppercase bg-slate-50 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                />
            </div>
            <div className="flex gap-2">
                <Button variant="outline" className="rounded-lg font-bold text-[10px] uppercase h-10 px-4 border-slate-200" onClick={() => setShowConfig(!showConfig)}>
                    <Settings2 className="w-4 h-4 mr-2" /> Columns
                </Button>
                {showConfig && (
                    <div className="absolute top-24 right-48 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl p-4 z-[100] w-64">
                        <div className="flex justify-between items-center mb-3 pb-2 border-b">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Visibility</span>
                            <button onClick={() => setShowConfig(false)} className="text-slate-400 p-1 hover:bg-slate-50 rounded-lg"><X className="w-4 h-4"/></button>
                        </div>
                        <div className="space-y-1">
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
                    {isGeneratingPDF ? 'Exporting...' : 'Export PDF'} <FileDown className="w-4 h-4 ml-2" />
                  </Button>
                )}
            </div>
        </div>

        {/* Corporate Report Document */}
        <div ref={reportRef} className="bg-white p-12 md:p-16 rounded-[1rem] shadow-2xl max-w-[1300px] mx-auto min-h-screen print-container border border-slate-100 flex flex-col overflow-hidden">
            
            {/* Professional Letterhead Header */}
            <div className="flex flex-row justify-between items-center border-b-4 border-slate-900 pb-8 mb-10 min-w-[1100px]">
                <div className="flex items-center gap-6">
                    {/* Logo Section */}
                    <div className="w-24 h-24 shrink-0 flex items-center justify-center">
                        {logoUrl && !imgError ? (
                            <img 
                                src={logoUrl} 
                                alt="Company Logo" 
                                className="w-full h-full object-contain company-logo-img"
                                onError={() => setImgError(true)}
                                crossOrigin="anonymous"
                            />
                        ) : (
                            <div className="w-full h-full bg-slate-900 text-white flex items-center justify-center rounded-xl">
                                <Globe className="w-10 h-10" />
                            </div>
                        )}
                    </div>
                    
                    {/* Company Identity */}
                    <div className="flex flex-col justify-center h-full pt-2">
                        <h1 className="text-4xl font-serif font-bold text-slate-950 leading-none mb-3 tracking-tight">
                            {currentProperty?.name || settings?.name || 'Corporate Ledger'}
                        </h1>
                        <div className="flex flex-col gap-1">
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                {currentProperty?.address || settings?.address || 'Corporate Headquarters'}
                            </p>
                            <p className="text-[11px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
                                <Building2 className="w-3 h-3" /> Facility: {currentOutlet?.name || 'Authorized Facility'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Document Context */}
                <div className="text-right flex flex-col items-end">
                    <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">
                        Financial Ledger
                    </h2>
                    <p className="text-lg font-medium text-slate-500 mb-4">
                        {format(parseISO(reportMonth + '-01'), 'MMMM yyyy')}
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded text-[10px] font-black uppercase tracking-widest text-slate-600">
                        <ShieldCheck className="w-3 h-3"/> Verified Audit Trail
                    </div>
                </div>
            </div>

            {/* Financial Ledger Section */}
            <div className="flex-1">
                <table className="w-full text-[10px] border-collapse min-w-[1100px]">
                    <thead>
                        <tr className="bg-slate-950 text-white border-b-4 border-slate-950">
                            {activeColumns.map(col => (
                                <th key={col.key} className={`px-4 py-4 text-center font-bold uppercase tracking-widest border-r border-white/10 last:border-0 ${col.width}`}>
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
                            <tr className="bg-slate-50 border-b border-slate-300">
                                <td colSpan={activeColumns.length} className="px-6 py-4">
                                <div className="flex items-center">
                                    <ReceiptText className="w-4 h-4 text-indigo-600 mr-3" />
                                    <span className="text-[12px] font-black uppercase tracking-widest text-slate-900 mr-4">{catName}</span>
                                    <span className="text-[9px] font-bold text-slate-500 uppercase">
                                        ({groupRows.length} Records)
                                    </span>
                                </div>
                                </td>
                            </tr>
                            
                            {groupRows.map((row) => {
                                globalIndexCounter++;
                                return (
                                    <tr key={`${row.membership_no}-${row.sl_no}`} className="hover:bg-slate-50/50">
                                        {activeColumns.map(col => (
                                            <td key={col.key} className={`px-4 py-3 border-r border-slate-100 last:border-0 ${['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(col.key) ? 'text-right tabular-nums' : 'text-center'} ${col.key === 'guest_name' ? 'text-left font-bold text-slate-800' : ''}`}>
                                                <span className={`
                                                    ${col.key === 'current_month_rev' ? 'text-indigo-700 font-bold' : ''} 
                                                    ${col.key === 'balance' && row.balance > 0 ? 'text-red-600 font-black' : ''}
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

                            <tr className="bg-indigo-50/30 border-y-2 border-slate-200 font-bold">
                                <td colSpan={activeColumns.findIndex(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key))} className="px-6 py-3 text-right">
                                    <span className="text-[9px] uppercase tracking-widest text-indigo-900">
                                        Subtotal: {catName}
                                    </span>
                                </td>
                                {activeColumns.filter(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key)).map(col => (
                                    <td key={col.key} className={`px-4 py-3 text-right border-x border-white`}>
                                        {col.key === 'actual_fees' ? formatMoney(groupTotals.fees) : col.key === 'carry_forward' ? formatMoney(groupTotals.prev) : col.key === 'current_month_rev' ? formatMoney(groupTotals.current) : formatMoney(groupTotals.balance)}
                                    </td>
                                ))}
                                {activeColumns.slice(activeColumns.findIndex(c => c.key === 'balance') + 1).map(col => (
                                    <td key={col.key} className="px-4 py-3"></td>
                                ))}
                            </tr>
                            </React.Fragment>
                        );
                        })}
                    </tbody>

                    <tfoot>
                        <tr className="bg-slate-900 text-white shadow-2xl border-t-4 border-slate-950">
                        <td colSpan={activeColumns.findIndex(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key))} className="px-8 py-6 text-right text-[11px] font-black uppercase tracking-[0.3em] border-r border-white/10">
                            Grand Totals
                        </td>
                        {activeColumns.filter(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key)).map(col => (
                            <td key={col.key} className={`px-4 py-6 text-right font-black border-r border-white/10 last:border-0 text-xs ${col.key === 'current_month_rev' ? 'bg-indigo-600' : ''}`}>
                                {col.key === 'actual_fees' ? formatMoney(totals.fees) : col.key === 'carry_forward' ? formatMoney(totals.prev) : col.key === 'current_month_rev' ? formatMoney(totals.current) : formatMoney(totals.balance)}
                            </td>
                        ))}
                        {activeColumns.slice(activeColumns.findIndex(c => c.key === 'balance') + 1).map(col => (
                            <td key={col.key} className="px-4 py-6 border-l border-white/10"></td>
                        ))}
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Authoritative Signatory Grid */}
            <div className="signature-block mt-16 pt-12 border-t-2 border-slate-200 flex justify-between items-start gap-12 min-w-[1100px]">
                <div className="flex-1 space-y-10">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Prepared By</p>
                    <div className="border-b border-slate-300 pb-2"></div>
                    <p className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">
                        {settings?.signatory_prepared_role || 'Income Auditor'}
                    </p>
                </div>

                <div className="flex-1 space-y-10">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Reviewed By</p>
                    <div className="border-b border-slate-300 pb-2"></div>
                    <p className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">
                        {settings?.signatory_reviewed_role || 'Financial Controller'}
                    </p>
                </div>

                <div className="flex-1 space-y-10">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-8">Approved By</p>
                    <div className="border-b border-slate-300 pb-2"></div>
                    <p className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">
                        {settings?.signatory_approved_role || 'Director of Finance'}
                    </p>
                </div>
            </div>
            
            <div className="mt-16 text-center opacity-40">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[1em]">
                    &copy; {new Date().getFullYear()} saavar group. All Rights Reserved.
                </p>
            </div>
        </div>
    </div>
  );
};

export default Reports;
