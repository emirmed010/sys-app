import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { Product } from '../../core/types';
import { db } from '../../data/db';
import { generateId, UNITS } from '../../core/utils/formatters';

const productSchema = z.object({
  code: z.string().min(1, 'الكود مطلوب'),
  name: z.string().min(2, 'الاسم يجب أن يكون أكثر من حرفين'),
  categoryId: z.string().optional().default(''),
  unit: z.string().min(1, 'الوحدة مطلوبة'),
  costPrice: z.coerce.number().min(0, 'السعر يجب أن يكون موجباً'),
  sellingPrice: z.coerce.number().min(0, 'السعر يجب أن يكون موجباً'),
  quantity: z.coerce.number().min(0).default(0),
  minStock: z.coerce.number().min(0).default(0),
  notes: z.string().optional().default(''),
  inventoryItemId: z.string().optional().default(''),
});

type FormValues = z.infer<typeof productSchema>;

interface Props {
  product?: Product;
  onSuccess: () => void;
  onCancel: () => void;
}

const fieldClass = "w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-shadow placeholder:text-slate-400";
const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5";

export const ProductForm = ({ product, onSuccess, onCancel }: Props) => {
  const inventoryItems = useLiveQuery(() => db.inventory.orderBy('name').toArray()) ?? [];

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: product ? {
      code: product.code,
      name: product.name,
      categoryId: product.categoryId || '',
      unit: product.unit || 'piece',
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      quantity: product.quantity ?? 0,
      minStock: product.minStock ?? 0,
      notes: product.notes || '',
      inventoryItemId: product.inventoryItemId || '',
    } : {
      code: '',
      name: '',
      categoryId: '',
      unit: 'piece',
      costPrice: 0,
      sellingPrice: 0,
      quantity: 0,
      minStock: 0,
      notes: '',
      inventoryItemId: '',
    }
  });

  const onSubmit = async (data: FormValues) => {
    try {
      const record: Product = {
        id: product?.id || generateId(),
        code: data.code,
        name: data.name,
        categoryId: data.categoryId || '',
        unit: data.unit,
        costPrice: data.costPrice,
        sellingPrice: data.sellingPrice,
        quantity: data.quantity,
        minStock: data.minStock,
        notes: data.notes || '',
        inventoryItemId: data.inventoryItemId || undefined,
        createdAt: product?.createdAt || Date.now(),
      };

      if (product) {
        await db.products.put(record);
      } else {
        await db.products.add(record);
      }
      onSuccess();
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء حفظ المنتج');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Row 1: Code + Category */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>كود المنتج *</label>
          <input
            {...register('code')}
            className={fieldClass}
            dir="ltr"
            autoFocus
            placeholder="مثال: ALU-001"
          />
          {errors.code && <p className="mt-1 text-xs text-rose-500">{errors.code.message}</p>}
        </div>
        <div>
          <label className={labelClass}>التصنيف</label>
          <input
            {...register('categoryId')}
            className={fieldClass}
            placeholder="مثال: ألمنيوم، زجاج..."
          />
        </div>
      </div>

      {/* Row 2: Name */}
      <div>
        <label className={labelClass}>اسم المنتج *</label>
        <input
          {...register('name')}
          className={fieldClass}
          placeholder="مثال: قضيب ألمنيوم 6 متر"
        />
        {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>}
      </div>

      {/* Row 3: Unit + Prices */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>الوحدة *</label>
          <select {...register('unit')} className={fieldClass}>
            {UNITS.map(u => (
              <option key={u.value} value={u.value}>{u.label}</option>
            ))}
          </select>
          {errors.unit && <p className="mt-1 text-xs text-rose-500">{errors.unit.message}</p>}
        </div>
        <div>
          <label className={labelClass}>سعر التكلفة (الشراء)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('costPrice')}
            className={`${fieldClass} text-left`}
            dir="ltr"
          />
          {errors.costPrice && <p className="mt-1 text-xs text-rose-500">{errors.costPrice.message}</p>}
        </div>
        <div>
          <label className={labelClass}>سعر البيع *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('sellingPrice')}
            className={`${fieldClass} text-left`}
            dir="ltr"
          />
          {errors.sellingPrice && <p className="mt-1 text-xs text-rose-500">{errors.sellingPrice.message}</p>}
        </div>
      </div>

      {/* Row 4: Quantity + Min Stock */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>الكمية المتوفرة حالياً</label>
          <input
            type="number"
            min="0"
            step="1"
            {...register('quantity')}
            className={`${fieldClass} text-left`}
            dir="ltr"
          />
        </div>
        <div>
          <label className={labelClass}>حد الإنذار (الكمية الدنيا)</label>
          <input
            type="number"
            min="0"
            step="1"
            {...register('minStock')}
            className={`${fieldClass} text-left`}
            dir="ltr"
          />
        </div>
      </div>

      {/* Row 5: Inventory Link */}
      <div>
        <label className={labelClass}>ربط بصنف مخزون (اختياري)</label>
        <select {...register('inventoryItemId')} className={fieldClass}>
          <option value="">— بدون ربط —</option>
          {inventoryItems.map(item => (
            <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
          ))}
        </select>
      </div>

      {/* Row 6: Notes */}
      <div>
        <label className={labelClass}>ملاحظات</label>
        <textarea
          {...register('notes')}
          rows={2}
          className={fieldClass}
          placeholder="أي ملاحظات إضافية..."
        />
      </div>

      {/* Buttons */}
      <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          إلغاء
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-primary hover:bg-primary/90 disabled:opacity-60 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          {product ? 'تحديث المنتج' : 'إضافة المنتج'}
        </button>
      </div>
    </form>
  );
};
