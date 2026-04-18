import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../services/supabase';
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
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Clock, 
  RefreshCcw, 
  Trash2, 
  Zap, 
  Users2, 
  ChevronLeft, 
  ChevronRight,
  UserX,
  CheckCircle,
  X,
  Edit3,
  Coins,
  UserPlus,
  ArrowLeft,
  History,
  Mail,
  Phone,
  Layers,
  CalendarClock,
  Settings2,
  User,
  ExternalLink,
  CalendarDays,
  RotateCcw,
  PlusCircle,
  Store,
  Building2,
  Filter,
  Globe,
  UserCheck,
  Terminal,
  ClipboardCheck,
  Database,
  ShieldAlert,
  MapPin,
  Tag,
  FileUp,
  Download,
  Printer,
  Timer,
  Circle,
  Briefcase,
  Stethoscope,
  CircleUser,
  LayoutGrid,
  Info,
  TrendingUp
} from 'lucide-react';
import { db } from '../services/mockSupabase';
import { 
  MassageBooking, 
  Guest, 
  Therapist, 
  MassageType,
  Sale,
  Member,
  InventoryItem,
  MassageRoom
} from '../types';
import { format, addDays } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import BookingForm from './BookingForm';
import { InventoryManager } from '../pages/Sales';
import { useNavigate } from 'react-router-dom';

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
  const [guestSales, setGuestSales] = useState<Sale[]>([]);
  const [viewingIdUrl, setViewingIdUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hoveredSlot, setHoveredSlot] = useState<{ therapistId?: string; roomId?: string; hour: number; quarter: number } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  useEffect(() => {
    db.getSales(guest.property_id, true).then(allSales => {
        setGuestSales((allSales as Sale[]).filter(s => s.guest_id === guest.id));
    });
  }, [guest.id, guest.property_id]);

  const guestBookings = useMemo(() => 
    bookings.filter(b => b.guest_id === guest.id)
  , [bookings, guest.id]);

  const unifiedHistory = useMemo(() => {
    const bookingsMapped = guestBookings.map(b => {
        const type = massageTypes.find(m => m.id === (b.massage_type_id || b.inventory_item_id));
        const therapist = therapists.find(t => t.id === b.therapist_id);
        return {
            id: b.id,
            date: b.date,
            time: `${b.start_time} - ${b.end_time}`,
            type: type?.name || 'Standard Service',
            staff: therapist?.name || '',
            price: Number(b.price),
            discount: Number(b.discount || 0),
            discount_reason: b.discount_reason,
            discount_id_url: b.discount_id_url,
            status: b.status,
            isBooking: true,
            sortDate: new Date(`${b.date}T${b.start_time}`)
        };
    });

    const salesMapped = guestSales.filter(s => !s.booking_id).map(s => {
        return {
            id: s.id,
            date: format(new Date(s.created_at), 'yyyy-MM-dd'),
            time: format(new Date(s.created_at), 'HH:mm'),
            type: s.item_name,
            staff: '', 
            price: Number(s.gross_amount),
            discount: Number(s.discount_amount),
            discount_reason: s.discount_reason,
            discount_id_url: s.discount_id_url,
            status: s.status,
            isBooking: false,
            sortDate: new Date(s.created_at)
        };
    });

    return [...bookingsMapped, ...salesMapped]
      .filter(item => {
        const searchString = `${item.type} ${item.staff} ${item.date}`.toLowerCase();
        const matchesSearch = searchString.includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());
  }, [guestBookings, guestSales, massageTypes, therapists, searchTerm, statusFilter]);

  const effectiveIdUrl = useMemo(() => {
    if (!selectedItemId) return null;
    const item = unifiedHistory.find(h => h.id === selectedItemId);
    return item?.discount_id_url || null;
  }, [selectedItemId, unifiedHistory]);

  const stats = useMemo(() => {
    const completedBookings = guestBookings.filter(b => b.status === 'completed');
    const independentSales = guestSales.filter(s => s.status === 'completed' && !s.booking_id);
    
    const serviceRevenue = completedBookings.reduce((sum, b) => sum + Number(b.price), 0);
    const saleRevenue = independentSales.reduce((sum, s) => sum + Number(s.net_amount), 0);
    
    return {
      visits: completedBookings.length + independentSales.length,
      ltv: serviceRevenue + saleRevenue
    };
  }, [guestBookings, guestSales]);

  // Removed inventoryFormState from here
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500">
      <button onClick={onBack} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors"><ArrowLeft className="w-4 h-4" /> Back to Ledger</button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden">
            <div className="h-20 bg-slate-900 w-full"></div>
            <CardContent className="p-8 text-center -mt-10">
              <div className="inline-flex p-1.5 bg-white rounded-3xl shadow-xl mb-4">
                <div className="w-24 h-24 bg-indigo-600 rounded-[1.8rem] flex items-center justify-center text-white text-3xl font-black">
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
                 {(guest.id_card_url || unifiedHistory.find(h => h.discount_id_url)?.discount_id_url) && (
                    <button 
                        onClick={() => setViewingIdUrl(effectiveIdUrl)}
                        disabled={!effectiveIdUrl}
                        className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl border transition-all duration-200 ${effectiveIdUrl ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-100 shadow-sm' : 'bg-slate-50 text-slate-400 border-slate-100 cursor-not-allowed opacity-60'}`}
                    >
                        <FileUp className="w-4 h-4" />
                        <span className="text-xs font-black uppercase tracking-widest">
                            {!selectedItemId ? 'Select service to view ID' : effectiveIdUrl ? 'View ID Card' : 'No ID for this service'}
                        </span>
                    </button>
                 )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4">
              <Card className="rounded-3xl border-slate-200/60 shadow-sm p-5 bg-emerald-50/30">
                 <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-1">Lifetime Value</p>
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
                      {unifiedHistory.length} Matches
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
                   <select 
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="h-10 px-3 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-wide cursor-pointer"
                   >
                       <option value="all">All Statuses</option>
                       <option value="completed">Completed</option>
                       <option value="confirmed">Confirmed</option>
                       <option value="cancelled">Cancelled</option>
                       <option value="no-show">No-Show</option>
                   </select>
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
                        {unifiedHistory.map(item => {
                            return (
                            <tr 
                                key={item.id} 
                                className={`hover:bg-indigo-50/30 transition-colors group cursor-pointer ${selectedItemId === item.id ? 'bg-indigo-50' : ''}`}
                                onClick={() => {
                                    setSelectedItemId(item.id);
                                }}
                            >
                                <td className="px-8 py-4">
                                    <div className="text-[11px] font-black text-slate-900">{format(new Date(item.date), 'dd MMM yyyy')}</div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase">{item.time}</div>
                                </td>
                                <td className="px-8 py-4">
                                    <div className="text-[11px] font-black text-indigo-600 uppercase tracking-tight">{item.type}</div>
                                    {(item.discount_reason || item.discount_id_url) && (
                                        <div className="mt-1 flex items-center gap-1 text-[8px] font-black text-indigo-500 italic uppercase tracking-tighter">
                                            {item.discount_reason && <><Tag className="w-2 h-2" /> {item.discount_reason}</>}
                                        </div>
                                    )}
                                </td>
                                <td className="px-8 py-4 text-right font-black text-slate-900">
                                    {formatMoney(Number(item.price))}
                                    {Number(item.discount) > 0 && (
                                        <div className="text-[8px] font-bold text-red-500 mt-0.5">
                                            -{formatMoney(Number(item.discount))} Discount
                                        </div>
                                    )}
                                </td>
                                <td className="px-8 py-4 text-center">
                                    <span className={`inline-flex px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border
                                        ${item.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 
                                        item.status === 'confirmed' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                                        item.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-100' : 
                                        'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                        {item.status}
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

      {viewingIdUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Supportive ID Document</h3>
                    <div className="flex items-center gap-2">
                        <Button 
                            onClick={() => {
                                const link = document.createElement('a');
                                link.href = viewingIdUrl;
                                link.download = `ID_Document_${new Date().getTime()}`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }} 
                            variant="outline" 
                            size="sm" 
                            className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                            <Download className="w-3.5 h-3.5 mr-2" /> Download
                        </Button>
                        <Button 
                            onClick={() => {
                                const printWindow = window.open('', '_blank');
                                if (printWindow) {
                                    printWindow.document.write(`
                                        <html>
                                            <head>
                                                <title>Print ID Document</title>
                                                <style>
                                                    body { margin: 0; display: flex; justify-content: center; align-items: center; background: white; min-height: 100vh; }
                                                    img { max-width: 100%; height: auto; }
                                                    @media print {
                                                        body { margin: 0; }
                                                        img { max-width: 100%; }
                                                    }
                                                </style>
                                            </head>
                                            <body onload="window.print(); window.close();">
                                                ${viewingIdUrl.startsWith('data:application/pdf') 
                                                    ? `<embed src="${viewingIdUrl}" type="application/pdf" width="100%" height="100%">`
                                                    : `<img src="${viewingIdUrl}" />`
                                                }
                                            </body>
                                        </html>
                                    `);
                                    printWindow.document.close();
                                }
                            }} 
                            variant="outline" 
                            size="sm" 
                            className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-indigo-100 text-indigo-600 hover:bg-indigo-50"
                        >
                            <Printer className="w-3.5 h-3.5 mr-2" /> Print
                        </Button>
                        <button onClick={() => setViewingIdUrl(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors ml-2">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>
                </div>
                <div className="p-6 overflow-auto flex items-center justify-center bg-slate-50">
                    {viewingIdUrl.startsWith('data:image') ? (
                        <img src={viewingIdUrl} alt="ID Document" className="max-w-full h-auto rounded-xl shadow-sm" />
                    ) : viewingIdUrl.startsWith('data:application/pdf') ? (
                        <iframe src={viewingIdUrl} className="w-full h-[60vh] rounded-xl shadow-sm border-0" title="ID Document PDF" />
                    ) : (
                        <div className="text-center p-8">
                            <p className="text-sm font-bold text-slate-600 mb-4">Document format not supported for direct preview.</p>
                            <a href={viewingIdUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors">
                                <ExternalLink className="w-4 h-4" /> Open in New Tab
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

// Simple cache implementation for bookings
const bookingCache: Map<string, { data: any; timestamp: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedData = (key: string) => {
  const cached = bookingCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
};

const setCachedData = (key: string, data: any) => {
  bookingCache.set(key, { data, timestamp: Date.now() });
};

const MassageScheduling = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentOutlet, currentProperty, formatMoney, hasPermission, outlets = [] } = useSettings();
  const [activeTab, setActiveTab] = useState<'bookings' | 'treatments' | 'therapists' | 'guests'>('bookings');
  const [treatmentType, setTreatmentType] = useState<'Massage' | 'Personal Training'>('Massage');
  const [viewDate, setViewDate] = useState(new Date());
  const [viewScope, setViewScope] = useState<'outlet' | 'property'>('outlet');
  const [viewMode, setViewMode] = useState<'therapists' | 'rooms'>('therapists');
  
  const [bookings, setBookings] = useState<MassageBooking[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [massageTypes, setMassageTypes] = useState<MassageType[]>([]);
  const [massageRooms, setMassageRooms] = useState<MassageRoom[]>([]);
  
  const filteredTreatments = useMemo(() => {
      return massageTypes.filter(mt => mt.category === treatmentType);
  }, [massageTypes, treatmentType]);
  
  const [showInventoryForm, setShowInventoryForm] = useState(false);
  const [editingInventoryItem, setEditingInventoryItem] = useState<InventoryItem | null>(null);
  const [inventoryFormData, setInventoryFormData] = useState<any>({
        name: '',
        category: 'Retail',
        price: 0,
        stock_quantity: 0,
        track_inventory: true
    });
  
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showMassageForm, setShowMassageForm] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<MassageBooking | null>(null);
  const [selectedGuestForHistory, setSelectedGuestForHistory] = useState<Guest | null>(null);
  const [editingBooking, setEditingBooking] = useState<MassageBooking | null>(null);
  const [therapistFilter, setTherapistFilter] = useState('');
  const [guestSearchTerm, setGuestSearchTerm] = useState('');
  const [isTableMissing, setIsTableMissing] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [completingBookingId, setCompletingBookingId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<MassageBooking['payment_method']>('cash');
  const [viewingIdUrl, setViewingIdUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hoveredSlot, setHoveredSlot] = useState<{ therapistId?: string; roomId?: string; hour: number; quarter: number } | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const inventoryFormState = useMemo(() => ({
      showForm: showInventoryForm,
      setShowForm: setShowInventoryForm,
      editingItem: editingInventoryItem,
      setEditingItem: setEditingInventoryItem,
      formData: inventoryFormData,
      setFormData: setInventoryFormData
  }), [showInventoryForm, setShowInventoryForm, editingInventoryItem, setEditingInventoryItem, inventoryFormData, setInventoryFormData]);

  const MissingBookingTablesPanel = () => (
    <Card className="max-w-4xl mx-auto rounded-[3rem] border-amber-200 bg-amber-50/30 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-amber-600 p-8 text-white flex items-center gap-6">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                <Database className="w-8 h-8" />
            </div>
            <div>
                <h2 className="text-2xl font-black uppercase tracking-tight">Schema Repair Required</h2>
                <p className="text-amber-100 font-bold text-sm">The booking system detected missing columns or tables in your Supabase database.</p>
            </div>
        </div>
        <CardContent className="p-10 space-y-8">
            {schemaError && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600">
                    <ShieldAlert className="w-5 h-5 mt-0.5" />
                    <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest">Detected Error:</p>
                        <p className="text-xs font-bold font-mono">{schemaError}</p>
                    </div>
                </div>
            )}

            <div className="flex items-start gap-4">
                <div className="p-3 bg-white rounded-xl shadow-sm border border-amber-100">
                    <Terminal className="w-5 h-5 text-amber-600" />
                </div>
                <div className="space-y-2">
                    <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Maintenance Mode v2 (Comprehensive)</h3>
                    <p className="text-slate-600 text-sm leading-relaxed font-medium">Please execute this script in your <span className="font-bold text-indigo-600">Supabase SQL Editor</span>. This will safely upgrade your tables without deleting existing data.</p>
                </div>
            </div>

            <div className="relative group">
                <pre className="bg-slate-950 text-indigo-300 p-8 rounded-3xl overflow-x-auto text-[11px] font-mono leading-relaxed shadow-inner border border-white/10">
{`-- 1. ADD MISSING COLUMNS TO EXISTING TABLES (SAFE REPAIR)
-- therapists
ALTER TABLE IF EXISTS public.therapists ADD COLUMN IF NOT EXISTS property_id TEXT;
ALTER TABLE IF EXISTS public.therapists ADD COLUMN IF NOT EXISTS outlet_id TEXT;

-- massage_types
ALTER TABLE IF EXISTS public.massage_types ADD COLUMN IF NOT EXISTS property_id TEXT;
ALTER TABLE IF EXISTS public.massage_types ADD COLUMN IF NOT EXISTS outlet_id TEXT;
ALTER TABLE IF EXISTS public.massage_types ADD COLUMN IF NOT EXISTS description TEXT;

-- inventory
ALTER TABLE IF EXISTS public.inventory ADD COLUMN IF NOT EXISTS property_id TEXT;
ALTER TABLE IF EXISTS public.inventory ADD COLUMN IF NOT EXISTS outlet_id TEXT;

-- staff
ALTER TABLE IF EXISTS public.staff ADD COLUMN IF NOT EXISTS outlet_id TEXT;
ALTER TABLE IF EXISTS public.staff ADD COLUMN IF NOT EXISTS is_eligible_for_incentives BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE IF EXISTS public.staff ADD COLUMN IF NOT EXISTS leave_start_date TEXT;
ALTER TABLE IF EXISTS public.staff ADD COLUMN IF NOT EXISTS leave_end_date TEXT;

-- massage_bookings
ALTER TABLE IF EXISTS public.massage_bookings ADD COLUMN IF NOT EXISTS property_id TEXT;
ALTER TABLE IF EXISTS public.massage_bookings ADD COLUMN IF NOT EXISTS outlet_id TEXT;
ALTER TABLE IF EXISTS public.massage_bookings ADD COLUMN IF NOT EXISTS inventory_item_id TEXT;
ALTER TABLE IF EXISTS public.massage_bookings ADD COLUMN IF NOT EXISTS room_id TEXT;
ALTER TABLE IF EXISTS public.massage_bookings ADD COLUMN IF NOT EXISTS discount_reason TEXT;
ALTER TABLE IF EXISTS public.massage_bookings ADD COLUMN IF NOT EXISTS discount_id_url TEXT;
ALTER TABLE IF EXISTS public.massage_bookings ADD COLUMN IF NOT EXISTS check_no TEXT;
ALTER TABLE IF EXISTS public.massage_bookings ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE IF EXISTS public.massage_bookings ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE IF EXISTS public.massage_bookings ADD COLUMN IF NOT EXISTS additional_service_ids JSONB DEFAULT '[]'::jsonb;

-- sales
ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS discount_reason TEXT;
ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS discount_id_url TEXT;
ALTER TABLE IF EXISTS public.sales ADD COLUMN IF NOT EXISTS booking_id UUID;

-- outlets
ALTER TABLE IF EXISTS public.outlets ADD COLUMN IF NOT EXISTS booking_enabled BOOLEAN DEFAULT true;
ALTER TABLE IF EXISTS public.outlets ADD COLUMN IF NOT EXISTS booking_start_time TEXT DEFAULT '08:00';
ALTER TABLE IF EXISTS public.outlets ADD COLUMN IF NOT EXISTS booking_end_time TEXT DEFAULT '22:00';

-- guests
ALTER TABLE IF EXISTS public.guests ADD COLUMN IF NOT EXISTS id_card_url TEXT;

-- 2. ENSURE TABLES EXIST (IF NEW INSTALLATION)
CREATE TABLE IF NOT EXISTS public.inventory (
    id TEXT PRIMARY KEY,
    property_id TEXT,
    outlet_id TEXT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price NUMERIC NOT NULL DEFAULT 0,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    track_inventory BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.therapists (
    id TEXT PRIMARY KEY,
    property_id TEXT,
    outlet_id TEXT,
    name TEXT NOT NULL,
    specialty TEXT,
    country TEXT
);

CREATE TABLE IF NOT EXISTS public.massage_types (
    id TEXT PRIMARY KEY,
    property_id TEXT,
    outlet_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    price NUMERIC NOT NULL DEFAULT 0,
    duration_minutes INTEGER NOT NULL DEFAULT 60
);

CREATE TABLE IF NOT EXISTS public.massage_bookings (
    id TEXT PRIMARY KEY,
    property_id TEXT,
    outlet_id TEXT,
    guest_id TEXT,
    therapist_id TEXT,
    room_id TEXT,
    massage_type_id TEXT,
    inventory_item_id TEXT,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    price NUMERIC NOT NULL,
    discount NUMERIC DEFAULT 0,
    discount_reason TEXT,
    discount_id_url TEXT,
    status TEXT DEFAULT 'confirmed',
    additional_service_ids JSONB DEFAULT '[]'::jsonb,
    payment_method TEXT,
    check_no TEXT,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RESET SECURITY POLICIES
ALTER TABLE public.therapists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.massage_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.massage_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, postgres;

-- 4. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';`}
                </pre>
            </div>
            <div className="flex gap-4">
                <Button onClick={() => window.location.reload()} className="h-12 px-8 rounded-xl font-black uppercase text-[10px] tracking-widest bg-amber-600 hover:bg-amber-700">
                    <RefreshCcw className="w-4 h-4 mr-2" /> Verify Schema Sync
                </Button>
            </div>
        </CardContent>
    </Card>
  );
  
  const [newType, setNewType] = useState<{ id: string, name: string, price: number, duration_minutes: number, description?: string }>({ id: '', name: '', price: 0, duration_minutes: 60, description: '' });
  const [newTherapist, setNewTherapist] = useState({ id: '', name: '', specialty: '', country: '', type: 'Therapist' });
  const [isEditingResource, setIsEditingResource] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{id: string, type: 'treatment' | 'therapist' | 'guest' | 'booking', name: string} | null>(null);

  const allowedOutletsInProperty = useMemo(() => {
    if (!currentProperty || !user || !outlets) return [];
    if (user.role_id?.toLowerCase() === 'admin') {
        return outlets.filter(o => o.property_id === currentProperty.id);
    }
    return outlets.filter(o => 
        o.property_id === currentProperty.id && 
        user.allowed_outlets?.includes(o.id)
    );
  }, [currentProperty, user, outlets]);

  const selectedBookingDetails = useMemo(() => {
      if (!selectedBooking) return null;
      const primaryService = massageTypes.find(mt => mt.id === (selectedBooking.massage_type_id || selectedBooking.inventory_item_id));
      const addServices = (selectedBooking.additional_service_ids || [])
          .map(id => massageTypes.find(mt => mt.id === id))
          .filter(Boolean);
      const therapist = therapists.find(t => t.id === selectedBooking.therapist_id);
      const guest = guests.find(g => g.id === selectedBooking.guest_id);
      return { primaryService, addServices, therapist, guest };
  }, [selectedBooking, massageTypes, therapists, guests]);

  // Permission Logic
  const canView = user && hasPermission(user.role_id, 'bookings:view');
  const canCreate = user && hasPermission(user.role_id, 'bookings:create');
  const canEdit = user && hasPermission(user.role_id, 'bookings:edit');
  const canDelete = user && hasPermission(user.role_id, 'bookings:delete');
  const canManageResources = user && hasPermission(user.role_id, 'bookings:manage_resources');
  
  // NEW: Strict Permission gating for scope switch and deletion
  const canSwitchScope = user && hasPermission(user.role_id, 'settings:view_properties') && allowedOutletsInProperty.length > 1;
  const [members, setMembers] = useState<Member[]>([]);
  const canDeleteGuests = user && hasPermission(user.role_id, 'members:delete');

  useEffect(() => {
    if (currentOutlet && currentOutlet.booking_enabled === false) {
      navigate('/');
    }
  }, [currentOutlet, navigate]);

  useEffect(() => {
    if (currentOutlet) loadData();
  }, [currentOutlet, viewDate, viewScope]);

  // Real-time synchronization subscription
  useEffect(() => {
    if (!currentOutlet || !currentProperty) return;

    const channel = supabase
      .channel('realtime-bookings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'massage_bookings' },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'therapists' },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'massage_types' },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'guests' },
        () => loadData()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory' },
        () => loadData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOutlet, currentProperty]);

  const loadData = async (retryCount = 0) => {
    if (!currentOutlet || !currentProperty) return;
    setLoading(true);
    setIsTableMissing(false);
    setSchemaError(null);
    
    const isProperty = viewScope === 'property';
    const scopeId = isProperty ? currentProperty.id : currentOutlet.id;
    const dateStr = format(viewDate, 'yyyy-MM-dd');
    
    // Try to load from cache first for immediate display
    const cacheKey = `bookings-data-${scopeId}-${isProperty}-${dateStr}`;
    const cached = getCachedData(cacheKey);
    if (cached) {
        setBookings(cached.bookings || []);
        setGuests(cached.guests || []);
        setTherapists((cached.therapists || []).sort((x: any, y: any) => x.name.localeCompare(y.name)));
        setMassageRooms(cached.rooms || []);
        setMassageTypes(cached.massageTypes || []);
        setMembers(cached.members || []);
        setLoading(false); // We have cached data, so we can stop showing "loading" state if any
    }

    try {
      let limitToIds: string[] | undefined = undefined;
      if (isProperty && user?.role_id?.toLowerCase() !== 'admin') {
          limitToIds = allowedOutletsInProperty.map(o => o.id);
      }
      
      // Fetch data in parallel but update state as they complete for faster perceived performance
      const fetchBookings = db.getMassageBookings(scopeId, isProperty, limitToIds).then(data => {
          setBookings(data || []);
          return data;
      });
      
      const fetchGuests = db.getGuests(currentProperty.id).then(data => {
          setGuests(data || []);
          return data;
      });
      
      const fetchTherapists = db.getTherapists(scopeId, isProperty, limitToIds).then(data => {
          const sorted = (data || []).sort((x, y) => x.name.localeCompare(y.name));
          setTherapists(sorted);
          return sorted;
      });
      
      const fetchMassageTypes = db.getMassageTypes(scopeId, isProperty, limitToIds);
      const fetchInventory = db.getInventory(scopeId, isProperty, limitToIds);
      
      const fetchRooms = db.getMassageRooms(isProperty ? undefined : currentOutlet.id, currentProperty.id).then(data => {
          setMassageRooms(data || []);
          return data;
      });
      
      const fetchMembers = db.getMembers(scopeId, isProperty, limitToIds).then(data => {
          setMembers(data || []);
          return data;
      });

      const [b, g, t, m, inv, rooms, mems] = await Promise.all([
          fetchBookings,
          fetchGuests,
          fetchTherapists,
          fetchMassageTypes,
          fetchInventory,
          fetchRooms,
          fetchMembers
      ]);

      const ptItems = (inv || []).filter(i => i.category === 'Personal Training').map(i => ({
          id: i.id,
          property_id: i.property_id,
          outlet_id: i.outlet_id,
          name: i.name,
          price: i.price,
          duration_minutes: 60,
          category: 'Personal Training' as const
      }));
      
      const combinedTypes = [...(m || []).map(mt => ({...mt, category: 'Massage'})), ...ptItems];
      const sortedTypes = combinedTypes.sort((x, y) => (Number(x.duration_minutes) || 0) - (Number(y.duration_minutes) || 0));
      setMassageTypes(sortedTypes);

      // Update cache
      setCachedData(cacheKey, {
          bookings: b,
          guests: g,
          therapists: t,
          rooms: rooms,
          massageTypes: sortedTypes,
          members: mems
      });

    } catch (e: any) {
      console.error("Failed to load booking data", e);
      const errorMessage = e.message || "Unknown Database Error";
      
      // Distinguish between schema errors and network errors
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      const isNetworkError = isOffline || errorMessage.includes('Load failed') || errorMessage.includes('fetch') || errorMessage.includes('Connection Error');
      const isSchemaError = errorMessage.includes('schema cache') || e.code === '42P01' || e.code === '42703' || errorMessage.toLowerCase().includes('column') || (errorMessage.includes('Table [') && !isNetworkError);

      if (isSchemaError) {
          setSchemaError(errorMessage);
          setIsTableMissing(true);
      } else if (isNetworkError) {
          // Just log network errors, don't show blocking UI if we have any data (even if empty)
          console.warn("Network error during data load. Falling back to local/mock data.");
          if (isOffline) {
              setSchemaError("You are currently offline. Using cached/local data.");
          }
      } else {
          setSchemaError(errorMessage);
      }

    } finally {
      setLoading(false);
    }
  };

  // Scope-based Guest Filtering logic
  const guestsFilteredByScope = useMemo(() => {
      if (viewScope === 'property') return guests;
      // In Outlet View, only show guests who have at least one booking in this outlet
      return guests.filter(g => bookings.some(b => b.guest_id === g.id && b.outlet_id === currentOutlet?.id));
  }, [guests, bookings, viewScope, currentOutlet]);

  const handleUpdateStatus = async (id: string, status: MassageBooking['status'], roomId?: string, paymentMethod?: MassageBooking['payment_method']) => {
    if (!canEdit) return;
    try {
      await db.updateMassageBookingStatus(id, status, roomId, paymentMethod);
      setSelectedBooking(null);
      loadData();
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleSaveMassageType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProperty || !currentOutlet || !newType.name || !canManageResources) return;
    setIsSubmitting(true);
    setSaveError(null);
    try {
      if (isEditingResource && newType.id) {
          await db.updateMassageType(newType.id, { name: newType.name, price: newType.price, duration_minutes: newType.duration_minutes, description: newType.description });
      } else {
          await db.addMassageType({ ...newType, property_id: currentProperty.id, outlet_id: currentOutlet.id });
      }
      setNewType({ id: '', name: '', price: 0, duration_minutes: 60, description: '' });
      setIsEditingResource(false);
      loadData();
    } catch (err: any) {
        if (err.message?.includes('outlet_id') || err.code === '42703' || err.message?.toLowerCase().includes('column')) {
            setIsTableMissing(true);
        } else {
            setSaveError(err.message || "Sync failure.");
        }
    } finally { setIsSubmitting(false); }
  };

  const handleSaveTherapist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProperty || !currentOutlet || !newTherapist.name || !canManageResources) return;
    setIsSubmitting(true);
    setSaveError(null);
    try {
      if (isEditingResource && newTherapist.id) {
          await db.updateTherapist(newTherapist.id, { name: newTherapist.name, specialty: newTherapist.specialty, country: newTherapist.country, type: newTherapist.type });
      } else {
          await db.addTherapist({ ...newTherapist, property_id: currentProperty.id, outlet_id: currentOutlet.id });
      }
      setNewTherapist({ id: '', name: '', specialty: '', country: '', type: 'Therapist' });
      setIsEditingResource(false);
      loadData();
    } catch (err: any) {
        if (err.message?.includes('outlet_id') || err.code === '42703' || err.message?.toLowerCase().includes('column')) {
            setIsTableMissing(true);
        } else {
            setSaveError(err.message || "Sync failure.");
        }
    } finally { setIsSubmitting(false); }
  };

  const handleDeleteConfirmed = async () => {
      if (!itemToDelete) return;
      try {
          if (itemToDelete.type === 'treatment') await db.deleteMassageType(itemToDelete.id);
          else if (itemToDelete.type === 'therapist') await db.deleteTherapist(itemToDelete.id);
          else if (itemToDelete.type === 'guest') {
              if (canDeleteGuests) await db.deleteGuest(itemToDelete.id);
          }
          else if (itemToDelete.type === 'booking') {
              if (canDelete) await db.deleteMassageBooking(itemToDelete.id);
              setSelectedBooking(null);
          }
          loadData();
      } finally { setItemToDelete(null); }
  };

  const HOURS = useMemo(() => {
    if (!currentOutlet) return Array.from({ length: 15 }, (_, i) => i + 8);
    const startHour = currentOutlet.booking_start_time ? parseInt(currentOutlet.booking_start_time.split(':')[0]) : 8;
    const endHour = currentOutlet.booking_end_time ? parseInt(currentOutlet.booking_end_time.split(':')[0]) : 22;
    const length = Math.max(1, endHour - startHour + 1);
    return Array.from({ length }, (_, i) => i + startHour);
  }, [currentOutlet]);

  const calculatePosition = (startTime: string, endTime: string) => {
    const startHour = HOURS[0];
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    const top = ((sH - startHour) * 60 + sM) * MINUTE_HEIGHT;
    const duration = ((eH * 60 + eM) - (sH * 60 + sM));
    return { top, height: duration * MINUTE_HEIGHT };
  };

  const calculateCurrentTimePosition = () => {
    const now = currentTime;
    const hours = now.getHours();
    const minutes = now.getMinutes();
    
    if (hours < HOURS[0] || hours >= HOURS[HOURS.length - 1] + 1) return null;
    
    const totalMinutes = (hours - HOURS[0]) * 60 + minutes;
    return totalMinutes * MINUTE_HEIGHT;
  };

  const filteredTodayBookings = useMemo(() => {
    const dateStr = format(viewDate, 'yyyy-MM-dd');
    return bookings.filter(b => b.date === dateStr);
  }, [bookings, viewDate]);

  const getStatusStyles = (status: MassageBooking['status'], type?: string) => {
    const base = 'border-l-[6px] shadow-2xl transition-all hover:z-50 overflow-hidden group hover:scale-[1.04] hover:-translate-y-1 flex flex-col justify-between backdrop-blur-xl rounded-2xl border-white/20';
    
    // Advanced Gradients based on type
    const isConsultation = type?.toLowerCase().includes('consultation');
    const isTest = type?.toLowerCase().includes('test');
    const isFollowUp = type?.toLowerCase().includes('follow-up');
    
    switch (status) {
      case 'completed': 
        return `${base} bg-gradient-to-br from-emerald-500/95 via-emerald-600/90 to-teal-700/95 border-emerald-400/50 text-white shadow-emerald-500/30`;
      case 'no-show': 
        return `${base} bg-gradient-to-br from-rose-500/95 via-rose-600/90 to-pink-700/95 border-rose-400/50 text-white shadow-rose-500/30`;
      case 'cancelled': 
        return `${base} bg-slate-200/40 border-slate-400/30 text-slate-500 line-through italic shadow-none opacity-40 grayscale`;
      default: 
        if (isConsultation) return `${base} bg-gradient-to-br from-indigo-500/95 via-indigo-600/90 to-blue-700/95 border-indigo-400/50 text-white shadow-indigo-500/30`;
        if (isTest) return `${base} bg-gradient-to-br from-violet-500/95 via-violet-600/90 to-purple-700/95 border-violet-400/50 text-white shadow-violet-500/30`;
        if (isFollowUp) return `${base} bg-gradient-to-br from-cyan-500/95 via-cyan-600/90 to-sky-700/95 border-cyan-400/50 text-white shadow-cyan-500/30`;
        return `${base} bg-gradient-to-br from-slate-800/95 via-slate-900/90 to-black/95 border-slate-600/50 text-white shadow-slate-900/40`;
    }
  };

  if (!canView) return (
    <div className="flex items-center justify-center h-96">
        <Card className="max-w-md text-center p-8 rounded-[2rem] border-red-100 bg-red-50/30">
            <CalendarClock className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Access Restricted</h3>
            <p className="text-slate-500 mt-2 text-sm">Permission insufficient to view resource scheduling grid.</p>
        </Card>
    </div>
  );

  if (isTableMissing) {
      return (
          <div className="py-12 px-6">
              <MissingBookingTablesPanel />
          </div>
      );
  }

  if (selectedGuestForHistory) return (
    <GuestHistoryView 
      guest={selectedGuestForHistory} 
      bookings={bookings} 
      therapists={therapists} 
      massageTypes={massageTypes} 
      onBack={() => setSelectedGuestForHistory(null)}
      formatMoney={formatMoney}
    />
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-full">
      {schemaError && !isTableMissing && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center justify-between gap-4 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-3 text-red-700">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-[10px] font-black uppercase tracking-widest">Connection Interrupted</p>
              <p className="text-xs font-bold">{schemaError}</p>
            </div>
          </div>
          <Button onClick={() => loadData()} variant="secondary" className="h-9 px-4 rounded-xl text-[9px] font-black uppercase tracking-widest bg-white border-red-100 text-red-600 hover:bg-red-50 shrink-0">
            <RefreshCcw className="w-3.5 h-3.5 mr-2" /> Retry Connection
          </Button>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 glass p-8 rounded-[3rem] border border-slate-200/50 shadow-2xl shadow-indigo-500/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full -mr-32 -mt-32"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Resource Management</h1>
          <div className="flex flex-wrap items-center gap-4 mt-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2 bg-slate-100/50 px-3 py-1 rounded-full border border-slate-200/50">
                <Store className="w-3 h-3 text-indigo-500" /> {currentOutlet?.name}
              </p>
              {canSwitchScope && (
                <>
                  <div className="h-3 w-px bg-slate-200 hidden sm:block"></div>
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <button onClick={() => setViewScope('outlet')} className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all flex items-center gap-1.5 ${viewScope === 'outlet' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                          <Filter className="w-2.5 h-2.5" /> Outlet View
                      </button>
                      <button onClick={() => setViewScope('property')} className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all flex items-center gap-1.5 ${viewScope === 'property' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                          <Building2 className="w-2.5 h-2.5" /> Property View
                      </button>
                  </div>
                </>
              )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <div className="flex bg-[#e2e8f0]/40 p-1.5 rounded-2xl border border-slate-200/60 shadow-inner overflow-x-auto">
            <button onClick={() => { setActiveTab('bookings'); setSaveError(null); }} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'bookings' ? 'bg-white text-indigo-600 shadow-md border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}>Service Grid</button>
            <button onClick={() => { setActiveTab('guests'); setSaveError(null); }} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'guests' ? 'bg-white text-indigo-600 shadow-md border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}>Guest Ledger</button>
            <button onClick={() => { setActiveTab('treatments'); setSaveError(null); }} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'treatments' ? 'bg-white text-indigo-600 shadow-md border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}>Portfolio</button>
            <button onClick={() => { setActiveTab('therapists'); setSaveError(null); }} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'therapists' ? 'bg-white text-indigo-600 shadow-md border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}>Staffing</button>
          </div>
          {canCreate && currentOutlet?.booking_enabled !== false && (
              <Button onClick={() => { setEditingBooking(null); setShowBookingForm(true); }} className="h-12 px-8 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-100 ml-auto md:ml-0">
                <Plus className="w-5 h-5 mr-2" /> Add Booking
              </Button>
          )}
        </div>
      </div>

      {activeTab === 'bookings' && (
        <div className="space-y-4">
          {currentOutlet?.booking_enabled === false && (
            <div className="bg-amber-50 border border-amber-200 p-6 rounded-[2rem] flex items-start gap-4 animate-in fade-in">
              <ShieldAlert className="w-8 h-8 text-amber-600 shrink-0" />
              <div>
                <h3 className="text-lg font-black text-amber-900 uppercase tracking-tight">Booking Engine Disabled</h3>
                <p className="text-amber-700 text-sm mt-1">The booking engine is currently disabled for this outlet. You can view historical records but new bookings cannot be created.</p>
              </div>
            </div>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-[1.5rem] border border-slate-200 shadow-sm gap-4">
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
              <button onClick={() => setViewDate(addDays(viewDate, -1))} className="p-2 hover:bg-slate-50 rounded-xl border border-slate-100 transition-colors"><ChevronLeft className="w-5 h-5 text-slate-400"/></button>
              <div className="relative group">
                <input 
                  type="date" 
                  value={format(viewDate, 'yyyy-MM-dd')} 
                  onChange={(e) => {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    setViewDate(new Date(y, m - 1, d));
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer z-20"
                />
                <div className="flex flex-col items-center min-w-[180px] group-hover:bg-slate-50 p-2 rounded-xl transition-colors relative">
                  {loading && (
                    <div className="absolute -right-8 top-1/2 -translate-y-1/2">
                      <RefreshCcw className="w-4 h-4 text-indigo-600 animate-spin" />
                    </div>
                  )}
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                    {format(viewDate, 'EEEE')} <CalendarDays className="w-3 h-3" />
                  </span>
                  <span className="text-base font-black text-slate-900 tracking-tight">{format(viewDate, 'MMMM dd, yyyy')}</span>
                </div>
              </div>
              <button onClick={() => setViewDate(addDays(viewDate, 1))} className="p-2 hover:bg-slate-50 rounded-xl border border-slate-100 transition-colors"><ChevronRight className="w-5 h-5 text-slate-400"/></button>
            </div>
            
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setViewMode('therapists')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1.5 ${viewMode === 'therapists' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                      <Users2 className="w-3 h-3" /> Specialist Types
                  </button>
                  <button onClick={() => setViewMode('rooms')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1.5 ${viewMode === 'rooms' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                      <MapPin className="w-3 h-3" /> Rooms
                  </button>
              </div>
              <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input placeholder={viewMode === 'therapists' ? "Filter roster..." : "Filter rooms..."} value={therapistFilter} onChange={(e) => setTherapistFilter(e.target.value)} className="h-11 w-full pl-11 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold" />
              </div>
            </div>
          </div>

          <Card className="rounded-[3.5rem] border-slate-200/50 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] overflow-hidden glass relative">
            <div className="absolute inset-0 bg-dot-matrix opacity-[0.03] pointer-events-none"></div>
            <div className="overflow-x-auto custom-scrollbar relative z-10">
              <div className="min-w-[1000px] flex relative">
                <div className="w-24 shrink-0 border-r border-slate-200/50 bg-white/40 backdrop-blur-xl sticky left-0 z-40">
                    <div className="h-20 border-b border-slate-200/50 flex items-center justify-center bg-white/60 sticky top-0 z-50 shadow-sm">
                      <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
                        <Clock className="w-5 h-5 text-white animate-pulse-soft" />
                      </div>
                    </div>
                    {HOURS.map(hour => (
                        <div key={hour} style={{ height: SLOT_HEIGHT }} className={`relative border-b border-slate-100/50 flex items-center justify-center group transition-colors ${hour % 2 === 0 ? 'bg-slate-50/30' : 'bg-white/20'}`}>
                            <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-600 transition-all group-hover:scale-110">{hour > 12 ? `${hour-12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}</span>
                        </div>
                    ))}
                </div>
                <div className="flex flex-1 relative bg-slate-50/30">
                    {/* Current Time Indicator Line */}
                    {calculateCurrentTimePosition() !== null && format(viewDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && (
                        <div 
                            className="absolute left-0 right-0 z-50 pointer-events-none flex items-center"
                            style={{ top: calculateCurrentTimePosition()! + 80 }}
                        >
                            <div className="relative flex items-center justify-center">
                              <div className="absolute w-6 h-6 bg-red-500/30 rounded-full animate-ping"></div>
                              <div className="w-4 h-4 rounded-full bg-red-500 shadow-[0_0_20px_rgba(239,68,68,1)] -ml-2 border-2 border-white relative z-10"></div>
                            </div>
                            <div className="flex-1 h-[3px] bg-gradient-to-r from-red-500 via-red-400 to-transparent shadow-[0_0_20px_rgba(239,68,68,0.8)]"></div>
                            <div className="absolute right-4 bg-red-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-lg shadow-red-500/20 uppercase tracking-widest">Live</div>
                        </div>
                    )}
                    
                    {viewMode === 'therapists' ? (
                      <>
                        {therapists.filter(t => !therapistFilter || t.name.toLowerCase().includes(therapistFilter.toLowerCase())).map((therapist, idx) => {
                          const therapistBookings = filteredTodayBookings.filter(b => b.therapist_id === therapist.id);
                          return (
                            <div key={therapist.id} className={`flex-1 border-r border-slate-100/50 relative min-w-[220px] hover:bg-white/40 transition-all group ${idx % 2 === 0 ? 'bg-white/20' : 'bg-slate-50/5'}`}>
                              <div className="h-14 bg-white/90 backdrop-blur-md border-b border-slate-100 flex items-center justify-center sticky top-0 z-10 px-4 shadow-sm gap-3">
                                <div className="relative">
                                    <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-black text-xs shadow-lg shadow-indigo-500/20 transform -rotate-3">
                                        {therapist.name.charAt(0)}
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm animate-pulse-soft" title="Available"></div>
                                </div>
                                <div className="flex flex-col items-start min-w-0">
                                    <span className="text-[11px] font-black text-slate-900 uppercase truncate w-full tracking-tight flex items-center gap-1.5">
                                        {therapist.name}
                                        {therapist.type === 'Personal Trainer' ? <TrendingUp className="w-3 h-3 text-indigo-500" /> : <Briefcase className="w-3 h-3 text-indigo-500" />}
                                    </span>
                                    <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest truncate w-full">{therapist.type || 'Specialist Type'}</span>
                                </div>
                              </div>
                              {HOURS.map(hour => (
                                <div key={hour} style={{ height: SLOT_HEIGHT }} className="border-b border-slate-100 group hover:border-indigo-100 transition-colors relative">
                                    {/* 15-min sub-lines */}
                                    <div className="absolute top-1/4 left-0 right-0 h-px bg-slate-100/40 pointer-events-none"></div>
                                    <div className="absolute top-2/4 left-0 right-0 h-px bg-slate-100/60 pointer-events-none"></div>
                                    <div className="absolute top-3/4 left-0 right-0 h-px bg-slate-100/40 pointer-events-none"></div>
                                    
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="text-[8px] font-black text-slate-200 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Available Slot</span>
                                    </div>

                                    {/* Quick Add Hover Slots */}
                                    {[0, 1, 2, 3].map(quarter => (
                                        <div 
                                            key={quarter}
                                            className="absolute left-0 right-0 h-1/4 group/slot flex items-center justify-center"
                                            style={{ top: `${quarter * 25}%` }}
                                        >
                                            <div/>
                                            <motion.div 
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                whileHover={{ opacity: 1, scale: 1 }}
                                                className="opacity-0 group-hover/slot:opacity-100 transition-opacity bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg shadow-indigo-500/20 z-20"
                                            >
                                                <Plus className="w-2 h-2" /> Quick Add
                                            </motion.div>
                                        </div>
                                    ))}
                                </div>
                              ))}

                              {/* Ghost Booking Preview */}
                              {hoveredSlot?.therapistId === therapist.id && (
                                <div 
                                    className="absolute left-1.5 right-1.5 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 pointer-events-none z-10 flex flex-col items-center justify-center gap-1 overflow-hidden"
                                    style={{ 
                                        top: ((hoveredSlot.hour - HOURS[0]) * SLOT_HEIGHT) + (hoveredSlot.quarter * (SLOT_HEIGHT / 4)) + 56,
                                        height: SLOT_HEIGHT // Default 1 hour preview
                                    }}
                                >
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                                        <Plus className="w-3 h-3 text-indigo-400" />
                                    </div>
                                    <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">New Booking</span>
                                    <div className="absolute bottom-1 right-2 text-[6px] font-black text-indigo-300 uppercase">60 min</div>
                                </div>
                              )}
                              {therapistBookings.map(booking => {
                                const { top, height } = calculatePosition(booking.start_time, booking.end_time);
                                const type = massageTypes.find(m => m.id === (booking.massage_type_id || booking.inventory_item_id));
                                const room = massageRooms.find(r => r.id === booking.room_id);
                                const guest = guests.find(g => g.id === booking.guest_id);
                                return (
                                  <motion.button 
                                    key={booking.id} 
                                    onClick={() => setSelectedBooking(booking)} 
                                    style={{ top: top + 56, height: height - 2 }} 
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    whileHover={{ scale: 1.03, y: -4, zIndex: 50 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`absolute left-1.5 right-1.5 p-3 rounded-2xl ${getStatusStyles(booking.status, type?.name)}`}
                                  >
                                    <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-white/30 backdrop-blur-md flex items-center justify-center text-xs font-black shadow-lg border border-white/20">
                                            {guest?.name.charAt(0) || 'G'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[11px] font-black uppercase leading-tight truncate tracking-tight flex items-center gap-2">
                                                {guest?.name || 'Walk-in Guest'}
                                                {booking.status === 'completed' ? (
                                                    <div className="w-2 h-2 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)]"></div>
                                                ) : (
                                                    <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse"></div>
                                                )}
                                            </div>
                                            <div className="text-[9px] font-black opacity-90 uppercase tracking-widest mt-0.5 truncate flex items-center gap-1.5">
                                                <Zap className="w-2.5 h-2.5" /> {type?.name || 'Service'}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-white/10">
                                        <div className="flex items-center gap-2">
                                            <div className="px-2 py-0.5 rounded-lg bg-black/20 text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 backdrop-blur-sm">
                                                <Timer className="w-2.5 h-2.5" /> {type?.duration_minutes || 60}m
                                            </div>
                                            {room && (
                                                <div className="text-[8px] font-black opacity-90 uppercase tracking-widest flex items-center gap-1.5">
                                                    <MapPin className="w-2.5 h-2.5" /> {room.name}
                                                </div>
                                            )}
                                        </div>
                                        {height > 80 && (
                                            <div className="text-[8px] font-mono font-black opacity-70 uppercase tracking-widest">
                                                {booking.start_time}
                                            </div>
                                        )}
                                    </div>
                                  </motion.button>
                                );
                              })}
                            </div>
                          );
                        })}
                        {!loading && therapists.length === 0 && (
                            <div className="flex-1 p-12 text-center text-slate-400 uppercase text-[10px] font-black tracking-widest bg-white">
                                No active specialist types registered for this scope.
                            </div>
                        )}
                      </>
                    ) : (
                      <>
                        {massageRooms.filter(r => !therapistFilter || r.name.toLowerCase().includes(therapistFilter.toLowerCase())).map((room, idx) => {
                          const roomBookings = filteredTodayBookings.filter(b => b.room_id === room.id);
                          return (
                            <div key={room.id} className={`flex-1 border-r border-slate-100 relative min-w-[200px] hover:bg-white transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/10'}`}>
                              <div className="h-14 bg-white border-b border-slate-100 flex items-center justify-center sticky top-0 z-10 px-4 shadow-sm gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200 shadow-sm">
                                    <MapPin className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col items-start min-w-0">
                                    <span className="text-[10px] font-black text-slate-800 uppercase truncate w-full tracking-tight">{room.name}</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest truncate w-full">{room.number ? `Room ${room.number}` : 'Standard Room'}</span>
                                </div>
                              </div>
                              {HOURS.map(hour => (
                                <div key={hour} style={{ height: SLOT_HEIGHT }} className="border-b border-slate-100 group hover:border-indigo-100 transition-colors relative">
                                    {/* 15-min sub-lines */}
                                    <div className="absolute top-1/4 left-0 right-0 h-px bg-slate-100/40 pointer-events-none"></div>
                                    <div className="absolute top-2/4 left-0 right-0 h-px bg-slate-100/60 pointer-events-none"></div>
                                    <div className="absolute top-3/4 left-0 right-0 h-px bg-slate-100/40 pointer-events-none"></div>
                                    
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <span className="text-[8px] font-black text-slate-200 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Open Room</span>
                                    </div>

                                    {/* Quick Add Hover Slots */}
                                    {[0, 1, 2, 3].map(quarter => (
                                        <div 
                                            key={quarter}
                                            className="absolute left-0 right-0 h-1/4 group/slot cursor-pointer flex items-center justify-center"
                                            style={{ top: `${quarter * 25}%` }}
                                            onMouseEnter={() => setHoveredSlot({ roomId: room.id, hour, quarter })}
                                            onMouseLeave={() => setHoveredSlot(null)}
                                            onClick={() => {
                                                const startTime = `${hour.toString().padStart(2, '0')}:${(quarter * 15).toString().padStart(2, '0')}`;
                                                const endHour = quarter === 3 ? hour + 1 : hour;
                                                const endMin = quarter === 3 ? 0 : (quarter + 1) * 15;
                                                const endTime = `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
                                                setEditingBooking({
                                                    id: '',
                                                    property_id: currentProperty?.id || '',
                                                    outlet_id: currentOutlet?.id || '',
                                                    room_id: room.id,
                                                    date: format(viewDate, 'yyyy-MM-dd'),
                                                    start_time: startTime,
                                                    end_time: endTime,
                                                    status: 'confirmed',
                                                    price: 0,
                                                    guest_id: ''
                                                } as any);
                                                setShowBookingForm(true);
                                            }}
                                        >
                                            <motion.div 
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                whileHover={{ opacity: 1, scale: 1 }}
                                                className="opacity-0 group-hover/slot:opacity-100 transition-opacity bg-indigo-600 text-white px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg shadow-indigo-500/20 z-20"
                                            >
                                                <Plus className="w-2 h-2" /> Quick Add
                                            </motion.div>
                                        </div>
                                    ))}
                                </div>
                              ))}

                              {/* Ghost Booking Preview */}
                              {hoveredSlot?.roomId === room.id && (
                                <div 
                                    className="absolute left-1.5 right-1.5 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/30 pointer-events-none z-10 flex flex-col items-center justify-center gap-1 overflow-hidden"
                                    style={{ 
                                        top: ((hoveredSlot.hour - HOURS[0]) * SLOT_HEIGHT) + (hoveredSlot.quarter * (SLOT_HEIGHT / 4)) + 56,
                                        height: SLOT_HEIGHT // Default 1 hour preview
                                    }}
                                >
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                                        <Plus className="w-3 h-3 text-indigo-400" />
                                    </div>
                                    <span className="text-[7px] font-black text-indigo-400 uppercase tracking-widest">New Session</span>
                                    <div className="absolute bottom-1 right-2 text-[6px] font-black text-indigo-300 uppercase">60 min</div>
                                </div>
                              )}
                              {roomBookings.map(booking => {
                                const { top, height } = calculatePosition(booking.start_time, booking.end_time);
                                const type = massageTypes.find(m => m.id === (booking.massage_type_id || booking.inventory_item_id));
                                const therapist = therapists.find(t => t.id === booking.therapist_id);
                                const guest = guests.find(g => g.id === booking.guest_id);
                                return (
                                  <motion.button 
                                    key={booking.id} 
                                    onClick={() => setSelectedBooking(booking)} 
                                    style={{ top: top + 56, height: height - 2 }} 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    whileHover={{ scale: 1.02, y: -2 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`absolute left-1.5 right-1.5 p-3 rounded-xl ${getStatusStyles(booking.status, type?.name)}`}
                                  >
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center text-[10px] font-black shadow-inner border border-white/10">
                                            {guest?.name.charAt(0) || 'G'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-[10px] font-black uppercase leading-tight truncate tracking-tight flex items-center gap-1.5">
                                                {guest?.name || 'Walk-in Guest'}
                                                <div className={`w-1.5 h-1.5 rounded-full ${booking.status === 'completed' ? 'bg-emerald-300' : 'bg-white/60'}`}></div>
                                            </div>
                                            <div className="text-[8px] font-bold opacity-80 uppercase tracking-widest mt-0.5 truncate">{type?.name || 'Service'}</div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center justify-between mt-auto pt-2">
                                        <div className="flex items-center gap-2">
                                            <div className="px-1.5 py-0.5 rounded-md bg-black/10 text-[7px] font-black uppercase tracking-widest flex items-center gap-1">
                                                <Timer className="w-2 h-2" /> {type?.duration_minutes || 60}m
                                            </div>
                                            {therapist && (
                                                <div className="text-[7px] font-black opacity-80 uppercase tracking-widest flex items-center gap-1">
                                                    <Users2 className="w-2 h-2" /> {therapist.name}
                                                </div>
                                            )}
                                        </div>
                                        {height > 80 && (
                                            <div className="text-[7px] font-black opacity-60 uppercase tracking-widest">
                                                {booking.start_time} - {booking.end_time}
                                            </div>
                                        )}
                                    </div>
                                  </motion.button>
                                );
                              })}
                            </div>
                          );
                        })}
                        {!loading && massageRooms.length === 0 && (
                            <div className="flex-1 p-12 text-center text-slate-400 uppercase text-[10px] font-black tracking-widest bg-white">
                                No active rooms registered for this scope.
                            </div>
                        )}
                      </>
                    )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'guests' && (
        <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white animate-in slide-in-from-bottom-4">
            <CardHeader className="p-8 border-b bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><Users2 className="w-6 h-6"/></div>
                    <div>
                        <CardTitle className="text-xl font-black uppercase tracking-tight">Guest Registry</CardTitle>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            {viewScope === 'outlet' ? `Active bookings in ${currentOutlet?.name}` : 'Full Property Portfolio'}
                        </p>
                    </div>
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        placeholder="Search guests..." 
                        value={guestSearchTerm}
                        onChange={e => setGuestSearchTerm(e.target.value)}
                        className="h-12 w-full pl-11 pr-4 rounded-xl bg-white border border-slate-200 text-xs font-bold"
                    />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b">
                            <tr>
                                <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Profile</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Contact</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Registration</th>
                                <th className="px-8 py-5 text-right text-[10px] font-black uppercase text-slate-400 tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {guestsFilteredByScope.filter(g => g.name.toLowerCase().includes(guestSearchTerm.toLowerCase())).map(g => (
                                <tr key={g.id} className="hover:bg-indigo-50/20 group cursor-pointer" onClick={() => setSelectedGuestForHistory(g)}>
                                    <td className="px-8 py-6 flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-black text-indigo-600 text-xs">{g.name.charAt(0)}</div>
                                        <span className="font-black text-slate-900 uppercase text-sm">{g.name}</span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="text-xs font-bold text-slate-700">{g.phone}</div>
                                        <div className="text-[10px] text-slate-400">{g.email || 'No email registered'}</div>
                                    </td>
                                    <td className="px-8 py-6">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(new Date(g.created_at), 'dd MMM yyyy')}</span>
                                                {g.id_card_url && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); setViewingIdUrl(g.id_card_url!); }}
                                                        className="text-indigo-500 hover:text-indigo-700 transition-colors"
                                                        title="View Guest ID Card"
                                                    >
                                                        <FileUp className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                    </td>
                                    <td className="px-8 py-6 text-right" onClick={e => e.stopPropagation()}>
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setSelectedGuestForHistory(g)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><ExternalLink className="w-4 h-4"/></button>
                                            {canDeleteGuests && (
                                                <button onClick={() => setItemToDelete({id: g.id, type: 'guest', name: g.name})} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {guestsFilteredByScope.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-8 py-12 text-center text-slate-400 font-black uppercase text-[10px] tracking-[0.2em]">
                                        No matching guest records found for this scope.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
      )}

      {activeTab === 'treatments' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
            <InventoryManager 
                inventory={[]} 
                currentOutletId={currentOutlet?.id || ''}
                currentPropertyId={currentProperty?.id || ''}
                onRefresh={loadData}
                externalFormState={inventoryFormState}
            />
            <div className="grid grid-cols-1 gap-8">
                <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white h-fit">
                    <CardHeader className="p-8 border-b bg-slate-900 text-white relative">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-black uppercase tracking-widest flex items-center gap-3">
                                <Layers className="w-5 h-5 text-indigo-400" /> Treatment Master Catalog
                            </CardTitle>
                            <button 
                                onClick={() => {
                                    setIsEditingResource(false);
                                    setNewType({ id: '', name: '', price: 0, duration_minutes: 60, description: '' });
                                    setShowMassageForm(true);
                                }}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-500/20"
                            >
                                Provision New Treatment
                            </button>
                        </div>
                        <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 w-fit mt-4">
                            <button onClick={() => setTreatmentType('Massage')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${treatmentType === 'Massage' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Massage</button>
                            <button onClick={() => setTreatmentType('Personal Training')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${treatmentType === 'Personal Training' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Personal Training</button>
                        </div>
                        <p className="text-[9px] font-bold text-indigo-200 uppercase mt-2">Service Portfolio Management</p>
                    </CardHeader>
                    <CardContent className="p-0 max-h-[600px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                                <tr>
                                    <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-400">Service Name</th>
                                    <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-400 text-center">Duration</th>
                                    <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Base Price</th>
                                    <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Ops</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredTreatments.map(mt => (
                                    <tr key={mt.id} className="hover:bg-slate-50 group">
                                        <td className="px-8 py-5">
                                            <div className="font-black text-slate-800 text-sm uppercase">{mt.name}</div>
                                            {mt.description && <div className="text-[9px] font-bold text-slate-400 mt-0.5 line-clamp-1 max-w-[200px]">{mt.description}</div>}
                                        </td>
                                        <td className="px-8 py-5 text-center"><span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg border border-indigo-100">{mt.duration_minutes}m</span></td>
                                        <td className="px-8 py-5 text-right font-black text-slate-900 tabular-nums">{formatMoney(mt.price)}</td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex justify-end gap-2">
                                                {canManageResources && (
                                                    <>
                                                        <button onClick={() => { 
                                                          if (mt.category === 'Personal Training') {
                                                              const item = {
                                                                id: mt.id,
                                                                property_id: mt.property_id,
                                                                outlet_id: mt.outlet_id,
                                                                name: mt.name,
                                                                category: 'Personal Training' as any,
                                                                price: mt.price,
                                                                stock_quantity: 0, // Not available in MassageType
                                                                track_inventory: false,
                                                                created_at: ''
                                                              };
                                                              setEditingInventoryItem(item);
                                                              setShowInventoryForm(true);
                                                          } else {
                                                              setIsEditingResource(true); 
                                                              setNewType({
                                                                ...mt,
                                                                name: mt.name || '',
                                                                price: mt.price || 0,
                                                                duration_minutes: mt.duration_minutes || 60,
                                                                category: mt.category || 'Massage',
                                                                description: mt.description || ''
                                                              }); 
                                                              setShowMassageForm(true);
                                                              setSaveError(null); 
                                                          }
                                                        }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit3 className="w-3.5 h-3.5"/></button>
                                                        <button onClick={() => setItemToDelete({id: mt.id, type: 'treatment', name: mt.name})} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            </div>
        </div>
      )}

      {activeTab === 'therapists' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white h-fit">
                    <CardHeader className="p-8 border-b bg-slate-900 text-white relative">
                        <CardTitle className="text-lg font-black uppercase tracking-widest flex items-center gap-3">
                            <UserCheck className="w-5 h-5 text-indigo-400" /> Facility Specialist Types
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b">
                                    <tr>
                                        <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-400">Specialist Type Name</th>
                                        <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-400">Type</th>
                                        <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-400">Expertise</th>
                                        <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-400">Origin</th>
                                        <th className="px-8 py-4 text-right text-[9px] font-black uppercase text-slate-400">Ops</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {therapists.map(t => (
                                        <tr key={t.id} className="hover:bg-slate-50 group">
                                            <td className="px-8 py-5 font-black text-slate-800 text-sm uppercase">{t.name}</td>
                                            <td className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">{t.type || 'Therapist'}</td>
                                            <td className="px-8 py-5 text-xs font-bold text-indigo-600">{t.specialty}</td>
                                            <td className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t.country}</td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {canManageResources && (
                                                        <>
                                                            <button onClick={() => { 
                                                              setIsEditingResource(true); 
                                                              setNewTherapist({
                                                                ...t,
                                                                specialty: t.specialty || '',
                                                                country: t.country || '',
                                                                type: t.type || 'Therapist'
                                                              }); 
                                                              setSaveError(null); 
                                                            }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit3 className="w-3.5 h-3.5"/></button>
                                                            <button onClick={() => setItemToDelete({id: t.id, type: 'therapist', name: t.name})} className="p-2 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {!loading && therapists.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-8 py-10 text-center text-slate-400 uppercase text-[9px] font-bold">No specialist types enrolled.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {canManageResources && (
                    <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white h-fit">
                        <CardHeader className="p-8 border-b bg-indigo-600 text-white">
                            <CardTitle className="text-lg font-black uppercase tracking-widest">{isEditingResource ? 'Modify Profile' : 'Enroll Specialist Type'}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-10">
                            <form onSubmit={handleSaveTherapist} className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <Input label="Full Identity Name *" value={newTherapist.name} onChange={e => setNewTherapist({...newTherapist, name: e.target.value})} className="h-14 rounded-2xl font-bold" />
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Specialist Type</label>
                                        <Select value={newTherapist.type || 'Therapist'} onChange={e => setNewTherapist({...newTherapist, type: e.target.value})} className="h-14 rounded-2xl font-bold">
                                            <option value="Therapist">Therapist</option>
                                            <option value="Personal Trainer">Personal Trainer</option>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <Input label="Core Specialty" value={newTherapist.specialty} onChange={e => setNewTherapist({...newTherapist, specialty: e.target.value})} className="h-14 rounded-2xl" placeholder="e.g. Deep Tissue" />
                                    <Input label="Country of Origin" value={newTherapist.country} onChange={e => setNewTherapist({...newTherapist, country: e.target.value})} className="h-14 rounded-2xl" />
                                </div>
                                {saveError && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold uppercase flex items-center gap-2 animate-in shake duration-300"><ShieldAlert className="w-4 h-4"/> {saveError}</div>}
                                <div className="flex gap-4">
                                    {isEditingResource && <Button type="button" variant="secondary" onClick={() => { setIsEditingResource(false); setNewTherapist({id:'', name:'', specialty:'', country:'', type: 'Therapist'}); setSaveError(null); }} className="flex-1 h-14 rounded-2xl">Discard</Button>}
                                    <Button type="submit" isLoading={isSubmitting} className="flex-1 h-14 rounded-2xl font-black uppercase shadow-xl shadow-indigo-100">{isEditingResource ? 'Update Roster' : 'Register Specialist Type'}</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
      )}

      <AnimatePresence>
      {selectedBooking && selectedBookingDetails && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="w-full max-w-md"
            >
                <Card className="rounded-[2.5rem] border-slate-200 shadow-2xl overflow-hidden bg-white">
                <CardHeader className="bg-indigo-600 text-white p-6">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <CardTitle className="text-xl font-black uppercase tracking-tight">{selectedBookingDetails.guest?.name || 'Walk-in Guest'}</CardTitle>
                            <div className="flex items-center gap-2 text-[10px] font-black text-indigo-200 uppercase tracking-widest"><Phone className="w-3 h-3" /> {selectedBookingDetails.guest?.phone || '--'}</div>
                        </div>
                        <button onClick={() => setSelectedBooking(null)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-5 h-5"/></button>
                    </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="space-y-4 bg-slate-50 p-6 rounded-[2rem] border border-slate-100 text-xs">
                        <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-400 tracking-widest"><CalendarDays className="w-3 h-3" /> Date</div>
                                <div className="font-black text-slate-900 uppercase">{format(new Date(selectedBooking.date), 'dd MMM yyyy')}</div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-400 tracking-widest"><Clock className="w-3 h-3" /> Window</div>
                                <div className="font-black text-slate-900 uppercase">{selectedBooking.start_time} - {selectedBooking.end_time}</div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-3 text-[10px] font-black uppercase text-slate-500 tracking-widest"><Zap className="w-4 h-4 text-indigo-600" /> Primary Service</div>
                            <span className="font-black text-slate-900 uppercase">{selectedBookingDetails.primaryService?.name}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-3 text-[10px] font-black uppercase text-slate-500 tracking-widest"><User className="w-4 h-4 text-indigo-600" /> Specialist Type</div>
                            <span className="font-black text-slate-900 uppercase">{selectedBookingDetails.therapist?.name}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-[10px] font-black uppercase text-slate-500 tracking-widest"><Coins className="w-4 h-4 text-indigo-600" /> Investment</div>
                            <span className="text-base font-black text-indigo-600 tracking-tighter">{formatMoney(Number(selectedBooking.price))}</span>
                        </div>
                    </div>
                    <div className="flex flex-col gap-3">
                        {selectedBooking.status === 'confirmed' && canEdit && (
                            <>
                                {completingBookingId === selectedBooking.id ? (
                                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mt-2 space-y-3">
                                        <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest block">Confirm Room</label>
                                        <Select value={selectedRoomId} onChange={e => setSelectedRoomId(e.target.value)} className="h-11 rounded-xl font-bold text-xs">
                                            <option value="">Select Room</option>
                                            {massageRooms.filter(r => r.is_active || r.id === selectedBooking.room_id).map(r => (
                                                <option key={r.id} value={r.id}>{r.name} {r.number ? `(${r.number})` : ''}</option>
                                            ))}
                                        </Select>
                                        <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest block">Payment Method</label>
                                        <Select value={selectedPaymentMethod} onChange={e => setSelectedPaymentMethod(e.target.value as any)} className="h-11 rounded-xl font-bold text-xs">
                                            <option value="cash">Cash</option>
                                            <option value="card">Card</option>
                                            <option value="transfer">Bank Transfer</option>
                                        </Select>
                                        <div className="flex gap-2">
                                            <button onClick={() => setCompletingBookingId(null)} className="flex-1 h-11 rounded-xl border border-slate-200 text-slate-600 font-black text-[10px] uppercase hover:bg-slate-100 transition-colors">Cancel</button>
                                            <button onClick={() => { handleUpdateStatus(selectedBooking.id, 'completed', selectedRoomId, selectedPaymentMethod); setCompletingBookingId(null); }} className="flex-1 h-11 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase hover:bg-emerald-700 transition-colors">Confirm</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button onClick={() => { 
                                        setCompletingBookingId(selectedBooking.id); 
                                        setSelectedRoomId(selectedBooking.room_id || ''); 
                                        setSelectedPaymentMethod(selectedBooking.payment_method || 'cash');
                                    }} className="w-full h-11 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"><CheckCircle className="w-4 h-4" /> Served</button>
                                )}
                                <button onClick={() => { setEditingBooking(selectedBooking); setShowBookingForm(true); setSelectedBooking(null); }} className="w-full h-11 rounded-xl border-2 border-indigo-100 text-indigo-600 font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-indigo-50"><Settings2 className="w-4 h-4" /> Reschedule / Modify</button>
                                <button onClick={() => handleUpdateStatus(selectedBooking.id, 'no-show')} className="w-full h-11 rounded-xl border-2 border-slate-100 text-slate-600 font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-slate-50"><UserX className="w-4 h-4" /> No-Show</button>
                            </>
                        )}
                        {(selectedBooking.status === 'cancelled' || selectedBooking.status === 'no-show') && canEdit && (
                            <button onClick={() => { setEditingBooking(selectedBooking); setShowBookingForm(true); setSelectedBooking(null); }} className="w-full h-11 rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"><RotateCcw className="w-4 h-4" /> Restore & Modify Reservation</button>
                        )}
                        {selectedBooking.status === 'completed' && canEdit && (
                            <>
                                <button onClick={() => { setEditingBooking(selectedBooking); setShowBookingForm(true); setSelectedBooking(null); }} className="w-full h-11 rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"><Settings2 className="w-4 h-4" /> Modify Completed Booking</button>
                                <button onClick={() => { 
                                    const newBooking = { ...selectedBooking, id: undefined, status: 'confirmed', date: format(new Date(), 'yyyy-MM-dd') };
                                    setEditingBooking(newBooking as any); 
                                    setShowBookingForm(true); 
                                    setSelectedBooking(null); 
                                }} className="w-full h-11 rounded-xl border-2 border-indigo-100 text-indigo-600 font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-indigo-50"><PlusCircle className="w-4 h-4" /> New Session for Guest</button>
                            </>
                        )}
                        <div className="h-px bg-slate-100 my-1"></div>
                        <button onClick={() => { if (selectedBookingDetails.guest) { setSelectedGuestForHistory(selectedBookingDetails.guest); setSelectedBooking(null); } }} className="w-full h-11 rounded-xl bg-slate-900 text-white font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"><ExternalLink className="w-4 h-4" /> View Guest Profile & History</button>
                        {selectedBooking.status === 'confirmed' && canDelete && (
                            <button onClick={() => handleUpdateStatus(selectedBooking.id, 'cancelled')} className="w-full h-11 rounded-xl border-2 border-red-50 text-red-600 font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-red-50"><Trash2 className="w-4 h-4" /> Cancel Session</button>
                        )}
                        {canDelete && (
                            <button onClick={() => setItemToDelete({id: selectedBooking.id, type: 'booking', name: `Booking for ${selectedBookingDetails.guest?.name || 'Guest'}`})} className="w-full h-11 rounded-xl border-2 border-red-100 text-red-700 font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-red-50 mt-2"><Trash2 className="w-4 h-4" /> Delete Permanently</button>
                        )}
                    </div>
                </CardContent>
            </Card>
            </motion.div>
        </div>
      )}
      </AnimatePresence>

      {showBookingForm && (
          <BookingForm 
            onClose={() => { setShowBookingForm(false); setEditingBooking(null); }}
            onSuccess={() => { setShowBookingForm(false); setEditingBooking(null); loadData(); }}
            onGoToManagement={() => {}}
            therapists={therapists}
            massageTypes={massageTypes}
            existingBookings={bookings}
            guests={guests}
            members={members}
            massageRooms={massageRooms}
            initialBooking={editingBooking || undefined}
          />
      )}

      {showMassageForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <Card className="rounded-[2.5rem] border-slate-200/60 shadow-2xl overflow-hidden bg-white w-full max-w-2xl scale-100 animate-in zoom-in-95 duration-200">
                <CardHeader className="p-8 border-b bg-indigo-600 text-white flex flex-row items-center justify-between">
                    <CardTitle className="text-lg font-black uppercase tracking-widest">{isEditingResource ? 'Modify Treatment' : 'Provision New Treatment'}</CardTitle>
                    <button onClick={() => setShowMassageForm(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X className="w-5 h-5 text-white" /></button>
                </CardHeader>
                <CardContent className="p-10">
                    <form onSubmit={(e) => { handleSaveMassageType(e); setShowMassageForm(false); }} className="space-y-6">
                        <Input label="Service Designation *" value={newType.name} onChange={e => setNewType({...newType, name: e.target.value})} className="h-14 rounded-2xl font-bold" placeholder="e.g. Aromatherapy Session" />
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Inclusions / Description</label>
                            <textarea 
                                value={newType.description} 
                                onChange={e => setNewType({...newType, description: e.target.value})} 
                                className="w-full p-4 rounded-2xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-indigo-500/20 focus:outline-none min-h-[100px]" 
                                placeholder="List what is included in this treatment or package..."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <Input label="Duration (Min)" type="number" value={newType.duration_minutes} onChange={e => setNewType({...newType, duration_minutes: Number(e.target.value)})} className="h-14 rounded-2xl" />
                            <Input label="Retail Rate *" type="number" step="0.01" value={newType.price} onChange={e => setNewType({...newType, price: Number(e.target.value)})} className="h-14 rounded-2xl" />
                        </div>
                        {saveError && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-[10px] font-bold uppercase flex items-center gap-2 animate-in shake duration-300"><ShieldAlert className="w-4 h-4"/> {saveError}</div>}
                        <div className="flex gap-4">
                            <Button type="button" variant="secondary" onClick={() => setShowMassageForm(false)} className="flex-1 h-14 rounded-2xl">Discard</Button>
                            <Button type="submit" isLoading={isSubmitting} className="flex-1 h-14 rounded-2xl font-black uppercase shadow-xl shadow-indigo-100">{isEditingResource ? 'Update Portfolio' : 'Deploy Service'}</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
      )}

      <ConfirmationModal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} onConfirm={handleDeleteConfirmed} title="Purge Record" description={`Permanently remove ${itemToDelete?.name}?`} confirmText="Confirm Removal" isDestructive={true} />

      {viewingIdUrl && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-slate-100">
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Supportive ID Document</h3>
                    <div className="flex items-center gap-2">
                        <Button 
                            onClick={() => {
                                const link = document.createElement('a');
                                link.href = viewingIdUrl;
                                link.download = `ID_Document_${new Date().getTime()}`;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }} 
                            variant="outline" 
                            size="sm" 
                            className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                            <Download className="w-3.5 h-3.5 mr-2" /> Download
                        </Button>
                        <Button 
                            onClick={() => {
                                const printWindow = window.open('', '_blank');
                                if (printWindow) {
                                    printWindow.document.write(`
                                        <html>
                                            <head>
                                                <title>Print ID Document</title>
                                                <style>
                                                    body { margin: 0; display: flex; justify-content: center; align-items: center; background: white; min-height: 100vh; }
                                                    img { max-width: 100%; height: auto; }
                                                    @media print {
                                                        body { margin: 0; }
                                                        img { max-width: 100%; }
                                                    }
                                                </style>
                                            </head>
                                            <body onload="window.print(); window.close();">
                                                ${viewingIdUrl.startsWith('data:application/pdf') 
                                                    ? `<embed src="${viewingIdUrl}" type="application/pdf" width="100%" height="100%">`
                                                    : `<img src="${viewingIdUrl}" />`
                                                }
                                            </body>
                                        </html>
                                    `);
                                    printWindow.document.close();
                                }
                            }} 
                            variant="outline" 
                            size="sm" 
                            className="h-9 px-4 text-[10px] font-black uppercase tracking-widest border-indigo-100 text-indigo-600 hover:bg-indigo-50"
                        >
                            <Printer className="w-3.5 h-3.5 mr-2" /> Print
                        </Button>
                        <button onClick={() => setViewingIdUrl(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors ml-2">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>
                </div>
                <div className="p-6 overflow-auto flex items-center justify-center bg-slate-50">
                    {viewingIdUrl.startsWith('data:image') ? (
                        <img src={viewingIdUrl} alt="ID Document" className="max-w-full h-auto rounded-xl shadow-sm" />
                    ) : viewingIdUrl.startsWith('data:application/pdf') ? (
                        <iframe src={viewingIdUrl} className="w-full h-[60vh] rounded-xl shadow-sm border-0" title="ID Document PDF" />
                    ) : (
                        <div className="text-center p-8">
                            <p className="text-sm font-bold text-slate-600 mb-4">Document format not supported for direct preview.</p>
                            <a href={viewingIdUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors">
                                <ExternalLink className="w-4 h-4" /> Open in New Tab
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default MassageScheduling;