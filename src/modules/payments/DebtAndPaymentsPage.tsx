import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { Modal } from '../../shared/components/Modal';
import { formatCurrency, formatDate, generateId } from '../../core/utils/formatters';
import { Invoice, Purchase, Payment } from '../../core/types';

const PAYMENT_METHODS = ['نقداً', 'تحويل بنكي', 'شيك', 'دفع إلكتروني', 'أخرى'];
const fieldClass =
  'w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-shadow';

// ─────────────────────────────────────────────────────────────────
// PaymentModal
// ─────────────────────────────────────────────────────────────────
interface PayTarget {
  type: 'invoice' | 'purchase';
  record: Invoice | Purchase;
  entityName: string;
}

const PaymentModal = ({ target, onClose }: { target: PayTarget; onClose: () => void }) => {
  const { type, record, entityName } = target;
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('نقداً');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handlePay = async () => {
    const paid = parseFloat(amount);
    if (isNaN(paid) || paid <= 0) { setError('أدخل مبلغاً صحيحاً'); return; }
    if (paid > record.remaining + 0.001) {
      setError(`المبلغ أكبر من المتبقي (${formatCurrency(record.remaining)})`);
      return;
    }
    setBusy(true);
    try {
      const entityId = type === 'invoice'
        ? (record as Invoice).customerId
        : (record as Purchase).supplierId;

      const payment: Payment = {
        id: generateId(),
        entityType: type === 'invoice' ? 'customer' : 'supplier',
        entityId,
        amount: paid,
        date: new Date().toISOString().slice(0, 10),
        paymentMethod: method,
        referenceId: record.id,
        notes: notes || undefined,
        createdAt: Date.now(),
      };

      const newPaid = record.paid + paid;
      const newRemaining = Math.max(0, record.remaining - paid);

      if (type === 'invoice') {
        await db.transaction('rw', [db.payments, db.invoices, db.customers], async () => {
          await db.payments.add(payment);
          await db.invoices.update(record.id, {
            paid: newPaid,
            remaining: newRemaining,
            status: newRemaining <= 0.001 ? 'paid' : 'issued',
          });
          const customer = await db.customers.get(entityId);
          if (customer) {
            await db.customers.update(entityId, {
              balance: Math.max(0, customer.balance - paid),
            });
          }
        });
      } else {
        await db.transaction('rw', [db.payments, db.purchases, db.suppliers], async () => {
          await db.payments.add(payment);
          await db.purchases.update(record.id, { paid: newPaid, remaining: newRemaining });
          const supplier = await db.suppliers.get(entityId);
          if (supplier) {
            await db.suppliers.update(entityId, {
              balance: Math.max(0, supplier.balance - paid),
            });
          }
        });
      }
      onClose();
    } catch (e) {
      console.error(e);
      setError('حدث خطأ أثناء تسجيل الدفعة');
    } finally {
      setBusy(false);
    }
  };

  const refNum = type === 'invoice'
    ? `#${(record as Invoice).invoiceNumber}`
    : `#${(record as Purchase).purchaseNumber}`;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">الجهة</p>
          <p className="font-bold text-slate-800 dark:text-slate-100">{entityName}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
            {type === 'invoice' ? 'رقم الفاتورة' : 'رقم المشتريات'}
          </p>
          <p className="font-bold text-slate-800 dark:text-slate-100 font-mono">{refNum}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">الإجمالي</p>
          <p className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(record.total)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">المدفوع سابقاً</p>
          <p className="font-bold text-emerald-600">{formatCurrency(record.paid)}</p>
        </div>
        <div className="col-span-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg p-3 flex justify-between items-center">
          <p className="text-sm font-medium text-rose-700 dark:text-rose-400">المبلغ المتبقي</p>
          <p className="text-xl font-bold text-rose-600">{formatCurrency(record.remaining)}</p>
        </div>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          مبلغ الدفعة *
        </label>
        <div className="relative">
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={record.remaining}
            value={amount}
            onChange={e => { setAmount(e.target.value); setError(''); }}
            className={`${fieldClass} text-left pl-28`}
            dir="ltr"
            autoFocus
            placeholder="0.00"
          />
          <button
            type="button"
            onClick={() => setAmount(record.remaining.toFixed(2))}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-primary font-bold hover:underline whitespace-nowrap px-1"
          >
            السداد الكامل
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-rose-500">{error}</p>}
      </div>

      {/* Method */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          طريقة الدفع
        </label>
        <select value={method} onChange={e => setMethod(e.target.value)} className={fieldClass}>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          ملاحظات (اختياري)
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          className={fieldClass}
          placeholder="ملاحظات..."
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          إلغاء
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handlePay}
          className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-5 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">payments</span>
          {busy ? 'جاري الحفظ...' : 'تسجيل الدفعة'}
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// StatementModal
// ─────────────────────────────────────────────────────────────────
interface StatTarget {
  entityType: 'customer' | 'supplier';
  entityId: string;
  entityName: string;
  entityPhone?: string;
}

const StatementModal = ({ target }: { target: StatTarget }) => {
  const { entityType, entityId, entityName, entityPhone } = target;

  const invoices = useLiveQuery(
    () => entityType === 'customer'
      ? db.invoices.where('customerId').equals(entityId).toArray()
      : Promise.resolve([] as Invoice[]),
    [entityId, entityType]
  ) ?? [];

  const purchases = useLiveQuery(
    () => entityType === 'supplier'
      ? db.purchases.where('supplierId').equals(entityId).toArray()
      : Promise.resolve([] as Purchase[]),
    [entityId, entityType]
  ) ?? [];

  const payments = useLiveQuery(
    () => db.payments.where('entityId').equals(entityId).toArray(),
    [entityId]
  ) ?? [];

  const records = (entityType === 'customer' ? invoices : purchases) as (Invoice | Purchase)[];
  const totalAmount = records.reduce((s, r) => s + r.total, 0);
  const totalPaid = records.reduce((s, r) => s + r.paid, 0);
  const totalRemaining = records.reduce((s, r) => s + r.remaining, 0);
  const sortedPayments = [...payments].sort((a, b) => b.createdAt - a.createdAt);

  const handlePrint = () => {
    const refLabel = entityType === 'customer' ? 'رقم الفاتورة' : 'رقم الشراء';
    const sectionLabel = entityType === 'customer' ? 'الفواتير' : 'المشتريات';
    const recordRows = [...records]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(r => {
        const num = entityType === 'customer'
          ? (r as Invoice).invoiceNumber
          : (r as Purchase).purchaseNumber;
        return `<tr>
          <td>#${num}</td><td>${r.date}</td>
          <td>${formatCurrency(r.total)}</td>
          <td class="tg">${formatCurrency(r.paid)}</td>
          <td class="${r.remaining > 0 ? 'tr' : 'tg'}">${formatCurrency(r.remaining)}</td>
        </tr>`;
      }).join('');
    const payRows = sortedPayments.map(p =>
      `<tr><td>${p.date}</td><td class="tg">${formatCurrency(p.amount)}</td><td>${p.paymentMethod || '-'}</td><td>${p.notes || '-'}</td></tr>`
    ).join('') || '<tr><td colspan="4" style="text-align:center;color:#94a3b8">لا توجد دفعات</td></tr>';

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>كشف حساب - ${entityName}</title>
<style>
  body{font-family:Arial,sans-serif;direction:rtl;padding:24px;color:#1e293b;font-size:13px}
  h1{font-size:20px;margin:0 0 4px}
  .sub{color:#64748b;font-size:12px;margin:0 0 16px}
  .info{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;display:flex;gap:32px;margin-bottom:14px}
  .info-item .lbl{font-size:11px;color:#94a3b8;margin:0} .info-item .val{font-weight:bold;margin:2px 0}
  .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px}
  .sc{border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center}
  .sc .l{font-size:11px;color:#94a3b8} .sc .v{font-size:15px;font-weight:bold}
  h2{font-size:13px;font-weight:bold;margin:0 0 6px;color:#475569;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px}
  th,td{border:1px solid #e2e8f0;padding:6px 10px;text-align:right}
  th{background:#f8fafc;font-weight:bold} tr:nth-child(even){background:#f8fafc}
  .tg{color:#16a34a;font-weight:bold} .tr{color:#dc2626;font-weight:bold}
  @media print{body{padding:0}}
</style></head><body>
<h1>كشف حساب: ${entityName}</h1>
<p class="sub">تاريخ الطباعة: ${new Date().toLocaleDateString('ar-SA')}</p>
<div class="info">
  <div class="info-item"><p class="lbl">نوع الجهة</p><p class="val">${entityType === 'customer' ? 'عميل' : 'مورد'}</p></div>
  ${entityPhone ? `<div class="info-item"><p class="lbl">الهاتف</p><p class="val">${entityPhone}</p></div>` : ''}
</div>
<div class="summary">
  <div class="sc"><p class="l">إجمالي المبالغ</p><p class="v">${formatCurrency(totalAmount)}</p></div>
  <div class="sc"><p class="l">المدفوع</p><p class="v tg">${formatCurrency(totalPaid)}</p></div>
  <div class="sc"><p class="l">المتبقي</p><p class="v tr">${formatCurrency(totalRemaining)}</p></div>
</div>
<h2>${sectionLabel}</h2>
<table><thead><tr><th>${refLabel}</th><th>التاريخ</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr></thead>
<tbody>${recordRows || '<tr><td colspan="5" style="text-align:center;color:#94a3b8">لا توجد سجلات</td></tr>'}</tbody></table>
<h2>سجل الدفعات (${payments.length})</h2>
<table><thead><tr><th>التاريخ</th><th>المبلغ</th><th>طريقة الدفع</th><th>ملاحظات</th></tr></thead>
<tbody>${payRows}</tbody></table>
</body></html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  };

  return (
    <div className="space-y-5">
      {/* Entity header */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            entityType === 'customer'
              ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-500'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-500'
          }`}>
            <span className="material-symbols-outlined text-xl">
              {entityType === 'customer' ? 'person' : 'storefront'}
            </span>
          </div>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-100">{entityName}</p>
            {entityPhone && <p className="text-sm text-slate-500 font-mono">{entityPhone}</p>}
          </div>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-2 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
        >
          <span className="material-symbols-outlined text-lg">print</span>
          طباعة الكشف
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'إجمالي المبالغ', value: formatCurrency(totalAmount), cls: 'text-slate-800 dark:text-slate-100' },
          { label: 'المدفوع', value: formatCurrency(totalPaid), cls: 'text-emerald-600' },
          { label: 'المتبقي', value: formatCurrency(totalRemaining), cls: 'text-rose-600' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
            <p className={`font-bold text-sm ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Records table */}
      <div>
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
          {entityType === 'customer' ? 'الفواتير' : 'المشتريات'}
        </h4>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold">
              <tr>
                <th className="px-4 py-2.5">الرقم</th>
                <th className="px-4 py-2.5">التاريخ</th>
                <th className="px-4 py-2.5">الإجمالي</th>
                <th className="px-4 py-2.5">المدفوع</th>
                <th className="px-4 py-2.5">المتبقي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {records.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-center text-slate-400">لا توجد سجلات</td></tr>
              )}
              {[...records]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(r => {
                  const num = entityType === 'customer'
                    ? (r as Invoice).invoiceNumber
                    : (r as Purchase).purchaseNumber;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-2.5 font-mono font-bold">#{num}</td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{formatDate(r.date)}</td>
                      <td className="px-4 py-2.5 font-bold">{formatCurrency(r.total)}</td>
                      <td className="px-4 py-2.5 text-emerald-600 font-bold">{formatCurrency(r.paid)}</td>
                      <td className="px-4 py-2.5">
                        <span className={r.remaining > 0 ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>
                          {formatCurrency(r.remaining)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payments table */}
      <div>
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
          سجل الدفعات ({payments.length})
        </h4>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 text-xs font-bold">
              <tr>
                <th className="px-4 py-2.5">التاريخ</th>
                <th className="px-4 py-2.5">المبلغ</th>
                <th className="px-4 py-2.5">طريقة الدفع</th>
                <th className="px-4 py-2.5">ملاحظات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {payments.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-slate-400">لا توجد دفعات مسجلة</td></tr>
              )}
              {sortedPayments.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{formatDate(p.date)}</td>
                  <td className="px-4 py-2.5 text-emerald-600 font-bold">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{p.paymentMethod || '-'}</td>
                  <td className="px-4 py-2.5 text-slate-400 text-xs">{p.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────
export const DebtAndPaymentsPage = () => {
  const [activeTab, setActiveTab] = useState<'customers' | 'suppliers'>('customers');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOverdue, setFilterOverdue] = useState(false);
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null);
  const [statTarget, setStatTarget] = useState<StatTarget | null>(null);

  const allInvoices = useLiveQuery(
    () => db.invoices.orderBy('createdAt').reverse().toArray(), []
  ) ?? [];
  const allPurchases = useLiveQuery(
    () => db.purchases.orderBy('createdAt').reverse().toArray(), []
  ) ?? [];
  const customers = useLiveQuery(() => db.customers.toArray()) ?? [];
  const suppliers = useLiveQuery(() => db.suppliers.toArray()) ?? [];

  const customerMap = Object.fromEntries(customers.map(c => [c.id, c]));
  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s]));

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const overdueDate = thirtyDaysAgo.toISOString().slice(0, 10);

  const customerDebts = allInvoices.filter(i => i.remaining > 0.001 && i.status !== 'cancelled');
  const supplierDebts = allPurchases.filter(p => p.remaining > 0.001);

  const filteredCustomerDebts = customerDebts
    .filter(inv => !filterOverdue || inv.date < overdueDate)
    .filter(inv => {
      if (!searchTerm) return true;
      const c = customerMap[inv.customerId];
      return c?.name.includes(searchTerm) || String(inv.invoiceNumber).includes(searchTerm);
    });

  const filteredSupplierDebts = supplierDebts
    .filter(pur => !filterOverdue || pur.date < overdueDate)
    .filter(pur => {
      if (!searchTerm) return true;
      const s = supplierMap[pur.supplierId];
      return s?.name.includes(searchTerm) || String(pur.purchaseNumber).includes(searchTerm);
    });

  const totalCustomerDebt = customerDebts.reduce((s, i) => s + i.remaining, 0);
  const totalSupplierDebt = supplierDebts.reduce((s, p) => s + p.remaining, 0);
  const overdueCustomersCount = customerDebts.filter(i => i.date < overdueDate).length;
  const overdueSuppliersCount = supplierDebts.filter(p => p.date < overdueDate).length;

  const activeRows = activeTab === 'customers' ? filteredCustomerDebts : filteredSupplierDebts;

  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">account_balance_wallet</span>
            الديون والمدفوعات
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            إدارة المبالغ المستحقة وتسجيل الدفعات للعملاء والموردين
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {([
          { label: 'إجمالي ديون العملاء', value: formatCurrency(totalCustomerDebt), icon: 'person', color: 'rose', sub: `${customerDebts.length} فاتورة معلقة` },
          { label: 'إجمالي ديون الموردين', value: formatCurrency(totalSupplierDebt), icon: 'storefront', color: 'amber', sub: `${supplierDebts.length} مشتريات معلقة` },
          { label: 'متأخرات العملاء', value: String(overdueCustomersCount), icon: 'schedule', color: 'orange', sub: 'أكثر من 30 يوم' },
          { label: 'متأخرات الموردين', value: String(overdueSuppliersCount), icon: 'warning', color: 'red', sub: 'أكثر من 30 يوم' },
        ] as const).map(({ label, value, icon, color, sub }) => (
          <div key={label} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl bg-${color}-100 dark:bg-${color}-900/30 text-${color}-600 dark:text-${color}-400 flex items-center justify-center shrink-0`}>
              <span className="material-symbols-outlined text-2xl">{icon}</span>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{value}</p>
              <p className="text-xs text-slate-400">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-1 w-fit">
        {([
          { id: 'customers', label: 'ديون العملاء', icon: 'person', count: customerDebts.length },
          { id: 'suppliers', label: 'ديون الموردين', icon: 'storefront', count: supplierDebts.length },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setSearchTerm(''); setFilterOverdue(false); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-xl">{tab.icon}</span>
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === tab.id
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search + Filter overdue */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px]">
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={activeTab === 'customers' ? 'بحث باسم العميل أو رقم الفاتورة...' : 'بحث باسم المورد أو رقم الشراء...'}
            className="w-full pr-10 pl-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-shadow"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5">
          <input
            type="checkbox"
            checked={filterOverdue}
            onChange={e => setFilterOverdue(e.target.checked)}
            className="w-4 h-4 rounded accent-rose-500"
          />
          <span className="material-symbols-outlined text-rose-500 text-lg">schedule</span>
          المتأخرات فقط (+30 يوم)
        </label>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {activeRows.length === 0 ? (
          <div className="p-16 text-center">
            <span className="material-symbols-outlined text-6xl text-slate-200 dark:text-slate-700 block mb-4">
              {filterOverdue ? 'schedule' : 'check_circle'}
            </span>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
              {filterOverdue ? 'لا توجد متأخرات' : searchTerm ? 'لا نتائج مطابقة' : 'لا توجد ديون مستحقة'}
            </h3>
            <p className="text-slate-500 dark:text-slate-400">
              {filterOverdue ? 'جميع المدفوعات في الموعد المحدد' : searchTerm ? 'حاول بحثاً مختلفاً' : 'جميع الحسابات مسواة بالكامل ✓'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wide">
                <tr>
                  <th className="px-6 py-4">{activeTab === 'customers' ? 'العميل' : 'المورد'}</th>
                  <th className="px-6 py-4">المرجع</th>
                  <th className="px-6 py-4">التاريخ</th>
                  <th className="px-6 py-4">الإجمالي</th>
                  <th className="px-6 py-4">المدفوع</th>
                  <th className="px-6 py-4">المتبقي</th>
                  <th className="px-6 py-4">التقدم</th>
                  <th className="px-6 py-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeTab === 'customers'
                  ? filteredCustomerDebts.map(inv => {
                      const customer = customerMap[inv.customerId];
                      const isOverdue = inv.date < overdueDate;
                      const paidPct = inv.total > 0 ? Math.round((inv.paid / inv.total) * 100) : 0;
                      return (
                        <tr key={inv.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${isOverdue ? 'bg-rose-50/40 dark:bg-rose-900/5' : ''}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-500 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[18px]">person</span>
                              </div>
                              <div>
                                <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{customer?.name || 'عميل محذوف'}</div>
                                {customer?.phone && <div className="text-xs text-slate-400 font-mono">{customer.phone}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-sm text-slate-700 dark:text-slate-200">#{inv.invoiceNumber}</td>
                          <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                            <div>{formatDate(inv.date)}</div>
                            {isOverdue && (
                              <span className="inline-flex items-center gap-0.5 text-xs text-rose-500 font-bold">
                                <span className="material-symbols-outlined text-[13px]">warning</span>متأخر
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-100">{formatCurrency(inv.total)}</td>
                          <td className="px-6 py-4 text-sm text-emerald-600 font-bold">{formatCurrency(inv.paid)}</td>
                          <td className="px-6 py-4 text-sm text-rose-600 font-bold">{formatCurrency(inv.remaining)}</td>
                          <td className="px-6 py-4 min-w-[90px]">
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-1">
                              <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
                            </div>
                            <span className="text-xs text-slate-500">{paidPct}%</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() => setPayTarget({ type: 'invoice', record: inv, entityName: customer?.name || '—' })}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                title="تسجيل دفعة"
                              >
                                <span className="material-symbols-outlined text-xl">payments</span>
                              </button>
                              <button
                                onClick={() => setStatTarget({ entityType: 'customer', entityId: inv.customerId, entityName: customer?.name || '—', entityPhone: customer?.phone })}
                                className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                title="كشف حساب"
                              >
                                <span className="material-symbols-outlined text-xl">receipt_long</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  : filteredSupplierDebts.map(pur => {
                      const supplier = supplierMap[pur.supplierId];
                      const isOverdue = pur.date < overdueDate;
                      const paidPct = pur.total > 0 ? Math.round((pur.paid / pur.total) * 100) : 0;
                      return (
                        <tr key={pur.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${isOverdue ? 'bg-amber-50/40 dark:bg-amber-900/5' : ''}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-500 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[18px]">storefront</span>
                              </div>
                              <div>
                                <div className="font-bold text-slate-800 dark:text-slate-100 text-sm">{supplier?.name || 'مورد محذوف'}</div>
                                {supplier?.phone && <div className="text-xs text-slate-400 font-mono">{supplier.phone}</div>}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-sm text-slate-700 dark:text-slate-200">#{pur.purchaseNumber}</td>
                          <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">
                            <div>{formatDate(pur.date)}</div>
                            {isOverdue && (
                              <span className="inline-flex items-center gap-0.5 text-xs text-rose-500 font-bold">
                                <span className="material-symbols-outlined text-[13px]">warning</span>متأخر
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold text-slate-800 dark:text-slate-100">{formatCurrency(pur.total)}</td>
                          <td className="px-6 py-4 text-sm text-emerald-600 font-bold">{formatCurrency(pur.paid)}</td>
                          <td className="px-6 py-4 text-sm text-rose-600 font-bold">{formatCurrency(pur.remaining)}</td>
                          <td className="px-6 py-4 min-w-[90px]">
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 mb-1">
                              <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${paidPct}%` }} />
                            </div>
                            <span className="text-xs text-slate-500">{paidPct}%</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() => setPayTarget({ type: 'purchase', record: pur, entityName: supplier?.name || '—' })}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                title="تسجيل دفعة"
                              >
                                <span className="material-symbols-outlined text-xl">payments</span>
                              </button>
                              <button
                                onClick={() => setStatTarget({ entityType: 'supplier', entityId: pur.supplierId, entityName: supplier?.name || '—', entityPhone: supplier?.phone })}
                                className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                title="كشف حساب"
                              >
                                <span className="material-symbols-outlined text-xl">receipt_long</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                }
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={!!payTarget}
        onClose={() => setPayTarget(null)}
        title={`تسجيل دفعة — ${payTarget?.entityName || ''}`}
        width="md"
      >
        {payTarget && <PaymentModal target={payTarget} onClose={() => setPayTarget(null)} />}
      </Modal>

      {/* Statement Modal */}
      <Modal
        isOpen={!!statTarget}
        onClose={() => setStatTarget(null)}
        title={`كشف حساب — ${statTarget?.entityName || ''}`}
        width="lg"
      >
        {statTarget && <StatementModal target={statTarget} />}
      </Modal>
    </>
  );
};
