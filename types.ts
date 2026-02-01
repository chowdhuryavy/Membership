
export type Permission = 
  | 'manage_members' 
  | 'manage_categories' 
  | 'manage_users' 
  | 'manage_settings' 
  | 'view_reports'
  | 'view_logs';

export interface Role {
  id: string;
  name: string;
  permissions: Permission[];
  is_system?: boolean; // Prevent deleting system roles
}

export interface UserProfile {
  id: string;
  email: string;
  role_id: string; // References Role.id
  name: string;
  allowed_outlets: string[]; // Array of Outlet IDs this user can access
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
  rate: number; // vs base currency
  is_default: boolean;
}

export interface Outlet {
  id: string;
  name: string;
}

export interface CompanySettings {
  name: string;
  logo_url: string;
  address: string;
  currency_id: string;
  report_title?: string;
  report_subtitle?: string;
}

export interface MembershipCategory {
  id: string;
  outlet_id?: string; // Scoped to outlet
  name: string;
  duration_months: number;
  base_rate: number;
}

export enum MemberStatus {
  ACTIVE = 'Active',
  FROZEN = 'Frozen',
  EXPIRED = 'Expired',
  PENDING = 'Pending'
}

export interface Member {
  id: string;
  outlet_id?: string; // Scoped to outlet
  membership_number: string;
  guest_name: string;
  category_id: string;
  start_date: string; // ISO Date String
  original_end_date: string; // ISO Date String
  current_end_date: string; // ISO Date String
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
