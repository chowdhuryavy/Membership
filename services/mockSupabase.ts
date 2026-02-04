
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
   * REFINED AUTHENTICATION ENGINE
   * Handles 400/500 errors by attempting to reconcile the Auth user with the Profiles table.
   */
  async login(email: string, passwordAttempt: string): Promise<{ user: UserProfile | null, error: string | null }> {
    if (!this.isSupabase()) return { user: null, error: "Cloud sync offline." };
    
    const cleanEmail = email.trim().toLowerCase();
    
    // 1. Attempt standard login
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: passwordAttempt
    });

    // 2. Fallback logic for new users created in the UI (Shadow Users)
    if (authError) {
        // Log the exact error for debugging but don't show technical 400s to user
        console.warn("Auth Attempt Info:", authError.message);

        // Check if this user exists in our local profiles table with a temp password
        const { data: profile } = await supabase.from('profiles').select('*').eq('email', cleanEmail).maybeSingle();
        
        if (profile && profile.temp_password === passwordAttempt) {
            // This is a new staff member. Attempt to provision them in Supabase Auth.
            // Note: If this fails with 500, check Supabase Email Auth settings (SMTP/Confirmation).
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: cleanEmail,
                password: passwordAttempt,
                options: { data: { name: profile.name } }
            });

            if (signUpError) {
                // If they already exist in Auth but we couldn't sign in (e.g. unconfirmed email),
                // we might need to tell the user to confirm or contact admin.
                if (signUpError.message.toLowerCase().includes('already registered')) {
                  return { user: null, error: "Account exists but credentials failed. Check your access key." };
                }
                return { user: null, error: `Provisioning Error: ${signUpError.message}` };
            }

            if (signUpData.user) {
                // Provisioning successful. Link the profile and clear the temp password.
                await supabase.from('profiles').update({ 
                    auth_id: signUpData.user.id, 
                    temp_password: null 
                }).eq('id', profile.id);
                
                const { data: updatedProfile } = await supabase.from('profiles').select('*').eq('id', profile.id).single();
                return { user: updatedProfile, error: null };
            }
        }
        
        return { user: null, error: "Invalid credentials or unauthorized identity." };
    }

    // 3. Successful standard login: Ensure Profile is synchronized
    if (authData.user) {
        let { data: profile } = await supabase.from('profiles').select('*').eq('auth_id', authData.user.id).maybeSingle();
        
        if (!profile) {
            // Reconcile by email if the auth_id isn't linked yet
            const { data: emailProfile } = await supabase.from('profiles').select('*').eq('email', cleanEmail).maybeSingle();
            if (emailProfile) {
                await supabase.from('profiles').update({ auth_id: authData.user.id, temp_password: null }).eq('id', emailProfile.id);
                const { data: refreshed } = await supabase.from('profiles').select('*').eq('id', emailProfile.id).single();
                profile = refreshed;
            } else {
                // Disaster Recovery: Create a profile if one doesn't exist for this valid Auth user
                const newUser: UserProfile = { 
                    id: crypto.randomUUID(), 
                    auth_id: authData.user.id, 
                    email: cleanEmail, 
                    name: authData.user.user_metadata?.name || 'Staff User', 
                    role_id: 'viewer', 
                    allowed_outlets: [] 
                };
                await supabase.from('profiles').insert([newUser]);
                profile = newUser;
            }
        }
        
        await this.logAction('AUTH_LOGIN', `Identity Verified: ${cleanEmail}`);
        return { user: profile, error: null };
    }

    return { user: null, error: "Authentication timed out." };
  }

  async signUp(email: string, passwordAttempt: string, name: string): Promise<{ user: UserProfile | null, error: string | null }> {
    if (!this.isSupabase()) return { user: null, error: "Cloud sync offline." };
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password: passwordAttempt, options: { data: { name } } });
    if (authError) return { user: null, error: authError.message };
    if (authData.user) {
      const newUser: UserProfile = { id: crypto.randomUUID(), auth_id: authData.user.id, email, name, role_id: 'viewer', allowed_outlets: [] };
      await supabase.from('profiles').insert([newUser]);
      return { user: newUser, error: null };
    }
    return { user: null, error: "User creation failed." };
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
    const { password, ...userData } = user;
    const newUser = { ...userData, id, temp_password: password || null, email: userData.email.trim().toLowerCase() };
    if (this.isSupabase()) {
        const { error } = await supabase.from('profiles').insert([newUser]);
        if (error) throw new Error(error.message);
    }
    return { ...userData, id } as UserProfile;
  }

  async updateUser(id: string, updates: Partial<UserProfile> & { password?: string }) { 
    if (this.isSupabase()) {
        const { password, ...userData } = updates;
        const finalUpdates: any = { ...userData };
        if (password) finalUpdates.temp_password = password;
        const { error } = await supabase.from('profiles').update(finalUpdates).eq('id', id);
        if (error) throw new Error(error.message);
    }
  }

  async deleteUser(id: string) { if (this.isSupabase()) await supabase.from('profiles').delete().eq('id', id); }

  async addProperty(prop: Omit<Property, 'id'>): Promise<Property> {
    const newProp = { ...prop, id: crypto.randomUUID() };
    if (this.isSupabase()) {
        const { error } = await supabase.from('properties').insert([newProp]);
        if (error) throw new Error(error.message);
    }
    return newProp;
  }

  async updateProperty(id: string, updates: Partial<Property>) { 
    if (this.isSupabase()) {
        const { error } = await supabase.from('properties').update(updates).eq('id', id);
        if (error) throw new Error(error.message);
    }
  }

  async deleteProperty(id: string) { if (this.isSupabase()) await supabase.from('properties').delete().eq('id', id); }

  async addOutlet(name: string, propertyId: string): Promise<Outlet> {
    const newOutlet = { id: crypto.randomUUID(), name, property_id: propertyId };
    if (this.isSupabase()) {
        const { error } = await supabase.from('outlets').insert([newOutlet]);
        if (error) throw new Error(error.message);
    }
    return newOutlet;
  }

  async updateOutlet(id: string, updates: Partial<Outlet>) { 
    if (this.isSupabase()) {
        const { error } = await supabase.from('outlets').update(updates).eq('id', id);
        if (error) throw new Error(error.message);
    }
  }

  async deleteOutlet(id: string) { if (this.isSupabase()) await supabase.from('outlets').delete().eq('id', id); }

  async addCategory(cat: Omit<MembershipCategory, 'id'>): Promise<MembershipCategory> {
    const newCat = { ...cat, id: crypto.randomUUID() };
    if (this.isSupabase()) {
        const { error } = await supabase.from('membership_categories').insert([newCat]);
        if (error) throw new Error(error.message);
    }
    return newCat;
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
    const newCurr = { ...curr, id: crypto.randomUUID() };
    if (this.isSupabase()) {
        const { error } = await supabase.from('currencies').insert([newCurr]);
        if (error) throw new Error(error.message);
    }
    return newCurr;
  }

  async updateCurrency(id: string, updates: Partial<Currency>) { 
    if (this.isSupabase()) {
        const { error } = await supabase.from('currencies').update(updates).eq('id', id);
        if (error) throw new Error(error.message);
    }
  }

  async deleteCurrency(id: string) { if (this.isSupabase()) await supabase.from('currencies').delete().eq('id', id); }

  async addRole(role: Omit<Role, 'id'>) { 
    const r = { ...role, id: crypto.randomUUID() }; 
    if (this.isSupabase()) {
        const { error } = await supabase.from('roles').insert([r]); 
        if (error) throw new Error(error.message);
    }
    return r as Role; 
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
    } 
  }

  async getCurrencies(): Promise<Currency[]> { if (this.isSupabase()) { const { data } = await supabase.from('currencies').select('*'); if (data && data.length > 0) return data; } return [{ id: 'default', code: 'USD', symbol: '$', rate: 1, is_default: true }]; }
  async getProperties(): Promise<Property[]> { if (this.isSupabase()) { const { data } = await supabase.from('properties').select('*'); if (data && data.length > 0) return data; } return []; }
  async getOutlets(): Promise<Outlet[]> { if (this.isSupabase()) { const { data } = await supabase.from('outlets').select('*'); if (data && data.length > 0) return data; } return []; }
  async getCategories(outletId?: string): Promise<MembershipCategory[]> { if (this.isSupabase()) { let q = supabase.from('membership_categories').select('*'); if (outletId) q = q.eq('outlet_id', outletId); const { data } = await q; if (data) return data; } return []; }
  async getMembers(outletId?: string): Promise<Member[]> { if (this.isSupabase()) { let q = supabase.from('members').select('*'); if (outletId) q = q.eq('outlet_id', outletId); const { data } = await q; if (data) return data; } return []; }
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
