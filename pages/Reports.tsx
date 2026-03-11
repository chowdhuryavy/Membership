
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '../components/ui';
import { db } from '../services/mockSupabase';
import { Member, MassageBooking, MassageType, IncentiveRule, MemberStatus, Staff, Sale, Guest, MembershipCategory, StaffLeave } from '../types';
import { RevenueEngine } from '../services/revenueEngine';
import { format, endOfMonth, differenceInCalendarDays, addDays, startOfDay, isWithinInterval, subDays, parseISO } from 'date-fns';
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
  Shield,
  LayoutGrid,
  TrendingUp,
  CreditCard,
  Building2
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const startOfMonthLocal = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

// Report Types
type ReportType = 'revenue_recognition' | 'daily_sales' | 'incentives' | 'members_joined';

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
    net_fees: number;
    prev_accrual: number;
    period_rev: number;
    deferred: number;
    category_name: string;
}

const Reports = () => {
  const { user } = useAuth();
  const { settings, currentOutlet, currentProperty, formatMoney, hasPermission } = useSettings();
  const [reportType, setReportType] = useState<ReportType>('revenue_recognition');
  const [incentiveDept, setIncentiveDept] = useState<'Massage' | 'Membership' | 'Personal Training'>('Massage');
  const [reportMonth, setReportMonth] = useState(format(new Date(), 'yyyy-MM'));
  
  // Data States
  const [rows, setRows] = useState<ReportRow[]>([]); // For Incentives & Sales
  const [revenueRows, setRevenueRows] = useState<RevenueRow[]>([]); // For Revenue Recog
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

  const [staffLeaves, setStaffLeaves] = useState<StaffLeave[]>([]);

  const isStaffOnLeaveOnDate = (s: Staff, targetDateStr: string) => {
      // Check legacy fields
      if (s.leave_start_date && s.leave_end_date) {
          try {
              const target = startOfDay(new Date(targetDateStr));
              const start = startOfDay(new Date(s.leave_start_date));
              const end = startOfDay(new Date(s.leave_end_date));
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

  const loadData = async () => {
    if (!currentOutlet || !currentProperty) return;
    try {
      const start = startOfDay(parseISO(reportMonth + '-01'));
      const end = endOfMonth(start);
      
      const [rules, bookings, members, sales, therapists, mTypes, mCats, staffList, guests, freezes, users, leaves] = await Promise.all([
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
          db.getAllStaffLeaves()
      ]);

      setStaffLeaves(leaves);

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
          let sl = 1;

          members.filter(m => m.status !== MemberStatus.TENTATIVE).forEach(m => {
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
                  prevAccrual = RevenueEngine.calculateRevenuePeriod(m, memberFreezes, mStart, subDays(start, 1));
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
                  const totalDays = differenceInCalendarDays(mEnd, mStart) + 1;

                  revData.push({
                      id: m.id,
                      sl_no: 0, // Will assign after sort
                      guest_name: m.guest_name,
                      start_date: format(mStart, 'dd-MM-yyyy'),
                      end_date: format(mEnd, 'dd-MM-yyyy'),
                      total_days: totalDays,
                      net_fees: m.net_amount,
                      prev_accrual: prevAccrual,
                      period_rev: periodRev,
                      deferred: deferred,
                      category_name: cat ? cat.name.toUpperCase() : 'UNCATEGORIZED'
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
                  item_name: 'Membership',
                  actual_price: m.actual_rate,
                  discount_percent: m.discount > 0 ? (m.discount / m.actual_rate) * 100 : 0,
                  discount_amount: m.discount,
                  net_revenue: m.net_amount,
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
                      return b.status === 'completed' && bDate >= start && bDate <= end;
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
                          incDiscVal = (baseInc * discPercent) / 100;
                          incNet = baseInc - incDiscVal;

                          // For Massage, we always attribute the incentive to the specific therapist
                          // who performed the service, as per user requirement.
                          if (b.therapist_id) {
                              const therapist = staffList.find(s => s.id === b.therapist_id);
                              if (therapist && !isStaffOnLeaveOnDate(therapist, b.date)) {
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
                      const incDiscVal = (baseInc * discPercent) / 100;
                      const incNet = baseInc - incDiscVal;

                      const staffSplits: Record<string, number> = {};
                      if (rule.distribution_type === 'Shared') {
                          let available = staffList.filter(s => s.is_active && (s.is_eligible_for_incentives !== false) && !isStaffOnLeaveOnDate(s, m.start_date));
                          // Membership incentive is shared among ALL staff (including therapists and trainers)
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
                      const type = mTypes.find(m => m.id === (b.massage_type_id || b.inventory_item_id));
                      if (!type) return;
                      const rule = findBestRule(rules, 'Personal Training', (b.massage_type_id || b.inventory_item_id || ''), type.price, type.duration_minutes);
                      
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
                          incDiscVal = (baseInc * discPercent) / 100;
                          incNet = baseInc - incDiscVal;

                          if (b.therapist_id) {
                              const staff = staffList.find(s => s.id === b.therapist_id);
                              if (staff && !isStaffOnLeaveOnDate(staff, b.date)) {
                                  staffSplits[b.therapist_id] = incNet;
                              }
                          }
                      }

                      records.push({
                          sl_no: sl++,
                          date: format(parseISO(b.date), 'dd-MMM-yy'),
                          guest_name: guests.find(g => g.id === b.guest_id)?.name || 'Guest',
                          duration: `${type.duration_minutes}m`,
                          check_no: '#BOOK',
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
                      const incDiscVal = (baseInc * discPercent) / 100;
                      const incNet = baseInc - incDiscVal;

                      const staffSplits: Record<string, number> = {};
                      if (rule.distribution_type === 'Shared') {
                          let available = staffList.filter(staff => staff.is_active && (staff.is_eligible_for_incentives !== false) && !isStaffOnLeaveOnDate(staff, s.created_at));
                          available = available.filter(st => /trainer|coach|instructor|pt|gym|fitness/i.test(st.role));
                          if (available.length > 0) {
                              const share = incNet / available.length;
                              available.forEach(staff => staffSplits[staff.id] = share);
                          }
                      } else {
                          if (s.sold_by_id && s.secondary_sold_by_id) {
                              const share = incNet / 2;
                              staffSplits[s.sold_by_id] = share;
                              staffSplits[s.secondary_sold_by_id] = share;
                          } else if (s.sold_by_id) {
                              staffSplits[s.sold_by_id] = incNet;
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
    if (!reportRef.current) return;
    setIsGeneratingPDF(true);
    try {
      const canvas = await html2canvas(reportRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      pdf.addImage(imgData, 'PNG', 0, 0, 297, (canvas.height * 297) / canvas.width);
      pdf.save(`Report_${reportType}_${reportMonth}.pdf`);
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

  const RenderRevenueTable = () => {
      // Group by Category
      const grouped = revenueRows.reduce((acc, row) => {
          if (!acc[row.category_name]) acc[row.category_name] = [];
          acc[row.category_name].push(row);
          return acc;
      }, {} as Record<string, RevenueRow[]>);

      let grandNetFees = 0;
      let grandPrevAccrual = 0;
      let grandPeriodRev = 0;
      let grandDeferred = 0;

      return (
          <div className="w-full text-[10px] font-medium text-slate-900">
              {/* Header */}
              <div className="grid grid-cols-12 bg-slate-950 text-white font-black uppercase tracking-widest py-4 px-2 mb-1">
                  <div className="col-span-1">SL.</div>
                  <div className="col-span-3">Guest Name / Profile</div>
                  <div className="col-span-1">Start Date</div>
                  <div className="col-span-1">End Date</div>
                  <div className="col-span-1 text-center">Days</div>
                  <div className="col-span-1 text-right">Net Fees</div>
                  <div className="col-span-1 text-right">Prev. Accrual</div>
                  <div className="col-span-2 text-right">Period Rev</div>
                  <div className="col-span-1 text-right">Deferred</div>
              </div>

              {Object.entries(grouped).map(([category, groupRowsData]) => {
                  const groupRows = groupRowsData as RevenueRow[];
                  const subNetFees = groupRows.reduce((s, r) => s + r.net_fees, 0);
                  const subPrevAccrual = groupRows.reduce((s, r) => s + r.prev_accrual, 0);
                  const subPeriodRev = groupRows.reduce((s, r) => s + r.period_rev, 0);
                  const subDeferred = groupRows.reduce((s, r) => s + r.deferred, 0);

                  grandNetFees += subNetFees;
                  grandPrevAccrual += subPrevAccrual;
                  grandPeriodRev += subPeriodRev;
                  grandDeferred += subDeferred;

                  return (
                      <div key={category} className="mb-6">
                          {/* Group Header */}
                          <div className="flex items-center gap-3 bg-white py-3 border-b border-slate-200 mt-4 mb-2">
                              <Layers className="w-4 h-4 text-indigo-500" />
                              <span className="font-black text-slate-900 uppercase tracking-tight text-xs">{category}</span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">({groupRows.length} Ledger Events)</span>
                          </div>

                          {/* Rows */}
                          {groupRows.map((row, idx) => (
                              <div key={row.id} className="grid grid-cols-12 py-3 px-2 border-b border-slate-100 hover:bg-slate-50 transition-colors items-center">
                                  <div className="col-span-1 text-slate-500">{idx + 1}</div>
                                  <div className="col-span-3 font-black text-slate-800">{row.guest_name}</div>
                                  <div className="col-span-1 text-slate-600">{row.start_date}</div>
                                  <div className="col-span-1 text-slate-600">{row.end_date}</div>
                                  <div className="col-span-1 text-center text-slate-500">{row.total_days}</div>
                                  <div className="col-span-1 text-right text-slate-500">{formatMoney(row.net_fees)}</div>
                                  <div className="col-span-1 text-right text-slate-400">{formatMoney(row.prev_accrual)}</div>
                                  <div className="col-span-2 text-right font-black text-indigo-700">{formatMoney(row.period_rev)}</div>
                                  <div className="col-span-1 text-right font-bold text-red-500">{formatMoney(row.deferred)}</div>
                              </div>
                          ))}

                          {/* Subtotal */}
                          <div className="grid grid-cols-12 py-3 px-2 bg-indigo-50/50 mt-1 border-t-2 border-indigo-100 items-center">
                              <div className="col-span-7 text-right pr-4 font-black uppercase text-indigo-900 text-[9px] tracking-widest">Cluster Subtotal: {category}</div>
                              <div className="col-span-1 text-right font-black text-indigo-900">{formatMoney(subNetFees)}</div>
                              <div className="col-span-1 text-right font-black text-indigo-900">{formatMoney(subPrevAccrual)}</div>
                              <div className="col-span-2 text-right font-black text-indigo-900">{formatMoney(subPeriodRev)}</div>
                              <div className="col-span-1 text-right font-black text-indigo-900">{formatMoney(subDeferred)}</div>
                          </div>
                      </div>
                  );
              })}

              {/* Grand Total */}
              <div className="grid grid-cols-12 py-4 px-2 bg-slate-900 text-white mt-8 mb-4 items-center rounded-lg shadow-xl">
                  <div className="col-span-7 text-right pr-4 font-black uppercase tracking-[0.2em] text-xs">Verified Portfolio Total</div>
                  <div className="col-span-1 text-right font-bold text-xs">{formatMoney(grandNetFees)}</div>
                  <div className="col-span-1 text-right font-bold text-xs opacity-70">{formatMoney(grandPrevAccrual)}</div>
                  <div className="col-span-2 text-right font-black text-sm text-indigo-400">{formatMoney(grandPeriodRev)}</div>
                  <div className="col-span-1 text-right font-bold text-xs text-red-400">{formatMoney(grandDeferred)}</div>
              </div>
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
                    <tr className="bg-sky-100 text-black font-bold">
                        <th rowSpan={2} className="border border-black px-2 py-3 w-8">Sl.No.</th>
                        <th rowSpan={2} className="border border-black px-2 py-3 w-20">Date</th>
                        <th rowSpan={2} className="border border-black px-2 py-3 min-w-[120px]">Guest / Member</th>
                        
                        <th rowSpan={2} className="border border-black px-2 py-3 w-16">{isDailySales ? 'Reference' : isMembersJoined ? 'Category' : 'Duration'}</th>
                        <th rowSpan={2} className="border border-black px-2 py-3 w-16">Check No.</th>
                        {(isDailySales) && <th rowSpan={2} className="border border-black px-2 py-3">Payment Mode</th>}
                        <th rowSpan={2} className="border border-black px-2 py-3">Item / Service</th>
                        {isIncentiveReport && <th rowSpan={2} className="border border-black px-2 py-3">{specialistLabel}</th>}
                        
                        <th rowSpan={2} className="border border-black px-2 py-3 text-right">Gross Amount</th>
                        <th rowSpan={2} className="border border-black px-2 py-3 text-center">Disc %</th>
                        <th rowSpan={2} className="border border-black px-2 py-3 text-right">Discount Amt</th>
                        <th rowSpan={2} className="border border-black px-2 py-3 text-right">Net Revenue</th>
                        
                        {/* Incentive Columns only for Incentive Report */}
                        {isIncentiveReport && <th colSpan={4} className="border border-black px-2 py-1 text-center bg-amber-100">Incentive Breakdown</th>}
                        
                        <th rowSpan={2} className="border border-black px-2 py-3 min-w-[100px]">Remarks</th>
                        
                        {isIncentiveReport && Array.isArray(activeStaffList) && activeStaffList.map(s => (
                            <th key={s.id} rowSpan={2} className="border border-black px-1 py-3 w-16 bg-slate-50 text-center">
                                <div className="rotate-180" style={{ writingMode: 'vertical-rl' }}>{s.name.toUpperCase()}</div>
                            </th>
                        ))}
                    </tr>
                    <tr className="bg-amber-50">
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
                                <td className="border border-black px-2 py-1 text-center font-bold">{row.sl_no}</td>
                                <td className="border border-black px-2 py-1 text-center whitespace-nowrap">{row.date}</td>
                                <td className="border border-black px-2 py-1 font-black text-slate-700">{row.guest_name}</td>
                                
                                <td className="border border-black px-2 py-1 text-center">{isMembersJoined ? row.type_of_membership : (row.duration || '-')}</td>
                                <td className="border border-black px-2 py-1 text-center text-slate-400">{row.check_no}</td>
                                {(isDailySales) && <td className="border border-black px-2 py-1 text-center text-slate-500 font-bold">{row.mode_of_payment}</td>}
                                <td className="border border-black px-2 py-1">{row.item_name}</td>
                                {isIncentiveReport && <td className="border border-black px-2 py-1 text-center font-bold bg-slate-50 text-indigo-700">{row.therapist_name}</td>}
                                
                                <td className="border border-black px-2 py-1 text-right">{row.actual_price.toFixed(2)}</td>
                                <td className="border border-black px-2 py-1 text-center text-slate-400">{row.discount_percent > 0 ? `${row.discount_percent.toFixed(0)}%` : ''}</td>
                                <td className="border border-black px-2 py-1 text-right">{row.discount_amount.toFixed(2)}</td>
                                <td className="border border-black px-2 py-1 text-right font-black bg-slate-50">{row.net_revenue.toFixed(2)}</td>
                                
                                {isIncentiveReport && (
                                    <>
                                        <td className="border border-black px-2 py-1 text-right bg-amber-50/20">{row.inc_total.toFixed(2)}</td>
                                        <td className="border border-black px-2 py-1 text-center bg-amber-50/20 text-slate-400">{row.inc_discount_percent > 0 ? `${row.inc_discount_percent.toFixed(0)}%` : ''}</td>
                                        <td className="border border-black px-2 py-1 text-right bg-amber-50/20">{row.inc_discount_val.toFixed(2)}</td>
                                        <td className="border border-black px-2 py-1 text-right font-black bg-amber-100/30">{row.inc_net.toFixed(2)}</td>
                                    </>
                                )}
                                
                                <td className="border border-black px-2 py-1 text-[8px] text-slate-400 italic truncate max-w-[120px]">{row.remarks}</td>
                                
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
                        <td colSpan={(isDailySales || isIncentiveReport) ? 7 : 6} className="border border-black px-4 py-3 text-right uppercase tracking-widest">Aggregate Portfolio Totals</td>
                        <td className="border border-black px-2 py-3 text-right">{totals.totalActual.toFixed(2)}</td>
                        <td className="border border-black"></td>
                        <td className="border border-black px-2 py-3 text-right text-indigo-300">{totals.totalDiscount.toFixed(2)}</td>
                        <td className="border border-black px-2 py-3 text-right">{totals.totalNetRev.toFixed(2)}</td>
                        
                        {isIncentiveReport && (
                            <>
                                <td colSpan={3} className="border border-black"></td>
                                <td className="border border-black px-2 py-3 text-right bg-indigo-600 font-bold">{totals.totalIncNet.toFixed(2)}</td>
                                <td className="border border-black"></td>
                                {Array.isArray(activeStaffList) && activeStaffList.map(s => (
                                    <td key={s.id} className="border border-black px-1 py-3 text-right text-indigo-200">
                                        {(totals.staffTotals[s.id] || 0).toFixed(2)}
                                    </td>
                                ))}
                            </>
                        )}
                        {!isIncentiveReport && <td className="border border-black"></td>}
                    </tr>
                </tbody>
            </table>
        </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 no-print">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-xl">
        <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-indigo-100"><FileText className="w-7 h-7" /></div>
            <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Financial Audit Center</h1>
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
                                      { id: 'members_joined', label: 'Members Joined', icon: UserCheck, permission: canViewMembersJoined }
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
                              {currentProperty?.logo_url && <img src={currentProperty.logo_url} className="h-20 w-auto object-contain" />}
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
                                {reportType === 'incentives' ? `${incentiveDept} YIELD LEDGER` : reportType === 'revenue_recognition' ? 'REVENUE RECOGNITION' : 'DAILY SALES LEDGER'}
                              </h3>
                              <div className="bg-slate-950 text-white px-6 py-3 rounded-2xl shadow-2xl">
                                  <span className="text-[9px] font-black uppercase opacity-60 block tracking-widest">Audit Period</span>
                                  <span className="text-sm font-black uppercase">{format(parseISO(reportMonth + '-01'), 'MMMM yyyy')}</span>
                              </div>
                              <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg">
                                  <Shield className="w-3 h-3 text-slate-400"/>
                                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Verified Audit Trail</span>
                              </div>
                          </div>
                      </div>
                      
                      <div className="flex-1">
                          {reportType === 'revenue_recognition' ? <RenderRevenueTable /> : <RenderStandardTable />}
                      </div>

                      {reportType !== 'revenue_recognition' && (
                        <div className="mt-16 grid grid-cols-12 gap-10">
                            <div className="col-span-5">
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
