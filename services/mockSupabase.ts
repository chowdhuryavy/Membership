import { UserProfile, Role, Currency, CompanySettings, Member, MembershipCategory, Freeze, MemberStatus, Outlet, Property, SystemLog, Permission, Guest, Therapist, MassageType, MassageBooking, Sale, SaleCategory, InventoryItem, IncentiveRule, Staff, UserPermissionOverride, PermissionGroup, StaffLeave, InventoryLog, MassageRoom, MembershipType } from '../types';
import { supabase, supabaseUrl, supabaseAnonKey } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { addDays, format, parse } from 'date-fns';

// Robust date parsing for the Intelligence Engine
const parseISO = (dateString: string) => {
  if (!dateString) return new Date();
  // Try ISO first
  let d = new Date(dateString);
  if (!isNaN(d.getTime())) return d;
  // Try DD-MM-YYYY (common in manual imports)
  try {
    return parse(dateString, 'dd-MM-yyyy', new Date());
  } catch (e) {
    return new Date();
  }
};

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

class DatabaseService {
  private isSupabase() {
    return !!supabase;
  }

  private generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private getShadowClient() {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  }

  // --- COMPREHENSIVE PERMISSION REGISTRY ---
  getPermissionRegistry(): PermissionGroup[] {
    return [
      {
        id: 'dashboard',
        label: 'Dashboard & Intelligence',
        permissions: [
          { key: 'dashboard:view', label: 'Access Dashboard', description: 'Core entry point for operational overview.' },
          { key: 'dashboard:view_financials', label: 'Financial KPI Insights', description: 'Visibility into revenue recognition and daily accruals.' },
          { key: 'dashboard:view_insights', label: 'AI Strategic Analysis', description: 'Ability to generate Gemini-powered performance reports.' },
        ]
      },
      {
        id: 'members',
        label: 'Membership Management',
        permissions: [
          { key: 'members:view', label: 'View Ledger', description: 'Access the member directory and profiles.' },
          { key: 'members:create', label: 'New Enrollments', description: 'Permission to add new members to the registry.' },
          { key: 'members:edit', label: 'Modify Profiles', description: 'Update existing member details and tiers.' },
          { key: 'members:delete', label: 'Revoke Records', description: 'Permanently remove members from the system.' },
          { key: 'members:view_contact_info', label: 'PII Visibility', description: 'Access to sensitive data like phone numbers and emails.' },
          { key: 'members:freeze', label: 'Handle Suspensions', description: 'Authorize or cancel membership freeze periods.' },
          { key: 'members:bulk_freeze', label: 'Bulk Suspension Protocol', description: 'Authorize global portfolio holds for maintenance or holidays.' },
          { key: 'members:renew', label: 'Process Renewals', description: 'Ability to trigger re-enrollment logic.' },
          { key: 'members:print_contract', label: 'Legal Documentation', description: 'Generate and print membership agreements.' },
          { key: 'members:view_history', label: 'Audit History', description: 'View historical changes to member records.' },
        ]
      },
      {
        id: 'staff',
        label: 'Staff Roster & Operations',
        permissions: [
          { key: 'staff:view', label: 'View Personnel', description: 'Access the facility staff list and profiles.' },
          { key: 'staff:manage', label: 'Control Registry', description: 'Add, edit, or archive staff members.' },
          { key: 'staff:manage_leaves', label: 'Leave Administration', description: 'Manage staff leave records and schedules.' },
        ]
      },
      {
        id: 'categories',
        label: 'Product Tiers & Rules',
        permissions: [
          { key: 'categories:view', label: 'View Categories', description: 'View membership tier configurations.' },
          { key: 'categories:create', label: 'Define Tiers', description: 'Create new membership products.' },
          { key: 'categories:edit', label: 'Modify Logic', description: 'Adjust rates and durations for tiers.' },
          { key: 'categories:delete', label: 'Retire Tiers', description: 'Remove or archive old membership categories.' },
        ]
      },
      {
        id: 'bookings',
        label: 'Resource Scheduling',
        permissions: [
          { key: 'bookings:view', label: 'View Calendar', description: 'Access the service grid and availability.' },
          { key: 'bookings:create', label: 'Book Sessions', description: 'Create new treatment reservations.' },
          { key: 'bookings:edit', label: 'Adjust Sessions', description: 'Reschedule or modify existing bookings.' },
          { key: 'bookings:delete', label: 'Void Sessions', description: 'Cancel or delete bookings.' },
          { key: 'bookings:manage_resources', label: 'Asset Config', description: 'Add/Edit therapists and treatment types.' },
          { key: 'bookings:view_therapist_schedule', label: 'Specialist Timelines', description: 'View detailed schedules for individual therapists.' },
        ]
      },
      {
        id: 'sales',
        label: 'POS & Commerce',
        permissions: [
          { key: 'sales:view', label: 'Transaction Audit', description: 'View the daily sales and revenue ledger.' },
          { key: 'sales:create', label: 'Process Sales', description: 'Authorize and finalize new POS transactions.' },
          { key: 'sales:edit', label: 'Modify Sales', description: 'Adjust completed transaction details.' },
          { key: 'sales:delete', label: 'Authorize Voids', description: 'Reverse revenue events and adjust inventory.' },
          { key: 'sales:void', label: 'Void Transactions', description: 'Mark transactions as void for audit purposes.' },
          { key: 'inventory:view', label: 'Catalog Visibility', description: 'Access the item master and stock levels.' },
          { key: 'inventory:manage', label: 'Inventory Control', description: 'Define new assets and adjust quantities.' },
          { key: 'inventory:adjust_stock', label: 'Stock Reconciliation', description: 'Manually adjust stock levels for shrinkage or corrections.' },
        ]
      },
      {
        id: 'reports',
        label: 'Financial Reporting',
        permissions: [
          { key: 'reports:view', label: 'Generate Reports', description: 'Access high-level financial audit tools.' },
          { key: 'reports:export', label: 'Data Portability', description: 'Export ledger data to PDF or Excel formats.' },
          { key: 'reports:view_financial', label: 'Financial Audits', description: 'Access detailed revenue and tax reports.' },
          { key: 'reports:view_operational', label: 'Operational Metrics', description: 'View attendance and facility usage reports.' },
          { key: 'reports:view_inventory', label: 'Inventory Reports', description: 'Access stock movement and valuation reports.' },
          { key: 'reports:view_staff', label: 'Staff Performance', description: 'View incentive and productivity reports.' },
        ]
      },
      {
        id: 'security',
        label: 'Security & Governance',
        permissions: [
          { key: 'users:view', label: 'Directory Access', description: 'View system users and their roles.' },
          { key: 'users:create', label: 'Provision Users', description: 'Create new user accounts and auth identities.' },
          { key: 'users:edit', label: 'Modify Clearances', description: 'Change roles and outlet access scopes.' },
          { key: 'users:edit_self', label: 'Self-Modification', description: 'Allow user to edit their own profile and access.' },
          { key: 'users:edit_email', label: 'Email Control', description: 'Permission to change user account emails.' },
          { key: 'users:delete', label: 'Revoke Identity', description: 'Terminate user access permanently.' },
          { key: 'users:manage_overrides', label: 'Policy Overrides', description: 'Manage granular user-specific permission deviations.' },
          { key: 'logs:view', label: 'Audit Log Access', description: 'Access the system mutation and activity logs.' },
          { key: 'logs:search', label: 'Log Search', description: 'Search through audit logs for specific events.' },
          { key: 'logs:filter', label: 'Log Filtering', description: 'Filter audit logs by date, user, or action.' },
          { key: 'logs:clear', label: 'Clear Filters', description: 'Reset all active filters on the logs page.' },
        ]
      },
      {
        id: 'settings',
        label: 'System Configuration',
        permissions: [
          { key: 'settings:view', label: 'View Settings', description: 'Access system-wide settings pages.' },
          { key: 'settings:edit', label: 'Global Mutations', description: 'Authorize changes to company identity and UI.' },
          { key: 'settings:view_global', label: 'Enterprise Info', description: 'Access brand and address configuration.' },
          { key: 'settings:view_properties', label: 'Property Assets', description: 'Manage luxury collection properties.' },
          { key: 'settings:view_outlets', label: 'Facility Contexts', description: 'Manage specific gym/spa outlet records.' },
          { key: 'settings:view_roles', label: 'Security Protocols', description: 'Define role-based permission templates.' },
          { key: 'settings:view_currency', label: 'Monetary Standards', description: 'Manage currency and exchange rates.' },
          { key: 'settings:view_shortcuts', label: 'Hotkey Controls', description: 'Configure system-wide keyboard shortcuts.' },
          { key: 'settings:view_documents', label: 'Legal Templates', description: 'Manage contract and agreement text.' },
          { key: 'settings:view_navigation', label: 'UI Architecture', description: 'Rearrange sidebar navigation order.' },
          { key: 'settings:view_incentives', label: 'Yield Logic', description: 'Manage complex incentive distribution rules.' },
          { key: 'settings:view_maintenance', label: 'Terminal Ops', description: 'Access database maintenance and wipe tools.' },
          { key: 'settings:manage_visibility', label: 'Feature Visibility', description: 'Control which settings tabs are visible to other admins.' },
          { key: 'settings:manage_global', label: 'Manage Enterprise', description: 'Edit brand and address configuration.' },
          { key: 'settings:manage_properties', label: 'Manage Properties', description: 'Add/Edit/Delete luxury collection properties.' },
          { key: 'settings:manage_outlets', label: 'Manage Outlets', description: 'Add/Edit/Delete specific gym/spa outlet records.' },
          { key: 'settings:manage_roles', label: 'Manage Roles', description: 'Add/Edit/Delete role-based permission templates.' },
          { key: 'settings:manage_currency', label: 'Manage Currencies', description: 'Add/Edit/Delete currency and exchange rates.' },
          { key: 'settings:manage_shortcuts', label: 'Manage Hotkeys', description: 'Authorize changes to system-wide keyboard shortcuts.' },
          { key: 'settings:manage_documents', label: 'Manage Templates', description: 'Authorize changes to contract and agreement text.' },
          { key: 'settings:manage_navigation', label: 'Manage UI', description: 'Authorize changes to sidebar navigation order.' },
          { key: 'settings:manage_incentives', label: 'Manage Yield', description: 'Authorize changes to complex incentive distribution rules.' },
          { key: 'settings:manage_maintenance', label: 'Manage Maintenance', description: 'Authorize database maintenance and wipe tools.' },
        ]
      }
    ];
  }

  async getPermissionOverrides(userId: string): Promise<UserPermissionOverride[]> {
    if (!this.isSupabase()) return [];
    const { data } = await supabase.from('user_permission_overrides').select('*').eq('user_id', userId);
    return (data || []) as UserPermissionOverride[];
  }

  async savePermissionOverride(override: Omit<UserPermissionOverride, 'id'>) {
    if (!this.isSupabase()) return;
    await supabase.from('user_permission_overrides').upsert([override], { onConflict: 'user_id,permission_key' });
    await this.logAction('SECURITY_OVERRIDE', `Updated override for ${override.permission_key} on User ID: ${override.user_id}`);
  }

  async deletePermissionOverride(userId: string, key: Permission) {
    if (!this.isSupabase()) return;
    await supabase.from('user_permission_overrides').delete().eq('user_id', userId).eq('permission_key', key);
    await this.logAction('SECURITY_OVERRIDE_PURGE', `Removed override for ${key} on User ID: ${userId}`);
  }

  private async syncMemberEndDate(memberId: string) {
    if (!this.isSupabase()) {
        // Local Mode Sync
        const members = JSON.parse(localStorage.getItem('membership_members') || '[]');
        const freezes = JSON.parse(localStorage.getItem('membership_freezes') || '[]');
        
        const mIndex = members.findIndex((mem: any) => mem.id === memberId);
        if (mIndex === -1) return null;
        const m = members[mIndex];

        const memberFreezes = freezes.filter((f: any) => f.member_id === memberId);
        const totalDeferred = memberFreezes.reduce((sum: number, f: any) => sum + (Number(f.total_days) || 0), 0);
        
        const baselineDate = startOfDay(parseISO(m.original_end_date));
        const calculatedEndDate = addDays(baselineDate, totalDeferred);
        const newEndDateStr = format(calculatedEndDate, 'yyyy-MM-dd');

        const today = startOfDay(new Date());
        const isCurrentlyFrozen = memberFreezes.some((f: any) => {
            const start = startOfDay(parseISO(f.start_date));
            const end = startOfDay(parseISO(f.end_date));
            return today >= start && today <= end;
        });

        const newStatus = isCurrentlyFrozen ? MemberStatus.FROZEN : MemberStatus.ACTIVE;
        
        // Check if expired
        const finalStatus = (newStatus === MemberStatus.ACTIVE && today > startOfDay(parseISO(newEndDateStr))) 
            ? MemberStatus.EXPIRED 
            : newStatus;

        members[mIndex] = { ...m, status: finalStatus, current_end_date: newEndDateStr };
        localStorage.setItem('membership_members', JSON.stringify(members));
        return newEndDateStr;
    }

    try {
        const [{ data: m }, { data: freezes }] = await Promise.all([
          supabase.from('members').select('id, original_end_date, status').eq('id', memberId).single(),
          supabase.from('freezes').select('total_days, start_date, end_date').eq('member_id', memberId)
        ]);
        if (!m || m.status === MemberStatus.TENTATIVE) return;

        const totalDeferred = (freezes || []).reduce((sum, f) => sum + (Number(f.total_days) || 0), 0);
        const baselineDate = startOfDay(parseISO(m.original_end_date));
        const calculatedEndDate = addDays(baselineDate, totalDeferred);
        const newEndDateStr = format(calculatedEndDate, 'yyyy-MM-dd');
        
        const today = startOfDay(new Date());
        const isCurrentlyFrozen = (freezes || []).some(f => {
            const start = startOfDay(parseISO(f.start_date));
            const end = startOfDay(parseISO(f.end_date));
            return today >= start && today <= end;
        });

        const newStatus = isCurrentlyFrozen ? MemberStatus.FROZEN : MemberStatus.ACTIVE;
        
        // Final check for expiry
        const finalStatus = (newStatus === MemberStatus.ACTIVE && today > startOfDay(parseISO(newEndDateStr))) 
            ? MemberStatus.EXPIRED 
            : newStatus;

        await supabase.from('members').update({ status: finalStatus, current_end_date: newEndDateStr }).eq('id', memberId);
        return newEndDateStr;
    } catch (err) { console.error(err); }
  }

  async logAction(action: string, details: string, outlet_id?: string, explicitUser?: { id: string, name: string }) {
    const sessionStr = sessionStorage.getItem('membership_session');
    const session = sessionStr ? JSON.parse(sessionStr) : null;
    const logEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        user_id: explicitUser?.id || session?.id || 'system',
        user_name: explicitUser?.name || session?.name || 'System Engine',
        action: (action || '').toUpperCase(),
        details,
        outlet_id: outlet_id || null
    };
    if (this.isSupabase()) {
        try { await supabase.from('system_logs').insert([logEntry]); } catch (e) { console.error(e); }
    }
  }

  async syncAuthMetadata(profile: UserProfile) {
    if (!this.isSupabase()) return;
    const { data: { user } } = await (supabase.auth as any).getUser();
    if (!user) return;
    const metaName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.display_name;
    if (profile.name !== metaName) {
      await (supabase.auth as any).updateUser({
        data: { full_name: profile.name, display_name: profile.name, name: profile.name }
      });
    }
  }

  async signUp(email: string, passwordAttempt: string, name: string): Promise<{ user: UserProfile | null, error: string | null }> {
    if (!this.isSupabase()) return { user: null, error: "Cloud sync offline." };
    const cleanEmail = email.trim().toLowerCase();
    const { data: signUpData, error: signUpError } = await (supabase.auth as any).signUp({
      email: cleanEmail,
      password: passwordAttempt,
      options: { data: { full_name: name, display_name: name, name: name } }
    });
    if (signUpError) return { user: null, error: signUpError.message };
    if (signUpData.user) {
        const { data: profile, error: profileError } = await supabase.from('profiles').upsert([{ 
            email: cleanEmail, 
            name: name, 
            auth_id: signUpData.user.id,
            role_id: 'member', 
            allowed_outlets: []
        }], { onConflict: 'email' }).select().single();
        if (profileError) return { user: null, error: profileError.message };
        return { user: profile as UserProfile, error: null };
    }
    return { user: null, error: "Signup failed." };
  }

  async updateEmail(email: string) {
    if (this.isSupabase()) {
        await (supabase.auth as any).updateUser({ email: email.trim().toLowerCase() });
    }
  }

  async login(email: string, passwordAttempt: string): Promise<{ user: UserProfile | null, error: string | null, requiresPasswordChange: boolean }> {
    if (!this.isSupabase()) return { user: null, error: "Cloud sync offline.", requiresPasswordChange: false };
    const cleanEmail = email.trim().toLowerCase();
    const { data: profile } = await supabase.from('profiles').select('*').eq('email', cleanEmail).maybeSingle();
    
    if (profile && profile.is_active === false) {
        return { user: null, error: "Account is inactive. Please contact administration.", requiresPasswordChange: false };
    }

    const { data: authData, error: authError } = await (supabase.auth as any).signInWithPassword({ email: cleanEmail, password: passwordAttempt });
    if (authError || (profile && !profile.auth_id)) {
        if (profile && profile.temp_password === passwordAttempt) {
            const { data: signUpData, error: signUpError } = await (supabase.auth as any).signUp({ email: cleanEmail, password: passwordAttempt, options: { data: { full_name: profile.name, display_name: profile.name, name: profile.name } } });
            if (signUpError) return { user: null, error: signUpError.message, requiresPasswordChange: false };
            if (signUpData.user) {
              await supabase.from('profiles').update({ auth_id: signUpData.user.id }).eq('id', profile.id);
              const { data: refreshed } = await supabase.from('profiles').select('*').eq('id', profile.id).single();
              await this.logAction('AUTH_SIGNUP', `Identity provisioned for ${profile.email}`);
              return { user: refreshed, error: null, requiresPasswordChange: true };
            }
        }
        return { user: null, error: authError?.message || "Invalid credentials.", requiresPasswordChange: false };
    }
    if (authData.user && profile) {
        if (!profile.auth_id || profile.auth_id !== authData.user.id) await supabase.from('profiles').update({ auth_id: authData.user.id }).eq('id', profile.id);
        await this.syncAuthMetadata(profile);
        const overrides = await this.getPermissionOverrides(profile.id);
        const hydrated = { ...profile, overrides };
        await this.logAction('AUTH_LOGIN', `Access authorized for ${profile.email}`, undefined, { id: profile.id, name: profile.name });
        return { user: hydrated, error: null, requiresPasswordChange: !!profile.temp_password };
    }
    return { user: null, error: "Identity profile not found.", requiresPasswordChange: false };
  }

  async addUser(user: Omit<UserProfile, 'id'> & { password?: string }): Promise<UserProfile> {
    const cleanEmail = user.email.trim().toLowerCase();
    let authId: string | null = user.auth_id || null;
    let tempPassword: string | null = user.password || 'Temporary123!';
    if (this.isSupabase()) {
        if (!authId) {
            const shadow = this.getShadowClient();
            const { data: authData, error: signUpError } = await (shadow.auth as any).signUp({ email: cleanEmail, password: tempPassword, options: { data: { full_name: user.name, name: user.name, display_name: user.name } } });
            if (signUpError) throw new Error(signUpError.message);
            if (authData?.user) authId = authData.user.id;
        }
        const { data, error } = await supabase.from('profiles').upsert([{ 
            email: cleanEmail, 
            name: user.name, 
            role_id: user.role_id, 
            allowed_outlets: user.allowed_outlets || [], 
            temp_password: tempPassword, 
            auth_id: authId, 
            is_active: user.is_active ?? true,
            updated_at: new Date().toISOString() 
        }], { onConflict: 'email' }).select().single();
        if (error) throw error;
        await this.logAction('CREATE_USER', `Identity provisioned: ${user.name} (${user.email})`);
        return data as UserProfile;
    }
    return { ...user, id: crypto.randomUUID() } as UserProfile;
  }

  async updateUser(id: string, updates: Partial<UserProfile>) { 
    if (this.isSupabase()) {
        const { data: current } = await supabase.from('profiles').select('email, name').eq('id', id).single();
        const finalUpdates: any = { 
            name: updates.name, 
            email: updates.email?.trim().toLowerCase(), 
            role_id: updates.role_id, 
            allowed_outlets: updates.allowed_outlets, 
            is_active: updates.is_active,
            updated_at: new Date().toISOString() 
        };
        Object.keys(finalUpdates).forEach(k => finalUpdates[k] === undefined && delete finalUpdates[k]);
        await supabase.from('profiles').update(finalUpdates).eq('id', id);
        await this.logAction('UPDATE_USER', `Identity modified for ${current.name} (${current.email})`);
    }
  }

  async changePassword(userId: string, currentPass: string, newPass: string) {
    if (this.isSupabase()) {
        await (supabase.auth as any).updateUser({ password: newPass });
        await supabase.from('profiles').update({ temp_password: null }).eq('id', userId);
        await this.logAction('CHANGE_PASSWORD', `Credentials updated for user ID: ${userId}`);
    }
  }

  async getUsers(): Promise<UserProfile[]> {
    if (this.isSupabase()) {
      const { data } = await supabase.from('profiles').select('*');
      return (data || []) as UserProfile[];
    }
    return [];
  }

  async deleteUser(id: string) {
    if (this.isSupabase()) await supabase.from('profiles').delete().eq('id', id);
  }

  async getStaff(scopeId?: string, isProperty: boolean = false, limitToOutletIds?: string[]): Promise<Staff[]> {
    if (this.isSupabase()) {
      let query = supabase.from('staff').select('*').order('name');
      if (scopeId) {
          if (isProperty) {
              if (limitToOutletIds && limitToOutletIds.length > 0) {
                  query = query.in('outlet_id', limitToOutletIds);
              } else {
                  const { data: outlets } = await supabase.from('outlets').select('id').eq('property_id', scopeId);
                  const ids = (outlets || []).map(o => o.id);
                  query = query.in('outlet_id', ids);
              }
          } else {
              query = query.eq('outlet_id', scopeId);
          }
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Staff[];
    }
    return [];
  }

  async getStaffLeaves(staffId: string): Promise<StaffLeave[]> {
    if (this.isSupabase()) {
      const { data } = await supabase.from('staff_leaves').select('*').eq('staff_id', staffId).order('start_date', { ascending: false });
      return (data || []) as StaffLeave[];
    }
    return [];
  }

  async getAllStaffLeaves(): Promise<StaffLeave[]> {
    if (this.isSupabase()) {
      const { data } = await supabase.from('staff_leaves').select('*');
      return (data || []) as StaffLeave[];
    }
    return [];
  }

  async addStaffLeave(leave: Omit<StaffLeave, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      const { data, error } = await supabase.from('staff_leaves').insert([{ ...leave, id: crypto.randomUUID(), created_at: new Date().toISOString() }]).select();
      if (error) throw error;
      return data;
    }
  }

  async updateStaffLeave(id: string, updates: Partial<StaffLeave>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('staff_leaves').update(updates).eq('id', id);
      if (error) throw error;
    }
  }

  async deleteStaffLeave(id: string) {
    if (this.isSupabase()) {
      console.log(`[DB] Deleting staff leave ${id}`);
      const { error, count } = await supabase.from('staff_leaves').delete({ count: 'exact' }).eq('id', id);
      if (error) {
          console.error('[DB] Delete failed:', error);
          throw error;
      }
      if (count === 0) {
          console.warn('[DB] Delete succeeded but 0 rows were affected. ID mismatch or RLS policy?');
      } else {
          console.log(`[DB] Successfully deleted ${count} rows.`);
      }
    }
  }

  async addStaff(staff: Omit<Staff, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      const { data, error } = await supabase.from('staff').insert([{ ...staff, id: crypto.randomUUID(), created_at: new Date().toISOString() }]).select();
      if (error) throw error;
      await this.logAction('CREATE_STAFF', `Added staff member: ${staff.name} (${staff.role})`, staff.outlet_id);
      return data;
    }
  }

  async updateStaff(id: string, updates: Partial<Staff>) {
    if (this.isSupabase()) {
      if (updates.name) {
          await supabase.from('therapists').update({ name: updates.name }).eq('id', id);
      }
      const { error } = await supabase.from('staff').update(updates).eq('id', id);
      if (error) throw error;
      const changedFields = Object.keys(updates).filter(k => updates[k] !== undefined && updates[k] !== null).join(', ');
      await this.logAction('UPDATE_STAFF', `Updated staff profile: ${id}. Modified fields: [${changedFields}]`);
    }
  }

  async deleteStaff(id: string) {
    if (this.isSupabase()) {
      await supabase.from('therapists').delete().eq('id', id);
      const { error } = await supabase.from('staff').delete().eq('id', id);
      if (error) throw error;
      await this.logAction('DELETE_STAFF', `Deleted staff record ID: ${id}`);
    }
  }

  async getMembers(scopeId?: string, isProperty: boolean = false, limitToOutletIds?: string[]): Promise<Member[]> {
    if (this.isSupabase()) {
      let query = supabase.from('members').select('*');
      if (scopeId) {
          if (isProperty) {
              if (limitToOutletIds && limitToOutletIds.length > 0) {
                  query = query.in('outlet_id', limitToOutletIds);
              } else {
                  const { data: outlets } = await supabase.from('outlets').select('id').eq('property_id', scopeId);
                  const ids = (outlets || []).map(o => o.id);
                  query = query.in('outlet_id', ids);
              }
          } else {
              query = query.eq('outlet_id', scopeId);
          }
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Member[];
    }
    return [];
  }

  async getMemberHistory(membershipNumber: string, outletId?: string): Promise<Member[]> {
    if (this.isSupabase()) {
        let query = supabase.from('members').select('*').eq('membership_number', membershipNumber).order('start_date', { ascending: false });
        if (outletId) {
            query = query.eq('outlet_id', outletId);
        }
        const { data } = await query;
        return (data || []) as Member[];
    }
    return [];
  }

  async addMember(member: Member) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('members').insert([member]);
      if (error) throw error;
      await this.logAction('CREATE_MEMBER', `Enrolled new member: ${member.guest_name} (ID: ${member.membership_number}, Tier: ${member.category_id})`, member.outlet_id);
    }
  }

  async updateMember(id: string, member: Partial<Member>) {
    if (this.isSupabase()) {
      const patch: any = { ...member };
      delete patch.id;
      delete patch.created_at;
      Object.keys(patch).forEach(key => (patch[key] === undefined) && delete patch[key]);
      const { error } = await supabase.from('members').update(patch).eq('id', id);
      if (error) throw error;
      const changedFields = Object.keys(patch).filter(k => patch[k] !== undefined && patch[k] !== null).join(', ');
      await this.logAction('UPDATE_MEMBER', `Updated member profile: ${patch.guest_name || id}. Modified fields: [${changedFields}]`, patch.outlet_id);
    } else {
        // Local Mode Fallback
        const members = JSON.parse(localStorage.getItem('membership_members') || '[]');
        const mIndex = members.findIndex((mem: any) => mem.id === id);
        if (mIndex !== -1) {
            members[mIndex] = { ...members[mIndex], ...member };
            localStorage.setItem('membership_members', JSON.stringify(members));
            await this.logAction('UPDATE_MEMBER', `Updated member profile locally: ${members[mIndex].guest_name || id}.`);
        }
    }
  }

  async deleteMember(id: string) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('members').delete().eq('id', id);
      if (error) throw error;
      await this.logAction('DELETE_MEMBER', `Deleted member record ID: ${id}`);
    }
  }

  async getFreezes(memberId?: string): Promise<Freeze[]> {
    if (this.isSupabase()) {
      let query = supabase.from('freezes').select('*');
      if (memberId) query = query.eq('member_id', memberId);
      const { data } = await query;
      return (data || []) as Freeze[];
    }
    return [];
  }

  async addFreeze(freeze: Freeze) {
    if (this.isSupabase()) {
      const data = { ...freeze, id: freeze.id || this.generateUUID() };
      await supabase.from('freezes').insert([data]);
      const newEndDate = await this.syncMemberEndDate(freeze.member_id);
      
      // Fetch member name for better logging
      const { data: member } = await supabase.from('members').select('guest_name').eq('id', freeze.member_id).single();
      const memberName = member?.guest_name || 'Unknown Member';
      
      await this.logAction('FREEZE_MEMBER', `Account suspended: ${memberName}. Membership extended to ${newEndDate}`);
    }
  }

  async updateFreeze(id: string, updates: Partial<Freeze>) {
    if (this.isSupabase()) {
        await supabase.from('freezes').update(updates).eq('id', id);
        // Find the member ID associated with this freeze
        const { data } = await supabase.from('freezes').select('member_id').eq('id', id).single();
        if (data?.member_id) {
            await this.syncMemberEndDate(data.member_id);
            await this.logAction('UPDATE_FREEZE', `Account suspension modified for member ID: ${data.member_id}`);
        }
    }
  }

  async deleteFreeze(id: string, memberId: string) {
    if (this.isSupabase()) {
        await supabase.from('freezes').delete().eq('id', id);
        const newEndDate = await this.syncMemberEndDate(memberId);
        
        // Fetch member name for better logging
        const { data: member } = await supabase.from('members').select('guest_name').eq('id', memberId).single();
        const memberName = member?.guest_name || 'Unknown Member';

        await this.logAction('DELETE_FREEZE', `Suspension revoked for ${memberName}. Membership reduced to ${newEndDate}`);
    }
  }

  async bulkFreezeMembers(memberIds: string[], startDate: string, endDate: string, totalDays: number, reason: string) {
    const timestamp = new Date().toISOString();
    
    if (this.isSupabase()) {
      // 1. Create the Batch record first
      const { data: batch, error: batchError } = await supabase
        .from('maintenance_batches')
        .insert([{
          start_date: startDate,
          end_date: endDate,
          total_days: totalDays,
          reason: reason
        }])
        .select()
        .single();

      if (batchError) throw batchError;

      // 2. Create individual freeze records linked to this batch
      const newFreezes = memberIds.map(id => ({
        id: this.generateUUID(),
        member_id: id,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        reason: reason,
        is_maintenance: true,
        maintenance_batch_id: batch.id,
        created_at: timestamp
      }));

      const { error: freezeError } = await supabase.from('freezes').insert(newFreezes);
      if (freezeError) throw freezeError;

      // 3. Sync all affected members to update their status and end dates
      await Promise.all(memberIds.map(id => this.syncMemberEndDate(id)));
      
      await this.logAction('BULK_FREEZE', `Bulk suspension applied to ${memberIds.length} members. Reason: ${reason}`);
      return batch.id;
    } else {
      // Local Mode Fallback
      const batchId = this.generateUUID();
      const newFreezes = memberIds.map(id => ({
        id: this.generateUUID(),
        member_id: id,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        reason: reason,
        is_maintenance: true,
        batch_id: batchId,
        created_at: timestamp
      }));
      const existing = JSON.parse(localStorage.getItem('membership_freezes') || '[]');
      localStorage.setItem('membership_freezes', JSON.stringify([...existing, ...newFreezes]));
      await Promise.all(memberIds.map(id => this.syncMemberEndDate(id)));
      return batchId;
    }
  }

  async getBulkFreezeHistory(): Promise<{ batch_id: string, start_date: string, end_date: string, total_days: number, reason: string, member_count: number, created_at: string }[]> {
    if (this.isSupabase()) {
        // 1. Get dedicated batches
        const { data: batches, error: batchError } = await supabase
            .from('maintenance_batches')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (batchError) throw batchError;

        // 2. Get ALL maintenance freezes to find orphaned ones
        const { data: allMaintenance, error: freezeError } = await supabase
            .from('freezes')
            .select('maintenance_batch_id, start_date, end_date, total_days, reason, created_at')
            .eq('is_maintenance', true);
        
        if (freezeError) throw freezeError;

        // 3. Process dedicated batches
        const history = (batches || []).map(batch => ({
            batch_id: batch.id,
            start_date: batch.start_date,
            end_date: batch.end_date,
            total_days: batch.total_days,
            reason: batch.reason,
            member_count: (allMaintenance || []).filter(c => c.maintenance_batch_id === batch.id).length,
            created_at: batch.created_at
        }));

        // 4. Find and group orphaned freezes (those without a batch_id)
        const orphaned = (allMaintenance || []).filter(f => !f.maintenance_batch_id);
        const groupedOrphaned = orphaned.reduce((acc: Record<string, any>, curr: any) => {
            const key = `synthetic_${curr.start_date}_${curr.end_date}_${curr.reason || 'none'}`;
            if (!acc[key]) {
                acc[key] = {
                    batch_id: key,
                    start_date: curr.start_date,
                    end_date: curr.end_date,
                    total_days: curr.total_days,
                    reason: curr.reason || 'Legacy Maintenance',
                    member_count: 0,
                    created_at: curr.created_at || new Date().toISOString()
                };
            }
            acc[key].member_count++;
            return acc;
        }, {});

        const orphanedList = Object.values(groupedOrphaned) as { batch_id: string, start_date: string, end_date: string, total_days: number, reason: string, member_count: number, created_at: string }[];
        return [...history, ...orphanedList];
    } else {
        // Local Mode Fallback
        const localData = JSON.parse(localStorage.getItem('membership_freezes') || '[]');
        const allFreezes = localData.filter((f: any) => !!f.is_maintenance);
        const grouped = allFreezes.reduce((acc: any, curr: any) => {
            const bid = curr.batch_id || `synthetic_${curr.start_date}_${curr.end_date}_${curr.reason || 'none'}`;
            if (!acc[bid]) {
                acc[bid] = {
                    batch_id: bid,
                    start_date: curr.start_date,
                    end_date: curr.end_date,
                    total_days: curr.total_days,
                    reason: curr.reason || 'Global Maintenance',
                    member_count: 0,
                    created_at: curr.created_at || new Date().toISOString()
                };
            }
            acc[bid].member_count++;
            return acc;
        }, {});
        return Object.values(grouped);
    }
  }

  async deleteBulkFreeze(batchId: string) {
    let memberIds: string[] = [];

    if (this.isSupabase()) {
        if (batchId.startsWith('synthetic_')) {
            const parts = batchId.split('_');
            const startDate = parts[1];
            const endDate = parts[2];
            const reason = parts[3] === 'none' ? null : parts[3];

            let query = supabase.from('freezes').select('member_id').eq('start_date', startDate).eq('end_date', endDate).eq('is_maintenance', true);
            if (reason === null) query = query.is('reason', null);
            else query = query.eq('reason', reason);

            const { data: freezes } = await query;
            memberIds = Array.from(new Set((freezes || []).map(f => f.member_id)));

            let deleteQuery = supabase.from('freezes').delete().eq('start_date', startDate).eq('end_date', endDate).eq('is_maintenance', true);
            if (reason === null) deleteQuery = deleteQuery.is('reason', null);
            else deleteQuery = deleteQuery.eq('reason', reason);
            
            await deleteQuery;
        } else {
            // Try both maintenance_batch_id and batch_id
            const { data: f1 } = await supabase.from('freezes').select('member_id').eq('maintenance_batch_id', batchId);
            const { data: f2 } = await supabase.from('freezes').select('member_id').eq('batch_id', batchId);
            
            memberIds = Array.from(new Set([...(f1 || []), ...(f2 || [])].map(f => f.member_id)));
            
            await supabase.from('freezes').delete().eq('maintenance_batch_id', batchId);
            await supabase.from('freezes').delete().eq('batch_id', batchId);
            await supabase.from('maintenance_batches').delete().eq('id', batchId);
        }
    } else {
        // Local Mode Delete
        let freezes = JSON.parse(localStorage.getItem('membership_freezes') || '[]');
        const toDelete = freezes.filter((f: any) => {
            if (batchId.startsWith('synthetic_')) {
                const parts = batchId.split('_');
                return f.start_date === parts[1] && f.end_date === parts[2] && f.is_maintenance;
            }
            return f.batch_id === batchId || f.maintenance_batch_id === batchId;
        });
        
        memberIds = Array.from(new Set(toDelete.map((f: any) => f.member_id)));
        freezes = freezes.filter((f: any) => !toDelete.some((td: any) => td.id === f.id));
        localStorage.setItem('membership_freezes', JSON.stringify(freezes));
    }

    // Sync all affected members
    await Promise.all(memberIds.map(id => this.syncMemberEndDate(id)));
    await this.logAction('DELETE_BULK_FREEZE', `Bulk suspension revoked for batch: ${batchId}`);
  }

  async updateBulkFreeze(batchId: string, updates: { start_date: string, end_date: string, total_days: number, reason: string }) {
    if (this.isSupabase()) {
        let memberIds: string[] = [];

        if (batchId.startsWith('synthetic_')) {
            // Handle legacy orphaned freezes
            const parts = batchId.split('_');
            const startDate = parts[1];
            const endDate = parts[2];
            const reason = parts[3] === 'none' ? null : parts[3];

            let query = supabase.from('freezes').select('member_id').eq('start_date', startDate).eq('end_date', endDate).eq('is_maintenance', true);
            if (reason === null) query = query.is('reason', null);
            else query = query.eq('reason', reason);

            const { data: freezes } = await query;
            memberIds = Array.from(new Set((freezes || []).map(f => f.member_id)));

            let updateQuery = supabase.from('freezes').update(updates).eq('start_date', startDate).eq('end_date', endDate).eq('is_maintenance', true);
            if (reason === null) updateQuery = updateQuery.is('reason', null);
            else updateQuery = updateQuery.eq('reason', reason);
            
            await updateQuery;
        } else {
            // Handle new dedicated batches - try both maintenance_batch_id and batch_id
            await supabase.from('maintenance_batches').update(updates).eq('id', batchId);
            await supabase.from('freezes').update(updates).eq('maintenance_batch_id', batchId);
            await supabase.from('freezes').update(updates).eq('batch_id', batchId);

            const { data: f1 } = await supabase.from('freezes').select('member_id').eq('maintenance_batch_id', batchId);
            const { data: f2 } = await supabase.from('freezes').select('member_id').eq('batch_id', batchId);
            
            memberIds = Array.from(new Set([...(f1 || []), ...(f2 || [])].map(f => f.member_id)));
        }

        await Promise.all(memberIds.map(id => this.syncMemberEndDate(id)));
        await this.logAction('UPDATE_BULK_FREEZE', `Bulk suspension modified for batch: ${batchId}`);
    } else {
        // Local Mode Update
        let freezes = JSON.parse(localStorage.getItem('membership_freezes') || '[]');
        const affected = freezes.filter((f: any) => {
            if (batchId.startsWith('synthetic_')) {
                const parts = batchId.split('_');
                return f.start_date === parts[1] && f.end_date === parts[2] && f.is_maintenance;
            }
            return f.batch_id === batchId || f.maintenance_batch_id === batchId;
        });

        const memberIds = Array.from(new Set(affected.map((f: any) => f.member_id)));
        
        const updated = freezes.map((f: any) => {
            const isMatch = batchId.startsWith('synthetic_') 
                ? (f.start_date === batchId.split('_')[1] && f.end_date === batchId.split('_')[2] && f.is_maintenance)
                : (f.batch_id === batchId || f.maintenance_batch_id === batchId);
            
            if (isMatch) return { ...f, ...updates };
            return f;
        });

        localStorage.setItem('membership_freezes', JSON.stringify(updated));
        await Promise.all(memberIds.map(id => this.syncMemberEndDate(id as string)));
        await this.logAction('UPDATE_BULK_FREEZE', `Bulk suspension updated for batch: ${batchId}`);
    }
  }

  async getMembershipTypes(scopeId?: string, isProperty: boolean = false, limitToOutletIds?: string[]): Promise<MembershipType[]> {
    if (this.isSupabase()) {
      let query = supabase.from('membership_types').select('*');
      if (scopeId) {
          if (isProperty) {
              if (limitToOutletIds && limitToOutletIds.length > 0) {
                  query = query.in('outlet_id', limitToOutletIds);
              } else {
                  const { data: outlets } = await supabase.from('outlets').select('id').eq('property_id', scopeId);
                  const ids = (outlets || []).map(o => o.id);
                  query = query.in('outlet_id', ids);
              }
          } else {
              query = query.eq('outlet_id', scopeId);
          }
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MembershipType[];
    }
    return [];
  }

  async addMembershipType(type: Omit<MembershipType, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      const newType = {
        ...type,
        id: `type_${crypto.randomUUID()}`,
        created_at: new Date().toISOString()
      };
      const { error } = await supabase.from('membership_types').insert([newType]);
      if (error) throw error;
      await this.logAction('CREATE_MEMBERSHIP_TYPE', `Created membership type: ${type.name}`, type.outlet_id);
    }
  }

  async updateMembershipType(id: string, updates: Partial<MembershipType>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('membership_types').update(updates).eq('id', id);
      if (error) throw error;
      await this.logAction('UPDATE_MEMBERSHIP_TYPE', `Updated membership type: ${id}`);
    }
  }

  async deleteMembershipType(id: string) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('membership_types').delete().eq('id', id);
      if (error) throw error;
      await this.logAction('DELETE_MEMBERSHIP_TYPE', `Deleted membership type ID: ${id}`);
    }
  }

  async getCategories(outletId?: string): Promise<MembershipCategory[]> {
    if (this.isSupabase()) {
      let query = supabase.from('membership_categories').select('*');
      if (outletId) query = query.eq('outlet_id', outletId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MembershipCategory[];
    }
    return [];
  }

  async addCategory(cat: Omit<MembershipCategory, 'id'>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('membership_categories').insert([{ ...cat, id: `cat_${crypto.randomUUID()}` }]);
      if (error) throw error;
      await this.logAction('CREATE_CATEGORY', `Created membership tier: ${cat.name} (Base Rate: ${cat.base_rate})`, cat.outlet_id);
    }
  }

  async updateCategory(id: string, updates: Partial<MembershipCategory>) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('membership_categories').update(updates).eq('id', id);
        if (error) throw error;
        const changedFields = Object.keys(updates).filter(k => updates[k] !== undefined && updates[k] !== null).join(', ');
        await this.logAction('UPDATE_CATEGORY', `Updated membership tier: ${id}. Modified fields: [${changedFields}]`);
    }
  }

  async deleteCategory(id: string) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('membership_categories').delete().eq('id', id);
        if (error) throw error;
        await this.logAction('DELETE_CATEGORY', `Deleted membership tier ID: ${id}`);
    }
  }

  async getSettings(): Promise<CompanySettings> {
    const defaultSettings: CompanySettings = { name: 'The Torch Hospitality', logo_url: '', address: '', currency_id: 'default' };
    if (this.isSupabase()) {
      try {
        const { data } = await supabase.from('company_settings').select('*').eq('id', 'global').maybeSingle();
        return (data as CompanySettings) || defaultSettings;
      } catch (e) { return defaultSettings; }
    }
    return defaultSettings;
  }

  async updateSettings(settings: CompanySettings) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('company_settings').upsert({ ...settings, id: 'global' });
      if (error) {
        console.error('Error updating settings:', error);
        throw error;
      }
      await this.logAction('UPDATE_SETTINGS', 'Global system configuration mutated.');
    }
  }

  async updateNavigationOrder(order: string[]) {
    if (this.isSupabase()) {
      // Try to update just the navigation_order column
      const { error } = await supabase.from('company_settings')
        .update({ navigation_order: order })
        .eq('id', 'global');

      if (error) {
        console.error('Error updating navigation order:', error);
        // Fallback: try upsert if update failed (e.g. row doesn't exist)
        if (error.code === 'PGRST104') { // unexpected, but just in case
             // handle specific errors if needed
        }
        throw error;
      }
      await this.logAction('UPDATE_NAVIGATION', 'UI Architecture updated.');
    }
  }

  async getCurrencies(): Promise<Currency[]> {
    if (this.isSupabase()) {
      const { data } = await supabase.from('currencies').select('*');
      return (data || []) as Currency[];
    }
    return [];
  }

  async addCurrency(curr: Omit<Currency, 'id'>) {
    if (this.isSupabase()) {
        const { data, error } = await supabase.from('currencies').insert([{ ...curr, id: curr.code.toLowerCase() }]).select();
        if (error) throw error;
        await this.logAction('CREATE_CURRENCY', `Monetary standard defined: ${curr.code}`);
        return data;
    }
  }

  async updateCurrency(id: string, updates: Partial<Currency>) {
    if (this.isSupabase()) {
        await supabase.from('currencies').update(updates).eq('id', id);
        await this.logAction('UPDATE_CURRENCY', `Currency modified: ${id}`);
    }
  }

  async deleteCurrency(id: string) {
    if (this.isSupabase()) {
        await supabase.from('currencies').delete().eq('id', id).eq('is_default', false);
        await this.logAction('DELETE_CURRENCY', `Currency purged: ${id}`);
    }
  }

  async getRoles(): Promise<Role[]> {
    if (this.isSupabase()) {
      const { data } = await supabase.from('roles').select('*');
      return (data || []) as Role[];
    }
    return [];
  }

  async addRole(role: Omit<Role, 'id'>) {
    if (this.isSupabase()) {
        const { data, error } = await supabase.from('roles').insert([{ ...role, id: role.name.toLowerCase().replace(/\s+/g, '_') }]).select();
        if (error) throw error;
        await this.logAction('CREATE_ROLE', `Security protocol tier defined: ${role.name}`);
        return data;
    }
  }

  async updateRole(id: string, updates: Partial<Role>) {
    if (this.isSupabase()) {
        await supabase.from('roles').update(updates).eq('id', id);
        await this.logAction('UPDATE_ROLE', `Role modified: ${id}`);
    }
  }

  async deleteRole(id: string) {
    if (this.isSupabase()) {
        await supabase.from('roles').delete().eq('id', id).eq('is_system', false);
        await this.logAction('DELETE_ROLE', `Role purged: ${id}`);
    }
  }

  async getOutlets(): Promise<Outlet[]> {
    if (this.isSupabase()) {
      const { data } = await supabase.from('outlets').select('*');
      return (data || []) as Outlet[];
    }
    return [];
  }

  async addOutlet(outlet: Omit<Outlet, 'id'>) {
    if (this.isSupabase()) {
        const { data, error } = await supabase.from('outlets').insert([{ ...outlet, id: crypto.randomUUID() }]).select();
        if (error) throw error;
        await this.logAction('CREATE_OUTLET', `Facility outlet commissioned: ${outlet.name}`);
        return data;
    }
  }

  async updateOutlet(id: string, updates: Partial<Outlet>) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('outlets').update(updates).eq('id', id);
        if (error) throw error;
        await this.logAction('UPDATE_OUTLET', `Outlet modified: ${id}`);
    }
  }

  async deleteOutlet(id: string) {
    if (this.isSupabase()) {
        await supabase.from('outlets').delete().eq('id', id);
        await this.logAction('DELETE_OUTLET', `Outlet decommissioned: ${id}`);
    }
  }

  async getMassageRooms(outletId?: string, propertyId?: string): Promise<MassageRoom[]> {
    if (this.isSupabase()) {
      let query = supabase.from('massage_rooms').select('*');
      if (outletId) {
          query = query.eq('outlet_id', outletId);
      } else if (propertyId) {
          query = query.eq('property_id', propertyId);
      }
      const { data } = await query;
      return (data || []) as MassageRoom[];
    }
    return [];
  }

  async addMassageRoom(room: Omit<MassageRoom, 'id'>) {
    if (this.isSupabase()) {
        const { data, error } = await supabase.from('massage_rooms').insert([{ ...room, id: crypto.randomUUID() }]).select();
        if (error) throw error;
        await this.logAction('CREATE_ROOM', `Massage room added: ${room.name}`);
        return data;
    }
  }

  async updateMassageRoom(id: string, updates: Partial<MassageRoom>) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('massage_rooms').update(updates).eq('id', id);
        if (error) throw error;
        await this.logAction('UPDATE_ROOM', `Massage room modified: ${id}`);
    }
  }

  async deleteMassageRoom(id: string) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('massage_rooms').delete().eq('id', id);
        if (error) throw error;
        await this.logAction('DELETE_ROOM', `Massage room deleted: ${id}`);
    }
  }

  async getProperties(): Promise<Property[]> {
    if (this.isSupabase()) {
      const { data } = await supabase.from('properties').select('*');
      return (data || []) as Property[];
    }
    return [];
  }

  async addProperty(prop: Omit<Property, 'id'>) {
    if (this.isSupabase()) {
        const { data, error } = await supabase.from('properties').insert([{ ...prop, id: crypto.randomUUID() }]).select();
        if (error) throw error;
        await this.logAction('CREATE_PROPERTY', `Property asset registered: ${prop.name}`);
        return data;
    }
  }

  async updateProperty(id: string, updates: Partial<Property>) {
    if (this.isSupabase()) {
        await supabase.from('properties').update(updates).eq('id', id);
        await this.logAction('UPDATE_PROPERTY', `Property modified: ${id}`);
    }
  }

  async deleteProperty(id: string) {
    if (this.isSupabase()) {
        await supabase.from('properties').delete().eq('id', id);
        await this.logAction('DELETE_PROPERTY', `Property purged: ${id}`);
    }
  }

  async getLogs(outlet_id?: string): Promise<SystemLog[]> {
    if (this.isSupabase()) {
      let query = supabase.from('system_logs').select('*').order('timestamp', { ascending: false }).limit(1000);
      if (outlet_id) query = query.or(`outlet_id.eq.${outlet_id},outlet_id.is.null`);
      const { data } = await query;
      return (data || []) as SystemLog[];
    }
    return [];
  }

  async getInventory(scopeId: string, isPropertyScope: boolean = false, options?: string[] | { limit?: number }): Promise<InventoryItem[]> {
    if (this.isSupabase()) {
        try {
            let query = supabase.from('inventory').select('*');
            
            let limitToOutletIds: string[] | undefined;
            let limit: number | undefined;
            
            if (Array.isArray(options)) {
                limitToOutletIds = options;
            } else if (options && typeof options === 'object') {
                limit = (options as any).limit;
            }

            if (scopeId !== 'all') {
                if (isPropertyScope) {
                    if (limitToOutletIds && limitToOutletIds.length > 0) {
                        query = query.in('outlet_id', limitToOutletIds);
                    } else {
                        query = query.eq('property_id', scopeId);
                    }
                }
                else query = query.eq('outlet_id', scopeId);
            }
            
            if (limit) query = query.limit(limit);

            const { data, error } = await query.order('name');
            if (error) throw error;
            return (data || []) as InventoryItem[];
        } catch (e: any) {
            console.error("Inventory fetch error:", e);
            return [];
        }
    }
    return [];
  }

  async getInventoryLogs(scopeId: string, isPropertyScope: boolean = false): Promise<InventoryLog[]> {
    if (this.isSupabase()) {
      let query = supabase.from('inventory_logs').select('*');
      if (isPropertyScope) {
          const { data: outlets } = await supabase.from('outlets').select('id').eq('property_id', scopeId);
          const ids = (outlets || []).map(o => o.id);
          query = query.in('outlet_id', ids);
      } else {
          query = query.eq('outlet_id', scopeId);
      }
      const { data } = await query.order('created_at', { ascending: false });
      return (data || []) as InventoryLog[];
    }
    return [];
  }

  async addInventoryLog(log: Omit<InventoryLog, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      await supabase.from('inventory_logs').insert([{ ...log, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
    }
  }

  async addInventoryItem(item: Omit<InventoryItem, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
        const { data, error } = await supabase.from('inventory').insert([{ ...item, id: crypto.randomUUID(), created_at: new Date().toISOString() }]).select().single();
        if (error) throw error;
        
        // Log initial stock
        if (item.stock_quantity > 0) {
            await this.addInventoryLog({
                item_id: data.id,
                property_id: item.property_id,
                outlet_id: item.outlet_id,
                change_amount: item.stock_quantity,
                previous_stock: 0,
                new_stock: item.stock_quantity,
                reason: 'Initial',
                notes: 'Initial stock creation'
            });
        }

        await this.logAction('CREATE_INVENTORY', `Added inventory item: ${item.name} (Price: ${item.price}, Stock: ${item.stock_quantity})`, item.outlet_id);
        return data;
    }
  }

  async updateInventoryItem(id: string, updates: Partial<InventoryItem>, reason?: string, userId?: string) {
    if (this.isSupabase()) {
        // Get current item for logging
        const { data: currentItem } = await supabase.from('inventory').select('*').eq('id', id).single();

        const { error } = await supabase.from('inventory').update(updates).eq('id', id);
        if (error) throw error;

        // Log stock change if quantity changed
        if (currentItem && updates.stock_quantity !== undefined && updates.stock_quantity !== currentItem.stock_quantity) {
            const change = updates.stock_quantity - currentItem.stock_quantity;
            await this.addInventoryLog({
                item_id: id,
                property_id: currentItem.property_id,
                outlet_id: currentItem.outlet_id,
                change_amount: change,
                previous_stock: currentItem.stock_quantity,
                new_stock: updates.stock_quantity,
                reason: change > 0 ? 'Restock' : 'Adjustment',
                notes: reason || 'Manual adjustment',
                created_by: userId
            });
        }

        const changedFields = Object.keys(updates).filter(k => updates[k] !== undefined && updates[k] !== null).join(', ');
        await this.logAction('UPDATE_INVENTORY', `Updated inventory item: ${id}. Modified fields: [${changedFields}]`);
    }
  }

  async deleteInventoryItem(id: string) {
    if (this.isSupabase()) {
        await supabase.from('inventory').delete().eq('id', id);
        await this.logAction('DELETE_INVENTORY', `Deleted inventory item ID: ${id}`);
    }
  }

  async getSales(scopeId: string, isPropertyScope: boolean = false, limitToOutletIds?: string[]): Promise<Sale[]> {
    if (this.isSupabase()) {
        let query = supabase.from('sales').select('*');
        if (isPropertyScope) {
            if (limitToOutletIds && limitToOutletIds.length > 0) {
                query = query.in('outlet_id', limitToOutletIds);
            } else {
                query = query.eq('property_id', scopeId);
            }
        }
        else query = query.eq('outlet_id', scopeId);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as Sale[] | any;
    }
    return [];
  }

  async getSalesByDate(scopeId: string, isPropertyScope: boolean, dateStr: string): Promise<Sale[]> {
    if (this.isSupabase()) {
        let query = supabase.from('sales').select('*');
        if (isPropertyScope) query = query.eq('property_id', scopeId);
        else query = query.eq('outlet_id', scopeId);
        
        query = query.gte('created_at', `${dateStr}T00:00:00`).lte('created_at', `${dateStr}T23:59:59`);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as Sale[];
    }
    return [];
  }

  async getSalesByDateRange(scopeId: string, isPropertyScope: boolean, startDate: string, endDate: string): Promise<Sale[]> {
    if (this.isSupabase()) {
        let query = supabase.from('sales').select('*');
        if (isPropertyScope) query = query.eq('property_id', scopeId);
        else query = query.eq('outlet_id', scopeId);
        
        query = query.gte('created_at', `${startDate}T00:00:00`).lte('created_at', `${endDate}T23:59:59`);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as Sale[];
    }
    return [];
  }

  async addSale(sale: Omit<Sale, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('sales').insert([{ ...sale, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
        if (error) throw error;
        await this.logAction('POS_SALE', `Processed sale: ${sale.quantity}x ${sale.item_name} for ${sale.guest_name || 'Walk-in'} (Total: ${sale.net_amount})`, sale.outlet_id);
    }
  }

  async updateSale(id: string, updates: Partial<Sale>) {
    if (this.isSupabase()) {
        await supabase.from('sales').update(updates).eq('id', id);
        const changedFields = Object.keys(updates).filter(k => updates[k] !== undefined && updates[k] !== null).join(', ');
        await this.logAction('POS_SALE_UPDATE', `Updated sale: ${id}. Modified fields: [${changedFields}]`);
    }
  }

  async deleteSale(id: string) {
    if (this.isSupabase()) {
        const { data: sale } = await supabase.from('sales').select('booking_id').eq('id', id).single();
        
        await supabase.from('sales').delete().eq('id', id);
        await this.logAction('POS_VOID', `Voided sale ID: ${id}`);

        // If this sale was linked to a booking, restore the booking to 'confirmed'
        if (sale?.booking_id) {
            await supabase.from('massage_bookings').update({ status: 'confirmed' }).eq('id', sale.booking_id);
            await this.logAction('BOOKING_RESTORED', `Booking ${sale.booking_id} restored after sale void.`);
        }
    }
  }

  async getGuests(propertyId: string, options?: { limit?: number }): Promise<Guest[]> {
    if (this.isSupabase()) {
      let query = supabase.from('guests').select('*').eq('property_id', propertyId);
      if (options?.limit) query = query.limit(options.limit);
      const { data, error } = await query.order('name');
      if (error) throw error;
      return (data || []) as Guest[];
    }
    return [];
  }

  async saveGuest(guest: Omit<Guest, 'id' | 'created_at'>): Promise<Guest> {
    if (this.isSupabase()) {
      const { data: existing } = await supabase.from('guests').select('*').eq('phone', guest.phone).eq('property_id', guest.property_id).maybeSingle();
      if (existing) {
        const updates: any = { name: guest.name, email: guest.email };
        if (guest.id_card_url) updates.id_card_url = guest.id_card_url;
        
        const { data, error } = await supabase.from('guests').update(updates).eq('id', existing.id).select().single();
        if (error) throw error;
        return data as Guest;
      } else {
        const { data, error } = await supabase.from('guests').insert([{ ...guest, id: crypto.randomUUID(), created_at: new Date().toISOString() }]).select().single();
        if (error) throw error;
        return data as Guest;
      }
    }
    return { ...guest, id: crypto.randomUUID(), created_at: new Date().toISOString() } as Guest;
  }

  async deleteGuest(id: string) {
    if (this.isSupabase()) {
        await supabase.from('guests').delete().eq('id', id);
        await this.logAction('DELETE_GUEST', `Guest record purged: ${id}`);
    }
  }

  async getTherapists(scopeId: string, isPropertyScope: boolean = false, limitToOutletIds?: string[]): Promise<Therapist[]> {
    if (this.isSupabase()) {
      let query = supabase.from('therapists').select('*');
      if (isPropertyScope) {
          if (limitToOutletIds && limitToOutletIds.length > 0) {
              query = query.in('outlet_id', limitToOutletIds);
          } else {
              query = query.eq('property_id', scopeId);
          }
      }
      else query = query.eq('outlet_id', scopeId);

      const { data, error } = await query;
      if (error) throw error;
      
      const therapists = (data || []) as Therapist[];
      
      const { data: staffData } = await supabase.from('staff').select('*');
      
      if (staffData) {
          // 1. Filter existing therapists based on staff role
          const validTherapists = therapists.filter(t => {
              const staff = staffData.find(s => s.id === t.id);
              if (staff) {
                  t.type = staff.role;
                  return /therapist|specialist|masseur|masseuse|trainer|coach|instructor|pt|gym|fitness/i.test(staff.role);
              } else {
                  t.type = 'Therapist';
                  return true;
              }
          });

          // 2. Add staff members who have therapist/trainer roles but aren't in therapists table
          const existingIds = new Set(validTherapists.map(t => t.id));
          const newTherapistsFromStaff = staffData.filter(s => 
              !existingIds.has(s.id) && 
              /therapist|specialist|masseur|masseuse|trainer|coach|instructor|pt|gym|fitness/i.test(s.role) &&
              (isPropertyScope ? (limitToOutletIds?.length ? limitToOutletIds.includes(s.outlet_id) : true) : s.outlet_id === scopeId)
          ).map(s => ({
              id: s.id,
              name: s.name,
              specialty: s.role,
              country: 'Local',
              property_id: isPropertyScope ? scopeId : '', // We don't have property_id in staff, but it's fine for UI
              outlet_id: s.outlet_id,
              type: s.role
          }));

          return [...validTherapists, ...newTherapistsFromStaff];
      }
      
      return therapists;
    }
    return [];
  }

  async addTherapist(therapist: Omit<Therapist, 'id'>) {
    if (this.isSupabase()) {
        const id = crypto.randomUUID();
        const { type, ...therapistData } = therapist;
        const { data, error } = await supabase.from('therapists').insert([{ ...therapistData, id }]).select();
        if (error) throw error;
        
        await supabase.from('staff').insert([{
            id,
            outlet_id: therapist.outlet_id,
            name: therapist.name,
            role: type || 'Therapist',
            is_active: true,
            is_eligible_for_incentives: true
        }]);

        await this.logAction('CREATE_THERAPIST', `Specialist enrolled: ${therapist.name}`, therapist.outlet_id);
        return data;
    }
  }

  async updateTherapist(id: string, updates: Partial<Therapist>) {
    if (this.isSupabase()) {
        const { type, ...therapistUpdates } = updates;
        
        // Check if therapist exists
        const { data: existing } = await supabase.from('therapists').select('id').eq('id', id).single();
        
        if (existing) {
            if (Object.keys(therapistUpdates).length > 0) {
                await supabase.from('therapists').update(therapistUpdates).eq('id', id);
            }
        } else {
            // Insert if it doesn't exist (e.g. created from Staff Roster)
            const { data: staffData } = await supabase.from('staff').select('*').eq('id', id).single();
            if (staffData) {
                await supabase.from('therapists').insert([{
                    id,
                    name: updates.name || staffData.name,
                    specialty: updates.specialty || staffData.role,
                    country: updates.country || 'Local',
                    property_id: updates.property_id || '', // Will be handled by DB or UI
                    outlet_id: updates.outlet_id || staffData.outlet_id
                }]);
            }
        }
        
        if (updates.name || type) {
            const staffUpdates: any = {};
            if (updates.name) staffUpdates.name = updates.name;
            if (type) staffUpdates.role = type;
            await supabase.from('staff').update(staffUpdates).eq('id', id);
        }

        await this.logAction('UPDATE_THERAPIST', `Specialist profile adjusted: ${id}`);
    }
  }

  async deleteTherapist(id: string) {
    if (this.isSupabase()) {
        await supabase.from('therapists').delete().eq('id', id);
        await supabase.from('staff').delete().eq('id', id);
        await this.logAction('DELETE_THERAPIST', `Specialist record purged: ${id}`);
    }
  }

  async getMassageTypes(scopeId: string, isPropertyScope: boolean = false, limitToOutletIds?: string[]): Promise<MassageType[]> {
    if (this.isSupabase()) {
      let query = supabase.from('massage_types').select('*');
      if (isPropertyScope) {
          if (limitToOutletIds && limitToOutletIds.length > 0) {
              query = query.in('outlet_id', limitToOutletIds);
          } else {
              query = query.eq('property_id', scopeId);
          }
      }
      else query = query.eq('outlet_id', scopeId);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MassageType[];
    }
    return [];
  }

  async addMassageType(type: Omit<MassageType, 'id'>) {
    if (this.isSupabase()) {
        const { data, error } = await supabase.from('massage_types').insert([{ ...type, id: crypto.randomUUID() }]).select();
        if (error) throw error;
        await this.logAction('CREATE_TREATMENT', `Service portfolio item added: ${type.name}`, type.outlet_id);
        return data;
    }
  }

  async updateMassageType(id: string, updates: Partial<MassageType>) {
    if (this.isSupabase()) {
        await supabase.from('massage_types').update(updates).eq('id', id);
        await this.logAction('UPDATE_TREATMENT', `Service modified: ${id}`);
    }
  }

  async deleteMassageType(id: string) {
    if (this.isSupabase()) {
        await supabase.from('massage_types').delete().eq('id', id);
        await this.logAction('DELETE_TREATMENT', `Service retired: ${id}`);
    }
  }

  async getMassageBookings(scopeId: string, isPropertyScope: boolean = false, limitToOutletIds?: string[]): Promise<MassageBooking[]> {
    if (this.isSupabase()) {
      let query = supabase.from('massage_bookings').select('*');
      if (isPropertyScope) {
          if (limitToOutletIds && limitToOutletIds.length > 0) {
              query = query.in('outlet_id', limitToOutletIds);
          } else {
              query = query.eq('property_id', scopeId);
          }
      }
      else query = query.eq('outlet_id', scopeId);

      const { data, error } = await query.order('date', { ascending: false });
      if (error) throw error;
      return (data || []) as MassageBooking[];
    }
    return [];
  }

  async getMassageBookingsByDate(scopeId: string, isPropertyScope: boolean, dateStr: string): Promise<MassageBooking[]> {
    if (this.isSupabase()) {
      let query = supabase.from('massage_bookings').select('*');
      if (isPropertyScope) query = query.eq('property_id', scopeId);
      else query = query.eq('outlet_id', scopeId);
      
      query = query.eq('date', dateStr);

      const { data, error } = await query.order('start_time', { ascending: true });
      if (error) throw error;
      return (data || []) as MassageBooking[];
    }
    return [];
  }

  async getMassageBookingsByDateRange(scopeId: string, isPropertyScope: boolean, startDate: string, endDate: string): Promise<MassageBooking[]> {
    if (this.isSupabase()) {
      let query = supabase.from('massage_bookings').select('*');
      if (isPropertyScope) query = query.eq('property_id', scopeId);
      else query = query.eq('outlet_id', scopeId);
      
      query = query.gte('date', startDate).lte('date', endDate);

      const { data, error } = await query.order('date', { ascending: false }).order('start_time', { ascending: true });
      if (error) throw error;
      return (data || []) as MassageBooking[];
    }
    return [];
  }

  async addMassageBooking(booking: Omit<MassageBooking, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('massage_bookings').insert([{ ...booking, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
      if (error) throw error;
      await this.logAction('CREATE_BOOKING', `Created booking on ${booking.date} at ${booking.start_time} (Therapist ID: ${booking.therapist_id})`, booking.outlet_id);
    }
  }

  async updateMassageBooking(id: string, updates: Partial<MassageBooking>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('massage_bookings').update(updates).eq('id', id);
      if (error) throw error;
    }
  }

  async updateMassageBookingStatus(id: string, status: MassageBooking['status'], roomId?: string) {
    if (this.isSupabase()) {
      const { data: booking } = await supabase.from('massage_bookings').select('*').eq('id', id).single();
      if (!booking) return;

      const updates: any = { status };
      if (roomId) updates.room_id = roomId;

      const { error } = await supabase.from('massage_bookings').update(updates).eq('id', id);
      if (error) throw error;

      // If status changed FROM completed TO something else, delete the associated sale
      if (booking.status === 'completed' && status !== 'completed') {
          await supabase.from('sales').delete().eq('booking_id', id);
          await this.logAction('BOOKING_UNSERVED', `Sale record removed for booking ${id} as status changed to ${status}`);
      }

      // If status changed TO completed, create a sale record
      if (status === 'completed' && booking.status !== 'completed') {
        const { data: guest } = await supabase.from('guests').select('name').eq('id', booking.guest_id).single();
        
        let itemName = 'Service';
        let itemCategory = 'Massage';
        let itemId = null;

        if (booking.inventory_item_id) {
            const { data: inv } = await supabase.from('inventory').select('name, category').eq('id', booking.inventory_item_id).single();
            if (inv) {
                itemName = inv.name;
                itemCategory = inv.category;
                itemId = booking.inventory_item_id;
            }
        } else if (booking.massage_type_id) {
            const { data: type } = await supabase.from('massage_types').select('name, category').eq('id', booking.massage_type_id).single();
            if (type) {
                itemName = type.name;
                itemCategory = type.category || 'Massage';
            }
        }

        const sale: Omit<Sale, 'id' | 'created_at'> = {
          property_id: booking.property_id,
          outlet_id: booking.outlet_id,
          guest_id: booking.guest_id,
          guest_name: guest?.name || 'Guest',
          category: itemCategory as SaleCategory,
          item_id: itemId,
          item_name: itemName,
          quantity: 1,
          unit_price: booking.price + (booking.discount || 0),
          gross_amount: booking.price + (booking.discount || 0),
          discount_amount: booking.discount || 0,
          net_amount: booking.price,
          payment_method: 'Cash', // Default
          status: 'completed',
          sold_by_id: booking.therapist_id,
          booking_id: booking.id,
          discount_reason: booking.discount_reason,
          discount_id_url: booking.discount_id_url,
          remarks: ''
        };

        await this.addSale(sale);
      }
    }
  }

  async deleteMassageBooking(id: string) {
    if (this.isSupabase()) {
      // Also delete any associated sales
      await supabase.from('sales').delete().eq('booking_id', id);
      const { error } = await supabase.from('massage_bookings').delete().eq('id', id);
      if (error) throw error;
      await this.logAction('DELETE_BOOKING', `Deleted booking ID: ${id}`);
    }
  }

  async getIncentiveRules(propertyId?: string, outletId?: string): Promise<IncentiveRule[]> {
    if (this.isSupabase()) {
      try {
        let query = supabase.from('incentive_rules').select('*').order('created_at', { ascending: false });
        if (propertyId || outletId) {
            const filterArr = ["scope.eq.Global"];
            if (propertyId) filterArr.push(`and(scope.eq.Property,scope_id.eq.${propertyId})`);
            if (outletId) filterArr.push(`and(scope.eq.Outlet,scope_id.eq.${outletId})`);
            query = query.or(filterArr.join(','));
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as IncentiveRule[];
      } catch (e) { return []; }
    }
    return [];
  }

  async addIncentiveRule(rule: Omit<IncentiveRule, 'id'>) {
    if (this.isSupabase()) {
        const { data, error } = await supabase.from('incentive_rules').insert([{ ...rule, id: crypto.randomUUID(), created_at: new Date().toISOString() }]).select();
        if (error) throw error;
        await this.logAction('CREATE_INCENTIVE', `Yield strategy authorized: ${rule.name}`);
        return data;
    }
  }

  async updateIncentiveRule(id: string, updates: Partial<IncentiveRule>) {
    if (this.isSupabase()) {
        await supabase.from('incentive_rules').update(updates).eq('id', id);
        await this.logAction('UPDATE_INCENTIVE', `Incentive logic adjusted: ${id}`);
    }
  }

  async deleteIncentiveRule(id: string) {
    if (this.isSupabase()) {
        await supabase.from('incentive_rules').delete().eq('id', id);
        await this.logAction('DELETE_INCENTIVE', `Incentive rule decommissioned: ${id}`);
    }
  }

  async updateMemberNotes(id: string, notes: string) {
    if (this.isSupabase()) {
        await supabase.from('members').update({ notes }).eq('id', id);
        await this.logAction('UPDATE_MEMBER_NOTES', `Member notes updated for ID: ${id}`);
    } else {
        // Local Mode Fallback
        const members = JSON.parse(localStorage.getItem('membership_members') || '[]');
        const mIndex = members.findIndex((mem: any) => mem.id === id);
        if (mIndex !== -1) {
            members[mIndex] = { ...members[mIndex], notes };
            localStorage.setItem('membership_members', JSON.stringify(members));
            await this.logAction('UPDATE_MEMBER_NOTES', `Member notes updated locally for ID: ${id}`);
        }
    }
  }
}

export const db = new DatabaseService();