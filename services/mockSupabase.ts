
import { UserProfile, Role, Currency, CompanySettings, Member, MembershipCategory, Freeze, MemberStatus, Outlet, Property, SystemLog, Permission } from '../types';
// Fixed: Added supabaseUrl and supabaseAnonKey to the imports from ./supabase to fix undefined variable errors.
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
        
        // If profile still has temp_password, it means they haven't completed the force-change flow
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
        
        // Clear temp_password upon successful change
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
      const newUser = { id: crypto.randomUUID(), auth_id: authData.user.id, email, name, role_id: 'viewer', allowed_outlets: [] };
      await supabase.from('profiles').insert([newUser]);
      await this.logAction('USER_REGISTRATION', `Self-registration for ${email}`);
      return { user: newUser as any, error: null };
    }
    return { user: null, error: "Provisioning failed." };
  }

  async getSettings(): Promise<CompanySettings> { 
    if (this.isSupabase()) { 
        const { data } = await supabase.from('company_settings').select('*').eq('id', 'global').maybeSingle(); 
        if (data) return data; 
    } 
    return { 
        name: 'The Torch Hospitality', 
        logo_url: '', 
        address: '', 
        currency_id: 'default',
        keyboard_shortcuts: {
            'nav_dashboard': 'Alt+D',
            'nav_members': 'Alt+M',
            'nav_settings': 'Alt+S',
            'global_search': 'Alt+K',
            'action_create': 'Alt+N',
            'action_save': 'Alt+Enter',
            'action_cancel': 'Escape'
        }
    }; 
  }
  
  async getRoles(): Promise<Role[]> { if (this.isSupabase()) { const { data } = await supabase.from('roles').select('*'); if (data && data.length > 0) return data; } return [{ id: 'admin', name: 'Administrator', permissions: ['members:view', 'members:create', 'members:edit', 'members:delete', 'categories:view', 'categories:create', 'categories:edit', 'categories:delete', 'users:view', 'users:create', 'users:edit', 'users:delete', 'settings:view', 'settings:edit', 'reports:view', 'reports:export', 'logs:view', 'properties:view', 'properties:edit', 'outlets:view', 'outlets:edit'], is_system: true }]; }
  
  async addRole(role: Omit<Role, 'id'>): Promise<Role> {
    const id = crypto.randomUUID();
    if (this.isSupabase()) {
      const { error } = await supabase.from('roles').insert([{ ...role, id }]);
      if (error) throw new Error(error.message);
      await this.logAction('CREATE_ROLE', `Deployed new security tier: ${role.name}`);
    }
    return { ...role, id } as Role;
  }

  async updateRole(id: string, updates: Partial<Role>) { 
    if (this.isSupabase()) { 
        const { error } = await supabase.from('roles').update(updates).eq('id', id); 
        if (error) throw new Error(error.message); 
        await this.logAction('UPDATE_ROLE', `Modified security tier: ${updates.name || id}`);
    } 
  }

  async deleteRole(id: string) {
    if (this.isSupabase()) {
      const { data: r } = await supabase.from('roles').select('name').eq('id', id).maybeSingle();
      await supabase.from('roles').delete().eq('id', id);
      if (r) await this.logAction('DELETE_ROLE', `Purged security tier: ${r.name}`);
    }
  }

  async deleteUser(id: string) { 
    if (this.isSupabase()) {
        const { data: user } = await supabase.from('profiles').select('email').eq('id', id).single();
        await supabase.from('profiles').delete().eq('id', id);
        if (user) await this.logAction('DELETE_USER', `Identity revoked: ${user.email}. ERP profile purged.`);
    } 
  }

  async addProperty(prop: Omit<Property, 'id'>): Promise<Property> { 
    const id = crypto.randomUUID(); 
    if (this.isSupabase()) { 
        const { error } = await supabase.from('properties').insert([{ ...prop, id }]); 
        if (error) throw new Error(error.message); 
        await this.logAction('CREATE_PROPERTY', `Added portfolio asset: ${prop.name}`);
    } 
    return { ...prop, id }; 
  }

  async updateProperty(id: string, updates: Partial<Property>) { 
    if (this.isSupabase()) { 
        const { error } = await supabase.from('properties').update(updates).eq('id', id); 
        if (error) throw new Error(error.message); 
        await this.logAction('UPDATE_PROPERTY', `Modified portfolio asset: ${updates.name || id}`);
    } 
  }

  async deleteProperty(id: string) { 
    if (this.isSupabase()) {
        const { data: p } = await supabase.from('properties').select('name').eq('id', id).single();
        await supabase.from('properties').delete().eq('id', id); 
        if (p) await this.logAction('DELETE_PROPERTY', `Purged portfolio asset: ${p.name}`);
    }
  }

  async addOutlet(outlet: Omit<Outlet, 'id'>): Promise<Outlet> { 
    const id = crypto.randomUUID(); 
    if (this.isSupabase()) { 
        const { error } = await supabase.from('outlets').insert([{ ...outlet, id }]); 
        if (error) throw new Error(error.message); 
        await this.logAction('CREATE_FACILITY', `Commissioned new facility: ${outlet.name}`);
    } 
    return { ...outlet, id }; 
  }

  async updateOutlet(id: string, updates: Partial<Outlet>) { 
    if (this.isSupabase()) { 
        const { error } = await supabase.from('outlets').update(updates).eq('id', id); 
        if (error) throw new Error(error.message); 
        await this.logAction('UPDATE_FACILITY', `Modified facility configuration: ${updates.name || id}`);
    } 
  }

  async deleteOutlet(id: string) { 
    if (this.isSupabase()) {
        const { data: o } = await supabase.from('outlets').select('name').eq('id', id).single();
        await supabase.from('outlets').delete().eq('id', id); 
        if (o) await this.logAction('DELETE_FACILITY', `Decommissioned facility: ${o.name}`);
    }
  }

  async addCategory(cat: Omit<MembershipCategory, 'id'>): Promise<MembershipCategory> { 
    const id = crypto.randomUUID(); 
    if (this.isSupabase()) { 
        const { error } = await supabase.from('membership_categories').insert([{ ...cat, id }]); 
        if (error) throw new Error(error.message); 
        await this.logAction('CREATE_TIER', `Deployed revenue tier: ${cat.name}`, cat.outlet_id);
    } 
    return { ...cat, id }; 
  }

  async updateCategory(id: string, updates: Partial<MembershipCategory>) { 
    if (this.isSupabase()) { 
        const { data: cat } = await supabase.from('membership_categories').select('outlet_id').eq('id', id).single();
        const { error } = await supabase.from('membership_categories').update(updates).eq('id', id); 
        if (error) throw new Error(error.message); 
        await this.logAction('UPDATE_TIER', `Modified revenue tier: ${updates.name || id}`, cat?.outlet_id);
    } 
  }

  async deleteCategory(id: string) { 
    if (this.isSupabase()) {
        const { data: c } = await supabase.from('membership_categories').select('name, outlet_id').eq('id', id).single();
        await supabase.from('membership_categories').delete().eq('id', id); 
        if (c) await this.logAction('DELETE_TIER', `Decommissioned revenue tier: ${c.name}`, c.outlet_id);
    }
  }

  async addMember(member: Member): Promise<Member> { 
    if (this.isSupabase()) { 
        const { error } = await supabase.from('members').insert([member]); 
        if (error) throw new Error(error.message); 
        await this.logAction('ENROLL_MEMBER', `Enrolled: ${member.guest_name} (${member.membership_number})`, member.outlet_id);
    } 
    return member; 
  }

  async updateMember(id: string, updates: Partial<Member>) { 
    if (this.isSupabase()) { 
        const { error } = await supabase.from('members').update(updates).eq('id', id); 
        if (error) throw new Error(error.message); 
        await this.logAction('UPDATE_MEMBER', `Profile modified for ${updates.guest_name || id}`, updates.outlet_id);
    } 
  }

  async deleteMember(id: string) { 
    if (this.isSupabase()) {
        const { data: m } = await supabase.from('members').select('guest_name, outlet_id').eq('id', id).single();
        await supabase.from('members').delete().eq('id', id); 
        if (m) await this.logAction('DELETE_MEMBER', `Purged account: ${m.guest_name}`, m.outlet_id);
    }
  }

  async addFreeze(freeze: Freeze): Promise<void> { 
    if (this.isSupabase()) { 
        const { data: m } = await supabase.from('members').select('*').eq('id', freeze.member_id).single();
        if (!m) throw new Error("Member not found");

        const { error: fzErr } = await supabase.from('freezes').insert([freeze]); 
        if (fzErr) throw new Error(fzErr.message); 

        const newEndDate = format(addDays(parseISO(m.current_end_date), freeze.total_days), 'yyyy-MM-dd');
        await supabase.from('members').update({ status: MemberStatus.FROZEN, current_end_date: newEndDate }).eq('id', freeze.member_id); 
        await this.logAction('FREEZE_MEMBER', `Account suspended: ${m.guest_name}. Membership extended to ${newEndDate}`, m.outlet_id);
    } 
  }

  async updateFreeze(id: string, updates: Partial<Freeze>) {
    if (this.isSupabase()) {
        const { data: oldFz } = await supabase.from('freezes').select('member_id, total_days').eq('id', id).maybeSingle();
        const { error } = await supabase.from('freezes').update(updates).eq('id', id);
        if (error) throw new Error(error.message);
        
        if (oldFz && updates.total_days !== undefined && updates.total_days !== oldFz.total_days) {
            const diff = updates.total_days - oldFz.total_days;
            const { data: m } = await supabase.from('members').select('current_end_date, outlet_id').eq('id', oldFz.member_id).maybeSingle();
            if (m) {
                const newEndDate = format(addDays(parseISO(m.current_end_date), diff), 'yyyy-MM-dd');
                await supabase.from('members').update({ current_end_date: newEndDate }).eq('id', oldFz.member_id);
            }
        }
        await this.logAction('UPDATE_FREEZE', `Modified suspension parameters for freeze ID: ${id}`);
    }
  }

  async deleteFreeze(id: string) { 
    if (this.isSupabase()) {
        const { data: fz } = await supabase.from('freezes').select('member_id, total_days').eq('id', id).maybeSingle();
        if (fz) {
            const { data: m } = await supabase.from('members').select('current_end_date, guest_name, outlet_id').eq('id', fz.member_id).maybeSingle();
            if (m) {
                const newEndDate = format(addDays(parseISO(m.current_end_date), -fz.total_days), 'yyyy-MM-dd');
                const { data: remainingFreezes } = await supabase.from('freezes').select('id').eq('member_id', fz.member_id).neq('id', id);
                const status = (remainingFreezes && remainingFreezes.length > 0) ? MemberStatus.FROZEN : MemberStatus.ACTIVE;
                
                await supabase.from('members').update({ status, current_end_date: newEndDate }).eq('id', fz.member_id); 
                await this.logAction('DELETE_FREEZE', `Suspension revoked for ${m.guest_name}. Membership reduced to ${newEndDate}`, m.outlet_id);
            }
        }
        await supabase.from('freezes').delete().eq('id', id); 
    }
  }

  async updateSettings(updates: Partial<CompanySettings>): Promise<void> { 
    if (this.isSupabase()) { 
        const validKeys = ['name', 'logo_url', 'address', 'currency_id', 'signatory_prepared_role', 'signatory_reviewed_role', 'signatory_approved_role', 'keyboard_shortcuts'];
        const payload: any = { id: 'global' };
        validKeys.forEach(k => { if ((updates as any)[k] !== undefined) payload[k] = (updates as any)[k]; });

        const { error } = await supabase.from('company_settings').upsert(payload, { onConflict: 'id' }); 
        if (error) {
            console.error("Schema Mismatch Warning:", error);
            throw new Error(`Database Error: ${error.message}`);
        }
        await this.logAction('UPDATE_SETTINGS', 'Global framework configurations synchronized');
    } 
  }
  
  async getCurrencies(): Promise<Currency[]> { if (this.isSupabase()) { const { data } = await supabase.from('currencies').select('*').order('code'); if (data && data.length > 0) return data; } return [{ id: 'default', code: 'USD', symbol: '$', rate: 1, is_default: true }]; }
  
  async addCurrency(currency: Omit<Currency, 'id'>): Promise<Currency> {
    const id = crypto.randomUUID();
    if (this.isSupabase()) {
      const { error } = await supabase.from('currencies').insert([{ ...currency, id }]);
      if (error) throw new Error(error.message);
      await this.logAction('CREATE_CURRENCY', `Synchronized new monetary standard: ${currency.code}`);
    }
    return { ...currency, id } as Currency;
  }

  async updateCurrency(id: string, updates: Partial<Currency>) { 
    if (this.isSupabase()) { 
        const { error } = await supabase.from('currencies').update(updates).eq('id', id); 
        if (error) throw new Error(error.message); 
        await this.logAction('UPDATE_CURRENCY', `Modified monetary standard: ${updates.code || id}`);
    } 
  }

  async deleteCurrency(id: string) {
    if (this.isSupabase()) {
      const { data: c } = await supabase.from('currencies').select('code').eq('id', id).maybeSingle();
      await supabase.from('currencies').delete().eq('id', id);
      if (c) await this.logAction('DELETE_CURRENCY', `Decommissioned monetary standard: ${c.code}`);
    }
  }

  async getProperties(): Promise<Property[]> { if (this.isSupabase()) { const { data } = await supabase.from('properties').select('*'); if (data && data.length > 0) return data; } return []; }
  async getOutlets(): Promise<Outlet[]> { if (this.isSupabase()) { const { data } = await supabase.from('outlets').select('*'); if (data && data.length > 0) return data; } return []; }
  async getCategories(outletId?: string): Promise<MembershipCategory[]> { if (this.isSupabase()) { let q = supabase.from('membership_categories').select('*'); if (outletId) q = q.eq('outlet_id', outletId); const { data } = await q; if (data) return data; } return []; }
  async getMembers(outletId?: string): Promise<Member[]> { if (this.isSupabase()) { let q = supabase.from('members').select('*'); if (outletId) q = q.eq('outlet_id', outletId); const { data } = await q; if (data) return data; } return []; }
  async getFreezes(memberId?: string): Promise<Freeze[]> { if (this.isSupabase()) { let q = supabase.from('freezes').select('*'); if (memberId) q = q.eq('member_id', memberId); const { data } = await q; if (data) return data; } return []; }
  async getUsers(): Promise<UserProfile[]> { if (this.isSupabase()) { const { data } = await supabase.from('profiles').select('*').order('name'); if (data) return data; } return []; }
  async getLogs(outletId?: string): Promise<SystemLog[]> { 
    if (this.isSupabase()) { 
      let q = supabase.from('system_logs').select('*');
      if (outletId) q = q.or(`outlet_id.eq.${outletId},outlet_id.is.null`);
      const { data } = await q.order('timestamp', { ascending: false }).limit(2000); 
      return data || []; 
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
        return data || [];
    }
    return [];
  }
}

export const db = new DatabaseService();
