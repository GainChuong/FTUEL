import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { products } = await req.json();
    if (!products || !Array.isArray(products) || products.length === 0) {
      return new Response(JSON.stringify({ error: "No products provided" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    const displayName = profile?.display_name || null;

    const dbProducts = products.map((p: any) => {
      // Clean price
      let cleanPrice = null;
      if (p.price) {
        const rawPrice = String(p.price);
        if (rawPrice.includes(' - ')) {
           cleanPrice = parseFloat(rawPrice.split(' - ')[0].replace(/\./g, '').replace(/[^0-9]/g, '')) || null;
        } else {
           cleanPrice = parseFloat(rawPrice.replace(/\./g, '').replace(/[^0-9]/g, '')) || null;
        }
      }

      // Clean promotion: DB is numeric(5, 4), so 16% must be 0.16
      let cleanPromotion = null;
      const rawPromotion = p.discount || p.promotion;
      if (rawPromotion) {
        const val = parseFloat(String(rawPromotion).replace(/[^0-9]/g, ""));
        if (!isNaN(val)) {
          cleanPromotion = val / 100;
        }
      }

      return {
        shop_name: p.shopName || p.shop_name || "Unknown Shop",
        name: p.name || "Unnamed Product",
        rating: p.rating ? parseFloat(String(p.rating)) || null : null,
        price: cleanPrice,
        sold_count: parseInt(String(p.sold || p.sold_count || 0), 10) || 0,
        region: p.region || null,
        promotion: cleanPromotion,
        user_id: user.id,
        display_name: displayName,
      };
    });

    let totalInserted = 0;
    let errors: string[] = [];

    for (let i = 0; i < dbProducts.length; i += 50) {
      const batch = dbProducts.slice(i, i + 50);
      const { data, error: insertError } = await adminClient
        .from("products")
        .insert(batch)
        .select("id");

      if (insertError) {
        errors.push(`Batch ${Math.floor(i / 50) + 1}: ${insertError.message}`);
      } else {
        totalInserted += data?.length || 0;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: totalInserted,
        total: dbProducts.length,
        errors: errors.length > 0 ? errors : undefined,
        user_id: user.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
