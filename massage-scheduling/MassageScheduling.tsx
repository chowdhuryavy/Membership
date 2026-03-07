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
  ShieldAlert
} from 'lucide-react';
import { db } from '../services/mockSupabase';
import { 
  MassageBooking, 
  Guest, 
  Therapist, 
  MassageType,
  Sale,
  Member,
  InventoryItem
} from '../types';
import { format, addDays } from 'date-fns';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import BookingForm from './BookingForm';
import { InventoryManager } from '../pages/Sales';

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

  useEffect(() => {
    db.getSales(guest.property_id, true).then(allSales => {
        setGuestSales((allSales as Sale[]).filter(s => s.guest_id === guest.id));
    });
  }, [guest.id, guest.property_id]);

  const guestBookings = useMemo(() => 
    bookings.filter(b => b.guest_id === guest.id)
  , [bookings, guest.id]);

  const filteredBookings = useMemo(() => {
    return guestBookings
      .filter(b => {
        const type = massageTypes.find(m => m.id === (b.massage_type_id || b.inventory_item_id));
        const therapist = therapists.find(t => t.id === b.therapist_id);
        const searchString = `${type?.name || ''} ${therapist?.name || ''} ${b.date}`.toLowerCase();
        
        const matchesSearch = searchString.includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
        
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => `${b.date} ${b.start_time}`.localeCompare(`${a.date} ${a.start_time}`));
  }, [guestBookings, massageTypes, therapists, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const completedServices = guestBookings.filter(b => b.status === 'completed');
    const serviceRevenue = completedServices.reduce((sum, b) => sum + Number(b.price), 0);
    const saleRevenue = guestSales.filter(s => s.status === 'completed').reduce((sum, s) => sum + Number(s.net_amount), 0);
    
    return {
      visits: completedServices.length + guestSales.length,
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
                        {filteredBookings.map(b => {
                            const type = massageTypes.find(m => m.id === (b.massage_type_id || b.inventory_item_id));
                            return (
                            <tr key={b.id} className="hover:bg-indigo-50/30 transition-colors group">
                                <td className="px-8 py-4">
                                    <div className="text-[11px] font-black text-slate-900">{format(new Date(b.date), 'dd MMM yyyy')}</div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase">{b.start_time} - {b.end_time}</div>
                                </td>
                                <td className="px-8 py-4">
                                    <div className="text-[11px] font-black text-indigo-600 uppercase tracking-tight">{type?.name || 'Standard Service'}</div>
                                </td>
                                <td className="px-8 py-4 text-right font-black text-slate-900">{formatMoney(Number(b.price))}</td>
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
  const { currentOutlet, currentProperty, formatMoney, hasPermission, outlets = [] } = useSettings();
  const [activeTab, setActiveTab] = useState<'bookings' | 'treatments' | 'therapists' | 'guests'>('bookings');
  const [treatmentType, setTreatmentType] = useState<'Massage' | 'Personal Training'>('Massage');
  const [viewDate, setViewDate] = useState(new Date());
  const [viewScope, setViewScope] = useState<'outlet' | 'property'>('outlet');
  
  const [bookings, setBookings] = useState<MassageBooking[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [massageTypes, setMassageTypes] = useState<MassageType[]>([]);
  
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
  const [selectedBooking, setSelectedBooking] = useState<MassageBooking | null>(null);
  const [selectedGuestForHistory, setSelectedGuestForHistory] = useState<Guest | null>(null);
  const [editingBooking, setEditingBooking] = useState<MassageBooking | null>(null);
  const [therapistFilter, setTherapistFilter] = useState('');
  const [guestSearchTerm, setGuestSearchTerm] = useState('');
  const [isTableMissing, setIsTableMissing] = useState(false);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

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
                    <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Safe Repair Protocol v2 (Comprehensive)</h3>
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

-- outlets
ALTER TABLE IF EXISTS public.outlets ADD COLUMN IF NOT EXISTS booking_enabled BOOLEAN DEFAULT true;
ALTER TABLE IF EXISTS public.outlets ADD COLUMN IF NOT EXISTS booking_start_time TEXT DEFAULT '08:00';
ALTER TABLE IF EXISTS public.outlets ADD COLUMN IF NOT EXISTS booking_end_time TEXT DEFAULT '22:00';

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
    massage_type_id TEXT,
    inventory_item_id TEXT,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    price NUMERIC NOT NULL,
    discount NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'confirmed',
    additional_service_ids JSONB DEFAULT '[]'::jsonb,
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
  const canSwitchScope = user && (hasPermission(user.role_id, 'properties:view') || hasPermission(user.role_id, 'settings:view_properties')) && allowedOutletsInProperty.length > 1;
  const [members, setMembers] = useState<Member[]>([]);
  const canDeleteGuests = user && hasPermission(user.role_id, 'members:delete');

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
    try {
      const isProperty = viewScope === 'property';
      const scopeId = isProperty ? currentProperty.id : currentOutlet.id;
      
      let limitToIds: string[] | undefined = undefined;
      if (isProperty && user?.role_id?.toLowerCase() !== 'admin') {
          limitToIds = allowedOutletsInProperty.map(o => o.id);
      }
      
      const results = await Promise.allSettled([
        db.getMassageBookings(scopeId, isProperty, limitToIds),
        db.getGuests(currentProperty.id),
        db.getTherapists(scopeId, isProperty, limitToIds),
        db.getMassageTypes(scopeId, isProperty, limitToIds),
        db.getMembers(scopeId, isProperty, limitToIds),
        db.getInventory(scopeId, isProperty, limitToIds)
      ]);

      const errors = results
        .map((r, idx) => r.status === 'rejected' ? { name: ['Bookings', 'Guests', 'Therapists', 'Treatments', 'Members', 'Inventory'][idx], reason: r.reason } : null)
        .filter(Boolean);

      if (errors.length > 0) {
          const firstError = errors[0]!;
          console.error(`Data fetch failed for ${firstError.name}:`, firstError.reason);
          
          // If it's a network error and we haven't retried too much, try again
          if (retryCount < 2 && (firstError.reason?.message?.includes('Load failed') || firstError.reason?.message?.includes('fetch'))) {
              console.log(`Retrying data load (${retryCount + 1}/2)...`);
              setTimeout(() => loadData(retryCount + 1), 1000);
              return;
          }

          throw new Error(`Table [${firstError.name}] failed: ${firstError.reason?.message || 'Connection Error'}`);
      }

      const b = (results[0] as PromiseFulfilledResult<MassageBooking[]>).value || [];
      const g = (results[1] as PromiseFulfilledResult<Guest[]>).value || [];
      const t = (results[2] as PromiseFulfilledResult<Therapist[]>).value || [];
      const m = (results[3] as PromiseFulfilledResult<MassageType[]>).value || [];
      const mems = (results[4] as PromiseFulfilledResult<Member[]>).value || [];
      const inv = (results[5] as PromiseFulfilledResult<InventoryItem[]>).value || [];

      setBookings(b);
      setGuests(g);
      setTherapists(t.sort((x, y) => x.name.localeCompare(y.name)));
      
      const ptItems = inv.filter(i => i.category === 'Personal Training').map(i => ({
          id: i.id,
          property_id: i.property_id,
          outlet_id: i.outlet_id,
          name: i.name,
          price: i.price,
          duration_minutes: 60, // Default duration for PT sessions
          category: 'Personal Training' as const
      }));
      
      const combinedTypes = [...(m || []).map(mt => ({...mt, category: 'Massage'})), ...ptItems];
      setMassageTypes(combinedTypes.sort((x, y) => (Number(x.duration_minutes) || 0) - (Number(y.duration_minutes) || 0)));
      setMembers(mems || []);
    } catch (e: any) {
      console.error("Failed to load booking data", e);
      const errorMessage = e.message || "Unknown Database Error";
      setSchemaError(errorMessage);
      
      // Distinguish between schema errors and network errors
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      const isNetworkError = isOffline || errorMessage.includes('Load failed') || errorMessage.includes('fetch') || errorMessage.includes('Connection Error');
      const isSchemaError = errorMessage.includes('schema cache') || e.code === '42P01' || e.code === '42703' || errorMessage.toLowerCase().includes('column') || (errorMessage.includes('Table [') && !isNetworkError);

      if (isSchemaError) {
          setIsTableMissing(true);
      } else if (isNetworkError) {
          if (isOffline) {
              setSchemaError("You are currently offline. Please check your internet connection.");
          }
          console.warn("Network error detected. Please check your internet connection or Supabase project status.");
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

  const handleUpdateStatus = async (id: string, status: MassageBooking['status']) => {
    if (!canEdit) return;
    try {
      await db.updateMassageBookingStatus(id, status);
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

  const filteredTodayBookings = useMemo(() => {
    const dateStr = format(viewDate, 'yyyy-MM-dd');
    return bookings.filter(b => b.date === dateStr);
  }, [bookings, viewDate]);

  const getStatusStyles = (status: MassageBooking['status']) => {
    switch (status) {
      case 'completed': return 'bg-emerald-600 border-emerald-700 text-white shadow-emerald-100/50';
      case 'no-show': return 'bg-amber-500 border-amber-600 text-white shadow-amber-100/50';
      case 'cancelled': return 'bg-red-100 border-red-500 text-red-800 line-through italic shadow-none opacity-90';
      default: return 'bg-indigo-600 border-indigo-700 text-white shadow-indigo-100/50';
    }
  };

  if (!canView) return (
    <div className="flex items-center justify-center h-96">
        <Card className="max-w-md text-center p-8 rounded-[2rem] border-red-100 bg-red-50/30">
            <CalendarClock className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Access Restricted</h3>
            <p className="text-slate-500 mt-2 text-sm">Security clearance insufficient to view resource scheduling grid.</p>
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
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

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Resource Management</h1>
          <div className="flex flex-wrap items-center gap-4 mt-1">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Store className="w-3 h-3 text-indigo-400" /> {currentOutlet?.name}
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
                <Plus className="w-5 h-5 mr-2" /> Authorized Booking
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
              <div className="flex flex-col items-center min-w-[180px]">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{format(viewDate, 'EEEE')}</span>
                <span className="text-base font-black text-slate-900 tracking-tight">{format(viewDate, 'MMMM dd, yyyy')}</span>
              </div>
              <button onClick={() => setViewDate(addDays(viewDate, 1))} className="p-2 hover:bg-slate-50 rounded-xl border border-slate-100 transition-colors"><ChevronRight className="w-5 h-5 text-slate-400"/></button>
            </div>
            <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input placeholder="Filter roster..." value={therapistFilter} onChange={(e) => setTherapistFilter(e.target.value)} className="h-11 w-full pl-11 pr-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold" />
            </div>
          </div>

          <Card className="rounded-[2.5rem] border-slate-200/60 shadow-2xl overflow-hidden bg-white">
            <div className="overflow-x-auto custom-scrollbar">
              <div className="min-w-[1000px] flex relative">
                <div className="w-20 shrink-0 border-r border-slate-100 bg-slate-50/50 sticky left-0 z-20">
                    <div className="h-14 border-b border-slate-100 flex items-center justify-center bg-white sticky top-0 z-30 shadow-sm"><Clock className="w-5 h-5 text-indigo-400" /></div>
                    {HOURS.map(hour => (
                        <div key={hour} style={{ height: SLOT_HEIGHT }} className="relative border-b border-slate-50 flex items-center justify-center group hover:bg-indigo-50/30 transition-colors">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-600 transition-colors">{hour > 12 ? `${hour-12} PM` : hour === 12 ? '12 PM' : `${hour} AM`}</span>
                        </div>
                    ))}
                </div>
                <div className="flex flex-1 relative bg-slate-50/30">
                    {/* Current Time Indicator Line (Optional - can be added later with real-time updates) */}
                    
                    {therapists.filter(t => !therapistFilter || t.name.toLowerCase().includes(therapistFilter.toLowerCase())).map((therapist, idx) => {
                      const therapistBookings = filteredTodayBookings.filter(b => b.therapist_id === therapist.id);
                      return (
                        <div key={therapist.id} className={`flex-1 border-r border-slate-100 relative min-w-[180px] hover:bg-white transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                          <div className="h-14 bg-white border-b border-slate-100 flex flex-col items-center justify-center sticky top-0 z-10 px-2 shadow-sm">
                            <span className="text-xs font-black text-slate-800 uppercase truncate w-full text-center tracking-tight">{therapist.name}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate w-full text-center mt-0.5">{therapist.specialty || 'Specialist'}</span>
                          </div>
                          {HOURS.map(hour => <div key={hour} style={{ height: SLOT_HEIGHT }} className="border-b border-slate-100 group hover:border-indigo-100 transition-colors relative">
                              <div className="absolute inset-0 group-hover:bg-indigo-50/10 pointer-events-none"></div>
                          </div>)}
                          {therapistBookings.map(booking => {
                            const { top, height } = calculatePosition(booking.start_time, booking.end_time);
                            const type = massageTypes.find(m => m.id === (booking.massage_type_id || booking.inventory_item_id));
                            return (
                              <button 
                                key={booking.id} 
                                onClick={() => setSelectedBooking(booking)} 
                                style={{ top: top + 56, height: height - 2 }} 
                                className={`absolute left-1.5 right-1.5 p-2.5 rounded-xl border-l-[3px] text-left shadow-sm transition-all hover:z-20 overflow-hidden group hover:scale-[1.02] hover:shadow-md ${getStatusStyles(booking.status)}`}
                              >
                                <div className="flex flex-col h-full justify-between">
                                    <div>
                                        <div className="text-[10px] font-black uppercase leading-tight truncate tracking-tight">{guests.find(g => g.id === booking.guest_id)?.name || 'Guest'}</div>
                                        <div className="text-[9px] font-bold opacity-70 uppercase tracking-widest mt-0.5 truncate">{type?.name || 'Service'}</div>
                                    </div>
                                    {height > 40 && (
                                        <div className="text-[8px] font-black opacity-60 uppercase tracking-widest flex items-center gap-1">
                                            <Clock className="w-2.5 h-2.5" /> {booking.start_time} - {booking.end_time}
                                        </div>
                                    )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                    {therapists.length === 0 && (
                        <div className="flex-1 p-12 text-center text-slate-400 uppercase text-[10px] font-black tracking-widest bg-white">
                            No active specialists registered for this scope.
                        </div>
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
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(new Date(g.created_at), 'dd MMM yyyy')}</span>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white h-fit">
                    <CardHeader className="p-8 border-b bg-slate-900 text-white relative">
                        <div className="flex items-center justify-between gap-4">
                            <CardTitle className="text-lg font-black uppercase tracking-widest flex items-center gap-3">
                                <Layers className="w-5 h-5 text-indigo-400" /> Treatment Master Catalog
                            </CardTitle>
                            <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
                                <button onClick={() => setTreatmentType('Massage')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${treatmentType === 'Massage' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Massage</button>
                                <button onClick={() => setTreatmentType('Personal Training')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${treatmentType === 'Personal Training' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>Personal Training</button>
                            </div>
                        </div>
                        <p className="text-[9px] font-bold text-indigo-200 uppercase mt-4">Service Portfolio Management</p>
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

                {canManageResources && (
                    <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white h-fit">
                        <CardHeader className="p-8 border-b bg-indigo-600 text-white">
                            <CardTitle className="text-lg font-black uppercase tracking-widest">{isEditingResource ? 'Modify Treatment' : 'Provision New Treatment'}</CardTitle>
                        </CardHeader>
                        <CardContent className="p-10">
                            <form onSubmit={handleSaveMassageType} className="space-y-6">
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
                                    {isEditingResource && <Button type="button" variant="secondary" onClick={() => { setIsEditingResource(false); setNewType({id:'', name:'', price:0, duration_minutes:60}); setSaveError(null); }} className="flex-1 h-14 rounded-2xl">Discard</Button>}
                                    <Button type="submit" isLoading={isSubmitting} className="flex-1 h-14 rounded-2xl font-black uppercase shadow-xl shadow-indigo-100">{isEditingResource ? 'Update Portfolio' : 'Deploy Service'}</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
      )}

      {activeTab === 'therapists' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white h-fit">
                    <CardHeader className="p-8 border-b bg-slate-900 text-white relative">
                        <CardTitle className="text-lg font-black uppercase tracking-widest flex items-center gap-3">
                            <UserCheck className="w-5 h-5 text-indigo-400" /> Facility Specialists
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 border-b">
                                    <tr>
                                        <th className="px-8 py-4 text-[9px] font-black uppercase text-slate-400">Specialist Name</th>
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
                                    {therapists.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-8 py-10 text-center text-slate-400 uppercase text-[9px] font-bold">No specialists enrolled.</td>
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
                            <CardTitle className="text-lg font-black uppercase tracking-widest">{isEditingResource ? 'Modify Profile' : 'Enroll Specialist'}</CardTitle>
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
                                    <Button type="submit" isLoading={isSubmitting} className="flex-1 h-14 rounded-2xl font-black uppercase shadow-xl shadow-indigo-100">{isEditingResource ? 'Update Roster' : 'Register Specialist'}</Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
      )}

      {selectedBooking && selectedBookingDetails && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <Card className="w-full max-w-md rounded-[2.5rem] border-slate-200 shadow-2xl overflow-hidden bg-white">
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
                            <div className="flex items-center gap-3 text-[10px] font-black uppercase text-slate-500 tracking-widest"><User className="w-4 h-4 text-indigo-600" /> Specialist</div>
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
                                <button onClick={() => handleUpdateStatus(selectedBooking.id, 'completed')} className="w-full h-11 rounded-xl bg-emerald-600 text-white font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"><CheckCircle className="w-4 h-4" /> Served</button>
                                <button onClick={() => { setEditingBooking(selectedBooking); setShowBookingForm(true); setSelectedBooking(null); }} className="w-full h-11 rounded-xl border-2 border-indigo-100 text-indigo-600 font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-indigo-50"><Settings2 className="w-4 h-4" /> Reschedule / Modify</button>
                                <button onClick={() => handleUpdateStatus(selectedBooking.id, 'no-show')} className="w-full h-11 rounded-xl border-2 border-slate-100 text-slate-600 font-black text-[10px] uppercase flex items-center justify-center gap-2 hover:bg-slate-50"><UserX className="w-4 h-4" /> No-Show</button>
                            </>
                        )}
                        {(selectedBooking.status === 'cancelled' || selectedBooking.status === 'no-show') && canEdit && (
                            <button onClick={() => { setEditingBooking(selectedBooking); setShowBookingForm(true); setSelectedBooking(null); }} className="w-full h-11 rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"><RotateCcw className="w-4 h-4" /> Restore & Modify Reservation</button>
                        )}
                        {selectedBooking.status === 'completed' && canEdit && (
                            <button onClick={() => { setEditingBooking(selectedBooking); setShowBookingForm(true); setSelectedBooking(null); }} className="w-full h-11 rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"><PlusCircle className="w-4 h-4" /> New Session for Guest</button>
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
        </div>
      )}

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
            initialBooking={editingBooking || undefined}
          />
      )}

      <ConfirmationModal isOpen={!!itemToDelete} onClose={() => setItemToDelete(null)} onConfirm={handleDeleteConfirmed} title="Purge Record" description={`Permanently remove ${itemToDelete?.name}?`} confirmText="Confirm Removal" isDestructive={true} />
    </div>
  );
};

export default MassageScheduling;