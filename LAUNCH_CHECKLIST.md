# Launch checklist

## Must be completed by the operator
- Create Supabase project; run SQL; configure email confirmation and redirect URLs.
- Create OpenAI API account, add billing limits, choose accessible model IDs and add server key.
- Choose a host (Vercel/Render/Railway etc.), add environment variables, deploy over HTTPS.
- Choose video provider/model, test task creation/polling/storage and define per-user spend limits.
- Apply to payment provider; create products/prices; test checkout, webhook idempotency, refunds, tax and payout destination.
- Replace all legal placeholders and support contacts; obtain legal review for operating jurisdiction and target markets.
- Add CAPTCHA, rate limits, content moderation, logs/monitoring, backups, data deletion process and security review.
- Add Google AdSense only after real content, privacy disclosures and site compliance; approval is not guaranteed.

## Not implemented as production-ready
- Video provider adapter and video job storage.
- Paddle entitlement grants, subscriptions, cancellations, refunds and idempotent event processing.
- Full admin dashboard with role-based audited controls.
- Scheduled daily credit reset and reliable failed-generation refunds.
- Production-grade moderation, abuse prevention, CAPTCHA, analytics and observability.
