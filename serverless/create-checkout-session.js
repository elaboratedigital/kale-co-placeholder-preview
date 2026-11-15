/**
 * STRIPE CHECKOUT INTEGRATION POINT — serverless function stub
 * ------------------------------------------------------------
 * This is a placeholder. It does not charge cards and contains no secret keys.
 *
 * Suggested hosts: Netlify Functions, Vercel Serverless, or Cloudflare Workers.
 * Typical path after deploy: /api/create-checkout-session
 *
 * To finish the integration (test mode first):
 *   1. npm install stripe  (in the function bundle, not the static front-end)
 *   2. Set STRIPE_SECRET_KEY in the host environment (sk_test_... first)
 *   3. Uncomment the live Stripe SDK block below and remove the placeholder
 *      response once you are ready to redirect to a real Checkout Session
 *   4. Keep CORS tight; only your site origin should call this endpoint
 *   5. Switch to sk_live_ / pk_live_ only after successful test orders
 *
 * NEVER commit a secret key, and never send a secret key to the browser.
 */

const PLACEHOLDER = true;

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

async function handler(event) {
  if (event.httpMethod && event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  if (PLACEHOLDER) {
    return json(501, {
      error: "Stripe Checkout is not connected.",
      placeholder: true,
      message: "This function is a stub. Set STRIPE_SECRET_KEY in the host environment, implement the session create call below, and set content.json stripe.enabled to true."
    });
  }

  /*
  const Stripe = require("stripe");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const payload = JSON.parse(event.body || "{}");
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: (payload.order && payload.order.lineItems) || [],
    success_url: payload.successUrl,
    cancel_url: payload.cancelUrl,
    customer_email: payload.order && payload.order.email,
    metadata: { fulfillment: payload.order && payload.order.fulfillment }
  });
  return json(200, { id: session.id, url: session.url });
  */

  return json(500, { error: "Not implemented" });
}

// Netlify Functions
exports.handler = handler;

// Generic Node / Vercel-style
module.exports = handler;
module.exports.handler = handler;
