
import React, { useEffect, useState, useMemo } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  Button, 
  Input, 
  Select,
  ConfirmationModal
} from '../components/ui';
import { 
  Plus, 
  Search, 
  Calendar, 
  Clock, 
  RefreshCcw, 
  CheckCircle2, 
  Trash2, 
  Zap, 
  Users2, 
  AlertTriangle,
  Info,
  Globe,
  ChevronLeft,
  ChevronRight,
  UserX,
  CheckCircle,
  X,
  Contact2,
  Edit3,
  Dna,
  Coins,
  Timer,
  UserPlus,
  ArrowLeft,
  History,
  TrendingUp,
  Mail,
  Phone,
  Filter,
  Layers,
  LayoutGrid,
  ShoppingBag,
  CalendarClock,
  Settings2
} from 'lucide-react';
import { db } from '../services/mockSupabase';
import { 
  MassageBooking, 
  Guest, 
  Therapist, 
  MassageType,
  Sale
} from '../types';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import BookingForm from './BookingForm';

const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 8 AM to 10 PM
const SLOT_HEIGHT = 52; 
const MINUTE_HEIGHT = SLOT_HEIGHT / 60;

const GuestHistoryView = ({ 
  guest, 
  bookings, 
  therapists, 
  massageTypes, 
  onBack, 
  formatMoney 
}: { 
  guest: Guest, 
  bookings: MassageBooking[], 
  therapists: Therapist[], 
  massageTypes: MassageType[], 
  onBack: () => void,
  formatMoney: (v: number) => string
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'confirmed' | 'cancelled' | 'no-show'>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'month'>('none');
  const [guestSales, setGuestSales] = useState<Sale[]>([]);

  useEffect(() => {
    db.getSales(guest.property_id).then(allSales => {
        setGuestSales(allSales.filter(s => s.guest_id === guest.id));
    });
  }, [guest.id, guest.property_id]);

  const guestBookings = useMemo(() => 
    bookings.filter(b => b.guest_id === guest.id)
  , [bookings, guest.id]);

  const filteredBookings = useMemo(() => {
    return guestBookings
      .filter(b => {
        const type = massageTypes.find(m => m.id === b.massage_type_id);
        const therapist = therapists.find(t => t.id === b.therapist_id);
        const searchString = `${type?.name || ''} ${therapist?.name || ''} ${b.date}`.toLowerCase();
        
        const matchesSearch = searchString.includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
        
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => `${b.date} ${b.start_time}`.localeCompare(`${a.date} ${a.start_time}`));
  }, [guestBookings, massageTypes, therapists, searchTerm, statusFilter]);

  const groupedBookings = useMemo(() => {
    if (groupBy === 'none') {
        return { 'All Records': filteredBookings };
    }
    return filteredBookings.reduce((groups, booking) => {
        const month = format(new Date(booking.date), 'MMMM yyyy');
        if (!groups[month]) groups[month] = [];
        groups[month].push(booking);
        return groups;
    }, {} as Record<string, MassageBooking[]>);
  }, [filteredBookings, groupBy]);

  const stats = useMemo(() => {
    const completedServices = guestBookings.filter(b => b.status === 'completed');
    const serviceRevenue = completedServices.reduce((sum, b) => sum + Number(b.price), 0);
    const saleRevenue = guestSales.filter(s => s.status === 'completed').reduce((sum, s) => sum + Number(s.net_amount), 0);
    
    return {
      visits: completedServices.length + guestSales.length,
      ltv: serviceRevenue + saleRevenue,
      noShows: guestBookings.filter(b => b.status === 'no-show').length
    };
  }, [guestBookings, guestSales]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
      <button onClick={onBack} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Ledger
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
            <div className="h-20 bg-slate-900 w-full"></div>
            <CardContent className="p-8 text-center -mt-10">
              <div className="inline-flex p-1.5 bg-white rounded-3xl shadow-xl mb-4">
                <div className="w-20 h-20 bg-indigo-600 rounded-[1.8rem] flex items-center justify-center text-white text-3xl font-black">
                  {guest.name.charAt(0)}
                </div>
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">{guest.name}</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Guest Profile Established {format(new Date(guest.created_at), 'MMM yyyy')}</p>
              
              <div className="mt-8 space-y-3">
                 <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <Phone className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-black text-slate-700">{guest.phone}</span>
                 </div>
                 <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <Mail className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-black text-slate-700 truncate">{guest.email || 'No email on record'}</span>
                 </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
              <Card className="rounded-3xl border-slate-200/60 shadow-sm p-5 bg-emerald-50/30">
                 <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Lifetime Value (POS+SVC)</p>
                 <h4 className="text-lg font-black text-emerald-700">{formatMoney(stats.ltv)}</h4>
              </Card>
              <Card className="rounded-3xl border-slate-200/60 shadow-sm p-5 bg-indigo-50/30">
                 <p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest mb-1">Engagements</p>
                 <h4 className="text-lg font-black text-indigo-700">{stats.visits} Total</h4>
              </Card>
          </div>
        </div>

        <div className="lg:col-span-2">
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden h-full flex flex-col">
            <CardHeader className="bg-slate-50 p-6 border-b border-slate-100">
               <div className="flex items-center justify-between mb-6">
                   <div className="flex items-center gap-3">
                      <History className="w-5 h-5 text-indigo-600" />
                      <CardTitle className="text-sm font-black uppercase tracking-widest">Service Forensic History</CardTitle>
                   </div>
                   <span className="text-[10px] font-black bg-white px-3 py-1 rounded-full border border-slate-200 text-slate-500 uppercase">
                      {filteredBookings.length} Matches
                   </span>
               </div>
               
               <div className="flex flex-col md:flex-row gap-3">
                   <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search service or staff..."
                            className="w-full h-10 pl-9 pr-3 rounded-xl bg-white border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                   </div>
                   <div className="flex gap-2">
                       <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="h-10 px-3 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
                       >
                           <option value="all">All Statuses</option>
                           <option value="completed">Completed</option>
                           <option value="confirmed">Confirmed</option>
                           <option value="cancelled">Cancelled</option>
                           <option value="no-show">No-Show</option>
                       </select>
                   </div>
               </div>
            </CardHeader>
            
            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar">
                <table className="w-full text-left">
                    <thead className="bg-slate-50/50 border-b border-slate-100 sticky top-0 z-10">
                        <tr>
                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date / Time</th>
                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Service Type</th>
                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Fee</th>
                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filteredBookings.map(b => {
                            const type = massageTypes.find(m => m.id === b.massage_type_id);
                            return (
                            <tr key={b.id} className="hover:bg-indigo-50/30 transition-colors group">
                                <td className="px-8 py-4">
                                    <div className="text-[11px] font-black text-slate-900">{format(new Date(b.date), 'dd MMM yyyy')}</div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase">{b.start_time} - {b.end_time}</div>
                                </td>
                                <td className="px-8 py-4">
                                    <div className="text-[11px] font-black text-indigo-600 uppercase tracking-tight">{type?.name || 'Standard Service'}</div>
                                </td>
                                <td className="px-8 py-4 text-right font-black text-slate-900">
                                    {formatMoney(Number(b.price))}
                                </td>
                                <td className="px-8 py-4 text-center">
                                    <span className={`inline-flex px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border
                                        ${b.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                        b.status === 'confirmed' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                                        b.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-100' : 
                                        'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                        {b.status}
                                    </span>
                                </td>
                            </tr>
                            );
                        })}
                    </tbody>
                </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const MassageScheduling = () => {
  const { user } = useAuth();
  const { currentProperty, formatMoney, hasPermission } = useSettings();
  const [activeTab, setActiveTab] = useState<'bookings' | 'treatments' | 'therapists' | 'guests'>('bookings');
  const [viewDate, setViewDate] = useState(new Date());
  
  const [bookings, setBookings] = useState<MassageBooking[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [massageTypes, setMassageTypes] = useState<MassageType[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<MassageBooking | null>(null);
  const [selectedGuestForHistory, setSelectedGuestForHistory] = useState<Guest | null>(null);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [editingBooking, setEditingBooking] = useState<MassageBooking | null>(null);
  const [guestSearchTerm, setGuestSearchTerm] = useState('');
  const [therapistFilter, setTherapistFilter] = useState('');
  
  const [newType, setNewType] = useState({ id: '', name: '', price: 0, duration_minutes: 60 });
  const [newTherapist, setNewTherapist] = useState({ id: '', name: '', specialty: '', country: '' });
  const [isEditingResource, setIsEditingResource] = useState(false);
  
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{id: string, type: 'treatment' | 'therapist' | 'guest', name: string} | null>(null);

  const canView = user && hasPermission(user.role_id, 'bookings:view');
  const canCreate = user && hasPermission(user.role_id, 'bookings:create');
  const canEdit = user && hasPermission(user.role_id, 'bookings:edit');
  const canDelete = user && hasPermission(user.role_id, 'bookings:delete');
  const canManageResources = user && hasPermission(user.role_id, 'bookings:manage_resources');

  useEffect(() => {
    if (currentProperty) {
      loadData();
    }
  }, [currentProperty, viewDate]);

  const loadData = async () => {
    if (!currentProperty) return;
    setLoading(true);
    try {
      const [b, g, t, m] = await Promise.all([
        db.getMassageBookings(currentProperty.id),
        db.getGuests(currentProperty.id),
        db.getTherapists(currentProperty.id),
        db.getMassageTypes(currentProperty.id)
      ]);
      setBookings(b || []);
      setGuests(g || []);
      // Explicit Alphabetical Sorting for Specialists
      setTherapists((t || []).sort((x, y) => x.name.localeCompare(y.name)));
      // Explicit Duration Sorting for Portfolio
      setMassageTypes((m || []).sort((x, y) => {
          const durX = Number(x.duration_minutes) || 0;
          const durY = Number(y.duration_minutes) || 0;
          if (durX !== durY) return durX - durY;
          return x.name.localeCompare(y.name);
      }));
    } catch (e) {
      console.error("Failed to load booking data", e);
    } finally {
      setLoading(false);
    }
  };

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleUpdateStatus = async (id: string, status: MassageBooking['status']) => {
    if (!canEdit) return;
    try {
      await db.updateMassageBookingStatus(id, status);
      showStatus(`Booking marked as ${status.toUpperCase()}`);
      setSelectedBooking(null);
      loadData();
    } catch (e: any) {
      showStatus(e.message || 'Status update failed.', 'error');
    }
  };

  const handleUpdateGuest = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingGuest || !canEdit) return;
      setIsSubmitting(true);
      try {
          await db.updateGuest(editingGuest.id, {
              name: editingGuest.name,
              phone: editingGuest.phone,
              email: editingGuest.email
          });
          showStatus('Guest profile modified successfully.');
          setEditingGuest(null);
          loadData();
      } catch (e: any) {
          showStatus(e.message || 'Update failed.', 'error');
      } finally {
          setIsSubmitting(false);
      }
  };

  const handleSaveMassageType = async () => {
    if (!currentProperty || !newType.name || !canManageResources) return;
    setIsSubmitting(true);
    try {
      if (isEditingResource && newType.id) {
          await (db as any).updateMassageType(newType.id, { name: newType.name, price: newType.price, duration_minutes: newType.duration_minutes });
          showStatus('Treatment adjusted.');
      } else {
          await db.addMassageType({ ...newType, property_id: currentProperty.id });
          showStatus('Treatment added to portfolio.');
      }
      setNewType({ id: '', name: '', price: 0, duration_minutes: 60 });
      setIsEditingResource(false);
      loadData();
    } catch (e: any) {
      showStatus(e.message || 'Failed to save treatment.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveTherapist = async () => {
    if (!currentProperty || !newTherapist.name || !canManageResources) return;
    setIsSubmitting(true);
    try {
      if (isEditingResource && newTherapist.id) {
          await (db as any).updateTherapist(newTherapist.id, { name: newTherapist.name, specialty: newTherapist.specialty, country: newTherapist.country });
          showStatus('Therapist profile updated.');
      } else {
          await db.addTherapist({ ...newTherapist, property_id: currentProperty.id });
          showStatus('Therapist onboarded successfully.');
      }
      setNewTherapist({ id: '', name: '', specialty: '', country: '' });
      setIsEditingResource(false);
      loadData();
    } catch (e: any) {
      showStatus(e.message || 'Failed to onboard staff.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirmed = async () => {
      if (!itemToDelete) return;
      const isResource = itemToDelete.type === 'treatment' || itemToDelete.type === 'therapist';
      if (isResource && !canManageResources) return;
      if (itemToDelete.type === 'guest' && !canDelete) return;

      try {
          if (itemToDelete.type === 'treatment') await db.deleteMassageType(itemToDelete.id);
          else if (itemToDelete.type === 'therapist') await db.deleteTherapist(itemToDelete.id);
          else if (itemToDelete.type === 'guest') await db.deleteGuest(itemToDelete.id);
          
          showStatus(`Resource record purged.`);
          loadData();
      } catch (e: any) {
          showStatus(`Removal failed: ${e.message}`, 'error');
      } finally {
          setItemToDelete(null);
      }
  };

  const getGuestName = (id: string) => guests.find(g => g.id === id)?.name || 'Unknown Guest';

  const calculatePosition = (startTime: string, endTime: string) => {
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    const top = ((sH - 8) * 60 + sM) * MINUTE_HEIGHT;
    const duration = ((eH * 60 + eM) - (sH * 60 + sM));
    const height = duration * MINUTE_HEIGHT;
    return { top, height };
  };

  const filteredTodayBookings = useMemo(() => {
    const dateStr = format(viewDate, 'yyyy-MM-dd');
    return bookings.filter(b => b.date === dateStr);
  }, [bookings, viewDate]);

  const filteredGuests = useMemo(() => {
    if (!guestSearchTerm) return guests;
    const q = guestSearchTerm.toLowerCase();
    return guests.filter(g => 
      g.name.toLowerCase().includes(q) || 
      g.phone.includes(q) || 
      (g.email && g.email.toLowerCase().includes(q))
    );
  }, [guests, guestSearchTerm]);

  if (!canView) {
      return (
          <div className="flex items-center justify-center h-96">
              <Card className="max-w-md text-center p-8 rounded-[2rem] border-red-100 bg-red-50/30">
                  <CalendarClock className="w-12 h-12 text-red-500 mx-auto mb-4" />
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Access Restricted</h3>
                  <p className="text-slate-500 mt-2 text-sm">Security clearance insufficient to view resource scheduling grid.</p>
              </Card>
          </div>
      );
  }

  if (selectedGuestForHistory) {
    return (
      <GuestHistoryView 
        guest={selectedGuestForHistory} 
        bookings={bookings} 
        therapists={therapists} 
        massageTypes={massageTypes} 
        onBack={() => setSelectedGuestForHistory(null)}
        formatMoney={formatMoney}
      />
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Resource Management</h1>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Property Scope: {currentProperty?.name}</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-200 p-1 rounded-xl border border-slate-300 shadow-inner overflow-x-auto">
            <button onClick={() => {setActiveTab('bookings'); setIsEditingResource(false);}} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'bookings' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Service Grid</button>
            <button onClick={() => {setActiveTab('guests'); setIsEditingResource(false);}} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'guests' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Guest Ledger</button>
            {canManageResources && <button onClick={() => {setActiveTab('treatments'); setIsEditingResource(false);}} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'treatments' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Portfolio</button>}
            {canManageResources && <button onClick={() => {setActiveTab('therapists'); setIsEditingResource(false);}} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'therapists' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Staffing</button>}
          </div>
          {canCreate && (
              <Button onClick={() => { setEditingBooking(null); setShowBookingForm(true); }} className="h-10 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100">
                <Plus className="w-4 h-4 mr-2" /> Authorized Booking
              </Button>
          )}
        </div>
      </div>

      {activeTab === 'bookings' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
              <button onClick={() => setViewDate(addDays(viewDate, -1))} className="p-1.5 hover:bg-slate-50 rounded-lg border border-slate-100"><ChevronLeft className="w-4 h-4 text-slate-400"/></button>
              <div className="flex flex-col items-center min-w-[150px]">
                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{format(viewDate, 'EEEE')}</span>
                <span className="text-sm font-black text-slate-900 tracking-tight">{format(viewDate, 'MMMM dd, yyyy')}</span>
              </div>
              <button onClick={() => setViewDate(addDays(viewDate, 1))} className="p-1.5 hover:bg-slate-50 rounded-lg border border-slate-100"><ChevronRight className="w-4 h-4 text-slate-400"/></button>
            </div>
            <div className="relative flex-1 sm:w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input placeholder="Filter roster..." value={therapistFilter} onChange={(e) => setTherapistFilter(e.target.value)} className="h-9 w-full pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
          </div>

          <Card className="rounded-[1.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-slate-50">
            <div className="overflow-x-auto">
              <div className="min-w-[900px] flex">
                <div className="w-14 shrink-0 border-r border-slate-200 bg-white">
                    <div className="h-10 border-b border-slate-200 flex items-center justify-center"><Clock className="w-3 h-3 text-slate-300" /></div>
                    {HOURS.map(hour => (
                        <div key={hour} style={{ height: SLOT_HEIGHT }} className="relative">
                            <span className="absolute -top-2 left-0 right-0 text-center text-[8px] font-black text-slate-400">{hour > 12 ? `${hour-12}P` : hour === 12 ? '12P' : `${hour}A`}</span>
                        </div>
                    ))}
                </div>
                <div className="flex flex-1">
                    {therapists.filter(t => !therapistFilter || t.name.toLowerCase().includes(therapistFilter.toLowerCase())).map(therapist => {
                      const therapistBookings = filteredTodayBookings.filter(b => b.therapist_id === therapist.id);
                      return (
                        <div key={therapist.id} className="flex-1 border-r border-slate-200 relative bg-white/50 min-w-[150px]">
                          <div className="h-10 bg-white border-b border-slate-200 flex flex-col items-center justify-center sticky top-0 z-10 px-1">
                            <span className="text-[9px] font-black text-slate-900 uppercase truncate w-full text-center">{therapist.name}</span>
                          </div>
                          {HOURS.map(hour => <div key={hour} style={{ height: SLOT_HEIGHT }} className="border-b border-slate-100/50"></div>)}
                          {therapistBookings.map(booking => {
                            const { top, height } = calculatePosition(booking.start_time, booking.end_time);
                            return (
                              <button key={booking.id} onClick={() => setSelectedBooking(booking)} style={{ top: top + 40, height: height - 1 }} className={`absolute left-0.5 right-0.5 p-1 rounded border-l-2 text-left shadow-md text-white transition-all hover:z-20 overflow-hidden bg-indigo-600 border-indigo-700`}>
                                <div className="text-[8px] font-black uppercase leading-tight truncate">{getGuestName(booking.guest_id)}</div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'guests' && (
          <Card className="rounded-[2rem] border-slate-200/60 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <div className="relative w-full max-w-md">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input value={guestSearchTerm} onChange={e => setGuestSearchTerm(e.target.value)} placeholder="Search guests..." className="h-11 w-full pl-11 pr-4 rounded-xl border border-slate-200 font-bold text-xs" />
                  </div>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase">Guest Profile</th>
                              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase text-right">Actions</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {filteredGuests.map(g => (
                              <tr key={g.id} onClick={() => setSelectedGuestForHistory(g)} className="hover:bg-indigo-50/30 transition-colors group cursor-pointer">
                                  <td className="px-8 py-5 font-black text-slate-900 uppercase">{g.name}</td>
                                  <td className="px-8 py-5 text-right" onClick={e => e.stopPropagation()}>
                                      <div className="flex justify-end gap-1">
                                        {canEdit && <button onClick={() => setEditingGuest(g)} className="p-2 text-slate-400 hover:text-indigo-600"><Edit3 className="w-4 h-4" /></button>}
                                        {canDelete && <button onClick={() => setItemToDelete({ id: g.id, type: 'guest', name: g.name })} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>}
                                      </div>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </Card>
      )}

      {activeTab === 'treatments' && canManageResources && (
          <Card className="rounded-[2rem] border-slate-200/60 shadow-xl overflow-hidden">
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-black uppercase">{isEditingResource ? 'Modify Treatment' : 'Service Portfolio'}</h3>
                    <div className="flex gap-2">
                        <Input value={newType.name} onChange={e => setNewType({...newType, name: e.target.value})} placeholder="Service Name" className="h-10 text-xs w-48" />
                        <Input type="number" value={newType.price} onChange={e => setNewType({...newType, price: parseFloat(e.target.value) || 0})} placeholder="Fee" className="h-10 text-xs w-24" />
                        <Button onClick={handleSaveMassageType} className="h-10 text-[10px] uppercase font-black">{isEditingResource ? 'Sync' : 'Add'}</Button>
                        {isEditingResource && <Button variant="secondary" onClick={() => { setIsEditingResource(false); setNewType({ id:'', name:'', price:0, duration_minutes:60 }); }} className="h-10 px-3"><X className="w-4 h-4"/></Button>}
                    </div>
                </div>
                <table className="w-full text-left">
                    <tbody className="divide-y divide-slate-100">
                        {massageTypes.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50 group">
                                <td className="py-4 font-black uppercase text-xs">{t.name} <span className="ml-2 opacity-30">({t.duration_minutes}m)</span></td>
                                <td className="py-4 text-right">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setIsEditingResource(true); setNewType(t); }} className="p-2 text-slate-300 hover:text-indigo-600"><Edit3 className="w-4 h-4"/></button>
                                        <button onClick={() => setItemToDelete({id: t.id, type: 'treatment', name: t.name})} className="p-2 text-slate-300 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              </div>
          </Card>
      )}

      {activeTab === 'therapists' && canManageResources && (
          <Card className="rounded-[2rem] border-slate-200/60 shadow-xl overflow-hidden">
              <div className="p-8 space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-sm font-black uppercase">{isEditingResource ? 'Modify Staff Profile' : 'Specialist Roster'}</h3>
                    <div className="flex gap-2">
                        <Input value={newTherapist.name} onChange={e => setNewTherapist({...newTherapist, name: e.target.value})} placeholder="Name" className="h-10 text-xs w-48" />
                        <Button onClick={handleSaveTherapist} className="h-10 text-[10px] uppercase font-black">{isEditingResource ? 'Sync' : 'Onboard'}</Button>
                        {isEditingResource && <Button variant="secondary" onClick={() => { setIsEditingResource(false); setNewTherapist({ id:'', name:'', specialty:'', country:'' }); }} className="h-10 px-3"><X className="w-4 h-4"/></Button>}
                    </div>
                </div>
                <table className="w-full text-left">
                    <tbody className="divide-y divide-slate-100">
                        {therapists.map(t => (
                            <tr key={t.id} className="hover:bg-slate-50 group">
                                <td className="py-4 font-black uppercase text-xs">{t.name}</td>
                                <td className="py-4 text-right">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => { setIsEditingResource(true); setNewTherapist(t); }} className="p-2 text-slate-300 hover:text-indigo-600"><Edit3 className="w-4 h-4"/></button>
                                        <button onClick={() => setItemToDelete({id: t.id, type: 'therapist', name: t.name})} className="p-2 text-slate-300 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
              </div>
          </Card>
      )}

      {selectedBooking && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <Card className="w-full max-w-md rounded-[2rem] border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <CardHeader className="bg-indigo-600 text-white p-6">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-xl font-black uppercase">{getGuestName(selectedBooking.guest_id)}</CardTitle>
                        <button onClick={() => setSelectedBooking(null)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-5 h-5"/></button>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="flex flex-col gap-3">
                        {selectedBooking.status === 'confirmed' && canEdit && (
                            <>
                                <button onClick={() => handleUpdateStatus(selectedBooking.id, 'completed')} className="w-full h-11 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg"><CheckCircle className="w-4 h-4" /> Served</button>
                                <button onClick={() => { setEditingBooking(selectedBooking); setShowBookingForm(true); setSelectedBooking(null); }} className="w-full h-11 rounded-xl border-2 border-indigo-100 text-indigo-600 font-black text-[10px] uppercase flex items-center justify-center gap-2"><Settings2 className="w-4 h-4" /> Reschedule / Modify</button>
                                <button onClick={() => handleUpdateStatus(selectedBooking.id, 'no-show')} className="w-full h-11 rounded-xl border-2 border-slate-200 text-slate-600 font-black text-[10px] uppercase flex items-center justify-center gap-2"><UserX className="w-4 h-4" /> No-Show</button>
                            </>
                        )}
                        {canDelete && (
                            <button onClick={() => handleUpdateStatus(selectedBooking.id, 'cancelled')} className="w-full h-11 rounded-xl border-2 border-red-50 text-red-600 font-black text-[10px] uppercase flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> Cancel Session</button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
      )}

      {showBookingForm && (
          <BookingForm 
            onClose={() => { setShowBookingForm(false); setEditingBooking(null); }}
            onSuccess={() => { setShowBookingForm(false); setEditingBooking(null); loadData(); showStatus('Reservation synchronized.'); }}
            onGoToManagement={() => {}}
            therapists={therapists}
            massageTypes={massageTypes}
            existingBookings={bookings}
            guests={guests}
            initialBooking={editingBooking || undefined}
          />
      )}

      <ConfirmationModal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} onConfirm={handleDeleteConfirmed} title="Purge Record" description={`Permanently remove ${itemToDelete?.name}?`} confirmText="Confirm Removal" isDestructive={true} />
    </div>
  );
};

export default MassageScheduling;
