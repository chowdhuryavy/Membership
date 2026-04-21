
import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, ConfirmationModal } from '../components/ui';
import { db } from '../services/mockSupabase';
import { MembershipCategory, MembershipType } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Trash2, Edit2, Layers, Store, Target, Coins, CalendarClock, Plus, X, Command, Snowflake, Search, SearchCode, ChevronDown, Zap, ShieldCheck, MousePointer } from 'lucide-react';

// This component manages membership categories/tiers for a facility
const Categories = () => {
  const { user } = useAuth();
  const { currentOutlet, hasPermission, formatMoney, checkShortcut } = useSettings();
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [membershipTypes, setMembershipTypes] = useState<MembershipType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | 'all'>('all');
  
  const [formData, setFormData] = useState({ id: '', name: '', duration_months: 1, base_rate: 0, max_freeze_days: 0, membership_type_id: '', privileges: [] as string[], capacity_count: 1 });
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showTypeSelector, setShowTypeSelector] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if(currentOutlet) {
        setLoading(true);
        loadCats();
        db.getMembershipTypes(currentOutlet.id).then(types => {
            setMembershipTypes(types);
            setLoading(false);
        }).catch(() => setLoading(false));
    }
  }, [currentOutlet]);

  const loadCats = () => {
    if(currentOutlet) {
        db.getCategories(currentOutlet.id).then(setCategories);
    }
  };

  const canView = user && hasPermission(user.role_id, 'categories:view');
  const canCreate = user && hasPermission(user.role_id, 'categories:create');
  const canEdit = user && hasPermission(user.role_id, 'categories:edit');
  const canDelete = user && hasPermission(user.role_id, 'categories:delete');
  
  // Can manage implies visibility of the management form
  const canManage = canCreate || canEdit;

  // Shortcuts
  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
        if (showForm) {
            if (checkShortcut(e, 'action_save')) {
                e.preventDefault();
                handleSubmit(e as any);
            }
            if (checkShortcut(e, 'action_cancel')) {
                e.preventDefault();
                handleCancel();
            }
        } else {
            if (checkShortcut(e, 'action_create') && canCreate) {
                e.preventDefault();
                handleAddNew();
            }
        }
    };
    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [showForm, canCreate, checkShortcut, formData, isEditing, currentOutlet]); // Depend on form state

  const filteredCategories = useMemo(() => {
    return categories.filter(cat => {
        const matchesSearch = cat.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = selectedTypeId === 'all' || cat.membership_type_id === selectedTypeId;
        return matchesSearch && matchesType;
    });
  }, [categories, searchTerm, selectedTypeId]);

  if (!canView) {
    return (
        <div className="flex items-center justify-center h-96">
            <Card className="max-w-md text-center p-8 rounded-[2rem] border-red-100 bg-red-50/30">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                   <Target className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Access Denied</h3>
                <p className="text-slate-500 mt-2 text-sm font-medium">Permission insufficient to modify revenue tier architecture.</p>
            </Card>
        </div>
    );
  }

  const resetForm = () => {
      setFormData({ 
          id: '', 
          name: '', 
          duration_months: 1, 
          base_rate: 0, 
          max_freeze_days: 0, 
          membership_type_id: selectedTypeId !== 'all' ? selectedTypeId : (membershipTypes[0]?.id || ''),
          privileges: [],
          capacity_count: 1
      });
      setIsEditing(false);
  };
  
  const handleCancel = () => {
      resetForm();
      setShowForm(false);
  };
  
  const handleAddNew = () => {
      if (!canCreate) return;
      if (membershipTypes.length > 0) {
          setShowTypeSelector(true);
      } else {
          resetForm();
          setShowForm(true);
      }
  };

  const handleTypeSelect = (typeId: string) => {
      setSelectedTypeId(typeId);
      setShowTypeSelector(false);
      setFormData({ 
          id: '', 
          name: '', 
          duration_months: 1, 
          base_rate: 0, 
          max_freeze_days: 0, 
          membership_type_id: typeId,
          privileges: [],
          capacity_count: 1
      });
      setIsEditing(false);
      setShowForm(true);
  };

  const handleEdit = (cat: MembershipCategory) => {
      if (!canEdit) return;
      setFormData({
      ...cat,
      name: cat.name || '',
      duration_months: cat.duration_months || 0,
      base_rate: cat.base_rate || 0,
      max_freeze_days: cat.max_freeze_days || 0,
      membership_type_id: cat.membership_type_id || '',
      privileges: cat.privileges || [],
      capacity_count: cat.capacity_count || 1
    });
      setIsEditing(true);
      setShowForm(true);
  };

  const confirmDelete = async () => {
      if (deleteId && canDelete) {
          await db.deleteCategory(deleteId);
          loadCats();
          setDeleteId(null);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOutlet) return;
    
    // Strict permission check based on action type
    if (isEditing) {
        if (!canEdit) return;
        if (formData.id) {
            await db.updateCategory(formData.id, {
                name: formData.name,
                duration_months: formData.duration_months,
                base_rate: formData.base_rate,
                max_freeze_days: formData.max_freeze_days,
                membership_type_id: formData.membership_type_id,
                privileges: formData.privileges,
                capacity_count: formData.capacity_count
            });
        }
    } else {
        if (!canCreate) return;
        await db.addCategory({
            outlet_id: currentOutlet.id,
            name: formData.name,
            duration_months: formData.duration_months,
            base_rate: formData.base_rate,
            max_freeze_days: formData.max_freeze_days,
            membership_type_id: formData.membership_type_id,
            privileges: formData.privileges,
            capacity_count: formData.capacity_count
        });
    }
    
    handleCancel();
    loadCats();
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="h-px w-6 bg-indigo-600"></span>
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">Revenue Architecture</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Membership Tiers</h1>
          <div className="flex flex-wrap items-center gap-4 mt-1">
            <p className="text-slate-500 text-sm font-medium flex items-center gap-2">
              <Store className="w-3.5 h-3.5 text-slate-400"/> Managing assets for <span className="text-slate-900 font-bold underline decoration-indigo-500 underline-offset-4">{currentOutlet?.name}</span>
            </p>
            {membershipTypes.length > 0 && (
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                    <button 
                        disabled={loading}
                        onClick={() => setSelectedTypeId('all')}
                        className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${selectedTypeId === 'all' ? 'bg-white text-indigo-600 shadow-md border border-slate-100' : 'text-slate-400 hover:text-slate-600'} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        All Types
                    </button>
                    {membershipTypes.map(type => (
                        <button 
                            key={type.id}
                            disabled={loading}
                            onClick={() => setSelectedTypeId(type.id)}
                            className={`px-4 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${selectedTypeId === type.id ? 'bg-white text-indigo-600 shadow-md border border-slate-100' : 'text-slate-400 hover:text-slate-600'} ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {type.name}
                        </button>
                    ))}
                </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0">
            <div className="relative group flex-1 sm:w-64">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input 
                    placeholder="Search tiers..." 
                    className="w-full h-12 pl-11 pr-4 rounded-xl bg-white border border-slate-200 shadow-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all text-sm font-bold placeholder:text-slate-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            {canCreate && (
                <Button onClick={handleAddNew} className="rounded-xl font-black h-12 px-6 shadow-xl shadow-indigo-100 whitespace-nowrap">
                    <Plus className="w-4 h-4 mr-2" /> Create Tier
                </Button>
            )}
        </div>
      </div>
      
      {filteredCategories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[2.5rem] border border-dashed border-slate-200">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <SearchCode className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">No Tiers Found</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-xs">No membership categories match your search criteria.</p>
              {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="mt-4 text-xs font-black text-indigo-600 uppercase tracking-widest border-b-2 border-indigo-100 hover:border-indigo-600 transition-colors">Clear Search</button>
              )}
          </div>
      ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCategories.map(cat => (
                  <Card key={cat.id} className="relative group overflow-hidden border-slate-200/60 shadow-sm hover:shadow-xl transition-all duration-300 rounded-[2rem]">
                      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                          <div className="flex gap-2">
                              {canEdit && (
                                  <button type="button" onClick={() => handleEdit(cat)} className="p-2 bg-white shadow-lg rounded-xl text-slate-400 hover:text-indigo-600 border border-slate-100 transition-colors">
                                      <Edit2 className="w-4 h-4" />
                                  </button>
                              )}
                              {canDelete && (
                                  <button type="button" onClick={() => setDeleteId(cat.id)} className="p-2 bg-white shadow-lg rounded-xl text-slate-400 hover:text-red-600 border border-slate-100 transition-colors">
                                      <Trash2 className="w-4 h-4" />
                                  </button>
                              )}
                          </div>
                      </div>
                      <CardContent className="p-8">
                          <div className="flex items-start gap-4 mb-6">
                              <div className="p-3 bg-indigo-50 rounded-2xl">
                                  <Layers className="w-6 h-6 text-indigo-600" />
                              </div>
                              <div>
                                  <h3 className="font-black text-xl text-slate-900 tracking-tight leading-none mb-2">
                                        {cat.name}
                                        {selectedTypeId === 'all' && cat.membership_type_id && (
                                            <span className="ml-2 text-[8px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 align-middle">
                                                {membershipTypes.find(t => t.id === cat.membership_type_id)?.name}
                                            </span>
                                        )}
                                    </h3>
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue ID: {cat.id.split('_')[1] || cat.id}</span>
                              </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4">
                              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                      <CalendarClock className="w-3 h-3"/> Term
                                  </p>
                                  <p className="text-sm font-black text-slate-800 tracking-tight">{cat.duration_months} Months</p>
                              </div>
                              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                      <Snowflake className="w-3 h-3"/> Max Freeze
                                  </p>
                                  <p className="text-sm font-black text-slate-800 tracking-tight">{cat.max_freeze_days} Days</p>
                              </div>
                              <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
                                  <p className="text-[9px] font-black opacity-60 uppercase tracking-widest mb-1 flex items-center gap-1">
                                      <Coins className="w-3 h-3"/> Base Rate
                                  </p>
                                  <p className="text-lg font-black">{formatMoney(cat.base_rate)}</p>
                              </div>
                          </div>

                          {cat.privileges && cat.privileges.length > 0 && (
                            <div className="mt-6 flex flex-wrap gap-2">
                                {cat.privileges.slice(0, 3).map((p, i) => (
                                    <span key={i} className="text-[8px] font-black bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-tighter">
                                        {p}
                                    </span>
                                ))}
                                {cat.privileges.length > 3 && (
                                    <span className="text-[8px] font-black bg-slate-50 text-slate-400 px-2 py-0.5 rounded border border-slate-100 uppercase tracking-tighter">
                                        +{cat.privileges.length - 3} More
                                    </span>
                                )}
                            </div>
                          )}

                          {cat.membership_type_id && (
                              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
                                  <Target className="w-3 h-3 text-indigo-600" />
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                      {membershipTypes.find(t => t.id === cat.membership_type_id)?.name || 'Unknown Type'}
                                  </span>
                              </div>
                          )}
                      </CardContent>
                  </Card>
              ))}
          </div>
      )}

      {showForm && canManage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg relative">
                <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">
                    <CardHeader className="bg-slate-900 text-white p-8 relative">
                        <CardTitle className="text-xl font-black tracking-tight">{isEditing ? 'Modify Tier' : 'Create Tier'}</CardTitle>
                        <div className="flex items-center gap-2 mt-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue Logic Configuration</p>
                            {formData.membership_type_id && (
                                <>
                                    <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                    <div className="px-2 py-0.5 bg-emerald-500/20 rounded-md border border-emerald-500/30">
                                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                            {membershipTypes.find(t => t.id === formData.membership_type_id)?.name}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                        <button onClick={handleCancel} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </CardHeader>
                    <CardContent className="p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Tier Designation</label>
                                <Input 
                                    value={formData.name} 
                                    onChange={e => setFormData({...formData, name: e.target.value})} 
                                    placeholder="e.g. Platinum Annual"
                                    className="h-12 rounded-xl"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Validity (Months)</label>
                                    <Input 
                                        type="number" 
                                        value={formData.duration_months} 
                                        onChange={e => setFormData({...formData, duration_months: parseInt(e.target.value) || 0})} 
                                        className="h-12 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Max Freeze (Days)</label>
                                    <Input 
                                        type="number" 
                                        value={formData.max_freeze_days} 
                                        onChange={e => setFormData({...formData, max_freeze_days: parseInt(e.target.value) || 0})} 
                                        className="h-12 rounded-xl"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Base Revenue Rate</label>
                                <Input 
                                    type="number" 
                                    value={formData.base_rate} 
                                    onChange={e => setFormData({...formData, base_rate: parseFloat(e.target.value) || 0})} 
                                    className="h-12 rounded-xl"
                                />
                            </div>
                            
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Package Capacity</label>
                                    <div className="relative group">
                                        <Input 
                                            type="number" 
                                            value={formData.capacity_count} 
                                            onChange={e => setFormData({...formData, capacity_count: parseInt(e.target.value) || 1})} 
                                            className="h-12 rounded-xl pl-10"
                                            min={1}
                                        />
                                        <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                                    </div>
                                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">e.g. 2 for "Double"</p>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-900 uppercase tracking-widest ml-1">Privileges</label>
                                    <div className="flex gap-2">
                                        <Input 
                                            id="privilege-input"
                                            placeholder="Add perk..."
                                            className="h-12 rounded-xl"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const val = (e.target as HTMLInputElement).value.trim();
                                                    if (val) {
                                                        setFormData({ ...formData, privileges: [...formData.privileges, val] });
                                                        (e.target as HTMLInputElement).value = '';
                                                    }
                                                }
                                            }}
                                        />
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            className="h-12 w-12 rounded-xl p-0 shrink-0 border-slate-200"
                                            onClick={() => {
                                                const el = document.getElementById('privilege-input') as HTMLInputElement;
                                                const val = el.value.trim();
                                                if (val) {
                                                    setFormData({ ...formData, privileges: [...formData.privileges, val] });
                                                    el.value = '';
                                                }
                                            }}
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {formData.privileges.length > 0 && (
                                <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-300">
                                    {formData.privileges.map((p, i) => (
                                        <span key={i} className="px-3 py-1 bg-white rounded-lg text-[9px] font-black uppercase text-indigo-600 border border-indigo-100 flex items-center gap-2 shadow-sm group/tag">
                                            {p}
                                            <button 
                                                type="button" 
                                                onClick={() => setFormData({ ...formData, privileges: formData.privileges.filter((_, idx) => idx !== i) })}
                                                className="hover:text-red-500 transition-colors"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-3 pt-4">
                                <Button type="button" variant="secondary" onClick={handleCancel} className="flex-1 h-12 rounded-xl font-bold bg-white border-slate-200">
                                    <span className="flex items-center gap-2"><Command className="w-3 h-3 text-slate-400"/> Cancel</span>
                                </Button>
                                <Button type="submit" className="flex-1 h-12 rounded-xl font-black shadow-lg shadow-indigo-100">
                                    <span className="flex items-center gap-2">
                                        {isEditing ? 'Commit Changes' : 'Deploy Tier'}
                                        <Command className="w-3 h-3 opacity-50"/>
                                    </span>
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
      )}

      <ConfirmationModal 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Decommission Tier"
        description="Are you sure you want to delete this membership category? This action may impact historical reporting and future enrollment logic."
        confirmText="Confirm Deletion"
        isDestructive={true}
      />

      {showTypeSelector && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 border border-white/20">
            {/* Header - Fixed */}
            <div className="p-6 sm:p-8 border-b border-slate-100 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase leading-none mb-1.5">Select Type</h2>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Choose tier type</p>
                </div>
                <button onClick={() => setShowTypeSelector(false)} className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content - Scrollable */}
            <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {membershipTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => handleTypeSelect(type.id)}
                    className="group relative p-5 rounded-2xl border-2 border-slate-100 bg-slate-50/50 hover:bg-white hover:border-indigo-600 hover:shadow-xl hover:shadow-indigo-500/5 transition-all text-left overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:opacity-[0.05] group-hover:scale-110 transition-all duration-700 pointer-events-none">
                      <ShieldCheck className="w-16 h-16 -mr-4 -mt-4" />
                    </div>
                    
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm border border-slate-100 flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white group-hover:scale-110 transition-all duration-500">
                      <Zap className="w-5 h-5 text-indigo-600 group-hover:text-white" />
                    </div>
                    
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{type.name}</h3>
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5 group-hover:text-slate-500 transition-colors">Initialize {type.name} Architecture</p>
                    
                    <div className="mt-4 flex items-center gap-2 text-indigo-600 opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all duration-500">
                      <span className="text-[9px] font-black uppercase tracking-widest">Select Type</span>
                      <MousePointer className="w-3 h-3" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Footer - Fixed */}
            <div className="bg-slate-50 p-5 border-t border-slate-100 shrink-0">
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">
                 System will configure tier parameters based on your selection
               </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
