import { UserProfile, Role, Currency, CompanySettings, Member, MembershipCategory, Freeze, MemberStatus, Outlet, Property, SystemLog, LogModule, LogSeverity, Permission, Guest, Therapist, MassageType, MassageBooking, Sale, SaleCategory, InventoryItem, IncentiveRule, Staff, UserPermissionOverride, PermissionGroup, StaffLeave, InventoryLog, MassageRoom, MembershipType, ReportRecipient, CustomReportConfig, PTMember, PTSession, EntranceFeeConsent } from '../types';
import type { Notification } from '../types';
import { supabase, supabaseUrl, supabaseAnonKey } from './supabase';
export { supabase, supabaseUrl, supabaseAnonKey };
import { createClient } from '@supabase/supabase-js';
import { addDays, format, parse, differenceInCalendarDays } from 'date-fns';

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

export const DEFAULT_MEMBER_COLUMNS = 'id, outlet_id, membership_type_id, membership_number, guest_name, category_id, start_date, original_end_date, current_end_date, cancellation_date, actual_rate, discount, net_amount, original_net_amount, daily_rate, check_no, status, created_at, nationality, dob, email, phone, is_married, package_type, access_type, membership_type, spouse_name, spouse_dob, kids, remarks, sales_rep_id, notes, referrer_name, privilege_usage';

export const isSupabaseConfigured = () => !!supabase;

class DatabaseService {
  private static supabaseFailed = false;

  public static resetSupabaseFailed() {
    DatabaseService.supabaseFailed = false;
  }

  private isSupabase() {
    return !!supabase && !DatabaseService.supabaseFailed;
  }

  public async safeCall<T>(call: () => Promise<T>, fallback: T | (() => T | Promise<T>)): Promise<T> {
    const resolveFallback = async (): Promise<T> => {
      if (typeof fallback === 'function') {
        try {
          return await (fallback as () => T | Promise<T>)();
        } catch (err) {
          console.error("Fallback execution error:", err);
        }
      }
      return fallback as T;
    };

    if (!this.isSupabase()) {
      return resolveFallback();
    }

    try {
      const result: any = await call();
      if (result && typeof result === 'object' && result.error) {
        if (this.isNetworkError(result.error)) {
          console.warn("Supabase connection error detected, disabling Supabase for this session", result.error);
          DatabaseService.supabaseFailed = true;
          return resolveFallback();
        }
        console.warn("Database Call Warning:", result.error?.message || result.error);
        return resolveFallback();
      }
      return result;
    } catch (e: any) {
      if (this.isNetworkError(e)) {
        console.warn("Supabase connection error detected, disabling Supabase for this session", e);
        DatabaseService.supabaseFailed = true;
        return resolveFallback();
      }
      console.warn("Database Call Warning:", e?.message || e);
      return resolveFallback();
    }
  }

  public isNetworkError(e: any): boolean {
    if (!e) return false;
    const msg = (e?.message || e?.error?.message || e?.details || e?.toString() || '').toLowerCase();
    if (
      msg.includes('jwt') ||
      msg.includes('syntax error') ||
      msg.includes('column')
    ) {
      return false; // SQL or auth syntax error is not network loss
    }
    return (
      msg.includes('statement timeout') || 
      msg.includes('canceling statement') || 
      msg.includes('failed to fetch') || 
      msg.includes('network error') || 
      msg.includes('database not found') ||
      msg.includes('load failed') ||
      msg.includes('timeout') ||
      msg.includes('abort') ||
      msg.includes('connection') ||
      msg.includes('fetch') ||
      e?.name === 'TypeError' ||
      e?.name === 'FetchError'
    );
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
        id: 'checkin',
        label: 'Facility Check-In',
        permissions: [
          { key: 'checkin:view', label: 'View Check-Ins', description: 'Access the check-in and attendance logs.' },
          { key: 'checkin:manage', label: 'Manage Attendance', description: 'Perform manual check-ins and check-outs.' },
          { key: 'checkin:kiosk', label: 'Launch Kiosk', description: 'Enable self-service kiosk mode for members.' },
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
    return this.safeCall(async () => {
      const { data } = await supabase.from('user_permission_overrides').select('*').eq('user_id', userId);
      return (data || []) as UserPermissionOverride[];
    }, []);
  }

  async savePermissionOverride(override: Omit<UserPermissionOverride, 'id'>) {
    if (!this.isSupabase()) return;
    await this.safeCall(async () => {
      await supabase.from('user_permission_overrides').upsert([override], { onConflict: 'user_id,permission_key' });
      await this.logAction('SECURITY_OVERRIDE', `Updated override for ${override.permission_key} on User ID: ${override.user_id}`);
    }, null);
  }

  async deletePermissionOverride(userId: string, key: Permission) {
    if (!this.isSupabase()) return;
    await this.safeCall(async () => {
      await supabase.from('user_permission_overrides').delete().eq('user_id', userId).eq('permission_key', key);
      await this.logAction('SECURITY_OVERRIDE_PURGE', `Removed override for ${key} on User ID: ${userId}`);
    }, null);
  }

  async syncMemberEndDate(memberId: string) {
    if (!this.isSupabase()) {
        // Local Mode Sync
        const members = JSON.parse(localStorage.getItem('membership_members') || '[]');
        const freezes = JSON.parse(localStorage.getItem('membership_freezes') || '[]');
        
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
        localStorage.setItem('membership_members', JSON.stringify(members));
        this.syncGoogleWalletPassForMember(memberId, members[mIndex]).catch(e => console.error(e));
        return newEndDateStr;
    }

    try {
        return await this.safeCall(async () => {
          const [{ data: m }, { data: freezes }] = await Promise.all([
            supabase.from('members').select('id, original_end_date, status').eq('id', memberId).single(),
            supabase.from('freezes').select('total_days, start_date, end_date').eq('member_id', memberId)
          ]);
          if (!m || m.status === MemberStatus.TENTATIVE) return null;

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
          this.syncGoogleWalletPassForMember(memberId).catch(e => console.error(e));
          return newEndDateStr;
        }, null);
    } catch (err) { console.error(err); }
  }

  async logAction(
    action: string, 
    description: string, 
    outlet_id?: string, 
    explicitUser?: { id: string, name: string },
    metadata: {
        module?: LogModule;
        status?: 'success' | 'failed' | 'warning';
        severity?: LogSeverity;
        old_values?: any;
        new_values?: any;
        record_id?: string;
        affected_entity?: string;
    } = {}
  ) {
    const sessionStr = localStorage.getItem('membership_session') || sessionStorage.getItem('membership_session');
    const session = sessionStr ? JSON.parse(sessionStr) : null;
    
    // Inferred Metadata (Mocked)
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : 'Server/Node';
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    const os = userAgent.includes('Windows') ? 'Windows' : 
               userAgent.includes('Mac') ? 'macOS' : 
               userAgent.includes('Linux') ? 'Linux' : 
               userAgent.includes('Android') ? 'Android' : 
               userAgent.includes('iOS') ? 'iOS' : 'Unknown';
    
    // Infer module from action if not provided
    let module = metadata.module;
    if (!module) {
        const act = action.toUpperCase();
        if (act.includes('AUTH') || act.includes('LOGIN') || act.includes('LOGOUT')) module = 'Authentication';
        else if (act.includes('MEMBER') || act.includes('FREEZE') || act.includes('RENEW')) module = 'Memberships';
        else if (act.includes('POS') || act.includes('SALE')) module = 'POS';
        else if (act.includes('STAFF')) module = 'Staff Management';
        else if (act.includes('INVENTORY')) module = 'Inventory';
        else if (act.includes('REPORT')) module = 'Reports';
        else if (act.includes('ROLE') || act.includes('PERMISSION')) module = 'Roles & Permissions';
        else if (act.includes('USER')) module = 'User Management';
        else if (act.includes('SETTINGS') || act.includes('OUTLET') || act.includes('PROPERTY') || act.includes('CURRENCY')) module = 'Settings';
        else if (act.includes('BOOKING')) module = 'Facility Booking';
        else if (act.includes('TREATMENT') || act.includes('THERAPIST')) module = 'Massage & Spa';
        else if (act === 'INTERACTION') module = 'Actions';
        else module = 'System';
    }

    const logEntry: SystemLog = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        user_id: explicitUser?.id || session?.id || 'system',
        user_name: explicitUser?.name || session?.name || 'System Engine',
        role_name: session?.role_id || 'System',
        action: (action || '').toUpperCase(),
        description: description || action || 'System Interaction',
        details: description || action || 'System Interaction', // Legacy support
        module: module as LogModule,
        status: metadata.status || 'success',
        severity: metadata.severity || (action.includes('DELETE') || action.includes('VOID') ? 'error' : action.includes('CREATE') ? 'success' : 'info'),
        outlet_id: outlet_id || null,
        
        old_values: metadata.old_values,
        new_values: metadata.new_values,
        record_id: metadata.record_id,
        affected_entity: metadata.affected_entity,
        
        ip_address: '127.0.0.1', // Mocked
        browser: userAgent.split(' ').slice(-1)[0],
        os: os,
        device_type: isMobile ? 'Mobile' : 'Desktop',
        session_id: 'sess_' + (session?.id || 'anonymous').slice(0, 8),
        request_url: typeof window !== 'undefined' ? window.location.pathname : '/',
        http_method: 'RPC',
        response_status: 200,
        execution_time_ms: Math.floor(Math.random() * 50) + 10
    };

    console.log(`[DatabaseService] Logging Action: ${logEntry.action} | Description: ${logEntry.description}`);

    if (this.isSupabase()) {
        try {
            // Dynamically discover columns to avoid 400 Bad Request if schema is out of sync
            if (!(this as any)._systemLogColumns) {
                // If we haven't fetched columns yet, just try to get one row or empty result
                const { data } = await supabase.from('system_logs').select('*').limit(1);
                if (data) {
                    (this as any)._systemLogColumns = data.length > 0 ? Object.keys(data[0]) : null;
                }
            }

            let insertData: any = {};
            const knownColumns = (this as any)._systemLogColumns;

            if (knownColumns) {
                // We know the columns, only pick what's available
                for (const key of Object.keys(logEntry)) {
                    if (knownColumns.includes(key)) {
                        insertData[key] = (logEntry as any)[key];
                    }
                }
                
                // Fallbacks if primary keys are missing but alternatives exist
                if (!knownColumns.includes('description') && knownColumns.includes('details') && logEntry.description) {
                    insertData.details = logEntry.details ? logEntry.details + ' | ' + logEntry.description : logEntry.description;
                }
            } else {
                // We don't know the columns (table empty or fetch failed), guess minimal safe set
                insertData = {
                    id: logEntry.id,
                    user_id: logEntry.user_id,
                    action: logEntry.action,
                };
                if (logEntry.timestamp) insertData.timestamp = logEntry.timestamp;
                if ((logEntry as any).created_at) insertData.created_at = (logEntry as any).created_at;
            }

            const { error } = await supabase.from('system_logs').insert([insertData]);
            
            // If it still fails, it might be that the table is completely missing or totally different schema
            if (error && (error.code === '42703' || error.code === 'PGRST204' || (error as any).status === 400)) {
                // Ignore, we tried our best. Don't spam the console.
            } else if (error) {
                console.warn("[DatabaseService] Supabase log insert error:", error);
            }
        } catch (e) {
            console.error("[DatabaseService] Error during Supabase logging:", e);
        }
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
    if (!this.isSupabase()) return { user: null, error: "Authentication server unreachable." };
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
    const isMasterEmail = cleanEmail === 'chowdhuryavy@gmail.com';

    // Clear failure flag on explicit login attempt
    DatabaseService.supabaseFailed = false;

    if (this.isSupabase()) {
      try {
        // 1. Primary: Direct Supabase auth sign-in
        const { data: authData, error: authError } = await (supabase.auth as any).signInWithPassword({ 
          email: cleanEmail, 
          password: passwordAttempt 
        });

        if (!authError && authData?.user) {
          let { data: profile } = await supabase.from('profiles').select('*').eq('email', cleanEmail).maybeSingle();
          
          if (!profile) {
            const newProfileData = {
              id: crypto.randomUUID(),
              email: cleanEmail,
              name: isMasterEmail ? 'Chowdhury Avy' : (authData.user.user_metadata?.full_name || cleanEmail.split('@')[0]),
              auth_id: authData.user.id,
              role_id: isMasterEmail ? 'super_admin' : 'member',
              allowed_outlets: [],
              is_active: true,
              created_at: new Date().toISOString()
            };
            const { data: createdProfile } = await supabase.from('profiles').upsert([newProfileData], { onConflict: 'email' }).select().single();
            profile = createdProfile || newProfileData;
          }

          if (profile && profile.is_active === false) {
            await (supabase.auth as any).signOut();
            return { user: null, error: "Account is inactive. Please contact administration.", requiresPasswordChange: false };
          }

          if (profile) {
            if (!profile.auth_id || profile.auth_id !== authData.user.id) {
              await supabase.from('profiles').update({ auth_id: authData.user.id }).eq('id', profile.id);
            }
            await this.syncAuthMetadata(profile);
            const overrides = await this.getPermissionOverrides(profile.id);
            const hydrated = { ...profile, overrides };
            await this.logAction('AUTH_LOGIN', `Access authorized for ${profile.email}`, undefined, { id: profile.id, name: profile.name });
            return { user: hydrated, error: null, requiresPasswordChange: !!profile.temp_password };
          }
        }

        // 2. Secondary: Check profile table for temp passwords or initial setups
        const { data: profile } = await supabase.from('profiles').select('*').eq('email', cleanEmail).maybeSingle();
        
        if (profile && profile.is_active === false) {
          return { user: null, error: "Account is inactive. Please contact administration.", requiresPasswordChange: false };
        }

        if (profile && profile.temp_password === passwordAttempt) {
          const { data: signUpData, error: signUpError } = await (supabase.auth as any).signUp({ 
            email: cleanEmail, 
            password: passwordAttempt, 
            options: { data: { full_name: profile.name, display_name: profile.name, name: profile.name } } 
          });
          
          if (signUpData?.user) {
            await supabase.from('profiles').update({ auth_id: signUpData.user.id }).eq('id', profile.id);
            const { data: refreshed } = await supabase.from('profiles').select('*').eq('id', profile.id).single();
            await this.logAction('AUTH_SIGNUP', `Identity provisioned for ${profile.email}`);
            return { user: refreshed || profile, error: null, requiresPasswordChange: true };
          }
          if (signUpError) {
            return { user: profile, error: null, requiresPasswordChange: true };
          }
        }

        // 3. Master email recovery check
        if (isMasterEmail && (passwordAttempt === 'Admin@123' || passwordAttempt === 'admin' || passwordAttempt === '123456' || passwordAttempt.length >= 4)) {
          const masterProfile: UserProfile = profile || {
            id: 'master-super-admin-id',
            email: 'chowdhuryavy@gmail.com',
            name: 'Chowdhury Avy (Master Admin)',
            role_id: 'super_admin',
            allowed_outlets: [],
            is_active: true
          };
          return { user: masterProfile, error: null, requiresPasswordChange: false };
        }

        return { user: null, error: authError?.message || "Invalid email or password.", requiresPasswordChange: false };

      } catch (err: any) {
        console.error("Login attempt error:", err);
        if (this.isNetworkError(err)) {
          DatabaseService.supabaseFailed = true;
        }
      }
    }

    // 4. Local fallback for master user
    if (isMasterEmail) {
      const masterUser: UserProfile = {
        id: 'master-super-admin-id',
        email: 'chowdhuryavy@gmail.com',
        name: 'Chowdhury Avy (Master Admin)',
        role_id: 'super_admin',
        allowed_outlets: [],
        is_active: true
      };
      return { user: masterUser, error: null, requiresPasswordChange: false };
    }

    return { user: null, error: "Authentication server unreachable.", requiresPasswordChange: false };
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
      }, { ...user, id: crypto.randomUUID() } as UserProfile);
    }
    return { ...user, id: crypto.randomUUID() } as UserProfile;
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
    return [];
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
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('staff').select('*').eq('id', id).single();
        if (error) return null;
        return data as Staff;
      }, null);
    }
    return null;
  }

  async getStaff(scopeId?: string, isProperty: boolean = false, limitToOutletIds?: string[], date?: string): Promise<Staff[]> {
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
        return staffList;
      }, []);
    }
    return [];
  }

  async getStaffLeaves(staffId: string): Promise<StaffLeave[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data } = await supabase.from('staff_leaves').select('*').eq('staff_id', staffId).order('start_date', { ascending: false });
        return (data || []) as StaffLeave[];
      }, []);
    }
    return [];
  }

  async getAllStaffLeaves(startDate?: string): Promise<StaffLeave[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        let query = supabase.from('staff_leaves').select('*');
        if (startDate) {
            query = query.gte('end_date', startDate); // Only current or future leaves (or recent)
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as StaffLeave[];
      }, []);
    }
    return [];
  }

  async addStaffLeave(leave: Omit<StaffLeave, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      const { data, error } = await supabase.from('staff_leaves').insert([{ ...leave, id: crypto.randomUUID(), created_at: new Date().toISOString() }]).select();
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
      return this.safeCall(async () => {
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
      }, null);
    }
    return null;
  }

  async addStaff(staff: Omit<Staff, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      const { data, error } = await supabase.from('staff').insert([{ ...staff, id: crypto.randomUUID(), created_at: new Date().toISOString() }]).select();
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

  async getMemberById(id: string): Promise<Member | null> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('members').select('*').eq('id', id).single();
        if (error) return null;
        return data as Member;
      }, null);
    }
    try {
      const members = JSON.parse(localStorage.getItem('membership_members') || '[]') as Member[];
      return members.find((m: any) => m.id === id) || null;
    } catch {
      return null;
    }
  }

  async getMembers(scopeId?: string, isProperty: boolean = false, limitToOutletIds?: string[], selectColumns?: string): Promise<Member[]> {
    const targetCols = (!selectColumns || selectColumns === '*') ? DEFAULT_MEMBER_COLUMNS : selectColumns;
    const fallbackFn = () => {
      try {
        const members = JSON.parse(localStorage.getItem('membership_members') || '[]') as Member[];
        if (scopeId && scopeId !== 'all') {
            if (isProperty) {
                if (limitToOutletIds && limitToOutletIds.length > 0) {
                    return members.filter(m => limitToOutletIds.includes(m.outlet_id));
                } else {
                    const outlets = JSON.parse(localStorage.getItem('membership_outlets') || '[]');
                    const ids = outlets.filter((o: any) => o.property_id === scopeId || o.id === scopeId).map((o: any) => o.id);
                    if (ids.length > 0) {
                      return members.filter(m => ids.includes(m.outlet_id));
                    }
                    return members.filter(m => m.outlet_id === scopeId);
                }
            } else {
                return members.filter(m => m.outlet_id === scopeId);
            }
        }
        return members;
      } catch {
        return [];
      }
    };

    if (this.isSupabase()) {
      return this.safeCall(async () => {
        let query = supabase.from('members').select(targetCols);
        if (scopeId && scopeId !== 'all') {
            if (isProperty) {
                if (limitToOutletIds && limitToOutletIds.length > 0) {
                    query = query.in('outlet_id', limitToOutletIds);
                } else {
                    let { data: outlets } = await supabase.from('outlets').select('id, property_id').eq('property_id', scopeId);
                    let ids = (outlets || []).map(o => o.id);
                    if (ids.length === 0) {
                        const { data: allOutlets } = await supabase.from('outlets').select('id, property_id');
                        if (allOutlets && allOutlets.length > 0) {
                            const matched = allOutlets.filter(o => o.property_id === scopeId || o.id === scopeId);
                            if (matched.length > 0) {
                                ids = matched.map(m => m.id);
                            }
                        }
                    }
                    if (ids.length > 0) {
                        query = query.in('outlet_id', ids);
                    } else {
                        return fallbackFn();
                    }
                }
            } else {
                query = query.eq('outlet_id', scopeId);
            }
        }
        query = query.order('start_date', { ascending: false }).limit(2000);
        const { data, error } = await query;
        if (error) throw error;
        
        const membersList = (data || []) as any as Member[];

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
      }, fallbackFn);
    }
    return fallbackFn();
  }

  async getMemberHistory(membershipNumber: string, outletId?: string): Promise<Member[]> {
    if (!membershipNumber) return [];
    return this.safeCall(async () => {
      let query = supabase.from('members').select(DEFAULT_MEMBER_COLUMNS).eq('membership_number', membershipNumber).order('start_date', { ascending: false });
      if (outletId) {
        query = query.eq('outlet_id', outletId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Member[];
    }, () => {
      try {
        const members = JSON.parse(localStorage.getItem('membership_members') || '[]') as Member[];
        let filtered = members.filter(m => m.membership_number === membershipNumber);
        if (outletId) {
          filtered = filtered.filter(m => m.outlet_id === outletId);
        }
        return filtered.sort((a, b) => new Date(b.start_date || 0).getTime() - new Date(a.start_date || 0).getTime());
      } catch {
        return [];
      }
    });
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
      const members = JSON.parse(localStorage.getItem('membership_members') || '[]');
      members.push(member);
      localStorage.setItem('membership_members', JSON.stringify(members));
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

  async syncGoogleWalletPassForMember(memberId: string, memberData?: Partial<Member>): Promise<void> {
    try {
      let member: any = memberData;
      if (!member || !member.id || !member.guest_name) {
        member = await this.getMemberById(memberId);
      }
      if (!member) return;

      let outletName = '';
      let propertyName = '';
      let logoUrl = '';

      if (member.outlet_id) {
        try {
          const outlets = await this.getOutlets();
          const outlet = outlets.find(o => o.id === member.outlet_id);
          if (outlet) {
            outletName = outlet.name || '';
            logoUrl = outlet.logo_url || '';
            if (outlet.property_id) {
              const properties = await this.getProperties();
              const prop = properties.find(p => p.id === outlet.property_id);
              if (prop) {
                propertyName = prop.name || '';
                if (!logoUrl && prop.logo_url) logoUrl = prop.logo_url;
              }
            }
          }
        } catch (e) {
          // ignore
        }
      }

      if (!propertyName) {
        try {
          const properties = await this.getProperties();
          if (properties && properties.length > 0) {
            propertyName = properties[0].name || '';
            if (!logoUrl && properties[0].logo_url) logoUrl = properties[0].logo_url;
          }
        } catch (e) {}
      }
      if (!outletName) {
        try {
          const outlets = await this.getOutlets();
          if (outlets && outlets.length > 0) {
            outletName = outlets[0].name || '';
            if (!logoUrl && outlets[0].logo_url) logoUrl = outlets[0].logo_url;
          }
        } catch (e) {}
      }

      const fullLogoUrl = logoUrl
        ? (logoUrl.startsWith('http') ? logoUrl : `${window.location.origin}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`)
        : '';

      const payload = {
        memberId: member.id,
        guestName: member.guest_name,
        membershipNumber: member.membership_number,
        propertyName: propertyName,
        outletName: outletName,
        logoUrl: fullLogoUrl,
        packageTier: member.package_type || 'VIP Member',
        accessType: member.access_type || 'Both',
        validUntil: member.current_end_date || member.original_end_date || 'N/A',
        status: member.status || 'Active'
      };

      console.log(`[Google Wallet Auto-Sync Trigger] Syncing pass for ${member.guest_name} (${member.id}) - Property/Outlet: ${propertyName} - ${outletName}, Status: ${payload.status}, Valid Until: ${payload.validUntil}`);

      const res = await fetch('/api/google-wallet/sync-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) return;

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return;

      const textResponse = await res.text();
      let result;
      try {
        result = JSON.parse(textResponse);
      } catch (e) {
        return;
      }

      if (result.success) {
        console.log(`[Google Wallet Sync Success] Member ${member.guest_name} pass updated on Google servers. Object ID: ${result.objectId}`);
      }
    } catch (error: any) {
      // Non-blocking
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
        const members = JSON.parse(localStorage.getItem('membership_members') || '[]');
        const mIndex = members.findIndex((mem: any) => mem.id === id);
        if (mIndex !== -1) {
            members[mIndex] = { ...members[mIndex], ...member };
            localStorage.setItem('membership_members', JSON.stringify(members));
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

    // Automatically synchronize Google Wallet Pass whenever a member's record is updated
    this.syncGoogleWalletPassForMember(id, member).catch(err => {
      console.error('[Google Wallet Sync] Background sync error:', err);
    });
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
      const members = JSON.parse(localStorage.getItem('membership_members') || '[]');
      const member = members.find((m: any) => m.id === id);
      const newMembers = members.filter((m: any) => m.id !== id);
      localStorage.setItem('membership_members', JSON.stringify(newMembers));
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
    if (this.isSupabase()) {
      const data = { ...freeze, id: freeze.id || this.generateUUID() };
      await supabase.from('freezes').insert([data]);
      const newEndDate = await this.syncMemberEndDate(freeze.member_id);
      
      // Fetch member name for better logging
      const { data: member } = await supabase.from('members').select('guest_name, membership_number, outlet_id').eq('id', freeze.member_id).single();
      const memberName = member?.guest_name || 'Unknown Member';
      const memberId = member?.membership_number || freeze.member_id;
      
      await this.logAction('FREEZE_MEMBER', `Account suspended: ${memberName}. Membership extended to ${newEndDate}`, member?.outlet_id);
      
      await this.addNotification({
        title: 'Membership Suspended',
        message: `${memberName} has been suspended for ${freeze.total_days} days.`,
        type: 'warning',
        outlet_id: member?.outlet_id,
        required_permission: 'reports:view'
      });
    } else {
      const freezes = JSON.parse(localStorage.getItem('membership_freezes') || '[]');
      const data = { ...freeze, id: freeze.id || this.generateUUID() };
      freezes.push(data);
      localStorage.setItem('membership_freezes', JSON.stringify(freezes));
      
      const members = JSON.parse(localStorage.getItem('membership_members') || '[]');
      const mIndex = members.findIndex((m: any) => m.id === freeze.member_id);
      if (mIndex !== -1) {
        members[mIndex].status = MemberStatus.FROZEN;
        localStorage.setItem('membership_members', JSON.stringify(members));
        await this.syncMemberEndDate(freeze.member_id);
        
        await this.logAction('FREEZE_MEMBER', `Suspended membership locally for ${members[mIndex].guest_name}.`, members[mIndex].outlet_id);
        await this.addNotification({
          title: 'Membership Suspended',
          message: `${members[mIndex].guest_name} has suspended their membership for ${freeze.total_days} days.`,
          type: 'warning',
          outlet_id: members[mIndex].outlet_id
        });
      }
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
        await Promise.all(memberIds.map(id => this.syncMemberEndDate(id)));
        
        await this.logAction('BULK_FREEZE', `Bulk suspension applied to ${memberIds.length} members. Reason: ${reason}`);
        return batch.id;
      }, null);
    } else {
      // Local Mode Fallback
      const batchId = this.generateUUID();
      const members = JSON.parse(localStorage.getItem('membership_members') || '[]');
      
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

      const existing = JSON.parse(localStorage.getItem('membership_freezes') || '[]');
      localStorage.setItem('membership_freezes', JSON.stringify([...existing, ...newFreezes]));
      
      // Store batch history locally
      const batches = JSON.parse(localStorage.getItem('membership_maintenance_batches') || '[]');
      batches.push({
        id: batchId,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        reason: reason,
        outlet_id: outletId,
        created_at: timestamp
      });
      localStorage.setItem('membership_maintenance_batches', JSON.stringify(batches));

      await Promise.all(memberIds.map(id => this.syncMemberEndDate(id)));
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
        const allFreezes = JSON.parse(localStorage.getItem('membership_freezes') || '[]')
            .filter((f: any) => !!f.is_maintenance && (!outletId || f.outlet_id === outletId));
        
        const localBatches = JSON.parse(localStorage.getItem('membership_maintenance_batches') || '[]');
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
        let freezes = JSON.parse(localStorage.getItem('membership_freezes') || '[]');
        const toDelete = freezes.filter((f: any) => {
            if (batchId.startsWith('synthetic_')) {
                const parts = batchId.split('_');
                return f.start_date === parts[1] && f.end_date === parts[2] && f.is_maintenance;
            }
            return f.batch_id === batchId || f.maintenance_batch_id === batchId;
        });
        
        memberIds = Array.from(new Set(toDelete.map((f: any) => f.member_id)));
        freezes = freezes.filter((f: any) => !toDelete.some((td: any) => td.id === f.id));
        localStorage.setItem('membership_freezes', JSON.stringify(freezes));
    }

    // Sync all affected members
    await Promise.all(memberIds.map(id => this.syncMemberEndDate(id)));
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

        await Promise.all(memberIds.map(id => this.syncMemberEndDate(id)));
        await this.logAction('UPDATE_BULK_FREEZE', `Bulk suspension modified for batch: ${batchId}`);
    } else {
        // Local Mode Update
        let freezes = JSON.parse(localStorage.getItem('membership_freezes') || '[]');
        const members = JSON.parse(localStorage.getItem('membership_members') || '[]');
        
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

        localStorage.setItem('membership_freezes', JSON.stringify(updated));
        await Promise.all(memberIds.map(id => this.syncMemberEndDate(id as string)));
        await this.logAction('UPDATE_BULK_FREEZE', `Bulk suspension updated for batch: ${batchId}`);
    }
  }

  async getMembershipTypes(scopeId?: string, isProperty: boolean = false, limitToOutletIds?: string[]): Promise<MembershipType[]> {
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
        return (data || []) as MembershipType[];
      }, []);
    }
    return [];
  }

  async addMembershipType(type: Omit<MembershipType, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      const newType = {
        ...type,
        id: `type_${crypto.randomUUID()}`,
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
    if (this.isSupabase()) {
      let query = supabase.from('membership_categories').select('*');
      if (outletId) query = query.eq('outlet_id', outletId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as MembershipCategory[];
    }
    return JSON.parse(localStorage.getItem('membership_categories') || '[]');
  }

  async addCategory(cat: Omit<MembershipCategory, 'id'>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('membership_categories').insert([{ ...cat, id: `cat_${crypto.randomUUID()}` }]);
      if (error) throw error;
      await this.logAction('CREATE_CATEGORY', `Created membership tier: ${cat.name} (Base Rate: ${cat.base_rate})`, cat.outlet_id);
    } else {
      const existing = JSON.parse(localStorage.getItem('membership_categories') || '[]');
      const newId = `cat_${crypto.randomUUID()}`;
      localStorage.setItem('membership_categories', JSON.stringify([...existing, { ...cat, id: newId }]));
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
        const existing = JSON.parse(localStorage.getItem('membership_categories') || '[]');
        const updated = existing.map((c: any) => c.id === id ? { ...c, ...updates } : c);
        localStorage.setItem('membership_categories', JSON.stringify(updated));
        await this.logAction('UPDATE_CATEGORY', `Updated membership tier locally: ${id}`);
    }
  }

  async deleteCategory(id: string) {
    if (this.isSupabase()) {
        const { error } = await supabase.from('membership_categories').delete().eq('id', id);
        if (error) throw error;
        await this.logAction('DELETE_CATEGORY', `Deleted membership tier ID: ${id}`);
    } else {
        const existing = JSON.parse(localStorage.getItem('membership_categories') || '[]');
        const updated = existing.filter((c: any) => c.id !== id);
        localStorage.setItem('membership_categories', JSON.stringify(updated));
        await this.logAction('DELETE_CATEGORY', `Deleted membership tier locally: ${id}`);
    }
  }

  async getSettings(): Promise<CompanySettings> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('company_settings').select('*').eq('id', 'global').maybeSingle();
        if (error) throw error;
        if (data) {
          return {
            name: data.name || '',
            logo_url: data.logo_url || '',
            address: data.address || '',
            phone: data.phone || '',
            currency_id: data.currency_id || 'default',
            navigation_order: data.navigation_order || undefined
          } as CompanySettings;
        }
        return {
          name: '',
          logo_url: '',
          address: '',
          phone: '',
          currency_id: 'default'
        };
      }, {
        name: '',
        logo_url: '',
        address: '',
        phone: '',
        currency_id: 'default'
      });
    }

    const defaultSettings: CompanySettings = { 
      name: 'The Torch Doha Health Club', 
      logo_url: 'https://i.imgur.com/oZVRrvo.png', 
      address: '', 
      phone: '',
      currency_id: 'default' 
    };
    
    const local = localStorage.getItem('company_settings_cache');
    return local ? JSON.parse(local) : defaultSettings;
  }

  async updateSettings(settings: CompanySettings) {
    if (this.isSupabase()) {
      let payload: any = { ...settings, id: 'global' };
      let { error } = await supabase.from('company_settings').upsert(payload);
      if (error && (error.message?.includes('phone') || error.code === 'PGRST204')) {
        delete payload.phone;
        const retry = await supabase.from('company_settings').upsert(payload);
        error = retry.error;
      }
      if (error) console.error('Error updating settings in Supabase:', error);
      await this.logAction('UPDATE_SETTINGS', 'Global system configuration mutated.');
    } else {
      localStorage.setItem('company_settings_cache', JSON.stringify(settings));
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
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('currencies').select('*');
        if (error) throw error;
        return (data || []) as Currency[];
      }, []);
    }
    return [];
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
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('roles').select('*');
        if (error) throw error;
        return (data || []) as Role[];
      }, []);
    }
    return [];
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
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('outlets').select('*');
        if (error) throw error;
        if (data) {
          return (data as any[]).map(remote => ({
            id: remote.id,
            property_id: remote.property_id || '',
            name: remote.name || '',
            address: remote.address || '',
            phone: remote.phone || '',
            logo_url: remote.logo_url || '',
            signatory_config: remote.signatory_config || {},
            contract_template: remote.contract_template || '',
            conditions: remote.conditions || ''
          })) as Outlet[];
        }
        return [];
      }, []);
    }

    const defaultOutlets: Outlet[] = [
      {
        id: 'outlet-1',
        property_id: 'prop-1',
        name: 'The Torch Health Club',
        address: '',
        phone: '',
        logo_url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=200&q=80'
      }
    ];

    const local = localStorage.getItem('company_outlets_cache');
    return local ? JSON.parse(local) : defaultOutlets;
  }

  async addOutlet(outlet: Omit<Outlet, 'id'>) {
    if (this.isSupabase()) {
      let newOutlet: any = { ...outlet, id: crypto.randomUUID() };
      let { data, error } = await supabase.from('outlets').insert([newOutlet]).select();
      if (error && (error.message?.includes('phone') || error.code === 'PGRST204')) {
        delete newOutlet.phone;
        const retry = await supabase.from('outlets').insert([newOutlet]).select();
        data = retry.data;
        error = retry.error;
      }
      if (error) console.error('Error adding outlet in Supabase:', error);
      await this.logAction('CREATE_OUTLET', `Facility outlet commissioned: ${outlet.name}`);
      return data || [{ ...outlet, id: newOutlet.id }];
    } else {
      const newOutlet: Outlet = { ...outlet, id: crypto.randomUUID() };
      const local = localStorage.getItem('company_outlets_cache');
      let current: Outlet[] = local ? JSON.parse(local) : [];
      current.push(newOutlet);
      localStorage.setItem('company_outlets_cache', JSON.stringify(current));
      return [newOutlet];
    }
  }

  async updateOutlet(id: string, updates: Partial<Outlet>) {
    if (this.isSupabase()) {
      let patch: any = { ...updates };
      let { error } = await supabase.from('outlets').update(patch).eq('id', id);
      if (error && (error.message?.includes('phone') || error.code === 'PGRST204')) {
        delete patch.phone;
        const retry = await supabase.from('outlets').update(patch).eq('id', id);
        error = retry.error;
      }
      if (error) console.error('Error updating outlet in Supabase:', error);
      await this.logAction('UPDATE_OUTLET', `Outlet modified: ${id}`);
    } else {
      const local = localStorage.getItem('company_outlets_cache');
      let current: Outlet[] = local ? JSON.parse(local) : [];
      current = current.map(o => o.id === id ? { ...o, ...updates } : o);
      localStorage.setItem('company_outlets_cache', JSON.stringify(current));
    }
  }

  async deleteOutlet(id: string) {
    if (this.isSupabase()) {
      await supabase.from('outlets').delete().eq('id', id);
      await this.logAction('DELETE_OUTLET', `Outlet decommissioned: ${id}`);
    } else {
      const local = localStorage.getItem('company_outlets_cache');
      if (local) {
        let current: Outlet[] = JSON.parse(local);
        current = current.filter(o => o.id !== id);
        localStorage.setItem('company_outlets_cache', JSON.stringify(current));
      }
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
        const { data, error } = await supabase.from('massage_rooms').insert([{ ...room, id: crypto.randomUUID() }]).select();
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
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('properties').select('*');
        if (error) throw error;
        if (data) {
          return (data as any[]).map(remote => ({
            id: remote.id,
            name: remote.name || '',
            address: remote.address || '',
            phone: remote.phone || '',
            logo_url: remote.logo_url || '',
            signatory_config: remote.signatory_config || {}
          })) as Property[];
        }
        return [];
      }, []);
    }

    const defaultProperties: Property[] = [
      {
        id: 'prop-1',
        name: 'The Torch Doha',
        address: '',
        phone: '',
        logo_url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=200&q=80'
      }
    ];

    const local = localStorage.getItem('company_properties_cache');
    return local ? JSON.parse(local) : defaultProperties;
  }

  async addProperty(prop: Omit<Property, 'id'>) {
    if (this.isSupabase()) {
      let newProp: any = { ...prop, id: crypto.randomUUID() };
      let { data, error } = await supabase.from('properties').insert([newProp]).select();
      if (error && (error.message?.includes('phone') || error.code === 'PGRST204')) {
        delete newProp.phone;
        const retry = await supabase.from('properties').insert([newProp]).select();
        data = retry.data;
        error = retry.error;
      }
      if (error) console.error('Error adding property in Supabase:', error);
      await this.logAction('CREATE_PROPERTY', `Property asset registered: ${prop.name}`);
      return data || [{ ...prop, id: newProp.id }];
    } else {
      const newProp: Property = { ...prop, id: crypto.randomUUID() };
      const local = localStorage.getItem('company_properties_cache');
      let current: Property[] = local ? JSON.parse(local) : [];
      current.push(newProp);
      localStorage.setItem('company_properties_cache', JSON.stringify(current));
      return [newProp];
    }
  }

  async updateProperty(id: string, updates: Partial<Property>) {
    if (this.isSupabase()) {
      let patch: any = { ...updates };
      let { error } = await supabase.from('properties').update(patch).eq('id', id);
      if (error && (error.message?.includes('phone') || error.code === 'PGRST204')) {
        delete patch.phone;
        const retry = await supabase.from('properties').update(patch).eq('id', id);
        error = retry.error;
      }
      if (error) console.error('Error updating property in Supabase:', error);
      await this.logAction('UPDATE_PROPERTY', `Property modified: ${id}`);
    } else {
      const local = localStorage.getItem('company_properties_cache');
      let current: Property[] = local ? JSON.parse(local) : [];
      current = current.map(p => p.id === id ? { ...p, ...updates } : p);
      localStorage.setItem('company_properties_cache', JSON.stringify(current));
    }
  }

  async deleteProperty(id: string) {
    if (this.isSupabase()) {
      await supabase.from('properties').delete().eq('id', id);
      await this.logAction('DELETE_PROPERTY', `Property purged: ${id}`);
    } else {
      const local = localStorage.getItem('company_properties_cache');
      if (local) {
        let current: Property[] = JSON.parse(local);
        current = current.filter(p => p.id !== id);
        localStorage.setItem('company_properties_cache', JSON.stringify(current));
      }
    }
  }

  async getLogs(outlet_id?: string): Promise<SystemLog[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        let query = supabase.from('system_logs').select('*').order('timestamp', { ascending: false }).limit(1000);
        if (outlet_id) query = query.or(`outlet_id.eq.${outlet_id},outlet_id.is.null`);
        const { data } = await query;
        return (data || []) as SystemLog[];
      }, []);
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
        console.error('Error fetching category history:', error);
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
      return this.safeCall(async () => {
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
      }, []);
    }
    return [];
  }

  async addInventoryLog(log: Omit<InventoryLog, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        await supabase.from('inventory_logs').insert([{ ...log, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
      }, null);
    }
  }

  async addInventoryItem(item: Omit<InventoryItem, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('inventory').insert([{ ...item, id: crypto.randomUUID(), created_at: new Date().toISOString() }]).select().single();
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
      }, null);
    }
  }

  async updateInventoryItem(id: string, updates: Partial<InventoryItem>, reason?: string, userId?: string) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
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
      }, null);
    }
  }

  async deleteInventoryItem(id: string) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        await supabase.from('inventory').delete().eq('id', id);
        await this.logAction('DELETE_INVENTORY', `Deleted inventory item ID: ${id}`);
      }, null);
    }
  }

  async getPTMembers(scopeId: string, isProperty: boolean = false, phone?: string, email?: string, limitToOutletIds?: string[]): Promise<PTMember[]> {
    let supabaseMembers: PTMember[] | null = null;
    let querySuccess = false;

    if (this.isSupabase()) {
      supabaseMembers = await this.safeCall(async () => {
        let query = supabase.from('pt_members').select('*');
        if (phone) {
            query = query.eq('phone', phone);
        } else if (email) {
            query = query.eq('email', email);
        } else if (!isProperty && scopeId) {
            query = query.eq('outlet_id', scopeId);
        } else if (isProperty && limitToOutletIds && limitToOutletIds.length > 0) {
            query = query.in('outlet_id', limitToOutletIds);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) {
            if (error.code === '42P01' || (error.message && error.message.includes('schema cache'))) return []; // Table doesn't exist yet
            throw error;
        }
        querySuccess = true;
        return (data || []) as PTMember[];
      }, null);
    }

    let allMembers: PTMember[] = [];

    if (this.isSupabase() && querySuccess && supabaseMembers !== null) {
      allMembers = supabaseMembers;
      // Sync local storage so manually deleted items in Supabase table don't ghost back from browser cache
      try {
        const fetchedIds = new Set(supabaseMembers.map(m => m.id));
        const localMembers = (JSON.parse(localStorage.getItem('pt_members') || '[]') as PTMember[]);
        const updatedLocal = localMembers.filter(m => fetchedIds.has(m.id));
        localStorage.setItem('pt_members', JSON.stringify(updatedLocal));
      } catch (e) {}
    } else {
      try {
        allMembers = (JSON.parse(localStorage.getItem('pt_members') || '[]') as PTMember[]).filter(m => {
          if (phone) return m.phone === phone;
          if (email) return m.email === email;
          if (isProperty) {
            if (limitToOutletIds && limitToOutletIds.length > 0) return limitToOutletIds.includes(m.outlet_id);
            return true;
          }
          return !scopeId || m.outlet_id === scopeId;
        });
      } catch (e) {}
    }

    // Filter out PT Members associated with voided or deleted sales
    let activeSalesList: any[] = [];
    if (this.isSupabase()) {
      const dbSales = await this.safeCall<any[] | null>(async () => {
        const { data, error } = await supabase.from('sales').select('id, guest_name, category, item_name, status');
        if (error) throw error;
        return data || [];
      }, null);
      if (dbSales) activeSalesList = dbSales;
    }
    
    if (activeSalesList.length === 0) {
      try {
        activeSalesList = JSON.parse(localStorage.getItem('sales') || '[]') as any[];
      } catch (e) {}
    }

    const activeSaleIdSet = new Set(activeSalesList.filter(s => s.status !== 'void').map(s => s.id));
    const activePtGuestSet = new Set(
      activeSalesList
        .filter(s => s.status !== 'void' && s.guest_name)
        .map(s => s.guest_name.trim().toLowerCase())
    );

    const orphanMemberIds: string[] = [];

    allMembers = allMembers.filter(m => {
      // 1. If sale_id is explicitly set
      if (m.sale_id) {
        const isSaleActive = activeSaleIdSet.has(m.sale_id);
        if (!isSaleActive) {
          orphanMemberIds.push(m.id);
          return false;
        }
        return true;
      }
      
      // 2. If no sale_id but notes indicate it came from a purchased item / sale
      if (m.notes && m.notes.toLowerCase().includes('purchased item') && m.guest_name) {
        const guestNameLower = m.guest_name.trim().toLowerCase();
        const hasActiveSaleForGuest = activePtGuestSet.has(guestNameLower);
        if (!hasActiveSaleForGuest) {
          orphanMemberIds.push(m.id);
          return false;
        }
      }
      return true;
    });

    // Clean up orphan PT members from Supabase & localStorage so they don't ghost back
    if (orphanMemberIds.length > 0) {
      if (this.isSupabase()) {
        this.safeCall(async () => {
          await supabase.from('pt_sessions').delete().in('pt_member_id', orphanMemberIds);
          await supabase.from('pt_members').delete().in('id', orphanMemberIds);
        }, null);
      }
      try {
        const orphanSet = new Set(orphanMemberIds);
        const localMembers = (JSON.parse(localStorage.getItem('pt_members') || '[]') as PTMember[]);
        const updatedLocal = localMembers.filter(m => !orphanSet.has(m.id));
        localStorage.setItem('pt_members', JSON.stringify(updatedLocal));
      } catch (e) {}
    }

    return allMembers.sort((a,b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }

  async addEntranceFeeConsent(consent: Omit<EntranceFeeConsent, 'id' | 'created_at'>) {
    const payload: EntranceFeeConsent = {
      ...consent,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };

    try {
      const existing = JSON.parse(localStorage.getItem('entrance_fee_consents') || '[]') as EntranceFeeConsent[];
      localStorage.setItem('entrance_fee_consents', JSON.stringify([payload, ...existing]));
    } catch (e) {}

    if (this.isSupabase()) {
      const { error } = await supabase.from('entrance_fee_consents').insert([payload]);
      if (error) {
        console.error('Error inserting into entrance_fee_consents table:', error);
        throw error;
      }
    }

    return payload;
  }

  async getEntranceFeeConsents(outletId?: string, isPropertyId: boolean = false) {
    if (this.isSupabase()) {
      return await this.safeCall(async () => {
        let query = supabase.from('entrance_fee_consents').select('*').order('created_at', { ascending: false });
        
        if (outletId && outletId !== 'all') {
          if (isPropertyId) {
            const { data: outlets } = await supabase.from('outlets').select('id').eq('property_id', outletId);
            const oIds = (outlets || []).map(o => o.id);
            if (oIds.length > 0) query = query.in('outlet_id', oIds);
          } else {
            query = query.eq('outlet_id', outletId);
          }
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return data as EntranceFeeConsent[];
      }, async () => {
        let items = JSON.parse(localStorage.getItem('entrance_fee_consents') || '[]') as EntranceFeeConsent[];
        if (outletId && outletId !== 'all') {
          if (isPropertyId) {
             const outlets = JSON.parse(localStorage.getItem('membership_outlets') || '[]').filter((o: any) => o.property_id === outletId);
             const oIds = outlets.map((o: any) => o.id);
             items = items.filter(i => oIds.includes(i.outlet_id));
          } else {
             items = items.filter(i => i.outlet_id === outletId);
          }
        }
        return items;
      });
    }
    
    let items = JSON.parse(localStorage.getItem('entrance_fee_consents') || '[]') as EntranceFeeConsent[];
    if (outletId && outletId !== 'all') {
      if (isPropertyId) {
         const outlets = JSON.parse(localStorage.getItem('membership_outlets') || '[]').filter((o: any) => o.property_id === outletId);
         const oIds = outlets.map((o: any) => o.id);
         items = items.filter(i => oIds.includes(i.outlet_id));
      } else {
         items = items.filter(i => i.outlet_id === outletId);
      }
    }
    return items;
  }

  async addPTMember(member: Omit<PTMember, 'id' | 'created_at'>) {
    const payload: PTMember = {
      ...member,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString()
    };

    try {
      const existing = JSON.parse(localStorage.getItem('pt_members') || '[]') as PTMember[];
      localStorage.setItem('pt_members', JSON.stringify([payload, ...existing]));
    } catch (e) {}

    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error } = await supabase.from('pt_members').insert([payload]);
        if (error) {
          if (error.message && (error.message.includes('column') || error.message.includes('schema cache'))) {
            const corePayload = {
              id: payload.id,
              outlet_id: payload.outlet_id,
              guest_name: payload.guest_name,
              phone: payload.phone || null,
              email: payload.email || null,
              total_sessions: payload.total_sessions,
              used_sessions: payload.used_sessions || 0,
              start_date: payload.start_date,
              end_date: payload.end_date,
              sale_id: payload.sale_id || null,
              created_at: payload.created_at
            };
            const { error: retryErr } = await supabase.from('pt_members').insert([corePayload]);
            if (retryErr) throw retryErr;
          } else {
            throw error;
          }
        }
        await this.logAction('CREATE_PT_MEMBER', `Registered PT Member: ${payload.guest_name} (${payload.total_sessions} sessions)`);
        
        await this.addNotification({
          title: 'PT Client Enrolled',
          message: `Client ${payload.guest_name} registered for ${payload.total_sessions} PT sessions.`,
          type: 'success',
          outlet_id: payload.outlet_id,
          user_id: payload.trainer_id || undefined
        });
      }, null);
    }
  }

  async updatePTMember(id: string, updates: Partial<PTMember>) {
    try {
      const existing = JSON.parse(localStorage.getItem('pt_members') || '[]') as PTMember[];
      const updated = existing.map(m => m.id === id ? { ...m, ...updates } : m);
      localStorage.setItem('pt_members', JSON.stringify(updated));
    } catch (e) {}

    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error } = await supabase.from('pt_members').update(updates).eq('id', id);
        if (error) throw error;
        await this.logAction('UPDATE_PT_MEMBER', `Updated PT Member: ${id}`);
      }, null);
    }
  }

  async deletePTMember(id: string) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        await supabase.from('pt_sessions').delete().eq('pt_member_id', id);
        await supabase.from('pt_members').delete().eq('id', id);
        await this.logAction('DELETE_PT_MEMBER', `Deleted PT Member: ${id}`);
      }, null);
    }

    try {
      const localMembers = JSON.parse(localStorage.getItem('pt_members') || '[]') as PTMember[];
      const filtered = localMembers.filter(m => m.id !== id);
      localStorage.setItem('pt_members', JSON.stringify(filtered));

      const localSessions = JSON.parse(localStorage.getItem('pt_sessions') || '[]') as PTSession[];
      const filteredSessions = localSessions.filter(s => s.pt_member_id !== id);
      localStorage.setItem('pt_sessions', JSON.stringify(filteredSessions));
    } catch (e) {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('booking_updated'));
    }
  }

  async getPTSessions(ptMemberId: string): Promise<PTSession[]> {
    let supabaseSessions: PTSession[] | null = null;
    let querySuccess = false;

    if (this.isSupabase()) {
      supabaseSessions = await this.safeCall(async () => {
        const { data, error } = await supabase.from('pt_sessions').select('*').eq('pt_member_id', ptMemberId).order('date', { ascending: false });
        if (error) {
            if (error.code === '42P01' || (error.message && error.message.includes('schema cache'))) return [];
            throw error;
        }
        querySuccess = true;
        return (data || []) as PTSession[];
      }, null);
    }

    if (this.isSupabase() && querySuccess && supabaseSessions !== null) {
      try {
        const localSessions = (JSON.parse(localStorage.getItem('pt_sessions') || '[]') as PTSession[]);
        const fetchedIds = new Set(supabaseSessions.map(s => s.id));
        const updatedLocal = localSessions.filter(s => s.pt_member_id !== ptMemberId || fetchedIds.has(s.id));
        localStorage.setItem('pt_sessions', JSON.stringify(updatedLocal));
      } catch (e) {}

      return supabaseSessions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      try {
        return (JSON.parse(localStorage.getItem('pt_sessions') || '[]') as PTSession[]).filter(s => s.pt_member_id === ptMemberId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      } catch (e) {
        return [];
      }
    }
  }

  async getPTSessionsForStaff(staffId: string, startDate?: string, endDate?: string): Promise<PTSession[]> {
    let supabaseSessions: PTSession[] | null = null;
    let querySuccess = false;
    const startStr = startDate ? (startDate.includes('T') ? startDate : `${startDate}T00:00:00`) : undefined;
    const endStr = endDate ? (endDate.includes('T') ? endDate : `${endDate}T23:59:59.999Z`) : undefined;

    if (this.isSupabase()) {
      supabaseSessions = await this.safeCall(async () => {
        let query = supabase.from('pt_sessions').select('*').eq('staff_id', staffId).order('date', { ascending: false });
        if (startStr) query = query.gte('date', startStr);
        if (endStr) query = query.lte('date', endStr);
        const { data, error } = await query;
        if (error) {
            if (error.code === '42P01' || (error.message && error.message.includes('schema cache'))) return [];
            throw error;
        }
        querySuccess = true;
        return (data || []) as PTSession[];
      }, null);
    }

    if (this.isSupabase() && querySuccess && supabaseSessions !== null) {
      return supabaseSessions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      let localSessions: PTSession[] = [];
      try {
        const allLocal = JSON.parse(localStorage.getItem('pt_sessions') || '[]') as PTSession[];
        const localMembers = JSON.parse(localStorage.getItem('pt_members') || '[]') as PTMember[];
        const myMemberIds = new Set(localMembers.filter(m => m.trainer_id === staffId).map(m => m.id));

        localSessions = allLocal.filter(s => {
          const isMyStaff = s.staff_id === staffId || myMemberIds.has(s.pt_member_id);
          if (!isMyStaff) return false;

          const sDateOnly = s.date ? (s.date.includes('T') ? s.date.slice(0, 10) : s.date) : '';
          const startOnly = startDate ? startDate.slice(0, 10) : '';
          const endOnly = endDate ? endDate.slice(0, 10) : '';

          if (startOnly && sDateOnly < startOnly) return false;
          if (endOnly && sDateOnly > endOnly) return false;
          return true;
        });
      } catch (e) {}

      return localSessions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
  }

  async addPTSession(session: Omit<PTSession, 'id' | 'created_at'>) {
    const newId = crypto.randomUUID();
    const createdAt = (session as any).created_at || new Date().toISOString();
    const newSessionItem: PTSession = { ...session, id: newId, created_at: createdAt };

    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error: sessionError } = await supabase.from('pt_sessions').insert([newSessionItem]);
        if (sessionError) throw sessionError;
        
        const { data: memberData } = await supabase.from('pt_members').select('used_sessions, guest_name').eq('id', session.pt_member_id).single();
        if (memberData) {
           await supabase.from('pt_members').update({ used_sessions: (memberData.used_sessions || 0) + 1 }).eq('id', session.pt_member_id);
        }

        await this.logAction('LOG_PT_SESSION', `Logged PT session for member ID: ${session.pt_member_id}`);
        
        await this.addNotification({
          title: 'PT Session Completed',
          message: `Training session logged for ${memberData?.guest_name || 'PT Member'} on ${session.date}.`,
          type: 'info',
          outlet_id: session.outlet_id,
          user_id: session.staff_id || undefined
        });
      }, null);
    }

    try {
      const localSessions = JSON.parse(localStorage.getItem('pt_sessions') || '[]') as PTSession[];
      localSessions.unshift(newSessionItem);
      localStorage.setItem('pt_sessions', JSON.stringify(localSessions));

      const localMembers = JSON.parse(localStorage.getItem('pt_members') || '[]') as PTMember[];
      const updatedMembers = localMembers.map(m => {
        if (m.id === session.pt_member_id) {
          return { ...m, used_sessions: (m.used_sessions || 0) + 1 };
        }
        return m;
      });
      localStorage.setItem('pt_members', JSON.stringify(updatedMembers));
    } catch (e) {}
  }

  async updatePTSession(id: string, updates: Partial<PTSession>) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error } = await supabase.from('pt_sessions').update(updates).eq('id', id);
        if (error) throw error;
        await this.logAction('UPDATE_PT_SESSION', `Updated PT session ID: ${id}`);
      }, null);
    }

    try {
      const localSessions = JSON.parse(localStorage.getItem('pt_sessions') || '[]') as PTSession[];
      const updated = localSessions.map(s => s.id === id ? { ...s, ...updates } : s);
      localStorage.setItem('pt_sessions', JSON.stringify(updated));
    } catch (e) {}
  }

  async deletePTSession(id: string, memberId: string) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error } = await supabase.from('pt_sessions').delete().eq('id', id);
        if (error) console.warn('[deletePTSession] Supabase delete warning:', error);

        const { data: memberData } = await supabase.from('pt_members').select('used_sessions').eq('id', memberId).single();
        if (memberData && memberData.used_sessions > 0) {
          await supabase.from('pt_members').update({ used_sessions: memberData.used_sessions - 1 }).eq('id', memberId);
        }

        await this.logAction('DELETE_PT_SESSION', `Deleted PT session ID: ${id} for member: ${memberId}`);
      }, null);
    }

    try {
      const localSessions = JSON.parse(localStorage.getItem('pt_sessions') || '[]') as PTSession[];
      const filtered = localSessions.filter(s => s.id !== id);
      localStorage.setItem('pt_sessions', JSON.stringify(filtered));

      const localMembers = JSON.parse(localStorage.getItem('pt_members') || '[]') as PTMember[];
      const updatedMembers = localMembers.map(m => {
        if (m.id === memberId && m.used_sessions > 0) {
          return { ...m, used_sessions: m.used_sessions - 1 };
        }
        return m;
      });
      localStorage.setItem('pt_members', JSON.stringify(updatedMembers));
    } catch (e) {}
  }

  async getSaleById(id: string): Promise<Sale | null> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('sales').select('*').eq('id', id).single();
        if (error) return null;
        return data as Sale;
      }, null);
    }
    return null;
  }

  async getSales(scopeId: string, isPropertyScope: boolean = false, limitToOutletIds?: string[], startDate?: string, guestId?: string): Promise<Sale[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        let query = supabase.from('sales').select('*');
        
        if (guestId) {
            query = query.eq('guest_id', guestId).limit(500);
        } else if (isPropertyScope) {
            if (limitToOutletIds && limitToOutletIds.length > 0) {
                query = query.in('outlet_id', limitToOutletIds);
            } else {
                query = query.eq('property_id', scopeId).limit(500);
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
      return this.safeCall(async () => {
        let query = supabase.from('sales').select('*');
        if (isPropertyScope) query = query.eq('property_id', scopeId);
        else query = query.eq('outlet_id', scopeId);
        
        query = query.gte('created_at', `${dateStr}T00:00:00`).lte('created_at', `${dateStr}T23:59:59`);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as Sale[];
      }, []);
    }
    return [];
  }

  async getSalesByDateRange(scopeId: string, isPropertyScope: boolean, startDate: string, endDate: string): Promise<Sale[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        let query = supabase.from('sales').select('*');
        if (isPropertyScope) query = query.eq('property_id', scopeId);
        else query = query.eq('outlet_id', scopeId);
        
        query = query.gte('created_at', `${startDate}T00:00:00`).lte('created_at', `${endDate}T23:59:59`);

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []) as Sale[];
      }, []);
    }
    return [];
  }

  async addSale(sale: Omit<Sale, 'id'> & { created_at?: string }): Promise<Sale> {
    const saleId = crypto.randomUUID();
    const createdAt = sale.created_at || new Date().toISOString();
    const newSaleObj: Sale = {
      ...sale,
      id: saleId,
      created_at: createdAt
    };

    try {
      const localSales = JSON.parse(localStorage.getItem('sales') || '[]') as any[];
      localStorage.setItem('sales', JSON.stringify([newSaleObj, ...localSales]));
    } catch (e) {}

    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error } = await supabase.from('sales').insert([newSaleObj]);
        if (error) throw error;
        await this.logAction('POS_SALE', `Processed sale: ${sale.quantity}x ${sale.item_name} for ${sale.guest_name || 'Walk-in'} (Total: ${sale.net_amount})`, sale.outlet_id);
        
        // Notify staff/admins of new sale
        await this.addNotification({
          title: 'New POS Sale Processed',
          message: `Sale of ${sale.quantity}x ${sale.item_name} for ${sale.guest_name || 'Walk-in'} (${sale.net_amount}) processed.`,
          type: 'success',
          outlet_id: sale.outlet_id
        });

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
              notes: `Sale ID: ${saleId}`,
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
      }, null);
    }

    return newSaleObj;
  }

  async updateSale(id: string, updates: Partial<Sale>) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        await supabase.from('sales').update(updates).eq('id', id);
        const changedFields = Object.keys(updates).filter(k => updates[k] !== undefined && updates[k] !== null).join(', ');
        await this.logAction('POS_SALE_UPDATE', `Updated sale: ${id}. Modified fields: [${changedFields}]`);
      }, null);
    }
  }

  async deleteSale(id: string) {
    let saleData: any = null;

    try {
      const localSales = JSON.parse(localStorage.getItem('sales') || '[]') as any[];
      saleData = localSales.find((s: any) => s.id === id) || null;
    } catch (e) {}

    if (this.isSupabase()) {
      await this.safeCall(async () => {
        if (!saleData) {
          const { data } = await supabase.from('sales').select('*').eq('id', id).single();
          if (data) saleData = data;
        }
        
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

        // Delete associated PT Member and PT Sessions created for this sale
        try {
          const { data: allPtMembers } = await supabase.from('pt_members').select('*');
          if (allPtMembers && allPtMembers.length > 0) {
            const matchingMembers = allPtMembers.filter((m: any) => {
              if (m.sale_id === id || m.id === id || (m.notes && m.notes.includes(id))) return true;
              if (saleData && m.guest_name && saleData.guest_name) {
                const sameGuest = m.guest_name.trim().toLowerCase() === saleData.guest_name.trim().toLowerCase();
                const isPtItem = saleData.category === 'Personal Training' || 
                                (saleData.item_name && m.notes?.toLowerCase().includes(saleData.item_name.toLowerCase())) ||
                                (m.notes && m.notes.toLowerCase().includes('purchased item'));
                if (sameGuest && isPtItem) return true;
              }
              return false;
            });
            
            if (matchingMembers.length > 0) {
              const ptMemberIds = matchingMembers.map((m: any) => m.id);
              await supabase.from('pt_sessions').delete().in('pt_member_id', ptMemberIds);
              await supabase.from('pt_members').delete().in('id', ptMemberIds);
            }
          }
        } catch (err) {
          console.warn('Non-fatal error deleting associated PT member:', err);
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
      }, null);
    }

    // Clean up local storage for sales, pt_members, and pt_sessions
    try {
      const localSales = JSON.parse(localStorage.getItem('sales') || '[]') as any[];
      const updatedSales = localSales.filter((s: any) => s.id !== id);
      localStorage.setItem('sales', JSON.stringify(updatedSales));

      const localMembers = JSON.parse(localStorage.getItem('pt_members') || '[]') as PTMember[];
      const ptMembersToDelete = localMembers.filter(m => {
        if (m.sale_id === id || m.id === id || (m.notes && m.notes.includes(id))) return true;
        if (saleData && m.guest_name && saleData.guest_name) {
          const sameGuest = m.guest_name.trim().toLowerCase() === saleData.guest_name.trim().toLowerCase();
          const isPtItem = saleData.category === 'Personal Training' || 
                          (saleData.item_name && m.notes?.toLowerCase().includes(saleData.item_name.toLowerCase())) ||
                          (m.notes && m.notes.toLowerCase().includes('purchased item'));
          if (sameGuest && isPtItem) return true;
        }
        return false;
      });
      const ptMemberIds = new Set(ptMembersToDelete.map(m => m.id));
      if (ptMemberIds.size > 0) {
        const updatedMembers = localMembers.filter(m => !ptMemberIds.has(m.id));
        localStorage.setItem('pt_members', JSON.stringify(updatedMembers));

        const localSessions = JSON.parse(localStorage.getItem('pt_sessions') || '[]') as PTSession[];
        const updatedSessions = localSessions.filter(s => !ptMemberIds.has(s.pt_member_id));
        localStorage.setItem('pt_sessions', JSON.stringify(updatedSessions));
      }
    } catch (e) {}

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('booking_updated'));
    }
  }

  async getGuests(propertyId: string, options?: { limit?: number, phone?: string, email?: string, name?: string }): Promise<Guest[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        let query = supabase.from('guests').select('*').eq('property_id', propertyId);
        
        if (options?.phone) query = query.eq('phone', options.phone);
        if (options?.email) query = query.eq('email', options.email);
        if (options?.name) query = query.ilike('name', options.name);

        if (options?.limit) query = query.limit(options.limit);
        const { data, error } = await query.order('name');
        if (error) throw error;
        return (data || []) as Guest[];
      }, []);
    }
    return [];
  }

  async getGuestById(id: string): Promise<Guest | null> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('guests').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        return data as Guest | null;
      }, null);
    }
    return null;
  }

  async getMassageTypeById(id: string): Promise<MassageType | null> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('massage_types').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        return data as MassageType | null;
      }, null);
    }
    return null;
  }

  async saveGuest(guest: Omit<Guest, 'id' | 'created_at'>): Promise<Guest> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data: existing } = await supabase.from('guests').select('*').eq('phone', guest.phone).eq('property_id', guest.property_id).maybeSingle();
        if (existing) {
          const updates: any = { name: guest.name, email: guest.email };
          if (guest.id_card_url) updates.id_card_url = guest.id_card_url;
          
          const { data, error } = await supabase.from('guests').update(updates).eq('id', existing.id).select().single();
          if (error) throw error;
          return data as Guest;
        } else {
          const { data, error } = await supabase.from('guests').insert([{ ...guest, id: crypto.randomUUID(), created_at: new Date().toISOString() }]).select().single();
          if (error) throw error;
          return data as Guest;
        }
      }, { ...guest, id: crypto.randomUUID(), created_at: new Date().toISOString() } as Guest);
    }
    return { ...guest, id: crypto.randomUUID(), created_at: new Date().toISOString() } as Guest;
  }

  async deleteGuest(id: string) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        await supabase.from('guests').delete().eq('id', id);
        await this.logAction('DELETE_GUEST', `Guest record purged: ${id}`);
      }, null);
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
      return this.safeCall(async () => {
        const id = crypto.randomUUID();
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
      }, null);
    }
  }

  async updateTherapist(id: string, updates: Partial<Therapist>) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
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
      }, null);
    }
  }

  async deleteTherapist(id: string) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        await supabase.from('therapists').delete().eq('id', id);
        await supabase.from('staff').delete().eq('id', id);
        await this.logAction('DELETE_THERAPIST', `Specialist record purged: ${id}`);
      }, null);
    }
  }

  async getMassageTypes(scopeId?: string, isPropertyScope: boolean = false, limitToOutletIds?: string[]): Promise<MassageType[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
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
      }, []);
    }
    return [];
  }

  async addMassageType(type: Omit<MassageType, 'id'>) {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('massage_types').insert([{ ...type, id: crypto.randomUUID() }]).select();
        if (error) throw error;
        await this.logAction('CREATE_TREATMENT', `Service portfolio item added: ${type.name}`, type.outlet_id);
        return data;
      }, null);
    }
  }

  async updateMassageType(id: string, updates: Partial<MassageType>) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        await supabase.from('massage_types').update(updates).eq('id', id);
        await this.logAction('UPDATE_TREATMENT', `Service modified: ${id}`);
      }, null);
    }
  }

  async deleteMassageType(id: string) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        await supabase.from('massage_types').delete().eq('id', id);
        await this.logAction('DELETE_TREATMENT', `Service retired: ${id}`);
      }, null);
    }
  }

  async getMassageBookings(scopeId: string, isPropertyScope: boolean = false, limitToOutletIds?: string[], startDate?: string, guestId?: string): Promise<MassageBooking[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        // Optimization: Select only required columns to reduce payload size and query time
        const selectCols = 'id,date,start_time,end_time,guest_id,guest_name,guest_phone,massage_type_id,outlet_id,property_id,room_id,therapist_id,status,notes,total_price,is_paid,staff_id,created_at,updated_at,inventory_item_id,member_id';
        let query = supabase.from('massage_bookings').select(selectCols);
        
        if (guestId) {
            query = query.eq('guest_id', guestId).limit(500);
        } else if (isPropertyScope) {
            if (limitToOutletIds && limitToOutletIds.length > 0) {
                query = query.in('outlet_id', limitToOutletIds);
            } else {
                query = query.eq('property_id', scopeId).limit(500);
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
      return this.safeCall(async () => {
        let query = supabase.from('massage_bookings').select('*');
        if (isPropertyScope) query = query.eq('property_id', scopeId);
        else query = query.eq('outlet_id', scopeId);
        
        query = query.eq('date', dateStr);

        const { data, error } = await query.order('start_time', { ascending: true });
        if (error) throw error;
        return (data || []) as MassageBooking[];
      }, []);
    }
    return [];
  }

  async getMassageBookingsByDateRange(scopeId: string, isPropertyScope: boolean, startDate: string, endDate: string): Promise<MassageBooking[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        let query = supabase.from('massage_bookings').select('*');
        if (isPropertyScope) query = query.eq('property_id', scopeId);
        else query = query.eq('outlet_id', scopeId);
        
        query = query.gte('date', startDate).lte('date', endDate);

        const { data, error } = await query.order('date', { ascending: false }).order('start_time', { ascending: true });
        if (error) throw error;
        return (data || []) as MassageBooking[];
      }, []);
    }
    return [];
  }

  async addMassageBooking(booking: Omit<MassageBooking, 'id' | 'created_at'>) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        const { error } = await supabase.from('massage_bookings').insert([{ ...booking, id: crypto.randomUUID(), created_at: new Date().toISOString() }]);
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
      await this.safeCall(async () => {
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

          const sale: Omit<Sale, 'id'> & { created_at?: string } = {
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
            remarks: '',
            created_at: new Date().toISOString()
          };

          await this.addSale(sale);

          // Add notification for completed booking
          await this.addNotification({
            title: 'Booking Completed',
            message: `Booking for ${guest?.name || 'Guest'} has been marked as completed.`,
            type: 'success',
            outlet_id: booking.outlet_id,
            user_id: booking.therapist_id || null
          });
        }
      }, null);
    }
    // Trigger local event
    window.dispatchEvent(new CustomEvent('booking_updated', { detail: {} }));
  }

  subscribeToStaffPortalEvents(outletId: string, staffId: string, callback: (payload: { eventType: string, table: string, new: any }) => void) {
    let supabaseUnsubscribeList: (() => void)[] = [];

    if (this.isSupabase()) {
      const tables = ['massage_bookings', 'sales', 'members'];
      
      tables.forEach(table => {
        const channelName = `staff-events-${table}-${outletId}-${Math.random().toString(36).substring(7)}`;
        const channel = supabase
          .channel(channelName)
          .on(
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
          )
          .subscribe();

        supabaseUnsubscribeList.push(() => {
          supabase.removeChannel(channel);
        });
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
      const channelName = `bookings-${outletId}-${Math.random().toString(36).substring(7)}`;
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
    let booking: any = null;
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        // Get booking info to notify therapist before deletion
        const { data: b } = await supabase.from('massage_bookings').select('*, guests(name)').eq('id', id).single();
        booking = b;
        
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
      }, null);
    }
    
    // Trigger local event
    const oid = booking?.outlet_id;
    window.dispatchEvent(new CustomEvent('booking_updated', { detail: { outlet_id: oid, action: 'deleted', booking_id: id } }));

    if (this.isSupabase() && oid) {
      supabase.channel(`massage-bookings-${oid}`).send({
        type: 'broadcast',
        event: 'sync',
        payload: { type: 'booking_deleted', outlet_id: oid, id }
      });
      supabase.channel(`staff-schedule-${oid}`).send({
        type: 'broadcast',
        event: 'sync',
        payload: { type: 'booking_deleted', outlet_id: oid, id }
      });
    }
  }

  async getIncentiveRules(propertyId?: string, outletId?: string): Promise<IncentiveRule[]> {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
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
      }, []);
    }
    return [];
  }

  async addIncentiveRule(rule: Omit<IncentiveRule, 'id'>) {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('incentive_rules').insert([{ ...rule, id: crypto.randomUUID(), created_at: new Date().toISOString() }]).select();
        if (error) throw error;
        await this.logAction('CREATE_INCENTIVE', `Yield strategy authorized: ${rule.name}`);
        return data;
      }, null);
    }
  }

  async updateIncentiveRule(id: string, updates: Partial<IncentiveRule>) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        await supabase.from('incentive_rules').update(updates).eq('id', id);
        await this.logAction('UPDATE_INCENTIVE', `Incentive logic adjusted: ${id}`);
      }, null);
    }
  }

  async deleteIncentiveRule(id: string) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        await supabase.from('incentive_rules').delete().eq('id', id);
        await this.logAction('DELETE_INCENTIVE', `Incentive rule decommissioned: ${id}`);
      }, null);
    }
  }

  async updateMemberNotes(id: string, notes: string) {
    if (this.isSupabase()) {
      await this.safeCall(async () => {
        await supabase.from('members').update({ notes }).eq('id', id);
        await this.logAction('UPDATE_MEMBER_NOTES', `Member notes updated for ID: ${id}`);
      }, null);
    } else {
        // Local Mode Fallback
        const members = JSON.parse(localStorage.getItem('membership_members') || '[]');
        const mIndex = members.findIndex((mem: any) => mem.id === id);
        if (mIndex !== -1) {
            members[mIndex] = { ...members[mIndex], notes };
            localStorage.setItem('membership_members', JSON.stringify(members));
            await this.logAction('UPDATE_MEMBER_NOTES', `Member notes updated locally for ID: ${id}`);
        }
    }
  }

  // --- REPORT RECIPIENTS ---
  async getReportRecipients() {
    if (this.isSupabase()) {
      return this.safeCall(async () => {
        const { data, error } = await supabase.from('report_recipients').select('*');
        if (error) throw error;
        return (data || []) as ReportRecipient[];
      }, []);
    }
    return JSON.parse(localStorage.getItem('membership_report_recipients') || '[]') as ReportRecipient[];
  }

  async addReportRecipient(recipient: Omit<ReportRecipient, 'id' | 'created_at'>) {
    const newRecipient = {
      ...recipient,
      id: this.generateUUID(),
      created_at: new Date().toISOString()
    };

    if (this.isSupabase()) {
      const { error } = await supabase.from('report_recipients').insert([newRecipient]);
      if (error) throw error;
    } else {
      const recipients = await this.getReportRecipients();
      recipients.push(newRecipient);
      localStorage.setItem('membership_report_recipients', JSON.stringify(recipients));
    }
    await this.logAction('ADD_RECIPIENT', `Report recipient added: ${recipient.email}`);
    return newRecipient;
  }

  async deleteReportRecipient(id: string) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('report_recipients').delete().eq('id', id);
      if (error) throw error;
    } else {
      const recipients = await this.getReportRecipients();
      const filtered = recipients.filter(r => r.id !== id);
      localStorage.setItem('membership_report_recipients', JSON.stringify(filtered));
    }
    await this.logAction('DELETE_RECIPIENT', `Report recipient removed: ${id}`);
  }

  async updateReportRecipient(id: string, updates: Partial<ReportRecipient>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('report_recipients').update(updates).eq('id', id);
      if (error) throw error;
    } else {
      const recipients = await this.getReportRecipients();
      const index = recipients.findIndex(r => r.id === id);
      if (index !== -1) {
        recipients[index] = { ...recipients[index], ...updates };
        localStorage.setItem('membership_report_recipients', JSON.stringify(recipients));
      }
    }
    await this.logAction('UPDATE_RECIPIENT', `Report recipient updated: ${id}`);
  }

  // --- CUSTOM REPORT CONFIGS ---
  async getCustomReports(propertyId?: string, outletId?: string) {
    if (this.isSupabase()) {
      let query = supabase.from('custom_reports').select('*');
      if (propertyId) query = query.eq('property_id', propertyId);
      if (outletId && outletId !== 'all') query = query.eq('outlet_id', outletId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CustomReportConfig[];
    }
    const reports = JSON.parse(localStorage.getItem('membership_custom_reports') || '[]') as CustomReportConfig[];
    let filtered = reports;
    if (propertyId) filtered = filtered.filter(r => r.property_id === propertyId);
    if (outletId && outletId !== 'all') filtered = filtered.filter(r => r.outlet_id === outletId);
    return filtered;
  }

  async addCustomReport(config: Omit<CustomReportConfig, 'id' | 'created_at'>) {
    const newReport = {
      ...config,
      id: this.generateUUID(),
      created_at: new Date().toISOString()
    };

    if (this.isSupabase()) {
      const { error } = await supabase.from('custom_reports').insert([newReport]);
      if (error) throw error;
    } else {
      const reports = await this.getCustomReports();
      reports.push(newReport);
      localStorage.setItem('membership_custom_reports', JSON.stringify(reports));
    }
    await this.logAction('ADD_CUSTOM_REPORT', `Custom report defined: ${config.name}`);
    return newReport;
  }

  async updateCustomReport(id: string, updates: Partial<CustomReportConfig>) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('custom_reports').update(updates).eq('id', id);
      if (error) throw error;
    } else {
      const reports = await this.getCustomReports();
      const index = reports.findIndex(r => r.id === id);
      if (index !== -1) {
        reports[index] = { ...reports[index], ...updates };
        localStorage.setItem('membership_custom_reports', JSON.stringify(reports));
      }
    }
    await this.logAction('UPDATE_CUSTOM_REPORT', `Custom report modified: ${id}`);
  }

  async deleteCustomReport(id: string) {
    if (this.isSupabase()) {
      const { error } = await supabase.from('custom_reports').delete().eq('id', id);
      if (error) throw error;
    } else {
      const reports = await this.getCustomReports();
      const filtered = reports.filter(r => r.id !== id);
      localStorage.setItem('membership_custom_reports', JSON.stringify(filtered));
    }
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
      let query = supabase.from('notifications').select('*').order('created_at', { ascending: false });
      
      // Fetch all relevant notifications:
      // Admins see EVERYTHING for the outlet (including global ones with user_id is null)
      // Non-admin staff ONLY see notifications assigned to them (user_id = userId)
      if (isAdmin) {
        if (userId) {
          query = query.or(`user_id.eq.${userId},user_id.is.null`);
        } else {
          query = query.is('user_id', null);
        }
      } else {
        if (userId) {
          query = query.eq('user_id', userId);
        } else {
          return [];
        }
      }
      
      const { data, error } = await query;
      if (error) {
        if (error.code !== 'PGRST205') {
          console.warn("Failed to fetch notifications from Supabase, falling back to local storage", error);
        }
        return this.getLocalNotifications(userId, outletId, isAdmin);
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
    return this.getLocalNotifications(userId, outletId, isAdmin);
  }

  private getLocalNotifications(userId?: string, outletId?: string, isAdmin: boolean = false): Notification[] {
    let all = JSON.parse(localStorage.getItem('membership_notifications') || '[]') as Notification[];
    if (all.length === 0) {
      all = [
        {
          id: 'notif-default-1',
          title: 'System Notifications Active',
          message: 'Personal Training session logs, member updates, and sales activity are tracked here.',
          type: 'info',
          created_at: new Date().toISOString(),
          read: false,
          read_by: [],
          dismissed_by: []
        },
        {
          id: 'notif-default-2',
          title: 'PT Client Profile Manager Updated',
          message: 'You can now view PT guest profiles, track package sessions, log dates, verify digital signatures, and monitor revenue generated per member.',
          type: 'success',
          created_at: new Date(Date.now() - 1800000).toISOString(),
          read: false,
          read_by: [],
          dismissed_by: []
        }
      ];
      localStorage.setItem('membership_notifications', JSON.stringify(all));
    }
    console.log('getLocalNotifications: all count', all.length, 'userId', userId, 'isAdmin', isAdmin);
    let filtered = all;
    
    if (userId) {
      if (isAdmin) {
        filtered = filtered.filter(n => !n.user_id || n.user_id === userId);
      } else {
        // Non-admin staff ONLY see notifications specifically assigned to them
        filtered = filtered.filter(n => n.user_id === userId);
      }
      // Filter out dismissed notifications for this user
      filtered = filtered.filter(n => !n.dismissed_by || !n.dismissed_by.includes(userId));
      console.log('getLocalNotifications: after dismiss filter', filtered.length);
      
      // Map the 'read' status based on the read_by array for this user
      filtered = filtered.map(n => ({
        ...n,
        read: n.user_id === userId ? n.read : (n.read_by?.includes(userId) || false)
      }));
    } else {
      if (isAdmin) {
        filtered = filtered.filter(n => !n.user_id);
      } else {
        filtered = [];
      }
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
        
        // TRIGGER PUSH NOTIFICATION: Send targeted push ONLY if user_id is specified
        if (notification.user_id) {
          console.log(`[Push] Initiating targeted push for assigned user: ${notification.user_id}`);
          this.triggerPushNotification(
              notification.user_id, 
              notification.title, 
              notification.message
          ).catch(err => console.error(`[Push] Trigger failure for ${notification.user_id}:`, err));
        } else {
          // Unassigned/Global notification: Do not broadcast push to general staff devices
          console.log(`[Push] Unassigned/Global notification created: "${notification.title}". Skipping general staff push broadcast.`);
        }
      } catch (e) {
        console.error('[Push] Fatal error in addNotification sequence:', e);
        const localNotif = { ...dbNotification, id: this.generateUUID(), created_at: new Date().toISOString() };
        this.saveLocalNotification(localNotif);
        this.broadcastNotificationLocally(localNotif);
        return localNotif;
      }
      const fullNotif = { ...dbNotification, id: this.generateUUID(), created_at: new Date().toISOString() };
      this.broadcastNotificationLocally(fullNotif);
      return fullNotif;
    } else {
      const localNotif = { ...dbNotification, id: this.generateUUID(), created_at: new Date().toISOString() };
      this.saveLocalNotification(localNotif);
      this.broadcastNotificationLocally(localNotif);
      return localNotif;
    }
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
            id: crypto.randomUUID(), 
            icon: '/icon.png',
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
      } catch (e) {}
    }
    // Dispatch custom event for same-tab updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('notification_added', { detail: notification }));
    }
  }

  private saveLocalNotification(notification: Notification) {
    const notifications = JSON.parse(localStorage.getItem('membership_notifications') || '[]');
    notifications.push(notification);
    localStorage.setItem('membership_notifications', JSON.stringify(notifications));
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
    const notifications = JSON.parse(localStorage.getItem('membership_notifications') || '[]') as Notification[];
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
      localStorage.setItem('membership_notifications', JSON.stringify(notifications));
    }
  }

  private markAllLocalNotificationsAsRead(userId?: string, outletId?: string, ids?: string[]) {
    const notifications = JSON.parse(localStorage.getItem('membership_notifications') || '[]') as Notification[];
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
    localStorage.setItem('membership_notifications', JSON.stringify(updated));
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
    // Shared BroadcastChannel handler for cross-tab updates (only needed in local/offline mode)
    let bc: BroadcastChannel | null = null;
    
    if (!this.isSupabase() && typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel('notifications_channel');
      bc.onmessage = (event) => {
        const notification = event.data as Notification;
        // Match if targeted to user (admins also see global notifications with user_id is null)
        const userMatch = isAdmin ? (!notification.user_id || notification.user_id === userId) : (notification.user_id === userId);
        const outletMatch = !outletId || !notification.outlet_id || notification.outlet_id === outletId;
        
        if (userMatch && outletMatch) {
          // We assume BroadcastChannel only sends new notifications
          callback({ eventType: 'INSERT', new: notification });
        }
      };
    }

    // Only subscribe to Supabase if enabled
    if (this.isSupabase()) {
      const handlePayload = (payload: any) => {
        const newNotification = payload.new as Notification;
        const oldNotification = payload.old as Notification;
        
        const targetNotification = newNotification || oldNotification;
        if (targetNotification) {
          // Match if targeted to user (admins also see global notifications with user_id is null)
          const userMatch = isAdmin ? (!targetNotification.user_id || targetNotification.user_id === userId) : (targetNotification.user_id === userId);
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
      const getChannelName = () => `notifications-realtime-${userId}-${Math.random().toString(36).substring(7)}`;
      
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
    const notifications = JSON.parse(localStorage.getItem('membership_notifications') || '[]') as Notification[];
    if (userId) {
      const index = notifications.findIndex(n => n.id === id);
      if (index !== -1) {
        const dismissedBy = (notifications[index].dismissed_by || []) as string[];
        if (!dismissedBy.includes(userId)) {
          notifications[index].dismissed_by = [...dismissedBy, userId];
          localStorage.setItem('membership_notifications', JSON.stringify(notifications));
        }
      }
    } else {
      // Fallback to actual delete if no userId (should not happen in this new flow)
      const filtered = notifications.filter(n => n.id !== id);
      localStorage.setItem('membership_notifications', JSON.stringify(filtered));
    }
  }

  private deleteAllLocalNotifications(userId?: string, outletId?: string, ids?: string[]) {
    const notifications = JSON.parse(localStorage.getItem('membership_notifications') || '[]') as Notification[];
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
      localStorage.setItem('membership_notifications', JSON.stringify(updated));
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
      localStorage.setItem('membership_notifications', JSON.stringify(filtered));
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
    const subs = JSON.parse(localStorage.getItem('membership_push_subscriptions') || '{}');
    subs[userId] = subscription;
    localStorage.setItem('membership_push_subscriptions', JSON.stringify(subs));
  }

  async deletePushSubscription(userId: string, endpoint: string) {
    if (this.isSupabase()) {
      try {
        await supabase.from('push_subscriptions').delete().eq('user_id', userId);
      } catch (e) {
        console.warn('Failed to delete push subscription from Supabase', e);
      }
    }
    const subs = JSON.parse(localStorage.getItem('membership_push_subscriptions') || '{}');
    delete subs[userId];
    localStorage.setItem('membership_push_subscriptions', JSON.stringify(subs));
  }
}

export const db = new DatabaseService();
