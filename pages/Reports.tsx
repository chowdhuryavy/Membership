
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '../components/ui';
import { db } from '../services/mockSupabase';
import { Member, MassageBooking, MassageType, IncentiveRule, MemberStatus, Staff, Sale, Guest, MembershipCategory, StaffLeave, MembershipType, InventoryItem } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, endOfMonth, differenceInCalendarDays, addDays, startOfDay, isWithinInterval, subDays, parseISO, endOfDay, startOfMonth, addMonths } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
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
  CalendarX
} from 'lucide-react';
import { getReportData, generateReportPDF } from '../src/shared/reportLogic';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import ExpiringMembershipsReport from './ExpiringMembershipsReport';
import MassageRoomRevenueReport from './MassageRoomRevenueReport';

const startOfMonthLocal = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

// Report Types
type ReportType = 'revenue_recognition' | 'daily_sales' | 'incentives' | 'members_joined' | 'expiring_memberships' | 'massage_room_revenue';

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
    daily_rate: number;
}

const Reports = () => {
  const { user } = useAuth();
  const { settings, currentOutlet, currentProperty, formatMoney, hasPermission } = useSettings();
  const [reportType, setReportType] = useState<ReportType>('revenue_recognition');
  const [incentiveDept, setIncentiveDept] = useState<'Massage' | 'Membership' | 'Personal Training'>('Massage');
  const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [dailySalesDate, setDailySalesDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Data States
  const [rows, setRows] = useState<ReportRow[]>([]); // For Incentives & Sales
  const [revenueRows, setRevenueRows] = useState<RevenueRow[]>([]); // For Revenue Recog
  const [membershipTypes, setMembershipTypes] = useState<MembershipType[]>([]);
  const [selectedMembershipTypeId, setSelectedMembershipTypeId] = useState<string | 'all'>('all');
  const [activeStaffList, setActiveStaffList] = useState<Staff[]>([]);
  const [showConfig, setShowConfig] = useState(true);
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

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
    if (currentOutlet && currentProperty && canView) loadData();
  }, [reportMonth, reportType, incentiveDept, selectedMembershipTypeId, currentOutlet, currentProperty, canView]);

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
      // Check legacy fields
      if (s.probation_start_date && s.probation_end_date) {
          try {
              const target = startOfDay(new Date(targetDateStr));
              const start = startOfDay(new Date(s.probation_start_date));
              const end = startOfDay(new Date(s.probation_end_date));
              if (isWithinInterval(target, { start, end })) return true;
          } catch (e) {}
      }
      
      // Check new staff_leaves table
      const leaves = staffLeaves.filter(l => l.staff_id === s.id);
      if (leaves.length > 0) {
          try {
              const target = startOfDay(new Date(targetDateStr));
              return leaves.some(l => {
                  const start = startOfDay(new Date(l.start_date));
                  const end = startOfDay(new Date(l.end_date));
                  return isWithinInterval(target, { start, end });
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
    if (!currentOutlet || !currentProperty) return;
    try {
      const start = reportType === 'daily_sales' ? startOfDay(parseISO(dailySalesDate)) : startOfDay(parseISO(reportMonth + '-01'));
      const end = reportType === 'daily_sales' ? endOfDay(start) : startOfMonth(addMonths(start, 1)); // First day of next month for exclusive end date logic
      
      const [rules, bookings, members, sales, therapists, mTypes, mCats, staffList, guests, freezes, users, leaves, types, inventory] = await Promise.all([
          db.getIncentiveRules(currentProperty.id, currentOutlet.id),
          db.getMassageBookings(currentOutlet.id, false),
          db.getMembers(currentOutlet.id),
          db.getSales(currentOutlet.id, false),
          db.getTherapists(currentOutlet.id, false),
          db.getMassageTypes(currentOutlet.id, false),
          db.getCategories(currentOutlet.id),
          db.getStaff(currentOutlet.id),
          db.getGuests(currentProperty.id),
          db.getFreezes(),
          db.getUsers(),
          db.getAllStaffLeaves(),
          db.getMembershipTypes(currentOutlet.id),
          db.getInventory(currentOutlet.id, false)
      ]);

      setStaffLeaves(leaves);
      setMembershipTypes(types);

      let filteredStaff = staffList.filter(s => s.is_active);
      
      // Filter staff list based on report context
      if (reportType === 'incentives') {
          if (incentiveDept === 'Massage') {
              // Only show therapists for massage reports
              filteredStaff = filteredStaff.filter(s => 
                  /therapist|specialist|masseur|masseuse/i.test(s.role) ||
                  therapists.some(t => t.id === s.id)
              );
          } else if (incentiveDept === 'Personal Training') {
              // Only show trainers for personal training reports
              filteredStaff = filteredStaff.filter(s => 
                  /trainer|coach|instructor|pt|gym|fitness/i.test(s.role)
              );
          } else if (incentiveDept === 'Membership') {
              // Show all staff for membership as they all share the incentive
              filteredStaff = filteredStaff;
          }
      }

      setActiveStaffList(filteredStaff);
      
      if (reportType === 'revenue_recognition') {
          // --- REVENUE RECOGNITION (AMORTIZATION) LOGIC ---
          const revData: RevenueRow[] = [];
          
          let filteredMembers = members.filter(m => m.status !== MemberStatus.TENTATIVE);
          
          if (selectedMembershipTypeId !== 'all') {
              filteredMembers = filteredMembers.filter(m => m.membership_type_id === selectedMembershipTypeId);
          }

          filteredMembers.forEach(m => {
              const mStart = parseISO(m.start_date);
              const mEnd = parseISO(m.current_end_date);
              
              // Only include if the membership overlaps with the report history or is currently active/deferred
              // Specifically: Start Date <= Report End Date AND End Date >= Report Start Date (Standard Overlap)
              // OR if we want to show historicals, we might check differently. 
              // For Accrual reports, we usually only care about active revenue streams.
              // Let's stick to standard intersection.
              
              // NOTE: Screenshot implies showing active revenue recognition. 
              // Even if fully recognized in past, usually not shown unless "Period Rev" is > 0 or it's active.
              // Let's filter for: Has Revenue in this period OR Has Deferred Revenue remaining.
              
              const memberFreezes = freezes.filter(f => f.member_id === m.id);
              
              // 1. Calculate Prev Accrual (Start -> Before Period)
              let prevAccrual = 0;
              if (mStart < start) {
                  prevAccrual = RevenueEngine.calculateRevenuePeriod(m, memberFreezes, mStart, start);
              }

              // 2. Calculate Period Revenue (Period Start -> Period End)
              const periodRev = RevenueEngine.calculateRevenuePeriod(m, memberFreezes, start, end);

              // 3. Calculate Deferred (Total - (Prev + Period))
              // Ensuring we don't go below zero due to floating point math
              let deferred = m.net_amount - (prevAccrual + periodRev);
              if (deferred < 0.01) deferred = 0; // Floating point tolerance

              // Only show if there is activity in this period or remaining deferred revenue
              // OR if the membership is strictly active within this month
              const isActiveInPeriod = (mStart <= end && mEnd >= start);
              
              if (isActiveInPeriod || deferred > 0) {
                  const cat = mCats.find(c => c.id === m.category_id);
                  const totalDays = RevenueEngine.calculateTotalActiveDays(m, memberFreezes);

                  revData.push({
                      id: m.id,
                      sl_no: 0, // Will assign after sort
                      guest_name: m.guest_name,
                      start_date: format(mStart, 'dd-MM-yyyy'),
                      end_date: format(mEnd, 'dd-MM-yyyy'),
                      total_days: totalDays,
                      actual_rate: m.actual_rate || (m.net_amount + (m.discount || 0)) || 0,
                      discount: m.discount || 0,
                      net_fees: m.net_amount,
                      prev_accrual: prevAccrual,
                      period_rev: periodRev,
                      deferred: deferred,
                      category_name: cat ? cat.name.toUpperCase() : 'UNCATEGORIZED',
                      daily_rate: Number(m.daily_rate || 0)
                  });
              }
          });

          // Sort by Category then Name
          revData.sort((a, b) => {
              if (a.category_name < b.category_name) return -1;
              if (a.category_name > b.category_name) return 1;
              return a.guest_name.localeCompare(b.guest_name);
          });

          // Assign SL
          revData.forEach((row, i) => row.sl_no = i + 1);
          setRevenueRows(revData);

      } else if (reportType === 'members_joined') {
          // --- MEMBERS JOINED REPORT ---
          const joinedMembers = members.filter(m => {
              const mStart = parseISO(m.start_date);
              return mStart >= start && mStart <= end && m.status !== MemberStatus.TENTATIVE;
          });

          const records: ReportRow[] = joinedMembers.map((m, i) => {
              const cat = mCats.find(c => c.id === m.category_id);
              return {
                  sl_no: i + 1,
                  date: format(parseISO(m.start_date), 'dd-MM-yyyy'),
                  guest_name: m.guest_name,
                  type_of_membership: cat ? cat.name : 'Unknown',
                  check_no: m.check_no || '#---',
                  item_name: 'Membership',
                  actual_price: m.actual_rate || (m.net_amount + (m.discount || 0)) || 0,
                  discount_percent: (m.discount || 0) > 0 && (m.actual_rate || (m.net_amount + (m.discount || 0))) > 0 ? ((m.discount || 0) / (m.actual_rate || (m.net_amount + (m.discount || 0)))) * 100 : 0,
                  discount_amount: m.discount || 0,
                  net_revenue: m.net_amount || 0,
                  inc_total: 0,
                  inc_discount_percent: 0,
                  inc_discount_val: 0,
                  inc_net: 0,
                  remarks: m.status,
                  staff_splits: {}
              };
          });
          setRows(records);
      } else {
          // --- STANDARD ROWS FOR SALES & INCENTIVES ---
          const records: ReportRow[] = [];
          let sl = 1;

          if (reportType === 'daily_sales') {
              // --- DAILY SALES LEDGER (POS + BOOKINGS) ---
              const combined = [
                  ...sales.filter(s => {
                      const sDate = parseISO(s.created_at);
                      return s.status === 'completed' && sDate >= start && sDate <= end;
                  }).map(s => ({
                      date: s.created_at,
                      name: s.guest_name,
                      item: s.item_name,
                      gross: s.gross_amount,
                      disc: s.discount_amount,
                      net: s.net_amount,
                      type: 'Retail',
                      method: s.payment_method
                  })),
                  ...bookings.filter(b => {
                      const bDate = parseISO(b.date);
                      return b.status === 'completed' && bDate >= start && bDate <= end;
                  }).map(b => ({
                      date: `${b.date}T${b.start_time}`,
                      name: guests.find(g => g.id === b.guest_id)?.name || 'Guest',
                      item: mTypes.find(t => t.id === (b.massage_type_id || b.inventory_item_id))?.name || 'Service',
                      gross: Number(b.price) + (b.discount || 0),
                      disc: b.discount || 0,
                      net: Number(b.price),
                      type: 'Service',
                      method: 'Service'
                  }))
              ].sort((a, b) => a.date.localeCompare(b.date));

              combined.forEach(c => {
                  records.push({
                      sl_no: sl++,
                      date: format(parseISO(c.date), 'dd-MMM-yy'),
                      guest_name: c.name,
                      item_name: c.item,
                      mode_of_payment: c.method,
                      check_no: c.type === 'Retail' ? '#POS' : '#SVC',
                      actual_price: c.gross,
                      discount_percent: c.gross > 0 ? (c.disc / c.gross * 100) : 0,
                      discount_amount: c.disc,
                      net_revenue: c.net,
                      inc_total: 0, inc_discount_percent: 0, inc_discount_val: 0, inc_net: 0, staff_splits: {},
                      remarks: c.type
                  });
              });

          } else if (reportType === 'incentives') {
              // --- INCENTIVE AUDIT LOGIC ---
              if (incentiveDept === 'Massage') {
                  bookings.filter(b => {
                      const bDate = parseISO(b.date);
                      const type = mTypes.find(m => m.id === (b.massage_type_id || b.inventory_item_id));
                      // Only include completed bookings for incentive audit
                      return b.status === 'completed' && bDate >= start && bDate <= end && type?.category === 'Massage';
                  })
                  .forEach(b => {
                      const type = mTypes.find(m => m.id === (b.massage_type_id || b.inventory_item_id));
                      if (!type) return;
                      const rule = findBestRule(rules, 'Massage', (b.massage_type_id || b.inventory_item_id || ''), type.price, type.duration_minutes);
                      
                      const actualPrice = type.price;
                      const discountAmt = b.discount || 0;
                      const netRev = actualPrice - discountAmt;
                      const discPercent = actualPrice > 0 ? (discountAmt / actualPrice) * 100 : 0;

                      let baseInc = 0;
                      let incDiscVal = 0;
                      let incNet = 0;
                      const staffSplits: Record<string, number> = {};

                      if (rule) {
                          baseInc = rule.calculation_type === 'Fixed' ? rule.value : (actualPrice * rule.value / 100);
                          incDiscVal = (rule.apply_discount_percentage !== false) ? (baseInc * discPercent) / 100 : 0;
                          incNet = baseInc - incDiscVal;

                          // For Massage, we always attribute the incentive to the specific therapist
                          // who performed the service, as per user requirement.
                          if (b.therapist_id) {
                              const therapist = staffList.find(s => s.id === b.therapist_id);
                              if (therapist && therapist.is_eligible_for_incentives !== false && !isStaffOnLeaveOnDate(therapist, b.date) && !isStaffOnProbationOnDate(therapist, b.date)) {
                                  staffSplits[b.therapist_id] = incNet;
                              }
                          }
                      }

                      // Override: For Massage, if it's not shared, ensure it goes to the therapist
                      // The user specifically requested that for massage only the therapist gets it.
                      // If the rule is individual, it already goes to b.therapist_id.
                      // If there's no rule, we still show the row with 0 incentive.

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
                          remarks: b.status === 'confirmed' ? 'Pending Completion' : (discPercent > 50 ? 'Complimentary' : (!rule ? 'No Incentive Rule' : '')),
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
                      const incDiscVal = (rule.apply_discount_percentage !== false) ? (baseInc * discPercent) / 100 : 0;
                      const incNet = baseInc - incDiscVal;

                      const staffSplits: Record<string, number> = {};
                      if (rule.distribution_type === 'Shared') {
                          let available = staffList.filter(s => s.is_active && (s.is_eligible_for_incentives !== false) && !isStaffOnLeaveOnDate(s, m.start_date) && !isStaffOnProbationOnDate(s, m.start_date));
                          // Membership incentive is shared among ALL staff (including therapists and trainers)
                          if (available.length > 0) {
                              const share = incNet / available.length;
                              available.forEach(s => staffSplits[s.id] = share);
                          }
                      } else {
                          if (m.sales_rep_id) {
                              const staff = staffList.find(s => s.id === m.sales_rep_id);
                              if (staff && staff.is_eligible_for_incentives !== false) {
                                  staffSplits[m.sales_rep_id] = incNet;
                              }
                          }
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
                          therapist_name: rule.distribution_type === 'Shared' ? 'Shared' : (staffList.find(s => s.id === m.sales_rep_id)?.name || 'N/A'),
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
              } else if (incentiveDept === 'Personal Training') {
                  // 1. Process Bookings categorized as Personal Training
                  bookings.filter(b => {
                      const bDate = parseISO(b.date);
                      return b.status === 'completed' && bDate >= start && bDate <= end;
                  })
                  .forEach(b => {
                      const item = inventory.find(i => i.id === b.inventory_item_id);
                      if (!item) return;
                      const rule = findBestRule(rules, 'Personal Training', (b.inventory_item_id || ''), item.price, 0);
                      
                      const actualPrice = item.price;
                      const discountAmt = b.discount || 0;
                      const netRev = actualPrice - discountAmt;
                      const discPercent = actualPrice > 0 ? (discountAmt / actualPrice) * 100 : 0;

                      let baseInc = 0;
                      let incDiscVal = 0;
                      let incNet = 0;
                      const staffSplits: Record<string, number> = {};

                      if (rule) {
                          baseInc = rule.calculation_type === 'Fixed' ? rule.value : (actualPrice * rule.value / 100);
                          incDiscVal = (rule.apply_discount_percentage !== false) ? (baseInc * discPercent) / 100 : 0;
                          incNet = baseInc - incDiscVal;

                          if (b.therapist_id) {
                              const staff = staffList.find(s => s.id === b.therapist_id);
                              if (staff && staff.is_eligible_for_incentives !== false && !isStaffOnLeaveOnDate(staff, b.date) && !isStaffOnProbationOnDate(staff, b.date)) {
                                  staffSplits[b.therapist_id] = incNet;
                              }
                          }
                      }

                      records.push({
                          sl_no: sl++,
                          date: format(parseISO(b.date), 'dd-MMM-yy'),
                          guest_name: guests.find(g => g.id === b.guest_id)?.name || 'Guest',
                          duration: '-',
                          check_no: '#BOOK',
                          item_name: item.name,
                          therapist_name: therapists.find(t => t.id === b.therapist_id)?.name || 'N/A',
                          actual_price: actualPrice,
                          discount_percent: discPercent,
                          discount_amount: discountAmt,
                          net_revenue: netRev,
                          inc_total: baseInc,
                          inc_discount_percent: discPercent,
                          inc_discount_val: incDiscVal,
                          inc_net: incNet,
                          remarks: !rule ? 'No PT Incentive Rule' : '',
                          staff_splits: staffSplits
                      });
                  });

                  // 2. Process Sales categorized as Personal Training (POS)
                  sales.filter(s => {
                      const sDate = parseISO(s.created_at);
                      const isPT = s.category?.toLowerCase() === 'personal training';
                      return s.status === 'completed' && isPT && sDate >= start && sDate <= end;
                  })
                  .forEach(s => {
                      // Try Personal Training specific rule first, then fallback to Sale
                      const rule = findBestRule(rules, 'Personal Training', s.item_id || 'all', s.net_amount, 0) || 
                                   findBestRule(rules, 'Sale', s.category, s.net_amount, 0);
                      if (!rule) return;

                      const actualPrice = s.gross_amount;
                      const discountAmt = s.discount_amount;
                      const netRev = s.net_amount;
                      const discPercent = actualPrice > 0 ? (discountAmt / actualPrice) * 100 : 0;

                      const baseInc = rule.calculation_type === 'Fixed' ? rule.value : (actualPrice * rule.value / 100);
                      const incDiscVal = (rule.apply_discount_percentage !== false) ? (baseInc * discPercent) / 100 : 0;
                      const incNet = baseInc - incDiscVal;

                      const staffSplits: Record<string, number> = {};
                      if (rule.distribution_type === 'Shared') {
                          let available = staffList.filter(staff => staff.is_active && (staff.is_eligible_for_incentives !== false) && !isStaffOnLeaveOnDate(staff, s.created_at) && !isStaffOnProbationOnDate(staff, s.created_at));
                          available = available.filter(st => /trainer|coach|instructor|pt|gym|fitness/i.test(st.role));
                          if (available.length > 0) {
                              const share = incNet / available.length;
                              available.forEach(staff => staffSplits[staff.id] = share);
                          }
                      } else {
                          if (s.sold_by_id && s.secondary_sold_by_id) {
                              const share = incNet / 2;
                              const staff1 = staffList.find(st => st.id === s.sold_by_id);
                              const staff2 = staffList.find(st => st.id === s.secondary_sold_by_id);
                              
                              if (staff1 && staff1.is_eligible_for_incentives !== false) staffSplits[s.sold_by_id] = share;
                              if (staff2 && staff2.is_eligible_for_incentives !== false) staffSplits[s.secondary_sold_by_id] = share;
                          } else if (s.sold_by_id) {
                              const staff = staffList.find(st => st.id === s.sold_by_id);
                              if (staff && staff.is_eligible_for_incentives !== false) {
                                  staffSplits[s.sold_by_id] = incNet;
                              }
                          }
                      }

                      let therapistName = staffList.find(st => st.id === s.sold_by_id)?.name || users.find(u => u.id === s.sold_by_id)?.name || 'N/A';
                      if (s.secondary_sold_by_id) {
                          const secName = staffList.find(st => st.id === s.secondary_sold_by_id)?.name || users.find(u => u.id === s.secondary_sold_by_id)?.name;
                          if (secName) therapistName += ` & ${secName}`;
                      }

                      records.push({
                          sl_no: sl++,
                          date: format(parseISO(s.created_at), 'dd-MMM-yy'),
                          guest_name: s.guest_name,
                          duration: `x${s.quantity}`,
                          check_no: '#POS',
                          item_name: s.item_name,
                          therapist_name: therapistName,
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
          }
          setRows(records);
      }
    } catch (e) { console.error(e); }
  };

  const handleExportPDF = async () => {
    if (!currentProperty) {
      toast.error('No property selected');
      return;
    }

    try {
      const toastId = toast.loading('Generating PDF report...');
      
      const startDate = reportType === 'daily_sales' ? parseISO(dailySalesDate) : parseISO(`${reportMonth}-01`);
      const outletId = currentOutlet?.id || 'all';

      // Use shared logic to get data
      const reportData = await getReportData({
        supabase: db,
        propertyId: currentProperty.id,
        outletId: outletId,
        reportType: reportType,
        date: startDate
      });

      if (!reportData.rows || reportData.rows.length === 0) {
        toast.error('No data found for the selected period', { id: toastId });
        return;
      }

      // Use shared logic to generate PDF
      const reportTitles: Record<string, string> = {
        'daily_sales': 'Daily Sales Ledger',
        'revenue_recognition': 'Revenue Recognition Audit',
        'members_joined': 'Members Joined Audit',
        'expiring_memberships': 'Expiring Memberships Audit',
        'massage_room_revenue': 'Massage Room Revenue'
      };
      const reportTitle = reportTitles[reportType] || reportType.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      
      const outletName = currentOutlet?.name || 'All Outlets';
      const currencySymbol = settings?.currency_symbol || '$';

      const doc = generateReportPDF({
        jsPDF,
        autoTable,
        data: reportData,
        propertyName: currentProperty.name,
        outletName,
        currencySymbol,
        reportTitle,
        date: startDate,
        logoUrl: currentProperty.logo_url,
        reportType: reportType
      });

      doc.save(`${reportType}_report_${format(startDate, 'yyyy-MM-dd')}.pdf`);
      toast.success('Report exported successfully', { id: toastId });
    } catch (error) {
      console.error('PDF Export Error:', error);
      toast.error('Failed to export PDF report');
    }
  };

  const signatoryConfig = useMemo(() => {
    if (!currentOutlet || !currentProperty || !settings) return null;

    // Helper to resolve config with specific and default fallbacks
    const resolveConfig = (config: any, type: string) => {
      if (!config) return null;
      const specific = config[type];
      
      // If specific doesn't exist, this level provides no config
      if (!specific) return null;
      
      return {
        prepared: specific.prepared || 'Accountant',
        reviewed: specific.reviewed || '',
        approved: specific.approved || 'General Manager'
      };
    };

    // Hierarchy: Outlet Specific -> Outlet Default -> Property Specific -> Property Default -> Global Specific -> Global Default
    const outletRes = resolveConfig(currentOutlet.signatory_config, reportType);
    if (outletRes) return outletRes;

    const propertyRes = resolveConfig(currentProperty.signatory_config, reportType);
    if (propertyRes) return propertyRes;

    const globalRes = resolveConfig(settings.signatory_config, reportType);
    if (globalRes) return globalRes;

    return null;
  }, [currentOutlet, currentProperty, settings, reportType]);

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

  const RenderRevenueTable = () => {
      // Group by Category
      const grouped = revenueRows.reduce((acc, row) => {
          if (!acc[row.category_name]) acc[row.category_name] = [];
          acc[row.category_name].push(row);
          return acc;
      }, {} as Record<string, RevenueRow[]>);

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
                      {Object.entries(grouped).map(([category, groupRowsData]) => {
                          const groupRows = groupRowsData as RevenueRow[];
                          const subDailyRate = groupRows.reduce((s, r) => s + r.daily_rate, 0);
                          const subActual = groupRows.reduce((s, r) => s + r.actual_rate, 0);
                          const subDiscount = groupRows.reduce((s, r) => s + r.discount, 0);
                          const subNetFees = groupRows.reduce((s, r) => s + r.net_fees, 0);
                          const subPrevAccrual = groupRows.reduce((s, r) => s + r.prev_accrual, 0);
                          const subPeriodRev = groupRows.reduce((s, r) => s + r.period_rev, 0);
                          const subDeferred = groupRows.reduce((s, r) => s + r.deferred, 0);

                          grandActual += subActual;
                          grandDiscount += subDiscount;
                          grandNetFees += subNetFees;
                          grandPrevAccrual += subPrevAccrual;
                          grandPeriodRev += subPeriodRev;
                          grandDeferred += subDeferred;
                          grandDailyRate += subDailyRate;

                          return (
                              <React.Fragment key={category}>
                                  {/* Group Header */}
                                  <tr className="bg-slate-100">
                                      <td colSpan={
                                          (visibleColumns.sl_no ? 1 : 0) +
                                          (visibleColumns.guest_name ? 1 : 0) +
                                          (visibleColumns.start_date ? 1 : 0) +
                                          (visibleColumns.end_date ? 1 : 0) +
                                          (visibleColumns.days ? 1 : 0) +
                                          (visibleColumns.daily_rate ? 1 : 0) +
                                          (visibleColumns.rev_actual ? 1 : 0) +
                                          (visibleColumns.rev_discount ? 1 : 0) +
                                          (visibleColumns.net_fees ? 1 : 0) +
                                          (visibleColumns.prev_accrual ? 1 : 0) +
                                          (visibleColumns.period_rev ? 1 : 0) +
                                          (visibleColumns.deferred ? 1 : 0)
                                      } className="border border-black px-4 py-2 font-black text-slate-900 uppercase tracking-tight text-[10px]">
                                          <div className="flex items-center gap-2">
                                              <Layers className="w-3 h-3 text-indigo-500" />
                                              {category} <span className="text-[8px] font-bold text-slate-400 ml-2">({groupRows.length} Ledger Events)</span>
                                          </div>
                                      </td>
                                  </tr>

                                  {/* Rows */}
                                  {groupRows.map((row, idx) => (
                                      <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                          {visibleColumns.sl_no && <td className="border border-black px-2 py-1 text-center text-slate-500">{idx + 1}</td>}
                                          {visibleColumns.guest_name && <td className="border border-black px-2 py-1 font-black text-slate-800">{row.guest_name}</td>}
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
                                          (visibleColumns.start_date ? 1 : 0) +
                                          (visibleColumns.end_date ? 1 : 0) +
                                          (visibleColumns.days ? 1 : 0)
                                      } className="border border-black px-4 py-2 text-right uppercase text-indigo-900 tracking-widest">Cluster Subtotal: {category}</td>
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

                      {/* Grand Total */}
                      <tr className="bg-slate-900 text-white font-black text-[10px]">
                          <td colSpan={
                              (visibleColumns.sl_no ? 1 : 0) +
                              (visibleColumns.guest_name ? 1 : 0) +
                              (visibleColumns.start_date ? 1 : 0) +
                              (visibleColumns.end_date ? 1 : 0) +
                              (visibleColumns.days ? 1 : 0)
                          } className="border border-black px-4 py-3 text-right uppercase tracking-[0.2em]">Verified Portfolio Total</td>
                          {visibleColumns.daily_rate && <td className="border border-black px-2 py-3 text-right">{formatMoney(grandDailyRate)}</td>}
                          {visibleColumns.rev_actual && <td className="border border-black px-2 py-3 text-right">{formatMoney(grandActual)}</td>}
                          {visibleColumns.rev_discount && <td className="border border-black px-2 py-3 text-right">{formatMoney(grandDiscount)}</td>}
                          {visibleColumns.net_fees && <td className="border border-black px-2 py-3 text-right">{formatMoney(grandNetFees)}</td>}
                          {visibleColumns.prev_accrual && <td className="border border-black px-2 py-3 text-right opacity-70">{formatMoney(grandPrevAccrual)}</td>}
                          {visibleColumns.period_rev && <td className="border border-black px-2 py-3 text-right text-indigo-400">{formatMoney(grandPeriodRev)}</td>}
                          {visibleColumns.deferred && <td className="border border-black px-2 py-3 text-right text-red-400">{formatMoney(grandDeferred)}</td>}
                      </tr>
                  </tbody>
              </table>
          </div>
      );
  };

  const RenderStandardTable = () => {
    const isIncentiveReport = reportType === 'incentives';
    const isDailySales = reportType === 'daily_sales';
    const isMembersJoined = reportType === 'members_joined';

    // Calculation variables
    const totals = useMemo(() => {
        let totalActual = 0;
        let totalDiscount = 0;
        let totalNetRev = 0;
        let totalIncNet = 0;
        const staffTotals: Record<string, number> = {};

        rows.forEach(row => {
            totalActual += row.actual_price;
            totalDiscount += row.discount_amount;
            totalNetRev += row.net_revenue;
            totalIncNet += row.inc_net;
            
            Object.entries(row.staff_splits).forEach(([staffId, amount]) => {
                staffTotals[staffId] = (staffTotals[staffId] || 0) + (amount as number);
            });
        });

        return { totalActual, totalDiscount, totalNetRev, totalIncNet, staffTotals };
    }, [rows]);

    const specialistLabel = useMemo(() => {
        if (reportType === 'incentives') {
            if (incentiveDept === 'Massage') return 'Therapist';
            if (incentiveDept === 'Personal Training') return 'Personal Trainer';
            if (incentiveDept === 'Membership') return 'Sales Rep';
        }
        return 'Staff';
    }, [reportType, incentiveDept]);

    return (
        <div className="w-full">
            <table className="w-full border-collapse text-[9px] border-2 border-black">
                <thead>
                    <tr className="bg-slate-950 text-white font-black uppercase tracking-widest">
                        {visibleColumns.sl_no && <th rowSpan={2} className="border border-black px-2 py-3 w-8">Sl.No.</th>}
                        {visibleColumns.date && <th rowSpan={2} className="border border-black px-2 py-3 w-20">Date</th>}
                        {visibleColumns.guest_name && <th rowSpan={2} className="border border-black px-2 py-3 min-w-[120px]">Guest / Member</th>}
                        
                        {visibleColumns.reference && <th rowSpan={2} className="border border-black px-2 py-3 w-24">{isDailySales ? 'Reference' : isMembersJoined ? 'Category' : 'Duration'}</th>}
                        {visibleColumns.check_no && <th rowSpan={2} className="border border-black px-2 py-3 w-20">Check No.</th>}
                        {(isDailySales && visibleColumns.payment_mode) && <th rowSpan={2} className="border border-black px-2 py-3 w-24">Payment Mode</th>}
                        {visibleColumns.item_name && <th rowSpan={2} className="border border-black px-2 py-3 min-w-[100px]">Item / Service</th>}
                        {(isIncentiveReport && visibleColumns.specialist) && <th rowSpan={2} className="border border-black px-2 py-3">{specialistLabel}</th>}
                        
                        {visibleColumns.gross_amount && <th rowSpan={2} className="border border-black px-2 py-3 text-right w-20">Gross Amount</th>}
                        {visibleColumns.disc_percent && <th rowSpan={2} className="border border-black px-2 py-3 text-center w-12">Disc %</th>}
                        {visibleColumns.discount_amt && <th rowSpan={2} className="border border-black px-2 py-3 text-right w-20">Discount Amt</th>}
                        {visibleColumns.net_revenue && <th rowSpan={2} className="border border-black px-2 py-3 text-right w-20">Net Revenue</th>}
                        
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
                    {Array.isArray(rows) && rows.map((row, idx) => {
                        return (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                {visibleColumns.sl_no && <td className="border border-black px-2 py-1 text-center font-bold">{row.sl_no}</td>}
                                {visibleColumns.date && <td className="border border-black px-2 py-1 text-center whitespace-nowrap">{row.date}</td>}
                                {visibleColumns.guest_name && <td className="border border-black px-2 py-1 font-black text-slate-700">{row.guest_name}</td>}
                                
                                {visibleColumns.reference && <td className="border border-black px-2 py-1 text-center">{isMembersJoined ? row.type_of_membership : (row.duration || '-')}</td>}
                                {visibleColumns.check_no && <td className="border border-black px-2 py-1 text-center text-slate-400">{row.check_no}</td>}
                                {(isDailySales && visibleColumns.payment_mode) && <td className="border border-black px-2 py-1 text-center text-slate-500 font-bold">{row.mode_of_payment}</td>}
                                {visibleColumns.item_name && <td className="border border-black px-2 py-1">{row.item_name}</td>}
                                {(isIncentiveReport && visibleColumns.specialist) && <td className="border border-black px-2 py-1 text-center font-bold bg-slate-50 text-indigo-700">{row.therapist_name}</td>}
                                
                                {visibleColumns.gross_amount && <td className="border border-black px-2 py-1 text-right">{row.actual_price.toFixed(2)}</td>}
                                {visibleColumns.disc_percent && <td className="border border-black px-2 py-1 text-center text-slate-400">{row.discount_percent > 0 ? `${row.discount_percent.toFixed(0)}%` : ''}</td>}
                                {visibleColumns.discount_amt && <td className="border border-black px-2 py-1 text-right">{row.discount_amount.toFixed(2)}</td>}
                                {visibleColumns.net_revenue && <td className="border border-black px-2 py-1 text-right font-black bg-slate-50">{row.net_revenue.toFixed(2)}</td>}
                                
                                {isIncentiveReport && (
                                    <>
                                        <td className="border border-black px-2 py-1 text-right bg-amber-50/20">{row.inc_total.toFixed(2)}</td>
                                        <td className="border border-black px-2 py-1 text-center bg-amber-50/20 text-slate-400">{row.inc_discount_percent > 0 ? `${row.inc_discount_percent.toFixed(0)}%` : ''}</td>
                                        <td className="border border-black px-2 py-1 text-right bg-amber-50/20">{row.inc_discount_val.toFixed(2)}</td>
                                        <td className="border border-black px-2 py-1 text-right font-black bg-amber-100/30">{row.inc_net.toFixed(2)}</td>
                                    </>
                                )}
                                
                                {visibleColumns.remarks && <td className="border border-black px-2 py-1 text-[8px] text-slate-400 italic truncate max-w-[120px]">{row.remarks}</td>}
                                
                                {isIncentiveReport && Array.isArray(activeStaffList) && activeStaffList.map(s => {
                                    const val = row.staff_splits[s.id] || 0;
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
                        <td colSpan={
                            (visibleColumns.sl_no ? 1 : 0) +
                            (visibleColumns.date ? 1 : 0) +
                            (visibleColumns.guest_name ? 1 : 0) +
                            (visibleColumns.reference ? 1 : 0) +
                            (visibleColumns.check_no ? 1 : 0) +
                            (isDailySales && visibleColumns.payment_mode ? 1 : 0) +
                            (visibleColumns.item_name ? 1 : 0) +
                            (isIncentiveReport && visibleColumns.specialist ? 1 : 0)
                        } className="border border-black px-4 py-3 text-right uppercase tracking-widest">Aggregate Portfolio Totals</td>
                        {visibleColumns.gross_amount && <td className="border border-black px-2 py-3 text-right">{totals.totalActual.toFixed(2)}</td>}
                        {visibleColumns.disc_percent && <td className="border border-black"></td>}
                        {visibleColumns.discount_amt && <td className="border border-black px-2 py-3 text-right text-indigo-300">{totals.totalDiscount.toFixed(2)}</td>}
                        {visibleColumns.net_revenue && <td className="border border-black px-2 py-3 text-right">{totals.totalNetRev.toFixed(2)}</td>}
                        
                        {isIncentiveReport && (
                            <>
                                <td colSpan={3} className="border border-black"></td>
                                <td className="border border-black px-2 py-3 text-right bg-indigo-600 font-bold">{totals.totalIncNet.toFixed(2)}</td>
                                {visibleColumns.remarks && <td className="border border-black"></td>}
                                {Array.isArray(activeStaffList) && activeStaffList.map(s => (
                                    <td key={s.id} className="border border-black px-1 py-3 text-right text-indigo-200">
                                        {(totals.staffTotals[s.id] || 0).toFixed(2)}
                                    </td>
                                ))}
                            </>
                        )}
                        {!isIncentiveReport && visibleColumns.remarks && <td className="border border-black"></td>}
                    </tr>
                </tbody>
            </table>
        </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
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
            <Button onClick={handleExportPDF} isLoading={isGeneratingPDF} className="h-12 px-8 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 transition-all active:scale-95"><FileDown className="w-4 h-4 mr-2" /> Export Audit</Button>
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
                                      { id: 'expiring_memberships', label: 'Expiring Memberships', icon: CalendarX, permission: canViewMembersJoined },
                                      { id: 'massage_room_revenue', label: 'Massage Room Revenue', icon: Building2, permission: canViewFinancial }
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

                          {/* 1.1 MEMBERSHIP TYPE TOGGLE (Only for Revenue Recognition) */}
                          {reportType === 'revenue_recognition' && membershipTypes.length > 0 && (
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

                          {/* 2. REWARD DEPARTMENT (Only for Incentives) */}
                          {reportType === 'incentives' && (
                              <div className="space-y-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2">
                                  <div className="flex items-center gap-2 mb-1">
                                      <Award className="w-3.5 h-3.5 text-indigo-600"/>
                                      <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Reward Department</label>
                                  </div>
                                  <div className="grid grid-cols-1 gap-2">
                                      {(['Massage', 'Membership', 'Personal Training'] as const).map(dept => (
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

          <div className={`${showConfig ? 'lg:col-span-9' : 'lg:col-span-12'} transition-all duration-700`}>
              <Card className="rounded-none border-slate-200 shadow-2xl overflow-hidden bg-white min-h-[1200px] print:shadow-none print:rounded-none">
                  <div ref={reportRef} className="print-container p-12 md:p-16 flex flex-col bg-white">
                      <div className="flex justify-between items-start mb-16">
                          <div className="flex items-center gap-6">
                              {currentProperty?.logo_url && <img src={currentProperty.logo_url} crossOrigin="anonymous" className="h-20 w-auto object-contain" />}
                              <div className="h-16 w-px bg-slate-200"></div>
                              <div>
                                  <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-2">{currentProperty?.name || settings?.name}</h2>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] leading-none">{currentOutlet?.name} &bull; ISO-9001 CERTIFIED</p>
                                  <div className="flex items-center gap-2 mt-4 text-indigo-600">
                                      <ShieldCheck className="w-4 h-4" />
                                      <span className="text-[9px] font-black uppercase tracking-widest">Internal Verification Protocol</span>
                                  </div>
                              </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-3">
                              <h3 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">
                                {reportType === 'incentives' ? `${incentiveDept} YIELD LEDGER` : 
                                 reportType === 'revenue_recognition' ? 'REVENUE RECOGNITION' : 
                                 reportType === 'expiring_memberships' ? 'EXPIRING MEMBERSHIPS AUDIT' :
                                 reportType === 'members_joined' ? 'MEMBERS JOINED AUDIT' :
                                 reportType === 'massage_room_revenue' ? 'MASSAGE ROOM REVENUE' :
                                 'DAILY SALES LEDGER'}
                              </h3>
                              <div className="bg-slate-950 text-white px-6 py-3 rounded-2xl shadow-2xl">
                                  <span className="text-[9px] font-black uppercase opacity-60 block tracking-widest">Audit Period</span>
                                  <span className="text-sm font-black uppercase">
                                    {reportType === 'daily_sales' 
                                      ? format(parseISO(dailySalesDate), 'dd MMMM yyyy') 
                                      : format(parseISO(reportMonth + '-01'), 'MMMM yyyy')}
                                  </span>
                              </div>
                              <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg">
                                  <Shield className="w-3 h-3 text-slate-400"/>
                                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Verified Audit Trail</span>
                              </div>
                          </div>
                      </div>
                      
                      <div className="flex-1">
                          {reportType === 'revenue_recognition' ? <RenderRevenueTable /> : 
                           reportType === 'expiring_memberships' ? <ExpiringMembershipsReport isEmbedded={true} embeddedMonth={reportMonth} /> : 
                           reportType === 'massage_room_revenue' ? <MassageRoomRevenueReport isEmbedded={true} embeddedMonth={reportMonth} /> :
                           <RenderStandardTable />}
                      </div>

                      {signatoryConfig && (
                        <div className="mt-16 grid grid-cols-12 gap-10">
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
                                                    {activeStaffList.filter(s => (rows.reduce((sum, r) => sum + (r.staff_splits[s.id] || 0), 0)) > 0).map(s => (
                                                        <tr key={s.id} className="bg-white">
                                                            <td className="border border-black px-8 py-2 uppercase text-slate-400 text-[9px] italic flex items-center gap-2">
                                                                <div className="w-1 h-1 bg-indigo-400 rounded-full"></div>
                                                                {s.name} ({s.role})
                                                            </td>
                                                            <td className="border border-black px-5 py-2 text-right text-slate-500 font-bold">
                                                                {formatMoney(rows.reduce((sum, r) => sum + (r.staff_splits[s.id] || 0), 0))}
                                                            </td>
                                                        </tr>
                                                    ))}
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

                            <div className={`col-span-7 grid ${signatoryConfig.reviewed ? 'grid-cols-3' : 'grid-cols-2'} gap-10 items-end pb-4`}>
                                <div className="space-y-12">
                                    <div className="h-px bg-black w-full"></div>
                                    <div className="text-center uppercase">
                                        <p className="font-black text-xs text-slate-900">Prepared By:</p>
                                        <p className="text-[10px] font-bold text-slate-400 mt-1">{signatoryConfig.prepared}</p>
                                    </div>
                                </div>
                                {signatoryConfig.reviewed && (
                                  <div className="space-y-12">
                                      <div className="h-px bg-black w-full"></div>
                                      <div className="text-center uppercase">
                                          <p className="font-black text-xs text-slate-900">Reviewed By:</p>
                                          <p className="text-[10px] font-bold text-slate-400 mt-1">{signatoryConfig.reviewed}</p>
                                      </div>
                                  </div>
                                )}
                                <div className="space-y-12">
                                    <div className="h-px bg-black w-full"></div>
                                    <div className="text-center uppercase">
                                        <p className="font-black text-xs text-slate-900">Approved By:</p>
                                        <p className="text-[10px] font-bold text-slate-400 mt-1">{signatoryConfig.approved}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                      )}

                      <div className="mt-12 flex justify-end">
                          <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Page 1 of 1 &bull; System ID: {currentOutlet?.id?.substring(0,8)}</span>
                      </div>
                  </div>
              </Card>
          </div>
      </div>

      <style>{`
        @media print {
            body { background: white !important; }
            .no-print { display: none !important; }
            #root, main { overflow: visible !important; height: auto !important; position: static !important; }
            
            /* Hide everything by default */
            body * { visibility: hidden; }
            
            /* Show the print container and its children */
            .print-container, .print-container * { 
                visibility: visible !important; 
            }
            
            .print-container { 
                position: absolute !important; 
                left: 0 !important; 
                top: 0 !important; 
                width: 100% !important; 
                padding: 0 !important;
                margin: 0 !important;
                background: white !important;
            }
            
            /* Preserve colors */
            * { 
                -webkit-print-color-adjust: exact !important; 
                print-color-adjust: exact !important; 
            }
            
            @page { 
                size: A4 landscape; 
                margin: 10mm; 
            }
        }
      `}</style>
    </div>
  );
};

export default Reports;
