// supabase/functions/create-payment-fresh/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const { contributor, amount, return_url } = await req.json();

    const order_id = `ORD_${Date.now()}`;
    const cfId = Deno.env.get("CF_ID")!;
    const cfSecret = Deno.env.get("CF_SECRET")!;

    const res = await fetch("https://api.cashfree.com/pg/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": cfId,
        "x-client-secret": cfSecret
      },
      body: JSON.stringify({
        order_id,
        order_amount: amount,
        order_currency: "INR",
        customer_details: {
          customer_id: order_id,
          customer_name: contributor,
          customer_email: "test@example.com",
          customer_phone: "9999999999"
        },
        order_note: "Payment for contribution",
        order_meta: {
          return_url: `${return_url}?order_id=${order_id}&order_amount=${amount}`
        }
      })
    });

    const data = await res.json();

    if (res.ok && data.payment_link) {
      return new Response(JSON.stringify({ payment_link: data.payment_link }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({ error: data.message || "Failed to create payment" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
