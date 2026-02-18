
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '../components/ui';
import { db } from '../services/mockSupabase';
import { Member, MassageBooking, MassageType, IncentiveRule, MemberStatus, Staff, Sale, Guest } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, endOfMonth, differenceInCalendarDays, addDays, startOfDay, isWithinInterval } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  ShieldCheck, 
  FileText, 
  Printer, 
  FileDown, 
  Globe,
  Layers,
  UserCheck,
  Settings2,
  ListFilter,
  CheckCircle2,
  Filter,
  Activity,
  Award,
  Shield
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const parseISO = (dateString: string) => new Date(dateString);
const startOfMonthLocal = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

interface ReportRow {
  sl_no: number;
  date: string;
  guest_name: string;
  duration?: string;
  check_no?: string;
  mode_of_payment?: string;
  type_of_membership?: string;
  item_name: string;
  therapist_name?: string;
  
  // Revenue
  actual_price: number;
  discount_percent: number;
  discount_amount: number;
  net_revenue: number;
  
  // Incentive Breakdowns (Excel Style)
  inc_total: number;
  inc_discount_percent: number;
  inc_discount_val: number;
  inc_net: number;
  
  remarks: string;
  staff_splits: Record<string, number>; // Staff ID -> Payout
}

const Reports = () => {
  const { user } = useAuth();
  const { settings, currentOutlet, currentProperty, formatMoney, hasPermission } = useSettings();
  const [reportType, setReportType] = useState<'membership' | 'daily_sales' | 'incentives'>('incentives');
  const [incentiveDept, setIncentiveDept] = useState<'Massage' | 'Membership' | 'Retail'>('Massage');
  const [groupingKey, setGroupingKey] = useState<'none' | 'category' | 'staff'>('none');
  const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [activeStaffList, setActiveStaffList] = useState<Staff[]>([]);
  const [showConfig, setShowConfig] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Page-Level Security Check
  const canView = user && hasPermission(user.role_id, 'reports:view');

  useEffect(() => {
    if (currentOutlet && currentProperty && canView) loadData();
  }, [reportMonth, reportType, incentiveDept, currentOutlet, currentProperty, canView]);

  const findBestRule = (rules: IncentiveRule[], applies_to: IncentiveRule['applies_to'], target_id: string, price: number, duration: number) => {
    const candidates = rules.filter(r => r.is_active && r.applies_to === applies_to);
    const sorted = candidates.sort((a, b) => {
        if (a.target_id !== 'all' && b.target_id === 'all') return -1;
        const scopeOrder = { 'Outlet': 0, 'Property': 1, 'Global': 2 };
        return scopeOrder[a.scope as keyof typeof scopeOrder] - scopeOrder[b.scope as keyof typeof scopeOrder];
    });
    return sorted.find(r => {
        if (r.target_id !== 'all' && r.target_id !== target_id) return false;
        if (price < (r.min_price || 0) || price > (r.max_price || 999999)) return false;
        return true;
    });
  };

  const isStaffOnLeaveOnDate = (s: Staff, targetDateStr: string) => {
      if (!s.leave_start_date || !s.leave_end_date) return false;
      try {
          const target = startOfDay(new Date(targetDateStr));
          const start = startOfDay(new Date(s.leave_start_date));
          const end = startOfDay(new Date(s.leave_end_date));
          return isWithinInterval(target, { start, end });
      } catch (e) { return false; }
  };

  const loadData = async () => {
    if (!currentOutlet || !currentProperty) return;
    try {
      const start = startOfMonthLocal(parseISO(reportMonth + '-01'));
      const end = endOfMonth(start);
      
      const [rules, bookings, members, sales, therapists, mTypes, mCats, staffList, guests] = await Promise.all([
          db.getIncentiveRules(currentProperty.id, currentOutlet.id),
          db.getMassageBookings(currentProperty.id),
          db.getMembers(currentOutlet.id),
          db.getSales(currentProperty.id),
          db.getTherapists(currentProperty.id),
          db.getMassageTypes(currentProperty.id),
          db.getCategories(currentOutlet.id),
          db.getStaff(currentOutlet.id),
          db.getGuests(currentProperty.id)
      ]);

      setActiveStaffList(staffList.filter(s => s.is_active));
      const records: ReportRow[] = [];
      let sl = 1;

      if (incentiveDept === 'Massage') {
          bookings.filter(b => b.status === 'completed' && parseISO(b.date) >= start && parseISO(b.date) <= end)
          .forEach(b => {
              const type = mTypes.find(m => m.id === b.massage_type_id);
              if (!type) return;
              const rule = findBestRule(rules, 'Massage', b.massage_type_id, type.price, type.duration_minutes);
              if (!rule) return;

              const actualPrice = type.price;
              const discountAmt = b.discount || 0;
              const netRev = actualPrice - discountAmt;
              const discPercent = actualPrice > 0 ? (discountAmt / actualPrice) * 100 : 0;

              const baseInc = rule.calculation_type === 'Fixed' ? rule.value : (actualPrice * rule.value / 100);
              const incDiscVal = (baseInc * discPercent) / 100;
              const incNet = baseInc - incDiscVal;

              const staffSplits: Record<string, number> = {};
              if (rule.distribution_type === 'Shared') {
                  const available = staffList.filter(s => s.is_active && (s.is_eligible_for_incentives !== false) && !isStaffOnLeaveOnDate(s, b.date));
                  if (available.length > 0) {
                      const share = incNet / available.length;
                      available.forEach(s => staffSplits[s.id] = share);
                  }
              } else {
                  if (b.therapist_id) staffSplits[b.therapist_id] = incNet;
              }

              records.push({
                  sl_no: sl++,
                  date: format(parseISO(b.date), 'dd-MMM-yy'),
                  guest_name: guests.find(g => g.id === b.guest_id)?.name || 'Guest',
                  duration: `${type.duration_minutes}m`,
                  check_no: '#---',
                  item_name: type.name,
                  therapist_name: therapists.find(t => t.id === b.therapist_id)?.name || 'N/A',
                  actual_price: actualPrice,
                  discount_percent: discPercent,
                  discount_amount: discountAmt,
                  net_revenue: netRev,
                  inc_total: baseInc,
                  inc_discount_percent: discPercent,
                  inc_discount_val: incDiscVal,
                  inc_net: incNet,
                  remarks: discPercent > 50 ? 'Complimentary' : '',
                  staff_splits: staffSplits
              });
          });
      } else if (incentiveDept === 'Membership') {
          members.filter(m => m.status !== MemberStatus.TENTATIVE && parseISO(m.start_date) >= start && parseISO(m.start_date) <= end)
          .forEach(m => {
              const cat = mCats.find(c => c.id === m.category_id);
              if (!cat) return;
              const rule = findBestRule(rules, 'Membership', m.category_id, m.net_amount, 0);
              if (!rule) return;

              const actualPrice = m.actual_rate;
              const discountAmt = m.discount;
              const netRev = m.net_amount;
              const discPercent = actualPrice > 0 ? (discountAmt / actualPrice) * 100 : 0;

              const baseInc = rule.calculation_type === 'Fixed' ? rule.value : (actualPrice * rule.value / 100);
              const incDiscVal = (baseInc * discPercent) / 100;
              const incNet = baseInc - incDiscVal;

              const staffSplits: Record<string, number> = {};
              if (rule.distribution_type === 'Shared') {
                  const available = staffList.filter(s => s.is_active && (s.is_eligible_for_incentives !== false) && !isStaffOnLeaveOnDate(s, m.start_date));
                  if (available.length > 0) {
                      const share = incNet / available.length;
                      available.forEach(s => staffSplits[s.id] = share);
                  }
              } else {
                  if (m.sales_rep_id) staffSplits[m.sales_rep_id] = incNet;
              }

              records.push({
                  sl_no: sl++,
                  date: format(parseISO(m.start_date), 'dd-MMM-yy'),
                  guest_name: m.guest_name,
                  type_of_membership: m.package_type || 'Single',
                  duration: `${cat.duration_months} Months`,
                  check_no: m.check_no || '#---',
                  mode_of_payment: 'Cash/Card',
                  item_name: cat.name,
                  actual_price: actualPrice,
                  discount_percent: discPercent,
                  discount_amount: discountAmt,
                  net_revenue: netRev,
                  inc_total: baseInc,
                  inc_discount_percent: discPercent,
                  inc_discount_val: incDiscVal,
                  inc_net: incNet,
                  remarks: m.remarks || '',
                  staff_splits: staffSplits
              });
          });
      } else if (incentiveDept === 'Retail') {
          sales.filter(s => s.status === 'completed' && parseISO(s.created_at) >= start && parseISO(s.created_at) <= end)
          .forEach(s => {
              const rule = findBestRule(rules, 'Sale', s.category, s.net_amount, 0);
              if (!rule) return;

              const actualPrice = s.gross_amount;
              const discountAmt = s.discount_amount;
              const netRev = s.net_amount;
              const discPercent = actualPrice > 0 ? (discountAmt / actualPrice) * 100 : 0;

              const baseInc = rule.calculation_type === 'Fixed' ? rule.value : (actualPrice * rule.value / 100);
              const incDiscVal = (baseInc * discPercent) / 100;
              const incNet = baseInc - incDiscVal;

              const staffSplits: Record<string, number> = {};
              if (rule.distribution_type === 'Shared') {
                  const available = staffList.filter(staff => staff.is_active && (staff.is_eligible_for_incentives !== false) && !isStaffOnLeaveOnDate(staff, s.created_at));
                  if (available.length > 0) {
                      const share = incNet / available.length;
                      available.forEach(staff => staffSplits[staff.id] = share);
                  }
              } else {
                  if (s.sold_by_id) staffSplits[s.sold_by_id] = incNet;
              }

              records.push({
                  sl_no: sl++,
                  date: format(parseISO(s.created_at), 'dd-MMM-yy'),
                  guest_name: s.guest_name,
                  duration: `x${s.quantity}`,
                  check_no: '#POS',
                  item_name: s.item_name,
                  actual_price: actualPrice,
                  discount_percent: discPercent,
                  discount_amount: discountAmt,
                  net_revenue: netRev,
                  inc_total: baseInc,
                  inc_discount_percent: discPercent,
                  inc_discount_val: incDiscVal,
                  inc_net: incNet,
                  remarks: s.remarks || '',
                  staff_splits: staffSplits
              });
          });
      }
      setRows(records);
    } catch (e) { console.error(e); }
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPDF(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      pdf.addImage(imgData, 'PNG', 0, 0, 297, (canvas.height * 297) / canvas.width);
      pdf.save(`Yield_Audit_${incentiveDept}_${reportMonth}.pdf`);
    } catch (e) { console.error(e); } finally { setIsGeneratingPDF(false); }
  };

  if (!canView) {
      return (
          <div className="flex items-center justify-center h-screen">
              <Card className="max-w-md text-center p-8 border-red-100 bg-red-50/30 rounded-[2rem]">
                  <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Operational Security Lock</h3>
                  <p className="text-slate-500 mt-2 text-sm font-bold uppercase tracking-tight">Access to financial audit templates is restricted to authorized personnel only.</p>
              </Card>
          </div>
      );
  }

  const RenderTable = () => {
    const isMassage = incentiveDept === 'Massage';
    const isMembership = incentiveDept === 'Membership';
    const isRetail = incentiveDept === 'Retail';

    let totalActual = 0;
    let totalDiscount = 0;
    let totalNetRev = 0;
    let totalIncNet = 0;
    const staffTotals: Record<string, number> = {};

    return (
        <div className="w-full">
            <table className="w-full border-collapse text-[9px] border-2 border-black">
                <thead>
                    <tr className="bg-sky-100 text-black font-bold">
                        <th rowSpan={2} className="border border-black px-2 py-3 w-8">Sl.No.</th>
                        <th rowSpan={2} className="border border-black px-2 py-3 w-20">Date</th>
                        <th rowSpan={2} className="border border-black px-2 py-3 min-w-[120px]">Guest Name</th>
                        
                        {isMembership && <th rowSpan={2} className="border border-black px-2 py-3">Type of Membership</th>}
                        <th rowSpan={2} className="border border-black px-2 py-3 w-16">{isRetail ? 'Qty' : 'Duration'}</th>
                        <th rowSpan={2} className="border border-black px-2 py-3 w-16">Check No.</th>
                        {isMembership && <th rowSpan={2} className="border border-black px-2 py-3">Mode of Payment</th>}
                        {!isMembership && <th rowSpan={2} className="border border-black px-2 py-3">{isMassage ? 'Treatment' : 'Asset Item'}</th>}
                        {isMassage && <th rowSpan={2} className="border border-black px-2 py-3">Therapist</th>}
                        
                        <th rowSpan={2} className="border border-black px-2 py-3 text-right">{isMembership ? 'Original Rate' : 'Actual Prices'}</th>
                        <th rowSpan={2} className="border border-black px-2 py-3 text-center">Disc %</th>
                        <th rowSpan={2} className="border border-black px-2 py-3 text-right">Discounted Amount</th>
                        <th rowSpan={2} className="border border-black px-2 py-3 text-right">Net Revenue</th>
                        
                        <th colSpan={4} className="border border-black px-2 py-1 text-center bg-amber-100">Incentive Breakdown</th>
                        
                        <th rowSpan={2} className="border border-black px-2 py-3 min-w-[100px]">Remarks</th>
                        
                        {activeStaffList.map(s => (
                            <th key={s.id} rowSpan={2} className="border border-black px-1 py-3 w-16 bg-slate-50 text-center">
                                <div className="rotate-180" style={{ writingMode: 'vertical-rl' }}>{s.name.toUpperCase()}</div>
                            </th>
                        ))}
                    </tr>
                    <tr className="bg-amber-50">
                        <th className="border border-black px-2 py-1 w-14 text-center">Total</th>
                        <th className="border border-black px-2 py-1 w-14 text-center">Disc %</th>
                        <th className="border border-black px-2 py-1 w-14 text-center">Disc. Inc</th>
                        <th className="border border-black px-2 py-1 w-14 text-center">Net</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, idx) => {
                        totalActual += row.actual_price;
                        totalDiscount += row.discount_amount;
                        totalNetRev += row.net_revenue;
                        totalIncNet += row.inc_net;

                        return (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                <td className="border border-black px-2 py-1 text-center font-bold">{row.sl_no}</td>
                                <td className="border border-black px-2 py-1 text-center whitespace-nowrap">{row.date}</td>
                                <td className="border border-black px-2 py-1 font-black text-slate-700">{row.guest_name}</td>
                                {isMembership && <td className="border border-black px-2 py-1 text-center font-bold text-slate-600">{row.type_of_membership}</td>}
                                <td className="border border-black px-2 py-1 text-center">{row.duration}</td>
                                <td className="border border-black px-2 py-1 text-center text-slate-400">{row.check_no}</td>
                                {isMembership && <td className="border border-black px-2 py-1 text-center text-slate-500 font-bold">{row.mode_of_payment}</td>}
                                {!isMembership && <td className="border border-black px-2 py-1">{row.item_name}</td>}
                                {isMassage && <td className="border border-black px-2 py-1 text-center font-bold bg-slate-50 text-indigo-700">{row.therapist_name}</td>}
                                
                                <td className="border border-black px-2 py-1 text-right">{row.actual_price.toFixed(2)}</td>
                                <td className="border border-black px-2 py-1 text-center text-slate-400">{row.discount_percent > 0 ? `${row.discount_percent.toFixed(0)}%` : ''}</td>
                                <td className="border border-black px-2 py-1 text-right">{row.discount_amount.toFixed(2)}</td>
                                <td className="border border-black px-2 py-1 text-right font-black bg-slate-50">{row.net_revenue.toFixed(2)}</td>
                                
                                <td className="border border-black px-2 py-1 text-right bg-amber-50/20">{row.inc_total.toFixed(2)}</td>
                                <td className="border border-black px-2 py-1 text-center bg-amber-50/20 text-slate-400">{row.inc_discount_percent > 0 ? `${row.inc_discount_percent.toFixed(0)}%` : ''}</td>
                                <td className="border border-black px-2 py-1 text-right bg-amber-50/20">{row.inc_discount_val.toFixed(2)}</td>
                                <td className="border border-black px-2 py-1 text-right font-black bg-amber-100/30">{row.inc_net.toFixed(2)}</td>
                                
                                <td className="border border-black px-2 py-1 text-[8px] text-slate-400 italic truncate max-w-[120px]">{row.remarks}</td>
                                
                                {activeStaffList.map(s => {
                                    const val = row.staff_splits[s.id] || 0;
                                    staffTotals[s.id] = (staffTotals[s.id] || 0) + val;
                                    return (
                                        <td key={s.id} className={`border border-black px-1 py-1 text-right font-black ${val > 0 ? 'bg-indigo-50 text-indigo-700' : 'text-slate-100'}`}>
                                            {val > 0 ? val.toFixed(2) : '0.00'}
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                    <tr className="bg-slate-900 text-white font-black text-[10px]">
                        <td colSpan={isMembership ? 7 : (isMassage ? 8 : 7)} className="border border-black px-4 py-3 text-right uppercase tracking-widest">Aggregate Portfolio Totals</td>
                        <td className="border border-black px-2 py-3 text-right">{totalActual.toFixed(2)}</td>
                        <td className="border border-black"></td>
                        <td className="border border-black px-2 py-3 text-right text-indigo-300">{totalDiscount.toFixed(2)}</td>
                        <td className="border border-black px-2 py-3 text-right">{totalNetRev.toFixed(2)}</td>
                        <td colSpan={3} className="border border-black"></td>
                        <td className="border border-black px-2 py-3 text-right bg-indigo-600 font-bold">{totalIncNet.toFixed(2)}</td>
                        <td className="border border-black"></td>
                        {activeStaffList.map(s => (
                            <td key={s.id} className="border border-black px-1 py-3 text-right text-indigo-200">
                                {(staffTotals[s.id] || 0).toFixed(2)}
                            </td>
                        ))}
                    </tr>
                </tbody>
            </table>

            <div className="mt-16 grid grid-cols-12 gap-10">
                <div className="col-span-5">
                    <table className="w-full border-collapse border-2 border-black font-black text-[10px]">
                        <tbody>
                            <tr className="bg-amber-50">
                                <td className="border border-black px-5 py-3 uppercase text-slate-600">Total Incentive Yield</td>
                                <td className="border border-black px-5 py-3 text-right text-indigo-600 text-sm">{formatMoney(totalIncNet)}</td>
                            </tr>
                            <tr className="bg-white">
                                <td className="border border-black px-5 py-3 uppercase text-slate-600">Portfolio Gross Revenue</td>
                                <td className="border border-black px-5 py-3 text-right text-sm">{formatMoney(totalActual)}</td>
                            </tr>
                            <tr className="bg-white">
                                <td className="border border-black px-5 py-3 uppercase text-slate-600">Total Reduction / Discount</td>
                                <td className="border border-black px-5 py-3 text-right text-red-500 text-sm">{formatMoney(totalDiscount)}</td>
                            </tr>
                            <tr className="bg-sky-100 border-t-4 border-black">
                                <td className="border border-black px-5 py-4 uppercase text-slate-900 text-xs">Certified Net Revenue</td>
                                <td className="border border-black px-5 py-4 text-right text-indigo-700 text-sm">{formatMoney(totalNetRev)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="col-span-7 grid grid-cols-2 gap-10 items-end pb-4">
                    <div className="space-y-12">
                        <div className="h-px bg-black w-full"></div>
                        <div className="text-center uppercase">
                            <p className="font-black text-xs text-slate-900">Prepared By:</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1">{currentOutlet?.signatory_prepared_role || 'Accountant / Controller'}</p>
                        </div>
                    </div>
                    <div className="space-y-12">
                        <div className="h-px bg-black w-full"></div>
                        <div className="text-center uppercase">
                            <p className="font-black text-xs text-slate-900">Approved By:</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-1">{currentOutlet?.signatory_approved_role || 'General Manager'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 no-print">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-xl">
        <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-indigo-100"><FileText className="w-7 h-7" /></div>
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Financial Yield Audit</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">Executive Ledger System</p>
            </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="flex items-center gap-3 bg-white border border-slate-200 px-5 py-3 rounded-2xl shadow-sm">
                <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="text-[11px] font-black uppercase bg-transparent outline-none cursor-pointer" />
            </div>
            <Button variant="outline" onClick={() => setShowConfig(!showConfig)} className={`h-12 px-5 rounded-2xl border-slate-200 ${showConfig ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-inner' : ''}`}><Settings2 className="w-4 h-4 mr-2" /> <span className="text-[10px] font-black uppercase tracking-widest">Layout Config</span></Button>
            <Button onClick={handleExportPDF} isLoading={isGeneratingPDF} className="h-12 px-8 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 transition-all active:scale-95"><FileDown className="w-4 h-4 mr-2" /> Export Audit</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {showConfig && (
              <div className="lg:col-span-3 animate-in slide-in-from-left-6 duration-500">
                  <Card className="rounded-[2.5rem] border-slate-200/60 shadow-2xl sticky top-24 overflow-hidden bg-white">
                      <CardHeader className="bg-slate-950 text-white p-8 border-b border-slate-800">
                          <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3">
                              <ListFilter className="w-4 h-4 text-indigo-400" /> Layout Engine
                          </CardTitle>
                      </CardHeader>
                      <CardContent className="p-8 space-y-10">
                          <div className="space-y-4">
                              <div className="flex items-center gap-2 mb-1">
                                  <Award className="w-3.5 h-3.5 text-indigo-600"/>
                                  <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Reward Department</label>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                  {(['Massage', 'Membership', 'Retail'] as const).map(dept => (
                                      <button 
                                        key={dept} 
                                        onClick={() => setIncentiveDept(dept)} 
                                        className={`w-full px-5 py-4 rounded-2xl text-left text-[11px] font-black uppercase tracking-widest transition-all border-2 ${
                                          incentiveDept === dept 
                                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 scale-[1.02]' 
                                          : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-white hover:border-slate-200 hover:text-slate-600'
                                        }`}
                                      >
                                          {dept}
                                      </button>
                                  ))}
                              </div>
                          </div>

                          <div className="space-y-4 pt-8 border-t border-slate-100">
                              <div className="flex items-center gap-2 mb-1">
                                  <Layers className="w-3.5 h-3.5 text-indigo-600"/>
                                  <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Report Grouping</label>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                  {['none', 'category', 'staff'].map(key => (
                                      <button key={key} onClick={() => setGroupingKey(key as any)} className={`w-full px-5 py-3 rounded-xl text-left text-[10px] font-black uppercase transition-all border ${groupingKey === key ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:text-slate-600'}`}>{key}</button>
                                  ))}
                              </div>
                          </div>

                          <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                              <div className="flex items-center gap-3 mb-2 text-indigo-600">
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">Audit Status</span>
                              </div>
                              <p className="text-[9px] font-bold text-indigo-700 leading-relaxed uppercase">
                                  Table view adheres to Certified Audit Standards. All values converted at system base rate.
                              </p>
                          </div>
                      </CardContent>
                  </Card>
              </div>
          )}

          <div className={`${showConfig ? 'lg:col-span-9' : 'lg:col-span-12'} transition-all duration-700`}>
              <Card className="rounded-[3.5rem] border-slate-200 shadow-2xl overflow-hidden bg-white min-h-[1200px] print:shadow-none print:rounded-none">
                  <div ref={reportRef} className="p-12 md:p-16 flex flex-col bg-white">
                      <div className="flex justify-between items-start mb-16">
                          <div className="flex items-center gap-6">
                              {currentProperty?.logo_url && <img src={currentProperty.logo_url} className="h-20 w-auto object-contain filter grayscale" />}
                              <div className="h-16 w-px bg-slate-200"></div>
                              <div>
                                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-2">{currentProperty?.name || settings?.name}</h2>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] leading-none">{currentOutlet?.name} &bull; ISO-9001 CERTIFIED</p>
                              </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-3">
                              <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">{incentiveDept} YIELD LEDGER</h3>
                              <div className="bg-slate-950 text-white px-6 py-3 rounded-2xl shadow-2xl">
                                  <span className="text-[9px] font-black uppercase opacity-60 block tracking-widest">Audit Period</span>
                                  <span className="text-sm font-black uppercase">{format(parseISO(reportMonth + '-01'), 'MMMM yyyy')}</span>
                              </div>
                          </div>
                      </div>
                      <div className="flex-1"><RenderTable /></div>
                      <div className="mt-12 flex justify-end">
                          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Page 1 of 1 &bull; System ID: {currentOutlet?.id?.substring(0,8)}</span>
                      </div>
                  </div>
              </Card>
          </div>
      </div>

      <style>{`
        @media print {
            body * { visibility: hidden !important; background: white !important; }
            #root, main { overflow: visible !important; height: auto !important; position: static !important; }
            div[ref] { visibility: visible !important; position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; padding: 5mm !important; }
            div[ref] * { visibility: visible !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            @page { size: A4 landscape; margin: 0; }
        }
      `}</style>
    </div>
  );
};

export default Reports;
