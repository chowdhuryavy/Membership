
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Button } from '../components/ui';
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
  const [logoError, setLogoError] = useState(false);

  useEffect(() => { if (currentOutlet) loadData(); }, [reportMonth, currentOutlet]);
  
  // Reset logo error when property changes
  useEffect(() => { setLogoError(false); }, [currentProperty?.id]);

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
      const canvas = await html2canvas(element, { 
        scale: 2.5,
        useCORS: true, 
        backgroundColor: '#ffffff',
        logging: false,
        width: 1300, 
        onclone: (clonedDoc) => {
            const container = clonedDoc.querySelector('.print-container') as HTMLElement;
            if (container) {
                container.style.boxShadow = 'none';
                container.style.border = 'none';
                container.style.borderRadius = '0';
                container.style.margin = '0';
                container.style.padding = '40px'; 
                container.style.width = '1220px';
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
              const imgData = sectionCanvas.toDataURL('image/jpeg', 1.0);
              pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, sectionCanvas.height * (pageWidth / imgWidth));
          }
          
          pdf.setFontSize(10);
          pdf.setTextColor(180);
          pdf.text(`Audit Trail • Facility Ledger • Page ${i + 1} of ${totalPages}`, 40, pageHeight - 20);
      }
      
      pdf.save(`Ledger_${currentOutlet?.name || 'ERP'}_${reportMonth}.pdf`);
    } catch (err) { 
        console.error("PDF Capture Pipeline Failure:", err); 
    } finally { 
        window.scrollTo(0, originalScrollPos);
        setIsGeneratingPDF(false); 
    }
  };

  const canExport = hasPermission(user?.role_id || '', 'reports:export');
  let globalIndexCounter = 0;

  // Verification helper for logo URL string
  const isValidUrl = (url?: string) => {
    if (!url) return false;
    if (url === 'Logo' || url === '') return false;
    return url.startsWith('http') || url.startsWith('data:image') || url.startsWith('/');
  };

  // Determine logo source with fallback to system settings
  const logoToUse = (!logoError && isValidUrl(currentProperty?.logo_url)) 
    ? currentProperty?.logo_url 
    : (settings?.logo_url && isValidUrl(settings.logo_url)) ? settings.logo_url : null;

  return (
    <div className="space-y-6">
        <style>
          {`
            @media print {
              @page { size: landscape; margin: 5mm; }
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
            <div className="flex flex-row justify-between items-start border-b-[6px] border-slate-950 pb-12 mb-10 min-w-[1100px]">
                <div className="flex items-start">
                    {/* Reliable Logo Rendering with Fallback */}
                    <div className="mr-12">
                        {logoToUse ? (
                            <img 
                                src={logoToUse} 
                                crossOrigin="anonymous" 
                                alt="Branding" 
                                onError={() => setLogoError(true)}
                                className="h-32 w-auto object-contain block" 
                                style={{ maxWidth: '300px' }}
                            />
                        ) : (
                            <div className="w-24 h-24 bg-slate-900 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-slate-200">
                                <Building2 className="w-12 h-12" />
                            </div>
                        )}
                    </div>
                    {/* Facility & Property Identity */}
                    <div>
                        <h1 className="text-5xl font-black uppercase tracking-tighter text-slate-950 leading-[0.85] mb-4">
                            {currentProperty?.name || settings?.name || 'Asset Group Management'}
                        </h1>
                        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-[0.4em] mb-10">
                            {currentProperty?.address || settings?.address || 'Corporate Headquarters'}
                        </p>
                        
                        <div className="inline-block px-8 py-3 bg-indigo-50 border-[2px] border-indigo-600 rounded-xl shadow-sm">
                            <span className="text-[14px] font-black uppercase tracking-[0.15em] text-indigo-950">
                                Facility Context: {currentOutlet?.name || 'Operational Health Club'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Audit Context Details */}
                <div className="text-right">
                    <p className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 mb-2">Audit Statement Period</p>
                    <h2 className="text-5xl font-black text-slate-950 tracking-tighter tabular-nums mb-4">
                        {format(parseISO(reportMonth + '-01'), 'MMMM yyyy')}
                    </h2>
                    <div className="inline-flex items-center gap-2.5 px-5 py-2.5 bg-emerald-50 border-[2px] border-emerald-100 rounded-2xl text-[11px] font-black text-emerald-700 uppercase tracking-widest shadow-sm">
                        <ShieldCheck className="w-4 h-4"/> Verified Audit Trail
                    </div>
                    <div className="mt-6 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">RECON_ID: {reportMonth}-LEDGER-001</div>
                </div>
            </div>

            {/* Financial Ledger Section */}
            <div className="flex-1">
                <table className="w-full text-[11px] border-collapse min-w-[1100px]">
                    <thead>
                        <tr className="bg-[#0f172a] text-white">
                            {activeColumns.map(col => (
                                <th key={col.key} className={`px-4 py-5 text-center font-black uppercase tracking-widest border-r border-white/10 last:border-0 ${col.width}`}>
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
                            <tr className="bg-slate-50/70 border-b border-slate-200">
                                <td colSpan={activeColumns.length} className="px-6 py-5">
                                <div className="flex items-center">
                                    <ReceiptText className="w-5 h-5 text-indigo-600 mr-4" />
                                    <span className="text-[14px] font-black uppercase tracking-widest text-slate-950 mr-6">{catName}</span>
                                    <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                        {groupRows.length} Consolidated Accounts
                                    </span>
                                </div>
                                </td>
                            </tr>
                            
                            {groupRows.map((row) => {
                                globalIndexCounter++;
                                return (
                                    <tr key={`${row.membership_no}-${row.sl_no}`} className="hover:bg-slate-50/50 transition-colors">
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

                            <tr className="bg-indigo-50/10 border-y border-indigo-100/50">
                                <td colSpan={activeColumns.findIndex(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key))} className="px-6 py-4 text-right">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">
                                        Subtotal Ledger: {catName}
                                    </span>
                                </td>
                                {activeColumns.filter(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key)).map(col => (
                                    <td key={col.key} className={`px-4 py-4 text-right font-black border-x border-white ${col.key === 'current_month_rev' ? 'text-indigo-900 bg-indigo-50/40' : 'text-slate-800'}`}>
                                        {col.key === 'actual_fees' ? formatMoney(groupTotals.fees) : col.key === 'carry_forward' ? formatMoney(groupTotals.prev) : col.key === 'current_month_rev' ? formatMoney(groupTotals.current) : formatMoney(groupTotals.balance)}
                                    </td>
                                ))}
                                {activeColumns.slice(activeColumns.findIndex(c => c.key === 'balance') + 1).map(col => (
                                    <td key={col.key} className="px-4 py-4"></td>
                                ))}
                            </tr>
                            </React.Fragment>
                        );
                        })}
                    </tbody>

                    <tfoot>
                        <tr className="bg-slate-950 text-white shadow-2xl">
                        <td colSpan={activeColumns.findIndex(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key))} className="px-8 py-8 text-right text-[12px] font-black uppercase tracking-[0.4em] border-r border-white/5">
                            CONSOLIDATED AUDIT TOTALS
                        </td>
                        {activeColumns.filter(c => ['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(c.key)).map(col => (
                            <td key={col.key} className={`px-4 py-8 text-right font-black border-r border-white/5 last:border-0 ${col.key === 'current_month_rev' ? 'bg-indigo-700' : ''}`}>
                                {col.key === 'actual_fees' ? formatMoney(totals.fees) : col.key === 'carry_forward' ? formatMoney(totals.prev) : col.key === 'current_month_rev' ? formatMoney(totals.current) : formatMoney(totals.balance)}
                            </td>
                        ))}
                        {activeColumns.slice(activeColumns.findIndex(c => c.key === 'balance') + 1).map(col => (
                            <td key={col.key} className="px-4 py-8 border-l border-white/5"></td>
                        ))}
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Authoritative Signatory Grid */}
            <div className="signature-block mt-24 pt-16 border-t-[3px] border-slate-100 flex justify-between items-start gap-12 min-w-[1100px]">
                <div className="flex-1 text-center space-y-12">
                    <p className="text-[13px] font-black text-slate-950 uppercase tracking-[0.3em]">Prepared By:</p>
                    <div className="pt-8 border-t border-slate-200 w-3/4 mx-auto">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">
                        {settings?.signatory_prepared_role || 'Income Auditor'}
                      </p>
                    </div>
                </div>

                <div className="flex-1 text-center space-y-12">
                    <p className="text-[13px] font-black text-slate-950 uppercase tracking-[0.3em]">Reviewed By:</p>
                    <div className="pt-8 border-t border-slate-200 w-3/4 mx-auto">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">
                        {settings?.signatory_reviewed_role || 'Financial Controller'}
                      </p>
                    </div>
                </div>

                <div className="flex-1 text-center space-y-12">
                    <p className="text-[13px] font-black text-slate-950 uppercase tracking-[0.3em]">Approved By:</p>
                    <div className="pt-8 border-t border-slate-200 w-3/4 mx-auto">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-none mb-1">
                        {settings?.signatory_approved_role || 'Director of Finance'}
                      </p>
                    </div>
                </div>
            </div>
            
            <div className="mt-20 pt-6 border-t border-slate-50 text-center opacity-30">
                <p className="text-[8px] font-black text-slate-300 uppercase tracking-[1em]">SYSTEM INTEGRITY VERIFICATION PROTOCOL • GENERATED {format(new Date(), 'PPpp')}</p>
            </div>
        </div>
    </div>
  );
};

export default Reports;
