
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
   * Detects 500 errors from Supabase Auth and provides specific remediation.
   */
  async login(email: string, passwordAttempt: string): Promise<{ user: UserProfile | null, error: string | null }> {
    if (!this.isSupabase()) return { user: null, error: "Supabase connection offline." };
    
    const cleanEmail = email.trim().toLowerCase();
    
    // 1. Attempt standard login
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: passwordAttempt
    });

    // 2. Handle failure: Potential "Shadow User" Provisioning
    if (authError) {
        console.warn("Standard Auth failed:", authError.message);

        // Check if user exists in our local profiles table with a matching temp password
        const { data: profile, error: profErr } = await supabase.from('profiles')
            .select('*')
            .eq('email', cleanEmail)
            .maybeSingle();
        
        if (profile && profile.temp_password === passwordAttempt) {
            // Provision the user in Supabase Auth
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: cleanEmail,
                password: passwordAttempt,
                options: { 
                  data: { name: profile.name },
                  // Force redirect to current origin to avoid Site URL 500s
                  emailRedirectTo: window.location.origin 
                }
            });

            if (signUpError) {
                if (signUpError.status === 500) {
                    return { 
                      user: null, 
                      error: "Supabase Auth 500: Please check 'Email Confirmations' in Supabase Dashboard (Auth -> Settings). It must be OFF if SMTP is not configured." 
                    };
                }
                if (signUpError.message.toLowerCase().includes('already registered')) {
                  return { user: null, error: "Access key incorrect for this registered account." };
                }
                return { user: null, error: `Provisioning Error: ${signUpError.message}` };
            }

            if (signUpData.user) {
                // Provisioning success: Update link and clear temp password
                await supabase.from('profiles').update({ 
                    auth_id: signUpData.user.id, 
                    temp_password: null 
                }).eq('id', profile.id);
                
                const { data: updatedProfile } = await supabase.from('profiles').select('*').eq('id', profile.id).single();
                return { user: updatedProfile, error: null };
            }
        }
        
        return { user: null, error: authError.message || "Invalid credentials." };
    }

    // 3. Reconcile valid Auth session with Profile
    if (authData.user) {
        let { data: profile } = await supabase.from('profiles').select('*').eq('auth_id', authData.user.id).maybeSingle();
        
        if (!profile) {
            const { data: emailProfile } = await supabase.from('profiles').select('*').eq('email', cleanEmail).maybeSingle();
            if (emailProfile) {
                await supabase.from('profiles').update({ auth_id: authData.user.id, temp_password: null }).eq('id', emailProfile.id);
                const { data: refreshed } = await supabase.from('profiles').select('*').eq('id', emailProfile.id).single();
                profile = refreshed;
            } else {
                // Create profile if missing
                const newUser = { 
                    id: crypto.randomUUID(), 
                    auth_id: authData.user.id, 
                    email: cleanEmail, 
                    name: authData.user.user_metadata?.name || 'Staff User', 
                    role_id: 'viewer', 
                    allowed_outlets: [] 
                };
                await supabase.from('profiles').insert([newUser]);
                profile = newUser as any;
            }
        }
        
        await this.logAction('AUTH_LOGIN', `Identity Reconciled: ${cleanEmail}`);
        return { user: profile, error: null };
    }

    return { user: null, error: "Authentication timeout." };
  }

  async signUp(email: string, passwordAttempt: string, name: string): Promise<{ user: UserProfile | null, error: string | null }> {
    if (!this.isSupabase()) return { user: null, error: "Cloud sync offline." };
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password: passwordAttempt, options: { data: { name } } });
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

  /**
   * REFINED USER CREATION
   * Explicitly construction prevents database "Database error saving new user" due to field spread.
   */
  async addUser(user: Omit<UserProfile, 'id'> & { password?: string }): Promise<UserProfile> {
    const id = crypto.randomUUID();
    
    // Explicit construction
    const insertData = {
        id: id,
        email: user.email.trim().toLowerCase(),
        name: user.name,
        role_id: user.role_id,
        allowed_outlets: user.allowed_outlets || [],
        temp_password: user.password || null,
        auth_id: null
    };

    if (this.isSupabase()) {
        const { error } = await supabase.from('profiles').insert([insertData]);
        if (error) {
            console.error("Supabase Profile Insert Error:", error);
            throw new Error(`DB Error: ${error.message}`);
        }
    }
    
    return { ...user, id } as UserProfile;
  }

  async updateUser(id: string, updates: Partial<UserProfile> & { password?: string }) { 
    if (this.isSupabase()) {
        const finalUpdates: any = { 
            name: updates.name,
            email: updates.email?.trim().toLowerCase(),
            role_id: updates.role_id,
            allowed_outlets: updates.allowed_outlets,
            updated_at: new Date().toISOString()
        };
        
        if (updates.password) finalUpdates.temp_password = updates.password;
        
        // Remove undefined fields
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
