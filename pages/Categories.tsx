
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, ConfirmationModal } from '../components/ui';
import { db } from '../services/mockSupabase';
import { MembershipCategory } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { Trash2, Edit2, Plus, Save, X, Store } from 'lucide-react';

const Categories = () => {
  const { user } = useAuth();
  const { currentOutlet, hasPermission, formatMoney, currency } = useSettings();
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  
  // Form/Edit State
  const [formData, setFormData] = useState({ id: '', name: '', duration_months: 1, base_rate: 0 });
  const [isEditing, setIsEditing] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if(currentOutlet) loadCats();
  }, [currentOutlet]);

  const loadCats = () => {
    if(currentOutlet) {
        db.getCategories(currentOutlet.id).then(setCategories);
    }
  };

  if (!user || !hasPermission(user.role_id, 'manage_categories')) {
    return (
        <div className="flex items-center justify-center h-96">
            <Card className="max-w-md text-center p-6">
                <h3 className="text-lg font-bold text-red-600">Access Denied</h3>
                <p className="text-slate-600 mt-2">Only Administrators or authorized staff can manage membership categories.</p>
            </Card>
        </div>
    );
  }

  const resetForm = () => {
      setFormData({ id: '', name: '', duration_months: 1, base_rate: 0 });
      setIsEditing(false);
  };

  const handleEdit = (cat: MembershipCategory) => {
      setFormData(cat);
      setIsEditing(true);
  };

  const confirmDelete = async () => {
      if (deleteId) {
          await db.deleteCategory(deleteId);
          loadCats();
          setDeleteId(null);
      }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || formData.base_rate <= 0 || !currentOutlet) return;
    
    if (isEditing && formData.id) {
        await db.updateCategory(formData.id, {
            name: formData.name,
            duration_months: formData.duration_months,
            base_rate: formData.base_rate
        });
    } else {
        await db.addCategory({
            outlet_id: currentOutlet.id,
            name: formData.name,
            duration_months: formData.duration_months,
            base_rate: formData.base_rate
        });
    }
    
    resetForm();
    loadCats();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Membership Categories</h1>
        <p className="text-sm text-slate-500 flex items-center gap-1">
            <Store className="w-3 h-3"/> Managing: <span className="font-semibold text-slate-700">{currentOutlet?.name}</span>
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {categories.map(cat => (
                    <Card key={cat.id} className="relative group">
                        <CardContent className="p-6">
                            <div className="flex justify-between items-start">
                                <h3 className="font-bold text-lg text-slate-800">{cat.name}</h3>
                                <div className="flex gap-1">
                                    <button type="button" onClick={() => handleEdit(cat)} className="p-1 text-slate-400 hover:text-indigo-600">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button type="button" onClick={() => setDeleteId(cat.id)} className="p-1 text-slate-400 hover:text-red-600">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="mt-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Duration</span>
                                    <span>{cat.duration_months} Months</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Base Rate</span>
                                    <span className="font-semibold">{formatMoney(cat.base_rate)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                {categories.length === 0 && (
                    <div className="col-span-full py-10 text-center text-slate-400 italic bg-slate-50 rounded-lg border border-dashed border-slate-300">
                        No categories found for this outlet.
                    </div>
                )}
            </div>
        </div>

        <div>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>{isEditing ? 'Edit Category' : 'Add Category'}</CardTitle>
                        {isEditing && (
                            <button onClick={resetForm} className="text-xs text-slate-500 hover:text-slate-900">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <Input 
                            label="Category Name" 
                            value={formData.name} 
                            onChange={e => setFormData({...formData, name: e.target.value})} 
                        />
                        <Input 
                            type="number" 
                            label="Duration (Months)" 
                            min={1}
                            value={formData.duration_months} 
                            onChange={e => setFormData({...formData, duration_months: parseInt(e.target.value)})} 
                        />
                        <Input 
                            type="number" 
                            label={`Base Rate (${currency?.symbol || '$'})`} 
                            min={0}
                            value={formData.base_rate} 
                            onChange={e => setFormData({...formData, base_rate: parseFloat(e.target.value)})} 
                        />
                        <Button type="submit" className="w-full">
                            {isEditing ? <><Save className="w-4 h-4 mr-2"/> Update Category</> : <><Plus className="w-4 h-4 mr-2"/> Create Category</>}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Delete Category"
        description="Are you sure? Members linked to this category might display incorrect data if not updated."
        confirmText="Delete Category"
        isDestructive={true}
      />
    </div>
  );
};

export default Categories;
