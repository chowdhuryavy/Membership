
import { UserProfile, Role, Currency, CompanySettings, Member, MembershipCategory, Freeze, MemberStatus, Outlet, Property, SystemLog, Permission } from '../types';
import { supabase } from './supabase';

class DatabaseService {
  private isSupabase() {
    return !!supabase;
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
            await supabase.from('system_logs').insert([logEntry]);
        } catch (e) {}
    }
  }

  /**
   * REFINED IDENTITY SYNC ENGINE
   * Forces the Supabase Auth "Display Name" column to match our "Profiles" table.
   */
  async syncAuthMetadata(profile: UserProfile) {
    if (!this.isSupabase()) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const metaName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.display_name;
    
    if (profile.name !== metaName) {
      console.debug("Pushing metadata to Supabase Auth Dashboard...");
      await supabase.auth.updateUser({
        data: {
          full_name: profile.name,
          display_name: profile.name,
          name: profile.name
        }
      });
    }
  }

  async login(email: string, passwordAttempt: string): Promise<{ user: UserProfile | null, error: string | null }> {
    if (!this.isSupabase()) return { user: null, error: "Cloud sync offline." };
    
    const cleanEmail = email.trim().toLowerCase();
    
    // 1. Check current profile state
    const { data: profile } = await supabase.from('profiles').select('*').eq('email', cleanEmail).maybeSingle();

    // 2. Standard Auth Attempt
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: passwordAttempt
    });

    // 3. JIT RECONCILIATION
    // If Auth fails or profile is unlinked, check if this is a pending admin update
    if (authError || (profile && !profile.auth_id)) {
        if (profile && profile.temp_password === passwordAttempt) {
            // This is an Admin-updated identity. Provision it in Auth now.
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: cleanEmail,
                password: passwordAttempt,
                options: { 
                  data: { full_name: profile.name, display_name: profile.name, name: profile.name }
                }
            });

            if (signUpError) {
              if (signUpError.message.toLowerCase().includes('already registered')) {
                return { user: null, error: "Sync Conflict: This email is already in the Auth dashboard with a different password. Please delete the old user in Supabase Auth or use the original password." };
              }
              return { user: null, error: signUpError.message };
            }

            if (signUpData.user) {
              await supabase.from('profiles').update({ auth_id: signUpData.user.id, temp_password: null }).eq('id', profile.id);
              const { data: refreshed } = await supabase.from('profiles').select('*').eq('id', profile.id).single();
              return { user: refreshed, error: null };
            }
        }
        
        // Handle Bootstrap
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        if (count === 0 && email.includes('@')) {
          const { data: bs } = await supabase.auth.signUp({ email, password: passwordAttempt, options: { data: { name: "Admin", full_name: "Admin" } } });
          if (bs.user) {
            const admin = { id: crypto.randomUUID(), auth_id: bs.user.id, email, name: "Admin", role_id: 'admin', allowed_outlets: [] };
            await supabase.from('profiles').insert([admin]);
            return { user: admin, error: null };
          }
        }
        return { user: null, error: authError?.message || "Invalid credentials." };
    }

    // 4. Success: Mirror Metadata to Dashboard
    if (authData.user && profile) {
        if (!profile.auth_id) {
          await supabase.from('profiles').update({ auth_id: authData.user.id, temp_password: null }).eq('id', profile.id);
        }
        await this.syncAuthMetadata(profile);
        return { user: profile, error: null };
    }

    return { user: null, error: "Auth timeout." };
  }

  async signUp(email: string, passwordAttempt: string, name: string): Promise<{ user: UserProfile | null, error: string | null }> {
    if (!this.isSupabase()) return { user: null, error: "Cloud sync offline." };
    const { data: authData, error: authError } = await supabase.auth.signUp({ 
        email, 
        password: passwordAttempt, 
        options: { data: { name, full_name: name, display_name: name } } 
    });
    if (authError) return { user: null, error: authError.message };
    if (authData.user) {
      const newUser = { id: crypto.randomUUID(), auth_id: authData.user.id, email, name, role_id: 'viewer', allowed_outlets: [] };
      await supabase.from('profiles').insert([newUser]);
      return { user: newUser as any, error: null };
    }
    return { user: null, error: "Signup failed." };
  }

  async getSettings(): Promise<CompanySettings> { 
      if (this.isSupabase()) { 
          const { data } = await supabase.from('company_settings').select('*').eq('id', 'global').maybeSingle(); 
          if (data && data.name) return data; 
      } 
      return { name: 'The Torch Hospitality', logo_url: '', address: '', currency_id: 'default' }; 
  }
  
  async getRoles(): Promise<Role[]> {
      if (this.isSupabase()) {
          const { data } = await supabase.from('roles').select('*');
          if (data && data.length > 0) return data;
      }
      return [{ id: 'admin', name: 'Administrator', permissions: ['members:view', 'members:create', 'members:edit', 'members:delete', 'categories:view', 'categories:create', 'categories:edit', 'categories:delete', 'users:view', 'users:create', 'users:edit', 'users:delete', 'settings:view', 'settings:edit', 'reports:view', 'reports:export', 'logs:view', 'properties:view', 'properties:edit', 'outlets:view', 'outlets:edit'], is_system: true }];
  }

  async addUser(user: Omit<UserProfile, 'id'> & { password?: string }): Promise<UserProfile> {
    const id = crypto.randomUUID();
    const insertData = {
        id: id,
        email: user.email.trim().toLowerCase(),
        name: user.name,
        role_id: user.role_id,
        allowed_outlets: user.allowed_outlets || [],
        temp_password: user.password || null,
        auth_id: null // Force JIT sync
    };

    if (this.isSupabase()) {
        const { error } = await supabase.from('profiles').insert([insertData]);
        if (error) throw new Error(`DB Error: ${error.message}`);
    }
    return { ...user, id } as UserProfile;
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

        // IF CURRENT USER IS SELF: Update Auth metadata immediately
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (currentUser && current && current.auth_id === currentUser.id) {
            if (updates.name && updates.name !== current.name) {
                await supabase.auth.updateUser({ data: { full_name: updates.name, name: updates.name } });
            }
        }

        // IF ADMIN OVERRIDE: Clear auth_id to force a fresh provisioning on login
        if (updates.email && current && updates.email.trim().toLowerCase() !== current.email.toLowerCase()) {
            finalUpdates.auth_id = null;
        }
        if (updates.password) {
            finalUpdates.temp_password = updates.password;
            finalUpdates.auth_id = null;
        }

        Object.keys(finalUpdates).forEach(key => finalUpdates[key] === undefined && delete finalUpdates[key]);

        const { error } = await supabase.from('profiles').update(finalUpdates).eq('id', id);
        if (error) throw new Error(error.message);
    }
  }

  async deleteUser(id: string) { if (this.isSupabase()) await supabase.from('profiles').delete().eq('id', id); }

  async addProperty(prop: Omit<Property, 'id'>): Promise<Property> {
    const id = crypto.randomUUID();
    if (this.isSupabase()) {
        const { error } = await supabase.from('properties').insert([{ ...prop, id }]);
        if (error) throw new Error(error.message);
    }
    return { ...prop, id };
  }

  async updateProperty(id: string, updates: Partial<Property>) { 
    if (this.isSupabase()) {
        const { error } = await supabase.from('properties').update(updates).eq('id', id);
        if (error) throw new Error(error.message);
    }
  }

  async deleteProperty(id: string) { if (this.isSupabase()) await supabase.from('properties').delete().eq('id', id); }

  async addOutlet(name: string, propertyId: string): Promise<Outlet> {
    const id = crypto.randomUUID();
    if (this.isSupabase()) {
        const { error } = await supabase.from('outlets').insert([{ id, name, property_id: propertyId }]);
        if (error) throw new Error(error.message);
    }
    return { id, name, property_id: propertyId };
  }

  async updateOutlet(id: string, updates: Partial<Outlet>) { 
    if (this.isSupabase()) {
        const { error } = await supabase.from('outlets').update(updates).eq('id', id);
        if (error) throw new Error(error.message);
    }
  }

  async deleteOutlet(id: string) { if (this.isSupabase()) await supabase.from('outlets').delete().eq('id', id); }

  async addCategory(cat: Omit<MembershipCategory, 'id'>): Promise<MembershipCategory> {
    const id = crypto.randomUUID();
    if (this.isSupabase()) {
        const { error } = await supabase.from('membership_categories').insert([{ ...cat, id }]);
        if (error) throw new Error(error.message);
    }
    return { ...cat, id };
  }

  async updateCategory(id: string, updates: Partial<MembershipCategory>) { 
    if (this.isSupabase()) {
        const { error } = await supabase.from('membership_categories').update(updates).eq('id', id);
        if (error) throw new Error(error.message);
    }
  }

  async deleteCategory(id: string) { if (this.isSupabase()) await supabase.from('membership_categories').delete().eq('id', id); }

  async addMember(member: Member): Promise<Member> { 
    if (this.isSupabase()) {
        const { error } = await supabase.from('members').insert([member]);
        if (error) throw new Error(error.message);
    } 
    return member; 
  }

  async updateMember(id: string, updates: Partial<Member>) { 
    if (this.isSupabase()) {
        const { error } = await supabase.from('members').update(updates).eq('id', id);
        if (error) throw new Error(error.message);
    }
  }

  async deleteMember(id: string) { if (this.isSupabase()) await supabase.from('members').delete().eq('id', id); }

  async addFreeze(freeze: Freeze): Promise<void> { 
    if (this.isSupabase()) {
        const { error: fzErr } = await supabase.from('freezes').insert([freeze]); 
        if (fzErr) throw new Error(fzErr.message);
        await supabase.from('members').update({ status: MemberStatus.FROZEN }).eq('id', freeze.member_id);
    }
  }

  async updateSettings(updates: Partial<CompanySettings>): Promise<void> { 
    if (this.isSupabase()) {
        const { error } = await supabase.from('company_settings').upsert({ id: 'global', ...updates });
        if (error) throw new Error(error.message);
    }
  }

  async addCurrency(curr: Omit<Currency, 'id'>): Promise<Currency> {
    const id = crypto.randomUUID();
    if (this.isSupabase()) {
        const { error } = await supabase.from('currencies').insert([{ ...curr, id }]);
        if (error) throw new Error(error.message);
    }
    return { ...curr, id };
  }

  async updateCurrency(id: string, updates: Partial<Currency>) { 
    if (this.isSupabase()) {
        const { error } = await supabase.from('currencies').update(updates).eq('id', id);
        if (error) throw new Error(error.message);
    }
  }

  async deleteCurrency(id: string) { if (this.isSupabase()) await supabase.from('currencies').delete().eq('id', id); }

  async addRole(role: Omit<Role, 'id'>) { 
    const id = crypto.randomUUID(); 
    if (this.isSupabase()) {
        const { error } = await supabase.from('roles').insert([{ ...role, id }]); 
        if (error) throw new Error(error.message);
    }
    return { ...role, id } as Role; 
  }

  async updateRole(id: string, updates: Partial<Role>) { 
    if (this.isSupabase()) {
        const { error } = await supabase.from('roles').update(updates).eq('id', id);
        if (error) throw new Error(error.message);
    }
  }

  async deleteRole(id: string) { if (this.isSupabase()) await supabase.from('roles').delete().eq('id', id); }

  async changePassword(userId: string, cur: string, n: string) { 
    if (this.isSupabase()) {
        const { error } = await supabase.auth.updateUser({ password: n });
        if (error) throw new Error(error.message);
        // Also update local profiles table if needed
    } 
  }

  async getCurrencies(): Promise<Currency[]> { if (this.isSupabase()) { const { data } = await supabase.from('currencies').select('*'); if (data && data.length > 0) return data; } return [{ id: 'default', code: 'USD', symbol: '$', rate: 1, is_default: true }]; }
  async getProperties(): Promise<Property[]> { if (this.isSupabase()) { const { data } = await supabase.from('properties').select('*'); if (data && data.length > 0) return data; } return []; }
  async getOutlets(): Promise<Outlet[]> { if (this.isSupabase()) { const { data } = await supabase.from('outlets').select('*'); if (data && data.length > 0) return data; } return []; }
  async getCategories(outletId?: string): Promise<MembershipCategory[]> { if (this.isSupabase()) { let q = supabase.from('membership_categories').select('*'); if (outletId) q = q.eq('outlet_id', outletId); const { data } = await q; if (data) return data; } return []; }
  async getMembers(outletId?: string): Promise<Member[]> { if (this.isSupabase()) { let q = supabase.from('members').select('*'); if (outletId) q = q.eq('outlet_id', outletId); const { data } = await q; if (data) return data; } return []; }
  async getFreezes(memberId?: string): Promise<Freeze[]> { if (this.isSupabase()) { let q = supabase.from('freezes').select('*'); if (memberId) q = q.eq('member_id', memberId); const { data } = await q; if (data) return data; } return []; }
  async getUsers(): Promise<UserProfile[]> { if (this.isSupabase()) { const { data } = await supabase.from('profiles').select('*').order('name'); if (data) return data; } return []; }
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
