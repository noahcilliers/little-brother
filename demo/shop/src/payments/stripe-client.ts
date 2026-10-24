/** Stripe settings. The payments workstream verifies webhooks with this secret. */
export const stripeConfig = {
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_demo",
};
