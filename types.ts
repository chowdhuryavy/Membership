export type Permission = 
  // Dashboard & Analytics
  | 'dashboard:view' | 'dashboard:view_financials' | 'dashboard:view_insights' | 'dashboard:view_charts' | 'dashboard:export_stats'
  
  // Membership Management
  | 'members:view' | 'members:create' | 'members:edit' | 'members:delete' | 'members:view_contact_info' | 'members:freeze' | 'members:bulk_freeze' | 'members:renew' | 'members:print_contract' | 'members:view_history' | 'members:export' | 'members:view_digital_card' | 'members:manage_custom_fields'
  
  // Personal Training (PT)
  | 'pt_members:view' | 'pt_members:create' | 'pt_members:edit' | 'pt_members:delete' | 'pt_members:manage_sessions' | 'pt_members:print' | 'pt_members:export' | 'pt_members:view_health_consent' | 'pt_members:assign_trainer'
  
  // Entrance Fee & Day Pass
  | 'entrance_fee:view' | 'entrance_fee:create' | 'entrance_fee:edit' | 'entrance_fee:delete' | 'entrance_fee:print' | 'entrance_fee:export' | 'entrance_fee:view_history'
  
  // Facility Check-In
  | 'checkin:view' | 'checkin:manage' | 'checkin:self_kiosk' | 'checkin:sql_access' | 'checkin:export' | 'checkin:qr_scanner'
  
  // Staff & Schedules
  | 'staff:view' | 'staff:manage' | 'staff:manage_leaves' | 'staff:manage_schedules' | 'staff:view_incentives' | 'staff:manage_portal_settings' | 'staff:export'
  
  // Categories & Membership Tiers
  | 'categories:view' | 'categories:create' | 'categories:edit' | 'categories:delete' | 'categories:reorder'
  
  // Resource Scheduling & Bookings
  | 'bookings:view' | 'bookings:create' | 'bookings:edit' | 'bookings:delete' | 'bookings:manage_resources' | 'bookings:view_therapist_schedule' | 'bookings:export'
  
  // Sales, POS & Inventory
  | 'sales:view' | 'sales:create' | 'sales:edit' | 'sales:delete' | 'sales:void' | 'sales:refund' | 'sales:print_receipt' | 'sales:export' | 'inventory:view' | 'inventory:manage' | 'inventory:adjust_stock' | 'inventory:export'
  
  // Financial & Operational Reports
  | 'reports:view' | 'reports:export' | 'reports:view_financial' | 'reports:view_operational' | 'reports:view_inventory' | 'reports:view_staff' | 'reports:view_expiring' | 'reports:view_active_members' | 'reports:view_massage_revenue' | 'reports:view_monthly_revenue' | 'reports:custom_builder'
  
  // Users & Audit Logs
  | 'users:view' | 'users:create' | 'users:edit' | 'users:delete' | 'users:edit_email' | 'users:manage_overrides' | 'users:edit_self' | 'users:unlock'
  | 'logs:view' | 'logs:search' | 'logs:filter' | 'logs:clear' | 'logs:export'
  
  // System Configuration & Settings
  | 'settings:view' | 'settings:edit' 
  | 'settings:view_global' | 'settings:view_properties' | 'settings:view_outlets' | 'settings:view_roles' | 'settings:view_currency' | 'settings:view_shortcuts' | 'settings:view_documents' | 'settings:view_maintenance' | 'settings:view_navigation' | 'settings:view_incentives' | 'settings:manage_visibility' | 'settings:view_staff_portal' | 'settings:view_booking_engine' | 'settings:view_membership_types' | 'settings:view_massage_rooms' | 'settings:view_reports_config' | 'settings:view_custom_reports' | 'settings:view_entrance_fee' | 'settings:view_expiration_reminders'
  | 'settings:manage_global' | 'settings:manage_properties' | 'settings:manage_outlets' | 'settings:manage_roles' | 'settings:manage_currency' | 'settings:manage_shortcuts' | 'settings:manage_documents' | 'settings:manage_maintenance' | 'settings:manage_navigation' | 'settings:manage_incentives' | 'settings:manage_staff_portal' | 'settings:manage_booking_engine' | 'settings:manage_membership_types' | 'settings:manage_massage_rooms' | 'settings:manage_reports_config' | 'settings:manage_custom_reports' | 'settings:manage_entrance_fee' | 'settings:manage_expiration_reminders'; 

export interface PermissionGroup {
  id: string;
  label: string;
  permissions: {
    key: Permission;
    label: string;
    description: string;
  }[];
}

export interface UserPermissionOverride {
  id: string;
  user_id: string;
  permission_key: Permission;
  is_granted: boolean;
}

export interface ReportRecipient {
  id: string;
  email: string; // Can be comma-separated list
  property_id: string;
  outlet_id: string; // 'all' for all outlets in property
  report_type: 
    | 'revenue_recognition' 
    | 'daily_sales' 
    | 'daily_revenue' 
    | 'monthly_summary' 
    | 'monthly_revenue' 
    | 'incentives' 
    | 'members_joined' 
    | 'expiring_memberships' 
    | 'active_members' 
    | 'massage_room_revenue' 
    | 'pt_members' 
    | 'retail_stock' 
    | 'entrance_fee' 
    | 'attendance_checkin' 
    | 'member_freeze'
    | 'sale_void'
   ;
  send_time: string; // HH:mm format
  report_date_type?: 'today' | 'yesterday'; // For daily reports
  incentive_dept?: 'Massage' | 'Membership' | 'Personal Training' | 'Sale' | 'Referral' | 'All';
  selected_membership_type_id?: string | 'all';
  revenue_mode?: 'cash' | 'accrual';
  is_active: boolean;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  is_system?: boolean;
}

export interface Property {
  id: string;
  name: string;
  logo_url: string;
  address: string;
  phone?: string;
  signatory_config?: Record<string, { prepared?: string, reviewed?: string, approved?: string }>;
}

export interface ExpirationReminderOutletConfig {
  enabled: boolean;
  days_before: number[]; // e.g. [30, 14, 7, 1, 0]
  send_time?: string; // e.g. "09:00"
  custom_message?: string;
  renewal_contact_phone?: string;
  renewal_contact_email?: string;
}

export interface ExpirationReminderConfig {
  global_enabled: boolean;
  outlets: Record<string, ExpirationReminderOutletConfig>;
  test_recipient_email?: string;
}

export interface ExpirationReminderLog {
  id: string;
  member_id: string;
  member_name: string;
  member_number: string;
  recipient_email: string;
  outlet_id: string;
  outlet_name: string;
  property_name: string;
  expiry_date: string;
  days_remaining: number;
  sent_at: string;
  status: 'sent' | 'failed';
  error_message?: string;
}

export interface Outlet {
  id: string;
  name: string;
  property_id: string;
  logo_url?: string;
  address?: string;
  phone?: string;
  signatory_config?: Record<string, { prepared?: string, reviewed?: string, approved?: string }>;
  contract_template?: string; 
  conditions?: string; 
  booking_enabled?: boolean;
  booking_start_time?: string;
  booking_end_time?: string;
  expiration_reminders_enabled?: boolean;
  expiration_reminder_days?: number[];
  backup_email?: string;
  backup_enabled?: boolean;
}

export interface StaffLeave {
  id: string;
  staff_id: string;
  start_date: string;
  end_date: string;
  created_at: string;
}

export interface MassageRoom {
  id: string;
  property_id: string;
  outlet_id: string;
  name: string;
  number: string;
  is_active: boolean;
}

export interface StaffPortalSettings {
  show_daily_schedule: boolean;
  show_monthly_summary: boolean;
  show_incentives: boolean;
  show_session_notes: boolean;
}

export interface OutletAssignment {
  outlet_id: string;
  start_date: string;
  end_date?: string | null;
}

export interface Staff {
  id: string;
  property_id: string;
  outlet_ids: string[];
  outlet_assignments?: OutletAssignment[];
  name: string;
  role: string;
  employee_number?: string;
  can_login?: boolean;
  password?: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  is_eligible_for_incentives: boolean; 
  auth_id?: string;
  joining_date?: string; 
  inactive_date?: string; 
  probation_start_date?: string; 
  probation_end_date?: string;   
  created_at: string;
  staff_portal_settings?: StaffPortalSettings;
  failed_login_attempts?: number;
  is_locked?: boolean;
  locked_at?: string | null;
  unlocked_at?: string | null;
  unlocked_by?: string | null;
}

export interface MembershipType {
  id: string;
  outlet_id: string;
  name: string;
  created_at: string;
}

export interface CategoryPrivilege {
  id: string;
  name: string;
  quantity: number;
}

export interface MembershipCategory {
  id: string;
  outlet_id: string;
  membership_type_id?: string;
  name: string;
  duration_months: number;
  base_rate: number;
  max_freeze_days: number;
  privileges?: CategoryPrivilege[];
}

export interface UserProfile {
  id: string;
  auth_id?: string | null;
  email: string;
  role_id: string;
  name: string;
  allowed_outlets: string[];
  default_outlet_id?: string;
  temp_password?: string | null;
  overrides?: UserPermissionOverride[]; // Hydrated in session
  is_active: boolean;
  failed_login_attempts?: number;
  is_locked?: boolean;
  locked_at?: string | null;
  unlocked_at?: string | null;
  unlocked_by?: string | null;
}

export type LogModule = 
  | 'Authentication' | 'Dashboard' | 'Members' | 'Memberships' 
  | 'Check-In / Check-Out' | 'POS' | 'Massage & Spa' 
  | 'Facility Booking' | 'Staff Management' | 'Inventory' 
  | 'Reports' | 'Settings' | 'User Management' | 'Roles & Permissions' 
  | 'System' | 'Actions';

export type LogSeverity = 'info' | 'warning' | 'error' | 'success';

export interface SystemLog {
  id: string;
  timestamp: string;
  user_id: string;
  user_name: string;
  role_name?: string;
  property_id?: string;
  property_name?: string;
  outlet_id?: string;
  outlet_name?: string;
  module: LogModule;
  action: string;
  description: string;
  status: 'success' | 'failed' | 'warning';
  severity: LogSeverity;
  
  // Detailed tracking
  details?: string; // Kept for legacy compatibility
  old_values?: any;
  new_values?: any;
  record_id?: string;
  affected_entity?: string; // e.g. 'Member', 'Invoice'
  
  // Contextual data
  ip_address?: string;
  browser?: string;
  os?: string;
  device_type?: string;
  session_id?: string;
  request_url?: string;
  http_method?: string;
  response_status?: number;
  execution_time_ms?: number;
  error_message?: string;
  stack_trace?: string;
}

export interface Currency {
  id: string;
  code: string;
  symbol: string;
  rate: number;
  is_default: boolean;
  property_id?: string;
}

export interface CompanySettings {
  name: string;
  logo_url: string;
  address: string;
  phone?: string;
  currency_id: string;
  report_title?: string;
  report_subtitle?: string;
  signatory_config?: Record<string, { prepared?: string, reviewed?: string, approved?: string }>;
  keyboard_shortcuts?: Record<string, string>;
  contract_template?: string; 
  navigation_order?: string[];
  restricted_permissions?: string[];
  conditions?: string;
  staff_portal_settings?: Record<string, any>;
  expiration_reminder_config?: ExpirationReminderConfig;
  session_timeout_minutes?: number;
}

export enum MemberStatus {
  ACTIVE = 'Active',
  FROZEN = 'Frozen',
  EXPIRED = 'Expired',
  PENDING = 'Pending',
  TENTATIVE = 'Tentative',
  CANCELLED = 'Cancelled'
}

export interface Member {
  id: string;
  property_id?: string;
  outlet_id?: string;
  membership_type_id?: string;
  membership_number: string;
  guest_name: string;
  category_id: string;
  start_date: string;
  original_end_date: string;
  current_end_date: string;
  cancellation_date?: string;
  actual_rate: number;
  discount: number;
  net_amount: number;
  original_net_amount?: number;
  daily_rate: number;
  check_no?: string;
  status: MemberStatus;
  created_at?: string;
  nationality?: string;
  dob?: string;
  email?: string;
  phone?: string;
  is_married?: boolean;
  package_type?: 'Single' | 'Couple' | 'Double' | 'Family';
  access_type?: 'Pool' | 'Spa' | 'Both';
  membership_type?: 'New' | 'Renew';
  spouse_name?: string;
  spouse_dob?: string;
  kids?: { name: string; dob: string; id_card_url?: string }[];
  remarks?: string;
  member_signature?: string;
  staff_signature?: string;
  id_card_url?: string;
  spouse_id_card_url?: string;
  notes?: string;
  referrer_name?: string;
  privilege_usage?: { 
    privilege: string; 
    used_count: number; 
    updated_date?: string; 
    updated_by?: string;
    history?: {
      date: string;
      service_date?: string;
      by: string;
      change: number;
      new_total: number;
      note?: string;
    }[];
  }[];
}

export interface Freeze {
  id: string;
  member_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason?: string;
  is_maintenance?: boolean; // If true, doesn't count towards tier limits
  batch_id?: string; // Groups bulk freezes together
  outlet_id?: string;
}

export interface Guest {
  id: string;
  name: string;
  phone: string;
  email?: string;
  property_id: string;
  created_at: string;
  id_card_url?: string;
}

export interface Therapist {
  id: string;
  name: string;
  specialty: string;
  country: string;
  property_id: string;
  outlet_id: string;
  type?: string;
}

export interface MassageType {
  id: string;
  property_id: string;
  outlet_id: string;
  name: string;
  price: number;
  duration_minutes: number;
  description?: string;
  category?: string;
}

export interface MassageBooking {
  id: string;
  property_id: string;
  outlet_id: string;
  guest_id: string;
  therapist_id: string;
  date: string;
  start_time: string;
  end_time: string;
  massage_type_id?: string;
  inventory_item_id?: string;
  additional_service_ids?: string[];
  price: number;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no-show';
  created_at: string;
  discount?: number;
  discount_reason?: string;
  discount_id_url?: string;
  category?: string;
  room_id?: string;
  check_no?: string;
  payment_method?: 'cash' | 'card' | 'transfer';
  session_notes?: string;
}

export type SaleCategory = 'Retail' | 'Personal Training' | 'Entrance Fee' | 'Massage' | 'Other';

export interface Sale {
  id: string;
  property_id: string;
  outlet_id: string;
  guest_id?: string; 
  guest_name: string; 
  category: SaleCategory;
  item_id?: string; 
  item_name: string;
  quantity: number;
  unit_price: number;
  gross_amount: number;
  discount_amount: number;
  net_amount: number;
  payment_method: string;
  status: 'completed' | 'void';
  sold_by_id?: string; 
  secondary_sold_by_id?: string;
  booking_id?: string;
  discount_reason?: string;
  discount_id_url?: string;
  created_at: string;
  remarks?: string;
  session_notes?: string;
}

export interface EntranceFeeConsent {
  id: string;
  outlet_id: string;
  guest_name: string;
  phone?: string;
  email?: string;
  qid_passport?: string;
  date: string;
  time?: string;
  room_number?: string;
  is_hotel_guest?: boolean;
  sale_id?: string;
  item_name?: string;
  guest_signature?: string;
  notes?: string;
  created_at: string;
}

export interface PTSession {
  id: string;
  pt_member_id: string;
  outlet_id?: string;
  date: string;
  staff_id: string;
  notes?: string;
  guest_signature?: string;
  created_at: string;
}

export interface PTMember {
  id: string;
  outlet_id: string;
  property_id?: string;
  guest_name: string;
  phone?: string;
  email?: string;
  dob?: string;
  membership_number?: string;
  total_sessions: number;
  used_sessions: number;
  sale_id?: string;
  start_date: string;
  end_date: string;
  status: 'Active' | 'Completed' | 'Expired';
  trainer_id?: string;
  notes?: string;
  parq_answers?: { [key: number]: boolean };
  parq_details?: string;
  is_under_18?: boolean;
  guardian_name?: string;
  guardian_relationship?: string;
  guardian_contact?: string;
  guardian_signature?: string;
  member_signature?: string;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  property_id: string;
  outlet_id: string;
  name: string;
  category: SaleCategory;
  price: number;
  stock_quantity: number;
  track_inventory: boolean;
  created_at: string;
}

export interface InventoryLog {
  id: string;
  item_id: string;
  property_id: string;
  outlet_id: string;
  change_amount: number; // Positive for restock, negative for adjustment/loss
  previous_stock: number;
  new_stock: number;
  reason: 'Restock' | 'Adjustment' | 'Sale' | 'Return' | 'Initial';
  notes?: string;
  created_by?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean; // Keep for backward compatibility
  user_id?: string;
  outlet_id?: string;
  type?: 'info' | 'warning' | 'success' | 'error';
  read_by?: string[]; // Array of user IDs who have read this
  dismissed_by?: string[]; // Array of user IDs who have dismissed this
  required_permission?: Permission; // Permission required to see this notification
}

export interface CustomReportColumn {
  key: string;
  label: string;
  visible: boolean;
  width?: number;
}

export interface CustomReportFilter {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains';
  value: any;
}

export interface CustomReportAggregation {
  column: string;
  function: 'sum' | 'avg' | 'count';
}

export interface CustomReportConfig {
  id: string;
  name: string;
  data_source: 'members' | 'bookings' | 'sales' | 'inventory' | 'staff';
  columns: CustomReportColumn[];
  group_by?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  filters: CustomReportFilter[];
  aggregations: CustomReportAggregation[];
  date_range: 'today' | 'last_7_days' | 'last_30_days' | 'this_month' | 'custom';
  visualization_type: 'table' | 'bar' | 'line' | 'pie';
  property_id?: string;
  outlet_id?: string;
  created_at: string;
  created_by: string;
}

export interface IncentiveRule {
  id: string;
  name: string;
  scope: 'Global' | 'Property' | 'Outlet';
  scope_id: string | 'global'; 
  applies_to: 'Membership' | 'Massage' | 'Sale' | 'Personal Training' | 'Referral';
  target_id: string | 'all'; 
  distribution_type: 'Individual' | 'Shared'; 
  calculation_type: 'Percentage' | 'Fixed';
  value: number;
  min_price?: number;
  max_price?: number;
  min_duration_minutes?: number;
  max_duration_minutes?: number;
  apply_discount_percentage: boolean; 
  disable_shared_incentive?: boolean;
  referral_payee?: 'Staff' | 'Referrer' | 'Both';
  is_active: boolean;
}

export interface MemberCheckIn {
  id: string;
  member_id: string;
  membership_number: string;
  guest_name: string;
  outlet_id: string;
  property_id?: string;
  check_in_time: string;
  check_out_time?: string | null;
  duration_minutes?: number | null;
  check_in_method: 'reception_scan' | 'reception_manual' | 'self_kiosk_qr' | 'self_kiosk_number';
  checked_in_by?: string;
  notes?: string;
  status: 'active' | 'completed';
  membership_status_at_checkin?: string;
  access_type?: string;
  created_at?: string;
}