
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { Input } from '../../shared/components/Input';
import { Button } from '../../shared/components/Button';
import type { Invoice, InvoiceItem } from '../../core/types';
import { db } from '../../data/db';
import { generateId, formatCurrency } from '../../core/utils/formatters';
import { Trash2, Plus } from 'lucide-react';

const invoiceItemSchema = z.object({
  type: z.enum(['product', 'service']),
  itemId: z.string().min(1, 'اختر العنصر'),
  quantity: z.coerce.number().min(1, 'الكمية يجب أن تكون 1 على الأقل'),
  unitPrice: z.coerce.number().min(0, 'السعر يجب أن يكون موجباً'),
  name: z.string(),
});

const invoiceSchema = z.object({
  customerId: z.string().min(1, 'يجب اختيار زبون'),
  orderId: z.string().optional(),
  status: z.enum(['draft', 'issued', 'paid', 'cancelled']),
  discount: z.coerce.number().min(0, 'التخفيض يجب أن يكون موجباً'),
  paid: z.coerce.number().min(0, 'المبلغ المدفوع يجب أن يكون موجباً'),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'يجب إضافة عنصر واحد على الأقل للفاتورة'),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

interface Props {
  invoice?: Invoice & { items: InvoiceItem[] };
  onSuccess: () => void;
  onCancel: () => void;
}

export const InvoiceForm = ({ invoice, onSuccess, onCancel }: Props) => {
  const customers = useLiveQuery(() => db.customers.toArray()) || [];
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const orders = useLiveQuery(() => db.orders.where('status').notEqual('installed').toArray()) || [];

  const { register, control, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema) as any,
    defaultValues: {
      customerId: invoice?.customerId || '',
      orderId: invoice?.orderId || '',
      status: invoice?.status || 'issued',
      discount: invoice?.discount || 0,
      paid: invoice?.paid || 0,
      notes: invoice?.notes || '',
      items: invoice?.items || [],
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  });

  const watchItems = watch('items');
  const watchDiscount = watch('discount') || 0;
  const watchPaid = watch('paid') || 0;

  const subtotal = watchItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice || 0), 0);
  const total = Math.max(0, subtotal - watchDiscount);
  const remaining = Math.max(0, total - watchPaid);

  const handleProductSelect = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setValue(`items.${index}.name`, product.name);
      setValue(`items.${index}.unitPrice`, product.sellingPrice);
      setValue(`items.${index}.quantity`, 1);
    }
  };

  const handleOrderImport = async (orderId: string) => {
    if (!orderId) return;
    const orderItems = await db.orderItems.where('orderId').equals(orderId).toArray();
    const order = await db.orders.get(orderId);
    if (order) {
      setValue('customerId', order.customerId);
      setValue('paid', order.deposit);
    }
    
    // Clear existing and append order items
    remove();
    orderItems.forEach(item => {
      append({
        type: item.type,
        itemId: item.itemId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      });
    });
  };

  const onSubmit = async (data: InvoiceFormValues) => {
    try {
      await db.transaction('rw', [db.invoices, db.invoiceItems, db.customers, db.inventory, db.stockMovements], async () => {
        const invoiceId = invoice?.id || generateId();
        
        const invoiceData = {
          id: invoiceId,
          invoiceNumber: invoice?.invoiceNumber || Date.now(),
          orderId: data.orderId || undefined,
          customerId: data.customerId,
          date: new Date().toISOString(),
          subtotal,
          discount: data.discount,
          total,
          paid: data.paid,
          remaining,
          status: data.status,
          notes: data.notes,
          createdAt: invoice?.createdAt || Date.now()
        };

        const isNewAndIssued = !invoice && data.status !== 'draft';

        if (invoice) {
          await db.invoices.put(invoiceData);
          await db.invoiceItems.where('invoiceId').equals(invoiceId).delete();
          // We do not handle complex stock return on edit in v1 to keep it simple,
          // usually edit is locked after issue in accounting systems.
        } else {
          await db.invoices.add(invoiceData);
        }

        const itemsToAdd = data.items.map(item => ({
          id: generateId(),
          invoiceId,
          type: item.type,
          itemId: item.itemId,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.quantity * item.unitPrice
        }));
        await db.invoiceItems.bulkAdd(itemsToAdd);

        // Core Business Logic: Deduct stock and update customer balance on NEW ISSUED invoice
        if (isNewAndIssued) {
          // 1. Update Customer Balance
          const customer = await db.customers.get(data.customerId);
          if (customer && remaining > 0) {
            await db.customers.update(customer.id, {
              balance: customer.balance + remaining
            });
          }

          // 2. Deduct Stock for Products
          for (const item of itemsToAdd) {
            if (item.type === 'product') {
              const product = await db.products.get(item.itemId);
              if (product && product.inventoryItemId) {
                const invItem = await db.inventory.get(product.inventoryItemId);
                if (invItem) {
                  await db.inventory.update(invItem.id, {
                    quantity: invItem.quantity - item.quantity
                  });
                  // Record movement
                  await db.stockMovements.add({
                    id: generateId(),
                    itemId: invItem.id,
                    type: 'out',
                    quantity: item.quantity,
                    referenceId: invoiceId,
                    date: new Date().toISOString(),
                    createdAt: Date.now()
                  });
                }
              }
            }
          }
        }
      });
      onSuccess();
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('حدث خطأ أثناء حفظ الفاتورة');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit as any)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">استيراد من طلبية (اختياري)</label>
          <select 
            {...register('orderId')} 
            onChange={(e) => {
              register('orderId').onChange(e);
              handleOrderImport(e.target.value);
            }}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
          >
            <option value="">لا يوجد...</option>
            {orders.map(o => <option key={o.id} value={o.id}>طلب #{o.orderNumber}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">الزبون *</label>
          <select 
            {...register('customerId')} 
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
          >
            <option value="">اختر زبوناً...</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {errors.customerId && <span className="text-xs text-red-500">{errors.customerId.message}</span>}
        </div>

        <div>
           <label className="block text-sm font-medium text-slate-700 mb-1">حالة الفاتورة *</label>
           <select 
            {...register('status')} 
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-right"
          >
            <option value="draft">مسودة</option>
            <option value="issued">مُصدرة (نهائية)</option>
            <option value="paid">مدفوعة كلياً</option>
          </select>
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 font-tajawal">عناصر الفاتورة</h3>
          <Button 
            type="button" 
            size="sm" 
            icon={Plus} 
            onClick={() => append({ type: 'product', itemId: '', name: '', quantity: 1, unitPrice: 0 })}
          >
            إضافة عنصر
          </Button>
        </div>
        
        {fields.length === 0 && (
          <div className="p-8 text-center text-slate-500">لم يتم إضافة أي عناصر للفاتورة بعد.</div>
        )}
        
        {fields.length > 0 && (
          <div className="p-4 space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-3 items-end border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                <input type="hidden" {...register(`items.${index}.type` as const)} />
                <input type="hidden" {...register(`items.${index}.name` as const)} />
                
                <div className="col-span-12 md:col-span-5">
                  <label className="block text-xs font-medium text-slate-500 mb-1">المنتج / الخدمة</label>
                  <select 
                    {...register(`items.${index}.itemId` as const)} 
                    onChange={(e) => handleProductSelect(index, e.target.value)}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-primary-500 text-right"
                  >
                    <option value="">اختر...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                
                <div className="col-span-6 md:col-span-2">
                  <Input type="number" label="السعر" {...register(`items.${index}.unitPrice` as const)} step="0.01" dir="ltr" className="text-center" />
                </div>
                
                <div className="col-span-4 md:col-span-2">
                  <Input type="number" label="الكمية" {...register(`items.${index}.quantity` as const)} dir="ltr" className="text-center" />
                </div>

                <div className="col-span-2 md:col-span-2 flex items-center justify-center">
                  <div className="font-bold text-slate-800 mt-6">
                    {formatCurrency((watchItems[index]?.quantity || 0) * (watchItems[index]?.unitPrice || 0))}
                  </div>
                </div>

                <div className="col-span-12 md:col-span-1 flex justify-end">
                  <button type="button" onClick={() => remove(index)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg mb-1">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
           <Input label="ملاحظات الفاتورة" {...register('notes')} />
        </div>
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">المجموع الفرعي:</span>
            <span className="font-bold text-slate-800">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600">التخفيض:</span>
            <div className="w-32">
              <input type="number" {...register('discount')} className="w-full rounded-md border border-slate-300 px-2 py-1 text-left text-sm" dir="ltr" />
            </div>
          </div>
          <div className="flex justify-between text-lg pt-2 border-t border-slate-200">
            <span className="font-bold text-slate-800">الإجمالي النهائي:</span>
            <span className="font-bold text-slate-800">{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between items-center text-sm pt-2">
            <span className="text-slate-600">المبلغ المدفوع:</span>
            <div className="w-32">
              <input type="number" {...register('paid')} className="w-full rounded-md border border-slate-300 px-2 py-1 text-left text-sm" dir="ltr" />
            </div>
          </div>
          <div className="flex justify-between text-md font-bold pt-2 border-t border-slate-200">
            <span className="text-slate-800">الباقي للدفع (ديون):</span>
            <span className={remaining > 0 ? 'text-red-600' : 'text-emerald-600'}>{formatCurrency(remaining)}</span>
          </div>
        </div>
      </div>
      
      <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
        <Button type="button" variant="ghost" onClick={onCancel}>
          إلغاء
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {invoice ? 'تحديث الفاتورة' : 'إصدار الفاتورة وتحديث المخزون'}
        </Button>
      </div>
    </form>
  );
};
