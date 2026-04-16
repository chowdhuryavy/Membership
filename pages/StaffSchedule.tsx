import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/mockSupabase';
import { Staff, MassageBooking, MassageType, Guest, MassageRoom, Sale } from '../types';
import { format, parseISO, addDays, subDays } from 'date-fns';
import { LogOut, Calendar as CalendarIcon, Clock, User, MapPin, ChevronLeft, ChevronRight, RefreshCcw, RefreshCw, KeyRound, X, ShieldCheck, Building2, Menu, Eye, EyeOff, Check, AlertCircle, Sparkles, Award, TrendingUp, FileText, ChevronDown, Bell } from 'lucide-react';
import { Button, Input } from '../components/ui';
import { useSettings } from '../contexts/SettingsContext';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { getReportData } from '../src/shared/reportLogic';
import { supabase } from '../services/supabase';

const LoadingScreen = () => (
  <motion.div 
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900"
  >
    <div className="relative flex flex-col items-center">
      {/* Logo Container */}
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative w-48 h-48 flex items-center justify-center"
      >
        {/* Outer Ring */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 border-2 border-dashed border-indigo-500/20 rounded-full"
        />
        
        {/* Inner Glow */}
        <div className="absolute inset-4 bg-indigo-500/5 rounded-full blur-2xl animate-pulse"></div>

        {/* Monogram */}
        <motion.svg 
          width="200" height="100" viewBox="0 0 160 100" 
          className="stroke-[4] fill-none stroke-linecap-round stroke-linejoin-round"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.3 } }
          }}
        >
          {/* H */}
          <motion.path 
            d="M 20 20 L 20 80 M 50 20 L 50 80 M 20 50 L 50 50"
            stroke="white"
            variants={{
              hidden: { pathLength: 0, opacity: 0 },
              visible: { pathLength: 1, opacity: 1, transition: { duration: 1, ease: "easeInOut" } }
            }}
          />
          {/* C */}
          <motion.path 
            d="M 90 30 A 25 25 0 1 0 90 70"
            stroke="#6366f1"
            variants={{
              hidden: { pathLength: 0, opacity: 0 },
              visible: { pathLength: 1, opacity: 1, transition: { duration: 1, ease: "easeInOut" } }
            }}
          />
          {/* M */}
          <motion.path 
            d="M 105 80 L 105 20 L 120 50 L 135 20 L 135 80"
            stroke="white"
            variants={{
              hidden: { pathLength: 0, opacity: 0 },
              visible: { pathLength: 1, opacity: 1, transition: { duration: 1, ease: "easeInOut" } }
            }}
          />
        </motion.svg>
      </motion.div>

      {/* Text Label */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="mt-8 text-center"
      >
        <h2 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-2">Health Club Management</h2>
        <div className="flex items-center justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ 
                scale: [1, 1.5, 1],
                opacity: [0.3, 1, 0.3]
              }}
              transition={{ 
                duration: 1, 
                repeat: Infinity, 
                delay: i * 0.2 
              }}
              className="w-1 h-1 bg-indigo-500 rounded-full"
            />
          ))}
        </div>
      </motion.div>
    </div>
  </motion.div>
);

interface StaffNotification {
  id: string;
  title: string;
  message: string;
  time: Date;
  isRead: boolean;
  type: 'booking' | 'sale' | 'system';
}

const StaffSchedule = () => {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [propertyName, setPropertyName] = useState<string>('');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState<MassageBooking[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
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
  const [incentiveSummary, setIncentiveSummary] = useState<any>({ total: 0, count: 0, breakdown: {} });
  const [incentiveLoading, setIncentiveLoading] = useState(false);
  const [selectedIncentiveDept, setSelectedIncentiveDept] = useState<string | null>(null);
  const [selectedMonthlyCategory, setSelectedMonthlyCategory] = useState<string | null>(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [triggeredReminders, setTriggeredReminders] = useState<Set<string>>(new Set());
  
  const { settings, formatMoney } = useSettings();

  const playNotificationSound = () => {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.volume = 0.6;
      audio.play().catch(e => console.log('Audio autoplay blocked or failed:', e));
    } catch (e) {
      console.error('Failed to play sound:', e);
    }
  };

  // 15-Minute Reminder Logic
  useEffect(() => {
    const checkUpcomingBookings = () => {
      if (!bookings || bookings.length === 0) return;

      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');

      bookings.forEach(booking => {
        // Only check for today's bookings
        if (booking.date !== todayStr) return;
        if (triggeredReminders.has(booking.id)) return;

        try {
          const [hours, minutes] = booking.start_time.split(':').map(Number);
          const bookingTime = new Date(now);
          bookingTime.setHours(hours, minutes, 0, 0);

          const diffInMinutes = (bookingTime.getTime() - now.getTime()) / (1000 * 60);

          // Trigger alert if booking is in 14-16 minutes (to catch it within a 1-min check)
          if (diffInMinutes > 0 && diffInMinutes <= 15.5) {
            playNotificationSound();
            
            const reminderNotif: StaffNotification = {
              id: `reminder-${booking.id}`,
              title: 'Upcoming Session!',
              message: `Reminder: You have a booking starting in 15 minutes (${booking.start_time})`,
              time: new Date(),
              isRead: false,
              type: 'system'
            };
            
            setNotifications(prev => [reminderNotif, ...prev].slice(0, 20));
            setTriggeredReminders(prev => new Set(prev).add(booking.id));
            
            toast('Upcoming Session in 15m!', {
              icon: '⏰',
              duration: 6000,
              style: {
                background: '#0f172a',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '900',
                textTransform: 'uppercase',
                border: '1px solid #334155'
              }
            });
          }
        } catch (e) {
          console.error("Error calculating reminder time:", e);
        }
      });
    };

    // Run check every minute
    const interval = setInterval(checkUpcomingBookings, 60000);
    checkUpcomingBookings(); // Run immediately

    return () => clearInterval(interval);
  }, [bookings, triggeredReminders]);

  const getBookingCategory = (booking: MassageBooking) => {
    const outlet = outlets.find(o => o.id === booking.outlet_id);
    const outletName = outlet?.name?.toLowerCase() || '';
    if (outletName.includes('pt') || outletName.includes('personal training') || outletName.includes('gym') || outletName.includes('fitness')) {
      return 'Personal Training';
    }
    const treatment = treatments.find(t => t.id === booking.massage_type_id) || inventory.find(i => i.id === booking.inventory_item_id);
    const treatmentName = treatment?.name?.toLowerCase() || '';
    
    let cat = treatment?.category || 'Massage';
    if (cat === 'PT' || cat.toLowerCase() === 'personal training' || cat.toLowerCase() === 'pt session') {
      return 'Personal Training';
    }
    
    if (treatmentName.includes('personal training') || treatmentName === 'pt' || treatmentName.includes('pt session') || treatmentName.includes('training session')) {
      return 'Personal Training';
    }
    
    return cat;
  };

  const monthlyCategories = useMemo(() => {
    const categories = new Set<string>();
    monthlyBookings.forEach(b => categories.add(getBookingCategory(b)));
    sales.forEach(s => {
      let cat = s.category || 'Sale';
      if (cat === 'PT' || cat.toLowerCase() === 'personal training') cat = 'Personal Training';
      categories.add(cat);
    });
    return Array.from(categories);
  }, [monthlyBookings, sales, outlets, treatments, inventory]);

  const filteredMonthlyItems = useMemo(() => {
    const items = [
      ...monthlyBookings.map(b => ({ ...b, _type: 'booking' as const, _category: getBookingCategory(b) })),
      ...sales.map(s => {
        let cat = s.category || 'Sale';
        if (cat === 'PT' || cat.toLowerCase() === 'personal training') cat = 'Personal Training';
        return { ...s, _type: 'sale' as const, _category: cat };
      })
    ];

    const filtered = selectedMonthlyCategory 
      ? items.filter(item => item._category === selectedMonthlyCategory)
      : items;

    return filtered.sort((a, b) => {
      const dateA = a._type === 'booking' ? a.date : format(new Date(a.created_at), 'yyyy-MM-dd');
      const dateB = b._type === 'booking' ? b.date : format(new Date(b.created_at), 'yyyy-MM-dd');
      if (dateA !== dateB) return dateA.localeCompare(dateB);
      
      const timeA = a._type === 'booking' ? a.start_time : format(new Date(a.created_at), 'HH:mm');
      const timeB = b._type === 'booking' ? b.start_time : format(new Date(b.created_at), 'HH:mm');
      return timeA.localeCompare(timeB);
    });
  }, [monthlyBookings, sales, selectedMonthlyCategory, outlets, treatments, inventory]);

  // Session Notes State
  const [selectedItemForNotes, setSelectedItemForNotes] = useState<(MassageBooking & { _type: 'booking' }) | (Sale & { _type: 'sale' }) | null>(null);
  const [sessionNotes, setSessionNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const handleSaveNotes = async () => {
    if (!selectedItemForNotes) return;
    setIsSavingNotes(true);
    try {
      if (selectedItemForNotes._type === 'booking') {
        await db.updateMassageBooking(selectedItemForNotes.id, { session_notes: sessionNotes });
        setBookings(bookings.map(b => b.id === selectedItemForNotes.id ? { ...b, session_notes: sessionNotes } : b));
        setMonthlyBookings(monthlyBookings.map(b => b.id === selectedItemForNotes.id ? { ...b, session_notes: sessionNotes } : b));
      } else {
        await db.updateSale(selectedItemForNotes.id, { session_notes: sessionNotes });
        setSales(sales.map(s => s.id === selectedItemForNotes.id ? { ...s, session_notes: sessionNotes } : s));
      }
      
      toast.success('Session notes saved successfully');
      setSelectedItemForNotes(null);
    } catch (error) {
      console.error("Failed to save notes:", error);
      toast.error('Failed to save notes. Please try again.');
    } finally {
      setIsSavingNotes(false);
    }
  };

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
      // Fetch latest staff profile to get up-to-date permissions
      db.getStaffById(session.id).then(updatedStaff => {
        if (updatedStaff) {
          setStaff(updatedStaff);
          // Update session in localStorage
          localStorage.setItem('staff_session', JSON.stringify(updatedStaff));
        } else {
          setStaff(session);
        }
      }).catch(() => {
        setStaff(session);
      });
    } catch (e) {
      navigate('/staff-login');
    }
  }, [navigate]);

  useEffect(() => {
    if (staff && staff.staff_portal_settings) {
      const s = staff.staff_portal_settings;
      if (viewMode === 'daily' && !s.show_daily_schedule) {
        if (s.show_monthly_summary) setViewMode('monthly');
        else if (s.show_incentives) setViewMode('incentives');
      } else if (viewMode === 'monthly' && !s.show_monthly_summary) {
        if (s.show_daily_schedule) setViewMode('daily');
        else if (s.show_incentives) setViewMode('incentives');
      } else if (viewMode === 'incentives' && !s.show_incentives) {
        if (s.show_daily_schedule) setViewMode('daily');
        else if (s.show_monthly_summary) setViewMode('monthly');
      }
    }
  }, [staff, viewMode]);

  useEffect(() => {
    if (staff) {
      if (viewMode === 'daily') {
        loadSchedule();
      } else if (viewMode === 'monthly') {
        loadMonthlySchedule();
        loadIncentives();
      } else if (viewMode === 'incentives') {
        loadIncentives();
      }
      loadPropertyDetails();

      // Real-time updates
      const unsubscribe = db.subscribeToBookings(staff.outlet_id, (payload) => {
        console.log('Real-time booking update received:', payload.eventType);
        
        // Handle new booking alert
        if (payload.eventType === 'INSERT' && payload.new.staff_id === staff.id) {
          playNotificationSound();
          
          const newNotif: StaffNotification = {
            id: payload.new.id || Math.random().toString(),
            title: 'New Booking Alert!',
            message: `A new appointment has been scheduled for ${payload.new.start_time}`,
            time: new Date(),
            isRead: false,
            type: 'booking'
          };
          
          setNotifications(prev => [newNotif, ...prev].slice(0, 20));
          toast.success('New Booking Received!', {
            icon: '🔔',
            duration: 5000,
            style: {
              background: '#4f46e5',
              color: '#fff',
              fontSize: '12px',
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }
          });
        }

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
      
      let propertyId = staff.property_id;
      const sOutlets = Array.isArray(staff.outlet_ids) ? staff.outlet_ids : ((staff as any).outlet_id ? [(staff as any).outlet_id] : []);

      // If propertyId is missing, try to find it from outlets
      if (!propertyId) {
        const outlets = await db.getOutlets();
        const myOutlet = outlets.find(o => sOutlets.includes(o.id));
        if (myOutlet) {
          propertyId = myOutlet.property_id;
        }
      }

      if (!propertyId) {
        console.error("No property ID found for staff");
        setLoading(false);
        return;
      }

      const [allBookings, allTreatments, allInventory, allGuests, allRooms, allOutlets, allSales] = await Promise.all([
        db.getMassageBookingsByDate(propertyId, true, dateStr),
        db.getMassageTypes(propertyId, true, sOutlets),
        db.getInventory(propertyId, true),
        db.getGuests(propertyId),
        db.getMassageRooms(undefined, propertyId),
        db.getOutlets(),
        db.getSalesByDate(propertyId, true, dateStr)
      ]);

      // Filter bookings for this specific therapist
      const myBookings = allBookings.filter(b => b.therapist_id === staff.id && b.status !== 'cancelled');
      
      // Filter sales for this specific staff (sold_by_id or secondary_sold_by_id)
      // and only those that are NOT linked to a booking (to avoid duplicates)
      const mySales = allSales.filter(s => 
        (s.sold_by_id === staff.id || s.secondary_sold_by_id === staff.id) && 
        !s.booking_id && s.status !== 'void'
      );

      // Sort by time
      myBookings.sort((a, b) => a.start_time.localeCompare(b.start_time));

      setBookings(myBookings);
      setSales(mySales);
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
      let propertyId = staff.property_id;
      const sOutlets = Array.isArray(staff.outlet_ids) ? staff.outlet_ids : ((staff as any).outlet_id ? [(staff as any).outlet_id] : []);
      
      // If propertyId is missing, try to find it from outlets
      if (!propertyId) {
        const outlets = await db.getOutlets();
        const myOutlet = outlets.find(o => sOutlets.includes(o.id));
        if (myOutlet) {
          propertyId = myOutlet.property_id;
        }
      }

      if (!propertyId) {
        console.error("No property ID found for staff");
        setIncentiveLoading(false);
        return;
      }

      // Fetch all departments in parallel for better performance
      const depts: ('Massage' | 'Membership' | 'Personal Training')[] = ['Massage', 'Membership', 'Personal Training'];
      
      const results = await Promise.all(depts.map(dept => 
        getReportData({
          supabase,
          propertyId,
          outletId: 'all',
          reportType: 'incentives',
          date: currentDate,
          incentiveDept: dept
        })
      ));

      let allRows: any[] = [];
      let totalInc = 0;
      const breakdown: Record<string, { total: number, count: number }> = {};

      results.forEach((result, index) => {
        const dept = depts[index];
        const staffRows = result.rows.filter(r => {
          if (!r.staff_splits) return false;
          const matchingKey = Object.keys(r.staff_splits).find(id => String(id) === String(staff.id));
          return matchingKey !== undefined;
        });

        const rowsWithDept = staffRows.map(r => {
          const matchingKey = Object.keys(r.staff_splits).find(id => String(id) === String(staff.id));
          return {
            ...r,
            department: dept,
            my_incentive: matchingKey ? r.staff_splits[matchingKey] : 0
          };
        });

        allRows = [...allRows, ...rowsWithDept];
        const deptTotal = rowsWithDept.reduce((sum, r) => sum + r.my_incentive, 0);
        totalInc += deptTotal;
        
        if (rowsWithDept.length > 0) {
          breakdown[dept] = {
            total: deptTotal,
            count: rowsWithDept.length
          };
        }
      });

      // Sort by date
      allRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Batch state updates
      setIncentiveData(allRows);
      setIncentiveSummary({ 
        total: totalInc, 
        count: allRows.length,
        breakdown 
      });
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
      const startOfMonthStr = format(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), 'yyyy-MM-dd');
      const endOfMonthStr = format(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), 'yyyy-MM-dd');
      
      let propertyId = staff.property_id;
      const sOutlets = Array.isArray(staff.outlet_ids) ? staff.outlet_ids : ((staff as any).outlet_id ? [(staff as any).outlet_id] : []);

      // If propertyId is missing, try to find it from outlets
      if (!propertyId) {
        const outlets = await db.getOutlets();
        const myOutlet = outlets.find(o => sOutlets.includes(o.id));
        if (myOutlet) {
          propertyId = myOutlet.property_id;
        }
      }

      if (!propertyId) {
        console.error("No property ID found for staff");
        setLoading(false);
        return;
      }

      const [allBookings, allTreatments, allInventory, allGuests, allRooms, allOutlets, allSales] = await Promise.all([
        db.getMassageBookingsByDateRange(propertyId, true, startOfMonthStr, endOfMonthStr),
        db.getMassageTypes(propertyId, true, sOutlets),
        db.getInventory(propertyId, true),
        db.getGuests(propertyId),
        db.getMassageRooms(undefined, propertyId),
        db.getOutlets(),
        db.getSalesByDateRange(propertyId, true, startOfMonthStr, endOfMonthStr)
      ]);

      // Filter bookings for this specific therapist
      const myBookings = allBookings.filter(b => b.therapist_id === staff.id && b.status !== 'cancelled');
      
      // Filter sales for this specific staff
      const mySales = allSales.filter(s => 
        (s.sold_by_id === staff.id || s.secondary_sold_by_id === staff.id) && 
        !s.booking_id && s.status !== 'void'
      );

      // Sort by date and time
      myBookings.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.start_time.localeCompare(b.start_time);
      });

      setMonthlyBookings(myBookings);
      setSales(mySales);
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

  if (loading && !staff) return <LoadingScreen />;
  if (!staff) return null;

  const refreshStaffData = async () => {
    if (!staff) return;
    try {
      const updatedStaff = await db.getStaffById(staff.id);
      if (updatedStaff) {
        setStaff(updatedStaff);
        localStorage.setItem('staff_session', JSON.stringify(updatedStaff));
        toast.success('Permissions synced');
      }
    } catch (e) {
      console.error('Failed to sync permissions', e);
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-white p-6 overflow-y-auto custom-scrollbar">
      <div className="mb-6">
        <div className="flex justify-end mb-2">
          <button 
            onClick={refreshStaffData}
            className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-colors"
            title="Sync Permissions"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-[1.5rem] flex items-center justify-center text-slate-900 shadow-2xl shadow-indigo-500/20 mb-4 relative group overflow-hidden border border-white/10 active:scale-95 transition-transform">
            <div className="absolute inset-0 bg-indigo-600 opacity-0 group-hover:opacity-5 transition-opacity" />
            {settings?.logo_url ? (
              <img 
                src={settings.logo_url} 
                alt="Logo" 
                referrerPolicy="no-referrer" 
                className="w-full h-full object-contain p-2 animate-[spin_15s_linear_infinite]" 
              />
            ) : (
              <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white">
                <Sparkles className="w-8 h-8 animate-[spin_10s_linear_infinite]" />
              </div>
            )}
          </div>
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 leading-none mb-1">{settings?.name || 'Health Club'}</h2>
          <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Staff Terminal</p>
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
        {(staff.staff_portal_settings?.show_daily_schedule ?? true) && (
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
        )}
        {(staff.staff_portal_settings?.show_monthly_summary ?? true) && (
          <button 
            onClick={() => {
              setViewMode('monthly');
              setIsSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 p-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${viewMode === 'monthly' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'hover:bg-white/5 text-slate-300 hover:text-white'}`}
          >
            <CalendarIcon className="w-3.5 h-3.5" /> Monthly Summary
          </button>
        )}
        {(staff.staff_portal_settings?.show_incentives ?? true) && (
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

      <div className="mt-auto pt-4 border-t border-white/10">
        <button 
          onClick={() => setShowAccountMenu(!showAccountMenu)}
          className="w-full flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all group"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-lg font-black uppercase shadow-inner border border-white/10 shrink-0 group-hover:scale-110 transition-transform">
            {staff.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <h1 className="text-xs font-black uppercase tracking-widest truncate">{staff.name}</h1>
            <p className="text-[9px] font-bold text-indigo-300 uppercase tracking-widest">{staff.role}</p>
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${showAccountMenu ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {showAccountMenu && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden space-y-1 mt-2"
            >
              <button 
                onClick={() => {
                  setShowPasswordModal(true);
                  setIsSidebarOpen(false);
                  setShowAccountMenu(false);
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans selection:bg-indigo-100">
      <AnimatePresence>
        {(loading || incentiveLoading) && <LoadingScreen />}
      </AnimatePresence>

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
        {/* Mobile Header */}
        <header className="bg-slate-900 text-white sticky top-0 z-30 shadow-xl shadow-slate-900/10 lg:hidden px-4 h-20 flex items-center justify-between">
          <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-b-[2rem]">
            <div className="absolute top-[-50%] right-[-10%] w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px]"></div>
          </div>
          
          <div className="flex items-center gap-4 relative z-10">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="group relative transition-all active:scale-95 outline-none"
              title="Open Menu"
            >
              <div className="w-12 h-12 flex items-center justify-center shrink-0 transition-all duration-500 group-hover:scale-110 relative">
                {settings?.logo_url ? (
                  <img 
                    src={settings.logo_url} 
                    alt="Logo" 
                    referrerPolicy="no-referrer" 
                    className="w-full h-full object-contain drop-shadow-md animate-[spin_10s_linear_infinite]" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      const fallback = (e.target as HTMLImageElement).parentElement?.querySelector('.logo-fallback');
                      if (fallback) (fallback as HTMLElement).style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className={`logo-fallback w-full h-full bg-indigo-600 rounded-[1.25rem] items-center justify-center text-white shadow-xl shadow-indigo-500/20 ${settings?.logo_url ? 'hidden' : 'flex'}`}>
                  <Sparkles className="w-6 h-6 animate-[spin_10s_linear_infinite]" />
                </div>
              </div>
            </button>
            <div className="flex flex-col">
              <h1 className="text-sm font-black uppercase tracking-tighter leading-none">{settings?.name || 'Staff Portal'}</h1>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1">Personnel Sync</p>
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-10">
            <div className="relative">
              <button 
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) {
                    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                  }
                }}
                className={`p-2.5 rounded-xl border transition-all ${showNotifications ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/10 text-white hover:bg-white/10'}`}
              >
                <Bell className={`w-5 h-5 ${notifications.some(n => !n.isRead) ? 'animate-bounce' : ''}`} />
                {notifications.some(n => !n.isRead) && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-slate-900"></span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 mt-3 w-[280px] sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-[100]"
                  >
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Live Alerts</span>
                      <button 
                        onClick={() => setNotifications([])}
                        className="text-[8px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                      {notifications.length === 0 ? (
                        <div className="p-12 text-center">
                          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <Bell className="w-6 h-6 text-slate-300" />
                          </div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No New Alerts</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div key={notif.id} className="p-3 bg-white rounded-xl border border-slate-50 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3 mb-1">
                              <div className={`w-2 h-2 rounded-full ${notif.type === 'booking' ? 'bg-indigo-500' : 'bg-amber-500'}`} />
                              <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{notif.title}</span>
                            </div>
                            <p className="text-[11px] font-bold text-slate-500 leading-relaxed mb-2">{notif.message}</p>
                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{format(notif.time, 'HH:mm')}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Desktop Header Wrapper */}
        <div className="hidden lg:flex items-center justify-between px-8 py-6 bg-white border-b border-slate-200 sticky top-0 z-30">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
              {viewMode === 'daily' ? 'Daily Schedule' : viewMode === 'monthly' ? 'Performance Snapshot' : 'Incentive Audit'}
            </h1>
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mt-1">{propertyName || 'Terminal Overview'}</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <button 
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications) {
                    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                  }
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${showNotifications ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                <div className="relative">
                  <Bell className={`w-4 h-4 ${notifications.some(n => !n.isRead) ? 'animate-bounce' : ''}`} />
                  {notifications.some(n => !n.isRead) && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                  )}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">Alerts</span>
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    className="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-[100]"
                  >
                    <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Terminal Notifications</span>
                      <button 
                        onClick={() => setNotifications([])}
                        className="text-[8px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors"
                      >
                        Purge All
                      </button>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                      {notifications.length === 0 ? (
                        <div className="p-12 text-center">
                          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                            <Bell className="w-6 h-6 text-slate-300" />
                          </div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No active notifications</p>
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <div key={notif.id} className="p-3 bg-white rounded-xl border border-slate-50 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3 mb-1">
                              <div className={`w-2 h-2 rounded-full ${notif.type === 'booking' ? 'bg-indigo-500' : 'bg-amber-500'}`} />
                              <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{notif.title}</span>
                            </div>
                            <p className="text-[11px] font-bold text-slate-500 leading-relaxed mb-2">{notif.message}</p>
                            <span className="text-[8px] font-black text-slate-300 uppercase tracking-widest">{format(notif.time, 'HH:mm')}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-8 w-px bg-slate-200 mx-2" />
            
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-sm">
                {staff?.name.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{staff?.name}</span>
                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">{staff?.role}</span>
              </div>
            </div>
          </div>
        </div>

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
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 space-y-4">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Syncing Data...</p>
          </div>
        ) : viewMode === 'incentives' ? (
          <div className="space-y-6">
            {!selectedIncentiveDept ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-colors"></div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 relative z-10">Total Earnings</div>
                    <div className="text-4xl font-black text-white relative z-10 truncate">{formatMoney(incentiveSummary.total)}</div>
                    <div className="mt-4 flex items-center gap-2 relative z-10">
                      <div className="px-2 py-1 bg-white/10 rounded-lg text-[8px] font-black text-white uppercase tracking-widest">
                        {incentiveSummary.count || 0} Items
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-8 -mt-8 blur-2xl group-hover:bg-emerald-500/10 transition-colors"></div>
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Avg / Service</div>
                    <div className="text-4xl font-black text-emerald-600 truncate">
                      {formatMoney(incentiveSummary.count > 0 ? incentiveSummary.total / incentiveSummary.count : 0)}
                    </div>
                  </div>
                </div>

                {/* Department Breakdown */}
                {incentiveSummary.breakdown && Object.keys(incentiveSummary.breakdown).length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.entries(incentiveSummary.breakdown).map(([dept, data]: [string, any]) => (
                      <motion.button 
                        key={dept} 
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setSelectedIncentiveDept(dept)}
                        className="p-6 rounded-[2rem] border bg-white border-slate-100 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all duration-300 flex items-center justify-between group relative overflow-hidden"
                      >
                        <div className="flex items-center gap-4 relative z-10">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                            dept === 'Massage' ? 'bg-indigo-50 text-indigo-600' :
                            dept === 'Membership' ? 'bg-emerald-50 text-emerald-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>
                            {dept === 'Massage' ? <Sparkles className="w-6 h-6" /> :
                             dept === 'Membership' ? <TrendingUp className="w-6 h-6" /> :
                             <Award className="w-6 h-6" />}
                          </div>
                          <div>
                            <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">{dept}</h4>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{data.count} items processed</p>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-4 relative z-10">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Subtotal</p>
                            <p className="text-xl font-black text-slate-900">{formatMoney(data.total)}</p>
                          </div>
                          <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                            <ChevronRight className="w-5 h-5" />
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                ) : (
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
                )}
              </>
            ) : (
              <div className="animate-in slide-in-from-right-10 duration-500">
                <div className="flex items-center justify-between mb-8">
                  <button 
                    onClick={() => setSelectedIncentiveDept(null)}
                    className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shadow-sm group"
                  >
                    <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Back to Summary</span>
                  </button>
                  <div className="text-right">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Department</p>
                    <p className="text-xs font-black text-indigo-600 uppercase tracking-widest">{selectedIncentiveDept}</p>
                  </div>
                </div>
                <div className="mb-8">
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{selectedIncentiveDept} Earnings</h3>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detail Audit Report • {incentiveSummary.breakdown[selectedIncentiveDept]?.count || 0} Items</p>
                </div>

                {incentiveData.filter(item => item.department === selectedIncentiveDept).length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-12 rounded-[2rem] border border-slate-200/60 text-center shadow-sm"
                  >
                    <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-100">
                      <Award className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-base font-black uppercase tracking-widest text-slate-900">No Earnings Found</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2 max-w-xs mx-auto leading-relaxed">You haven't earned any incentives for this department yet.</p>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    <AnimatePresence mode="popLayout">
                      {incentiveData
                        .filter(item => item.department === selectedIncentiveDept)
                        .map((item, index) => (
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
                              <p className="text-lg font-black text-indigo-600">{formatMoney(item.my_incentive)}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-50">
                            <div>
                              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Price</p>
                              <p className="text-[10px] font-bold text-slate-700">{formatMoney(item.actual_price)}</p>
                            </div>
                            <div>
                              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Net Revenue</p>
                              <p className="text-[10px] font-bold text-slate-700">{formatMoney(item.net_revenue)}</p>
                            </div>
                            <div>
                              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Incentive</p>
                              <p className="text-[10px] font-bold text-slate-700">{formatMoney(item.inc_net)}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Guest</p>
                              <p className="text-[10px] font-bold text-slate-700 truncate">{item.guest_name}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 pt-4 mt-4 border-t border-slate-50 opacity-60">
                            <div className="flex items-center gap-2">
                              <CalendarIcon className="w-3.5 h-3.5 text-slate-300" />
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.date}</span>
                            </div>
                            <div className="flex items-center gap-2 justify-end">
                              <Clock className="w-3.5 h-3.5 text-slate-300" />
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{item.duration || 'N/A'}</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : viewMode === 'monthly' ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Bookings</div>
                <div className="text-3xl font-black text-slate-900">{monthlyBookings.length + sales.length}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Completed</div>
                <div className="text-3xl font-black text-emerald-600">{monthlyBookings.filter(b => b.status === 'completed').length + sales.length}</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-4 overflow-x-auto pb-2 no-scrollbar">
                <button
                  onClick={() => setSelectedMonthlyCategory(null)}
                  className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    !selectedMonthlyCategory 
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
                      : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  All Categories
                </button>
                {monthlyCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedMonthlyCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      selectedMonthlyCategory === cat
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                        : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            
            {(monthlyBookings.length === 0 && sales.length === 0) ? (
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
                  {filteredMonthlyItems.map((item, index) => {
                    if (item._type === 'booking') {
                      const booking = item as MassageBooking;
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
                      
                      {(staff.staff_portal_settings?.show_session_notes ?? true) && (
                        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-100 flex justify-end pl-1 sm:pl-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setSelectedItemForNotes({ ...booking, _type: 'booking' });
                              setSessionNotes(booking.session_notes || '');
                            }}
                            className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest gap-1.5 sm:gap-2 h-7 sm:h-8 px-2 sm:px-3 ${booking.session_notes ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                          >
                            <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            {booking.session_notes ? 'View/Edit Notes' : 'Add Notes'}
                          </Button>
                        </div>
                      )}
                      </motion.div>
                      );
                    } else {
                      const sale = item as Sale;
                      const outlet = outlets.find(o => o.id === sale.outlet_id);
                      const guest = guests.find(g => g.id === sale.guest_id);
                      
                      return (
                        <motion.div 
                          key={sale.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: index * 0.02 }}
                          className="bg-white p-4 sm:p-6 rounded-[1.25rem] sm:rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden group hover:shadow-md hover:border-amber-200 transition-all duration-300"
                        >
                        <div className="absolute left-0 top-0 bottom-0 w-1 sm:w-2 bg-amber-500"></div>
                        
                        <div className="flex justify-between items-start mb-3 sm:mb-5 pl-1 sm:pl-2">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <div className="p-1.5 sm:p-2 bg-amber-50 rounded-lg sm:rounded-xl text-amber-600 group-hover:scale-110 transition-transform">
                              <TrendingUp className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                            </div>
                            <div>
                              <span className="font-black text-sm sm:text-lg tracking-tight text-slate-900 block leading-none mb-1">
                                {format(new Date(sale.created_at), 'MMM dd')}
                              </span>
                              <span className="font-bold text-xs sm:text-sm tracking-tight text-slate-500 block leading-none">
                                {format(new Date(sale.created_at), 'HH:mm')}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-100">
                              POS SALE
                            </div>
                            {outlet && (
                              <span className="text-[6px] sm:text-[8px] font-black text-amber-400 uppercase tracking-widest bg-amber-50/50 px-2 py-0.5 rounded-full border border-amber-100/50">
                                {outlet.name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="pl-1 sm:pl-2 space-y-2 sm:space-y-3">
                          <div className="flex items-center gap-2 sm:gap-3">
                            <Award className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                            <span className="text-xs sm:text-sm font-bold text-slate-700">{sale.item_name}</span>
                          </div>
                          
                          <div className="flex items-center gap-2 sm:gap-3">
                            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 shrink-0" />
                            <span className="text-xs sm:text-sm font-bold text-slate-600">{sale.guest_name || (guest ? `${guest.first_name} ${guest.last_name}` : 'Walk-in Guest')}</span>
                          </div>

                          <div className="flex items-center gap-2 sm:gap-3">
                            <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 shrink-0" />
                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-500">{sale.category}</span>
                          </div>
                        </div>

                        {(staff.staff_portal_settings?.show_session_notes ?? true) && (
                          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-100 flex justify-end pl-1 sm:pl-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                setSelectedItemForNotes({ ...sale, _type: 'sale' });
                                setSessionNotes(sale.session_notes || '');
                              }}
                              className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest gap-1.5 sm:gap-2 h-7 sm:h-8 px-2 sm:px-3 ${sale.session_notes ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}
                            >
                              <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              {sale.session_notes ? 'View/Edit Notes' : 'Add Notes'}
                            </Button>
                          </div>
                        )}
                        </motion.div>
                      );
                    }
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        ) : (bookings.length === 0 && sales.length === 0) ? (
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
              {[...bookings.map(b => ({...b, _type: 'booking' as const})), ...sales.map(s => ({...s, _type: 'sale' as const}))].sort((a, b) => {
                const timeA = a._type === 'booking' ? a.start_time : format(new Date(a.created_at), 'HH:mm');
                const timeB = b._type === 'booking' ? b.start_time : format(new Date(b.created_at), 'HH:mm');
                return timeA.localeCompare(timeB);
              }).map((item, index) => {
                if (item._type === 'booking') {
                  const booking = item as MassageBooking;
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
                          <div>
                            <p className="text-[6px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Guest Name</p>
                            <p className="text-[10px] sm:text-sm font-black text-slate-700 uppercase tracking-tight">{guest?.first_name} {guest?.last_name}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 sm:gap-4 p-2 sm:p-3 rounded-lg sm:rounded-2xl bg-slate-50/50 border border-slate-100 hover:bg-white hover:border-indigo-100 transition-colors">
                          <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-white flex items-center justify-center shrink-0 shadow-sm border border-slate-100">
                            <MapPin className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-indigo-400" />
                          </div>
                          <div>
                            <p className="text-[6px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Room Location</p>
                            <p className="text-[10px] sm:text-sm font-black text-slate-700 uppercase tracking-tight">{room?.name || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                      
                      {(staff.staff_portal_settings?.show_session_notes ?? true) && (
                        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-100 flex justify-end">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setSelectedItemForNotes({ ...booking, _type: 'booking' });
                              setSessionNotes(booking.session_notes || '');
                            }}
                            className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest gap-1.5 sm:gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-xl ${booking.session_notes ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                          >
                            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            {booking.session_notes ? 'View/Edit Notes' : 'Add Notes'}
                          </Button>
                        </div>
                      )}
                    </div>
                    </motion.div>
                  );
                } else {
                  const sale = item as Sale;
                  const outlet = outlets.find(o => o.id === sale.outlet_id);
                  const guest = guests.find(g => g.id === sale.guest_id);
                  
                  return (
                    <motion.div 
                      key={sale.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.05 }}
                      className="bg-white p-4 sm:p-6 rounded-[1.25rem] sm:rounded-[2rem] border border-slate-200/60 shadow-sm relative overflow-hidden group hover:shadow-md hover:border-amber-200 transition-all duration-300"
                    >
                    <div className="absolute left-0 top-0 bottom-0 w-1 sm:w-2 bg-amber-500"></div>
                    
                    <div className="flex justify-between items-start mb-3 sm:mb-5 pl-1 sm:pl-2">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 bg-amber-50 rounded-lg sm:rounded-xl text-amber-600 group-hover:scale-110 transition-transform">
                          <TrendingUp className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                        </div>
                        <div>
                          <span className="font-black text-sm sm:text-xl tracking-tight text-slate-900 block leading-none">
                            {format(new Date(sale.created_at), 'HH:mm')}
                          </span>
                          <p className="text-[6px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">POS Sale Time</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className="text-[7px] sm:text-[10px] font-black uppercase tracking-widest px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border shadow-sm bg-amber-50 text-amber-700 border-amber-100">
                          POS SALE
                        </span>
                        {outlet && (
                          <span className="text-[6px] sm:text-[8px] font-black text-amber-400 uppercase tracking-widest bg-amber-50/50 px-2 py-0.5 rounded-full border border-amber-100/50">
                            {outlet.name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pl-1 sm:pl-2">
                      <div className="mb-3 sm:mb-6">
                        <p className="text-[6px] sm:text-[9px] font-black text-amber-500 uppercase tracking-[0.2em] mb-0.5 sm:mb-1">Service / Item</p>
                        <h3 className="font-black text-slate-900 uppercase tracking-tight text-xs sm:text-lg leading-tight">
                          {sale.item_name}
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-1 sm:mb-2">
                        <div className="flex items-center gap-2.5 sm:gap-4 p-2 sm:p-3 rounded-lg sm:rounded-2xl bg-slate-50/50 border border-slate-100 hover:bg-white hover:border-amber-100 transition-colors">
                          <div className="w-7 h-7 sm:w-10 sm:h-10 bg-white rounded-lg sm:rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                            <User className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-[6px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Guest Name</p>
                            <p className="text-[10px] sm:text-sm font-black text-slate-700 uppercase tracking-tight">{sale.guest_name || (guest ? `${guest.first_name} ${guest.last_name}` : 'Walk-in Guest')}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 sm:gap-4 p-2 sm:p-3 rounded-lg sm:rounded-2xl bg-slate-50/50 border border-slate-100 hover:bg-white hover:border-amber-100 transition-colors">
                          <div className="w-7 h-7 sm:w-10 sm:h-10 bg-white rounded-lg sm:rounded-xl flex items-center justify-center shadow-sm border border-slate-100">
                            <Award className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-amber-500" />
                          </div>
                          <div>
                            <p className="text-[6px] sm:text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Category</p>
                            <p className="text-[10px] sm:text-sm font-black text-slate-700 uppercase tracking-tight">{sale.category}</p>
                          </div>
                        </div>
                      </div>

                      {(staff.staff_portal_settings?.show_session_notes ?? true) && (
                        <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-slate-100 flex justify-end">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setSelectedItemForNotes({ ...sale, _type: 'sale' });
                              setSessionNotes(sale.session_notes || '');
                            }}
                            className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest gap-1.5 sm:gap-2 h-8 sm:h-9 px-3 sm:px-4 rounded-xl ${sale.session_notes ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}
                          >
                            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            {sale.session_notes ? 'View/Edit Notes' : 'Add Notes'}
                          </Button>
                        </div>
                      )}
                    </div>
                    </motion.div>
                  );
                }
              })}
            </AnimatePresence>
          </div>
      )}
    </main>

      {/* Password Change Modal */}
      <AnimatePresence>
        {/* Session Notes Modal */}
        {selectedItemForNotes && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 sm:p-8 bg-indigo-600 text-white relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-400/30 rounded-full blur-2xl"></div>
                <div className="flex justify-between items-start relative z-10">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight mb-2">Session Notes</h2>
                    <p className="text-indigo-100 text-xs sm:text-sm font-bold tracking-wide">
                      {selectedItemForNotes._type === 'booking' 
                        ? `${guests.find(g => g.id === selectedItemForNotes.guest_id)?.first_name || ''} ${guests.find(g => g.id === selectedItemForNotes.guest_id)?.last_name || ''}`
                        : selectedItemForNotes.guest_name || 'Walk-in Guest'}
                      <span className="mx-2 opacity-50">•</span>
                      {format(parseISO(selectedItemForNotes._type === 'booking' ? selectedItemForNotes.date : selectedItemForNotes.created_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <button 
                    onClick={() => setSelectedItemForNotes(null)}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 sm:p-8 flex-1 overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Private Notes
                    </label>
                    <textarea
                      value={sessionNotes}
                      onChange={(e) => setSessionNotes(e.target.value)}
                      placeholder="Add notes about the session, guest preferences, progress, etc..."
                      className="w-full h-48 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 sm:p-8 bg-slate-50 border-t border-slate-100 shrink-0">
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1 h-12 rounded-xl font-black text-xs uppercase tracking-widest"
                    onClick={() => setSelectedItemForNotes(null)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1 h-12 rounded-xl font-black text-xs uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                  >
                    {isSavingNotes ? 'Saving...' : 'Save Notes'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

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
