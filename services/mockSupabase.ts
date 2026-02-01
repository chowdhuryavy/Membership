
import { UserProfile, Role, Currency, CompanySettings, Member, MembershipCategory, Freeze, MemberStatus, Outlet, SystemLog } from '../types';
import { addDays, format, subDays, parseISO } from 'date-fns';

// --- SEED DATA ---
const SEED_ROLES: Role[] = [
  { 
    id: 'admin', 
    name: 'Administrator', 
    permissions: ['manage_members', 'manage_categories', 'manage_users', 'manage_settings', 'view_reports', 'view_logs'],
    is_system: true 
  },
  { 
    id: 'staff', 
    name: 'Staff', 
    permissions: ['manage_members', 'view_reports'],
    is_system: true 
  }
];

const SEED_OUTLETS: Outlet[] = [
  { id: 'out_main', name: 'Health Club' }
];

const SEED_USERS: (UserProfile & { password?: string })[] = [
  { id: 'user_admin', email: 'admin@nexus.com', role_id: 'admin', name: 'Admin User', allowed_outlets: ['out_main'], password: 'password' },
  { id: 'user_staff', email: 'staff@nexus.com', role_id: 'staff', name: 'Staff User', allowed_outlets: ['out_main'], password: 'password' },
];

const SEED_CURRENCIES: Currency[] = [
  { id: 'curr_qar', code: 'QAR', symbol: 'QR', rate: 1, is_default: true },
  { id: 'curr_usd', code: 'USD', symbol: '$', rate: 0.27, is_default: false },
];

const SEED_SETTINGS: CompanySettings = {
  name: 'Al Aziziyah Boutique Hotel',
  logo_url: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg', 
  address: 'Aspire Zone, Doha, Qatar',
  currency_id: 'curr_qar'
};

const SEED_CATEGORIES: MembershipCategory[] = [
  { id: 'cat_1', outlet_id: 'out_main', name: 'Annual Gold', duration_months: 12, base_rate: 1200 },
  { id: 'cat_2', outlet_id: 'out_main', name: '6 Month Silver', duration_months: 6, base_rate: 700 },
];

// Seed Members to prevent empty reports on first load
const SEED_MEMBERS: Member[] = [
    {
        id: 'mem_seed_1',
        outlet_id: 'out_main',
        membership_number: 'M-1001',
        guest_name: 'Mohammed Al-Thani',
        category_id: 'cat_1',
        start_date: format(subDays(new Date(), 45), 'yyyy-MM-dd'),
        original_end_date: format(addDays(subDays(new Date(), 45), 364), 'yyyy-MM-dd'),
        current_end_date: format(addDays(subDays(new Date(), 45), 364), 'yyyy-MM-dd'),
        actual_rate: 1200,
        discount: 0,
        net_amount: 1200,
        daily_rate: 3.28,
        status: MemberStatus.ACTIVE,
        check_no: 'CHK-8892'
    },
    {
        id: 'mem_seed_2',
        outlet_id: 'out_main',
        membership_number: 'M-1002',
        guest_name: 'Sarah Johnson',
        category_id: 'cat_2',
        start_date: format(subDays(new Date(), 10), 'yyyy-MM-dd'),
        original_end_date: format(addDays(subDays(new Date(), 10), 180), 'yyyy-MM-dd'),
        current_end_date: format(addDays(subDays(new Date(), 10), 180), 'yyyy-MM-dd'),
        actual_rate: 700,
        discount: 50,
        net_amount: 650,
        daily_rate: 3.59,
        status: MemberStatus.ACTIVE
    }
];

class MockSupabaseService {
  private getStorage<T>(key: string, defaultVal: T): T {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return defaultVal;
      return JSON.parse(stored);
    } catch (e) {
      console.error(`Error parsing storage key ${key}`, e);
      return defaultVal;
    }
  }

  private setStorage(key: string, val: any) {
    localStorage.setItem(key, JSON.stringify(val));
  }

  private async logAction(action: string, details: string, outlet_id?: string) {
      const logs = this.getStorage<SystemLog[]>('nexus_logs', []);
      const session = localStorage.getItem('nexus_session');
      let userId = 'system';
      let userName = 'System';
      
      if (session) {
          const user = JSON.parse(session);
          userId = user.id;
          userName = user.name;
      }

      const newLog: SystemLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          user_id: userId,
          user_name: userName,
          action,
          details,
          outlet_id
      };

      this.setStorage('nexus_logs', [newLog, ...logs].slice(0, 1000)); // Keep last 1000 logs
  }

  constructor() {
    if (!localStorage.getItem('nexus_settings')) this.setStorage('nexus_settings', SEED_SETTINGS);
    if (!localStorage.getItem('nexus_currencies')) this.setStorage('nexus_currencies', SEED_CURRENCIES);
    if (!localStorage.getItem('nexus_roles')) this.setStorage('nexus_roles', SEED_ROLES);
    if (!localStorage.getItem('nexus_outlets')) this.setStorage('nexus_outlets', SEED_OUTLETS);
    if (!localStorage.getItem('nexus_users')) this.setStorage('nexus_users', SEED_USERS);
    if (!localStorage.getItem('nexus_categories')) this.setStorage('nexus_categories', SEED_CATEGORIES);
    if (!localStorage.getItem('nexus_members')) this.setStorage('nexus_members', SEED_MEMBERS); 
    if (!localStorage.getItem('nexus_freezes')) this.setStorage('nexus_freezes', []);
    if (!localStorage.getItem('nexus_logs')) this.setStorage('nexus_logs', []);
  }

  // --- Logs ---
  async getLogs(outletId?: string): Promise<SystemLog[]> {
      const all = this.getStorage<SystemLog[]>('nexus_logs', []);
      if (!outletId) return all;
      return all.filter(l => !l.outlet_id || l.outlet_id === outletId);
  }

  // --- Auth & Users ---
  async login(email: string, passwordAttempt: string): Promise<{ user: UserProfile | null, error: string | null }> {
    await new Promise(r => setTimeout(r, 600));
    const users = this.getStorage<any[]>('nexus_users', SEED_USERS);
    const user = users.find(u => u.email === email);
    
    if (user) {
        const storedPass = user.password || 'password';
        if (storedPass === passwordAttempt) {
             const { password, ...safeUser } = user;
             this.logAction('LOGIN_SUCCESS', `User ${email} logged in successfully.`);
             return { user: safeUser, error: null };
        }
    }
    this.logAction('LOGIN_FAILURE', `Failed login attempt for ${email}.`);
    return { user: null, error: 'Invalid credentials' };
  }

  async changePassword(userId: string, currentPass: string, newPass: string): Promise<void> {
      const users = this.getStorage<any[]>('nexus_users', SEED_USERS);
      const idx = users.findIndex(u => u.id === userId);
      if (idx === -1) throw new Error("User not found");
      
      const user = users[idx];
      const storedPass = user.password || 'password';
      
      if (storedPass !== currentPass) throw new Error("Current password is incorrect");
      
      user.password = newPass;
      this.setStorage('nexus_users', users);
      this.logAction('PASSWORD_CHANGE', `User ${user.email} changed their password.`);
  }

  async getUsers(): Promise<UserProfile[]> { 
      const users = this.getStorage<any[]>('nexus_users', SEED_USERS);
      return users.map(({ password, ...u }) => u);
  }

  async addUser(user: Omit<UserProfile, 'id'>): Promise<UserProfile> {
    const users = this.getStorage<any[]>('nexus_users', SEED_USERS);
    if (users.find(u => u.email === user.email)) throw new Error('User already exists');
    
    const newUser = { ...user, id: `user_${Date.now()}`, password: 'password' };
    this.setStorage('nexus_users', [...users, newUser]);
    this.logAction('USER_CREATE', `Created user ${user.name} (${user.email}).`);
    
    const { password, ...safeUser } = newUser;
    return safeUser;
  }

  async updateUser(id: string, updates: Partial<UserProfile>): Promise<void> {
    const users = this.getStorage<any[]>('nexus_users', SEED_USERS);
    const idx = users.findIndex(u => u.id === id);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...updates };
      this.setStorage('nexus_users', users);
      this.logAction('USER_UPDATE', `Updated user profile for ${users[idx].email}.`);
    }
  }

  async deleteUser(id: string): Promise<void> {
    const users = this.getStorage<any[]>('nexus_users', SEED_USERS);
    const user = users.find(u => u.id === id);
    this.setStorage('nexus_users', users.filter(u => u.id !== id));
    if (user) this.logAction('USER_DELETE', `Deleted user account ${user.email}.`);
  }

  // --- Roles ---
  async getRoles(): Promise<Role[]> { return this.getStorage('nexus_roles', SEED_ROLES); }
  
  async addRole(role: Omit<Role, 'id'>): Promise<Role> {
    const roles = await this.getRoles();
    const newRole = { ...role, id: `role_${Date.now()}` };
    this.setStorage('nexus_roles', [...roles, newRole]);
    this.logAction('ROLE_CREATE', `Created system role: ${role.name}.`);
    return newRole;
  }
  
  async updateRole(id: string, updates: Partial<Role>): Promise<void> {
    const roles = await this.getRoles();
    const idx = roles.findIndex(r => r.id === id);
    if (idx !== -1) {
      roles[idx] = { ...roles[idx], ...updates };
      this.setStorage('nexus_roles', roles);
      this.logAction('ROLE_UPDATE', `Updated role permissions for ${roles[idx].name}.`);
    }
  }

  async deleteRole(id: string): Promise<void> {
    const roles = await this.getRoles();
    const role = roles.find(r => r.id === id);
    if (role?.is_system) throw new Error("Cannot delete system roles");
    this.setStorage('nexus_roles', roles.filter(r => r.id !== id));
    if (role) this.logAction('ROLE_DELETE', `Deleted role: ${role.name}.`);
  }

  // --- Settings ---
  async getSettings(): Promise<CompanySettings> { return this.getStorage('nexus_settings', SEED_SETTINGS); }
  async updateSettings(updates: Partial<CompanySettings>): Promise<void> {
    const current = await this.getSettings();
    this.setStorage('nexus_settings', { ...current, ...updates });
    this.logAction('SETTINGS_UPDATE', `Updated company settings.`);
  }

  async getCurrencies(): Promise<Currency[]> { return this.getStorage('nexus_currencies', SEED_CURRENCIES); }
  
  async addCurrency(curr: Currency): Promise<Currency> {
    const list = await this.getCurrencies();
    const newCurr = { ...curr, id: `curr_${Date.now()}` };
    this.setStorage('nexus_currencies', [...list, newCurr]);
    this.logAction('CURRENCY_CREATE', `Added currency: ${curr.code}.`);
    return newCurr;
  }

  async deleteCurrency(id: string): Promise<void> {
      const list = await this.getCurrencies();
      const curr = list.find(c => c.id === id);
      if (curr?.is_default) throw new Error("Cannot delete the default currency.");
      this.setStorage('nexus_currencies', list.filter(c => c.id !== id));
      if (curr) this.logAction('CURRENCY_DELETE', `Deleted currency: ${curr.code}.`);
  }

  async getOutlets(): Promise<Outlet[]> { return this.getStorage('nexus_outlets', SEED_OUTLETS); }
  async addOutlet(name: string): Promise<Outlet> {
    const list = await this.getOutlets();
    const newOutlet = { id: `out_${Date.now()}`, name };
    this.setStorage('nexus_outlets', [...list, newOutlet]);
    this.logAction('OUTLET_CREATE', `Created facility outlet: ${name}.`);
    return newOutlet;
  }
  async deleteOutlet(id: string): Promise<void> {
      const list = await this.getOutlets();
      const outlet = list.find(o => o.id === id);
      if (list.length <= 1) throw new Error("Cannot delete the last outlet.");
      this.setStorage('nexus_outlets', list.filter(o => o.id !== id));
      if (outlet) this.logAction('OUTLET_DELETE', `Deleted facility outlet: ${outlet.name}.`);
  }

  // --- Categories ---
  async getCategories(outletId?: string): Promise<MembershipCategory[]> { 
      const all = this.getStorage<MembershipCategory[]>('nexus_categories', []);
      if (!outletId) return all;
      return all.filter(c => c.outlet_id === outletId || !c.outlet_id);
  }
  async addCategory(cat: Omit<MembershipCategory, 'id'>): Promise<MembershipCategory> {
    const newCat = { ...cat, id: `cat_${Date.now()}` };
    const all = this.getStorage<MembershipCategory[]>('nexus_categories', []);
    this.setStorage('nexus_categories', [...all, newCat]);
    this.logAction('CATEGORY_CREATE', `Created category ${cat.name} (${cat.duration_months}mo).`, cat.outlet_id);
    return newCat;
  }
  async updateCategory(id: string, updates: Partial<MembershipCategory>): Promise<void> {
    const all = this.getStorage<MembershipCategory[]>('nexus_categories', []);
    const idx = all.findIndex(c => c.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...updates };
      this.setStorage('nexus_categories', all);
      this.logAction('CATEGORY_UPDATE', `Updated category ${all[idx].name}.`, all[idx].outlet_id);
    }
  }
  async deleteCategory(id: string): Promise<void> {
     const all = this.getStorage<MembershipCategory[]>('nexus_categories', []);
     const cat = all.find(c => c.id === id);
     this.setStorage('nexus_categories', all.filter(c => c.id !== id));
     if (cat) this.logAction('CATEGORY_DELETE', `Deleted category ${cat.name}.`, cat.outlet_id);
  }

  // --- Members ---
  async getMembers(outletId?: string): Promise<Member[]> { 
      const all = this.getStorage<Member[]>('nexus_members', []);
      if (!outletId) return all;
      return all.filter(m => m.outlet_id === outletId || !m.outlet_id);
  }
  async addMember(member: Member): Promise<Member> {
    const members = await this.getStorage<Member[]>('nexus_members', []);
    this.setStorage('nexus_members', [member, ...members]);
    this.logAction('MEMBER_CREATE', `Registered member ${member.guest_name} (#${member.membership_number}).`, member.outlet_id);
    return member;
  }
  async updateMember(id: string, updates: Partial<Member>): Promise<void> {
    const members = this.getStorage<Member[]>('nexus_members', []);
    const idx = members.findIndex(m => m.id === id);
    if (idx !== -1) {
      members[idx] = { ...members[idx], ...updates };
      this.setStorage('nexus_members', members);
      this.logAction('MEMBER_UPDATE', `Updated details for ${members[idx].guest_name}.`, members[idx].outlet_id);
    }
  }
  async deleteMember(id: string): Promise<void> {
      const members = this.getStorage<Member[]>('nexus_members', []);
      const member = members.find(m => m.id === id);
      this.setStorage('nexus_members', members.filter(m => m.id !== id));
      if (member) this.logAction('MEMBER_DELETE', `Deleted member ${member.guest_name}.`, member.outlet_id);
  }

  async getFreezes(memberId?: string): Promise<Freeze[]> {
    const freezes = this.getStorage<Freeze[]>('nexus_freezes', []);
    if (memberId) return freezes.filter(f => f.member_id === memberId);
    return freezes;
  }
  async addFreeze(freeze: Freeze): Promise<void> {
    const freezes = await this.getFreezes();
    this.setStorage('nexus_freezes', [...freezes, freeze]);
    
    const members = await this.getMembers(); 
    const member = members.find(m => m.id === freeze.member_id);
    if (member) {
        const newEndDate = addDays(parseISO(member.current_end_date), freeze.total_days);
        await this.updateMember(member.id, { 
            current_end_date: format(newEndDate, 'yyyy-MM-dd'),
            status: MemberStatus.FROZEN
        });
        this.logAction('MEMBER_FREEZE', `Applied ${freeze.total_days} day freeze to ${member.guest_name}.`, member.outlet_id);
    }
  }
}

export const db = new MockSupabaseService();
