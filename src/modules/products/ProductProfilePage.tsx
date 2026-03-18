import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { Modal } from '../../shared/components/Modal';
import { ProductForm } from './ProductForm';
import { formatCurrency, formatDate, getUnitLabel } from '../../core/utils/formatters';
import type { Invoice, InventoryItem, Order, Product, StockMovement } from '../../core/types';

type ProductHistoryType = 'order' | 'invoice' | 'movement';

interface ProductHistoryItem {
  id: string;
  type: ProductHistoryType;
  title: string;
  reference: string;
  date: string;
  createdAt: number;
  quantity: number;
  amount: number;
  statusLabel: string;
  details: string;
  icon: string;
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

const getMovementStatusLabel = (type: StockMovement['type']) => {
  switch (type) {
    case 'in':
      return 'إدخال';
    case 'out':
      return 'إخراج';
    case 'adjustment':
      return 'تسوية';
    default:
      return type;
  }
};

const getTypeLabel = (type: ProductHistoryType) => {
  switch (type) {
    case 'order':
      return 'طلبية';
    case 'invoice':
      return 'فاتورة';
    case 'movement':
      return 'حركة مخزون';
    default:
      return type;
  }
};

const getTypeBadgeClass = (type: ProductHistoryType) => {
  switch (type) {
    case 'order':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'invoice':
      return 'bg-primary/10 text-primary';
    case 'movement':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
};

export const ProductProfilePage = () => {
  const { productId = '' } = useParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ProductHistoryType>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);

  const profile = useLiveQuery(async () => {
    if (!productId) return null;

    const product = await db.products.get(productId);
    if (!product) {
      return {
        product: null,
        inventoryItem: null as InventoryItem | null,
        movements: [] as StockMovement[],
        orderUsage: [] as ProductHistoryItem[],
        invoiceUsage: [] as ProductHistoryItem[],
      };
    }

    const inventoryItem = product.inventoryItemId ? (await db.inventory.get(product.inventoryItemId)) ?? null : null;
    const movements = product.inventoryItemId
      ? await db.stockMovements.where('itemId').equals(product.inventoryItemId).toArray()
      : [];

    const [orderItems, invoiceItems] = await Promise.all([
      db.orderItems.where('itemId').equals(productId).toArray(),
      db.invoiceItems.where('itemId').equals(productId).toArray(),
    ]);

    const productOrderItems = orderItems.filter((item) => item.type === 'product');
    const productInvoiceItems = invoiceItems.filter((item) => item.type === 'product');

    const orderUsage = await Promise.all(productOrderItems.map(async (item) => {
      const order = await db.orders.get(item.orderId);
      const customer = order ? await db.customers.get(order.customerId) : null;
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
        details: item.description || 'استخدام المنتج داخل طلبية',
        icon: 'shopping_bag',
      } : null;
    }));

    const invoiceUsage = await Promise.all(productInvoiceItems.map(async (item) => {
      const invoice = await db.invoices.get(item.invoiceId);
      const customer = invoice ? await db.customers.get(invoice.customerId) : null;
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
        details: 'بيع المنتج ضمن فاتورة',
        icon: 'receipt_long',
      } : null;
    }));

    return {
      product,
      inventoryItem,
      movements,
      orderUsage: orderUsage.filter(Boolean) as ProductHistoryItem[],
      invoiceUsage: invoiceUsage.filter(Boolean) as ProductHistoryItem[],
    };
  }, [productId]);

  if (profile === undefined) {
    return <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center text-slate-500 dark:text-slate-400">جاري تحميل ملف المنتج...</div>;
  }

  if (!profile || !profile.product) {
    return (
      <div className="space-y-6">
        <Link to="/products" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          العودة إلى المنتجات
        </Link>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center">
          <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 block mb-3">inventory_2</span>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">المنتج غير موجود</h2>
          <p className="text-slate-500 dark:text-slate-400">قد يكون تم حذف المنتج أو أن الرابط غير صحيح.</p>
        </div>
      </div>
    );
  }

  const { product, inventoryItem, movements, orderUsage, invoiceUsage } = profile;
  const movementHistory: ProductHistoryItem[] = movements.map((movement) => ({
    id: `movement-${movement.id}`,
    type: 'movement' as const,
    title: `حركة ${getMovementStatusLabel(movement.type)}`,
    reference: movement.referenceId ? `REF-${movement.referenceId.slice(0, 6)}` : 'بدون مرجع',
    date: movement.date,
    createdAt: movement.createdAt,
    quantity: movement.quantity,
    amount: 0,
    statusLabel: getMovementStatusLabel(movement.type),
    details: movement.notes || 'حركة على صنف المخزون المرتبط',
    icon: 'sync_alt',
  }));

  const history = [...orderUsage, ...invoiceUsage, ...movementHistory].sort((a, b) => b.createdAt - a.createdAt);
  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredHistory = history.filter((item) => {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    if (dateFrom && new Date(item.date) < new Date(dateFrom)) return false;
    if (dateTo && new Date(item.date) > new Date(`${dateTo}T23:59:59`)) return false;
    if (!normalizedSearch) return true;

    return [item.title, item.reference, item.statusLabel, item.details, getTypeLabel(item.type)]
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch);
  });

  const totalOrderQty = orderUsage.reduce((sum, item) => sum + item.quantity, 0);
  const totalInvoiceQty = invoiceUsage.reduce((sum, item) => sum + item.quantity, 0);
  const totalSalesValue = invoiceUsage.reduce((sum, item) => sum + item.amount, 0);

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-3">
            <Link to="/products" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              العودة إلى المنتجات
            </Link>
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-3xl">widgets</span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-1.5">
                  <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">{product.name}</h2>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${product.minStock > 0 && product.quantity <= product.minStock ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                    {product.minStock > 0 && product.quantity <= product.minStock ? 'يتطلب متابعة مخزون' : 'وضع مخزون جيد'}
                  </span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm">ملف منتج كامل يشمل الارتباط بالمخزون وسجل الاستخدام داخل الطلبات والفواتير.</p>
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-lg text-slate-400">qr_code_2</span><span dir="ltr">{product.code}</span></div>
                  <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-lg text-slate-400">category</span><span>{product.categoryId || 'بدون تصنيف'}</span></div>
                  <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-lg text-slate-400">straighten</span><span>{getUnitLabel(product.unit)}</span></div>
                  <div className="flex items-center gap-1.5"><span className="material-symbols-outlined text-lg text-slate-400">calendar_month</span><span>أضيف في {formatDate(product.createdAt)}</span></div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setIsEditOpen(true)} className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-xl">edit</span>
              تعديل المنتج
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5"><p className="text-xs text-slate-500 dark:text-slate-400 mb-2">الكمية الحالية</p><p className="text-2xl font-black text-slate-800 dark:text-slate-100">{product.quantity} {getUnitLabel(product.unit)}</p></div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5"><p className="text-xs text-slate-500 dark:text-slate-400 mb-2">سعر البيع</p><p className="text-2xl font-black text-primary">{formatCurrency(product.sellingPrice)}</p></div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5"><p className="text-xs text-slate-500 dark:text-slate-400 mb-2">قيمة المبيعات</p><p className="text-2xl font-black text-emerald-600">{formatCurrency(totalSalesValue)}</p></div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5"><p className="text-xs text-slate-500 dark:text-slate-400 mb-2">استخدامه في الطلبيات</p><p className="text-2xl font-black text-slate-800 dark:text-slate-100">{totalOrderQty}</p></div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5"><p className="text-xs text-slate-500 dark:text-slate-400 mb-2">بيعه في الفواتير</p><p className="text-2xl font-black text-slate-800 dark:text-slate-100">{totalInvoiceQty}</p></div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">البيانات الأساسية</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'سعر التكلفة', value: formatCurrency(product.costPrice) },
                { label: 'حد الإنذار', value: product.minStock > 0 ? `${product.minStock} ${getUnitLabel(product.unit)}` : 'غير محدد' },
                { label: 'صنف المخزون المرتبط', value: inventoryItem?.name || 'لا يوجد ربط' },
                { label: 'كود صنف المخزون', value: inventoryItem?.code || '—' },
              ].map((card) => (
                <div key={card.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{card.label}</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{card.value}</p>
                </div>
              ))}
            </div>
            {product.notes && <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 mt-3"><p className="text-xs text-slate-500 dark:text-slate-400 mb-1">ملاحظات</p><p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{product.notes}</p></div>}
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">ملخص الارتباط بالمخزون</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3"><span className="text-slate-500 dark:text-slate-400">الحركات المرتبطة</span><span className="font-bold text-slate-800 dark:text-slate-100">{movements.length}</span></div>
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3"><span className="text-slate-500 dark:text-slate-400">إجمالي الإدخالات</span><span className="font-bold text-emerald-600">{movements.filter((m) => m.type === 'in').reduce((sum, m) => sum + m.quantity, 0)}</span></div>
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3"><span className="text-slate-500 dark:text-slate-400">إجمالي الإخراجات</span><span className="font-bold text-rose-600">{movements.filter((m) => m.type === 'out').reduce((sum, m) => sum + m.quantity, 0)}</span></div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"><div><h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">السجل المرتبط</h3><p className="text-sm text-slate-500 dark:text-slate-400">بحث وفلترة في الطلبات والفواتير وحركات المخزون المرتبطة بهذا المنتج.</p></div><div className="text-sm text-slate-500 dark:text-slate-400">{filteredHistory.length} نتيجة من أصل {history.length}</div></div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="relative xl:col-span-2"><div className="absolute inset-y-0 right-0 py-2.5 pr-3 pointer-events-none text-slate-400"><span className="material-symbols-outlined text-xl">search</span></div><input type="text" className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400 dark:text-slate-100" placeholder="ابحث في السجل المرتبط..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | ProductHistoryType)} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-shadow"><option value="all">كل الأنواع</option><option value="order">الطلبيات</option><option value="invoice">الفواتير</option><option value="movement">حركات المخزون</option></select>
              <div className="grid grid-cols-2 gap-3"><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-shadow" /><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-shadow" /></div>
            </div>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-right min-w-[900px]"><thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase"><tr><th className="px-6 py-4">الحدث</th><th className="px-6 py-4">النوع</th><th className="px-6 py-4">التاريخ</th><th className="px-6 py-4">الكمية</th><th className="px-6 py-4">القيمة</th><th className="px-6 py-4">الحالة</th><th className="px-6 py-4">التفاصيل</th></tr></thead><tbody className="divide-y divide-slate-100 dark:divide-slate-800">{filteredHistory.length === 0 ? <tr><td colSpan={7} className="py-14 text-center text-slate-500 dark:text-slate-400"><span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-3">manage_search</span>لا توجد نتائج مطابقة</td></tr> : filteredHistory.map((item) => <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors align-top"><td className="px-6 py-4"><div className="flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-xl">{item.icon}</span></div><div><div className="font-bold text-slate-800 dark:text-slate-100">{item.title}</div><div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.reference}</div></div></div></td><td className="px-6 py-4"><span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getTypeBadgeClass(item.type)}`}>{getTypeLabel(item.type)}</span></td><td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 font-medium">{formatDate(item.date)}</td><td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">{item.quantity}</td><td className="px-6 py-4 font-bold text-primary">{item.amount > 0 ? formatCurrency(item.amount) : '—'}</td><td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{item.statusLabel}</span></td><td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 leading-6">{item.details}</td></tr>)}</tbody></table></div>
        </div>
      </div>
      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title={`تعديل المنتج: ${product.name}`} width="lg">
        <ProductForm product={product as Product} onSuccess={() => setIsEditOpen(false)} onCancel={() => setIsEditOpen(false)} />
      </Modal>
    </>
  );
};