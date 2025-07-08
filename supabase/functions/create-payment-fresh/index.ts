import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // replace with frontend domain in production
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method === "POST") {
    try {
      const { contributor, amount, return_url } = await req.json();

      if (
        !contributor || !amount || !return_url ||
        typeof contributor !== "string" ||
        typeof return_url !== "string" ||
        typeof amount !== "number" || amount <= 0
      ) {
        return new Response(JSON.stringify({ error: "Invalid input" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const appId = Deno.env.get("CF_ID");
      const secretKey = Deno.env.get("CF_SECRET");

      console.log("🔐 CF_ID:", appId);
      console.log("🔐 CF_SECRET present:", secretKey ? "✅" : "❌");

      if (!appId || !secretKey) {
        return new Response(JSON.stringify({ error: "Missing Cashfree credentials" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const order_id = `order_${Date.now()}`;
      const payload = {
        order_id,
        order_currency: "INR",
        order_amount: amount.toString(),
        customer_details: {
          customer_id: order_id,
          customer_name: contributor,
          customer_email: "test@example.com",
          customer_phone: "9999999999",
        },
        order_meta: {
          return_url: `${return_url}?order_id=${order_id}&order_amount=${amount}`,
        },
      };

      const response = await fetch("https://api.cashfree.com/pg/orders", {
        method: "POST",
        headers: {
          "x-client-id": appId,
          "x-client-secret": secretKey,
          "x-api-version": "2023-08-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log("🧾 Cashfree response:", data);

      if (response.ok && data.payment_link) {
        return new Response(JSON.stringify({ payment_link: data.payment_link }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        return new Response(JSON.stringify({ error: data.message || "Failed to generate payment link" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

    } catch (err) {
      console.error("❌ Server error:", err.message);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
