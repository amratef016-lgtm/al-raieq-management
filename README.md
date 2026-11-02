# Al Raieq Management

لوحة إدارة **مطحن وكافيه الرايق** – صندفا، بني مزار، المنيا.

## التقنية
- Next.js App Router + TypeScript
- Supabase Authentication and PostgreSQL
- Vercel deployment

## التشغيل المحلي
1. ثبّت Node.js 20 أو أحدث.
2. نفّذ `npm install`.
3. انسخ `.env.example` إلى `.env.local` وأضف بيانات مشروع Supabase.
4. نفّذ `npm run dev` وافتح http://localhost:3000.

## متغيرات البيئة
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

لا ترفع مفاتيح سرية إلى GitHub. استخدم Environment Variables في Vercel.

## الوحدات المخطط لها
- لوحة المؤشرات والمبيعات اليومية
- المنتجات والتسعير والتكاليف
- المخزون وحركاته
- العملاء والموردون
- المديونيات والتحصيل
- المصروفات والأرباح
- المستخدمون والصلاحيات

الأسعار والأرصدة التاريخية لا تُعتمد كبيانات تشغيلية قبل مراجعتها وتأكيدها.
