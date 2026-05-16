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
    const json = await req.json();
    console.log(`[Push] Received JSON:`, JSON.stringify(json));
    const { userId, user_id, title, body, icon, url, tag } = json;
    const effectiveUserId = userId || user_id;
    console.log(`[Push] Extracted UserId: ${effectiveUserId}, Title: ${title}`);

    if (!effectiveUserId) {
      console.error("[Push] No userId or user_id provided in request");
      throw new Error("userId is required");
    }

    // Fetch subscriptions for this user
    console.log(`[Push] Querying push_subscriptions for user ${effectiveUserId}...`);
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", effectiveUserId);

    if (subError) {
      console.error("[Push] Database error fetching subscriptions:", subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[Push] No subscriptions found for user ${userId}. Push aborted.`);
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
    
    console.log(`[Push] Dispatching to ${subscriptions.length} devices for user ${userId}`);
    
    const results = await Promise.all(subscriptions.map(async (s: any, index: number) => {
      try {
        console.log(`[Push] Sending to device ${index+1}/${subscriptions.length}: ${s.subscription.endpoint}`);
        const res = await webpush.sendNotification(s.subscription, JSON.stringify({ title, body, icon, url, tag }));
        console.log(`[Push] Device ${index+1} success: ${res.statusCode}`);
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
