import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { InventoryItem } from '../../core/types';
import { db } from '../../data/db';
import { generateId, UNITS } from '../../core/utils/formatters';

const schema = z.object({
  code: z.string().min(1, 'الكود مطلوب'),
  name: z.string().min(2, 'الاسم مطلوب'),
  category: z.string().optional().default(''),
  unit: z.string().default('piece'),
  purchasePrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  quantity: z.coerce.number().min(0),
  minStock: z.coerce.number().min(0),
  defaultSupplierId: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

type FormValues = z.infer<typeof schema>;

const fieldClass = "w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none placeholder:text-slate-400";
const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5";

interface Props {
  item?: InventoryItem;
  onSuccess: () => void;
  onCancel: () => void;
}

export const InventoryItemForm = ({ item, onSuccess, onCancel }: Props) => {
  const suppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray()) ?? [];

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: item ? {
      code: item.code,
      name: item.name,
      category: item.category || '',
      unit: item.unit || 'piece',
      purchasePrice: item.purchasePrice,
      sellingPrice: item.sellingPrice,
      quantity: item.quantity,
      minStock: item.minStock,
      defaultSupplierId: item.defaultSupplierId ?? '',
      notes: item.notes || '',
    } : {
      code: '', name: '', category: '', unit: 'piece',
      purchasePrice: 0, sellingPrice: 0, quantity: 0, minStock: 0,
      defaultSupplierId: '', notes: ''
    }
  });

  const onSubmit = async (data: FormValues) => {
    try {
      const record: InventoryItem = {
        id: item?.id || generateId(),
        code: data.code,
        name: data.name,
        category: data.category || '',
        unit: data.unit,
        purchasePrice: data.purchasePrice,
        sellingPrice: data.sellingPrice,
        quantity: data.quantity,
        minStock: data.minStock,
        defaultSupplierId: data.defaultSupplierId || undefined,
        notes: data.notes || '',
        createdAt: item?.createdAt || Date.now(),
      };
      if (item) {
        await db.inventory.put(record);
      } else {
        await db.inventory.add(record);
      }
      onSuccess();
    } catch (e) {
      alert('حدث خطأ أثناء الحفظ');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Code + Category */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>الرمز / الكود *</label>
          <input {...register('code')} className={fieldClass} placeholder="ALU-001" dir="ltr" autoFocus />
          {errors.code && <p className="mt-1 text-xs text-rose-500">{errors.code.message}</p>}
        </div>
        <div>
          <label className={labelClass}>التصنيف</label>
          <input {...register('category')} className={fieldClass} placeholder="مثال: ألمنيوم، زجاج..." />
        </div>
      </div>

      {/* Name */}
      <div>
        <label className={labelClass}>اسم المادة / العنصر *</label>
        <input {...register('name')} className={fieldClass} placeholder="مثال: قضيب ألمنيوم 6 متر" />
        {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>}
      </div>

      {/* Unit + Prices */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>الوحدة</label>
          <select {...register('unit')} className={fieldClass}>
            {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>سعر الشراء</label>
          <input type="number" step="0.01" min="0" {...register('purchasePrice')} className={`${fieldClass} text-left`} dir="ltr" />
        </div>
        <div>
          <label className={labelClass}>سعر البيع</label>
          <input type="number" step="0.01" min="0" {...register('sellingPrice')} className={`${fieldClass} text-left`} dir="ltr" />
        </div>
      </div>

      {/* Qty + minStock */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>الكمية الحالية</label>
          <input type="number" min="0" step="1" {...register('quantity')} className={`${fieldClass} text-left`} dir="ltr" />
        </div>
        <div>
          <label className={labelClass}>حد الإنذار (كمية دنيا)</label>
          <input type="number" min="0" step="1" {...register('minStock')} className={`${fieldClass} text-left`} dir="ltr" />
        </div>
      </div>

      {/* Supplier */}
      <div>
        <label className={labelClass}>المورد الأساسي (اختياري)</label>
        <select {...register('defaultSupplierId')} className={fieldClass}>
          <option value="">— بدون مورد محدد —</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className={labelClass}>ملاحظات</label>
        <textarea {...register('notes')} rows={2} className={fieldClass} placeholder="ملاحظات اختيارية..." />
      </div>

      {/* Buttons */}
      <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          إلغاء
        </button>
        <button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 disabled:opacity-60 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-[18px]">save</span>
          {item ? 'تحديث العنصر' : 'إضافة للمخزون'}
        </button>
      </div>
    </form>
  );
};
