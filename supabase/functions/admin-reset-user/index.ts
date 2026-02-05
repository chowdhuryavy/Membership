
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // 1. Log immediately
  console.log(`[AdminReset] Request: ${req.method} ${req.url}`);

  // 2. Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 3. Parse Body
    let body;
    try {
        body = await req.json();
    } catch (e) {
        throw new Error("Invalid JSON body");
    }
    
    const { userId, email, password, name } = body;
    console.log(`[AdminReset] Processing user: ${userId}`);

    // 4. Validate Auth Header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error("Missing Authorization Header");
    }

    // 5. Check Permissions
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
        console.error("[AdminReset] Invalid Token:", authError);
        return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
        });
    }

    // Verify Admin Role in DB
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role_id')
      .eq('auth_id', user.id)
      .single();

    if (profile?.role_id !== 'admin') {
      console.warn(`[AdminReset] 403 Forbidden: User ${user.email} is ${profile?.role_id}`);
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // 6. Perform Admin Action
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

    if (updateError) throw updateError;

    console.log(`[AdminReset] Success: ${userId}`);
    return new Response(JSON.stringify({ message: 'Success', user: updateData.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error("[AdminReset] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
