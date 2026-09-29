import { GuestAccount, GuestPortalSettings } from '../types';
import { db } from './mockSupabase';
import { emailService } from './emailService';
import { getDeviceSessionItem, setDeviceSessionItem, removeDeviceSessionItem } from './deviceStorage';

const GUEST_ACCOUNTS_STORAGE_KEY = 'hcm_guest_accounts_store';
const GUEST_SESSION_STORAGE_KEY = 'hcm_guest_session';
const GUEST_PORTAL_SETTINGS_KEY = 'hcm_guest_portal_settings';

export const DEFAULT_GUEST_PORTAL_SETTINGS: GuestPortalSettings = {
  is_enabled: true,
  allow_digital_card: true,
  allow_pt_tracking: true,
  allow_massage_bookings: true,
  allow_entrance_passes: true,
  allow_waiver_signing: true,
  allow_financial_history: true,
  allow_profile_editing: true,
  require_mandatory_waiver: false,
  welcome_message: 'Welcome to your luxury wellness portal.',
  support_phone: '+60 3-1234 5678',
  support_email: 'support@perfection.my'
};

/**
 * Generates a unique, high-entropy, elegant temporary password for guests and members.
 * Never static or repetitive (e.g. 'Zen#7492!kX', 'Luxe$3816@qM', 'Opal*9521#wT').
 */
export function generateDynamicTemporaryPassword(): string {
  const prefixes = [
    'Zen', 'Spa', 'Luxe', 'Aura', 'Opal', 'Jade', 'Silk', 'Flow',
    'Pure', 'Vibe', 'Sage', 'Star', 'Nova', 'Echo', 'Vale', 'Peak',
    'Fern', 'Dawn', 'Rose', 'Glow', 'Luna', 'Sol', 'Mira', 'Breeze'
  ];
  const symbols = ['!', '@', '#', '$', '%', '*', '&'];
  
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const symbol1 = symbols[Math.floor(Math.random() * symbols.length)];
  const digits = Math.floor(1000 + Math.random() * 9000); // 4 unique random digits
  const symbol2 = symbols[Math.floor(Math.random() * symbols.length)];
  
  const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lowers = 'abcdefghijkmnopqrstuvwxyz';
  const randUpper = uppers[Math.floor(Math.random() * uppers.length)];
  const randLower = lowers[Math.floor(Math.random() * lowers.length)];
  
  return `${prefix}${symbol1}${digits}${symbol2}${randUpper}${randLower}`;
}

export class GuestAuthService {
  private static instance: GuestAuthService;

  public static getInstance(): GuestAuthService {
    if (!GuestAuthService.instance) {
      GuestAuthService.instance = new GuestAuthService();
    }
    return GuestAuthService.instance;
  }

  // --- SETTINGS MANAGEMENT ---
  public async getPortalSettings(scopeId?: string): Promise<GuestPortalSettings> {
    const key = scopeId ? `${GUEST_PORTAL_SETTINGS_KEY}_${scopeId}` : GUEST_PORTAL_SETTINGS_KEY;
    try {
      const companySettings = await db.getSettings().catch(() => null);
      if (companySettings?.guest_portal_settings_map && scopeId && companySettings.guest_portal_settings_map[scopeId]) {
        return { ...DEFAULT_GUEST_PORTAL_SETTINGS, ...companySettings.guest_portal_settings_map[scopeId] };
      }
      if (companySettings?.guest_portal_settings) {
        return { ...DEFAULT_GUEST_PORTAL_SETTINGS, ...companySettings.guest_portal_settings };
      }
      if (typeof localStorage !== 'undefined') {
        const local = localStorage.getItem(key) || localStorage.getItem(GUEST_PORTAL_SETTINGS_KEY);
        if (local) {
          return { ...DEFAULT_GUEST_PORTAL_SETTINGS, ...JSON.parse(local) };
        }
      }
    } catch (e) {
      console.warn('[GuestAuth] Error reading portal settings, using defaults');
    }
    return DEFAULT_GUEST_PORTAL_SETTINGS;
  }

  public async savePortalSettings(settings: Partial<GuestPortalSettings>, scopeId?: string): Promise<GuestPortalSettings> {
    const current = await this.getPortalSettings(scopeId);
    const updated = { ...current, ...settings };
    const key = scopeId ? `${GUEST_PORTAL_SETTINGS_KEY}_${scopeId}` : GUEST_PORTAL_SETTINGS_KEY;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, JSON.stringify(updated));
      }
      const companySettings = await db.getSettings().catch(() => null);
      if (companySettings) {
        const existingMap = companySettings.guest_portal_settings_map || {};
        const updatedMap = scopeId ? { ...existingMap, [scopeId]: updated } : existingMap;
        await db.updateSettings({
          ...companySettings,
          guest_portal_settings: scopeId ? (companySettings.guest_portal_settings || updated) : updated,
          guest_portal_settings_map: updatedMap
        });
      }
    } catch (e) {
      console.error('[GuestAuth] Error saving portal settings:', e);
    }
    return updated;
  }

  // --- ACCOUNTS REGISTRY ---
  public async getAccounts(): Promise<GuestAccount[]> {
    try {
      const companySettings = await db.getSettings().catch(() => null);
      if (companySettings?.guest_accounts && Array.isArray(companySettings.guest_accounts)) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(GUEST_ACCOUNTS_STORAGE_KEY, JSON.stringify(companySettings.guest_accounts));
        }
        return companySettings.guest_accounts;
      }
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(GUEST_ACCOUNTS_STORAGE_KEY);
        if (raw) {
          return JSON.parse(raw) as GuestAccount[];
        }
      }
    } catch (e) {
      console.warn('[GuestAuth] Error reading guest accounts store:', e);
    }
    return [];
  }

  private async saveAccounts(accounts: GuestAccount[]): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(GUEST_ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
      }
      const companySettings = await db.getSettings().catch(() => null);
      if (companySettings) {
        await db.updateSettings({
          ...companySettings,
          guest_accounts: accounts
        });
      }
    } catch (e) {
      console.error('[GuestAuth] Error saving guest accounts:', e);
    }
  }

  public async deleteGuestAccount(id: string): Promise<boolean> {
    const accounts = await this.getAccounts();
    const filtered = accounts.filter(a => a.id !== id);
    if (filtered.length !== accounts.length) {
      await this.saveAccounts(filtered);
      return true;
    }
    return false;
  }

  public async deleteGuestAccountByMemberId(memberId: string): Promise<boolean> {
    const accounts = await this.getAccounts();
    const filtered = accounts.filter(a => a.member_id !== memberId && a.id !== memberId);
    if (filtered.length !== accounts.length) {
      await this.saveAccounts(filtered);
      return true;
    }
    return false;
  }

  public async getAccountByEmail(email: string): Promise<GuestAccount | null> {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) return null;
    let accounts = await this.getAccounts();
    let account = accounts.find(a => a.email.toLowerCase() === cleanEmail);

    if (!account) {
      try {
        const [members, ptMembers, guests] = await Promise.all([
          db.getMembers('').catch(() => []),
          db.getPTMembers('').catch(() => []),
          db.getGuests('').catch(() => [])
        ]);

        const matchedMember = members.find((m: any) => m.email && m.email.toLowerCase() === cleanEmail);
        const matchedPT = ptMembers.find((p: any) => p.email && p.email.toLowerCase() === cleanEmail);
        const matchedGuest = guests.find((g: any) => g.email && g.email.toLowerCase() === cleanEmail);

        if (matchedMember) {
          const res = await this.provisionGuestAccount({
            email: matchedMember.email,
            name: matchedMember.guest_name,
            phone: matchedMember.phone,
            property_id: matchedMember.property_id,
            outlet_id: matchedMember.outlet_id,
            member_id: matchedMember.id
          });
          return res.account;
        } else if (matchedPT) {
          const res = await this.provisionGuestAccount({
            email: matchedPT.email,
            name: matchedPT.guest_name,
            phone: matchedPT.phone,
            property_id: matchedPT.property_id,
            outlet_id: matchedPT.outlet_id,
            member_id: matchedPT.id
          });
          return res.account;
        } else if (matchedGuest) {
          const res = await this.provisionGuestAccount({
            email: matchedGuest.email,
            name: matchedGuest.name,
            phone: matchedGuest.phone,
            property_id: matchedGuest.property_id,
            guest_id: matchedGuest.id
          });
          return res.account;
        }
      } catch (e) {
        console.warn('[GuestAuth] Error auto-provisioning guest by email:', e);
      }
    }

    return account || null;
  }

  // --- PROVISIONING ON NEW GUEST CREATION ---
  /**
   * Automatically provisions a guest account whenever a new guest/member is created with an email.
   * Dispatches professional welcome credentials email with temporary password.
   */
  public async provisionGuestAccount(params: {
    email: string;
    name: string;
    phone?: string;
    property_id?: string;
    outlet_id?: string;
    member_id?: string;
    guest_id?: string;
    forceResend?: boolean;
  }): Promise<{ account: GuestAccount; isNew: boolean; tempPassword?: string }> {
    const cleanEmail = (params.email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Valid email address is required for guest portal account provisioning.');
    }

    const accounts = await this.getAccounts();
    let account = accounts.find(a => a.email.toLowerCase() === cleanEmail);
    let isNew = false;
    let tempPass = '';

    if (!account) {
      isNew = true;
      // Generate unique, dynamic temporary password
      tempPass = generateDynamicTemporaryPassword();

      account = {
        id: crypto.randomUUID ? crypto.randomUUID() : `ga_${Date.now()}`,
        email: cleanEmail,
        name: params.name || 'Valued Guest',
        phone: params.phone,
        password: tempPass,
        temp_password: tempPass,
        property_id: params.property_id,
        outlet_id: params.outlet_id,
        member_id: params.member_id,
        guest_id: params.guest_id,
        is_active: true,
        must_change_password: true,
        created_at: new Date().toISOString()
      };

      accounts.push(account);
      await this.saveAccounts(accounts);
    } else if (params.forceResend || account.must_change_password || !account.temp_password || account.temp_password.includes('594510')) {
      // Whenever resending, or if still on temporary password, or if stuck on old default, generate a fresh unique password!
      tempPass = generateDynamicTemporaryPassword();
      account.temp_password = tempPass;
      account.password = tempPass;
      account.must_change_password = true;
      if (params.name) account.name = params.name;
      if (params.phone) account.phone = params.phone;
      if (params.property_id) account.property_id = params.property_id;
      if (params.outlet_id) account.outlet_id = params.outlet_id;
      if (params.member_id) account.member_id = params.member_id;
      if (params.guest_id) account.guest_id = params.guest_id;
      await this.saveAccounts(accounts);
    } else {
      tempPass = account.temp_password || '';
    }

    // Dispatch welcome email if new or explicitly requested
    if ((isNew || params.forceResend) && tempPass) {
      emailService.sendGuestWelcomeCredentialsEmail({
        guestName: account.name,
        guestEmail: account.email,
        temporaryPassword: tempPass,
        propertyId: account.property_id,
        outletId: account.outlet_id
      }).catch(err => {
        console.error('[GuestAuth] Error dispatching credentials email:', err);
      });
    }

    return { account, isNew, tempPassword: tempPass };
  }

  // --- LOGIN ---
  public async loginGuest(
    email: string,
    password: string
  ): Promise<{ error?: string; account?: GuestAccount; requiresPasswordChange?: boolean }> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    if (!cleanEmail || !cleanPass) {
      return { error: 'Please enter both your email address and password.' };
    }

    const account = await this.getAccountByEmail(cleanEmail);
    if (!account) {
      return { error: 'No guest account found with this email address. Please contact the front desk.' };
    }

    if (!account.is_active) {
      return { error: 'Your mobile portal access is currently suspended. Please contact front desk management.' };
    }

    // Verify member existence if account is linked to a member record
    if (account.member_id) {
      try {
        const members = await db.getMembers('').catch(() => []);
        const matchedMember = members.find((m: any) => m.id === account.member_id);
        if (!matchedMember || matchedMember.status === 'Cancelled') {
          account.is_active = false;
          await this.deleteGuestAccountByMemberId(account.member_id);
          return { error: 'Your membership account is no longer active. Please contact front desk management.' };
        }
      } catch (e) {
        console.warn('[GuestAuth] Could not verify member status:', e);
      }
    }

    // Facility-scoped portal settings check (per property / outlet)
    const scopeId = account.outlet_id || account.property_id;
    const facilitySettings = await this.getPortalSettings(scopeId);
    if (!facilitySettings.is_enabled) {
      return { error: 'Guest Mobile Portal access is currently disabled for this facility. Please contact front desk management.' };
    }

    const isPasswordValid = 
      account.password === cleanPass || 
      account.temp_password === cleanPass ||
      (Boolean(account.password) && account.password!.trim() === cleanPass) ||
      (Boolean(account.temp_password) && account.temp_password!.trim() === cleanPass);

    if (!isPasswordValid) {
      return { error: 'Incorrect email or password. Please verify and try again.' };
    }

    // Update last login
    account.last_login = new Date().toISOString();
    const accounts = await this.getAccounts();
    const idx = accounts.findIndex(a => a.id === account.id);
    if (idx !== -1) {
      accounts[idx] = account;
      await this.saveAccounts(accounts);
    }

    // Set active guest session
    setDeviceSessionItem(GUEST_SESSION_STORAGE_KEY, JSON.stringify(account));

    return {
      account,
      requiresPasswordChange: Boolean(account.must_change_password)
    };
  }

  // --- FIRST-TIME OR MANDATORY PASSWORD CHANGE ---
  public async changeGuestPassword(
    email: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const accounts = await this.getAccounts();
    const idx = accounts.findIndex(a => a.email.toLowerCase() === cleanEmail);

    if (idx === -1) {
      return { success: false, error: 'Account not found.' };
    }

    accounts[idx].password = newPassword;
    accounts[idx].temp_password = undefined;
    accounts[idx].must_change_password = false;
    await this.saveAccounts(accounts);

    // Update session
    setDeviceSessionItem(GUEST_SESSION_STORAGE_KEY, JSON.stringify(accounts[idx]));

    return { success: true };
  }

  // --- FORGOT PASSWORD WITH 6-DIGIT OTP ---
  public async requestPasswordResetOtp(
    email: string
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const account = await this.getAccountByEmail(cleanEmail);

    if (!account) {
      return { success: false, error: 'No guest account found with this email address.' };
    }

    if (!account.is_active) {
      return { success: false, error: 'Your account is suspended. Please contact the front desk.' };
    }

    // Generate 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

    const accounts = await this.getAccounts();
    const idx = accounts.findIndex(a => a.id === account.id);
    if (idx !== -1) {
      accounts[idx].otp_code = otp;
      accounts[idx].otp_expires_at = expiresAt;
      await this.saveAccounts(accounts);
    }

    // Send email
    await emailService.sendGuestPasswordResetOtpEmail({
      guestName: account.name,
      guestEmail: account.email,
      otpCode: otp,
      propertyId: account.property_id
    });

    return {
      success: true,
      message: 'A 6-digit verification code has been dispatched to your email address.'
    };
  }

  public async verifyPasswordResetOtpAndSetPassword(
    email: string,
    otpCode: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanOtp = (otpCode || '').trim();

    const accounts = await this.getAccounts();
    const idx = accounts.findIndex(a => a.email.toLowerCase() === cleanEmail);

    if (idx === -1) {
      return { success: false, error: 'Account not found.' };
    }

    const account = accounts[idx];

    if (!account.otp_code || account.otp_code !== cleanOtp) {
      return { success: false, error: 'Invalid verification code. Please check your email and try again.' };
    }

    if (account.otp_expires_at && new Date(account.otp_expires_at) < new Date()) {
      return { success: false, error: 'This verification code has expired. Please request a new code.' };
    }

    // Validated: update password and clear OTP
    account.password = newPassword;
    account.temp_password = undefined;
    account.must_change_password = false;
    account.otp_code = undefined;
    account.otp_expires_at = undefined;

    accounts[idx] = account;
    await this.saveAccounts(accounts);

    // Update session
    setDeviceSessionItem(GUEST_SESSION_STORAGE_KEY, JSON.stringify(account));

    return { success: true };
  }

  // --- SESSION UTILS ---
  public getActiveSession(): GuestAccount | null {
    try {
      const raw = getDeviceSessionItem(GUEST_SESSION_STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as GuestAccount;
      }
    } catch (e) {}
    return null;
  }

  public logout(): void {
    removeDeviceSessionItem(GUEST_SESSION_STORAGE_KEY);
  }

  // --- SUPER ADMIN MANAGEMENT ---
  public async toggleAccountActive(id: string): Promise<GuestAccount | null> {
    const accounts = await this.getAccounts();
    const idx = accounts.findIndex(a => a.id === id);
    if (idx !== -1) {
      accounts[idx].is_active = !accounts[idx].is_active;
      await this.saveAccounts(accounts);
      return accounts[idx];
    }
    return null;
  }

  public async resetAccountPassword(id: string): Promise<string> {
    const accounts = await this.getAccounts();
    const idx = accounts.findIndex(a => a.id === id);
    if (idx === -1) throw new Error('Account not found');

    const newTemp = generateDynamicTemporaryPassword();

    accounts[idx].password = newTemp;
    accounts[idx].temp_password = newTemp;
    accounts[idx].must_change_password = true;
    await this.saveAccounts(accounts);

    // Dispatch email
    emailService.sendGuestWelcomeCredentialsEmail({
      guestName: accounts[idx].name,
      guestEmail: accounts[idx].email,
      temporaryPassword: newTemp,
      propertyId: accounts[idx].property_id,
      outletId: accounts[idx].outlet_id
    }).catch(console.error);

    return newTemp;
  }
}

export const guestAuth = GuestAuthService.getInstance();
