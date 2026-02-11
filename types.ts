
export type Permission = 
  | 'dashboard:view' | 'dashboard:view_financials'
  | 'members:view' | 'members:create' | 'members:edit' | 'members:delete' | 'members:view_contact_info' | 'members:freeze' | 'members:renew' | 'members:print_contract'
  | 'categories:view' | 'categories:create' | 'categories:edit' | 'categories:delete'
  | 'users:view' | 'users:create' | 'users:edit' | 'users:delete' | 'users:edit_email'
  | 'settings:view' | 'settings:edit'
  | 'reports:view' | 'reports:export'
  | 'logs:view'
  | 'properties:view' | 'properties:edit'
  | 'outlets:view' | 'outlets:edit'
  | 'bookings:view' | 'bookings:create' | 'bookings:edit' | 'bookings:delete' | 'bookings:manage_resources'; 

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
  signatory_prepared_role?: string;
  signatory_reviewed_role?: string;
  signatory_approved_role?: string;
  contract_template?: string; 
  conditions?: string; 
}

export interface MembershipCategory {
  id: string;
  outlet_id: string;
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
  contract_template?: string; 
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
  kids?: { name: string; dob: string }[];
  remarks?: string;
}

export interface Freeze {
  id: string;
  member_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
}

export interface Guest {
  id: string;
  name: string;
  phone: string;
  email?: string;
  property_id: string;
  created_at: string;
}

export interface Therapist {
  id: string;
  name: string;
  specialty: string;
  country: string;
  property_id: string;
}

export interface MassageType {
  id: string;
  property_id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

export interface MassageBooking {
  id: string;
  property_id: string;
  guest_id: string;
  therapist_id: string;
  date: string;
  start_time: string;
  end_time: string;
  massage_type_id: string;
  additional_service_ids?: string[];
  price: number;
  status: 'confirmed' | 'cancelled' | 'completed' | 'no-show';
  created_at: string;
  discount?: number;
}