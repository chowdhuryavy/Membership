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

    const { userId, title, body, icon, url, tag } = await req.json();

    if (!userId) {
      throw new Error("userId is required");
    }

    // Fetch subscriptions for this user
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("subscription")
      .eq("user_id", userId);

    if (subError) throw subError;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No subscriptions found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // VAPID keys from environment
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@healthclub.com";

    if (!publicKey || !privateKey) {
      console.warn("VAPID keys not configured in Edge Function. Skipping push.");
      return new Response(JSON.stringify({ success: false, error: "VAPID keys missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    
    console.log(`Sending push to ${subscriptions.length} devices for user ${userId}`);
    
    const results = await Promise.all(subscriptions.map(async (s: any) => {
      try {
        return await webpush.sendNotification(s.subscription, JSON.stringify({ title, body, icon, url, tag }));
      } catch (err: any) {
        console.error(`Push failed for device:`, err);
        if (err.statusCode === 410 || err.statusCode === 404) {
           // Expired subscription
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
