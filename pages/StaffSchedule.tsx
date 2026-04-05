import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/mockSupabase';
import { Staff, MassageBooking, MassageType, Guest, MassageRoom } from '../types';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { LogOut, Calendar as CalendarIcon, Clock, User, MapPin, ChevronLeft, ChevronRight, RefreshCcw, KeyRound, X, ShieldCheck, Building2, Menu, Eye, EyeOff, Check, AlertCircle, Sparkles, Award, TrendingUp } from 'lucide-react';
import { Button, Input } from '../components/ui';
import { useSettings } from '../contexts/SettingsContext';
import { motion, AnimatePresence } from 'motion/react';
import { getReportData } from '../src/shared/reportLogic';
import { supabase } from '../services/supabase';

const StaffSchedule = () => {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [propertyName, setPropertyName] = useState<string>('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<MassageBooking[]>([]);
  const [treatments, setTreatments] = useState<MassageType[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [rooms, setRooms] = useState<MassageRoom[]>([]);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'daily' | 'monthly' | 'incentives'>('daily');
  const [monthlyBookings, setMonthlyBookings] = useState<MassageBooking[]>([]);
  const [incentiveData, setIncentiveData] = useState<any[]>([]);
  const [incentiveSummary, setIncentiveSummary] = useState<any>({});
  const [incentiveLoading, setIncentiveLoading] = useState(false);
  
  const { settings } = useSettings();

  // Password Change State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const navigate = useNavigate();

  // Live Password Validation
  const passwordValidation = useMemo(() => {
    return {
      length: newPassword.length >= 6,
      match: newPassword !== '' && newPassword === confirmPassword,
      hasUpperCase: /[A-Z]/.test(newPassword),
      hasNumber: /[0-9]/.test(newPassword),
    };
  }, [newPassword, confirmPassword]);

  const isPasswordValid = passwordValidation.length && passwordValidation.match;

  useEffect(() => {
    const sessionStr = localStorage.getItem('staff_session');
    if (!sessionStr) {
      navigate('/staff-login');
      return;
    }
    try {
      const session = JSON.parse(sessionStr);
      setStaff(session);
    } catch (e) {
      navigate('/staff-login');
    }
  }, [navigate]);

  useEffect(() => {
    if (staff) {
      if (viewMode === 'daily') {
        loadSchedule();
      } else if (viewMode === 'monthly') {
        loadMonthlySchedule();
      } else if (viewMode === 'incentives') {
        loadIncentives();
      }
      loadPropertyDetails();

      // Real-time updates
      const unsubscribe = db.subscribeToBookings(staff.outlet_id, (payload) => {
        console.log('Real-time booking update received:', payload.eventType);
        if (viewMode === 'daily') {
          loadSchedule();
        } else if (viewMode === 'monthly') {
          loadMonthlySchedule();
        } else if (viewMode === 'incentives') {
          loadIncentives();
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [staff, currentDate, viewMode]);

  const loadPropertyDetails = async () => {
    if (!staff) return;
    try {
      const outlets = await db.getOutlets();
      const properties = await db.getProperties();
      
      const myOutlet = outlets.find(o => o.id === staff.outlet_id);
      const myProp = properties.find(p => p.id === myOutlet?.property_id);
      
      if (myProp) {
        setPropertyName(myProp.name);
      }
    } catch (error) {
      console.error("Failed to load property details:", error);
    }
  };

  const loadSchedule = async () => {
    if (!staff) return;
    setLoading(true);
    try {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      
      const propertyId = staff.property_id;
      const sOutlets = Array.isArray(staff.outlet_ids) ? staff.outlet_ids : ((staff as any).outlet_id ? [(staff as any).outlet_id] : []);

      const [allBookings, allTreatments, allInventory, allGuests, allRooms, allOutlets] = await Promise.all([
        db.getMassageBookingsByDate(propertyId, true, dateStr),
        db.getMassageTypes(propertyId, true, sOutlets),
        db.getInventory(propertyId, true),
        db.getGuests(propertyId),
        db.getMassageRooms(undefined, propertyId),
        db.getOutlets()
      ]);

      // Filter bookings for this specific therapist
      const myBookings = allBookings.filter(b => b.therapist_id === staff.id && b.status !== 'cancelled');
      
      // Sort by time
      myBookings.sort((a, b) => a.start_time.localeCompare(b.start_time));

      setBookings(myBookings);
      setTreatments(allTreatments);
      setInventory(allInventory);
      setGuests(allGuests);
      setRooms(allRooms);
      setOutlets(allOutlets);
    } catch (error) {
      console.error("Failed to load schedule:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadIncentives = async () => {
    if (!staff) return;
    setIncentiveLoading(true);
    try {
      const propertyId = staff.property_id;
      const sOutlets = Array.isArray(staff.outlet_ids) ? staff.outlet_ids : ((staff as any).outlet_id ? [(staff as any).outlet_id] : []);
      
      // We need to fetch incentives for each department and combine them
      const depts: ('Massage' | 'Membership' | 'Personal Training')[] = ['Massage', 'Membership', 'Personal Training'];
      let allRows: any[] = [];
      let totalInc = 0;

      for (const dept of depts) {
        // We'll just pass 'all' for outletId to get all outlets for this property, 
        // then filter by staff id. The reportLogic handles 'all' outlets.
        const result = await getReportData({
          supabase,
          propertyId,
          outletId: 'all',
          reportType: 'incentives',
          date: currentDate,
          incentiveDept: dept
        });

        // Filter rows for this specific staff member
        const staffRows = result.rows.filter(r => r.staff_splits && r.staff_splits[staff.id]);
        
        // Add department info to each row
        const rowsWithDept = staffRows.map(r => ({
          ...r,
          department: dept,
          my_incentive: r.staff_splits[staff.id]
        }));

        allRows = [...allRows, ...rowsWithDept];
        totalInc += rowsWithDept.reduce((sum, r) => sum + r.my_incentive, 0);
      }

      // Sort by date
      allRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setIncentiveData(allRows);
      setIncentiveSummary({ total: totalInc, count: allRows.length });
    } catch (error) {
      console.error("Failed to load incentives:", error);
    } finally {
      setIncentiveLoading(false);
    }
  };

  const loadMonthlySchedule = async () => {
    if (!staff) return;
    setLoading(true);
    try {
      const startOfMonth = format(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), 'yyyy-MM-dd');
      const endOfMonth = format(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), 'yyyy-MM-dd');
      
      const propertyId = staff.property_id;
      const sOutlets = Array.isArray(staff.outlet_ids) ? staff.outlet_ids : ((staff as any).outlet_id ? [(staff as any).outlet_id] : []);

      const [allBookings, allTreatments, allInventory, allGuests, allRooms, allOutlets] = await Promise.all([
        db.getMassageBookingsByDateRange(propertyId, true, startOfMonth, endOfMonth),
        db.getMassageTypes(propertyId, true, sOutlets),
        db.getInventory(propertyId, true),
        db.getGuests(propertyId),
        db.getMassageRooms(undefined, propertyId),
        db.getOutlets()
      ]);

      // Filter bookings for this specific therapist
      const myBookings = allBookings.filter(b => b.therapist_id === staff.id && b.status !== 'cancelled');
      
      // Sort by date and time
      myBookings.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.start_time.localeCompare(b.start_time);
      });

      setMonthlyBookings(myBookings);
      setTreatments(allTreatments);
      setInventory(allInventory);
      setGuests(allGuests);
      setRooms(allRooms);
      setOutlets(allOutlets);
    } catch (error) {
      console.error("Failed to load monthly schedule:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('staff_session');
    navigate('/staff-login');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) return;

    setPasswordError('');
    setPasswordSuccess('');

    if (!staff) return;

    setIsChangingPassword(true);
    try {
      await db.updateStaff(staff.id, { password: newPassword });
      setPasswordSuccess('Password updated successfully.');
      
      // Update local session just in case
      const updatedStaff = { ...staff, password: newPassword };
      localStorage.setItem('staff_session', JSON.stringify(updatedStaff));
      setStaff(updatedStaff);
      
      setTimeout(() => {
        setShowPasswordModal(false);
        setNewPassword('');
        setConfirmPassword('');
        setPasswordSuccess('');
      }, 2000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!staff) return null;

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-white p-6 overflow-y-auto custom-scrollbar">
      <div className="mb-6">
        <div className="flex flex-col items-center text-center mb-6">
          {settings?.logo_url ? (
            <img 
              src={settings.logo_url} 
              alt="Logo" 
              referrerPolicy="no-referrer"
              className="w-20 h-auto object-contain mb-3 filter drop-shadow-[0_10px_20px_rgba(255,255,255,0.1)]" 
            />
          ) : (
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-indigo-500/20 mb-3">
              <Sparkles className="w-7 h-7" />
            </div>
          )}
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-indigo-400">{settings?.name || 'Health Club'}</h2>
        </div>

        <div className="flex items-center gap-3 mb-3 p-3 bg-white/5 rounded-2xl border border-white/5">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-lg font-black uppercase shadow-inner border border-white/10 shrink-0">
            {staff.name.charAt(0)}
          </div>
          <div className="min-w-0">
            <h1 className="text-xs font-black uppercase tracking-widest truncate">{staff.name}</h1>
            <p className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest">{staff.role}</p>
          </div>
        </div>
        {propertyName && (
          <div className="flex items-center gap-2 text-slate-400 text-[9px] font-bold uppercase tracking-widest bg-white/5 p-2.5 rounded-xl border border-white/5">
            <Building2 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="truncate">{propertyName}</span>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1">
        <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 px-2">Main Menu</div>
        <button 
          onClick={() => {
            setViewMode('daily');
            setCurrentDate(new Date());
            setIsSidebarOpen(false);
          }}
          className={`w-full flex items-center gap-3 p-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${viewMode === 'daily' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-white/5 text-slate-300 hover:text-white'}`}
        >
          <CalendarIcon className="w-3.5 h-3.5" /> Today's Schedule
        </button>
        <button 
          onClick={() => {
            setViewMode('monthly');
            setIsSidebarOpen(false);
          }}
          className={`w-full flex items-center gap-3 p-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${viewMode === 'monthly' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-white/5 text-slate-300 hover:text-white'}`}
        >
          <CalendarIcon className="w-3.5 h-3.5" /> Monthly Summary
        </button>
        {(settings?.staff_portal_settings?.show_incentives ?? true) && (
          <button 
            onClick={() => {
              setViewMode('incentives');
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${viewMode === 'incentives' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-white/5 text-slate-300 hover:text-white'}`}
          >
            <Award className="w-3.5 h-3.5" /> Incentive Earnings
          </button>
        )}
      </nav>

      <div className="pt-4 mt-4 border-t border-white/10 space-y-1">
        <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2 px-2">Account Settings</div>
        <button 
          onClick={() => {
            setShowPasswordModal(true);
            setIsSidebarOpen(false);
          }}
          className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 text-slate-300 hover:text-white font-bold text-[10px] uppercase tracking-widest transition-all"
        >
          <KeyRound className="w-3.5 h-3.5" /> Change Password
        </button>
        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-red-500/10 text-red-400 hover:text-red-300 font-bold text-[10px] uppercase tracking-widest transition-all"
        >
          <LogOut className="w-3.5 h-3.5" /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans selection:bg-indigo-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-72 h-screen sticky top-0 border-r border-slate-200">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out lg:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="relative h-full">
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors z-50"
          >
            <X className="w-5 h-5" />
          </button>
          <SidebarContent />
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-slate-900 text-white sticky top-0 z-20 shadow-xl shadow-slate-900/10 lg:hidden">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-[-50%] right-[-10%] w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px]"></div>
          </div>
          <div className="relative z-10 flex justify-between items-center px-4 py-2">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3">
              {settings?.logo_url && (
                <img 
                  src={settings.logo_url} 
                  alt="Logo" 
                  referrerPolicy="no-referrer"
                  className="h-8 w-auto object-contain" 
                />
              )}
              <div className="flex flex-col items-start">
                <h1 className="text-[10px] font-black uppercase tracking-widest truncate max-w-[120px]">{staff.name}</h1>
              </div>
            </div>
            <div className="w-10" /> {/* Spacer for centering */}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-10 max-w-4xl mx-auto w-full space-y-6 pb-24">
          {/* Desktop Welcome Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="hidden lg:block mb-8"
          >
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-2">Welcome Back, {staff.name.split(' ')[0]}</h1>
            <p className="text-slate-500 font-medium">Here is your {viewMode === 'daily' ? 'schedule for today' : viewMode === 'monthly' ? 'monthly summary' : 'incentive earnings'}.</p>
          </motion.div>
        
        {/* Date Navigation */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-between bg-white p-2 rounded-2xl shadow-sm border border-slate-200/60"
        >
          <button onClick={() => setCurrentDate(viewMode === 'daily' ? subDays(currentDate, 1) : new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-3 hover:bg-slate-50 rounded-xl transition-colors text-slate-500 hover:text-indigo-600">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 font-black uppercase tracking-widest text-sm text-slate-800">
            <CalendarIcon className="w-4 h-4 text-indigo-600" />
            {viewMode === 'daily' ? format(currentDate, 'EEE, dd MMM yyyy') : format(currentDate, 'MMMM yyyy')}
          </div>
          <button onClick={() => setCurrentDate(viewMode === 'daily' ? addDays(currentDate, 1) : new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-3 hover:bg-slate-50 rounded-xl transition-colors text-slate-500 hover:text-indigo-600">
            <ChevronRight className="w-5 h-5" />
          </button>
        </motion.div>

        <div className="flex justify-between items-end px-1 mb-2">
          <div>
            <h2 className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{viewMode === 'daily' ? 'Daily Appointments' : viewMode === 'monthly' ? 'Monthly Performance' : 'Incentive Earnings'}</h2>
            <div className="h-1 w-8 bg-indigo-500 rounded-full"></div>
          </div>
          <button 
            onClick={viewMode === 'daily' ? loadSchedule : viewMode === 'monthly' ? loadMonthlySchedule : loadIncentives} 
            disabled={loading || incentiveLoading} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-100 rounded-lg transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCcw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${loading || incentiveLoading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {/* Schedule List */}
        {loading || incentiveLoading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing Data...</p>
          </div>
        ) : viewMode === 'incentives' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl"></div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Total Earnings</div>
                <div className="text-3xl font-black text-white relative z-10">{settings?.currency_id || '$'}{incentiveSummary.total?.toFixed(2) || '0.00'}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Services</div>
                <div className="text-3xl font-black text-slate-900">{incentiveSummary.count || 0}</div>
              </div>
            </div>

            {incentiveData.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-12 rounded-[2rem] border border-slate-200/60 text-center shadow-sm"
              >
                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-100">
                  <Award className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-base font-black uppercase tracking-widest text-slate-900">No Earnings Found</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 max-w-xs mx-auto leading-relaxed">You haven't earned any incentives for this month yet.</p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <AnimatePresence mode="popLayout">
                  {incentiveData.map((item, index) => (
                    <motion.div 
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.02 }}
                      className="bg-white p-4 sm:p-6 rounded-[1.25rem] sm:rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden group hover:shadow-md hover:border-indigo-200 transition-all duration-300"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${
                            item.department === 'Massage' ? 'bg-indigo-50 text-indigo-600' :
                            item.department === 'Membership' ? 'bg-emerald-50 text-emerald-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>
                            {item.department === 'Massage' ? <Sparkles className="w-5 h-5" /> :
                             item.department === 'Membership' ? <TrendingUp className="w-5 h-5" /> :
                             <Award className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{item.department}</p>
                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">{item.item_name}</h4>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Your Share</p>
                          <p className="text-lg font-black text-indigo-600">{settings?.currency_id || '$'}{item.my_incentive.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="w-3.5 h-3.5 text-slate-300" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.date}</span>
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                          <User className="w-3.5 h-3.5 text-slate-300" />
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate max-w-[100px]">{item.guest_name}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        ) : viewMode === 'monthly' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Bookings</div>
                <div className="text-3xl font-black text-slate-900">{monthlyBookings.length}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Completed</div>
                <div className="text-3xl font-black text-emerald-600">{monthlyBookings.filter(b => b.status === 'completed').length}</div>
              </div>
            </div>
            
            {monthlyBookings.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-12 rounded-[2rem] border border-slate-200/60 text-center shadow-sm"
              >
                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-100">
                  <CalendarIcon className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-base font-black uppercase tracking-widest text-slate-900">No Appointments</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 max-w-xs mx-auto leading-relaxed">You have no scheduled treatments for this month.</p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                <AnimatePresence mode="popLayout">
                  {monthlyBookings.map((booking, index) => {
                    const treatment = treatments.find(t => t.id === booking.massage_type_id) || 
                                     inventory.find(i => i.id === booking.inventory_item_id);
                    const guest = guests.find(g => g.id === booking.guest_id);
                    const room = rooms.find(r => r.id === booking.room_id);
                    const outlet = outlets.find(o => o.id === booking.outlet_id);

                    return (
                      <motion.div 
                        key={booking.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: index * 0.02 }}
                        className="bg-white p-4 sm:p-6 rounded-[1.25rem] sm:rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden group hover:shadow-md hover:border-indigo-200 transition-all duration-300"
                      >
                      <div className={`absolute left-0 top-0 bottom-0 w-1 sm:w-2 ${
                        booking.status === 'completed' ? 'bg-emerald-500' : 
                        booking.status === 'no-show' ? 'bg-red-500' : 
                        'bg-indigo-500 animate-pulse'
                      }`}></div>
                      
                      <div className="flex justify-between items-start mb-3 sm:mb-5 pl-1 sm:pl-2">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="p-1.5 sm:p-2 bg-indigo-50 rounded-lg sm:rounded-xl text-indigo-600 group-hover:scale-110 transition-transform">
                            <CalendarIcon className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                          </div>
                          <div>
                            <span className="font-black text-sm sm:text-lg tracking-tight text-slate-900 block leading-none mb-1">
                              {format(parseISO(booking.date), 'MMM dd')}
                            </span>
                            <span className="font-bold text-xs sm:text-sm tracking-tight text-slate-500 block leading-none">
                              {booking.start_time.substring(0, 5)} <span className="text-slate-300 mx-0.5">-</span> {booking.end_time.substring(0, 5)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <div className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${
                            booking.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 
                            booking.status === 'no-show' ? 'bg-red-50 text-red-600 border border-red-100' : 
                            'bg-indigo-50 text-indigo-600 border border-indigo-100'
                          }`}>
                            {booking.status}
                          </div>
                          {outlet && (
                            <span className="text-[6px] sm:text-[8px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-50/50 px-2 py-0.5 rounded-full border border-indigo-100/50">
                              {outlet.name}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="pl-1 sm:pl-2 space-y-2 sm:space-y-3">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 shrink-0" />
                          <span className="text-xs sm:text-sm font-bold text-slate-700">{treatment?.name || 'Unknown Treatment'}</span>
                        </div>
                        
                        {guest && (
                          <div className="flex items-center gap-2 sm:gap-3">
                            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 shrink-0" />
                            <span className="text-xs sm:text-sm font-bold text-slate-600">{guest.first_name} {guest.last_name}</span>
                          </div>
                        )}

                        {room && (
                          <div className="flex items-center gap-2 sm:gap-3">
                            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 shrink-0" />
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-500">{room.name}</span>
                          </div>
                        )}
                      </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        ) : bookings.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-12 rounded-[2rem] border border-slate-200/60 text-center shadow-sm"
          >
            <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-100">
              <CalendarIcon className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-base font-black uppercase tracking-widest text-slate-900">No Appointments</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 max-w-xs mx-auto leading-relaxed">You have no scheduled treatments for this day. Enjoy your free time!</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode="popLayout">
              {bookings.map((booking, index) => {
                const treatment = treatments.find(t => t.id === booking.massage_type_id) || 
                                 inventory.find(i => i.id === booking.inventory_item_id);
                const guest = guests.find(g => g.id === booking.guest_id);
                const room = rooms.find(r => r.id === booking.room_id);
                const outlet = outlets.find(o => o.id === booking.outlet_id);

                return (
                  <motion.div 
                    key={booking.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white p-4 sm:p-6 rounded-[1.25rem] sm:rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden group hover:shadow-md hover:border-indigo-200 transition-all duration-300"
                  >
                  <div className={`absolute left-0 top-0 bottom-0 w-1 sm:w-2 ${
                    booking.status === 'completed' ? 'bg-emerald-500' : 
                    booking.status === 'no-show' ? 'bg-red-500' : 
                    'bg-indigo-500 animate-pulse'
                  }`}></div>
                  
                  <div className="flex justify-between items-start mb-3 sm:mb-5 pl-1 sm:pl-2">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div className="p-1.5 sm:p-2 bg-indigo-50 rounded-lg sm:rounded-xl text-indigo-600 group-hover:scale-110 transition-transform">
                        <Clock className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                      </div>
                      <div>
                        <span className="font-black text-sm sm:text-xl tracking-tight text-slate-900 block leading-none">
                          {booking.start_time.substring(0, 5)} <span className="text-slate-300 mx-0.5">-</span> {booking.end_time.substring(0, 5)}
                        </span>
                        <p className="text-[6px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Scheduled Time</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className={`text-[7px] sm:text-[10px] font-black uppercase tracking-widest px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border shadow-sm ${
                        booking.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                        booking.status === 'no-show' ? 'bg-red-50 text-red-700 border-red-100' : 
                        'bg-indigo-50 text-indigo-700 border-indigo-100'
                      }`}>
                        {booking.status}
                      </span>
                      {outlet && (
                        <span className="text-[6px] sm:text-[8px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-50/50 px-2 py-0.5 rounded-full border border-indigo-100/50">
                          {outlet.name}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pl-1 sm:pl-2">
                    <div className="mb-3 sm:mb-6">
                      <p className="text-[6px] sm:text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-0.5 sm:mb-1">Treatment Type</p>
                      <h3 className="font-black text-slate-900 uppercase tracking-tight text-xs sm:text-lg leading-tight">
                        {treatment?.name || 'Unknown Treatment'}
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-1 sm:mb-2">
                      <div className="flex items-center gap-2.5 sm:gap-4 p-2 sm:p-3 rounded-lg sm:rounded-2xl bg-slate-50/50 border border-slate-100 hover:bg-white hover:border-indigo-100 transition-colors">
                        <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm border border-slate-100">
                          <User className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-indigo-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Guest Name</p>
                          <p className="text-[10px] sm:text-sm font-black text-slate-800 uppercase truncate">{guest?.name || 'Unknown'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 sm:gap-4 p-2 sm:p-3 rounded-lg sm:rounded-2xl bg-slate-50/50 border border-slate-100 hover:bg-white hover:border-emerald-100 transition-colors">
                        <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm border border-slate-100">
                          <MapPin className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[7px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Assigned Location</p>
                          <p className="text-[10px] sm:text-sm font-black text-slate-800 uppercase truncate">{room?.name || 'Any Room'}</p>
                        </div>
                      </div>
                    </div>
                    
                    {booking.notes && (
                      <div className="mt-4 p-4 bg-amber-50 rounded-2xl border border-amber-100/50 flex gap-3">
                        <div className="w-1.5 h-full bg-amber-400 rounded-full shrink-0"></div>
                        <div>
                          <p className="text-[9px] font-black text-amber-800 uppercase tracking-widest mb-1">Special Notes</p>
                          <p className="text-xs font-bold text-amber-900 leading-relaxed">{booking.notes}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </main>

      {/* Password Change Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden"
            >
              <div className="p-6 sm:p-8 bg-slate-900 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl"></div>
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-widest">Security</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Update Password</p>
                  </div>
                  <button onClick={() => setShowPasswordModal(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <form onSubmit={handleChangePassword} className="p-6 sm:p-8 space-y-6">
                {passwordError && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold uppercase tracking-widest border border-red-100 flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" /> {passwordError}
                  </motion.div>
                )}
                {passwordSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl text-xs font-bold uppercase tracking-widest border border-emerald-100 flex items-center gap-2"
                  >
                    <Check className="w-4 h-4 shrink-0" /> {passwordSuccess}
                  </motion.div>
                )}

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <KeyRound className="w-5 h-5 text-slate-300" />
                      </div>
                      <input 
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword} 
                        onChange={e => setNewPassword(e.target.value)} 
                        required 
                        className="w-full h-14 pl-12 pr-12 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 hover:bg-white transition-all text-sm font-bold shadow-sm"
                        placeholder="••••••••"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm New Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <KeyRound className="w-5 h-5 text-slate-300" />
                      </div>
                      <input 
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword} 
                        onChange={e => setConfirmPassword(e.target.value)} 
                        required 
                        className="w-full h-14 pl-12 pr-12 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 hover:bg-white transition-all text-sm font-bold shadow-sm"
                        placeholder="••••••••"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Live Validation Indicators */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Security Requirements</p>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${passwordValidation.length ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                        {passwordValidation.length && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className={`text-[10px] font-bold ${passwordValidation.length ? 'text-emerald-600' : 'text-slate-400'}`}>At least 6 characters</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${passwordValidation.match ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                        {passwordValidation.match && <Check className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className={`text-[10px] font-bold ${passwordValidation.match ? 'text-emerald-600' : 'text-slate-400'}`}>Passwords match</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button 
                    type="submit" 
                    isLoading={isChangingPassword} 
                    disabled={!isPasswordValid}
                    className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-200 disabled:opacity-50 disabled:shadow-none"
                  >
                    Update Credentials
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
};

export default StaffSchedule;
