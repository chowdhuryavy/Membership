
export type Permission = 
  | 'members:view' | 'members:create' | 'members:edit' | 'members:delete'
  | 'categories:view' | 'categories:create' | 'categories:edit' | 'categories:delete'
  | 'users:view' | 'users:create' | 'users:edit' | 'users:delete' | 'users:edit_email'
  | 'settings:view' | 'settings:edit'
  | 'reports:view' | 'reports:export'
  | 'logs:view'
  | 'properties:view' | 'properties:edit'
  | 'outlets:view' | 'outlets:edit';

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
}

export interface Outlet {
  id: string;
  name: string;
  property_id: string;
}

// Fixed: Added missing MembershipCategory interface to resolve multi-file import errors
export interface MembershipCategory {
  id: string;
  outlet_id: string;
  name: string;
  duration_months: number;
  base_rate: number;
}

export interface UserProfile {
  id: string;
  auth_id?: string | null; // Links to Supabase Auth ID
  email: string;
  role_id: string;
  name: string;
  allowed_outlets: string[];
  temp_password?: string | null; // Store for shadow sync
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
}

export interface CompanySettings {
  name: string;
  logo_url: string;
  address: string;
  currency_id: string;
  report_title?: string;
  report_subtitle?: string;
  signatory_prepared_role?: string;
  signatory_reviewed_role?: string;
  signatory_approved_role?: string;
  keyboard_shortcuts?: Record<string, string>;
}

export enum MemberStatus {
  ACTIVE = 'Active',
  FROZEN = 'Frozen',
  EXPIRED = 'Expired',
  PENDING = 'Pending'
}

export interface Member {
  id: string;
  outlet_id?: string;
  membership_number: string;
  guest_name: string;
  category_id: string;
  start_date: string;
  original_end_date: string;
  current_end_date: string;
  actual_rate: number;
  discount: number;
  net_amount: number;
  daily_rate: number;
  check_no?: string;
  status: MemberStatus;
}

export interface Freeze {
  id: string;
  member_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
}
