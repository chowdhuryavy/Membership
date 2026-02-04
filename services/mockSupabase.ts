
import { UserProfile, Role, Currency, CompanySettings, Member, MembershipCategory, Freeze, MemberStatus, Outlet, Property, SystemLog, Permission } from '../types';
import { supabase } from './supabase';

class DatabaseService {
  private isSupabase() {
    return !!supabase;
  }

  private async localGet<T>(key: string, defaultValue: T): Promise<T> {
    const data = localStorage.getItem(`db_${key}`);
    return data ? JSON.parse(data) : defaultValue;
  }

  private async localSet<T>(key: string, value: T): Promise<void> {
    localStorage.setItem(`db_${key}`, JSON.stringify(value));
  }

  async logAction(action: string, details: string, outlet_id?: string) {
    const sessionStr = localStorage.getItem('membership_session');
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
            supabase.from('system_logs').insert([logEntry]).then(({ error }) => {
                if (error) console.error("Cloud Logging Failure:", error.message);
            });
        } catch (e) {}
    }
    
    const localLogs = await this.localGet<any[]>('system_logs', []);
    await this.localSet('system_logs', [logEntry, ...localLogs].slice(0, 2000));
  }

  /**
   * REFINED AUTHENTICATION ENGINE
   */
  async login(email: string, passwordAttempt: string): Promise<{ user: UserProfile | null, error: string | null }> {
    if (this.isSupabase()) {
        const cleanEmail = email.trim().toLowerCase();
        
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: passwordAttempt
        });

        if (authError) {
            // Check for a provisioned profile with temp_password
            const { data: profile } = await supabase.from('profiles').select('*').eq('email', cleanEmail).maybeSingle();
            if (profile && profile.temp_password === passwordAttempt) {
                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                    email: cleanEmail,
                    password: passwordAttempt,
                    options: { data: { name: profile.name } }
                });

                if (!signUpError && signUpData.user) {
                    await supabase.from('profiles').update({ auth_id: signUpData.user.id, temp_password: null }).eq('id', profile.id);
                    return { user: profile, error: null };
                }
            }
            return { user: null, error: authError.message };
        }

        if (authData.user) {
            let { data: profile, error: fetchError } = await supabase.from('profiles').select('*').eq('auth_id', authData.user.id).maybeSingle();
            
            if (!profile) {
                // Self-Healing: Create profile if it exists in Auth but missing in Public table
                const newUser: UserProfile = { 
                  id: crypto.randomUUID(), 
                  auth_id: authData.user.id, 
                  email: cleanEmail, 
                  name: authData.user.user_metadata?.name || 'Admin User', 
                  role_id: 'admin', // Default to admin for first-time recovery
                  allowed_outlets: [] 
                };
                const { error: insertError } = await supabase.from('profiles').insert([newUser]);
                if (insertError) return { user: null, error: `Login success but profile creation failed: ${insertError.message}` };
                profile = newUser;
            }
            
            await this.logAction('AUTH_LOGIN', `Authorized: ${cleanEmail}`);
            return { user: profile, error: null };
        }
    }
    return { user: null, error: "Cloud connectivity error." };
  }

  async signUp(email: string, passwordAttempt: string, name: string): Promise<{ user: UserProfile | null, error: string | null }> {
    if (this.isSupabase()) {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password: passwordAttempt,
        options: { data: { name } }
      });
      if (authError) return { user: null, error: authError.message };
      if (authData.user) {
        const newUser: UserProfile = { id: crypto.randomUUID(), auth_id: authData.user.id, email, name, role_id: 'viewer', allowed_outlets: [] };
        await supabase.from('profiles').insert([newUser]);
        return { user: newUser, error: null };
      }
    }
    return { user: null, error: "Registration unavailable." };
  }

  async getSettings(): Promise<CompanySettings> { 
      if (this.isSupabase()) { 
          const { data } = await supabase.from('company_settings').select('*').eq('id', 'global').maybeSingle(); 
          if (data) return data; 
      } 
      return { name: '', logo_url: '', address: '', currency_id: 'default' }; 
  }
  
  async addUser(user: Omit<UserProfile, 'id'> & { password?: string }): Promise<UserProfile> {
    const id = crypto.randomUUID();
    const { password, ...userData } = user;
    const newUser = { ...userData, id, temp_password: password || null, email: userData.email.trim().toLowerCase() };
    if (this.isSupabase()) await supabase.from('profiles').insert([newUser]);
    return { ...userData, id } as UserProfile;
  }

  async updateUser(id: string, updates: Partial<UserProfile> & { password?: string }) { 
    if (this.isSupabase()) {
        const { password, ...userData } = updates;
        const finalUpdates: any = { ...userData };
        if (password) finalUpdates.temp_password = password;
        await supabase.from('profiles').update(finalUpdates).eq('id', id);
    }
  }

  async deleteUser(id: string) { if (this.isSupabase()) await supabase.from('profiles').delete().eq('id', id); }
  async addProperty(prop: Omit<Property, 'id'>): Promise<Property> {
    const newProp = { ...prop, id: crypto.randomUUID() };
    if (this.isSupabase()) await supabase.from('properties').insert([newProp]);
    return newProp;
  }
  async updateProperty(id: string, updates: Partial<Property>) { if (this.isSupabase()) await supabase.from('properties').update(updates).eq('id', id); }
  async deleteProperty(id: string) { if (this.isSupabase()) await supabase.from('properties').delete().eq('id', id); }
  async addOutlet(name: string, propertyId: string): Promise<Outlet> {
    const newOutlet = { id: crypto.randomUUID(), name, property_id: propertyId };
    if (this.isSupabase()) await supabase.from('outlets').insert([newOutlet]);
    return newOutlet;
  }
  async updateOutlet(id: string, updates: Partial<Outlet>) { if (this.isSupabase()) await supabase.from('outlets').update(updates).eq('id', id); }
  async deleteOutlet(id: string) { if (this.isSupabase()) await supabase.from('outlets').delete().eq('id', id); }
  async addCategory(cat: Omit<MembershipCategory, 'id'>): Promise<MembershipCategory> {
    const newCat = { ...cat, id: crypto.randomUUID() };
    if (this.isSupabase()) await supabase.from('membership_categories').insert([newCat]);
    return newCat;
  }
  async updateCategory(id: string, updates: Partial<MembershipCategory>) { if (this.isSupabase()) await supabase.from('membership_categories').update(updates).eq('id', id); }
  async deleteCategory(id: string) { if (this.isSupabase()) await supabase.from('membership_categories').delete().eq('id', id); }
  async addMember(member: Member): Promise<Member> { if (this.isSupabase()) await supabase.from('members').insert([member]); return member; }
  async updateMember(id: string, updates: Partial<Member>) { if (this.isSupabase()) await supabase.from('members').update(updates).eq('id', id); }
  async deleteMember(id: string) { if (this.isSupabase()) await supabase.from('members').delete().eq('id', id); }
  async addFreeze(freeze: Freeze): Promise<void> { 
    if (this.isSupabase()) {
        await supabase.from('freezes').insert([freeze]); 
        await supabase.from('members').update({ status: MemberStatus.FROZEN }).eq('id', freeze.member_id);
    }
  }
  async updateSettings(updates: Partial<CompanySettings>): Promise<void> { if (this.isSupabase()) await supabase.from('company_settings').upsert({ id: 'global', ...updates }); }
  async addCurrency(curr: Omit<Currency, 'id'>): Promise<Currency> {
    const newCurr = { ...curr, id: crypto.randomUUID() };
    if (this.isSupabase()) await supabase.from('currencies').insert([newCurr]);
    return newCurr;
  }
  async updateCurrency(id: string, updates: Partial<Currency>) { if (this.isSupabase()) await supabase.from('currencies').update(updates).eq('id', id); }
  async deleteCurrency(id: string) { if (this.isSupabase()) await supabase.from('currencies').delete().eq('id', id); }
  async addRole(role: Omit<Role, 'id'>) { 
    const r = { ...role, id: crypto.randomUUID() }; 
    if (this.isSupabase()) await supabase.from('roles').insert([r]); 
    return r as Role; 
  }
  async updateRole(id: string, updates: Partial<Role>) { if (this.isSupabase()) await supabase.from('roles').update(updates).eq('id', id); }
  async deleteRole(id: string) { if (this.isSupabase()) await supabase.from('roles').delete().eq('id', id); }
  async changePassword(userId: string, cur: string, n: string) { 
    if (this.isSupabase()) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) await supabase.auth.updateUser({ password: n });
    } 
  }
  async getCurrencies(): Promise<Currency[]> { if (this.isSupabase()) { const { data } = await supabase.from('currencies').select('*'); if (data && data.length > 0) return data; } return [{ id: 'default', code: 'USD', symbol: '$', rate: 1, is_default: true }]; }
  async getProperties(): Promise<Property[]> { if (this.isSupabase()) { const { data } = await supabase.from('properties').select('*'); if (data && data.length > 0) return data; } return []; }
  async getOutlets(): Promise<Outlet[]> { if (this.isSupabase()) { const { data } = await supabase.from('outlets').select('*'); if (data && data.length > 0) return data; } return []; }
  async getCategories(outletId?: string): Promise<MembershipCategory[]> { if (this.isSupabase()) { let q = supabase.from('membership_categories').select('*'); if (outletId) q = q.eq('outlet_id', outletId); const { data } = await q; if (data) return data; } return []; }
  async getMembers(outletId?: string): Promise<Member[]> { if (this.isSupabase()) { let q = supabase.from('members').select('*'); if (outletId) q = q.eq('outlet_id', outletId); const { data } = await q; if (data) return data; } return []; }
  async getRoles(): Promise<Role[]> { if (this.isSupabase()) { const { data } = await supabase.from('roles').select('*'); if (data) return data; } return []; }
  async getFreezes(memberId?: string): Promise<Freeze[]> { if (this.isSupabase()) { let q = supabase.from('freezes').select('*'); if (memberId) q = q.eq('member_id', memberId); const { data } = await q; if (data) return data; } return []; }
  async getUsers(): Promise<UserProfile[]> { if (this.isSupabase()) { const { data } = await supabase.from('profiles').select('*'); if (data) return data; } return []; }
  async getLogs(outletId?: string): Promise<SystemLog[]> {
    if (this.isSupabase()) {
        let q = supabase.from('system_logs').select('*').order('timestamp', { ascending: false }).limit(2000);
        if (outletId) q = q.eq('outlet_id', outletId);
        const { data } = await q;
        return data || [];
    }
    return [];
  }
}

export const db = new DatabaseService();
