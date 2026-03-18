import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { Modal } from '../../shared/components/Modal';
import { Button } from '../../shared/components/Button';
import { formatCurrency, formatDate, generateId } from '../../core/utils/formatters';
import type { AppSettings, Payment, Purchase, Supplier } from '../../core/types';

type TransactionType = 'purchase' | 'payment';
type TransactionState = 'open' | 'settled' | 'payment';

interface SupplierTransaction {
  id: string;
  type: TransactionType;
  state: TransactionState;
  title: string;
  reference: string;
  date: string;
  createdAt: number;
  total: number;
  paid: number;
  remaining: number;
  statusLabel: string;
  details: string;
  icon: string;
}

const PAYMENT_METHODS = ['نقداً', 'تحويل بنكي', 'شيك', 'دفع إلكتروني', 'أخرى'];
const fieldClass =
  'w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-shadow';

const defaultSettings = (): AppSettings => ({
  id: 'MASTER',
  workshopName: 'ورشة الألمنيوم',
  phone: '',
  address: '',
  invoiceFooterText: '',
  currency: 'MRU',
  orderNumberSequence: 0,
  invoiceNumberSequence: 0,
  purchaseNumberSequence: 0,
});

const getTypeLabel = (type: TransactionType) => {
  switch (type) {
    case 'purchase':
      return 'مشتريات';
    case 'payment':
      return 'دفعة';
    default:
      return type;
  }
};

const getTypeBadgeClass = (type: TransactionType) => {
  switch (type) {
    case 'purchase':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'payment':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
};

const getStateBadgeClass = (state: TransactionState) => {
  switch (state) {
    case 'open':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
    case 'settled':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'payment':
      return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400';
    default:
      return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
};

const DirectSupplierPaymentModal = ({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('نقداً');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const paid = parseFloat(amount);
    if (isNaN(paid) || paid <= 0) {
      setError('أدخل مبلغاً صحيحاً');
      return;
    }

    setBusy(true);
    try {
      await db.transaction('rw', [db.payments, db.suppliers], async () => {
        await db.payments.add({
          id: generateId(),
          entityType: 'supplier',
          entityId: supplier.id,
          amount: paid,
          date: new Date().toISOString().slice(0, 10),
          paymentMethod: method,
          notes: notes || 'دفعة مباشرة من صفحة المورد',
          createdAt: Date.now(),
        });

        await db.suppliers.update(supplier.id, {
          balance: Math.max(0, supplier.balance - paid),
        });
      });

      onClose();
    } catch (saveError) {
      console.error(saveError);
      setError('تعذر تسجيل الدفعة');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">المورد</p>
          <p className="font-bold text-slate-800 dark:text-slate-100">{supplier.name}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">الرصيد الحالي</p>
          <p className="font-bold text-rose-600">{formatCurrency(supplier.balance)}</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">مبلغ السداد *</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setError('');
          }}
          className={fieldClass}
          dir="ltr"
          autoFocus
          placeholder="0.00"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">طريقة الدفع</label>
        <select value={method} onChange={(event) => setMethod(event.target.value)} className={fieldClass}>
          {PAYMENT_METHODS.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">ملاحظات</label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className={fieldClass}
          placeholder="مثال: تسوية رصيد مواد خام"
        />
      </div>

      {error && <p className="text-sm text-rose-500">{error}</p>}

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button type="button" variant="primary" isLoading={busy} onClick={handleSave} icon="payments">تسجيل الدفعة</Button>
      </div>
    </div>
  );
};

const DirectSupplierDebtModal = ({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) => {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    const debt = parseFloat(amount);
    if (isNaN(debt) || debt <= 0) {
      setError('أدخل مبلغاً صحيحاً');
      return;
    }

    setBusy(true);
    try {
      await db.transaction('rw', [db.purchases, db.suppliers, db.settings], async () => {
        const settings = (await db.settings.get('MASTER')) ?? defaultSettings();
        const nextPurchaseNumber = (settings.purchaseNumberSequence ?? 0) + 1;

        await db.settings.put({
          ...settings,
          purchaseNumberSequence: nextPurchaseNumber,
        });

        await db.purchases.add({
          id: generateId(),
          purchaseNumber: nextPurchaseNumber,
          supplierId: supplier.id,
          date: new Date().toISOString().slice(0, 10),
          total: debt,
          paid: 0,
          remaining: debt,
          notes: notes || 'دين مباشر مسجل من صفحة المورد',
          createdAt: Date.now(),
        });

        await db.suppliers.update(supplier.id, {
          balance: supplier.balance + debt,
        });
      });

      onClose();
    } catch (saveError) {
      console.error(saveError);
      setError('تعذر تسجيل الدين');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">المورد</p>
          <p className="font-bold text-slate-800 dark:text-slate-100">{supplier.name}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">الرصيد الحالي</p>
          <p className="font-bold text-rose-600">{formatCurrency(supplier.balance)}</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">قيمة الدين *</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setError('');
          }}
          className={fieldClass}
          dir="ltr"
          autoFocus
          placeholder="0.00"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">بيان الدين</label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={3}
          className={fieldClass}
          placeholder="مثال: توريد مواد خام أو رصيد مرحل"
        />
      </div>

      {error && <p className="text-sm text-rose-500">{error}</p>}

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
        <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button type="button" variant="danger" isLoading={busy} onClick={handleSave} icon="post_add">تسجيل الدين</Button>
      </div>
    </div>
  );
};

export const SupplierProfilePage = () => {
  const { supplierId = '' } = useParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all');
  const [stateFilter, setStateFilter] = useState<'all' | TransactionState>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isDebtOpen, setIsDebtOpen] = useState(false);

  const profile = useLiveQuery(async () => {
    if (!supplierId) return null;

    const supplier = await db.suppliers.get(supplierId);
    if (!supplier) {
      return {
        supplier: null,
        purchases: [] as Purchase[],
        payments: [] as Payment[],
      };
    }

    const [purchases, payments] = await Promise.all([
      db.purchases.where('supplierId').equals(supplierId).toArray(),
      db.payments.where('entityId').equals(supplierId).toArray(),
    ]);

    return { supplier, purchases, payments };
  }, [supplierId]);

  if (profile === undefined) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center text-slate-500 dark:text-slate-400">
        جاري تحميل ملف المورد...
      </div>
    );
  }

  if (!profile || !profile.supplier) {
    return (
      <div className="space-y-6">
        <Link to="/suppliers" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          العودة إلى الموردين
        </Link>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center">
          <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-700 block mb-3">inventory_2</span>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">المورد غير موجود</h2>
          <p className="text-slate-500 dark:text-slate-400">قد يكون تم حذف هذا المورد أو أن الرابط غير صحيح.</p>
        </div>
      </div>
    );
  }

  const { supplier, purchases, payments } = profile;

  const transactions: SupplierTransaction[] = [
    ...purchases.map((purchase) => ({
      id: `purchase-${purchase.id}`,
      type: 'purchase' as const,
      state: purchase.remaining > 0 ? 'open' as const : 'settled' as const,
      title: `مشتريات #${purchase.purchaseNumber}`,
      reference: `PUR-${purchase.purchaseNumber}`,
      date: purchase.date,
      createdAt: purchase.createdAt,
      total: purchase.total,
      paid: purchase.paid,
      remaining: purchase.remaining,
      statusLabel: purchase.remaining > 0 ? 'مفتوح' : 'مسدد',
      details: purchase.notes || 'عملية شراء من المورد',
      icon: 'receipt_long',
    })),
    ...payments.map((payment) => ({
      id: `payment-${payment.id}`,
      type: 'payment' as const,
      state: 'payment' as const,
      title: payment.referenceId ? 'دفعة مرتبطة بمشتريات' : 'دفعة مباشرة على الحساب',
      reference: payment.referenceId ? `PAY-${payment.referenceId.slice(0, 6)}` : 'PAY-DIRECT',
      date: payment.date,
      createdAt: payment.createdAt,
      total: payment.amount,
      paid: payment.amount,
      remaining: 0,
      statusLabel: payment.paymentMethod || 'دفعة مسجلة',
      details: payment.notes || 'سداد للمورد',
      icon: 'payments',
    })),
  ].sort((first, second) => second.createdAt - first.createdAt);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredTransactions = transactions.filter((transaction) => {
    if (typeFilter !== 'all' && transaction.type !== typeFilter) return false;
    if (stateFilter !== 'all' && transaction.state !== stateFilter) return false;
    if (dateFrom && new Date(transaction.date) < new Date(dateFrom)) return false;
    if (dateTo && new Date(transaction.date) > new Date(`${dateTo}T23:59:59`)) return false;
    if (!normalizedSearch) return true;

    const haystack = [
      transaction.title,
      transaction.reference,
      transaction.statusLabel,
      transaction.details,
      getTypeLabel(transaction.type),
    ].join(' ').toLowerCase();

    return haystack.includes(normalizedSearch);
  });

  const totalPurchases = purchases.reduce((sum, purchase) => sum + purchase.total, 0);
  const totalPayments = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const openPurchases = purchases.filter((purchase) => purchase.remaining > 0).length;
  const settledPurchases = purchases.filter((purchase) => purchase.remaining <= 0).length;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-3">
            <Link to="/suppliers" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-primary transition-colors">
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              العودة إلى الموردين
            </Link>

            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl font-black shrink-0">
                {supplier.name.charAt(0)}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3 mb-1.5">
                  <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100">{supplier.name}</h2>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${supplier.balance > 0 ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                    {supplier.balance > 0 ? 'له رصيد مستحق' : 'رصيده مسدد'}
                  </span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-sm">ملف مورد كامل يشمل سجل المشتريات والدفعات والديون المستحقة عليه.</p>
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-lg text-slate-400">call</span>
                    <span dir="ltr">{supplier.phone}</span>
                  </div>
                  {supplier.address && (
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-lg text-slate-400">location_on</span>
                      <span>{supplier.address}</span>
                    </div>
                  )}
                  {supplier.supplyType && (
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-lg text-slate-400">category</span>
                      <span>{supplier.supplyType}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-lg text-slate-400">calendar_month</span>
                    <span>مورد منذ {formatDate(supplier.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="danger" icon="post_add" onClick={() => setIsDebtOpen(true)}>
              تسجيل دين
            </Button>
            <Button type="button" variant="primary" icon="payments" onClick={() => setIsPaymentOpen(true)}>
              تسجيل سداد
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">الرصيد الحالي</p>
            <p className={`text-2xl font-black ${supplier.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(supplier.balance)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">إجمالي المشتريات</p>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{formatCurrency(totalPurchases)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">إجمالي السداد</p>
            <p className="text-2xl font-black text-emerald-600">{formatCurrency(totalPayments)}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">مشتريات مفتوحة</p>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{openPurchases}</p>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">مشتريات مسددة</p>
            <p className="text-2xl font-black text-slate-800 dark:text-slate-100">{settledPurchases}</p>
            <p className="text-xs text-slate-400 mt-1">من أصل {purchases.length} عملية شراء</p>
          </div>
        </div>

        {supplier.notes && (
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-amber-500">sticky_note_2</span>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-1">ملاحظات المورد</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-7">{supplier.notes}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">سجل المعاملات</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">فلترة وبحث مباشر في مشتريات المورد والدفعات المسجلة عليه.</p>
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {filteredTransactions.length} نتيجة من أصل {transactions.length}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
              <div className="relative xl:col-span-2">
                <div className="absolute inset-y-0 right-0 py-2.5 pr-3 pointer-events-none text-slate-400">
                  <span className="material-symbols-outlined text-xl">search</span>
                </div>
                <input
                  type="text"
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400 dark:text-slate-100"
                  placeholder="ابحث بالرقم أو الملاحظات أو نوع المعاملة..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | TransactionType)} className={fieldClass}>
                <option value="all">كل الأنواع</option>
                <option value="purchase">المشتريات</option>
                <option value="payment">الدفعات</option>
              </select>

              <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value as 'all' | TransactionState)} className={fieldClass}>
                <option value="all">كل الحالات</option>
                <option value="open">مفتوحة</option>
                <option value="settled">مسددة</option>
                <option value="payment">دفعات</option>
              </select>

              <div className="grid grid-cols-2 gap-3 xl:col-span-1">
                <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className={fieldClass} />
                <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className={fieldClass} />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right min-w-[920px]">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">
                <tr>
                  <th className="px-6 py-4">المعاملة</th>
                  <th className="px-6 py-4">النوع</th>
                  <th className="px-6 py-4">التاريخ</th>
                  <th className="px-6 py-4">الإجمالي</th>
                  <th className="px-6 py-4">المسدّد</th>
                  <th className="px-6 py-4">المتبقي</th>
                  <th className="px-6 py-4">الحالة</th>
                  <th className="px-6 py-4">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredTransactions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-14 text-center text-slate-500 dark:text-slate-400">
                      <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-3">manage_search</span>
                      لا توجد نتائج مطابقة للفلاتر الحالية
                    </td>
                  </tr>
                )}

                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors align-top">
                    <td className="px-6 py-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-xl">{transaction.icon}</span>
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-100">{transaction.title}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{transaction.reference}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getTypeBadgeClass(transaction.type)}`}>
                        {getTypeLabel(transaction.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 font-medium">{formatDate(transaction.date)}</td>
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-100">{formatCurrency(transaction.total)}</td>
                    <td className="px-6 py-4 font-bold text-emerald-600">{formatCurrency(transaction.paid)}</td>
                    <td className="px-6 py-4">
                      {transaction.remaining > 0 ? (
                        <span className="font-bold text-rose-600">{formatCurrency(transaction.remaining)}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-2">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${getStateBadgeClass(transaction.state)}`}>
                          {transaction.statusLabel}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400 leading-6">{transaction.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} title={`تسجيل سداد للمورد ${supplier.name}`}>
        <DirectSupplierPaymentModal supplier={supplier} onClose={() => setIsPaymentOpen(false)} />
      </Modal>

      <Modal isOpen={isDebtOpen} onClose={() => setIsDebtOpen(false)} title={`تسجيل دين على المورد ${supplier.name}`}>
        <DirectSupplierDebtModal supplier={supplier} onClose={() => setIsDebtOpen(false)} />
      </Modal>
    </>
  );
};