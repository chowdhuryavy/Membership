import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../services/mockSupabase';
import { Member, MembershipCategory, MemberStatus, Staff } from '../types';
import MemberLedger from './membership/MemberLedger';
import MemberEnrollmentForm from './membership/MemberEnrollmentForm';
import MemberProfileView from './membership/MemberProfileView';
import { ConfirmationModal } from '../components/ui';

const Members = () => {
  const { user } = useAuth();
  const { currentOutlet, currentProperty, hasPermission, outlets = [] } = useSettings();
  
  // View State
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [viewScope, setViewScope] = useState<'outlet' | 'property'>('outlet');
  
  // Data State
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isRenewal, setIsRenewal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const allowedOutletsInProperty = useMemo(() => {
    if (!currentProperty || !user || !outlets || !Array.isArray(outlets)) return [];
    if (user.role_id?.toLowerCase() === 'admin') {
        return outlets.filter(o => o.property_id === currentProperty.id);
    }
    return outlets.filter(o => 
        o.property_id === currentProperty.id && 
        user.allowed_outlets?.includes(o.id)
    );
  }, [currentProperty, user, outlets]);

  // Permissions
  const canView = user && hasPermission(user.role_id, 'members:view');

  const loadData = async () => {
    if (!currentOutlet || !currentProperty || !canView) return;
    setLoading(true);
    try {
      const isPropertyScope = viewScope === 'property';
      const scopeId = isPropertyScope ? currentProperty.id : currentOutlet.id;
      
      let limitToIds: string[] | undefined = undefined;
      if (isPropertyScope && user?.role_id?.toLowerCase() !== 'admin') {
          limitToIds = allowedOutletsInProperty.map(o => o.id);
      }
      
      const [membersData, categoriesData, staffData] = await Promise.all([
        db.getMembers(scopeId, isPropertyScope, limitToIds),
        db.getCategories(currentOutlet.id),
        db.getStaff(currentOutlet.id)
      ]);

      setMembers(Array.isArray(membersData) ? membersData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setStaffList(Array.isArray(staffData) ? staffData.filter(s => s.is_active) : []);
      
      if (selectedMember) {
        const updated = (Array.isArray(membersData) ? membersData : []).find(m => m.id === selectedMember.id);
        if (updated) setSelectedMember(updated);
      }
    } catch (e) {
      console.error("Failed to load members data", e);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentOutlet, viewScope, canView]);

  if (!canView) return <div className="flex items-center justify-center h-full text-slate-400 font-black uppercase tracking-widest">Access Denied</div>;

  if (!currentOutlet) return <div className="flex items-center justify-center h-full text-slate-400 font-black uppercase tracking-widest">Please Select an Outlet</div>;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-40 text-slate-400 animate-pulse">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.4em]">Loading Ledger...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      {view === 'list' && (
        <MemberLedger 
          members={members || []} 
          categories={categories || []}
          loading={loading}
          viewScope={viewScope}
          setViewScope={setViewScope}
          onAdd={() => { setIsEditing(false); setIsRenewal(false); setSelectedMember(null); setView('form'); }}
          onViewDetail={(m) => { setSelectedMember(m); setView('detail'); }}
          onEdit={(m) => { setSelectedMember(m); setIsEditing(true); setIsRenewal(false); setView('form'); }}
          onRenew={(m) => { setSelectedMember(m); setIsRenewal(true); setIsEditing(false); setView('form'); }}
          onDelete={(id) => setDeleteId(id)}
        />
      )}

      {view === 'form' && (
        <MemberEnrollmentForm 
          existingMember={selectedMember}
          isEditing={isEditing}
          isRenewal={isRenewal}
          categories={categories}
          staff={staffList}
          onCancel={() => setView('list')}
          onSuccess={() => { loadData(); setView('list'); }}
        />
      )}

      {view === 'detail' && selectedMember && (
        <MemberProfileView 
          member={selectedMember}
          categories={categories}
          onBack={() => setView('list')}
          onEdit={(m) => { setSelectedMember(m); setIsEditing(true); setIsRenewal(false); setView('form'); }}
          onRenew={(m) => { setSelectedMember(m); setIsRenewal(true); setIsEditing(false); setView('form'); }}
          onUpdate={loadData}
          onDelete={(id) => setDeleteId(id)}
        />
      )}

      <ConfirmationModal 
        isOpen={!!deleteId} 
        onClose={() => setDeleteId(null)} 
        onConfirm={async () => { 
          if(deleteId) { 
            await db.deleteMember(deleteId); 
            setDeleteId(null); 
            loadData(); 
            setView('list'); 
          } 
        }} 
        title="Authorize Record Purge" 
        description="This action irreversibly removes the member profile and historical ledger." 
        confirmText="Confirm Purge" 
        isDestructive={true} 
      />
    </div>
  );
};

export default Members;