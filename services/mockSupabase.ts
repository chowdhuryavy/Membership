
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
   * RECURSIVE DEPENDENCY SYNC
   * Ensures the entire chain exists in Supabase: Property -> Outlet
   */
  private async forceSyncHierarchy(outletId: string) {
    if (!this.isSupabase()) return;

    // 1. Check Outlet
    const { data: out } = await supabase.from('outlets').select('id, property_id').eq('id', outletId).single();
    if (out) return; // Hierarchy likely intact

    // 2. Resolve locally
    const localOutlets = await this.getOutlets();
    const outlet = localOutlets.find(o => o.id === outletId);
    if (!outlet) return;

    // 3. Check/Sync Property first
    const { data: prop } = await supabase.from('properties').select('id').eq('id', outlet.property_id).single();
    if (!prop) {
        const localProps = await this.getProperties();
        const property = localProps.find(p => p.id === outlet.property_id);
        if (property) await supabase.from('properties').insert([property]);
    }

    // 4. Finally sync Outlet
    await supabase.from('outlets').insert([outlet]);
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
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password: passwordAttempt
        });
        if (authError) return { user: null, error: authError.message };
        if (authData.user) {
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
            if (profile) return { user: profile, error: null };
        }
    }
    return { user: null, error: "Authentication Failed." };
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
    if (this.isSupabase()) await supabase.from('company_settings').upsert({ id: 'global', ...updates });
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
    if (this.isSupabase()) await supabase.from('currencies').insert([newCurr]);
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
    if (this.isSupabase()) await supabase.from('properties').insert([newProp]);
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
        await this.forceSyncHierarchy(newOutlet.id);
        await supabase.from('outlets').insert([newOutlet]);
    }
    const list = await this.getOutlets();
    await this.localSet('outlets', [...list, newOutlet]);
    return newOutlet;
  }

  async getCategories(outletId?: string): Promise<MembershipCategory[]> {
    if (this.isSupabase()) {
        let q = supabase.from('membership_categories').select('*');
        if (outletId) q = q.eq('outlet_id', outletId);
        const { data } = await q;
        if (data) return data;
    }
    const list = await this.localGet<MembershipCategory[]>('categories', []);
    return outletId ? list.filter(c => c.outlet_id === outletId) : list;
  }

  async addCategory(cat: Omit<MembershipCategory, 'id'>): Promise<MembershipCategory> {
    const newCat = { ...cat, id: crypto.randomUUID() };
    if (this.isSupabase() && cat.outlet_id) {
        await this.forceSyncHierarchy(cat.outlet_id);
        const { error } = await supabase.from('membership_categories').insert([newCat]);
        if (error) throw new Error(`Category Save Error: ${error.message}`);
    }
    const list = await this.localGet<MembershipCategory[]>('categories', []);
    await this.localSet('categories', [...list, newCat]);
    return newCat;
  }

  async getMembers(outletId?: string): Promise<Member[]> {
    if (this.isSupabase()) {
        let q = supabase.from('members').select('*');
        if (outletId) q = q.eq('outlet_id', outletId);
        const { data } = await q;
        if (data) return data;
    }
    return this.localGet<Member[]>('members', []);
  }

  async addMember(member: Member): Promise<Member> {
    if (this.isSupabase() && member.outlet_id) {
        await this.forceSyncHierarchy(member.outlet_id);
        const { error } = await supabase.from('members').insert([member]);
        if (error) throw new Error(`Member Save Error: ${error.message}`);
    }
    const list = await this.getMembers();
    await this.localSet('members', [...list, member]);
    return member;
  }

  async getUsers(): Promise<UserProfile[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('profiles').select('*');
        if (data) return data;
    }
    return this.localGet<UserProfile[]>('users', []);
  }

  async addUser(user: Omit<UserProfile, 'id'>): Promise<UserProfile> {
    // Generate a proper UUID string
    const id = crypto.randomUUID();
    const newUser = { ...user, id };
    
    if (this.isSupabase()) {
        const { error } = await supabase.from('profiles').insert([newUser]);
        if (error) {
            console.error("Critical Permission Error:", error.message);
            throw new Error(`Profile sync failed. Ensure the SQL script was run to drop the profiles_id_fkey constraint. Details: ${error.message}`);
        }
    }
    
    const list = await this.getUsers();
    await this.localSet('users', [...list, newUser]);
    return newUser;
  }

  async getRoles(): Promise<Role[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('roles').select('*');
        if (data) return data;
    }
    return this.localGet<Role[]>('roles', []);
  }

  async logAction(action: string, details: string, outlet_id?: string) {
    if (this.isSupabase()) await supabase.from('system_logs').insert([{ id: crypto.randomUUID(), action, details, outlet_id }]);
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
