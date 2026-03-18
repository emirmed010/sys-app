import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { Modal } from '../../shared/components/Modal';
import { Button } from '../../shared/components/Button';
import { SupplierForm } from './SupplierForm';
import { formatCurrency, formatDate, generateId } from '../../core/utils/formatters';
import { Supplier, Payment } from '../../core/types';

// ─── Payment Modal ───────────────────────────────────────────────────────────
interface PaymentModalProps {
  supplier: Supplier;
  onClose: () => void;
}
const PaymentModal = ({ supplier, onClose }: PaymentModalProps) => {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [method, setMethod] = useState('نقداً');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { alert('أدخل مبلغاً صحيحاً'); return; }
    if (amt > supplier.balance) { alert('المبلغ أكبر من الرصيد المستحق'); return; }
    setSaving(true);
    try {
      await db.transaction('rw', db.payments, db.suppliers, async () => {
        await db.payments.add({
          id: generateId(),
          entityType: 'supplier',
          entityId: supplier.id,
          amount: amt,
          date,
          paymentMethod: method,
          notes,
          createdAt: Date.now(),
        } as Payment);
        await db.suppliers.update(supplier.id, {
          balance: Math.max(0, supplier.balance - amt),
        });
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
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-sm">
        <div className="text-amber-700 dark:text-amber-300 font-bold">
          الرصيد المستحق: {formatCurrency(supplier.balance)}
        </div>
      </div>
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">المبلغ المدفوع *</label>
        <input
          type="number" min="0" step="0.01"
          value={amount} onChange={e => setAmount(e.target.value)}
          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </div>
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

// ─── Statement Modal (كشف حساب) ──────────────────────────────────────────────
interface StatementModalProps {
  supplier: Supplier;
  onClose: () => void;
}
const StatementModal = ({ supplier, onClose }: StatementModalProps) => {
  const payments = useLiveQuery(
    () => db.payments.where('entityId').equals(supplier.id).sortBy('date'),
    [supplier.id]
  ) ?? [];

  const purchases = useLiveQuery(
    () => db.purchases.where('supplierId').equals(supplier.id).sortBy('date'),
    [supplier.id]
  ) ?? [];

  const handlePrint = async () => {
    const settings = await db.settings.toCollection().first();
    const workshopName = settings?.workshopName ?? 'الورشة';
    const currency = settings?.currency ?? 'د.ج';

    const paymentsTotal = payments.reduce((s, p) => s + p.amount, 0);
    const purchasesTotal = purchases.reduce((s, p) => s + p.total, 0);

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>كشف حساب مورد - ${supplier.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; direction: rtl; padding: 20px; font-size: 13px; color: #1e293b; }
  h1 { font-size: 20px; text-align: center; margin-bottom: 4px; color: #1e40af; }
  .sub { text-align: center; color: #64748b; margin-bottom: 16px; font-size: 12px; }
  .meta { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px; display: flex; gap: 40px; }
  .meta div { font-size: 13px; }
  .meta span { font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th { background: #1e40af; color: #fff; padding: 8px 10px; text-align: right; font-size: 12px; }
  td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .badge-in { color: #dc2626; font-weight: bold; }
  .badge-out { color: #16a34a; font-weight: bold; }
  .totals { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 16px; }
  .totals div { display: flex; justify-content: space-between; padding: 3px 0; font-size: 13px; }
  .totals .balance { font-weight: bold; font-size: 15px; color: #dc2626; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 4px; }
  .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #94a3b8; }
  @media print { body { padding: 10px; } }
  h2 { font-size: 14px; color: #334155; margin-bottom: 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
</style>
</head>
<body>
<h1>${workshopName}</h1>
<div class="sub">كشف حساب المورد — ${new Date().toLocaleDateString('ar-DZ')}</div>
<div class="meta">
  <div>الاسم: <span>${supplier.name}</span></div>
  <div>الهاتف: <span dir="ltr">${supplier.phone}</span></div>
  ${supplier.supplyType ? `<div>نوع التوريد: <span>${supplier.supplyType}</span></div>` : ''}
</div>

<h2>سجل المشتريات (${purchases.length})</h2>
<table>
  <thead><tr><th>#</th><th>رقم الشراء</th><th>التاريخ</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>ملاحظات</th></tr></thead>
  <tbody>
    ${purchases.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:16px">لا توجد مشتريات</td></tr>' : ''}
    ${purchases.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>#${p.purchaseNumber}</strong></td>
        <td>${new Date(p.date).toLocaleDateString('ar-DZ')}</td>
        <td class="badge-in">${p.total.toFixed(2)} ${currency}</td>
        <td class="badge-out">${p.paid.toFixed(2)} ${currency}</td>
        <td style="color:${p.remaining > 0 ? '#dc2626' : '#16a34a'}">${p.remaining.toFixed(2)} ${currency}</td>
        <td>${p.notes ?? ''}</td>
      </tr>`).join('')}
  </tbody>
</table>

<h2>سجل الدفعات (${payments.length})</h2>
<table>
  <thead><tr><th>#</th><th>التاريخ</th><th>المبلغ</th><th>طريقة الدفع</th><th>ملاحظات</th></tr></thead>
  <tbody>
    ${payments.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:16px">لا توجد دفعات مسجلة</td></tr>' : ''}
    ${payments.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${new Date(p.date).toLocaleDateString('ar-DZ')}</td>
        <td class="badge-out">${p.amount.toFixed(2)} ${currency}</td>
        <td>${p.paymentMethod ?? ''}</td>
        <td>${p.notes ?? ''}</td>
      </tr>`).join('')}
  </tbody>
</table>

<div class="totals">
  <div><span>إجمالي المشتريات</span><span class="badge-in">${purchasesTotal.toFixed(2)} ${currency}</span></div>
  <div><span>إجمالي الدفعات</span><span class="badge-out">${paymentsTotal.toFixed(2)} ${currency}</span></div>
  <div class="balance"><span>الرصيد المستحق للمورد</span><span>${supplier.balance.toFixed(2)} ${currency}</span></div>
</div>
<div class="footer">${workshopName} — كشف حساب المورد — ${new Date().toLocaleDateString('ar-DZ')}</div>
</body></html>`;

    const win = window.open('', '_blank', 'width=850,height=900');
    if (!win) { alert('يرجى السماح بالنوافذ المنبثقة لطباعة الكشف'); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500 dark:text-slate-400">المورد: <span className="font-bold text-slate-800 dark:text-slate-100">{supplier.name}</span></div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            الرصيد المستحق:{' '}
            <span className={`font-bold ${supplier.balance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
              {formatCurrency(supplier.balance)}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" icon="print" onClick={handlePrint}>طباعة الكشف</Button>
      </div>

      {/* Purchases */}
      <div>
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">shopping_cart</span>
          المشتريات ({purchases.length})
        </h4>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 font-bold">
              <tr>
                <th className="px-3 py-2">رقم الشراء</th>
                <th className="px-3 py-2">التاريخ</th>
                <th className="px-3 py-2">الإجمالي</th>
                <th className="px-3 py-2">المدفوع</th>
                <th className="px-3 py-2">المتبقي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {purchases.length === 0 ? (
                <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-400">لا توجد مشتريات</td></tr>
              ) : purchases.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-3 py-2 font-bold text-primary">#{p.purchaseNumber}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{formatDate(p.date)}</td>
                  <td className="px-3 py-2 text-rose-600 dark:text-rose-400 font-bold">{formatCurrency(p.total)}</td>
                  <td className="px-3 py-2 text-emerald-600 font-bold">{formatCurrency(p.paid)}</td>
                  <td className="px-3 py-2">
                    <span className={`font-bold ${p.remaining > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
                      {formatCurrency(p.remaining)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payments */}
      <div>
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">payments</span>
          الدفعات المسددة ({payments.length})
        </h4>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-xs text-slate-500 dark:text-slate-400 font-bold">
              <tr>
                <th className="px-3 py-2">التاريخ</th>
                <th className="px-3 py-2">المبلغ</th>
                <th className="px-3 py-2">طريقة الدفع</th>
                <th className="px-3 py-2">ملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {payments.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-slate-400">لا توجد دفعات مسجلة</td></tr>
              ) : payments.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{formatDate(p.date)}</td>
                  <td className="px-3 py-2 text-emerald-600 font-bold">{formatCurrency(p.amount)}</td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{p.paymentMethod ?? '—'}</td>
                  <td className="px-3 py-2 text-slate-500 dark:text-slate-400 text-xs">{p.notes ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={onClose}>إغلاق</Button>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const SuppliersPage = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | undefined>();
  const [paymentSupplier, setPaymentSupplier] = useState<Supplier | undefined>();
  const [statementSupplier, setStatementSupplier] = useState<Supplier | undefined>();
  const [searchTerm, setSearchTerm] = useState('');

  const suppliers = useLiveQuery(() =>
    db.suppliers.orderBy('createdAt').reverse().toArray()
  , []);

  const filtered = suppliers?.filter(s =>
    s.name.includes(searchTerm) ||
    s.phone.includes(searchTerm) ||
    (s.supplyType ?? '').includes(searchTerm)
  );

  const totalDebt = suppliers?.reduce((sum, s) => sum + s.balance, 0) ?? 0;
  const debtorsCount = suppliers?.filter(s => s.balance > 0).length ?? 0;

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setIsFormOpen(true);
  };

  const handleDelete = async (supplier: Supplier) => {
    const purchases = await db.purchases.where('supplierId').equals(supplier.id).count();
    if (purchases > 0) {
      alert('لا يمكن حذف هذا المورد لأنه مرتبط بعمليات شراء مسجلة');
      return;
    }
    if (window.confirm(`هل أنت متأكد من حذف المورد "${supplier.name}"؟`)) {
      await db.suppliers.delete(supplier.id);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">local_shipping</span>
            إدارة الموردين
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">تسجيل الموردين، ديونهم، ومتابعة كشف حساباتهم</p>
        </div>
        <button
          onClick={() => { setEditingSupplier(undefined); setIsFormOpen(true); }}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-xl">add_business</span>
          إضافة مورد
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-2xl">local_shipping</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{suppliers?.length ?? 0}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">إجمالي الموردين</div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-rose-500 text-2xl">account_balance</span>
          </div>
          <div>
            <div className="text-lg font-bold text-rose-600 dark:text-rose-400">{formatCurrency(totalDebt)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">إجمالي الديون للموردين</div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
            <span className="material-symbols-outlined text-amber-500 text-2xl">warning</span>
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{debtorsCount}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">موردون لديهم ديون</div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative max-w-md">
            <div className="absolute inset-y-0 right-0 py-2.5 pr-3 pointer-events-none text-slate-400">
              <span className="material-symbols-outlined text-xl">search</span>
            </div>
            <input
              type="text"
              className="w-full pr-10 pl-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400 dark:text-slate-100"
              placeholder="بحث بالاسم، الهاتف، أو نوع التوريد..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">
              <tr>
                <th className="px-6 py-4">المورد</th>
                <th className="px-6 py-4">الهاتف</th>
                <th className="px-6 py-4">نوع التوريد</th>
                <th className="px-6 py-4">الرصيد المستحق</th>
                <th className="px-6 py-4">تاريخ الإضافة</th>
                <th className="px-6 py-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!filtered && (
                <tr><td colSpan={6} className="py-8 text-center text-slate-500 dark:text-slate-400">جاري التحميل...</td></tr>
              )}
              {filtered && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-3">local_shipping</span>
                    <p>لا يوجد موردون مسجلون</p>
                  </td>
                </tr>
              )}
              {filtered && filtered.map(supplier => (
                <tr key={supplier.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                        {supplier.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 dark:text-slate-100">{supplier.name}</div>
                        {supplier.address && (
                          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                            <span className="material-symbols-outlined text-[14px]">location_on</span>
                            {supplier.address}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                      <span className="material-symbols-outlined text-lg text-slate-400">call</span>
                      <span dir="ltr">{supplier.phone}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
                    {supplier.supplyType ? (
                      <span className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded-full">
                        {supplier.supplyType}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-4">
                    {supplier.balance > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400 font-bold text-sm flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">trending_up</span>
                        {formatCurrency(supplier.balance)}
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 text-sm flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        لا يوجد ديون
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                    {formatDate(supplier.createdAt)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center items-center gap-1">
                      <button
                        onClick={() => setStatementSupplier(supplier)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="كشف الحساب"
                      >
                        <span className="material-symbols-outlined text-xl">receipt_long</span>
                      </button>
                      <button
                        onClick={() => setPaymentSupplier(supplier)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                        title="تسجيل دفعة"
                      >
                        <span className="material-symbols-outlined text-xl">payments</span>
                      </button>
                      <button
                        onClick={() => handleEdit(supplier)}
                        className="p-1.5 text-slate-400 hover:text-primary dark:hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="تعديل"
                      >
                        <span className="material-symbols-outlined text-xl">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(supplier)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                        title="حذف"
                      >
                        <span className="material-symbols-outlined text-xl">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supplier Form Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
      >
        <SupplierForm
          supplier={editingSupplier}
          onSuccess={() => setIsFormOpen(false)}
          onCancel={() => setIsFormOpen(false)}
        />
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={!!paymentSupplier}
        onClose={() => setPaymentSupplier(undefined)}
        title={`تسجيل دفعة — ${paymentSupplier?.name ?? ''}`}
        width="sm"
      >
        {paymentSupplier && (
          <PaymentModal supplier={paymentSupplier} onClose={() => setPaymentSupplier(undefined)} />
        )}
      </Modal>

      {/* Statement Modal */}
      <Modal
        isOpen={!!statementSupplier}
        onClose={() => setStatementSupplier(undefined)}
        title={`كشف حساب — ${statementSupplier?.name ?? ''}`}
        width="xl"
      >
        {statementSupplier && (
          <StatementModal supplier={statementSupplier} onClose={() => setStatementSupplier(undefined)} />
        )}
      </Modal>
    </>
  );
};
