import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { formatCurrency, formatDate } from '../../core/utils/formatters';

// ─── Types ───────────────────────────────────────────────────────
type ReportTab = 'sales' | 'profit' | 'orders' | 'inventory' | 'customers' | 'suppliers' | 'debts';

// ─── Constants ───────────────────────────────────────────────────
const ORDER_SL: Record<string, string> = {
  new: 'جديد', in_progress: 'قيد التنفيذ', ready: 'جاهز', installed: 'مركّب', cancelled: 'ملغى',
};
const ORDER_SC: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  ready: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  installed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  cancelled: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
};
const INV_SL: Record<string, string> = {
  draft: 'مسودة', issued: 'صادرة', paid: 'مسددة', cancelled: 'ملغاة',
};
const INV_SC: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-500',
  issued: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  cancelled: 'bg-rose-100 text-rose-500',
};

const TABS: { id: ReportTab; label: string; icon: string }[] = [
  { id: 'sales',     label: 'المبيعات',   icon: 'trending_up' },
  { id: 'profit',    label: 'الأرباح',     icon: 'savings' },
  { id: 'orders',    label: 'الطلبات',     icon: 'assignment' },
  { id: 'inventory', label: 'المخزون',     icon: 'inventory_2' },
  { id: 'customers', label: 'العملاء',     icon: 'people' },
  { id: 'suppliers', label: 'الموردين',    icon: 'storefront' },
  { id: 'debts',     label: 'الديون',      icon: 'account_balance_wallet' },
];

// ─── Helpers ─────────────────────────────────────────────────────
const todayStr = new Date().toISOString().slice(0, 10);
const firstOfMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`;
const inRange = (d: string, f: string, t: string) => (!f || d >= f) && (!t || d <= t);
const fmtMonth = (ym: string) =>
  new Date(ym + '-02').toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long' });

const doPrint = (title: string, body: string) => {
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>${title}</title>
<style>
body{font-family:Arial,sans-serif;direction:rtl;padding:20px;font-size:12px;color:#1e293b}
h1{font-size:17px;margin:0 0 2px}.sub{font-size:11px;color:#64748b;margin:0 0 12px}
.kpi{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.k{border:1px solid #e2e8f0;border-radius:6px;padding:7px 12px;min-width:110px}
.k .l{font-size:10px;color:#94a3b8}.k .v{font-size:13px;font-weight:bold}
h2{font-size:13px;font-weight:bold;margin:10px 0 4px;border-bottom:1px solid #e2e8f0;padding-bottom:3px}
table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px}
th,td{border:1px solid #e2e8f0;padding:4px 7px;text-align:right}
th{background:#f8fafc;font-weight:bold}tr:nth-child(even){background:#f8fafc}
.tg{color:#16a34a;font-weight:bold}.tr{color:#dc2626;font-weight:bold}.b{font-weight:bold}
.warn{background:#fffbeb}</style></head>
<body><h1>${title}</h1><p class="sub">طُبع: ${new Date().toLocaleDateString('ar-SA')}</p>
${body}</body></html>`;
  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); w.print(); }
};

// ─── Shared table class constants ────────────────────────────────
const TH = 'px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide';
const TD = 'px-4 py-3 text-sm';

// ─── KPI card ────────────────────────────────────────────────────
const KPI = ({ label, value, sub, colorClass = 'text-slate-800 dark:text-slate-100' }: {
  label: string; value: string; sub?: string; colorClass?: string;
}) => (
  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">{label}</p>
    <p className={`text-xl font-bold ${colorClass}`}>{value}</p>
    {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
  </div>
);

const EmptyState = ({ msg }: { msg: string }) => (
  <div className="p-14 text-center">
    <span className="material-symbols-outlined text-5xl text-slate-200 dark:text-slate-700 block mb-3">bar_chart</span>
    <p className="text-slate-500 dark:text-slate-400">{msg}</p>
  </div>
);

// ─── Main Page ───────────────────────────────────────────────────
export const ReportsPage = () => {
  const [tab, setTab]       = useState<ReportTab>('sales');
  const [from, setFrom]     = useState(firstOfMonth);
  const [to, setTo]         = useState(todayStr);
  const [search, setSearch] = useState('');

  // ── Live queries ────────────────────────────────────────────────
  const allOrders    = useLiveQuery(() => db.orders.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const allInvoices  = useLiveQuery(() => db.invoices.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const allPurchases = useLiveQuery(() => db.purchases.orderBy('createdAt').reverse().toArray(), []) ?? [];
  const customers    = useLiveQuery(() => db.customers.toArray(), []) ?? [];
  const suppliers    = useLiveQuery(() => db.suppliers.toArray(), []) ?? [];
  const invItems     = useLiveQuery(() => db.inventory.toArray(), []) ?? [];
  const stockMoves   = useLiveQuery(() => db.stockMovements.orderBy('date').reverse().toArray(), []) ?? [];
  const payments     = useLiveQuery(() => db.payments.orderBy('createdAt').reverse().toArray(), []) ?? [];

  const custMap = useMemo(() => Object.fromEntries(customers.map(c => [c.id, c])), [customers]);
  const suppMap = useMemo(() => Object.fromEntries(suppliers.map(s => [s.id, s])), [suppliers]);

  // ── Sales ───────────────────────────────────────────────────────
  const salesRows = useMemo(() =>
    allInvoices.filter(i =>
      i.status !== 'cancelled' && inRange(i.date, from, to) &&
      (!search || (custMap[i.customerId]?.name || '').includes(search) || String(i.invoiceNumber).includes(search))
    ), [allInvoices, from, to, search, custMap]);

  const salesKPI = useMemo(() => ({
    count: salesRows.length,
    revenue: salesRows.reduce((s, i) => s + i.total, 0),
    collected: salesRows.reduce((s, i) => s + i.paid, 0),
    outstanding: salesRows.reduce((s, i) => s + i.remaining, 0),
  }), [salesRows]);

  // ── Profit ──────────────────────────────────────────────────────
  const profInvoices  = useMemo(() =>
    allInvoices.filter(i => i.status !== 'cancelled' && inRange(i.date, from, to)),
    [allInvoices, from, to]);
  const profPurchases = useMemo(() =>
    allPurchases.filter(p => inRange(p.date, from, to)),
    [allPurchases, from, to]);
  const totalRevenue  = useMemo(() => profInvoices.reduce((s, i) => s + i.total, 0), [profInvoices]);
  const totalCOGS     = useMemo(() => profPurchases.reduce((s, p) => s + p.total, 0), [profPurchases]);
  const estProfit     = totalRevenue - totalCOGS;
  const profitMargin  = totalRevenue > 0 ? ((estProfit / totalRevenue) * 100).toFixed(1) : '0';

  const monthlyBreakdown = useMemo(() => {
    const map: Record<string, { revenue: number; cogs: number; count: number }> = {};
    profInvoices.forEach(i => {
      const k = i.date.slice(0, 7);
      if (!map[k]) map[k] = { revenue: 0, cogs: 0, count: 0 };
      map[k].revenue += i.total; map[k].count++;
    });
    profPurchases.forEach(p => {
      const k = p.date.slice(0, 7);
      if (!map[k]) map[k] = { revenue: 0, cogs: 0, count: 0 };
      map[k].cogs += p.total;
    });
    return Object.entries(map)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([k, v]) => ({ key: k, ...v, profit: v.revenue - v.cogs }));
  }, [profInvoices, profPurchases]);

  // ── Orders ──────────────────────────────────────────────────────
  const ordersRows = useMemo(() =>
    allOrders.filter(o =>
      inRange(o.date, from, to) &&
      (!search || (custMap[o.customerId]?.name || '').includes(search) || String(o.orderNumber).includes(search))
    ), [allOrders, from, to, search, custMap]);

  const ordersKPI = useMemo(() => ({
    count: ordersRows.length,
    total: ordersRows.reduce((s, o) => s + o.total, 0),
    deposit: ordersRows.reduce((s, o) => s + o.deposit, 0),
    remaining: ordersRows.reduce((s, o) => s + o.remaining, 0),
  }), [ordersRows]);

  // ── Inventory ───────────────────────────────────────────────────
  const invRows = useMemo(() =>
    invItems.filter(item =>
      !search || item.name.includes(search) || item.code.includes(search) || item.category.includes(search)
    ), [invItems, search]);

  const invKPI = useMemo(() => ({
    total: invItems.length,
    lowStock: invItems.filter(i => i.minStock > 0 && i.quantity <= i.minStock).length,
    outOfStock: invItems.filter(i => i.quantity === 0).length,
    totalValue: invItems.reduce((s, i) => s + i.quantity * i.purchasePrice, 0),
  }), [invItems]);

  // ── Customers ───────────────────────────────────────────────────
  const custRows = useMemo(() =>
    customers
      .filter(c => !search || c.name.includes(search) || c.phone.includes(search))
      .map(c => ({
        ...c,
        invoiceCount: allInvoices.filter(i => i.customerId === c.id && inRange(i.date, from, to) && i.status !== 'cancelled').length,
        totalSpent:   allInvoices.filter(i => i.customerId === c.id && inRange(i.date, from, to) && i.status !== 'cancelled').reduce((s, i) => s + i.total, 0),
        orderCount:   allOrders.filter(o => o.customerId === c.id && inRange(o.date, from, to)).length,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent),
    [customers, search, allInvoices, allOrders, from, to]);

  // ── Suppliers ───────────────────────────────────────────────────
  const suppRows = useMemo(() =>
    suppliers
      .filter(s => !search || s.name.includes(search) || s.phone.includes(search))
      .map(s => {
        const sp = allPurchases.filter(p => p.supplierId === s.id && inRange(p.date, from, to));
        return {
          ...s,
          purchaseCount:  sp.length,
          totalPurchased: sp.reduce((t, p) => t + p.total, 0),
          debtRemaining:  allPurchases.filter(p => p.supplierId === s.id && p.remaining > 0.001).reduce((t, p) => t + p.remaining, 0),
        };
      })
      .sort((a, b) => b.totalPurchased - a.totalPurchased),
    [suppliers, search, allPurchases, from, to]);

  // ── Debts ────────────────────────────────────────────────────────
  const custDebtRows = useMemo(() =>
    allInvoices
      .filter(i => i.remaining > 0.001 && i.status !== 'cancelled' &&
        (!search || (custMap[i.customerId]?.name || '').includes(search)))
      .sort((a, b) => a.date.localeCompare(b.date)),
    [allInvoices, custMap, search]);

  const suppDebtRows = useMemo(() =>
    allPurchases
      .filter(p => p.remaining > 0.001 &&
        (!search || (suppMap[p.supplierId]?.name || '').includes(search)))
      .sort((a, b) => a.date.localeCompare(b.date)),
    [allPurchases, suppMap, search]);

  const paymentsRows = useMemo(() =>
    payments.filter(p =>
      inRange(p.date, from, to) &&
      (!search || (custMap[p.entityId]?.name || suppMap[p.entityId]?.name || '').includes(search))
    ), [payments, from, to, custMap, suppMap, search]);

  // ── Print ─────────────────────────────────────────────────────────
  const handlePrint = () => {
    switch (tab) {
      case 'sales': {
        const rows = salesRows.map(i =>
          `<tr><td class="b">#${i.invoiceNumber}</td><td>${custMap[i.customerId]?.name || '-'}</td><td>${i.date}</td><td>${INV_SL[i.status] || i.status}</td><td class="b">${formatCurrency(i.total)}</td><td class="tg">${formatCurrency(i.paid)}</td><td class="${i.remaining > 0.001 ? 'tr' : 'tg'}">${formatCurrency(i.remaining)}</td></tr>`
        ).join('');
        doPrint('تقرير المبيعات',
          `<div class="kpi"><div class="k"><p class="l">عدد الفواتير</p><p class="v">${salesKPI.count}</p></div><div class="k"><p class="l">إجمالي المبيعات</p><p class="v">${formatCurrency(salesKPI.revenue)}</p></div><div class="k"><p class="l">المحصّل</p><p class="v tg">${formatCurrency(salesKPI.collected)}</p></div><div class="k"><p class="l">المتبقي</p><p class="v tr">${formatCurrency(salesKPI.outstanding)}</p></div></div>
          <table><thead><tr><th>رقم الفاتورة</th><th>العميل</th><th>التاريخ</th><th>الحالة</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr></thead><tbody>${rows || '<tr><td colspan="7" style="text-align:center">لا بيانات</td></tr>'}</tbody></table>`
        ); break;
      }
      case 'profit': {
        const mRows = monthlyBreakdown.map(m =>
          `<tr><td class="b">${fmtMonth(m.key)}</td><td>${m.count}</td><td class="b">${formatCurrency(m.revenue)}</td><td class="tr">${formatCurrency(m.cogs)}</td><td class="${m.profit >= 0 ? 'tg' : 'tr'}">${formatCurrency(m.profit)}</td><td>${m.revenue > 0 ? ((m.profit / m.revenue) * 100).toFixed(1) + '%' : '—'}</td></tr>`
        ).join('');
        doPrint('تقرير الأرباح',
          `<div class="kpi"><div class="k"><p class="l">إجمالي الإيرادات</p><p class="v">${formatCurrency(totalRevenue)}</p></div><div class="k"><p class="l">تكلفة المشتريات</p><p class="v tr">${formatCurrency(totalCOGS)}</p></div><div class="k"><p class="l">صافي الربح</p><p class="v tg">${formatCurrency(estProfit)}</p></div><div class="k"><p class="l">هامش الربح</p><p class="v">${profitMargin}%</p></div></div>
          <table><thead><tr><th>الشهر</th><th>عدد الفواتير</th><th>الإيرادات</th><th>تكلفة المشتريات</th><th>صافي الربح</th><th>هامش الربح</th></tr></thead><tbody>${mRows || '<tr><td colspan="6" style="text-align:center">لا بيانات</td></tr>'}</tbody></table>`
        ); break;
      }
      case 'orders': {
        const rows = ordersRows.map(o =>
          `<tr><td class="b">#${o.orderNumber}</td><td>${custMap[o.customerId]?.name || '-'}</td><td>${o.date}</td><td>${ORDER_SL[o.status] || o.status}</td><td class="b">${formatCurrency(o.total)}</td><td class="tg">${formatCurrency(o.deposit)}</td><td class="${o.remaining > 0.001 ? 'tr' : 'tg'}">${formatCurrency(o.remaining)}</td></tr>`
        ).join('');
        doPrint('تقرير الطلبات',
          `<div class="kpi"><div class="k"><p class="l">عدد الطلبات</p><p class="v">${ordersKPI.count}</p></div><div class="k"><p class="l">إجمالي القيمة</p><p class="v">${formatCurrency(ordersKPI.total)}</p></div><div class="k"><p class="l">المقدمات</p><p class="v tg">${formatCurrency(ordersKPI.deposit)}</p></div><div class="k"><p class="l">المتبقي</p><p class="v tr">${formatCurrency(ordersKPI.remaining)}</p></div></div>
          <table><thead><tr><th>رقم الطلب</th><th>العميل</th><th>التاريخ</th><th>الحالة</th><th>الإجمالي</th><th>العربون</th><th>المتبقي</th></tr></thead><tbody>${rows || '<tr><td colspan="7" style="text-align:center">لا بيانات</td></tr>'}</tbody></table>`
        ); break;
      }
      case 'inventory': {
        const rows = invRows.map(i =>
          `<tr class="${i.quantity <= i.minStock && i.minStock > 0 ? 'warn' : ''}"><td class="b">${i.code}</td><td>${i.name}</td><td>${i.category}</td><td class="b">${i.quantity}</td><td>${i.minStock}</td><td>${formatCurrency(i.quantity * i.purchasePrice)}</td><td>${i.quantity === 0 ? 'نفد' : i.quantity <= i.minStock && i.minStock > 0 ? 'منخفض' : 'جيد'}</td></tr>`
        ).join('');
        doPrint('تقرير جرد المخزون',
          `<div class="kpi"><div class="k"><p class="l">الأصناف</p><p class="v">${invKPI.total}</p></div><div class="k"><p class="l">منخفضة</p><p class="v tr">${invKPI.lowStock}</p></div><div class="k"><p class="l">نفد</p><p class="v tr">${invKPI.outOfStock}</p></div><div class="k"><p class="l">قيمة المخزون</p><p class="v">${formatCurrency(invKPI.totalValue)}</p></div></div>
          <table><thead><tr><th>الكود</th><th>الصنف</th><th>التصنيف</th><th>الكمية</th><th>حد الإنذار</th><th>القيمة</th><th>الحالة</th></tr></thead><tbody>${rows || '<tr><td colspan="7" style="text-align:center">لا بيانات</td></tr>'}</tbody></table>`
        ); break;
      }
      case 'customers': {
        const rows = custRows.map(c =>
          `<tr><td class="b">${c.name}</td><td>${c.phone}</td><td>${c.orderCount}</td><td>${c.invoiceCount}</td><td class="b">${formatCurrency(c.totalSpent)}</td><td class="${c.balance > 0 ? 'tr' : 'tg'}">${formatCurrency(c.balance)}</td></tr>`
        ).join('');
        doPrint('تقرير العملاء',
          `<div class="kpi"><div class="k"><p class="l">إجمالي العملاء</p><p class="v">${customers.length}</p></div><div class="k"><p class="l">إجمالي المبيعات</p><p class="v">${formatCurrency(custRows.reduce((s, c) => s + c.totalSpent, 0))}</p></div><div class="k"><p class="l">عملاء مدينون</p><p class="v tr">${customers.filter(c => c.balance > 0).length}</p></div></div>
          <table><thead><tr><th>العميل</th><th>الهاتف</th><th>طلبات</th><th>فواتير</th><th>إجمالي التعاملات</th><th>الرصيد المستحق</th></tr></thead><tbody>${rows || '<tr><td colspan="6" style="text-align:center">لا بيانات</td></tr>'}</tbody></table>`
        ); break;
      }
      case 'suppliers': {
        const rows = suppRows.map(s =>
          `<tr><td class="b">${s.name}</td><td>${s.phone}</td><td>${s.supplyType || '-'}</td><td>${s.purchaseCount}</td><td class="b">${formatCurrency(s.totalPurchased)}</td><td class="${s.debtRemaining > 0 ? 'tr' : 'tg'}">${formatCurrency(s.debtRemaining)}</td></tr>`
        ).join('');
        doPrint('تقرير الموردين',
          `<div class="kpi"><div class="k"><p class="l">إجمالي الموردين</p><p class="v">${suppliers.length}</p></div><div class="k"><p class="l">إجمالي المشتريات</p><p class="v">${formatCurrency(suppRows.reduce((s, ss) => s + ss.totalPurchased, 0))}</p></div><div class="k"><p class="l">المبالغ المستحقة</p><p class="v tr">${formatCurrency(suppRows.reduce((s, ss) => s + ss.debtRemaining, 0))}</p></div></div>
          <table><thead><tr><th>المورد</th><th>الهاتف</th><th>نوع التوريد</th><th>مشتريات</th><th>الإجمالي</th><th>المستحق</th></tr></thead><tbody>${rows || '<tr><td colspan="6" style="text-align:center">لا بيانات</td></tr>'}</tbody></table>`
        ); break;
      }
      case 'debts': {
        const cRows = custDebtRows.map(i =>
          `<tr><td>${custMap[i.customerId]?.name || '-'}</td><td class="b">#${i.invoiceNumber}</td><td>${i.date}</td><td class="b">${formatCurrency(i.total)}</td><td class="tg">${formatCurrency(i.paid)}</td><td class="tr b">${formatCurrency(i.remaining)}</td></tr>`
        ).join('');
        const sRows = suppDebtRows.map(p =>
          `<tr><td>${suppMap[p.supplierId]?.name || '-'}</td><td class="b">#${p.purchaseNumber}</td><td>${p.date}</td><td class="b">${formatCurrency(p.total)}</td><td class="tg">${formatCurrency(p.paid)}</td><td class="tr b">${formatCurrency(p.remaining)}</td></tr>`
        ).join('');
        const pRows = paymentsRows.map(p =>
          `<tr><td>${p.entityType === 'customer' ? custMap[p.entityId]?.name : suppMap[p.entityId]?.name || '-'}</td><td>${p.entityType === 'customer' ? 'عميل' : 'مورد'}</td><td class="tg b">${formatCurrency(p.amount)}</td><td>${p.paymentMethod || '-'}</td><td>${p.date}</td></tr>`
        ).join('');
        doPrint('تقرير الديون والمدفوعات',
          `<div class="kpi"><div class="k"><p class="l">ديون العملاء</p><p class="v tr">${formatCurrency(custDebtRows.reduce((s, i) => s + i.remaining, 0))}</p></div><div class="k"><p class="l">ديون الموردين</p><p class="v tr">${formatCurrency(suppDebtRows.reduce((s, p) => s + p.remaining, 0))}</p></div><div class="k"><p class="l">مدفوعات الفترة</p><p class="v tg">${formatCurrency(paymentsRows.reduce((s, p) => s + p.amount, 0))}</p></div></div>
          <h2>ديون العملاء</h2><table><thead><tr><th>العميل</th><th>الفاتورة</th><th>التاريخ</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr></thead><tbody>${cRows || '<tr><td colspan="6" style="text-align:center">لا ديون</td></tr>'}</tbody></table>
          <h2>ديون الموردين</h2><table><thead><tr><th>المورد</th><th>رقم الشراء</th><th>التاريخ</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr></thead><tbody>${sRows || '<tr><td colspan="6" style="text-align:center">لا ديون</td></tr>'}</tbody></table>
          <h2>المدفوعات المسجلة في الفترة</h2><table><thead><tr><th>الجهة</th><th>النوع</th><th>المبلغ</th><th>طريقة الدفع</th><th>التاريخ</th></tr></thead><tbody>${pRows || '<tr><td colspan="5" style="text-align:center">لا دفعات</td></tr>'}</tbody></table>`
        ); break;
      }
    }
  };

  const inputCls = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm px-3 py-2 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none dark:text-slate-100 transition-shadow';

  // ─── Render ────────────────────────────────────────────────────
  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">bar_chart</span>
            التقارير والإحصائيات
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            تقارير شاملة عن المبيعات والطلبات والأرباح والمخزون والعملاء والموردين
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">print</span>
          طباعة التقرير الحالي
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 shadow-sm">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSearch(''); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              tab === t.id
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters: date range + search + refresh */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-slate-500 dark:text-slate-400">من</span>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls} />
          <span className="text-sm text-slate-500 dark:text-slate-400">إلى</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inputCls} />
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <span className="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">search</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث في التقرير..."
            className={`${inputCls} pr-9 w-full`}
          />
        </div>
        <button
          onClick={() => { setFrom(firstOfMonth); setTo(todayStr); setSearch(''); }}
          title="إعادة تعيين"
          className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
        >
          <span className="material-symbols-outlined text-xl">refresh</span>
        </button>
      </div>

      {/* ─────────────── SALES TAB ─────────────── */}
      {tab === 'sales' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KPI label="عدد الفواتير"           value={String(salesKPI.count)}               colorClass="text-blue-600 dark:text-blue-400" />
            <KPI label="إجمالي المبيعات"         value={formatCurrency(salesKPI.revenue)}      colorClass="text-emerald-600" />
            <KPI label="المحصّل"                 value={formatCurrency(salesKPI.collected)}    colorClass="text-purple-600 dark:text-purple-400" />
            <KPI label="المتبقي غير المحصّل"     value={formatCurrency(salesKPI.outstanding)}  colorClass="text-rose-600" />
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {salesRows.length === 0 ? <EmptyState msg="لا توجد مبيعات في الفترة المحددة" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>{['رقم الفاتورة', 'العميل', 'التاريخ', 'الحالة', 'الإجمالي', 'المدفوع', 'المتبقي'].map(h => <th key={h} className={TH}>{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {salesRows.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className={`${TD} font-mono font-bold`}>#{inv.invoiceNumber}</td>
                        <td className={`${TD} font-medium text-slate-800 dark:text-slate-100`}>{custMap[inv.customerId]?.name || '—'}</td>
                        <td className={`${TD} text-slate-500`}>{formatDate(inv.date)}</td>
                        <td className={TD}><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${INV_SC[inv.status] || ''}`}>{INV_SL[inv.status] || inv.status}</span></td>
                        <td className={`${TD} font-bold`}>{formatCurrency(inv.total)}</td>
                        <td className={`${TD} text-emerald-600 font-bold`}>{formatCurrency(inv.paid)}</td>
                        <td className={`${TD} ${inv.remaining > 0.001 ? 'text-rose-600' : 'text-emerald-600'} font-bold`}>{formatCurrency(inv.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─────────────── PROFIT TAB ─────────────── */}
      {tab === 'profit' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KPI label="إجمالي الإيرادات"         value={formatCurrency(totalRevenue)} colorClass="text-emerald-600" />
            <KPI label="تكلفة المشتريات (COGS)"   value={formatCurrency(totalCOGS)}    colorClass="text-rose-600" />
            <KPI label="صافي الربح التقريبي"       value={formatCurrency(estProfit)}    colorClass={estProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
            <KPI label="هامش الربح"               value={`${profitMargin}%`}           colorClass="text-purple-600 dark:text-purple-400" sub="تقريباً" />
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
            <span className="material-symbols-outlined text-lg shrink-0 mt-0.5">info</span>
            الربح محسوب تقريبياً: الإيرادات (الفواتير في الفترة) − إجمالي المشتريات (الفترة نفسها). لا يشمل التكاليف التشغيلية الأخرى.
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-primary">calendar_month</span>
              التفصيل الشهري
            </div>
            {monthlyBreakdown.length === 0 ? <EmptyState msg="لا توجد بيانات في الفترة المحددة" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>{['الشهر', 'عدد الفواتير', 'الإيرادات', 'تكلفة المشتريات', 'صافي الربح', 'هامش الربح'].map(h => <th key={h} className={TH}>{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {monthlyBreakdown.map(m => (
                      <tr key={m.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className={`${TD} font-bold text-slate-800 dark:text-slate-100`}>{fmtMonth(m.key)}</td>
                        <td className={`${TD} text-slate-600 dark:text-slate-400`}>{m.count}</td>
                        <td className={`${TD} font-bold text-emerald-600`}>{formatCurrency(m.revenue)}</td>
                        <td className={`${TD} text-rose-600`}>{formatCurrency(m.cogs)}</td>
                        <td className={`${TD} font-bold ${m.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(m.profit)}</td>
                        <td className={`${TD} text-slate-500 dark:text-slate-400`}>
                          {m.revenue > 0 ? `${((m.profit / m.revenue) * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─────────────── ORDERS TAB ─────────────── */}
      {tab === 'orders' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KPI label="عدد الطلبات"          value={String(ordersKPI.count)}               colorClass="text-blue-600 dark:text-blue-400" />
            <KPI label="إجمالي قيمة الطلبات"  value={formatCurrency(ordersKPI.total)}        colorClass="text-slate-800 dark:text-slate-100" />
            <KPI label="المقدمات المحصّلة"     value={formatCurrency(ordersKPI.deposit)}      colorClass="text-emerald-600" />
            <KPI label="المتبقي على العملاء"   value={formatCurrency(ordersKPI.remaining)}    colorClass="text-rose-600" />
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {ordersRows.length === 0 ? <EmptyState msg="لا توجد طلبات في الفترة المحددة" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>{['رقم الطلب', 'العميل', 'التاريخ', 'الحالة', 'الإجمالي', 'العربون', 'المتبقي'].map(h => <th key={h} className={TH}>{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {ordersRows.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className={`${TD} font-mono font-bold`}>#{o.orderNumber}</td>
                        <td className={`${TD} font-medium text-slate-800 dark:text-slate-100`}>{custMap[o.customerId]?.name || '—'}</td>
                        <td className={`${TD} text-slate-500`}>{formatDate(o.date)}</td>
                        <td className={TD}><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ORDER_SC[o.status] || ''}`}>{ORDER_SL[o.status] || o.status}</span></td>
                        <td className={`${TD} font-bold`}>{formatCurrency(o.total)}</td>
                        <td className={`${TD} text-emerald-600 font-bold`}>{formatCurrency(o.deposit)}</td>
                        <td className={`${TD} ${o.remaining > 0.001 ? 'text-rose-600' : 'text-emerald-600'} font-bold`}>{formatCurrency(o.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─────────────── INVENTORY TAB ─────────────── */}
      {tab === 'inventory' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KPI label="إجمالي الأصناف"  value={String(invKPI.total)}              colorClass="text-blue-600 dark:text-blue-400" />
            <KPI label="أصناف منخفضة"    value={String(invKPI.lowStock)}           colorClass="text-amber-600" />
            <KPI label="نفد المخزون"      value={String(invKPI.outOfStock)}         colorClass="text-rose-600" />
            <KPI label="قيمة المخزون"    value={formatCurrency(invKPI.totalValue)} colorClass="text-emerald-600" />
          </div>
          {/* Items table */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-primary">inventory_2</span>
              الجرد الحالي ({invRows.length} صنف)
            </div>
            {invRows.length === 0 ? <EmptyState msg="لا توجد أصناف مطابقة للبحث" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>{['الكود', 'الصنف', 'التصنيف', 'الكمية', 'حد الإنذار', 'قيمة المخزون', 'الحالة'].map(h => <th key={h} className={TH}>{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {invRows.map(item => {
                      const isLow = item.minStock > 0 && item.quantity <= item.minStock;
                      const isOut = item.quantity === 0;
                      return (
                        <tr key={item.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 ${isLow ? 'bg-amber-50/60 dark:bg-amber-900/5' : ''}`}>
                          <td className={`${TD} font-mono text-xs text-slate-500`}>{item.code}</td>
                          <td className={`${TD} font-bold text-slate-800 dark:text-slate-100`}>{item.name}</td>
                          <td className={`${TD} text-slate-500`}>{item.category}</td>
                          <td className={`${TD} font-bold ${isLow ? 'text-amber-600' : 'text-slate-800 dark:text-slate-100'}`}>{item.quantity}</td>
                          <td className={`${TD} text-slate-500`}>{item.minStock}</td>
                          <td className={`${TD} text-slate-700 dark:text-slate-300`}>{formatCurrency(item.quantity * item.purchasePrice)}</td>
                          <td className={TD}>
                            {isOut
                              ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-600">نفد</span>
                              : isLow
                              ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">منخفض</span>
                              : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600">جيد</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {/* Stock movements */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-primary">history</span>
              آخر حركات المخزون
            </div>
            {stockMoves.length === 0 ? <EmptyState msg="لا توجد حركات مخزون" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>{['الصنف', 'نوع الحركة', 'الكمية', 'التاريخ', 'ملاحظات'].map(h => <th key={h} className={TH}>{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {stockMoves.slice(0, 50).map(mv => {
                      const item = invItems.find(i => i.id === mv.itemId);
                      return (
                        <tr key={mv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className={`${TD} font-medium text-slate-800 dark:text-slate-100`}>{item?.name || '—'}</td>
                          <td className={TD}>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              mv.type === 'in' ? 'bg-emerald-100 text-emerald-700' :
                              mv.type === 'out' ? 'bg-rose-100 text-rose-600' :
                              'bg-amber-100 text-amber-600'
                            }`}>
                              {mv.type === 'in' ? 'إضافة' : mv.type === 'out' ? 'خصم' : 'تسوية جرد'}
                            </span>
                          </td>
                          <td className={`${TD} font-bold`}>{mv.quantity}</td>
                          <td className={`${TD} text-slate-500`}>{formatDate(mv.date)}</td>
                          <td className={`${TD} text-slate-400 text-xs max-w-[180px] truncate`}>{mv.notes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─────────────── CUSTOMERS TAB ─────────────── */}
      {tab === 'customers' && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KPI label="إجمالي العملاء"            value={String(customers.length)}                                                    colorClass="text-blue-600 dark:text-blue-400" />
            <KPI label="إجمالي المبيعات (الفترة)"  value={formatCurrency(custRows.reduce((s, c) => s + c.totalSpent, 0))}              colorClass="text-emerald-600" />
            <KPI label="عملاء مدينون"               value={String(customers.filter(c => c.balance > 0).length)}                        colorClass="text-rose-600" />
            <KPI label="إجمالي الديون"              value={formatCurrency(customers.reduce((s, c) => s + c.balance, 0))}               colorClass="text-amber-600" />
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {custRows.length === 0 ? <EmptyState msg="لا يوجد عملاء مطابقون للبحث" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>{['العميل', 'الهاتف', 'طلبات (الفترة)', 'فواتير (الفترة)', 'إجمالي التعاملات', 'الرصيد المستحق'].map(h => <th key={h} className={TH}>{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {custRows.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className={`${TD} font-bold text-slate-800 dark:text-slate-100`}>{c.name}</td>
                        <td className={`${TD} font-mono text-slate-500 text-xs`}>{c.phone}</td>
                        <td className={`${TD} text-center text-slate-600 dark:text-slate-400`}>{c.orderCount}</td>
                        <td className={`${TD} text-center text-slate-600 dark:text-slate-400`}>{c.invoiceCount}</td>
                        <td className={`${TD} font-bold text-emerald-600`}>{formatCurrency(c.totalSpent)}</td>
                        <td className={TD}>
                          <span className={`font-bold text-sm ${c.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {formatCurrency(c.balance)}
                          </span>
                          {c.balance > 0 && (
                            <span className="mr-2 text-xs bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full font-bold">مدين</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─────────────── SUPPLIERS TAB ─────────────── */}
      {tab === 'suppliers' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KPI label="إجمالي الموردين"            value={String(suppliers.length)}                                                      colorClass="text-blue-600 dark:text-blue-400" />
            <KPI label="إجمالي المشتريات (الفترة)"  value={formatCurrency(suppRows.reduce((s, ss) => s + ss.totalPurchased, 0))}          colorClass="text-amber-600" />
            <KPI label="إجمالي الديون للموردين"     value={formatCurrency(suppRows.reduce((s, ss) => s + ss.debtRemaining, 0))}           colorClass="text-rose-600" />
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {suppRows.length === 0 ? <EmptyState msg="لا يوجد موردون مطابقون للبحث" /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>{['المورد', 'الهاتف', 'نوع التوريد', 'مشتريات (الفترة)', 'إجمالي المشتريات', 'الديون المستحقة'].map(h => <th key={h} className={TH}>{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {suppRows.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className={`${TD} font-bold text-slate-800 dark:text-slate-100`}>{s.name}</td>
                        <td className={`${TD} font-mono text-slate-500 text-xs`}>{s.phone}</td>
                        <td className={`${TD} text-slate-500`}>{s.supplyType || '—'}</td>
                        <td className={`${TD} text-center text-slate-600 dark:text-slate-400`}>{s.purchaseCount}</td>
                        <td className={`${TD} font-bold text-amber-600`}>{formatCurrency(s.totalPurchased)}</td>
                        <td className={TD}>
                          <span className={`font-bold text-sm ${s.debtRemaining > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {formatCurrency(s.debtRemaining)}
                          </span>
                          {s.debtRemaining > 0 && (
                            <span className="mr-2 text-xs bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full font-bold">مستحق</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─────────────── DEBTS TAB ─────────────── */}
      {tab === 'debts' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KPI label="ديون العملاء"     value={formatCurrency(custDebtRows.reduce((s, i) => s + i.remaining, 0))} colorClass="text-rose-600"   sub={`${custDebtRows.length} فاتورة معلقة`} />
            <KPI label="ديون الموردين"    value={formatCurrency(suppDebtRows.reduce((s, p) => s + p.remaining, 0))} colorClass="text-amber-600"  sub={`${suppDebtRows.length} مشتريات معلقة`} />
            <KPI label="مدفوعات الفترة"   value={formatCurrency(paymentsRows.reduce((s, p) => s + p.amount, 0))}   colorClass="text-emerald-600" sub={`${paymentsRows.length} دفعة`} />
          </div>

          {/* Customer debts */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-rose-500">person</span>
              ديون العملاء ({custDebtRows.length})
            </div>
            {custDebtRows.length === 0 ? (
              <div className="p-10 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-200 dark:text-slate-700 block mb-2">check_circle</span>
                <p className="text-slate-400">لا توجد ديون مستحقة على العملاء</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>{['العميل', 'رقم الفاتورة', 'التاريخ', 'الإجمالي', 'المدفوع', 'المتبقي', 'التقدم'].map(h => <th key={h} className={TH}>{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {custDebtRows.map(inv => {
                      const pct = inv.total > 0 ? Math.round((inv.paid / inv.total) * 100) : 0;
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className={`${TD} font-bold text-slate-800 dark:text-slate-100`}>{custMap[inv.customerId]?.name || '—'}</td>
                          <td className={`${TD} font-mono font-bold`}>#{inv.invoiceNumber}</td>
                          <td className={`${TD} text-slate-500`}>{formatDate(inv.date)}</td>
                          <td className={`${TD} font-bold`}>{formatCurrency(inv.total)}</td>
                          <td className={`${TD} text-emerald-600 font-bold`}>{formatCurrency(inv.paid)}</td>
                          <td className={`${TD} text-rose-600 font-bold`}>{formatCurrency(inv.remaining)}</td>
                          <td className={`${TD} min-w-[90px]`}>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-0.5">
                              <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-slate-400">{pct}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Supplier debts */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-amber-500">storefront</span>
              ديون الموردين ({suppDebtRows.length})
            </div>
            {suppDebtRows.length === 0 ? (
              <div className="p-10 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-200 dark:text-slate-700 block mb-2">check_circle</span>
                <p className="text-slate-400">لا توجد مبالغ مستحقة للموردين</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>{['المورد', 'رقم الشراء', 'التاريخ', 'الإجمالي', 'المدفوع', 'المتبقي', 'التقدم'].map(h => <th key={h} className={TH}>{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {suppDebtRows.map(pur => {
                      const pct = pur.total > 0 ? Math.round((pur.paid / pur.total) * 100) : 0;
                      return (
                        <tr key={pur.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className={`${TD} font-bold text-slate-800 dark:text-slate-100`}>{suppMap[pur.supplierId]?.name || '—'}</td>
                          <td className={`${TD} font-mono font-bold`}>#{pur.purchaseNumber}</td>
                          <td className={`${TD} text-slate-500`}>{formatDate(pur.date)}</td>
                          <td className={`${TD} font-bold`}>{formatCurrency(pur.total)}</td>
                          <td className={`${TD} text-emerald-600 font-bold`}>{formatCurrency(pur.paid)}</td>
                          <td className={`${TD} text-rose-600 font-bold`}>{formatCurrency(pur.remaining)}</td>
                          <td className={`${TD} min-w-[90px]`}>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-0.5">
                              <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-slate-400">{pct}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Payments list */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-emerald-500">payments</span>
              المدفوعات المسجلة في الفترة ({paymentsRows.length})
            </div>
            {paymentsRows.length === 0 ? (
              <div className="p-8 text-center text-slate-400">لا توجد مدفوعات مسجلة في الفترة المحددة</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>{['الجهة', 'النوع', 'المبلغ', 'طريقة الدفع', 'التاريخ', 'ملاحظات'].map(h => <th key={h} className={TH}>{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paymentsRows.map(p => {
                      const name = p.entityType === 'customer'
                        ? custMap[p.entityId]?.name
                        : suppMap[p.entityId]?.name;
                      return (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className={`${TD} font-bold text-slate-800 dark:text-slate-100`}>{name || '—'}</td>
                          <td className={TD}>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              p.entityType === 'customer' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                            }`}>
                              {p.entityType === 'customer' ? 'عميل' : 'مورد'}
                            </span>
                          </td>
                          <td className={`${TD} text-emerald-600 font-bold`}>{formatCurrency(p.amount)}</td>
                          <td className={`${TD} text-slate-500`}>{p.paymentMethod || '—'}</td>
                          <td className={`${TD} text-slate-500`}>{formatDate(p.date)}</td>
                          <td className={`${TD} text-slate-400 text-xs max-w-[160px] truncate`}>{p.notes || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
};
