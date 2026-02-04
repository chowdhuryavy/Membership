
import { UserProfile, Role, Currency, CompanySettings, Member, MembershipCategory, Freeze, MemberStatus, Outlet, Property, SystemLog, Permission } from '../types';
import { supabase } from './supabase';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fqwfffkkaeknaqjorygy.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxd2ZmZmtrYWVrbmFxam9yeWd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4ODgxNjgsImV4cCI6MjA4NTQ2NDE2OH0.ntOUbYdxrge-0imvDduz1uA01tgHDttU5fNdxbxMm9A';

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
        try { await supabase.from('system_logs').insert([logEntry]); } catch (e) {}
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

  async login(email: string, passwordAttempt: string): Promise<{ user: UserProfile | null, error: string | null }> {
    if (!this.isSupabase()) return { user: null, error: "Cloud sync offline." };
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

            if (signUpError) {
              const msg = signUpError.message.toLowerCase();
              if (msg.includes('confirm') || msg.includes('email') || signUpError.status === 500) {
                return { 
                  user: null, 
                  error: "SUPABASE CONFIG ERROR: 'Email Confirmations' must be OFF in your Supabase Auth Settings (Dashboard) to allow password resets. Current security policy is blocking the login." 
                };
              }
              if (msg.includes('already registered')) {
                return { 
                  user: null, 
                  error: "SYNC CONFLICT: This email is already in the Auth Dashboard with a different password. Please delete the user from 'Auth -> Users' in the Supabase Dashboard and try again." 
                };
              }
              return { user: null, error: signUpError.message };
            }

            if (signUpData.user) {
              await supabase.from('profiles').update({ auth_id: signUpData.user.id, temp_password: null }).eq('id', profile.id);
              const { data: refreshed } = await supabase.from('profiles').select('*').eq('id', profile.id).single();
              return { user: refreshed, error: null };
            }
        }
        return { user: null, error: authError?.message || "Invalid credentials." };
    }

    if (authData.user && profile) {
        if (!profile.auth_id || profile.auth_id !== authData.user.id) {
          await supabase.from('profiles').update({ auth_id: authData.user.id, temp_password: null }).eq('id', profile.id);
        }
        await this.syncAuthMetadata(profile);
        return { user: profile, error: null };
    }

    return { user: null, error: "Identity server unreachable." };
  }

  async addUser(user: Omit<UserProfile, 'id'> & { password?: string }): Promise<UserProfile> {
    const cleanEmail = user.email.trim().toLowerCase();
    let authId: string | null = null;
    let tempPassword: string | null = user.password || 'Temporary123!';
    
    if (this.isSupabase()) {
        const shadow = this.getShadowClient();
        const { data: authData, error: authError } = await (shadow.auth as any).signUp({
            email: cleanEmail,
            password: tempPassword,
            options: { data: { full_name: user.name, name: user.name, display_name: user.name } }
        });

        // If user already exists in Auth, we try to get their ID if it's the same project
        if (authData?.user) {
            authId = authData.user.id;
            tempPassword = null; // Successfully created in Auth, no need for temp password
        } else if (authError?.message.includes('already registered')) {
            // User exists in Auth, we'll try to link them on their next successful login
            authId = null; 
        }

        const insertData = {
            email: cleanEmail,
            name: user.name,
            role_id: user.role_id,
            allowed_outlets: user.allowed_outlets || [],
            temp_password: tempPassword,
            auth_id: authId,
            updated_at: new Date().toISOString()
        };

        // UPSERT strategy on email to prevent unique constraint failures
        const { data, error: dbError } = await supabase
            .from('profiles')
            .upsert([insertData], { onConflict: 'email' })
            .select()
            .single();

        if (dbError) {
            console.error("Profile Upsert Error:", dbError);
            throw new Error(`Profile Sync Failed: ${dbError.message}`);
        }
        return data as UserProfile;
    }
    return { ...user, id: crypto.randomUUID() } as UserProfile;
  }

  async updateUser(id: string, updates: Partial<UserProfile> & { password?: string }) { 
    if (this.isSupabase()) {
        const { data: current } = await supabase.from('profiles').select('email, auth_id').eq('id', id).single();
        const finalUpdates: any = { 
            name: updates.name,
            email: updates.email?.trim().toLowerCase(),
            role_id: updates.role_id,
            allowed_outlets: updates.allowed_outlets,
            updated_at: new Date().toISOString()
        };

        if (updates.password || (updates.email && updates.email !== current.email)) {
            finalUpdates.auth_id = null;
            if (updates.password) finalUpdates.temp_password = updates.password;
        }

        Object.keys(finalUpdates).forEach(k => finalUpdates[k] === undefined && delete finalUpdates[k]);
        const { error } = await supabase.from('profiles').update(finalUpdates).eq('id', id);
        if (error) throw new Error(error.message);
    }
  }

  async signUp(email: string, passwordAttempt: string, name: string): Promise<{ user: UserProfile | null, error: string | null }> {
    const { data: authData, error: authError } = await (supabase.auth as any).signUp({ 
        email, password: passwordAttempt, options: { data: { name, full_name: name, display_name: name } } 
    });
    if (authError) return { user: null, error: authError.message };
    if (authData.user) {
      const newUser = { id: crypto.randomUUID(), auth_id: authData.user.id, email, name, role_id: 'viewer', allowed_outlets: [] };
      await supabase.from('profiles').insert([newUser]);
      return { user: newUser as any, error: null };
    }
    return { user: null, error: "Provisioning failed." };
  }

  async getSettings(): Promise<CompanySettings> { if (this.isSupabase()) { const { data } = await supabase.from('company_settings').select('*').eq('id', 'global').maybeSingle(); if (data && data.name) return data; } return { name: 'The Torch Hospitality', logo_url: '', address: '', currency_id: 'default' }; }
  async getRoles(): Promise<Role[]> { if (this.isSupabase()) { const { data } = await supabase.from('roles').select('*'); if (data && data.length > 0) return data; } return [{ id: 'admin', name: 'Administrator', permissions: ['members:view', 'members:create', 'members:edit', 'members:delete', 'categories:view', 'categories:create', 'categories:edit', 'categories:delete', 'users:view', 'users:create', 'users:edit', 'users:delete', 'settings:view', 'settings:edit', 'reports:view', 'reports:export', 'logs:view', 'properties:view', 'properties:edit', 'outlets:view', 'outlets:edit'], is_system: true }]; }
  async deleteUser(id: string) { if (this.isSupabase()) await supabase.from('profiles').delete().eq('id', id); }
  async addProperty(prop: Omit<Property, 'id'>): Promise<Property> { const id = crypto.randomUUID(); if (this.isSupabase()) { const { error } = await supabase.from('properties').insert([{ ...prop, id }]); if (error) throw new Error(error.message); } return { ...prop, id }; }
  async updateProperty(id: string, updates: Partial<Property>) { if (this.isSupabase()) { const { error } = await supabase.from('properties').update(updates).eq('id', id); if (error) throw new Error(error.message); } }
  async deleteProperty(id: string) { if (this.isSupabase()) await supabase.from('properties').delete().eq('id', id); }
  async addOutlet(name: string, propertyId: string): Promise<Outlet> { const id = crypto.randomUUID(); if (this.isSupabase()) { const { error } = await supabase.from('outlets').insert([{ id, name, property_id: propertyId }]); if (error) throw new Error(error.message); } return { id, name, property_id: propertyId }; }
  async updateOutlet(id: string, updates: Partial<Outlet>) { if (this.isSupabase()) { const { error } = await supabase.from('outlets').update(updates).eq('id', id); if (error) throw new Error(error.message); } }
  async deleteOutlet(id: string) { if (this.isSupabase()) await supabase.from('outlets').delete().eq('id', id); }
  async addCategory(cat: Omit<MembershipCategory, 'id'>): Promise<MembershipCategory> { const id = crypto.randomUUID(); if (this.isSupabase()) { const { error } = await supabase.from('membership_categories').insert([{ ...cat, id }]); if (error) throw new Error(error.message); } return { ...cat, id }; }
  async updateCategory(id: string, updates: Partial<MembershipCategory>) { if (this.isSupabase()) { const { error } = await supabase.from('membership_categories').update(updates).eq('id', id); if (error) throw new Error(error.message); } }
  async deleteCategory(id: string) { if (this.isSupabase()) await supabase.from('membership_categories').delete().eq('id', id); }
  async addMember(member: Member): Promise<Member> { if (this.isSupabase()) { const { error } = await supabase.from('members').insert([member]); if (error) throw new Error(error.message); } return member; }
  async updateMember(id: string, updates: Partial<Member>) { if (this.isSupabase()) { const { error } = await supabase.from('members').update(updates).eq('id', id); if (error) throw new Error(error.message); } }
  async deleteMember(id: string) { if (this.isSupabase()) await supabase.from('members').delete().eq('id', id); }
  async addFreeze(freeze: Freeze): Promise<void> { if (this.isSupabase()) { const { error: fzErr } = await supabase.from('freezes').insert([freeze]); if (fzErr) throw new Error(fzErr.message); await supabase.from('members').update({ status: MemberStatus.FROZEN }).eq('id', freeze.member_id); } }
  async updateSettings(updates: Partial<CompanySettings>): Promise<void> { if (this.isSupabase()) { const { error } = await supabase.from('company_settings').upsert({ id: 'global', ...updates }); if (error) throw new Error(error.message); } }
  
  async addCurrency(curr: Omit<Currency, 'id'>): Promise<Currency> { 
    const id = crypto.randomUUID(); 
    if (this.isSupabase()) { 
        if (curr.is_default) {
            await supabase.from('currencies').update({ is_default: false }).neq('id', id);
        }
        const { error } = await supabase.from('currencies').insert([{ ...curr, id }]); 
        if (error) throw new Error(error.message); 
    } 
    return { ...curr, id }; 
  }

  async updateCurrency(id: string, updates: Partial<Currency>) { 
    if (this.isSupabase()) { 
        if (updates.is_default) {
            await supabase.from('currencies').update({ is_default: false }).neq('id', id);
        }
        const { id: _, ...cleanUpdates } = updates as any;
        const { error } = await supabase.from('currencies').update(cleanUpdates).eq('id', id); 
        if (error) throw new Error(error.message); 
    } 
  }

  async deleteCurrency(id: string) { if (this.isSupabase()) await supabase.from('currencies').delete().eq('id', id); }

  async addRole(role: Omit<Role, 'id'>) { const id = crypto.randomUUID(); if (this.isSupabase()) { const { error } = await supabase.from('roles').insert([{ ...role, id }]); if (error) throw new Error(error.message); } return { ...role, id } as Role; }
  async updateRole(id: string, updates: Partial<Role>) { if (this.isSupabase()) { const { error } = await supabase.from('roles').update(updates).eq('id', id); if (error) throw new Error(error.message); } }
  async deleteRole(id: string) { if (this.isSupabase()) await supabase.from('roles').delete().eq('id', id); }

  async changePassword(userId: string, cur: string, n: string) { if (this.isSupabase()) { const { error } = await (supabase.auth as any).updateUser({ password: n }); if (error) throw new Error(error.message); } }
  async getCurrencies(): Promise<Currency[]> { if (this.isSupabase()) { const { data } = await supabase.from('currencies').select('*'); if (data && data.length > 0) return data; } return [{ id: 'default', code: 'USD', symbol: '$', rate: 1, is_default: true }]; }
  async getProperties(): Promise<Property[]> { if (this.isSupabase()) { const { data } = await supabase.from('properties').select('*'); if (data && data.length > 0) return data; } return []; }
  async getOutlets(): Promise<Outlet[]> { if (this.isSupabase()) { const { data } = await supabase.from('outlets').select('*'); if (data && data.length > 0) return data; } return []; }
  async getCategories(outletId?: string): Promise<MembershipCategory[]> { if (this.isSupabase()) { let q = supabase.from('membership_categories').select('*'); if (outletId) q = q.eq('outlet_id', outletId); const { data } = await q; if (data) return data; } return []; }
  async getMembers(outletId?: string): Promise<Member[]> { if (this.isSupabase()) { let q = supabase.from('members').select('*'); if (outletId) q = q.eq('outlet_id', outletId); const { data } = await q; if (data) return data; } return []; }
  async getFreezes(memberId?: string): Promise<Freeze[]> { if (this.isSupabase()) { let q = supabase.from('freezes').select('*'); if (memberId) q = q.eq('member_id', memberId); const { data } = await q; if (data) return data; } return []; }
  async getUsers(): Promise<UserProfile[]> { if (this.isSupabase()) { const { data } = await supabase.from('profiles').select('*').order('name'); if (data) return data; } return []; }
  async getLogs(outletId?: string): Promise<SystemLog[]> { if (this.isSupabase()) { let q = supabase.from('system_logs').select('*').order('timestamp', { ascending: false }).limit(2000); if (outletId) q = q.eq('outlet_id', outletId); const { data } = await q; return data || []; } return []; }
}

export const db = new DatabaseService();
