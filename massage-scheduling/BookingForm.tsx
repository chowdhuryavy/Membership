import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  Button, 
  Input, 
  Select 
} from '../components/ui';
import { 
  X, 
  User, 
  Phone, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  Globe,
  Users,
  Edit3,
  PlusCircle,
  MinusCircle,
  Search,
  UserPlus,
  Percent,
  Coins,
  Tag,
  FileUp,
  MapPin
} from 'lucide-react';
import { db } from '../services/mockSupabase';
import { 
  Therapist, 
  MassageType, 
  MassageBooking, 
  Guest,
  Member,
  MassageRoom
} from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { addMinutes, format } from 'date-fns';

interface BookingFormProps {
  onClose: () => void;
  onSuccess: () => void;
  onGoToManagement: (tab: 'treatments' | 'therapists' | 'guests') => void;
  therapists: Therapist[];
  massageTypes: MassageType[];
  existingBookings: MassageBooking[];
  guests: Guest[];
  members?: Member[];
  massageRooms?: MassageRoom[];
  initialBooking?: MassageBooking;
}

const BookingForm: React.FC<BookingFormProps> = ({ 
  onClose, 
  onSuccess, 
  onGoToManagement,
  therapists, 
  massageTypes, 
  existingBookings,
  guests,
  members = [],
  massageRooms = [],
  initialBooking
}) => {
  const { user } = useAuth();
  const { currentProperty, currentOutlet, formatMoney } = useSettings();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [guestData, setGuestData] = useState({ name: '', phone: '', email: '' });
  const [bookingData, setBookingData] = useState({
    massage_type_id: '',
    category: 'Massage' as 'Massage' | 'Personal Training',
    additional_service_ids: [] as string[],
    therapist_id: '',
    room_id: '',
    date: new Date().toISOString().split('T')[0],
    start_time: '10:00',
    end_time: '11:00',
    discount: 0,
    discount_mode: 'amount' as 'amount' | 'percent',
    discount_reason: '',
    discount_id_url: ''
  });

  const [showSuggestions, setShowSuggestions] = useState<'name' | 'phone' | null>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialBooking) {
      const guest = guests.find(g => g.id === initialBooking.guest_id);
      if (guest) setGuestData({ name: guest.name, phone: guest.phone, email: guest.email || '' });
      
      setBookingData({
        massage_type_id: initialBooking.massage_type_id || initialBooking.inventory_item_id || '',
        additional_service_ids: initialBooking.additional_service_ids || [],
        therapist_id: initialBooking.therapist_id,
        room_id: initialBooking.room_id || '',
        date: initialBooking.date,
        start_time: initialBooking.start_time,
        end_time: initialBooking.end_time,
        discount: initialBooking.discount || 0,
        discount_mode: 'amount', // Defaults to amount for editing existing
        discount_reason: initialBooking.discount_reason || '',
        discount_id_url: initialBooking.discount_id_url || ''
      });
    }
  }, [initialBooking, guests]);

  useEffect(() => {
    const primaryService = massageTypes.find(m => m.id === bookingData.massage_type_id);
    if (!primaryService || !bookingData.start_time) return;

    let totalDuration = primaryService.duration_minutes;

    bookingData.additional_service_ids.forEach(serviceId => {
        const service = massageTypes.find(m => m.id === serviceId);
        if (service) {
            totalDuration += service.duration_minutes;
        }
    });

    try {
        const [hours, minutes] = bookingData.start_time.split(':').map(Number);
        const startTimeDate = new Date();
        startTimeDate.setHours(hours, minutes, 0, 0);
        const endTimeDate = addMinutes(startTimeDate, totalDuration);
        setBookingData(prev => ({ ...prev, end_time: format(endTimeDate, 'HH:mm') }));
    } catch (e) {
        console.warn("Time calculation failed");
    }
  }, [bookingData.massage_type_id, bookingData.additional_service_ids, bookingData.start_time, massageTypes]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const guestSuggestions = useMemo(() => {
    const q = showSuggestions === 'name' ? guestData.name.toLowerCase() : guestData.phone;
    if (!q || q.length < 2) return [];
    
    // Combine guests and members for suggestions, avoiding duplicates by phone
    const combined: Guest[] = [...guests];
    members.forEach(m => {
        if (m.phone && !combined.some(c => c.phone === m.phone)) {
            combined.push({
                id: m.id,
                name: m.guest_name,
                phone: m.phone,
                email: m.email,
                property_id: m.property_id,
                created_at: m.created_at
            });
        }
    });

    return combined.filter(g => 
        showSuggestions === 'name' 
          ? g.name.toLowerCase().includes(q) 
          : g.phone.includes(q)
    ).slice(0, 5);
  }, [guests, members, guestData, showSuggestions]);

  const selectGuest = (guest: Guest) => {
    setGuestData({
      name: guest.name,
      phone: guest.phone,
      email: guest.email || ''
    });
    setShowSuggestions(null);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      setError('Only images and PDFs are allowed.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setBookingData(prev => ({ ...prev, discount_id_url: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const selectedServices = useMemo(() => {
    const ids = [bookingData.massage_type_id, ...bookingData.additional_service_ids].filter(Boolean);
    return ids.map(id => massageTypes.find(m => m.id === id)).filter(Boolean) as MassageType[];
  }, [bookingData.massage_type_id, bookingData.additional_service_ids, massageTypes]);

  const grossPrice = useMemo(() => selectedServices.reduce((acc, s) => acc + Number(s.price), 0), [selectedServices]);
  
  const calculatedDiscountValue = useMemo(() => {
    if (bookingData.discount_mode === 'percent') {
      return (grossPrice * (bookingData.discount || 0)) / 100;
    }
    return (bookingData.discount || 0);
  }, [grossPrice, bookingData.discount, bookingData.discount_mode]);

  const netPrice = useMemo(() => Math.max(0, grossPrice - calculatedDiscountValue), [grossPrice, calculatedDiscountValue]);

  const availableTherapists = useMemo(() => {
    return therapists.filter(t => {
      const isBooked = existingBookings.some(b => 
        b.id !== initialBooking?.id && b.therapist_id === t.id && b.date === bookingData.date && b.status !== 'cancelled' &&
        !(bookingData.end_time <= b.start_time || bookingData.start_time >= b.end_time)
      );
      return !isBooked;
    });
  }, [therapists, existingBookings, bookingData.date, bookingData.start_time, bookingData.end_time, initialBooking]);

  const availableRooms = useMemo(() => {
    return massageRooms.filter(r => {
      const isBooked = existingBookings.some(b => 
        b.id !== initialBooking?.id && b.room_id === r.id && b.date === bookingData.date && b.status !== 'cancelled' &&
        !(bookingData.end_time <= b.start_time || bookingData.start_time >= b.end_time)
      );
      return !isBooked && r.is_active;
    });
  }, [massageRooms, existingBookings, bookingData.date, bookingData.start_time, bookingData.end_time, initialBooking]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProperty || !currentOutlet || !bookingData.massage_type_id) {
       setError("Select a primary treatment.");
       return;
    }
    setError('');
    if (!guestData.name || !guestData.phone || !bookingData.therapist_id || !bookingData.room_id) {
      setError("Required fields: Name, Phone, Therapist Assignment, and Room.");
      return;
    }
    if (bookingData.discount > 0 && !bookingData.discount_reason) {
      setError("Please provide a reason for the discount.");
      return;
    }
    setLoading(true);
    try {
      const guest = await db.saveGuest({
        ...guestData,
        property_id: currentProperty.id,
        id_card_url: bookingData.discount_id_url || undefined
      });

      // Check for guest double booking
      const isGuestBooked = existingBookings.some(b => 
        b.id !== initialBooking?.id && 
        b.guest_id === guest.id && 
        b.date === bookingData.date && 
        b.status !== 'cancelled' &&
        !(bookingData.end_time <= b.start_time || bookingData.start_time >= b.end_time)
      );

      if (isGuestBooked) {
        setError("This guest already has another booking at this time.");
        setLoading(false);
        return;
      }

      if (currentOutlet) {
        const startHour = currentOutlet.booking_start_time || '08:00';
        const endHour = currentOutlet.booking_end_time || '22:00';
        if (bookingData.start_time < startHour || bookingData.end_time > endHour) {
            setError(`Booking must be within outlet operational hours (${startHour} - ${endHour}).`);
            setLoading(false);
            return;
        }
      }

      const payload: any = {
        guest_id: guest.id,
        therapist_id: bookingData.therapist_id,
        room_id: bookingData.room_id,
        date: bookingData.date,
        start_time: bookingData.start_time,
        end_time: bookingData.end_time,
        massage_type_id: bookingData.massage_type_id,
        additional_service_ids: bookingData.additional_service_ids.filter(Boolean),
        price: netPrice,
        discount: calculatedDiscountValue,
        discount_reason: bookingData.discount > 0 ? bookingData.discount_reason : null,
        discount_id_url: bookingData.discount > 0 ? bookingData.discount_id_url : null
      };

      if (initialBooking) { 
        payload.status = 'confirmed';
        await db.updateMassageBooking(initialBooking.id, payload); 
      } 
      else { 
        await db.addMassageBooking({ 
            ...payload, 
            property_id: currentProperty.id, 
            outlet_id: currentOutlet.id, 
            status: 'confirmed' 
        }); 
      }
      onSuccess();
    } catch (err: any) { 
        if (err.message?.includes('schema cache') || err.message?.includes('inventory_item_id') || err.message?.includes('room_id')) {
            setError("Database schema needs updating. Please close this form and refresh the page to see the required SQL script.");
        } else {
            setError(err.message || "Operation failed."); 
        }
    } 
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div className="w-full max-w-2xl relative my-8">
        <Card className="rounded-[2rem] border-slate-200/60 shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">
          <CardHeader className={`${initialBooking ? 'bg-indigo-900' : 'bg-indigo-600'} text-white p-6 relative`}>
            <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2 uppercase">
              {initialBooking ? 'Modify Session' : 'New Property Reservation'}
            </CardTitle>
            <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mt-1">Resource Yield Logic</p>
            <button onClick={onClose} className="absolute top-5 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><X className="w-4 h-4" /></button>
          </CardHeader>
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative" ref={suggestionRef}>
                    <div className="relative">
                        <Input 
                            label="Guest Name *" 
                            value={guestData.name} 
                            onChange={e => {setGuestData({...guestData, name: e.target.value}); setShowSuggestions('name');}} 
                            onFocus={() => setShowSuggestions('name')} 
                            autoComplete="off" 
                            className="h-11 rounded-xl text-xs font-bold" 
                            placeholder="Enter name..."
                        />
                        {showSuggestions === 'name' && guestSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl mt-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                {guestSuggestions.map(g => (
                                    <button 
                                        key={g.id} 
                                        type="button" 
                                        onClick={() => selectGuest(g)}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-indigo-50 border-b border-slate-50 last:border-0 transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-[10px]">{g.name.charAt(0)}</div>
                                        <div>
                                            <div className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{g.name}</div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{g.phone}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="relative">
                        <Input 
                            label="Phone Number *" 
                            value={guestData.phone} 
                            onChange={e => {setGuestData({...guestData, phone: e.target.value}); setShowSuggestions('phone');}} 
                            onFocus={() => setShowSuggestions('phone')} 
                            autoComplete="off" 
                            className="h-11 rounded-xl text-xs font-bold" 
                            placeholder="77xx xxxx"
                        />
                        {showSuggestions === 'phone' && guestSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl mt-1 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                                {guestSuggestions.map(g => (
                                    <button 
                                        key={g.id} 
                                        type="button" 
                                        onClick={() => selectGuest(g)}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-indigo-50 border-b border-slate-50 last:border-0 transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-[10px]">{g.name.charAt(0)}</div>
                                        <div>
                                            <div className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{g.name}</div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{g.phone}</div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-1">
                        <Select 
                            label="Category *" 
                            options={[
                                { value: 'Massage', label: 'Massage' },
                                { value: 'Personal Training', label: 'Personal Training' }
                            ]} 
                            value={bookingData.category} 
                            onChange={e => setBookingData({...bookingData, category: e.target.value as any, massage_type_id: ''})} 
                            className="h-11 rounded-xl text-xs" 
                        />
                    </div>
                    <div className="md:col-span-1">
                        <Select 
                            label="Primary Service *" 
                            options={[
                                { value: '', label: 'Select Item...' }, 
                                ...massageTypes
                                    .filter(m => m.category === bookingData.category)
                                    .map(m => ({ value: m.id, label: `${m.name} (${m.duration_minutes}m)` }))
                            ]} 
                            value={bookingData.massage_type_id} 
                            onChange={e => setBookingData({...bookingData, massage_type_id: e.target.value})} 
                            className="h-11 rounded-xl text-xs" 
                        />
                        {bookingData.massage_type_id && massageTypes.find(m => m.id === bookingData.massage_type_id)?.description && (
                            <div className="mt-2 p-3 bg-indigo-50 rounded-xl border border-indigo-100 animate-in fade-in slide-in-from-top-1 duration-300">
                                <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1">Inclusions</p>
                                <p className="text-[10px] font-bold text-slate-600 whitespace-pre-line">{massageTypes.find(m => m.id === bookingData.massage_type_id)?.description}</p>
                            </div>
                        )}
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Reduction Logic</label>
                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 h-11">
                            <button 
                                type="button"
                                onClick={() => setBookingData(prev => ({...prev, discount_mode: 'amount'}))}
                                className={`flex-1 rounded-lg text-[8px] font-black uppercase transition-all flex items-center justify-center gap-1 ${bookingData.discount_mode === 'amount' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400'}`}
                            >
                                <Coins className="w-2.5 h-2.5" /> Fixed
                            </button>
                            <button 
                                type="button"
                                onClick={() => setBookingData(prev => ({...prev, discount_mode: 'percent'}))}
                                className={`flex-1 rounded-lg text-[8px] font-black uppercase transition-all flex items-center justify-center gap-1 ${bookingData.discount_mode === 'percent' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400'}`}
                            >
                                <Percent className="w-2.5 h-2.5" /> %
                            </button>
                        </div>
                    </div>
                    <div>
                         <Input 
                            label={bookingData.discount_mode === 'amount' ? "Discount Amount" : "Reduction (%)"} 
                            type="number" 
                            value={bookingData.discount} 
                            onChange={e => setBookingData({...bookingData, discount: Number(e.target.value) || 0})}
                            className="h-11 rounded-xl text-xs font-bold" 
                            placeholder={bookingData.discount_mode === 'amount' ? "e.g. 50" : "e.g. 10"}
                        />
                    </div>
                    <div className="bg-slate-950 text-white px-4 py-2 rounded-xl flex items-center justify-between h-11 shadow-lg shadow-slate-200">
                        <span className="text-[7px] font-black opacity-60 uppercase tracking-widest">Total Fee</span>
                        <span className="text-xs font-black text-indigo-400 tracking-tighter">{formatMoney(netPrice)}</span>
                    </div>
                </div>

                {bookingData.discount > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Discount Reason *</label>
                            <div className="relative">
                                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="text"
                                    value={bookingData.discount_reason}
                                    onChange={e => setBookingData(prev => ({ ...prev, discount_reason: e.target.value }))}
                                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    placeholder="e.g. Corporate Partner, Special Promotion..."
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Supportive ID (Optional)</label>
                            <div className="relative">
                                <FileUp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input 
                                    type="file" 
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    id="booking-discount-id-upload"
                                    accept="image/*,.pdf"
                                />
                                <label 
                                    htmlFor="booking-discount-id-upload"
                                    className="flex items-center w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-xs font-bold cursor-pointer hover:bg-slate-50 transition-colors"
                                >
                                    {bookingData.discount_id_url ? (
                                        <span className="text-emerald-600 flex items-center gap-2">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Document Attached
                                        </span>
                                    ) : (
                                        <span className="text-slate-400">Upload ID or Authorization...</span>
                                    )}
                                </label>
                            </div>
                        </div>
                    </div>
                )}
                
                <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-200/50">
                    <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest ml-1">Follow-up Services</label>
                    {bookingData.additional_service_ids.map((id, index) => (
                        <div key={index} className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                            <Select 
                                options={[{ value: '', label: 'Select service...' }, ...massageTypes.map(m => ({ value: m.id, label: `${m.category ? `[${m.category}] ` : ''}${m.name} (${m.duration_minutes}m)` }))]}
                                value={id}
                                onChange={e => {
                                    const newIds = [...bookingData.additional_service_ids];
                                    newIds[index] = e.target.value;
                                    setBookingData({...bookingData, additional_service_ids: newIds});
                                }}
                                className="h-11 rounded-xl text-xs flex-1"
                            />
                            <Button type="button" variant="secondary" onClick={() => {
                                const newIds = bookingData.additional_service_ids.filter((_, i) => i !== index);
                                setBookingData({...bookingData, additional_service_ids: newIds});
                            }} className="h-11 w-11 p-0 rounded-xl bg-white border-slate-200">
                                <MinusCircle className="w-4 h-4 text-red-500" />
                            </Button>
                        </div>
                    ))}
                    <Button type="button" variant="outline" onClick={() => setBookingData({...bookingData, additional_service_ids: [...bookingData.additional_service_ids, '']})} className="w-full h-11 rounded-xl font-bold text-xs uppercase tracking-widest border-dashed border-slate-300 hover:border-indigo-500 hover:text-indigo-600 transition-all">
                        <PlusCircle className="w-4 h-4 mr-2" /> Add Follow-up
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label="Date" type="date" value={bookingData.date} onChange={e => setBookingData({...bookingData, date: e.target.value})} className="h-11 rounded-xl text-xs" />
                    <Input label="Start" type="time" value={bookingData.start_time} onChange={e => setBookingData({...bookingData, start_time: e.target.value})} className="h-11 rounded-xl text-xs" />
                    <Input label="End (Auto)" value={bookingData.end_time} disabled className="h-11 rounded-xl bg-slate-50 text-slate-400 text-xs border-slate-200" />
                </div>

                <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest ml-1 flex items-center gap-2"><Users className="w-3 h-3 text-indigo-600"/> Assigned Property Specialist *</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {therapists.map(t => {
                        const isAvailable = availableTherapists.some(at => at.id === t.id);
                        return (
                          <button key={t.id} type="button" onClick={() => setBookingData({...bookingData, therapist_id: t.id})} className={`p-3 rounded-xl border text-[9px] font-black uppercase transition-all flex flex-col items-center gap-0.5 ${bookingData.therapist_id === t.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : isAvailable ? 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300' : 'bg-slate-50 text-slate-300 opacity-60 cursor-not-allowed'}`} disabled={!isAvailable && user?.role_id?.toLowerCase() !== 'admin'}>
                            <span className="truncate w-full text-center">{t.name}</span>
                            <span className="text-[7px] opacity-80">{t.country}</span>
                          </button>
                        );
                      })}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-900 uppercase tracking-widest ml-1 flex items-center gap-2"><MapPin className="w-3 h-3 text-indigo-600"/> Assigned Room *</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {massageRooms.filter(r => r.is_active || r.id === bookingData.room_id).map(r => {
                        const isAvailable = availableRooms.some(ar => ar.id === r.id);
                        return (
                          <button key={r.id} type="button" onClick={() => setBookingData({...bookingData, room_id: r.id})} className={`p-3 rounded-xl border text-[9px] font-black uppercase transition-all flex flex-col items-center gap-0.5 ${bookingData.room_id === r.id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : isAvailable ? 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300' : 'bg-slate-50 text-slate-300 opacity-60 cursor-not-allowed'}`} disabled={!isAvailable && user?.role_id?.toLowerCase() !== 'admin'}>
                            <span className="truncate w-full text-center">{r.name}</span>
                            <span className="text-[7px] opacity-80">{r.number ? `Room ${r.number}` : 'No Number'}</span>
                          </button>
                        );
                      })}
                    </div>
                </div>

                {error && <div className="bg-red-50 text-red-600 text-[10px] font-bold p-4 rounded-2xl flex items-center gap-3 animate-in shake duration-300"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}

                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="secondary" onClick={onClose} className="flex-1 h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest">Discard</Button>
                  <Button type="submit" isLoading={loading} className="flex-[2] h-12 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100">Commit Reservation</Button>
                </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BookingForm;