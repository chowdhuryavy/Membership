import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const isSuperAdminRole = (roleId?: string | null) => {
  const id = roleId?.toLowerCase()?.trim();
  return id === 'super_admin' || 
         id === 'superadmin' || 
         id === 'owner' || 
         id === 'admin' || 
         id === 'system_admin' || 
         id === 'system_administrator' || 
         id === 'administrator';
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
    const { 
      userId, 
      user_id, 
      title, 
      body, 
      icon, 
      url, 
      tag, 
      broadcast, 
      targetRole, 
      target_role, 
      excludeUserId, 
      exclude_user_id, 
      excludeUser,
      outletId,
      outlet_id,
      propertyId,
      property_id,
      requiredPermission,
      required_permission
    } = json;

    const effectiveExcludeUserId = excludeUserId || exclude_user_id || excludeUser;
    const effectiveOutletId = outletId || outlet_id;
    const effectivePropertyId = propertyId || property_id;
    const effectiveRequiredPermission = requiredPermission || required_permission;
    
    let subscriptions = [];
    if (broadcast) {
      const requestedRole = targetRole || target_role || 'admin';
      console.log(`[Push] BROADCAST MODE (Target Role: ${requestedRole}, Outlet: ${effectiveOutletId || 'ALL'}, Property: ${effectivePropertyId || 'ALL'}): Fetching subscriptions and profiles...`);
      
      const [
        { data: subData, error: subError },
        { data: profileData, error: profileError },
        { data: roleData },
        { data: outletData }
      ] = await Promise.all([
        supabase.from("push_subscriptions").select("*"),
        supabase.from("profiles").select("id, email, role_id, allowed_outlets, is_active"),
        supabase.from("roles").select("id, name, permissions"),
        supabase.from("outlets").select("id, property_id")
      ]);
      
      if (subError) {
        console.error("[Push] Error fetching subscriptions for broadcast:", subError);
        throw subError;
      }
      
      const allSubs = subData || [];
      const profiles = profileData || [];
      const roles = roleData || [];
      const outlets = outletData || [];

      const profileMap = new Map<string, any>();
      profiles.forEach((p: any) => profileMap.set(p.id, p));

      const roleMap = new Map<string, any>();
      roles.forEach((r: any) => {
        if (r.id) roleMap.set(r.id.toLowerCase(), r);
        if (r.name) roleMap.set(r.name.toLowerCase(), r);
      });

      const outletPropertyMap = new Map<string, string>();
      const propertyOutletsMap = new Map<string, string[]>();
      outlets.forEach((o: any) => {
        if (o.id && o.property_id) {
          outletPropertyMap.set(o.id, o.property_id);
          const current = propertyOutletsMap.get(o.property_id) || [];
          current.push(o.id);
          propertyOutletsMap.set(o.property_id, current);
        }
      });
      
      subscriptions = allSubs.filter((s: any) => {
        const uType = s.user_type || s.subscription?.app_user_type;

        // Staff members only receive direct targeted pushes (for assigned PT, bookings, messages)
        if (requestedRole === 'admin' || requestedRole === 'admin_only') {
          if (uType === 'staff') return false;
        } else if (requestedRole !== 'all' && uType !== requestedRole) {
          return false;
        }

        const profile = profileMap.get(s.user_id);
        if (!profile) {
          // If no admin profile exists for this subscription in admin broadcast mode, exclude it
          if (requestedRole === 'admin' || requestedRole === 'admin_only') return false;
          return true;
        }

        if (profile.is_active === false) {
          console.log(`[Push] User ${profile.email} is inactive. Skipping push.`);
          return false;
        }

        // Super admins have universal access to all properties and outlets
        const isSuper = isSuperAdminRole(profile.role_id);

        if (!isSuper) {
          const userAllowedOutlets: string[] = Array.isArray(profile.allowed_outlets) ? profile.allowed_outlets : [];

          // If an outlet is specified, user MUST have this outlet in their allowed_outlets
          if (effectiveOutletId) {
            const hasOutletAccess = userAllowedOutlets.includes(effectiveOutletId);
            if (!hasOutletAccess) {
              // Also check if effectiveOutletId was passed as a property ID
              const matchingPropertyOutlets = propertyOutletsMap.get(effectiveOutletId) || [];
              const hasMatchingPropertyOutlet = matchingPropertyOutlets.some((oId: string) => userAllowedOutlets.includes(oId));
              
              if (!hasMatchingPropertyOutlet) {
                console.log(`[Push] User ${profile.email} does not have access to outlet ${effectiveOutletId}. Filtered out.`);
                return false;
              }
            }
          }

          // If a property is specified (without specific outlet), user must have at least one allowed outlet in that property
          if (effectivePropertyId && !effectiveOutletId) {
            const propOutlets = propertyOutletsMap.get(effectivePropertyId) || [];
            const hasPropertyAccess = propOutlets.some((oId: string) => userAllowedOutlets.includes(oId));
            if (!hasPropertyAccess) {
              console.log(`[Push] User ${profile.email} does not have access to property ${effectivePropertyId}. Filtered out.`);
              return false;
            }
          }

          // Check required permission if specified
          if (effectiveRequiredPermission) {
            const userRole = roleMap.get(profile.role_id?.toLowerCase() || '') || roleMap.get(profile.role_id || '');
            if (!userRole || !Array.isArray(userRole.permissions) || !userRole.permissions.includes(effectiveRequiredPermission)) {
              console.log(`[Push] User ${profile.email} lacks permission '${effectiveRequiredPermission}'. Filtered out.`);
              return false;
            }
          }
        }

        return true;
      });
      
      console.log(`[Push] Broadcast permission-filtered: ${subscriptions.length} recipients out of ${allSubs.length} total active devices.`);
    } else {
      const effectiveUserId = userId || user_id;
      console.log(`[Push] Extracted UserId: ${effectiveUserId}, Title: ${title}`);

      if (!effectiveUserId) {
        console.error("[Push] No userId or user_id provided in request and broadcast is false");
        throw new Error("userId is required for direct push");
      }

      // If outlet_id is specified for targeted push, verify user has permission for that outlet
      if (effectiveOutletId) {
        const [
          { data: targetProfile },
          { data: targetStaff }
        ] = await Promise.all([
          supabase.from("profiles").select("id, role_id, allowed_outlets, is_active").eq("id", effectiveUserId).maybeSingle(),
          supabase.from("staff").select("id, outlet_ids, property_id, is_active").eq("id", effectiveUserId).maybeSingle()
        ]);

        if (targetProfile) {
          if (targetProfile.is_active === false) {
            console.log(`[Push] Targeted admin user ${effectiveUserId} is inactive. Push skipped.`);
            return new Response(JSON.stringify({ success: true, message: "Target user is inactive", sentCount: 0 }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const isSuper = isSuperAdminRole(targetProfile.role_id);
          const userAllowed = Array.isArray(targetProfile.allowed_outlets) ? targetProfile.allowed_outlets : [];
          if (!isSuper && !userAllowed.includes(effectiveOutletId)) {
            console.log(`[Push] Targeted user ${effectiveUserId} does not have permission for outlet ${effectiveOutletId}. Push aborted.`);
            return new Response(JSON.stringify({ success: true, message: "User lacks outlet permission", sentCount: 0 }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else if (targetStaff) {
          if (targetStaff.is_active === false) {
            console.log(`[Push] Targeted staff user ${effectiveUserId} is inactive. Push skipped.`);
            return new Response(JSON.stringify({ success: true, message: "Target staff is inactive", sentCount: 0 }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          const staffOutlets = Array.isArray(targetStaff.outlet_ids) ? targetStaff.outlet_ids : [];
          if (!staffOutlets.includes(effectiveOutletId) && targetStaff.property_id !== effectiveOutletId) {
            console.log(`[Push] Targeted staff ${effectiveUserId} does not belong to outlet ${effectiveOutletId}. Push aborted.`);
            return new Response(JSON.stringify({ success: true, message: "Staff lacks outlet permission", sentCount: 0 }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
      }

      // Fetch subscriptions for this specific user
      console.log(`[Push] Querying push_subscriptions for user ${effectiveUserId}...`);
      const { data: userSubs, error: subError } = await supabase
        .from("push_subscriptions")
        .select("subscription, user_id")
        .eq("user_id", effectiveUserId);

      if (subError) {
        console.error("[Push] Database error fetching subscriptions:", subError);
        throw subError;
      }
      subscriptions = userSubs || [];
    }

    // Exclude specified actor user if provided (e.g. admin who triggered void/delete)
    if (effectiveExcludeUserId) {
      const beforeCount = subscriptions.length;
      subscriptions = subscriptions.filter((s: any) => s.user_id !== effectiveExcludeUserId);
      console.log(`[Push] Excluded user ${effectiveExcludeUserId}: ${beforeCount - subscriptions.length} subscriptions removed. Remaining: ${subscriptions.length}`);
    }

    // Deduplicate subscriptions by endpoint to prevent double/multiple pushes to the same device/browser
    const seenEndpoints = new Set();
    subscriptions = subscriptions.filter((s: any) => {
      const endpoint = s.subscription?.endpoint;
      if (!endpoint) return true;
      if (seenEndpoints.has(endpoint)) {
        return false;
      }
      seenEndpoints.add(endpoint);
      return true;
    });

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`[Push] No valid permitted subscriptions found. Push aborted.`);
      return new Response(JSON.stringify({ success: true, message: "No matching subscriptions found", sentCount: 0 }), {
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
    
    const effectiveLogId = broadcast ? `GLOBAL BROADCAST [Outlet: ${effectiveOutletId || 'ALL'}]` : (userId || user_id || "DIRECT PUSH");
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
