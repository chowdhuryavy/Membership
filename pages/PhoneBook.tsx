import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BookUser, 
  Search, 
  Plus, 
  Download, 
  Store, 
  Building2, 
  Phone, 
  Mail, 
  Tag, 
  UserCheck, 
  Calendar, 
  Globe, 
  IdCard, 
  FileText, 
  Trash2, 
  Edit3, 
  RefreshCw, 
  X, 
  ExternalLink,
  Shield,
  Layers,
  Sparkles,
  Users
} from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../services/mockSupabase';
import { PhoneBookContact, Outlet } from '../types';
import { Button, Card, CardHeader, CardTitle, CardContent, Input, ConfirmationModal } from '../components/ui';
import { WhatsAppIcon } from '../components/WhatsAppIcon';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export const PhoneBook: React.FC = () => {
  const { currentProperty, currentOutlet, userAllowedOutlets, outlets, hasPermission } = useSettings();
  const { user, isSuperAdmin, isOwner } = useAuth();

  // Permission check
  const canView = isSuperAdmin || isOwner || hasPermission(user?.role_id || '', 'phonebook:view' as any) || hasPermission(user?.role_id || '', 'members:view' as any);
  const canCreate = isSuperAdmin || isOwner || hasPermission(user?.role_id || '', 'phonebook:create' as any) || hasPermission(user?.role_id || '', 'members:create' as any);
  const canEdit = isSuperAdmin || isOwner || hasPermission(user?.role_id || '', 'phonebook:edit' as any) || hasPermission(user?.role_id || '', 'members:edit' as any);
  const canDelete = isSuperAdmin || isOwner || hasPermission(user?.role_id || '', 'phonebook:delete' as any) || hasPermission(user?.role_id || '', 'members:delete' as any);
  const canExport = isSuperAdmin || isOwner || hasPermission(user?.role_id || '', 'phonebook:export' as any) || hasPermission(user?.role_id || '', 'reports:export' as any) || hasPermission(user?.role_id || '', 'members:export' as any);

  // Property outlets
  const propertyOutlets = useMemo(() => {
    if (!currentProperty) return [];
    return outlets.filter(o => o.property_id === currentProperty.id);
  }, [currentProperty, outlets]);

  // Outlets the user is allowed to access in this property
  const allowedOutletsInProperty = useMemo(() => {
    if (!currentProperty || !user) return [];
    if (isSuperAdmin || isOwner || user.role_id?.toLowerCase() === 'admin' || user.role_id?.toLowerCase() === 'system_admin') {
      return propertyOutlets;
    }
    return propertyOutlets.filter(o => user.allowed_outlets?.includes(o.id));
  }, [currentProperty, user, propertyOutlets, isSuperAdmin, isOwner]);

  // Dynamic scope toggle: If a property has only one outlet, no need for outlet & property toggle.
  // It appears dynamically if another outlet is created!
  const canSwitchScope = Boolean(propertyOutlets.length > 1 && allowedOutletsInProperty.length > 1);

  // Scope Mode: 'outlet' vs 'property'
  const [scopeMode, setScopeMode] = useState<'outlet' | 'property'>('outlet');
  const [selectedOutletFilter, setSelectedOutletFilter] = useState<string>('all');

  // Currently active selected outlet in the page view
  const activeSelectedOutletId = useMemo(() => {
    if (scopeMode === 'outlet' && currentOutlet?.id) {
      return currentOutlet.id;
    }
    if (selectedOutletFilter && selectedOutletFilter !== 'all') {
      return selectedOutletFilter;
    }
    return currentOutlet?.id || allowedOutletsInProperty[0]?.id || '';
  }, [scopeMode, currentOutlet, selectedOutletFilter, allowedOutletsInProperty]);

  // Contacts state
  const [contacts, setContacts] = useState<PhoneBookContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'Member' | 'PT Member' | 'Spa Booking' | 'Entrance Fee' | 'Manual'>('all');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewingContact, setViewingContact] = useState<PhoneBookContact | null>(null);
  const [editingContact, setEditingContact] = useState<PhoneBookContact | null>(null);
  const [contactToDelete, setContactToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<PhoneBookContact>>({
    name: '',
    phone: '',
    email: '',
    outlet_id: '',
    category: 'General Contact',
    nationality: '',
    dob: '',
    notes: ''
  });

  // Load Contacts
  const loadContacts = useCallback(async () => {
    if (!currentProperty) return;
    setLoading(true);
    try {
      let targetOutletIds: string[] = [];

      if ((!canSwitchScope || scopeMode === 'outlet') && currentOutlet) {
        targetOutletIds = [currentOutlet.id];
      } else {
        // Property mode: all allowed outlets in this property
        targetOutletIds = allowedOutletsInProperty.map(o => o.id);
      }

      const res = await db.getPhoneBookContacts(currentProperty.id, targetOutletIds);
      setContacts(res);
    } catch (err: any) {
      console.error('Error loading phone book contacts:', err);
      toast.error('Failed to load guest directory');
    } finally {
      setLoading(false);
    }
  }, [currentProperty, currentOutlet, scopeMode, canSwitchScope, allowedOutletsInProperty]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    return contacts.filter(c => {
      // 1. Outlet filter (if in property mode and a specific outlet filter is chosen)
      if (scopeMode === 'property' && selectedOutletFilter !== 'all') {
        if (c.outlet_id !== selectedOutletFilter) return false;
      }

      // 2. Source filter
      if (sourceFilter !== 'all' && c.source !== sourceFilter) return false;

      // 3. Search query
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim();
        const matchesName = c.name?.toLowerCase().includes(query);
        const matchesPhone = c.phone?.toLowerCase().includes(query);
        const matchesEmail = c.email?.toLowerCase().includes(query);
        const matchesQid = c.qid_passport?.toLowerCase().includes(query);
        const matchesMemNo = c.membership_number?.toLowerCase().includes(query);
        const matchesNotes = c.notes?.toLowerCase().includes(query);
        const matchesTags = c.tags?.some(t => t.toLowerCase().includes(query));

        if (!matchesName && !matchesPhone && !matchesEmail && !matchesQid && !matchesMemNo && !matchesNotes && !matchesTags) {
          return false;
        }
      }

      return true;
    });
  }, [contacts, scopeMode, selectedOutletFilter, sourceFilter, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const total = contacts.length;
    const members = contacts.filter(c => c.source === 'Member').length;
    const pt = contacts.filter(c => c.source === 'PT Member').length;
    const dayPass = contacts.filter(c => c.source === 'Entrance Fee').length;
    const spa = contacts.filter(c => c.source === 'Spa Booking').length;
    const withPhone = contacts.filter(c => !!c.phone && c.phone.trim().length > 3).length;
    return { total, members, pt, dayPass, spa, withPhone };
  }, [contacts]);

  // Outlet map for display
  const outletMap = useMemo(() => {
    return Object.fromEntries(outlets.map(o => [o.id, o.name]));
  }, [outlets]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    const defaultOutletId = scopeMode === 'property'
      ? ((selectedOutletFilter && selectedOutletFilter !== 'all') ? selectedOutletFilter : (currentOutlet?.id || allowedOutletsInProperty[0]?.id || ''))
      : (currentOutlet?.id || allowedOutletsInProperty[0]?.id || '');

    setFormData({
      name: '',
      phone: '',
      email: '',
      property_id: currentProperty?.id || '',
      outlet_id: defaultOutletId,
      category: 'General Contact',
      nationality: '',
      dob: '',
      notes: ''
    });
    setEditingContact(null);
    setShowAddModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (contact: PhoneBookContact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      phone: contact.phone,
      email: contact.email || '',
      property_id: contact.property_id || currentProperty?.id || '',
      outlet_id: scopeMode === 'property'
        ? (contact.outlet_id || (selectedOutletFilter !== 'all' ? selectedOutletFilter : currentOutlet?.id) || allowedOutletsInProperty[0]?.id || '')
        : (currentOutlet?.id || contact.outlet_id || ''),
      category: contact.category || 'General Contact',
      nationality: contact.nationality || '',
      dob: contact.dob || '',
      notes: contact.notes || ''
    });
    setShowAddModal(true);
  };

  // Save Contact
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      toast.error('Please enter the guest name');
      return;
    }
    if (!formData.phone?.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    setIsSaving(true);
    try {
      const targetOutletId = scopeMode === 'property'
        ? (formData.outlet_id || (selectedOutletFilter !== 'all' ? selectedOutletFilter : currentOutlet?.id) || allowedOutletsInProperty[0]?.id)
        : (currentOutlet?.id || activeSelectedOutletId);

      const payload: Partial<PhoneBookContact> = {
        ...formData,
        id: editingContact?.id,
        property_id: currentProperty?.id,
        outlet_id: targetOutletId,
        source: editingContact?.source || 'Manual'
      };

      await db.savePhoneBookContact(payload);
      toast.success(editingContact ? 'Contact updated successfully' : 'Guest registered in Phone Book');
      setShowAddModal(false);
      loadContacts();
    } catch (err: any) {
      console.error('Error saving contact:', err);
      toast.error('Failed to save contact');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Contact
  const handleConfirmDelete = async () => {
    if (!contactToDelete) return;
    try {
      await db.deletePhoneBookContact(contactToDelete.id);
      toast.success('Contact removed');
      if (viewingContact?.id === contactToDelete.id) {
        setViewingContact(null);
      }
      loadContacts();
    } catch (err: any) {
      toast.error('Failed to delete contact');
    } finally {
      setContactToDelete(null);
    }
  };

  // Clean phone number for WhatsApp
  const getCleanPhone = (phoneStr?: string) => {
    if (!phoneStr) return '';
    const digits = phoneStr.replace(/\D/g, '');
    return digits;
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredContacts.length === 0) {
      toast.error('No contacts to export');
      return;
    }

    const headers = ['Full Name', 'Phone', 'Email', 'Source', 'Category', 'Outlet', 'Property', 'Membership No', 'QID/Passport', 'Nationality', 'Notes'];
    const rows = filteredContacts.map(c => [
      `"${c.name || ''}"`,
      `"${c.phone || ''}"`,
      `"${c.email || ''}"`,
      `"${c.source || ''}"`,
      `"${c.category || ''}"`,
      `"${outletMap[c.outlet_id] || ''}"`,
      `"${currentProperty?.name || ''}"`,
      `"${c.membership_number || ''}"`,
      `"${c.qid_passport || ''}"`,
      `"${c.nationality || ''}"`,
      `"${(c.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PhoneBook_${currentProperty?.name}_${scopeMode.toUpperCase()}_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Directory exported successfully');
  };

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md text-center p-8 border-red-100 bg-red-50/30 rounded-[2rem]">
          <Shield className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Operational Security Lock</h3>
          <p className="text-slate-500 mt-2 text-sm font-bold uppercase tracking-tight">Access to Phone Book & Directory is restricted to authorized personnel.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* 1. TOP HEADER & SCOPE BAR */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-8 rounded-[2.5rem] border border-slate-200/60 shadow-xl">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-indigo-100 shrink-0">
            <BookUser className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">Phone Book</h1>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[9px] font-black uppercase tracking-wider border border-indigo-100">
                Directory
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Store className="w-3 h-3 text-indigo-400" /> {currentOutlet?.name || currentProperty?.name}
              </p>
              {canSwitchScope && (
                <>
                  <div className="h-3 w-px bg-slate-200 hidden sm:block"></div>
                  <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setScopeMode('outlet')}
                      className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                        scopeMode === 'outlet'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <Store className="w-2.5 h-2.5" /> Outlet
                    </button>
                    <button
                      type="button"
                      onClick={() => setScopeMode('property')}
                      className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                        scopeMode === 'property'
                          ? 'bg-white text-indigo-600 shadow-sm'
                          : 'text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <Building2 className="w-2.5 h-2.5" /> Property
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT CONTROLS & ACTIONS */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
          {/* Specific outlet filter dropdown (only shown when Property scope is active with multiple outlets) */}
          {canSwitchScope && scopeMode === 'property' && allowedOutletsInProperty.length > 1 && (
            <select
              value={selectedOutletFilter}
              onChange={e => setSelectedOutletFilter(e.target.value)}
              className="h-12 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] font-black uppercase tracking-wider text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="all">All Outlets in Property</option>
              {allowedOutletsInProperty.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}

          {/* ACTION BUTTONS */}
          <Button 
            variant="outline" 
            onClick={loadContacts} 
            disabled={loading}
            className="h-12 w-12 rounded-2xl p-0 border-slate-200 hover:bg-slate-50 cursor-pointer"
            title="Refresh Directory"
          >
            <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          {canExport && (
            <Button 
              variant="outline" 
              onClick={handleExportCSV}
              className="h-12 px-5 rounded-2xl border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-800 font-black text-[10px] uppercase tracking-widest shadow-sm cursor-pointer"
            >
              <Download className="w-4 h-4 mr-2 text-emerald-600" /> Export CSV
            </Button>
          )}

          {canCreate && (
            <Button 
              onClick={handleOpenAddModal}
              className="h-12 px-6 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-700 font-black text-[11px] uppercase tracking-[0.15em] shadow-xl shadow-indigo-100 cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-2" /> Add Contact
            </Button>
          )}

        </div>
      </div>

      {/* 2. STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Total Contacts</span>
            <span className="text-2xl font-black text-slate-900 tracking-tight">{stats.total}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Club Members</span>
            <span className="text-2xl font-black text-slate-900 tracking-tight">{stats.members}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Spa Guests</span>
            <span className="text-2xl font-black text-slate-900 tracking-tight">{stats.spa}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200/60 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Day Pass Visitors</span>
            <span className="text-2xl font-black text-slate-900 tracking-tight">{stats.dayPass}</span>
          </div>
        </div>
      </div>

      {/* 3. SEARCH & SOURCE FILTER BAR */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200/60 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* SEARCH INPUT */}
          <div className="relative w-full md:max-w-md">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name, phone, email, QID or notes..." 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              className="w-full h-12 pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* SOURCE TABS */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {(['all', 'Member', 'PT Member', 'Spa Booking', 'Entrance Fee', 'Manual'] as const).map(source => {
              const count = source === 'all' 
                ? contacts.length 
                : contacts.filter(c => c.source === source).length;

              const labelMap: Record<string, string> = {
                'all': 'All Sources',
                'Member': 'Members',
                'PT Member': 'PT Clients',
                'Spa Booking': 'Spa Guests',
                'Entrance Fee': 'Day Pass',
                'Manual': 'Direct Registry'
              };

              return (
                <button
                  key={source}
                  type="button"
                  onClick={() => setSourceFilter(source)}
                  className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                    sourceFilter === source
                      ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <span>{labelMap[source]}</span>
                  <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[8px] font-mono ${
                    sourceFilter === source ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* 4. CONTACTS DIRECTORY TABLE */}
      <Card className="rounded-[2.5rem] border-slate-200/60 shadow-2xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-950 text-white p-8 border-b border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <CardTitle className="text-sm font-black uppercase tracking-[0.25em] flex items-center gap-3">
                <BookUser className="w-4 h-4 text-indigo-400" /> Guest Contact Ledger
              </CardTitle>
              <span className="text-[10px] font-mono bg-slate-900 px-2.5 py-0.5 rounded-full border border-slate-800 text-indigo-300">
                {filteredContacts.length} Contacts Shown
              </span>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
              Scope: {!canSwitchScope || scopeMode === 'outlet' ? (currentOutlet?.name || currentProperty?.name) : `${currentProperty?.name} (All Accessible Outlets)`}
            </p>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="py-24 text-center space-y-4">
              <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mx-auto opacity-80" />
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Unified Directory...</p>
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="py-24 text-center space-y-4">
              <BookUser className="w-16 h-16 text-slate-300 mx-auto" />
              <h3 className="text-lg font-black uppercase text-slate-700 tracking-tight">No Guest Contacts Found</h3>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider max-w-sm mx-auto">
                No contacts matched your search query or facility filter. Use "Add Contact" to register new guests.
              </p>
              {canCreate && (
                <Button onClick={handleOpenAddModal} className="h-11 px-6 rounded-2xl font-black text-xs uppercase bg-indigo-600 text-white shadow-xl shadow-indigo-100">
                  <Plus className="w-4 h-4 mr-2" /> Add First Contact
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-6 py-4 w-12 text-center">SL</th>
                    <th className="px-6 py-4">Guest Profile</th>
                    <th className="px-6 py-4">Contact Phone & WhatsApp</th>
                    <th className="px-6 py-4">Email Address</th>
                    <th className="px-6 py-4">Source & Tags</th>
                    <th className="px-6 py-4">Facility Outlet</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredContacts.map((contact, idx) => {
                    const cleanPhone = getCleanPhone(contact.phone);
                    const canManageContact = isSuperAdmin || isOwner || !contact.outlet_id || allowedOutletsInProperty.some(o => o.id === contact.outlet_id);

                    return (
                      <tr key={contact.id} className="hover:bg-indigo-50/20 transition-colors group">
                        
                        {/* SL NO */}
                        <td className="px-6 py-5 text-center font-mono text-slate-400 text-[11px] font-bold">
                          {idx + 1}
                        </td>

                        {/* GUEST PROFILE */}
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shadow-sm shrink-0">
                              {contact.name?.charAt(0)?.toUpperCase() || 'G'}
                            </div>
                            <div>
                              <div className="font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                <span>{contact.name}</span>
                                {contact.membership_number && (
                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                                    #{contact.membership_number}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] font-bold text-slate-400">
                                {contact.nationality && <span>{contact.nationality}</span>}
                                {contact.qid_passport && (
                                  <>
                                    <span>&bull;</span>
                                    <span className="font-mono">ID: {contact.qid_passport}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* PHONE & WHATSAPP */}
                        <td className="px-6 py-5">
                          {contact.phone ? (
                            <div className="flex items-center gap-2">
                              <a
                                href={`tel:${contact.phone}`}
                                className="font-mono font-black text-slate-900 hover:text-indigo-600 transition-colors text-xs flex items-center gap-1.5"
                                title="Click to call"
                              >
                                <Phone className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600" />
                                {contact.phone}
                              </a>

                              {cleanPhone && (
                                <a
                                  href={`https://wa.me/${cleanPhone}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-xs"
                                  title="Chat on WhatsApp"
                                >
                                  <WhatsAppIcon className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-bold italic text-[11px]">No Phone Provided</span>
                          )}
                        </td>

                        {/* EMAIL */}
                        <td className="px-6 py-5">
                          {contact.email ? (
                            <a
                              href={`mailto:${contact.email}`}
                              className="font-bold text-slate-600 hover:text-indigo-600 transition-colors text-xs flex items-center gap-1.5"
                              title="Click to email"
                            >
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              {contact.email}
                            </a>
                          ) : (
                            <span className="text-slate-300 font-bold italic text-[11px]">No Email</span>
                          )}
                        </td>

                        {/* SOURCE & TAGS */}
                        <td className="px-6 py-5">
                          <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                              contact.source === 'Member'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                                : contact.source === 'Spa Booking'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-100'
                                  : contact.source === 'Entrance Fee'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                    : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                            }`}>
                              {contact.source}
                            </span>

                            {(contact.tags || []).slice(0, 2).map((tag, tIdx) => (
                              <span key={tIdx} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[8.5px] font-bold">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* OUTLET */}
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-bold text-slate-700 text-xs">
                              {outletMap[contact.outlet_id] || (scopeMode === 'outlet' ? currentOutlet?.name : 'Facility Context')}
                            </span>
                          </div>
                        </td>

                        {/* ACTIONS */}
                        <td className="px-6 py-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              onClick={() => setViewingContact(contact)}
                              className="h-8 px-2.5 rounded-xl border-slate-200 text-slate-600 hover:text-indigo-600 text-[10px] font-black uppercase transition-all cursor-pointer"
                              title="View dossier"
                            >
                              <FileText className="w-3.5 h-3.5 mr-1 text-slate-400 group-hover:text-indigo-600" /> Dossier
                            </Button>

                            {canEdit && canManageContact && (
                              <button
                                type="button"
                                onClick={() => handleOpenEdit(contact)}
                                className="h-8 w-8 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-all border border-transparent hover:border-indigo-200 cursor-pointer"
                                title="Edit Contact"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {canDelete && canManageContact && (
                              <button
                                type="button"
                                onClick={() => setContactToDelete({ id: contact.id, name: contact.name })}
                                className="h-8 w-8 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 flex items-center justify-center transition-all border border-transparent hover:border-rose-200 cursor-pointer"
                                title="Delete Contact"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>

                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. ADD / EDIT CONTACT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] max-w-xl w-full p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar">
            
            <div className="flex items-center justify-between pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-black">
                  <BookUser className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    {editingContact ? 'Modify Guest Contact' : 'Register Guest in Phone Book'}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
                    Property: {currentProperty?.name}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6 pt-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">
                    Full Legal Name *
                  </label>
                  <Input 
                    required 
                    value={formData.name || ''} 
                    onChange={e => setFormData({ ...formData, name: e.target.value })} 
                    placeholder="e.g. Sheikh Mohammed Al-Thani"
                    className="h-14 rounded-2xl font-bold border-2"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">
                    Phone / Mobile *
                  </label>
                  <Input 
                    required 
                    value={formData.phone || ''} 
                    onChange={e => setFormData({ ...formData, phone: e.target.value })} 
                    placeholder="e.g. +974 5555 1234"
                    className="h-14 rounded-2xl font-mono font-bold border-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">
                    Email Address
                  </label>
                  <Input 
                    type="email"
                    value={formData.email || ''} 
                    onChange={e => setFormData({ ...formData, email: e.target.value })} 
                    placeholder="guest@domain.com"
                    className="h-14 rounded-2xl font-bold border-2"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                      Facility Outlet *
                    </label>
                    {scopeMode !== 'property' ? (
                      <span className="text-[8.5px] font-bold text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        Header Selected Outlet
                      </span>
                    ) : (
                      <span className="text-[8.5px] font-bold text-slate-400 uppercase tracking-widest">
                        Property Scope
                      </span>
                    )}
                  </div>

                  {scopeMode !== 'property' ? (
                    <div className="relative">
                      <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-600 pointer-events-none" />
                      <select
                        disabled
                        value={currentOutlet?.id || allowedOutletsInProperty[0]?.id || ''}
                        className="w-full h-14 pl-11 pr-28 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-black uppercase text-slate-800 outline-none cursor-not-allowed appearance-none"
                      >
                        <option value={currentOutlet?.id || allowedOutletsInProperty[0]?.id || ''}>
                          {currentOutlet?.name || allowedOutletsInProperty[0]?.name || 'Selected Outlet'}
                        </option>
                      </select>
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-[9px] font-black uppercase tracking-wider text-indigo-600 pointer-events-none">
                        Active Outlet
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <select
                        value={formData.outlet_id || (selectedOutletFilter !== 'all' ? selectedOutletFilter : currentOutlet?.id) || allowedOutletsInProperty[0]?.id}
                        onChange={e => setFormData({ ...formData, outlet_id: e.target.value })}
                        className="w-full h-14 pl-11 pr-4 bg-white border-2 border-slate-200 rounded-2xl text-xs font-black uppercase text-slate-800 outline-none focus:border-indigo-600 cursor-pointer"
                      >
                        {allowedOutletsInProperty.map(o => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">
                    Classification / Category
                  </label>
                  <select
                    value={formData.category || 'General Contact'}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                    className="w-full h-14 px-4 bg-white border-2 border-slate-200 rounded-2xl text-xs font-black uppercase text-slate-800 outline-none focus:border-indigo-600"
                  >
                    <option value="General Contact">General Contact</option>
                    <option value="VIP Guest">VIP Guest</option>
                    <option value="Hotel Resident">Hotel Resident</option>
                    <option value="Spa Guest">Spa Guest</option>
                    <option value="Day Pass Visitor">Day Pass Visitor</option>
                    <option value="Corporate Partner">Corporate Partner</option>
                    <option value="Prospective Member">Prospective Member</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">
                    Nationality / Country
                  </label>
                  <Input 
                    value={formData.nationality || ''} 
                    onChange={e => setFormData({ ...formData, nationality: e.target.value })} 
                    placeholder="e.g. Qatari, British, French"
                    className="h-14 rounded-2xl font-bold border-2"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-2">
                  Special Notes & Preferences
                </label>
                <textarea
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Preferences, locker instructions, health mentions, or contact requirements..."
                  className="w-full min-h-[90px] p-4 rounded-2xl border-2 border-slate-200 font-medium text-xs focus:outline-none focus:border-indigo-600 transition-all custom-scrollbar"
                />
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 h-14 rounded-2xl font-black uppercase text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={isSaving}
                  className="w-1/2 h-14 rounded-2xl font-black uppercase text-xs bg-indigo-600 text-white shadow-xl shadow-indigo-100 hover:bg-indigo-700"
                >
                  {editingContact ? 'Commit Changes' : 'Save To Directory'}
                </Button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* 6. VIEW DOSSIER MODAL */}
      {viewingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] max-w-lg w-full p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar space-y-6">
            
            <div className="flex items-center justify-between pb-6 border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-md">
                  {viewingContact.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    {viewingContact.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase">
                      {viewingContact.category || viewingContact.source}
                    </span>
                    {viewingContact.status && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase">
                        {viewingContact.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setViewingContact(null)}
                className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* QUICK COMM ACTIONS */}
            <div className="grid grid-cols-2 gap-3">
              {viewingContact.phone && (
                <a
                  href={`tel:${viewingContact.phone}`}
                  className="flex items-center justify-center gap-2 h-12 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-2xl font-black text-xs uppercase tracking-wider transition-all"
                >
                  <Phone className="w-4 h-4 text-indigo-600" /> Call Direct
                </a>
              )}

              {getCleanPhone(viewingContact.phone) && (
                <a
                  href={`https://wa.me/${getCleanPhone(viewingContact.phone)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-100"
                >
                  <WhatsAppIcon className="w-4 h-4" /> WhatsApp Chat
                </a>
              )}
            </div>

            {/* DETAILS GRID */}
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Phone Number</span>
                <span className="font-mono font-black text-slate-900 text-sm">{viewingContact.phone || 'N/A'}</span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Email Address</span>
                <span className="font-bold text-slate-900">{viewingContact.email || 'N/A'}</span>
              </div>

              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Registered Facility</span>
                <span className="font-bold text-slate-900">{outletMap[viewingContact.outlet_id] || 'Property Context'}</span>
              </div>

              {viewingContact.membership_number && (
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Membership No.</span>
                  <span className="font-mono font-black text-indigo-600">#{viewingContact.membership_number}</span>
                </div>
              )}

              {viewingContact.qid_passport && (
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">QID / Passport</span>
                  <span className="font-mono font-bold text-slate-800">{viewingContact.qid_passport}</span>
                </div>
              )}

              {viewingContact.nationality && (
                <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px]">Nationality</span>
                  <span className="font-bold text-slate-800">{viewingContact.nationality}</span>
                </div>
              )}

              {viewingContact.notes && (
                <div className="pt-2 space-y-1">
                  <span className="font-bold text-slate-400 uppercase tracking-widest text-[10px] block">Recorded Notes</span>
                  <p className="text-slate-700 leading-relaxed font-medium bg-white p-3 rounded-xl border border-slate-200">
                    {viewingContact.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              {canEdit && (isSuperAdmin || isOwner || !viewingContact.outlet_id || allowedOutletsInProperty.some(o => o.id === viewingContact.outlet_id)) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const c = viewingContact;
                    setViewingContact(null);
                    handleOpenEdit(c);
                  }}
                  className="flex-1 h-12 rounded-2xl border-slate-200 text-slate-700 hover:text-indigo-600 hover:border-indigo-300 font-black uppercase text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Edit3 className="w-4 h-4 text-indigo-600" /> Edit Contact
                </Button>
              )}
              {canDelete && (isSuperAdmin || isOwner || !viewingContact.outlet_id || allowedOutletsInProperty.some(o => o.id === viewingContact.outlet_id)) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setContactToDelete({ id: viewingContact.id, name: viewingContact.name })}
                  className="h-12 px-4 rounded-2xl border-rose-200 text-rose-600 hover:bg-rose-50 font-black uppercase text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
              )}
              <Button
                type="button"
                onClick={() => setViewingContact(null)}
                className="flex-1 h-12 rounded-2xl bg-slate-900 text-white font-black uppercase text-xs cursor-pointer"
              >
                Close
              </Button>
            </div>

          </div>
        </div>
      )}

      {/* 7. APP DEFAULT CONFIRMATION MODAL */}
      <ConfirmationModal
        isOpen={!!contactToDelete}
        onClose={() => setContactToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Remove Contact"
        description={`Are you sure you want to remove ${contactToDelete?.name || 'this contact'} from the Phone Book?`}
        confirmText="Remove Contact"
        isDestructive={true}
      />

    </div>
  );
};
