Free AI Tools — مکمل کوڈ بیس (Development Starter)

میں نے اپنی طرف سے قابلِ تیاری کوڈ ایک جگہ جمع کیا ہے:
- Responsive website اور AI Studio
- Supabase email/password signup، login، logout، password reset کا frontend
- Server-side OpenAI text اور image endpoints
- User profile اور starter credit ledger کے لیے SQL
- Admin summary endpoint
- Paddle webhook signature verification کا بنیادی endpoint
- Video endpoint واضح طور پر بند ہے جب تک provider adapter اور cost controls تیار نہ ہوں
- Privacy، Terms اور Refund کے ابتدائی صفحات

اہم: یہ ابھی live، مکمل tested commercial platform نہیں ہے۔
حقیقی کنکشن کے لیے آپ کے Supabase project، OpenAI API key، hosting، اور منظوری کے بعد payment/video provider settings درکار ہیں۔
OpenAI API کی billing ChatGPT subscription سے الگ ہے۔
Image endpoint کو public کرنے سے پہلے rate limiting، moderation، storage، failed-generation credit refunds اور cost caps لگانا ضروری ہے۔
Paddle webhook signature verify کرتا ہے لیکن ابھی payment event پر credits خودکار طور پر grant نہیں کرتا، کیونکہ آپ کا approved product/price اور user mapping معلوم نہیں۔
Video generation کو غلط خرچ سے بچانے کے لیے بند رکھا گیا ہے۔
قانونی صفحات drafts ہیں، final legal advice نہیں۔

Setup:
1) Node.js 20+ انسٹال کریں۔
2) اس فولڈر میں npm install چلائیں۔
3) .env.example کو .env بنائیں۔
4) Supabase project بنائیں اور supabase/schema.sql چلائیں۔
5) .env میں Supabase URL، anon key، service role key ڈالیں۔
6) public/config.json میں Supabase URL اور anon key ڈالیں۔
7) OpenAI API key اور منظور شدہ model IDs .env میں ڈالیں۔
8) npm run dev چلائیں اور http://localhost:3000 کھولیں۔

Secrets کبھی frontend یا GitHub پر upload نہ کریں، اور چیٹ میں بھی نہ بھیجیں۔
