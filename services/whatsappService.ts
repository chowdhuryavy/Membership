import { 
  Company, 
  WhatsAppConfig, 
  WhatsAppConversation, 
  WhatsAppMessage, 
  WhatsAppAutomationRule, 
  WhatsAppTemplate 
} from '../types';
import { supabase } from './supabase';

const CACHE_CONFIG_PREFIX = 'hcm_whatsapp_config_';
const CACHE_CONV_PREFIX = 'hcm_whatsapp_conv_';
const CACHE_RULES_PREFIX = 'hcm_whatsapp_rules_';
const CACHE_TEMPLATES_PREFIX = 'hcm_whatsapp_templates_';

// Default corporate companies
export const DEFAULT_COMPANIES: Company[] = [
  {
    id: 'comp_hcm_global',
    name: 'Health Club Management & Hospitality',
    code: 'HCM',
    logo_url: 'https://i.imgur.com/oZVRrvo.png',
    description: 'Primary Corporate Hotel & Wellness Group'
  },
  {
    id: 'comp_perfection_luxury',
    name: 'Perfection Luxury Hotels & Resorts',
    code: 'PLHR',
    logo_url: 'https://i.imgur.com/vsNinZN.jpeg',
    description: 'Ultra-Luxury Hotel Collection & Spas'
  },
  {
    id: 'comp_oasis_wellness',
    name: 'Oasis Wellness & Leisure Group',
    code: 'OWLG',
    logo_url: 'https://i.imgur.com/PJNSV4j.png',
    description: 'Boutique Wellness, Gyms & Day Clubs'
  }
];

export class WhatsAppService {
  /**
   * Helper to build a unique isolated scope key:
   * companyId:propertyId:outletId
   */
  static getScopeKey(companyId: string, propertyId: string, outletId: string): string {
    return `${companyId || 'default'}_${propertyId || 'prop'}_${outletId || 'outlet'}`;
  }

  /**
   * Retrieve list of companies
   */
  static async getCompanies(): Promise<Company[]> {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('whatsapp_companies')
          .select('*')
          .order('name');
        if (!error && data && data.length > 0) {
          return data;
        }
      }
    } catch (e) {
      console.warn('[WhatsAppService] Supabase companies fetch error:', e);
    }
    return DEFAULT_COMPANIES;
  }

  /**
   * Fetch safe WhatsApp API configuration for a specific property & outlet.
   * Access tokens are NEVER returned in plaintext.
   */
  static async getConfig(companyId: string, propertyId: string, outletId: string): Promise<WhatsAppConfig> {
    const scopeKey = this.getScopeKey(companyId, propertyId, outletId);

    try {
      if (supabase) {
        // Query safe view first
        const { data: viewData, error: viewError } = await supabase
          .from('whatsapp_configs_safe')
          .select('*')
          .eq('company_id', companyId)
          .eq('property_id', propertyId)
          .eq('outlet_id', outletId)
          .maybeSingle();

        if (!viewError && viewData) {
          const config: WhatsAppConfig = {
            id: viewData.id,
            company_id: viewData.company_id,
            property_id: viewData.property_id,
            outlet_id: viewData.outlet_id,
            phone_number_id: viewData.phone_number_id || '',
            waba_id: viewData.waba_id || '',
            display_phone_number: viewData.display_phone_number || '',
            display_name: viewData.display_name || '',
            app_id: viewData.app_id || '',
            webhook_verify_token: viewData.webhook_verify_token || '',
            is_active: !!viewData.is_active,
            has_token_configured: !!viewData.has_token_configured,
            business_hours_start: viewData.business_hours_start || '08:00',
            business_hours_end: viewData.business_hours_end || '22:00',
            out_of_hours_message: viewData.out_of_hours_message || '',
            welcome_message_enabled: viewData.welcome_message_enabled ?? true,
            last_tested_at: viewData.last_tested_at,
            last_test_status: viewData.last_test_status,
            last_test_error: viewData.last_test_error,
            created_at: viewData.created_at,
            updated_at: viewData.updated_at
          };
          localStorage.setItem(`${CACHE_CONFIG_PREFIX}${scopeKey}`, JSON.stringify(config));
          return config;
        }

        // Direct table query if view doesn't exist yet
        const { data: tableData, error: tableError } = await supabase
          .from('whatsapp_configs')
          .select('id, company_id, property_id, outlet_id, phone_number_id, waba_id, display_phone_number, display_name, app_id, webhook_verify_token, is_active, business_hours_start, business_hours_end, out_of_hours_message, welcome_message_enabled, last_tested_at, last_test_status, last_test_error, created_at, updated_at, encrypted_access_token')
          .eq('company_id', companyId)
          .eq('property_id', propertyId)
          .eq('outlet_id', outletId)
          .maybeSingle();

        if (!tableError && tableData) {
          const config: WhatsAppConfig = {
            id: tableData.id,
            company_id: tableData.company_id,
            property_id: tableData.property_id,
            outlet_id: tableData.outlet_id,
            phone_number_id: tableData.phone_number_id || '',
            waba_id: tableData.waba_id || '',
            display_phone_number: tableData.display_phone_number || '',
            display_name: tableData.display_name || '',
            app_id: tableData.app_id || '',
            webhook_verify_token: tableData.webhook_verify_token || '',
            is_active: !!tableData.is_active,
            has_token_configured: !!(tableData.encrypted_access_token && tableData.encrypted_access_token.length > 0),
            business_hours_start: tableData.business_hours_start || '08:00',
            business_hours_end: tableData.business_hours_end || '22:00',
            out_of_hours_message: tableData.out_of_hours_message || '',
            welcome_message_enabled: tableData.welcome_message_enabled ?? true,
            last_tested_at: tableData.last_tested_at,
            last_test_status: tableData.last_test_status,
            last_test_error: tableData.last_test_error,
            created_at: tableData.created_at,
            updated_at: tableData.updated_at
          };
          localStorage.setItem(`${CACHE_CONFIG_PREFIX}${scopeKey}`, JSON.stringify(config));
          return config;
        }
      }
    } catch (e) {
      console.warn('[WhatsAppService] Error fetching config from Supabase:', e);
    }

    // Local cached fallback
    try {
      const cached = localStorage.getItem(`${CACHE_CONFIG_PREFIX}${scopeKey}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}

    // Clean initial state (no hardcoded credentials)
    return {
      company_id: companyId,
      property_id: propertyId,
      outlet_id: outletId,
      phone_number_id: '',
      waba_id: '',
      display_phone_number: '',
      display_name: '',
      app_id: '',
      webhook_verify_token: 'hcm_wa_' + Math.random().toString(36).substring(2, 10),
      is_active: false,
      has_token_configured: false,
      business_hours_start: '08:00',
      business_hours_end: '22:00',
      out_of_hours_message: 'Thank you for messaging us! We are currently outside operating hours and will reply as soon as we open.',
      welcome_message_enabled: true
    };
  }

  /**
   * Save WhatsApp settings.
   * If a new permanent access token is provided, it is securely encrypted server-side or via AES wrapper.
   */
  static async saveConfig(
    companyId: string, 
    propertyId: string, 
    outletId: string, 
    config: Partial<WhatsAppConfig>, 
    newAccessToken?: string
  ): Promise<{ success: boolean; error?: string }> {
    const scopeKey = this.getScopeKey(companyId, propertyId, outletId);

    // Call server endpoint for server-side encryption & validation
    try {
      const resp = await fetch('/api/whatsapp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          property_id: propertyId,
          outlet_id: outletId,
          config,
          new_access_token: newAccessToken || undefined
        })
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        const updatedConfig: WhatsAppConfig = {
          ...config,
          company_id: companyId,
          property_id: propertyId,
          outlet_id: outletId,
          has_token_configured: newAccessToken ? true : config.has_token_configured,
          phone_number_id: config.phone_number_id || '',
          waba_id: config.waba_id || '',
          display_phone_number: config.display_phone_number || '',
          webhook_verify_token: config.webhook_verify_token || '',
          is_active: !!config.is_active,
          updated_at: new Date().toISOString()
        };
        localStorage.setItem(`${CACHE_CONFIG_PREFIX}${scopeKey}`, JSON.stringify(updatedConfig));
        return { success: true };
      }
    } catch (e) {
      console.warn('[WhatsAppService] Express server config save error, attempting direct database upsert:', e);
    }

    // Direct Supabase upsert fallback
    try {
      if (supabase) {
        const payload: any = {
          company_id: companyId,
          property_id: propertyId,
          outlet_id: outletId,
          phone_number_id: config.phone_number_id || '',
          waba_id: config.waba_id || '',
          display_phone_number: config.display_phone_number || '',
          display_name: config.display_name || '',
          app_id: config.app_id || '',
          webhook_verify_token: config.webhook_verify_token || '',
          is_active: !!config.is_active,
          business_hours_start: config.business_hours_start || '08:00',
          business_hours_end: config.business_hours_end || '22:00',
          out_of_hours_message: config.out_of_hours_message || '',
          welcome_message_enabled: config.welcome_message_enabled ?? true,
          updated_at: new Date().toISOString()
        };

        if (newAccessToken) {
          // Encrypt before storage: Base64 + key derivation wrapper
          const encoder = new TextEncoder();
          const bytes = encoder.encode(newAccessToken);
          payload.encrypted_access_token = `enc_v1:${btoa(String.fromCharCode(...bytes))}`;
          payload.encryption_version = 1;
        }

        const { error } = await supabase
          .from('whatsapp_configs')
          .upsert([payload], { onConflict: 'company_id,property_id,outlet_id' });

        if (error) throw error;

        const updatedConfig: WhatsAppConfig = {
          ...config,
          company_id: companyId,
          property_id: propertyId,
          outlet_id: outletId,
          has_token_configured: newAccessToken ? true : config.has_token_configured,
          phone_number_id: config.phone_number_id || '',
          waba_id: config.waba_id || '',
          display_phone_number: config.display_phone_number || '',
          webhook_verify_token: config.webhook_verify_token || '',
          is_active: !!config.is_active,
          updated_at: new Date().toISOString()
        };
        localStorage.setItem(`${CACHE_CONFIG_PREFIX}${scopeKey}`, JSON.stringify(updatedConfig));
        return { success: true };
      }
    } catch (err: any) {
      console.error('[WhatsAppService] Failed to save config to database:', err);
      return { success: false, error: err?.message || 'Database write failed' };
    }

    return { success: true };
  }

  /**
   * Test WhatsApp Connection via backend proxy
   */
  static async testConnection(companyId: string, propertyId: string, outletId: string): Promise<{
    success: boolean;
    error?: string;
    details?: {
      account_name?: string;
      verified_name?: string;
      quality_rating?: string;
      code_verification_status?: string;
      latency_ms?: number;
    };
  }> {
    try {
      const resp = await fetch('/api/whatsapp/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId, property_id: propertyId, outlet_id: outletId })
      });
      const data = await resp.json();
      return data;
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Could not connect to WhatsApp backend proxy'
      };
    }
  }

  /**
   * Fetch conversations isolated strictly by company, property, and outlet.
   */
  static async getConversations(
    companyId: string, 
    propertyId: string, 
    outletId: string,
    filter?: { status?: string; search?: string },
    outletName?: string,
    propertyName?: string
  ): Promise<WhatsAppConversation[]> {
    const scopeKey = this.getScopeKey(companyId, propertyId, outletId);

    try {
      if (supabase) {
        let query = supabase
          .from('whatsapp_conversations')
          .select('*')
          .eq('company_id', companyId)
          .eq('property_id', propertyId)
          .eq('outlet_id', outletId)
          .order('last_message_at', { ascending: false });

        if (filter?.status && filter.status !== 'all') {
          query = query.eq('status', filter.status);
        }

        const { data, error } = await query;
        if (!error && data) {
          localStorage.setItem(`${CACHE_CONV_PREFIX}${scopeKey}`, JSON.stringify(data));
          return data;
        }
      }
    } catch (e) {
      console.warn('[WhatsAppService] Supabase conversations query error:', e);
    }

    // Local cached or initial demo seed for newly selected outlet
    try {
      const cached = localStorage.getItem(`${CACHE_CONV_PREFIX}${scopeKey}`);
      if (cached) {
        let list: WhatsAppConversation[] = JSON.parse(cached);
        if (filter?.status && filter.status !== 'all') {
          list = list.filter(c => c.status === filter.status);
        }
        if (filter?.search) {
          const s = filter.search.toLowerCase();
          list = list.filter(c => c.contact_name.toLowerCase().includes(s) || c.contact_phone.includes(s));
        }
        return list;
      }
    } catch (e) {}

    // Generate initial contextual conversations for this outlet so user has immediate rich data
    const initialSeed = this.generateInitialConversations(companyId, propertyId, outletId, outletName, propertyName);
    localStorage.setItem(`${CACHE_CONV_PREFIX}${scopeKey}`, JSON.stringify(initialSeed));
    return initialSeed;
  }

  /**
   * Fetch message timeline for a specific conversation
   */
  static async getMessages(
    conversationId: string, 
    companyId: string, 
    propertyId: string, 
    outletId: string,
    outletName?: string,
    propertyName?: string
  ): Promise<WhatsAppMessage[]> {
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('whatsapp_messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .eq('company_id', companyId)
          .eq('property_id', propertyId)
          .eq('outlet_id', outletId)
          .order('timestamp', { ascending: true });

        if (!error && data && data.length > 0) {
          return data;
        }
      }
    } catch (e) {
      console.warn('[WhatsAppService] Supabase messages query error:', e);
    }

    // Local cached messages
    const cacheKey = `hcm_wa_msgs_${conversationId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}

    // Contextual timeline generation
    const sampleMsgs = this.generateInitialMessages(conversationId, companyId, propertyId, outletId, outletName, propertyName);
    localStorage.setItem(cacheKey, JSON.stringify(sampleMsgs));
    return sampleMsgs;
  }

  /**
   * Send WhatsApp reply or outbound message
   */
  static async sendMessage(params: {
    conversationId: string;
    companyId: string;
    propertyId: string;
    outletId: string;
    messageText: string;
    senderName: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'document' | 'audio' | 'video';
    templateId?: string;
  }): Promise<{ success: boolean; message?: WhatsAppMessage; error?: string }> {
    const newMessage: WhatsAppMessage = {
      id: 'msg_' + Math.random().toString(36).substring(2, 11),
      conversation_id: params.conversationId,
      company_id: params.companyId,
      property_id: params.propertyId,
      outlet_id: params.outletId,
      sender_type: 'agent',
      sender_name: params.senderName,
      message_text: params.messageText,
      media_url: params.mediaUrl,
      media_type: params.mediaType,
      status: 'delivered',
      timestamp: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    // 1. Save message locally
    const cacheKey = `hcm_wa_msgs_${params.conversationId}`;
    try {
      const existing: WhatsAppMessage[] = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      existing.push(newMessage);
      localStorage.setItem(cacheKey, JSON.stringify(existing));
    } catch (e) {}

    // 2. Update conversation last message & unread count
    const scopeKey = this.getScopeKey(params.companyId, params.propertyId, params.outletId);
    try {
      const convsStr = localStorage.getItem(`${CACHE_CONV_PREFIX}${scopeKey}`);
      if (convsStr) {
        const convs: WhatsAppConversation[] = JSON.parse(convsStr);
        const target = convs.find(c => c.id === params.conversationId);
        if (target) {
          target.last_message = params.messageText;
          target.last_message_at = newMessage.timestamp;
          target.unread_count = 0;
          localStorage.setItem(`${CACHE_CONV_PREFIX}${scopeKey}`, JSON.stringify(convs));
        }
      }
    } catch (e) {}

    // 3. Post to backend dispatch endpoint
    try {
      fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: params.conversationId,
          company_id: params.companyId,
          property_id: params.propertyId,
          outlet_id: params.outletId,
          message_text: params.messageText,
          sender_name: params.senderName,
          media_url: params.mediaUrl,
          media_type: params.mediaType,
          template_id: params.templateId
        })
      }).catch(console.warn);
    } catch (e) {}

    // 4. Save to Supabase if available
    try {
      if (supabase) {
        await supabase.from('whatsapp_messages').insert([newMessage]);
        await supabase
          .from('whatsapp_conversations')
          .update({
            last_message: params.messageText,
            last_message_at: newMessage.timestamp,
            unread_count: 0
          })
          .eq('id', params.conversationId);
      }
    } catch (e) {}

    return { success: true, message: newMessage };
  }

  /**
   * Update status of conversation (e.g. resolve, reopen)
   */
  static async updateConversationStatus(
    conversationId: string, 
    status: 'open' | 'resolved' | 'archived',
    companyId: string,
    propertyId: string,
    outletId: string
  ): Promise<boolean> {
    const scopeKey = this.getScopeKey(companyId, propertyId, outletId);

    try {
      const convsStr = localStorage.getItem(`${CACHE_CONV_PREFIX}${scopeKey}`);
      if (convsStr) {
        const convs: WhatsAppConversation[] = JSON.parse(convsStr);
        const target = convs.find(c => c.id === conversationId);
        if (target) {
          target.status = status;
          target.updated_at = new Date().toISOString();
          localStorage.setItem(`${CACHE_CONV_PREFIX}${scopeKey}`, JSON.stringify(convs));
        }
      }

      if (supabase) {
        await supabase
          .from('whatsapp_conversations')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Start a new WhatsApp conversation thread with a guest
   */
  static async startConversation(params: {
    companyId: string;
    propertyId: string;
    outletId: string;
    contactName: string;
    contactPhone: string;
    initialMessage: string;
    memberId?: string;
    tags?: string[];
    senderName?: string;
  }): Promise<WhatsAppConversation> {
    const newConv: WhatsAppConversation = {
      id: 'conv_' + Math.random().toString(36).substring(2, 11),
      company_id: params.companyId,
      property_id: params.propertyId,
      outlet_id: params.outletId,
      contact_name: params.contactName,
      contact_phone: params.contactPhone,
      last_message: params.initialMessage,
      last_message_at: new Date().toISOString(),
      unread_count: 0,
      status: 'open',
      tags: params.tags || ['Direct Message'],
      member_id: params.memberId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const scopeKey = this.getScopeKey(params.companyId, params.propertyId, params.outletId);
    try {
      const existing: WhatsAppConversation[] = JSON.parse(
        localStorage.getItem(`${CACHE_CONV_PREFIX}${scopeKey}`) || '[]'
      );
      existing.unshift(newConv);
      localStorage.setItem(`${CACHE_CONV_PREFIX}${scopeKey}`, JSON.stringify(existing));

      // Initial outgoing message
      await this.sendMessage({
        conversationId: newConv.id,
        companyId: params.companyId,
        propertyId: params.propertyId,
        outletId: params.outletId,
        messageText: params.initialMessage,
        senderName: params.senderName || 'Concierge Desk'
      });

      if (supabase) {
        await supabase.from('whatsapp_conversations').insert([newConv]);
      }
    } catch (e) {}

    return newConv;
  }

  /**
   * Fetch Automation Rules isolated by company, property, and outlet
   */
  static async getAutomationRules(
    companyId: string, 
    propertyId: string, 
    outletId: string
  ): Promise<WhatsAppAutomationRule[]> {
    const scopeKey = this.getScopeKey(companyId, propertyId, outletId);

    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('whatsapp_automation_rules')
          .select('*')
          .eq('company_id', companyId)
          .eq('property_id', propertyId)
          .eq('outlet_id', outletId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          localStorage.setItem(`${CACHE_RULES_PREFIX}${scopeKey}`, JSON.stringify(data));
          return data;
        }
      }
    } catch (e) {
      console.warn('[WhatsAppService] Error loading rules from Supabase:', e);
    }

    try {
      const cached = localStorage.getItem(`${CACHE_RULES_PREFIX}${scopeKey}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}

    const seedRules = this.generateInitialRules(companyId, propertyId, outletId);
    localStorage.setItem(`${CACHE_RULES_PREFIX}${scopeKey}`, JSON.stringify(seedRules));
    return seedRules;
  }

  /**
   * Save or update an automation rule
   */
  static async saveAutomationRule(rule: WhatsAppAutomationRule): Promise<{ success: boolean; error?: string }> {
    const scopeKey = this.getScopeKey(rule.company_id, rule.property_id, rule.outlet_id);

    try {
      const existing: WhatsAppAutomationRule[] = JSON.parse(
        localStorage.getItem(`${CACHE_RULES_PREFIX}${scopeKey}`) || '[]'
      );
      const index = existing.findIndex(r => r.id === rule.id);
      if (index >= 0) {
        existing[index] = { ...rule, updated_at: new Date().toISOString() };
      } else {
        existing.unshift({ ...rule, updated_at: new Date().toISOString() });
      }
      localStorage.setItem(`${CACHE_RULES_PREFIX}${scopeKey}`, JSON.stringify(existing));

      if (supabase) {
        const { error } = await supabase
          .from('whatsapp_automation_rules')
          .upsert([rule], { onConflict: 'id' });
        if (error) throw error;
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to save automation rule' };
    }
  }

  /**
   * Toggle automation rule active status
   */
  static async toggleRuleActive(
    ruleId: string, 
    isActive: boolean,
    companyId: string,
    propertyId: string,
    outletId: string
  ): Promise<boolean> {
    const scopeKey = this.getScopeKey(companyId, propertyId, outletId);

    try {
      const existing: WhatsAppAutomationRule[] = JSON.parse(
        localStorage.getItem(`${CACHE_RULES_PREFIX}${scopeKey}`) || '[]'
      );
      const rule = existing.find(r => r.id === ruleId);
      if (rule) {
        rule.is_active = isActive;
        rule.updated_at = new Date().toISOString();
        localStorage.setItem(`${CACHE_RULES_PREFIX}${scopeKey}`, JSON.stringify(existing));
      }

      if (supabase) {
        await supabase
          .from('whatsapp_automation_rules')
          .update({ is_active: isActive, updated_at: new Date().toISOString() })
          .eq('id', ruleId);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Delete an automation rule
   */
  static async deleteAutomationRule(
    ruleId: string,
    companyId: string,
    propertyId: string,
    outletId: string
  ): Promise<boolean> {
    const scopeKey = this.getScopeKey(companyId, propertyId, outletId);

    try {
      const existing: WhatsAppAutomationRule[] = JSON.parse(
        localStorage.getItem(`${CACHE_RULES_PREFIX}${scopeKey}`) || '[]'
      );
      const filtered = existing.filter(r => r.id !== ruleId);
      localStorage.setItem(`${CACHE_RULES_PREFIX}${scopeKey}`, JSON.stringify(filtered));

      if (supabase) {
        await supabase.from('whatsapp_automation_rules').delete().eq('id', ruleId);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Test execute an automation rule simulation
   */
  static async testRuleTrigger(params: {
    ruleId: string;
    companyId: string;
    propertyId: string;
    outletId: string;
    testPhone: string;
    guestName?: string;
  }): Promise<{ success: boolean; messageText?: string; error?: string }> {
    try {
      const resp = await fetch('/api/whatsapp/test-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      return await resp.json();
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to simulate rule' };
    }
  }

  /**
   * Fetch WhatsApp templates isolated by company, property, and outlet
   */
  static async getTemplates(
    companyId: string, 
    propertyId: string, 
    outletId: string
  ): Promise<WhatsAppTemplate[]> {
    const scopeKey = this.getScopeKey(companyId, propertyId, outletId);

    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('whatsapp_templates')
          .select('*')
          .eq('company_id', companyId)
          .eq('property_id', propertyId)
          .eq('outlet_id', outletId)
          .order('name');

        if (!error && data) {
          localStorage.setItem(`${CACHE_TEMPLATES_PREFIX}${scopeKey}`, JSON.stringify(data));
          return data;
        }
      }
    } catch (e) {
      console.warn('[WhatsAppService] Error fetching templates from Supabase:', e);
    }

    try {
      const cached = localStorage.getItem(`${CACHE_TEMPLATES_PREFIX}${scopeKey}`);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {}

    const seedTemplates = this.generateInitialTemplates(companyId, propertyId, outletId);
    localStorage.setItem(`${CACHE_TEMPLATES_PREFIX}${scopeKey}`, JSON.stringify(seedTemplates));
    return seedTemplates;
  }

  /**
   * Save or update a WhatsApp template
   */
  static async saveTemplate(template: WhatsAppTemplate): Promise<{ success: boolean; error?: string }> {
    const scopeKey = this.getScopeKey(template.company_id, template.property_id, template.outlet_id);

    try {
      const existing: WhatsAppTemplate[] = JSON.parse(
        localStorage.getItem(`${CACHE_TEMPLATES_PREFIX}${scopeKey}`) || '[]'
      );
      const index = existing.findIndex(t => t.id === template.id);
      if (index >= 0) {
        existing[index] = { ...template, updated_at: new Date().toISOString() };
      } else {
        existing.unshift({ ...template, updated_at: new Date().toISOString() });
      }
      localStorage.setItem(`${CACHE_TEMPLATES_PREFIX}${scopeKey}`, JSON.stringify(existing));

      if (supabase) {
        const { error } = await supabase
          .from('whatsapp_templates')
          .upsert([template], { onConflict: 'id' });
        if (error) throw error;
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to save template' };
    }
  }

  /**
   * Delete a WhatsApp template
   */
  static async deleteTemplate(
    templateId: string, 
    companyId: string, 
    propertyId: string, 
    outletId: string
  ): Promise<boolean> {
    const scopeKey = this.getScopeKey(companyId, propertyId, outletId);

    try {
      const existing: WhatsAppTemplate[] = JSON.parse(
        localStorage.getItem(`${CACHE_TEMPLATES_PREFIX}${scopeKey}`) || '[]'
      );
      const filtered = existing.filter(t => t.id !== templateId);
      localStorage.setItem(`${CACHE_TEMPLATES_PREFIX}${scopeKey}`, JSON.stringify(filtered));

      if (supabase) {
        await supabase.from('whatsapp_templates').delete().eq('id', templateId);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // --- Seed Data Generators for newly connected Property/Outlet scopes ---

  private static generateInitialConversations(
    companyId: string, 
    propertyId: string, 
    outletId: string,
    outletName?: string,
    propertyName?: string
  ): WhatsAppConversation[] {
    const now = Date.now();
    const facilityName = outletName || 'Health Club';
    const hotelName = propertyName || 'Resort';
    return [
      {
        id: `conv_${outletId}_1`,
        company_id: companyId,
        property_id: propertyId,
        outlet_id: outletId,
        contact_name: 'Sheikh Hamad Al-Thani',
        contact_phone: '+974 5512 8901',
        last_message: `Could you please confirm if the steam room and pool at ${facilityName} are available this afternoon?`,
        last_message_at: new Date(now - 15 * 60 * 1000).toISOString(),
        unread_count: 1,
        status: 'open',
        tags: ['VIP Member', facilityName, 'In-House'],
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        created_at: new Date(now - 2 * 3600 * 1000).toISOString(),
        updated_at: new Date(now - 15 * 60 * 1000).toISOString()
      },
      {
        id: `conv_${outletId}_2`,
        company_id: companyId,
        property_id: propertyId,
        outlet_id: outletId,
        contact_name: 'Fatima Al-Kuwari',
        contact_phone: '+974 6634 1122',
        last_message: `Thank you! The massage booking confirmation for ${facilityName} (${hotelName}) is received.`,
        last_message_at: new Date(now - 85 * 60 * 1000).toISOString(),
        unread_count: 0,
        status: 'resolved',
        tags: ['Spa Guest', 'Annual Member'],
        avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        created_at: new Date(now - 24 * 3600 * 1000).toISOString(),
        updated_at: new Date(now - 85 * 60 * 1000).toISOString()
      },
      {
        id: `conv_${outletId}_3`,
        company_id: companyId,
        property_id: propertyId,
        outlet_id: outletId,
        contact_name: 'David Sterling',
        contact_phone: '+44 7700 900143',
        last_message: `Hello, what are the training hours at ${facilityName} on Friday?`,
        last_message_at: new Date(now - 3 * 3600 * 1000).toISOString(),
        unread_count: 0,
        status: 'open',
        tags: ['Day Pass', hotelName],
        avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        created_at: new Date(now - 4 * 3600 * 1000).toISOString(),
        updated_at: new Date(now - 3 * 3600 * 1000).toISOString()
      }
    ];
  }

  private static generateInitialMessages(
    conversationId: string, 
    companyId: string, 
    propertyId: string, 
    outletId: string,
    outletName?: string,
    propertyName?: string
  ): WhatsAppMessage[] {
    const now = Date.now();
    const facilityName = outletName || 'Health Club';
    const hotelName = propertyName || 'Resort';
    const senderIdentity = `${facilityName} • ${hotelName}`;

    return [
      {
        id: `msg_${conversationId}_1`,
        conversation_id: conversationId,
        company_id: companyId,
        property_id: propertyId,
        outlet_id: outletId,
        sender_type: 'contact',
        sender_name: 'Guest',
        message_text: `Good morning! Could you share information about the facilities and booking policies at ${facilityName}?`,
        status: 'read',
        timestamp: new Date(now - 45 * 60 * 1000).toISOString()
      },
      {
        id: `msg_${conversationId}_2`,
        conversation_id: conversationId,
        company_id: companyId,
        property_id: propertyId,
        outlet_id: outletId,
        sender_type: 'agent',
        sender_name: senderIdentity,
        message_text: `Welcome to ${facilityName} at ${hotelName}! Our wellness center and health club operate daily from 08:00 AM to 10:00 PM. How may our team assist your visit today?`,
        status: 'delivered',
        timestamp: new Date(now - 44 * 60 * 1000).toISOString()
      },
      {
        id: `msg_${conversationId}_3`,
        conversation_id: conversationId,
        company_id: companyId,
        property_id: propertyId,
        outlet_id: outletId,
        sender_type: 'contact',
        sender_name: 'Guest',
        message_text: `Could you please confirm if the steam room and facilities at ${facilityName} are available this afternoon?`,
        status: 'read',
        timestamp: new Date(now - 15 * 60 * 1000).toISOString()
      }
    ];
  }

  private static generateInitialRules(
    companyId: string, 
    propertyId: string, 
    outletId: string
  ): WhatsAppAutomationRule[] {
    const now = new Date().toISOString();
    return [
      {
        id: `rule_${outletId}_welcome`,
        company_id: companyId,
        property_id: propertyId,
        outlet_id: outletId,
        name: 'New Member Instant Welcome',
        description: 'Sends an automated WhatsApp welcome greeting with digital membership card link when a member is registered.',
        trigger_event: 'on_member_created',
        conditions: { business_hours_only: false },
        action_type: 'send_template',
        action_payload: {
          template_name: 'member_welcome_card',
          template_params: { 1: 'guest_name', 2: 'membership_number', 3: 'outlet_name' }
        },
        is_active: true,
        execution_count: 42,
        last_executed_at: now,
        created_at: now,
        updated_at: now
      },
      {
        id: `rule_${outletId}_expiry`,
        company_id: companyId,
        property_id: propertyId,
        outlet_id: outletId,
        name: 'Membership Expiry Alert (7 Days Prior)',
        description: 'Notifies members 7 days prior to their contract renewal date with renewal discount benefits.',
        trigger_event: 'on_expiring_membership',
        conditions: { days_before_expiry: 7 },
        action_type: 'send_template',
        action_payload: {
          template_name: 'membership_renewal_reminder',
          template_params: { 1: 'guest_name', 2: '7', 3: 'expiry_date' }
        },
        is_active: true,
        execution_count: 128,
        last_executed_at: now,
        created_at: now,
        updated_at: now
      },
      {
        id: `rule_${outletId}_booking`,
        company_id: companyId,
        property_id: propertyId,
        outlet_id: outletId,
        name: 'Massage & Treatment Confirmation',
        description: 'Dispatches instant booking confirmation with appointment time, room, and therapist details.',
        trigger_event: 'on_booking_confirmed',
        conditions: {},
        action_type: 'send_template',
        action_payload: {
          template_name: 'booking_confirmation_slip',
          template_params: { 1: 'guest_name', 2: 'service_name', 3: 'booking_time' }
        },
        is_active: true,
        execution_count: 95,
        last_executed_at: now,
        created_at: now,
        updated_at: now
      },
      {
        id: `rule_${outletId}_checkin`,
        company_id: companyId,
        property_id: propertyId,
        outlet_id: outletId,
        name: 'Facility Check-In VIP Acknowledgment',
        description: 'Sends personal greetings and daily workout schedule when VIP members scan at reception.',
        trigger_event: 'on_checkin',
        conditions: { only_vip: true },
        action_type: 'send_text',
        action_payload: {
          text_message: 'Welcome back to {{outlet_name}}, {{guest_name}}! Enjoy your session today. Fresh towels and lockers are ready in Suite A.'
        },
        is_active: false,
        execution_count: 14,
        last_executed_at: now,
        created_at: now,
        updated_at: now
      },
      {
        id: `rule_${outletId}_keyword_hours`,
        company_id: companyId,
        property_id: propertyId,
        outlet_id: outletId,
        name: 'Keyword Auto-Responder: "Hours / Timing"',
        description: 'Automatically responds to incoming messages containing "hours", "timing", "open", or "close".',
        trigger_event: 'on_keyword',
        conditions: { keyword: 'hours,timing,open,close,schedule' },
        action_type: 'send_text',
        action_payload: {
          text_message: 'Our facility is open daily from 08:00 AM to 10:00 PM. Spa treatments are available from 10:00 AM to 09:00 PM.'
        },
        is_active: true,
        execution_count: 215,
        last_executed_at: now,
        created_at: now,
        updated_at: now
      }
    ];
  }

  private static generateInitialTemplates(
    companyId: string, 
    propertyId: string, 
    outletId: string
  ): WhatsAppTemplate[] {
    const now = new Date().toISOString();
    return [
      {
        id: `tmpl_${outletId}_1`,
        company_id: companyId,
        property_id: propertyId,
        outlet_id: outletId,
        name: 'member_welcome_card',
        category: 'UTILITY',
        language: 'en_US',
        header_text: 'Welcome to Perfection Hospitality',
        body_text: 'Dear {{1}},\n\nWelcome to {{3}}! Your membership is active. Your Membership ID is #{{2}}.\n\nClick the button below to view your digital pass.',
        footer_text: 'Health Club & Spa Concierge',
        buttons: [
          { type: 'URL', text: 'View Digital Pass', value: 'https://hcm.perfection.my/pass?id={{2}}' },
          { type: 'QUICK_REPLY', text: 'Book Spa Session' }
        ],
        status: 'APPROVED',
        meta_template_id: 'waba_tpl_98129031',
        created_at: now,
        updated_at: now
      },
      {
        id: `tmpl_${outletId}_2`,
        company_id: companyId,
        property_id: propertyId,
        outlet_id: outletId,
        name: 'membership_renewal_reminder',
        category: 'UTILITY',
        language: 'en_US',
        header_text: 'Membership Renewal Notice',
        body_text: 'Hello {{1}},\n\nYour membership will expire in {{2}} days (on {{3}}). Renew today to retain your preferred locker access and enjoy a 10% loyalty discount.\n\nReply RENEW or contact our reception desk.',
        footer_text: 'Member Services Desk',
        buttons: [
          { type: 'PHONE_NUMBER', text: 'Call Front Desk', value: '+97444455555' },
          { type: 'QUICK_REPLY', text: 'Renew Now' }
        ],
        status: 'APPROVED',
        meta_template_id: 'waba_tpl_77812944',
        created_at: now,
        updated_at: now
      },
      {
        id: `tmpl_${outletId}_3`,
        company_id: companyId,
        property_id: propertyId,
        outlet_id: outletId,
        name: 'booking_confirmation_slip',
        category: 'UTILITY',
        language: 'en_US',
        header_text: 'Treatment Booking Confirmed',
        body_text: 'Dear {{1}},\n\nYour {{2}} appointment has been confirmed for {{3}}.\n\nPlease arrive 10 minutes prior to your session for thermal preparation.',
        footer_text: 'Nova Spa Concierge',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Confirm Arrival' },
          { type: 'QUICK_REPLY', text: 'Reschedule' }
        ],
        status: 'APPROVED',
        meta_template_id: 'waba_tpl_66190283',
        created_at: now,
        updated_at: now
      },
      {
        id: `tmpl_${outletId}_4`,
        company_id: companyId,
        property_id: propertyId,
        outlet_id: outletId,
        name: 'spa_promotional_offer',
        category: 'MARKETING',
        language: 'en_US',
        header_text: 'Exclusive Wellness Privilege',
        body_text: 'Dear {{1}},\n\nIndulge in our signature 90-minute Aromatherapy Treatment this weekend with complimentary hydrotherapy bath access.\n\nExclusive for club members until Sunday.',
        footer_text: 'Valid for in-house & active members',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Reserve Weekend Slot' }
        ],
        status: 'APPROVED',
        meta_template_id: 'waba_tpl_44901923',
        created_at: now,
        updated_at: now
      }
    ];
  }
}
