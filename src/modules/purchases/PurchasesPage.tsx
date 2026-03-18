import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { Modal } from '../../shared/components/Modal';
import { Button } from '../../shared/components/Button';
import { PurchaseForm } from './PurchaseForm';
import { formatCurrency, formatDate, generateId } from '../../core/utils/formatters';
import { Purchase, PurchaseItem, Payment } from '../../core/types';

// ─── Payment Modal ────────────────────────────────────────────────────────────
interface PaymentModalProps {
  purchase: Purchase;
  supplierName: string;
  onClose: () => void;
}
const PurchasePaymentModal = ({ purchase, supplierName, onClose }: PaymentModalProps) => {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState('نقداً');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { alert('أدخل مبلغاً صحيحاً'); return; }
    if (amt > purchase.remaining) { alert('المبلغ أكبر من المتبقي للفاتورة'); return; }
    setSaving(true);
    try {
      await db.transaction('rw', db.payments, db.purchases, db.suppliers, async () => {
        await db.payments.add({
          id: generateId(),
          entityType: 'supplier',
          entityId: purchase.supplierId,
          amount: amt,
          date,
          paymentMethod: method,
          referenceId: purchase.id,
          notes,
          createdAt: Date.now(),
        } as Payment);

        const newPurchaseRemaining = Math.max(0, purchase.remaining - amt);
        await db.purchases.update(purchase.id, {
          paid: purchase.paid + amt,
          remaining: newPurchaseRemaining,
        });

        const supplier = await db.suppliers.get(purchase.supplierId);
        if (supplier) {
          await db.suppliers.update(purchase.supplierId, {
            balance: Math.max(0, supplier.balance - amt),
          });
        }
      });
      onClose();
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء تسجيل الدفعة');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-sm space-y-1">
        <div className="text-slate-600 dark:text-slate-300">المورد: <span className="font-bold">{supplierName}</span></div>
        <div className="text-slate-600 dark:text-slate-300">فاتورة: <span className="font-bold">#{purchase.purchaseNumber}</span></div>
        <div className="text-amber-700 dark:text-amber-300 font-bold">المتبقي: {formatCurrency(purchase.remaining)}</div>
      </div>

      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">المبلغ المدفوع *</label>
        <input
          type="number" min="0" step="0.01"
          value={amount} onChange={e => setAmount(e.target.value)}
          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">التاريخ</label>
          <input
            type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">طريقة الدفع</label>
          <select
            value={method} onChange={e => setMethod(e.target.value)}
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option>نقداً</option>
            <option>تحويل بنكي</option>
            <option>شيك</option>
          </select>
        </div>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">ملاحظات</label>
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[60px]"
        />
      </div>
      <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
        <Button variant="ghost" onClick={onClose}>إلغاء</Button>
        <Button onClick={handleSave} isLoading={saving} icon="payments">تسجيل الدفعة</Button>
      </div>
    </div>
  );
};

// ─── Detail Modal ─────────────────────────────────────────────────────────────
interface DetailModalProps {
  purchase: Purchase;
  supplierName: string;
  onClose: () => void;
}
const PurchaseDetailModal = ({ purchase, supplierName, onClose }: DetailModalProps) => {
  const items = useLiveQuery(
    () => db.purchaseItems.where('purchaseId').equals(purchase.id).toArray(),
    [purchase.id]
  ) ?? [];

  const handlePrint = async () => {
    const settings = await db.settings.toCollection().first();
    const workshopName = settings?.workshopName ?? 'الورشة';
    const currency = settings?.currency ?? 'د.ج';

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>سجل شراء #${purchase.purchaseNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; direction: rtl; padding: 20px; font-size: 13px; color: #1e293b; }
  h1 { font-size: 20px; text-align: center; margin-bottom: 4px; color: #1e40af; }
  .sub { text-align: center; color: #64748b; margin-bottom: 16px; font-size: 12px; }
  .meta { display: flex; gap: 20px; flex-wrap: wrap; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px; font-size: 13px; }
  .meta div { margin-left: 20px; }
  .meta span { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #1e40af; color: #fff; padding: 8px 10px; text-align: right; font-size: 12px; }
  td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .totals { display: grid; gap: 4px; max-width: 280px; margin-right: auto; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; }
  .totals div { display: flex; justify-content: space-between; font-size: 13px; }
  .totals .balance { font-weight: bold; font-size: 14px; border-top: 1px solid #e2e8f0; padding-top: 6px; margin-top: 4px; color: #dc2626; }
  .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #94a3b8; }
</style>
</head>
<body>
<h1>${workshopName}</h1>
<div class="sub">سجل شراء رقم #${purchase.purchaseNumber}</div>
<div class="meta">
  <div>المورد: <span>${supplierName}</span></div>
  <div>التاريخ: <span>${new Date(purchase.date).toLocaleDateString('ar-DZ')}</span></div>
  ${purchase.notes ? `<div>ملاحظات: <span>${purchase.notes}</span></div>` : ''}
</div>
<table>
  <thead>
    <tr><th>#</th><th>الصنف</th><th>الكمية</th><th>سعر الشراء</th><th>الإجمالي</th></tr>
  </thead>
  <tbody>
    ${items.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>${item.unitPrice.toFixed(2)} ${currency}</td>
        <td><strong>${item.lineTotal.toFixed(2)} ${currency}</strong></td>
      </tr>`).join('')}
  </tbody>
</table>
<div class="totals">
  <div><span>الإجمالي</span><span>${purchase.total.toFixed(2)} ${currency}</span></div>
  <div><span>المدفوع</span><span style="color:#16a34a">${purchase.paid.toFixed(2)} ${currency}</span></div>
  <div class="balance"><span>المتبقي</span><span>${purchase.remaining.toFixed(2)} ${currency}</span></div>
</div>
<div class="footer">${workshopName} — سجل شراء #${purchase.purchaseNumber}</div>
</body></html>`;

    const win = window.open('', '_blank', 'width=800,height=800');
    if (!win) { alert('يرجى السماح بالنوافذ المنبثقة'); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          المورد: <span className="font-bold text-slate-800 dark:text-slate-100">{supplierName}</span>
          {' — '}{formatDate(purchase.date)}
        </div>
        <Button variant="outline" size="sm" icon="print" onClick={handlePrint}>طباعة</Button>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-right text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 font-bold">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">الصنف</th>
              <th className="px-3 py-2">الكمية</th>
              <th className="px-3 py-2">سعر الشراء</th>
              <th className="px-3 py-2">الإجمالي</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.length === 0 ? (
              <tr><td colSpan={5} className="py-4 text-center text-slate-400">لا توجد أصناف</td></tr>
            ) : items.map((item, i) => (
              <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                <td className="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">{item.name}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{item.quantity}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{formatCurrency(item.unitPrice)}</td>
                <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100">{formatCurrency(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 space-y-2 text-sm max-w-xs mr-auto">
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">الإجمالي</span>
          <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(purchase.total)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500 dark:text-slate-400">المدفوع</span>
          <span className="font-bold text-emerald-600">{formatCurrency(purchase.paid)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
          <span className="font-bold text-slate-700 dark:text-slate-200">المتبقي</span>
          <span className={`font-bold text-base ${purchase.remaining > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
            {formatCurrency(purchase.remaining)}
          </span>
        </div>
      </div>

      {purchase.notes && (
        <div className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
          <span className="font-medium">ملاحظات: </span>{purchase.notes}
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="ghost" onClick={onClose}>إغلاق</Button>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const PurchasesPage = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<(Purchase & { items: PurchaseItem[] }) | undefined>();
  const [paymentPurchase, setPaymentPurchase] = useState<Purchase | undefined>();
  const [detailPurchase, setDetailPurchase] = useState<Purchase | undefined>();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSupplierId, setFilterSupplierId] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const purchases = useLiveQuery(() =>
    db.purchases.orderBy('createdAt').reverse().toArray()
  , []);

  const suppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray(), []);
  const supplierMap = Object.fromEntries((suppliers ?? []).map(s => [s.id, s]));

  const filtered = purchases?.filter(p => {
    const supplier = supplierMap[p.supplierId];
    const matchesSearch = !searchTerm ||
      `#${p.purchaseNumber}`.includes(searchTerm) ||
      (supplier?.name ?? '').includes(searchTerm) ||
      (p.notes ?? '').includes(searchTerm);
    const matchesSupplier = !filterSupplierId || p.supplierId === filterSupplierId;
    const matchesFrom = !filterDateFrom || p.date >= filterDateFrom;
    const matchesTo = !filterDateTo || p.date <= filterDateTo;
    return matchesSearch && matchesSupplier && matchesFrom && matchesTo;
  });

  const totalPurchases = purchases?.reduce((s, p) => s + p.total, 0) ?? 0;
  const totalRemaining = purchases?.reduce((s, p) => s + p.remaining, 0) ?? 0;
  const pendingCount = purchases?.filter(p => p.remaining > 0).length ?? 0;

  const clearFilters = () => {
    setSearchTerm('');
    setFilterSupplierId('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const handleEdit = async (purchase: Purchase) => {
    const items = await db.purchaseItems.where('purchaseId').equals(purchase.id).toArray();
    setEditingPurchase({ ...purchase, items });
    setIsFormOpen(true);
  };

  const handleDelete = async (purchase: Purchase) => {
    if (purchase.paid > 0) {
      alert('لا يمكن حذف عملية شراء تم دفع جزء منها');
      return;
    }
    if (!window.confirm(`هل أنت متأكد من حذف الشراء #${purchase.purchaseNumber}؟`)) return;

    try {
      await db.transaction('rw', db.purchases, db.purchaseItems, db.inventory, db.suppliers, async () => {
        const items = await db.purchaseItems.where('purchaseId').equals(purchase.id).toArray();
        // Reverse inventory
        for (const item of items) {
          if (item.itemId) {
            const inv = await db.inventory.get(item.itemId);
            if (inv) await db.inventory.update(item.itemId, { quantity: Math.max(0, inv.quantity - item.quantity) });
          }
        }
        await db.purchaseItems.where('purchaseId').equals(purchase.id).delete();

        // Reverse supplier balance
        if (purchase.remaining > 0) {
          const supplier = await db.suppliers.get(purchase.supplierId);
          if (supplier) {
            await db.suppliers.update(purchase.supplierId, {
              balance: Math.max(0, supplier.balance - purchase.remaining),
            });
          }
        }
        await db.purchases.delete(purchase.id);
      });
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء الحذف');
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">receipt_long</span>
            إدارة المشتريات
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">تسجيل المشتريات من الموردين وتتبع الديون والمدفوعات</p>
        </div>
        <button
          onClick={() => { setEditingPurchase(undefined); setIsFormOpen(true); }}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-xl">add_shopping_cart</span>
          تسجيل عملية شراء
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-2xl">receipt_long</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{purchases?.length ?? 0}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">عمليات الشراء</div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-slate-500 text-2xl">payments</span>
          </div>
          <div>
            <div className="text-base font-bold text-slate-800 dark:text-slate-100">{formatCurrency(totalPurchases)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">إجمالي المشتريات</div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-rose-500 text-2xl">account_balance</span>
          </div>
          <div>
            <div className="text-base font-bold text-rose-600 dark:text-rose-400">{formatCurrency(totalRemaining)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">ديون للموردين ({pendingCount})</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <div className="relative">
              <div className="absolute inset-y-0 right-0 py-2.5 pr-3 pointer-events-none text-slate-400">
                <span className="material-symbols-outlined text-xl">search</span>
              </div>
              <input
                type="text"
                placeholder="بحث برقم الشراء، المورد، أو ملاحظات..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 dark:text-slate-100"
              />
            </div>
          </div>
          <div>
            <select
              value={filterSupplierId}
              onChange={e => setFilterSupplierId(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">جميع الموردين</option>
              {(suppliers ?? []).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">من تاريخ</label>
            <input
              type="date" value={filterDateFrom}
              onChange={e => setFilterDateFrom(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">إلى تاريخ</label>
            <input
              type="date" value={filterDateTo}
              onChange={e => setFilterDateTo(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {(searchTerm || filterSupplierId || filterDateFrom || filterDateTo) && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">filter_alt_off</span>
              مسح الفلاتر
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">
              <tr>
                <th className="px-5 py-4">رقم الشراء</th>
                <th className="px-5 py-4">المورد</th>
                <th className="px-5 py-4">التاريخ</th>
                <th className="px-5 py-4">الإجمالي</th>
                <th className="px-5 py-4">المدفوع</th>
                <th className="px-5 py-4">المتبقي</th>
                <th className="px-5 py-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!filtered && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">جاري التحميل...</td></tr>
              )}
              {filtered && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-3">receipt_long</span>
                    <p>لا توجد عمليات شراء مسجلة</p>
                  </td>
                </tr>
              )}
              {filtered && filtered.map(purchase => {
                const supplier = supplierMap[purchase.supplierId];
                return (
                  <tr key={purchase.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-5 py-4">
                      <span className="font-bold text-primary">#{purchase.purchaseNumber}</span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-800 dark:text-slate-100">
                        {supplier?.name ?? <span className="text-slate-400">—</span>}
                      </div>
                      {supplier?.phone && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <span className="material-symbols-outlined text-xs">call</span>
                          <span dir="ltr">{supplier.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {formatDate(purchase.date)}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-800 dark:text-slate-100">
                      {formatCurrency(purchase.total)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {formatCurrency(purchase.paid)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {purchase.remaining > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">warning</span>
                          {formatCurrency(purchase.remaining)}
                        </span>
                      ) : (
                        <span className="text-emerald-600 flex items-center gap-1 text-sm">
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          مسدد
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-center items-center gap-1">
                        <button
                          onClick={() => setDetailPurchase(purchase)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="عرض التفاصيل"
                        >
                          <span className="material-symbols-outlined text-xl">visibility</span>
                        </button>
                        {purchase.remaining > 0 && (
                          <button
                            onClick={() => setPaymentPurchase(purchase)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                            title="تسجيل دفعة"
                          >
                            <span className="material-symbols-outlined text-xl">payments</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(purchase)}
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                          title="تعديل"
                        >
                          <span className="material-symbols-outlined text-xl">edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(purchase)}
                          className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                          title="حذف"
                        >
                          <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Purchase Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingPurchase ? `تعديل الشراء #${editingPurchase.purchaseNumber}` : 'تسجيل عملية شراء جديدة'}
        width="xl"
      >
        <PurchaseForm
          purchase={editingPurchase}
          onSuccess={() => setIsFormOpen(false)}
          onCancel={() => setIsFormOpen(false)}
        />
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={!!paymentPurchase}
        onClose={() => setPaymentPurchase(undefined)}
        title={`تسجيل دفعة — شراء #${paymentPurchase?.purchaseNumber ?? ''}`}
        width="sm"
      >
        {paymentPurchase && (
          <PurchasePaymentModal
            purchase={paymentPurchase}
            supplierName={supplierMap[paymentPurchase.supplierId]?.name ?? '—'}
            onClose={() => setPaymentPurchase(undefined)}
          />
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={!!detailPurchase}
        onClose={() => setDetailPurchase(undefined)}
        title={`تفاصيل الشراء #${detailPurchase?.purchaseNumber ?? ''}`}
        width="lg"
      >
        {detailPurchase && (
          <PurchaseDetailModal
            purchase={detailPurchase}
            supplierName={supplierMap[detailPurchase.supplierId]?.name ?? '—'}
            onClose={() => setDetailPurchase(undefined)}
          />
        )}
      </Modal>
    </>
  );
};
