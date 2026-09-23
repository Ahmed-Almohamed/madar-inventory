# نشر مدار على Cloudflare

## أول نشر بقاعدة فارغة

```sh
npm ci
npm run check
npx wrangler login
npx wrangler d1 create madar-db
```

انسخ database_id الناتج إلى `wrangler.jsonc` بدل المعرّف الصفري، وأبقِ الربط DB وmigrations_dir كما هما. تأكد من حساب Cloudflare المستخدم. معرّف القاعدة ليس كلمة مرور؛ لا تضع API tokens في الملف.

```sh
npm run db:remote
npm run build
npm run deploy
```

الأمر الأخير يعرض رابط Worker. التطبيق لا يحتوي مصادقة؛ قيّد الوصول قبل إدخال بيانات العملاء. حماية المستودع لا تحمي التطبيق المنشور.

## الترحيلات

| الترحيل | المحتوى |
| --- | --- |
| 0001 | الأجهزة والمخازن والمبيعات وحركات المخزون |
| 0002 | الفنيون وأجور التركيب |
| 0003 | المحافظات وربط الفنيين بالمخازن |
| 0004 | صور الأجهزة |
| 0005 | أجور الشحن |

عند التحديث خذ نسخة احتياطية، ثم طبّق `npm run db:remote` قبل `npm run deploy`. لا تحذف الترحيلات ولا تعدّل ما سبق تطبيقه.

## النسخ الاحتياطية ونقل البيانات

البيانات المحلية لا تنتقل تلقائياً. أنشئ مجلد backups قبل التصدير (مستبعد من Git):

```sh
mkdir backups
npx wrangler d1 export DB --local --config wrangler.local.jsonc --output=backups/local.sql
npx wrangler d1 export DB --remote --output=backups/remote.sql
```

استخدم أسماء جديدة للنسخ التالية. هذه الملفات تتضمن بيانات العملاء والصور، فلا ترفعها للمستودع.

لنقل البيانات المحلية، اختبر استيراد النسخة الكاملة إلى قاعدة D1 فارغة منفصلة باستخدام `wrangler d1 execute` و`--file` أولاً. لا تستورد فوق جداول أو مبيعات موجودة، ولا تطبّق الترحيلات فوق مخطط مستورد دون التحقق من سجل d1_migrations. التطبيق يحتوي triggers تعدّل المخزون؛ راجع الكميات والمبيعات والترحيلات بعد الاستيراد قبل ربط قاعدة الإنتاج. لا يتضمن المشروع نقلاً تلقائياً للبيانات.

مراجع: [استيراد وتصدير D1](https://developers.cloudflare.com/d1/best-practices/import-export-data/) و[الترحيلات](https://developers.cloudflare.com/d1/reference/migrations/).

## بعد النشر

تحقق من الصفحات واللغة والصور والتقارير. جرّب بيانات اختبارية للتأكد من خصم المخزون وإعادته بعد إلغاء المبيع. تحقق من تقييد الوصول إلى الصفحة ومسارات /api/ معاً.

الخطة المجانية تخضع لحصص حسابك: [Workers](https://developers.cloudflare.com/workers/platform/pricing/) و[D1](https://developers.cloudflare.com/d1/platform/pricing/). رفع المشروع إلى GitHub لا ينشئ D1 ولا ينشر الموقع تلقائياً.

### تجهيز نسخة محلية للاستيراد

بعد تصدير نسخة محلية، يمكن تجهيز ترتيب الجداول والتحقق من الاستيراد داخل SQLite مؤقتة:

```sh
node scripts/prepare-import.mjs backups/local.sql backups/import.sql
```

الأداة تنشئ كل الجداول قبل إدخال البيانات، وتُبقي triggers بعد البيانات، وتفحص العلاقات. ترفض استبدال ملف موجود. الناتج مخصص لقاعدة بعيدة فارغة فقط. لا ترفع أي ملف من backups إلى GitHub.


إعداد الإنتاج في wrangler.jsonc، وإعداد المعاينة في wrangler.local.jsonc للحفاظ على قاعدة البيانات المحلية مستقلة. أوامر dev وdb:local تستخدم ملف المعاينة تلقائياً.
