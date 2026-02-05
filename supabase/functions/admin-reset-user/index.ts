
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  console.log(`[AdminReset] Request: ${req.method} ${req.url}`);

  // Handle CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
        console.error("Missing Environment Variables");
        throw new Error("Server Configuration Error: Missing Supabase keys");
    }

    let body;
    try {
        body = await req.json();
    } catch (e) {
        console.error("JSON Parse Error:", e);
        throw new Error("Invalid JSON body");
    }
    
    const { userId, email, password, name, accessToken } = body;
    console.log(`[AdminReset] Target User: ${userId}`);

    // Try header first, fallback to body
    let token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token && accessToken) {
        console.log("[AdminReset] Using Access Token from Body");
        token = accessToken;
    }

    if (!token) {
      console.error("[AdminReset] No token found in Header or Body");
      return new Response(JSON.stringify({ error: 'Missing Authorization Token' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 401,
      });
    }

    // Verify User with the provided token
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
        console.error(`[AdminReset] Auth Failed: ${authError?.message}`);
        return new Response(JSON.stringify({ error: `Auth Rejected: ${authError?.message || 'Unknown Error'}` }), {
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
      console.warn(`[AdminReset] Forbidden: ${user.email} (Role: ${profile?.role_id})`);
      return new Response(JSON.stringify({ error: 'Forbidden: Admin privileges required.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // Perform Admin Action using Service Role
    const supabaseAdmin = createClient(
      supabaseUrl,
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
    console.error("[AdminReset] Internal Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
