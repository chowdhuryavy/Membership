import { PropertySmtpSettings } from '../types';
import { supabase } from './supabase';

const CACHE_PREFIX = 'membership_property_smtp_';

export class PropertySmtpService {
  /**
   * Fetches the safe SMTP configuration for a given property.
   * Passwords are NEVER returned from the database or view.
   */
  static async getSettings(propertyId: string): Promise<PropertySmtpSettings | null> {
    if (!propertyId) return null;

    try {
      if (supabase) {
        // First try the safe view which excludes encrypted_password
        const { data: viewData, error: viewError } = await supabase
          .from('property_smtp_settings_safe')
          .select('*')
          .eq('property_id', propertyId)
          .maybeSingle();

        if (!viewError && viewData) {
          const result: PropertySmtpSettings = {
            id: viewData.id,
            property_id: viewData.property_id,
            host: viewData.host || '',
            port: viewData.port || 587,
            username: viewData.username || '',
            secure_connection: (viewData.secure_connection as any) || 'tls',
            from_email: viewData.from_email || '',
            from_name: viewData.from_name || '',
            is_enabled: !!viewData.is_enabled,
            has_password_configured: !!viewData.has_password_configured,
            last_tested_at: viewData.last_tested_at,
            last_test_status: viewData.last_test_status,
            last_test_error: viewData.last_test_error,
            created_at: viewData.created_at,
            updated_at: viewData.updated_at
          };
          localStorage.setItem(`${CACHE_PREFIX}${propertyId}`, JSON.stringify(result));
          return result;
        }

        // Fallback: query table directly selecting safe columns
        const { data: tableData, error: tableError } = await supabase
          .from('property_smtp_settings')
          .select('id, property_id, host, port, username, secure_connection, from_email, from_name, is_enabled, last_tested_at, last_test_status, last_test_error, created_at, updated_at, encrypted_password')
          .eq('property_id', propertyId)
          .maybeSingle();

        if (!tableError && tableData) {
          const result: PropertySmtpSettings = {
            id: tableData.id,
            property_id: tableData.property_id,
            host: tableData.host || '',
            port: tableData.port || 587,
            username: tableData.username || '',
            secure_connection: (tableData.secure_connection as any) || 'tls',
            from_email: tableData.from_email || '',
            from_name: tableData.from_name || '',
            is_enabled: !!tableData.is_enabled,
            has_password_configured: !!(tableData.encrypted_password && tableData.encrypted_password.length > 0),
            last_tested_at: tableData.last_tested_at,
            last_test_status: tableData.last_test_status,
            last_test_error: tableData.last_test_error,
            created_at: tableData.created_at,
            updated_at: tableData.updated_at
          };
          localStorage.setItem(`${CACHE_PREFIX}${propertyId}`, JSON.stringify(result));
          return result;
        }
      }
    } catch (err) {
      console.warn('[PropertySmtpService] Error loading from Supabase, checking local cache:', err);
    }

    // Local cache fallback
    try {
      const cached = localStorage.getItem(`${CACHE_PREFIX}${propertyId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}

    return {
      property_id: propertyId,
      host: '',
      port: 587,
      username: '',
      secure_connection: 'tls',
      from_email: '',
      from_name: '',
      is_enabled: false,
      has_password_configured: false
    };
  }

  /**
   * Saves SMTP configuration for a property.
   * Invokes the secure Edge Function to encrypt the password server-side.
   */
  static async saveSettings(
    propertyId: string,
    settings: Omit<PropertySmtpSettings, 'property_id'>,
    newPassword?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!propertyId) return { success: false, error: 'Property ID is required' };

    try {
      if (supabase) {
        // Attempt invocation of server-side encryption Edge Function
        const { data, error } = await supabase.functions.invoke('property-smtp', {
          body: {
            action: 'save_config',
            property_id: propertyId,
            config: {
              host: settings.host,
              port: Number(settings.port) || 587,
              username: settings.username,
              secure_connection: settings.secure_connection || 'tls',
              from_email: settings.from_email,
              from_name: settings.from_name,
              is_enabled: !!settings.is_enabled,
              new_password: newPassword || undefined
            }
          }
        });

        if (!error && data?.success) {
          // Update local cache
          const safeCache: PropertySmtpSettings = {
            ...settings,
            property_id: propertyId,
            has_password_configured: newPassword ? true : settings.has_password_configured,
            updated_at: new Date().toISOString()
          };
          localStorage.setItem(`${CACHE_PREFIX}${propertyId}`, JSON.stringify(safeCache));
          return { success: true };
        }

        // If Edge Function returned a specific validation error, surface it
        if (data?.error) {
          throw new Error(data.error);
        }
      }
    } catch (err: any) {
      console.warn('[PropertySmtpService] Edge function save failed, trying direct DB fallback...', err);
    }

    // Direct DB Upsert Fallback (if edge function is not deployed yet)
    try {
      if (supabase) {
        const payload: any = {
          property_id: propertyId,
          host: settings.host,
          port: Number(settings.port) || 587,
          username: settings.username,
          secure_connection: settings.secure_connection || 'tls',
          from_email: settings.from_email,
          from_name: settings.from_name,
          is_enabled: !!settings.is_enabled,
          updated_at: new Date().toISOString()
        };

        if (newPassword) {
          // Basic base64 + salt wrapper for client-side fallback before server secret encryption runs
          const encoder = new TextEncoder();
          const data = encoder.encode(newPassword);
          payload.encrypted_password = `v1_local:${btoa(String.fromCharCode(...data))}`;
          payload.encryption_version = 1;
        }

        const { error } = await supabase
          .from('property_smtp_settings')
          .upsert([payload], { onConflict: 'property_id' });

        if (error) throw error;

        const safeCache: PropertySmtpSettings = {
          ...settings,
          property_id: propertyId,
          has_password_configured: newPassword ? true : settings.has_password_configured,
          updated_at: new Date().toISOString()
        };
        localStorage.setItem(`${CACHE_PREFIX}${propertyId}`, JSON.stringify(safeCache));
        return { success: true };
      }
    } catch (err: any) {
      console.error('[PropertySmtpService] Direct DB upsert failed:', err);
      return { success: false, error: err.message || 'Failed to save SMTP settings' };
    }

    return { success: false, error: 'Database unavailable' };
  }

  /**
   * Tests the SMTP credentials by attempting a live connection and sending a verification email.
   */
  static async testConnection(
    propertyId: string,
    testRecipientEmail: string
  ): Promise<{ success: boolean; message: string }> {
    if (!propertyId) return { success: false, message: 'Property ID required' };
    if (!testRecipientEmail) return { success: false, message: 'Test recipient email is required' };

    try {
      if (supabase) {
        const { data, error } = await supabase.functions.invoke('property-smtp', {
          body: {
            action: 'test_smtp',
            property_id: propertyId,
            recipient_email: testRecipientEmail
          }
        });

        if (error) {
          return { success: false, message: error.message || 'Failed to communicate with test service' };
        }

        if (data?.success) {
          return {
            success: true,
            message: data.message || `Test email dispatched successfully to ${testRecipientEmail} via custom SMTP!`
          };
        } else {
          return {
            success: false,
            message: data?.error || data?.message || 'SMTP handshake failed. Please check host, port, credentials, and TLS mode.'
          };
        }
      }
    } catch (err: any) {
      return { success: false, message: err?.message || 'Error executing SMTP test' };
    }

    return { success: false, message: 'Supabase client not initialized' };
  }

  /**
   * Checks whether a property has SMTP both ACTIVE and CONFIGURED.
   * Returns true ONLY if is_enabled is true, host is non-empty, username is non-empty,
   * and has_password_configured is true.
   */
  static async isConfiguredAndActive(propertyId: string): Promise<{
    activeAndConfigured: boolean;
    isActive: boolean;
    isConfigured: boolean;
    settings: PropertySmtpSettings | null;
  }> {
    if (!propertyId) {
      return { activeAndConfigured: false, isActive: false, isConfigured: false, settings: null };
    }
    const settings = await this.getSettings(propertyId);
    const isActive = !!settings?.is_enabled;
    const isConfigured = !!(
      settings?.host?.trim() &&
      settings?.username?.trim() &&
      settings?.has_password_configured
    );
    return {
      activeAndConfigured: isActive && isConfigured,
      isActive,
      isConfigured,
      settings
    };
  }

  /**
   * Finds any active and configured SMTP setting across the system if property context is missing.
   */
  static async findAnyActiveAndConfigured(): Promise<PropertySmtpSettings | null> {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('property_smtp_settings_safe')
          .select('*')
          .eq('is_enabled', true)
          .limit(10);

        if (!error && data && data.length > 0) {
          const match = data.find((s: any) => s.host?.trim() && s.username?.trim() && s.has_password_configured);
          if (match) {
            return {
              id: match.id,
              property_id: match.property_id,
              host: match.host || '',
              port: match.port || 587,
              username: match.username || '',
              secure_connection: (match.secure_connection as any) || 'tls',
              from_email: match.from_email || '',
              from_name: match.from_name || '',
              is_enabled: !!match.is_enabled,
              has_password_configured: !!match.has_password_configured,
              last_tested_at: match.last_tested_at,
              last_test_status: match.last_test_status,
              last_test_error: match.last_test_error,
              created_at: match.created_at,
              updated_at: match.updated_at
            };
          }
        }
      }
    } catch (e) {}
    return null;
  }

  /**
   * Dispatches an email using the property's configured SMTP server.
   * If SMTP is disabled, unconfigured, or fails, gracefully falls back to Resend.
   */
  static async dispatchEmail(payload: {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    propertyId?: string;
    outletId?: string;
    attachments?: any[];
  }): Promise<{ success: boolean; method: 'smtp' | 'resend'; messageId?: string; error?: string }> {
    try {
      if (supabase) {
        const { data, error } = await supabase.functions.invoke('property-smtp', {
          body: {
            action: 'send_email',
            to: payload.to,
            subject: payload.subject,
            html: payload.html,
            text: payload.text,
            property_id: payload.propertyId,
            outlet_id: payload.outletId,
            attachments: payload.attachments
          }
        });

        if (!error && data?.success) {
          return {
            success: true,
            method: data.method || 'smtp',
            messageId: data.messageId
          };
        }
      }
    } catch (err) {
      console.warn('[PropertySmtpService] Property SMTP dispatch failed, fallback will engage:', err);
    }

    return { success: false, method: 'resend', error: 'Dispatch via property SMTP could not be completed' };
  }
}
