import { UserProfile, Role, Currency, CompanySettings, Member, MembershipCategory, Freeze, MemberStatus, Outlet, Property, SystemLog, Permission, Guest, Therapist, MassageType, MassageBooking, Sale, SaleCategory, InventoryItem, IncentiveRule, Staff, UserPermissionOverride, PermissionGroup, StaffLeave, InventoryLog, MassageRoom, MembershipType, ReportRecipient, Notification, CustomReportConfig } from '../types';
import { supabase, supabaseUrl, supabaseAnonKey } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { addDays, format, parse, differenceInCalendarDays } from 'date-fns';

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
  private static supabaseFailed = false;
  private isSupabase() {
    return !!supabase && !DatabaseService.supabaseFailed;
  }

  private async safeCall<T>(call: () => Promise<T>, fallback: T): Promise<T> {
    try {
      const result = await call();
      return result;
    } catch (e: any) {
      if (e.message?.includes('fetch') || e.message?.includes('Load failed') || e.message?.includes('Connection Error')) {
        console.warn("Supabase fetch failed, disabling Supabase for this session and falling back to mock data", e);
        DatabaseService.supabaseFailed = true;
        return fallback;
      }
      throw e;
    }
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
          { key: 'members:bulk_freeze', label: 'Bulk Freeze', description: 'Authorize global holds for maintenance or holidays.' },
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
          { key: 'staff:manage_portal_settings', label: 'Portal Configuration', description: 'Manage visibility and features for the staff portal.' },
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
          { key: 'users:edit', label: 'Edit Roles', description: 'Change roles and outlet access scopes.' },
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
          { key: 'settings:view_roles', label: 'Roles & Permissions', description: 'Define role-based permission templates.' },
          { key: 'settings:view_currency', label: 'Monetary Standards', description: 'Manage currency and exchange rates.' },
          { key: 'settings:view_shortcuts', label: 'Hotkey Controls', description: 'Configure system-wide keyboard shortcuts.' },
          { key: 'settings:view_documents', label: 'Legal Templates', description: 'Manage contract and agreement text.' },
          { key: 'settings:view_navigation', label: 'UI Architecture', description: 'Rearrange sidebar navigation order.' },
          { key: 'settings:view_incentives', label: 'Yield Logic', description: 'Manage complex incentive distribution rules.' },
          { key: 'settings:view_maintenance', label: 'Terminal Ops', description: 'Access database maintenance and wipe tools.' },
          { key: 'settings:view_staff_portal', label: 'Staff Portal', description: 'Access staff portal configuration.' },
          { key: 'settings:view_booking_engine', label: 'Booking Engine', description: 'Access booking engine settings.' },
          { key: 'settings:view_membership_types', label: 'Membership Types', description: 'Access membership types configuration.' },
          { key: 'settings:view_massage_rooms', label: 'Massage Rooms', description: 'Access massage rooms configuration.' },
          { key: 'settings:view_reports_config', label: 'Report Distribution', description: 'Access report distribution settings.' },
          { key: 'settings:view_custom_reports', label: 'Custom Intelligence', description: 'Access custom report builder.' },
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
          { key: 'settings:manage_staff_portal', label: 'Manage Staff Portal', description: 'Edit staff portal configuration.' },
          { key: 'settings:manage_booking_engine', label: 'Manage Booking Engine', description: 'Edit booking engine settings.' },
          { key: 'settings:manage_membership_types', label: 'Manage Membership Types', description: 'Edit membership types configuration.' },
          { key: 'settings:manage_massage_rooms', label: 'Manage Massage Rooms', description: 'Edit massage rooms configuration.' },
          { key: 'settings:manage_reports_config', label: 'Manage Report Distribution', description: 'Edit report distribution settings.' },
          { key: 'settings:manage_custom_reports', label: 'Manage Custom Intelligence', description: 'Edit custom report builder.' },
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

  async syncMemberEndDate(memberId: string) {
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
    await this.safeCall(async () => {
      const { data: { user } } = await (supabase.auth as any).getUser();
      if (!user) return;
      const metaName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.display_name;
      if (profile.name !== metaName) {
        await (supabase.auth as any).updateUser({
          data: { full_name: profile.name, display_name: profile.name, name: profile.name }
        });
      }
    }, null);
  }

  async signUp(email: string, passwordAttempt: string, name: string): Promise<{ user: UserProfile | null, error: string | null }> {
    if (!this.isSupabase()) return { user: null, error: "Cloud sync offline." };
    return this.safeCall(async () => {
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
    }, { user: null, error: "Network error during signup." });
  }

  async updateEmail(email: string) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error } = await (supabase.auth as any).updateUser({ email: email.trim().toLowerCase() });
        if (error) throw error;
      }, null);
    }
  }

  async login(email: string, passwordAttempt: string): Promise<{ user: UserProfile | null, error: string | null, requiresPasswordChange: boolean }> {
    if (!this.isSupabase()) return { user: null, error: "Cloud sync offline.", requiresPasswordChange: false };
    return this.safeCall(async () => {
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
    }, { user: null, error: "Network error during login.", requiresPasswordChange: false });
  }

  async addUser(user: Omit<UserProfile, 'id'> & { password?: string }): Promise<UserProfile> {
    const cleanEmail = user.email.trim().toLowerCase();
    let authId: string | null = user.auth_id || null;
    let tempPassword: string | null = user.password || 'Temporary123!';
    if (this.isSupabase()) {
      return this.safeCall(async () => {
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
      }, { ...user, id: crypto.randomUUID() } as UserProfile);
    }
    return { ...user, id: crypto.randomUUID() } as UserProfile;
  }

  async updateUser(id: string, updates: Partial<UserProfile>) { 
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { data: current, error: fetchError } = await supabase.from('profiles').select('email, name').eq('id', id).single();
        if (fetchError) throw fetchError;
        const finalUpdates: any = { 
            name: updates.name, 
            email: updates.email?.trim().toLowerCase(), 
            role_id: updates.role_id, 
            allowed_outlets: updates.allowed_outlets, 
            is_active: updates.is_active,
            updated_at: new Date().toISOString() 
        };
        Object.keys(finalUpdates).forEach(k => finalUpdates[k] === undefined && delete finalUpdates[k]);
        const { error: updateError } = await supabase.from('profiles').update(finalUpdates).eq('id', id);
        if (updateError) throw updateError;
        await this.logAction('UPDATE_USER', `Identity modified for ${current.name} (${current.email})`);
      }, null);
    }
  }

  async getUsers(): Promise<UserProfile[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) throw error;
        return (data || []) as UserProfile[];
      }, []);
    }
    return [];
  }

  async deleteUser(id: string) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) throw error;
      }, null);
    }
  }

  async changePassword(userId: string, currentPass: string, newPass: string) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error: authError } = await (supabase.auth as any).updateUser({ password: newPass });
        if (authError) throw authError;
        const { error: profileError } = await supabase.from('profiles').update({ temp_password: null }).eq('id', userId);
        if (profileError) throw profileError;
        await this.logAction('CHANGE_PASSWORD', `Credentials updated for user ID: ${userId}`);
      }, null);
    }
  }

  async getStaffById(id: string): Promise<Staff | null> {
    if (this.isSupabase()) {
      const { data, error } = await supabase.from('staff').select('*').eq('id', id).single();
      if (error) return null;
      return data as Staff;
    }
    return null;
  }

  async getStaff(scopeId?: string, isProperty: boolean = false, limitToOutletIds?: string[]): Promise<Staff[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        let query = supabase.from('staff').select('*, leaves:staff_leaves!fk_staff_leaves_staff(*)').order('name');
        
        // If we know it's a property, we can filter at the DB level for efficiency
        if (scopeId && isProperty) {
            query = query.eq('property_id', scopeId);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        let staffList = (data || []) as Staff[];

        // Filter in memory to avoid Postgres Array vs JSONB issues
        if (scopeId) {
            if (isProperty) {
                if (limitToOutletIds && limitToOutletIds.length > 0) {
                    staffList = staffList.filter(s => {
                        const sOutlets = Array.isArray(s.outlet_ids) ? s.outlet_ids : ((s as any).outlet_id ? [(s as any).outlet_id] : []);
                        return limitToOutletIds.some(id => sOutlets.includes(id));
                    });
                }
            } else {
                // scopeId is an outlet ID
                staffList = staffList.filter(s => {
                    const sOutlets = Array.isArray(s.outlet_ids) ? s.outlet_ids : ((s as any).outlet_id ? [(s as any).outlet_id] : []);
                    return sOutlets.includes(scopeId);
                });
            }
        }

        return staffList;
      }, []);
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

  async loginStaff(employeeNumber: string, password: string): Promise<Staff | null> {
    if (this.isSupabase()) {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('employee_number', employeeNumber)
        .eq('password', password)
        .eq('can_login', true)
        .eq('is_active', true)
        .single();
      
      if (error || !data) {
        return null;
      }
      return data as Staff;
    }
    return null;
  }

  async addStaff(staff: Omit<Staff, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      const { data, error } = await supabase.from('staff').insert([{ ...staff, id: crypto.randomUUID(), created_at: new Date().toISOString() }]).select();
      if (error) throw error;
      await this.logAction('CREATE_STAFF', `Added staff member: ${staff.name} (${staff.role})`, staff.outlet_ids[0]);
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
      return this.safeCall(async () => {
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
        
        const membersList = (data || []) as Member[];

        // Lazy background update for stale statuses (fire and forget)
        setTimeout(async () => {
          try {
            const frozenMembers = membersList.filter(m => m.status === MemberStatus.FROZEN);
            if (frozenMembers.length > 0) {
              const { data: freezes } = await supabase.from('freezes').select('*').in('member_id', frozenMembers.map(m => m.id));
              if (freezes) {
                const today = startOfDay(new Date());
                const membersToUpdate = frozenMembers.filter(m => {
                  const memberFreezes = freezes.filter(f => f.member_id === m.id);
                  const isCurrentlyFrozen = memberFreezes.some(f => {
                    const start = startOfDay(parseISO(f.start_date));
                    const end = startOfDay(parseISO(f.end_date));
                    return today >= start && today <= end;
                  });
                  return !isCurrentlyFrozen; // They are marked as frozen, but no active freeze exists today
                });
                
                // Trigger sync for members whose freeze has ended
                for (const m of membersToUpdate) {
                  await this.syncMemberEndDate(m.id);
                }
              }
            }

            // Also check for members who should be expired
            const today = startOfDay(new Date());
            const activeMembers = membersList.filter(m => m.status === MemberStatus.ACTIVE);
            const expiredMembers = activeMembers.filter(m => {
               const end = parseISO(m.current_end_date || m.original_end_date);
               return today > end;
            });

            for (const m of expiredMembers) {
               await this.syncMemberEndDate(m.id);
            }
          } catch (e) {
            console.error("Background status sync failed:", e);
          }
        }, 1000);

        return membersList;
      }, []);
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
      await this.addNotification({
        title: 'New Member Enrolled',
        message: `${member.guest_name} has joined with membership ${member.membership_number}.`,
        type: 'success',
        outlet_id: member.outlet_id
      });
    } else {
      const members = JSON.parse(localStorage.getItem('membership_members') || '[]');
      members.push(member);
      localStorage.setItem('membership_members', JSON.stringify(members));
      await this.logAction('CREATE_MEMBER', `Enrolled new member locally: ${member.guest_name}`, member.outlet_id);
      await this.addNotification({
        title: 'New Member Enrolled',
        message: `${member.guest_name} has joined with membership ${member.membership_number}.`,
        type: 'success',
        outlet_id: member.outlet_id
      });
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
      
      if (patch.status === MemberStatus.CANCELLED) {
        const { data: m } = await supabase.from('members').select('guest_name, membership_number, outlet_id').eq('id', id).single();
        await this.addNotification({
          title: 'Membership Cancelled',
          message: `${m?.guest_name || 'A member'} has cancelled their membership.`,
          type: 'error',
          outlet_id: m?.outlet_id
        });
      }
    } else {
        // Local Mode Fallback
        const members = JSON.parse(localStorage.getItem('membership_members') || '[]');
        const mIndex = members.findIndex((mem: any) => mem.id === id);
        if (mIndex !== -1) {
            members[mIndex] = { ...members[mIndex], ...member };
            localStorage.setItem('membership_members', JSON.stringify(members));
            await this.logAction('UPDATE_MEMBER', `Updated member profile locally: ${members[mIndex].guest_name || id}.`);
            
            if (member.status === MemberStatus.CANCELLED) {
              await this.addNotification({
                title: 'Membership Cancelled',
                message: `${members[mIndex].guest_name || 'A member'} has cancelled their membership.`,
                type: 'error',
                outlet_id: members[mIndex].outlet_id
              });
            }
        }
    }
  }

  async deleteMember(id: string) {
    if (this.isSupabase()) {
      const { data: memberData } = await supabase.from('members').select('guest_name, membership_number, outlet_id').eq('id', id).single();
      const { error } = await supabase.from('members').delete().eq('id', id);
      if (error) throw error;
      await this.logAction('DELETE_MEMBER', `Deleted member record ID: ${id}`);
      
      if (memberData) {
        await this.addNotification({
          title: 'Member Deleted',
          message: `Member ${memberData.guest_name} (${memberData.membership_number}) has been deleted.`,
          type: 'error',
          outlet_id: memberData.outlet_id
        });
      }
    } else {
      const members = JSON.parse(localStorage.getItem('membership_members') || '[]');
      const member = members.find((m: any) => m.id === id);
      const newMembers = members.filter((m: any) => m.id !== id);
      localStorage.setItem('membership_members', JSON.stringify(newMembers));
      await this.logAction('DELETE_MEMBER', `Deleted member record locally ID: ${id}`);
      
      if (member) {
        await this.addNotification({
          title: 'Member Deleted',
          message: `Member ${member.guest_name} (${member.membership_number}) has been deleted.`,
          type: 'error',
          outlet_id: member.outlet_id
        });
      }
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
      const { data: member } = await supabase.from('members').select('guest_name, membership_number, outlet_id').eq('id', freeze.member_id).single();
      const memberName = member?.guest_name || 'Unknown Member';
      const memberId = member?.membership_number || freeze.member_id;
      
      await this.logAction('FREEZE_MEMBER', `Account suspended: ${memberName}. Membership extended to ${newEndDate}`, member?.outlet_id);
      
      await this.addNotification({
        title: 'Membership Suspended',
        message: `${memberName} has been suspended for ${freeze.total_days} days.`,
        type: 'warning',
        outlet_id: member?.outlet_id
      });
    } else {
      const freezes = JSON.parse(localStorage.getItem('membership_freezes') || '[]');
      const data = { ...freeze, id: freeze.id || this.generateUUID() };
      freezes.push(data);
      localStorage.setItem('membership_freezes', JSON.stringify(freezes));
      
      const members = JSON.parse(localStorage.getItem('membership_members') || '[]');
      const mIndex = members.findIndex((m: any) => m.id === freeze.member_id);
      if (mIndex !== -1) {
        members[mIndex].status = MemberStatus.FROZEN;
        localStorage.setItem('membership_members', JSON.stringify(members));
        
        await this.logAction('FREEZE_MEMBER', `Suspended membership locally for ${members[mIndex].guest_name}.`, members[mIndex].outlet_id);
        await this.addNotification({
          title: 'Membership Suspended',
          message: `${members[mIndex].guest_name} has suspended their membership for ${freeze.total_days} days.`,
          type: 'warning',
          outlet_id: members[mIndex].outlet_id
        });
      }
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

  async bulkFreezeMembers(
    memberIds: string[],
    startDate: string,
    endDate: string,
    reason: string,
    isMaintenance: boolean = true,
    outletId?: string
  ) {
    const timestamp = new Date().toISOString();
    const freezeStart = startOfDay(parseISO(startDate));
    const freezeEnd = startOfDay(parseISO(endDate));
    const totalDays = differenceInCalendarDays(freezeEnd, freezeStart) + 1;
    
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        // 1. Create the Batch record first
        const { data: batch, error: batchError } = await supabase
          .from('maintenance_batches')
          .insert([{
            start_date: startDate,
            end_date: endDate,
            total_days: totalDays,
            reason: reason,
            outlet_id: outletId,
            is_maintenance: isMaintenance,
            created_at: timestamp
          }])
          .select()
          .single();

        if (batchError) throw batchError;

        // 2. Fetch member details to calculate individual overlap
        const { data: members, error: membersError } = await supabase
          .from('members')
          .select('id, start_date, original_end_date')
          .in('id', memberIds);

        if (membersError) throw membersError;

        // 3. Create individual freeze records linked to this batch
        const newFreezes = (members || []).map(m => {
          const memberStart = startOfDay(parseISO(m.start_date));
          const memberEnd = startOfDay(parseISO(m.original_end_date));
          
          // Calculate overlap between [memberStart, memberEnd] and [freezeStart, freezeEnd]
          const overlapStart = new Date(Math.max(memberStart.getTime(), freezeStart.getTime()));
          const overlapEnd = new Date(Math.min(memberEnd.getTime(), freezeEnd.getTime()));
          
          let actualDays = 0;
          if (overlapStart <= overlapEnd) {
            actualDays = Math.max(0, differenceInCalendarDays(overlapEnd, overlapStart) + 1);
          }

          return {
            id: this.generateUUID(),
            member_id: m.id,
            start_date: startDate,
            end_date: endDate,
            total_days: actualDays,
            reason: reason,
            is_maintenance: isMaintenance,
            maintenance_batch_id: batch.id,
            outlet_id: outletId,
            created_at: timestamp
          };
        });

        const { error: freezeError } = await supabase.from('freezes').insert(newFreezes);
        if (freezeError) throw freezeError;

        // 4. Sync all affected members to update their status and end dates
        await Promise.all(memberIds.map(id => this.syncMemberEndDate(id)));
        
        await this.logAction('BULK_FREEZE', `Bulk suspension applied to ${memberIds.length} members. Reason: ${reason}`);
        return batch.id;
      }, null);
    } else {
      // Local Mode Fallback
      const batchId = this.generateUUID();
      const members = JSON.parse(localStorage.getItem('membership_members') || '[]');
      
      const newFreezes = memberIds.map(id => {
        const m = members.find((mem: any) => mem.id === id);
        let actualDays = totalDays;
        
        if (m) {
          const memberStart = startOfDay(parseISO(m.start_date));
          const memberEnd = startOfDay(parseISO(m.original_end_date));
          const overlapStart = new Date(Math.max(memberStart.getTime(), freezeStart.getTime()));
          const overlapEnd = new Date(Math.min(memberEnd.getTime(), freezeEnd.getTime()));
          
          if (overlapStart <= overlapEnd) {
            actualDays = Math.max(0, differenceInCalendarDays(overlapEnd, overlapStart) + 1);
          } else {
            actualDays = 0;
          }
        }

        return {
          id: this.generateUUID(),
          member_id: id,
          start_date: startDate,
          end_date: endDate,
          total_days: actualDays,
          reason: reason,
          is_maintenance: true,
          batch_id: batchId,
          outlet_id: outletId,
          created_at: timestamp
        };
      });

      const existing = JSON.parse(localStorage.getItem('membership_freezes') || '[]');
      localStorage.setItem('membership_freezes', JSON.stringify([...existing, ...newFreezes]));
      
      // Store batch history locally
      const batches = JSON.parse(localStorage.getItem('membership_maintenance_batches') || '[]');
      batches.push({
        id: batchId,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        reason: reason,
        outlet_id: outletId,
        created_at: timestamp
      });
      localStorage.setItem('membership_maintenance_batches', JSON.stringify(batches));

      await Promise.all(memberIds.map(id => this.syncMemberEndDate(id)));
      return batchId;
    }
  }

  async getBulkFreezeHistory(outletId?: string): Promise<{ batch_id: string, start_date: string, end_date: string, total_days: number, reason: string, member_count: number, created_at: string }[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        // 1. Get dedicated batches
        let query = supabase.from('maintenance_batches').select('*');
        if (outletId) query = query.eq('outlet_id', outletId);
        
        const { data: batches, error: batchError } = await query.order('created_at', { ascending: false });
        
        if (batchError) throw batchError;

        // 2. Get ALL maintenance freezes
        let freezeQuery = supabase
            .from('freezes')
            .select('maintenance_batch_id, batch_id, start_date, end_date, total_days, reason, created_at, outlet_id')
            .eq('is_maintenance', true);
        
        if (outletId) freezeQuery = freezeQuery.eq('outlet_id', outletId);

        const { data: allMaintenance, error: freezeError } = await freezeQuery;
        
        if (freezeError) throw freezeError;

        // 3. Process dedicated batches
        const history = (batches || []).map(batch => ({
            batch_id: batch.id,
            start_date: batch.start_date,
            end_date: batch.end_date,
            total_days: batch.total_days,
            reason: batch.reason,
            member_count: (allMaintenance || []).filter(c => c.maintenance_batch_id === batch.id || c.batch_id === batch.id).length,
            created_at: batch.created_at
        }));

        // 4. Find and group orphaned freezes (those without a batch_id)
        const orphaned = (allMaintenance || []).filter(f => !f.maintenance_batch_id && !f.batch_id);
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
      }, []);
    } else {
        // Local Mode Fallback
        const allFreezes = JSON.parse(localStorage.getItem('membership_freezes') || '[]')
            .filter((f: any) => !!f.is_maintenance && (!outletId || f.outlet_id === outletId));
        
        const localBatches = JSON.parse(localStorage.getItem('membership_maintenance_batches') || '[]');
        const filteredBatches = localBatches.filter((b: any) => !outletId || b.outlet_id === outletId);

        const grouped = allFreezes.reduce((acc: any, curr: any) => {
            const bid = curr.batch_id || curr.maintenance_batch_id || `synthetic_${curr.start_date}_${curr.end_date}_${curr.reason || 'none'}`;
            if (!acc[bid]) {
                const batchInfo = filteredBatches.find((b: any) => b.id === bid);
                acc[bid] = {
                    batch_id: bid,
                    start_date: batchInfo?.start_date || curr.start_date,
                    end_date: batchInfo?.end_date || curr.end_date,
                    total_days: batchInfo?.total_days || curr.total_days,
                    reason: batchInfo?.reason || curr.reason || 'Global Maintenance',
                    member_count: 0,
                    created_at: batchInfo?.created_at || curr.created_at || new Date().toISOString()
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
    const freezeStart = startOfDay(parseISO(updates.start_date));
    const freezeEnd = startOfDay(parseISO(updates.end_date));

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

            // Fetch member details to recalculate overlap
            const { data: members } = await supabase.from('members').select('id, start_date, original_end_date').in('id', memberIds);

            // Update each freeze individually with its calculated overlap
            await Promise.all((members || []).map(async (m) => {
                const memberStart = startOfDay(parseISO(m.start_date));
                const memberEnd = startOfDay(parseISO(m.original_end_date));
                const overlapStart = new Date(Math.max(memberStart.getTime(), freezeStart.getTime()));
                const overlapEnd = new Date(Math.min(memberEnd.getTime(), freezeEnd.getTime()));
                
                let actualDays = 0;
                if (overlapStart <= overlapEnd) {
                    actualDays = Math.max(0, differenceInCalendarDays(overlapEnd, overlapStart) + 1);
                }

                let updateQuery = supabase.from('freezes').update({ ...updates, total_days: actualDays }).eq('member_id', m.id).eq('start_date', startDate).eq('end_date', endDate).eq('is_maintenance', true);
                if (reason === null) updateQuery = updateQuery.is('reason', null);
                else updateQuery = updateQuery.eq('reason', reason);
                await updateQuery;
            }));
        } else {
            // Handle new dedicated batches
            await supabase.from('maintenance_batches').update(updates).eq('id', batchId);
            
            const { data: f1 } = await supabase.from('freezes').select('member_id').eq('maintenance_batch_id', batchId);
            const { data: f2 } = await supabase.from('freezes').select('member_id').eq('batch_id', batchId);
            memberIds = Array.from(new Set([...(f1 || []), ...(f2 || [])].map(f => f.member_id)));

            // Fetch member details to recalculate overlap
            const { data: members } = await supabase.from('members').select('id, start_date, original_end_date').in('id', memberIds);

            // Update each freeze individually
            await Promise.all((members || []).map(async (m) => {
                const memberStart = startOfDay(parseISO(m.start_date));
                const memberEnd = startOfDay(parseISO(m.original_end_date));
                const overlapStart = new Date(Math.max(memberStart.getTime(), freezeStart.getTime()));
                const overlapEnd = new Date(Math.min(memberEnd.getTime(), freezeEnd.getTime()));
                
                let actualDays = 0;
                if (overlapStart <= overlapEnd) {
                    actualDays = Math.max(0, differenceInCalendarDays(overlapEnd, overlapStart) + 1);
                }

                await supabase.from('freezes').update({ ...updates, total_days: actualDays })
                    .or(`maintenance_batch_id.eq.${batchId},batch_id.eq.${batchId}`)
                    .eq('member_id', m.id);
            }));
        }

        await Promise.all(memberIds.map(id => this.syncMemberEndDate(id)));
        await this.logAction('UPDATE_BULK_FREEZE', `Bulk suspension modified for batch: ${batchId}`);
    } else {
        // Local Mode Update
        let freezes = JSON.parse(localStorage.getItem('membership_freezes') || '[]');
        const members = JSON.parse(localStorage.getItem('membership_members') || '[]');
        
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
            
            if (isMatch) {
                const m = members.find((mem: any) => mem.id === f.member_id);
                let actualDays = updates.total_days;
                if (m) {
                    const memberStart = startOfDay(parseISO(m.start_date));
                    const memberEnd = startOfDay(parseISO(m.original_end_date));
                    const overlapStart = new Date(Math.max(memberStart.getTime(), freezeStart.getTime()));
                    const overlapEnd = new Date(Math.min(memberEnd.getTime(), freezeEnd.getTime()));
                    if (overlapStart <= overlapEnd) {
                        actualDays = Math.max(0, differenceInCalendarDays(overlapEnd, overlapStart) + 1);
                    } else {
                        actualDays = 0;
                    }
                }
                return { ...f, ...updates, total_days: actualDays };
            }
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
        if (curr.is_default) {
            let query = supabase.from('currencies').update({ is_default: false });
            if (curr.property_id) {
                query = query.eq('property_id', curr.property_id);
            } else {
                query = query.is('property_id', null);
            }
            await query;
        }
        const id = curr.property_id ? `${curr.code.toLowerCase()}_${curr.property_id}` : curr.code.toLowerCase();
        const { data, error } = await supabase.from('currencies').insert([{ ...curr, id }]).select();
        if (error) throw error;
        await this.logAction('CREATE_CURRENCY', `Monetary standard defined: ${curr.code}`);
        return data;
    }
  }

  async updateCurrency(id: string, updates: Partial<Currency>) {
    if (this.isSupabase()) {
        if (updates.is_default) {
            const { data: curr } = await supabase.from('currencies').select('property_id').eq('id', id).single();
            let query = supabase.from('currencies').update({ is_default: false });
            if (curr?.property_id) {
                query = query.eq('property_id', curr.property_id);
            } else {
                query = query.is('property_id', null);
            }
            await query;
        }
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
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('roles').select('*');
        if (error) throw error;
        return (data || []) as Role[];
      }, []);
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
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('outlets').select('*');
        if (error) throw error;
        return (data || []) as Outlet[];
      }, []);
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

            // Low stock notification
            if (updates.stock_quantity <= 5 && currentItem.stock_quantity > 5) {
                await this.addNotification({
                    title: 'Low Stock Alert',
                    message: `Item "${currentItem.name}" is running low on stock (${updates.stock_quantity} remaining).`,
                    type: 'warning',
                    outlet_id: currentItem.outlet_id
                });
            }
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
        
        // Add notification
        await this.addNotification({
          title: 'New POS Sale',
          message: `${sale.quantity}x ${sale.item_name} sold for ${sale.guest_name || 'Walk-in'}.`,
          type: 'success',
          outlet_id: sale.outlet_id
        });
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
        const { data: saleData } = await supabase.from('sales').select('*').eq('id', id).single();
        
        await supabase.from('sales').delete().eq('id', id);
        await this.logAction('POS_VOID', `Voided sale ID: ${id}`);

        if (saleData) {
          // Get the name of the person who voided it if possible
          const { data: { user: authUser } } = await (supabase.auth as any).getUser();
          const voidedBy = authUser?.user_metadata?.full_name || authUser?.email || 'System';

          await this.addNotification({
            title: 'Sale Voided',
            message: `Sale for "${saleData.item_name}" has been voided by ${voidedBy}.`,
            type: 'error',
            outlet_id: saleData.outlet_id
          });
        }

        // If this sale was linked to a booking, restore the booking to 'confirmed'
        if (saleData?.booking_id) {
            await supabase.from('massage_bookings').update({ status: 'confirmed' }).eq('id', saleData.booking_id);
            await this.logAction('BOOKING_RESTORED', `Booking ${saleData.booking_id} restored after sale void.`);
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
      return this.safeCall(async () => {
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
      }, []);
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

  async getMassageTypes(scopeId?: string, isPropertyScope: boolean = false, limitToOutletIds?: string[]): Promise<MassageType[]> {
    if (this.isSupabase()) {
      let query = supabase.from('massage_types').select('*');
      if (scopeId && scopeId !== 'all') {
          if (isPropertyScope) {
              if (limitToOutletIds && limitToOutletIds.length > 0) {
                  query = query.in('outlet_id', limitToOutletIds);
              } else {
                  query = query.eq('property_id', scopeId);
              }
          }
          else query = query.eq('outlet_id', scopeId);
      }

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
      return this.safeCall(async () => {
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
      }, []);
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
      await this.safeCall(async () => {
        const { error } = await supabase.from('massage_bookings').insert([{ ...booking, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
        if (error) throw error;
        await this.logAction('CREATE_BOOKING', `Created booking on ${booking.date} at ${booking.start_time} (Therapist ID: ${booking.therapist_id})`, booking.outlet_id);
        
        // Add notification for the therapist
        await this.addNotification({
          title: 'New Booking Assigned',
          message: `You have a new booking on ${booking.date} at ${booking.start_time}.`,
          type: 'info',
          user_id: booking.therapist_id,
          outlet_id: booking.outlet_id
        });
      }, null);
    }
    
    // Trigger local event for real-time updates
    window.dispatchEvent(new CustomEvent('booking_updated', { detail: { outlet_id: booking.outlet_id } }));
  }

  async updateMassageBooking(id: string, updates: Partial<MassageBooking>) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error } = await supabase.from('massage_bookings').update(updates).eq('id', id);
        if (error) throw error;
      }, null);
    }
    
    // Trigger local event
    if (updates.outlet_id) {
      window.dispatchEvent(new CustomEvent('booking_updated', { detail: { outlet_id: updates.outlet_id } }));
    } else {
      // If outlet_id not in updates, we might need to fetch it or just trigger globally
      window.dispatchEvent(new CustomEvent('booking_updated', { detail: {} }));
    }
  }

  async updateMassageBookingStatus(id: string, status: MassageBooking['status'], roomId?: string, paymentMethod?: MassageBooking['payment_method']) {
    if (this.isSupabase()) {
      const { data: booking } = await supabase.from('massage_bookings').select('*').eq('id', id).single();
      if (!booking) return;

      const updates: any = { status };
      if (roomId) updates.room_id = roomId;
      if (paymentMethod) updates.payment_method = paymentMethod;

      const { error } = await supabase.from('massage_bookings').update(updates).eq('id', id);
      if (error) throw error;

      // Notification for status change
      if (status && status !== booking.status) {
          const { data: guest } = await supabase.from('guests').select('name').eq('id', booking.guest_id).single();
          await this.addNotification({
              title: `Booking ${status.charAt(0).toUpperCase() + status.slice(1)}`,
              message: `Booking for ${guest?.name || 'Guest'} on ${booking.date} has been marked as ${status}.`,
              type: status === 'cancelled' ? 'warning' : status === 'completed' ? 'success' : 'info',
              outlet_id: booking.outlet_id
          });
      }

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

        // Add notification for completed booking
        await this.addNotification({
          title: 'Booking Completed',
          message: `Booking for ${guest?.name || 'Guest'} has been marked as completed.`,
          type: 'success',
          user_id: booking.therapist_id,
          outlet_id: booking.outlet_id
        });
      }
    }
    // Trigger local event
    window.dispatchEvent(new CustomEvent('booking_updated', { detail: {} }));
  }

  subscribeToBookings(outletId: string, callback: (payload: { eventType: string, new: any, old?: any }) => void) {
    let supabaseUnsubscribe = () => {};

    if (this.isSupabase()) {
      const channel = supabase
        .channel(`public:massage_bookings:outlet_id=eq.${outletId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'massage_bookings',
            filter: `outlet_id=eq.${outletId}`
          },
          (payload) => {
            callback(payload);
          }
        )
        .subscribe();

      supabaseUnsubscribe = () => {
        supabase.removeChannel(channel);
      };
    }

    // Local mode listener
    const handleLocalUpdate = (event: any) => {
      const detail = event.detail;
      if (!detail.outlet_id || detail.outlet_id === outletId) {
        callback({ eventType: 'UPDATE', new: {} });
      }
    };
    window.addEventListener('booking_updated', handleLocalUpdate);

    return () => {
      supabaseUnsubscribe();
      window.removeEventListener('booking_updated', handleLocalUpdate);
    };
  }

  async deleteMassageBooking(id: string) {
    if (this.isSupabase()) {
      // Also delete any associated sales
      await supabase.from('sales').delete().eq('booking_id', id);
      const { error } = await supabase.from('massage_bookings').delete().eq('id', id);
      if (error) throw error;
      await this.logAction('DELETE_BOOKING', `Deleted booking ID: ${id}`);
    }
    
    // Trigger local event
    window.dispatchEvent(new CustomEvent('booking_updated', { detail: {} }));
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

  // --- REPORT RECIPIENTS ---
  async getReportRecipients() {
    if (this.isSupabase()) {
      const { data, error } = await supabase.from('report_recipients').select('*');
      if (error) throw error;
      return (data || []) as ReportRecipient[];
    }
    return JSON.parse(localStorage.getItem('membership_report_recipients') || '[]') as ReportRecipient[];
  }

  async addReportRecipient(recipient: Omit<ReportRecipient, 'id' | 'created_at'>) {
    const newRecipient = {
      ...recipient,
      id: this.generateUUID(),
      created_at: new Date().toISOString()
    };

    if (this.isSupabase()) {
      const { error } = await supabase.from('report_recipients').insert([newRecipient]);
      if (error) throw error;
    } else {
      const recipients = await this.getReportRecipients();
      recipients.push(newRecipient);
      localStorage.setItem('membership_report_recipients', JSON.stringify(recipients));
    }
    await this.logAction('ADD_RECIPIENT', `Report recipient added: ${recipient.email}`);
    return newRecipient;
  }

  async deleteReportRecipient(id: string) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('report_recipients').delete().eq('id', id);
      if (error) throw error;
    } else {
      const recipients = await this.getReportRecipients();
      const filtered = recipients.filter(r => r.id !== id);
      localStorage.setItem('membership_report_recipients', JSON.stringify(filtered));
    }
    await this.logAction('DELETE_RECIPIENT', `Report recipient removed: ${id}`);
  }

  async updateReportRecipient(id: string, updates: Partial<ReportRecipient>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('report_recipients').update(updates).eq('id', id);
      if (error) throw error;
    } else {
      const recipients = await this.getReportRecipients();
      const index = recipients.findIndex(r => r.id === id);
      if (index !== -1) {
        recipients[index] = { ...recipients[index], ...updates };
        localStorage.setItem('membership_report_recipients', JSON.stringify(recipients));
      }
    }
    await this.logAction('UPDATE_RECIPIENT', `Report recipient updated: ${id}`);
  }

  // --- CUSTOM REPORT CONFIGS ---
  async getCustomReports(propertyId?: string, outletId?: string) {
    if (this.isSupabase()) {
      let query = supabase.from('custom_reports').select('*');
      if (propertyId) query = query.eq('property_id', propertyId);
      if (outletId && outletId !== 'all') query = query.eq('outlet_id', outletId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CustomReportConfig[];
    }
    const reports = JSON.parse(localStorage.getItem('membership_custom_reports') || '[]') as CustomReportConfig[];
    let filtered = reports;
    if (propertyId) filtered = filtered.filter(r => r.property_id === propertyId);
    if (outletId && outletId !== 'all') filtered = filtered.filter(r => r.outlet_id === outletId);
    return filtered;
  }

  async addCustomReport(config: Omit<CustomReportConfig, 'id' | 'created_at'>) {
    const newReport = {
      ...config,
      id: this.generateUUID(),
      created_at: new Date().toISOString()
    };

    if (this.isSupabase()) {
      const { error } = await supabase.from('custom_reports').insert([newReport]);
      if (error) throw error;
    } else {
      const reports = await this.getCustomReports();
      reports.push(newReport);
      localStorage.setItem('membership_custom_reports', JSON.stringify(reports));
    }
    await this.logAction('ADD_CUSTOM_REPORT', `Custom report defined: ${config.name}`);
    return newReport;
  }

  async updateCustomReport(id: string, updates: Partial<CustomReportConfig>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('custom_reports').update(updates).eq('id', id);
      if (error) throw error;
    } else {
      const reports = await this.getCustomReports();
      const index = reports.findIndex(r => r.id === id);
      if (index !== -1) {
        reports[index] = { ...reports[index], ...updates };
        localStorage.setItem('membership_custom_reports', JSON.stringify(reports));
      }
    }
    await this.logAction('UPDATE_CUSTOM_REPORT', `Custom report modified: ${id}`);
  }

  async deleteCustomReport(id: string) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('custom_reports').delete().eq('id', id);
      if (error) throw error;
    } else {
      const reports = await this.getCustomReports();
      const filtered = reports.filter(r => r.id !== id);
      localStorage.setItem('membership_custom_reports', JSON.stringify(filtered));
    }
    await this.logAction('DELETE_CUSTOM_REPORT', `Custom report removed: ${id}`);
  }

  async sendTestReport(recipientId: string) {
    if (this.isSupabase()) {
      const { data, error } = await supabase.functions.invoke('send-reports', {
        body: { test: true, recipientId }
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || 'Failed to send report');
      if (data && data.results && data.results.some((r: any) => r.status === 'error')) {
        const errResult = data.results.find((r: any) => r.status === 'error');
        throw new Error(errResult.error || 'Failed to send email to recipient');
      }
      return data;
    } else {
      console.log('Mock: Sending test report to recipient', recipientId);
      return { success: true, results: [{ status: 'sent (mock)' }] };
    }
  }
  // --- NOTIFICATIONS ---
  async getNotifications(userId?: string, outletId?: string): Promise<Notification[]> {
    console.log('Fetching notifications for:', { userId, outletId });
    if (this.isSupabase()) {
      let query = supabase.from('notifications').select('*').order('created_at', { ascending: false });
      if (userId) {
        query = query.or(`user_id.eq.${userId},user_id.is.null`);
      } else {
        query = query.is('user_id', null);
      }
      
      const { data, error } = await query;
      if (error) {
        // PGRST205 is "Could not find the table in the schema cache"
        if (error.code !== 'PGRST205') {
          console.warn("Failed to fetch notifications from Supabase, falling back to local storage", error);
        }
        return this.getLocalNotifications(userId, outletId);
      }
      
      let notifications = (data || []) as Notification[];
      if (outletId) {
        notifications = notifications.filter(n => !n.outlet_id || n.outlet_id === outletId);
      }
      console.log(`Fetched ${notifications.length} notifications from Supabase`);
      return notifications;
    }
    return this.getLocalNotifications(userId, outletId);
  }

  private getLocalNotifications(userId?: string, outletId?: string): Notification[] {
    const all = JSON.parse(localStorage.getItem('membership_notifications') || '[]') as Notification[];
    let filtered = all;
    
    if (userId) {
      filtered = filtered.filter(n => !n.user_id || n.user_id === userId);
    } else {
      filtered = filtered.filter(n => !n.user_id);
    }
    
    if (outletId) {
      filtered = filtered.filter(n => !n.outlet_id || n.outlet_id === outletId);
    }

    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async addNotification(notification: Omit<Notification, 'id' | 'created_at' | 'read'>) {
    console.log('Adding notification:', notification.title, notification.outlet_id);
    const newNotification: Notification = {
      ...notification,
      id: this.generateUUID(),
      created_at: new Date().toISOString(),
      read: false,
      user_id: notification.user_id || null
    };

    if (this.isSupabase()) {
      try {
        const { error } = await supabase.from('notifications').insert([newNotification]);
        if (error) {
          // If error is missing column, try without outlet_id
          if (error.code === 'PGRST204') {
             const { outlet_id, ...notificationWithoutOutlet } = newNotification;
             const { error: retryError } = await supabase.from('notifications').insert([notificationWithoutOutlet]);
             if (!retryError) {
                console.log('Notification successfully saved to Supabase (without outlet_id)');
             } else {
                console.warn("Failed to insert notification to Supabase (even without outlet_id), saving locally", retryError);
                this.saveLocalNotification(newNotification);
             }
          } else if (error.code !== 'PGRST205') {
            console.warn("Failed to insert notification to Supabase, saving locally", error);
            this.saveLocalNotification(newNotification);
          } else {
            this.saveLocalNotification(newNotification);
          }
        } else {
          console.log('Notification successfully saved to Supabase');
        }
      } catch (e) {
        console.error('Error adding notification to Supabase:', e);
        this.saveLocalNotification(newNotification);
      }
    } else {
      this.saveLocalNotification(newNotification);
    }
    
    // Always broadcast locally for immediate feedback in the same browser/tabs
    this.broadcastNotificationLocally(newNotification);
    return newNotification;
  }

  private broadcastNotificationLocally(notification: Notification) {
    // Broadcast for local mode real-time updates across tabs
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel('notifications_channel');
      bc.postMessage(notification);
      bc.close();
    }
    // Dispatch custom event for same-tab updates
    window.dispatchEvent(new CustomEvent('notification_received', { detail: notification }));
  }

  private saveLocalNotification(notification: Notification) {
    const notifications = JSON.parse(localStorage.getItem('membership_notifications') || '[]');
    notifications.push(notification);
    localStorage.setItem('membership_notifications', JSON.stringify(notifications));
  }

  async markNotificationAsRead(id: string) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
      if (error && error.code !== 'PGRST205') {
        console.warn("Failed to update notification in Supabase", error);
      }
    }
    this.updateLocalNotification(id, { read: true });
  }

  async markAllNotificationsAsRead(userId?: string, outletId?: string) {
    if (this.isSupabase()) {
      // 1. Fetch IDs of unread notifications that match the filter
      let fetchQuery = supabase.from('notifications').select('id').eq('read', false);
      if (userId) fetchQuery = fetchQuery.or(`user_id.eq.${userId},user_id.is.null`);
      else fetchQuery = fetchQuery.is('user_id', null);
      
      if (outletId) fetchQuery = fetchQuery.or(`outlet_id.eq.${outletId},outlet_id.is.null`);
      else fetchQuery = fetchQuery.is('outlet_id', null);

      const { data: unreadDocs } = await fetchQuery;
      
      if (unreadDocs && unreadDocs.length > 0) {
        const ids = unreadDocs.map(d => d.id);
        // 2. Update them by ID
        const { error } = await supabase.from('notifications').update({ read: true }).in('id', ids);
        if (error) console.warn("Failed to update notifications in Supabase", error);
      }
    }
    this.markAllLocalNotificationsAsRead(userId, outletId);
  }

  private updateLocalNotification(id: string, updates: Partial<Notification>) {
    const notifications = JSON.parse(localStorage.getItem('membership_notifications') || '[]') as Notification[];
    const index = notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      notifications[index] = { ...notifications[index], ...updates };
      localStorage.setItem('membership_notifications', JSON.stringify(notifications));
    }
  }

  private markAllLocalNotificationsAsRead(userId?: string, outletId?: string) {
    const notifications = JSON.parse(localStorage.getItem('membership_notifications') || '[]') as Notification[];
    const updated = notifications.map(n => {
      const userMatch = !userId || !n.user_id || n.user_id === userId;
      const outletMatch = !outletId || !n.outlet_id || n.outlet_id === outletId;
      if (!n.read && userMatch && outletMatch) {
        return { ...n, read: true };
      }
      return n;
    });
    localStorage.setItem('membership_notifications', JSON.stringify(updated));
  }

  async deleteNotification(id: string) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error && error.code !== 'PGRST205') {
        console.warn("Failed to delete notification from Supabase", error);
      }
    }
    this.deleteLocalNotification(id);
  }

  async deleteAllNotifications(userId?: string, outletId?: string) {
    if (this.isSupabase()) {
      // 1. Fetch IDs of notifications that match the filter
      let fetchQuery = supabase.from('notifications').select('id');
      if (userId) fetchQuery = fetchQuery.or(`user_id.eq.${userId},user_id.is.null`);
      else fetchQuery = fetchQuery.is('user_id', null);
      
      if (outletId) fetchQuery = fetchQuery.or(`outlet_id.eq.${outletId},outlet_id.is.null`);
      else fetchQuery = fetchQuery.is('outlet_id', null);

      const { data: docs } = await fetchQuery;
      
      if (docs && docs.length > 0) {
        const ids = docs.map(d => d.id);
        // 2. Delete them by ID
        const { error } = await supabase.from('notifications').delete().in('id', ids);
        if (error) console.warn("Failed to delete all notifications from Supabase", error);
      }
    }
    this.deleteAllLocalNotifications(userId, outletId);
  }

  subscribeToNotifications(userId: string, outletId: string | undefined, callback: (payload: { eventType: string, new: any, old?: any }) => void) {
    // Local mode listeners (always active to catch local fallbacks or local mode)
    let bc: BroadcastChannel | null = null;
    const handleCustomEvent = (event: any) => {
      const notification = event.detail as Notification;
      const userMatch = !notification.user_id || notification.user_id === userId;
      const outletMatch = !outletId || !notification.outlet_id || notification.outlet_id === outletId;
      
      if (userMatch && outletMatch) {
        callback({ eventType: 'INSERT', new: notification });
      }
    };

    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('notifications_channel');
      bc.onmessage = (event) => {
        const notification = event.data as Notification;
        const userMatch = !notification.user_id || notification.user_id === userId;
        const outletMatch = !outletId || !notification.outlet_id || notification.outlet_id === outletId;
        
        if (userMatch && outletMatch) {
          callback({ eventType: 'INSERT', new: notification });
        }
      };
    }
    window.addEventListener('notification_received', handleCustomEvent);

    if (this.isSupabase()) {
      const channel = supabase
        .channel('notifications-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications'
          },
          (payload) => {
            const newNotification = payload.new as Notification;
            const oldNotification = payload.old as Notification;
            
            // Check if it's for this user or global
            const targetNotification = newNotification || oldNotification;
            if (targetNotification) {
              const userMatch = !targetNotification.user_id || targetNotification.user_id === userId;
              const outletMatch = !outletId || !targetNotification.outlet_id || targetNotification.outlet_id === outletId;
              
              if (userMatch && outletMatch) {
                callback({
                  eventType: payload.eventType,
                  new: payload.new,
                  old: payload.old
                });
              }
            }
          }
        )
        .subscribe();
      
      return () => {
        supabase.removeChannel(channel);
        if (bc) bc.close();
        window.removeEventListener('notification_received', handleCustomEvent);
      };
    } else {
      return () => {
        if (bc) bc.close();
        window.removeEventListener('notification_received', handleCustomEvent);
      };
    }
  }

  private deleteLocalNotification(id: string) {
    const notifications = JSON.parse(localStorage.getItem('membership_notifications') || '[]') as Notification[];
    const filtered = notifications.filter(n => n.id !== id);
    localStorage.setItem('membership_notifications', JSON.stringify(filtered));
  }

  private deleteAllLocalNotifications(userId?: string, outletId?: string) {
    const notifications = JSON.parse(localStorage.getItem('membership_notifications') || '[]') as Notification[];
    const filtered = notifications.filter(n => {
      const userMatch = !userId || !n.user_id || n.user_id === userId;
      const outletMatch = !outletId || !n.outlet_id || n.outlet_id === outletId;
      return !(userMatch && outletMatch);
    });
    localStorage.setItem('membership_notifications', JSON.stringify(filtered));
  }
}

export const db = new DatabaseService();