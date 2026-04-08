export type Permission = 
  | 'dashboard:view' | 'dashboard:view_financials' | 'dashboard:view_insights'
  | 'members:view' | 'members:create' | 'members:edit' | 'members:delete' | 'members:view_contact_info' | 'members:freeze' | 'members:bulk_freeze' | 'members:renew' | 'members:print_contract' | 'members:view_history'
  | 'categories:view' | 'categories:create' | 'categories:edit' | 'categories:delete'
  | 'users:view' | 'users:create' | 'users:edit' | 'users:delete' | 'users:edit_email' | 'users:manage_overrides' | 'users:edit_self'
  | 'staff:view' | 'staff:manage' | 'staff:manage_leaves' | 'staff:manage_portal_settings'
  | 'settings:view' | 'settings:edit' 
  | 'settings:view_global' | 'settings:view_properties' | 'settings:view_outlets' | 'settings:view_roles' | 'settings:view_currency' | 'settings:view_shortcuts' | 'settings:view_documents' | 'settings:view_maintenance' | 'settings:view_navigation' | 'settings:view_incentives' | 'settings:manage_visibility' | 'settings:view_staff_portal' | 'settings:view_booking_engine' | 'settings:view_membership_types' | 'settings:view_massage_rooms' | 'settings:view_reports_config' | 'settings:view_custom_reports'
  | 'settings:manage_global' | 'settings:manage_properties' | 'settings:manage_outlets' | 'settings:manage_roles' | 'settings:manage_currency' | 'settings:manage_shortcuts' | 'settings:manage_documents' | 'settings:manage_maintenance' | 'settings:manage_navigation' | 'settings:manage_incentives' | 'settings:manage_staff_portal' | 'settings:manage_booking_engine' | 'settings:manage_membership_types' | 'settings:manage_massage_rooms' | 'settings:manage_reports_config' | 'settings:manage_custom_reports'
  | 'reports:view' | 'reports:export' | 'reports:view_financial' | 'reports:view_operational' | 'reports:view_inventory' | 'reports:view_staff'
  | 'logs:view' | 'logs:search' | 'logs:filter' | 'logs:clear'
  | 'bookings:view' | 'bookings:create' | 'bookings:edit' | 'bookings:delete' | 'bookings:manage_resources' | 'bookings:view_therapist_schedule'
  | 'sales:view' | 'sales:create' | 'sales:edit' | 'sales:delete' | 'sales:void'
  | 'inventory:view' | 'inventory:manage' | 'inventory:adjust_stock'; 

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
  report_type: 'revenue_recognition' | 'daily_sales' | 'incentives' | 'members_joined' | 'expiring_memberships' | 'massage_room_revenue' | 'daily_revenue' | 'monthly_summary' | 'monthly_revenue';
  send_time: string; // HH:mm format
  report_date_type?: 'today' | 'yesterday'; // For daily reports
  incentive_dept?: 'Massage' | 'Membership' | 'Personal Training';
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
  signatory_config?: Record<string, { prepared?: string, reviewed?: string, approved?: string }>;
}

export interface Outlet {
  id: string;
  name: string;
  property_id: string;
  logo_url?: string;
  signatory_config?: Record<string, { prepared?: string, reviewed?: string, approved?: string }>;
  contract_template?: string; 
  conditions?: string; 
  booking_enabled?: boolean;
  booking_start_time?: string;
  booking_end_time?: string;
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

export interface Staff {
  id: string;
  property_id: string;
  outlet_ids: string[];
  name: string;
  role: string;
  employee_number?: string;
  can_login?: boolean;
  password?: string;
  email?: string;
  phone?: string;
  is_active: boolean;
  is_eligible_for_incentives: boolean; 
  probation_start_date?: string; 
  probation_end_date?: string;   
  created_at: string;
  staff_portal_settings?: StaffPortalSettings;
}

export interface MembershipType {
  id: string;
  outlet_id: string;
  name: string;
  created_at: string;
}

export interface MembershipCategory {
  id: string;
  outlet_id: string;
  membership_type_id?: string;
  name: string;
  duration_months: number;
  base_rate: number;
  max_freeze_days: number;
}

export interface UserProfile {
  id: string;
  auth_id?: string | null;
  email: string;
  role_id: string;
  name: string;
  allowed_outlets: string[];
  temp_password?: string | null;
  overrides?: UserPermissionOverride[]; // Hydrated in session
  is_active: boolean;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  user_id: string;
  user_name: string;
  action: string;
  details: string;
  outlet_id?: string;
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
  currency_id: string;
  report_title?: string;
  report_subtitle?: string;
  signatory_config?: Record<string, { prepared?: string, reviewed?: string, approved?: string }>;
  keyboard_shortcuts?: Record<string, string>;
  contract_template?: string; 
  navigation_order?: string[];
  restricted_permissions?: string[];
  conditions?: string;
  staff_portal_settings?: Record<string, boolean>;
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
  sales_rep_id?: string; 
  created_at?: string;
  nationality?: string;
  dob?: string;
  email?: string;
  phone?: string;
  is_married?: boolean;
  package_type?: 'Single' | 'Couple' | 'Family';
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
  read: boolean;
  user_id?: string;
  outlet_id?: string;
  type?: 'info' | 'warning' | 'success' | 'error';
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
  data_source: 'members' | 'bookings' | 'sales' | 'inventory';
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
  applies_to: 'Membership' | 'Massage' | 'Sale' | 'Personal Training';
  target_id: string | 'all'; 
  distribution_type: 'Individual' | 'Shared'; 
  calculation_type: 'Percentage' | 'Fixed';
  value: number;
  min_price?: number;
  max_price?: number;
  min_duration_minutes?: number;
  max_duration_minutes?: number;
  apply_discount_percentage: boolean; 
  is_active: boolean;
}