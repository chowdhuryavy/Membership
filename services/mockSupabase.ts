import { UserProfile, Role, Currency, CompanySettings, Member, MembershipCategory, Freeze, MemberStatus, Outlet, Property, SystemLog, Permission, Guest, Therapist, MassageType, MassageBooking, Sale, InventoryItem, IncentiveRule, Staff, UserPermissionOverride, PermissionGroup } from '../types';
import { supabase, supabaseUrl, supabaseAnonKey } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { addDays, format } from 'date-fns';

const parseISO = (dateString: string) => new Date(dateString);
const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

class DatabaseService {
  private isSupabase() {
    return !!supabase;
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
  // The Single Source of Truth for the System's Access Control Matrix
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
          { key: 'members:renew', label: 'Process Renewals', description: 'Ability to trigger re-enrollment logic.' },
          { key: 'members:print_contract', label: 'Legal Documentation', description: 'Generate and print membership agreements.' },
        ]
      },
      {
        id: 'staff',
        label: 'Staff Roster & Operations',
        permissions: [
          { key: 'staff:view', label: 'View Personnel', description: 'Access the facility staff list and profiles.' },
          { key: 'staff:manage', label: 'Control Registry', description: 'Add, edit, or archive staff members and manage leave.' },
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
          { key: 'inventory:view', label: 'Catalog Visibility', description: 'Access the item master and stock levels.' },
          { key: 'inventory:manage', label: 'Inventory Control', description: 'Define new assets and adjust quantities.' },
        ]
      },
      {
        id: 'reports',
        label: 'Financial Reporting',
        permissions: [
          { key: 'reports:view', label: 'Generate Reports', description: 'Access high-level financial audit tools.' },
          { key: 'reports:export', label: 'Data Portability', description: 'Export ledger data to PDF or Excel formats.' },
        ]
      },
      {
        id: 'security',
        label: 'Security & Governance',
        permissions: [
          { key: 'users:view', label: 'Directory Access', description: 'View system users and their roles.' },
          { key: 'users:create', label: 'Provision Users', description: 'Create new user accounts and auth identities.' },
          { key: 'users:edit', label: 'Modify Clearances', description: 'Change roles and outlet access scopes.' },
          { key: 'users:edit_email', label: 'Email Control', description: 'Permission to change user account emails.' },
          { key: 'users:delete', label: 'Revoke Identity', description: 'Terminate user access permanently.' },
          { key: 'users:manage_overrides', label: 'Policy Overrides', description: 'Manage granular user-specific permission deviations.' },
          { key: 'logs:view', label: 'Audit Log Access', description: 'Access the system mutation and activity logs.' },
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
    if (!this.isSupabase()) return;

    try {
        const [{ data: m, error: mErr }, { data: freezes, error: fErr }] = await Promise.all([
          supabase.from('members').select('id, original_end_date, status').eq('id', memberId).single(),
          supabase.from('freezes').select('total_days').eq('member_id', memberId)
        ]);

        if (mErr || !m) return;

        if (m.status === MemberStatus.TENTATIVE) return;

        const totalDeferred = (freezes || []).reduce((sum, f) => sum + (Number(f.total_days) || 0), 0);
        const baselineDate = startOfDay(parseISO(m.original_end_date));
        const calculatedEndDate = addDays(baselineDate, totalDeferred);
        const newEndDateStr = format(calculatedEndDate, 'yyyy-MM-dd');
        const newStatus = totalDeferred > 0 ? MemberStatus.FROZEN : MemberStatus.ACTIVE;

        await supabase
            .from('members')
            .update({ status: newStatus, current_end_date: newEndDateStr })
            .eq('id', memberId);

        return newEndDateStr;
    } catch (err) {
        console.error("Critical Revenue Recalculation Failure:", err);
    }
  }

  async logAction(action: string, details: string, outlet_id?: string) {
    const sessionStr = sessionStorage.getItem('membership_session');
    const session = sessionStr ? JSON.parse(sessionStr) : null;
    const logEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        user_id: session?.id || 'system',
        user_name: session?.name || 'System Engine',
        action: (action || '').toUpperCase(),
        details,
        outlet_id: outlet_id || null
    };
    if (this.isSupabase()) {
        try { 
          await supabase.from('system_logs').insert([logEntry]); 
        } catch (e) {
          console.error("Log Error:", e);
        }
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

  async login(email: string, passwordAttempt: string): Promise<{ user: UserProfile | null, error: string | null, requiresPasswordChange: boolean }> {
    if (!this.isSupabase()) return { user: null, error: "Cloud sync offline.", requiresPasswordChange: false };
    const cleanEmail = email.trim().toLowerCase();
    const { data: profile } = await supabase.from('profiles').select('*').eq('email', cleanEmail).maybeSingle();

    const { data: authData, error: authError } = await (supabase.auth as any).signInWithPassword({
        email: cleanEmail,
        password: passwordAttempt
    });

    if (authError || (profile && !profile.auth_id)) {
        if (profile && profile.temp_password === passwordAttempt) {
            const { data: signUpData, error: signUpError } = await (supabase.auth as any).signUp({
                email: cleanEmail,
                password: passwordAttempt,
                options: { data: { full_name: profile.name, display_name: profile.name, name: profile.name } }
            });

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
        if (!profile.auth_id || profile.auth_id !== authData.user.id) {
          await supabase.from('profiles').update({ auth_id: authData.user.id }).eq('id', profile.id);
        }
        await this.syncAuthMetadata(profile);
        
        // HYDRATE OVERRIDES
        const overrides = await this.getPermissionOverrides(profile.id);
        const hydrated = { ...profile, overrides };

        await this.logAction('AUTH_LOGIN', `Access authorized for ${profile.email}`);
        return { user: hydrated, error: null, requiresPasswordChange: !!profile.temp_password };
    }

    return { user: null, error: "Identity profile not found.", requiresPasswordChange: false };
  }

  async addUser(user: Omit<UserProfile, 'id'> & { password?: string }): Promise<UserProfile> {
    const cleanEmail = user.email.trim().toLowerCase();
    let authId: string | null = null;
    let tempPassword: string | null = user.password || 'Temporary123!';
    
    if (this.isSupabase()) {
        const shadow = this.getShadowClient();
        const { data: authData } = await (shadow.auth as any).signUp({
            email: cleanEmail,
            password: tempPassword,
            options: { data: { full_name: user.name, name: user.name, display_name: user.name } }
        });

        if (authData?.user) authId = authData.user.id;

        const { data, error } = await supabase
            .from('profiles')
            .upsert([{
                email: cleanEmail,
                name: user.name,
                role_id: user.role_id,
                allowed_outlets: user.allowed_outlets || [],
                temp_password: tempPassword,
                auth_id: authId,
                updated_at: new Date().toISOString()
            }], { onConflict: 'email' })
            .select()
            .single();

        if (error) throw error;
        await this.logAction('CREATE_USER', `Identity provisioned: ${user.name} (${user.email})`);
        return data as UserProfile;
    }
    return { ...user, id: crypto.randomUUID() } as UserProfile;
  }

  async updateUser(id: string, updates: Partial<UserProfile> & { password?: string }) { 
    if (this.isSupabase()) {
        const { data: current } = await supabase.from('profiles').select('email, auth_id, name').eq('id', id).single();
        const finalUpdates: any = { 
            name: updates.name,
            email: updates.email?.trim().toLowerCase(),
            role_id: updates.role_id,
            allowed_outlets: updates.allowed_outlets,
            updated_at: new Date().toISOString()
        };
        if (!current.auth_id && updates.password) finalUpdates.temp_password = updates.password;
        Object.keys(finalUpdates).forEach(k => finalUpdates[k] === undefined && delete finalUpdates[k]);
        await supabase.from('profiles').update(finalUpdates).eq('id', id);
        await this.logAction('UPDATE_USER', `Identity modified for ${current.name} (${current.email})`);
    }
  }

  async updateEmail(newEmail: string) {
      if (this.isSupabase()) {
          await (supabase.auth as any).updateUser({ email: newEmail });
      }
  }

  async changePassword(userId: string, currentPass: string, newPass: string) {
    if (this.isSupabase()) {
        await (supabase.auth as any).updateUser({ password: newPass });
        await supabase.from('profiles').update({ temp_password: null }).eq('id', userId);
        await this.logAction('CHANGE_PASSWORD', `Credentials updated for user ID: ${userId}`);
    }
  }

  async signUp(email: string, passwordAttempt: string, name: string): Promise<{ user: UserProfile | null, error: string | null }> {
    const { data: authData, error: authError } = await (supabase.auth as any).signUp({ 
        email, password: passwordAttempt, options: { data: { name, full_name: name, display_name: name } } 
    });
    if (authError) return { user: null, error: authError.message };
    if (authData.user) {
      const newUser = { id: crypto.randomUUID(), auth_id: authData.user.id, email, name, role_id: 'member', allowed_outlets: [] };
      await supabase.from('profiles').insert([newUser]);
      return { user: newUser as UserProfile, error: null };
    }
    return { user: null, error: 'Registration failed' };
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

  // --- STAFF METHODS ---
  async getStaff(outletId?: string): Promise<Staff[]> {
    if (this.isSupabase()) {
      let query = supabase.from('staff').select('*').order('name');
      if (outletId) query = query.eq('outlet_id', outletId);
      const { data, error } = await query;
      if (error) {
        throw error;
      }
      return (data || []) as Staff[];
    }
    return [];
  }

  async addStaff(staff: Omit<Staff, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      const { data, error } = await supabase.from('staff').insert([{
        ...staff,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString()
      }]).select();
      
      if (error) throw error;
      await this.logAction('CREATE_STAFF', `Staff member enrolled: ${staff.name}`, staff.outlet_id);
      return data;
    }
  }

  async updateStaff(id: string, updates: Partial<Staff>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('staff').update(updates).eq('id', id);
      if (error) throw error;
      await this.logAction('UPDATE_STAFF', `Staff profile adjusted: ${id}`);
    }
  }

  async deleteStaff(id: string) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('staff').delete().eq('id', id);
      if (error) throw error;
      await this.logAction('DELETE_STAFF', `Staff record purged: ${id}`);
    }
  }

  async getMembers(outletId?: string): Promise<Member[]> {
    if (this.isSupabase()) {
      let query = supabase.from('members').select('*');
      if (outletId) query = query.eq('outlet_id', outletId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Member[];
    }
    return [];
  }

  async getMemberHistory(membershipNumber: string): Promise<Member[]> {
    if (this.isSupabase()) {
        const { data } = await supabase
            .from('members')
            .select('*')
            .eq('membership_number', membershipNumber)
            .order('start_date', { ascending: false });
        return (data || []) as Member[];
    }
    return [];
  }

  async addMember(member: Member) {
    if (this.isSupabase()) {
      await supabase.from('members').insert([member]);
      const statusText = member.status === MemberStatus.TENTATIVE ? 'Tentative Booking' : 'Confirmed Enrollment';
      await this.logAction('CREATE_MEMBER', `${statusText}: ${member.guest_name} (${member.membership_number})`, member.outlet_id);
    }
  }

  async updateMember(id: string, member: Partial<Member>) {
    if (this.isSupabase()) {
      await supabase.from('members').update(member).eq('id', id);
      const statusUpdate = member.status ? ` (Status: ${member.status})` : '';
      await this.logAction('UPDATE_MEMBER', `Profile update${statusUpdate}: ${member.guest_name || id}`, member.outlet_id);
    }
  }

  async deleteMember(id: string) {
    if (this.isSupabase()) {
      await supabase.from('members').delete().eq('id', id);
      await this.logAction('DELETE_MEMBER', `Record purged: ${id}`);
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
      await supabase.from('freezes').insert([freeze]);
      await this.syncMemberEndDate(freeze.member_id);
      await this.logAction('CREATE_FREEZE', `Account suspension applied for member ID: ${freeze.member_id}`);
    }
  }

  async updateFreeze(id: string, updates: Partial<Freeze>) {
    if (this.isSupabase()) {
      const { data: f } = await supabase.from('freezes').select('member_id').eq('id', id).single();
      await supabase.from('freezes').update(updates).eq('id', id);
      if (f) await this.syncMemberEndDate(f.member_id);
      await this.logAction('UPDATE_FREEZE', `Suspension record adjusted: ${id}`);
    }
  }

  async deleteFreeze(id: string) {
    if (this.isSupabase()) {
      const { data: f } = await supabase.from('freezes').select('member_id').eq('id', id).single();
      await supabase.from('freezes').delete().eq('id', id);
      if (f) await this.syncMemberEndDate(f.member_id);
      await this.logAction('DELETE_FREEZE', `Suspension record revoked: ${id}`);
    }
  }

  async getCategories(outletId?: string): Promise<MembershipCategory[]> {
    if (this.isSupabase()) {
      let query = supabase.from('membership_categories').select('*');
      if (outletId) query = query.eq('outlet_id', outletId);
      const { data } = await query;
      return (data || []) as MembershipCategory[];
    }
    return [];
  }

  async addCategory(cat: Omit<MembershipCategory, 'id'>) {
    if (this.isSupabase()) {
      const newCat = { ...cat, id: `cat_${crypto.randomUUID()}` };
      await supabase.from('membership_categories').insert([newCat]);
      await this.logAction('CREATE_CATEGORY', `New tier created: ${cat.name}`, cat.outlet_id);
    }
  }

  async updateCategory(id: string, updates: Partial<MembershipCategory>) {
    if (this.isSupabase()) {
      await supabase.from('membership_categories').update(updates).eq('id', id);
      await this.logAction('UPDATE_CATEGORY', `Tier modified: ${id}`);
    }
  }

  async deleteCategory(id: string) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('membership_categories').delete().eq('id', id);
      if (error) throw error;
      await this.logAction('DELETE_CATEGORY', `Tier decommissioned: ${id}`);
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
      await supabase.from('company_settings').update(settings).eq('id', 'global');
      await this.logAction('UPDATE_SETTINGS', 'Global system configuration mutated.');
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
      await supabase.from('currencies').insert([{ ...curr, id: crypto.randomUUID() }]);
      await this.logAction('CREATE_CURRENCY', `Monetary standard added: ${curr.code}`);
    }
  }

  async updateCurrency(id: string, updates: Partial<Currency>) {
    if (this.isSupabase()) {
      await supabase.from('currencies').update(updates).eq('id', id);
      await this.logAction('UPDATE_CURRENCY', `Monetary standard modified: ${id}`);
    }
  }

  async deleteCurrency(id: string) {
    if (this.isSupabase()) {
      const { data: c } = await supabase.from('currencies').select('is_default').eq('id', id).single();
      if (c?.is_default) throw new Error("Cannot delete the system base currency.");
      await supabase.from('currencies').delete().eq('id', id);
      await this.logAction('DELETE_CURRENCY', `Monetary standard purged: ${id}`);
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
      await supabase.from('roles').insert([{ ...role, id: role.name.toLowerCase().replace(/\s+/g, '_') }]);
      await this.logAction('CREATE_ROLE', `Security protocol tier created: ${role.name}`);
    }
  }

  async updateRole(id: string, updates: Partial<Role>) {
    if (this.isSupabase()) {
      await supabase.from('roles').update(updates).eq('id', id);
      await this.logAction('UPDATE_ROLE', `Security protocol adjusted: ${id}`);
    }
  }

  async deleteRole(id: string) {
    if (this.isSupabase()) {
      const { data: r } = await supabase.from('roles').select('is_system').eq('id', id).single();
      if (r?.is_system) throw new Error("Cannot delete a protected system role.");
      await supabase.from('roles').delete().eq('id', id);
      await this.logAction('DELETE_ROLE', `Security protocol purged: ${id}`);
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
      await supabase.from('outlets').insert([{ ...outlet, id: crypto.randomUUID() }]);
      await this.logAction('CREATE_OUTLET', `Facility context commissioned: ${outlet.name}`);
    }
  }

  async updateOutlet(id: string, updates: Partial<Outlet>) {
    if (this.isSupabase()) {
      await supabase.from('outlets').update(updates).eq('id', id);
      await this.logAction('UPDATE_OUTLET', `Facility context modified: ${id}`);
    }
  }

  async deleteOutlet(id: string) {
    if (this.isSupabase()) {
      await supabase.from('outlets').delete().eq('id', id);
      await this.logAction('DELETE_OUTLET', `Facility context decommissioned: ${id}`);
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
      await supabase.from('properties').insert([{ ...prop, id: crypto.randomUUID() }]);
      await this.logAction('CREATE_PROPERTY', `Property asset registered: ${prop.name}`);
    }
  }

  async updateProperty(id: string, updates: Partial<Property>) {
    if (this.isSupabase()) {
      await supabase.from('properties').update(updates).eq('id', id);
      await this.logAction('UPDATE_PROPERTY', `Property asset modified: ${id}`);
    }
  }

  async deleteProperty(id: string) {
    if (this.isSupabase()) {
      await supabase.from('properties').delete().eq('id', id);
      await this.logAction('DELETE_PROPERTY', `Property asset purged: ${id}`);
    }
  }

  async getLogs(outlet_id?: string): Promise<SystemLog[]> {
    if (this.isSupabase()) {
      let query = supabase.from('system_logs').select('*').order('timestamp', { ascending: false });
      if (outlet_id) query = query.eq('outlet_id', outlet_id);
      const { data } = await query;
      return (data || []) as SystemLog[];
    }
    return [];
  }

  // --- INVENTORY METHODS ---
  async getInventory(propertyId: string): Promise<InventoryItem[]> {
    if (this.isSupabase()) {
        const { data, error } = await supabase.from('inventory').select('*').eq('property_id', propertyId).order('name');
        if (error) throw error;
        return (data || []) as InventoryItem[];
    }
    return [];
  }

  async addInventoryItem(item: Omit<InventoryItem, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('inventory').insert([{ ...item, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
        if (error) throw error;
        await this.logAction('CREATE_INVENTORY', `Defined item: ${item.name}`);
    }
  }

  async updateInventoryItem(id: string, updates: Partial<InventoryItem>) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('inventory').update(updates).eq('id', id);
        if (error) throw error;
        await this.logAction('UPDATE_INVENTORY', `Modified item: ${id}`);
    }
  }

  async deleteInventoryItem(id: string) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('inventory').delete().eq('id', id);
        if (error) throw error;
        await this.logAction('DELETE_INVENTORY', `Removed item: ${id}`);
    }
  }

  // --- POS / SALES MODULE METHODS ---

  async getSales(propertyId: string): Promise<Sale[]> {
    if (this.isSupabase()) {
        const { data, error } = await supabase
            .from('sales')
            .select('*')
            .eq('property_id', propertyId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as Sale[];
    }
    return [];
  }

  async addSale(sale: Omit<Sale, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
        if (sale.item_id) {
            const { data: item } = await supabase.from('inventory').select('track_inventory, stock_quantity').eq('id', sale.item_id).single();
            if (item && item.track_inventory) {
                if (item.stock_quantity < sale.quantity) {
                    throw new Error(`Insufficient stock for ${sale.item_name}. Available: ${item.stock_quantity}`);
                }
                await supabase.from('inventory').update({ stock_quantity: item.stock_quantity - sale.quantity }).eq('id', sale.item_id);
            }
        }

        const { error } = await supabase.from('sales').insert([{ ...sale, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
        if (error) throw error;
        await this.logAction('POS_SALE', `Transaction finalized: ${sale.item_name} for ${sale.guest_name}`);
    }
  }

  async updateSale(id: string, updates: Partial<Sale>) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('sales').update(updates).eq('id', id);
        if (error) throw error;
        await this.logAction('UPDATE_SALE', `Transaction updated: ${id}`);
    }
  }

  async deleteSale(id: string) {
    if (this.isSupabase()) {
        const { data: sale } = await supabase.from('sales').select('*').eq('id', id).single();
        if (sale && sale.item_id) {
            const { data: item } = await supabase.from('inventory').select('track_inventory, stock_quantity').eq('id', sale.item_id).single();
            if (item && item.track_inventory) {
                await supabase.from('inventory').update({ stock_quantity: item.stock_quantity + sale.quantity }).eq('id', sale.item_id);
            }
        }

        const { error } = await supabase.from('sales').delete().eq('id', id);
        if (error) throw error;
        await this.logAction('POS_VOID', `Transaction voided: ${id}`);
    }
  }

  // --- MASSAGE SCHEDULING MODULE METHODS (PROPERTY-BASED) ---

  async getGuests(propertyId: string): Promise<Guest[]> {
    if (this.isSupabase()) {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .eq('property_id', propertyId)
        .order('name');
      if (error) throw error;
      return (data || []) as Guest[];
    }
    return [];
  }

  async saveGuest(guest: Omit<Guest, 'id' | 'created_at'>): Promise<Guest> {
    if (this.isSupabase()) {
      let existing: Guest | null = null;
      const { data: dataByPhone } = await supabase
        .from('guests')
        .select('*')
        .eq('phone', guest.phone)
        .eq('property_id', guest.property_id)
        .maybeSingle();
      
      if (dataByPhone) existing = dataByPhone as Guest;

      if (!existing && guest.email) {
        const { data: dataByEmail } = await supabase
          .from('guests')
          .select('*')
          .eq('email', guest.email)
          .eq('property_id', guest.property_id)
          .maybeSingle();
        if (dataByEmail) existing = dataByEmail as Guest;
      }

      if (existing) {
        const { data, error } = await supabase
          .from('guests')
          .update({ name: guest.name, email: guest.email })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        await this.logAction('SYNC_GUEST', `Guest identity synchronized: ${guest.name}`);
        return data as Guest;
      } else {
        const { data, error } = await supabase
          .from('guests')
          .insert([{ ...guest, id: crypto.randomUUID(), created_at: new Date().toISOString() }])
          .select()
          .single();
        if (error) throw error;
        await this.logAction('CREATE_GUEST', `New guest record provisioned: ${guest.name}`);
        return data as Guest;
      }
    }
    return { ...guest, id: crypto.randomUUID(), created_at: new Date().toISOString() } as Guest;
  }

  async updateGuest(id: string, updates: Partial<Guest>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('guests').update(updates).eq('id', id);
      if (error) throw error;
      await this.logAction('UPDATE_GUEST', `Guest profile modified: ${id}`);
    }
  }

  async deleteGuest(id: string) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('guests').delete().eq('id', id);
      if (error) throw error;
      await this.logAction('DELETE_GUEST', `Guest record purged: ${id}`);
    }
  }

  async getTherapists(propertyId: string): Promise<Therapist[]> {
    if (this.isSupabase()) {
      const { data, error } = await supabase.from('therapists').select('*').eq('property_id', propertyId);
      if (error) throw error;
      return (data || []) as Therapist[];
    }
    return [];
  }

  async addTherapist(therapist: Omit<Therapist, 'id'>) {
    if (this.isSupabase()) {
        const { data: propExists } = await supabase.from('properties').select('id, name').eq('id', therapist.property_id).maybeSingle();
        
        if (!propExists) {
            throw new Error(`Data Integrity Error: The target property (${therapist.property_id}) is not registered in the system.`);
        }

        const { error } = await supabase.from('therapists').insert([{ ...therapist, id: crypto.randomUUID() }]);
        if (error) throw error;
        await this.logAction('CREATE_THERAPIST', `Staff specialist onboarded to ${propExists.name}: ${therapist.name}`);
    }
  }

  async updateTherapist(id: string, updates: Partial<Therapist>) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('therapists').update(updates).eq('id', id);
        if (error) throw error;
    }
  }

  async deleteTherapist(id: string) {
    if (this.isSupabase()) {
        const { error = null } = await supabase.from('therapists').delete().eq('id', id);
        if (error) throw error;
        await this.logAction('DELETE_THERAPIST', `Staff specialist decommissioned: ${id}`);
    }
  }

  async getMassageTypes(propertyId?: string): Promise<MassageType[]> {
    if (this.isSupabase()) {
      let query = supabase.from('massage_types').select('*');
      if (propertyId) query = query.eq('property_id', propertyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MassageType[];
    }
    return [];
  }

  async addMassageType(type: Omit<MassageType, 'id'>) {
    if (this.isSupabase()) {
        const { data: propExists } = await supabase.from('properties').select('id, name').eq('id', type.property_id).maybeSingle();
        
        if (!propExists) {
            throw new Error(`Data Integrity Error: The target property (${type.property_id}) is not registered in the system.`);
        }

        const { error } = await supabase.from('massage_types').insert([{ ...type, id: crypto.randomUUID() }]);
        if (error) throw error;
        await this.logAction('CREATE_TREATMENT', `New treatment authorized for ${propExists.name}: ${type.name}`);
    }
  }

  async updateMassageType(id: string, updates: Partial<MassageType>) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('massage_types').update(updates).eq('id', id);
        if (error) throw error;
    }
  }

  async deleteMassageType(id: string) {
    if (this.isSupabase()) {
        const { error = null } = await supabase.from('massage_types').delete().eq('id', id);
        if (error) throw error;
        await this.logAction('DELETE_TREATMENT', `Treatment service decommissioned: ${id}`);
    }
  }

  async getMassageBookings(propertyId: string): Promise<MassageBooking[]> {
    if (this.isSupabase()) {
      const { data, error } = await supabase.from('massage_bookings').select('*').eq('property_id', propertyId).order('date', { ascending: false });
      if (error) throw error;
      return (data || []) as MassageBooking[];
    }
    return [];
  }

  async addMassageBooking(booking: Omit<MassageBooking, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('massage_bookings').insert([{ ...booking, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
      if (error) throw error;
      await this.logAction('CREATE_BOOKING', `Service reservation finalized for Guest ID: ${booking.guest_id}`);
    }
  }

  async updateMassageBooking(id: string, updates: Partial<MassageBooking>) {
    if (this.isSupabase()) {
      const { error = null } = await supabase.from('massage_bookings').update(updates).eq('id', id);
      if (error) throw error;
      await this.logAction('UPDATE_BOOKING', `Reservation parameters adjusted: ${id}`);
    }
  }

  async updateMassageBookingStatus(id: string, status: MassageBooking['status']) {
    if (this.isSupabase()) {
      const { error = null } = await supabase.from('massage_bookings').update({ status }).eq('id', id);
      if (error) throw error;
      await this.logAction('UPDATE_BOOKING_STATUS', `Reservation lifecycle updated to ${(status || '').toUpperCase()} for ID: ${id}`);
    }
  }

  // --- INCENTIVE SYSTEM METHODS ---
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
        
        return (data || []).map(rule => ({
            ...rule,
            distribution_type: rule.distribution_type || 'Individual'
        })) as IncentiveRule[];
      } catch (e) {
          console.warn("Incentive rules query failed:", e);
          return [];
      }
    }
    return [];
  }

  async addIncentiveRule(rule: Omit<IncentiveRule, 'id'>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('incentive_rules').insert([{ ...rule, id: crypto.randomUUID() }]);
      if (error) throw error;
      await this.logAction('CREATE_INCENTIVE', `Incentive rule defined: ${rule.name}`);
    }
  }

  async updateIncentiveRule(id: string, updates: Partial<IncentiveRule>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('incentive_rules').update(updates).eq('id', id);
      if (error) throw error;
      await this.logAction('UPDATE_INCENTIVE', `Incentive rule updated: ${id}`);
    }
  }

  async deleteIncentiveRule(id: string) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('incentive_rules').delete().eq('id', id);
      if (error) throw error;
      await this.logAction('DELETE_INCENTIVE', `Incentive rule revoked: ${id}`);
    }
  }
}

export const db = new DatabaseService();