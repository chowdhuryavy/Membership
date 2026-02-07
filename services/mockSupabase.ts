
import { UserProfile, Role, Currency, CompanySettings, Member, MembershipCategory, Freeze, MemberStatus, Outlet, Property, SystemLog, Permission } from '../types';
import { supabase, supabaseUrl, supabaseAnonKey } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { addDays, format, parseISO } from 'date-fns';

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

  // Internal helper to ensure member end dates are always synced with the freeze ledger
  private async syncMemberEndDate(memberId: string) {
    if (!this.isSupabase()) return;

    // 1. Fetch current member record and all their freezes
    const [{ data: m }, { data: freezes }] = await Promise.all([
      supabase.from('members').select('*').eq('id', memberId).single(),
      supabase.from('freezes').select('total_days').eq('member_id', memberId)
    ]);

    if (!m) return;

    // 2. Calculate total deferred days
    const totalDeferred = (freezes || []).reduce((sum, f) => sum + f.total_days, 0);

    // 3. Derived current_end_date = original_end_date + totalDeferred
    // This ensures we always calculate from the baseline to prevent drift
    const newEndDate = format(addDays(parseISO(m.original_end_date), totalDeferred), 'yyyy-MM-dd');
    
    // 4. Update member status and end date
    const status = totalDeferred > 0 ? MemberStatus.FROZEN : MemberStatus.ACTIVE;
    await supabase.from('members').update({ 
      status, 
      current_end_date: newEndDate 
    }).eq('id', memberId);

    return newEndDate;
  }

  async logAction(action: string, details: string, outlet_id?: string) {
    const sessionStr = sessionStorage.getItem('membership_session');
    const session = sessionStr ? JSON.parse(sessionStr) : null;
    const logEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        user_id: session?.id || 'system',
        user_name: session?.name || 'System Engine',
        action: action.toUpperCase(),
        details,
        outlet_id: outlet_id || null
    };
    if (this.isSupabase()) {
        try { 
          const { error } = await supabase.from('system_logs').insert([logEntry]); 
          if (error) console.error("Log Injection Failed:", error);
        } catch (e) {
          console.error("Critical Log Error:", e);
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

            if (signUpError) {
              const msg = signUpError.message.toLowerCase();
              if (msg.includes('confirm') || msg.includes('email') || signUpError.status === 500) {
                return { 
                  user: null, 
                  error: "SECURITY ERROR: Email Confirmations are blocking login. Please disable 'Email Confirmations' in Supabase Auth Settings.",
                  requiresPasswordChange: false
                };
              }
              return { user: null, error: signUpError.message, requiresPasswordChange: false };
            }

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
        await this.logAction('AUTH_LOGIN', `Access authorized for ${profile.email}`);
        return { user: profile, error: null, requiresPasswordChange: !!profile.temp_password };
    }

    return { user: null, error: "Identity profile not found.", requiresPasswordChange: false };
  }

  async addUser(user: Omit<UserProfile, 'id'> & { password?: string }): Promise<UserProfile> {
    const cleanEmail = user.email.trim().toLowerCase();
    let authId: string | null = null;
    let tempPassword: string | null = user.password || 'Temporary123!';
    
    if (this.isSupabase()) {
        const shadow = this.getShadowClient();
        const { data: authData, error: authError } = await (shadow.auth as any).signUp({
            email: cleanEmail,
            password: tempPassword,
            options: { data: { full_name: user.name, name: user.name, display_name: user.name } }
        });

        if (authData?.user) {
            authId = authData.user.id;
        }

        const insertData = {
            email: cleanEmail,
            name: user.name,
            role_id: user.role_id,
            allowed_outlets: user.allowed_outlets || [],
            temp_password: tempPassword,
            auth_id: authId,
            updated_at: new Date().toISOString()
        };

        const { data, error: dbError } = await supabase
            .from('profiles')
            .upsert([insertData], { onConflict: 'email' })
            .select()
            .single();

        if (dbError) throw new Error(`Profile Sync Failed: ${dbError.message}`);
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

        if (!current.auth_id && updates.password) {
             finalUpdates.temp_password = updates.password;
        }

        Object.keys(finalUpdates).forEach(k => finalUpdates[k] === undefined && delete finalUpdates[k]);
        const { error } = await supabase.from('profiles').update(finalUpdates).eq('id', id);
        if (error) throw new Error(error.message);
        await this.logAction('UPDATE_USER', `Identity modified for ${current.name} (${current.email})`);
    }
  }

  async updateEmail(newEmail: string) {
      if (this.isSupabase()) {
          const { error } = await (supabase.auth as any).updateUser({ email: newEmail });
          if (error) throw new Error(error.message);
      }
  }

  async changePassword(userId: string, currentPass: string, newPass: string) {
    if (this.isSupabase()) {
        const { error } = await (supabase.auth as any).updateUser({ password: newPass });
        if (error) throw new Error(error.message);
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
    if (this.isSupabase()) {
      await supabase.from('profiles').delete().eq('id', id);
    }
  }

  async getMembers(outletId?: string): Promise<Member[]> {
    if (this.isSupabase()) {
      let query = supabase.from('members').select('*');
      if (outletId) query = query.eq('outlet_id', outletId);
      const { data } = await query;
      return (data || []) as Member[];
    }
    return [];
  }

  async addMember(member: Member) {
    if (this.isSupabase()) {
      await supabase.from('members').insert([member]);
      await this.logAction('CREATE_MEMBER', `New enrollment: ${member.guest_name} (${member.membership_number})`, member.outlet_id);
    }
  }

  async updateMember(id: string, member: Partial<Member>) {
    if (this.isSupabase()) {
      await supabase.from('members').update(member).eq('id', id);
      await this.logAction('UPDATE_MEMBER', `Profile update: ${member.guest_name || id}`, member.outlet_id);
    }
  }

  async deleteMember(id: string) {
    if (this.isSupabase()) {
      await supabase.from('members').delete().eq('id', id);
      await this.logAction('DELETE_MEMBER', `Record purged: ${id}`);
    }
  }

  async getMemberHistory(membershipNumber: string): Promise<Member[]> {
    if (this.isSupabase()) {
      const { data } = await supabase.from('members').select('*').eq('membership_number', membershipNumber).order('start_date', { ascending: false });
      return (data || []) as Member[];
    }
    return [];
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

  async getCategories(outletId: string): Promise<MembershipCategory[]> {
    if (this.isSupabase()) {
      const { data } = await supabase.from('membership_categories').select('*').eq('outlet_id', outletId);
      return (data || []) as MembershipCategory[];
    }
    return [];
  }

  async addCategory(cat: Omit<MembershipCategory, 'id'>) {
    if (this.isSupabase()) {
      const newCat = { ...cat, id: `cat_${crypto.randomUUID()}` };
      await supabase.from('membership_categories').insert([newCat]);
    }
  }

  async updateCategory(id: string, updates: Partial<MembershipCategory>) {
    if (this.isSupabase()) {
      await supabase.from('membership_categories').update(updates).eq('id', id);
    }
  }

  async deleteCategory(id: string) {
    if (this.isSupabase()) {
      await supabase.from('membership_categories').delete().eq('id', id);
    }
  }

  async getSettings(): Promise<CompanySettings> {
    const defaultSettings: CompanySettings = {
        name: 'The Torch Hospitality',
        logo_url: '',
        address: '',
        currency_id: 'default'
    };

    if (this.isSupabase()) {
      try {
        const { data } = await supabase.from('company_settings').select('*').eq('id', 'global').maybeSingle();
        return (data as CompanySettings) || defaultSettings;
      } catch (e) {
        return defaultSettings;
      }
    }
    return defaultSettings;
  }

  async updateSettings(settings: CompanySettings) {
    if (this.isSupabase()) {
      await supabase.from('company_settings').update(settings).eq('id', 'global');
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
      const newCurr = { ...curr, id: crypto.randomUUID() };
      await supabase.from('currencies').insert([newCurr]);
    }
  }

  async updateCurrency(id: string, updates: Partial<Currency>) {
    if (this.isSupabase()) {
      await supabase.from('currencies').update(updates).eq('id', id);
    }
  }

  async deleteCurrency(id: string) {
    if (this.isSupabase()) {
      await supabase.from('currencies').delete().eq('id', id);
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
      const newRole = { ...role, id: role.name.toLowerCase().replace(/\s+/g, '_') };
      await supabase.from('roles').insert([newRole]);
    }
  }

  async updateRole(id: string, updates: Partial<Role>) {
    if (this.isSupabase()) {
      await supabase.from('roles').update(updates).eq('id', id);
    }
  }

  async deleteRole(id: string) {
    if (this.isSupabase()) {
      await supabase.from('roles').delete().eq('id', id);
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
      const newOutlet = { ...outlet, id: crypto.randomUUID() };
      await supabase.from('outlets').insert([newOutlet]);
    }
  }

  async updateOutlet(id: string, updates: Partial<Outlet>) {
    if (this.isSupabase()) {
      await supabase.from('outlets').update(updates).eq('id', id);
    }
  }

  async deleteOutlet(id: string) {
    if (this.isSupabase()) {
      await supabase.from('outlets').delete().eq('id', id);
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
      const newProp = { ...prop, id: crypto.randomUUID() };
      await supabase.from('properties').insert([newProp]);
    }
  }

  async updateProperty(id: string, updates: Partial<Property>) {
    if (this.isSupabase()) {
      await supabase.from('properties').update(updates).eq('id', id);
    }
  }

  async deleteProperty(id: string) {
    if (this.isSupabase()) {
      await supabase.from('properties').delete().eq('id', id);
    }
  }

  async getLogs(outletId?: string): Promise<SystemLog[]> {
    if (this.isSupabase()) {
      let query = supabase.from('system_logs').select('*').order('timestamp', { ascending: false });
      if (outletId) query = query.eq('outlet_id', outletId);
      const { data } = await query;
      return (data || []) as SystemLog[];
    }
    return [];
  }
}

export const db = new DatabaseService();
