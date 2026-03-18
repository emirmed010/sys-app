import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { Input } from '../../shared/components/Input';
import { Button } from '../../shared/components/Button';
import { Purchase, PurchaseItem } from '../../core/types';
import { db } from '../../data/db';
import { generateId, formatCurrency } from '../../core/utils/formatters';

const purchaseItemSchema = z.object({
  itemId: z.string().optional(),
  name: z.string().min(1, 'اسم الصنف مطلوب'),
  quantity: z.coerce.number().min(0.001, 'الكمية يجب أن تكون أكبر من صفر'),
  unitPrice: z.coerce.number().min(0, 'سعر الشراء يجب أن يكون موجباً'),
});

const purchaseSchema = z.object({
  supplierId: z.string().min(1, 'يجب اختيار مورد'),
  date: z.string().min(1, 'التاريخ مطلوب'),
  paid: z.coerce.number().min(0, 'المبلغ المدفوع يجب أن يكون موجباً'),
  notes: z.string().optional(),
  items: z.array(purchaseItemSchema).min(1, 'يجب إضافة صنف واحد على الأقل'),
});

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

interface Props {
  purchase?: Purchase & { items: PurchaseItem[] };
  onSuccess: () => void;
  onCancel: () => void;
}

export const PurchaseForm = ({ purchase, onSuccess, onCancel }: Props) => {
  const suppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray()) ?? [];
  const inventoryItems = useLiveQuery(() => db.inventory.orderBy('name').toArray()) ?? [];

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema) as any,
    defaultValues: {
      supplierId: purchase?.supplierId ?? '',
      date: purchase?.date
        ? new Date(purchase.date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      paid: purchase?.paid ?? 0,
      notes: purchase?.notes ?? '',
      items: purchase?.items?.map(i => ({
        itemId: i.itemId ?? '',
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })) ?? [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const watchItems = watch('items');
  const watchPaid = watch('paid') ?? 0;

  const subtotal = (watchItems ?? []).reduce(
    (s, item) => s + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  );
  const remaining = Math.max(0, subtotal - Number(watchPaid));

  const handleInventorySelect = (index: number, itemId: string) => {
    const inv = inventoryItems.find(i => i.id === itemId);
    if (inv) {
      setValue(`items.${index}.name`, inv.name);
      setValue(`items.${index}.unitPrice`, inv.purchasePrice);
      setValue(`items.${index}.itemId`, inv.id);
    }
  };

  const onSubmit = async (data: PurchaseFormValues) => {
    try {
      const paid = Number(data.paid);
      const total = subtotal;
      const rem = Math.max(0, total - paid);

      await db.transaction('rw', [db.purchases, db.purchaseItems, db.settings, db.suppliers, db.inventory, db.stockMovements], async () => {
        let purchaseId: string;

        if (purchase) {
          purchaseId = purchase.id;
          // Reverse old inventory additions
          const oldItems = await db.purchaseItems.where('purchaseId').equals(purchaseId).toArray();
          for (const oi of oldItems) {
            if (oi.itemId) {
              const inv = await db.inventory.get(oi.itemId);
              if (inv) await db.inventory.update(oi.itemId, { quantity: Math.max(0, inv.quantity - oi.quantity) });
            }
          }
          await db.purchaseItems.where('purchaseId').equals(purchaseId).delete();

          // Update supplier balance delta
          const oldPurchase = await db.purchases.get(purchaseId);
          if (oldPurchase) {
            const supplier = await db.suppliers.get(data.supplierId);
            if (supplier) {
              const delta = rem - oldPurchase.remaining;
              await db.suppliers.update(data.supplierId, {
                balance: Math.max(0, supplier.balance + delta),
              });
            }
          }

          await db.purchases.update(purchaseId, {
            supplierId: data.supplierId,
            date: data.date,
            total,
            paid,
            remaining: rem,
            notes: data.notes,
          });
        } else {
          // New purchase — get sequential number
          const settings = await db.settings.get('MASTER');
          const seq = (settings?.purchaseNumberSequence ?? 0) + 1;
          await db.settings.put({ ...settings, purchaseNumberSequence: seq } as any);

          purchaseId = generateId();
          await db.purchases.add({
            id: purchaseId,
            purchaseNumber: seq,
            supplierId: data.supplierId,
            date: data.date,
            total,
            paid,
            remaining: rem,
            notes: data.notes,
            createdAt: Date.now(),
          });

          // Update supplier balance
          const supplier = await db.suppliers.get(data.supplierId);
          if (supplier && rem > 0) {
            await db.suppliers.update(data.supplierId, { balance: supplier.balance + rem });
          }
        }

        // Save items and update inventory
        for (const item of data.items) {
          await db.purchaseItems.add({
            id: generateId(),
            purchaseId,
            itemId: item.itemId ?? '',
            name: item.name,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
            lineTotal: Number(item.quantity) * Number(item.unitPrice),
          });

          // Update inventory quantity if linked
          if (item.itemId) {
            const inv = await db.inventory.get(item.itemId);
            if (inv) {
              await db.inventory.update(item.itemId, { quantity: inv.quantity + Number(item.quantity) });
              await db.stockMovements.add({
                id: generateId(),
                itemId: item.itemId,
                type: 'in',
                quantity: Number(item.quantity),
                referenceId: purchaseId,
                notes: `شراء #${purchase?.purchaseNumber ?? ''}`,
                date: data.date,
                createdAt: Date.now(),
              });
            }
          }
        }
      });

      onSuccess();
    } catch (error) {
      console.error('Error saving purchase:', error);
      alert('حدث خطأ أثناء حفظ عملية الشراء');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Header fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">المورد *</label>
          <select
            {...register('supplierId')}
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="">— اختر المورد —</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {errors.supplierId && (
            <p className="text-xs text-rose-500">{errors.supplierId.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">تاريخ الشراء *</label>
          <input
            type="date"
            {...register('date')}
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          {errors.date && <p className="text-xs text-rose-500">{errors.date.message}</p>}
        </div>
      </div>

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-300">الأصناف المشتراة</label>
          <button
            type="button"
            onClick={() => append({ itemId: '', name: '', quantity: 1, unitPrice: 0 })}
            className="text-xs bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-base">add</span>
            إضافة صنف
          </button>
        </div>

        {(errors.items as any)?.root?.message && (
          <p className="text-xs text-rose-500 mb-2">{(errors.items as any).root.message}</p>
        )}

        <div className="space-y-3">
          {fields.map((field, index) => (
            <div key={field.id} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">صنف {index + 1}</span>
                <button
                  type="button"
                  onClick={() => remove(index)}
                  className="text-rose-400 hover:text-rose-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>

              {/* Optional inventory link */}
              <div className="mb-2">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">ربط بالمخزون (اختياري)</label>
                <select
                  onChange={e => handleInventorySelect(index, e.target.value)}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">— اختر من المخزون —</option>
                  {inventoryItems.map(inv => (
                    <option key={inv.id} value={inv.id}>{inv.name} ({inv.code})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-3">
                  <Input
                    label="اسم الصنف *"
                    {...register(`items.${index}.name`)}
                    error={(errors.items?.[index] as any)?.name?.message}
                    placeholder="اسم المادة أو المنتج المشترى"
                  />
                </div>
                <Input
                  label="الكمية *"
                  type="number"
                  step="0.001"
                  {...register(`items.${index}.quantity`)}
                  error={(errors.items?.[index] as any)?.quantity?.message}
                />
                <Input
                  label="سعر الشراء *"
                  type="number"
                  step="0.01"
                  {...register(`items.${index}.unitPrice`)}
                  error={(errors.items?.[index] as any)?.unitPrice?.message}
                />
                <div className="flex items-end pb-0.5">
                  <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-md px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 text-center">
                    {formatCurrency(
                      (Number(watchItems?.[index]?.quantity) || 0) *
                      (Number(watchItems?.[index]?.unitPrice) || 0)
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {fields.length === 0 && (
            <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
              اضغط "إضافة صنف" لإضافة الأصناف المشتراة
            </div>
          )}
        </div>
      </div>

      {/* Payment summary */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700 space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-600 dark:text-slate-400">الإجمالي</span>
          <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between items-center">
          <label className="text-sm text-slate-600 dark:text-slate-400">المبلغ المدفوع</label>
          <div className="w-40">
            <input
              type="number" step="0.01" min="0"
              {...register('paid')}
              className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-1.5 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>
        <div className="flex justify-between items-center text-sm border-t border-slate-200 dark:border-slate-700 pt-3">
          <span className="font-bold text-slate-700 dark:text-slate-200">المتبقي (دين للمورد)</span>
          <span className={`font-bold text-lg ${remaining > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}`}>
            {formatCurrency(remaining)}
          </span>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">ملاحظات</label>
        <textarea
          {...register('notes')}
          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[60px]"
          placeholder="أي تفاصيل إضافية عن عملية الشراء..."
        />
      </div>

      <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
        <Button type="button" variant="ghost" onClick={onCancel}>إلغاء</Button>
        <Button type="submit" isLoading={isSubmitting} icon="save">
          {purchase ? 'حفظ التعديلات' : 'تسجيل عملية الشراء'}
        </Button>
      </div>
    </form>
  );
};
