
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  console.log(`[DynamicAction] Request: ${req.method}`);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    let body;
    try {
        body = await req.json();
    } catch(e) {
        throw new Error("Invalid JSON body");
    }

    const { action, userId, accessToken } = body;
    console.log(`[DynamicAction] Action: ${action}, Target: ${userId}`);

    // Logic: Prioritize Body Access Token because the Header likely contains the Anon Key
    let token = accessToken;
    if (!token) {
        token = req.headers.get('Authorization')?.replace('Bearer ', '');
    }

    if (!token) {
        return new Response(JSON.stringify({ error: 'Missing Token' }), { status: 200, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
        console.error(`[DynamicAction] Auth Error: ${authError?.message}`);
        return new Response(JSON.stringify({ error: `Auth Error: ${authError?.message}` }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify Permissions in DB using Admin Client to bypass RLS
    let { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('role_id, id, email')
      .eq('auth_id', user.id)
      .single();

    if (!profileData) {
        // Fallback: try matching by ID if auth_id is not used
        const { data: profileById } = await supabaseAdmin
          .from('profiles')
          .select('role_id, id, email')
          .eq('id', user.id)
          .single();
        
        if (!profileById) {
            return new Response(JSON.stringify({ error: 'Forbidden: Profile not found for this session.' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200, 
            });
        }
        // Use the found profile
        profileData = profileById;
    }

    // Superuser bypass
    const isSuper = profileData.role_id?.toLowerCase() === 'admin' || profileData.role_id?.toLowerCase() === 'system_admin';
    
    // Check role permissions - Try ID first (case-insensitive)
    let { data: role } = await supabaseAdmin
      .from('roles')
      .select('permissions, id, name')
      .ilike('id', profileData.role_id)
      .single();

    // If not found by ID, try by Name
    if (!role) {
        const { data: roleByName } = await supabaseAdmin
          .from('roles')
          .select('permissions, id, name')
          .ilike('name', profileData.role_id)
          .single();
        role = roleByName;
    }

    // Check overrides
    const { data: overrides } = await supabaseAdmin
      .from('user_permission_overrides')
      .select('permission_key, is_granted')
      .eq('user_id', profileData.id);

    const permissions = Array.isArray(role?.permissions) ? role.permissions : [];
    const requiredPermission = action === 'delete' ? 'users:delete' : (action === 'create' ? 'users:create' : 'users:edit');
    
    // BROAD PERMISSION: Allow if they have ANY user management permission OR if they have ANY role at all (as requested)
    const hasUserPermission = permissions.some((p: any) => String(p).startsWith('users:'));
    
    // Check if specifically granted or denied by override
    const override = overrides?.find((o: any) => o.permission_key === requiredPermission);
    
    // Allow if they are a superuser, or if they have the specific override, or if they have the required permission.
    const isPermitted = isSuper || (override ? override.is_granted : hasUserPermission);

    // Target protection: Cannot modify superuser unless you ARE the superuser
    let isTargetSuper = false;
    if (userId) {
        const { data: targetProfile } = await supabaseAdmin
          .from('profiles')
          .select('role_id')
          .eq('auth_id', userId)
          .single();
        
        isTargetSuper = targetProfile?.role_id?.toLowerCase() === 'admin' || targetProfile?.role_id?.toLowerCase() === 'system_admin';
    }

    if (isTargetSuper && !isSuper) {
        return new Response(JSON.stringify({ error: 'Forbidden: Cannot modify System Superuser.' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200, 
        });
    }

    if (!isPermitted) {
      return new Response(JSON.stringify({ error: 'Access denied. Insufficient permissions.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (action === 'delete' && userId) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteError) throw deleteError;
      
      return new Response(JSON.stringify({ message: 'User identity purged successfully.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (action === 'create' && body.email) {
      const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: body.email,
        password: body.password || 'Temporary123!',
        email_confirm: true,
        user_metadata: {
            full_name: body.name,
            name: body.name,
            display_name: body.name
        }
      });
      if (createError) throw createError;
      
      return new Response(JSON.stringify({ message: 'User created successfully.', user: createData.user }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("[DynamicAction] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
});
