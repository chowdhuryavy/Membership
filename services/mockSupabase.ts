
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

  /**
   * AUTHENTICATION
   */
  async signUp(email: string, password: string, name: string): Promise<{ user: any, error: string | null }> {
    if (!this.isSupabase()) return { user: null, error: "Supabase not initialized." };
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });

    if (error) return { user: null, error: error.message };
    return { user: data.user, error: null };
  }

  async login(email: string, passwordAttempt: string): Promise<{ user: UserProfile | null, error: string | null }> {
    if (this.isSupabase()) {
        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password: passwordAttempt
            });

            if (authError) {
                console.warn("Supabase Auth rejected credentials:", authError.message);
                return { user: null, error: authError.message };
            }

            if (authData.user) {
                const { data: profile, error: pError } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
                if (profile) {
                    await this.logAction('AUTH_LOGIN', `Authenticated via Supabase.`, undefined, profile.name);
                    return { user: profile, error: null };
                }
                if (pError) console.error("Profile Fetch Error:", pError.message);
            }
        } catch (e) {
            console.error("Critical Auth Error:", e);
        }
    }
    return { user: null, error: "Access Denied." };
  }

  async changePassword(userId: string, currentPass: string, newPass: string): Promise<void> {
    if (this.isSupabase()) {
        const { error } = await supabase.auth.updateUser({ password: newPass });
        if (error) console.error("Password Update Error:", error.message);
    }
    await this.logAction('AUTH_PASSWORD_CHANGE', `Credentials updated for UID: ${userId}`);
  }

  /**
   * LOGGING & UTILS
   */
  async logAction(action: string, details: string, outlet_id?: string, overrideUser?: string) {
    let userName = overrideUser || 'System';
    let userId = 'local';
    
    try {
        if (this.isSupabase()) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                userId = user.id;
                if (!overrideUser) {
                    const sessionStr = localStorage.getItem('membership_session');
                    if (sessionStr) userName = JSON.parse(sessionStr).name;
                }
            }
        }
    } catch (e) {}

    const log: SystemLog = { 
        id: crypto.randomUUID(), 
        timestamp: new Date().toISOString(), 
        user_id: userId, 
        user_name: userName, 
        action, 
        details, 
        outlet_id 
    };
    
    if (this.isSupabase()) {
        await supabase.from('system_logs').insert([log]);
    }
    
    const logs = await this.localGet<SystemLog[]>('logs', []);
    await this.localSet('logs', [log, ...logs].slice(0, 1000));
  }

  async getLogs(outletId?: string): Promise<SystemLog[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('system_logs').select('*').order('timestamp', { ascending: false }).limit(200);
        if (data && data.length > 0) return outletId ? data.filter(l => !l.outlet_id || l.outlet_id === outletId) : data;
    }
    const logs = await this.localGet<SystemLog[]>('logs', []);
    return outletId ? logs.filter(l => !l.outlet_id || l.outlet_id === outletId) : logs;
  }

  /**
   * SYNCED DATA OPERATIONS
   */
  async getSettings(): Promise<CompanySettings> {
    const defaults: CompanySettings = { name: 'Membership ERP', logo_url: '', address: '', currency_id: 'default' };
    if (this.isSupabase()) {
        const { data } = await supabase.from('company_settings').select('*').single();
        if (data) return data;
    }
    return this.localGet<CompanySettings>('settings', defaults);
  }

  async updateSettings(updates: Partial<CompanySettings>): Promise<void> {
    if (this.isSupabase()) {
        const { error } = await supabase.from('company_settings').upsert({ id: 'global', ...updates });
        if (error) console.error("Settings Update Error:", error.message);
    }
    const current = await this.getSettings();
    await this.localSet('settings', { ...current, ...updates });
  }

  async getCurrencies(): Promise<Currency[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('currencies').select('*');
        if (data && data.length > 0) return data;
    }
    return this.localGet<Currency[]>('currencies', [{ id: 'default', code: 'USD', symbol: '$', rate: 1, is_default: true }]);
  }

  async addCurrency(curr: Omit<Currency, 'id'>): Promise<Currency> {
    const newCurr = { ...curr, id: crypto.randomUUID() };
    if (this.isSupabase()) {
        const { error } = await supabase.from('currencies').insert([newCurr]);
        if (error) console.error("Currency Insert Error:", error.message);
    }
    const list = await this.getCurrencies();
    await this.localSet('currencies', [...list, newCurr]);
    return newCurr;
  }

  async updateCurrency(id: string, updates: Partial<Currency>): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('currencies').update(updates).eq('id', id);
    }
    const list = await this.getCurrencies();
    await this.localSet('currencies', list.map(c => c.id === id ? { ...c, ...updates } : c));
  }

  async deleteCurrency(id: string): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('currencies').delete().eq('id', id);
    }
    const list = await this.getCurrencies();
    await this.localSet('currencies', list.filter(c => c.id !== id));
  }

  async getProperties(): Promise<Property[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('properties').select('*');
        if (data && data.length > 0) return data;
    }
    return this.localGet<Property[]>('properties', [{ id: 'prop_01', name: 'Grand Resort & Spa', logo_url: '', address: '123 Luxury Ave' }]);
  }

  async addProperty(prop: Omit<Property, 'id'>): Promise<Property> {
    const newProp = { ...prop, id: crypto.randomUUID() };
    if (this.isSupabase()) {
        await supabase.from('properties').insert([newProp]);
    }
    const list = await this.getProperties();
    await this.localSet('properties', [...list, newProp]);
    return newProp;
  }

  async updateProperty(id: string, updates: Partial<Property>): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('properties').update(updates).eq('id', id);
    }
    const list = await this.getProperties();
    await this.localSet('properties', list.map(p => p.id === id ? { ...p, ...updates } : p));
  }

  async deleteProperty(id: string): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('properties').delete().eq('id', id);
    }
    const list = await this.getProperties();
    await this.localSet('properties', list.filter(p => p.id !== id));
  }

  async getOutlets(): Promise<Outlet[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('outlets').select('*');
        if (data && data.length > 0) return data;
    }
    return this.localGet<Outlet[]>('outlets', [{ id: 'outlet_01', name: 'Beach Club', property_id: 'prop_01' }]);
  }

  async addOutlet(name: string, propertyId: string): Promise<Outlet> {
    const newOutlet = { id: crypto.randomUUID(), name, property_id: propertyId };
    if (this.isSupabase()) {
        const { error } = await supabase.from('outlets').insert([newOutlet]);
        if (error) {
            console.error("Outlet Insert Error:", error.message);
            // If property doesn't exist, we might need to sync it first
            if (error.code === '23503') throw new Error("Parent property must exist in cloud database first.");
        }
    }
    const list = await this.getOutlets();
    await this.localSet('outlets', [...list, newOutlet]);
    return newOutlet;
  }

  async updateOutlet(id: string, updates: Partial<Outlet>): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('outlets').update(updates).eq('id', id);
    }
    const list = await this.getOutlets();
    await this.localSet('outlets', list.map(o => o.id === id ? { ...o, ...updates } : o));
  }

  async deleteOutlet(id: string): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('outlets').delete().eq('id', id);
    }
    const list = await this.getOutlets();
    await this.localSet('outlets', list.filter(o => o.id !== id));
  }

  async getCategories(outletId?: string): Promise<MembershipCategory[]> {
    if (this.isSupabase()) {
        let query = supabase.from('membership_categories').select('*');
        if (outletId) query = query.eq('outlet_id', outletId);
        const { data } = await query;
        if (data) return data;
    }
    const list = await this.localGet<MembershipCategory[]>('categories', []);
    return outletId ? list.filter(c => c.outlet_id === outletId) : list;
  }

  async addCategory(cat: Omit<MembershipCategory, 'id'>): Promise<MembershipCategory> {
    const newCat = { ...cat, id: crypto.randomUUID() };
    if (this.isSupabase()) {
        const { error } = await supabase.from('membership_categories').insert([newCat]);
        if (error) {
            console.error("Category Insert Error:", error.message);
            if (error.code === '23503') throw new Error(`Outlet ID ${cat.outlet_id} does not exist in cloud database. Please ensure the outlet is saved first.`);
        }
    }
    const list = await this.localGet<MembershipCategory[]>('categories', []);
    await this.localSet('categories', [...list, newCat]);
    return newCat;
  }

  async updateCategory(id: string, updates: Partial<MembershipCategory>): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('membership_categories').update(updates).eq('id', id);
    }
    const list = await this.localGet<MembershipCategory[]>('categories', []);
    await this.localSet('categories', list.map(c => c.id === id ? { ...c, ...updates } : c));
  }

  async deleteCategory(id: string): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('membership_categories').delete().eq('id', id);
    }
    const list = await this.localGet<MembershipCategory[]>('categories', []);
    await this.localSet('categories', list.filter(c => c.id !== id));
  }

  async getMembers(outletId?: string): Promise<Member[]> {
    if (this.isSupabase()) {
        let query = supabase.from('members').select('*');
        if (outletId) query = query.eq('outlet_id', outletId);
        const { data } = await query;
        if (data) return data;
    }
    const list = await this.localGet<Member[]>('members', []);
    return outletId ? list.filter(m => m.outlet_id === outletId) : list;
  }

  async addMember(member: Member): Promise<Member> {
    if (this.isSupabase()) {
        const { error } = await supabase.from('members').insert([member]);
        if (error) console.error("Member Insert Error:", error.message);
    }
    const list = await this.getMembers();
    await this.localSet('members', [...list, member]);
    return member;
  }

  async updateMember(id: string, updates: Partial<Member>): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('members').update(updates).eq('id', id);
    }
    const list = await this.getMembers();
    await this.localSet('members', list.map(m => m.id === id ? { ...m, ...updates } : m));
  }

  async deleteMember(id: string): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('members').delete().eq('id', id);
    }
    const list = await this.getMembers();
    await this.localSet('members', list.filter(m => m.id !== id));
  }

  async getUsers(): Promise<UserProfile[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('profiles').select('*');
        if (data && data.length > 0) return data;
    }
    return this.localGet<UserProfile[]>('users', []);
  }

  async addUser(user: Omit<UserProfile, 'id'>): Promise<UserProfile> {
    // Note: Profiles are usually handled by handle_new_user trigger on auth.users signUp
    const newUser = { ...user, id: crypto.randomUUID() };
    if (this.isSupabase()) {
        const { error } = await supabase.from('profiles').insert([newUser]);
        if (error) {
            console.error("Profile Add Error:", error.message);
            throw new Error(error.message);
        }
    }
    const list = await this.getUsers();
    await this.localSet('users', [...list, newUser]);
    return newUser;
  }

  async updateUser(id: string, updates: Partial<UserProfile>): Promise<void> {
    if (this.isSupabase()) {
        const { error } = await supabase.from('profiles').update(updates).eq('id', id);
        if (error) {
            console.error("Profile Update Error:", error.message);
            throw new Error(error.message);
        }
    }
    const list = await this.getUsers();
    await this.localSet('users', list.map(u => u.id === id ? { ...u, ...updates } : u));
  }

  async deleteUser(id: string): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('profiles').delete().eq('id', id);
    }
    const list = await this.getUsers();
    await this.localSet('users', list.filter(u => u.id !== id));
  }

  async getRoles(): Promise<Role[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('roles').select('*');
        if (data && data.length > 0) return data;
    }
    return this.localGet<Role[]>('roles', []);
  }

  async addRole(role: Omit<Role, 'id'>): Promise<Role> {
    const newRole = { ...role, id: crypto.randomUUID() };
    if (this.isSupabase()) {
        await supabase.from('roles').insert([newRole]);
    }
    const list = await this.getRoles();
    await this.localSet('roles', [...list, newRole as Role]);
    return newRole as Role;
  }

  async updateRole(id: string, updates: Partial<Role>): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('roles').update(updates).eq('id', id);
    }
    const list = await this.getRoles();
    await this.localSet('roles', list.map(r => r.id === id ? { ...r, ...updates } : r));
  }

  async deleteRole(id: string): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('roles').delete().eq('id', id);
    }
    const list = await this.getRoles();
    await this.localSet('roles', list.filter(r => r.id !== id));
  }

  async getFreezes(memberId?: string): Promise<Freeze[]> {
    if (this.isSupabase()) {
        let query = supabase.from('freezes').select('*');
        if (memberId) query = query.eq('member_id', memberId);
        const { data } = await query;
        if (data) return data;
    }
    const list = await this.localGet<Freeze[]>('freezes', []);
    return memberId ? list.filter(f => f.member_id === memberId) : list;
  }

  async addFreeze(freeze: Freeze): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('freezes').insert([freeze]);
    }
    const list = await this.getFreezes();
    await this.localSet('freezes', [...list, freeze]);
  }
}

export const db = new DatabaseService();
