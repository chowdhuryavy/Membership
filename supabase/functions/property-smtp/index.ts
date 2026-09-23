import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.13";
import { Resend } from "npm:resend@3.1.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

// ---------------------------------------------------------------------------
// Cryptographic Helpers (AES-256-GCM via Web Crypto API)
// ---------------------------------------------------------------------------
async function getCryptoKey(): Promise<CryptoKey> {
  // Use explicit SMTP_ENCRYPTION_KEY if set, otherwise derive a secure key from SUPABASE_SERVICE_ROLE_KEY
  const rawSecret = Deno.env.get('SMTP_ENCRYPTION_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 'fallback-system-secret-key-32b-min!';
  const encoder = new TextEncoder();
  const secretBytes = encoder.encode(rawSecret);
  
  // Hash the secret to ensure it is exactly 32 bytes (256 bits)
  const hashBuffer = await crypto.subtle.digest('SHA-256', secretBytes);
  return await crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptPassword(plainText: string): Promise<string> {
  if (!plainText) return '';
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const data = encoder.encode(plainText);
  
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
  const cipherHex = Array.from(new Uint8Array(encryptedBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `v1:${ivHex}:${cipherHex}`;
}

async function decryptPassword(encryptedPayload: string): Promise<string> {
  if (!encryptedPayload) return '';
  
  // Local fallback format support (v1_local:base64)
  if (encryptedPayload.startsWith('v1_local:')) {
    try {
      const b64 = encryptedPayload.replace('v1_local:', '');
      return atob(b64);
    } catch (e) {
      return '';
    }
  }

  // Standard format: v1:iv_hex:cipher_hex
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3 || parts[0] !== 'v1') {
    throw new Error('Invalid encrypted payload format');
  }

  const ivHex = parts[1];
  const cipherHex = parts[2];
  
  const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const cipherBytes = new Uint8Array(cipherHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const key = await getCryptoKey();
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    cipherBytes
  );
  
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

// ---------------------------------------------------------------------------
// Main Service Router
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // -----------------------------------------------------------------------
    // ACTION: SAVE SMTP CONFIGURATION
    // -----------------------------------------------------------------------
    if (action === 'save_config') {
      const { property_id, config } = body;
      if (!property_id) {
        return new Response(JSON.stringify({ success: false, error: 'Property ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Fetch existing record to preserve encrypted_password if not changing
      const { data: existing } = await supabaseAdmin
        .from('property_smtp_settings')
        .select('*')
        .eq('property_id', property_id)
        .maybeSingle();

      let encryptedPass = existing?.encrypted_password || '';
      if (config.new_password && config.new_password.trim().length > 0) {
        encryptedPass = await encryptPassword(config.new_password.trim());
      }

      const upsertPayload: any = {
        property_id,
        host: (config.host || '').trim(),
        port: Number(config.port) || 587,
        username: (config.username || '').trim(),
        encrypted_password: encryptedPass,
        encryption_version: 1,
        secure_connection: config.secure_connection || 'tls',
        from_email: (config.from_email || '').trim(),
        from_name: (config.from_name || '').trim(),
        is_enabled: !!config.is_enabled,
        updated_at: new Date().toISOString()
      };

      const { error: upsertError } = await supabaseAdmin
        .from('property_smtp_settings')
        .upsert([upsertPayload], { onConflict: 'property_id' });

      if (upsertError) {
        console.error('[PropertySMTP] Error saving config:', upsertError);
        return new Response(JSON.stringify({ success: false, error: upsertError.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // -----------------------------------------------------------------------
    // ACTION: TEST SMTP CONNECTION
    // -----------------------------------------------------------------------
    if (action === 'test_smtp') {
      const { property_id, recipient_email } = body;
      if (!property_id || !recipient_email) {
        return new Response(JSON.stringify({ success: false, error: 'Property ID and recipient email are required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: config, error: fetchError } = await supabaseAdmin
        .from('property_smtp_settings')
        .select('*, properties(name)')
        .eq('property_id', property_id)
        .single();

      if (fetchError || !config) {
        return new Response(JSON.stringify({ success: false, error: 'SMTP settings not found for this property' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let password = '';
      try {
        password = await decryptPassword(config.encrypted_password);
      } catch (decErr: any) {
        return new Response(JSON.stringify({ success: false, error: 'Failed to decrypt password: ' + decErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const propertyName = (config as any).properties?.name || 'Authorized Property';
      const isSsl = config.secure_connection === 'ssl' || config.port === 465;

      const transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: isSsl,
        auth: {
          user: config.username,
          pass: password,
        },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 10000,
      });

      try {
        // Verify handshake first
        await transporter.verify();

        // Send real verification email
        const sender = `"${config.from_name || propertyName}" <${config.from_email || config.username}>`;
        await transporter.sendMail({
          from: sender,
          to: recipient_email,
          subject: `[Verified] SMTP Dispatch Test • ${propertyName}`,
          text: `Congratulations!\n\nYour custom SMTP relay for ${propertyName} has been successfully verified.\nHost: ${config.host}\nPort: ${config.port}\nUsername: ${config.username}\nSecurity: ${config.secure_connection.toUpperCase()}\n\nAll operational messages for this property will now be delivered via your dedicated server.`,
          html: `
            <div style="font-family: sans-serif; padding: 24px; color: #1e293b; max-width: 550px; margin: 0 auto; border: 1px solid #e2e8f0; rounded: 16px;">
              <h2 style="color: #4f46e5; margin-top: 0;">SMTP Dispatch Verified</h2>
              <p>Your property-level outbound mail relay for <strong>${propertyName}</strong> is operational.</p>
              <table style="width: 100%; font-size: 13px; margin: 16px 0; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; color: #64748b;">Host:</td><td style="font-weight: bold;">${config.host}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Port:</td><td style="font-weight: bold;">${config.port}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Username:</td><td style="font-weight: bold;">${config.username}</td></tr>
                <tr><td style="padding: 6px 0; color: #64748b;">Security:</td><td style="font-weight: bold;">${config.secure_connection.toUpperCase()}</td></tr>
              </table>
              <p style="font-size: 11px; color: #94a3b8; margin-top: 24px;">Generated automatically by Health Club Management System.</p>
            </div>
          `
        });

        // Update database with success timestamp
        await supabaseAdmin
          .from('property_smtp_settings')
          .update({
            last_tested_at: new Date().toISOString(),
            last_test_status: 'success',
            last_test_error: null
          })
          .eq('property_id', property_id);

        return new Response(JSON.stringify({ 
          success: true, 
          message: `Connected successfully! A verification email was sent to ${recipient_email}.` 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (smtpErr: any) {
        console.error('[PropertySMTP] Test failed:', smtpErr);

        // Record failure in database
        await supabaseAdmin
          .from('property_smtp_settings')
          .update({
            last_tested_at: new Date().toISOString(),
            last_test_status: 'failed',
            last_test_error: smtpErr.message || 'SMTP Handshake error'
          })
          .eq('property_id', property_id);

        return new Response(JSON.stringify({ 
          success: false, 
          error: smtpErr.message || 'SMTP connection failed. Check host, port, credentials, or TLS settings.' 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // -----------------------------------------------------------------------
    // ACTION: UNIFIED SEND_EMAIL (SMTP with automatic Resend Fallback)
    // -----------------------------------------------------------------------
    if (action === 'send_email') {
      const { to, subject, html, text, property_id, outlet_id, attachments } = body;

      let effectivePropertyId = property_id;
      if (!effectivePropertyId && outlet_id) {
        const { data: outlet } = await supabaseAdmin
          .from('outlets')
          .select('property_id')
          .eq('id', outlet_id)
          .maybeSingle();
        if (outlet?.property_id) {
          effectivePropertyId = outlet.property_id;
        }
      }

      // Check if Property SMTP is configured and enabled
      if (effectivePropertyId) {
        const { data: smtpConfig } = await supabaseAdmin
          .from('property_smtp_settings')
          .select('*')
          .eq('property_id', effectivePropertyId)
          .maybeSingle();

        if (smtpConfig && smtpConfig.is_enabled && smtpConfig.host && smtpConfig.encrypted_password) {
          try {
            console.log(`[PropertySMTP] Attempting dispatch via custom SMTP (${smtpConfig.host}) for property ${effectivePropertyId}`);
            const password = await decryptPassword(smtpConfig.encrypted_password);
            const isSsl = smtpConfig.secure_connection === 'ssl' || smtpConfig.port === 465;

            const transporter = nodemailer.createTransport({
              host: smtpConfig.host,
              port: smtpConfig.port,
              secure: isSsl,
              auth: {
                user: smtpConfig.username,
                pass: password
              },
              tls: {
                rejectUnauthorized: false
              },
              connectionTimeout: 10000
            });

            const fromHeader = smtpConfig.from_name 
              ? `"${smtpConfig.from_name}" <${smtpConfig.from_email || smtpConfig.username}>`
              : (smtpConfig.from_email || smtpConfig.username);

            const mailOptions: any = {
              from: fromHeader,
              to: Array.isArray(to) ? to.join(', ') : to,
              subject,
              html,
              text: text || ''
            };

            if (attachments && Array.isArray(attachments)) {
              mailOptions.attachments = attachments.map((att: any) => ({
                filename: att.filename,
                content: att.content,
                encoding: att.encoding || 'base64',
                contentType: att.contentType || 'application/pdf'
              }));
            }

            const info = await transporter.sendMail(mailOptions);
            console.log(`[PropertySMTP] Delivered via property SMTP! MessageId: ${info.messageId}`);
            return new Response(JSON.stringify({ 
              success: true, 
              method: 'smtp', 
              messageId: info.messageId 
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } catch (smtpDispatchErr: any) {
            console.warn('[PropertySMTP] SMTP dispatch failed, engaging Resend fallback:', smtpDispatchErr.message);
            // Fall through to Resend fallback!
          }
        }
      }

      // ---------------------------------------------------------------------
      // FALLBACK TO RESEND DELIVERY NETWORK
      // ---------------------------------------------------------------------
      console.log('[PropertySMTP] Routing email through primary Resend delivery network...');
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (!resendApiKey) {
        throw new Error('RESEND_API_KEY is not configured on the server');
      }

      const resend = new Resend(resendApiKey);
      const toAddresses = Array.isArray(to) ? to : [to];

      const resendAttachments = (attachments || []).map((att: any) => ({
        filename: att.filename,
        content: att.content
      }));

      const resendPayload: any = {
        from: 'The Torch Club <noreply@perfection.my>',
        to: toAddresses,
        subject,
        html,
        attachments: resendAttachments.length > 0 ? resendAttachments : undefined
      };

      if (text) resendPayload.text = text;

      let resendResult = await resend.emails.send(resendPayload);

      // Retry with default sender if domain restriction occurs
      if (resendResult.error && resendPayload.from !== 'onboarding@resend.dev') {
        console.warn('[PropertySMTP] Resend primary from failed, retrying with onboarding@resend.dev:', resendResult.error);
        resendPayload.from = 'The Torch Club <onboarding@resend.dev>';
        resendResult = await resend.emails.send(resendPayload);
      }

      if (resendResult.error) {
        throw new Error(resendResult.error.message || 'Resend delivery failed');
      }

      return new Response(JSON.stringify({ 
        success: true, 
        method: 'resend', 
        messageId: resendResult.data?.id 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action specified' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[PropertySMTP] Unhandled error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
