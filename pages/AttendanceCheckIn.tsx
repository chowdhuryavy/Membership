import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, QrCode, LogIn, LogOut, Search, Clock, Calendar, Filter, 
  Download, Printer, Sparkles, Building2, Store, CheckCircle2, AlertTriangle, 
  TrendingUp, BarChart2, ShieldCheck, RefreshCw, Smartphone, Maximize2, FileText, Database, Code
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Member, MemberCheckIn } from '../types';
import { db } from '../services/mockSupabase';
import { checkInService } from '../services/checkInService';
import { parseScannedMemberCode } from '../utils/passToken';
import { DigitalMembershipCardModal } from '../components/DigitalMembershipCardModal';
import { QrScannerModal } from '../components/QrScannerModal';
import { SelfKioskMode } from '../components/SelfKioskMode';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

export default function AttendanceCheckIn() {
  const { user, isSuperAdmin } = useAuth();
  const { currentOutlet, currentProperty, settings, formatMoney, outlets = [] } = useSettings();

  const [viewScope, setViewScope] = useState<'outlet' | 'property'>('outlet');
  const [activeTab, setActiveTab] = useState<'desk' | 'active_now' | 'history' | 'analytics' | 'sql'>('desk');

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [checkIns, setCheckIns] = useState<MemberCheckIn[]>([]);
  const [currentlyCheckedIn, setCurrentlyCheckedIn] = useState<MemberCheckIn[]>([]);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterMethod, setFilterMethod] = useState<string>('all');

  // Modals
  const [showScanner, setShowScanner] = useState(false);
  const [showDigitalCard, setShowDigitalCard] = useState<Member | null>(null);
  const [isKioskActive, setIsKioskActive] = useState(false);


  // Analytics Stats
  const [analytics, setAnalytics] = useState<{
    activeNowCount: number;
    todayTotal: number;
    monthlyTotal: number;
    avgDurationMins: number;
    peakHourFormatted: string;
    daysInMonthMap: { [day: string]: number };
    hourCounts: { [hour: number]: number };
  }>({
    activeNowCount: 0,
    todayTotal: 0,
    monthlyTotal: 0,
    avgDurationMins: 0,
    peakHourFormatted: '10:00 - 11:00',
    daysInMonthMap: {},
    hourCounts: {}
  });

  const allowedOutletsInProperty = useMemo(() => {
    if (!currentProperty || !user || !outlets) return [];
    if (isSuperAdmin || user.role_id?.toLowerCase() === 'admin' || user.role_id?.toLowerCase() === 'system_admin') {
      return outlets.filter(o => o.property_id === currentProperty.id);
    }
    return outlets.filter(o => 
      o.property_id === currentProperty.id && 
      user.allowed_outlets?.includes(o.id)
    );
  }, [currentProperty, user, outlets, isSuperAdmin]);

  const canSwitchScope = Boolean(user && allowedOutletsInProperty.length > 1);

  // Load Data
  const loadData = async () => {
    if (!currentOutlet || !currentProperty) return;
    setLoading(true);
    try {
      const isProp = viewScope === 'property';
      const allowedIds = allowedOutletsInProperty.map(o => o.id);

      // Load members
      const memberList = await db.getMembers(isProp ? currentProperty.id : currentOutlet.id, isProp, allowedIds);
      setMembers(memberList);

      // Load check-in records
      const logs = await checkInService.getCheckIns(
        isProp ? currentProperty.id : currentOutlet.id,
        isProp,
        allowedIds
      );
      setCheckIns(logs);

      // Currently checked in
      const activeList = logs.filter(c => c.status === 'active');
      setCurrentlyCheckedIn(activeList);

      // Load analytics
      const stats = await checkInService.getAttendanceAnalytics(
        isProp ? currentProperty.id : currentOutlet.id,
        isProp,
        allowedIds
      );
      setAnalytics(stats);

    } catch (e) {
      console.error('Failed to load check-in data:', e);
      toast.error('Error loading attendance logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentOutlet?.id, currentProperty?.id, viewScope]);

  // Handle Search Member matches
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return members.filter(
      m => m.guest_name.toLowerCase().includes(q) ||
           m.membership_number.toLowerCase().includes(q) ||
           (m.phone && m.phone.includes(q))
    ).slice(0, 10);
  }, [members, searchQuery]);

  // Execute Check-In
  const handleCheckIn = async (memberToIn: Member, method: MemberCheckIn['check_in_method'] = 'reception_manual') => {
    try {
      const res = await checkInService.checkInMember(
        memberToIn,
        method,
        user?.name || 'Reception Staff',
        'Desk Entry',
        currentOutlet?.id
      );

      if (res.success) {
        toast.success(res.message);
        loadData();
      } else {
        toast.error(res.message);
      }
    } catch (e) {
      toast.error('Check-in failed');
    }
  };

  // Execute Check-Out
  const handleCheckOut = async (checkInId: string) => {
    try {
      const res = await checkInService.checkOutMember(checkInId);
      if (res.success) {
        toast.success(res.message);
        loadData();
      } else {
        toast.error(res.message);
      }
    } catch (e) {
      toast.error('Check-out failed');
    }
  };

  // Handle Scanned Code
  const handleScanCode = (scannedCode: string) => {
    setShowScanner(false);
    const matched = parseScannedMemberCode(scannedCode, members);

    if (matched) {
      setSelectedMember(matched);
      // Check if already checked in
      const active = currentlyCheckedIn.find(c => c.member_id === matched.id);
      if (active) {
        handleCheckOut(active.id);
      } else {
        handleCheckIn(matched, 'reception_scan');
      }
    } else {
      toast.error(`Member pass "${scannedCode}" not recognized.`);
    }
  };

  // Format Elapsed Time
  const getElapsedTime = (checkInIso: string) => {
    const start = new Date(checkInIso).getTime();
    const now = Date.now();
    const mins = Math.max(0, Math.floor((now - start) / (1000 * 60)));
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hrs > 0) return `${hrs}h ${remMins}m`;
    return `${remMins} mins`;
  };



  if (isKioskActive) {
    return (
      <SelfKioskMode
        outletName={currentOutlet?.name || 'Facility Kiosk'}
        outletId={currentOutlet?.id || 'main'}
        propertyId={currentProperty?.id}
        logoUrl={currentOutlet?.logo_url || currentProperty?.logo_url}
        onExitKiosk={() => setIsKioskActive(false)}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner Header */}
      <div className="relative rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-8 md:p-10 overflow-hidden shadow-2xl border border-indigo-500/20">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest">
              <QrCode className="w-3.5 h-3.5" /> Access Control & Facility Attendance
            </div>
            <h1 className="text-2xl md:text-4xl font-black uppercase tracking-tight text-white leading-tight">
              Member Check-In & Facility Attendance
            </h1>
            <p className="text-xs font-bold text-slate-300 max-w-xl">
              Real-time guest facility check-in, self-service kiosk mode, duration tracking, digital wallet pass verification, and monthly attendance logs.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <span className="text-xs font-bold text-indigo-200 uppercase tracking-widest flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-indigo-300" /> {viewScope === 'property' ? currentProperty?.name : currentOutlet?.name}
              </span>

              {canSwitchScope && (
                <div className="flex bg-white/10 p-1 rounded-xl border border-white/20 backdrop-blur-md">
                  <button 
                    onClick={() => setViewScope('outlet')} 
                    className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${viewScope === 'outlet' ? 'bg-white text-indigo-950 shadow-md' : 'text-indigo-200 hover:text-white'}`}
                  >
                    <Filter className="w-2.5 h-2.5" /> Outlet
                  </button>
                  <button 
                    onClick={() => setViewScope('property')} 
                    className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${viewScope === 'property' ? 'bg-white text-indigo-950 shadow-md' : 'text-indigo-200 hover:text-white'}`}
                  >
                    <Building2 className="w-2.5 h-2.5" /> Property
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Action Launch Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowScanner(true)}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-xl active:scale-95 border border-indigo-400/30"
            >
              <QrCode className="w-4 h-4" /> Scan Member QR
            </button>

            <button
              onClick={() => setIsKioskActive(true)}
              className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-xl active:scale-95 border border-emerald-300/40"
            >
              <Maximize2 className="w-4 h-4" /> Launch Kiosk Terminal
            </button>


          </div>
        </div>
      </div>

      {/* METRICS CARDS ROW */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Currently Inside</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight">{analytics.activeNowCount}</span>
            <span className="text-[10px] font-bold text-emerald-600 block mt-1">Live Active Members</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Today's Visits</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <LogIn className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight">{analytics.todayTotal}</span>
            <span className="text-[10px] font-bold text-slate-500 block mt-1">Check-Ins Today</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monthly Total</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight">{analytics.monthlyTotal}</span>
            <span className="text-[10px] font-bold text-slate-500 block mt-1">Visits This Month</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Avg Session Duration</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight">{analytics.avgDurationMins} <span className="text-sm font-bold text-slate-400">min</span></span>
            <span className="text-[10px] font-bold text-slate-500 block mt-1">Facility Stay Time</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Peak Facility Hour</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-lg font-black text-slate-900 tracking-tight">{analytics.peakHourFormatted}</span>
            <span className="text-[10px] font-bold text-slate-500 block mt-1">Highest Traffic Time</span>
          </div>
        </div>
      </div>

      {/* MAIN TABS NAVIGATION */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('desk')}
          className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'desk'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <LogIn className="w-4 h-4" /> Reception Desk Check-In
        </button>

        <button
          onClick={() => setActiveTab('active_now')}
          className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'active_now'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4" /> Currently In Facility ({currentlyCheckedIn.length})
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-4 h-4" /> Attendance Logs & History
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'analytics'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <BarChart2 className="w-4 h-4" /> Attendance Analytics
        </button>
      </div>

      {/* TAB 1: RECEPTION DESK CHECK-IN */}
      {activeTab === 'desk' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left: Member Lookup & Instant Action */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-slate-900">
                    Guest & Member Lookup
                  </h3>
                  <p className="text-xs text-slate-500 font-bold">
                    Search by Member Name, Membership #, or Phone
                  </p>
                </div>

                <button
                  onClick={() => setShowScanner(true)}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all border border-indigo-200"
                >
                  <QrCode className="w-4 h-4" /> Scan Pass
                </button>
              </div>

              <div className="relative">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type name, membership #, phone..."
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Search Suggestions Dropdown */}
              {filteredMembers.length > 0 && (
                <div className="p-2 bg-slate-50 rounded-2xl border border-slate-200 max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                  {filteredMembers.map(m => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setSelectedMember(m);
                        setSearchQuery('');
                      }}
                      className="w-full text-left p-3 rounded-xl hover:bg-white hover:shadow-md transition-all flex items-center justify-between group"
                    >
                      <div>
                        <span className="text-xs font-black text-slate-900 block group-hover:text-indigo-600">
                          {m.guest_name}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          ID: {m.membership_number} | Phone: {m.phone || 'N/A'}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                        m.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {m.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Member Detail View */}
              {selectedMember ? (
                <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-5 border border-slate-800">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 block">
                        SELECTED MEMBER
                      </span>
                      <h2 className="text-xl font-black uppercase tracking-tight text-white mt-0.5">
                        {selectedMember.guest_name}
                      </h2>
                      <span className="text-xs font-mono text-slate-400">
                        {selectedMember.membership_number}
                      </span>
                    </div>

                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${
                      selectedMember.status === 'Active' 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                        : 'bg-red-500/20 text-red-300 border-red-400/30'
                    }`}>
                      {selectedMember.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs pt-3 border-t border-slate-800">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest block">Access Zone</span>
                      <span className="font-black text-white">{selectedMember.access_type || 'Pool & Spa'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest block">Valid Until</span>
                      <span className="font-black text-white">{selectedMember.current_end_date}</span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    {/* Check if currently checked in */}
                    {currentlyCheckedIn.some(c => c.member_id === selectedMember.id) ? (
                      <button
                        onClick={() => {
                          const active = currentlyCheckedIn.find(c => c.member_id === selectedMember.id);
                          if (active) handleCheckOut(active.id);
                        }}
                        className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md"
                      >
                        <LogOut className="w-4 h-4" /> Check Out Member
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCheckIn(selectedMember, 'reception_manual')}
                        className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md"
                      >
                        <LogIn className="w-4 h-4" /> Instant Check In
                      </button>
                    )}

                    <button
                      onClick={() => setShowDigitalCard(selectedMember)}
                      className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all border border-white/20"
                    >
                      <Smartphone className="w-4 h-4 text-indigo-300" /> Digital Pass
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500">
                    Select a member from search results or scan member QR code to perform check-in.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Live Recent Entry Stream */}
          <div className="lg:col-span-5">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-slate-900">
                    Live Check-In Activity
                  </h3>
                  <p className="text-xs text-slate-500 font-bold">Today's Entry Feed</p>
                </div>
                <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase">
                  {checkIns.filter(c => c.check_in_time.startsWith(new Date().toISOString().split('T')[0])).length} Today
                </span>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                {checkIns.length === 0 ? (
                  <p className="text-center py-8 text-xs font-bold text-slate-400">No attendance entries recorded yet today.</p>
                ) : (
                  checkIns.slice(0, 8).map(c => (
                    <div key={c.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-black text-slate-900 block">{c.guest_name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ID: {c.membership_number} • Method: {c.check_in_method.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-black text-indigo-600 block">
                          {format(new Date(c.check_in_time), 'hh:mm a')}
                        </span>
                        <span className={`text-[9px] font-black uppercase ${c.status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {c.status === 'active' ? '● In Facility' : `Left (${c.duration_minutes || 0}m)`}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CURRENTLY IN FACILITY */}
      {activeTab === 'active_now' && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">
                Members Currently Inside Facility ({currentlyCheckedIn.length})
              </h3>
              <p className="text-xs text-slate-500 font-bold">Live list of active checked-in guests</p>
            </div>

            <button
              onClick={() => loadData()}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh List
            </button>
          </div>

          {currentlyCheckedIn.length === 0 ? (
            <div className="text-center py-12 space-y-3 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <Users className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="text-sm font-black uppercase text-slate-700">No Members Currently Inside</h4>
              <p className="text-xs text-slate-500 font-bold">New check-ins will appear here in real-time.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentlyCheckedIn.map(c => (
                <div key={c.id} className="p-5 bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-lg flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[9px] font-black uppercase tracking-wider">
                        ● Live Inside
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-300 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {getElapsedTime(c.check_in_time)}
                      </span>
                    </div>

                    <h4 className="text-lg font-black uppercase tracking-tight text-white leading-tight">
                      {c.guest_name}
                    </h4>
                    <span className="text-xs font-mono text-slate-400 block mt-0.5">
                      ID: {c.membership_number}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase tracking-widest block">CHECKED IN AT</span>
                      <span className="font-mono font-bold text-slate-200">
                        {format(new Date(c.check_in_time), 'hh:mm a')}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCheckOut(c.id)}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Check Out
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: ATTENDANCE HISTORY LOGS */}
      {activeTab === 'history' && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">
                Attendance Log Archive
              </h3>
              <p className="text-xs text-slate-500 font-bold">Searchable logs & duration history</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-none"
              />

              <select
                value={filterMethod}
                onChange={(e) => setFilterMethod(e.target.value)}
                className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:outline-none"
              >
                <option value="all">All Methods</option>
                <option value="reception_scan">Reception Scan</option>
                <option value="reception_manual">Reception Manual</option>
                <option value="self_kiosk_qr">Self-Kiosk QR</option>
                <option value="self_kiosk_number">Self-Kiosk Keypad</option>
              </select>

              <button
                onClick={() => window.print()}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all"
              >
                <Printer className="w-3.5 h-3.5" /> Print Logs
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="py-4 px-4">Member Name</th>
                  <th className="py-4 px-4">Membership #</th>
                  <th className="py-4 px-4">Check-In Time</th>
                  <th className="py-4 px-4">Check-Out Time</th>
                  <th className="py-4 px-4">Duration</th>
                  <th className="py-4 px-4">Method</th>
                  <th className="py-4 px-4">Staff / Terminal</th>
                  <th className="py-4 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {checkIns.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-slate-400 font-bold">
                      No attendance records found matching current filters.
                    </td>
                  </tr>
                ) : (
                  checkIns.map(ci => (
                    <tr key={ci.id} className="hover:bg-slate-50/80 transition-all">
                      <td className="py-3.5 px-4 font-black text-slate-900">{ci.guest_name}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-600">{ci.membership_number}</td>
                      <td className="py-3.5 px-4 font-mono">{format(new Date(ci.check_in_time), 'yyyy-MM-dd hh:mm a')}</td>
                      <td className="py-3.5 px-4 font-mono">
                        {ci.check_out_time ? format(new Date(ci.check_out_time), 'yyyy-MM-dd hh:mm a') : '—'}
                      </td>
                      <td className="py-3.5 px-4 font-bold">
                        {ci.duration_minutes ? `${ci.duration_minutes} mins` : ci.status === 'active' ? 'Active inside' : 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 uppercase text-[10px] font-black text-indigo-600">
                        {ci.check_in_method.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{ci.checked_in_by || 'System'}</td>
                      <td className="py-3.5 px-4 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                          ci.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {ci.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ANALYTICS */}
      {activeTab === 'analytics' && (
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
          <div>
            <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">
              Facility Attendance Traffic Analytics
            </h3>
            <p className="text-xs text-slate-500 font-bold">Hourly distribution and peak traffic insights</p>
          </div>

          <div className="h-72 w-full min-h-[280px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={Object.entries(analytics.hourCounts).map(([hr, cnt]) => ({
                hour: `${hr.padStart(2, '0')}:00`,
                visits: cnt
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fontWeight: 700 }} />
                <YAxis tick={{ fontSize: 10, fontWeight: 700 }} />
                <Tooltip />
                <Bar dataKey="visits" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* MODALS */}
      {showScanner && (
        <QrScannerModal
          onScanSuccess={handleScanCode}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showDigitalCard && (
        <DigitalMembershipCardModal
          member={showDigitalCard}
          outletName={currentOutlet?.name}
          onClose={() => setShowDigitalCard(null)}
        />
      )}

      {/* SQL Migration Code Modal */}

    </div>
  );
}
