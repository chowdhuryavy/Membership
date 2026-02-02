
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
  async login(email: string, passwordAttempt: string): Promise<{ user: UserProfile | null, error: string | null }> {
    if (this.isSupabase()) {
        const { data, error } = await supabase.from('profiles').select('*').eq('email', email).single();
        if (data && passwordAttempt === 'password') { // In production, use Supabase Auth
            await this.logAction('AUTH_LOGIN', `User ${email} authenticated via Supabase.`, undefined, data.name);
            return { user: data, error: null };
        }
    }
    
    const users = await this.getUsers();
    const user = users.find(u => u.email === email);
    if (user && passwordAttempt === 'password') {
        await this.logAction('AUTH_LOGIN', `Session started for ${user.name}`, undefined, user.name);
        return { user, error: null };
    }
    return { user: null, error: "Invalid credentials." };
  }

  // Added missing changePassword method
  async changePassword(userId: string, currentPass: string, newPass: string): Promise<void> {
    // In production, use Supabase Auth or a secure backend call.
    // For this mock context, we simulate successful credential update.
    await this.logAction('AUTH_PASSWORD_CHANGE', `Security credentials updated for user ID: ${userId}`);
  }

  /**
   * SETTINGS & CURRENCIES
   */
  async getSettings(): Promise<CompanySettings> {
    const defaults: CompanySettings = { name: 'Membership ERP', logo_url: '', address: '', currency_id: 'default' };
    if (this.isSupabase()) {
        const { data, error } = await supabase.from('company_settings').select('*').single();
        if (!error && data) return data;
    }
    return this.localGet<CompanySettings>('settings', defaults);
  }

  async updateSettings(updates: Partial<CompanySettings>): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('company_settings').upsert({ id: 'global', ...updates });
    }
    const current = await this.getSettings();
    await this.localSet('settings', { ...current, ...updates });
    await this.logAction('SETTINGS_UPDATE', `System configurations updated.`);
  }

  async getCurrencies(): Promise<Currency[]> {
    const defaults = [{ id: 'default', code: 'USD', symbol: '$', rate: 1, is_default: true }];
    if (this.isSupabase()) {
        const { data, error } = await supabase.from('currencies').select('*');
        if (!error && data && data.length > 0) return data;
    }
    return this.localGet<Currency[]>('currencies', defaults);
  }

  async addCurrency(curr: Omit<Currency, 'id'>): Promise<Currency> {
    const newCurr = { ...curr, id: crypto.randomUUID() };
    if (this.isSupabase()) {
        if (curr.is_default) await supabase.from('currencies').update({ is_default: false }).neq('id', 'temp');
        await supabase.from('currencies').insert([newCurr]);
    }
    const list = await this.getCurrencies();
    let updatedList = curr.is_default ? list.map(c => ({...c, is_default: false})) : list;
    await this.localSet('currencies', [...updatedList, newCurr]);
    return newCurr;
  }

  async updateCurrency(id: string, updates: Partial<Currency>): Promise<void> {
    if (this.isSupabase()) {
        if (updates.is_default) await supabase.from('currencies').update({ is_default: false }).neq('id', id);
        await supabase.from('currencies').update(updates).eq('id', id);
    }
    const list = await this.getCurrencies();
    let updatedList = list.map(c => c.id === id ? { ...c, ...updates } : c);
    if (updates.is_default) {
        updatedList = updatedList.map(c => c.id === id ? c : {...c, is_default: false});
    }
    await this.localSet('currencies', updatedList);
  }

  async deleteCurrency(id: string): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('currencies').delete().eq('id', id);
    }
    const list = await this.getCurrencies();
    await this.localSet('currencies', list.filter(c => c.id !== id));
  }

  /**
   * PROPERTIES & OUTLETS
   */
  // Added missing getProperties method
  async getProperties(): Promise<Property[]> {
    const defaults: Property[] = [{ id: 'prop_01', name: 'Grand Resort & Spa', logo_url: '', address: '123 Luxury Ave' }];
    if (this.isSupabase()) {
        const { data } = await supabase.from('properties').select('*');
        if (data && data.length > 0) return data;
    }
    return this.localGet<Property[]>('properties', defaults);
  }

  // Added missing addProperty method
  async addProperty(prop: Omit<Property, 'id'>): Promise<Property> {
    const newProp = { ...prop, id: crypto.randomUUID() };
    if (this.isSupabase()) {
        await supabase.from('properties').insert([newProp]);
    }
    const list = await this.getProperties();
    await this.localSet('properties', [...list, newProp]);
    return newProp;
  }

  // Added missing updateProperty method
  async updateProperty(id: string, updates: Partial<Property>): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('properties').update(updates).eq('id', id);
    }
    const list = await this.getProperties();
    await this.localSet('properties', list.map(p => p.id === id ? { ...p, ...updates } : p));
  }

  // Added missing deleteProperty method
  async deleteProperty(id: string): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('properties').delete().eq('id', id);
    }
    const list = await this.getProperties();
    await this.localSet('properties', list.filter(p => p.id !== id));
  }

  // Added missing getOutlets method
  async getOutlets(): Promise<Outlet[]> {
    const defaults: Outlet[] = [{ id: 'outlet_01', name: 'Beach Club', property_id: 'prop_01' }];
    if (this.isSupabase()) {
        const { data } = await supabase.from('outlets').select('*');
        if (data && data.length > 0) return data;
    }
    return this.localGet<Outlet[]>('outlets', defaults);
  }

  // Added missing addOutlet method
  async addOutlet(name: string, propertyId: string): Promise<Outlet> {
    const newOutlet = { id: crypto.randomUUID(), name, property_id: propertyId };
    if (this.isSupabase()) {
        await supabase.from('outlets').insert([newOutlet]);
    }
    const list = await this.getOutlets();
    await this.localSet('outlets', [...list, newOutlet]);
    return newOutlet;
  }

  // Added missing updateOutlet method
  async updateOutlet(id: string, updates: Partial<Outlet>): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('outlets').update(updates).eq('id', id);
    }
    const list = await this.getOutlets();
    await this.localSet('outlets', list.map(o => o.id === id ? { ...o, ...updates } : o));
  }

  // Added missing deleteOutlet method
  async deleteOutlet(id: string): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('outlets').delete().eq('id', id);
    }
    const list = await this.getOutlets();
    await this.localSet('outlets', list.filter(o => o.id !== id));
  }

  /**
   * MEMBERS & CATEGORIES
   */
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
        await supabase.from('membership_categories').insert([newCat]);
    }
    const list = await this.localGet<MembershipCategory[]>('categories', []);
    await this.localSet('categories', [...list, newCat]);
    return newCat;
  }

  // Added missing updateCategory method
  async updateCategory(id: string, updates: Partial<MembershipCategory>): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('membership_categories').update(updates).eq('id', id);
    }
    const list = await this.localGet<MembershipCategory[]>('categories', []);
    await this.localSet('categories', list.map(c => c.id === id ? { ...c, ...updates } : c));
  }

  // Added missing deleteCategory method
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
        await supabase.from('members').insert([member]);
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

  /**
   * COMMON UTILS
   */
  async logAction(action: string, details: string, outlet_id?: string, overrideUser?: string) {
    let userName = overrideUser || 'System';
    try {
        const sessionStr = localStorage.getItem('membership_session');
        if (sessionStr) {
            const session = JSON.parse(sessionStr);
            userName = session.name || session.email || 'User';
        }
    } catch (e) {}

    const log: SystemLog = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), user_id: 'local', user_name: userName, action, details, outlet_id };
    
    if (this.isSupabase()) {
        await supabase.from('system_logs').insert([log]);
    }
    
    const logs = await this.localGet<SystemLog[]>('logs', []);
    await this.localSet('logs', [log, ...logs].slice(0, 1000));
  }

  async getLogs(outletId?: string): Promise<SystemLog[]> {
    if (this.isSupabase()) {
        let query = supabase.from('system_logs').select('*').order('timestamp', { ascending: false });
        if (outletId) query = query.eq('outlet_id', outletId);
        const { data } = await query;
        if (data) return data;
    }
    const logs = await this.localGet<SystemLog[]>('logs', []);
    return outletId ? logs.filter(l => !l.outlet_id || l.outlet_id === outletId) : logs;
  }

  async getUsers(): Promise<UserProfile[]> {
    if (this.isSupabase()) {
        const { data } = await supabase.from('profiles').select('*');
        if (data) return data;
    }
    const defaultUser: UserProfile = { id: 'admin', email: 'admin@membership.com', name: 'Administrator', role_id: 'admin', allowed_outlets: ['outlet_01'] };
    return this.localGet<UserProfile[]>('users', [defaultUser]);
  }

  async addUser(user: Omit<UserProfile, 'id'>): Promise<UserProfile> {
    const newUser = { ...user, id: crypto.randomUUID() };
    if (this.isSupabase()) {
        await supabase.from('profiles').insert([newUser]);
    }
    const list = await this.getUsers();
    await this.localSet('users', [...list, newUser]);
    return newUser;
  }

  async updateUser(id: string, updates: Partial<UserProfile>): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('profiles').update(updates).eq('id', id);
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
        if (data) return data;
    }
    const defaultRoles: Role[] = [{ id: 'admin', name: 'Administrator', permissions: ['members:view', 'members:create', 'members:edit', 'members:delete', 'categories:view', 'categories:create', 'categories:edit', 'categories:delete', 'users:view', 'users:create', 'users:edit', 'users:delete', 'settings:view', 'settings:edit', 'reports:view', 'reports:export', 'logs:view', 'properties:view', 'properties:edit', 'outlets:view', 'outlets:edit'], is_system: true }];
    return this.localGet<Role[]>('roles', defaultRoles);
  }

  // Added missing addRole method
  async addRole(role: Omit<Role, 'id'>): Promise<Role> {
    const newRole = { ...role, id: crypto.randomUUID() };
    if (this.isSupabase()) {
        await supabase.from('roles').insert([newRole]);
    }
    const list = await this.getRoles();
    await this.localSet('roles', [...list, newRole as Role]);
    return newRole as Role;
  }

  // Added missing updateRole method
  async updateRole(id: string, updates: Partial<Role>): Promise<void> {
    if (this.isSupabase()) {
        await supabase.from('roles').update(updates).eq('id', id);
    }
    const list = await this.getRoles();
    await this.localSet('roles', list.map(r => r.id === id ? { ...r, ...updates } : r));
  }

  // Added missing deleteRole method
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
