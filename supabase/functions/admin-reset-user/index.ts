
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // 1. Log immediately for visibility in Supabase Dashboard
  console.log(`[AdminReset] Request Received: ${req.method} ${new URL(req.url).pathname}`);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, email, password, name } = await req.json();
    console.log(`[AdminReset] Target User ID: ${userId}`);

    // 2. Initialize Client with caller's identity
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("Missing Authorization Header");
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // 3. Verify the caller is an admin in the profiles table
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
        console.error("[AdminReset] Auth Error:", authError);
        return new Response(JSON.stringify({ error: 'Identity verification failed.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
        });
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role_id')
      .eq('auth_id', user.id)
      .single();

    if (profileError || profile?.role_id !== 'admin') {
      console.warn(`[AdminReset] Access Denied: User ${user.email} is not an admin.`);
      return new Response(JSON.stringify({ error: 'Permission denied. Admin clearance required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // 4. Use Service Role Client for management
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    const updatePayload: any = {};
    if (email) updatePayload.email = email;
    if (password) updatePayload.password = password;
    if (name) updatePayload.data = { name: name, full_name: name, display_name: name };

    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      updatePayload
    );

    if (updateError) {
      console.error("[AdminReset] Update Error:", updateError);
      throw updateError;
    }

    console.log(`[AdminReset] Successfully updated user: ${userId}`);
    return new Response(JSON.stringify({ message: 'Identity synchronized successfully', user: updateData.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error("[AdminReset] Critical Failure:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
