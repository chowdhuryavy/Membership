
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
   */
  private async forceSyncHierarchy(outletId: string) {
    if (!this.isSupabase()) return;
    const { data: out } = await supabase.from('outlets').select('id').eq('id', outletId).single();
    if (out) return;
    const localOutlets = await this.getOutlets();
    const outlet = localOutlets.find(o => o.id === outletId);
    if (!outlet) return;
    const { data: prop } = await supabase.from('properties').select('id').eq('id', outlet.property_id).single();
    if (!prop) {
        const localProps = await this.getProperties();
        const property = localProps.find(p => p.id === outlet.property_id);
        if (property) await supabase.from('properties').insert([property]);
    }
    await supabase.from('outlets').insert([outlet]);
  }

  /**
   * AUTHENTICATION
   */
  async signUp(email: string, password: string, name: string): Promise<{ user: any, error: string | null }> {
    if (!this.isSupabase()) return { user: null, error: "Cloud connection disabled." };
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
            // Priority 1: Find by Linked auth_id
            let { data: profile } = await supabase.from('profiles').select('*').eq('auth_id', authData.user.id).single();
            // Priority 2: Fallback to ID (for older records)
            if (!profile) {
                const { data: fallback } = await supabase.from('profiles').select('*').eq('id', authData.user.id).single();
                profile = fallback;
            }
            if (profile) return { user: profile, error: null };
        }
    }
    return { user: null, error: "Access Denied." };
  }

  /**
   * USER & PROFILE OPERATIONS
   */
  async getUsers(): Promise<UserProfile[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('profiles').select('*');
        if (data) return data;
    }
    return this.localGet<UserProfile[]>('users', []);
  }

  async addUser(user: Omit<UserProfile, 'id'>): Promise<UserProfile> {
    const id = crypto.randomUUID();
    const newUser = { ...user, id };
    
    if (this.isSupabase()) {
        // We insert into PROFILES table. It no longer has a FK to auth.users.
        const { error } = await supabase.from('profiles').insert([newUser]);
        if (error) {
            console.error("Critical Deployment Error:", error.message);
            throw new Error(`Profile Provisioning Failed: ${error.message}. TIP: Ensure you executed the SQL to drop profiles_id_fkey.`);
        }
    }
    
    const list = await this.getUsers();
    await this.localSet('users', [...list, newUser]);
    return newUser;
  }

  /**
   * SYSTEM OPERATIONS
   */
  async getSettings(): Promise<CompanySettings> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('company_settings').select('*').single();
        if (data) return data;
    }
    return { name: 'Membership ERP', logo_url: '', address: '', currency_id: 'default' };
  }

  async updateSettings(updates: Partial<CompanySettings>): Promise<void> {
    if (this.isSupabase()) await supabase.from('company_settings').upsert({ id: 'global', ...updates });
  }

  async getCurrencies(): Promise<Currency[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('currencies').select('*');
        if (data && data.length > 0) return data;
    }
    return [{ id: 'default', code: 'USD', symbol: '$', rate: 1, is_default: true }];
  }

  async addCurrency(curr: Omit<Currency, 'id'>): Promise<Currency> {
    const newCurr = { ...curr, id: crypto.randomUUID() };
    if (this.isSupabase()) await supabase.from('currencies').insert([newCurr]);
    return newCurr;
  }

  async getProperties(): Promise<Property[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('properties').select('*');
        if (data && data.length > 0) return data;
    }
    return [{ id: 'prop_01', name: 'Grand Resort & Spa', logo_url: '', address: 'Corporate HQ' }];
  }

  async addProperty(prop: Omit<Property, 'id'>): Promise<Property> {
    const newProp = { ...prop, id: crypto.randomUUID() };
    if (this.isSupabase()) await supabase.from('properties').insert([newProp]);
    return newProp;
  }

  async getOutlets(): Promise<Outlet[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('outlets').select('*');
        if (data && data.length > 0) return data;
    }
    return [{ id: 'outlet_01', name: 'Main Club', property_id: 'prop_01' }];
  }

  async addOutlet(name: string, propertyId: string): Promise<Outlet> {
    const newOutlet = { id: crypto.randomUUID(), name, property_id: propertyId };
    if (this.isSupabase()) {
        await this.forceSyncHierarchy(newOutlet.id);
        await supabase.from('outlets').insert([newOutlet]);
    }
    return newOutlet;
  }

  async getCategories(outletId?: string): Promise<MembershipCategory[]> {
    if (this.isSupabase()) {
        let q = supabase.from('membership_categories').select('*');
        if (outletId) q = q.eq('outlet_id', outletId);
        const { data } = await q;
        if (data) return data;
    }
    return [];
  }

  async addCategory(cat: Omit<MembershipCategory, 'id'>): Promise<MembershipCategory> {
    const newCat = { ...cat, id: crypto.randomUUID() };
    if (this.isSupabase() && cat.outlet_id) {
        await this.forceSyncHierarchy(cat.outlet_id);
        await supabase.from('membership_categories').insert([newCat]);
    }
    return newCat;
  }

  async getMembers(outletId?: string): Promise<Member[]> {
    if (this.isSupabase()) {
        let q = supabase.from('members').select('*');
        if (outletId) q = q.eq('outlet_id', outletId);
        const { data } = await q;
        if (data) return data;
    }
    return [];
  }

  async addMember(member: Member): Promise<Member> {
    if (this.isSupabase() && member.outlet_id) {
        await this.forceSyncHierarchy(member.outlet_id);
        await supabase.from('members').insert([member]);
    }
    return member;
  }

  async getRoles(): Promise<Role[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('roles').select('*');
        if (data) return data;
    }
    return [];
  }

  async getLogs(outletId?: string): Promise<SystemLog[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('system_logs').select('*').order('timestamp', { ascending: false }).limit(100);
        return data || [];
    }
    return [];
  }

  async updateMember(id: string, updates: Partial<Member>) { if (this.isSupabase()) await supabase.from('members').update(updates).eq('id', id); }
  async deleteMember(id: string) { if (this.isSupabase()) await supabase.from('members').delete().eq('id', id); }
  async updateCategory(id: string, updates: Partial<MembershipCategory>) { if (this.isSupabase()) await supabase.from('membership_categories').update(updates).eq('id', id); }
  async deleteCategory(id: string) { if (this.isSupabase()) await supabase.from('membership_categories').delete().eq('id', id); }
  async updateUser(id: string, updates: Partial<UserProfile>) { if (this.isSupabase()) await supabase.from('profiles').update(updates).eq('id', id); }
  async deleteUser(id: string) { if (this.isSupabase()) await supabase.from('profiles').delete().eq('id', id); }
  async getFreezes(memberId?: string): Promise<Freeze[]> { return []; }
  async addFreeze(freeze: Freeze): Promise<void> { if (this.isSupabase()) await supabase.from('freezes').insert([freeze]); }
  async updateProperty(id: string, updates: Partial<Property>) { if (this.isSupabase()) await supabase.from('properties').update(updates).eq('id', id); }
  async deleteProperty(id: string) { if (this.isSupabase()) await supabase.from('properties').delete().eq('id', id); }
  async updateOutlet(id: string, updates: Partial<Outlet>) { if (this.isSupabase()) await supabase.from('outlets').update(updates).eq('id', id); }
  async deleteOutlet(id: string) { if (this.isSupabase()) await supabase.from('outlets').delete().eq('id', id); }
  async updateCurrency(id: string, updates: Partial<Currency>) { if (this.isSupabase()) await supabase.from('currencies').update(updates).eq('id', id); }
  async deleteCurrency(id: string) { if (this.isSupabase()) await supabase.from('currencies').delete().eq('id', id); }
  async addRole(role: Omit<Role, 'id'>) { const r = { ...role, id: crypto.randomUUID() }; if (this.isSupabase()) await supabase.from('roles').insert([r]); return r as Role; }
  async updateRole(id: string, updates: Partial<Role>) { if (this.isSupabase()) await supabase.from('roles').update(updates).eq('id', id); }
  async deleteRole(id: string) { if (this.isSupabase()) await supabase.from('roles').delete().eq('id', id); }
  async changePassword(userId: string, cur: string, n: string) { if (this.isSupabase()) await supabase.auth.updateUser({ password: n }); }
}

export const db = new DatabaseService();
