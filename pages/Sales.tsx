import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../services/supabase';
import { Link } from 'react-router-dom';
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
  ShoppingBag, 
  Plus, 
  Search, 
  Trash2, 
  Tag, 
  User, 
  Coins, 
  Percent, 
  Calendar, 
  ArrowLeft, 
  Filter, 
  TrendingUp, 
  X,
  CreditCard,
  UserPlus,
  History,
  Zap, 
  CheckCircle2,
  FileUp,
  AlertTriangle,
  Package,
  PackageSearch,
  LayoutGrid,
  ClipboardList,
  Edit,
  Activity,
  ArrowDown,
  CalendarDays,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Lock,
  ShieldAlert,
  Edit3,
  Users,
  Shield,
  Store,
  Building2,
  AlertCircle,
  RefreshCcw,
  ExternalLink,
  Download,
  Printer
} from 'lucide-react';
import { db } from '../services/mockSupabase';
import { Sale, Guest, SaleCategory, InventoryItem, MassageBooking, MassageType, UserProfile, Staff } from '../types';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { format, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay, addDays, isSameDay, subMonths } from 'date-fns';

// Lazy load RetailStockReport
const RetailStockReport = React.lazy(() => import('./RetailStockReport'));

// Debounce utility
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Simple cache implementation
class DataCache {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private TTL = 5 * 60 * 1000; // 5 minutes

  get(key: string) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.data;
    }
    return null;
  }

  set(key: string, data: any) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  invalidate(keyPattern: string) {
    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      if (key.includes(keyPattern)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  clear() {
    this.cache.clear();
  }
}

const cache = new DataCache();

const POSForm = ({ 
    guests, 
    inventory,
    users,
    staff = [],
    onCancel, 
    onSuccess, 
    currentOutletId,
    currentPropertyId,
    initialSale 
}: { 
    guests: Guest[], 
    inventory: InventoryItem[],
    users: UserProfile[],
    staff?: Staff[],
    onCancel: () => void, 
    onSuccess: () => void, 
    currentOutletId: string,
    currentPropertyId: string,
    initialSale?: Sale
}) => {
    const { formatMoney } = useSettings();
    const { user: currentUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const [saleData, setSaleData] = useState({
        guest_id: initialSale?.guest_id || '',
        guest_name: initialSale?.guest_name || 'Walk-in Guest',
        category: initialSale?.category || 'Retail' as SaleCategory,
        item_id: initialSale?.item_id || '',
        item_name: initialSale?.item_name || '',
        quantity: initialSale?.quantity || 1,
        unit_price: initialSale?.unit_price || 0,
        discount: initialSale?.discount_amount || 0,
        discount_mode: 'amount' as 'amount' | 'percent',
        payment_method: initialSale?.payment_method || 'Cash',
        remarks: initialSale?.remarks || '',
        sold_by_id: initialSale?.sold_by_id || '',
        secondary_sold_by_id: initialSale?.secondary_sold_by_id || '',
        discount_reason: initialSale?.discount_reason || '',
        discount_id_url: initialSale?.discount_id_url || ''
    });

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setSaleData(prev => ({ ...prev, discount_id_url: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const [showGuestSuggestions, setShowGuestSuggestions] = useState(false);
    const [showItemSuggestions, setShowItemSuggestions] = useState(false);
    const [itemSearch, setItemSearch] = useState(initialSale?.item_name || '');
    const suggestionRef = useRef<HTMLDivElement>(null);
    const itemRef = useRef<HTMLDivElement>(null);

    // Optimized providers with useMemo
    const providers = useMemo(() => {
        const activeStaff = staff.filter(s => s.is_active);
        const category = saleData.category.toLowerCase();
        
        let filtered = activeStaff;

        if (category === 'personal training') {
            const trainers = activeStaff.filter(s => 
                /trainer|coach|instructor|pt|gym|fitness/i.test(s.role)
            );
            if (trainers.length > 0) {
                filtered = trainers;
            } else {
                const nonTherapists = activeStaff.filter(s => !/therapist|specialist|masseur|masseuse/i.test(s.role));
                if (nonTherapists.length > 0) filtered = nonTherapists;
            }
        } else if (category === 'retail' || category === 'entrance fee') {
            const frontOffice = activeStaff.filter(s => 
                /sales|reception|associate|cashier|front|admin|manager|clerk|counter|office/i.test(s.role)
            );
            if (frontOffice.length > 0) {
                filtered = frontOffice;
            } else {
                const nonTherapists = activeStaff.filter(s => !/therapist|specialist|masseur|masseuse/i.test(s.role));
                if (nonTherapists.length > 0) filtered = nonTherapists;
            }
        }
        
        return filtered
            .map(s => ({ id: s.id, name: s.name, role: s.role }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [staff, saleData.category]);

    const providerLabel = useMemo(() => {
        if (saleData.category === 'Personal Training') return 'Personal Trainer';
        if (saleData.category === 'Retail') return 'Sales Associate';
        return 'Staff Member';
    }, [saleData.category]);

    // Optimized filtered inventory with limit
    const filteredInventory = useMemo(() => {
        const catFiltered = inventory.filter(i => i.category === saleData.category);
        if (!itemSearch) return catFiltered.slice(0, 50); // Limit to 50 items
        return catFiltered
            .filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase()))
            .slice(0, 50); // Limit to 50 items
    }, [inventory, saleData.category, itemSearch]);

    // Optimized guest suggestions with limit
    const guestSuggestions = useMemo(() => {
        if (!saleData.guest_name || saleData.guest_name.length < 2 || saleData.guest_id) return [];
        return guests
            .filter(g => g.name.toLowerCase().includes(saleData.guest_name.toLowerCase()))
            .slice(0, 5);
    }, [guests, saleData.guest_name, saleData.guest_id]);

    const grossAmount = saleData.quantity * saleData.unit_price;
    const discountValue = saleData.discount_mode === 'percent' 
        ? (grossAmount * saleData.discount) / 100 
        : saleData.discount;
    const netAmount = Math.max(0, grossAmount - discountValue);

    const handleItemSelect = (item: InventoryItem) => {
        setSaleData(prev => ({
            ...prev,
            item_id: item.id,
            item_name: item.name,
            unit_price: item.price
        }));
        setItemSearch(item.name);
        setShowItemSuggestions(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!saleData.item_name || saleData.unit_price < 0) {
            setError("Specify valid item and price.");
            return;
        }
        if (discountValue > 0 && !saleData.discount_reason) {
            setError("Please provide a reason for the discount.");
            return;
        }
        setLoading(true);
        try {
            const payload = {
                property_id: currentPropertyId,
                outlet_id: currentOutletId,
                guest_id: saleData.guest_id || undefined,
                guest_name: saleData.guest_name,
                category: saleData.category,
                item_id: saleData.item_id || undefined,
                item_name: saleData.item_name,
                quantity: saleData.quantity,
                unit_price: saleData.unit_price,
                gross_amount: grossAmount,
                discount_amount: discountValue,
                net_amount: netAmount,
                payment_method: saleData.payment_method,
                status: initialSale?.status || 'completed' as any,
                remarks: saleData.remarks,
                sold_by_id: saleData.sold_by_id,
                secondary_sold_by_id: saleData.secondary_sold_by_id,
                discount_reason: saleData.discount_reason,
                discount_id_url: saleData.discount_id_url
            };

            if (initialSale) {
                await (db as any).updateSale(initialSale.id, payload);
            } else {
                await db.addSale(payload);
            }
            
            // Invalidate cache after successful operation
            cache.invalidate('sales');
            cache.invalidate('inventory');
            
            onSuccess();
        } catch (err: any) {
            setError(err.message || "Checkout failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card className="max-w-2xl mx-auto rounded-[2rem] shadow-2xl overflow-hidden border-slate-200/60 bg-white">
            <CardHeader className={`${initialSale ? 'bg-slate-900' : 'bg-indigo-600'} text-white p-6 relative`}>
                <CardTitle className="text-xl font-black uppercase tracking-tight">{initialSale ? 'Adjust Transaction' : 'Point of Sale Terminal'}</CardTitle>
                <p className="text-[9px] font-black text-indigo-200 uppercase tracking-widest mt-1">Transaction Recognition Engine</p>
                <button onClick={onCancel} className="absolute top-5 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><X className="w-4 h-4" /></button>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
                        <div className="relative" ref={suggestionRef}>
                            <Input 
                                label="Guest / Customer Profile *" 
                                value={saleData.guest_name} 
                                onChange={e => {
                                    setSaleData({...saleData, guest_name: e.target.value, guest_id: ''});
                                    setShowGuestSuggestions(true);
                                }}
                                onFocus={() => setShowGuestSuggestions(true)}
                                className="h-11 rounded-xl text-xs font-bold" 
                            />
                            {showGuestSuggestions && guestSuggestions.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-[160] bg-white border border-slate-200 rounded-2xl shadow-2xl mt-1 overflow-hidden">
                                    {guestSuggestions.map(g => (
                                        <button 
                                            key={g.id} 
                                            type="button" 
                                            onClick={() => {
                                                setSaleData({...saleData, guest_name: g.name, guest_id: g.id});
                                                setShowGuestSuggestions(false);
                                            }}
                                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-indigo-50 border-b border-slate-50 last:border-0 transition-colors text-left"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-[10px] uppercase">{g.name.charAt(0)}</div>
                                            <div className="text-[11px] font-black text-slate-900 uppercase">{g.name}</div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Select 
                            label="Revenue Department *" 
                            options={['Retail', 'Personal Training', 'Entrance Fee', 'Other'].map(c => ({ value: c, label: c }))} 
                            value={saleData.category}
                            onChange={e => {
                                setSaleData({...saleData, category: e.target.value as any, item_id: '', item_name: '', unit_price: 0});
                                setItemSearch('');
                            }}
                            className="h-11 rounded-xl text-xs font-black uppercase"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 relative" ref={itemRef}>
                            <Input 
                                label="Select Item / Service (Searchable) *" 
                                value={itemSearch}
                                onChange={e => {
                                    setItemSearch(e.target.value);
                                    setSaleData(prev => ({...prev, item_name: e.target.value, item_id: ''}));
                                    setShowItemSuggestions(true);
                                }}
                                onFocus={() => setShowItemSuggestions(true)}
                                placeholder="Start typing to filter catalog..."
                                className="h-11 rounded-xl text-xs font-bold"
                            />
                            {showItemSuggestions && filteredInventory.length > 0 && (
                                <div className="absolute top-full left-0 right-0 z-[160] bg-white border border-slate-200 rounded-2xl shadow-2xl mt-1 max-h-48 overflow-y-auto custom-scrollbar overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                                    {filteredInventory.map(item => (
                                        <button 
                                            key={item.id} 
                                            type="button" 
                                            onClick={() => handleItemSelect(item)}
                                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-indigo-50 border-b border-slate-50 last:border-0 transition-colors text-left"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Package className="w-3.5 h-3.5 text-slate-300" />
                                                <div className="text-[11px] font-black text-slate-900 uppercase">{item.name}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] font-black text-indigo-600">{formatMoney(item.price)}</div>
                                                {item.track_inventory && <div className="text-[8px] font-bold text-slate-400 uppercase">Stock: {item.stock_quantity}</div>}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Input label="Quantity" type="number" value={saleData.quantity} onChange={e => setSaleData({...saleData, quantity: Math.max(1, parseInt(e.target.value) || 0)})} className="h-11 rounded-xl text-xs font-bold" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <Input label="Unit Price" type="number" step="0.01" value={saleData.unit_price} onChange={e => setSaleData({...saleData, unit_price: parseFloat(e.target.value) || 0})} className="h-11 rounded-xl text-xs font-bold" />
                        <div className="space-y-1.5">
                            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Reduction Logic</label>
                            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 h-11">
                                <button type="button" onClick={() => setSaleData({...saleData, discount_mode: 'amount'})} className={`flex-1 rounded-lg text-[8px] font-black uppercase transition-all flex items-center justify-center gap-1 ${saleData.discount_mode === 'amount' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400'}`}><Coins className="w-2.5 h-2.5" /> Amt</button>
                                <button type="button" onClick={() => setSaleData({...saleData, discount_mode: 'percent'})} className={`flex-1 rounded-lg text-[8px] font-black uppercase transition-all flex items-center justify-center gap-1 ${saleData.discount_mode === 'percent' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-400'}`}><Percent className="w-2.5 h-2.5" /> %</button>
                            </div>
                        </div>
                        <Input label={saleData.discount_mode === 'amount' ? 'Value' : 'Rate (%)'} type="number" step="0.01" value={saleData.discount} onChange={e => setSaleData({...saleData, discount: parseFloat(e.target.value) || 0})} className="h-11 rounded-xl text-xs font-bold" />
                        <div className="bg-slate-950 text-white px-4 py-2 rounded-xl flex items-center justify-between h-11 shadow-lg shadow-slate-200">
                            <span className="text-[7px] font-black opacity-60 uppercase tracking-widest">Net Total</span>
                            <span className="text-xs font-black text-indigo-400 tracking-tighter">{formatMoney(netAmount)}</span>
                        </div>
                    </div>

                    {discountValue > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-1.5">
                                <label className="text-[8px] font-black text-indigo-600 uppercase tracking-widest ml-1">Discount Reason <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                                    <input 
                                        type="text"
                                        value={saleData.discount_reason}
                                        onChange={e => setSaleData({...saleData, discount_reason: e.target.value})}
                                        placeholder="Why is this discount being applied?"
                                        className="w-full h-11 pl-10 pr-4 rounded-xl border border-indigo-200 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[8px] font-black text-indigo-600 uppercase tracking-widest ml-1">Supportive ID / Document</label>
                                <div className="relative">
                                    <FileUp className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                                    <input 
                                        type="file"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                        id="pos-discount-id-upload"
                                        accept="image/*,.pdf"
                                    />
                                    <label 
                                        htmlFor="pos-discount-id-upload"
                                        className="flex items-center w-full h-11 pl-10 pr-4 rounded-xl border border-indigo-200 bg-white text-xs font-bold cursor-pointer hover:bg-indigo-50 transition-colors"
                                    >
                                        {saleData.discount_id_url ? (
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Select 
                            label="Payment Method" 
                            options={['Cash', 'Credit Card', 'Room Charge', 'Complimentary'].map(m => ({ value: m, label: m }))} 
                            value={saleData.payment_method}
                            onChange={e => setSaleData({...saleData, payment_method: e.target.value})}
                            className="h-11 rounded-xl text-xs"
                        />
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-700">Primary {providerLabel} (Incentive)</label>
                            <div className="relative">
                                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <select 
                                    value={saleData.sold_by_id}
                                    onChange={e => setSaleData({...saleData, sold_by_id: e.target.value})}
                                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-300 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    <option value="">Select Primary {providerLabel}...</option>
                                    {providers.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    {saleData.category === 'Personal Training' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="md:col-start-2 space-y-1">
                                <label className="text-[10px] font-bold text-slate-700">Secondary {providerLabel} (Split Incentive)</label>
                                <div className="relative">
                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <select 
                                        value={saleData.secondary_sold_by_id}
                                        onChange={e => setSaleData({...saleData, secondary_sold_by_id: e.target.value})}
                                        className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-300 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    >
                                        <option value="">None (100% to Primary)</option>
                                        {providers.filter(p => p.id !== saleData.sold_by_id).map(p => (
                                            <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <Input label="Internal Audit Remarks" value={saleData.remarks} onChange={e => setSaleData({...saleData, remarks: e.target.value})} placeholder="Notes..." className="h-11 rounded-xl text-xs" />

                    {error && <div className="bg-red-50 text-red-600 text-[10px] font-bold p-4 rounded-xl flex items-center gap-3 animate-in shake duration-300"><AlertTriangle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onCancel} className="flex-1 h-12 rounded-xl font-bold uppercase text-[10px] tracking-widest bg-slate-100 hover:bg-slate-200 transition-colors">Discard</button>
                        <Button type="submit" isLoading={loading} className="flex-[2] h-12 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-100">Commit Transaction</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
};

export const InventoryManager = ({ 
    inventory, 
    currentOutletId,
    currentPropertyId, 
    onRefresh,
    externalFormState
}: { 
    inventory: InventoryItem[], 
    currentOutletId: string,
    currentPropertyId: string, 
    onRefresh: () => void,
    externalFormState?: {
        showForm: boolean,
        setShowForm: (show: boolean) => void,
        editingItem: InventoryItem | null,
        setEditingItem: (item: InventoryItem | null) => void,
        formData: any,
        setFormData: (data: any) => void
    }
}) => {
    const { user } = useAuth();
    const { formatMoney, hasPermission } = useSettings();
    const [loading, setLoading] = useState(false);
    const [internalShowForm, setInternalShowForm] = useState(false);
    const [internalEditingItem, setInternalEditingItem] = useState<InventoryItem | null>(null);
    
    const showForm = externalFormState ? externalFormState.showForm : internalShowForm;
    const setShowForm = externalFormState ? externalFormState.setShowForm : setInternalShowForm;
    const editingItem = externalFormState ? externalFormState.editingItem : internalEditingItem;
    const setEditingItem = externalFormState ? externalFormState.setEditingItem : setInternalEditingItem;
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 9;

    const canManage = user && (hasPermission(user.role_id, 'inventory:manage') || hasPermission(user.role_id, 'bookings:manage_resources'));

    const [internalFormData, setInternalFormData] = useState({
        name: '',
        category: 'Retail' as SaleCategory,
        price: 0,
        stock_quantity: 0,
        track_inventory: true
    });

    const formData = externalFormState ? (externalFormState.formData || {
        name: '',
        category: 'Retail' as SaleCategory,
        price: 0,
        stock_quantity: 0,
        track_inventory: true
    }) : internalFormData;
    const setFormData = externalFormState ? externalFormState.setFormData : setInternalFormData;
    
    // Sync external formData if provided
    useEffect(() => {
        if (externalFormState && editingItem) {
            const currentData = externalFormState.formData;
            const newData = {
                name: editingItem.name || '',
                category: editingItem.category || 'Retail',
                price: editingItem.price || 0,
                stock_quantity: editingItem.stock_quantity || 0,
                track_inventory: editingItem.track_inventory ?? true
            };
            
            if (JSON.stringify(currentData) !== JSON.stringify(newData)) {
                externalFormState.setFormData(newData);
            }
        }
    }, [editingItem]);
    
    const [stockForm, setStockForm] = useState<{ show: boolean, item: InventoryItem | null, type: 'restock' | 'adjustment' }>({ show: false, item: null, type: 'restock' });
    const [stockData, setStockData] = useState({ quantity: 0, reason: '', notes: '' });
    const [error, setError] = useState<string | null>(null);

    // Paginate inventory
    const paginatedInventory = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        return inventory.slice(start, end);
    }, [inventory, currentPage]);

    const totalPages = Math.ceil(inventory.length / itemsPerPage);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canManage) return;
        setLoading(true);
        setError(null);
        try {
            if (editingItem) {
                await db.updateInventoryItem(editingItem.id, formData);
            } else {
                await db.addInventoryItem({ ...formData, property_id: currentPropertyId, outlet_id: currentOutletId });
            }
            
            // Invalidate cache
            cache.invalidate('inventory');
            
            setShowForm(false);
            setEditingItem(null);
            onRefresh();
        } catch (e: any) {
            console.error(e);
            if (e.message?.includes('schema cache') || e.code === '42P01' || e.code === '42703' || e.message?.toLowerCase().includes('column')) {
                setError("The 'inventory' table is missing or incomplete in your Supabase database. Please run the SQL migration to create it.");
            } else {
                setError(e.message || "Failed to save inventory item.");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleStockUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stockForm.item || !canManage) return;
        setLoading(true);
        try {
            const change = stockForm.type === 'restock' ? stockData.quantity : stockData.quantity; 
            
            const newStock = stockForm.item.stock_quantity + change;
            
            await db.updateInventoryItem(stockForm.item.id, { 
                stock_quantity: newStock 
            }, stockForm.type === 'restock' ? 'Restock' : 'Adjustment', user?.id);

            // Invalidate cache
            cache.invalidate('inventory');

            setStockForm({ show: false, item: null, type: 'restock' });
            setStockData({ quantity: 0, reason: '', notes: '' });
            onRefresh();
        } catch (e: any) {
            console.error(e);
            setError(e.message || "Failed to update stock.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl shadow-sm animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center">
                        <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
                        <p className="text-sm font-bold text-red-800">{error}</p>
                    </div>
                </div>
            )}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Master Catalog & Inventory</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Asset Pricing & Stock Controls</p>
                </div>
                {canManage && (
                    <Button onClick={() => { setFormData({ name: '', category: 'Retail', price: 0, stock_quantity: 0, track_inventory: true }); setEditingItem(null); setShowForm(true); }} className="rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-6">
                        <Plus className="w-4 h-4 mr-2" /> Add Catalog Item
                    </Button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paginatedInventory.map(item => (
                    <Card key={item.id} className="rounded-[2rem] border-slate-200/60 shadow-sm hover:shadow-md transition-shadow p-6 group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-slate-50 rounded-2xl group-hover:bg-indigo-50 transition-colors">
                                <Package className="w-6 h-6 text-slate-400 group-hover:text-indigo-600" />
                            </div>
                            {canManage && (
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => { 
                                      setEditingItem(item); 
                                      setFormData({
                                        ...item,
                                        name: item.name || '',
                                        price: item.price || 0,
                                        stock_quantity: item.stock_quantity || 0,
                                        track_inventory: item.track_inventory ?? true
                                      }); 
                                      setShowForm(true); 
                                    }} className="p-2 text-slate-400 hover:text-indigo-600" title="Edit Item"><Edit className="w-4 h-4" /></button>
                                    <button onClick={() => {
                                        setStockForm({ show: true, item, type: 'restock' });
                                        setStockData({ quantity: 0, reason: 'Restock', notes: '' });
                                    }} className="p-2 text-slate-400 hover:text-emerald-600" title="Add Stock"><RefreshCcw className="w-4 h-4" /></button>
                                    <button onClick={() => setItemToDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600" title="Delete Item"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            )}
                        </div>
                        <div>
                            <h4 className="font-black text-slate-900 uppercase text-sm mb-1">{item.name}</h4>
                            <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2.5 py-1 rounded-lg">{item.category}</span>
                        </div>
                        <div className="mt-6 flex justify-between items-end border-t border-slate-50 pt-4">
                            <div>
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">List Price</p>
                                <p className="text-sm font-black text-slate-900">{formatMoney(item.price)}</p>
                            </div>
                            {item.track_inventory && (
                                <div className="text-right">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Availability</p>
                                    <div className={`text-sm font-black px-3 py-1 rounded-xl flex items-center gap-2 ${item.stock_quantity <= 0 ? 'bg-red-50 text-red-600' : item.stock_quantity < 5 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                        <Activity className="w-3 h-3" />
                                        {item.stock_quantity} In Stock
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-xl border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-bold text-slate-600">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-xl border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            {stockForm.show && stockForm.item && (
                <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
                    <Card className="w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <CardHeader className="bg-slate-900 text-white p-6 relative">
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Restock Inventory</CardTitle>
                            <p className="text-[10px] text-indigo-200 uppercase tracking-widest mt-1">{stockForm.item.name}</p>
                            <button onClick={() => setStockForm({ ...stockForm, show: false })} className="absolute top-5 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><X className="w-5 h-5"/></button>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <form onSubmit={handleStockUpdate} className="space-y-4">
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                                    <span className="text-xs font-bold text-slate-500 uppercase">Current Stock</span>
                                    <span className="text-lg font-black text-slate-900">{stockForm.item.stock_quantity}</span>
                                </div>
                                <Input 
                                    label="Quantity to Add" 
                                    type="number" 
                                    value={stockData.quantity} 
                                    onChange={e => setStockData({...stockData, quantity: parseInt(e.target.value) || 0})} 
                                    className="h-12 rounded-xl" 
                                    autoFocus
                                />
                                <Input 
                                    label="Notes / Reference" 
                                    value={stockData.notes} 
                                    onChange={e => setStockData({...stockData, notes: e.target.value})} 
                                    placeholder="e.g., PO-12345"
                                    className="h-12 rounded-xl" 
                                />
                                <Button type="submit" isLoading={loading} className="w-full h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-100 mt-4">Confirm Restock</Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}

            {showForm && canManage && (
                <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
                    <Card className="w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <CardHeader className="bg-slate-900 text-white p-6 relative">
                            <CardTitle className="text-lg font-black uppercase tracking-tight">{editingItem ? 'Modify Asset' : 'Define New Asset'}</CardTitle>
                            <button onClick={() => setShowForm(false)} className="absolute top-5 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><X className="w-5 h-5"/></button>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <form onSubmit={handleSave} className="space-y-4">
                                <Input label="Item / Service Name *" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="h-12 rounded-xl" />
                                <Select 
                                    label="Revenue Category" 
                                    options={['Retail', 'Personal Training', 'Entrance Fee', 'Other'].map(c => ({ value: c, label: c }))} 
                                    value={formData.category}
                                    onChange={e => setFormData({...formData, category: e.target.value as any})}
                                    className="h-12 rounded-xl"
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <Input label="Retail Price *" type="number" step="0.01" value={formData.price} onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})} className="h-12 rounded-xl" />
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Track Stock?</label>
                                        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 h-12">
                                            <button type="button" onClick={() => setFormData({...formData, track_inventory: true})} className={`flex-1 rounded-lg text-[10px] font-black uppercase transition-all ${formData.track_inventory ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>ON</button>
                                            <button type="button" onClick={() => setFormData({...formData, track_inventory: false})} className={`flex-1 rounded-lg text-[10px] font-black uppercase transition-all ${!formData.track_inventory ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>OFF</button>
                                        </div>
                                    </div>
                                </div>
                                {formData.track_inventory && (
                                    <Input label="Initial Stock Quantity" type="number" value={formData.stock_quantity} onChange={e => setFormData({...formData, stock_quantity: parseInt(e.target.value) || 0})} className="h-12 rounded-xl animate-in slide-in-from-top-2" />
                                )}
                                <Button type="submit" isLoading={loading} className="w-full h-14 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-100 mt-4">Commit to Catalog</Button>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            )}

            <ConfirmationModal 
                isOpen={!!itemToDelete} 
                onClose={() => setItemToDelete(null)} 
                onConfirm={async () => { if (itemToDelete && canManage) { await db.deleteInventoryItem(itemToDelete); cache.invalidate('inventory'); onRefresh(); } }} 
                title="Decommission Item" 
                description="Are you sure you want to remove this item from the master catalog? Historical sales data will remain intact, but future recognition will be unavailable." 
                confirmText="Confirm Deletion" 
                isDestructive={true} 
            />
        </div>
    );
};

const Sales = () => {
    const { user } = useAuth();
    const { currentOutlet, currentProperty, formatMoney, hasPermission, setPageLoading } = useSettings();
    const [activeTab, setActiveTab] = useState<'ledger' | 'inventory' | 'stock'>('ledger');
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [viewScope, setViewScope] = useState<'outlet' | 'property'>('outlet');
    
    const [sales, setSales] = useState<Sale[]>([]);
    const [bookings, setBookings] = useState<MassageBooking[]>([]);
    const [guests, setGuests] = useState<Guest[]>([]);
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [massageTypes, setMassageTypes] = useState<MassageType[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingSale, setEditingSale] = useState<Sale | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [itemToDelete, setItemToDelete] = useState<{ id: string; type: 'pos' | 'booking' } | null>(null);
    const [viewingIdUrl, setViewingIdUrl] = useState<string | null>(null);
    
    // Pagination for ledger
    const [currentPage, setCurrentPage] = useState(1);
    const entriesPerPage = 20;

    // Security Check
    const canView = user && hasPermission(user.role_id, 'sales:view');
    const canCreate = user && hasPermission(user.role_id, 'sales:create');
    const canEdit = user && hasPermission(user.role_id, 'sales:edit');
    const canVoid = user && hasPermission(user.role_id, 'sales:void');
    const canDelete = user && hasPermission(user.role_id, 'sales:delete');
    const canDeleteBooking = user && hasPermission(user.role_id, 'bookings:delete');
    const canViewInventory = user && hasPermission(user.role_id, 'inventory:view');

    // 1. Move loadData definition before its usage
    const loadData = useCallback(async (forceRefresh = false) => {
        if (!currentOutlet || !currentProperty) return;
        
        const isProperty = viewScope === 'property';
        const scopeId = isProperty ? currentProperty.id : currentOutlet.id;
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const monthStartStr = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
        const monthEndStr = format(endOfMonth(selectedDate), 'yyyy-MM-dd');
        
        // Create cache keys
        const salesCacheKey = `sales-${scopeId}-${isProperty}-${monthStartStr}-${monthEndStr}`;
        const bookingsCacheKey = `bookings-${scopeId}-${isProperty}-${monthStartStr}-${monthEndStr}`;
        const guestsCacheKey = `guests-${currentProperty.id}`;
        const inventoryCacheKey = `inventory-${scopeId}-${isProperty}`;
        const massageTypesCacheKey = `massage-types-${scopeId}-${isProperty}`;
        
        // Check cache first
        const cachedSales = cache.get(salesCacheKey);
        const cachedBookings = cache.get(bookingsCacheKey);
        const cachedGuests = cache.get(guestsCacheKey);
        const cachedInventory = cache.get(inventoryCacheKey);
        const cachedMassageTypes = cache.get(massageTypesCacheKey);
        
        // If we have cached data, show it immediately and don't show the blocking loader
        if (cachedSales && cachedBookings && !forceRefresh) {
            setSales(cachedSales);
            setBookings(cachedBookings);
            if (cachedGuests) setGuests(cachedGuests);
            if (cachedInventory) setInventory(cachedInventory);
            if (cachedMassageTypes) setMassageTypes(cachedMassageTypes);
            setLoading(false);
            // Still fetch in background to ensure freshness
        } else {
            setLoading(true);
        }
        
        try {
            // Fetch individually and update state as they come in
            const fetchPromises = [
                db.getSalesByDateRange(scopeId, isProperty, monthStartStr, monthEndStr).then(data => {
                    setSales(data);
                    cache.set(salesCacheKey, data);
                    return data;
                }),
                db.getMassageBookingsByDateRange(scopeId, isProperty, monthStartStr, monthEndStr).then(data => {
                    setBookings(data);
                    cache.set(bookingsCacheKey, data);
                    return data;
                }),
                db.getGuests(currentProperty.id, { limit: 100 }).then(data => {
                    setGuests(data);
                    cache.set(guestsCacheKey, data);
                    return data;
                }),
                db.getInventory(scopeId, isProperty, { limit: 100 }).then(data => {
                    setInventory(data);
                    cache.set(inventoryCacheKey, data);
                    return data;
                }),
                db.getMassageTypes(scopeId, isProperty).then(data => {
                    setMassageTypes(data);
                    cache.set(massageTypesCacheKey, data);
                    return data;
                }),
                db.getUsers().then(setUsers),
                db.getStaff(currentOutlet.id).then(setStaff)
            ];
            
            // Wait for at least sales and bookings to be done before hiding loading if it was true
            await Promise.all([fetchPromises[0], fetchPromises[1]]);
            setLoading(false);
            
            // Wait for the rest in background
            await Promise.all(fetchPromises);
            
        } catch (e) {
            console.error(e);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    }, [currentOutlet, currentProperty, selectedDate, viewScope]);

    // Debounced load function
    const debouncedLoad = useCallback(
        debounce(() => {
            loadData();
        }, 500),
        [loadData]
    );

    useEffect(() => {
        if (currentOutlet && canView) {
            loadData();
        } else if (!currentOutlet) {
            setLoading(false);
        }
    }, [currentOutlet, canView, viewScope, selectedDate, loadData]);

    // Optimized real-time synchronization subscription
    useEffect(() => {
        if (!currentOutlet || !currentProperty || !canView) return;

        const channel = supabase
            .channel('realtime-sales')
            .on(
                'postgres_changes',
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'sales',
                    filter: `outlet_id=eq.${currentOutlet.id}`
                },
                (payload) => {
                    // Optimistically add new sale
                    const dateStr = format(selectedDate, 'yyyy-MM-dd');
                    const saleDate = format(new Date(payload.new.created_at), 'yyyy-MM-dd');
                    
                    if (saleDate === dateStr) {
                        setSales(prev => [payload.new, ...prev].slice(0, 100));
                    }
                    // Invalidate cache for future loads
                    cache.invalidate('sales');
                }
            )
            .on(
                'postgres_changes',
                { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'sales',
                    filter: `outlet_id=eq.${currentOutlet.id}`
                },
                (payload) => {
                    setSales(prev => prev.map(s => s.id === payload.new.id ? payload.new : s));
                    cache.invalidate('sales');
                }
            )
            .on(
                'postgres_changes',
                { 
                    event: 'DELETE', 
                    schema: 'public', 
                    table: 'sales',
                    filter: `outlet_id=eq.${currentOutlet.id}`
                },
                (payload) => {
                    setSales(prev => prev.filter(s => s.id !== payload.old.id));
                    cache.invalidate('sales');
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentOutlet, currentProperty, canView, selectedDate]);

    if (!canView) {
        return (
            <div className="flex items-center justify-center h-screen">
                <Card className="max-w-md text-center p-8 border-red-100 bg-red-50/30 rounded-[2rem]">
                    <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Operational Protocol Lock</h3>
                    <p className="text-slate-500 mt-2 text-sm font-bold uppercase tracking-tight">Your security clearance does not allow access to the Sales Ledger.</p>
                </Card>
            </div>
        );
    }

    // Optimized unified entries with chunked processing
    const unifiedEntries = useMemo(() => {
        // Process in chunks to avoid blocking the main thread
        const processInChunks = (items: any[], chunkSize: number = 100) => {
            const results = [];
            for (let i = 0; i < items.length; i += chunkSize) {
                const chunk = items.slice(i, i + chunkSize);
                results.push(...chunk);
            }
            return results;
        };

        const salesMapped = sales.map(s => ({
            id: s.id,
            timestamp: s.created_at,
            guest_name: s.guest_name,
            category: s.category,
            item_name: s.item_name,
            quantity: s.quantity,
            amount: s.net_amount,
            method: s.payment_method,
            type: 'pos' as const,
            discount_reason: s.discount_reason,
            discount_id_url: s.discount_id_url,
            original: s
        }));

        // Avoid double counting: Only include completed bookings that don't have a linked sale record
        const saleBookingIds = new Set(sales.map(s => s.booking_id).filter(Boolean));
        
        const bookingsMapped = bookings
            .filter(b => b.status === 'completed' && !saleBookingIds.has(b.id))
            .map(b => {
                const typeInfo = massageTypes.find(mt => mt.id === (b.massage_type_id || b.inventory_item_id));
                return {
                    id: b.id,
                    timestamp: b.created_at,
                    guest_name: guests.find(g => g.id === b.guest_id)?.name || 'Guest',
                    category: (typeInfo?.category || 'Massage') as any,
                    item_name: typeInfo?.name || 'Massage Service',
                    quantity: 1,
                    amount: Number(b.price),
                    method: 'Service Record',
                    type: 'booking' as const,
                    discount_reason: b.discount_reason,
                    discount_id_url: b.discount_id_url,
                    original: b
                };
            });

        return [...salesMapped, ...bookingsMapped];
    }, [sales, bookings, guests, massageTypes]);

    // Filtered and paginated entries
    const filteredEntries = useMemo(() => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const filtered = unifiedEntries.filter(s => {
            const isTargetDay = format(new Date(s.timestamp), 'yyyy-MM-dd') === dateStr;
            const matchesSearch = s.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 s.item_name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCat = categoryFilter === 'All' || s.category === categoryFilter;
            return isTargetDay && matchesSearch && matchesCat;
        }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        
        return filtered;
    }, [unifiedEntries, searchTerm, categoryFilter, selectedDate]);

    // Paginate entries
    const paginatedEntries = useMemo(() => {
        const start = (currentPage - 1) * entriesPerPage;
        const end = start + entriesPerPage;
        return filteredEntries.slice(start, end);
    }, [filteredEntries, currentPage]);

    const totalPages = Math.ceil(filteredEntries.length / entriesPerPage);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, categoryFilter, selectedDate]);

    // Optimized stats with memoization
    const stats = useMemo(() => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const monthStart = startOfMonth(selectedDate);
        const runningEnd = endOfDay(selectedDate);
        
        const dayEntries = unifiedEntries.filter(e => format(new Date(e.timestamp), 'yyyy-MM-dd') === dateStr);
        const dayTotal = dayEntries.reduce((acc, e) => acc + e.amount, 0);
        const dayServices = dayEntries.filter(e => e.category === 'Massage').reduce((acc, e) => acc + e.amount, 0);
        
        const mtdEntries = unifiedEntries.filter(e => {
            const entryDate = new Date(e.timestamp);
            return isWithinInterval(entryDate, { start: monthStart, end: runningEnd });
        });
        const mtdTotal = mtdEntries.reduce((acc, e) => acc + e.amount, 0);

        return { dayTotal, dayCount: dayEntries.length, dayServices, mtdTotal };
    }, [unifiedEntries, selectedDate]);

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm print:hidden">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                        <ShoppingBag className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Sales & Commerce</h1>
                        <div className="flex flex-wrap items-center gap-4 mt-1">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Store className="w-3 h-3 text-indigo-400" /> {currentOutlet?.name}
                            </p>
                            <div className="h-3 w-px bg-slate-200 hidden sm:block"></div>
                            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                                <button onClick={() => setViewScope('outlet')} className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all flex items-center gap-1.5 ${viewScope === 'outlet' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <Filter className="w-2.5 h-2.5" /> Outlet
                                </button>
                                <button onClick={() => setViewScope('property')} className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all flex items-center gap-1.5 ${viewScope === 'property' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                                    <Building2 className="w-2.5 h-2.5" /> Property
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                    <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm w-full sm:w-auto">
                        <button onClick={() => setSelectedDate(addDays(selectedDate, -1))} className="p-1.5 hover:bg-slate-50 rounded-lg border border-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"><ChevronLeft className="w-4 h-4"/></button>
                        <div className="relative flex items-center gap-2 px-2">
                             <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                             <input type="date" value={format(selectedDate, 'yyyy-MM-dd')} onChange={e => setSelectedDate(new Date(e.target.value))} className="h-8 border-none outline-none font-black text-[10px] uppercase bg-transparent w-32 cursor-pointer" />
                        </div>
                        <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-1.5 hover:bg-slate-50 rounded-lg border border-slate-100 text-slate-400 hover:text-indigo-600 transition-colors"><ChevronRight className="w-4 h-4"/></button>
                    </div>
                    <div className="flex bg-slate-200 p-1.5 rounded-xl border border-slate-300 shadow-inner w-full sm:w-auto">
                        <button onClick={() => setActiveTab('ledger')} className={`flex-1 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'ledger' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}><ClipboardList className="w-3 h-3" /> Ledger</button>
                        {canViewInventory && <button onClick={() => setActiveTab('inventory')} className={`flex-1 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'inventory' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}><Package className="w-3 h-3" /> Inventory</button>}
                        {canViewInventory && <button onClick={() => setActiveTab('stock')} className={`flex-1 px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'stock' ? 'bg-white text-indigo-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}><TrendingUp className="w-3 h-3" /> Stock</button>}
                    </div>
                    {canCreate && (
                        <Button onClick={() => { setEditingSale(null); setShowForm(true); }} className="w-full sm:w-auto rounded-xl h-11 px-6 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 ml-auto xl:ml-0">
                            <Plus className="w-4 h-4 mr-2" /> New Entry
                        </Button>
                    )}
                </div>
            </div>

            {activeTab === 'stock' ? (
                <React.Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>}>
                    <RetailStockReport embeddedViewScope={viewScope} isEmbedded={true} />
                </React.Suspense>
            ) : activeTab === 'ledger' ? (
                <div className="relative">
                    {loading && unifiedEntries.length === 0 && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-[2px] rounded-[2.5rem]">
                            <div className="flex flex-col items-center gap-3">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Synchronizing Ledger...</p>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card className="p-6 rounded-3xl border-slate-200/60 shadow-sm bg-white hover:shadow-md transition-shadow">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><CalendarDays className="w-2.5 h-2.5" /> Daily Total Yield</p>
                            <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{formatMoney(stats.dayTotal)}</h3>
                        </Card>
                        <Card className="p-6 rounded-3xl border-slate-200/60 shadow-sm bg-white hover:shadow-md transition-shadow">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Activity className="w-2.5 h-2.5" /> Vol. for {format(selectedDate, 'MMM dd')}</p>
                            <h3 className="text-2xl font-black text-indigo-600 tracking-tighter">{stats.dayCount} Events</h3>
                        </Card>
                        <Card className="p-6 rounded-3xl border-slate-200/60 shadow-sm bg-white hover:shadow-md transition-shadow">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" /> Day Service Yield</p>
                            <h3 className="text-2xl font-black text-purple-600 tracking-tighter">{formatMoney(stats.dayServices)}</h3>
                        </Card>
                        <Card className="p-6 rounded-3xl border-indigo-100 shadow-xl shadow-indigo-50 bg-indigo-600 text-white group overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-125 transition-transform duration-500"><TrendingUp className="w-16 h-16" /></div>
                            <div className="relative z-10">
                                <p className="text-[8px] font-black text-indigo-100 uppercase tracking-[0.2em] mb-1">Total MTD Recognition</p>
                                <h3 className="text-2xl font-black tracking-tighter">{formatMoney(stats.mtdTotal)}</h3>
                                <p className="text-[7px] font-bold text-indigo-200 uppercase mt-2">
                                    Range: 01 {format(selectedDate, 'MMM')} - {format(selectedDate, 'dd MMM yyyy')}
                                </p>
                            </div>
                        </Card>
                    </div>

                    <div className="bg-white p-4 rounded-[2rem] border border-slate-200/60 shadow-sm flex flex-col sm:flex-row gap-3">
                         <div className="relative flex-1 group">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-focus-within:bg-indigo-600 group-focus-within:text-white transition-all duration-300">
                                <Search className="w-4 h-4" />
                            </div>
                            <input 
                                placeholder="Search ledger by guest name or asset description..." 
                                className="w-full h-12 pl-16 pr-4 rounded-2xl bg-slate-50 border border-transparent focus:bg-white focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all text-sm font-bold placeholder:text-slate-400" 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)} 
                            />
                        </div>
                        <div className="flex gap-2">
                             <div className="relative w-full sm:w-48">
                                <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <select 
                                    value={categoryFilter} 
                                    onChange={e => setCategoryFilter(e.target.value)}
                                    className="w-full h-12 pl-11 pr-8 rounded-2xl bg-white border border-slate-200 text-[10px] font-black uppercase tracking-widest appearance-none cursor-pointer focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                                >
                                    {['All', 'Retail', 'Personal Training', 'Entrance Fee', 'Massage', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                             </div>
                        </div>
                    </div>

                    <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden bg-white">
                        <div className="px-8 py-5 bg-slate-50/50 border-b flex justify-between items-center">
                            <div className="flex items-center gap-3"><CalendarDays className="w-4 h-4 text-indigo-600" /><h4 className="text-[11px] font-black uppercase tracking-[0.1em] text-slate-900">{format(selectedDate, 'EEEE, dd MMMM yyyy')}</h4></div>
                            <span className="text-xs font-bold text-slate-500">Showing {paginatedEntries.length} of {filteredEntries.length} entries</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] bg-white border-b">
                                    <tr>
                                        <th className="px-8 py-4">Time</th>
                                        <th className="px-8 py-4">Customer Profile</th>
                                        <th className="px-8 py-4">Department / Asset</th>
                                        <th className="px-8 py-4 text-right">Recognition</th>
                                        <th className="px-8 py-4 text-center">Settlement</th>
                                        <th className="px-8 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {paginatedEntries.map(entry => (
                                        <tr key={entry.id} className="hover:bg-indigo-50/20 transition-colors group">
                                            <td className="px-8 py-5 text-[10px] font-bold text-slate-400">{format(new Date(entry.timestamp), 'HH:mm')}</td>
                                            <td className="px-8 py-5"><div className="flex items-center gap-3"><div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-[9px] uppercase">{entry.guest_name.charAt(0)}</div><span className="font-black text-slate-700 tracking-tight uppercase text-[11px]">{entry.guest_name}</span></div></td>
                                            <td className="px-8 py-5">
                                                <div className={`text-[8px] font-black uppercase tracking-widest mb-0.5 ${entry.category === 'Massage' ? 'text-purple-600' : 'text-indigo-600'}`}>{entry.category}</div>
                                                <div className="font-bold text-slate-600 text-[11px] truncate max-w-[200px]">{entry.item_name} <span className="text-[9px] text-slate-400">x{entry.quantity}</span></div>
                                                {(entry.discount_reason || entry.discount_id_url) && (
                                                    <div className="mt-1 flex items-center gap-1 text-[8px] font-black text-indigo-500 italic uppercase tracking-tighter">
                                                        {entry.discount_reason && <><Tag className="w-2 h-2" /> {entry.discount_reason}</>}
                                                        {entry.discount_id_url && (
                                                            <button onClick={() => setViewingIdUrl(entry.discount_id_url)} className="ml-1 text-indigo-600 hover:text-indigo-800">
                                                                <ExternalLink className="w-2.5 h-2.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-8 py-5 text-right font-black text-slate-900 tabular-nums text-[11px]">{formatMoney(entry.amount)}</td>
                                            <td className="px-8 py-5 text-center"><span className={`inline-flex px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest border ${entry.type === 'booking' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{entry.method}</span></td>
                                            <td className="px-8 py-5 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {entry.type === 'pos' ? (
                                                        <>
                                                            {canEdit && <button onClick={() => { setEditingSale(entry.original as Sale); setShowForm(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl shadow-sm border border-transparent hover:border-slate-100 transition-all"><Edit3 className="w-4 h-4" /></button>}
                                                            {canVoid && <button onClick={() => setItemToDelete({ id: entry.id, type: 'pos' })} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl shadow-sm border border-transparent hover:border-slate-100 transition-all" title="Void"><Trash2 className="w-4 h-4" /></button>}
                                                            {!canEdit && !canVoid && <Lock className="w-3.5 h-3.5 text-slate-200" />}
                                                        </>
                                                    ) : (
                                                        <>
                                                            {canDeleteBooking && <button onClick={() => setItemToDelete({ id: entry.id, type: 'booking' })} className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-xl shadow-sm border border-transparent hover:border-slate-100 transition-all"><Trash2 className="w-4 h-4" /></button>}
                                                            {!canDeleteBooking && <Lock className="w-3.5 h-3.5 text-slate-200" />}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="px-8 py-4 border-t border-slate-100 flex justify-between items-center">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-4 py-2 rounded-xl border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors text-xs font-bold"
                                >
                                    Previous
                                </button>
                                <span className="text-xs font-bold text-slate-600">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="px-4 py-2 rounded-xl border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors text-xs font-bold"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </Card>
                </div>
            ) : (
                <InventoryManager 
                    inventory={inventory} 
                    currentOutletId={currentOutlet?.id || ''} 
                    currentPropertyId={currentProperty?.id || ''} 
                    onRefresh={() => {
                        cache.invalidate('inventory');
                        loadData();
                    }} 
                />
            )}

            {showForm && (
                <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl animate-in zoom-in-95 duration-300">
                        <POSForm 
                            users={users} 
                            staff={staff}
                            guests={guests} 
                            inventory={inventory} 
                            currentOutletId={currentOutlet?.id || ''} 
                            currentPropertyId={currentProperty?.id || ''} 
                            onCancel={() => {setShowForm(false); setEditingSale(null);}} 
                            onSuccess={() => { 
                                setShowForm(false); 
                                setEditingSale(null); 
                                cache.invalidate('sales');
                                cache.invalidate('inventory');
                                loadData(); 
                            }} 
                            initialSale={editingSale || undefined} 
                        />
                    </div>
                </div>
            )}
            <ConfirmationModal 
                isOpen={!!itemToDelete} 
                onClose={() => setItemToDelete(null)} 
                onConfirm={async () => { 
                    if (itemToDelete) { 
                        if (itemToDelete.type === 'pos' && canVoid) {
                            await db.deleteSale(itemToDelete.id); 
                            cache.invalidate('sales');
                        } else if (itemToDelete.type === 'booking' && canDeleteBooking) {
                            await db.updateMassageBookingStatus(itemToDelete.id, 'confirmed');
                            cache.invalidate('bookings');
                        }
                        loadData(); 
                    } 
                }} 
                title="Void Recognition" 
                description="Confirm reversal of this revenue event? Inventory stock will be recalculated if applicable." 
                confirmText="Authorize Void" 
                isDestructive={true} 
            />

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

export default Sales;