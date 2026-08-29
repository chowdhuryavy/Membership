
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '../components/ui';
import { db } from '../services/mockSupabase';
import { supabase as supabaseClient } from '../services/supabase';
import { Member, MassageBooking, MassageType, IncentiveRule, MemberStatus, Staff, Sale, Guest, MembershipCategory, StaffLeave, MembershipType, InventoryItem, CustomReportConfig } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, endOfMonth, differenceInCalendarDays, addDays, startOfDay, isWithinInterval, subDays, parseISO, endOfDay, startOfMonth, addMonths, parse } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { generateReportPDF } from '../src/shared/reportLogic';
import toast from 'react-hot-toast';
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
  Shield,
  LayoutGrid,
  TrendingUp,
  CreditCard,
  Building2,
  CalendarX,
  LayoutTemplate,
  Mail,
  X
} from 'lucide-react';
import { getReportData, getReportTitle, ReportContext } from '../src/shared/reportLogic';
import { emailService } from '../services/emailService';


import { toPng } from 'html-to-image';
import ExpiringMembershipsReport from './ExpiringMembershipsReport';
import MassageRoomRevenueReport from './MassageRoomRevenueReport';
import MonthlyRevenueReport from './MonthlyRevenueReport';
import ActiveMembersReport from './ActiveMembersReport';
import { useReactToPrint } from "react-to-print";
import { CustomReportViewer } from '../components/CustomReportViewer';
import TabLoader from '../components/TabLoader';

const startOfMonthLocal = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

// Report Types
type ReportType = 'revenue_recognition' | 'daily_sales' | 'incentives' | 'members_joined' | 'active_members' | 'expiring_memberships' | 'massage_room_revenue' | 'monthly_revenue' | 'custom_report';

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
  status?: string;
  
  // Revenue
  actual_price: number;
  discount_percent: number;
  discount_amount: number;
  net_revenue: number;
  
  // Incentive Breakdowns (Excel Style) - Only used for Incentive Report
  inc_total: number;
  inc_discount_percent: number;
  inc_discount_val: number;
  inc_net: number;
  
  remarks: string;
  staff_splits: Record<string, number>; // Staff ID -> Payout
}

// Interface for Revenue Recognition Row
interface RevenueRow {
    id: string;
    sl_no: number;
    guest_name: string;
    membership_no: string;
    start_date: string;
    end_date: string;
    total_days: number;
    actual_rate: number;
    discount: number;
    net_fees: number;
    prev_accrual: number;
    period_rev: number;
    deferred: number;
    category_name: string;
    membership_type_name: string;
    daily_rate: number;
}

export interface AutoDispatchConfig {
  recipient: any;
  property: any;
  outlet: any;
  date: Date;
  isManual?: boolean;
}

const Reports = ({ autoDispatchConfig }: { autoDispatchConfig?: AutoDispatchConfig }) => {
  const { user } = useAuth();
  const { settings, currency, currentOutlet, currentProperty, formatMoney, hasPermission, setPageLoading } = useSettings();
  const activeOutlet = autoDispatchConfig ? autoDispatchConfig.outlet : currentOutlet;
  const activeProperty = autoDispatchConfig ? autoDispatchConfig.property : currentProperty;
  const [reportType, setReportType] = useState<ReportType>(autoDispatchConfig?.recipient?.report_type || 'revenue_recognition');
  const [incentiveDept, setIncentiveDept] = useState<'Massage' | 'Membership' | 'Personal Training' | 'Sale' | 'Referral'>(autoDispatchConfig?.recipient?.incentive_dept || 'Massage');
  const [reportMonth, setReportMonth] = useState(format(autoDispatchConfig?.date || new Date(), 'yyyy-MM'));
  const [dailySalesDate, setDailySalesDate] = useState(format(autoDispatchConfig?.date || new Date(), 'yyyy-MM-dd'));
  const [selectedCustomReportId, setSelectedCustomReportId] = useState<string | null>(null);
  const [customReports, setCustomReports] = useState<CustomReportConfig[]>([]);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    const fetchData = async () => {
      const reports = await db.getCustomReports();
      setCustomReports(reports);
    };
    fetchData();
  }, []);
  
  // Data States
  const [rows, setRows] = useState<ReportRow[]>([]); // For Incentives & Sales
  const [revenueRows, setRevenueRows] = useState<RevenueRow[]>([]); // For Revenue Recog
  const [membershipTypes, setMembershipTypes] = useState<MembershipType[]>([]);
  const [selectedMembershipTypeId, setSelectedMembershipTypeId] = useState<string | 'all'>('all');
  const [revenueMode, setRevenueMode] = useState<'cash' | 'accrual'>('cash');
  const [activeStaffList, setActiveStaffList] = useState<Staff[]>([]);
  const [showConfig, setShowConfig] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: reportRef });
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const supabase = supabaseClient;
  
  // Cache for report results
  const reportCache = useRef<Record<string, any>>({});

  const selectedTypeName = useMemo(() => {
    if (selectedMembershipTypeId === 'all') return 'Together All Type';
    return membershipTypes.find(t => t.id === selectedMembershipTypeId)?.name || 'Selected Type';
  }, [selectedMembershipTypeId, membershipTypes]);

  // Page-Level Security Check
  const canView = user && hasPermission(user.role_id, 'reports:view');
  const canViewFinancial = user && hasPermission(user.role_id, 'reports:view_financial');
  const canViewOperational = user && hasPermission(user.role_id, 'reports:view_operational');
  const canViewStaffReports = user && hasPermission(user.role_id, 'reports:view_staff');
  const canViewMembersJoined = user && hasPermission(user.role_id, 'members:view'); // Or a specific report permission

  useEffect(() => {
    // Ensure selected report type is allowed
    if (reportType === 'revenue_recognition' && !canViewFinancial) {
        if (canViewOperational) setReportType('daily_sales');
        else if (canViewStaffReports) setReportType('incentives');
        else if (canViewMembersJoined) setReportType('members_joined');
    } else if (reportType === 'daily_sales' && !canViewOperational) {
        if (canViewFinancial) setReportType('revenue_recognition');
        else if (canViewStaffReports) setReportType('incentives');
        else if (canViewMembersJoined) setReportType('members_joined');
    } else if (reportType === 'incentives' && !canViewStaffReports) {
        if (canViewFinancial) setReportType('revenue_recognition');
        else if (canViewOperational) setReportType('daily_sales');
        else if (canViewMembersJoined) setReportType('members_joined');
    } else if (reportType === 'members_joined' && !canViewMembersJoined) {
        if (canViewFinancial) setReportType('revenue_recognition');
        else if (canViewOperational) setReportType('daily_sales');
        else if (canViewStaffReports) setReportType('incentives');
    }
  }, [canViewFinancial, canViewOperational, canViewStaffReports, canViewMembersJoined]);

  useEffect(() => {
    setSelectedMembershipTypeId('all');
  }, [activeOutlet]);

  useEffect(() => {
    if (activeOutlet && activeProperty && canView) {
      loadData();
      loadMembershipTypes();
    }
  }, [reportMonth, reportType, incentiveDept, selectedMembershipTypeId, activeOutlet, activeProperty, canView, revenueMode]);

  const loadMembershipTypes = async () => {
    if (!activeOutlet) return;
    try {
      const { data, error } = await supabase
        .from('membership_types')
        .select('*')
        .eq('outlet_id', activeOutlet.id)
        .order('name');
      if (error) throw error;
      setMembershipTypes(data || []);
    } catch (err) {
      console.error('Error loading membership types:', err);
    }
  };

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

  const [staffLeaves, setStaffLeaves] = useState<StaffLeave[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
      sl_no: true,
      date: true,
      guest_name: true,
      membership_no: true,
      reference: true,
      check_no: true,
      payment_mode: true,
      item_name: true,
      specialist: true,
      gross_amount: true,
      disc_percent: true,
      discount_amt: true,
      net_revenue: true,
      remarks: true,
      referrer: true,
      start_date: true,
      end_date: true,
      days: true,
      rev_actual: true,
      daily_rate: true,
      rev_discount: true,
      net_fees: true,
      prev_accrual: true,
      period_rev: true,
      deferred: true
  });

  const isStaffOnLeaveOnDate = (s: Staff, targetDateStr: string) => {
      if (!targetDateStr) return false;
      const target = startOfDay(new Date(targetDateStr));

      // Check probation
      if (s.probation_end_date) {
          try {
              const end = startOfDay(new Date(s.probation_end_date));
              if (target < end) return true;
          } catch (e) {}
      }
      
      // Check leaves from the staff object itself
      const leaves = (s as any).leaves || [];
      if (leaves.length > 0) {
          try {
              return leaves.some((l: any) => {
                  const start = startOfDay(new Date(l.start_date));
                  const end = startOfDay(new Date(l.end_date));
                  const isApproved = !l.status || l.status === 'approved';
                  return isWithinInterval(target, { start, end }) && isApproved;
              });
          } catch (e) {}
      }

      return false;
  };

  const isStaffOnProbationOnDate = (s: Staff, targetDateStr: string) => {
      if (s.probation_start_date && s.probation_end_date) {
          try {
              const target = startOfDay(new Date(targetDateStr));
              const start = startOfDay(new Date(s.probation_start_date));
              const end = startOfDay(new Date(s.probation_end_date));
              return isWithinInterval(target, { start, end });
          } catch (e) {}
      }
      return false;
  };

  const loadData = async () => {
    if (!activeOutlet || !activeProperty) return;
    
    const start = reportType === 'daily_sales' ? startOfDay(parseISO(dailySalesDate)) : startOfDay(parseISO(reportMonth + '-01'));
    
    // Create cache key
    const cacheKey = `${reportType}_${activeOutlet.id}_${format(start, 'yyyy-MM-dd')}_${incentiveDept}_${selectedMembershipTypeId}_${revenueMode}`;
    
    if (reportCache.current[cacheKey]) {
      const cached = reportCache.current[cacheKey];
      if (reportType === 'revenue_recognition') {
        setRevenueRows(cached.rows);
      } else {
        setRows(cached.rows);
      }
      setSummary(cached.summary);
      if (reportType === 'incentives') {
        setActiveStaffList(cached.summary.staffList || []);
      }
      return;
    }

    setLoading(true);
    if (isInitialLoad.current) {
        setPageLoading(true);
        isInitialLoad.current = false;
    }
    try {
      const ctx: ReportContext = {
        supabase,
        propertyId: activeProperty.id,
        outletId: activeOutlet.id,
        reportType: reportType as any,
        date: start,
        incentiveDept: incentiveDept as any,
        selectedMembershipTypeId: selectedMembershipTypeId,
        revenueMode: revenueMode,
        endMonthIndex: reportType === 'monthly_revenue' ? parseInt(reportMonth.split('-')[1]) - 1 : undefined
      };

      const result = await getReportData(ctx);

      // Store in cache
      reportCache.current[cacheKey] = result;

      if (reportType === 'revenue_recognition') {
        setRevenueRows(result.rows);
      } else {
        setRows(result.rows);
      }
      
      setSummary(result.summary);
      
      if (reportType === 'incentives') {
        console.log('DEBUG: Setting activeStaffList:', result.summary.staffList);
        setActiveStaffList(result.summary.staffList || []);
      }

    } catch (error) {
      console.error('Error loading report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
      setPageLoading(false);
    }
  };

  const generatePDFFromView = async () => {
    if (!reportRef.current) {
      throw new Error('Report view element is not ready.');
    }

    const element = reportRef.current;

    // Temporarily apply full-width expansion and visible overflow so tables never get cropped horizontally
    const originalWidth = element.style.width;
    const originalMinHeight = element.style.minHeight;
    const originalOverflow = element.style.overflow;

    element.style.width = 'max-content';
    element.style.minWidth = '100%';
    element.style.overflow = 'visible';

    const dataUrl = await toPng(element, {
      quality: 0.95,
      backgroundColor: '#ffffff',
      cacheBust: true,
      pixelRatio: 2,
      skipFonts: true,
      filter: (node) => {
        if (node instanceof HTMLElement && node.classList.contains('no-print')) {
          return false;
        }
        return true;
      }
    });

    // Restore original styles
    element.style.width = originalWidth;
    element.style.minHeight = originalMinHeight;
    element.style.overflow = originalOverflow;

    const img = new Image();
    img.src = dataUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const { jsPDF } = await import('jspdf');

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pdfWidth;
    let imgHeight = (img.height * pdfWidth) / img.width;

    // If total image height is slightly larger than 1 page (up to 1.35x page height),
    // scale down proportionally so the whole report fits cleanly on 1 single page!
    if (imgHeight > pdfHeight && imgHeight <= pdfHeight * 1.35) {
      const scaleFactor = (pdfHeight - 8) / imgHeight;
      const fitWidth = pdfWidth * scaleFactor;
      const xOffset = (pdfWidth - fitWidth) / 2;
      pdf.addImage(dataUrl, 'PNG', xOffset, 4, fitWidth, pdfHeight - 8, undefined, 'FAST');
    } else {
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(dataUrl, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
      }
    }

    return pdf;
  };

  const handleExportPDF = async () => {
    if (!activeOutlet || !activeProperty || !settings) return;
    setIsGeneratingPDF(true);
    
    try {
      const pdf = await generatePDFFromView();
      const reportName = getReportTitle(reportType, incentiveDept).replace(/[^a-zA-Z0-9_\-]/g, '_');
      const filename = `${reportName}_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`;
      pdf.save(filename);
      toast.success('PDF successfully exported!');
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF: ' + (error.message || 'Unknown error'));
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const hasDispatched = useRef(false);
  useEffect(() => {
    if (autoDispatchConfig && !loading && !hasDispatched.current && activeProperty) {
      hasDispatched.current = true;
      const executeDispatch = async () => {
         setIsGeneratingPDF(true);
         try {
           // Allow charts and tables to finish rendering
           await new Promise(r => setTimeout(r, 2500));
           const reportName = getReportTitle(reportType, incentiveDept);
           const pdf = await generatePDFFromView();
           const pdfBase64 = pdf.output('datauristring').split(',')[1];
           
           const dispatchRes = await emailService.sendReportEmail(
             autoDispatchConfig.recipient.email,
             reportName,
             activeProperty.name,
             activeOutlet === 'all' ? 'All Facilities' : activeOutlet.name,
             pdfBase64,
             `Automated dispatch for ${format(autoDispatchConfig.date, 'MMM dd, yyyy')}`
           );
           
           if (autoDispatchConfig.isManual) {
             if (dispatchRes && dispatchRes.success) {
               toast.success('Report intelligence effectively dispatched.');
             } else {
               toast.error('Failed to dispatch report: ' + (dispatchRes?.error || 'Email sending failed'));
             }
           }
         } catch (e) {
           console.error(e);
           if (autoDispatchConfig.isManual) {
             toast.error('Failed to dispatch report intelligence.');
           }
         } finally {
           setIsGeneratingPDF(false);
           window.dispatchEvent(new CustomEvent('REPORT_DISPATCH_COMPLETE'));
         }
      };
      executeDispatch();
    }
  }, [loading, autoDispatchConfig, activeProperty, reportType, incentiveDept]);

  const signatoryConfig = useMemo(() => {
    if (!activeOutlet || !activeProperty || !settings) return null;

    // Helper to resolve config with specific and default fallbacks
    const resolveConfig = (config: any, type: string) => {
      if (!config) return null;
      const specific = config[type];
      
      // If specific doesn't exist, this level provides no config
      if (!specific) return null;
      
      return {
        prepared: specific.prepared?.trim() || 'Accountant',
        reviewed: specific.reviewed?.trim() || '',
        approved: specific.approved?.trim() || 'General Manager'
      };
    };

    // Hierarchy: Outlet Specific -> Outlet Default -> Property Specific -> Property Default -> Global Specific -> Global Default
    const outletRes = resolveConfig(activeOutlet.signatory_config, reportType);
    if (outletRes) return outletRes;

    const propertyRes = resolveConfig(activeProperty.signatory_config, reportType);
    if (propertyRes) return propertyRes;

    const globalRes = resolveConfig(settings.signatory_config, reportType);
    if (globalRes) return globalRes;

    return null;
  }, [activeOutlet, activeProperty, settings, reportType]);

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

  const renderRevenueTable = () => {
      const displayRows = revenueRows;
      const colSpan = (visibleColumns.sl_no ? 1 : 0) +
                      (visibleColumns.guest_name ? 1 : 0) +
                      (visibleColumns.membership_no ? 1 : 0) +
                      (visibleColumns.start_date ? 1 : 0) +
                      (visibleColumns.end_date ? 1 : 0) +
                      (visibleColumns.days ? 1 : 0) +
                      (visibleColumns.daily_rate ? 1 : 0) +
                      (visibleColumns.rev_actual ? 1 : 0) +
                      (visibleColumns.rev_discount ? 1 : 0) +
                      (visibleColumns.net_fees ? 1 : 0) +
                      (visibleColumns.prev_accrual ? 1 : 0) +
                      (visibleColumns.period_rev ? 1 : 0) +
                      (visibleColumns.deferred ? 1 : 0);

      const grouped = displayRows.reduce((acc, row) => {
          const typeKey = selectedMembershipTypeId === 'all' ? (row.membership_type_name || 'Membership') : 'All';
          const catKey = row.category_name || 'Other';
          
          if (!acc[typeKey]) acc[typeKey] = {};
          if (!acc[typeKey][catKey]) acc[typeKey][catKey] = [];
          
          acc[typeKey][catKey].push(row);
          return acc;
      }, {} as Record<string, Record<string, RevenueRow[]>>);

      // Sort categories by duration and members by start date
      const sortedGrouped = Object.entries(grouped).reduce((acc, [type, categories]) => {
          const sortedCategories = Object.entries(categories).sort((a, b) => {
              // Assuming category name contains duration (e.g., "1 MONTH...")
              const getDuration = (name: string) => parseInt(name.match(/(\d+)/)?.[0] || '0');
              return getDuration(a[0]) - getDuration(b[0]);
          });

          const sortedCategoriesWithSortedMembers = sortedCategories.map(([catName, rows]) => {
              const sortedRows = [...rows].sort((a, b) => {
                  const dateA = parse(a.start_date, 'dd-MM-yyyy', new Date());
                  const dateB = parse(b.start_date, 'dd-MM-yyyy', new Date());
                  return dateA.getTime() - dateB.getTime();
              });
              return [catName, sortedRows];
          });

          acc[type] = Object.fromEntries(sortedCategoriesWithSortedMembers);
          return acc;
      }, {} as Record<string, Record<string, RevenueRow[]>>);

      let grandActual = 0;
      let grandDiscount = 0;
      let grandNetFees = 0;
      let grandPrevAccrual = 0;
      let grandPeriodRev = 0;
      let grandDeferred = 0;
      let grandDailyRate = 0;

      return (
          <div className="w-full">
              <table className="w-full border-collapse text-[9px] border-2 border-black">
                  <thead>
                      <tr className="bg-slate-950 text-white font-black uppercase tracking-widest">
                          {visibleColumns.sl_no && <th className="border border-black px-2 py-3 w-8">SL.</th>}
                          {visibleColumns.guest_name && <th className="border border-black px-2 py-3 min-w-[150px]">Guest Name / Profile</th>}
                          {visibleColumns.membership_no && <th className="border border-black px-2 py-3 w-24">Mem. No</th>}
                          {visibleColumns.start_date && <th className="border border-black px-2 py-3 w-20">Start Date</th>}
                          {visibleColumns.end_date && <th className="border border-black px-2 py-3 w-20">End Date</th>}
                          {visibleColumns.days && <th className="border border-black px-2 py-3 w-12 text-center">Days</th>}
                          {visibleColumns.daily_rate && <th className="border border-black px-2 py-3 text-right w-24">Daily Rate</th>}
                          {visibleColumns.rev_actual && <th className="border border-black px-2 py-3 text-right w-24">Actual Rate</th>}
                          {visibleColumns.rev_discount && <th className="border border-black px-2 py-3 text-right w-24">Discount</th>}
                          {visibleColumns.net_fees && <th className="border border-black px-2 py-3 text-right w-24">Net Fees</th>}
                          {visibleColumns.prev_accrual && <th className="border border-black px-2 py-3 text-right w-24">Prev. Accrual</th>}
                          {visibleColumns.period_rev && <th className="border border-black px-2 py-3 text-right w-24">Period Rev</th>}
                          {visibleColumns.deferred && <th className="border border-black px-2 py-3 text-right w-24">Deferred</th>}
                      </tr>
                  </thead>
                  <tbody>
                      {Object.entries(sortedGrouped).map(([type, categories]) => {
                          const typeRows = Object.values(categories).flat();
                          const typeDailyRate = typeRows.reduce((s, r) => s + r.daily_rate, 0);
                          const typeActual = typeRows.reduce((s, r) => s + r.actual_rate, 0);
                          const typeDiscount = typeRows.reduce((s, r) => s + r.discount, 0);
                          const typeNetFees = typeRows.reduce((s, r) => s + r.net_fees, 0);
                          const typePrevAccrual = typeRows.reduce((s, r) => s + r.prev_accrual, 0);
                          const typePeriodRev = typeRows.reduce((s, r) => s + r.period_rev, 0);
                          const typeDeferred = typeRows.reduce((s, r) => s + r.deferred, 0);

                          grandActual += typeActual;
                          grandDiscount += typeDiscount;
                          grandNetFees += typeNetFees;
                          grandPrevAccrual += typePrevAccrual;
                          grandPeriodRev += typePeriodRev;
                          grandDeferred += typeDeferred;
                          grandDailyRate += typeDailyRate;

                          return (
                              <React.Fragment key={type}>
                                  {selectedMembershipTypeId === 'all' && (
                                      <tr className="bg-slate-900 text-white">
                                          <td colSpan={colSpan} className="border border-black px-4 py-2 font-black uppercase tracking-widest text-[11px]">
                                              {type}
                                          </td>
                                      </tr>
                                  )}
                                  {Object.entries(categories).map(([category, groupRows]) => {
                                      const subDailyRate = groupRows.reduce((s, r) => s + r.daily_rate, 0);
                                      const subActual = groupRows.reduce((s, r) => s + r.actual_rate, 0);
                                      const subDiscount = groupRows.reduce((s, r) => s + r.discount, 0);
                                      const subNetFees = groupRows.reduce((s, r) => s + r.net_fees, 0);
                                      const subPrevAccrual = groupRows.reduce((s, r) => s + r.prev_accrual, 0);
                                      const subPeriodRev = groupRows.reduce((s, r) => s + r.period_rev, 0);
                                      const subDeferred = groupRows.reduce((s, r) => s + r.deferred, 0);

                                      return (
                                          <React.Fragment key={category}>
                                              {/* Group Header */}
                                              <tr className="bg-slate-100">
                                                  <td colSpan={colSpan} className="border border-black px-4 py-2 font-black text-slate-900 uppercase tracking-tight text-[10px]">
                                                      <div className="flex items-center gap-2">
                                                          <Layers className="w-3 h-3 text-indigo-500" />
                                                          Tier: {category} <span className="text-[8px] font-bold text-slate-400 ml-2">({groupRows.length} Ledger Events)</span>
                                                      </div>
                                                  </td>
                                              </tr>

                                              {/* Rows */}
                                              {groupRows.map((row, idx) => (
                                                  <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                                      {visibleColumns.sl_no && <td className="border border-black px-2 py-1 text-center text-slate-500">{idx + 1}</td>}
                                                      {visibleColumns.guest_name && <td className="border border-black px-2 py-1 font-black text-slate-800">{row.guest_name}</td>}
                                                      {visibleColumns.membership_no && <td className="border border-black px-2 py-1 text-center font-mono text-xs">{row.membership_no}</td>}
                                                      {visibleColumns.start_date && <td className="border border-black px-2 py-1 text-center text-slate-600">{row.start_date}</td>}
                                                      {visibleColumns.end_date && <td className="border border-black px-2 py-1 text-center text-slate-600">{row.end_date}</td>}
                                                      {visibleColumns.days && <td className="border border-black px-2 py-1 text-center text-slate-500">{row.total_days}</td>}
                                                      {visibleColumns.daily_rate && <td className="border border-black px-2 py-1 text-right text-slate-500">{formatMoney(row.daily_rate)}</td>}
                                                      {visibleColumns.rev_actual && <td className="border border-black px-2 py-1 text-right text-slate-500">{formatMoney(row.actual_rate)}</td>}
                                                      {visibleColumns.rev_discount && <td className="border border-black px-2 py-1 text-right text-slate-500">{formatMoney(row.discount)}</td>}
                                                      {visibleColumns.net_fees && <td className="border border-black px-2 py-1 text-right text-slate-500">{formatMoney(row.net_fees)}</td>}
                                                      {visibleColumns.prev_accrual && <td className="border border-black px-2 py-1 text-right text-slate-400">{formatMoney(row.prev_accrual)}</td>}
                                                      {visibleColumns.period_rev && <td className="border border-black px-2 py-1 text-right font-black text-indigo-700">{formatMoney(row.period_rev)}</td>}
                                                      {visibleColumns.deferred && <td className="border border-black px-2 py-1 text-right font-bold text-red-500">{formatMoney(row.deferred)}</td>}
                                                  </tr>
                                              ))}

                                              {/* Subtotal */}
                                              <tr className="bg-indigo-50/50 font-black text-[9px]">
                                                  <td colSpan={
                                                      (visibleColumns.sl_no ? 1 : 0) +
                                                      (visibleColumns.guest_name ? 1 : 0) +
                                                      (visibleColumns.membership_no ? 1 : 0) +
                                                      (visibleColumns.start_date ? 1 : 0) +
                                                      (visibleColumns.end_date ? 1 : 0) +
                                                      (visibleColumns.days ? 1 : 0)
                                                  } className="border border-black px-4 py-2 text-left uppercase text-indigo-900 tracking-widest">Tier Subtotal: {category}</td>
                                                  {visibleColumns.daily_rate && <td className="border border-black px-2 py-2 text-right text-indigo-900">{formatMoney(subDailyRate)}</td>}
                                                  {visibleColumns.rev_actual && <td className="border border-black px-2 py-2 text-right text-indigo-900">{formatMoney(subActual)}</td>}
                                                  {visibleColumns.rev_discount && <td className="border border-black px-2 py-2 text-right text-indigo-900">{formatMoney(subDiscount)}</td>}
                                                  {visibleColumns.net_fees && <td className="border border-black px-2 py-2 text-right text-indigo-900">{formatMoney(subNetFees)}</td>}
                                                  {visibleColumns.prev_accrual && <td className="border border-black px-2 py-2 text-right text-indigo-900">{formatMoney(subPrevAccrual)}</td>}
                                                  {visibleColumns.period_rev && <td className="border border-black px-2 py-2 text-right text-indigo-900">{formatMoney(subPeriodRev)}</td>}
                                                  {visibleColumns.deferred && <td className="border border-black px-2 py-2 text-right text-indigo-900">{formatMoney(subDeferred)}</td>}
                                              </tr>
                                          </React.Fragment>
                                      );
                                  })}
                                  {selectedMembershipTypeId === 'all' && (
                                      <tr className="bg-indigo-100 font-black text-[10px]">
                                          <td colSpan={
                                              (visibleColumns.sl_no ? 1 : 0) +
                                              (visibleColumns.guest_name ? 1 : 0) +
                                              (visibleColumns.membership_no ? 1 : 0) +
                                              (visibleColumns.start_date ? 1 : 0) +
                                              (visibleColumns.end_date ? 1 : 0) +
                                              (visibleColumns.days ? 1 : 0)
                                          } className="border border-black px-4 py-2 text-left uppercase text-indigo-950 tracking-widest">Type Total: {type}</td>
                                          {visibleColumns.daily_rate && <td className="border border-black px-2 py-2 text-right text-indigo-950">{formatMoney(typeDailyRate)}</td>}
                                          {visibleColumns.rev_actual && <td className="border border-black px-2 py-2 text-right text-indigo-950">{formatMoney(typeActual)}</td>}
                                          {visibleColumns.rev_discount && <td className="border border-black px-2 py-2 text-right text-indigo-950">{formatMoney(typeDiscount)}</td>}
                                          {visibleColumns.net_fees && <td className="border border-black px-2 py-2 text-right text-indigo-950">{formatMoney(typeNetFees)}</td>}
                                          {visibleColumns.prev_accrual && <td className="border border-black px-2 py-2 text-right text-indigo-950">{formatMoney(typePrevAccrual)}</td>}
                                          {visibleColumns.period_rev && <td className="border border-black px-2 py-2 text-right text-indigo-950">{formatMoney(typePeriodRev)}</td>}
                                          {visibleColumns.deferred && <td className="border border-black px-2 py-2 text-right text-indigo-950">{formatMoney(typeDeferred)}</td>}
                                      </tr>
                                  )}
                              </React.Fragment>
                          );
                      })}

                      {/* Grand Total */}
                      <tr className="bg-slate-900 text-white font-black text-[10px]">
                          <td colSpan={
                              (visibleColumns.sl_no ? 1 : 0) +
                              (visibleColumns.guest_name ? 1 : 0) +
                              (visibleColumns.membership_no ? 1 : 0) +
                              (visibleColumns.start_date ? 1 : 0) +
                              (visibleColumns.end_date ? 1 : 0) +
                              (visibleColumns.days ? 1 : 0)
                          } className="border border-black px-4 py-3 text-right uppercase tracking-widest">
                              Aggregate Portfolio Totals
                          </td>
                          {visibleColumns.daily_rate && <td className="border border-black px-2 py-3 text-right">{formatMoney(grandDailyRate)}</td>}
                          {visibleColumns.rev_actual && <td className="border border-black px-2 py-3 text-right">{formatMoney(grandActual)}</td>}
                          {visibleColumns.rev_discount && <td className="border border-black px-2 py-3 text-right">{formatMoney(grandDiscount)}</td>}
                          {visibleColumns.net_fees && <td className="border border-black px-2 py-3 text-right">{formatMoney(grandNetFees)}</td>}
                          {visibleColumns.prev_accrual && <td className="border border-black px-2 py-3 text-right">{formatMoney(grandPrevAccrual)}</td>}
                          {visibleColumns.period_rev && <td className="border border-black px-2 py-3 text-right text-indigo-300">{formatMoney(grandPeriodRev)}</td>}
                          {visibleColumns.deferred && <td className="border border-black px-2 py-3 text-right text-red-400">{formatMoney(grandDeferred)}</td>}
                      </tr>
                  </tbody>
              </table>
          </div>
      );
  };

  const renderStandardTable = () => {
    const isIncentiveReport = reportType === 'incentives';
    const isDailySales = reportType === 'daily_sales';
    const isMembersJoined = reportType === 'members_joined';

    const colSpanForLabel = (visibleColumns.sl_no ? 1 : 0) +
                            (visibleColumns.date ? 1 : 0) +
                            (visibleColumns.guest_name ? 1 : 0) +
                            (isMembersJoined && visibleColumns.membership_no ? 1 : 0) +
                            (visibleColumns.reference ? 1 : 0) +
                            (visibleColumns.referrer && incentiveDept !== 'Referral' ? 1 : 0) +
                            (visibleColumns.check_no ? 1 : 0) +
                            (isDailySales && visibleColumns.payment_mode ? 1 : 0) +
                            (visibleColumns.item_name ? 1 : 0) +
                            (isIncentiveReport && visibleColumns.specialist && incentiveDept !== 'Membership' ? 1 : 0);

    const totalColSpan = colSpanForLabel +
                        (visibleColumns.gross_amount ? 1 : 0) +
                        (visibleColumns.disc_percent ? 1 : 0) +
                        (visibleColumns.discount_amt ? 1 : 0) +
                        (visibleColumns.net_revenue ? 1 : 0) +
                        (isIncentiveReport && incentiveDept === 'Membership' ? 1 : 0) +
                        (visibleColumns.remarks ? 1 : 0) +
                        (isIncentiveReport ? 4 : 0) + // Incentive columns
                        (isIncentiveReport ? (activeStaffList?.length || 0) : 0);

    // Calculation variables
    let totalActual = 0;
    let totalDiscount = 0;
    let totalNetRev = 0;
    let totalIncTotal = 0;
    let totalIncDiscountVal = 0;
    let totalIncNet = 0;
    let totalReferralAmt = 0;
    const staffTotals: Record<string, number> = {};

    rows.forEach(row => {
        totalActual += Number(row.actual_price || 0);
        totalDiscount += Number(row.discount_amount || 0);
        totalNetRev += Number(row.net_revenue || 0);
        totalIncTotal += Number(row.inc_total || 0);
        totalIncDiscountVal += Number(row.inc_discount_val || 0);
        totalIncNet += Number(row.inc_net || 0);
        totalReferralAmt += Number((row as any).referral_amount || 0);
        
        if (row.staff_splits) {
            Object.entries(row.staff_splits).forEach(([staffId, amount]) => {
                staffTotals[staffId] = (staffTotals[staffId] || 0) + (Number(amount) || 0);
            });
        }
    });

    const totals = { totalActual, totalDiscount, totalNetRev, totalIncTotal, totalIncDiscountVal, totalIncNet, totalReferralAmt, staffTotals };

    let specialistLabel = 'Staff';
    if (reportType === 'incentives') {
        if (incentiveDept === 'Massage') specialistLabel = 'Therapist';
        else if (incentiveDept === 'Personal Training') specialistLabel = 'Personal Trainer';
        else if (incentiveDept === 'Membership') specialistLabel = 'Performance';
        else if (incentiveDept === 'Referral') specialistLabel = 'Referral Name';
    }

    return (
        <div className="w-full">
            <table className="w-full border-collapse text-[9px] border-2 border-black">
                <thead>
                    <tr className="bg-slate-950 text-white font-black uppercase tracking-widest">
                        {visibleColumns.sl_no && <th rowSpan={2} className="border border-black px-2 py-3 w-8">Sl.No.</th>}
                        {visibleColumns.date && <th rowSpan={2} className="border border-black px-2 py-3 w-20">Date</th>}
                        {visibleColumns.guest_name && <th rowSpan={2} className="border border-black px-2 py-3 min-w-[120px]">Guest / Member</th>}
                        {(isMembersJoined && visibleColumns.membership_no) && <th rowSpan={2} className="border border-black px-2 py-3 w-24">Mem. No</th>}
                        
                        {visibleColumns.referrer && (incentiveDept !== 'Referral') && <th rowSpan={2} className="border border-black px-2 py-3 w-24">Referrer</th>}
                        {visibleColumns.check_no && <th rowSpan={2} className="border border-black px-2 py-3 w-20">Check No.</th>}
                        {(isDailySales && visibleColumns.payment_mode) && <th rowSpan={2} className="border border-black px-2 py-3 w-24">Payment Mode</th>}
                        {visibleColumns.item_name && <th rowSpan={2} className="border border-black px-2 py-3 min-w-[100px]">Item / Service</th>}
                        {visibleColumns.reference && <th rowSpan={2} className="border border-black px-2 py-3 w-20">{isMembersJoined ? 'Category' : 'Dur.'}</th>}
                        {(isIncentiveReport && visibleColumns.specialist && incentiveDept !== 'Membership') && <th rowSpan={2} className="border border-black px-2 py-3">{specialistLabel}</th>}
                        
                        {visibleColumns.gross_amount && <th rowSpan={2} className="border border-black px-2 py-3 text-right w-20">Gross Amount</th>}
                        {visibleColumns.disc_percent && <th rowSpan={2} className="border border-black px-2 py-3 text-center w-12">Disc %</th>}
                        {visibleColumns.discount_amt && <th rowSpan={2} className="border border-black px-2 py-3 text-right w-20">Discount Amt</th>}
                        {visibleColumns.net_revenue && <th rowSpan={2} className="border border-black px-2 py-3 text-right w-20">Net Revenue</th>}
                        {(isIncentiveReport && incentiveDept === 'Membership') && <th rowSpan={2} className="border border-black px-2 py-3 text-right bg-indigo-50 text-indigo-900 w-20">Referral Amt</th>}
                        
                        {/* Incentive Columns only for Incentive Report */}
                        {isIncentiveReport && <th colSpan={4} className="border border-black px-2 py-1 text-center bg-amber-100 text-slate-900">Incentive Breakdown</th>}
                        
                        {visibleColumns.remarks && <th rowSpan={2} className="border border-black px-2 py-3 min-w-[100px]">Remarks</th>}
                        
                        {isIncentiveReport && Array.isArray(activeStaffList) && activeStaffList.map(s => (
                            <th key={s.id} rowSpan={2} className="border border-black px-1 py-3 w-16 bg-slate-900 text-center">
                                <div className="rotate-180" style={{ writingMode: 'vertical-rl' }}>{s.name.toUpperCase()}</div>
                            </th>
                        ))}
                    </tr>
                    <tr className="bg-amber-50 text-slate-900">
                        {isIncentiveReport && (
                            <>
                                <th className="border border-black px-2 py-1 w-14 text-center">Total</th>
                                <th className="border border-black px-2 py-1 w-14 text-center">Disc %</th>
                                <th className="border border-black px-2 py-1 w-14 text-center">Disc. Inc</th>
                                <th className="border border-black px-2 py-1 w-14 text-center">Net</th>
                            </>
                        )}
                    </tr>
                </thead>
                <tbody>
                    {(() => {
                        if (isMembersJoined) {
                            const grouped = rows.reduce((acc, row) => {
                                const typeKey = selectedMembershipTypeId === 'all' ? ((row as any).membership_type_name || 'Membership') : 'Filtered Results';
                                const catKey = (row as any).category || 'Other';
                                if (!acc[typeKey]) acc[typeKey] = {};
                                if (!acc[typeKey][catKey]) acc[typeKey][catKey] = [];
                                acc[typeKey][catKey].push(row);
                                return acc;
                            }, {} as Record<string, Record<string, any[]>>);

                            return Object.entries(grouped).map(([type, categories]) => {
                                const typeRows = Object.values(categories).flat();
                                return (
                                    <React.Fragment key={type}>
                                        {selectedMembershipTypeId === 'all' && (
                                            <tr className="bg-slate-900 text-white">
                                                <td colSpan={totalColSpan} className="border border-black px-2 py-1 font-black uppercase tracking-widest text-[11px]">
                                                    {type}
                                                </td>
                                            </tr>
                                        )}
                                        {Object.entries(categories).map(([cat, groupRows]) => (
                                            <React.Fragment key={cat}>
                                                <tr className="bg-slate-100">
                                                    <td colSpan={totalColSpan} className="border border-black px-2 py-1 font-black text-slate-900 uppercase tracking-tight text-[10px] pl-6">
                                                        Tier: {cat} ({groupRows.length} Members)
                                                    </td>
                                                </tr>
                                                {groupRows.map((row, idx) => (
                                                    <tr key={row.id || idx} className="hover:bg-slate-50 transition-colors">
                                                        {visibleColumns.sl_no && <td className="border border-black px-2 py-1 text-center font-bold">{row.sl_no}</td>}
                                                        {visibleColumns.date && <td className="border border-black px-2 py-1 text-center whitespace-nowrap">{row.date}</td>}
                                                        {visibleColumns.guest_name && <td className="border border-black px-2 py-1 font-black text-slate-700">{row.guest_name}</td>}
                                                        {(isMembersJoined && visibleColumns.membership_no) && <td className="border border-black px-2 py-1 text-center font-mono text-xs">{(row as any).membership_no}</td>}
                                                        
                                                        {visibleColumns.referrer && <td className="border border-black px-2 py-1 text-center font-bold text-indigo-600">{(row as any).referrer_name || 'N/A'}</td>}
                                                        {visibleColumns.check_no && <td className="border border-black px-2 py-1 text-center text-slate-400">{row.check_no}</td>}
                                                        {(isDailySales && visibleColumns.payment_mode) && <td className="border border-black px-2 py-1 text-center text-slate-500 font-bold">{row.mode_of_payment}</td>}
                                                        {visibleColumns.item_name && <td className="border border-black px-2 py-1">{row.item_name}</td>}
                                                        {visibleColumns.reference && <td className="border border-black px-2 py-1 text-center">{isMembersJoined ? (row as any).category : (row.duration || '-')}</td>}
                                                        {(isIncentiveReport && visibleColumns.specialist && incentiveDept !== 'Membership') && <td className="border border-black px-2 py-1 text-center font-bold bg-slate-50 text-indigo-700">{row.therapist_name}</td>}
                                                        
                                                        {visibleColumns.gross_amount && <td className="border border-black px-2 py-1 text-right">{formatMoney(row.actual_price)}</td>}
                                                        {visibleColumns.disc_percent && <td className="border border-black px-2 py-1 text-center text-slate-400">{row.discount_percent > 0 ? `${(Number(row.discount_percent) || 0).toFixed(0)}%` : ''}</td>}
                                                        {visibleColumns.discount_amt && <td className="border border-black px-2 py-1 text-right">{formatMoney(row.discount_amount)}</td>}
                                                        {visibleColumns.net_revenue && <td className="border border-black px-2 py-1 text-right font-black bg-slate-50">{formatMoney(row.net_revenue)}</td>}
                                                        
                                                        {visibleColumns.remarks && <td className="border border-black px-2 py-1 text-[8px] text-slate-400 italic truncate max-w-[120px]">{row.remarks}</td>}
                                                    </tr>
                                                ))}
                                                <tr className="bg-slate-50 font-bold">
                                                    <td colSpan={colSpanForLabel} className="border border-black px-2 py-1 text-left italic text-[8px] pl-10">Subtotal Tier {cat}:</td>
                                                    {visibleColumns.gross_amount && <td className="border border-black px-2 py-1 text-right">{formatMoney(groupRows.reduce((sum, r) => sum + (Number(r.actual_price) || 0), 0))}</td>}
                                                    {visibleColumns.disc_percent && <td className="border border-black px-2 py-1"></td>}
                                                    {visibleColumns.discount_amt && <td className="border border-black px-2 py-1 text-right">{formatMoney(groupRows.reduce((sum, r) => sum + (Number(r.discount_amount) || 0), 0))}</td>}
                                                    {visibleColumns.net_revenue && <td className="border border-black px-2 py-1 text-right">{formatMoney(groupRows.reduce((sum, r) => sum + (Number(r.net_revenue) || 0), 0))}</td>}
                                                    {isIncentiveReport && (
                                                        <>
                                                            <td className="border border-black px-2 py-1 text-right">{formatMoney(groupRows.reduce((sum, r) => sum + (Number(r.inc_total) || 0), 0))}</td>
                                                            <td className="border border-black px-2 py-1"></td>
                                                            <td className="border border-black px-2 py-1 text-right">{formatMoney(groupRows.reduce((sum, r) => sum + (Number(r.inc_discount_val) || 0), 0))}</td>
                                                            <td className="border border-black px-2 py-1 text-right font-black">{formatMoney(groupRows.reduce((sum, r) => sum + (Number(r.inc_net) || 0), 0))}</td>
                                                        </>
                                                    )}
                                                    {visibleColumns.remarks && <td className="border border-black px-2 py-1"></td>}
                                                    {isIncentiveReport && Array.isArray(activeStaffList) && activeStaffList.map(s => (
                                                        <td key={s.id} className="border border-black px-1 py-1 text-right font-bold">
                                                            {formatMoney(groupRows.reduce((sum, r) => sum + (Number(r.staff_splits?.[s.id]) || 0), 0))}
                                                        </td>
                                                    ))}
                                                </tr>
                                            </React.Fragment>
                                        ))}
                                        {selectedMembershipTypeId === 'all' && (
                                            <tr className="bg-indigo-50 font-black">
                                                <td colSpan={colSpanForLabel} className="border border-black px-2 py-1 text-left uppercase text-[9px]">Total Type {type}:</td>
                                                {visibleColumns.gross_amount && <td className="border border-black px-2 py-1 text-right">{formatMoney(typeRows.reduce((sum, r) => sum + (Number(r.actual_price) || 0), 0))}</td>}
                                                {visibleColumns.disc_percent && <td className="border border-black px-2 py-1"></td>}
                                                {visibleColumns.discount_amt && <td className="border border-black px-2 py-1 text-right">{formatMoney(typeRows.reduce((sum, r) => sum + (Number(r.discount_amount) || 0), 0))}</td>}
                                                {visibleColumns.net_revenue && <td className="border border-black px-2 py-1 text-right">{formatMoney(typeRows.reduce((sum, r) => sum + (Number(r.net_revenue) || 0), 0))}</td>}
                                                {isIncentiveReport && (
                                                    <>
                                                        <td className="border border-black px-2 py-1 text-right">{formatMoney(typeRows.reduce((sum, r) => sum + (Number(r.inc_total) || 0), 0))}</td>
                                                        <td className="border border-black px-2 py-1"></td>
                                                        <td className="border border-black px-2 py-1 text-right">{formatMoney(typeRows.reduce((sum, r) => sum + (Number(r.inc_discount_val) || 0), 0))}</td>
                                                        <td className="border border-black px-2 py-1 text-right font-black">{formatMoney(typeRows.reduce((sum, r) => sum + (Number(r.inc_net) || 0), 0))}</td>
                                                    </>
                                                )}
                                                {visibleColumns.remarks && <td className="border border-black px-2 py-1"></td>}
                                                {isIncentiveReport && Array.isArray(activeStaffList) && activeStaffList.map(s => (
                                                    <td key={s.id} className="border border-black px-1 py-1 text-right font-bold">
                                                        {formatMoney(typeRows.reduce((sum, r) => sum + (Number(r.staff_splits?.[s.id]) || 0), 0))}
                                                    </td>
                                                ))}
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            });
                        }

                        return (
                            <>
                                {Array.isArray(rows) && rows.map((row, idx) => (
                                    <tr key={(row as any).id || idx} className="hover:bg-slate-50 transition-colors">
                                        {visibleColumns.sl_no && <td className="border border-black px-2 py-1 text-center font-bold">{row.sl_no}</td>}
                                        {visibleColumns.date && <td className="border border-black px-2 py-1 text-center whitespace-nowrap">{row.date}</td>}
                                        {visibleColumns.guest_name && <td className="border border-black px-2 py-1 font-black text-slate-700">{row.guest_name}</td>}
                                        {(isMembersJoined && visibleColumns.membership_no) && <td className="border border-black px-2 py-1 text-center font-mono text-xs">{(row as any).membership_no}</td>}
                                        
                                        {visibleColumns.referrer && (incentiveDept !== 'Referral') && <td className="border border-black px-2 py-1 text-center font-bold text-indigo-600">{(row as any).referrer_name || 'N/A'}</td>}
                                        {visibleColumns.check_no && <td className="border border-black px-2 py-1 text-center text-slate-400">{row.check_no}</td>}
                                        {(isDailySales && visibleColumns.payment_mode) && <td className="border border-black px-2 py-1 text-center text-slate-500 font-bold">{row.mode_of_payment}</td>}
                                        {visibleColumns.item_name && <td className="border border-black px-2 py-1">{row.item_name}</td>}
                                        {visibleColumns.reference && <td className="border border-black px-2 py-1 text-center">{isMembersJoined ? (row as any).category : (row.duration || '-')}</td>}
                                        {(isIncentiveReport && visibleColumns.specialist && incentiveDept !== 'Membership') && <td className="border border-black px-2 py-1 text-center font-bold bg-slate-50 text-indigo-700">{row.therapist_name}</td>}
                                        
                                        {visibleColumns.gross_amount && <td className="border border-black px-2 py-1 text-right">{formatMoney(row.actual_price)}</td>}
                                        {visibleColumns.disc_percent && <td className="border border-black px-2 py-1 text-center text-slate-400">{row.discount_percent > 0 ? `${(Number(row.discount_percent) || 0).toFixed(0)}%` : ''}</td>}
                                        {visibleColumns.discount_amt && <td className="border border-black px-2 py-1 text-right">{formatMoney(row.discount_amount)}</td>}
                                        {visibleColumns.net_revenue && <td className="border border-black px-2 py-1 text-right font-black bg-slate-50">{formatMoney(row.net_revenue)}</td>}
                                        {(isIncentiveReport && incentiveDept === 'Membership') && <td className="border border-black px-2 py-1 text-right font-bold text-indigo-600 bg-indigo-50/30">{formatMoney((row as any).referral_amount)}</td>}
                                        
                                        {isIncentiveReport && (
                                            <>
                                                <td className="border border-black px-2 py-1 text-right bg-amber-50/20">{formatMoney(row.inc_total)}</td>
                                                <td className="border border-black px-2 py-1 text-center bg-amber-50/20 text-slate-400">{row.inc_discount_percent > 0 ? `${(Number(row.inc_discount_percent) || 0).toFixed(0)}%` : ''}</td>
                                                <td className="border border-black px-2 py-1 text-right bg-amber-50/20">{formatMoney(row.inc_discount_val)}</td>
                                                <td className="border border-black px-2 py-1 text-right font-black bg-amber-100/30">{formatMoney(row.inc_net)}</td>
                                            </>
                                        )}
                                        
                                        {visibleColumns.remarks && <td className="border border-black px-2 py-1 text-[8px] text-slate-400 italic truncate max-w-[120px]">{row.remarks}</td>}
                                        
                                        {isIncentiveReport && Array.isArray(activeStaffList) && activeStaffList.map(s => {
                                            const val = row.staff_splits[s.id] || 0;
                                            return (
                                                <td key={s.id} className={`border border-black px-1 py-1 text-right font-black ${val > 0 ? 'bg-indigo-50 text-indigo-700' : 'text-slate-100'}`}>
                                                    {val > 0 ? formatMoney(val) : formatMoney(0)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </>
                        );
                    })()}
                    <tr className="bg-slate-100 font-bold">
                        <td colSpan={colSpanForLabel} className="border border-black px-4 py-3 text-right uppercase tracking-widest text-slate-500 text-[10px]">Aggregate Portfolio Totals</td>
                        {visibleColumns.gross_amount && <td className="border border-black px-2 py-3 text-right text-slate-500">{formatMoney(totals.totalActual)}</td>}
                        {visibleColumns.disc_percent && <td className="border border-black px-2 py-3"></td>}
                        {visibleColumns.discount_amt && <td className="border border-black px-2 py-3 text-right text-rose-600">{formatMoney(totals.totalDiscount)}</td>}
                        {visibleColumns.net_revenue && <td className="border border-black px-2 py-3 text-right font-black text-[11px] text-emerald-700">{formatMoney(totals.totalNetRev)}</td>}
                        
                        {(isIncentiveReport && incentiveDept === 'Membership') && <td className="border border-black px-2 py-3 text-right font-black text-[11px] text-indigo-600 bg-indigo-50/30">{formatMoney(totals.totalReferralAmt)}</td>}

                        {isIncentiveReport && (
                            <>
                                <td className="border border-black px-2 py-3 text-right bg-amber-100/50">{formatMoney(totals.totalIncTotal)}</td>
                                <td className="border border-black px-2 py-3 bg-amber-100/50"></td>
                                <td className="border border-black px-2 py-3 text-right bg-amber-100/50">{formatMoney(totals.totalIncDiscountVal)}</td>
                                <td className="border border-black px-2 py-3 text-right font-black text-[11px] text-indigo-900 bg-amber-200/50">{formatMoney(totals.totalIncNet)}</td>
                                {visibleColumns.remarks && <td className="border border-black px-2 py-3 bg-amber-50"></td>}
                                {Array.isArray(activeStaffList) && activeStaffList.map(s => (
                                    <td key={s.id} className="border border-black px-1 py-3 text-right text-indigo-900 font-bold bg-indigo-50/50">
                                        {formatMoney(totals.staffTotals[s.id] || 0)}
                                    </td>
                                ))}
                            </>
                        )}
                        {!isIncentiveReport && visibleColumns.remarks && <td className="border border-black px-2 py-3 bg-slate-50"></td>}
                    </tr>
                </tbody>
            </table>
            {isIncentiveReport && (
                <div className="mt-8 space-y-8">
                    {/* Primary Staff Incentive Summary - Show if there are staff totals or if not a referral report */}
                    {(incentiveDept !== 'Referral' || Object.values(totals.staffTotals).some(v => Number(v) > 0)) && (
                        <div className="w-full max-w-sm">
                            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                                 <Award className="w-4 h-4 text-indigo-600" /> Staff Incentive Summary
                            </h4>
                            <table className="w-full border-collapse text-[10px] border-2 border-black shadow-sm">
                                <thead>
                                    <tr className="bg-slate-950 text-white font-black uppercase tracking-widest border-b-2 border-black">
                                        <th className="border border-black px-4 py-3 text-left">Staff Member</th>
                                        <th className="border border-black px-4 py-3 text-right">Credit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeStaffList.map((s, idx) => {
                                        const amount = totals.staffTotals[s.id] || 0;
                                        // On Referral report, hide zeros. On others, show all if they were included in activeStaffList
                                        if (incentiveDept === 'Referral' && amount <= 0) return null;
                                        
                                        const colors = ['bg-emerald-50/50', 'bg-orange-50/50', 'bg-amber-50/50', 'bg-yellow-50/50', 'bg-green-50/50', 'bg-slate-50/50', 'bg-blue-50/50'];
                                        const color = colors[idx % colors.length];
                                        return (
                                            <tr key={s.id} className={`${color} font-bold border-b border-black hover:bg-white transition-colors`}>
                                                <td className="border border-black px-4 py-2 text-slate-700">{s.name}</td>
                                                <td className="border border-black px-4 py-2 text-right">{formatMoney(amount)}</td>
                                            </tr>
                                        );
                                    })}
                                    <tr className="bg-white font-black border-t-2 border-black">
                                        <td className="border border-black px-4 py-3 text-center uppercase tracking-widest bg-slate-50">Total Staff Payout</td>
                                        <td className="border border-black px-4 py-3 text-right bg-slate-50">{formatMoney(Object.values(totals.staffTotals).reduce((a: number, b: any) => a + (Number(b) || 0), 0))}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Referrer Rewards Summary - Only for Referral Dept */}
                    {incentiveDept === 'Referral' && summary?.referrerSummaries?.length > 0 && (
                        <div className="w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
                            <h4 className="text-[10px] font-black text-emerald-700 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                                 <Globe className="w-4 h-4 text-emerald-600" /> Referrer Rewards Summary
                            </h4>
                            <table className="w-full border-collapse text-[10px] border-2 border-black shadow-sm overflow-hidden rounded-xl">
                                <thead>
                                    <tr className="bg-emerald-600 text-white font-black uppercase tracking-widest border-b-2 border-black">
                                        <th className="border border-black px-4 py-3 text-left w-12 text-center">SL.</th>
                                        <th className="border border-black px-4 py-3 text-left">Referrer Designation</th>
                                        <th className="border border-black px-4 py-3 text-right">Reward Credit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.referrerSummaries.map((ref: any, idx: number) => (
                                        <tr key={ref.name} className="bg-emerald-50/30 font-bold border-b border-black hover:bg-white transition-colors">
                                            <td className="border border-black px-4 py-2 text-center text-emerald-700">{idx + 1}</td>
                                            <td className="border border-black px-4 py-2 text-slate-700 uppercase tracking-tight">{ref.name}</td>
                                            <td className="border border-black px-4 py-2 text-right text-emerald-600">{formatMoney(ref.amount)}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-emerald-100 font-black border-t-2 border-black">
                                        <td colSpan={2} className="border border-black px-4 py-3 text-center uppercase tracking-widest">Total Referrer Payout</td>
                                        <td className="border border-black px-4 py-3 text-right">{formatMoney(summary.referrerSummaries.reduce((sum: number, r: any) => sum + r.amount, 0))}</td>
                                    </tr>
                                </tbody>
                            </table>
                            <p className="mt-2 text-[8px] font-bold text-slate-400 uppercase tracking-widest italic">
                                * Rewards for referrers are calculated based on specifically authorized referral incentive rules.
                            </p>
                        </div>
                    )}


                </div>
            )}
        </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 print:pb-0">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-xl no-print">
        <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-indigo-100"><FileText className="w-7 h-7" /></div>
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Financial Audit Center</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2">Executive Ledger System</p>
            </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
            <div className="flex items-center gap-3 bg-white border border-slate-200 px-5 py-3 rounded-2xl shadow-sm">
                {reportType === 'daily_sales' ? (
                    <div className="flex items-center gap-2">
                        <input type="date" value={dailySalesDate} onChange={e => setDailySalesDate(e.target.value)} className="text-[11px] font-black uppercase bg-transparent outline-none cursor-pointer" />
                        <Button onClick={loadData} className="h-8 text-[9px] px-3">Generate</Button>
                    </div>
                ) : (
                    <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)} className="text-[11px] font-black uppercase bg-transparent outline-none cursor-pointer" />
                )}
            </div>
            <Button variant="outline" onClick={() => setShowConfig(!showConfig)} className={`h-12 px-5 rounded-2xl border-slate-200 ${showConfig ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-inner' : ''}`}><Settings2 className="w-4 h-4 mr-2" /> <span className="text-[10px] font-black uppercase tracking-widest">Layout Config</span></Button>
            <Button onClick={handlePrint} className="h-12 px-6 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 transition-all active:scale-95 no-print bg-indigo-600 text-white hover:bg-indigo-700"><Printer className="w-4 h-4 mr-2" /> Print Direct</Button>
            <Button variant="outline" onClick={handleExportPDF} isLoading={isGeneratingPDF} className="h-12 px-8 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] border-slate-200 bg-white hover:bg-slate-50 shadow-sm transition-all active:scale-95"><FileDown className="w-4 h-4 mr-2 text-indigo-600" /> Export PDF</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {showConfig && (
              <div className="lg:col-span-3 animate-in slide-in-from-left-6 duration-500 no-print">
                  <Card className="rounded-[2.5rem] border-slate-200/60 shadow-2xl sticky top-24 overflow-hidden bg-white">
                      <CardHeader className="bg-slate-950 text-white p-8 border-b border-slate-800">
                          <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-3">
                              <ListFilter className="w-4 h-4 text-indigo-400" /> Layout Engine
                          </CardTitle>
                      </CardHeader>
                      <CardContent className="p-8 space-y-10">
                          
                          {/* 1. REPORT TYPE SWITCHER */}
                          <div className="space-y-4">
                              <div className="flex items-center gap-2 mb-1">
                                  <LayoutGrid className="w-3.5 h-3.5 text-indigo-600"/>
                                  <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Report Type</label>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                  {[
                                      { id: 'revenue_recognition', label: 'Revenue Recognition', icon: UserCheck, permission: canViewFinancial },
                                      { id: 'incentives', label: 'Incentive Audit', icon: Award, permission: canViewStaffReports },
                                      { id: 'daily_sales', label: 'Daily Sales Ledger', icon: CreditCard, permission: canViewOperational },
                                      { id: 'members_joined', label: 'Members Joined', icon: UserCheck, permission: canViewMembersJoined },
                                      { id: 'active_members', label: 'Active Members', icon: UserCheck, permission: canViewMembersJoined },
                                      { id: 'expiring_memberships', label: 'Expiring Memberships', icon: CalendarX, permission: canViewMembersJoined },
                                      { id: 'massage_room_revenue', label: 'Massage Room Revenue', icon: Building2, permission: canViewFinancial },
                                      { id: 'monthly_revenue', label: 'Monthly Revenue Report', icon: TrendingUp, permission: canViewFinancial }
                                  ].filter(t => t.permission).map(type => (
                                      <button 
                                        key={type.id} 
                                        onClick={() => setReportType(type.id as any)} 
                                        className={`w-full px-5 py-4 rounded-2xl text-left text-[10px] font-black uppercase tracking-widest transition-all border-2 flex items-center gap-3 ${
                                          reportType === type.id 
                                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 scale-[1.02]' 
                                          : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-white hover:border-slate-200 hover:text-slate-600'
                                        }`}
                                      >
                                          <type.icon className="w-4 h-4 opacity-70" /> {type.label}
                                      </button>
                                  ))}
                              </div>
                          </div>

                          {/* 1.1 MEMBERSHIP TYPE TOGGLE (For Revenue Recognition, Members Joined, and Expiring Memberships) */}
                          {['revenue_recognition', 'members_joined', 'expiring_memberships', 'active_members'].includes(reportType) && membershipTypes.length > 0 && (
                               <div className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                                   <div className="flex items-center gap-2 mb-1">
                                       <Filter className="w-3.5 h-3.5 text-indigo-600"/>
                                       <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Membership Type</label>
                                   </div>
                                   <div className="grid grid-cols-1 gap-2">
                                       <button 
                                           onClick={() => setSelectedMembershipTypeId('all')}
                                           className={`w-full px-5 py-3 rounded-2xl text-left text-[9px] font-black uppercase tracking-widest transition-all border ${
                                               selectedMembershipTypeId === 'all' 
                                               ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                                               : 'bg-white border-transparent text-slate-400 hover:bg-slate-50'
                                           }`}
                                       >
                                           Together (All Types)
                                       </button>
                                       {membershipTypes.map(type => (
                                           <button 
                                               key={type.id}
                                               onClick={() => setSelectedMembershipTypeId(type.id)}
                                               className={`w-full px-5 py-3 rounded-2xl text-left text-[9px] font-black uppercase tracking-widest transition-all border ${
                                                   selectedMembershipTypeId === type.id 
                                                   ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                                                   : 'bg-white border-transparent text-slate-400 hover:bg-slate-50'
                                               }`}
                                           >
                                               {type.name}
                                           </button>
                                       ))}
                                   </div>
                               </div>
                          )}

                          {/* 3. CUSTOM REPORTS */}
                          <div className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                              <div className="flex items-center gap-2 mb-1">
                                  <LayoutTemplate className="w-3.5 h-3.5 text-indigo-600"/>
                                  <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Custom Intelligence</label>
                              </div>
                              <div className="grid grid-cols-1 gap-2">
                                  {customReports.map(report => (
                                      <button 
                                        key={report.id} 
                                        onClick={() => {
                                            setReportType('custom_report');
                                            setSelectedCustomReportId(report.id);
                                        }} 
                                        className={`w-full px-5 py-4 rounded-2xl text-left text-[10px] font-black uppercase tracking-widest transition-all border-2 flex items-center gap-3 ${
                                          reportType === 'custom_report' && selectedCustomReportId === report.id
                                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-100 scale-[1.02]' 
                                          : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-white hover:border-slate-200 hover:text-slate-600'
                                        }`}
                                      >
                                          <FileText className="w-4 h-4 opacity-70" /> {report.name}
                                      </button>
                                  ))}
                              </div>
                          </div>

                          {/* 2. REWARD DEPARTMENT (Only for Incentives) */}
                          {reportType === 'incentives' && (
                              <div className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                                  <div className="flex items-center gap-2 mb-1">
                                      <Award className="w-3.5 h-3.5 text-indigo-600"/>
                                      <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Reward Department</label>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2">
                                      {(['Massage', 'Membership', 'Personal Training', 'Sale', 'Referral'] as const).map(dept => (
                                          <button 
                                            key={dept} 
                                            onClick={() => setIncentiveDept(dept)} 
                                            className={`w-full px-5 py-3 rounded-2xl text-left text-[9px] font-black uppercase tracking-widest transition-all border ${
                                              incentiveDept === dept 
                                              ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                                              : 'bg-white border-transparent text-slate-400 hover:bg-slate-50'
                                            }`}
                                          >
                                              {dept}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          )}

                          {/* 4. REVENUE RECOGNITION MODE (Only for Monthly Revenue) */}
                          {reportType === 'monthly_revenue' && (
                              <div className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                                  <div className="flex items-center gap-2 mb-1">
                                      <CreditCard className="w-3.5 h-3.5 text-indigo-600"/>
                                      <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Revenue Recognition</label>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2">
                                      {(['cash', 'accrual'] as const).map(mode => (
                                          <button 
                                            key={mode} 
                                            onClick={() => setRevenueMode(mode)} 
                                            className={`w-full px-5 py-3 rounded-2xl text-left text-[9px] font-black uppercase tracking-widest transition-all border ${
                                              revenueMode === mode 
                                              ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                                              : 'bg-white border-transparent text-slate-400 hover:bg-slate-50'
                                            }`}
                                          >
                                              {mode === 'cash' ? 'Cash Basis' : 'Amortization'}
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          )}

                          {/* 3. COLUMN VISIBILITY */}
                          {(reportType === 'daily_sales' || reportType === 'incentives' || reportType === 'members_joined' || reportType === 'revenue_recognition') && (
                              <div className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                                  <div className="flex items-center gap-2 mb-1">
                                      <Settings2 className="w-3.5 h-3.5 text-indigo-600"/>
                                      <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Column Visibility</label>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                      {Object.entries(
                                          reportType === 'revenue_recognition' ? {
                                              sl_no: 'Sl.No.',
                                              guest_name: 'Guest / Profile',
                                              membership_no: 'Mem. No',
                                              start_date: 'Start Date',
                                              end_date: 'End Date',
                                              days: 'Days',
                                              rev_actual: 'Actual Rate',
                                              rev_discount: 'Discount',
                                              net_fees: 'Net Fees',
                                              prev_accrual: 'Prev. Accrual',
                                              period_rev: 'Period Rev',
                                              deferred: 'Deferred'
                                          } : {
                                              sl_no: 'Sl.No.',
                                              date: 'Date',
                                              guest_name: 'Guest / Member',
                                              reference: reportType === 'daily_sales' ? 'Reference' : reportType === 'members_joined' ? 'Category' : 'Duration',
                                              check_no: 'Check No.',
                                              payment_mode: 'Payment Mode',
                                              item_name: 'Item / Service',
                                              specialist: 'Specialist',
                                              gross_amount: 'Gross Amount',
                                              disc_percent: 'Disc %',
                                              discount_amt: 'Discount Amt',
                                              net_revenue: 'Net Revenue',
                                              remarks: 'Remarks'
                                          }
                                      ).map(([key, label]) => {
                                          // Hide irrelevant columns based on report type
                                          if (key === 'payment_mode' && reportType !== 'daily_sales') return null;
                                          if (key === 'specialist' && reportType !== 'incentives') return null;
                                          
                                          return (
                                              <label key={key} className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors border border-transparent hover:border-slate-100">
                                                  <input 
                                                      type="checkbox" 
                                                      checked={visibleColumns[key]} 
                                                      onChange={(e) => setVisibleColumns(prev => ({...prev, [key]: e.target.checked}))}
                                                      className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                                  />
                                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest truncate">{label}</span>
                                              </label>
                                          );
                                      })}
                                  </div>
                              </div>
                          )}

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

          <div className={`${showConfig ? 'lg:col-span-9' : 'lg:col-span-12'} transition-all duration-700 relative`}>
              <Card className="rounded-none border-slate-200 shadow-2xl overflow-hidden bg-white print:shadow-none print:rounded-none relative">
                  {loading && (
                      <div className="absolute inset-0 z-[10] flex items-center justify-center bg-white/60 backdrop-blur-[2px] no-print">
                          <TabLoader message="Synchronizing Financial Ledger..." />
                      </div>
                  )}
                  <div ref={reportRef} className={`print-container p-8 md:p-10 print:p-2 flex flex-col bg-white transition-opacity duration-300 w-full overflow-visible ${loading ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
                      <div className="flex flex-row justify-between items-start gap-4 mb-8 print:mb-4 pb-4 border-b-2 border-slate-900/10 w-full">
                          <div className="flex items-center gap-4 min-w-0 max-w-[60%] print:max-w-[55%]">
                              {activeProperty?.logo_url && (
                                  <img 
                                      src={activeProperty.logo_url} 
                                      crossOrigin="anonymous" 
                                      alt="Property Logo"
                                      className="h-12 w-auto max-w-[150px] md:max-w-[180px] print:h-10 print:max-w-[120px] object-contain shrink-0" 
                                  />
                              )}
                              <div className="h-10 w-px bg-slate-300 shrink-0"></div>
                              <div className="min-w-0 overflow-hidden">
                                  <h2 className="text-lg md:text-xl print:text-sm font-black text-slate-900 tracking-tight uppercase leading-tight truncate mb-0.5">
                                      {activeProperty?.name || settings?.name}
                                  </h2>
                                  <p className="text-[9px] md:text-[10px] print:text-[8px] font-black text-slate-500 uppercase tracking-wider leading-none truncate">
                                      {activeOutlet?.name} &bull; ISO-9001 CERTIFIED
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-1 text-indigo-600 print:text-indigo-800">
                                      <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                      <span className="text-[8px] md:text-[9px] print:text-[7.5px] font-black uppercase tracking-widest">Internal Verification</span>
                                  </div>
                              </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-2 shrink-0 max-w-[40%] print:max-w-[45%]">
                              <h3 className="text-lg md:text-xl print:text-sm font-black text-slate-900 tracking-tight uppercase leading-snug text-right break-words max-w-full">
                                {getReportTitle(reportType, incentiveDept)}
                              </h3>
                              {(reportType === 'revenue_recognition' || reportType === 'members_joined' || reportType === 'active_members' || reportType === 'expiring_memberships') && (
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-50 rounded-md border border-indigo-100">
                                      <Layers className="w-3 h-3 text-indigo-500 shrink-0" />
                                      <span className="text-[9px] print:text-[8px] font-black text-indigo-700 uppercase tracking-wider truncate">
                                          {selectedTypeName}
                                      </span>
                                  </div>
                              )}
                              <div className="bg-slate-950 text-white px-4 py-1.5 rounded-xl print:rounded-lg shadow-sm print:shadow-none inline-block text-right">
                                  <span className="text-[8px] print:text-[7px] font-black uppercase opacity-70 block tracking-widest leading-none mb-0.5">Audit Period</span>
                                  <span className="text-xs md:text-sm print:text-[10px] font-black uppercase leading-none block">
                                    {reportType === 'daily_sales' 
                                      ? format(parseISO(dailySalesDate), 'dd MMMM yyyy') 
                                      : reportType === 'monthly_revenue' 
                                        ? format(parseISO(reportMonth + '-01'), 'yyyy')
                                        : reportType === 'active_members'
                                          ? format(new Date(), 'dd MMMM yyyy')
                                          : format(parseISO(reportMonth + '-01'), 'MMMM yyyy')}
                                  </span>
                              </div>
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-slate-100 rounded-md border border-slate-200/60">
                                  <Shield className="w-3 h-3 text-slate-400 shrink-0"/>
                                  <span className="text-[8px] print:text-[7.5px] font-black text-slate-600 uppercase tracking-wider">Verified Audit Trail</span>
                              </div>
                          </div>
                      </div>
                      
                      <div className="flex-1 report-container-context">
                          {reportType === 'revenue_recognition' ? renderRevenueTable() : 
                           reportType === 'active_members' ? <ActiveMembersReport isEmbedded={true} selectedMembershipTypeId={selectedMembershipTypeId} /> : 
                           reportType === 'expiring_memberships' ? <ExpiringMembershipsReport isEmbedded={true} embeddedMonth={reportMonth} selectedMembershipTypeId={selectedMembershipTypeId} /> : 
                           reportType === 'massage_room_revenue' ? <MassageRoomRevenueReport isEmbedded={true} embeddedMonth={reportMonth} /> :
                           reportType === 'monthly_revenue' ? <MonthlyRevenueReport isEmbedded={true} embeddedMonth={reportMonth} revenueMode={revenueMode} data={summary} /> :
                           reportType === 'custom_report' ? (
                             <CustomReportViewer 
                               config={customReports.find(r => r.id === selectedCustomReportId) || customReports[0]}
                               onBack={() => setReportType('revenue_recognition')}
                             />
                           ) :
                           renderStandardTable()}
                      </div>

                      {signatoryConfig && (
                        <div className="mt-8 grid grid-cols-12 gap-10">
                            <div className="col-span-5">
                                {(reportType === 'daily_sales' || reportType === 'incentives' || reportType === 'members_joined') && (
                                    <table className="w-full border-collapse border-2 border-black font-black text-[10px]">
                                        <tbody>
                                            {reportType === 'incentives' && (
                                                <>
                                                    <tr className="bg-amber-50">
                                                        <td className="border border-black px-5 py-3 uppercase text-slate-600">Total Incentive Yield</td>
                                                        <td className="border border-black px-5 py-3 text-right text-indigo-600 text-sm font-black">{formatMoney(rows.reduce((sum, row) => sum + row.inc_net, 0))}</td>
                                                    </tr>
                                                    {incentiveDept === 'Referral' ? (
                                                        // Group by referrer name for Referral report
                                                        Object.entries(rows.reduce((acc, row) => {
                                                            const name = row.therapist_name || 'Unknown';
                                                            acc[name] = (acc[name] || 0) + row.inc_net;
                                                            return acc;
                                                        }, {} as Record<string, number>)).filter(([_, amount]: [string, number]) => amount > 0).map(([name, amount]) => (
                                                            <tr key={name} className="bg-white">
                                                                <td className="border border-black px-8 py-2 uppercase text-slate-400 text-[9px] italic flex items-center gap-2">
                                                                    <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                                                                    {name}
                                                                </td>
                                                                <td className="border border-black px-5 py-2 text-right text-slate-500 font-bold">
                                                                    {formatMoney(amount)}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        activeStaffList.filter(s => (rows.reduce((sum, r) => sum + (r.staff_splits[s.id] || 0), 0)) > 0).map(s => (
                                                            <tr key={s.id} className="bg-white">
                                                                <td className="border border-black px-8 py-2 uppercase text-slate-400 text-[9px] italic flex items-center gap-2">
                                                                    <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                                                                    {s.name} ({s.role})
                                                                </td>
                                                                <td className="border border-black px-5 py-2 text-right text-slate-500 font-bold">
                                                                    {formatMoney(rows.reduce((sum, r) => sum + (r.staff_splits[s.id] || 0), 0))}
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </>
                                            )}
                                            <tr className="bg-white">
                                                <td className="border border-black px-5 py-3 uppercase text-slate-600">Portfolio Gross Revenue</td>
                                                <td className="border border-black px-5 py-3 text-right text-sm">{formatMoney(rows.reduce((sum, row) => sum + row.actual_price, 0))}</td>
                                            </tr>
                                            <tr className="bg-white">
                                                <td className="border border-black px-5 py-3 uppercase text-slate-600">Total Reduction / Discount</td>
                                                <td className="border border-black px-5 py-3 text-right text-red-500 text-sm">{formatMoney(rows.reduce((sum, row) => sum + row.discount_amount, 0))}</td>
                                            </tr>
                                            <tr className="bg-sky-100 border-t-4 border-black">
                                                <td className="border border-black px-5 py-4 uppercase text-slate-900 text-xs">Certified Net Revenue</td>
                                                <td className="border border-black px-5 py-4 text-right text-indigo-700 text-sm">{formatMoney(rows.reduce((sum, row) => sum + row.net_revenue, 0))}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            <div className={`col-span-7 grid ${signatoryConfig.reviewed?.trim() ? 'grid-cols-3' : 'grid-cols-2'} gap-10 items-end pb-4`}>
                                <div className="space-y-8">
                                    <div className="h-px bg-black w-full"></div>
                                    <div className="text-center uppercase">
                                        <p className="font-black text-xs text-slate-900">Prepared By:</p>
                                        <p className="text-[10px] font-bold text-slate-400 mt-1">{signatoryConfig.prepared}</p>
                                    </div>
                                </div>
                                {signatoryConfig.reviewed?.trim() && (
                                  <div className="space-y-8">
                                      <div className="h-px bg-black w-full"></div>
                                      <div className="text-center uppercase">
                                          <p className="font-black text-xs text-slate-900">Reviewed By:</p>
                                          <p className="text-[10px] font-bold text-slate-400 mt-1">{signatoryConfig.reviewed}</p>
                                      </div>
                                  </div>
                                )}
                                <div className="space-y-8">
                                    <div className="h-px bg-black w-full"></div>
                                    <div className="text-center uppercase">
                                        <p className="font-black text-xs text-slate-900">Approved By:</p>
                                        <p className="text-[10px] font-bold text-slate-400 mt-1">{signatoryConfig.approved}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                      )}

                      <div className="mt-8 flex justify-between items-center border-t border-slate-100 pt-4 dashboard-print-footer">
                          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                              OFFICIAL FACILITY REPORT
                          </span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Exported on: {format(new Date(), 'dd-MMM-yyyy HH:mm:ss')} by {autoDispatchConfig ? 'SYSTEM AUTOMATED' : (user?.name || 'SYSTEM AUTOMATED')}
                          </span>
                          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                              &copy; {new Date().getFullYear()} {activeProperty?.name}. All rights reserved.
                          </span>
                      </div>
                  </div>
              </Card>
          </div>
      </div>

      <style>{`
        @media print {
            .dashboard-print-footer {
                display: flex !important;
                margin-top: 1.5rem !important;
                padding-top: 1rem !important;
                border-top: 1px solid #e2e8f0 !important;
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }
            html, body, #root, main, .print-container, .print-container * {
                overflow: visible !important;
                height: auto !important;
                max-height: none !important;
            }
            body { 
                background: white !important; 
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
            }
            .no-print { display: none !important; }
            
            .print-container {
                width: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
                background: white !important;
                box-shadow: none !important;
            }

            table {
                width: 100% !important;
                page-break-inside: auto !important;
            }

            tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }

            thead {
                display: table-header-group !important;
            }

            tfoot {
                display: table-footer-group !important;
            }
            
            @page { 
                size: A4 landscape; 
                margin: 8mm; 
            }
        }
      `}</style>
    </div>
  );
};

export default Reports;
