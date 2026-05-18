import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { db } from '../services/mockSupabase';
import { Member, MembershipCategory, MemberStatus, Staff, MembershipType } from '../types';
import MemberLedger from './membership/MemberLedger';
import MemberEnrollmentForm from './membership/MemberEnrollmentForm';
import MemberProfileView from './membership/MemberProfileView';
import { ConfirmationModal } from '../components/ui';

const Members = () => {
  const { user } = useAuth();
  const { currentOutlet, currentProperty, hasPermission, outlets, setPageLoading, pageLoading } = useSettings();
  
  // View State
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list');
  const [viewScope, setViewScope] = useState<'outlet' | 'property'>('outlet');
  
  // Data State
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<MembershipCategory[]>([]);
  const [membershipTypes, setMembershipTypes] = useState<MembershipType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string | 'all'>('all');
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isRenewal, setIsRenewal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const allowedOutletsInProperty = useMemo(() => {
    if (!currentProperty || !user) return [];
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

  const loadData = async (isSilent = false) => {
    if (!currentOutlet || !currentProperty || !canView) {
      setLoading(false);
      setPageLoading(false);
      return;
    }
    
    if (members.length === 0 && !isSilent) setLoading(true);
    if (!isSilent) setPageLoading(true);
    
    try {
      // Force property-wide fetch if possible so that search can find members in other outlets
      const isPropertyScope = true; 
      const scopeId = currentProperty.id;
      
      let limitToIds: string[] | undefined = undefined;
      if (user?.role_id?.toLowerCase() !== 'admin') {
          limitToIds = allowedOutletsInProperty.map(o => o.id);
      }
      
      const [membersData, categoriesData, staffData, typesData] = await Promise.all([
        db.getMembers(scopeId, isPropertyScope, limitToIds),
        db.getCategories(currentOutlet.id),
        db.getStaff(currentOutlet.id),
        db.getMembershipTypes(scopeId, isPropertyScope, limitToIds)
      ]);

      setMembers(membersData);
      setCategories(categoriesData);
      setStaffList(staffData.filter(s => s.is_active));
      setMembershipTypes(typesData);
      
      if (selectedMember) {
        const updated = membersData.find(m => m.id === selectedMember.id);
        if (updated) setSelectedMember(updated);
      }
    } catch (error) {
      console.error("Failed to load members data:", error);
      // If we have an error, we should still stop the loading spinner
    } finally {
      setLoading(false);
      setTimeout(() => {
        setPageLoading(false);
      }, 100);
    }
  };

  useEffect(() => {
    if (currentOutlet && canView) {
      loadData();
    } else if (!currentOutlet) {
      setLoading(false);
    }
  }, [currentOutlet, viewScope, canView]);

  // Safety protection: Force clear loading after a reasonable timeout
  useEffect(() => {
    if (loading || pageLoading) {
      const timer = setTimeout(() => {
        if (loading) {
          console.warn("Members loading timed out. Clearing loading state.");
          setLoading(false);
        }
        if (pageLoading) {
          console.warn("Page loading timed out in Members. Clearing pageLoading state.");
          setPageLoading(false);
        }
      }, 15000); // 15s safety timeout
      return () => clearTimeout(timer);
    }
  }, [loading, pageLoading]);

  // Real-time synchronization subscription
  useEffect(() => {
    if (!currentOutlet || !currentProperty || !canView) return;

    const channel = supabase
      .channel('realtime-members')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members' },
        () => loadData(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'membership_categories' },
        () => loadData(true)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'staff' },
        () => loadData(true)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOutlet, currentProperty, canView]);

  const filteredMembers = useMemo(() => {
    if (selectedTypeId === 'all') return members;
    return members.filter(m => {
      const mappedTypeId = m.membership_type_id || categories.find(c => c.id === m.category_id)?.membership_type_id;
      return mappedTypeId === selectedTypeId;
    });
  }, [members, categories, selectedTypeId]);

  const filteredCategories = useMemo(() => {
    if (selectedTypeId === 'all') return categories;
    return categories.filter(c => c.membership_type_id === selectedTypeId);
  }, [categories, selectedTypeId]);

  if (!canView) return null;

  return (
    <div className="min-h-full">
      {view === 'list' && (
        <MemberLedger 
          members={filteredMembers} 
          categories={filteredCategories}
          membershipTypes={membershipTypes}
          selectedTypeId={selectedTypeId}
          onTypeChange={setSelectedTypeId}
          loading={loading}
          pageLoading={pageLoading}
          viewScope={viewScope}
          setViewScope={setViewScope}
          onAdd={() => { 
            if (!loading) { 
              setIsEditing(false); 
              setIsRenewal(false); 
              setSelectedMember(null); 
              setView('form'); 
            } 
          }}
          onViewDetail={(m) => { setSelectedMember(m); setView('detail'); }}
          onEdit={(m) => { setSelectedMember(m); setIsEditing(true); setIsRenewal(false); setView('form'); }}
          onRenew={(m) => { setSelectedMember(m); setIsRenewal(true); setIsEditing(false); setView('form'); }}
          onDelete={(id) => setDeleteId(id)}
          onRefresh={loadData}
        />
      )}

      {view === 'form' && (
        <MemberEnrollmentForm 
          existingMember={selectedMember}
          isEditing={isEditing}
          isRenewal={isRenewal}
          categories={
            (isEditing || isRenewal) && selectedMember?.membership_type_id
              ? categories.filter(c => c.membership_type_id === selectedMember.membership_type_id)
              : filteredCategories
          }
          membershipTypes={membershipTypes}
          selectedTypeId={selectedTypeId}
          staff={staffList}
          allMembers={members}
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