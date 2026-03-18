import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { formatCurrency, formatDate } from '../../core/utils/formatters';

/* ─── helpers ─── */
const getStatusColor = (status: string) => {
  switch (status) {
    case 'new': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'in_progress': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'ready': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'installed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    default: return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  }
};
const getStatusLabel = (status: string) => {
  switch (status) {
    case 'new': return 'جديدة';
    case 'in_progress': return 'قيد الإنجاز';
    case 'ready': return 'جاهزة';
    case 'installed': return 'مكتملة';
    default: return status;
  }
};

const todayStart = () => {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
};
const monthStart = () => {
  const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime();
};

/* ─── Main Component ─── */
export const DashboardPage = () => {
  const navigate = useNavigate();

  /* Live queries */
  const invoices   = useLiveQuery(() => db.invoices.toArray(), []);
  const orders     = useLiveQuery(() => db.orders.orderBy('createdAt').reverse().toArray(), []);
  const customers  = useLiveQuery(() => db.customers.toArray(), []);
  const purchases  = useLiveQuery(() => db.purchases.toArray(), []);
  const inventory  = useLiveQuery(() => db.inventory.toArray(), []);
  const payments   = useLiveQuery(() => db.payments.orderBy('createdAt').reverse().toArray(), []);

  /* Computed KPIs */
  const today = todayStart();
  const month = monthStart();

  const todaySales = useMemo(() =>
    (invoices || []).filter(i =>
      new Date(i.date).getTime() >= today &&
      i.status !== 'cancelled'
    ).reduce((s, i) => s + i.total, 0)
  , [invoices, today]);

  const monthSales = useMemo(() =>
    (invoices || []).filter(i =>
      new Date(i.date).getTime() >= month &&
      i.status !== 'cancelled'
    ).reduce((s, i) => s + i.total, 0)
  , [invoices, month]);

  const customerDebt = useMemo(() =>
    (invoices || []).filter(i => i.remaining > 0).reduce((s, i) => s + i.remaining, 0)
  , [invoices]);

  const supplierDebt = useMemo(() =>
    (purchases || []).filter(p => p.remaining > 0).reduce((s, p) => s + p.remaining, 0)
  , [purchases]);

  const ordersNew        = useMemo(() => (orders || []).filter(o => o.status === 'new').length, [orders]);
  const ordersInProgress = useMemo(() => (orders || []).filter(o => o.status === 'in_progress').length, [orders]);
  const ordersReady      = useMemo(() => (orders || []).filter(o => o.status === 'ready').length, [orders]);
  const ordersMonthDone  = useMemo(() =>
    (orders || []).filter(o => o.status === 'installed' && new Date(o.date).getTime() >= month).length
  , [orders, month]);

  const lowStockItems = useMemo(() =>
    (inventory || []).filter(i => i.minStock > 0 && i.quantity <= i.minStock)
  , [inventory]);

  const overdueOrders = useMemo(() =>
    (orders || []).filter(o =>
      o.expectedDeliveryDate &&
      new Date(o.expectedDeliveryDate).getTime() < today &&
      o.status !== 'installed'
    )
  , [orders, today]);

  /* Recent 5 orders enriched with customer name */
  const recentOrders = useMemo(() => {
    const customerMap = Object.fromEntries((customers || []).map(c => [c.id, c.name]));
    return (orders || []).slice(0, 5).map(o => ({
      ...o,
      customerName: customerMap[o.customerId] || 'عميل محذوف',
    }));
  }, [orders, customers]);

  /* Recent 5 payments enriched */
  const recentPayments = useMemo(() => {
    const customerMap = Object.fromEntries((customers || []).map(c => [c.id, c.name]));
    return (payments || []).slice(0, 5).map(p => ({
      ...p,
      entityName: customerMap[p.entityId] || (p.entityType === 'customer' ? 'عميل' : 'مورد'),
    }));
  }, [payments, customers]);

  /* alerts */
  const alerts = useMemo(() => {
    const list: { type: 'error' | 'warning' | 'info'; icon: string; text: string; route: string }[] = [];
    if (ordersReady > 0)
      list.push({ type: 'warning', icon: 'local_shipping', text: `${ordersReady} طلب/طلبات جاهزة للتسليم`, route: '/orders' });
    if (lowStockItems.length > 0)
      list.push({ type: 'error', icon: 'warning', text: `${lowStockItems.length} صنف وصل لحد الإنذار في المخزون`, route: '/inventory' });
    if (overdueOrders.length > 0)
      list.push({ type: 'error', icon: 'schedule', text: `${overdueOrders.length} طلب تجاوز تاريخ التسليم المتوقع`, route: '/orders' });
    if (customerDebt > 0)
      list.push({ type: 'info', icon: 'account_balance_wallet', text: `ديون عملاء مستحقة: ${formatCurrency(customerDebt)}`, route: '/payments' });
    return list;
  }, [ordersReady, lowStockItems, overdueOrders, customerDebt]);

  const alertColors = {
    error:   { bar: 'bg-rose-500', bg: 'bg-rose-50 dark:bg-rose-900/10', text: 'text-rose-700 dark:text-rose-400', icon: 'text-rose-500' },
    warning: { bar: 'bg-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/10', text: 'text-amber-700 dark:text-amber-400', icon: 'text-amber-500' },
    info:    { bar: 'bg-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/10', text: 'text-blue-700 dark:text-blue-400', icon: 'text-blue-500' },
  };

  return (
    <>
      {/* ══ Section 1: Quick Actions ══ */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-5">
        <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-lg text-primary">bolt</span>
          إجراءات سريعة
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: 'طلب جديد',     icon: 'shopping_bag',     route: '/orders' },
            { label: 'فاتورة جديدة', icon: 'description',       route: '/invoices' },
            { label: 'استلام دفعة',  icon: 'payments',          route: '/payments' },
            { label: 'عميل جديد',    icon: 'person_add',        route: '/customers' },
            { label: 'مشتريات',      icon: 'receipt_long',      route: '/purchases' },
            { label: 'جرد مخزون',    icon: 'inventory',         route: '/inventory' },
          ].map(action => (
            <button
              key={action.route}
              onClick={() => navigate(action.route)}
              className="flex flex-col items-center gap-2.5 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-primary/10 dark:hover:bg-primary/10 hover:text-primary border border-transparent hover:border-primary/20 transition-all group"
            >
              <span className="material-symbols-outlined text-3xl text-slate-400 dark:text-slate-500 group-hover:text-primary transition-colors">{action.icon}</span>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 group-hover:text-primary transition-colors text-center">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ══ Section 2: Financial KPIs ══ */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">bar_chart</span>
          نظرة مالية
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'مبيعات اليوم',     value: formatCurrency(todaySales),    icon: 'today',             color: 'emerald', route: '/invoices', zero: todaySales === 0 },
            { label: 'مبيعات الشهر',     value: formatCurrency(monthSales),    icon: 'calendar_month',    color: 'blue',    route: '/invoices', zero: monthSales === 0 },
            { label: 'ديون العملاء',     value: formatCurrency(customerDebt),  icon: 'money_off',         color: 'amber',   route: '/payments', zero: customerDebt === 0 },
            { label: 'ديون للموردين',    value: formatCurrency(supplierDebt),  icon: 'account_balance',   color: 'rose',    route: '/purchases', zero: supplierDebt === 0 },
          ].map((kpi, i) => (
            <button
              key={i}
              onClick={() => navigate(kpi.route)}
              className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary/30 transition-all text-right group w-full"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-${kpi.color}-100 dark:bg-${kpi.color}-900/30 text-${kpi.color}-600 dark:text-${kpi.color}-400 flex items-center justify-center`}>
                  <span className="material-symbols-outlined text-xl">{kpi.icon}</span>
                </div>
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-700 group-hover:text-primary transition-colors">arrow_forward_ios</span>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">{kpi.label}</p>
              <p className={`text-xl font-bold tracking-tight ${kpi.zero ? 'text-slate-400 dark:text-slate-600' : 'text-slate-800 dark:text-slate-100'}`}>
                {kpi.value}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ══ Section 3: Orders KPIs ══ */}
      <div>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-base">shopping_bag</span>
          حالة الطلبات
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'طلبات جديدة',        value: ordersNew,        icon: 'fiber_new',        color: 'blue',    route: '/orders' },
            { label: 'قيد التنفيذ',         value: ordersInProgress, icon: 'construction',     color: 'amber',   route: '/orders' },
            { label: 'جاهزة للتسليم',       value: ordersReady,      icon: 'local_shipping',   color: 'purple',  route: '/orders' },
            { label: 'مكتملة هذا الشهر',    value: ordersMonthDone,  icon: 'task_alt',         color: 'emerald', route: '/orders' },
          ].map((kpi, i) => (
            <button
              key={i}
              onClick={() => navigate(kpi.route)}
              className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary/30 transition-all text-right group w-full"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl bg-${kpi.color}-100 dark:bg-${kpi.color}-900/30 text-${kpi.color}-600 dark:text-${kpi.color}-400 flex items-center justify-center`}>
                  <span className="material-symbols-outlined text-xl">{kpi.icon}</span>
                </div>
                {kpi.value > 0 && (
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-${kpi.color}-100 text-${kpi.color}-700 dark:bg-${kpi.color}-900/30 dark:text-${kpi.color}-400`}>
                    {kpi.value}
                  </span>
                )}
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">{kpi.label}</p>
              <p className={`text-3xl font-bold tracking-tight ${kpi.value === 0 ? 'text-slate-300 dark:text-slate-700' : 'text-slate-800 dark:text-slate-100'}`}>
                {kpi.value}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* ══ Section 4: Alerts ══ */}
      {alerts.length > 0 && (
        <div>
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-amber-500">notifications_active</span>
            تنبيهات تحتاج انتباهك
          </h2>
          <div className="space-y-2">
            {alerts.map((alert, i) => {
              const c = alertColors[alert.type];
              return (
                <button
                  key={i}
                  onClick={() => navigate(alert.route)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-r-4 ${c.bar} ${c.bg} hover:opacity-90 transition-opacity text-right`}
                >
                  <span className={`material-symbols-outlined text-2xl ${c.icon}`}>{alert.icon}</span>
                  <span className={`text-sm font-bold flex-1 ${c.text}`}>{alert.text}</span>
                  <span className="material-symbols-outlined text-slate-400 text-lg">arrow_forward_ios</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {alerts.length === 0 && (orders?.length || 0) > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
          <span className="material-symbols-outlined text-emerald-500 text-2xl">check_circle</span>
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">كل شيء على ما يرام — لا توجد تنبيهات اليوم</span>
        </div>
      )}

      {/* ══ Section 5: Tables Row ══ */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Recent Orders */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">receipt_long</span>
              آخر الطلبات
            </h2>
            <button onClick={() => navigate('/orders')} className="text-sm text-primary font-bold hover:underline flex items-center gap-1">
              عرض الكل
              <span className="material-symbols-outlined text-base">arrow_back_ios</span>
            </button>
          </div>
          {recentOrders.length === 0 ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-5xl text-slate-200 dark:text-slate-700 block mb-3">shopping_bag</span>
              <p className="text-slate-400 text-sm">لا توجد طلبات بعد</p>
              <button onClick={() => navigate('/orders')} className="mt-3 text-primary font-bold text-sm hover:underline">إنشاء أول طلب</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-xs font-bold uppercase">
                  <tr>
                    <th className="px-5 py-3">الطلب</th>
                    <th className="px-5 py-3">العميل</th>
                    <th className="px-5 py-3">الحالة</th>
                    <th className="px-5 py-3">المتبقي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => navigate('/orders')}>
                      <td className="px-5 py-3 font-bold text-primary text-sm" dir="ltr">#{order.orderNumber}</td>
                      <td className="px-5 py-3 text-slate-800 dark:text-slate-100 text-sm">{order.customerName}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm font-bold">
                        {order.remaining > 0
                          ? <span className="text-rose-600 dark:text-rose-400">{formatCurrency(order.remaining)}</span>
                          : <span className="text-slate-400">خالصة</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Payments */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-xl">payments</span>
              آخر المدفوعات
            </h2>
            <button onClick={() => navigate('/payments')} className="text-sm text-primary font-bold hover:underline flex items-center gap-1">
              عرض الكل
              <span className="material-symbols-outlined text-base">arrow_back_ios</span>
            </button>
          </div>
          {recentPayments.length === 0 ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-5xl text-slate-200 dark:text-slate-700 block mb-3">payments</span>
              <p className="text-slate-400 text-sm">لم تُسجَّل أي مدفوعات بعد</p>
              <button onClick={() => navigate('/payments')} className="mt-3 text-primary font-bold text-sm hover:underline">تسجيل دفعة</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-xs font-bold uppercase">
                  <tr>
                    <th className="px-5 py-3">التاريخ</th>
                    <th className="px-5 py-3">الطرف</th>
                    <th className="px-5 py-3">النوع</th>
                    <th className="px-5 py-3">المبلغ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {recentPayments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400 text-xs">{formatDate(p.date)}</td>
                      <td className="px-5 py-3 font-bold text-slate-800 dark:text-slate-100 text-sm">{p.entityName}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.entityType === 'customer' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                          {p.entityType === 'customer' ? 'من عميل' : 'للمورد'}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-bold text-emerald-600 dark:text-emerald-400 text-sm">{formatCurrency(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </>
  );
};
