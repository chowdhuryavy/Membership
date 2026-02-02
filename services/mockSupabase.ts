
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
   * DEPENDENCY SYNCING
   * Ensures parent objects exist in Supabase before children are saved.
   */
  private async ensureOutletExists(outletId?: string) {
    if (!this.isSupabase() || !outletId) return;

    const { data: existing } = await supabase.from('outlets').select('id').eq('id', outletId).single();
    if (existing) return;

    const localOutlets = await this.getOutlets();
    const outlet = localOutlets.find(o => o.id === outletId);
    
    if (outlet) {
        await this.ensurePropertyExists(outlet.property_id);
        const { error } = await supabase.from('outlets').insert([outlet]);
        if (error) console.error("Sync Outlet Fail:", error.message);
    }
  }

  private async ensurePropertyExists(propertyId?: string) {
    if (!this.isSupabase() || !propertyId) return;
    
    const { data: existing } = await supabase.from('properties').select('id').eq('id', propertyId).single();
    if (existing) return;

    const localProps = await this.getProperties();
    const prop = localProps.find(p => p.id === propertyId);
    if (prop) {
        const { error } = await supabase.from('properties').insert([prop]);
        if (error) console.error("Sync Property Fail:", error.message);
    }
  }

  /**
   * AUTHENTICATION
   */
  async signUp(email: string, password: string, name: string): Promise<{ user: any, error: string | null }> {
    if (!this.isSupabase()) return { user: null, error: "Supabase not initialized." };
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
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

            if (authError) return { user: null, error: authError.message };

            if (authData.user) {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
                if (profile) return { user: profile, error: null };
            }
        } catch (e) {
            console.error("Critical Auth Error:", e);
        }
    }
    return { user: null, error: "Access Denied." };
  }

  /**
   * CORE DATA OPERATIONS
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
        await supabase.from('company_settings').upsert({ id: 'global', ...updates });
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
        if (error) console.error("Cloud Currency Fail:", error.message);
    }
    const list = await this.getCurrencies();
    await this.localSet('currencies', [...list, newCurr]);
    return newCurr;
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
        await this.ensurePropertyExists(propertyId);
        await supabase.from('outlets').insert([newOutlet]);
    }
    const list = await this.getOutlets();
    await this.localSet('outlets', [...list, newOutlet]);
    return newOutlet;
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
        await this.ensureOutletExists(cat.outlet_id);
        const { error } = await supabase.from('membership_categories').insert([newCat]);
        if (error) throw new Error(`Cloud Sync Failed: ${error.message}`);
    }
    const list = await this.localGet<MembershipCategory[]>('categories', []);
    await this.localSet('categories', [...list, newCat]);
    return newCat;
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
        await this.ensureOutletExists(member.outlet_id);
        const { error } = await supabase.from('members').insert([member]);
        if (error) throw new Error(`Cloud Sync Failed: ${error.message}`);
    }
    const list = await this.getMembers();
    await this.localSet('members', [...list, member]);
    return member;
  }

  async getUsers(): Promise<UserProfile[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('profiles').select('*');
        if (data && data.length > 0) return data;
    }
    return this.localGet<UserProfile[]>('users', []);
  }

  async addUser(user: Omit<UserProfile, 'id'>): Promise<UserProfile> {
    const newUser = { ...user, id: crypto.randomUUID() };
    if (this.isSupabase()) {
        const { error } = await supabase.from('profiles').insert([newUser]);
        if (error) throw new Error(`Permission Denied: ${error.message}`);
    }
    const list = await this.getUsers();
    await this.localSet('users', [...list, newUser]);
    return newUser;
  }

  async getRoles(): Promise<Role[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('roles').select('*');
        if (data && data.length > 0) return data;
    }
    return this.localGet<Role[]>('roles', []);
  }

  async logAction(action: string, details: string, outlet_id?: string) {
    if (this.isSupabase()) {
        await supabase.from('system_logs').insert([{ id: crypto.randomUUID(), action, details, outlet_id }]);
    }
  }

  async getLogs(outletId?: string): Promise<SystemLog[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('system_logs').select('*').order('timestamp', { ascending: false }).limit(200);
        if (data) return outletId ? data.filter(l => !l.outlet_id || l.outlet_id === outletId) : data;
    }
    return [];
  }

  async updateMember(id: string, updates: Partial<Member>) { if (this.isSupabase()) await supabase.from('members').update(updates).eq('id', id); }
  async deleteMember(id: string) { if (this.isSupabase()) await supabase.from('members').delete().eq('id', id); }
  async updateCategory(id: string, updates: Partial<MembershipCategory>) { if (this.isSupabase()) await supabase.from('membership_categories').update(updates).eq('id', id); }
  async deleteCategory(id: string) { if (this.isSupabase()) await supabase.from('membership_categories').delete().eq('id', id); }
  async updateUser(id: string, updates: Partial<UserProfile>) { if (this.isSupabase()) await supabase.from('profiles').update(updates).eq('id', id); }
  async deleteUser(id: string) { if (this.isSupabase()) await supabase.from('profiles').delete().eq('id', id); }
  async getFreezes(memberId?: string): Promise<Freeze[]> { 
    if (this.isSupabase()) {
        let q = supabase.from('freezes').select('*');
        if (memberId) q = q.eq('member_id', memberId);
        const { data } = await q;
        if (data) return data;
    }
    return [];
  }
  async addFreeze(freeze: Freeze): Promise<void> { if (this.isSupabase()) await supabase.from('freezes').insert([freeze]); }
  async updateProperty(id: string, updates: Partial<Property>) { if (this.isSupabase()) await supabase.from('properties').update(updates).eq('id', id); }
  async deleteProperty(id: string) { if (this.isSupabase()) await supabase.from('properties').delete().eq('id', id); }
  async updateOutlet(id: string, updates: Partial<Outlet>) { if (this.isSupabase()) await supabase.from('outlets').update(updates).eq('id', id); }
  async deleteOutlet(id: string) { if (this.isSupabase()) await supabase.from('outlets').delete().eq('id', id); }
  async updateCurrency(id: string, updates: Partial<Currency>) { if (this.isSupabase()) await supabase.from('currencies').update(updates).eq('id', id); }
  async deleteCurrency(id: string) { if (this.isSupabase()) await supabase.from('currencies').delete().eq('id', id); }
  async addRole(role: Omit<Role, 'id'>) { 
    const r = { ...role, id: crypto.randomUUID() };
    if (this.isSupabase()) await supabase.from('roles').insert([r]);
    return r as Role;
  }
  async updateRole(id: string, updates: Partial<Role>) { if (this.isSupabase()) await supabase.from('roles').update(updates).eq('id', id); }
  async deleteRole(id: string) { if (this.isSupabase()) await supabase.from('roles').delete().eq('id', id); }
  async changePassword(userId: string, cur: string, n: string) { if (this.isSupabase()) await supabase.auth.updateUser({ password: n }); }
}

export const db = new DatabaseService();
