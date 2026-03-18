import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { Input } from '../../shared/components/Input';
import { Button } from '../../shared/components/Button';
import { Order, OrderItem } from '../../core/types';
import { db } from '../../data/db';
import { generateId, formatCurrency } from '../../core/utils/formatters';
import { Trash2, Plus } from 'lucide-react';

const orderItemSchema = z.object({
  type: z.enum(['product', 'service']),
  itemId: z.string().min(1, 'اختر العنصر'),
  subtypeId: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  quantity: z.coerce.number().min(1, 'الكمية يجب أن تكون 1 على الأقل'),
  unitPrice: z.coerce.number().min(0, 'السعر يجب أن يكون موجباً'),
});

const orderSchema = z.object({
  customerId: z.string().min(1, 'يجب اختيار عميل'),
  status: z.enum(['new', 'in_progress', 'ready', 'installed', 'cancelled']),
  expectedDeliveryDate: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  deposit: z.coerce.number().min(0, 'العربون يجب أن يكون موجباً'),
  items: z.array(orderItemSchema).min(1, 'يجب إضافة عنصر واحد على الأقل للطلبية'),
});

type OrderFormValues = z.infer<typeof orderSchema>;

interface Props {
  order?: Order & { items: OrderItem[] };
  onSuccess: () => void;
  onCancel: () => void;
}

export const OrderForm = ({ order, onSuccess, onCancel }: Props) => {
  const customers    = useLiveQuery(() => db.customers.orderBy('name').toArray())    ?? [];
  const products     = useLiveQuery(() => db.products.orderBy('name').toArray())     ?? [];
  const allCategories = useLiveQuery(() => db.serviceCategories.orderBy('name').toArray()) ?? [];
  const allSubtypes   = useLiveQuery(() => db.serviceSubtypes.orderBy('name').toArray())   ?? [];

  const serviceCategories = allCategories.filter(c => c.isActive);
  const serviceSubtypes   = allSubtypes.filter(s => s.isActive);

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<OrderFormValues>({
      resolver: zodResolver(orderSchema) as any,
      defaultValues: {
        customerId:           order?.customerId ?? '',
        status:               order?.status ?? 'new',
        expectedDeliveryDate: order?.expectedDeliveryDate
          ? new Date(order.expectedDeliveryDate).toISOString().split('T')[0]
          : '',
        description: (order as any)?.description ?? '',
        notes:       order?.notes ?? '',
        deposit:     order?.deposit ?? 0,
        items: order?.items?.map(i => ({
          type:        i.type,
          itemId:      i.itemId,
          subtypeId:   i.subtypeId ?? '',
          name:        i.name,
          description: (i as any).description ?? '',
          quantity:    i.quantity,
          unitPrice:   i.unitPrice,
        })) ?? [],
      },
    });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  const watchItems      = watch('items');
  const watchCustomerId = watch('customerId');
  const watchDeposit    = watch('deposit') ?? 0;

  const selectedCustomer = customers.find(c => c.id === watchCustomerId);
  const total     = watchItems.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
  const remaining = Math.max(0, total - watchDeposit);

  const handleProductSelect = (index: number, productId: string) => {
    setValue(`items.${index}.itemId`, productId);
    setValue(`items.${index}.subtypeId`, '');
    const p = products.find(x => x.id === productId);
    if (p) {
      setValue(`items.${index}.name`, p.name);
      setValue(`items.${index}.unitPrice`, p.sellingPrice);
    } else {
      setValue(`items.${index}.name`, '');
      setValue(`items.${index}.unitPrice`, 0);
    }
  };

  const handleServiceSelect = (index: number, categoryId: string) => {
    setValue(`items.${index}.itemId`, categoryId);
    const cat = serviceCategories.find(c => c.id === categoryId);
    if (cat) {
      setValue(`items.${index}.name`, cat.name);
      setValue(`items.${index}.subtypeId`, '');
      setValue(`items.${index}.unitPrice`, 0);
    } else {
      setValue(`items.${index}.name`, '');
      setValue(`items.${index}.subtypeId`, '');
      setValue(`items.${index}.unitPrice`, 0);
    }
  };

  const handleSubtypeSelect = (index: number, subtypeId: string) => {
    setValue(`items.${index}.subtypeId`, subtypeId);
    const sub = serviceSubtypes.find(s => s.id === subtypeId);
    if (sub) {
      setValue(`items.${index}.name`, sub.name);
      setValue(`items.${index}.unitPrice`, sub.defaultPrice);
    } else {
      const categoryId = watchItems[index]?.itemId;
      const cat = serviceCategories.find(c => c.id === categoryId);
      setValue(`items.${index}.name`, cat?.name ?? '');
      setValue(`items.${index}.unitPrice`, 0);
    }
  };

  const addItem = (type: 'product' | 'service') =>
    append({ type, itemId: '', subtypeId: '', name: '', description: '', quantity: 1, unitPrice: 0 });

  const onSubmit = async (data: OrderFormValues) => {
    try {
      await db.transaction('rw', db.orders, db.orderItems, db.settings, async () => {
        const orderId    = order?.id ?? generateId();
        const orderTotal = data.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

        let nextNumber = order?.orderNumber;
        if (!order) {
          const settings = await db.settings.get('MASTER');
          const seq = (settings?.orderNumberSequence ?? 0) + 1;
          await db.settings.put({ ...(settings ?? { id: 'MASTER', workshopName: 'ورشة الألمنيوم', phone: '', address: '', currency: 'د.ج', invoiceFooterText: '', orderNumberSequence: 0, invoiceNumberSequence: 0, purchaseNumberSequence: 0 }), orderNumberSequence: seq });
          nextNumber = seq;
        }

        const orderData: any = {
          id:           orderId,
          orderNumber:  nextNumber!,
          customerId:   data.customerId,
          date:         order?.date ?? new Date().toISOString(),
          expectedDeliveryDate: data.expectedDeliveryDate
            ? new Date(data.expectedDeliveryDate + 'T12:00:00').toISOString()
            : undefined,
          status:      data.status,
          deposit:     data.deposit,
          total:       orderTotal,
          remaining:   Math.max(0, orderTotal - data.deposit),
          description: data.description,
          notes:       data.notes,
          createdAt:   order?.createdAt ?? Date.now(),
        };

        if (order) {
          await db.orders.put(orderData);
          await db.orderItems.where('orderId').equals(orderId).delete();
        } else {
          await db.orders.add(orderData);
        }

        await db.orderItems.bulkAdd(
          data.items.map(item => ({
            id:          generateId(),
            orderId,
            type:        item.type,
            itemId:      item.itemId,
            subtypeId:   item.subtypeId || undefined,
            name:        item.name,
            description: item.description,
            quantity:    item.quantity,
            unitPrice:   item.unitPrice,
            lineTotal:   item.quantity * item.unitPrice,
          }))
        );
      });
      onSuccess();
    } catch (err) {
      console.error(err);
      alert('حدث خطأ أثناء حفظ الطلبية');
    }
  };

  const selectCls = 'w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-right';
  const inputCls  = 'w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 text-right';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

      {/* ── Section 1: Order info ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Customer */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">العميل *</label>
          <select {...register('customerId')} className={selectCls}>
            <option value="">اختر عميلاً...</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
            ))}
          </select>
          {errors.customerId && <p className="text-xs text-red-500 mt-0.5">{errors.customerId.message}</p>}
          {selectedCustomer && (
            <div className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-3">
              {selectedCustomer.phone   && <span>📞 {selectedCustomer.phone}</span>}
              {selectedCustomer.address && <span>📍 {selectedCustomer.address}</span>}
            </div>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">حالة الطلب *</label>
          <select {...register('status')} className={selectCls}>
            <option value="new">طلب جديد</option>
            <option value="in_progress">قيد التنفيذ</option>
            <option value="ready">جاهز</option>
            <option value="installed">تم التركيب</option>
            <option value="cancelled">ملغي</option>
          </select>
        </div>

        {/* Expected delivery date */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">تاريخ التسليم المتوقع</label>
          <input
            type="date"
            {...register('expectedDeliveryDate')}
            dir="ltr"
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">وصف الطلب</label>
          <input
            type="text"
            {...register('description')}
            placeholder="وصف مختصر للطلب..."
            className={inputCls}
          />
        </div>
      </div>

      {/* ── Section 2: Items ── */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
            العناصر المطلوبة (منتجات / خدمات)
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => addItem('product')}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> منتج
            </button>
            <button
              type="button"
              onClick={() => addItem('service')}
              className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> خدمة
            </button>
          </div>
        </div>

        {fields.length === 0 && (
          <p className="p-8 text-center text-sm text-slate-400 dark:text-slate-500">
            لا توجد عناصر — استخدم الأزرار أعلاه لإضافة منتج أو خدمة
          </p>
        )}

        {fields.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {fields.map((field, index) => {
              const itype         = watchItems[index]?.type;
              const selectedCatId = watchItems[index]?.itemId;
              const catSubtypes   = serviceSubtypes.filter(s => s.categoryId === selectedCatId);

              return (
                <div key={field.id} className="p-4 space-y-3">
                  {/* Row header */}
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${itype === 'service' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                      {itype === 'service' ? '⚙ خدمة' : '📦 منتج'}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">#{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="mr-auto p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <input type="hidden" {...register(`items.${index}.type`    as const)} />
                  <input type="hidden" {...register(`items.${index}.name`    as const)} />

                  <div className="grid grid-cols-12 gap-3 items-start">

                    {/* Main item selector */}
                    <div className={`col-span-12 ${itype === 'service' && catSubtypes.length > 0 ? 'md:col-span-3' : 'md:col-span-5'}`}>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        {itype === 'service' ? 'الخدمة الرئيسية' : 'المنتج'}
                      </label>
                      {itype === 'service' ? (
                        <select
                          {...register(`items.${index}.itemId` as const)}
                          onChange={e => handleServiceSelect(index, e.target.value)}
                          className={selectCls}
                        >
                          <option value="">اختر الخدمة...</option>
                          {serviceCategories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      ) : (
                        <select
                          {...register(`items.${index}.itemId` as const)}
                          onChange={e => handleProductSelect(index, e.target.value)}
                          className={selectCls}
                        >
                          <option value="">اختر المنتج...</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({formatCurrency(p.sellingPrice)})
                            </option>
                          ))}
                        </select>
                      )}
                      {errors?.items?.[index]?.itemId && (
                        <p className="text-xs text-red-500 mt-0.5">{errors.items[index]?.itemId?.message}</p>
                      )}
                    </div>

                    {/* Subtype (services with available subtypes) */}
                    {itype === 'service' && catSubtypes.length > 0 && (
                      <div className="col-span-12 md:col-span-3">
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">النوع الفرعي</label>
                        <select
                          {...register(`items.${index}.subtypeId` as const)}
                          onChange={e => handleSubtypeSelect(index, e.target.value)}
                          className={selectCls}
                        >
                          <option value="">بدون نوع فرعي</option>
                          {catSubtypes.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} ({formatCurrency(s.defaultPrice)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Description / measurements */}
                    <div className="col-span-12 md:col-span-3">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">وصف / قياسات</label>
                      <input
                        type="text"
                        {...register(`items.${index}.description` as const)}
                        placeholder="مثال: 120×200 سم"
                        className={inputCls}
                      />
                    </div>

                    {/* Quantity */}
                    <div className="col-span-5 md:col-span-1">
                      <Input
                        type="number"
                        label="الكمية"
                        {...register(`items.${index}.quantity` as const)}
                        dir="ltr"
                        className="text-center"
                      />
                    </div>

                    {/* Unit price */}
                    <div className="col-span-5 md:col-span-2">
                      <Input
                        type="number"
                        label="السعر"
                        step="0.01"
                        {...register(`items.${index}.unitPrice` as const)}
                        dir="ltr"
                        className="text-center"
                      />
                    </div>

                    {/* Line total */}
                    <div className="col-span-2 md:col-span-1 flex flex-col justify-end">
                      <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">الإجمالي</span>
                      <span className="font-bold text-slate-800 dark:text-slate-100 text-sm text-center">
                        {formatCurrency((watchItems[index]?.quantity || 0) * (watchItems[index]?.unitPrice || 0))}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {(errors.items as any)?.message && (
          <p className="text-xs text-red-500 px-4 pb-3">{(errors.items as any).message}</p>
        )}
      </div>

      {/* ── Section 3: Notes + Financials ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">ملاحظات الطلب</label>
          <textarea
            {...register('notes')}
            rows={4}
            placeholder="ملاحظات للعميل أو للورشة..."
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 px-3 py-2 text-sm text-right resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3 self-start">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">إجمالي الطلبية:</span>
            <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between items-center text-sm gap-2">
            <label className="text-slate-600 dark:text-slate-400 shrink-0">العربون / المدفوع مقدماً:</label>
            <input
              type="number"
              {...register('deposit')}
              min="0"
              dir="ltr"
              className="w-28 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 px-2 py-1 text-left text-sm"
            />
          </div>
          <div className="flex justify-between text-base pt-2 border-t border-slate-200 dark:border-slate-600">
            <span className="font-bold text-slate-800 dark:text-slate-100">المتبقي:</span>
            <span className={`font-bold ${remaining > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {formatCurrency(remaining)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
        <Button type="button" variant="ghost" onClick={onCancel}>إلغاء</Button>
        <Button type="submit" isLoading={isSubmitting}>
          {order ? 'تحديث الطلبية' : 'حفظ وإنشاء الطلبية'}
        </Button>
      </div>
    </form>
  );
};

