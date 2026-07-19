import { UserProfile, Role, Currency, CompanySettings, Member, MembershipCategory, Freeze, MemberStatus, Outlet, Property, SystemLog, Permission, Guest, Therapist, MassageType, MassageBooking, Sale, SaleCategory, InventoryItem, IncentiveRule, Staff, UserPermissionOverride, PermissionGroup, StaffLeave, InventoryLog, MassageRoom, MembershipType, ReportRecipient, Notification, CustomReportConfig } from '../types';
import { supabase, supabaseUrl, supabaseAnonKey } from './supabase';
import { createClient } from '@supabase/supabase-js';
import { addDays, format, parse, differenceInCalendarDays } from 'date-fns';

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const safeStorage = {
  getItem(key: string): string | null {
    try { return localStorage.getItem(key); } catch(e) { return null; }
  },
  setItem(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch(e) {}
  },
  removeItem(key: string): void {
    try { localStorage.removeItem(key); } catch(e) {}
  }
};

// Robust date parsing for the Intelligence Engine
const parseISO = (dateString: string) => {
  if (!dateString) return new Date();
  // Try ISO first
  let d = new Date(dateString);
  if (!isNaN(d.getTime())) return d;
  // Try DD-MM-YYYY (common in manual imports)
  try {
    return parse(dateString, 'dd-MM-yyyy', new Date());
  } catch (e) {
    return new Date();
  }
};

const startOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const safeParseJSON = <T>(str: string | null, fallback: T): T => {
  if (!str) return fallback;
  try {
    return JSON.parse(str) as T;
  } catch (e) {
    console.warn("Failed to parse JSON string from local storage:", str, e);
    return fallback;
  }
};

class DatabaseService {
  private static _supabaseFailed = false;
  private static _supabaseFailures = 0;
  private static _lastFailureTime = 0;

  private static get supabaseFailed(): boolean {
    return this._supabaseFailed;
  }
  private static set supabaseFailed(val: boolean) {
    this._supabaseFailed = val;
  }

  private static get supabaseFailures(): number {
    return this._supabaseFailures;
  }
  private static set supabaseFailures(val: number) {
    this._supabaseFailures = val;
  }

  private static get lastFailureTime(): number {
    return this._lastFailureTime;
  }
  private static set lastFailureTime(val: number) {
    this._lastFailureTime = val;
  }

  constructor() {
    // Clear any stale persistent offline failure states from previous versions
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('supabase_failed_state');
        localStorage.removeItem('supabase_failures_count');
        localStorage.removeItem('supabase_last_failure_time');
      } catch (e) {}
    }
    this.ensureLocalSeeds();
  }

  private ensureLocalSeeds() {
    if (typeof window === 'undefined') return;

    // 1. Outlets
    if (!safeStorage.getItem('company_outlets_cache')) {
      const defaultOutlets: Outlet[] = [
        { id: 'default-outlet', property_id: 'default-prop', name: 'Perfection Gym & Wellness', logo_url: 'https://i.imgur.com/oZVRrvo.png', freeze_notification_emails: '' }
      ];
      safeStorage.setItem('company_outlets_cache', JSON.stringify(defaultOutlets));
    }

    // 2. Properties
    if (!safeStorage.getItem('company_properties_cache')) {
      const defaultProperties: Property[] = [
        { id: 'default-prop', name: 'Perfection Wellness Group', logo_url: 'https://i.imgur.com/oZVRrvo.png', address: '100 Perfection Way, Wellness Estate' }
      ];
      safeStorage.setItem('company_properties_cache', JSON.stringify(defaultProperties));
    }

    // 3. Categories/Tiers
    if (!safeStorage.getItem('membership_categories')) {
      const defaultCategories: MembershipCategory[] = [
        {
          id: 'cat_annual_premium',
          outlet_id: 'default-outlet',
          name: 'Annual Premium Elite',
          duration_months: 12,
          base_rate: 1200,
          max_freeze_days: 60,
          privileges: [
            { id: 'priv_spa_session', name: 'Spa Sessions', quantity: 12 },
            { id: 'priv_pt_session', name: 'Personal Training', quantity: 6 },
            { id: 'priv_guest_pass', name: 'Guest Passes', quantity: 24 }
          ]
        },
        {
          id: 'cat_monthly_unlimited',
          outlet_id: 'default-outlet',
          name: 'Monthly Unlimited Access',
          duration_months: 1,
          base_rate: 150,
          max_freeze_days: 5,
          privileges: [
            { id: 'priv_spa_session', name: 'Spa Sessions', quantity: 1 },
            { id: 'priv_guest_pass', name: 'Guest Passes', quantity: 2 }
          ]
        },
        {
          id: 'cat_six_month_core',
          outlet_id: 'default-outlet',
          name: '6-Month Core Wellness',
          duration_months: 6,
          base_rate: 750,
          max_freeze_days: 30,
          privileges: [
            { id: 'priv_spa_session', name: 'Spa Sessions', quantity: 6 },
            { id: 'priv_pt_session', name: 'Personal Training', quantity: 2 },
            { id: 'priv_guest_pass', name: 'Guest Passes', quantity: 10 }
          ]
        }
      ];
      safeStorage.setItem('membership_categories', JSON.stringify(defaultCategories));
    }

    // 4. Membership Types
    if (!safeStorage.getItem('membership_types')) {
      const defaultMembershipTypes: MembershipType[] = [
        { id: 'type_all_access', outlet_id: 'default-outlet', name: 'All-Access Elite Membership', created_at: '2026-01-01T00:00:00Z' },
        { id: 'type_spa_only', outlet_id: 'default-outlet', name: 'Spa & Wellness Only', created_at: '2026-01-01T00:00:00Z' },
        { id: 'type_fitness_only', outlet_id: 'default-outlet', name: 'Fitness & Gym Only', created_at: '2026-01-01T00:00:00Z' }
      ];
      safeStorage.setItem('membership_types', JSON.stringify(defaultMembershipTypes));
    }

    // 5. Members
    if (!safeStorage.getItem('membership_members')) {
      const defaultMembers: Member[] = [
        {
          id: 'member_1',
          outlet_id: 'default-outlet',
          membership_type_id: 'type_all_access',
          membership_number: 'PERF-2026-0001',
          guest_name: 'Alexander Mercer',
          category_id: 'cat_annual_premium',
          start_date: '2026-01-01',
          original_end_date: '2026-12-31',
          current_end_date: '2026-12-31',
          actual_rate: 1200,
          discount: 100,
          net_amount: 1100,
          daily_rate: 3.01,
          status: MemberStatus.ACTIVE,
          email: 'alex.mercer@example.com',
          phone: '+1 555-0199',
          nationality: 'American',
          dob: '1988-04-12',
          package_type: 'Single',
          access_type: 'Both',
          membership_type: 'New',
          created_at: '2026-01-01T10:00:00Z',
          privilege_usage: [
            { privilege: 'Spa Sessions', used_count: 3 },
            { privilege: 'Personal Training', used_count: 2 },
            { privilege: 'Guest Passes', used_count: 5 }
          ]
        },
        {
          id: 'member_2',
          outlet_id: 'default-outlet',
          membership_type_id: 'type_fitness_only',
          membership_number: 'PERF-2026-0002',
          guest_name: 'Seraphina Vance',
          category_id: 'cat_monthly_unlimited',
          start_date: '2026-07-01',
          original_end_date: '2026-07-31',
          current_end_date: '2026-08-15',
          actual_rate: 150,
          discount: 0,
          net_amount: 150,
          daily_rate: 5.0,
          status: MemberStatus.FROZEN,
          email: 'seraphina.v@example.com',
          phone: '+1 555-0144',
          nationality: 'Canadian',
          dob: '1992-09-24',
          package_type: 'Single',
          access_type: 'Pool',
          membership_type: 'New',
          created_at: '2026-07-01T09:15:00Z',
          privilege_usage: [
            { privilege: 'Spa Sessions', used_count: 0 },
            { privilege: 'Guest Passes', used_count: 1 }
          ]
        },
        {
          id: 'member_3',
          outlet_id: 'default-outlet',
          membership_type_id: 'type_spa_only',
          membership_number: 'PERF-2025-0089',
          guest_name: 'Marcus Brody',
          category_id: 'cat_monthly_unlimited',
          start_date: '2025-11-01',
          original_end_date: '2025-11-30',
          current_end_date: '2025-11-30',
          actual_rate: 150,
          discount: 20,
          net_amount: 130,
          daily_rate: 4.33,
          status: MemberStatus.EXPIRED,
          email: 'm.brody@example.com',
          phone: '+1 555-0182',
          nationality: 'British',
          dob: '1976-11-11',
          package_type: 'Single',
          access_type: 'Spa',
          membership_type: 'New',
          created_at: '2025-11-01T14:30:00Z',
          privilege_usage: [
            { privilege: 'Spa Sessions', used_count: 1 },
            { privilege: 'Guest Passes', used_count: 2 }
          ]
        },
        {
          id: 'member_4',
          outlet_id: 'default-outlet',
          membership_type_id: 'type_all_access',
          membership_number: 'PERF-2026-0042',
          guest_name: 'Elara Thorne',
          category_id: 'cat_six_month_core',
          start_date: '2026-05-10',
          original_end_date: '2026-11-10',
          current_end_date: '2026-11-10',
          actual_rate: 750,
          discount: 50,
          net_amount: 700,
          daily_rate: 3.82,
          status: MemberStatus.ACTIVE,
          email: 'elara.thorne@example.com',
          phone: '+1 555-0156',
          nationality: 'Australian',
          dob: '1995-02-02',
          package_type: 'Couple',
          spouse_name: 'Dorian Thorne',
          spouse_dob: '1994-08-14',
          access_type: 'Both',
          membership_type: 'Renew',
          created_at: '2026-05-10T11:00:00Z',
          privilege_usage: [
            { privilege: 'Spa Sessions', used_count: 2 },
            { privilege: 'Personal Training', used_count: 0 },
            { privilege: 'Guest Passes', used_count: 3 }
          ]
        }
      ];
      safeStorage.setItem('membership_members', JSON.stringify(defaultMembers));
    }

    // 6. Freezes
    if (!safeStorage.getItem('membership_freezes')) {
      const defaultFreezes: Freeze[] = [
        {
          id: 'freeze_1',
          member_id: 'member_2',
          start_date: '2026-07-10',
          end_date: '2026-07-25',
          total_days: 15,
          reason: 'Medical recovery request approved by manager.',
          is_maintenance: false,
          outlet_id: 'default-outlet'
        }
      ];
      safeStorage.setItem('membership_freezes', JSON.stringify(defaultFreezes));
    }

    // 7. Staff
    if (!safeStorage.getItem('membership_staff')) {
      const defaultStaff: Staff[] = [
        {
          id: 'staff_admin',
          property_id: 'default-prop',
          outlet_ids: ['default-outlet'],
          name: 'Management Admin',
          role: 'Admin',
          employee_number: 'EMP-001',
          email: 'chowdhuryavy@gmail.com',
          phone: '+1 555-0100',
          is_active: true,
          is_eligible_for_incentives: true,
          joining_date: '2026-01-01',
          created_at: '2026-01-01T00:00:00Z'
        },
        {
          id: 'staff_1',
          property_id: 'default-prop',
          outlet_ids: ['default-outlet'],
          name: 'Sarah Connor',
          role: 'Therapist',
          employee_number: 'EMP-002',
          email: 'sconnor@example.com',
          phone: '+1 555-0111',
          is_active: true,
          is_eligible_for_incentives: true,
          joining_date: '2026-01-01',
          created_at: '2026-01-01T00:00:00Z'
        }
      ];
      safeStorage.setItem('membership_staff', JSON.stringify(defaultStaff));
    }

    // === SELF-HEALING MULTI-OUTLET ID ALIGNMENT FOR OFFLINE COMPATIBILITY ===
    try {
      const cachedOutletsStr = safeStorage.getItem('company_outlets_cache');
      const cachedOutlets: Outlet[] = cachedOutletsStr ? JSON.parse(cachedOutletsStr) : [];
      
      if (Array.isArray(cachedOutlets) && cachedOutlets.length > 0) {
        const catsStr = safeStorage.getItem('membership_categories');
        const typesStr = safeStorage.getItem('membership_types');
        const membersStr = safeStorage.getItem('membership_members');
        const freezesStr = safeStorage.getItem('membership_freezes');
        const staffStr = safeStorage.getItem('membership_staff');

        const cats: MembershipCategory[] = catsStr ? JSON.parse(catsStr) : [];
        const types: MembershipType[] = typesStr ? JSON.parse(typesStr) : [];
        const members: Member[] = membersStr ? JSON.parse(membersStr) : [];
        const freezes: Freeze[] = freezesStr ? JSON.parse(freezesStr) : [];
        const staff: Staff[] = staffStr ? JSON.parse(staffStr) : [];

        const newCats: MembershipCategory[] = [];
        const newTypes: MembershipType[] = [];
        const newMembers: Member[] = [];
        const newFreezes: Freeze[] = [];
        const newStaff: Staff[] = [];

        const seenCatKeys = new Set<string>();
        const seenTypeKeys = new Set<string>();
        const seenMemberKeys = new Set<string>();
        const seenFreezeKeys = new Set<string>();
        const seenStaffKeys = new Set<string>();

        // We preserve user-created items (e.g. UUIDs), and duplicate/align seeded items (starting with fixed prefixes)
        cachedOutlets.forEach(outlet => {
          const oId = outlet.id;
          const pId = outlet.property_id || 'default-prop';

          // 1. Align/Duplicate categories
          cats.forEach(c => {
            if (!c) return;
            const isSeeded = c.id.startsWith('cat_');
            const newId = isSeeded ? `${c.id}_${oId}` : c.id;
            const targetOutlet = isSeeded ? oId : (c.outlet_id || oId);
            const key = `${newId}_${targetOutlet}`;
            if (!seenCatKeys.has(key)) {
              seenCatKeys.add(key);
              newCats.push({
                ...c,
                id: newId,
                outlet_id: targetOutlet
              });
            }
          });

          // 2. Align/Duplicate types
          types.forEach(t => {
            if (!t) return;
            const isSeeded = t.id.startsWith('type_');
            const newId = isSeeded ? `${t.id}_${oId}` : t.id;
            const targetOutlet = isSeeded ? oId : (t.outlet_id || oId);
            const key = `${newId}_${targetOutlet}`;
            if (!seenTypeKeys.has(key)) {
              seenTypeKeys.add(key);
              newTypes.push({
                ...t,
                id: newId,
                outlet_id: targetOutlet
              });
            }
          });

          // 3. Align/Duplicate members
          members.forEach(m => {
            if (!m) return;
            const isSeeded = m.id.startsWith('member_');
            const newId = isSeeded ? `${m.id}_${oId}` : m.id;
            const targetOutlet = isSeeded ? oId : (m.outlet_id || oId);
            const key = `${newId}_${targetOutlet}`;
            if (!seenMemberKeys.has(key)) {
              seenMemberKeys.add(key);
              
              const originalCatId = m.category_id || 'cat_annual_premium';
              const newCatId = originalCatId.startsWith('cat_') ? `${originalCatId}_${oId}` : originalCatId;
              const originalTypeId = m.membership_type_id || 'type_all_access';
              const newTypeId = originalTypeId.startsWith('type_') ? `${originalTypeId}_${oId}` : originalTypeId;

              newMembers.push({
                ...m,
                id: newId,
                outlet_id: targetOutlet,
                category_id: newCatId,
                membership_type_id: newTypeId
              });
            }
          });

          // 4. Align/Duplicate freezes
          freezes.forEach(f => {
            if (!f) return;
            const isSeeded = f.id.startsWith('freeze_');
            const newId = isSeeded ? `${f.id}_${oId}` : f.id;
            const targetOutlet = isSeeded ? oId : (f.outlet_id || oId);
            const key = `${newId}_${targetOutlet}`;
            if (!seenFreezeKeys.has(key)) {
              seenFreezeKeys.add(key);
              
              const originalMemberId = f.member_id || 'member_2';
              const newMemberId = originalMemberId.startsWith('member_') ? `${originalMemberId}_${oId}` : originalMemberId;

              newFreezes.push({
                ...f,
                id: newId,
                outlet_id: targetOutlet,
                member_id: newMemberId
              });
            }
          });

          // 5. Align/Duplicate staff
          staff.forEach(s => {
            if (!s) return;
            const isSeeded = s.id.startsWith('staff_');
            const key = `${s.id}_${oId}`;
            if (!seenStaffKeys.has(key)) {
              seenStaffKeys.add(key);
              newStaff.push({
                ...s,
                property_id: isSeeded ? pId : (s.property_id || pId),
                outlet_ids: isSeeded ? [oId] : (s.outlet_ids || [oId])
              });
            }
          });
        });

        if (newCats.length > 0) safeStorage.setItem('membership_categories', JSON.stringify(newCats));
        if (newTypes.length > 0) safeStorage.setItem('membership_types', JSON.stringify(newTypes));
        if (newMembers.length > 0) safeStorage.setItem('membership_members', JSON.stringify(newMembers));
        if (newFreezes.length > 0) safeStorage.setItem('membership_freezes', JSON.stringify(newFreezes));
        if (newStaff.length > 0) safeStorage.setItem('membership_staff', JSON.stringify(newStaff));
      }
    } catch (e) {
      console.warn("[Self-Healing] Error aligning offline IDs:", e);
    }
  }

  public isSupabase() {
    if (typeof window !== 'undefined' && localStorage.getItem('force_offline_mode') === 'true') {
      return false;
    }
    if (!supabase) return false;
    if (DatabaseService.supabaseFailed) {
      if (Date.now() - DatabaseService.lastFailureTime > 600000) { // 10 minutes cooldown for stable offline mode
        console.log("Supabase cooldown expired. Retrying database connection...");
        DatabaseService.supabaseFailed = false;
        DatabaseService.supabaseFailures = 0;
      } else {
        return false;
      }
    }
    return true;
  }

  public static getDatabaseStatus() {
    if (typeof window !== 'undefined' && localStorage.getItem('force_offline_mode') === 'true') {
      return { mode: 'forced_offline', failures: this.supabaseFailures, lastFailureTime: this.lastFailureTime };
    }
    if (!supabase) {
      return { mode: 'no_client', failures: this.supabaseFailures, lastFailureTime: this.lastFailureTime };
    }
    if (this.supabaseFailed) {
      return { mode: 'cooldown', failures: this.supabaseFailures, lastFailureTime: this.lastFailureTime };
    }
    return { mode: 'online', failures: this.supabaseFailures, lastFailureTime: this.lastFailureTime };
  }

  public static setForceOffline(force: boolean) {
    if (typeof window !== 'undefined') {
      if (force) {
        localStorage.setItem('force_offline_mode', 'true');
        this.supabaseFailed = true;
      } else {
        localStorage.removeItem('force_offline_mode');
        this.supabaseFailed = false;
        this.supabaseFailures = 0;
      }
    }
  }

  public getDatabaseStatus() {
    return DatabaseService.getDatabaseStatus();
  }

  public setForceOffline(force: boolean) {
    DatabaseService.setForceOffline(force);
  }

  public triggerSupabaseFailure() {
    DatabaseService.supabaseFailures = 2;
    DatabaseService.supabaseFailed = true;
    DatabaseService.lastFailureTime = Date.now();
  }

  private activeQueries = 0;
  private queryQueue: (() => void)[] = [];
  private MAX_CONCURRENT = 10;

  private async acquireQueueLock(): Promise<void> {
    if (this.activeQueries < this.MAX_CONCURRENT) {
        this.activeQueries++;
        return Promise.resolve();
    }
    return new Promise(resolve => {
        this.queryQueue.push(() => {
            this.activeQueries++;
            resolve();
        });
    });
  }

  private releaseQueueLock(): void {
    this.activeQueries--;
    if (this.queryQueue.length > 0) {
        const next = this.queryQueue.shift();
        if (next) next();
    }
  }

  public async safeCall<T>(call: () => Promise<T>, fallback: T): Promise<T> {
    await this.acquireQueueLock();
    try {
        let timeoutId: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Database call timeout')), 30000);
        });
        // Prevent unhandled rejection if this promise rejects after Promise.race resolves
        timeoutPromise.catch(() => {});
        
        try {
          const result = await Promise.race([call(), timeoutPromise]);
          clearTimeout(timeoutId!);
          
          // Check if Supabase SDK returned a network error instead of throwing
          if (result && typeof result === 'object' && 'error' in result && result.error) {
              const err = result.error as any;
              if (this.isNetworkError(err)) {
                  throw err;
              }
          }
          
          DatabaseService.supabaseFailures = 0;
          return result;
        } catch (e: any) {
          clearTimeout(timeoutId!);
          DatabaseService.supabaseFailures++;
          DatabaseService.lastFailureTime = Date.now();
          console.warn(`Supabase call failed or timed out (consecutive failures: ${DatabaseService.supabaseFailures})`, e);
          
          const isNetErr = this.isNetworkError(e);
          if (isNetErr || DatabaseService.supabaseFailures >= 3) {
            console.warn("Disabling Supabase temporarily (10m cooldown) due to network outage or consecutive failures");
            DatabaseService.supabaseFailed = true;
          }
          return fallback;
        }
    } finally {
        this.releaseQueueLock();
    }
  }

  private isNetworkError(e: any): boolean {
    if (!e) return false;
    let msg = '';
    let code = '';
    if (typeof e === 'string') {
       msg = e.toLowerCase();
    } else {
       msg = e.message?.toLowerCase() || e.details?.toLowerCase() || '';
       code = e.code || '';
    }
    return msg.includes('failed to fetch') || 
           msg.includes('network error') || 
           msg.includes('database not found') ||
           code === '57014' || 
           msg.includes('timeout');
  }

  private generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
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

  // --- COMPREHENSIVE PERMISSION REGISTRY ---
  getPermissionRegistry(): PermissionGroup[] {
    return [
      {
        id: 'dashboard',
        label: 'Dashboard & Intelligence',
        permissions: [
          { key: 'dashboard:view', label: 'Access Dashboard', description: 'Core entry point for operational overview.' },
          { key: 'dashboard:view_financials', label: 'Financial KPI Insights', description: 'Visibility into revenue recognition and daily accruals.' },
          { key: 'dashboard:view_insights', label: 'AI Strategic Analysis', description: 'Ability to generate Gemini-powered performance reports.' },
        ]
      },
      {
        id: 'members',
        label: 'Membership Management',
        permissions: [
          { key: 'members:view', label: 'View Ledger', description: 'Access the member directory and profiles.' },
          { key: 'members:create', label: 'New Enrollments', description: 'Permission to add new members to the registry.' },
          { key: 'members:edit', label: 'Modify Profiles', description: 'Update existing member details and tiers.' },
          { key: 'members:delete', label: 'Revoke Records', description: 'Permanently remove members from the system.' },
          { key: 'members:view_contact_info', label: 'PII Visibility', description: 'Access to sensitive data like phone numbers and emails.' },
          { key: 'members:freeze', label: 'Handle Suspensions', description: 'Authorize or cancel membership freeze periods.' },
          { key: 'members:bulk_freeze', label: 'Bulk Freeze', description: 'Authorize global holds for maintenance or holidays.' },
          { key: 'members:renew', label: 'Process Renewals', description: 'Ability to trigger re-enrollment logic.' },
          { key: 'members:print_contract', label: 'Legal Documentation', description: 'Generate and print membership agreements.' },
          { key: 'members:view_history', label: 'Audit History', description: 'View historical changes to member records.' },
        ]
      },
      {
        id: 'staff',
        label: 'Staff Roster & Operations',
        permissions: [
          { key: 'staff:view', label: 'View Personnel', description: 'Access the facility staff list and profiles.' },
          { key: 'staff:manage', label: 'Control Registry', description: 'Add, edit, or archive staff members.' },
          { key: 'staff:manage_leaves', label: 'Leave Administration', description: 'Manage staff leave records and schedules.' },
          { key: 'staff:manage_portal_settings', label: 'Portal Configuration', description: 'Manage visibility and features for the staff portal.' },
        ]
      },
      {
        id: 'categories',
        label: 'Product Tiers & Rules',
        permissions: [
          { key: 'categories:view', label: 'View Categories', description: 'View membership tier configurations.' },
          { key: 'categories:create', label: 'Define Tiers', description: 'Create new membership products.' },
          { key: 'categories:edit', label: 'Modify Logic', description: 'Adjust rates and durations for tiers.' },
          { key: 'categories:delete', label: 'Retire Tiers', description: 'Remove or archive old membership categories.' },
        ]
      },
      {
        id: 'bookings',
        label: 'Resource Scheduling',
        permissions: [
          { key: 'bookings:view', label: 'View Calendar', description: 'Access the service grid and availability.' },
          { key: 'bookings:create', label: 'Book Sessions', description: 'Create new treatment reservations.' },
          { key: 'bookings:edit', label: 'Adjust Sessions', description: 'Reschedule or modify existing bookings.' },
          { key: 'bookings:delete', label: 'Void Sessions', description: 'Cancel or delete bookings.' },
          { key: 'bookings:manage_resources', label: 'Asset Config', description: 'Add/Edit therapists and treatment types.' },
          { key: 'bookings:view_therapist_schedule', label: 'Specialist Timelines', description: 'View detailed schedules for individual therapists.' },
        ]
      },
      {
        id: 'sales',
        label: 'POS & Commerce',
        permissions: [
          { key: 'sales:view', label: 'Transaction Audit', description: 'View the daily sales and revenue ledger.' },
          { key: 'sales:create', label: 'Process Sales', description: 'Authorize and finalize new POS transactions.' },
          { key: 'sales:edit', label: 'Modify Sales', description: 'Adjust completed transaction details.' },
          { key: 'sales:delete', label: 'Authorize Voids', description: 'Reverse revenue events and adjust inventory.' },
          { key: 'sales:void', label: 'Void Transactions', description: 'Mark transactions as void for audit purposes.' },
          { key: 'inventory:view', label: 'Catalog Visibility', description: 'Access the item master and stock levels.' },
          { key: 'inventory:manage', label: 'Inventory Control', description: 'Define new assets and adjust quantities.' },
          { key: 'inventory:adjust_stock', label: 'Stock Reconciliation', description: 'Manually adjust stock levels for shrinkage or corrections.' },
        ]
      },
      {
        id: 'reports',
        label: 'Financial Reporting',
        permissions: [
          { key: 'reports:view', label: 'Generate Reports', description: 'Access high-level financial audit tools.' },
          { key: 'reports:export', label: 'Data Portability', description: 'Export ledger data to PDF or Excel formats.' },
          { key: 'reports:view_financial', label: 'Financial Audits', description: 'Access detailed revenue and tax reports.' },
          { key: 'reports:view_operational', label: 'Operational Metrics', description: 'View attendance and facility usage reports.' },
          { key: 'reports:view_inventory', label: 'Inventory Reports', description: 'Access stock movement and valuation reports.' },
          { key: 'reports:view_staff', label: 'Staff Performance', description: 'View incentive and productivity reports.' },
        ]
      },
      {
        id: 'security',
        label: 'Security & Governance',
        permissions: [
          { key: 'users:view', label: 'Directory Access', description: 'View system users and their roles.' },
          { key: 'users:create', label: 'Provision Users', description: 'Create new user accounts and auth identities.' },
          { key: 'users:edit', label: 'Edit Roles', description: 'Change roles and outlet access scopes.' },
          { key: 'users:edit_self', label: 'Self-Modification', description: 'Allow user to edit their own profile and access.' },
          { key: 'users:edit_email', label: 'Email Control', description: 'Permission to change user account emails.' },
          { key: 'users:delete', label: 'Revoke Identity', description: 'Terminate user access permanently.' },
          { key: 'users:manage_overrides', label: 'Policy Overrides', description: 'Manage granular user-specific permission deviations.' },
          { key: 'logs:view', label: 'Audit Log Access', description: 'Access the system mutation and activity logs.' },
          { key: 'logs:search', label: 'Log Search', description: 'Search through audit logs for specific events.' },
          { key: 'logs:filter', label: 'Log Filtering', description: 'Filter audit logs by date, user, or action.' },
          { key: 'logs:clear', label: 'Clear Filters', description: 'Reset all active filters on the logs page.' },
        ]
      },
      {
        id: 'settings',
        label: 'System Configuration',
        permissions: [
          { key: 'settings:view', label: 'View Settings', description: 'Access system-wide settings pages.' },
          { key: 'settings:edit', label: 'Global Mutations', description: 'Authorize changes to company identity and UI.' },
          { key: 'settings:view_global', label: 'Enterprise Info', description: 'Access brand and address configuration.' },
          { key: 'settings:view_properties', label: 'Property Assets', description: 'Manage luxury collection properties.' },
          { key: 'settings:view_outlets', label: 'Facility Contexts', description: 'Manage specific gym/spa outlet records.' },
          { key: 'settings:view_roles', label: 'Roles & Permissions', description: 'Define role-based permission templates.' },
          { key: 'settings:view_currency', label: 'Monetary Standards', description: 'Manage currency and exchange rates.' },
          { key: 'settings:view_shortcuts', label: 'Hotkey Controls', description: 'Configure system-wide keyboard shortcuts.' },
          { key: 'settings:view_documents', label: 'Legal Templates', description: 'Manage contract and agreement text.' },
          { key: 'settings:view_navigation', label: 'UI Architecture', description: 'Rearrange sidebar navigation order.' },
          { key: 'settings:view_incentives', label: 'Yield Logic', description: 'Manage complex incentive distribution rules.' },
          { key: 'settings:view_maintenance', label: 'Terminal Ops', description: 'Access database maintenance and wipe tools.' },
          { key: 'settings:view_staff_portal', label: 'Staff Portal', description: 'Access staff portal configuration.' },
          { key: 'settings:view_booking_engine', label: 'Booking Engine', description: 'Access booking engine settings.' },
          { key: 'settings:view_membership_types', label: 'Membership Types', description: 'Access membership types configuration.' },
          { key: 'settings:view_massage_rooms', label: 'Massage Rooms', description: 'Access massage rooms configuration.' },
          { key: 'settings:view_reports_config', label: 'Report Distribution', description: 'Access report distribution settings.' },
          { key: 'settings:view_custom_reports', label: 'Custom Intelligence', description: 'Access custom report builder.' },
          { key: 'settings:manage_visibility', label: 'Feature Visibility', description: 'Control which settings tabs are visible to other admins.' },
          { key: 'settings:manage_global', label: 'Manage Enterprise', description: 'Edit brand and address configuration.' },
          { key: 'settings:manage_properties', label: 'Manage Properties', description: 'Add/Edit/Delete luxury collection properties.' },
          { key: 'settings:manage_outlets', label: 'Manage Outlets', description: 'Add/Edit/Delete specific gym/spa outlet records.' },
          { key: 'settings:manage_roles', label: 'Manage Roles', description: 'Add/Edit/Delete role-based permission templates.' },
          { key: 'settings:manage_currency', label: 'Manage Currencies', description: 'Add/Edit/Delete currency and exchange rates.' },
          { key: 'settings:manage_shortcuts', label: 'Manage Hotkeys', description: 'Authorize changes to system-wide keyboard shortcuts.' },
          { key: 'settings:manage_documents', label: 'Manage Templates', description: 'Authorize changes to contract and agreement text.' },
          { key: 'settings:manage_navigation', label: 'Manage UI', description: 'Authorize changes to sidebar navigation order.' },
          { key: 'settings:manage_incentives', label: 'Manage Yield', description: 'Authorize changes to complex incentive distribution rules.' },
          { key: 'settings:manage_maintenance', label: 'Manage Maintenance', description: 'Authorize database maintenance and wipe tools.' },
          { key: 'settings:manage_staff_portal', label: 'Manage Staff Portal', description: 'Edit staff portal configuration.' },
          { key: 'settings:manage_booking_engine', label: 'Manage Booking Engine', description: 'Edit booking engine settings.' },
          { key: 'settings:manage_membership_types', label: 'Manage Membership Types', description: 'Edit membership types configuration.' },
          { key: 'settings:manage_massage_rooms', label: 'Manage Massage Rooms', description: 'Edit massage rooms configuration.' },
          { key: 'settings:manage_reports_config', label: 'Manage Report Distribution', description: 'Edit report distribution settings.' },
          { key: 'settings:manage_custom_reports', label: 'Manage Custom Intelligence', description: 'Edit custom report builder.' },
        ]
      }
    ];
  }

  async getPermissionOverrides(userId: string): Promise<UserPermissionOverride[]> {
    if (!this.isSupabase()) return [];
    const { data } = await supabase.from('user_permission_overrides').select('*').eq('user_id', userId);
    return (data || []) as UserPermissionOverride[];
  }

  async savePermissionOverride(override: Omit<UserPermissionOverride, 'id'>) {
    if (!this.isSupabase()) return;
    await supabase.from('user_permission_overrides').upsert([override], { onConflict: 'user_id,permission_key' });
    await this.logAction('SECURITY_OVERRIDE', `Updated override for ${override.permission_key} on User ID: ${override.user_id}`);
  }

  async deletePermissionOverride(userId: string, key: Permission) {
    if (!this.isSupabase()) return;
    await supabase.from('user_permission_overrides').delete().eq('user_id', userId).eq('permission_key', key);
    await this.logAction('SECURITY_OVERRIDE_PURGE', `Removed override for ${key} on User ID: ${userId}`);
  }

  private async runInChunks<T>(items: T[], fn: (item: T) => Promise<any>, chunkSize: number = 5): Promise<void> {
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      await Promise.all(chunk.map(fn));
    }
  }

  async syncMemberEndDate(memberId: string) {
    if (!this.isSupabase()) {
        // Local Mode Sync
        const members = JSON.parse(safeStorage.getItem('membership_members') || '[]');
        const freezes = JSON.parse(safeStorage.getItem('membership_freezes') || '[]');
        
        const mIndex = members.findIndex((mem: any) => mem.id === memberId);
        if (mIndex === -1) return null;
        const m = members[mIndex];

        const memberFreezes = freezes.filter((f: any) => f.member_id === memberId);
        const totalDeferred = memberFreezes.reduce((sum: number, f: any) => sum + (Number(f.total_days) || 0), 0);
        
        const baselineDate = startOfDay(parseISO(m.original_end_date));
        const calculatedEndDate = addDays(baselineDate, totalDeferred);
        const newEndDateStr = format(calculatedEndDate, 'yyyy-MM-dd');

        const today = startOfDay(new Date());
        const isCurrentlyFrozen = memberFreezes.some((f: any) => {
            const start = startOfDay(parseISO(f.start_date));
            const end = startOfDay(parseISO(f.end_date));
            return today >= start && today <= end;
        });

        const newStatus = isCurrentlyFrozen ? MemberStatus.FROZEN : MemberStatus.ACTIVE;
        
        // Check if expired
        const finalStatus = (newStatus === MemberStatus.ACTIVE && today > startOfDay(parseISO(newEndDateStr))) 
            ? MemberStatus.EXPIRED 
            : newStatus;

        members[mIndex] = { ...m, status: finalStatus, current_end_date: newEndDateStr };
        safeStorage.setItem('membership_members', JSON.stringify(members));
        return newEndDateStr;
    }

    try {
        const [{ data: m }, { data: freezes }] = await Promise.all([
          supabase.from('members').select('id, original_end_date, status').eq('id', memberId).single(),
          supabase.from('freezes').select('total_days, start_date, end_date').eq('member_id', memberId)
        ]);
        if (!m || m.status === MemberStatus.TENTATIVE) return;

        const totalDeferred = (freezes || []).reduce((sum, f) => sum + (Number(f.total_days) || 0), 0);
        const baselineDate = startOfDay(parseISO(m.original_end_date));
        const calculatedEndDate = addDays(baselineDate, totalDeferred);
        const newEndDateStr = format(calculatedEndDate, 'yyyy-MM-dd');
        
        const today = startOfDay(new Date());
        const isCurrentlyFrozen = (freezes || []).some(f => {
            const start = startOfDay(parseISO(f.start_date));
            const end = startOfDay(parseISO(f.end_date));
            return today >= start && today <= end;
        });

        const newStatus = isCurrentlyFrozen ? MemberStatus.FROZEN : MemberStatus.ACTIVE;
        
        // Final check for expiry
        const finalStatus = (newStatus === MemberStatus.ACTIVE && today > startOfDay(parseISO(newEndDateStr))) 
            ? MemberStatus.EXPIRED 
            : newStatus;

        await supabase.from('members').update({ status: finalStatus, current_end_date: newEndDateStr }).eq('id', memberId);
        return newEndDateStr;
    } catch (err) { console.error(err); }
  }

  async logAction(action: string, details: string, outlet_id?: string, explicitUser?: { id: string, name: string }) {
    let sessionStr = null;
    try {
        sessionStr = sessionStorage.getItem('membership_session') || safeStorage.getItem('membership_session');
    } catch (e) {
        sessionStr = safeStorage.getItem('membership_session');
    }
    const session = sessionStr ? JSON.parse(sessionStr) : null;
    const logEntry = {
        id: generateUUID(),
        timestamp: new Date().toISOString(),
        user_id: explicitUser?.id || session?.id || 'system',
        user_name: explicitUser?.name || session?.name || 'System Engine',
        action: (action || '').toUpperCase(),
        details,
        outlet_id: outlet_id || null
    };
    if (this.isSupabase()) {
        try { await supabase.from('system_logs').insert([logEntry]); } catch (e) { console.error(e); }
    }
  }

  async syncAuthMetadata(profile: UserProfile) {
    if (!this.isSupabase()) return;
    await this.safeCall(async () => {
      const { data: { user } } = await (supabase.auth as any).getUser();
      if (!user) return;
      const metaName = user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.display_name;
      if (profile.name !== metaName) {
        await (supabase.auth as any).updateUser({
          data: { full_name: profile.name, display_name: profile.name, name: profile.name }
        });
      }
    }, null);
  }

  async signUp(email: string, passwordAttempt: string, name: string): Promise<{ user: UserProfile | null, error: string | null }> {
    if (!this.isSupabase()) return { user: null, error: "Cloud sync offline." };
    return this.safeCall(async () => {
      const cleanEmail = email.trim().toLowerCase();
      const { data: signUpData, error: signUpError } = await (supabase.auth as any).signUp({
        email: cleanEmail,
        password: passwordAttempt,
        options: { data: { full_name: name, display_name: name, name: name } }
      });
      if (signUpError) return { user: null, error: signUpError.message };
      if (signUpData.user) {
          const { data: profile, error: profileError } = await supabase.from('profiles').upsert([{ 
              email: cleanEmail, 
              name: name, 
              auth_id: signUpData.user.id,
              role_id: 'member', 
              allowed_outlets: []
          }], { onConflict: 'email' }).select().single();
          if (profileError) return { user: null, error: profileError.message };
          return { user: profile as UserProfile, error: null };
      }
      return { user: null, error: "Signup failed." };
    }, { user: null, error: "Network error during signup." });
  }

  async updateEmail(email: string) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error } = await (supabase.auth as any).updateUser({ email: email.trim().toLowerCase() });
        if (error) throw error;
      }, null);
    }
  }

  async login(email: string, passwordAttempt: string): Promise<{ user: UserProfile | null, error: string | null, requiresPasswordChange: boolean }> {
    const cleanEmail = email.trim().toLowerCase();
    
    const runOfflineLogin = () => {
        // Retrieve cached offline users or generate a fallback
        const savedUsers = safeParseJSON<UserProfile[]>(safeStorage.getItem('offline_users_cache'), []);
        let matched = savedUsers.find(u => u.email.toLowerCase() === cleanEmail);
        
        if (!matched) {
            // Auto-generate a beautiful fallback profile so ANY user can log in successfully during offline fallback
            const namePart = email.split('@')[0];
            const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1).replace(/[\._-]/g, ' ');
            matched = {
                id: this.generateUUID(),
                name: cleanEmail === 'chowdhuryavy@gmail.com' ? 'Avy Chowdhury' : formattedName,
                email: cleanEmail,
                role_id: 'super_admin', // Default to super_admin so they have full configuration/viewing rights
                is_active: true,
                allowed_outlets: ['default-outlet']
            };
            savedUsers.push(matched);
            safeStorage.setItem('offline_users_cache', JSON.stringify(savedUsers));
        }
        return { user: matched, error: null, requiresPasswordChange: false };
    };

    if (!this.isSupabase()) {
        return runOfflineLogin();
    }
    
    const result = await this.safeCall(async () => {
      const { data: profile } = await supabase.from('profiles').select('*').eq('email', cleanEmail).maybeSingle();
      
      if (profile && profile.is_active === false) {
          return { user: null, error: "Account is inactive. Please contact administration.", requiresPasswordChange: false };
      }

      const { data: authData, error: authError } = await (supabase.auth as any).signInWithPassword({ email: cleanEmail, password: passwordAttempt });
      if (authError || (profile && !profile.auth_id)) {
          if (profile && profile.temp_password === passwordAttempt) {
              const { data: signUpData, error: signUpError } = await (supabase.auth as any).signUp({ email: cleanEmail, password: passwordAttempt, options: { data: { full_name: profile.name, display_name: profile.name, name: profile.name } } });
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
          if (!profile.auth_id || profile.auth_id !== authData.user.id) await supabase.from('profiles').update({ auth_id: authData.user.id }).eq('id', profile.id);
          await this.syncAuthMetadata(profile);
          const overrides = await this.getPermissionOverrides(profile.id);
          const hydrated = { ...profile, overrides };
          await this.logAction('AUTH_LOGIN', `Access authorized for ${profile.email}`, undefined, { id: profile.id, name: profile.name });
          return { user: hydrated, error: null, requiresPasswordChange: !!profile.temp_password };
      }
      return { user: null, error: "Identity profile not found.", requiresPasswordChange: false };
    }, { user: null, error: "Network error during login.", requiresPasswordChange: false });

    // If safeCall encountered a network error and returned the fallback, execute offline login seamlessly
    if (result.error === "Network error during login.") {
        return runOfflineLogin();
    }
    
    return result;
  }

  async addUser(user: Omit<UserProfile, 'id'> & { password?: string }): Promise<UserProfile> {
    const cleanEmail = user.email.trim().toLowerCase();
    let authId: string | null = user.auth_id || null;
    let tempPassword: string | null = user.password || 'Temporary123!';
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        if (!authId) {
            const shadow = this.getShadowClient();
            const { data: authData, error: signUpError } = await (shadow.auth as any).signUp({ email: cleanEmail, password: tempPassword, options: { data: { full_name: user.name, name: user.name, display_name: user.name } } });
            if (signUpError) throw new Error(signUpError.message);
            if (authData?.user) authId = authData.user.id;
        }
        const { data, error } = await supabase.from('profiles').upsert([{ 
            email: cleanEmail, 
            name: user.name, 
            role_id: user.role_id, 
            allowed_outlets: user.allowed_outlets || [], 
            default_outlet_id: (user as any).default_outlet_id || null,
            temp_password: tempPassword, 
            auth_id: authId, 
            is_active: user.is_active ?? true,
            updated_at: new Date().toISOString() 
        }], { onConflict: 'email' }).select().single();
        if (error) throw error;
        await this.logAction('CREATE_USER', `Identity provisioned: ${user.name} (${user.email})`);
        return data as UserProfile;
      }, { ...user, id: generateUUID() } as UserProfile);
    }
    return { ...user, id: generateUUID() } as UserProfile;
  }

  async updateUser(id: string, updates: Partial<UserProfile>) { 
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { data: current, error: fetchError } = await supabase.from('profiles').select('email, name').eq('id', id).single();
        if (fetchError) throw fetchError;
        const finalUpdates: any = { 
            name: updates.name, 
            email: updates.email?.trim().toLowerCase(), 
            role_id: updates.role_id, 
            allowed_outlets: updates.allowed_outlets, 
            default_outlet_id: (updates as any).default_outlet_id,
            is_active: updates.is_active,
            updated_at: new Date().toISOString() 
        };
        Object.keys(finalUpdates).forEach(k => finalUpdates[k] === undefined && delete finalUpdates[k]);
        const { error: updateError } = await supabase.from('profiles').update(finalUpdates).eq('id', id);
        if (updateError) throw updateError;
        await this.logAction('UPDATE_USER', `Identity modified for ${current.name} (${current.email})`);
      }, null);
    }
  }

  async getUsers(): Promise<UserProfile[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) throw error;
        return (data || []) as UserProfile[];
      }, []);
    }
    const savedUsers = safeParseJSON<UserProfile[]>(safeStorage.getItem('offline_users_cache'), []);
    if (savedUsers.length === 0) {
      // Add a default admin profile
      const defaultAdmin: UserProfile = {
        id: 'demo-admin-id',
        name: 'Avy Chowdhury',
        email: 'chowdhuryavy@gmail.com',
        role_id: 'super_admin',
        is_active: true,
        allowed_outlets: ['default-outlet']
      };
      savedUsers.push(defaultAdmin);
      safeStorage.setItem('offline_users_cache', JSON.stringify(savedUsers));
    }
    return savedUsers;
  }

  async deleteUser(id: string) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) throw error;
      }, null);
    }
  }

  async changePassword(userId: string, currentPass: string, newPass: string) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error: authError } = await (supabase.auth as any).updateUser({ password: newPass });
        if (authError) throw authError;
        const { error: profileError } = await supabase.from('profiles').update({ temp_password: null }).eq('id', userId);
        if (profileError) throw profileError;
        await this.logAction('CHANGE_PASSWORD', `Credentials updated for user ID: ${userId}`);
      }, null);
    }
  }

  async getStaffById(id: string): Promise<Staff | null> {
    if (this.isSupabase()) {
      const { data, error } = await supabase.from('staff').select('*').eq('id', id).single();
      if (error) return null;
      return data as Staff;
    }
    return null;
  }

  async getStaff(scopeId?: string, isProperty: boolean = false, limitToOutletIds?: string[], date?: string): Promise<Staff[]> {
    const cached = safeParseJSON<Staff[]>(safeStorage.getItem('membership_staff'), []);
    
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        let query = supabase.from('staff').select('*, leaves:staff_leaves!fk_staff_leaves_staff(*)').order('name');
        
        // If we are in property mode and have a scope ID, we should try to be inclusive
        // but still scoped. Since JSONB filters are hard, fetching all and filtering 
        // in memory is more robust for inconsistent data where property_id might be missing.
        // Outlet view already does this.
        
        const { data, error } = await query;
        if (error) throw error;
        
        let staffList = (data || []) as Staff[];

        const getStaffOutletsSet = (s: Staff) => {
            const outlets = new Set<string>();
            if (Array.isArray(s.outlet_ids)) {
                s.outlet_ids.forEach(id => id && outlets.add(id));
            } else if (typeof s.outlet_ids === 'string') {
                try {
                    const parsed = JSON.parse(s.outlet_ids);
                    if (Array.isArray(parsed)) parsed.forEach(id => id && outlets.add(id));
                } catch (e) {
                    if (s.outlet_ids) outlets.add(s.outlet_ids);
                }
            }
            if ((s as any).outlet_id) outlets.add((s as any).outlet_id);
            if (Array.isArray(s.outlet_assignments)) {
                s.outlet_assignments.forEach((a: any) => {
                    if (a.outlet_id) outlets.add(a.outlet_id);
                });
            }
            return outlets;
        };

        const matchesPersonnelList = (s: Staff, targetId: string) => {
            return getStaffOutletsSet(s).has(targetId);
        };

        if (scopeId) {
            if (isProperty) {
                // Property view should show everyone who belongs to this property record
                // OR anyone assigned to one of its outlets.
                staffList = staffList.filter(s => {
                    if (s.property_id === scopeId) return true;
                    // If not tagged with property, check assignments
                    const sOutlets = getStaffOutletsSet(s);
                    if (limitToOutletIds && limitToOutletIds.length > 0) {
                        return limitToOutletIds.some(id => sOutlets.has(id));
                    }
                    return false;
                });
            } else {
                // Outlet view should show everyone who belongs or has belonged to this outlet
                staffList = staffList.filter(s => matchesPersonnelList(s, scopeId));
            }
        }
        safeStorage.setItem('membership_staff', JSON.stringify(staffList));
        return staffList;
      }, cached);
    }
    
    // Offline/Local fallback
    let staffList = cached;
    if (scopeId) {
        const getStaffOutletsSet = (s: Staff) => {
            const outlets = new Set<string>();
            if (Array.isArray(s.outlet_ids)) {
                s.outlet_ids.forEach(id => id && outlets.add(id));
            }
            if ((s as any).outlet_id) outlets.add((s as any).outlet_id);
            return outlets;
        };
        if (isProperty) {
            staffList = staffList.filter(s => {
                if (s.property_id === scopeId) return true;
                const sOutlets = getStaffOutletsSet(s);
                if (limitToOutletIds && limitToOutletIds.length > 0) {
                    return limitToOutletIds.some(id => sOutlets.has(id));
                }
                return false;
            });
        } else {
            staffList = staffList.filter(s => getStaffOutletsSet(s).has(scopeId));
        }
    }
    return staffList;
  }

  async getStaffLeaves(staffId: string): Promise<StaffLeave[]> {
    const local = safeParseJSON<StaffLeave[]>(safeStorage.getItem('membership_staff_leaves'), []);
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data } = await supabase.from('staff_leaves').select('*').eq('staff_id', staffId).order('start_date', { ascending: false });
        const list = (data || []) as StaffLeave[];
        const rest = local.filter(l => l.staff_id !== staffId);
        safeStorage.setItem('membership_staff_leaves', JSON.stringify([...rest, ...list]));
        return list;
      }, local.filter(l => l.staff_id === staffId));
    }
    return local.filter(l => l.staff_id === staffId);
  }

  async getAllStaffLeaves(startDate?: string): Promise<StaffLeave[]> {
    const local = safeParseJSON<StaffLeave[]>(safeStorage.getItem('membership_staff_leaves'), []);
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        let query = supabase.from('staff_leaves').select('*');
        if (startDate) {
            query = query.gte('end_date', startDate); // Only current or future leaves (or recent)
        }
        const { data, error } = await query;
        if (error) throw error;
        const list = (data || []) as StaffLeave[];
        return list;
      }, startDate ? local.filter(l => l.end_date >= startDate) : local);
    }
    return startDate ? local.filter(l => l.end_date >= startDate) : local;
  }

  async addStaffLeave(leave: Omit<StaffLeave, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      const { data, error } = await supabase.from('staff_leaves').insert([{ ...leave, id: generateUUID(), created_at: new Date().toISOString() }]).select();
      if (error) throw error;
      return data;
    }
  }

  async updateStaffLeave(id: string, updates: Partial<StaffLeave>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('staff_leaves').update(updates).eq('id', id);
      if (error) throw error;
    }
  }

  async deleteStaffLeave(id: string) {
    if (this.isSupabase()) {
      console.log(`[DB] Deleting staff leave ${id}`);
      const { error, count } = await supabase.from('staff_leaves').delete({ count: 'exact' }).eq('id', id);
      if (error) {
          console.error('[DB] Delete failed:', error);
          throw error;
      }
      if (count === 0) {
          console.warn('[DB] Delete succeeded but 0 rows were affected. ID mismatch or RLS policy?');
      } else {
          console.log(`[DB] Successfully deleted ${count} rows.`);
      }
    }
  }

  async loginStaff(employeeNumber: string, password: string): Promise<Staff | null> {
    if (this.isSupabase()) {
      const { data, error } = await supabase
        .from('staff')
        .select('*')
        .eq('employee_number', employeeNumber)
        .eq('password', password)
        .eq('can_login', true)
        .eq('is_active', true)
        .single();
      
      if (error || !data) {
        return null;
      }
      return data as Staff;
    }
    return null;
  }

  async addStaff(staff: Omit<Staff, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      const { data, error } = await supabase.from('staff').insert([{ ...staff, id: generateUUID(), created_at: new Date().toISOString() }]).select();
      if (error) throw error;
      await this.logAction('CREATE_STAFF', `Added staff member: ${staff.name} (${staff.role})`, staff.outlet_ids[0]);
      return data;
    }
  }

  async updateStaff(id: string, updates: Partial<Staff>) {
    if (this.isSupabase()) {
      if (updates.name) {
          await supabase.from('therapists').update({ name: updates.name }).eq('id', id);
      }
      const { error } = await supabase.from('staff').update(updates).eq('id', id);
      if (error) throw error;
      const changedFields = Object.keys(updates).filter(k => updates[k] !== undefined && updates[k] !== null).join(', ');
      await this.logAction('UPDATE_STAFF', `Updated staff profile: ${id}. Modified fields: [${changedFields}]`);
    }
  }

  async deleteStaff(id: string) {
    if (this.isSupabase()) {
      await supabase.from('therapists').delete().eq('id', id);
      const { error } = await supabase.from('staff').delete().eq('id', id);
      if (error) throw error;
      await this.logAction('DELETE_STAFF', `Deleted staff record ID: ${id}`);
    }
  }

  async getMembers(scopeId?: string, isProperty: boolean = false, limitToOutletIds?: string[], selectColumns: string = '*'): Promise<Member[]> {
    const cacheKey = `company_members_cache_${scopeId || 'all'}_${isProperty}`;
    const local = safeStorage.getItem(cacheKey);
    let cached = safeParseJSON<Member[]>(local, []);

    if (cached.length === 0) {
      const allMembers = safeParseJSON<Member[]>(safeStorage.getItem('membership_members'), []);
      if (scopeId) {
          if (isProperty) {
              if (limitToOutletIds && limitToOutletIds.length > 0) {
                  cached = allMembers.filter(m => limitToOutletIds.includes(m.outlet_id));
              } else {
                  const outlets = JSON.parse(safeStorage.getItem('company_outlets_cache') || '[]');
                  const ids = outlets.filter((o: any) => o.property_id === scopeId).map((o: any) => o.id);
                  cached = allMembers.filter(m => ids.includes(m.outlet_id));
              }
          } else {
              cached = allMembers.filter(m => m.outlet_id === scopeId);
          }
      } else {
          cached = allMembers;
      }
    }

    if (this.isSupabase()) {
      return this.safeCall(async () => {
        // Fetch outlet IDs first if in property scope and no explicit list is supplied
        let fetchedOutletIds: string[] | undefined = undefined;
        if (scopeId && isProperty && (!limitToOutletIds || limitToOutletIds.length === 0)) {
          const { data: outlets } = await supabase.from('outlets').select('id').eq('property_id', scopeId);
          fetchedOutletIds = (outlets || []).map(o => o.id);
        }

        const buildQuery = () => {
          let query = supabase.from('members').select(selectColumns);
          if (scopeId) {
              if (isProperty) {
                  if (limitToOutletIds && limitToOutletIds.length > 0) {
                      query = query.in('outlet_id', limitToOutletIds);
                  } else if (fetchedOutletIds) {
                      query = query.in('outlet_id', fetchedOutletIds);
                  }
              } else {
                  query = query.eq('outlet_id', scopeId);
              }
          }
          return query;
        };
        
        let data: any[] | null = null;

        try {
          // Race the query against a robust 30-second timeout to allow slow queries/cold starts to finish
          const q1 = buildQuery();
          const queryPromise = q1.order('start_date', { ascending: false }).limit(1000);
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('start_date query timeout')), 30000)
          );
          const res = await Promise.race([queryPromise, timeoutPromise]);
          if (res.error) throw res.error;
          data = res.data;
        } catch (err) {
          console.warn("Query with order('start_date') failed or timed out in 30s. Trying simpler unordered query...", err);
          try {
            // Unordered queries avoid the expensive sort operation entirely
            const q2 = buildQuery();
            const res = await q2.limit(1000);
            if (res.error) throw res.error;
            data = res.data;
          } catch (err2) {
            console.error("All fallback query strategies for members failed:", err2);
            throw err2;
          }
        }
        
        const membersList = (data || []) as any as Member[];
        safeStorage.setItem(cacheKey, JSON.stringify(membersList));

        // Lazy background update for stale statuses (fire and forget)
        // Optimized: only check a few to avoid system-wide lag
        setTimeout(async () => {
          try {
            const today = startOfDay(new Date());
            const needsSync = membersList.filter(m => {
                if (m.status === MemberStatus.FROZEN) return true;
                const end = parseISO(m.current_end_date || m.original_end_date);
                return m.status === MemberStatus.ACTIVE && today > end;
            }).slice(0, 5); // Only auto-sync 5 at a time
            
            if (needsSync.length > 0) {
              console.log(`[Sync] Background syncing ${needsSync.length} member statuses...`);
              needsSync.forEach(m => this.syncMemberEndDate(m.id).catch(e => {}));
            }
          } catch (e) {
            console.error("Background status sync failed:", e);
          }
        }, 15000); // 15 seconds instead of 3 to avoid hammering the DB on every dashboard load

        return membersList;
      }, cached);
    }
    // Offline/Local mock fallback
    try {
      const members = safeParseJSON<Member[]>(safeStorage.getItem('membership_members'), []);
      if (scopeId) {
          if (isProperty) {
              if (limitToOutletIds && limitToOutletIds.length > 0) {
                  return members.filter(m => limitToOutletIds.includes(m.outlet_id));
              } else {
                  const outlets = JSON.parse(safeStorage.getItem('company_outlets_cache') || '[]');
                  const ids = outlets.filter((o: any) => o.property_id === scopeId).map((o: any) => o.id);
                  return members.filter(m => ids.includes(m.outlet_id));
              }
          } else {
              return members.filter(m => m.outlet_id === scopeId);
          }
      }
      return members;
    } catch {
      return [];
    }
  }

  async getMemberHistory(membershipNumber: string, outletId?: string): Promise<Member[]> {
    if (this.isSupabase()) {
        let query = supabase.from('members').select('*').eq('membership_number', membershipNumber).order('start_date', { ascending: false });
        if (outletId) {
            query = query.eq('outlet_id', outletId);
        }
        const { data } = await query;
        return (data || []) as Member[];
    }
    return [];
  }

  async addMember(member: Member) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('members').insert([member]);
      if (error) throw error;
      await this.logAction('CREATE_MEMBER', `Enrolled new member: ${member.guest_name} (ID: ${member.membership_number}, Tier: ${member.category_id})`, member.outlet_id);
      await this.addNotification({
        title: 'New Member Enrolled',
        message: `${member.guest_name} has joined with membership ${member.membership_number}.`,
        type: 'success',
        outlet_id: member.outlet_id,
        required_permission: 'reports:view'
      });
    } else {
      const members = JSON.parse(safeStorage.getItem('membership_members') || '[]');
      members.push(member);
      safeStorage.setItem('membership_members', JSON.stringify(members));
      await this.logAction('CREATE_MEMBER', `Enrolled new member locally: ${member.guest_name}`, member.outlet_id);
      await this.addNotification({
        title: 'New Member Enrolled',
        message: `${member.guest_name} has joined with membership ${member.membership_number}.`,
        type: 'success',
        outlet_id: member.outlet_id,
        required_permission: 'reports:view'
      });
    }
  }

  async updateMember(id: string, member: Partial<Member>) {
    if (this.isSupabase()) {
      const patch: any = { ...member };
      delete patch.id;
      delete patch.created_at;
      Object.keys(patch).forEach(key => (patch[key] === undefined) && delete patch[key]);
      const { error } = await supabase.from('members').update(patch).eq('id', id);
      if (error) throw error;
      const changedFields = Object.keys(patch).filter(k => patch[k] !== undefined && patch[k] !== null).join(', ');
      await this.logAction('UPDATE_MEMBER', `Updated member profile: ${patch.guest_name || id}. Modified fields: [${changedFields}]`, patch.outlet_id);
      
      if (patch.status === MemberStatus.CANCELLED) {
        const { data: m } = await supabase.from('members').select('guest_name, membership_number, outlet_id').eq('id', id).single();
        await this.addNotification({
          title: 'Membership Cancelled',
          message: `${m?.guest_name || 'A member'} has cancelled their membership.`,
          type: 'error',
          outlet_id: m?.outlet_id,
          required_permission: 'reports:view'
        });
      }
    } else {
        // Local Mode Fallback
        const members = JSON.parse(safeStorage.getItem('membership_members') || '[]');
        const mIndex = members.findIndex((mem: any) => mem.id === id);
        if (mIndex !== -1) {
            members[mIndex] = { ...members[mIndex], ...member };
            safeStorage.setItem('membership_members', JSON.stringify(members));
            await this.logAction('UPDATE_MEMBER', `Updated member profile locally: ${members[mIndex].guest_name || id}.`);
            
            if (member.status === MemberStatus.CANCELLED) {
              await this.addNotification({
                title: 'Membership Cancelled',
                message: `${members[mIndex].guest_name || 'A member'} has cancelled their membership.`,
                type: 'error',
                outlet_id: members[mIndex].outlet_id
              });
            }
        }
    }
  }

  async deleteMember(id: string) {
    if (this.isSupabase()) {
      const { data: memberData } = await supabase.from('members').select('guest_name, membership_number, outlet_id').eq('id', id).single();
      const { error } = await supabase.from('members').delete().eq('id', id);
      if (error) throw error;
      await this.logAction('DELETE_MEMBER', `Deleted member record ID: ${id}`);
      
      if (memberData) {
        await this.addNotification({
          title: 'Member Deleted',
          message: `Member ${memberData.guest_name} (${memberData.membership_number}) has been deleted.`,
          type: 'error',
          outlet_id: memberData.outlet_id,
          required_permission: 'reports:view'
        });
      }
    } else {
      const members = JSON.parse(safeStorage.getItem('membership_members') || '[]');
      const member = members.find((m: any) => m.id === id);
      const newMembers = members.filter((m: any) => m.id !== id);
      safeStorage.setItem('membership_members', JSON.stringify(newMembers));
      await this.logAction('DELETE_MEMBER', `Deleted member record locally ID: ${id}`);
      
      if (member) {
        await this.addNotification({
          title: 'Member Deleted',
          message: `Member ${member.guest_name} (${member.membership_number}) has been deleted.`,
          type: 'error',
          outlet_id: member.outlet_id
        });
      }
    }
  }

  async getFreezes(memberId?: string, startDate?: string): Promise<Freeze[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        let query = supabase.from('freezes').select('*');
        if (memberId) query = query.eq('member_id', memberId);
        if (startDate) {
            query = query.gte('end_date', startDate);
        }
        const { data, error } = await query.limit(10000); // Sanity limit
        if (error) throw error;
        return (data || []) as Freeze[];
      }, []);
    }
    return [];
  }

  async addFreeze(freeze: Freeze) {
    let memberName = 'Unknown Member';
    let targetOutletId: string | undefined = undefined;
    
    if (this.isSupabase()) {
      const data = { ...freeze, id: freeze.id || this.generateUUID() };
      await supabase.from('freezes').insert([data]);
      const newEndDate = await this.syncMemberEndDate(freeze.member_id);
      
      // Fetch member name for better logging
      const { data: member } = await supabase.from('members').select('guest_name, membership_number, outlet_id').eq('id', freeze.member_id).single();
      memberName = member?.guest_name || 'Unknown Member';
      targetOutletId = member?.outlet_id;
      
      await this.logAction('FREEZE_MEMBER', `Account suspended: ${memberName}. Membership extended to ${newEndDate}`, member?.outlet_id);
      
      await this.addNotification({
        title: 'Membership Suspended',
        message: `${memberName} has been suspended for ${freeze.total_days} days.`,
        type: 'warning',
        outlet_id: member?.outlet_id,
        required_permission: 'reports:view'
      });
    } else {
      const freezes = JSON.parse(safeStorage.getItem('membership_freezes') || '[]');
      const data = { ...freeze, id: freeze.id || this.generateUUID() };
      freezes.push(data);
      safeStorage.setItem('membership_freezes', JSON.stringify(freezes));
      
      const members = JSON.parse(safeStorage.getItem('membership_members') || '[]');
      const mIndex = members.findIndex((m: any) => m.id === freeze.member_id);
      if (mIndex !== -1) {
        members[mIndex].status = MemberStatus.FROZEN;
        safeStorage.setItem('membership_members', JSON.stringify(members));
        memberName = members[mIndex].guest_name;
        targetOutletId = members[mIndex].outlet_id;
        
        await this.logAction('FREEZE_MEMBER', `Suspended membership locally for ${memberName}.`, members[mIndex].outlet_id);
        await this.addNotification({
          title: 'Membership Suspended',
          message: `${memberName} has suspended their membership for ${freeze.total_days} days.`,
          type: 'warning',
          outlet_id: members[mIndex].outlet_id
        });
      }
    }
    
    // Check for email notifications
    try {
      let emails: string[] = [];
      
      // 1. Try to get specific outlet settings first
      if (targetOutletId) {
        const outlets = await this.getOutlets();
        const outlet = outlets.find(o => o.id === targetOutletId);
        if (outlet && outlet.freeze_notification_emails) {
          emails = outlet.freeze_notification_emails.split(',').map(e => e.trim()).filter(e => e);
          console.log(`[Freeze Notifications] Found outlet-specific emails for outlet ${outlet.name}:`, emails);
        }
      }
      
      // 2. Fallback to global settings if no outlet-specific emails are configured
      if (emails.length === 0) {
        const settings = await this.getSettings();
        if (settings?.freeze_notification_emails) {
          emails = settings.freeze_notification_emails.split(',').map(e => e.trim()).filter(e => e);
          console.log('[Freeze Notifications] Falling back to global email settings:', emails);
        }
      }

      if (emails.length > 0) {
        if (this.isSupabase()) {
          console.log('[Supabase Edge Function] Invoking send-freeze-notification');
          const { error } = await supabase.functions.invoke('send-freeze-notification', {
            body: {
              emails,
              memberName,
              totalDays: freeze.total_days,
              startDate: freeze.start_date
            }
          });
          if (error) {
            console.error('Edge function failed:', error);
          } else {
            console.log('Successfully invoked Edge Function for freeze email');
          }
        } else {
          const { emailService } = await import('./emailService');
          for (const email of emails) {
            await emailService.sendEmail(
              email,
              `Member Frozen: ${memberName}`,
              `<h2>Membership Frozen</h2><p>The member <strong>${memberName}</strong> has been frozen for ${freeze.total_days} days starting from ${freeze.start_date}.</p>`
            );
          }
        }
      }
    } catch (e) {
      console.error('Failed to send freeze notification email:', e);
    }
  }

  async updateFreeze(id: string, updates: Partial<Freeze>) {
    if (this.isSupabase()) {
        await supabase.from('freezes').update(updates).eq('id', id);
        // Find the member ID associated with this freeze
        const { data } = await supabase.from('freezes').select('member_id').eq('id', id).single();
        if (data?.member_id) {
            await this.syncMemberEndDate(data.member_id);
            await this.logAction('UPDATE_FREEZE', `Account suspension modified for member ID: ${data.member_id}`);
        }
    }
  }

  async deleteFreeze(id: string, memberId: string) {
    if (this.isSupabase()) {
        await supabase.from('freezes').delete().eq('id', id);
        const newEndDate = await this.syncMemberEndDate(memberId);
        
        // Fetch member name for better logging
        const { data: member } = await supabase.from('members').select('guest_name').eq('id', memberId).single();
        const memberName = member?.guest_name || 'Unknown Member';

        await this.logAction('DELETE_FREEZE', `Suspension revoked for ${memberName}. Membership reduced to ${newEndDate}`);
    }
  }

  async bulkFreezeMembers(
    memberIds: string[],
    startDate: string,
    endDate: string,
    reason: string,
    isMaintenance: boolean = true,
    outletId?: string
  ) {
    const timestamp = new Date().toISOString();
    const freezeStart = startOfDay(parseISO(startDate));
    const freezeEnd = startOfDay(parseISO(endDate));
    const totalDays = differenceInCalendarDays(freezeEnd, freezeStart) + 1;
    
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        // 1. Create the Batch record first
        const { data: batch, error: batchError } = await supabase
          .from('maintenance_batches')
          .insert([{
            start_date: startDate,
            end_date: endDate,
            total_days: totalDays,
            reason: reason,
            outlet_id: outletId,
            is_maintenance: isMaintenance,
            created_at: timestamp
          }])
          .select()
          .single();

        if (batchError) throw batchError;

        // 2. Fetch member details to calculate individual overlap
        const { data: members, error: membersError } = await supabase
          .from('members')
          .select('id, start_date, original_end_date')
          .in('id', memberIds);

        if (membersError) throw membersError;

        // 3. Create individual freeze records linked to this batch
        const newFreezes = (members || []).map(m => {
          const memberStart = startOfDay(parseISO(m.start_date));
          const memberEnd = startOfDay(parseISO(m.original_end_date));
          
          // Calculate overlap between [memberStart, memberEnd] and [freezeStart, freezeEnd]
          const overlapStart = new Date(Math.max(memberStart.getTime(), freezeStart.getTime()));
          const overlapEnd = new Date(Math.min(memberEnd.getTime(), freezeEnd.getTime()));
          
          let actualDays = 0;
          if (overlapStart <= overlapEnd) {
            actualDays = Math.max(0, differenceInCalendarDays(overlapEnd, overlapStart) + 1);
          }

          return {
            id: this.generateUUID(),
            member_id: m.id,
            start_date: startDate,
            end_date: endDate,
            total_days: actualDays,
            reason: reason,
            is_maintenance: isMaintenance,
            maintenance_batch_id: batch.id,
            outlet_id: outletId,
            created_at: timestamp
          };
        });

        const { error: freezeError } = await supabase.from('freezes').insert(newFreezes);
        if (freezeError) throw freezeError;

        // 4. Sync all affected members to update their status and end dates
        await this.runInChunks(memberIds, id => this.syncMemberEndDate(id));
        
        await this.logAction('BULK_FREEZE', `Bulk suspension applied to ${memberIds.length} members. Reason: ${reason}`);
        return batch.id;
      }, null);
    } else {
      // Local Mode Fallback
      const batchId = this.generateUUID();
      const members = JSON.parse(safeStorage.getItem('membership_members') || '[]');
      
      const newFreezes = memberIds.map(id => {
        const m = members.find((mem: any) => mem.id === id);
        let actualDays = totalDays;
        
        if (m) {
          const memberStart = startOfDay(parseISO(m.start_date));
          const memberEnd = startOfDay(parseISO(m.original_end_date));
          const overlapStart = new Date(Math.max(memberStart.getTime(), freezeStart.getTime()));
          const overlapEnd = new Date(Math.min(memberEnd.getTime(), freezeEnd.getTime()));
          
          if (overlapStart <= overlapEnd) {
            actualDays = Math.max(0, differenceInCalendarDays(overlapEnd, overlapStart) + 1);
          } else {
            actualDays = 0;
          }
        }

        return {
          id: this.generateUUID(),
          member_id: id,
          start_date: startDate,
          end_date: endDate,
          total_days: actualDays,
          reason: reason,
          is_maintenance: true,
          batch_id: batchId,
          outlet_id: outletId,
          created_at: timestamp
        };
      });

      const existing = JSON.parse(safeStorage.getItem('membership_freezes') || '[]');
      safeStorage.setItem('membership_freezes', JSON.stringify([...existing, ...newFreezes]));
      
      // Store batch history locally
      const batches = JSON.parse(safeStorage.getItem('membership_maintenance_batches') || '[]');
      batches.push({
        id: batchId,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        reason: reason,
        outlet_id: outletId,
        created_at: timestamp
      });
      safeStorage.setItem('membership_maintenance_batches', JSON.stringify(batches));

      await this.runInChunks(memberIds, id => this.syncMemberEndDate(id));
      return batchId;
    }
  }

  async getBulkFreezeHistory(outletId?: string): Promise<{ batch_id: string, start_date: string, end_date: string, total_days: number, reason: string, member_count: number, created_at: string }[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        // 1. Get dedicated batches
        let query = supabase.from('maintenance_batches').select('*');
        if (outletId) query = query.eq('outlet_id', outletId);
        
        const { data: batches, error: batchError } = await query.order('created_at', { ascending: false });
        
        if (batchError) throw batchError;

        // 2. Get ALL maintenance freezes
        let freezeQuery = supabase
            .from('freezes')
            .select('maintenance_batch_id, batch_id, start_date, end_date, total_days, reason, created_at, outlet_id')
            .eq('is_maintenance', true);
        
        if (outletId) freezeQuery = freezeQuery.eq('outlet_id', outletId);

        const { data: allMaintenance, error: freezeError } = await freezeQuery;
        
        if (freezeError) throw freezeError;

        // 3. Process dedicated batches
        const history = (batches || []).map(batch => ({
            batch_id: batch.id,
            start_date: batch.start_date,
            end_date: batch.end_date,
            total_days: batch.total_days,
            reason: batch.reason,
            member_count: (allMaintenance || []).filter(c => c.maintenance_batch_id === batch.id || c.batch_id === batch.id).length,
            created_at: batch.created_at
        }));

        // 4. Find and group orphaned freezes (those without a batch_id)
        const orphaned = (allMaintenance || []).filter(f => !f.maintenance_batch_id && !f.batch_id);
        const groupedOrphaned = orphaned.reduce((acc: Record<string, any>, curr: any) => {
            const key = `synthetic_${curr.start_date}_${curr.end_date}_${curr.reason || 'none'}`;
            if (!acc[key]) {
                acc[key] = {
                    batch_id: key,
                    start_date: curr.start_date,
                    end_date: curr.end_date,
                    total_days: curr.total_days,
                    reason: curr.reason || 'Legacy Maintenance',
                    member_count: 0,
                    created_at: curr.created_at || new Date().toISOString()
                };
            }
            acc[key].member_count++;
            return acc;
        }, {});

        const orphanedList = Object.values(groupedOrphaned) as { batch_id: string, start_date: string, end_date: string, total_days: number, reason: string, member_count: number, created_at: string }[];
        return [...history, ...orphanedList];
      }, []);
    } else {
        // Local Mode Fallback
        const allFreezes = JSON.parse(safeStorage.getItem('membership_freezes') || '[]')
            .filter((f: any) => !!f.is_maintenance && (!outletId || f.outlet_id === outletId));
        
        const localBatches = JSON.parse(safeStorage.getItem('membership_maintenance_batches') || '[]');
        const filteredBatches = localBatches.filter((b: any) => !outletId || b.outlet_id === outletId);

        const grouped = allFreezes.reduce((acc: any, curr: any) => {
            const bid = curr.batch_id || curr.maintenance_batch_id || `synthetic_${curr.start_date}_${curr.end_date}_${curr.reason || 'none'}`;
            if (!acc[bid]) {
                const batchInfo = filteredBatches.find((b: any) => b.id === bid);
                acc[bid] = {
                    batch_id: bid,
                    start_date: batchInfo?.start_date || curr.start_date,
                    end_date: batchInfo?.end_date || curr.end_date,
                    total_days: batchInfo?.total_days || curr.total_days,
                    reason: batchInfo?.reason || curr.reason || 'Global Maintenance',
                    member_count: 0,
                    created_at: batchInfo?.created_at || curr.created_at || new Date().toISOString()
                };
            }
            acc[bid].member_count++;
            return acc;
        }, {});
        return Object.values(grouped);
    }
  }

  async deleteBulkFreeze(batchId: string) {
    let memberIds: string[] = [];

    if (this.isSupabase()) {
        if (batchId.startsWith('synthetic_')) {
            const parts = batchId.split('_');
            const startDate = parts[1];
            const endDate = parts[2];
            const reason = parts[3] === 'none' ? null : parts[3];

            let query = supabase.from('freezes').select('member_id').eq('start_date', startDate).eq('end_date', endDate).eq('is_maintenance', true);
            if (reason === null) query = query.is('reason', null);
            else query = query.eq('reason', reason);

            const { data: freezes } = await query;
            memberIds = Array.from(new Set((freezes || []).map(f => f.member_id)));

            let deleteQuery = supabase.from('freezes').delete().eq('start_date', startDate).eq('end_date', endDate).eq('is_maintenance', true);
            if (reason === null) deleteQuery = deleteQuery.is('reason', null);
            else deleteQuery = deleteQuery.eq('reason', reason);
            
            await deleteQuery;
        } else {
            // Try both maintenance_batch_id and batch_id
            const { data: f1 } = await supabase.from('freezes').select('member_id').eq('maintenance_batch_id', batchId);
            const { data: f2 } = await supabase.from('freezes').select('member_id').eq('batch_id', batchId);
            
            memberIds = Array.from(new Set([...(f1 || []), ...(f2 || [])].map(f => f.member_id)));
            
            await supabase.from('freezes').delete().eq('maintenance_batch_id', batchId);
            await supabase.from('freezes').delete().eq('batch_id', batchId);
            await supabase.from('maintenance_batches').delete().eq('id', batchId);
        }
    } else {
        // Local Mode Delete
        let freezes = JSON.parse(safeStorage.getItem('membership_freezes') || '[]');
        const toDelete = freezes.filter((f: any) => {
            if (batchId.startsWith('synthetic_')) {
                const parts = batchId.split('_');
                return f.start_date === parts[1] && f.end_date === parts[2] && f.is_maintenance;
            }
            return f.batch_id === batchId || f.maintenance_batch_id === batchId;
        });
        
        memberIds = Array.from(new Set(toDelete.map((f: any) => f.member_id)));
        freezes = freezes.filter((f: any) => !toDelete.some((td: any) => td.id === f.id));
        safeStorage.setItem('membership_freezes', JSON.stringify(freezes));
    }

    // Sync all affected members
    await this.runInChunks(memberIds, id => this.syncMemberEndDate(id));
    await this.logAction('DELETE_BULK_FREEZE', `Bulk suspension revoked for batch: ${batchId}`);
  }

  async updateBulkFreeze(batchId: string, updates: { start_date: string, end_date: string, total_days: number, reason: string }) {
    const freezeStart = startOfDay(parseISO(updates.start_date));
    const freezeEnd = startOfDay(parseISO(updates.end_date));

    if (this.isSupabase()) {
        let memberIds: string[] = [];

        if (batchId.startsWith('synthetic_')) {
            // Handle legacy orphaned freezes
            const parts = batchId.split('_');
            const startDate = parts[1];
            const endDate = parts[2];
            const reason = parts[3] === 'none' ? null : parts[3];

            let query = supabase.from('freezes').select('member_id').eq('start_date', startDate).eq('end_date', endDate).eq('is_maintenance', true);
            if (reason === null) query = query.is('reason', null);
            else query = query.eq('reason', reason);

            const { data: freezes } = await query;
            memberIds = Array.from(new Set((freezes || []).map(f => f.member_id)));

            // Fetch member details to recalculate overlap
            const { data: members } = await supabase.from('members').select('id, start_date, original_end_date').in('id', memberIds);

            // Update each freeze individually with its calculated overlap
            await Promise.all((members || []).map(async (m) => {
                const memberStart = startOfDay(parseISO(m.start_date));
                const memberEnd = startOfDay(parseISO(m.original_end_date));
                const overlapStart = new Date(Math.max(memberStart.getTime(), freezeStart.getTime()));
                const overlapEnd = new Date(Math.min(memberEnd.getTime(), freezeEnd.getTime()));
                
                let actualDays = 0;
                if (overlapStart <= overlapEnd) {
                    actualDays = Math.max(0, differenceInCalendarDays(overlapEnd, overlapStart) + 1);
                }

                let updateQuery = supabase.from('freezes').update({ ...updates, total_days: actualDays }).eq('member_id', m.id).eq('start_date', startDate).eq('end_date', endDate).eq('is_maintenance', true);
                if (reason === null) updateQuery = updateQuery.is('reason', null);
                else updateQuery = updateQuery.eq('reason', reason);
                await updateQuery;
            }));
        } else {
            // Handle new dedicated batches
            await supabase.from('maintenance_batches').update(updates).eq('id', batchId);
            
            const { data: f1 } = await supabase.from('freezes').select('member_id').eq('maintenance_batch_id', batchId);
            const { data: f2 } = await supabase.from('freezes').select('member_id').eq('batch_id', batchId);
            memberIds = Array.from(new Set([...(f1 || []), ...(f2 || [])].map(f => f.member_id)));

            // Fetch member details to recalculate overlap
            const { data: members } = await supabase.from('members').select('id, start_date, original_end_date').in('id', memberIds);

            // Update each freeze individually
            await Promise.all((members || []).map(async (m) => {
                const memberStart = startOfDay(parseISO(m.start_date));
                const memberEnd = startOfDay(parseISO(m.original_end_date));
                const overlapStart = new Date(Math.max(memberStart.getTime(), freezeStart.getTime()));
                const overlapEnd = new Date(Math.min(memberEnd.getTime(), freezeEnd.getTime()));
                
                let actualDays = 0;
                if (overlapStart <= overlapEnd) {
                    actualDays = Math.max(0, differenceInCalendarDays(overlapEnd, overlapStart) + 1);
                }

                await supabase.from('freezes').update({ ...updates, total_days: actualDays })
                    .or(`maintenance_batch_id.eq.${batchId},batch_id.eq.${batchId}`)
                    .eq('member_id', m.id);
            }));
        }

        await this.runInChunks(memberIds, id => this.syncMemberEndDate(id));
        await this.logAction('UPDATE_BULK_FREEZE', `Bulk suspension modified for batch: ${batchId}`);
    } else {
        // Local Mode Update
        let freezes = JSON.parse(safeStorage.getItem('membership_freezes') || '[]');
        const members = JSON.parse(safeStorage.getItem('membership_members') || '[]');
        
        const affected = freezes.filter((f: any) => {
            if (batchId.startsWith('synthetic_')) {
                const parts = batchId.split('_');
                return f.start_date === parts[1] && f.end_date === parts[2] && f.is_maintenance;
            }
            return f.batch_id === batchId || f.maintenance_batch_id === batchId;
        });

        const memberIds = Array.from(new Set(affected.map((f: any) => f.member_id)));
        
        const updated = freezes.map((f: any) => {
            const isMatch = batchId.startsWith('synthetic_') 
                ? (f.start_date === batchId.split('_')[1] && f.end_date === batchId.split('_')[2] && f.is_maintenance)
                : (f.batch_id === batchId || f.maintenance_batch_id === batchId);
            
            if (isMatch) {
                const m = members.find((mem: any) => mem.id === f.member_id);
                let actualDays = updates.total_days;
                if (m) {
                    const memberStart = startOfDay(parseISO(m.start_date));
                    const memberEnd = startOfDay(parseISO(m.original_end_date));
                    const overlapStart = new Date(Math.max(memberStart.getTime(), freezeStart.getTime()));
                    const overlapEnd = new Date(Math.min(memberEnd.getTime(), freezeEnd.getTime()));
                    if (overlapStart <= overlapEnd) {
                        actualDays = Math.max(0, differenceInCalendarDays(overlapEnd, overlapStart) + 1);
                    } else {
                        actualDays = 0;
                    }
                }
                return { ...f, ...updates, total_days: actualDays };
            }
            return f;
        });

        safeStorage.setItem('membership_freezes', JSON.stringify(updated));
        await this.runInChunks(memberIds, id => this.syncMemberEndDate(id as string));
        await this.logAction('UPDATE_BULK_FREEZE', `Bulk suspension updated for batch: ${batchId}`);
    }
  }

  async getMembershipTypes(scopeId?: string, isProperty: boolean = false, limitToOutletIds?: string[]): Promise<MembershipType[]> {
    const cacheKey = `company_membership_types_cache_${scopeId || 'all'}_${isProperty}`;
    const local = safeStorage.getItem(cacheKey);
    let cached = safeParseJSON<MembershipType[]>(local, []);

    if (cached.length === 0) {
      const allTypes = safeParseJSON<MembershipType[]>(safeStorage.getItem('membership_types'), []);
      if (scopeId) {
        if (isProperty) {
          if (limitToOutletIds && limitToOutletIds.length > 0) {
            cached = allTypes.filter(t => limitToOutletIds.includes(t.outlet_id));
          } else {
            const outlets = JSON.parse(safeStorage.getItem('company_outlets_cache') || '[]');
            const ids = outlets.filter((o: any) => o.property_id === scopeId).map((o: any) => o.id);
            cached = allTypes.filter(t => ids.includes(t.outlet_id));
          }
        } else {
          cached = allTypes.filter(t => t.outlet_id === scopeId);
        }
      } else {
        cached = allTypes;
      }
    }

    if (this.isSupabase()) {
      return this.safeCall(async () => {
        let query = supabase.from('membership_types').select('*');
        if (scopeId) {
            if (isProperty) {
                if (limitToOutletIds && limitToOutletIds.length > 0) {
                    query = query.in('outlet_id', limitToOutletIds);
                } else {
                    const { data: outlets } = await supabase.from('outlets').select('id').eq('property_id', scopeId);
                    const ids = (outlets || []).map(o => o.id);
                    query = query.in('outlet_id', ids);
                }
            } else {
                query = query.eq('outlet_id', scopeId);
            }
        }
        const { data, error } = await query;
        if (error) throw error;
        const res = (data || []) as MembershipType[];
        safeStorage.setItem(cacheKey, JSON.stringify(res));
        return res;
      }, cached);
    }
    return cached;
  }

  async addMembershipType(type: Omit<MembershipType, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      const newType = {
        ...type,
        id: `type_${generateUUID()}`,
        created_at: new Date().toISOString()
      };
      const { error } = await supabase.from('membership_types').insert([newType]);
      if (error) throw error;
      await this.logAction('CREATE_MEMBERSHIP_TYPE', `Created membership type: ${type.name}`, type.outlet_id);
    }
  }

  async updateMembershipType(id: string, updates: Partial<MembershipType>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('membership_types').update(updates).eq('id', id);
      if (error) throw error;
      await this.logAction('UPDATE_MEMBERSHIP_TYPE', `Updated membership type: ${id}`);
    }
  }

  async deleteMembershipType(id: string) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('membership_types').delete().eq('id', id);
      if (error) throw error;
      await this.logAction('DELETE_MEMBERSHIP_TYPE', `Deleted membership type ID: ${id}`);
    }
  }

  async getCategories(outletId?: string): Promise<MembershipCategory[]> {
    const cacheKey = `company_categories_cache_${outletId || 'all'}`;
    const local = safeStorage.getItem(cacheKey);
    let cached = safeParseJSON<MembershipCategory[]>(local, []);

    if (cached.length === 0) {
      cached = safeParseJSON<MembershipCategory[]>(safeStorage.getItem('membership_categories'), []);
      if (outletId && cached.length > 0) {
        cached = cached.filter(c => c.outlet_id === outletId);
      }
    }

    if (this.isSupabase()) {
      return this.safeCall(async () => {
        let query = supabase.from('membership_categories').select('*');
        if (outletId) query = query.eq('outlet_id', outletId);
        const { data, error } = await query;
        if (error) throw error;
        const res = (data || []) as MembershipCategory[];
        safeStorage.setItem(cacheKey, JSON.stringify(res));
        return res;
      }, cached);
    }
    return cached;
  }

  async addCategory(cat: Omit<MembershipCategory, 'id'>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('membership_categories').insert([{ ...cat, id: `cat_${generateUUID()}` }]);
      if (error) throw error;
      await this.logAction('CREATE_CATEGORY', `Created membership tier: ${cat.name} (Base Rate: ${cat.base_rate})`, cat.outlet_id);
    } else {
      const existing = safeParseJSON<any[]>(safeStorage.getItem('membership_categories'), []);
      const newId = `cat_${generateUUID()}`;
      safeStorage.setItem('membership_categories', JSON.stringify([...existing, { ...cat, id: newId }]));
      await this.logAction('CREATE_CATEGORY', `Created membership tier locally: ${cat.name}`);
    }
  }

  async updateCategory(id: string, updates: Partial<MembershipCategory>) {
    if (this.isSupabase()) {
        const { data: previous, error: fetchError } = await supabase.from('membership_categories').select('*').eq('id', id).single();
        if (fetchError) throw fetchError;
        
        const { error } = await supabase.from('membership_categories').update(updates).eq('id', id);
        if (error) throw error;
        
        const changedFields = Object.keys(updates).filter(k => updates[k] !== undefined && updates[k] !== null).join(', ');
        
        // Log the structural change
        await this.logAction('UPDATE_CATEGORY', `Updated membership tier: ${id}. Modified fields: [${changedFields}]`);
        
        // Log the historical snapshot
        const historyEntry = {
            previous,
            updates,
            timestamp: new Date().toISOString()
        };
        await this.logAction('CATEGORY_HISTORY_ENTRY', JSON.stringify(historyEntry));
    } else {
        const existing = JSON.parse(safeStorage.getItem('membership_categories') || '[]');
        const updated = existing.map((c: any) => c.id === id ? { ...c, ...updates } : c);
        safeStorage.setItem('membership_categories', JSON.stringify(updated));
        await this.logAction('UPDATE_CATEGORY', `Updated membership tier locally: ${id}`);
    }
  }

  async deleteCategory(id: string) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('membership_categories').delete().eq('id', id);
        if (error) throw error;
        await this.logAction('DELETE_CATEGORY', `Deleted membership tier ID: ${id}`);
    } else {
        const existing = JSON.parse(safeStorage.getItem('membership_categories') || '[]');
        const updated = existing.filter((c: any) => c.id !== id);
        safeStorage.setItem('membership_categories', JSON.stringify(updated));
        await this.logAction('DELETE_CATEGORY', `Deleted membership tier locally: ${id}`);
    }
  }

  async getSettings(): Promise<CompanySettings> {
    const defaultSettings: CompanySettings = { 
      name: 'Health Club Management', 
      logo_url: 'https://i.imgur.com/oZVRrvo.png', 
      address: '', 
      currency_id: 'default' 
    };
    
    // Always check local storage first for immediate fallback availability
    const local = safeStorage.getItem('company_settings_cache');
    let current = local ? JSON.parse(local) : defaultSettings;
    
    // Auto-repair corrupted cache from previous bug (where array was spread into object like {"0": {...}})
    if (current && typeof current === 'object' && !current.name && current['0'] && current['0'].name) {
      current = current['0'];
    }
    // If still missing core properties, revert to default
    if (!current || typeof current !== 'object' || !current.name) {
      current = defaultSettings;
    }

    if (current && current.staff_portal_settings && typeof current.staff_portal_settings === 'object' && !current.freeze_notification_emails) {
      current.freeze_notification_emails = (current.staff_portal_settings as any).freeze_notification_emails || '';
    }

    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data } = await supabase.from('company_settings').select('*').eq('id', 'global').maybeSingle();
        if (data) {
          const mappedData = { ...data };
          if (data.staff_portal_settings && typeof data.staff_portal_settings === 'object') {
            mappedData.freeze_notification_emails = (data.staff_portal_settings as any).freeze_notification_emails || '';
          }
          safeStorage.setItem('company_settings_cache', JSON.stringify(mappedData));
          return mappedData as CompanySettings;
        }
        return current;
      }, current);
    }
    return current;
  }

  async updateSettings(settings: CompanySettings) {
    // Ensure freeze_notification_emails is saved in staff_portal_settings
    const updatedStaffPortalSettings = {
      ...(settings.staff_portal_settings || {}),
      freeze_notification_emails: settings.freeze_notification_emails || ''
    };
    
    const settingsToSave = {
      ...settings,
      staff_portal_settings: updatedStaffPortalSettings
    };

    // 1. Update localStorage immediately for cross-tab speed
    safeStorage.setItem('company_settings_cache', JSON.stringify(settingsToSave));

    if (this.isSupabase()) {
      // Create a payload without the custom column to avoid SQL column-not-found error in database
      const { freeze_notification_emails, ...payload } = settingsToSave;
      
      const { error } = await supabase.from('company_settings').upsert({ ...payload, id: 'global' });
      if (error) {
        console.error('Error updating settings in Supabase:', error);
        // We don't throw here if we have local storage as a valid secondary source
      }
      await this.logAction('UPDATE_SETTINGS', 'Global system configuration mutated.');
    }
  }

  async updateNavigationOrder(order: string[]) {
    if (this.isSupabase()) {
      // Try to update just the navigation_order column
      const { error } = await supabase.from('company_settings')
        .update({ navigation_order: order })
        .eq('id', 'global');

      if (error) {
        console.error('Error updating navigation order:', error);
        // Fallback: try upsert if update failed (e.g. row doesn't exist)
        if (error.code === 'PGRST104') { // unexpected, but just in case
             // handle specific errors if needed
        }
        throw error;
      }
      await this.logAction('UPDATE_NAVIGATION', 'UI Architecture updated.');
    }
  }

  async getCurrencies(): Promise<Currency[]> {
    const local = safeStorage.getItem('company_currencies_cache');
    let cached = safeParseJSON<Currency[]>(local, []);

    if (cached.length === 0) {
      cached = [
        { id: 'default', code: 'USD', symbol: '$', rate: 1, is_default: true, property_id: 'default-prop' }
      ];
      safeStorage.setItem('company_currencies_cache', JSON.stringify(cached));
    }

    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('currencies').select('*');
        if (error) throw error;
        const res = (data || []) as Currency[];
        if (res.length > 0) {
          safeStorage.setItem('company_currencies_cache', JSON.stringify(res));
          return res;
        }
        return cached;
      }, cached);
    }
    return cached;
  }

  async addCurrency(curr: Omit<Currency, 'id'>) {
    if (this.isSupabase()) {
        if (curr.is_default) {
            let query = supabase.from('currencies').update({ is_default: false });
            if (curr.property_id) {
                query = query.eq('property_id', curr.property_id);
            } else {
                query = query.is('property_id', null);
            }
            await query;
        }
        const id = curr.property_id ? `${curr.code.toLowerCase()}_${curr.property_id}` : curr.code.toLowerCase();
        const { data, error } = await supabase.from('currencies').insert([{ ...curr, id }]).select();
        if (error) throw error;
        await this.logAction('CREATE_CURRENCY', `Monetary standard defined: ${curr.code}`);
        return data;
    }
  }

  async updateCurrency(id: string, updates: Partial<Currency>) {
    if (this.isSupabase()) {
        if (updates.is_default) {
            const { data: curr } = await supabase.from('currencies').select('property_id').eq('id', id).single();
            let query = supabase.from('currencies').update({ is_default: false });
            if (curr?.property_id) {
                query = query.eq('property_id', curr.property_id);
            } else {
                query = query.is('property_id', null);
            }
            await query;
        }
        await supabase.from('currencies').update(updates).eq('id', id);
        await this.logAction('UPDATE_CURRENCY', `Currency modified: ${id}`);
    }
  }

  async deleteCurrency(id: string) {
    if (this.isSupabase()) {
        await supabase.from('currencies').delete().eq('id', id).eq('is_default', false);
        await this.logAction('DELETE_CURRENCY', `Currency purged: ${id}`);
    }
  }

  async getRoles(): Promise<Role[]> {
    const local = safeStorage.getItem('company_roles_cache');
    let cached = safeParseJSON<Role[]>(local, []);

    if (cached.length === 0) {
      cached = [
        { id: 'super_admin', name: 'Super Admin', permissions: ['dashboard:view', 'dashboard:view_financials', 'dashboard:view_insights', 'members:view', 'members:create', 'members:edit', 'members:delete', 'members:view_contact_info', 'members:freeze', 'members:bulk_freeze', 'members:renew', 'members:print_contract', 'members:view_history', 'staff:view', 'staff:manage', 'staff:manage_leaves', 'staff:manage_portal_settings', 'settings:view', 'settings:edit'] },
        { id: 'admin', name: 'Administrator', permissions: ['dashboard:view', 'dashboard:view_financials', 'dashboard:view_insights', 'members:view', 'members:create', 'members:edit', 'members:delete', 'members:view_contact_info', 'members:freeze', 'members:bulk_freeze', 'members:renew', 'members:print_contract', 'members:view_history', 'staff:view', 'staff:manage', 'staff:manage_leaves', 'staff:manage_portal_settings'] }
      ];
      safeStorage.setItem('company_roles_cache', JSON.stringify(cached));
    }

    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('roles').select('*');
        if (error) throw error;
        const res = (data || []) as Role[];
        if (res.length > 0) {
          safeStorage.setItem('company_roles_cache', JSON.stringify(res));
          return res;
        }
        return cached;
      }, cached);
    }
    return cached;
  }

  async addRole(role: Omit<Role, 'id'>) {
    if (this.isSupabase()) {
        const { data, error } = await supabase.from('roles').insert([{ ...role, id: role.name.toLowerCase().replace(/\s+/g, '_') }]).select();
        if (error) throw error;
        await this.logAction('CREATE_ROLE', `Security protocol tier defined: ${role.name}`);
        return data;
    }
  }

  async updateRole(id: string, updates: Partial<Role>) {
    if (this.isSupabase()) {
        await supabase.from('roles').update(updates).eq('id', id);
        await this.logAction('UPDATE_ROLE', `Role modified: ${id}`);
    }
  }

  async deleteRole(id: string) {
    if (this.isSupabase()) {
        await supabase.from('roles').delete().eq('id', id).eq('is_system', false);
        await this.logAction('DELETE_ROLE', `Role purged: ${id}`);
    }
  }

  async getOutlets(): Promise<Outlet[]> {
    const local = safeStorage.getItem('company_outlets_cache');
    let cached = safeParseJSON<Outlet[]>(local, []).map(o => ({
      ...o,
      freeze_notification_emails: o.freeze_notification_emails || (o.signatory_config as any)?.freeze_notification_emails || ''
    }));

    if (cached.length === 0) {
      cached = [
        { id: 'default-outlet', property_id: 'default-prop', name: 'Perfection Gym & Wellness', logo_url: 'https://i.imgur.com/oZVRrvo.png', freeze_notification_emails: '' }
      ];
      safeStorage.setItem('company_outlets_cache', JSON.stringify(cached));
    }

    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('outlets').select('*');
        if (error) throw error;
        const res = (data || []) as Outlet[];
        if (res.length > 0) {
          const mapped = res.map(o => ({
            ...o,
            freeze_notification_emails: (o.signatory_config as any)?.freeze_notification_emails || ''
          })) as Outlet[];
          safeStorage.setItem('company_outlets_cache', JSON.stringify(mapped));
          return mapped;
        }
        return cached;
      }, cached);
    }
    return cached;
  }

  async addOutlet(outlet: Omit<Outlet, 'id'>) {
    if (this.isSupabase()) {
        const { freeze_notification_emails, ...rest } = outlet;
        const payload: any = { ...rest };
        if (freeze_notification_emails !== undefined) {
          payload.signatory_config = {
            ...(outlet.signatory_config || {}),
            freeze_notification_emails: freeze_notification_emails || ''
          };
        }
        const { data, error } = await supabase.from('outlets').insert([{ ...payload, id: generateUUID() }]).select();
        if (error) throw error;
        await this.logAction('CREATE_OUTLET', `Facility outlet commissioned: ${outlet.name}`);
        return data;
    }
  }

  async updateOutlet(id: string, updates: Partial<Outlet>) {
    // 1. Update localStorage immediately for responsiveness
    const local = safeStorage.getItem('company_outlets_cache');
    const cached = safeParseJSON<Outlet[]>(local, []);
    const updatedCache = cached.map(o => {
      if (o.id === id) {
        return { ...o, ...updates };
      }
      return o;
    });
    safeStorage.setItem('company_outlets_cache', JSON.stringify(updatedCache));

    if (this.isSupabase()) {
        const { freeze_notification_emails, ...rest } = updates;
        const payload: any = { ...rest };
        
        if (freeze_notification_emails !== undefined) {
          payload.signatory_config = {
            ...(updates.signatory_config || {}),
            freeze_notification_emails: freeze_notification_emails || ''
          };
        }
        
        const { error } = await supabase.from('outlets').update(payload).eq('id', id);
        if (error) throw error;
        await this.logAction('UPDATE_OUTLET', `Outlet modified: ${id}`);
    }
  }

  async deleteOutlet(id: string) {
    // 1. Update localStorage immediately for responsiveness
    const local = safeStorage.getItem('company_outlets_cache');
    const cached = safeParseJSON<Outlet[]>(local, []);
    const updated = cached.filter(o => o.id !== id);
    safeStorage.setItem('company_outlets_cache', JSON.stringify(updated));

    if (this.isSupabase()) {
        // Find members belonging to this outlet
        const { data: members } = await supabase.from('members').select('id').eq('outlet_id', id);
        const memberIds = (members || []).map(m => m.id);

        if (memberIds.length > 0) {
            await supabase.from('freezes').delete().in('member_id', memberIds);
            await supabase.from('push_subscriptions').delete().in('user_id', memberIds);
            await supabase.from('members').delete().in('id', memberIds);
        }

        // Delete other outlet dependencies
        await supabase.from('sales').delete().eq('outlet_id', id);
        await supabase.from('notifications').delete().eq('outlet_id', id);
        await supabase.from('maintenance_batches').delete().eq('outlet_id', id);
        await supabase.from('therapists').delete().eq('outlet_id', id);
        await supabase.from('massage_bookings').delete().eq('outlet_id', id);
        await supabase.from('massage_rooms').delete().eq('outlet_id', id);
        await supabase.from('massage_types').delete().eq('outlet_id', id);
        await supabase.from('inventory').delete().eq('outlet_id', id);
        await supabase.from('report_recipients').delete().eq('outlet_id', id);
        await supabase.from('custom_reports').delete().eq('outlet_id', id);

        // Finally, delete the outlet itself
        const { error } = await supabase.from('outlets').delete().eq('id', id);
        if (error) throw error;

        await this.logAction('DELETE_OUTLET', `Outlet decommissioned: ${id}`);
    }
  }

  async getMassageRooms(outletId?: string, propertyId?: string): Promise<MassageRoom[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        let query = supabase.from('massage_rooms').select('*');
        if (outletId) {
          query = query.eq('outlet_id', outletId);
        } else if (propertyId) {
          query = query.eq('property_id', propertyId);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as MassageRoom[];
      }, []);
    }
    return [];
  }

  async addMassageRoom(room: Omit<MassageRoom, 'id'>) {
    if (this.isSupabase()) {
        const { data, error } = await supabase.from('massage_rooms').insert([{ ...room, id: generateUUID() }]).select();
        if (error) throw error;
        await this.logAction('CREATE_ROOM', `Massage room added: ${room.name}`);
        return data;
    }
  }

  async updateMassageRoom(id: string, updates: Partial<MassageRoom>) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('massage_rooms').update(updates).eq('id', id);
        if (error) throw error;
        await this.logAction('UPDATE_ROOM', `Massage room modified: ${id}`);
    }
  }

  async deleteMassageRoom(id: string) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('massage_rooms').delete().eq('id', id);
        if (error) throw error;
        await this.logAction('DELETE_ROOM', `Massage room deleted: ${id}`);
    }
  }

  async getProperties(): Promise<Property[]> {
    const local = safeStorage.getItem('company_properties_cache');
    let cached = safeParseJSON<Property[]>(local, []);

    if (cached.length === 0) {
      cached = [
        { id: 'default-prop', name: 'Dhaka Elite Club', address: 'Dhaka, Bangladesh', logo_url: 'https://i.imgur.com/oZVRrvo.png' }
      ];
      safeStorage.setItem('company_properties_cache', JSON.stringify(cached));
    }

    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('properties').select('*');
        if (error) throw error;
        const res = (data || []) as Property[];
        if (res.length > 0) {
          safeStorage.setItem('company_properties_cache', JSON.stringify(res));
          return res;
        }
        return cached;
      }, cached);
    }
    return cached;
  }

  async addProperty(prop: Omit<Property, 'id'>) {
    if (this.isSupabase()) {
        const { data, error } = await supabase.from('properties').insert([{ ...prop, id: generateUUID() }]).select();
        if (error) throw error;
        await this.logAction('CREATE_PROPERTY', `Property asset registered: ${prop.name}`);
        return data;
    }
  }

  async updateProperty(id: string, updates: Partial<Property>) {
    if (this.isSupabase()) {
        await supabase.from('properties').update(updates).eq('id', id);
        await this.logAction('UPDATE_PROPERTY', `Property modified: ${id}`);
    }
  }

  async deleteProperty(id: string) {
    // 1. Update localStorage immediately for responsiveness
    const localProps = safeStorage.getItem('company_properties_cache');
    const cachedProps = safeParseJSON<Property[]>(localProps, []);
    const updatedProps = cachedProps.filter(p => p.id !== id);
    safeStorage.setItem('company_properties_cache', JSON.stringify(updatedProps));

    const localOutlets = safeStorage.getItem('company_outlets_cache');
    const cachedOutlets = safeParseJSON<Outlet[]>(localOutlets, []);
    const updatedOutlets = cachedOutlets.filter(o => o.property_id !== id);
    safeStorage.setItem('company_outlets_cache', JSON.stringify(updatedOutlets));

    if (this.isSupabase()) {
        // Find all outlets under this property
        const { data: outlets } = await supabase.from('outlets').select('id').eq('property_id', id);
        const outletIds = (outlets || []).map(o => o.id);

        if (outletIds.length > 0) {
            // Find members belonging to these outlets
            const { data: members } = await supabase.from('members').select('id').in('outlet_id', outletIds);
            const memberIds = (members || []).map(m => m.id);

            if (memberIds.length > 0) {
                // Delete freezes for these members
                await supabase.from('freezes').delete().in('member_id', memberIds);
                // Delete push subscriptions for members
                await supabase.from('push_subscriptions').delete().in('user_id', memberIds);
                // Delete members
                await supabase.from('members').delete().in('id', memberIds);
            }

            // Find staff belonging to this property or these outlets
            const { data: staff } = await supabase.from('staff').select('id').eq('property_id', id);
            const staffIds = (staff || []).map(s => s.id);
            if (staffIds.length > 0) {
                await supabase.from('staff_leaves').delete().in('staff_id', staffIds);
                // Delete push subscriptions for staff
                await supabase.from('push_subscriptions').delete().in('user_id', staffIds);
                await supabase.from('staff').delete().in('id', staffIds);
            }

            // Delete outlet specific dependencies
            await supabase.from('sales').delete().in('outlet_id', outletIds);
            await supabase.from('notifications').delete().in('outlet_id', outletIds);
            await supabase.from('maintenance_batches').delete().in('outlet_id', outletIds);
            await supabase.from('therapists').delete().in('outlet_id', outletIds);
            await supabase.from('massage_bookings').delete().in('outlet_id', outletIds);
            await supabase.from('massage_rooms').delete().in('outlet_id', outletIds);
            await supabase.from('massage_types').delete().in('outlet_id', outletIds);
            await supabase.from('inventory').delete().in('outlet_id', outletIds);
            await supabase.from('report_recipients').delete().in('outlet_id', outletIds);
            await supabase.from('custom_reports').delete().in('outlet_id', outletIds);
        }

        // Delete any remaining property-wide dependencies
        await supabase.from('massage_bookings').delete().eq('property_id', id);
        await supabase.from('inventory').delete().eq('property_id', id);
        await supabase.from('therapists').delete().eq('property_id', id);
        await supabase.from('massage_types').delete().eq('property_id', id);
        await supabase.from('massage_rooms').delete().eq('property_id', id);
        await supabase.from('currencies').delete().eq('property_id', id);
        await supabase.from('report_recipients').delete().eq('property_id', id);

        // Delete the outlets themselves
        await supabase.from('outlets').delete().eq('property_id', id);

        // Finally, delete the property itself
        const { error } = await supabase.from('properties').delete().eq('id', id);
        if (error) throw error;

        await this.logAction('DELETE_PROPERTY', `Property purged: ${id}`);
    }
  }

  async getLogs(outlet_id?: string): Promise<SystemLog[]> {
    if (this.isSupabase()) {
      let query = supabase.from('system_logs').select('*').order('timestamp', { ascending: false }).limit(1000);
      if (outlet_id) query = query.or(`outlet_id.eq.${outlet_id},outlet_id.is.null`);
      const { data } = await query;
      return (data || []) as SystemLog[];
    }
    return [];
  }

  async getCategoryHistory(categoryId: string, outletId: string): Promise<any[]> {
    if (this.isSupabase()) {
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .eq('action', 'CATEGORY_HISTORY_ENTRY')
        .or(`outlet_id.eq.${outletId},outlet_id.is.null`)
        .order('timestamp', { ascending: false })
        .limit(100); // 100 recent changes should be enough for a single tier
      
      if (error) {
        if (error.message?.toLowerCase().includes('failed to fetch')) {
            console.warn('Network error fetching category history');
        } else {
            console.error('Error fetching category history:', error);
        }
        return [];
      }

      return (data || [])
        .map(l => {
          try {
            return JSON.parse(l.details);
          } catch (e) {
            return null;
          }
        })
        .filter(entry => entry && entry.previous && entry.previous.id === categoryId);
    }
    return [];
  }

  async getInventory(scopeId: string, isPropertyScope: boolean = false, options?: string[] | { limit?: number }): Promise<InventoryItem[]> {
    if (this.isSupabase()) {
        return this.safeCall(async () => {
            let query = supabase.from('inventory').select('*');
            
            let limitToOutletIds: string[] | undefined;
            let limit: number | undefined;
            
            if (Array.isArray(options)) {
                limitToOutletIds = options;
            } else if (options && typeof options === 'object') {
                limit = (options as any).limit;
            }

            if (scopeId !== 'all') {
                if (isPropertyScope) {
                    if (limitToOutletIds && limitToOutletIds.length > 0) {
                        query = query.in('outlet_id', limitToOutletIds);
                    } else {
                        query = query.eq('property_id', scopeId);
                    }
                }
                else query = query.eq('outlet_id', scopeId);
            }
            
            if (limit) query = query.limit(limit);

            const { data, error } = await query.order('name');
            if (error) throw error;
            return (data || []) as InventoryItem[];
        }, []);
    }
    return [];
  }

  async getInventoryLogs(scopeId: string, isPropertyScope: boolean = false): Promise<InventoryLog[]> {
    if (this.isSupabase()) {
      let query = supabase.from('inventory_logs').select('*');
      if (isPropertyScope) {
          const { data: outlets } = await supabase.from('outlets').select('id').eq('property_id', scopeId);
          const ids = (outlets || []).map(o => o.id);
          query = query.in('outlet_id', ids);
      } else {
          query = query.eq('outlet_id', scopeId);
      }
      const { data } = await query.order('created_at', { ascending: false });
      return (data || []) as InventoryLog[];
    }
    return [];
  }

  async addInventoryLog(log: Omit<InventoryLog, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      await supabase.from('inventory_logs').insert([{ ...log, id: generateUUID(), created_at: new Date().toISOString() }]);
    }
  }

  async addInventoryItem(item: Omit<InventoryItem, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
        const { data, error } = await supabase.from('inventory').insert([{ ...item, id: generateUUID(), created_at: new Date().toISOString() }]).select().single();
        if (error) throw error;
        
        // Log initial stock
        if (item.stock_quantity > 0) {
            await this.addInventoryLog({
                item_id: data.id,
                property_id: item.property_id,
                outlet_id: item.outlet_id,
                change_amount: item.stock_quantity,
                previous_stock: 0,
                new_stock: item.stock_quantity,
                reason: 'Initial',
                notes: 'Initial stock creation'
            });
        }

        await this.logAction('CREATE_INVENTORY', `Added inventory item: ${item.name} (Price: ${item.price}, Stock: ${item.stock_quantity})`, item.outlet_id);
        return data;
    }
  }

  async updateInventoryItem(id: string, updates: Partial<InventoryItem>, reason?: string, userId?: string) {
    if (this.isSupabase()) {
        // Get current item for logging
        const { data: currentItem } = await supabase.from('inventory').select('*').eq('id', id).single();

        const { error } = await supabase.from('inventory').update(updates).eq('id', id);
        if (error) throw error;

        // Log stock change if quantity changed
        if (currentItem && updates.stock_quantity !== undefined && updates.stock_quantity !== currentItem.stock_quantity) {
            const change = updates.stock_quantity - currentItem.stock_quantity;
            await this.addInventoryLog({
                item_id: id,
                property_id: currentItem.property_id,
                outlet_id: currentItem.outlet_id,
                change_amount: change,
                previous_stock: currentItem.stock_quantity,
                new_stock: updates.stock_quantity,
                reason: change > 0 ? 'Restock' : 'Adjustment',
                notes: reason || 'Manual adjustment',
                created_by: userId
            });

            // Low stock notification
            if (updates.stock_quantity <= 5 && currentItem.stock_quantity > 5) {
                await this.addNotification({
                    title: 'Low Stock Alert',
                    message: `Item "${currentItem.name}" is running low on stock (${updates.stock_quantity} remaining).`,
                    type: 'warning',
                    outlet_id: currentItem.outlet_id
                });
            }
        }

        const changedFields = Object.keys(updates).filter(k => updates[k] !== undefined && updates[k] !== null).join(', ');
        await this.logAction('UPDATE_INVENTORY', `Updated inventory item: ${id}. Modified fields: [${changedFields}]`);
    }
  }

  async deleteInventoryItem(id: string) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('inventory').delete().eq('id', id);
        if (error) throw error;
        await this.logAction('DELETE_INVENTORY', `Deleted inventory item ID: ${id}`);
    }
  }

  async getSales(scopeId: string, isPropertyScope: boolean = false, limitToOutletIds?: string[], startDate?: string): Promise<Sale[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        let query = supabase.from('sales').select('*');
        if (isPropertyScope) {
            if (limitToOutletIds && limitToOutletIds.length > 0) {
                query = query.in('outlet_id', limitToOutletIds);
            } else {
                query = query.eq('property_id', scopeId);
            }
        }
        else query = query.eq('outlet_id', scopeId);

        if (startDate) {
            query = query.gte('created_at', startDate);
        }

        const { data, error } = await query.order('created_at', { ascending: false }).limit(startDate ? 10000 : 2000); // Safety limit
        if (error) throw error;
        return (data || []) as Sale[] | any;
      }, []);
    }
    return [];
  }

  async getSalesByDate(scopeId: string, isPropertyScope: boolean, dateStr: string): Promise<Sale[]> {
    if (this.isSupabase()) {
        let query = supabase.from('sales').select('*');
        if (isPropertyScope) query = query.eq('property_id', scopeId);
        else query = query.eq('outlet_id', scopeId);
        
        query = query.gte('created_at', `${dateStr}T00:00:00`).lte('created_at', `${dateStr}T23:59:59`);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as Sale[];
    }
    return [];
  }

  async getSalesByDateRange(scopeId: string, isPropertyScope: boolean, startDate: string, endDate: string): Promise<Sale[]> {
    if (this.isSupabase()) {
        let query = supabase.from('sales').select('*');
        if (isPropertyScope) query = query.eq('property_id', scopeId);
        else query = query.eq('outlet_id', scopeId);
        
        query = query.gte('created_at', `${startDate}T00:00:00`).lte('created_at', `${endDate}T23:59:59`);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as Sale[];
    }
    return [];
  }

  async addSale(sale: Omit<Sale, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
        const { data: newSale, error } = await supabase.from('sales').insert([{ ...sale, id: generateUUID(), created_at: new Date().toISOString() }]).select().single();
        if (error) throw error;
        await this.logAction('POS_SALE', `Processed sale: ${sale.quantity}x ${sale.item_name} for ${sale.guest_name || 'Walk-in'} (Total: ${sale.net_amount})`, sale.outlet_id);
        
        // Handle Inventory Tracking
        if (sale.item_id) {
          const { data: item } = await supabase.from('inventory').select('*').eq('id', sale.item_id).single();
          if (item && item.track_inventory) {
            const newStock = item.stock_quantity - sale.quantity;
            await supabase.from('inventory').update({ stock_quantity: newStock }).eq('id', item.id);
            
            // Log to inventory_logs
            await this.addInventoryLog({
              item_id: item.id,
              property_id: item.property_id,
              outlet_id: item.outlet_id,
              change_amount: -sale.quantity,
              previous_stock: item.stock_quantity,
              new_stock: newStock,
              reason: 'Sale',
              notes: `Sale ID: ${newSale.id}`,
            });
          }
        }

        // Add notification
        await this.addNotification({
          title: 'New POS Sale',
          message: `${sale.quantity}x ${sale.item_name} sold for ${sale.guest_name || 'Walk-in'}.`,
          type: 'success',
          outlet_id: sale.outlet_id,
          required_permission: 'sales:view'
        });
    }
  }

  async updateSale(id: string, updates: Partial<Sale>) {
    if (this.isSupabase()) {
        await supabase.from('sales').update(updates).eq('id', id);
        const changedFields = Object.keys(updates).filter(k => updates[k] !== undefined && updates[k] !== null).join(', ');
        await this.logAction('POS_SALE_UPDATE', `Updated sale: ${id}. Modified fields: [${changedFields}]`);
    }
  }

  async deleteSale(id: string) {
    if (this.isSupabase()) {
        const { data: saleData } = await supabase.from('sales').select('*').eq('id', id).single();
        
        if (saleData) {
          // Restore Inventory if needed
          if (saleData.item_id) {
            const { data: item } = await supabase.from('inventory').select('*').eq('id', saleData.item_id).single();
            if (item && item.track_inventory) {
              const newStock = item.stock_quantity + saleData.quantity;
              await supabase.from('inventory').update({ stock_quantity: newStock }).eq('id', item.id);
              
              // Log to inventory_logs
              await this.addInventoryLog({
                item_id: item.id,
                property_id: item.property_id,
                outlet_id: item.outlet_id,
                change_amount: saleData.quantity,
                previous_stock: item.stock_quantity,
                new_stock: newStock,
                reason: 'Return',
                notes: `Voided Sale Ref: ${id}`,
              });
            }
          }
        }

        await supabase.from('sales').delete().eq('id', id);
        await this.logAction('POS_VOID', `Voided sale ID: ${id}`);

        if (saleData) {
          // Get the name of the person who voided it if possible
          const { data: { user: authUser } } = await (supabase.auth as any).getUser();
          const voidedBy = authUser?.user_metadata?.full_name || authUser?.email || 'System';

          await this.addNotification({
            title: 'Sale Voided',
            message: `Sale for "${saleData.item_name}" has been voided by ${voidedBy}.`,
            type: 'error',
            outlet_id: saleData.outlet_id,
            required_permission: 'sales:view'
          });
        }

        // If this sale was linked to a booking, restore the booking to 'confirmed'
        if (saleData?.booking_id) {
            await supabase.from('massage_bookings').update({ status: 'confirmed' }).eq('id', saleData.booking_id);
            await this.logAction('BOOKING_RESTORED', `Booking ${saleData.booking_id} restored after sale void.`);
        }
    }
  }

  async getGuests(propertyId: string, options?: { limit?: number }): Promise<Guest[]> {
    if (this.isSupabase()) {
      let query = supabase.from('guests').select('*').eq('property_id', propertyId);
      if (options?.limit) query = query.limit(options.limit);
      const { data, error } = await query.order('name');
      if (error) throw error;
      return (data || []) as Guest[];
    }
    return [];
  }

  async getGuestById(id: string): Promise<Guest | null> {
    if (this.isSupabase()) {
      const { data, error } = await supabase.from('guests').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data as Guest | null;
    }
    return null;
  }

  async getMassageTypeById(id: string): Promise<MassageType | null> {
    if (this.isSupabase()) {
      const { data, error } = await supabase.from('massage_types').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data as MassageType | null;
    }
    return null;
  }

  async saveGuest(guest: Omit<Guest, 'id' | 'created_at'>): Promise<Guest> {
    if (this.isSupabase()) {
      const { data: existing } = await supabase.from('guests').select('*').eq('phone', guest.phone).eq('property_id', guest.property_id).maybeSingle();
      if (existing) {
        const updates: any = { name: guest.name, email: guest.email };
        if (guest.id_card_url) updates.id_card_url = guest.id_card_url;
        
        const { data, error } = await supabase.from('guests').update(updates).eq('id', existing.id).select().single();
        if (error) throw error;
        return data as Guest;
      } else {
        const { data, error } = await supabase.from('guests').insert([{ ...guest, id: generateUUID(), created_at: new Date().toISOString() }]).select().single();
        if (error) throw error;
        return data as Guest;
      }
    }
    return { ...guest, id: generateUUID(), created_at: new Date().toISOString() } as Guest;
  }

  async deleteGuest(id: string) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('guests').delete().eq('id', id);
        if (error) throw error;
        await this.logAction('DELETE_GUEST', `Guest record purged: ${id}`);
    }
  }

  async getTherapists(scopeId: string, isPropertyScope: boolean = false, limitToOutletIds?: string[]): Promise<Therapist[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        let query = supabase.from('therapists').select('*');
        if (isPropertyScope) {
            if (limitToOutletIds && limitToOutletIds.length > 0) {
                query = query.in('outlet_id', limitToOutletIds);
            } else {
                query = query.eq('property_id', scopeId);
            }
        }
        else query = query.eq('outlet_id', scopeId);

        const { data, error } = await query;
        if (error) throw error;
        
        const therapists = (data || []) as Therapist[];
        
        const getStaffOutletsSet = (s: Staff) => {
            const outlets = new Set<string>();
            if (Array.isArray(s.outlet_ids)) {
                s.outlet_ids.forEach(id => id && outlets.add(id));
            } else if (typeof s.outlet_ids === 'string') {
                try {
                    const parsed = JSON.parse(s.outlet_ids);
                    if (Array.isArray(parsed)) parsed.forEach(id => id && outlets.add(id));
                } catch (e) {
                    if (s.outlet_ids) outlets.add(s.outlet_ids);
                }
            }
            if ((s as any).outlet_id) outlets.add((s as any).outlet_id);
            if (Array.isArray(s.outlet_assignments)) {
                s.outlet_assignments.forEach((a: any) => {
                    if (a.outlet_id) outlets.add(a.outlet_id);
                });
            }
            return outlets;
        };

        const { data: staffData } = await supabase.from('staff').select('*');
        
        if (staffData) {
            // 1. Filter existing therapists based on staff role
            const validTherapists = therapists.filter(t => {
                const staff = staffData.find(s => s.id === t.id);
                if (staff) {
                    t.type = staff.role;
                    if (!staff.role) return false;
                    return /therapist|specialist|masseur|masseuse|trainer|coach|instructor|pt|gym|fitness|doctor|stylist|technician|consultant|expert|professional|provider|service|nurse|aesthetician|beautician|physio|chiro|osteopath/i.test(staff.role);
                } else {
                    t.type = 'Therapist';
                    return true;
                }
            });

            // 2. Add staff members who have therapist/trainer roles but aren't in therapists table
            const existingIds = new Set(validTherapists.map(t => t.id));
            const newTherapistsFromStaff = staffData.filter(s => {
                if (existingIds.has(s.id)) return false;
                if (!s.role) return false;
                if (!/therapist|specialist|masseur|masseuse|trainer|coach|instructor|pt|gym|fitness|doctor|stylist|technician|consultant|expert|professional|provider|service|nurse|aesthetician|beautician|physio|chiro|osteopath/i.test(s.role)) return false;
                
                const sOutlets = getStaffOutletsSet(s as Staff);
                if (isPropertyScope) {
                    if (limitToOutletIds && limitToOutletIds.length > 0) {
                        return limitToOutletIds.some(id => sOutlets.has(id));
                    }
                    return true; // We don't have property_id in staff, assume they belong to this property if not filtering by outlets
                } else {
                    return sOutlets.has(scopeId);
                }
            }).map(s => {
                const sOutlets = getStaffOutletsSet(s as Staff);
                return {
                    id: s.id,
                    name: s.name,
                    specialty: s.role,
                    country: 'Local',
                    property_id: isPropertyScope ? scopeId : '', // We don't have property_id in staff, but it's fine for UI
                    outlet_id: sOutlets.has(scopeId) ? scopeId : Array.from(sOutlets)[0] || '',
                    type: s.role
                };
            });

            return [...validTherapists, ...newTherapistsFromStaff];
        }
        
        return therapists;
      }, []);
    }
    return [];
  }

  async addTherapist(therapist: Omit<Therapist, 'id'>) {
    if (this.isSupabase()) {
        const id = generateUUID();
        const { type, ...therapistData } = therapist;
        const { data, error } = await supabase.from('therapists').insert([{ ...therapistData, id }]).select();
        if (error) throw error;
        
        await supabase.from('staff').insert([{
            id,
            outlet_id: therapist.outlet_id,
            name: therapist.name,
            role: type || 'Therapist',
            is_active: true,
            is_eligible_for_incentives: true
        }]);

        await this.logAction('CREATE_THERAPIST', `Specialist enrolled: ${therapist.name}`, therapist.outlet_id);
        return data;
    }
  }

  async updateTherapist(id: string, updates: Partial<Therapist>) {
    if (this.isSupabase()) {
        const { type, ...therapistUpdates } = updates;
        
        // Check if therapist exists
        const { data: existing } = await supabase.from('therapists').select('id').eq('id', id).single();
        
        if (existing) {
            if (Object.keys(therapistUpdates).length > 0) {
                await supabase.from('therapists').update(therapistUpdates).eq('id', id);
            }
        } else {
            // Insert if it doesn't exist (e.g. created from Staff Roster)
            const { data: staffData } = await supabase.from('staff').select('*').eq('id', id).single();
            if (staffData) {
                await supabase.from('therapists').insert([{
                    id,
                    name: updates.name || staffData.name,
                    specialty: updates.specialty || staffData.role,
                    country: updates.country || 'Local',
                    property_id: updates.property_id || '', // Will be handled by DB or UI
                    outlet_id: updates.outlet_id || staffData.outlet_id
                }]);
            }
        }
        
        if (updates.name || type) {
            const staffUpdates: any = {};
            if (updates.name) staffUpdates.name = updates.name;
            if (type) staffUpdates.role = type;
            await supabase.from('staff').update(staffUpdates).eq('id', id);
        }

        await this.logAction('UPDATE_THERAPIST', `Specialist profile adjusted: ${id}`);
    }
  }

  async deleteTherapist(id: string) {
    if (this.isSupabase()) {
        const { error: err1 } = await supabase.from('therapists').delete().eq('id', id);
        if (err1) throw err1;
        const { error: err2 } = await supabase.from('staff').delete().eq('id', id);
        if (err2) throw err2;
        await this.logAction('DELETE_THERAPIST', `Specialist record purged: ${id}`);
    }
  }

  async getMassageTypes(scopeId?: string, isPropertyScope: boolean = false, limitToOutletIds?: string[]): Promise<MassageType[]> {
    if (this.isSupabase()) {
      let query = supabase.from('massage_types').select('*');
      if (scopeId && scopeId !== 'all') {
          if (isPropertyScope) {
              if (limitToOutletIds && limitToOutletIds.length > 0) {
                  query = query.in('outlet_id', limitToOutletIds);
              } else {
                  query = query.eq('property_id', scopeId);
              }
          }
          else query = query.eq('outlet_id', scopeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MassageType[];
    }
    return [];
  }

  async addMassageType(type: Omit<MassageType, 'id'>) {
    if (this.isSupabase()) {
        const { data, error } = await supabase.from('massage_types').insert([{ ...type, id: generateUUID() }]).select();
        if (error) throw error;
        await this.logAction('CREATE_TREATMENT', `Service portfolio item added: ${type.name}`, type.outlet_id);
        return data;
    }
  }

  async updateMassageType(id: string, updates: Partial<MassageType>) {
    if (this.isSupabase()) {
        await supabase.from('massage_types').update(updates).eq('id', id);
        await this.logAction('UPDATE_TREATMENT', `Service modified: ${id}`);
    }
  }

  async deleteMassageType(id: string) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('massage_types').delete().eq('id', id);
        if (error) throw error;
        await this.logAction('DELETE_TREATMENT', `Service retired: ${id}`);
    }
  }

  async getMassageBookings(scopeId: string, isPropertyScope: boolean = false, limitToOutletIds?: string[], startDate?: string): Promise<MassageBooking[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        // Optimization: Select only required columns to reduce payload size and query time
        const selectCols = 'id,date,start_time,end_time,guest_id,guest_name,guest_phone,massage_type_id,outlet_id,property_id,room_id,therapist_id,status,notes,total_price,is_paid,staff_id,created_at,updated_at,inventory_item_id,member_id';
        let query = supabase.from('massage_bookings').select(selectCols);
        if (isPropertyScope) {
            if (limitToOutletIds && limitToOutletIds.length > 0) {
                query = query.in('outlet_id', limitToOutletIds);
            } else {
                query = query.eq('property_id', scopeId);
            }
        }
        else query = query.eq('outlet_id', scopeId);

        if (startDate) {
            query = query.gte('date', startDate);
        }

        // Reduced limit to 5000 to improve performance and prevent statement timeouts
        const { data, error } = await query.order('date', { ascending: false }).limit(startDate ? 5000 : 1000);
        if (error) throw error;
        return (data || []) as any as MassageBooking[];
      }, []);
    }
    return [];
  }

  async getMassageBookingsByDate(scopeId: string, isPropertyScope: boolean, dateStr: string): Promise<MassageBooking[]> {
    if (this.isSupabase()) {
      let query = supabase.from('massage_bookings').select('*');
      if (isPropertyScope) query = query.eq('property_id', scopeId);
      else query = query.eq('outlet_id', scopeId);
      
      query = query.eq('date', dateStr);

      const { data, error } = await query.order('start_time', { ascending: true });
      if (error) throw error;
      return (data || []) as MassageBooking[];
    }
    return [];
  }

  async getMassageBookingsByDateRange(scopeId: string, isPropertyScope: boolean, startDate: string, endDate: string): Promise<MassageBooking[]> {
    if (this.isSupabase()) {
      let query = supabase.from('massage_bookings').select('*');
      if (isPropertyScope) query = query.eq('property_id', scopeId);
      else query = query.eq('outlet_id', scopeId);
      
      query = query.gte('date', startDate).lte('date', endDate);

      const { data, error } = await query.order('date', { ascending: false }).order('start_time', { ascending: true });
      if (error) throw error;
      return (data || []) as MassageBooking[];
    }
    return [];
  }

  async addMassageBooking(booking: Omit<MassageBooking, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error } = await supabase.from('massage_bookings').insert([{ ...booking, id: generateUUID(), created_at: new Date().toISOString() }]);
        if (error) throw error;
        await this.logAction('CREATE_BOOKING', `Created booking on ${booking.date} at ${booking.start_time} (Therapist ID: ${booking.therapist_id})`, booking.outlet_id);
        
        const { data: guestData } = await supabase.from('guests').select('name').eq('id', booking.guest_id).single();
        const guestName = guestData?.name || 'A guest';

        // Add notification for the therapist AND admins
        if (booking.therapist_id && booking.therapist_id !== 'unassigned') {
          await this.addNotification({
            title: 'New Booking Assigned',
            message: `You have a new booking for ${guestName} on ${booking.date} at ${booking.start_time}.`,
            type: 'info',
            outlet_id: booking.outlet_id,
            user_id: booking.therapist_id // TARGETED to assigned staff
          });
        }
      }, null);
    }
    
    // Trigger local event for real-time updates
    window.dispatchEvent(new CustomEvent('booking_updated', { detail: { outlet_id: booking.outlet_id } }));
    
    // Also broadcast via Supabase for other clients (instant peer-to-peer)
    if (this.isSupabase()) {
      supabase.channel(`massage-bookings-${booking.outlet_id}`)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            supabase.channel(`massage-bookings-${booking.outlet_id}`).send({
              type: 'broadcast',
              event: 'sync',
              payload: { type: 'booking_created', outlet_id: booking.outlet_id }
            });
          }
        });
    }
  }

  async updateMassageBooking(id: string, updates: Partial<MassageBooking>) {
    let booking: MassageBooking | null = null;
    if (this.isSupabase()) {
      // Get current booking to notify therapist
      const { data } = await supabase.from('massage_bookings').select('*').eq('id', id).single();
      booking = data;
      
      await this.safeCall(async () => {
        const { error } = await supabase.from('massage_bookings').update(updates).eq('id', id);
        if (error) throw error;
        
        const guestId = updates.guest_id || booking?.guest_id;
        let guestName = 'A guest';
        if (guestId) {
          const { data: guestData } = await supabase.from('guests').select('name').eq('id', guestId).single();
          if (guestData && guestData.name) {
            guestName = guestData.name;
          }
        }

        const currentTherapistId = booking?.therapist_id && booking.therapist_id !== 'unassigned' ? booking.therapist_id : null;
        const newTherapistId = updates.therapist_id && updates.therapist_id !== 'unassigned' ? updates.therapist_id : null;
        const bookingDate = updates.date || booking?.date || '';
        const bookingStart = updates.start_time || booking?.start_time || '';

        // Check if there's actually a change in therapist
        if (updates.therapist_id !== undefined && newTherapistId !== currentTherapistId) {
          // It was unassigned/someone else, now it's newTherapistId
          if (newTherapistId) {
            await this.addNotification({
              title: 'Booking Assigned To You',
              message: `A booking for ${guestName} on ${bookingDate} at ${bookingStart} has been assigned to you.`,
              type: 'info',
              outlet_id: updates.outlet_id || booking?.outlet_id,
              user_id: newTherapistId
            });
          }
          
          // It was currentTherapistId, now it's someone else or unassigned
          if (currentTherapistId) {
            await this.addNotification({
              title: 'Booking Reassigned',
              message: `Your booking for ${guestName} on ${bookingDate} at ${bookingStart} has been reassigned to another staff member.`,
              type: 'warning',
              outlet_id: booking?.outlet_id,
              user_id: currentTherapistId // TARGETED to the staff member who was removed
            });
          }
        } else {
          // Same therapist, but something else changed
          const therapistId = newTherapistId || currentTherapistId;
          if (therapistId) {
            await this.addNotification({
              title: 'Booking Modified',
              message: `Your booking for ${guestName} on ${bookingDate} at ${bookingStart} has been updated.`,
              type: 'info',
              outlet_id: booking?.outlet_id,
              user_id: therapistId // TARGETED to assigned staff
            });
          }
        }
      }, null);
    }
    
    // Trigger local event
    if (updates.outlet_id || booking?.outlet_id) {
      const oid = updates.outlet_id || booking?.outlet_id;
      window.dispatchEvent(new CustomEvent('booking_updated', { detail: { outlet_id: oid } }));
      
      if (this.isSupabase()) {
        supabase.channel(`massage-bookings-${oid}`).send({
          type: 'broadcast',
          event: 'sync',
          payload: { type: 'booking_updated', outlet_id: oid }
        });
      }
    } else {
      window.dispatchEvent(new CustomEvent('booking_updated', { detail: {} }));
    }
  }

  async updateMassageBookingStatus(id: string, status: MassageBooking['status'], roomId?: string, paymentMethod?: MassageBooking['payment_method']) {
    if (this.isSupabase()) {
      const { data: booking } = await supabase.from('massage_bookings').select('*').eq('id', id).single();
      if (!booking) return;

      const updates: any = { status };
      if (roomId) updates.room_id = roomId;
      if (paymentMethod) updates.payment_method = paymentMethod;

      const { error } = await supabase.from('massage_bookings').update(updates).eq('id', id);
      if (error) throw error;

      // Notification for status change
      if (status && status !== booking.status) {
          const { data: guest } = await supabase.from('guests').select('name').eq('id', booking.guest_id).single();
          await this.addNotification({
              title: `Booking ${status.charAt(0).toUpperCase() + status.slice(1)}`,
              message: `Booking for ${guest?.name || 'Guest'} on ${booking.date} has been marked as ${status}.`,
              type: status === 'cancelled' ? 'warning' : status === 'completed' ? 'success' : 'info',
              outlet_id: booking.outlet_id,
              user_id: booking.therapist_id, // TARGETED to assigned therapist
              required_permission: 'bookings:view'
          });
      }

      // If status changed FROM completed TO something else, delete the associated sale
      if (booking.status === 'completed' && status !== 'completed') {
          await supabase.from('sales').delete().eq('booking_id', id);
          await this.logAction('BOOKING_UNSERVED', `Sale record removed for booking ${id} as status changed to ${status}`);
      }

      // If status changed TO completed, create a sale record
      if (status === 'completed' && booking.status !== 'completed') {
        const { data: guest } = await supabase.from('guests').select('name').eq('id', booking.guest_id).single();
        
        let itemName = 'Service';
        let itemCategory = 'Massage';
        let itemId = null;

        if (booking.inventory_item_id) {
            const { data: inv } = await supabase.from('inventory').select('name, category').eq('id', booking.inventory_item_id).single();
            if (inv) {
                itemName = inv.name;
                itemCategory = inv.category;
                itemId = booking.inventory_item_id;
            }
        } else if (booking.massage_type_id) {
            const { data: type } = await supabase.from('massage_types').select('name, category').eq('id', booking.massage_type_id).single();
            if (type) {
                itemName = type.name;
                itemCategory = type.category || 'Massage';
            }
        }

        const sale: Omit<Sale, 'id' | 'created_at'> = {
          property_id: booking.property_id,
          outlet_id: booking.outlet_id,
          guest_id: booking.guest_id,
          guest_name: guest?.name || 'Guest',
          category: itemCategory as SaleCategory,
          item_id: itemId,
          item_name: itemName,
          quantity: 1,
          unit_price: booking.price + (booking.discount || 0),
          gross_amount: booking.price + (booking.discount || 0),
          discount_amount: booking.discount || 0,
          net_amount: booking.price,
          payment_method: 'Cash', // Default
          status: 'completed',
          sold_by_id: booking.therapist_id,
          booking_id: booking.id,
          discount_reason: booking.discount_reason,
          discount_id_url: booking.discount_id_url,
          remarks: ''
        };

        await this.addSale(sale);

        // Add notification for completed booking
        await this.addNotification({
          title: 'Booking Completed',
          message: `Booking for ${guest?.name || 'Guest'} has been marked as completed.`,
          type: 'success',
          outlet_id: booking.outlet_id
        });
      }
    }
    // Trigger local event
    window.dispatchEvent(new CustomEvent('booking_updated', { detail: {} }));
  }

  subscribeToStaffPortalEvents(outletId: string, staffId: string, callback: (payload: { eventType: string, table: string, new: any }) => void) {
    let supabaseUnsubscribeList: (() => void)[] = [];

    if (this.isSupabase()) {
      const tables = ['massage_bookings', 'sales', 'members'];
      const channelName = `staff-events-${outletId}`;
      let channel = supabase.channel(channelName);
      
      tables.forEach(table => {
        channel = channel.on(
            'postgres_changes',
            {
              event: '*', // Listen to all events to catch updates/assignments
              schema: 'public',
              table: table,
              filter: `outlet_id=eq.${outletId}`
            },
            (payload) => {
              callback({ eventType: payload.eventType, table, new: payload.new });
            }
        );
      });
      
      channel.subscribe();

      supabaseUnsubscribeList.push(() => {
        supabase.removeChannel(channel);
      });
    }

    // Local mode listeners
    const handleLocalBooking = (event: any) => callback({ eventType: 'INSERT', table: 'massage_bookings', new: event.detail });
    const handleLocalSale = (event: any) => callback({ eventType: 'INSERT', table: 'sales', new: event.detail });
    const handleLocalMember = (event: any) => callback({ eventType: 'INSERT', table: 'members', new: event.detail });

    window.addEventListener('booking_updated', handleLocalBooking);
    window.addEventListener('sale_created', handleLocalSale);
    window.addEventListener('member_created', handleLocalMember);

    return () => {
      supabaseUnsubscribeList.forEach(unsub => unsub());
      window.removeEventListener('booking_updated', handleLocalBooking);
      window.removeEventListener('sale_created', handleLocalSale);
      window.removeEventListener('member_created', handleLocalMember);
    };
  }

  subscribeToBookings(outletId: string, callback: (payload: { eventType: string, new: any, old?: any }) => void) {
    let supabaseUnsubscribe = () => {};

    if (this.isSupabase()) {
      const channelName = `bookings-${outletId}`;
      const channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'massage_bookings',
            filter: `outlet_id=eq.${outletId}`
          },
          (payload) => {
            callback(payload);
          }
        )
        .subscribe();

      supabaseUnsubscribe = () => {
        supabase.removeChannel(channel);
      };
    }

    // Local mode listener
    const handleLocalUpdate = (event: any) => {
      const detail = event.detail;
      if (!detail.outlet_id || detail.outlet_id === outletId) {
        callback({ eventType: 'UPDATE', new: {} });
      }
    };
    window.addEventListener('booking_updated', handleLocalUpdate);

    return () => {
      supabaseUnsubscribe();
      window.removeEventListener('booking_updated', handleLocalUpdate);
    };
  }

  async deleteMassageBooking(id: string) {
    if (this.isSupabase()) {
      // Get booking info to notify therapist before deletion
      const { data: booking } = await supabase.from('massage_bookings').select('*, guests(name)').eq('id', id).single();
      
      // Also delete any associated sales
      await supabase.from('sales').delete().eq('booking_id', id);
      const { error } = await supabase.from('massage_bookings').delete().eq('id', id);
      if (error) throw error;
      await this.logAction('DELETE_BOOKING', `Deleted booking ID: ${id}`);

      if (booking) {
        await this.addNotification({
          title: 'Booking Cancelled',
          message: `Booking for ${booking.guests?.name || 'Guest'} on ${booking.date} has been cancelled.`,
          type: 'warning',
          outlet_id: booking.outlet_id,
          user_id: booking.therapist_id
        });
      }
    }
    
    // Trigger local event
    window.dispatchEvent(new CustomEvent('booking_updated', { detail: {} }));
  }

  async getIncentiveRules(propertyId?: string, outletId?: string): Promise<IncentiveRule[]> {
    if (this.isSupabase()) {
      try {
        let query = supabase.from('incentive_rules').select('*').order('created_at', { ascending: false });
        if (propertyId || outletId) {
            const filterArr = ["scope.eq.Global"];
            if (propertyId) filterArr.push(`and(scope.eq.Property,scope_id.eq.${propertyId})`);
            if (outletId) filterArr.push(`and(scope.eq.Outlet,scope_id.eq.${outletId})`);
            query = query.or(filterArr.join(','));
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as IncentiveRule[];
      } catch (e) { return []; }
    }
    return [];
  }

  async addIncentiveRule(rule: Omit<IncentiveRule, 'id'>) {
    if (this.isSupabase()) {
        const { data, error } = await supabase.from('incentive_rules').insert([{ ...rule, id: generateUUID(), created_at: new Date().toISOString() }]).select();
        if (error) throw error;
        await this.logAction('CREATE_INCENTIVE', `Yield strategy authorized: ${rule.name}`);
        return data;
    }
  }

  async updateIncentiveRule(id: string, updates: Partial<IncentiveRule>) {
    if (this.isSupabase()) {
        await supabase.from('incentive_rules').update(updates).eq('id', id);
        await this.logAction('UPDATE_INCENTIVE', `Incentive logic adjusted: ${id}`);
    }
  }

  async deleteIncentiveRule(id: string) {
    if (this.isSupabase()) {
        await supabase.from('incentive_rules').delete().eq('id', id);
        await this.logAction('DELETE_INCENTIVE', `Incentive rule decommissioned: ${id}`);
    }
  }

  async updateMemberNotes(id: string, notes: string) {
    if (this.isSupabase()) {
        await supabase.from('members').update({ notes }).eq('id', id);
        await this.logAction('UPDATE_MEMBER_NOTES', `Member notes updated for ID: ${id}`);
    } else {
        // Local Mode Fallback
        const members = JSON.parse(safeStorage.getItem('membership_members') || '[]');
        const mIndex = members.findIndex((mem: any) => mem.id === id);
        if (mIndex !== -1) {
            members[mIndex] = { ...members[mIndex], notes };
            safeStorage.setItem('membership_members', JSON.stringify(members));
            await this.logAction('UPDATE_MEMBER_NOTES', `Member notes updated locally for ID: ${id}`);
        }
    }
  }

  // --- REPORT RECIPIENTS ---
  async getReportRecipients() {
    const cached = JSON.parse(safeStorage.getItem('membership_report_recipients') || '[]') as ReportRecipient[];
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('report_recipients').select('*');
        if (error) throw error;
        const res = (data || []) as ReportRecipient[];
        safeStorage.setItem('membership_report_recipients', JSON.stringify(res));
        return res;
      }, cached);
    }
    return cached;
  }

  async addReportRecipient(recipient: Omit<ReportRecipient, 'id' | 'created_at'>) {
    const newRecipient = {
      ...recipient,
      id: this.generateUUID(),
      created_at: new Date().toISOString()
    };

    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error } = await supabase.from('report_recipients').insert([newRecipient]);
        if (error) throw error;
      }, null);
    }
    
    // Always sync with local storage
    const recipients = await this.getReportRecipients();
    if (!recipients.some(r => r.id === newRecipient.id)) {
      recipients.push(newRecipient);
      safeStorage.setItem('membership_report_recipients', JSON.stringify(recipients));
    }
    
    await this.logAction('ADD_RECIPIENT', `Report recipient added: ${recipient.email}`);
    return newRecipient;
  }

  async deleteReportRecipient(id: string) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error } = await supabase.from('report_recipients').delete().eq('id', id);
        if (error) throw error;
      }, null);
    }
    
    // Always sync with local storage
    const recipients = await this.getReportRecipients();
    const filtered = recipients.filter(r => r.id !== id);
    safeStorage.setItem('membership_report_recipients', JSON.stringify(filtered));
    
    await this.logAction('DELETE_RECIPIENT', `Report recipient removed: ${id}`);
  }

  async updateReportRecipient(id: string, updates: Partial<ReportRecipient>) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error } = await supabase.from('report_recipients').update(updates).eq('id', id);
        if (error) throw error;
      }, null);
    }
    
    // Always sync with local storage
    const recipients = await this.getReportRecipients();
    const index = recipients.findIndex(r => r.id === id);
    if (index !== -1) {
      recipients[index] = { ...recipients[index], ...updates };
      safeStorage.setItem('membership_report_recipients', JSON.stringify(recipients));
    }
    
    await this.logAction('UPDATE_RECIPIENT', `Report recipient updated: ${id}`);
  }

  // --- CUSTOM REPORT CONFIGS ---
  async getCustomReports(propertyId?: string, outletId?: string) {
    const cached = JSON.parse(safeStorage.getItem('membership_custom_reports') || '[]') as CustomReportConfig[];
    let filteredCached = cached;
    if (propertyId) filteredCached = filteredCached.filter(r => r.property_id === propertyId);
    if (outletId && outletId !== 'all') filteredCached = filteredCached.filter(r => r.outlet_id === outletId);

    if (this.isSupabase()) {
      return this.safeCall(async () => {
        let query = supabase.from('custom_reports').select('*');
        if (propertyId) query = query.eq('property_id', propertyId);
        if (outletId && outletId !== 'all') query = query.eq('outlet_id', outletId);
        const { data, error } = await query;
        if (error) throw error;
        const res = (data || []) as CustomReportConfig[];
        
        // Merge with existing cached items
        const allCached = JSON.parse(safeStorage.getItem('membership_custom_reports') || '[]') as CustomReportConfig[];
        const otherCached = allCached.filter(r => {
          if (propertyId && r.property_id !== propertyId) return true;
          if (outletId && outletId !== 'all' && r.outlet_id !== outletId) return true;
          return false;
        });
        safeStorage.setItem('membership_custom_reports', JSON.stringify([...otherCached, ...res]));
        return res;
      }, filteredCached);
    }
    return filteredCached;
  }

  async addCustomReport(config: Omit<CustomReportConfig, 'id' | 'created_at'>) {
    const newReport = {
      ...config,
      id: this.generateUUID(),
      created_at: new Date().toISOString()
    };

    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error } = await supabase.from('custom_reports').insert([newReport]);
        if (error) throw error;
      }, null);
    }
    
    // Always sync with local storage
    const reports = await this.getCustomReports();
    if (!reports.some(r => r.id === newReport.id)) {
      reports.push(newReport);
      safeStorage.setItem('membership_custom_reports', JSON.stringify(reports));
    }
    
    await this.logAction('ADD_CUSTOM_REPORT', `Custom report defined: ${config.name}`);
    return newReport;
  }

  async updateCustomReport(id: string, updates: Partial<CustomReportConfig>) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error } = await supabase.from('custom_reports').update(updates).eq('id', id);
        if (error) throw error;
      }, null);
    }
    
    // Always sync with local storage
    const reports = await this.getCustomReports();
    const index = reports.findIndex(r => r.id === id);
    if (index !== -1) {
      reports[index] = { ...reports[index], ...updates };
      safeStorage.setItem('membership_custom_reports', JSON.stringify(reports));
    }
    
    await this.logAction('UPDATE_CUSTOM_REPORT', `Custom report modified: ${id}`);
  }

  async deleteCustomReport(id: string) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error } = await supabase.from('custom_reports').delete().eq('id', id);
        if (error) throw error;
      }, null);
    }
    
    // Always sync with local storage
    const reports = await this.getCustomReports();
    const filtered = reports.filter(r => r.id !== id);
    safeStorage.setItem('membership_custom_reports', JSON.stringify(filtered));
    
    await this.logAction('DELETE_CUSTOM_REPORT', `Custom report removed: ${id}`);
  }

  async sendTestReport(recipientId: string) {
    if (this.isSupabase()) {
      const { data, error } = await supabase.functions.invoke('send-reports', {
        body: { test: true, recipientId }
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || 'Failed to send report');
      if (data && data.results && data.results.some((r: any) => r.status === 'error')) {
        const errResult = data.results.find((r: any) => r.status === 'error');
        throw new Error(errResult.error || 'Failed to send email to recipient');
      }
      return data;
    } else {
      console.log('Mock: Sending test report to recipient', recipientId);
      return { success: true, results: [{ status: 'sent (mock)' }] };
    }
  }
  // --- NOTIFICATIONS ---
  async getNotifications(userId?: string, outletId?: string, isAdmin: boolean = false): Promise<Notification[]> {
    console.log('Fetching notifications for:', { userId, outletId, isAdmin });
    if (this.isSupabase()) {
      let query = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(100);
      
      // Fetch all relevant notifications (targeted to user or system-wide)
      // Admins see EVERYTHING for the outlet (including global ones)
      // Staff ONLY see their own targeted notifications
      if (userId && !isAdmin) {
        query = query.eq('user_id', userId);
      } else if (userId && isAdmin) {
        query = query.or(`user_id.eq.${userId},user_id.is.null`);
      } else if (!userId) {
        query = query.is('user_id', null);
      }
      
      const { data, error } = await query;
      if (error) {
        if (error.code !== 'PGRST205') {
          console.warn("Failed to fetch notifications from Supabase, falling back to local storage", error);
        }
        return this.getLocalNotifications(userId, outletId);
      }
      
      let notifications = (data || []) as Notification[];
      
      // Filter out dismissed notifications for this user
      if (userId) {
        notifications = notifications.filter(n => !n.dismissed_by || !n.dismissed_by.includes(userId));
        
        // Map the 'read' status based on the read_by array for this user
        notifications = notifications.map(n => ({
          ...n,
          read: n.user_id === userId ? n.read : (n.read_by?.includes(userId) || false)
        }));
      }
      
      // Client-side filter for outlet_id
      if (outletId) {
        notifications = notifications.filter(n => !n.outlet_id || n.outlet_id === outletId);
      }
      
      console.log(`Fetched ${notifications.length} notifications from Supabase`);
      return notifications;
    }
    return this.getLocalNotifications(userId, outletId);
  }

  private getLocalNotifications(userId?: string, outletId?: string): Notification[] {
    const all = JSON.parse(safeStorage.getItem('membership_notifications') || '[]') as Notification[];
    console.log('getLocalNotifications: all count', all.length, 'userId', userId);
    let filtered = all;
    
    if (userId) {
      // Filter out dismissed notifications for this user
      filtered = filtered.filter(n => !n.dismissed_by || !n.dismissed_by.includes(userId));
      console.log('getLocalNotifications: after dismiss filter', filtered.length);
      
      // Map the 'read' status based on the read_by array for this user
      filtered = filtered.map(n => ({
        ...n,
        read: n.user_id === userId ? n.read : (n.read_by?.includes(userId) || false)
      }));
    } else {
      filtered = filtered.filter(n => !n.user_id);
    }
    
    if (outletId) {
      filtered = filtered.filter(n => !n.outlet_id || n.outlet_id === outletId);
    }

    console.log('getLocalNotifications: final count', filtered.length);
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async addNotification(notification: Omit<Notification, 'id' | 'created_at' | 'read'>) {
    console.log('Adding notification:', notification.title);
    
    // Prepare notification object - let database handle id and created_at if possible
    const dbNotification: any = {
      title: notification.title,
      message: notification.message,
      type: notification.type || 'info',
      outlet_id: notification.outlet_id || null,
      user_id: notification.user_id || null,
      read: false,
      read_by: [],
      dismissed_by: []
    };

    if (this.isSupabase()) {
      try {
        console.log(`[Push] Attempting to save and trigger push for: "${notification.title}"`);
        
        // Use plain insert to avoid 409 conflicts. id and created_at are generated by DB.
        const { error } = await supabase.from('notifications').insert([dbNotification]);
        
        if (error) {
           if (error.code === '23503') {
             console.warn("[Push] FK Violation: target user_id not found in 'users' table. Retrying with user_id=null (global) to preserve history.");
             // Fallback: save as a global notification if the recipient is a staff member not in the users table
             const fallbackNotification = { ...dbNotification, user_id: null };
             await supabase.from('notifications').insert([fallbackNotification]);
           } else {
             console.warn("[Push] Supabase insert error (falling back to local):", error);
             this.saveLocalNotification({ ...dbNotification, id: this.generateUUID(), created_at: new Date().toISOString() });
           }
        } else {
           console.log('[Push] Notification persisted to Supabase.');
        }
        
        // TRIGGER PUSH NOTIFICATION: This is the most critical part for real-time alerts
        const recipients = new Set<string>();
        if (notification.user_id) recipients.add(notification.user_id);

        // Map titles to keywords for automated staff/admin alerts
        const title = (notification.title || '').toLowerCase();
        const keywords = [
            'booking', 'membership', 'sale', 'assigned', 'cancel', 
            'delete', 'modify', 'remove', 'reschedule', 'waitlist',
            'payment', 'checkout', 'check-in', 'staff'
        ];
        
        const isImportant = keywords.some(kw => title.includes(kw));

        if (isImportant || !notification.user_id) {
          // Notify all admins for these events
          const { data: admins } = await supabase.from('staff').select('id').ilike('role', 'admin');
          admins?.forEach(a => recipients.add(a.id));
        }

        if (recipients.size > 0) {
          console.log(`[Push] Initiating targeted push for ${recipients.size} recipients:`, Array.from(recipients));
          recipients.forEach(rid => {
              this.triggerPushNotification(
                  rid, 
                  notification.title, 
                  notification.message
              ).catch(err => console.error(`[Push] Trigger failure for ${rid}:`, err));
          });
        } else {
           console.log(`[Push] No specific recipients found for push trigger. Skipping push notification (will remain in-app only).`);
        }
      } catch (e) {
        console.error('[Push] Fatal error in addNotification sequence:', e);
        this.saveLocalNotification({ ...dbNotification, id: this.generateUUID(), created_at: new Date().toISOString() });
      }
    } else {
      this.saveLocalNotification({ ...dbNotification, id: this.generateUUID(), created_at: new Date().toISOString() });
    }
    
    const finalLocalNotif = { ...dbNotification, id: this.generateUUID(), created_at: new Date().toISOString() };
    this.broadcastNotificationLocally(finalLocalNotif);
    return finalLocalNotif;
  }

  private async triggerGlobalPush(n: Notification) {
    try {
        console.log(`[Push] Global notification: Broadcasting "${n.title}" to all logged-in staff...`);
        // We now call the Edge Function ONCE with broadcast: true for efficiency
        await this.triggerPushNotification(
            "global-broadcast", 
            n.title, 
            n.message, 
            '/notifications',
            true // Enable broadcast mode
        );
        console.log("[Push] Global broadcast triggered successfully.");
    } catch (e) {
        console.warn("[Push] Fault while triggering global broadcast:", e);
    }
  }

  async triggerPushNotification(userId: string, title: string, body: string, url: string = '/#/notifications', broadcast: boolean = false) {
    if (!this.isSupabase()) {
        console.log('Push notification trigger skipped: Supabase offline');
        return;
    }
    try {
        const payload = { 
            userId: broadcast ? undefined : userId,
            broadcast,
            title, 
            body, 
            url,
            id: generateUUID(), 
            icon: '/notification-icon.png',
            tag: broadcast ? 'global-staff-alert' : 'direct-alert'
        };
        console.log(`[Push] Dispatching to Edge Function (${broadcast ? 'BROADCAST' : 'DIRECT'}):`, JSON.stringify(payload, null, 2));
        
        // Use a timeout for the invoke call to prevent hanging the UI
        const invokePromise = supabase.functions.invoke('send-push', {
            method: 'POST',
            body: payload 
        });

        const timeoutPromise = new Promise<{data: any, error: any}>((_, reject) => 
            setTimeout(() => reject(new Error('Edge Function invocation timed out (15s)')), 15000)
        );

        const { data, error } = await Promise.race([invokePromise, timeoutPromise]) as any;

        if (error) {
            console.error('[Push] Edge Function error response:', error);
            throw error;
        }
        
        console.log('[Push] Edge Function success response:', data);
        if (data?.success) {
            console.log(`[Push] DONE: Sent to ${data.sentCount || 0} subscriptions.`);
        }
    } catch (e: any) {
        console.error('❌ [Push] FATAL error triggering push:', e.message || e);
        throw e;
    }
  }

  private broadcastNotificationLocally(notification: Notification) {
    // Broadcast for local mode real-time updates across tabs
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        const bc = new BroadcastChannel('notifications_channel');
        bc.postMessage(notification);
        bc.close();
      } catch (e) {
        console.warn("BroadcastChannel failed", e);
      }
    }
    // Dispatch custom event for same-tab updates
    // window.dispatchEvent(new CustomEvent('notification_received', { detail: notification }));
  }

  private saveLocalNotification(notification: Notification) {
    const notifications = JSON.parse(safeStorage.getItem('membership_notifications') || '[]');
    notifications.push(notification);
    safeStorage.setItem('membership_notifications', JSON.stringify(notifications));
  }

  async markNotificationAsRead(id: string, userId?: string) {
    if (this.isSupabase()) {
      try {
        // Fetch current state to update arrays
        const { data: n, error: fetchError } = await supabase.from('notifications').select('*').eq('id', id).single();
        if (n && !fetchError) {
          if (n.user_id === userId) {
            // Direct targeted notification
            await supabase.from('notifications').update({ read: true }).eq('id', id);
          } else if (userId) {
            // Shared notification - update read_by array if column exists
            if ('read_by' in n) {
              const readBy = (n.read_by || []) as string[];
              if (!readBy.includes(userId)) {
                await supabase.from('notifications').update({ read_by: [...readBy, userId] }).eq('id', id);
              }
            } else {
              // Fallback: if column doesn't exist, we can't do user-wise read in DB
              // We just mark the main 'read' as true (this will affect everyone, but it's better than nothing)
              // OR we just rely on local storage
              await supabase.from('notifications').update({ read: true }).eq('id', id);
            }
          }
        }
      } catch (err) {
        console.warn('Error marking notification as read in Supabase:', err);
      }
    }
    this.updateLocalNotification(id, { read: true }, userId);
  }

  async markAllNotificationsAsRead(userId?: string, outletId?: string, ids?: string[]) {
    console.log('Marking all notifications as read user-wise:', { userId, outletId, idsCount: ids?.length });
    if (this.isSupabase() && userId) {
      try {
        // For bulk updates, we fetch and then update each to ensure user-wise isolation
        const { data: unreadDocs } = await supabase.from('notifications')
          .select('*')
          .in('id', ids || []);
        
        if (unreadDocs) {
          // Group 1: Notifications owned by the current user - can be updated in bulk
          const ownedIds = unreadDocs
            .filter(doc => doc.user_id === userId)
            .map(doc => doc.id);
          
          if (ownedIds.length > 0) {
            await supabase.from('notifications')
              .update({ read: true })
              .in('id', ownedIds);
          }

          // Group 2: Shared notifications - need individual updates to handle read_by arrays
          const sharedDocs = unreadDocs.filter(doc => doc.user_id !== userId);
          for (const doc of sharedDocs) {
            if ('read_by' in doc) {
              const readBy = (doc.read_by || []) as string[];
              if (!readBy.includes(userId)) {
                await supabase.from('notifications')
                  .update({ read_by: [...readBy, userId] })
                  .eq('id', doc.id);
              }
            } else {
              // Fallback if read_by doesn't exist
              await supabase.from('notifications')
                .update({ read: true })
                .eq('id', doc.id);
            }
          }
        }
      } catch (err) {
        console.warn('Error marking all notifications as read in Supabase:', err);
      }
    }
    this.markAllLocalNotificationsAsRead(userId, outletId, ids);
  }

  private updateLocalNotification(id: string, updates: Partial<Notification>, userId?: string) {
    const notifications = JSON.parse(safeStorage.getItem('membership_notifications') || '[]') as Notification[];
    const index = notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      const n = notifications[index];
      if (userId && updates.read) {
        if (n.user_id === userId) {
          notifications[index] = { ...n, read: true };
        } else {
          const readBy = n.read_by || [];
          if (!readBy.includes(userId)) {
            notifications[index] = { ...n, read_by: [...readBy, userId] };
          }
        }
      } else {
        notifications[index] = { ...n, ...updates };
      }
      safeStorage.setItem('membership_notifications', JSON.stringify(notifications));
    }
  }

  private markAllLocalNotificationsAsRead(userId?: string, outletId?: string, ids?: string[]) {
    const notifications = JSON.parse(safeStorage.getItem('membership_notifications') || '[]') as Notification[];
    const updated = notifications.map(n => {
      // Check if already read by this user
      const isRead = n.user_id === userId ? n.read : (n.read_by?.includes(userId || '') || false);
      if (isRead) return n;
      
      let shouldMark = false;
      if (ids && ids.length > 0) {
        if (ids.includes(n.id)) shouldMark = true;
      } else {
        const userMatch = !userId || !n.user_id || n.user_id === userId;
        const outletMatch = !outletId || !n.outlet_id || n.outlet_id === outletId;
        if (userMatch && outletMatch) shouldMark = true;
      }

      if (shouldMark && userId) {
        if (n.user_id === userId) return { ...n, read: true };
        const readBy = n.read_by || [];
        return { ...n, read_by: [...readBy, userId] };
      }
      return n;
    });
    safeStorage.setItem('membership_notifications', JSON.stringify(updated));
  }

  async deleteNotification(id: string, userId?: string) {
    if (this.isSupabase() && userId) {
      try {
        // Soft delete: add to dismissed_by instead of actual delete
        const { data: n, error: fetchError } = await supabase.from('notifications').select('*').eq('id', id).single();
        if (n && !fetchError) {
          if ('dismissed_by' in n) {
            const dismissedBy = (n.dismissed_by || []) as string[];
            if (!dismissedBy.includes(userId)) {
              await supabase.from('notifications').update({ dismissed_by: [...dismissedBy, userId] }).eq('id', id);
            }
          } else {
            // Fallback: if column doesn't exist, we have to hard delete or just rely on local storage
            // Given the requirement "never permanently delete", we might have to just rely on local storage
            // But for now, let's just do nothing in DB if column is missing to prevent errors
            console.warn('dismissed_by column missing in Supabase, dismissal will be local only');
          }
        }
      } catch (err) {
        console.warn('Error dismissing notification in Supabase:', err);
      }
    }
    this.deleteLocalNotification(id, userId);
  }

  async deleteAllNotifications(userId?: string, outletId?: string, ids?: string[]) {
    console.log('Dismissing all notifications user-wise:', { userId, outletId, idsCount: ids?.length });
    if (this.isSupabase() && userId) {
      try {
        // Soft delete for all
        const { data: docs } = await supabase.from('notifications')
          .select('*')
          .in('id', ids || []);
        
        if (docs) {
          for (const doc of docs) {
            if ('dismissed_by' in doc) {
              const dismissedBy = (doc.dismissed_by || []) as string[];
              if (!dismissedBy.includes(userId)) {
                await supabase.from('notifications').update({ dismissed_by: [...dismissedBy, userId] }).eq('id', doc.id);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Error dismissing all notifications in Supabase:', err);
      }
    }
    this.deleteAllLocalNotifications(userId, outletId, ids);
  }

  subscribeToNotifications(userId: string, outletId: string | undefined, isAdmin: boolean = false, callback: (payload: { eventType: string, new: any, old?: any }) => void) {
    // Shared BroadcastChannel handler for cross-tab updates
    let bc: BroadcastChannel | null = null;
    
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('notifications_channel');
        bc.onmessage = (event) => {
          const notification = event.data as Notification;
          // If staff (not admin), only match if explicitly targeted to them
          // If admin, match if targeted to them OR global (null user_id)
          const userMatch = isAdmin 
            ? (notification.user_id === userId || !notification.user_id) 
            : (notification.user_id === userId);
            
          const outletMatch = !outletId || !notification.outlet_id || notification.outlet_id === outletId;
          
          if (userMatch && outletMatch) {
            // We assume BroadcastChannel only sends new notifications
            callback({ eventType: 'INSERT', new: notification });
          }
        };
      } catch(e) {
        console.warn("Broadcast channel init failed", e);
      }
    }

    // Only subscribe to Supabase if enabled
    if (this.isSupabase()) {
      const handlePayload = (payload: any) => {
        const newNotification = payload.new as Notification;
        const oldNotification = payload.old as Notification;
        
        const targetNotification = newNotification || oldNotification;
        if (targetNotification) {
          // If staff (not admin), only match if explicitly targeted to them
          // If admin, match if targeted to them OR global (null user_id)
          const userMatch = isAdmin 
            ? (targetNotification.user_id === userId || !targetNotification.user_id) 
            : (targetNotification.user_id === userId);
            
          const outletMatch = !outletId || !targetNotification.outlet_id || targetNotification.outlet_id === outletId;
          
          if (userMatch && outletMatch) {
            callback({
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old
            });
          }
        }
      };

      // Generate a unique channel name to avoid reuse conflicts between different login sessions or visibility toggles
      const getChannelName = () => `notifications-realtime-${userId}`;
      
      let channel = supabase
        .channel(getChannelName())
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications' },
          handlePayload
        )
        .subscribe();
      
      // Reconnection logic on mobile visibility change
      const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
              console.log('Visibility changed to visible, re-subscribing Supabase channel...');
              // Complete cleanup before creating a new one
              if (channel) {
                supabase.removeChannel(channel);
              }
              channel = supabase
                  .channel(getChannelName())
                  .on(
                      'postgres_changes',
                      { event: '*', schema: 'public', table: 'notifications' },
                      handlePayload
                  )
                  .subscribe();
          }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        supabase.removeChannel(channel);
        if (bc) bc.close();
      };
    } else {
      return () => {
        if (bc) bc.close();
      };
    }
  }

  private deleteLocalNotification(id: string, userId?: string) {
    const notifications = JSON.parse(safeStorage.getItem('membership_notifications') || '[]') as Notification[];
    if (userId) {
      const index = notifications.findIndex(n => n.id === id);
      if (index !== -1) {
        const dismissedBy = (notifications[index].dismissed_by || []) as string[];
        if (!dismissedBy.includes(userId)) {
          notifications[index].dismissed_by = [...dismissedBy, userId];
          safeStorage.setItem('membership_notifications', JSON.stringify(notifications));
        }
      }
    } else {
      // Fallback to actual delete if no userId (should not happen in this new flow)
      const filtered = notifications.filter(n => n.id !== id);
      safeStorage.setItem('membership_notifications', JSON.stringify(filtered));
    }
  }

  private deleteAllLocalNotifications(userId?: string, outletId?: string, ids?: string[]) {
    const notifications = JSON.parse(safeStorage.getItem('membership_notifications') || '[]') as Notification[];
    if (userId) {
      const updated = notifications.map(n => {
        let shouldDismiss = false;
        if (ids && ids.length > 0) {
          if (ids.includes(n.id)) shouldDismiss = true;
        } else {
          const userMatch = !userId || !n.user_id || n.user_id === userId;
          const outletMatch = !outletId || !n.outlet_id || n.outlet_id === outletId;
          if (userMatch && outletMatch) shouldDismiss = true;
        }

        if (shouldDismiss) {
          const dismissedBy = (n.dismissed_by || []) as string[];
          if (!dismissedBy.includes(userId)) {
            return { ...n, dismissed_by: [...dismissedBy, userId] };
          }
        }
        return n;
      });
      safeStorage.setItem('membership_notifications', JSON.stringify(updated));
    } else {
      // Fallback to actual delete
      const filtered = notifications.filter(n => {
        if (ids && ids.length > 0) {
          return !ids.includes(n.id);
        }
        const userMatch = !userId || !n.user_id || n.user_id === userId;
        const outletMatch = !outletId || !n.outlet_id || n.outlet_id === outletId;
        return !(userMatch && outletMatch);
      });
      safeStorage.setItem('membership_notifications', JSON.stringify(filtered));
    }
  }

  // --- PUSH SUBSCRIPTIONS ---
  async savePushSubscription(userId: string, subscription: any) {
    if (this.isSupabase()) {
      try {
        // We attempt to save all subscriptions (staff included) to Supabase
        // Note: The user MUST run the SQL to remove the foreign key constraint on push_subscriptions table
        // to allow staff members who are not in auth.users to have subscriptions saved.
        
        const { error } = await supabase.from('push_subscriptions').upsert([{
          user_id: userId,
          subscription: subscription,
          updated_at: new Date().toISOString()
        }], { onConflict: 'user_id' });
        
        if (error) {
           // If we still get an error, it might be the foreign key constraint
           if (error.code === '23503') {
             console.log('Push subscription FK error - saving locally. (Admin: Please remove FK constraint on push_subscriptions table)');
           } else {
             throw error;
           }
        } else {
           console.log('Push subscription saved to Supabase for user:', userId);
        }
      } catch (e) {
        console.warn('Failed to save push subscription to Supabase', e);
        this.saveLocalPushSubscription(userId, subscription);
      }
    } else {
      this.saveLocalPushSubscription(userId, subscription);
    }
  }

  private saveLocalPushSubscription(userId: string, subscription: any) {
    const subs = JSON.parse(safeStorage.getItem('membership_push_subscriptions') || '{}');
    subs[userId] = subscription;
    safeStorage.setItem('membership_push_subscriptions', JSON.stringify(subs));
  }

  async deletePushSubscription(userId: string, endpoint: string) {
    if (this.isSupabase()) {
      try {
        await supabase.from('push_subscriptions').delete().eq('user_id', userId);
      } catch (e) {
        console.warn('Failed to delete push subscription from Supabase', e);
      }
    }
    const subs = JSON.parse(safeStorage.getItem('membership_push_subscriptions') || '{}');
    delete subs[userId];
    safeStorage.setItem('membership_push_subscriptions', JSON.stringify(subs));
  }
}

export const db = new DatabaseService();
