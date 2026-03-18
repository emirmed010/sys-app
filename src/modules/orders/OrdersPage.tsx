import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { Modal } from '../../shared/components/Modal';
import { OrderForm } from './OrderForm';
import { formatCurrency, formatDate, generateId } from '../../core/utils/formatters';
import type { Order } from '../../core/types';

/* ─── constants ─── */
const STATUS_OPTIONS = [
  { value: '',           label: 'كل الحالات' },
  { value: 'new',        label: 'طلب جديد' },
  { value: 'in_progress',label: 'قيد التنفيذ' },
  { value: 'ready',      label: 'جاهز' },
  { value: 'installed',  label: 'تم التركيب' },
  { value: 'cancelled',  label: 'ملغي' },
];

const NEXT_STATUSES: Record<Order['status'], { value: Order['status']; label: string }[]> = {
  new:         [{ value: 'in_progress', label: 'قيد التنفيذ' }, { value: 'cancelled', label: 'ملغي' }],
  in_progress: [{ value: 'ready',       label: 'جاهز' },         { value: 'cancelled', label: 'ملغي' }],
  ready:       [{ value: 'installed',   label: 'تم التركيب' },  { value: 'in_progress', label: 'إعادة للتنفيذ' }, { value: 'cancelled', label: 'ملغي' }],
  installed:   [],
  cancelled:   [],
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'new':         return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 'in_progress': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'ready':       return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 'installed':   return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    case 'cancelled':   return 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400';
    default:            return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'new':         return 'طلب جديد';
    case 'in_progress': return 'قيد التنفيذ';
    case 'ready':       return 'جاهز';
    case 'installed':   return 'تم التركيب';
    case 'cancelled':   return 'ملغي';
    default:            return status;
  }
};

/* ─── Component ─── */
export const OrdersPage = () => {
  /* modal state */
  const [isFormOpen,    setIsFormOpen]    = useState(false);
  const [isStatusOpen,  setIsStatusOpen]  = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);
  const [editingOrder,  setEditingOrder]  = useState<any>(undefined);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  /* filter state */
  const [searchTerm,   setSearchTerm]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');

  /* payment form state */
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('نقدي');
  const [paymentNotes,  setPaymentNotes]  = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  /* invoice form state */
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [invoiceLoading,  setInvoiceLoading]  = useState(false);

  /* ── live data ── */
  const orders = useLiveQuery(async () => {
    const allOrders = await db.orders.orderBy('createdAt').reverse().toArray();

    const result = await Promise.all(allOrders.map(async order => {
      const customer = await db.customers.get(order.customerId);
      const items    = await db.orderItems.where('orderId').equals(order.id).toArray();
      const invoice  = await db.invoices.where('orderId').equals(order.id).first();
      return {
        ...order,
        customerName:  customer?.name  || 'عميل محذوف',
        customerPhone: customer?.phone || '',
        items,
        hasInvoice: !!invoice,
        invoiceId:  invoice?.id,
      };
    }));

    return result.filter(o => {
      if (statusFilter && o.status !== statusFilter) return false;
      if (searchTerm && !o.customerName.includes(searchTerm) && !o.orderNumber.toString().includes(searchTerm) && !((o as any).description || '').includes(searchTerm)) return false;
      if (dateFrom && new Date(o.date) < new Date(dateFrom)) return false;
      if (dateTo   && new Date(o.date) > new Date(dateTo + 'T23:59:59')) return false;
      return true;
    });
  }, [searchTerm, statusFilter, dateFrom, dateTo]);

  const allOrdersRaw = useLiveQuery(() => db.orders.toArray(), []);
  const kpi = {
    new:        (allOrdersRaw || []).filter(o => o.status === 'new').length,
    in_progress:(allOrdersRaw || []).filter(o => o.status === 'in_progress').length,
    ready:      (allOrdersRaw || []).filter(o => o.status === 'ready').length,
    debt:       (allOrdersRaw || []).filter(o => o.status !== 'cancelled').reduce((s, o) => s + (o.remaining || 0), 0),
  };

  /* ── handlers ── */
  const handleEdit = (order: any) => {
    setEditingOrder(order);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string, orderNum: number, status: string, hasInvoice: boolean) => {
    if (hasInvoice) {
      alert('لا يمكن حذف هذا الطلب لأن فاتورة مرتبطة به.');
      return;
    }
    if (!['new', 'cancelled'].includes(status)) {
      alert('لا يمكن حذف هذا الطلب. يُسمح بحذف الطلبات الجديدة أو الملغاة فقط.');
      return;
    }
    if (!window.confirm(`هل أنت متأكد من حذف الطلب رقم ${orderNum}؟`)) return;
    await db.transaction('rw', db.orders, db.orderItems, async () => {
      await db.orders.delete(id);
      await db.orderItems.where('orderId').equals(id).delete();
    });
  };

  const handlePrint = async (order: any) => {
    const settings = await db.settings.toCollection().first();
    const wsName    = settings?.workshopName || 'ورشة الألومنيوم';
    const wsPhone   = settings?.phone        || '';
    const wsAddress = settings?.address      || '';
    const footer    = settings?.invoiceFooterText || 'شكراً لثقتكم — نتمنى أن تكونوا راضين عن خدماتنا';

    const rows = (order.items || []).map((item: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.name}${item.description ? '<br/><small style="color:#666">' + item.description + '</small>' : ''}</td>
        <td>${item.quantity}</td>
        <td>${item.unitPrice.toLocaleString('ar-DZ', { minimumFractionDigits: 2 })}</td>
        <td>${item.lineTotal.toLocaleString('ar-DZ', { minimumFractionDigits: 2 })}</td>
      </tr>`).join('');

    const deliveryDate = order.expectedDeliveryDate
      ? new Date(order.expectedDeliveryDate).toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' })
      : '—';

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<title>طلبية #${order.orderNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 13px; color: #1e293b; background: #fff; padding: 24px; direction: rtl; }
  .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
  .header h1 { font-size: 20px; font-weight: bold; }
  .header p { font-size: 12px; color: #475569; margin-top: 3px; }
  .title { text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 16px; background: #f1f5f9; padding: 8px; border-radius: 6px; }
  .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
  .meta-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
  .meta-box h3 { font-size: 11px; font-weight: bold; color: #64748b; margin-bottom: 6px; text-transform: uppercase; }
  .meta-box p { font-size: 13px; color: #1e293b; margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  thead { background: #0f172a; color: #fff; }
  thead th { padding: 8px 10px; font-size: 12px; }
  tbody td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  .totals { margin-right: auto; width: 260px; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin-bottom: 16px; }
  .totals table { margin: 0; }
  .totals td { padding: 7px 12px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
  .totals .remaining td { background: #fff1f2; font-weight: bold; color: #be123c; }
  .totals .paid-row td { background: #f0fdf4; color: #166534; }
  .delivery { text-align: center; font-size: 14px; font-weight: bold; border: 1px dashed #94a3b8; padding: 10px; border-radius: 6px; margin-bottom: 16px; }
  .sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 8px; }
  .sig-box { border-top: 1px solid #475569; padding-top: 6px; text-align: center; font-size: 11px; color: #64748b; }
  .footer { text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 16px; }
  @media print { body { padding: 10px; } }
</style>
</head>
<body>
<div class="header">
  <h1>${wsName}</h1>
  <p>${[wsPhone, wsAddress].filter(Boolean).join(' — ')}</p>
</div>
<div class="title">وصل استلام طلبية</div>
<div class="meta-grid">
  <div class="meta-box">
    <h3>بيانات الطلبية</h3>
    <p>رقم الطلب: <strong>#${order.orderNumber}</strong></p>
    <p>التاريخ: ${new Date(order.date).toLocaleDateString('ar-DZ', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
    ${(order as any).description ? '<p>الوصف: ' + (order as any).description + '</p>' : ''}
  </div>
  <div class="meta-box">
    <h3>بيانات العميل</h3>
    <p>${order.customerName}</p>
    ${order.customerPhone ? '<p>' + order.customerPhone + '</p>' : ''}
  </div>
</div>
<table>
  <thead><tr><th>#</th><th>البند</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="totals">
  <table>
    <tr><td>الإجمالي</td><td><strong>${order.total.toLocaleString('ar-DZ', { minimumFractionDigits: 2 })} د.ج</strong></td></tr>
    <tr class="paid-row"><td>العربون المدفوع</td><td><strong>${(order.deposit || 0).toLocaleString('ar-DZ', { minimumFractionDigits: 2 })} د.ج</strong></td></tr>
    <tr class="remaining"><td>المتبقي</td><td>${(order.remaining || 0).toLocaleString('ar-DZ', { minimumFractionDigits: 2 })} د.ج</td></tr>
  </table>
</div>
<div class="delivery">📅 تاريخ التسليم المتوقع: ${deliveryDate}</div>
${order.notes ? '<p style="font-size:12px;color:#475569;margin-bottom:14px">ملاحظات: ' + order.notes + '</p>' : ''}
<div class="sigs">
  <div class="sig-box">توقيع العميل</div>
  <div class="sig-box">توقيع الورشة</div>
</div>
<div class="footer">${footer}</div>
</body></html>`;

    const win = window.open('', '_blank', 'width=800,height=900');
    if (!win) { alert('يرجى السماح بالنوافذ المنبثقة لإتمام الطباعة'); return; }
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.focus(); win.print(); };
  };

  const openStatusModal = (order: any) => { setSelectedOrder(order); setIsStatusOpen(true); };

  const handleStatusChange = async (newStatus: Order['status']) => {
    if (!selectedOrder) return;
    await db.orders.update(selectedOrder.id, { status: newStatus });
    setIsStatusOpen(false);
    setSelectedOrder(null);
  };

  const openPaymentModal = (order: any) => {
    setSelectedOrder(order);
    setPaymentAmount('');
    setPaymentMethod('نقدي');
    setPaymentNotes('');
    setIsPaymentOpen(true);
  };

  const handleRegisterPayment = async () => {
    if (!selectedOrder || !paymentAmount || Number(paymentAmount) <= 0) return;
    setPaymentLoading(true);
    try {
      const amount = Number(paymentAmount);
      await db.transaction('rw', [db.orders, db.payments], async () => {
        await db.payments.add({
          id:            generateId(),
          entityType:    'customer',
          entityId:      selectedOrder.customerId,
          amount,
          date:          new Date().toISOString(),
          paymentMethod,
          referenceId:   selectedOrder.id,
          notes:         paymentNotes || `دفعة على الطلبية #${selectedOrder.orderNumber}`,
          createdAt:     Date.now(),
        });
        const newRemaining = Math.max(0, (selectedOrder.remaining || 0) - amount);
        await db.orders.update(selectedOrder.id, {
          deposit:   (selectedOrder.deposit || 0) + amount,
          remaining: newRemaining,
        });
      });
      setIsPaymentOpen(false);
    } catch {
      alert('حدث خطأ أثناء تسجيل الدفعة');
    } finally {
      setPaymentLoading(false);
    }
  };

  const openInvoiceModal = (order: any) => {
    setSelectedOrder(order);
    setInvoiceDiscount(0);
    setIsInvoiceOpen(true);
  };

  const handleCreateInvoice = async () => {
    if (!selectedOrder) return;
    setInvoiceLoading(true);
    try {
      const items    = selectedOrder.items || [];
      const subtotal = items.reduce((s: number, i: any) => s + (i.lineTotal || 0), 0);
      const total    = Math.max(0, subtotal - invoiceDiscount);
      const paid     = selectedOrder.deposit || 0;
      const remaining = Math.max(0, total - paid);

      await db.transaction('rw', [db.invoices, db.invoiceItems, db.orders], async () => {
        const invoiceId = generateId();
        await db.invoices.add({
          id:            invoiceId,
          invoiceNumber: Date.now(),
          orderId:       selectedOrder.id,
          customerId:    selectedOrder.customerId,
          date:          new Date().toISOString(),
          subtotal,
          discount:      invoiceDiscount,
          total,
          paid,
          remaining,
          status:        'issued',
          notes:         selectedOrder.notes,
          createdAt:     Date.now(),
        });
        await db.invoiceItems.bulkAdd(
          items.map((item: any) => ({
            id:        generateId(),
            invoiceId,
            type:      item.type,
            itemId:    item.itemId,
            subtypeId: item.subtypeId,
            name:      item.name,
            quantity:  item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          }))
        );
        await db.orders.update(selectedOrder.id, { status: 'installed' });
      });
      setIsInvoiceOpen(false);
      alert('تم إنشاء الفاتورة بنجاح وتم تحديث حالة الطلب إلى "تم التركيب"');
    } catch {
      alert('حدث خطأ أثناء إنشاء الفاتورة');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const hasActiveFilters = !!(searchTerm || statusFilter || dateFrom || dateTo);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  /* ── render ── */
  return (
    <>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-3xl">shopping_cart</span>
            إدارة الطلبات
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">متابعة مشاريع العملاء من التصنيع وحتى التركيب</p>
        </div>
        <button
          onClick={() => { setEditingOrder(undefined); setIsFormOpen(true); }}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-xl">add_shopping_cart</span>
          إضافة طلب جديد
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[
          { label: 'طلبات جديدة',    value: kpi.new,                    icon: 'fiber_new',              color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-900/20',   filter: 'new' },
          { label: 'قيد التنفيذ',    value: kpi.in_progress,            icon: 'build',                  color: 'text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-900/20', filter: 'in_progress' },
          { label: 'جاهزة للتسليم',  value: kpi.ready,                  icon: 'inventory_2',            color: 'text-purple-600 dark:text-purple-400',bg: 'bg-purple-50 dark:bg-purple-900/20',filter: 'ready' },
          { label: 'ديون العملاء',   value: formatCurrency(kpi.debt),   icon: 'account_balance_wallet', color: 'text-rose-600 dark:text-rose-400',    bg: 'bg-rose-50 dark:bg-rose-900/20',   filter: null },
        ].map((card, i) => (
          <button
            key={i}
            onClick={() => card.filter !== null && setStatusFilter(statusFilter === card.filter ? '' : card.filter!)}
            className={`${card.bg} rounded-xl p-4 text-right border transition-all hover:shadow-sm ${card.filter ? 'cursor-pointer' : 'cursor-default'} ${statusFilter === card.filter && card.filter ? 'border-primary ring-2 ring-primary/20' : 'border-transparent'}`}
          >
            <span className={`material-symbols-outlined text-2xl ${card.color}`}>{card.icon}</span>
            <div className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{card.label}</div>
          </button>
        ))}
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">

        {/* Filters */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <span className="material-symbols-outlined absolute right-3 top-2.5 text-slate-400 text-xl pointer-events-none">search</span>
              <input
                type="text"
                className="w-full pr-10 pl-4 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm focus:ring-2 focus:ring-primary/20 placeholder:text-slate-400 dark:text-slate-100"
                placeholder="بحث برقم الطلب أو اسم العميل أو الوصف..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm dark:text-slate-100 text-right min-w-[140px]"
            >
              {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <input
              type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} dir="ltr" title="من تاريخ"
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm dark:text-slate-100"
            />
            <input
              type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} dir="ltr" title="إلى تاريخ"
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm dark:text-slate-100"
            />
            {hasActiveFilters && (
              <button
                onClick={() => { setSearchTerm(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); }}
                className="px-3 py-2 text-sm text-slate-500 hover:text-rose-500 bg-slate-50 dark:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
              >
                مسح الفلاتر
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase">
              <tr>
                <th className="px-4 py-3">رقم الطلب</th>
                <th className="px-4 py-3">العميل</th>
                <th className="px-4 py-3">التاريخ</th>
                <th className="px-4 py-3">تاريخ التسليم</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">الإجمالي</th>
                <th className="px-4 py-3">المتبقي</th>
                <th className="px-4 py-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {!orders && (
                <tr><td colSpan={8} className="py-8 text-center text-slate-500 dark:text-slate-400">جاري التحميل...</td></tr>
              )}
              {orders && orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 block mb-3">production_quantity_limits</span>
                    <p>لا توجد طلبات مطابقة</p>
                  </td>
                </tr>
              )}
              {orders && orders.map(order => {
                const isOverdue = order.expectedDeliveryDate &&
                  new Date(order.expectedDeliveryDate) < todayStart &&
                  !['installed', 'cancelled'].includes(order.status);

                return (
                  <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">

                    {/* Order number */}
                    <td className="px-4 py-3 font-bold text-primary dark:text-primary">
                      <span dir="ltr">#{order.orderNumber}</span>
                    </td>

                    {/* Customer */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800 dark:text-slate-100 text-sm">{order.customerName}</div>
                      {order.customerPhone && <div className="text-xs text-slate-400 dark:text-slate-500">{order.customerPhone}</div>}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-sm">{formatDate(order.date)}</td>

                    {/* Delivery date */}
                    <td className="px-4 py-3 text-sm">
                      {order.expectedDeliveryDate ? (
                        <span className={isOverdue ? 'text-red-500 dark:text-red-400 font-bold flex items-center gap-0.5' : 'text-slate-500 dark:text-slate-400'}>
                          {isOverdue && <span className="material-symbols-outlined text-sm">warning</span>}
                          {formatDate(order.expectedDeliveryDate)}
                        </span>
                      ) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </td>

                    {/* Total */}
                    <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100 text-sm">{formatCurrency(order.total)}</td>

                    {/* Remaining */}
                    <td className="px-4 py-3">
                      {order.remaining > 0
                        ? <span className="text-rose-600 dark:text-rose-400 font-bold text-sm">{formatCurrency(order.remaining)}</span>
                        : <span className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">خالصة ✓</span>
                      }
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-1 flex-wrap">

                        {/* Print */}
                        <button onClick={() => handlePrint(order)} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" title="طباعة الطلب">
                          <span className="material-symbols-outlined text-xl">print</span>
                        </button>

                        {/* Edit */}
                        {!['installed', 'cancelled'].includes(order.status) && (
                          <button onClick={() => handleEdit(order)} className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="تعديل الطلب">
                            <span className="material-symbols-outlined text-xl">edit</span>
                          </button>
                        )}

                        {/* Change status */}
                        {(NEXT_STATUSES[order.status]?.length ?? 0) > 0 && (
                          <button onClick={() => openStatusModal(order)} className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title="تغيير الحالة">
                            <span className="material-symbols-outlined text-xl">published_with_changes</span>
                          </button>
                        )}

                        {/* Register payment */}
                        {order.remaining > 0 && order.status !== 'cancelled' && (
                          <button onClick={() => openPaymentModal(order)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="تسجيل دفعة">
                            <span className="material-symbols-outlined text-xl">payments</span>
                          </button>
                        )}

                        {/* Convert to invoice */}
                        {!order.hasInvoice && order.status !== 'cancelled' && (
                          <button onClick={() => openInvoiceModal(order)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="إنشاء فاتورة من الطلب">
                            <span className="material-symbols-outlined text-xl">receipt_long</span>
                          </button>
                        )}
                        {order.hasInvoice && (
                          <span className="p-1.5 text-emerald-500 dark:text-emerald-400" title="تم إنشاء فاتورة">
                            <span className="material-symbols-outlined text-xl">task_alt</span>
                          </span>
                        )}

                        {/* Delete */}
                        {['new', 'cancelled'].includes(order.status) && (
                          <button onClick={() => handleDelete(order.id, order.orderNumber, order.status, order.hasInvoice)} className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors" title="حذف الطلب">
                            <span className="material-symbols-outlined text-xl">delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Order Form Modal ── */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingOrder ? `تعديل الطلب #${editingOrder.orderNumber}` : 'إضافة طلب جديد'}
        width="xl"
      >
        <OrderForm
          order={editingOrder}
          onSuccess={() => setIsFormOpen(false)}
          onCancel={() => setIsFormOpen(false)}
        />
      </Modal>

      {/* ── Change Status Modal ── */}
      <Modal isOpen={isStatusOpen} onClose={() => setIsStatusOpen(false)} title="تغيير حالة الطلب" width="sm">
        {selectedOrder && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              الطلب <strong>#{selectedOrder.orderNumber}</strong> — الحالة الحالية:{' '}
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${getStatusColor(selectedOrder.status)}`}>
                {getStatusLabel(selectedOrder.status)}
              </span>
            </p>
            <div className="flex flex-col gap-2">
              {(NEXT_STATUSES[selectedOrder.status as Order['status']] || []).map((ns: { value: Order['status']; label: string }) => (
                <button
                  key={ns.value}
                  onClick={() => handleStatusChange(ns.value)}
                  className={`w-full py-2.5 px-4 rounded-lg text-sm font-bold text-right transition-colors ${getStatusColor(ns.value)} hover:opacity-80`}
                >
                  {ns.label}
                </button>
              ))}
            </div>
            <button onClick={() => setIsStatusOpen(false)} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">إلغاء</button>
          </div>
        )}
      </Modal>

      {/* ── Register Payment Modal ── */}
      <Modal isOpen={isPaymentOpen} onClose={() => setIsPaymentOpen(false)} title="تسجيل دفعة" width="sm">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">الطلب:</span><span className="font-bold">#{selectedOrder.orderNumber} — {selectedOrder.customerName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">الإجمالي:</span><span className="font-bold">{formatCurrency(selectedOrder.total)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">المسدَّد:</span><span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedOrder.deposit)}</span></div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1.5">
                <span className="font-medium text-slate-600 dark:text-slate-300">المتبقي:</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">{formatCurrency(selectedOrder.remaining)}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">المبلغ المدفوع *</label>
              <input type="number" min="0" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)}
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm"
                dir="ltr" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">طريقة الدفع</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm text-right">
                <option>نقدي</option>
                <option>تحويل بنكي</option>
                <option>شيك</option>
                <option>بريد الجزائر</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ملاحظات</label>
              <input type="text" value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="ملاحظة اختيارية..."
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm text-right" />
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setIsPaymentOpen(false)} className="flex-1 py-2 text-sm text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">إلغاء</button>
              <button
                onClick={handleRegisterPayment}
                disabled={paymentLoading || !paymentAmount || Number(paymentAmount) <= 0}
                className="flex-1 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 transition-colors"
              >
                {paymentLoading ? 'جاري الحفظ...' : 'تسجيل الدفعة'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Create Invoice Modal ── */}
      <Modal isOpen={isInvoiceOpen} onClose={() => setIsInvoiceOpen(false)} title="إنشاء فاتورة من الطلب" width="sm">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 text-sm space-y-1.5">
              <div className="flex justify-between"><span className="text-slate-500">الطلب:</span><span className="font-bold">#{selectedOrder.orderNumber} — {selectedOrder.customerName}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">عدد البنود:</span><span className="font-bold">{selectedOrder.items?.length || 0} عنصر</span></div>
              <div className="flex justify-between"><span className="text-slate-500">الإجمالي الفرعي:</span><span className="font-bold">{formatCurrency(selectedOrder.total)}</span></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">الخصم (اختياري)</label>
              <input type="number" min="0" value={invoiceDiscount} onChange={e => setInvoiceDiscount(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm" dir="ltr" />
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-sm space-y-1.5">
              <div className="flex justify-between"><span>إجمالي الفاتورة:</span><span className="font-bold">{formatCurrency(Math.max(0, selectedOrder.total - invoiceDiscount))}</span></div>
              <div className="flex justify-between"><span>المدفوع (عربون):</span><span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(selectedOrder.deposit)}</span></div>
              <div className="flex justify-between border-t border-emerald-200 dark:border-emerald-800 pt-1.5">
                <span className="font-medium">المتبقي:</span>
                <span className={`font-bold ${Math.max(0, selectedOrder.total - invoiceDiscount - selectedOrder.deposit) > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {formatCurrency(Math.max(0, selectedOrder.total - invoiceDiscount - selectedOrder.deposit))}
                </span>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setIsInvoiceOpen(false)} className="flex-1 py-2 text-sm text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">إلغاء</button>
              <button
                onClick={handleCreateInvoice}
                disabled={invoiceLoading || !selectedOrder.items?.length}
                className="flex-1 py-2 text-sm font-bold text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 transition-colors"
              >
                {invoiceLoading ? 'جاري الإنشاء...' : 'إنشاء الفاتورة'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

