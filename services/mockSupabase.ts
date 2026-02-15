
import { UserProfile, Role, Currency, CompanySettings, Member, MembershipCategory, Freeze, MemberStatus, Outlet, Property, SystemLog, Permission, Guest, Therapist, MassageType, MassageBooking, Sale, InventoryItem } from '../types';
import { supabase, supabaseUrl, supabaseAnonKey } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { addDays, format } from 'date-fns';

const parseISO = (dateString: string) => new Date(dateString);
const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

class DatabaseService {
  private isSupabase() {
    return !!supabase;
  }

  private getShadowClient() {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  }

  private async syncMemberEndDate(memberId: string) {
    if (!this.isSupabase()) return;

    try {
        const [{ data: m, error: mErr }, { data: freezes, error: fErr }] = await Promise.all([
          supabase.from('members').select('id, original_end_date, status').eq('id', memberId).single(),
          supabase.from('freezes').select('total_days').eq('member_id', memberId)
        ]);

        if (mErr || !m) return;

        const totalDeferred = (freezes || []).reduce((sum, f) => sum + (Number(f.total_days) || 0), 0);
        const baselineDate = startOfDay(parseISO(m.original_end_date));
        const calculatedEndDate = addDays(baselineDate, totalDeferred);
        const newEndDateStr = format(calculatedEndDate, 'yyyy-MM-dd');
        const newStatus = totalDeferred > 0 ? MemberStatus.FROZEN : MemberStatus.ACTIVE;

        await supabase
            .from('members')
            .update({ status: newStatus, current_end_date: newEndDateStr })
            .eq('id', memberId);

        return newEndDateStr;
    } catch (err) {
        console.error("Critical Revenue Recalculation Failure:", err);
    }
  }

  async logAction(action: string, details: string, outlet_id?: string) {
    const sessionStr = sessionStorage.getItem('membership_session');
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
        } catch (e) {
          console.error("Log Error:", e);
        }
    }
  }

  async syncAuthMetadata(profile: UserProfile) {
    if (!this.isSupabase()) return;
    const { data: { user } } = await (supabase.auth as any).getUser();
    if (!user) return;
    const metaName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.display_name;
    if (profile.name !== metaName) {
      await (supabase.auth as any).updateUser({
        data: { full_name: profile.name, display_name: profile.name, name: profile.name }
      });
    }
  }

  async login(email: string, passwordAttempt: string): Promise<{ user: UserProfile | null, error: string | null, requiresPasswordChange: boolean }> {
    if (!this.isSupabase()) return { user: null, error: "Cloud sync offline.", requiresPasswordChange: false };
    const cleanEmail = email.trim().toLowerCase();
    const { data: profile } = await supabase.from('profiles').select('*').eq('email', cleanEmail).maybeSingle();

    const { data: authData, error: authError } = await (supabase.auth as any).signInWithPassword({
        email: cleanEmail,
        password: passwordAttempt
    });

    if (authError || (profile && !profile.auth_id)) {
        if (profile && profile.temp_password === passwordAttempt) {
            const { data: signUpData, error: signUpError } = await (supabase.auth as any).signUp({
                email: cleanEmail,
                password: passwordAttempt,
                options: { data: { full_name: profile.name, display_name: profile.name, name: profile.name } }
            });

            if (signUpError) return { user: null, error: signUpError.message, requiresPasswordChange: false };

            if (signUpData.user) {
              await supabase.from('profiles').update({ auth_id: signUpData.user.id }).eq('id', profile.id);
              const { data: refreshed } = await supabase.from('profiles').select('*').eq('id', profile.id).single();
              await this.logAction('AUTH_SIGNUP', `Identity provisioned for ${profile.email}`);
              return { user: refreshed, error: null, requiresPasswordChange: true };
            }
        }
        return { user: null, error: authError?.message || "Invalid credentials.", requiresPasswordChange: false };
    }

    if (authData.user && profile) {
        if (!profile.auth_id || profile.auth_id !== authData.user.id) {
          await supabase.from('profiles').update({ auth_id: authData.user.id }).eq('id', profile.id);
        }
        await this.syncAuthMetadata(profile);
        await this.logAction('AUTH_LOGIN', `Access authorized for ${profile.email}`);
        return { user: profile, error: null, requiresPasswordChange: !!profile.temp_password };
    }

    return { user: null, error: "Identity profile not found.", requiresPasswordChange: false };
  }

  async addUser(user: Omit<UserProfile, 'id'> & { password?: string }): Promise<UserProfile> {
    const cleanEmail = user.email.trim().toLowerCase();
    let authId: string | null = null;
    let tempPassword: string | null = user.password || 'Temporary123!';
    
    if (this.isSupabase()) {
        const shadow = this.getShadowClient();
        const { data: authData } = await (shadow.auth as any).signUp({
            email: cleanEmail,
            password: tempPassword,
            options: { data: { full_name: user.name, name: user.name, display_name: user.name } }
        });

        if (authData?.user) authId = authData.user.id;

        const { data, error } = await supabase
            .from('profiles')
            .upsert([{
                email: cleanEmail,
                name: user.name,
                role_id: user.role_id,
                allowed_outlets: user.allowed_outlets || [],
                temp_password: tempPassword,
                auth_id: authId,
                updated_at: new Date().toISOString()
            }], { onConflict: 'email' })
            .select()
            .single();

        if (error) throw error;
        await this.logAction('CREATE_USER', `Identity provisioned: ${user.name} (${user.email})`);
        return data as UserProfile;
    }
    return { ...user, id: crypto.randomUUID() } as UserProfile;
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
        if (!current.auth_id && updates.password) finalUpdates.temp_password = updates.password;
        Object.keys(finalUpdates).forEach(k => finalUpdates[k] === undefined && delete finalUpdates[k]);
        await supabase.from('profiles').update(finalUpdates).eq('id', id);
        await this.logAction('UPDATE_USER', `Identity modified for ${current.name} (${current.email})`);
    }
  }

  async updateEmail(newEmail: string) {
      if (this.isSupabase()) {
          await (supabase.auth as any).updateUser({ email: newEmail });
      }
  }

  async changePassword(userId: string, currentPass: string, newPass: string) {
    if (this.isSupabase()) {
        await (supabase.auth as any).updateUser({ password: newPass });
        await supabase.from('profiles').update({ temp_password: null }).eq('id', userId);
        await this.logAction('CHANGE_PASSWORD', `Credentials updated for user ID: ${userId}`);
    }
  }

  async signUp(email: string, passwordAttempt: string, name: string): Promise<{ user: UserProfile | null, error: string | null }> {
    const { data: authData, error: authError } = await (supabase.auth as any).signUp({ 
        email, password: passwordAttempt, options: { data: { name, full_name: name, display_name: name } } 
    });
    if (authError) return { user: null, error: authError.message };
    if (authData.user) {
      const newUser = { id: crypto.randomUUID(), auth_id: authData.user.id, email, name, role_id: 'member', allowed_outlets: [] };
      await supabase.from('profiles').insert([newUser]);
      return { user: newUser as UserProfile, error: null };
    }
    return { user: null, error: 'Registration failed' };
  }

  async getUsers(): Promise<UserProfile[]> {
    if (this.isSupabase()) {
      const { data } = await supabase.from('profiles').select('*');
      return (data || []) as UserProfile[];
    }
    return [];
  }

  async deleteUser(id: string) {
    if (this.isSupabase()) await supabase.from('profiles').delete().eq('id', id);
  }

  async getMembers(outletId?: string): Promise<Member[]> {
    if (this.isSupabase()) {
      let query = supabase.from('members').select('*');
      if (outletId) query = query.eq('outlet_id', outletId);
      const { data } = await query;
      return (data || []) as Member[];
    }
    return [];
  }

  async getMemberHistory(membershipNumber: string): Promise<Member[]> {
    if (this.isSupabase()) {
        const { data } = await supabase
            .from('members')
            .select('*')
            .eq('membership_number', membershipNumber)
            .order('start_date', { ascending: false });
        return (data || []) as Member[];
    }
    return [];
  }

  async addMember(member: Member) {
    if (this.isSupabase()) {
      await supabase.from('members').insert([member]);
      await this.logAction('CREATE_MEMBER', `New enrollment: ${member.guest_name} (${member.membership_number})`, member.outlet_id);
    }
  }

  async updateMember(id: string, member: Partial<Member>) {
    if (this.isSupabase()) {
      await supabase.from('members').update(member).eq('id', id);
      await this.logAction('UPDATE_MEMBER', `Profile update: ${member.guest_name || id}`, member.outlet_id);
    }
  }

  async deleteMember(id: string) {
    if (this.isSupabase()) {
      await supabase.from('members').delete().eq('id', id);
      await this.logAction('DELETE_MEMBER', `Record purged: ${id}`);
    }
  }

  async getFreezes(memberId?: string): Promise<Freeze[]> {
    if (this.isSupabase()) {
      let query = supabase.from('freezes').select('*');
      if (memberId) query = query.eq('member_id', memberId);
      const { data } = await query;
      return (data || []) as Freeze[];
    }
    return [];
  }

  async addFreeze(freeze: Freeze) {
    if (this.isSupabase()) {
      await supabase.from('freezes').insert([freeze]);
      await this.syncMemberEndDate(freeze.member_id);
      await this.logAction('CREATE_FREEZE', `Account suspension applied for member ID: ${freeze.member_id}`);
    }
  }

  async updateFreeze(id: string, updates: Partial<Freeze>) {
    if (this.isSupabase()) {
      const { data: f } = await supabase.from('freezes').select('member_id').eq('id', id).single();
      await supabase.from('freezes').update(updates).eq('id', id);
      if (f) await this.syncMemberEndDate(f.member_id);
      await this.logAction('UPDATE_FREEZE', `Suspension record adjusted: ${id}`);
    }
  }

  async deleteFreeze(id: string) {
    if (this.isSupabase()) {
      const { data: f } = await supabase.from('freezes').select('member_id').eq('id', id).single();
      await supabase.from('freezes').delete().eq('id', id);
      if (f) await this.syncMemberEndDate(f.member_id);
      await this.logAction('DELETE_FREEZE', `Suspension record revoked: ${id}`);
    }
  }

  async getCategories(outletId: string): Promise<MembershipCategory[]> {
    if (this.isSupabase()) {
      const { data } = await supabase.from('membership_categories').select('*').eq('outlet_id', outletId);
      return (data || []) as MembershipCategory[];
    }
    return [];
  }

  async addCategory(cat: Omit<MembershipCategory, 'id'>) {
    if (this.isSupabase()) {
      const newCat = { ...cat, id: `cat_${crypto.randomUUID()}` };
      await supabase.from('membership_categories').insert([newCat]);
      await this.logAction('CREATE_CATEGORY', `New tier created: ${cat.name}`, cat.outlet_id);
    }
  }

  async updateCategory(id: string, updates: Partial<MembershipCategory>) {
    if (this.isSupabase()) {
      await supabase.from('membership_categories').update(updates).eq('id', id);
      await this.logAction('UPDATE_CATEGORY', `Tier modified: ${id}`);
    }
  }

  async deleteCategory(id: string) {
    if (this.isSupabase()) {
      await supabase.from('membership_categories').delete().eq('id', id);
      await this.logAction('DELETE_CATEGORY', `Tier decommissioned: ${id}`);
    }
  }

  async getSettings(): Promise<CompanySettings> {
    const defaultSettings: CompanySettings = { name: 'The Torch Hospitality', logo_url: '', address: '', currency_id: 'default' };
    if (this.isSupabase()) {
      try {
        const { data } = await supabase.from('company_settings').select('*').eq('id', 'global').maybeSingle();
        return (data as CompanySettings) || defaultSettings;
      } catch (e) { return defaultSettings; }
    }
    return defaultSettings;
  }

  async updateSettings(settings: CompanySettings) {
    if (this.isSupabase()) {
      await supabase.from('company_settings').update(settings).eq('id', 'global');
      await this.logAction('UPDATE_SETTINGS', 'Global system configuration mutated.');
    }
  }

  async getCurrencies(): Promise<Currency[]> {
    if (this.isSupabase()) {
      const { data } = await supabase.from('currencies').select('*');
      return (data || []) as Currency[];
    }
    return [];
  }

  async addCurrency(curr: Omit<Currency, 'id'>) {
    if (this.isSupabase()) {
      await supabase.from('currencies').insert([{ ...curr, id: crypto.randomUUID() }]);
      await this.logAction('CREATE_CURRENCY', `Monetary standard added: ${curr.code}`);
    }
  }

  async updateCurrency(id: string, updates: Partial<Currency>) {
    if (this.isSupabase()) {
      await supabase.from('currencies').update(updates).eq('id', id);
      await this.logAction('UPDATE_CURRENCY', `Monetary standard modified: ${id}`);
    }
  }

  async deleteCurrency(id: string) {
    if (this.isSupabase()) {
      await supabase.from('currencies').delete().eq('id', id);
      await this.logAction('DELETE_CURRENCY', `Monetary standard purged: ${id}`);
    }
  }

  async getRoles(): Promise<Role[]> {
    if (this.isSupabase()) {
      const { data } = await supabase.from('roles').select('*');
      return (data || []) as Role[];
    }
    return [];
  }

  async addRole(role: Omit<Role, 'id'>) {
    if (this.isSupabase()) {
      await supabase.from('roles').insert([{ ...role, id: role.name.toLowerCase().replace(/\s+/g, '_') }]);
      await this.logAction('CREATE_ROLE', `Security protocol tier created: ${role.name}`);
    }
  }

  async updateRole(id: string, updates: Partial<Role>) {
    if (this.isSupabase()) {
      await supabase.from('roles').update(updates).eq('id', id);
      await this.logAction('UPDATE_ROLE', `Security protocol adjusted: ${id}`);
    }
  }

  async deleteRole(id: string) {
    if (this.isSupabase()) {
      await supabase.from('roles').delete().eq('id', id);
      await this.logAction('DELETE_ROLE', `Security protocol purged: ${id}`);
    }
  }

  async getOutlets(): Promise<Outlet[]> {
    if (this.isSupabase()) {
      const { data } = await supabase.from('outlets').select('*');
      return (data || []) as Outlet[];
    }
    return [];
  }

  async addOutlet(outlet: Omit<Outlet, 'id'>) {
    if (this.isSupabase()) {
      await supabase.from('outlets').insert([{ ...outlet, id: crypto.randomUUID() }]);
      await this.logAction('CREATE_OUTLET', `Facility context commissioned: ${outlet.name}`);
    }
  }

  async updateOutlet(id: string, updates: Partial<Outlet>) {
    if (this.isSupabase()) {
      await supabase.from('outlets').update(updates).eq('id', id);
      await this.logAction('UPDATE_OUTLET', `Facility context modified: ${id}`);
    }
  }

  async deleteOutlet(id: string) {
    if (this.isSupabase()) {
      await supabase.from('outlets').delete().eq('id', id);
      await this.logAction('DELETE_OUTLET', `Facility context decommissioned: ${id}`);
    }
  }

  async getProperties(): Promise<Property[]> {
    if (this.isSupabase()) {
      const { data } = await supabase.from('properties').select('*');
      return (data || []) as Property[];
    }
    return [];
  }

  async addProperty(prop: Omit<Property, 'id'>) {
    if (this.isSupabase()) {
      await supabase.from('properties').insert([{ ...prop, id: crypto.randomUUID() }]);
      await this.logAction('CREATE_PROPERTY', `Property asset registered: ${prop.name}`);
    }
  }

  async updateProperty(id: string, updates: Partial<Property>) {
    if (this.isSupabase()) {
      await supabase.from('properties').update(updates).eq('id', id);
      await this.logAction('UPDATE_PROPERTY', `Property asset modified: ${id}`);
    }
  }

  async deleteProperty(id: string) {
    if (this.isSupabase()) {
      await supabase.from('properties').delete().eq('id', id);
      await this.logAction('DELETE_PROPERTY', `Property asset purged: ${id}`);
    }
  }

  async getLogs(outlet_id?: string): Promise<SystemLog[]> {
    if (this.isSupabase()) {
      let query = supabase.from('system_logs').select('*').order('timestamp', { ascending: false });
      if (outlet_id) query = query.eq('outlet_id', outlet_id);
      const { data } = await query;
      return (data || []) as SystemLog[];
    }
    return [];
  }

  // --- INVENTORY METHODS ---
  async getInventory(propertyId: string): Promise<InventoryItem[]> {
    if (this.isSupabase()) {
        const { data, error } = await supabase.from('inventory').select('*').eq('property_id', propertyId).order('name');
        if (error) throw error;
        return (data || []) as InventoryItem[];
    }
    return [];
  }

  async addInventoryItem(item: Omit<InventoryItem, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('inventory').insert([{ ...item, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
        if (error) throw error;
        await this.logAction('CREATE_INVENTORY', `Defined item: ${item.name}`);
    }
  }

  async updateInventoryItem(id: string, updates: Partial<InventoryItem>) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('inventory').update(updates).eq('id', id);
        if (error) throw error;
        await this.logAction('UPDATE_INVENTORY', `Modified item: ${id}`);
    }
  }

  async deleteInventoryItem(id: string) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('inventory').delete().eq('id', id);
        if (error) throw error;
        await this.logAction('DELETE_INVENTORY', `Removed item: ${id}`);
    }
  }

  // --- POS / SALES MODULE METHODS ---

  async getSales(propertyId: string): Promise<Sale[]> {
    if (this.isSupabase()) {
        const { data, error } = await supabase
            .from('sales')
            .select('*')
            .eq('property_id', propertyId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as Sale[];
    }
    return [];
  }

  async addSale(sale: Omit<Sale, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
        // Transactional logic for inventory tracking
        if (sale.item_id) {
            const { data: item } = await supabase.from('inventory').select('track_inventory, stock_quantity').eq('id', sale.item_id).single();
            if (item && item.track_inventory) {
                if (item.stock_quantity < sale.quantity) {
                    throw new Error(`Insufficient stock for ${sale.item_name}. Available: ${item.stock_quantity}`);
                }
                // Decrement stock
                await supabase.from('inventory').update({ stock_quantity: item.stock_quantity - sale.quantity }).eq('id', sale.item_id);
            }
        }

        const { error } = await supabase.from('sales').insert([{ ...sale, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
        if (error) throw error;
        await this.logAction('POS_SALE', `Transaction finalized: ${sale.item_name} for ${sale.guest_name}`);
    }
  }

  async deleteSale(id: string) {
    if (this.isSupabase()) {
        // Reverse inventory if necessary
        const { data: sale } = await supabase.from('sales').select('*').eq('id', id).single();
        if (sale && sale.item_id) {
            const { data: item } = await supabase.from('inventory').select('track_inventory, stock_quantity').eq('id', sale.item_id).single();
            if (item && item.track_inventory) {
                await supabase.from('inventory').update({ stock_quantity: item.stock_quantity + sale.quantity }).eq('id', sale.item_id);
            }
        }

        const { error } = await supabase.from('sales').delete().eq('id', id);
        if (error) throw error;
        await this.logAction('POS_VOID', `Transaction voided: ${id}`);
    }
  }

  // --- MASSAGE SCHEDULING MODULE METHODS (PROPERTY-BASED) ---

  async getGuests(propertyId: string): Promise<Guest[]> {
    if (this.isSupabase()) {
      const { data, error } = await supabase
        .from('guests')
        .select('*')
        .eq('property_id', propertyId)
        .order('name');
      if (error) throw error;
      return (data || []) as Guest[];
    }
    return [];
  }

  async saveGuest(guest: Omit<Guest, 'id' | 'created_at'>): Promise<Guest> {
    if (this.isSupabase()) {
      let existing: Guest | null = null;
      const { data: dataByPhone } = await supabase
        .from('guests')
        .select('*')
        .eq('phone', guest.phone)
        .eq('property_id', guest.property_id)
        .maybeSingle();
      
      if (dataByPhone) existing = dataByPhone as Guest;

      if (!existing && guest.email) {
        const { data: dataByEmail } = await supabase
          .from('guests')
          .select('*')
          .eq('email', guest.email)
          .eq('property_id', guest.property_id)
          .maybeSingle();
        if (dataByEmail) existing = dataByEmail as Guest;
      }

      if (existing) {
        const { data, error } = await supabase
          .from('guests')
          .update({ name: guest.name, email: guest.email })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        await this.logAction('SYNC_GUEST', `Guest identity synchronized: ${guest.name}`);
        return data as Guest;
      } else {
        const { data, error } = await supabase
          .from('guests')
          .insert([{ ...guest, id: crypto.randomUUID(), created_at: new Date().toISOString() }])
          .select()
          .single();
        if (error) throw error;
        await this.logAction('CREATE_GUEST', `New guest record provisioned: ${guest.name}`);
        return data as Guest;
      }
    }
    return { ...guest, id: crypto.randomUUID(), created_at: new Date().toISOString() } as Guest;
  }

  async updateGuest(id: string, updates: Partial<Guest>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('guests').update(updates).eq('id', id);
      if (error) throw error;
      await this.logAction('UPDATE_GUEST', `Guest profile modified: ${id}`);
    }
  }

  async deleteGuest(id: string) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('guests').delete().eq('id', id);
      if (error) throw error;
      await this.logAction('DELETE_GUEST', `Guest record purged: ${id}`);
    }
  }

  async getTherapists(propertyId: string): Promise<Therapist[]> {
    if (this.isSupabase()) {
      const { data, error } = await supabase.from('therapists').select('*').eq('property_id', propertyId);
      if (error) throw error;
      return (data || []) as Therapist[];
    }
    return [];
  }

  async addTherapist(therapist: Omit<Therapist, 'id'>) {
    if (this.isSupabase()) {
        console.debug("DB Service: Validating Property Reference ID", therapist.property_id);
        const { data: propExists } = await supabase.from('properties').select('id, name').eq('id', therapist.property_id).maybeSingle();
        
        if (!propExists) {
            console.error("DB Service Critical: Found orphaned ID reference for property_id", therapist.property_id);
            throw new Error(`Data Integrity Error: The target property (${therapist.property_id}) is not registered in the system. Ensure the Property is created in Settings first.`);
        }

        const { error } = await supabase.from('therapists').insert([{ ...therapist, id: crypto.randomUUID() }]);
        if (error) throw error;
        await this.logAction('CREATE_THERAPIST', `Staff specialist onboarded to ${propExists.name}: ${therapist.name}`);
    }
  }

  async deleteTherapist(id: string) {
    if (this.isSupabase()) {
        const { error = null } = await supabase.from('therapists').delete().eq('id', id);
        if (error) throw error;
        await this.logAction('DELETE_THERAPIST', `Staff specialist decommissioned: ${id}`);
    }
  }

  async getMassageTypes(propertyId?: string): Promise<MassageType[]> {
    if (this.isSupabase()) {
      let query = supabase.from('massage_types').select('*');
      if (propertyId) query = query.eq('property_id', propertyId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MassageType[];
    }
    return [];
  }

  async addMassageType(type: Omit<MassageType, 'id'>) {
    if (this.isSupabase()) {
        console.debug("DB Service: Validating Property Reference ID", type.property_id);
        const { data: propExists } = await supabase.from('properties').select('id, name').eq('id', type.property_id).maybeSingle();
        
        if (!propExists) {
            throw new Error(`Data Integrity Error: The target property (${type.property_id}) is not registered in the system.`);
        }

        const { error } = await supabase.from('massage_types').insert([{ ...type, id: crypto.randomUUID() }]);
        if (error) throw error;
        await this.logAction('CREATE_TREATMENT', `New treatment authorized for ${propExists.name}: ${type.name}`);
    }
  }

  async deleteMassageType(id: string) {
    if (this.isSupabase()) {
        const { error = null } = await supabase.from('massage_types').delete().eq('id', id);
        if (error) throw error;
        await this.logAction('DELETE_TREATMENT', `Treatment service decommissioned: ${id}`);
    }
  }

  async getMassageBookings(propertyId: string): Promise<MassageBooking[]> {
    if (this.isSupabase()) {
      const { data, error } = await supabase.from('massage_bookings').select('*').eq('property_id', propertyId).order('date', { ascending: false });
      if (error) throw error;
      return (data || []) as MassageBooking[];
    }
    return [];
  }

  async addMassageBooking(booking: Omit<MassageBooking, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('massage_bookings').insert([{ ...booking, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
      if (error) throw error;
      await this.logAction('CREATE_BOOKING', `Service reservation finalized for Guest ID: ${booking.guest_id}`);
    }
  }

  async updateMassageBooking(id: string, updates: Partial<MassageBooking>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('massage_bookings').update(updates).eq('id', id);
      if (error) throw error;
      await this.logAction('UPDATE_BOOKING', `Reservation parameters adjusted: ${id}`);
    }
  }

  async updateMassageBookingStatus(id: string, status: MassageBooking['status']) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('massage_bookings').update({ status }).eq('id', id);
      if (error) throw error;
      await this.logAction('UPDATE_BOOKING_STATUS', `Reservation lifecycle updated to ${status.toUpperCase()} for ID: ${id}`);
    }
  }
}

export const db = new DatabaseService();
