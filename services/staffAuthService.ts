import { db } from './mockSupabase';
import { emailService } from './emailService';
import { setDeviceSessionItem, removeDeviceSessionItem, getDeviceSessionItem } from './deviceStorage';
import { Staff } from '../types';

const STAFF_SESSION_KEY = 'staff_session';

export class StaffAuthService {
  private static instance: StaffAuthService;

  public static getInstance(): StaffAuthService {
    if (!StaffAuthService.instance) {
      StaffAuthService.instance = new StaffAuthService();
    }
    return StaffAuthService.instance;
  }

  public async initiateLogin(employeeNumber: string, passwordAttempt: string): Promise<{ success: boolean; staff?: Staff; error?: string; requiresOtp?: boolean }> {
    const cleanEmpId = (employeeNumber || '').trim().toUpperCase();
    if (!cleanEmpId || !passwordAttempt) {
      return { success: false, error: 'Please enter both employee number and password.' };
    }

    try {
      const staffMembers = await db.getStaff().catch(() => []);
      const staff = staffMembers.find(s => s.employee_number.toUpperCase() === cleanEmpId);

      if (!staff) {
        return { success: false, error: 'Staff record not found.' };
      }

      if (staff.status !== 'Active') {
        return { success: false, error: 'Your staff account is currently suspended.' };
      }

      // In a real system, we'd verify password hash. For mock, we check staff_password or a default
      const storedPass = (staff as any).staff_password || 'staff123';
      if (passwordAttempt !== storedPass) {
        return { success: false, error: 'Incorrect credentials.' };
      }

      // Check if 2FA is required for this staff member (e.g. from settings or role)
      const settings = await db.getSettings().catch(() => null);
      if (settings?.require_staff_otp) {
        // Generate and send OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        
        // Mock store OTP in staff record for verification
        await db.updateStaff(staff.id, { 
            otp_code: otp, 
            otp_expires_at: expiresAt 
        } as any);

        if (staff.email) {
            await emailService.sendEmail(
                staff.email, 
                'Staff Portal Security Code', 
                `Your verification code is: ${otp}`
            );
        }

        return { success: true, requiresOtp: true };
      }

      return { success: true, staff };
    } catch (e: any) {
      return { success: false, error: e.message || 'Authentication system error.' };
    }
  }

  public async verifyOtp(employeeNumber: string, otp: string): Promise<{ success: boolean; staff?: Staff; error?: string }> {
    const cleanEmpId = (employeeNumber || '').trim().toUpperCase();
    try {
      const staffMembers = await db.getStaff().catch(() => []);
      const staff = staffMembers.find(s => s.employee_number.toUpperCase() === cleanEmpId);

      if (!staff) return { success: false, error: 'Staff record lost.' };

      const s = staff as any;
      if (!s.otp_code || s.otp_code !== otp) {
        return { success: false, error: 'Invalid verification code.' };
      }

      if (s.otp_expires_at && new Date(s.otp_expires_at) < new Date()) {
        return { success: false, error: 'Verification code expired.' };
      }

      // Clear OTP and return staff
      await db.updateStaff(staff.id, { otp_code: null, otp_expires_at: null } as any);
      return { success: true, staff };
    } catch (e: any) {
      return { success: false, error: 'OTP verification failed.' };
    }
  }

  public logout() {
    removeDeviceSessionItem(STAFF_SESSION_KEY);
  }

  public getActiveSession(): Staff | null {
    const str = getDeviceSessionItem(STAFF_SESSION_KEY);
    if (str) {
      try {
        return JSON.parse(str);
      } catch (e) {
        return null;
      }
    }
    return null;
  }
}

export const staffAuth = StaffAuthService.getInstance();
