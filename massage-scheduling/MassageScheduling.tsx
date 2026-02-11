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
  LayoutGrid
} from 'lucide-react';
import { db } from '../services/mockSupabase';
import { 
  MassageBooking, 
  Guest, 
  Therapist, 
  MassageType 
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

  // Base list of guest bookings
  const guestBookings = useMemo(() => 
    bookings.filter(b => b.guest_id === guest.id)
  , [bookings, guest.id]);

  // Filtered and Sorted list
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

  // Grouping Logic
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
    const completed = guestBookings.filter(b => b.status === 'completed');
    const totalSpent = completed.reduce((sum, b) => sum + Number(b.price), 0);
    return {
      visits: completed.length,
      ltv: totalSpent,
      noShows: guestBookings.filter(b => b.status === 'no-show').length
    };
  }, [guestBookings]);

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
                 <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Lifetime Value</p>
                 <h4 className="text-lg font-black text-emerald-700">{formatMoney(stats.ltv)}</h4>
              </Card>
              <Card className="rounded-3xl border-slate-200/60 shadow-sm p-5 bg-indigo-50/30">
                 <p className="text-[8px] font-black text-indigo-600 uppercase tracking-widest mb-1">Total Visits</p>
                 <h4 className="text-lg font-black text-indigo-700">{stats.visits} Sessions</h4>
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
                       <div className="flex bg-white rounded-xl border border-slate-200 p-1">
                           <button 
                                onClick={() => setGroupBy('none')}
                                className={`px-3 rounded-lg text-[10px] font-black uppercase transition-all ${groupBy === 'none' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                           >
                               <LayoutGrid className="w-3.5 h-3.5" />
                           </button>
                           <button 
                                onClick={() => setGroupBy('month')}
                                className={`px-3 rounded-lg text-[10px] font-black uppercase transition-all ${groupBy === 'month' ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
                           >
                               <Calendar className="w-3.5 h-3.5" />
                           </button>
                       </div>
                   </div>
               </div>
            </CardHeader>
            
            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar">
              {Object.keys(groupedBookings).length === 0 ? (
                <div className="py-24 text-center">
                  <Zap className="w-10 h-10 text-slate-200 mx-auto mb-4" />
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">No booking records match your criteria.</p>
                </div>
              ) : (
                <div className="space-y-6">
                    {Object.entries(groupedBookings).map(([group, groupItems]: [string, MassageBooking[]]) => (
                        <div key={group}>
                            {groupBy === 'month' && (
                                <div className="px-8 py-3 bg-slate-50/50 border-y border-slate-100 flex items-center gap-2 sticky top-0 backdrop-blur-sm z-10">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{group}</span>
                                    <span className="text-[9px] font-bold text-slate-300 ml-auto">{groupItems.length} Events</span>
                                </div>
                            )}
                            <table className="w-full text-left">
                                {groupBy === 'none' && (
                                    <thead className="bg-slate-50/50 border-b border-slate-100 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Date / Time</th>
                                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Service Type</th>
                                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">Specialist</th>
                                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Fee</th>
                                            <th className="px-8 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                        </tr>
                                    </thead>
                                )}
                                <tbody className="divide-y divide-slate-50">
                                    {groupItems.map(b => {
                                        const type = massageTypes.find(m => m.id === b.massage_type_id);
                                        const therapist = therapists.find(t => t.id === b.therapist_id);
                                        const discount = b.discount || 0;
                                        const gross = b.price + discount;
                                        
                                        return (
                                        <tr key={b.id} className="hover:bg-indigo-50/30 transition-colors group">
                                            <td className="px-8 py-4">
                                                <div className="text-[11px] font-black text-slate-900">{format(new Date(b.date), 'dd MMM yyyy')}</div>
                                                <div className="text-[9px] font-bold text-slate-400 uppercase">{b.start_time} - {b.end_time}</div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="text-[11px] font-black text-indigo-600 uppercase tracking-tight">{type?.name || 'Standard Service'}</div>
                                                {(b.additional_service_ids?.length || 0) > 0 && (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <span className="text-[8px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-tighter">
                                                            +{b.additional_service_ids?.length} Add-on
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-8 py-4">
                                                <div className="text-[11px] font-black text-slate-700 uppercase">{therapist?.name || 'Staff'}</div>
                                            </td>
                                            <td className="px-8 py-4 text-right">
                                                <div className="text-[11px] font-black text-slate-900">{formatMoney(Number(b.price))}</div>
                                                {discount > 0 && (
                                                    <div className="text-[8px] font-bold text-red-400 line-through decoration-red-400/50">{formatMoney(gross)}</div>
                                                )}
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
                        </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const MassageScheduling = () => {
  const { user } = useAuth();
  const { currentProperty, formatMoney } = useSettings();
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
  
  const [newType, setNewType] = useState({ name: '', price: 0, duration_minutes: 60 });
  const [newTherapist, setNewTherapist] = useState({ name: '', specialty: '', country: '' });
  
  const [message, setMessage] = useState<{text: string, type: 'success' | 'error'} | null>(null);
  const [itemToDelete, setItemToDelete] = useState<{id: string, type: 'treatment' | 'therapist' | 'guest', name: string} | null>(null);

  const isAdmin = user?.role_id === 'admin';

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
      setTherapists(t || []);
      setMassageTypes(m || []);
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
      if (!editingGuest) return;
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

  const handleAddMassageType = async () => {
    if (!currentProperty || !newType.name) return;
    setIsSubmitting(true);
    try {
      await db.addMassageType({ ...newType, property_id: currentProperty.id });
      showStatus('Treatment added to portfolio.');
      setNewType({ name: '', price: 0, duration_minutes: 60 });
      loadData();
    } catch (e: any) {
      showStatus(e.message || 'Failed to save treatment.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTherapist = async () => {
    if (!currentProperty || !newTherapist.name) return;
    setIsSubmitting(true);
    try {
      await db.addTherapist({ ...newTherapist, property_id: currentProperty.id });
      showStatus('Therapist onboarded successfully.');
      setNewTherapist({ name: '', specialty: '', country: '' });
      loadData();
    } catch (e: any) {
      showStatus(e.message || 'Failed to onboard staff.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirmed = async () => {
      if (!itemToDelete) return;
      try {
          if (itemToDelete.type === 'treatment') await db.deleteMassageType(itemToDelete.id);
          else if (itemToDelete.type === 'therapist') await db.deleteTherapist(itemToDelete.id);
          else if (itemToDelete.type === 'guest') await db.deleteGuest(itemToDelete.id);
          
          showStatus(`${itemToDelete.type === 'guest' ? 'Guest record' : itemToDelete.type === 'treatment' ? 'Service' : 'Staff'} record removed.`);
          loadData();
      } catch (e: any) {
          showStatus(`Removal failed: ${e.message}`, 'error');
      } finally {
          setItemToDelete(null);
      }
  };

  const getGuestName = (id: string) => guests.find(g => g.id === id)?.name || 'Unknown Guest';
  const getMassageType = (id: string) => massageTypes.find(m => m.id === id);

  const getBookingColor = (typeId: string, status: string) => {
    if (status === 'no-show' || status === 'cancelled') return 'bg-slate-400 border-slate-500';
    const type = getMassageType(typeId);
    const name = type?.name.toLowerCase() || '';
    if (name.includes('swedish') || name.includes('balinese')) return 'bg-emerald-600 border-emerald-700';
    if (name.includes('deep') || name.includes('tissue')) return 'bg-indigo-600 border-indigo-700';
    if (name.includes('sports') || name.includes('rehab')) return 'bg-purple-600 border-purple-700';
    return 'bg-blue-600 border-blue-700';
  };

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

  const visibleTherapists = useMemo(() => {
      if (!therapistFilter) return therapists;
      return therapists.filter(t => t.name.toLowerCase().includes(therapistFilter.toLowerCase()));
  }, [therapists, therapistFilter]);

  const filteredGuests = useMemo(() => {
    if (!guestSearchTerm) return guests;
    const q = guestSearchTerm.toLowerCase();
    return guests.filter(g => 
      g.name.toLowerCase().includes(q) || 
      g.phone.includes(q) || 
      (g.email && g.email.toLowerCase().includes(q))
    );
  }, [guests, guestSearchTerm]);

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
            <button onClick={() => setActiveTab('bookings')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'bookings' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Service Grid</button>
            <button onClick={() => setActiveTab('guests')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'guests' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Guest Ledger</button>
            <button onClick={() => setActiveTab('treatments')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'treatments' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Portfolio</button>
            <button onClick={() => setActiveTab('therapists')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'therapists' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Staffing</button>
          </div>
          <Button onClick={() => { setEditingBooking(null); setShowBookingForm(true); }} className="h-10 px-6 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-100">
            <Plus className="w-4 h-4 mr-2" /> Authorized Booking
          </Button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border flex items-center gap-3 animate-in fade-in zoom-in duration-300 ${message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5"/> : <AlertTriangle className="w-5 h-5"/>}
          <span className="text-[10px] font-black uppercase tracking-widest">{message.text}</span>
        </div>
      )}

      {/* --- SERVICE GRID TAB --- */}
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
            
            <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                        placeholder="Filter specialists..."
                        value={therapistFilter}
                        onChange={(e) => setTherapistFilter(e.target.value)}
                        className="h-9 w-full pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                </div>
            </div>
          </div>

          <Card className="rounded-[1.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-slate-50">
            <div className="overflow-x-auto">
              <div className="min-w-[900px] flex">
                <div className="w-14 shrink-0 border-r border-slate-200 bg-white">
                    <div className="h-10 border-b border-slate-200 flex items-center justify-center">
                        <Clock className="w-3 h-3 text-slate-300" />
                    </div>
                    {HOURS.map(hour => (
                        <div key={hour} style={{ height: SLOT_HEIGHT }} className="relative">
                            <span className="absolute -top-2 left-0 right-0 text-center text-[8px] font-black text-slate-400">
                                {hour > 12 ? `${hour-12}P` : hour === 12 ? '12P' : `${hour}A`}
                            </span>
                            <div className="absolute inset-0 border-b border-slate-100/30"></div>
                        </div>
                    ))}
                </div>

                {therapists.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-40">
                    <Users2 className="w-10 h-10 text-slate-300 mb-4" />
                    <p className="text-slate-400 font-black uppercase text-[9px]">No staff on roster for this property</p>
                  </div>
                ) : (
                  <div className="flex flex-1">
                    {visibleTherapists.length === 0 ? (
                        <div className="w-full py-20 flex flex-col items-center justify-center text-center">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No specialists match filter</p>
                        </div>
                    ) : visibleTherapists.map(therapist => {
                      const therapistBookings = filteredTodayBookings.filter(b => b.therapist_id === therapist.id);
                      return (
                        <div key={therapist.id} className="flex-1 border-r border-slate-200 last:border-0 relative bg-white/50 min-w-[150px]">
                          <div className="h-10 bg-white border-b border-slate-200 flex flex-col items-center justify-center sticky top-0 z-10 shadow-sm px-1">
                            <span className="text-[9px] font-black text-slate-900 tracking-tight uppercase leading-none truncate w-full text-center">{therapist.name}</span>
                            <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-0.5">{therapist.country}</span>
                          </div>
                          {HOURS.map(hour => (
                             <div key={hour} style={{ height: SLOT_HEIGHT }} className="border-b border-slate-100/50"></div>
                          ))}
                          {therapistBookings.map(booking => {
                            const { top, height } = calculatePosition(booking.start_time, booking.end_time);
                            const type = getMassageType(booking.massage_type_id);
                            return (
                              <button
                                key={booking.id}
                                onClick={() => setSelectedBooking(booking)}
                                style={{ top: top + 40, height: height - 1 }}
                                className={`absolute left-0.5 right-0.5 p-1 rounded border-l-2 text-left shadow-md text-white transition-all hover:scale-[1.02] hover:z-20 group overflow-hidden ${getBookingColor(booking.massage_type_id, booking.status)}`}
                              >
                                <div className="flex justify-between items-start gap-1">
                                    <div className="text-[8px] font-black uppercase leading-tight truncate">{getGuestName(booking.guest_id)}</div>
                                    {booking.status === 'completed' && <CheckCircle className="w-2 h-2 text-emerald-300" />}
                                    {booking.status === 'no-show' && <UserX className="w-2 h-2 text-red-200" />}
                                </div>
                                <div className="text-[7px] font-bold opacity-80 uppercase truncate tracking-tighter mt-0.5">{type?.name}</div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* --- GUEST LEDGER TAB --- */}
      {activeTab === 'guests' && (
          <Card className="rounded-[2rem] border-slate-200/60 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <div className="relative w-full max-w-md">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        value={guestSearchTerm} 
                        onChange={e => setGuestSearchTerm(e.target.value)} 
                        placeholder="Search guests by name or phone..." 
                        className="h-11 w-full pl-11 pr-4 rounded-xl border border-slate-200 font-bold text-xs outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" 
                      />
                  </div>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-100">
                          <tr>
                              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Guest Profile</th>
                              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone</th>
                              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</th>
                              <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Registered</th>
                              {isAdmin && <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>}
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                          {filteredGuests.length === 0 ? (
                            <tr>
                              <td colSpan={isAdmin ? 5 : 4} className="px-8 py-20 text-center">
                                <div className="flex flex-col items-center gap-2">
                                  <Users2 className="w-8 h-8 text-slate-200" />
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No guest identities discovered.</p>
                                </div>
                              </td>
                            </tr>
                          ) : filteredGuests.map(g => (
                              <tr 
                                key={g.id} 
                                onClick={() => setSelectedGuestForHistory(g)}
                                className="hover:bg-indigo-50/30 transition-colors group cursor-pointer"
                              >
                                  <td className="px-8 py-5">
                                      <div className="flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center font-black text-xs transition-colors">{g.name.charAt(0)}</div>
                                          <span className="font-black text-slate-900 tracking-tight uppercase">{g.name}</span>
                                      </div>
                                  </td>
                                  <td className="px-8 py-5 text-slate-600 font-bold text-xs">{g.phone}</td>
                                  <td className="px-8 py-5 text-indigo-600 font-bold text-xs">{g.email || '--'}</td>
                                  <td className="px-8 py-5 text-center text-slate-400 font-bold text-[10px] uppercase tracking-tighter">{format(new Date(g.created_at), 'dd MMM yyyy')}</td>
                                  {isAdmin && (
                                    <td className="px-8 py-5 text-right" onClick={e => e.stopPropagation()}>
                                      <div className="flex justify-end gap-1">
                                        <button 
                                          onClick={() => setEditingGuest(g)}
                                          className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                        >
                                          <Edit3 className="w-4 h-4" />
                                        </button>
                                        <button 
                                          onClick={() => setItemToDelete({ id: g.id, type: 'guest', name: g.name })}
                                          className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  )}
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </Card>
      )}

      {/* --- PORTFOLIO TAB --- */}
      {activeTab === 'treatments' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                  <Card className="rounded-[2rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                      <CardHeader className="bg-slate-50 p-6 border-b border-slate-100">
                          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                              <Zap className="w-4 h-4 text-indigo-600" /> Authorized Treatments
                          </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                          <div className="overflow-x-auto">
                              <table className="w-full text-left">
                                  <thead className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">
                                      <tr>
                                          <th className="px-8 py-4">Service</th>
                                          <th className="px-8 py-4">Duration</th>
                                          <th className="px-8 py-4">Base Fee</th>
                                          <th className="px-8 py-4 text-right">Action</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                      {massageTypes.map(t => (
                                          <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                              <td className="px-8 py-5 font-black text-slate-900 tracking-tight text-xs uppercase">{t.name}</td>
                                              <td className="px-8 py-5 font-bold text-slate-500 text-xs">{t.duration_minutes} Minutes</td>
                                              <td className="px-8 py-5 font-black text-indigo-600 text-xs">{formatMoney(t.price)}</td>
                                              <td className="px-8 py-5 text-right">
                                                  <button onClick={() => setItemToDelete({id: t.id, type: 'treatment', name: t.name})} className="p-2 text-slate-300 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4"/></button>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </CardContent>
                  </Card>
              </div>
              <div>
                  <Card className="rounded-[2rem] border-slate-200/60 shadow-xl h-fit">
                      <CardHeader className="bg-indigo-600 text-white p-6">
                          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                              <Plus className="w-4 h-4" /> New Service Tier
                          </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                          <Input label="Treatment Designation" value={newType.name} onChange={e => setNewType({...newType, name: e.target.value})} className="h-12 rounded-xl text-xs" placeholder="e.g. Deep Tissue" />
                          <div className="grid grid-cols-2 gap-4">
                              <Input label="Fee" type="number" value={newType.price} onChange={e => setNewType({...newType, price: parseFloat(e.target.value)})} className="h-12 rounded-xl text-xs" />
                              <Input label="Mins" type="number" value={newType.duration_minutes} onChange={e => setNewType({...newType, duration_minutes: parseInt(e.target.value)})} className="h-12 rounded-xl text-xs" />
                          </div>
                          <Button onClick={handleAddMassageType} isLoading={isSubmitting} className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-100">Commit to Portfolio</Button>
                      </CardContent>
                  </Card>
              </div>
          </div>
      )}

      {/* --- STAFFING TAB --- */}
      {activeTab === 'therapists' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                  <Card className="rounded-[2rem] border-slate-200/60 shadow-xl overflow-hidden h-fit">
                      <CardHeader className="bg-slate-50 p-6 border-b border-slate-100">
                          <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                              <Users2 className="w-4 h-4 text-indigo-600" /> Specialist Roster
                          </CardTitle>
                      </CardHeader>
                      <CardContent className="p-0">
                          <div className="overflow-x-auto">
                              <table className="w-full text-left">
                                  <thead className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b">
                                      <tr>
                                          <th className="px-8 py-4">Specialist</th>
                                          <th className="px-8 py-4">Focus</th>
                                          <th className="px-8 py-4">Origin</th>
                                          <th className="px-8 py-4 text-right">Action</th>
                                      </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-50">
                                      {therapists.map(t => (
                                          <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                              <td className="px-8 py-5">
                                                  <div className="flex items-center gap-3">
                                                      <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-black text-[10px]">{t.name.charAt(0)}</div>
                                                      <span className="font-black text-slate-900 tracking-tight text-xs uppercase">{t.name}</span>
                                                  </div>
                                              </td>
                                              <td className="px-8 py-5 font-bold text-slate-500 text-xs">{t.specialty}</td>
                                              <td className="px-8 py-5 font-black text-indigo-600 text-[10px] uppercase tracking-widest">{t.country}</td>
                                              <td className="px-8 py-5 text-right">
                                                  <button onClick={() => setItemToDelete({id: t.id, type: 'therapist', name: t.name})} className="p-2 text-slate-300 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4"/></button>
                                              </td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </CardContent>
                  </Card>
              </div>
              <div>
                  <Card className="rounded-[2rem] border-slate-200/60 shadow-xl h-fit">
                      <CardHeader className="bg-slate-900 text-white p-6">
                          <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                              <UserPlus className="w-4 h-4" /> Specialist Onboarding
                          </CardTitle>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                          <Input label="Full Name" value={newTherapist.name} onChange={e => setNewTherapist({...newTherapist, name: e.target.value})} className="h-12 rounded-xl text-xs" placeholder="e.g. Elena Petrova" />
                          <Input label="Core Specialty" value={newTherapist.specialty} onChange={e => setNewTherapist({...newTherapist, specialty: e.target.value})} className="h-12 rounded-xl text-xs" placeholder="e.g. Sports Therapy" />
                          <Input label="Country of Origin" value={newTherapist.country} onChange={e => setNewTherapist({...newTherapist, country: e.target.value})} className="h-12 rounded-xl text-xs" placeholder="e.g. Russia" />
                          <Button onClick={handleAddTherapist} isLoading={isSubmitting} className="w-full h-12 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-indigo-100">Authorize Staffing</Button>
                      </CardContent>
                  </Card>
              </div>
          </div>
      )}

      {/* --- MODALS & DETAILS --- */}
      {selectedBooking && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <Card className="w-full max-w-md rounded-[2rem] border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <CardHeader className={`${getBookingColor(selectedBooking.massage_type_id, selectedBooking.status)} text-white p-6`}>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-xl font-black tracking-tight">{getGuestName(selectedBooking.guest_id)}</CardTitle>
                            <p className="text-[9px] font-black opacity-60 uppercase tracking-[0.2em] mt-1">Property Session Detail</p>
                        </div>
                        <button onClick={() => setSelectedBooking(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5"/></button>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1 col-span-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Services</span>
                            <div className="text-sm font-black text-slate-900 space-y-1">
                                {[selectedBooking.massage_type_id, ...(selectedBooking.additional_service_ids || [])]
                                    .map(id => getMassageType(id))
                                    .filter(Boolean)
                                    .map(type => (
                                        <p key={type!.id}>{type!.name}</p>
                                    ))
                                }
                            </div>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Therapist</span>
                            <p className="text-sm font-black text-slate-900">{therapists.find(t => t.id === selectedBooking.therapist_id)?.name}</p>
                        </div>
                        <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Time Slot</span>
                            <p className="text-sm font-black text-slate-900">{selectedBooking.start_time} - {selectedBooking.end_time}</p>
                        </div>
                    </div>
                    
                    <div className="pt-6 border-t border-slate-100 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Gross Price</span>
                            <span className="text-xs font-bold text-slate-500">{formatMoney(selectedBooking.price + (selectedBooking.discount || 0))}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Discount</span>
                            <span className="text-xs font-bold text-red-500">- {formatMoney(selectedBooking.discount || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center border-t border-dashed border-slate-200 pt-3 mt-3">
                            <span className="text-sm font-black text-slate-900 uppercase">Net Revenue</span>
                            <p className="text-lg font-black text-indigo-600">{formatMoney(selectedBooking.price)}</p>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100">
                        <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest mb-4 block">Lifecycle Management</span>
                        <div className="grid grid-cols-1 gap-3">
                            {selectedBooking.status === 'confirmed' && (
                                <>
                                    <button onClick={() => handleUpdateStatus(selectedBooking.id, 'completed')} className="w-full h-11 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all"><CheckCircle className="w-4 h-4" /> Guest Arrived & Served</button>
                                    <button onClick={() => handleUpdateStatus(selectedBooking.id, 'no-show')} className="w-full h-11 rounded-xl border-2 border-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-50 transition-all"><UserX className="w-4 h-4" /> Mark as No-Show</button>
                                </>
                            )}
                            <button onClick={() => handleUpdateStatus(selectedBooking.id, 'cancelled')} className="w-full h-11 rounded-xl border-2 border-red-50 text-red-600 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-50 transition-all"><Trash2 className="w-4 h-4" /> Cancel Booking</button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      )}

      {/* --- GUEST EDIT MODAL --- */}
      {editingGuest && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <Card className="w-full max-w-md rounded-[2rem] border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <CardHeader className="bg-slate-900 text-white p-6 relative">
              <CardTitle className="text-xl font-black tracking-tight uppercase">Modify Guest Identity</CardTitle>
              <button onClick={() => setEditingGuest(null)} className="absolute top-5 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><X className="w-5 h-5"/></button>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <form onSubmit={handleUpdateGuest} className="space-y-4">
                <Input 
                  label="Legal Name" 
                  value={editingGuest.name} 
                  onChange={e => setEditingGuest({...editingGuest, name: e.target.value})} 
                  className="h-12 rounded-xl"
                />
                <Input 
                  label="Phone Number" 
                  value={editingGuest.phone} 
                  onChange={e => setEditingGuest({...editingGuest, phone: e.target.value})} 
                  className="h-12 rounded-xl"
                />
                <Input 
                  label="Email Address" 
                  value={editingGuest.email || ''} 
                  onChange={e => setEditingGuest({...editingGuest, email: e.target.value})} 
                  className="h-12 rounded-xl"
                />
                <div className="flex gap-3 pt-4">
                  <Button type="button" variant="secondary" onClick={() => setEditingGuest(null)} className="flex-1 h-12 rounded-xl font-black text-[10px] uppercase tracking-widest">Discard</Button>
                  <Button type="submit" isLoading={isSubmitting} className="flex-1 h-12 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100">Commit Changes</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {showBookingForm && (
        <BookingForm 
          onClose={() => { setShowBookingForm(false); setEditingBooking(null); }} 
          onSuccess={() => { setShowBookingForm(false); loadData(); }}
          onGoToManagement={(tab) => { setActiveTab(tab); setShowBookingForm(false); }}
          therapists={therapists}
          massageTypes={massageTypes}
          existingBookings={bookings}
          guests={guests}
          initialBooking={editingBooking || undefined}
        />
      )}

      <ConfirmationModal 
          isOpen={!!itemToDelete}
          onClose={() => setItemToDelete(null)}
          onConfirm={handleDeleteConfirmed}
          title={`Revoke ${itemToDelete?.type === 'treatment' ? 'Service' : itemToDelete?.type === 'therapist' ? 'Staff' : 'Guest Identity'}`}
          description={`Are you sure you want to remove '${itemToDelete?.name}'? This action is permanent and will be logged in the audit trail.`}
          confirmText={`Confirm Removal`}
          isDestructive={true}
      />
    </div>
  );
};

export default MassageScheduling;