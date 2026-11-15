/**
 * STRIPE CHECKOUT INTEGRATION POINT (PLACEHOLDER)
 * ------------------------------------------------
 * This file does not charge cards and includes no real secret keys.
 * Do not paste a live secret key (sk_live_ or sk_test_) into any front-end file.
 *
 * How to connect the client's Stripe account later (test mode first):
 * 1. The client creates a Stripe account in the business name and opens
 *    https://dashboard.stripe.com/test/apikeys
 * 2. Put the publishable key (pk_test_...) in content.json -> stripe.publishableKey
 * 3. Set content.json -> stripe.enabled to true
 * 4. Store the secret key only in the host environment as STRIPE_SECRET_KEY
 *    (never in this repo, never in content.json)
 * 5. Deploy serverless/create-checkout-session.js as /api/create-checkout-session
 *    (or update stripe.checkoutSessionEndpoint)
 * 6. Run test-mode orders, then switch to live keys only at launch
 *
 * Until those steps are done, the checkout button uses demo confirmation only.
 */
(function (global) {
  "use strict";

  function isPlaceholderKey(key) {
    return !key || /REPLACE_WITH_CLIENT/i.test(key) || key === "pk_test_REPLACE_WITH_CLIENT_TEST_KEY";
  }

  function isReady(stripeConfig) {
    return Boolean(
      stripeConfig &&
      stripeConfig.enabled === true &&
      stripeConfig.publishableKey &&
      !isPlaceholderKey(stripeConfig.publishableKey)
    );
  }

  /**
   * Attempt to start Stripe Checkout. Returns:
   *   { ok: false, reason: "not-configured", message }
   *   { ok: false, reason: "error", message }
   *   { ok: true } after redirect
   */
  async function startCheckout({ stripeConfig, order, successUrl, cancelUrl }) {
    if (!isReady(stripeConfig)) {
      return {
        ok: false,
        reason: "not-configured",
        message: "Stripe Checkout is not connected yet. This is a placeholder. No card was charged. In production, this button creates a Stripe Checkout Session and redirects the customer to Stripe."
      };
    }

    const endpoint = stripeConfig.checkoutSessionEndpoint || "/api/create-checkout-session";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currency: stripeConfig.currency || "usd",
        order,
        successUrl,
        cancelUrl,
        /* Front-end may send the publishable key for reference only.
           The server must use STRIPE_SECRET_KEY from the environment. */
        mode: stripeConfig.mode || "test"
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, reason: "error", message: "Could not start Stripe Checkout: " + text };
    }

    const data = await response.json();
    if (data.url) {
      window.location.href = data.url;
      return { ok: true };
    }
    return { ok: false, reason: "error", message: "Stripe session response was missing a redirect URL." };
  }

  global.KaleStripe = { isReady, isPlaceholderKey, startCheckout };
})(window);
