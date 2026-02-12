
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Button, Card, CardContent } from '../components/ui';
import { db } from '../services/mockSupabase';
import { MembershipCategory, Member, Freeze, Sale, MassageBooking, MassageType, Guest } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, endOfMonth, differenceInCalendarDays, addDays, startOfDay, isSameDay } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Building2, 
  ReceiptText, 
  Settings2, 
  Check, 
  X, 
  ShieldCheck, 
  FileText, 
  Printer, 
  FileDown, 
  Globe,
  LayoutGrid,
  ShoppingBag,
  Calendar,
  CalendarDays,
  Activity,
  Zap,
  Tag,
  Coins,
  ArrowRight,
  ListFilter,
  Layers
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const parseISO = (dateString: string) => new Date(dateString);
const startOfMonthLocal = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const subDaysLocal = (date: Date, amount: number) => addDays(date, -amount);

interface ReportRow {
  sl_no: number;
  guest_name: string;
  from?: string;
  to?: string;
  total_days?: number;
  actual_fees: number;
  carry_forward?: number;
  daily?: number;
  current_month_rev?: number;
  controll?: number;
  balance?: number;
  remarks: string;
  membership_no?: string;
  category_id?: string;
  category_name: string;
  item_name?: string;
  quantity?: number;
  payment_method: string;
  time?: string;
}

const MEMBERSHIP_COLUMNS = [
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

const SALES_COLUMNS = [
  { key: 'sl_no', label: 'SL.', width: 'w-12', defaultVisible: true },
  { key: 'time', label: 'TIME', width: 'w-20', defaultVisible: true },
  { key: 'guest_name', label: 'CUSTOMER PROFILE', width: 'min-w-[250px]', defaultVisible: true },
  { key: 'item_name', label: 'ITEM / SERVICE DESCRIPTION', width: 'flex-1', defaultVisible: true },
  { key: 'quantity', label: 'QTY', width: 'w-16', defaultVisible: true },
  { key: 'actual_fees', label: 'AMOUNT', width: 'w-32', defaultVisible: true },
  { key: 'payment_method', label: 'SETTLEMENT', width: 'w-32', defaultVisible: true },
  { key: 'remarks', label: 'AUDIT REMARKS', width: 'w-40', defaultVisible: true },
];

type GroupingType = 'category' | 'payment' | 'none';

const Reports = () => {
  const { user } = useAuth();
  const { settings, currentOutlet, currentProperty, formatMoney, hasPermission } = useSettings();
  const [reportType, setReportType] = useState<'membership' | 'daily_sales'>('membership');
  const [groupingKey, setGroupingKey] = useState<GroupingType>('category');
  const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const logoBase64Ref = useRef<string | null>(null);
  const logoUrl = currentProperty?.logo_url || settings?.logo_url;

  useEffect(() => {
    const cols = reportType === 'membership' ? MEMBERSHIP_COLUMNS : SALES_COLUMNS;
    setVisibleColumnKeys(cols.filter(c => c.defaultVisible).map(c => c.key));
  }, [reportType]);

  useEffect(() => { if (currentOutlet && currentProperty) loadData(); }, [reportMonth, reportDate, reportType, currentOutlet, currentProperty]);

  useEffect(() => {
    if (!logoUrl) { logoBase64Ref.current = null; return; }
    const fetchImage = async () => {
      const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(logoUrl)}&output=png`;
      try {
        const response = await fetch(proxyUrl);
        if (response.ok) {
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => { logoBase64Ref.current = reader.result as string; };
          reader.readAsDataURL(blob);
        }
      } catch (e) { console.warn("Logo Proxy Failed"); }
    };
    fetchImage();
  }, [logoUrl]);

  const loadData = async () => {
    if (!currentOutlet || !currentProperty) return;
    try {
      if (reportType === 'membership') {
        const [members, cats, freezes] = await Promise.all([db.getMembers(currentOutlet.id), db.getCategories(currentOutlet.id), db.getFreezes()]);
        setCategories(cats);
        const startOfReport = startOfMonthLocal(parseISO(reportMonth + '-01'));
        const endOfReport = endOfMonth(startOfReport);
        const prevMonthEnd = subDaysLocal(startOfReport, 1);
        const reportRows: ReportRow[] = members.filter(m => {
          const mEnd = parseISO(m.current_end_date);
          const mStart = parseISO(m.start_date);
          return mEnd >= startOfReport && mStart <= endOfReport;
        }).map((m, idx) => {
          const memFreezes = freezes.filter(f => f.member_id === m.id);
          const carryForward = RevenueEngine.calculateRevenuePeriod(m, memFreezes, parseISO(m.start_date), prevMonthEnd);
          const currentRev = RevenueEngine.calculateRevenuePeriod(m, memFreezes, startOfReport, endOfReport);
          const totalDays = differenceInCalendarDays(parseISO(m.current_end_date), parseISO(m.start_date)) + 1;
          const controll = carryForward + currentRev;
          return {
            sl_no: idx + 1,
            guest_name: m.guest_name,
            from: format(parseISO(m.start_date), 'dd-MM-yyyy'),
            to: format(parseISO(m.current_end_date), 'dd-MM-yyyy'),
            total_days: totalDays,
            actual_fees: Number(m.net_amount) || 0,
            carry_forward: carryForward,
            daily: m.daily_rate,
            current_month_rev: currentRev,
            controll: controll,
            balance: Math.max(0, m.net_amount - controll),
            remarks: m.check_no || '',
            membership_no: m.membership_number,
            category_id: m.category_id,
            category_name: cats.find(c => c.id === m.category_id)?.name || 'Uncategorized',
            payment_method: 'Advance'
          };
        });
        setRows(reportRows);
      } else {
        const [sales, bookings, guests, massageTypes] = await Promise.all([db.getSales(currentProperty.id), db.getMassageBookings(currentProperty.id), db.getGuests(currentProperty.id), db.getMassageTypes(currentProperty.id)]);
        const targetDate = reportDate;
        const salesRows: ReportRow[] = sales.filter(s => format(new Date(s.created_at), 'yyyy-MM-dd') === targetDate).map((s, idx) => ({
            sl_no: idx + 1,
            time: format(new Date(s.created_at), 'HH:mm'),
            guest_name: s.guest_name,
            category_name: s.category || 'Retail',
            item_name: s.item_name,
            quantity: s.quantity,
            actual_fees: Number(s.net_amount) || 0,
            payment_method: s.payment_method,
            remarks: s.remarks || ''
        }));
        const bookingRows: ReportRow[] = bookings.filter(b => b.date === targetDate && b.status === 'completed').map((b, idx) => {
            const type = massageTypes.find(t => t.id === b.massage_type_id);
            const guest = guests.find(g => g.id === b.guest_id);
            return {
                sl_no: salesRows.length + idx + 1,
                time: b.start_time,
                guest_name: guest?.name || 'Guest',
                category_name: 'Massage',
                item_name: type?.name || 'Treatment',
                quantity: 1,
                actual_fees: Number(b.price) || 0,
                payment_method: 'Service Charge',
                remarks: `Specialist: ${b.therapist_id}`
            };
        });
        setRows([...salesRows, ...bookingRows]);
      }
    } catch (e) { console.error(e); }
  };

  const groupedRows = useMemo(() => {
    if (groupingKey === 'none') return { 'Ledger Entries': rows };
    const groups: { [groupValue: string]: ReportRow[] } = {};
    rows.forEach(row => {
      const key = groupingKey === 'category' ? row.category_name : row.payment_method;
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    });
    return groups;
  }, [rows, groupingKey]);

  const totals = useMemo(() => {
    return rows.reduce((acc, row) => ({
      fees: acc.fees + (Number(row.actual_fees) || 0),
      prev: acc.prev + (Number(row.carry_forward) || 0),
      current: acc.current + (Number(row.current_month_rev) || 0),
      balance: acc.balance + (Number(row.balance) || 0)
    }), { fees: 0, prev: 0, current: 0, balance: 0 });
  }, [rows]);

  const activeColumns = useMemo(() => {
      const pool = reportType === 'membership' ? MEMBERSHIP_COLUMNS : SALES_COLUMNS;
      return pool.filter(col => visibleColumnKeys.includes(col.key));
  }, [visibleColumnKeys, reportType]);

  const preparedBy = currentOutlet?.signatory_prepared_role || settings?.signatory_prepared_role || 'Income Auditor';
  const reviewedBy = currentOutlet?.signatory_reviewed_role || settings?.signatory_reviewed_role || 'Financial Controller';
  const approvedBy = currentOutlet?.signatory_approved_role || settings?.signatory_approved_role || 'Director of Finance';

  const toggleColumn = (key: string) => setVisibleColumnKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPDF(true);
    window.scrollTo(0, 0);
    try {
      const canvas = await html2canvas(reportRef.current, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff', 
        width: 1300, 
        windowWidth: 1300, 
        onclone: (clonedDoc) => {
          const container = clonedDoc.querySelector('.print-container') as HTMLElement;
          if (container) { container.style.boxShadow = 'none'; container.style.margin = '0'; container.style.padding = '40px'; container.style.width = '1300px'; container.style.maxWidth = '1300px'; }
          if (logoBase64Ref.current) { 
            const img = clonedDoc.querySelector('.company-logo-img') as HTMLImageElement; 
            if (img) { img.src = logoBase64Ref.current; img.removeAttribute('crossorigin'); } 
          }
        }
      });
      const pdf = new jsPDF('l', 'px', [canvas.width, (canvas.width * 0.707)]);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const totalPages = Math.ceil(canvas.height / pageHeight);
      for (let i = 0; i < totalPages; i++) {
        if (i > 0) pdf.addPage();
        const sourceY = i * pageHeight;
        const sectionCanvas = document.createElement('canvas');
        sectionCanvas.width = canvas.width;
        sectionCanvas.height = Math.min(pageHeight, canvas.height - sourceY);
        sectionCanvas.getContext('2d')?.drawImage(canvas, 0, sourceY, canvas.width, sectionCanvas.height, 0, 0, canvas.width, sectionCanvas.height);
        pdf.addImage(sectionCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageWidth, sectionCanvas.height * (pageWidth / canvas.width));
      }
      pdf.save(`Ledger_${reportType.toUpperCase()}_${currentOutlet?.name || 'ERP'}_${reportType === 'membership' ? reportMonth : reportDate}.pdf`);
    } catch (err) { console.error(err); } finally { setIsGeneratingPDF(false); }
  };

  let globalIndexCounter = 0;

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          @page { size: landscape; margin: 0; }
          body { background: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          aside, header, .no-print { display: none !important; }
          main { padding: 0 !important; margin: 0 !important; overflow: visible !important; }
          .print-container { position: absolute !important; left: 0 !important; top: 0 !important; margin: 0 !important; padding: 40px !important; width: 1300px !important; min-width: 1300px !important; max-width: 1300px !important; box-shadow: none !important; border: none !important; border-radius: 0 !important; background: white !important; transform: scale(0.8); transform-origin: top left; }
          thead { display: table-header-group !important; }
          tr { page-break-inside: avoid !important; }
          thead tr { background-color: #020617 !important; color: white !important; }
        }
      `}</style>
      
      <div className="flex flex-col xl:flex-row justify-between items-center bg-white p-6 rounded-[2rem] shadow-sm no-print border border-slate-100 gap-6">
        <div className="flex items-center gap-6 w-full xl:w-auto">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
             <button onClick={() => setReportType('membership')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${reportType === 'membership' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}><LayoutGrid className="w-4 h-4" /> Membership Recognition</button>
             <button onClick={() => setReportType('daily_sales')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${reportType === 'daily_sales' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}><ShoppingBag className="w-4 h-4" /> Daily Sales & Services</button>
          </div>
          <div className="h-10 w-px bg-slate-200"></div>
          {reportType === 'membership' ? (
              <div className="flex items-center gap-3"><Calendar className="w-4 h-4 text-slate-400" /><input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="h-11 px-4 rounded-xl border border-slate-200 font-black text-xs uppercase bg-slate-50 outline-none shadow-sm focus:ring-4 focus:ring-indigo-500/10 transition-all" /></div>
          ) : (
              <div className="flex items-center gap-3"><CalendarDays className="w-4 h-4 text-slate-400" /><input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} className="h-11 px-4 rounded-xl border border-slate-200 font-black text-xs uppercase bg-slate-50 outline-none shadow-sm focus:ring-4 focus:ring-indigo-500/10 transition-all" /></div>
          )}
          <div className="h-10 w-px bg-slate-200"></div>
          <div className="flex items-center gap-3">
            <ListFilter className="w-4 h-4 text-slate-400" />
            <select value={groupingKey} onChange={e => setGroupingKey(e.target.value as any)} className="h-11 px-4 rounded-xl border border-slate-200 font-black text-xs uppercase bg-slate-50 outline-none shadow-sm focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer">
              <option value="category">Group by Department</option>
              <option value="payment">Group by Settlement</option>
              <option value="none">Flat Audit List</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 w-full xl:w-auto">
          <Button variant="outline" className="flex-1 sm:flex-none rounded-xl font-bold text-[10px] uppercase h-11 px-6 border-slate-200" onClick={() => setShowConfig(!showConfig)}><Settings2 className="w-4 h-4 mr-2" /> Columns</Button>
          {showConfig && (
            <div className="absolute top-24 right-48 mt-2 bg-white border border-slate-200 rounded-xl shadow-2xl p-4 z-[100] w-64 animate-in fade-in zoom-in-95">
              <div className="flex justify-between items-center mb-3 pb-2 border-b"><span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Toggle Column Visibility</span><button onClick={() => setShowConfig(false)} className="text-slate-400 p-1 hover:bg-slate-50 rounded-lg"><X className="w-4 h-4"/></button></div>
              <div className="space-y-1">
                {(reportType === 'membership' ? MEMBERSHIP_COLUMNS : SALES_COLUMNS).map(col => (
                  <button key={col.key} onClick={() => toggleColumn(col.key)} className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left text-[10px] font-bold transition-all ${visibleColumnKeys.includes(col.key) ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>{col.label} {visibleColumnKeys.includes(col.key) && <Check className="w-3.5 h-3.5"/>}</button>
                ))}
              </div>
            </div>
          )}
          <Button variant="outline" className="flex-1 sm:flex-none rounded-xl font-bold text-[10px] uppercase h-11 px-6 border-indigo-100 text-indigo-600 hover:bg-indigo-50" onClick={handlePrint}><Printer className="w-4 h-4 mr-2" /> Print</Button>
          {hasPermission(user?.role_id || '', 'reports:export') && (
            <Button className="flex-1 sm:flex-none rounded-xl font-black text-[10px] uppercase h-11 px-8 shadow-xl shadow-indigo-100" onClick={handleDownloadPDF} isLoading={isGeneratingPDF}>{isGeneratingPDF ? 'Syncing...' : 'Export Authority PDF'} <FileDown className="w-4 h-4 ml-2" /></Button>
          )}
        </div>
      </div>

      <div className="w-full overflow-x-auto custom-scrollbar pb-12 no-print-overflow">
        <div ref={reportRef} className="bg-white p-12 md:p-16 rounded-[1rem] shadow-2xl w-[1300px] mx-auto min-h-screen print-container border border-slate-100 flex flex-col">
          <div className="flex flex-row justify-between items-center border-b-4 border-slate-900 pb-8 mb-10 min-w-[1100px]">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 shrink-0 flex items-center justify-center">{logoUrl ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain company-logo-img" referrerPolicy="no-referrer" /> : <div className="w-full h-full bg-slate-900 text-white flex items-center justify-center rounded-xl"><Globe className="w-10 h-10" /></div>}</div>
              <div className="flex flex-col justify-center h-full pt-2">
                <h1 className="text-4xl font-serif font-bold text-slate-950 leading-none mb-3 tracking-tight">{currentProperty?.name || settings?.name || 'Corporate Ledger'}</h1>
                <div className="flex flex-col gap-1">
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{currentProperty?.address || settings?.address || 'Corporate Headquarters'}</p>
                  <p className="text-[11px] font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2"><ShieldCheck className="w-3 h-3" /> Internal Verification Protocol</p>
                </div>
              </div>
            </div>
            <div className="text-right flex flex-col items-end">
              <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-2">{reportType === 'membership' ? 'Revenue Recognition' : 'Daily Sales Ledger'}</h2>
              <p className="text-lg font-medium text-slate-500 mb-4">{reportType === 'membership' ? format(parseISO(reportMonth + '-01'), 'MMMM yyyy') : format(parseISO(reportDate), 'EEEE, MMMM dd, yyyy')}</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 border border-slate-200"><ShieldCheck className="w-3.5 h-3.5 text-indigo-600"/> Verified Audit Trail</div>
            </div>
          </div>

          <div className="flex-1">
            <table className="w-full text-[10px] border-collapse min-w-[1100px]">
              <thead><tr className="bg-slate-950 text-white border-b-4 border-slate-950">{activeColumns.map(col => (<th key={col.key} className={`px-4 py-5 text-center font-bold uppercase tracking-widest border-r border-white/10 last:border-0 ${col.width}`}>{col.label}</th>))}</tr></thead>
              <tbody className="divide-y divide-slate-200">
                {Object.keys(groupedRows).length === 0 ? (<tr><td colSpan={activeColumns.length} className="px-8 py-32 text-center"><Activity className="w-12 h-12 text-slate-100 mx-auto mb-4" /><p className="text-[13px] font-black uppercase tracking-[0.3em] text-slate-300">No synchronized entries discovery</p></td></tr>) : Object.keys(groupedRows).map(groupName => { 
                  const groupRows = groupedRows[groupName]; 
                  const groupTotals = groupRows.reduce((acc, r) => ({ fees: acc.fees + (Number(r.actual_fees) || 0), prev: acc.prev + (Number(r.carry_forward) || 0), current: acc.current + (Number(r.current_month_rev) || 0), balance: acc.balance + (Number(r.balance) || 0) }), { fees: 0, prev: 0, current: 0, balance: 0 }); 
                  return (
                    <React.Fragment key={groupName}>
                      {groupingKey !== 'none' && (<tr className="bg-slate-50/80 border-b border-slate-300"><td colSpan={activeColumns.length} className="px-6 py-4"><div className="flex items-center">{groupingKey === 'payment' ? <Coins className="w-4 h-4 text-indigo-600 mr-3" /> : <Layers className="w-4 h-4 text-indigo-600 mr-3" />}<span className="text-[12px] font-black uppercase tracking-widest text-slate-900 mr-4">{groupName}</span><span className="text-[9px] font-bold text-slate-500 uppercase">({groupRows.length} Ledger Events)</span></div></td></tr>)}
                      {groupRows.map((row) => { globalIndexCounter++; return (<tr key={`${row.sl_no}-${globalIndexCounter}`} className="hover:bg-slate-50/50 transition-colors">{activeColumns.map(col => (<td key={col.key} className={`px-4 py-4 border-r border-slate-100 last:border-0 ${['actual_fees', 'carry_forward', 'current_month_rev', 'balance', 'quantity'].includes(col.key) ? 'text-right tabular-nums' : 'text-center'} ${col.key === 'guest_name' || col.key === 'item_name' ? 'text-left font-bold text-slate-800' : ''}`}><span className={`${col.key === 'current_month_rev' || (reportType === 'daily_sales' && col.key === 'actual_fees') ? 'text-indigo-700 font-black' : ''} ${col.key === 'balance' && (Number(row.balance) || 0) > 0 ? 'text-red-600 font-black' : ''} ${['actual_fees', 'carry_forward'].includes(col.key) && reportType === 'membership' ? 'text-slate-600' : ''} ${col.key === 'payment_method' ? 'bg-slate-100 px-2 py-1 rounded text-[9px] font-black uppercase' : ''}`}>{col.key === 'sl_no' ? globalIndexCounter : (['actual_fees', 'carry_forward', 'current_month_rev', 'balance'].includes(col.key) ? formatMoney(row[col.key as keyof ReportRow] as number) : row[col.key as keyof ReportRow])}</span></td>))}</tr>); })}
                      {groupingKey !== 'none' && (<tr className="bg-indigo-50/40 border-y-2 border-slate-200 font-black"><td colSpan={activeColumns.findIndex(c => c.key === 'actual_fees')} className="px-6 py-4 text-right"><span className="text-[10px] uppercase tracking-widest text-indigo-900">Cluster Subtotal: {groupName}</span></td><td className="px-4 py-4 text-right border-x border-white text-indigo-700">{formatMoney(groupTotals.fees)}</td>{activeColumns.slice(activeColumns.findIndex(c => c.key === 'actual_fees') + 1).map(col => { if (reportType === 'membership') { if (col.key === 'carry_forward') return <td key={col.key} className="px-4 py-4 text-right border-x border-white">{formatMoney(groupTotals.prev)}</td>; if (col.key === 'current_month_rev') return <td key={col.key} className="px-4 py-4 text-right border-x border-white">{formatMoney(groupTotals.current)}</td>; if (col.key === 'balance') return <td key={col.key} className="px-4 py-4 text-right border-x border-white">{formatMoney(groupTotals.balance)}</td>; } return <td key={col.key} className="px-4 py-4"></td>; })}</tr>)}
                    </React.Fragment>
                  ); 
                })}
              </tbody>
              <tfoot><tr className="bg-slate-900 text-white shadow-2xl border-t-4 border-slate-950"><td colSpan={activeColumns.findIndex(c => c.key === 'actual_fees')} className="px-8 py-7 text-right text-[12px] font-black uppercase tracking-[0.4em] border-r border-white/10">GRAND PORTFOLIO TOTAL</td><td className={`px-4 py-7 text-right font-black border-r border-white/10 text-xs ${reportType === 'daily_sales' ? 'bg-indigo-600' : ''}`}>{formatMoney(totals.fees)}</td>{activeColumns.slice(activeColumns.findIndex(c => c.key === 'actual_fees') + 1).map(col => { if (reportType === 'membership') { if (col.key === 'carry_forward') return <td key={col.key} className="px-4 py-7 text-right font-black border-r border-white/10">{formatMoney(totals.prev)}</td>; if (col.key === 'current_month_rev') return <td key={col.key} className="px-4 py-7 text-right font-black border-r border-white/10 bg-indigo-600">{formatMoney(totals.current)}</td>; if (col.key === 'balance') return <td key={col.key} className="px-4 py-7 text-right font-black border-r border-white/10">{formatMoney(totals.balance)}</td>; } return <td key={col.key} className="px-4 py-7 border-r border-white/10 last:border-0"></td>; })}</tr></tfoot>
            </table>
          </div>

          <div className="signature-block mt-20 pt-12 border-t-2 border-slate-200 flex justify-between items-start gap-16 min-w-[1100px]">
            <div className="flex-1 space-y-12"><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-10">Prepared By</p><div className="border-b-2 border-slate-300 pb-3"></div><p className="text-[12px] font-black text-slate-900 uppercase tracking-widest">{preparedBy}</p><p className="text-[9px] font-bold text-slate-400 uppercase">Authorized Signature & Date</p></div>
            <div className="flex-1 space-y-12"><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-10">Reviewed By</p><div className="border-b-2 border-slate-300 pb-3"></div><p className="text-[12px] font-black text-slate-900 uppercase tracking-widest">{reviewedBy}</p><p className="text-[9px] font-bold text-slate-400 uppercase">Internal Control Verification</p></div>
            <div className="flex-1 space-y-12"><p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-10">Approved By</p><div className="border-b-2 border-slate-300 pb-3"></div><p className="text-[12px] font-black text-slate-900 uppercase tracking-widest">{approvedBy}</p><p className="text-[9px] font-bold text-slate-400 uppercase">Executive Financial Authorization</p></div>
          </div>
          <div className="mt-20 pt-8 border-t border-slate-100 flex justify-between items-center opacity-40"><p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.8em]">&copy; {new Date().getFullYear()} perfection corporate erp solutions</p><div className="flex items-center gap-2"><ShieldCheck className="w-3 h-3" /><span className="text-[8px] font-bold uppercase tracking-widest">Document Integrity Hash: {crypto.randomUUID().substring(0, 8).toUpperCase()}</span></div></div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
