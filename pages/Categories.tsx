
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, ConfirmationModal } from '../components/ui';
import { db } from '../services/mockSupabase';
import { MembershipCategory } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Trash2, Edit2, Layers, Store, Target, Coins, CalendarClock, Plus, X, Command } from 'lucide-react';

// This component manages membership categories/tiers for a facility
const Categories = () => {
  const { user } = useAuth();
  const { currentOutlet, hasPermission, formatMoney, checkShortcut } = useSettings();
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  
  const [formData, setFormData] = useState({ id: '', name: '', duration_months: 1, base_rate: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if(currentOutlet) loadCats();
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

  if (!canView) {
    return (
        <div className="flex items-center justify-center h-96">
            <Card className="max-w-md text-center p-8 rounded-[2rem] border-red-100 bg-red-50/30">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                   <Target className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Access Protocol Rejected</h3>
                <p className="text-slate-500 mt-2 text-sm font-medium">Clearance insufficient to modify revenue tier architecture.</p>
            </Card>
        </div>
    );
  }

  const resetForm = () => {
      setFormData({ id: '', name: '', duration_months: 1, base_rate: 0 });
      setIsEditing(false);
  };
  
  const handleCancel = () => {
      resetForm();
      setShowForm(false);
  };
  
  const handleAddNew = () => {
      if (!canCreate) return;
      resetForm();
      setShowForm(true);
  };

  const handleEdit = (cat: MembershipCategory) => {
      if (!canEdit) return;
      setFormData(cat);
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
                base_rate: formData.base_rate
            });
        }
    } else {
        if (!canCreate) return;
        await db.addCategory({
            outlet_id: currentOutlet.id,
            name: formData.name,
            duration_months: formData.duration_months,
            base_rate: formData.base_rate
        });
    }
    
    handleCancel();
    loadCats();
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="h-px w-6 bg-indigo-600"></span>
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.3em]">Revenue Architecture</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Membership Tiers</h1>
          <p className="text-slate-500 text-sm font-medium mt-1 flex items-center gap-2">
            <Store className="w-3.5 h-3.5 text-slate-400"/> Managing assets for <span className="text-slate-900 font-bold underline decoration-indigo-500 underline-offset-4">{currentOutlet?.name}</span>
          </p>
        </div>
        {canCreate && (
            <Button onClick={handleAddNew} className="rounded-xl font-black h-12 px-6 shadow-xl shadow-indigo-100">
                <Plus className="w-4 h-4 mr-2" /> Create New category
            </Button>
        )}
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map(cat => (
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
                              <h3 className="font-black text-xl text-slate-900 tracking-tight leading-none mb-2">{cat.name}</h3>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Revenue ID: {cat.id.split('_')[1] || cat.id}</span>
                          </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                  <CalendarClock className="w-3 h-3"/> Term
                              </p>
                              <p className="text-sm font-black text-slate-800 tracking-tight">{cat.duration_months} Months</p>
                          </div>
                          <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
                              <p className="text-[9px] font-black opacity-60 uppercase tracking-widest mb-1 flex items-center gap-1">
                                  <Coins className="w-3 h-3"/> Base Rate
                              </p>
                              <p className="text-lg font-black">{formatMoney(cat.base_rate)}</p>
                          </div>
                      </div>
                  </CardContent>
              </Card>
          ))}
      </div>

      {showForm && canManage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg relative">
                <Card className="rounded-[2.5rem] border-slate-200/60 shadow-xl overflow-hidden animate-in zoom-in-95 duration-300">
                    <CardHeader className="bg-slate-900 text-white p-8 relative">
                        <CardTitle className="text-xl font-black tracking-tight">{isEditing ? 'Modify Tier' : 'Create Tier'}</CardTitle>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Revenue Logic Configuration</p>
                        <button onClick={handleCancel} className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </CardHeader>
                    <CardContent className="p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tier Designation</label>
                                <Input 
                                    value={formData.name} 
                                    onChange={e => setFormData({...formData, name: e.target.value})} 
                                    placeholder="e.g. Platinum Annual"
                                    className="h-12 rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Validity (Months)</label>
                                <Input 
                                    type="number" 
                                    value={formData.duration_months} 
                                    onChange={e => setFormData({...formData, duration_months: parseInt(e.target.value) || 0})} 
                                    className="h-12 rounded-xl"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Base Revenue Rate</label>
                                <Input 
                                    type="number" 
                                    value={formData.base_rate} 
                                    onChange={e => setFormData({...formData, base_rate: parseFloat(e.target.value) || 0})} 
                                    className="h-12 rounded-xl"
                                />
                            </div>
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
    </div>
  );
};

export default Categories;
