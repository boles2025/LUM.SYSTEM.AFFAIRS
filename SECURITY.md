# حماية المشروع - Security Guide

## نظام الموظفين والصلاحيات

تم استبدال نظام كلمة المرور الثابتة (8520) بنظام حسابات متكامل:

### الصلاحيات المتاحة:
- **مدير (Admin)**: تحكم كامل - إضافة/تعديل/حذف الطلاب والموظفين، الإعدادات
- **مشرف (Supervisor)**: إدارة الطلاب، التسليم، التقارير، الإعدادات
- **موظف (Employee)**: بحث وعرض وإضافة مرفقات، تسليم مستندات
- **مشاهد (Viewer)**: عرض فقط

### الحساب الافتراضي:
- اسم المستخدم: `admin`
- كلمة المرور: `admin`
- الصلاحية: مدير (Admin)
> **مهم**: غيّر كلمة المرور فوراً بعد أول تسجيل دخول!

---

## حماية Firebase Realtime Database

### الخطوة 1: فعّل Anonymous Authentication

1. اذهب إلى Firebase Console → Authentication → Get Started
2. فعّل **Anonymous** sign-in provider

### الخطوة 2: Realtime Database Security Rules

اذهب إلى Firebase Console → Realtime Database → Rules وضع هذه القواعد:

```json
{
  "rules": {
    "students": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "settings": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "employees": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "activityLog": {
      ".read": "auth != null",
      ".write": "auth != null"
    }
  }
}
```

**ملاحظة أمنية مهمة**: القواعد أعلاه تسمح بالوصول فقط للمستخدمين الموثّقين (Anonymous Auth). هذا يمنع أي وصول غير مصرح به من الخارج. ومع ذلك، لأن Anonymous Auth يمكن لأي شخص استخدامه، فإن الحماية الحقيقية تأتي من طبقة الصلاحيات في الكود (المذكورة أعلاه).

### الحماية المتقدمة (مُوصى بها)

للحماية القصوى، استخدم Firebase App Check + Custom Claims:

1. فعّل **App Check** مع reCAPTCHA Enterprise
2. استخدم **Admin SDK** في Cloud Function لتعيين Custom Claims
3. قيّد الكتابة في Rules للمستخدمين مع `auth.token.admin == true`

```json
{
  "rules": {
    "students": {
      ".read": "auth != null",
      ".write": "auth.token.admin == true"
    },
    "employees": {
      ".read": "auth.token.admin == true",
      ".write": "auth.token.admin == true"
    },
    "activityLog": {
      ".read": "auth.token.admin == true",
      ".write": "auth.token.admin == true"
    }
  }
}
```

---

## نظام تسجيل النشاطات (Activity Log)

جميع العمليات التالية يتم تسجيلها تلقائياً:
- تسجيل الدخول/الخروج
- إضافة طالب جديد
- تعديل بيانات طالب
- حذف طالب
- رفع ملف/مرفق
- حذف ملف/مرفق
- تغيير حالة تسليم مستند
- استيراد من إكسيل
- إضافة/تعديل/إيقاف/حذف موظف

كل سجل يحتوي على:
- اسم الموظف
- اسم المستخدم
- نوع العملية
- تفاصيل العملية
- التاريخ والوقت

---

## حماية GitHub

### لو المشروع Public

1. **استخدم Environment Variables** لتخزين Firebase config
2. **أضف `.gitignore`**:
```
.env
.env.local
node_modules/
```

### لو المشروع Private

1. تأكد إن Repository **Private** في GitHub Settings
2. Firebase API Key **مش حساسة لوحدها** - الحماية في قواعد Database + Auth

---

## روابط مفيدة

- [Firebase Realtime Database Security Rules](https://firebase.google.com/docs/database/security)
- [Firebase App Check](https://firebase.google.com/docs/app-check)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Firebase Realtime Database Limits](https://firebase.google.com/docs/database/usage-limits)
