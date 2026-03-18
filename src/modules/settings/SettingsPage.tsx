import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { useSettingsStore } from '../../store/useAppStore';

const CURRENCIES = [
  { value: 'MRU', label: 'أوقية موريتانية (MRU)' },
  { value: 'د.ج', label: 'دينار جزائري (د.ج)' },
  { value: 'ر.س', label: 'ريال سعودي (ر.س)' },
  { value: 'د.إ', label: 'درهم إماراتي (د.إ)' },
  { value: 'د.ت', label: 'دينار تونسي (د.ت)' },
  { value: 'د.م.', label: 'درهم مغربي (د.م.)' },
  { value: '$', label: 'دولار أمريكي ($)' },
  { value: '€', label: 'يورو (€)' },
  { value: '£', label: 'جنيه إسترليني (£)' },
];

export const SettingsPage = () => {
  const reloadSettings = useSettingsStore(s => s.reload);

  const settings = useLiveQuery(() => db.settings.get('MASTER')) || {
    id: 'MASTER',
    workshopName: 'ورشة الألمنيوم',
    phone: '',
    address: '',
    currency: 'MRU',
    invoiceFooterText: 'شكراً لتعاملكم معنا',
    orderNumberSequence: 0,
    invoiceNumberSequence: 0,
    purchaseNumberSequence: 0,
  };

  const [formData, setFormData] = useState<any>(null);
  const [saved, setSaved] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (settings && !formData) {
      setFormData(settings);
    }
  }, [settings, formData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      await db.settings.put({ ...formData, id: 'MASTER' });
      await reloadSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  const handleBackup = async () => {
    const data = {
      exportDate: new Date().toISOString(),
      version: 3,
      orders:           await db.orders.toArray(),
      orderItems:       await db.orderItems.toArray(),
      customers:        await db.customers.toArray(),
      suppliers:        await db.suppliers.toArray(),
      purchases:        await db.purchases.toArray(),
      purchaseItems:    await db.purchaseItems.toArray(),
      inventory:        await db.inventory.toArray(),
      stockMovements:   await db.stockMovements.toArray(),
      products:         await db.products.toArray(),
      serviceCategories: await db.serviceCategories.toArray(),
      serviceSubtypes:  await db.serviceSubtypes.toArray(),
      invoices:         await db.invoices.toArray(),
      invoiceItems:     await db.invoiceItems.toArray(),
      payments:         await db.payments.toArray(),
      settings:         await db.settings.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workshop-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm('⚠️ سيتم دمج البيانات المستوردة مع البيانات الحالية. هل أنت متأكد من المتابعة؟')) return;
    try {
      setRestoring(true);
      const text = await file.text();
      const data = JSON.parse(text);
      await db.transaction('rw', [
        db.orders, db.orderItems, db.customers, db.suppliers,
        db.purchases, db.purchaseItems, db.inventory, db.stockMovements,
        db.products, db.serviceCategories, db.serviceSubtypes,
        db.invoices, db.invoiceItems, db.payments, db.settings,
      ], async () => {
        if (data.orders)            await db.orders.bulkPut(data.orders);
        if (data.orderItems)        await db.orderItems.bulkPut(data.orderItems);
        if (data.customers)         await db.customers.bulkPut(data.customers);
        if (data.suppliers)         await db.suppliers.bulkPut(data.suppliers);
        if (data.purchases)         await db.purchases.bulkPut(data.purchases);
        if (data.purchaseItems)     await db.purchaseItems.bulkPut(data.purchaseItems);
        if (data.inventory)         await db.inventory.bulkPut(data.inventory);
        if (data.stockMovements)    await db.stockMovements.bulkPut(data.stockMovements);
        if (data.products)          await db.products.bulkPut(data.products);
        if (data.serviceCategories) await db.serviceCategories.bulkPut(data.serviceCategories);
        if (data.serviceSubtypes)   await db.serviceSubtypes.bulkPut(data.serviceSubtypes);
        if (data.invoices)          await db.invoices.bulkPut(data.invoices);
        if (data.invoiceItems)      await db.invoiceItems.bulkPut(data.invoiceItems);
        if (data.payments)          await db.payments.bulkPut(data.payments);
        if (data.settings)          await db.settings.bulkPut(data.settings);
      });
      await reloadSettings();
      window.alert('تم استرجاع البيانات بنجاح! ستتحدث الصفحة الآن.');
      window.location.reload();
    } catch (err) {
      console.error(err);
      window.alert('خطأ في قراءة الملف. تأكد من أنه ملف نسخة احتياطية صحيح.');
    } finally {
      setRestoring(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (!formData) return (
    <div className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium">جاري التحميل...</div>
  );

  const inputCls = 'w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none dark:text-slate-100 p-2.5 transition-shadow';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shadow-sm">
          <span className="material-symbols-outlined text-3xl">settings</span>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">الإعدادات وتفضيلات النظام</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">تكوين معلومات المؤسسة وإدارة بيانات القاعدة المحلية</p>
        </div>
      </div>

      {/* Success banner */}
      {saved && (
        <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-xl px-5 py-3 text-sm font-bold">
          <span className="material-symbols-outlined text-xl">check_circle</span>
          تم حفظ الإعدادات وتطبيقها على النظام بالكامل
        </div>
      )}

      {/* Institution info card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <span className="material-symbols-outlined text-slate-400">store</span>
          معلومات المؤسسة
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Workshop name */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              اسم المؤسسة <span className="text-xs text-slate-400">(يظهر في الفواتير)</span>
            </label>
            <input
              name="workshopName"
              value={formData.workshopName || ''}
              onChange={handleChange}
              className={inputCls}
            />
          </div>

          {/* Currency */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              العملة الافتراضية
            </label>
            <select
              name="currency"
              value={formData.currency || 'د.ج'}
              onChange={handleChange}
              className={inputCls}
            >
              {CURRENCIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
              {!CURRENCIES.some(c => c.value === formData.currency) && (
                <option value={formData.currency}>{formData.currency} (مخصص)</option>
              )}
            </select>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">info</span>
              ستُطبَّق فوراً على جميع الأسعار والمبالغ في كامل النظام
            </p>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">رقم الهاتف (الرئيسي)</label>
            <input
              name="phone"
              value={formData.phone || ''}
              onChange={handleChange}
              dir="ltr"
              className={`${inputCls} text-right`}
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">مقر المؤسسة</label>
            <input
              name="address"
              value={formData.address || ''}
              onChange={handleChange}
              className={inputCls}
            />
          </div>

          {/* Invoice footer */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              تذييل الفواتير <span className="text-xs text-slate-400">(نص شكر أو شروط يظهر في الطباعة)</span>
            </label>
            <input
              name="invoiceFooterText"
              value={formData.invoiceFooterText || ''}
              onChange={handleChange}
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={handleSave}
            className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
          >
            <span className="material-symbols-outlined text-[18px]">save</span>
            حفظ التغييرات وتطبيقها
          </button>
        </div>
      </div>

      {/* Database card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <span className="material-symbols-outlined text-slate-400">database</span>
          قاعدة البيانات (التخزين المحلي)
        </h3>

        <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed max-w-2xl">
          هذا النظام يعمل بتقنية <strong>Offline-First</strong>، حيث يتم تخزين جميع بيانات العملاء والفواتير والطلبات بأمان داخل متصفحك أو جهازك مباشرة. نوصيك بتصدير نسخة من بياناتك بشكل دوري.
        </p>

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            onClick={handleBackup}
            className="bg-slate-800 dark:bg-slate-100 hover:bg-slate-700 dark:hover:bg-white text-white dark:text-slate-900 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">cloud_download</span>
            تصدير نسخة احتياطية (.json)
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            disabled={restoring}
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">
              {restoring ? 'hourglass_empty' : 'cloud_upload'}
            </span>
            {restoring ? 'جاري الاسترجاع...' : 'استرجاع بيانات سابقة'}
          </button>

          {/* Hidden file input for restore */}
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleRestoreFile}
          />
        </div>

        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
          <span className="material-symbols-outlined text-base shrink-0 mt-0.5">warning</span>
          <span>
            الاسترجاع سيُدمج بيانات الملف مع البيانات الموجودة دون حذف. إذا أردت إعادة تشغيل كامل، استخدم متصفحاً نظيفاً أو امسح بيانات IndexedDB يدوياً ثم استرجع.
          </span>
        </div>
      </div>
    </div>
  );
};
