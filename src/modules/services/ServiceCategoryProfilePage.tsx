import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { Modal } from '../../shared/components/Modal';
import { ServiceCategoryForm } from './ServiceCategoryForm';
import { ServiceSubtypeForm } from './ServiceSubtypeForm';
import { formatCurrency, formatDate, getUnitLabel } from '../../core/utils/formatters';
import type { Invoice, Order, ServiceCategory, ServiceSubtype } from '../../core/types';

type ServiceHistoryType = 'order' | 'invoice';

interface ServiceHistoryItem {
  id: string;
  type: ServiceHistoryType;
  title: string;
  reference: string;
  date: string;
  createdAt: number;
  quantity: number;
  amount: number;
  statusLabel: string;
  details: string;
}

const getOrderStatusLabel = (status: Order['status']) => {
  switch (status) {
    case 'new':
      return 'طلب جديد';
    case 'in_progress':
      return 'قيد التنفيذ';
    case 'ready':
      return 'جاهز';
    case 'installed':
      return 'تم التركيب';
    case 'cancelled':
      return 'ملغي';
    default:
      return status;
  }
};

const getInvoiceStatusLabel = (status: Invoice['status']) => {
  switch (status) {
    case 'draft':
      return 'مسودة';
    case 'issued':
      return 'مُصدرة';
    case 'paid':
      return 'مدفوعة';
    case 'cancelled':
      return 'ملغاة';
    default:
      return status;
  }
};

export const ServiceCategoryProfilePage = () => {
  const { categoryId = '' } = useParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ServiceHistoryType>('all');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubtypeOpen, setIsSubtypeOpen] = useState(false);
  const [editingSubtype, setEditingSubtype] = useState<ServiceSubtype | undefined>();

  const profile = useLiveQuery(async () => {
    if (!categoryId) return null;

    const category = await db.serviceCategories.get(categoryId);
    if (!category) {
      return {
        category: null,
        subtypes: [] as ServiceSubtype[],
        orderUsage: [] as ServiceHistoryItem[],
        invoiceUsage: [] as ServiceHistoryItem[],
      };
    }

    const subtypes = await db.serviceSubtypes.where('categoryId').equals(categoryId).toArray();
    const [orderItems, invoiceItems] = await Promise.all([
      db.orderItems.where('itemId').equals(categoryId).toArray(),
      db.invoiceItems.where('itemId').equals(categoryId).toArray(),
    ]);

    const serviceOrderItems = orderItems.filter((item) => item.type === 'service');
    const serviceInvoiceItems = invoiceItems.filter((item) => item.type === 'service');

    const subtypeMap = new Map(subtypes.map((sub) => [sub.id, sub]));

    const orderUsage = await Promise.all(serviceOrderItems.map(async (item) => {
      const order = await db.orders.get(item.orderId);
      const customer = order ? await db.customers.get(order.customerId) : null;
      const subtype = item.subtypeId ? subtypeMap.get(item.subtypeId) : null;
      return order ? {
        id: `order-${item.id}`,
        type: 'order' as const,
        title: `طلبية #${order.orderNumber}`,
        reference: customer?.name || 'عميل غير معروف',
        date: order.date,
        createdAt: order.createdAt,
        quantity: item.quantity,
        amount: item.lineTotal,
        statusLabel: getOrderStatusLabel(order.status),
        details: subtype ? `النوع المستخدم: ${subtype.name}` : 'استخدام مباشر للخدمة',
      } : null;
    }));

    const invoiceUsage = await Promise.all(serviceInvoiceItems.map(async (item) => {
      const invoice = await db.invoices.get(item.invoiceId);
      const customer = invoice ? await db.customers.get(invoice.customerId) : null;
      const subtype = item.subtypeId ? subtypeMap.get(item.subtypeId) : null;
      return invoice ? {
        id: `invoice-${item.id}`,
        type: 'invoice' as const,
        title: `فاتورة #${invoice.invoiceNumber}`,
        reference: customer?.name || 'عميل غير معروف',
        date: invoice.date,
        createdAt: invoice.createdAt,
        quantity: item.quantity,
        amount: item.lineTotal,
        statusLabel: getInvoiceStatusLabel(invoice.status),
        details: subtype ? `النوع المستخدم: ${subtype.name}` : 'بيع مباشر للخدمة',
      } : null;
    }));

    return {
      category,
      subtypes,
      orderUsage: orderUsage.filter(Boolean) as ServiceHistoryItem[],
      invoiceUsage: invoiceUsage.filter(Boolean) as ServiceHistoryItem[],
    };
  }, [categoryId]);

  if (profile === undefined) {
    return <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center text-slate-500 dark:text-slate-400">جاري تحميل ملف الخدمة...</div>;
  }

  if (!profile || !profile.category) {
    return (
      <div className="space-y-6">
        <Link to="/services" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors"><span className="material-symbols-outlined text-lg">arrow_back</span>العودة إلى الخدمات</Link>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center"><span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 block mb-3">design_services</span><h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">الخدمة غير موجودة</h2><p className="text-slate-500 dark:text-slate-400">قد تكون الخدمة محذوفة أو الرابط غير صحيح.</p></div>
      </div>
    );
  }

  const { category, subtypes, orderUsage, invoiceUsage } = profile;
  const history = [...orderUsage, ...invoiceUsage].sort((a, b) => b.createdAt - a.createdAt);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredHistory = history.filter((item) => {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    if (!normalizedSearch) return true;
    return [item.title, item.reference, item.statusLabel, item.details].join(' ').toLowerCase().includes(normalizedSearch);
  });

  const activeSubtypes = subtypes.filter((sub) => sub.isActive).length;
  const totalDefaultPrice = subtypes.reduce((sum, sub) => sum + sub.defaultPrice, 0);
  const totalUsageValue = history.reduce((sum, item) => sum + item.amount, 0);

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-3">
            <Link to="/services" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors"><span className="material-symbols-outlined text-lg">arrow_back</span>العودة إلى الخدمات</Link>
            <div className="flex items-start gap-4"><div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-3xl">design_services</span></div><div><div className="flex flex-wrap items-center gap-3 mb-1.5"><h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">{category.name}</h2><span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${category.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{category.isActive ? 'مفعّلة' : 'موقوفة'}</span></div><p className="text-slate-500 dark:text-slate-400 text-sm">ملف خدمة رئيسية يشمل أنواعها الفرعية واستعمالها في الطلبات والفواتير.</p><div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600 dark:text-slate-300"><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-lg text-slate-400">account_tree</span><span>{subtypes.length} نوع فرعي</span></div><div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-lg text-slate-400">calendar_month</span><span>أضيفت في {formatDate(category.createdAt)}</span></div></div></div></div>
          </div>
          <div className="flex flex-wrap gap-3"><button onClick={() => { setEditingSubtype(undefined); setIsSubtypeOpen(true); }} className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"><span className="material-symbols-outlined text-xl">add</span>إضافة نوع فرعي</button><button onClick={() => setIsEditOpen(true)} className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"><span className="material-symbols-outlined text-xl">edit</span>تعديل الخدمة</button></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"><div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5"><p className="text-xs text-slate-500 dark:text-slate-400 mb-2">إجمالي الأنواع</p><p className="text-2xl font-black text-slate-800 dark:text-slate-100">{subtypes.length}</p></div><div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5"><p className="text-xs text-slate-500 dark:text-slate-400 mb-2">أنواع مفعّلة</p><p className="text-2xl font-black text-emerald-600">{activeSubtypes}</p></div><div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5"><p className="text-xs text-slate-500 dark:text-slate-400 mb-2">إجمالي أسعار افتراضية</p><p className="text-2xl font-black text-primary">{formatCurrency(totalDefaultPrice)}</p></div><div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5"><p className="text-xs text-slate-500 dark:text-slate-400 mb-2">قيمة الاستخدام</p><p className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatCurrency(totalUsageValue)}</p></div></div>

        {category.description && <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-4"><div className="flex items-start gap-3"><span className="material-symbols-outlined text-amber-500">sticky_note_2</span><div><h3 className="font-bold text-slate-800 dark:text-slate-100 mb-1">وصف الخدمة</h3><p className="text-sm text-slate-600 dark:text-slate-300 leading-7">{category.description}</p></div></div></div>}

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"><div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"><div><h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">الأنواع الفرعية</h3><p className="text-sm text-slate-500 dark:text-slate-400">كل نوع فرعي له ملف مستقل ويمكن الوصول إليه مباشرة.</p></div><div className="text-sm text-slate-500 dark:text-slate-400">{subtypes.length} نوع</div></div><div className="overflow-x-auto"><table className="w-full text-right min-w-[760px]"><thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase"><tr><th className="px-6 py-4">النوع</th><th className="px-6 py-4">السعر الافتراضي</th><th className="px-6 py-4">الوحدة</th><th className="px-6 py-4">الحالة</th><th className="px-6 py-4">إجراءات</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{subtypes.length === 0 ? <tr><td colSpan={5} className="py-12 text-center text-slate-500 dark:text-slate-400">لا توجد أنواع فرعية بعد</td></tr> : subtypes.map((sub) => <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"><td className="px-6 py-4"><div className="font-bold text-slate-800 dark:text-slate-100"><Link to={`/services/subtypes/${sub.id}`} className="hover:text-primary transition-colors">{sub.name}</Link></div><div className="text-xs text-slate-400 mt-1">{sub.notes || 'بدون ملاحظات'}</div></td><td className="px-6 py-4 font-bold text-primary">{formatCurrency(sub.defaultPrice)}</td><td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{getUnitLabel(sub.unit)}</td><td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${sub.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{sub.isActive ? 'مفعّل' : 'موقوف'}</span></td><td className="px-6 py-4"><div className="flex gap-2 justify-center"><Link to={`/services/subtypes/${sub.id}`} className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg transition-colors" title="عرض الملف"><span className="material-symbols-outlined text-xl">visibility</span></Link><button onClick={() => { setEditingSubtype(sub); setIsSubtypeOpen(true); }} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="تعديل"><span className="material-symbols-outlined text-xl">edit</span></button></div></td></tr>)}</tbody></table></div></div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"><div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-4"><div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"><div><h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">سجل الاستخدام</h3><p className="text-sm text-slate-500 dark:text-slate-400">بحث في استعمال هذه الخدمة داخل الطلبات والفواتير.</p></div><div className="text-sm text-slate-500 dark:text-slate-400">{filteredHistory.length} نتيجة من أصل {history.length}</div></div><div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"><div className="relative xl:col-span-2"><div className="absolute inset-y-0 right-0 py-2.5 pr-3 pointer-events-none text-slate-400"><span className="material-symbols-outlined text-xl">search</span></div><input type="text" className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400 dark:text-slate-100" placeholder="ابحث في سجل الاستخدام..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | ServiceHistoryType)} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-shadow"><option value="all">كل الأنواع</option><option value="order">الطلبيات</option><option value="invoice">الفواتير</option></select></div></div><div className="overflow-x-auto"><table className="w-full text-right min-w-[840px]"><thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase"><tr><th className="px-6 py-4">المعاملة</th><th className="px-6 py-4">النوع</th><th className="px-6 py-4">التاريخ</th><th className="px-6 py-4">الكمية</th><th className="px-6 py-4">القيمة</th><th className="px-6 py-4">الحالة</th><th className="px-6 py-4">التفاصيل</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{filteredHistory.length === 0 ? <tr><td colSpan={7} className="py-14 text-center text-slate-500 dark:text-slate-400">لا توجد نتائج مطابقة</td></tr> : filteredHistory.map((item) => <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"><td className="px-6 py-4"><div className="font-bold text-slate-800 dark:text-slate-100">{item.title}</div><div className="text-xs text-slate-400 mt-1">{item.reference}</div></td><td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${item.type === 'order' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-primary/10 text-primary'}`}>{item.type === 'order' ? 'طلبية' : 'فاتورة'}</span></td><td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{formatDate(item.date)}</td><td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">{item.quantity}</td><td className="px-6 py-4 font-bold text-primary">{formatCurrency(item.amount)}</td><td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{item.statusLabel}</span></td><td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{item.details}</td></tr>)}</tbody></table></div></div>
      </div>
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title={`تعديل الخدمة: ${category.name}`}>
        <ServiceCategoryForm category={category as ServiceCategory} onSuccess={() => setIsEditOpen(false)} onCancel={() => setIsEditOpen(false)} />
      </Modal>
      <Modal isOpen={isSubtypeOpen} onClose={() => setIsSubtypeOpen(false)} title={editingSubtype ? `تعديل النوع: ${editingSubtype.name}` : 'إضافة نوع فرعي جديد'}>
        <ServiceSubtypeForm categoryId={category.id} subtype={editingSubtype} onSuccess={() => setIsSubtypeOpen(false)} onCancel={() => setIsSubtypeOpen(false)} />
      </Modal>
    </>
  );
};