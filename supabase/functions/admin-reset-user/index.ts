
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
        throw new Error("Server Configuration Error: Missing Supabase keys");
    }

    const body = await req.json();
    const { userId, email, password, name, accessToken } = body;

    let token = accessToken || req.headers.get('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return new Response(JSON.stringify({ error: 'Missing Authorization Token' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200, 
      });
    }

    // Verify User with the provided token
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
        return new Response(JSON.stringify({ error: `Auth Rejected: ${authError?.message || 'Unknown Error'}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200, 
        });
    }

    // Admin client for DB checks and Auth updates
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get requester profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, role_id')
      .eq('auth_id', user.id)
      .single();

    if (!profile) {
        return new Response(JSON.stringify({ error: 'Forbidden: Profile not found.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200, 
        });
    }

    // 2. Check Permissions
    const isSuper = profile.role_id?.toLowerCase() === 'admin' || profile.role_id?.toLowerCase() === 'system_admin';
    
    // Fetch role permissions
    const { data: role } = await supabaseAdmin
      .from('roles')
      .select('permissions')
      .ilike('id', profile.role_id)
      .single();

    // Fetch user overrides
    const { data: overrides } = await supabaseAdmin
      .from('user_permission_overrides')
      .select('permission_key, is_granted')
      .eq('user_id', profile.id);

    const permissions = Array.isArray(role?.permissions) ? role.permissions : [];
    const hasUserPermission = permissions.some((p: any) => String(p).startsWith('users:'));
    const override = overrides?.find((o: any) => o.permission_key === 'users:edit');

    // Permission Logic: Superuser OR (Override exists ? is_granted : hasUserPermission)
    // Removed the fallback that allowed ANY user with a role to reset passwords.
    const isPermitted = isSuper || (override ? override.is_granted : hasUserPermission);

    if (!isPermitted) {
      return new Response(JSON.stringify({ error: 'Forbidden: Insufficient permissions to manage users.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, 
      });
    }

    // 3. Target Protection: Cannot modify superuser unless you ARE a superuser
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('role_id')
      .eq('auth_id', userId)
      .single();
    
    const isTargetSuper = targetProfile?.role_id?.toLowerCase() === 'admin' || targetProfile?.role_id?.toLowerCase() === 'system_admin';

    if (isTargetSuper && !isSuper) {
        return new Response(JSON.stringify({ error: 'Forbidden: Cannot modify System Superuser.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200, 
        });
    }

    // 4. Perform Update
    const updatePayload: any = {};
    if (email) updatePayload.email = email;
    if (password) updatePayload.password = password;
    if (name) updatePayload.data = { name: name, full_name: name, display_name: name };

    const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      updatePayload
    );

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ message: 'Success', user: updateData.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, 
    });
  }
});
