
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
   * DEPENDENCY SYNCING (Fixes 409 Conflicts)
   * Ensures parent objects exist in Supabase before children are saved.
   */
  private async ensureOutletExists(outletId?: string) {
    if (!this.isSupabase() || !outletId) return;

    // 1. Check if outlet exists in cloud
    const { data: existing } = await supabase.from('outlets').select('id').eq('id', outletId).single();
    if (existing) return;

    // 2. If not, find it locally and sync it
    const localOutlets = await this.getOutlets();
    const outlet = localOutlets.find(o => o.id === outletId);
    
    if (outlet) {
        // Ensure property exists first
        await this.ensurePropertyExists(outlet.property_id);
        await supabase.from('outlets').upsert(outlet);
        console.log(`Synced Outlet ${outletId} to Supabase`);
    }
  }

  private async ensurePropertyExists(propertyId?: string) {
    if (!this.isSupabase() || !propertyId) return;
    
    const { data: existing } = await supabase.from('properties').select('id').eq('id', propertyId).single();
    if (existing) return;

    const localProps = await this.getProperties();
    const prop = localProps.find(p => p.id === propertyId);
    if (prop) {
        await supabase.from('properties').upsert(prop);
        console.log(`Synced Property ${propertyId} to Supabase`);
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
   * DATA OPERATIONS
   */
  async getSettings(): Promise<CompanySettings> {
    const defaults: CompanySettings = { name: 'Membership ERP', logo_url: '', address: '', currency_id: 'default' };
    if (this.isSupabase()) {
        const { data } = await supabase.from('company_settings').select('*').single();
        if (data) return data;
    }
    return this.localGet<CompanySettings>('settings', defaults);
  }

  async getCurrencies(): Promise<Currency[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('currencies').select('*');
        if (data && data.length > 0) return data;
    }
    return this.localGet<Currency[]>('currencies', [{ id: 'default', code: 'USD', symbol: '$', rate: 1, is_default: true }]);
  }

  async getProperties(): Promise<Property[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('properties').select('*');
        if (data && data.length > 0) return data;
    }
    return this.localGet<Property[]>('properties', [{ id: 'prop_01', name: 'Grand Resort & Spa', logo_url: '', address: '123 Luxury Ave' }]);
  }

  async getOutlets(): Promise<Outlet[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('outlets').select('*');
        if (data && data.length > 0) return data;
    }
    return this.localGet<Outlet[]>('outlets', [{ id: 'outlet_01', name: 'Beach Club', property_id: 'prop_01' }]);
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
        // FIXED: Ensure Outlet exists in Supabase before creating category
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
        // NOTE: Profiles must match a UUID in auth.users. 
        // If you are creating a "Virtual User", RLS will block it if it's not a real UUID from auth.
        const { error } = await supabase.from('profiles').insert([newUser]);
        if (error) throw new Error(`Permission Denied: Only real Auth Users can have Profiles. ${error.message}`);
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
    return this.localGet<Role[]>('roles', [{ id: 'admin', name: 'Administrator', permissions: [], is_system: true }]);
  }

  async getLogs(outletId?: string): Promise<SystemLog[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('system_logs').select('*').order('timestamp', { ascending: false }).limit(200);
        if (data) return outletId ? data.filter(l => !l.outlet_id || l.outlet_id === outletId) : data;
    }
    return [];
  }

  async logAction(action: string, details: string, outlet_id?: string) {
    if (this.isSupabase()) {
        await supabase.from('system_logs').insert([{ id: crypto.randomUUID(), action, details, outlet_id }]);
    }
  }

  async updateSettings(updates: Partial<CompanySettings>) { if (this.isSupabase()) await supabase.from('company_settings').upsert({ id: 'global', ...updates }); }
  async updateMember(id: string, updates: Partial<Member>) { if (this.isSupabase()) await supabase.from('members').update(updates).eq('id', id); }
  async deleteMember(id: string) { if (this.isSupabase()) await supabase.from('members').delete().eq('id', id); }
  async updateCategory(id: string, updates: Partial<MembershipCategory>) { if (this.isSupabase()) await supabase.from('membership_categories').update(updates).eq('id', id); }
  async deleteCategory(id: string) { if (this.isSupabase()) await supabase.from('membership_categories').delete().eq('id', id); }
  async updateUser(id: string, updates: Partial<UserProfile>) { if (this.isSupabase()) await supabase.from('profiles').update(updates).eq('id', id); }
  async deleteUser(id: string) { if (this.isSupabase()) await supabase.from('profiles').delete().eq('id', id); }
  async getFreezes(memberId?: string): Promise<Freeze[]> { return []; }
  async addFreeze(freeze: Freeze): Promise<void> {}
  async updateProperty(id: string, updates: Partial<Property>) {}
  async deleteProperty(id: string) {}
  async addProperty(prop: Omit<Property, 'id'>) {}
  async addOutlet(name: string, propertyId: string) {}
  async updateOutlet(id: string, updates: Partial<Outlet>) {}
  async deleteOutlet(id: string) {}
  async addCurrency(curr: Omit<Currency, 'id'>) {}
  async updateCurrency(id: string, updates: Partial<Currency>) {}
  async deleteCurrency(id: string) {}
  async addRole(role: Omit<Role, 'id'>) { return { id: 'temp' } as Role; }
  async updateRole(id: string, updates: Partial<Role>) {}
  async deleteRole(id: string) {}
  async changePassword(userId: string, cur: string, n: string) {}
}

export const db = new DatabaseService();
