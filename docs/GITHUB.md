# الرفع إلى GitHub

أنشئ مستودعاً فارغاً في حسابك، وحدد Private أو Public حسب رغبتك. لا تضف README أو gitignore من GitHub لأنهما موجودان هنا.

داخل مجلد المشروع، إذا لم يكن Git مهيأً، شغّل `git init -b main`. ثم:

```sh
git add .
git diff --cached --stat
git commit -m "Prepare Madar inventory app"
```

إذا طلب Git هوية المؤلف، اضبط اسمك وبريدك محلياً للمستودع. استبدل `REPOSITORY` بالاسم الفعلي:

```sh
git remote add origin https://github.com/Ahmed-Almohamed/REPOSITORY.git
git push -u origin main
```

أكمل تسجيل الدخول عندما يطلبه Git Credential Manager، أو استخدم GitHub Desktop. إذا كان origin موجوداً، افحص `git remote -v` قبل تغييره. لا تضع كلمات مرور أو tokens داخل الملفات أو الروابط.

## الملفات

يُرفع الكود والوثائق والخطوط ورخصها والترحيلات وpackage-lock.json. يستبعد `.gitignore` الأسرار وقواعد البيانات والنسخ الاحتياطية وnode_modules وdist. ملفات SQL داخل migrations مستثناة من التجاهل لأنها هيكل التطبيق. راجع `git ls-files` قبل الرفع ولا تضف الملفات المتجاهلة بالقوة.

## التحديث

```sh
npm run check
npm run build
git add .
git diff --cached --stat
git commit -m "Describe the change"
git push
```

تبويب Actions يعرض الفحص الآلي. رفع الكود لا ينشر الموقع ولا ينقل بيانات D1. راجع [دليل Cloudflare](CLOUDFLARE.md).
