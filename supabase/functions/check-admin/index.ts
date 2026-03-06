import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return new Response(JSON.stringify({ error: 'Missing Token' }), { status: 200, headers: corsHeaders });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid Token' }), { status: 200, headers: corsHeaders });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role_id')
      .eq('auth_id', user.id)
      .single();

    const isSuper = profile?.role_id?.toLowerCase() === 'admin' || profile?.role_id?.toLowerCase() === 'system_admin';

    return new Response(JSON.stringify({ isSuper }), {
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
