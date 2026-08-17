import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log(`[Push] Request received. Method: ${req.method}`);
    const userAgent = req.headers.get("user-agent") || "unknown";
    console.log(`[Push] User-Agent: ${userAgent}`);
    
    let json;
    try {
      json = await req.json();
    } catch (e) {
      console.error("[Push] Raw body is not JSON or empty");
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    console.log(`[Push] Received JSON:`, JSON.stringify(json));
    const { userId, user_id, title, body, icon, url, tag, broadcast, targetRole, target_role } = json;
    
    let subscriptions = [];
    if (broadcast) {
      const requestedRole = targetRole || target_role || 'admin';
      console.log(`[Push] BROADCAST MODE (Target Role: ${requestedRole}): Fetching subscriptions...`);
      
      // Try to select with user_type, fallback gracefully if column isn't present
      let allSubs: any[] = [];
      const { data, error: subError } = await supabase
        .from("push_subscriptions")
        .select("*");
      
      if (subError) {
        console.error("[Push] Error fetching subscriptions for broadcast:", subError);
        throw subError;
      }
      
      allSubs = data || [];
      
      // Filter out staff portal subscriptions from general/broadcast alerts
      // Staff members only receive direct targeted pushes (for assigned PT, bookings, messages)
      if (requestedRole === 'admin' || requestedRole === 'admin_only') {
        subscriptions = allSubs.filter((s: any) => {
          const uType = s.user_type || s.subscription?.app_user_type;
          return uType !== 'staff';
        });
      } else if (requestedRole === 'all') {
        subscriptions = allSubs;
      } else {
        subscriptions = allSubs.filter((s: any) => {
          const uType = s.user_type || s.subscription?.app_user_type;
          return uType === requestedRole;
        });
      }
      
      console.log(`[Push] Broadcast filtered: ${subscriptions.length} recipients out of ${allSubs.length} total active devices.`);
    } else {
      const effectiveUserId = userId || user_id;
      console.log(`[Push] Extracted UserId: ${effectiveUserId}, Title: ${title}`);

      if (!effectiveUserId) {
        console.error("[Push] No userId or user_id provided in request and broadcast is false");
        throw new Error("userId is required for direct push");
      }

      // Fetch subscriptions for this specific user
      console.log(`[Push] Querying push_subscriptions for user ${effectiveUserId}...`);
      const { data: userSubs, error: subError } = await supabase
        .from("push_subscriptions")
        .select("subscription")
        .eq("user_id", effectiveUserId);

      if (subError) {
        console.error("[Push] Database error fetching subscriptions:", subError);
        throw subError;
      }
      subscriptions = userSubs || [];
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[Push] No subscriptions found. Push aborted.`);
      return new Response(JSON.stringify({ success: true, message: "No subscriptions found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // VAPID keys from environment
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@healthclub.com";

    console.log(`[Push] VAPID Setup - Public: ${!!publicKey} (${publicKey?.substring(0, 8)}...), Private: ${!!privateKey}, Subject: ${subject}`);

    if (!publicKey || !privateKey) {
      console.error("[Push] CRITICAL ERROR: VAPID keys not configured in Edge Function environment variables.");
      return new Response(JSON.stringify({ success: false, error: "VAPID keys missing in Edge Function environment. Please use 'supabase secrets set' to add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    
    const effectiveLogId = broadcast ? "GLOBAL BROADCAST" : (userId || user_id || "DIRECT PUSH");
    console.log(`[Push] Dispatching to ${subscriptions.length} devices for ${effectiveLogId}`);
    
    const results = await Promise.all(subscriptions.map(async (s: any, index: number) => {
      try {
        const targetUserId = s.user_id || "unknown";
        console.log(`[Push] Sending to device ${index+1}/${subscriptions.length} (Target User: ${targetUserId}): ${s.subscription.endpoint.substring(0, 40)}...`);
        const res = await webpush.sendNotification(s.subscription, JSON.stringify({ title, body, icon, url, tag }));
        console.log(`[Push] Device ${index+1} (${targetUserId}) success: ${res.statusCode}`);
        return res;
      } catch (err: any) {
        console.error(`[Push] Device ${index+1} FAILED:`, err.message || err);
        if (err.statusCode === 410 || err.statusCode === 404) {
           console.log(`[Push] Subscription expired or unsubscribed (410/404). Cleaning up database...`);
           await supabase.from("push_subscriptions").delete().eq("subscription->>endpoint", s.subscription.endpoint);
        }
        return null;
      }
    }));

    return new Response(JSON.stringify({ success: true, sentCount: subscriptions.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
