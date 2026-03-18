import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ServiceSubtype } from '../../core/types';
import { db } from '../../data/db';
import { generateId, UNITS } from '../../core/utils/formatters';

const schema = z.object({
  name: z.string().min(2, 'الاسم يجب أن يكون أكثر من حرفين'),
  defaultPrice: z.coerce.number().min(0, 'السعر يجب أن يكون موجباً'),
  unit: z.string().default('service'),
  isActive: z.boolean().default(true),
  notes: z.string().optional().default(''),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  categoryId: string;
  subtype?: ServiceSubtype;
  onSuccess: () => void;
  onCancel: () => void;
}

const fieldClass = "w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 p-2.5 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-shadow placeholder:text-slate-400";
const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5";

export const ServiceSubtypeForm = ({ categoryId, subtype, onSuccess, onCancel }: Props) => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: subtype ? {
      name: subtype.name,
      defaultPrice: subtype.defaultPrice,
      unit: subtype.unit,
      isActive: subtype.isActive,
      notes: subtype.notes || '',
    } : { name: '', defaultPrice: 0, unit: 'service', isActive: true, notes: '' }
  });

  const onSubmit = async (data: FormValues) => {
    try {
      if (subtype) {
        await db.serviceSubtypes.update(subtype.id, { ...data, categoryId });
      } else {
        await db.serviceSubtypes.add({
          id: generateId(),
          categoryId,
          name: data.name,
          defaultPrice: data.defaultPrice,
          unit: data.unit,
          isActive: data.isActive,
          notes: data.notes || '',
          createdAt: Date.now(),
        });
      }
      onSuccess();
    } catch (e) {
      alert('حدث خطأ أثناء الحفظ');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className={labelClass}>اسم النوع الفرعي *</label>
        <input
          {...register('name')}
          className={fieldClass}
          placeholder="مثال: باب منزلق، باب متأرجح، واجهة مع زجاج..."
          autoFocus
        />
        {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>السعر الافتراضي *</label>
          <input
            type="number"
            step="0.01"
            min="0"
            {...register('defaultPrice')}
            className={`${fieldClass} text-left`}
            dir="ltr"
            placeholder="0.00"
          />
          {errors.defaultPrice && <p className="mt-1 text-xs text-rose-500">{errors.defaultPrice.message}</p>}
        </div>
        <div>
          <label className={labelClass}>الوحدة</label>
          <select {...register('unit')} className={fieldClass}>
            {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>ملاحظات</label>
        <textarea {...register('notes')} rows={2} className={fieldClass} placeholder="ملاحظات اختيارية..." />
      </div>
      <div className="flex items-center gap-3">
        <input
          id="isActiveSubtype"
          type="checkbox"
          {...register('isActive')}
          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20"
        />
        <label htmlFor="isActiveSubtype" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          النوع مفعّل
        </label>
      </div>
      <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          إلغاء
        </button>
        <button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 disabled:opacity-60 text-white px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors shadow-lg shadow-primary/20">
          <span className="material-symbols-outlined text-[18px]">save</span>
          {subtype ? 'تحديث النوع' : 'إضافة النوع'}
        </button>
      </div>
    </form>
  );
};
